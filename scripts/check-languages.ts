import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkLanguages() {
  console.log('=== Checking card languages ===\n')

  // Get all One Piece series
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    console.log('TCG not found')
    return
  }

  const { data: allSeries } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)
    .order('code')

  for (const serie of allSeries || []) {
    const { data: cards } = await supabase
      .from('cards')
      .select('language')
      .eq('series_id', serie.id)

    const langCounts: Record<string, number> = {}
    cards?.forEach(c => {
      const lang = c.language || 'NULL'
      langCounts[lang] = (langCounts[lang] || 0) + 1
    })

    const total = cards?.length || 0
    const langs = Object.entries(langCounts).map(([l, c]) => `${l}:${c}`).join(', ')
    console.log(`${serie.code.padEnd(6)} (${total} cards): ${langs || 'No cards'}`)
  }
}

checkLanguages()
