/**
 * Star Wars Unlimited Card Parser
 *
 * Utilities for parsing card data from swucards.fr
 */

import { Page } from 'puppeteer'
import { normalizeRarity, normalizeCardType, normalizeArena, normalizeAspect } from '../config/starwars-series'

/**
 * Parsed card data from swucards.fr
 */
export interface StarWarsCardData {
  name: string
  number: string              // "001"
  totalInSet: number          // 264
  rarity: string              // "c", "u", "r", "l", "s", "p"
  language: string            // "fr", "en"

  // Informations générales
  seriesCode: string          // "SEC"
  cardType: string            // "leader", "unit", "event", "upgrade", "base"
  arenas: string[]            // ["ground"], ["space"], ["ground", "space"]
  aspects: string[]           // ["villainy", "vigilance"]
  releaseDate?: string
  illustrator?: string

  // Face Avant
  characters: string[]        // ["Chancelier Palpatine"]
  traits: string[]            // ["Officiel", "République"]
  cost?: number
  power?: number
  hp?: number

  // URLs
  imageUrl: string
  slug: string
}

/**
 * Parse card URL to extract basic information
 * URL patterns:
 *   - New format: /cards/sorofr-001-252-c-directeur-krennic-aspire-au-pouvoir
 *   - Old format: /cards/sec-fr-001-264-s-chancelier-palpatine-cest-ainsi-que-seteint-la-liberte
 *
 * Pattern breakdown: {seriesCode}{lang}-{number}-{totalInSet}-{rarity}-{name-slug}
 * Example: sorofr-001-252-c-... → series=SOR, lang=fr, number=001, total=252, rarity=c
 */
export function parseCardUrl(url: string): Partial<StarWarsCardData> | null {
  try {
    // Extract the path part
    const path = url.includes('/cards/') ? url.split('/cards/')[1] : url

    // Pattern 1: {seriesCode}{lang}-{number}-{totalInSet}-{rarity}-{name-slug}
    // Examples: sorofr-001-252-c-..., twien-123-517-r-...
    const match1 = path.match(/^([a-z]+)(fr|en)-(\d+)-(\d+)-([a-z]+)-(.+)$/i)

    if (match1) {
      const [, seriesCode, language, number, totalInSet, rarity, nameSlug] = match1
      return {
        seriesCode: seriesCode.toUpperCase(),
        language: language.toLowerCase(),
        number: number.padStart(3, '0'),
        totalInSet: parseInt(totalInSet, 10),
        rarity: normalizeRarity(rarity),
        slug: nameSlug,
        name: slugToName(nameSlug)
      }
    }

    // Pattern 2 (fallback): {seriesCode}-{lang}-{number}-{totalInSet}-{rarity}-{name-slug}
    const match2 = path.match(/^([a-z]+)-([a-z]{2})-(\d+)-(\d+)-([a-z]+)-(.+)$/i)

    if (match2) {
      const [, seriesCode, language, number, totalInSet, rarity, nameSlug] = match2
      return {
        seriesCode: seriesCode.toUpperCase(),
        language: language.toLowerCase(),
        number: number.padStart(3, '0'),
        totalInSet: parseInt(totalInSet, 10),
        rarity: normalizeRarity(rarity),
        slug: nameSlug,
        name: slugToName(nameSlug)
      }
    }

    return null
  } catch (e) {
    console.error('Error parsing card URL:', url, e)
    return null
  }
}

/**
 * Convert URL slug to card name
 * Example: "chancelier-palpatine-cest-ainsi-que-seteint-la-liberte" -> "Chancelier Palpatine, C'Est Ainsi Que S'Éteint La Liberté"
 */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/ Cest /g, ', C\'Est ')
    .replace(/ Seteint /g, ' S\'Éteint ')
    .replace(/ Dun /g, ' D\'Un ')
    .replace(/ Lempire /g, ' L\'Empire ')
    .replace(/ Lombre /g, ' L\'Ombre ')
}

/**
 * Extract full card data by visiting the card detail page
 */
