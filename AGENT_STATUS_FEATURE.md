# Agent Status Visibility Feature

## Overview
Added real-time visibility into what the AI agent is doing behind the scenes when processing user questions.

## What Was Implemented

### 1. **Backend - Streaming Status Updates** (`tidal_ui/app/api/ask/route.ts`)

The API route now uses **Server-Sent Events (SSE)** to stream real-time status updates to the frontend as the agent works:

#### Status Types:
- 🚀 **start**: Agent has started processing
- 🔄 **iteration**: Agent is thinking (shows current step X/5)
- 🔧 **tool**: Agent is calling a tool (search, list, or retrieve documents)
- ✓ **tool_result**: Tool execution completed with results
- ✨ **complete**: Agent is generating the final answer
- ❌ **error**: An error occurred
- 📝 **answer**: Final answer is ready

#### Example Status Messages:
```
🚀 Agent started processing your question...
🔄 Thinking... (step 1/5)
🔧 Searching documents for: "Careem Plus Q4 vision"...
✓ Found 5 relevant chunks
🔄 Thinking... (step 2/5)
🔧 Retrieving content from: "Careem Plus Q4 2025"...
✓ Retrieved document content
✨ Generating final answer...
```

### 2. **Frontend - Real-Time Status Display** (`tidal_ui/components/chat-interface.tsx`)

Added two ways to see the agent's activity:

#### A. **Live Status (while agent is working)**
While the agent processes a question, users see:
- A spinning loader with "Agent is working..."
- Last 5 status updates showing what the agent is currently doing
- Status messages update in real-time as they arrive from the backend

#### B. **Historical Workflow (after completion)**
Once the agent completes a response, users can:
- Click "Show agent workflow (N steps)" to expand a detailed view
- See all the steps the agent took to answer the question
- Includes tool calls, search results, and reasoning steps
- Click "Hide agent workflow" to collapse it

### 3. **Visual Design**

The status display is **subtle but informative**:
- Uses emoji icons for quick visual scanning
- Small, muted text that doesn't overwhelm the UI
- Collapsible workflow section to keep the chat clean
- Shows count of results when applicable (e.g., "Found 5 chunks")

## How to Test

1. Start the development server:
   ```bash
   cd tidal_ui
   npm run dev
   ```

2. Ask a question like:
   - "What files are in your knowledge base?"
   - "Summarize the Careem Plus Q4 vision"
   - "Explain the pricing insights"

3. Watch the real-time status updates appear as the agent works

4. After the response, click "Show agent workflow" to see the full history

## Benefits

✅ **Transparency**: Users know exactly what the agent is doing
✅ **Trust**: Seeing the agent search and retrieve documents builds confidence
✅ **Debugging**: Helps identify when searches aren't finding relevant content
✅ **Education**: Users learn how the agent works
✅ **Patience**: Users are more patient when they see progress

## Technical Details

- **Streaming Protocol**: Server-Sent Events (SSE) with `text/event-stream`
- **Data Format**: Each status is a JSON object with type, message, data, and timestamp
- **Non-blocking**: Status updates stream without blocking the main response
- **Type-safe**: Full TypeScript support with proper interfaces
- **Error Handling**: Gracefully handles parsing errors and connection issues

## Token Management

To prevent "429 Request too large" errors, the system implements smart truncation:

**Search Results**:
- Limited to maximum 5 chunks per search
- Each chunk truncated to 1000 characters if longer
- Prevents context overflow while maintaining relevance

**Document Content Retrieval**:
- Limited to first 10 chunks per document
- Total content capped at ~4000 characters (~1000 tokens)
- Clearly marked when content is truncated

**Why This Matters**:
- OpenAI has a 30,000 tokens per minute (TPM) limit
- Documents can be very large (271K+ tokens)
- Agent needs to balance context with API limits
- Truncation preserves the most relevant information

## Troubleshooting

### Error: "429 Request too large"
**Fixed!** The system now automatically truncates content to stay within token limits.

### Error: "No answer received from agent"
- Check browser console for streaming errors
- Check backend logs for API errors
- Ensure dev server is running without errors

## Future Enhancements

Possible improvements:
- Add timing information (how long each step took)
- Show token usage and cost estimates in UI
- Allow users to toggle status visibility in settings
- Add more detailed tool parameters in the workflow view
- Color-code different status types
- Implement sliding window context management for very long documents

