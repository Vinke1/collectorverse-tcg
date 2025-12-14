/**
 * Script de scraping pour les séries PRB (Premium Booster) One Piece
 * Ces séries contiennent des cartes de différentes séries avec numérotation spéciale
 *
 * Usage:
 *   npx tsx scripts/seed-prb-series.ts --series PRB01 --lang en
 *   npx tsx scripts/seed-prb-series.ts --series PRB01 --lang fr
 *   npx tsx scripts/seed-prb-series.ts --series PRB02 --lang all
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = 'https://www.opecards.fr'

// IDs des séries sur opecards.fr
const SERIES_CONFIG: Record<string, Record<string, number>> = {
  PRB01: {
    EN: 435,
    FR: 478
  },
  PRB02: {
    EN: 744,
    FR: 745
  }
}

// IDs des séries dans notre DB
const SERIES_DB_IDS: Record<string, string> = {
  PRB01: 'bc700b8d-5f56-437e-8ab7-92b8b39d6ef7',
  PRB02: '2d872f15-9ac9-4132-806c-0eae9ff5d706'
}

// Parse arguments
const args = process.argv.slice(2)
const seriesArg = args.find((_, i) => args[i - 1] === '--series') || 'PRB01'
const langArg = args.find((_, i) => args[i - 1] === '--lang') || 'fr'
const skipImages = args.includes('--skip-images')
const dryRun = args.includes('--dry-run')

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface PRBCard {
  url: string
  fullNumber: string  // Ex: OP06-003-UC, PRB01-001-L
  name: string
  rarity: string
  imageUrl: string
  finish: string
}

/**
 * Parse les données d'une carte directement depuis l'URL
 *
 * Formats:
 * - EN: /cards/en-op06-003-uc-prb01-full-art-emporio-ivankov
 * - FR: /cards/op06-003-uc-emporio-ivankov (sans préfixe et sans "prb01" dans l'URL)
 * - FR: /cards/prb01-001-l-sanji (cartes spécifiques PRB)
 */
function parseCardFromUrl(cardUrl: string, language: string): PRBCard | null {
  try {
    const path = new URL(cardUrl).pathname.replace('/cards/', '')
    const lang = language.toLowerCase()

    // Pattern 1: EN avec préfixe de langue et "prb0X"
    // en-op06-003-uc-prb01-full-art-emporio-ivankov
    const matchEN = path.match(/^(en|jp)-([a-z]+)(\d+)-(\d{3})-([a-z]+)-prb\d+-(.+)$/i)

    if (matchEN) {
      const [, langPrefix, seriesPrefix, seriesNum, cardNum, rarity, rest] = matchEN
      return parseCardParts(langPrefix, seriesPrefix, seriesNum, cardNum, rarity, rest, path)
    }

    // Pattern 2: FR sans préfixe de langue, carte avec numéro PRB
    // prb01-001-l-sanji
    const matchPRBFR = path.match(/^(prb)(\d+)-(\d{3})-([a-z]+)-(.+)$/i)

    if (matchPRBFR) {
      const [, seriesPrefix, seriesNum, cardNum, rarity, rest] = matchPRBFR
      return parseCardParts('fr', seriesPrefix, seriesNum, cardNum, rarity, rest, path)
    }

    // Pattern 3: FR sans préfixe, carte d'autres séries (OP, ST, etc.)
    // op06-003-uc-emporio-ivankov
    // op06-003-uc-version-2-emporio-ivankov
    const matchFR = path.match(/^([a-z]+)(\d+)-(\d{3})-([a-z]+)-(.+)$/i)

    if (matchFR) {
      const [, seriesPrefix, seriesNum, cardNum, rarity, rest] = matchFR
      return parseCardParts('fr', seriesPrefix, seriesNum, cardNum, rarity, rest, path)
    }

    return null
  } catch (error) {
    return null
  }
}

