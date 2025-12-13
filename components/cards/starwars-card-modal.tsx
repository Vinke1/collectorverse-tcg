"use client"

import Image from "next/image"
import { useState } from "react"
import { X, ImageIcon, Swords, Shield, Zap, Users, Tag, Palette, MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CollectionControl } from "./collection-control"
import { formatCardNumber } from "@/lib/utils/card-formatting"
import type { CardItem } from "@/lib/types/cards"
import type { CollectionData } from "./filtered-card-view"
import type { StarWarsAttributes } from "@/lib/types/cards"

interface StarWarsCardModalProps {
  card: CardItem
  isOpen: boolean
  onClose: () => void
  seriesCode: string
  maxSetBase?: number
  userId?: string
  collectionItem?: CollectionData
  onCollectionUpdate?: (cardId: string, data: Partial<CollectionData>) => void
}

// Mapping des aspects vers leurs couleurs
const ASPECT_COLORS: Record<string, string> = {
  vigilance: '#3B82F6',
  command: '#22C55E',
  aggression: '#EF4444',
  cunning: '#F59E0B',
  villainy: '#6B21A8',
  heroism: '#0EA5E9',
}

// Mapping des aspects vers leurs noms français
const ASPECT_NAMES: Record<string, string> = {
  vigilance: 'Vigilance',
  command: 'Commandement',
  aggression: 'Agression',
  cunning: 'Ruse',
  villainy: 'Infâmie',
  heroism: 'Héroïsme',
}

// Mapping des types de carte
const CARD_TYPE_NAMES: Record<string, string> = {
  leader: 'Leader',
  unit: 'Unité',
  event: 'Événement',
  upgrade: 'Amélioration',
  base: 'Base',
}

// Mapping des arènes
const ARENA_NAMES: Record<string, string> = {
  ground: 'Terrestre',
  space: 'Spatiale',
}

// Mapping des raretés
const RARITY_NAMES: Record<string, string> = {
  c: 'Commune',
  u: 'Peu commune',
  r: 'Rare',
  l: 'Légendaire',
  s: 'Spéciale',
  p: 'Promo',
}

export function StarWarsCardModal({
  card,
  isOpen,
  onClose,
  seriesCode,
  maxSetBase,
  userId,
  collectionItem,
  onCollectionUpdate,
}: StarWarsCardModalProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  const attrs = card.attributes as StarWarsAttributes | null
  const rarityLower = card.rarity?.toLowerCase() || ""

  // Déterminer si la carte est foil-only (Spéciale ou Légendaire par exemple)
  const isFoilOnly = rarityLower === 's' || rarityLower === 'l'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold text-starwars-gold flex items-center gap-2">
            {card.name}
          </DialogTitle>
          <p className="text-muted-foreground">
            {seriesCode} • {formatCardNumber(card.number, maxSetBase)} • {RARITY_NAMES[rarityLower] || card.rarity}
          </p>
        </DialogHeader>

        {/* Content - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left: Card Image */}
          <div className="relative">
            <div className="relative aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-xl bg-muted/30">
              {card.image_url && !imageError ? (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 bg-muted/50 animate-pulse" />
                  )}
                  <Image
                    src={card.image_url}
                    alt={card.name}
                    fill
                    className={`object-cover transition-opacity duration-300 ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageError(true)
                      setImageLoading(false)
                    }}
                    quality={90}
                    priority
                  />
                  {/* Foil effect for special cards */}
                  {isFoilOnly && <div className="foil-gradient" />}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          {/* Right: Card Details */}
          <div className="flex flex-col gap-4">
            {/* Informations générales */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Informations générales
              </h3>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {/* Type */}
                {attrs?.cardType && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">
                      {CARD_TYPE_NAMES[attrs.cardType] || attrs.cardType}
                    </span>
                  </div>
                )}

                {/* Langue */}
                {card.language && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Langue:</span>
                    <span className="font-medium">{card.language}</span>
                  </div>
                )}

                {/* Rareté */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Rareté:</span>
                  <span className="font-medium">
                    {RARITY_NAMES[rarityLower] || card.rarity}
                  </span>
                </div>

                {/* Illustrateur */}
                {attrs?.illustrator && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Illustrateur:</span>
                    <span className="font-medium">{attrs.illustrator}</span>
                  </div>
                )}
              </div>

              {/* Arènes */}
              {attrs?.arenas && attrs.arenas.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Arènes:</span>
                  {attrs.arenas.map((arena, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-full bg-muted text-xs font-medium"
                    >
                      {ARENA_NAMES[arena] || arena}
                    </span>
                  ))}
                </div>
              )}

              {/* Aspects */}
              {attrs?.aspects && attrs.aspects.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Aspects:</span>
                  {attrs.aspects.map((aspect, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: ASPECT_COLORS[aspect] || '#6B7280' }}
                    >
                      {ASPECT_NAMES[aspect] || aspect}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Face Avant */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Statistiques
              </h3>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {attrs?.cost !== undefined && (
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Zap className="w-5 h-5 text-yellow-500 mb-1" />
                    <span className="text-2xl font-bold">{attrs.cost}</span>
                    <span className="text-xs text-muted-foreground">Coût</span>
                  </div>
                )}

                {attrs?.power !== undefined && (
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Swords className="w-5 h-5 text-red-500 mb-1" />
                    <span className="text-2xl font-bold">{attrs.power}</span>
                    <span className="text-xs text-muted-foreground">Puissance</span>
                  </div>
                )}

                {attrs?.hp !== undefined && (
                  <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                    <Shield className="w-5 h-5 text-green-500 mb-1" />
                    <span className="text-2xl font-bold">{attrs.hp}</span>
                    <span className="text-xs text-muted-foreground">PV</span>
                  </div>
                )}
              </div>

              {/* Personnages */}
              {attrs?.characters && attrs.characters.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <span className="text-muted-foreground text-sm">Personnages: </span>
                    <span className="text-sm font-medium">
                      {attrs.characters.join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Traits */}
              {attrs?.traits && attrs.traits.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-muted-foreground mt-1" />
                  <span className="text-muted-foreground text-sm">Traits:</span>
                  {attrs.traits.map((trait, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-muted text-xs"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Collection Controls */}
            {userId && (
              <section className="mt-auto pt-4 border-t">
                <h3 className="text-sm font-medium mb-3">Ma collection</h3>
                <CollectionControl
                  cardId={card.id}
                  userId={userId}
                  initialNormal={collectionItem?.quantity || 0}
                  initialFoil={collectionItem?.quantity_foil || 0}
                  showNormal={!isFoilOnly}
                  showFoil={true}
                  compact={false}
                  onUpdate={onCollectionUpdate}
                />
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
