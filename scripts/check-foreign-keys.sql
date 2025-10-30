-- Check all foreign key constraints that might be causing the issue
-- This will show us if any constraints still reference 'documents'

-- Check foreign keys on chunks table
SELECT
  conname AS constraint_name,
  conrelid::regclass AS from_table,
  confrelid::regclass AS to_table,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE conrelid = 'chunks'::regclass
  AND contype = 'f'
ORDER BY conname;

-- Check if any constraints reference the old 'documents' table name
SELECT
  conname AS constraint_name,
  conrelid::regclass AS from_table,
  confrelid::regclass AS to_table
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid::regclass::text = 'documents';

-- If the second query returns any rows, those constraints need to be fixed

