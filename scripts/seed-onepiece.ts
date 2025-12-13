/**
 * Script de scraping pour les cartes One Piece avec Puppeteer
 * Source: https://www.opecards.fr
 *
 * Usage:
 *   npx tsx scripts/seed-onepiece.ts --series OP13 --lang fr
 *   npx tsx scripts/seed-onepiece.ts --series OP13 --lang all
 *   npx tsx scripts/seed-onepiece.ts --series ST01 --lang en
 *
 * Options:
 *   --series <code>  Code de la série (ex: OP13, ST01)
 *   --lang <code>    Langue: fr, en, jp, ou all (défaut: fr)
 *   --skip-images    Ne pas télécharger les images (juste les données)
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createOnePieceBucket, uploadOnePieceCardImage, uploadOnePieceIcon } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import {
  getSeriesByCode,
  OnePieceSeriesConfig,
  ONEPIECE_LANGUAGES,
  OnePieceLanguage,
  isSeriesAvailableInLanguage
} from './config/onepiece-series'
import {
  parseOnePieceCardUrl,
  detectFinish,
  buildStorageNumber,
  normalizeRarity,
  parseColors,
  parseCardType,
  parseAttribute,
  OnePieceFinish
} from './lib/onepiece-parser'

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = 'https://www.opecards.fr'
const SERIES_URL = `${BASE_URL}/series`

// Parse command line arguments
const args = process.argv.slice(2)
const seriesArg = args.find((_, i) => args[i - 1] === '--series') || 'OP13'
const langArg = args.find((_, i) => args[i - 1] === '--lang') || 'fr'
const skipImages = args.includes('--skip-images')

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

interface IconData {
  type: 'colors' | 'card_types' | 'attributes' | 'rarities'
  code: string
  name: string
  url: string
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Récupère l'UUID du TCG One Piece
 */
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

/**
 * Crée ou récupère une série
 */
async function upsertSeries(gameId: string, config: OnePieceSeriesConfig): Promise<string> {
  // Vérifier si la série existe
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('code', config.code)
    .single()

  if (existing) {
    logger.info(`Série ${config.code} existe déjà`)
    return existing.id
  }

  // Créer la série
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

  logger.success(`Série ${config.code} créée`)
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
 * Parcourt toutes les pages de pagination pour chaque langue
 */
async function discoverSeriesUrls(browser: Browser): Promise<Map<string, string>> {
  if (discoveredSeriesUrls.size > 0) {
    return discoveredSeriesUrls
  }

  logger.processing('Découverte des URLs de séries (toutes les pages et langues)...')
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  try {
    // Parcourir les pages pour chaque filtre de langue
    // lang= vide pour FR, lang=jp pour japonais, lang=en pour anglais
    const langFilters = [
      { lang: '', label: 'FR' },
      { lang: 'jp', label: 'JP' },
      { lang: 'en', label: 'EN' }
    ]

    for (const langFilter of langFilters) {
      logger.info(`\nDécouverte séries ${langFilter.label}...`)

      for (let currentPage = 1; currentPage <= 10; currentPage++) {
        const langParam = langFilter.lang ? `&lang=${langFilter.lang}` : ''
        const url = `${BASE_URL}/series/search?page=${currentPage}&sortBy=date${langParam}`
        logger.info(`  Page ${currentPage}...`)

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
        await delay(2000)

        // Scroll pour charger tout le contenu
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
        await delay(500)
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

          // Vérifier s'il y a des résultats
          const noResults = document.body.textContent?.includes('0 résultat')

          return { links: [...new Set(links)], noResults }
        })

        if (pageData.noResults || pageData.links.length === 0) {
          logger.info(`  Page ${currentPage}: aucune série, fin`)
          break
        }

        // Extraire le code de série de chaque URL et stocker
        let newCount = 0
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
              newCount++
            }
          }
        }

        if (newCount > 0) {
          logger.info(`  Page ${currentPage}: ${newCount} nouvelles URLs`)
        }

        // Continuer tant qu'on trouve des résultats
        if (pageData.links.length < 20) {
          // Moins de 20 résultats = probablement dernière page
          break
        }

        await delay(1000)
      }
    }

    logger.success(`${discoveredSeriesUrls.size} URLs de séries découvertes au total`)

    // Afficher quelques exemples pour debug
    const examples = Array.from(discoveredSeriesUrls.entries()).slice(0, 10)
    examples.forEach(([key, url]) => logger.info(`  ${key}: ${url}`))

  } catch (error) {
    logger.error(`Erreur lors de la découverte: ${error}`)
  } finally {
    await page.close()
  }

  return discoveredSeriesUrls
}

