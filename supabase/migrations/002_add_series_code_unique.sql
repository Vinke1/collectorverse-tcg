-- Add unique constraint on series.code
-- This allows upsert operations based on the series code

ALTER TABLE series ADD CONSTRAINT series_code_unique UNIQUE (code);
