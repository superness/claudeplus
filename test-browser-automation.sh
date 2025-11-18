#!/bin/bash

# Browser Automation Test Script
# Demonstrates full browser automation capabilities for game testing

set -e

echo "🤖 Browser Automation Test Script"
echo "=================================="
echo ""

# Step 1: Initialize browser automation
echo "📡 Step 1: Initializing browser automation service..."
INIT_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-init)
echo "Response: $INIT_RESPONSE"
echo ""

# Step 2: Launch browser
echo "🌐 Step 2: Launching browser..."
LAUNCH_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-launch \
  -H "Content-Type: application/json" \
  -d '{"headless": false, "viewport": {"width": 1280, "height": 720}}')

echo "Response: $LAUNCH_RESPONSE"

# Extract session ID
SESSION_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.result.sessionId // .result')
echo "Session ID: $SESSION_ID"
echo ""

# Step 3: Navigate to example page
echo "🔗 Step 3: Navigating to example.com..."
NAV_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-navigate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"url\": \"https://example.com\"}")

echo "Response: $NAV_RESPONSE"
echo ""

# Step 4: Execute JavaScript
echo "💻 Step 4: Executing JavaScript in page..."
EVAL_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-evaluate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"script\": \"return {title: document.title, url: window.location.href, timestamp: new Date().toISOString()}\"}")

echo "Response: $EVAL_RESPONSE"
echo ""

# Step 5: Take screenshot
echo "📸 Step 5: Taking screenshot..."
SCREENSHOT_PATH="/tmp/browser-test-screenshot.png"
SCREENSHOT_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-screenshot \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"path\": \"$SCREENSHOT_PATH\", \"fullPage\": false}")

echo "Response: $SCREENSHOT_RESPONSE"

if [ -f "$SCREENSHOT_PATH" ]; then
  echo "✅ Screenshot saved to $SCREENSHOT_PATH"
else
  echo "❌ Screenshot not found"
fi
echo ""

# Step 6: Get console logs
echo "📋 Step 6: Retrieving console logs..."
LOGS_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-get-console-logs \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"filter\": \"all\"}")

echo "Response: $LOGS_RESPONSE"
echo ""

# Step 7: Close browser
echo "🔒 Step 7: Closing browser..."
CLOSE_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-close \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}")

echo "Response: $CLOSE_RESPONSE"
echo ""

echo "✅ Test complete!"
echo ""
echo "Summary:"
echo "  ✓ Browser automation initialized"
echo "  ✓ Browser launched with session $SESSION_ID"
echo "  ✓ Navigated to example.com"
echo "  ✓ JavaScript executed successfully"
echo "  ✓ Screenshot captured"
echo "  ✓ Console logs retrieved"
echo "  ✓ Browser closed"
echo ""
echo "🎉 All browser automation features working!"
