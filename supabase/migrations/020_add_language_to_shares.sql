-- Migration: Add language column to collection_shares
-- This allows users to share their collection for a specific language

ALTER TABLE collection_shares
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'fr';

-- Update index to include language in unique constraint
-- First drop existing index
DROP INDEX IF EXISTS idx_collection_shares_user_series;

-- Create new unique constraint including language
CREATE UNIQUE INDEX idx_collection_shares_user_series_lang
ON collection_shares(user_id, series_id, language);

-- Add comment for the new column
COMMENT ON COLUMN collection_shares.language IS 'Language code for the shared collection (fr, en, jp)';
