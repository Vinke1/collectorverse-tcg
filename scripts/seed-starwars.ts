/**
 * Star Wars Unlimited Card Scraper
 *
 * Usage:
 *   npx tsx scripts/seed-starwars.ts --series SOR --lang fr
 *   npx tsx scripts/seed-starwars.ts --series SOR --lang all
 *   npx tsx scripts/seed-starwars.ts --series SOR --lang fr --skip-images
 *
 * This script:
 * 1. Scrapes card data from swucards.fr
 * 2. Downloads and optimizes card images
 * 3. Uploads images to Supabase Storage
 * 4. Inserts card data into the database
 */

import puppeteer from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import {
  getSeriesByCode,
  STARWARS_LANGUAGES,
  isSeriesAvailableInLanguage,
  type StarWarsLanguage,
  type StarWarsSeriesConfig
} from './config/starwars-series'
import {
  extractCardUrls,
  extractCardData,
  buildStoragePath,
  type StarWarsCardData
} from './lib/starwars-parser'
import { uploadStarWarsCardImage } from '../lib/supabase/storage'
import { DELAYS } from '../lib/constants/app-config'

// Parse command line arguments
const args = process.argv.slice(2)
const seriesArg = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || args[args.indexOf('--series') + 1]
const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
  || args[args.indexOf('--lang') + 1]
  || 'fr'
const skipImages = args.includes('--skip-images')
const dryRun = args.includes('--dry-run')

if (!seriesArg) {
  console.error('Usage: npx tsx scripts/seed-starwars.ts --series <CODE> --lang <fr|en|all> [--skip-images] [--dry-run]')
  console.error('Example: npx tsx scripts/seed-starwars.ts --series SOR --lang fr')
  process.exit(1)
}

const BASE_URL = 'https://www.swucards.fr'

async function main() {
  logger.section(`Star Wars Unlimited Scraper - ${seriesArg}`)

  const seriesConfig = getSeriesByCode(seriesArg)
  if (!seriesConfig) {
    logger.error(`Series not found: ${seriesArg}`)
    logger.info('Available series: SOR, SHD, TWI, JTL, LOF, SEC, WSOR, WSHD, WTWI, WJTL, WLOF, OP')
    process.exit(1)
  }

  logger.info(`Series: ${seriesConfig.name} (${seriesConfig.nameFr})`)
  logger.info(`Code: ${seriesConfig.code}`)
  logger.info(`Expected cards: ~${seriesConfig.cardCount || 'Unknown'}`)

  // Determine languages to process
  const languages: StarWarsLanguage[] = langArg === 'all'
    ? STARWARS_LANGUAGES.map(l => l.code)
    : [langArg as StarWarsLanguage]

  logger.info(`Languages: ${languages.join(', ')}`)
  logger.info(`Skip images: ${skipImages}`)
  logger.info(`Dry run: ${dryRun}`)

  // Initialize Supabase
  const supabase = createAdminClient()

  // Get TCG ID
  const { data: tcg, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'starwars')
    .single()

  if (tcgError || !tcg) {
    logger.error('Star Wars TCG not found. Run migration 023_add_starwars_tables.sql first.')
    process.exit(1)
  }

  logger.success(`TCG ID: ${tcg.id}`)

  // Create or get series
  const seriesId = await upsertSeries(supabase, tcg.id, seriesConfig)
  logger.success(`Series ID: ${seriesId}`)

  // Launch browser
  logger.info('\nLaunching browser...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (const lang of languages) {
      if (!isSeriesAvailableInLanguage(seriesConfig.code, lang)) {
        logger.warn(`Series ${seriesConfig.code} not available in ${lang}, skipping...`)
        continue
      }

      await processSeriesLanguage(browser, supabase, seriesId, seriesConfig, lang)
      await delay(DELAYS.betweenSeries)
    }

    logger.section('Scraping Complete!')

  } finally {
    await browser.close()
  }
}

async function upsertSeries(
  supabase: ReturnType<typeof createAdminClient>,
  tcgGameId: string,
  config: StarWarsSeriesConfig
): Promise<string> {
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('tcg_game_id', tcgGameId)
    .eq('code', config.code)
    .single()

  if (existing) {
    return existing.id
  }

  const { data, error } = await supabase
    .from('series')
    .insert({
      tcg_game_id: tcgGameId,
      name: config.nameFr,
      code: config.code,
      release_date: config.releaseDate,
      max_set_base: config.cardCount || 0,
      master_set: config.cardCount || 0
    })
    .select('id')
    .single()

  if (error) {
    logger.error(`Failed to create series: ${error.message}`)
    process.exit(1)
  }

  return data.id
}

