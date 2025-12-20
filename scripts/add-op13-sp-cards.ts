/**
 * Script pour ajouter les cartes SP Parallèles manquantes dans OP13
 *
 * Usage:
 *   npx tsx scripts/add-op13-sp-cards.ts
 *   npx tsx scripts/add-op13-sp-cards.ts --dry-run
 */

import { createAdminClient } from './lib/supabase'
import { uploadOnePieceCardImage } from '../lib/supabase/storage'
import { logger } from './lib/logger'
import { delay } from './lib/utils'

const supabase = createAdminClient()

// Arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Cartes SP Parallèles à ajouter
const SP_CARDS = [
  {
    name: 'Ben Beckmann',
    number: '009-SR',
    rarity: 'SR',
    imageUrl: 'https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op09-009-sr-op13-sp-parallele-ben-beckmann.webp',
    slug: 'op09-009-sr-op13-sp-parallele-ben-beckmann',
    originalSet: 'OP09',
    variant: 'SP Parallèle'
  },
  {
    name: 'Smoker',
    number: '030-SR',
    rarity: 'SR',
    imageUrl: 'https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op10-030-sr-op13-sp-parallele-smoker.webp',
    slug: 'op10-030-sr-op13-sp-parallele-smoker',
    originalSet: 'OP10',
    variant: 'SP Parallèle'
  },
  {
    name: 'Lilith',
    number: '111-SR',
    rarity: 'SR',
    imageUrl: 'https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op07-111-sr-op13-sp-parallele-lilith.webp',
    slug: 'op07-111-sr-op13-sp-parallele-lilith',
    originalSet: 'OP07',
    variant: 'SP Parallèle'
  },
  {
    name: 'Shanks',
    number: '004-SR-Gold',
    rarity: 'SR',
    imageUrl: 'https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op09-004-sr-op13-sp-parallele-gold-shanks.webp',
    slug: 'op09-004-sr-op13-sp-parallele-gold-shanks',
    originalSet: 'OP09',
    variant: 'SP Parallèle Gold'
  },
  {
    name: 'Shanks',
    number: '004-SR-Silver',
    rarity: 'SR',
    imageUrl: 'https://static.opecards.fr/cards/fr/op13/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-op09-004-sr-op13-sp-parallele-silver-shanks.webp',
    slug: 'op09-004-sr-op13-sp-parallele-silver-shanks',
    originalSet: 'OP09',
    variant: 'SP Parallèle Silver'
  }
]

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

async function main() {
  logger.section('Ajout des cartes SP Parallèles OP13')
  console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'PRODUCTION'}`)
  console.log(`Cartes à ajouter: ${SP_CARDS.length}`)

  if (dryRun) {
    logger.info('\n--- MODE DRY RUN ---')
    SP_CARDS.forEach((card, i) => {
      console.log(`\n${i + 1}. ${card.name}`)
      console.log(`   Numéro: ${card.number}`)
      console.log(`   Rareté: ${card.rarity}`)
      console.log(`   Variante: ${card.variant}`)
      console.log(`   Image: ${card.imageUrl}`)
    })
    logger.success('\nDry run terminé. Relancez sans --dry-run pour exécuter.')
    return
  }

  try {
    // Récupérer l'ID de la série OP13
    logger.info('\n1. Récupération de la série OP13...')
    const seriesId = await getOP13SeriesId()
    logger.success(`Série OP13 trouvée: ${seriesId}`)

    // Traiter chaque carte
    logger.info('\n2. Ajout des cartes...')
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < SP_CARDS.length; i++) {
      const card = SP_CARDS[i]
      logger.progress(`[${i + 1}/${SP_CARDS.length}] ${card.name} (${card.variant})`)

      try {
        // Upload de l'image
        logger.info(`   Téléchargement de l'image...`)
        const imageResult = await uploadOnePieceCardImage(
          card.imageUrl,
          card.number,
          'OP13',
          'fr'
        )

        if (!imageResult.success) {
          logger.warn(`   Image non uploadée: ${imageResult.error}`)
        }

        const finalImageUrl = imageResult.success && imageResult.url
          ? imageResult.url
          : card.imageUrl

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
            attributes: {
              slug: card.slug,
              original_set: card.originalSet,
              variant: card.variant,
              card_type: 'character',
              is_sp_parallel: true,
              is_foil: true,
              finish: 'special'
            }
          }, {
            onConflict: 'series_id,number,language',
            ignoreDuplicates: false
          })

        if (error) {
          logger.error(`   Erreur insertion: ${error.message}`)
          errorCount++
        } else {
          logger.success(`   ${card.name} ajouté avec succès`)
          successCount++
        }

        await delay(500)

      } catch (err) {
        logger.error(`   Erreur: ${err}`)
        errorCount++
      }
    }

    // Résumé
    logger.section('Résumé')
    logger.success(`Succès: ${successCount}`)
    if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)
    logger.info(`Total: ${SP_CARDS.length}`)

    console.log('\nConsultez vos cartes: http://localhost:3000/series/onepiece/OP13')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
