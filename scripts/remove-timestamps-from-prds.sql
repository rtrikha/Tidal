-- Migration: Remove created_at and updated_at columns from prds table

-- Step 1: Drop the timestamp columns if they exist
ALTER TABLE prds DROP COLUMN IF EXISTS created_at;
ALTER TABLE prds DROP COLUMN IF EXISTS updated_at;

-- Summary:
-- ✅ Removed created_at column from prds table
-- ✅ Removed updated_at column from prds table
-- ✅ prds table now has: id, storage_path, sha256, file_name, team_name

