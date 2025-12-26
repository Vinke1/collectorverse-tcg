#!/usr/bin/env tsx
/**
 * Magic: The Gathering - Seed from Split Files
 *
 * Seeds Magic cards from pre-split set/language files (much faster than bulk).
 * Requires running split-magic-bulk.ts first to generate the files.
 *
 * Usage:
 *   npx tsx scripts/seed-magic-from-split.ts                           # Import all sets, all languages
 *   npx tsx scripts/seed-magic-from-split.ts --dry-run                 # Preview without changes
 *   npx tsx scripts/seed-magic-from-split.ts --set vow                 # Import specific set (all langs)
 *   npx tsx scripts/seed-magic-from-split.ts --set vow --lang en       # Import specific set + language
 *   npx tsx scripts/seed-magic-from-split.ts --lang en                 # Import all sets, English only
 *   npx tsx scripts/seed-magic-from-split.ts --skip-images             # Skip image downloads
 *   npx tsx scripts/seed-magic-from-split.ts --continue-on-error       # Continue on errors
 *   npx tsx scripts/seed-magic-from-split.ts --resume                  # Resume from progress
 *   npx tsx scripts/seed-magic-from-split.ts --list                    # List available sets
 *   npx tsx scripts/seed-magic-from-split.ts --limit 50                # Limit cards per file
 *
 * Prerequisites:
 *   1. Run: npx tsx scripts/download-magic-bulk.ts
 *   2. Run: npx tsx scripts/split-magic-bulk.ts
 *   3. Create bucket 'mtg-cards' in Supabase Storage
 *   4. Add Magic TCG to tcg_games table
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { MAGIC_CONFIG } from './config/magic-config'
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
const listMode = args.includes('--list')

const setArg = args.find(a => a.startsWith('--set='))?.split('=')[1]?.toLowerCase()
  || (args.includes('--set') ? args[args.indexOf('--set') + 1]?.toLowerCase() : null)

const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
  || (args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null)
const targetLanguages: string[] | null = langArg ? langArg.split(',') : null

const limitArg = parseInt(
  args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0',
  10
)

// Paths
const SPLIT_DIR = path.resolve(process.cwd(), 'scripts/data/magic-sets')
const INDEX_FILE = path.join(SPLIT_DIR, 'index.json')
const PROGRESS_FILE = path.resolve(process.cwd(), 'scripts/logs/magic-seed-split-progress.json')
const ERRORS_FILE = path.resolve(process.cwd(), 'scripts/logs/magic-seed-split-errors.json')

interface SetLanguageFileData {
  setCode: string
  setName: string
  releaseDate: string | null
  setType: string
  language: string
  cardCount: number
  cards: ScryfallCard[]
}

interface IndexData {
  generatedAt: string
  sourceFile: string
  targetLanguages: string[]
  totalSets: number
  totalFiles: number
  totalCards: number
  sets: Record<string, {
    name: string
    releaseDate: string | null
    setType: string
    languages: Record<string, { cardCount: number; filePath: string }>
    totalCards: number
  }>
}

interface SplitProgress {
  startedAt: string
  lastUpdated: string
  status: 'in_progress' | 'completed' | 'failed'
  processedFiles: string[]  // "setCode/lang" format
  currentFile: string | null
  totalSuccess: number
  totalErrors: number
  totalSkipped: number
}

/**
 * Load or initialize progress
 */
function loadProgress(): SplitProgress | null {
  if (resumeMode && fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}

/**
 * Save progress to file
 */
function saveProgress(progress: SplitProgress): void {
  const dir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

/**
 * Log error to file
 */
function logError(error: MagicSeedError): void {
  const dir = path.dirname(ERRORS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let errors: MagicSeedError[] = []
  if (fs.existsSync(ERRORS_FILE)) {
    try {
      errors = JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf8'))
    } catch {
      errors = []
    }
  }

  errors.push(error)
  fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2))
}

/**
 * Download and optimize an image
 */
async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

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

    if (error) return null

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
  setCode: string,
  setName: string,
  releaseDate: string | null,
  cardCount: number
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', setCode)
    .single()

  if (existing?.id) {
    return existing.id
  }

  const { data, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: tcgGameId,
      code: setCode,
      name: setName,
      release_date: releaseDate,
      max_set_base: cardCount,
      master_set: cardCount,
    })
    .select('id')
    .single()

  if (error) {
    logger.error(`Failed to create series ${setCode}: ${error.message}`)
    return null
  }

  return data?.id || null
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
 * Process a single set/language file
 */
