/**
 * Script pour ajouter les cartes PROMO manquantes du chapitre 9 (Fabuleux)
 * Ces cartes appartiennent à la série FAB avec un numbering spécial (X/P3)
 * Source: https://dreamborn.ink
 *
 * Usage: npm run add:lorcana-promo-p3
 */

import { uploadCardImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Définition des cartes PROMO pour la série FAB (Fabuleux)
interface PromoCard {
  number: string // Numéro complet (ex: "1/P3")
  name: string
  imageUrl: string
  language: string
  chapter: number
  rarity: string
}

const PROMO_CARDS: PromoCard[] = [
  {
    number: '1/P3',
    name: 'Dumbo - L\'éléphant volant',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/246da070a05a9c762b65877ff7b563a1eaba47b3',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '2/P3',
    name: 'Alice - Accidentellement à la dérive',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/fa445e5aabbb83216b4822e99bf4ddbd06764906',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '3/P3',
    name: 'La Reine - Souveraine vaniteuse',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/8494fbe8958e5a49a1497f068acbea4eb782714a',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '4/P3',
    name: 'Maléfique - Dragon monstrueux',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/d41059b46e6065abeed22dd905434b44dec3c05c',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '5/P3',
    name: 'Maléfique - Dragon monstrueux',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/82dd1da083a9aacd132f6fe985b20439defaf091',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '7/P3',
    name: 'Ondins ensorcelés - Œuvre d\'Ursula',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/d0c5139cfcee2bf726300560414dcd02a658ed6a',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '8/P3',
    name: 'Plus ardent que le feu des volcans',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/002-201',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '9/P3',
    name: 'Sisu - Visiteuse audacieuse',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/a085ae03843edf8d1e50073284cdab00bc68b613',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  },
  {
    number: '11/P3',
    name: 'La Fée Clochette - Fée géante',
    imageUrl: 'https://cdn.dreamborn.ink/images/fr/cards/P3/8b09c23c16c5415d582dde1e619d379c6736d109',
    language: 'FR',
    chapter: 9,
    rarity: 'promo'
  }
]

/**
 * Attend un certain délai
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Récupère la série Fabuleux (code "9")
 */
async function getFABSeries(): Promise<string> {
  logger.info('Recherche de la série Fabuleux (code "9")...')

  const { data: series, error } = await supabase
    .from('series')
    .select('*')
    .eq('code', '9')
    .single()

  if (error || !series) {
    throw new Error('Série Fabuleux (code "9") non trouvée dans la base de données')
  }

  logger.success(`Série Fabuleux trouvée: ${series.id}`)
  logger.info(`   Nom: ${series.name}`)
  logger.info(`   Code: ${series.code}`)

  return series.id
}

/**
 * Insère les cartes PROMO dans la série Fabuleux
 */
async function insertPromoCards(seriesId: string) {
  logger.processing(`Insertion de ${PROMO_CARDS.length} cartes PROMO dans la série Fabuleux...`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < PROMO_CARDS.length; i++) {
    const card = PROMO_CARDS[i]

    try {
      logger.info(`[${i + 1}/${PROMO_CARDS.length}] #${card.number} - FR - ${card.chapter} - ${card.name}`)

      // Upload de l'image sur Supabase Storage
      logger.download('Téléchargement et upload de l\'image...')

      // Utiliser un nom de fichier safe pour le storage (remplacer "/" par "-")
      const safeFileName = card.number.replace('/', '-')
      const imageResult = await uploadCardImage(card.imageUrl, safeFileName, '9')

      const imageUrl = imageResult.success ? imageResult.url! : card.imageUrl

      if (!imageResult.success) {
        logger.warn('Échec upload, utilisation URL originale')
      }

      // Insertion dans la base de données
      const { error } = await supabase
        .from('cards')
        .upsert({
          series_id: seriesId,
          name: card.name,
          number: card.number, // Format complet: "1/P3"
          language: card.language,
          chapter: card.chapter,
          rarity: card.rarity,
          image_url: imageUrl,
          attributes: {
            source: 'dreamborn.ink',
            promo_type: 'P3',
            slug: `${card.number.toLowerCase()}-fr-${card.chapter}-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          }
        }, {
          onConflict: 'series_id,number',
          ignoreDuplicates: false
        })

      if (error) {
        logger.error(`Erreur insertion: ${error.message}`)
        errorCount++
      } else {
        logger.success('Carte insérée')
        successCount++
      }

      // Rate limiting
      if (i < PROMO_CARDS.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      logger.error(`Erreur: ${error}`)
      errorCount++
    }
  }

  logger.progress('Résumé de l\'insertion:')
  logger.success(`Succès: ${successCount}`)
  logger.error(`Erreurs: ${errorCount}`)
  logger.progress(`Total: ${PROMO_CARDS.length}`)
}

/**
 * Script principal
 */
async function main() {
  logger.section('🎴 Ajout des cartes PROMO dans la série Fabuleux - Chapitre 9')

  try {
    // Étape 1: Récupérer la série Fabuleux
    const seriesId = await getFABSeries()

    // Étape 2: Insérer les cartes PROMO
    await insertPromoCards(seriesId)

    logger.separator()
    logger.success('Ajout des cartes PROMO terminé avec succès!')
    logger.web('Consultez vos cartes: http://localhost:3000/lorcana/series/9')
    logger.info('Filtrez par rareté "promo" pour voir uniquement les cartes PROMO')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution du script
main()
