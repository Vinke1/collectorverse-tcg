-- Migration pour corriger le search_path de la fonction update_updated_at_column
-- Cela résout le warning de sécurité Supabase

-- Recréer la fonction avec un search_path sécurisé
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Note: SECURITY DEFINER + SET search_path = public garantit que la fonction
-- s'exécute toujours dans le contexte du schéma public, empêchant les attaques
-- par injection de schéma.
