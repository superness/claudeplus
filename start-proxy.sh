#!/bin/bash
echo "Starting Claude Proxy Server..."

# Kill any existing proxy processes
echo "Stopping any existing proxy servers..."
lsof -ti:8081 | xargs -r kill -9 2>/dev/null || true

cd proxy
npm install
echo "Starting proxy server on port 8081..."
node server.js