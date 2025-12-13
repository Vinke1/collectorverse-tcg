/**
 * Fix Starter Deck images (ST15-ST20)
 *
 * These decks contain reprints with their original numbers.
 * For example, ST16 contains P-029, P-057, etc. as reprints.
 *
 * This script:
 * 1. Identifies cards with missing images in ST15-ST20
 * 2. Determines their original series based on the number prefix
 * 3. Downloads images from the original series page
 */

import puppeteer, { Page, Browser } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'

const supabase = createAdminClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]

interface CardToFix {
  id: string
  number: string          // Number stored in DB (e.g., "29" or "OP02-008")
  name: string
  language: string
  seriesCode: string      // Parent series (e.g., "ST16")
  originalSeries: string  // Original series for the reprint (e.g., "P" or "OP02")
  originalNumber: string  // Number in original series (e.g., "029")
}

// Mapping of DB numbers to their original series for ST15-ST20 reprints
const REPRINT_MAPPINGS: Record<string, Record<string, { series: string, number: string }>> = {
  'ST15': {
    // ST15 has reprints from OP02, OP03
    '7': { series: 'OP02', number: '008' },   // Joz
    '8': { series: 'OP02', number: '018' },   // Marco
    '9': { series: 'OP02', number: '019' },   // Rakuyo
    '10': { series: 'OP02', number: '023' },  // Event
    '18': { series: 'OP03', number: '003' },  // Izo
    '19': { series: 'OP03', number: '006' },  // Speed Jill
    '23': { series: 'OP03', number: '010' },  // Fossa
  },
  'ST16': {
    // ST16 has reprints from ST11 and P (promos)
    '29': { series: 'P', number: '029' },     // Bartolomeo
    '57': { series: 'P', number: '057' },     // Berceuse éphémère
    '58': { series: 'P', number: '058' },     // Où souffle le vent
    '59': { series: 'P', number: '059' },     // Le monde continue
    '60': { series: 'P', number: '060' },     // Tot Musica
    '61': { series: 'P', number: '061' },     // Monkey D. Luffy
  },
  'ST17': {
    // ST17 - Doflamingo deck
    '8': { series: 'OP04', number: '024' },
    '30': { series: 'OP04', number: '031' },
    '54': { series: 'OP04', number: '042' },
    '57': { series: 'OP04', number: '044' },
    '60': { series: 'OP04', number: '047' },
    '73': { series: 'OP04', number: '058' },
    '86': { series: 'OP04', number: '070' },
  },
  'ST18': {
    // ST18 - Luffy deck (reprints from OP01, OP05, etc.)
    '41': { series: 'OP01', number: '016' },
    '60': { series: 'OP01', number: '022' },
    '61': { series: 'OP01', number: '024' },
    '63': { series: 'OP01', number: '025' },
    '66': { series: 'OP01', number: '028' },
    '67': { series: 'OP01', number: '029' },
    '68': { series: 'OP01', number: '030' },
    '70': { series: 'OP01', number: '031' },
    '72': { series: 'OP01', number: '033' },
    '76': { series: 'OP01', number: '046' },
  },
  'ST19': {
    // ST19 - Smoker deck
    '79': { series: 'OP06', number: '041' },
    '89': { series: 'OP06', number: '050' },
    '93': { series: 'OP06', number: '055' },
    '98': { series: 'OP06', number: '058' },
    '106': { series: 'OP06', number: '069' },
    '108': { series: 'OP06', number: '073' },
    '109': { series: 'OP06', number: '074' },
    '113': { series: 'OP06', number: '077' },
    '116': { series: 'OP06', number: '092' },
    '117': { series: 'OP06', number: '093' },
  },
  'ST20': {
    // ST20 - Katakuri deck
    '14': { series: 'OP03', number: '089' },
    '99': { series: 'OP07', number: '089' },
    '106': { series: 'OP07', number: '096' },
    '107': { series: 'OP07', number: '097' },
    '110': { series: 'OP07', number: '100' },
    '112': { series: 'OP07', number: '104' },
    '115': { series: 'OP07', number: '108' },
    '118': { series: 'OP07', number: '111' },
    '121': { series: 'OP07', number: '117' },
  },
}

