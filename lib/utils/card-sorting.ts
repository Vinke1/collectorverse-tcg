/**
 * Card sorting utilities
 */

export interface CardWithNumber {
  number: string
  name: string
  rarity: string | null
}

export type SortOption = 'number' | 'name' | 'rarity'

/**
 * Checks if a card is a promo card
 * @param card - The card to check
 * @returns True if the card is a promo
 */
export function isPromoCard(card: CardWithNumber): boolean {
  return card.number.includes('/') || card.rarity === 'promo'
}

/**
 * Extracts the numeric value from a card number
 * For promo cards with slash notation (e.g., "1/P3"), returns the first number
 * For prefixed cards (e.g., "R-005", "SSR-084"), extracts the number after the prefix
 * For multi-prefix cards (e.g., "NRSS-AR-001", "SS-HR-001", "AR-SILVER-001"), extracts the last number
 * For regular cards, returns the parsed number
 * @param number - The card number string
 * @returns The numeric value
 */
function extractNumericValue(number: string): number {
  if (number.includes('/')) {
    return parseInt(number.split('/')[0], 10)
  }

  // Handle multi-prefixed card numbers like "NRSS-AR-001", "SS-HR-001", "AR-SILVER-001", "SV-SILVER-001"
  // Extract the last numeric segment
  const multiPrefixMatch = number.match(/-(\d+)$/)
  if (multiPrefixMatch) {
    return parseInt(multiPrefixMatch[1], 10)
  }

  // Handle simple prefixed card numbers like "R-005", "SSR-084", "HR-135"
  const prefixMatch = number.match(/^[A-Z]+-(\d+)$/i)
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10)
  }

  return parseInt(number, 10)
}

/**
 * Extracts the rarity prefix from a card number for sorting
 * E.g., "R-001" -> "R", "NRSS-AR-001" -> "NRSS-AR", "SS-HR-001" -> "SS-HR"
 * @param number - The card number string
 * @returns The rarity prefix
 */
function extractRarityPrefix(number: string): string {
  if (number.includes('/')) {
    return 'PROMO'
  }
  // Extract everything before the last numeric segment
  const match = number.match(/^(.+)-\d+$/)
  if (match) {
    return match[1]
  }
  return ''
}

/**
 * Extracts the promo code from a card number
 * For promo cards with slash notation (e.g., "26/P1"), returns "P1"
 * For regular cards, returns null
 * @param number - The card number string
 * @returns The promo code or null
 */
function extractPromoCode(number: string): string | null {
  if (number.includes('/')) {
    const parts = number.split('/')
    return parts[1] || null
  }
  return null
}

/**
 * Order of rarity prefixes for Naruto Kayou cards
 * Regular rarities first, then special editions (SS-*, NRSS-*)
 */
const NARUTO_RARITY_ORDER: string[] = [
  'R', 'SR', 'SSR', 'TR', 'TGR', 'HR', 'UR', 'ZR', 'AR', 'AR-SILVER', 'OR', 'SLR',
  'PTR', 'PU', 'CP', 'SP', 'MR', 'GP', 'CR', 'NR', 'BP', 'SE', 'SV', 'SV-SILVER', 'SV-GOLD',
  'SCR', 'LR', 'PR', 'BR',
  // Special editions
  'SS-HR', 'SS-OR', 'SS-SSR',
  'NRSS-AR', 'NRSS-SE', 'NRSS-SP', 'NRSS-UR'
]

/**
 * Gets the sort order for a rarity prefix
 * @param prefix - The rarity prefix
 * @returns The sort order (lower = first)
 */
function getRarityOrder(prefix: string): number {
  const index = NARUTO_RARITY_ORDER.indexOf(prefix)
  return index >= 0 ? index : NARUTO_RARITY_ORDER.length
}

/**
 * Sorts an array of cards by number
 * For Naruto Kayou: sorts by rarity prefix first, then by numeric value
 * Promo cards are sorted by their promo code (P1, P2, P3), then by their numeric value
 * Regular cards are sorted by their numeric value and come before promo cards
 * @param cards - Array of cards to sort
 * @returns Sorted array of cards (does not mutate original array)
 */
export function sortCardsByNumber<T extends CardWithNumber>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const isPromoA = isPromoCard(a)
    const isPromoB = isPromoCard(b)

    // Regular cards always come first (for non-Naruto games)
    if (!isPromoA && isPromoB) return -1
    if (isPromoA && !isPromoB) return 1

    // If both are promo, sort by promo code first (P1, P2, P3, etc.)
    if (isPromoA && isPromoB) {
      const promoCodeA = extractPromoCode(a.number)
      const promoCodeB = extractPromoCode(b.number)

      if (promoCodeA && promoCodeB && promoCodeA !== promoCodeB) {
        // Extract the numeric part of promo code (P1 -> 1, P2 -> 2)
        const promoNumA = parseInt(promoCodeA.substring(1), 10)
        const promoNumB = parseInt(promoCodeB.substring(1), 10)

        // Sort by promo code number
        if (promoNumA !== promoNumB) {
          return promoNumA - promoNumB
        }
      }
    }

    // For Naruto Kayou style cards (with rarity prefix), sort by rarity first
    const prefixA = extractRarityPrefix(a.number)
    const prefixB = extractRarityPrefix(b.number)

    if (prefixA && prefixB && prefixA !== prefixB) {
      const orderA = getRarityOrder(prefixA)
      const orderB = getRarityOrder(prefixB)
      if (orderA !== orderB) {
        return orderA - orderB
      }
    }

    // If same rarity prefix or both regular, sort by card number
    const numA = extractNumericValue(a.number)
    const numB = extractNumericValue(b.number)
    return numA - numB
  })
}

/**
 * Sorts an array of cards by name (alphabetically)
 * Promo cards are always sorted to the end
 * @param cards - Array of cards to sort
 * @returns Sorted array of cards (does not mutate original array)
 */
export function sortCardsByName<T extends CardWithNumber>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const isPromoA = isPromoCard(a)
    const isPromoB = isPromoCard(b)

    // Promo cards always go to the end
    if (isPromoA && !isPromoB) return 1
    if (!isPromoA && isPromoB) return -1

    // Sort alphabetically
    return a.name.localeCompare(b.name)
  })
}

/**
 * Sorts an array of cards by rarity
 * Cards without rarity go to the end
 * Promo cards are always sorted to the end
 * @param cards - Array of cards to sort
 * @returns Sorted array of cards (does not mutate original array)
 */
export function sortCardsByRarity<T extends CardWithNumber>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const isPromoA = isPromoCard(a)
    const isPromoB = isPromoCard(b)

    // Promo cards always go to the end
    if (isPromoA && !isPromoB) return 1
    if (!isPromoA && isPromoB) return -1

    // Cards without rarity go to the end
    if (!a.rarity) return 1
    if (!b.rarity) return -1

    // Sort by rarity name
    return a.rarity.localeCompare(b.rarity)
  })
}

/**
 * Sorts cards according to the specified sort option
 * @param cards - Array of cards to sort
 * @param sortBy - Sort option ('number', 'name', or 'rarity')
 * @returns Sorted array of cards (does not mutate original array)
 */
export function sortCards<T extends CardWithNumber>(
  cards: T[],
  sortBy: SortOption = 'number'
): T[] {
  switch (sortBy) {
    case 'name':
      return sortCardsByName(cards)
    case 'rarity':
      return sortCardsByRarity(cards)
    case 'number':
    default:
      return sortCardsByNumber(cards)
  }
}
