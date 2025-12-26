#!/usr/bin/env tsx
/**
 * Magic: The Gathering seed script
 *
 * Usage:
 *   npx tsx scripts/seed-magic.ts                       # Import all sets
 *   npx tsx scripts/seed-magic.ts --dry-run             # Preview without changes
 *   npx tsx scripts/seed-magic.ts --set VOW             # Import specific set
 *   npx tsx scripts/seed-magic.ts --set VOW --limit 10  # Limit cards per set
 *   npx tsx scripts/seed-magic.ts --lang fr             # Specific language only
 *   npx tsx scripts/seed-magic.ts --continue-on-error   # Continue on errors
 *   npx tsx scripts/seed-magic.ts --skip-images         # Skip image downloads
 *   npx tsx scripts/seed-magic.ts --resume              # Resume from progress file
 *
 * Prerequisites:
 *   1. Run: npx tsx scripts/download-magic-bulk.ts
 *   2. Create bucket 'mtg-cards' in Supabase Storage
 *   3. Add Magic TCG to tcg_games table
 *
 * Memory-efficient: Processes cards in batches per set to avoid OOM errors
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReadStream } from 'fs'
import sharp from 'sharp'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { MAGIC_CONFIG, EXCLUDED_SET_TYPES, type SupportedLanguage } from './config/magic-config'
import {
  parseScryfallCard,
  isValidCard,
  shouldSplitCard,
  getCardImagePath,
} from './lib/magic-parser'
import type {
  ScryfallCard,
  MagicSeedProgress,
  MagicSeedError,
  ParsedMagicCard,
} from '../lib/types/magic'

// Parse CLI arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')
const continueOnError = args.includes('--continue-on-error')
const resumeMode = args.includes('--resume')

const setArg = args.find(a => a.startsWith('--set='))?.split('=')[1]?.toLowerCase()
  || (args.includes('--set') ? args[args.indexOf('--set') + 1]?.toLowerCase() : null)

const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1] as SupportedLanguage | null
  || (args.includes('--lang') ? args[args.indexOf('--lang') + 1] as SupportedLanguage : null)

const limitArg = parseInt(
  args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0',
  10
)

// Determine languages to process
const targetLanguages: SupportedLanguage[] = langArg
  ? [langArg]
  : [...MAGIC_CONFIG.languages]

// Batch size for processing cards per set
const BATCH_SIZE = 100

interface SetMetadata {
  code: string
  name: string
  releaseDate: string | null
  setType: string
  cardCount: number
  seriesId?: string
}

/**
 * Initialize or load progress
 */
function loadProgress(): MagicSeedProgress | null {
  const progressPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.progress)

  if (resumeMode && fs.existsSync(progressPath)) {
    try {
      const content = fs.readFileSync(progressPath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  return null
}

/**
 * Save progress to file
 */
function saveProgress(progress: MagicSeedProgress): void {
  const progressPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.progress)
  const dir = path.dirname(progressPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2))
}

/**
 * Log error to file
 */
function logError(error: MagicSeedError): void {
  const errorsPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.errors)
  const dir = path.dirname(errorsPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let errors: MagicSeedError[] = []
  if (fs.existsSync(errorsPath)) {
    try {
      errors = JSON.parse(fs.readFileSync(errorsPath, 'utf8'))
    } catch {
      errors = []
    }
  }

  errors.push(error)
  fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2))
}

/**
 * Download and optimize an image
 */
async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return await sharp(buffer)
      .resize(MAGIC_CONFIG.imageConfig.width, MAGIC_CONFIG.imageConfig.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: MAGIC_CONFIG.imageConfig.quality })
      .toBuffer()
  } catch {
    return null
  }
}

/**
 * Upload image to Supabase storage
 */
async function uploadImage(
  supabase: ReturnType<typeof createAdminClient>,
  imageBuffer: Buffer,
  filePath: string
): Promise<string | null> {
  try {
    const { error } = await supabase.storage
      .from(MAGIC_CONFIG.bucket)
      .upload(filePath, imageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) {
      return null
    }

    const { data } = supabase.storage
      .from(MAGIC_CONFIG.bucket)
      .getPublicUrl(filePath)

    return data.publicUrl
  } catch {
    return null
  }
}

/**
 * Get TCG ID
 */
