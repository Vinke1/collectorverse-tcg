/**
 * Shared type definitions for cards
 */

/**
 * Riftbound-specific card attributes
 */
export interface RiftboundAttributes {
  is_foil?: boolean
  cost?: number
  power?: number
  health?: number
  cardType?: string
  region?: string
}

/**
 * Union type for all card attributes
 */
export type CardAttributes =
  | LorcanaAttributes
  | PokemonAttributes
  | OnePieceAttributes
  | StarWarsAttributes
  | RiftboundAttributes
  | Record<string, unknown>

/**
 * Base card interface matching the database schema
 */
export interface Card {
  id: string
  name: string
  number: string
  language: string | null
  chapter: number | null
  rarity: string | null
  image_url: string | null
  attributes: CardAttributes | null
  series_id?: string
  created_at?: string
  updated_at?: string
}

/**
 * Card with series information
 */
export interface CardWithSeries extends Card {
  series?: {
    id: string
    name: string
    code: string
    max_set_base: number | null
    master_set: number | null
    image_url: string | null
    tcg_game_id: string
  }
}

/**
 * Minimal card interface for filtering and sorting
 */
export interface CardItem {
  id: string
  name: string
  number: string
  language: string | null
  chapter: number | null
  rarity: string | null
  image_url: string | null
  attributes: CardAttributes | null
}

/**
 * Lorcana-specific card attributes
 */
export interface LorcanaAttributes {
  slug?: string
  ink?: string
  cost?: number
  strength?: number
  willpower?: number
  lore?: number
  cardType?: string
  classifications?: string[]
  abilities?: Array<{
    name: string
    text: string
    type: string
  }>
}

/**
 * Pokemon-specific card attributes (placeholder)
 */
export interface PokemonAttributes {
  type?: string[]
  hp?: number
  attacks?: Array<{
    name: string
    damage: string
    cost: string[]
  }>
  weakness?: string
  resistance?: string
  retreatCost?: number
}

/**
 * One Piece-specific card attributes (placeholder)
 */
export interface OnePieceAttributes {
  color?: string[]
  cost?: number
  power?: number
  counter?: number
  cardType?: string
  life?: number
}

/**
 * Star Wars Unlimited-specific card attributes
 */
export interface StarWarsAttributes {
  // Informations générales
  cardType?: string           // LEADER, UNIT, EVENT, UPGRADE, BASE
  arenas?: string[]           // ground, space
  aspects?: string[]          // vigilance, command, aggression, cunning, villainy, heroism
  illustrator?: string

  // Face Avant
  characters?: string[]       // Personnages
  traits?: string[]           // Officiel, République, Sith, etc.
  cost?: number
  power?: number
  hp?: number                 // Points de vie

  // Identifiants
  publicCode?: string         // "SEC•FR - 001/264 - S"
  slug?: string

  // Variantes
  variant?: string            // 'standard' | 'hyperspace' | 'showcase'
  isFoil?: boolean            // Si la carte est uniquement en foil
}
