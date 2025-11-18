#!/bin/bash
echo "Starting Claude Proxy Server..."

# Ensure NVM is loaded and PATH is set correctly
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verify claude is accessible
if ! command -v claude &> /dev/null; then
    echo "ERROR: claude command not found in PATH"
    echo "PATH: $PATH"
    exit 1
fi

echo "Found claude at: $(which claude)"

# Kill any existing proxy processes
echo "Stopping any existing proxy servers..."
lsof -ti:8081 | xargs -r kill -9 2>/dev/null || true

cd proxy
npm install
echo "Starting proxy server on port 8081..."
node server.js