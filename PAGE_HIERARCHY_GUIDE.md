# 📄 Page-Based Hierarchy System

## Overview

The Tidal system now uses a **page-based hierarchy** for organizing knowledge. Instead of referencing entire documents, users can now ask questions about specific **pages** within documents, and the system will search only within the content of that page.

This is particularly useful for:
- **Design files** with multiple screens (e.g., "Verify Screen" containing v1, v2, OTP entry, etc.)
- **PRDs** with multiple sections (e.g., "Pricing", "Features", "Success Metrics")
- **Hierarchical documentation** where users want to focus on a specific section

---

## Data Model

### Hierarchy Structure

```
Document
├── Page 1 (e.g., "Verify Screen")
│   ├── Chunk 1 (first ~1000 chars)
│   ├── Chunk 2 (next ~1000 chars)
│   └── Chunk N
├── Page 2 (e.g., "Checkout Flow")
│   ├── Chunk 1
│   ├── Chunk 2
│   └── Chunk N
└── Page N
```

### Database Tables

**pages table:**
- `id` (UUID) - Primary key
- `document_id` (UUID) - Foreign key to documents
- `name` (TEXT) - Page name (e.g., "Verify Screen", "OTP Entry")
- `created_at`, `updated_at` - Timestamps

**chunks table (updated):**
- Now includes `page_id` (UUID) - Foreign key to pages
- Still includes `document_id` for backward compatibility
- Links each chunk to a specific page

---

## How Pages Are Extracted

### From Design Files (JSON)

The system looks for page structure in JSON files using multiple patterns:

1. **Direct array with `name` property:**
   ```json
   [
     { "name": "Screen 1", "components": [...] },
     { "name": "Screen 2", "components": [...] }
   ]
   ```

2. **`pages` property:**
   ```json
   {
     "pages": [
       { "name": "Screen 1", ... },
       { "name": "Screen 2", ... }
     ]
   }
   ```

3. **`frames` property:**
   ```json
   {
     "frames": [
       { "name": "Frame 1", ... },
       { "name": "Frame 2", ... }
     ]
   }
   ```

4. **`screens` property:**
   ```json
   {
     "screens": [
       { "name": "Screen 1", ... },
       { "name": "Screen 2", ... }
     ]
   }
   ```

5. **Fallback:** If no structure found, the entire file is treated as a single page

### From PRDs (Text/Markdown)

For text-based PRDs, the entire document is treated as a single page named after the file.

Future enhancement: Could add automatic section detection based on markdown headers or specific delimiters.

---

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration to add the required tables and columns:

```bash
# In Supabase SQL Editor, run:
# scripts/migrations.sql
```

This creates:
- `pages` table
- Adds `page_id` column to `chunks`
- Adds foreign key constraints
- Creates appropriate indexes

### 2. Re-ingest Data

The ingest script will automatically:
- Extract pages from design files
- Create page records in the database
- Associate chunks with pages

```bash
cd scripts
npm run ingest
```

---

## Using Pages with @Mentions

### Before (Document-Level):
```
User: "@Verify Screen what is the button color?"
System: Searches the entire "Verify Screen" document
```

### After (Page-Level):
```
User: "@Verify Screen - OTP Entry what is the input field style?"
System: Searches only the "Verify Screen - OTP Entry" page
```

### How It Works:

1. **Type `@`** to open the page selector
2. **Filter by page name** - Shows all available pages
3. **Select a page** - Replaces @mention with page name
4. **Ask your question** - System searches only that page

### Example Interactions:

**Scenario 1: Design Questions**
```
User: "@Creating a Booking what buttons are on this screen?"
Agent: Searches only the "Creating a Booking" page
Result: Shows all button definitions from that specific screen
```

**Scenario 2: PRD Questions**
```
User: "@Careem Plus Q4 2025 Vision What is the main objective?"
Agent: Searches only that PRD page
Result: Returns relevant passages about the Q4 vision
```

