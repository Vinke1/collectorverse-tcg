"use client";

import { useLanguage } from "@/components/providers/language-provider";

interface SeriesPageHeaderProps {
  tcgName: string;
}

export function SeriesPageHeader({ tcgName }: SeriesPageHeaderProps) {
  const { t, language } = useLanguage();

  // Mapping simple pour les noms de TCG si nécessaire, ou utilisation directe
  // Ici on utilise la structure des traductions pour récupérer le nom si possible,
  // sinon on utilise tcgName tel quel (souvent le nom anglais/international).
  
  // Pour le titre complet "Séries [TCG]"
  // En FR: "Séries Disney Lorcana"
  // En EN: "Disney Lorcana Series"
  // En JP: "Disney Lorcana シリーズ"
  
  const getTitle = () => {
    if (language === 'fr') return `${t.series.page.title} ${tcgName}`;
    if (language === 'jp') return `${tcgName} ${t.series.page.title}`;
    return `${tcgName} ${t.series.page.title}`;
  };

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-2">{getTitle()}</h1>
      <p className="text-muted-foreground text-lg">
        {t.series.page.subtitle}
      </p>
    </div>
  );
}

