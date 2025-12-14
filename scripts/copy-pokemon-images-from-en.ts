/**
 * Copy Pokemon images from EN to other languages (DE, FR, IT, ES, PT)
 * when the image is missing in the target language
 *
 * Usage:
 *   npx tsx scripts/copy-pokemon-images-from-en.ts                    # Copy all missing images
 *   npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run          # Preview without executing
 *   npx tsx scripts/copy-pokemon-images-from-en.ts --series SV01      # Specific series only
 *   npx tsx scripts/copy-pokemon-images-from-en.ts --lang fr          # Specific language only
 *   npx tsx scripts/copy-pokemon-images-from-en.ts --limit 50         # Limit number of copies
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createAdminClient()

const LOGS_DIR = path.join(process.cwd(), 'scripts', 'logs')
const PROGRESS_FILE = path.join(LOGS_DIR, 'pokemon-copy-progress.json')
const DELAY_BETWEEN_COPIES = 100 // ms between storage operations
const TARGET_LANGUAGES = ['de', 'fr', 'it', 'es', 'pt']

interface CardInfo {
  id: string
  number: string
  language: string
  image_url: string | null
  series_id: string
  series_code: string
}

interface CopyTask {
  cardId: string
  cardNumber: string
  seriesCode: string
  targetLang: string
  sourcePath: string
  destPath: string
}

interface Progress {
  processedCardIds: string[]
  totalCopied: number
  totalUpdated: number
  lastUpdated: string
}

interface Options {
  dryRun: boolean
  series?: string
  lang?: string
  limit?: number
}

/**
 * Parse command line arguments
 */
function parseArgs(): Options {
  const args = process.argv.slice(2)
  const options: Options = {
    dryRun: args.includes('--dry-run')
  }

  const seriesIdx = args.indexOf('--series')
  if (seriesIdx !== -1 && args[seriesIdx + 1]) {
    options.series = args[seriesIdx + 1].toLowerCase()
  }

  const langIdx = args.indexOf('--lang')
  if (langIdx !== -1 && args[langIdx + 1]) {
    const lang = args[langIdx + 1].toLowerCase()
    if (!TARGET_LANGUAGES.includes(lang)) {
      logger.error(`Langue invalide: ${lang}. Langues supportées: ${TARGET_LANGUAGES.join(', ')}`)
      process.exit(1)
    }
    options.lang = lang
  }

  const limitIdx = args.indexOf('--limit')
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    options.limit = parseInt(args[limitIdx + 1], 10)
    if (isNaN(options.limit) || options.limit <= 0) {
      logger.error('--limit doit être un nombre positif')
      process.exit(1)
    }
  }

  return options
}

/**
 * Load progress from file
 */
function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      logger.warn('Impossible de charger le fichier de progression, création d\'un nouveau')
    }
  }

  return {
    processedCardIds: [],
    totalCopied: 0,
    totalUpdated: 0,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Save progress to file
 */
function saveProgress(progress: Progress) {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }

  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

/**
 * Delete progress file
 */
function deleteProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
    logger.info('Fichier de progression supprimé')
  }
}

/**
 * Fetch all Pokemon cards with pagination
 */
async function fetchAllPokemonCards(
  seriesFilter?: string,
  langFilter?: string
): Promise<CardInfo[]> {
  logger.section('Récupération des cartes Pokemon')

  // Get Pokemon series
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, code, tcg_game:tcg_game_id(slug)')
    .eq('tcg_game.slug', 'pokemon')

  if (seriesError || !series?.length) {
    logger.error('Aucune série Pokemon trouvée')
    return []
  }

  let filteredSeries = series
  if (seriesFilter) {
    filteredSeries = series.filter(s => s.code === seriesFilter)
    if (filteredSeries.length === 0) {
      logger.error(`Série ${seriesFilter} introuvable`)
      return []
    }
  }

  const seriesIds = filteredSeries.map(s => s.id)
  const seriesCodeMap = new Map(filteredSeries.map(s => [s.id, s.code]))

  logger.info(`${filteredSeries.length} séries Pokemon à traiter`)

  // Fetch all cards with pagination
  let allCards: any[] = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    logger.progress(`Récupération cartes: offset ${offset}`)

    const query = supabase
      .from('cards')
      .select('id, number, language, image_url, series_id')
      .in('series_id', seriesIds)

    if (langFilter) {
      query.in('language', ['en', langFilter])
    } else {
      query.in('language', ['en', ...TARGET_LANGUAGES])
    }

    const { data: batch, error } = await query
      .range(offset, offset + batchSize - 1)
      .order('series_id')
      .order('number')
      .order('language')

    if (error) {
      logger.error(`Erreur: ${error.message}`)
      return []
    }

    if (!batch || batch.length === 0) break

    allCards = allCards.concat(batch)
    offset += batchSize

    if (batch.length < batchSize) break
  }

  logger.success(`${allCards.length} cartes récupérées`)

  // Map to CardInfo
  return allCards.map(c => ({
    id: c.id,
    number: c.number,
    language: c.language,
    image_url: c.image_url,
    series_id: c.series_id,
    series_code: seriesCodeMap.get(c.series_id) || 'unknown'
  }))
}

/**
 * Identify copy tasks: cards missing images that can use EN version
 */