function parseCardParts(
  lang: string,
  seriesPrefix: string,
  seriesNum: string,
  cardNum: string,
  rarity: string,
  rest: string,
  fullPath: string
): PRBCard {
  // Construire le numéro complet (ex: OP06-003-UC)
  const fullNumber = `${seriesPrefix.toUpperCase()}${seriesNum.padStart(2, '0')}-${cardNum}-${rarity.toUpperCase()}`

  // Détecter le finish et extraire le nom
  let finish = 'standard'
  let namePart = rest

  const finishPatterns: Record<string, string> = {
    'full-art-': 'full-art',
    'jolly-roger-foil-': 'jolly-roger',
    'alternative-art-': 'alternate',
    'version-2-': 'alternate',  // FR utilise "version-2" au lieu de "alternative-art"
    'version-3-': 'alternate',
    'manga-': 'manga',
    'parallel-': 'parallel',
    'special-art-': 'special-art'
  }

  for (const [pattern, finishType] of Object.entries(finishPatterns)) {
    if (rest.startsWith(pattern)) {
      finish = finishType
      namePart = rest.replace(pattern, '')
      break
    }
  }

  // Convertir le slug en nom propre
  const name = namePart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\./g, '. ')

  // Construire l'URL de l'image
  // EN: image-trading-cards-one-piece-card-game-tcg-opecards-...
  // FR: image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-...
  // NOTE: Pour PRB, les images utilisent TOUJOURS "image-cartes-a-collectionner" même en EN
  const langPath = lang === 'fr' ? 'fr' : lang === 'en' ? 'en' : lang
  const imagePrefix = 'image-cartes-a-collectionner'
  const imageUrl = `https://static.opecards.fr/cards/${langPath}/${seriesPrefix.toLowerCase()}${seriesNum}/${imagePrefix}-one-piece-card-game-tcg-opecards-${fullPath}.webp`

  return {
    url: `https://www.opecards.fr/cards/${fullPath}`,
    fullNumber,
    name,
    rarity: rarity.toUpperCase(),
    imageUrl,
    finish
  }
}

// ============================================
// SCRAPING FUNCTIONS
// ============================================

/**
 * Récupère toutes les URLs de cartes depuis la page de recherche
 */
async function scrapeCardUrls(
  browser: Browser,
  seriesCode: string,
  language: string
): Promise<string[]> {
  const serieId = SERIES_CONFIG[seriesCode]?.[language.toUpperCase()]
  if (!serieId) {
    logger.error(`Configuration non trouvée pour ${seriesCode} ${language}`)
    return []
  }

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allUrls = new Set<string>()
  let currentPage = 1
  let hasMorePages = true

  try {
    while (hasMorePages) {
      const searchUrl = `${BASE_URL}/cards/search?page=${currentPage}&sortBy=releaseR&serie=${serieId}&language=${language.toUpperCase()}`
      logger.page(`Page ${currentPage}: ${searchUrl}`)

      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 })
      await delay(2000)

      // Scroll pour charger tout le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1500)

      // Extraire les liens de cartes
      const pageData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            return path.startsWith('/cards/') &&
                   !path.includes('/search') &&
                   !path.includes('cartes-les-plus-cheres') &&
                   path !== '/cards/' &&
                   path !== '/cards'
          })

        // Vérifier la pagination
        const paginationLinks = Array.from(document.querySelectorAll('.pagination a, .page-link, [class*="pagin"] a'))
        const pageNumbers = paginationLinks
          .map(el => {
            const text = el.textContent?.trim() || ''
            const num = parseInt(text)
            return isNaN(num) ? 0 : num
          })
          .filter(n => n > 0)
        const maxPage = Math.max(0, ...pageNumbers)

        return { links: [...new Set(links)], maxPage }
      })

      // Ajouter les nouvelles URLs
      const newUrls = pageData.links.filter(url => !allUrls.has(url))
      newUrls.forEach(url => allUrls.add(url))

      logger.info(`  ${newUrls.length} nouvelles cartes (${allUrls.size} total)`)

      // Vérifier s'il y a plus de pages
      if (currentPage >= pageData.maxPage || newUrls.length === 0) {
        hasMorePages = false
      } else {
        currentPage++
        await delay(DELAYS.betweenPages)
      }
    }
  } finally {
    await page.close()
  }

  return Array.from(allUrls)
}

/**
 * Extrait les données d'une carte depuis sa page
 */
