/**
 * Script de réorganisation du storage Supabase pour les cartes Lorcana
 *
 * Ce script effectue les opérations suivantes :
 * 1. Renomme les dossiers de séries avec de nouveaux noms
 * 2. Supprime les doublons (garde uniquement FR et EN)
 * 3. Fusionne QU1 et QU2 en Quest
 * 4. Crée la structure Promo avec P1, P2, P3
 * 5. Réorganise les cartes promo
 *
 * Usage: npx tsx scripts/reorganize-lorcana-storage.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'

const BUCKET_NAME = 'lorcana-cards'

// Mapping des renommages de dossiers
const FOLDER_RENAMES: Record<string, string> = {
  'ROTF': 'Floodborn',
  'AZS': 'Azurite',
  'FAB': 'Faboulus',
  'ITI': 'Ink',
  'ROJ': 'Jafar',
  'SSK': 'Ciel',
  'URR': 'Ursula',
  'WHW': 'Lueur'
}

// Langues valides à conserver
const VALID_LANGUAGES = ['FR', 'EN']

const supabase = createAdminClient()

interface FileInfo {
  name: string
  path: string
}

/**
 * Liste tous les fichiers dans un dossier (récursif)
 */
async function listFilesInFolder(folder: string): Promise<FileInfo[]> {
  const files: FileInfo[] = []

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folder, { limit: 1000 })

  if (error) {
    logger.error(`Erreur listing ${folder}: ${error.message}`)
    return []
  }

  if (!data) return []

  for (const item of data) {
    if (item.id === null) {
      // C'est un dossier, lister récursivement
      const subFiles = await listFilesInFolder(`${folder}/${item.name}`)
      files.push(...subFiles)
    } else {
      // C'est un fichier
      files.push({
        name: item.name,
        path: `${folder}/${item.name}`
      })
    }
  }

  return files
}

/**
 * Liste les dossiers de premier niveau dans le bucket
 */
async function listRootFolders(): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { limit: 1000 })

  if (error) {
    logger.error(`Erreur listing root: ${error.message}`)
    return []
  }

  // Filtrer pour ne garder que les dossiers (id === null)
  return data?.filter(item => item.id === null).map(item => item.name) || []
}

/**
 * Copie un fichier vers un nouveau chemin
 */
async function copyFile(sourcePath: string, destPath: string): Promise<boolean> {
  try {
    // Télécharger le fichier source
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(sourcePath)

    if (downloadError) {
      logger.error(`Erreur download ${sourcePath}: ${downloadError.message}`)
      return false
    }

    // Upload vers la destination
    const arrayBuffer = await downloadData.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(destPath, arrayBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      logger.error(`Erreur upload ${destPath}: ${uploadError.message}`)
      return false
    }

    return true
  } catch (error) {
    logger.error(`Erreur copie ${sourcePath} -> ${destPath}: ${error}`)
    return false
  }
}

/**
 * Supprime un fichier
 */
async function deleteFile(path: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    logger.error(`Erreur suppression ${path}: ${error.message}`)
    return false
  }
  return true
}

/**
 * Supprime tous les fichiers d'un dossier
 */
async function deleteFolder(folder: string): Promise<number> {
  const files = await listFilesInFolder(folder)
  let deletedCount = 0

  if (files.length === 0) return 0

  // Supprimer par lots de 100
  for (let i = 0; i < files.length; i += 100) {
    const batch = files.slice(i, i + 100).map(f => f.path)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(batch)

    if (!error) {
      deletedCount += batch.length
    }
    await delay(100)
  }

  return deletedCount
}

/**
 * Détermine si un fichier est dans un sous-dossier de langue valide (FR ou EN)
 */
function isValidLanguageFile(filePath: string): boolean {
  const parts = filePath.split('/')
  // Vérifier si un des segments du chemin est FR ou EN
  return parts.some(part => VALID_LANGUAGES.includes(part.toUpperCase()))
}

/**
 * Extrait la langue d'un chemin de fichier
 */
function extractLanguage(filePath: string): string | null {
  const parts = filePath.split('/')
  for (const part of parts) {
    if (VALID_LANGUAGES.includes(part.toUpperCase())) {
      return part.toUpperCase()
    }
  }
  return null
}

/**
 * Renomme un dossier et garde uniquement les fichiers FR et EN
 */
