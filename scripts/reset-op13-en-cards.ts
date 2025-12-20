/**
 * Script pour nettoyer et re-télécharger toutes les cartes OP13 EN
 *
 * 1. Supprime toutes les cartes OP13 EN de la DB
 * 2. Supprime toutes les images OP13/en/ du storage
 * 3. Scrape toutes les pages d'opecards.fr EN
 * 4. Ajoute toutes les cartes proprement
 *
 * Usage:
 *   npx tsx scripts/reset-op13-en-cards.ts --dry-run    # Analyse uniquement
 *   npx tsx scripts/reset-op13-en-cards.ts              # Exécute le reset complet
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
const SEARCH_URL = 'https://www.opecards.fr/cards/search?page={PAGE}&sortBy=number&serie=751&language=EN'
const TOTAL_PAGES = 6
const SERIES_CODE = 'OP13'
const LANGUAGE = 'EN'

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
    .eq('code', SERIES_CODE)
    .single()

  if (error || !data) {
    throw new Error(`Série ${SERIES_CODE} non trouvée dans la base de données`)
  }

  return data.id
}

/**
 * Supprime toutes les cartes OP13 EN de la base de données
 */
async function deleteAllCards(seriesId: string): Promise<number> {
  const { data, error } = await supabase
    .from('cards')
    .delete()
    .eq('series_id', seriesId)
    .eq('language', LANGUAGE)
    .select('id')

  if (error) {
    throw new Error(`Erreur suppression cartes: ${error.message}`)
  }

  return data?.length || 0
}

/**
 * Supprime toutes les images OP13/en/ du storage
 */
async function deleteAllImages(): Promise<number> {
  const bucketName = 'onepiece-cards'
  const folderPath = `${SERIES_CODE}/en`

  // Lister tous les fichiers dans le dossier
  const { data: files, error: listError } = await supabase
    .storage
    .from(bucketName)
    .list(folderPath)

  if (listError) {
    logger.warn(`Erreur listage images: ${listError.message}`)
    return 0
  }

  if (!files || files.length === 0) {
    logger.info('Aucune image à supprimer')
    return 0
  }

  // Supprimer les fichiers
  const filePaths = files.map(f => `${folderPath}/${f.name}`)
  const { error: deleteError } = await supabase
    .storage
    .from(bucketName)
    .remove(filePaths)

  if (deleteError) {
    logger.warn(`Erreur suppression images: ${deleteError.message}`)
    return 0
  }

  return files.length
}

/**
 * Parse une URL de carte EN et extrait les informations
 */
function parseCardUrl(url: string): ScrapedCard | null {
  // Enlever le préfixe /cards/
  const slug = url.replace('/cards/', '')

  // Pattern EN: en-op13-{number}-{rarity}[-version-{n}]-{name}
  // Exemples:
  //   en-op13-001-l-monkeydluffy
  //   en-op13-001-l-version-2-monkeydluffy
  //   en-op13-118-sec-version-5-monkeydluffy
  const versionMatch = slug.match(/^en-op13-(\d{3})-([a-z]+)-version-(\d+)-(.+)$/i)
  const normalMatch = slug.match(/^en-op13-(\d{3})-([a-z]+)-(.+)$/i)

  if (versionMatch) {
    const [, number, rarity, version, namePart] = versionMatch
    const name = formatCardName(namePart)
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
      imageUrl: `https://static.opecards.fr/cards/en/op13/image-trading-cards-one-piece-card-game-tcg-opecards-${slug}.webp`,
      isVersion: true,
      versionNumber: versionNum
    }
  }

  if (normalMatch) {
    const [, number, rarity, namePart] = normalMatch
    const name = formatCardName(namePart)

    return {
      url,
      slug,
      number,
      rarity: rarity.toUpperCase(),
      name,
      imageUrl: `https://static.opecards.fr/cards/en/op13/image-trading-cards-one-piece-card-game-tcg-opecards-${slug}.webp`,
      isVersion: false,
      versionNumber: null
    }
  }

  return null
}

/**
 * Formate proprement le nom de la carte
 */
