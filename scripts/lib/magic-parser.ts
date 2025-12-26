/**
 * Magic: The Gathering card parser
 * Converts Scryfall API data to database format
 */

import type {
  ScryfallCard,
  ScryfallCardFace,
  ParsedMagicCard,
  MagicAttributes,
  CardsBySet,
  SetInfo,
} from '../../lib/types/magic'
import {
  RARITY_MAP,
  EXCLUDED_LAYOUTS,
  MULTI_FACE_LAYOUTS,
  EXCLUDED_SET_TYPES,
  type SupportedLanguage,
} from '../config/magic-config'

/**
 * Parse a Scryfall card into our database format
 */
export function parseScryfallCard(
  card: ScryfallCard,
  faceIndex: number = 0
): ParsedMagicCard | null {
  // Skip excluded layouts
  if (EXCLUDED_LAYOUTS.includes(card.layout)) {
    return null
  }

  // Get image URL
  const imageUrl = getCardImageUrl(card, faceIndex)

  // Get card name (use printed_name for translated cards)
  const name = getCardName(card, faceIndex)

  // Build attributes
  const attributes = buildCardAttributes(card, faceIndex)

  return {
    name,
    number: normalizeCardNumber(card.collector_number, faceIndex, card.layout),
    language: card.lang,
    rarity: normalizeRarity(card.rarity),
    imageUrl,
    attributes,
    setCode: card.set.toLowerCase(),
    setName: card.set_name,
  }
}

/**
 * Get the card name, preferring printed_name for non-English cards
 */
export function getCardName(card: ScryfallCard, faceIndex: number = 0): string {
  // For multi-face cards, get face-specific name
  if (card.card_faces && card.card_faces.length > faceIndex) {
    const face = card.card_faces[faceIndex]
    return face.printed_name || face.name
  }

  // For single-face cards
  return card.printed_name || card.name
}

/**
 * Get the image URL for a card
 */
export function getCardImageUrl(card: ScryfallCard, faceIndex: number = 0): string | null {
  // For multi-face cards with separate face images
  if (card.card_faces && card.card_faces.length > faceIndex) {
    const face = card.card_faces[faceIndex]
    if (face.image_uris) {
      return face.image_uris.large || face.image_uris.normal || null
    }
  }

  // For single-face cards or cards with combined images
  if (card.image_uris) {
    return card.image_uris.large || card.image_uris.normal || null
  }

  return null
}

/**
 * Normalize card number for database storage
 * Handles special characters like ★, letters (a, b), etc.
 */
export function normalizeCardNumber(
  collectorNumber: string,
  faceIndex: number = 0,
  layout: string = 'normal'
): string {
  let number = collectorNumber

  // For multi-face cards that we store separately, append face suffix
  if (MULTI_FACE_LAYOUTS.includes(layout) && faceIndex > 0) {
    number = `${collectorNumber}-back`
  }

  return number
}

/**
 * Normalize rarity to our standard format
 */
export function normalizeRarity(rarity: string): string {
  return RARITY_MAP[rarity.toLowerCase()] || rarity.toLowerCase()
}

/**
 * Build the attributes JSONB object
 */
export function buildCardAttributes(
  card: ScryfallCard,
  faceIndex: number = 0
): MagicAttributes {
  const isMultiFace = card.card_faces && card.card_faces.length > 1
  const face = isMultiFace ? card.card_faces![faceIndex] : null

  const attributes: MagicAttributes = {
    scryfall_id: card.id,
    layout: card.layout,
    set_type: card.set_type,
    foil: card.foil ?? card.finishes?.includes('foil'),
    nonfoil: card.nonfoil ?? card.finishes?.includes('nonfoil'),
    promo: card.promo,
    reprint: card.reprint,
    digital: card.digital,
  }

  // Add face-specific data
  if (face) {
    attributes.mana_cost = face.mana_cost
    attributes.type_line = face.printed_type_line || face.type_line
    attributes.oracle_text = face.printed_text || face.oracle_text
    attributes.power = face.power
    attributes.toughness = face.toughness
    attributes.loyalty = face.loyalty
    attributes.colors = face.colors
    attributes.artist = face.artist
    attributes.face_index = faceIndex
    attributes.total_faces = card.card_faces!.length
  } else {
    attributes.mana_cost = card.mana_cost
    attributes.cmc = card.cmc
    attributes.type_line = card.printed_type_line || card.type_line
    attributes.oracle_text = card.printed_text || card.oracle_text
    attributes.power = card.power
    attributes.toughness = card.toughness
    attributes.loyalty = card.loyalty
    attributes.colors = card.colors
    attributes.color_identity = card.color_identity
    attributes.keywords = card.keywords
    attributes.artist = card.artist
  }

  // Add legalities if present
  if (card.legalities) {
    attributes.legalities = card.legalities
  }

  // Clean undefined values
  return Object.fromEntries(
    Object.entries(attributes).filter(([_, v]) => v !== undefined && v !== null)
  ) as MagicAttributes
}

