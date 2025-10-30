-- Migration: Rename page_name to file_name and update team_name from storage_path
-- Structure: prds/team name/file name

-- Step 1: Rename page_name column to file_name
ALTER TABLE prds RENAME COLUMN page_name TO file_name;

-- Step 2: Drop old index and create new one
DROP INDEX IF EXISTS idx_prds_page_name;
CREATE INDEX IF NOT EXISTS idx_prds_file_name ON prds(file_name);

-- Step 3: Update team_name for all existing records by extracting from storage_path
-- Format: prds/team_name/file_name
UPDATE prds
SET team_name = (
  CASE 
    -- Extract team name from path: prds/team_name/file_name
    WHEN storage_path ~ '^prds/[^/]+/' THEN
      split_part(storage_path, '/', 2)
    ELSE
      NULL
  END
)
WHERE storage_path LIKE 'prds/%';

-- Step 4: Update file_name for all existing records by extracting from storage_path
-- Format: prds/team_name/file_name
UPDATE prds
SET file_name = (
  CASE 
    -- Extract file name from path: prds/team_name/file_name
    WHEN storage_path ~ '^prds/[^/]+/' THEN
      split_part(storage_path, '/', 3)
    ELSE
      split_part(storage_path, '/', -1) -- Fallback to last segment
  END
)
WHERE storage_path LIKE 'prds/%';

-- Summary:
-- ✅ Renamed page_name column to file_name
-- ✅ Updated index from idx_prds_page_name to idx_prds_file_name
-- ✅ Extracted team_name from storage_path (format: prds/team_name/file_name)
-- ✅ Extracted file_name from storage_path (last segment after team_name)
-- ✅ prds table now has: id, storage_path, sha256, file_name, team_name

