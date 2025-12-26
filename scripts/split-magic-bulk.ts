#!/usr/bin/env tsx
/**
 * Magic: The Gathering - Bulk Data Splitter (Memory-Efficient)
 *
 * Splits the large Scryfall bulk data file (2+ GB) into individual files
 * organized by SET and LANGUAGE for efficient processing.
 *
 * This version uses a two-pass approach to avoid memory issues:
 * - Pass 1: Collect metadata only (set names, counts)
 * - Pass 2: Stream cards and write to files incrementally
 *
 * Usage:
 *   npx tsx scripts/split-magic-bulk.ts                    # Split all sets, all 4 languages
 *   npx tsx scripts/split-magic-bulk.ts --dry-run          # Preview without writing
 *   npx tsx scripts/split-magic-bulk.ts --lang en          # Only English
 *   npx tsx scripts/split-magic-bulk.ts --lang en,fr       # English and French
 *   npx tsx scripts/split-magic-bulk.ts --min-cards 10     # Skip sets with < 10 cards
 *
 * Output structure:
 *   scripts/data/magic-sets/
 *   ├── index.json
 *   ├── vow/
 *   │   ├── en.json
 *   │   ├── fr.json
 *   │   └── ...
 *   └── ...
 *
 * Prerequisites:
 *   1. Run: npx tsx scripts/download-magic-bulk.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReadStream, createWriteStream, WriteStream } from 'fs'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import { logger } from './lib/logger'
import { MAGIC_CONFIG, EXCLUDED_SET_TYPES } from './config/magic-config'
import type { ScryfallCard } from '../lib/types/magic'

// Parse CLI arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
  || (args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null)

const targetLanguages: string[] = langArg
  ? langArg.split(',')
  : [...MAGIC_CONFIG.languages]

const minCardsArg = parseInt(
  args.find(a => a.startsWith('--min-cards='))?.split('=')[1] || '1',
  10
)

// Output directory
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/data/magic-sets')
const TEMP_DIR = path.join(OUTPUT_DIR, '_temp')
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.json')

interface SetMetadata {
  code: string
  name: string
  releaseDate: string | null
  setType: string
  languages: Record<string, number>  // lang -> card count
  totalCards: number
}

function makeKey(setCode: string, lang: string): string {
  return `${setCode}:${lang}`
}

/**
 * Pass 1: Collect metadata only (no card data stored)
 */
async function collectMetadata(bulkDataPath: string): Promise<Map<string, SetMetadata>> {
  const setMetadata = new Map<string, SetMetadata>()
  let totalCards = 0

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(bulkDataPath)
    const jsonParser = parser()
    const arrayStream = streamArray()

    readStream
      .pipe(jsonParser)
      .pipe(arrayStream)
      .on('data', ({ value }: { value: ScryfallCard }) => {
        totalCards++

        if (totalCards % 500000 === 0) {
          logger.progress(`${(totalCards / 1000000).toFixed(1)}M cards scanned, ${setMetadata.size} sets found...`)
        }

        const setCode = value.set?.toLowerCase()
        if (!setCode) return

        // Skip excluded set types
        if (EXCLUDED_SET_TYPES.includes(value.set_type)) return

        // Filter by target languages
        if (!targetLanguages.includes(value.lang)) return

        // Initialize or update metadata
        if (!setMetadata.has(setCode)) {
          setMetadata.set(setCode, {
            code: setCode,
            name: value.set_name,
            releaseDate: value.released_at || null,
            setType: value.set_type,
            languages: {},
            totalCards: 0,
          })
        }

        const meta = setMetadata.get(setCode)!
        meta.languages[value.lang] = (meta.languages[value.lang] || 0) + 1
        meta.totalCards++
      })
      .on('end', () => {
        logger.success(`Pass 1 complete: ${totalCards.toLocaleString()} cards scanned, ${setMetadata.size} sets found`)
        resolve(setMetadata)
      })
      .on('error', reject)
  })
}

/**
 * Pass 2: Stream cards and write to files incrementally using JSON Lines format
 * Uses lazy stream opening to avoid "too many open files" errors
 */
