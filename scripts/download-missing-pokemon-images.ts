/**
 * Script pour télécharger les images manquantes des cartes Pokémon depuis pokemontcg.io
 *
 * Usage:
 *   npx tsx scripts/download-missing-pokemon-images.ts              # Télécharger toutes les images manquantes
 *   npx tsx scripts/download-missing-pokemon-images.ts --dry-run    # Voir ce qui serait téléchargé
 *   npx tsx scripts/download-missing-pokemon-images.ts --limit=50   # Limiter à 50 cartes
 *   npx tsx scripts/download-missing-pokemon-images.ts --lang=de    # Uniquement les cartes allemandes
 *   npx tsx scripts/download-missing-pokemon-images.ts --resume     # Reprendre depuis la progression
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// CONFIGURATION
// ============================================

const POKEMONTCG_BASE = 'https://images.pokemontcg.io'

const CONFIG = {
  imageQuality: 85,
  imageWidth: 480,
  imageHeight: 672,
  delayBetweenCards: 500,      // ms entre chaque carte (augmenté)
  delayBetweenUploads: 300,    // ms entre chaque upload
  retryAttempts: 5,            // Plus de tentatives
  retryDelay: 3000,            // Délai plus long entre retries
  progressFile: 'scripts/logs/pokemon-missing-images-progress.json',
}

// ============================================
// TYPES
// ============================================

interface Card {
  id: string
  name: string
  number: string
  language: string
  series_id: string
}

interface Series {
  id: string
  code: string
  name: string
}

interface Progress {
  processedIds: string[]
  successCount: number
  errorCount: number
  notFoundCount: number
  lastUpdated: string
}

// ============================================
// HELPERS
// ============================================

const supabase = createAdminClient()

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0,
    lang: args.find(a => a.startsWith('--lang='))?.split('=')[1] || null,
  }
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'))
    }
  } catch {
    // Ignore
  }
  return {
    processedIds: [],
    successCount: 0,
    errorCount: 0,
    notFoundCount: 0,
    lastUpdated: new Date().toISOString(),
  }
}

function saveProgress(progress: Progress) {
  const dir = path.dirname(CONFIG.progressFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  progress.lastUpdated = new Date().toISOString()
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2))
}

/**
 * Construit l'URL de l'image sur pokemontcg.io
 * Format: https://images.pokemontcg.io/{setCode}/{number}.png
 */
function buildImageUrl(seriesCode: string, cardNumber: string): string {
  // Nettoyer le numéro de carte (enlever les suffixes comme /P1, /D100, etc.)
  const cleanNumber = cardNumber.split('/')[0]
  return `${POKEMONTCG_BASE}/${seriesCode.toLowerCase()}/${cleanNumber}.png`
}

/**
 * Télécharge une image depuis une URL
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      const response = await fetch(url)

      if (response.status === 404) {
        return null // Image non trouvée
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      if (attempt < CONFIG.retryAttempts) {
        await delay(CONFIG.retryDelay)
      }
    }
  }
  return null
}

/**
 * Optimise une image avec Sharp
 */
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(CONFIG.imageWidth, CONFIG.imageHeight, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: CONFIG.imageQuality })
    .toBuffer()
}

/**
 * Upload une image dans Supabase Storage avec retry
 */
async function uploadToStorage(
  buffer: Buffer,
  seriesCode: string,
  cardNumber: string,
  language: string
): Promise<string | null> {
  const cleanNumber = cardNumber.split('/')[0]
  const filePath = `${seriesCode}/${language}/${cleanNumber}.webp`

  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      const { error } = await supabase.storage
        .from('pokemon-cards')
        .upload(filePath, buffer, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (error) {
        // Si c'est une erreur de parsing HTML, c'est probablement un rate limit
        if (error.message.includes('Unexpected token') || error.message.includes('<html>')) {
          if (attempt < CONFIG.retryAttempts) {
            await delay(CONFIG.retryDelay * attempt) // Délai exponentiel
            continue
          }
        }
        throw new Error(`Upload failed: ${error.message}`)
      }

      // Upload réussi
      break
    } catch (err) {
      if (attempt < CONFIG.retryAttempts) {
        await delay(CONFIG.retryDelay * attempt)
        continue
      }
      throw err
    }
  }

  const { data: urlData } = supabase.storage
    .from('pokemon-cards')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

/**
 * Met à jour l'image_url d'une carte
 */
