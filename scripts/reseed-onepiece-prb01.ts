/**
 * Script pour re-seeder les cartes PRB01 One Piece (EN et FR)
 * Source EN: https://www.opecards.fr/cards/search?page=1&sortBy=releaseR&serie=435&language=EN (12 pages)
 * Source FR: https://www.opecards.fr/cards/search?page=1&sortBy=releaseR&serie=478&language=FR (14 pages)
 *
 * Ce script:
 * 1. Supprime toutes les images PRB01 existantes dans Supabase Storage
 * 2. Supprime toutes les cartes existantes de la serie PRB01
 * 3. Scrape les pages de PRB01 sur opecards.fr (EN et FR)
 * 4. Telecharge les images et les uploade sur Supabase Storage
 * 5. Insere les nouvelles cartes avec le bon numbering et noms corrects
 *
 * Usage:
 *   npx tsx scripts/reseed-onepiece-prb01.ts
 *   npx tsx scripts/reseed-onepiece-prb01.ts --dry-run
 *   npx tsx scripts/reseed-onepiece-prb01.ts --lang=en
 *   npx tsx scripts/reseed-onepiece-prb01.ts --lang=fr
 *   npx tsx scripts/reseed-onepiece-prb01.ts --skip-images
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { uploadOnePieceCardImage, deleteOnePieceSeriesImages } from '../lib/supabase/storage'

const BASE_URL = 'https://www.opecards.fr'

// Configuration pour chaque langue
// PRB01: "Premium Booster - The Best"
const LANG_CONFIG = {
  en: {
    searchUrl: `${BASE_URL}/cards/search?sortBy=releaseR&serie=435&language=EN`,
    totalPages: 12,
    urlPrefix: 'en-',
    storageLang: 'en'
  },
  fr: {
    searchUrl: `${BASE_URL}/cards/search?sortBy=releaseR&serie=478&language=FR`,
    totalPages: 14,
    urlPrefix: 'fr-',
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

interface PRB01Card {
  url: string
  slug: string
  number: string        // Format: "001", "001-ALT", "086-FA"
  displayNumber: string // Format: "PRB01-001"
  originalCard: string  // Format: "OP06-003" - carte d'origine
  name: string
  rarity: string
  variant: string       // full-art, alternative-art, jolly-roger-foil, manga, etc.
  imageUrl: string | null
  language: 'EN' | 'FR'
}

// ============================================
// NAME CORRECTIONS
// ============================================

/**
 * Corrections de noms pour One Piece
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
    // Tony Tony Chopper
    .replace(/Tonytony Chopper/gi, 'Tony Tony.Chopper')
    .replace(/Tonytony\.chopper/gi, 'Tony Tony.Chopper')
    .replace(/Tony Tony Chopper/gi, 'Tony Tony.Chopper')
    // Nico Robin
    .replace(/Nicorobin/gi, 'Nico Robin')
    // Silvers Rayleigh
    .replace(/Silversrayleigh/gi, 'Silvers Rayleigh')
    // Kaido
    .replace(/Kaidoof The Beasts/gi, 'Kaido of the Beasts')
    // Shanks
    .replace(/Redhaired Shanks/gi, 'Red-Haired Shanks')
    // Capone Gang Bege
    .replace(/Capone Gang Bege/gi, 'Capone "Gang" Bege')
    // Autres corrections
    .replace(/Bobbin The Disposer/gi, 'Bobbin the Disposer')
    // O-Nami
    .replace(/O Nami/gi, 'O-Nami')
    // Mr.
    .replace(/Mr(\d)/gi, 'Mr.$1')
    .trim()
}

// ============================================
// VARIANT MAPPING
// ============================================

/**
 * Mappe les variantes d'URL vers des suffixes de numero
 */
function getVariantSuffix(variant: string): string {
  switch (variant.toLowerCase()) {
    case 'full-art':
    case 'fullart':
      return '-FA'
    case 'alternative-art':
    case 'alternativeart':
    case 'alt-art':
      return '-ALT'
    case 'jolly-roger-foil':
    case 'jollyrogerfoil':
      return '-JRF'
    case 'manga':
      return '-MG'
    case 'box-topper':
    case 'boxtopper':
      return '-BT'
    case 'parallel':
      return '-P'
    case 'treasure':
      return '-TR'
    default:
      return ''
  }
}