function formatCardName(namePart: string): string {
  // Traiter les cas spéciaux
  const specialNames: Record<string, string> = {
    'monkeydluffy': 'Monkey D. Luffy',
    'portgasdace': 'Portgas D. Ace',
    'goldroger': 'Gol D. Roger',
    'trafalgarlaw': 'Trafalgar Law',
    'aborouge': 'Portgas D. Rouge',
    'monkeyddragon': 'Monkey D. Dragon',
    'monkeydgarp': 'Monkey D. Garp',
    'acesaboandluffy': 'Ace, Sabo & Luffy',
    'fivcelders': 'Five Elders',
    'saintethanbaron-v-nusjuro': 'Saint Ethanbaron V. Nusjuro',
    'saintjaygarciasaturn': 'Saint Jaygarcia Saturn',
    'saintshepherd-ju-peter': 'Saint Shepherd Ju Peter',
    'sainttopmanwarcury': 'Saint Topman Warcury',
    'saintmarcusmars': 'Saint Marcus Mars',
    'jewelrybonney': 'Jewelry Bonney',
    'edwardnewgate': 'Edward Newgate',
    'boahancock': 'Boa Hancock',
    'silversrayleigh': 'Silvers Rayleigh',
    'nefertarivivi': 'Nefertari Vivi',
    'nefertaricobra': 'Nefertari Cobra',
    'curlydadan': 'Curly Dadan',
    'emporioisvankov': 'Emporio Ivankov',
    's-snake': 'S-Snake'
  }

  const lowerName = namePart.toLowerCase().replace(/-/g, '')

  // Vérifier les noms spéciaux
  for (const [key, value] of Object.entries(specialNames)) {
    if (lowerName === key.replace(/-/g, '')) {
      return value
    }
  }

  // Sinon, formater normalement
  return namePart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
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

  // Extraire les URLs de cartes OP13 EN
  const cardUrls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/cards/en-op13-"]'))
    return links.map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
      .filter(href => href.startsWith('/cards/en-op13-'))
  })

  const uniqueUrls = [...new Set(cardUrls)]
  logger.info(`    ${uniqueUrls.length} cartes OP13 EN trouvées`)

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

  // Trier par numéro
  cards.sort((a, b) => {
    const numA = parseInt(a.number.split('-')[0])
    const numB = parseInt(b.number.split('-')[0])
    if (numA !== numB) return numA - numB
    return a.number.localeCompare(b.number)
  })

  return cards
}

/**
 * Ajoute une carte
 */
async function addCard(
  seriesId: string,
  card: ScrapedCard
): Promise<boolean> {
  try {
    // Upload de l'image
    const imageResult = await uploadOnePieceCardImage(
      card.imageUrl,
      card.number,
      SERIES_CODE,
      'en'
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
      .insert({
        series_id: seriesId,
        name: card.name,
        number: card.number,
        language: LANGUAGE,
        rarity: card.rarity,
        image_url: finalImageUrl,
        attributes
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
  logger.section(`Reset complet OP13 ${LANGUAGE}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (analyse uniquement)' : 'PRODUCTION'}`)

  try {
    // Étape 1: Récupérer l'ID de la série OP13
    logger.info('\n1. Récupération de la série OP13...')
    const seriesId = await getOP13SeriesId()
    logger.success(`Série OP13 trouvée: ${seriesId}`)

    // Étape 2: Compter les cartes existantes
    logger.info('\n2. Analyse des cartes existantes...')
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .eq('series_id', seriesId)
      .eq('language', LANGUAGE)

    logger.info(`  ${existingCards?.length || 0} cartes EN existantes`)

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

    // Afficher un aperçu
    logger.info('\nAperçu des cartes:')
    scrapedCards.slice(0, 5).forEach(c => {
      console.log(`  ${c.number} - ${c.name} [${c.rarity}]`)
    })
    console.log('  ...')
    scrapedCards.slice(-5).forEach(c => {
      console.log(`  ${c.number} - ${c.name} [${c.rarity}]`)
    })

    if (dryRun) {
      logger.info('\n--- MODE DRY RUN ---')
      logger.info(`Cartes à supprimer: ${existingCards?.length || 0}`)
      logger.info(`Cartes à ajouter: ${scrapedCards.length}`)
      logger.success('Relancez sans --dry-run pour exécuter.')
      return
    }

    // Étape 4: Supprimer les cartes existantes
    logger.info('\n4. Suppression des cartes existantes...')
    const deletedCount = await deleteAllCards(seriesId)
    logger.success(`${deletedCount} cartes supprimées`)

    // Étape 5: Supprimer les images existantes
    logger.info('\n5. Suppression des images existantes...')
    const deletedImages = await deleteAllImages()
    logger.success(`${deletedImages} images supprimées`)

    // Étape 6: Ajouter toutes les nouvelles cartes
    logger.info('\n6. Ajout des nouvelles cartes...')
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < scrapedCards.length; i++) {
      const card = scrapedCards[i]
      logger.progress(`[${i + 1}/${scrapedCards.length}] ${card.number} - ${card.name}`)

      const success = await addCard(seriesId, card)
      if (success) {
        successCount++
      } else {
        errorCount++
      }

      await delay(300)
    }

    // Résumé
    logger.section('Résumé')
    logger.success(`Succès: ${successCount}`)
    if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
    logger.info(`Total: ${scrapedCards.length}`)

    console.log('\nConsultez vos cartes: https://www.collectorverse.io/series/onepiece/OP13')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
