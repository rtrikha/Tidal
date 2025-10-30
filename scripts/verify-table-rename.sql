-- Verification script: Check that documents table was properly renamed to designs
-- And that there are no remaining references to the old 'documents' table

-- Step 1: Check if documents table still exists (it shouldn't)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'documents'
) AS documents_table_exists;

-- Step 2: Check if designs table exists (it should)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'designs'
) AS designs_table_exists;

-- Step 3: Check foreign key constraints on chunks table
SELECT
  conname AS constraint_name,
  confrelid::regclass AS referenced_table,
  conrelid::regclass AS source_table
FROM pg_constraint
WHERE conrelid = 'chunks'::regclass
  AND contype = 'f'
  AND confrelid::regclass::text LIKE '%document%' OR confrelid::regclass::text LIKE '%design%';

-- Step 4: List all foreign key constraints that reference 'documents' or 'designs'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'documents' OR ccu.table_name = 'designs');

-- If documents table still exists, you need to run: scripts/rename-documents-to-designs.sql
-- If foreign keys still reference 'documents', you may need to drop and recreate them

