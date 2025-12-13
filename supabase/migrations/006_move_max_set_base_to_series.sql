-- Migration to move max_set_base from cards to series table
-- and add master_set column

-- Step 1: Add master_set column to series table
ALTER TABLE series
  ADD COLUMN master_set INTEGER;

-- Step 2: Rename card_count to max_set_base in series table
ALTER TABLE series
  RENAME COLUMN card_count TO max_set_base;

-- Step 3: Update existing series with max_set_base value from cards
-- (Take the first card's max_set_base value since it should be the same for all cards in a series)
UPDATE series s
SET max_set_base = (
  SELECT c.max_set_base
  FROM cards c
  WHERE c.series_id = s.id
  AND c.max_set_base IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM cards c
  WHERE c.series_id = s.id
  AND c.max_set_base IS NOT NULL
);

-- Step 4: Update master_set for the FAB series
UPDATE series
SET master_set = 243
WHERE code = 'FAB';

-- Step 5: Remove max_set_base column from cards table
ALTER TABLE cards
  DROP COLUMN IF EXISTS max_set_base;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN series.max_set_base IS 'Total number of cards in the base set (e.g., 204)';
COMMENT ON COLUMN series.master_set IS 'Total number of cards in the master set including variants (e.g., 243)';
