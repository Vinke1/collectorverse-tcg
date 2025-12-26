#!/usr/bin/env tsx
/**
 * Download missing Magic: The Gathering card images
 *
 * Usage:
 *   npx tsx scripts/download-missing-magic-images.ts --dry-run      # Preview
 *   npx tsx scripts/download-missing-magic-images.ts                # Download all
 *   npx tsx scripts/download-missing-magic-images.ts --set VOW      # Specific set
 *   npx tsx scripts/download-missing-magic-images.ts --lang fr      # Specific language
 *   npx tsx scripts/download-missing-magic-images.ts --limit 100    # Limit count
 *   npx tsx scripts/download-missing-magic-images.ts --continue-on-error
 *
 * This script finds cards without image_url in the database and downloads
 * their images from Scryfall.
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { MAGIC_CONFIG, type SupportedLanguage } from './config/magic-config'

// Parse CLI arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error')

const setArg = args.find(a => a.startsWith('--set='))?.split('=')[1]?.toLowerCase()
  || (args.includes('--set') ? args[args.indexOf('--set') + 1]?.toLowerCase() : null)

const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1] as SupportedLanguage | null
  || (args.includes('--lang') ? args[args.indexOf('--lang') + 1] as SupportedLanguage : null)

const limitArg = parseInt(
  args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0',
  10
)

interface CardToProcess {
  id: string
  number: string
  language: string
  seriesCode: string
  scryfallId: string | null
}

interface DownloadProgress {
  startedAt: string
  lastUpdated: string
  totalMissing: number
  processed: number
  success: number
  errors: number
  notFound: number
  processedCardIds: string[]
}

const PROGRESS_FILE = 'scripts/logs/magic-images-progress.json'

/**
 * Load progress from file
 */
function loadProgress(): DownloadProgress | null {
  const progressPath = path.resolve(process.cwd(), PROGRESS_FILE)

  if (fs.existsSync(progressPath)) {
    try {
      return JSON.parse(fs.readFileSync(progressPath, 'utf8'))
    } catch {
      return null
    }
  }

  return null
}

/**
 * Save progress to file
 */
function saveProgress(progress: DownloadProgress): void {
  const progressPath = path.resolve(process.cwd(), PROGRESS_FILE)
  const dir = path.dirname(progressPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2))
}

/**
 * Get Scryfall image URL for a card
 */
