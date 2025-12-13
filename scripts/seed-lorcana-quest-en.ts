/**
 * Script pour ajouter les cartes anglaises des Illumineer's Quest de Disney Lorcana
 * Source: Dreamborn CDN (https://cdn.dreamborn.ink)
 *
 * Ce script:
 * 1. Télécharge les images depuis le CDN Dreamborn (format Q1-{number} pour Deep Trouble)
 * 2. Les optimise et les upload sur Supabase Storage
 * 3. Insère les cartes dans la base de données avec les noms anglais
 *
 * Storage: Quest/EN/EN-{number}.webp
 *
 * Usage: npx tsx scripts/seed-lorcana-quest-en.ts
 */

import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS, CARD_DIMENSIONS } from '../lib/constants/app-config'
import sharp from 'sharp'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Base URL for storage
const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/lorcana-cards'

// Dreamborn CDN base URL
const DREAMBORN_CDN = 'https://cdn.dreamborn.ink/images/en/cards'

// Configuration
const SERIES_CODE = 'QuestDeep'

interface QuestCard {
  number: string        // Format: "1", "2", etc. (pour le deck) ou "223", "224", "225" (pour les exclusives)
  name: string          // Nom anglais
  dreamborn_code: string // Code Dreamborn: Q1-001, Q1-002, etc.
}

// Cartes du deck Ursula (Deep Trouble) - format Q1-{number}
const DEEP_TROUBLE_DECK_CARDS: QuestCard[] = [
  { number: '1', name: 'Anna - Ensnared Sister', dreamborn_code: 'Q1-001' },
  { number: '2', name: 'Bruno Madrigal - Unspeakable Seer', dreamborn_code: 'Q1-002' },
  { number: '3', name: 'Captain Hook - Devious Duelist', dreamborn_code: 'Q1-003' },
  { number: '4', name: 'Flotsam - Wicked Defender', dreamborn_code: 'Q1-004' },
  { number: '5', name: 'Gaston - Egotistical Bully', dreamborn_code: 'Q1-005' },
  { number: '6', name: 'HeiHei - Peckish Pal', dreamborn_code: 'Q1-006' },
  { number: '7', name: 'Hercules - Manipulated Hero', dreamborn_code: 'Q1-007' },
  { number: '8', name: 'Jafar - Double-Crossing Vizier', dreamborn_code: 'Q1-008' },
  { number: '9', name: 'Jetsam - Wicked Whisperer', dreamborn_code: 'Q1-009' },
  { number: '10', name: 'Mad Hatter - Sinister Host', dreamborn_code: 'Q1-010' },
  { number: '11', name: 'Magica De Spell - Shadowy Sorceress', dreamborn_code: 'Q1-011' },
  { number: '12', name: 'Minnie Mouse - Wild-Eyed Diver', dreamborn_code: 'Q1-012' },
  { number: '13', name: 'Prince Eric - Grim Groom', dreamborn_code: 'Q1-013' },
  { number: '14', name: 'Shark - Toothy Terror', dreamborn_code: 'Q1-014' },
  { number: '15', name: 'Tamatoa - Grabby Crab', dreamborn_code: 'Q1-015' },
  { number: '16', name: "Triton's Daughters - Discordant Chorus", dreamborn_code: 'Q1-016' },
  { number: '17', name: 'Capsize', dreamborn_code: 'Q1-017' },
  { number: '18', name: 'Choppy Waters', dreamborn_code: 'Q1-018' },
  { number: '19', name: 'Crushing Wave', dreamborn_code: 'Q1-019' },
  { number: '20', name: 'Entangling Magic', dreamborn_code: 'Q1-020' },
  { number: '21', name: 'Fortunate Hit', dreamborn_code: 'Q1-021' },
  { number: '22', name: 'Lash Out', dreamborn_code: 'Q1-022' },
  { number: '23', name: 'Lightning Storm', dreamborn_code: 'Q1-023' },
  { number: '24', name: 'Riptide', dreamborn_code: 'Q1-024' },
  { number: '25', name: 'Tentacle Swipe', dreamborn_code: 'Q1-025' },
  { number: '26', name: 'Tsunami', dreamborn_code: 'Q1-026' },
  { number: '27', name: 'Typhoon', dreamborn_code: 'Q1-027' },
  { number: '28', name: 'Whirlpool', dreamborn_code: 'Q1-028' },
  { number: '29', name: 'The Hexwell Crown', dreamborn_code: 'Q1-029' },
  { number: '30', name: "Ursula's Contract", dreamborn_code: 'Q1-030' },
  { number: '31', name: "Ursula's Stolen Trident", dreamborn_code: 'Q1-031' },
]

// Cartes exclusives (Unique Frame) - ces cartes ont un format différent sur Dreamborn
// 223, 224, 225 correspondent aux cartes exclusives du coffret
const DEEP_TROUBLE_EXCLUSIVE_CARDS: QuestCard[] = [
  { number: '223', name: 'Yen Sid - Powerful Sorcerer', dreamborn_code: 'Q1-223' },
  { number: '224', name: 'Mulan - Elite Archer', dreamborn_code: 'Q1-224' },
  { number: '225', name: 'Mickey Mouse - Playful Sorcerer', dreamborn_code: 'Q1-225' },
]

/**
 * Télécharge une image depuis le CDN Dreamborn
 */
