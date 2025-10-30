-- Migration: Separate PRDs from Documents
-- This migration creates a new 'prds' table and migrates all PRD records from 'documents' to 'prds'
-- This allows PRDs to have a different column structure than design documents

-- Step 1: Create the prds table with structure similar to documents (can be customized later)
CREATE TABLE IF NOT EXISTS prds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL UNIQUE,
  sha256 TEXT,
  file_name TEXT, -- File name extracted from storage_path (prds/team_name/file_name)
  team_name TEXT  -- Team name extracted from storage_path (prds/team_name/file_name)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_prds_storage_path ON prds(storage_path);
CREATE INDEX IF NOT EXISTS idx_prds_team_name ON prds(team_name);
CREATE INDEX IF NOT EXISTS idx_prds_file_name ON prds(file_name);

-- Step 2: Add prd_id column to chunks table (nullable, since design chunks still use document_id)
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS prd_id UUID;

-- Add foreign key constraint from chunks to prds
-- Drop constraint first if it exists (PostgreSQL doesn't support IF NOT EXISTS for ADD CONSTRAINT)
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_prds;

ALTER TABLE chunks 
  ADD CONSTRAINT fk_chunks_prds 
  FOREIGN KEY (prd_id) 
  REFERENCES prds(id) 
  ON DELETE CASCADE;

-- Create index for faster prd-based searches
CREATE INDEX IF NOT EXISTS idx_chunks_prd_id ON chunks(prd_id);

-- Step 3: Enable RLS on prds table
ALTER TABLE prds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS prds_select_policy ON prds;
DROP POLICY IF EXISTS prds_insert_policy ON prds;
DROP POLICY IF EXISTS prds_update_policy ON prds;
DROP POLICY IF EXISTS prds_delete_policy ON prds;

-- Allow everyone to read prds
CREATE POLICY prds_select_policy ON prds
  FOR SELECT USING (true);

-- Allow service role to manage prds
CREATE POLICY prds_insert_policy ON prds
  FOR INSERT WITH CHECK (true);

CREATE POLICY prds_update_policy ON prds
  FOR UPDATE USING (true);

CREATE POLICY prds_delete_policy ON prds
  FOR DELETE USING (true);

-- Step 4: Migrate existing PRD records from designs to prds
-- Note: If 'documents' table still exists, this will work. 
-- If it's been renamed to 'designs', update the FROM clause to 'designs'
-- This migration script should be run carefully to avoid data loss
-- Extract team_name and file_name from storage_path (format: prds/team_name/file_name)
INSERT INTO prds (id, storage_path, sha256, file_name, team_name)
SELECT 
  id,
  storage_path,
  sha256,
  -- Extract file_name from path: prds/team_name/file_name
  CASE 
    WHEN storage_path ~ '^prds/[^/]+/' THEN
      split_part(storage_path, '/', 3)
    ELSE
      split_part(storage_path, '/', -1) -- Fallback to last segment
  END AS file_name,
  -- Extract team_name from path: prds/team_name/file_name
  CASE 
    WHEN storage_path ~ '^prds/[^/]+/' THEN
      split_part(storage_path, '/', 2)
    ELSE
      NULL
  END AS team_name
FROM designs
WHERE type = 'prd'
ON CONFLICT (storage_path) DO NOTHING; -- Skip if already migrated

-- Step 5: Update chunks to reference prds instead of designs for PRD chunks
UPDATE chunks c
SET prd_id = c.document_id
FROM designs d
WHERE c.document_id = d.id 
  AND d.type = 'prd'
  AND c.prd_id IS NULL; -- Only update if not already set

-- Step 6: Remove PRD records from designs table (optional - comment out if you want to keep them)
-- DELETE FROM designs WHERE type = 'prd';

-- Summary:
-- ✅ Created prds table with flexible structure
-- ✅ Added prd_id column to chunks table
-- ✅ Migrated PRD records from documents to prds
-- ✅ Updated chunks to reference prds
-- ⚠️  Note: RPC functions need to be updated to search both tables (see update-rpc-functions.sql)
-- ⚠️  Note: API routes need to be updated to query both tables

