/**
 * Configuration des raretés Naruto Kayou
 * Source: https://narutopia.fr/liste-des-cartes-naruto-kayou/
 *
 * Ces données sont basées sur l'analyse de Narutopia.fr
 * Total: ~1853 cartes réparties en 25 raretés
 */

export interface NarutoKayouRarity {
  code: string           // Code de la rareté (R, SR, SSR, etc.)
  name: string           // Nom complet de la rareté
  count: number          // Nombre total de cartes
  urlPattern: 'simple' | 'series' | 'variant' | 'special'  // Type de pattern URL
  seriesPrefix?: string  // Préfixe de série (ex: "NRZ06" pour PTR/PU)
  variant?: string       // Variante (ex: "GOLD" pour SV-GOLD)
  paddingStyle: 'none' | 'padded'  // Style de numérotation (37 vs 037)
  uploadDate: string     // Date approximative d'upload (année/mois)
}

/**
 * Base URL pour les images Narutopia
 */
export const NARUTOPIA_BASE_URL = 'https://narutopia.fr/wp-content/uploads'

/**
 * Configuration complète des raretés Naruto Kayou
 * Triées par ordre de rareté croissante
 */
export const NARUTO_KAYOU_RARITIES: NarutoKayouRarity[] = [
  // Raretés de base
  {
    code: 'R',
    name: 'Rare',
    count: 210,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/08'
  },
  {
    code: 'SR',
    name: 'Super Rare',
    count: 148,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },
  {
    code: 'SSR',
    name: 'Super Super Rare',
    count: 189,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },

  // Raretés spéciales
  {
    code: 'TR',
    name: 'TGR (Treasure Gold Rare)',
    count: 62,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },
  {
    code: 'TGR',
    name: 'TGR (Treasure Gold Rare)',
    count: 44,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },
  {
    code: 'HR',
    name: 'Hyper Rare',
    count: 220,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },
  {
    code: 'UR',
    name: 'Ultra Rare',
    count: 153,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/06'
  },
  {
    code: 'ZR',
    name: 'Z Rare',
    count: 36,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/07'
  },
  {
    code: 'AR',
    name: 'Another Rare',
    count: 80,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'OR',
    name: 'Origin Rare',
    count: 111,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },
  {
    code: 'SLR',
    name: 'Super Legend Rare',
    count: 120,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/05'
  },

  // Raretés avec séries
  {
    code: 'PTR',
    name: 'PTR (NRZ06)',
    count: 20,
    urlPattern: 'series',
    seriesPrefix: 'NRZ06',
    paddingStyle: 'padded',
    uploadDate: '2024/09'
  },
  {
    code: 'PU',
    name: 'PU (NRZ06)',
    count: 8,
    urlPattern: 'series',
    seriesPrefix: 'NRZ06',
    paddingStyle: 'padded',
    uploadDate: '2024/09'
  },

  // Autres raretés
  {
    code: 'CP',
    name: 'Campaign',
    count: 10,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'SP',
    name: 'Special',
    count: 84,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/06'
  },
  {
    code: 'MR',
    name: 'Master Rare',
    count: 72,
    urlPattern: 'simple',
    paddingStyle: 'none',
    uploadDate: '2023/06'
  },
  {
    code: 'GP',
    name: 'GP',
    count: 24,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'CR',
    name: 'CR',
    count: 26,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'NR',
    name: 'NR',
    count: 23,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'BP',
    name: 'BP',
    count: 34,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'SE',
    name: 'SE',
    count: 18,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },

  // Raretés avec variantes
  {
    code: 'SV',
    name: 'SV',
    count: 20,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'SV-GOLD',
    name: 'SV Gold',
    count: 10, // Estimation basée sur les variantes GOLD
    urlPattern: 'variant',
    variant: 'GOLD',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },

  // Raretés très rares
  {
    code: 'SCR',
    name: 'Secret Rare',
    count: 2,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },
  {
    code: 'LR',
    name: 'Legend Rare',
    count: 6,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/05'
  },

  // Promos et spéciaux
  {
    code: 'PR',
    name: 'Promo',
    count: 56,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/10'
  },
  {
    code: 'BR',
    name: 'BR',
    count: 16,
    urlPattern: 'simple',
    paddingStyle: 'padded',
    uploadDate: '2023/08'
  }
]

/**
 * Calcul du total des cartes
 */
export const TOTAL_NARUTO_KAYOU_CARDS = NARUTO_KAYOU_RARITIES.reduce(
  (sum, rarity) => sum + rarity.count,
  0
)