async function downloadDreambornImage(dreamborn_code: string): Promise<Buffer | null> {
  const imageUrl = `${DREAMBORN_CDN}/${dreamborn_code}`
  logger.download(`Téléchargement: ${imageUrl}`)

  try {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      logger.warn(`Image non trouvée: ${dreamborn_code} (HTTP ${response.status})`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    logger.error(`Erreur téléchargement ${dreamborn_code}: ${error}`)
    return null
  }
}

/**
 * Upload une image de carte Quest EN avec la bonne nomenclature
 * Format: Quest/EN/EN-{number}.webp
 */
async function uploadQuestCardImage(
  imageBuffer: Buffer,
  cardNumber: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Optimiser avec Sharp
    logger.processing(`Optimisation de l'image ${cardNumber}...`)
    const optimizedImage = await sharp(imageBuffer)
      .resize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: CARD_DIMENSIONS.quality })
      .toBuffer()

    // Générer le chemin: Quest/EN/EN-{number}.webp
    const fileName = `Quest/EN/EN-${cardNumber}.webp`

    logger.upload(`Upload vers ${fileName}...`)

    // Upload sur Supabase Storage
    const { error } = await supabase.storage
      .from('lorcana-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error: error.message }
    }

    const publicUrl = `${STORAGE_BASE_URL}/${fileName}`
    return { success: true, url: publicUrl }

  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Récupère l'ID de la série Deep Trouble
 */
async function getSeriesId(): Promise<string> {
  logger.processing('Recherche de la série QuestDeep...')

  const { data: series, error } = await supabase
    .from('series')
    .select('*')
    .eq('code', SERIES_CODE)
    .single()

  if (error || !series) {
    throw new Error(`Série QuestDeep non trouvée dans la base de données`)
  }

  logger.success(`Série trouvée: ${series.name} (${series.id})`)
  return series.id
}

/**
 * Insère les cartes Quest EN dans la base de données
 */
async function insertQuestCards(seriesId: string, cards: QuestCard[]) {
  logger.section(`Insertion de ${cards.length} cartes Quest EN`)

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    try {
      logger.separator()
      logger.info(`[${i + 1}/${cards.length}] ${card.number} - ${card.name}`)
      logger.info(`   Dreamborn: ${card.dreamborn_code}`)

      // Télécharger l'image depuis Dreamborn
      const imageBuffer = await downloadDreambornImage(card.dreamborn_code)

      if (!imageBuffer || imageBuffer.length < 1000) {
        logger.warn('Image non disponible, carte ignorée')
        skippedCount++
        continue
      }

      // Upload de l'image sur Supabase Storage
      const imageResult = await uploadQuestCardImage(imageBuffer, card.number)

      let finalImageUrl = ''
      if (imageResult.success && imageResult.url) {
        finalImageUrl = imageResult.url
        logger.success(`Image uploadée: ${imageResult.url}`)
      } else {
        logger.warn(`Échec upload: ${imageResult.error}`)
        skippedCount++
        continue
      }

      // Vérifier si la carte existe déjà
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('series_id', seriesId)
        .eq('number', card.number)
        .eq('language', 'EN')
        .maybeSingle()

      // Insertion ou mise à jour dans la base de données
      logger.processing('Insertion dans la base de données...')

      const cardData = {
        series_id: seriesId,
        name: card.name,
        number: card.number,
        language: 'EN',
        chapter: null,
        rarity: 'quest',
        image_url: finalImageUrl,
        attributes: {
          dreamborn_code: card.dreamborn_code,
          source: 'dreamborn.ink',
          questType: 'Deep Trouble'
        }
      }

      let error
      if (existingCard) {
        logger.info('Carte existante, mise à jour...')
        const result = await supabase
          .from('cards')
          .update(cardData)
          .eq('id', existingCard.id)
        error = result.error
      } else {
        const result = await supabase
          .from('cards')
          .insert(cardData)
        error = result.error
      }

      if (error) {
        logger.error(`Erreur insertion: ${error.message}`)
        errorCount++
      } else {
        logger.success('Carte insérée avec succès!')
        successCount++
      }

      // Rate limiting
      if (i < cards.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      logger.error(`Erreur: ${error}`)
      errorCount++
    }
  }

  logger.separator()
  logger.section('Résumé de l\'insertion')
  logger.success(`Succès: ${successCount}`)
  logger.error(`Erreurs: ${errorCount}`)
  logger.warn(`Ignorées: ${skippedCount}`)
  logger.progress(`Total: ${cards.length}`)
}

/**
 * Script principal
 */
async function main() {
  logger.section('Ajout des cartes Quest EN - Disney Lorcana')
  logger.info('Source: cdn.dreamborn.ink')
  logger.info('Langue: EN (Anglais)')
  logger.info('Storage: Quest/EN/EN-{number}.webp')

  try {
    // Étape 1: Récupérer la série
    const seriesId = await getSeriesId()

    // Combiner les cartes du deck et les exclusives
    const allCards = [...DEEP_TROUBLE_DECK_CARDS, ...DEEP_TROUBLE_EXCLUSIVE_CARDS]

    // Afficher les cartes à traiter
    console.log('\n📋 Cartes à traiter:')
    allCards.forEach((card, i) => {
      console.log(`   ${i + 1}. ${card.number} - ${card.name}`)
    })

    // Étape 2: Insérer les cartes
    await insertQuestCards(seriesId, allCards)

    logger.separator()
    logger.success('Script terminé avec succès!')
    logger.web(`Consultez vos cartes: http://localhost:3000/series/lorcana/${SERIES_CODE}`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
  }
}

// Exécution du script
main()
