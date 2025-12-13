/**
 * Upload Pokemon TCG Set Images to Supabase Storage
 *
 * This script uploads the generated Pokemon set images to Supabase Storage
 * and updates the series.image_url field in the database.
 *
 * Usage:
 *   npx tsx scripts/upload-pokemon-series-images.ts [--dry-run]
 *
 * Prerequisites:
 *   - Images must be generated in scripts/output/pokemon-images/
 *   - Environment variables SUPABASE_SERVICE_ROLE_KEY must be set
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { SERIES_DIMENSIONS } from '../lib/constants/app-config'

// ============================================
// Configuration
// ============================================

const CONFIG = {
  inputDir: 'scripts/output/pokemon-images',
  bucket: 'pokemon-cards',
  storagePath: 'series', // Images will be stored as series/{setId}.webp
  delayBetweenUploads: 500, // ms
  progressFile: 'scripts/output/pokemon-upload-progress.json'
}

// ============================================
// Types
// ============================================

interface Progress {
  uploaded: string[]
  failed: string[]
  lastRun: string
}

// ============================================
// Utility Functions
// ============================================

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      const data = fs.readFileSync(CONFIG.progressFile, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    logger.warn('Could not load progress file, starting fresh')
  }
  return { uploaded: [], failed: [], lastRun: '' }
}

function saveProgress(progress: Progress): void {
  const dir = path.dirname(CONFIG.progressFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  progress.lastRun = new Date().toISOString()
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2))
}

// ============================================
// Image Processing
// ============================================

async function optimizeImage(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .resize(SERIES_DIMENSIONS.width, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: SERIES_DIMENSIONS.quality })
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
  setId: string,
  imageUrl: string
): Promise<boolean> {
  // Try to find the series by code (tcgdex_id)
  const { data, error } = await supabase
    .from('series')
    .update({ image_url: imageUrl })
    .eq('tcgdex_id', setId)
    .select('id')

  if (error) {
    logger.error(`Database update failed for ${setId}: ${error.message}`)
    return false
  }

  if (!data || data.length === 0) {
    // Try alternate ID formats
    const alternateIds = [
      setId,
      setId.toLowerCase(),
      setId.toUpperCase(),
      setId.replace('.', ''),
      setId.replace('-', '')
    ]

    for (const altId of alternateIds) {
      const { data: altData } = await supabase
        .from('series')
        .update({ image_url: imageUrl })
        .eq('code', altId)
        .select('id')

      if (altData && altData.length > 0) {
        return true
      }
    }

    logger.warn(`No series found with tcgdex_id or code: ${setId}`)
    return false
  }

  return true
}

// ============================================
// Main Logic
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  logger.section('Pokemon TCG Set Image Uploader')
  console.log('')

  // Check input directory exists
  if (!fs.existsSync(CONFIG.inputDir)) {
    logger.error(`Input directory not found: ${CONFIG.inputDir}`)
    logger.info('Run generate-pokemon-images.ts first to generate images')
    process.exit(1)
  }

  // Get list of images to upload
  const imageFiles = fs
    .readdirSync(CONFIG.inputDir)
    .filter(file => file.endsWith('.png') || file.endsWith('.webp'))

  if (imageFiles.length === 0) {
    logger.warn('No images found in input directory')
    process.exit(0)
  }

  // Load progress
  const progress = loadProgress()

  // Filter to only unuploaded images
  const imagesToUpload = imageFiles.filter(file => {
    const setId = path.basename(file, path.extname(file))
    return !progress.uploaded.includes(setId)
  })

  logger.info(`Total images in directory: ${imageFiles.length}`)
  logger.info(`Already uploaded: ${progress.uploaded.length}`)
  logger.info(`To upload this run: ${imagesToUpload.length}`)
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  if (imagesToUpload.length === 0) {
    logger.success('All images already uploaded!')
    return
  }

  if (dryRun) {
    logger.warn('DRY RUN - Showing what would be uploaded:')
    console.log('')
    imagesToUpload.slice(0, 10).forEach(file => {
      const setId = path.basename(file, path.extname(file))
      console.log(`   → ${setId}: ${file}`)
    })
    if (imagesToUpload.length > 10) {
      console.log(`   ... and ${imagesToUpload.length - 10} more`)
    }
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

  // Process each image
  for (let i = 0; i < imagesToUpload.length; i++) {
    const file = imagesToUpload[i]
    const setId = path.basename(file, path.extname(file))
    const inputPath = path.join(CONFIG.inputDir, file)
    const progressPercent = ((i / imagesToUpload.length) * 100).toFixed(1)

    logger.processing(`[${i + 1}/${imagesToUpload.length}] (${progressPercent}%) ${setId}`)

    try {
      // Optimize image
      const optimizedBuffer = await optimizeImage(inputPath)

      // Upload to storage
      const imageUrl = await uploadToStorage(supabase, optimizedBuffer, setId)

      // Update database
      const updated = await updateSeriesImageUrl(supabase, setId, imageUrl)

      if (updated) {
        logger.success(`Uploaded and linked: ${setId}`)
      } else {
        logger.warn(`Uploaded but no series found: ${setId}`)
      }

      // Track progress
      progress.uploaded.push(setId)
      saveProgress(progress)

    } catch (error) {
      logger.error(`Failed: ${setId} - ${error instanceof Error ? error.message : error}`)
      progress.failed.push(setId)
      saveProgress(progress)
    }

    // Delay between uploads
    if (i < imagesToUpload.length - 1) {
      await delay(CONFIG.delayBetweenUploads)
    }
  }

  // Final summary
  console.log('')
  logger.section('Upload Summary')
  logger.success(`Uploaded: ${progress.uploaded.length}`)
  if (progress.failed.length > 0) {
    logger.error(`Failed: ${progress.failed.length}`)
    console.log('Failed sets:')
    progress.failed.forEach(id => console.log(`   - ${id}`))
  }
}

// Run the script
main().catch(error => {
  logger.error(`Fatal error: ${error}`)
  process.exit(1)
})
