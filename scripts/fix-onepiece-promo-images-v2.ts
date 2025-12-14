/**
 * Fix One Piece promo series images (PRB01, PRB02, STP) - Version 2
 *
 * Logique :
 * 1. Scrape les URLs d'images depuis opecards.fr
 * 2. Extrait le code série original (OP03-003) + variante + nom
 * 3. Télécharge et stocke dans PRB01/{lang}/{série}-{numéro}-{variante}.webp
 * 4. Matche par nom de carte pour mettre à jour l'URL en DB
 *
 * Usage:
 *   npx tsx scripts/fix-onepiece-promo-images-v2.ts
 *   npx tsx scripts/fix-onepiece-promo-images-v2.ts --series PRB01 --language EN
 *   npx tsx scripts/fix-onepiece-promo-images-v2.ts --dry-run
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

// Series IDs from opecards.fr (verified URLs)
const PROMO_SERIES_IDS: Record<string, Record<string, number>> = {
  'PRB01': { 'FR': 478, 'EN': 435 },
  'PRB02': { 'FR': 745, 'EN': 744 },
  'STP': { 'FR': 721, 'EN': 720 },
}

interface CardImageInfo {
  imageUrl: string
  cardName: string
  originalSeries: string  // OP03, ST04, etc.
  originalNumber: string  // 003, 004, etc.
  variant: string         // '', 'ALT', 'FA', 'JR', 'MANGA', 'PARALLEL'
  rarity: string          // r, sr, uc, c, etc.
}

interface ProgressData {
  startedAt: string
  lastUpdated: string
  processed: number
  success: number
  errors: number
  uploaded: number
  matched: number
  processedUrls: string[]
}

const PROGRESS_FILE = 'scripts/logs/onepiece-promo-fix-v2-progress.json'

function loadProgress(): ProgressData | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
    }
  } catch (e) { }
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
 * Parse image URL to extract card info
 *
 * Examples:
 * EN: image-trading-cards-one-piece-card-game-tcg-opecards-en-op03-003-r-prb01-jolly-roger-foil-izo.webp
 * EN: image-trading-cards-one-piece-card-game-tcg-opecards-en-op02-004-sr-prb01-alternative-art-edward-newgate.webp
 * EN: image-trading-cards-one-piece-card-game-tcg-opecards-en-prb01-don-foil-textured-doflamingo.webp
 * FR: image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op06-003-uc-emporio-ivankov.webp
 * FR: image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-prb01-001-l-sanji.webp
 * STP: image-trading-cards-one-piece-card-game-tcg-opecards-en-st19-002-c-tournament-pack-2025-vol3-sengoku.webp
 */
function parseImageUrl(imageUrl: string, cardName: string): CardImageInfo | null {
  // Skip back images and common images
  if (imageUrl.includes('/back-') || imageUrl.includes('/common/')) {
    return null
  }

  const filename = imageUrl.split('/').pop() || ''

  // Pattern 1: EN format with prb01/prb02 marker
  // en-op03-003-r-prb01-jolly-roger-foil-izo
  const enPrbMatch = filename.match(/en-(op\d+|st\d+|eb\d+)-(\d{3})-([a-z]+)-prb\d+-(.+)\.webp$/i)
  if (enPrbMatch) {
    const [, series, number, rarity, rest] = enPrbMatch
    return {
      imageUrl,
      cardName,
      originalSeries: series.toUpperCase(),
      originalNumber: number,
      rarity,
      variant: parseVariant(rest),
    }
  }

  // Pattern 2: FR format without language prefix
  // op06-003-uc-emporio-ivankov or op06-003-uc-version-2-emporio-ivankov
  const frMatch = filename.match(/opecards-(op\d+|st\d+|eb\d+)-(\d{3})-([a-z]+)-(.+)\.webp$/i)
  if (frMatch) {
    const [, series, number, rarity, rest] = frMatch
    return {
      imageUrl,
      cardName,
      originalSeries: series.toUpperCase(),
      originalNumber: number,
      rarity,
      variant: parseVariantFR(rest),
    }
  }

  // Pattern 3: PRB series card (prb01-001-l-sanji)
  const prbCardMatch = filename.match(/opecards-(?:en-)?(prb\d+)-(\d{3})-([a-z]+)-(.+)\.webp$/i)
  if (prbCardMatch) {
    const [, series, number, rarity, rest] = prbCardMatch
    return {
      imageUrl,
      cardName,
      originalSeries: series.toUpperCase(),
      originalNumber: number,
      rarity,
      variant: parseVariant(rest),
    }
  }

  // Pattern 4: DON!! cards (prb01-don-foil-textured-doflamingo)
  const donMatch = filename.match(/(?:en-)?(prb\d+)-don-(.+)\.webp$/i)
  if (donMatch) {
    const [, series, rest] = donMatch
    return {
      imageUrl,
      cardName,
      originalSeries: series.toUpperCase(),
      originalNumber: 'DON',
      rarity: 'don',
      variant: parseDonVariant(rest),
    }
  }

  // Pattern 5: STP format (tournament-pack, winner-pack)
  // en-st19-002-c-tournament-pack-2025-vol3-sengoku
  const stpMatch = filename.match(/(?:en-)?(op\d+|st\d+|eb\d+|p)-(\d{3})-([a-z]+)-(?:tournament-pack|winner-pack|pack-de-tournoi|pack-winner)-(.+)\.webp$/i)
  if (stpMatch) {
    const [, series, number, rarity, rest] = stpMatch
    // Extract name from rest (after vol3- or similar)
    const namePart = rest.replace(/^\d{4}-(vol\d+-)?/i, '')
    const isWinner = filename.includes('winner')
    return {
      imageUrl,
      cardName,
      originalSeries: series.toUpperCase(),
      originalNumber: number,
      rarity,
      variant: isWinner ? 'WINNER' : 'TOURNAMENT',
    }
  }

  // Pattern 6: Promo P cards in STP
  // en-p-017-p-tournament-pack-vol-7-trafalgar-law
  const promoMatch = filename.match(/(?:en-)?p-(\d{3})-([a-z]+)-(?:tournament-pack|winner-pack|pack-de-tournoi|pack-winner)-(.+)\.webp$/i)
  if (promoMatch) {
    const [, number, rarity, rest] = promoMatch
    const isWinner = filename.includes('winner')
    return {
      imageUrl,
      cardName,
      originalSeries: 'P',
      originalNumber: number,
      rarity,
      variant: isWinner ? 'WINNER' : 'TOURNAMENT',
    }
  }

  return null
}