async function updateCardImageUrl(cardId: string, imageUrl: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId)

  if (error) {
    throw new Error(`Update failed: ${error.message}`)
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = parseArgs()

  logger.section('Téléchargement des images Pokémon manquantes')
  console.log('Source: pokemontcg.io')
  console.log('')

  if (args.dryRun) {
    console.log('🔍 Mode dry-run activé (aucune modification)')
    console.log('')
  }

  // 1. Récupérer le TCG Pokémon
  const { data: pokemonTcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'pokemon')
    .single()

  if (!pokemonTcg) {
    logger.error('TCG Pokémon non trouvé')
    return
  }

  // 2. Récupérer toutes les séries Pokémon
  const { data: allSeries } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', pokemonTcg.id)

  if (!allSeries) {
    logger.error('Aucune série Pokémon trouvée')
    return
  }

  const seriesMap = new Map<string, Series>()
  for (const s of allSeries) {
    seriesMap.set(s.id, s)
  }

  // 3. Récupérer les cartes sans image
  let query = supabase
    .from('cards')
    .select('id, name, number, language, series_id')
    .in('series_id', Array.from(seriesMap.keys()))
    .is('image_url', null)
    .order('series_id')

  if (args.lang) {
    query = query.eq('language', args.lang)
  }

  const { data: cards, error } = await query

  if (error || !cards) {
    logger.error(`Erreur: ${error?.message}`)
    return
  }

  console.log(`Cartes sans image trouvées: ${cards.length}`)

  // 4. Charger la progression si resume
  let progress = args.resume ? loadProgress() : {
    processedIds: [],
    successCount: 0,
    errorCount: 0,
    notFoundCount: 0,
    lastUpdated: new Date().toISOString(),
  }

  if (args.resume && progress.processedIds.length > 0) {
    console.log(`Reprise depuis la progression: ${progress.processedIds.length} déjà traités`)
  }

  // 5. Filtrer les cartes déjà traitées
  let cardsToProcess = cards.filter(c => !progress.processedIds.includes(c.id))

  if (args.limit > 0) {
    cardsToProcess = cardsToProcess.slice(0, args.limit)
  }

  console.log(`Cartes à traiter: ${cardsToProcess.length}`)
  console.log('')

  if (args.dryRun) {
    // Afficher un aperçu
    const byLang: Record<string, number> = {}
    const bySeries: Record<string, number> = {}

    for (const card of cardsToProcess) {
      byLang[card.language] = (byLang[card.language] || 0) + 1
      const series = seriesMap.get(card.series_id)
      if (series) {
        bySeries[series.code] = (bySeries[series.code] || 0) + 1
      }
    }

    console.log('Par langue:')
    for (const [lang, count] of Object.entries(byLang).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${lang}: ${count}`)
    }

    console.log('')
    console.log('Par série (top 10):')
    const topSeries = Object.entries(bySeries).sort((a, b) => b[1] - a[1]).slice(0, 10)
    for (const [code, count] of topSeries) {
      console.log(`  ${code}: ${count}`)
    }

    console.log('')
    console.log('Exemples d\'URLs qui seraient téléchargées:')
    for (const card of cardsToProcess.slice(0, 5)) {
      const series = seriesMap.get(card.series_id)
      if (series) {
        const url = buildImageUrl(series.code, card.number)
        console.log(`  ${series.code}/${card.number} (${card.language}) -> ${url}`)
      }
    }

    return
  }

  // 6. Traiter les cartes
  let processed = 0

  for (const card of cardsToProcess) {
    const series = seriesMap.get(card.series_id)
    if (!series) continue

    processed++
    const imageUrl = buildImageUrl(series.code, card.number)

    process.stdout.write(`\r[${processed}/${cardsToProcess.length}] ${series.code}/${card.number} (${card.language})...`)

    try {
      // Télécharger l'image
      const imageBuffer = await downloadImage(imageUrl)

      if (!imageBuffer) {
        progress.notFoundCount++
        progress.processedIds.push(card.id)
        if (processed % 50 === 0) saveProgress(progress)
        await delay(CONFIG.delayBetweenCards)
        continue
      }

      // Optimiser l'image
      const optimizedBuffer = await optimizeImage(imageBuffer)

      // Upload dans Storage
      const storageUrl = await uploadToStorage(
        optimizedBuffer,
        series.code,
        card.number,
        card.language
      )

      if (storageUrl) {
        // Mettre à jour la carte
        await updateCardImageUrl(card.id, storageUrl)
        progress.successCount++
      }

      progress.processedIds.push(card.id)

      // Sauvegarder la progression régulièrement
      if (processed % 50 === 0) {
        saveProgress(progress)
      }

      await delay(CONFIG.delayBetweenCards)

    } catch (error) {
      progress.errorCount++
      progress.processedIds.push(card.id)
      console.log(`\n   ❌ Erreur: ${error instanceof Error ? error.message : 'Unknown'}`)

      if (processed % 50 === 0) saveProgress(progress)
      await delay(CONFIG.delayBetweenCards)
    }
  }

  // 7. Sauvegarder la progression finale
  saveProgress(progress)

  // 8. Résumé
  console.log('\n')
  console.log('='.repeat(60))
  console.log('RÉSUMÉ')
  console.log('='.repeat(60))
  console.log(`✅ Images téléchargées: ${progress.successCount}`)
  console.log(`⚠️  Images non trouvées: ${progress.notFoundCount}`)
  console.log(`❌ Erreurs: ${progress.errorCount}`)
  console.log('')
  console.log(`Progression sauvegardée dans: ${CONFIG.progressFile}`)

  // Nettoyer le fichier de progression si tout est terminé
  if (progress.successCount + progress.notFoundCount + progress.errorCount === cards.length) {
    console.log('')
    console.log('✅ Toutes les cartes ont été traitées!')
    // Optionnel: supprimer le fichier de progression
    // fs.unlinkSync(CONFIG.progressFile)
  }
}

main().catch(console.error)
