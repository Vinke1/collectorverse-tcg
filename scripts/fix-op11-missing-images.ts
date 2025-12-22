/**
 * Script pour corriger les images manquantes de OP11
 * Récupère les cartes sans image et les télécharge depuis opecards.fr
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer'
import sharp from 'sharp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://www.opecards.fr'

interface CardToFix {
  id: string
  number: string
  name: string
  language: string
}

async function getCardsWithoutImages(): Promise<CardToFix[]> {
  // Get OP11 series
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP11')
    .single()

  if (!series) {
    throw new Error('Series OP11 not found')
  }

  // Get cards without images
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, number, name, language')
    .eq('series_id', series.id)
    .is('image_url', null)
    .order('language')
    .order('number')

  if (error) {
    throw error
  }

  return cards || []
}

function buildCardUrl(card: CardToFix): string {
  const langPrefix = card.language === 'en' ? 'en-' : ''
  const namePart = card.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Remove multiple dashes
    .trim()

  // Handle ALT versions
  let numberPart = card.number.replace('-ALT2', '').replace('-ALT', '')
  const isAlt = card.number.includes('-ALT')
  const isAlt2 = card.number.includes('-ALT2')

  // Determine rarity from card (we don't have it, so we'll try common patterns)
  // We'll search the page to find the correct URL
  return `${BASE_URL}/cards/search?q=${encodeURIComponent(card.name)}&language=${card.language.toUpperCase()}`
}

async function findCardPageUrl(page: puppeteer.Page, card: CardToFix): Promise<string | null> {
  const langPrefix = card.language === 'en' ? 'en-' : ''
  const baseNumber = card.number.replace('-ALT2', '').replace('-ALT', '').padStart(3, '0')
  const isAlt = card.number.includes('-ALT') && !card.number.includes('-ALT2')
  const isAlt2 = card.number.includes('-ALT2')

  // Build search patterns
  const patterns = [
    `op11-${baseNumber}`,
    `${langPrefix}op11-${baseNumber}`
  ]

  if (isAlt2) {
    patterns.unshift(`${langPrefix}op11-${baseNumber}-sec-manga`)
    patterns.unshift(`${langPrefix}op11-${baseNumber}-sec-version-2`)
  } else if (isAlt) {
    patterns.unshift(`${langPrefix}op11-${baseNumber}-.*-version-2`)
  }

  // Search on the series page
  const searchUrl = `${BASE_URL}/cards/search?sortBy=releaseR&serie=${card.language === 'en' ? '678' : '677'}&language=${card.language.toUpperCase()}`

  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    // Get all card links
    const cardLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      return Array.from(links).map(link => (link as HTMLAnchorElement).href)
    })

    // Find matching link
    for (const link of cardLinks) {
      const urlPath = new URL(link).pathname

      // Check if this is the right card number
      const numberMatch = urlPath.match(/op11-(\d{3})/i)
      if (!numberMatch) continue

      const linkNumber = numberMatch[1]
      if (linkNumber !== baseNumber) continue

      // Check for version
      if (isAlt2) {
        if (urlPath.includes('manga') || (urlPath.includes('version-2') && urlPath.includes('sec'))) {
          return link
        }
      } else if (isAlt) {
        if (urlPath.includes('version-2') && !urlPath.includes('manga')) {
          return link
        }
      } else {
        // Regular version - should not have version-2 or manga
        if (!urlPath.includes('version-2') && !urlPath.includes('manga')) {
          return link
        }
      }
    }

    // If not found in first page, try other pages
    for (let pageNum = 2; pageNum <= 6; pageNum++) {
      await page.goto(`${searchUrl}&page=${pageNum}`, { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise(r => setTimeout(r, 1500))

      const moreLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        return Array.from(links).map(link => (link as HTMLAnchorElement).href)
      })

      for (const link of moreLinks) {
        const urlPath = new URL(link).pathname
        const numberMatch = urlPath.match(/op11-(\d{3})/i)
        if (!numberMatch) continue

        const linkNumber = numberMatch[1]
        if (linkNumber !== baseNumber) continue

        if (isAlt2) {
          if (urlPath.includes('manga') || (urlPath.includes('version-2') && urlPath.includes('sec'))) {
            return link
          }
        } else if (isAlt) {
          if (urlPath.includes('version-2') && !urlPath.includes('manga')) {
            return link
          }
        } else {
          if (!urlPath.includes('version-2') && !urlPath.includes('manga')) {
            return link
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error(`  ⚠️  Erreur recherche ${card.number}:`, error)
    return null
  }
}

async function getImageFromCardPage(page: puppeteer.Page, cardUrl: string): Promise<string | null> {
  try {
    await page.goto(cardUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    // Extract image URL from JSON-LD
    const imageUrl = await page.evaluate(() => {
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image && Array.isArray(jsonLd.image)) {
            return jsonLd.image[0]
          } else if (typeof jsonLd.image === 'string') {
            return jsonLd.image
          }
        } catch (e) {}
      }

      // Fallback to og:image
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) {
        return ogImage.getAttribute('content')
      }

      // Fallback to first card image
      const cardImg = document.querySelector('img[src*="static.opecards.fr"]')
      if (cardImg) {
        return (cardImg as HTMLImageElement).src
      }

      return null
    })

    return imageUrl
  } catch (error) {
    console.error(`  ⚠️  Erreur page carte:`, error)
    return null
  }
}

async function downloadAndUploadImage(
  page: puppeteer.Page,
  imageUrl: string,
  card: CardToFix
): Promise<string | null> {
  try {
    // Download image
    const response = await page.goto(imageUrl, { timeout: 30000 })
    if (!response) return null

    const buffer = await response.buffer()

    // Optimize with Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    // Upload to Supabase
    const storagePath = `OP11/${card.language}/${card.number}.webp`

    const { error: uploadError } = await supabase.storage
      .from('onepiece-cards')
      .upload(storagePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      console.error(`  ⚠️  Erreur upload:`, uploadError)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('onepiece-cards')
      .getPublicUrl(storagePath)

    return urlData.publicUrl
  } catch (error) {
    console.error(`  ⚠️  Erreur download/upload:`, error)
    return null
  }
}

async function updateCardImageUrl(cardId: string, imageUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId)

  if (error) {
    console.error(`  ⚠️  Erreur update DB:`, error)
    return false
  }
  return true
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  console.log('================================================================================')
  console.log('Correction des images manquantes OP11')
  console.log('================================================================================')
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'PRODUCTION'}`)
  console.log('')

  // Get cards without images
  console.log('1. Récupération des cartes sans images...')
  const cards = await getCardsWithoutImages()

  if (cards.length === 0) {
    console.log('✅ Toutes les cartes ont déjà une image!')
    return
  }

  console.log(`   ${cards.length} cartes sans image trouvées`)

  // Group by language
  const enCards = cards.filter(c => c.language === 'en')
  const frCards = cards.filter(c => c.language === 'fr')

  console.log(`   - EN: ${enCards.length}`)
  console.log(`   - FR: ${frCards.length}`)
  console.log('')

  if (isDryRun) {
    console.log('Liste des cartes à corriger:')
    cards.forEach(c => {
      console.log(`  ${c.language.toUpperCase()} - ${c.number} - ${c.name}`)
    })
    return
  }

  // Launch browser
  console.log('2. Lancement du navigateur...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  let success = 0
  let errors = 0

  // Process each card
  console.log('')
  console.log('3. Traitement des cartes...')

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    console.log(`\n📊 [${i + 1}/${cards.length}] ${card.language.toUpperCase()} - ${card.number} - ${card.name}`)

    // Find card page URL
    const cardPageUrl = await findCardPageUrl(page, card)
    if (!cardPageUrl) {
      console.log(`   ⚠️  URL non trouvée`)
      errors++
      continue
    }
    console.log(`   📄 ${cardPageUrl}`)

    // Get image URL from page
    const imageUrl = await getImageFromCardPage(page, cardPageUrl)
    if (!imageUrl) {
      console.log(`   ⚠️  Image non trouvée`)
      errors++
      continue
    }
    console.log(`   🖼️  ${imageUrl.substring(0, 60)}...`)

    // Download, optimize and upload
    const publicUrl = await downloadAndUploadImage(page, imageUrl, card)
    if (!publicUrl) {
      console.log(`   ⚠️  Upload échoué`)
      errors++
      continue
    }

    // Update database
    const updated = await updateCardImageUrl(card.id, publicUrl)
    if (!updated) {
      console.log(`   ⚠️  Update DB échoué`)
      errors++
      continue
    }

    console.log(`   ✅ Image corrigée`)
    success++

    // Small delay between cards
    await new Promise(r => setTimeout(r, 1000))
  }

  await browser.close()

  console.log('')
  console.log('================================================================================')
  console.log('Résumé')
  console.log('================================================================================')
  console.log(`✅ Succès: ${success}`)
  console.log(`⚠️  Erreurs: ${errors}`)
  console.log('')
  console.log('Vérifiez: https://www.collectorverse.io/series/onepiece/OP11')
}

main().catch(console.error)
