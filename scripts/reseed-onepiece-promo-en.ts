/**
 * Script pour re-seeder les cartes promo EN One Piece
 * Source: https://www.opecards.fr/cards/search?page=1&sortBy=number&serie=187&language=EN
 *
 * Ce script:
 * 1. Scrape les 4 pages de promos EN sur opecards.fr
 * 2. Supprime toutes les cartes EN existantes de la série P
 * 3. Insère les nouvelles cartes avec le bon numbering (format P-XXX)
 *
 * Usage:
 *   npx tsx scripts/reseed-onepiece-promo-en.ts
 *   npx tsx scripts/reseed-onepiece-promo-en.ts --dry-run
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'

const BASE_URL = 'https://www.opecards.fr'
const PROMO_SEARCH_URL = `${BASE_URL}/cards/search?sortBy=number&serie=187&language=EN`

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface PromoCard {
  url: string
  slug: string
  number: string        // Format: "008" (stockage interne)
  displayNumber: string // Format: "P-008" (affichage)
  name: string
  rarity: string
  imageUrl: string | null
  isVersion2: boolean
}

// ============================================
// PARSING
// ============================================

/**
 * Parse une URL de carte promo
 * Formats supportés:
 * - /cards/en-p-008-p-yamato (EN cards avec préfixe en-)
 * - /cards/en-st13-001-l-2nd-anniversary-tournament-sabo
 * - /cards/en-st06-002-c-promotion-pack-2023-vol-1-koby
 */
function parsePromoUrl(url: string): PromoCard | null {
  const slug = url.replace('/cards/', '')

  // Pattern 1: en-p-{number}-p-{name} (cartes EN avec code P)
  const pMatch = slug.match(/^en-p-(\d{3})-p-(.+)$/i)
  if (pMatch) {
    const [, number, namePart] = pMatch
    return buildPromoCard(slug, `P-${number}`, number, namePart, 'P')
  }

  // Pattern 2: en-{prefix}{set}-{number}-{rarity}-{name}
  // Examples: en-st13-001-l-..., en-st06-002-c-..., en-op05-004-uc-...
  const setMatch = slug.match(/^en-([a-z]+)(\d+)-(\d{3})-([a-z]+)-(.+)$/i)
  if (setMatch) {
    const [, prefix, setNum, number, rarity, namePart] = setMatch
    const fullCode = `${prefix.toUpperCase()}${setNum}-${number}`
    return buildPromoCard(slug, fullCode, `${prefix.toUpperCase()}${setNum}-${number}`, namePart, rarity.toUpperCase())
  }

  logger.warn(`Pattern non reconnu: ${slug}`)
  return null
}

/**
 * Construit l'objet PromoCard
 */
function buildPromoCard(slug: string, displayNumber: string, storageBase: string, namePart: string, rarity: string): PromoCard {
  // Vérifier les variantes
  const isVersion2 = namePart.includes('version-2')
  const isFullArt = namePart.includes('full-art')
  const isWinner = namePart.includes('winner')

  // Construire le suffixe pour le numéro de stockage
  let suffix = ''
  if (isVersion2) suffix = '-V2'
  else if (isFullArt) suffix = '-FA'
  else if (isWinner) suffix = '-W'

  // Nettoyer le nom
  let cleanName = namePart
    .replace(/^version-2-/, '')
    .replace(/-version-2/, '')
    .replace(/-full-art/, '')
    .replace(/^full-art-/, '')
    .replace(/-winner/, '')
    .replace(/^winner-/, '')
    // Enlever les préfixes de série promo (et leurs résidus)
    .replace(/^pack-promotionnel-vol-\d+-/, '')
    .replace(/^promotionnel-vol-\d+-/, '')
    .replace(/-?sr-?$/i, '')
    .replace(/^sr-/i, '')
    .replace(/^dash-pack-volume-\d+-/, '')
    .replace(/^fete-decks-debutants-st\d+-st\d+-/, '')
    .replace(/^evenement-de-sortie-op\d+-/, '')
    .replace(/^festival-de-jeu-cannes-/, '')
    .replace(/^pack-devenement-de-sortie-st\d+-st\d+-/, '')
    .replace(/^pack-winner-devenement-de-sortie-st\d+-st\d+-/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Corrections de noms courants
  cleanName = cleanName
    .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
    .replace(/Monkey D Luffy/gi, 'Monkey D. Luffy')
    .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
    .replace(/Portgas D Ace/gi, 'Portgas D. Ace')
    .replace(/Mr1 Das Bones/gi, 'Mr.1 (Das Bones)')
    .replace(/Mr1/gi, 'Mr.1')

  // Ajouter des indicateurs au nom si variante
  let displayName = cleanName
  if (isFullArt) displayName += ' (Full Art)'
  if (isWinner) displayName += ' (Winner)'
  if (isVersion2) displayName += ' (V2)'

  return {
    url: `/cards/${slug}`,
    slug,
    number: `${storageBase}${suffix}`,
    displayNumber,
    name: displayName,
    rarity,
    imageUrl: null,
    isVersion2: isVersion2 || isFullArt || isWinner
  }
}

// ============================================
// SCRAPING
// ============================================

/**
 * Scrape toutes les URLs de cartes promo EN depuis les 4 pages
 */
async function scrapePromoCardUrls(browser: Browser): Promise<string[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls: string[] = []

  try {
    for (let pageNum = 1; pageNum <= 4; pageNum++) {
      const pageUrl = `${PROMO_SEARCH_URL}&page=${pageNum}`
      logger.page(`Page ${pageNum}: ${pageUrl}`)

      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 })
      await delay(2000)

      // Scroll pour charger tout le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire les URLs de cartes EN (tous les formats: en-p-XXX, en-stXX-XXX, en-opXX-XXX, etc.)
      const cardUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les pages de recherche et génériques
            if (path === '/cards' || path === '/cards/' || path.includes('/search') || path === '/cards/cartes-les-plus-cheres') {
              return false
            }
            // Accepter tous les formats de cartes promo EN avec préfixe en-
            // Pattern: /cards/en-p-{number}-p-... ou /cards/en-{code}{number}-{number}-{rarity}-...
            return /^\/cards\/en-(p-\d{3}-p-|[a-z]+\d+-\d{3}-[a-z]+-)/i.test(path)
          })
        return [...new Set(links)]
      })

      logger.info(`  ${cardUrls.length} cartes trouvées sur la page ${pageNum}`)
      allCardUrls.push(...cardUrls)

      if (pageNum < 4) {
        await delay(DELAYS.betweenPages)
      }
    }
  } finally {
    await page.close()
  }

  // Dédupliquer
  const uniqueUrls = [...new Set(allCardUrls)]
  logger.success(`Total: ${uniqueUrls.length} URLs de cartes promo uniques`)

  return uniqueUrls
}

