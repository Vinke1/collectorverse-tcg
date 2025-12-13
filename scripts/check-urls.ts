import { createAdminClient } from './lib/supabase'

const supabase = createAdminClient()

async function main() {
  const { data: tcg } = await supabase.from('tcg_games').select('id').eq('slug', 'onepiece').single()

  if (!tcg) {
    console.log('TCG non trouvé')
    return
  }

  // Récupérer quelques exemples d'URLs pour différentes séries
  const seriesToCheck = ['PRB01', 'P', 'STP', 'ST15']

  for (const seriesCode of seriesToCheck) {
    const { data: series } = await supabase
      .from('series')
      .select('id, code')
      .eq('tcg_game_id', tcg.id)
      .eq('code', seriesCode)
      .single()

    if (!series) {
      console.log(`Série ${seriesCode} non trouvée`)
      continue
    }

    const { data: cards } = await supabase
      .from('cards')
      .select('number, language, image_url')
      .eq('series_id', series.id)
      .like('image_url', '%opecards.fr%')
      .limit(2)

    if (cards && cards.length > 0) {
      console.log(`\n${seriesCode}:`)
      cards.forEach(c => console.log(`  #${c.number} [${c.language}]: ${c.image_url}`))
    }
  }
}

main().catch(console.error)
