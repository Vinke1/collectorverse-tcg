"use server";

import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import type {
  CreateShareLinkResult,
  RevokeShareLinkResult,
  GetSharedCollectionResult,
} from "@/lib/types/share";

const SHARE_EXPIRATION_DAYS = 1;

/**
 * Creates or retrieves an existing share link for a series
 */
export async function createShareLink(seriesId: string, language: string = "fr"): Promise<CreateShareLinkResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }

  // Check if an active share already exists for this series/language combination
  const { data: existingShare } = await supabase
    .from("collection_shares")
    .select("*")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("language", language)
    .single();

  // If share exists and not expired, return it
  if (existingShare && new Date(existingShare.expires_at) > new Date()) {
    return {
      success: true,
      token: existingShare.token,
      expiresAt: existingShare.expires_at,
    };
  }

  // Generate new token
  const token = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SHARE_EXPIRATION_DAYS);

  // Delete existing expired share if any
  if (existingShare) {
    await supabase
      .from("collection_shares")
      .delete()
      .eq("id", existingShare.id);
  }

  // Create new share
  const { data, error } = await supabase
    .from("collection_shares")
    .insert({
      user_id: user.id,
      series_id: seriesId,
      token,
      language,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { error: "Erreur lors de la création du lien" };
  }

  return {
    success: true,
    token: data.token,
    expiresAt: data.expires_at,
  };
}

/**
 * Revokes a share link for a series
 */
export async function revokeShareLink(seriesId: string, language: string = "fr"): Promise<RevokeShareLinkResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }

  const { error } = await supabase
    .from("collection_shares")
    .delete()
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("language", language);

  if (error) {
    return { error: "Erreur lors de la révocation" };
  }

  return { success: true };
}

/**
 * Gets shared collection data by token
 */
export async function getSharedCollection(token: string): Promise<GetSharedCollectionResult> {
  const supabase = await createClient();

  // Get share with series and TCG info
  const { data: share, error: shareError } = await supabase
    .from("collection_shares")
    .select(
      `
      *,
      series:series_id (
        id, name, code, max_set_base, master_set, image_url,
        tcg_game:tcg_game_id (id, name, slug)
      )
    `
    )
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (shareError || !share) {
    return { error: "Lien invalide ou expiré" };
  }

  // Increment view count
  await supabase
    .from("collection_shares")
    .update({ views_count: (share.views_count || 0) + 1 })
    .eq("id", share.id);

  // Get the language from the share (default to 'fr' for old shares without language)
  const shareLanguage = (share.language || 'fr').toLowerCase();

  // Get cards for this series filtered by the share's language
  // Use case-insensitive comparison for language
  const { data: allCards } = await supabase
    .from("cards")
    .select("*")
    .eq("series_id", share.series_id);

  // Filter cards by language (case-insensitive)
  const cards = allCards?.filter(
    (card) => (card.language || 'fr').toLowerCase() === shareLanguage
  ) || [];

  // Get owned cards with quantities - only if we have cards to check
  // RLS policy allows reading shared collections via can_access_shared_collection()
  const ownedCardIds: string[] = [];
  const collectionData: Record<string, { quantity: number; quantity_foil: number }> = {};

  if (cards.length > 0) {
    const cardIds = cards.map((c) => c.id);
    const { data: userCollection } = await supabase
      .from("user_collections")
      .select("card_id, owned, quantity, quantity_foil")
      .eq("user_id", share.user_id)
      .in("card_id", cardIds);

    // Create list of owned card IDs and collection data with quantities
    userCollection?.forEach((item) => {
      if (item.owned) {
        ownedCardIds.push(item.card_id);
      }
      collectionData[item.card_id] = {
        quantity: item.quantity || 0,
        quantity_foil: item.quantity_foil || 0,
      };
    });
  }

  const total = cards?.length || 0;
  const owned = ownedCardIds.length;

  // Type assertion for the nested series data
  const seriesData = share.series as {
    id: string;
    name: string;
    code: string;
    max_set_base: number | null;
    master_set: number | null;
    image_url: string | null;
    tcg_game: {
      id: string;
      name: string;
      slug: string;
    };
  };

  return {
    success: true,
    data: {
      share: {
        id: share.id,
        user_id: share.user_id,
        series_id: share.series_id,
        token: share.token,
        language: shareLanguage,
        expires_at: share.expires_at,
        created_at: share.created_at,
        views_count: share.views_count,
      },
      series: {
        id: seriesData.id,
        name: seriesData.name,
        code: seriesData.code,
        max_set_base: seriesData.max_set_base,
        master_set: seriesData.master_set,
        image_url: seriesData.image_url,
      },
      tcg: seriesData.tcg_game,
      cards: cards || [],
      ownedCardIds,
      collectionData,
      stats: {
        total,
        owned,
        missing: total - owned,
        percentage: total > 0 ? Math.round((owned / total) * 100) : 0,
      },
    },
  };
}
