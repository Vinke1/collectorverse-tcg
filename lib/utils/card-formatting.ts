/**
 * Card formatting utilities
 */

/**
 * Checks if a card number has a version suffix (e.g., "-V2", "-V3")
 * @param number - The card number to check
 * @returns True if the card has a version suffix
 */
export function hasVersionSuffix(number: string): boolean {
  return /-V\d+$/i.test(number)
}

/**
 * Formats a card number for display
 * Returns the card number as-is without appending set total
 *
 * @param number - The card number to format
 * @param _maxSetBase - Unused, kept for backwards compatibility
 * @returns Formatted card number
 */
export function formatCardNumber(number: string, _maxSetBase?: number): string {
  return number
}

/**
 * Parses a formatted card number back into components
 * @param formatted - The formatted card number (e.g., "143/204" or "1/P3")
 * @returns Object with number and optional set information
 */
export function parseCardNumber(formatted: string): {
  number: string
  set?: string
} {
  if (!formatted.includes('/')) {
    return { number: formatted }
  }

  const [number, set] = formatted.split('/')
  return { number, set }
}

/**
 * Checks if a card number represents a promo card
 * Promo cards use slash notation with non-numeric set codes (e.g., "1/P3", "2/D100")
 * @param number - The card number to check
 * @returns True if the card is a promo
 */
export function isPromoNumber(number: string): boolean {
  if (!number.includes('/')) return false

  const [, set] = number.split('/')
  // If the set part contains any non-digit characters, it's a promo
  return !/^\d+$/.test(set)
}
