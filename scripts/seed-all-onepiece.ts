/**
 * Script de scraping pour TOUTES les cartes One Piece avec Puppeteer
 * Source: https://www.opecards.fr
 *
 * Usage:
 *   npm run seed:all-onepiece
 *   npx tsx scripts/seed-all-onepiece.ts
 *   npx tsx scripts/seed-all-onepiece.ts --type booster --lang fr
 *   npx tsx scripts/seed-all-onepiece.ts --start OP05 --lang all
 *
 * Options:
 *   --type <type>    Type de série: booster, starter, premium, special, promo, all (défaut: all)
 *   --lang <code>    Langue: fr, en, jp, ou all (défaut: all)
 *   --start <code>   Commencer à partir de cette série (ex: OP05)
 *   --skip-images    Ne pas télécharger les images (juste les données)
 *   --dry-run        Afficher les séries qui seraient traitées sans exécuter
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createOnePieceBucket, uploadOnePieceCardImage, uploadOnePieceIcon } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import {
  ONEPIECE_ALL_SERIES,
  ONEPIECE_BOOSTERS,
  ONEPIECE_STARTERS,
  ONEPIECE_PREMIUM,
  ONEPIECE_SPECIAL,
  ONEPIECE_PROMOS,
  OnePieceSeriesConfig,
  ONEPIECE_LANGUAGES,
  OnePieceLanguage,
  isSeriesAvailableInLanguage
} from './config/onepiece-series'
import {
  detectFinish,
  buildStorageNumber,
  normalizeRarity,
  OnePieceFinish
} from './lib/onepiece-parser'

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = 'https://www.opecards.fr'
const SEARCH_URL = `${BASE_URL}/cards/search`

// Parse command line arguments
const args = process.argv.slice(2)
const typeArg = args.find((_, i) => args[i - 1] === '--type') || 'all'
const langArg = args.find((_, i) => args[i - 1] === '--lang') || 'all'
const startArg = args.find((_, i) => args[i - 1] === '--start')
const skipImages = args.includes('--skip-images')
const dryRun = args.includes('--dry-run')

// Initialize Supabase admin client
const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface OnePieceCardRaw {
  url: string
  name: string
  publicCode: string
  number: string
  rarity: string
  colors: string[]
  cardType: string
  attribute: string | null
  power: number | null
  cost: number | null
  life: number | null
  counter: number | null
  affiliations: string[]
  effectText: string | null
  trigger: string | null
  illustrator: string | null
  imageUrl: string
  finish: OnePieceFinish
  isAlternateArt: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Récupère les séries à traiter selon le type
 */
function getSeriesToProcess(): OnePieceSeriesConfig[] {
  let series: OnePieceSeriesConfig[]

  switch (typeArg) {
    case 'booster':
      series = ONEPIECE_BOOSTERS
      break
    case 'starter':
      series = ONEPIECE_STARTERS
      break
    case 'premium':
      series = ONEPIECE_PREMIUM
      break
    case 'special':
      series = ONEPIECE_SPECIAL
      break
    case 'promo':
      series = ONEPIECE_PROMOS
      break
    default:
      series = ONEPIECE_ALL_SERIES
  }

  // Filtrer les séries à skip et appliquer --start
  let filtered = series.filter(s => !s.skip)

  if (startArg) {
    const startIndex = filtered.findIndex(s => s.code.toLowerCase() === startArg.toLowerCase())
    if (startIndex > 0) {
      filtered = filtered.slice(startIndex)
      logger.info(`Démarrage à partir de ${startArg}`)
    }
  }

  return filtered
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

async function getOnePieceGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (error || !data) {
    throw new Error('TCG One Piece non trouvé dans la base de données')
  }

  return data.id
}

