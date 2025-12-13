/**
 * Script de setup du bucket Supabase Storage pour Star Wars Unlimited
 *
 * Usage:
 *   npx tsx scripts/setup-starwars-storage.ts
 *
 * Ce script:
 * 1. Crée le bucket 'starwars-cards' s'il n'existe pas
 * 2. Configure les permissions publiques en lecture
 * 3. Vérifie la connexion Supabase
 */

import { createStarWarsBucket } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

async function main() {
  logger.section('Setup Star Wars Unlimited Storage')

  try {
    // Vérifier la connexion Supabase
    logger.info('Vérification de la connexion Supabase...')
    const supabase = createAdminClient()

    // Vérifier que Star Wars existe dans tcg_games
    const { data: tcg, error: tcgError } = await supabase
      .from('tcg_games')
      .select('id, name, slug')
      .eq('slug', 'starwars')
      .single()

    if (tcgError || !tcg) {
      logger.error('TCG Star Wars Unlimited non trouvé dans la base de données')
      logger.info('Assurez-vous d\'avoir exécuté la migration: 023_add_starwars_tables.sql')
      process.exit(1)
    }

    logger.success(`TCG trouvé: ${tcg.name} (${tcg.id})`)

    // Créer le bucket
    logger.info('\nCréation du bucket de stockage...')
    const result = await createStarWarsBucket()

    if (result.success) {
      logger.success('Bucket starwars-cards prêt!')
    } else {
      logger.error(`Erreur: ${result.error}`)
      process.exit(1)
    }

    // Vérifier les tables nécessaires
    logger.info('\nVérification des tables...')

    const tables = ['arenas', 'aspects', 'card_types', 'rarities']
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('tcg_game_id', tcg.id)

      if (error) {
        logger.warn(`Table ${table} non accessible: ${error.message}`)
      } else {
        logger.success(`Table ${table}: ${count || 0} entrées pour Star Wars`)
      }
    }

    // Vérifier les séries
    const { count: seriesCount } = await supabase
      .from('series')
      .select('*', { count: 'exact', head: true })
      .eq('tcg_game_id', tcg.id)

    logger.info(`\nSéries Star Wars en base: ${seriesCount || 0}`)

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

      logger.info(`Cartes Star Wars en base: ${cardCount || 0}`)
    }

    logger.section('Setup terminé!')
    console.log('\nProchaines étapes:')
    console.log('1. Appliquez la migration SQL: supabase/migrations/023_add_starwars_tables.sql')
    console.log('2. Testez avec une série: npx tsx scripts/seed-starwars.ts --series SOR --lang fr')
    console.log('3. Lancez le scraping complet: npm run seed:all-starwars')

  } catch (error) {
    logger.error(`Erreur: ${error}`)
    process.exit(1)
  }
}

main()
