"use client";

import { useLanguage } from "@/components/providers/language-provider";
import Link from "next/link";

interface SeriesDetailHeaderProps {
  tcgSlug: string;
  seriesName: string;
  cardsCount: number;
}

export function SeriesDetailHeader({
  tcgSlug,
  seriesName,
  cardsCount,
}: SeriesDetailHeaderProps) {
  const { t } = useLanguage();

  // Récupérer le nom traduit du TCG depuis les traductions nav
  const translatedTcgName = t.nav[tcgSlug as keyof typeof t.nav] || tcgSlug.charAt(0).toUpperCase() + tcgSlug.slice(1);

  return (
    <div className="flex-shrink-0">
      {/* Fil d'ariane avec nombre de cartes */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/series/${tcgSlug}`} className="text-muted-foreground hover:text-foreground smooth-transition">
          {translatedTcgName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-foreground font-medium">{seriesName}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {cardsCount} {t.series.grid.cards_suffix}
        </span>
      </div>
    </div>
  );
}

