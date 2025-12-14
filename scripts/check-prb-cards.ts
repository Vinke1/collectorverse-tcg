/**
 * Script pour analyser les cartes PRB01 et PRB02 dans la DB
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

async function main() {
  logger.section('Analyse des cartes PRB')

  // Récupérer les séries PRB
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .in('code', ['PRB01', 'PRB02'])
    .order('code')

  if (seriesError) {
    logger.error(`Erreur récupération séries: ${seriesError.message}`)
    return
  }

  if (!series || series.length === 0) {
    logger.error('Aucune série PRB trouvée')
    return
  }

  for (const serie of series) {
    logger.section(`Série: ${serie.name} (${serie.code})`)
    console.log(`ID: ${serie.id}`)

    // Récupérer toutes les cartes
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('series_id', serie.id)
      .order('language')
      .order('number')

    if (cardsError) {
      logger.error(`Erreur récupération cartes: ${cardsError.message}`)
      continue
    }

    if (!cards || cards.length === 0) {
      logger.warn('Aucune carte trouvée')
      continue
    }

    logger.success(`${cards.length} cartes trouvées`)

    // Grouper par langue
    const byLang = cards.reduce((acc, card) => {
      if (!acc[card.language]) acc[card.language] = []
      acc[card.language].push(card)
      return acc
    }, {} as Record<string, any[]>)

    for (const [lang, langCards] of Object.entries(byLang)) {
      console.log(`\n  ${lang}: ${langCards.length} cartes`)

      // Analyser les image_url
      const withImage = langCards.filter(c => c.image_url && !c.image_url.includes('static.opecards.fr'))
      const withStaticUrl = langCards.filter(c => c.image_url && c.image_url.includes('static.opecards.fr'))
      const withoutImage = langCards.filter(c => !c.image_url)

      console.log(`    - Avec image Supabase: ${withImage.length}`)
      console.log(`    - Avec URL static.opecards.fr: ${withStaticUrl.length}`)
      console.log(`    - Sans image: ${withoutImage.length}`)

      // Afficher quelques exemples
      if (withStaticUrl.length > 0) {
        console.log(`\n    Exemples d'URLs static.opecards.fr:`)
        withStaticUrl.slice(0, 3).forEach(c => {
          console.log(`      ${c.number}: ${c.name}`)
          console.log(`        ${c.image_url}`)
        })
      }

      if (withImage.length > 0) {
        console.log(`\n    Exemples d'images Supabase:`)
        withImage.slice(0, 3).forEach(c => {
          console.log(`      ${c.number}: ${c.name}`)
          console.log(`        ${c.image_url}`)
        })
      }
    }
  }

  // Vérifier le storage Supabase
  logger.section('Vérification Storage Supabase')

  for (const serie of series) {
    console.log(`\n${serie.code}:`)

    // Lister les fichiers dans PRB01/en et PRB01/fr
    for (const lang of ['en', 'fr']) {
      const { data: files, error: filesError } = await supabase.storage
        .from('onepiece-cards')
        .list(`${serie.code}/${lang}`)

      if (filesError) {
        console.log(`  ${lang}: Erreur - ${filesError.message}`)
      } else if (!files || files.length === 0) {
        console.log(`  ${lang}: Aucun fichier`)
      } else {
        console.log(`  ${lang}: ${files.length} fichiers`)
        // Afficher les 5 premiers
        files.slice(0, 5).forEach(f => {
          console.log(`    - ${f.name}`)
        })
      }
    }
  }
}

main().catch(console.error)
