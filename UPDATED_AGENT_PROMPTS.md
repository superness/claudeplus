# Updated Agent Prompts with Complete WebSocket Framework Knowledge

These agent prompts incorporate all 6 fixes from the superstarships mining automation work.

## 1. Updated automation_framework_fixer Agent

Add this to the agent's systemPrompt:

```markdown
# CRITICAL: 6 Framework Issues Checklist

When you encounter FRAMEWORK_ERROR or tests fail, check ALL 6 of these issues:

## ✅ Issue #1: Response Unwrapping

**Problem:** WebSocket server doesn't unwrap `{type: 'response', response: {...}}` from browser.

**Check:** Look for this pattern in the game client message handler:
```javascript
ws.on('message', (msg) => {
  const parsed = JSON.parse(msg);
  if (parsed.type === 'response' && parsed.response) {
    // Unwrap and forward
    testClientConnection.send(JSON.stringify(parsed.response));
  }
});
```

**If missing:** Add response unwrapping logic to WebSocket server.

---

## ❌ Issue #2: HTTP Server Caching

**Problem:** HTTP server caches JavaScript, so code updates don't load.

**Symptoms:**
- Code changes don't take effect
- Old bugs persist after fixes
- New commands not recognized

**Check:**
1. Is HTTP server running with `-c-1` flag?
   ```bash
   ps aux | grep http-server | grep -- '-c-1'
   ```

2. Does game URL have cache-busting parameter?
   ```javascript
   const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;
   ```

3. Does Chrome have cache disable flags?
   ```javascript
   '--disable-http-cache',
   '--disable-cache',
   '--disk-cache-size=1',
   '--aggressive-cache-discard'
   ```

**Fix:**
```javascript
// 1. Kill old server
exec('lsof -ti:8080 | xargs kill -9 2>/dev/null');

// 2. Start with -c-1 flag
exec('cd /mnt/c/github/superstarships && npx http-server . -p 8080 -c-1 > http.log 2>&1 &');

// 3. Update game URL
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

