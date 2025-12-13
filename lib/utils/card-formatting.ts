/**
 * Card formatting utilities
 */

/**
 * Formats a card number for display
 * If the number contains a slash (e.g., "1/P3"), returns it as-is
 * Otherwise, appends the maxSetBase if provided (e.g., "143" -> "143/204")
 *
 * @param number - The card number to format
 * @param maxSetBase - Optional maximum set base number
 * @returns Formatted card number
 */
export function formatCardNumber(number: string, maxSetBase?: number): string {
  // If number already contains a slash (promo format), return as-is
  if (number.includes('/')) {
    return number
  }

  // If maxSetBase is provided, format as "number/maxSetBase"
  if (maxSetBase) {
    return `${number}/${maxSetBase}`
  }

  // Otherwise, return the number as-is
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
