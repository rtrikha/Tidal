-- Fix NULL team_name values in prds table by extracting from storage_path
-- This should have been populated during ingestion, but we'll fix any missing values

UPDATE prds
SET team_name = split_part(storage_path, '/', 2)
WHERE team_name IS NULL 
  AND storage_path ~ '^prds/[^/]+/'
  AND split_part(storage_path, '/', 2) != '';

-- Also fix file_name if NULL
UPDATE prds
SET file_name = split_part(storage_path, '/', 3)
WHERE file_name IS NULL 
  AND storage_path ~ '^prds/[^/]+/[^/]+'
  AND split_part(storage_path, '/', 3) != '';

-- Verify the fix
SELECT 
  id, 
  storage_path, 
  team_name, 
  file_name,
  CASE 
    WHEN team_name IS NULL THEN '❌ NULL'
    ELSE '✅ ' || team_name
  END as team_status
FROM prds
ORDER BY team_name, file_name;

