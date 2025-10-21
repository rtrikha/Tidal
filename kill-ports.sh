#!/bin/bash
# Kill all dev servers and free up ports

echo "🔪 Killing all Next.js dev servers..."
echo "======================================"
echo ""

# Kill all Next.js processes
pkill -9 -f "next dev" 2>/dev/null && echo "✅ Killed Next.js processes" || echo "⏭️  No Next.js processes found"

# Kill all npm dev processes
pkill -9 -f "npm run dev" 2>/dev/null && echo "✅ Killed npm dev processes" || echo "⏭️  No npm dev processes found"

# Kill specific port 3001
if lsof -ti:3001 >/dev/null 2>&1; then
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo "✅ Freed port 3001"
else
    echo "⏭️  Port 3001 already free"
fi

# Kill specific port 3000 (just in case)
if lsof -ti:3000 >/dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "✅ Freed port 3000"
else
    echo "⏭️  Port 3000 already free"
fi

echo ""
echo "✅ All dev servers killed!"
echo ""
echo "🚀 To start fresh:"
echo "   npm run dev"