async function processSeriesLanguage(
  browser: puppeteer.Browser,
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  config: StarWarsSeriesConfig,
  language: StarWarsLanguage
) {
  logger.section(`Processing ${config.code} - ${language.toUpperCase()}`)

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  try {
    // Build series URL with language filter
    const seriesUrl = language === 'fr'
      ? `${BASE_URL}/series/${config.slug}`
      : `${BASE_URL}/series/${config.slug}?lang=${language}`

    logger.info(`Series URL: ${seriesUrl}`)

    // Extract all card URLs from series page
    logger.processing('Extracting card URLs...')
    const allCardUrls = await extractCardUrls(page, seriesUrl)
    logger.success(`Found ${allCardUrls.length} total card URLs`)

    // We'll process all cards and filter by language after extracting data
    const langCardUrls = allCardUrls

    if (langCardUrls.length === 0) {
      logger.warn('No cards found')
      return
    }

    // Process each card and filter by language
    const cards: StarWarsCardData[] = []
    let processed = 0
    let errors = 0
    let skipped = 0

    for (const cardUrl of langCardUrls) {
      try {
        logger.progress(`[${processed + 1}/${langCardUrls.length}] Processing card...`)

        const cardData = await extractCardData(page, cardUrl)

        if (cardData) {
          // Filter by requested language
          if (cardData.language.toLowerCase() === language.toLowerCase()) {
            cards.push(cardData)
            logger.success(`  ✓ ${cardData.name} (${cardData.number}) [${cardData.language}]`)
          } else {
            skipped++
            // Skip cards in other languages silently
          }
        } else {
          logger.warn(`  ✗ Failed to extract: ${cardUrl}`)
          errors++
        }

        processed++
        await delay(DELAYS.betweenPages)

      } catch (e) {
        logger.error(`  ✗ Error processing: ${cardUrl}`)
        errors++
        processed++
      }
    }

    logger.info(`\nExtracted ${cards.length} cards in ${language.toUpperCase()} (${skipped} other languages, ${errors} errors)`)

    if (dryRun) {
      logger.info('Dry run - skipping database operations')
      logger.info('Sample card data:')
      if (cards.length > 0) {
        console.log(JSON.stringify(cards[0], null, 2))
      }
      return
    }

    // Upload images and insert cards
    logger.processing('\nUploading images and inserting cards...')

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      logger.progress(`[${i + 1}/${cards.length}] ${card.name}`)

      let imageUrl = card.imageUrl

      // Upload image to Supabase Storage
      if (!skipImages && card.imageUrl) {
        try {
          const result = await uploadStarWarsCardImage(
            card.imageUrl,
            card.number,
            config.code,
            language
          )

          if (result.success && result.url) {
            imageUrl = result.url
          }
        } catch (e) {
          logger.warn(`  Image upload failed, using original URL`)
        }
      }

      // Insert card into database
      await upsertCard(supabase, seriesId, card, imageUrl, language)
      await delay(DELAYS.betweenUploads)
    }

    logger.success(`\nCompleted ${config.code} (${language.toUpperCase()}): ${cards.length} cards`)

  } finally {
    await page.close()
  }
}

async function upsertCard(
  supabase: ReturnType<typeof createAdminClient>,
  seriesId: string,
  card: StarWarsCardData,
  imageUrl: string,
  language: string
) {
  const attributes = {
    cardType: card.cardType,
    arenas: card.arenas,
    aspects: card.aspects,
    characters: card.characters,
    traits: card.traits,
    cost: card.cost,
    power: card.power,
    hp: card.hp,
    illustrator: card.illustrator,
    publicCode: `${card.seriesCode}•${language.toUpperCase()} - ${card.number}/${card.totalInSet} - ${card.rarity.toUpperCase()}`,
    slug: card.slug
  }

  const { error } = await supabase
    .from('cards')
    .upsert({
      series_id: seriesId,
      name: card.name,
      number: card.number,
      language: language.toUpperCase(),
      rarity: card.rarity,
      image_url: imageUrl,
      attributes
    }, {
      onConflict: 'series_id,number,language'
    })

  if (error) {
    logger.error(`Failed to insert card ${card.number}: ${error.message}`)
  }
}

main().catch(e => {
  logger.error(`Fatal error: ${e.message}`)
  process.exit(1)
})