export async function extractCardData(
  page: Page,
  cardUrl: string
): Promise<StarWarsCardData | null> {
  try {
    await page.goto(cardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for dynamic content

    const cardData = await page.evaluate(() => {
      const result: any = {
        name: '',
        imageUrl: '',
        seriesCode: '',
        language: '',
        number: '',
        totalInSet: 0,
        rarity: '',
        cardType: '',
        arenas: [],
        aspects: [],
        characters: [],
        traits: [],
        illustrator: '',
        cost: undefined,
        power: undefined,
        hp: undefined,
        slug: ''
      }

      // 1. Extract from JSON-LD
      const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
      if (jsonLdScript) {
        try {
          const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')

          if (jsonLd.name) {
            result.name = jsonLd.name
          }

          if (jsonLd.sku) {
            // Parse SKU: "SEC•FR - 001/264 - S"
            const skuMatch = jsonLd.sku.match(/([A-Z]+)•([A-Z]{2})\s*-\s*(\d+)\/(\d+)\s*-\s*([A-Z])/)
            if (skuMatch) {
              result.seriesCode = skuMatch[1]
              result.language = skuMatch[2].toLowerCase()
              result.number = skuMatch[3].padStart(3, '0')
              result.totalInSet = parseInt(skuMatch[4], 10)
              result.rarity = skuMatch[5].toLowerCase()
            }
          }

          if (jsonLd.image) {
            const imgData = jsonLd.image
            if (typeof imgData === 'string') {
              result.imageUrl = imgData
            } else if (imgData.contentUrl) {
              result.imageUrl = imgData.contentUrl
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e)
        }
      }

      // 2. Extract from HTML structure - Informations générales
      // Look for definition list or table structure
      const infoSections = document.querySelectorAll('dl, .info-section, [class*="info"]')

      infoSections.forEach(section => {
        const text = section.textContent || ''

        // Type (LEADER, UNIT, etc.)
        const typeMatch = text.match(/Type\s*:?\s*(LEADER|UNIT|UNITÉ|EVENT|ÉVÉNEMENT|UPGRADE|AMÉLIORATION|BASE)/i)
        if (typeMatch && !result.cardType) {
          result.cardType = typeMatch[1].toLowerCase()
        }

        // Arènes
        if (text.includes('Arène') || text.includes('Arena')) {
          if (text.includes('TERRESTRE') || text.includes('GROUND')) {
            if (!result.arenas.includes('ground')) result.arenas.push('ground')
          }
          if (text.includes('SPATIALE') || text.includes('SPACE')) {
            if (!result.arenas.includes('space')) result.arenas.push('space')
          }
        }

        // Affinités / Aspects
        const aspectsMatch = text.match(/Affinités?\s*:?\s*([^]+?)(?=Rareté|Type|Langue|$)/i)
        if (aspectsMatch) {
          const aspectText = aspectsMatch[1]
          const knownAspects = ['Vigilance', 'Commandement', 'Command', 'Agression', 'Aggression', 'Ruse', 'Cunning', 'Infâmie', 'Villainy', 'Héroïsme', 'Heroism']
          knownAspects.forEach(aspect => {
            if (aspectText.includes(aspect) && !result.aspects.includes(aspect.toLowerCase())) {
              result.aspects.push(aspect.toLowerCase())
            }
          })
        }

        // Illustrateur
        const illustratorMatch = text.match(/Illustrateur\s*:?\s*([A-Za-z\s]+?)(?=\n|$)/i)
        if (illustratorMatch && !result.illustrator) {
          result.illustrator = illustratorMatch[1].trim()
        }
      })

      // 3. Extract from Face Avant section
      const faceSection = document.querySelector('[class*="face"], [class*="stats"]')
      if (faceSection) {
        const text = faceSection.textContent || ''

        // Personnages
        const charMatch = text.match(/Personnages?\s*:?\s*([^]+?)(?=Trait|Coût|$)/i)
        if (charMatch) {
          result.characters = charMatch[1].split(',').map((c: string) => c.trim()).filter(Boolean)
        }

        // Traits
        const traitMatch = text.match(/Traits?\s*:?\s*([^]+?)(?=Coût|Puissance|$)/i)
        if (traitMatch) {
          result.traits = traitMatch[1].split(',').map((t: string) => t.trim()).filter(Boolean)
        }

        // Stats
        const costMatch = text.match(/Coût\s*:?\s*(\d+)/i)
        if (costMatch) result.cost = parseInt(costMatch[1], 10)

        const powerMatch = text.match(/Puissance\s*:?\s*(\d+)/i)
        if (powerMatch) result.power = parseInt(powerMatch[1], 10)

        const hpMatch = text.match(/Points?\s*de\s*vie\s*:?\s*(\d+)/i)
        if (hpMatch) result.hp = parseInt(hpMatch[1], 10)
      }

      // 4. Fallback - scan entire page for stats
      const pageText = document.body.textContent || ''

      if (!result.cardType) {
        const typeMatch = pageText.match(/Type\s*:?\s*(LEADER|UNIT|UNITÉ|EVENT|ÉVÉNEMENT|UPGRADE|AMÉLIORATION|BASE)/i)
        if (typeMatch) result.cardType = typeMatch[1].toLowerCase()
      }

      if (result.arenas.length === 0) {
        if (pageText.includes('TERRESTRE')) result.arenas.push('ground')
        if (pageText.includes('SPATIALE')) result.arenas.push('space')
      }

      if (!result.cost) {
        const costMatch = pageText.match(/Coût\s*:?\s*(\d+)/i)
        if (costMatch) result.cost = parseInt(costMatch[1], 10)
      }

      if (!result.power) {
        const powerMatch = pageText.match(/Puissance\s*:?\s*(\d+)/i)
        if (powerMatch) result.power = parseInt(powerMatch[1], 10)
      }

      if (!result.hp) {
        const hpMatch = pageText.match(/Points?\s*de\s*vie\s*:?\s*(\d+)/i)
        if (hpMatch) result.hp = parseInt(hpMatch[1], 10)
      }

      // 5. Get image from og:image meta tag as fallback
      if (!result.imageUrl) {
        const ogImage = document.querySelector('meta[property="og:image"]')
        if (ogImage) {
          const content = ogImage.getAttribute('content')
          if (content && !content.includes('back') && !content.includes('loader')) {
            result.imageUrl = content
          }
        }
      }

      // 6. Get image from main image element
      if (!result.imageUrl) {
        const mainImage = document.querySelector('img[src*="static.swucards.fr/cards"]')
        if (mainImage) {
          const src = mainImage.getAttribute('src')
          if (src && !src.includes('back') && !src.includes('loader')) {
            result.imageUrl = src
          }
        }
      }

      return result
    })

    // Parse URL to fill in missing data
    const urlData = parseCardUrl(cardUrl)
    if (urlData) {
      cardData.seriesCode = cardData.seriesCode || urlData.seriesCode
      cardData.language = cardData.language || urlData.language
      cardData.number = cardData.number || urlData.number
      cardData.totalInSet = cardData.totalInSet || urlData.totalInSet
      cardData.rarity = cardData.rarity || urlData.rarity
      cardData.slug = urlData.slug || ''
      cardData.name = cardData.name || urlData.name
    }

    // Normalize values
    cardData.cardType = normalizeCardType(cardData.cardType || 'unit')
    cardData.arenas = cardData.arenas.map((a: string) => normalizeArena(a))
    cardData.aspects = cardData.aspects.map((a: string) => normalizeAspect(a))

    // Validate required fields
    if (!cardData.name || !cardData.imageUrl) {
      console.error('Missing required fields for card:', cardUrl)
      return null
    }

    return cardData as StarWarsCardData

  } catch (e) {
    console.error('Error extracting card data:', cardUrl, e)
    return null
  }
}

/**
 * Extract all card URLs from a series page with pagination support
 * Uses click-based pagination (like lorcana) instead of URL navigation
 */
export async function extractCardUrls(
  page: Page,
  seriesUrl: string
): Promise<string[]> {
  const allCardUrls: string[] = []

  try {
    await page.goto(seriesUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    // Wait for cards to load
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Get total number of pages from pagination
    const totalPages = await page.evaluate(() => {
      // Look for pagination items
      const pageLinks = document.querySelectorAll('.pagination .page-item .page-link[data-page]')
      let maxPage = 1

      pageLinks.forEach(link => {
        const pageNum = parseInt(link.getAttribute('data-page') || '0', 10)
        if (pageNum > maxPage) {
          maxPage = pageNum
        }
      })

      return maxPage
    })

    console.log(`  Found ${totalPages} pages to scrape`)

    let currentPage = 1
    let hasMorePages = true

    // Process each page by clicking pagination buttons
    while (hasMorePages && currentPage <= totalPages) {
      console.log(`  Processing page ${currentPage}/${totalPages}...`)

      // Extract card URLs from current page
      await autoScroll(page)

      const pageUrls = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/cards/"]')
        const urls: string[] = []

        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href
          if (href && href.includes('/cards/') && !href.includes('/search') && !href.includes('cartes-les-plus-cheres')) {
            if (!urls.includes(href)) {
              urls.push(href)
            }
          }
        })

        return urls
      })

      console.log(`    Found ${pageUrls.length} cards on page ${currentPage}`)

      // Add unique URLs to collection
      for (const url of pageUrls) {
        if (!allCardUrls.includes(url)) {
          allCardUrls.push(url)
        }
      }

      // Try to navigate to next page by clicking
      if (currentPage < totalPages) {
        const nextPage = currentPage + 1

        // Click on the next page button
        const clicked = await page.evaluate((targetPage) => {
          const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
          for (const link of pageLinks) {
            const pageNum = link.getAttribute('data-page')
            if (pageNum === targetPage.toString()) {
              (link as HTMLElement).click()
              return true
            }
            // Also check if the text content matches the page number
            const text = link.textContent?.trim()
            if (text === targetPage.toString()) {
              (link as HTMLElement).click()
              return true
            }
          }
          return false
        }, nextPage)

        if (clicked) {
          // Wait for page to update
          await new Promise(resolve => setTimeout(resolve, 2000))
          // Wait for cards to reload
          await page.waitForSelector('a[href*="/cards/"]', { timeout: 10000 })
          currentPage = nextPage
        } else {
          console.log(`    Warning: Could not click to page ${nextPage}`)
          hasMorePages = false
        }
      } else {
        hasMorePages = false
      }
    }

    console.log(`  Total unique URLs collected: ${allCardUrls.length}`)
    return allCardUrls

  } catch (e) {
    console.error('Error extracting card URLs:', seriesUrl, e)
    return allCardUrls // Return what we have so far
  }
}

