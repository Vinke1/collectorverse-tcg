import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

async function checkOP07() {
  const supabase = createAdminClient()

  // Get series info
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .eq('code', 'OP07')
    .single()

  if (seriesError) {
    logger.error('Erreur série:', seriesError.message)
    return
  }

  logger.section('Série OP07')
  console.log('ID:', series.id)
  console.log('Name:', series.name)
  console.log('Code:', series.code)

  // Count cards by language
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, name, number, language, image_url')
    .eq('series_id', series.id)
    .order('number')

  if (cardsError) {
    logger.error('Erreur cartes:', cardsError.message)
    return
  }

  logger.section('Cartes')
  console.log('Total:', cards.length)

  // Group by language
  const byLang: Record<string, number> = {}
  cards.forEach(c => {
    byLang[c.language] = (byLang[c.language] || 0) + 1
  })
  console.log('Par langue:', byLang)

  // Show EN cards
  const enCards = cards.filter(c => c.language === 'EN' || c.language === 'en')
  console.log('Cards EN count:', enCards.length)
  console.log('All languages in data:', [...new Set(cards.map(c => c.language))])

  console.log('\n10 premières cartes:')
  cards.slice(0, 10).forEach(c => {
    console.log(`  ${c.number} [${c.language}]: ${c.name}`)
  })

  console.log('\n10 dernières cartes:')
  cards.slice(-10).forEach(c => {
    console.log(`  ${c.number} [${c.language}]: ${c.name}`)
  })

  // Check storage
  logger.section('Storage')
  const { data: files, error: storageError } = await supabase
    .storage
    .from('onepiece-cards')
    .list('OP07/en', { limit: 200 })

  if (storageError) {
    logger.error('Erreur storage:', storageError.message)
  } else {
    console.log('Images EN dans storage:', files.length)
    console.log('Exemples:', files.slice(0, 5).map(f => f.name))
  }
}

checkOP07()
