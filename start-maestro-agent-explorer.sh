#!/bin/bash
# Start the Maestro Agent Explorer interface

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Starting Maestro Agent Explorer..."
echo ""
echo "  Agent Explorer: http://localhost:3009/maestro-agent-explorer.html"
echo ""
echo "This interface lets you:"
echo "  - Browse Maestro session logs"
echo "  - View agent hierarchy (Product Maestro -> Feature Owners -> Sub-ICs)"
echo "  - Click any agent to continue the conversation"
echo "  - See ABUDDI scores and decisions"
echo ""

# Check if proxy is running
if ! curl -s http://localhost:8081/api/tabs > /dev/null 2>&1; then
    echo "WARNING: Proxy server not detected on port 8081"
    echo "Run ./start-proxy.sh first"
    echo ""
fi

# Start a simple HTTP server to serve the agent explorer page
cd "$SCRIPT_DIR/multi-drive"
python3 -m http.server 3009
