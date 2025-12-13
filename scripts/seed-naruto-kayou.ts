/**
 * Script de scraping pour les cartes Naruto Kayou
 * Source: https://narutopia.fr/liste-des-cartes-naruto-kayou/
 *
 * Usage:
 *   npm run seed:naruto-kayou              # Toutes les raretés
 *   npm run seed:naruto-kayou -- --rarity SCR  # Une rareté spécifique
 *   npm run seed:naruto-kayou -- --dry-run     # Mode test (pas d'écriture)
 *
 * Ce script construit les URLs des images basé sur les patterns découverts
 * et télécharge toutes les cartes par rareté.
 */

import { createNarutoBucket, uploadNarutoCardImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import {
  NARUTO_KAYOU_RARITIES,
  NarutoKayouRarity,
  generateAllPossibleUrls,
  NARUTO_RARITY_DB_MAPPING,
  TOTAL_NARUTO_KAYOU_CARDS
} from './data/naruto-kayou-rarities'

// Configuration
const SERIES_CODE = 'KAYOU'  // Code unique pour la série Naruto Kayou
const LANGUAGE = 'ZH'        // Chinois (cartes Kayou sont chinoises)

// Initialize Supabase admin client
const supabase = createAdminClient()

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const rarityArg = args.find(arg => arg.startsWith('--rarity='))?.split('=')[1] ||
                  args[args.indexOf('--rarity') + 1]
const startArg = args.find(arg => arg.startsWith('--start='))?.split('=')[1]
const countArg = args.find(arg => arg.startsWith('--count='))?.split('=')[1]

interface CardToInsert {
  rarityCode: string
  number: number
  imageUrl: string
}

/**
 * Récupère l'UUID du TCG Naruto
 */
async function getNarutoGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'naruto')
    .single()

  if (error || !data) {
    throw new Error('TCG Naruto non trouvé dans la base de données')
  }

  return data.id
}

/**
 * Récupère ou crée la série Naruto Kayou
 */
