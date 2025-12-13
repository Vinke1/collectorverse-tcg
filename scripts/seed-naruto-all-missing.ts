/**
 * Script complet pour ajouter toutes les cartes Naruto Kayou manquantes
 * et effectuer les renommages nécessaires
 *
 * Usage:
 *   npx tsx scripts/seed-naruto-all-missing.ts              # Exécuter
 *   npx tsx scripts/seed-naruto-all-missing.ts --dry-run    # Mode test
 */

import { createNarutoBucket, uploadNarutoCardImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// Configuration
const SERIES_CODE = 'KAYOU'
const LANGUAGE = 'ZH'

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Initialize Supabase
const supabase = createAdminClient()

interface CardToAdd {
  number: string       // Numéro final de la carte (ex: "AR-001", "NRSS-AR-001")
  rarity: string       // Rareté pour la DB
  sourceUrl: string    // URL source de l'image
  storagePath: string  // Chemin dans le storage (ex: "AR/001.webp")
}

interface CardToRename {
  oldNumber: string
  newNumber: string
}

/**
 * Récupère l'ID de la série KAYOU
 */
async function getSeriesId(): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (error || !data) {
    throw new Error(`Série ${SERIES_CODE} non trouvée: ${error?.message}`)
  }

  return data.id
}

/**
 * Renomme une carte existante
 */
async function renameCard(seriesId: string, oldNumber: string, newNumber: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('cards')
    .select('id, name')
    .eq('series_id', seriesId)
    .eq('number', oldNumber)
    .eq('language', LANGUAGE)
    .single()

  if (!existing) {
    logger.warn(`  Carte ${oldNumber} non trouvée, skip`)
    return false
  }

  const { error } = await supabase
    .from('cards')
    .update({
      number: newNumber,
      name: newNumber
    })
    .eq('id', existing.id)

  if (error) {
    logger.error(`  Erreur renommage ${oldNumber} → ${newNumber}: ${error.message}`)
    return false
  }

  logger.success(`  ✅ ${oldNumber} → ${newNumber}`)
  return true
}

/**
 * Vérifie si une carte existe déjà
 */
async function cardExists(seriesId: string, cardNumber: string): Promise<boolean> {
  const { data } = await supabase
    .from('cards')
    .select('id')
    .eq('series_id', seriesId)
    .eq('number', cardNumber)
    .eq('language', LANGUAGE)
    .single()

  return !!data
}

/**
 * Teste si une URL est accessible
 */
async function testUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Ajoute une carte
 */
async function addCard(seriesId: string, card: CardToAdd): Promise<boolean> {
  // Vérifier si existe déjà
  if (await cardExists(seriesId, card.number)) {
    logger.info(`  ⏭️  ${card.number} existe déjà, skip`)
    return false
  }

  // Vérifier URL
  const urlValid = await testUrl(card.sourceUrl)
  if (!urlValid) {
    logger.error(`  ❌ URL inaccessible: ${card.sourceUrl}`)
    return false
  }

  // Upload image - extraire le numéro et la rareté du storagePath
  const pathParts = card.storagePath.replace('.webp', '').split('/')
  const rarityFolder = pathParts[0]
  const cardNum = pathParts[1]

  const uploadResult = await uploadNarutoCardImage(
    card.sourceUrl,
    cardNum,
    rarityFolder
  )

  const finalImageUrl = uploadResult.success ? uploadResult.url! : card.sourceUrl

  // Insertion en base
  const { error } = await supabase
    .from('cards')
    .upsert({
      series_id: seriesId,
      name: card.number,
      number: card.number,
      language: LANGUAGE,
      rarity: card.rarity,
      image_url: finalImageUrl,
      attributes: {
        source: 'narutopia.fr',
        has_foil_variant: true
      }
    }, {
      onConflict: 'series_id,number,language',
      ignoreDuplicates: false
    })

  if (error) {
    logger.error(`  ❌ Erreur insertion ${card.number}: ${error.message}`)
    return false
  }

  logger.success(`  ✅ ${card.number} ajoutée`)
  return true
}

/**
 * Génère toutes les cartes à ajouter
 */
