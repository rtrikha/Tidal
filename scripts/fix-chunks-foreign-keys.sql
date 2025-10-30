-- Fix foreign key constraints on chunks table after renaming documents to designs
-- This ensures chunks.table can properly reference the designs table

-- Step 1: Check and drop old foreign key constraint to documents (if it exists)
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_documents;
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_fkey;

-- Step 2: Recreate foreign key constraint pointing to designs table
ALTER TABLE chunks 
  ADD CONSTRAINT fk_chunks_designs 
  FOREIGN KEY (document_id) 
  REFERENCES designs(id) 
  ON DELETE CASCADE;

-- Step 3: Verify the constraint exists
-- Run this query to check: SELECT conname, confrelid::regclass FROM pg_constraint WHERE conrelid = 'chunks'::regclass AND confrelid = 'designs'::regclass;

-- Summary:
-- ✅ Dropped old foreign key to documents table
-- ✅ Created new foreign key pointing to designs table
-- ✅ Chunks can now properly reference designs table via document_id

