/**
 * Script pour télécharger les images manquantes des séries PRB
 * Lit les cartes depuis la DB qui ont des URLs static.opecards.fr
 * Télécharge les images et met à jour la DB avec les URLs Supabase
 *
 * Usage:
 *   npx tsx scripts/download-prb-images.ts --series PRB01 --lang en
 *   npx tsx scripts/download-prb-images.ts --series PRB01 --lang all
 *   npx tsx scripts/download-prb-images.ts --series all --lang all
 *   npx tsx scripts/download-prb-images.ts --dry-run
 */

import puppeteer from 'puppeteer'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'

// ============================================
// CONFIGURATION
// ============================================

const SERIES_DB_IDS: Record<string, string> = {
  PRB01: 'bc700b8d-5f56-437e-8ab7-92b8b39d6ef7',
  PRB02: '2d872f15-9ac9-4132-806c-0eae9ff5d706'
}

// Parse arguments
const args = process.argv.slice(2)
const seriesArg = args.find((_, i) => args[i - 1] === '--series') || 'all'
const langArg = args.find((_, i) => args[i - 1] === '--lang') || 'all'
const dryRun = args.includes('--dry-run')
const limit = parseInt(args.find((_, i) => args[i - 1] === '--limit') || '0')

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface CardToDownload {
  id: string
  series_code: string
  number: string
  name: string
  language: string
  image_url: string
  attributes: any
}

/**
 * Scrape la vraie URL d'image depuis la page de la carte
 */
async function scrapeRealImageUrl(page: any, cardUrl: string, language: string): Promise<string | null> {
  try {
    await page.goto(cardUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await delay(1500)

    const imageUrl = await page.evaluate((lang: string) => {
      // 1. Chercher dans les images de la page (le plus fiable pour PRB)
      const imgs = document.querySelectorAll('img[src*="static.opecards.fr/cards"]')
      for (const img of imgs) {
        const src = (img as HTMLImageElement).src
        if (src && !src.includes('back-') && !src.includes('icon') && !src.includes('logo') && !src.includes('loader')) {
          const langPrefix = lang.toLowerCase()
          if (src.includes(`/${langPrefix}/`) || src.includes(`-${langPrefix}-`)) {
            return src
          }
        }
      }

      // 2. Chercher dans og:image
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) {
        const src = ogImage.getAttribute('content') || ''
        if (src && src.includes('static.opecards.fr/cards')) {
          return src
        }
      }

      // 3. Chercher dans le JSON-LD
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            const langPrefix = lang.toLowerCase()
            const matchingImage = images.find((img: string) =>
              img.includes(`/${langPrefix}/`) || img.includes(`-${langPrefix}-`)
            )
            if (matchingImage) return matchingImage
          }
        } catch (e) {}
      }

      return null
    }, language)

    return imageUrl
  } catch (error) {
    logger.error(`Erreur scraping ${cardUrl}: ${error}`)
    return null
  }
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Télécharge et optimise une image depuis une URL
 */