// ============================================
// PARSING
// ============================================

/**
 * Parse une URL de carte PRB01
 *
 * Formats EN (avec prefixe langue):
 * 1. Standard: /cards/{lang}-{setCode}{setNum}-{number}-{rarity}-prb01-{variant}-{name}
 *    Ex: en-op06-003-uc-prb01-full-art-emporio-ivankov
 * 2. Promo: /cards/{lang}-p-{number}-p-prb01-{variant}-{name}
 *    Ex: en-p-014-p-prb01-full-art-koby
 * 3. DON: /cards/{lang}-prb01-don-{variant}-{name}
 *    Ex: en-prb01-don-foil-textured-ace
 *
 * Formats FR (SANS prefixe langue):
 * 1. PRB01 specific: /cards/prb01-{number}-{rarity}-{name}
 *    Ex: prb01-001-l-sanji
 * 2. Original set: /cards/{setCode}{setNum}-{number}-{rarity}-{name}
 *    Ex: op06-003-uc-emporio-ivankov
 * 3. Original set variant: /cards/{setCode}{setNum}-{number}-{rarity}-version-{n}-{name}
 *    Ex: op06-003-uc-version-2-emporio-ivankov
 */
function parsePRB01Url(url: string, lang: 'en' | 'fr'): PRB01Card | null {
  const slug = url.replace('/cards/', '')
  const langUpper = lang.toUpperCase() as 'EN' | 'FR'

  // ========================================
  // FORMATS EN (avec prefixe langue)
  // ========================================
  if (lang === 'en') {
    // Pattern EN 1: Standard cards from OP/ST sets
    const standardMatch = slug.match(/^en-([a-z]+)(\d+)-(\d{3})-([a-z]+)-prb01-(.+)$/i)
    if (standardMatch) {
      const [, origSetLetters, origSetNum, number, rarity, restPart] = standardMatch
      const originalCard = `${origSetLetters.toUpperCase()}${origSetNum}-${number}`
      return parseRestOfCard(slug, lang, number, rarity, originalCard, restPart)
    }

    // Pattern EN 2: Promo cards (P series)
    const promoMatch = slug.match(/^en-p-(\d{3})-p-prb01-(.+)$/i)
    if (promoMatch) {
      const [, number, restPart] = promoMatch
      const originalCard = `P-${number}`
      return parseRestOfCard(slug, lang, number, 'P', originalCard, restPart)
    }

    // Pattern EN 3: DON cards
    const donMatch = slug.match(/^en-prb01-don-(.+)$/i)
    if (donMatch) {
      const [, restPart] = donMatch
      return parseDonCard(slug, lang, restPart)
    }
  }

  // ========================================
  // FORMATS FR (SANS prefixe langue)
  // ========================================
  if (lang === 'fr') {
    // Pattern FR 1: PRB01 specific card (ex: prb01-001-l-sanji)
    const prb01Match = slug.match(/^prb01-(\d{3})-([a-z]+)-(.+)$/i)
    if (prb01Match) {
      const [, number, rarity, namePart] = prb01Match
      const cleanName = formatName(namePart)
      return {
        url: `/cards/${slug}`,
        slug,
        number,
        displayNumber: `PRB01-${number}`,
        originalCard: `PRB01-${number}`,
        name: cleanName,
        rarity: rarity.toUpperCase(),
        variant: 'standard',
        imageUrl: null,
        language: langUpper
      }
    }

    // Pattern FR 2: Promo cards with variant (ex: p-014-p-version-2-kobby)
    const promoVariantMatch = slug.match(/^p-(\d{3})-p-version-(\d+)-(.+)$/i)
    if (promoVariantMatch) {
      const [, number, versionNum, namePart] = promoVariantMatch
      const cleanName = formatName(namePart)
      const variantSuffix = versionNum === '2' ? '-V2' : `-V${versionNum}`
      return {
        url: `/cards/${slug}`,
        slug,
        number: `${number}${variantSuffix}`,
        displayNumber: `P-${number}`,
        originalCard: `P-${number}`,
        name: cleanName,
        rarity: 'P',
        variant: `version-${versionNum}`,
        imageUrl: null,
        language: langUpper
      }
    }

    // Pattern FR 3: Promo cards without variant (ex: p-014-p-kobby)
    const promoMatch = slug.match(/^p-(\d{3})-p-(.+)$/i)
    if (promoMatch) {
      const [, number, namePart] = promoMatch
      const cleanName = formatName(namePart)
      return {
        url: `/cards/${slug}`,
        slug,
        number,
        displayNumber: `P-${number}`,
        originalCard: `P-${number}`,
        name: cleanName,
        rarity: 'P',
        variant: 'standard',
        imageUrl: null,
        language: langUpper
      }
    }

    // Pattern FR 4: DON cards (ex: prb01-don-ace, prb01-don-foil-textured-ace, prb01-don-gold-ace)
    const donMatch = slug.match(/^prb01-don-(.+)$/i)
    if (donMatch) {
      const [, restPart] = donMatch
      return parseDonCardFr(slug, restPart, langUpper)
    }

    // Pattern FR 5: Original set card with variant (ex: op06-003-uc-version-2-emporio-ivankov)
    const variantMatch = slug.match(/^([a-z]+)(\d+)-(\d{3})-([a-z]+)-version-(\d+)-(.+)$/i)
    if (variantMatch) {
      const [, origSetLetters, origSetNum, number, rarity, versionNum, namePart] = variantMatch
      const originalCard = `${origSetLetters.toUpperCase()}${origSetNum}-${number}`
      const cleanName = formatName(namePart)
      // version-2 = variant (full-art, jolly-roger-foil, etc.)
      const variantSuffix = versionNum === '2' ? '-V2' : `-V${versionNum}`
      return {
        url: `/cards/${slug}`,
        slug,
        number: `${number}${variantSuffix}`,
        displayNumber: `PRB01-${number}`,
        originalCard,
        name: cleanName,
        rarity: rarity.toUpperCase(),
        variant: `version-${versionNum}`,
        imageUrl: null,
        language: langUpper
      }
    }

    // Pattern FR 6: Original set card without variant (ex: op06-003-uc-emporio-ivankov)
    const standardFrMatch = slug.match(/^([a-z]+)(\d+)-(\d{3})-([a-z]+)-(.+)$/i)
    if (standardFrMatch) {
      const [, origSetLetters, origSetNum, number, rarity, namePart] = standardFrMatch
      const originalCard = `${origSetLetters.toUpperCase()}${origSetNum}-${number}`
      const cleanName = formatName(namePart)
      return {
        url: `/cards/${slug}`,
        slug,
        number,
        displayNumber: `PRB01-${number}`,
        originalCard,
        name: cleanName,
        rarity: rarity.toUpperCase(),
        variant: 'standard',
        imageUrl: null,
        language: langUpper
      }
    }
  }

  logger.warn(`Pattern PRB01 non reconnu: ${slug}`)
  return null
}

