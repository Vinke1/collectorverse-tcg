/**
 * Types for collection sharing functionality
 */

export interface CollectionShare {
  id: string;
  user_id: string;
  series_id: string;
  token: string;
  language: string;
  expires_at: string;
  created_at: string;
  views_count: number;
}

export interface SharedCollectionData {
  share: CollectionShare;
  series: {
    id: string;
    name: string;
    code: string;
    max_set_base: number | null;
    master_set: number | null;
    image_url: string | null;
  };
  tcg: {
    id: string;
    name: string;
    slug: string;
  };
  cards: Array<{
    id: string;
    name: string;
    number: string;
    language: string | null;
    chapter: number | null;
    rarity: string | null;
    image_url: string | null;
    attributes: Record<string, unknown> | null;
  }>;
  ownedCardIds: string[];
  collectionData: Record<string, { quantity: number; quantity_foil: number }>;
  stats: {
    total: number;
    owned: number;
    missing: number;
    percentage: number;
  };
}

export type ShareFilter = "all" | "owned" | "missing";

export interface CreateShareLinkResult {
  success?: boolean;
  error?: string;
  token?: string;
  expiresAt?: string;
}

export interface RevokeShareLinkResult {
  success?: boolean;
  error?: string;
}

export interface GetSharedCollectionResult {
  success?: boolean;
  error?: string;
  data?: SharedCollectionData;
}
