#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$ROOT/.api.pid" ]; then
  kill $(cat "$ROOT/.api.pid") 2>/dev/null && echo "✅ API stopped" || echo "API already stopped"
  rm "$ROOT/.api.pid"
fi

if [ -f "$ROOT/.web.pid" ]; then
  kill $(cat "$ROOT/.web.pid") 2>/dev/null && echo "✅ Web stopped" || echo "Web already stopped"
  rm "$ROOT/.web.pid"
fi
