/**
 * Analyze Pokemon images in Supabase
 *
 * This script compares cards in the database with images in storage
 * to identify missing images.
 *
 * Usage: npx tsx scripts/analyze-pokemon-images.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import * as fs from 'fs'

interface CardWithoutImage {
  id: string
  number: string
  name: string
  language: string
  seriesCode: string
  seriesName: string
  tcgdexId: string | null
}

interface StorageFile {
  name: string
  path: string
}

interface AnalysisResult {
  series: string
  language: string
  totalCardsInDb: number
  totalImagesInStorage: number
  cardsWithoutImages: CardWithoutImage[]
  imagesWithoutCards: string[]
}

async function analyzePokemonImages() {
  const supabase = createAdminClient()

  logger.section('Analyse des images Pokemon')

  // 1. Get Pokemon TCG ID
  const { data: tcgGame, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'pokemon')
    .single()

  if (tcgError || !tcgGame) {
    logger.error('TCG Pokemon non trouvé dans la base de données')
    process.exit(1)
  }

  logger.info(`TCG Pokemon ID: ${tcgGame.id}`)

  // 2. Get all series for Pokemon
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcgGame.id)

  if (seriesError) {
    logger.error(`Erreur lors de la récupération des séries: ${seriesError.message}`)
    process.exit(1)
  }

  if (!series || series.length === 0) {
    logger.warn('Aucune série Pokemon trouvée dans la base de données')
    process.exit(0)
  }

  logger.success(`${series.length} séries trouvées dans la base de données`)

  // 3. Get all cards for Pokemon (fetch all with pagination)
  let allCards: any[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        number,
        name,
        language,
        image_url,
        tcgdex_id,
        series_id
      `)
      .in('series_id', series.map(s => s.id))
      .range(offset, offset + pageSize - 1)

    if (cardsError) {
      logger.error(`Erreur lors de la récupération des cartes: ${cardsError.message}`)
      process.exit(1)
    }

    if (!cards || cards.length === 0) break

    allCards = [...allCards, ...cards]
    offset += pageSize

    if (cards.length < pageSize) break
  }

  logger.success(`${allCards.length} cartes trouvées dans la base de données`)

  // Map series_id to series info
  const seriesMap = new Map(series.map(s => [s.id, s]))

  // 4. List all files in pokemon-cards bucket
  logger.section('Analyse du Storage Supabase')

  const storageFiles: Map<string, StorageFile[]> = new Map()
  let totalStorageImages = 0

  for (const s of series) {
    // Get unique languages for this series
    const seriesCards = allCards.filter(c => c.series_id === s.id)
    const languages = [...new Set(seriesCards.map(c => c.language))]

    for (const lang of languages) {
      const path = `${s.code}/${lang}`
      const { data: files, error: listError } = await supabase.storage
        .from('pokemon-cards')
        .list(path)

      if (listError) {
        continue
      }

      if (files && files.length > 0) {
        const imageFiles = files.filter(f => f.name.endsWith('.webp'))
        storageFiles.set(path, imageFiles.map(f => ({ name: f.name, path: `${path}/${f.name}` })))
        totalStorageImages += imageFiles.length
        logger.info(`${path}: ${imageFiles.length} images`)
      }
    }
  }

  logger.success(`Total images dans le storage: ${totalStorageImages}`)

  // 5. Compare and find missing images
  logger.section('Analyse des images manquantes')

  const results: AnalysisResult[] = []
  const allCardsWithoutImages: CardWithoutImage[] = []
  const allImagesWithoutCards: string[] = []

  for (const s of series) {
    const seriesCards = allCards.filter(c => c.series_id === s.id)
    const languages = [...new Set(seriesCards.map(c => c.language))]

    for (const lang of languages) {
      const langCards = seriesCards.filter(c => c.language === lang)

      const path = `${s.code}/${lang}`
      const imagesInStorage = storageFiles.get(path) || []

      // Cards without images in storage
      const cardsWithoutImages: CardWithoutImage[] = []

      for (const card of langCards) {
        const cardNum = card.number.toString()
        const expectedFileName = `${cardNum}.webp`

        const hasImage = imagesInStorage.some(img => img.name === expectedFileName)

        if (!hasImage) {
          cardsWithoutImages.push({
            id: card.id,
            number: card.number,
            name: card.name,
            language: card.language,
            seriesCode: s.code,
            seriesName: s.name,
            tcgdexId: card.tcgdex_id
          })
        }
      }

      // Images without corresponding cards
      const imagesWithoutCards: string[] = []

      for (const img of imagesInStorage) {
        const cardNumber = img.name.replace('.webp', '')

        const hasCard = langCards.some(c => c.number.toString() === cardNumber)

        if (!hasCard) {
          imagesWithoutCards.push(img.path)
        }
      }

      if (langCards.length > 0 || imagesInStorage.length > 0) {
        results.push({
          series: s.code,
          language: lang,
          totalCardsInDb: langCards.length,
          totalImagesInStorage: imagesInStorage.length,
          cardsWithoutImages,
          imagesWithoutCards
        })

        allCardsWithoutImages.push(...cardsWithoutImages)
        allImagesWithoutCards.push(...imagesWithoutCards)
      }
    }
  }

  // 6. Print results
  logger.section('Résumé par série')

  for (const result of results) {
    if (result.totalCardsInDb > 0 || result.totalImagesInStorage > 0) {
      const missingCount = result.cardsWithoutImages.length
      const missingPercent = result.totalCardsInDb > 0 ?
        ((missingCount / result.totalCardsInDb) * 100).toFixed(1) : '0'

      console.log(`\n${result.series} (${result.language.toUpperCase()}):`)
      console.log(`  Cartes en DB: ${result.totalCardsInDb}`)
      console.log(`  Images en Storage: ${result.totalImagesInStorage}`)

      if (result.cardsWithoutImages.length > 0) {
        console.log(`  ⚠️  Cartes sans images: ${result.cardsWithoutImages.length} (${missingPercent}%)`)
      } else if (result.totalCardsInDb > 0) {
        console.log(`  ✅ Toutes les cartes ont des images`)
      }

      if (result.imagesWithoutCards.length > 0) {
        console.log(`  ⚠️  Images orphelines: ${result.imagesWithoutCards.length}`)
      }
    }
  }

  // 7. Detailed missing images report
  if (allCardsWithoutImages.length > 0) {
    logger.section(`Détail des ${allCardsWithoutImages.length} cartes sans images`)

    // Group by series-lang
    const bySeriesLang = new Map<string, CardWithoutImage[]>()
    for (const card of allCardsWithoutImages) {
      const key = `${card.seriesCode}-${card.language}`
      if (!bySeriesLang.has(key)) {
        bySeriesLang.set(key, [])
      }
      bySeriesLang.get(key)!.push(card)
    }

    for (const [key, cards] of bySeriesLang) {
      console.log(`\n${key}: ${cards.length} cartes manquantes`)

      // Show first 10 cards
      const sample = cards.slice(0, 10)
      for (const card of sample) {
        console.log(`  - ${card.number}: ${card.name}${card.tcgdexId ? ` (TCGdex: ${card.tcgdexId})` : ''}`)
      }

      if (cards.length > 10) {
        console.log(`  ... et ${cards.length - 10} autres`)
      }
    }
  }

  // 8. Summary
  logger.section('Résumé final')
  console.log(`Total séries: ${series.length}`)
  console.log(`Total cartes en DB: ${allCards.length}`)
  console.log(`Total images en Storage: ${totalStorageImages}`)
  console.log(`Cartes sans images: ${allCardsWithoutImages.length}`)
  console.log(`Images orphelines: ${allImagesWithoutCards.length}`)

  const coveragePercent = allCards.length > 0 ?
    (((allCards.length - allCardsWithoutImages.length) / allCards.length) * 100).toFixed(1) : '0'
  console.log(`\nCouverture images: ${coveragePercent}%`)

  // 9. Save report to file
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSeries: series.length,
      totalCardsInDb: allCards.length,
      totalImagesInStorage: totalStorageImages,
      cardsWithoutImages: allCardsWithoutImages.length,
      orphanImages: allImagesWithoutCards.length,
      coveragePercent: parseFloat(coveragePercent)
    },
    bySeriesLanguage: results.map(r => ({
      series: r.series,
      language: r.language,
      totalCardsInDb: r.totalCardsInDb,
      totalImagesInStorage: r.totalImagesInStorage,
      missingCount: r.cardsWithoutImages.length,
      orphanCount: r.imagesWithoutCards.length
    })),
    cardsWithoutImages: allCardsWithoutImages,
    orphanImages: allImagesWithoutCards
  }

  const reportPath = 'scripts/logs/pokemon-images-analysis.json'
  const dir = 'scripts/logs'
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logger.success(`Rapport sauvegardé dans ${reportPath}`)
}

analyzePokemonImages().catch(error => {
  logger.error(`Erreur fatale: ${error.message}`)
  process.exit(1)
})
