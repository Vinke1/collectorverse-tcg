/**
 * Script pour ajouter les cartes manquantes dans OP13
 * Scrape les 6 pages d'opecards.fr et ajoute les cartes non présentes dans la DB
 *
 * Usage:
 *   npx tsx scripts/add-missing-op13-cards.ts --dry-run    # Analyse uniquement
 *   npx tsx scripts/add-missing-op13-cards.ts              # Ajoute les cartes manquantes
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'
import { logger } from './lib/logger'
import { delay, slugToTitle } from './lib/utils'

const supabase = createAdminClient()

// Arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Configuration
const SEARCH_URL = 'https://www.opecards.fr/cards/search?page={PAGE}&sortBy=number&serie=750&language=FR'
const TOTAL_PAGES = 6

interface ScrapedCard {
  url: string
  slug: string
  number: string
  rarity: string
  name: string
  imageUrl: string
  isVersion: boolean
  versionNumber: number | null
}

/**
 * Récupère l'ID de la série OP13
 */
async function getOP13SeriesId(): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP13')
    .single()

  if (error || !data) {
    throw new Error('Série OP13 non trouvée dans la base de données')
  }

  return data.id
}

/**
 * Récupère tous les numéros de cartes existants pour OP13
 */
async function getExistingCardNumbers(seriesId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('cards')
    .select('number')
    .eq('series_id', seriesId)
    .eq('language', 'FR')

  if (error) {
    throw new Error(`Erreur récupération cartes: ${error.message}`)
  }

  return new Set(data?.map(c => c.number) || [])
}

/**
 * Parse une URL de carte et extrait les informations
 */
function parseCardUrl(url: string): ScrapedCard | null {
  // Enlever le préfixe /cards/
  const slug = url.replace('/cards/', '')

  // Pattern: op13-{number}-{rarity}[-version-{n}]-{name}
  // Exemples:
  //   op13-001-l-monkey-d-luffy
  //   op13-001-l-version-2-monkey-d-luffy
  //   op13-118-sec-version-5-monkey-d-luffy
  const versionMatch = slug.match(/^op13-(\d{3})-([a-z]+)-version-(\d+)-(.+)$/i)
  const normalMatch = slug.match(/^op13-(\d{3})-([a-z]+)-(.+)$/i)

  if (versionMatch) {
    const [, number, rarity, version, namePart] = versionMatch
    const name = slugToTitle(namePart)
    const versionNum = parseInt(version)

    // Construire le numéro de stockage:
    // Version 2 = -ALT (convention existante)
    // Version 3+ = -V3, -V4, -V5
    let storageNumber: string
    if (versionNum === 2) {
      storageNumber = `${number}-ALT`
    } else {
      storageNumber = `${number}-V${versionNum}`
    }

    return {
      url,
      slug,
      number: storageNumber,
      rarity: rarity.toUpperCase(),
      name,
      imageUrl: `https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-${slug}.webp`,
      isVersion: true,
      versionNumber: versionNum
    }
  }

  if (normalMatch) {
    const [, number, rarity, namePart] = normalMatch
    const name = slugToTitle(namePart)

    return {
      url,
      slug,
      number,
      rarity: rarity.toUpperCase(),
      name,
      imageUrl: `https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-${slug}.webp`,
      isVersion: false,
      versionNumber: null
    }
  }

  return null
}

/**
 * Scrape une page de résultats
 */
