-- Migration pour changer les codes de série Lorcana
-- FC → FirstChapter
-- 9 → fabuleux

UPDATE series
SET code = 'fabuleux'
WHERE code = '9' AND tcg_game_id IN (SELECT id FROM tcg_games WHERE slug = 'lorcana');

UPDATE series
SET code = 'FirstChapter'
WHERE code = 'FC' AND tcg_game_id IN (SELECT id FROM tcg_games WHERE slug = 'lorcana');
