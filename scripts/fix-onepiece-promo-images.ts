/**
 * Fix One Piece promo series images (PRB01, PRB02, STP)
 *
 * These series have incorrect image URLs in the database.
 * This script:
 * 1. Scrapes correct image URLs from opecards.fr search pages
 * 2. Downloads and uploads images to Supabase Storage
 * 3. Updates card image_url in the database
 *
 * Usage:
 *   npx tsx scripts/fix-onepiece-promo-images.ts
 *   npx tsx scripts/fix-onepiece-promo-images.ts --series PRB01
 *   npx tsx scripts/fix-onepiece-promo-images.ts --language EN
 *   npx tsx scripts/fix-onepiece-promo-images.ts --dry-run
 */

import puppeteer, { Page, Browser } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'
import * as fs from 'fs'

// Parse command line arguments
const args = process.argv.slice(2)
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]?.toUpperCase()
  || (args.includes('--series') ? args[args.indexOf('--series') + 1]?.toUpperCase() : null)
const languageFilter = args.find(a => a.startsWith('--language='))?.split('=')[1]?.toUpperCase()
  || (args.includes('--language') ? args[args.indexOf('--language') + 1]?.toUpperCase() : null)
const dryRun = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const LIMIT = limitArg ? parseInt(limitArg) : null

const BASE_URL = 'https://www.opecards.fr'

// Series IDs from opecards.fr (found via inspection)
// Format: { seriesCode: { language: serieId } }
const PROMO_SERIES_IDS: Record<string, Record<string, number>> = {
  'PRB01': { 'FR': 434, 'EN': 435 },
  'PRB02': { 'FR': 439, 'EN': 445 },
  'STP': { 'FR': 99, 'EN': 283 },
}

interface CardImageInfo {
  cardUrl: string
  imageUrl: string
  cardName: string
}

interface ProgressData {
  startedAt: string
  lastUpdated: string
  processed: number
  success: number
  errors: number
  processedUrls: string[]
}

const PROGRESS_FILE = 'scripts/logs/onepiece-promo-fix-progress.json'

function loadProgress(): ProgressData | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch (e) {
    // Ignore
  }
  return null
}

