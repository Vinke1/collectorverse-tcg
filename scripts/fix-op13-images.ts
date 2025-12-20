/**
 * Script pour corriger les images de la série OP13
 *
 * Compare les images dans Supabase avec celles d'opecards.fr et remplace les incorrectes
 *
 * Usage:
 *   npx tsx scripts/fix-op13-images.ts --dry-run    # Analyse seulement
 *   npx tsx scripts/fix-op13-images.ts              # Corrige les images
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
const SEARCH_URL = `${BASE_URL}/cards/search?sortBy=number&serie=750&language=FR`
const SERIES_CODE = 'OP13'
const LANGUAGE = 'fr'
const STORAGE_BUCKET = 'onepiece-cards'

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Initialize Supabase admin client
const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface CardImage {
  number: string
  name: string
  imageUrl: string
  slug: string
}

interface DatabaseCard {
  id: string
  number: string
  name: string
  image_url: string | null
  attributes: {
    slug?: string
    [key: string]: any
  } | null
}

// ============================================
// SCRAPING FUNCTIONS
// ============================================

/**
 * Scrape toutes les cartes OP13 depuis opecards.fr (6 pages)
 */
async function scrapeOP13Cards(browser: Browser): Promise<CardImage[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allCards: CardImage[] = []

  try {
    for (let pageNum = 1; pageNum <= 6; pageNum++) {
      const url = `${SEARCH_URL}&page=${pageNum}`
      logger.info(`Scraping page ${pageNum}/6: ${url}`)

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
      await delay(2000)

      // Scroll pour charger le contenu
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await delay(500)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(1500)

      // Extraire les cartes de cette page
      const pageCards = await page.evaluate(() => {
        const cards: { url: string; imageUrl: string }[] = []

        // Récupérer les liens de cartes
        const cardLinks = document.querySelectorAll('a[href*="/cards/op13-"]')

        cardLinks.forEach(link => {
          const href = (link as HTMLAnchorElement).href

          // Chercher l'image dans le lien
          const img = link.querySelector('img[src*="static.opecards.fr"]') as HTMLImageElement
          if (img && img.src) {
            // Ignorer les dos de cartes
            if (!img.src.includes('back-')) {
              cards.push({
                url: href,
                imageUrl: img.src
              })
            }
          }
        })

        return cards
      })

      logger.info(`  Page ${pageNum}: ${pageCards.length} cartes trouvées`)

      // Traiter chaque carte
      for (const card of pageCards) {
        const parsed = parseCardUrl(card.url, card.imageUrl)
        if (parsed) {
          // Vérifier si c'est un doublon (version alternate)
          const existingIndex = allCards.findIndex(c => c.number === parsed.number)
          if (existingIndex === -1) {
            allCards.push(parsed)
          } else {
            // Si c'est une version alternate (version-2, etc.), l'ajouter avec un suffixe
            if (parsed.slug.includes('version-2')) {
              allCards.push({ ...parsed, number: `${parsed.number}_v2` })
            } else if (parsed.slug.includes('version-3')) {
              allCards.push({ ...parsed, number: `${parsed.number}_v3` })
            } else if (parsed.slug.includes('version-4')) {
              allCards.push({ ...parsed, number: `${parsed.number}_v4` })
            } else if (parsed.slug.includes('version-5')) {
              allCards.push({ ...parsed, number: `${parsed.number}_v5` })
            }
          }
        }
      }

      await delay(1500)
    }

  } catch (error) {
    logger.error(`Erreur scraping: ${error}`)
  } finally {
    await page.close()
  }

  logger.success(`Total: ${allCards.length} cartes scrapées`)
  return allCards
}

/**
 * Parse une URL de carte et extraire les informations
 */
