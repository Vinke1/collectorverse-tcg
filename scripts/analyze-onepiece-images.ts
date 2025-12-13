import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

const supabase = createAdminClient()

interface ImageStats {
  total: number
  supabase: number
  opecards: number
  other: number
  missing: number
}

async function main() {
  logger.section('Analyse des images One Piece')

  // Récupérer le TCG One Piece
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id, name')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    return
  }

  logger.info(`TCG: ${tcg.name}`)

  // Récupérer toutes les séries One Piece
  const { data: series } = await supabase
    .from('series')
    .select('id, code, name')
    .eq('tcg_game_id', tcg.id)
    .order('code')

  if (!series || series.length === 0) {
    logger.error('Aucune série One Piece trouvée')
    return
  }

  logger.info(`${series.length} séries trouvées\n`)

  const globalStats: ImageStats = {
    total: 0,
    supabase: 0,
    opecards: 0,
    other: 0,
    missing: 0
  }

  const problematicCards: { series: string; number: string; language: string; url: string }[] = []

  for (const s of series) {
    // Récupérer toutes les cartes de cette série
    const { data: cards } = await supabase
      .from('cards')
      .select('id, number, language, image_url')
      .eq('series_id', s.id)

    if (!cards || cards.length === 0) continue

    const stats: ImageStats = {
      total: cards.length,
      supabase: 0,
      opecards: 0,
      other: 0,
      missing: 0
    }

    for (const card of cards) {
      if (!card.image_url) {
        stats.missing++
      } else if (card.image_url.includes('supabase.co')) {
        stats.supabase++
      } else if (card.image_url.includes('opecards.fr') || card.image_url.includes('static.opecards.fr')) {
        stats.opecards++
        problematicCards.push({
          series: s.code,
          number: card.number,
          language: card.language,
          url: card.image_url
        })
      } else {
        stats.other++
        problematicCards.push({
          series: s.code,
          number: card.number,
          language: card.language,
          url: card.image_url
        })
      }
    }

    // Afficher stats par série
    const hasIssues = stats.opecards > 0 || stats.other > 0 || stats.missing > 0
    const icon = hasIssues ? '⚠️' : '✅'

    console.log(`${icon} ${s.code} (${s.name})`)
    console.log(`   Total: ${stats.total} | Supabase: ${stats.supabase} | OPECards: ${stats.opecards} | Autres: ${stats.other} | Manquantes: ${stats.missing}`)

    // Ajouter aux stats globales
    globalStats.total += stats.total
    globalStats.supabase += stats.supabase
    globalStats.opecards += stats.opecards
    globalStats.other += stats.other
    globalStats.missing += stats.missing
  }

  // Résumé global
  logger.section('Résumé global')
  console.log(`Total cartes: ${globalStats.total}`)
  console.log(`✅ Supabase: ${globalStats.supabase} (${((globalStats.supabase / globalStats.total) * 100).toFixed(1)}%)`)
  console.log(`⚠️  OPECards: ${globalStats.opecards} (${((globalStats.opecards / globalStats.total) * 100).toFixed(1)}%)`)
  console.log(`⚠️  Autres: ${globalStats.other}`)
  console.log(`❌ Manquantes: ${globalStats.missing}`)

  // Liste des cartes problématiques
  if (problematicCards.length > 0) {
    logger.section(`Cartes avec URLs externes (${problematicCards.length})`)

    // Grouper par série
    const bySeriesMap = new Map<string, typeof problematicCards>()
    for (const card of problematicCards) {
      if (!bySeriesMap.has(card.series)) {
        bySeriesMap.set(card.series, [])
      }
      bySeriesMap.get(card.series)!.push(card)
    }

    for (const [seriesCode, cards] of bySeriesMap) {
      console.log(`\n${seriesCode} (${cards.length} cartes):`)
      // Afficher les 5 premières par série
      const sample = cards.slice(0, 5)
      for (const card of sample) {
        console.log(`  - #${card.number} [${card.language}]`)
      }
      if (cards.length > 5) {
        console.log(`  ... et ${cards.length - 5} autres`)
      }
    }
  }

  // Recommandation
  if (globalStats.opecards > 0 || globalStats.other > 0) {
    logger.section('Action recommandée')
    console.log(`${globalStats.opecards + globalStats.other} images doivent être migrées vers Supabase Storage.`)
    console.log('Exécuter: npx tsx scripts/migrate-onepiece-images.ts')
  }
}

main().catch(console.error)
