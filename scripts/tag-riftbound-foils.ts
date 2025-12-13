/**
 * Script pour taguer les cartes Riftbound foil-only et standard-only
 *
 * - Cartes foil-only: is_foil = true (29 cartes)
 * - Cartes standard-only: is_foil = false (4 cartes)
 * - Cartes dans les deux variantes: pas de tag (277 cartes)
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import * as fs from 'fs'

const supabase = createAdminClient()

interface TaggingData {
  foilOnly: { code: string; name: string; id: string }[]
  standardOnly: { code: string; name: string; id: string }[]
  both: { code: string; name: string; id: string }[]
  notFound: { code: string; name: string; publicCode: string }[]
}

async function main() {
  // Charger les données de tagging
  if (!fs.existsSync('riftbound-tagging.json')) {
    logger.error('Fichier riftbound-tagging.json non trouvé. Exécutez d\'abord analyze-riftbound-foils.ts')
    return
  }

  const tagging: TaggingData = JSON.parse(fs.readFileSync('riftbound-tagging.json', 'utf8'))

  logger.section('Tagging des cartes Riftbound')
  console.log('Cartes foil-only à taguer:', tagging.foilOnly.length)
  console.log('Cartes standard-only à taguer:', tagging.standardOnly.length)
  console.log('Cartes dans les deux variantes (pas de tag):', tagging.both.length)

  // 1. Taguer les cartes foil-only
  logger.section('Tagging cartes FOIL-ONLY (is_foil: true)')
  let foilSuccess = 0
  let foilError = 0

  for (const card of tagging.foilOnly) {
    // Récupérer la carte actuelle pour avoir ses attributes
    const { data: currentCard, error: fetchError } = await supabase
      .from('cards')
      .select('attributes')
      .eq('id', card.id)
      .single()

    if (fetchError || !currentCard) {
      logger.error(`Carte ${card.code} non trouvée: ${fetchError?.message}`)
      foilError++
      continue
    }

    // Mettre à jour avec is_foil: true
    const newAttributes = {
      ...currentCard.attributes,
      is_foil: true
    }

    const { error: updateError } = await supabase
      .from('cards')
      .update({ attributes: newAttributes })
      .eq('id', card.id)

    if (updateError) {
      logger.error(`Erreur ${card.code}: ${updateError.message}`)
      foilError++
    } else {
      logger.success(`${card.code} - ${card.name} → is_foil: true`)
      foilSuccess++
    }
  }

  // 2. Taguer les cartes standard-only
  logger.section('Tagging cartes STANDARD-ONLY (is_foil: false)')
  let standardSuccess = 0
  let standardError = 0

  for (const card of tagging.standardOnly) {
    // Récupérer la carte actuelle pour avoir ses attributes
    const { data: currentCard, error: fetchError } = await supabase
      .from('cards')
      .select('attributes')
      .eq('id', card.id)
      .single()

    if (fetchError || !currentCard) {
      logger.error(`Carte ${card.code} non trouvée: ${fetchError?.message}`)
      standardError++
      continue
    }

    // Mettre à jour avec is_foil: false
    const newAttributes = {
      ...currentCard.attributes,
      is_foil: false
    }

    const { error: updateError } = await supabase
      .from('cards')
      .update({ attributes: newAttributes })
      .eq('id', card.id)

    if (updateError) {
      logger.error(`Erreur ${card.code}: ${updateError.message}`)
      standardError++
    } else {
      logger.success(`${card.code} - ${card.name} → is_foil: false`)
      standardSuccess++
    }
  }

  // Résumé
  logger.section('RÉSUMÉ')
  console.log(`Cartes foil-only taguées: ${foilSuccess}/${tagging.foilOnly.length}`)
  console.log(`Cartes standard-only taguées: ${standardSuccess}/${tagging.standardOnly.length}`)

  if (foilError > 0 || standardError > 0) {
    logger.warn(`Erreurs: ${foilError + standardError}`)
  } else {
    logger.success('Toutes les cartes ont été taguées avec succès!')
  }
}

main().catch(console.error)