async function getTcgId(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', MAGIC_CONFIG.tcgSlug)
    .single()

  if (error || !data) {
    logger.error(`TCG '${MAGIC_CONFIG.tcgSlug}' not found in database`)
    logger.info('Please add Magic to tcg_games table first:')
    logger.info(`  INSERT INTO tcg_games (name, slug, icon, gradient)`)
    logger.info(`  VALUES ('Magic: The Gathering', 'mtg', '🔮', 'from-indigo-500 via-purple-600 to-pink-500');`)
    return null
  }

  return data.id
}

/**
 * Get or create series
 */
async function getOrCreateSeries(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  metadata: SetMetadata
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', metadata.code)
    .single()

  if (existing?.id) {
    return existing.id
  }

  const { data, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: tcgGameId,
      code: metadata.code,
      name: metadata.name,
      release_date: metadata.releaseDate,
      max_set_base: metadata.cardCount,
      master_set: metadata.cardCount,
    })
    .select('id')
    .single()

  if (error) {
    logger.error(`Failed to create series ${metadata.code}: ${error.message}`)
    return null
  }

  return data?.id || null
}

/**
 * Update series card count
 */
async function updateSeriesCardCount(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  cardCount: number
): Promise<void> {
  await supabase
    .from('series')
    .update({
      max_set_base: cardCount,
      master_set: cardCount,
    })
    .eq('id', seriesId)
}

/**
 * Upsert a card
 */
async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: ParsedMagicCard,
  imageUrl: string | null
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', card.number)
    .eq('language', card.language)
    .single()

  const cardData = {
    series_id: seriesId,
    number: card.number,
    language: card.language,
    name: card.name,
    rarity: card.rarity,
    image_url: imageUrl,
    attributes: card.attributes,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('cards')
      .update(cardData)
      .eq('id', existing.id)
    return !error
  } else {
    const { error } = await supabase
      .from('cards')
      .insert(cardData)
    return !error
  }
}

/**
 * Process a single card
 */
async function processCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: ScryfallCard,
  setCode: string
): Promise<{ success: boolean; error?: string }> {
  const parsed = parseScryfallCard(card)
  if (!parsed) {
    return { success: false, error: 'Parse failed' }
  }

  // Download and upload image
  let imageUrl: string | null = null
  if (!skipImages && parsed.imageUrl) {
    const imageBuffer = await downloadAndOptimizeImage(parsed.imageUrl)
    if (imageBuffer) {
      const imagePath = getCardImagePath(setCode, card.lang, card.collector_number)
      imageUrl = await uploadImage(supabase, imageBuffer, imagePath)
    }
    await delay(MAGIC_CONFIG.delays.betweenImageDownloads)
  }

  // Upsert card
  const success = await upsertCard(supabase, seriesId, parsed, imageUrl)

  if (!success) {
    return { success: false, error: 'Database upsert failed' }
  }

  // Handle back face for multi-face cards
  if (shouldSplitCard(card)) {
    const backFace = parseScryfallCard(card, 1)
    if (backFace && backFace.imageUrl) {
      let backImageUrl: string | null = null
      if (!skipImages) {
        const imageBuffer = await downloadAndOptimizeImage(backFace.imageUrl)
        if (imageBuffer) {
          const imagePath = getCardImagePath(setCode, card.lang, backFace.number)
          backImageUrl = await uploadImage(supabase, imageBuffer, imagePath)
        }
      }
      await upsertCard(supabase, seriesId, backFace, backImageUrl)
    }
  }

  return { success: true }
}

/**
 * First pass: collect set metadata only (minimal memory)
 */
