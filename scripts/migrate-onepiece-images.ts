/**
 * Script de migration des images One Piece
 * Télécharge les images depuis opecards.fr et les stocke sur Supabase Storage
 *
 * Usage:
 *   npx tsx scripts/migrate-onepiece-images.ts              # Migrer toutes les images
 *   npx tsx scripts/migrate-onepiece-images.ts --dry-run    # Voir ce qui sera migré
 *   npx tsx scripts/migrate-onepiece-images.ts --series OP03  # Migrer une série spécifique
 *   npx tsx scripts/migrate-onepiece-images.ts --limit 50   # Limiter le nombre d'images
 *   npx tsx scripts/migrate-onepiece-images.ts --continue-on-error  # Continuer malgré les erreurs
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

const supabase = createAdminClient()

const CONFIG = {
  BUCKET: 'onepiece-cards',
  IMAGE_WIDTH: 480,
  IMAGE_HEIGHT: 672,
  WEBP_QUALITY: 85,
  DELAY_BETWEEN_DOWNLOADS: 300, // ms
  DELAY_BETWEEN_UPLOADS: 200,   // ms
  PROGRESS_FILE: 'scripts/logs/onepiece-migration-progress.json',
  MAX_RETRIES: 3
}

interface Card {
  id: string
  number: string
  language: string
  image_url: string
  series_code: string
}

interface Progress {
  migratedIds: string[]
  failedIds: string[]
  lastUpdated: string
}

// Parse arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error')
const seriesIndex = args.indexOf('--series')
const targetSeries = seriesIndex !== -1 ? args[seriesIndex + 1] : null
const limitIndex = args.indexOf('--limit')
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    // Ignore
  }
  return { migratedIds: [], failedIds: [], lastUpdated: '' }
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString()
  const dir = path.dirname(CONFIG.PROGRESS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.opecards.fr/'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadImage(redirectUrl).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })

    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Timeout'))
    })
  })
}

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(CONFIG.IMAGE_WIDTH, CONFIG.IMAGE_HEIGHT, { fit: 'cover' })
    .webp({ quality: CONFIG.WEBP_QUALITY })
    .toBuffer()
}

function getStoragePath(seriesCode: string, language: string, cardNumber: string): string {
  // Nettoyer le numéro de carte pour le nom de fichier
  const cleanNumber = cardNumber.replace(/\//g, '-')
  return `${seriesCode}/${language.toLowerCase()}/${cleanNumber}.webp`
}

async function migrateCard(card: Card, retryCount = 0): Promise<boolean> {
  const storagePath = getStoragePath(card.series_code, card.language, card.number)

  try {
    // 1. Télécharger l'image
    const imageBuffer = await downloadImage(card.image_url)

    // 2. Optimiser l'image
    const optimizedBuffer = await optimizeImage(imageBuffer)

    // 3. Upload sur Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(CONFIG.BUCKET)
      .upload(storagePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // 4. Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from(CONFIG.BUCKET)
      .getPublicUrl(storagePath)

    // 5. Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from('cards')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', card.id)

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`)
    }

    return true
  } catch (error) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      await delay(1000 * (retryCount + 1))
      return migrateCard(card, retryCount + 1)
    }
    throw error
  }
}

async function main() {
  logger.section('Migration des images One Piece vers Supabase')

  if (isDryRun) {
    logger.info('Mode DRY RUN - aucune modification ne sera effectuée')
  }

  // Récupérer le TCG One Piece
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    return
  }

  // Récupérer toutes les séries One Piece
  let seriesQuery = supabase
    .from('series')
    .select('id, code')
    .eq('tcg_game_id', tcg.id)

  if (targetSeries) {
    seriesQuery = seriesQuery.eq('code', targetSeries)
  }

  const { data: series } = await seriesQuery

  if (!series || series.length === 0) {
    logger.error('Aucune série trouvée')
    return
  }

  // Récupérer toutes les cartes avec URLs opecards.fr
  const cardsToMigrate: Card[] = []

  for (const s of series) {
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, language, image_url')
      .eq('series_id', s.id)
      .or('image_url.ilike.%opecards.fr%,image_url.ilike.%static.opecards.fr%')

    if (cards) {
      for (const card of cards) {
        cardsToMigrate.push({
          ...card,
          series_code: s.code
        })
      }
    }
  }

  if (cardsToMigrate.length === 0) {
    logger.success('Aucune image à migrer !')
    return
  }

  logger.info(`${cardsToMigrate.length} images à migrer`)

  // Charger la progression
  const progress = loadProgress()
  const alreadyMigrated = new Set(progress.migratedIds)
  const alreadyFailed = new Set(progress.failedIds)

  // Filtrer les cartes déjà migrées
  let pendingCards = cardsToMigrate.filter(c => !alreadyMigrated.has(c.id))

  if (pendingCards.length < cardsToMigrate.length) {
    logger.info(`${cardsToMigrate.length - pendingCards.length} images déjà migrées (reprise)`)
  }

  // Appliquer la limite si spécifiée
  if (limit && limit < pendingCards.length) {
    pendingCards = pendingCards.slice(0, limit)
    logger.info(`Limité à ${limit} images`)
  }

  if (isDryRun) {
    logger.section('Images qui seraient migrées')

    // Grouper par série
    const bySeriesMap = new Map<string, Card[]>()
    for (const card of pendingCards) {
      if (!bySeriesMap.has(card.series_code)) {
        bySeriesMap.set(card.series_code, [])
      }
      bySeriesMap.get(card.series_code)!.push(card)
    }

    for (const [seriesCode, cards] of bySeriesMap) {
      console.log(`\n${seriesCode} (${cards.length} images):`)
      for (const card of cards.slice(0, 3)) {
        const storagePath = getStoragePath(card.series_code, card.language, card.number)
        console.log(`  #${card.number} [${card.language}] -> ${storagePath}`)
      }
      if (cards.length > 3) {
        console.log(`  ... et ${cards.length - 3} autres`)
      }
    }

    logger.section('Fin du dry run')
    return
  }

  // Migration réelle
  logger.section('Début de la migration')

  let successCount = 0
  let errorCount = 0
  const startTime = Date.now()

  for (let i = 0; i < pendingCards.length; i++) {
    const card = pendingCards[i]
    const progressStr = `[${i + 1}/${pendingCards.length}]`

    process.stdout.write(`\r${progressStr} ${card.series_code} #${card.number} [${card.language}]...`)

    try {
      await migrateCard(card)
      successCount++
      progress.migratedIds.push(card.id)

      // Retirer de la liste des échecs si présent
      const failedIndex = progress.failedIds.indexOf(card.id)
      if (failedIndex !== -1) {
        progress.failedIds.splice(failedIndex, 1)
      }

      process.stdout.write(` ✓\n`)
    } catch (error) {
      errorCount++
      progress.failedIds.push(card.id)

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      process.stdout.write(` ✗ ${errorMessage}\n`)

      if (!continueOnError) {
        logger.error('Arrêt suite à une erreur. Utilisez --continue-on-error pour ignorer.')
        saveProgress(progress)
        break
      }
    }

    // Sauvegarder la progression régulièrement
    if ((i + 1) % 10 === 0) {
      saveProgress(progress)
    }

    await delay(CONFIG.DELAY_BETWEEN_DOWNLOADS)
  }

  // Sauvegarder la progression finale
  saveProgress(progress)

  const duration = Math.round((Date.now() - startTime) / 1000)

  logger.section('Résumé de la migration')
  console.log(`✅ Succès: ${successCount}`)
  console.log(`❌ Erreurs: ${errorCount}`)
  console.log(`⏱️  Durée: ${duration}s`)

  if (errorCount === 0 && successCount === pendingCards.length) {
    // Nettoyer le fichier de progression si tout est terminé
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      fs.unlinkSync(CONFIG.PROGRESS_FILE)
      logger.success('Migration terminée avec succès !')
    }
  } else if (errorCount > 0) {
    logger.warn(`${errorCount} erreurs. Relancez le script pour réessayer.`)
  }
}

main().catch(console.error)