async function processSetLanguageFile(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  filePath: string,
  limit: number
): Promise<{ success: number; errors: number; skipped: number }> {
  const result = { success: 0, errors: 0, skipped: 0 }

  // Read file
  const content = fs.readFileSync(filePath, 'utf8')
  const fileData: SetLanguageFileData = JSON.parse(content)

  logger.info(`    Cards: ${fileData.cardCount}, Language: ${fileData.language}`)

  // Get or create series (use English card count if available)
  const seriesId = await getOrCreateSeries(
    supabase,
    tcgGameId,
    fileData.setCode,
    fileData.setName,
    fileData.releaseDate,
    fileData.cardCount
  )

  if (!seriesId) {
    logger.error(`    Failed to create series, skipping`)
    return result
  }

  // Process cards
  let processedCount = 0

  for (const card of fileData.cards) {
    if (limit > 0 && processedCount >= limit) {
      result.skipped++
      continue
    }

    if (!isValidCard(card)) {
      result.skipped++
      continue
    }

    try {
      const { success, error } = await processCard(supabase, seriesId, card, fileData.setCode)

      if (success) {
        result.success++
      } else {
        result.errors++
        logError({
          timestamp: new Date().toISOString(),
          type: 'database',
          setCode: fileData.setCode,
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
        setCode: fileData.setCode,
        cardNumber: card.collector_number,
        language: card.lang,
        scryfallId: card.id,
        message: (err as Error).message,
      })

      if (!continueOnError) {
        throw err
      }
    }

    processedCount++

    // Progress logging
    if (processedCount % 100 === 0) {
      logger.progress(`      ${processedCount}/${fileData.cards.length} cards...`)
    }
  }

  return result
}

/**
 * List available sets
 */
function listSets(): void {
  logger.section('Available Magic Sets')

  if (!fs.existsSync(INDEX_FILE)) {
    logger.error('Index file not found. Run split-magic-bulk.ts first.')
    process.exit(1)
  }

  const index: IndexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))

  logger.info(`Generated: ${index.generatedAt}`)
  logger.info(`Languages: ${index.targetLanguages.join(', ')}`)
  logger.info(`Total sets: ${index.totalSets}`)
  logger.info(`Total files: ${index.totalFiles}`)
  logger.info(`Total cards: ${index.totalCards.toLocaleString()}`)
  logger.separator()

  // Group by set type
  const byType: Record<string, Array<[string, typeof index.sets[string]]>> = {}
  for (const [code, set] of Object.entries(index.sets)) {
    if (!byType[set.setType]) {
      byType[set.setType] = []
    }
    byType[set.setType].push([code, set])
  }

  for (const [type, sets] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
    logger.info(`\n${type.toUpperCase()} (${sets.length} sets):`)
    for (const [code, set] of sets.sort((a, b) => a[0].localeCompare(b[0]))) {
      const langs = Object.entries(set.languages)
        .map(([l, d]) => `${l}:${d.cardCount}`)
        .join(', ')
      logger.info(`  ${code.padEnd(8)} ${set.totalCards.toString().padStart(5)} cards [${langs}] - ${set.name}`)
    }
  }
}

/**
 * Main function
 */
