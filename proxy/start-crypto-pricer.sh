#!/bin/bash
# Start the Crypto Pricer UI server

cd "$(dirname "$0")/crypto-pricer"

echo "Starting Crypto Pricer..."
echo ""

# Check if npm dependencies are installed
if [ ! -d "../node_modules" ]; then
    echo "Installing dependencies..."
    cd .. && npm install && cd crypto-pricer
fi

# Start the server
node server.js
