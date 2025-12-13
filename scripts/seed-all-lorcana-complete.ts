/**
 * Script complet de seeding pour TOUTES les cartes Disney Lorcana
 * Récupère les cartes FR, EN et JP pour chaque série
 *
 * Sources:
 * - FR: https://www.lorcards.fr (scraping Puppeteer)
 * - EN: https://api.lorcast.com/v0 (API REST)
 * - JP: https://cdn.dreamborn.ink (CDN images)
 *
 * Usage:
 *   npx tsx scripts/seed-all-lorcana-complete.ts
 *   npx tsx scripts/seed-all-lorcana-complete.ts --lang=FR        # FR uniquement
 *   npx tsx scripts/seed-all-lorcana-complete.ts --lang=EN        # EN uniquement
 *   npx tsx scripts/seed-all-lorcana-complete.ts --lang=JP        # JP uniquement
 *   npx tsx scripts/seed-all-lorcana-complete.ts --set=9          # Set 9 uniquement
 *   npx tsx scripts/seed-all-lorcana-complete.ts --set=1,2,3      # Sets 1, 2, 3
 *   npx tsx scripts/seed-all-lorcana-complete.ts --clean-only     # Nettoie les doublons uniquement
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createLorcanaBucket } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS, SCRIPT_LIMITS } from '../lib/constants/app-config'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

// Supabase admin client for storage operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseStorage = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabase = createAdminClient()

// Définition des séries Lorcana
interface SeriesConfig {
  setNumber: number
  code: string
  name: string
  nameFR: string
  urlFR: string
  imageUrl: string
  maxCards: number
  masterSet: number
}

const ALL_SERIES: SeriesConfig[] = [
  {
    setNumber: 1,
    code: 'FirstChapter',
    name: 'The First Chapter',
    nameFR: 'Premier Chapitre',
    urlFR: 'https://www.lorcards.fr/series/fc-premier-chapitre',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-fc-premier-chapitre.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 2,
    code: 'ROTF',
    name: 'Rise of the Floodborn',
    nameFR: "L'Ascension Des Floodborn",
    urlFR: 'https://www.lorcards.fr/series/rotf-ascension-des-floodborn',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-rotf-ascension-des-floodborn.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 3,
    code: 'ITI',
    name: 'Into the Inklands',
    nameFR: "Les Terres d'Encres",
    urlFR: 'https://www.lorcards.fr/series/iti-les-terres-d-encres',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-iti-les-terres-d-encres.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 4,
    code: 'URR',
    name: "Ursula's Return",
    nameFR: "Le Retour d'Ursula",
    urlFR: 'https://www.lorcards.fr/series/urr-le-retour-d-ursula',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-urr-le-retour-d-ursula.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 5,
    code: 'SSK',
    name: 'Shimmering Skies',
    nameFR: 'Ciel Scintillant',
    urlFR: 'https://www.lorcards.fr/series/set-5-skk-ciel-scintillant',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-5-skk-ciel-scintillant.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 6,
    code: 'AZS',
    name: 'Azurite Sea',
    nameFR: 'La Mer Azurite',
    urlFR: 'https://www.lorcards.fr/series/set-6-azs-la-mer-azurite',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-6-azs-la-mer-azurite.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 7,
    code: 'ARI',
    name: "Archazia's Island",
    nameFR: "L'Île d'Archazia",
    urlFR: "https://www.lorcards.fr/series/set-7-ari-l-ile-d-archazia",
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-7-ari-l-ile-d-archazia.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 8,
    code: 'ROJ',
    name: 'Reign of Jafar',
    nameFR: 'Le Règne de Jafar',
    urlFR: 'https://www.lorcards.fr/series/set-8-roj-le-regne-de-jafar',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-8-roj-le-regne-de-jafar.webp',
    maxCards: 204,
    masterSet: 216
  },
  {
    setNumber: 9,
    code: 'fabuleux',
    name: 'Fabled',
    nameFR: 'Fabuleux',
    urlFR: 'https://www.lorcards.fr/series/set-9-fab-fabuleux',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-9-fab-fabuleux.webp',
    maxCards: 204,
    masterSet: 243
  },
  {
    setNumber: 10,
    code: 'WHW',
    name: 'Whispers in the Well',
    nameFR: 'Lueurs dans les Profondeurs',
    urlFR: 'https://www.lorcards.fr/series/set-10-lueurs-dans-les-profondeurs',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-10-lueurs-dans-les-profondeurs.webp',
    maxCards: 204,
    masterSet: 243
  }
]

// Mapping pour les URLs source de lorcards.fr (leur convention de nommage)
const LORCARDS_FOLDER_CODES: Record<string, string> = {
  'FirstChapter': 'fc',
  'ROTF': 'rotf',
  'ITI': 'iti',
  'URR': 'urr',
  'SSK': 'ssk',
  'AZS': 'azs',
  'ARI': 'ari',
  'ROJ': 'roj',
  'fabuleux': 'fab',
  'WHW': 'whw'
}

/**
 * Upload une image de carte avec la structure: {seriesCode}/{language}/{cardNumber}.webp
 */
