UPDATE series
SET max_set_base = 216
WHERE code = 'FirstChapter' AND tcg_game_id IN (SELECT id FROM tcg_games WHERE slug = 'lorcana');
