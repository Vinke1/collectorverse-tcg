/**
 * List all missing One Piece card images (FR and EN)
 *
 * Usage:
 *   npx tsx scripts/list-missing-images.ts
 *   npx tsx scripts/list-missing-images.ts --language fr
 *   npx tsx scripts/list-missing-images.ts --language en
 *   npx tsx scripts/list-missing-images.ts --series OP13
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

const args = process.argv.slice(2)
const languageFilter = args.find(a => a.startsWith('--language='))?.split('=')[1]?.toUpperCase()
  || (args.includes('--language') ? args[args.indexOf('--language') + 1]?.toUpperCase() : null)
const seriesFilter = args.find(a => a.startsWith('--series='))?.split('=')[1]?.toUpperCase()
  || (args.includes('--series') ? args[args.indexOf('--series') + 1]?.toUpperCase() : null)

interface MissingCard {
  seriesCode: string
  number: string
  name: string
  language: string
}

interface SeriesSummary {
  code: string
  totalFR: number
  missingFR: number
  totalEN: number
  missingEN: number
}

async function main() {
  logger.section('Analyse des images One Piece manquantes')

  // Get One Piece TCG
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    return
  }

  // Get all series
  let seriesQuery = supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)
    .order('code')

  if (seriesFilter) {
    seriesQuery = seriesQuery.eq('code', seriesFilter)
  }

  const { data: seriesList } = await seriesQuery

  if (!seriesList?.length) {
    logger.error('Aucune série trouvée')
    return
  }

  const languages = languageFilter ? [languageFilter] : ['FR', 'EN']
  const allMissing: MissingCard[] = []
  const summaries: SeriesSummary[] = []

  for (const series of seriesList) {
    const summary: SeriesSummary = {
      code: series.code,
      totalFR: 0,
      missingFR: 0,
      totalEN: 0,
      missingEN: 0,
    }

    for (const lang of languages) {
      // Get all cards for this series and language
      const { data: cards } = await supabase
        .from('cards')
        .select('id, number, name')
        .eq('series_id', series.id)
        .eq('language', lang)
        .order('number')

      if (!cards?.length) continue

      // Check storage
      const storagePath = `${series.code}/${lang.toLowerCase()}`
      const { data: storageFiles } = await supabase.storage
        .from('onepiece-cards')
        .list(storagePath, { limit: 500 })

      const existingImages = new Set(
        (storageFiles || [])
          .filter(f => f.name.endsWith('.webp'))
          .map(f => f.name.replace('.webp', ''))
      )

      // Find missing cards
      const missing = cards.filter(card => {
        const paddedNumber = card.number.toString().padStart(3, '0')
        // Skip special variants for now
        if (card.number.includes('-') && !card.number.includes('-SP')) return false
        return !existingImages.has(paddedNumber) && !existingImages.has(card.number.toString())
      })

      if (lang === 'FR') {
        summary.totalFR = cards.length
        summary.missingFR = missing.length
      } else {
        summary.totalEN = cards.length
        summary.missingEN = missing.length
      }

      for (const card of missing) {
        allMissing.push({
          seriesCode: series.code,
          number: card.number,
          name: card.name,
          language: lang,
        })
      }
    }

    // Only add to summaries if series has cards
    if (summary.totalFR > 0 || summary.totalEN > 0) {
      summaries.push(summary)
    }
  }

  // Display summary table
  logger.section('Résumé par série')
  console.log('')
  console.log('Série     │ FR Total │ FR Manq. │ EN Total │ EN Manq.')
  console.log('──────────┼──────────┼──────────┼──────────┼──────────')

  let totalFR = 0, totalMissingFR = 0, totalEN = 0, totalMissingEN = 0

  for (const s of summaries) {
    const frStatus = s.missingFR === 0 ? '✅' : `${s.missingFR}`
    const enStatus = s.missingEN === 0 ? '✅' : `${s.missingEN}`

    // Only show series with missing cards or if filter is set
    if (s.missingFR > 0 || s.missingEN > 0 || seriesFilter) {
      console.log(
        `${s.code.padEnd(9)} │ ${String(s.totalFR).padStart(8)} │ ${String(frStatus).padStart(8)} │ ${String(s.totalEN).padStart(8)} │ ${String(enStatus).padStart(8)}`
      )
    }

    totalFR += s.totalFR
    totalMissingFR += s.missingFR
    totalEN += s.totalEN
    totalMissingEN += s.missingEN
  }

  console.log('──────────┼──────────┼──────────┼──────────┼──────────')
  console.log(
    `TOTAL     │ ${String(totalFR).padStart(8)} │ ${String(totalMissingFR).padStart(8)} │ ${String(totalEN).padStart(8)} │ ${String(totalMissingEN).padStart(8)}`
  )
  console.log('')

  // Display detailed missing cards if not too many
  if (allMissing.length > 0 && allMissing.length <= 100) {
    logger.section('Détail des cartes manquantes')

    // Group by series and language
    const grouped = new Map<string, MissingCard[]>()
    for (const card of allMissing) {
      const key = `${card.seriesCode}-${card.language}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(card)
    }

    for (const [key, cards] of grouped) {
      console.log(`\n${key}:`)
      for (const card of cards) {
        console.log(`  #${card.number.padStart(3, '0')}: ${card.name}`)
      }
    }
  } else if (allMissing.length > 100) {
    logger.info(`${allMissing.length} cartes manquantes au total (trop pour afficher le détail)`)
    logger.info('Utilisez --series CODE pour voir le détail d\'une série')
  }

  // Final stats
  logger.section('Statistiques')
  const frPercent = totalFR > 0 ? ((totalFR - totalMissingFR) / totalFR * 100).toFixed(1) : '0'
  const enPercent = totalEN > 0 ? ((totalEN - totalMissingEN) / totalEN * 100).toFixed(1) : '0'

  console.log(`FR: ${totalFR - totalMissingFR}/${totalFR} images (${frPercent}%)`)
  console.log(`EN: ${totalEN - totalMissingEN}/${totalEN} images (${enPercent}%)`)
  console.log(`Total manquant: ${totalMissingFR + totalMissingEN} cartes`)
}

main().catch(console.error)
