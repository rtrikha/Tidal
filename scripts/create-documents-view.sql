-- Temporary workaround: Create a view named 'documents' that points to 'designs' table
-- This allows PostgREST to find the table while schema cache refreshes
-- After a few minutes, you can drop this view once Supabase refreshes

-- Create view that acts as an alias to designs table
CREATE OR REPLACE VIEW documents AS 
SELECT 
  id,
  storage_path,
  sha256,
  type,
  page_name,
  image_url,
  team_name,
  figma_url
FROM designs;

-- Grant permissions on the view (same as designs table)
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO anon;

-- Note: This is a temporary workaround
-- After Supabase schema cache refreshes (usually 2-5 minutes), you can drop this view:
-- DROP VIEW IF EXISTS documents;