async function getOrCreateSeries(gameId: string, totalCards: number): Promise<string> {
  // Vérifier si la série existe
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (existing) {
    logger.success(`Série ${SERIES_CODE} trouvée`)
    return existing.id
  }

  // Créer la série
  logger.info(`Création de la série ${SERIES_CODE}...`)
  const { data, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: gameId,
      name: 'Naruto Kayou',
      code: SERIES_CODE,
      max_set_base: totalCards,
      master_set: totalCards,
      image_url: null // À ajouter plus tard si besoin
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Impossible de créer la série ${SERIES_CODE}: ${error?.message}`)
  }

  logger.success(`Série ${SERIES_CODE} créée`)
  return data.id
}

/**
 * Teste si une URL d'image existe
 */
async function testImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Trouve l'URL valide pour une carte
 */
async function findValidImageUrl(rarityCode: string, cardNumber: number): Promise<string | null> {
  const urls = generateAllPossibleUrls(rarityCode, cardNumber)

  for (const url of urls) {
    if (await testImageUrl(url)) {
      return url
    }
    // Petit délai pour éviter le rate limiting
    await delay(50)
  }

  return null
}

/**
 * Scrape toutes les cartes d'une rareté
 */
async function scrapeRarity(rarity: NarutoKayouRarity): Promise<CardToInsert[]> {
  logger.section(`Scraping ${rarity.code} (${rarity.name}) - ${rarity.count} cartes`)

  const cards: CardToInsert[] = []
  let notFound = 0
  let consecutive404 = 0
  const MAX_CONSECUTIVE_404 = 10

  const startNum = startArg ? parseInt(startArg) : 1
  const endNum = countArg
    ? Math.min(startNum + parseInt(countArg) - 1, rarity.count)
    : rarity.count

  for (let num = startNum; num <= endNum; num++) {
    logger.progress(`[${num}/${endNum}] Recherche ${rarity.code}-${num}...`)

    const imageUrl = await findValidImageUrl(rarity.code, num)

    if (imageUrl) {
      cards.push({
        rarityCode: rarity.code,
        number: num,
        imageUrl
      })
      logger.success(`Trouvé: ${rarity.code}-${num}`)
      consecutive404 = 0
    } else {
      logger.warn(`Non trouvé: ${rarity.code}-${num}`)
      notFound++
      consecutive404++

      // Arrêter si trop de 404 consécutifs
      if (consecutive404 >= MAX_CONSECUTIVE_404) {
        logger.warn(`${MAX_CONSECUTIVE_404} erreurs consécutives, arrêt pour ${rarity.code}`)
        break
      }
    }

    // Rate limiting
    await delay(100)
  }

  logger.info(`\nRésultat ${rarity.code}: ${cards.length} trouvées, ${notFound} non trouvées`)
  return cards
}

/**
 * Insère les cartes dans la base de données
 */
async function insertCards(cards: CardToInsert[], seriesId: string) {
  logger.section(`Insertion de ${cards.length} cartes`)

  let success = 0
  let errors = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    try {
      logger.progress(`[${i + 1}/${cards.length}] ${card.rarityCode}-${card.number}`)

      // Upload de l'image
      const imageResult = await uploadNarutoCardImage(
        card.imageUrl,
        card.number.toString(),
        card.rarityCode
      )

      const finalImageUrl = imageResult.success ? imageResult.url! : card.imageUrl

      // Formater le numéro de carte (ex: "R-037" ou "SCR-001")
      const cardNumber = `${card.rarityCode}-${card.number.toString().padStart(3, '0')}`

      // Insertion dans la base de données
      // Nom = vide car les cartes Kayou n'ont pas de nom visible
      const { error } = await supabase
        .from('cards')
        .upsert({
          series_id: seriesId,
          name: cardNumber,  // Utiliser le numéro comme nom
          number: cardNumber,
          language: LANGUAGE,
          rarity: NARUTO_RARITY_DB_MAPPING[card.rarityCode] || card.rarityCode.toLowerCase(),
          image_url: finalImageUrl,
          attributes: {
            original_rarity_code: card.rarityCode,
            source: 'narutopia.fr',
            has_foil_variant: true  // Toujours afficher le bouton foil
          }
        }, {
          onConflict: 'series_id,number,language',
          ignoreDuplicates: false
        })

      if (error) {
        logger.error(`Erreur insertion ${cardNumber}: ${error.message}`)
        errors++
      } else {
        logger.success(`Carte ${cardNumber} insérée`)
        success++
      }

      // Rate limiting
      if (i < cards.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      logger.error(`Erreur carte ${card.rarityCode}-${card.number}: ${error}`)
      errors++
    }
  }

  logger.section('Résumé insertion')
  logger.success(`Succès: ${success}`)
  if (errors > 0) logger.error(`Erreurs: ${errors}`)
  logger.info(`Total: ${cards.length}`)
}

/**
 * Script principal
 */
async function main() {
  logger.section('Scraping Naruto Kayou')
  console.log('Source: https://narutopia.fr/liste-des-cartes-naruto-kayou/')
  console.log(`Total estimé: ${TOTAL_NARUTO_KAYOU_CARDS} cartes`)

  if (dryRun) {
    logger.warn('MODE DRY-RUN: Aucune écriture ne sera effectuée')
  }

  if (rarityArg) {
    logger.info(`Rareté ciblée: ${rarityArg}`)
  }

  try {
    // Étape 1: Créer le bucket
    logger.info('\n1. Vérification du bucket Supabase Storage...')
    if (!dryRun) {
      await createNarutoBucket()
    } else {
      logger.info('   [DRY-RUN] Bucket non créé')
    }

    // Étape 2: Vérifier que Naruto existe
    logger.info('\n2. Vérification du TCG Naruto...')
    const gameId = await getNarutoGameId()
    logger.success(`Naruto trouvé: ${gameId}`)

    // Étape 3: Créer/récupérer la série
    logger.info('\n3. Vérification de la série Kayou...')
    let seriesId: string
    if (!dryRun) {
      seriesId = await getOrCreateSeries(gameId, TOTAL_NARUTO_KAYOU_CARDS)
    } else {
      logger.info('   [DRY-RUN] Série non créée')
      seriesId = 'dry-run-series-id'
    }

    // Étape 4: Scraper les raretés
    logger.info('\n4. Scraping des raretés...')

    // Filtrer les raretés si une est spécifiée
    const raritiesToScrape = rarityArg
      ? NARUTO_KAYOU_RARITIES.filter(r => r.code.toUpperCase() === rarityArg.toUpperCase())
      : NARUTO_KAYOU_RARITIES

    if (raritiesToScrape.length === 0) {
      logger.error(`Rareté "${rarityArg}" non trouvée`)
      logger.info('Raretés disponibles: ' + NARUTO_KAYOU_RARITIES.map(r => r.code).join(', '))
      process.exit(1)
    }

    const allCards: CardToInsert[] = []

    for (const rarity of raritiesToScrape) {
      const cards = await scrapeRarity(rarity)
      allCards.push(...cards)

      // Pause entre les raretés
      await delay(DELAYS.betweenSeries)
    }

    if (allCards.length === 0) {
      logger.warn('Aucune carte trouvée.')
      process.exit(1)
    }

    logger.info(`\nTotal cartes trouvées: ${allCards.length}`)

    // Étape 5: Insérer les cartes
    if (!dryRun) {
      logger.info('\n5. Insertion des cartes...')
      await insertCards(allCards, seriesId)
    } else {
      logger.info('\n5. [DRY-RUN] Cartes qui seraient insérées:')
      allCards.slice(0, 10).forEach(c => {
        logger.info(`   - ${c.rarityCode}-${c.number}: ${c.imageUrl}`)
      })
      if (allCards.length > 10) {
        logger.info(`   ... et ${allCards.length - 10} autres`)
      }
    }

    logger.section('Scraping terminé avec succès!')
    console.log('\nConsultez vos cartes: http://localhost:3000/series/naruto')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution
main()
