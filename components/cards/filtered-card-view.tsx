"use client";

import { useState, useMemo, useDeferredValue, useEffect, useCallback } from "react";
import { CardFiltersHorizontal } from "./card-filters-horizontal";
import { CardGrid } from "./card-grid";
import { CardList } from "./card-list";
import { SeriesDetailHeader } from "@/components/series/series-detail-header";
import { extractAvailableRarities, matchesRarity } from "@/lib/constants/rarities";
import { sortCards, type SortOption } from "@/lib/utils/card-sorting";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import type { CardItem } from "@/lib/types/cards";
import type { LanguageCollectionStats, TcgAttribute } from "@/app/series/[tcg]/[code]/page";

// Type for collection data
export interface CollectionData {
  card_id: string;
  quantity: number;
  quantity_foil: number;
  owned: boolean;
}

export type ViewMode = "grid" | "list";

interface FilteredCardViewProps {
  cards: CardItem[];
  tcgSlug: string;
  seriesId: string;
  seriesCode: string;
  seriesName: string;
  cardsCount: number;
  maxSetBase?: number;
  masterSet?: number;
  isLoggedIn?: boolean;
  userId?: string;
  collectionStats?: LanguageCollectionStats;
  initialCollection?: Record<string, CollectionData>;
  tcgDomains?: TcgAttribute[];
  tcgRarities?: TcgAttribute[];
}

export type OwnershipFilter = "all" | "owned" | "missing";

