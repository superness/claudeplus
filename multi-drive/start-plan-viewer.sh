#!/bin/bash

# Start the Plan Viewer on port 3008
# This viewer shows the maestro-planning pipeline conversation in real-time

cd "$(dirname "$0")"

echo "Starting Plan Viewer on http://localhost:3008/plan-viewer.html"
echo "Make sure the proxy server is running on port 8081"
echo ""

# Use Python's built-in HTTP server
python3 -m http.server 3008
