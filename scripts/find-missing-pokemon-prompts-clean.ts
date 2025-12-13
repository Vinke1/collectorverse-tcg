import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { POKEMON_SET_PROMPTS } from './data/pokemon-set-prompts'

interface SeriesWithGames {
  id: string
  name: string
  code: string | null
  tcgdex_id: string | null
  tcg_games: {
    slug: string
  }
}

async function findMissingPrompts() {
  logger.section('Finding Pokemon series without prompts')

  // Get all prompt IDs from the file
  const promptIds = new Set(POKEMON_SET_PROMPTS.map(p => p.id))
  logger.info(`Found ${promptIds.size} prompts in pokemon-set-prompts.ts`)

  // Query database for all Pokemon series
  const supabase = createAdminClient()

  const { data: series, error } = await supabase
    .from('series')
    .select('id, name, code, tcgdex_id, tcg_games!inner(slug)')
    .eq('tcg_games.slug', 'pokemon')
    .order('tcgdex_id')

  if (error) {
    logger.error('Failed to fetch Pokemon series from database')
    console.error(error)
    process.exit(1)
  }

  if (!series || series.length === 0) {
    logger.warn('No Pokemon series found in database')
    process.exit(0)
  }

  logger.success(`Found ${series.length} Pokemon series in database`)

  // Find series without prompts
  const missingSeries = (series as SeriesWithGames[]).filter(s => {
    // Check if tcgdex_id exists in prompts
    if (s.tcgdex_id && promptIds.has(s.tcgdex_id)) {
      return false
    }
    // Also check if code exists in prompts (some might use code instead)
    if (s.code && promptIds.has(s.code)) {
      return false
    }
    return true
  })

  if (missingSeries.length === 0) {
    logger.success('All Pokemon series have prompts!')
    process.exit(0)
  }

  // Output missing series in a clean format
  logger.warn(`\nFound ${missingSeries.length} series WITHOUT prompts:\n`)

  console.log('ID | TCGdex ID | Name')
  console.log('---|-----------|-----')

  missingSeries.forEach(s => {
    const id = s.tcgdex_id || s.code || 'N/A'
    console.log(`${id.padEnd(20)} | ${s.name}`)
  })

  // Group by type for easier analysis
  console.log('\n\nGROUPED BY TYPE:')
  console.log('================\n')

  const groups: { [key: string]: typeof missingSeries } = {
    'Trainer Kits': [],
    'POP Series': [],
    'McDonald\'s Collections': [],
    'Pocket Expansion': [],
    'Miscellaneous': []
  }

  missingSeries.forEach(s => {
    if (s.name.includes('trainer Kit') || s.name.includes('Trainer Kit')) {
      groups['Trainer Kits'].push(s)
    } else if (s.name.includes('POP Series')) {
      groups['POP Series'].push(s)
    } else if (s.name.includes('Macdonald') || s.name.includes('McDonald')) {
      groups['McDonald\'s Collections'].push(s)
    } else if (s.tcgdex_id?.startsWith('A') || s.tcgdex_id?.startsWith('B')) {
      groups['Pocket Expansion'].push(s)
    } else {
      groups['Miscellaneous'].push(s)
    }
  })

  for (const [groupName, items] of Object.entries(groups)) {
    if (items.length > 0) {
      console.log(`${groupName} (${items.length}):`)
      items.forEach(s => {
        const id = s.tcgdex_id || s.code || 'N/A'
        console.log(`  - ${id}: ${s.name}`)
      })
      console.log('')
    }
  }

  // Also show statistics
  const seriesWithPrompts = (series as SeriesWithGames[]).filter(s => {
    if (s.tcgdex_id && promptIds.has(s.tcgdex_id)) {
      return true
    }
    if (s.code && promptIds.has(s.code)) {
      return true
    }
    return false
  })

  console.log('\nSTATISTICS:')
  console.log('===========')
  console.log(`Total Pokemon series in database: ${series.length}`)
  console.log(`Series WITH prompts: ${seriesWithPrompts.length}`)
  console.log(`Series WITHOUT prompts: ${missingSeries.length}`)
  console.log(`Coverage: ${((seriesWithPrompts.length / series.length) * 100).toFixed(1)}%`)
}

findMissingPrompts()