async function uploadCardImageWithLanguage(
  imageUrl: string,
  cardNumber: string,
  seriesCode: string,
  language: string
): Promise<{ success: boolean; url?: string; error?: unknown }> {
  try {
    // Télécharger l'image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Générer le chemin: {seriesCode}/{language}/{cardNumber}.webp
    const fileName = `${seriesCode}/${language.toUpperCase()}/${cardNumber.replace('/', '-')}.webp`

    // Upload sur Supabase Storage
    const { error } = await supabaseStorage.storage
      .from('lorcana-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error }
    }

    // Générer l'URL publique
    const { data: publicUrlData } = supabaseStorage.storage
      .from('lorcana-cards')
      .getPublicUrl(fileName)

    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    return { success: false, error }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface CardData {
  name: string
  number: string
  language: string
  chapter: number
  rarity: string
  imageUrl: string
  attributes?: Record<string, unknown>
}

interface LorcastCard {
  id: string
  collector_number: string
  name: string
  version: string | null
  image_uris: {
    digital: {
      small: string
      normal: string
      large: string
    }
  }
  rarity: string
  ink?: string
  cost?: number
  type?: string[]
}

interface LorcastResponse {
  results: LorcastCard[]
}

interface ProcessResult {
  inserted: number
  updated: number
  errors: number
  skipped: number
}

// ============================================================================
// UTILITIES
// ============================================================================

function mapRarity(lorcastRarity: string): string {
  const rarityMap: Record<string, string> = {
    'Common': 'Common',
    'Uncommon': 'Uncommon',
    'Rare': 'Rare',
    'Super_rare': 'Super Rare',
    'Legendary': 'Legendary',
    'Enchanted': 'Enchanted',
    'Promo': 'Promo'
  }
  return rarityMap[lorcastRarity] || lorcastRarity
}

function formatCardName(name: string, version: string | null): string {
  if (version) {
    return `${name} - ${version}`
  }
  return name
}

function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Récupère l'ID du TCG Lorcana
 */
async function getLorcanaGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'lorcana')
    .single()

  if (error || !data) {
    throw new Error('TCG Lorcana non trouvé dans la base de données')
  }

  return data.id
}

/**
 * Récupère ou crée une série
 */
async function getOrCreateSeries(gameId: string, config: SeriesConfig): Promise<string> {
  // Check if exists
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('code', config.code)
    .single()

  if (existing) {
    // Update
    await supabase
      .from('series')
      .update({
        name: config.nameFR,
        max_set_base: config.maxCards,
        master_set: config.masterSet,
        image_url: config.imageUrl
      })
      .eq('id', existing.id)

    return existing.id
  }

  // Create
  const { data: created, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: gameId,
      name: config.nameFR,
      code: config.code,
      max_set_base: config.maxCards,
      master_set: config.masterSet,
      image_url: config.imageUrl,
      release_date: new Date().toISOString().split('T')[0]
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`Erreur création série ${config.code}: ${error?.message}`)
  }

  return created.id
}

/**
 * Supprime les doublons de cartes dans la base de données
 */
