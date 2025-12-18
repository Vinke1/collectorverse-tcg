/**
 * Cleanup empty Pokemon series
 *
 * This script removes Pokemon series that have no cards and no available data in the API.
 * It specifically targets:
 * - jumbo (Jumbo cards) - 0 cards, no API data
 * - sp (Sample) - 0 cards, no API data
 * - wp (W Promotional) - 0 cards, no API data
 *
 * Usage:
 *   npx tsx scripts/cleanup-empty-pokemon-series.ts
 *   npx tsx scripts/cleanup-empty-pokemon-series.ts --dry-run
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

// Series codes to remove (no data available)
const SERIES_TO_REMOVE = [
  { code: 'jumbo', name: 'Jumbo cards' },
  { code: 'sp', name: 'Sample' },
  { code: 'wp', name: 'W Promotional' },
]

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

interface SeriesInfo {
  id: string
  code: string
  name: string
  cardCount: number
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Nettoyage des séries Pokemon vides')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune suppression ne sera effectuée')
  }

  // Step 1: Get Pokemon TCG game ID
  logger.info('Récupération du TCG Pokemon...')
  const { data: pokemonGame, error: gameError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'pokemon')
    .single()

  if (gameError || !pokemonGame) {
    logger.error(`Impossible de trouver le TCG Pokemon: ${gameError?.message}`)
    process.exit(1)
  }

  logger.success(`TCG Pokemon trouvé (ID: ${pokemonGame.id})`)

  // Step 2: Check each series to remove
  logger.separator()
  logger.info(`Vérification de ${SERIES_TO_REMOVE.length} séries à supprimer...`)

  const seriesToDelete: SeriesInfo[] = []

  for (const seriesConfig of SERIES_TO_REMOVE) {
    // Get series info
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select('id, code, name')
      .eq('tcg_game_id', pokemonGame.id)
      .eq('code', seriesConfig.code)
      .single()

    if (seriesError || !series) {
      logger.warn(`Série "${seriesConfig.code}" non trouvée dans la base de données`)
      continue
    }

    // Count cards in this series
    const { count: cardCount, error: countError } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('series_id', series.id)

    if (countError) {
      logger.error(`Erreur lors du comptage des cartes pour "${seriesConfig.code}": ${countError.message}`)
      continue
    }

    logger.info(`Série "${series.code}" (${series.name}): ${cardCount || 0} cartes`)

    if (cardCount === 0) {
      seriesToDelete.push({
        id: series.id,
        code: series.code,
        name: series.name,
        cardCount: 0,
      })
    } else {
      logger.warn(`Série "${series.code}" n'est pas vide (${cardCount} cartes) - ignorée`)
    }
  }

  // Step 3: Delete series
  logger.separator()

  if (seriesToDelete.length === 0) {
    logger.info('Aucune série vide à supprimer')
    return
  }

  logger.info(`${seriesToDelete.length} série(s) vide(s) à supprimer:`)
  for (const series of seriesToDelete) {
    logger.info(`  - ${series.code} (${series.name})`)
  }

  if (dryRun) {
    logger.warn('Mode DRY RUN - les séries ne seront pas supprimées')
    return
  }

  logger.separator()
  logger.processing('Suppression des séries...')

  let deletedCount = 0
  let errorCount = 0

  for (const series of seriesToDelete) {
    const { error: deleteError } = await supabase
      .from('series')
      .delete()
      .eq('id', series.id)

    if (deleteError) {
      logger.error(`Échec de la suppression de "${series.code}": ${deleteError.message}`)
      errorCount++
    } else {
      logger.success(`Série "${series.code}" (${series.name}) supprimée`)
      deletedCount++
    }
  }

  // Summary
  logger.separator()
  logger.section('Résumé')
  logger.info(`Total vérifié: ${SERIES_TO_REMOVE.length} séries`)
  logger.info(`Séries vides trouvées: ${seriesToDelete.length}`)
  logger.success(`Séries supprimées: ${deletedCount}`)
  if (errorCount > 0) {
    logger.error(`Erreurs: ${errorCount}`)
  }
}

main()
  .then(() => {
    logger.success('Script terminé')
    process.exit(0)
  })
  .catch((error) => {
    logger.error(`Erreur fatale: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