async function collectSetMetadata(
  bulkDataPath: string,
  targetLanguages: SupportedLanguage[],
  targetSet: string | null,
  processedSetCodes: string[]
): Promise<Map<string, SetMetadata>> {
  return new Promise((resolve, reject) => {
    const setMetadata = new Map<string, SetMetadata>()
    let cardCount = 0

    const readStream = createReadStream(bulkDataPath)
    const jsonParser = parser()
    const arrayStream = streamArray()

    readStream
      .pipe(jsonParser)
      .pipe(arrayStream)
      .on('data', ({ value }: { value: ScryfallCard }) => {
        cardCount++

        if (cardCount % 500000 === 0) {
          logger.progress(`Pass 1: ${(cardCount / 1000000).toFixed(1)}M cards scanned...`)
        }

        const setCode = value.set?.toLowerCase()
        if (!setCode) return

        // Skip excluded
        if (processedSetCodes.includes(setCode)) return
        if (targetSet && setCode !== targetSet) return
        if (EXCLUDED_SET_TYPES.includes(value.set_type)) return
        if (!targetLanguages.includes(value.lang as SupportedLanguage)) return

        // Only count English cards for set metadata
        if (value.lang === 'en') {
          if (!setMetadata.has(setCode)) {
            setMetadata.set(setCode, {
              code: setCode,
              name: value.set_name,
              releaseDate: value.released_at || null,
              setType: value.set_type,
              cardCount: 0,
            })
          }
          setMetadata.get(setCode)!.cardCount++
        }
      })
      .on('end', () => {
        logger.success(`Pass 1 complete: ${setMetadata.size} sets found`)
        resolve(setMetadata)
      })
      .on('error', reject)
  })
}

/**
 * Second pass: process cards for a specific set
 */
async function processSetCards(
  bulkDataPath: string,
  supabase: ReturnType<typeof createAdminClient>,
  targetSet: string,
  seriesId: string,
  targetLanguages: SupportedLanguage[],
  limit: number,
  progress: MagicSeedProgress
): Promise<{ success: number; errors: number; skipped: number }> {
  return new Promise((resolve, reject) => {
    const result = { success: 0, errors: 0, skipped: 0 }
    let processedCount = 0
    let cardQueue: ScryfallCard[] = []
    let isProcessing = false

    const processQueue = async () => {
      if (isProcessing || cardQueue.length === 0) return
      isProcessing = true

      while (cardQueue.length > 0) {
        const card = cardQueue.shift()!

        if (limit > 0 && processedCount >= limit) {
          result.skipped++
          continue
        }

        if (!isValidCard(card)) {
          result.skipped++
          continue
        }

        try {
          const { success, error } = await processCard(supabase, seriesId, card, targetSet)

          if (success) {
            result.success++
          } else {
            result.errors++
            logError({
              timestamp: new Date().toISOString(),
              type: 'database',
              setCode: targetSet,
              cardNumber: card.collector_number,
              language: card.lang,
              scryfallId: card.id,
              message: error || 'Unknown error',
            })
          }
        } catch (err) {
          result.errors++
          logError({
            timestamp: new Date().toISOString(),
            type: 'database',
            setCode: targetSet,
            cardNumber: card.collector_number,
            language: card.lang,
            scryfallId: card.id,
            message: (err as Error).message,
          })

          if (!continueOnError) {
            reject(err)
            return
          }
        }

        processedCount++

        if (processedCount % 50 === 0) {
          progress.processedCards = processedCount
          saveProgress(progress)
        }
      }

      isProcessing = false
    }

    const readStream = createReadStream(bulkDataPath)
    const jsonParser = parser()
    const arrayStream = streamArray()

    readStream
      .pipe(jsonParser)
      .pipe(arrayStream)
      .on('data', ({ value }: { value: ScryfallCard }) => {
        const setCode = value.set?.toLowerCase()
        if (setCode !== targetSet) return
        if (EXCLUDED_SET_TYPES.includes(value.set_type)) return
        if (!targetLanguages.includes(value.lang as SupportedLanguage)) return

        cardQueue.push(value)

        // Process in batches
        if (cardQueue.length >= BATCH_SIZE) {
          readStream.pause()
          processQueue().then(() => {
            readStream.resume()
          })
        }
      })
      .on('end', async () => {
        // Process remaining cards
        await processQueue()
        resolve(result)
      })
      .on('error', reject)
  })
}

/**
 * Main function
 */
