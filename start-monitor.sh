#!/bin/bash

# Start Pipeline Monitor for Claude Plus

echo "🔍 Starting Pipeline Monitor..."
echo ""

# Check if proxy is running
if ! nc -z localhost 8081 2>/dev/null; then
    echo "⚠️  Proxy server is not running on port 8081"
    echo "Starting proxy server first..."
    cd proxy && npm install && node server.js &
    PROXY_PID=$!
    echo "Proxy started with PID: $PROXY_PID"
    sleep 2
fi

# Start simple HTTP server for the monitor interface
echo "Starting web server for monitor interface..."
python3 -m http.server 3004 &
HTTP_PID=$!

echo ""
echo "✅ Pipeline Monitor is ready!"
echo ""
echo "📊 Open in browser: http://localhost:3004/pipeline-monitor.html"
echo ""
echo "Quick commands available:"
echo "  - System Status"
echo "  - Current Pipeline"
echo "  - Recent Errors"
echo "  - Execution History"
echo "  - List Pipelines/Agents"
echo "  - Health Check"
echo ""
echo "Press Ctrl+C to stop..."
echo ""

# Wait for interrupt
trap "kill $HTTP_PID 2>/dev/null; exit" INT TERM
wait
