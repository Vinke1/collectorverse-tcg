/**
 * Foil detection utilities for card rarity
 */

/**
 * Checks if a card is foil-only based on its rarity
 * Used for Lorcana cards (enchanted, D100, D23, promo)
 */
export function isFoilOnlyByRarity(rarity: string | null, seriesCode?: string): boolean {
  if (!rarity) return seriesCode === "Promo";

  const rarityLower = rarity.toLowerCase();
  return (
    rarityLower.includes("enchant") ||
    rarityLower === "d100" ||
    rarityLower === "d23" ||
    rarityLower === "promo" ||
    seriesCode === "Promo"
  );
}

/**
 * Determines if a card should show foil-only behavior
 * Combines rarity-based and attribute-based detection (for Riftbound)
 */
export function isFoilOnly(
  rarity: string | null,
  seriesCode?: string,
  isFoilAttr?: boolean
): boolean {
  return isFoilOnlyByRarity(rarity, seriesCode) || isFoilAttr === true;
}

/**
 * Determines if a card is standard-only (no foil version)
 * Only applies to Riftbound cards with is_foil = false
 */
export function isStandardOnly(isFoilAttr?: boolean): boolean {
  return isFoilAttr === false;
}

/**
 * Determines if foil effect should be shown
 */
export function shouldShowFoilEffect(
  selectedVersion: string,
  rarity: string | null,
  seriesCode?: string,
  isFoilAttr?: boolean
): boolean {
  return selectedVersion === "foil" || isFoilOnly(rarity, seriesCode, isFoilAttr);
}