/**
 * Génère l'URL d'une image de carte Naruto Kayou
 * @param rarity Configuration de la rareté
 * @param cardNumber Numéro de la carte
 * @returns URL de l'image (full-size, sans dimension)
 */
export function buildNarutoCardImageUrl(rarity: NarutoKayouRarity, cardNumber: number): string[] {
  const urls: string[] = []
  const baseUrl = `${NARUTOPIA_BASE_URL}/${rarity.uploadDate}`

  // Générer les deux formats de numérotation (avec et sans padding)
  const numPadded = cardNumber.toString().padStart(3, '0')
  const numSimple = cardNumber.toString()

  switch (rarity.urlPattern) {
    case 'simple':
      // Pattern: R-37.webp ou R-037.webp
      if (rarity.paddingStyle === 'padded') {
        urls.push(`${baseUrl}/${rarity.code}-${numPadded}.webp`)
      } else {
        urls.push(`${baseUrl}/${rarity.code}-${numSimple}.webp`)
        // Aussi tester avec padding au cas où
        urls.push(`${baseUrl}/${rarity.code}-${numPadded}.webp`)
      }
      break

    case 'series':
      // Pattern: NRZ06-PTR-008.webp
      urls.push(`${baseUrl}/${rarity.seriesPrefix}-${rarity.code}-${numPadded}.webp`)
      break

    case 'variant':
      // Pattern: SV-GOLD-004.webp
      urls.push(`${baseUrl}/${rarity.code.split('-')[0]}-${rarity.variant}-${numPadded}.webp`)
      break

    case 'special':
      // Les cartes spéciales ont des noms uniques
      urls.push(`${baseUrl}/${rarity.code}-${numPadded}.webp`)
      break
  }

  return urls
}

/**
 * Liste des dates d'upload connues pour tester les différentes années/mois
 */
export const KNOWN_UPLOAD_DATES = [
  '2023/05',
  '2023/06',
  '2023/07',
  '2023/08',
  '2023/09',
  '2023/10',
  '2023/11',
  '2023/12',
  '2024/01',
  '2024/02',
  '2024/03',
  '2024/04',
  '2024/05',
  '2024/06',
  '2024/07',
  '2024/08',
  '2024/09',
  '2024/10',
  '2024/11'
]

/**
 * Génère toutes les URLs possibles pour une carte (avec différentes dates)
 * @param rarityCode Code de la rareté
 * @param cardNumber Numéro de la carte
 * @returns Liste des URLs à tester
 */
export function generateAllPossibleUrls(rarityCode: string, cardNumber: number): string[] {
  const urls: string[] = []
  const numPadded = cardNumber.toString().padStart(3, '0')
  const numSimple = cardNumber.toString()

  // Tester les différentes dates d'upload connues
  for (const date of KNOWN_UPLOAD_DATES) {
    const baseUrl = `${NARUTOPIA_BASE_URL}/${date}`

    // Pattern simple sans padding
    urls.push(`${baseUrl}/${rarityCode}-${numSimple}.webp`)

    // Pattern simple avec padding
    urls.push(`${baseUrl}/${rarityCode}-${numPadded}.webp`)

    // Pattern série (pour PTR, PU)
    if (rarityCode === 'PTR' || rarityCode === 'PU') {
      urls.push(`${baseUrl}/NRZ06-${rarityCode}-${numPadded}.webp`)
    }

    // Pattern variante (pour SV-GOLD)
    if (rarityCode === 'SV-GOLD') {
      urls.push(`${baseUrl}/SV-GOLD-${numPadded}.webp`)
    }
  }

  return [...new Set(urls)] // Supprimer les doublons
}

/**
 * Mapping des raretés pour la base de données
 */
export const NARUTO_RARITY_DB_MAPPING: Record<string, string> = {
  'R': 'rare',
  'SR': 'super-rare',
  'SSR': 'super-super-rare',
  'TR': 'treasure-rare',
  'TGR': 'treasure-gold-rare',
  'HR': 'hyper-rare',
  'UR': 'ultra-rare',
  'ZR': 'z-rare',
  'AR': 'another-rare',
  'OR': 'origin-rare',
  'SLR': 'super-legend-rare',
  'PTR': 'ptr',
  'PU': 'pu',
  'CP': 'campaign',
  'SP': 'special',
  'MR': 'master-rare',
  'GP': 'gp',
  'CR': 'cr',
  'NR': 'nr',
  'BP': 'bp',
  'SE': 'se',
  'SV': 'sv',
  'SV-GOLD': 'sv-gold',
  'SCR': 'secret-rare',
  'LR': 'legend-rare',
  'PR': 'promo',
  'BR': 'br'
}
