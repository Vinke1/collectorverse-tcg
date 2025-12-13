"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Layers, Star, FileText, LayoutGrid, List, Check, XCircle } from "lucide-react";
import type { ViewMode, OwnershipFilter } from "./filtered-card-view";
import type { LanguageCollectionStats, TcgAttribute } from "@/app/series/[tcg]/[code]/page";
import type { CardItem } from "@/lib/types/cards";
import { ExportButton } from "./export-button";
import { ShareButton } from "@/components/share/share-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { useLanguage } from "@/components/providers/language-provider";
import { getAllRarities } from "@/lib/constants/rarities";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/app-config";

interface CardFiltersHorizontalProps {
  tcgSlug: string;
  searchName: string;
  setSearchName: (value: string) => void;
  searchNumber: string;
  setSearchNumber: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  selectedInks: string[];
  setSelectedInks: (value: string[]) => void;
  selectedRarities: string[];
  setSelectedRarities: (value: string[]) => void;
  selectedDomains: string[];
  setSelectedDomains: (value: string[]) => void;
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
  selectedVersion: string;
  setSelectedVersion: (value: string) => void;
  ownershipFilter: OwnershipFilter;
  setOwnershipFilter: (value: OwnershipFilter) => void;
  availableRarities: string[];
  availableRaritiesRaw?: string[];
  availableLanguages: string[];
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  isLoggedIn?: boolean;
  collectionStats?: LanguageCollectionStats;
  tcgDomains?: TcgAttribute[];
  tcgRarities?: TcgAttribute[];
  // Export & Share props
  cards?: CardItem[];
  seriesId?: string;
  seriesName?: string;
  seriesCode?: string;
  maxSetBase?: number;
  masterSet?: number;
}