/**
 * Formate un nom depuis un slug (remplace tirets par espaces, capitalise)
 */
function formatName(namePart: string): string {
  let cleanName = namePart
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return correctName(cleanName)
}

/**
 * Parse le reste d'une carte (variante + nom)
 */
function parseRestOfCard(
  slug: string,
  lang: 'en' | 'fr',
  number: string,
  rarity: string,
  originalCard: string,
  restPart: string
): PRB01Card {
  // Extraire la variante et le nom
  let variant = 'standard'
  let namePart = restPart

  const variantPatterns = [
    'full-art',
    'alternative-art',
    'jolly-roger-foil',
    'manga',
    'box-topper',
    'parallel',
    'treasure'
  ]

  for (const v of variantPatterns) {
    if (restPart.startsWith(v + '-')) {
      variant = v
      namePart = restPart.substring(v.length + 1)
      break
    } else if (restPart === v) {
      // Cas ou il n'y a pas de nom apres la variante
      variant = v
      namePart = ''
      break
    }
  }

  // Nettoyer le nom
  let cleanName = namePart
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Appliquer les corrections de noms
  cleanName = correctName(cleanName)

  // Construire le numero avec suffixe de variante
  const suffix = getVariantSuffix(variant)
  const fullNumber = `${number}${suffix}`

  return {
    url: `/cards/${slug}`,
    slug,
    number: fullNumber,
    displayNumber: `PRB01-${number}`,
    originalCard,
    name: cleanName,
    rarity: rarity.toUpperCase(),
    variant,
    imageUrl: null,
    language: lang.toUpperCase() as 'EN' | 'FR'
  }
}