/**
 * Récupère l'image d'une carte depuis sa page de détail
 */
async function fetchCardImage(page: Page, cardUrl: string): Promise<string | null> {
  try {
    await page.goto(`${BASE_URL}${cardUrl}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)

    const imageUrl = await page.evaluate(() => {
      // Chercher dans le JSON-LD
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            // Prendre la première image EN ou la première disponible
            const enImage = images.find((img: string) => img.includes('/en/') || img.includes('-en-'))
            return enImage || images[0]
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Fallback: og:image
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
      if (ogImage?.content) {
        return ogImage.content
      }

      // Fallback: première image de carte
      const cardImg = document.querySelector('img[src*="opecards"], img[src*="static.opecards"]') as HTMLImageElement
      return cardImg?.src || null
    })

    return imageUrl
  } catch (error) {
    logger.warn(`Erreur récupération image pour ${cardUrl}: ${error}`)
    return null
  }
}

/**
 * Récupère les détails d'une carte (nom correct depuis la page)
 */
async function fetchCardDetails(page: Page, card: PromoCard): Promise<PromoCard> {
  try {
    await page.goto(`${BASE_URL}${card.url}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)

    const details = await page.evaluate(() => {
      // Récupérer le nom depuis le titre de la page ou un élément h1
      const title = document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('.card-name')?.textContent?.trim() ||
                    document.querySelector('[class*="card-title"]')?.textContent?.trim()

      // Récupérer l'image depuis JSON-LD
      let imageUrl = null
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            imageUrl = images.find((img: string) => img.includes('/en/')) || images[0]
          }
        } catch (e) {
          // Ignore
        }
      }

      // Fallback og:image
      if (!imageUrl) {
        const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
        imageUrl = ogImage?.content || null
      }

      return { name: title, imageUrl }
    })

    if (details.name) {
      // Nettoyer le nom (enlever le numéro de carte au début s'il est présent)
      let cleanName = details.name
        .replace(/^P-\d{3}\s*[-:]\s*/i, '')
        .trim()

      card.name = cleanName
    }

    if (details.imageUrl) {
      card.imageUrl = details.imageUrl
    }

    return card
  } catch (error) {
    logger.warn(`Erreur récupération détails pour ${card.url}`)
    return card
  }
}

// ============================================
// DATABASE
// ============================================

/**
 * Récupère l'ID de la série P pour One Piece
 */
async function getPromoSeriesId(): Promise<string> {
  // D'abord récupérer le tcg_game_id pour One Piece
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (tcgError || !tcg) {
    throw new Error('TCG One Piece non trouvé')
  }

  // Puis récupérer la série P
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'P')
    .eq('tcg_game_id', tcg.id)
    .single()

  if (seriesError || !series) {
    throw new Error('Série P non trouvée pour One Piece')
  }

  return series.id
}

/**
 * Supprime toutes les cartes EN de la série P
 */
