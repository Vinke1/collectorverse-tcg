/**
 * Script de seeding pour les collections McDonald's Pokemon via l'API TCGdex
 *
 * Usage:
 *   npx tsx scripts/seed-pokemon-mcdonalds.ts                  # Seed toutes les collections McDonald's
 *   npx tsx scripts/seed-pokemon-mcdonalds.ts --dry-run        # Preview sans modifications
 *   npx tsx scripts/seed-pokemon-mcdonalds.ts --set=mcd19      # Seed une collection spécifique
 *   npx tsx scripts/seed-pokemon-mcdonalds.ts --limit=20       # Limiter le nombre de cartes
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = 'https://api.tcgdex.net/v2/en'
// Les images McDonald's ne sont pas disponibles sur TCGdex, on utilise pokemontcg.io
const IMAGES_BASE = 'https://images.pokemontcg.io'

// Mapping TCGdex set IDs vers nos codes (nomenclature existante)
const TCGDEX_TO_MCD_MAP: Record<string, string> = {
  '2011bw': 'mcd11',
  '2012bw': 'mcd12',
  '2014xy': 'mcd14',
  '2015xy': 'mcd15',
  '2016xy': 'mcd16',
  '2017sm': 'mcd17',
  '2018sm': 'mcd18',
  '2019sm': 'mcd19',
  '2021swsh': 'mcd21',
}

// Mapping inverse pour la recherche par code
const MCD_TO_TCGDEX_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TCGDEX_TO_MCD_MAP).map(([k, v]) => [v, k])
)

// Collections McDonald's disponibles (9 sets, ~121 cartes total)
const MCDONALDS_SETS = Object.values(TCGDEX_TO_MCD_MAP)

// Délais entre les requêtes (ms)
const API_DELAYS = {
  betweenSets: 2000,        // Entre chaque set
  betweenCards: 500,        // Entre chaque carte
  betweenRetries: 3000,     // Entre les retries (exponential backoff)
  betweenUploads: 300,      // Entre les uploads d'images
}

// Configuration des images
const IMAGE_CONFIG = {
  quality: 85,
  width: 480,
  height: 672,
  format: 'webp' as const,
}

// Retry configuration (exponential backoff)
const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 30000,
}

// ============================================
// TYPES (TCGdex)
// ============================================

interface TCGdexSet {
  id: string
  name: string
  logo?: string
  symbol?: string
  cardCount: {
    total: number
    official: number
  }
  releaseDate?: string
  serie?: {
    id: string
    name: string
  }
}

interface TCGdexSetDetail extends TCGdexSet {
  cards: Array<{
    id: string
    localId: string
    name: string
  }>
}

interface TCGdexCard {
  id: string
  localId: string
  name: string
  category?: string
  illustrator?: string
  rarity?: string
  hp?: number
  types?: string[]
  stage?: string
  description?: string
  attacks?: Array<{
    name: string
    cost?: string[]
    damage?: string
    effect?: string
  }>
  abilities?: Array<{
    name: string
    effect?: string
    type?: string
  }>
  weaknesses?: Array<{
    type: string
    value?: string
  }>
  resistances?: Array<{
    type: string
    value?: string
  }>
  retreat?: number
  regulationMark?: string
  set: {
    id: string
    name: string
    cardCount?: {
      total: number
      official: number
    }
  }
}

interface SeedOptions {
  dryRun: boolean
  specificSet?: string
  limit?: number
}

// ============================================
// API HELPERS WITH EXPONENTIAL BACKOFF
// ============================================

async function fetchWithRetry<T>(
  url: string,
  retries = RETRY_CONFIG.maxRetries
): Promise<T | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CollectorVerse-TCG/1.0',
        },
      })

      if (response.status === 404) {
        logger.warn(`Not found (404): ${url}`)
        return null
      }

      if (response.status === 429) {
        // Rate limited - use exponential backoff
        const retryDelay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        )
        logger.warn(`Rate limited (429), retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${retries})`)
        await delay(retryDelay)
        continue
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      const isLastRetry = attempt === retries - 1
      const retryDelay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      )

      if (isLastRetry) {
        logger.error(`Failed to fetch ${url} after ${retries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return null
      }

      logger.warn(`Retry ${attempt + 1}/${retries} for ${url} (delay: ${retryDelay}ms)`)
      await delay(retryDelay)
    }
  }
  return null
}

async function fetchMcDonaldsSets(): Promise<Array<TCGdexSet & { mcdCode: string }>> {
  logger.processing('Fetching McDonald\'s sets from TCGdex API...')
  const url = `${API_BASE}/sets`
  const response = await fetchWithRetry<TCGdexSet[]>(url)

  if (!response) {
    logger.error('Failed to fetch sets from TCGdex')
    return []
  }

  // Filter to only include McDonald's sets and add our mcdCode
  const sets = response
    .filter(set => TCGDEX_TO_MCD_MAP[set.id])
    .map(set => ({
      ...set,
      mcdCode: TCGDEX_TO_MCD_MAP[set.id]
    }))

  logger.success(`Found ${sets.length} McDonald's sets`)
  return sets
}

async function fetchSetDetail(tcgdexSetId: string): Promise<TCGdexSetDetail | null> {
  logger.processing(`Fetching set detail for ${tcgdexSetId}...`)
  const url = `${API_BASE}/sets/${tcgdexSetId}`
  return await fetchWithRetry<TCGdexSetDetail>(url)
}

async function fetchCard(cardId: string): Promise<TCGdexCard | null> {
  const url = `${API_BASE}/cards/${cardId}`
  return await fetchWithRetry<TCGdexCard>(url)
}

// ============================================
// IMAGE HELPERS
// ============================================

function getCardImageUrl(mcdCode: string, cardLocalId: string): string {
  // pokemontcg.io image URL format: https://images.pokemontcg.io/{setId}/{cardNumber}_hires.png
  // Les images McDonald's ne sont pas disponibles sur TCGdex, on utilise pokemontcg.io
  return `${IMAGES_BASE}/${mcdCode}/${cardLocalId}_hires.png`
}

async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    let response = await fetch(imageUrl)

    // Fallback: essayer l'image normale si la haute résolution n'existe pas
    if (!response.ok && imageUrl.includes('_hires.png')) {
      const normalUrl = imageUrl.replace('_hires.png', '.png')
      response = await fetch(normalUrl)
      if (!response.ok) {
        logger.warn(`Failed to download image (${response.status}): ${normalUrl}`)
        return null
      }
    } else if (!response.ok) {
      logger.warn(`Failed to download image (${response.status}): ${imageUrl}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    return sharp(Buffer.from(buffer))
      .resize(IMAGE_CONFIG.width, IMAGE_CONFIG.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: IMAGE_CONFIG.quality })
      .toBuffer()
  } catch (error) {
    logger.error(`Failed to optimize image: ${imageUrl}`)
    return null
  }
}

async function uploadCardImage(
  supabase: ReturnType<typeof createAdminClient>,
  imageBuffer: Buffer,
  setCode: string,
  cardNumber: string
): Promise<string | null> {
  const bucketName = 'pokemon-cards'
  const filePath = `${setCode}/en/${cardNumber}.webp`

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, imageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) throw error

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    return data.publicUrl
  } catch (error) {
    logger.error(`Failed to upload image: ${filePath}`)
    return null
  }
}

// ============================================
// DATABASE HELPERS
// ============================================

async function upsertSet(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  set: TCGdexSet & { mcdCode: string }
): Promise<string | null> {
  // Utiliser notre code mcd (nomenclature existante)
  const seriesCode = set.mcdCode

  // Check if series already exists
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', seriesCode)
    .single()

  const seriesData = {
    tcg_game_id: tcgGameId,
    code: seriesCode,
    name: set.name,
    pokemon_series_id: null, // McDonald's sets don't belong to a specific series
    release_date: set.releaseDate || null,
    image_url: set.logo || null,
    symbol_url: set.symbol || null,
    official_card_count: set.cardCount.official || null,
    total_card_count: set.cardCount.total || null,
    max_set_base: set.cardCount.official || set.cardCount.total || 0,
    master_set: set.cardCount.total || null,
  }

  if (existing?.id) {
    // Update existing series
    const { error } = await supabase
      .from('series')
      .update(seriesData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update set ${seriesCode}: ${error.message}`)
      return null
    }
    logger.info(`  Updated existing series: ${set.name} (${seriesCode})`)
    return existing.id
  } else {
    // Insert new series
    const { data, error } = await supabase
      .from('series')
      .insert(seriesData)
      .select('id')
      .single()

    if (error) {
      logger.error(`Failed to insert set ${seriesCode}: ${error.message}`)
      return null
    }
    logger.success(`  Created new series: ${set.name} (${seriesCode})`)
    return data?.id || null
  }
}

async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: TCGdexCard,
  imageUrl?: string
): Promise<string | null> {
  // Normaliser la rareté
  const rarityCode = normalizeRarity(card.rarity)

  // Construire les attributs JSONB (format TCGdex)
  const attributes = {
    hp: card.hp || null,
    types: card.types || [],
    stage: card.stage || null,
    description: card.description || null,
    attacks: card.attacks?.map(a => ({
      name: a.name,
      cost: a.cost || [],
      damage: a.damage || '',
      text: a.effect || '',
    })) || [],
    abilities: card.abilities?.map(a => ({
      name: a.name,
      text: a.effect || '',
      type: a.type || '',
    })) || [],
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    retreatCost: card.retreat ? Array(card.retreat).fill('Colorless') : [],
    regulationMark: card.regulationMark || null,
  }

  const cardData = {
    series_id: seriesId,
    number: card.localId,
    language: 'en', // McDonald's cards are English only
    name: card.name,
    rarity: rarityCode,
    image_url: imageUrl || null,
    category: normalizeCategory(card.category),
    illustrator: card.illustrator || null,
    hp: card.hp || null,
    regulation_mark: card.regulationMark || null,
    attributes,
  }

  // Check if card exists
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', card.localId)
    .eq('language', 'en')
    .single()

  if (existing?.id) {
    const { error } = await supabase
      .from('cards')
      .update(cardData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update card ${card.id}: ${error.message}`)
      return null
    }
    return existing.id
  } else {
    const { data, error } = await supabase
      .from('cards')
      .insert(cardData)
      .select('id')
      .single()

    if (error) {
      logger.error(`Failed to insert card ${card.id}: ${error.message}`)
      return null
    }
    return data?.id || null
  }
}

// ============================================
// NORMALIZERS
// ============================================

function normalizeRarity(rarity?: string): string {
  if (!rarity) return 'none'

  const rarityMap: Record<string, string> = {
    'common': 'common',
    'uncommon': 'uncommon',
    'rare': 'rare',
    'rare holo': 'rare-holo',
    'rare holo ex': 'rare-holo-ex',
    'rare holo gx': 'rare-holo-gx',
    'rare holo v': 'rare-holo-v',
    'rare holo vmax': 'rare-holo-vmax',
    'rare holo vstar': 'rare-holo-vstar',
    'ultra rare': 'ultra-rare',
    'promo': 'promo',
    'none': 'none',
  }

  const normalized = rarity.toLowerCase().trim()
  return rarityMap[normalized] || normalized.replace(/\s+/g, '-')
}

function normalizeCategory(category?: string): string {
  if (!category) return 'unknown'

  const categoryMap: Record<string, string> = {
    'pokemon': 'pokemon',
    'pokémon': 'pokemon',
    'trainer': 'trainer',
    'energy': 'energy',
  }

  const normalized = category.toLowerCase().trim()
  return categoryMap[normalized] || 'unknown'
}

// ============================================
// MAIN SEEDING FUNCTIONS
// ============================================

async function seedSet(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  set: TCGdexSet & { mcdCode: string },
  options: SeedOptions
): Promise<boolean> {
  logger.section(`Processing set: ${set.mcdCode} - ${set.name}`)

  if (options.dryRun) {
    logger.info('DRY RUN - No changes will be made')
  }

  // Créer/mettre à jour le set
  let seriesId: string | null = null
  if (!options.dryRun) {
    seriesId = await upsertSet(supabase, tcgGameId, set)
    if (!seriesId) {
      logger.error(`Failed to create series for set ${set.mcdCode}`)
      return false
    }
  } else {
    logger.info(`Would create/update series: ${set.name} (${set.mcdCode})`)
    seriesId = 'dry-run-series-id' // Dummy ID for dry run
  }

  // Récupérer le détail du set avec la liste des cartes
  const setDetail = await fetchSetDetail(set.id)
  if (!setDetail?.cards || setDetail.cards.length === 0) {
    logger.warn(`No cards found for set ${set.id}`)
    return false
  }

  // Appliquer la limite si spécifiée
  const cardsToProcess = options.limit ? setDetail.cards.slice(0, options.limit) : setDetail.cards
  logger.info(`Processing ${cardsToProcess.length} cards (total: ${setDetail.cards.length})`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < cardsToProcess.length; i++) {
    const cardRef = cardsToProcess[i]

    // Afficher la progression
    if (i % 5 === 0 || i === cardsToProcess.length - 1) {
      process.stdout.write(`\r  Processing cards: ${i + 1}/${cardsToProcess.length}`)
    }

    if (options.dryRun) {
      logger.info(`  Would process card: ${cardRef.localId} - ${cardRef.name}`)
      successCount++
      await delay(100)
      continue
    }

    // Récupérer les détails de la carte
    const card = await fetchCard(cardRef.id)
    if (!card) {
      logger.warn(`  Failed to fetch card details: ${cardRef.id}`)
      errorCount++
      continue
    }

    // Télécharger et optimiser l'image (depuis pokemontcg.io car pas dispo sur TCGdex)
    let uploadedImageUrl: string | undefined
    const imageSource = getCardImageUrl(set.mcdCode, card.localId)
    const imageBuffer = await downloadAndOptimizeImage(imageSource)
    if (imageBuffer) {
      // Utiliser mcdCode pour le storage (nomenclature existante)
      uploadedImageUrl = await uploadCardImage(
        supabase,
        imageBuffer,
        set.mcdCode,
        card.localId
      ) || undefined
      await delay(API_DELAYS.betweenUploads)
    }

    // Insérer la carte
    const cardId = await upsertCard(supabase, seriesId!, card, uploadedImageUrl)
    if (cardId) {
      successCount++
    } else {
      errorCount++
    }

    await delay(API_DELAYS.betweenCards)
  }

  console.log('') // Nouvelle ligne après la progression
  logger.success(`Completed: ${successCount} cards processed`)
  if (errorCount > 0) {
    logger.error(`Errors: ${errorCount} cards failed`)
  }

  return true
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2)
  const options: SeedOptions = {
    dryRun: args.includes('--dry-run'),
    specificSet: args.find(a => a.startsWith('--set='))?.split('=')[1],
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || undefined,
  }

  console.log('')
  logger.section('═══════════════════════════════════════════════════════════')
  logger.section('    POKEMON MCDONALD\'S SEEDING - TCGdex API')
  logger.section('═══════════════════════════════════════════════════════════')
  console.log('')

  logger.info('Options:')
  logger.info(`  - Dry run: ${options.dryRun}`)
  logger.info(`  - Specific set: ${options.specificSet || 'all'}`)
  logger.info(`  - Limit cards: ${options.limit || 'none'}`)
  console.log('')

  // Initialize
  const supabase = createAdminClient()

  // Get Pokemon TCG ID
  const { data: tcgGame, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'pokemon')
    .single()

  if (tcgError || !tcgGame) {
    logger.error('Pokemon TCG not found in database')
    process.exit(1)
  }

  const tcgGameId = tcgGame.id
  logger.success(`Pokemon TCG ID: ${tcgGameId}`)
  console.log('')

  // Fetch McDonald's sets
  const sets = await fetchMcDonaldsSets()
  if (sets.length === 0) {
    logger.error('No McDonald\'s sets found')
    process.exit(1)
  }

  // Filter sets if specific set requested (accept both mcdXX and tcgdex format)
  let setsToProcess = sets
  if (options.specificSet) {
    // Convertir tcgdex ID en mcd code si nécessaire
    const targetCode = options.specificSet
    setsToProcess = sets.filter(s =>
      s.mcdCode === targetCode ||
      s.id === targetCode ||
      s.id === MCD_TO_TCGDEX_MAP[targetCode]
    )
    if (setsToProcess.length === 0) {
      logger.error(`Set ${options.specificSet} not found`)
      logger.info('Available sets:')
      sets.forEach(s => logger.info(`  - ${s.mcdCode}: ${s.name} (tcgdex: ${s.id})`))
      process.exit(1)
    }
  }

  // Sort sets by mcdCode
  setsToProcess.sort((a, b) => a.mcdCode.localeCompare(b.mcdCode))

  logger.info(`Sets to process: ${setsToProcess.length}`)
  setsToProcess.forEach(s => logger.info(`  - ${s.mcdCode}: ${s.name} (${s.cardCount.total} cards)`))
  console.log('')

  // Process each set
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < setsToProcess.length; i++) {
    const set = setsToProcess[i]

    logger.info(`[${i + 1}/${setsToProcess.length}] Processing ${set.mcdCode}...`)

    const success = await seedSet(supabase, tcgGameId, set, options)

    if (success) {
      successCount++
    } else {
      errorCount++
    }

    // Delay between sets
    if (i < setsToProcess.length - 1) {
      await delay(API_DELAYS.betweenSets)
    }
  }

  // Summary
  console.log('')
  logger.section('═══════════════════════════════════════════════════════════')
  logger.section('                     SEEDING COMPLETE')
  logger.section('═══════════════════════════════════════════════════════════')
  console.log('')
  logger.success(`Sets processed: ${successCount}`)
  if (errorCount > 0) {
    logger.error(`Sets with errors: ${errorCount}`)
  }
  console.log('')
}

main().catch(error => {
  logger.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
