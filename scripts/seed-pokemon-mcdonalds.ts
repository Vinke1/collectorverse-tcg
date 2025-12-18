/**
 * Script de seeding pour les collections McDonald's Pokemon via l'API pokemontcg.io
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

const API_BASE = 'https://api.pokemontcg.io/v2'

// Collections McDonald's disponibles (10 sets, ~136 cartes total)
const MCDONALDS_SETS = [
  'mcd11', 'mcd12', 'mcd14', 'mcd15', 'mcd16',
  'mcd17', 'mcd18', 'mcd19', 'mcd21', 'mcd22'
]

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
// TYPES
// ============================================

interface PokemonTCGSet {
  id: string
  name: string
  series: string
  printedTotal: number
  total: number
  releaseDate: string
  images: {
    symbol: string
    logo: string
  }
}

interface PokemonTCGCard {
  id: string
  name: string
  number: string
  rarity?: string
  images?: {
    small?: string
    large?: string
  }
  hp?: string
  types?: string[]
  subtypes?: string[]
  supertype?: string
  artist?: string
  set: {
    id: string
    name: string
    total: number
  }
  attacks?: Array<{
    name: string
    cost: string[]
    damage: string
    text: string
  }>
  abilities?: Array<{
    name: string
    text: string
    type: string
  }>
  weaknesses?: Array<{
    type: string
    value: string
  }>
  resistances?: Array<{
    type: string
    value: string
  }>
  retreatCost?: string[]
  nationalPokedexNumbers?: number[]
  evolvesFrom?: string
  regulationMark?: string
}

interface SetsResponse {
  data: PokemonTCGSet[]
}

interface CardsResponse {
  data: PokemonTCGCard[]
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

async function fetchMcDonaldsSets(): Promise<PokemonTCGSet[]> {
  logger.processing('Fetching McDonald\'s sets from API...')
  const url = `${API_BASE}/sets?q=name:mcdonald*`
  const response = await fetchWithRetry<SetsResponse>(url)

  if (!response?.data) {
    logger.error('Failed to fetch McDonald\'s sets')
    return []
  }

  // Filter to only include known McDonald's sets
  const sets = response.data.filter(set => MCDONALDS_SETS.includes(set.id))
  logger.success(`Found ${sets.length} McDonald's sets`)
  return sets
}

async function fetchSetCards(setId: string): Promise<PokemonTCGCard[]> {
  logger.processing(`Fetching cards for set ${setId}...`)
  const url = `${API_BASE}/cards?q=set.id:${setId}`
  const response = await fetchWithRetry<CardsResponse>(url)

  if (!response?.data) {
    logger.error(`Failed to fetch cards for set ${setId}`)
    return []
  }

  logger.info(`  Found ${response.data.length} cards`)
  return response.data
}

// ============================================
// IMAGE HELPERS
// ============================================

async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      logger.warn(`Failed to download image: ${imageUrl}`)
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
  set: PokemonTCGSet
): Promise<string | null> {
  // Check if series already exists
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', set.id)
    .single()

  const seriesData = {
    tcg_game_id: tcgGameId,
    code: set.id,
    name: set.name,
    release_date: set.releaseDate || null,
    image_url: set.images?.logo || null,
    symbol_url: set.images?.symbol || null,
    official_card_count: set.printedTotal || null,
    total_card_count: set.total || null,
    max_set_base: set.printedTotal || set.total || 0,
    master_set: set.total || null,
  }

  if (existing?.id) {
    // Update existing series
    const { error } = await supabase
      .from('series')
      .update(seriesData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update set ${set.id}: ${error.message}`)
      return null
    }
    logger.info(`  Updated existing series: ${set.name}`)
    return existing.id
  } else {
    // Insert new series
    const { data, error } = await supabase
      .from('series')
      .insert(seriesData)
      .select('id')
      .single()

    if (error) {
      logger.error(`Failed to insert set ${set.id}: ${error.message}`)
      return null
    }
    logger.success(`  Created new series: ${set.name}`)
    return data?.id || null
  }
}

async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: PokemonTCGCard,
  imageUrl?: string
): Promise<string | null> {
  // Normaliser la rareté
  const rarityCode = normalizeRarity(card.rarity)

  // Construire les attributs JSONB
  const attributes = {
    hp: card.hp || null,
    types: card.types || [],
    subtypes: card.subtypes || [],
    supertype: card.supertype || null,
    attacks: card.attacks || [],
    abilities: card.abilities || [],
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    retreatCost: card.retreatCost || [],
    nationalPokedexNumbers: card.nationalPokedexNumbers || [],
    evolvesFrom: card.evolvesFrom || null,
    regulationMark: card.regulationMark || null,
  }

  const cardData = {
    series_id: seriesId,
    number: card.number,
    language: 'en', // McDonald's cards are English only
    name: card.name,
    rarity: rarityCode,
    image_url: imageUrl || card.images?.large || card.images?.small || null,
    category: normalizeCategory(card.supertype),
    illustrator: card.artist || null,
    hp: card.hp ? parseInt(card.hp) : null,
    regulation_mark: card.regulationMark || null,
    attributes,
  }

  // Check if card exists
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', card.number)
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
  set: PokemonTCGSet,
  options: SeedOptions
): Promise<boolean> {
  logger.section(`Processing set: ${set.id} - ${set.name}`)

  if (options.dryRun) {
    logger.info('DRY RUN - No changes will be made')
  }

  // Créer/mettre à jour le set
  let seriesId: string | null = null
  if (!options.dryRun) {
    seriesId = await upsertSet(supabase, tcgGameId, set)
    if (!seriesId) {
      logger.error(`Failed to create series for set ${set.id}`)
      return false
    }
  } else {
    logger.info(`Would create/update series: ${set.name}`)
    seriesId = 'dry-run-series-id' // Dummy ID for dry run
  }

  // Récupérer les cartes du set
  const cards = await fetchSetCards(set.id)
  if (cards.length === 0) {
    logger.warn(`No cards found for set ${set.id}`)
    return false
  }

  // Appliquer la limite si spécifiée
  const cardsToProcess = options.limit ? cards.slice(0, options.limit) : cards
  logger.info(`Processing ${cardsToProcess.length} cards (total: ${cards.length})`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < cardsToProcess.length; i++) {
    const card = cardsToProcess[i]

    // Afficher la progression
    if (i % 5 === 0 || i === cardsToProcess.length - 1) {
      process.stdout.write(`\r  Processing cards: ${i + 1}/${cardsToProcess.length}`)
    }

    if (options.dryRun) {
      logger.info(`  Would process card: ${card.number} - ${card.name}`)
      successCount++
      await delay(100)
      continue
    }

    // Télécharger et optimiser l'image
    let uploadedImageUrl: string | undefined
    const imageSource = card.images?.large || card.images?.small
    if (imageSource) {
      const imageBuffer = await downloadAndOptimizeImage(imageSource)
      if (imageBuffer) {
        uploadedImageUrl = await uploadCardImage(
          supabase,
          imageBuffer,
          set.id,
          card.number
        ) || undefined
        await delay(API_DELAYS.betweenUploads)
      }
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
  logger.section('    POKEMON MCDONALD\'S SEEDING - pokemontcg.io API')
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

  // Filter sets if specific set requested
  let setsToProcess = sets
  if (options.specificSet) {
    setsToProcess = sets.filter(s => s.id === options.specificSet)
    if (setsToProcess.length === 0) {
      logger.error(`Set ${options.specificSet} not found`)
      logger.info('Available sets:')
      sets.forEach(s => logger.info(`  - ${s.id}: ${s.name}`))
      process.exit(1)
    }
  }

  // Sort sets by ID
  setsToProcess.sort((a, b) => a.id.localeCompare(b.id))

  logger.info(`Sets to process: ${setsToProcess.length}`)
  setsToProcess.forEach(s => logger.info(`  - ${s.id}: ${s.name} (${s.total} cards)`))
  console.log('')

  // Process each set
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < setsToProcess.length; i++) {
    const set = setsToProcess[i]

    logger.info(`[${i + 1}/${setsToProcess.length}] Processing ${set.id}...`)

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
