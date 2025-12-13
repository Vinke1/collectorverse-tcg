/**
 * Centralized rarity configuration for all TCGs
 */

export interface RarityConfig {
  id: string
  short: string
  icon: string
  aliases: string[] // All possible variations of this rarity name in the database
}

/**
 * Rarity groups - rarities that should appear together in filters
 * When one is present, all in the group should be shown
 */
export const RARITY_GROUPS: Record<string, string[]> = {
  promo: ['promo', 'dlc', 'd23'], // promo, dlc and d23 are linked
}

/**
 * Lorcana rarity definitions with all aliases and icons
 */
export const LORCANA_RARITIES: Record<string, RarityConfig> = {
  common: {
    id: 'common',
    short: 'C',
    icon: '/images/icons/rarities/common.webp',
    aliases: ['common', 'commune']
  },
  uncommon: {
    id: 'uncommon',
    short: 'UC',
    icon: '/images/icons/rarities/uncommon.webp',
    aliases: ['uncommon', 'peu commune']
  },
  rare: {
    id: 'rare',
    short: 'R',
    icon: '/images/icons/rarities/rare.webp',
    aliases: ['rare']
  },
  'super-rare': {
    id: 'super-rare',
    short: 'SR',
    icon: '/images/icons/rarities/super-rare.webp',
    aliases: ['super rare', 'super-rare']
  },
  legendary: {
    id: 'legendary',
    short: 'L',
    icon: '/images/icons/rarities/legendary.webp',
    aliases: ['legendary', 'légendaire', 'legendaire']
  },
  enchanted: {
    id: 'enchanted',
    short: 'E',
    icon: '/images/icons/rarities/enchanted.webp',
    aliases: ['enchanted', 'enchantée', 'enchantee']
  },
  epic: {
    id: 'epic',
    short: 'EP',
    icon: '/images/icons/rarities/epic.webp',
    aliases: ['epic', 'épique', 'epique']
  },
  iconic: {
    id: 'iconic',
    short: 'IC',
    icon: '/images/icons/rarities/iconic.webp',
    aliases: ['iconic', 'iconique']
  },
  d23: {
    id: 'd23',
    short: 'D23',
    icon: '/images/icons/rarities/d23.webp',
    aliases: ['d23']
  },
  es: {
    id: 'es',
    short: 'ES',
    icon: '/images/icons/rarities/es.webp',
    aliases: ['es']
  },
  gencon: {
    id: 'gencon',
    short: 'GC',
    icon: '/images/icons/rarities/gencon.webp',
    aliases: ['gencon']
  },
  gamescom: {
    id: 'gamescom',
    short: 'GS',
    icon: '/images/icons/rarities/gamescom.webp',
    aliases: ['gamescom']
  },
  d100: {
    id: 'd100',
    short: 'D100',
    icon: '/images/icons/rarities/d100.webp',
    aliases: ['d100']
  },
  promo: {
    id: 'promo',
    short: 'PR',
    icon: '/images/icons/rarities/promo.webp',
    aliases: ['promo']
  },
  s: {
    id: 's',
    short: 'S',
    icon: '/images/icons/rarities/s.webp',
    aliases: ['spéciale', 'speciale', 'special']
  },
  dlc: {
    id: 'dlc',
    short: 'DLC',
    icon: '/images/icons/rarities/dlc.webp',
    aliases: ['dlc']
  },
  parc: {
    id: 'parc',
    short: 'PC',
    icon: '/images/icons/rarities/parc.webp',
    aliases: ['parc']
  },
  cruise: {
    id: 'cruise',
    short: 'CR',
    icon: '/images/icons/rarities/cruise.webp',
    aliases: ['cruise', 'croisière', 'croisiere']
  }
}

/**
 * Naruto Kayou rarity definitions
 * Source: https://narutopia.fr/liste-des-cartes-naruto-kayou/
 */