async function main() {
  logger.section('Magic: The Gathering - Seed Script')

  if (dryRun) {
    logger.warn('DRY RUN MODE - No changes will be made')
  }

  if (skipImages) {
    logger.warn('SKIP IMAGES MODE - No images will be downloaded')
  }

  // Check bulk data file
  const bulkDataPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.bulkData)

  if (!fs.existsSync(bulkDataPath)) {
    logger.error(`Bulk data file not found: ${bulkDataPath}`)
    logger.info('Run first: npx tsx scripts/download-magic-bulk.ts')
    process.exit(1)
  }

  const stats = fs.statSync(bulkDataPath)
  logger.info(`Bulk data file: ${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`)

  // Initialize Supabase
  const supabase = createAdminClient()

  // Get TCG ID
  const tcgGameId = await getTcgId(supabase)
  if (!tcgGameId) {
    process.exit(1)
  }

  logger.success(`TCG ID: ${tcgGameId}`)

  // Load progress
  let progress = loadProgress()
  if (!progress) {
    progress = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'in_progress',
      totalSets: 0,
      processedSets: 0,
      totalCards: 0,
      processedCards: 0,
      processedSetCodes: [],
      currentSet: null,
      languages: targetLanguages,
      errors: [],
    }
  }

  if (resumeMode && progress.processedSetCodes.length > 0) {
    logger.info(`Resuming: ${progress.processedSetCodes.length} sets already processed`)
  }

  // Pass 1: Collect set metadata
  logger.separator()
  logger.download('Pass 1: Scanning for sets (memory-efficient)...')

  const setMetadata = await collectSetMetadata(
    bulkDataPath,
    targetLanguages,
    setArg,
    resumeMode ? progress.processedSetCodes : []
  )

  const setCodes = Array.from(setMetadata.keys()).sort()
  progress.totalSets = setCodes.length

  logger.info(`Sets to process: ${setCodes.length}`)
  logger.info(`Languages: ${targetLanguages.join(', ')}`)
  if (limitArg > 0) {
    logger.info(`Card limit per set: ${limitArg}`)
  }

  if (setCodes.length === 0) {
    if (setArg) {
      logger.error(`Set '${setArg}' not found or already processed`)
    } else {
      logger.success('All sets already processed!')
    }
    return
  }

  logger.separator()

  // Process each set
  let totalSuccess = 0
  let totalErrors = 0
  let totalSkipped = 0

  for (let i = 0; i < setCodes.length; i++) {
    const setCode = setCodes[i]
    const metadata = setMetadata.get(setCode)!

    logger.processing(`Processing set ${i + 1}/${setCodes.length}: ${setCode.toUpperCase()} (${metadata.name})`)
    logger.info(`  English cards: ${metadata.cardCount}`)

    progress.currentSet = setCode
    saveProgress(progress)

    if (dryRun) {
      logger.success(`  [DRY RUN] Would process ~${metadata.cardCount * targetLanguages.length} cards`)
      totalSuccess += metadata.cardCount * targetLanguages.length
      continue
    }

    // Create series
    const seriesId = await getOrCreateSeries(supabase, tcgGameId, metadata)
    if (!seriesId) {
      logger.error(`  Failed to create series, skipping`)
      continue
    }

    // Pass 2: Process cards for this set
    try {
      const result = await processSetCards(
        bulkDataPath,
        supabase,
        setCode,
        seriesId,
        targetLanguages,
        limitArg,
        progress
      )

      totalSuccess += result.success
      totalErrors += result.errors
      totalSkipped += result.skipped

      // Update series with actual English card count
      const englishCount = Math.floor(result.success / targetLanguages.length)
      await updateSeriesCardCount(supabase, seriesId, englishCount)

      logger.success(`  Completed: ${result.success} cards (${result.errors} errors, ${result.skipped} skipped)`)

      // Mark as processed
      progress.processedSetCodes.push(setCode)
      progress.processedSets++
      saveProgress(progress)

    } catch (error) {
      logger.error(`  Error: ${(error as Error).message}`)

      logError({
        timestamp: new Date().toISOString(),
        type: 'api',
        setCode,
        message: (error as Error).message,
      })

      if (!continueOnError) {
        throw error
      }
    }

    logger.progress(`Overall: ${i + 1}/${setCodes.length} sets (${((i + 1) / setCodes.length * 100).toFixed(1)}%)`)
    logger.separator()

    // Force garbage collection between sets
    if (global.gc) {
      global.gc()
    }
  }

  // Final progress
  progress.status = 'completed'
  progress.currentSet = null
  saveProgress(progress)

  // Summary
  logger.section('Summary')
  logger.success(`Cards processed: ${totalSuccess.toLocaleString()}`)
  if (totalErrors > 0) {
    logger.error(`Errors: ${totalErrors}`)
    logger.info(`See: ${MAGIC_CONFIG.paths.errors}`)
  }
  if (totalSkipped > 0) {
    logger.warn(`Skipped: ${totalSkipped}`)
  }

  logger.info('')
  logger.success('Seed complete!')
}

// Run
main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
