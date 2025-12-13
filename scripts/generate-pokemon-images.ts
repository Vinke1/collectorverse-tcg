/**
 * Pokemon TCG Set Image Generator using Higgsfield Cloud API
 *
 * This script generates banner images for Pokemon TCG sets using the Higgsfield AI API.
 *
 * Usage:
 *   npx tsx scripts/generate-pokemon-images.ts [--start <index>] [--count <number>] [--dry-run]
 *
 * Environment variables required:
 *   HF_API_KEY - Higgsfield API Key
 *   HF_SECRET  - Higgsfield API Secret
 *
 * Options:
 *   --start <index>  - Start from a specific index (default: 0)
 *   --count <number> - Number of images to generate (default: all remaining)
 *   --dry-run        - Show what would be generated without calling API
 */

import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { POKEMON_SET_PROMPTS, TOTAL_PROMPTS } from './data/pokemon-set-prompts'

// Load environment variables from .env.local (Next.js convention)
dotenv.config({ path: '.env.local' })

// ============================================
// Configuration
// ============================================

const CONFIG = {
  baseUrl: 'https://platform.higgsfield.ai',
  // Model path - Nano Banana Pro
  modelPath: '/nano-banana-pro',
  // 16:9 aspect ratio for banners
  aspectRatio: '16:9',
  resolution: '1k', // Options: 1k, 2k, 4k
  // Delay between requests (ms) to avoid rate limiting
  delayBetweenRequests: 3000,
  // Output directory for generated images
  outputDir: 'scripts/output/pokemon-images',
  // Progress file to track completed generations
  progressFile: 'scripts/output/pokemon-images-progress.json'
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

interface Progress {
  completed: string[]
  failed: string[]
  lastRun: string
}

// ============================================
// Utility Functions
// ============================================

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`\x1b[31m✗ Error: Environment variable ${name} is not set\x1b[0m`)
    console.error(`  Set it with: export ${name}=your_value`)
    process.exit(1)
  }
  return value
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      const data = fs.readFileSync(CONFIG.progressFile, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.warn('⚠ Could not load progress file, starting fresh')
  }
  return { completed: [], failed: [], lastRun: '' }
}

