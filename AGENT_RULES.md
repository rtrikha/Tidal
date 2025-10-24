# 🤖 Tidal Agent Rules & Instructions

⚠️ **THIS FILE IS FOR REFERENCE ONLY**

The actual rules are now organized in separate files in the `rules/` directory and are automatically merged by the loader at runtime.

---

## 📂 Rule Files Structure

Rules are now split into three focused files:

### 1. `rules/shared-rules.md`
Rules that apply to ALL interactions, regardless of @mention usage:
- Agent Identity
- Visual Analysis & Screenshots
- Tool Usage Strategy
- Conversation Context
- Response Guidelines
- Design-Specific Rules
- Content Limits

### 2. `rules/mention-rules.md`
Rules specific to when a user mentions a page with `@`:
- @Mentioned Pages (CRITICAL)
- Scope boundaries for @mentions
- Examples of good/bad @mention behavior

### 3. `rules/general-rules.md`
Rules for when NO @mention is used:
- General Questions (No @mention)
- **Proactive Data Search (CRITICAL)** - Search across all data wherever possible
- Multiple search strategies
- Scope boundaries for general queries

---

## 🔄 How Rules Are Merged

The loader (`tidal_ui/lib/agent-rules.ts`) automatically:
1. Reads all three rule files from `rules/` directory
2. Merges them in order: shared → mention-specific → general-specific
3. Caches the merged result for performance
4. Falls back to hardcoded rules if files are missing

---

## ✏️ How to Update Rules

**To modify rules:**
1. Edit the appropriate file in `rules/`:
   - General @mention behavior? → Edit `rules/mention-rules.md`
   - General questions/proactive search? → Edit `rules/general-rules.md`
   - Something that applies to both? → Edit `rules/shared-rules.md`
2. Changes take effect on next request (cache is cleared automatically)
3. No need to update this reference file - it's just for documentation

---

## 🔑 Key Rules Summary

### When @mention is used:
- ✅ Search ONLY within that page
- ✅ Show results exclusively from mentioned page
- ✅ Suggest other pages if information isn't found

### When NO @mention is used:
- ✅ Search across ALL pages and documents
- ✅ Perform MULTIPLE searches with different keywords
- ✅ Search "wherever possible" for comprehensive results
- ✅ Use 2-3 different search angles
- ✅ Don't stop at first result - dig deeper

### Always:
- ✅ Analyze screenshots visually (GPT-4o vision)
- ✅ Cite which pages you're using
- ✅ Be specific and accurate
- ✅ Maintain conversation context

---

## 📍 File Locations

```
/Users/raunak.trikha/Documents/Tidal/
├── AGENT_RULES.md (this file - reference only)
└── rules/
    ├── shared-rules.md
    ├── mention-rules.md
    └── general-rules.md
```

---

## 🚀 Getting Started

The rules are automatically loaded and merged when the agent starts. No configuration needed!

---

*Last updated: 2025-10-21*
*Rules structure refactored for better organization and maintainability*

