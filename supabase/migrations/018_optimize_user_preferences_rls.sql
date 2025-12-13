-- Migration pour optimiser les politiques RLS de user_preferences
-- Remplace auth.uid() par (select auth.uid()) pour améliorer les performances
-- Cela évite que la fonction soit réévaluée pour chaque ligne

-- ========================================
-- user_preferences : Suppression des anciennes politiques
-- ========================================
DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

-- ========================================
-- user_preferences : Création des politiques optimisées
-- ========================================
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Note : L'utilisation de (select auth.uid()) au lieu de auth.uid() fait que
-- la fonction est évaluée une seule fois au début de la requête au lieu d'être
-- réévaluée pour chaque ligne. Cela améliore considérablement les performances
-- sur les grandes tables.
