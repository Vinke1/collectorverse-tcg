-- Migration pour ajouter la gestion des dates de sortie par région
-- Créé le : 2025-01-18

-- Créer la table pour les dates de sortie par région
CREATE TABLE series_releases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  region VARCHAR(10) NOT NULL, -- 'FR', 'US', 'JP', 'EU', etc.
  release_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(series_id, region)
);

-- Créer un index pour les recherches par série
CREATE INDEX idx_series_releases_series ON series_releases(series_id);

-- Activer RLS
ALTER TABLE series_releases ENABLE ROW LEVEL SECURITY;

-- Politique RLS : tout le monde peut lire
CREATE POLICY "Enable read access for all users" ON series_releases
  FOR SELECT USING (true);

-- Insérer les données existantes pour FAB (FR)
INSERT INTO series_releases (series_id, region, release_date)
SELECT id, 'FR', '2025-08-29'
FROM series
WHERE code = 'FAB';

-- Note : le champ release_date dans la table series peut être conservé
-- comme date de sortie "principale" ou "globale" pour compatibilité
-- Mais on utilisera series_releases pour afficher les dates spécifiques par région