// Series slugs for opecards.fr
const SERIES_SLUGS: Record<string, string> = {
  'OP01': 'op01-romance-dawn',
  'OP02': 'op02-paramount-war',
  'OP03': 'op03-pillars-of-strength',
  'OP04': 'op04-kingdoms-of-intrigue',
  'OP05': 'op05-awakening-of-the-new-era',
  'OP06': 'op06-wings-of-the-captain',
  'OP07': 'op07-500-years-in-the-future',
  'P': 'p-cartes-promotionnelles',
  'ST11': 'st11-uta',
}

async function getMissingCards(): Promise<CardToFix[]> {
  const starterDecks = ['ST15', 'ST16', 'ST17', 'ST18', 'ST19', 'ST20']
  const cardsToFix: CardToFix[] = []

  for (const deckCode of starterDecks) {
    if (seriesFilter && deckCode !== seriesFilter) continue

    // Get series ID
    const { data: series } = await supabase
      .from('series')
      .select('id')
      .eq('code', deckCode)
      .single()

    if (!series) continue

    // Get all cards for this series in French
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, name, language')
      .eq('series_id', series.id)
      .eq('language', 'FR')
      .order('number')

    if (!cards?.length) continue

    // Check which cards are missing from storage
    const storagePath = `${deckCode}/fr`
    const { data: storageFiles } = await supabase.storage
      .from('onepiece-cards')
      .list(storagePath)

    const existingImages = new Set(
      (storageFiles || [])
        .filter(f => f.name.endsWith('.webp'))
        .map(f => f.name.replace('.webp', ''))
    )

    // Find cards missing from storage
    const missingCards = cards.filter(card => {
      const paddedNumber = card.number.toString().padStart(3, '0')
      return !existingImages.has(paddedNumber) && !existingImages.has(card.number.toString())
    })

    if (!missingCards.length) continue

    logger.info(`${deckCode}: ${missingCards.length} cartes manquantes dans le storage`)
    for (const card of missingCards) {
      // Try to find mapping for this card number
      const cardNum = card.number.replace(/^0+/, '') // Remove leading zeros
      const mapping = REPRINT_MAPPINGS[deckCode]?.[cardNum]
        || REPRINT_MAPPINGS[deckCode]?.[card.number]
        || REPRINT_MAPPINGS[deckCode]?.[card.number.padStart(3, '0')]

      if (mapping) {
        cardsToFix.push({
          id: card.id,
          number: card.number,
          name: card.name,
          language: card.language,
          seriesCode: deckCode,
          originalSeries: mapping.series,
          originalNumber: mapping.number,
        })
      } else {
        logger.warn(`${deckCode} #${card.number} (${card.name}): pas de mapping trouvé`)
      }
    }
  }

  return cardsToFix
}

