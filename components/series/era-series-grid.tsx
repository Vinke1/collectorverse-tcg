"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ImageOff } from "lucide-react";
import { fetchEraSeriesAction } from "@/app/series/[tcg]/actions";
import type { PokemonSeries } from "@/lib/types/pokemon";

interface EraSeriesGridProps {
  eraId: string;
  cachedSeries?: PokemonSeries[];
  onSeriesLoaded?: (series: PokemonSeries[]) => void;
}

export function EraSeriesGrid({ eraId, cachedSeries, onSeriesLoaded }: EraSeriesGridProps) {
  const [series, setSeries] = useState<PokemonSeries[]>(cachedSeries || []);
  const [isLoading, setIsLoading] = useState(!cachedSeries);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (cachedSeries) return;

    const loadSeries = async () => {
      setIsLoading(true);
      const data = await fetchEraSeriesAction(eraId);
      setSeries(data);
      onSeriesLoaded?.(data);
      setIsLoading(false);
    };

    loadSeries();
  }, [eraId, cachedSeries, onSeriesLoaded]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-pokemon-electric" />
        <span className="ml-3 text-muted-foreground">Chargement des series...</span>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune serie trouvee pour cette ere.
      </div>
    );
  }

  const handleImageError = (seriesId: string) => {
    setImageErrors(prev => new Set(prev).add(seriesId));
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.05 }
        }
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {series.map((serie) => (
        <motion.div
          key={serie.id}
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 }
          }}
        >
          <Link
            href={`/series/pokemon/${serie.code}`}
            className="block group"
          >
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden border-2 border-border hover:border-pokemon-electric transition-colors">
              {serie.image_url && !imageErrors.has(serie.id) ? (
                <Image
                  src={serie.image_url}
                  alt={serie.name}
                  fill
                  loading="lazy"
                  className="object-cover transition-transform group-hover:scale-105"
                  onError={() => handleImageError(serie.id)}
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pokemon-electric/20 to-pokemon-fire/20 flex items-center justify-center">
                  <ImageOff className="w-8 h-8 text-muted-foreground" />
                </div>
              )}

              {/* Overlay avec nom */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <h4 className="text-white font-semibold text-sm truncate">
                  {serie.name}
                </h4>
                {serie.official_card_count && (
                  <span className="text-white/70 text-xs">
                    {serie.official_card_count} cartes
                  </span>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
