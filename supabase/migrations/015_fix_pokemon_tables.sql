-- Migration FIX: Add missing Pokemon columns (safe version)
-- This script only adds columns/tables that don't exist yet

-- ============================================
-- 1. ADD MISSING COLUMNS TO SERIES TABLE
-- ============================================
ALTER TABLE series ADD COLUMN IF NOT EXISTS pokemon_series_id UUID;
ALTER TABLE series ADD COLUMN IF NOT EXISTS tcgdex_id VARCHAR(20);
ALTER TABLE series ADD COLUMN IF NOT EXISTS symbol_url TEXT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS official_card_count INTEGER;
ALTER TABLE series ADD COLUMN IF NOT EXISTS total_card_count INTEGER;

-- Add foreign key if not exists (check first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'series_pokemon_series_id_fkey'
  ) THEN
    -- Check if pokemon_series table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pokemon_series') THEN
      ALTER TABLE series ADD CONSTRAINT series_pokemon_series_id_fkey
        FOREIGN KEY (pokemon_series_id) REFERENCES pokemon_series(id);
    END IF;
  END IF;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_series_pokemon_series ON series(pokemon_series_id);
CREATE INDEX IF NOT EXISTS idx_series_tcgdex_id ON series(tcgdex_id);

-- ============================================
-- 2. ADD MISSING COLUMNS TO CARDS TABLE
-- ============================================
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_id VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS illustrator VARCHAR(100);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS regulation_mark VARCHAR(5);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_holo BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_reverse BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_normal BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_first_edition BOOLEAN DEFAULT false;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_cards_tcgdex_id ON cards(tcgdex_id);
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_hp ON cards(hp);
CREATE INDEX IF NOT EXISTS idx_cards_regulation_mark ON cards(regulation_mark);

-- Partial indexes (need special handling)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_has_holo') THEN
    CREATE INDEX idx_cards_has_holo ON cards(has_holo) WHERE has_holo = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_has_reverse') THEN
    CREATE INDEX idx_cards_has_reverse ON cards(has_reverse) WHERE has_reverse = true;
  END IF;
END $$;

-- ============================================
-- 3. CREATE POKEMON_SERIES TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_series (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  logo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pokemon_series_tcg_game ON pokemon_series(tcg_game_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_series_code ON pokemon_series(code);

-- Enable RLS if not already enabled
ALTER TABLE pokemon_series ENABLE ROW LEVEL SECURITY;

-- Create policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pokemon_series' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON pokemon_series FOR SELECT USING (true);
  END IF;
END $$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_pokemon_series_updated_at'
  ) THEN
    CREATE TRIGGER update_pokemon_series_updated_at BEFORE UPDATE ON pokemon_series
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 4. CREATE SERIES_TRANSLATIONS TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS series_translations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(series_id, language)
);

CREATE INDEX IF NOT EXISTS idx_series_translations_series ON series_translations(series_id);
CREATE INDEX IF NOT EXISTS idx_series_translations_language ON series_translations(language);

ALTER TABLE series_translations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'series_translations' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON series_translations FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_series_translations_updated_at'
  ) THEN
    CREATE TRIGGER update_series_translations_updated_at BEFORE UPDATE ON series_translations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 5. CREATE POKEMON_TYPES TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

CREATE INDEX IF NOT EXISTS idx_pokemon_types_tcg_game ON pokemon_types(tcg_game_id);

ALTER TABLE pokemon_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pokemon_types' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON pokemon_types FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_pokemon_types_updated_at'
  ) THEN
    CREATE TRIGGER update_pokemon_types_updated_at BEFORE UPDATE ON pokemon_types
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 6. CREATE POKEMON_TYPE_TRANSLATIONS TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_type_translations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pokemon_type_id UUID NOT NULL REFERENCES pokemon_types(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pokemon_type_id, language)
);

CREATE INDEX IF NOT EXISTS idx_pokemon_type_translations_type ON pokemon_type_translations(pokemon_type_id);

ALTER TABLE pokemon_type_translations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pokemon_type_translations' AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access" ON pokemon_type_translations FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================
-- 7. INSERT POKEMON DATA (ON CONFLICT DO UPDATE)
-- ============================================
DO $$
DECLARE
  pokemon_id UUID;
