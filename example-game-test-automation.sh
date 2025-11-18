#!/bin/bash

# Example: Automated Game Test Using Browser Automation
# This demonstrates how to test a browser-based game automatically
# without any manual intervention

set -e

GAME_DIR="/mnt/c/github/superstarships"  # Change to your game directory
GAME_URL="http://localhost:3000"
TEST_OUTPUT_DIR="$GAME_DIR/tests/automation"

echo "🎮 Automated Game Test Example"
echo "=============================="
echo ""
echo "Game Directory: $GAME_DIR"
echo "Game URL: $GAME_URL"
echo "Output Directory: $TEST_OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$TEST_OUTPUT_DIR"

# Step 1: Start game server in background
echo "🚀 Step 1: Starting game server..."
cd "$GAME_DIR"
npm start > "$TEST_OUTPUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo "Waiting 5 seconds for server to start..."
sleep 5
echo ""

# Step 2: Initialize browser automation
echo "🤖 Step 2: Initializing browser automation..."
curl -s -X POST http://localhost:8081/browser-init > /dev/null
echo "✓ Browser automation ready"
echo ""

# Step 3: Launch browser
echo "🌐 Step 3: Launching browser..."
LAUNCH_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-launch \
  -H "Content-Type: application/json" \
  -d '{"headless": false, "viewport": {"width": 1280, "height": 720}}')

SESSION_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.result.sessionId // .result')
echo "✓ Browser launched (Session: $SESSION_ID)"
echo ""

# Step 4: Navigate to game
echo "🎯 Step 4: Loading game at $GAME_URL..."
curl -s -X POST http://localhost:8081/browser-navigate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"url\": \"$GAME_URL\"}" > /dev/null

echo "✓ Game URL loaded"
echo "Waiting 3 seconds for game to initialize..."
sleep 3
echo ""

# Step 5: Execute test JavaScript
echo "💻 Step 5: Executing test scenario..."

# Example: Test ship navigation after fitting item
TEST_SCRIPT=$(cat <<'EOF'
// Test ship navigation bug
const results = {
  timestamp: new Date().toISOString(),
  test: "Ship navigation after fitting",
  steps: []
};

try {
  // Step 1: Get initial ship state
  if (window.gameManager && window.gameManager.player) {
    const ship = window.gameManager.player.ship;

    results.steps.push({
      step: "Initial state",
      maxVelocity: ship.maxVelocity,
      throttle: ship.throttle
    });

    // Step 2: Fit afterburner (if available)
    if (ship.fitItem) {
      ship.fitItem('afterburner');
      results.steps.push({
        step: "After fitting afterburner",
        maxVelocity: ship.maxVelocity,
        throttle: ship.throttle
      });
    }

    // Step 3: Undock
    if (ship.undock) {
      ship.undock();
      results.steps.push({
        step: "After undocking",
        maxVelocity: ship.maxVelocity,
        throttle: ship.throttle
      });
    }

    results.success = true;
  } else {
    results.success = false;
    results.error = "Game not loaded";
  }
} catch (error) {
  results.success = false;
  results.error = error.message;
  results.stack = error.stack;
}

return results;
EOF
)

EVAL_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-evaluate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"script\": $(echo "$TEST_SCRIPT" | jq -Rs .)}")

echo "$EVAL_RESPONSE" | jq '.' > "$TEST_OUTPUT_DIR/test-results.json"
echo "✓ Test executed"
echo ""

# Step 6: Capture console logs
echo "📋 Step 6: Capturing console logs..."
LOGS_RESPONSE=$(curl -s -X POST http://localhost:8081/browser-get-console-logs \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"filter\": \"all\"}")

echo "$LOGS_RESPONSE" | jq '.' > "$TEST_OUTPUT_DIR/console-logs.json"

ERROR_COUNT=$(echo "$LOGS_RESPONSE" | jq '[.result.logs[]? | select(.type == "error")] | length')
WARN_COUNT=$(echo "$LOGS_RESPONSE" | jq '[.result.logs[]? | select(.type == "warn")] | length')

echo "✓ Console logs captured"
echo "  - Errors: $ERROR_COUNT"
echo "  - Warnings: $WARN_COUNT"
echo ""

# Step 7: Take screenshot
echo "📸 Step 7: Taking screenshot..."
SCREENSHOT_PATH="$TEST_OUTPUT_DIR/game-state.png"
curl -s -X POST http://localhost:8081/browser-screenshot \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"path\": \"$SCREENSHOT_PATH\"}" > /dev/null

if [ -f "$SCREENSHOT_PATH" ]; then
  echo "✓ Screenshot saved: $SCREENSHOT_PATH"
else
  echo "✗ Screenshot failed"
fi
echo ""

# Step 8: Close browser
echo "🔒 Step 8: Closing browser..."
curl -s -X POST http://localhost:8081/browser-close \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\"}" > /dev/null
echo "✓ Browser closed"
echo ""

# Step 9: Stop server
echo "🛑 Step 9: Stopping game server..."
kill $SERVER_PID 2>/dev/null || true
echo "✓ Server stopped"
echo ""

# Display results
echo "📊 Test Results Summary"
echo "======================"
echo ""

if [ -f "$TEST_OUTPUT_DIR/test-results.json" ]; then
  echo "JavaScript Execution Results:"
  cat "$TEST_OUTPUT_DIR/test-results.json" | jq '.'
  echo ""
fi

echo "Evidence Files:"
echo "  - Test results: $TEST_OUTPUT_DIR/test-results.json"
echo "  - Console logs: $TEST_OUTPUT_DIR/console-logs.json"
echo "  - Screenshot: $TEST_OUTPUT_DIR/game-state.png"
echo "  - Server log: $TEST_OUTPUT_DIR/server.log"
echo ""

echo "✅ Automated test complete!"
echo ""
echo "🎉 This test ran completely automatically:"
echo "  ✓ No manual browser interaction required"
echo "  ✓ No DevTools injection needed"
echo "  ✓ Full console log capture"
echo "  ✓ Screenshot evidence"
echo "  ✓ JavaScript execution results"