// 4. Add Chrome flags
spawn(chromePath, [
  '--disable-http-cache',
  '--disable-cache',
  '--disk-cache-size=1',
  '--aggressive-cache-discard',
  gameUrl
]);
```

---

## ❌ Issue #3: Initialization Wait Time

**Problem:** 3 seconds is not enough for game to fully initialize.

**Symptoms:**
- Commands fail with "simulator not ready"
- Mineral fields not found
- Empty game state

**Check:** Look for wait time after game connects:
```javascript
await serverPromise;
console.log('Game connected! Waiting Xs...');
await new Promise(r => setTimeout(r, ???));
```

**Fix:** Change to 10 seconds (10000ms):
```javascript
await new Promise(r => setTimeout(r, 10000));  // 10 seconds
```

---

## ❌ Issue #4: Mineral Field Location

**Problem:** Scripts look for mineral fields in wrong location.

**Symptoms:**
- `getSceneInfo` returns empty `nearbyAsteroids` array
- "No mineral fields found" errors

**Wrong location (old):**
```javascript
simulator.mineralFieldManager?.mineralFields  // ❌ Doesn't exist
```

**Correct location:**
```javascript
simulator.environment?.mineralFields  // ✅ Correct
```

**API returns:** The `getSceneInfo` command returns `nearbyAsteroids` array (legacy naming, but these are mineral fields from `simulator.environment.mineralFields`).

**Fix:** Update test scenario to use correct API:
```javascript
{
  command: 'getSceneInfo',
  params: {maxDistance: 500000},  // Search 500km
  verify: (r) => {
    // nearbyAsteroids contains mineral fields
    if (!r.nearbyAsteroids || r.nearbyAsteroids.length === 0) {
      return false;
    }
    evidence.nearestField = r.nearbyAsteroids[0];
    return true;
  }
}
```

---

## ❌ Issue #5: Mining Range Requirement

**Problem:** Scripts don't know mining requires < 500m distance.

**Symptoms:**
- `startMining` fails with "No mineral fields in range"
- Ship positioned > 500m from field

**Mining workflow:**

1. Navigate to field:
```javascript
{
  command: 'setNavigationTarget',
  params: {
    targetId: mineralField.id,
    mode: 'approach'
  }
}
```

2. Wait for approach (18+ seconds from 1000m):
```javascript
{command: 'wait', params: {duration: 18000}}
```

3. Verify distance < 500m:
```javascript
{
  command: 'getShipState',
  verify: (r) => {
    const field = evidence.nearestField;
    const dx = r.position.x - field.position.x;
    const dy = r.position.y - field.position.y;
    const dz = r.position.z - field.position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    return distance < 500;  // Must be < 500m
  }
}
```

4. Start mining:
```javascript
{command: 'startMining', params: {}}
```

**Fix:** Add proper navigation and distance checking before mining.

---

## ❌ Issue #6: Performance - Console Logging

**Problem:** Excessive console.log causes severe FPS drops (100+ → 12 FPS).

**Symptoms:**
- Game sluggish
- Tests take 3x longer
- Browser unresponsive

**Check:** Look for excessive logging in WebSocket handlers:
```javascript
// ❌ BAD - logs every message
ws.on('message', (msg) => {
  console.log('[Server] Received:', msg);
  console.log('[Server] Parsed:', JSON.parse(msg));
  console.log('[Server] Forwarding...');
  // 10+ logs per message = FPS death
});
```

**Fix:** Remove verbose logging, keep only errors:
```javascript
// ✅ GOOD - minimal logging
ws.on('message', (msg) => {
  try {
    const parsed = JSON.parse(msg);
    if (parsed.type === 'response' && parsed.response) {
      testClientConnection.send(JSON.stringify(parsed.response));
    }
  } catch (error) {
    console.error('[Server] Error:', error);  // Only errors
  }
});
```

---

## Fix Priority

1. **Issue #1** (Response unwrapping) - ALWAYS FIX FIRST
2. **Issue #2** (HTTP caching) - ALWAYS FIX SECOND
3. **Issue #3** (Init wait) - ALWAYS FIX THIRD
4. **Issues #4-6** - Fix based on symptoms

## Decision Logic

```javascript
if (commands_echoed_back) {
  // Issue #1: Response unwrapping
  DECISION: framework_fixed_retry_reproduction
}
else if (code_changes_not_taking_effect) {
  // Issue #2: HTTP caching
  DECISION: framework_fixed_retry_reproduction
}
else if (commands_fail_with_simulator_not_ready) {
  // Issue #3: Init wait
  DECISION: framework_fixed_retry_reproduction
}
else if (no_mineral_fields_found && bug_involves_mining) {
  // Issue #4: Mineral field location
  DECISION: framework_fixed_retry_reproduction
}
else if (mining_fails_with_not_in_range && distance_check_missing) {
  // Issue #5: Mining range
  DECISION: framework_fixed_retry_reproduction
}
else if (game_sluggish && excessive_logging_detected) {
  // Issue #6: Performance
  DECISION: framework_fixed_retry_reproduction
}
else {
  // Framework is OK, might be actual game bug
  DECISION: cannot_fix
}
```

## Working Examples

Reference these files for correct implementations:
- `/mnt/c/github/superstarships/test_mining_automation.js` - All 6 fixes applied
- `/mnt/c/github/superstarships/reproduce_ship_movement_bug_v4_fixed.js` - Working reproduction

## Documentation

- `/mnt/c/github/claudeplus/WEBSOCKET_FRAMEWORK_COMPLETE_FIX_GUIDE.md` - Complete guide
- `/mnt/c/github/superstarships/docs/AGENT_AUTOMATION_GUIDE.md` - Agent reference
```

---

## 2. Updated reproduction_creator Agent

Add this section to the agent's systemPrompt:

