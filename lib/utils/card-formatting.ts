/**
 * Card formatting utilities
 */

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
