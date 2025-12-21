/**
 * Rebuild EB01 (Memorial Collection) EN series
 *
 * This script:
 * 1. Deletes all existing EB01/en images from Supabase Storage
 * 2. Scrapes all cards from opecards.fr (serie=367&language=EN)
 * 3. Downloads and uploads new images
 * 4. Updates the database with new image URLs
 *
 * Usage:
 *   npx tsx scripts/rebuild-eb01.ts
 *   npx tsx scripts/rebuild-eb01.ts --dry-run
 */

import puppeteer from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadOnePieceCardImage, deleteOnePieceSeriesImages } from '../lib/supabase/storage'

const dryRun = process.argv.includes('--dry-run')

const SERIES_CODE = 'EB01'
const SERIES_NAME = 'Memorial Collection'
const LANGUAGE = 'en'
const SERIE_ID = 367
const BASE_URL = 'https://www.opecards.fr'
const SEARCH_URL = `${BASE_URL}/cards/search?sortBy=releaseR&serie=${SERIE_ID}&language=EN`

interface CardInfo {
  number: string
  name: string
  rarity: string
  url: string
  imageUrl?: string
}

async function main() {
  const supabase = createAdminClient()

  logger.section(`Reconstruction de la serie ${SERIES_CODE} - ${SERIES_NAME} (${LANGUAGE.toUpperCase()})`)

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification ne sera effectuee')
  }

  // 1. Get One Piece TCG ID and series
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouve')
    process.exit(1)
  }

  // Get or create series
  let { data: series } = await supabase
    .from('series')
    .select('id, name')
    .eq('tcg_game_id', tcg.id)
    .eq('code', SERIES_CODE)
    .single()

  if (!series) {
    logger.info(`Creation de la serie ${SERIES_CODE}...`)
    if (!dryRun) {
      const { data: newSeries, error } = await supabase
        .from('series')
        .insert({
          tcg_game_id: tcg.id,
          code: SERIES_CODE,
          name: SERIES_NAME,
          release_date: '2024-04-26'
        })
        .select()
        .single()

      if (error) {
        logger.error(`Erreur creation serie: ${error.message}`)
        process.exit(1)
      }
      series = newSeries
    }
  }

  logger.info(`Serie: ${series?.name || SERIES_NAME} (ID: ${series?.id || 'N/A'})`)

  // 2. Delete existing images
  logger.section('Suppression des images existantes')

  if (!dryRun) {
    const deleteResult = await deleteOnePieceSeriesImages(SERIES_CODE, LANGUAGE)
    if (deleteResult.success) {
      logger.success(`${deleteResult.count || 0} images supprimees`)
    } else {
      logger.warn(`Aucune image a supprimer ou erreur: ${JSON.stringify(deleteResult.error)}`)
    }
  } else {
    logger.info('DRY RUN: Suppression des images ignoree')
  }

  // 3. Delete existing cards from database
  logger.section('Suppression des cartes existantes de la BDD')

  if (!dryRun && series) {
    const { error: deleteCardsError, count } = await supabase
      .from('cards')
      .delete({ count: 'exact' })
      .eq('series_id', series.id)
      .eq('language', LANGUAGE.toUpperCase())

    if (deleteCardsError) {
      logger.error(`Erreur suppression cartes: ${deleteCardsError.message}`)
    } else {
      logger.success(`${count || 0} cartes supprimees de la BDD`)
    }
  } else {
    logger.info('DRY RUN: Suppression des cartes ignoree')
  }

  // 4. Scrape all cards from opecards.fr
  logger.section('Scraping des cartes depuis opecards.fr')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  const allCards: CardInfo[] = []

  try {
    // Scan all pages
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      const pageUrl = `${SEARCH_URL}&page=${pageNum}`
      logger.info(`Page ${pageNum}/3: ${pageUrl}`)

      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 })
      await delay(2000)

      // Scroll to load all cards
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
      await delay(1000)

      // Extract card URLs from the page
      const pageCards = await page.evaluate(() => {
        const cards: { url: string; number: string; name: string; rarity: string }[] = []
        const links = document.querySelectorAll('a[href*="/cards/en-eb01-"]')

        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          // Pattern: /cards/en-eb01-001-l-kouzuki-oden or /cards/en-eb01-001-l-version-2-kouzuki-oden
          const match = href.match(/\/cards\/en-eb01-(\d{3})-([a-z]+)(?:-version-\d+)?-(.+)$/)
          if (match) {
            const [, number, rarity, slug] = match
            const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            cards.push({
              url: href,
              number,
              rarity: rarity.toUpperCase(),
              name
            })
          }
        })

        return cards
      })

      logger.info(`  ${pageCards.length} cartes trouvees sur cette page`)
      allCards.push(...pageCards)

      await delay(1000)
    }

    // Remove duplicates (same number, keep first version only for base cards)
    const uniqueCards = new Map<string, CardInfo>()
    for (const card of allCards) {
      // For version-2, version-3 cards, create a unique key
      const isVersion = card.url.includes('-version-')
      const versionMatch = card.url.match(/-version-(\d+)-/)
      const version = versionMatch ? versionMatch[1] : '1'
      const key = `${card.number}-v${version}`

      if (!uniqueCards.has(key)) {
        uniqueCards.set(key, card)
      }
    }

    logger.success(`${uniqueCards.size} cartes uniques trouvees`)

    // 5. Process each card
    logger.section('Traitement des cartes')

    let processed = 0
    let success = 0
    let errors = 0

    const cardsArray = Array.from(uniqueCards.values())

    for (const card of cardsArray) {
      processed++
      const isVersion = card.url.includes('-version-')
      const versionMatch = card.url.match(/-version-(\d+)-/)
      const version = versionMatch ? parseInt(versionMatch[1]) : 1

      // Card number with version suffix for alternates
      const cardNumber = version > 1
        ? `${card.number}-v${version}`
        : card.number

      logger.processing(`[${processed}/${cardsArray.length}] #${cardNumber} - ${card.name}`)

      try {
        // Navigate to card page
        await page.goto(card.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await delay(1500)

        // Extract image URL from JSON-LD or og:image
        const imageUrl = await page.evaluate((lang: string) => {
          // Try JSON-LD first
          const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
          if (jsonLdScript) {
            try {
              const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
              if (jsonLd.image) {
                if (Array.isArray(jsonLd.image)) {
                  for (const img of jsonLd.image) {
                    if (img.contentUrl && img.contentUrl.includes(`/${lang}/`)) {
                      return img.contentUrl
                    }
                  }
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

          // Try direct image selector
          const mainImg = document.querySelector(`img[src*="static.opecards.fr/cards/${lang}"]`)
          if (mainImg) {
            return mainImg.getAttribute('src')
          }

          return null
        }, LANGUAGE)

        if (!imageUrl) {
          logger.warn(`  Image non trouvee`)
          errors++
          continue
        }

        if (dryRun) {
          logger.info(`  DRY RUN: Image trouvee: ${imageUrl.substring(0, 80)}...`)
          success++
          continue
        }

        // Upload image
        const uploadResult = await uploadOnePieceCardImage(
          imageUrl,
          cardNumber.padStart(3, '0'),
          SERIES_CODE,
          LANGUAGE
        )

        if (!uploadResult.success) {
          logger.error(`  Echec upload: ${JSON.stringify(uploadResult.error)}`)
          errors++
          continue
        }

        // Insert card into database
        const { error: insertError } = await supabase
          .from('cards')
          .upsert({
            series_id: series!.id,
            number: cardNumber,
            name: card.name,
            language: LANGUAGE.toUpperCase(),
            rarity: card.rarity,
            image_url: uploadResult.url,
            attributes: {
              source_url: card.url,
              version: version
            }
          }, {
            onConflict: 'series_id,number,language'
          })

        if (insertError) {
          logger.error(`  Echec insertion BDD: ${insertError.message}`)
          errors++
        } else {
          logger.success(`  OK`)
          success++
        }

        await delay(1000)

      } catch (e: any) {
        logger.error(`  Erreur: ${e.message}`)
        errors++
      }
    }

    // Final summary
    logger.section('Resume final')
    console.log(`Total traite: ${processed}`)
    console.log(`Succes: ${success}`)
    console.log(`Erreurs: ${errors}`)
    console.log(`Taux de reussite: ${((success / processed) * 100).toFixed(1)}%`)

    if (success > 0) {
      logger.success(`\n${success} cartes importees avec succes!`)
    }

  } finally {
    await browser.close()
  }
}

main().catch(e => {
  logger.error(`Erreur fatale: ${e.message}`)
  console.error(e)
  process.exit(1)
})
