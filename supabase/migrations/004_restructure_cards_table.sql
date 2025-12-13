-- Migration to restructure cards table
-- Split the combined "number" field into separate columns

-- Step 1: Add new columns
ALTER TABLE cards
  ADD COLUMN max_set_base INTEGER,
  ADD COLUMN language VARCHAR(10),
  ADD COLUMN chapter INTEGER;

-- Step 2: Migrate existing data by parsing the number field
-- Format: "143/204 • FR • 9" -> number=143, max_set_base=204, language=FR, chapter=9
UPDATE cards
SET
  -- Extract card number (before the first "/")
  number = SPLIT_PART(SPLIT_PART(number, '/', 1), ' ', 1),
  -- Extract max_set_base (between "/" and first "•")
  max_set_base = NULLIF(TRIM(SPLIT_PART(SPLIT_PART(number, '/', 2), '•', 1)), '')::INTEGER,
  -- Extract language (between first and second "•")
  language = NULLIF(TRIM(SPLIT_PART(SPLIT_PART(number, '•', 2), '•', 1)), ''),
  -- Extract chapter (after second "•")
  chapter = NULLIF(TRIM(SPLIT_PART(number, '•', 3)), '')::INTEGER
WHERE number LIKE '%•%'; -- Only update rows with the old format

-- Step 3: Drop the type column and its index
DROP INDEX IF EXISTS idx_cards_type;
ALTER TABLE cards DROP COLUMN IF EXISTS type;

-- Step 4: Create indexes for new columns
CREATE INDEX idx_cards_language ON cards(language);
CREATE INDEX idx_cards_chapter ON cards(chapter);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN cards.number IS 'Card number within the series (e.g., 143)';
COMMENT ON COLUMN cards.max_set_base IS 'Total number of cards in the base set (e.g., 204)';
COMMENT ON COLUMN cards.language IS 'Card language code (e.g., FR, EN)';
COMMENT ON COLUMN cards.chapter IS 'Chapter number for the card series';
