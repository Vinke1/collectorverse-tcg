-- Migration: Add Naruto Kayou series and rarities
-- Date: 2024-12-11
-- Source: https://narutopia.fr/liste-des-cartes-naruto-kayou/

-- ============================================
-- 1. INSERT NARUTO KAYOU RARITIES
-- ============================================
DO $$
DECLARE
  naruto_id UUID;
BEGIN
  SELECT id INTO naruto_id FROM tcg_games WHERE slug = 'naruto';

  IF naruto_id IS NULL THEN
    RAISE EXCEPTION 'Naruto TCG not found in tcg_games table';
  END IF;

  -- Insert Rarities (sort_order: lower = more common)
  INSERT INTO rarities (tcg_game_id, name, code, sort_order) VALUES
    -- Base rarities
    (naruto_id, 'Rare', 'R', 1),
    (naruto_id, 'Super Rare', 'SR', 2),
    (naruto_id, 'Super Super Rare', 'SSR', 3),

    -- Special rarities
    (naruto_id, 'Treasure Rare', 'TR', 4),
    (naruto_id, 'Treasure Gold Rare', 'TGR', 5),
    (naruto_id, 'Hyper Rare', 'HR', 6),
    (naruto_id, 'Ultra Rare', 'UR', 7),
    (naruto_id, 'Z Rare', 'ZR', 8),
    (naruto_id, 'Another Rare', 'AR', 9),
    (naruto_id, 'Origin Rare', 'OR', 10),
    (naruto_id, 'Super Legend Rare', 'SLR', 11),

    -- Series-specific rarities
    (naruto_id, 'PTR', 'PTR', 12),
    (naruto_id, 'PU', 'PU', 13),

    -- Other rarities
    (naruto_id, 'Campaign', 'CP', 14),
    (naruto_id, 'Special', 'SP', 15),
    (naruto_id, 'Master Rare', 'MR', 16),
    (naruto_id, 'GP', 'GP', 17),
    (naruto_id, 'CR', 'CR', 18),
    (naruto_id, 'NR', 'NR', 19),
    (naruto_id, 'BP', 'BP', 20),
    (naruto_id, 'SE', 'SE', 21),
    (naruto_id, 'SV', 'SV', 22),
    (naruto_id, 'SV Gold', 'SV-GOLD', 23),

    -- Top rarities
    (naruto_id, 'Secret Rare', 'SCR', 24),
    (naruto_id, 'Legend Rare', 'LR', 25),

    -- Promos
    (naruto_id, 'Promo', 'PR', 26),
    (naruto_id, 'BR', 'BR', 27)
  ON CONFLICT (tcg_game_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

  -- Insert Naruto Kayou Series
  INSERT INTO series (tcg_game_id, name, code, max_set_base, master_set)
  SELECT naruto_id, 'Naruto Kayou', 'KAYOU', 1853, 1853
  WHERE NOT EXISTS (SELECT 1 FROM series WHERE code = 'KAYOU');

END $$;

-- ============================================
-- 2. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE rarities IS 'TCG-specific rarities with sort order for filtering';
