-- Migration: Add collection_shares table for sharing collections
-- This table stores share links with temporary tokens for sharing card collections

CREATE TABLE IF NOT EXISTS collection_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  views_count INTEGER DEFAULT 0
);

-- Index for fast token lookup
CREATE INDEX idx_collection_shares_token ON collection_shares(token);

-- Unique constraint: one active share per user/series combination
CREATE UNIQUE INDEX idx_collection_shares_user_series ON collection_shares(user_id, series_id);

-- Index for cleanup of expired tokens
CREATE INDEX idx_collection_shares_expires ON collection_shares(expires_at);

-- Enable Row Level Security
ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read shares (needed for token validation)
CREATE POLICY "Public read shares" ON collection_shares
  FOR SELECT USING (true);

-- Policy: Users can insert their own shares
CREATE POLICY "Users insert own shares" ON collection_shares
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Policy: Users can update their own shares
CREATE POLICY "Users update own shares" ON collection_shares
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Policy: Users can delete their own shares
CREATE POLICY "Users delete own shares" ON collection_shares
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Add comment to table
COMMENT ON TABLE collection_shares IS 'Stores temporary share links for card collections';
COMMENT ON COLUMN collection_shares.token IS 'Unique token for the share link (32 characters)';
COMMENT ON COLUMN collection_shares.expires_at IS 'Expiration date of the share link';
COMMENT ON COLUMN collection_shares.views_count IS 'Number of times the share link has been viewed';
