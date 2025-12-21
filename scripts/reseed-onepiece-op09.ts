/**
 * Script pour re-seeder les cartes OP09 One Piece (EN et FR)
 * Source EN: https://www.opecards.fr/cards/search?page=1&sortBy=releaseR&serie=462&language=EN (6 pages)
 * Source FR: https://www.opecards.fr/cards/search?page=1&sortBy=releaseR&serie=477&language=FR
 *
 * Ce script:
 * 1. Supprime toutes les images OP09 existantes dans Supabase Storage
 * 2. Supprime toutes les cartes existantes de la serie OP09
 * 3. Scrape les pages de OP09 sur opecards.fr (EN et FR)
 * 4. Telecharge les images et les uploade sur Supabase Storage
 * 5. Insere les nouvelles cartes avec le bon numbering et noms corrects
 *
 * Usage:
 *   npx tsx scripts/reseed-onepiece-op09.ts
 *   npx tsx scripts/reseed-onepiece-op09.ts --dry-run
 *   npx tsx scripts/reseed-onepiece-op09.ts --lang=en
 *   npx tsx scripts/reseed-onepiece-op09.ts --lang=fr
 *   npx tsx scripts/reseed-onepiece-op09.ts --skip-images
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { uploadOnePieceCardImage, deleteOnePieceSeriesImages } from '../lib/supabase/storage'

const BASE_URL = 'https://www.opecards.fr'

// Configuration pour chaque langue
// Note: FR n'a pas de prefixe de langue dans les URLs (op09-xxx) contrairement a EN (en-op09-xxx)
const LANG_CONFIG = {
  en: {
    searchUrl: `${BASE_URL}/cards/search?sortBy=releaseR&serie=462&language=EN`,
    totalPages: 6,
    urlPrefix: 'en-op09',
    urlPattern: /^\/cards\/en-op09-(\d{3})-([a-z]+)-(.+)$/i,
    storageLang: 'en'
  },
  fr: {
    searchUrl: `${BASE_URL}/cards/search?sortBy=releaseR&serie=477&language=FR`,
    totalPages: 6,
    urlPrefix: 'op09', // FR n'a pas de prefixe de langue
    urlPattern: /^\/cards\/op09-(\d{3})-([a-z]+)-(.+)$/i,
    storageLang: 'fr'
  }
}

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipImages = args.includes('--skip-images')
const langArg = args.find(a => a.startsWith('--lang='))?.replace('--lang=', '').toLowerCase()
const langsToProcess = langArg ? [langArg as 'en' | 'fr'] : ['en', 'fr'] as const

const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface OP09Card {
  url: string
  slug: string
  number: string        // Format: "001", "001-ALT", "086-SP"
  displayNumber: string // Format: "OP09-001"
  name: string
  rarity: string
  imageUrl: string | null
  language: 'EN' | 'FR'
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
    .replace(/Monkeyddragon/gi, 'Monkey D. Dragon')
    .replace(/Monkey D Dragon/gi, 'Monkey D. Dragon')
    .replace(/Portgasdace/gi, 'Portgas D. Ace')
    .replace(/Portgas D Ace/gi, 'Portgas D. Ace')
    .replace(/Marshalldteach/gi, 'Marshall D. Teach')
    .replace(/Marshall D Teach/gi, 'Marshall D. Teach')
    .replace(/Edwardnewgate/gi, 'Edward Newgate')
    .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
    .replace(/Jaguardsaul/gi, 'Jaguar D. Saul')
    // Curly Dadan
    .replace(/Curlydadan/gi, 'Curly Dadan')
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
    // Hody Jones
    .replace(/Hodyjones/gi, 'Hody Jones')
    .replace(/Hody Jones/gi, 'Hody Jones')
    // Emporio Ivankov
    .replace(/Emporioivankov/gi, 'Emporio Ivankov')
    // Vinsmoke
    .replace(/Vinsmokeichiji/gi, 'Vinsmoke Ichiji')
    .replace(/Vinsmokeniji/gi, 'Vinsmoke Niji')
    .replace(/Vinsmokeyonji/gi, 'Vinsmoke Yonji')
    .replace(/Vinsmokereiju/gi, 'Vinsmoke Reiju')
    .replace(/Vinsmokejudge/gi, 'Vinsmoke Judge')
    .replace(/Vinsmokesora/gi, 'Vinsmoke Sora')
    // Kouzuki
    .replace(/Kouzukihiyori/gi, 'Kouzuki Hiyori')
    .replace(/Kouzukimomonosuke/gi, 'Kouzuki Momonosuke')
    // Gecko Moria
    .replace(/Geckomoria/gi, 'Gecko Moria')
    // Roronoa Zoro
    .replace(/Roronoazoro/gi, 'Roronoa Zoro')
    // Vander Decken
    .replace(/Vander Decken Ix/gi, 'Vander Decken IX')
    // Tony Tony Chopper
    .replace(/Tonytony Chopper/gi, 'Tony Tony.Chopper')
    .replace(/Tonytony\.chopper/gi, 'Tony Tony.Chopper')
    .replace(/Tony Tony Chopper/gi, 'Tony Tony.Chopper')
    // Nico Robin
    .replace(/Nicorobin/gi, 'Nico Robin')
    // Silvers Rayleigh
    .replace(/Silversrayleigh/gi, 'Silvers Rayleigh')
    // Brook
    .replace(/Soulking Brook/gi, 'Soul King Brook')
    // Sakazuki
    .replace(/Admiralsakazuki/gi, 'Admiral Sakazuki')
    // Kaido
    .replace(/Kaidoof The Beasts/gi, 'Kaido of the Beasts')
    // Shanks
    .replace(/Redhaired Shanks/gi, 'Red-Haired Shanks')
    // Autres corrections
    .replace(/Usopps Pirate Crew/gi, "Usopp's Pirate Crew")
    .replace(/Usopps Rubber Band Of Doom/gi, "Usopp's Rubber Band of Doom")
    .replace(/Sanjis Pilaf/gi, "Sanji's Pilaf")
    .replace(/Bobbin The Disposer/gi, 'Bobbin the Disposer')
    // O-Nami
    .replace(/O Nami/gi, 'O-Nami')
    // Mr.
    .replace(/Mr(\d)/gi, 'Mr.$1')
    // Supprimer les prefixes Op09
    .replace(/^Op09\s+/i, '')
    // Version 3 Sogeking -> Sogeking
    .replace(/^Version \d+ /i, '')
    .trim()
}

// ============================================
// PARSING
// ============================================

/**
 * Parse une URL de carte OP09
 * Format EN: /cards/en-op09-{number}-{rarity}-{name}
 * Format FR: /cards/op09-{number}-{rarity}-{name} (pas de prefixe fr-)
 * Exemple: /cards/en-op09-001-l-shanks
 */
