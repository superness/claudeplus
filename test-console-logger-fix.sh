#!/bin/bash

echo "=== Testing Chrome Console Logger Fix ==="
echo ""

# Step 0: Kill any existing Chrome instances
echo "0. Killing any existing Chrome instances..."
pkill -f "chrome.*remote-debugging-port=9222" 2>/dev/null || true
sleep 2

# Step 1: Launch Chrome with remote debugging AND test page
echo "1. Launching Chrome with test page and remote debugging on port 9222..."
/mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-test-profile-$$ \
  --no-first-run \
  --no-default-browser-check \
  "file:///mnt/c/github/claudeplus/test-console-logging.html" &

CHROME_PID=$!
echo "   Chrome PID: $CHROME_PID"
echo ""

# Step 2: Start console logger (should retry and connect)
echo "2. Starting console logger (will retry connection)..."
LOG_FILE="/tmp/chrome-console-test-$$.log"
node /mnt/c/github/claudeplus/chrome-console-logger.js 9222 "$LOG_FILE" &

LOGGER_PID=$!
echo "   Logger PID: $LOGGER_PID"
echo "   Log file: $LOG_FILE"
echo ""

# Step 3: Wait 15 seconds for connection
echo "3. Waiting 15 seconds for logger to connect..."
sleep 15

# Step 4: Check if logger is still running
if ps -p $LOGGER_PID > /dev/null; then
  echo "   ✓ Logger is running (connected successfully!)"

  # Page already loaded - just wait for logs
  echo ""
  echo "4. Waiting for console logs to be captured..."
  echo "   Waiting 10 seconds..."
  sleep 10

  # Check log file
  echo ""
  echo "5. Checking captured logs:"
  echo "   ---"
  cat "$LOG_FILE"
  echo "   ---"

  # Verify we got logs
  if grep -q "Console Log Test" "$LOG_FILE"; then
    echo ""
    echo "✓✓✓ SUCCESS! Console logs were captured! ✓✓✓"
  else
    echo ""
    echo "✗✗✗ FAILED: No console logs found in file ✗✗✗"
  fi
else
  echo "   ✗ Logger died (connection failed)"
  echo ""
  echo "✗✗✗ FAILED: Logger could not connect ✗✗✗"
fi

# Cleanup
echo ""
echo "6. Cleaning up..."
kill $LOGGER_PID 2>/dev/null
kill $CHROME_PID 2>/dev/null
rm -f "$LOG_FILE"
rm -rf /tmp/chrome-test-profile-$$

echo "Done."
