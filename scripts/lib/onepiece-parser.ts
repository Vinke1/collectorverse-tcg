/**
 * One Piece card URL parsing logic for opecards.fr
 *
 * URL Patterns:
 * - Card detail: /cards/{seriesCode}-{number}-{rarity}-{cardName}
 *   Example: /cards/op13-001-l-monkey-d-luffy
 *   Example: /cards/st20-001-sr-charlotte-katakuri
 *
 * - Card search: /cards/search?page=1&sortBy=releaseR&serie={serieId}
 *
 * Image URL pattern:
 * https://static.opecards.fr/cards/{lang}/{seriesCode}/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-{slug}.webp
 */

import { slugToTitle } from './utils'

// ============================================
// TYPES
// ============================================

export interface ParsedOnePieceCard {
  slug: string                // Full URL slug
  publicCode: string          // Full card code (e.g., "OP13-001-L")
  seriesCode: string          // Series code (e.g., "OP13")
  number: string              // Card number (e.g., "001")
  rarity: string              // Rarity code (e.g., "l", "sr", "c")
  name: string                // Card name
  imageUrl: string            // Full image URL
  finish: OnePieceFinish      // Card finish type
  isAlternateArt: boolean     // Whether this is an alternate art version
}

export type OnePieceFinish =
  | 'standard'
  | 'parallel'
  | 'manga'
  | 'sp'
  | 'alt'
  | 'alternate'
  | 'special'
  | 'box_topper'
  | 'treasure'

export interface OnePieceParseOptions {
  language?: 'fr' | 'en' | 'jp'
}

// ============================================
// RARITY MAPPINGS
// ============================================

export const ONEPIECE_RARITIES: Record<string, string> = {
  'l': 'Leader',
  'c': 'Common',
  'uc': 'Uncommon',
  'r': 'Rare',
  'sr': 'Super Rare',
  'sec': 'Secret Rare',
  'p': 'Promo',
  'tr': 'Treasury Rare',
  'don': 'DON!!',
  'sp': 'SP Card'
}

// ============================================
// FINISH DETECTION
// ============================================

/**
 * Detect the card finish type from URL or name
 */
