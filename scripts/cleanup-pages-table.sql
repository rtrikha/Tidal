-- Cleanup Script: Remove pages table and related columns
-- This reverts the page-based hierarchy migration and returns to simple document-based system

-- Step 1: Drop the foreign key constraint from chunks to pages (if it exists)
ALTER TABLE chunks DROP CONSTRAINT IF EXISTS fk_chunks_pages;

-- Step 2: Drop the page_id column from chunks table
ALTER TABLE chunks DROP COLUMN IF EXISTS page_id;

-- Step 3: Drop the pages table
DROP TABLE IF EXISTS pages CASCADE;

-- Step 4: Clean up any leftover indexes
DROP INDEX IF EXISTS idx_chunks_page_id;
DROP INDEX IF EXISTS idx_pages_document_id;
DROP INDEX IF EXISTS idx_pages_name;
DROP INDEX IF EXISTS idx_pages_unique_name_per_doc;

-- Verification queries (run these to confirm cleanup)
-- Check that pages table is gone:
-- SELECT * FROM pg_tables WHERE tablename = 'pages';

-- Check that page_id column is gone from chunks:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'chunks' AND column_name = 'page_id';

-- Check documents table (should still be intact):
-- SELECT COUNT(*) FROM documents;

-- Check chunks table (should still be intact):
-- SELECT COUNT(*) FROM chunks;

-- Summary:
-- ✅ Removed pages table
-- ✅ Removed page_id column from chunks
-- ✅ Removed related foreign keys and indexes
-- ✅ Documents and chunks tables remain intact

