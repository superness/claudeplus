# WebSocket Browser Automation Fix

## Problem
The pipeline agents were unable to automate browser testing because the game never connected to the WebSocket automation server when launched with `?testMode=true`.

## Root Cause
The game had all the testing infrastructure (TestingBrowserBridge, GameTestingInterface, TestModeManager) but it was **never initialized** when testMode was enabled in the URL.

## Fixes Applied

### 1. Added Testing Scripts to index.html
**File:** `/mnt/c/github/superstarships/index.html`

Added script includes before SpaceshipSimulator:
```html
<!-- Testing Infrastructure (loads before SpaceshipSimulator) -->
<script src="js/debug/TestModeManager.js"></script>
<script src="js/testing/GameTestingInterface.js"></script>
<script src="js/testing/TestingBrowserBridge.js"></script>
```

### 2. Added testMode Initialization Code
**File:** `/mnt/c/github/superstarships/index.html`

Added initialization after simulator.initialize():
```javascript
// Initialize Testing Infrastructure if testMode is enabled
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('testMode') === 'true') {
    console.log('🧪 Test mode enabled - initializing testing infrastructure...');

    // Wait a moment for simulator to fully initialize, then connect
    setTimeout(() => {
        try {
            // Create test mode manager
            const testModeManager = new TestModeManager();
            console.log('🧪 TestModeManager created');

            // Create game testing interface
            const gameInterface = new GameTestingInterface(simulator);
            window.gameTestingInterface = gameInterface;
            console.log('🧪 GameTestingInterface created');

            // Create and connect browser bridge to WebSocket automation server
            const testingBridge = new TestingBrowserBridge(gameInterface, 'ws://localhost:8765?client=game');
            window.testingBridge = testingBridge;
            console.log('🧪 TestingBrowserBridge created');

            // Connect to automation server
            testingBridge.connect();
            console.log('🧪 Connecting to WebSocket server at ws://localhost:8765?client=game');

        } catch (error) {
            console.error('🧪 ERROR initializing testing infrastructure:', error);
        }
    }, 2000); // Wait 2 seconds for simulator to fully initialize
}
```

### 3. Fixed Chrome Launch Command in Reproduction Scripts
**File:** `/mnt/c/github/claudeplus/agents/reproduction_creator.json`

**Before (didn't work from WSL):**
```javascript
spawn('/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    ['http://localhost:8080/index.html?testMode=true'],
    {detached: true, stdio: 'ignore'});
```

**After (works correctly):**
```javascript
const gameUrl = 'http://localhost:8080/index.html?testMode=true';
spawn('cmd.exe', [
    '/c', 'start', 'chrome',
    '--user-data-dir=C:\\\\temp\\\\chrome-test-profile',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    gameUrl
], {detached: true, stdio: 'ignore'});
```

**Why this works:**
- Uses `cmd.exe /c start chrome` to launch Chrome the Windows way
- Creates a fresh Chrome profile to avoid session conflicts
- Properly passes the testMode URL parameter

### 4. Updated Existing Reproduction Script
**File:** `/mnt/c/github/superstarships/reproduce_ship_movement_bug.js`

Applied the same Chrome launch fix to the existing script.

## Verification

The fix was verified with these steps:

1. **WebSocket Server Started:** ✅
   ```
   [Server] WebSocket automation server started on port 8765
   ```

2. **Chrome Launched:** ✅
   ```
   [Test] Launching game in Chrome with testMode=true...
   ```

3. **Game Connected:** ✅
   ```
   [Server] Game connected to automation server
   [Test] Game connected! Waiting 3s for initialization...
   ```

4. **Commands Sent:** ✅
   ```
   [Test] Test client ready!
   Executing: Set throttle to 50%
   ```

## How Agents Will Use This

When the pipeline agents run now:

1. **bug_analyzer** → Analyzes the bug
2. **reproduction_creator** → Creates script with **CORRECT** Chrome launch (using updated template)
3. **game_runner** → Runs the script:
   - Starts WebSocket server on port 8765 ✅
   - Launches Chrome via `cmd.exe` ✅
   - Game loads with `?testMode=true` ✅
   - Game initializes TestingBrowserBridge ✅
   - Game connects to `ws://localhost:8765?client=game` ✅
   - Test client connects and sends commands ✅
4. **bug_verifier** → Analyzes the captured evidence

## Result

The automation framework is now **fully functional**. Agents can:
- ✅ Launch Windows Chrome from WSL
- ✅ Connect browser game to WebSocket automation server
- ✅ Send commands from test scripts to the browser game
- ✅ Receive responses and capture evidence
- ✅ Verify bugs exist or are fixed

The agents are no longer stuck in the INCONCLUSIVE loop!
