/**
 * Pokemon TCG specific types
 */

export interface PokemonEra {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
  sort_order: number;
  seriesCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export interface PokemonSeries {
  id: string;
  name: string;
  code: string;
  image_url: string | null;
  release_date: string | null;
  official_card_count: number | null;
  total_card_count: number | null;
}
