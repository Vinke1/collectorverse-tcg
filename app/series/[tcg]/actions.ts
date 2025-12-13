'use server'

import { createClient } from '@/lib/supabase/server';
import type { PokemonSeries } from '@/lib/types/pokemon';

export async function fetchEraSeriesAction(eraId: string): Promise<PokemonSeries[]> {
  const supabase = await createClient();

  const { data: series, error } = await supabase
    .from('series')
    .select('id, name, code, image_url, release_date, official_card_count, total_card_count')
    .eq('pokemon_series_id', eraId)
    .order('release_date', { ascending: true });

  if (error) {
    return [];
  }

  return series || [];
}
