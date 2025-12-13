/**
 * Script pour mettre à jour les images des séries Lorcana
 * Usage: tsx scripts/update-lorcana-series-images.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Mapping des codes de série vers leurs URLs d'images (Takara Tomy Japan)
const SERIES_IMAGES: Record<string, string> = {
  // Sets principaux avec images Takara Tomy
  'FirstChapter': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product01@2x.jpg',  // Set 1 - Premier Chapitre
  'Floodborn': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product02@2x.jpg',    // Set 2 - L'Ascension des Floodborn
  'Ink': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product03@2x.jpg',          // Set 3 - Les Terres d'Encres
  'Ursula': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product04@2x.jpg',       // Set 4 - Le Retour d'Ursula
  'Ciel': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product05@2x.jpg',         // Set 5 - Ciel Scintillant
  'Azurite': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product06@2x.jpg',      // Set 6 - La Mer Azurite
  'Archazia': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product_archazias@2x.jpg', // Set 7 - L'Île d'Archazia
  // Sets sans image Takara Tomy (conservent les anciennes URLs lorcards.fr)
  'Jafar': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-8-roj-le-regne-de-jafar.webp',
  'Faboulus': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-9-fab-fabuleux.webp',
  'Lueur': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-10-lueurs-dans-les-profondeurs.webp',
  // Sets spéciaux
  'D100': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-d100-edition-collector-disney-100.webp',
  'Quest': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu1-quete-des-illumineurs-menaces-des-profondeurs.webp',
  'Promo': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-promo.webp',
}

async function updateSeriesImages() {
  console.log('🖼️  Mise à jour des images des séries Lorcana')
  console.log('='.repeat(60))

  // Récupérer le TCG Lorcana
  const { data: tcgGame, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'lorcana')
    .single()

  if (tcgError || !tcgGame) {
    console.error('❌ TCG Lorcana non trouvé:', tcgError)
    process.exit(1)
  }

  console.log('✅ TCG Lorcana trouvé:', tcgGame.id)

  // Récupérer toutes les séries Lorcana
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .eq('tcg_game_id', tcgGame.id)

  if (seriesError || !series) {
    console.error('❌ Erreur lors de la récupération des séries:', seriesError)
    process.exit(1)
  }

  console.log(`\n📋 ${series.length} séries trouvées\n`)

  let updatedCount = 0
  let skippedCount = 0

  // Mettre à jour chaque série
  for (const serie of series) {
    const imageUrl = SERIES_IMAGES[serie.code]

    if (!imageUrl) {
      console.log(`⚠️  ${serie.code} - ${serie.name}: Pas d'image configurée`)
      skippedCount++
      continue
    }

    // Vérifier si l'image est déjà à jour
    if (serie.image_url === imageUrl) {
      console.log(`✓  ${serie.code} - ${serie.name}: Image déjà à jour`)
      skippedCount++
      continue
    }

    // Mettre à jour l'image
    const { error: updateError } = await supabase
      .from('series')
      .update({ image_url: imageUrl })
      .eq('id', serie.id)

    if (updateError) {
      console.error(`❌ ${serie.code} - ${serie.name}: Erreur mise à jour`, updateError)
      continue
    }

    console.log(`✅ ${serie.code} - ${serie.name}: Image mise à jour`)
    updatedCount++
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Résumé:')
  console.log(`   ✅ Mises à jour: ${updatedCount}`)
  console.log(`   ⏭️  Ignorées: ${skippedCount}`)
  console.log(`   📈 Total: ${series.length}`)
  console.log('\n🎉 Mise à jour terminée!')
  console.log(`\n🌐 Consultez: http://localhost:3000/lorcana/series`)
}

// Exécution du script
updateSeriesImages()
