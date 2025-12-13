/**
 * Download all missing Star Wars Unlimited images
 *
 * This script:
 * 1. Analyzes all Star Wars series in the database
 * 2. Compares cards with images in Supabase storage
 * 3. Downloads missing images from swucards.fr
 * 4. Uploads them to Supabase storage
 * 5. Updates the card's image_url in the database
 *
 * Usage:
 *   npx tsx scripts/download-missing-starwars-images.ts
 *   npx tsx scripts/download-missing-starwars-images.ts --series SHD
 *   npx tsx scripts/download-missing-starwars-images.ts --dry-run
 *   npx tsx scripts/download-missing-starwars-images.ts --limit 50
 */

import puppeteer, { Page, Browser } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadStarWarsCardImage } from '../lib/supabase/storage'
import { STARWARS_ALL_SERIES, getSeriesByCode } from './config/starwars-series'
import * as fs from 'fs'

// Parse command line arguments
const args = process.argv.slice(2)
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || (args.includes('--series') ? args[args.indexOf('--series') + 1] : null)
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
  || (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null)
const dryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error')

const LIMIT = limitArg ? parseInt(limitArg) : null
const BASE_URL = 'https://www.swucards.fr'
const CARDS_PER_PAGE = 30

interface MissingCard {
  id: string
  number: string
  name: string
  language: string
  seriesId: string
  seriesCode: string
  seriesSlug: string
}

interface ProgressData {
  startedAt: string
  lastUpdated: string
  totalMissing: number
  processed: number
  success: number
  errors: number
  currentSeries: string
  processedCards: string[]  // card IDs that have been processed
}

const PROGRESS_FILE = 'scripts/logs/starwars-download-progress.json'

function loadProgress(): ProgressData | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
      return data
    }
  } catch (e) {
    // Ignore
  }
  return null
}

