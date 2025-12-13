/**
 * Unified card URL parsing logic for Lorcana cards
 */

import { slugToTitle } from './utils'

export interface ParsedCard {
  slug: string
  number: string
  language: string
  chapter: number
  name: string
  imageUrl: string
}

export interface ParseOptions {
  seriesCode: string
  setNumber?: number
}

/**
 * Parses a Lorcana card URL and extracts card information
 * Supports multiple URL patterns found on lorcards.fr
 *
 * @param url - The card URL to parse
 * @param options - Options including seriesCode and optional setNumber
 * @returns Parsed card data or null if parsing fails
 */
export function parseCardUrl(url: string, options: ParseOptions): ParsedCard | null {
  const match = url.match(/\/cards\/(.+)$/)
  if (!match) return null

  const slug = match[1]
  const { seriesCode, setNumber } = options

  // Pattern 1: {seriesName}-{number}-{setBase}-{cardName}
  // Example: l-ile-d-arcadia-1-204-rhino-orateur-motivant
  // Example: la-mer-azurite-143-204-maitre-hibou
  const seriesNameMatch = slug.match(/^([a-z-]+)-(\d+)-(\d+)-(.+)/)
  if (seriesNameMatch) {
    const [, , index, , namePart] = seriesNameMatch
    const name = slugToTitle(namePart)

    const imageUrl = `https://static.lorcards.fr/cards/fr/${seriesCode.toLowerCase()}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      slug,
      number: index,
      language: 'FR', // Default FR for this format
      chapter: setNumber || 1, // Use provided setNumber or default to 1
      name,
      imageUrl
    }
  }

  // Pattern 2: {number}-{setBase}-{lang}-{chapter}-{name}
  // Example: 143-204-fr-9-belle-étrange-mais-spéciale
  const numberMatch = slug.match(/^(\d+)-(\d+)-([a-z]{2})-(\d+)-(.+)/)
  if (numberMatch) {
    const [, index, , lang, version, namePart] = numberMatch
    const name = slugToTitle(namePart)

    const imageUrl = `https://static.lorcards.fr/cards/fr/${seriesCode.toLowerCase()}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      slug,
      number: index,
      language: lang.toUpperCase(),
      chapter: parseInt(version),
      name,
      imageUrl
    }
  }

  // Pattern 3: {number}-{lang}-{chapter}-{name} (without setBase)
  const simpleMatch = slug.match(/^(\d+)-([a-z]{2})-(\d+)-(.+)/)
  if (simpleMatch) {
    const [, index, lang, version, namePart] = simpleMatch
    const name = slugToTitle(namePart)

    const imageUrl = `https://static.lorcards.fr/cards/fr/${seriesCode.toLowerCase()}/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-${slug}.webp`

    return {
      slug,
      number: index,
      language: lang.toUpperCase(),
      chapter: parseInt(version),
      name,
      imageUrl
    }
  }

  return null
}
