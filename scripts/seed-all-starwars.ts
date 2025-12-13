/**
 * Star Wars Unlimited - Scrape All Series
 *
 * Usage:
 *   npx tsx scripts/seed-all-starwars.ts
 *   npx tsx scripts/seed-all-starwars.ts --lang fr
 *   npx tsx scripts/seed-all-starwars.ts --type booster
 *   npx tsx scripts/seed-all-starwars.ts --skip WSOR,WSHD
 *   npx tsx scripts/seed-all-starwars.ts --start WSOR        # Resume from series WSOR
 *   npx tsx scripts/seed-all-starwars.ts --start-index 5     # Resume from series index 5
 *   npx tsx scripts/seed-all-starwars.ts --fresh-log         # Start with a fresh error log
 *   npx tsx scripts/seed-all-starwars.ts --retry-failed      # Retry only failed cards from log
 *
 * Error logs are saved to: scripts/logs/starwars-scraping-errors.json
 *
 * This script processes all Star Wars Unlimited series sequentially.
 */

import puppeteer, { Browser } from 'puppeteer'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import {
  STARWARS_ALL_SERIES,
  STARWARS_LANGUAGES,
  isSeriesAvailableInLanguage,
  getSeriesByType,
  type StarWarsLanguage,
  type StarWarsSeriesConfig
} from './config/starwars-series'
import {
  extractCardUrls,
  extractCardData,
  type StarWarsCardData
} from './lib/starwars-parser'
import { uploadStarWarsCardImage } from '../lib/supabase/storage'
import { DELAYS } from '../lib/constants/app-config'

// Failed cards log structure
interface FailedCard {
  url: string
  seriesCode: string
  language: string
  error: string
  timestamp: string
}

interface FailedImageUpload {
  cardName: string
  cardNumber: string
  seriesCode: string
  language: string
  originalUrl: string
  error: string
  timestamp: string
}

interface ScrapingLog {
  startedAt: string
  completedAt?: string
  failedCards: FailedCard[]
  failedImageUploads: FailedImageUpload[]
  stats: {
    totalProcessed: number
    totalErrors: number
    totalImageErrors: number
  }
}

// Log file management
const LOG_DIR = path.join(process.cwd(), 'scripts', 'logs')
const LOG_FILE = path.join(LOG_DIR, 'starwars-scraping-errors.json')

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function loadOrCreateLog(): ScrapingLog {
  ensureLogDir()

  if (fs.existsSync(LOG_FILE)) {
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf-8')
      return JSON.parse(content)
    } catch (e) {
      // If file is corrupted, start fresh
    }
  }

  return {
    startedAt: new Date().toISOString(),
    failedCards: [],
    failedImageUploads: [],
    stats: {
      totalProcessed: 0,
      totalErrors: 0,
      totalImageErrors: 0
    }
  }
}

function saveLog(log: ScrapingLog): void {
  ensureLogDir()
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8')
}

function logFailedCard(log: ScrapingLog, url: string, seriesCode: string, language: string, error: string): void {
  log.failedCards.push({
    url,
    seriesCode,
    language,
    error,
    timestamp: new Date().toISOString()
  })
  log.stats.totalErrors++
  saveLog(log)
}

function logFailedImageUpload(
  log: ScrapingLog,
  cardName: string,
  cardNumber: string,
  seriesCode: string,
  language: string,
  originalUrl: string,
  error: string
): void {
  log.failedImageUploads.push({
    cardName,
    cardNumber,
    seriesCode,
    language,
    originalUrl,
    error,
    timestamp: new Date().toISOString()
  })
  log.stats.totalImageErrors++
  saveLog(log)
}

// Parse command line arguments
const args = process.argv.slice(2)

function getArgValue(argName: string): string | undefined {
  // Try --arg=value format first
  const equalFormat = args.find(a => a.startsWith(`--${argName}=`))
  if (equalFormat) {
    return equalFormat.split('=')[1]
  }
  // Try --arg value format
  const idx = args.indexOf(`--${argName}`)
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1]
  }
  return undefined
}

