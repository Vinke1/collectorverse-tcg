/**
 * Script pour nettoyer les fichiers erronés dans Ink/FR/
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

async function main() {
  logger.section('Nettoyage de Ink/FR/')

  const supabase = createAdminClient()

  // Lister les fichiers dans Ink/FR/
  const { data: files, error } = await supabase.storage.from('lorcana-cards').list('Ink/FR')

  if (error) {
    logger.error(`Erreur: ${error.message}`)
    return
  }

  if (!files || files.length === 0) {
    logger.info('Dossier Ink/FR/ vide')
    return
  }

  // Fichiers à supprimer (les icônes d'encre erronées)
  const filesToDelete = files.filter(f =>
    !f.name.startsWith('FR-') && f.name.endsWith('.webp')
  ).map(f => `Ink/FR/${f.name}`)

  if (filesToDelete.length === 0) {
    logger.info('Aucun fichier erroné à supprimer')
    return
  }

  logger.info(`Fichiers à supprimer: ${filesToDelete.length}`)
  filesToDelete.forEach(f => console.log(`  - ${f}`))

  // Supprimer les fichiers
  const { error: deleteError } = await supabase.storage
    .from('lorcana-cards')
    .remove(filesToDelete)

  if (deleteError) {
    logger.error(`Erreur suppression: ${deleteError.message}`)
  } else {
    logger.success(`${filesToDelete.length} fichiers supprimés`)
  }
}

main()
