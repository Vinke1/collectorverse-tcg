/**
 * Download missing One Piece images - English version
 *
 * Usage:
 *   npx tsx scripts/download-missing-images-en.ts --dry-run
 *   npx tsx scripts/download-missing-images-en.ts --series OP13
 *   npx tsx scripts/download-missing-images-en.ts
 */

import puppeteer, { Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'

const supabase = createAdminClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || (args.includes('--series') ? args[args.indexOf('--series') + 1] : null)

// English series slugs on opecards.fr
const EN_SERIES_SLUGS: Record<string, string> = {
  // Boosters
  'OP01': 'en-op01-romance-dawn',
  'OP02': 'en-op02-paramount-war',
  'OP03': 'en-op03-pillars-of-strength',
  'OP04': 'en-op04-kingdoms-of-intrigue',
  'OP05': 'en-op05-awakening-of-the-new-era',
  'OP06': 'en-op06-wings-of-the-captain',
  'OP07': 'en-op07-500-years-in-the-future',
  'OP08': 'en-op08-two-legends',
  'OP09': 'en-op09-the-four-emperors',
  'OP10': 'en-op10-royal-blood',
  'OP11': 'en-op11-endless-dream',
  'OP12': 'en-op12-master-s-legacy',
  'OP13': 'en-op13-successors',
  // Starter Decks
  'ST01': 'en-st01-straw-hat-crew',
  'ST02': 'en-st02-worst-generation',
  'ST03': 'en-st03-the-seven-warlords-of-the-sea',
  'ST04': 'en-st04-animal-kingdom-pirates',
  'ST05': 'en-st05-one-piece-film-edition',
  'ST06': 'en-st06-navy',
  'ST07': 'en-st07-big-mom-pirates',
  'ST08': 'en-st08-monkey-d-luffy',
  'ST09': 'en-st09-yamato',
  'ST10': 'en-st10-ultra-deck-the-three-captains',
  'ST11': 'en-st11-uta',
  'ST12': 'en-st12-zoro-sanji',
  'ST13': 'en-st13-ultra-deck-the-three-brothers',
  'ST14': 'en-st14-3d2y',
  'ST15': 'en-st15-starter-deck-red-edward-newgate',
  'ST16': 'en-st16-starter-deck-green-uta',
  'ST17': 'en-st17-starter-deck-blue-donquixote-doflamingo',
  'ST18': 'en-st18-starter-deck-purple-monkey-d-luffy',
  'ST19': 'en-st19-starter-deck-black-smoker',
  'ST20': 'en-st20-starter-deck-yellow-charlotte-katakuri',
  'ST21': 'en-st21-starter-deck-gear-5',
  'ST22': 'en-st22-starter-deck-ace-newgate',
  // Extra Boosters
  'EB01': 'en-eb01-memorial-collection',
  'EB02': 'en-eb02-anime-25th-collection',
  // Promos
  'P': 'en-p-promo-cards',
  'STP': 'en-stp-tournament-shop-promo',
  'PRB01': 'en-prb01-one-piece-card-the-best',
  'PRB02': 'en-prb02-one-piece-card-the-best-vol-2',
}

interface CardInfo {
  id: string
  number: string
  name: string
  seriesCode: string
}

async function getAllSeriesWithEnglishCards(): Promise<string[]> {
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) return []

  const { data: series } = await supabase
    .from('series')
    .select('code')
    .eq('tcg_game_id', tcg.id)

  if (!series) return []

  // Filter to only series that have English cards and a slug
  const seriesWithEn: string[] = []
  for (const s of series) {
    if (!EN_SERIES_SLUGS[s.code]) continue

    const { data: cards } = await supabase
      .from('cards')
      .select('id')
      .eq('language', 'EN')
      .limit(1)

    // Check if series has any EN cards by joining
    const { data: seriesData } = await supabase
      .from('series')
      .select('id')
      .eq('code', s.code)
      .single()

    if (seriesData) {
      const { count } = await supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('series_id', seriesData.id)
        .eq('language', 'EN')

      if (count && count > 0) {
        seriesWithEn.push(s.code)
      }
    }
  }

  return seriesWithEn
}

async function getCardsNeedingImages(seriesCode: string): Promise<CardInfo[]> {
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('code', seriesCode)
    .single()

  if (!series) return []

  const { data: cards } = await supabase
    .from('cards')
    .select('id, number, name')
    .eq('series_id', series.id)
    .eq('language', 'EN')
    .order('number')

  if (!cards?.length) return []

  // Check storage for English images
  const { data: storageFiles } = await supabase.storage
    .from('onepiece-cards')
    .list(`${seriesCode}/en`, { limit: 500 })

  const existingImages = new Set(
    (storageFiles || [])
      .filter(f => f.name.endsWith('.webp'))
      .map(f => f.name.replace('.webp', ''))
  )

  return cards
    .filter(card => {
      const paddedNumber = card.number.toString().padStart(3, '0')
      // Skip special variants
      if (card.number.includes('-') || card.number.includes('/')) return false
      return !existingImages.has(paddedNumber) && !existingImages.has(card.number.toString())
    })
    .map(card => ({
      id: card.id,
      number: card.number,
      name: card.name,
      seriesCode,
    }))
}

async function scrapeSeriesPage(page: Page, seriesCode: string): Promise<Map<string, string>> {
  const slug = EN_SERIES_SLUGS[seriesCode]
  if (!slug) {
    logger.error(`Slug EN non trouvé pour ${seriesCode}`)
    return new Map()
  }

  const url = `https://www.opecards.fr/series/${slug}`
  logger.info(`Scraping ${url}`)

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
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

  logger.info(`${totalPages} page(s) à scanner`)

  const imageByNumber = new Map<string, string>()
  let currentPage = 1

  while (currentPage <= totalPages) {
    // Extract card links from current page
    const cardLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      const results: string[] = []
      links.forEach(link => {
        const href = (link as HTMLAnchorElement).href
        if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
          results.push(href)
        }
      })
      return [...new Set(results)]
    })

    // Visit each card page to get image URL
    for (const cardUrl of cardLinks) {
      try {
        await page.goto(cardUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        await delay(800)

        const cardData = await page.evaluate(() => {
          // Get card number from URL or page
          const url = window.location.href
          // Pattern: /cards/en-op13-001-l-monkey-d-luffy or /cards/op13en-001-l-...
          const match = url.match(/(\d{3})-[a-z]+-/)
          const number = match ? match[1] : null

          // Get image URL from JSON-LD
          const jsonLd = document.querySelector('script[type="application/ld+json"]')
          let imageUrl = null
          if (jsonLd) {
            try {
              const data = JSON.parse(jsonLd.textContent || '{}')
              if (data.image) {
                const images = Array.isArray(data.image) ? data.image : [data.image]
                // Find English image
                imageUrl = images.find((img: string) => img.includes('/en/')) || images[0]
              }
            } catch (e) {}
          }

          // Fallback to og:image
          if (!imageUrl) {
            const ogImage = document.querySelector('meta[property="og:image"]')
            imageUrl = ogImage?.getAttribute('content') || null
          }

          return { number, imageUrl }
        })

        if (cardData.number && cardData.imageUrl) {
          imageByNumber.set(cardData.number, cardData.imageUrl)
        }
      } catch (e) {
        // Continue on error
      }
    }

    // Go to next page
    if (currentPage < totalPages) {
      const baseUrl = `https://www.opecards.fr/series/${slug}`
      await page.goto(`${baseUrl}?page=${currentPage + 1}`, { waitUntil: 'networkidle2', timeout: 30000 })
      await delay(1500)
    }
    currentPage++
  }

  return imageByNumber
}

async function downloadAndUpload(
  imageUrl: string,
  seriesCode: string,
  cardNumber: string
): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.opecards.fr/',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimize with Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    // Upload to storage (en folder)
    const paddedNumber = cardNumber.padStart(3, '0')
    const storagePath = `${seriesCode}/en/${paddedNumber}.webp`

    const { error } = await supabase.storage
      .from('onepiece-cards')
      .upload(storagePath, optimized, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      throw new Error(error.message)
    }

    return true
  } catch (error) {
    logger.error(`Erreur: ${(error as Error).message}`)
    return false
  }
}

async function main() {
  logger.section('Téléchargement des images One Piece EN manquantes')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification')
  }

  // Determine which series to process
  let targetSeries: string[]
  if (seriesFilter) {
    targetSeries = [seriesFilter.toUpperCase()]
  } else {
    targetSeries = await getAllSeriesWithEnglishCards()
  }

  logger.info(`${targetSeries.length} série(s) à vérifier`)

  // Get all cards needing images
  const allCardsNeeding: CardInfo[] = []
  for (const code of targetSeries) {
    if (!EN_SERIES_SLUGS[code]) {
      logger.warn(`${code}: pas de slug EN configuré`)
      continue
    }

    const cards = await getCardsNeedingImages(code)
    if (cards.length > 0) {
      logger.info(`${code}: ${cards.length} cartes EN manquantes`)
      allCardsNeeding.push(...cards)
    } else {
      logger.success(`${code}: toutes les cartes EN ont leurs images`)
    }
  }

  if (allCardsNeeding.length === 0) {
    logger.success('Toutes les cartes EN ont leurs images!')
    return
  }

  logger.info(`Total: ${allCardsNeeding.length} cartes EN à traiter`)

  if (dryRun) {
    // Group by series for display
    const bySeries = new Map<string, CardInfo[]>()
    for (const card of allCardsNeeding) {
      if (!bySeries.has(card.seriesCode)) {
        bySeries.set(card.seriesCode, [])
      }
      bySeries.get(card.seriesCode)!.push(card)
    }

    for (const [code, cards] of bySeries) {
      const numbers = cards.map(c => c.number).slice(0, 10).join(', ')
      const more = cards.length > 10 ? ` ... +${cards.length - 10}` : ''
      logger.info(`  ${code}: ${cards.length} cartes (${numbers}${more})`)
    }
    return
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  let success = 0
  let errors = 0

  // Group cards by series
  const cardsBySeries = new Map<string, CardInfo[]>()
  for (const card of allCardsNeeding) {
    if (!cardsBySeries.has(card.seriesCode)) {
      cardsBySeries.set(card.seriesCode, [])
    }
    cardsBySeries.get(card.seriesCode)!.push(card)
  }

  for (const [seriesCode, cards] of cardsBySeries) {
    logger.section(`Série ${seriesCode} EN - ${cards.length} cartes`)

    // Scrape all card images from the series page
    const imageByNumber = await scrapeSeriesPage(page, seriesCode)
    logger.info(`${imageByNumber.size} images trouvées sur opecards.fr`)

    // Process each card
    for (const card of cards) {
      const paddedNumber = card.number.toString().padStart(3, '0')
      logger.info(`[${success + errors + 1}/${allCardsNeeding.length}] ${seriesCode} EN #${paddedNumber}: ${card.name}`)

      const imageUrl = imageByNumber.get(paddedNumber)

      if (!imageUrl) {
        logger.warn(`  Image non trouvée`)
        errors++
        continue
      }

      const ok = await downloadAndUpload(imageUrl, seriesCode, card.number)
      if (ok) {
        logger.success(`  OK`)
        success++
      } else {
        errors++
      }

      await delay(300)
    }
  }

  await browser.close()

  logger.section('Résumé')
  logger.info(`Succès: ${success}`)
  logger.info(`Erreurs: ${errors}`)
  if (allCardsNeeding.length > 0) {
    logger.info(`Taux: ${((success / allCardsNeeding.length) * 100).toFixed(1)}%`)
  }
}

main().catch(console.error)
