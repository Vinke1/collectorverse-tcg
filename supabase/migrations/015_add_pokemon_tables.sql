-- Migration: Add Pokémon TCG specific tables
-- Date: 2024-12-08
-- Description: Structure complète pour les cartes Pokémon avec support multi-langue

-- ============================================
-- 1. CREATE POKEMON_SERIES TABLE (Eras/Series: Base, Neo, XY, SM, SWSH, SV)
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_series (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,  -- base, neo, xy, sm, swsh, sv
  name VARCHAR(100) NOT NULL,         -- Nom anglais par défaut
  logo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pokemon_series_tcg_game ON pokemon_series(tcg_game_id);
CREATE INDEX idx_pokemon_series_code ON pokemon_series(code);

ALTER TABLE pokemon_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON pokemon_series FOR SELECT USING (true);

CREATE TRIGGER update_pokemon_series_updated_at BEFORE UPDATE ON pokemon_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. CREATE SERIES_TRANSLATIONS TABLE (Noms traduits des sets)
-- ============================================
CREATE TABLE IF NOT EXISTS series_translations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,      -- en, fr, es, it, pt, de, ja, ko, zh-tw
  name VARCHAR(255) NOT NULL,         -- Nom traduit du set
  logo_url TEXT,                      -- Logo peut différer par langue
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(series_id, language)
);

CREATE INDEX idx_series_translations_series ON series_translations(series_id);
CREATE INDEX idx_series_translations_language ON series_translations(language);

ALTER TABLE series_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON series_translations FOR SELECT USING (true);

CREATE TRIGGER update_series_translations_updated_at BEFORE UPDATE ON series_translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. CREATE POKEMON_TYPES TABLE (Feu, Eau, Plante, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,          -- fire, water, grass, etc. (anglais, invariant)
  sort_order INTEGER DEFAULT 0,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tcg_game_id, code)
);

CREATE INDEX idx_pokemon_types_tcg_game ON pokemon_types(tcg_game_id);

ALTER TABLE pokemon_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON pokemon_types FOR SELECT USING (true);

CREATE TRIGGER update_pokemon_types_updated_at BEFORE UPDATE ON pokemon_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. CREATE POKEMON_TYPE_TRANSLATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pokemon_type_translations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pokemon_type_id UUID NOT NULL REFERENCES pokemon_types(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  name VARCHAR(50) NOT NULL,          -- Feu (fr), Fire (en), Fuego (es)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pokemon_type_id, language)
);

CREATE INDEX idx_pokemon_type_translations_type ON pokemon_type_translations(pokemon_type_id);

ALTER TABLE pokemon_type_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON pokemon_type_translations FOR SELECT USING (true);

-- ============================================
-- 5. ADD pokemon_series_id TO SERIES TABLE
-- ============================================
ALTER TABLE series ADD COLUMN IF NOT EXISTS pokemon_series_id UUID REFERENCES pokemon_series(id);
ALTER TABLE series ADD COLUMN IF NOT EXISTS tcgdex_id VARCHAR(20);  -- ID TCGdex (swsh3, sv06)
ALTER TABLE series ADD COLUMN IF NOT EXISTS symbol_url TEXT;         -- URL du symbole du set
ALTER TABLE series ADD COLUMN IF NOT EXISTS official_card_count INTEGER;
ALTER TABLE series ADD COLUMN IF NOT EXISTS total_card_count INTEGER;

CREATE INDEX idx_series_pokemon_series ON series(pokemon_series_id);
CREATE INDEX idx_series_tcgdex_id ON series(tcgdex_id);

-- ============================================
-- 6. ADD MORE FIELDS TO CARDS TABLE
-- ============================================
-- La colonne attributes JSONB existante stockera toutes les données Pokémon
-- Mais ajoutons quelques colonnes utiles pour les requêtes rapides

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_id VARCHAR(50);    -- ID TCGdex (swsh3-136)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS category VARCHAR(50);      -- Pokemon, Trainer, Energy
ALTER TABLE cards ADD COLUMN IF NOT EXISTS illustrator VARCHAR(100);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS hp INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS regulation_mark VARCHAR(5);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_holo BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_reverse BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_normal BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS has_first_edition BOOLEAN DEFAULT false;

