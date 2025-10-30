-- Make document_id nullable in chunks table
-- This allows PRDs to have document_id = NULL and prd_id set instead
-- Designs will still have document_id set and prd_id = NULL

-- Step 1: Make document_id column nullable
ALTER TABLE chunks ALTER COLUMN document_id DROP NOT NULL;

-- Step 2: Verify the change
-- Run this query to check: SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'chunks' AND column_name IN ('document_id', 'prd_id');

-- Summary:
-- ✅ document_id is now nullable (can be NULL for PRD chunks)
-- ✅ prd_id is already nullable (can be NULL for design chunks)
-- ✅ Chunks for PRDs: document_id = NULL, prd_id = <prd_id>
-- ✅ Chunks for designs: document_id = <design_id>, prd_id = NULL

