# 🧠 Context-Aware Summarization Rules

These rules define how to summarize any document, PRD, or design artifact while maintaining both *focus* and *contextual awareness* of related materials in the knowledge base.

---

## 🎯 Primary vs Secondary Context

### Primary Context (Focus Document)
- Always treat the **requested document or PRD** as the **core source of truth**.
- All sections, features, and summaries must directly reflect this document’s content.
- Maintain factual and structural fidelity to the primary source (no guessing or rewording).
- Use metadata or identifiers (e.g., `doc_id`, `frame_id`) to anchor the summary to this source.

### Secondary Context (Reference Documents)
- Retrieve **similar or related PRDs/designs** based on:
  - Shared components or features
  - Common product area or flow
  - Matching tags or metadata (e.g., “Payments”, “Bookings”, “Profile”, etc.)
- Use these *only for contextual enrichment* — comparisons, trends, or recommendations.

---

## 🧩 Summarization Flow

1. **Identify the main document (Primary Context).**
2. **Fetch nearby or similar documents (Secondary Context).**
3. **Summarize the primary document in full:**
   - Overview
   - Key objectives and features
   - User flows
   - Success metrics
4. **Cross-reference with secondary documents:**
   - Highlight overlaps or differences in features, flows, or constraints.
   - Identify patterns, improvements, or anomalies.
5. **Conclude with recommendations:**
   - Suggest design or product improvements based on secondary context.
   - Mention if similar work already exists in nearby nodes.

---

## 📋 Output Structure

**1. Overview**
- What this document or PRD covers  
- Goals and key deliverables  

**2. Core Summary**
- Features, user flows, and specs from the **primary** document  

**3. Related Insights (from Secondary Context)**
- [Doc/PRD Name]: Summary of similar sections or contrasts  
- [Doc/PRD Name]: Overlaps or complementary functionality  
- [Doc/PRD Name]: Potential conflicts or duplication  

**4. Recommendations**
- Opportunities for reuse or alignment  
- Areas where the current document diverges from established patterns  
- Suggestions for consistency or consolidation  

---

## ⚙️ Behavior Rules

- Never let secondary references override or distort the primary summary.
- If secondary context is sparse, proceed with primary summary only.
- Use neutral, factual tone; avoid speculative statements.
- Tag the output with:
  - `context_mode: context-aware`
  - `primary_id: [source document id]`
  - `secondary_refs: [list of related ids]`

---

## 🧠 Example Query Behavior

**When user requests:**  
`@doc123 summarize this`

**Agent does:**
1. Summarizes `doc123` fully (Primary Context).  
2. Retrieves and references related PRDs (e.g., `doc118`, `doc121`).  
3. Generates an integrated summary that shows `doc123` in relation to others.  
4. Provides actionable insights drawn from cross-context comparison.  

---