async function renameFolderKeepValidLanguages(oldName: string, newName: string): Promise<void> {
  logger.section(`Traitement: ${oldName} → ${newName}`)

  const files = await listFilesInFolder(oldName)
  logger.info(`Trouvé ${files.length} fichiers dans ${oldName}`)

  let copiedCount = 0
  let skippedCount = 0

  for (const file of files) {
    const lang = extractLanguage(file.path)

    if (lang) {
      // Fichier dans un dossier de langue valide
      const relativePath = file.path.replace(`${oldName}/`, '')
      const newPath = `${newName}/${relativePath}`

      logger.processing(`Copie ${file.path} → ${newPath}`)
      if (await copyFile(file.path, newPath)) {
        copiedCount++
      }
    } else {
      // Fichier hors des dossiers de langue - vérifier si c'est un doublon FR
      // Ces fichiers sont considérés comme des doublons FR à supprimer
      skippedCount++
      logger.info(`Ignoré (doublon): ${file.path}`)
    }

    await delay(50)
  }

  logger.success(`${copiedCount} fichiers copiés, ${skippedCount} doublons ignorés`)

  // Supprimer l'ancien dossier
  logger.processing(`Suppression de l'ancien dossier ${oldName}...`)
  const deletedCount = await deleteFolder(oldName)
  logger.success(`${deletedCount} fichiers supprimés de ${oldName}`)
}

/**
 * Traite le dossier D100 - garde uniquement FR
 */
async function processD100(): Promise<void> {
  logger.section('Traitement: D100 (garder uniquement FR)')

  const files = await listFilesInFolder('D100')
  logger.info(`Trouvé ${files.length} fichiers dans D100`)

  let deletedCount = 0

  for (const file of files) {
    const isFR = file.path.includes('/FR/') || file.path.includes('/fr/')

    if (!isFR) {
      logger.processing(`Suppression ${file.path}`)
      if (await deleteFile(file.path)) {
        deletedCount++
      }
      await delay(50)
    }
  }

  logger.success(`${deletedCount} fichiers supprimés (non-FR)`)
}

/**
 * Fusionne QU1 et QU2 en Quest/FR
 */
async function mergeQuestFolders(): Promise<void> {
  logger.section('Fusion: QU1 + QU2 → Quest/FR')

  const processedFiles = new Set<string>()
  let copiedCount = 0

  for (const folder of ['QU1', 'QU2']) {
    const files = await listFilesInFolder(folder)
    logger.info(`Trouvé ${files.length} fichiers dans ${folder}`)

    for (const file of files) {
      // Extraire le nom du fichier uniquement
      const fileName = file.name

      // Vérifier si on a déjà traité ce fichier (doublon)
      if (processedFiles.has(fileName)) {
        logger.info(`Doublon ignoré: ${file.path}`)
        continue
      }

      const newPath = `Quest/FR/${fileName}`
      logger.processing(`Copie ${file.path} → ${newPath}`)

      if (await copyFile(file.path, newPath)) {
        processedFiles.add(fileName)
        copiedCount++
      }

      await delay(50)
    }
  }

  logger.success(`${copiedCount} fichiers copiés vers Quest/FR`)

  // Supprimer les anciens dossiers
  for (const folder of ['QU1', 'QU2']) {
    logger.processing(`Suppression de ${folder}...`)
    const deleted = await deleteFolder(folder)
    logger.success(`${deleted} fichiers supprimés de ${folder}`)
  }
}

/**
 * Traite le dossier "9" - déplace vers Promo/P3/FR
 */
async function processFolder9(): Promise<void> {
  logger.section('Traitement: 9 → Promo/P3/FR')

  const files = await listFilesInFolder('9')
  logger.info(`Trouvé ${files.length} fichiers dans le dossier 9`)

  let copiedCount = 0

  for (const file of files) {
    const newPath = `Promo/P3/FR/${file.name}`
    logger.processing(`Copie ${file.path} → ${newPath}`)

    if (await copyFile(file.path, newPath)) {
      copiedCount++
    }

    await delay(50)
  }

  logger.success(`${copiedCount} fichiers copiés vers Promo/P3/FR`)

  // Supprimer l'ancien dossier
  logger.processing('Suppression du dossier 9...')
  const deleted = await deleteFolder('9')
  logger.success(`${deleted} fichiers supprimés du dossier 9`)
}

/**
 * Traite le dossier "P" - parse les noms et déplace vers Promo/{P1|P2|P3}/{lang}
 * Exemple: DE-7-p2.webp → Promo/P2/FR/FR-7-P2.webp
 */