/**
 * Parse une carte DON (format EN)
 */
function parseDonCard(slug: string, lang: 'en' | 'fr', restPart: string): PRB01Card {
  // DON cards peuvent avoir des variantes: foil-textured, gold, ou standard
  let variant = 'standard'
  let namePart = restPart

  const donVariants = ['foil-textured', 'gold']

  for (const v of donVariants) {
    if (restPart.startsWith(v + '-')) {
      variant = v
      namePart = restPart.substring(v.length + 1)
      break
    }
  }

  // Le nom est le personnage sur le DON
  let cleanName = namePart
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  cleanName = correctName(cleanName)
  cleanName = `DON!! - ${cleanName}`

  // Construire le numero pour les DON
  // On utilise DON + suffixe de variante pour differencier
  let donSuffix = ''
  if (variant === 'foil-textured') donSuffix = '-FT'
  else if (variant === 'gold') donSuffix = '-G'

  // Numero unique base sur le nom
  const donNumber = `DON-${namePart.toUpperCase().replace(/-/g, '')}${donSuffix}`

  return {
    url: `/cards/${slug}`,
    slug,
    number: donNumber,
    displayNumber: 'PRB01-DON',
    originalCard: 'DON',
    name: cleanName,
    rarity: 'DON',
    variant,
    imageUrl: null,
    language: lang.toUpperCase() as 'EN' | 'FR'
  }
}

/**
 * Parse une carte DON (format FR - sans prefixe langue)
 * Formats: prb01-don-ace, prb01-don-foil-textured-ace, prb01-don-gold-ace
 */
function parseDonCardFr(slug: string, restPart: string, langUpper: 'EN' | 'FR'): PRB01Card {
  // DON cards peuvent avoir des variantes: foil-textured, gold, ou standard
  let variant = 'standard'
  let namePart = restPart

  const donVariants = ['foil-textured', 'gold']

  for (const v of donVariants) {
    if (restPart.startsWith(v + '-')) {
      variant = v
      namePart = restPart.substring(v.length + 1)
      break
    }
  }

  // Le nom est le personnage sur le DON
  let cleanName = formatName(namePart)
  cleanName = `DON!! - ${cleanName}`

  // Construire le numero pour les DON
  let donSuffix = ''
  if (variant === 'foil-textured') donSuffix = '-FT'
  else if (variant === 'gold') donSuffix = '-G'

  // Numero unique base sur le nom
  const donNumber = `DON-${namePart.toUpperCase().replace(/-/g, '')}${donSuffix}`

  return {
    url: `/cards/${slug}`,
    slug,
    number: donNumber,
    displayNumber: 'PRB01-DON',
    originalCard: 'DON',
    name: cleanName,
    rarity: 'DON',
    variant,
    imageUrl: null,
    language: langUpper
  }
}

// ============================================
// SCRAPING
// ============================================

/**
 * Scrape toutes les URLs de cartes PRB01 depuis les pages de recherche
 */
async function scrapePRB01CardUrls(browser: Browser, lang: 'en' | 'fr'): Promise<string[]> {
  const config = LANG_CONFIG[lang]
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls: string[] = []
  const langPrefix = config.urlPrefix

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

      // Extraire les URLs de cartes PRB01
      // Note: Les URLs FR n'ont PAS de prefixe langue et la plupart n'ont PAS -prb01-
      // Car elles utilisent le code de la serie d'origine (op06, st04, etc.)
      const cardUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les pages de recherche et generiques
            if (path === '/cards' || path === '/cards/' || path.includes('/search') || path === '/cards/cartes-les-plus-cheres') {
              return false
            }
            // Accepter toutes les cartes de la page (la page est deja filtree par serie PRB01)
            // Le path doit etre de la forme /cards/{quelque-chose}
            return path.startsWith('/cards/') && path.split('/').length === 3
          })
        return [...new Set(links)]
      })

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
  logger.success(`Total ${lang.toUpperCase()}: ${uniqueUrls.length} URLs de cartes PRB01 uniques`)

  return uniqueUrls
}

/**
 * Recupere les details d'une carte (nom correct et image depuis la page)
 */
