/**
 * Script pour corriger les URLs d'images des cartes PRB01 et PRB02
 *
 * Problème : Les cartes ont des URLs source (static.opecards.fr) au lieu des URLs storage (Supabase)
 * Solution : Mettre à jour les image_url pour pointer vers le storage Supabase
 *
 * Usage:
 *   npx tsx scripts/fix-prb-storage-urls.ts --dry-run
 *   npx tsx scripts/fix-prb-storage-urls.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

const SERIES_IDS = {
  PRB01: 'bc700b8d-5f56-437e-8ab7-92b8b39d6ef7',
  PRB02: '2d872f15-9ac9-4132-806c-0eae9ff5d706'
}

const dryRun = process.argv.includes('--dry-run')

/**
 * Convertit un numéro de carte en nom de fichier storage
 * Ex: OP01-006-UC-FA => OP01-006-UC-FA.webp
 *     OP01-006-UC => OP01-006-UC.webp
 */
function getStorageFileName(cardNumber: string): string {
  return `${cardNumber}.webp`
}

/**
 * Construit le chemin storage complet
 * Ex: PRB01/en/OP01-006-UC-FA.webp
 */
function getStoragePath(seriesCode: string, language: string, cardNumber: string): string {
  return `${seriesCode}/${language.toLowerCase()}/${getStorageFileName(cardNumber)}`
}

async function main() {
  logger.section('Correction des URLs images PRB')
  console.log(`Mode: ${dryRun ? 'DRY-RUN (aucune modification)' : 'PRODUCTION (mise à jour DB)'}`)

  for (const [seriesCode, seriesId] of Object.entries(SERIES_IDS)) {
    logger.section(`${seriesCode}`)

    // Récupérer toutes les cartes avec URLs source
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, number, name, image_url, language')
      .eq('series_id', seriesId)
      .like('image_url', 'https://static.opecards.fr%')

    if (error) {
      logger.error(`Erreur récupération ${seriesCode}: ${error.message}`)
      continue
    }

    logger.info(`${cards?.length || 0} cartes avec URLs source trouvées`)

    if (!cards || cards.length === 0) {
      logger.warn('Aucune carte à corriger')
      continue
    }

    // Pour chaque carte, vérifier si le fichier existe dans le storage
    let updated = 0
    let notFound = 0
    let errors = 0

    for (const card of cards) {
      const storagePath = getStoragePath(seriesCode, card.language, card.number)

      // Vérifier si le fichier existe
      const { data: fileExists, error: checkError } = await supabase.storage
        .from('onepiece-cards')
        .list(`${seriesCode}/${card.language.toLowerCase()}`, {
          search: getStorageFileName(card.number)
        })

      if (checkError) {
        logger.error(`Erreur vérification ${storagePath}: ${checkError.message}`)
        errors++
        continue
      }

      if (!fileExists || fileExists.length === 0) {
        console.log(`  ❌ ${card.number} (${card.language}): fichier non trouvé dans storage`)
        notFound++
        continue
      }

      // Construire la nouvelle URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('onepiece-cards')
        .getPublicUrl(storagePath)

      console.log(`  ✅ ${card.number} (${card.language}): ${card.name}`)
      console.log(`     OLD: ${card.image_url?.substring(0, 80)}...`)
      console.log(`     NEW: ${publicUrl}`)

      // Mettre à jour la DB (sauf en dry-run)
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('cards')
          .update({ image_url: publicUrl })
          .eq('id', card.id)

        if (updateError) {
          logger.error(`Erreur mise à jour ${card.number}: ${updateError.message}`)
          errors++
          continue
        }
      }

      updated++
    }

    logger.section(`Résumé ${seriesCode}`)
    logger.success(`Cartes mises à jour: ${updated}`)
    if (notFound > 0) logger.warn(`Fichiers non trouvés: ${notFound}`)
    if (errors > 0) logger.error(`Erreurs: ${errors}`)
  }

  if (dryRun) {
    logger.section('Mode DRY-RUN')
    logger.info('Aucune modification effectuée. Relancez sans --dry-run pour appliquer les changements.')
  } else {
    logger.section('Terminé!')
    logger.success('URLs corrigées avec succès')
  }
}

main().catch(console.error)
