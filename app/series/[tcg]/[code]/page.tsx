import { createClient } from "@/lib/supabase/server";
import { FilteredCardView } from "@/components/cards/filtered-card-view";
import { notFound } from "next/navigation";
import { sortCardsByNumber } from "@/lib/utils/card-sorting";

// Type pour les stats de collection par langue
export interface LanguageCollectionStats {
  [language: string]: {
    owned: number;
    total: number;
    percentage: number;
  };
}

// Type pour les attributs TCG (domaines, raretés)
export interface TcgAttribute {
  code: string;
  name: string;
  icon_url: string | null;
}

interface SeriesDetailPageProps {
  params: Promise<{
    tcg: string;
    code: string;
  }>;
}

export async function generateMetadata({ params }: SeriesDetailPageProps) {
  const { tcg, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  return {
    title: `${code.toUpperCase()} - ${tcg.charAt(0).toUpperCase() + tcg.slice(1)} - CollectorVerse`,
    description: `Explorez toutes les cartes de la série ${code.toUpperCase()}`,
  };
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { tcg, code: rawCode } = await params;
  // Decode URL-encoded characters (e.g., %20 -> space)
  const code = decodeURIComponent(rawCode);
  const supabase = await createClient();

  // Récupérer le TCG
  const { data: tcgGame } = await supabase
    .from("tcg_games")
    .select("*")
    .eq("slug", tcg)
    .single();

  if (!tcgGame) {
    notFound();
  }

  // Récupérer la série
  const { data: series } = await supabase
    .from("series")
    .select("*")
    .eq("tcg_game_id", tcgGame.id)
    .eq("code", code)
    .single();

  if (!series) {
    notFound();
  }

  // Récupérer les domaines et raretés du TCG (pour Riftbound notamment)
  const [{ data: domainsData }, { data: raritiesData }] = await Promise.all([
    supabase
      .from("domains")
      .select("code, name, icon_url")
      .eq("tcg_game_id", tcgGame.id),
    supabase
      .from("rarities")
      .select("code, name, icon_url, sort_order")
      .eq("tcg_game_id", tcgGame.id)
      .order("sort_order", { ascending: true }),
  ]);

  const tcgDomains: TcgAttribute[] = domainsData || [];
  const tcgRarities: TcgAttribute[] = raritiesData || [];

  // Récupérer l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();

  // Récupérer les cartes de la série (avec pagination pour éviter la limite de 1000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cardsData: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: pageData } = await supabase
      .from("cards")
      .select("*")
      .eq("series_id", series.id)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!pageData || pageData.length === 0) break;
    cardsData = cardsData.concat(pageData);
    if (pageData.length < pageSize) break;
    page++;
  }

  // Sort cards using centralized sorting utility
  // Normal cards first (by number), promo cards at the end
  const cards = sortCardsByNumber(cardsData || []);
  const cardsCount = new Set(cards.map(c => c.number)).size;

  // Calculer les stats de collection par langue et récupérer la collection complète
  const collectionStats: LanguageCollectionStats = {};
  // Collection data map pour passer au client (avec quantity et quantity_foil)
  let initialCollection: Record<string, { card_id: string; quantity: number; quantity_foil: number; owned: boolean }> = {};

  if (user && cards.length > 0) {
    // Compter les cartes par langue
    const cardsByLanguage: Record<string, string[]> = {};
    cards.forEach(card => {
      const lang = (card.language || 'fr').toLowerCase();
      if (!cardsByLanguage[lang]) cardsByLanguage[lang] = [];
      cardsByLanguage[lang].push(card.id);
    });

    // Récupérer la collection complète de l'utilisateur (avec quantity et quantity_foil)
    const cardIds = cards.map(c => c.id);

    // Fetch par batch de 100 pour éviter les erreurs "Bad Request"
    const BATCH_SIZE = 100;
    const allUserCollection: { card_id: string; quantity: number; quantity_foil: number; owned: boolean }[] = [];

    for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
      const batchIds = cardIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from("user_collections")
        .select("card_id, quantity, quantity_foil, owned")
        .eq("user_id", user.id)
        .in("card_id", batchIds);

      if (batchData) {
        allUserCollection.push(...batchData);
      }
    }

    // Créer un map de la collection pour passer au client
    allUserCollection.forEach(item => {
      initialCollection[item.card_id] = {
        card_id: item.card_id,
        quantity: item.quantity || 0,
        quantity_foil: item.quantity_foil || 0,
        owned: item.owned
      };
    });

    // Créer un set des cartes possédées
    const ownedCardIds = new Set(
      allUserCollection.filter(c => c.owned).map(c => c.card_id)
    );

    // Calculer les stats par langue
    for (const [lang, langCardIds] of Object.entries(cardsByLanguage)) {
      const total = langCardIds.length;
      const owned = langCardIds.filter(id => ownedCardIds.has(id)).length;
      collectionStats[lang] = {
        owned,
        total,
        percentage: total > 0 ? Math.round((owned / total) * 100) : 0
      };
    }
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 pt-20 pb-8 max-w-[1600px]">
      {/* Filtres et grille de cartes (avec header intégré) */}
      <FilteredCardView
        cards={cards}
        tcgSlug={tcg}
        seriesId={series.id}
        seriesCode={series.code}
        seriesName={series.name}
        cardsCount={cardsCount}
        maxSetBase={series.max_set_base}
        masterSet={series.master_set}
        isLoggedIn={!!user}
        userId={user?.id}
        collectionStats={collectionStats}
        initialCollection={initialCollection}
        tcgDomains={tcgDomains}
        tcgRarities={tcgRarities}
      />
    </div>
  );
}
