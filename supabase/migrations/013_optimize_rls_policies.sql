-- Migration pour optimiser les politiques RLS
-- Remplace auth.uid() par (select auth.uid()) pour améliorer les performances
-- Cela évite que la fonction soit réévaluée pour chaque ligne

-- ========================================
-- user_collections : Suppression des anciennes politiques
-- ========================================
DROP POLICY IF EXISTS "Users can view their own collections" ON user_collections;
DROP POLICY IF EXISTS "Users can insert their own collections" ON user_collections;
DROP POLICY IF EXISTS "Users can update their own collections" ON user_collections;
DROP POLICY IF EXISTS "Users can delete their own collections" ON user_collections;

-- ========================================
-- user_collections : Création des politiques optimisées
-- ========================================
CREATE POLICY "Users can view their own collections" ON user_collections
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own collections" ON user_collections
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own collections" ON user_collections
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own collections" ON user_collections
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ========================================
-- wishlists : Suppression des anciennes politiques
-- ========================================
DROP POLICY IF EXISTS "Users can view their own wishlists" ON wishlists;
DROP POLICY IF EXISTS "Users can insert their own wishlists" ON wishlists;
DROP POLICY IF EXISTS "Users can update their own wishlists" ON wishlists;
DROP POLICY IF EXISTS "Users can delete their own wishlists" ON wishlists;

-- ========================================
-- wishlists : Création des politiques optimisées
-- ========================================
CREATE POLICY "Users can view their own wishlists" ON wishlists
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own wishlists" ON wishlists
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own wishlists" ON wishlists
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own wishlists" ON wishlists
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Note : L'utilisation de (select auth.uid()) au lieu de auth.uid() fait que
-- la fonction est évaluée une seule fois au début de la requête au lieu d'être
-- réévaluée pour chaque ligne. Cela améliore considérablement les performances
-- sur les grandes tables.
