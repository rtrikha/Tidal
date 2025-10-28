# Bull + Redis Ingestion Architecture

## System Architecture Diagram

### Before: Synchronous Sequential Processing
```
┌─────────────────────────────────────┐
│     ingest.ts (blocking)            │
├─────────────────────────────────────┤
│ File 1 → Chunk → Embed → Store      │
│ File 2 → Chunk → Embed → Store      │
│ File 3 → Chunk → Embed → Store      │
│ ...                                 │
│ File N → Chunk → Embed → Store      │
└─────────────────────────────────────┘

❌ Problems:
  • Single process - crashes lose all progress
  • No retry logic - failures stop entire process
  • No parallelization
  • No progress visibility
```

### After: Async Queue-Based Processing with Bull
```
┌──────────────────────────────────────────────────────────────────┐
│                        ingest-with-bull.ts                       │
│                    (Producer - Queues Jobs)                      │
├──────────────────────────────────────────────────────────────────┤
│  1. Scan Supabase Storage                                        │
│  2. Create job for each file                                     │
│  3. Add to Bull queue                                            │
│  4. Exit (queue persists)                                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   Redis Queue   │
                    │ (Job Storage)   │
                    │                 │
                    │ Wait: [...]     │
                    │ Active: [1,2]   │
                    │ Complete: [1]   │
                    │ Failed: []      │
                    └─────────────────┘
                       ↑         ↓
        ┌───────────────┴─────────┴──────────────┐
        │                                         │
   ┌────────────────────┐             ┌─────────────────────┐
   │ ingest-worker.ts   │             │ ingest-worker.ts    │
   │    (Consumer 1)    │             │    (Consumer 2)     │
   ├────────────────────┤             ├─────────────────────┤
   │ Process File 1     │             │ Process File 2      │
   │ + Retry logic      │             │ + Retry logic       │
   │ + Error handling   │             │ + Error handling    │
   │ + Progress track   │             │ + Progress track    │
   └────────────────────┘             └─────────────────────┘

✅ Benefits:
  • Persistent queue - survives crashes
  • Auto-retry - 3 attempts with exponential backoff
  • Concurrent processing - 2+ workers possible
  • Real-time progress tracking
  • Error recovery
  • Scalable architecture
```

## Data Flow

### 1. Job Queuing Phase
```typescript
// ingest-with-bull.ts (Producer)
const queue = createIngestionQueue();

for each file in storage:
  queue.add({
    storagePath: "designs/Aurora_team/file.json",
    type: "design",
    jobIndex: 1,
    totalJobs: 615
  }, {
    attempts: 3,                    // Retry up to 3 times
    backoff: { type: 'exponential', delay: 2000 }
  });
// Jobs now persisted in Redis
```

### 2. Job Processing Phase
```typescript
// ingest-worker.ts (Consumer)
queue.process(2, async (job) => {
  // Max 2 jobs concurrent
  
  // Job 1: Download file
  // Job 2: Download file (parallel)
  
  // Job 1: Chunk text
  // Job 2: Chunk text (parallel)
  
  // Job 1: Create embeddings
  // Job 2: Create embeddings (serial - respects OpenAI rate limit)
  
  // Both: Store in Supabase
  
  return result;
});

// On error: Automatic retry (exponential backoff)
// On success: Job marked complete in Redis
// On stall: Job returned to queue after timeout
```

### 3. Job Tracking in Redis
```
Redis Keys Created:
├── bull:tidal-ingestion:wait        # Jobs waiting to process
├── bull:tidal-ingestion:active      # Jobs currently processing
├── bull:tidal-ingestion:complete    # Jobs successfully completed
├── bull:tidal-ingestion:failed      # Jobs that failed all retries
└── bull:tidal-ingestion:job:*       # Individual job data

Monitor with:
$ redis-cli
> LLEN bull:tidal-ingestion:wait      # 500 jobs waiting
> LLEN bull:tidal-ingestion:active    # 2 jobs running
> LLEN bull:tidal-ingestion:complete  # 113 jobs done
> LLEN bull:tidal-ingestion:failed    # 0 jobs failed
```

## Concurrency Model

### Current Setup (2 Concurrent Workers)
```
Time  Worker 1          Worker 2
──────────────────────────────────
0s    [File 1 start]    [File 2 start]
10s   [File 1 chunk]    [File 2 chunk]
20s   [File 1 embed]    [File 2 embed]
30s   [File 1 store]    [File 2 store]
40s   [File 1 done]     [File 2 done]
       ↓
      [File 3 start]    [File 4 start]
50s   [File 3 chunk]    [File 4 chunk]
60s   ...
```

**Why 2 concurrent?**
- OpenAI rate limits ~3500 RPM for embeddings
- 2 concurrent files = ~200-300 requests/min (safe margin)
- Adjust `queue.process(2, ...)` to tune concurrency