/**
 * Group cards by set code
 */
export function groupCardsBySet(cards: ScryfallCard[]): CardsBySet {
  const grouped: CardsBySet = {}

  for (const card of cards) {
    const setCode = card.set.toLowerCase()

    if (!grouped[setCode]) {
      grouped[setCode] = []
    }

    grouped[setCode].push(card)
  }

  return grouped
}

/**
 * Filter cards to only include specified languages
 */
export function filterCardsByLanguages(
  cards: ScryfallCard[],
  languages: SupportedLanguage[]
): ScryfallCard[] {
  return cards.filter(card => languages.includes(card.lang as SupportedLanguage))
}

/**
 * Filter out excluded set types
 */
export function filterExcludedSets(cards: ScryfallCard[]): ScryfallCard[] {
  return cards.filter(card => !EXCLUDED_SET_TYPES.includes(card.set_type))
}

/**
 * Get set information from grouped cards
 */
export function getSetInfo(setCode: string, cards: ScryfallCard[]): SetInfo {
  const firstCard = cards[0]

  // Count cards per language
  const cardsByLanguage: Record<string, number> = {}
  for (const card of cards) {
    if (!cardsByLanguage[card.lang]) {
      cardsByLanguage[card.lang] = 0
    }
    cardsByLanguage[card.lang]++
  }

  return {
    code: setCode,
    name: firstCard?.set_name || setCode.toUpperCase(),
    releaseDate: firstCard?.released_at || null,
    setType: firstCard?.set_type || 'unknown',
    cardCount: cards.length,
    cardsByLanguage,
  }
}

/**
 * Get unique English card count (base card count without language duplicates)
 */
export function getUniqueCardCount(cards: ScryfallCard[]): number {
  const englishCards = cards.filter(c => c.lang === 'en')
  return englishCards.length
}

/**
 * Check if a card should be stored as multiple entries (multi-face)
 */
export function shouldSplitCard(card: ScryfallCard): boolean {
  return (
    MULTI_FACE_LAYOUTS.includes(card.layout) &&
    card.card_faces !== undefined &&
    card.card_faces.length > 1 &&
    card.card_faces.every(face => face.image_uris !== undefined)
  )
}

/**
 * Get storage path for a card image
 */
export function getCardImagePath(
  setCode: string,
  language: string,
  cardNumber: string
): string {
  return `${setCode.toLowerCase()}/${language}/${cardNumber}.webp`
}

/**
 * Get storage path for a series image
 */
export function getSeriesImagePath(setCode: string): string {
  return `series/${setCode.toLowerCase()}.webp`
}

/**
 * Validate a Scryfall card has required fields
 */
export function isValidCard(card: ScryfallCard): boolean {
  return (
    typeof card.id === 'string' &&
    typeof card.name === 'string' &&
    typeof card.collector_number === 'string' &&
    typeof card.set === 'string' &&
    typeof card.lang === 'string' &&
    typeof card.rarity === 'string'
  )
}

/**
 * Sort cards by collector number
 */
export function sortCardsByNumber(cards: ScryfallCard[]): ScryfallCard[] {
  return [...cards].sort((a, b) => {
    // Try numeric comparison first
    const numA = parseInt(a.collector_number, 10)
    const numB = parseInt(b.collector_number, 10)

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }

    // Fall back to string comparison
    return a.collector_number.localeCompare(b.collector_number, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

/**
 * Deduplicate cards by (set, number, language) key
 */
export function deduplicateCards(cards: ScryfallCard[]): ScryfallCard[] {
  const seen = new Map<string, ScryfallCard>()

  for (const card of cards) {
    const key = `${card.set}-${card.collector_number}-${card.lang}`
    if (!seen.has(key)) {
      seen.set(key, card)
    }
  }

  return Array.from(seen.values())
}
