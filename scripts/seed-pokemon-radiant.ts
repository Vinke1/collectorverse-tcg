/**
 * Script de seeding pour Pokémon TCG - Radiant Collection
 *
 * La Radiant Collection fait partie de la série BW (Black & White era)
 * 25 cartes réimprimées avec artwork holographique spécial
 * Numérotées RC1-RC25
 *
 * Usage:
 *   npx tsx scripts/seed-pokemon-radiant.ts           # Seed complet avec images
 *   npx tsx scripts/seed-pokemon-radiant.ts --dry-run # Preview sans API calls
 *   npx tsx scripts/seed-pokemon-radiant.ts --limit=5 # Limiter à 5 cartes
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = 'https://api.tcgdex.net/v2'
const ASSETS_BASE = 'https://assets.tcgdex.net'

// Set code for Radiant Collection
const SET_CODE = 'rc'
const SET_NAME = 'Radiant Collection'
const EXPECTED_CARDS = 25

// Délais pour éviter de surcharger l'API
const API_DELAYS = {
  betweenCards: 150,      // 150ms entre chaque carte
  betweenRetries: 2000,   // 2s entre les retries
  betweenUploads: 200,    // 200ms entre les uploads
}

// Configuration des images
const IMAGE_CONFIG = {
  quality: 85,
  width: 480,
  height: 672,
  format: 'webp' as const,
}

// ============================================
// TYPES
// ============================================

interface TCGdexSet {
  id: string
  name: string
  logo?: string
  symbol?: string
  releaseDate?: string
  cardCount?: {
    official: number
    total: number
  }
  cards?: TCGdexCardBrief[]
}

interface TCGdexCardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

interface TCGdexCard {
  id: string
  localId: string
  name: string
  category?: string
  rarity?: string
  illustrator?: string
  image?: string
  hp?: number
  types?: string[]
  stage?: string
  evolveFrom?: string
  dexId?: number[]
  attacks?: Array<{
    cost?: string[]
    name: string
    effect?: string
    damage?: number | string
  }>
  abilities?: Array<{
    type: string
    name: string
    effect: string
  }>
  weaknesses?: Array<{
    type: string
    value: string
  }>
  resistances?: Array<{
    type: string
    value: string
  }>
  retreat?: number
  regulationMark?: string
  description?: string
  effect?: string
  trainerType?: string
  energyType?: string
  variants?: {
    firstEdition?: boolean
    holo?: boolean
    normal?: boolean
    reverse?: boolean
  }
  legal?: {
    standard?: boolean
    expanded?: boolean
  }
  set?: {
    id: string
    name: string
    logo?: string
    symbol?: string
    cardCount?: {
      official: number
      total: number
    }
  }
}

interface SeedOptions {
  dryRun: boolean
  limit?: number
}

// ============================================
// API HELPERS
// ============================================

async function fetchWithRetry<T>(url: string, retries = 3): Promise<T | null> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add API key if available
  if (API_KEY) {
    headers['X-Api-Key'] = API_KEY
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers })

      if (response.status === 404) {
        logger.warn(`Not found: ${url}`)
        return null
      }

      if (response.status === 429) {
        // Rate limited
        const waitTime = (i + 1) * API_DELAYS.betweenRetries
        logger.warn(`Rate limited, waiting ${waitTime}ms...`)
        await delay(waitTime)
        continue
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      const isLastRetry = i === retries - 1
      if (isLastRetry) {
        logger.error(`Failed to fetch ${url} after ${retries} retries: ${error}`)
        return null
      }
      logger.warn(`Retry ${i + 1}/${retries} for ${url}`)
      await delay(API_DELAYS.betweenRetries * (i + 1)) // Exponential backoff
    }
  }
  return null
}

async function fetchRadiantCollectionCards(): Promise<PokemonTCGCard[]> {
  // Try multiple queries to find the cards
  const queries = [
    `set.id:${SET_CODE}`,
    `set.name:"${SET_NAME}"`,
    'name:legendary', // Fallback: part of Legendary Treasures
  ]

  for (const query of queries) {
    const url = `${POKEMONTCG_API_BASE}/cards?q=${encodeURIComponent(query)}&pageSize=250`
    logger.info(`Trying query: ${query}`)

    const response = await fetchWithRetry<PokemonTCGResponse>(url)

    if (response && response.data && response.data.length > 0) {
      // Filter cards that match Radiant Collection pattern (RC1-RC25)
      const radiantCards = response.data.filter(card =>
        card.set.id === SET_CODE ||
        card.set.name === SET_NAME ||
        (card.number && /^RC\d+$/i.test(card.number))
      )

      if (radiantCards.length > 0) {
        logger.success(`Found ${radiantCards.length} Radiant Collection cards`)
        return radiantCards
      }
    }

    await delay(API_DELAYS.betweenRetries)
  }

  logger.error('Could not find Radiant Collection cards')
  return []
}

// ============================================
// IMAGE HELPERS
// ============================================

async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    logger.download(`Downloading: ${imageUrl}`)
    const response = await fetch(imageUrl)

    if (!response.ok) {
      logger.error(`Failed to download image: ${response.status} ${response.statusText}`)
      return null
    }

    const buffer = await response.arrayBuffer()

    // Optimize with Sharp
    return sharp(Buffer.from(buffer))
      .resize(IMAGE_CONFIG.width, IMAGE_CONFIG.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: IMAGE_CONFIG.quality })
      .toBuffer()
  } catch (error) {
    logger.error(`Failed to process image: ${imageUrl} - ${error}`)
    return null
  }
}

async function uploadCardImage(
  supabase: ReturnType<typeof createAdminClient>,
  imageBuffer: Buffer,
  cardNumber: string
): Promise<string | null> {
  const bucketName = 'pokemon-cards'
  const filePath = `${SET_CODE}/en/${cardNumber}.webp`

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, imageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) {
      logger.error(`Upload error for ${filePath}: ${error.message}`)
      return null
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    logger.upload(`Uploaded: ${filePath}`)
    return data.publicUrl
  } catch (error) {
    logger.error(`Failed to upload image: ${filePath} - ${error}`)
    return null
  }
}

// ============================================
// DATABASE HELPERS
// ============================================

async function getOrCreateRadiantCollectionSeries(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  setData: PokemonTCGCard['set']
): Promise<string | null> {
  // Check if series already exists
  const { data: existing, error: selectError } = await supabase
    .from('series')
    .select('id, name, code')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', SET_CODE)
    .single()

  if (existing?.id) {
    logger.info(`Series already exists: ${existing.name} (${existing.code})`)
    return existing.id
  }

  // Get or create pokemon_series for XY era
  let pokemonSeriesId: string | null = null
  const { data: xySeries } = await supabase
    .from('pokemon_series')
    .select('id')
    .eq('code', 'xy')
    .single()

  if (xySeries?.id) {
    pokemonSeriesId = xySeries.id
  }

  // Create new series
  const seriesData = {
    tcg_game_id: tcgGameId,
    code: SET_CODE,
    name: SET_NAME,
    tcgdex_id: SET_CODE,
    pokemon_series_id: pokemonSeriesId,
    release_date: setData.releaseDate || null,
    image_url: setData.images?.logo || null,
    symbol_url: setData.images?.symbol || null,
    official_card_count: setData.printedTotal || EXPECTED_CARDS,
    total_card_count: setData.total || EXPECTED_CARDS,
    max_set_base: setData.printedTotal || EXPECTED_CARDS,
    master_set: setData.total || null,
  }

  const { data, error } = await supabase
    .from('series')
    .insert(seriesData)
    .select('id')
    .single()

  if (error) {
    logger.error(`Failed to create series: ${error.message}`)
    return null
  }

  logger.success(`Created series: ${SET_NAME} (${SET_CODE})`)
  return data?.id || null
}

async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: PokemonTCGCard,
  imageUrl?: string
): Promise<string | null> {
  // Normaliser le numéro de carte (RC1 -> RC1, pas juste 1)
  const cardNumber = card.number.toUpperCase()

  // Normaliser la rareté
  const rarityCode = normalizeRarity(card.rarity)

  // Normaliser les types
  const typesCodes = (card.types || []).map(normalizeType)

  // Construire les attributs JSONB
  const attributes = {
    supertype: card.supertype || null,
    subtypes: card.subtypes || [],
    level: card.level || null,
    types: typesCodes,
    evolvesFrom: card.evolvesFrom || null,
    evolvesTo: card.evolvesTo || [],
    rules: card.rules || [],
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    retreatCost: card.retreatCost || [],
    convertedRetreatCost: card.convertedRetreatCost || null,
    abilities: card.abilities || [],
    attacks: card.attacks || [],
    nationalPokedexNumbers: card.nationalPokedexNumbers || [],
    flavorText: card.flavorText || null,
    legalities: card.legalities || null,
  }

  const cardData = {
    series_id: seriesId,
    number: cardNumber,
    language: 'en',
    name: card.name,
    rarity: rarityCode,
    image_url: imageUrl || card.images?.large || null,
    tcgdex_id: card.id, // Store pokemontcg.io ID
    category: normalizeCategory(card.supertype),
    illustrator: card.artist || null,
    hp: card.hp ? parseInt(card.hp, 10) : null,
    regulation_mark: card.regulationMark || null,
    has_holo: true, // Radiant Collection cards are all holo
    has_reverse: false,
    has_normal: false,
    has_first_edition: false,
    attributes,
  }

  // Check if card exists
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', cardNumber)
    .eq('language', 'en')
    .single()

  if (existing?.id) {
    const { error } = await supabase
      .from('cards')
      .update(cardData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update card ${cardNumber}: ${error.message}`)
      return null
    }
    logger.info(`Updated card: ${cardNumber} - ${card.name}`)
    return existing.id
  } else {
    const { data, error } = await supabase
      .from('cards')
      .insert(cardData)
      .select('id')
      .single()

    if (error) {
      logger.error(`Failed to insert card ${cardNumber}: ${error.message}`)
      return null
    }
    logger.success(`Inserted card: ${cardNumber} - ${card.name}`)
    return data?.id || null
  }
}

// ============================================
// NORMALIZERS
// ============================================

function normalizeRarity(rarity: string): string {
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
    'secret rare': 'secret-rare',
    'hyper rare': 'hyper-rare',
    'shiny rare': 'shiny-rare',
    'amazing rare': 'amazing-rare',
    'radiant rare': 'radiant-rare',
    'illustration rare': 'illustration-rare',
    'special art rare': 'special-art-rare',
    'double rare': 'double-rare',
    'trainer gallery rare': 'trainer-gallery-rare',
    'ace spec rare': 'ace-spec-rare',
    'promo': 'promo',
  }

  const normalized = rarity.toLowerCase().trim()
  return rarityMap[normalized] || normalized.replace(/\s+/g, '-')
}

function normalizeType(type: string): string {
  const typeMap: Record<string, string> = {
    'grass': 'grass',
    'fire': 'fire',
    'water': 'water',
    'lightning': 'lightning',
    'psychic': 'psychic',
    'fighting': 'fighting',
    'darkness': 'darkness',
    'metal': 'metal',
    'fairy': 'fairy',
    'dragon': 'dragon',
    'colorless': 'colorless',
  }

  const normalized = type.toLowerCase().trim()
  return typeMap[normalized] || normalized
}

function normalizeCategory(supertype: string): string {
  const categoryMap: Record<string, string> = {
    'pokémon': 'pokemon',
    'pokemon': 'pokemon',
    'trainer': 'trainer',
    'energy': 'energy',
  }

  const normalized = supertype.toLowerCase().trim()
  return categoryMap[normalized] || 'unknown'
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2)
  const options: SeedOptions = {
    dryRun: args.includes('--dry-run'),
    limit: args.find(a => a.startsWith('--limit='))
      ? parseInt(args.find(a => a.startsWith('--limit='))!.split('=')[1], 10)
      : undefined,
  }

  console.log('')
  logger.section('═══════════════════════════════════════════════════════════')
  logger.section('    POKEMON TCG - RADIANT COLLECTION SEEDING')
  logger.section('═══════════════════════════════════════════════════════════')
  console.log('')

  logger.info('Options:')
  logger.info(`  - Dry run: ${options.dryRun}`)
  logger.info(`  - Card limit: ${options.limit || 'none (all cards)'}`)
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

  // Fetch cards from pokemontcg.io API
  logger.processing('Fetching Radiant Collection cards from pokemontcg.io API...')
  const cards = await fetchRadiantCollectionCards()

  if (cards.length === 0) {
    logger.error('No cards found. Aborting.')
    process.exit(1)
  }

  logger.success(`Found ${cards.length} cards`)

  // Sort cards by number
  cards.sort((a, b) => {
    const aNum = parseInt(a.number.replace(/\D/g, ''), 10)
    const bNum = parseInt(b.number.replace(/\D/g, ''), 10)
    return aNum - bNum
  })

  // Apply limit if specified
  const cardsToProcess = options.limit ? cards.slice(0, options.limit) : cards

  logger.info(`Cards to process: ${cardsToProcess.length}`)
  console.log('')

  if (options.dryRun) {
    logger.info('DRY RUN - Preview:')
    cardsToProcess.forEach((card, i) => {
      logger.info(`  ${i + 1}. ${card.number} - ${card.name} (${card.rarity})`)
    })
    console.log('')
    logger.warn('Dry run complete. No changes made.')
    return
  }

  // Create or get series
  logger.processing('Creating/verifying Radiant Collection series...')
  const seriesId = await getOrCreateRadiantCollectionSeries(
    supabase,
    tcgGameId,
    cards[0].set
  )

  if (!seriesId) {
    logger.error('Failed to create/get series. Aborting.')
    process.exit(1)
  }

  // Process cards
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (let i = 0; i < cardsToProcess.length; i++) {
    const card = cardsToProcess[i]
    logger.section(`[${i + 1}/${cardsToProcess.length}] Processing ${card.number} - ${card.name}`)

    try {
      // Download and optimize image
      let uploadedImageUrl: string | undefined

      if (card.images?.large) {
        const imageBuffer = await downloadAndOptimizeImage(card.images.large)

        if (imageBuffer) {
          uploadedImageUrl = await uploadCardImage(supabase, imageBuffer, card.number) || undefined
          await delay(API_DELAYS.betweenUploads)
        } else {
          logger.warn(`Could not download image for ${card.number}`)
        }
      }

      // Insert/update card in database
      const cardId = await upsertCard(supabase, seriesId, card, uploadedImageUrl)

      if (cardId) {
        successCount++
      } else {
        errorCount++
      }

      await delay(API_DELAYS.betweenCards)
    } catch (error) {
      logger.error(`Error processing card ${card.number}: ${error}`)
      errorCount++
    }
  }

  // Summary
  console.log('')
  logger.section('═══════════════════════════════════════════════════════════')
  logger.section('                   SEEDING COMPLETE')
  logger.section('═══════════════════════════════════════════════════════════')
  console.log('')
  logger.success(`Cards processed successfully: ${successCount}`)
  if (errorCount > 0) {
    logger.error(`Cards with errors: ${errorCount}`)
  }
  if (skippedCount > 0) {
    logger.warn(`Cards skipped: ${skippedCount}`)
  }
  console.log('')
}

main().catch(error => {
  logger.error(`Fatal error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