CREATE INDEX idx_cards_tcgdex_id ON cards(tcgdex_id);
CREATE INDEX idx_cards_category ON cards(category);
CREATE INDEX idx_cards_hp ON cards(hp);
CREATE INDEX idx_cards_regulation_mark ON cards(regulation_mark);
CREATE INDEX idx_cards_has_holo ON cards(has_holo) WHERE has_holo = true;
CREATE INDEX idx_cards_has_reverse ON cards(has_reverse) WHERE has_reverse = true;

-- ============================================
-- 7. INSERT POKEMON DATA
-- ============================================
DO $$
DECLARE
  pokemon_id UUID;
BEGIN
  SELECT id INTO pokemon_id FROM tcg_games WHERE slug = 'pokemon';

  IF pokemon_id IS NULL THEN
    RAISE EXCEPTION 'Pokémon TCG not found in tcg_games table';
  END IF;

  -- ========== INSERT POKEMON SERIES (Eras) ==========
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

  -- ========== INSERT POKEMON TYPES ==========
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

  -- ========== INSERT TYPE TRANSLATIONS ==========
  -- Grass
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Grass' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Plante' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Planta' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Pflanze' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Erba' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Planta' FROM pokemon_types WHERE code = 'grass'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fire
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Fire' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Feu' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Fuego' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Feuer' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Fuoco' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Fogo' FROM pokemon_types WHERE code = 'fire'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Water
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Water' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Eau' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Agua' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Wasser' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Acqua' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Água' FROM pokemon_types WHERE code = 'water'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Lightning
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Lightning' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Électrique' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Rayo' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Elektro' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Lampo' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Elétrico' FROM pokemon_types WHERE code = 'lightning'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Psychic
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Psychic' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Psy' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Psíquico' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Psycho' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Psico' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Psíquico' FROM pokemon_types WHERE code = 'psychic'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fighting
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Fighting' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Combat' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Lucha' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Kampf' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Lotta' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Lutador' FROM pokemon_types WHERE code = 'fighting'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Darkness
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Darkness' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Obscurité' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Oscuridad' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Finsternis' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Oscurità' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Sombrio' FROM pokemon_types WHERE code = 'darkness'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Metal
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Metal' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Métal' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Metal' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Metall' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Metallo' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Metal' FROM pokemon_types WHERE code = 'metal'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Fairy
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Fairy' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Fée' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Hada' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Fee' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Folletto' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Fada' FROM pokemon_types WHERE code = 'fairy'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Dragon
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Dragon' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Dragon' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Dragón' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Drache' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Drago' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Dragão' FROM pokemon_types WHERE code = 'dragon'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- Colorless
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'en', 'Colorless' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'fr', 'Incolore' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'es', 'Incoloro' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'de', 'Farblos' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'it', 'Incolore' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;
  INSERT INTO pokemon_type_translations (pokemon_type_id, language, name)
  SELECT id, 'pt', 'Incolor' FROM pokemon_types WHERE code = 'colorless'
  ON CONFLICT (pokemon_type_id, language) DO NOTHING;

  -- ========== INSERT POKEMON RARITIES ==========
  INSERT INTO rarities (tcg_game_id, name, code, sort_order) VALUES
    -- Common rarities
    (pokemon_id, 'Common', 'common', 1),
    (pokemon_id, 'Uncommon', 'uncommon', 2),
    (pokemon_id, 'Rare', 'rare', 3),
    -- Holo rarities
    (pokemon_id, 'Rare Holo', 'rare-holo', 4),
    (pokemon_id, 'Rare Holo EX', 'rare-holo-ex', 5),
    (pokemon_id, 'Rare Holo GX', 'rare-holo-gx', 6),
    (pokemon_id, 'Rare Holo V', 'rare-holo-v', 7),
    (pokemon_id, 'Rare Holo VMAX', 'rare-holo-vmax', 8),
    (pokemon_id, 'Rare Holo VSTAR', 'rare-holo-vstar', 9),
    -- Ultra rarities
    (pokemon_id, 'Ultra Rare', 'ultra-rare', 10),
    (pokemon_id, 'Rare Ultra', 'rare-ultra', 11),
    (pokemon_id, 'Double Rare', 'double-rare', 12),
    -- Art/Illustration rarities
    (pokemon_id, 'Illustration Rare', 'illustration-rare', 13),
    (pokemon_id, 'Special Art Rare', 'special-art-rare', 14),
    (pokemon_id, 'Art Rare', 'art-rare', 15),
    -- Secret/Hyper rarities
    (pokemon_id, 'Secret Rare', 'secret-rare', 16),
    (pokemon_id, 'Hyper Rare', 'hyper-rare', 17),
    (pokemon_id, 'Shiny Rare', 'shiny-rare', 18),
    (pokemon_id, 'Shiny Ultra Rare', 'shiny-ultra-rare', 19),
    -- Special rarities
    (pokemon_id, 'Amazing Rare', 'amazing-rare', 20),
    (pokemon_id, 'Radiant Rare', 'radiant-rare', 21),
    (pokemon_id, 'Trainer Gallery Rare', 'trainer-gallery-rare', 22),
    (pokemon_id, 'ACE SPEC Rare', 'ace-spec-rare', 23),
    -- Promo
    (pokemon_id, 'Promo', 'promo', 50),
    -- None (for trainer/energy without rarity)
    (pokemon_id, 'None', 'none', 99)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

