import { createAdminClient } from './lib/supabase'

const supabase = createAdminClient()

async function main() {
  // D'abord, trouver le TCG Lorcana
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id, slug')
    .eq('slug', 'lorcana')
    .single()

  console.log('TCG Lorcana:', tcg)

  // Lister toutes les séries Lorcana
  const { data: allSeries } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg?.id)
    .order('name')

  console.log('\nToutes les séries Lorcana:')
  allSeries?.forEach(s => console.log(`  ${s.code}: ${s.name}`))

  // Trouver la série First Chapter (code = 1 probablement)
  const series = allSeries?.find(s => s.code === '1' || s.name.toLowerCase().includes('first') || s.code === 'FirstChapter')

  if (!series) {
    console.log('\nSérie First Chapter non trouvée')
    return
  }
  console.log('\nSérie trouvée:', JSON.stringify(series, null, 2))

  // Trouver les cartes EN
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, name, number, language, rarity, image_url')
    .eq('series_id', series.id)
    .eq('language', 'en')
    .order('number')

  if (cardsError) {
    console.log('Erreur cartes:', cardsError)
    return
  }

  console.log('\nTotal cartes EN:', cards.length)

  // Filtrer les cartes promo (contenant P ou C dans le numéro)
  const promoCards = cards.filter(
    (c) => c.number.includes('P') || c.number.includes('C') || c.number.includes('/')
  )

  console.log('\nCartes promo EN:')
  promoCards.forEach((c) => {
    const hasImage = c.image_url ? '✓' : '✗'
    console.log(`${hasImage} ${c.number} - ${c.name} (rarity: ${c.rarity})`)
  })

  // Cartes sans image
  const noImage = promoCards.filter(c => !c.image_url)
  console.log('\nCartes promo sans image:', noImage.length)
  noImage.forEach(c => {
    console.log(`  - ${c.number}: ${c.name}`)
  })

  // Vérifier toutes les langues disponibles pour cette série
  const { data: allCards } = await supabase
    .from('cards')
    .select('id, name, number, language, rarity, image_url')
    .eq('series_id', series.id)
    .order('language')
    .order('number')

  console.log('\nToutes les cartes de cette série:', allCards?.length || 0)

  // Grouper par langue
  const byLang: Record<string, typeof allCards> = {}
  allCards?.forEach(c => {
    if (!byLang[c.language]) byLang[c.language] = []
    byLang[c.language].push(c)
  })

  for (const lang of Object.keys(byLang).sort()) {
    console.log(`\n${lang.toUpperCase()}: ${byLang[lang].length} cartes`)
    // Afficher les cartes promo
    const promos = byLang[lang].filter(c => c.number.includes('P') || c.number.includes('C') || c.number.includes('/'))
    if (promos.length > 0) {
      console.log(`  Promos:`)
      promos.forEach(c => {
        const hasImage = c.image_url ? '✓' : '✗'
        console.log(`    ${hasImage} ${c.number} - ${c.name}`)
      })
    }
  }
}

main()