async function getScryfallImageUrl(scryfallId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.scryfall.com/cards/${scryfallId}`)

    if (!response.ok) {
      return null
    }

    const card = await response.json()

    // Check card_faces first for multi-face cards
    if (card.card_faces && card.card_faces[0]?.image_uris) {
      return card.card_faces[0].image_uris.large || card.card_faces[0].image_uris.normal
    }

    // Single-face card
    if (card.image_uris) {
      return card.image_uris.large || card.image_uris.normal
    }

    return null
  } catch {
    return null
  }
}

/**
 * Download and optimize image
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
  setCode: string,
  language: string,
  cardNumber: string
): Promise<string | null> {
  try {
    const safeNumber = cardNumber.replace('/', '-')
    const filePath = `${setCode}/${language}/${safeNumber}.webp`

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
 * Update card image_url in database
 */
async function updateCardImageUrl(
  supabase: ReturnType<typeof createAdminClient>,
  cardId: string,
  imageUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId)

  return !error
}

/**
 * Main function
 */
async function main() {
  logger.section('Magic: The Gathering - Download Missing Images')

  if (dryRun) {
    logger.warn('DRY RUN MODE - No changes will be made')
  }

  const supabase = createAdminClient()

  // Get Magic TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', MAGIC_CONFIG.tcgSlug)
    .single()

  if (!tcg) {
    logger.error(`TCG '${MAGIC_CONFIG.tcgSlug}' not found`)
    process.exit(1)
  }

  // Build query for cards without images
  let query = supabase
    .from('cards')
    .select(`
      id,
      number,
      language,
      attributes,
      series!inner(code, tcg_game_id)
    `)
    .eq('series.tcg_game_id', tcg.id)
    .is('image_url', null)

  // Filter by set if specified
  if (setArg) {
    query = query.eq('series.code', setArg)
  }

  // Filter by language if specified
  if (langArg) {
    query = query.eq('language', langArg)
  }

  // Apply limit
  if (limitArg > 0) {
    query = query.limit(limitArg)
  } else {
    query = query.limit(10000) // Safety limit
  }

  const { data: cards, error } = await query

  if (error) {
    logger.error(`Database query failed: ${error.message}`)
    process.exit(1)
  }

  if (!cards || cards.length === 0) {
    logger.success('No missing images found!')
    return
  }

  // Transform to CardToProcess
  const cardsToProcess: CardToProcess[] = cards.map((card: any) => ({
    id: card.id,
    number: card.number,
    language: card.language,
    seriesCode: card.series.code,
    scryfallId: card.attributes?.scryfall_id || null,
  }))

  logger.info(`Found ${cardsToProcess.length} cards without images`)

  // Load or initialize progress
  let progress = loadProgress()
  const isResuming = progress !== null

  if (!progress) {
    progress = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalMissing: cardsToProcess.length,
      processed: 0,
      success: 0,
      errors: 0,
      notFound: 0,
      processedCardIds: [],
    }
  }

  if (isResuming) {
    logger.info(`Resuming from previous session: ${progress.processed}/${progress.totalMissing}`)
  }

  // Filter out already processed cards
  const pendingCards = cardsToProcess.filter(
    card => !progress!.processedCardIds.includes(card.id)
  )

  logger.info(`Cards to process: ${pendingCards.length}`)
  logger.separator()

  if (dryRun) {
    // Just show stats in dry run
    const bySet: Record<string, number> = {}
    const byLang: Record<string, number> = {}

    for (const card of pendingCards) {
      bySet[card.seriesCode] = (bySet[card.seriesCode] || 0) + 1
      byLang[card.language] = (byLang[card.language] || 0) + 1
    }

    logger.info('Cards by set:')
    Object.entries(bySet)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .forEach(([set, count]) => {
        logger.info(`  ${set.toUpperCase()}: ${count}`)
      })

    logger.info('')
    logger.info('Cards by language:')
    Object.entries(byLang)
      .sort(([, a], [, b]) => b - a)
      .forEach(([lang, count]) => {
        logger.info(`  ${lang}: ${count}`)
      })

    return
  }

  // Process cards
  for (let i = 0; i < pendingCards.length; i++) {
    const card = pendingCards[i]

    // Skip if no Scryfall ID
    if (!card.scryfallId) {
      progress.notFound++
      progress.processedCardIds.push(card.id)
      continue
    }

    // Get image URL from Scryfall
    const imageUrl = await getScryfallImageUrl(card.scryfallId)
    await delay(MAGIC_CONFIG.delays.betweenApiCalls)

    if (!imageUrl) {
      progress.notFound++
      progress.processedCardIds.push(card.id)
      logger.warn(`No image found for ${card.seriesCode}-${card.number} (${card.language})`)
      continue
    }

    // Download and optimize
    const imageBuffer = await downloadAndOptimizeImage(imageUrl)

    if (!imageBuffer) {
      progress.errors++
      progress.processedCardIds.push(card.id)
      logger.error(`Failed to download ${card.seriesCode}-${card.number} (${card.language})`)

      if (!continueOnError) {
        saveProgress(progress)
        throw new Error('Download failed')
      }
      continue
    }

    // Upload to storage
    const uploadedUrl = await uploadImage(
      supabase,
      imageBuffer,
      card.seriesCode,
      card.language,
      card.number
    )

    if (!uploadedUrl) {
      progress.errors++
      progress.processedCardIds.push(card.id)
      logger.error(`Failed to upload ${card.seriesCode}-${card.number} (${card.language})`)

      if (!continueOnError) {
        saveProgress(progress)
        throw new Error('Upload failed')
      }
      continue
    }

    // Update database
    const updated = await updateCardImageUrl(supabase, card.id, uploadedUrl)

    if (updated) {
      progress.success++
      logger.success(`${card.seriesCode}-${card.number} (${card.language})`)
    } else {
      progress.errors++
      logger.error(`DB update failed: ${card.seriesCode}-${card.number}`)
    }

    progress.processed++
    progress.processedCardIds.push(card.id)

    // Save progress every 10 cards
    if ((i + 1) % 10 === 0) {
      saveProgress(progress)
      logger.progress(`Progress: ${i + 1}/${pendingCards.length}`)
    }

    await delay(MAGIC_CONFIG.delays.betweenImageDownloads)
  }

  // Final save
  saveProgress(progress)

  // Clean up progress file if complete
  if (progress.processed >= progress.totalMissing) {
    const progressPath = path.resolve(process.cwd(), PROGRESS_FILE)
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath)
      logger.info('Progress file cleaned up')
    }
  }

  // Summary
  logger.separator()
  logger.section('Summary')
  logger.success(`Downloaded: ${progress.success}`)
  if (progress.errors > 0) {
    logger.error(`Errors: ${progress.errors}`)
  }
  if (progress.notFound > 0) {
    logger.warn(`Not found: ${progress.notFound}`)
  }

  logger.info('')
  logger.success('Download complete!')
}

// Run
main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
