/**
 * Script de nettoyage des cartes One Piece FR incorrectes
 * Supprime les cartes FR pour les séries qui n'existent pas en français (OP01-OP08)
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

// Séries qui n'ont PAS de version française sur opecards.fr
const SERIES_WITHOUT_FR = ['OP01', 'OP02', 'OP03', 'OP04', 'OP05', 'OP06', 'OP07', 'OP08']

async function cleanup() {
  logger.section('Nettoyage des cartes One Piece FR incorrectes')

  let totalDeleted = 0

  for (const code of SERIES_WITHOUT_FR) {
    // Récupérer l'ID de la série
    const { data: series } = await supabase
      .from('series')
      .select('id')
      .eq('code', code)
      .single()

    if (!series) {
      logger.info(`${code}: série non trouvée`)
      continue
    }

    // Compter les cartes FR
    const { count } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('series_id', series.id)
      .eq('language', 'FR')

    if (count && count > 0) {
      logger.processing(`${code}: ${count} cartes FR à supprimer`)

      // Supprimer les cartes FR
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('series_id', series.id)
        .eq('language', 'FR')

      if (error) {
        logger.error(`Erreur suppression ${code}: ${error.message}`)
      } else {
        logger.success(`${code}: ${count} cartes FR supprimées`)
        totalDeleted += count
      }
    } else {
      logger.info(`${code}: pas de cartes FR`)
    }
  }

  // Supprimer aussi les cartes avec 'undefined' dans le numéro
  logger.info('\nRecherche des cartes avec "undefined" dans le numéro...')

  const { data: undefinedCards } = await supabase
    .from('cards')
    .select('id, number, series_id')
    .like('number', '%undefined%')

  if (undefinedCards && undefinedCards.length > 0) {
    logger.processing(`${undefinedCards.length} cartes avec 'undefined' trouvées`)

    const { error } = await supabase
      .from('cards')
      .delete()
      .like('number', '%undefined%')

    if (error) {
      logger.error(`Erreur suppression undefined: ${error.message}`)
    } else {
      logger.success(`${undefinedCards.length} cartes 'undefined' supprimées`)
      totalDeleted += undefinedCards.length
    }
  } else {
    logger.info('Pas de cartes avec "undefined"')
  }

  logger.section('Résumé')
  logger.success(`Total supprimé: ${totalDeleted} cartes`)
}

cleanup().catch(console.error)
