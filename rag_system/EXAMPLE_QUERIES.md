# 🎯 Example Queries for Your Careem Plus RAG System

## 📊 Your Data
- **5 PRDs**: Careem Plus vision, subscriptions, food enhancements, trial results, pricing
- **3 Design files**: Booking flow, verify screens (2 versions)
- **Total**: 378 searchable chunks

---

## 🚀 Quick Test Queries

### Check Your Data is Loaded
```sql
-- Count total chunks
SELECT COUNT(*) FROM prd_knowledge_base;

-- Should return: 378 (or similar)
```

---

## 💼 BUSINESS & STRATEGY QUESTIONS

### Q4 2025 Vision
```sql
SELECT * FROM tidal 
WHERE question = 'What is the Q4 2025 product vision for Careem Plus?';
```

### Key Features
```sql
SELECT * FROM tidal 
WHERE question = 'What are the main features and initiatives for Careem Plus?';
```

### Success Metrics
```sql
SELECT * FROM tidal 
WHERE question = 'What success metrics and KPIs are mentioned for Careem Plus?';
```

### Partnerships
```sql
SELECT * FROM tidal 
WHERE question = 'What partnerships are mentioned for Careem Plus?';
```

---

## 🎫 SUBSCRIPTION & ACQUISITION

### Subscription Methods
```sql
SELECT * FROM tidal 
WHERE question = 'How can users subscribe to Careem Plus across different features?';
```

### Ride Subscription
```sql
SELECT * FROM tidal 
WHERE question = 'How does the "Add subscription on Ride" feature work?';
```

### Trial Results
```sql
SELECT * FROM tidal 
WHERE question = 'What were the results of the food subscription trial?';
```

### Penetration Goals
```sql
SELECT * FROM tidal 
WHERE question = 'What is the current and target penetration rate for Careem Plus?';
```

---

## 🍔 FOOD & EXPERIENCES

### Food Enhancement
```sql
SELECT * FROM tidal 
WHERE question = 'What are the Careem Plus food experience enhancements?';
```

### Auto-Checked Features
```sql
SELECT * FROM tidal 
WHERE question = 'Explain the auto-checked food subscription feature';
```

---

## 💰 PRICING & VALUE

### Pricing Strategy
```sql
SELECT * FROM tidal 
WHERE question = 'What pricing insights and strategies are documented?';
```

### Member Benefits
```sql
SELECT * FROM tidal 
WHERE question = 'What benefits do Careem Plus members receive?';
```

---

## 🎨 UI/UX DESIGN QUESTIONS

### Component List
```sql
SELECT * FROM tidal 
WHERE question = 'List all UI component types mentioned in the design files, such as buttons, labels, icons, etc.';
```

### Verify Screen
```sql
SELECT * FROM tidal 
WHERE question = 'Describe the verify screen design and its components';
```

### Booking Flow
```sql
SELECT * FROM tidal 
WHERE question = 'What screens and components are in the booking creation flow?';
```

### Component Structure
```sql
SELECT * FROM tidal 
WHERE question = 'What is the component hierarchy in the design files? Show me parent-child relationships.';
```

---

## 🔍 ADVANCED CROSS-DOCUMENT QUERIES

### Compare Features
```sql
SELECT * FROM tidal 
WHERE question = 'Compare the subscription features across Ride, Food, and the overall Q4 vision';
```

### Timeline Analysis
```sql
SELECT * FROM tidal 
WHERE question = 'What are the key milestones and dates mentioned across all documents?';
```

### Problem Statements
```sql
SELECT * FROM tidal 
WHERE question = 'What are the main customer problems being addressed?';
```

### Dependencies
```sql
SELECT * FROM tidal 
WHERE question = 'What dependencies or blockers are mentioned across the documents?';
```

---

## 📝 DIRECT KNOWLEDGE BASE SEARCH

For faster, more direct searches (without AI interpretation):

### Search for Specific Terms
```sql
-- Search for "component"
SELECT chunk_content FROM prd_knowledge_base 
WHERE content = 'component' 
LIMIT 5;

-- Search for "subscription"
SELECT chunk_content FROM prd_knowledge_base 
WHERE content = 'subscription' 
LIMIT 5;

-- Search for "Q4"
SELECT chunk_content FROM prd_knowledge_base 
WHERE content = 'Q4 roadmap' 
LIMIT 5;
```

---

## 💡 Tips for Better Results

### ✅ DO:
- **Be specific**: Instead of "tell me about features", ask "What are the Careem Plus features for ride hailing?"
- **Mention context**: "In the Q4 vision document, what are the retention initiatives?"
- **Ask for lists**: "List all the success metrics mentioned"
- **Reference documents**: "According to the food trial results, what was the outcome?"

### ❌ DON'T:
- Ask vague questions like "tell me everything"
- Use very short queries like "features?"
- Expect information not in your documents
- Ask multiple unrelated questions in one query

---

## 🎯 Question Templates

Use these templates and customize them:

```sql
-- Feature inquiry
SELECT * FROM tidal 
WHERE question = 'What are the [FEATURE NAME] features in [DOCUMENT/AREA]?';

-- Technical details
SELECT * FROM tidal 
WHERE question = 'How does [FEATURE] work according to the documents?';

-- Comparison
SELECT * FROM tidal 
WHERE question = 'Compare [THING A] and [THING B] across the documents';

-- Timeline
SELECT * FROM tidal 
WHERE question = 'What is the timeline for [INITIATIVE/FEATURE]?';

-- Metrics
SELECT * FROM tidal 
WHERE question = 'What are the success metrics for [FEATURE/INITIATIVE]?';
```

---

## 🐛 Troubleshooting

### Agent returns "information not available"
- Try rephrasing your question
- Be more specific about what you're looking for
- Try searching the knowledge base directly first

### Query times out
- Simplify your question
- Ask one thing at a time instead of multiple questions
- Try again (sometimes it's just a temporary issue)

### Results don't match expectations
- The agent interprets based on what's in the documents
- Try direct knowledge base search to verify data is there
- Rephrase to be more specific

---

## 🎓 Learn More

Run these Python scripts for testing:
```bash
# Test what's in the knowledge base
python3 test_kb.py

# Test the agent with sample questions  
python3 test_agent.py

# Re-ingest files if needed
python3 ingest_files.py
```

---

**Happy querying! 🚀**

Your NotebookLM-style RAG system is loaded with your Careem Plus documents.
Ask away in the MindsDB UI at http://localhost:47334

