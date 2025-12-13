/**
 * Star Wars: Unlimited Series Configuration
 *
 * This file contains the complete list of Star Wars Unlimited TCG series/sets
 * with their swucards.fr URL slugs for scraping.
 *
 * URL Pattern: https://www.swucards.fr/series/{slug}
 */

export interface StarWarsSeriesConfig {
  code: string          // Series code (e.g., "SOR", "SHD")
  name: string          // Series name in English
  nameFr: string        // Series name in French
  slug: string          // swucards.fr URL slug
  type: 'booster' | 'starter' | 'weekly' | 'promo'
  releaseDate: string   // Release date (YYYY-MM-DD)
  cardCount?: number    // Approximate card count (optional)
  skip?: boolean        // Skip this series during batch processing
}

// ============================================
// BOOSTER SETS (Main expansions)
// ============================================

export const STARWARS_BOOSTERS: StarWarsSeriesConfig[] = [
  {
    code: 'SOR',
    name: 'Spark of Rebellion',
    nameFr: 'Étincelle de Rébellion',
    slug: 'sor-etincelle-de-rebellion',
    type: 'booster',
    releaseDate: '2024-03-08',
    cardCount: 509
  },
  {
    code: 'SHD',
    name: 'Shadows of the Galaxy',
    nameFr: 'Ombres de la Galaxie',
    slug: 'shd-ombres-de-la-galaxie',
    type: 'booster',
    releaseDate: '2024-07-12',
    cardCount: 523
  },
  {
    code: 'TWI',
    name: 'Twilight of the Republic',
    nameFr: 'Crépuscule de la République',
    slug: 'twi-crepuscule-de-la-republique',
    type: 'booster',
    releaseDate: '2024-11-08',
    cardCount: 517
  },
  {
    code: 'JTL',
    name: 'Jump to Lightspeed',
    nameFr: 'Passage en Vitesse Lumière',
    slug: 'jtl-passage-en-vitesse-lumiere',
    type: 'booster',
    releaseDate: '2025-03-07',
    cardCount: 546
  },
  {
    code: 'LOF',
    name: 'Legends of the Force',
    nameFr: 'Légendes de la Force',
    slug: 'lof-legendes-de-la-force',
    type: 'booster',
    releaseDate: '2025-07-04',
    cardCount: 544
  },
  {
    code: 'SEC',
    name: 'Secrets of Power',
    nameFr: 'Secrets du Pouvoir',
    slug: 'sec-secrets-du-pouvoir',
    type: 'booster',
    releaseDate: '2025-11-07',
    cardCount: 282
  },
]

// ============================================
// WEEKLY PLAY SETS (W*)
// ============================================

export const STARWARS_WEEKLY: StarWarsSeriesConfig[] = [
  {
    code: 'WSOR',
    name: 'Weekly Play - Spark of Rebellion',
    nameFr: 'Weekly Play - Étincelle de Rébellion',
    slug: 'wsor-weekly-play-etincelle-de-rebellion',
    type: 'weekly',
    releaseDate: '2024-03-08',
    cardCount: 29
  },
  {
    code: 'WSHD',
    name: 'Weekly Play - Shadows of the Galaxy',
    nameFr: 'Weekly Play - Ombres de la Galaxie',
    slug: 'wshd-weekly-play-ombres-de-la-galaxie',
    type: 'weekly',
    releaseDate: '2024-07-12',
    cardCount: 28
  },
  {
    code: 'WTWI',
    name: 'Weekly Play - Twilight of the Republic',
    nameFr: 'Weekly Play - Crépuscule de la République',
    slug: 'wtwi-weekly-play-crepuscule-de-la-republique',
    type: 'weekly',
    releaseDate: '2024-11-08',
    cardCount: 30
  },
  {
    code: 'WJTL',
    name: 'Weekly Play - Jump to Lightspeed',
    nameFr: 'Weekly Play - Passage en Vitesse Lumière',
    slug: 'wjtl-weekly-play-passage-en-vitesse-lumiere',
    type: 'weekly',
    releaseDate: '2025-03-07',
    cardCount: 40
  },
  {
    code: 'WLOF',
    name: 'Weekly Play - Legends of the Force',
    nameFr: 'Weekly Play - Légendes de la Force',
    slug: 'wlof-weekly-play-legendes-de-la-force',
    type: 'weekly',
    releaseDate: '2025-07-04',
    cardCount: 40
  },
]