export function FilteredCardView({ cards, tcgSlug, seriesId, seriesCode, seriesName, cardsCount, maxSetBase, masterSet, isLoggedIn, userId, collectionStats, initialCollection = {}, tcgDomains = [], tcgRarities = [] }: FilteredCardViewProps) {
  const [searchName, setSearchName] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [sortBy, setSortBy] = useState("number");
  const [selectedInks, setSelectedInks] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("fr");
  const [selectedVersion, setSelectedVersion] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");

  // Initialize ownedCardIds from initialCollection
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(() => {
    const owned = new Set<string>();
    Object.entries(initialCollection).forEach(([cardId, data]) => {
      if (data.owned) owned.add(cardId);
    });
    return owned;
  });

  // Collection state - initialized with server data, persists across filter changes
  const [collection, setCollection] = useState<Record<string, CollectionData>>(initialCollection);

  // Use auth context to wait for session to be ready
  const { user: authUser, loading: authLoading } = useAuth();

  // Use deferred values for search inputs to avoid blocking the UI during typing
  const deferredSearchName = useDeferredValue(searchName);
  const deferredSearchNumber = useDeferredValue(searchNumber);

  // Calculer quelle valeur max utiliser selon le filtre de version
  const currentMaxSet = selectedVersion === 'normal' ? maxSetBase : masterSet;

  // Calculate available languages based on cards
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    cards.forEach((card) => {
      const cardLanguage = (card.language || 'fr').toLowerCase();
      languages.add(cardLanguage);
    });
    return Array.from(languages);
  }, [cards]);

  // Auto-select first available language if current selection is not available
  useEffect(() => {
    if (availableLanguages.length > 0 && !availableLanguages.includes(selectedLanguage)) {
      // Prefer French if available, otherwise select first available
      const preferredLanguage = availableLanguages.includes('fr') ? 'fr' : availableLanguages[0];
      setSelectedLanguage(preferredLanguage);
    }
  }, [availableLanguages, selectedLanguage, setSelectedLanguage]);

  // Get effective user ID - prefer auth context, fallback to server-provided
  const effectiveUserId = authUser?.id || userId;

  // Refresh collection from database (used after initial load or when needed)
  // Uses batching to avoid Supabase "Bad Request" errors for large card sets
  const refreshCollection = useCallback(async (targetUserId: string) => {
    if (!targetUserId || cards.length === 0) {
      return;
    }

    const cardIds = cards.map(c => c.id);
    const BATCH_SIZE = 100;
    const colMap: Record<string, CollectionData> = {};
    const ownedIds = new Set<string>();

    const supabase = createClient();

    for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
      const batchIds = cardIds.slice(i, i + BATCH_SIZE);

      try {
        const { data, error } = await supabase
          .from('user_collections')
          .select('card_id, quantity, quantity_foil, owned')
          .eq('user_id', targetUserId)
          .in('card_id', batchIds);

        if (error) {
          console.error('[FilteredCardView] Supabase error:', error);
          continue;
        }

        data?.forEach((item: CollectionData) => {
          colMap[item.card_id] = item;
          if (item.owned) {
            ownedIds.add(item.card_id);
          }
        });
      } catch (e) {
        console.error('[FilteredCardView] Exception in batch:', e);
      }
    }

    setCollection(colMap);
    setOwnedCardIds(ownedIds);
  }, [cards]);

  // Only refresh collection if user changes (login/logout) or if auth user differs from server user
  // We already have initialCollection from server, so no need to fetch on mount
  useEffect(() => {
    // Wait for auth to be ready
    if (authLoading) {
      return;
    }

    // If user logs out, clear collection
    if (!effectiveUserId) {
      setCollection({});
      setOwnedCardIds(new Set());
      return;
    }

    // If we have initial collection data from server and the user matches, don't refetch
    // Only refetch if auth user ID differs from server-provided userId (edge case)
    const hasInitialData = Object.keys(initialCollection).length > 0;
    const serverUserMatchesAuth = userId === authUser?.id;

    if (hasInitialData && (serverUserMatchesAuth || !authUser?.id)) {
      // Already have data from server, no need to fetch
      return;
    }

    // User changed or we need fresh data - refetch
    if (authUser?.id && authUser.id !== userId) {
      console.log('[FilteredCardView] Auth user differs from server user, refreshing collection');
      refreshCollection(authUser.id);
    }
  }, [authLoading, authUser?.id, userId, effectiveUserId, initialCollection, refreshCollection]);

  // Callback to update collection when user modifies a card
  // Uses functional updates to avoid stale closure issues
  const updateCollectionItem = useCallback((cardId: string, data: Partial<CollectionData>) => {
    setCollection(prev => {
      const prevItem = prev[cardId];
      const newQuantity = data.quantity ?? prevItem?.quantity ?? 0;
      const newQuantityFoil = data.quantity_foil ?? prevItem?.quantity_foil ?? 0;
      const isNowOwned = newQuantity > 0 || newQuantityFoil > 0;

      // Also update ownedCardIds within the same render cycle
      setOwnedCardIds(prevOwned => {
        const newSet = new Set(prevOwned);
        if (isNowOwned) {
          newSet.add(cardId);
        } else {
          newSet.delete(cardId);
        }
        return newSet;
      });

      return {
        ...prev,
        [cardId]: {
          card_id: cardId,
          quantity: newQuantity,
          quantity_foil: newQuantityFoil,
          owned: isNowOwned,
        }
      };
    });
  }, []); // No dependencies - uses functional updates only

  // Calculate dynamic collection stats by language (updates when collection changes)
  const dynamicCollectionStats = useMemo((): LanguageCollectionStats => {
    const stats: LanguageCollectionStats = {};

    // Group cards by language
    const cardsByLanguage: Record<string, string[]> = {};
    cards.forEach(card => {
      const lang = (card.language || 'fr').toLowerCase();
      if (!cardsByLanguage[lang]) cardsByLanguage[lang] = [];
      cardsByLanguage[lang].push(card.id);
    });

    // Calculate stats for each language
    for (const [lang, langCardIds] of Object.entries(cardsByLanguage)) {
      const total = langCardIds.length;
      const owned = langCardIds.filter(id => ownedCardIds.has(id)).length;
      stats[lang] = {
        owned,
        total,
        percentage: total > 0 ? Math.round((owned / total) * 100) : 0
      };
    }

    return stats;
  }, [cards, ownedCardIds]);

  // Calculate available rarities based on cards in the selected language
  // For TCGs with custom rarities (Pokemon, Riftbound), extract the raw rarity values
  // For Lorcana, use the normalized rarity IDs
  const availableRarities = useMemo(() => {
    const cardsInLanguage = cards.filter((card) => {
      const cardLanguage = (card.language || 'fr').toLowerCase();
      return cardLanguage === selectedLanguage.toLowerCase();
    });

    // Extract raw rarity codes from cards (for TCGs with custom rarities)
    const rawRarities = new Set<string>();
    cardsInLanguage.forEach((card) => {
      if (card.rarity) {
        rawRarities.add(card.rarity.toLowerCase());
      }
    });

    // Also get normalized rarities for Lorcana
    const normalizedRarities = extractAvailableRarities(cardsInLanguage);

    return {
      raw: Array.from(rawRarities),
      normalized: normalizedRarities
    };
  }, [cards, selectedLanguage]);

  // Filtrer et trier les cartes
  const filteredCards = useMemo(() => {
    let result = cards;

    // Filtre par nom (using deferred value for smooth typing)
    if (deferredSearchName) {
      const searchLower = deferredSearchName.toLowerCase();
      result = result.filter((card) =>
        card.name.toLowerCase().includes(searchLower)
      );
    }

    // Filtre par numéro (using deferred value for smooth typing)
    if (deferredSearchNumber) {
      const searchLower = deferredSearchNumber.toLowerCase();
      result = result.filter((card) =>
        card.number.toLowerCase().includes(searchLower)
      );
    }

    // Filter by rarity
    if (selectedRarities.length > 0) {
      result = result.filter((card) => {
        if (!card.rarity) return false;
        // Pour les TCG avec raretés personnalisées (Riftbound), on fait une correspondance directe
        // Pour Lorcana, on utilise la normalisation
        const cardRarityLower = card.rarity.toLowerCase();
        const directMatch = selectedRarities.some(r => r.toLowerCase() === cardRarityLower);
        if (directMatch) return true;
        // Fallback vers la normalisation Lorcana
        return matchesRarity(card.rarity, selectedRarities);
      });
    }

    // Filtre par encre (si présent dans attributes) - Lorcana
    if (selectedInks.length > 0) {
      result = result.filter((card) => {
        const attrs = card.attributes as { ink?: string } | null;
        if (!attrs || !attrs.ink) return false;
        const cardInk = attrs.ink.toLowerCase();
        return selectedInks.some((ink) => cardInk.includes(ink.toLowerCase()));
      });
    }

    // Filtre par domaine (si présent dans attributes) - Riftbound
    if (selectedDomains.length > 0) {
      result = result.filter((card) => {
        const attrs = card.attributes as { domains?: string[] } | null;
        if (!attrs || !attrs.domains) return false;
        const cardDomains: string[] = attrs.domains;
        return selectedDomains.some((domain) =>
          cardDomains.some((d) => d.toLowerCase() === domain.toLowerCase())
        );
      });
    }

    // Filtre par langue
    if (selectedLanguage) {
      result = result.filter((card) => {
        // Si la langue n'est pas définie, on suppose que c'est du FR (pour la rétrocompatibilité)
        const cardLanguage = (card.language || 'fr').toLowerCase();
        return cardLanguage === selectedLanguage.toLowerCase();
      });
    }

    // Filtre par version (normal/foil)
    if (selectedVersion === 'normal') {
      // En mode "normal", exclure les cartes foil uniquement (enchanted, D100, D23, promo)
      result = result.filter((card) => {
        const rarity = card.rarity?.toLowerCase() || '';
        return !rarity.includes('enchant') && rarity !== 'd100' && rarity !== 'd23' && rarity !== 'promo';
      });
    }
    // En mode "foil" ou "all", on garde toutes les cartes

    // Filtre par possession (owned/missing)
    if (ownershipFilter === 'owned') {
      result = result.filter((card) => ownedCardIds.has(card.id));
    } else if (ownershipFilter === 'missing') {
      result = result.filter((card) => !ownedCardIds.has(card.id));
    }

    // Sort using centralized sorting utility
    return sortCards(result, sortBy as SortOption);
  }, [
    cards,
    deferredSearchName,
    deferredSearchNumber,
    sortBy,
    selectedInks,
    selectedRarities,
    selectedDomains,
    selectedLanguage,
    selectedVersion,
    ownershipFilter,
    ownedCardIds,
  ]);

  return (
    <div className="space-y-4">
      {/* Header + Filtres */}
      <div className="sticky top-20 z-40 bg-background/80 backdrop-blur-md py-3 -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6 border-b border-border/30">
        {/* Header (breadcrumb avec nombre de cartes) */}
        <div className="mb-3">
          <SeriesDetailHeader
            tcgSlug={tcgSlug}
            seriesName={seriesName}
            cardsCount={cardsCount}
          />
        </div>

        {/* Filtres - pleine largeur */}
        <div>
          <CardFiltersHorizontal
              tcgSlug={tcgSlug}
              searchName={searchName}
              setSearchName={setSearchName}
              searchNumber={searchNumber}
              setSearchNumber={setSearchNumber}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedInks={selectedInks}
              setSelectedInks={setSelectedInks}
              selectedRarities={selectedRarities}
              setSelectedRarities={setSelectedRarities}
              selectedDomains={selectedDomains}
              setSelectedDomains={setSelectedDomains}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
              selectedVersion={selectedVersion}
              setSelectedVersion={setSelectedVersion}
              ownershipFilter={ownershipFilter}
              setOwnershipFilter={setOwnershipFilter}
              availableRarities={availableRarities.normalized}
              availableRaritiesRaw={availableRarities.raw}
              availableLanguages={availableLanguages}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isLoggedIn={isLoggedIn}
              collectionStats={isLoggedIn ? dynamicCollectionStats : collectionStats}
              tcgDomains={tcgDomains}
              tcgRarities={tcgRarities}
              cards={cards}
              seriesId={seriesId}
              seriesName={seriesName}
              seriesCode={seriesCode}
              maxSetBase={maxSetBase}
              masterSet={masterSet}
            />
        </div>
      </div>

      {/* Affichage des cartes (grille ou liste) */}
      {viewMode === "grid" ? (
        <CardGrid cards={filteredCards} seriesCode={seriesCode} maxSetBase={currentMaxSet} selectedVersion={selectedVersion} userId={userId} collection={collection} onCollectionUpdate={updateCollectionItem} tcgSlug={tcgSlug} />
      ) : (
        <CardList cards={filteredCards} seriesCode={seriesCode} maxSetBase={currentMaxSet} selectedVersion={selectedVersion} tcgRarities={tcgRarities} userId={userId} collection={collection} onCollectionUpdate={updateCollectionItem} />
      )}
    </div>
  );
}
