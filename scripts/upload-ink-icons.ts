/**
 * Script pour uploader les icônes d'encre Lorcana sur Supabase Storage
 * Structure: ink/FR/{nom-francais}.webp
 *
 * Usage: npx tsx scripts/upload-ink-icons.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { DELAYS } from '../lib/constants/app-config'
import * as fs from 'fs'
import * as path from 'path'

// Mapping des noms d'encre anglais -> français (sans accents pour les URLs)
const INK_TRANSLATIONS: Record<string, string> = {
  'amber': 'ambre',
  'amethyst': 'amethyste',
  'emerald': 'emeraude',
  'ruby': 'rubis',
  'sapphire': 'saphir',
  'steel': 'acier'
}

// Bucket pour les assets Lorcana
const BUCKET_NAME = 'lorcana-cards'

// Chemin local des icônes source
const LOCAL_ICONS_PATH = path.resolve(process.cwd(), 'public/images/icons/inks')

async function uploadInkIcons() {
  logger.section('Upload des icônes d\'encre Lorcana - Version FR')

  const supabase = createAdminClient()

  // Vérifier que le bucket existe
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
  if (bucketError) {
    logger.error(`Erreur liste buckets: ${bucketError.message}`)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
  if (!bucketExists) {
    logger.warn(`Le bucket "${BUCKET_NAME}" n'existe pas, création...`)
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })
    if (createError) {
      logger.error(`Erreur création bucket: ${createError.message}`)
      process.exit(1)
    }
    logger.success(`Bucket "${BUCKET_NAME}" créé`)
  }

  // Vérifier que le dossier local existe
  if (!fs.existsSync(LOCAL_ICONS_PATH)) {
    logger.error(`Dossier source non trouvé: ${LOCAL_ICONS_PATH}`)
    process.exit(1)
  }

  logger.info(`Dossier source: ${LOCAL_ICONS_PATH}`)
  logger.info(`Destination: ${BUCKET_NAME}/ink/FR/`)

  // Parcourir les icônes à uploader
  const entries = Object.entries(INK_TRANSLATIONS)
  let successCount = 0
  let errorCount = 0

  for (const [englishName, frenchName] of entries) {
    const sourceFile = path.join(LOCAL_ICONS_PATH, `${englishName}.webp`)
    const destPath = `ink/FR/${frenchName}.webp`

    // Vérifier que le fichier source existe
    if (!fs.existsSync(sourceFile)) {
      logger.warn(`Fichier source non trouvé: ${sourceFile}`)
      errorCount++
      continue
    }

    logger.processing(`Upload: ${englishName}.webp -> ${destPath}`)

    // Lire le fichier
    const fileBuffer = fs.readFileSync(sourceFile)

    // Upload sur Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(destPath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true // Remplacer si existe déjà
      })

    if (error) {
      logger.error(`Erreur upload ${frenchName}: ${error.message}`)
      errorCount++
    } else {
      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(destPath)

      logger.success(`${frenchName}.webp uploadé -> ${urlData.publicUrl}`)
      successCount++
    }

    await delay(DELAYS.betweenUploads)
  }

  // Résumé
  logger.section('Résumé')
  logger.info(`Total: ${entries.length} icônes`)
  logger.success(`Réussis: ${successCount}`)
  if (errorCount > 0) {
    logger.error(`Erreurs: ${errorCount}`)
  }

  // Afficher les URLs finales
  logger.section('URLs des icônes FR')
  for (const [, frenchName] of entries) {
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`ink/FR/${frenchName}.webp`)
    console.log(`  ${frenchName}: ${urlData.publicUrl}`)
  }
}

// Exécution
uploadInkIcons().catch(error => {
  logger.error(`Erreur fatale: ${error.message}`)
  process.exit(1)
})
