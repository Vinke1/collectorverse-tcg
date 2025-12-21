/**
 * Script pour re-seeder les cartes OP04 EN One Piece
 * Source: https://www.opecards.fr/cards/search?page=1&sortBy=releaseR&serie=195&language=EN
 *
 * Ce script:
 * 1. Supprime toutes les images OP04/en existantes dans Supabase Storage
 * 2. Supprime toutes les cartes EN existantes de la serie OP04
 * 3. Scrape les 4 pages de OP04 EN sur opecards.fr
 * 4. Telecharge les images et les uploade sur Supabase Storage
 * 5. Insere les nouvelles cartes avec le bon numbering et noms corrects
 *
 * Usage:
 *   npx tsx scripts/reseed-onepiece-op04-en.ts
 *   npx tsx scripts/reseed-onepiece-op04-en.ts --dry-run
 *   npx tsx scripts/reseed-onepiece-op04-en.ts --skip-images
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { uploadOnePieceCardImage, deleteOnePieceSeriesImages } from '../lib/supabase/storage'

const BASE_URL = 'https://www.opecards.fr'
const OP04_SEARCH_URL = `${BASE_URL}/cards/search?sortBy=number&serie=195&language=EN`
const TOTAL_PAGES = 4

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface OP04Card {
  url: string
  slug: string
  number: string        // Format: "001", "001-ALT", "086-SP"
  displayNumber: string // Format: "OP04-001"
  name: string
  rarity: string
  imageUrl: string | null
}

// ============================================
// NAME CORRECTIONS
// ============================================

/**
 * Corrections de noms pour One Piece
 * Les noms sur le site sont parfois mal formates
 */
function correctName(name: string): string {
  return name
    // Noms avec D. (Monkey D. Luffy, Portgas D. Ace, etc.)
    .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
    .replace(/Monkey D Luffy/gi, 'Monkey D. Luffy')
    .replace(/Monkeydgarp/gi, 'Monkey D. Garp')
    .replace(/Portgasdace/gi, 'Portgas D. Ace')
    .replace(/Portgas D Ace/gi, 'Portgas D. Ace')
    .replace(/Marshalldteach/gi, 'Marshall D. Teach')
    .replace(/Marshall D Teach/gi, 'Marshall D. Teach')
    .replace(/Edwardnewgate/gi, 'Edward Newgate')
    .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
    // Charlotte
    .replace(/Charlottelinlin/gi, 'Charlotte Linlin')
    .replace(/Charlottekatakuri/gi, 'Charlotte Katakuri')
    .replace(/Charlottecracker/gi, 'Charlotte Cracker')
    .replace(/Charlottepudding/gi, 'Charlotte Pudding')
    .replace(/Charlotteperospero/gi, 'Charlotte Perospero')
    .replace(/Charlotteoven/gi, 'Charlotte Oven')
    .replace(/Charlotteopera/gi, 'Charlotte Opera')
    .replace(/Charlottegalette/gi, 'Charlotte Galette')
    .replace(/Charlottechiffon/gi, 'Charlotte Chiffon')
    .replace(/Charlottesmoothie/gi, 'Charlotte Smoothie')
    .replace(/Charlottepraline/gi, 'Charlotte Praline')
    // Rob Lucci
    .replace(/Roblucci/gi, 'Rob Lucci')
    // Donquixote
    .replace(/Donquixotedoflamingo/gi, 'Donquixote Doflamingo')
    .replace(/Donquixoterosinante/gi, 'Donquixote Rosinante')
    // Nefertari
    .replace(/Nefertarivivi/gi, 'Nefertari Vivi')
    .replace(/Nefertaricobra/gi, 'Nefertari Cobra')
    // Crocodile
    .replace(/Sircrocodile/gi, 'Sir Crocodile')
    // Autres corrections
    .replace(/Usopps Pirate Crew/gi, "Usopp's Pirate Crew")
    .replace(/Usopps Rubber Band Of Doom/gi, "Usopp's Rubber Band of Doom")
    .replace(/Sanjis Pilaf/gi, "Sanji's Pilaf")
    .replace(/Bobbin The Disposer/gi, 'Bobbin the Disposer')
    // Mr.
    .replace(/Mr(\d)/gi, 'Mr.$1')
    // Version 3 Sogeking -> Sogeking
    .replace(/^Version \d+ /i, '')
    .trim()
}

// ============================================
// PARSING
// ============================================

