"use client";

import { useState, useCallback, useEffect } from "react";
import { SeriesTimeline } from "./series-timeline";
import { SeriesGrid } from "./series-grid";
import type { CollectionStatsByLanguage } from "@/app/series/[tcg]/page";

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

interface SeriesTimelineLayoutProps {
  series: Series[];
  tcgSlug: string;
  isLoggedIn?: boolean;
  collectionStats?: CollectionStatsByLanguage;
}

export function SeriesTimelineLayout({
  series,
  tcgSlug,
  isLoggedIn,
  collectionStats
}: SeriesTimelineLayoutProps) {
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);

  // Handle click on timeline item - scroll to series
  const handleTimelineClick = useCallback((seriesId: string) => {
    const element = document.getElementById(`series-${seriesId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveSeriesId(seriesId);
    }
  }, []);

  // Track which series is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const seriesId = entry.target.id.replace('series-', '');
            setActiveSeriesId(seriesId);
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '-100px 0px -100px 0px'
      }
    );

    // Observe all series elements
    series.forEach((serie) => {
      const element = document.getElementById(`series-${serie.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [series]);

  return (
    <div className="flex gap-6">
      {/* Timeline sidebar - hidden on mobile */}
      <div className="hidden lg:block w-40 flex-shrink-0">
        <SeriesTimeline
          series={series}
          tcgSlug={tcgSlug}
          activeSeriesId={activeSeriesId}
          onSeriesClick={handleTimelineClick}
        />
      </div>

      {/* Main content - series grid */}
      <div className="flex-1 min-w-0">
        <SeriesGrid
          series={series}
          tcgSlug={tcgSlug}
          isLoggedIn={isLoggedIn}
          collectionStats={collectionStats}
        />
      </div>
    </div>
  );
}
