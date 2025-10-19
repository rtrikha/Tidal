# 🌊 Tidal - Your Careem Plus Knowledge Assistant

A simple RAG (Retrieval Augmented Generation) system for querying your PRDs and design documents using MindsDB and GPT-4o.

## 🚀 Quick Start

### 1. Start the UI
```bash
cd /Users/raunak.trikha/Documents/Tidal/rag_system
./start_ui.sh
```

This opens: **http://localhost:8080/tidal_ui.html**

### 2. Ask Questions!
- Click a suggestion chip
- Or type your own question
- Press Enter

### 3. Stop the UI
```bash
./stop_ui.sh
```

---

## 📂 Project Structure

```
rag_system/
├── tidal_ui.html          # Beautiful chat interface
├── app.py                 # Flask server (handles API calls)
├── ingest_files.py        # Load documents into knowledge base
├── start_ui.sh            # Start the UI (one command)
├── stop_ui.sh             # Stop the server
├── data/
│   ├── prds/              # Your PRD documents (.txt, .md)
│   └── designs/           # Your JSON design files (.json)
├── EXAMPLE_QUERIES.md     # Sample questions to ask
└── README.md              # This file
```

---

## 📊 Your Current Data

**8 Documents Loaded:**
- 5 PRD files (Careem Plus features, subscriptions, etc.)
- 3 JSON design files (booking flow, verify screens)

**Total:** 378 searchable chunks

---

## 🔄 Adding New Documents

### Step 1: Add Files
```bash
# Copy your files to the appropriate folder
cp your_prd.txt data/prds/
cp your_design.json data/designs/
```

### Step 2: Ingest Them
```bash
python3 ingest_files.py
```

That's it! Your new documents are now searchable.

---

## 💡 What You Can Ask

### About Your PRDs:
- "What are the Careem Plus features?"
- "Summarize the Q4 2025 vision"
- "What are the success metrics mentioned?"
- "How does subscription on Ride work?"

### About Your Designs:
- "List all UI components in the design files"
- "What components are in the verify screen?"
- "Describe the booking flow structure"

### General + Your Data:
- "How does our authentication compare to industry standards?"
- "What security improvements would you suggest?"
- "Explain the OAuth flow in our design"

**Tidal has both general AI knowledge AND your specific documents!**

---

## 🛠️ How It Works

```
Your Question
    ↓
Flask Server (localhost:8080)
    ↓
MindsDB + Knowledge Base (your docs)
    ↓
GPT-4o (generates answer)
    ↓
Beautiful UI shows response
```

### Components:
- **MindsDB**: Running in Docker on port 47334
- **Knowledge Base**: Vector embeddings of your documents
- **Agent**: GPT-4o powered ("tidal")
- **UI**: Custom Flask app with chat interface

---

## 🔧 Troubleshooting

### UI won't start
```bash
# Check if MindsDB is running
docker ps | grep mindsdb

# Start it if needed
docker start tidal_mindsdb

# Restart UI
./stop_ui.sh
./start_ui.sh
```

### Add more documents not working
```bash
# Make sure files are in correct folders
ls data/prds/
ls data/designs/

# Re-run ingestion
python3 ingest_files.py
```

### Check what's loaded
Open MindsDB UI: http://localhost:47334
```sql
SELECT COUNT(*) FROM prd_knowledge_base;
```

---

## 📋 System Requirements

- **Docker**: Running MindsDB container
- **Python 3**: For Flask server and scripts
- **Flask**: `pip install flask flask-cors requests`
- **OpenAI API Key**: Already configured

---

## 🎯 Key Files Explained

### For Daily Use:
- **`start_ui.sh`** - Start everything (one command!)
- **`tidal_ui.html`** - The beautiful chat interface
- **`ingest_files.py`** - Add new documents

### Configuration:
- **`app.py`** - Flask server (rarely need to touch)
- **`env.example`** - API key template (if you need to change keys)

### Your Data:
- **`data/prds/`** - Put your PRD files here
- **`data/designs/`** - Put your JSON designs here

---

## 💰 Costs

Using OpenAI GPT-4o:
- ~$0.03 per query
- ~$90/month for 100 queries/day

To reduce costs, you could switch to GPT-3.5-turbo (90% cheaper, slightly less capable).

---

## 🎨 Customization

### Change UI Colors
Edit the gradient in `tidal_ui.html`:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Add More Suggestions
In `tidal_ui.html`, add more chips:
```html
<div class="suggestion-chip" onclick="askQuestion(this.textContent)">
    Your custom question
</div>
```

### Use Different AI Model
The agent is configured in MindsDB with GPT-4o. You can change it by recreating the agent with a different model.

---

## 📚 More Examples

See **`EXAMPLE_QUERIES.md`** for 30+ example questions you can ask!

---

## 🆘 Need Help?

1. **Check MindsDB is running:** `docker ps | grep mindsdb`
2. **Check server is running:** `lsof -i :8080`
3. **View logs:** `docker logs tidal_mindsdb`
4. **Restart everything:**
   ```bash
   ./stop_ui.sh
   docker restart tidal_mindsdb
   sleep 5
   ./start_ui.sh
   ```

---

## 🎉 That's It!

**To use your RAG system:**
1. Run `./start_ui.sh`
2. Ask questions at http://localhost:8080/tidal_ui.html
3. To add docs: Copy to `data/` folders, run `python3 ingest_files.py`

**Simple, powerful, and ready to use!** 🚀

---

Built with [MindsDB](https://mindsdb.com) + [OpenAI GPT-4o](https://openai.com) + ❤️
