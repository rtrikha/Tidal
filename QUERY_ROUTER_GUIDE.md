# 🎯 Query Router System Guide

## Overview

The Query Router is an intelligent system that classifies user queries and loads only the relevant rule files needed to answer them effectively. This reduces token usage, improves response quality, and makes the system scalable.

---

## Architecture

### Flow Diagram

```
User Query
    ↓
Query Classifier (query-classifier.ts)
    → Analyzes keywords and context
    → Determines QueryType
    ↓
Get Rule Files (getRuleFilesForQueryType)
    → Maps QueryType to specific rule files
    → Returns only relevant rules
    ↓
Load Rules (loadRulesForQueryType)
    → Reads and caches selected rule files
    → Merges into system prompt
    ↓
LLM Agent
    → Responds with focused instructions
```

---

## Query Types

The system recognizes 8 different query types:

| Query Type | Detection | Rules Loaded | Use Case |
|-----------|-----------|-------------|----------|
| `mention_ui_design` | @mention + design keywords | shared, mention, ui-design | "What color is the button?" |
| `mention_comparison` | @mention + compare keywords | shared, mention, comparison | "@page1 vs @page2 style?" |
| `mention_summary` | @mention + summarize keywords | shared, mention, summarization | "@doc summarize this" |
| `mention_general` | @mention only | shared, mention, general | "@page what is...?" |
| `comparison` | compare keywords | shared, comparison | "Compare two documents" |
| `summarization` | summarize keywords | shared, summarization | "Summarize this" |
| `ui_design_general` | design keywords | shared, ui-design | "What's the color scheme?" |
| `general` | none of above | shared, general | Generic questions |

---

## Rule Files

### Structure

```
/rules/
├── shared-rules.md           ← Core rules applied to ALL queries
├── mention-rules.md          ← @mention-specific behavior
├── general-rules.md          ← General question handling
├── ui-design-rules.md        ← UI/design analysis instructions
├── comparison-rules.md       ← Comparison methodology
└── summarization-rules.md    ← Summarization strategies
```

### When Each File Is Used

**Always Loaded:**
- `shared-rules.md` - Foundation for all responses

**Conditionally Loaded:**
- `mention-rules.md` - When query includes @mention
- `ui-design-rules.md` - When asking about colors, layouts, UI
- `comparison-rules.md` - When comparing documents
- `summarization-rules.md` - When summarizing
- `general-rules.md` - For non-specific questions

---

## How to Add New Query Types

### Step 1: Add to `query-classifier.ts`

```typescript
export type QueryType = 
  | 'your_new_type'  // Add here
  | ...
```

### Step 2: Add Detection Logic

```typescript
const yourKeywords = ['keyword1', 'keyword2'];
const hasYourKeyword = yourKeywords.some(keyword => q.includes(keyword));

if (hasYourKeyword) return 'your_new_type';
```

### Step 3: Map to Rules

```typescript
const ruleMap: Record<QueryType, string[]> = {
  'your_new_type': ['shared-rules.md', 'your-new-rules.md'],
  ...
}
```

### Step 4: Create Rule File

Create `/rules/your-new-rules.md` with specific instructions

### Step 5: Add Description

```typescript
const descriptions: Record<QueryType, string> = {
  'your_new_type': 'Description of your query type',
  ...
}
```

---

## Performance Benefits

### Token Reduction
- **Before**: 200-300 tokens for all rules
- **After**: 50-150 tokens depending on query type
- **Savings**: 50-75% fewer tokens per request

### Speed Improvement
- Faster rule merging (fewer files)
- Faster LLM processing (less context)
- Faster inference (simpler decision tree)

### Cost Reduction
- Fewer tokens = lower API costs
- Scales better with more rule files
- More efficient caching

---

## Example Queries & Classifications

```
Query: "@HomePage what colors are used?"
→ Type: mention_ui_design
→ Rules: shared, mention, ui-design
→ Focus: Visual element extraction

Query: "Compare the old and new design"
→ Type: comparison
→ Rules: shared, comparison
→ Focus: Structured comparison format

Query: "@PRD summarize the features"
→ Type: mention_summary
→ Rules: shared, mention, summarization
→ Focus: Hierarchical feature summary

Query: "What's in the PRD?"
→ Type: general
→ Rules: shared, general
→ Focus: General information retrieval
```

---

## Monitoring & Debugging

### Console Logs

The system logs query classification:

```
🎯 Query Type: mention_ui_design - UI/Design question about mentioned document
📚 Loading rules: shared-rules.md, mention-rules.md, ui-design-rules.md
✅ Loaded and merged agent rules: shared-rules.md, mention-rules.md, ui-design-rules.md
```

### Caching

Rules are cached by file combination:
- First request for a type: Reads files
- Subsequent requests: Uses cache
- Cache cleared on `clearRulesCache()`

---

## Future Enhancements

Possible improvements:
- Machine learning-based query classification
- Dynamic rule weighting
- User preference-based rule selection
- A/B testing different rule combinations
- Performance analytics per query type
