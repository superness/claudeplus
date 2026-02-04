#!/bin/bash

# Start Maestro Debug Studio
# A dedicated debugging interface for Multi-Drive Maestro orchestration

PORT=3008
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Maestro Debug Studio..."
echo "==========================================="

# Check if proxy is running
if ! nc -z localhost 8081 2>/dev/null; then
    echo "WARNING: Proxy server not detected on port 8081"
    echo "The debug studio requires the proxy to be running."
    echo "Start it with: cd proxy && node server.js"
    echo ""
fi

# Check if port is already in use
if nc -z localhost $PORT 2>/dev/null; then
    echo "Port $PORT is already in use. Killing existing process..."
    fuser -k $PORT/tcp 2>/dev/null || true
    sleep 1
fi

# Start a simple HTTP server for the debug studio
cd "$SCRIPT_DIR/multi-drive"

echo ""
echo "Maestro Debug Studio starting on http://localhost:$PORT/maestro-debug-studio.html"
echo ""
echo "This is an isolated context for debugging Maestro orchestration issues."
echo "Your conversations here won't pollute other contexts."
echo ""
echo "Press Ctrl+C to stop"
echo "==========================================="

# Use Python's simple HTTP server
python3 -m http.server $PORT 2>/dev/null || python -m SimpleHTTPServer $PORT
