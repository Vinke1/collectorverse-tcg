"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Layers, Check, XCircle, Eye, ChevronRight, FileSpreadsheet, Loader2, FileText, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { sortCardsByNumber } from "@/lib/utils/card-sorting";
import { isFoilOnlyByRarity } from "@/lib/utils/foil-detection";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/app-config";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { SharedCollectionData, ShareFilter } from "@/lib/types/share";
import type { CollectionItem } from "@/lib/utils/excel-export";

interface SharedCollectionViewProps {
  data: SharedCollectionData;
}

// Mapping TCG slug to display name
const TCG_NAMES: Record<string, string> = {
  lorcana: 'Lorcana',
  pokemon: 'Pokemon',
  onepiece: 'One Piece',
  riftbound: 'Riftbound',
  naruto: 'Naruto'
};

type VersionFilter = "all" | "normal" | "foil";

export function SharedCollectionView({ data }: SharedCollectionViewProps) {
  const { share, series, tcg, cards, ownedCardIds, collectionData, stats } = data;
  const [filter, setFilter] = useState<ShareFilter>("all");
  const [versionFilter, setVersionFilter] = useState<VersionFilter>("all");
  const [isExporting, setIsExporting] = useState(false);
  const { t } = useLanguage();

  const ownedSet = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);

  // Get language info for display
  const languageInfo = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code.toLowerCase() === (share.language || "fr").toLowerCase()
  );

  const filteredCards = useMemo(() => {
    let result = sortCardsByNumber(cards);

    // Filter by ownership
    if (filter === "owned") {
      result = result.filter((card) => ownedSet.has(card.id));
    } else if (filter === "missing") {
      result = result.filter((card) => !ownedSet.has(card.id));
    }

    // Filter by version (foil/normal) - based on rarity like on main site
    if (versionFilter === "normal") {
      // Exclude foil-only cards (enchanted, D100, D23, promo)
      result = result.filter((card) => !isFoilOnlyByRarity(card.rarity));
    } else if (versionFilter === "foil") {
      // Only show foil cards (enchanted, D100, D23, promo)
      result = result.filter((card) => isFoilOnlyByRarity(card.rarity));
    }

    return result;
  }, [cards, filter, ownedSet, versionFilter]);

  // Export handler for shared collection
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Build collection map from shared data
      const collection: Record<string, CollectionItem> = {};
      Object.entries(collectionData).forEach(([cardId, cardData]) => {
        collection[cardId] = {
          quantity: cardData.quantity || 0,
          quantity_foil: cardData.quantity_foil || 0
        };
      });

      // Dynamic import of xlsx to reduce initial bundle size
      const { generateCollectionExcel } = await import('@/lib/utils/excel-export');

      // Convert cards to CardItem format - cast attributes to any for compatibility
      const cardItems = cards.map(card => ({
        id: card.id,
        name: card.name,
        number: card.number,
        language: card.language,
        chapter: card.chapter,
        rarity: card.rarity,
        image_url: card.image_url,
        attributes: card.attributes as Record<string, unknown> | null
      })) as import('@/lib/types/cards').CardItem[];

      // Generate and download Excel with site language translations
      // Use optional chaining for safety in case translations aren't loaded
      generateCollectionExcel({
        cards: cardItems,
        collection,
        seriesName: series.name,
        seriesCode: series.code,
        maxSetBase: series.max_set_base ?? undefined,
        masterSet: series.master_set ?? undefined,
        tcgName: TCG_NAMES[tcg.slug] || tcg.slug,
        preferredLanguage: share.language || 'fr',
        translations: t?.export ? {
          sheets: t.export.sheets,
          headers: t.export.headers,
          stats: t.export.stats
        } : undefined
      });

      toast.success(t?.export?.success || 'Export réussi !');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t?.export?.error || 'Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/series/${tcg.slug}`}
            className="hover:text-foreground transition flex items-center gap-1"
          >
            {tcg.name}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{series.name}</span>
        </div>

        {/* Title + Badge */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Eye className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t.share.sharedCollection}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{series.name}</span>
                {languageInfo && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/50 rounded-full">
                    <Image
                      src={languageInfo.flag}
                      alt={languageInfo.label}
                      width={16}
                      height={16}
                      className="rounded-sm"
                    />
                    <span className="text-xs font-medium">{languageInfo.label}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full"
          >
            <span className="text-3xl font-bold text-primary">
              {stats.percentage}%
            </span>
            <span className="text-sm text-muted-foreground">
              ({stats.owned}/{stats.total})
            </span>
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.percentage}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
          />
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="sticky top-20 z-40 bg-background/80 backdrop-blur-md py-3 -mx-3 px-3 border-b border-border/30"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Card filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ownership filter */}
            <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
              <button
                onClick={() => setFilter("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm ${
                  filter === "all"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">{t.share.filterAll}</span>
                <span>({stats.total})</span>
              </button>
              <button
                onClick={() => setFilter("owned")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm ${
                  filter === "owned"
                    ? "bg-emerald-500 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">{t.share.filterOwned}</span>
                <span>({stats.owned})</span>
              </button>
              <button
                onClick={() => setFilter("missing")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all text-sm ${
                  filter === "missing"
                    ? "bg-red-500 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t.share.filterMissing}</span>
                <span>({stats.missing})</span>
              </button>
            </div>
          </div>

          {/* Right: Version filter + Export */}
          <div className="flex items-center gap-3">
            {/* Version filter (same as main site) */}
            <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
              <button
                onClick={() => setVersionFilter("all")}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                  versionFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
                title={t.filters.version.all}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVersionFilter("normal")}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                  versionFilter === "normal"
                    ? "bg-blue-500 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
                title={t.filters.version.normal}
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVersionFilter("foil")}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                  versionFilter === "foil"
                    ? "bg-gradient-to-r from-orange-500 via-yellow-500 to-green-500 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
                title={t.filters.version.foil}
              >
                <Star className={`w-4 h-4 ${versionFilter === 'foil' ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2"
              title={t.export.button}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{t.export.button}</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Cards Grid - Read-only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4"
      >
        {filteredCards.map((card, index) => {
          const isOwned = ownedSet.has(card.id);
          const cardCollection = collectionData[card.id];
          const normalCount = cardCollection?.quantity || 0;
          const foilCount = cardCollection?.quantity_foil || 0;

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.5) }}
              className="group relative"
            >
              <div
                className={`relative aspect-[480/672] rounded-lg overflow-hidden transition-all ${
                  isOwned
                    ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "opacity-50 grayscale hover:opacity-70 hover:grayscale-0"
                }`}
              >
                {card.image_url ? (
                  <Image
                    src={card.image_url}
                    alt={card.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, (max-width: 1536px) 16vw, 14vw"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">
                      Image non disponible
                    </span>
                  </div>
                )}

                {/* Ownership badge */}
                <div
                  className={`absolute top-2 right-2 p-1.5 rounded-full ${
                    isOwned ? "bg-emerald-500" : "bg-red-500/80"
                  }`}
                >
                  {isOwned ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <XCircle className="w-3 h-3 text-white" />
                  )}
                </div>

                {/* Card number */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
                  #{card.number}
                </div>

                {/* Quantity badges - only show if owned */}
                {isOwned && (normalCount > 0 || foilCount > 0) && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {normalCount > 0 && (
                      <div className="px-1.5 py-0.5 bg-slate-800/90 rounded text-xs text-white font-bold min-w-[20px] text-center">
                        {normalCount}
                      </div>
                    )}
                    {foilCount > 0 && (
                      <div className="px-1.5 py-0.5 bg-gradient-to-r from-orange-500/90 via-yellow-500/90 to-green-500/90 rounded text-xs text-white font-bold min-w-[20px] text-center">
                        {foilCount}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card name */}
              <p className="mt-2 text-xs font-medium text-center truncate">
                {card.name}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Empty state */}
      {filteredCards.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filter === "owned"
              ? t.share.noOwned
              : filter === "missing"
              ? t.share.noMissing
              : t.share.noCards}
          </p>
        </div>
      )}
    </div>
  );
}