async function deleteExistingEnCards(seriesId: string): Promise<number> {
  const { data: cards, error: countError } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('language', 'EN')

  if (countError) {
    throw new Error(`Erreur comptage cartes: ${countError.message}`)
  }

  const count = cards?.length || 0

  if (count === 0) {
    logger.info('Aucune carte EN à supprimer')
    return 0
  }

  if (dryRun) {
    logger.info(`[DRY-RUN] ${count} cartes EN seraient supprimées`)
    return count
  }

  const { error: deleteError } = await supabase
    .from('cards')
    .delete()
    .eq('series_id', seriesId)
    .eq('language', 'EN')

  if (deleteError) {
    throw new Error(`Erreur suppression: ${deleteError.message}`)
  }

  logger.success(`${count} cartes EN supprimées`)
  return count
}

/**
 * Insère une carte dans la base de données
 */
async function insertCard(seriesId: string, card: PromoCard): Promise<boolean> {
  if (dryRun) {
    logger.info(`[DRY-RUN] Insérerait: ${card.number} - ${card.name}`)
    return true
  }

  const { error } = await supabase
    .from('cards')
    .upsert({
      series_id: seriesId,
      name: card.name,
      number: card.number,
      language: 'EN',
      rarity: card.rarity,
      image_url: card.imageUrl,
      attributes: {
        display_number: card.displayNumber,
        slug: card.slug,
        is_version_2: card.isVersion2
      }
    }, {
      onConflict: 'series_id,number,language',
      ignoreDuplicates: false
    })

  if (error) {
    logger.error(`Erreur insertion ${card.number}: ${error.message}`)
    return false
  }

  return true
}

// ============================================
// MAIN
// ============================================

async function main() {
  logger.section('Re-seeding One Piece Promo EN')
  console.log(`Source: ${PROMO_SEARCH_URL}`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log(`Skip images: ${skipImages}`)

  try {
    // 1. Récupérer l'ID de la série
    logger.info('\n1. Récupération de la série P...')
    const seriesId = await getPromoSeriesId()
    logger.success(`Série P trouvée: ${seriesId}`)

    // 2. Lancer le navigateur
    logger.info('\n2. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      // 3. Scraper les URLs
      logger.info('\n3. Scraping des URLs de cartes promo EN...')
      const cardUrls = await scrapePromoCardUrls(browser)

      // 4. Parser les URLs
      logger.info('\n4. Parsing des URLs...')
      const cards: PromoCard[] = []

      for (const url of cardUrls) {
        const parsed = parsePromoUrl(new URL(url).pathname)
        if (parsed) {
          cards.push(parsed)
        }
      }

      logger.success(`${cards.length} cartes parsées`)

      // Trier par numéro
      cards.sort((a, b) => {
        const numA = parseInt(a.number.split('-')[0]) || 0
        const numB = parseInt(b.number.split('-')[0]) || 0
        if (numA !== numB) return numA - numB
        // Version 2 après la version normale
        return a.isVersion2 ? 1 : -1
      })

      // Afficher les cartes
      logger.section('Cartes trouvées')
      for (const card of cards) {
        console.log(`  ${card.number.padEnd(8)} ${card.displayNumber.padEnd(8)} - ${card.name}${card.isVersion2 ? ' (v2)' : ''}`)
      }

      // 5. Récupérer les images et noms corrects
      if (!skipImages) {
        logger.section('Récupération des détails et images')
        const detailPage = await browser.newPage()
        await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        for (let i = 0; i < cards.length; i++) {
          logger.progress(`[${i + 1}/${cards.length}] ${cards[i].displayNumber}`)
          const enriched = await fetchCardDetails(detailPage, cards[i])
          cards[i] = enriched
          await delay(500)
        }

        await detailPage.close()
      }

      // 6. Supprimer les anciennes cartes
      logger.section('Suppression des anciennes cartes EN')
      await deleteExistingEnCards(seriesId)

      // 7. Insérer les nouvelles cartes
      logger.section('Insertion des nouvelles cartes')
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        logger.progress(`[${i + 1}/${cards.length}] ${card.number} - ${card.name}`)

        // Upload de l'image si disponible
        if (!skipImages && card.imageUrl && !dryRun) {
          const imageResult = await uploadOnePieceCardImage(
            card.imageUrl,
            card.number,
            'P',
            'en'
          )

          if (imageResult.success && imageResult.url) {
            card.imageUrl = imageResult.url
          }
        }

        const success = await insertCard(seriesId, card)
        if (success) {
          successCount++
        } else {
          errorCount++
        }

        await delay(DELAYS.betweenUploads)
      }

      // Résumé
      logger.section('Résumé')
      logger.success(`Succès: ${successCount}`)
      if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
      logger.info(`Total: ${cards.length}`)

    } finally {
      await browser.close()
      logger.info('Navigateur fermé')
    }

    if (dryRun) {
      logger.warn('\n[DRY-RUN] Aucune modification effectuée')
    } else {
      logger.section('Terminé!')
      console.log('\nVérifiez: https://www.collectorverse.io/series/onepiece/P')
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