/**
 * Build the series page URL based on language
 * Uses discovered URLs when available, falls back to constructed URL
 */
function buildSeriesPageUrl(seriesConfig: OnePieceSeriesConfig, language: OnePieceLanguage): string | null {
  // La clé est maintenant toujours au format "lang-CODE"
  const key = `${language}-${seriesConfig.code.toUpperCase()}`

  const discoveredUrl = discoveredSeriesUrls.get(key)
  if (discoveredUrl) {
    logger.info(`URL découverte pour ${key}: ${discoveredUrl}`)
    return discoveredUrl
  }

  // Fallback: construire l'URL (peut ne pas fonctionner pour toutes les séries)
  const langPrefix = language === 'fr' ? '' : `${language}-`
  const baseName = language === 'fr' ? (seriesConfig.nameFr || seriesConfig.name) : seriesConfig.name
  const slug = baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const fallbackUrl = `${SERIES_URL}/${langPrefix}${seriesConfig.code.toLowerCase()}-${slug}`
  logger.warn(`Pas d'URL découverte pour ${key}, utilisation du fallback: ${fallbackUrl}`)
  return fallbackUrl
}

/**
 * Scrape les cartes d'une série pour une langue donnée
 * Utilise la page de série avec le bon préfixe de langue
 */
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
    logger.warn(`Pas d'URL pour ${seriesConfig.code} en ${language.toUpperCase()}`)
    return []
  }

  try {
    logger.web(`Navigation vers: ${seriesPageUrl}`)

    await page.goto(seriesPageUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    // Attendre le chargement JavaScript
    await delay(2000)

    // Vérifier si la page existe (pas une redirection vers la liste des séries)
    const isValidPage = await page.evaluate(() => {
      const url = window.location.pathname
      // Si on est sur /series sans code spécifique, c'est une redirection
      if (url === '/series' || url === '/series/' || url.includes('/search')) return false
      // Vérifier qu'il y a des cartes
      const cardLinks = document.querySelectorAll('a[href*="/cards/"]')
      return cardLinks.length > 0
    })

    if (!isValidPage) {
      logger.info(`Série ${seriesConfig.code} non disponible en ${language.toUpperCase()}`)
      return []
    }

    logger.success('Page chargée - cartes détectées')

    // Boucle sur toutes les pages de pagination
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages) {
      logger.page(`Scraping page ${currentPage}...`)

      // Scroll pour charger toutes les cartes
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1000)

      // Extraire TOUS les liens de cartes sur cette page (sans filtrer par pattern strict)
      const pageInfo = await page.evaluate(() => {
        // Récupérer tous les liens vers /cards/
        const cardLinks = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(href => {
            const path = new URL(href).pathname
            // Exclure les liens génériques comme /cards ou /cards/search
            return path.startsWith('/cards/') &&
                   path !== '/cards' &&
                   path !== '/cards/' &&
                   !path.includes('/search') &&
                   !path.includes('cartes-les-plus-cheres')
          })

        // Chercher le nombre total de pages dans la pagination
        // Les boutons de pagination peuvent être: < 1 2 3 4 ... 6 >
        const allElements = document.body.innerText
        const paginationMatch = allElements.match(/(\d+)\s*>\s*$/m)
        const maxPage = paginationMatch ? parseInt(paginationMatch[1]) : 1

        return { cardLinks: [...new Set(cardLinks)], maxPage }
      })

      // Ajouter les URLs trouvées
      const newCards = pageInfo.cardLinks.filter(url => !allCardUrls.has(url))
      newCards.forEach(url => allCardUrls.add(url))

      logger.info(`Page ${currentPage}: ${newCards.length} nouvelles cartes (${allCardUrls.size} total)`)

      // Chercher et cliquer sur le bouton de page suivante
      if (currentPage < 30 && newCards.length > 0) {
        const nextPageClicked = await page.evaluate((nextPage) => {
          // Chercher les boutons/liens de pagination
          const allLinks = Array.from(document.querySelectorAll('a, button, span'))
          const targetButton = allLinks.find(el => {
            const text = el.textContent?.trim()
            // Chercher le numéro de page exacte ou ">" pour page suivante
            return text === nextPage.toString() ||
                   (text === '>' && el.closest('.pagination, [class*="pagin"]'))
          })

          if (targetButton && (targetButton as HTMLElement).click) {
            (targetButton as HTMLElement).click()
            return true
          }
          return false
        }, currentPage + 1)

        if (nextPageClicked) {
          currentPage++
          await delay(DELAYS.betweenPages)
          // Attendre que le contenu se recharge
          await delay(1500)
        } else {
          // Pas de bouton suivant trouvé
          hasMorePages = false
        }
      } else {
        hasMorePages = false
      }
    }

  } catch (error) {
    logger.error(`Erreur lors du scraping: ${error}`)
  } finally {
    await page.close()
  }

  logger.success(`${allCardUrls.size} URLs de cartes collectées au total`)

  // Convertir les URLs en objets carte
  const cards: OnePieceCardRaw[] = []

  for (const url of allCardUrls) {
    const processed = processRawCardFromUrl(url, language, seriesConfig.code)
    if (processed) {
      cards.push(processed)
    }
  }

  // Trier les cartes par numéro
  cards.sort((a, b) => {
    const numA = parseInt(a.number) || 0
    const numB = parseInt(b.number) || 0
    return numA - numB
  })

  return cards
}