/**
 * Auto scroll page to trigger lazy loading
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0
      const distance = 500
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0))
}

/**
 * Build storage path for card image
 */
export function buildStoragePath(
  seriesCode: string,
  cardNumber: string,
  language: string,
  variant?: string
): string {
  const safeNumber = cardNumber.replace('/', '-')
  const suffix = variant && variant !== 'standard' ? `-${variant}` : ''
  return `${seriesCode}/${language}/${safeNumber}${suffix}.webp`
}

/**
 * Determine if a card is foil-only based on rarity
 */
export function isFoilOnly(rarity: string): boolean {
  // Special and Legendary cards are typically available in foil
  // But standard versions also exist
  // For now, assume no cards are foil-only unless explicitly marked
  return false
}

/**
 * Parse the public code to extract card info
 * Format: "SEC•FR - 001/264 - S"
 */
export function parsePublicCode(publicCode: string): {
  seriesCode: string
  language: string
  number: string
  totalInSet: number
  rarity: string
} | null {
  const match = publicCode.match(/([A-Z]+)•([A-Z]{2})\s*-\s*(\d+)\/(\d+)\s*-\s*([A-Z])/)
  if (!match) return null

  return {
    seriesCode: match[1],
    language: match[2].toLowerCase(),
    number: match[3].padStart(3, '0'),
    totalInSet: parseInt(match[4], 10),
    rarity: normalizeRarity(match[5])
  }
}
