-- Migration: Add page-based hierarchy to Tidal RAG system
-- This migration adds the ability to organize chunks by pages
-- 
-- Changes:
-- 1. Create new 'pages' table to store page hierarchies
-- 2. Add 'page_id' column to 'chunks' table
-- 3. Add foreign key constraint from chunks to pages

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key to documents
  CONSTRAINT fk_pages_documents 
    FOREIGN KEY (document_id) 
    REFERENCES documents(id) 
    ON DELETE CASCADE
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_pages_document_id ON pages(document_id);
CREATE INDEX IF NOT EXISTS idx_pages_name ON pages(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_unique_name_per_doc 
  ON pages(document_id, name);

-- Add page_id column to chunks table if it doesn't exist
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS page_id UUID;

-- Add foreign key constraint from chunks to pages
ALTER TABLE chunks 
  ADD CONSTRAINT fk_chunks_pages 
  FOREIGN KEY (page_id) 
  REFERENCES pages(id) 
  ON DELETE CASCADE;

-- Create index for faster page-based searches
CREATE INDEX IF NOT EXISTS idx_chunks_page_id ON chunks(page_id);

-- Add RLS (Row Level Security) policies for pages table
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS pages_select_policy ON pages;
DROP POLICY IF EXISTS pages_insert_policy ON pages;
DROP POLICY IF EXISTS pages_update_policy ON pages;
DROP POLICY IF EXISTS pages_delete_policy ON pages;

-- Allow everyone to read pages (same as documents)
CREATE POLICY pages_select_policy ON pages
  FOR SELECT USING (true);

-- Allow service role to manage pages
CREATE POLICY pages_insert_policy ON pages
  FOR INSERT WITH CHECK (true);

CREATE POLICY pages_update_policy ON pages
  FOR UPDATE USING (true);

CREATE POLICY pages_delete_policy ON pages
  FOR DELETE USING (true);

-- Migration: Add team_name to documents table
-- This allows organizing documents by team
ALTER TABLE documents ADD COLUMN IF NOT EXISTS team_name TEXT;

-- Add index for faster team-based filtering
CREATE INDEX IF NOT EXISTS idx_documents_team_name ON documents(team_name);

-- Migration: Add file_name to pages table
-- This stores the original file name for each page
ALTER TABLE pages ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Migration: Rename columns for clarity
-- Rename 'name' to 'screen_name' in pages table
-- Rename 'title' to 'page_name' in documents table
ALTER TABLE pages RENAME COLUMN name TO screen_name;
ALTER TABLE documents RENAME COLUMN title TO page_name;
