# Tidal - Complete Architecture

NotebookLM-style RAG system for Careem Plus documentation.

## 📁 Project Structure

```
Tidal/
├── rag_system/               # Backend - RAG & Data Management
│   ├── data/
│   │   ├── prds/            # Product requirement documents
│   │   └── designs/         # JSON design specifications
│   ├── ingest_files_smart.py    # Smart file ingestion (tracks changes)
│   ├── reset_and_reingest.py    # Wipe & re-ingest utility
│   ├── README.md                # Backend documentation
│   └── .ingested_files.json     # Tracks ingested files (auto-generated)
│
└── tidal_ui/                 # Frontend - Next.js UI
    ├── app/
    │   ├── api/ask/         # API route to MindsDB
    │   ├── layout.tsx       # Root layout
    │   └── page.tsx         # Home page
    ├── components/
    │   ├── ui/              # shadcn/ui components
    │   └── chat-interface.tsx   # Main chat interface
    ├── lib/
    │   └── utils.ts         # Utilities
    └── README.md            # Frontend documentation
```

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Next.js 15 (tidal_ui/)                                   │ │
│  │  • React 19 + TypeScript                                  │ │
│  │  • shadcn/ui components                                   │ │
│  │  • Tailwind CSS v4                                        │ │
│  │  • http://localhost:3000                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
                    POST /api/ask {question}
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER (Next.js)                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  /app/api/ask/route.ts                                    │ │
│  │  • Receives user questions                                │ │
│  │  • Forwards to MindsDB                                    │ │
│  │  • Returns formatted answers                              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL over HTTP
          SELECT answer FROM tidal WHERE question = '...'
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MINDSDB (Docker Container)                    │
│                   http://localhost:47334                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Agent: "tidal"                                           │ │
│  │  • Model: GPT-4o                                          │ │
│  │  • Provider: OpenAI                                       │ │
│  │  • Custom prompt for Careem Plus docs                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Knowledge Base: "prd_knowledge_base"                     │ │
│  │  • 378 text chunks                                        │ │
│  │  • 5 PRD files (38 chunks)                                │ │
│  │  • 3 JSON design files (340 chunks)                       │ │
│  │  • Embedding: text-embedding-3-large                      │ │
│  │  • Vector DB: ChromaDB                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    OpenAI API Calls
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          OPENAI API                             │
│  • Embeddings: text-embedding-3-large (3072 dimensions)        │
│  • Answer Generation: GPT-4o                                   │
│  • Re-ranking: GPT-4o                                          │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### Ingestion Flow (rag_system/ingest_files_smart.py)

```
1. Read files from data/prds/ and data/designs/
2. Calculate MD5 hash for each file
3. Check .ingested_files.json:
   • If file unchanged → Skip
   • If file new/changed → Ingest
4. MindsDB chunks text (~500-1000 chars per chunk)
5. OpenAI converts each chunk to vector (3072 dimensions)
6. Store in ChromaDB (vectors + text)
7. Update .ingested_files.json with new hash
```

### Query Flow (User asks question)

```
1. User types question in tidal_ui
2. POST /api/ask → Next.js API route
3. API route → MindsDB SQL query
4. MindsDB "tidal" agent:
   a. Question → OpenAI → question_vector
   b. Search ChromaDB for similar vectors (cosine similarity)
   c. Retrieve top N matching text chunks
   d. Send chunks + question → GPT-4o
   e. GPT-4o generates answer
5. Answer → Next.js API route
6. API route → User interface
7. Display formatted answer with timestamp
```

## 🗄️ Data Storage

### Docker Volume
```
/var/lib/docker/volumes/tidal_tidal_mindsdb_data/_data/
├── mindsdb.sqlite3.db (180 KB)           # Configuration
│   ├── Agent config (model, prompt, API key)
│   ├── Knowledge base metadata
│   └── Tracking data
│
└── content/integration/.../prd_knowledge_base_chromadb/
    ├── chroma.sqlite3 (23 MB)            # ChromaDB metadata
    └── <collection_uuid>/
        ├── data_level0.bin (12 MB)       # Vector embeddings
        ├── link_lists.bin                # HNSW graph index
        ├── header.bin                    # Index metadata
        └── length.bin                    # Dimension info
```

### Local Tracking
```
rag_system/.ingested_files.json
{
  "data/prds/file1.txt": "abc123hash",
  "data/designs/design1.json": "def456hash"
}
```

## 🚀 Tech Stack

### Frontend (tidal_ui/)
- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 19
- **Language:** TypeScript
- **Components:** shadcn/ui (Radix UI primitives)
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Port:** 3000

### Backend (rag_system/)
- **RAG Platform:** MindsDB
- **Container:** Docker
- **Vector DB:** ChromaDB
- **Embeddings:** OpenAI text-embedding-3-large
- **LLM:** OpenAI GPT-4o
- **Language:** Python 3
- **Port:** 47334

### Infrastructure
- **Docker:** tidal_mindsdb container
- **Volume:** tidal_tidal_mindsdb_data
- **Network:** Bridge (localhost access)