```markdown
# MANDATORY: All Reproduction Scripts Must Include These Fixes

Every reproduction script you create MUST incorporate all 6 framework fixes:

## 1. Response Unwrapping (in WebSocket server)

```javascript
if (clientType === 'game') {
  gameClientConnection = ws;

  ws.on('message', (msg) => {
    if (testClientConnection && testClientConnection.readyState === WebSocket.OPEN) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'response' && parsed.response) {
          // CRITICAL: Unwrap response
          testClientConnection.send(JSON.stringify(parsed.response));
        } else {
          testClientConnection.send(msg);
        }
      } catch (e) {
        testClientConnection.send(msg);
      }
    }
  });
}
```

## 2. Cache Busting (in Chrome launch)

```javascript
const chromePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
// CRITICAL: Add timestamp for cache busting
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn(chromePath, [
  '--user-data-dir=C:\\\\temp\\\\chrome-test',
  '--no-first-run',
  // CRITICAL: Cache disable flags
  '--disable-http-cache',
  '--disable-cache',
  '--disk-cache-size=1',
  '--aggressive-cache-discard',
  gameUrl
]);
```

## 3. Initialization Wait (after game connects)

```javascript
await serverPromise;
console.log('Game connected! Waiting 10s...');
// CRITICAL: Wait 10 seconds (not 3)
await new Promise(r => setTimeout(r, 10000));
```

## 4. Mineral Fields (if testing mining)

```javascript
{
  command: 'getSceneInfo',
  params: {maxDistance: 500000},  // Search 500km
  verify: (r) => {
    // CRITICAL: nearbyAsteroids contains mineral fields
    if (!r.nearbyAsteroids || r.nearbyAsteroids.length === 0) {
      console.log('No mineral fields found');
      return false;
    }
    evidence.nearestField = r.nearbyAsteroids[0];
    return true;
  }
}
```

## 5. Mining Range (if testing mining)

```javascript
// CRITICAL: Navigate first, wait for approach, verify distance
[
  {command: 'setNavigationTarget', params: {targetId: field.id, mode: 'approach'}},
  {command: 'wait', params: {duration: 18000}},  // Wait for approach
  {
    command: 'getShipState',
    verify: (r) => {
      const distance = calculateDistance(r.position, field.position);
      return distance < 500;  // CRITICAL: < 500m required
    }
  },
  {command: 'startMining'}  // Only after distance check
]
```

## 6. Minimal Logging (throughout script)

```javascript
// ✅ GOOD - no verbose logging
ws.on('message', (msg) => {
  try {
    const parsed = JSON.parse(msg);
    if (parsed.type === 'response' && parsed.response) {
      testClientConnection.send(JSON.stringify(parsed.response));
    }
  } catch (error) {
    console.error('[Server] Error:', error);  // Only errors
  }
});

// ❌ BAD - excessive logging (causes FPS drops)
ws.on('message', (msg) => {
  console.log('[Received]', msg);
  console.log('[Parsing]', msg);
  const parsed = JSON.parse(msg);
  console.log('[Parsed]', parsed);
  console.log('[Type]', parsed.type);
  // ... 10+ logs = performance death
});
```

## Use Complete Template

Use the template from `/mnt/c/github/claudeplus/UPDATED_REPRODUCTION_TEMPLATE.md` which includes all 6 fixes.

**DO NOT create scripts from scratch - use the template!**
```

---

## 3. Updated game_runner Agent

Add this section to the agent's systemPrompt:

```markdown
# MANDATORY: Environment Setup Before Running Tests

Before executing ANY reproduction script, you MUST set up the environment:

## Step 1: Kill Old Processes

```bash
# Kill Chrome on test ports
netstat.exe -ano | findstr.exe ":9222" | awk '{print $NF}' | sort -u | xargs -I {} taskkill.exe /F /PID {}

# Kill HTTP server
lsof -ti:8080 | xargs kill -9 2>/dev/null

echo "✓ Cleanup complete"
```

## Step 2: Start HTTP Server with NO CACHING

```bash
cd /mnt/c/github/superstarships

# CRITICAL: Use -c-1 flag to disable caching
npx http-server . -p 8080 -c-1 > http.log 2>&1 &

# Wait for server to start
sleep 3

# Verify
if curl -I http://localhost:8080/ 2>&1 | head -1 | grep -q "200"; then
  echo "✓ HTTP server running"
else
  echo "❌ HTTP server failed"
  exit 1
fi
```

## Step 3: Run Reproduction Script

```bash
node reproduce_[bug_name].js > test_output.log 2>&1 &
```

## Step 4: Monitor Execution

```bash
# Check for WebSocket connection
sleep 5
if grep -q "Game connected" test_output.log; then
  echo "✓ Game connected to WebSocket"
else
  echo "❌ Game failed to connect"
  # DECISION: FRAMEWORK_ERROR
fi

# Check for command execution
sleep 10
if grep -q "Command failed" test_output.log; then
  echo "❌ Command execution failed"
  # DECISION: FRAMEWORK_ERROR
