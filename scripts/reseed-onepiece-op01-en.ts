/**
 * Script pour re-seeder la série One Piece OP01 EN
 * Source: https://www.opecards.fr/cards/search?page=1&sortBy=number&serie=180&language=EN
 *
 * Ce script:
 * 1. Scrape les 6 pages de cartes OP01 EN sur opecards.fr (série ID 180)
 * 2. Supprime toutes les cartes EN existantes de la série OP01
 * 3. Insère les nouvelles cartes avec le bon numbering (format OP01-XXX)
 *
 * Usage:
 *   npx tsx scripts/reseed-onepiece-op01-en.ts
 *   npx tsx scripts/reseed-onepiece-op01-en.ts --dry-run
 *   npx tsx scripts/reseed-onepiece-op01-en.ts --skip-images
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'

const BASE_URL = 'https://www.opecards.fr'
const OP01_SEARCH_URL = `${BASE_URL}/cards/search?sortBy=number&serie=180&language=EN`
const TOTAL_PAGES = 6

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface OP01Card {
  url: string
  slug: string
  number: string        // Format: "001" (stockage interne)
  displayNumber: string // Format: "OP01-001" (affichage)
  name: string
  rarity: string
  imageUrl: string | null
  finish: 'standard' | 'alternate' | 'special'
  isAlternateArt: boolean
}

// ============================================
// PARSING
// ============================================

/**
 * Parse une URL de carte OP01 EN
 * Formats supportés:
 * - /cards/en-op01-001-l-roronoa-zoro
 * - /cards/en-op01-001-l-version-2-roronoa-zoro
 * - /cards/en-op01-001-sr-full-art-monkey-d-luffy
 */
function parseOP01Url(url: string): OP01Card | null {
  const slug = url.replace('/cards/', '')

  // Pattern: en-op01-{number}-{rarity}-{name}
  const match = slug.match(/^en-op01-(\d{3})-([a-z]+)-(.+)$/i)
  if (!match) {
    logger.warn(`Pattern non reconnu: ${slug}`)
    return null
  }

  const [, number, rarity, namePart] = match

  // Vérifier les variantes
  const isVersion2 = namePart.includes('version-2')
  const isFullArt = namePart.includes('full-art')
  const isAlternateArt = namePart.includes('alternate-art')
  const isSpecial = namePart.includes('special') || namePart.includes('premium')

  // Déterminer le finish
  let finish: 'standard' | 'alternate' | 'special' = 'standard'
  if (isSpecial) finish = 'special'
  else if (isVersion2 || isFullArt || isAlternateArt) finish = 'alternate'

  // Construire le suffixe pour le numéro de stockage
  let suffix = ''
  if (isVersion2) suffix = '-V2'
  else if (isFullArt) suffix = '-FA'
  else if (isAlternateArt) suffix = '-AA'
  else if (isSpecial) suffix = '-SP'

  // Nettoyer le nom
  let cleanName = namePart
    .replace(/^version-2-/, '')
    .replace(/-version-2/, '')
    .replace(/^full-art-/, '')
    .replace(/-full-art/, '')
    .replace(/^alternate-art-/, '')
    .replace(/-alternate-art/, '')
    .replace(/^special-/, '')
    .replace(/-special/, '')
    .replace(/^premium-/, '')
    .replace(/-premium/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Corrections de noms courants
  cleanName = cleanName
    .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
    .replace(/Monkey D Luffy/gi, 'Monkey D. Luffy')
    .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
    .replace(/Portgas D Ace/gi, 'Portgas D. Ace')
    .replace(/Nefertari Vivi/gi, 'Nefertari Vivi')

  // Ajouter des indicateurs au nom si variante
  let displayName = cleanName
  if (isFullArt) displayName += ' (Full Art)'
  if (isAlternateArt) displayName += ' (Alternate Art)'
  if (isVersion2) displayName += ' (V2)'
  if (isSpecial) displayName += ' (Special)'

  return {
    url: `/cards/${slug}`,
    slug,
    number: `${number}${suffix}`,
    displayNumber: `OP01-${number}`,
    name: displayName,
    rarity: rarity.toUpperCase(),
    imageUrl: null,
    finish,
    isAlternateArt: finish !== 'standard'
  }
}

// ============================================
// SCRAPING
// ============================================

/**
 * Scrape toutes les URLs de cartes OP01 EN depuis les 6 pages
 * Utilise la navigation directe par URL (plus fiable que le clic pour opecards.fr)
 */
async function scrapeOP01CardUrls(browser: Browser): Promise<string[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls: string[] = []

  try {
    // Boucle sur toutes les pages
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
      const pageUrl = `${OP01_SEARCH_URL}&page=${pageNum}`
      logger.page(`Page ${pageNum}/${TOTAL_PAGES}: ${pageUrl}`)

      await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 })
      await delay(1000)

      // Scroll pour charger tout le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire les URLs de cartes EN avec pattern en-op01-XXX
      const cardUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les pages de recherche et génériques
            if (path === '/cards' || path === '/cards/' || path.includes('/search') || path === '/cards/cartes-les-plus-cheres') {
              return false
            }
            // Accepter uniquement les cartes OP01 EN
            return /^\/cards\/en-op01-\d{3}-[a-z]+-/i.test(path)
          })
        return [...new Set(links)]
      })

      logger.info(`  ${cardUrls.length} cartes trouvées sur la page ${pageNum}`)
      allCardUrls.push(...cardUrls)

      if (pageNum < TOTAL_PAGES) {
        await delay(DELAYS.betweenPages)
      }
    }
  } finally {
    await page.close()
  }

  // Dédupliquer
  const uniqueUrls = [...new Set(allCardUrls)]
  logger.success(`Total: ${uniqueUrls.length} URLs de cartes OP01 EN uniques`)

  return uniqueUrls
}