function saveProgress(progress: ProgressData) {
  const logsDir = 'scripts/logs'
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

/**
 * Scrape all card image URLs from a series search page
 */
async function scrapeSeriesImages(
  page: Page,
  seriesCode: string,
  language: string,
  serieId: number
): Promise<CardImageInfo[]> {
  const allCards: CardImageInfo[] = []
  let currentPage = 1
  let hasMorePages = true

  logger.info(`Scraping ${seriesCode} ${language} (serie ID: ${serieId})...`)

  while (hasMorePages) {
    const url = `${BASE_URL}/cards/search?page=${currentPage}&sortBy=releaseR&serie=${serieId}&language=${language}`
    logger.info(`  Page ${currentPage}: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1500)

    // Extract card images from the page
    const pageCards = await page.evaluate(() => {
      const cards: { cardUrl: string; imageUrl: string; cardName: string }[] = []

      // Find all card containers
      const cardElements = document.querySelectorAll('.collection-card-container, .card-container, [class*="card"]')

      cardElements.forEach(cardEl => {
        const link = cardEl.querySelector('a[href*="/cards/"]') as HTMLAnchorElement
        const img = cardEl.querySelector('img[src*="static.opecards.fr"]') as HTMLImageElement

        if (link && img) {
          cards.push({
            cardUrl: link.href,
            imageUrl: img.src,
            cardName: img.alt || 'Unknown',
          })
        }
      })

      // If no cards found with that selector, try alternative approach
      if (cards.length === 0) {
        const images = document.querySelectorAll('img[src*="static.opecards.fr/cards"]')
        images.forEach(img => {
          const imgEl = img as HTMLImageElement
          const parentLink = imgEl.closest('a') as HTMLAnchorElement
          if (parentLink && parentLink.href.includes('/cards/')) {
            cards.push({
              cardUrl: parentLink.href,
              imageUrl: imgEl.src,
              cardName: imgEl.alt || 'Unknown',
            })
          }
        })
      }

      return cards
    })

    if (pageCards.length === 0) {
      logger.warn(`  No cards found on page ${currentPage}`)
      hasMorePages = false
    } else {
      logger.info(`  Found ${pageCards.length} cards on page ${currentPage}`)
      allCards.push(...pageCards)

      // Check if there's a next page by looking at pagination
      const hasNext = await page.evaluate((currentPageNum) => {
        const pagination = document.querySelector('.pagination, [class*="pagination"]')
        if (!pagination) return false

        // Look for page links with data-page attribute
        const pageLinks = pagination.querySelectorAll('.page-link[data-page], a[data-page]')
        if (pageLinks.length > 0) {
          const pageNums = Array.from(pageLinks)
            .map(el => parseInt(el.getAttribute('data-page') || '0'))
            .filter(n => n > 0)
          const maxPage = Math.max(...pageNums, 0)
          return currentPageNum < maxPage
        }

        // Fallback: look for next arrow or disabled state
        const nextArrow = pagination.querySelector('.page-item:last-child, .next')
        if (nextArrow) {
          return !nextArrow.classList.contains('disabled')
        }

        return false
      }, currentPage)

      if (hasNext) {
        currentPage++
        await delay(1000)
      } else {
        hasMorePages = false
      }
    }

    // Safety limit
    if (currentPage > 20) {
      logger.warn('  Reached page limit (20), stopping...')
      hasMorePages = false
    }
  }

  logger.success(`  Total: ${allCards.length} cards found for ${seriesCode} ${language}`)
  return allCards
}

/**
 * Extract card info from image URL
 * Example URLs:
 * - https://static.opecards.fr/cards/en/prb01/image-...-en-op02-004-sr-prb01-edward-newgate.webp
 * - https://static.opecards.fr/cards/en/prb01/image-...-en-op02-004-sr-prb01-alternative-art-edward-newgate.webp
 * - https://static.opecards.fr/cards/en/prb01/image-...-en-op02-004-sr-prb01-full-art-edward-newgate.webp
 * - https://static.opecards.fr/cards/en/prb01/image-...-en-op02-004-sr-prb01-jolly-roger-foil-edward-newgate.webp
 */
function extractCardInfo(imageUrl: string): { number: string; variant: string } | null {
  // Skip back images
  if (imageUrl.includes('/back-')) {
    return null
  }

  // Pattern: ...-{series}-{number}-{rarity}-prb0X-{variant}-{name}.webp
  // Examples:
  // - op02-004-sr-prb01-edward-newgate
  // - op02-004-sr-prb01-alternative-art-edward-newgate
  // - op02-004-sr-prb01-full-art-edward-newgate
  // - op02-004-sr-prb01-jolly-roger-foil-edward-newgate

  const imageMatch = imageUrl.match(/-(op\d+|st\d+|eb\d+|prb\d+)-(\d{3})-([a-z]+)-prb\d+-(.+)\.webp$/i)
  if (imageMatch) {
    const number = imageMatch[2]
    const rest = imageMatch[4]

    // Determine variant type
    let variant = ''
    if (rest.includes('alternative-art')) {
      variant = '-ALT'
    } else if (rest.includes('full-art')) {
      variant = '-FA'
    } else if (rest.includes('jolly-roger')) {
      variant = '-JR'
    } else if (rest.includes('foil-textured')) {
      variant = '-FT'
    } else if (rest.includes('gold')) {
      variant = '-GOLD'
    }

    return { number, variant }
  }

  // DON!! cards pattern: prb01-don-{variant}-{name}.webp
  const donMatch = imageUrl.match(/prb\d+-don-(.+)\.webp$/i)
  if (donMatch) {
    const rest = donMatch[1]
    let variant = ''
    if (rest.includes('foil-textured')) {
      variant = '-FT'
    } else if (rest.includes('gold')) {
      variant = '-GOLD'
    }
    return { number: 'DON', variant }
  }

  return null
}

/**
 * Download and process image
 */
async function downloadAndProcessImage(
  imageUrl: string,
  browser: Browser
): Promise<Buffer | null> {
  try {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.opecards.fr/',
    })

    const response = await page.goto(imageUrl, { waitUntil: 'load', timeout: 15000 })

    if (!response || !response.ok()) {
      await page.close()
      return null
    }

    const buffer = await response.buffer()
    await page.close()

    // Process with Sharp: resize to 480x672, convert to WebP
    const processed = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    return processed
  } catch (error) {
    return null
  }
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Correction des images One Piece Promo')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification ne sera effectuee')
  }

  // Get One Piece TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouve')
    process.exit(1)
  }

  // Determine which series to process
  const seriesToProcess = seriesFilter
    ? [seriesFilter]
    : Object.keys(PROMO_SERIES_IDS)

  const languagesToProcess = languageFilter
    ? [languageFilter]
    : ['FR', 'EN']

  logger.info(`Series a traiter: ${seriesToProcess.join(', ')}`)
  logger.info(`Langues: ${languagesToProcess.join(', ')}`)

  // Load progress
  let progress = loadProgress() || {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    processed: 0,
    success: 0,
    errors: 0,
    processedUrls: [],
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  try {
    for (const seriesCode of seriesToProcess) {
      const seriesIds = PROMO_SERIES_IDS[seriesCode]
      if (!seriesIds) {
        logger.warn(`No series IDs found for ${seriesCode}`)
        continue
      }

      // Get series from database
      const { data: series } = await supabase
        .from('series')
        .select('id, code, name')
        .eq('tcg_game_id', tcg.id)
        .eq('code', seriesCode)
        .single()

      if (!series) {
        logger.warn(`Series ${seriesCode} not found in database`)
        continue
      }

      for (const language of languagesToProcess) {
        const serieId = seriesIds[language]
        if (!serieId) {
          logger.warn(`No serie ID for ${seriesCode} ${language}`)
          continue
        }

        logger.section(`Traitement de ${seriesCode} (${language})`)

        // Scrape all card images
        const cardImages = await scrapeSeriesImages(page, seriesCode, language, serieId)

        if (cardImages.length === 0) {
          logger.warn(`No cards found for ${seriesCode} ${language}`)
          continue
        }

        // Get cards from database for this series/language
        const { data: dbCards } = await supabase
          .from('cards')
          .select('id, number, name, image_url')
          .eq('series_id', series.id)
          .eq('language', language)

        if (!dbCards || dbCards.length === 0) {
          logger.warn(`No cards in database for ${seriesCode} ${language}`)
          continue
        }

        logger.info(`${dbCards.length} cards in database, ${cardImages.length} images scraped`)

        // Process each scraped image
        let processed = 0
        let success = 0
        let errors = 0
        let skipped = 0

        for (const cardImage of cardImages) {
          // Skip if already processed
          if (progress.processedUrls.includes(cardImage.imageUrl)) {
            continue
          }

          // Skip back images
          if (cardImage.imageUrl.includes('/back-') || cardImage.imageUrl.includes('/common/')) {
            skipped++
            continue
          }

          // Apply limit
          if (LIMIT && processed >= LIMIT) {
            logger.info(`Limit reached (${LIMIT})`)
            break
          }

          processed++

          // Extract card info from URL
          const cardInfo = extractCardInfo(cardImage.imageUrl)
          const cardName = cardImage.cardName

          if (!cardInfo) {
            logger.warn(`[${processed}] Could not parse URL: ${cardImage.imageUrl}`)
            skipped++
            continue
          }

          logger.info(`[${processed}/${cardImages.length}] ${cardName} -> #${cardInfo.number}${cardInfo.variant}`)

          if (dryRun) {
            logger.info(`  Image URL: ${cardImage.imageUrl}`)
            progress.processedUrls.push(cardImage.imageUrl)
            success++
            continue
          }

          try {
            // Download and process image
            const imageBuffer = await downloadAndProcessImage(cardImage.imageUrl, browser)

            if (!imageBuffer) {
              logger.error(`  Failed to download image`)
              errors++
              continue
            }

            // Generate filename based on card number and variant
            // Format: 004.webp, 004-ALT.webp, 004-FA.webp, 004-JR.webp
            const filename = `${cardInfo.number}${cardInfo.variant}.webp`
            const storagePath = `${seriesCode}/${language.toLowerCase()}/${filename}`

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from('onepiece-cards')
              .upload(storagePath, imageBuffer, {
                contentType: 'image/webp',
                upsert: true,
              })

            if (uploadError) {
              logger.error(`  Upload error: ${uploadError.message}`)
              errors++
              continue
            }

            // Get public URL
            const { data: publicUrl } = supabase.storage
              .from('onepiece-cards')
              .getPublicUrl(storagePath)

            // Try to find matching card in database by number
            // DB cards have numbers like: 003, 003-ALT, 004, 004-ALT, etc.
            const fullNumber = `${cardInfo.number}${cardInfo.variant}`
            const paddedNumber = `${cardInfo.number.padStart(3, '0')}${cardInfo.variant}`

            let matchingCard = dbCards.find(c => {
              const cardNum = c.number.toString()
              // Exact match
              if (cardNum === fullNumber || cardNum === paddedNumber) return true
              // Match without leading zeros
              if (cardNum.replace(/^0+/, '') === fullNumber.replace(/^0+/, '')) return true
              // Match base number for non-variant images to base cards
              if (!cardInfo.variant && cardNum === cardInfo.number) return true
              if (!cardInfo.variant && cardNum === cardInfo.number.padStart(3, '0')) return true
              return false
            })

            // For Jolly Roger variants, try to match to base card if no -JR variant exists
            if (!matchingCard && cardInfo.variant === '-JR') {
              matchingCard = dbCards.find(c => {
                const cardNum = c.number.toString()
                return cardNum === cardInfo.number || cardNum === cardInfo.number.padStart(3, '0')
              })
            }

            if (matchingCard) {
              // Update card image_url
              const { error: updateError } = await supabase
                .from('cards')
                .update({ image_url: publicUrl.publicUrl })
                .eq('id', matchingCard.id)

              if (updateError) {
                logger.error(`  DB update error: ${updateError.message}`)
              } else {
                logger.success(`  Updated card ${matchingCard.number}: ${matchingCard.name}`)
              }
            } else {
              logger.info(`  Uploaded but no matching card in DB for: ${fullNumber}`)
            }

            success++
            progress.processedUrls.push(cardImage.imageUrl)
            saveProgress(progress)

            await delay(300) // Rate limiting

          } catch (error: any) {
            logger.error(`  Error: ${error.message}`)
            errors++
          }
        }

        logger.info(`Skipped ${skipped} back/common images`)

        logger.section(`Resume ${seriesCode} ${language}`)
        console.log(`  Traites: ${processed}`)
        console.log(`  Succes: ${success}`)
        console.log(`  Erreurs: ${errors}`)
      }
    }

  } finally {
    await browser.close()
  }

  // Final summary
  logger.section('Resume final')
  console.log(`Total traites: ${progress.processed}`)
  console.log(`Succes: ${progress.success}`)
  console.log(`Erreurs: ${progress.errors}`)

  // Cleanup progress file on success
  if (!dryRun && progress.errors === 0) {
    try {
      fs.unlinkSync(PROGRESS_FILE)
    } catch (e) {
      // Ignore
    }
  }
}

main().catch(error => {
  logger.error(`Erreur fatale: ${error.message}`)
  process.exit(1)
})
