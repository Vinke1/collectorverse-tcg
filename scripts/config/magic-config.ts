/**
 * Magic: The Gathering configuration for seeding scripts
 * Uses Scryfall API as data source
 */

import { CARD_DIMENSIONS } from '../../lib/constants/app-config'

/**
 * Main configuration for Magic TCG
 */
export const MAGIC_CONFIG = {
  /** TCG slug in database */
  tcgSlug: 'mtg',

  /** Supabase storage bucket name */
  bucket: 'mtg-cards',

  /** Supported languages (Scryfall codes) */
  languages: ['en', 'fr', 'ja', 'zhs'] as const,

  /** Scryfall API endpoints */
  api: {
    bulkData: 'https://api.scryfall.com/bulk-data',
    sets: 'https://api.scryfall.com/sets',
    cards: 'https://api.scryfall.com/cards',
  },

  /** Image optimization settings */
  imageConfig: {
    width: CARD_DIMENSIONS.width,
    height: CARD_DIMENSIONS.height,
    quality: CARD_DIMENSIONS.quality,
    format: 'webp' as const,
  },

  /** Rate limiting */
  delays: {
    betweenApiCalls: 100,      // 100ms between Scryfall API calls
    betweenImageDownloads: 50,  // 50ms between image downloads
    betweenUploads: 50,         // 50ms between storage uploads
  },

  /** Retry configuration */
  retry: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 30000,
  },

  /** Local file paths */
  paths: {
    bulkData: 'scripts/data/scryfall-all-cards.json',
    progress: 'scripts/logs/magic-seed-progress.json',
    errors: 'scripts/logs/magic-seed-errors.json',
  },
}

/**
 * Scryfall rarity to normalized rarity mapping
 */
export const RARITY_MAP: Record<string, string> = {
  'common': 'common',
  'uncommon': 'uncommon',
  'rare': 'rare',
  'mythic': 'mythic',
  'special': 'special',
  'bonus': 'bonus',
}

/**
 * Scryfall language codes to our language codes
 */
export const LANGUAGE_MAP: Record<string, string> = {
  'en': 'en',
  'fr': 'fr',
  'ja': 'ja',
  'zhs': 'zhs',    // Simplified Chinese
  'zht': 'zht',    // Traditional Chinese (not used currently)
  'de': 'de',
  'es': 'es',
  'it': 'it',
  'pt': 'pt',
  'ko': 'ko',
  'ru': 'ru',
}

/**
 * Set types to include (exclude memorabilia, token, etc.)
 */
export const INCLUDED_SET_TYPES = [
  'core',
  'expansion',
  'masters',
  'alchemy',
  'masterpiece',
  'arsenal',
  'from_the_vault',
  'spellbook',
  'premium_deck',
  'duel_deck',
  'draft_innovation',
  'treasure_chest',
  'commander',
  'planechase',
  'archenemy',
  'vanguard',
  'funny',
  'starter',
  'box',
  'promo',
  'minigame',
]

/**
 * Set types to exclude
 */
export const EXCLUDED_SET_TYPES = [
  'token',
  'memorabilia',
]

/**
 * Card layouts that have multiple faces
 */
export const MULTI_FACE_LAYOUTS = [
  'transform',
  'modal_dfc',
  'reversible_card',
  'art_series',
]

/**
 * Card layouts that should be skipped (tokens, emblems, etc.)
 */
export const EXCLUDED_LAYOUTS = [
  'token',
  'double_faced_token',
  'emblem',
  'art_series',
]

export type SupportedLanguage = typeof MAGIC_CONFIG.languages[number]