export function detectFinish(slug: string, name?: string): { finish: OnePieceFinish; isAlternateArt: boolean } {
  const lowerSlug = slug.toLowerCase()
  const lowerName = (name || '').toLowerCase()

  // Check for parallel rare (foil)
  if (lowerSlug.includes('-parallel') || lowerName.includes('parallel rare') || lowerSlug.includes('-pr-')) {
    return { finish: 'parallel', isAlternateArt: false }
  }

  // Check for manga version
  if (lowerSlug.includes('-manga') || lowerName.includes('manga')) {
    return { finish: 'manga', isAlternateArt: true }
  }

  // Check for SP card
  if (lowerSlug.includes('-sp-') || lowerName.includes('sp card') || lowerSlug.includes('-sp')) {
    return { finish: 'sp', isAlternateArt: true }
  }

  // Check for alternate art
  if (lowerSlug.includes('-alt') || lowerSlug.includes('-alternate') || lowerName.includes('alternate art')) {
    return { finish: 'alt', isAlternateArt: true }
  }

  // Check for box topper
  if (lowerSlug.includes('-box-topper') || lowerName.includes('box topper')) {
    return { finish: 'box_topper', isAlternateArt: true }
  }

  // Check for treasure rare
  if (lowerSlug.includes('-tr-') || lowerSlug.includes('-treasure')) {
    return { finish: 'treasure', isAlternateArt: false }
  }

  // Default: standard
  return { finish: 'standard', isAlternateArt: false }
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parses a One Piece card URL from opecards.fr and extracts card information
 *
 * @param url - The card URL to parse (e.g., /cards/op13-001-l-monkey-d-luffy)
 * @param options - Options including language
 * @returns Parsed card data or null if parsing fails
 */
export function parseOnePieceCardUrl(
  url: string,
  options: OnePieceParseOptions = {}
): ParsedOnePieceCard | null {
  const { language = 'fr' } = options

  // Extract slug from URL
  const match = url.match(/\/cards\/(.+)$/)
  if (!match) return null

  const slug = match[1]

  // Pattern: {seriesCode}-{number}-{rarity}-{cardName}
  // Examples:
  //   op13-001-l-monkey-d-luffy
  //   st20-001-sr-charlotte-katakuri
  //   op01-121-sec-portgas-d-ace
  const cardMatch = slug.match(/^([a-z]+\d+)-(\d{3})-([a-z]+)-(.+)/i)

  if (!cardMatch) {
    // Try alternative pattern with variant suffix
    // Example: op13-001-l-monkey-d-luffy-parallel
    const variantMatch = slug.match(/^([a-z]+\d+)-(\d{3})-([a-z]+)-(.+?)(?:-(parallel|manga|sp|alt|box-topper))?$/i)
    if (!variantMatch) return null

    const [, seriesCode, number, rarity, namePart] = variantMatch
    const name = slugToTitle(namePart.replace(/-(parallel|manga|sp|alt|box-topper)$/, ''))
    const publicCode = `${seriesCode.toUpperCase()}-${number}-${rarity.toUpperCase()}`
    const { finish, isAlternateArt } = detectFinish(slug, name)

    const imageUrl = buildImageUrl(slug, seriesCode.toLowerCase(), language)

    return {
      slug,
      publicCode,
      seriesCode: seriesCode.toUpperCase(),
      number,
      rarity: rarity.toLowerCase(),
      name,
      imageUrl,
      finish,
      isAlternateArt
    }
  }

  const [, seriesCode, number, rarity, namePart] = cardMatch
  const name = slugToTitle(namePart)
  const publicCode = `${seriesCode.toUpperCase()}-${number}-${rarity.toUpperCase()}`
  const { finish, isAlternateArt } = detectFinish(slug, name)

  const imageUrl = buildImageUrl(slug, seriesCode.toLowerCase(), language)

  return {
    slug,
    publicCode,
    seriesCode: seriesCode.toUpperCase(),
    number,
    rarity: rarity.toLowerCase(),
    name,
    imageUrl,
    finish,
    isAlternateArt
  }
}

/**
 * Build the image URL for a One Piece card
 */
function buildImageUrl(slug: string, seriesCode: string, language: string): string {
  return `https://static.opecards.fr/cards/${language}/${seriesCode}/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-${slug}.webp`
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract series code from card public code
 * @param publicCode - Full card code (e.g., "OP13-001-L")
 * @returns Series code (e.g., "OP13")
 */
export function extractSeriesCode(publicCode: string): string {
  const match = publicCode.match(/^([A-Z]+\d+)/i)
  return match ? match[1].toUpperCase() : ''
}

/**
 * Normalize card number to 3 digits
 * @param number - Card number (e.g., "1", "01", "001")
 * @returns Normalized number (e.g., "001")
 */
export function normalizeCardNumber(number: string | number): string {
  return String(number).padStart(3, '0')
}

/**
 * Build the card number for storage
 * For variants (parallel, manga, etc.), append suffix
 */
export function buildStorageNumber(
  number: string,
  finish: OnePieceFinish,
  isAlternateArt: boolean
): string {
  const normalized = normalizeCardNumber(number)

  if (finish === 'standard' && !isAlternateArt) {
    return normalized
  }

  // Add suffix for variants
  const suffixes: Record<OnePieceFinish, string> = {
    standard: '',
    parallel: '-PR',
    manga: '-MG',
    sp: '-SP',
    alt: '-ALT',
    alternate: '-ALT',
    special: '-SP',
    box_topper: '-BT',
    treasure: '-TR'
  }

  const suffix = suffixes[finish] ?? ''
  return `${normalized}${suffix}`
}

/**
 * Parse color codes from card attributes
 * One Piece cards can be multi-color
 */
export function parseColors(colorString: string): string[] {
  const colorMap: Record<string, string> = {
    'rouge': 'red',
    'red': 'red',
    'vert': 'green',
    'green': 'green',
    'bleu': 'blue',
    'blue': 'blue',
    'violet': 'purple',
    'purple': 'purple',
    'noir': 'black',
    'black': 'black',
    'jaune': 'yellow',
    'yellow': 'yellow',
    'multicolore': 'multicolor',
    'multicolor': 'multicolor'
  }

  const colors: string[] = []
  const lowerStr = colorString.toLowerCase()

  for (const [key, value] of Object.entries(colorMap)) {
    if (lowerStr.includes(key) && !colors.includes(value)) {
      colors.push(value)
    }
  }

  return colors
}

/**
 * Parse card type from French or English
 */
export function parseCardType(typeString: string): string {
  const typeMap: Record<string, string> = {
    'leader': 'leader',
    'personnage': 'character',
    'character': 'character',
    'événement': 'event',
    'evenement': 'event',
    'event': 'event',
    'lieu': 'stage',
    'stage': 'stage',
    'don!!': 'don',
    'don': 'don'
  }

  const lowerType = typeString.toLowerCase().trim()
  return typeMap[lowerType] || 'character'
}

/**
 * Parse attribute from French or English
 */
export function parseAttribute(attrString: string): string | null {
  const attrMap: Record<string, string> = {
    'frappe': 'strike',
    'strike': 'strike',
    'tranche': 'slash',
    'slash': 'slash',
    'spécial': 'special',
    'special': 'special',
    'portée': 'ranged',
    'ranged': 'ranged',
    'sagesse': 'wisdom',
    'wisdom': 'wisdom'
  }

  const lowerAttr = attrString.toLowerCase().trim()
  return attrMap[lowerAttr] || null
}

/**
 * Normalize rarity code
 */
export function normalizeRarity(rarityString: string): string {
  const rarityMap: Record<string, string> = {
    'leader': 'l',
    'l': 'l',
    'common': 'c',
    'commune': 'c',
    'c': 'c',
    'uncommon': 'uc',
    'peu commune': 'uc',
    'uc': 'uc',
    'rare': 'r',
    'r': 'r',
    'super rare': 'sr',
    'super-rare': 'sr',
    'sr': 'sr',
    'secret rare': 'sec',
    'secret-rare': 'sec',
    'sec': 'sec',
    'promo': 'p',
    'p': 'p',
    'treasury rare': 'tr',
    'tr': 'tr',
    'don!!': 'don',
    'don': 'don',
    'sp card': 'sp',
    'sp': 'sp'
  }

  const lowerRarity = rarityString.toLowerCase().trim()
  return rarityMap[lowerRarity] || 'c'
}