async function scrapePage(page: Page, pageNum: number): Promise<string[]> {
  const url = SEARCH_URL.replace('{PAGE}', pageNum.toString())
  logger.info(`  Page ${pageNum}: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  await delay(2000)

  // Scroll pour charger tout le contenu
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
  await delay(500)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await delay(1000)

  // Extraire les URLs de cartes OP13
  const cardUrls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/cards/op13-"]'))
    return links.map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
      .filter(href => href.startsWith('/cards/op13-'))
  })

  const uniqueUrls = [...new Set(cardUrls)]
  logger.info(`    ${uniqueUrls.length} cartes OP13 trouvées`)

  return uniqueUrls
}

/**
 * Scrape toutes les pages
 */
async function scrapeAllPages(browser: Browser): Promise<ScrapedCard[]> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
  await page.setViewport({ width: 1920, height: 1080 })

  const allUrls: string[] = []

  try {
    for (let i = 1; i <= TOTAL_PAGES; i++) {
      const pageUrls = await scrapePage(page, i)
      allUrls.push(...pageUrls)
      await delay(1500)
    }
  } finally {
    await page.close()
  }

  // Dédupliquer et parser
  const uniqueUrls = [...new Set(allUrls)]
  logger.success(`Total URLs uniques: ${uniqueUrls.length}`)

  const cards: ScrapedCard[] = []
  for (const url of uniqueUrls) {
    const parsed = parseCardUrl(url)
    if (parsed) {
      cards.push(parsed)
    } else {
      logger.warn(`URL non parsée: ${url}`)
    }
  }

  return cards
}

/**
 * Ajoute une carte manquante
 */
async function addMissingCard(
  seriesId: string,
  card: ScrapedCard
): Promise<boolean> {
  try {
    // Upload de l'image
    const imageResult = await uploadOnePieceCardImage(
      card.imageUrl,
      card.number,
      'OP13',
      'fr'
    )

    const finalImageUrl = imageResult.success && imageResult.url
      ? imageResult.url
      : card.imageUrl

    // Préparer les attributs
    const attributes: Record<string, unknown> = {
      slug: card.slug,
      card_type: card.rarity === 'L' ? 'leader' : 'character',
      is_foil: card.isVersion,
      finish: card.isVersion ? 'alternate' : 'standard',
      alternate_art: card.isVersion
    }

    if (card.versionNumber) {
      attributes.version = card.versionNumber
    }

    // Insertion dans la base de données
    const { error } = await supabase
      .from('cards')
      .upsert({
        series_id: seriesId,
        name: card.name,
        number: card.number,
        language: 'FR',
        rarity: card.rarity,
        image_url: finalImageUrl,
        attributes
      }, {
        onConflict: 'series_id,number,language',
        ignoreDuplicates: false
      })

    if (error) {
      logger.error(`Erreur insertion ${card.name}: ${error.message}`)
      return false
    }

    return true
  } catch (err) {
    logger.error(`Erreur ajout ${card.name}: ${err}`)
    return false
  }
}

async function main() {
  logger.section('Ajout des cartes manquantes OP13')
  console.log(`Mode: ${dryRun ? 'DRY RUN (analyse uniquement)' : 'PRODUCTION'}`)

  try {
    // Étape 1: Récupérer l'ID de la série OP13
    logger.info('\n1. Récupération de la série OP13...')
    const seriesId = await getOP13SeriesId()
    logger.success(`Série OP13 trouvée: ${seriesId}`)

    // Étape 2: Récupérer les cartes existantes
    logger.info('\n2. Récupération des cartes existantes...')
    const existingNumbers = await getExistingCardNumbers(seriesId)
    logger.success(`${existingNumbers.size} cartes existantes dans la DB`)

    // Afficher quelques exemples
    const examples = Array.from(existingNumbers).slice(0, 10)
    logger.info(`  Exemples: ${examples.join(', ')}`)

    // Étape 3: Scraper opecards.fr
    logger.info('\n3. Scraping d\'opecards.fr...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    let scrapedCards: ScrapedCard[]
    try {
      scrapedCards = await scrapeAllPages(browser)
    } finally {
      await browser.close()
    }

    logger.success(`${scrapedCards.length} cartes scrapées au total`)

    // Étape 4: Identifier les cartes manquantes
    logger.info('\n4. Identification des cartes manquantes...')
    const missingCards = scrapedCards.filter(card => !existingNumbers.has(card.number))

    logger.success(`${missingCards.length} cartes manquantes identifiées`)

    if (missingCards.length === 0) {
      logger.success('\nToutes les cartes sont déjà présentes!')
      return
    }

    // Afficher les cartes manquantes
    logger.info('\nCartes manquantes:')
    missingCards.forEach((card, i) => {
      const versionInfo = card.isVersion ? ` (Version ${card.versionNumber})` : ''
      console.log(`  ${i + 1}. ${card.number} - ${card.name}${versionInfo} [${card.rarity}]`)
    })

    if (dryRun) {
      logger.info('\n--- MODE DRY RUN ---')
      logger.success('Relancez sans --dry-run pour ajouter les cartes.')
      return
    }

    // Étape 5: Ajouter les cartes manquantes
    logger.info('\n5. Ajout des cartes manquantes...')
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < missingCards.length; i++) {
      const card = missingCards[i]
      logger.progress(`[${i + 1}/${missingCards.length}] ${card.name}`)

      const success = await addMissingCard(seriesId, card)
      if (success) {
        logger.success(`  ${card.name} ajouté`)
        successCount++
      } else {
        errorCount++
      }

      await delay(500)
    }

    // Résumé
    logger.section('Résumé')
    logger.success(`Succès: ${successCount}`)
    if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
    logger.info(`Total traité: ${missingCards.length}`)

    console.log('\nConsultez vos cartes: https://www.collectorverse.io/series/onepiece/OP13')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
