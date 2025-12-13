"use client";

import { useState, useCallback } from "react";
import { EraAccordionItem } from "./era-accordion-item";
import { EraSeriesGrid } from "./era-series-grid";
import type { PokemonEra, PokemonSeries } from "@/lib/types/pokemon";

interface PokemonTimelineLayoutProps {
  eras: PokemonEra[];
}

export function PokemonTimelineLayout({ eras }: PokemonTimelineLayoutProps) {
  const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set());
  const [seriesCache, setSeriesCache] = useState<Map<string, PokemonSeries[]>>(new Map());

  // Toggle era expansion
  const handleToggleEra = useCallback((eraId: string) => {
    setExpandedEras(prev => {
      const next = new Set(prev);
      if (next.has(eraId)) {
        next.delete(eraId);
      } else {
        next.add(eraId);
      }
      return next;
    });
  }, []);

  // Cache series data when loaded
  const handleSeriesLoaded = useCallback((eraId: string, series: PokemonSeries[]) => {
    setSeriesCache(prev => new Map(prev).set(eraId, series));
  }, []);

  return (
    <div className="space-y-2">
      {eras.map((era) => (
        <EraAccordionItem
          key={era.id}
          era={era}
          isExpanded={expandedEras.has(era.id)}
          onToggle={() => handleToggleEra(era.id)}
        >
          <EraSeriesGrid
            eraId={era.id}
            cachedSeries={seriesCache.get(era.id)}
            onSeriesLoaded={(series) => handleSeriesLoaded(era.id, series)}
          />
        </EraAccordionItem>
      ))}
    </div>
  );
}
