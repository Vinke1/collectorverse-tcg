/**
 * Magic: The Gathering type definitions
 */

/**
 * Scryfall card object (simplified)
 * Full spec: https://scryfall.com/docs/api/cards
 */
export interface ScryfallCard {
  // Identifiers
  id: string
  oracle_id?: string
  multiverse_ids?: number[]
  mtgo_id?: number
  arena_id?: number
  tcgplayer_id?: number
  cardmarket_id?: number

  // Core fields
  name: string
  lang: string
  released_at?: string
  layout: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  colors?: string[]
  color_identity?: string[]
  keywords?: string[]

  // Print fields
  set: string
  set_name: string
  set_type: string
  collector_number: string
  rarity: string
  artist?: string
  booster?: boolean

  // Multilingual fields
  printed_name?: string
  printed_type_line?: string
  printed_text?: string

  // Images
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]

  // Finishes
  finishes?: string[]
  foil?: boolean
  nonfoil?: boolean

  // Legality
  legalities?: Record<string, string>

  // Game data
  games?: string[]
  reserved?: boolean
  reprint?: boolean
  variation?: boolean
  digital?: boolean
  promo?: boolean
}

export interface ScryfallImageUris {
  small?: string
  normal?: string
  large?: string
  png?: string
  art_crop?: string
  border_crop?: string
}

export interface ScryfallCardFace {
  name: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  power?: string
  toughness?: string
  loyalty?: string
  colors?: string[]
  artist?: string
  illustration_id?: string
  image_uris?: ScryfallImageUris
  printed_name?: string
  printed_type_line?: string
  printed_text?: string
}

/**
 * Scryfall set object
 */
export interface ScryfallSet {
  id: string
  code: string
  name: string
  set_type: string
  released_at?: string
  card_count: number
  digital: boolean
  foil_only: boolean
  nonfoil_only: boolean
  icon_svg_uri?: string
  scryfall_uri?: string
  parent_set_code?: string
}

/**
 * Scryfall bulk data info
 */
export interface ScryfallBulkDataInfo {
  id: string
  type: string
  name: string
  description: string
  download_uri: string
  updated_at: string
  size: number
  content_type: string
  content_encoding: string
}

/**
 * Magic card attributes stored in JSONB
 */
export interface MagicAttributes {
  /** Scryfall UUID */
  scryfall_id: string

  /** Mana cost string (e.g., "{2}{U}{R}") */
  mana_cost?: string

  /** Converted mana cost / Mana value */
  cmc?: number

  /** Full type line (e.g., "Creature — Vampire Noble") */
  type_line?: string

  /** Oracle rules text */
  oracle_text?: string

  /** Creature power */
  power?: string

  /** Creature toughness */
  toughness?: string

  /** Planeswalker loyalty */
  loyalty?: string

  /** Card colors (W, U, B, R, G) */
  colors?: string[]

  /** Color identity for Commander */
  color_identity?: string[]

  /** Keyword abilities */
  keywords?: string[]

  /** Card layout (normal, transform, modal_dfc, etc.) */
  layout?: string

  /** Artist name */
  artist?: string

  /** Set type (expansion, core, masters, etc.) */
  set_type?: string

  /** Available as foil */
  foil?: boolean

  /** Available as non-foil */
  nonfoil?: boolean

  /** Is a promo card */
  promo?: boolean

  /** Is a reprint */
  reprint?: boolean

  /** Is digital only */
  digital?: boolean

  /** Format legalities */
  legalities?: Record<string, string>

  /** For multi-face cards: face index (0 or 1) */
  face_index?: number

  /** For multi-face cards: total faces */
  total_faces?: number
}

/**
 * Parsed card data ready for database insertion
 */
export interface ParsedMagicCard {
  name: string
  number: string
  language: string
  rarity: string
  imageUrl: string | null
  attributes: MagicAttributes
  setCode: string
  setName: string
}

/**
 * Progress tracking for seed script
 */
export interface MagicSeedProgress {
  startedAt: string
  lastUpdated: string
  status: 'in_progress' | 'completed' | 'failed'
  totalSets: number
  processedSets: number
  totalCards: number
  processedCards: number
  processedSetCodes: string[]
  currentSet: string | null
  languages: string[]
  errors: MagicSeedError[]
}

/**
 * Error entry for logging
 */
export interface MagicSeedError {
  timestamp: string
  type: 'api' | 'image_download' | 'image_upload' | 'database' | 'parse'
  setCode?: string
  cardNumber?: string
  language?: string
  scryfallId?: string
  message: string
  details?: string
}

/**
 * Bulk data grouped by set
 */
export interface CardsBySet {
  [setCode: string]: ScryfallCard[]
}

/**
 * Set info with card counts per language
 */
export interface SetInfo {
  code: string
  name: string
  releaseDate: string | null
  setType: string
  cardCount: number
  cardsByLanguage: Record<string, number>
}