async function scrapeCardDetails(
  page: Page,
  cardUrl: string,
  language: string
): Promise<PRBCard | null> {
  try {
    await page.goto(cardUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await delay(1500)

    const cardData = await page.evaluate((lang: string) => {
      // Extraire le numéro complet depuis le texte de la page
      // Format visible: "OP06-003-UC" ou "PRB01-001-L"
      const pageText = document.body.innerText

      // Pattern pour trouver le numéro de carte (ex: OP06-003-UC, ST04-001-L, PRB01-001-L)
      const numberMatch = pageText.match(/([A-Z]{2,4}\d{1,2})-(\d{3})(?:-([A-Z]{1,3}))?/i)

      let fullNumber = ''
      let rarity = 'C'

      if (numberMatch) {
        const [, seriesCode, num, rarityCode] = numberMatch
        fullNumber = `${seriesCode.toUpperCase()}-${num}`
        if (rarityCode) {
          rarity = rarityCode.toUpperCase()
          fullNumber += `-${rarity}`
        }
      }

      // Extraire le nom
      const nameEl = document.querySelector('h1, .card-name, [class*="title"]')
      let name = nameEl?.textContent?.trim() || ''

      // Nettoyer le nom (enlever les suffixes comme "(PRB01 Full Art)")
      name = name.replace(/\s*\([^)]+\)\s*$/, '').trim()

      // Extraire l'image - chercher dans plusieurs sources
      let imageUrl = ''

      // 1. Chercher dans le JSON-LD
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            // Filtrer par langue
            const langPrefix = lang.toLowerCase()
            const matchingImage = images.find((img: string) =>
              img.includes(`/${langPrefix}/`) || img.includes(`-${langPrefix}-`)
            )
            imageUrl = matchingImage || images[0] || ''
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // 2. Chercher dans les images de la page
      if (!imageUrl || imageUrl.includes('back-')) {
        const imgs = document.querySelectorAll('img[src*="static.opecards.fr"]')
        for (const img of imgs) {
          const src = (img as HTMLImageElement).src
          if (src && !src.includes('back-') && !src.includes('icon') && !src.includes('logo')) {
            const langPrefix = lang.toLowerCase()
            if (src.includes(`/${langPrefix}/`) || src.includes(`-${langPrefix}-`)) {
              imageUrl = src
              break
            }
          }
        }
      }

      // 3. Chercher dans og:image
      if (!imageUrl || imageUrl.includes('back-')) {
        const ogImage = document.querySelector('meta[property="og:image"]')
        if (ogImage) {
          imageUrl = ogImage.getAttribute('content') || ''
        }
      }

      // Détecter le finish
      let finish = 'standard'
      const urlPath = window.location.pathname.toLowerCase()

      if (urlPath.includes('full-art') || urlPath.includes('fullart')) {
        finish = 'full-art'
      } else if (urlPath.includes('jolly-roger') || urlPath.includes('jollyroger')) {
        finish = 'jolly-roger'
      } else if (urlPath.includes('parallel')) {
        finish = 'parallel'
      } else if (urlPath.includes('manga')) {
        finish = 'manga'
      } else if (urlPath.includes('alternate') || urlPath.includes('-alt-')) {
        finish = 'alternate'
      } else if (urlPath.includes('special-art')) {
        finish = 'special-art'
      }

      return {
        fullNumber,
        name,
        rarity,
        imageUrl,
        finish
      }
    }, language)

    if (!cardData.fullNumber) {
      logger.warn(`Numéro non trouvé pour: ${cardUrl}`)
      return null
    }

    return {
      url: cardUrl,
      fullNumber: cardData.fullNumber,
      name: cardData.name,
      rarity: cardData.rarity,
      imageUrl: cardData.imageUrl,
      finish: cardData.finish
    }

  } catch (error) {
    logger.error(`Erreur scraping ${cardUrl}: ${error}`)
    return null
  }
}

/**
 * Télécharge et optimise une image
 */
