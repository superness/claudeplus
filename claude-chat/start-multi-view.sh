#!/bin/bash
# Start Claude Chat Multi-View Dashboard
# Real-time monitoring of all Claude Chat conversations

PORT=3008
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🔮 Starting Claude Chat Multi-View Dashboard..."
echo "   Port: $PORT"
echo "   Directory: $DIR"

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use. Killing existing process..."
    kill $(lsof -t -i:$PORT) 2>/dev/null
    sleep 1
fi

# Check if proxy server is running on port 8081
if ! lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Warning: Proxy server (port 8081) doesn't appear to be running."
    echo "   The dashboard needs the proxy server to function."
    echo "   Start it with: cd ../proxy && node server.js"
    echo ""
fi

# Start simple HTTP server
cd "$DIR"

echo "✨ Multi-View Dashboard starting at http://localhost:$PORT/multi-view.html"
echo "   Press Ctrl+C to stop"
echo ""

# Use Python 3 if available, fallback to Python 2
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
else
    echo "❌ Python not found. Install Python or use another HTTP server."
    exit 1
fi
