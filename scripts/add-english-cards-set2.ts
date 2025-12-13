/**
 * Script to add English cards for "Rise of the Floodborn" (Set 2) using Lorcast API
 *
 * This script:
 * 1. Fetches all cards from Lorcast API for set 2
 * 2. Creates EN versions in the database with English names
 * 3. Downloads images from Lorcast and uploads to Supabase Storage
 *
 * Usage: npx tsx scripts/add-english-cards-set2.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { uploadCardImage } from '../lib/supabase/storage'
import { DELAYS } from '../lib/constants/app-config'

// Configuration
const LORCAST_SET_ID = '2' // Rise of the Floodborn
const SERIES_CODE = 'Floodborn' // Code in our DB (L'Ascension Des Floodborn)
const STORAGE_SERIES_CODE = 'ROTF' // Folder name in storage (Rise of the Floodborn)
const LANGUAGE = 'EN'

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
  has_more?: boolean
  total?: number
}

// Map Lorcast rarity to our rarity format
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

// Format card name with version
function formatCardName(name: string, version: string | null): string {
  if (version) {
    return `${name} - ${version}`
  }
  return name
}

async function fetchAllCardsFromLorcast(): Promise<LorcastCard[]> {
  logger.section('Fetching cards from Lorcast API')

  const allCards: LorcastCard[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://api.lorcast.com/v0/cards/search?q=set:${LORCAST_SET_ID}&page=${page}`
    logger.processing(`Fetching page ${page}...`)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Lorcast API error: ${response.statusText}`)
    }

    const data: LorcastResponse = await response.json()

    if (data.results && data.results.length > 0) {
      allCards.push(...data.results)
      logger.info(`  Got ${data.results.length} cards (total: ${allCards.length})`)

      // Check if there are more pages
      hasMore = data.results.length === 100 // Lorcast returns 100 per page
      page++

      if (hasMore) {
        await delay(500) // Be nice to the API
      }
    } else {
      hasMore = false
    }
  }

  logger.success(`Fetched ${allCards.length} cards from Lorcast`)
  return allCards
}

async function main() {
  logger.section('Adding English cards for Rise of the Floodborn (Set 2)')

  const supabase = createAdminClient()

  try {
    // 1. Get Lorcana game ID
    const { data: lorcanaGame, error: gameError } = await supabase
      .from('tcg_games')
      .select('id')
      .eq('slug', 'lorcana')
      .single()

    if (gameError || !lorcanaGame) {
      throw new Error('Lorcana game not found in database')
    }
    logger.success(`Found Lorcana game: ${lorcanaGame.id}`)

    // 2. Get series ID for set 2
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select('id, code, name')
      .eq('tcg_game_id', lorcanaGame.id)
      .eq('code', SERIES_CODE)
      .single()

    if (seriesError || !series) {
      throw new Error(`Series with code "${SERIES_CODE}" not found`)
    }
    logger.success(`Found series: ${series.name} (${series.id})`)

    // 3. Check if EN cards already exist
    const { data: existingEnCards, error: checkError } = await supabase
      .from('cards')
      .select('id, number')
      .eq('series_id', series.id)
      .eq('language', LANGUAGE)

    if (checkError) {
      throw new Error(`Error checking existing cards: ${checkError.message}`)
    }

    const existingNumbers = new Set(existingEnCards?.map(c => c.number) || [])
    logger.info(`Found ${existingNumbers.size} existing EN cards`)

    // 4. Fetch all cards from Lorcast
    const lorcastCards = await fetchAllCardsFromLorcast()

    // 5. Process each card
    logger.section('Processing cards')

    let insertedCount = 0
    let updatedCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const lorcastCard of lorcastCards) {
      const cardNumber = lorcastCard.collector_number
      const cardName = formatCardName(lorcastCard.name, lorcastCard.version)
      const imageUrl = lorcastCard.image_uris.digital.large

      logger.processing(`Card ${cardNumber}: ${cardName}`)

      try {
        // Upload image to Supabase Storage
        const storageFileName = `en-${cardNumber}`
        const uploadResult = await uploadCardImage(
          imageUrl,
          storageFileName,
          STORAGE_SERIES_CODE
        )

        if (!uploadResult.success || !uploadResult.url) {
          logger.error(`  Failed to upload image: ${uploadResult.error}`)
          errorCount++
          continue
        }

        // Prepare card data
        const cardData = {
          series_id: series.id,
          name: cardName,
          number: cardNumber,
          language: LANGUAGE,
          chapter: 2, // Rise of the Floodborn is chapter 2
          rarity: mapRarity(lorcastCard.rarity),
          image_url: uploadResult.url,
          attributes: {
            ink: lorcastCard.ink || null,
            cost: lorcastCard.cost || null,
            type: lorcastCard.type || null
          }
        }

        // Insert or update card
        const { error: upsertError } = await supabase
          .from('cards')
          .upsert(cardData, {
            onConflict: 'series_id,number,language'
          })

        if (upsertError) {
          logger.error(`  DB error: ${upsertError.message}`)
          errorCount++
        } else if (existingNumbers.has(cardNumber)) {
          logger.info(`  Updated`)
          updatedCount++
        } else {
          logger.success(`  Inserted`)
          insertedCount++
        }

        // Rate limiting
        await delay(DELAYS.betweenUploads)

      } catch (err) {
        logger.error(`  Error: ${err}`)
        errorCount++
      }
    }

    // Summary
    logger.section('Summary')
    logger.success(`Inserted: ${insertedCount} cards`)
    logger.info(`Updated: ${updatedCount} cards`)
    logger.warn(`Errors: ${errorCount} cards`)
    logger.info(`Skipped: ${skippedCount} cards`)

  } catch (error) {
    logger.error(`Fatal error: ${error}`)
    process.exit(1)
  }
}

main()