async function processFolderP(): Promise<void> {
  logger.section('Traitement: P → Promo/{P1|P2|P3}/{lang}')

  const files = await listFilesInFolder('P')
  logger.info(`Trouvé ${files.length} fichiers dans le dossier P`)

  let copiedCount = 0

  for (const file of files) {
    // Parser le nom du fichier: DE-7-p2.webp ou FR-5-P1.webp
    const match = file.name.match(/^([A-Z]{2})-(\d+)-([Pp]\d)\.webp$/i)

    if (!match) {
      logger.warn(`Format non reconnu: ${file.name}`)
      continue
    }

    let [, lang, number, promoCode] = match
    promoCode = promoCode.toUpperCase() // Normaliser en majuscules

    // Remplacer DE par FR
    if (lang.toUpperCase() === 'DE') {
      lang = 'FR'
    }

    const newFileName = `${lang.toUpperCase()}-${number}-${promoCode}.webp`
    const newPath = `Promo/${promoCode}/${lang.toUpperCase()}/${newFileName}`

    logger.processing(`Copie ${file.path} → ${newPath}`)

    if (await copyFile(file.path, newPath)) {
      copiedCount++
    }

    await delay(50)
  }

  logger.success(`${copiedCount} fichiers copiés vers Promo/`)

  // Supprimer l'ancien dossier
  logger.processing('Suppression du dossier P...')
  const deleted = await deleteFolder('P')
  logger.success(`${deleted} fichiers supprimés du dossier P`)
}

/**
 * Traite le dossier "P3" - garde uniquement les fichiers FR contenant P3
 */
async function processFolderP3(): Promise<void> {
  logger.section('Traitement: P3 → Promo/P3/FR (fichiers FR avec P3)')

  const files = await listFilesInFolder('P3')
  logger.info(`Trouvé ${files.length} fichiers dans le dossier P3`)

  let copiedCount = 0

  for (const file of files) {
    // Vérifier si le fichier est dans FR et contient P3
    const isFR = file.path.includes('/FR/') || file.path.includes('/fr/')
    const hasP3 = file.name.toLowerCase().includes('p3')

    if (isFR && hasP3) {
      const newPath = `Promo/P3/FR/${file.name}`
      logger.processing(`Copie ${file.path} → ${newPath}`)

      if (await copyFile(file.path, newPath)) {
        copiedCount++
      }

      await delay(50)
    } else {
      logger.info(`Ignoré: ${file.path} (isFR=${isFR}, hasP3=${hasP3})`)
    }
  }

  logger.success(`${copiedCount} fichiers copiés vers Promo/P3/FR`)

  // Supprimer l'ancien dossier
  logger.processing('Suppression du dossier P3...')
  const deleted = await deleteFolder('P3')
  logger.success(`${deleted} fichiers supprimés du dossier P3`)
}

/**
 * Affiche la structure actuelle du storage
 */
async function showCurrentStructure(): Promise<void> {
  logger.section('Structure actuelle du storage')

  const folders = await listRootFolders()
  logger.info(`Dossiers trouvés: ${folders.join(', ')}`)

  for (const folder of folders) {
    const files = await listFilesInFolder(folder)
    logger.info(`  ${folder}: ${files.length} fichiers`)
  }
}

/**
 * Fonction principale
 */
async function main(): Promise<void> {
  logger.section('🚀 Réorganisation du storage Lorcana')

  // Afficher la structure actuelle
  await showCurrentStructure()

  // 1. Renommer les dossiers et garder uniquement FR/EN
  for (const [oldName, newName] of Object.entries(FOLDER_RENAMES)) {
    await renameFolderKeepValidLanguages(oldName, newName)
    await delay(500)
  }

  // 2. Traiter D100 (garder uniquement FR)
  await processD100()
  await delay(500)

  // 3. Fusionner QU1 et QU2 en Quest
  await mergeQuestFolders()
  await delay(500)

  // 4. Traiter les dossiers promo
  await processFolder9()
  await delay(500)

  await processFolderP()
  await delay(500)

  await processFolderP3()
  await delay(500)

  // Afficher la structure finale
  logger.section('📊 Structure finale du storage')
  await showCurrentStructure()

  logger.section('✅ Réorganisation terminée!')
}

// Exécuter le script
main().catch((error) => {
  logger.error(`Erreur fatale: ${error}`)
  process.exit(1)
})
