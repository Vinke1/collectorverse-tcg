/**
 * Test script to download 5 missing Star Wars images
 *
 * This script will:
 * 1. Find 5 cards in DB that are missing images in storage
 * 2. Navigate to the series page and find the card URLs
 * 3. Scrape the image from swucards.fr
 * 4. Upload to Supabase storage
 * 5. Update the card's image_url
 *
 * Usage: npx tsx scripts/test-starwars-missing.ts
 */

import puppeteer from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadStarWarsCardImage } from '../lib/supabase/storage'
import { getSeriesByCode } from './config/starwars-series'

const SERIES_CODE = 'SHD'  // Shadows of the Galaxy
const LANGUAGE = 'fr'
const CARDS_TO_TEST = 5
const BASE_URL = 'https://www.swucards.fr'

async function main() {
  const supabase = createAdminClient()

  logger.section(`Test: Téléchargement de ${CARDS_TO_TEST} images manquantes (${SERIES_CODE})`)

  // Get series config
  const seriesConfig = getSeriesByCode(SERIES_CODE)
  if (!seriesConfig) {
    logger.error(`Configuration série ${SERIES_CODE} non trouvée`)
    process.exit(1)
  }

  // 1. Get series ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'starwars')
    .single()

  if (!tcg) {
    logger.error('TCG Star Wars non trouvé')
    process.exit(1)
  }

  const { data: series } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)
    .eq('code', SERIES_CODE)
    .single()

  if (!series) {
    logger.error(`Série ${SERIES_CODE} non trouvée`)
    process.exit(1)
  }

  logger.info(`Série: ${series.name} (${series.code})`)

  // 2. Get cards without images (cards with number > 100)
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, number, name, language, image_url')
    .eq('series_id', series.id)
    .eq('language', LANGUAGE.toUpperCase())
    .order('number', { ascending: true })

  if (cardsError || !cards) {
    logger.error(`Erreur récupération cartes: ${cardsError?.message}`)
    process.exit(1)
  }

  logger.info(`${cards.length} cartes trouvées dans la série ${SERIES_CODE}`)

  // 3. List images in storage
  const storagePath = `${SERIES_CODE}/${LANGUAGE}`
  const { data: storageFiles } = await supabase.storage
    .from('starwars-cards')
    .list(storagePath)

  const existingImages = new Set(
    (storageFiles || [])
      .filter(f => f.name.endsWith('.webp'))
      .map(f => f.name.replace('.webp', ''))
  )

  logger.info(`${existingImages.size} images dans le storage`)

  // 4. Find cards missing images
  const cardsWithoutImages = cards.filter(card => {
    const paddedNumber = card.number.toString().padStart(3, '0')
    const rawNumber = card.number.toString()
    return !existingImages.has(paddedNumber) && !existingImages.has(rawNumber)
  })

  logger.info(`${cardsWithoutImages.length} cartes sans images dans le storage`)

  if (cardsWithoutImages.length === 0) {
    logger.success('Toutes les cartes ont des images!')
    process.exit(0)
  }

  // 5. Take first N cards to test
  const cardsToProcess = cardsWithoutImages.slice(0, CARDS_TO_TEST)

  logger.section(`Traitement de ${cardsToProcess.length} cartes`)

  for (const card of cardsToProcess) {
    console.log(`  - #${card.number}: ${card.name}`)
  }

  // 6. Launch browser
  logger.info('\nLancement du navigateur...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  let successCount = 0
  let errorCount = 0

  try {
    // First, navigate to the series page and collect all card URLs
    logger.processing('\nCollecte des URLs de cartes depuis la série...')

    const seriesUrl = `${BASE_URL}/series/${seriesConfig.slug}`
    logger.info(`URL série: ${seriesUrl}`)

    await page.goto(seriesUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await delay(2000)

    // Get all card URLs by navigating through pages
    const targetNumbers = cardsToProcess.map(c => c.number.toString().padStart(3, '0'))
    const cardUrls: Map<string, string> = new Map()

    // Check total pages
    const totalPages = await page.evaluate(() => {
      const pageLinks = document.querySelectorAll('.pagination .page-item .page-link[data-page]')
      let maxPage = 1
      pageLinks.forEach(link => {
        const pageNum = parseInt(link.getAttribute('data-page') || '0', 10)
        if (pageNum > maxPage) maxPage = pageNum
      })
      return maxPage
    })

    logger.info(`Total pages: ${totalPages}`)

    // Cards 101-105 should be on page 4 or 5 (30 cards per page based on debug)
    // Page 1: 1-30, Page 2: 31-60, Page 3: 61-90, Page 4: 91-120, Page 5: 121-150
    const minTargetNum = Math.min(...targetNumbers.map(n => parseInt(n)))
    const startPage = Math.max(1, Math.ceil(minTargetNum / 30))
    logger.info(`Démarrage à la page ${startPage} (pour cartes à partir de #${minTargetNum})`)

    let currentPage = 1

    // Navigate to the starting page
    while (currentPage < startPage && currentPage < totalPages) {
      const nextPage = currentPage + 1
      const clicked = await page.evaluate((targetPage) => {
        const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
        for (const link of pageLinks) {
          const pageNum = link.getAttribute('data-page')
          const text = link.textContent?.trim()
          if (pageNum === targetPage.toString() || text === targetPage.toString()) {
            (link as HTMLElement).click()
            return true
          }
        }
        return false
      }, nextPage)

      if (clicked) {
        await delay(2000)
        currentPage = nextPage
      } else {
        break
      }
    }

    // Now scan pages until we find all target cards
    let pagesScanned = 0
    const maxPagesToScan = 10

    while (cardUrls.size < targetNumbers.length && pagesScanned < maxPagesToScan && currentPage <= totalPages) {
      logger.processing(`Scan page ${currentPage}...`)

      // Auto-scroll to load all cards
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

      // Extract card URLs on this page
      const pageCardUrls = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        const results: { number: string; url: string }[] = []

        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
            // Extract card number from URL
            // Pattern: /cards/shd-fr-001-262-c-slug
            const match = href.match(/\/cards\/[a-z]+-[a-z]{2}-(\d{3})-\d+-[a-z]-/)
            if (match) {
              results.push({ number: match[1], url: href })
            }
          }
        })

        return results
      })

      console.log(`    Found ${pageCardUrls.length} card URLs on this page`)

      for (const { number, url } of pageCardUrls) {
        const paddedNumber = number.padStart(3, '0')
        if (targetNumbers.includes(paddedNumber) && !cardUrls.has(paddedNumber)) {
          cardUrls.set(paddedNumber, url)
          logger.success(`  Trouvé #${paddedNumber}: ${url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('/') + 50)}...`)
        }
      }

      // Go to next page
      if (cardUrls.size < targetNumbers.length && currentPage < totalPages) {
        const nextPage = currentPage + 1
        const clicked = await page.evaluate((targetPage) => {
          const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
          for (const link of pageLinks) {
            const pageNum = link.getAttribute('data-page')
            const text = link.textContent?.trim()
            if (pageNum === targetPage.toString() || text === targetPage.toString()) {
              (link as HTMLElement).click()
              return true
            }
          }
          return false
        }, nextPage)

        if (clicked) {
          await delay(2000)
          currentPage = nextPage
        } else {
          logger.warn(`Impossible de naviguer vers la page ${nextPage}`)
          break
        }
      } else {
        break
      }

      pagesScanned++
    }

    logger.info(`\nURLs collectées: ${cardUrls.size}/${targetNumbers.length}`)

    // Now process each card
    for (const card of cardsToProcess) {
      const paddedNumber = card.number.toString().padStart(3, '0')
      const cardUrl = cardUrls.get(paddedNumber)

      logger.processing(`\n[${successCount + errorCount + 1}/${cardsToProcess.length}] #${paddedNumber}: ${card.name}`)

      if (!cardUrl) {
        logger.warn(`  URL non trouvée pour cette carte`)
        errorCount++
        continue
      }

      logger.info(`  URL: ${cardUrl}`)

      try {
        await page.goto(cardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await delay(1500)

        // Extract image URL from the page
        const imageUrl = await page.evaluate(() => {
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

        if (!imageUrl) {
          logger.warn(`  Image non trouvée sur la page`)
          errorCount++
          continue
        }

        logger.info(`  Image source: ${imageUrl.substring(0, 70)}...`)

        // Upload to Supabase storage
        logger.processing(`  Upload vers Supabase...`)

        const uploadResult = await uploadStarWarsCardImage(
          imageUrl,
          paddedNumber,
          SERIES_CODE,
          LANGUAGE
        )

        if (!uploadResult.success) {
          logger.error(`  Échec upload: ${JSON.stringify(uploadResult.error)}`)
          errorCount++
          continue
        }

        logger.info(`  Nouvelle URL: ${uploadResult.url}`)

        // Update card in database
        const { error: updateError } = await supabase
          .from('cards')
          .update({ image_url: uploadResult.url })
          .eq('id', card.id)

        if (updateError) {
          logger.error(`  Échec mise à jour DB: ${updateError.message}`)
          errorCount++
          continue
        }

        logger.success(`  ✅ Carte mise à jour avec succès!`)
        successCount++

        await delay(1500)

      } catch (e: any) {
        logger.error(`  Erreur: ${e.message}`)
        errorCount++
      }
    }

  } finally {
    await browser.close()
  }

  // Summary
  logger.section('Résumé')
  console.log(`Succès: ${successCount}`)
  console.log(`Erreurs: ${errorCount}`)
  console.log(`Total: ${cardsToProcess.length}`)

  if (successCount > 0) {
    logger.success(`\n${successCount} images téléchargées avec succès!`)
  }
}

main().catch(e => {
  logger.error(`Erreur fatale: ${e.message}`)
  process.exit(1)
})
