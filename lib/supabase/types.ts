export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tcg_games: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          gradient: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tcg_games"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tcg_games"]["Insert"]>;
      };
      domains: {
        Row: {
          id: string;
          tcg_game_id: string;
          name: string;
          code: string;
          icon_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["domains"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["domains"]["Insert"]>;
      };
      card_types: {
        Row: {
          id: string;
          tcg_game_id: string;
          name: string;
          code: string;
          is_supertype: boolean;
          icon_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["card_types"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["card_types"]["Insert"]>;
      };
      rarities: {
        Row: {
          id: string;
          tcg_game_id: string;
          name: string;
          code: string;
          sort_order: number;
          icon_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rarities"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["rarities"]["Insert"]>;
      };
      series: {
        Row: {
          id: string;
          tcg_game_id: string;
          name: string;
          code: string;
          release_date: string | null;
          max_set_base: number;
          master_set: number | null;
          image_url: string | null;
          // Pokemon-specific fields
          pokemon_series_id: string | null;
          tcgdex_id: string | null;
          symbol_url: string | null;
          official_card_count: number | null;
          total_card_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["series"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["series"]["Insert"]>;
      };
      series_releases: {
        Row: {
          id: string;
          series_id: string;
          region: string;
          release_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["series_releases"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["series_releases"]["Insert"]>;
      };
      series_translations: {
        Row: {
          id: string;
          series_id: string;
          language: string;
          name: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["series_translations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["series_translations"]["Insert"]>;
      };
      pokemon_series: {
        Row: {
          id: string;
          tcg_game_id: string;
          code: string;
          name: string;
          logo_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pokemon_series"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pokemon_series"]["Insert"]>;
      };
      pokemon_types: {
        Row: {
          id: string;
          tcg_game_id: string;
          code: string;
          sort_order: number;
          icon_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pokemon_types"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pokemon_types"]["Insert"]>;
      };
      pokemon_type_translations: {
        Row: {
          id: string;
          pokemon_type_id: string;
          language: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pokemon_type_translations"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["pokemon_type_translations"]["Insert"]>;
      };
      cards: {
        Row: {
          id: string;
          series_id: string;
          name: string;
          number: string;
          language: string | null;
          chapter: number | null;
          rarity: string | null;
          image_url: string | null;
          attributes: Json | null;
          // Pokemon-specific fields
          tcgdex_id: string | null;
          category: string | null;
          illustrator: string | null;
          hp: number | null;
          regulation_mark: string | null;
          has_holo: boolean;
          has_reverse: boolean;
          has_normal: boolean;
          has_first_edition: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cards"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["cards"]["Insert"]>;
      };
      user_collections: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          owned: boolean;
          quantity: number;
          quantity_foil: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_collections"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_collections"]["Insert"]>;
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          priority: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["wishlists"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["wishlists"]["Insert"]>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          language: string;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
      };
      collection_shares: {
        Row: {
          id: string;
          user_id: string;
          series_id: string;
          token: string;
          expires_at: string;
          created_at: string;
          views_count: number;
        };
        Insert: Omit<Database["public"]["Tables"]["collection_shares"]["Row"], "id" | "created_at" | "views_count">;
        Update: Partial<Database["public"]["Tables"]["collection_shares"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// ============================================
// POKEMON-SPECIFIC TYPES
// ============================================

/** Structure des attributs JSONB pour une carte Pokémon */
export interface PokemonCardAttributes {
  // Données de base
  dexId?: number[];
  stage?: string;
  evolveFrom?: string;

  // Combat
  types?: string[];
  retreat?: number;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;

  // Capacités
  abilities?: Array<{
    type: string;
    name: string;
    effect: string;
  }>;
  attacks?: Array<{
    name: string;
    cost?: string[];
    damage?: string | number;
    effect?: string;
  }>;

  // Textes
  description?: string;
  effect?: string;
  trainerType?: string;
  energyType?: string;

  // Légalité
  legal?: {
    standard?: boolean;
    expanded?: boolean;
  };

  // Variantes
  variants?: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
    wPromo?: boolean;
  };

  // Métadonnées
  updated?: string;
}

/** Types de cartes Pokémon */
export type PokemonCardCategory = 'pokemon' | 'trainer' | 'energy' | 'unknown';

/** Stages d'évolution */
export type PokemonStage = 'Basic' | 'Stage1' | 'Stage2' | 'VMAX' | 'VSTAR' | 'ex' | 'V' | 'GX' | 'EX' | 'MEGA' | 'BREAK' | 'Restored' | 'Level-Up';

/** Types de Pokémon (codes) */
export type PokemonType = 'grass' | 'fire' | 'water' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal' | 'fairy' | 'dragon' | 'colorless';

/** Types de dresseurs */
export type TrainerType = 'Item' | 'Supporter' | 'Stadium' | 'Tool' | 'Technical Machine' | 'Rocket\'s Secret Machine';

/** Types d'énergie */
export type EnergyType = 'Basic' | 'Special';

/** Langues supportées pour Pokémon */
export type PokemonLanguage = 'en' | 'fr' | 'es' | 'it' | 'pt' | 'de' | 'ja' | 'ko' | 'zh-tw';