/**
 * Parse une URL de carte OP04
 * Format: /cards/en-op04-{number}-{rarity}-{name}
 * Exemple: /cards/en-op04-001-l-nefertarivivi
 */
function parseOP04Url(url: string): OP04Card | null {
  const slug = url.replace('/cards/', '')

  // Pattern: en-op04-{number}-{rarity}-{name}
  const match = slug.match(/^en-op04-(\d{3})-([a-z]+)-(.+)$/i)

  if (!match) {
    logger.warn(`Pattern non reconnu: ${slug}`)
    return null
  }

  const [, number, rarity, namePart] = match
  const fullCode = `OP04-${number}`

  // Verifier les variantes
  const isVersion2 = namePart.includes('version-2')
  const isVersion3 = namePart.includes('version-3')
  const isManga = namePart.includes('manga')
  const isSpecial = rarity.toLowerCase() === 'sp'

  // Construire le suffixe pour le numero de stockage
  // Version 2 = ALT, Version 3/Manga = ALT2, Special = SP
  let suffix = ''
  if (isVersion2) suffix = '-ALT'
  else if (isVersion3 || isManga) suffix = '-ALT2'
  else if (isSpecial) suffix = '-SP'

  // Nettoyer le nom
  let cleanName = namePart
    .replace(/^version-\d+-/i, '')
    .replace(/-version-\d+$/i, '')
    .replace(/^manga-/i, '')
    .replace(/-manga$/i, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Appliquer les corrections de noms
  cleanName = correctName(cleanName)

  return {
    url: `/cards/${slug}`,
    slug,
    number: `${number}${suffix}`,
    displayNumber: fullCode,
    name: cleanName,
    rarity: rarity.toUpperCase(),
    imageUrl: null
  }
}

// ============================================
// SCRAPING
// ============================================

/**
 * Scrape toutes les URLs de cartes OP04 EN depuis les 4 pages
 */
async function scrapeOP04CardUrls(browser: Browser): Promise<string[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls: string[] = []

  try {
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
      const pageUrl = `${OP04_SEARCH_URL}&page=${pageNum}`
      logger.page(`Page ${pageNum}: ${pageUrl}`)

      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 })
      await delay(2000)

      // Scroll pour charger tout le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire les URLs de cartes OP04 EN
      const cardUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les pages de recherche et generiques
            if (path === '/cards' || path === '/cards/' || path.includes('/search') || path === '/cards/cartes-les-plus-cheres') {
              return false
            }
            // Accepter uniquement les cartes OP04 EN avec prefixe en-
            // Pattern: /cards/en-op04-{number}-{rarity}-...
            return /^\/cards\/en-op04-\d{3}-[a-z]+-/i.test(path)
          })
        return [...new Set(links)]
      })

      logger.info(`  ${cardUrls.length} cartes trouvees sur la page ${pageNum}`)
      allCardUrls.push(...cardUrls)

      if (pageNum < TOTAL_PAGES) {
        await delay(DELAYS.betweenPages)
      }
    }
  } finally {
    await page.close()
  }

  // Dedupliquer
  const uniqueUrls = [...new Set(allCardUrls)]
  logger.success(`Total: ${uniqueUrls.length} URLs de cartes OP04 uniques`)

  return uniqueUrls
}

/**
 * Recupere les details d'une carte (nom correct et image depuis la page)
 */