async function cleanDuplicates(): Promise<number> {
  logger.section('Nettoyage des doublons')

  // Get Lorcana game ID
  const gameId = await getLorcanaGameId()

  // Get all Lorcana series
  const { data: series } = await supabase
    .from('series')
    .select('id, code')
    .eq('tcg_game_id', gameId)

  if (!series || series.length === 0) {
    logger.info('Aucune série trouvée')
    return 0
  }

  let totalDeleted = 0

  for (const s of series) {
    // Find duplicates: same series_id + number + language
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, language, created_at')
      .eq('series_id', s.id)
      .order('created_at', { ascending: true })

    if (!cards || cards.length === 0) continue

    // Group by number + language
    const groups = new Map<string, typeof cards>()
    for (const card of cards) {
      const key = `${card.number}::${card.language || 'NULL'}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(card)
    }

    // Find and delete duplicates (keep the oldest)
    const idsToDelete: string[] = []
    for (const [key, group] of groups) {
      if (group.length > 1) {
        // Keep first (oldest), delete rest
        const duplicates = group.slice(1)
        idsToDelete.push(...duplicates.map(c => c.id))
        logger.info(`  ${s.code}: ${key} - ${duplicates.length} doublon(s)`)
      }
    }

    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from('cards')
        .delete()
        .in('id', idsToDelete)

      if (error) {
        logger.error(`Erreur suppression doublons ${s.code}: ${error.message}`)
      } else {
        totalDeleted += idsToDelete.length
        logger.success(`${s.code}: ${idsToDelete.length} doublons supprimés`)
      }
    }
  }

  logger.success(`Total: ${totalDeleted} doublons supprimés`)
  return totalDeleted
}

/**
 * Supprime un dossier orphelin du storage (comme FC créé par erreur)
 */
async function deleteOrphanFolder(folderName: string): Promise<number> {
  logger.processing(`Suppression du dossier orphelin: ${folderName}`)

  try {
    // Lister tous les fichiers dans le dossier
    const { data: files, error: listError } = await supabaseStorage.storage
      .from('lorcana-cards')
      .list(folderName, { limit: 1000 })

    if (listError) {
      logger.error(`Erreur listing ${folderName}: ${listError.message}`)
      return 0
    }

    if (!files || files.length === 0) {
      logger.info(`Dossier ${folderName} vide ou inexistant`)
      return 0
    }

    // Supprimer tous les fichiers
    const filePaths = files.map(file => `${folderName}/${file.name}`)
    const { error: deleteError } = await supabaseStorage.storage
      .from('lorcana-cards')
      .remove(filePaths)

    if (deleteError) {
      logger.error(`Erreur suppression ${folderName}: ${deleteError.message}`)
      return 0
    }

    logger.success(`${files.length} fichiers supprimés de ${folderName}`)
    return files.length

  } catch (error) {
    logger.error(`Exception suppression ${folderName}: ${error}`)
    return 0
  }
}

/**
 * Nettoie les dossiers orphelins créés par erreur (FC, FAB, etc.)
 */
async function cleanOrphanFolders(): Promise<void> {
  logger.section('Nettoyage des dossiers orphelins')

  // Dossiers qui ne devraient pas exister (ancienne nomenclature)
  const orphanFolders = ['FC', 'FAB']

  for (const folder of orphanFolders) {
    await deleteOrphanFolder(folder)
  }
}

/**
 * Insère ou met à jour une carte
 */
async function upsertCard(
  seriesId: string,
  card: CardData,
  seriesCode: string
): Promise<'inserted' | 'updated' | 'error'> {
  try {
    // Upload image avec structure: {seriesCode}/{language}/{cardNumber}.webp
    const uploadResult = await uploadCardImageWithLanguage(
      card.imageUrl,
      card.number,
      seriesCode,
      card.language
    )

    const finalImageUrl = uploadResult.success && uploadResult.url
      ? uploadResult.url
      : card.imageUrl

    // Check if exists
    const { data: existing } = await supabase
      .from('cards')
      .select('id')
      .eq('series_id', seriesId)
      .eq('number', card.number)
      .eq('language', card.language)
      .single()

    const cardData = {
      series_id: seriesId,
      name: card.name,
      number: card.number,
      language: card.language,
      chapter: card.chapter,
      rarity: card.rarity,
      image_url: finalImageUrl,
      attributes: card.attributes || {}
    }

    if (existing) {
      // Update
      const { error } = await supabase
        .from('cards')
        .update(cardData)
        .eq('id', existing.id)

      if (error) {
        logger.error(`Erreur update #${card.number} ${card.language}: ${error.message}`)
        return 'error'
      }
      return 'updated'
    } else {
      // Insert
      const { error } = await supabase
        .from('cards')
        .insert(cardData)

      if (error) {
        logger.error(`Erreur insert #${card.number} ${card.language}: ${error.message}`)
        return 'error'
      }
      return 'inserted'
    }
  } catch (err) {
    logger.error(`Exception #${card.number} ${card.language}: ${err}`)
    return 'error'
  }
}

