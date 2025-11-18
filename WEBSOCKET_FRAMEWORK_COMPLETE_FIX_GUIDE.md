# WebSocket Framework - Complete Fix Guide for Pipeline Agents

**Based on successful mining automation implementation in superstarships**

The pipeline agents have fixed response unwrapping, but there are 6 MORE critical issues that need fixing.

## Status of Pipeline (from current.json)

- ✅ **bug_analysis** - Complete
- ✅ **create_reproduction** - Created script
- ❌ **run_reproduction** - FRAMEWORK_ERROR (response unwrapping)
- ✅ **fix_automation_framework** - Fixed response unwrapping
- ❌ **run_reproduction** (retry) - Currently running
- ❓ **fix_automation_framework** (retry) - May fail again due to other issues

## 6 Critical Issues Beyond Response Unwrapping

### ✅ Issue #1: Response Unwrapping (ALREADY FIXED)

**Status:** Fixed by automation_framework_fixer agent

**What was fixed:**
```javascript
// Game client handler now unwraps responses
ws.on('message', (msg) => {
  const parsed = JSON.parse(msg);
  if (parsed.type === 'response' && parsed.response) {
    testClientConnection.send(JSON.stringify(parsed.response));
  }
});
```

---

### ❌ Issue #2: HTTP Server Caching (NOT FIXED YET)

**Problem:** HTTP server caches JavaScript files, so updated code doesn't load.

**Symptom:**
- Code changes in `js/testing/` don't take effect
- Old bugs remain after fixes
- "Command not recognized" errors for new commands

**Fix Required:**

1. **Kill existing HTTP server:**
```bash
lsof -ti:8080 | xargs kill -9 2>/dev/null
```

2. **Start with `-c-1` flag (disable caching):**
```bash
npx http-server . -p 8080 -c-1 > http.log 2>&1 &
```

3. **Add cache-busting URL parameter:**
```javascript
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;
```

4. **Add Chrome cache flags:**
```javascript
spawn(chromePath, [
  '--disable-http-cache',
  '--disable-cache',
  '--disk-cache-size=1',
  '--aggressive-cache-discard',
  gameUrl
]);
```

**Where to fix:**
- `game_runner` agent needs to check HTTP server before running tests
- `reproduction_creator` template needs cache flags

---

### ❌ Issue #3: Game Initialization Wait Time (NOT FIXED YET)

**Problem:** 3 seconds is not enough for game to fully initialize.

**Symptom:**
- Commands fail with "simulator not ready"
- Mineral fields not generated yet
- WebSocket connects but game state is empty

**Current (broken):**
```javascript
await new Promise(r => setTimeout(r, 3000));  // Too short!
```

**Fix Required:**
```javascript
await new Promise(r => setTimeout(r, 10000));  // 10 seconds
```

**Where to fix:** `reproduction_creator` template

---

### ❌ Issue #4: Mineral Field Location (NOT FIXED YET)

**Problem:** Scripts look for mineral fields in wrong location.

**Current (broken):**
```javascript
const fields = simulator.mineralFieldManager?.mineralFields;  // ❌ Doesn't exist
```

**Fix Required:**
```javascript
const fields = simulator.environment?.mineralFields;  // ✅ Correct location
```

**API returns:** `nearbyAsteroids` array (legacy naming, actually mineral fields)

**Example:**
```javascript
{
  command: 'getSceneInfo',
  params: {maxDistance: 500000},  // Search 500km
  verify: (r) => {
    // nearbyAsteroids contains mineral fields
    if (!r.nearbyAsteroids || r.nearbyAsteroids.length === 0) {
      console.log('No mineral fields found');
      return false;
    }
    evidence.nearestField = r.nearbyAsteroids[0];
    return true;
  }
}
```

**Where to fix:**
- `reproduction_creator` needs to know correct API
- `bug_verifier` needs to understand mineral fields

---

### ❌ Issue #5: Mining Range Requirement (NOT DOCUMENTED)

**Problem:** Scripts don't know mining requires < 500m range.

**Symptom:**
- `startMining` fails with "No mineral fields in range"
- Ship at 600m+ distance

**Fix Required:**

1. **Navigate to mineral field:**
```javascript
{
  command: 'setNavigationTarget',
  params: {
    targetId: mineralField.id,
    mode: 'approach'
  }
}
```

2. **Wait for approach (18+ seconds from 1000m):**
```javascript
{command: 'wait', params: {duration: 18000}}
```

3. **Verify distance < 500m:**
```javascript
{
  command: 'getShipState',
  verify: (r) => {
    const dx = r.position.x - field.position.x;
    const dy = r.position.y - field.position.y;
    const dz = r.position.z - field.position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    return distance < 500;  // Must be < 500m
  }
}
```

4. **Then start mining:**
```javascript
{command: 'startMining', params: {}}
```

**Where to fix:** `reproduction_creator` template needs mining workflow

---

### ❌ Issue #6: Performance - Console Logging (NOT FIXED YET)

**Problem:** Excessive console.log statements cause severe FPS drops.

