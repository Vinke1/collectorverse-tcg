/**
 * Download all missing One Piece Card Game images
 *
 * This script:
 * 1. Analyzes all One Piece series in the database
 * 2. Compares cards with images in Supabase storage
 * 3. Downloads missing images from opecards.fr
 * 4. Uploads them to Supabase storage
 * 5. Updates the card's image_url in the database
 *
 * Usage:
 *   npx tsx scripts/download-missing-onepiece-images.ts
 *   npx tsx scripts/download-missing-onepiece-images.ts --series OP13
 *   npx tsx scripts/download-missing-onepiece-images.ts --language fr
 *   npx tsx scripts/download-missing-onepiece-images.ts --dry-run
 *   npx tsx scripts/download-missing-onepiece-images.ts --limit 50
 */

import puppeteer, { Page, Browser } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'
import {
  ONEPIECE_ALL_SERIES,
  getSeriesByCode,
  isSeriesAvailableInLanguage,
  type OnePieceLanguage
} from './config/onepiece-series'
import * as fs from 'fs'

// Parse command line arguments
const args = process.argv.slice(2)
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || (args.includes('--series') ? args[args.indexOf('--series') + 1] : null)
const languageFilter = args.find(a => a.startsWith('--language='))?.split('=')[1]
  || (args.includes('--language') ? args[args.indexOf('--language') + 1] : null) as OnePieceLanguage | null
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
  || (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null)
const dryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error')

const LIMIT = limitArg ? parseInt(limitArg) : null
const BASE_URL = 'https://www.opecards.fr'
const CARDS_PER_PAGE = 24

