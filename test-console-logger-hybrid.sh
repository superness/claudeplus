#!/bin/bash

# Hybrid Chrome + Puppeteer Console Logger Test
# This script demonstrates Option B: Connect Puppeteer to Windows Chrome

echo "=== HYBRID CHROME + PUPPETEER SETUP ==="
echo
echo "STEP 1: Launch Chrome on Windows"
echo "  → Run this command in Windows PowerShell or CMD:"
echo "  → start-chrome-debug.bat"
echo
echo "STEP 2: Wait for Chrome to open (you should see a Chrome window)"
echo
echo "STEP 3: Run the Node.js connector:"
echo "  → node test-puppeteer-connect-only.js"
echo
echo "The Node.js script will connect to Chrome and capture console logs."
echo
read -p "Press Enter when ready to launch the connector script..."

node test-puppeteer-connect-only.js