// ============================================================================
// FR: LORCARDS.FR SCRAPING
// ============================================================================

/**
 * Scrape les cartes FR depuis lorcards.fr
 */
async function scrapeFrenchCards(
  browser: Browser,
  config: SeriesConfig
): Promise<CardData[]> {
  logger.processing(`Scraping FR: ${config.nameFR}`)

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const cards: CardData[] = []

  try {
    await page.goto(config.urlFR, {
      waitUntil: 'networkidle0',
      timeout: SCRIPT_LIMITS.requestTimeout
    })

    // Wait for cards
    await page.waitForSelector('a[href^="/cards/"]', { timeout: 10000 })

    // Paginate and collect all card URLs
    const allCardUrls = new Set<string>()
    let currentPage = 1
    let hasMorePages = true

    while (hasMorePages && currentPage <= SCRIPT_LIMITS.maxPages) {
      await delay(1000)

      const cardUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="/cards/"]'))
        return links.map(link => (link as HTMLAnchorElement).href)
      })

      cardUrls.forEach(url => allCardUrls.add(url))
      logger.info(`  Page ${currentPage}: ${cardUrls.length} cartes (total: ${allCardUrls.size})`)

      // Check for next page
      const nextPageButton = await page.evaluate((page) => {
        const buttons = Array.from(document.querySelectorAll('.pagination .page-item'))
        const nextPage = page + 1
        const nextButton = buttons.find(item => {
          const span = item.querySelector('.page-link')
          return span?.textContent?.trim() === nextPage.toString()
        })
        return nextButton ? nextPage : null
      }, currentPage)

      if (nextPageButton) {
        await page.evaluate((pageNum) => {
          const buttons = Array.from(document.querySelectorAll('.pagination .page-item'))
          const targetButton = buttons.find(item => {
            const span = item.querySelector('.page-link')
            return span?.textContent?.trim() === pageNum.toString()
          })
          if (targetButton) {
            const span = targetButton.querySelector('.page-link') as HTMLElement
            span?.click()
          }
        }, nextPageButton)

        await delay(DELAYS.betweenPages)
        await page.waitForSelector('a[href^="/cards/"]', { timeout: 10000 })
        currentPage = nextPageButton
      } else {
        hasMorePages = false
      }
    }

    // Parse card URLs
    for (const url of allCardUrls) {
      const parsed = parseCardUrlFR(url, config)
      if (parsed) {
        cards.push(parsed)
      }
    }

    logger.success(`FR: ${cards.length} cartes récupérées`)

  } catch (error) {
    logger.error(`Erreur scraping FR: ${error}`)
  } finally {
    await page.close()
  }

  return cards
}

/**
 * Parse une URL de carte lorcards.fr
 */
