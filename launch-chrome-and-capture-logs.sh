#!/bin/bash

# Launch Chrome and Capture Console Logs
# Uses Chrome's built-in --enable-logging flag (NO CDP, NO Puppeteer)
# Chrome writes console logs to chrome_debug.log automatically

set -e

GAME_URL="${1:-http://localhost:8080}"
USER_DATA_DIR="${2:-C:\\Temp\\chrome-test-profile}"

echo "=== Chrome Launch with Console Logging ==="
echo "Game URL: $GAME_URL"
echo "User data dir: $USER_DATA_DIR"
echo ""

# Step 1: Kill any existing Chrome instances
echo "[1/3] Killing existing Chrome instances..."
taskkill.exe //F //IM chrome.exe 2>/dev/null || true
sleep 2

# Step 2: Launch Chrome with --enable-logging flag
echo "[2/3] Launching Chrome with console logging enabled..."
cmd.exe /c start chrome.exe --enable-logging --v=1 --user-data-dir="$USER_DATA_DIR" "$GAME_URL"

# Wait for Chrome to start
sleep 3

# Step 3: Show log file location
WSL_LOG_PATH=$(wslpath "$USER_DATA_DIR\\chrome_debug.log")
echo "[3/3] Chrome started successfully!"
echo ""
echo "✓ Console logs will be written to:"
echo "  Windows: $USER_DATA_DIR\\chrome_debug.log"
echo "  WSL: $WSL_LOG_PATH"
echo ""
echo "To view logs in real-time:"
echo "  tail -f \"$WSL_LOG_PATH\""
