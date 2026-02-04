#!/bin/bash

# Start Multi-Drive Maestro Orchestrator UI
# Launches the proxy server and serves the Maestro interface

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🎭 Starting Multi-Drive Maestro..."
echo ""

# Check if proxy is already running
if lsof -i:8081 > /dev/null 2>&1; then
    echo "✓ Proxy server already running on port 8081"
else
    echo "Starting proxy server..."
    cd "$SCRIPT_DIR/proxy"
    node server.js &
    PROXY_PID=$!
    echo "✓ Proxy server started (PID: $PROXY_PID)"
    sleep 2
fi

# Start file server for Maestro UI on port 3008
echo "Starting Maestro UI server..."
cd "$SCRIPT_DIR"

# Use Python's HTTP server if available, otherwise use Node
if command -v python3 &> /dev/null; then
    python3 -m http.server 3009 &
    SERVER_PID=$!
elif command -v node &> /dev/null; then
    npx serve -l 3009 &
    SERVER_PID=$!
else
    echo "Error: Python3 or Node.js required to serve files"
    exit 1
fi

echo "✓ File server started (PID: $SERVER_PID)"
echo ""
echo "🎭 Multi-Drive Maestro is running!"
echo ""
echo "   Open: http://localhost:3009/maestro-orchestrator.html"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Wait for interrupt
trap "echo ''; echo 'Shutting down...'; kill $SERVER_PID 2>/dev/null; exit 0" INT
wait