async function downloadAndOptimizeImage(
  imageUrl: string,
  page: any
): Promise<Buffer | null> {
  try {
    // Méthode 1: utiliser page.goto pour intercepter la réponse
    const response = await page.goto(imageUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    if (!response || !response.ok()) {
      logger.warn(`HTTP ${response?.status() || 'error'} pour ${imageUrl}`)
      return null
    }

    const buffer = await response.buffer()

    // Optimiser avec Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    return optimized
  } catch (error) {
    logger.error(`Erreur téléchargement/optimisation: ${error}`)
    return null
  }
}

/**
 * Upload une image vers Supabase Storage
 */
async function uploadImage(
  buffer: Buffer,
  seriesCode: string,
  language: string,
  cardNumber: string
): Promise<string | null> {
  try {
    // Nettoyer le numéro pour le nom de fichier (remplacer tous les caractères spéciaux par des tirets)
    const safeNumber = cardNumber.replace(/[^a-zA-Z0-9-]/g, '-')
    const path = `${seriesCode}/${language.toLowerCase()}/${safeNumber}.webp`

    logger.info(`  Upload vers: ${path}`)

    const { error } = await supabase.storage
      .from('onepiece-cards')
      .upload(path, buffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      logger.error(`Erreur upload ${path}: ${error.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('onepiece-cards')
      .getPublicUrl(path)

    return publicUrl
  } catch (error) {
    logger.error(`Erreur upload: ${error}`)
    return null
  }
}

/**
 * Met à jour l'image_url d'une carte
 */
async function updateCardImageUrl(cardId: string, newImageUrl: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cards')
      .update({ image_url: newImageUrl })
      .eq('id', cardId)

    if (error) {
      logger.error(`Erreur update DB: ${error.message}`)
      return false
    }

    return true
  } catch (error) {
    logger.error(`Erreur update: ${error}`)
    return false
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  logger.section('Téléchargement des images PRB manquantes')
  console.log(`Série(s): ${seriesArg}`)
  console.log(`Langue(s): ${langArg}`)
  console.log(`Dry run: ${dryRun}`)
  if (limit > 0) console.log(`Limite: ${limit} cartes`)

  // Déterminer les séries à traiter
  const seriesToProcess = seriesArg === 'all'
    ? Object.keys(SERIES_DB_IDS)
    : [seriesArg]

  // Déterminer les langues à traiter
  const languagesToProcess = langArg === 'all'
    ? ['EN', 'FR']
    : [langArg.toUpperCase()]

  // Récupérer les cartes à télécharger
  logger.info('Recherche des cartes avec URLs static.opecards.fr...')

  const cardsToDownload: CardToDownload[] = []

  for (const seriesCode of seriesToProcess) {
    const seriesId = SERIES_DB_IDS[seriesCode]
    if (!seriesId) {
      logger.warn(`Série ${seriesCode} non trouvée dans la configuration`)
      continue
    }

    for (const lang of languagesToProcess) {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, number, name, language, image_url, attributes')
        .eq('series_id', seriesId)
        .eq('language', lang)
        .like('image_url', '%static.opecards.fr%')
        .order('number')

      if (error) {
        logger.error(`Erreur récupération ${seriesCode} ${lang}: ${error.message}`)
        continue
      }

      if (cards && cards.length > 0) {
        // Filtrer les cartes qui ont un source_url dans attributes
        const cardsWithSourceUrl = cards.filter(c => c.attributes?.source_url)
        logger.info(`  ${seriesCode} ${lang}: ${cardsWithSourceUrl.length}/${cards.length} cartes avec source_url`)
        cardsToDownload.push(...cardsWithSourceUrl.map(c => ({ ...c, series_code: seriesCode })))
      }
    }
  }

  if (cardsToDownload.length === 0) {
    logger.success('Aucune carte à télécharger!')
    return
  }

  logger.section(`${cardsToDownload.length} cartes à traiter`)

  if (dryRun) {
    logger.info('Mode dry-run - affichage des premières cartes:')
    cardsToDownload.slice(0, 10).forEach(c => {
      console.log(`  ${c.series_code} ${c.language} ${c.number}: ${c.name}`)
      console.log(`    ${c.image_url}`)
    })
    return
  }

  // Appliquer la limite si spécifiée
  const cardsToProcess = limit > 0 ? cardsToDownload.slice(0, limit) : cardsToDownload

  // Lancer Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  let successCount = 0
  let errorCount = 0
  let skipCount = 0

  try {
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i]
      logger.progress(`[${i + 1}/${cardsToProcess.length}] ${card.series_code} ${card.language} ${card.number}: ${card.name}`)

      try {
        // 1. Scraper la vraie URL de l'image depuis la page source
        const sourceUrl = card.attributes?.source_url
        if (!sourceUrl) {
          logger.warn(`  Pas de source_url - skip`)
          skipCount++
          continue
        }

        logger.info(`  Scraping: ${sourceUrl}`)
        const realImageUrl = await scrapeRealImageUrl(page, sourceUrl, card.language)

        if (!realImageUrl) {
          logger.warn(`  URL image non trouvée - skip`)
          skipCount++
          continue
        }

        logger.info(`  Image URL: ${realImageUrl}`)

        // 2. Télécharger l'image
        const imageBuffer = await downloadAndOptimizeImage(realImageUrl, page)

        if (!imageBuffer) {
          logger.warn(`  Échec téléchargement - skip`)
          skipCount++
          continue
        }

        // 3. Upload vers Supabase
        const uploadedUrl = await uploadImage(
          imageBuffer,
          card.series_code,
          card.language,
          card.number
        )

        if (!uploadedUrl) {
          logger.warn(`  Échec upload - skip`)
          skipCount++
          continue
        }

        // 4. Mettre à jour la DB
        const updated = await updateCardImageUrl(card.id, uploadedUrl)

        if (updated) {
          logger.success(`  OK`)
          successCount++
        } else {
          logger.warn(`  Échec update DB - skip`)
          skipCount++
        }

      } catch (error) {
        logger.error(`  Erreur: ${error}`)
        errorCount++
      }

      // Rate limiting (plus long car on navigue)
      await delay(2000)
    }

  } finally {
    await page.close()
    await browser.close()
  }

  // Résumé
  logger.section('Résumé')
  logger.success(`Succès: ${successCount}`)
  if (skipCount > 0) logger.warn(`Skipped: ${skipCount}`)
  if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)

  logger.section('Terminé!')
}

main().catch(console.error)