async function downloadAndOptimizeImage(
  imageUrl: string,
  page: Page
): Promise<Buffer | null> {
  try {
    // Utiliser Puppeteer pour télécharger (évite les problèmes de CORS/referrer)
    const response = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const blob = await res.blob()
        const arrayBuffer = await blob.arrayBuffer()
        return Array.from(new Uint8Array(arrayBuffer))
      } catch {
        return null
      }
    }, imageUrl)

    if (!response) return null

    const buffer = Buffer.from(response)

    // Optimiser avec Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    return optimized
  } catch (error) {
    logger.error(`Erreur téléchargement image: ${error}`)
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
    // Nettoyer le numéro pour le nom de fichier
    const safeNumber = cardNumber.replace(/[^a-zA-Z0-9-]/g, '-')
    const path = `${seriesCode}/${language.toLowerCase()}/${safeNumber}.webp`

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
 * Insère une carte dans la DB
 */
async function insertCard(
  seriesId: string,
  card: PRBCard,
  language: string,
  finalImageUrl: string
) {
  // Construire le numéro de stockage avec suffix si besoin
  let storageNumber = card.fullNumber

  if (card.finish !== 'standard') {
    const suffixes: Record<string, string> = {
      'full-art': '-FA',
      'jolly-roger': '-JR',
      'parallel': '-PR',
      'manga': '-MG',
      'alternate': '-ALT',
      'special-art': '-SA'
    }
    storageNumber += suffixes[card.finish] || ''
  }

  const { error } = await supabase
    .from('cards')
    .upsert({
      series_id: seriesId,
      name: card.name,
      number: storageNumber,
      language: language.toUpperCase(),
      rarity: card.rarity.toLowerCase(),
      image_url: finalImageUrl,
      attributes: {
        original_number: card.fullNumber,
        finish: card.finish,
        source_url: card.url
      }
    }, {
      onConflict: 'series_id,number,language',
      ignoreDuplicates: false
    })

  if (error) {
    throw new Error(error.message)
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  logger.section(`Scraping ${seriesArg} One Piece`)
  console.log(`Langue(s): ${langArg}`)
  console.log(`Dry run: ${dryRun}`)
  console.log(`Skip images: ${skipImages}`)

  const seriesId = SERIES_DB_IDS[seriesArg]
  if (!seriesId) {
    logger.error(`Série ${seriesArg} non trouvée dans la configuration`)
    process.exit(1)
  }

  const languages = langArg === 'all' ? ['EN', 'FR'] : [langArg.toUpperCase()]

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (const lang of languages) {
      logger.section(`${seriesArg} - ${lang}`)

      // 1. Récupérer les URLs des cartes
      logger.info('1. Récupération des URLs de cartes...')
      const cardUrls = await scrapeCardUrls(browser, seriesArg, lang)
      logger.success(`${cardUrls.length} cartes trouvées`)

      if (cardUrls.length === 0) {
        logger.warn(`Aucune carte trouvée pour ${seriesArg} ${lang}`)
        continue
      }

      if (dryRun) {
        logger.info('Mode dry-run - affichage des premières URLs:')
        cardUrls.slice(0, 10).forEach(url => console.log(`  ${url}`))
        continue
      }

      // 2. Parser les cartes depuis les URLs
      logger.info('\n2. Parsing des cartes depuis les URLs...')

      // Parser toutes les URLs d'abord
      const cards: PRBCard[] = []
      let parseErrors = 0

      for (const url of cardUrls) {
        const card = parseCardFromUrl(url, lang)
        if (card) {
          cards.push(card)
        } else {
          // Fallback: essayer de scraper la page
          parseErrors++
        }
      }

      logger.success(`${cards.length} cartes parsées (${parseErrors} erreurs de parsing)`)

      // 3. Télécharger les images et insérer
      logger.info('\n3. Téléchargement des images et insertion...')

      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        logger.progress(`[${i + 1}/${cards.length}] ${card.fullNumber}: ${card.name}`)

        try {
          // Télécharger et uploader l'image
          let finalImageUrl = card.imageUrl

          if (!skipImages && card.imageUrl) {
            const imageBuffer = await downloadAndOptimizeImage(card.imageUrl, page)

            if (imageBuffer) {
              const uploadedUrl = await uploadImage(
                imageBuffer,
                seriesArg,
                lang,
                card.fullNumber + (card.finish !== 'standard' ? `-${card.finish}` : '')
              )

              if (uploadedUrl) {
                finalImageUrl = uploadedUrl
              }
            }
          }

          // Insérer dans la DB
          await insertCard(seriesId, card, lang, finalImageUrl)
          successCount++

        } catch (error) {
          logger.error(`Erreur ${card.fullNumber}: ${error}`)
          errorCount++
        }

        // Rate limiting (plus court car pas de navigation)
        await delay(300)
      }

      await page.close()

      logger.section('Résumé')
      logger.success(`Succès: ${successCount}`)
      if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
    }

  } finally {
    await browser.close()
    logger.info('Navigateur fermé')
  }

  logger.section('Terminé!')
}

main().catch(console.error)
