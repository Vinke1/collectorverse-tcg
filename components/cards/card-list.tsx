"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState, memo } from "react";
import { CollectionControl } from "./collection-control";
import { normalizeRarity } from "@/lib/constants/rarities";
import { isFoilOnly, isStandardOnly, shouldShowFoilEffect } from "@/lib/utils/foil-detection";
import type { CardItem } from "@/lib/types/cards";
import type { CollectionData } from "./filtered-card-view";

// Map des icônes de rareté avec leurs extensions (dossier /images/icons/rarities/name/)
const RARITY_NAME_ICONS: Record<string, string> = {
  common: "/images/icons/rarities/name/common.svg",
  uncommon: "/images/icons/rarities/name/uncommon.svg",
  rare: "/images/icons/rarities/name/rare.svg",
  "super-rare": "/images/icons/rarities/name/super_rare.svg",
  legendary: "/images/icons/rarities/name/legendary.svg",
  epic: "/images/icons/rarities/name/epic.png",
  enchanted: "/images/icons/rarities/name/enchanted.png",
  iconic: "/images/icons/rarities/name/iconic.png",
  promo: "/images/icons/rarities/name/promo.webp",
};
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";


// Type pour les raretés TCG (venant de la base de données)
interface TcgRarity {
  code: string;
  name: string;
  icon_url?: string | null;
}

interface CardListProps {
  cards: CardItem[];
  seriesCode: string;
  maxSetBase?: number;
  selectedVersion?: string;
  tcgRarities?: TcgRarity[];
  userId?: string;
  collection?: Record<string, CollectionData>;
  onCollectionUpdate?: (cardId: string, data: Partial<CollectionData>) => void;
}

// Composant pour l'icone de rareté (utilise les icônes du dossier /name/ ou les icônes de la DB)
const RarityIcon = memo(function RarityIcon({
  rarity,
  tcgRarities = [],
}: {
  rarity: string | null;
  tcgRarities?: TcgRarity[];
}) {
  if (!rarity) {
    return <div className="w-5 h-5 rounded bg-muted" />;
  }

  // D'abord, chercher dans les raretés TCG de la DB (pour Riftbound, etc.)
  if (tcgRarities.length > 0) {
    const rarityLower = rarity.toLowerCase();
    const tcgRarity = tcgRarities.find(
      (r) => r.code.toLowerCase() === rarityLower || r.name.toLowerCase() === rarityLower
    );
    if (tcgRarity?.icon_url) {
      return (
        <Image
          src={tcgRarity.icon_url}
          alt={rarity}
          width={20}
          height={20}
          className="object-contain"
        />
      );
    }
  }

  // Fallback vers les icônes statiques Lorcana
  const normalizedRarity = normalizeRarity(rarity);
  const iconPath = normalizedRarity ? RARITY_NAME_ICONS[normalizedRarity] : null;

  if (!iconPath) {
    return <div className="w-5 h-5 rounded bg-muted" />;
  }

  return (
    <Image
      src={iconPath}
      alt={rarity}
      width={20}
      height={20}
      className="object-contain"
    />
  );
});

