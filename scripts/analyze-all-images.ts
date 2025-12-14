/**
 * Analyse globale des images pour tous les TCG
 *
 * Ce script analyse :
 * 1. Les images manquantes dans Supabase Storage
 * 2. Les URLs externes (non-Supabase) dans la base de données
 *
 * Usage: npx tsx scripts/analyze-all-images.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import * as fs from 'fs'

interface TCGConfig {
  slug: string
  name: string
  bucket: string
  languages: string[]
}

const TCG_CONFIGS: TCGConfig[] = [
  { slug: 'lorcana', name: 'Disney Lorcana', bucket: 'lorcana-cards', languages: ['fr', 'en', 'jp'] },
  { slug: 'onepiece', name: 'One Piece', bucket: 'onepiece-cards', languages: ['fr', 'en', 'jp'] },
  { slug: 'pokemon', name: 'Pokemon', bucket: 'pokemon-cards', languages: ['fr', 'en', 'jp'] },
  { slug: 'starwars', name: 'Star Wars Unlimited', bucket: 'starwars-cards', languages: ['fr', 'en'] },
  { slug: 'riftbound', name: 'Riftbound', bucket: 'riftbound-cards', languages: ['en'] },
  { slug: 'naruto', name: 'Naruto', bucket: 'naruto-cards', languages: ['fr', 'en', 'jp', 'zh'] },
]

interface CardInfo {
  id: string
  number: string
  name: string
  language: string
  image_url: string | null
  series_code: string
  series_name: string
}

interface SeriesAnalysis {
  code: string
  name: string
  language: string
  totalCards: number
  cardsWithImages: number
  cardsWithoutImages: number
  externalUrls: number
  nullUrls: number
}

interface TCGAnalysis {
  slug: string
  name: string
  totalCards: number
  totalSeries: number
  cardsWithImages: number
  cardsWithoutImages: number
  externalUrls: number
  nullUrls: number
  storageImages: number
  series: SeriesAnalysis[]
  externalUrlDetails: { url: string; count: number }[]
}

interface FullReport {
  generatedAt: string
  summary: {
    totalTCGs: number
    totalCards: number
    totalStorageImages: number
    cardsWithImages: number
    cardsWithoutImages: number
    externalUrls: number
    nullUrls: number
    coveragePercent: number
  }
  byTCG: TCGAnalysis[]
}

async function analyzeAllImages() {
  const supabase = createAdminClient()

  logger.section('Analyse globale des images - Tous les TCG')
  console.log(`Date: ${new Date().toLocaleString('fr-FR')}`)

  const report: FullReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTCGs: 0,
      totalCards: 0,
      totalStorageImages: 0,
      cardsWithImages: 0,
      cardsWithoutImages: 0,
      externalUrls: 0,
      nullUrls: 0,
      coveragePercent: 0,
    },
    byTCG: [],
  }

  // Get all TCG games
  const { data: tcgGames, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id, slug, name')
    .order('name')

  if (tcgError || !tcgGames) {
    logger.error(`Erreur lors de la récupération des TCG: ${tcgError?.message}`)
    process.exit(1)
  }

  logger.info(`${tcgGames.length} TCG trouvés dans la base de données`)

  // Analyze each TCG
  for (const tcg of tcgGames) {
    const config = TCG_CONFIGS.find(c => c.slug === tcg.slug)
    if (!config) {
      logger.warn(`Configuration non trouvée pour ${tcg.slug}, skip...`)
      continue
    }

    logger.section(`Analyse de ${tcg.name}`)

    const tcgAnalysis: TCGAnalysis = {
      slug: tcg.slug,
      name: tcg.name,
      totalCards: 0,
      totalSeries: 0,
      cardsWithImages: 0,
      cardsWithoutImages: 0,
      externalUrls: 0,
      nullUrls: 0,
      storageImages: 0,
      series: [],
      externalUrlDetails: [],
    }

    // Get all series for this TCG
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select('id, code, name')
      .eq('tcg_game_id', tcg.id)
      .order('code')

    if (seriesError || !series) {
      logger.error(`Erreur séries: ${seriesError?.message}`)
      continue
    }

    tcgAnalysis.totalSeries = series.length
    logger.info(`${series.length} séries trouvées`)

    // Get all cards for this TCG with pagination
    let allCards: CardInfo[] = []
    let offset = 0
    const pageSize = 1000

    const seriesIds = series.map(s => s.id)
    const seriesMap = new Map(series.map(s => [s.id, s]))

    while (true) {
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, number, name, language, image_url, series_id')
        .in('series_id', seriesIds)
        .range(offset, offset + pageSize - 1)

      if (cardsError) {
        logger.error(`Erreur cartes: ${cardsError.message}`)
        break
      }

      if (!cards || cards.length === 0) break

      for (const card of cards) {
        const seriesInfo = seriesMap.get(card.series_id)
        allCards.push({
          id: card.id,
          number: card.number,
          name: card.name,
          language: card.language?.toLowerCase() || 'unknown',
          image_url: card.image_url,
          series_code: seriesInfo?.code || 'unknown',
          series_name: seriesInfo?.name || 'unknown',
        })
      }

      offset += pageSize
      if (cards.length < pageSize) break
    }

    tcgAnalysis.totalCards = allCards.length
    logger.info(`${allCards.length} cartes trouvées`)

    // Count storage images
    let totalStorageImages = 0
    const storageImagesByPath = new Map<string, Set<string>>()

    for (const s of series) {
      for (const lang of config.languages) {
        const path = `${s.code}/${lang}`
        try {
          const { data: files, error: listError } = await supabase.storage
            .from(config.bucket)
            .list(path, { limit: 1000 })

          if (!listError && files) {
            const imageFiles = files.filter(f => f.name.endsWith('.webp') || f.name.endsWith('.png') || f.name.endsWith('.jpg'))
            totalStorageImages += imageFiles.length
            storageImagesByPath.set(path, new Set(imageFiles.map(f => f.name.replace(/\.(webp|png|jpg)$/, ''))))
          }
        } catch {
          // Bucket might not exist
        }
      }
    }

    tcgAnalysis.storageImages = totalStorageImages

    // Analyze image URLs
    const externalDomains = new Map<string, number>()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    for (const card of allCards) {
      if (!card.image_url) {
        tcgAnalysis.nullUrls++
        tcgAnalysis.cardsWithoutImages++
      } else if (card.image_url.includes(supabaseUrl) || card.image_url.includes('supabase')) {
        tcgAnalysis.cardsWithImages++
      } else {
        // External URL
        tcgAnalysis.externalUrls++
        tcgAnalysis.cardsWithImages++ // Still has an image, just external

        try {
          const url = new URL(card.image_url)
          const domain = url.hostname
          externalDomains.set(domain, (externalDomains.get(domain) || 0) + 1)
        } catch {
          externalDomains.set('invalid-url', (externalDomains.get('invalid-url') || 0) + 1)
        }
      }
    }

    // Sort external domains by count
    tcgAnalysis.externalUrlDetails = Array.from(externalDomains.entries())
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)

    // Analyze by series and language
    for (const s of series) {
      for (const lang of config.languages) {
        const seriesCards = allCards.filter(c => c.series_code === s.code && c.language === lang)
        if (seriesCards.length === 0) continue

        const path = `${s.code}/${lang}`
        const storageImages = storageImagesByPath.get(path) || new Set()

        let cardsWithImages = 0
        let cardsWithoutImages = 0
        let externalUrls = 0
        let nullUrls = 0

        for (const card of seriesCards) {
          const cardNum = card.number.toString().replace('/', '-')
          const paddedNum = cardNum.padStart(3, '0')
          const hasStorageImage = storageImages.has(cardNum) || storageImages.has(paddedNum)

          if (!card.image_url) {
            nullUrls++
            if (!hasStorageImage) cardsWithoutImages++
            else cardsWithImages++
          } else if (card.image_url.includes(supabaseUrl) || card.image_url.includes('supabase')) {
            cardsWithImages++
          } else {
            externalUrls++
            cardsWithImages++
          }
        }

        if (cardsWithoutImages > 0 || externalUrls > 0 || nullUrls > 0) {
          tcgAnalysis.series.push({
            code: s.code,
            name: s.name,
            language: lang.toUpperCase(),
            totalCards: seriesCards.length,
            cardsWithImages,
            cardsWithoutImages,
            externalUrls,
            nullUrls,
          })
        }
      }
    }

    // Print TCG summary
    console.log(`\n📊 Résumé ${tcg.name}:`)
    console.log(`   Total cartes: ${tcgAnalysis.totalCards}`)
    console.log(`   Images storage: ${tcgAnalysis.storageImages}`)
    console.log(`   URLs Supabase: ${tcgAnalysis.cardsWithImages - tcgAnalysis.externalUrls}`)
    console.log(`   URLs externes: ${tcgAnalysis.externalUrls}`)
    console.log(`   URLs nulles: ${tcgAnalysis.nullUrls}`)

    if (tcgAnalysis.externalUrlDetails.length > 0) {
      console.log(`\n   Domaines externes:`)
      for (const { url, count } of tcgAnalysis.externalUrlDetails.slice(0, 5)) {
        console.log(`   - ${url}: ${count} cartes`)
      }
    }

    report.byTCG.push(tcgAnalysis)
    report.summary.totalCards += tcgAnalysis.totalCards
    report.summary.totalStorageImages += tcgAnalysis.storageImages
    report.summary.cardsWithImages += tcgAnalysis.cardsWithImages
    report.summary.cardsWithoutImages += tcgAnalysis.cardsWithoutImages
    report.summary.externalUrls += tcgAnalysis.externalUrls
    report.summary.nullUrls += tcgAnalysis.nullUrls
  }

  report.summary.totalTCGs = report.byTCG.length
  report.summary.coveragePercent = report.summary.totalCards > 0
    ? parseFloat(((report.summary.cardsWithImages / report.summary.totalCards) * 100).toFixed(2))
    : 0

  // Print final summary
  logger.section('RESUME GLOBAL')

  console.log('\n┌─────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐')
  console.log('│ TCG                 │  Cartes  │ Storage  │ Supabase │ Externes │  Nulles  │')
  console.log('├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤')

  for (const tcg of report.byTCG) {
    const supabaseCount = tcg.cardsWithImages - tcg.externalUrls
    console.log(
      `│ ${tcg.name.padEnd(19)} │ ${String(tcg.totalCards).padStart(8)} │ ${String(tcg.storageImages).padStart(8)} │ ${String(supabaseCount).padStart(8)} │ ${String(tcg.externalUrls).padStart(8)} │ ${String(tcg.nullUrls).padStart(8)} │`
    )
  }

  console.log('├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤')
  const totalSupabase = report.summary.cardsWithImages - report.summary.externalUrls
  console.log(
    `│ ${'TOTAL'.padEnd(19)} │ ${String(report.summary.totalCards).padStart(8)} │ ${String(report.summary.totalStorageImages).padStart(8)} │ ${String(totalSupabase).padStart(8)} │ ${String(report.summary.externalUrls).padStart(8)} │ ${String(report.summary.nullUrls).padStart(8)} │`
  )
  console.log('└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘')

  // Legend and stats
  console.log('\nLégende:')
  console.log('  - Cartes: Nombre total de cartes en base de données')
  console.log('  - Storage: Images présentes dans Supabase Storage')
  console.log('  - Supabase: Cartes avec image_url pointant vers Supabase')
  console.log('  - Externes: Cartes avec image_url pointant vers un site externe')
  console.log('  - Nulles: Cartes sans image_url (NULL)')

  console.log(`\n📈 Couverture globale: ${report.summary.coveragePercent}%`)

  // List problematic series
  const problemSeries = report.byTCG.flatMap(tcg =>
    tcg.series.filter(s => s.externalUrls > 0 || s.nullUrls > 0)
  ).sort((a, b) => (b.externalUrls + b.nullUrls) - (a.externalUrls + a.nullUrls))

  if (problemSeries.length > 0) {
    logger.section('SERIES AVEC PROBLEMES')
    console.log('\n┌────────────────┬──────┬──────────┬──────────┬──────────┐')
    console.log('│ Série          │ Lang │   Total  │ Externes │  Nulles  │')
    console.log('├────────────────┼──────┼──────────┼──────────┼──────────┤')

    for (const s of problemSeries.slice(0, 30)) {
      console.log(
        `│ ${s.code.padEnd(14)} │ ${s.language.padEnd(4)} │ ${String(s.totalCards).padStart(8)} │ ${String(s.externalUrls).padStart(8)} │ ${String(s.nullUrls).padStart(8)} │`
      )
    }

    if (problemSeries.length > 30) {
      console.log(`│ ... et ${problemSeries.length - 30} autres séries avec problèmes`)
    }

    console.log('└────────────────┴──────┴──────────┴──────────┴──────────┘')
  }

  // All external domains across all TCGs
  const allExternalDomains = new Map<string, number>()
  for (const tcg of report.byTCG) {
    for (const { url, count } of tcg.externalUrlDetails) {
      allExternalDomains.set(url, (allExternalDomains.get(url) || 0) + count)
    }
  }

  if (allExternalDomains.size > 0) {
    logger.section('DOMAINES EXTERNES UTILISES')
    const sortedDomains = Array.from(allExternalDomains.entries())
      .sort((a, b) => b[1] - a[1])

    for (const [domain, count] of sortedDomains) {
      const percent = ((count / report.summary.totalCards) * 100).toFixed(1)
      console.log(`  ${domain}: ${count} cartes (${percent}%)`)
    }
  }

  // Save report
  const logsDir = 'scripts/logs'
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const reportPath = `${logsDir}/all-images-analysis.json`
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logger.success(`Rapport complet sauvegardé dans ${reportPath}`)
}

analyzeAllImages().catch(error => {
  logger.error(`Erreur fatale: ${error.message}`)
  process.exit(1)
})