/**
 * Traite une URL de carte et extrait les informations
 *
 * Formats d'URLs supportés:
 * - FR: /cards/op13-001-l-monkey-d-luffy
 * - JP: /cards/jp-op01-001-l-roronoa-zoro
 * - EN: /cards/en-op01-001-l-roronoa-zoro
 * - Avec version: /cards/en-op01-001-l-version-2-roronoa-zoro
 * - Premium: /cards/jp-op01-001-l-premium-bandai-roronoa-zoro
 */
function processRawCardFromUrl(
  url: string,
  language: OnePieceLanguage,
  seriesCode: string
): OnePieceCardRaw | null {
  try {
    // Extraire le chemin depuis l'URL complète
    const urlPath = url.includes('://') ? new URL(url).pathname : url
    const slug = urlPath.replace('/cards/', '')

    // Pattern flexible pour extraire les composants:
    // Préfixe langue optionnel (jp-, en-) + code série + numéro + rareté + reste
    // Exemples:
    // - op13-001-l-monkey-d-luffy
    // - jp-op01-001-l-roronoa-zoro
    // - en-op01-001-l-version-2-roronoa-zoro
    // - jp-op01-001-l-premium-bandai-roronoa-zoro
    const cardPattern = /^(?:(jp|en)-)?([a-z]+)-?(\d+)-(\d{3})-([a-z]+)-(.+)$/i
    const match = slug.match(cardPattern)

    if (!match) {
      logger.warn(`Pattern non reconnu pour: ${slug}`)
      return null
    }

    const [, langPrefix, codeLetters, codeNumbers, number, rarity, namePart] = match

    // Reconstruire le code de série (OP01, ST01, etc.)
    const fullSeriesCode = `${codeLetters.toUpperCase()}${codeNumbers}`

    // Nettoyer le nom (enlever les préfixes de version)
    let cleanNamePart = namePart
    let isVersion2 = false
    let isPremiumBandai = false

    if (namePart.startsWith('version-2-')) {
      cleanNamePart = namePart.replace('version-2-', '')
      isVersion2 = true
    } else if (namePart.startsWith('premium-bandai-')) {
      cleanNamePart = namePart.replace('premium-bandai-', '')
      isPremiumBandai = true
    } else if (namePart.includes('-version-2')) {
      cleanNamePart = namePart.replace('-version-2', '')
      isVersion2 = true
    }

    // Reconstruire le nom depuis l'URL
    const name = cleanNamePart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
      .replace(/Trafalgarlaw/gi, 'Trafalgar Law')

    const publicCode = `${fullSeriesCode}-${number}-${rarity.toUpperCase()}`
    const { finish, isAlternateArt } = detectFinish(slug, name)

    // Déterminer le finish basé sur les indicateurs trouvés
    let finalFinish = finish
    if (isVersion2 || isPremiumBandai) {
      finalFinish = isPremiumBandai ? 'special' : 'alternate'
    }

    // Construire l'URL de l'image
    // Le préfixe dans l'URL de l'image correspond à la langue de la carte
    const cardLang = langPrefix || (language === 'fr' ? '' : language)
    const imagePrefix = cardLang ? `image-trading-cards` : `image-cartes-a-collectionner`
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
    logger.error(`Erreur traitement URL: ${url} - ${e}`)
    return null
  }
}

