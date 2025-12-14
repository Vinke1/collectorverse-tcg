/**
 * Script temporaire pour analyser les images PRB01 et PRB02
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

const SERIES_IDS = {
  PRB01: 'bc700b8d-5f56-437e-8ab7-92b8b39d6ef7',
  PRB02: '2d872f15-9ac9-4132-806c-0eae9ff5d706'
}

async function main() {
  logger.section('Analyse des images PRB')

  for (const [seriesCode, seriesId] of Object.entries(SERIES_IDS)) {
    logger.section(`${seriesCode}`)

    // Récupérer les cartes
    const { data: cards, error } = await supabase
      .from('cards')
      .select('number, name, image_url, language, attributes')
      .eq('series_id', seriesId)
      .order('number')

    if (error) {
      logger.error(`Erreur récupération ${seriesCode}: ${error.message}`)
      continue
    }

    logger.info(`${cards?.length || 0} cartes trouvées`)

    // Afficher les 10 premières cartes
    console.log('\nPremières cartes:')
    cards?.slice(0, 10).forEach(card => {
      console.log(`\n${card.number} (${card.language}): ${card.name}`)
      console.log(`  Image URL: ${card.image_url?.substring(0, 100)}...`)
      if (card.attributes) {
        console.log(`  Attributes:`, card.attributes)
      }
    })

    // Vérifier combien ont des images storage vs URL source
    const storageImages = cards?.filter(c => c.image_url?.includes('supabase.co/storage')) || []
    const sourceImages = cards?.filter(c => c.image_url?.includes('static.opecards.fr')) || []

    console.log(`\nRésumé ${seriesCode}:`)
    console.log(`  Total: ${cards?.length || 0}`)
    console.log(`  Images Storage (Supabase): ${storageImages.length}`)
    console.log(`  Images Source (opecards.fr): ${sourceImages.length}`)
    console.log(`  Sans image: ${cards?.filter(c => !c.image_url).length || 0}`)
  }

  logger.section('Vérification du Storage Supabase')

  for (const seriesCode of Object.keys(SERIES_IDS)) {
    logger.info(`\n${seriesCode}:`)

    // Lister les fichiers dans le storage
    const { data: enFiles, error: enError } = await supabase.storage
      .from('onepiece-cards')
      .list(`${seriesCode}/en`)

    const { data: frFiles, error: frError } = await supabase.storage
      .from('onepiece-cards')
      .list(`${seriesCode}/fr`)

    if (enError) {
      console.log(`  EN: Erreur - ${enError.message}`)
    } else {
      console.log(`  EN: ${enFiles?.length || 0} fichiers`)
      enFiles?.slice(0, 5).forEach(f => console.log(`    - ${f.name}`))
    }

    if (frError) {
      console.log(`  FR: Erreur - ${frError.message}`)
    } else {
      console.log(`  FR: ${frFiles?.length || 0} fichiers`)
      frFiles?.slice(0, 5).forEach(f => console.log(`    - ${f.name}`))
    }
  }
}

main().catch(console.error)