**Symptom:**
- Game runs at 12 FPS instead of 100+ FPS
- Tests take 3x longer
- Browser becomes sluggish

**Files already optimized (don't touch):**
- ✅ `js/testing/TestingBrowserBridge.js` - Logging removed
- ✅ `js/testing/GameTestingInterface.js` - Logging removed

**What reproduction scripts should NOT do:**
```javascript
// ❌ BAD - logs every message
ws.on('message', (msg) => {
  console.log('[Server] Received:', msg);
  console.log('[Server] Parsed:', JSON.parse(msg));
  console.log('[Server] Forwarding...');
  // ... 10 more logs
});
```

**What reproduction scripts SHOULD do:**
```javascript
// ✅ GOOD - only log errors
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

**Where to fix:** `reproduction_creator` template needs minimal logging

---

## Complete Checklist for automation_framework_fixer Agent

When you encounter FRAMEWORK_ERROR, check ALL of these:

- [ ] **Response unwrapping** - Is server unwrapping responses?
- [ ] **HTTP server caching** - Is server running with `-c-1`?
- [ ] **Cache-busting URL** - Does game URL have `?t=${Date.now()}`?
- [ ] **Chrome cache flags** - Does Chrome have `--disable-http-cache`?
- [ ] **Init wait time** - Is script waiting 10 seconds after game connects?
- [ ] **Mineral field location** - Is script using `nearbyAsteroids` from `getSceneInfo`?
- [ ] **Mining range** - Is script checking distance < 500m before mining?
- [ ] **Console logging** - Is script using minimal logging (errors only)?

## Updated Reproduction Script Template

The complete working template is in `/mnt/c/github/claudeplus/UPDATED_REPRODUCTION_TEMPLATE.md`.

Key improvements:
1. ✅ Response unwrapping in WebSocket server
2. ✅ Cache-busting URL parameter
3. ✅ Chrome cache disable flags
4. ✅ 10-second initialization wait
5. ✅ Async command support for complex workflows
6. ✅ Minimal console logging (errors only)

## Game Command Reference

### Available Commands (from GameTestingInterface.js)

**Query Commands:**
- `getShipState` - Position, velocity, throttle, modules
- `getSceneInfo` - Nearby objects (mineral fields, stations, ships)
  - Returns `nearbyAsteroids` array (actually mineral fields!)
  - Must specify `maxDistance` param (e.g., 500000 for 500km)
- `getInventory` - Resources and items

**Control Commands:**
- `setThrottle` - Set throttle 0-100%
- `setNavigationTarget` - Navigate to coordinates or object ID
  - Use `targetId` for objects (mineral fields, stations)
  - Use `mode: 'approach'` to get within mining range
- `startMining` - Start mining (requires < 500m distance)
- `stopMining` - Stop mining
- `dock` - Dock at nearest station
- `undock` - Undock from station

**Fitting Commands (must be docked):**
- `fitItem` - Fit item to slot
- `unfitItem` - Remove item from slot

**Debug Commands:**
- `setPosition` - Teleport to coordinates
- `addResource` - Add resources to inventory
- `resetGameState` - Reset ship and state

### Command NOT in API: `wait`

The `wait` command is handled in the test script, not the game:

```javascript
function sendGameCommand(command, params) {
  const id = String(commandId++);

  if (command === 'wait') {
    // Handle in test script
    setTimeout(() => {
      handleGameResponse(JSON.stringify({id, success: true}));
    }, params.duration);
    return id;
  }

  // Send to game
  testClient.send(JSON.stringify({
    type: 'command',
    command: {id, command, params}
  }));
  return id;
}
```

## Common Test Patterns

### Pattern 1: Find Mineral Fields

```javascript
{
  command: 'getSceneInfo',
  params: {maxDistance: 500000},  // 500km search radius
  verify: (r) => {
    if (!r.nearbyAsteroids || r.nearbyAsteroids.length === 0) {
      console.log('❌ No mineral fields found');
      return false;
    }
    evidence.nearestField = r.nearbyAsteroids[0];
    console.log(`✓ Found ${r.nearbyAsteroids.length} fields`);
    console.log(`✓ Nearest: ${evidence.nearestField.distance}m`);
    return true;
  },
  desc: 'Find nearby mineral fields'
}
```

### Pattern 2: Navigate and Mine

```javascript
[
  // 1. Navigate to mineral field
  {
    command: 'custom',
    customLogic: () => {
      return sendGameCommandAsync('setNavigationTarget', {
        targetId: evidence.nearestField.id,
        mode: 'approach'
      });
    },
    verify: (r) => r.success,
    desc: 'Navigate to mineral field'
  },

  // 2. Wait for approach (from 1000m+ takes 18+ seconds)
  {command: 'wait', params: {duration: 18000}, verify: () => true, desc: 'Wait for approach'},

  // 3. Verify within mining range
  {
    command: 'getShipState',
    verify: (r) => {
      const field = evidence.nearestField;
      const dx = r.position.x - field.position.x;
      const dy = r.position.y - field.position.y;
      const dz = r.position.z - field.position.z;
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

      console.log(`📍 Distance: ${distance.toFixed(0)}m (need <500m)`);
      return distance < 500;
    },
    desc: 'Verify within mining range'
  },

  // 4. Start mining
  {
    command: 'startMining',
    verify: (r) => {
      console.log(`⛏️  Mining ${r.resourceType}!`);
      return r.success && r.mining;
    },
    desc: 'Start mining'
  },

  // 5. Wait for resources (15+ seconds)
  {command: 'wait', params: {duration: 15000}, verify: () => true, desc: 'Mine for 15 seconds'},

  // 6. Check resources collected
  {
    command: 'getInventory',
    verify: (r) => {
      const total = Object.values(r.resources).reduce((sum, amt) => sum + amt, 0);
      console.log(`💎 Mined ${total} units`);
      return total > 0;  // Bug if 0!
    },
    desc: 'Verify resources collected'
  }
]
```

### Pattern 3: Test Ship Movement (Instant Throttle Bug)

```javascript
[
  {command: 'getShipState', params: {}, verify: (r) => true, desc: 'Get initial state'},
  {command: 'setThrottle', params: {value: 50}, verify: (r) => r.throttle === 50, desc: 'Set throttle to 50%'},
  {command: 'wait', params: {duration: 100}, verify: () => true, desc: 'Wait 100ms'},
  {
    command: 'getShipState',
    verify: (r) => {
      const vel = Math.sqrt(r.velocity.x**2 + r.velocity.y**2 + r.velocity.z**2);
      const maxVel = 100;  // Example max velocity
      const percentOfMax = (vel / maxVel) * 100;

      console.log(`Velocity after 100ms: ${vel.toFixed(2)} m/s (${percentOfMax.toFixed(1)}% of max)`);

      // Bug: Ship instantly at >80% of target speed
      if (percentOfMax > 80) {
        console.log('❌ BUG: Ship instantly jumped to throttle speed!');
        return false;
      }

      // Expected: Ship at 10-30% of target (exponential acceleration)
      return true;
    },
    desc: 'Check if ship instantly jumped to speed'
  }
]
```

## Environment Setup Script for game_runner Agent

Before running ANY reproduction script, the `game_runner` agent should run this:

```bash
#!/bin/bash
# Prepare test environment

echo "🧹 Cleaning up old processes..."

# Kill any Chrome on test ports
netstat.exe -ano | findstr.exe ":9222" | awk '{print $NF}' | sort -u | xargs -I {} taskkill.exe /F /PID {}

# Kill HTTP server on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null

echo "✓ Cleanup complete"
echo ""
echo "🚀 Starting HTTP server with NO CACHING..."

# Start HTTP server with cache disabled
cd /mnt/c/github/superstarships
npx http-server . -p 8080 -c-1 > http.log 2>&1 &

# Wait for server to start
sleep 3

# Verify server is running
if curl -I http://localhost:8080/ 2>&1 | head -1 | grep -q "200"; then
  echo "✓ HTTP server running on port 8080"
else
  echo "❌ HTTP server failed to start"
  exit 1
fi

echo ""
echo "✅ Environment ready for testing"
echo ""
```

**Save this as:** `/mnt/c/github/superstarships/setup_test_environment.sh`

**Run before each test:**
```bash
bash setup_test_environment.sh && node reproduce_[bug_name].js
```

## Testing the Fixes

After applying all 6 fixes, the test should:

1. ✅ HTTP server starts with no caching
2. ✅ Chrome launches with cache disabled
3. ✅ Game connects after 10-second wait
4. ✅ Commands execute and return game data
5. ✅ Mineral fields found in correct location
6. ✅ Navigation and mining work correctly
7. ✅ Performance remains good (100+ FPS)
8. ✅ Evidence collected with all data

## Success Criteria

**BEFORE fixes:**
- ❌ Commands echoed back (response unwrapping issue)
- ❌ Old code runs after updates (caching issue)
- ❌ Commands fail too early (init wait issue)
- ❌ No mineral fields found (location issue)
- ❌ Mining fails (range issue)
- ❌ Game sluggish (logging issue)

**AFTER all 6 fixes:**
- ✅ Commands execute and return game data
- ✅ Code updates take effect immediately
- ✅ Game fully initialized before commands
- ✅ Mineral fields found and accessible
- ✅ Mining works when within range
- ✅ Game runs at 100+ FPS

## References

**Working Examples:**
- `/mnt/c/github/superstarships/test_mining_automation.js` - Complete working test
- `/mnt/c/github/superstarships/reproduce_ship_movement_bug_v4_fixed.js` - Fixed reproduction script

**Documentation:**
- `/mnt/c/github/superstarships/docs/AGENT_AUTOMATION_GUIDE.md` - Complete agent guide
- `/mnt/c/github/claudeplus/UPDATED_REPRODUCTION_TEMPLATE.md` - Updated template with all fixes

**Game Code:**
- `/mnt/c/github/superstarships/js/testing/GameTestingInterface.js` - All available commands
- `/mnt/c/github/superstarships/js/testing/TestingBrowserBridge.js` - Browser WebSocket bridge

---

**All 6 issues must be fixed for reliable automated bug reproduction.**
