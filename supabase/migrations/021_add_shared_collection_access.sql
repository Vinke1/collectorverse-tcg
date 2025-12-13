-- Migration: Add RLS policy for shared collection access
-- Allows reading user_collections when a valid share token exists
-- This is more secure than using a service role key

-- Create a function to check if a card belongs to a shared collection
-- This function checks if:
-- 1. The card's series has an active (non-expired) share
-- 2. The share belongs to the user_collection's owner
CREATE OR REPLACE FUNCTION public.can_access_shared_collection(
  p_user_id UUID,
  p_card_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM collection_shares cs
    INNER JOIN cards c ON c.series_id = cs.series_id
    WHERE cs.user_id = p_user_id
      AND c.id = p_card_id
      AND cs.expires_at > NOW()
  );
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.can_access_shared_collection(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_shared_collection(UUID, UUID) TO anon;

-- Add policy: Allow reading collections that have an active share
-- This policy allows anyone to read a user's collection items
-- IF there's a valid (non-expired) share for that series
CREATE POLICY "Allow read shared collections" ON user_collections
  FOR SELECT
  USING (
    -- Either the user owns the collection
    (SELECT auth.uid()) = user_id
    -- OR there's a valid share for this card's series
    OR public.can_access_shared_collection(user_id, card_id)
  );

-- Note: We need to drop and recreate the original SELECT policy
-- because PostgreSQL ORs all matching policies together
-- First, drop the existing policy
DROP POLICY IF EXISTS "Users can view their own collections" ON user_collections;

-- The new policy above now handles both cases:
-- 1. User viewing their own collection
-- 2. Anyone viewing a shared collection

COMMENT ON FUNCTION public.can_access_shared_collection IS 'Checks if a card belongs to an actively shared collection. Used by RLS policy.';