function saveProgress(progress: ProgressData) {
  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Téléchargement des images Star Wars manquantes')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification ne sera effectuée')
  }

  if (seriesFilter) {
    logger.info(`Filtre série: ${seriesFilter}`)
  }

  if (LIMIT) {
    logger.info(`Limite: ${LIMIT} cartes`)
  }

  // 1. Get Star Wars TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'starwars')
    .single()

  if (!tcg) {
    logger.error('TCG Star Wars non trouvé')
    process.exit(1)
  }

  // 2. Get all series
  let seriesQuery = supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)

  if (seriesFilter) {
    seriesQuery = seriesQuery.eq('code', seriesFilter.toUpperCase())
  }

  const { data: seriesList } = await seriesQuery

  if (!seriesList || seriesList.length === 0) {
    logger.error('Aucune série trouvée')
    process.exit(1)
  }

  logger.info(`${seriesList.length} série(s) à traiter`)

  // 3. Find all missing cards across all series
  logger.section('Analyse des images manquantes')

  const allMissingCards: MissingCard[] = []

  for (const series of seriesList) {
    const seriesConfig = getSeriesByCode(series.code)
    if (!seriesConfig) {
      logger.warn(`Configuration manquante pour ${series.code}, ignoré`)
      continue
    }

    // Get cards for this series (only FR for now)
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, name, language')
      .eq('series_id', series.id)
      .eq('language', 'FR')
      .order('number', { ascending: true })

    if (!cards || cards.length === 0) {
      logger.info(`${series.code}: 0 cartes en DB`)
      continue
    }

    // List images in storage
    const storagePath = `${series.code}/fr`
    const { data: storageFiles } = await supabase.storage
      .from('starwars-cards')
      .list(storagePath)

    const existingImages = new Set(
      (storageFiles || [])
        .filter(f => f.name.endsWith('.webp'))
        .map(f => f.name.replace('.webp', ''))
    )

    // Find missing cards
    const missingCards = cards.filter(card => {
      const paddedNumber = card.number.toString().padStart(3, '0')
      const rawNumber = card.number.toString()
      return !existingImages.has(paddedNumber) && !existingImages.has(rawNumber)
    })

    if (missingCards.length > 0) {
      logger.info(`${series.code}: ${missingCards.length}/${cards.length} cartes sans images`)

      for (const card of missingCards) {
        allMissingCards.push({
          id: card.id,
          number: card.number.toString(),
          name: card.name,
          language: 'fr',
          seriesId: series.id,
          seriesCode: series.code,
          seriesSlug: seriesConfig.slug
        })
      }
    } else {
      logger.success(`${series.code}: Toutes les ${cards.length} cartes ont des images ✓`)
    }
  }

  if (allMissingCards.length === 0) {
    logger.success('\nToutes les cartes ont des images!')
    process.exit(0)
  }

  logger.section(`${allMissingCards.length} cartes à télécharger`)

  // Check for existing progress
  const existingProgress = loadProgress()
  const processedCardIds = new Set(existingProgress?.processedCards || [])

  // Filter out already processed cards
  const cardsToProcess = allMissingCards.filter(c => !processedCardIds.has(c.id))

  if (cardsToProcess.length < allMissingCards.length) {
    logger.info(`${allMissingCards.length - cardsToProcess.length} cartes déjà traitées (reprise)`)
  }

  // Apply limit
  const finalCardsToProcess = LIMIT ? cardsToProcess.slice(0, LIMIT) : cardsToProcess

  logger.info(`${finalCardsToProcess.length} cartes à traiter`)

  if (dryRun) {
    // Group by series for display
    const bySeries = new Map<string, MissingCard[]>()
    for (const card of finalCardsToProcess) {
      if (!bySeries.has(card.seriesCode)) {
        bySeries.set(card.seriesCode, [])
      }
      bySeries.get(card.seriesCode)!.push(card)
    }

    for (const [seriesCode, cards] of bySeries) {
      const numbers = cards.map(c => parseInt(c.number)).sort((a, b) => a - b)
      const ranges = compressRanges(numbers)
      console.log(`\n${seriesCode}: ${cards.length} cartes`)
      console.log(`  Numéros: ${ranges}`)
    }

    logger.info('\nMode DRY RUN - fin du script')
    process.exit(0)
  }

  // Initialize progress
  const progress: ProgressData = {
    startedAt: existingProgress?.startedAt || new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    totalMissing: allMissingCards.length,
    processed: existingProgress?.processed || 0,
    success: existingProgress?.success || 0,
    errors: existingProgress?.errors || 0,
    currentSeries: '',
    processedCards: existingProgress?.processedCards || []
  }

  // 4. Launch browser
  logger.section('Téléchargement des images')
  logger.info('Lancement du navigateur...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // Group cards by series for efficient processing
  const cardsBySeries = new Map<string, MissingCard[]>()
  for (const card of finalCardsToProcess) {
    if (!cardsBySeries.has(card.seriesCode)) {
      cardsBySeries.set(card.seriesCode, [])
    }
    cardsBySeries.get(card.seriesCode)!.push(card)
  }

  let totalProcessed = 0
  let totalSuccess = 0
  let totalErrors = 0

  try {
    for (const [seriesCode, seriesCards] of cardsBySeries) {
      logger.section(`Série ${seriesCode} - ${seriesCards.length} cartes`)
      progress.currentSeries = seriesCode

      const seriesConfig = getSeriesByCode(seriesCode)!
      const seriesUrl = `${BASE_URL}/series/${seriesConfig.slug}`

      // Build a map of card URLs for this series
      const cardUrlMap = await buildCardUrlMap(page, seriesUrl, seriesCards)

      logger.info(`${cardUrlMap.size} URLs trouvées`)

      // Process each card
      for (const card of seriesCards) {
        const paddedNumber = card.number.padStart(3, '0')
        totalProcessed++

        logger.processing(`[${totalProcessed}/${finalCardsToProcess.length}] ${seriesCode} #${paddedNumber}: ${card.name}`)

        const cardUrl = cardUrlMap.get(paddedNumber)

        if (!cardUrl) {
          logger.warn(`  URL non trouvée`)
          totalErrors++
          progress.errors++
          progress.processedCards.push(card.id)
          saveProgress(progress)
          continue
        }

        try {
          // Navigate to card page and get image URL
          await page.goto(cardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await delay(1000)

          const imageUrl = await extractImageUrl(page)

          if (!imageUrl) {
            logger.warn(`  Image non trouvée sur la page`)
            totalErrors++
            progress.errors++
            progress.processedCards.push(card.id)
            saveProgress(progress)
            continue
          }

          // Upload to Supabase
          const uploadResult = await uploadStarWarsCardImage(
            imageUrl,
            paddedNumber,
            seriesCode,
            card.language
          )

          if (!uploadResult.success) {
            logger.error(`  Échec upload: ${JSON.stringify(uploadResult.error)}`)
            totalErrors++
            progress.errors++
            progress.processedCards.push(card.id)
            saveProgress(progress)

            if (!continueOnError) {
              throw new Error('Upload failed')
            }
            continue
          }

          // Update database
          const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: uploadResult.url })
            .eq('id', card.id)

          if (updateError) {
            logger.error(`  Échec mise à jour DB: ${updateError.message}`)
            totalErrors++
            progress.errors++
          } else {
            logger.success(`  ✓ OK`)
            totalSuccess++
            progress.success++
          }

          progress.processed++
          progress.processedCards.push(card.id)
          saveProgress(progress)

          await delay(1000) // Be nice to the server

        } catch (e: any) {
          logger.error(`  Erreur: ${e.message}`)
          totalErrors++
          progress.errors++
          progress.processedCards.push(card.id)
          saveProgress(progress)

          if (!continueOnError && e.message !== 'Upload failed') {
            throw e
          }
        }
      }
    }

  } finally {
    await browser.close()
  }

  // Final summary
  logger.section('Résumé final')
  console.log(`Total traité: ${totalProcessed}`)
  console.log(`Succès: ${totalSuccess}`)
  console.log(`Erreurs: ${totalErrors}`)
  console.log(`Taux de réussite: ${((totalSuccess / totalProcessed) * 100).toFixed(1)}%`)

  if (totalSuccess > 0) {
    logger.success(`\n${totalSuccess} images téléchargées avec succès!`)
  }

  // Clean up progress file if complete
  if (totalProcessed === finalCardsToProcess.length && totalErrors === 0) {
    fs.unlinkSync(PROGRESS_FILE)
    logger.info('Fichier de progression supprimé')
  }
}

