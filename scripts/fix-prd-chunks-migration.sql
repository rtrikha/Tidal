-- Migration: Fix PRD chunks that still reference document_id instead of prd_id
-- This fixes chunks that should be linked to prds table via prd_id
-- but are still linked via document_id (legacy from before migration)

-- Step 1: Find chunks that have document_id pointing to a PRD in prds table
-- and update them to use prd_id instead
UPDATE chunks c
SET prd_id = c.document_id,
    document_id = NULL
FROM prds p
WHERE c.document_id = p.id
  AND c.prd_id IS NULL
  AND c.document_id IS NOT NULL;

-- Step 2: Verify the migration
-- You can run this query to see if there are any remaining chunks that need fixing:
-- SELECT COUNT(*) FROM chunks c
-- JOIN prds p ON c.document_id = p.id
-- WHERE c.prd_id IS NULL;

-- Summary:
-- ✅ Updated chunks to use prd_id for PRDs instead of document_id
-- ✅ Set document_id to NULL for PRD chunks (they should only use prd_id)
-- ⚠️  Note: This assumes all PRDs have been migrated to the prds table
-- ⚠️  Note: Chunks for designs still use document_id (which is correct)

