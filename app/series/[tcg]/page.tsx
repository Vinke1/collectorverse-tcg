import { createClient } from "@/lib/supabase/server";
import { SeriesTimelineLayout } from "@/components/series/series-timeline-layout";
import { SeriesPageHeader } from "@/components/series/series-page-header";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Type pour les statistiques de collection par langue
export interface CollectionStatsByLanguage {
  [seriesId: string]: {
    [language: string]: {
      owned: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * TCG display names mapping
 */
const TCG_DISPLAY_NAMES: Record<string, string> = {
  pokemon: "Pokémon TCG",
  lorcana: "Disney Lorcana",
  onepiece: "One Piece Card Game",
  riftbound: "Riftbound",
  naruto: "Naruto TCG",
  starwars: "Star Wars Unlimited"
};

/**
 * Valid TCG slugs
 */
const VALID_TCG_SLUGS = Object.keys(TCG_DISPLAY_NAMES);

interface PageProps {
  params: Promise<{
    tcg: string;
  }>;
}

/**
 * Generate metadata for the page
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tcg } = await params;
  const tcgName = TCG_DISPLAY_NAMES[tcg];

  if (!tcgName) {
    return {
      title: "TCG Non trouvé - CollectorVerse"
    };
  }

  return {
    title: `Séries ${tcgName} - CollectorVerse`,
    description: `Explorez toutes les séries ${tcgName}`
  };
}

/**
 * Generate static params for all TCG pages
 */
export async function generateStaticParams() {
  return VALID_TCG_SLUGS.map((tcg) => ({
    tcg
  }));
}

/**
 * TCG Series Page - Dynamic route for all TCGs
 */
export default async function TCGSeriesPage({ params }: PageProps) {
  const { tcg } = await params;

  // Validate TCG slug
  if (!VALID_TCG_SLUGS.includes(tcg)) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch the TCG game
  const { data: tcgGame, error: tcgError } = await supabase
    .from("tcg_games")
    .select("*")
    .eq("slug", tcg)
    .single();

  if (tcgError || !tcgGame) {
    notFound();
  }

  const tcgName = TCG_DISPLAY_NAMES[tcg];

  // === POKEMON SPECIFIC LAYOUT ===
  if (tcg === 'pokemon') {
    // Fetch eras with series counts
    const { data: pokemonEras } = await supabase
      .from('pokemon_series')
      .select(`
        id,
        code,
        name,
        logo_url,
        sort_order
      `)
      .order('sort_order', { ascending: true });

    // Batch fetch all series for all eras at once (fix N+1 query)
    const eraIds = (pokemonEras || []).map(era => era.id);
    const { data: allEraSeries } = await supabase
      .from('series')
      .select('id, release_date, pokemon_series_id')
      .in('pokemon_series_id', eraIds);

    // Group series by era
    const seriesByEra: Record<string, { id: string; release_date: string | null }[]> = {};
    (allEraSeries || []).forEach(serie => {
      if (serie.pokemon_series_id) {
        if (!seriesByEra[serie.pokemon_series_id]) {
          seriesByEra[serie.pokemon_series_id] = [];
        }
        seriesByEra[serie.pokemon_series_id].push(serie);
      }
    });

    // Build era stats from grouped data
    const erasWithStats = (pokemonEras || []).map(era => {
      const eraSeries = seriesByEra[era.id] || [];
      const dates = eraSeries
        .map(s => s.release_date)
        .filter(Boolean)
        .sort() as string[];

      return {
        ...era,
        seriesCount: eraSeries.length,
        dateRange: {
          start: dates[0] || null,
          end: dates[dates.length - 1] || null
        }
      };
    });

    // Dynamic import to avoid loading for other TCGs
    const { PokemonTimelineLayout } = await import('@/components/series/pokemon-timeline-layout');

    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <SeriesPageHeader tcgName={tcgName} />
        <PokemonTimelineLayout eras={erasWithStats} />
      </div>
    );
  }
  // === END POKEMON SPECIFIC ===

  // Fetch user (for collection stats)
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all series for this TCG, sorted by release date (oldest first)
  const { data: series } = await supabase
    .from("series")
    .select("*")
    .eq("tcg_game_id", tcgGame.id)
    .order("release_date", { ascending: true });

  // Batch fetch all cards for all series at once (fix N+1 query)
  // Note: Using .range(0, 9999) to override Supabase default limit of 1000
  const seriesIds = (series || []).map(s => s.id);
  const { data: allCards } = await supabase
    .from("cards")
    .select("id, language, series_id")
    .in("series_id", seriesIds)
    .range(0, 9999);

  // Group cards by series and build maps
  const seriesCardIds: Record<string, string[]> = {};
  const cardLanguageMap: Record<string, string> = {};
  const cardsBySeries: Record<string, { id: string; language: string | null }[]> = {};

  (allCards || []).forEach(card => {
    if (!cardsBySeries[card.series_id]) {
      cardsBySeries[card.series_id] = [];
    }
    cardsBySeries[card.series_id].push(card);

    if (!seriesCardIds[card.series_id]) {
      seriesCardIds[card.series_id] = [];
    }
    seriesCardIds[card.series_id].push(card.id);
    cardLanguageMap[card.id] = card.language || "unknown";
  });

  // Build series with counts from grouped data
  const seriesWithCounts = (series || []).map(serie => {
    const cards = cardsBySeries[serie.id] || [];

    if (cards.length === 0) {
      return { ...serie, actual_card_count: 0 };
    }

    // Group by language and count
    const countsByLanguage: Record<string, number> = {};
    cards.forEach(card => {
      const lang = card.language || "unknown";
      countsByLanguage[lang] = (countsByLanguage[lang] || 0) + 1;
    });

    // Get the maximum count across all languages
    const maxCount = Math.max(...Object.values(countsByLanguage));

    return { ...serie, actual_card_count: maxCount, countsByLanguage };
  });

  // Fetch collection stats if user is logged in
  const collectionStats: CollectionStatsByLanguage = {};

  if (user) {
    // Get all card IDs across all series
    const allCardIds = Object.values(seriesCardIds).flat();

    if (allCardIds.length > 0) {
      // Fetch user's collection for these cards
      const { data: userCollection } = await supabase
        .from("user_collections")
        .select("card_id, owned, quantity, quantity_foil")
        .eq("user_id", user.id)
        .in("card_id", allCardIds);

      // Build collection stats by series and language
      for (const serie of seriesWithCounts) {
        const seriesCards = seriesCardIds[serie.id] || [];
        const serieCountsByLanguage = (serie as typeof serie & { countsByLanguage?: Record<string, number> }).countsByLanguage || {};

        collectionStats[serie.id] = {};

        // Initialize stats for each language in this series
        for (const [lang, total] of Object.entries(serieCountsByLanguage)) {
          collectionStats[serie.id][lang] = {
            owned: 0,
            total: total as number,
            percentage: 0
          };
        }

        // Count owned cards by language
        if (userCollection) {
          for (const collection of userCollection) {
            if (seriesCards.includes(collection.card_id) && collection.owned) {
              const lang = cardLanguageMap[collection.card_id] || "unknown";
              if (collectionStats[serie.id][lang]) {
                collectionStats[serie.id][lang].owned += 1;
              }
            }
          }
        }

        // Calculate percentages
        for (const lang of Object.keys(collectionStats[serie.id])) {
          const stats = collectionStats[serie.id][lang];
          stats.percentage = stats.total > 0
            ? Math.round((stats.owned / stats.total) * 100)
            : 0;
        }
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <SeriesPageHeader tcgName={tcgName} />

      <SeriesTimelineLayout
        series={seriesWithCounts}
        tcgSlug={tcg}
        isLoggedIn={!!user}
        collectionStats={collectionStats}
      />
    </div>
  );
}
