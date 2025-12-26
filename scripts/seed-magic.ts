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
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { MAGIC_CONFIG, type SupportedLanguage } from './config/magic-config'
import {
  parseScryfallCard,
  groupCardsBySet,
  filterCardsByLanguages,
  filterExcludedSets,
  getSetInfo,
  sortCardsByNumber,
  deduplicateCards,
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

    // Optimize with Sharp
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
 * Get or create TCG ID
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
 * Upsert a series/set
 */
async function upsertSeries(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  setCode: string,
  setName: string,
  releaseDate: string | null,
  cardCount: number
): Promise<string | null> {
  // Check if exists
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', setCode)
    .single()

  const seriesData = {
    tcg_game_id: tcgGameId,
    code: setCode,
    name: setName,
    release_date: releaseDate,
    max_set_base: cardCount,
    master_set: cardCount,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('series')
      .update(seriesData)
      .eq('id', existing.id)

    if (error) {
      logger.error(`Failed to update series ${setCode}: ${error.message}`)
      return null
    }

    return existing.id
  } else {
    const { data, error } = await supabase
      .from('series')
      .insert(seriesData)
      .select('id')
      .single()

    if (error) {
      logger.error(`Failed to insert series ${setCode}: ${error.message}`)
      return null
    }

    return data?.id || null
  }
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
  // Check if exists
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

    if (error) {
      return false
    }
  } else {
    const { error } = await supabase
      .from('cards')
      .insert(cardData)

    if (error) {
      return false
    }
  }

  return true
}

/**
 * Process a single set
 */
async function processSet(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  setCode: string,
  cards: ScryfallCard[],
  progress: MagicSeedProgress
): Promise<{ success: number; errors: number; skipped: number }> {
  const result = { success: 0, errors: 0, skipped: 0 }

  // Get set info
  const setInfo = getSetInfo(setCode, cards)
  logger.processing(`Processing set: ${setCode.toUpperCase()} (${setInfo.name})`)
  logger.info(`  Cards: ${cards.length} | Languages: ${targetLanguages.join(', ')}`)

  // Upsert series
  if (!dryRun) {
    const englishCards = cards.filter(c => c.lang === 'en')
    const seriesId = await upsertSeries(
      supabase,
      tcgGameId,
      setCode,
      setInfo.name,
      setInfo.releaseDate,
      englishCards.length
    )

    if (!seriesId) {
      logger.error(`Failed to create series ${setCode}`)
      return result
    }

    // Filter cards by target languages
    const filteredCards = filterCardsByLanguages(cards, targetLanguages)
    const sortedCards = sortCardsByNumber(filteredCards)

    // Apply limit if specified
    const cardsToProcess = limitArg > 0
      ? sortedCards.slice(0, limitArg)
      : sortedCards

    // Process each card
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i]

      // Validate card
      if (!isValidCard(card)) {
        result.skipped++
        continue
      }

      // Parse card
      const parsed = parseScryfallCard(card)
      if (!parsed) {
        result.skipped++
        continue
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

      if (success) {
        result.success++
      } else {
        result.errors++
        logError({
          timestamp: new Date().toISOString(),
          type: 'database',
          setCode,
          cardNumber: card.collector_number,
          language: card.lang,
          scryfallId: card.id,
          message: 'Failed to upsert card',
        })
      }

      // Progress update every 50 cards
      if ((i + 1) % 50 === 0) {
        logger.progress(`  [${card.lang.toUpperCase()}] ${i + 1}/${cardsToProcess.length} cards`)
        progress.processedCards += 50
        saveProgress(progress)
      }
    }

    // Handle multi-face cards (store back faces)
    for (const card of cardsToProcess) {
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
    }
  } else {
    // Dry run - just log stats
    for (const lang of targetLanguages) {
      const langCards = cards.filter(c => c.lang === lang)
      logger.info(`  [${lang.toUpperCase()}] ${langCards.length} cards`)
      result.success += langCards.length
    }
  }

  // Mark set as processed
  progress.processedSetCodes.push(setCode)
  progress.processedSets++
  saveProgress(progress)

  logger.success(`Set ${setCode.toUpperCase()} completed`)
  return result
}

