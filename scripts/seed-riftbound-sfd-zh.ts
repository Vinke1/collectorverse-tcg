/**
 * Script pour scraper et ajouter les cartes Riftbound SFD (Spiritforged) en chinois
 * depuis l'API playloltcg.com
 *
 * Usage: npx tsx scripts/seed-riftbound-sfd-zh.ts [--dry-run] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import sharp from 'sharp'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configuration
const CONFIG = {
  API_URL: 'https://lol-api.playloltcg.com/xcx/card/searchCardCraftWeb',
  PRODUCT_CODE: 'SFD(进阶补充包)',
  SERIES_CODE: 'SFD',
  LANGUAGE: 'zh',
  BUCKET: 'riftbound-cards',
  PAGE_SIZE: 100,
  DELAY_BETWEEN_CARDS: 200,
  DELAY_BETWEEN_PAGES: 1000,
}

// Parse arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined

interface CardData {
  cardNo: string
  cardName: string
  frontImage: string
  rarity: string
  rarityName: string
  cardCategory: string
  cardCategoryName: string
  energy: number | null
  power: number | null
  cardColorList: string[]
  artist: string
  cardEffect: string
  flavorText: string
}

interface ApiResponse {
  result: {
    total: number
    list: CardData[]
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchCards(pageNum: number): Promise<ApiResponse> {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pageNum,
      pageSize: CONFIG.PAGE_SIZE,
      productCodeList: [CONFIG.PRODUCT_CODE],
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

function parseCardNumber(cardNo: string): string {
  // Format: "SFD·001/221" -> "1"
  // Format: "SFD·020a/221" -> "20a" (variant cards)
  // Format: "SFD·223*/221" -> "223-star" (star variants)
  // Format: "SFD·T01" -> "T01" (tokens)
  // Format: "SFD·R01" -> "R01" (runes)
  // Format: "SFD·R01a" -> "R01a" (rune variants)

  // Try standard numbered cards first
  const numberMatch = cardNo.match(/SFD·(\d+)([a-z])?\//)
  if (numberMatch) {
    const number = parseInt(numberMatch[1], 10).toString()
    const variant = numberMatch[2] || ''
    return number + variant
  }

  // Star variants (e.g., SFD·223*/221)
  const starMatch = cardNo.match(/SFD·(\d+)\*\//)
  if (starMatch) {
    return parseInt(starMatch[1], 10).toString() + '-star'
  }

  // Token cards (e.g., SFD·T01)
  const tokenMatch = cardNo.match(/SFD·(T\d+)/)
  if (tokenMatch) {
    return tokenMatch[1]
  }

  // Rune cards (e.g., SFD·R01 or SFD·R01a)
  const runeMatch = cardNo.match(/SFD·(R\d+[a-z]?)/)
  if (runeMatch) {
    return runeMatch[1]
  }

  return cardNo
}

function mapRarity(rarity: string): string {
  // Map Chinese rarities to English equivalents
  const rarityMap: Record<string, string> = {
    'rune_dust': 'common',
    'rune_shard': 'uncommon',
    'rune_glimmer': 'rare',
    'rune_core': 'epic',
    'rune_legend': 'showcase',
  }
  return rarityMap[rarity] || rarity
}

function mapCardType(cardCategory: string): string {
  // Map Chinese card types to English equivalents
  const typeMap: Record<string, string> = {
    'spell': 'spell',
    'unit': 'unit',
    'champion': 'champion',
    'hero_unit': 'champion', // Hero units are champions in Riftbound
    'equipment': 'equipment',
  }
  return typeMap[cardCategory] || cardCategory
}

function mapColor(color: string): string {
  // Map Chinese colors to domains
  const colorMap: Record<string, string> = {
    'red': 'fury',
    'blue': 'calm',
    'yellow': 'chaos',
    'green': 'calm', // Green maps to Calm in Riftbound
  }
  return colorMap[color] || color
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(480, 672, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer()
}

async function uploadImage(buffer: Buffer, storagePath: string): Promise<string> {
  const { error } = await supabase.storage
    .from(CONFIG.BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'image/webp',
      upsert: true,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(CONFIG.BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

async function main() {
  console.log('🎮 Scraping des cartes Riftbound SFD (Spiritforged) en chinois\n')

  if (isDryRun) {
    console.log('📋 MODE DRY-RUN - Aucune modification ne sera effectuée\n')
  }

  // 1. Récupérer la série SFD
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id')
    .eq('code', CONFIG.SERIES_CODE)
    .single()

  if (seriesError || !series) {
    console.error('❌ Série SFD non trouvée')
    process.exit(1)
  }

  console.log(`✅ Série SFD trouvée: ${series.id}\n`)

  // 2. Récupérer toutes les cartes depuis l'API
  console.log('📡 Récupération des cartes depuis l\'API...')

  let allCards: CardData[] = []
  let pageNum = 1
  let totalPages = 1

  while (pageNum <= totalPages) {
    console.log(`   Page ${pageNum}/${totalPages}...`)

    const response = await fetchCards(pageNum)
    allCards = allCards.concat(response.result.list)

    totalPages = Math.ceil(response.result.total / CONFIG.PAGE_SIZE)
    pageNum++

    if (pageNum <= totalPages) {
      await delay(CONFIG.DELAY_BETWEEN_PAGES)
    }
  }

  console.log(`✅ ${allCards.length} cartes récupérées\n`)

  // Apply limit if specified
  if (limit && limit > 0) {
    allCards = allCards.slice(0, limit)
    console.log(`📋 Limité à ${limit} cartes\n`)
  }

  // 3. Traiter chaque carte
  let success = 0
  let errors = 0
  let skipped = 0

  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i]
    const cardNumber = parseCardNumber(card.cardNo)
    const storagePath = `${CONFIG.SERIES_CODE}/${CONFIG.LANGUAGE}/${cardNumber}.webp`

    console.log(`[${i + 1}/${allCards.length}] Carte ${cardNumber}: ${card.cardName}`)

    if (isDryRun) {
      console.log(`   📋 [DRY-RUN] Rarity: ${card.rarity} -> ${mapRarity(card.rarity)}`)
      console.log(`   📋 [DRY-RUN] Type: ${card.cardCategory}`)
      console.log(`   📋 [DRY-RUN] Colors: ${card.cardColorList?.join(', ')}`)
      console.log(`   📋 [DRY-RUN] Image: ${card.frontImage}`)
      console.log(`   📋 [DRY-RUN] Storage: ${storagePath}`)
      success++
      continue
    }

    try {
      // Vérifier si la carte existe déjà
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('series_id', series.id)
        .eq('number', cardNumber)
        .eq('language', CONFIG.LANGUAGE)
        .single()

      if (existingCard) {
        console.log(`   ⏭️  Carte déjà existante, skip`)
        skipped++
        continue
      }

      // Télécharger l'image
      const imageBuffer = await downloadImage(card.frontImage)
      console.log(`   ✓ Téléchargée (${(imageBuffer.length / 1024).toFixed(0)} KB)`)

      // Optimiser l'image
      const optimizedBuffer = await optimizeImage(imageBuffer)
      console.log(`   ✓ Optimisée (${(optimizedBuffer.length / 1024).toFixed(0)} KB)`)

      // Uploader sur Supabase Storage
      const publicUrl = await uploadImage(optimizedBuffer, storagePath)
      console.log(`   ✓ Uploadée`)

      // Créer la carte dans la base de données
      const { error: cardError } = await supabase
        .from('cards')
        .insert({
          series_id: series.id,
          number: cardNumber,
          language: CONFIG.LANGUAGE,
          name: card.cardName,
          image_url: publicUrl,
          rarity: mapRarity(card.rarity),
          attributes: {
            card_type: mapCardType(card.cardCategory),
            energy: card.energy,
            might: card.power,
            domains: card.cardColorList?.map(mapColor) || [],
            illustrator: card.artist,
            text: card.cardEffect,
            flavor_text: card.flavorText,
          },
        })

      if (cardError) {
        console.error(`   ❌ Erreur DB: ${cardError.message}`)
        errors++
      } else {
        console.log(`   ✓ Enregistrée en base`)
        success++
      }

    } catch (err) {
      console.error(`   ❌ Erreur: ${err instanceof Error ? err.message : err}`)
      errors++
    }

    // Délai entre les cartes
    await delay(CONFIG.DELAY_BETWEEN_CARDS)
  }

  console.log(`\n📊 Résumé:`)
  console.log(`   ✅ Succès: ${success}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Erreurs: ${errors}`)
  console.log(`   📋 Total: ${allCards.length}`)
}

main().catch(console.error)