async function main() {
  if (listMode) {
    listSets()
    return
  }

  logger.section('Magic: The Gathering - Seed from Split Files')

  if (dryRun) {
    logger.warn('DRY RUN MODE - No changes will be made')
  }

  if (skipImages) {
    logger.warn('SKIP IMAGES MODE - No images will be downloaded')
  }

  // Check split files exist
  if (!fs.existsSync(INDEX_FILE)) {
    logger.error('Split files not found.')
    logger.info('Run first: npx tsx scripts/split-magic-bulk.ts')
    process.exit(1)
  }

  const index: IndexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  logger.info(`Found ${index.totalSets} sets, ${index.totalFiles} files (${index.totalCards.toLocaleString()} cards)`)
  logger.info(`Available languages: ${index.targetLanguages.join(', ')}`)

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
      processedFiles: [],
      currentFile: null,
      totalSuccess: 0,
      totalErrors: 0,
      totalSkipped: 0,
    }
  }

  // Build list of files to process
  interface FileToProcess {
    setCode: string
    lang: string
    filePath: string
    setName: string
    cardCount: number
  }

  const filesToProcess: FileToProcess[] = []

  for (const [setCode, setData] of Object.entries(index.sets)) {
    // Filter by set if specified
    if (setArg && setCode !== setArg) continue

    for (const [lang, langData] of Object.entries(setData.languages)) {
      // Filter by language if specified
      if (targetLanguages && !targetLanguages.includes(lang)) continue

      const fileKey = `${setCode}/${lang}`

      // Skip if already processed (resume mode)
      if (resumeMode && progress.processedFiles.includes(fileKey)) continue

      filesToProcess.push({
        setCode,
        lang,
        filePath: path.join(SPLIT_DIR, langData.filePath),
        setName: setData.name,
        cardCount: langData.cardCount,
      })
    }
  }

  if (filesToProcess.length === 0) {
    if (setArg) {
      logger.error(`Set '${setArg}' not found or already processed`)
    } else {
      logger.success('All files already processed!')
    }
    return
  }

  logger.info(`Files to process: ${filesToProcess.length}`)
  if (targetLanguages) {
    logger.info(`Filtering languages: ${targetLanguages.join(', ')}`)
  }
  if (limitArg > 0) {
    logger.info(`Card limit per file: ${limitArg}`)
  }

  if (resumeMode && progress.processedFiles.length > 0) {
    logger.info(`Resuming: ${progress.processedFiles.length} files already processed`)
  }

  logger.separator()

  // Process each file
  let totalSuccess = 0
  let totalErrors = 0
  let totalSkipped = 0

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i]
    const fileKey = `${file.setCode}/${file.lang}`

    logger.processing(`Processing ${i + 1}/${filesToProcess.length}: ${file.setCode.toUpperCase()} [${file.lang}] (${file.setName})`)

    progress.currentFile = fileKey
    saveProgress(progress)

    if (!fs.existsSync(file.filePath)) {
      logger.error(`  File not found: ${file.filePath}`)
      continue
    }

    if (dryRun) {
      logger.success(`  [DRY RUN] Would process ${file.cardCount} cards`)
      totalSuccess += file.cardCount
      continue
    }

    try {
      const result = await processSetLanguageFile(
        supabase,
        tcgGameId,
        file.filePath,
        limitArg
      )

      totalSuccess += result.success
      totalErrors += result.errors
      totalSkipped += result.skipped

      logger.success(`    Done: ${result.success} cards (${result.errors} errors, ${result.skipped} skipped)`)

      // Mark as processed
      progress.processedFiles.push(fileKey)
      progress.totalSuccess += result.success
      progress.totalErrors += result.errors
      progress.totalSkipped += result.skipped
      saveProgress(progress)

    } catch (error) {
      logger.error(`  Error: ${(error as Error).message}`)

      logError({
        timestamp: new Date().toISOString(),
        type: 'api',
        setCode: file.setCode,
        language: file.lang,
        message: (error as Error).message,
      })

      if (!continueOnError) {
        throw error
      }
    }

    logger.progress(`Overall: ${i + 1}/${filesToProcess.length} files (${((i + 1) / filesToProcess.length * 100).toFixed(1)}%)`)
  }

  // Final progress
  progress.status = 'completed'
  progress.currentFile = null
  saveProgress(progress)

  // Summary
  logger.separator()
  logger.section('Summary')
  logger.success(`Cards processed: ${totalSuccess.toLocaleString()}`)
  if (totalErrors > 0) {
    logger.error(`Errors: ${totalErrors}`)
    logger.info(`See: ${ERRORS_FILE}`)
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
