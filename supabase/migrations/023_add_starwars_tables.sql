-- Migration: Add Star Wars Unlimited TCG
-- Date: 2025-12-10

-- ============================================
-- 1. INSERT STAR WARS UNLIMITED TCG
-- ============================================
INSERT INTO tcg_games (name, slug, description, icon, gradient)
VALUES (
  'Star Wars: Unlimited',
  'starwars',
  'Le jeu de cartes à collectionner Star Wars: Unlimited par Fantasy Flight Games',
  '/images/tcg/starwars.webp',
  'from-yellow-400 via-orange-500 to-red-600'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  gradient = EXCLUDED.gradient;

-- ============================================
-- 2. CREATE ARENAS TABLE (Terrestre, Spatiale)
-- ============================================
CREATE TABLE IF NOT EXISTS arenas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  icon_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_arenas_tcg_game ON arenas(tcg_game_id);

-- RLS Policy
ALTER TABLE arenas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON arenas FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_arenas_updated_at BEFORE UPDATE ON arenas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. CREATE ASPECTS TABLE (Vigilance, Infâmie, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS aspects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  name_en VARCHAR(50),
  code VARCHAR(20) NOT NULL,
  icon_url TEXT,
  hex_color VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_aspects_tcg_game ON aspects(tcg_game_id);

-- RLS Policy
ALTER TABLE aspects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON aspects FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_aspects_updated_at BEFORE UPDATE ON aspects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. INSERT STAR WARS DATA
-- ============================================
DO $$
DECLARE
  starwars_id UUID;
BEGIN
  SELECT id INTO starwars_id FROM tcg_games WHERE slug = 'starwars';

  IF starwars_id IS NULL THEN
    RAISE EXCEPTION 'Star Wars Unlimited TCG not found in tcg_games table';
  END IF;

  -- ============================================
  -- Insert Arenas (2 types)
  -- ============================================
  INSERT INTO arenas (tcg_game_id, name, code, sort_order) VALUES
    (starwars_id, 'Terrestre', 'ground', 1),
    (starwars_id, 'Spatiale', 'space', 2)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Aspects (6 types)
  -- ============================================
  INSERT INTO aspects (tcg_game_id, name, name_en, code, hex_color, sort_order) VALUES
    (starwars_id, 'Vigilance', 'Vigilance', 'vigilance', '#3B82F6', 1),
    (starwars_id, 'Commandement', 'Command', 'command', '#22C55E', 2),
    (starwars_id, 'Agression', 'Aggression', 'aggression', '#EF4444', 3),
    (starwars_id, 'Ruse', 'Cunning', 'cunning', '#F59E0B', 4),
    (starwars_id, 'Infâmie', 'Villainy', 'villainy', '#6B21A8', 5),
    (starwars_id, 'Héroïsme', 'Heroism', 'heroism', '#0EA5E9', 6)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    hex_color = EXCLUDED.hex_color,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Card Types (5 types)
  -- ============================================
  INSERT INTO card_types (tcg_game_id, name, code, is_supertype, sort_order) VALUES
    (starwars_id, 'Leader', 'leader', false, 1),
    (starwars_id, 'Unité', 'unit', false, 2),
    (starwars_id, 'Événement', 'event', false, 3),
    (starwars_id, 'Amélioration', 'upgrade', false, 4),
    (starwars_id, 'Base', 'base', false, 5)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    is_supertype = EXCLUDED.is_supertype,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Rarities (6 types)
  -- ============================================
  INSERT INTO rarities (tcg_game_id, name, code, sort_order) VALUES
    (starwars_id, 'Commune', 'c', 1),
    (starwars_id, 'Peu commune', 'u', 2),
    (starwars_id, 'Rare', 'r', 3),
    (starwars_id, 'Légendaire', 'l', 4),
    (starwars_id, 'Spéciale', 's', 5),
    (starwars_id, 'Promo', 'p', 6)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

END $$;

-- ============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE arenas IS 'Star Wars Unlimited card arenas (Ground, Space)';
COMMENT ON TABLE aspects IS 'Star Wars Unlimited card aspects (Vigilance, Command, Aggression, Cunning, Villainy, Heroism)';

COMMENT ON COLUMN aspects.name_en IS 'English name for internationalization';
COMMENT ON COLUMN aspects.hex_color IS 'CSS hex color for UI display';