function parseCardUrl(url: string, imageUrl: string): CardImage | null {
  try {
    const urlPath = new URL(url).pathname
    const slug = urlPath.replace('/cards/', '')

    // Pattern: op13-XXX-rarity-name
    // Exemple: op13-001-l-monkey-d-luffy
    const match = slug.match(/op13-(\d{3})-([a-z]+)-(.+)/)
    if (!match) return null

    const [, number, rarity, namePart] = match

    // Reconstruire le nom
    let name = namePart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // Nettoyer les prefixes de version
    name = name.replace(/^Version \d+ /, '')

    return {
      number,
      name,
      imageUrl,
      slug
    }
  } catch {
    return null
  }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================

/**
 * Récupère les cartes OP13 depuis la base de données
 */
async function getOP13CardsFromDB(): Promise<DatabaseCard[]> {
  // D'abord récupérer l'ID de la série OP13
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (seriesError || !series) {
    throw new Error(`Série ${SERIES_CODE} non trouvée`)
  }

  // Récupérer toutes les cartes FR de cette série
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, number, name, image_url, attributes')
    .eq('series_id', series.id)
    .eq('language', 'FR')
    .order('number')

  if (error) {
    throw new Error(`Erreur récupération cartes: ${error.message}`)
  }

  return cards || []
}

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Télécharge et optimise une image
 */
async function downloadAndOptimizeImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL
      }
    })

    if (!response.ok) {
      logger.warn(`Erreur téléchargement ${imageUrl}: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Optimiser avec Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 85 })
      .toBuffer()

    return optimized
  } catch (error) {
    logger.error(`Erreur téléchargement image: ${error}`)
    return null
  }
}

/**
 * Upload une image dans Supabase Storage
 */
async function uploadImage(buffer: Buffer, number: string): Promise<string | null> {
  try {
    const path = `${SERIES_CODE}/${LANGUAGE}/${number}.webp`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      logger.error(`Erreur upload ${path}: ${uploadError.message}`)
      return null
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path)

    return publicUrl
  } catch (error) {
    logger.error(`Erreur upload: ${error}`)
    return null
  }
}

/**
 * Met à jour l'URL de l'image dans la base de données
 */
async function updateCardImageUrl(cardId: string, imageUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId)

  if (error) {
    logger.error(`Erreur mise à jour carte ${cardId}: ${error.message}`)
    return false
  }

  return true
}

// ============================================
// COMPARISON LOGIC
// ============================================

/**
 * Compare les cartes et identifie celles qui doivent être corrigées
 * On va re-télécharger TOUTES les images pour être sûr qu'elles sont correctes
 */
function findCardsToFix(
  dbCards: DatabaseCard[],
  scrapedCards: CardImage[]
): { dbCard: DatabaseCard; correctImage: CardImage }[] {
  const toFix: { dbCard: DatabaseCard; correctImage: CardImage }[] = []

  // Créer un map des cartes scrapées par numéro (version standard uniquement)
  const scrapedByNumber = new Map<string, CardImage>()
  for (const card of scrapedCards) {
    // Ne garder que la version standard (sans _v2, _v3, etc.)
    if (!card.number.includes('_v')) {
      scrapedByNumber.set(card.number, card)
    }
  }

  logger.info(`Cartes scrapées (standard): ${scrapedByNumber.size}`)

  for (const dbCard of dbCards) {
    // Normaliser le numéro de la carte DB
    let dbNumber = dbCard.number

    // Gérer les différents formats: "1", "01", "001", "1_v2", etc.
    // Enlever les suffixes de version
    const hasVersionSuffix = dbNumber.includes('_v')
    const baseNumber = dbNumber.replace(/_v\d+$/, '')

    // Normaliser à 3 chiffres
    const paddedNumber = baseNumber.replace(/^0+/, '').padStart(3, '0')

    // Trouver la carte correspondante dans les données scrapées
    const scrapedCard = scrapedByNumber.get(paddedNumber)

    if (!scrapedCard) {
      logger.warn(`Carte ${dbCard.number} (${dbCard.name}) non trouvée dans le scraping`)
      continue
    }

    // Pour les versions alternatives, on ne met pas à jour (elles ont leurs propres images)
    if (hasVersionSuffix) {
      continue
    }

    // Toujours ajouter pour re-télécharger et s'assurer que l'image est correcte
    toFix.push({ dbCard, correctImage: scrapedCard })
  }

  return toFix
}

/**
 * Extrait le slug depuis une URL d'image
 */
function extractSlugFromImageUrl(url: string): string | null {
  try {
    // Pattern: .../opecards-SLUG.webp
    const match = url.match(/opecards-([^.]+)\.webp/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  logger.section('Correction des images OP13')
  console.log(`Mode: ${dryRun ? 'DRY RUN (analyse uniquement)' : 'CORRECTION'}`)

  try {
    // Étape 1: Récupérer les cartes depuis la base de données
    logger.info('\n1. Récupération des cartes depuis la base de données...')
    const dbCards = await getOP13CardsFromDB()
    logger.success(`${dbCards.length} cartes trouvées dans la base`)

    // Étape 2: Scraper les cartes depuis opecards.fr
    logger.info('\n2. Scraping des cartes depuis opecards.fr...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    let scrapedCards: CardImage[]
    try {
      scrapedCards = await scrapeOP13Cards(browser)
    } finally {
      await browser.close()
    }

    // Étape 3: Comparer et identifier les différences
    logger.info('\n3. Comparaison des images...')
    const toFix = findCardsToFix(dbCards, scrapedCards)

    if (toFix.length === 0) {
      logger.success('Toutes les images sont correctes!')
      return
    }

    logger.warn(`${toFix.length} images à corriger`)

    // Afficher les cartes à corriger
    console.log('\nCartes à corriger:')
    for (const { dbCard, correctImage } of toFix) {
      console.log(`  - ${dbCard.number} ${dbCard.name}`)
      console.log(`    Nouvelle image: ${correctImage.imageUrl}`)
    }

    if (dryRun) {
      logger.info('\nMode DRY RUN - aucune modification effectuée')
      return
    }

    // Étape 4: Corriger les images
    logger.info('\n4. Correction des images...')

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < toFix.length; i++) {
      const { dbCard, correctImage } = toFix[i]
      logger.progress(`[${i + 1}/${toFix.length}] ${dbCard.number} ${dbCard.name}`)

      // Télécharger et optimiser l'image
      const imageBuffer = await downloadAndOptimizeImage(correctImage.imageUrl)
      if (!imageBuffer) {
        errorCount++
        continue
      }

      // Upload dans Supabase Storage
      const newUrl = await uploadImage(imageBuffer, dbCard.number)
      if (!newUrl) {
        errorCount++
        continue
      }

      // Mettre à jour la base de données
      const updated = await updateCardImageUrl(dbCard.id, newUrl)

      // Mettre à jour aussi le slug dans les attributs
      const { error: attrError } = await supabase
        .from('cards')
        .update({
          attributes: {
            ...dbCard.attributes,
            slug: correctImage.slug
          }
        })
        .eq('id', dbCard.id)

      if (updated && !attrError) {
        logger.success(`Image corrigée pour ${dbCard.number}`)
        successCount++
      } else {
        errorCount++
      }

      await delay(DELAYS.betweenUploads)
    }

    // Résumé
    logger.section('Résumé')
    logger.success(`Corrigées: ${successCount}`)
    if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
    logger.info(`Total: ${toFix.length}`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution
main()