/**
 * Main function
 */
async function main() {
  logger.section('Magic: The Gathering - Seed Script')

  if (dryRun) {
    logger.warn('DRY RUN MODE - No changes will be made')
  }

  // Load bulk data
  const bulkDataPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.bulkData)

  if (!fs.existsSync(bulkDataPath)) {
    logger.error(`Bulk data file not found: ${bulkDataPath}`)
    logger.info('Run first: npx tsx scripts/download-magic-bulk.ts')
    process.exit(1)
  }

  logger.download(`Loading bulk data from ${MAGIC_CONFIG.paths.bulkData}...`)
  const rawData = fs.readFileSync(bulkDataPath, 'utf8')
  const allCards: ScryfallCard[] = JSON.parse(rawData)
  logger.success(`Loaded ${allCards.length.toLocaleString()} cards`)

  // Filter excluded set types
  const filteredCards = filterExcludedSets(allCards)
  logger.info(`After filtering: ${filteredCards.length.toLocaleString()} cards`)

  // Deduplicate
  const uniqueCards = deduplicateCards(filteredCards)
  logger.info(`Unique cards: ${uniqueCards.length.toLocaleString()}`)

  // Group by set
  const cardsBySet = groupCardsBySet(uniqueCards)
  const setCodes = Object.keys(cardsBySet).sort()
  logger.info(`Sets: ${setCodes.length}`)

  // Initialize Supabase client
  const supabase = createAdminClient()

  // Get TCG ID
  const tcgGameId = await getTcgId(supabase)
  if (!tcgGameId) {
    process.exit(1)
  }

  // Initialize or load progress
  let progress = loadProgress()
  if (!progress) {
    progress = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'in_progress',
      totalSets: setCodes.length,
      processedSets: 0,
      totalCards: uniqueCards.length,
      processedCards: 0,
      processedSetCodes: [],
      currentSet: null,
      languages: targetLanguages,
      errors: [],
    }
  }

  // Filter sets if --set argument provided
  const setsToProcess = setArg
    ? setCodes.filter(code => code === setArg)
    : setCodes

  if (setArg && setsToProcess.length === 0) {
    logger.error(`Set '${setArg}' not found`)
    logger.info('Available sets (first 20):')
    setCodes.slice(0, 20).forEach(code => logger.info(`  - ${code}`))
    process.exit(1)
  }

  // Skip already processed sets in resume mode
  const pendingSets = resumeMode
    ? setsToProcess.filter(code => !progress!.processedSetCodes.includes(code))
    : setsToProcess

  logger.separator()
  logger.info(`Sets to process: ${pendingSets.length}`)
  logger.info(`Languages: ${targetLanguages.join(', ')}`)
  if (limitArg > 0) {
    logger.info(`Card limit per set: ${limitArg}`)
  }
  logger.separator()

  // Process each set
  let totalSuccess = 0
  let totalErrors = 0
  let totalSkipped = 0

  for (let i = 0; i < pendingSets.length; i++) {
    const setCode = pendingSets[i]
    const setCards = cardsBySet[setCode]

    progress.currentSet = setCode
    saveProgress(progress)

    try {
      const result = await processSet(supabase, tcgGameId, setCode, setCards, progress)
      totalSuccess += result.success
      totalErrors += result.errors
      totalSkipped += result.skipped

      logger.progress(`Progress: ${i + 1}/${pendingSets.length} sets (${((i + 1) / pendingSets.length * 100).toFixed(1)}%)`)
    } catch (error) {
      logger.error(`Error processing set ${setCode}: ${(error as Error).message}`)

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

    logger.separator()
  }

  // Update final progress
  progress.status = 'completed'
  progress.currentSet = null
  saveProgress(progress)

  // Summary
  logger.section('Summary')
  logger.success(`Cards processed: ${totalSuccess.toLocaleString()}`)
  if (totalErrors > 0) {
    logger.error(`Errors: ${totalErrors}`)
  }
  if (totalSkipped > 0) {
    logger.warn(`Skipped: ${totalSkipped}`)
  }

  if (totalErrors > 0) {
    logger.info(`See errors: ${MAGIC_CONFIG.paths.errors}`)
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