async function findCardImageUrl(
  page: Page,
  seriesSlug: string,
  cardNumber: string,
  seriesCode: string
): Promise<string | null> {
  const baseUrl = `https://www.opecards.fr/series/${seriesSlug}`

  // For promo series P, cards can be on any page - scan all pages
  const cardNum = parseInt(cardNumber)
  let targetPage = Math.ceil(cardNum / 24)

  // P series has many pages, start from a reasonable estimate
  if (seriesCode === 'P' && cardNum > 24) {
    targetPage = Math.ceil(cardNum / 24)
  }

  logger.info(`  Recherche dans ${seriesSlug} page ${targetPage} pour #${cardNumber}`)

  // Go to the series page
  await page.goto(`${baseUrl}?page=${targetPage}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await delay(1500)

  // Find the card URL - try multiple patterns
  const cardUrl = await page.evaluate((num: string, series: string) => {
    const links = document.querySelectorAll('a[href*="/cards/"]')
    const paddedNum = num.padStart(3, '0')

    for (const link of links) {
      const href = (link as HTMLAnchorElement).href.toLowerCase()

      // Pattern for P series: p-fr-029-... or pfr-029-...
      if (series === 'P') {
        if (href.includes(`/p-fr-${paddedNum}-`) || href.includes(`/pfr-${paddedNum}-`)) {
          return (link as HTMLAnchorElement).href
        }
      }

      // Pattern for OP series: op01fr-016-... or op01-fr-016-...
      const opMatch = href.match(new RegExp(`/${series.toLowerCase()}(?:-)?fr-${paddedNum}-`))
      if (opMatch) {
        return (link as HTMLAnchorElement).href
      }

      // Generic pattern
      const match = href.match(/\/cards\/[a-z0-9]+-(?:fr-)?(\d{3})-\d+-[a-z]-/)
      if (match && match[1] === paddedNum) {
        return (link as HTMLAnchorElement).href
      }
    }
    return null
  }, cardNumber, seriesCode)

  if (!cardUrl) {
    // Try scanning nearby pages for P series
    if (seriesCode === 'P') {
      for (const offset of [-1, 1, -2, 2]) {
        const altPage = targetPage + offset
        if (altPage < 1) continue

        await page.goto(`${baseUrl}?page=${altPage}`, { waitUntil: 'networkidle2', timeout: 30000 })
        await delay(1000)

        const altUrl = await page.evaluate((num: string) => {
          const links = document.querySelectorAll('a[href*="/cards/"]')
          const paddedNum = num.padStart(3, '0')
          for (const link of links) {
            const href = (link as HTMLAnchorElement).href.toLowerCase()
            if (href.includes(`/p-fr-${paddedNum}-`) || href.includes(`/pfr-${paddedNum}-`)) {
              return (link as HTMLAnchorElement).href
            }
          }
          return null
        }, cardNumber)

        if (altUrl) {
          logger.info(`  Trouvé sur page ${altPage}`)
          await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 30000 })
          await delay(1000)
          break
        }
      }
    }

    // Re-check if we found something
    const currentUrl = page.url()
    if (!currentUrl.includes('/cards/')) {
      logger.warn(`  URL non trouvée pour #${cardNumber}`)
      return null
    }
  } else {
    // Navigate to card page
    await page.goto(cardUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)
  }

  const imageUrl = await page.evaluate(() => {
    // Try JSON-LD first
    const jsonLd = document.querySelector('script[type="application/ld+json"]')
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent || '{}')
        if (data.image) {
          const images = Array.isArray(data.image) ? data.image : [data.image]
          // Find French image
          const frImage = images.find((img: string) => img.includes('/fr/'))
          if (frImage) return frImage
        }
      } catch (e) {}
    }
    // Fallback to og:image
    const ogImage = document.querySelector('meta[property="og:image"]')
    return ogImage?.getAttribute('content') || null
  })

  return imageUrl
}

async function main() {
  logger.section('Correction des images Starter Decks ST15-ST20')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification')
  }

  // Get cards needing fixes
  const cardsToFix = await getMissingCards()

  if (cardsToFix.length === 0) {
    logger.success('Aucune carte à corriger')
    return
  }

  logger.info(`${cardsToFix.length} cartes à corriger`)

  if (dryRun) {
    cardsToFix.forEach(c => {
      logger.info(`  ${c.seriesCode} #${c.number} (${c.name}) -> ${c.originalSeries}-${c.originalNumber}`)
    })
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

  for (let i = 0; i < cardsToFix.length; i++) {
    const card = cardsToFix[i]
    logger.info(`[${i+1}/${cardsToFix.length}] ${card.seriesCode} #${card.number}: ${card.name}`)
    logger.info(`  -> Source: ${card.originalSeries}-${card.originalNumber}`)

    try {
      const slug = SERIES_SLUGS[card.originalSeries]
      if (!slug) {
        logger.error(`  Slug non trouvé pour ${card.originalSeries}`)
        errors++
        continue
      }

      const imageUrl = await findCardImageUrl(page, slug, card.originalNumber, card.originalSeries)

      if (!imageUrl) {
        errors++
        continue
      }

      logger.info(`  Image trouvée: ${imageUrl.substring(0, 60)}...`)

      // Download and upload image
      const storagePath = await uploadOnePieceCardImage(
        card.seriesCode,
        card.number.padStart(3, '0'),
        imageUrl,
        'fr'
      )

      // Update database
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/onepiece-cards/${storagePath}`

      await supabase
        .from('cards')
        .update({ image_url: publicUrl })
        .eq('id', card.id)

      logger.success(`  OK: ${storagePath}`)
      success++

      await delay(2000)
    } catch (err) {
      logger.error(`  Erreur: ${(err as Error).message}`)
      errors++
    }
  }

  await browser.close()

  logger.section('Résumé')
  logger.info(`Succès: ${success}`)
  logger.info(`Erreurs: ${errors}`)
}

main().catch(console.error)
