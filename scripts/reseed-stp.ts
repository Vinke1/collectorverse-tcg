/**
 * Script pour reseed complet de la série STP (Store Tournament Promo)
 *
 * Usage:
 *   npx tsx scripts/reseed-stp.ts
 *   npx tsx scripts/reseed-stp.ts --dry-run
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import sharp from 'sharp'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = 'https://www.opecards.fr'
const SERIES_CODE = 'STP'
const STORAGE_BUCKET = 'onepiece-cards'

// URLs de recherche pour STP
const SEARCH_URLS = {
  FR: 'https://www.opecards.fr/cards/search?sortBy=releaseR&serie=721&language=FR',
  EN: 'https://www.opecards.fr/cards/search?sortBy=releaseR&serie=720&language=EN'
}

// Parse arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

// Initialize Supabase
const supabase = createAdminClient()

// ============================================
// TYPES
// ============================================

interface STPCard {
  originalCode: string       // Ex: ST19-002-C, EB02-019-R
  stpNumber: string          // Ex: 001, 002, 003
  name: string
  rarity: string
  variant: string            // Tournament Pack, Winner Pack
  language: 'FR' | 'EN'
  imageUrl: string
  cardPageUrl: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getSeriesId(): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', SERIES_CODE)
    .single()

  if (error || !data) {
    throw new Error(`Série ${SERIES_CODE} non trouvée: ${error?.message}`)
  }

  return data.id
}

async function deleteExistingCards(seriesId: string): Promise<number> {
  const { data, error } = await supabase
    .from('cards')
    .delete()
    .eq('series_id', seriesId)
    .select('id')

  if (error) {
    throw new Error(`Erreur suppression cartes: ${error.message}`)
  }

  return data?.length || 0
}

async function scrapeCardsFromPage(page: Page, language: 'FR' | 'EN'): Promise<STPCard[]> {
  const allCards: STPCard[] = []
  let currentPage = 1
  let hasMore = true

  while (hasMore && currentPage <= 20) {
    const url = `${SEARCH_URLS[language]}&page=${currentPage}`
    logger.info(`  Page ${currentPage}: ${url}`)

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(2000)

    // Scroll pour charger tout
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await delay(1000)

    // Extraire les cartes de cette page
    const pageCards = await page.evaluate((lang: string) => {
      const cards: any[] = []

      // Chercher tous les liens de cartes
      const cardLinks = document.querySelectorAll('a[href*="/cards/"]')

      cardLinks.forEach((link) => {
        const href = (link as HTMLAnchorElement).href
        if (!href.includes('/cards/') || href.includes('/search')) return

        // Extraire le nom depuis la carte (chercher dans les éléments enfants)
        const cardContainer = link.closest('.card-item, [class*="card"], article')
        let cardName = ''

        // Essayer d'extraire le nom depuis l'image alt ou le texte
        const imgEl = link.querySelector('img')
        if (imgEl?.alt) {
          cardName = imgEl.alt
        }

        // L'URL contient des infos sur la carte
        // Ex FR: /cards/st19-002-c-pack-de-tournoi-2025-vol3-sengoku
        // Ex EN: /cards/en-st19-002-c-tournament-pack-2025-vol3-sengoku
        const pathMatch = href.match(/\/cards\/([^/]+)$/)
        if (!pathMatch) return

        let slug = pathMatch[1]

        // Enlever le préfixe de langue si présent (en-, jp-)
        const langPrefix = slug.match(/^(en|jp)-/)
        if (langPrefix) {
          slug = slug.substring(langPrefix[0].length)
        }

        // Extraire le code original et la rareté du slug
        // Patterns possibles:
        // - st19-002-c-pack-de-tournoi-2025-vol3-sengoku
        // - eb02-019-r-tournament-pack-2025-vol3-roronoa-zoro
        // - op08-062-uc-winner-pack-2025-vol3-charlotte-katakuri
        const codeMatch = slug.match(/^([a-z]+\d+-\d{3})-([a-z]+)-(.+)$/i)
        if (!codeMatch) return

        const [, codeWithNumber, rarity, namePart] = codeMatch
        const originalCode = `${codeWithNumber.toUpperCase()}-${rarity.toUpperCase()}`

        // Déterminer le variant (Tournament ou Winner)
        // IMPORTANT: Vérifier Winner AVANT Tournament car "tournament-pack-winner" contient les deux
        let variant = 'Tournament Pack'  // Default
        if (namePart.includes('winner')) {
          variant = 'Winner Pack'
        } else if (namePart.includes('pack-de-tournoi') || namePart.includes('tournament-pack') || namePart.includes('pack-tournoi') || namePart.includes('tournament')) {
          variant = 'Tournament Pack'
        }

        // Extraire le nom du personnage (après le variant)
        let cleanName = namePart
          // Retirer les préfixes de pack
          .replace(/pack-de-tournoi-\d+-vol\.?\d*-?/gi, '')
          .replace(/tournament-pack-\d*-?vol\.?\d*-?/gi, '')
          .replace(/tournament-pack-winner-?/gi, '')
          .replace(/pack-winner-\d+-vol\.?\d*-?/gi, '')
          .replace(/winner-pack-\d*-?vol\.?\d*-?/gi, '')
          .replace(/pack-tournoi-\d+-volume-\d+-?/gi, '')
          .replace(/pack-\d+-/gi, '')
          .replace(/tournament-oct-dec-?/gi, '')
          .replace(/winner-oct-dec-?/gi, '')
          .replace(/tournament-?/gi, '')
          .replace(/winner-?/gi, '')
          .replace(/volume-\d+-?/gi, '')
          .replace(/vol-?\d+-?/gi, '')
          .replace(/ume-?\d+-?/gi, '')
          .replace(/version-?\d+-?/gi, '')
          .replace(/oct-dec-?/gi, '')
          .split('-')
          .filter(w => w.length > 0)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
          .trim()
          // Corrections de noms spécifiques
          .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
          .replace(/Portgasdace/gi, 'Portgas D. Ace')
          .replace(/Tonychopper/gi, 'Tony Tony Chopper')
          .replace(/Tony Tonychopper/gi, 'Tony Tony Chopper')
          .replace(/Whoswho/gi, "Who's.Who")
          .replace(/Eustass Captain Kid/gi, 'Eustass "Captain" Kid')
          .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
          .replace(/Kouzuki/gi, 'Kozuki')

        if (!cleanName && cardName) {
          cleanName = cardName
        }

        cards.push({
          originalCode,
          rarity: rarity.toUpperCase(),
          name: cleanName,
          variant,
          language: lang,
          slug: pathMatch[1], // Garder le slug original avec préfixe
          cardPageUrl: href
        })
      })

      // Vérifier s'il y a une page suivante
      const noResults = document.body.textContent?.includes('0 résultat') ||
                        document.body.textContent?.includes('Aucun résultat')

      return { cards, noResults }
    }, language)

    if (pageCards.noResults || pageCards.cards.length === 0) {
      hasMore = false
      break
    }

    // Ajouter les cartes uniques
    pageCards.cards.forEach(card => {
      // Vérifier si la carte existe déjà (par slug)
      const exists = allCards.some(c => c.cardPageUrl === card.cardPageUrl)
      if (!exists) {
        allCards.push(card as STPCard)
      }
    })

    logger.info(`    ${pageCards.cards.length} cartes trouvées sur cette page (${allCards.length} total)`)

    currentPage++
    await delay(1500)
  }

  return allCards
}

async function getImageUrlFromCardPage(page: Page, cardPageUrl: string): Promise<string | null> {
  try {
    await page.goto(cardPageUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    await delay(1500)

    const imageUrl = await page.evaluate(() => {
      // Chercher l'image dans le JSON-LD
      const jsonLd = document.querySelector('script[type="application/ld+json"]')
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd.textContent || '{}')
          if (data.image) {
            // data.image peut être un tableau ou une string
            const images = Array.isArray(data.image) ? data.image : [data.image]
            // Préférer l'image qui n'est pas "back"
            const frontImage = images.find((img: string) => !img.includes('back-'))
            if (frontImage) return frontImage
          }
        } catch (e) {}
      }

      // Fallback: chercher og:image
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) {
        return ogImage.getAttribute('content')
      }

      // Fallback: chercher une grande image de carte
      const img = document.querySelector('img[src*="opecards"][src*="/cards/"]') as HTMLImageElement
      return img?.src || null
    })

    return imageUrl
  } catch (error) {
    logger.warn(`Erreur récupération image pour ${cardPageUrl}: ${error}`)
    return null
  }
}

async function downloadAndUploadImage(
  imageUrl: string,
  seriesCode: string,
  cardNumber: string,
  language: string
): Promise<string | null> {
  try {
    // Télécharger l'image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      logger.warn(`Image non trouvée: ${imageUrl}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Optimiser avec Sharp
    const optimized = await sharp(buffer)
      .resize(480, 672, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    // Upload vers Supabase
    const storagePath = `${seriesCode}/${language.toLowerCase()}/${cardNumber}.webp`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, optimized, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      logger.warn(`Erreur upload ${storagePath}: ${uploadError.message}`)
      return null
    }

    // Construire l'URL publique
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    return urlData.publicUrl
  } catch (error) {
    logger.error(`Erreur traitement image: ${error}`)
    return null
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  logger.section('Reseed série STP (Store Tournament Promo)')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'PRODUCTION'}`)

  try {
    // 1. Récupérer l'ID de la série
    const seriesId = await getSeriesId()
    logger.success(`Série STP trouvée: ${seriesId}`)

    // 2. Supprimer les cartes existantes (sauf dry-run)
    if (!isDryRun) {
      const deletedCount = await deleteExistingCards(seriesId)
      logger.info(`${deletedCount} cartes existantes supprimées`)
    }

    // 3. Lancer Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    await page.setViewport({ width: 1920, height: 1080 })

    try {
      // 4. Scraper les cartes FR et EN
      logger.section('Scraping cartes FR')
      const cardsFR = await scrapeCardsFromPage(page, 'FR')
      logger.success(`${cardsFR.length} cartes FR trouvées`)

      logger.section('Scraping cartes EN')
      const cardsEN = await scrapeCardsFromPage(page, 'EN')
      logger.success(`${cardsEN.length} cartes EN trouvées`)

      // Combiner et dédupliquer (par originalCode + language)
      const allCards = [...cardsFR, ...cardsEN]

      // Créer une numérotation unique basée sur originalCode
      // Grouper par originalCode pour assigner un numéro STP
      const uniqueCodes = [...new Set(allCards.map(c => c.originalCode))]
      const codeToNumber: Record<string, string> = {}

      uniqueCodes.sort().forEach((code, index) => {
        codeToNumber[code] = String(index + 1).padStart(3, '0')
      })

      // Assigner les numéros STP
      allCards.forEach(card => {
        card.stpNumber = codeToNumber[card.originalCode]
      })

      logger.info(`\n${uniqueCodes.length} cartes uniques identifiées`)

      // 5. Pour chaque carte, récupérer l'image et insérer en base
      logger.section('Traitement des cartes')

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < allCards.length; i++) {
        const card = allCards[i]
        logger.progress(`[${i + 1}/${allCards.length}] ${card.language} - ${card.originalCode} - ${card.name}`)

        if (isDryRun) {
          console.log(`  -> Numéro STP: ${card.stpNumber}`)
          console.log(`  -> Variant: ${card.variant}`)
          successCount++
          continue
        }

        // Récupérer l'URL de l'image
        const imageUrl = await getImageUrlFromCardPage(page, card.cardPageUrl)

        if (!imageUrl) {
          logger.warn(`  Pas d'image trouvée`)
          errorCount++
          continue
        }

        // Construire un numéro de stockage unique (incluant le variant)
        // Format: 001, 001_W (pour Winner), etc.
        let storageNumber = card.stpNumber
        if (card.variant.includes('Winner')) {
          storageNumber = `${card.stpNumber}_W`
        }

        // Télécharger et uploader l'image
        const finalImageUrl = await downloadAndUploadImage(
          imageUrl,
          SERIES_CODE,
          storageNumber,
          card.language
        )

        if (!finalImageUrl) {
          errorCount++
          continue
        }

        // Insérer en base
        const { error } = await supabase
          .from('cards')
          .insert({
            series_id: seriesId,
            name: card.name,
            number: storageNumber,
            language: card.language,
            rarity: card.rarity,
            image_url: finalImageUrl,
            attributes: {
              original_code: card.originalCode,
              variant: card.variant,
              stp_number: card.stpNumber
            }
          })

        if (error) {
          // Peut-être un doublon, essayer upsert
          const { error: upsertError } = await supabase
            .from('cards')
            .upsert({
              series_id: seriesId,
              name: card.name,
              number: storageNumber,
              language: card.language,
              rarity: card.rarity,
              image_url: finalImageUrl,
              attributes: {
                original_code: card.originalCode,
                variant: card.variant,
                stp_number: card.stpNumber
              }
            }, {
              onConflict: 'series_id,number,language'
            })

          if (upsertError) {
            logger.error(`  Erreur insertion: ${upsertError.message}`)
            errorCount++
            continue
          }
        }

        logger.success(`  ✓ Carte insérée: ${storageNumber}`)
        successCount++

        await delay(500)
      }

      logger.section('Résumé')
      logger.success(`Succès: ${successCount}`)
      if (errorCount > 0) logger.error(`Erreurs: ${errorCount}`)

    } finally {
      await browser.close()
    }

    logger.section('Terminé!')
    console.log(`\nVoir les résultats: http://localhost:3000/series/onepiece/STP`)

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

main()
