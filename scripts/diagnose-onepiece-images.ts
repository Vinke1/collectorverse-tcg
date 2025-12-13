/**
 * Script de diagnostic des images One Piece
 *
 * Analyse l'état des images dans la base de données :
 * - Images manquantes (URL source opecards.fr au lieu de Supabase)
 * - Images avec erreurs 404 sur la source
 * - Statistiques par série et langue
 *
 * Usage:
 *   npx tsx scripts/diagnose-onepiece-images.ts
 *   npx tsx scripts/diagnose-onepiece-images.ts --check-source  # Vérifie aussi si les images existent sur opecards.fr
 *   npx tsx scripts/diagnose-onepiece-images.ts --series OP13   # Filtre par série
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'

const args = process.argv.slice(2)
const checkSource = args.includes('--check-source')
const targetSeries = args.find((_, i) => args[i - 1] === '--series')

const supabase = createAdminClient()

interface CardImageStatus {
  id: string
  series_code: string
  series_name: string
  number: string
  language: string
  name: string
  image_url: string
  is_uploaded: boolean
  source_exists?: boolean
}

interface SeriesStats {
  code: string
  name: string
  total: number
  uploaded: number
  missing: number
  byLanguage: Record<string, { total: number; uploaded: number; missing: number }>
}

async function getOnePieceGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (error || !data) {
    throw new Error('TCG One Piece non trouvé')
  }
  return data.id
}

async function getAllOnePieceCards(): Promise<CardImageStatus[]> {
  const gameId = await getOnePieceGameId()

  // Récupérer toutes les séries One Piece
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', gameId)

  if (seriesError || !series) {
    throw new Error('Erreur récupération des séries')
  }

  const seriesMap = new Map(series.map(s => [s.id, { code: s.code, name: s.name }]))
  const seriesIds = series.map(s => s.id)

  // Filtrer par série si demandé
  let query = supabase
    .from('cards')
    .select('id, series_id, number, language, name, image_url')
    .in('series_id', seriesIds)
    .order('series_id')
    .order('number')

  const { data: cards, error: cardsError } = await query

  if (cardsError || !cards) {
    throw new Error('Erreur récupération des cartes')
  }

  return cards.map(card => {
    const seriesInfo = seriesMap.get(card.series_id)
    const isUploaded = card.image_url?.includes('supabase') || false

    return {
      id: card.id,
      series_code: seriesInfo?.code || 'UNKNOWN',
      series_name: seriesInfo?.name || 'Unknown',
      number: card.number,
      language: card.language || 'FR',
      name: card.name,
      image_url: card.image_url || '',
      is_uploaded: isUploaded
    }
  }).filter(card => {
    if (targetSeries) {
      return card.series_code.toUpperCase() === targetSeries.toUpperCase()
    }
    return true
  })
}

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

async function analyzeCards(cards: CardImageStatus[]): Promise<{
  stats: Map<string, SeriesStats>
  missingCards: CardImageStatus[]
}> {
  const stats = new Map<string, SeriesStats>()
  const missingCards: CardImageStatus[] = []

  for (const card of cards) {
    // Initialiser les stats de la série si nécessaire
    if (!stats.has(card.series_code)) {
      stats.set(card.series_code, {
        code: card.series_code,
        name: card.series_name,
        total: 0,
        uploaded: 0,
        missing: 0,
        byLanguage: {}
      })
    }

    const seriesStats = stats.get(card.series_code)!
    seriesStats.total++

    // Stats par langue
    if (!seriesStats.byLanguage[card.language]) {
      seriesStats.byLanguage[card.language] = { total: 0, uploaded: 0, missing: 0 }
    }
    seriesStats.byLanguage[card.language].total++

    if (card.is_uploaded) {
      seriesStats.uploaded++
      seriesStats.byLanguage[card.language].uploaded++
    } else {
      seriesStats.missing++
      seriesStats.byLanguage[card.language].missing++
      missingCards.push(card)
    }
  }

  return { stats, missingCards }
}

async function checkSourceAvailability(cards: CardImageStatus[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()

  logger.info(`Vérification de ${cards.length} URLs sources...`)

  let checked = 0
  for (const card of cards) {
    if (card.image_url && !card.is_uploaded) {
      const exists = await checkImageExists(card.image_url)
      results.set(card.id, exists)
      checked++

      if (checked % 50 === 0) {
        logger.info(`  ${checked}/${cards.length} vérifiées...`)
      }

      // Rate limiting
      await delay(100)
    }
  }

  return results
}

function printReport(
  stats: Map<string, SeriesStats>,
  missingCards: CardImageStatus[],
  sourceAvailability?: Map<string, boolean>
) {
  logger.section('RAPPORT DES IMAGES ONE PIECE')

  // Tri des séries par code
  const sortedStats = Array.from(stats.values()).sort((a, b) => {
    // Trier par type puis par numéro
    const getOrder = (code: string) => {
      if (code.startsWith('OP')) return 1
      if (code.startsWith('ST')) return 2
      if (code.startsWith('PRB')) return 3
      if (code.startsWith('EB')) return 4
      if (code === 'P') return 5
      if (code === 'STP') return 6
      return 7
    }
    const orderA = getOrder(a.code)
    const orderB = getOrder(b.code)
    if (orderA !== orderB) return orderA - orderB
    return a.code.localeCompare(b.code)
  })

  // Statistiques globales
  let totalCards = 0
  let totalUploaded = 0
  let totalMissing = 0

  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐')
  console.log('│                         STATISTIQUES PAR SÉRIE                             │')
  console.log('├──────────┬────────────────────────────────┬────────┬──────────┬────────────┤')
  console.log('│ Code     │ Nom                            │ Total  │ Uploadées│ Manquantes │')
  console.log('├──────────┼────────────────────────────────┼────────┼──────────┼────────────┤')

  for (const s of sortedStats) {
    totalCards += s.total
    totalUploaded += s.uploaded
    totalMissing += s.missing

    const name = s.name.length > 30 ? s.name.substring(0, 27) + '...' : s.name.padEnd(30)
    const status = s.missing === 0 ? '✅' : s.missing === s.total ? '❌' : '⚠️'

    console.log(
      `│ ${s.code.padEnd(8)} │ ${name} │ ${String(s.total).padStart(6)} │ ${String(s.uploaded).padStart(8)} │ ${status} ${String(s.missing).padStart(7)} │`
    )

    // Détails par langue si plusieurs langues
    const languages = Object.keys(s.byLanguage)
    if (languages.length > 1) {
      for (const lang of languages.sort()) {
        const langStats = s.byLanguage[lang]
        if (langStats.missing > 0) {
          console.log(
            `│          │   └─ ${lang.padEnd(24)} │ ${String(langStats.total).padStart(6)} │ ${String(langStats.uploaded).padStart(8)} │    ${String(langStats.missing).padStart(7)} │`
          )
        }
      }
    }
  }

  console.log('├──────────┼────────────────────────────────┼────────┼──────────┼────────────┤')
  const pctUploaded = totalCards > 0 ? ((totalUploaded / totalCards) * 100).toFixed(1) : '0'
  console.log(
    `│ TOTAL    │                                │ ${String(totalCards).padStart(6)} │ ${String(totalUploaded).padStart(8)} │ ${String(totalMissing).padStart(10)} │`
  )
  console.log(`│          │ Progression: ${pctUploaded}%`.padEnd(78) + '│')
  console.log('└──────────┴────────────────────────────────┴────────┴──────────┴────────────┘')

  // Détails des cartes manquantes par série
  if (missingCards.length > 0) {
    console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐')
    console.log('│                        DÉTAIL DES IMAGES MANQUANTES                        │')
    console.log('└─────────────────────────────────────────────────────────────────────────────┘')

    // Grouper par série
    const bySeriesLang = new Map<string, CardImageStatus[]>()
    for (const card of missingCards) {
      const key = `${card.series_code}|${card.language}`
      if (!bySeriesLang.has(key)) {
        bySeriesLang.set(key, [])
      }
      bySeriesLang.get(key)!.push(card)
    }

    // Afficher par groupe
    const sortedKeys = Array.from(bySeriesLang.keys()).sort()
    for (const key of sortedKeys) {
      const [seriesCode, language] = key.split('|')
      const cards = bySeriesLang.get(key)!

      // Vérifier si les images sources existent
      let availableCount = 0
      let unavailableCount = 0

      if (sourceAvailability) {
        for (const card of cards) {
          if (sourceAvailability.get(card.id)) {
            availableCount++
          } else {
            unavailableCount++
          }
        }
      }

      console.log(`\n📦 ${seriesCode} (${language}) - ${cards.length} images manquantes`)

      if (sourceAvailability) {
        console.log(`   ├─ ✅ Disponibles sur opecards.fr: ${availableCount}`)
        console.log(`   └─ ❌ Non disponibles sur opecards.fr: ${unavailableCount}`)
      }

      // Liste des numéros de cartes (format compact)
      const numbers = cards.map(c => c.number).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0
        const numB = parseInt(b.replace(/\D/g, '')) || 0
        return numA - numB
      })

      // Grouper les numéros consécutifs
      const ranges: string[] = []
      let rangeStart = numbers[0]
      let rangeEnd = numbers[0]

      for (let i = 1; i <= numbers.length; i++) {
        const current = numbers[i]
        const prev = numbers[i - 1]

        const currentNum = current ? parseInt(current.replace(/\D/g, '')) : -1
        const prevNum = parseInt(prev.replace(/\D/g, ''))

        if (currentNum === prevNum + 1 && !prev.includes('-') && !current?.includes('-')) {
          rangeEnd = current
        } else {
          if (rangeStart === rangeEnd) {
            ranges.push(rangeStart)
          } else {
            ranges.push(`${rangeStart}-${rangeEnd}`)
          }
          rangeStart = current
          rangeEnd = current
        }
      }

      // Afficher sur plusieurs lignes si nécessaire
      const rangeStr = ranges.join(', ')
      if (rangeStr.length > 70) {
        console.log(`   Cartes: ${ranges.slice(0, 10).join(', ')}...`)
        console.log(`           (${ranges.length} groupes au total)`)
      } else {
        console.log(`   Cartes: ${rangeStr}`)
      }
    }
  }

  // Recommandations
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐')
  console.log('│                            RECOMMANDATIONS                                 │')
  console.log('└─────────────────────────────────────────────────────────────────────────────┘')

  if (totalMissing === 0) {
    console.log('\n✅ Toutes les images sont uploadées dans Supabase !')
  } else {
    console.log('\nPour corriger les images manquantes, exécutez :')

    // Identifier les séries à traiter
    const seriesToFix = sortedStats.filter(s => s.missing > 0)

    for (const s of seriesToFix.slice(0, 5)) {
      const langs = Object.entries(s.byLanguage)
        .filter(([_, stats]) => stats.missing > 0)
        .map(([lang]) => lang.toLowerCase())
        .join(', ')

      console.log(`\n  npx tsx scripts/fix-onepiece-cards.ts --series ${s.code} --force`)
      console.log(`     └─ ${s.missing} images manquantes (${langs})`)
    }

    if (seriesToFix.length > 5) {
      console.log(`\n  ... et ${seriesToFix.length - 5} autres séries`)
    }

    console.log('\nOu pour tout traiter d\'un coup :')
    console.log('  npx tsx scripts/fix-onepiece-cards.ts --force')
  }
}

async function main() {
  logger.section('Diagnostic des images One Piece')

  try {
    // Récupérer toutes les cartes
    logger.info('Récupération des cartes...')
    const cards = await getAllOnePieceCards()
    logger.success(`${cards.length} cartes trouvées`)

    // Analyser les stats
    logger.info('Analyse des images...')
    const { stats, missingCards } = await analyzeCards(cards)

    // Vérifier la disponibilité sur opecards.fr si demandé
    let sourceAvailability: Map<string, boolean> | undefined
    if (checkSource && missingCards.length > 0) {
      logger.info('Vérification de la disponibilité sur opecards.fr...')
      sourceAvailability = await checkSourceAvailability(missingCards)
    }

    // Afficher le rapport
    printReport(stats, missingCards, sourceAvailability)

  } catch (error) {
    logger.error(`Erreur: ${error}`)
    process.exit(1)
  }
}

main()
