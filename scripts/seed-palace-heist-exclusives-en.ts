/**
 * Script pour ajouter les cartes exclusives anglaises du coffret Palace Heist
 * Source: Dreamborn CDN (format 008-223, 008-224 pour les exclusives du chapitre 8)
 *
 * Cartes exclusives Palace Heist:
 * - 223: Goofy - Groundbreaking Chef (exclusif)
 * - 224: Pinocchio - Strings Attached (exclusif)
 *
 * Note: Les cartes du deck Jafar (Q2-001 à Q2-035) ne sont pas encore sur Dreamborn
 *
 * Storage: QuestPalace/EN/EN-{number}.webp
 */

import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS, CARD_DIMENSIONS } from '../lib/constants/app-config'
import sharp from 'sharp'

const supabase = createAdminClient()
const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/lorcana-cards'
const DREAMBORN_CDN = 'https://cdn.dreamborn.ink/images/en/cards'

const SERIES_CODE = 'QuestPalace'

interface ExclusiveCard {
  number: string
  name: string
  dreamborn_code: string
}

// Cartes exclusives du coffret Palace Heist (chapitre 8 - Reign of Jafar)
const EXCLUSIVE_CARDS: ExclusiveCard[] = [
  { number: '223', name: 'Goofy - Groundbreaking Chef', dreamborn_code: '008-223' },
  { number: '224', name: 'Pinocchio - Strings Attached', dreamborn_code: '008-224' },
]

async function downloadImage(dreamborn_code: string): Promise<Buffer | null> {
  const imageUrl = `${DREAMBORN_CDN}/${dreamborn_code}`
  logger.download(`Téléchargement: ${imageUrl}`)

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      logger.warn(`HTTP ${response.status}`)
      return null
    }
    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    logger.error(`Erreur: ${error}`)
    return null
  }
}

async function uploadImage(imageBuffer: Buffer, cardNumber: string): Promise<string | null> {
  try {
    const optimized = await sharp(imageBuffer)
      .resize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: CARD_DIMENSIONS.quality })
      .toBuffer()

    // Utiliser un dossier séparé pour Palace Heist
    const fileName = `QuestPalace/EN/EN-${cardNumber}.webp`
    logger.upload(`Upload vers ${fileName}...`)

    const { error } = await supabase.storage
      .from('lorcana-cards')
      .upload(fileName, optimized, { contentType: 'image/webp', upsert: true })

    if (error) {
      logger.error(error.message)
      return null
    }
    return `${STORAGE_BASE_URL}/${fileName}`
  } catch (error) {
    logger.error(`${error}`)
    return null
  }
}

async function main() {
  logger.section('Ajout des cartes exclusives Palace Heist EN')

  // Récupérer la série
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (!series) {
    logger.error('Série QuestPalace non trouvée')
    return
  }

  logger.success(`Série trouvée: ${series.id}`)

  for (const card of EXCLUSIVE_CARDS) {
    logger.separator()
    logger.info(`${card.number} - ${card.name}`)

    const imageBuffer = await downloadImage(card.dreamborn_code)
    if (!imageBuffer) {
      logger.warn('Image non disponible')
      continue
    }

    const imageUrl = await uploadImage(imageBuffer, card.number)
    if (!imageUrl) continue

    logger.success(`Image: ${imageUrl}`)

    // Vérifier si existe déjà
    const { data: existing } = await supabase
      .from('cards')
      .select('id')
      .eq('series_id', series.id)
      .eq('number', card.number)
      .eq('language', 'EN')
      .maybeSingle()

    const cardData = {
      series_id: series.id,
      name: card.name,
      number: card.number,
      language: 'EN',
      chapter: null,
      rarity: 'quest',
      image_url: imageUrl,
      attributes: {
        dreamborn_code: card.dreamborn_code,
        source: 'dreamborn.ink',
        questType: 'Palace Heist',
        exclusive: true
      }
    }

    let error
    if (existing) {
      const result = await supabase.from('cards').update(cardData).eq('id', existing.id)
      error = result.error
    } else {
      const result = await supabase.from('cards').insert(cardData)
      error = result.error
    }

    if (error) {
      logger.error(error.message)
    } else {
      logger.success('Carte insérée!')
    }

    await delay(DELAYS.betweenUploads)
  }

  logger.separator()
  logger.success('Terminé!')
  logger.info('Note: Les cartes du deck Jafar (Q2) ne sont pas encore disponibles sur Dreamborn')
}

main()
