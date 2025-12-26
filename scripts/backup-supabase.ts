/**
 * Script de backup Supabase (Base de données + Storage)
 *
 * Usage:
 *   npx tsx scripts/backup-supabase.ts              # Backup complet
 *   npx tsx scripts/backup-supabase.ts --db-only    # DB uniquement
 *   npx tsx scripts/backup-supabase.ts --storage-only # Storage uniquement
 *   npx tsx scripts/backup-supabase.ts --buckets lorcana-cards,pokemon-cards
 *   npx tsx scripts/backup-supabase.ts --dry-run    # Prévisualisation
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const CONFIG = {
  backupDir: 'backups',
  logsDir: 'scripts/logs',
  tables: [
    'tcg_games',
    'rarities',
    'domains',
    'card_types',
    'pokemon_series',
    'pokemon_types',
    'pokemon_type_translations',
    'series',
    'series_releases',
    'series_translations',
    'cards',
    'user_collections',
    'wishlists'
  ],
  defaultBuckets: [
    'lorcana-cards',
    'pokemon-cards',
    'onepiece-cards',
    'starwars-cards',
    'riftbound-cards'
  ],
  batchSize: 1000, // Pour la pagination des grandes tables
  progressInterval: 100 // Afficher la progression tous les N fichiers
}

interface BackupError {
  type: 'database' | 'storage'
  bucket?: string
  table?: string
  file?: string
  message: string
  timestamp: string
}

interface BackupManifest {
  created_at: string
  supabase_url: string
  tables: Record<string, { count: number; file: string }>
  storage: {
    buckets: string[]
    total_files: number
    downloaded_files: number
    failed_files: number
    total_size_bytes: number
  }
  errors: {
    count: number
    summary: Record<string, number>
  }
  duration_seconds: number
}

// Collecter toutes les erreurs
const allErrors: BackupError[] = []

function addError(error: BackupError) {
  allErrors.push(error)
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null) {
    // Supabase storage error structure
    const err = error as Record<string, unknown>
    if (err.message) return String(err.message)
    if (err.error) return String(err.error)
    if (err.statusCode) return `HTTP ${err.statusCode}`
    // Fallback to JSON stringify if object has properties
    const json = JSON.stringify(error)
    if (json !== '{}') return json
    return 'Erreur inconnue (objet vide)'
  }
  return String(error)
}

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const dbOnly = args.includes('--db-only')
const storageOnly = args.includes('--storage-only')
const bucketsArg = args.find(a => a.startsWith('--buckets='))
const selectedBuckets = bucketsArg
  ? bucketsArg.split('=')[1].split(',')
  : CONFIG.defaultBuckets

async function main() {
  const startTime = Date.now()

  logger.section('Backup Supabase - CollectorVerse TCG')

  if (dryRun) {
    logger.info('Mode dry-run activé - aucune écriture')
  }

  const supabase = createAdminClient()

  // Créer le dossier de backup avec timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.join(CONFIG.backupDir, timestamp)
  const dbPath = path.join(backupPath, 'database')
  const storagePath = path.join(backupPath, 'storage')

  if (!dryRun) {
    fs.mkdirSync(dbPath, { recursive: true })
    fs.mkdirSync(storagePath, { recursive: true })
    fs.mkdirSync(CONFIG.logsDir, { recursive: true })
  }

  logger.info(`Dossier de backup: ${backupPath}`)

  const manifest: BackupManifest = {
    created_at: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    tables: {},
    storage: {
      buckets: [],
      total_files: 0,
      downloaded_files: 0,
      failed_files: 0,
      total_size_bytes: 0
    },
    errors: {
      count: 0,
      summary: {}
    },
    duration_seconds: 0
  }

  // ========== BACKUP BASE DE DONNÉES ==========
  if (!storageOnly) {
    logger.section('Backup Base de données')

    const fullBackup: Record<string, unknown[]> = {}

    for (const table of CONFIG.tables) {
      logger.info(`Table: ${table}`)

      try {
        // Récupérer toutes les données avec pagination
        let allData: unknown[] = []
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(offset, offset + CONFIG.batchSize - 1)

          if (error) {
            const errorMsg = formatError(error)
            logger.error(`  Erreur: ${errorMsg}`)
            addError({
              type: 'database',
              table,
              message: errorMsg,
              timestamp: new Date().toISOString()
            })
            break
          }

          if (data && data.length > 0) {
            allData = allData.concat(data)
            offset += CONFIG.batchSize
            hasMore = data.length === CONFIG.batchSize
          } else {
            hasMore = false
          }
        }

        fullBackup[table] = allData
        manifest.tables[table] = {
          count: allData.length,
          file: `${table}.json`
        }

        logger.success(`  ${allData.length} enregistrements`)

        // Sauvegarder le fichier individuel
        if (!dryRun) {
          fs.writeFileSync(
            path.join(dbPath, `${table}.json`),
            JSON.stringify(allData, null, 2)
          )
        }

      } catch (err) {
        const errorMsg = formatError(err)
        logger.error(`  Exception: ${errorMsg}`)
        addError({
          type: 'database',
          table,
          message: errorMsg,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Sauvegarder le backup complet
    if (!dryRun) {
      fs.writeFileSync(
        path.join(dbPath, 'full-backup.json'),
        JSON.stringify(fullBackup, null, 2)
      )
    }

    const totalRecords = Object.values(manifest.tables).reduce((sum, t) => sum + t.count, 0)
    logger.success(`Total: ${totalRecords} enregistrements dans ${CONFIG.tables.length} tables`)
  }

  // ========== BACKUP STORAGE ==========
  if (!dbOnly) {
    logger.section('Backup Storage')

    for (const bucket of selectedBuckets) {
      logger.info(`Bucket: ${bucket}`)

      try {
        // Lister tous les fichiers du bucket
        const files = await listAllFiles(supabase, bucket)

        if (files.length === 0) {
          logger.warn(`  Bucket vide ou inexistant`)
          continue
        }

        manifest.storage.buckets.push(bucket)
        manifest.storage.total_files += files.length

        logger.info(`  ${files.length} fichiers trouvés`)

        if (!dryRun) {
          // Créer la structure de dossiers et télécharger
          let downloaded = 0
          let failed = 0
          let totalSize = 0

          for (const file of files) {
            const filePath = path.join(storagePath, bucket, file.name)
            const fileDir = path.dirname(filePath)

            fs.mkdirSync(fileDir, { recursive: true })

            const { data, error } = await supabase.storage
              .from(bucket)
              .download(file.name)

            if (error) {
              const errorMsg = formatError(error)
              logger.error(`  Erreur téléchargement ${file.name}: ${errorMsg}`)
              addError({
                type: 'storage',
                bucket,
                file: file.name,
                message: errorMsg,
                timestamp: new Date().toISOString()
              })
              failed++
              continue
            }

            if (data) {
              const buffer = Buffer.from(await data.arrayBuffer())
              fs.writeFileSync(filePath, buffer)
              totalSize += buffer.length
              downloaded++

              if (downloaded % CONFIG.progressInterval === 0) {
                logger.info(`  Progression: ${downloaded}/${files.length} (${failed} erreurs)`)
              }
            }
          }

          manifest.storage.downloaded_files += downloaded
          manifest.storage.failed_files += failed
          manifest.storage.total_size_bytes += totalSize

          if (failed > 0) {
            logger.warn(`  ${downloaded} téléchargés, ${failed} erreurs (${formatBytes(totalSize)})`)
          } else {
            logger.success(`  ${downloaded} fichiers téléchargés (${formatBytes(totalSize)})`)
          }
        } else {
          // En dry-run, estimer la taille
          const estimatedSize = files.reduce((sum, f) => sum + (f.metadata?.size || 50000), 0)
          manifest.storage.total_size_bytes += estimatedSize
          logger.info(`  Taille estimée: ${formatBytes(estimatedSize)}`)
        }

      } catch (err) {
        const errorMsg = formatError(err)
        logger.error(`  Exception bucket ${bucket}: ${errorMsg}`)
        addError({
          type: 'storage',
          bucket,
          message: errorMsg,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  // ========== GÉNÉRATION DU RAPPORT D'ERREURS ==========
  const duration = Math.round((Date.now() - startTime) / 1000)
  manifest.duration_seconds = duration
  manifest.errors.count = allErrors.length

  // Créer un résumé des erreurs par bucket/table
  for (const error of allErrors) {
    const key = error.bucket || error.table || 'unknown'
    manifest.errors.summary[key] = (manifest.errors.summary[key] || 0) + 1
  }

  if (!dryRun) {
    // Sauvegarder le manifest
    fs.writeFileSync(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )

    // Sauvegarder le rapport d'erreurs détaillé
    if (allErrors.length > 0) {
      const errorReport = {
        backup_date: manifest.created_at,
        backup_path: backupPath,
        total_errors: allErrors.length,
        summary: manifest.errors.summary,
        errors_by_bucket: groupErrorsByBucket(allErrors),
        all_errors: allErrors
      }

      // Dans le dossier de backup
      fs.writeFileSync(
        path.join(backupPath, 'errors.json'),
        JSON.stringify(errorReport, null, 2)
      )

      // Dans le dossier logs (pour faciliter l'accès)
      fs.writeFileSync(
        path.join(CONFIG.logsDir, 'backup-errors.json'),
        JSON.stringify(errorReport, null, 2)
      )

      // Créer aussi un fichier texte lisible
      const errorTxt = generateErrorTextReport(errorReport)
      fs.writeFileSync(
        path.join(backupPath, 'errors.txt'),
        errorTxt
      )
      fs.writeFileSync(
        path.join(CONFIG.logsDir, 'backup-errors.txt'),
        errorTxt
      )
    }
  }

  // ========== RÉSUMÉ CONSOLE ==========
  logger.section('Résumé')
  logger.success(`Backup ${dryRun ? '(dry-run) ' : ''}terminé en ${formatDuration(duration)}`)

  if (!storageOnly) {
    const totalRecords = Object.values(manifest.tables).reduce((sum, t) => sum + t.count, 0)
    logger.info(`Base de données: ${totalRecords} enregistrements`)
  }

  if (!dbOnly) {
    const { total_files, downloaded_files, failed_files, total_size_bytes } = manifest.storage
    if (dryRun) {
      logger.info(`Storage: ${total_files} fichiers (${formatBytes(total_size_bytes)})`)
    } else {
      logger.info(`Storage: ${downloaded_files}/${total_files} téléchargés (${formatBytes(total_size_bytes)})`)
      if (failed_files > 0) {
        logger.warn(`  ${failed_files} fichiers en erreur`)
      }
    }
  }

  // Afficher le résumé des erreurs
  if (allErrors.length > 0) {
    logger.section('Erreurs détectées')
    logger.error(`Total: ${allErrors.length} erreurs`)

    // Grouper par bucket/table
    for (const [key, count] of Object.entries(manifest.errors.summary)) {
      logger.warn(`  ${key}: ${count} erreur(s)`)
    }

    // Lister les fichiers en erreur (max 20)
    const storageErrors = allErrors.filter(e => e.type === 'storage' && e.file)
    if (storageErrors.length > 0) {
      logger.info('')
      logger.info(`Fichiers en erreur (${Math.min(storageErrors.length, 20)} premiers):`)
      for (const error of storageErrors.slice(0, 20)) {
        logger.error(`  - ${error.bucket}/${error.file}`)
      }
      if (storageErrors.length > 20) {
        logger.info(`  ... et ${storageErrors.length - 20} autres`)
      }
    }

    if (!dryRun) {
      logger.info('')
      logger.info(`Rapport complet: ${path.join(backupPath, 'errors.txt')}`)
      logger.info(`Rapport JSON: ${path.join(CONFIG.logsDir, 'backup-errors.json')}`)
    }
  } else {
    logger.success('Aucune erreur détectée!')
  }

  if (!dryRun) {
    logger.info('')
    logger.info(`Emplacement du backup: ${backupPath}`)
  }
}

// Grouper les erreurs par bucket
function groupErrorsByBucket(errors: BackupError[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  for (const error of errors) {
    const key = error.bucket || error.table || 'other'
    if (!grouped[key]) {
      grouped[key] = []
    }
    if (error.file) {
      grouped[key].push(error.file)
    } else {
      grouped[key].push(error.message)
    }
  }

  return grouped
}

// Générer un rapport texte lisible
function generateErrorTextReport(report: {
  backup_date: string
  backup_path: string
  total_errors: number
  summary: Record<string, number>
  errors_by_bucket: Record<string, string[]>
}): string {
  const lines: string[] = []

  lines.push('=' .repeat(80))
  lines.push('RAPPORT D\'ERREURS DE BACKUP')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Date: ${report.backup_date}`)
  lines.push(`Backup: ${report.backup_path}`)
  lines.push(`Total erreurs: ${report.total_errors}`)
  lines.push('')

  lines.push('-'.repeat(80))
  lines.push('RÉSUMÉ PAR BUCKET/TABLE')
  lines.push('-'.repeat(80))
  for (const [key, count] of Object.entries(report.summary)) {
    lines.push(`  ${key}: ${count} erreur(s)`)
  }
  lines.push('')

  lines.push('-'.repeat(80))
  lines.push('FICHIERS EN ERREUR PAR BUCKET')
  lines.push('-'.repeat(80))
  for (const [bucket, files] of Object.entries(report.errors_by_bucket)) {
    lines.push('')
    lines.push(`[${bucket}] - ${files.length} fichier(s)`)
    for (const file of files) {
      lines.push(`  - ${file}`)
    }
  }

  lines.push('')
  lines.push('=' .repeat(80))

  return lines.join('\n')
}

// Lister récursivement tous les fichiers d'un bucket
async function listAllFiles(
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix = ''
): Promise<{ name: string; metadata?: { size: number } }[]> {
  const allFiles: { name: string; metadata?: { size: number } }[] = []

  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 })

  if (error || !items) {
    return allFiles
  }

  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name

    if (item.id === null) {
      // C'est un dossier, récursion
      const subFiles = await listAllFiles(supabase, bucket, fullPath)
      allFiles.push(...subFiles)
    } else {
      // C'est un fichier
      allFiles.push({
        name: fullPath,
        metadata: item.metadata as { size: number } | undefined
      })
    }
  }

  return allFiles
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m ${secs}s`
}

main().catch(console.error)