/**
 * Traite une carte brute extraite
 */
function processRawCard(
  raw: { url: string; name: string; publicCode: string; imageUrl?: string; number?: string; rarity?: string },
  language: OnePieceLanguage,
  seriesCode: string
): OnePieceCardRaw | null {
  try {
    // Si on a déjà les infos extraites directement
    if (raw.number && raw.rarity) {
      const { finish, isAlternateArt } = detectFinish(raw.url, raw.name)
      const slug = raw.url.replace('/cards/', '')

      // Construire l'URL de l'image si pas fournie
      let imageUrl = raw.imageUrl
      if (!imageUrl || imageUrl.includes('back-')) {
        imageUrl = `https://static.opecards.fr/cards/${language}/${seriesCode.toLowerCase()}/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-${slug}.webp`
      }

      return {
        url: raw.url,
        name: raw.name,
        publicCode: raw.publicCode,
        number: raw.number,
        rarity: normalizeRarity(raw.rarity),
        colors: [],
        cardType: raw.rarity.toLowerCase() === 'l' ? 'leader' : 'character',
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
        finish,
        isAlternateArt
      }
    }

    // Sinon, parser l'URL
    const parsed = parseOnePieceCardUrl(raw.url, { language })

    if (!parsed) {
      // Extraire manuellement depuis le publicCode
      const codeMatch = raw.publicCode.match(/^([A-Z]+\d+)-(\d{3})-([A-Z]+)$/i)
      if (!codeMatch) return null

      const [, code, number, rarity] = codeMatch
      const { finish, isAlternateArt } = detectFinish(raw.url, raw.name)
      const slug = raw.url.replace('/cards/', '')

      return {
        url: raw.url,
        name: raw.name,
        publicCode: raw.publicCode,
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
        imageUrl: raw.imageUrl || `https://static.opecards.fr/cards/${language}/${seriesCode.toLowerCase()}/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-${slug}.webp`,
        finish,
        isAlternateArt
      }
    }

    return {
      url: raw.url,
      name: raw.name || parsed.name,
      publicCode: parsed.publicCode,
      number: parsed.number,
      rarity: parsed.rarity,
      colors: [],
      cardType: parsed.rarity === 'l' ? 'leader' : 'character',
      attribute: null,
      power: null,
      cost: null,
      life: null,
      counter: null,
      affiliations: [],
      effectText: null,
      trigger: null,
      illustrator: null,
      imageUrl: raw.imageUrl || parsed.imageUrl,
      finish: parsed.finish,
      isAlternateArt: parsed.isAlternateArt
    }
  } catch (e) {
    logger.error(`Erreur traitement carte: ${e}`)
    return null
  }
}

