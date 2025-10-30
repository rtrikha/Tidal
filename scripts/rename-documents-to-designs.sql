-- Migration: Rename documents table to designs and remove timestamp columns
-- This migration renames the 'documents' table to 'designs' to better reflect its purpose
-- and removes created_at/updated_at columns if they exist

-- Step 1: Remove timestamp columns if they exist (they may not exist in all setups)
ALTER TABLE documents DROP COLUMN IF EXISTS created_at;
ALTER TABLE documents DROP COLUMN IF EXISTS updated_at;

-- Step 2: Drop foreign key constraint from chunks that references documents
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_documents;

-- Step 3: Rename the documents table to designs
ALTER TABLE documents RENAME TO designs;

-- Step 4: Recreate foreign key constraint with new table name
ALTER TABLE chunks 
  ADD CONSTRAINT fk_chunks_designs 
  FOREIGN KEY (document_id) 
  REFERENCES designs(id) 
  ON DELETE CASCADE;

-- Step 5: Rename indexes
ALTER INDEX IF EXISTS idx_documents_storage_path RENAME TO idx_designs_storage_path;
ALTER INDEX IF EXISTS idx_documents_team_name RENAME TO idx_designs_team_name;
ALTER INDEX IF EXISTS idx_documents_page_name RENAME TO idx_designs_page_name;
ALTER INDEX IF EXISTS idx_documents_figma_url RENAME TO idx_designs_figma_url;

-- Step 6: Update RLS policies (drop old, create new)
DROP POLICY IF EXISTS documents_select_policy ON designs;
DROP POLICY IF EXISTS documents_insert_policy ON designs;
DROP POLICY IF EXISTS documents_update_policy ON designs;
DROP POLICY IF EXISTS documents_delete_policy ON designs;

-- Create new policies for designs table
CREATE POLICY designs_select_policy ON designs
  FOR SELECT USING (true);

CREATE POLICY designs_insert_policy ON designs
  FOR INSERT WITH CHECK (true);

CREATE POLICY designs_update_policy ON designs
  FOR UPDATE USING (true);

CREATE POLICY designs_delete_policy ON designs
  FOR DELETE USING (true);

-- Summary:
-- ✅ Removed created_at and updated_at columns (if they existed)
-- ✅ Renamed documents table to designs
-- ✅ Updated foreign key constraints
-- ✅ Renamed indexes
-- ✅ Updated RLS policies
-- ⚠️  Note: You need to update all code references from 'documents' to 'designs'
-- ⚠️  Note: RPC functions need to be updated (see update-rpc-functions-designs.sql)

