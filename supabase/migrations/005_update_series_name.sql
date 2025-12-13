-- Migration to update series names by removing the code prefix
-- Example: "FAB - Fabuleux" → "Fabuleux"

UPDATE series
SET name = 'Fabuleux'
WHERE code = 'FAB' AND name = 'FAB - Fabuleux';

-- You can add more series updates here if needed
-- UPDATE series
-- SET name = 'Series Name'
-- WHERE code = 'CODE' AND name = 'CODE - Series Name';
