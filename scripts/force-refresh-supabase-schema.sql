-- Force Supabase/PostgREST to refresh schema cache
-- Sometimes PostgREST caches the schema and needs to be told about table renames

-- Step 1: Notify PostgREST about schema changes (if using PostgREST directly)
-- Note: This usually happens automatically, but sometimes needs manual intervention

-- Step 2: Verify table exists with correct name
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('documents', 'designs');

-- Step 3: If 'documents' still exists, it wasn't renamed - run rename-documents-to-designs.sql
-- If 'designs' exists but ingestion still fails, PostgREST schema cache may need refresh

-- For Supabase: The schema cache should refresh automatically
-- If issues persist, try:
-- 1. Wait a few minutes for cache to refresh
-- 2. Restart your Supabase project (if self-hosted)
-- 3. Check Supabase dashboard to verify table name is 'designs'

-- Alternative: Create a view as a temporary workaround (not recommended long-term)
-- CREATE OR REPLACE VIEW documents AS SELECT * FROM designs;