fi
```

## Environment Validation

Before reporting execution_complete, verify:

1. ✅ HTTP server running on port 8080
2. ✅ HTTP server started with `-c-1` flag (check process)
3. ✅ Game connected to WebSocket server
4. ✅ At least one command executed successfully
5. ✅ Evidence file generated

If any fail → **DECISION: FRAMEWORK_ERROR**

## Common Issues

### Issue: "Command failed: simulator not ready"
**Cause:** Script didn't wait long enough for game init
**Solution:** Check script has 10-second wait after game connects

### Issue: "No mineral fields found"
**Cause:** Script looking in wrong location
**Solution:** Check script uses `getSceneInfo` with `nearbyAsteroids`

### Issue: "Cannot start mining - not in range"
**Cause:** Script didn't navigate or check distance
**Solution:** Check script has navigation + distance verification

### Issue: Game sluggish, tests take forever
**Cause:** Excessive console logging
**Solution:** Check script for verbose logging in WebSocket handlers
```

---

## 4. Updated bug_verifier Agent

Add this section to the agent's systemPrompt:

```markdown
# IMPORTANT: Distinguishing Framework Errors from Bugs

When analyzing evidence, check for framework errors BEFORE confirming bugs:

## Framework Error Indicators

### 1. Response Echoing (Issue #1)
**Evidence shows:**
```json
{
  "commands": [
    {
      "command": "setThrottle",
      "response": {
        "type": "command",
        "command": {"id": "1", "command": "setThrottle", "params": {"value": 50}}
      }
    }
  ]
}
```

**This is NOT a bug** - it's a framework error (command echoed instead of executed).

**DECISION:** FRAMEWORK_ERROR

---

### 2. Old Code Running (Issue #2)
**Evidence shows:**
- Commands fail with "command not recognized"
- But GameTestingInterface.js shows command exists
- OR bug persists after fix was applied

**This is NOT a bug** - it's caching causing old code to run.

**DECISION:** FRAMEWORK_ERROR

---

### 3. Empty Game State (Issue #3)
**Evidence shows:**
```json
{
  "commands": [
    {
      "command": "getSceneInfo",
      "response": {
        "success": false,
        "error": "simulator not ready"
      }
    }
  ]
}
```

**This is NOT a bug** - game wasn't fully initialized.

**DECISION:** FRAMEWORK_ERROR

---

### 4. No Mineral Fields (Issue #4)
**Evidence shows:**
```json
{
  "command": "getSceneInfo",
  "response": {
    "success": true,
    "data": {
      "nearbyAsteroids": [],
      "totalMineralFields": 50
    }
  }
}
```

**This is WEIRD** - totalMineralFields says 50 exist but nearbyAsteroids is empty.

**Possible causes:**
1. Search radius too small (check params.maxDistance)
2. Ship spawned far from fields (check ship position)

If maxDistance < 100000 → **DECISION: FRAMEWORK_ERROR** (search radius too small)
If maxDistance > 100000 → **DECISION: BUG_CONFIRMED** (might be real bug)

---

### 5. Mining Range Issues (Issue #5)
**Evidence shows:**
```json
{
  "command": "startMining",
  "response": {
    "success": false,
    "error": "No mineral fields in range"
  }
}
```

**Check:** Did script verify distance < 500m before mining?

If no distance check found → **DECISION: FRAMEWORK_ERROR** (test didn't verify range)
If distance check shows < 500m → **DECISION: BUG_CONFIRMED** (mining should work)

---

## Verification Decision Tree

```
1. Check for echoed commands
   ↓ YES → FRAMEWORK_ERROR (Issue #1)
   ↓ NO

2. Check if commands not recognized (but exist in code)
   ↓ YES → FRAMEWORK_ERROR (Issue #2)
   ↓ NO

3. Check for "simulator not ready" errors
   ↓ YES → FRAMEWORK_ERROR (Issue #3)
   ↓ NO

4. Check if mineral fields test with small search radius
   ↓ YES (radius < 100km) → FRAMEWORK_ERROR (Issue #4)
   ↓ NO

5. Check if mining test without distance verification
   ↓ YES → FRAMEWORK_ERROR (Issue #5)
   ↓ NO

6. Check for excessive test duration (>3x expected)
   ↓ YES → FRAMEWORK_ERROR (Issue #6)
   ↓ NO

7. Analyze actual bug symptoms
   ↓ Bug reproduced → BUG_CONFIRMED
   ↓ Bug not reproduced → NOT_REPRODUCED
   ↓ Unclear → INCONCLUSIVE
```
```

---

## Summary

These updated prompts ensure all agents know about:
1. ✅ Response unwrapping
2. ✅ HTTP caching issues
3. ✅ Initialization timing
4. ✅ Mineral field locations
5. ✅ Mining range requirements
6. ✅ Performance impact of logging

**Apply these updates to the agent JSON files to fix the pipeline.**
