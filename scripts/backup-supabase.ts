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
  batchSize: 1000 // Pour la pagination des grandes tables
}

interface BackupManifest {
  created_at: string
  supabase_url: string
  tables: Record<string, { count: number; file: string }>
  storage: {
    buckets: string[]
    total_files: number
    total_size_bytes: number
  }
  duration_seconds: number
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
  }

  logger.info(`Dossier de backup: ${backupPath}`)

  const manifest: BackupManifest = {
    created_at: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    tables: {},
    storage: {
      buckets: [],
      total_files: 0,
      total_size_bytes: 0
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
            logger.error(`  Erreur: ${error.message}`)
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
        logger.error(`  Exception: ${err}`)
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
          let totalSize = 0

          for (const file of files) {
            const filePath = path.join(storagePath, bucket, file.name)
            const fileDir = path.dirname(filePath)

            fs.mkdirSync(fileDir, { recursive: true })

            const { data, error } = await supabase.storage
              .from(bucket)
              .download(file.name)

            if (error) {
              logger.error(`  Erreur téléchargement ${file.name}: ${error.message}`)
              continue
            }

            if (data) {
              const buffer = Buffer.from(await data.arrayBuffer())
              fs.writeFileSync(filePath, buffer)
              totalSize += buffer.length
              downloaded++

              if (downloaded % 100 === 0) {
                logger.info(`  Progression: ${downloaded}/${files.length}`)
              }
            }
          }

          manifest.storage.total_size_bytes += totalSize
          logger.success(`  ${downloaded} fichiers téléchargés (${formatBytes(totalSize)})`)
        } else {
          // En dry-run, estimer la taille
          const estimatedSize = files.reduce((sum, f) => sum + (f.metadata?.size || 50000), 0)
          manifest.storage.total_size_bytes += estimatedSize
          logger.info(`  Taille estimée: ${formatBytes(estimatedSize)}`)
        }

      } catch (err) {
        logger.error(`  Exception bucket ${bucket}: ${err}`)
      }
    }
  }

  // ========== FINALISATION ==========
  const duration = Math.round((Date.now() - startTime) / 1000)
  manifest.duration_seconds = duration

  if (!dryRun) {
    fs.writeFileSync(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )
  }

  logger.section('Résumé')
  logger.success(`Backup ${dryRun ? '(dry-run) ' : ''}terminé en ${formatDuration(duration)}`)

  if (!storageOnly) {
    const totalRecords = Object.values(manifest.tables).reduce((sum, t) => sum + t.count, 0)
    logger.info(`Base de données: ${totalRecords} enregistrements`)
  }

  if (!dbOnly) {
    logger.info(`Storage: ${manifest.storage.total_files} fichiers (${formatBytes(manifest.storage.total_size_bytes)})`)
  }

  if (!dryRun) {
    logger.info(`Emplacement: ${backupPath}`)
  }
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
