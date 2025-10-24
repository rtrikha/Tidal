# 🚀 Page-Based System - Quick Start

## What Changed?

**Before:** `@checkout` searched the entire checkout document
**Now:** `@Checkout - Step 1` searches only that specific page/screen

---

## Quick Setup (5 Steps)

### 1️⃣ Run Database Migration
```sql
-- In Supabase SQL Editor, paste & run:
-- scripts/migrations.sql
```

### 2️⃣ Deploy Code
Updated files are ready in your repo:
- `scripts/ingest.ts` - Page extraction
- `tidal_ui/app/api/pages/route.ts` - New endpoint
- `tidal_ui/app/api/ask/route.ts` - Page search
- `tidal_ui/components/chat-input.tsx` - Page mentions
- `tidal_ui/components/chat-interface.tsx` - Pass pageIds

### 3️⃣ Re-ingest Data
```bash
cd scripts
npm run ingest
```

### 4️⃣ Restart UI
```bash
cd tidal_ui
npm run dev
```

### 5️⃣ Test It
- Type `@` in the chat input
- See pages in the dropdown
- Select a page and ask a question

---

## How to Use

### @ Mention a Page
```
Type: @
↓
Select page from dropdown
↓
Ask your question
```

### Examples

**Question about a specific screen:**
```
User: "@Verify Screen - OTP Input what fields are present?"
Agent: Searches ONLY the OTP Input page
```

**Question across all docs (no @mention):**
```
User: "What buttons are in our designs?"
Agent: Searches ALL pages and documents
```

---

## Key Points

✅ **Page-scoped searches** - More focused results
✅ **Automatic extraction** - Pages detected from design JSON files
✅ **Backward compatible** - Old system still works
✅ **Better context** - See page name + parent document
✅ **Faster searches** - Searches smaller content space

---

## FAQ

**Q: Will my old document searches break?**
A: No! Old system still works. You can use either @document or @page.

**Q: Do I need to change anything in my documents?**
A: No! The system automatically extracts pages from your JSON files.

**Q: What if my JSON format isn't recognized?**
A: Update `extractPagesFromContent()` in `scripts/ingest.ts` to add your format.

**Q: How do I know if it's working?**
A: Visit `/api/pages` - should return a list of all pages.

---

## Documentation

For more details:
- 📖 **PAGE_HIERARCHY_GUIDE.md** - Complete guide
- 📋 **IMPLEMENTATION_SUMMARY.md** - Technical details
- ✅ **DEPLOYMENT_CHECKLIST.md** - Step-by-step deployment
- 🤖 **AGENT_RULES.md** - Agent behavior rules

---

## Support

Issues? Check:
1. DEPLOYMENT_CHECKLIST.md → Common Issues section
2. Verify pages table: `SELECT COUNT(*) FROM pages;`
3. Verify chunks have page_id: `SELECT COUNT(DISTINCT page_id) FROM chunks WHERE page_id IS NOT NULL;`
4. Check `/api/pages` endpoint returns data

---

## That's it! 🎉

Your system now has page-level context. Users can ask questions about specific pages, and the AI will provide focused, page-scoped answers.

Ready to deploy? See DEPLOYMENT_CHECKLIST.md