const langArg = getArgValue('lang')
const typeArg = getArgValue('type')
const skipArg = getArgValue('skip')
const startArg = getArgValue('start')
const startIndexArg = getArgValue('start-index')
const skipImages = args.includes('--skip-images')
const retryFailed = args.includes('--retry-failed')

// Browser management - allows recreation after crashes
let currentBrowser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!currentBrowser || !currentBrowser.connected) {
    if (currentBrowser) {
      try {
        await currentBrowser.close()
      } catch (e) {
        // Ignore close errors
      }
    }
    logger.info('Launching new browser instance...')
    currentBrowser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  return currentBrowser
}

async function closeBrowser(): Promise<void> {
  if (currentBrowser) {
    try {
      await currentBrowser.close()
    } catch (e) {
      // Ignore
    }
    currentBrowser = null
  }
}

const BASE_URL = 'https://www.swucards.fr'

async function main() {
  logger.section('Star Wars Unlimited - Scrape All Series')

  // Determine which series to process
  let seriesToProcess: StarWarsSeriesConfig[]

  if (typeArg) {
    seriesToProcess = getSeriesByType(typeArg as any)
    logger.info(`Processing ${typeArg} series only`)
  } else {
    seriesToProcess = STARWARS_ALL_SERIES.filter(s => !s.skip)
    logger.info('Processing all active series')
  }

  // Filter out skipped series
  if (skipArg) {
    const skipCodes = skipArg.split(',').map(s => s.toUpperCase())
    seriesToProcess = seriesToProcess.filter(s => !skipCodes.includes(s.code.toUpperCase()))
    logger.info(`Skipping: ${skipArg}`)
  }

  // Handle --start option to resume from a specific series
  let startIndex = 0
  if (startArg) {
    const idx = seriesToProcess.findIndex(s => s.code.toUpperCase() === startArg.toUpperCase())
    if (idx === -1) {
      logger.error(`Series ${startArg} not found in list`)
      process.exit(1)
    }
    startIndex = idx
    logger.info(`Resuming from series: ${startArg} (index ${startIndex})`)
  } else if (startIndexArg) {
    startIndex = parseInt(startIndexArg, 10)
    if (isNaN(startIndex) || startIndex < 0) {
      logger.error(`Invalid start index: ${startIndexArg}`)
      process.exit(1)
    }
    logger.info(`Resuming from index: ${startIndex}`)
  }

  // Determine languages
  const languages: StarWarsLanguage[] = langArg
    ? [langArg as StarWarsLanguage]
    : STARWARS_LANGUAGES.map(l => l.code)

  logger.info(`Series to process: ${seriesToProcess.length - startIndex} (starting at index ${startIndex})`)
  logger.info(`Languages: ${languages.join(', ')}`)
  logger.info(`Skip images: ${skipImages}`)

  // Show summary
  console.log('\nSeries to process:')
  seriesToProcess.forEach((s, i) => {
    const marker = i < startIndex ? '  [SKIP]' : ''
    console.log(`  ${i + 1}. ${s.code} - ${s.nameFr} (~${s.cardCount || '?'} cards)${marker}`)
  })

  // Initialize Supabase
  const supabase = createAdminClient()

  // Get TCG ID
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'starwars')
    .single()

  if (tcgError || !tcg) {
    logger.error('Star Wars TCG not found. Run migration 023_add_starwars_tables.sql first.')
    process.exit(1)
  }

  const stats = {
    totalSeries: 0,
    totalCards: 0,
    errors: 0,
    browserRestarts: 0
  }

  // Initialize or load scraping log
  const scrapingLog = args.includes('--fresh-log')
    ? {
        startedAt: new Date().toISOString(),
        failedCards: [],
        failedImageUploads: [],
        stats: { totalProcessed: 0, totalErrors: 0, totalImageErrors: 0 }
      } as ScrapingLog
    : loadOrCreateLog()

  // Update start time if fresh run
  if (args.includes('--fresh-log')) {
    scrapingLog.startedAt = new Date().toISOString()
  }

  logger.info(`Log file: ${LOG_FILE}`)

  try {
    for (let i = startIndex; i < seriesToProcess.length; i++) {
      const series = seriesToProcess[i]

      for (const lang of languages) {
        if (!isSeriesAvailableInLanguage(series.code, lang)) {
          logger.warn(`${series.code} not available in ${lang}, skipping...`)
          continue
        }

        // Retry logic with browser restart on failure
        let retries = 0
        const maxRetries = 2

        while (retries <= maxRetries) {
          try {
            const browser = await getBrowser()

            const cardsProcessed = await processSeriesLanguage(
              browser,
              supabase,
              tcg.id,
              series,
              lang,
              skipImages,
              scrapingLog
            )

            stats.totalCards += cardsProcessed
            stats.totalSeries++
            scrapingLog.stats.totalProcessed += cardsProcessed
            break // Success, exit retry loop

          } catch (e: any) {
            const isConnectionError = e.message.includes('Connection closed')
              || e.message.includes('detached Frame')
              || e.message.includes('Target closed')
              || e.message.includes('Protocol error')

            if (isConnectionError && retries < maxRetries) {
              retries++
              stats.browserRestarts++
              logger.warn(`Browser crashed, restarting... (attempt ${retries}/${maxRetries})`)
              await closeBrowser() // Force close and restart
              await delay(3000) // Wait before retry
            } else {
              logger.error(`Error processing ${series.code} (${lang}): ${e.message}`)
              stats.errors++
              break
            }
          }
        }

        await delay(DELAYS.betweenSeries)
      }
    }

    // Finalize log
    scrapingLog.completedAt = new Date().toISOString()
    saveLog(scrapingLog)

    logger.section('All Series Complete!')
    logger.info(`Total series processed: ${stats.totalSeries}`)
    logger.info(`Total cards: ${stats.totalCards}`)
    logger.info(`Errors: ${stats.errors}`)
    logger.info(`Browser restarts: ${stats.browserRestarts}`)

    // Show error summary
    if (scrapingLog.failedCards.length > 0 || scrapingLog.failedImageUploads.length > 0) {
      logger.section('Error Summary')
      logger.warn(`Failed cards: ${scrapingLog.failedCards.length}`)
      logger.warn(`Failed image uploads: ${scrapingLog.failedImageUploads.length}`)
      logger.info(`See detailed log: ${LOG_FILE}`)

      // Show unique series with errors
      const seriesWithErrors = [...new Set(scrapingLog.failedCards.map(f => `${f.seriesCode} (${f.language})`))]
      if (seriesWithErrors.length > 0) {
        logger.info(`Series with card errors: ${seriesWithErrors.join(', ')}`)
      }
    }

  } finally {
    await closeBrowser()
  }
}