function parseVariant(rest: string): string {
  if (rest.includes('alternative-art')) return 'ALT'
  if (rest.includes('full-art')) return 'FA'
  if (rest.includes('jolly-roger')) return 'JR'
  if (rest.includes('manga')) return 'MANGA'
  if (rest.includes('foil-textured')) return 'FT'
  if (rest.includes('gold')) return 'GOLD'
  if (rest.includes('foil')) return 'FOIL'
  return ''
}

function parseVariantFR(rest: string): string {
  if (rest.includes('version-2') || rest.includes('parallele')) return 'PARALLEL'
  if (rest.includes('alternative')) return 'ALT'
  if (rest.includes('manga')) return 'MANGA'
  return ''
}

function parseDonVariant(rest: string): string {
  if (rest.includes('foil-textured')) return 'FT'
  if (rest.includes('gold')) return 'GOLD'
  return ''
}

/**
 * Scrape all card images from a series search page
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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1500)

    // Extract card images
    const pageCards = await page.evaluate(() => {
      const cards: { imageUrl: string; cardName: string }[] = []
      const images = document.querySelectorAll('img[src*="static.opecards.fr/cards"]')

      images.forEach(img => {
        const imgEl = img as HTMLImageElement
        if (!imgEl.src.includes('/back-') && !imgEl.src.includes('/common/')) {
          cards.push({
            imageUrl: imgEl.src,
            cardName: imgEl.alt || 'Unknown',
          })
        }
      })

      return cards
    })

    if (pageCards.length === 0) {
      hasMorePages = false
    } else {
      // Parse each card
      for (const card of pageCards) {
        const parsed = parseImageUrl(card.imageUrl, card.cardName)
        if (parsed) {
          allCards.push(parsed)
        }
      }

      // Check for next page
      const hasNext = await page.evaluate((currentPageNum) => {
        const pagination = document.querySelector('.pagination')
        if (!pagination) return false
        const pageLinks = pagination.querySelectorAll('.page-link[data-page]')
        const pageNums = Array.from(pageLinks)
          .map(el => parseInt(el.getAttribute('data-page') || '0'))
          .filter(n => n > 0)
        return currentPageNum < Math.max(...pageNums, 0)
      }, currentPage)

      if (hasNext) {
        currentPage++
        await delay(1000)
      } else {
        hasMorePages = false
      }
    }

    if (currentPage > 20) {
      hasMorePages = false
    }
  }

  logger.success(`  Total: ${allCards.length} images parsées pour ${seriesCode} ${language}`)
  return allCards
}

/**
 * Download and process image
 */
async function downloadImage(imageUrl: string, browser: Browser): Promise<Buffer | null> {
  try {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'Referer': 'https://www.opecards.fr/' })
    const response = await page.goto(imageUrl, { waitUntil: 'load', timeout: 15000 })
    if (!response || !response.ok()) {
      await page.close()
      return null
    }
    const buffer = await response.buffer()
    await page.close()

    // Process with Sharp
    return await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    return null
  }
}

