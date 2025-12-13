#!/bin/bash

# Start SuperCoin Dev Studio for Claude Plus

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "💰 Starting SuperCoin Dev Studio..."
echo ""

# Check if proxy is running
if ! nc -z localhost 8081 2>/dev/null; then
    echo "⚠️  Proxy server is not running on port 8081"
    echo "Starting proxy server first..."
    cd "$SCRIPT_DIR/proxy" && npm install && node server.js &
    PROXY_PID=$!
    echo "Proxy started with PID: $PROXY_PID"
    cd "$SCRIPT_DIR"
    sleep 2
fi

# Start simple HTTP server for the SuperCoin dev studio interface
echo "Starting web server for SuperCoin Dev Studio interface..."
cd "$SCRIPT_DIR"
python3 -m http.server 3007 &
HTTP_PID=$!

echo ""
echo "✅ SuperCoin Dev Studio is ready!"
echo ""
echo "💰 Open in browser: http://localhost:3007/supercoin-dev-studio.html"
echo ""
echo "Features:"
echo "  • Chat with Claude Code CLI"
echo "  • Run development pipelines (bug fixes, features)"
echo "  • Code review and testing assistance"
echo "  • Project-specific context and guidance"
echo "  • Track pipeline progress in real-time"
echo ""
echo "Working directory: /mnt/c/github/private-SuperCoinServ"
echo "(You can change this in the interface)"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Wait for interrupt
trap "kill $HTTP_PID 2>/dev/null; exit" INT TERM
wait