export const NARUTO_KAYOU_RARITIES: Record<string, RarityConfig> = {
  'naruto-rare': {
    id: 'naruto-rare',
    short: 'R',
    icon: '/images/icons/rarities/naruto/r.webp',
    aliases: ['r']
  },
  'naruto-super-rare': {
    id: 'naruto-super-rare',
    short: 'SR',
    icon: '/images/icons/rarities/naruto/sr.webp',
    aliases: ['sr']
  },
  'super-super-rare': {
    id: 'super-super-rare',
    short: 'SSR',
    icon: '/images/icons/rarities/naruto/ssr.webp',
    aliases: ['ssr', 'super-super-rare', 'super super rare']
  },
  'treasure-rare': {
    id: 'treasure-rare',
    short: 'TR',
    icon: '/images/icons/rarities/naruto/tr.webp',
    aliases: ['tr', 'treasure-rare', 'treasure rare']
  },
  'treasure-gold-rare': {
    id: 'treasure-gold-rare',
    short: 'TGR',
    icon: '/images/icons/rarities/naruto/tgr.webp',
    aliases: ['tgr', 'treasure-gold-rare', 'treasure gold rare']
  },
  'hyper-rare': {
    id: 'hyper-rare',
    short: 'HR',
    icon: '/images/icons/rarities/naruto/hr.webp',
    aliases: ['hr', 'hyper-rare', 'hyper rare']
  },
  'ultra-rare': {
    id: 'ultra-rare',
    short: 'UR',
    icon: '/images/icons/rarities/naruto/ur.webp',
    aliases: ['ur', 'ultra-rare', 'ultra rare']
  },
  'z-rare': {
    id: 'z-rare',
    short: 'ZR',
    icon: '/images/icons/rarities/naruto/zr.webp',
    aliases: ['zr', 'z-rare', 'z rare']
  },
  'another-rare': {
    id: 'another-rare',
    short: 'AR',
    icon: '/images/icons/rarities/naruto/ar.webp',
    aliases: ['ar', 'another-rare', 'another rare']
  },
  'origin-rare': {
    id: 'origin-rare',
    short: 'OR',
    icon: '/images/icons/rarities/naruto/or.webp',
    aliases: ['or', 'origin-rare', 'origin rare']
  },
  'super-legend-rare': {
    id: 'super-legend-rare',
    short: 'SLR',
    icon: '/images/icons/rarities/naruto/slr.webp',
    aliases: ['slr', 'super-legend-rare', 'super legend rare']
  },
  'ptr': {
    id: 'ptr',
    short: 'PTR',
    icon: '/images/icons/rarities/naruto/ptr.webp',
    aliases: ['ptr']
  },
  'pu': {
    id: 'pu',
    short: 'PU',
    icon: '/images/icons/rarities/naruto/pu.webp',
    aliases: ['pu']
  },
  'campaign': {
    id: 'campaign',
    short: 'CP',
    icon: '/images/icons/rarities/naruto/cp.webp',
    aliases: ['cp', 'campaign']
  },
  'naruto-special': {
    id: 'naruto-special',
    short: 'SP',
    icon: '/images/icons/rarities/naruto/sp.webp',
    aliases: ['sp']
  },
  'master-rare': {
    id: 'master-rare',
    short: 'MR',
    icon: '/images/icons/rarities/naruto/mr.webp',
    aliases: ['mr', 'master-rare', 'master rare']
  },
  'gp': {
    id: 'gp',
    short: 'GP',
    icon: '/images/icons/rarities/naruto/gp.webp',
    aliases: ['gp']
  },
  'naruto-cr': {
    id: 'naruto-cr',
    short: 'CR',
    icon: '/images/icons/rarities/naruto/cr.webp',
    aliases: ['naruto-cr']
  },
  'nr': {
    id: 'nr',
    short: 'NR',
    icon: '/images/icons/rarities/naruto/nr.webp',
    aliases: ['nr']
  },
  'bp': {
    id: 'bp',
    short: 'BP',
    icon: '/images/icons/rarities/naruto/bp.webp',
    aliases: ['bp']
  },
  'se': {
    id: 'se',
    short: 'SE',
    icon: '/images/icons/rarities/naruto/se.webp',
    aliases: ['se']
  },
  'sv': {
    id: 'sv',
    short: 'SV',
    icon: '/images/icons/rarities/naruto/sv.webp',
    aliases: ['sv']
  },
  'sv-gold': {
    id: 'sv-gold',
    short: 'SVG',
    icon: '/images/icons/rarities/naruto/sv-gold.webp',
    aliases: ['sv-gold', 'svg']
  },
  'secret-rare': {
    id: 'secret-rare',
    short: 'SCR',
    icon: '/images/icons/rarities/naruto/scr.webp',
    aliases: ['scr', 'secret-rare', 'secret rare']
  },
  'legend-rare': {
    id: 'legend-rare',
    short: 'LR',
    icon: '/images/icons/rarities/naruto/lr.webp',
    aliases: ['lr', 'legend-rare', 'legend rare']
  },
  'naruto-promo': {
    id: 'naruto-promo',
    short: 'PR',
    icon: '/images/icons/rarities/naruto/pr.webp',
    aliases: ['pr']
  },
  'br': {
    id: 'br',
    short: 'BR',
    icon: '/images/icons/rarities/naruto/br.webp',
    aliases: ['br']
  }
}