/**
 * Normalize card name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '')       // Remove special chars
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Correction des images One Piece Promo (V2)')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`)

  // Get One Piece TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    process.exit(1)
  }

  const seriesToProcess = seriesFilter ? [seriesFilter] : Object.keys(PROMO_SERIES_IDS)
  const languagesToProcess = languageFilter ? [languageFilter] : ['FR', 'EN']

  logger.info(`Séries: ${seriesToProcess.join(', ')}`)
  logger.info(`Langues: ${languagesToProcess.join(', ')}`)

  let progress = loadProgress() || {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    processed: 0,
    success: 0,
    errors: 0,
    uploaded: 0,
    matched: 0,
    processedUrls: [],
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // Stats globales
  let totalProcessed = 0
  let totalUploaded = 0
  let totalMatched = 0
  let totalErrors = 0

  try {
    for (const seriesCode of seriesToProcess) {
      const seriesIds = PROMO_SERIES_IDS[seriesCode]
      if (!seriesIds) continue

      // Get series from DB
      const { data: series } = await supabase
        .from('series')
        .select('id, code, name')
        .eq('tcg_game_id', tcg.id)
        .eq('code', seriesCode)
        .single()

      if (!series) {
        logger.warn(`Série ${seriesCode} non trouvée en DB`)
        continue
      }

      for (const language of languagesToProcess) {
        const serieId = seriesIds[language]
        if (!serieId) continue

        logger.section(`${seriesCode} (${language})`)

        // Scrape images
        const cardImages = await scrapeSeriesImages(page, seriesCode, language, serieId)
        if (cardImages.length === 0) continue

        // Get DB cards for matching
        const { data: dbCards } = await supabase
          .from('cards')
          .select('id, number, name, image_url')
          .eq('series_id', series.id)
          .eq('language', language)

        logger.info(`${dbCards?.length || 0} cartes en DB, ${cardImages.length} images scrapées`)

        let seriesProcessed = 0
        let seriesUploaded = 0
        let seriesMatched = 0

        for (const cardInfo of cardImages) {
          if (progress.processedUrls.includes(cardInfo.imageUrl)) continue
          if (LIMIT && seriesProcessed >= LIMIT) break

          seriesProcessed++
          totalProcessed++

          // Build filename: {originalSeries}-{number}[-{variant}].webp
          const variantSuffix = cardInfo.variant ? `-${cardInfo.variant}` : ''
          const filename = `${cardInfo.originalSeries}-${cardInfo.originalNumber}${variantSuffix}.webp`
          const storagePath = `${seriesCode}/${language.toLowerCase()}/${filename}`

          console.log(`  [${seriesProcessed}] ${cardInfo.cardName}`)
          console.log(`      -> ${cardInfo.originalSeries}-${cardInfo.originalNumber}${variantSuffix}`)

          if (dryRun) {
            progress.processedUrls.push(cardInfo.imageUrl)
            continue
          }

          try {
            // Download image
            const imageBuffer = await downloadImage(cardInfo.imageUrl, browser)
            if (!imageBuffer) {
              logger.error(`      Échec téléchargement`)
              totalErrors++
              continue
            }

            // Upload to Supabase
            const { error: uploadError } = await supabase.storage
              .from('onepiece-cards')
              .upload(storagePath, imageBuffer, {
                contentType: 'image/webp',
                upsert: true,
              })

            if (uploadError) {
              logger.error(`      Échec upload: ${uploadError.message}`)
              totalErrors++
              continue
            }

            seriesUploaded++
            totalUploaded++

            // Get public URL
            const { data: publicUrl } = supabase.storage
              .from('onepiece-cards')
              .getPublicUrl(storagePath)

            // Match by name
            const normalizedCardName = normalizeName(cardInfo.cardName)
            const matchingCard = dbCards?.find(c => {
              const dbName = normalizeName(c.name)
              // Match if names are similar
              return dbName.includes(normalizedCardName) ||
                     normalizedCardName.includes(dbName) ||
                     dbName === normalizedCardName
            })

            if (matchingCard) {
              const { error: updateError } = await supabase
                .from('cards')
                .update({ image_url: publicUrl.publicUrl })
                .eq('id', matchingCard.id)

              if (!updateError) {
                seriesMatched++
                totalMatched++
                console.log(`      ✅ Matchée: ${matchingCard.number} - ${matchingCard.name}`)
              }
            } else {
              console.log(`      📦 Uploadée (pas de match en DB)`)
            }

            progress.processedUrls.push(cardInfo.imageUrl)
            saveProgress(progress)
            await delay(300)

          } catch (error: any) {
            logger.error(`      Erreur: ${error.message}`)
            totalErrors++
          }
        }

        // Résumé série
        console.log(`\n  📊 ${seriesCode} ${language}: ${seriesProcessed} traitées, ${seriesUploaded} uploadées, ${seriesMatched} matchées`)
      }
    }

  } finally {
    await browser.close()
  }

  // Résumé final
  logger.section('RÉSUMÉ FINAL')
  console.log(`┌────────────────────────────────────┐`)
  console.log(`│ Images traitées:    ${String(totalProcessed).padStart(10)}   │`)
  console.log(`│ Images uploadées:   ${String(totalUploaded).padStart(10)}   │`)
  console.log(`│ Cartes matchées:    ${String(totalMatched).padStart(10)}   │`)
  console.log(`│ Erreurs:            ${String(totalErrors).padStart(10)}   │`)
  console.log(`└────────────────────────────────────┘`)

  if (!dryRun && totalErrors === 0 && totalProcessed > 0) {
    try { fs.unlinkSync(PROGRESS_FILE) } catch {}
  }
}

main().catch(error => {
  logger.error(`Erreur fatale: ${error.message}`)
  process.exit(1)
})
