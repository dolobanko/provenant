#!/bin/bash
# Start Provenant dev servers in the background

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting API (port 4000)..."
nohup pnpm --filter api dev > "$ROOT/api.log" 2>&1 &
echo $! > "$ROOT/.api.pid"

echo "Starting Web (port 5173)..."
nohup pnpm --filter web dev > "$ROOT/web.log" 2>&1 &
echo $! > "$ROOT/.web.pid"

echo ""
echo "✅ Both servers running in background"
echo "   Dashboard → http://localhost:5173"
echo "   API       → http://localhost:4000"
echo ""
echo "To stop:  bash stop.sh"
echo "API logs: tail -f $ROOT/api.log"
echo "Web logs: tail -f $ROOT/web.log"
