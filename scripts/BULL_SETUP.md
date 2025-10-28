# Bull + Redis Ingestion Setup

This guide explains how to use the new Bull queue-based ingestion system for Tidal RAG.

## 🚀 Quick Start

### Prerequisites

1. **Redis running locally** (or accessible via network):
   ```bash
   # macOS with Homebrew
   brew install redis
   brew services start redis
   
   # Or with Docker
   docker run -d -p 6379:6379 redis:latest
   ```

2. **Environment configured** (see `/rag_system/.env`)

### Basic Workflow

**Terminal 1 - Start the worker:**
```bash
cd scripts
npm install  # Only needed first time
npm run worker
```

You should see:
```
============================================================
🔄 Tidal Ingestion Worker Started
============================================================

🎯 Worker ready - waiting for jobs...
```

**Terminal 2 - Queue ingestion jobs:**
```bash
cd scripts
npm run ingest
```

You should see:
```
============================================================
📋 Tidal RAG - Queueing Ingestion Jobs
============================================================

🔍 Scanning Supabase Storage...
  🔍 Scanning: prds
  📄 File: file1.txt
  📄 File: file2.txt
  ...

✅ Found 615 files (375 PRDs, 240 designs)

📤 Queuing jobs...
  ✅ Queued: file1.txt
  ✅ Queued: file2.txt
  ...

============================================================
📊 Queue Status
============================================================
✅ Queued: 615/615 files

🎯 Make sure worker is running: npm run worker
🔄 Jobs will be processed with automatic retry on failure
```

The worker terminal will then show progress:
```
📝 [Job 1] Processing 1/615: prds/Aurora_team_processes/file1.txt
   ⏳ Progress: 25%
   ✅ ingested - 45 chunks
✨ Job 1 completed

📝 [Job 2] Processing 2/615: prds/Aurora_team_processes/file2.txt
   ⏳ Progress: 50%
   ✅ ingested - 38 chunks
✨ Job 2 completed
```

## 🏗️ Architecture

### Components