**Scenario 3: No Page Specified**
```
User: "What are all the button types in our design system?"
Agent: Searches across ALL pages
Result: Aggregates button information from all design files
```

---

## API Changes

### New Endpoints

**GET /api/pages**
- Returns all available pages with document context
- Format: `{ pages: [{ id, name, documentId, documentTitle }, ...] }`

### Modified Endpoints

**POST /api/ask**
- Now accepts `pageIds` parameter (array of page UUIDs)
- When provided, searches only within those pages
- Falls back to general search if no pages specified

---

## Frontend Changes

### chat-input.tsx

- Fetches pages instead of documents
- @ mention dropdown now shows:
  - Page name
  - Parent document name (for context)
- Maintains same UX as before

### Example Page Dropdown:

```
Select a page (↑↓ to navigate)
─────────────────────────────────
Verify Screen - OTP Entry
(Verify Screen v1)

Verify Screen - Phone Input
(Verify Screen v1)

Verify Screen - Confirmation
(Verify Screen v1)

Creating a Booking - Step 1
(Creating a Booking export)
```

---

## Agent Behavior

When a user mentions a page with `@`, the agent:

1. **Constrains search** to that page only
2. **Shows related screenshots** from that page
3. **Provides page-specific context** in answers
4. **Suggests related pages** if information is incomplete

The agent rules have been updated to:
- Treat @page mentions as PRIMARY context
- Search page-specific chunks
- Avoid cross-page information unless explicitly needed

---

## Benefits

✅ **Focused Queries** - Ask about specific screens/sections without irrelevant content
✅ **Better Screenshots** - Visual context is more relevant when scoped to a page
✅ **Faster Responses** - Smaller search space = faster vector similarity
✅ **Clearer Hierarchy** - Users understand what content is available
✅ **Cross-Reference Prevention** - Avoids conflating similar content across pages

---

## Technical Details

### Page Extraction (ingest.ts)

Function: `extractPagesFromContent(content, fileName)`
- Parses JSON design files
- Detects multiple common page formats
- Returns array of `{ pageName, content }` objects

Function: `ensurePage(pageName, documentId)`
- Creates/retrieves page record from database
- Handles duplicates automatically

### Page-Based Search (ask/route.ts)

Function: `executeSearchByPages(query, pageIds, limit)`
- Fetches chunks for specified pages
- Calculates embedding similarity
- Returns sorted, truncated results with page context

---

## Migration from Document-Based System

### Backward Compatibility

- Existing document references still work
- System maintains both `document_id` and `page_id` in chunks
- General searches (no @mention) still function normally
- Old document-based API calls still supported

### What to Update

✅ Update @ mention references from documents to pages
✅ Re-run ingestion to populate pages
✅ Run database migration (scripts/migrations.sql)
❌ No need to delete existing data
❌ No breaking changes to core functionality

---

## Troubleshooting

### Q: Pages not appearing in @ mention dropdown?
**A:** Run the database migration and re-ingest data.

### Q: Pages not being extracted from my JSON files?
**A:** Check that your JSON structure matches one of the supported patterns. Update `extractPagesFromContent()` if using a custom format.

### Q: Search results still including other pages?
**A:** Ensure `pageIds` are being passed to the API. Check browser console for request details.

### Q: Old documents still showing up?
**A:** Run `npm run reset-and-reingest` to clear old data and re-ingest with page hierarchy.

---

## Future Enhancements

Potential improvements:
- 🔄 Automatic section detection from markdown headers
- 🎨 Page thumbnails in dropdown
- 📊 Page usage statistics  
- 🔗 Cross-page relationship detection
- 🏷️ User-defined page tags/categories
- 📍 Breadcrumb navigation (Document → Page → Content)

---

## Support

For questions about the page hierarchy system, check:
1. This guide (PAGE_HIERARCHY_GUIDE.md)
2. Agent rules (AGENT_RULES.md)
3. Architecture documentation (ARCHITECTURE.md)
4. Code comments in scripts/ingest.ts and tidal_ui/app/api/ask/route.ts