### Scale to Multiple Workers
```bash
# Terminal 1: Worker 1
npm run worker

# Terminal 2: Worker 2
npm run worker

# Terminal 3: Producer (queues all jobs)
npm run ingest

# All workers connect to same Redis queue
# Jobs distribute automatically
```

## Error Handling & Retry Strategy

### Retry Flow
```
Job starts
  ↓
Try 1: Process file
  ├─ Success → Mark complete ✅
  └─ Failure → Error event
        ↓
Try 2: Retry with 2s backoff
  ├─ Success → Mark complete ✅
  └─ Failure → Error event
        ↓
Try 3: Retry with 4s backoff (2^2)
  ├─ Success → Mark complete ✅
  └─ Failure → Mark failed ❌
        ↓
Job moved to "failed" list
(Can be inspected/requeued manually)
```

### Automatic Retry Config
```typescript
// In ingest-with-bull.ts
await queue.add(jobData, {
  attempts: 3,                           // Max 3 attempts
  backoff: {
    type: 'exponential',
    delay: 2000                          // Start with 2s
  },
  // Backoff delays: 2s, 4s, 8s...
  
  removeOnComplete: false,               // Keep for inspection
  removeOnFail: false                    // Keep for debugging
});
```

## Performance Metrics

### Processing Speed

**Sequential (Old):**
- 1 file at a time
- ~40s per file (download + chunk + embed + store)
- 615 files × 40s = ~27,600s = **7.6 hours**

**Concurrent (New with 2 workers):**
- 2 files at a time
- Same 40s per file but parallel
- 615 files ÷ 2 workers × 40s = **13,800s ≈ 3.8 hours**
- **~2x faster** ⚡

**With 3 workers:**
- ~2.5 hours ⚡⚡

## Monitoring & Debugging

### Real-time Progress
```bash
# Terminal 3: Monitor
redis-cli

# Watch active jobs
> WATCH bull:tidal-ingestion:active
> LRANGE bull:tidal-ingestion:active 0 10

# Check completed count
> DBSIZE  # Total keys
> LLEN bull:tidal-ingestion:complete

# Inspect failed job
> GET bull:tidal-ingestion:failed:1
```

### Console Logs
```
Worker output shows:
┌─────────────────────────────────────────────────────────┐
│ 📝 [Job 1] Processing 1/615: designs/file.json         │
│    ⏳ Progress: 25%                                     │
│    ✅ ingested - 45 chunks                              │
│ ✨ Job 1 completed                                      │
│                                                         │
│ 📝 [Job 2] Processing 2/615: prds/file.txt             │
│    ⏳ Progress: 50%                                     │
│    ✅ ingested - 38 chunks                              │
│ ✨ Job 2 completed                                      │
└─────────────────────────────────────────────────────────┘
```

## Migration from Old System

### Old Way
```bash
cd scripts
npx tsx ingest.ts
# Single process, sequential, no retry
```

### New Way
```bash
# Terminal 1: Start worker
cd scripts
npm run worker

# Terminal 2: Queue jobs
cd scripts
npm run ingest
# Jobs queued in Redis, worker processes automatically
```

### Backwards Compatibility
Old `ingest.ts` still works but not recommended. Use Bull system for:
- Better error handling
- Progress visibility
- Scalability
- Reliability

## Configuration Tuning

### For Fast Networks (High Throughput)
```typescript
// ingest-worker.ts: Increase concurrency
queue.process(4, async (job) => { ... });  // 4 concurrent

// ingest-with-bull.ts: Reduce backoff
backoff: { type: 'exponential', delay: 500 }  // Faster retries
```

### For Slow Networks (Reliability First)
```typescript
// ingest-worker.ts: Reduce concurrency
queue.process(1, async (job) => { ... });  // 1 at a time

// ingest-with-bull.ts: Increase backoff
backoff: { type: 'exponential', delay: 5000 }  // Longer waits
```

### For OpenAI Rate Limits
```typescript
// ingest-worker.ts: Reduce concurrent jobs
queue.process(1, async (job) => { ... });

// ingest-worker.ts: Increase embedding delay
if (i + BATCH_SIZE < texts.length) {
  await new Promise(resolve => 
    setTimeout(resolve, 2000)  // 2s between batches
  );
}
```

## Deployment

### Development (Local)
```bash
brew install redis && brew services start redis
cd scripts && npm install
npm run worker    # Terminal 1
npm run ingest    # Terminal 2
```

### Production (Docker)
```bash
docker-compose up -d  # Redis + Workers
docker exec tidal npm run ingest  # Queue jobs
```

See `BULL_SETUP.md` for full Docker setup.