async function writeCardsToFiles(
  bulkDataPath: string,
  setMetadata: Map<string, SetMetadata>,
  validKeys: Set<string>
): Promise<Map<string, number>> {
  const writeStreams = new Map<string, WriteStream>()
  const writtenCounts = new Map<string, number>()
  let totalCards = 0
  let writtenCards = 0
  const MAX_OPEN_STREAMS = 200 // Limit concurrent open files

  // Create temp files directory structure
  for (const key of validKeys) {
    writtenCounts.set(key, 0)
  }

  // Helper to get or create stream (with lazy opening)
  function getStream(key: string): WriteStream {
    let stream = writeStreams.get(key)
    if (!stream) {
      const [setCode, lang] = key.split(':')
      const tempFile = path.join(TEMP_DIR, `${setCode}_${lang}.jsonl`)
      stream = createWriteStream(tempFile, { flags: 'a' }) // append mode
      writeStreams.set(key, stream)

      // Close oldest streams if we have too many open
      if (writeStreams.size > MAX_OPEN_STREAMS) {
        const keysToClose = Array.from(writeStreams.keys()).slice(0, 50)
        for (const k of keysToClose) {
          const s = writeStreams.get(k)
          if (s) {
            s.end()
            writeStreams.delete(k)
          }
        }
      }
    }
    return stream
  }

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(bulkDataPath)
    const jsonParser = parser()
    const arrayStream = streamArray()

    readStream
      .pipe(jsonParser)
      .pipe(arrayStream)
      .on('data', ({ value }: { value: ScryfallCard }) => {
        totalCards++

        if (totalCards % 500000 === 0) {
          logger.progress(`${(totalCards / 1000000).toFixed(1)}M cards processed, ${writtenCards.toLocaleString()} written, ${writeStreams.size} streams open...`)
        }

        const setCode = value.set?.toLowerCase()
        if (!setCode) return

        const key = makeKey(setCode, value.lang)
        if (!validKeys.has(key)) return

        const stream = getStream(key)
        // Write card as single JSON line
        stream.write(JSON.stringify(value) + '\n')
        writtenCounts.set(key, (writtenCounts.get(key) || 0) + 1)
        writtenCards++
      })
      .on('end', async () => {
        // Close all remaining streams
        const closePromises = Array.from(writeStreams.values()).map(stream => {
          return new Promise<void>(resolve => stream.end(resolve))
        })
        await Promise.all(closePromises)

        logger.success(`Pass 2 complete: ${writtenCards.toLocaleString()} cards written to temp files`)
        resolve(writtenCounts)
      })
      .on('error', reject)
  })
}

/**
 * Convert JSON Lines files to proper JSON format
 * Processes files one at a time to minimize memory usage
 */
async function convertToJsonFiles(
  setMetadata: Map<string, SetMetadata>,
  validKeys: Set<string>
): Promise<number> {
  let filesWritten = 0
  const readline = await import('readline')

  for (const key of validKeys) {
    const [setCode, lang] = key.split(':')
    const meta = setMetadata.get(setCode)!
    const tempFile = path.join(TEMP_DIR, `${setCode}_${lang}.jsonl`)
    const setDir = path.join(OUTPUT_DIR, setCode)
    const finalFile = path.join(setDir, `${lang}.json`)

    // Skip if temp file doesn't exist
    if (!fs.existsSync(tempFile)) continue

    // Create set directory
    if (!fs.existsSync(setDir)) {
      fs.mkdirSync(setDir, { recursive: true })
    }

    // Read and count cards using streaming
    const cards: unknown[] = []
    const fileStream = createReadStream(tempFile)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const line of rl) {
      if (line.trim()) {
        cards.push(JSON.parse(line))
      }
    }

    // Write final JSON file
    const fileData = {
      setCode: meta.code,
      setName: meta.name,
      releaseDate: meta.releaseDate,
      setType: meta.setType,
      language: lang,
      cardCount: cards.length,
      cards: cards,
    }

    fs.writeFileSync(finalFile, JSON.stringify(fileData, null, 2))
    filesWritten++

    // Delete temp file
    fs.unlinkSync(tempFile)

    // Clear cards array for GC
    cards.length = 0

    if (filesWritten % 50 === 0) {
      logger.progress(`${filesWritten} JSON files created...`)
    }
  }

  return filesWritten
}

/**
 * Main split function
 */