1. **ingest-with-bull.ts** - Producer
   - Scans Supabase Storage for files
   - Queues jobs in Bull with metadata
   - Sets up retry policy (3 attempts, exponential backoff)
   - Exits after queuing (doesn't process)

2. **ingest-worker.ts** - Consumer
   - Listens for jobs from Bull queue
   - Processes files with concurrency control (2 at a time)
   - Handles errors with automatic retry
   - Tracks progress

3. **queue-config.ts** - Queue Setup
   - Creates Bull queue with Redis connection
   - Sets up event listeners
   - Handles connection errors

### Benefits

✅ **Reliability** - Jobs persist in Redis, survive restarts  
✅ **Progress Tracking** - See real-time ingestion progress  
✅ **Error Handling** - Automatic retry with exponential backoff  
✅ **Concurrency Control** - Rate limit OpenAI API calls  
✅ **Visibility** - Job logs with status for each file  
✅ **Flexibility** - Scale to multiple workers later

## 🔧 Configuration

### Redis Connection

Environment variables (in `/rag_system/.env`):
```env
REDIS_HOST=localhost         # Default: localhost
REDIS_PORT=6379             # Default: 6379
REDIS_PASSWORD=             # Optional
```

### Queue Settings

Modify in `ingest-with-bull.ts`:
```typescript
await queue.add(
  { /* job data */ },
  {
    attempts: 3,            // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 2000           // Start with 2s, exponential increase
    },
    removeOnComplete: false, // Keep completed jobs for inspection
    removeOnFail: false      // Keep failed jobs for debugging
  }
);
```

### Worker Concurrency

Modify in `ingest-worker.ts`:
```typescript
queue.process(2, async (job) => {  // 2 concurrent jobs
  // ... process job
});
```

## 📊 Monitoring

### View Queue Status

```bash
# In another terminal, connect to Redis CLI
redis-cli

# View queued jobs
> LLEN bull:tidal-ingestion:wait

# View active jobs
> LLEN bull:tidal-ingestion:active

# View completed jobs
> LLEN bull:tidal-ingestion:completed

# View failed jobs
> LLEN bull:tidal-ingestion:failed
```

### Job Logs

All job processing is logged to console. Logs include:
- Job ID and index
- File being processed
- Success/failure status
- Number of chunks created
- Progress percentage

## 🔄 Common Workflows

### Reset Database and Re-ingest

```bash
# 1. Reset database
cd scripts
npx tsx reset-and-reingest.ts

# 2. Start worker
npm run worker

# 3. Queue ingestion (in new terminal)
npm run ingest
```

### Add New Documents

```bash
# 1. Upload files to Supabase Storage (tidal-docs bucket)
# 2. Queue new ingestion
cd scripts
npm run ingest

# Worker will automatically pick up new files
# (Worker must already be running)
```

### Fix Vector Dimension Mismatch

If you see errors like `different vector dimensions 3072 and 1536`:

1. Reset database: `npx tsx reset-and-reingest.ts`
2. Restart worker: `npm run worker`
3. Queue ingestion: `npm run ingest`
4. Worker will re-embed all files with consistent 1536 dims

### Stop Gracefully

Press `Ctrl+C` in worker terminal:
- Currently processing jobs complete
- Unfinished jobs return to queue
- Next worker pickup continues processing

## 🐛 Troubleshooting

### Worker Won't Connect to Redis
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Start Redis first
```bash
brew services start redis
# or
docker run -d -p 6379:6379 redis:latest
```

### Jobs Stuck in "Active"
```
⚠️  Job xxx stalled
```
**Solution:** Worker crashed without cleanup. Either:
- Wait for stall timeout (default 30s)
- Restart worker: `npm run worker`

### High Memory Usage
**Solution:** Worker processes 2 files at a time. Reduce concurrency in `ingest-worker.ts`:
```typescript
queue.process(1, async (job) => {  // Process 1 at a time
```

### Rate Limited by OpenAI
**Solution:** Reduce worker concurrency and increase delays:
```typescript
queue.process(1, async (job) => {  // Reduce to 1
  // ...
});

// In ingest-worker.ts, increase delay:
if (i + BATCH_SIZE < texts.length) {
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2s instead of 1s
}
```

## 📈 Advanced Usage

### Use Docker for Worker

Create `Dockerfile.worker`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY scripts/ .
RUN npm install
CMD ["npm", "run", "worker"]
```

Build and run:
```bash
docker build -f Dockerfile.worker -t tidal-worker .
docker run -d \
  --network host \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  --env-file rag_system/.env \
  tidal-worker
```

### Multiple Workers (Distributed)

Each worker connects to same Redis and processes jobs:
```bash
# Terminal 1
npm run worker

# Terminal 2
npm run worker

# Terminal 3
npm run ingest
```

Both workers will process jobs concurrently, doubling throughput.

## 📚 Files Overview

```
scripts/
├── ingest-with-bull.ts      # Main entry point - queues jobs
├── ingest-worker.ts         # Worker - processes jobs
├── queue-config.ts          # Redis + Bull configuration
├── retry-utils.ts           # Retry logic (unchanged)
├── reset-and-reingest.ts    # Reset database (unchanged)
├── package.json             # Added bull, redis dependencies
└── BULL_SETUP.md            # This file
```

## ✅ Migration from Old Ingest

The old `ingest.ts` is now replaced by two files:

| Old | New |
|-----|-----|
| `ingest.ts` (sequential) | `ingest-with-bull.ts` (producer) + `ingest-worker.ts` (worker) |
| No retry logic | Built-in 3-attempt retry with exponential backoff |
| No progress tracking | Real-time progress monitoring |
| Crashes lose progress | Jobs persist in Redis, resume on restart |

The old `ingest.ts` is still available for reference but recommended to use the new Bull system.
