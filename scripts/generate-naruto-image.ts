/**
 * Naruto Kayou Series Image Generator using Higgsfield Cloud API
 *
 * This script generates a banner image for the Naruto Kayou series using the Higgsfield AI API.
 * Format: 16:9 (same as Riftbound)
 *
 * Usage:
 *   npx tsx scripts/generate-naruto-image.ts [--dry-run]
 *
 * Environment variables required:
 *   HF_API_KEY - Higgsfield API Key
 *   HF_SECRET  - Higgsfield API Secret
 */

import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Higgsfield API
  baseUrl: 'https://platform.higgsfield.ai',
  modelPath: '/nano-banana-pro',
  aspectRatio: '16:9',
  resolution: '1k',

  // Storage
  bucket: 'naruto-cards',
  storagePath: 'series',

  // Output
  outputDir: 'scripts/output/naruto-images'
}

// Series info
const NARUTO_SERIES = {
  code: 'KAYOU',
  name: 'Naruto Kayou',
  prompt: `Naruto Shippuden official anime artwork style, illustration inspired by Masashi Kishimoto's art, detailed anime cel-shading, professional trading card game art, 16:9 banner composition, high quality digital illustration, vibrant colors, dynamic ninja action poses, Naruto Uzumaki in sage mode with orange chakra aura, Sasuke Uchiha with Sharingan activated, epic battle scene at the Valley of the End with waterfall, Konoha village in background, iconic Uzumaki spiral and Uchiha fan emblems, dramatic lightning and fire jutsu effects, with elegant title text "Naruto Kayou" displayed prominently at the bottom in Japanese brush stroke style font`
}

// ============================================
// Types
// ============================================

interface HiggsfieldRequest {
  prompt: string
  aspect_ratio: string
  resolution: string
}

interface HiggsfieldSubmitResponse {
  status: string
  request_id: string
  status_url: string
  cancel_url: string
}

interface HiggsfieldStatusResponse {
  status: string
  request_id: string
  images?: Array<{
    url: string
    seed?: number
  }>
}

// ============================================
// Utility Functions
// ============================================

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`\x1b[31m✗ Error: Environment variable ${name} is not set\x1b[0m`)
    process.exit(1)
  }
  return value
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ensureOutputDir(): void {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  }
}

// ============================================
// Higgsfield API Client
// ============================================

async function submitGeneration(
  prompt: string,
  apiKey: string,
  apiSecret: string
): Promise<HiggsfieldSubmitResponse> {
  const url = `${CONFIG.baseUrl}${CONFIG.modelPath}`

  const body: HiggsfieldRequest = {
    prompt,
    aspect_ratio: CONFIG.aspectRatio,
    resolution: CONFIG.resolution
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Key ${apiKey}:${apiSecret}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  return response.json()
}

async function checkRequestStatus(
  statusUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<HiggsfieldStatusResponse> {
  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Key ${apiKey}:${apiSecret}`
    }
  })

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`)
  }

  const data = await response.json()
  console.log(`   → Status: ${data.status}`)
  return data
}

async function waitForCompletion(
  statusUrl: string,
  apiKey: string,
  apiSecret: string,
  maxAttempts: number = 60
): Promise<HiggsfieldStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkRequestStatus(statusUrl, apiKey, apiSecret)

    if (status.status === 'completed') {
      return status
    }

    if (status.status === 'failed' || status.status === 'error' || status.status === 'nsfw') {
      throw new Error(`Job failed with status: ${status.status}`)
    }

    // Wait 3 seconds between status checks
    await delay(3000)
  }

  throw new Error('Job timed out waiting for completion')
}

async function downloadImage(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(outputPath, Buffer.from(buffer))
}

// ============================================
// Storage Upload
// ============================================

async function uploadToStorage(
  supabase: ReturnType<typeof createAdminClient>,
  imagePath: string,
  code: string
): Promise<string> {
  // Optimize image with Sharp (same as Riftbound: 1200px wide, webp 90%)
  const optimizedBuffer = await sharp(imagePath)
    .resize(1200, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: 90 })
    .toBuffer()

  const storagePath = `${CONFIG.storagePath}/${code}.webp`

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === CONFIG.bucket)

  if (!bucketExists) {
    logger.info(`Creating bucket: ${CONFIG.bucket}`)
    const { error: createError } = await supabase.storage.createBucket(CONFIG.bucket, {
      public: true
    })
    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`)
    }
  }

  // Delete existing file if present
  await supabase.storage.from(CONFIG.bucket).remove([storagePath])

  // Upload new file
  const { error } = await supabase.storage
    .from(CONFIG.bucket)
    .upload(storagePath, optimizedBuffer, {
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
    logger.info(`  → Updated series: ${data[0].name}`)
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

  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[36m║       Naruto Kayou Image Generator - Higgsfield AI       ║\x1b[0m')
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\n')

  logger.info(`Series: ${NARUTO_SERIES.code} - ${NARUTO_SERIES.name}`)
  logger.info(`Aspect ratio: ${CONFIG.aspectRatio}`)
  logger.info(`Resolution: ${CONFIG.resolution}`)
  logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  if (dryRun) {
    logger.warn('DRY RUN - Showing prompt that would be sent:\n')
    console.log('\x1b[90m' + NARUTO_SERIES.prompt + '\x1b[0m')
    console.log('')
    logger.info('Estimated cost: ~3 credits (~$0.19)')
    return
  }

  // Load API credentials
  const apiKey = getEnvVar('HF_API_KEY')
  const apiSecret = getEnvVar('HF_SECRET')

  // Ensure output directory exists
  ensureOutputDir()

  try {
    // Submit generation request
    logger.processing('Submitting to Higgsfield API...')
    const submitResponse = await submitGeneration(NARUTO_SERIES.prompt, apiKey, apiSecret)

    if (!submitResponse.request_id) {
      throw new Error('No request_id returned from API')
    }

    logger.info(`Request ID: ${submitResponse.request_id}`)

    // Wait for completion
    logger.processing('Waiting for generation...')
    const result = await waitForCompletion(submitResponse.status_url, apiKey, apiSecret)

    if (!result.images || result.images.length === 0) {
      throw new Error('No images returned from completed job')
    }

    // Download the image
    const imageUrl = result.images[0].url
    const outputPath = path.join(CONFIG.outputDir, `${NARUTO_SERIES.code}.png`)

    logger.processing('Downloading image...')
    await downloadImage(imageUrl, outputPath)
    logger.success(`Saved locally: ${outputPath}`)

    // Upload to Supabase Storage
    logger.processing('Uploading to Supabase Storage...')
    const supabase = createAdminClient()
    const publicUrl = await uploadToStorage(supabase, outputPath, NARUTO_SERIES.code)
    logger.success(`Uploaded: ${publicUrl}`)

    // Update database
    logger.processing('Updating database...')
    const updated = await updateSeriesImageUrl(supabase, NARUTO_SERIES.code, publicUrl)

    if (updated) {
      logger.success('Database updated successfully!')
    }

    // Final summary
    console.log('')
    logger.section('Summary')
    logger.success(`Image generated and uploaded for ${NARUTO_SERIES.name}`)
    logger.info(`Public URL: ${publicUrl}`)

  } catch (error) {
    logger.error(`Failed: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

// Run the script
main().catch(error => {
  console.error('\x1b[31mFatal error:\x1b[0m', error)
  process.exit(1)
})
