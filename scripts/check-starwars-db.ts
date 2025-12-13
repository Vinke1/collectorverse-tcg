/**
 * Quick check of Star Wars database structure
 */

import { createAdminClient } from './lib/supabase'

async function check() {
  const supabase = createAdminClient()

  // Get TCG games
  const { data: tcgs } = await supabase
    .from('tcg_games')
    .select('id, slug, name')

  console.log('=== TCG Games ===')
  tcgs?.forEach(t => console.log(`${t.slug}: ${t.id}`))

  const starwarsId = tcgs?.find(t => t.slug === 'starwars')?.id

  if (!starwarsId) {
    console.log('Star Wars TCG not found!')
    return
  }

  // Check series
  const { data: series } = await supabase
    .from('series')
    .select('id, code, name, tcg_game_id')
    .eq('tcg_game_id', starwarsId)
    .order('code')

  console.log('\n=== Star Wars Series ===')
  series?.forEach(s => console.log(`${s.code}: ${s.id}`))

  // Check cards per series
  console.log('\n=== Cards per Series ===')
  for (const s of series || []) {
    const { count } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('series_id', s.id)
    console.log(`${s.code}: ${count} cards`)
  }

  // Total cards check
  const { count: totalCards } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .in('series_id', series?.map(s => s.id) || [])

  console.log(`\nTotal cards in Star Wars series: ${totalCards}`)

  // Sample cards
  if (totalCards && totalCards > 0) {
    const { data: sampleCards } = await supabase
      .from('cards')
      .select('id, number, name, language, series_id, image_url')
      .in('series_id', series?.map(s => s.id) || [])
      .limit(5)

    console.log('\n=== Sample Cards ===')
    sampleCards?.forEach(c => {
      const seriesCode = series?.find(s => s.id === c.series_id)?.code
      console.log(`[${seriesCode}] #${c.number} - ${c.name} (${c.language})`)
      console.log(`  image_url: ${c.image_url || 'NULL'}`)
    })
  }

  // Check if there are cards without proper series link
  console.log('\n=== Checking all cards in DB ===')
  const { data: allCards, count: allCardsCount } = await supabase
    .from('cards')
    .select('series_id', { count: 'exact' })

  console.log(`Total cards in database: ${allCardsCount}`)

  // Get unique series_ids from cards
  const uniqueSeriesIds = new Set(allCards?.map(c => c.series_id))
  console.log(`Unique series_ids in cards: ${uniqueSeriesIds.size}`)

  // Check if any series_id in cards doesn't match our series
  const seriesIds = new Set(series?.map(s => s.id))
  const orphanSeriesIds = [...uniqueSeriesIds].filter(id => !seriesIds.has(id))

  if (orphanSeriesIds.length > 0) {
    console.log(`\n=== Cards with non-Star Wars series_ids ===`)
    for (const orphanId of orphanSeriesIds.slice(0, 5)) {
      const { data: orphanSeries } = await supabase
        .from('series')
        .select('id, code, name, tcg_game_id')
        .eq('id', orphanId)
        .single()

      if (orphanSeries) {
        const tcgSlug = tcgs?.find(t => t.id === orphanSeries.tcg_game_id)?.slug
        console.log(`  ${orphanSeries.code} (${tcgSlug}): series_id=${orphanId}`)
      }
    }
  }
}

check().catch(console.error)