// ============================================
// PROMOTIONAL CARDS (OP)
// ============================================

export const STARWARS_PROMOS: StarWarsSeriesConfig[] = [
  {
    code: 'OP',
    name: 'Promotional Cards',
    nameFr: 'Cartes Promotionnelles',
    slug: 'p-cartes-promotionnelles',
    type: 'promo',
    releaseDate: '2024-01-01',
    cardCount: 12
  },
]

// ============================================
// ALL SERIES COMBINED
// ============================================

export const STARWARS_ALL_SERIES: StarWarsSeriesConfig[] = [
  ...STARWARS_BOOSTERS,
  ...STARWARS_WEEKLY,
  ...STARWARS_PROMOS,
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get series config by code
 */
export function getSeriesByCode(code: string): StarWarsSeriesConfig | undefined {
  return STARWARS_ALL_SERIES.find(s => s.code.toLowerCase() === code.toLowerCase())
}

/**
 * Get series config by slug
 */
export function getSeriesBySlug(slug: string): StarWarsSeriesConfig | undefined {
  return STARWARS_ALL_SERIES.find(s => s.slug.toLowerCase() === slug.toLowerCase())
}

/**
 * Get all series of a specific type
 */
export function getSeriesByType(type: StarWarsSeriesConfig['type']): StarWarsSeriesConfig[] {
  return STARWARS_ALL_SERIES.filter(s => s.type === type)
}

/**
 * Get series that should not be skipped
 */
export function getActiveSeries(): StarWarsSeriesConfig[] {
  return STARWARS_ALL_SERIES.filter(s => !s.skip)
}

// ============================================
// LANGUAGE CONFIGURATION
// ============================================

export const STARWARS_LANGUAGES = [
  { code: 'fr', name: 'Français', urlParam: 'fr' },
  { code: 'en', name: 'English', urlParam: 'en' },
] as const

export type StarWarsLanguage = typeof STARWARS_LANGUAGES[number]['code']

// ============================================
// LANGUAGE AVAILABILITY BY SERIES
// ============================================

/**
 * All Star Wars Unlimited series are available in both FR and EN
 */
export const SERIES_AVAILABLE_LANGUAGES: Record<string, StarWarsLanguage[]> = {
  // Boosters - all available in FR and EN
  'SOR': ['fr', 'en'],
  'SHD': ['fr', 'en'],
  'TWI': ['fr', 'en'],
  'JTL': ['fr', 'en'],
  'LOF': ['fr', 'en'],
  'SEC': ['fr', 'en'],

  // Weekly Play - all available in FR and EN
  'WSOR': ['fr', 'en'],
  'WSHD': ['fr', 'en'],
  'WTWI': ['fr', 'en'],
  'WJTL': ['fr', 'en'],
  'WLOF': ['fr', 'en'],

  // Promos
  'OP': ['fr', 'en'],
}

/**
 * Check if a series is available in a given language
 */
export function isSeriesAvailableInLanguage(seriesCode: string, language: StarWarsLanguage): boolean {
  const code = seriesCode.toUpperCase()
  const availableLanguages = SERIES_AVAILABLE_LANGUAGES[code]

  // If no config, assume available in all languages
  if (!availableLanguages) {
    return true
  }

  return availableLanguages.includes(language)
}

/**
 * Get available languages for a series
 */
export function getAvailableLanguages(seriesCode: string): StarWarsLanguage[] {
  const code = seriesCode.toUpperCase()
  return SERIES_AVAILABLE_LANGUAGES[code] || ['fr', 'en']
}

// ============================================
// RARITY MAPPING
// ============================================

export const STARWARS_RARITIES: Record<string, { name: string; code: string }> = {
  'C': { name: 'Commune', code: 'c' },
  'U': { name: 'Peu commune', code: 'u' },
  'R': { name: 'Rare', code: 'r' },
  'L': { name: 'Légendaire', code: 'l' },
  'S': { name: 'Spéciale', code: 's' },
  'P': { name: 'Promo', code: 'p' },
}

/**
 * Normalize a rarity string to standard code
 */
export function normalizeRarity(rarity: string): string {
  const upper = rarity.toUpperCase().trim()
  return STARWARS_RARITIES[upper]?.code || rarity.toLowerCase()
}

// ============================================
// CARD TYPE MAPPING
// ============================================

export const STARWARS_CARD_TYPES: Record<string, { name: string; code: string }> = {
  'LEADER': { name: 'Leader', code: 'leader' },
  'UNIT': { name: 'Unité', code: 'unit' },
  'UNITÉ': { name: 'Unité', code: 'unit' },
  'EVENT': { name: 'Événement', code: 'event' },
  'ÉVÉNEMENT': { name: 'Événement', code: 'event' },
  'EVENEMENT': { name: 'Événement', code: 'event' },
  'UPGRADE': { name: 'Amélioration', code: 'upgrade' },
  'AMÉLIORATION': { name: 'Amélioration', code: 'upgrade' },
  'AMELIORATION': { name: 'Amélioration', code: 'upgrade' },
  'BASE': { name: 'Base', code: 'base' },
}

/**
 * Normalize a card type string to standard code
 */
export function normalizeCardType(cardType: string): string {
  const upper = cardType.toUpperCase().trim()
  return STARWARS_CARD_TYPES[upper]?.code || cardType.toLowerCase()
}

// ============================================
// ARENA MAPPING
// ============================================

export const STARWARS_ARENAS: Record<string, { name: string; code: string }> = {
  'TERRESTRE': { name: 'Terrestre', code: 'ground' },
  'GROUND': { name: 'Terrestre', code: 'ground' },
  'SPATIALE': { name: 'Spatiale', code: 'space' },
  'SPACE': { name: 'Spatiale', code: 'space' },
}

/**
 * Normalize an arena string to standard code
 */
export function normalizeArena(arena: string): string {
  const upper = arena.toUpperCase().trim()
  return STARWARS_ARENAS[upper]?.code || arena.toLowerCase()
}

// ============================================
// ASPECT MAPPING
// ============================================

export const STARWARS_ASPECTS: Record<string, { name: string; code: string }> = {
  'VIGILANCE': { name: 'Vigilance', code: 'vigilance' },
  'COMMANDEMENT': { name: 'Commandement', code: 'command' },
  'COMMAND': { name: 'Commandement', code: 'command' },
  'AGRESSION': { name: 'Agression', code: 'aggression' },
  'AGGRESSION': { name: 'Agression', code: 'aggression' },
  'RUSE': { name: 'Ruse', code: 'cunning' },
  'CUNNING': { name: 'Ruse', code: 'cunning' },
  'INFÂMIE': { name: 'Infâmie', code: 'villainy' },
  'INFAMIE': { name: 'Infâmie', code: 'villainy' },
  'VILLAINY': { name: 'Infâmie', code: 'villainy' },
  'HÉROÏSME': { name: 'Héroïsme', code: 'heroism' },
  'HEROISME': { name: 'Héroïsme', code: 'heroism' },
  'HEROISM': { name: 'Héroïsme', code: 'heroism' },
}

/**
 * Normalize an aspect string to standard code
 */
export function normalizeAspect(aspect: string): string {
  const upper = aspect.toUpperCase().trim()
  return STARWARS_ASPECTS[upper]?.code || aspect.toLowerCase()
}