function parseOP09Url(url: string, lang: 'en' | 'fr'): OP09Card | null {
  const config = LANG_CONFIG[lang]
  const slug = url.replace('/cards/', '')

  // Utiliser le pattern specifique a la langue
  const match = url.match(config.urlPattern)

  if (!match) {
    logger.warn(`Pattern non reconnu: ${slug}`)
    return null
  }

  const [, number, rarity, namePart] = match
  const fullCode = `OP09-${number}`

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
    imageUrl: null,
    language: lang.toUpperCase() as 'EN' | 'FR'
  }
}

// ============================================
// SCRAPING
// ============================================

/**
 * Scrape toutes les URLs de cartes OP09 depuis les pages de recherche
 */
async function scrapeOP09CardUrls(browser: Browser, lang: 'en' | 'fr'): Promise<string[]> {
  const config = LANG_CONFIG[lang]
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls: string[] = []
  const urlPrefix = config.urlPrefix // 'en-op09' pour EN, 'op09' pour FR

  try {
    // D'abord determiner le nombre total de pages
    const firstPageUrl = `${config.searchUrl}&page=1`
    await page.goto(firstPageUrl, { waitUntil: 'networkidle2', timeout: 60000 })
    await delay(2000)

    // Trouver le nombre total de pages depuis la pagination
    const totalPages = await page.evaluate(() => {
      const paginationLinks = Array.from(document.querySelectorAll('.pagination .page-link, [class*="pagination"] a'))
      const pageNumbers = paginationLinks
        .map(link => {
          const text = link.textContent?.trim() || ''
          const num = parseInt(text)
          return isNaN(num) ? 0 : num
        })
        .filter(n => n > 0)
      return Math.max(...pageNumbers, 1)
    })

    logger.info(`${lang.toUpperCase()}: ${totalPages} pages detectees`)

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageUrl = `${config.searchUrl}&page=${pageNum}`
      logger.page(`Page ${pageNum}/${totalPages}: ${pageUrl}`)

      if (pageNum > 1) {
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 })
        await delay(2000)
      }

      // Scroll pour charger tout le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire les URLs de cartes OP09
      const cardUrls = await page.evaluate((prefix) => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les pages de recherche et generiques
            if (path === '/cards' || path === '/cards/' || path.includes('/search') || path === '/cards/cartes-les-plus-cheres') {
              return false
            }
            // Accepter uniquement les cartes OP09 avec le bon prefixe
            // EN: /cards/en-op09-{number}-{rarity}-...
            // FR: /cards/op09-{number}-{rarity}-... (pas de prefixe fr-)
            const pattern = new RegExp(`^/cards/${prefix}-\\d{3}-[a-z]+-`, 'i')
            return pattern.test(path)
          })
        return [...new Set(links)]
      }, urlPrefix)

      logger.info(`  ${cardUrls.length} cartes trouvees sur la page ${pageNum}`)
      allCardUrls.push(...cardUrls)

      if (pageNum < totalPages) {
        await delay(DELAYS.betweenPages)
      }
    }
  } finally {
    await page.close()
  }

  // Dedupliquer
  const uniqueUrls = [...new Set(allCardUrls)]
  logger.success(`Total ${lang.toUpperCase()}: ${uniqueUrls.length} URLs de cartes OP09 uniques`)

  return uniqueUrls
}

