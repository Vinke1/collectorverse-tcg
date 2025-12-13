-- Add quantity_foil column to user_collections table
ALTER TABLE user_collections
ADD COLUMN quantity_foil INTEGER DEFAULT 0;

-- Update existing rows to have 0 foil quantity
UPDATE user_collections
SET quantity_foil = 0
WHERE quantity_foil IS NULL;
