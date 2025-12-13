/**
 * Script pour mettre à jour et ajouter les cartes de la série Disney 100 (D100)
 *
 * Usage: npx tsx scripts/update-d100-cards.ts
 */

import { uploadCardImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Définition des 6 cartes Disney 100
const D100_CARDS = [
  {
    name: 'Mickey Mouse, Visage Amical',
    number: '18/P1',
    rarity: 'D100',
    slug: 'disney-100-18-p1-mickey-mouse-visage-amical',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-18-p1-mickey-mouse-visage-amical.webp'
  },
  {
    name: 'Elsa, Sans Gants',
    number: '19/P1',
    rarity: 'D100',
    slug: 'disney-100-19-p1-elsa-sans-gants',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-19-p1-elsa-sans-gants.webp'
  },
  {
    name: 'Génie, Déchaîne Ses Pouvoirs',
    number: '20/P1',
    rarity: 'D100',
    slug: 'disney-100-20-p1-genie-dechaine-ses-pouvoirs',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-20-p1-genie-dechaine-ses-pouvoirs.webp'
  },
  {
    name: 'Stitch, Abominable Créature',
    number: '21/P1',
    rarity: 'D100',
    slug: 'disney-100-21-p1-stitch-abominable-creature',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-21-p1-stitch-abominable-creature.webp'
  },
  {
    name: 'Maléfique, Indésirable',
    number: '22/P1',
    rarity: 'D100',
    slug: 'disney-100-22-p1-malefique-indesirable',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-22-p1-malefique-indesirable.webp'
  },
  {
    name: 'Maui, Demi-Dieu',
    number: '23/P1',
    rarity: 'D100',
    slug: 'disney-100-23-p1-maui-demi-dieu',
    imageUrl: 'https://static.lorcards.fr/cards/fr/d100/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-disney-100-23-p1-maui-demi-dieu.webp'
  }
]

/**
 * Attend un certain délai
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Récupère l'ID de la série D100
 */
async function getD100SeriesId(): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'D100')
    .single()

  if (error || !data) {
    throw new Error('Série D100 non trouvée dans la base de données')
  }

  return data.id
}

/**
 * Script principal
 */
async function main() {
  console.log('🎴 Mise à jour de la série Disney 100 (D100)')
  console.log('='.repeat(60))

  try {
    // Étape 1: Récupérer l'ID de la série D100
    console.log('\n🔍 Recherche de la série D100...')
    const seriesId = await getD100SeriesId()
    console.log('✅ Série D100 trouvée:', seriesId)

    // Étape 2: Supprimer toutes les cartes existantes
    console.log('\n🗑️  Suppression des cartes existantes...')
    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .eq('series_id', seriesId)

    if (deleteError) {
      console.warn('   ⚠️  Erreur suppression:', deleteError.message)
    } else {
      console.log('   ✅ Cartes existantes supprimées')
    }

    // Étape 3: Ajouter toutes les cartes
    let addedCount = 0
    let errorCount = 0

    for (let i = 0; i < D100_CARDS.length; i++) {
      const card = D100_CARDS[i]
      console.log(`\n[${i + 1}/${D100_CARDS.length}] ${card.name} (${card.number})`)

      // Upload de l'image
      console.log('   📥 Upload de l\'image...')
      const imageResult = await uploadCardImage(card.imageUrl, card.number, 'D100')
      const imageUrl = imageResult.success ? imageResult.url! : card.imageUrl

      if (!imageResult.success) {
        console.warn('   ⚠️  Échec upload, utilisation URL originale')
      }

      // Insertion de la carte
      console.log('   ➕ Ajout de la carte...')
      const { error: insertError } = await supabase
        .from('cards')
        .insert({
          series_id: seriesId,
          name: card.name,
          number: card.number,
          language: 'FR',
          chapter: 100, // Chapter spécial pour Disney 100
          rarity: card.rarity,
          image_url: imageUrl,
          attributes: { slug: card.slug }
        })

      if (insertError) {
        console.error('   ❌ Erreur insertion:', insertError.message)
        errorCount++
      } else {
        console.log('   ✅ Carte ajoutée')
        addedCount++
      }

      // Rate limiting
      if (i < D100_CARDS.length - 1) {
        await delay(500)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Mise à jour terminée avec succès!')
    console.log(`   ➕ ${addedCount} cartes ajoutées`)
    console.log(`   ❌ ${errorCount} erreurs`)
    console.log(`\n🌐 Consultez vos cartes: http://localhost:3000/lorcana/series/D100`)

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

// Exécution du script
main()