function identifyCopyTasks(
  cards: CardInfo[],
  langFilter?: string,
  processedCardIds: string[] = []
): CopyTask[] {
  logger.section('Identification des tâches de copie')

  // Group by series -> number -> language
  const bySeriesNumber: Map<string, Map<string, Map<string, CardInfo>>> = new Map()

  for (const card of cards) {
    if (!bySeriesNumber.has(card.series_code)) {
      bySeriesNumber.set(card.series_code, new Map())
    }

    const byNumber = bySeriesNumber.get(card.series_code)!
    if (!byNumber.has(card.number)) {
      byNumber.set(card.number, new Map())
    }

    byNumber.get(card.number)!.set(card.language, card)
  }

  // Identify tasks
  const tasks: CopyTask[] = []
  const targetLangs = langFilter ? [langFilter] : TARGET_LANGUAGES

  for (const [seriesCode, byNumber] of bySeriesNumber) {
    for (const [number, byLang] of byNumber) {
      const enCard = byLang.get('en')

      // Skip if EN doesn't have image
      if (!enCard?.image_url) continue

      for (const targetLang of targetLangs) {
        const targetCard = byLang.get(targetLang)

        // Skip if target card doesn't exist, already has image, or already processed
        if (!targetCard) continue
        if (targetCard.image_url) continue
        if (processedCardIds.includes(targetCard.id)) continue

        const sourcePath = `${seriesCode}/en/${number}.webp`
        const destPath = `${seriesCode}/${targetLang}/${number}.webp`

        tasks.push({
          cardId: targetCard.id,
          cardNumber: number,
          seriesCode,
          targetLang,
          sourcePath,
          destPath
        })
      }
    }
  }

  logger.info(`${tasks.length} tâches de copie identifiées`)

  return tasks
}

/**
 * Copy image in Supabase Storage and update database
 */
async function copyImage(task: CopyTask, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    logger.info(`[DRY-RUN] Copie: ${task.sourcePath} -> ${task.destPath}`)
    return true
  }

  try {
    // Copy file in storage
    const { error: copyError } = await supabase.storage
      .from('pokemon-cards')
      .copy(task.sourcePath, task.destPath)

    if (copyError) {
      logger.error(`Échec copie storage: ${copyError.message}`)
      return false
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('pokemon-cards')
      .getPublicUrl(task.destPath)

    const publicUrl = publicUrlData.publicUrl

    // Update database
    const { error: updateError } = await supabase
      .from('cards')
      .update({ image_url: publicUrl })
      .eq('id', task.cardId)

    if (updateError) {
      logger.error(`Échec update BDD: ${updateError.message}`)
      return false
    }

    logger.success(
      `${task.seriesCode}/${task.targetLang}/${task.cardNumber} - Image copiée et BDD mise à jour`
    )
    return true

  } catch (error) {
    logger.error(`Erreur inattendue: ${error}`)
    return false
  }
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs()

  logger.section('Copie d\'images Pokemon EN -> Autres langues')

  if (options.dryRun) {
    logger.warn('MODE DRY-RUN: Aucune modification ne sera effectuée')
  }

  // Display options
  console.log('\nOptions:')
  console.log(`  Série:  ${options.series || 'Toutes'}`)
  console.log(`  Langue: ${options.lang || 'Toutes (de, fr, it, es, pt)'}`)
  console.log(`  Limite: ${options.limit || 'Aucune'}`)
  console.log()

  // Load progress
  const progress = loadProgress()
  if (progress.processedCardIds.length > 0) {
    logger.info(`Reprise depuis dernière exécution: ${progress.totalCopied} images déjà copiées`)
  }

  // Fetch cards
  const cards = await fetchAllPokemonCards(options.series, options.lang)
  if (cards.length === 0) {
    logger.error('Aucune carte trouvée')
    return
  }

  // Identify tasks
  const tasks = identifyCopyTasks(cards, options.lang, progress.processedCardIds)

  if (tasks.length === 0) {
    logger.success('Aucune image à copier')
    if (!options.dryRun && progress.processedCardIds.length > 0) {
      deleteProgress()
    }
    return
  }

  // Apply limit
  const tasksToProcess = options.limit ? tasks.slice(0, options.limit) : tasks

  logger.section('Exécution des copies')
  logger.info(`${tasksToProcess.length} images à traiter`)

  // Process tasks
  let copied = 0
  let updated = 0
  let failed = 0

  for (let i = 0; i < tasksToProcess.length; i++) {
    const task = tasksToProcess[i]

    logger.progress(`[${i + 1}/${tasksToProcess.length}] ${task.seriesCode}/${task.targetLang}/${task.cardNumber}`)

    const success = await copyImage(task, options.dryRun)

    if (success) {
      copied++
      if (!options.dryRun) {
        updated++
        progress.processedCardIds.push(task.cardId)
        progress.totalCopied++
        progress.totalUpdated++
      }
    } else {
      failed++
    }

    // Save progress every 10 copies
    if (!options.dryRun && i % 10 === 0) {
      saveProgress(progress)
    }

    // Delay between operations
    if (!options.dryRun && i < tasksToProcess.length - 1) {
      await delay(DELAY_BETWEEN_COPIES)
    }
  }

  // Final save
  if (!options.dryRun) {
    saveProgress(progress)
  }

  // Summary
  logger.section('Résumé')
  console.log(`
Images copiées:      ${copied}
BDD mise à jour:     ${updated}
Échecs:              ${failed}
Restantes:           ${tasks.length - tasksToProcess.length}
`)

  if (options.dryRun) {
    logger.info('Mode dry-run: Aucune modification effectuée')
  } else {
    if (failed === 0 && tasks.length === tasksToProcess.length) {
      logger.success('Toutes les images ont été copiées avec succès')
      deleteProgress()
    } else {
      logger.info(`Progression sauvegardée dans: ${PROGRESS_FILE}`)
      logger.info('Relancez le script pour continuer')
    }
  }
}

main().catch(console.error)