/**
 * Recupere les details d'une carte (nom correct et image depuis la page)
 */
async function fetchCardDetails(page: Page, card: OP09Card): Promise<OP09Card> {
  try {
    await page.goto(`${BASE_URL}${card.url}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1000)

    const lang = card.language.toLowerCase()

    const details = await page.evaluate((cardLang) => {
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
            // Chercher l'image dans la langue correspondante
            imageUrl = images.find((img: string) => img.includes(`/${cardLang}/`)) || images[0]
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
    }, lang)

    if (details.name) {
      // Nettoyer le nom (enlever le numero de carte au debut s'il est present)
      let cleanName = details.name
        .replace(/^OP09-\d{3}\s*[-:]\s*/i, '')
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
 * Recupere l'ID de la serie OP09 pour One Piece
 */
async function getOP09SeriesId(): Promise<string> {
  // D'abord recuperer le tcg_game_id pour One Piece
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (tcgError || !tcg) {
    throw new Error('TCG One Piece non trouve')
  }

  // Puis recuperer la serie OP09
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP09')
    .eq('tcg_game_id', tcg.id)
    .single()

  if (seriesError || !series) {
    throw new Error('Serie OP09 non trouvee pour One Piece')
  }

  return series.id
}

/**
 * Supprime toutes les cartes d'une langue de la serie OP09
 */
async function deleteExistingCards(seriesId: string, lang: 'EN' | 'FR'): Promise<number> {
  const { data: cards, error: countError } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('language', lang)

  if (countError) {
    throw new Error(`Erreur comptage cartes: ${countError.message}`)
  }

  const count = cards?.length || 0

  if (count === 0) {
    logger.info(`Aucune carte ${lang} a supprimer`)
    return 0
  }

  if (dryRun) {
    logger.info(`[DRY-RUN] ${count} cartes ${lang} seraient supprimees`)
    return count
  }

  const { error: deleteError } = await supabase
    .from('cards')
    .delete()
    .eq('series_id', seriesId)
    .eq('language', lang)

  if (deleteError) {
    throw new Error(`Erreur suppression: ${deleteError.message}`)
  }

  logger.success(`${count} cartes ${lang} supprimees`)
  return count
}

/**
 * Insere une carte dans la base de donnees
 */
async function insertCard(seriesId: string, card: OP09Card): Promise<boolean> {
  if (dryRun) {
    logger.info(`[DRY-RUN] Insererait: ${card.language} ${card.number} - ${card.name}`)
    return true
  }

  const { error } = await supabase
    .from('cards')
    .upsert({
      series_id: seriesId,
      name: card.name,
      number: card.number,
      language: card.language,
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
// PROCESS LANGUAGE
// ============================================

async function processLanguage(browser: Browser, seriesId: string, lang: 'en' | 'fr'): Promise<{ success: number; error: number }> {
  const langUpper = lang.toUpperCase() as 'EN' | 'FR'
  const config = LANG_CONFIG[lang]

  logger.section(`Traitement ${langUpper}`)
  console.log(`Source: ${config.searchUrl}`)

  // 1. Supprimer les images existantes
  if (!skipImages && !dryRun) {
    logger.info(`Suppression des images existantes OP09/${lang}`)
    const deleteResult = await deleteOnePieceSeriesImages('OP09', lang)
    if (deleteResult.success) {
      logger.success(`Images supprimees: ${deleteResult.count || 0}`)
    } else {
      logger.warn(`Erreur suppression images: ${deleteResult.error}`)
    }
  }

  // 2. Scraper les URLs
  logger.info(`Scraping des URLs de cartes OP09 ${langUpper}...`)
  const cardUrls = await scrapeOP09CardUrls(browser, lang)

  // 3. Parser les URLs
  logger.info('Parsing des URLs...')
  const cards: OP09Card[] = []

  for (const url of cardUrls) {
    const parsed = parseOP09Url(new URL(url).pathname, lang)
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
  logger.info(`Cartes ${langUpper} trouvees:`)
  for (const card of cards.slice(0, 10)) {
    console.log(`  ${card.number.padEnd(10)} [${card.rarity.padEnd(3)}] - ${card.name}`)
  }
  if (cards.length > 10) {
    console.log(`  ... et ${cards.length - 10} autres cartes`)
  }

  // 4. Recuperer les images et noms corrects
  if (!skipImages) {
    logger.info('Recuperation des details et images...')
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

  // 5. Supprimer les anciennes cartes
  logger.info(`Suppression des anciennes cartes ${langUpper}...`)
  await deleteExistingCards(seriesId, langUpper)

  // 6. Inserer les nouvelles cartes
  logger.info(`Insertion des nouvelles cartes ${langUpper}...`)
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
        'OP09',
        lang
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

  logger.success(`${langUpper}: ${successCount} succes, ${errorCount} erreurs`)

  return { success: successCount, error: errorCount }
}

// ============================================
// MAIN
// ============================================

async function main() {
  logger.section('Re-seeding One Piece OP09')
  console.log(`Langues: ${langsToProcess.join(', ').toUpperCase()}`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log(`Skip images: ${skipImages}`)

  try {
    // 1. Recuperer l'ID de la serie
    logger.info('\n1. Recuperation de la serie OP09...')
    const seriesId = await getOP09SeriesId()
    logger.success(`Serie OP09 trouvee: ${seriesId}`)

    // 2. Lancer le navigateur
    logger.info('\n2. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const results: Record<string, { success: number; error: number }> = {}

    try {
      // 3. Traiter chaque langue
      for (const lang of langsToProcess) {
        results[lang] = await processLanguage(browser, seriesId, lang)
      }

    } finally {
      await browser.close()
      logger.info('Navigateur ferme')
    }

    // Resume final
    logger.section('Resume final')
    let totalSuccess = 0
    let totalError = 0
    for (const [lang, result] of Object.entries(results)) {
      console.log(`${lang.toUpperCase()}: ${result.success} succes, ${result.error} erreurs`)
      totalSuccess += result.success
      totalError += result.error
    }
    console.log(`Total: ${totalSuccess} succes, ${totalError} erreurs`)

    if (dryRun) {
      logger.warn('\n[DRY-RUN] Aucune modification effectuee')
    } else {
      logger.section('Termine!')
      console.log('\nVerifiez: https://www.collectorverse.io/series/onepiece/OP09')
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