/**
 * Get all rarity configs as an array
 */
export function getAllRarities(): RarityConfig[] {
  return Object.values(LORCANA_RARITIES)
}

/**
 * Get all Naruto Kayou rarity configs as an array
 */
export function getAllNarutoRarities(): RarityConfig[] {
  return Object.values(NARUTO_KAYOU_RARITIES)
}

/**
 * Normalizes a rarity name from the database to its standard ID
 * @param rarity - The rarity name to normalize (case-insensitive)
 * @returns The normalized rarity ID or null if not found
 */
export function normalizeRarity(rarity: string): string | null {
  if (!rarity) return null

  const normalized = rarity.toLowerCase().trim()

  // Check Lorcana rarities first
  for (const [id, config] of Object.entries(LORCANA_RARITIES)) {
    if (config.aliases.some(alias => alias.toLowerCase() === normalized)) {
      return id
    }
  }

  // Check Naruto Kayou rarities
  for (const [id, config] of Object.entries(NARUTO_KAYOU_RARITIES)) {
    if (config.aliases.some(alias => alias.toLowerCase() === normalized)) {
      return id
    }
  }

  return null
}

/**
 * Get rarity configuration by ID
 * @param rarityId - The rarity ID to look up
 * @returns The rarity config or undefined if not found
 */
export function getRarityConfig(rarityId: string): RarityConfig | undefined {
  return LORCANA_RARITIES[rarityId] || NARUTO_KAYOU_RARITIES[rarityId]
}

/**
 * Check if a rarity value matches any of the given rarity IDs
 * Handles grouped rarities (e.g., selecting 'dlc' will also match 'promo' cards)
 * @param cardRarity - The rarity value from the card (from database)
 * @param selectedRarities - Array of selected rarity IDs to match against
 * @returns True if the card rarity matches any of the selected rarities
 */
export function matchesRarity(cardRarity: string, selectedRarities: string[]): boolean {
  const normalizedCardRarity = normalizeRarity(cardRarity)
  if (!normalizedCardRarity) return false

  // Direct match
  if (selectedRarities.includes(normalizedCardRarity)) return true

  // Check grouped rarities (e.g., 'dlc' selection should match 'promo' cards)
  for (const [groupKey, groupMembers] of Object.entries(RARITY_GROUPS)) {
    const cardInGroup = groupMembers.includes(normalizedCardRarity)
    const selectionInGroup = selectedRarities.some(r => groupMembers.includes(r))
    if (cardInGroup && selectionInGroup) return true
  }

  return false
}

/**
 * Extract all unique rarity IDs from a list of cards
 * Includes grouped rarities (e.g., if 'promo' is present, 'dlc' will also be included)
 * @param cards - Array of cards with rarity field
 * @returns Array of unique rarity IDs present in the cards
 */
export function extractAvailableRarities(cards: Array<{ rarity: string | null }>): string[] {
  const raritySet = new Set<string>()

  cards.forEach((card) => {
    if (card.rarity) {
      const normalizedRarity = normalizeRarity(card.rarity)
      if (normalizedRarity) {
        raritySet.add(normalizedRarity)
      }
    }
  })

  // Add grouped rarities (e.g., if 'promo' is present, add 'dlc' too)
  for (const [groupKey, groupMembers] of Object.entries(RARITY_GROUPS)) {
    const hasGroupMember = groupMembers.some(member => raritySet.has(member))
    if (hasGroupMember) {
      groupMembers.forEach(member => raritySet.add(member))
    }
  }

  return Array.from(raritySet)
}