/**
 * Build a map of card number -> URL by navigating through series pages
 */
async function buildCardUrlMap(
  page: Page,
  seriesUrl: string,
  targetCards: MissingCard[]
): Promise<Map<string, string>> {
  const cardUrls = new Map<string, string>()
  const targetNumbers = new Set(targetCards.map(c => c.number.padStart(3, '0')))

  try {
    await page.goto(seriesUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await delay(2000)

    // Get total pages
    const totalPages = await page.evaluate(() => {
      const pageLinks = document.querySelectorAll('.pagination .page-item .page-link[data-page]')
      let maxPage = 1
      pageLinks.forEach(link => {
        const pageNum = parseInt(link.getAttribute('data-page') || '0', 10)
        if (pageNum > maxPage) maxPage = pageNum
      })
      return maxPage
    })

    // Calculate which pages we need to visit
    const targetNums = [...targetNumbers].map(n => parseInt(n))
    const minTarget = Math.min(...targetNums)
    const maxTarget = Math.max(...targetNums)
    const startPage = Math.max(1, Math.ceil(minTarget / CARDS_PER_PAGE))
    const endPage = Math.min(totalPages, Math.ceil(maxTarget / CARDS_PER_PAGE) + 1)

    logger.info(`  Pages à scanner: ${startPage} à ${endPage} (sur ${totalPages})`)

    // Navigate to start page
    let currentPage = 1
    while (currentPage < startPage) {
      const nextPage = currentPage + 1
      const clicked = await clickPage(page, nextPage)
      if (clicked) {
        await delay(1500)
        currentPage = nextPage
      } else {
        break
      }
    }

    // Scan pages
    while (currentPage <= endPage && cardUrls.size < targetNumbers.size) {
      // Scroll to load all cards
      await autoScroll(page)
      await delay(500)

      // Extract card URLs
      // Two URL patterns exist:
      // 1. sorofr-001-252-c-... (series+lang without hyphen)
      // 2. shd-fr-001-262-c-... (series-lang with hyphen)
      const pageUrls = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        const results: { number: string; url: string }[] = []

        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
            // Pattern 1: sorofr-001-252-c-... (no hyphen between series and lang)
            let match = href.match(/\/cards\/[a-z]+(fr|en)-(\d{3})-\d+-[a-z]-/)
            if (match) {
              results.push({ number: match[2], url: href })
              return
            }
            // Pattern 2: shd-fr-001-262-c-... (hyphen between series and lang)
            match = href.match(/\/cards\/[a-z]+-[a-z]{2}-(\d{3})-\d+-[a-z]-/)
            if (match) {
              results.push({ number: match[1], url: href })
            }
          }
        })

        return results
      })

      for (const { number, url } of pageUrls) {
        if (targetNumbers.has(number) && !cardUrls.has(number)) {
          cardUrls.set(number, url)
        }
      }

      // Go to next page if needed
      if (currentPage < endPage && cardUrls.size < targetNumbers.size) {
        const clicked = await clickPage(page, currentPage + 1)
        if (clicked) {
          await delay(1500)
          currentPage++
        } else {
          break
        }
      } else {
        break
      }
    }

  } catch (e: any) {
    logger.warn(`  Erreur lors de la collecte des URLs: ${e.message}`)
  }

  return cardUrls
}

