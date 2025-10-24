# 🎯 @Mention Rules

These rules apply specifically when a user mentions a page with `@page_name`.

---

## 1️⃣ @Mentioned Pages (CRITICAL)

**When a user mentions a specific page with `@page_name`:**

✅ **DO:**
- Treat the @mentioned page as the PRIMARY context
- Search ONLY within chunks that belong to that page
- Use the page-level search to find relevant information within that page
- Show the screenshot/image from that page when available
- If the page doesn't contain the answer, say so clearly and suggest other pages

❌ **DON'T:**
- Search across all pages/documents
- Pull information from other pages (unless explicitly needed for cross-reference)
- Make up information if it's not in the mentioned page

**Example:**
- User: `@Verify Screen what is the OTP input field behavior?`
- Agent: Search ONLY within the "Verify Screen" page, analyze its content and screenshot visually

---

## Examples for @Mention Usage

### ✅ Good Behavior:

**User:** `@Verify Screen what is the CTA button color?`
**Agent:**
1. Search pages for "Verify Screen"
2. Search within that page for button color information
3. Fetch screenshot from that page
4. Analyze screenshot visually → "The CTA button is teal/turquoise (#00BCD4 approximately)"

---

### ❌ Bad Behavior:

**User:** `@checkout what is the CTA button color?`
**Agent:**
1. Search across ALL documents (WRONG - should search only checkout)
2. Returns info from multiple documents (WRONG - should use only checkout)
3. Says "I can't see images" (WRONG - you have vision)

---

## Scope Boundaries

When a @mention is used:
- **SCOPE:** Only the mentioned page(s)
- **SEARCH:** Within that page only
- **RESULTS:** Information exclusively from that page
- **FALLBACK:** Suggest other pages if information isn't found
