/**
 * Script pour migrer les images des séries Lorcana vers Supabase Storage
 * Télécharge les images depuis les sources externes et les stocke localement
 *
 * Usage: npx tsx scripts/migrate-lorcana-series-images.ts
 */

import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Mapping des codes de série vers leurs URLs d'images sources
const SERIES_IMAGES: Record<string, string> = {
  // Sets principaux avec images Takara Tomy
  'FirstChapter': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product01@2x.jpg',
  'Floodborn': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product02@2x.jpg',
  'Ink': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product03@2x.jpg',
  'Ursula': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product04@2x.jpg',
  'Ciel': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product05@2x.jpg',
  'Azurite': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product06@2x.jpg',
  'Archazia': 'https://www.takaratomy.co.jp/products/disneylorcana/img/product/bnr_product_archazias@2x.jpg',
  // Sets avec images lorcards.fr
  'Jafar': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-8-roj-le-regne-de-jafar.webp',
  'Faboulus': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-9-fab-fabuleux.webp',
  'Lueur': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-10-lueurs-dans-les-profondeurs.webp',
  // Sets spéciaux
  'D100': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-d100-edition-collector-disney-100.webp',
  'Quest': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu1-quete-des-illumineurs-menaces-des-profondeurs.webp',
  'QuestDeep': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu1-quete-des-illumineurs-menaces-des-profondeurs.webp',
  'QuestPalace': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu2-quete-des-illumineurs-vol-au-palais.webp',
  'Promo': 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-p-cartes-promotionnelles.webp',
}

const BUCKET_NAME = 'lorcana-cards'

/**
 * Télécharge une image depuis une URL avec les bons headers
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': new URL(url).origin + '/',
      }
    })

    if (!response.ok) {
      logger.error(`Échec du téléchargement: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    logger.error(`Erreur lors du téléchargement: ${error}`)
    return null
  }
}

/**
 * Optimise l'image et l'upload sur Supabase Storage
 */
async function uploadSeriesImageToStorage(
  buffer: Buffer,
  seriesCode: string
): Promise<string | null> {
  try {
    // Optimiser l'image - bannière format 4:1 (800x200)
    const optimizedImage = await sharp(buffer)
      .resize(1200, null, { // Largeur max 1200px, hauteur proportionnelle
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `series/${seriesCode}.webp`

    logger.upload(`Upload de ${fileName}...`)

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      logger.error(`Erreur upload: ${error.message}`)
      return null
    }

    // Générer l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    return publicUrlData.publicUrl
  } catch (error) {
    logger.error(`Erreur traitement image: ${error}`)
    return null
  }
}

async function migrateSeriesImages() {
  logger.section('Migration des images des séries Lorcana vers Supabase Storage')

  // Récupérer le TCG Lorcana
  const { data: tcgGame, error: tcgError } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'lorcana')
    .single()

  if (tcgError || !tcgGame) {
    logger.error(`TCG Lorcana non trouvé: ${tcgError?.message}`)
    process.exit(1)
  }

  logger.success(`TCG Lorcana trouvé: ${tcgGame.id}`)

  // Récupérer toutes les séries Lorcana
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .eq('tcg_game_id', tcgGame.id)
    .order('release_date', { ascending: true })

  if (seriesError || !series) {
    logger.error(`Erreur lors de la récupération des séries: ${seriesError?.message}`)
    process.exit(1)
  }

  logger.info(`${series.length} séries trouvées\n`)

  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0

  // Migrer chaque série
  for (const serie of series) {
    logger.separator()
    logger.processing(`${serie.code} - ${serie.name}`)

    // Vérifier si l'image est déjà sur Supabase Storage
    if (serie.image_url?.includes('supabase')) {
      logger.info('Image déjà sur Supabase Storage, ignorée')
      skippedCount++
      continue
    }

    // Récupérer l'URL source
    const sourceUrl = SERIES_IMAGES[serie.code]

    if (!sourceUrl) {
      logger.warn(`Pas d'URL source configurée pour ${serie.code}`)
      skippedCount++
      continue
    }

    // Télécharger l'image
    logger.download(`Téléchargement depuis ${sourceUrl}...`)
    const imageBuffer = await downloadImage(sourceUrl)

    if (!imageBuffer) {
      logger.error(`Impossible de télécharger l'image pour ${serie.code}`)
      errorCount++
      continue
    }

    logger.success(`Image téléchargée (${Math.round(imageBuffer.length / 1024)} KB)`)

    // Upload sur Supabase Storage
    const newUrl = await uploadSeriesImageToStorage(imageBuffer, serie.code)

    if (!newUrl) {
      logger.error(`Impossible d'uploader l'image pour ${serie.code}`)
      errorCount++
      continue
    }

    // Mettre à jour l'URL dans la base de données
    const { error: updateError } = await supabase
      .from('series')
      .update({ image_url: newUrl })
      .eq('id', serie.id)

    if (updateError) {
      logger.error(`Erreur mise à jour DB: ${updateError.message}`)
      errorCount++
      continue
    }

    logger.success(`Image migrée: ${newUrl}`)
    migratedCount++

    // Délai entre chaque migration pour éviter le rate limiting
    await delay(500)
  }

  logger.section('Résumé de la migration')
  logger.progress(`Migrées: ${migratedCount}`)
  logger.info(`Ignorées: ${skippedCount}`)
  if (errorCount > 0) {
    logger.error(`Erreurs: ${errorCount}`)
  }
  logger.progress(`Total: ${series.length}`)

  logger.section('Migration terminée!')
  logger.web('Consultez: http://localhost:3000/series/lorcana')
}

// Exécution du script
migrateSeriesImages().catch(console.error)
