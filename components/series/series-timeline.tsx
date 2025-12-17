"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/components/providers/language-provider";

interface Series {
  id: string;
  name: string;
  code: string;
  release_date: string | null;
}

interface SeriesTimelineProps {
  series: Series[];
  tcgSlug: string;
  activeSeriesId: string | null;
  onSeriesClick: (seriesId: string) => void;
}

export function SeriesTimeline({ series, tcgSlug, activeSeriesId, onSeriesClick }: SeriesTimelineProps) {
  const { t } = useLanguage();

  // Get translated series name based on TCG and series code
  const getSeriesName = (serie: Series): string => {
    const tcgTranslations = (t.series as Record<string, Record<string, string>>)[tcgSlug];
    if (tcgTranslations && tcgTranslations[serie.code]) {
      return tcgTranslations[serie.code];
    }
    return serie.name;
  };

  // Get abbreviated name for timeline (first letters or code)
  const getAbbreviatedName = (serie: Series): string => {
    const fullName = getSeriesName(serie);
    // If it's a short code (like OP01, SOR, etc.), use it directly
    if (serie.code.length <= 5) {
      return serie.code;
    }
    // Otherwise, use first letters of each word (max 4 chars)
    const words = fullName.split(' ');
    if (words.length === 1) {
      return fullName.substring(0, 4).toUpperCase();
    }
    return words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
  };

  // Format release date for display
  const formatYear = (date: string | null): string => {
    if (!date) return '';
    return new Date(date).getFullYear().toString();
  };

  // Group series by year
  const seriesByYear = series.reduce((acc, serie) => {
    const year = serie.release_date ? formatYear(serie.release_date) : 'N/A';
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(serie);
    return acc;
  }, {} as Record<string, Series[]>);

  const years = Object.keys(seriesByYear).sort((a, b) => {
    if (a === 'N/A') return 1;
    if (b === 'N/A') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-amber-500/30 scrollbar-track-transparent pr-2">
      <nav className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/50 via-amber-400/30 to-amber-500/50" />

        <div className="space-y-4">
          {years.map((year, yearIndex) => (
            <div key={year}>
              {/* Year marker */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: yearIndex * 0.05 }}
                className="flex items-center gap-2 mb-2"
              >
                <div className="w-6 h-6 rounded-full bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <span className="text-xs font-bold text-amber-500/80">{year}</span>
              </motion.div>

              {/* Series in this year */}
              <div className="ml-8 space-y-1">
                {seriesByYear[year].map((serie, index) => {
                  const isActive = activeSeriesId === serie.id;

                  return (
                    <motion.button
                      key={serie.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (yearIndex * 0.05) + (index * 0.02) }}
                      onClick={() => onSeriesClick(serie.id)}
                      className={`
                        block w-full text-left px-3 py-1.5 rounded-md text-sm
                        transition-all duration-200 group
                        ${isActive
                          ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }
                      `}
                      title={getSeriesName(serie)}
                    >
                      <span className="block truncate">
                        {getAbbreviatedName(serie)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
