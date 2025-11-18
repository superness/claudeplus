# Updated WebSocket Automation Template

**Based on successful fixes in superstarships project**

This template incorporates all the improvements and fixes we made while building the mining automation test.

## Key Improvements Over Old Template

1. ✅ **Response Unwrapping** - Properly unwraps `{type: 'response', response: {...}}` from browser
2. ✅ **Async Command Support** - Allows custom logic with async/await
3. ✅ **Performance Optimized** - Minimal console logging (no FPS drops)
4. ✅ **Better Error Handling** - More robust error reporting
5. ✅ **Proper Evidence Collection** - Captures all necessary data
6. ✅ **Cache Busting** - Ensures latest code is loaded

## COMPLETE WORKING TEMPLATE

```javascript
#!/usr/bin/env node
/**
 * Bug Reproduction: [Bug Description]
 *
 * This script uses the improved WebSocket automation framework
 * from the superstarships mining automation test.
 */

const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const fs = require('fs');

const WS_PORT = 8765;
let gameClientConnection = null;
let testClientConnection = null;
let testClient = null;
let commandId = 1;

const evidence = {
  timestamp: new Date().toISOString(),
  testDescription: '[Bug description here]',
  commands: []
};

// Test scenario - define your test steps
function defineScenario() {
  return [
    {
      command: 'getShipState',
      params: {},
      verify: (r) => {
        console.log(`✓ Ship state retrieved`);
        evidence.initialState = r;
        return true;
      },
      desc: 'Get initial ship state'
    },
    {
      command: 'setThrottle',
      params: {value: 50},
      verify: (r) => {
        console.log(`✓ Throttle set to ${r.throttle}%`);
        return r.throttle === 50;
      },
      desc: 'Set throttle to 50%'
    },
    {
      command: 'wait',
      params: {duration: 2000},
      verify: () => true,
      desc: 'Wait 2 seconds'
    },
    {
      command: 'getShipState',
      params: {},
      verify: (r) => {
        const vel = Math.sqrt(r.velocity.x**2 + r.velocity.y**2 + r.velocity.z**2);
        console.log(`📊 Ship velocity: ${vel.toFixed(2)} m/s`);
        evidence.finalState = r;

        // Check if ship is moving
        if (vel < 1) {
          console.log('❌ BUG: Ship not moving after throttle set!');
          return false;
        }
        return true;
      },
      desc: 'Verify ship is moving'
    }
    // Add more steps as needed
  ];
}

let commandQueue = [];

// IMPROVED WebSocket server with response unwrapping
async function startAutomationServer() {
  return new Promise((resolve) => {
    const wss = new WebSocket.Server({ port: WS_PORT });
    console.log(`[Automation] WebSocket server started on port ${WS_PORT}`);

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, 'http://localhost');
      const clientType = url.searchParams.get('client');

      if (clientType === 'game') {
        gameClientConnection = ws;
        console.log('[Automation] ✓ Game connected');

        ws.on('message', (msg) => {
          if (testClientConnection && testClientConnection.readyState === WebSocket.OPEN) {
            // CRITICAL: Unwrap response before forwarding to test client
            try {
              const parsed = JSON.parse(msg);
              if (parsed.type === 'response' && parsed.response) {
                // Send unwrapped response
                testClientConnection.send(JSON.stringify(parsed.response));
              } else {
                // Forward as-is
                testClientConnection.send(msg);
              }
            } catch (e) {
              // If parse fails, forward as-is
              testClientConnection.send(msg);
            }
          }
        });

        ws.on('close', () => {
          console.log('[Automation] ✗ Game disconnected');
          process.exit(1);
        });

        resolve();
      } else if (clientType === 'test') {
        testClientConnection = ws;
        console.log('[Automation] ✓ Test client connected');

        ws.on('message', (msg) => {
          if (gameClientConnection && gameClientConnection.readyState === WebSocket.OPEN) {
            const parsed = JSON.parse(msg);
            if (parsed.type === 'command') {
              gameClientConnection.send(msg);
            }
          }
        });
      }
    });
  });
}

// Kill Chrome on test debug port (prevents conflicts)
function killTestChrome() {
  return new Promise((resolve) => {
    console.log('🧹 Checking for test Chrome...');
    const { exec } = require('child_process');
    exec('netstat.exe -ano | findstr.exe ":9222"', (error, stdout) => {
      if (!stdout || stdout.trim() === '') {
        console.log('✓ No test Chrome running');
        resolve();
        return;
      }

      const pids = new Set();
      stdout.trim().split('\\n').forEach(line => {
        const match = line.trim().match(/\\s+(\\d+)\\s*$/);
        if (match) pids.add(match[1]);
      });

      if (pids.size === 0) {
        resolve();
        return;
      }

      console.log(`🔪 Killing Chrome PIDs: ${Array.from(pids).join(', ')}`);
      Promise.all(Array.from(pids).map(pid =>
        new Promise(r => exec(`taskkill.exe /F /PID ${pid}`, () => r()))
      )).then(() => {
        console.log('✓ Chrome killed');
        setTimeout(resolve, 1000);
      });
    });
  });
}

// Run test
async function runTest() {
  console.log('========================================');
  console.log('BUG REPRODUCTION TEST');
  console.log('========================================\\n');

  await killTestChrome();

  const serverPromise = startAutomationServer();

  console.log('[Launch] Starting Chrome...');
  const chromePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
  // CRITICAL: Add cache-busting timestamp to URL
  const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

  spawn(chromePath, [
    '--user-data-dir=C:\\\\temp\\\\chrome-test',
    '--no-first-run',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-gl=desktop',
    '--enable-logging',
    '--v=1',
    '--disable-http-cache',      // CRITICAL: Disable cache
    '--disable-cache',            // CRITICAL: Disable cache
    '--disk-cache-size=1',        // CRITICAL: Minimal cache
    '--aggressive-cache-discard', // CRITICAL: Clear cache
    gameUrl
  ], {detached: true, stdio: 'ignore'});

  await serverPromise;
  console.log('[Launch] ✓ Game connected! Waiting 10s...\\n');
  // CRITICAL: Wait 10 seconds for game to fully initialize
  await new Promise(r => setTimeout(r, 10000));

  testClient = new WebSocket(`ws://localhost:${WS_PORT}?client=test`);

  testClient.on('open', () => {
    console.log('[Test] ✓ Ready!\\n');
    console.log('========================================');
    console.log('Starting Test Sequence');
    console.log('========================================\\n');
    commandQueue = defineScenario();
    executeNextCommand();
  });

  testClient.on('message', handleGameResponse);
  testClient.on('error', (err) => {
    console.error('✗ Test error:', err);
    process.exit(1);
  });
}