function saveProgress(progress: Progress): void {
  const dir = path.dirname(CONFIG.progressFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  progress.lastRun = new Date().toISOString()
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2))
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
      // Log full response to debug outputs
      console.log(`   → Full response: ${JSON.stringify(status, null, 2)}`)
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
// Main Logic
// ============================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)

  // Parse --start argument
  let startIndex = 0
  const startIdx = args.findIndex(a => a === '--start')
  if (startIdx !== -1 && args[startIdx + 1]) {
    startIndex = parseInt(args[startIdx + 1], 10) || 0
  }

  // Parse --count argument
  let countArg = TOTAL_PROMPTS - startIndex
  const countIdx = args.findIndex(a => a === '--count')
  if (countIdx !== -1 && args[countIdx + 1]) {
    countArg = parseInt(args[countIdx + 1], 10) || countArg
  }

  const dryRun = args.includes('--dry-run')

  // Debug: show parsed arguments
  console.log(`\x1b[90mArgs: ${args.join(' ')} → start=${startIndex}, count=${countArg}\x1b[0m`)

  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[36m║     Pokemon TCG Set Image Generator - Higgsfield AI      ║\x1b[0m')
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\n')

  // Load environment variables
  const apiKey = dryRun ? 'DRY_RUN' : getEnvVar('HF_API_KEY')
  const apiSecret = dryRun ? 'DRY_RUN' : getEnvVar('HF_SECRET')

  // Load progress
  const progress = loadProgress()

  // Ensure output directory exists
  ensureOutputDir()

  // Filter sets to process
  const setsToProcess = POKEMON_SET_PROMPTS.slice(startIndex, startIndex + countArg).filter(
    set => !progress.completed.includes(set.id)
  )

  console.log(`\x1b[33m📊 Statistics:\x1b[0m`)
  console.log(`   Total prompts available: ${TOTAL_PROMPTS}`)
  console.log(`   Already completed: ${progress.completed.length}`)
  console.log(`   Failed previously: ${progress.failed.length}`)
  console.log(`   To process this run: ${setsToProcess.length}`)
  console.log(`   Starting index: ${startIndex}`)
  console.log(`   Mode: ${dryRun ? '\x1b[33mDRY RUN\x1b[0m' : '\x1b[32mLIVE\x1b[0m'}`)
  console.log('')

  if (setsToProcess.length === 0) {
    console.log('\x1b[32m✓ All images already generated!\x1b[0m')
    return
  }

  // Estimate cost
  const estimatedCredits = setsToProcess.length * 3 // 3 credits per 1080p image
  const estimatedCost = estimatedCredits / 16 // $1 = 16 credits
  console.log(`\x1b[33m💰 Estimated cost: ${estimatedCredits} credits (~$${estimatedCost.toFixed(2)})\x1b[0m`)
  console.log('')

  if (dryRun) {
    console.log('\x1b[33m🔍 DRY RUN - Showing prompts that would be sent:\x1b[0m\n')
    setsToProcess.slice(0, 5).forEach((set, i) => {
      console.log(`\x1b[36m[${i + 1}] ${set.id} - ${set.name}\x1b[0m`)
      console.log(`    Era: ${set.era}`)
      console.log(`    Prompt: ${set.prompt.substring(0, 100)}...`)
      console.log('')
    })
    if (setsToProcess.length > 5) {
      console.log(`... and ${setsToProcess.length - 5} more sets`)
    }
    return
  }

  // Process each set
  for (let i = 0; i < setsToProcess.length; i++) {
    const set = setsToProcess[i]
    const progressPercent = ((i / setsToProcess.length) * 100).toFixed(1)

    console.log(`\x1b[36m[${i + 1}/${setsToProcess.length}] (${progressPercent}%) Processing: ${set.id} - ${set.name}\x1b[0m`)

    try {
      // Submit generation request
      console.log('   → Submitting to Higgsfield API...')
      const submitResponse = await submitGeneration(set.prompt, apiKey, apiSecret)

      if (!submitResponse.request_id) {
        throw new Error('No request_id returned from API')
      }

      console.log(`   → Request submitted: ${submitResponse.request_id}`)

      // Wait for completion
      console.log('   → Waiting for generation...')
      const result = await waitForCompletion(submitResponse.status_url, apiKey, apiSecret)

      if (!result.images || result.images.length === 0) {
        throw new Error('No images returned from completed job')
      }

      // Download the image
      const imageUrl = result.images[0].url
      const outputPath = path.join(CONFIG.outputDir, `${set.id}.png`)

      console.log('   → Downloading image...')
      await downloadImage(imageUrl, outputPath)

      console.log(`\x1b[32m   ✓ Saved: ${outputPath}\x1b[0m`)

      // Update progress
      progress.completed.push(set.id)
      saveProgress(progress)

    } catch (error) {
      console.error(`\x1b[31m   ✗ Error: ${error instanceof Error ? error.message : error}\x1b[0m`)
      progress.failed.push(set.id)
      saveProgress(progress)
    }

    // Delay between requests
    if (i < setsToProcess.length - 1) {
      console.log(`   → Waiting ${CONFIG.delayBetweenRequests / 1000}s before next request...`)
      await delay(CONFIG.delayBetweenRequests)
    }
  }

  // Final summary
  console.log('\n\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m')
  console.log('\x1b[36m                        SUMMARY                            \x1b[0m')
  console.log('\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m')
  console.log(`\x1b[32m✓ Successfully generated: ${progress.completed.length}\x1b[0m`)
  console.log(`\x1b[31m✗ Failed: ${progress.failed.length}\x1b[0m`)
  console.log(`📁 Output directory: ${CONFIG.outputDir}`)
  console.log('')

  if (progress.failed.length > 0) {
    console.log('\x1b[33mFailed sets (retry with --start):\x1b[0m')
    progress.failed.forEach(id => console.log(`   - ${id}`))
  }
}

// Run the script
main().catch(error => {
  console.error('\x1b[31mFatal error:\x1b[0m', error)
  process.exit(1)
})
