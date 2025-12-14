/**
 * Script pour vérifier l'avancement du téléchargement PRB
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

const SERIES_DB_IDS: Record<string, string> = {
  PRB01: 'bc700b8d-5f56-437e-8ab7-92b8b39d6ef7',
  PRB02: '2d872f15-9ac9-4132-806c-0eae9ff5d706'
}

async function main() {
  logger.section('État du téléchargement PRB')

  for (const [seriesCode, seriesId] of Object.entries(SERIES_DB_IDS)) {
    console.log(`\n${seriesCode}:`)

    for (const lang of ['EN', 'FR']) {
      const { data: allCards, error: errorTotal } = await supabase
        .from('cards')
        .select('id, image_url')
        .eq('series_id', seriesId)
        .eq('language', lang)

      if (errorTotal || !allCards) {
        console.log(`  ${lang}: Erreur`)
        continue
      }

      const totalCount = allCards.length
      const withStatic = allCards.filter(c => c.image_url && c.image_url.includes('static.opecards.fr'))
      const withSupabase = allCards.filter(c => c.image_url && c.image_url.includes('supabase'))

      const staticCount = withStatic.length
      const supabaseCount = withSupabase.length
      const progress = totalCount > 0 ? Math.round((supabaseCount / totalCount) * 100) : 0

      console.log(`  ${lang}: ${supabaseCount}/${totalCount} (${progress}%) - ${staticCount} restantes`)
    }
  }
}

main().catch(console.error)
