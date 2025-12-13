// Charger les variables d'environnement depuis .env.local (pour les scripts)
// Cette ligne est ignorée dans Next.js car les variables sont déjà chargées
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  try {
    const dotenv = require('dotenv')
    const path = require('path')
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  } catch (e) {
    // Ignore si dotenv n'est pas installé (contexte Next.js)
  }
}

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// Client Supabase avec service role key pour les opérations admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Variables d\'environnement Supabase manquantes')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Crée le bucket pour les cartes Lorcana s'il n'existe pas déjà
 */
export async function createLorcanaBucket() {
  try {
    // Vérifier si le bucket existe
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === 'lorcana-cards')

    if (bucketExists) {
      console.log('✅ Bucket "lorcana-cards" existe déjà')
      return { success: true, message: 'Bucket existe déjà' }
    }

    // Créer le bucket
    const { data, error } = await supabaseAdmin.storage.createBucket('lorcana-cards', {
      public: true, // Accès public en lecture
      fileSizeLimit: 5242880, // 5MB max par fichier
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (error) {
      console.error('❌ Erreur création bucket:', error)
      return { success: false, error }
    }

    console.log('✅ Bucket "lorcana-cards" créé avec succès')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

/**
 * Télécharge une image depuis une URL, l'optimise et l'upload sur Supabase Storage
 */
export async function uploadCardImage(
  imageUrl: string,
  cardNumber: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image ${cardNumber}...`)

    // Télécharger l'image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    console.log(`🔧 Optimisation de l'image ${cardNumber}...`)
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, { // Format carte standard
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 }) // Conversion en WebP pour meilleur ratio qualité/poids
      .toBuffer()

    // Générer le chemin du fichier
    const fileName = `${seriesCode}/${cardNumber.replace('/', '-')}.webp`

    // Upload sur Supabase Storage
    console.log(`☁️  Upload de ${fileName}...`)
    const { data, error } = await supabaseAdmin.storage
      .from('lorcana-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true // Remplacer si existe déjà
      })

    if (error) {
      console.error(`❌ Erreur upload ${cardNumber}:`, error)
      return { success: false, error }
    }

    // Générer l'URL publique
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('lorcana-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image ${cardNumber} uploadée avec succès`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image ${cardNumber}:`, error)
    return { success: false, error }
  }
}

/**
 * Supprime toutes les images d'une série (utile pour réinitialiser)
 */
export async function deleteSeriesImages(seriesCode: string) {
  try {
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('lorcana-cards')
      .list(seriesCode)

    if (listError) {
      return { success: false, error: listError }
    }

    if (!files || files.length === 0) {
      return { success: true, message: 'Aucun fichier à supprimer' }
    }

    const filePaths = files.map(file => `${seriesCode}/${file.name}`)
    const { error: deleteError } = await supabaseAdmin.storage
      .from('lorcana-cards')
      .remove(filePaths)

    if (deleteError) {
      return { success: false, error: deleteError }
    }

    console.log(`✅ ${files.length} images supprimées pour ${seriesCode}`)
    return { success: true, count: files.length }

  } catch (error) {
    return { success: false, error }
  }
}

/**
 * Upload une image de série/set
 */
export async function uploadSeriesImage(
  imageUrl: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image de la série ${seriesCode}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image
    const optimizedImage = await sharp(buffer)
      .resize(800, null, { // Largeur max 800px, hauteur proportionnelle
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `series/${seriesCode}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('lorcana-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('lorcana-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image de série ${seriesCode} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image série ${seriesCode}:`, error)
    return { success: false, error }
  }
}

// ============================================
// RIFTBOUND STORAGE FUNCTIONS
// ============================================

/**
 * Crée le bucket pour les cartes Riftbound s'il n'existe pas déjà
 */
export async function createRiftboundBucket() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === 'riftbound-cards')

    if (bucketExists) {
      console.log('✅ Bucket "riftbound-cards" existe déjà')
      return { success: true, message: 'Bucket existe déjà' }
    }

    const { data, error } = await supabaseAdmin.storage.createBucket('riftbound-cards', {
      public: true,
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (error) {
      console.error('❌ Erreur création bucket:', error)
      return { success: false, error }
    }

    console.log('✅ Bucket "riftbound-cards" créé avec succès')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

/**
 * Upload une image de carte Riftbound
 */
export async function uploadRiftboundCardImage(
  imageUrl: string,
  cardNumber: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image ${cardNumber}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    console.log(`🔧 Optimisation de l'image ${cardNumber}...`)
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Format: OGN/001.webp
    const fileName = `${seriesCode}/${cardNumber.padStart(3, '0')}.webp`

    console.log(`☁️  Upload de ${fileName}...`)
    const { data, error } = await supabaseAdmin.storage
      .from('riftbound-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload ${cardNumber}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('riftbound-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image ${cardNumber} uploadée avec succès`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image ${cardNumber}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une icône (domain, card_type, rarity) pour Riftbound
 */
export async function uploadRiftboundIcon(
  imageUrl: string,
  iconType: 'domains' | 'card_types' | 'rarities',
  code: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'icône ${iconType}/${code}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'icône (64x64 pour domains/card_types, plus grand pour rarities)
    const size = iconType === 'rarities' ? 128 : 64
    const optimizedImage = await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `icons/${iconType}/${code}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('riftbound-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload icône ${code}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('riftbound-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Icône ${iconType}/${code} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement icône ${code}:`, error)
    return { success: false, error }
  }
}

// ============================================
// ONE PIECE STORAGE FUNCTIONS
// ============================================

/**
 * Crée le bucket pour les cartes One Piece s'il n'existe pas déjà
 */
export async function createOnePieceBucket() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === 'onepiece-cards')

    if (bucketExists) {
      console.log('✅ Bucket "onepiece-cards" existe déjà')
      return { success: true, message: 'Bucket existe déjà' }
    }

    const { data, error } = await supabaseAdmin.storage.createBucket('onepiece-cards', {
      public: true,
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (error) {
      console.error('❌ Erreur création bucket:', error)
      return { success: false, error }
    }

    console.log('✅ Bucket "onepiece-cards" créé avec succès')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

/**
 * Upload une image de carte One Piece
 * @param imageUrl URL de l'image source
 * @param cardNumber Numéro de la carte (ex: "001", "001-PR")
 * @param seriesCode Code de la série (ex: "OP13", "ST01")
 * @param language Langue de la carte (ex: "fr", "en", "jp")
 */
export async function uploadOnePieceCardImage(
  imageUrl: string,
  cardNumber: string,
  seriesCode: string,
  language: string = 'fr'
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image ${seriesCode}-${cardNumber} (${language})...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    console.log(`🔧 Optimisation de l'image ${cardNumber}...`)
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Format: OP13/fr/001.webp ou OP13/fr/001-PR.webp
    const safeCardNumber = cardNumber.replace('/', '-')
    const fileName = `${seriesCode}/${language}/${safeCardNumber}.webp`

    console.log(`☁️  Upload de ${fileName}...`)
    const { data, error } = await supabaseAdmin.storage
      .from('onepiece-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload ${cardNumber}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('onepiece-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image ${cardNumber} uploadée avec succès`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image ${cardNumber}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une image de série One Piece
 */
export async function uploadOnePieceSeriesImage(
  imageUrl: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image de la série ${seriesCode}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image
    const optimizedImage = await sharp(buffer)
      .resize(800, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `series/${seriesCode}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('onepiece-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('onepiece-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image de série ${seriesCode} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image série ${seriesCode}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une icône (color, card_type, attribute, rarity) pour One Piece
 */
export async function uploadOnePieceIcon(
  imageUrl: string,
  iconType: 'colors' | 'card_types' | 'attributes' | 'rarities',
  code: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'icône ${iconType}/${code}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'icône (64x64 pour la plupart, 128x128 pour rarities)
    const size = iconType === 'rarities' ? 128 : 64
    const optimizedImage = await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `icons/${iconType}/${code}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('onepiece-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload icône ${code}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('onepiece-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Icône ${iconType}/${code} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement icône ${code}:`, error)
    return { success: false, error }
  }
}

/**
 * Supprime toutes les images d'une série One Piece (utile pour réinitialiser)
 */
export async function deleteOnePieceSeriesImages(seriesCode: string, language?: string) {
  try {
    const path = language ? `${seriesCode}/${language}` : seriesCode
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('onepiece-cards')
      .list(path)

    if (listError) {
      return { success: false, error: listError }
    }

    if (!files || files.length === 0) {
      return { success: true, message: 'Aucun fichier à supprimer' }
    }

    const filePaths = files.map(file => `${path}/${file.name}`)
    const { error: deleteError } = await supabaseAdmin.storage
      .from('onepiece-cards')
      .remove(filePaths)

    if (deleteError) {
      return { success: false, error: deleteError }
    }

    console.log(`✅ ${files.length} images supprimées pour ${path}`)
    return { success: true, count: files.length }

  } catch (error) {
    return { success: false, error }
  }
}

// ============================================
// STAR WARS UNLIMITED STORAGE FUNCTIONS
// ============================================

/**
 * Crée le bucket pour les cartes Star Wars Unlimited s'il n'existe pas déjà
 */
export async function createStarWarsBucket() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === 'starwars-cards')

    if (bucketExists) {
      console.log('✅ Bucket "starwars-cards" existe déjà')
      return { success: true, message: 'Bucket existe déjà' }
    }

    const { data, error } = await supabaseAdmin.storage.createBucket('starwars-cards', {
      public: true,
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (error) {
      console.error('❌ Erreur création bucket:', error)
      return { success: false, error }
    }

    console.log('✅ Bucket "starwars-cards" créé avec succès')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

/**
 * Upload une image de carte Star Wars Unlimited
 * @param imageUrl URL de l'image source
 * @param cardNumber Numéro de la carte (ex: "001", "001-H" pour hyperspace)
 * @param seriesCode Code de la série (ex: "SOR", "SHD")
 * @param language Langue de la carte (ex: "fr", "en")
 */
export async function uploadStarWarsCardImage(
  imageUrl: string,
  cardNumber: string,
  seriesCode: string,
  language: string = 'fr'
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image ${seriesCode}-${cardNumber} (${language})...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    console.log(`🔧 Optimisation de l'image ${cardNumber}...`)
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Format: SOR/fr/001.webp ou SOR/fr/001-H.webp
    const safeCardNumber = cardNumber.replace('/', '-')
    const fileName = `${seriesCode}/${language}/${safeCardNumber}.webp`

    console.log(`☁️  Upload de ${fileName}...`)
    const { data, error } = await supabaseAdmin.storage
      .from('starwars-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload ${cardNumber}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('starwars-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image ${cardNumber} uploadée avec succès`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image ${cardNumber}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une image de série Star Wars Unlimited
 */
export async function uploadStarWarsSeriesImage(
  imageUrl: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image de la série ${seriesCode}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image
    const optimizedImage = await sharp(buffer)
      .resize(800, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `series/${seriesCode}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('starwars-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('starwars-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image de série ${seriesCode} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image série ${seriesCode}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une icône (arena, aspect, card_type, rarity) pour Star Wars Unlimited
 */
export async function uploadStarWarsIcon(
  imageUrl: string,
  iconType: 'arenas' | 'aspects' | 'card_types' | 'rarities',
  code: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'icône ${iconType}/${code}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'icône (64x64 pour la plupart, 128x128 pour rarities)
    const size = iconType === 'rarities' ? 128 : 64
    const optimizedImage = await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `icons/${iconType}/${code}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('starwars-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload icône ${code}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('starwars-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Icône ${iconType}/${code} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement icône ${code}:`, error)
    return { success: false, error }
  }
}

/**
 * Supprime toutes les images d'une série Star Wars Unlimited (utile pour réinitialiser)
 */
export async function deleteStarWarsSeriesImages(seriesCode: string, language?: string) {
  try {
    const path = language ? `${seriesCode}/${language}` : seriesCode
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('starwars-cards')
      .list(path)

    if (listError) {
      return { success: false, error: listError }
    }

    if (!files || files.length === 0) {
      return { success: true, message: 'Aucun fichier à supprimer' }
    }

    const filePaths = files.map(file => `${path}/${file.name}`)
    const { error: deleteError } = await supabaseAdmin.storage
      .from('starwars-cards')
      .remove(filePaths)

    if (deleteError) {
      return { success: false, error: deleteError }
    }

    console.log(`✅ ${files.length} images supprimées pour ${path}`)
    return { success: true, count: files.length }

  } catch (error) {
    return { success: false, error }
  }
}

// ============================================
// NARUTO KAYOU STORAGE FUNCTIONS
// ============================================

/**
 * Crée le bucket pour les cartes Naruto Kayou s'il n'existe pas déjà
 */
export async function createNarutoBucket() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === 'naruto-cards')

    if (bucketExists) {
      console.log('✅ Bucket "naruto-cards" existe déjà')
      return { success: true, message: 'Bucket existe déjà' }
    }

    const { data, error } = await supabaseAdmin.storage.createBucket('naruto-cards', {
      public: true,
      fileSizeLimit: 5242880, // 5MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    })

    if (error) {
      console.error('❌ Erreur création bucket:', error)
      return { success: false, error }
    }

    console.log('✅ Bucket "naruto-cards" créé avec succès')
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
}

/**
 * Upload une image de carte Naruto Kayou
 * @param imageUrl URL de l'image source
 * @param cardNumber Numéro de la carte (ex: "001", "037")
 * @param rarityCode Code de la rareté (ex: "R", "SR", "SSR")
 */
export async function uploadNarutoCardImage(
  imageUrl: string,
  cardNumber: string,
  rarityCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image ${rarityCode}-${cardNumber}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image avec Sharp
    console.log(`🔧 Optimisation de l'image ${rarityCode}-${cardNumber}...`)
    const optimizedImage = await sharp(buffer)
      .resize(480, 672, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Format: R/001.webp, SR/037.webp
    const paddedNumber = cardNumber.padStart(3, '0')
    const fileName = `${rarityCode}/${paddedNumber}.webp`

    console.log(`☁️  Upload de ${fileName}...`)
    const { data, error } = await supabaseAdmin.storage
      .from('naruto-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      console.error(`❌ Erreur upload ${rarityCode}-${cardNumber}:`, error)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('naruto-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image ${rarityCode}-${cardNumber} uploadée avec succès`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image ${rarityCode}-${cardNumber}:`, error)
    return { success: false, error }
  }
}

/**
 * Upload une image de série Naruto Kayou
 */
export async function uploadNarutoSeriesImage(
  imageUrl: string,
  seriesCode: string
): Promise<{ success: boolean; url?: string; error?: any }> {
  try {
    console.log(`📥 Téléchargement de l'image de la série ${seriesCode}...`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Optimiser l'image
    const optimizedImage = await sharp(buffer)
      .resize(800, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 90 })
      .toBuffer()

    const fileName = `series/${seriesCode}.webp`

    const { data, error } = await supabaseAdmin.storage
      .from('naruto-cards')
      .upload(fileName, optimizedImage, {
        contentType: 'image/webp',
        upsert: true
      })

    if (error) {
      return { success: false, error }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('naruto-cards')
      .getPublicUrl(fileName)

    console.log(`✅ Image de série ${seriesCode} uploadée`)
    return { success: true, url: publicUrlData.publicUrl }

  } catch (error) {
    console.error(`❌ Erreur traitement image série ${seriesCode}:`, error)
    return { success: false, error }
  }
}