function generateAllCards(): CardToAdd[] {
  const cards: CardToAdd[] = []

  // ===== AR =====
  // AR-001 à AR-010 (GOLD) - les vraies AR
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `AR-${num}`,
      rarity: 'another-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/08/AR-${num}-GOLD.webp`,
      storagePath: `AR/${num}.webp`
    })
  }

  // NRSS-AR-001 à NRSS-AR-004 (nouvel an)
  const nrssArUrls: Record<number, string> = {
    1: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-AR-001-768x1135.webp',
    2: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-AR-002.webp',
    3: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-AR-003.webp',
    4: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-AR-004.webp'
  }
  for (let i = 1; i <= 4; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `NRSS-AR-${num}`,
      rarity: 'another-rare',
      sourceUrl: nrssArUrls[i],
      storagePath: `NRSS-AR/${num}.webp`
    })
  }

  // ===== BP =====
  // BP-028 à BP-034
  for (let i = 28; i <= 34; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `BP-${num}`,
      rarity: 'bp',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-BP-${num}.webp`,
      storagePath: `BP/${num}.webp`
    })
  }

  // ===== CR =====
  // CR-023 à CR-026
  for (let i = 23; i <= 26; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `CR-${num}`,
      rarity: 'cr',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/11/NRB07-CR-${num}L5.webp`,
      storagePath: `CR/${num}.webp`
    })
  }

  // ===== HR (Special Nouvel An) =====
  // SS-HR-001 à SS-HR-010
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SS-HR-${num}`,
      rarity: 'hyper-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/08/SS-HR-${num}.webp`,
      storagePath: `SS-HR/${num}.webp`
    })
  }
  // SS-HR-011 à SS-HR-020 (scaled, sauf 016)
  for (let i = 11; i <= 20; i++) {
    const num = i.toString().padStart(3, '0')
    let url: string
    if (i === 16) {
      url = 'https://narutopia.fr/wp-content/uploads/2023/08/SS-HR-016-1462x2048.webp'
    } else {
      url = `https://narutopia.fr/wp-content/uploads/2023/08/SS-HR-${num}-scaled.webp`
    }
    cards.push({
      number: `SS-HR-${num}`,
      rarity: 'hyper-rare',
      sourceUrl: url,
      storagePath: `SS-HR/${num}.webp`
    })
  }

  // ===== MR =====
  // MR-063 à MR-068
  for (let i = 63; i <= 68; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `MR-${num}`,
      rarity: 'master-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-MR-${num}.webp`,
      storagePath: `MR/${num}.webp`
    })
  }
  // MR-069 à MR-072
  for (let i = 69; i <= 72; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `MR-${num}`,
      rarity: 'master-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/11/NRB07-MR-${num}L4.webp`,
      storagePath: `MR/${num}.webp`
    })
  }

  // ===== OR (Special Edition) =====
  // SS-OR-001 à SS-OR-005
  for (let i = 1; i <= 5; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SS-OR-${num}`,
      rarity: 'origin-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/05/SS-OR-${i}.webp`,
      storagePath: `SS-OR/${num}.webp`
    })
  }

  // ===== PR =====
  // PR-045
  cards.push({
    number: 'PR-045',
    rarity: 'promo',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2024/01/PR-45-NARUTO-KAYOU-NARUTOPIA.webp',
    storagePath: 'PR/045.webp'
  })
  // PR-046 à PR-053
  for (let i = 46; i <= 53; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `PR-${num}`,
      rarity: 'promo',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/02/PR-${i}-NARUTO-KAYOU.webp`,
      storagePath: `PR/${num}.webp`
    })
  }
  // PR-054
  cards.push({
    number: 'PR-054',
    rarity: 'promo',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2024/06/PR-54-Pain-Kayou.webp',
    storagePath: 'PR/054.webp'
  })
  // PR-055 et PR-056
  cards.push({
    number: 'PR-055',
    rarity: 'promo',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2024/10/NR-PR-055-naruto-kayou-serie-6.webp',
    storagePath: 'PR/055.webp'
  })
  cards.push({
    number: 'PR-056',
    rarity: 'promo',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2024/10/NR-PR-056-naruto-kayou-serie-6.webp',
    storagePath: 'PR/056.webp'
  })

  // ===== SE =====
  // SE-013 à SE-016
  for (let i = 13; i <= 16; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SE-${num}`,
      rarity: 'se',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-SE-${num}.webp`,
      storagePath: `SE/${num}.webp`
    })
  }
  // NRSS-SE-001 et NRSS-SE-002
  cards.push({
    number: 'NRSS-SE-001',
    rarity: 'se',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2023/08/SE-01-NOUVEL-AN.webp',
    storagePath: 'NRSS-SE/001.webp'
  })
  cards.push({
    number: 'NRSS-SE-002',
    rarity: 'se',
    sourceUrl: 'https://narutopia.fr/wp-content/uploads/2023/08/SE-02-NOUVEL-AN.webp',
    storagePath: 'NRSS-SE/002.webp'
  })

  // ===== SP =====
  // SP-070 à SP-073
  for (let i = 70; i <= 73; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SP-${num}`,
      rarity: 'special',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-SP-${i}.webp`,
      storagePath: `SP/${num}.webp`
    })
  }
  // SP-074 à SP-077
  for (let i = 74; i <= 77; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SP-${num}`,
      rarity: 'special',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/11/NRB07-SP-${num}L5.webp`,
      storagePath: `SP/${num}.webp`
    })
  }
  // NRSS-SP-001 à NRSS-SP-003 (URLs spéciales)
  const nrssSpSpecialUrls: Record<number, string> = {
    1: 'https://narutopia.fr/wp-content/uploads/2023/06/SP-7.webp',
    2: 'https://narutopia.fr/wp-content/uploads/2023/06/SP-8.webp',
    3: 'https://narutopia.fr/wp-content/uploads/2023/06/SP-15.webp'
  }
  for (let i = 1; i <= 3; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `NRSS-SP-${num}`,
      rarity: 'special',
      sourceUrl: nrssSpSpecialUrls[i],
      storagePath: `NRSS-SP/${num}.webp`
    })
  }
  // NRSS-SP-004 à NRSS-SP-007
  for (let i = 4; i <= 7; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `NRSS-SP-${num}`,
      rarity: 'special',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/08/NRSS-SP-${num}.webp`,
      storagePath: `NRSS-SP/${num}.webp`
    })
  }

  // ===== SSR (Special Series) =====
  // SS-SSR-001 à SS-SSR-010
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SS-SSR-${num}`,
      rarity: 'super-super-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/08/SS-SSR-${i}.webp`,
      storagePath: `SS-SSR/${num}.webp`
    })
  }

  // ===== SV (Silver) =====
  // SV-SILVER-001 à SV-SILVER-004
  for (let i = 1; i <= 4; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SV-SILVER-${num}`,
      rarity: 'sv',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/05/SV-SILVER-${num}.webp`,
      storagePath: `SV-SILVER/${num}.webp`
    })
  }
  // SV-SILVER-005 à SV-SILVER-010 (URLs variées)
  const svSilverUrls: Record<number, string> = {
    5: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-005.webp',
    6: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-006-e1691745401666.webp',
    7: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-007.webp',
    8: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-008-e1691745462298.webp',
    9: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-009.webp',
    10: 'https://narutopia.fr/wp-content/uploads/2023/08/SV-SILVER-010-e1691745511844.webp'
  }
  for (let i = 5; i <= 10; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `SV-SILVER-${num}`,
      rarity: 'sv',
      sourceUrl: svSilverUrls[i],
      storagePath: `SV-SILVER/${num}.webp`
    })
  }

  // ===== UR =====
  // UR-115 à UR-129
  for (let i = 115; i <= 129; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `UR-${num}`,
      rarity: 'ultra-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/09/NRZ06-UR-${i}.webp`,
      storagePath: `UR/${num}.webp`
    })
  }
  // UR-130 à UR-144
  for (let i = 130; i <= 144; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `UR-${num}`,
      rarity: 'ultra-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2024/11/NRB07-UR-${i}L3.webp`,
      storagePath: `UR/${num}.webp`
    })
  }
  // NRSS-UR-001 à NRSS-UR-005
  for (let i = 1; i <= 5; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `NRSS-UR-${num}`,
      rarity: 'ultra-rare',
      sourceUrl: `https://narutopia.fr/wp-content/uploads/2023/06/NRSS-UR-${num}.webp`,
      storagePath: `NRSS-UR/${num}.webp`
    })
  }
  // NRSS-UR-006 à NRSS-UR-009 (URLs avec suffixes)
  const nrssUrUrls: Record<number, string> = {
    6: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-UR-006-e1692715159977.webp',
    7: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-UR-007-e1692715212763.webp',
    8: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-UR-008-e1692715253170.webp',
    9: 'https://narutopia.fr/wp-content/uploads/2023/08/NRSS-UR-009-e1692715285552.webp'
  }
  for (let i = 6; i <= 9; i++) {
    const num = i.toString().padStart(3, '0')
    cards.push({
      number: `NRSS-UR-${num}`,
      rarity: 'ultra-rare',
      sourceUrl: nrssUrUrls[i],
      storagePath: `NRSS-UR/${num}.webp`
    })
  }

  return cards
}

