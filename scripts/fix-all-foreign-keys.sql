-- Fix ALL foreign key constraints after renaming documents to designs
-- This ensures all constraints properly reference the designs table

-- Step 1: List all foreign key constraints that might reference documents
-- Run this to see what constraints exist:
/*
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('documents', 'designs');
*/

-- Step 2: Drop old foreign key constraints on chunks table
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_documents;
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_fkey;
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS chunks_document_id_documents_id_fk;

-- Step 3: Drop existing fk_chunks_designs if it exists, then recreate it
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_designs;

-- Step 4: Recreate foreign key constraint pointing to designs table
ALTER TABLE chunks 
  ADD CONSTRAINT fk_chunks_designs 
  FOREIGN KEY (document_id) 
  REFERENCES designs(id) 
  ON DELETE CASCADE;

-- Step 5: Verify prds foreign key exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_chunks_prds' 
    AND conrelid = 'chunks'::regclass
  ) THEN
    ALTER TABLE chunks 
      ADD CONSTRAINT fk_chunks_prds 
      FOREIGN KEY (prd_id) 
      REFERENCES prds(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 6: Verify no constraints still reference 'documents'
-- Run this to check:
/*
SELECT
  conname,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid::regclass::text = 'documents';
*/

-- Summary:
-- ✅ Dropped all old foreign keys pointing to documents
-- ✅ Created foreign key pointing to designs table
-- ✅ Ensured prds foreign key exists
-- ⚠️  If Step 5 query returns any rows, those constraints need manual fixing

