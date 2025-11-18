#!/bin/bash

# Start Game Dev Studio for Claude Plus

echo "🎮 Starting Game Dev Studio..."
echo ""

# Check if proxy is running
if ! nc -z localhost 8081 2>/dev/null; then
    echo "⚠️  Proxy server is not running on port 8081"
    echo "Starting proxy server first..."
    cd proxy && npm install && node server.js &
    PROXY_PID=$!
    echo "Proxy started with PID: $PROXY_PID"
    cd ..
    sleep 2
fi

# Start simple HTTP server for the game dev studio interface
echo "Starting web server for Game Dev Studio interface..."
python3 -m http.server 3006 &
HTTP_PID=$!

echo ""
echo "✅ Game Dev Studio is ready!"
echo ""
echo "🎮 Open in browser: http://localhost:3006/game-dev-studio.html"
echo ""
echo "Features:"
echo "  • Chat with Claude Code CLI"
echo "  • Run game development pipelines"
echo "  • Target any game project directory"
echo "  • Modify this interface on-the-fly"
echo "  • Track pipeline progress in real-time"
echo ""
echo "Default working directory: /mnt/c/github/spaceship-simulator"
echo "(You can change this in the interface)"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Wait for interrupt
trap "kill $HTTP_PID 2>/dev/null; exit" INT TERM
wait