function parseCardUrlFR(url: string, config: SeriesConfig): CardData | null {
  const match = url.match(/\/cards\/(.+)$/)
  if (!match) return null

  const slug = match[1]
  // Utiliser le mapping lorcards.fr pour construire l'URL source
  const lorcardsFolder = LORCARDS_FOLDER_CODES[config.code] || config.code.toLowerCase()

  // Pattern 1: {seriesName}-{number}-{setBase}-{cardName}
  const seriesNameMatch = slug.match(/^([a-z-]+)-(\d+)-(\d+)-(.+)/)
  if (seriesNameMatch) {
    const [, , index, , namePart] = seriesNameMatch
    const name = slugToTitle(namePart)
    const imageUrl = `https://static.lorcards.fr/cards/fr/${lorcardsFolder}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      name,
      number: index,
      language: 'FR',
      chapter: config.setNumber,
      rarity: 'Common',
      imageUrl
    }
  }

  // Pattern 2: {number}-{setBase}-{lang}-{chapter}-{name}
  const numberMatch = slug.match(/^(\d+)-(\d+)-([a-z]{2})-(\d+)-(.+)/)
  if (numberMatch) {
    const [, index, , lang, version, namePart] = numberMatch
    const name = slugToTitle(namePart)
    const imageUrl = `https://static.lorcards.fr/cards/fr/${lorcardsFolder}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      name,
      number: index,
      language: lang.toUpperCase(),
      chapter: parseInt(version),
      rarity: 'Common',
      imageUrl
    }
  }

  // Pattern 3: {number}-{lang}-{chapter}-{name}
  const simpleMatch = slug.match(/^(\d+)-([a-z]{2})-(\d+)-(.+)/)
  if (simpleMatch) {
    const [, index, lang, version, namePart] = simpleMatch
    const name = slugToTitle(namePart)
    const imageUrl = `https://static.lorcards.fr/cards/fr/${lorcardsFolder}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      name,
      number: index,
      language: lang.toUpperCase(),
      chapter: parseInt(version),
      rarity: 'Common',
      imageUrl
    }
  }

  return null
}

// ============================================================================
// EN: LORCAST API
// ============================================================================

/**
 * Récupère les cartes EN depuis l'API Lorcast
 */
async function fetchEnglishCards(config: SeriesConfig): Promise<CardData[]> {
  logger.processing(`Fetching EN: ${config.name}`)

  const cards: CardData[] = []
  let page = 1
  let hasMore = true

  try {
    while (hasMore) {
      const url = `https://api.lorcast.com/v0/cards/search?q=set:${config.setNumber}&page=${page}`
      logger.info(`  Page ${page}...`)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Lorcast API error: ${response.statusText}`)
      }

      const data: LorcastResponse = await response.json()

      if (data.results && data.results.length > 0) {
        for (const lorcastCard of data.results) {
          cards.push({
            name: formatCardName(lorcastCard.name, lorcastCard.version),
            number: lorcastCard.collector_number,
            language: 'EN',
            chapter: config.setNumber,
            rarity: mapRarity(lorcastCard.rarity),
            imageUrl: lorcastCard.image_uris.digital.large,
            attributes: {
              ink: lorcastCard.ink || null,
              cost: lorcastCard.cost || null,
              type: lorcastCard.type || null
            }
          })
        }

        hasMore = data.results.length === 100
        page++

        if (hasMore) {
          await delay(100) // Lorcast rate limit: 50-100ms
        }
      } else {
        hasMore = false
      }
    }

    logger.success(`EN: ${cards.length} cartes récupérées`)

  } catch (error) {
    logger.error(`Erreur fetch EN: ${error}`)
  }

  return cards
}

// ============================================================================
// JP: DREAMBORN CDN
// ============================================================================

const DREAMBORN_CDN = 'https://cdn.dreamborn.ink/images/ja/cards'

/**
 * Vérifie si une image existe sur le CDN
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Génère les cartes JP depuis le CDN Dreamborn
 */
async function fetchJapaneseCards(config: SeriesConfig): Promise<CardData[]> {
  logger.processing(`Fetching JP: ${config.name}`)

  const cards: CardData[] = []
  const paddedSet = config.setNumber.toString().padStart(3, '0')

  // Check cards 1 to maxCards
  for (let cardNum = 1; cardNum <= config.maxCards; cardNum++) {
    const paddedNumber = cardNum.toString().padStart(3, '0')
    const imageUrl = `${DREAMBORN_CDN}/${paddedSet}-${paddedNumber}`

    // Check if image exists
    const exists = await checkImageExists(imageUrl)

    if (exists) {
      cards.push({
        name: `カード #${cardNum}`, // Placeholder name in Japanese
        number: cardNum.toString(),
        language: 'JP',
        chapter: config.setNumber,
        rarity: 'Common',
        imageUrl
      })
    }

    // Rate limiting
    if (cardNum % 50 === 0) {
      logger.info(`  Vérifié ${cardNum}/${config.maxCards} cartes`)
      await delay(100)
    }
  }

  logger.success(`JP: ${cards.length} cartes trouvées`)
  return cards
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

/**
 * Traite une série complète pour une langue donnée
 */
async function processSeriesLanguage(
  seriesId: string,
  cards: CardData[],
  seriesCode: string,
  lang: string
): Promise<ProcessResult> {
  const result: ProcessResult = { inserted: 0, updated: 0, errors: 0, skipped: 0 }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    if ((i + 1) % 20 === 0 || i === cards.length - 1) {
      logger.progress(`${lang}: ${i + 1}/${cards.length}`)
    }

    const status = await upsertCard(seriesId, card, seriesCode)

    if (status === 'inserted') result.inserted++
    else if (status === 'updated') result.updated++
    else result.errors++

    // Rate limiting
    await delay(DELAYS.betweenUploads)
  }

  return result
}

/**
 * Traite une série complète (toutes langues)
 */
