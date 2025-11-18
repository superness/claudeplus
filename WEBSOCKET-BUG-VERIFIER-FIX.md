# WebSocket Bug Verifier Connection Issue - Root Cause & Fix

## Problem Summary

The `bug_verifier` agent's reproduction scripts were failing with `ECONNREFUSED` errors when trying to connect to the game's WebSocket automation server on port 8765.

**Error from execution logs:**
```json
{
  "error": "connect ECONNREFUSED 127.0.0.1:8765",
  "status": "ERROR",
  "stateSnapshots": [],
  "commands": []
}
```

## Root Cause

**The WebSocket automation server DID NOT EXIST.**

The game has client-side code (`TestingBrowserBridge.js`) that attempts to connect to a WebSocket server on port 8765, but there was no actual server running. The documentation incorrectly suggested the game would start its own WebSocket server.

### Actual Architecture

```
Test Script (Node.js)  ----\
                            \
                             --> WebSocket Server (Port 8765) <-- Game (Browser)
                            /
Other Test Scripts   ------/
```

- The **game is a WebSocket CLIENT** (not a server)
- A separate **Node.js WebSocket SERVER** must be running on port 8765
- Test scripts also connect as clients to this same server
- The server acts as a message broker between test scripts and the game

### What Was Happening

The `reproduction_creator` agent was generating scripts that:
1. ✅ Launched Chrome to open the game
2. ✅ Game loaded successfully
3. ❌ Tried to connect to ws://localhost:8765
4. ❌ Got ECONNREFUSED because **no WebSocket server was running**

The game code (`TestingBrowserBridge.js`) was also trying to connect to ws://localhost:8765 and failing silently.

## The Fix

### Created WebSocket Server

**File:** `/mnt/c/github/superstarships/websocket-test-server.js`

This is the missing piece - a Node.js WebSocket server that:
1. Listens on port 8765
2. Accepts connections from both the game (browser) and test scripts
3. Routes commands from test scripts to the game
4. Routes responses from the game back to test scripts

### Complete Setup

**Terminal 1: Start Game Dev Server**
```bash
cd /mnt/c/github/superstarships
npm run dev
# Starts on http://localhost:8080
```

**Terminal 2: Start WebSocket Server**
```bash
cd /mnt/c/github/superstarships
node websocket-test-server.js
# Starts on ws://localhost:8765
```

**Terminal 3: Open Game in Browser**
```bash
# Option 1: Manual
# Open http://localhost:8080/index.html?testMode=true

# Option 2: From WSL
/mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe http://localhost:8080/index.html?testMode=true
```

**Terminal 4: Run Test Script**
```bash
cd /mnt/c/github/superstarships
node test-websocket-automation.js
```

## How It Works

### 1. WebSocket Server (Port 8765)

```javascript
// Acts as message broker
wss.on('connection', (ws) => {
  // Game registers as 'browser' client
  // Test scripts register as 'test' clients

  // Commands flow: test -> server -> browser
  // Responses flow: browser -> server -> test
});
```

### 2. Game (Browser Client)

```javascript
// In index.html with ?testMode=true
// TestingBrowserBridge.js automatically connects to ws://localhost:8765
const bridge = new TestingBrowserBridge(gameInterface, 'ws://localhost:8765');
bridge.connect();  // Registers as 'browser' client
```

### 3. Test Scripts (Node.js Clients)

```javascript
// Connect to server
const ws = new WebSocket('ws://localhost:8765');

// Register as test client
ws.send(JSON.stringify({
  type: 'register',
  clientType: 'test'
}));

// Send command
ws.send(JSON.stringify({
  type: 'command',
  command: {
    id: 'cmd-1',
    command: 'getShipState',
    params: {}
  }
}));

// Receive response
ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.type === 'response') {
    console.log(response.response.data);
  }
});
```

## Test It Works

**File:** `/mnt/c/github/superstarships/test-websocket-automation.js`

Run the complete end-to-end test:

```bash
# Ensure all 3 services are running:
# 1. npm run dev (port 8080)
# 2. node websocket-test-server.js (port 8765)
# 3. Game open in browser with ?testMode=true

# Then run test:
node test-websocket-automation.js
```

