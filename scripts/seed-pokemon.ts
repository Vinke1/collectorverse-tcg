/**
 * Script de seeding complet pour Pokémon TCG via l'API TCGdex
 *
 * Usage:
 *   npx tsx scripts/seed-pokemon.ts                    # Seed toutes les données (sans images)
 *   npx tsx scripts/seed-pokemon.ts --with-images      # Seed avec téléchargement d'images
 *   npx tsx scripts/seed-pokemon.ts --set=swsh3        # Seed un seul set
 *   npx tsx scripts/seed-pokemon.ts --series=sv        # Seed une seule série
 *   npx tsx scripts/seed-pokemon.ts --lang=fr          # Seed une seule langue
 *   npx tsx scripts/seed-pokemon.ts --resume           # Reprendre depuis le dernier point
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { DELAYS } from '../lib/constants/app-config'
import sharp from 'sharp'

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = 'https://api.tcgdex.net/v2'
const ASSETS_BASE = 'https://assets.tcgdex.net'

// Langues supportées par TCGdex (vérifiées comme disponibles)
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'it', 'pt', 'de'] as const
type Language = typeof SUPPORTED_LANGUAGES[number]

// Délais entre les requêtes (ms)
const API_DELAYS = {
  betweenSets: 1000,       // Entre chaque set
  betweenCards: 100,       // Entre chaque carte
  betweenLanguages: 500,   // Entre chaque langue
  betweenRetries: 2000,    // Entre les retries
  betweenUploads: 200,     // Entre les uploads d'images
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

interface TCGdexSeries {
  id: string
  name: string
  logo?: string
}

interface TCGdexSetBrief {
  id: string
  name: string
  logo?: string
  symbol?: string
  cardCount?: {
    official: number
    total: number
  }
}

interface TCGdexSet {
  id: string
  name: string
  logo?: string
  symbol?: string
  releaseDate?: string
  tcgOnline?: string
  cardCount?: {
    firstEd?: number
    holo?: number
    normal?: number
    official?: number
    reverse?: number
    total?: number
  }
  legal?: {
    standard?: boolean
    expanded?: boolean
  }
  serie?: {
    id: string
    name: string
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
    wPromo?: boolean
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
  updated?: string
}

interface SeedOptions {
  withImages: boolean
  specificSet?: string
  specificSeries?: string
  specificLang?: Language
  resume: boolean
}

interface Progress {
  lastSeriesId?: string
  lastSetId?: string
  lastLanguage?: string
  completedSets: string[]
}

// ============================================
// API HELPERS
// ============================================

async function fetchWithRetry<T>(url: string, retries = 3): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      const isLastRetry = i === retries - 1
      if (isLastRetry) {
        logger.error(`Failed to fetch ${url} after ${retries} retries`)
        return null
      }
      logger.warn(`Retry ${i + 1}/${retries} for ${url}`)
      await delay(API_DELAYS.betweenRetries)
    }
  }
  return null
}

async function fetchSeries(lang: Language): Promise<TCGdexSeries[]> {
  const url = `${API_BASE}/${lang}/series`
  const data = await fetchWithRetry<TCGdexSeries[]>(url)
  return data || []
}

async function fetchSets(lang: Language): Promise<TCGdexSetBrief[]> {
  const url = `${API_BASE}/${lang}/sets`
  const data = await fetchWithRetry<TCGdexSetBrief[]>(url)
  return data || []
}

async function fetchSet(setId: string, lang: Language): Promise<TCGdexSet | null> {
  const url = `${API_BASE}/${lang}/sets/${setId}`
  return fetchWithRetry<TCGdexSet>(url)
}

async function fetchCard(cardId: string, lang: Language): Promise<TCGdexCard | null> {
  const url = `${API_BASE}/${lang}/cards/${cardId}`
  return fetchWithRetry<TCGdexCard>(url)
}

// ============================================
// IMAGE HELPERS
// ============================================

async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${imageUrl}/high.webp`)
    if (!response.ok) {
      // Essayer avec PNG si WebP échoue
      const pngResponse = await fetch(`${imageUrl}/high.png`)
      if (!pngResponse.ok) return null
      const buffer = await pngResponse.arrayBuffer()
      return sharp(Buffer.from(buffer))
        .resize(IMAGE_CONFIG.width, IMAGE_CONFIG.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: IMAGE_CONFIG.quality })
        .toBuffer()
    }

    const buffer = await response.arrayBuffer()
    return sharp(Buffer.from(buffer))
      .resize(IMAGE_CONFIG.width, IMAGE_CONFIG.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: IMAGE_CONFIG.quality })
      .toBuffer()
  } catch (error) {
    logger.error(`Failed to download image: ${imageUrl}`)
    return null
  }
}

async function uploadCardImage(
  supabase: ReturnType<typeof createAdminClient>,
  imageBuffer: Buffer,
  setCode: string,
  cardNumber: string,
  language: string
): Promise<string | null> {
  const bucketName = 'pokemon-cards'
  const filePath = `${setCode}/${language}/${cardNumber}.webp`

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

async function getOrCreatePokemonSeriesId(
  supabase: ReturnType<typeof createAdminClient>,
  seriesCode: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pokemon_series')
    .select('id')
    .eq('code', seriesCode)
    .single()

  if (error || !data) {
    logger.warn(`Pokemon series not found: ${seriesCode}`)
    return null
  }

  return data.id
}

async function upsertSet(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  set: TCGdexSet,
  pokemonSeriesId: string | null
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
    tcgdex_id: set.id,
    pokemon_series_id: pokemonSeriesId,
    release_date: set.releaseDate || null,
    image_url: set.logo || null,
    symbol_url: set.symbol || null,
    official_card_count: set.cardCount?.official || null,
    total_card_count: set.cardCount?.total || null,
    max_set_base: set.cardCount?.official || 0,
    master_set: set.cardCount?.total || null,
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
    return data?.id || null
  }
}

async function upsertSetTranslation(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  language: string,
  name: string,
  logoUrl?: string
): Promise<void> {
  // Check if translation exists
  const { data: existing } = await supabase
    .from('series_translations')
    .select('id')
    .eq('series_id', seriesId)
    .eq('language', language)
    .single()

  const translationData = {
    series_id: seriesId,
    language,
    name,
    logo_url: logoUrl || null,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('series_translations')
      .update(translationData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update translation ${seriesId}/${language}: ${error.message}`)
    }
  } else {
    const { error } = await supabase
      .from('series_translations')
      .insert(translationData)

    if (error) {
      logger.error(`Failed to insert translation ${seriesId}/${language}: ${error.message}`)
    }
  }
}

async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: TCGdexCard,
  language: string,
  imageUrl?: string
): Promise<string | null> {
  // Normaliser la rareté
  const rarityCode = normalizeRarity(card.rarity)

  // Normaliser les types
  const typesCodes = (card.types || []).map(normalizeType)

  // Construire les attributs JSONB
  const attributes = {
    dexId: card.dexId || null,
    stage: card.stage || null,
    evolveFrom: card.evolveFrom || null,
    types: typesCodes,
    retreat: card.retreat ?? null,
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    abilities: card.abilities || [],
    attacks: card.attacks || [],
    description: card.description || null,
    effect: card.effect || null,
    trainerType: card.trainerType || null,
    energyType: card.energyType || null,
    legal: card.legal || null,
    variants: card.variants || null,
    updated: card.updated || null,
  }

  const cardData = {
    series_id: seriesId,
    number: card.localId,
    language,
    name: card.name,
    rarity: rarityCode,
    image_url: imageUrl || (card.image ? `${card.image}/high.webp` : null),
    tcgdex_id: card.id,
    category: normalizeCategory(card.category),
    illustrator: card.illustrator || null,
    hp: card.hp || null,
    regulation_mark: card.regulationMark || null,
    has_holo: card.variants?.holo || false,
    has_reverse: card.variants?.reverse || false,
    has_normal: card.variants?.normal || false,
    has_first_edition: card.variants?.firstEdition || false,
    attributes,
  }

  // Check if card exists
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', card.localId)
    .eq('language', language)
    .single()

  if (existing?.id) {
    const { error } = await supabase
      .from('cards')
      .update(cardData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update card ${card.id}/${language}: ${error.message}`)
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
      logger.error(`Failed to insert card ${card.id}/${language}: ${error.message}`)
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
    // English
    'common': 'common',
    'uncommon': 'uncommon',
    'rare': 'rare',
    'rare holo': 'rare-holo',
    'rare holo ex': 'rare-holo-ex',
    'rare holo gx': 'rare-holo-gx',
    'rare holo v': 'rare-holo-v',
    'holo rare v': 'rare-holo-v',
    'rare holo vmax': 'rare-holo-vmax',
    'rare holo vstar': 'rare-holo-vstar',
    'ultra rare': 'ultra-rare',
    'rare ultra': 'rare-ultra',
    'double rare': 'double-rare',
    'illustration rare': 'illustration-rare',
    'special art rare': 'special-art-rare',
    'art rare': 'art-rare',
    'secret rare': 'secret-rare',
    'hyper rare': 'hyper-rare',
    'shiny rare': 'shiny-rare',
    'shiny ultra rare': 'shiny-ultra-rare',
    'amazing rare': 'amazing-rare',
    'radiant rare': 'radiant-rare',
    'trainer gallery rare': 'trainer-gallery-rare',
    'ace spec rare': 'ace-spec-rare',
    'promo': 'promo',
    'none': 'none',

    // French
    'commune': 'common',
    'peu commune': 'uncommon',
    'magnifique rare': 'rare-holo',
    'ultra rare': 'ultra-rare',

    // Spanish
    'commún': 'common',
    'poco común': 'uncommon',
    'rara': 'rare',
    'rara ultra': 'ultra-rare',
    'holo rara v': 'rare-holo-v',

    // German
    'häufig': 'common',
    'nicht so häufig': 'uncommon',
    'selten': 'rare',

    // Italian
    'comune': 'common',
    'non comune': 'uncommon',
    'rara': 'rare',
  }

  const normalized = rarity.toLowerCase().trim()
  return rarityMap[normalized] || normalized.replace(/\s+/g, '-')
}

function normalizeType(type: string): string {
  const typeMap: Record<string, string> = {
    // English
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

    // French
    'plante': 'grass',
    'feu': 'fire',
    'eau': 'water',
    'électrique': 'lightning',
    'psy': 'psychic',
    'combat': 'fighting',
    'obscurité': 'darkness',
    'métal': 'metal',
    'fée': 'fairy',
    'incolore': 'colorless',

    // Spanish
    'planta': 'grass',
    'fuego': 'fire',
    'agua': 'water',
    'rayo': 'lightning',
    'psíquico': 'psychic',
    'lucha': 'fighting',
    'oscuridad': 'darkness',
    'hada': 'fairy',
    'dragón': 'dragon',
    'incoloro': 'colorless',

    // German
    'pflanze': 'grass',
    'feuer': 'fire',
    'wasser': 'water',
    'elektro': 'lightning',
    'psycho': 'psychic',
    'kampf': 'fighting',
    'finsternis': 'darkness',
    'metall': 'metal',
    'fee': 'fairy',
    'drache': 'dragon',
    'farblos': 'colorless',

    // Italian
    'erba': 'grass',
    'fuoco': 'fire',
    'acqua': 'water',
    'lampo': 'lightning',
    'psico': 'psychic',
    'lotta': 'fighting',
    'oscurità': 'darkness',
    'metallo': 'metal',
    'folletto': 'fairy',
    'drago': 'dragon',

    // Portuguese
    'fogo': 'fire',
    'água': 'water',
    'elétrico': 'lightning',
    'lutador': 'fighting',
    'sombrio': 'darkness',
    'fada': 'fairy',
    'dragão': 'dragon',
    'incolor': 'colorless',
  }

  const normalized = type.toLowerCase().trim()
  return typeMap[normalized] || normalized
}

function normalizeCategory(category?: string): string {
  if (!category) return 'unknown'

  const categoryMap: Record<string, string> = {
    'pokemon': 'pokemon',
    'pokémon': 'pokemon',
    'trainer': 'trainer',
    'dresseur': 'trainer',
    'entrenador': 'trainer',
    'energy': 'energy',
    'énergie': 'energy',
    'energia': 'energy',
    'energie': 'energy',
  }

  const normalized = category.toLowerCase().trim()
  return categoryMap[normalized] || 'unknown'
}

// ============================================
// PROGRESS MANAGEMENT
// ============================================

const PROGRESS_FILE = './scripts/.pokemon-seed-progress.json'

async function loadProgress(): Promise<Progress> {
  try {
    const fs = await import('fs/promises')
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { completedSets: [] }
  }
}

async function saveProgress(progress: Progress): Promise<void> {
  const fs = await import('fs/promises')
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function clearProgress(): Promise<void> {
  const fs = await import('fs/promises')
  try {
    await fs.unlink(PROGRESS_FILE)
  } catch {
    // Ignore if file doesn't exist
  }
}

// ============================================
// MAIN SEEDING FUNCTIONS
// ============================================

async function seedSet(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  setId: string,
  languages: readonly Language[],
  options: SeedOptions
): Promise<boolean> {
  logger.section(`Processing set: ${setId}`)

  // Récupérer le set dans la première langue disponible pour les infos de base
  let baseSet: TCGdexSet | null = null
  let baseLang: Language = 'en'

  for (const lang of languages) {
    baseSet = await fetchSet(setId, lang)
    if (baseSet) {
      baseLang = lang
      break
    }
    await delay(API_DELAYS.betweenLanguages)
  }

  if (!baseSet) {
    logger.error(`Set ${setId} not found in any language`)
    return false
  }

  logger.info(`Set: ${baseSet.name} (${baseSet.cardCount?.total || 0} cards)`)

  // Déterminer la série parente
  const seriesCode = baseSet.serie?.id || setId.replace(/\d+$/, '')
  const pokemonSeriesId = await getOrCreatePokemonSeriesId(supabase, seriesCode)

  // Créer/mettre à jour le set
  const seriesId = await upsertSet(supabase, tcgGameId, baseSet, pokemonSeriesId)
  if (!seriesId) {
    logger.error(`Failed to create series for set ${setId}`)
    return false
  }

  // Pour chaque langue, récupérer les traductions et les cartes
  let totalCards = 0

  for (const lang of languages) {
    if (options.specificLang && options.specificLang !== lang) continue

    logger.processing(`  Language: ${lang.toUpperCase()}`)

    const setInLang = await fetchSet(setId, lang)
    if (!setInLang) {
      logger.warn(`    Set not available in ${lang}`)
      await delay(API_DELAYS.betweenLanguages)
      continue
    }

    // Ajouter la traduction du set
    await upsertSetTranslation(supabase, seriesId, lang, setInLang.name, setInLang.logo)

    // Récupérer les cartes du set
    const cards = setInLang.cards || []
    logger.info(`    Found ${cards.length} cards`)

    for (let i = 0; i < cards.length; i++) {
      const cardBrief = cards[i]

      // Afficher la progression
      if (i % 20 === 0 || i === cards.length - 1) {
        process.stdout.write(`\r    Processing cards: ${i + 1}/${cards.length}`)
      }

      // Récupérer les détails complets de la carte
      const cardDetails = await fetchCard(cardBrief.id, lang)
      if (!cardDetails) {
        await delay(API_DELAYS.betweenCards)
        continue
      }

      // Télécharger l'image si demandé
      let uploadedImageUrl: string | undefined
      if (options.withImages && cardDetails.image) {
        const imageBuffer = await downloadAndOptimizeImage(cardDetails.image)
        if (imageBuffer) {
          uploadedImageUrl = await uploadCardImage(
            supabase,
            imageBuffer,
            setId,
            cardDetails.localId,
            lang
          ) || undefined
          await delay(API_DELAYS.betweenUploads)
        }
      }

      // Insérer la carte
      await upsertCard(supabase, seriesId, cardDetails, lang, uploadedImageUrl)
      totalCards++

      await delay(API_DELAYS.betweenCards)
    }

    console.log('') // Nouvelle ligne après la progression
    await delay(API_DELAYS.betweenLanguages)
  }

  logger.success(`  Completed: ${totalCards} cards processed`)
  return true
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2)
  const options: SeedOptions = {
    withImages: args.includes('--with-images'),
    specificSet: args.find(a => a.startsWith('--set='))?.split('=')[1],
    specificSeries: args.find(a => a.startsWith('--series='))?.split('=')[1],
    specificLang: args.find(a => a.startsWith('--lang='))?.split('=')[1] as Language | undefined,
    resume: args.includes('--resume'),
  }

  console.log('')
  logger.section('═══════════════════════════════════════════════════════════')
  logger.section('         POKEMON TCG SEEDING - TCGdex API')
  logger.section('═══════════════════════════════════════════════════════════')
  console.log('')

  logger.info('Options:')
  logger.info(`  - With images: ${options.withImages}`)
  logger.info(`  - Specific set: ${options.specificSet || 'all'}`)
  logger.info(`  - Specific series: ${options.specificSeries || 'all'}`)
  logger.info(`  - Specific language: ${options.specificLang || 'all (en, fr, es, it, pt, de)'}`)
  logger.info(`  - Resume mode: ${options.resume}`)
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

  // Load progress if resuming
  let progress: Progress = { completedSets: [] }
  if (options.resume) {
    progress = await loadProgress()
    logger.info(`Resuming from: ${progress.completedSets.length} sets already completed`)
  }

  // Get all sets
  logger.processing('Fetching sets list...')
  const sets = await fetchSets('en')
  logger.success(`Found ${sets.length} sets`)

  // Filter sets if needed
  let setsToProcess = sets
  if (options.specificSet) {
    setsToProcess = sets.filter(s => s.id === options.specificSet)
  } else if (options.specificSeries) {
    setsToProcess = sets.filter(s => s.id.startsWith(options.specificSeries!))
  }

  // Remove already completed sets
  if (progress.completedSets.length > 0) {
    setsToProcess = setsToProcess.filter(s => !progress.completedSets.includes(s.id))
  }

  logger.info(`Sets to process: ${setsToProcess.length}`)
  console.log('')

  // Process each set
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < setsToProcess.length; i++) {
    const set = setsToProcess[i]

    logger.info(`[${i + 1}/${setsToProcess.length}] Processing ${set.id}...`)

    const success = await seedSet(
      supabase,
      tcgGameId,
      set.id,
      options.specificLang ? [options.specificLang] : SUPPORTED_LANGUAGES,
      options
    )

    if (success) {
      successCount++
      progress.completedSets.push(set.id)
      await saveProgress(progress)
    } else {
      errorCount++
    }

    // Delay between sets
    if (i < setsToProcess.length - 1) {
      await delay(API_DELAYS.betweenSets)
    }
  }

  // Clear progress on completion
  if (errorCount === 0 && !options.specificSet && !options.specificSeries) {
    await clearProgress()
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
