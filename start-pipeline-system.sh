#!/bin/bash

echo "========================================"
echo "   Claude Plus Pipeline System Launcher"
echo "========================================"
echo

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "[1/3] Starting backend proxy server..."
cd "$DIR/proxy"
node server.js &
PROXY_PID=$!
echo "✅ Proxy server started (PID: $PROXY_PID)"

echo "[2/3] Starting file server..."
cd "$DIR"
python3 -m http.server 3003 &
HTTP_PID=$!
echo "✅ File server started (PID: $HTTP_PID)"

echo "[3/3] Opening pipeline interface..."
sleep 3

# Try to open browser (works on most systems)
if command -v open >/dev/null 2>&1; then
    # macOS
    open "http://localhost:3003/standalone-pipeline.html"
elif command -v xdg-open >/dev/null 2>&1; then
    # Linux
    xdg-open "http://localhost:3003/standalone-pipeline.html"
elif command -v start >/dev/null 2>&1; then
    # Windows (in case this runs in Git Bash)
    start "http://localhost:3003/standalone-pipeline.html"
else
    echo "Please open your browser and go to: http://localhost:3003/standalone-pipeline.html"
fi

echo
echo "✅ Pipeline system started successfully!"
echo
echo "🌐 Access your pipeline at: http://localhost:3003/standalone-pipeline.html"
echo "🖥️  Backend server running on: ws://localhost:8081"
echo
echo "Press Ctrl+C to stop all services..."

# Function to cleanup on exit
cleanup() {
    echo
    echo "🛑 Stopping services..."
    kill $PROXY_PID 2>/dev/null
    kill $HTTP_PID 2>/dev/null
    echo "✅ All services stopped. Goodbye!"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait