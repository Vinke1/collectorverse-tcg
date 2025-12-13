/**
 * Download Starter Deck images (ST15-ST20, P, STP)
 *
 * These series contain reprints where the image URL uses the original series code
 * Example: ST15 contains OP03-007 Namur, image URL is:
 * https://static.opecards.fr/cards/fr/st15/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op03-007-c-namur.webp
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

const SERIES_SLUGS: Record<string, string> = {
  'ST15': 'st15-deck-pour-debutant-edward-newgate',
  'ST16': 'st16-deck-pour-debutant-uta',
  'ST17': 'st17-deck-pour-debutant-donquixote-doflamingo',
  'ST18': 'st18-deck-pour-debutant-monkey-d-luffy',
  'ST19': 'st19-deck-pour-debutant-smoker',
  'ST20': 'st20-deck-pour-debutant-charlotte-katakuri',
  'P': 'p-cartes-promotionnelles',
  'STP': 'stp-tournoi-boutique-promo',
}

interface CardInfo {
  id: string
  number: string
  name: string
  seriesCode: string
}

interface ScrapedCard {
  pageUrl: string
  imageUrl: string
  cardCode: string  // e.g., "op03-007" or "st15-001"
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
    .eq('language', 'FR')
    .order('number')

  if (!cards?.length) return []

  // Check storage
  const { data: storageFiles } = await supabase.storage
    .from('onepiece-cards')
    .list(`${seriesCode}/fr`, { limit: 500 })

  const existingImages = new Set(
    (storageFiles || [])
      .filter(f => f.name.endsWith('.webp'))
      .map(f => f.name.replace('.webp', ''))
  )

  return cards
    .filter(card => {
      const paddedNumber = card.number.toString().padStart(3, '0')
      return !existingImages.has(paddedNumber) && !existingImages.has(card.number.toString())
    })
    .map(card => ({
      id: card.id,
      number: card.number,
      name: card.name,
      seriesCode,
    }))
}

async function scrapeSeriesPage(page: Page, seriesCode: string): Promise<ScrapedCard[]> {
  const slug = SERIES_SLUGS[seriesCode]
  if (!slug) {
    logger.error(`Slug non trouvé pour ${seriesCode}`)
    return []
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

  const allCards: ScrapedCard[] = []
  let currentPage = 1

  while (currentPage <= totalPages) {
    // Extract card links from current page
    const pageCards = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      const results: { url: string; code: string }[] = []

      links.forEach(link => {
        const href = (link as HTMLAnchorElement).href
        if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
          // Extract card code from URL like /cards/op03-007-c-namur or /cards/st15-001-c-atmos
          const match = href.match(/\/cards\/([a-z0-9]+-\d{3})-[a-z]+-/)
          if (match) {
            results.push({ url: href, code: match[1] })
          }
        }
      })

      return results
    })

    for (const card of pageCards) {
      // Visit card page to get image URL
      await page.goto(card.url, { waitUntil: 'networkidle2', timeout: 30000 })
      await delay(1000)

      const imageUrl = await page.evaluate(() => {
        // Try JSON-LD first
        const jsonLd = document.querySelector('script[type="application/ld+json"]')
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd.textContent || '{}')
            if (data.image) {
              const images = Array.isArray(data.image) ? data.image : [data.image]
              const frImage = images.find((img: string) => img.includes('/fr/'))
              if (frImage) return frImage
            }
          } catch (e) {}
        }
        // Fallback to og:image
        const ogImage = document.querySelector('meta[property="og:image"]')
        return ogImage?.getAttribute('content') || null
      })

      if (imageUrl) {
        allCards.push({
          pageUrl: card.url,
          imageUrl,
          cardCode: card.code,
        })
      }
    }

    // Go to next page
    if (currentPage < totalPages) {
      await page.goto(`${url}?page=${currentPage + 1}`, { waitUntil: 'networkidle2', timeout: 30000 })
      await delay(1500)
    }
    currentPage++
  }

  return allCards
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

    // Upload to storage
    const paddedNumber = cardNumber.padStart(3, '0')
    const storagePath = `${seriesCode}/fr/${paddedNumber}.webp`

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

function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9]/g, '')  // Keep only alphanumeric
}

async function main() {
  logger.section('Téléchargement des images Starter Decks')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification')
  }

  const targetSeries = seriesFilter
    ? [seriesFilter.toUpperCase()]
    : ['ST15', 'ST16', 'ST17', 'ST18', 'ST19', 'ST20', 'P', 'STP']

  // Get all cards needing images
  const allCardsNeeding: CardInfo[] = []
  for (const code of targetSeries) {
    const cards = await getCardsNeedingImages(code)
    if (cards.length > 0) {
      logger.info(`${code}: ${cards.length} cartes manquantes`)
      allCardsNeeding.push(...cards)
    }
  }

  if (allCardsNeeding.length === 0) {
    logger.success('Toutes les cartes ont leurs images!')
    return
  }

  logger.info(`Total: ${allCardsNeeding.length} cartes à traiter`)

  if (dryRun) {
    for (const card of allCardsNeeding.slice(0, 20)) {
      logger.info(`  ${card.seriesCode} #${card.number}: ${card.name}`)
    }
    if (allCardsNeeding.length > 20) {
      logger.info(`  ... et ${allCardsNeeding.length - 20} de plus`)
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
    logger.section(`Série ${seriesCode} - ${cards.length} cartes`)

    // Scrape all cards from the series page
    const scrapedCards = await scrapeSeriesPage(page, seriesCode)
    logger.info(`${scrapedCards.length} cartes trouvées sur opecards.fr`)

    // Build a map by card number (extracted from code like op03-007 -> 007)
    const imageByNumber = new Map<string, string>()
    for (const sc of scrapedCards) {
      const match = sc.cardCode.match(/-(\d{3})$/)
      if (match) {
        imageByNumber.set(match[1], sc.imageUrl)
      }
    }

    // Also build a map by normalized name for fallback matching
    const imageByName = new Map<string, string>()
    for (const sc of scrapedCards) {
      // Extract name from URL: /cards/op03-007-c-namur -> namur
      const nameMatch = sc.pageUrl.match(/-([a-z0-9-]+)$/)
      if (nameMatch) {
        const normalizedUrl = nameMatch[1].replace(/-/g, '')
        imageByName.set(normalizedUrl, sc.imageUrl)
      }
    }

    // Process each card
    for (const card of cards) {
      const paddedNumber = card.number.toString().padStart(3, '0')
      logger.info(`[${success + errors + 1}/${allCardsNeeding.length}] ${seriesCode} #${paddedNumber}: ${card.name}`)

      // Try to find image by number first
      let imageUrl = imageByNumber.get(paddedNumber)

      // Fallback: try by normalized name
      if (!imageUrl) {
        const normalizedName = normalizeCardName(card.name)
        for (const [urlName, url] of imageByName) {
          if (urlName.includes(normalizedName) || normalizedName.includes(urlName)) {
            imageUrl = url
            break
          }
        }
      }

      if (!imageUrl) {
        logger.warn(`  Image non trouvée`)
        errors++
        continue
      }

      logger.info(`  URL: ${imageUrl.substring(0, 60)}...`)

      const ok = await downloadAndUpload(imageUrl, seriesCode, card.number)
      if (ok) {
        logger.success(`  OK`)
        success++
      } else {
        errors++
      }

      await delay(500)
    }
  }

  await browser.close()

  logger.section('Résumé')
  logger.info(`Succès: ${success}`)
  logger.info(`Erreurs: ${errors}`)
  logger.info(`Taux: ${((success / allCardsNeeding.length) * 100).toFixed(1)}%`)
}

main().catch(console.error)