**Expected Output:**
```
✅ Connected to WebSocket server
✅ GAME CONNECTED!
→ Sending command: getShipState (ID: cmd-1)
← Response received for command ID: cmd-1
   Success: true
   Data: { position: {...}, velocity: {...}, ... }
✅ First command successful!
🎉 TEST PASSED: WebSocket automation working!
```

## Impact on bug_verifier Agent

The `reproduction_creator` and `game_runner` agents need to be updated to:

### Critical Changes Required

1. **Start WebSocket Server First**
   ```javascript
   // Launch the WebSocket server before any tests
   const server = spawn('node', ['websocket-test-server.js'], {
     cwd: '/mnt/c/github/superstarships',
     detached: true
   });
   // Wait for server to start
   await sleep(2000);
   ```

2. **Launch Game with testMode**
   ```javascript
   // CORRECT: Use dev server with testMode
   const gameUrl = 'http://localhost:8080/index.html?testMode=true';
   spawn(CHROME_PATH, ['--new-window', gameUrl]);
   ```

3. **Register Test Scripts Properly**
   ```javascript
   // Connect to server
   const ws = new WebSocket('ws://localhost:8765');

   // MUST register as test client first
   ws.on('open', () => {
     ws.send(JSON.stringify({
       type: 'register',
       clientType: 'test',
       timestamp: Date.now()
     }));
   });
   ```

4. **Wait for Game Connection**
   ```javascript
   // Listen for game_connected event before sending commands
   ws.on('message', (data) => {
     const msg = JSON.parse(data);
     if (msg.type === 'game_connected') {
       // Now safe to send commands
       sendTestCommand();
     }
   });
   ```

## Alternative: Browser Console Method

For simpler testing, the game can be controlled directly via browser console without WebSocket:

```javascript
// No WebSocket needed - direct access to game
const sim = window.simulator;

// Check ship state
console.log(sim.ship.position);
console.log(sim.ship.velocity);

// Control ship
sim.ship.position.set(1000, 0, 0);
sim.navigationManager.setTarget(x, y, z);

// Dock/undock
sim.stationManager.requestDock(stationId);
sim.stationManager.undock();
```

This method:
- ✅ No WebSocket setup required
- ✅ No testMode required
- ✅ Works immediately after game loads
- ✅ Full access to all game systems
- ❌ Requires manual interaction (can't be fully automated)

## Recommendation

For the `bug_verifier` agent:

- **Use Browser Console method** for manual reproduction and debugging
- **Use WebSocket API method** only when full automation is required
- **Update agent prompts** to include proper testMode setup instructions
- **Add retry logic** for WebSocket connections (game load time varies)

## Files Created

1. **`/mnt/c/github/superstarships/websocket-test-server.js`**
   - WebSocket server that acts as message broker
   - Handles connections from both game and test scripts
   - Routes commands and responses between clients

2. **`/mnt/c/github/superstarships/test-websocket-automation.js`**
   - End-to-end test demonstrating working automation
   - Registers as test client properly
   - Waits for game connection before sending commands

3. **`/mnt/c/github/claudeplus/WEBSOCKET-BUG-VERIFIER-FIX.md`**
   - This document explaining the issue and solution

## Currently Running Services

As of this session, the following are running:
- ✅ Game dev server: `npm run dev` (port 8080)
- ✅ WebSocket server: `node websocket-test-server.js` (port 8765)

## Next Steps for bug_verifier Pipeline

1. **Update agent prompts** to include WebSocket server setup:
   - `reproduction_creator` agent: Include server startup in scripts
   - `game_runner` agent: Start server before running tests

2. **Modify agent templates** (`agents/reproduction_creator.json`, `agents/game_runner.json`):
   - Add WebSocket server as prerequisite
   - Include proper client registration code
   - Wait for game_connected event

3. **Test the full pipeline** with updated agents:
   ```bash
   # Start pipeline with bug-fix-v1 template
   # Verify reproduction scripts now work
   ```

4. **Alternative: Use Browser Console method** for simpler cases:
   - No WebSocket server needed
   - Direct access via `window.simulator`
   - Better for manual bug reproduction

## Proof of Concept Status

✅ **PROVEN**: The WebSocket automation CAN work when properly set up

The issue was not with the test scripts themselves, but with the missing WebSocket server infrastructure. Now that the server exists and test scripts register properly, the automation framework is functional.
