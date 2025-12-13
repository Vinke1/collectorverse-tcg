/**
 * Script pour ajouter les cartes SR-109 à SR-148 manquantes de Naruto Kayou
 *
 * Sources:
 * - SR-109 à SR-128: https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-SR-{num}.webp
 * - SR-129 à SR-148: https://narutopia.fr/wp-content/uploads/2024/11/NRB07-SR-{num}L2.webp
 *
 * Usage:
 *   npx tsx scripts/seed-naruto-sr-missing.ts              # Exécuter
 *   npx tsx scripts/seed-naruto-sr-missing.ts --dry-run    # Mode test
 */

import { createNarutoBucket, uploadNarutoCardImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'
import { NARUTO_RARITY_DB_MAPPING } from './data/naruto-kayou-rarities'

// Configuration
const SERIES_CODE = 'KAYOU'
const LANGUAGE = 'ZH'
const RARITY_CODE = 'SR'

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Initialize Supabase
const supabase = createAdminClient()

interface CardToAdd {
  number: number
  sourceUrl: string
  targetNumber: string
}

/**
 * Génère la liste des cartes à ajouter
 */
function generateCardList(): CardToAdd[] {
  const cards: CardToAdd[] = []

  // SR-109 à SR-128 (NRZ06)
  for (let num = 109; num <= 128; num++) {
    cards.push({
      number: num,
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-SR-${num}.webp`,
      targetNumber: `SR-${num.toString().padStart(3, '0')}`
    })
  }

  // SR-129 à SR-148 (NRB07 avec suffixe L2)
  for (let num = 129; num <= 148; num++) {
    cards.push({
      number: num,
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/11/NRB07-SR-${num}L2.webp`,
      targetNumber: `SR-${num.toString().padStart(3, '0')}`
    })
  }

  return cards
}

/**
 * Récupère l'ID de la série KAYOU
 */
async function getSeriesId(): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (error || !data) {
    throw new Error(`Série ${SERIES_CODE} non trouvée: ${error?.message}`)
  }

  return data.id
}

/**
 * Vérifie si une carte existe déjà
 */
async function cardExists(seriesId: string, cardNumber: string): Promise<boolean> {
  const { data } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', cardNumber)
    .eq('language', LANGUAGE)
    .single()

  return !!data
}

/**
 * Teste si une URL est accessible
 */
async function testUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Script principal
 */
async function main() {
  logger.section('Ajout des cartes SR-109 à SR-148 Naruto Kayou')

  if (dryRun) {
    logger.warn('MODE DRY-RUN: Aucune écriture ne sera effectuée')
  }

  try {
    // Vérifier/créer le bucket
    if (!dryRun) {
      await createNarutoBucket()
    }

    // Récupérer l'ID de la série
    const seriesId = await getSeriesId()
    logger.success(`Série ${SERIES_CODE} trouvée: ${seriesId}`)

    // Générer la liste des cartes
    const cards = generateCardList()
    logger.info(`${cards.length} cartes à traiter (SR-109 à SR-148)`)

    let added = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      logger.progress(`[${i + 1}/${cards.length}] Traitement ${card.targetNumber}...`)

      // Vérifier si la carte existe déjà
      if (!dryRun) {
        const exists = await cardExists(seriesId, card.targetNumber)
        if (exists) {
          logger.info(`  ⏭️  ${card.targetNumber} existe déjà, skip`)
          skipped++
          continue
        }
      }

      // Vérifier que l'URL source est accessible
      const urlValid = await testUrl(card.sourceUrl)
      if (!urlValid) {
        logger.error(`  ❌ URL inaccessible: ${card.sourceUrl}`)
        errors++
        continue
      }

      if (dryRun) {
        logger.info(`  [DRY-RUN] ${card.targetNumber} serait ajoutée depuis ${card.sourceUrl}`)
        added++
        continue
      }

      // Upload de l'image
      const uploadResult = await uploadNarutoCardImage(
        card.sourceUrl,
        card.number.toString(),
        RARITY_CODE
      )

      const finalImageUrl = uploadResult.success ? uploadResult.url! : card.sourceUrl

      // Insertion en base
      const { error } = await supabase
        .from('cards')
        .upsert({
          series_id: seriesId,
          name: card.targetNumber,
          number: card.targetNumber,
          language: LANGUAGE,
          rarity: NARUTO_RARITY_DB_MAPPING[RARITY_CODE] || 'super-rare',
          image_url: finalImageUrl,
          attributes: {
            original_rarity_code: RARITY_CODE,
            source: 'narutopia.fr',
            has_foil_variant: true
          }
        }, {
          onConflict: 'series_id,number,language',
          ignoreDuplicates: false
        })

      if (error) {
        logger.error(`  ❌ Erreur insertion ${card.targetNumber}: ${error.message}`)
        errors++
      } else {
        logger.success(`  ✅ ${card.targetNumber} ajoutée`)
        added++
      }

      // Rate limiting
      await delay(DELAYS.betweenUploads)
    }

    // Résumé
    logger.section('Résumé')
    logger.success(`Ajoutées: ${added}`)
    logger.info(`Ignorées (déjà existantes): ${skipped}`)
    if (errors > 0) {
      logger.error(`Erreurs: ${errors}`)
    }
    logger.info(`Total traité: ${cards.length}`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
