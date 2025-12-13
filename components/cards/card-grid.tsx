"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState, memo } from "react";
import { CollectionControl } from "./collection-control";
import { StarWarsCardModal } from "./starwars-card-modal";
import { formatCardNumber } from "@/lib/utils/card-formatting";
import { isFoilOnly, isStandardOnly, shouldShowFoilEffect } from "@/lib/utils/foil-detection";
import type { CardItem } from "@/lib/types/cards";
import type { CollectionData } from "./filtered-card-view";

interface CardGridProps {
  cards: CardItem[];
  seriesCode: string;
  maxSetBase?: number;
  selectedVersion?: string;
  userId?: string;
  collection?: Record<string, CollectionData>;
  onCollectionUpdate?: (cardId: string, data: Partial<CollectionData>) => void;
  tcgSlug?: string;
}

// Détecter si une carte Naruto Kayou est en format horizontal
// Les cartes R-111 à R-210 sont des images horizontales (screenshots d'anime)
function isHorizontalNarutoCard(cardNumber: string): boolean {
  if (!cardNumber.startsWith('R-')) return false;
  const num = parseInt(cardNumber.replace('R-', ''), 10);
  return num >= 111 && num <= 210;
}

// Composant pour gérer les erreurs d'image de carte
const CardImage = memo(function CardImage({
  src,
  alt,
  priority = false,
  isHorizontal = false
}: {
  src: string;
  alt: string;
  priority?: boolean;
  isHorizontal?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse rounded-xl" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className={`${isHorizontal ? 'object-contain' : 'object-cover'} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 18vw"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        quality={75}
      />
    </>
  );
});

// Individual card component - memoized for performance
const CardGridItem = memo(function CardGridItem({
  card,
  seriesCode,
  maxSetBase,
  selectedVersion,
  userId,
  collectionItem,
  onCollectionUpdate,
  isPriority = false,
  onCardClick,
}: {
  card: CardItem;
  seriesCode: string;
  maxSetBase?: number;
  selectedVersion: string;
  userId?: string;
  collectionItem?: CollectionData;
  onCollectionUpdate?: (cardId: string, data: Partial<CollectionData>) => void;
  isPriority?: boolean;
  onCardClick?: (card: CardItem) => void;
}) {
  // Déterminer si la carte est foil-only ou standard-only
  // Type assertion needed because is_foil is Riftbound-specific
  const isFoilAttr = (card.attributes as { is_foil?: boolean } | null)?.is_foil;
  const cardIsFoilOnly = isFoilOnly(card.rarity, seriesCode, isFoilAttr);
  const cardIsStandardOnly = isStandardOnly(isFoilAttr);

  // Afficher l'effet foil quand le filtre foil est actif OU quand la carte est foil-only
  const showFoilEffect = shouldShowFoilEffect(selectedVersion, card.rarity, seriesCode, isFoilAttr);

  // Détecter si c'est une carte Naruto horizontale
  const isHorizontal = isHorizontalNarutoCard(card.number);

  return (
    <div
      className="group cursor-pointer flex flex-col"
      onClick={() => onCardClick?.(card)}
    >
      {/* Image de la carte - style Lorcahub */}
      {/* Utiliser aspect-[3/2] pour les cartes horizontales, aspect-[2.5/3.5] pour les verticales */}
      <div className={`relative ${isHorizontal ? 'aspect-[3/2]' : 'aspect-[2.5/3.5]'} rounded-xl overflow-hidden shadow-lg hover:shadow-[0_0_25px_rgba(147,112,219,0.5)] hover:scale-[1.03] transition-all duration-300 will-change-transform ring-2 ring-transparent hover:ring-purple-400/50 ${isHorizontal ? 'bg-black/20' : ''}`}>
        {card.image_url ? (
          <>
            <CardImage src={card.image_url} alt={card.name} priority={isPriority} isHorizontal={isHorizontal} />
            {/* Effet foil holographique */}
            {showFoilEffect && <div className="foil-gradient" />}
            {/* Overlay gradient pour le numéro */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
              <span className="text-white text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {formatCardNumber(card.number, maxSetBase)}
              </span>
              {card.rarity && (
                <span className="text-white text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {card.rarity}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
          </div>
        )}
      </div>

      {/* Nom de la carte */}
      <h3 className="text-sm font-medium line-clamp-2 mt-2 px-1 text-center group-hover:text-primary transition-colors duration-200">
        {card.name}
      </h3>

      {/* Collection Control - sous la carte */}
      {userId && (
        <div
          className="mt-1 px-1"
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
          />
        </div>
      )}
    </div>
  );
});

export function CardGrid({
  cards,
  seriesCode,
  maxSetBase,
  selectedVersion = "all",
  userId,
  collection = {},
  onCollectionUpdate,
  tcgSlug,
}: CardGridProps) {
  // State for Star Wars card modal
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  // Handle card click - only open modal for Star Wars
  const handleCardClick = (card: CardItem) => {
    if (tcgSlug === 'starwars') {
      setSelectedCard(card);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="text-center py-16">
        <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
        <p className="text-muted-foreground text-lg">
          Aucune carte disponible pour le moment.
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          Les cartes seront ajoutées prochainement !
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
        {cards.map((card, index) => (
          <CardGridItem
            key={card.id}
            card={card}
            seriesCode={seriesCode}
            maxSetBase={maxSetBase}
            selectedVersion={selectedVersion}
            userId={userId}
            collectionItem={collection[card.id]}
            onCollectionUpdate={onCollectionUpdate}
            isPriority={index < 10}
            onCardClick={tcgSlug === 'starwars' ? handleCardClick : undefined}
          />
        ))}
      </div>

      {/* Star Wars Card Detail Modal */}
      {tcgSlug === 'starwars' && selectedCard && (
        <StarWarsCardModal
          card={selectedCard}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          seriesCode={seriesCode}
          maxSetBase={maxSetBase}
          userId={userId}
          collectionItem={collection[selectedCard.id]}
          onCollectionUpdate={onCollectionUpdate}
        />
      )}
    </>
  );
}
