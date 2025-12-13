import { createAdminClient } from './lib/supabase'

const supabase = createAdminClient()

async function main() {
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'ST16')
    .single()

  if (!series) return

  const { data: cards } = await supabase
    .from('cards')
    .select('number, name, image_url')
    .eq('series_id', series.id)
    .eq('number', '029')
    .single()

  console.log('Carte 029:')
  console.log('URL complete:', cards?.image_url)
}

main().catch(console.error)