export function CardFiltersHorizontal({
  tcgSlug,
  searchName,
  setSearchName,
  searchNumber,
  setSearchNumber,
  sortBy,
  setSortBy,
  selectedInks,
  setSelectedInks,
  selectedRarities,
  setSelectedRarities,
  selectedDomains,
  setSelectedDomains,
  selectedLanguage,
  setSelectedLanguage,
  selectedVersion,
  setSelectedVersion,
  ownershipFilter,
  setOwnershipFilter,
  availableRarities,
  availableRaritiesRaw = [],
  availableLanguages,
  viewMode,
  setViewMode,
  isLoggedIn,
  collectionStats,
  tcgDomains = [],
  tcgRarities = [],
  cards,
  seriesId,
  seriesName,
  seriesCode,
  maxSetBase,
  masterSet,
}: CardFiltersHorizontalProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  const allRarities = getAllRarities();

  // Utiliser les raretés TCG si disponibles (Riftbound, Pokemon), sinon les raretés par défaut (Lorcana)
  const hasCustomRarities = tcgRarities.length > 0;
  const hasDomains = tcgDomains.length > 0;

  // Filtrer les raretés TCG pour n'afficher que celles présentes dans les cartes de la série
  const filteredTcgRarities = hasCustomRarities
    ? tcgRarities.filter((rarity) =>
        availableRaritiesRaw.includes(rarity.code.toLowerCase())
      )
    : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleRarity = (rarityId: string) => {
    setSelectedRarities(
      selectedRarities.includes(rarityId)
        ? selectedRarities.filter((r) => r !== rarityId)
        : [...selectedRarities, rarityId]
    );
  };

  const toggleDomain = (domainCode: string) => {
    setSelectedDomains(
      selectedDomains.includes(domainCode)
        ? selectedDomains.filter((d) => d !== domainCode)
        : [...selectedDomains, domainCode]
    );
  };

  const clearFilters = () => {
    setSearchName("");
    setSearchNumber("");
    setSortBy("number");
    setSelectedInks([]);
    setSelectedRarities([]);
    setSelectedDomains([]);
    setSelectedLanguage("fr");
    setSelectedVersion("all");
    setOwnershipFilter("all");
  };

  const hasActiveFilters =
    searchName ||
    searchNumber ||
    sortBy !== "number" ||
    selectedInks.length > 0 ||
    selectedRarities.length > 0 ||
    selectedDomains.length > 0 ||
    selectedLanguage !== "fr" ||
    selectedVersion !== "all" ||
    ownershipFilter !== "all";

  const sortOptions = [
    { value: "number", label: t.filters.sortBy.options.number },
    { value: "name", label: t.filters.sortBy.options.name },
    { value: "rarity", label: t.filters.sortBy.options.rarity },
  ];

  const filteredRarities = allRarities.filter((rarity) =>
    availableRarities.includes(rarity.id)
  );

  return (
    <div className="space-y-3">
      {/* Première ligne : Recherches + Tri + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Recherche par nom */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t.filters.search.name.placeholder}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-10 h-9 bg-background/50"
          />
        </div>

        {/* Recherche par numéro */}
        <div className="relative w-[120px]">
          <Input
            placeholder={t.filters.search.number.placeholder}
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            className="h-9 bg-background/50"
          />
        </div>

        {/* Tri */}
        {mounted && (
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-9 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Séparateur visuel */}
        <div className="hidden sm:block w-px h-6 bg-border/50" />

        {/* Langue avec pourcentage de collection */}
        <div className="flex gap-1.5">
          {SUPPORTED_LANGUAGES.filter((lang) => availableLanguages.includes(lang.code)).map((lang) => {
            // Récupérer le pourcentage pour cette langue (seulement après montage pour éviter hydration mismatch)
            const langStats = mounted ? collectionStats?.[lang.code] : undefined;
            const percentage = langStats?.percentage;
            const isComplete = percentage === 100;
            const showBadge = mounted && isLoggedIn && langStats;

            return (
              <div key={lang.code} className="relative">
                <button
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden transition-all ${
                    selectedLanguage === lang.code
                      ? "ring-2 ring-primary scale-105"
                      : "opacity-60 hover:opacity-100 hover:scale-105"
                  }`}
                  title={lang.label}
                >
                  <Image
                    src={lang.flag}
                    alt={lang.label}
                    width={36}
                    height={36}
                    className="object-cover"
                  />
                </button>
                {/* Badge pourcentage - visible uniquement si connecté, stats disponibles et monté */}
                {showBadge && (
                  <div
                    className={`absolute -bottom-1 -right-1 px-1 min-w-[24px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${
                      isComplete
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-white border border-slate-600"
                    }`}
                  >
                    {percentage}%
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Version */}
        <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
          <button
            onClick={() => setSelectedVersion("all")}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              selectedVersion === "all"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
            title={t.filters.version.all}
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedVersion("normal")}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              selectedVersion === "normal"
                ? "bg-blue-500 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
            title={t.filters.version.normal}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedVersion("foil")}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              selectedVersion === "foil"
                ? "bg-gradient-to-r from-orange-500 via-yellow-500 to-green-500 text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
            title={t.filters.version.foil}
          >
            <Star className={`w-4 h-4 ${selectedVersion === 'foil' ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Filtre possession (seulement si connecté) */}
        {isLoggedIn && (
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
            <button
              onClick={() => setOwnershipFilter("all")}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                ownershipFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
              title="Toutes les cartes"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOwnershipFilter("owned")}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                ownershipFilter === "owned"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
              title="Cartes possédées"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOwnershipFilter("missing")}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
                ownershipFilter === "missing"
                  ? "bg-red-500 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
              title="Cartes manquantes"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Séparateur visuel */}
        <div className="hidden sm:block w-px h-6 bg-border/50" />

        {/* Toggle vue (Grille/Liste) */}
        <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              viewMode === "grid"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
            title="Vue grille"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-white/10"
            }`}
            title="Vue liste"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Export Excel - Only for logged-in users */}
        {isLoggedIn && cards && seriesName && seriesCode && (
          <ExportButton
            cards={cards}
            seriesName={seriesName}
            seriesCode={seriesCode}
            maxSetBase={maxSetBase}
            masterSet={masterSet}
            tcgSlug={tcgSlug}
            selectedLanguage={selectedLanguage}
          />
        )}

        {/* Share Collection - Only for logged-in users */}
        {isLoggedIn && seriesId && seriesName && (
          <ShareButton
            seriesId={seriesId}
            seriesName={seriesName}
            tcgSlug={tcgSlug}
            selectedLanguage={selectedLanguage}
          />
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-3 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">{t.filters.clear}</span>
          </Button>
        )}
      </div>

      {/* Deuxième ligne : Domain & Rarity */}
      {(hasDomains || filteredTcgRarities.length > 0 || filteredRarities.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30">
          {/* Section Domain (Riftbound uniquement) */}
          {hasDomains && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domain</span>
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    {tcgDomains.map((domain) => (
                      <Tooltip key={domain.code}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleDomain(domain.code)}
                            className={`p-1 rounded-lg transition-all ${
                              selectedDomains.includes(domain.code)
                                ? "bg-primary/20 ring-2 ring-primary scale-110"
                                : "hover:bg-secondary/50 hover:scale-105 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="relative w-8 h-8">
                              {domain.icon_url ? (
                                <Image
                                  src={domain.icon_url}
                                  alt={domain.name}
                                  fill
                                  className="object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary rounded text-xs font-bold">
                                  {domain.name.slice(0, 2)}
                                </div>
                              )}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{domain.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>

              {/* Séparateur entre Domain et Rarity */}
              <div className="w-px h-6 bg-border/50" />
            </>
          )}

          {/* Section Rarity */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rarity</span>
            <TooltipProvider>
              <div className="flex items-center gap-1">
                {filteredTcgRarities.length > 0 ? (
                  /* Raretés TCG (Riftbound, Pokemon) - filtrées par raretés présentes dans la série */
                  filteredTcgRarities.map((rarity) => (
                    <button
                      key={rarity.code}
                      onClick={() => toggleRarity(rarity.code)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium ${
                        selectedRarities.includes(rarity.code)
                          ? "bg-primary/20 ring-2 ring-primary scale-105 text-foreground"
                          : "bg-secondary/50 hover:bg-secondary hover:scale-105 opacity-70 hover:opacity-100 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {rarity.icon_url ? (
                        <div className="relative w-8 h-8">
                          <Image
                            src={rarity.icon_url}
                            alt={rarity.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <span>{rarity.code}</span>
                      )}
                    </button>
                  ))
                ) : (
                  /* Raretés par défaut (Lorcana) */
                  filteredRarities.map((rarity) => (
                    <Tooltip key={rarity.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleRarity(rarity.id)}
                          className={`p-1 rounded-lg transition-all ${
                            selectedRarities.includes(rarity.id)
                              ? "bg-primary/20 ring-2 ring-primary scale-110"
                              : "hover:bg-secondary/50 hover:scale-105 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div className="relative w-8 h-8">
                            <Image
                              src={rarity.icon}
                              alt={t.filters.rarities.items[rarity.id as keyof typeof t.filters.rarities.items]}
                              fill
                              className="object-contain"
                            />
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t.filters.rarities.items[rarity.id as keyof typeof t.filters.rarities.items]}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))
                )}
              </div>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
}