BEGIN
  SELECT id INTO pokemon_id FROM tcg_games WHERE slug = 'pokemon';

  IF pokemon_id IS NULL THEN
    RAISE NOTICE 'Pokemon TCG not found in tcg_games table - skipping data insertion';
    RETURN;
  END IF;

  -- Insert Pokemon Series (Eras)
  INSERT INTO pokemon_series (tcg_game_id, code, name, sort_order) VALUES
    (pokemon_id, 'base', 'Base', 1),
    (pokemon_id, 'neo', 'Neo', 2),
    (pokemon_id, 'ecard', 'e-Card', 3),
    (pokemon_id, 'ex', 'EX', 4),
    (pokemon_id, 'pop', 'POP', 5),
    (pokemon_id, 'tk', 'Trainer Kit', 6),
    (pokemon_id, 'dp', 'Diamond & Pearl', 7),
    (pokemon_id, 'pl', 'Platinum', 8),
    (pokemon_id, 'hgss', 'HeartGold SoulSilver', 9),
    (pokemon_id, 'col', 'Call of Legends', 10),
    (pokemon_id, 'bw', 'Black & White', 11),
    (pokemon_id, 'xy', 'XY', 12),
    (pokemon_id, 'sm', 'Sun & Moon', 13),
    (pokemon_id, 'swsh', 'Sword & Shield', 14),
    (pokemon_id, 'sv', 'Scarlet & Violet', 15),
    (pokemon_id, 'me', 'Mega Evolution', 16),
    (pokemon_id, 'tcgp', 'TCG Pocket', 17),
    (pokemon_id, 'mc', 'McDonald''s Promos', 18),
    (pokemon_id, 'misc', 'Miscellaneous', 99)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

  -- Insert Pokemon Types
  INSERT INTO pokemon_types (tcg_game_id, code, sort_order, icon_url) VALUES
    (pokemon_id, 'grass', 1, 'https://assets.tcgdex.net/univ/types/grass.png'),
    (pokemon_id, 'fire', 2, 'https://assets.tcgdex.net/univ/types/fire.png'),
    (pokemon_id, 'water', 3, 'https://assets.tcgdex.net/univ/types/water.png'),
    (pokemon_id, 'lightning', 4, 'https://assets.tcgdex.net/univ/types/lightning.png'),
    (pokemon_id, 'psychic', 5, 'https://assets.tcgdex.net/univ/types/psychic.png'),
    (pokemon_id, 'fighting', 6, 'https://assets.tcgdex.net/univ/types/fighting.png'),
    (pokemon_id, 'darkness', 7, 'https://assets.tcgdex.net/univ/types/darkness.png'),
    (pokemon_id, 'metal', 8, 'https://assets.tcgdex.net/univ/types/metal.png'),
    (pokemon_id, 'fairy', 9, 'https://assets.tcgdex.net/univ/types/fairy.png'),
    (pokemon_id, 'dragon', 10, 'https://assets.tcgdex.net/univ/types/dragon.png'),
    (pokemon_id, 'colorless', 11, 'https://assets.tcgdex.net/univ/types/colorless.png')
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    icon_url = EXCLUDED.icon_url;

  -- Insert Type Translations (simplified - only insert if not exists)
  -- Grass
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Grass'), ('fr', 'Plante'), ('es', 'Planta'), ('de', 'Pflanze'), ('it', 'Erba'), ('pt', 'Planta')
  ) AS t(lang, trans) WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fire
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Fire'), ('fr', 'Feu'), ('es', 'Fuego'), ('de', 'Feuer'), ('it', 'Fuoco'), ('pt', 'Fogo')
  ) AS t(lang, trans) WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Water
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Water'), ('fr', 'Eau'), ('es', 'Agua'), ('de', 'Wasser'), ('it', 'Acqua'), ('pt', 'Água')
  ) AS t(lang, trans) WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Lightning
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Lightning'), ('fr', 'Électrique'), ('es', 'Rayo'), ('de', 'Elektro'), ('it', 'Lampo'), ('pt', 'Elétrico')
  ) AS t(lang, trans) WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Psychic
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Psychic'), ('fr', 'Psy'), ('es', 'Psíquico'), ('de', 'Psycho'), ('it', 'Psico'), ('pt', 'Psíquico')
  ) AS t(lang, trans) WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fighting
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Fighting'), ('fr', 'Combat'), ('es', 'Lucha'), ('de', 'Kampf'), ('it', 'Lotta'), ('pt', 'Lutador')
  ) AS t(lang, trans) WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Darkness
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Darkness'), ('fr', 'Obscurité'), ('es', 'Oscuridad'), ('de', 'Finsternis'), ('it', 'Oscurità'), ('pt', 'Sombrio')
  ) AS t(lang, trans) WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Metal
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Metal'), ('fr', 'Métal'), ('es', 'Metal'), ('de', 'Metall'), ('it', 'Metallo'), ('pt', 'Metal')
  ) AS t(lang, trans) WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fairy
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Fairy'), ('fr', 'Fée'), ('es', 'Hada'), ('de', 'Fee'), ('it', 'Folletto'), ('pt', 'Fada')
  ) AS t(lang, trans) WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Dragon
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Dragon'), ('fr', 'Dragon'), ('es', 'Dragón'), ('de', 'Drache'), ('it', 'Drago'), ('pt', 'Dragão')
  ) AS t(lang, trans) WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Colorless
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, lang, trans FROM pokemon_types, (VALUES
    ('en', 'Colorless'), ('fr', 'Incolore'), ('es', 'Incoloro'), ('de', 'Farblos'), ('it', 'Incolore'), ('pt', 'Incolor')
  ) AS t(lang, trans) WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Insert Pokemon Rarities
  INSERT INTO rarities (tcg_game_id, name, code, sort_order) VALUES
    (pokemon_id, 'Common', 'common', 1),
    (pokemon_id, 'Uncommon', 'uncommon', 2),
    (pokemon_id, 'Rare', 'rare', 3),
    (pokemon_id, 'Rare Holo', 'rare-holo', 4),
    (pokemon_id, 'Rare Holo EX', 'rare-holo-ex', 5),
    (pokemon_id, 'Rare Holo GX', 'rare-holo-gx', 6),
    (pokemon_id, 'Rare Holo V', 'rare-holo-v', 7),
    (pokemon_id, 'Rare Holo VMAX', 'rare-holo-vmax', 8),
    (pokemon_id, 'Rare Holo VSTAR', 'rare-holo-vstar', 9),
    (pokemon_id, 'Ultra Rare', 'ultra-rare', 10),
    (pokemon_id, 'Rare Ultra', 'rare-ultra', 11),
    (pokemon_id, 'Double Rare', 'double-rare', 12),
    (pokemon_id, 'Illustration Rare', 'illustration-rare', 13),
    (pokemon_id, 'Special Art Rare', 'special-art-rare', 14),
    (pokemon_id, 'Art Rare', 'art-rare', 15),
    (pokemon_id, 'Secret Rare', 'secret-rare', 16),
    (pokemon_id, 'Hyper Rare', 'hyper-rare', 17),
    (pokemon_id, 'Shiny Rare', 'shiny-rare', 18),
    (pokemon_id, 'Shiny Ultra Rare', 'shiny-ultra-rare', 19),
    (pokemon_id, 'Amazing Rare', 'amazing-rare', 20),
    (pokemon_id, 'Radiant Rare', 'radiant-rare', 21),
    (pokemon_id, 'Trainer Gallery Rare', 'trainer-gallery-rare', 22),
    (pokemon_id, 'ACE SPEC Rare', 'ace-spec-rare', 23),
    (pokemon_id, 'Promo', 'promo', 50),
    (pokemon_id, 'None', 'none', 99)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

