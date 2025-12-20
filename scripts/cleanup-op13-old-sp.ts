/**
 * Script pour supprimer les anciennes entrées SP avec le format PR/175
 * et garder uniquement les nouvelles entrées avec le format SR
 *
 * Usage:
 *   npx tsx scripts/cleanup-op13-old-sp.ts --dry-run
 *   npx tsx scripts/cleanup-op13-old-sp.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Les anciennes entrées ont le suffixe -PR et le nom commence par "Op13 Sp Parallele"
// Nous allons supprimer toutes les entrées avec number se terminant par -PR

async function main() {
  logger.section('Nettoyage des anciennes entrées SP OP13')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`)

  try {
    // Récupérer l'ID de la série OP13
    const { data: series } = await supabase
      .from('series')
      .select('id')
      .eq('code', 'OP13')
      .single()

    if (!series) {
      logger.error('Série OP13 non trouvée')
      return
    }

    logger.success(`Série OP13: ${series.id}`)

    // Chercher les anciennes entrées avec suffixe -PR
    const { data: oldCards, error: findError } = await supabase
      .from('cards')
      .select('id, name, number, rarity, image_url')
      .eq('series_id', series.id)
      .like('number', '%-PR')

    if (findError) {
      logger.error(`Erreur recherche: ${findError.message}`)
      return
    }

    if (!oldCards || oldCards.length === 0) {
      logger.info('Aucune ancienne entrée -PR trouvée')
      return
    }

    logger.info(`\n${oldCards.length} anciennes entrées trouvées:`)
    oldCards.forEach(card => {
      console.log(`  - ${card.number}: ${card.name} (rarity: ${card.rarity})`)
    })

    if (!dryRun) {
      const ids = oldCards.map(c => c.id)
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .in('id', ids)

      if (deleteError) {
        logger.error(`Erreur suppression: ${deleteError.message}`)
      } else {
        logger.success(`${oldCards.length} entrées supprimées`)
      }
    } else {
      logger.info('\nDry run - aucune suppression effectuée')
      logger.info('Relancez sans --dry-run pour supprimer')
    }

  } catch (error) {
    logger.error(`Erreur: ${error}`)
  }
}

main()
