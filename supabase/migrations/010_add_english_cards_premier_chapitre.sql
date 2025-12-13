-- Migration to add English cards for "Premier Chapitre" (Lorcana)
-- and update unique constraint to support multiple languages

-- Step 1: Update unique constraint to allow same card number with different language
DO $$
BEGIN
  -- Check if the new constraint already exists
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_series_id_number_language_key') THEN
    -- Drop the old constraint if it exists
    ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_series_id_number_key;
    
    -- Add the new constraint
    ALTER TABLE cards ADD CONSTRAINT cards_series_id_number_language_key UNIQUE (series_id, number, language);
  END IF;
END $$;


-- Step 2: Insert English cards
DO $$
DECLARE
  v_lorcana_id UUID;
  v_series_id UUID;
  v_card RECORD;
  v_new_image_url TEXT;
  v_padded_number TEXT;
BEGIN
  -- Get Lorcana Game ID
  SELECT id INTO v_lorcana_id FROM tcg_games WHERE slug = 'lorcana';
  
  IF v_lorcana_id IS NULL THEN
    RAISE NOTICE 'Game "Lorcana" not found';
    RETURN;
  END IF;

  -- Find the series "Premier Chapitre"
  -- We look for a series belonging to Lorcana with code 'FirstChapter' or name containing 'Premier Chapitre'
  SELECT id INTO v_series_id
  FROM series
  WHERE tcg_game_id = v_lorcana_id
  AND (name ILIKE '%Premier Chapitre%' OR name ILIKE '%First Chapter%' OR code = '1' OR code = 'FirstChapter')
  LIMIT 1;

  IF v_series_id IS NULL THEN
    RAISE NOTICE 'Series "Premier Chapitre" not found';
    RETURN;
  END IF;

  -- Loop through existing French cards for this series
  -- We assume the existing cards are French (language = 'FR' or NULL if not set yet, but 004 set it)
  FOR v_card IN SELECT * FROM cards WHERE series_id = v_series_id AND (language = 'FR' OR language IS NULL) LOOP
    
    -- Ensure we have a valid number to work with
    -- The URL requires 3 digits: 001, 002, ... 216
    -- We assume v_card.number is the integer part (e.g. '1', '143')
    
    -- Pad number to 3 digits
    v_padded_number := LPAD(v_card.number, 3, '0');
    
    -- Construct new image URL
    -- Pattern: https://cdn.dreamborn.ink/images/en/cards/001-{number}
    v_new_image_url := 'https://cdn.dreamborn.ink/images/en/cards/001-' || v_padded_number;

    -- Insert English version
    -- We use ON CONFLICT DO UPDATE to ensure idempotency
    INSERT INTO cards (
      series_id,
      name,
      number,
      rarity,
      image_url,
      attributes,
      language,
      chapter
    ) VALUES (
      v_series_id,
      v_card.name, -- Keep the name (French) for now as we don't have English names
      v_card.number,
      v_card.rarity,
      v_new_image_url,
      v_card.attributes,
      'EN', -- Set language to EN
      v_card.chapter
    )
    ON CONFLICT (series_id, number, language) DO UPDATE
    SET image_url = EXCLUDED.image_url;
    
  END LOOP;
  
  RAISE NOTICE 'English cards inserted/updated for series %', v_series_id;
END $$;
