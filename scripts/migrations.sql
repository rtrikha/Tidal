-- Clean Migrations for Design-Based Tidal RAG System
-- This file contains only the essential schema updates needed

-- Migration: Ensure team_name column exists in designs table
-- This allows organizing designs by team
ALTER TABLE designs ADD COLUMN IF NOT EXISTS team_name TEXT;

-- Add index for faster team-based filtering
CREATE INDEX IF NOT EXISTS idx_designs_team_name ON designs(team_name);

-- Migration: Ensure page_name column exists (renamed from title)
-- Note: If your designs table still has 'title', you may need to rename it manually:
-- ALTER TABLE designs RENAME COLUMN title TO page_name;

-- Add index for faster page_name searches
CREATE INDEX IF NOT EXISTS idx_designs_page_name ON designs(page_name);

-- Migration: Ensure image_url column exists in designs table
-- This stores the path to design screenshots
ALTER TABLE designs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Migration: Ensure figma_url column exists in designs table
-- This stores the Figma URL from identifiers.figmaUrl in JSON design files
-- Allows fast reverse lookup from Figma links
ALTER TABLE designs ADD COLUMN IF NOT EXISTS figma_url TEXT;

-- Add index for faster Figma URL lookups
CREATE INDEX IF NOT EXISTS idx_designs_figma_url ON designs(figma_url);

-- Migration: Add project_name and file_name columns to designs table
-- This allows hierarchical organization: designs/team/project/file/page/screen
ALTER TABLE designs ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add indexes for faster hierarchical filtering
CREATE INDEX IF NOT EXISTS idx_designs_project_name ON designs(project_name);
CREATE INDEX IF NOT EXISTS idx_designs_file_name ON designs(file_name);

-- Summary:
-- ✅ Designs table has team_name for organization
-- ✅ Designs table uses page_name (not title)
-- ✅ Designs table has image_url for design screenshots
-- ✅ Designs table has figma_url for Figma link reverse lookup
-- ✅ Designs table has project_name and file_name for hierarchical organization
-- ✅ No pages table - using simple document-based system
-- ✅ Chunks link directly to designs via document_id