async function upsertSeries(gameId: string, config: OnePieceSeriesConfig): Promise<string> {
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('code', config.code)
    .single()

  if (existing) {
    return existing.id
  }

  const { data, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: gameId,
      name: config.nameFr || config.name,
      code: config.code,
      release_date: config.releaseDate,
      max_set_base: config.cardCount || 0,
      master_set: config.cardCount || 0
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Erreur création série ${config.code}: ${error?.message}`)
  }

  return data.id
}

// ============================================
// SCRAPING FUNCTIONS
// ============================================

// Cache des URLs de séries découvertes dynamiquement
// Clé: "fr-OP01", "jp-OP01", "en-OP01" etc.
const discoveredSeriesUrls: Map<string, string> = new Map()

/**
 * Découvre toutes les URLs de séries depuis la page de recherche
 */
async function discoverSeriesUrls(browser: Browser): Promise<Map<string, string>> {
  if (discoveredSeriesUrls.size > 0) {
    return discoveredSeriesUrls
  }

  logger.processing('Découverte des URLs de séries...')
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  try {
    // Parcourir les pages pour chaque filtre de langue
    const langFilters = [
      { lang: '', label: 'FR' },
      { lang: 'jp', label: 'JP' },
      { lang: 'en', label: 'EN' }
    ]

    for (const langFilter of langFilters) {
      logger.info(`Découverte séries ${langFilter.label}...`)

      for (let currentPage = 1; currentPage <= 10; currentPage++) {
        const langParam = langFilter.lang ? `&lang=${langFilter.lang}` : ''
        const url = `${BASE_URL}/series/search?page=${currentPage}&sortBy=date${langParam}`

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
        await delay(2000)

        // Scroll pour charger tout le contenu
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await delay(1500)

        const pageData = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/series/"]'))
            .map(a => (a as HTMLAnchorElement).href)
            .filter(href => {
              const path = new URL(href).pathname
              return path.startsWith('/series/') &&
                     !path.includes('/search') &&
                     path !== '/series/' &&
                     path !== '/series'
            })

          const noResults = document.body.textContent?.includes('0 résultat')
          return { links: [...new Set(links)], noResults }
        })

        if (pageData.noResults || pageData.links.length === 0) {
          break
        }

        for (const link of pageData.links) {
          const path = new URL(link).pathname.replace('/series/', '')

          // Détection basée sur le filtre de langue actuel
          // car les URLs ne sont pas consistantes (certaines EN n'ont pas de préfixe en-)
          const detectedLang = langFilter.lang || 'fr'
          let seriesSlug = path

          // Enlever le préfixe de langue s'il existe
          if (path.startsWith('jp-')) {
            seriesSlug = path.substring(3)
          } else if (path.startsWith('en-')) {
            seriesSlug = path.substring(3)
          }

          // Extraire le code de série - gérer les cas comme "op-01" ou "op01"
          const codeMatch = seriesSlug.match(/^([a-z]+)-?(\d+)/i)
          if (codeMatch) {
            const code = `${codeMatch[1].toUpperCase()}${codeMatch[2]}`
            const key = `${detectedLang}-${code}`

            if (!discoveredSeriesUrls.has(key)) {
              discoveredSeriesUrls.set(key, link)
            }
          }
        }

        if (pageData.links.length < 20) break
        await delay(1000)
      }
    }

    logger.success(`${discoveredSeriesUrls.size} URLs de séries découvertes`)
  } catch (error) {
    logger.error(`Erreur découverte: ${error}`)
  } finally {
    await page.close()
  }

  return discoveredSeriesUrls
}

/**
 * Construit l'URL de la page de série
 */
function buildSeriesPageUrl(seriesConfig: OnePieceSeriesConfig, language: OnePieceLanguage): string | null {
  const key = `${language}-${seriesConfig.code.toUpperCase()}`
  return discoveredSeriesUrls.get(key) || null
}

async function scrapeSeriesCards(
  browser: Browser,
  seriesConfig: OnePieceSeriesConfig,
  language: OnePieceLanguage
): Promise<OnePieceCardRaw[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCardUrls = new Set<string>()
  const seriesPageUrl = buildSeriesPageUrl(seriesConfig, language)

  if (!seriesPageUrl) {
    await page.close()
    return []
  }

  try {
    logger.web(`Navigation: ${seriesPageUrl}`)
    await page.goto(seriesPageUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await delay(2000)

    // Vérifier si la page a des cartes
    const isValidPage = await page.evaluate(() => {
      const cardLinks = document.querySelectorAll('a[href*="/cards/"]')
      return cardLinks.length > 0
    })

    if (!isValidPage) {
      await page.close()
      return []
    }

    // Boucle sur toutes les pages
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages && currentPage < 30) {
      // Scroll pour charger
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire les liens de cartes
      const pageInfo = await page.evaluate(() => {
        const cardLinks = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            return path.startsWith('/cards/') &&
                   path !== '/cards' &&
                   !path.includes('/search') &&
                   !path.includes('cartes-les-plus-cheres')
          })

        return { cardLinks: [...new Set(cardLinks)] }
      })

      const newCards = pageInfo.cardLinks.filter(url => !allCardUrls.has(url))
      newCards.forEach(url => allCardUrls.add(url))

      if (newCards.length === 0) {
        hasMorePages = false
      } else {
        // Essayer de passer à la page suivante
        const nextPageClicked = await page.evaluate((nextPage) => {
          const allLinks = Array.from(document.querySelectorAll('a, button, span'))
          const targetButton = allLinks.find(el => {
            const text = el.textContent?.trim()
            return text === nextPage.toString()
          })
          if (targetButton && (targetButton as HTMLElement).click) {
            (targetButton as HTMLElement).click()
            return true
          }
          return false
        }, currentPage + 1)

        if (nextPageClicked) {
          currentPage++
          await delay(DELAYS.betweenPages + 1000)
        } else {
          hasMorePages = false
        }
      }
    }
  } catch (error) {
    logger.error(`Erreur scraping: ${error}`)
  } finally {
    await page.close()
  }

  // Convertir les URLs en objets carte
  const cards: OnePieceCardRaw[] = []
  for (const url of allCardUrls) {
    const processed = processRawCardFromUrl(url, language, seriesConfig.code)
    if (processed) {
      cards.push(processed)
    }
  }

  cards.sort((a, b) => parseInt(a.number) - parseInt(b.number))
  return cards
}

/**
 * Traite une URL de carte
 */
function processRawCardFromUrl(
  url: string,
  language: OnePieceLanguage,
  seriesCode: string
): OnePieceCardRaw | null {
  try {
    const urlPath = url.includes('://') ? new URL(url).pathname : url
    const slug = urlPath.replace('/cards/', '')

    // Pattern flexible: optionnel lang prefix + code série + numéro + rareté + nom
    const cardPattern = /^(?:(jp|en)-)?([a-z]+)-?(\d+)-(\d{3})-([a-z]+)-(.+)$/i
    const match = slug.match(cardPattern)

    if (!match) {
      return null
    }

    const [, langPrefix, codeLetters, codeNumbers, number, rarity, namePart] = match
    const fullSeriesCode = `${codeLetters.toUpperCase()}${codeNumbers}`

    // Nettoyer le nom
    let cleanNamePart = namePart
    let isVersion2 = false
    let isPremiumBandai = false

    if (namePart.startsWith('version-2-')) {
      cleanNamePart = namePart.replace('version-2-', '')
      isVersion2 = true
    } else if (namePart.startsWith('premium-bandai-')) {
      cleanNamePart = namePart.replace('premium-bandai-', '')
      isPremiumBandai = true
    }

    const name = cleanNamePart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    const publicCode = `${fullSeriesCode}-${number}-${rarity.toUpperCase()}`
    const { finish, isAlternateArt } = detectFinish(slug, name)

    let finalFinish = finish
    if (isVersion2 || isPremiumBandai) {
      finalFinish = isPremiumBandai ? 'special' : 'alternate'
    }

    const cardLang = langPrefix || (language === 'fr' ? '' : language)
    const imagePrefix = cardLang ? 'image-trading-cards' : 'image-cartes-a-collectionner'
    const imageUrl = `https://static.opecards.fr/cards/${cardLang || 'fr'}/${fullSeriesCode.toLowerCase()}/${imagePrefix}-one-piece-card-game-tcg-opecards-${slug}.webp`

    return {
      url: urlPath,
      name,
      publicCode,
      number,
      rarity: normalizeRarity(rarity),
      colors: [],
      cardType: rarity.toLowerCase() === 'l' ? 'leader' : 'character',
      attribute: null,
      power: null,
      cost: null,
      life: null,
      counter: null,
      affiliations: [],
      effectText: null,
      trigger: null,
      illustrator: null,
      imageUrl,
      finish: finalFinish as OnePieceFinish,
      isAlternateArt: isAlternateArt || isVersion2 || isPremiumBandai
    }
  } catch (e) {
    return null
  }
}