async function clickPage(page: Page, targetPage: number): Promise<boolean> {
  return await page.evaluate((target) => {
    const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
    for (const link of pageLinks) {
      const pageNum = link.getAttribute('data-page')
      const text = link.textContent?.trim()
      if (pageNum === target.toString() || text === target.toString()) {
        (link as HTMLElement).click()
        return true
      }
    }
    return false
  }, targetPage)
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0
      const distance = 300
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance
        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}

async function extractImageUrl(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    // Try JSON-LD first
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
    if (jsonLdScript) {
      try {
        const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
        if (jsonLd.image) {
          if (typeof jsonLd.image === 'string') return jsonLd.image
          if (jsonLd.image.contentUrl) return jsonLd.image.contentUrl
        }
      } catch (e) { }
    }

    // Try og:image
    const ogImage = document.querySelector('meta[property="og:image"]')
    if (ogImage) {
      const content = ogImage.getAttribute('content')
      if (content && !content.includes('back') && !content.includes('loader')) {
        return content
      }
    }

    // Try main image
    const mainImg = document.querySelector('img[src*="static.swucards.fr/cards"]')
    if (mainImg) {
      const src = mainImg.getAttribute('src')
      if (src && !src.includes('back') && !src.includes('loader')) {
        return src
      }
    }

    return null
  })
}

function compressRanges(numbers: number[]): string {
  if (numbers.length === 0) return ''

  const ranges: string[] = []
  let start = numbers[0]
  let end = numbers[0]

  for (let i = 1; i <= numbers.length; i++) {
    if (i < numbers.length && numbers[i] === end + 1) {
      end = numbers[i]
    } else {
      if (start === end) {
        ranges.push(`${start}`)
      } else {
        ranges.push(`${start}-${end}`)
      }
      if (i < numbers.length) {
        start = numbers[i]
        end = numbers[i]
      }
    }
  }

  // Limit output length
  if (ranges.length > 10) {
    return ranges.slice(0, 10).join(', ') + `... (${ranges.length - 10} de plus)`
  }

  return ranges.join(', ')
}

main().catch(e => {
  logger.error(`Erreur fatale: ${e.message}`)
  console.error(e)
  process.exit(1)
})
