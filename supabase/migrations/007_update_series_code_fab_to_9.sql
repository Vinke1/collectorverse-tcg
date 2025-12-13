-- Migration to update series code from 'FAB' to '9'

UPDATE series
SET code = '9'
WHERE code = 'FAB';