// ============================================
// INSERT FUNCTIONS
// ============================================

async function insertCards(
  seriesId: string,
  cards: OnePieceCardRaw[],
  language: OnePieceLanguage,
  seriesCode: string
) {
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    try {
      let finalImageUrl = card.imageUrl
      if (!skipImages && card.imageUrl) {
        const storageNumber = buildStorageNumber(card.number, card.finish, card.isAlternateArt)
        const imageResult = await uploadOnePieceCardImage(
          card.imageUrl,
          storageNumber,
          seriesCode,
          language
        )

        if (imageResult.success && imageResult.url) {
          finalImageUrl = imageResult.url
        }
      }

      const { error } = await supabase
        .from('cards')
        .upsert({
          series_id: seriesId,
          name: card.name,
          number: buildStorageNumber(card.number, card.finish, card.isAlternateArt),
          language: language.toUpperCase(),
          rarity: card.rarity,
          image_url: finalImageUrl,
          attributes: {
            public_code: card.publicCode,
            slug: card.url.replace('/cards/', ''),
            colors: card.colors,
            card_type: card.cardType,
            attribute: card.attribute,
            power: card.power,
            cost: card.cost,
            life: card.life,
            counter: card.counter,
            affiliations: card.affiliations,
            effect_text: card.effectText,
            trigger: card.trigger,
            illustrator: card.illustrator,
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
        errorCount++
      } else {
        successCount++
      }

      if (i < cards.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      errorCount++
    }
  }

  return { successCount, errorCount }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  logger.section('Scraping One Piece Card Game - TOUTES LES SERIES')
  console.log(`Source: ${BASE_URL}`)
  console.log(`Type: ${typeArg}`)
  console.log(`Langue(s): ${langArg}`)
  console.log(`Skip images: ${skipImages}`)
  console.log(`Dry run: ${dryRun}`)

  const seriesToProcess = getSeriesToProcess()
  const languages: OnePieceLanguage[] = langArg === 'all'
    ? ['fr', 'en', 'jp']
    : [langArg as OnePieceLanguage]

  logger.info(`\nSéries à traiter: ${seriesToProcess.length}`)
  logger.info(`Langues: ${languages.join(', ')}`)

  if (dryRun) {
    logger.section('DRY RUN - Séries qui seraient traitées:')
    seriesToProcess.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.code} - ${s.name} (serieId: ${s.serieId})`)
    })
    console.log(`\nTotal: ${seriesToProcess.length} séries × ${languages.length} langues = ${seriesToProcess.length * languages.length} combinaisons`)
    return
  }

  try {
    // Étape 1: Setup
    logger.info('\n1. Vérification du bucket Supabase Storage...')
    await createOnePieceBucket()

    logger.info('\n2. Vérification du TCG One Piece...')
    const gameId = await getOnePieceGameId()
    logger.success(`One Piece trouvé: ${gameId}`)

    // Étape 2: Lancer Puppeteer
    logger.info('\n3. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const stats = {
      seriesProcessed: 0,
      totalCards: 0,
      totalSuccess: 0,
      totalErrors: 0,
      startTime: Date.now()
    }

    try {
      // Étape 3: Découvrir les URLs de séries
      logger.info('\n4. Découverte des URLs de séries...')
      await discoverSeriesUrls(browser)

      // Étape 4: Traiter chaque série
      for (let s = 0; s < seriesToProcess.length; s++) {
        const seriesConfig = seriesToProcess[s]

        logger.section(`[${s + 1}/${seriesToProcess.length}] ${seriesConfig.code} - ${seriesConfig.name}`)

        // Créer/récupérer la série
        const seriesId = await upsertSeries(gameId, seriesConfig)

        // Traiter chaque langue
        for (const lang of languages) {
          // Vérifier si la série est disponible dans cette langue
          if (!isSeriesAvailableInLanguage(seriesConfig.code, lang)) {
            logger.info(`\n--- ${seriesConfig.code} (${lang.toUpperCase()}) --- SKIP (non disponible)`)
            continue
          }

          logger.info(`\n--- ${seriesConfig.code} (${lang.toUpperCase()}) ---`)

          try {
            // Scraper les cartes
            const cards = await scrapeSeriesCards(browser, seriesConfig, lang)

            if (cards.length === 0) {
              logger.warn(`Aucune carte trouvée pour ${seriesConfig.code} (${lang})`)
              continue
            }

            logger.info(`${cards.length} cartes trouvées`)

            // Insérer les cartes
            const { successCount, errorCount } = await insertCards(
              seriesId,
              cards,
              lang,
              seriesConfig.code
            )

            stats.totalCards += cards.length
            stats.totalSuccess += successCount
            stats.totalErrors += errorCount

            logger.success(`${successCount} cartes insérées, ${errorCount} erreurs`)

          } catch (error) {
            logger.error(`Erreur ${seriesConfig.code} (${lang}): ${error}`)
          }

          // Pause entre les langues
          await delay(DELAYS.betweenPages)
        }

        stats.seriesProcessed++

        // Pause entre les séries
        await delay(DELAYS.betweenSeries)
      }
    } finally {
      await browser.close()
      logger.info('Navigateur fermé')
    }

    // Afficher les statistiques finales
    const duration = Math.round((Date.now() - stats.startTime) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60

    logger.section('STATISTIQUES FINALES')
    console.log(`Séries traitées: ${stats.seriesProcessed}/${seriesToProcess.length}`)
    console.log(`Cartes totales: ${stats.totalCards}`)
    console.log(`Succès: ${stats.totalSuccess}`)
    console.log(`Erreurs: ${stats.totalErrors}`)
    console.log(`Durée: ${minutes}m ${seconds}s`)

    logger.section('Scraping terminé!')
    console.log(`\nConsultez vos cartes: http://localhost:3000/series/onepiece`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution
main()
