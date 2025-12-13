/**
 * Script de scraping des images One Piece manquantes
 * Visite les pages opecards.fr pour récupérer les vraies URLs d'images
 * puis télécharge et stocke sur Supabase
 *
 * Usage:
 *   npx tsx scripts/scrape-missing-onepiece-images.ts              # Scraper toutes les images
 *   npx tsx scripts/scrape-missing-onepiece-images.ts --dry-run    # Voir ce qui sera scrapé
 *   npx tsx scripts/scrape-missing-onepiece-images.ts --series OP03  # Une série spécifique
 *   npx tsx scripts/scrape-missing-onepiece-images.ts --limit 50   # Limiter le nombre
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import sharp from 'sharp'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

const supabase = createAdminClient()

const CONFIG = {
  BUCKET: 'onepiece-cards',
  IMAGE_WIDTH: 480,
  IMAGE_HEIGHT: 672,
  WEBP_QUALITY: 85,
  DELAY_BETWEEN_PAGES: 2000,
  DELAY_BETWEEN_UPLOADS: 300,
  PROGRESS_FILE: 'scripts/logs/onepiece-scrape-progress.json',
  MAX_RETRIES: 3,
  BASE_URL: 'https://www.opecards.fr'
}

interface Card {
  id: string
  name: string
  number: string
  language: string
  image_url: string
  series_code: string
}

interface Progress {
  scrapedIds: string[]
  failedIds: string[]
  lastUpdated: string
}

// Parse arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const continueOnError = args.includes('--continue-on-error') || true // Always continue
const seriesIndex = args.indexOf('--series')
const targetSeries = seriesIndex !== -1 ? args[seriesIndex + 1] : null
const limitIndex = args.indexOf('--limit')
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    // Ignore
  }
  return { scrapedIds: [], failedIds: [], lastUpdated: '' }
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString()
  const dir = path.dirname(CONFIG.PROGRESS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Vérifier que l'URL est valide
    if (!url || typeof url !== 'string') {
      reject(new Error(`URL invalide: ${typeof url}`))
      return
    }
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.opecards.fr/'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadImage(redirectUrl).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })

    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Timeout'))
    })
  })
}

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(CONFIG.IMAGE_WIDTH, CONFIG.IMAGE_HEIGHT, { fit: 'cover' })
    .webp({ quality: CONFIG.WEBP_QUALITY })
    .toBuffer()
}

function getStoragePath(seriesCode: string, language: string, cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\//g, '-')
  return `${seriesCode}/${language.toLowerCase()}/${cleanNumber}.webp`
}

// Construire l'URL de recherche pour trouver la carte
function buildSearchUrl(card: Card): string {
  // Essayer de construire l'URL à partir du numéro et de la série
  const langPrefix = card.language.toLowerCase() === 'fr' ? '' : `${card.language.toLowerCase()}-`
  const seriesLower = card.series_code.toLowerCase()

  // Format: opXX-NNN pour les boosters, stXX-NNN pour les starters
  const cardNum = card.number.replace(/-/g, '').padStart(3, '0')

  return `${CONFIG.BASE_URL}/series/${langPrefix}${seriesLower}`
}

async function findCardOnPage(page: Page, card: Card): Promise<string | null> {
  // Chercher l'image de la carte sur la page de la série
  try {
    // Attendre que les cartes soient chargées
    await page.waitForSelector('a[href*="/cards/"]', { timeout: 10000 })

    // Chercher le lien vers la carte spécifique
    const cardNumber = card.number.replace(/-/g, '').replace(/^0+/, '')
    const paddedNumber = card.number.padStart(3, '0')

    const cardUrl = await page.evaluate((num: string, padded: string, lang: string, seriesCode: string) => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href
        // Chercher le numéro dans l'URL
        if (href.includes(`-${padded}-`) || href.includes(`-${num}-`)) {
          return href
        }
      }
      return null
    }, cardNumber, paddedNumber, card.language.toLowerCase(), card.series_code.toLowerCase())

    return cardUrl
  } catch (e) {
    return null
  }
}

async function scrapeCardImage(page: Page, cardPageUrl: string): Promise<string | null> {
  try {
    await page.goto(cardPageUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Extraire l'URL de l'image depuis le JSON-LD
    const imageUrl = await page.evaluate(() => {
      // Méthode 1: JSON-LD
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
          if (jsonLd.image) {
            if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) {
              // Retourner la première image qui est une string
              for (const img of jsonLd.image) {
                if (typeof img === 'string') return img
              }
            }
            if (typeof jsonLd.image === 'string') {
              return jsonLd.image
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Méthode 2: og:image meta tag
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) {
        const content = ogImage.getAttribute('content')
        if (content && typeof content === 'string') return content
      }

      // Méthode 3: Image principale de la carte
      const mainImage = document.querySelector('.card-image img, .card-detail img, img[src*="cards"]')
      if (mainImage) {
        const src = (mainImage as HTMLImageElement).src
        if (src && typeof src === 'string') return src
      }

      return null
    })

    // Vérifier que c'est bien une string
    if (imageUrl && typeof imageUrl === 'string') {
      return imageUrl
    }

    return null
  } catch (e) {
    console.log(`    ⚠️ Erreur scraping ${cardPageUrl}: ${e}`)
    return null
  }
}

// Map des séries vers leurs URLs complètes sur opecards.fr
// URLs vérifiées depuis le site
const SERIES_URL_MAP: Record<string, Record<string, string>> = {
  // Premium Best
  'PRB01': {
    'EN': 'en-prb01-one-piece-card-the-best',
    'FR': 'prb01-one-piece-card-the-best-fr'
  },
  'PRB02': {
    'EN': 'en-prb02-one-piece-card-the-best-volume-2',
    'FR': 'prb02-fr-one-piece-card-the-best-volume-2'
  },
  // Promos
  'P': {
    'EN': 'en-promotional-cards',
    'FR': 'p-cartes-promotionnelles'
  },
  'STP': {
    'EN': 'en-stp-store-tournament-pack-promo',
    'FR': 'stp-tournoi-boutique-promo'
  },
  // Starters FR (URLs corrigées depuis le site)
  'ST15': {
    'FR': 'st15-deck-pour-debutant-edward-newgate'
  },
  'ST16': {
    'FR': 'st16-deck-pour-debutant-uta'
  },
  'ST17': {
    'FR': 'st17-deck-pour-debutant-donquixote-doflamingo'
  },
  'ST18': {
    'FR': 'st18-deck-pour-debutant-monkey-d-luffy'
  },
  'ST19': {
    'FR': 'st19-deck-pour-debutant-smoker'
  },
  'ST20': {
    'FR': 'st20-deck-pour-debutant-charlotte-katakuri'
  },
  // Boosters EN
  'OP03': {
    'EN': 'en-op03-pillars-of-strength'
  },
  'OP05': {
    'EN': 'en-op05-awakening-of-the-new-era'
  },
  'OP06': {
    'EN': 'en-op06-wings-of-the-captain'
  },
  'OP07': {
    'EN': 'en-op07-500-years-in-the-future'
  },
  'OP08': {
    'EN': 'en-op08-two-legends'
  },
  // Boosters FR/EN
  'OP09': {
    'EN': 'en-op09-the-four-emperors',
    'FR': 'op09-les-nouveaux-empereurs'
  },
  'OP10': {
    'EN': 'en-op10-royal-blood',
    'FR': 'op10-sang-royal'
  },
  'OP11': {
    'EN': 'en-op11-never-ending-dream',
    'FR': 'op11-des-poings-vifs-comme-l-eclair'
  },
  'OP13': {
    'EN': 'en-op13-successors',
    'FR': 'op13-successeurs'
  }
}

async function scrapeSeriesPage(page: Page, seriesUrl: string, targetCards: Card[]): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  try {
    console.log(`    Navigation vers: ${seriesUrl}`)
    await page.goto(seriesUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Gérer la pagination - collecter tous les liens de cartes
    let allCardLinks: { href: string; number: string; variant: string }[] = []
    let hasMorePages = true
    let currentPage = 1
    const maxPages = 20

    while (hasMorePages && currentPage <= maxPages) {
      // Attendre les cartes
      try {
        await page.waitForSelector('a[href*="/cards/"]', { timeout: 10000 })
      } catch {
        console.log(`    Pas de cartes trouvées sur la page ${currentPage}`)
        break
      }

      // Récupérer tous les liens de cartes de cette page
      const pageLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        return Array.from(links).map(link => {
          const href = (link as HTMLAnchorElement).href
          // Format URL: /cards/op13-001-l-monkey-d-luffy ou /cards/en-op13-001-l-monkey-d-luffy
          // Extraire le numéro (ex: 001, 023)
          const match = href.match(/\/cards\/(?:en-|jp-)?[a-z]+\d*-(\d{3})-([a-z]+)-/)
          const number = match ? match[1] : ''
          const rarity = match ? match[2] : ''

          // Détecter les variantes (ordre important!)
          let variant = ''
          if (href.includes('treasure-rare')) variant = 'TR'
          else if (href.includes('manga-rare') || href.includes('jolly-roger')) variant = 'MG'
          else if (href.includes('sp-parallele') || href.includes('full-art')) variant = 'SP'
          else if (href.includes('parallele')) variant = 'PR'
          else if (href.includes('version-2') || href.includes('-v2-')) variant = 'ALT'

          return { href, number, variant, rarity }
        })
      })

      allCardLinks = allCardLinks.concat(pageLinks)
      console.log(`    Page ${currentPage}: ${pageLinks.length} liens trouvés`)

      // Essayer de passer à la page suivante
      const nextClicked = await page.evaluate((targetPage) => {
        const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
        for (const link of pageLinks) {
          const text = link.textContent?.trim()
          const dataPage = link.getAttribute('data-page')
          if (text === targetPage.toString() || dataPage === targetPage.toString()) {
            (link as HTMLElement).click()
            return true
          }
        }
        return false
      }, currentPage + 1)

      if (nextClicked) {
        await delay(2000)
        currentPage++
      } else {
        hasMorePages = false
      }
    }

    console.log(`    Total: ${allCardLinks.length} liens collectés`)

    // Debug: Afficher quelques exemples de liens
    if (allCardLinks.length > 0) {
      console.log(`    Exemples de liens:`)
      for (const link of allCardLinks.slice(0, 3)) {
        console.log(`      - #${link.number} [${link.variant || 'base'}]: ${link.href.split('/').pop()}`)
      }
    }

    // Matcher les cartes recherchées
    for (const target of targetCards) {
      if (results.has(target.id)) continue

      // Extraire le numéro de base et la variante (format: "049" ou "049-TR")
      const numMatch = target.number.match(/^(\d+)(?:-(.+))?$/)
      if (!numMatch) {
        console.log(`    ⚠️ Format de numéro invalide: ${target.number}`)
        continue
      }

      const baseNum = numMatch[1].padStart(3, '0')
      const targetVariant = numMatch[2]?.toUpperCase() || ''

      // Debug pour les cartes avec variante
      if (targetVariant) {
        const matching = allCardLinks.filter(cl => cl.number === baseNum)
        if (matching.length > 0) {
          console.log(`    Recherche #${target.number}: trouvé ${matching.length} cartes #${baseNum}`)
          for (const m of matching) {
            console.log(`      - [${m.variant || 'base'}] ${m.href.split('/').pop()}`)
          }
        }
      }

      // Chercher le lien correspondant
      const cardLink = allCardLinks.find(cl => {
        if (cl.number !== baseNum) return false
        // Matcher la variante
        if (targetVariant && cl.variant) {
          return cl.variant === targetVariant
        }
        if (!targetVariant && !cl.variant) {
          return true
        }
        // Accepter le premier match si pas de variante spécifiée
        if (!targetVariant) return true
        return false
      })

      if (cardLink) {
        // Visiter la page de la carte
        const imageUrl = await scrapeCardImage(page, cardLink.href)
        if (imageUrl) {
          results.set(target.id, imageUrl)
          console.log(`    ✓ #${target.number} -> trouvé`)
        } else {
          console.log(`    ✗ #${target.number} -> pas d'image sur la page`)
        }
        await delay(500)

        // Retourner sur la page série
        await page.goto(seriesUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        await delay(1000)
      }
    }
  } catch (e) {
    console.log(`    ✗ Erreur sur la page série: ${e}`)
  }

  return results
}

async function processCard(
  browser: Browser,
  card: Card,
  imageUrl: string
): Promise<boolean> {
  const storagePath = getStoragePath(card.series_code, card.language, card.number)

  try {
    // 1. Télécharger l'image
    const imageBuffer = await downloadImage(imageUrl)

    // 2. Optimiser l'image
    const optimizedBuffer = await optimizeImage(imageBuffer)

    // 3. Upload sur Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(CONFIG.BUCKET)
      .upload(storagePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // 4. Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from(CONFIG.BUCKET)
      .getPublicUrl(storagePath)

    // 5. Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from('cards')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', card.id)

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`)
    }

    return true
  } catch (error) {
    throw error
  }
}

async function main() {
  logger.section('Scraping des images One Piece manquantes')

  if (isDryRun) {
    logger.info('Mode DRY RUN - aucune modification ne sera effectuée')
  }

  // Récupérer le TCG One Piece
  const { data: tcg } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'onepiece')
    .single()

  if (!tcg) {
    logger.error('TCG One Piece non trouvé')
    return
  }

  // Récupérer toutes les séries One Piece
  let seriesQuery = supabase
    .from('series')
    .select('id, code')
    .eq('tcg_game_id', tcg.id)

  if (targetSeries) {
    seriesQuery = seriesQuery.eq('code', targetSeries)
  }

  const { data: series } = await seriesQuery

  if (!series || series.length === 0) {
    logger.error('Aucune série trouvée')
    return
  }

  // Récupérer toutes les cartes avec URLs opecards.fr
  const cardsToScrape: Card[] = []

  for (const s of series) {
    const { data: cards } = await supabase
      .from('cards')
      .select('id, name, number, language, image_url')
      .eq('series_id', s.id)
      .or('image_url.ilike.%opecards.fr%,image_url.ilike.%static.opecards.fr%')

    if (cards) {
      for (const card of cards) {
        cardsToScrape.push({
          ...card,
          series_code: s.code
        })
      }
    }
  }

  if (cardsToScrape.length === 0) {
    logger.success('Aucune image à scraper !')
    return
  }

  logger.info(`${cardsToScrape.length} images à scraper`)

  // Charger la progression
  const progress = loadProgress()
  const alreadyScraped = new Set(progress.scrapedIds)

  // Filtrer les cartes déjà scrapées
  let pendingCards = cardsToScrape.filter(c => !alreadyScraped.has(c.id))

  if (pendingCards.length < cardsToScrape.length) {
    logger.info(`${cardsToScrape.length - pendingCards.length} images déjà scrapées (reprise)`)
  }

  // Appliquer la limite si spécifiée
  if (limit && limit < pendingCards.length) {
    pendingCards = pendingCards.slice(0, limit)
    logger.info(`Limité à ${limit} images`)
  }

  // Grouper par série et langue
  const cardsBySeriesLang = new Map<string, Card[]>()
  for (const card of pendingCards) {
    const key = `${card.series_code}-${card.language}`
    if (!cardsBySeriesLang.has(key)) {
      cardsBySeriesLang.set(key, [])
    }
    cardsBySeriesLang.get(key)!.push(card)
  }

  if (isDryRun) {
    logger.section('Séries à scraper')
    for (const [key, cards] of cardsBySeriesLang) {
      console.log(`\n${key} (${cards.length} cartes):`)
      for (const card of cards.slice(0, 3)) {
        console.log(`  - #${card.number} ${card.name}`)
      }
      if (cards.length > 3) {
        console.log(`  ... et ${cards.length - 3} autres`)
      }
    }
    logger.section('Fin du dry run')
    return
  }

  // Lancer le navigateur
  logger.info('Lancement du navigateur...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

  let successCount = 0
  let errorCount = 0
  const startTime = Date.now()

  try {
    // Traiter chaque série
    for (const [key, cards] of cardsBySeriesLang) {
      const [seriesCode, language] = key.split('-')

      // Utiliser le mapping pour trouver l'URL correcte
      const seriesMapping = SERIES_URL_MAP[seriesCode]
      let seriesUrl: string

      if (seriesMapping && seriesMapping[language]) {
        // Utiliser le mapping
        seriesUrl = `${CONFIG.BASE_URL}/series/${seriesMapping[language]}`
      } else {
        // Fallback: construire l'URL par défaut
        const langPrefix = language.toLowerCase() === 'fr' ? '' : `${language.toLowerCase()}-`
        seriesUrl = `${CONFIG.BASE_URL}/series/${langPrefix}${seriesCode.toLowerCase()}`
        console.log(`    ⚠️ Pas de mapping pour ${key}, utilisation URL par défaut`)
      }

      logger.section(`Scraping ${key} (${cards.length} cartes)`)
      console.log(`URL: ${seriesUrl}`)

      // Scraper la page de la série
      const imageUrls = await scrapeSeriesPage(page, seriesUrl, cards)

      // Traiter les images trouvées
      for (const card of cards) {
        const imageUrl = imageUrls.get(card.id)

        if (imageUrl) {
          process.stdout.write(`  [${successCount + errorCount + 1}/${pendingCards.length}] ${card.series_code} #${card.number}...`)

          try {
            await processCard(browser, card, imageUrl)
            successCount++
            progress.scrapedIds.push(card.id)

            const failedIndex = progress.failedIds.indexOf(card.id)
            if (failedIndex !== -1) {
              progress.failedIds.splice(failedIndex, 1)
            }

            process.stdout.write(` ✓\n`)
          } catch (error) {
            errorCount++
            progress.failedIds.push(card.id)
            const errorMessage = error instanceof Error ? error.message : 'Erreur'
            process.stdout.write(` ✗ ${errorMessage}\n`)
          }

          await delay(CONFIG.DELAY_BETWEEN_UPLOADS)
        } else {
          errorCount++
          progress.failedIds.push(card.id)
          console.log(`  ✗ #${card.number} - Image non trouvée sur la page`)
        }

        // Sauvegarder régulièrement
        if ((successCount + errorCount) % 10 === 0) {
          saveProgress(progress)
        }
      }

      await delay(CONFIG.DELAY_BETWEEN_PAGES)
    }
  } finally {
    await browser.close()
    saveProgress(progress)
  }

  const duration = Math.round((Date.now() - startTime) / 1000)

  logger.section('Résumé du scraping')
  console.log(`✅ Succès: ${successCount}`)
  console.log(`❌ Erreurs: ${errorCount}`)
  console.log(`⏱️  Durée: ${duration}s`)

  if (errorCount === 0 && successCount === pendingCards.length) {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      fs.unlinkSync(CONFIG.PROGRESS_FILE)
    }
    logger.success('Scraping terminé avec succès !')
  } else if (errorCount > 0) {
    logger.warn(`${errorCount} erreurs. Relancez le script pour réessayer.`)
  }
}

main().catch(console.error)
