/**
 * TCG-specific attributes configuration (inks, types, colors, aspects, etc.)
 */

export interface AttributeConfig {
  id: string
  icon: string
  label?: string
  hexColor?: string
}

/**
 * Lorcana Inks configuration
 */
export const LORCANA_INKS: AttributeConfig[] = [
  { id: 'amber', icon: '/images/icons/inks/amber.webp' },
  { id: 'amethyst', icon: '/images/icons/inks/amethyst.webp' },
  { id: 'emerald', icon: '/images/icons/inks/emerald.webp' },
  { id: 'ruby', icon: '/images/icons/inks/ruby.webp' },
  { id: 'sapphire', icon: '/images/icons/inks/sapphire.webp' },
  { id: 'steel', icon: '/images/icons/inks/steel.webp' }
]

/**
 * Pokemon Types configuration (placeholder)
 */
export const POKEMON_TYPES: AttributeConfig[] = []

/**
 * One Piece Colors configuration (placeholder)
 */
export const ONEPIECE_COLORS: AttributeConfig[] = []

/**
 * Star Wars Unlimited Aspects configuration
 */
export const STARWARS_ASPECTS: AttributeConfig[] = [
  { id: 'vigilance', icon: '/images/icons/aspects/vigilance.webp', label: 'Vigilance', hexColor: '#3B82F6' },
  { id: 'command', icon: '/images/icons/aspects/command.webp', label: 'Commandement', hexColor: '#22C55E' },
  { id: 'aggression', icon: '/images/icons/aspects/aggression.webp', label: 'Agression', hexColor: '#EF4444' },
  { id: 'cunning', icon: '/images/icons/aspects/cunning.webp', label: 'Ruse', hexColor: '#F59E0B' },
  { id: 'villainy', icon: '/images/icons/aspects/villainy.webp', label: 'Infâmie', hexColor: '#6B21A8' },
  { id: 'heroism', icon: '/images/icons/aspects/heroism.webp', label: 'Héroïsme', hexColor: '#0EA5E9' },
]

/**
 * TCG Filters configuration mapping
 */
export const TCG_FILTERS: Record<string, {
  attributes?: AttributeConfig[]
  attributeLabel?: string
}> = {
  lorcana: {
    attributes: LORCANA_INKS,
    attributeLabel: 'Encres'
  },
  pokemon: {
    attributes: POKEMON_TYPES,
    attributeLabel: 'Types'
  },
  onepiece: {
    attributes: ONEPIECE_COLORS,
    attributeLabel: 'Couleurs'
  },
  riftbound: {
    // No specific attributes yet
  },
  naruto: {
    // No specific attributes yet
  },
  starwars: {
    attributes: STARWARS_ASPECTS,
    attributeLabel: 'Aspects'
  }
}

/**
 * Get attributes configuration for a specific TCG
 * @param tcgSlug - The TCG slug (lorcana, pokemon, onepiece, etc.)
 * @returns Array of attribute configs or undefined
 */
export function getTCGAttributes(tcgSlug: string): AttributeConfig[] | undefined {
  return TCG_FILTERS[tcgSlug]?.attributes
}

/**
 * Get attribute label for a specific TCG
 * @param tcgSlug - The TCG slug
 * @returns The label for the attribute type (e.g., 'Encres', 'Types', 'Couleurs')
 */
export function getTCGAttributeLabel(tcgSlug: string): string | undefined {
  return TCG_FILTERS[tcgSlug]?.attributeLabel
}