// Composant pour la preview de la carte
const CardPreview = memo(function CardPreview({
  src,
  alt,
  showFoilEffect = false,
}: {
  src: string;
  alt: string;
  showFoilEffect?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError || !src) {
    return (
      <div className="w-[200px] h-[280px] flex items-center justify-center bg-muted/30 rounded-xl">
        <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <div className="relative w-[200px] h-[280px] rounded-xl overflow-hidden shadow-xl">
      {isLoading && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse rounded-xl" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-200 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        quality={85}
      />
      {/* Effet foil holographique */}
      {showFoilEffect && <div className="foil-gradient" />}
    </div>
  );
});

// Individual card list item - memoized for performance
const CardListItem = memo(function CardListItem({
  card,
  seriesCode,
  maxSetBase,
  selectedVersion,
  userId,
  collectionItem,
  onCollectionUpdate,
  tcgRarities,
}: {
  card: CardItem;
  seriesCode: string;
  maxSetBase?: number;
  selectedVersion: string;
  userId?: string;
  collectionItem?: CollectionData;
  onCollectionUpdate?: (cardId: string, data: Partial<CollectionData>) => void;
  tcgRarities?: TcgRarity[];
}) {
  // Déterminer si la carte est foil-only ou standard-only
  // Type assertion needed because is_foil is Riftbound-specific
  const isFoilAttr = (card.attributes as { is_foil?: boolean } | null)?.is_foil;
  const cardIsFoilOnly = isFoilOnly(card.rarity, seriesCode, isFoilAttr);
  const cardIsStandardOnly = isStandardOnly(isFoilAttr);

  // Afficher l'effet foil quand le filtre foil est actif OU quand la carte est foil-only
  const showFoilEffect = shouldShowFoilEffect(selectedVersion, card.rarity, seriesCode, isFoilAttr);

  // Determine background color based on rarity
  const getRarityBgClass = () => {
    const normalizedRarity = normalizeRarity(card.rarity || "");
    switch (normalizedRarity) {
      case "common":
        return "bg-gray-800/50 hover:bg-gray-800/70";
      case "uncommon":
        return "bg-gray-700/50 hover:bg-gray-700/70";
      case "rare":
        return "bg-amber-900/30 hover:bg-amber-900/50";
      case "super-rare":
        return "bg-amber-800/30 hover:bg-amber-800/50";
      case "legendary":
        return "bg-yellow-900/30 hover:bg-yellow-900/50";
      case "enchanted":
        return "bg-purple-900/30 hover:bg-purple-900/50";
      case "epic":
        return "bg-violet-900/30 hover:bg-violet-900/50";
      case "iconic":
        return "bg-pink-900/30 hover:bg-pink-900/50";
      case "d100":
        return "bg-blue-900/30 hover:bg-blue-900/50";
      case "d23":
        return "bg-cyan-900/30 hover:bg-cyan-900/50";
      case "promo":
        return "bg-emerald-900/30 hover:bg-emerald-900/50";
      default:
        return "bg-muted/30 hover:bg-muted/50";
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${getRarityBgClass()}`}
        >
          {/* Rarity icon */}
          <RarityIcon rarity={card.rarity} tcgRarities={tcgRarities} />

          {/* Card number + name */}
          <span className="text-sm flex-1 truncate">
            <span className="font-mono text-muted-foreground">{card.number}.</span>{" "}
            <span className="font-medium">{card.name}</span>
          </span>

          {/* Collection controls */}
          {userId && (
            <div
              className="flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <CollectionControl
                cardId={card.id}
                userId={userId}
                initialNormal={collectionItem?.quantity || 0}
                initialFoil={collectionItem?.quantity_foil || 0}
                showNormal={
                  !cardIsFoilOnly &&
                  (selectedVersion === "all" || selectedVersion === "normal")
                }
                showFoil={
                  !cardIsStandardOnly &&
                  (selectedVersion === "all" || selectedVersion === "foil")
                }
                onUpdate={onCollectionUpdate}
                compact
              />
            </div>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto p-2">
        <CardPreview src={card.image_url || ""} alt={card.name} showFoilEffect={showFoilEffect} />
      </HoverCardContent>
    </HoverCard>
  );
});

export function CardList({
  cards,
  seriesCode,
  maxSetBase,
  selectedVersion = "all",
  tcgRarities = [],
  userId,
  collection = {},
  onCollectionUpdate,
}: CardListProps) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-16">
        <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
        <p className="text-muted-foreground text-lg">
          Aucune carte disponible pour le moment.
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          Les cartes seront ajoutees prochainement !
        </p>
      </div>
    );
  }

  // Split cards into columns for multi-column layout
  const columnCount = 4;
  const itemsPerColumn = Math.ceil(cards.length / columnCount);
  const columns: CardItem[][] = [];
  for (let i = 0; i < columnCount; i++) {
    columns.push(cards.slice(i * itemsPerColumn, (i + 1) * itemsPerColumn));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-1">
          {column.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              seriesCode={seriesCode}
              maxSetBase={maxSetBase}
              selectedVersion={selectedVersion}
              userId={userId}
              collectionItem={collection[card.id]}
              onCollectionUpdate={onCollectionUpdate}
              tcgRarities={tcgRarities}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
