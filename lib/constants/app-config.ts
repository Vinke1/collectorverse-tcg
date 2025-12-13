/**
 * Application-wide configuration constants
 */

/**
 * Card image dimensions for optimization
 */
export const CARD_DIMENSIONS = {
  width: 480,
  height: 672,
  aspectRatio: '2.5/3.5',
  quality: 85 // WebP quality percentage
}

/**
 * Series image dimensions for optimization
 */
export const SERIES_DIMENSIONS = {
  width: 800,
  quality: 90 // WebP quality percentage
}

/**
 * Icon sizes in pixels
 */
export const ICON_SIZES = {
  small: 40,   // w-10 h-10
  medium: 56,  // w-14 h-14
  large: 80    // w-20 h-20
}

/**
 * Delays for rate limiting in scripts (milliseconds)
 */
export const DELAYS = {
  betweenPages: 2000,      // 2 seconds between page scrapes
  betweenUploads: 500,     // 500ms between uploads
  betweenSeries: 5000,     // 5 seconds between series processing
  pageLoad: 1000           // 1 second for page content to load
}

/**
 * Script safety limits
 */
export const SCRIPT_LIMITS = {
  maxPages: 20,            // Maximum pages to scrape before safety cutoff
  requestTimeout: 30000    // 30 seconds timeout for requests
}

/**
 * Supported languages with metadata
 */
export const SUPPORTED_LANGUAGES = [
  {
    code: 'fr',
    label: 'Français',
    flag: '/images/flags/fr.svg',
    isDefault: true
  },
  {
    code: 'en',
    label: 'Anglais',
    flag: '/images/flags/us.svg',
    isDefault: false
  },
  {
    code: 'jp',
    label: 'Japonais',
    flag: '/images/flags/jp.svg',
    isDefault: false
  },
  {
    code: 'zh',
    label: '中文',
    flag: '/images/flags/zh.svg',
    isDefault: false
  }
]

/**
 * Get default language code
 */
export function getDefaultLanguage(): string {
  const defaultLang = SUPPORTED_LANGUAGES.find(lang => lang.isDefault)
  return defaultLang?.code || 'fr'
}

/**
 * Supported card versions/finishes
 */
export const CARD_VERSIONS = {
  all: 'all',       // Show all cards
  normal: 'normal', // Exclude foil/enchanted cards
  foil: 'foil'      // Show only foil cards
}