END $$;

-- ============================================
-- 8. ADD COMMENTS
-- ============================================
COMMENT ON TABLE pokemon_series IS 'Pokémon TCG eras/series (Base, Neo, XY, etc.)';
COMMENT ON TABLE series_translations IS 'Translated names for sets in different languages';
COMMENT ON TABLE pokemon_types IS 'Pokémon card types (Fire, Water, Grass, etc.)';
COMMENT ON TABLE pokemon_type_translations IS 'Translated names for Pokémon types';

COMMENT ON COLUMN series.pokemon_series_id IS 'Reference to parent Pokémon series/era';
COMMENT ON COLUMN series.tcgdex_id IS 'TCGdex API ID for the set';
COMMENT ON COLUMN series.symbol_url IS 'URL to set symbol image';
COMMENT ON COLUMN series.official_card_count IS 'Official card count in the set';
COMMENT ON COLUMN series.total_card_count IS 'Total cards including secrets/promos';

COMMENT ON COLUMN cards.tcgdex_id IS 'TCGdex API ID for the card';
COMMENT ON COLUMN cards.category IS 'Card category (Pokemon, Trainer, Energy)';
COMMENT ON COLUMN cards.illustrator IS 'Card illustrator name';
COMMENT ON COLUMN cards.hp IS 'Pokémon HP value';
COMMENT ON COLUMN cards.regulation_mark IS 'Tournament regulation mark (D, E, F, G, H)';
