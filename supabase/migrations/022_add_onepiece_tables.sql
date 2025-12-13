-- Migration: Add One Piece TCG specific tables (colors, attributes, card_types, rarities)
-- Date: 2025-01-10

-- ============================================
-- 1. CREATE COLORS TABLE (equivalent to inks for Lorcana)
-- ============================================
CREATE TABLE IF NOT EXISTS colors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  icon_url TEXT,
  hex_color VARCHAR(7),  -- CSS hex color for UI
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_colors_tcg_game ON colors(tcg_game_id);

-- RLS Policy
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON colors FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_colors_updated_at BEFORE UPDATE ON colors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CREATE ATTRIBUTES TABLE (Strike, Slash, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS attributes (
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
CREATE INDEX IF NOT EXISTS idx_attributes_tcg_game ON attributes(tcg_game_id);

-- RLS Policy
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON attributes FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_attributes_updated_at BEFORE UPDATE ON attributes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ADD sort_order COLUMN TO card_types IF NOT EXISTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'card_types' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE card_types ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 4. INSERT ONE PIECE DATA
-- ============================================

DO $$
DECLARE
  onepiece_id UUID;
BEGIN
  SELECT id INTO onepiece_id FROM tcg_games WHERE slug = 'onepiece';

  IF onepiece_id IS NULL THEN
    RAISE EXCEPTION 'One Piece TCG not found in tcg_games table';
  END IF;

  -- ============================================
  -- Insert Colors (6 colors + multicolor)
  -- ============================================
  INSERT INTO colors (tcg_game_id, name, code, hex_color, sort_order) VALUES
    (onepiece_id, 'Rouge', 'red', '#DC2626', 1),
    (onepiece_id, 'Vert', 'green', '#16A34A', 2),
    (onepiece_id, 'Bleu', 'blue', '#2563EB', 3),
    (onepiece_id, 'Violet', 'purple', '#7C3AED', 4),
    (onepiece_id, 'Noir', 'black', '#1F2937', 5),
    (onepiece_id, 'Jaune', 'yellow', '#EAB308', 6),
    (onepiece_id, 'Multicolore', 'multicolor', '#EC4899', 7)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    hex_color = EXCLUDED.hex_color,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Attributes (5 types)
  -- ============================================
  INSERT INTO attributes (tcg_game_id, name, code, sort_order) VALUES
    (onepiece_id, 'Frappe', 'strike', 1),
    (onepiece_id, 'Tranche', 'slash', 2),
    (onepiece_id, 'Special', 'special', 3),
    (onepiece_id, 'Portee', 'ranged', 4),
    (onepiece_id, 'Sagesse', 'wisdom', 5)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Card Types (5 types)
  -- ============================================
  INSERT INTO card_types (tcg_game_id, name, code, is_supertype, sort_order) VALUES
    (onepiece_id, 'Leader', 'leader', false, 1),
    (onepiece_id, 'Personnage', 'character', false, 2),
    (onepiece_id, 'Evenement', 'event', false, 3),
    (onepiece_id, 'Lieu', 'stage', false, 4),
    (onepiece_id, 'DON!!', 'don', false, 5)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    is_supertype = EXCLUDED.is_supertype,
    sort_order = EXCLUDED.sort_order;

  -- ============================================
  -- Insert Rarities (9 types)
  -- ============================================
  INSERT INTO rarities (tcg_game_id, name, code, sort_order) VALUES
    (onepiece_id, 'Common', 'c', 1),
    (onepiece_id, 'Uncommon', 'uc', 2),
    (onepiece_id, 'Rare', 'r', 3),
    (onepiece_id, 'Super Rare', 'sr', 4),
    (onepiece_id, 'Secret Rare', 'sec', 5),
    (onepiece_id, 'Leader', 'l', 6),
    (onepiece_id, 'Promo', 'p', 7),
    (onepiece_id, 'Treasury Rare', 'tr', 8),
    (onepiece_id, 'DON!!', 'don', 9)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

END $$;

-- ============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE colors IS 'TCG-specific card colors (e.g., One Piece: Red, Green, Blue, Purple, Black, Yellow)';
COMMENT ON TABLE attributes IS 'TCG-specific combat attributes (e.g., One Piece: Strike, Slash, Special, Ranged, Wisdom)';

COMMENT ON COLUMN colors.hex_color IS 'CSS hex color for UI display';
COMMENT ON COLUMN colors.sort_order IS 'Order for sorting/filtering';
COMMENT ON COLUMN attributes.sort_order IS 'Order for sorting/filtering';
