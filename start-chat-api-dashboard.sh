#!/bin/bash

# Start the Chat API Visualizations
# Serves on port 3010 to avoid conflicts with other services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           Chat API Visualizations Server                      ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  Index:     http://localhost:3010/                            ║"
echo "║                                                               ║"
echo "║  Themes:                                                      ║"
echo "║    🤖 Borg:    http://localhost:3010/borg-collective-viz.html ║"
echo "║    ⚔️  Fantasy: http://localhost:3010/fantasy-quest-viz.html  ║"
echo "║    🌳 Natural: http://localhost:3010/natural-flow-viz.html    ║"
echo "║    📊 Standard: http://localhost:3010/chat-api-dashboard.html ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Note: Make sure the proxy server is running (./start-proxy.sh)"
echo "Press Ctrl+C to stop"
echo ""

# Use Python's HTTP server
python3 -m http.server 3010 --directory visualizations 2>/dev/null || \
python -m http.server 3010 --directory visualizations 2>/dev/null || \
npx http-server visualizations -p 3010 -c-1
