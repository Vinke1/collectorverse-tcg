import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

interface CardInfo {
  id: string
  number: string
  language: string
  image_url: string | null
  series_code: string
}

async function analyzeImageReuse() {
  logger.section('Analyse de réutilisation des images Pokemon')

  // Récupérer toutes les cartes Pokemon avec leurs séries
  const { data: series } = await supabase
    .from('series')
    .select('id, code, tcg_game:tcg_game_id(slug)')
    .eq('tcg_game.slug', 'pokemon')

  if (!series?.length) {
    logger.error('Aucune série Pokemon trouvée')
    return
  }

  const seriesIds = series.map(s => s.id)
  const seriesCodeMap = new Map(series.map(s => [s.id, s.code]))

  logger.info(`${series.length} séries Pokemon trouvées`)

  // Récupérer toutes les cartes (pagination car limite 1000)
  let allCards: any[] = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    const { data: batch, error } = await supabase
      .from('cards')
      .select('id, number, language, image_url, series_id')
      .in('series_id', seriesIds)
      .range(offset, offset + batchSize - 1)

    if (error) {
      logger.error(`Erreur: ${error.message}`)
      return
    }

    if (!batch || batch.length === 0) break

    allCards = allCards.concat(batch)
    offset += batchSize

    if (batch.length < batchSize) break
  }

  const cards = allCards

  if (!cards.length) {
    logger.error('Aucune carte trouvée')
    return
  }

  logger.info(`${cards.length} cartes récupérées`)

  // Organiser par série -> numéro -> langue
  const bySeriesNumber: Map<string, Map<string, Map<string, CardInfo>>> = new Map()

  for (const card of cards) {
    const seriesCode = seriesCodeMap.get(card.series_id) || 'unknown'

    if (!bySeriesNumber.has(seriesCode)) {
      bySeriesNumber.set(seriesCode, new Map())
    }

    const byNumber = bySeriesNumber.get(seriesCode)!
    if (!byNumber.has(card.number)) {
      byNumber.set(card.number, new Map())
    }

    byNumber.get(card.number)!.set(card.language, {
      id: card.id,
      number: card.number,
      language: card.language,
      image_url: card.image_url,
      series_code: seriesCode
    })
  }

  // Analyser chaque série
  const results: {
    series: string
    missingCards: number
    canReuseEN: number
    canReuseFR: number
    needDownload: number
    languages: string[]
  }[] = []

  for (const [seriesCode, byNumber] of bySeriesNumber) {
    let missingCards = 0
    let canReuseEN = 0
    let canReuseFR = 0
    let needDownload = 0
    const languages = new Set<string>()

    for (const [number, byLang] of byNumber) {
      const en = byLang.get('en')
      const fr = byLang.get('fr')

      for (const [lang, card] of byLang) {
        languages.add(lang)

        if (!card.image_url) {
          missingCards++

          if (lang !== 'en' && en?.image_url) {
            canReuseEN++
          } else if (lang !== 'fr' && fr?.image_url) {
            canReuseFR++
          } else {
            needDownload++
          }
        }
      }
    }

    if (missingCards > 0) {
      results.push({
        series: seriesCode,
        missingCards,
        canReuseEN,
        canReuseFR,
        needDownload,
        languages: Array.from(languages)
      })
    }
  }

  // Trier par nombre de cartes manquantes
  results.sort((a, b) => b.missingCards - a.missingCards)

  // Afficher les résultats
  logger.section('Résultats par série')

  let totalMissing = 0
  let totalCanReuseEN = 0
  let totalCanReuseFR = 0
  let totalNeedDownload = 0

  console.log('\n| Série | Manquantes | Réutiliser EN | Réutiliser FR | À télécharger | Langues |')
  console.log('|-------|------------|---------------|---------------|---------------|---------|')

  for (const r of results.slice(0, 30)) {
    console.log(`| ${r.series.padEnd(5)} | ${String(r.missingCards).padStart(10)} | ${String(r.canReuseEN).padStart(13)} | ${String(r.canReuseFR).padStart(13)} | ${String(r.needDownload).padStart(13)} | ${r.languages.join(',')} |`)
    totalMissing += r.missingCards
    totalCanReuseEN += r.canReuseEN
    totalCanReuseFR += r.canReuseFR
    totalNeedDownload += r.needDownload
  }

  if (results.length > 30) {
    console.log(`| ... | (${results.length - 30} autres séries) |`)
  }

  logger.section('Résumé Global')
  console.log(`
Total cartes sans images:     ${totalMissing}
Peuvent réutiliser image EN:  ${totalCanReuseEN} (${(totalCanReuseEN/totalMissing*100).toFixed(1)}%)
Peuvent réutiliser image FR:  ${totalCanReuseFR} (${(totalCanReuseFR/totalMissing*100).toFixed(1)}%)
Nécessitent téléchargement:   ${totalNeedDownload} (${(totalNeedDownload/totalMissing*100).toFixed(1)}%)
`)

  logger.success('Analyse terminée')
}

analyzeImageReuse().catch(console.error)
