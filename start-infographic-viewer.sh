#!/bin/bash

# Start Infographic Viewer for Pipeline Execution Monitoring
# This viewer displays rich HTML infographics generated during pipeline runs

echo "🎨 Starting Pipeline Infographic Viewer..."
echo ""
echo "Components:"
echo "  ✓ Proxy server (port 8081) - API for listing infographics"
echo "  ✓ File server (port 3005) - Serves HTML viewer"
echo "  ✓ Infographic viewer - http://localhost:3005/infographic-viewer.html"
echo ""

# Kill any existing processes on port 3005
echo "Cleaning up existing processes on port 3005..."
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# Start Node.js server with story generation API on port 3005
echo "Starting infographic server on port 3005..."
cd /mnt/c/github/claudeplus
node infographic-server.js &
FILE_SERVER_PID=$!

echo ""
echo "✅ Infographic Viewer is running!"
echo ""
echo "📊 Open in browser: http://localhost:3005/infographic-viewer.html"
echo ""
echo "Features:"
echo "  • Real-time HTML infographics with agent outputs"
echo "  • Visual timeline of pipeline stages"
echo "  • Agent decisions and routing visualization"
echo "  • Error tracking with stack traces"
echo "  • Auto-refresh every 2 seconds"
echo "  • Rich media support for images and data"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $FILE_SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