/**
 * Enrichit les données d'une carte en visitant sa page de détail
 */
async function enrichCardData(
  page: Page,
  card: OnePieceCardRaw,
  language: OnePieceLanguage
): Promise<OnePieceCardRaw> {
  try {
    await page.goto(`${BASE_URL}${card.url}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await delay(1000)

    const enriched = await page.evaluate(() => {
      const data: any = {}

      // Extraire les couleurs
      const colorEls = document.querySelectorAll('[class*="color"], .card-colors span')
      data.colors = Array.from(colorEls).map(el => el.textContent?.trim().toLowerCase())

      // Extraire le type
      const typeEl = document.querySelector('[class*="type"], .card-type')
      data.cardType = typeEl?.textContent?.trim()

      // Extraire l'attribut
      const attrEl = document.querySelector('[class*="attribute"], .card-attribute')
      data.attribute = attrEl?.textContent?.trim()

      // Extraire les stats
      const powerEl = document.querySelector('[class*="power"]')
      data.power = powerEl?.textContent?.match(/\d+/)?.[0]

      const costEl = document.querySelector('[class*="cost"]')
      data.cost = costEl?.textContent?.match(/\d+/)?.[0]

      const lifeEl = document.querySelector('[class*="life"]')
      data.life = lifeEl?.textContent?.match(/\d+/)?.[0]

      const counterEl = document.querySelector('[class*="counter"]')
      data.counter = counterEl?.textContent?.match(/\d+/)?.[0]

      // Extraire les affiliations
      const affEls = document.querySelectorAll('[class*="affiliation"], .card-traits span')
      data.affiliations = Array.from(affEls).map(el => el.textContent?.trim())

      // Extraire le texte d'effet
      const effectEl = document.querySelector('[class*="effect"], .card-effect, .ability-text')
      data.effectText = effectEl?.textContent?.trim()

      // Extraire le trigger
      const triggerEl = document.querySelector('[class*="trigger"]')
      data.trigger = triggerEl?.textContent?.trim()

      // Extraire l'illustrateur
      const illusEl = document.querySelector('[class*="illustrator"]')
      data.illustrator = illusEl?.textContent?.replace(/illustra(teur|tor)/i, '').trim()

      // Image haute qualité
      const imgEl = document.querySelector('img.card-image-large, img.card-detail-image, img[src*="opecards"]') as HTMLImageElement
      data.imageUrl = imgEl?.src

      return data
    })

    return {
      ...card,
      colors: enriched.colors?.filter(Boolean) || card.colors,
      cardType: enriched.cardType ? parseCardType(enriched.cardType) : card.cardType,
      attribute: enriched.attribute ? parseAttribute(enriched.attribute) : card.attribute,
      power: enriched.power ? parseInt(enriched.power) : card.power,
      cost: enriched.cost ? parseInt(enriched.cost) : card.cost,
      life: enriched.life ? parseInt(enriched.life) : card.life,
      counter: enriched.counter ? parseInt(enriched.counter) : card.counter,
      affiliations: enriched.affiliations?.filter(Boolean) || card.affiliations,
      effectText: enriched.effectText || card.effectText,
      trigger: enriched.trigger || card.trigger,
      illustrator: enriched.illustrator || card.illustrator,
      imageUrl: enriched.imageUrl || card.imageUrl
    }

  } catch (e) {
    logger.warn(`Erreur enrichissement carte ${card.publicCode}: ${e}`)
    return card
  }
}

// ============================================
// INSERT FUNCTIONS
// ============================================

/**
 * Insère les cartes dans la base de données
 */
async function insertCards(
  seriesId: string,
  cards: OnePieceCardRaw[],
  language: OnePieceLanguage,
  seriesCode: string
) {
  logger.section(`Insertion de ${cards.length} cartes (${language.toUpperCase()})`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    try {
      logger.progress(`[${i + 1}/${cards.length}] ${card.name}`)

      // Upload de l'image (sauf si --skip-images)
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

      // Insertion dans la base de données
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
        logger.error(`Erreur insertion ${card.name}: ${error.message}`)
        errorCount++
      } else {
        logger.success(`Carte ${card.name} insérée`)
        successCount++
      }

      // Rate limiting
      if (i < cards.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      logger.error(`Erreur carte ${card.name}: ${error}`)
      errorCount++
    }
  }

  logger.section('Résumé insertion')
  logger.success(`Succès: ${successCount}`)
  if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
  logger.info(`Total: ${cards.length}`)
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  logger.section('Scraping One Piece Card Game')
  console.log(`Source: ${BASE_URL}`)
  console.log(`Série: ${seriesArg}`)
  console.log(`Langue(s): ${langArg}`)
  console.log(`Skip images: ${skipImages}`)

  // Récupérer la config de la série
  const seriesConfig = getSeriesByCode(seriesArg)
  if (!seriesConfig) {
    logger.error(`Série ${seriesArg} non trouvée dans la configuration`)
    process.exit(1)
  }

  // Déterminer les langues à traiter
  const languages: OnePieceLanguage[] = langArg === 'all'
    ? ['fr', 'en', 'jp']
    : [langArg as OnePieceLanguage]

  try {
    // Étape 1: Créer le bucket
    logger.info('\n1. Vérification du bucket Supabase Storage...')
    await createOnePieceBucket()

    // Étape 2: Vérifier que One Piece existe
    logger.info('\n2. Vérification du TCG One Piece...')
    const gameId = await getOnePieceGameId()
    logger.success(`One Piece trouvé: ${gameId}`)

    // Étape 3: Créer/récupérer la série
    logger.info('\n3. Création/récupération de la série...')
    const seriesId = await upsertSeries(gameId, seriesConfig)
    logger.success(`Série ${seriesConfig.code}: ${seriesId}`)

    // Étape 4: Lancer Puppeteer
    logger.info('\n4. Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      // Étape 5: Découvrir les URLs de toutes les séries
      logger.info('\n5. Découverte des URLs de séries...')
      await discoverSeriesUrls(browser)

      // Étape 6: Scraper pour chaque langue
      for (const lang of languages) {
        // Vérifier si la série est disponible dans cette langue
        if (!isSeriesAvailableInLanguage(seriesConfig.code, lang)) {
          logger.warn(`${seriesConfig.code} n'est pas disponible en ${lang.toUpperCase()} - SKIP`)
          continue
        }

        logger.section(`Scraping ${seriesConfig.code} - ${lang.toUpperCase()}`)

        // Scraper les cartes
        const cards = await scrapeSeriesCards(browser, seriesConfig, lang)
        logger.success(`${cards.length} cartes trouvées`)

        if (cards.length === 0) {
          logger.warn(`Aucune carte trouvée pour ${seriesConfig.code} (${lang})`)
          continue
        }

        // Enrichir les données (optionnel, peut être lent)
        // Décommenter pour récupérer tous les détails de chaque carte
        /*
        const page = await browser.newPage()
        for (let i = 0; i < cards.length; i++) {
          logger.processing(`Enrichissement [${i + 1}/${cards.length}]`)
          cards[i] = await enrichCardData(page, cards[i], lang)
          await delay(500)
        }
        await page.close()
        */

        // Insérer les cartes
        await insertCards(seriesId, cards, lang, seriesConfig.code)

        // Pause entre les langues
        if (languages.indexOf(lang) < languages.length - 1) {
          await delay(DELAYS.betweenSeries)
        }
      }
    } finally {
      await browser.close()
      logger.info('Navigateur fermé')
    }

    logger.section('Scraping terminé avec succès!')
    console.log(`\nConsultez vos cartes: http://localhost:3000/series/onepiece/${seriesConfig.code}`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution
main()