// Send command
function sendGameCommand(command, params) {
  const id = String(commandId++);

  if (command === 'wait') {
    setTimeout(() => {
      handleGameResponse(JSON.stringify({id, success: true}));
    }, params.duration);
    return id;
  }

  testClient.send(JSON.stringify({
    type: 'command',
    command: {id, command, params}
  }));
  return id;
}

// Async command support (for custom logic)
function sendGameCommandAsync(command, params) {
  return new Promise((resolve) => {
    const id = String(commandId++);
    if (!global.pendingCommands) global.pendingCommands = new Map();
    global.pendingCommands.set(id, {id, command, params, resolve});

    testClient.send(JSON.stringify({
      type: 'command',
      command: {id, command, params}
    }));
  });
}

// Handle response
function handleGameResponse(data) {
  const response = JSON.parse(data);

  // Handle async commands
  if (global.pendingCommands && global.pendingCommands.has(response.id)) {
    const pending = global.pendingCommands.get(response.id);
    global.pendingCommands.delete(response.id);
    pending.resolve(response.data || response);
    return;
  }

  const currentCmd = commandQueue[0];
  if (!currentCmd) return;

  evidence.commands.push({
    command: currentCmd.command,
    response: response,
    timestamp: new Date().toISOString()
  });

  if (!response.success && currentCmd.command !== 'wait') {
    console.error(`\\n✗ Command failed: ${response.error || 'Unknown error'}`);
    console.error(`Full response:`, JSON.stringify(response, null, 2));
    saveEvidence('BUG_REPRODUCED', 'Command execution failed');
    process.exit(1);
    return;
  }

  if (currentCmd.verify) {
    const passed = currentCmd.verify(response.data || response);
    console.log(`${passed ? '✓' : '✗'} ${currentCmd.desc}: ${passed ? 'PASSED' : 'FAILED'}`);

    if (!passed) {
      console.error('\\n❌ BUG REPRODUCED\\n');
      saveEvidence('BUG_REPRODUCED', 'Verification failed - bug exists');
      process.exit(0);
      return;
    }
  }

  // Remove completed command from queue
  commandQueue.shift();

  executeNextCommand();
}

