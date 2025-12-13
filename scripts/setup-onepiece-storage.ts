/**
 * Script de setup du bucket Supabase Storage pour One Piece
 *
 * Usage:
 *   npx tsx scripts/setup-onepiece-storage.ts
 *
 * Ce script:
 * 1. Crée le bucket 'onepiece-cards' s'il n'existe pas
 * 2. Configure les permissions publiques en lecture
 * 3. Vérifie la connexion Supabase
 */

import { createOnePieceBucket } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

async function main() {
  logger.section('Setup One Piece Storage')

  try {
    // Vérifier la connexion Supabase
    logger.info('Vérification de la connexion Supabase...')
    const supabase = createAdminClient()

    // Vérifier que One Piece existe dans tcg_games
    const { data: tcg, error: tcgError } = await supabase
      .from('tcg_games')
      .select('id, name, slug')
      .eq('slug', 'onepiece')
      .single()

    if (tcgError || !tcg) {
      logger.error('TCG One Piece non trouvé dans la base de données')
      logger.info('Assurez-vous d\'avoir exécuté la migration initiale')
      process.exit(1)
    }

    logger.success(`TCG trouvé: ${tcg.name} (${tcg.id})`)

    // Créer le bucket
    logger.info('\nCréation du bucket de stockage...')
    const result = await createOnePieceBucket()

    if (result.success) {
      logger.success('Bucket onepiece-cards prêt!')
    } else {
      logger.error(`Erreur: ${result.error}`)
      process.exit(1)
    }

    // Vérifier les tables nécessaires
    logger.info('\nVérification des tables...')

    const tables = ['colors', 'attributes', 'card_types', 'rarities']
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('tcg_game_id', tcg.id)

      if (error) {
        logger.warn(`Table ${table} non accessible: ${error.message}`)
      } else {
        logger.success(`Table ${table}: ${count || 0} entrées pour One Piece`)
      }
    }

    // Vérifier les séries
    const { count: seriesCount } = await supabase
      .from('series')
      .select('*', { count: 'exact', head: true })
      .eq('tcg_game_id', tcg.id)

    logger.info(`\nSéries One Piece en base: ${seriesCount || 0}`)

    // Vérifier les cartes
    const { data: series } = await supabase
      .from('series')
      .select('id')
      .eq('tcg_game_id', tcg.id)

    if (series && series.length > 0) {
      const seriesIds = series.map(s => s.id)
      const { count: cardCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .in('series_id', seriesIds)

      logger.info(`Cartes One Piece en base: ${cardCount || 0}`)
    }

    logger.section('Setup terminé!')
    console.log('\nProchaines étapes:')
    console.log('1. Appliquez la migration SQL: supabase/migrations/022_add_onepiece_tables.sql')
    console.log('2. Testez avec une série: npx tsx scripts/seed-onepiece.ts --series OP13 --lang fr')
    console.log('3. Lancez le scraping complet: npm run seed:all-onepiece')

  } catch (error) {
    logger.error(`Erreur: ${error}`)
    process.exit(1)
  }
}

main()
