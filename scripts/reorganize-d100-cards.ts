/**
 * Script pour réorganiser les cartes D100
 * - Déplacer 4 cartes vers FirstChapter (20/P1 à 23/P1)
 * - Marquer toutes les cartes D100 comme "Enchanted" (foil uniquement)
 *
 * Usage: npm run reorganize:d100
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

// Initialize Supabase admin client
const supabase = createAdminClient()

async function main() {
  console.log('🔄 Réorganisation des cartes Disney 100 (D100)')
  console.log('='.repeat(60))

  try {
    // Étape 1: Récupérer les IDs des séries
    console.log('\n🔍 Récupération des séries...')

    const { data: d100Series } = await supabase
      .from('series')
      .select('id, name')
      .eq('code', 'D100')
      .single()

    const { data: firstChapterSeries } = await supabase
      .from('series')
      .select('id, name')
      .eq('code', 'FirstChapter')
      .single()

    if (!d100Series || !firstChapterSeries) {
      throw new Error('Séries non trouvées')
    }

    console.log('✅ D100:', d100Series.name, '-', d100Series.id)
    console.log('✅ FirstChapter:', firstChapterSeries.name, '-', firstChapterSeries.id)

    // Étape 2: Récupérer toutes les cartes D100
    console.log('\n📊 Récupération des cartes D100...')
    const { data: d100Cards, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('series_id', d100Series.id)

    if (fetchError || !d100Cards) {
      throw new Error(`Erreur récupération cartes: ${fetchError?.message}`)
    }

    console.log(`✅ ${d100Cards.length} cartes trouvées`)

    // Étape 3: Séparer les cartes à déplacer et celles à garder
    const cardsToMove = d100Cards.filter(card =>
      ['20/P1', '21/P1', '22/P1', '23/P1'].includes(card.number)
    )

    const cardsToKeep = d100Cards.filter(card =>
      ['18/P1', '19/P1'].includes(card.number)
    )

    console.log(`\n📦 Cartes à garder dans D100 (${cardsToKeep.length}):`)
    cardsToKeep.forEach(card => {
      console.log(`   - ${card.number} ${card.name}`)
    })

    console.log(`\n➡️  Cartes à déplacer vers FirstChapter (${cardsToMove.length}):`)
    cardsToMove.forEach(card => {
      console.log(`   - ${card.number} ${card.name}`)
    })

    // Étape 4: Déplacer les cartes vers FirstChapter
    console.log('\n🚀 Déplacement des cartes...')
    for (const card of cardsToMove) {
      console.log(`\n   🔄 ${card.number} - ${card.name}`)

      const { error: updateError } = await supabase
        .from('cards')
        .update({
          series_id: firstChapterSeries.id,
          rarity: 'D100 Enchanted' // Marquer comme enchanted (foil uniquement)
        })
        .eq('id', card.id)

      if (updateError) {
        console.error(`   ❌ Erreur:`, updateError.message)
      } else {
        console.log(`   ✅ Déplacée vers FirstChapter`)
      }
    }

    // Étape 5: Mettre à jour les cartes restantes dans D100 comme Enchanted
    console.log('\n✨ Mise à jour des cartes restantes en D100 comme Enchanted...')
    for (const card of cardsToKeep) {
      console.log(`\n   ✨ ${card.number} - ${card.name}`)

      const { error: updateError } = await supabase
        .from('cards')
        .update({
          rarity: 'D100 Enchanted'
        })
        .eq('id', card.id)

      if (updateError) {
        console.error(`   ❌ Erreur:`, updateError.message)
      } else {
        console.log(`   ✅ Marquée comme Enchanted`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Réorganisation terminée avec succès!')
    console.log(`\n🌐 Vérifiez:`)
    console.log(`   - D100: http://localhost:3000/lorcana/series/D100`)
    console.log(`   - FirstChapter: http://localhost:3000/lorcana/series/FirstChapter`)

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
