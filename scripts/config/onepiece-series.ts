/**
 * One Piece Card Game Series Configuration
 *
 * This file contains the complete list of One Piece TCG series/sets
 * with their opecards.fr serie IDs for scraping.
 *
 * Serie IDs are used in the URL: /cards/search?serie={serieId}
 */

export interface OnePieceSeriesConfig {
  code: string          // Series code (e.g., "OP13", "ST01")
  name: string          // Series name in English
  nameFr?: string       // Series name in French (if different)
  serieId: number       // opecards.fr serie ID for URL
  type: 'booster' | 'starter' | 'premium' | 'special' | 'promo'
  releaseDate: string   // Release date (YYYY-MM-DD)
  cardCount?: number    // Approximate card count (optional)
  skip?: boolean        // Skip this series during batch processing
}

// ============================================
// BOOSTER SETS (OP)
// ============================================

export const ONEPIECE_BOOSTERS: OnePieceSeriesConfig[] = [
  { code: 'OP01', name: 'Romance Dawn', serieId: 1, type: 'booster', releaseDate: '2022-07-22', cardCount: 121 },
  { code: 'OP02', name: 'Paramount War', serieId: 14, type: 'booster', releaseDate: '2022-11-04', cardCount: 121 },
  { code: 'OP03', name: 'Pillars of Strength', serieId: 59, type: 'booster', releaseDate: '2023-02-10', cardCount: 122 },
  { code: 'OP04', name: 'Kingdoms of Intrigue', serieId: 101, type: 'booster', releaseDate: '2023-05-26', cardCount: 122 },
  { code: 'OP05', name: 'Awakening of the New Era', serieId: 143, type: 'booster', releaseDate: '2023-08-25', cardCount: 122 },
  { code: 'OP06', name: 'Wings of the Captain', serieId: 195, type: 'booster', releaseDate: '2023-11-24', cardCount: 131 },
  { code: 'OP07', name: '500 Years in the Future', serieId: 235, type: 'booster', releaseDate: '2024-02-23', cardCount: 141 },
  { code: 'OP08', name: 'Two Legends', serieId: 271, type: 'booster', releaseDate: '2024-05-24', cardCount: 142 },
  { code: 'OP09', name: 'The Four Emperors', serieId: 305, type: 'booster', releaseDate: '2024-08-30', cardCount: 146 },
  { code: 'OP10', name: 'Royal Blood', nameFr: 'Sang Royal', serieId: 330, type: 'booster', releaseDate: '2024-11-29', cardCount: 150 },
  { code: 'OP11', name: 'Endless Dream', nameFr: 'Reve Sans Fin', serieId: 349, type: 'booster', releaseDate: '2025-02-28', cardCount: 155 },
  { code: 'OP12', name: 'Master\'s Legacy', nameFr: 'L\'Heritage du Maitre', serieId: 377, type: 'booster', releaseDate: '2025-05-30', cardCount: 155 },
  { code: 'OP13', name: 'Successors', nameFr: 'Successeurs', serieId: 400, type: 'booster', releaseDate: '2025-08-29', cardCount: 175 },
]

// ============================================
// STARTER DECKS (ST)
// ============================================

