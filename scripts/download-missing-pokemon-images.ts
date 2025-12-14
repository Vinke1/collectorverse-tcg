/**
 * Download all missing Pokemon images
 *
 * This script:
 * 1. Analyzes all Pokemon series in the database
 * 2. Compares cards with images in Supabase storage
 * 3. Downloads missing images from TCGdex API
 * 4. Uploads them to Supabase storage
 * 5. Updates the card's image_url in the database
 *
 * Usage:
 *   npx tsx scripts/download-missing-pokemon-images.ts
 *   npx tsx scripts/download-missing-pokemon-images.ts --series swsh3
 *   npx tsx scripts/download-missing-pokemon-images.ts --dry-run
 *   npx tsx scripts/download-missing-pokemon-images.ts --limit 50
 *   npx tsx scripts/download-missing-pokemon-images.ts --continue-on-error
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { DELAYS } from '../lib/constants/app-config'
import sharp from 'sharp'
import * as fs from 'fs'

// Parse command line arguments
const args = process.argv.slice(2)
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || (args.includes('--series') ? args[args.indexOf('--series') + 1] : null)
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
  || (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null)
const dryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error')

const LIMIT = limitArg ? parseInt(limitArg) : null
const ASSETS_BASE = 'https://assets.tcgdex.net'
const API_BASE = 'https://api.tcgdex.net/v2'

interface MissingCard {
  id: string
  number: string
  name: string
  language: string
  seriesId: string
  seriesCode: string
  tcgdexId: string | null
}

interface ProgressData {
  startedAt: string
  lastUpdated: string
  totalMissing: number
  processed: number
  success: number
  errors: number
  notFound: number
  currentSeries: string
  processedCards: string[]  // card IDs that have been processed
}

const PROGRESS_FILE = 'scripts/logs/pokemon-download-progress.json'

function loadProgress(): ProgressData | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
      return data
    }
  } catch (e) {
    // Ignore
  }
  return null
}

function saveProgress(progress: ProgressData) {
  progress.lastUpdated = new Date().toISOString()
  const dir = 'scripts/logs'
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function main() {
  const supabase = createAdminClient()

  logger.section('Téléchargement des images Pokemon manquantes')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification ne sera effectuée')
  }

  if (seriesFilter) {
    logger.info(`Filtre série: ${seriesFilter}`)
  }

  if (LIMIT) {
    logger.info(`Limite: ${LIMIT} cartes`)
  }

  // 1. Get Pokemon TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'pokemon')
    .single()

  if (!tcg) {
    logger.error('TCG Pokemon non trouvé')
    process.exit(1)
  }

  // 2. Get all series
  let seriesQuery = supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)

  if (seriesFilter) {
    seriesQuery = seriesQuery.eq('code', seriesFilter.toLowerCase())
  }

  const { data: seriesList } = await seriesQuery

  if (!seriesList || seriesList.length === 0) {
    logger.error('Aucune série trouvée')
    process.exit(1)
  }

  logger.info(`${seriesList.length} série(s) à traiter`)

  // 3. Find all missing cards across all series
  logger.section('Analyse des images manquantes')

  const allMissingCards: MissingCard[] = []

  for (const series of seriesList) {
    // Get cards for this series
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, name, language, tcgdex_id')
      .eq('series_id', series.id)
      .order('number', { ascending: true })

    if (!cards || cards.length === 0) {
      logger.info(`${series.code}: 0 cartes en DB`)
      continue
    }

    // List images in storage for all languages
    const languagesInDb = [...new Set(cards.map(c => c.language))]
    const existingImagesByLang = new Map<string, Set<string>>()

    for (const lang of languagesInDb) {
      const storagePath = `${series.code}/${lang}`
      const { data: storageFiles } = await supabase.storage
        .from('pokemon-cards')
        .list(storagePath)

      const existingImages = new Set(
        (storageFiles || [])
          .filter(f => f.name.endsWith('.webp'))
          .map(f => f.name.replace('.webp', ''))
      )

      existingImagesByLang.set(lang, existingImages)
    }

    // Find missing cards
    const missingCards = cards.filter(card => {
      const langImages = existingImagesByLang.get(card.language)
      if (!langImages) return true

      const cardNumber = card.number.toString()
      return !langImages.has(cardNumber)
    })

    if (missingCards.length > 0) {
      logger.info(`${series.code}: ${missingCards.length}/${cards.length} cartes sans images`)

      for (const card of missingCards) {
        allMissingCards.push({
          id: card.id,
          number: card.number.toString(),
          name: card.name,
          language: card.language,
          seriesId: series.id,
          seriesCode: series.code,
          tcgdexId: card.tcgdex_id
        })
      }
    } else {
      logger.success(`${series.code}: Toutes les ${cards.length} cartes ont des images ✓`)
    }
  }

  if (allMissingCards.length === 0) {
    logger.success('\nToutes les cartes ont des images!')
    process.exit(0)
  }

  logger.section(`${allMissingCards.length} cartes à télécharger`)

  // Check for existing progress
  const existingProgress = loadProgress()
  const processedCardIds = new Set(existingProgress?.processedCards || [])

  // Filter out already processed cards
  const cardsToProcess = allMissingCards.filter(c => !processedCardIds.has(c.id))

  if (cardsToProcess.length < allMissingCards.length) {
    logger.info(`${allMissingCards.length - cardsToProcess.length} cartes déjà traitées (reprise)`)
  }

  // Apply limit
  const finalCardsToProcess = LIMIT ? cardsToProcess.slice(0, LIMIT) : cardsToProcess

  logger.info(`${finalCardsToProcess.length} cartes à traiter`)

  if (dryRun) {
    // Group by series for display
    const bySeries = new Map<string, MissingCard[]>()
    for (const card of finalCardsToProcess) {
      if (!bySeries.has(card.seriesCode)) {
        bySeries.set(card.seriesCode, [])
      }
      bySeries.get(card.seriesCode)!.push(card)
    }

    for (const [seriesCode, cards] of bySeries) {
      const byLang = new Map<string, number>()
      for (const card of cards) {
        byLang.set(card.language, (byLang.get(card.language) || 0) + 1)
      }

      console.log(`\n${seriesCode}: ${cards.length} cartes`)
      for (const [lang, count] of byLang) {
        console.log(`  ${lang}: ${count}`)
      }
    }

    logger.info('\nMode DRY RUN - fin du script')
    process.exit(0)
  }

  // Initialize progress
  const progress: ProgressData = {
    startedAt: existingProgress?.startedAt || new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    totalMissing: allMissingCards.length,
    processed: existingProgress?.processed || 0,
    success: existingProgress?.success || 0,
    errors: existingProgress?.errors || 0,
    notFound: existingProgress?.notFound || 0,
    currentSeries: '',
    processedCards: existingProgress?.processedCards || []
  }

  // 4. Process cards
  logger.section('Téléchargement des images')

  // Group cards by series for efficient processing
  const cardsBySeries = new Map<string, MissingCard[]>()
  for (const card of finalCardsToProcess) {
    if (!cardsBySeries.has(card.seriesCode)) {
      cardsBySeries.set(card.seriesCode, [])
    }
    cardsBySeries.get(card.seriesCode)!.push(card)
  }

  let totalProcessed = 0
  let totalSuccess = 0
  let totalErrors = 0
  let totalNotFound = 0

  try {
    for (const [seriesCode, seriesCards] of cardsBySeries) {
      logger.section(`Série ${seriesCode} - ${seriesCards.length} cartes`)
      progress.currentSeries = seriesCode

      // Process each card
      for (const card of seriesCards) {
        totalProcessed++

        logger.processing(`[${totalProcessed}/${finalCardsToProcess.length}] ${seriesCode}/${card.number} (${card.language}): ${card.name}`)

        try {
          // If tcgdex_id is missing, try to fetch card info from API
          let tcgdexId = card.tcgdexId
          if (!tcgdexId) {
            // Try to construct the ID: {setCode}-{cardNumber}
            tcgdexId = `${seriesCode}-${card.number}`
            logger.info(`  Tentative avec ID construit: ${tcgdexId}`)
          }

          // Download image from TCGdex
          const imageBaseUrl = `${ASSETS_BASE}/${card.language}/` + tcgdexId.replace('-', '/')

          // Try high quality WebP first
          let imageBuffer: Buffer | null = null
          let imageUrl = `${imageBaseUrl}/high.webp`

          const webpResponse = await fetch(imageUrl)
          if (webpResponse.ok) {
            const arrayBuffer = await webpResponse.arrayBuffer()
            imageBuffer = Buffer.from(arrayBuffer)
          } else {
            // Try PNG fallback
            imageUrl = `${imageBaseUrl}/high.png`
            const pngResponse = await fetch(imageUrl)
            if (pngResponse.ok) {
              const arrayBuffer = await pngResponse.arrayBuffer()
              imageBuffer = Buffer.from(arrayBuffer)
            } else {
              logger.warn(`  Image non trouvée (404)`)
              totalNotFound++
              progress.notFound++
              progress.processedCards.push(card.id)
              saveProgress(progress)
              await delay(DELAYS.betweenUploads)
              continue
            }
          }

          if (!imageBuffer) {
            logger.warn(`  Échec téléchargement`)
            totalErrors++
            progress.errors++
            progress.processedCards.push(card.id)
            saveProgress(progress)
            await delay(DELAYS.betweenUploads)
            continue
          }

          // Optimize with Sharp
          const optimizedImage = await sharp(imageBuffer)
            .resize(480, 672, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 85 })
            .toBuffer()

          // Upload to Supabase
          const fileName = `${seriesCode}/${card.language}/${card.number}.webp`
          const { error: uploadError } = await supabase.storage
            .from('pokemon-cards')
            .upload(fileName, optimizedImage, {
              contentType: 'image/webp',
              upsert: true
            })

          if (uploadError) {
            logger.error(`  Échec upload: ${uploadError.message}`)
            totalErrors++
            progress.errors++
            progress.processedCards.push(card.id)
            saveProgress(progress)

            if (!continueOnError) {
              throw new Error('Upload failed')
            }
            await delay(DELAYS.betweenUploads)
            continue
          }

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('pokemon-cards')
            .getPublicUrl(fileName)

          // Update database
          const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: publicUrlData.publicUrl })
            .eq('id', card.id)

          if (updateError) {
            logger.error(`  Échec mise à jour DB: ${updateError.message}`)
            totalErrors++
            progress.errors++
          } else {
            logger.success(`  ✓ OK`)
            totalSuccess++
            progress.success++
          }

          progress.processed++
          progress.processedCards.push(card.id)
          saveProgress(progress)

          await delay(DELAYS.betweenUploads)

        } catch (e: any) {
          logger.error(`  Erreur: ${e.message}`)
          totalErrors++
          progress.errors++
          progress.processedCards.push(card.id)
          saveProgress(progress)

          if (!continueOnError && e.message !== 'Upload failed') {
            throw e
          }
        }
      }
    }

  } catch (error: any) {
    logger.error(`Erreur fatale: ${error.message}`)
    console.error(error)
    process.exit(1)
  }

  // Final summary
  logger.section('Résumé final')
  console.log(`Total traité: ${totalProcessed}`)
  console.log(`Succès: ${totalSuccess}`)
  console.log(`Non trouvées: ${totalNotFound}`)
  console.log(`Erreurs: ${totalErrors}`)
  console.log(`Taux de réussite: ${((totalSuccess / totalProcessed) * 100).toFixed(1)}%`)

  if (totalSuccess > 0) {
    logger.success(`\n${totalSuccess} images téléchargées avec succès!`)
  }

  // Clean up progress file if complete
  if (totalProcessed === finalCardsToProcess.length && totalErrors === 0) {
    fs.unlinkSync(PROGRESS_FILE)
    logger.info('Fichier de progression supprimé')
  }
}

main().catch(e => {
  logger.error(`Erreur fatale: ${e.message}`)
  console.error(e)
  process.exit(1)
})