async function fetchCardDetails(page: Page, card: PRB01Card): Promise<PRB01Card> {
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
      // Nettoyer le nom (enlever le code de carte au debut s'il est present)
      let cleanName = details.name
        .replace(/^[A-Z]{2,4}\d{2}-\d{3}\s*[-:]\s*/i, '')
        .replace(/^PRB01-\d{3}\s*[-:]\s*/i, '')
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
 * Recupere l'ID de la serie PRB01 pour One Piece
 */
async function getPRB01SeriesId(): Promise<string> {
  // D'abord recuperer le tcg_game_id pour One Piece
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (tcgError || !tcg) {
    throw new Error('TCG One Piece non trouve')
  }

  // Puis recuperer la serie PRB01
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, name')
    .eq('code', 'PRB01')
    .eq('tcg_game_id', tcg.id)
    .single()

  if (seriesError || !series) {
    throw new Error('Serie PRB01 non trouvee pour One Piece')
  }

  logger.info(`Serie trouvee: ${series.name}`)
  return series.id
}

/**
 * Met a jour le nom de la serie si necessaire
 */
async function updateSeriesName(seriesId: string): Promise<void> {
  const correctName = 'Premium Booster - The Best'

  const { error } = await supabase
    .from('series')
    .update({ name: correctName })
    .eq('id', seriesId)

  if (error) {
    logger.warn(`Erreur mise a jour nom serie: ${error.message}`)
  } else {
    logger.success(`Nom de serie mis a jour: ${correctName}`)
  }
}

/**
 * Supprime toutes les cartes d'une langue de la serie PRB01
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
async function insertCard(seriesId: string, card: PRB01Card): Promise<boolean> {
  if (dryRun) {
    logger.info(`[DRY-RUN] Insererait: ${card.language} ${card.number} - ${card.name} (${card.variant})`)
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
        original_card: card.originalCard,
        variant: card.variant,
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
    logger.info(`Suppression des images existantes PRB01/${lang}`)
    const deleteResult = await deleteOnePieceSeriesImages('PRB01', lang)
    if (deleteResult.success) {
      logger.success(`Images supprimees: ${deleteResult.count || 0}`)
    } else {
      logger.warn(`Erreur suppression images: ${deleteResult.error}`)
    }
  }

  // 2. Scraper les URLs
  logger.info(`Scraping des URLs de cartes PRB01 ${langUpper}...`)
  const cardUrls = await scrapePRB01CardUrls(browser, lang)

  // 3. Parser les URLs
  logger.info('Parsing des URLs...')
  const cards: PRB01Card[] = []

  for (const url of cardUrls) {
    const parsed = parsePRB01Url(new URL(url).pathname, lang)
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
  for (const card of cards.slice(0, 15)) {
    console.log(`  ${card.number.padEnd(10)} [${card.rarity.padEnd(3)}] ${card.variant.padEnd(16)} - ${card.name} (from ${card.originalCard})`)
  }
  if (cards.length > 15) {
    console.log(`  ... et ${cards.length - 15} autres cartes`)
  }

  // 4. Recuperer les images et noms corrects
  if (!skipImages) {
    logger.info('Recuperation des details et images...')
    const detailPage = await browser.newPage()
    await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    for (let i = 0; i < cards.length; i++) {
      logger.progress(`[${i + 1}/${cards.length}] ${cards[i].number} - ${cards[i].name}`)
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
        'PRB01',
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
  logger.section('Re-seeding One Piece PRB01')
  console.log(`Langues: ${langsToProcess.join(', ').toUpperCase()}`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log(`Skip images: ${skipImages}`)

  try {
    // 1. Recuperer l'ID de la serie
    logger.info('\n1. Recuperation de la serie PRB01...')
    const seriesId = await getPRB01SeriesId()
    logger.success(`Serie PRB01 trouvee: ${seriesId}`)

    // 2. Mettre a jour le nom de la serie si necessaire
    if (!dryRun) {
      await updateSeriesName(seriesId)
    }

    // 3. Lancer le navigateur
    logger.info('\n2. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const results: Record<string, { success: number; error: number }> = {}

    try {
      // 4. Traiter chaque langue
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
      console.log('\nVerifiez: https://www.collectorverse.io/series/onepiece/PRB01')
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