export const ONEPIECE_STARTERS: OnePieceSeriesConfig[] = [
  { code: 'ST01', name: 'Straw Hat Crew', nameFr: 'Equipage du Chapeau de Paille', serieId: 24, type: 'starter', releaseDate: '2022-07-08', cardCount: 51 },
  { code: 'ST02', name: 'Worst Generation', nameFr: 'Pire Generation', serieId: 25, type: 'starter', releaseDate: '2022-07-08', cardCount: 51 },
  { code: 'ST03', name: 'The Seven Warlords of the Sea', nameFr: 'Sept Grands Corsaires', serieId: 26, type: 'starter', releaseDate: '2022-07-08', cardCount: 51 },
  { code: 'ST04', name: 'Animal Kingdom Pirates', nameFr: 'Pirates de Cent Betes', serieId: 27, type: 'starter', releaseDate: '2022-07-08', cardCount: 51 },
  { code: 'ST05', name: 'ONE PIECE FILM edition', serieId: 48, type: 'starter', releaseDate: '2022-08-06', cardCount: 51 },
  { code: 'ST06', name: 'Navy', nameFr: 'Marine', serieId: 66, type: 'starter', releaseDate: '2023-01-21', cardCount: 51 },
  { code: 'ST07', name: 'Big Mom Pirates', nameFr: 'Equipage de Big Mom', serieId: 67, type: 'starter', releaseDate: '2023-01-21', cardCount: 51 },
  { code: 'ST08', name: 'Monkey D. Luffy', serieId: 115, type: 'starter', releaseDate: '2023-05-12', cardCount: 51 },
  { code: 'ST09', name: 'Yamato', serieId: 116, type: 'starter', releaseDate: '2023-05-12', cardCount: 51 },
  { code: 'ST10', name: 'Ultra Deck: The Three Captains', nameFr: 'Ultra Deck: Les Trois Capitaines', serieId: 154, type: 'starter', releaseDate: '2023-09-08', cardCount: 51 },
  { code: 'ST11', name: 'Uta', serieId: 175, type: 'starter', releaseDate: '2023-10-27', cardCount: 51 },
  { code: 'ST12', name: 'Zoro & Sanji', serieId: 206, type: 'starter', releaseDate: '2024-01-26', cardCount: 51 },
  { code: 'ST13', name: 'Ultra Deck: The Three Brothers', nameFr: 'Ultra Deck: Les Trois Freres', serieId: 247, type: 'starter', releaseDate: '2024-03-29', cardCount: 51 },
  { code: 'ST14', name: '3D2Y', serieId: 279, type: 'starter', releaseDate: '2024-06-28', cardCount: 51 },
  { code: 'ST15', name: 'RED Edward Newgate', serieId: 295, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST16', name: 'GREEN Uta', serieId: 296, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST17', name: 'BLUE Donquixote Doflamingo', serieId: 297, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST18', name: 'PURPLE Monkey D. Luffy', serieId: 298, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST19', name: 'BLACK Smoker', serieId: 299, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST20', name: 'YELLOW Charlotte Katakuri', serieId: 300, type: 'starter', releaseDate: '2024-08-02', cardCount: 21 },
  { code: 'ST21', name: 'Gear 5', serieId: 341, type: 'starter', releaseDate: '2024-12-20', cardCount: 51 },
  { code: 'ST22', name: 'Ace & Newgate', serieId: 385, type: 'starter', releaseDate: '2025-06-27', cardCount: 31 },
]

// ============================================
// PREMIUM COLLECTIONS (PRB)
// ============================================

export const ONEPIECE_PREMIUM: OnePieceSeriesConfig[] = [
  { code: 'PRB01', name: 'One Piece Card - The Best Vol.1', serieId: 320, type: 'premium', releaseDate: '2024-10-25', cardCount: 316 },
  { code: 'PRB02', name: 'One Piece Card - The Best Vol.2', serieId: 390, type: 'premium', releaseDate: '2025-07-25', cardCount: 316 },
]

// ============================================
// SPECIAL EDITIONS (EB)
// ============================================

export const ONEPIECE_SPECIAL: OnePieceSeriesConfig[] = [
  { code: 'EB01', name: 'Memorial Collection', serieId: 258, type: 'special', releaseDate: '2024-04-26', cardCount: 72 },
]

// ============================================
// PROMOTIONAL CARDS (P, STP)
// ============================================

export const ONEPIECE_PROMOS: OnePieceSeriesConfig[] = [
  { code: 'P', name: 'Promotional Cards', nameFr: 'Cartes Promotionnelles', serieId: 50, type: 'promo', releaseDate: '2022-07-01' },
  { code: 'STP', name: 'Tournament & Shop Promos', nameFr: 'Promos Tournoi et Boutique', serieId: 180, type: 'promo', releaseDate: '2023-01-01' },
]

// ============================================
// ALL SERIES COMBINED
// ============================================

export const ONEPIECE_ALL_SERIES: OnePieceSeriesConfig[] = [
  ...ONEPIECE_BOOSTERS,
  ...ONEPIECE_STARTERS,
  ...ONEPIECE_PREMIUM,
  ...ONEPIECE_SPECIAL,
  ...ONEPIECE_PROMOS,
]

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get series config by code
 */
export function getSeriesByCode(code: string): OnePieceSeriesConfig | undefined {
  return ONEPIECE_ALL_SERIES.find(s => s.code.toLowerCase() === code.toLowerCase())
}

/**
 * Get series config by opecards.fr serie ID
 */
export function getSeriesBySerieId(serieId: number): OnePieceSeriesConfig | undefined {
  return ONEPIECE_ALL_SERIES.find(s => s.serieId === serieId)
}

/**
 * Get all series of a specific type
 */
export function getSeriesByType(type: OnePieceSeriesConfig['type']): OnePieceSeriesConfig[] {
  return ONEPIECE_ALL_SERIES.filter(s => s.type === type)
}

/**
 * Get series that should not be skipped
 */
export function getActiveSeries(): OnePieceSeriesConfig[] {
  return ONEPIECE_ALL_SERIES.filter(s => !s.skip)
}

// ============================================
// LANGUAGE CONFIGURATION
// ============================================

export const ONEPIECE_LANGUAGES = [
  { code: 'fr', name: 'Francais', urlParam: 'fr' },
  { code: 'en', name: 'English', urlParam: 'en' },
  { code: 'jp', name: 'Japanese', urlParam: 'jp' },
] as const

export type OnePieceLanguage = typeof ONEPIECE_LANGUAGES[number]['code']

// ============================================
// LANGUAGE AVAILABILITY BY SERIES
// ============================================

/**
 * Séries disponibles par langue sur opecards.fr
 * Basé sur les données réelles du site (décembre 2024)
 *
 * FR: Séries françaises (OP09+, ST15+, etc.)
 * EN: Séries anglaises (OP01+)
 * JP: Séries japonaises (OP01-OP01, ST01-ST04)
 */
export const SERIES_AVAILABLE_LANGUAGES: Record<string, OnePieceLanguage[]> = {
  // Boosters - FR disponible seulement à partir de OP09
  'OP01': ['en', 'jp'],
  'OP02': ['en', 'jp'],
  'OP03': ['en', 'jp'],
  'OP04': ['en', 'jp'],
  'OP05': ['en', 'jp'],
  'OP06': ['en', 'jp'],
  'OP07': ['en', 'jp'],
  'OP08': ['en', 'jp'],
  'OP09': ['fr', 'en', 'jp'],
  'OP10': ['fr', 'en', 'jp'],
  'OP11': ['fr', 'en', 'jp'],
  'OP12': ['fr', 'en', 'jp'],
  'OP13': ['fr', 'en', 'jp'],

  // Starters - JP seulement pour ST01-ST04, FR à partir de ST15
  'ST01': ['en', 'jp'],
  'ST02': ['en', 'jp'],
  'ST03': ['en', 'jp'],
  'ST04': ['en', 'jp'],
  'ST05': ['en'],
  'ST06': ['en'],
  'ST07': ['en'],
  'ST08': ['en'],
  'ST09': ['en'],
  'ST10': ['en'],
  'ST11': ['en'],
  'ST12': ['en'],
  'ST13': ['en'],
  'ST14': ['en'],
  'ST15': ['fr', 'en'],
  'ST16': ['fr', 'en'],
  'ST17': ['fr', 'en'],
  'ST18': ['fr', 'en'],
  'ST19': ['fr', 'en'],
  'ST20': ['fr', 'en'],
  'ST21': ['fr', 'en'],
  'ST22': ['fr', 'en'],
  'ST23': ['fr'],
  'ST24': ['fr'],
  'ST25': ['fr'],
  'ST26': ['fr'],
  'ST27': ['fr'],
  'ST28': ['fr'],

  // Premium & Special
  'PRB01': ['fr', 'en'],
  'PRB02': ['fr', 'en'],
  'EB01': ['en'],
  'EB02': ['fr', 'en'],

  // Promos
  'P': ['fr', 'en', 'jp'],
  'STP': ['fr', 'en'],
}

/**
 * Vérifie si une série est disponible dans une langue donnée
 */
export function isSeriesAvailableInLanguage(seriesCode: string, language: OnePieceLanguage): boolean {
  const code = seriesCode.toUpperCase()
  const availableLanguages = SERIES_AVAILABLE_LANGUAGES[code]

  // Si pas de config, on suppose disponible dans toutes les langues
  if (!availableLanguages) {
    return true
  }

  return availableLanguages.includes(language)
}

/**
 * Récupère les langues disponibles pour une série
 */
export function getAvailableLanguages(seriesCode: string): OnePieceLanguage[] {
  const code = seriesCode.toUpperCase()
  return SERIES_AVAILABLE_LANGUAGES[code] || ['fr', 'en', 'jp']
}
