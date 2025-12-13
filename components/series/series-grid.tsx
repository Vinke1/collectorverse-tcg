"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useState } from "react";
import type { CollectionStatsByLanguage } from "@/app/series/[tcg]/page";
import { LANGUAGE_FLAGS, LANGUAGE_ORDER } from "@/lib/constants/languages";

// Composant pour gérer les erreurs d'image de série (format bannière)
function SeriesBannerImage({ src, alt, usecover, position }: { src: string; alt: string; usecover?: boolean; position?: 'center' | 'questDeep' | 'questPalace' | 'top40' }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-primary/20 to-primary/10">
        <Layers className="w-20 h-20 text-muted-foreground/30" />
      </div>
    );
  }

  const positionClass = position === 'questDeep' ? 'object-[center_20%]' : position === 'questPalace' ? 'object-[center_40%]' : position === 'top40' ? 'object-[center_20%]' : 'object-center';

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={`${usecover ? 'object-cover' : 'object-contain'} ${positionClass} group-hover:scale-102 transition-transform duration-500`}
      sizes="(max-width: 768px) 100vw, 900px"
      onError={() => setHasError(true)}
    />
  );
}

interface Series {
  id: string;
  name: string;
  code: string;
  release_date: string | null;
  max_set_base: number;
  master_set: number | null;
  image_url: string | null;
  actual_card_count?: number;
}

interface SeriesGridProps {
  series: Series[];
  tcgSlug: string;
  isLoggedIn?: boolean;
  collectionStats?: CollectionStatsByLanguage;
}


export function SeriesGrid({ series, tcgSlug, isLoggedIn, collectionStats }: SeriesGridProps) {
  const { t, language } = useLanguage();
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  // Get translated series name based on TCG and series code
  const getSeriesName = (serie: Series): string => {
    // Check for TCG-specific translations
    const tcgTranslations = (t.series as Record<string, Record<string, string>>)[tcgSlug];
    if (tcgTranslations && tcgTranslations[serie.code]) {
      return tcgTranslations[serie.code];
    }
    return serie.name;
  };

  if (series.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          {t.series.grid.empty}
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          {t.series.grid.coming_soon}
        </p>
      </div>
    );
  }

  // Helper function to get sorted languages for a series
  // Only return languages that have a flag defined (filter out unknown/null languages)
  const getSortedLanguages = (seriesId: string) => {
    if (!collectionStats || !collectionStats[seriesId]) return [];

    const languages = Object.keys(collectionStats[seriesId])
      .filter(lang => LANGUAGE_FLAGS[lang]); // Only keep languages with flags

    return languages.sort((a, b) => {
      const indexA = LANGUAGE_ORDER.indexOf(a);
      const indexB = LANGUAGE_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto">
      {series.map((serie, index) => (
        <motion.div
          key={serie.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * index, duration: 0.4 }}
        >
          <Link
            href={`/series/${tcgSlug}/${serie.code}`}
            className="block group"
            onMouseEnter={() => setHoveredSeries(serie.id)}
            onMouseLeave={() => setHoveredSeries(null)}
          >
            {/* Titre de la série */}
            <h2 className="text-xl md:text-2xl font-bold mb-3 text-foreground/90 group-hover:text-primary transition-colors">
              {getSeriesName(serie)}
            </h2>

            {/* Bannière avec cadre doré style Lorcana */}
            <div className="relative overflow-hidden rounded-md shadow-lg group-hover:shadow-xl group-hover:shadow-amber-500/20 transition-all duration-300">
              {/* Cadre décoratif externe */}
              <div className="absolute inset-0 border-[3px] border-amber-700/70 dark:border-amber-600/60 rounded-md z-10 pointer-events-none transition-colors duration-300 group-hover:border-amber-500/90 dark:group-hover:border-amber-400/80" />

              {/* Cadre décoratif interne */}
              <div className="absolute inset-[6px] border border-amber-500/50 dark:border-amber-400/40 rounded-sm z-10 pointer-events-none transition-colors duration-300 group-hover:border-amber-400/70 dark:group-hover:border-amber-300/60" />

              {/* Ornements aux coins avec animation */}
              <div className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-amber-500/60 z-10 pointer-events-none transition-all duration-300 group-hover:border-amber-400 group-hover:w-5 group-hover:h-5" />
              <div className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-amber-500/60 z-10 pointer-events-none transition-all duration-300 group-hover:border-amber-400 group-hover:w-5 group-hover:h-5" />
              <div className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-amber-500/60 z-10 pointer-events-none transition-all duration-300 group-hover:border-amber-400 group-hover:w-5 group-hover:h-5" />
              <div className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-amber-500/60 z-10 pointer-events-none transition-all duration-300 group-hover:border-amber-400 group-hover:w-5 group-hover:h-5" />

              {/* Image bannière - ratio adapté par TCG/série */}
              {(() => {
                const isQuestSeries = serie.code === 'QuestDeep' || serie.code === 'QuestPalace';
                const isPromoSeries = serie.code === 'Promo';
                const isRiftboundSeries = tcgSlug === 'riftbound';
                const isOnePieceSeries = tcgSlug === 'onepiece';
                const isStarWarsSeries = tcgSlug === 'starwars';
                const isLorcanaSeries = tcgSlug === 'lorcana';
                const isSpecialSeries = isQuestSeries || isPromoSeries;
                const shouldUseCover = isSpecialSeries || isRiftboundSeries || isOnePieceSeries || isStarWarsSeries || isLorcanaSeries;
                const imagePosition = serie.code === 'QuestDeep' ? 'questDeep' : serie.code === 'QuestPalace' ? 'questPalace' : serie.code === 'Lueur' ? 'top40' : 'center';
                const aspectRatio = isOnePieceSeries || isStarWarsSeries ? 'aspect-[16/9]' : isRiftboundSeries ? 'aspect-[2.36/1]' : isPromoSeries ? 'aspect-[3.0/1]' : isQuestSeries ? 'aspect-[3.2/1]' : 'aspect-[4/1]';
                return (
              <div className={`relative ${aspectRatio} bg-amber-50 dark:bg-slate-900`}>
                {serie.image_url ? (
                  <SeriesBannerImage src={serie.image_url} alt={getSeriesName(serie)} usecover={shouldUseCover} position={imagePosition as 'center' | 'questDeep' | 'questPalace' | 'top40'} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-primary/20 to-primary/10">
                    <Layers className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}

                {/* Overlay au hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 z-5" />

                {/* Collection stats overlay - visible uniquement au hover et si connecté */}
                <AnimatePresence>
                  {isLoggedIn && collectionStats && collectionStats[serie.id] && hoveredSeries === serie.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-3 right-3 z-30 flex items-center gap-2"
                    >
                      {getSortedLanguages(serie.id).map((lang) => {
                        const stats = collectionStats[serie.id][lang];
                        const percentage = stats.percentage;
                        const isComplete = percentage === 100;

                        return (
                          <div
                            key={lang}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md shadow-lg border ${
                              isComplete
                                ? 'bg-emerald-500/90 border-emerald-400/50'
                                : 'bg-slate-900/80 border-slate-700/50'
                            }`}
                          >
                            {/* Drapeau */}
                            {LANGUAGE_FLAGS[lang] && (
                              <Image
                                src={LANGUAGE_FLAGS[lang]}
                                alt={lang}
                                width={16}
                                height={12}
                                className="rounded-sm"
                                unoptimized
                              />
                            )}
                            {/* Pourcentage */}
                            <span className={`text-xs font-bold ${
                              isComplete ? 'text-white' : 'text-white'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
                );
              })()}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
