/**
 * Script de backup complet Supabase (DB + Storage)
 *
 * Usage: npx tsx scripts/backup-supabase.ts
 *
 * Ce script:
 * 1. Exporte toutes les tables de la base de données en JSON
 * 2. Télécharge tous les fichiers du Storage (images)
 * 3. Crée un manifest avec les métadonnées de la backup
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Tables à exporter (dans l'ordre des dépendances)
// Note: Les tables qui n'existent pas seront ignorées avec un warning
const TABLES_TO_BACKUP = [
  // Tables de base
  'tcg_games',

  // Tables de référence (communes)
  'rarities',
  'domains',
  'card_types',

  // Tables Pokémon spécifiques (créées par migration 015)
  'pokemon_series',
  'pokemon_types',
  'pokemon_type_translations',

  // Séries et traductions
  'series',
  'series_releases',
  'series_translations',  // créée par migration 015

  // Cartes
  'cards',

  // Données utilisateurs
  'user_collections',
  'wishlists'
] as const

// Configuration
const BATCH_SIZE = 1000 // Nombre de lignes par requête (limite Supabase)
const STORAGE_DELAY = 50 // Délai entre les téléchargements (ms)

interface BackupManifest {
  created_at: string
  supabase_url: string
  tables: {
    [key: string]: {
      count: number
      file: string
    }
  }
  storage: {
    buckets: string[]
    total_files: number
    total_size_bytes: number
  }
  duration_seconds: number
}

const supabase = createAdminClient()

// Dossier de backup avec timestamp complet
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupDir = `./backups/${timestamp}`

async function backupDatabase(): Promise<BackupManifest['tables']> {
  logger.section('EXPORT DES TABLES')

  const dbBackupDir = join(backupDir, 'database')
  if (!existsSync(dbBackupDir)) mkdirSync(dbBackupDir, { recursive: true })

  const tableStats: BackupManifest['tables'] = {}
  const allData: Record<string, unknown[]> = {}

  for (const tableName of TABLES_TO_BACKUP) {
    logger.processing(`Export de la table: ${tableName}`)

    try {
      // Récupérer toutes les lignes avec pagination
      let allRows: unknown[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(offset, offset + BATCH_SIZE - 1)
          .order('created_at', { ascending: true })

        if (error) {
          // Ignorer silencieusement les tables qui n'existent pas encore
          if (
            error.message.includes('does not exist') ||
            error.message.includes('Could not find the table') ||
            error.code === '42P01' ||
            error.code === 'PGRST204'
          ) {
            logger.warn(`Table ${tableName} n'existe pas encore (skip)`)
            break
          }
          logger.error(`Erreur sur ${tableName}: ${error.message}`)
          break
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data)
          offset += BATCH_SIZE

          if (data.length < BATCH_SIZE) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }

      // Sauvegarder en JSON
      const fileName = `${tableName}.json`
      writeFileSync(
        join(dbBackupDir, fileName),
        JSON.stringify(allRows, null, 2),
        'utf-8'
      )

      allData[tableName] = allRows
      tableStats[tableName] = {
        count: allRows.length,
        file: fileName
      }

      logger.success(`${tableName}: ${allRows.length.toLocaleString()} lignes`)

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`Échec export ${tableName}: ${message}`)
    }
  }

  // Sauvegarde complète en un seul fichier
  writeFileSync(
    join(dbBackupDir, 'full-backup.json'),
    JSON.stringify(allData, null, 2),
    'utf-8'
  )

  logger.success(`Base de données exportée dans ${dbBackupDir}`)
  return tableStats
}

async function backupStorage(): Promise<BackupManifest['storage']> {
  logger.section('EXPORT DU STORAGE')

  const storageStats: BackupManifest['storage'] = {
    buckets: [],
    total_files: 0,
    total_size_bytes: 0
  }

  // Liste des buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

  if (bucketsError) {
    logger.error(`Erreur liste buckets: ${bucketsError.message}`)
    return storageStats
  }

  if (!buckets || buckets.length === 0) {
    logger.info('Aucun bucket trouvé')
    return storageStats
  }

  logger.info(`${buckets.length} bucket(s) trouvé(s): ${buckets.map(b => b.name).join(', ')}`)

  for (const bucket of buckets) {
    logger.processing(`Téléchargement du bucket: ${bucket.name}`)

    const bucketDir = join(backupDir, 'storage', bucket.name)
    if (!existsSync(bucketDir)) mkdirSync(bucketDir, { recursive: true })

    storageStats.buckets.push(bucket.name)

    // Télécharger récursivement tous les fichiers
    const result = await backupBucketFolder(bucket.name, '', bucketDir)
    storageStats.total_files += result.count
    storageStats.total_size_bytes += result.size

    logger.success(`${bucket.name}: ${result.count.toLocaleString()} fichiers (${formatBytes(result.size)})`)
  }

  return storageStats
}

async function backupBucketFolder(
  bucketName: string,
  folderPath: string,
  localDir: string
): Promise<{ count: number; size: number }> {
  let totalCount = 0
  let totalSize = 0

  const { data: items, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) {
    logger.error(`Erreur liste ${bucketName}/${folderPath}: ${error.message}`)
    return { count: 0, size: 0 }
  }

  if (!items || items.length === 0) {
    return { count: 0, size: 0 }
  }

  for (const item of items) {
    const remotePath = folderPath ? `${folderPath}/${item.name}` : item.name
    const localPath = join(localDir, item.name)

    // Si c'est un dossier (id null), récurser
    if (item.id === null) {
      const subDir = join(localDir, item.name)
      if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true })
      const subResult = await backupBucketFolder(bucketName, remotePath, subDir)
      totalCount += subResult.count
      totalSize += subResult.size
      continue
    }

    // C'est un fichier, le télécharger
    try {
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(remotePath)

      if (downloadError) {
        logger.warn(`Skip ${remotePath}: ${downloadError.message}`)
        continue
      }

      if (data) {
        const buffer = Buffer.from(await data.arrayBuffer())
        writeFileSync(localPath, buffer)
        totalCount++
        totalSize += buffer.length

        // Progression tous les 100 fichiers
        if (totalCount % 100 === 0) {
          logger.progress(`  ${totalCount.toLocaleString()} fichiers téléchargés...`)
        }
      }

      // Petit délai pour éviter le rate limiting
      await delay(STORAGE_DELAY)

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn(`Erreur download ${remotePath}: ${message}`)
    }
  }

  return { count: totalCount, size: totalSize }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

async function main() {
  const startTime = Date.now()

  console.log('\n')
  logger.section(`BACKUP SUPABASE - ${timestamp}`)

  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })
  logger.success(`Dossier de backup: ${backupDir}`)

  // Exécuter les backups
  const tableStats = await backupDatabase()
  const storageStats = await backupStorage()

  // Créer le manifest
  const endTime = Date.now()
  const manifest: BackupManifest = {
    created_at: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    tables: tableStats,
    storage: storageStats,
    duration_seconds: Math.round((endTime - startTime) / 1000)
  }

  // Sauvegarder le manifest
  writeFileSync(
    join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  )

  // Résumé final
  logger.section('RÉSUMÉ DE LA BACKUP')

  const totalRows = Object.values(tableStats).reduce((sum, t) => sum + t.count, 0)

  logger.info(`📁 Dossier: ${backupDir}`)
  logger.info(`📊 Tables: ${Object.keys(tableStats).length}`)
  logger.info(`📝 Lignes totales: ${totalRows.toLocaleString()}`)
  logger.info(`🗄️  Buckets: ${storageStats.buckets.length}`)
  logger.info(`📦 Fichiers storage: ${storageStats.total_files.toLocaleString()}`)
  logger.info(`💾 Taille storage: ${formatBytes(storageStats.total_size_bytes)}`)
  logger.info(`⏱️  Durée: ${manifest.duration_seconds}s`)

  logger.separator()
  logger.success('BACKUP TERMINÉE AVEC SUCCÈS!')
}

main().catch((err) => {
  logger.error(`Erreur fatale: ${err.message}`)
  process.exit(1)
})
