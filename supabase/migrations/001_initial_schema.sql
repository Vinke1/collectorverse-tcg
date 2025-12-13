-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tcg_games table
CREATE TABLE tcg_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  gradient VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create series table
CREATE TABLE series (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tcg_game_id UUID NOT NULL REFERENCES tcg_games(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  release_date DATE,
  card_count INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table
CREATE TABLE cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  number VARCHAR(50) NOT NULL,
  rarity VARCHAR(50),
  type VARCHAR(50),
  image_url TEXT,
  -- JSONB for flexible attributes (different per TCG)
  attributes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(series_id, number)
);

-- Create user_collections table
CREATE TABLE user_collections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  owned BOOLEAN DEFAULT false,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, card_id)
);

-- Create wishlists table
CREATE TABLE wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, card_id)
);

-- Create indexes for better performance
CREATE INDEX idx_series_tcg_game ON series(tcg_game_id);
CREATE INDEX idx_cards_series ON cards(series_id);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_user_collections_user ON user_collections(user_id);
CREATE INDEX idx_user_collections_card ON user_collections(card_id);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_wishlists_card ON wishlists(card_id);

-- Enable Row Level Security
ALTER TABLE tcg_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tcg_games (public read)
CREATE POLICY "Allow public read access" ON tcg_games
  FOR SELECT USING (true);

-- RLS Policies for series (public read)
CREATE POLICY "Allow public read access" ON series
  FOR SELECT USING (true);

-- RLS Policies for cards (public read)
CREATE POLICY "Allow public read access" ON cards
  FOR SELECT USING (true);

-- RLS Policies for user_collections (users can only see their own)
CREATE POLICY "Users can view their own collections" ON user_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collections" ON user_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON user_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON user_collections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for wishlists (users can only see their own)
CREATE POLICY "Users can view their own wishlists" ON wishlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlists" ON wishlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlists" ON wishlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlists" ON wishlists
  FOR DELETE USING (auth.uid() = user_id);
-- Insert initial TCG games
INSERT INTO tcg_games (name, slug, description, icon, gradient) VALUES
  ('Pokémon TCG', 'pokemon', 'Explorez toutes les séries Pokémon et complétez votre collection', '⚡', 'from-yellow-400 via-red-500 to-pink-500'),
  ('Disney Lorcana', 'lorcana', 'Découvrez l''univers magique de Disney Lorcana', '✨', 'from-purple-400 via-blue-500 to-cyan-500'),
  ('One Piece Card Game', 'onepiece', 'Naviguez à travers les séries One Piece', '🏴‍☠️', 'from-orange-400 via-red-500 to-rose-500'),
  ('Riftbound', 'riftbound', 'Explorez l''univers de Riftbound', '🌌', 'from-indigo-400 via-purple-500 to-pink-500'),
  ('Naruto Kayou', 'naruto', 'Collectionnez les cartes du monde de Naruto', '🍥', 'from-amber-400 via-orange-500 to-red-500');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tcg_games_updated_at BEFORE UPDATE ON tcg_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_collections_updated_at BEFORE UPDATE ON user_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