## 📊 Data Statistics

### Current Knowledge Base
- **Total Chunks:** 378
- **PRD Files:** 5 files → 38 chunks (avg 7.6 chunks/file)
- **Design Files:** 3 files → 340 chunks (avg 113 chunks/file)
- **Vector Size:** 3072 dimensions per chunk
- **Total Storage:** ~46 MB (23 MB ChromaDB + metadata)

### Chunk Distribution
| File | Type | Chunks |
|------|------|--------|
| Auto-Checked Food Trial Results | PRD | 2 |
| Careem Plus Q4 Vision | PRD | 7 |
| Add Subscription on Ride | PRD | 9 |
| Experiences Enhancement Food | PRD | 17 |
| Pricing Insights | PRD | 3 |
| Creating a Booking Flow | JSON | 39 |
| Verify Screen v1 | JSON | 150 |
| Verify Screen v2 | JSON | 151 |

## 🔧 Key Features

### Smart Ingestion
- ✅ MD5 hash tracking (no re-ingestion of unchanged files)
- ✅ Chunk counting per file
- ✅ Total chunk tracking
- ✅ Skip unchanged files
- ✅ Force re-ingest option

### RAG Capabilities
- ✅ Semantic search (vector similarity)
- ✅ Context-aware answers
- ✅ Multi-document queries
- ✅ JSON structure understanding
- ✅ Source citation

### UI Features
- ✅ Real-time chat interface
- ✅ Message history
- ✅ Loading states
- ✅ Error handling
- ✅ Example questions
- ✅ Responsive design
- ✅ Type-safe (TypeScript)

## 🎯 Usage

### Start the System
```bash
# 1. Ensure MindsDB Docker is running
docker ps | grep tidal_mindsdb

# 2. Start the UI
cd tidal_ui
npm run dev
# → http://localhost:3000

# 3. Ingest data (if needed)
cd rag_system
python3 ingest_files_smart.py
```

### Reset Data
```bash
cd rag_system
python3 reset_and_reingest.py
python3 ingest_files_smart.py
```

### Stop the System
```bash
# Stop UI
# Ctrl+C in the terminal running npm run dev

# Stop MindsDB (optional)
docker stop tidal_mindsdb
```

## 🌐 Deployment Options

### Frontend (tidal_ui)
- **Vercel:** `vercel deploy` (recommended for Next.js)
- **Netlify:** `netlify deploy`
- **AWS Amplify**
- **Cloudflare Pages**

### Backend (rag_system)
- **AWS EC2:** Docker container
- **Google Cloud Run:** Containerized MindsDB
- **Azure Container Instances**
- **DigitalOcean Droplet**

### Full Stack
- **AWS:** EC2 (Docker) + S3 (data) + CloudFront (CDN)
- **Google Cloud:** Cloud Run + Cloud Storage
- **Kubernetes:** For enterprise scale

## 📈 Scalability

### Current Limits
- **Files:** Unlimited (hash-tracked)
- **Chunks:** ~10K-20K recommended per KB
- **Concurrent Users:** Depends on MindsDB instance
- **API Calls:** Rate-limited by OpenAI tier

### To Scale
1. **Vertical:** Increase Docker resources (CPU/RAM)
2. **Horizontal:** Multiple MindsDB instances + load balancer
3. **Caching:** Add Redis for frequent queries
4. **CDN:** Serve UI from edge locations
5. **Database:** Separate PostgreSQL for metadata

## 🔐 Security

### Current Setup (Development)
- ⚠️ API key in environment variables
- ⚠️ No authentication on UI
- ⚠️ Local-only access

### For Production
- ✅ Use environment secrets (Vercel, AWS Secrets Manager)
- ✅ Add authentication (NextAuth.js, Auth0, Clerk)
- ✅ Rate limiting (Upstash, Redis)
- ✅ HTTPS only
- ✅ API key rotation
- ✅ CORS policies
- ✅ Input sanitization

## 📝 API Reference

### POST /api/ask
Send a question to the Tidal agent.

**Request:**
```typescript
{
  question: string;
}
```

**Response (Success):**
```typescript
{
  answer: string;
}
```

**Response (Error):**
```typescript
{
  error: string;
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the Q4 vision?"}'
```

## 🛠️ Maintenance

### Regular Tasks
- **Weekly:** Review ingestion logs
- **Monthly:** Check chunk count growth
- **Quarterly:** Update dependencies
- **As needed:** Re-ingest on large data changes

### Monitoring
- Watch Docker logs: `docker logs -f tidal_mindsdb`
- Check chunk count: `SELECT COUNT(*) FROM prd_knowledge_base;`
- Monitor API costs: OpenAI dashboard
- Track UI analytics: Vercel/Analytics

## 📚 Resources

- [MindsDB Docs](https://docs.mindsdb.com)
- [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [OpenAI API](https://platform.openai.com/docs)
- [ChromaDB](https://www.trychroma.com)

