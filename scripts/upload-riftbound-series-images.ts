/**
 * Upload Riftbound Set Images to Supabase Storage
 *
 * This script uploads the Riftbound set images from public/image/ to Supabase Storage
 * and updates the series.image_url field in the database.
 *
 * Usage:
 *   npx tsx scripts/upload-riftbound-series-images.ts [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'

// ============================================
// Configuration
// ============================================

// Banner dimensions - wide format (ratio ~2.36:1)
const BANNER_DIMENSIONS = {
  width: 1200,
  quality: 90
}

const CONFIG = {
  bucket: 'riftbound-cards',
  storagePath: 'series',
  delayBetweenUploads: 500
}

// Mapping of series codes to local image files
const RIFTBOUND_SERIES = [
  { code: 'OGN', localPath: 'public/image/origin.png', name: 'Origins' },
  { code: 'OGS', localPath: 'public/image/Proving.png', name: 'Proving Grounds' },
  { code: 'SFD', localPath: 'public/image/spirit.png', name: 'Spiritforged' },
]

// ============================================
// Image Processing
// ============================================

async function optimizeImage(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .resize(BANNER_DIMENSIONS.width, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: BANNER_DIMENSIONS.quality })
    .toBuffer()
}

// ============================================
// Supabase Operations
// ============================================

async function uploadToStorage(
  supabase: ReturnType<typeof createAdminClient>,
  buffer: Buffer,
  setId: string
): Promise<string> {
  const storagePath = `${CONFIG.storagePath}/${setId}.webp`

  // Delete existing file if present
  await supabase.storage.from(CONFIG.bucket).remove([storagePath])

  // Upload new file
  const { error } = await supabase.storage
    .from(CONFIG.bucket)
    .upload(storagePath, buffer, {
      contentType: 'image/webp',
      upsert: true
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(CONFIG.bucket)
    .getPublicUrl(storagePath)

  return urlData.publicUrl
}

async function updateSeriesImageUrl(
  supabase: ReturnType<typeof createAdminClient>,
  code: string,
  imageUrl: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('series')
    .update({ image_url: imageUrl })
    .eq('code', code)
    .select('id, name')

  if (error) {
    logger.error(`Database update failed for ${code}: ${error.message}`)
    return false
  }

  if (data && data.length > 0) {
    logger.info(`  → Matched series: ${data[0].name}`)
    return true
  }

  logger.warn(`No series found with code: ${code}`)
  return false
}

// ============================================
// Main Logic
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  logger.section('Riftbound Set Image Uploader')
  console.log('')

  logger.info(`Series to upload: ${RIFTBOUND_SERIES.length}`)
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  if (dryRun) {
    logger.warn('DRY RUN - Showing what would be uploaded:')
    console.log('')
    RIFTBOUND_SERIES.forEach(series => {
      const exists = fs.existsSync(series.localPath)
      console.log(`   → ${series.code}: ${series.localPath} ${exists ? '✓' : '✗ NOT FOUND'}`)
    })
    return
  }

  // Initialize Supabase client
  const supabase = createAdminClient()

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === CONFIG.bucket)

  if (!bucketExists) {
    logger.info(`Creating bucket: ${CONFIG.bucket}`)
    const { error: createError } = await supabase.storage.createBucket(CONFIG.bucket, {
      public: true
    })
    if (createError) {
      logger.error(`Failed to create bucket: ${createError.message}`)
      process.exit(1)
    }
  }

  let successCount = 0
  let failCount = 0

  // Process each series
  for (let i = 0; i < RIFTBOUND_SERIES.length; i++) {
    const series = RIFTBOUND_SERIES[i]

    logger.processing(`[${i + 1}/${RIFTBOUND_SERIES.length}] ${series.code} - ${series.name}`)

    // Check if local file exists
    if (!fs.existsSync(series.localPath)) {
      logger.error(`File not found: ${series.localPath}`)
      failCount++
      continue
    }

    try {
      // Optimize image
      const optimizedBuffer = await optimizeImage(series.localPath)

      // Upload to storage
      const imageUrl = await uploadToStorage(supabase, optimizedBuffer, series.code)

      // Update database
      const updated = await updateSeriesImageUrl(supabase, series.code, imageUrl)

      if (updated) {
        logger.success(`Uploaded and linked: ${series.code}`)
        successCount++
      } else {
        logger.warn(`Uploaded but no series found: ${series.code}`)
        successCount++
      }

    } catch (error) {
      logger.error(`Failed: ${series.code} - ${error instanceof Error ? error.message : error}`)
      failCount++
    }

    // Delay between uploads
    if (i < RIFTBOUND_SERIES.length - 1) {
      await delay(CONFIG.delayBetweenUploads)
    }
  }

  // Final summary
  console.log('')
  logger.section('Upload Summary')
  logger.success(`Uploaded: ${successCount}`)
  if (failCount > 0) {
    logger.error(`Failed: ${failCount}`)
  }
}

// Run the script
main().catch(error => {
  logger.error(`Fatal error: ${error}`)
  process.exit(1)
})