async function processSeriesLanguage(
  browser: puppeteer.Browser,
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  config: StarWarsSeriesConfig,
  language: StarWarsLanguage,
  skipImages: boolean,
  scrapingLog: ScrapingLog
): Promise<number> {
  logger.section(`${config.code} - ${config.nameFr} (${language.toUpperCase()})`)

  // Check if series exists first
  const { data: existingSeries } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', config.code)
    .single()

  let seriesId: string

  if (existingSeries) {
    seriesId = existingSeries.id
    logger.info(`Series exists: ${seriesId}`)
  } else {
    // Create new series
    const { data: newSeries, error: createError } = await supabase
      .from('series')
      .insert({
        tcg_game_id: tcgGameId,
        name: config.nameFr,
        code: config.code,
        release_date: config.releaseDate,
        max_set_base: config.cardCount || 0,
        master_set: config.cardCount || 0
      })
      .select('id')
      .single()

    if (createError || !newSeries) {
      throw new Error(`Failed to create series: ${createError?.message || 'Unknown error'}`)
    }

    seriesId = newSeries.id
    logger.success(`Series created: ${seriesId}`)
  }

  let page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  try {
    // Build series URL with language filter
    const seriesUrl = language === 'fr'
      ? `${BASE_URL}/series/${config.slug}`
      : `${BASE_URL}/series/${config.slug}?lang=${language}`

    logger.info(`URL: ${seriesUrl}`)

    // Extract ALL card URLs (no filtering by regex)
    logger.processing('Extracting card URLs...')
    const allCardUrls = await extractCardUrls(page, seriesUrl)
    logger.success(`Found ${allCardUrls.length} total card URLs`)

    if (allCardUrls.length === 0) {
      return 0
    }

    // Close the listing page and create a fresh one for card details
    await page.close()
    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Process each card and filter by language after extraction
    let processed = 0
    let skipped = 0
    let errors = 0
    let consecutiveErrors = 0
    const total = allCardUrls.length

    for (let i = 0; i < allCardUrls.length; i++) {
      const cardUrl = allCardUrls[i]
      console.log(`  [${i + 1}/${total}] Fetching: ${cardUrl.split('/cards/')[1]?.substring(0, 50)}...`)

      try {
        // Check if page is still valid, recreate if needed
        if (page.isClosed()) {
          logger.warn('Page was closed, creating new page...')
          page = await browser.newPage()
          await page.setViewport({ width: 1280, height: 800 })
        }

        const cardData = await extractCardData(page, cardUrl)
        consecutiveErrors = 0 // Reset on success

        if (cardData) {
          // Filter by requested language AFTER extraction
          if (cardData.language.toLowerCase() !== language.toLowerCase()) {
            skipped++
            continue
          }

          let imageUrl = cardData.imageUrl

          // Upload image
          if (!skipImages && cardData.imageUrl) {
            try {
              const result = await uploadStarWarsCardImage(
                cardData.imageUrl,
                cardData.number,
                config.code,
                language
              )
              if (result.success && result.url) {
                imageUrl = result.url
              } else if (!result.success) {
                // Log failed image upload
                logFailedImageUpload(
                  scrapingLog,
                  cardData.name,
                  cardData.number,
                  config.code,
                  language,
                  cardData.imageUrl,
                  result.error || 'Unknown upload error'
                )
              }
            } catch (e: any) {
              // Log failed image upload
              logFailedImageUpload(
                scrapingLog,
                cardData.name,
                cardData.number,
                config.code,
                language,
                cardData.imageUrl,
                e.message || 'Unknown error'
              )
            }
          }

          // Insert card
          await supabase.from('cards').upsert({
            series_id: seriesId,
            name: cardData.name,
            number: cardData.number,
            language: language.toUpperCase(),
            rarity: cardData.rarity,
            image_url: imageUrl,
            attributes: {
              cardType: cardData.cardType,
              arenas: cardData.arenas,
              aspects: cardData.aspects,
              characters: cardData.characters,
              traits: cardData.traits,
              cost: cardData.cost,
              power: cardData.power,
              hp: cardData.hp,
              illustrator: cardData.illustrator,
              slug: cardData.slug
            }
          }, {
            onConflict: 'series_id,number,language'
          })

          processed++
          logger.progress(`  ✓ ${cardData.name} (${cardData.number})`)
        } else {
          errors++
          // Log failed card extraction (no data returned)
          logFailedCard(scrapingLog, cardUrl, config.code, language, 'No card data extracted')
        }

        await delay(DELAYS.betweenUploads)

      } catch (e: any) {
        errors++
        consecutiveErrors++

        // Log failed card with error details
        logFailedCard(scrapingLog, cardUrl, config.code, language, e.message || 'Unknown error')

        // If frame is detached, try to recreate the page
        if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
          logger.warn(`Frame detached, recreating page...`)
          try {
            await page.close()
          } catch (closeErr) {
            // Ignore close errors
          }
          page = await browser.newPage()
          await page.setViewport({ width: 1280, height: 800 })
        }

        // If too many consecutive errors, throw to trigger browser restart
        if (consecutiveErrors >= 10) {
          throw new Error(`Too many consecutive errors (${consecutiveErrors}), browser may be unstable`)
        }
      }
    }

    logger.success(`Completed: ${processed} cards (${skipped} other languages, ${errors} errors)`)
    return processed

  } finally {
    try {
      await page.close()
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Retry failed cards from the error log
 */
async function retryFailedCards() {
  logger.section('Retry Failed Cards')

  const log = loadOrCreateLog()

  if (log.failedCards.length === 0) {
    logger.info('No failed cards to retry!')
    return
  }

  logger.info(`Found ${log.failedCards.length} failed cards to retry`)

  // Initialize Supabase
  const supabase = createAdminClient()

  // Get TCG ID
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'starwars')
    .single()

  if (tcgError || !tcg) {
    logger.error('Star Wars TCG not found')
    process.exit(1)
  }

  const browser = await getBrowser()
  let page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  const retryLog: ScrapingLog = {
    startedAt: new Date().toISOString(),
    failedCards: [],
    failedImageUploads: [],
    stats: { totalProcessed: 0, totalErrors: 0, totalImageErrors: 0 }
  }

  let success = 0
  let failed = 0

  try {
    for (let i = 0; i < log.failedCards.length; i++) {
      const failedCard = log.failedCards[i]
      console.log(`  [${i + 1}/${log.failedCards.length}] Retrying: ${failedCard.url.split('/cards/')[1]?.substring(0, 50)}...`)

      try {
        if (page.isClosed()) {
          page = await browser.newPage()
          await page.setViewport({ width: 1280, height: 800 })
        }

        const cardData = await extractCardData(page, failedCard.url)

        if (cardData) {
          // Get series ID
          const { data: series } = await supabase
            .from('series')
            .select('id')
            .eq('tcg_game_id', tcg.id)
            .eq('code', failedCard.seriesCode)
            .single()

          if (!series) {
            logger.warn(`Series ${failedCard.seriesCode} not found, skipping`)
            failed++
            continue
          }

          let imageUrl = cardData.imageUrl

          // Upload image
          if (!skipImages && cardData.imageUrl) {
            try {
              const result = await uploadStarWarsCardImage(
                cardData.imageUrl,
                cardData.number,
                failedCard.seriesCode,
                failedCard.language as StarWarsLanguage
              )
              if (result.success && result.url) {
                imageUrl = result.url
              }
            } catch (e) {
              // Keep original URL
            }
          }

          // Insert card
          await supabase.from('cards').upsert({
            series_id: series.id,
            name: cardData.name,
            number: cardData.number,
            language: failedCard.language.toUpperCase(),
            rarity: cardData.rarity,
            image_url: imageUrl,
            attributes: {
              cardType: cardData.cardType,
              arenas: cardData.arenas,
              aspects: cardData.aspects,
              characters: cardData.characters,
              traits: cardData.traits,
              cost: cardData.cost,
              power: cardData.power,
              hp: cardData.hp,
              illustrator: cardData.illustrator,
              slug: cardData.slug
            }
          }, {
            onConflict: 'series_id,number,language'
          })

          success++
          logger.success(`  ✓ ${cardData.name} (${cardData.number})`)
        } else {
          failed++
          logFailedCard(retryLog, failedCard.url, failedCard.seriesCode, failedCard.language, 'No card data extracted (retry)')
        }

        await delay(DELAYS.betweenUploads)

      } catch (e: any) {
        failed++
        logFailedCard(retryLog, failedCard.url, failedCard.seriesCode, failedCard.language, e.message || 'Unknown error')

        if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
          try { await page.close() } catch (err) { /* ignore */ }
          page = await browser.newPage()
          await page.setViewport({ width: 1280, height: 800 })
        }
      }
    }

    logger.section('Retry Complete!')
    logger.info(`Success: ${success}`)
    logger.info(`Still failed: ${failed}`)

    // Save new log with remaining failures
    if (retryLog.failedCards.length > 0) {
      retryLog.completedAt = new Date().toISOString()
      retryLog.stats.totalProcessed = success
      saveLog(retryLog)
      logger.warn(`${retryLog.failedCards.length} cards still failing - see ${LOG_FILE}`)
    } else {
      // Clear the log if all succeeded
      const emptyLog: ScrapingLog = {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        failedCards: [],
        failedImageUploads: log.failedImageUploads, // Keep image failures
        stats: { totalProcessed: success, totalErrors: 0, totalImageErrors: log.stats.totalImageErrors }
      }
      saveLog(emptyLog)
      logger.success('All previously failed cards have been recovered!')
    }

  } finally {
    try { await page.close() } catch (e) { /* ignore */ }
    await closeBrowser()
  }
}

// Run appropriate mode
if (retryFailed) {
  retryFailedCards().catch(e => {
    logger.error(`Fatal error: ${e.message}`)
    process.exit(1)
  })
} else {
  main().catch(e => {
    logger.error(`Fatal error: ${e.message}`)
    process.exit(1)
  })
}
