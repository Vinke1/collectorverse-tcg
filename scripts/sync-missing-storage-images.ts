/**
 * Sync missing storage images
 *
 * This script downloads images from existing image_url values
 * and uploads them to Supabase storage.
 *
 * Usage:
 *   npx tsx scripts/sync-missing-storage-images.ts --dry-run
 *   npx tsx scripts/sync-missing-storage-images.ts --series ST16
 *   npx tsx scripts/sync-missing-storage-images.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'

const supabase = createAdminClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]
  || (args.includes('--series') ? args[args.indexOf('--series') + 1] : null)
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const limit = limitArg ? parseInt(limitArg) : null

interface CardToSync {
  id: string
  number: string
  name: string
  seriesCode: string
  imageUrl: string
}

async function downloadAndOptimize(imageUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.opecards.fr/',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimize with Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    return optimized
  } catch (error) {
    logger.error(`Erreur téléchargement: ${(error as Error).message}`)
    return null
  }
}

async function uploadToStorage(
  seriesCode: string,
  cardNumber: string,
  imageBuffer: Buffer,
  language: string = 'fr'
): Promise<string | null> {
  const paddedNumber = cardNumber.padStart(3, '0')
  const storagePath = `${seriesCode}/${language}/${paddedNumber}.webp`

  const { error } = await supabase.storage
    .from('onepiece-cards')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/webp',
      upsert: true
    })

  if (error) {
    logger.error(`Erreur upload: ${error.message}`)
    return null
  }

  return storagePath
}

async function findCardsToSync(): Promise<CardToSync[]> {
  const targetSeries = seriesFilter
    ? [seriesFilter.toUpperCase()]
    : ['ST15', 'ST16', 'ST17', 'ST18', 'ST19', 'ST20', 'P', 'STP']

  const cardsToSync: CardToSync[] = []

  // Get One Piece TCG ID
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    return []
  }

  for (const code of targetSeries) {
    const { data: series } = await supabase
      .from('series')
      .select('id, code')
      .eq('code', code)
      .eq('tcg_game_id', tcg.id)
      .single()

    if (!series) continue

    // Get all cards with image_url
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, name, image_url')
      .eq('series_id', series.id)
      .eq('language', 'FR')
      .not('image_url', 'is', null)
      .order('number')

    if (!cards?.length) continue

    // Check storage
    const storagePath = `${code}/fr`
    const { data: storageFiles } = await supabase.storage
      .from('onepiece-cards')
      .list(storagePath)

    const existingImages = new Set(
      (storageFiles || [])
        .filter(f => f.name.endsWith('.webp'))
        .map(f => f.name.replace('.webp', ''))
    )

    // Find cards missing from storage
    const missingCards = cards.filter(card => {
      const paddedNumber = card.number.toString().padStart(3, '0')
      return !existingImages.has(paddedNumber) && !existingImages.has(card.number.toString())
    })

    if (missingCards.length > 0) {
      logger.info(`${code}: ${missingCards.length} cartes à synchroniser`)

      for (const card of missingCards) {
        // Only sync if image_url is an external URL (not already in our storage)
        if (!card.image_url.includes('supabase.co/storage') || !card.image_url.includes('/onepiece-cards/')) {
          cardsToSync.push({
            id: card.id,
            number: card.number,
            name: card.name,
            seriesCode: code,
            imageUrl: card.image_url,
          })
        }
      }
    }
  }

  return cardsToSync
}

async function main() {
  logger.section('Synchronisation des images manquantes dans le storage')

  if (dryRun) {
    logger.warn('Mode DRY RUN - aucune modification')
  }

  const cardsToSync = await findCardsToSync()

  if (cardsToSync.length === 0) {
    logger.success('Aucune carte à synchroniser')
    return
  }

  logger.info(`${cardsToSync.length} cartes à synchroniser`)

  if (dryRun) {
    for (const card of cardsToSync.slice(0, 20)) {
      logger.info(`  ${card.seriesCode} #${card.number}: ${card.name}`)
      logger.info(`    URL: ${card.imageUrl.substring(0, 70)}...`)
    }
    if (cardsToSync.length > 20) {
      logger.info(`  ... et ${cardsToSync.length - 20} de plus`)
    }
    return
  }

  let success = 0
  let errors = 0
  const cardsToProcess = limit ? cardsToSync.slice(0, limit) : cardsToSync

  for (let i = 0; i < cardsToProcess.length; i++) {
    const card = cardsToProcess[i]
    logger.info(`[${i + 1}/${cardsToProcess.length}] ${card.seriesCode} #${card.number}: ${card.name}`)

    try {
      // Download and optimize
      const imageBuffer = await downloadAndOptimize(card.imageUrl)

      if (!imageBuffer) {
        errors++
        continue
      }

      // Upload to storage
      const storagePath = await uploadToStorage(card.seriesCode, card.number, imageBuffer)

      if (!storagePath) {
        errors++
        continue
      }

      logger.success(`  Uploadé: ${storagePath}`)
      success++

      // Small delay to avoid rate limiting
      await delay(500)
    } catch (error) {
      logger.error(`  Erreur: ${(error as Error).message}`)
      errors++
    }
  }

  logger.section('Résumé')
  logger.info(`Succès: ${success}`)
  logger.info(`Erreurs: ${errors}`)
  logger.info(`Taux: ${((success / cardsToProcess.length) * 100).toFixed(1)}%`)
}

main().catch(console.error)
