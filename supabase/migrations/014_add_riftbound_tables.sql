-- Migration: Add Riftbound-specific tables (domains, card_types, rarities)
-- Date: 2024-12-06

-- ============================================
-- 1. CREATE DOMAINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS domains (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX idx_domains_tcg_game ON domains(tcg_game_id);

-- RLS Policy
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON domains FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CREATE CARD_TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS card_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_supertype BOOLEAN DEFAULT false,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX idx_card_types_tcg_game ON card_types(tcg_game_id);

-- RLS Policy
ALTER TABLE card_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON card_types FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_card_types_updated_at BEFORE UPDATE ON card_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. CREATE RARITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rarities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

-- Index for faster lookups
CREATE INDEX idx_rarities_tcg_game ON rarities(tcg_game_id);

-- RLS Policy
ALTER TABLE rarities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON rarities FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_rarities_updated_at BEFORE UPDATE ON rarities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. INSERT RIFTBOUND DATA
-- ============================================

-- Get Riftbound game ID
DO $$
DECLARE
  riftbound_id UUID;
BEGIN
  SELECT id INTO riftbound_id FROM tcg_games WHERE slug = 'riftbound';

  IF riftbound_id IS NULL THEN
    RAISE EXCEPTION 'Riftbound TCG not found in tcg_games table';
  END IF;

  -- Insert Domains
  INSERT INTO domains (tcg_game_id, name, code, icon_url) VALUES
    (riftbound_id, 'Calm', 'calm', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/b9ef2f5b74841ad11f3629aa381a76ac0187d007-64x64.png'),
    (riftbound_id, 'Chaos', 'chaos', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/597ddb82be59e87b467c52bb10204f02c2005d06-64x64.png'),
    (riftbound_id, 'Fury', 'fury', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/5aeb4bfd203b5d265902f65aa5afae7da1682eaa-64x64.png')
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    icon_url = EXCLUDED.icon_url;

  -- Insert Card Types
  INSERT INTO card_types (tcg_game_id, name, code, is_supertype, icon_url) VALUES
    (riftbound_id, 'Unit', 'unit', false, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/cb0caf49361546ece0c25d65b7fbf57c0eee57f0-64x64.png'),
    (riftbound_id, 'Spell', 'spell', false, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/73c26354435212281d3f1cefe7cdbd7c803fe18f-64x64.png'),
    (riftbound_id, 'Champion', 'champion', true, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/c56f1df327f53562a56b493d3d38c3cee5780c5a-64x64.png')
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    is_supertype = EXCLUDED.is_supertype,
    icon_url = EXCLUDED.icon_url;

  -- Insert Rarities (sort_order: 1=common ... 5=showcase)
  INSERT INTO rarities (tcg_game_id, name, code, sort_order, icon_url) VALUES
    (riftbound_id, 'Common', 'common', 1, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/a088ae851d94b5c34aa4900e8ccb4cc103144dce-354x354.png'),
    (riftbound_id, 'Uncommon', 'uncommon', 2, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/808205a0f070e479107a7655e622fe15a356275b-480x410.png'),
    (riftbound_id, 'Rare', 'rare', 3, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/d90078e1ec2ef7cbcbba2be86da1b192c389581a-429x425.png'),
    (riftbound_id, 'Epic', 'epic', 4, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/5e9799d87d0f8baa55f6d9bddb9750669a0f485b-455x419.png'),
    (riftbound_id, 'Showcase', 'showcase', 5, 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/a0e92b9edf3291fa62c9b35ffd6363de0d7947c0-376x426.png')
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    icon_url = EXCLUDED.icon_url;

  -- Insert Riftbound Series (only if not exists)
  INSERT INTO series (tcg_game_id, name, code, max_set_base, master_set, release_date)
  SELECT riftbound_id, 'Origins', 'OGN', 298, 298, '2025-01-21'::date
  WHERE NOT EXISTS (SELECT 1 FROM series WHERE code = 'OGN');

  INSERT INTO series (tcg_game_id, name, code, max_set_base, master_set, release_date)
  SELECT riftbound_id, 'Spiritforged', 'SFD', 221, 221, '2025-05-20'::date
  WHERE NOT EXISTS (SELECT 1 FROM series WHERE code = 'SFD');

  INSERT INTO series (tcg_game_id, name, code, max_set_base, master_set, release_date)
  SELECT riftbound_id, 'Origins - Proving Grounds', 'OGS', 50, 50, '2025-01-21'::date
  WHERE NOT EXISTS (SELECT 1 FROM series WHERE code = 'OGS');

END $$;

-- ============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE domains IS 'TCG-specific domains/elements (e.g., Riftbound: Calm, Chaos, Fury)';
COMMENT ON TABLE card_types IS 'TCG-specific card types (e.g., Unit, Spell, Champion)';
COMMENT ON TABLE rarities IS 'TCG-specific rarities with sort order for filtering';

COMMENT ON COLUMN domains.code IS 'Unique code for the domain (e.g., calm, chaos, fury)';
COMMENT ON COLUMN card_types.is_supertype IS 'True if this is a supertype (e.g., Champion) that overlays base type';
COMMENT ON COLUMN rarities.sort_order IS 'Order for sorting/filtering (1=most common, higher=rarer)';
