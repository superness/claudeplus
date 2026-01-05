#!/bin/bash
# Start Claude Chat interface
# Requires proxy server running on port 8081

cd "$(dirname "$0")"

echo "Starting Claude Chat..."
echo ""

# Check if proxy is running
if ! nc -z localhost 8081 2>/dev/null; then
    echo "Warning: Proxy server not detected on port 8081"
    echo "Starting proxy server first..."
    cd proxy && node server.js &
    PROXY_PID=$!
    cd ..
    sleep 2
    echo "Proxy started (PID: $PROXY_PID)"
fi

echo ""
echo "Starting Claude Chat server on port 3009..."
cd claude-chat && node server.js &
CHAT_PID=$!

sleep 1

echo ""
echo "==================================="
echo "  Claude Chat is ready!"
echo "  Open: http://localhost:3009"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop"

# Wait for Ctrl+C
wait $CHAT_PID