/**
 * Récupère les détails d'une carte depuis sa page
 */
async function fetchCardDetails(page: Page, card: OP01Card): Promise<OP01Card> {
  try {
    await page.goto(`${BASE_URL}${card.url}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)

    const details = await page.evaluate(() => {
      // Récupérer le nom depuis le titre de la page
      const title = document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('.card-name')?.textContent?.trim() ||
                    document.querySelector('[class*="card-title"]')?.textContent?.trim()

      // Récupérer l'image depuis JSON-LD (prioritaire)
      let imageUrl = null
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            // Prendre l'image EN ou la première disponible
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
      // Nettoyer le nom (enlever le code de carte au début s'il est présent)
      let cleanName = details.name
        .replace(/^OP01-\d{3}\s*[-:]\s*/i, '')
        .trim()

      // Garder les indicateurs de variante si présents dans le nom original
      if (!cleanName.includes('Full Art') && card.name.includes('(Full Art)')) {
        cleanName += ' (Full Art)'
      }
      if (!cleanName.includes('V2') && card.name.includes('(V2)')) {
        cleanName += ' (V2)'
      }
      if (!cleanName.includes('Alternate Art') && card.name.includes('(Alternate Art)')) {
        cleanName += ' (Alternate Art)'
      }
      if (!cleanName.includes('Special') && card.name.includes('(Special)')) {
        cleanName += ' (Special)'
      }

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
 * Récupère l'ID de la série OP01 pour One Piece
 */
async function getOP01SeriesId(): Promise<string> {
  // D'abord récupérer le tcg_game_id pour One Piece
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (tcgError || !tcg) {
    throw new Error('TCG One Piece non trouvé')
  }

  // Puis récupérer la série OP01
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP01')
    .eq('tcg_game_id', tcg.id)
    .single()

  if (seriesError || !series) {
    throw new Error('Série OP01 non trouvée pour One Piece')
  }

  return series.id
}

/**
 * Supprime toutes les cartes EN de la série OP01
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
async function insertCard(seriesId: string, card: OP01Card): Promise<boolean> {
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
        finish: card.finish,
        is_foil: card.finish !== 'standard',
        is_standard: card.finish === 'standard',
        alternate_art: card.isAlternateArt
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
  logger.section('Re-seeding One Piece OP01 EN')
  console.log(`Source: ${OP01_SEARCH_URL}`)
  console.log(`Pages: ${TOTAL_PAGES}`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log(`Skip images: ${skipImages}`)

  try {
    // 1. Récupérer l'ID de la série
    logger.info('\n1. Récupération de la série OP01...')
    const seriesId = await getOP01SeriesId()
    logger.success(`Série OP01 trouvée: ${seriesId}`)

    // 2. Lancer le navigateur
    logger.info('\n2. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      // 3. Scraper les URLs
      logger.info('\n3. Scraping des URLs de cartes OP01 EN...')
      const cardUrls = await scrapeOP01CardUrls(browser)

      // 4. Parser les URLs
      logger.info('\n4. Parsing des URLs...')
      const cards: OP01Card[] = []

      for (const url of cardUrls) {
        const parsed = parseOP01Url(new URL(url).pathname)
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
        // Variantes après la version normale
        return a.isAlternateArt ? 1 : -1
      })

      // Afficher les cartes
      logger.section('Cartes trouvées')
      for (const card of cards) {
        console.log(`  ${card.number.padEnd(10)} ${card.displayNumber.padEnd(10)} ${card.rarity.padEnd(3)} - ${card.name}`)
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
            'OP01',
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
      console.log('\nVérifiez: https://www.collectorverse.io/series/onepiece/OP01')
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