END $$;

-- ============================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
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
COMMENT ON COLUMN cards.has_holo IS 'Card has holographic variant';
COMMENT ON COLUMN cards.has_reverse IS 'Card has reverse holo variant';
COMMENT ON COLUMN cards.has_normal IS 'Card has normal variant';
COMMENT ON COLUMN cards.has_first_edition IS 'Card has 1st edition variant';

-- ============================================
-- 9. UPDATE UNIQUE CONSTRAINT ON CARDS TABLE
-- ============================================
-- Drop the old constraint and create a new one that includes language
-- This allows the same card number in multiple languages

-- First, drop the old constraint (if it exists)
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_series_id_number_key;

-- Create the new constraint including language
ALTER TABLE cards ADD CONSTRAINT cards_series_id_number_language_key UNIQUE (series_id, number, language);

-- ============================================
-- 10. STRUCTURE DU CHAMP ATTRIBUTES (JSONB) POUR POKEMON
-- ============================================
/*
Le champ `attributes` JSONB sur la table `cards` stocke toutes les données spécifiques Pokémon :

{
  // Données de base
  "dexId": [25],                    // ID Pokédex (array car certaines cartes ont plusieurs)
  "stage": "Basic",                 // Basic, Stage1, Stage2, VMAX, etc.
  "evolveFrom": "Pichu",           // Nom du Pokémon précédent (null si Basic)

  // Combat
  "types": ["lightning"],           // Types de la carte (codes)
  "retreat": 1,                     // Coût de retraite
  "weaknesses": [                   // Faiblesses
    {"type": "fighting", "value": "×2"}
  ],
  "resistances": [                  // Résistances
    {"type": "metal", "value": "-30"}
  ],

  // Capacités
  "abilities": [                    // Talents/Pouvoirs Pokémon
    {
      "type": "Ability",            // Ability, Poke-Power, Poke-Body
      "name": "Static Shock",
      "effect": "..."
    }
  ],
  "attacks": [                      // Attaques
    {
      "name": "Thunder Shock",
      "cost": ["lightning"],        // Coût en énergie (codes)
      "damage": "30",
      "effect": "Flip a coin..."
    }
  ],

  // Textes
  "description": "...",             // Texte flaveur (description Pokédex)
  "effect": "...",                  // Effet pour Trainer/Energy
  "trainerType": "Item",            // Item, Supporter, Stadium, Tool
  "energyType": "Special",          // Basic, Special

  // Légalité
  "legal": {
    "standard": false,
    "expanded": true
  },

  // Variantes (détails)
  "variants": {
    "firstEdition": false,
    "holo": true,
    "normal": true,
    "reverse": true,
    "wPromo": false
  },

  // Métadonnées
  "updated": "2024-12-08T00:00:00Z"
}
*/
