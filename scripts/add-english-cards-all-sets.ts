/**
 * Script to add English cards for all Lorcana sets using Lorcast API
 *
 * Usage: npx tsx scripts/add-english-cards-all-sets.ts
 * Or for a specific set: npx tsx scripts/add-english-cards-all-sets.ts --set=3
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadCardImage } from '../lib/supabase/storage'
import { DELAYS } from '../lib/constants/app-config'

// Mapping: Lorcast set code → our DB series code → storage folder
const SET_MAPPINGS: Array<{
  lorcastSet: string
  dbCode: string
  storageCode: string
  name: string
  chapter: number
}> = [
  // Set 1 - First Chapter (already done, skip)
  // { lorcastSet: '1', dbCode: 'FirstChapter', storageCode: 'FC', name: 'The First Chapter', chapter: 1 },

  // Set 2 - Rise of the Floodborn (already done, skip)
  // { lorcastSet: '2', dbCode: 'Floodborn', storageCode: 'ROTF', name: 'Rise of the Floodborn', chapter: 2 },

  // Set 3 - Into the Inklands
  { lorcastSet: '3', dbCode: 'ITI', storageCode: 'ITI', name: 'Into the Inklands', chapter: 3 },

  // Set 4 - Ursula's Return
  { lorcastSet: '4', dbCode: 'URR', storageCode: 'URR', name: "Ursula's Return", chapter: 4 },

  // Set 5 - Shimmering Skies
  { lorcastSet: '5', dbCode: 'SSK', storageCode: 'SSK', name: 'Shimmering Skies', chapter: 5 },

  // Set 6 - Azurite Sea
  { lorcastSet: '6', dbCode: 'AZS', storageCode: 'AZS', name: 'Azurite Sea', chapter: 6 },

  // Set 7 - Archazia's Island
  { lorcastSet: '7', dbCode: 'ARI', storageCode: 'ARI', name: "Archazia's Island", chapter: 7 },

  // Set 8 - Reign of Jafar
  { lorcastSet: '8', dbCode: 'ROJ', storageCode: 'ROJ', name: 'Reign of Jafar', chapter: 8 },

  // Set 9 - Fabled
  { lorcastSet: '9', dbCode: 'fabuleux', storageCode: 'FAB', name: 'Fabled', chapter: 9 },

  // Set 10 - Whispers in the Well
  { lorcastSet: '10', dbCode: 'WHW', storageCode: 'WHW', name: 'Whispers in the Well', chapter: 10 },
]

interface LorcastCard {
  id: string
  collector_number: string
  name: string
  version: string | null
  image_uris: {
    digital: {
      small: string
      normal: string
      large: string
    }
  }
  rarity: string
  ink?: string
  cost?: number
  type?: string[]
}

interface LorcastResponse {
  results: LorcastCard[]
}

function mapRarity(lorcastRarity: string): string {
  const rarityMap: Record<string, string> = {
    'Common': 'Common',
    'Uncommon': 'Uncommon',
    'Rare': 'Rare',
    'Super_rare': 'Super Rare',
    'Legendary': 'Legendary',
    'Enchanted': 'Enchanted',
    'Promo': 'Promo'
  }
  return rarityMap[lorcastRarity] || lorcastRarity
}

function formatCardName(name: string, version: string | null): string {
  if (version) {
    return `${name} - ${version}`
  }
  return name
}

async function fetchAllCardsFromLorcast(setCode: string): Promise<LorcastCard[]> {
  const allCards: LorcastCard[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://api.lorcast.com/v0/cards/search?q=set:${setCode}&page=${page}`
    logger.processing(`  Page ${page}...`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Lorcast API error: ${response.statusText}`)
    }

    const data: LorcastResponse = await response.json()

    if (data.results && data.results.length > 0) {
      allCards.push(...data.results)
      hasMore = data.results.length === 100
      page++

      if (hasMore) {
        await delay(500)
      }
    } else {
      hasMore = false
    }
  }

  return allCards
}

async function processSet(
  supabase: ReturnType<typeof createAdminClient>,
  lorcanaGameId: string,
  setConfig: typeof SET_MAPPINGS[0]
) {
  logger.section(`Processing: ${setConfig.name} (set ${setConfig.lorcastSet})`)

  // Get series ID
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', lorcanaGameId)
    .eq('code', setConfig.dbCode)
    .single()

  if (seriesError || !series) {
    logger.error(`Series "${setConfig.dbCode}" not found, skipping...`)
    return { inserted: 0, updated: 0, errors: 0, skipped: true }
  }

  const seriesData = series as { id: string; code: string; name: string }
  logger.success(`Found series: ${seriesData.name}`)

  // Check existing EN cards
  const { data: existingEnCards } = await supabase
    .from('cards')
    .select('id, number')
    .eq('series_id', seriesData.id)
    .eq('language', 'EN')

  const existingNumbers = new Set(existingEnCards?.map(c => c.number) || [])
  logger.info(`Existing EN cards: ${existingNumbers.size}`)

  // Fetch from Lorcast
  logger.processing(`Fetching from Lorcast API...`)
  const lorcastCards = await fetchAllCardsFromLorcast(setConfig.lorcastSet)
  logger.success(`Fetched ${lorcastCards.length} cards`)

  // Process cards
  let insertedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const lorcastCard of lorcastCards) {
    const cardNumber = lorcastCard.collector_number
    const cardName = formatCardName(lorcastCard.name, lorcastCard.version)
    const imageUrl = lorcastCard.image_uris.digital.large

    try {
      // Upload image
      const storageFileName = `en-${cardNumber}`
      const uploadResult = await uploadCardImage(
        imageUrl,
        storageFileName,
        setConfig.storageCode
      )

      if (!uploadResult.success || !uploadResult.url) {
        logger.error(`  #${cardNumber}: Upload failed`)
        errorCount++
        continue
      }

      // Prepare card data
      const cardData = {
        series_id: seriesData.id,
        name: cardName,
        number: cardNumber,
        language: 'EN',
        chapter: setConfig.chapter,
        rarity: mapRarity(lorcastCard.rarity),
        image_url: uploadResult.url,
        attributes: {
          ink: lorcastCard.ink || null,
          cost: lorcastCard.cost || null,
          type: lorcastCard.type || null
        }
      }

      // Upsert
      const { error: upsertError } = await supabase
        .from('cards')
        .upsert(cardData, { onConflict: 'series_id,number,language' })

      if (upsertError) {
        logger.error(`  #${cardNumber}: DB error - ${upsertError.message}`)
        errorCount++
      } else if (existingNumbers.has(cardNumber)) {
        updatedCount++
      } else {
        insertedCount++
      }

      // Rate limiting
      await delay(DELAYS.betweenUploads)

    } catch (err) {
      logger.error(`  #${cardNumber}: ${err}`)
      errorCount++
    }
  }

  logger.success(`${setConfig.name}: +${insertedCount} inserted, ${updatedCount} updated, ${errorCount} errors`)

  return { inserted: insertedCount, updated: updatedCount, errors: errorCount, skipped: false }
}

async function main() {
  // Check for specific set argument
  const args = process.argv.slice(2)
  const setArg = args.find(a => a.startsWith('--set='))
  const specificSet = setArg ? setArg.split('=')[1] : null

  logger.section('Adding English cards for Lorcana sets')

  const supabase = createAdminClient()

  // Get Lorcana game ID
  const { data: lorcanaGame, error: gameError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'lorcana')
    .single()

  if (gameError || !lorcanaGame) {
    throw new Error('Lorcana game not found')
  }

  // Filter sets if specific one requested
  const setsToProcess = specificSet
    ? SET_MAPPINGS.filter(s => s.lorcastSet === specificSet)
    : SET_MAPPINGS

  if (setsToProcess.length === 0) {
    logger.error(`No sets found for code: ${specificSet}`)
    process.exit(1)
  }

  // Process each set
  const results: Array<{ name: string; inserted: number; updated: number; errors: number }> = []

  for (const setConfig of setsToProcess) {
    const result = await processSet(supabase, lorcanaGame.id, setConfig)
    if (!result.skipped) {
      results.push({
        name: setConfig.name,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors
      })
    }

    // Delay between sets
    if (setsToProcess.indexOf(setConfig) < setsToProcess.length - 1) {
      logger.info('Waiting before next set...')
      await delay(DELAYS.betweenSeries)
    }
  }

  // Final summary
  logger.section('FINAL SUMMARY')
  let totalInserted = 0
  let totalUpdated = 0
  let totalErrors = 0

  for (const r of results) {
    console.log(`  ${r.name}: +${r.inserted} / ~${r.updated} / ✗${r.errors}`)
    totalInserted += r.inserted
    totalUpdated += r.updated
    totalErrors += r.errors
  }

  console.log('─'.repeat(50))
  logger.success(`TOTAL: ${totalInserted} inserted, ${totalUpdated} updated, ${totalErrors} errors`)
}

main().catch(err => {
  logger.error(`Fatal: ${err}`)
  process.exit(1)
})
