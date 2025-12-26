#!/usr/bin/env tsx
/**
 * Download Magic: The Gathering bulk data from Scryfall
 *
 * Usage:
 *   npx tsx scripts/download-magic-bulk.ts
 *   npx tsx scripts/download-magic-bulk.ts --force    # Re-download even if file exists
 *
 * Downloads the "All Cards" bulk data file (~2.3 GB) from Scryfall API
 * and saves it to scripts/data/scryfall-all-cards.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { logger } from './lib/logger'
import { MAGIC_CONFIG } from './config/magic-config'
import type { ScryfallBulkDataInfo } from '../lib/types/magic'

// Parse CLI arguments
const args = process.argv.slice(2)
const forceDownload = args.includes('--force') || args.includes('-f')

/**
 * Fetch bulk data info from Scryfall API
 */
async function fetchBulkDataInfo(): Promise<ScryfallBulkDataInfo | null> {
  try {
    const response = await fetch(MAGIC_CONFIG.api.bulkData)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // Find the "all_cards" bulk data entry
    const allCards = data.data.find(
      (entry: ScryfallBulkDataInfo) => entry.type === 'all_cards'
    )

    if (!allCards) {
      throw new Error('Could not find "all_cards" bulk data entry')
    }

    return allCards
  } catch (error) {
    logger.error(`Failed to fetch bulk data info: ${(error as Error).message}`)
    return null
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Download the bulk data file with progress tracking
 */
async function downloadBulkData(
  url: string,
  outputPath: string,
  expectedSize: number
): Promise<boolean> {
  try {
    logger.download(`Downloading from ${url}`)
    logger.info(`Expected size: ${formatBytes(expectedSize)}`)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    // Ensure directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create write stream
    const fileStream = createWriteStream(outputPath)

    // Track progress
    let downloadedBytes = 0
    let lastProgressUpdate = Date.now()
    const progressInterval = 5000 // Update every 5 seconds

    // Convert web ReadableStream to Node.js Readable
    const reader = response.body.getReader()
    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read()
        if (done) {
          this.push(null)
        } else {
          downloadedBytes += value.length
          const now = Date.now()
          if (now - lastProgressUpdate >= progressInterval) {
            const percent = ((downloadedBytes / expectedSize) * 100).toFixed(1)
            logger.progress(
              `Downloaded ${formatBytes(downloadedBytes)} / ${formatBytes(expectedSize)} (${percent}%)`
            )
            lastProgressUpdate = now
          }
          this.push(value)
        }
      },
    })

    // Pipe the download to file
    await pipeline(nodeStream, fileStream)

    logger.success(`Download complete: ${formatBytes(downloadedBytes)}`)
    return true
  } catch (error) {
    logger.error(`Download failed: ${(error as Error).message}`)
    // Clean up partial file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    }
    return false
  }
}

/**
 * Verify the downloaded file is valid JSON
 */
async function verifyFile(filePath: string): Promise<boolean> {
  try {
    logger.processing('Verifying file integrity...')

    // Check file exists and has content
    const stats = fs.statSync(filePath)
    if (stats.size === 0) {
      throw new Error('File is empty')
    }

    logger.info(`File size: ${formatBytes(stats.size)}`)

    const fd = fs.openSync(filePath, 'r')

    // Read first 100 bytes to check it starts with JSON array
    const startBuffer = Buffer.alloc(100)
    fs.readSync(fd, startBuffer, 0, 100, 0)
    const start = startBuffer.toString('utf8').trim()

    if (!start.startsWith('[')) {
      fs.closeSync(fd)
      throw new Error('File does not appear to be a JSON array')
    }

    // Read last 100 bytes to check it ends with JSON array
    const endBuffer = Buffer.alloc(100)
    const endPosition = Math.max(0, stats.size - 100)
    fs.readSync(fd, endBuffer, 0, 100, endPosition)
    const end = endBuffer.toString('utf8').trim()

    fs.closeSync(fd)

    if (!end.endsWith(']')) {
      throw new Error('File does not end properly (incomplete download?)')
    }

    // Estimate card count based on file size (~27KB per card average)
    const estimatedCards = Math.round(stats.size / 27000)
    logger.info(`Estimated card count: ~${estimatedCards.toLocaleString()}`)

    logger.success('File verification passed')
    return true
  } catch (error) {
    logger.error(`File verification failed: ${(error as Error).message}`)
    return false
  }
}

/**
 * Main function
 */
async function main() {
  logger.section('Magic: The Gathering - Bulk Data Download')

  const outputPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.bulkData)
  logger.info(`Output path: ${outputPath}`)

  // Check if file already exists
  if (fs.existsSync(outputPath) && !forceDownload) {
    const stats = fs.statSync(outputPath)
    logger.warn(`File already exists: ${formatBytes(stats.size)}`)
    logger.info('Use --force to re-download')

    // Verify existing file
    const isValid = await verifyFile(outputPath)
    if (isValid) {
      logger.success('Existing file is valid. Skipping download.')
      return
    } else {
      logger.warn('Existing file is invalid. Re-downloading...')
    }
  }

  // Fetch bulk data info
  logger.processing('Fetching bulk data info from Scryfall...')
  const bulkInfo = await fetchBulkDataInfo()

  if (!bulkInfo) {
    logger.error('Could not fetch bulk data info. Exiting.')
    process.exit(1)
  }

  logger.info(`Bulk data: ${bulkInfo.name}`)
  logger.info(`Description: ${bulkInfo.description}`)
  logger.info(`Size: ${formatBytes(bulkInfo.size)}`)
  logger.info(`Updated: ${bulkInfo.updated_at}`)

  // Download the file
  logger.separator()
  const success = await downloadBulkData(
    bulkInfo.download_uri,
    outputPath,
    bulkInfo.size
  )

  if (!success) {
    logger.error('Download failed. Exiting.')
    process.exit(1)
  }

  // Verify the downloaded file
  logger.separator()
  const isValid = await verifyFile(outputPath)

  if (!isValid) {
    logger.error('Downloaded file is invalid. Please try again.')
    process.exit(1)
  }

  logger.separator()
  logger.success('Bulk data download complete!')
  logger.info(`File saved to: ${outputPath}`)
  logger.info('')
  logger.info('Next steps:')
  logger.info('  1. Run: npx tsx scripts/seed-magic.ts --dry-run')
  logger.info('  2. Run: npx tsx scripts/seed-magic.ts --set VOW --limit 10')
  logger.info('  3. Run: npx tsx scripts/seed-magic.ts')
}

// Run
main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
