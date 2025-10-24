# 🧹 Complete Pages Table Cleanup Guide

This guide removes the pages table and reverts to the simple document-based system.

---

## ✅ What Was Done in Code

1. **Fixed API Routes**
   - `/api/pages/route.ts` - Now queries `documents` table only
   - `/api/ask/route.ts` - Uses `documents` table with `page_name` column

2. **Updated Scripts**
   - `scripts/ingest.ts` - Removed pages table checks
   - `scripts/migrations.sql` - New clean version without pages
   - `scripts/migrations-old-with-pages.sql` - Old version archived

3. **Created Cleanup Scripts**
   - `scripts/cleanup-pages-table.sql` - Removes pages table from database
   - `scripts/create-rpc-functions.sql` - Fixed RPC functions to use `page_name`

---

## 🚀 Steps to Complete Cleanup

### Step 1: Run RPC Function Fix (REQUIRED)

Open Supabase SQL Editor and run:
```bash
scripts/create-rpc-functions.sql
```

This fixes the `match_chunks` and `match_chunks_by_document` functions to use `page_name` instead of `title`.

**Status:** ⚠️ NOT YET RUN - THIS IS REQUIRED FOR THE SYSTEM TO WORK!

---

### Step 2: Remove Pages Table (OPTIONAL)

If you want to clean up the database, run:
```bash
scripts/cleanup-pages-table.sql
```

This will:
- Drop the `pages` table
- Remove `page_id` column from `chunks`
- Remove related foreign keys and indexes

**Status:** ⚠️ OPTIONAL - The pages table exists but is not used

---

## 📋 Current System Architecture

### Database Schema
```
documents
├── id (UUID)
├── page_name (TEXT) ← Used for display
├── team_name (TEXT) ← For organization
├── image_url (TEXT) ← For design screenshots
├── type (TEXT)
├── storage_path (TEXT)
├── sha256 (TEXT)
└── created_at (TIMESTAMP)

chunks
├── id (UUID)
├── document_id (UUID) → documents.id
├── content (TEXT)
├── chunk_index (INT)
└── created_at (TIMESTAMP)

chunk_embeddings
├── chunk_id (UUID) → chunks.id
└── embedding (vector(1536))
```

### How @ Mentions Work

1. **User types `@`** in chat input
2. **Frontend fetches** from `/api/pages` (queries `documents` table)
3. **User selects** a document (e.g., "Auto-Checked Food Subscription Trial Results")
4. **Frontend sends** `pageIds: [document_id]` to `/api/ask`
5. **Backend searches** chunks in that document using RPC `match_chunks_by_document`
6. **Agent answers** based on chunks from that specific document

---

## 🔍 Verification

Run these queries in Supabase to verify:

```sql
-- Check documents table has correct columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- Check RPC functions exist and work
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_name LIKE 'match_chunks%';

-- Check if pages table still exists (should be empty after cleanup)
SELECT * FROM pg_tables WHERE tablename = 'pages';
```

---

## ✅ Testing the System

1. Start the UI: `cd tidal_ui && npm run dev`
2. Type `@` in the chat
3. Select a document from the dropdown
4. Ask a question about it
5. The system should find and summarize the document

---

## 🗑️ Files You Can Delete (Optional)

After successful cleanup:
- `PAGE_HIERARCHY_GUIDE.md` - Describes the pages system we removed
- `PAGE_SYSTEM_QUICK_START.md` - Quick start for pages system
- `scripts/migrations-old-with-pages.sql` - Old migrations

Keep these:
- `scripts/migrations.sql` - Clean migrations
- `scripts/cleanup-pages-table.sql` - For reference
- `scripts/create-rpc-functions.sql` - RPC functions definition

---

## 📝 Summary

**Before:** Complex page-based hierarchy with separate pages table  
**After:** Simple document-based system with direct queries

**Benefits:**
- ✅ Simpler architecture
- ✅ Fewer database joins
- ✅ Easier to maintain
- ✅ Still supports @ mentions for specific documents
- ✅ Works with existing data

---

## ⚠️ Important Notes

1. **MUST RUN:** `create-rpc-functions.sql` in Supabase (system won't work without it)
2. **OPTIONAL:** `cleanup-pages-table.sql` to remove unused table
3. **Column name:** Documents table uses `page_name` not `title`
4. **Backward compatible:** Old code using `title` has fallback logic

---

## 🆘 Troubleshooting

### Error: "column d.title does not exist"
**Solution:** Run `scripts/create-rpc-functions.sql` in Supabase

### Error: "RPC function does not exist"
**Solution:** Run `scripts/create-rpc-functions.sql` in Supabase

### @ mentions dropdown is empty
**Solution:** Check `/api/pages` endpoint returns data

### Search returns no results
**Solution:** 
1. Verify RPC functions are created
2. Check chunks exist for the document
3. Check embeddings exist in `chunk_embeddings` table

---

## 📞 Need Help?

Check the logs:
- Browser console for frontend errors
- Terminal for backend/API errors
- Supabase logs for database errors