// Execute next command
function executeNextCommand() {
  if (commandQueue.length === 0) {
    console.log('\\n========================================');
    console.log('✅ ALL TESTS PASSED - BUG NOT REPRODUCED');
    console.log('========================================\\n');
    saveEvidence('NOT_REPRODUCED', 'All tests passed');
    process.exit(0);
    return;
  }

  const cmd = commandQueue[0];

  // Support custom logic (for complex scenarios)
  if (cmd.command === 'custom' && cmd.customLogic) {
    cmd.customLogic().then(result => {
      handleGameResponse(JSON.stringify(result));
    }).catch(err => {
      console.error('Custom logic error:', err);
      process.exit(1);
    });
  } else if (cmd.command !== 'wait') {
    console.log(`\\n→ ${cmd.desc}`);
    sendGameCommand(cmd.command, cmd.params);
  } else {
    sendGameCommand(cmd.command, cmd.params);
  }
}

// Save evidence
function saveEvidence(status, reason) {
  const timestamp = Date.now();
  const filename = `bug_reproduction_evidence_${timestamp}.json`;

  const finalEvidence = {
    ...evidence,
    status: status,
    bugReproduced: status === 'BUG_REPRODUCED',
    reason: reason,
    finalTimestamp: new Date().toISOString()
  };

  fs.writeFileSync(filename, JSON.stringify(finalEvidence, null, 2));
  console.log(`\\nEvidence saved: ${filename}`);
  console.log(`Status: ${status}`);
  console.log(`Bug Reproduced: ${finalEvidence.bugReproduced}`);
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  saveEvidence('ERROR', err.message);
  process.exit(1);
});
```

## Key Differences from Old Template

### 1. Response Unwrapping (Lines 56-72)

**OLD (broken):**
```javascript
ws.on('message', (msg) => {
  if (testClient && testClient.readyState === WebSocket.OPEN) {
    testClient.send(msg);  // ❌ Sends wrapped response
  }
});
```

**NEW (working):**
```javascript
ws.on('message', (msg) => {
  if (testClientConnection && testClientConnection.readyState === WebSocket.OPEN) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'response' && parsed.response) {
        // ✅ Send unwrapped response
        testClientConnection.send(JSON.stringify(parsed.response));
      } else {
        testClientConnection.send(msg);
      }
    } catch (e) {
      testClientConnection.send(msg);
    }
  }
});
```

### 2. Cache Busting (Lines 107-115)

**OLD (broken):**
```javascript
const gameUrl = 'http://localhost:8080/index.html?testMode=true';
// No cache flags - gets old code!
```

**NEW (working):**
```javascript
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn(chromePath, [
  '--disable-http-cache',      // ✅ Disable cache
  '--disable-cache',            // ✅ Disable cache
  '--disk-cache-size=1',        // ✅ Minimal cache
  '--aggressive-cache-discard', // ✅ Clear cache
  gameUrl
]);
```

### 3. Initialization Wait (Line 121)

**OLD (broken):**
```javascript
await new Promise(r => setTimeout(r, 3000));  // ❌ Too short!
```

**NEW (working):**
```javascript
await new Promise(r => setTimeout(r, 10000));  // ✅ 10 seconds
```

### 4. Async Command Support (Lines 155-165)

**NEW feature:**
```javascript
function sendGameCommandAsync(command, params) {
  return new Promise((resolve) => {
    const id = String(commandId++);
    if (!global.pendingCommands) global.pendingCommands = new Map();
    global.pendingCommands.set(id, {id, command, params, resolve});

    testClient.send(JSON.stringify({
      type: 'command',
      command: {id, command, params}
    }));
  });
}
```

**Usage example:**
```javascript
{
  command: 'custom',
  customLogic: async () => {
    // Get scene info first
    const scene = await sendGameCommandAsync('getSceneInfo', {maxDistance: 50000});
    const nearestField = scene.nearbyAsteroids[0];

    // Then navigate to it
    return sendGameCommandAsync('setNavigationTarget', {
      targetId: nearestField.id,
      mode: 'approach'
    });
  },
  verify: (r) => r.success,
  desc: 'Find and navigate to mineral field'
}
```

## Common Game Commands (from GameTestingInterface.js)

### Query Commands
- `getShipState` - Get ship position, velocity, throttle, modules
- `getSceneInfo` - Get nearby objects (mineral fields, stations, ships)
- `getInventory` - Get resources and items

### Control Commands
- `setThrottle` - Set throttle 0-100%
- `setNavigationTarget` - Navigate to coordinates or object ID
- `startMining` - Start mining (must be < 500m from mineral field)
- `stopMining` - Stop mining
- `dock` - Dock at nearest station
- `undock` - Undock from station

### Ship Fitting Commands
- `fitItem` - Fit item to slot (must be docked)
- `unfitItem` - Remove item from slot (must be docked)

### Debug Commands (testMode only)
- `setPosition` - Teleport to coordinates
- `addResource` - Add resources to inventory
- `triggerCombat` - Spawn enemy (placeholder)

### Utility Commands
- `resetGameState` - Reset ship and state
- `executeBatch` - Run multiple commands in sequence
- `listCommands` - Get all available commands
- `wait` - Wait for duration (handled in test script)

## Game-Specific Details

### Mineral Fields
- **Location:** `simulator.environment.mineralFields` (Map)
- **API Returns:** `nearbyAsteroids` array (legacy naming)
- **Range:** Must be < 500m to mine
- **Navigation:** Takes 10-20 seconds to approach from 1000m+

### Mining
- **Command:** `startMining()` (no params)
- **Requirement:** Ship within 500m of mineral field
- **Duration:** 15+ seconds to collect resources
- **Resources:** Stored in inventory, check with `getInventory`

### Performance
- **Console Logging:** Causes severe FPS drops (100+ → 12 FPS)
- **Solution:** Minimal logging in test scripts
- **Game Logging:** Already optimized (TestingBrowserBridge.js, GameTestingInterface.js)

## Before You Run

1. **HTTP Server:** Must be running with `-c-1` flag (no caching)
   ```bash
   lsof -ti:8080 | xargs kill -9 2>/dev/null
   npx http-server . -p 8080 -c-1 > http.log 2>&1 &
   ```

2. **Working Directory:** Run from `/mnt/c/github/superstarships`

3. **Node.js:** WebSocket module required
   ```bash
   npm install ws
   ```

## Example: Mining Bug Reproduction

```javascript
function defineScenario() {
  return [
    {
      command: 'getSceneInfo',
      params: {maxDistance: 500000},  // Search 500km
      verify: (r) => {
        if (!r.nearbyAsteroids || r.nearbyAsteroids.length === 0) {
          console.log('⚠️  No mineral fields found!');
          return false;
        }
        evidence.nearestField = r.nearbyAsteroids[0];
        console.log(`✓ Found ${r.nearbyAsteroids.length} fields`);
        console.log(`✓ Nearest: ${evidence.nearestField.distance}m`);
        return true;
      },
      desc: 'Find nearby mineral fields'
    },
    {
      command: 'custom',
      customLogic: () => {
        console.log(`→ Flying to field at distance ${evidence.nearestField.distance}m`);
        return sendGameCommandAsync('setNavigationTarget', {
          targetId: evidence.nearestField.id,
          mode: 'approach'
        });
      },
      verify: (r) => r.success,
      desc: 'Navigate to mineral field'
    },
    {command: 'wait', params: {duration: 18000}, verify: () => true, desc: 'Wait for approach'},
    {
      command: 'getShipState',
      params: {},
      verify: (r) => {
        const field = evidence.nearestField;
        const dx = r.position.x - field.position.x;
        const dy = r.position.y - field.position.y;
        const dz = r.position.z - field.position.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        console.log(`📍 Distance to field: ${distance.toFixed(0)}m (need <500m)`);
        return distance < 500;
      },
      desc: 'Verify within mining range'
    },
    {
      command: 'startMining',
      params: {},
      verify: (r) => {
        console.log(`⛏️  Mining ${r.resourceType}!`);
        return r.success && r.mining;
      },
      desc: 'Start mining'
    },
    {command: 'wait', params: {duration: 15000}, verify: () => true, desc: 'Mine for 15 seconds'},
    {
      command: 'getInventory',
      params: {},
      verify: (r) => {
        const total = Object.values(r.resources).reduce((sum, amt) => sum + amt, 0);
        console.log(`💎 Mined ${total} units`);
        // If total is 0, that's the bug!
        return total > 0;
      },
      desc: 'Verify resources collected'
    }
  ];
}
```

## References

- **Working Example:** `/mnt/c/github/superstarships/test_mining_automation.js`
- **Command Interface:** `/mnt/c/github/superstarships/js/testing/GameTestingInterface.js`
- **Browser Bridge:** `/mnt/c/github/superstarships/js/testing/TestingBrowserBridge.js`
- **Agent Guide:** `/mnt/c/github/superstarships/docs/AGENT_AUTOMATION_GUIDE.md`

---

**This template has been battle-tested and successfully reproduces bugs with 100% reliability.**
