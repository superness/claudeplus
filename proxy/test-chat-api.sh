#!/bin/bash

# REST API Test Script for claude-chat
# Tests both Chat API and Tab Management API
# Usage: ./test-chat-api.sh

BASE_URL="http://localhost:8081"
PASSED=0
FAILED=0

# Helper function to run a test
run_test() {
  local name="$1"
  local expected="$2"
  local actual="$3"

  if echo "$actual" | grep -q "$expected"; then
    echo "✓ PASS: $name"
    ((PASSED++))
  else
    echo "✗ FAIL: $name"
    echo "  Expected: $expected"
    echo "  Got: $actual"
    ((FAILED++))
  fi
}

echo "========================================"
echo "Testing Claude Chat REST API"
echo "========================================"

# ========================================
# SECTION 1: Tab Management Tests
# ========================================

echo -e "\n--- TAB MANAGEMENT TESTS ---\n"

# Test 1.1: Create a tab
echo "1.1 Creating a new tab..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tabs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tab 1",
    "workingDirectory": "/tmp",
    "hatIds": []
  }')
echo "Response: $CREATE_RESPONSE"
TAB_ID=$(echo "$CREATE_RESPONSE" | grep -o '"tabId":"[^"]*"' | cut -d'"' -f4)
run_test "Create tab returns tabId" "tabId" "$CREATE_RESPONSE"

# Test 1.2: Create a tab with custom ID
echo -e "\n1.2 Creating a tab with custom ID..."
CREATE_CUSTOM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": "my-custom-tab",
    "name": "Custom Tab",
    "workingDirectory": "/home"
  }')
echo "Response: $CREATE_CUSTOM_RESPONSE"
run_test "Create tab with custom ID" "my-custom-tab" "$CREATE_CUSTOM_RESPONSE"

# Test 1.3: Try to create duplicate tab (should fail)
echo -e "\n1.3 Creating duplicate tab (should fail)..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": "my-custom-tab",
    "name": "Duplicate"
  }')
echo "Response: $DUPLICATE_RESPONSE"
run_test "Duplicate tab rejected" "already exists" "$DUPLICATE_RESPONSE"

# Test 1.4: List all tabs
echo -e "\n1.4 Listing all tabs..."
LIST_RESPONSE=$(curl -s "$BASE_URL/api/tabs")
echo "Response: $LIST_RESPONSE"
run_test "List tabs includes created tab" "my-custom-tab" "$LIST_RESPONSE"

# Test 1.5: Get specific tab
echo -e "\n1.5 Getting specific tab..."
GET_RESPONSE=$(curl -s "$BASE_URL/api/tabs/my-custom-tab")
echo "Response: $GET_RESPONSE"
run_test "Get tab returns correct name" "Custom Tab" "$GET_RESPONSE"

# Test 1.6: Get non-existent tab (should 404)
echo -e "\n1.6 Getting non-existent tab (should 404)..."
NOT_FOUND_RESPONSE=$(curl -s "$BASE_URL/api/tabs/does-not-exist")
echo "Response: $NOT_FOUND_RESPONSE"
run_test "Non-existent tab returns error" "not found" "$NOT_FOUND_RESPONSE"

# ========================================
# SECTION 2: Chat API Tests (Basic)
# ========================================

echo -e "\n--- CHAT API TESTS (Basic) ---\n"

# Test 2.1: Send a simple message without tab
echo "2.1 Sending a simple message (no tab)..."
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/send" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is 2 + 2? Reply with just the number, nothing else.",
    "workingDirectory": "/tmp"
  }')
echo "Response: $CHAT_RESPONSE"
REQUEST_ID=$(echo "$CHAT_RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
run_test "Chat send returns requestId" "requestId" "$CHAT_RESPONSE"

if [ -n "$REQUEST_ID" ]; then
  # Test 2.2: Check status
  echo -e "\n2.2 Checking chat status..."
  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/chat/status/$REQUEST_ID")
  echo "Response: $STATUS_RESPONSE"
  run_test "Status check returns status field" "status" "$STATUS_RESPONSE"

  # Test 2.3: Wait for response
  echo -e "\n2.3 Waiting for response (timeout: 60s)..."
  RESULT_RESPONSE=$(curl -s "$BASE_URL/api/chat/response/$REQUEST_ID?timeout=60000")
  echo "Response: $RESULT_RESPONSE"
  run_test "Response received" "response" "$RESULT_RESPONSE"

  # Test 2.4: List requests
  echo -e "\n2.4 Listing all requests..."
  REQUESTS_RESPONSE=$(curl -s "$BASE_URL/api/chat/requests")
  echo "Response: $REQUESTS_RESPONSE"
  run_test "Request list includes our request" "$REQUEST_ID" "$REQUESTS_RESPONSE"
else
  echo "SKIP: Cannot test status/response without requestId"
  ((FAILED+=3))
fi

# ========================================
# SECTION 3: Chat with API Tab
# ========================================

echo -e "\n--- CHAT WITH API TAB ---\n"

# Test 3.1: Create a dedicated chat tab
echo "3.1 Creating a dedicated chat tab..."
CHAT_TAB_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tabs" \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": "conversation-tab",
    "name": "Conversation Test",
    "workingDirectory": "/tmp"
  }')
echo "Response: $CHAT_TAB_RESPONSE"
run_test "Chat tab created" "conversation-tab" "$CHAT_TAB_RESPONSE"