async function processSeries(
  browser: Browser,
  gameId: string,
  config: SeriesConfig,
  languages: string[]
): Promise<void> {
  logger.section(`Set ${config.setNumber}: ${config.nameFR}`)

  // Get or create series
  const seriesId = await getOrCreateSeries(gameId, config)
  // Utiliser directement config.code comme dossier de storage
  const seriesCode = config.code

  logger.success(`Série ID: ${seriesId}`)
  logger.info(`Storage: lorcana-cards/${seriesCode}/{LANG}/{number}.webp`)

  // Process each language
  for (const lang of languages) {
    let cards: CardData[] = []

    if (lang === 'FR') {
      cards = await scrapeFrenchCards(browser, config)
    } else if (lang === 'EN') {
      cards = await fetchEnglishCards(config)
    } else if (lang === 'JP') {
      cards = await fetchJapaneseCards(config)
    }

    if (cards.length === 0) {
      logger.warn(`${lang}: Aucune carte trouvée`)
      continue
    }

    const result = await processSeriesLanguage(seriesId, cards, seriesCode, lang)
    logger.success(`${lang}: +${result.inserted} inserted, ~${result.updated} updated, x${result.errors} errors`)

    // Delay between languages
    await delay(2000)
  }
}

// ============================================================================
// SCRIPT ENTRY POINT
// ============================================================================

async function main() {
  console.log('\n')
  logger.section('LORCANA COMPLETE SEEDING SCRIPT')
  console.log('Sources:')
  console.log('  FR: lorcards.fr (Puppeteer)')
  console.log('  EN: api.lorcast.com')
  console.log('  JP: cdn.dreamborn.ink')
  console.log('\n')

  // Parse arguments
  const args = process.argv.slice(2)
  const langArg = args.find(a => a.startsWith('--lang='))
  const setArg = args.find(a => a.startsWith('--set='))
  const cleanOnly = args.includes('--clean-only')

  // Determine languages
  let languages: string[] = ['FR', 'EN', 'JP']
  if (langArg) {
    const lang = langArg.split('=')[1].toUpperCase()
    if (['FR', 'EN', 'JP'].includes(lang)) {
      languages = [lang]
    } else {
      logger.error(`Langue invalide: ${lang}. Utilisez FR, EN ou JP.`)
      process.exit(1)
    }
  }

  // Determine sets
  let setsToProcess = ALL_SERIES
  if (setArg) {
    const setNumbers = setArg.split('=')[1].split(',').map(n => parseInt(n.trim()))
    setsToProcess = ALL_SERIES.filter(s => setNumbers.includes(s.setNumber))

    if (setsToProcess.length === 0) {
      logger.error(`Aucune série trouvée pour: ${setArg}`)
      process.exit(1)
    }
  }

  logger.info(`Langues: ${languages.join(', ')}`)
  logger.info(`Séries: ${setsToProcess.map(s => s.setNumber).join(', ')}`)

  try {
    // Step 1: Clean duplicates in database
    await cleanDuplicates()

    // Step 2: Clean orphan folders in storage (FC, FAB, etc.)
    await cleanOrphanFolders()

    if (cleanOnly) {
      logger.success('Nettoyage terminé.')
      return
    }

    // Step 3: Setup
    logger.processing('Vérification du bucket Supabase...')
    await createLorcanaBucket()

    const gameId = await getLorcanaGameId()
    logger.success(`Lorcana ID: ${gameId}`)

    // Step 4: Launch browser (only if FR is in languages)
    let browser: Browser | null = null
    if (languages.includes('FR')) {
      logger.web('Lancement du navigateur...')
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }

    // Step 5: Process each series
    for (let i = 0; i < setsToProcess.length; i++) {
      const config = setsToProcess[i]

      logger.progress(`\nProgression: ${i + 1}/${setsToProcess.length}`)

      await processSeries(browser!, gameId, config, languages)

      // Delay between series
      if (i < setsToProcess.length - 1) {
        logger.info(`Pause ${DELAYS.betweenSeries / 1000}s...`)
        await delay(DELAYS.betweenSeries)
      }
    }

    // Cleanup
    if (browser) {
      await browser.close()
      logger.web('Navigateur fermé')
    }

    // Final summary
    logger.section('SEEDING TERMINÉ')
    logger.success('Toutes les cartes ont été traitées!')
    console.log('\nConsultez vos cartes: http://localhost:3000/series/lorcana')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Run
main()