async function splitBulkData(): Promise<void> {
  logger.section('Magic: The Gathering - Bulk Data Splitter')

  if (dryRun) {
    logger.warn('DRY RUN MODE - No files will be written')
  }

  logger.info(`Target languages: ${targetLanguages.join(', ')}`)

  if (minCardsArg > 1) {
    logger.info(`Minimum cards per set/language: ${minCardsArg}`)
  }

  // Check bulk data file
  const bulkDataPath = path.resolve(process.cwd(), MAGIC_CONFIG.paths.bulkData)

  if (!fs.existsSync(bulkDataPath)) {
    logger.error(`Bulk data file not found: ${bulkDataPath}`)
    logger.info('Run first: npx tsx scripts/download-magic-bulk.ts')
    process.exit(1)
  }

  const stats = fs.statSync(bulkDataPath)
  const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2)
  logger.info(`Source file: ${fileSizeGB} GB`)

  // Create directories
  if (!dryRun) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true })
    }
    logger.success(`Output directory: ${OUTPUT_DIR}`)
  }

  logger.separator()

  // ========== PASS 1: Collect metadata ==========
  logger.download('Pass 1: Collecting metadata (memory-efficient)...')
  const setMetadata = await collectMetadata(bulkDataPath)

  // Determine which set/lang combinations to include
  const validKeys = new Set<string>()
  let skippedCount = 0

  for (const [setCode, meta] of setMetadata) {
    for (const lang of targetLanguages) {
      const count = meta.languages[lang] || 0
      if (count >= minCardsArg) {
        validKeys.add(makeKey(setCode, lang))
      } else if (count > 0) {
        skippedCount++
      }
    }
  }

  logger.info(`Set/language combinations to write: ${validKeys.size}`)
  if (skippedCount > 0) {
    logger.warn(`Skipped (< ${minCardsArg} cards): ${skippedCount}`)
  }

  if (dryRun) {
    // Show summary and exit
    showSummary(setMetadata, validKeys)
    return
  }

  logger.separator()

  // ========== PASS 2: Write cards to temp files ==========
  logger.download('Pass 2: Writing cards to temp files...')
  const writtenCounts = await writeCardsToFiles(bulkDataPath, setMetadata, validKeys)

  logger.separator()

  // ========== PASS 3: Convert to final JSON format ==========
  logger.download('Pass 3: Converting to JSON format...')
  const filesWritten = await convertToJsonFiles(setMetadata, validKeys)

  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
  }

  // Write index file
  const index: Record<string, {
    name: string
    releaseDate: string | null
    setType: string
    languages: Record<string, { cardCount: number; filePath: string }>
    totalCards: number
  }> = {}

  let totalCardsInIndex = 0
  for (const [setCode, meta] of setMetadata) {
    const languages: Record<string, { cardCount: number; filePath: string }> = {}
    let setTotal = 0

    for (const lang of targetLanguages) {
      const key = makeKey(setCode, lang)
      if (validKeys.has(key)) {
        const count = writtenCounts.get(key) || 0
        languages[lang] = {
          cardCount: count,
          filePath: `${setCode}/${lang}.json`
        }
        setTotal += count
      }
    }

    if (Object.keys(languages).length > 0) {
      index[setCode] = {
        name: meta.name,
        releaseDate: meta.releaseDate,
        setType: meta.setType,
        languages,
        totalCards: setTotal
      }
      totalCardsInIndex += setTotal
    }
  }

  const indexData = {
    generatedAt: new Date().toISOString(),
    sourceFile: MAGIC_CONFIG.paths.bulkData,
    targetLanguages,
    totalSets: Object.keys(index).length,
    totalFiles: filesWritten,
    totalCards: totalCardsInIndex,
    sets: index,
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2))
  logger.success(`Index written: ${INDEX_FILE}`)

  // Show summary
  showSummary(setMetadata, validKeys, writtenCounts)

  logger.separator()
  logger.success('Split complete!')

  logger.info('')
  logger.info('Next steps:')
  logger.info('  npx tsx scripts/seed-magic-from-split.ts --list')
  logger.info('  npx tsx scripts/seed-magic-from-split.ts --set vow --lang en')
}

function showSummary(
  setMetadata: Map<string, SetMetadata>,
  validKeys: Set<string>,
  writtenCounts?: Map<string, number>
): void {
  logger.separator()
  logger.section('Summary')

  logger.success(`Sets: ${setMetadata.size}`)
  logger.success(`Files to write: ${validKeys.size}`)

  // Cards by language
  logger.separator()
  logger.info('Cards by language:')

  const cardsByLang: Record<string, number> = {}
  for (const key of validKeys) {
    const [setCode, lang] = key.split(':')
    const meta = setMetadata.get(setCode)!
    cardsByLang[lang] = (cardsByLang[lang] || 0) + (meta.languages[lang] || 0)
  }

  for (const lang of targetLanguages) {
    const count = cardsByLang[lang] || 0
    logger.info(`  ${lang.padEnd(5)} ${count.toLocaleString().padStart(10)} cards`)
  }

  // Cards by set type
  logger.separator()
  logger.info('Cards by set type:')

  const bySetType: Record<string, number> = {}
  for (const [, meta] of setMetadata) {
    bySetType[meta.setType] = (bySetType[meta.setType] || 0) + meta.totalCards
  }

  const sortedByType = Object.entries(bySetType).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sortedByType) {
    logger.info(`  ${type.padEnd(20)} ${count.toLocaleString().padStart(10)} cards`)
  }

  // Top 10 sets
  logger.separator()
  logger.info('Top 10 largest sets:')

  const sortedSets = Array.from(setMetadata.entries())
    .sort((a, b) => b[1].totalCards - a[1].totalCards)
    .slice(0, 10)

  for (const [code, meta] of sortedSets) {
    const langs = Object.entries(meta.languages)
      .map(([l, c]) => `${l}:${c}`)
      .join(', ')
    logger.info(`  ${code.toUpperCase().padEnd(6)} ${meta.totalCards.toString().padStart(5)} cards (${langs})`)
  }

  if (dryRun) {
    logger.separator()
    logger.warn('DRY RUN - No files written')
  }
}

// Run
splitBulkData().catch((error) => {
  logger.error(`Fatal error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