async function fetchCardDetails(page: Page, card: OP04Card): Promise<OP04Card> {
  try {
    await page.goto(`${BASE_URL}${card.url}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)

    const details = await page.evaluate(() => {
      // Recuperer le nom depuis le titre de la page ou un element h1
      const title = document.querySelector('h1')?.textContent?.trim() ||
                    document.querySelector('.card-name')?.textContent?.trim() ||
                    document.querySelector('[class*="card-title"]')?.textContent?.trim()

      // Recuperer l'image depuis JSON-LD
      let imageUrl = null
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
            // Chercher l'image EN
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
      // Nettoyer le nom (enlever le numero de carte au debut s'il est present)
      let cleanName = details.name
        .replace(/^OP04-\d{3}\s*[-:]\s*/i, '')
        .trim()

      // Appliquer les corrections
      cleanName = correctName(cleanName)
      card.name = cleanName
    }

    if (details.imageUrl) {
      card.imageUrl = details.imageUrl
    }

    return card
  } catch (error) {
    logger.warn(`Erreur recuperation details pour ${card.url}`)
    return card
  }
}

// ============================================
// DATABASE
// ============================================

/**
 * Recupere l'ID de la serie OP04 pour One Piece
 */
async function getOP04SeriesId(): Promise<string> {
  // D'abord recuperer le tcg_game_id pour One Piece
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (tcgError || !tcg) {
    throw new Error('TCG One Piece non trouve')
  }

  // Puis recuperer la serie OP04
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP04')
    .eq('tcg_game_id', tcg.id)
    .single()

  if (seriesError || !series) {
    throw new Error('Serie OP04 non trouvee pour One Piece')
  }

  return series.id
}

/**
 * Supprime toutes les cartes EN de la serie OP04
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
    logger.info('Aucune carte EN a supprimer')
    return 0
  }

  if (dryRun) {
    logger.info(`[DRY-RUN] ${count} cartes EN seraient supprimees`)
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

  logger.success(`${count} cartes EN supprimees`)
  return count
}

/**
 * Insere une carte dans la base de donnees
 */
async function insertCard(seriesId: string, card: OP04Card): Promise<boolean> {
  if (dryRun) {
    logger.info(`[DRY-RUN] Insererait: ${card.number} - ${card.name}`)
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
        slug: card.slug
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
  logger.section('Re-seeding One Piece OP04 EN')
  console.log(`Source: ${OP04_SEARCH_URL}`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log(`Skip images: ${skipImages}`)

  try {
    // 1. Recuperer l'ID de la serie
    logger.info('\n1. Recuperation de la serie OP04...')
    const seriesId = await getOP04SeriesId()
    logger.success(`Serie OP04 trouvee: ${seriesId}`)

    // 2. Supprimer les images existantes
    if (!skipImages && !dryRun) {
      logger.section('Suppression des images existantes OP04/en')
      const deleteResult = await deleteOnePieceSeriesImages('OP04', 'en')
      if (deleteResult.success) {
        logger.success(`Images supprimees: ${deleteResult.count || 0}`)
      } else {
        logger.warn(`Erreur suppression images: ${deleteResult.error}`)
      }
    }

    // 3. Lancer le navigateur
    logger.info('\n2. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      // 4. Scraper les URLs
      logger.info('\n3. Scraping des URLs de cartes OP04 EN...')
      const cardUrls = await scrapeOP04CardUrls(browser)

      // 5. Parser les URLs
      logger.info('\n4. Parsing des URLs...')
      const cards: OP04Card[] = []

      for (const url of cardUrls) {
        const parsed = parseOP04Url(new URL(url).pathname)
        if (parsed) {
          cards.push(parsed)
        }
      }

      logger.success(`${cards.length} cartes parsees`)

      // Trier par numero
      cards.sort((a, b) => {
        const numA = parseInt(a.number.replace(/-.*$/, '')) || 0
        const numB = parseInt(b.number.replace(/-.*$/, '')) || 0
        if (numA !== numB) return numA - numB
        // Si meme numero, trier par suffixe
        return a.number.localeCompare(b.number)
      })

      // Afficher les cartes
      logger.section('Cartes trouvees')
      for (const card of cards) {
        console.log(`  ${card.number.padEnd(10)} [${card.rarity.padEnd(3)}] - ${card.name}`)
      }

      // 6. Recuperer les images et noms corrects
      if (!skipImages) {
        logger.section('Recuperation des details et images')
        const detailPage = await browser.newPage()
        await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        for (let i = 0; i < cards.length; i++) {
          logger.progress(`[${i + 1}/${cards.length}] ${cards[i].number}`)
          const enriched = await fetchCardDetails(detailPage, cards[i])
          cards[i] = enriched
          await delay(500)
        }

        await detailPage.close()
      }

      // 7. Supprimer les anciennes cartes
      logger.section('Suppression des anciennes cartes EN')
      await deleteExistingEnCards(seriesId)

      // 8. Inserer les nouvelles cartes
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
            'OP04',
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

      // Resume
      logger.section('Resume')
      logger.success(`Succes: ${successCount}`)
      if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
      logger.info(`Total: ${cards.length}`)

    } finally {
      await browser.close()
      logger.info('Navigateur ferme')
    }

    if (dryRun) {
      logger.warn('\n[DRY-RUN] Aucune modification effectuee')
    } else {
      logger.section('Termine!')
      console.log('\nVerifiez: https://www.collectorverse.io/series/onepiece/OP04')
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
