/**
 * One Piece Card Game - URLs directes des séries sur opecards.fr
 *
 * Cette configuration contient les URLs exactes de chaque série pour chaque langue,
 * car le format des URLs varie de manière inconsistante sur le site.
 *
 * Formats observés:
 * - FR: /series/op12-l-heritage-du-maitre (pas de préfixe)
 * - EN: /series/en-op12-legacy-of-the-master (préfixe en-)
 * - JP: /series/jp-op01-romance-dawn (préfixe jp-)
 * - Parfois: /series/op-01-romance-dawn (tiret dans le code)
 * - Parfois: /series/op08-two-legends (pas de tiret)
 */

export const BASE_URL = 'https://www.opecards.fr'

export interface SeriesUrls {
  fr?: string
  en?: string
  jp?: string
}

/**
 * URLs directes pour chaque série One Piece
 * Clé = code série (OP01, ST01, P, etc.)
 */
export const ONEPIECE_SERIES_URLS: Record<string, SeriesUrls> = {
  // ============================================
  // BOOSTER SETS (OP)
  // ============================================
  'OP01': {
    en: '/series/op-01-romance-dawn',
    jp: '/series/jp-op01-romance-dawn'
  },
  'OP02': {
    en: '/series/op-02-paramount-war',
    // jp: pas trouvé
  },
  'OP03': {
    en: '/series/op-03-pillars-of-strength',
    // jp: pas trouvé
  },
  'OP04': {
    en: '/series/op-04-kingdom-of-intrigue',
    // jp: pas trouvé
  },
  'OP05': {
    en: '/series/op05-awakening-of-the-new-era',
    // jp: pas trouvé
  },
  'OP06': {
    en: '/series/op06-wings-of-the-captain',
  },
  'OP07': {
    en: '/series/op07-500-years-in-the-future',
  },
  'OP08': {
    en: '/series/op08-two-legends',
  },
  'OP09': {
    fr: '/series/op09-les-nouveaux-empereurs',
    en: '/series/op09-emperors-in-the-new-world',
  },
  'OP10': {
    fr: '/series/op10-sang-royal',
    en: '/series/en-op10-royal-blood',
  },
  'OP11': {
    fr: '/series/op11-des-poings-vifs-comme-l-eclair',
    en: '/series/op11-a-fist-of-divine-speed',
  },
  'OP12': {
    fr: '/series/op12-l-heritage-du-maitre',
    en: '/series/en-op12-legacy-of-the-master',
  },
  'OP13': {
    fr: '/series/op13-successeurs',
    en: '/series/op13-carrying-on-his-will',
  },

  // ============================================
  // STARTER DECKS (ST)
  // ============================================
  'ST01': {
    en: '/series/st01-starter-deck-straw-hat-crew',
    jp: '/series/jp-st01-starter-deck-straw-hat-crew',
  },
  'ST02': {
    en: '/series/st02-starter-deck-worst-generation',
    jp: '/series/jp-st02-starter-deck-worst-generation',
  },
  'ST03': {
    en: '/series/st03-starter-deck-the-seven-warlords-of-the-sea',
    jp: '/series/jp-st03-starter-deck-the-seven-warlords-of-the-sea',
  },
  'ST04': {
    en: '/series/st04-starter-deck-animal-kingdom-pirates',
    jp: '/series/jp-st04-starter-deck-animal-kingdom-pirates',
  },
  'ST05': {
    en: '/series/st05-starter-deck-one-piece-film-edition',
  },
  'ST06': {
    en: '/series/st06-starter-deck-absolute-justice',
  },
  'ST07': {
    en: '/series/st07-starter-deck-big-mom-pirates',
  },
  'ST08': {
    en: '/series/st08-starter-deck-monkey-d-luffy',
  },
  'ST09': {
    en: '/series/st09-starter-deck-yamato',
  },
  'ST10': {
    en: '/series/st10-the-three-captains',
  },
  'ST11': {
    en: '/series/st11-starter-deck-uta',
  },
  'ST12': {
    en: '/series/st12-starter-deck-zoro-and-sanji',
  },
  'ST13': {
    en: '/series/st13-ultra-deck-the-three-brothers',
  },
  'ST14': {
    en: '/series/st14-starter-deck-3d2y',
  },
  'ST15': {
    fr: '/series/st15-deck-pour-debutant-edward-newgate',
    en: '/series/st15-starter-deck-edward-newgate',
  },
  'ST16': {
    fr: '/series/st16-deck-pour-debutant-uta',
    en: '/series/st16-starter-deck-uta',
  },
  'ST17': {
    fr: '/series/st17-deck-pour-debutant-donquixote-doflamingo',
    en: '/series/st17-starter-deck-donquixote-doflamingo',
  },
  'ST18': {
    fr: '/series/st18-deck-pour-debutant-monkey-d-luffy',
    en: '/series/st18-starter-deck-monkey-d-luffy',
  },
  'ST19': {
    fr: '/series/st19-deck-pour-debutant-smoker',
    en: '/series/st19-starter-deck-smoker',
  },
  'ST20': {
    fr: '/series/st20-deck-pour-debutant-charlotte-katakuri',
    en: '/series/st20-starter-deck-charlotte-katakuri',
  },
  'ST21': {
    fr: '/series/st21-deck-de-demarrage-ex-gear-5th',
    en: '/series/en-st21-starter-deck-ex-gear-5th',
  },
  'ST22': {
    fr: '/series/st22-deck-de-demarrage-ace-et-newgate',
    en: '/series/st22-starter-deck-ace-and-newgate',
  },
  'ST23': {
    fr: '/series/st23-deck-pour-debutant-shanks',
    en: '/series/st23-starter-deck-shanks',
  },
  'ST24': {
    fr: '/series/st24-deck-pour-debutant-jewelry-bonney',
    en: '/series/st24-starter-deck-jewelry-bonney',
  },
  'ST25': {
    fr: '/series/st25-deck-pour-debutant-baggy',
    en: '/series/st25-starter-deck-buggy',
  },
  'ST26': {
    fr: '/series/st26-deck-pour-debutant-monkey-d-luffy',
    en: '/series/st26-starter-deck-monkey-d-luffy',
  },
  'ST27': {
    fr: '/series/st27-deck-pour-debutant-marshall-d-teach',
    en: '/series/st27-starter-deck-marshall-d-teach',
  },
  'ST28': {
    fr: '/series/st28-deck-pour-debutant-yamato',
    en: '/series/st28-starter-deck-yamato',
  },

  // ============================================
  // PREMIUM COLLECTIONS (PRB)
  // ============================================
  'PRB01': {
    fr: '/series/prb01-one-piece-card-the-best-fr',
    en: '/series/prb01-one-piece-card-the-best',
  },
  'PRB02': {
    fr: '/series/prb02-fr-one-piece-card-the-best-volume-2',
    en: '/series/prb02-one-piece-card-the-best-volume-2',
  },

  // ============================================
  // SPECIAL EDITIONS (EB)
  // ============================================
  'EB01': {
    en: '/series/eb01-memorial-collection',
  },
  'EB02': {
    fr: '/series/eb02-anime-25th-collection',
    en: '/series/en-eb02-anime-25th-collection',
  },

  // ============================================
  // PROMOTIONAL CARDS
  // ============================================
  'P': {
    fr: '/series/p-cartes-promotionnelles',
    en: '/series/p-cartes-promotion',
    // jp: plusieurs pages spéciales
  },
  'STP': {
    fr: '/series/stp-tournoi-boutique-promo',
    en: '/series/stp-store-tournament-promo',
  },

  // ============================================
  // AUTRES SÉRIES SPÉCIALES (à ajouter si nécessaire)
  // ============================================
  // Ces séries existent sur opecards.fr mais ne sont pas dans notre config
  /*
  'STCH': { en: '/series/stch-store-championship' },
  'CH2023': { en: '/series/ch2023-championship-2023' },
  'CH2024': { en: '/series/ch2024-championship-2024' },
  'CH2526': { en: '/series/ch2526-championship-25-26' },
  'ONR2024': { en: '/series/onr2024-online-regionals-2024' },
  'ONR2526': { en: '/series/onr2526-online-regionals-2526' },
  'OFFR2024': { en: '/series/offr2024-offline-regionals-2024' },
  'OFFR2526': { en: '/series/offr2526-offline-regionals-25-26' },
  'TC': { en: '/series/tc-treasure-cup' },
  '3ON3CUP': { en: '/series/3on3cup' },
  */
}

/**
 * Récupère l'URL directe d'une série pour une langue donnée
 */
export function getSeriesUrl(seriesCode: string, language: 'fr' | 'en' | 'jp'): string | null {
  const urls = ONEPIECE_SERIES_URLS[seriesCode.toUpperCase()]
  if (!urls) return null
  return urls[language] ? `${BASE_URL}${urls[language]}` : null
}

/**
 * Récupère toutes les langues disponibles pour une série
 */
export function getAvailableLanguagesFromUrls(seriesCode: string): ('fr' | 'en' | 'jp')[] {
  const urls = ONEPIECE_SERIES_URLS[seriesCode.toUpperCase()]
  if (!urls) return []

  const langs: ('fr' | 'en' | 'jp')[] = []
  if (urls.fr) langs.push('fr')
  if (urls.en) langs.push('en')
  if (urls.jp) langs.push('jp')
  return langs
}

/**
 * Vérifie si une série a une URL configurée pour une langue
 */
export function hasSeriesUrl(seriesCode: string, language: 'fr' | 'en' | 'jp'): boolean {
  const urls = ONEPIECE_SERIES_URLS[seriesCode.toUpperCase()]
  if (!urls) return false
  return !!urls[language]
}