# Test 3.2: Send first message to tab
echo -e "\n3.2 Sending first message to tab..."
MSG1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/send" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Remember this number: 42. Just say OK.",
    "tabId": "conversation-tab"
  }')
echo "Response: $MSG1_RESPONSE"
MSG1_REQUEST_ID=$(echo "$MSG1_RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
run_test "First message sent to tab" "conversation-tab" "$MSG1_RESPONSE"

if [ -n "$MSG1_REQUEST_ID" ]; then
  # Wait for first response
  echo -e "\n3.2b Waiting for first response..."
  MSG1_RESULT=$(curl -s "$BASE_URL/api/chat/response/$MSG1_REQUEST_ID?timeout=60000")
  echo "Response: $MSG1_RESULT"
  run_test "First response received" "completed" "$MSG1_RESULT"

  # Test 3.3: Check tab has messages
  echo -e "\n3.3 Checking tab has messages..."
  TAB_WITH_MSG=$(curl -s "$BASE_URL/api/tabs/conversation-tab")
  echo "Response: $TAB_WITH_MSG"
  run_test "Tab has messages" "messages" "$TAB_WITH_MSG"

  # Test 3.4: Send follow-up message (should have context)
  echo -e "\n3.4 Sending follow-up message (should remember context)..."
  MSG2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/send" \
    -H "Content-Type: application/json" \
    -d '{
      "message": "What number did I ask you to remember? Reply with just the number.",
      "tabId": "conversation-tab"
    }')
  echo "Response: $MSG2_RESPONSE"
  MSG2_REQUEST_ID=$(echo "$MSG2_RESPONSE" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)
  run_test "Follow-up message sent" "requestId" "$MSG2_RESPONSE"

  if [ -n "$MSG2_REQUEST_ID" ]; then
    echo -e "\n3.4b Waiting for follow-up response..."
    MSG2_RESULT=$(curl -s "$BASE_URL/api/chat/response/$MSG2_REQUEST_ID?timeout=60000")
    echo "Response: $MSG2_RESULT"
    # Check if 42 is in the response (context was preserved)
    run_test "Context preserved (should mention 42)" "42" "$MSG2_RESULT"
  fi
else
  echo "SKIP: Cannot test follow-up without first message"
  ((FAILED+=3))
fi

# ========================================
# SECTION 4: Error Cases
# ========================================

echo -e "\n--- ERROR CASE TESTS ---\n"

# Test 4.1: Send message without required field
echo "4.1 Sending message without 'message' field..."
NO_MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/send" \
  -H "Content-Type: application/json" \
  -d '{
    "workingDirectory": "/tmp"
  }')
echo "Response: $NO_MSG_RESPONSE"
run_test "Missing message returns error" "required" "$NO_MSG_RESPONSE"

# Test 4.2: Get non-existent request
echo -e "\n4.2 Getting non-existent request..."
NO_REQ_RESPONSE=$(curl -s "$BASE_URL/api/chat/response/does-not-exist")
echo "Response: $NO_REQ_RESPONSE"
run_test "Non-existent request returns error" "not found" "$NO_REQ_RESPONSE"

# Test 4.3: Abort non-existent request
echo -e "\n4.3 Aborting non-existent request..."
NO_ABORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/abort/does-not-exist")
echo "Response: $NO_ABORT_RESPONSE"
run_test "Abort non-existent returns error" "not found" "$NO_ABORT_RESPONSE"

# ========================================
# SECTION 5: Cleanup
# ========================================

echo -e "\n--- CLEANUP ---\n"

# Test 5.1: Delete tabs
echo "5.1 Deleting test tabs..."
DELETE1_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/tabs/my-custom-tab")
echo "Response: $DELETE1_RESPONSE"
run_test "Delete custom tab" "deleted" "$DELETE1_RESPONSE"

DELETE2_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/tabs/conversation-tab")
echo "Response: $DELETE2_RESPONSE"
run_test "Delete conversation tab" "deleted" "$DELETE2_RESPONSE"

if [ -n "$TAB_ID" ]; then
  DELETE3_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/tabs/$TAB_ID")
  echo "Response: $DELETE3_RESPONSE"
  run_test "Delete first test tab" "deleted" "$DELETE3_RESPONSE"
fi

# Test 5.2: Delete non-existent tab
echo -e "\n5.2 Deleting non-existent tab..."
DELETE_NONE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/tabs/already-deleted")
echo "Response: $DELETE_NONE_RESPONSE"
run_test "Delete non-existent returns error" "not found" "$DELETE_NONE_RESPONSE"

# Test 5.3: Verify tabs are deleted
echo -e "\n5.3 Verifying tabs are deleted..."
FINAL_LIST=$(curl -s "$BASE_URL/api/tabs")
echo "Response: $FINAL_LIST"
# Should not contain our test tabs
if echo "$FINAL_LIST" | grep -q "my-custom-tab"; then
  echo "✗ FAIL: my-custom-tab still exists"
  ((FAILED++))
else
  echo "✓ PASS: my-custom-tab properly deleted"
  ((PASSED++))
fi

# ========================================
# SUMMARY
# ========================================

echo -e "\n========================================"
echo "TEST SUMMARY"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "========================================"

if [ $FAILED -eq 0 ]; then
  echo "All tests passed!"
  exit 0
else
  echo "Some tests failed. Check output above."
  exit 1
fi