/**
 * Script principal
 */
async function main() {
  logger.section('Mise à jour complète Naruto Kayou')
  console.log('Ce script va:')
  console.log('1. Renommer AR-001 à AR-010 → AR-SILVER-001 à AR-SILVER-010')
  console.log('2. Ajouter toutes les cartes manquantes\n')

  if (dryRun) {
    logger.warn('MODE DRY-RUN: Aucune écriture ne sera effectuée\n')
  }

  try {
    // Vérifier/créer le bucket
    if (!dryRun) {
      await createNarutoBucket()
    }

    // Récupérer l'ID de la série
    const seriesId = await getSeriesId()
    logger.success(`Série ${SERIES_CODE} trouvée: ${seriesId}`)

    // ===== ÉTAPE 1: Renommages AR =====
    logger.section('Étape 1: Renommage AR-001-010 → AR-SILVER-001-010')

    const renames: CardToRename[] = []
    for (let i = 1; i <= 10; i++) {
      const num = i.toString().padStart(3, '0')
      renames.push({
        oldNumber: `AR-${num}`,
        newNumber: `AR-SILVER-${num}`
      })
    }

    let renamed = 0
    for (const rename of renames) {
      if (dryRun) {
        logger.info(`  [DRY-RUN] ${rename.oldNumber} → ${rename.newNumber}`)
        renamed++
      } else {
        if (await renameCard(seriesId, rename.oldNumber, rename.newNumber)) {
          renamed++
        }
      }
      await delay(100)
    }
    logger.info(`Renommées: ${renamed}/${renames.length}`)

    // ===== ÉTAPE 2: Ajout des nouvelles cartes =====
    logger.section('Étape 2: Ajout des cartes manquantes')

    const cards = generateAllCards()
    logger.info(`${cards.length} cartes à traiter`)

    // Grouper par rareté pour l'affichage
    const byRarity = new Map<string, CardToAdd[]>()
    for (const card of cards) {
      const key = card.number.split('-')[0]
      if (!byRarity.has(key)) {
        byRarity.set(key, [])
      }
      byRarity.get(key)!.push(card)
    }

    let added = 0
    let skipped = 0
    let errors = 0

    for (const [rarity, rarityCards] of byRarity) {
      logger.section(`${rarity} (${rarityCards.length} cartes)`)

      for (const card of rarityCards) {
        logger.progress(`Traitement ${card.number}...`)

        if (dryRun) {
          logger.info(`  [DRY-RUN] ${card.number} serait ajoutée`)
          added++
          continue
        }

        const result = await addCard(seriesId, card)
        if (result) {
          added++
        } else {
          // Vérifier si c'était un skip ou une erreur
          if (await cardExists(seriesId, card.number)) {
            skipped++
          } else {
            errors++
          }
        }

        await delay(DELAYS.betweenUploads)
      }
    }

    // Résumé final
    logger.section('Résumé Final')
    logger.success(`Renommées: ${renamed}`)
    logger.success(`Ajoutées: ${added}`)
    logger.info(`Ignorées (existantes): ${skipped}`)
    if (errors > 0) {
      logger.error(`Erreurs: ${errors}`)
    }

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