interface MissingCard {
  id: string
  number: string
  name: string
  language: string
  seriesId: string
  seriesCode: string
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

const PROGRESS_FILE = 'scripts/logs/onepiece-download-progress.json'

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
  // Ensure logs directory exists
  const logsDir = 'scripts/logs'
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

/**
 * Build series slug from series code
 * Examples:
 * - OP13 -> op13-successeurs (need to fetch from config or database)
 * - ST21 -> st21-gear-5
 */
function getSeriesSlug(seriesCode: string, language: string): string {
  // Map of series codes to their slugs per language
  const slugMap: Record<string, Record<string, string>> = {
    // French slugs (verified from opecards.fr)
    'fr': {
      'OP13': 'op13-successeurs',
      'OP12': 'op12-l-heritage-du-maitre',
      'OP11': 'op11-des-poings-vifs-comme-l-eclair',
      'OP10': 'op10-sang-royal',
      'OP09': 'op09-les-nouveaux-empereurs',
      'OP08': 'op08-two-legends',
      'OP07': 'op07-500-years-in-the-future',
      'OP06': 'op06-wings-of-the-captain',
      'OP05': 'op05-awakening-of-the-new-era',
      'OP04': 'op04-kingdoms-of-intrigue',
      'OP03': 'op03-pillars-of-strength',
      'OP02': 'op02-paramount-war',
      'OP01': 'op01-romance-dawn',
      'ST22': 'st22-deck-de-demarrage-ace-et-newgate',
      'ST21': 'st21-deck-de-demarrage-ex-gear-5th',
      'ST20': 'st20-deck-pour-debutant-charlotte-katakuri',
      'ST19': 'st19-deck-pour-debutant-smoker',
      'ST18': 'st18-deck-pour-debutant-monkey-d-luffy',
      'ST17': 'st17-deck-pour-debutant-donquixote-doflamingo',
      'ST16': 'st16-deck-pour-debutant-uta',
      'ST15': 'st15-deck-pour-debutant-edward-newgate',
      'ST14': 'st14-3d2y',
      'ST13': 'st13-ultra-deck-the-three-brothers',
      'ST12': 'st12-zoro-sanji',
      'ST11': 'st11-uta',
      'ST10': 'st10-ultra-deck-the-three-captains',
      'ST09': 'st09-yamato',
      'ST08': 'st08-monkey-d-luffy',
      'ST07': 'st07-big-mom-pirates',
      'ST06': 'st06-navy',
      'ST05': 'st05-one-piece-film-edition',
      'ST04': 'st04-animal-kingdom-pirates',
      'ST03': 'st03-the-seven-warlords-of-the-sea',
      'ST02': 'st02-worst-generation',
      'ST01': 'st01-straw-hat-crew',
      'PRB01': 'prb01-one-piece-card-the-best-fr',
      'PRB02': 'prb02-fr-one-piece-card-the-best-volume-2',
      'EB01': 'eb01-memorial-collection',
      'EB02': 'eb02-anime-25th-collection',
      'P': 'p-cartes-promotionnelles',
      'STP': 'stp-tournoi-boutique-promo',
    },
    // English slugs (use prefix en-)
    'en': {
      'OP13': 'en-op13-successors',
      'OP12': 'en-op12-master-s-legacy',
      'OP11': 'en-op11-endless-dream',
      'OP10': 'en-op10-royal-blood',
      'OP09': 'en-op09-the-four-emperors',
      'OP08': 'en-op08-two-legends',
      'OP07': 'en-op07-500-years-in-the-future',
      'OP06': 'en-op06-wings-of-the-captain',
      'OP05': 'en-op05-awakening-of-the-new-era',
      'OP04': 'en-op04-kingdoms-of-intrigue',
      'OP03': 'en-op03-pillars-of-strength',
      'OP02': 'en-op02-paramount-war',
      'OP01': 'en-op01-romance-dawn',
      'ST21': 'en-st21-starter-deck-gear-5',
      'ST22': 'en-st22-starter-deck-ace-newgate',
      'ST20': 'en-st20-starter-deck-yellow-charlotte-katakuri',
      'ST19': 'en-st19-starter-deck-black-smoker',
      'ST18': 'en-st18-starter-deck-purple-monkey-d-luffy',
      'ST17': 'en-st17-starter-deck-blue-donquixote-doflamingo',
      'ST16': 'en-st16-starter-deck-green-uta',
      'ST15': 'en-st15-starter-deck-red-edward-newgate',
      'ST14': 'en-st14-3d2y',
      'ST13': 'en-st13-ultra-deck-the-three-brothers',
      'ST12': 'en-st12-zoro-sanji',
      'ST11': 'en-st11-uta',
      'ST10': 'en-st10-ultra-deck-the-three-captains',
      'ST09': 'en-st09-yamato',
      'ST08': 'en-st08-monkey-d-luffy',
      'ST07': 'en-st07-big-mom-pirates',
      'ST06': 'en-st06-navy',
      'ST05': 'en-st05-one-piece-film-edition',
      'ST04': 'en-st04-animal-kingdom-pirates',
      'ST03': 'en-st03-the-seven-warlords-of-the-sea',
      'ST02': 'en-st02-worst-generation',
      'ST01': 'en-st01-straw-hat-crew',
      'PRB01': 'en-prb01-one-piece-card-the-best',
      'PRB02': 'en-prb02-one-piece-card-the-best-vol-2',
      'EB01': 'en-eb01-memorial-collection',
      'EB02': 'en-eb02-anime-25th-collection',
      'P': 'en-p-promo-cards',
      'STP': 'en-stp-tournament-shop-promo',
    },
    // Japanese slugs (use prefix jp-)
    'jp': {
      'OP01': 'jp-op01-romance-dawn',
      'OP02': 'jp-op02-paramount-war',
      'OP03': 'jp-op03-pillars-of-strength',
      'OP04': 'jp-op04-kingdoms-of-intrigue',
      'OP05': 'jp-op05-awakening-of-the-new-era',
      'OP06': 'jp-op06-wings-of-the-captain',
      'OP07': 'jp-op07-500-years-in-the-future',
      'OP08': 'jp-op08-two-legends',
      'OP09': 'jp-op09-the-four-emperors',
      'OP10': 'jp-op10-royal-blood',
      'OP11': 'jp-op11-endless-dream',
      'OP12': 'jp-op12-master-s-legacy',
      'OP13': 'jp-op13-successors',
      'ST01': 'jp-st01-straw-hat-crew',
      'ST02': 'jp-st02-worst-generation',
      'ST03': 'jp-st03-the-seven-warlords-of-the-sea',
      'ST04': 'jp-st04-animal-kingdom-pirates',
      'P': 'jp-p-promo-cards',
    },
  }

  const langSlugs = slugMap[language] || slugMap['fr']
  return langSlugs[seriesCode.toUpperCase()] || `${seriesCode.toLowerCase()}`
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Telechargement des images One Piece manquantes')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification ne sera effectuee')
  }

  if (seriesFilter) {
    logger.info(`Filtre serie: ${seriesFilter}`)
  }

  if (languageFilter) {
    logger.info(`Filtre langue: ${languageFilter}`)
  }

  if (LIMIT) {
    logger.info(`Limite: ${LIMIT} cartes`)
  }

  // 1. Get One Piece TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouve')
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
    logger.error('Aucune serie trouvee')
    process.exit(1)
  }

  logger.info(`${seriesList.length} serie(s) a traiter`)

  // 3. Find all missing cards across all series
  logger.section('Analyse des images manquantes')

  const allMissingCards: MissingCard[] = []
  const languagesToCheck: OnePieceLanguage[] = languageFilter
    ? [languageFilter as OnePieceLanguage]
    : ['fr', 'en', 'jp']

  for (const series of seriesList) {
    const seriesConfig = getSeriesByCode(series.code)
    if (!seriesConfig) {
      logger.warn(`Configuration manquante pour ${series.code}, ignore`)
      continue
    }

    // Skip PRB01/PRB02 - these are "Best Of" compilations with reprints
    // Their URLs are based on original series (op01, op02...) not prb01/prb02
    if (series.code === 'PRB01' || series.code === 'PRB02') {
      logger.warn(`${series.code}: Serie "Best Of" avec reprints - necessite traitement special, ignore`)
      continue
    }

    for (const language of languagesToCheck) {
      // Check if series is available in this language
      if (!isSeriesAvailableInLanguage(series.code, language)) {
        continue
      }

      // Get cards for this series and language
      const { data: cards } = await supabase
        .from('cards')
        .select('id, number, name, language')
        .eq('series_id', series.id)
        .eq('language', language.toUpperCase())
        .order('number', { ascending: true })

      if (!cards || cards.length === 0) {
        continue
      }

      // List images in storage (increase limit to handle large series)
      const storagePath = `${series.code}/${language}`
      const { data: storageFiles } = await supabase.storage
        .from('onepiece-cards')
        .list(storagePath, { limit: 500 })

      const existingImages = new Set(
        (storageFiles || [])
          .filter(f => f.name.endsWith('.webp'))
          .map(f => f.name.replace('.webp', ''))
      )

      // Find missing cards (exclude special cards like -PR, -ALT, -TR for now)
      const missingCards = cards.filter(card => {
        const cardNumber = card.number.toString()
        const paddedNumber = cardNumber.padStart(3, '0')

        // Skip special cards (parallels, alt art, treasure rare)
        // These have URLs based on their ORIGINAL series, not the current series
        if (cardNumber.includes('-PR') || cardNumber.includes('-ALT') ||
            cardNumber.includes('-TR') || cardNumber.includes('-SP')) {
          return false
        }

        return !existingImages.has(paddedNumber) && !existingImages.has(cardNumber)
      })

      if (missingCards.length > 0) {
        logger.info(`${series.code} (${language}): ${missingCards.length}/${cards.length} cartes sans images`)

        for (const card of missingCards) {
          allMissingCards.push({
            id: card.id,
            number: card.number.toString(),
            name: card.name,
            language: language,
            seriesId: series.id,
            seriesCode: series.code,
          })
        }
      } else if (cards.length > 0) {
        logger.success(`${series.code} (${language}): Toutes les ${cards.length} cartes ont des images`)
      }
    }
  }

  if (allMissingCards.length === 0) {
    logger.success('\nToutes les cartes ont des images!')
    process.exit(0)
  }

  logger.section(`${allMissingCards.length} cartes a telecharger`)

  // Check for existing progress
  const existingProgress = loadProgress()
  const processedCardIds = new Set(existingProgress?.processedCards || [])

  // Filter out already processed cards
  const cardsToProcess = allMissingCards.filter(c => !processedCardIds.has(c.id))

  if (cardsToProcess.length < allMissingCards.length) {
    logger.info(`${allMissingCards.length - cardsToProcess.length} cartes deja traitees (reprise)`)
  }

  // Apply limit
  const finalCardsToProcess = LIMIT ? cardsToProcess.slice(0, LIMIT) : cardsToProcess

  logger.info(`${finalCardsToProcess.length} cartes a traiter`)

  if (dryRun) {
    // Group by series and language for display
    const bySeries = new Map<string, MissingCard[]>()
    for (const card of finalCardsToProcess) {
      const key = `${card.seriesCode}-${card.language}`
      if (!bySeries.has(key)) {
        bySeries.set(key, [])
      }
      bySeries.get(key)!.push(card)
    }

    for (const [key, cards] of bySeries) {
      const numbers = cards.map(c => parseInt(c.number)).sort((a, b) => a - b)
      const ranges = compressRanges(numbers)
      console.log(`\n${key}: ${cards.length} cartes`)
      console.log(`  Numeros: ${ranges}`)
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
  logger.section('Telechargement des images')
  logger.info('Lancement du navigateur...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // Group cards by series and language for efficient processing
  const cardsBySeries = new Map<string, MissingCard[]>()
  for (const card of finalCardsToProcess) {
    const key = `${card.seriesCode}-${card.language}`
    if (!cardsBySeries.has(key)) {
      cardsBySeries.set(key, [])
    }
    cardsBySeries.get(key)!.push(card)
  }

  let totalProcessed = 0
  let totalSuccess = 0
  let totalErrors = 0

  try {
    for (const [key, seriesCards] of cardsBySeries) {
      const [seriesCode, language] = key.split('-')
      logger.section(`Serie ${seriesCode} (${language}) - ${seriesCards.length} cartes`)
      progress.currentSeries = key

      const seriesSlug = getSeriesSlug(seriesCode, language)
      const seriesUrl = `${BASE_URL}/series/${seriesSlug}`

      // Build a map of card URLs for this series
      const cardUrlMap = await buildCardUrlMap(page, seriesUrl, seriesCards, seriesCode)

      logger.info(`${cardUrlMap.size} URLs trouvees`)

      // Process each card
      for (const card of seriesCards) {
        const paddedNumber = card.number.padStart(3, '0')
        totalProcessed++

        logger.processing(`[${totalProcessed}/${finalCardsToProcess.length}] ${seriesCode} #${paddedNumber}: ${card.name}`)

        const cardUrl = cardUrlMap.get(paddedNumber)

        if (!cardUrl) {
          logger.warn(`  URL non trouvee`)
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

          const imageUrl = await extractImageUrl(page, language)

          if (!imageUrl) {
            logger.warn(`  Image non trouvee sur la page`)
            totalErrors++
            progress.errors++
            progress.processedCards.push(card.id)
            saveProgress(progress)
            continue
          }

          // Upload to Supabase
          const uploadResult = await uploadOnePieceCardImage(
            imageUrl,
            paddedNumber,
            seriesCode,
            language
          )

          if (!uploadResult.success) {
            logger.error(`  Echec upload: ${JSON.stringify(uploadResult.error)}`)
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
            logger.error(`  Echec mise a jour DB: ${updateError.message}`)
            totalErrors++
            progress.errors++
          } else {
            logger.success(`  OK`)
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
  logger.section('Resume final')
  console.log(`Total traite: ${totalProcessed}`)
  console.log(`Succes: ${totalSuccess}`)
  console.log(`Erreurs: ${totalErrors}`)
  console.log(`Taux de reussite: ${((totalSuccess / totalProcessed) * 100).toFixed(1)}%`)

  if (totalSuccess > 0) {
    logger.success(`\n${totalSuccess} images telechargees avec succes!`)
  }

  // Clean up progress file if complete
  if (totalProcessed === finalCardsToProcess.length && totalErrors === 0) {
    try {
      fs.unlinkSync(PROGRESS_FILE)
      logger.info('Fichier de progression supprime')
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Build a map of card number -> URL by navigating through series pages
 */
async function buildCardUrlMap(
  page: Page,
  seriesUrl: string,
  targetCards: MissingCard[],
  seriesCode: string
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

    logger.info(`  Pages a scanner: ${startPage} a ${endPage} (sur ${totalPages})`)

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
      // Pattern: /cards/op13-001-l-monkey-d-luffy
      const codePattern = seriesCode.toLowerCase()
      const pageUrls = await page.evaluate((pattern: string) => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        const results: { number: string; url: string }[] = []

        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
            // Pattern: /cards/op13-001-l-... or /cards/st21-001-c-...
            // Extract the number (3 digits after series code)
            const regex = new RegExp(`/cards/${pattern}-(\\d{3})-[a-z]+-`)
            const match = href.match(regex)
            if (match) {
              results.push({ number: match[1], url: href })
            }
          }
        })

        return results
      }, codePattern)

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

async function extractImageUrl(page: Page, language: string): Promise<string | null> {
  return await page.evaluate((lang: string) => {
    // Try JSON-LD first
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
    if (jsonLdScript) {
      try {
        const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
        if (jsonLd.image) {
          // Check if image is an array with language-specific images
          if (Array.isArray(jsonLd.image)) {
            // Find image matching the language
            for (const img of jsonLd.image) {
              if (img.contentUrl && img.contentUrl.includes(`/${lang}/`)) {
                return img.contentUrl
              }
            }
            // Fallback to first image
            if (jsonLd.image[0]?.contentUrl) {
              return jsonLd.image[0].contentUrl
            }
          }
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
    const mainImg = document.querySelector(`img[src*="static.opecards.fr/cards/${lang}"]`)
    if (mainImg) {
      const src = mainImg.getAttribute('src')
      if (src && !src.includes('back') && !src.includes('loader')) {
        return src
      }
    }

    // Fallback: any card image
    const anyCardImg = document.querySelector('img[src*="static.opecards.fr/cards"]')
    if (anyCardImg) {
      const src = anyCardImg.getAttribute('src')
      if (src && !src.includes('back') && !src.includes('loader')) {
        return src
      }
    }

    return null
  }, language)
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
