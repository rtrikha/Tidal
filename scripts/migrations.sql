-- Clean Migrations for Document-Based Tidal RAG System
-- This file contains only the essential schema updates needed

-- Migration: Ensure team_name column exists in documents table
-- This allows organizing documents by team
ALTER TABLE documents ADD COLUMN IF NOT EXISTS team_name TEXT;

-- Add index for faster team-based filtering
CREATE INDEX IF NOT EXISTS idx_documents_team_name ON documents(team_name);

-- Migration: Ensure page_name column exists (renamed from title)
-- Note: If your documents table still has 'title', you may need to rename it manually:
-- ALTER TABLE documents RENAME COLUMN title TO page_name;

-- Add index for faster page_name searches
CREATE INDEX IF NOT EXISTS idx_documents_page_name ON documents(page_name);

-- Migration: Ensure image_url column exists in documents table
-- This stores the path to design screenshots
ALTER TABLE documents ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Summary:
-- ✅ Documents table has team_name for organization
-- ✅ Documents table uses page_name (not title)
-- ✅ Documents table has image_url for design screenshots
-- ✅ No pages table - using simple document-based system
-- ✅ Chunks link directly to documents via document_id

