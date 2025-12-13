#!/bin/bash

# AI Game Studio - Launch Script

echo "=================================="
echo "    AI GAME STUDIO"
echo "=================================="

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if proxy server is running
if ! lsof -i :8081 > /dev/null 2>&1; then
    echo ""
    echo "WARNING: Proxy server not detected on port 8081"
    echo "Please start the proxy server first:"
    echo "  cd $SCRIPT_DIR/../proxy && node server.js"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
fi

# Start the server
echo ""
echo "Starting AI Game Studio..."
cd "$SCRIPT_DIR"
node server.js
