# CRITICAL: Correct Chrome Launch Method for Reproduction Scripts

## The Problem

The current `reproduction_creator` agent template uses **BROKEN Chrome launch method**:

```javascript
// ❌ BROKEN - DO NOT USE!
spawn('cmd.exe', [
  '/c', 'start', 'chrome',
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--user-data-dir=${profileDir}`,
  `--app=${gameUrl}`
], {detached: true, stdio: 'ignore'});
```

**Why this doesn't work:**
1. **cmd.exe /c start chrome** - Launches through Windows shell, flags get mangled
2. **{detached: true, stdio: 'ignore'}** - No process control, can't monitor
3. **--app=${gameUrl}** - App mode doesn't load game properly
4. **WSL incompatibility** - cmd.exe from WSL is unreliable
5. **Result**: Game doesn't load, console logs show only Chrome internals, no game output

## The Solution

**Use direct chrome.exe path with correct flags:**

```javascript
// ✅ CORRECT - USE THIS!
const { spawn } = require('child_process');
const timestamp = Date.now();
const profileDir = `C:\\temp\\chrome-test-${timestamp}`;
const username = process.env.USER || 'super';
const chromeLogPath = `/mnt/c/Users/${username}/AppData/Local/Temp/ChromeTest_${timestamp}/chrome_debug.log`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// CRITICAL: Cache-busting URL parameter
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn(chromePath, [
  `--user-data-dir=${profileDir}`,
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--disable-http-cache',      // CRITICAL: Disable HTTP cache
  '--disable-cache',            // CRITICAL: Disable all caches
  '--disk-cache-size=1',        // CRITICAL: Minimal disk cache
  '--aggressive-cache-discard', // CRITICAL: Aggressive cache clearing
  gameUrl                       // URL as plain argument, NO --app prefix
]);
```

**Why this works:**
1. **Direct chrome.exe** - Full process control, flags passed correctly
2. **No detached** - Can monitor and control the process
3. **Plain URL argument** - Loads game normally, not as app
4. **Cache disable flags** - Ensures fresh code loads every time
5. **Cache-busting URL** - Timestamp parameter prevents cached HTML/JS
6. **Result**: Game loads properly, console logs captured, automation works

## Critical Flags Explained

### Cache Control (MANDATORY)
```javascript
'--disable-http-cache',      // Disable HTTP-level caching
'--disable-cache',            // Disable all browser caches
'--disk-cache-size=1',        // Minimal disk cache (1 byte)
'--aggressive-cache-discard', // Aggressively discard cached content
```

**Without these**: Chrome uses cached JavaScript files, code changes don't take effect, tests use old broken code.

### Cache-Busting URL (MANDATORY)
```javascript
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;
//                                                                   ^^^^^^^^^ Timestamp
```

**Without this**: Even with cache flags, HTML file might still be cached.

### Console Logging (MANDATORY)
```javascript
'--enable-logging',  // Enable Chrome console logging
'--v=1',            // Verbose logging level 1
```

**Without these**: No chrome_debug.log file created, bug_verifier can't analyze console errors.

### Profile Directory (MANDATORY)
```javascript
`--user-data-dir=${profileDir}`,  // Fresh profile directory each run
```

**Without this**: Uses default profile, cache persists across runs, old extensions interfere.

## Complete Working Template

```javascript
#!/usr/bin/env node
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');

const WS_PORT = 8765;
const timestamp = Date.now();
const profileDir = `C:\\temp\\chrome-test-${timestamp}`;
const username = process.env.USER || 'super';
const chromeLogPath = `/mnt/c/Users/${username}/AppData/Local/Temp/ChromeTest_${timestamp}/chrome_debug.log`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let gameClient = null;
let testClient = null;
const evidence = {timestamp: new Date().toISOString(), commands: []};

// WebSocket server with response unwrapping
async function startAutomationServer() {
  return new Promise((resolve) => {
    const wss = new WebSocket.Server({ port: WS_PORT });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, 'http://localhost');
      const clientType = url.searchParams.get('client');

      if (clientType === 'game') {
        gameClient = ws;
        console.log('✓ Game connected');

        ws.on('message', (msg) => {
          if (testClient && testClient.readyState === WebSocket.OPEN) {
            // CRITICAL: Unwrap response before forwarding
            const parsed = JSON.parse(msg);
            if (parsed.type === 'response' && parsed.response) {
              testClient.send(JSON.stringify(parsed.response));
            } else {
              testClient.send(msg);
            }
          }
        });

        ws.on('close', () => {
          console.log('✗ Game disconnected');
          saveEvidence('ERROR', {error: 'Game disconnected'});
          process.exit(1);
        });

        resolve();

      } else if (clientType === 'test') {
        testClient = ws;
        console.log('✓ Test client connected');

        ws.on('message', (msg) => {
          if (gameClient && gameClient.readyState === WebSocket.OPEN) {
            gameClient.send(msg);
          }
        });
      }
    });
  });
}

// Launch Chrome correctly
async function runTest() {
  console.log('Starting WebSocket server...');
  const serverPromise = startAutomationServer();

  console.log('Launching Chrome with correct method...');

  // CRITICAL: Cache-busting URL
  const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

  // CRITICAL: Direct chrome.exe path with all cache disable flags
  spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    '--enable-logging',
    '--v=1',
    '--no-first-run',
    '--disable-http-cache',
    '--disable-cache',
    '--disk-cache-size=1',
    '--aggressive-cache-discard',
    gameUrl
  ]);

  await serverPromise;
  console.log('✓ Game connected! Waiting 10s for initialization...');
  await new Promise(r => setTimeout(r, 10000));  // 10 seconds, not 3!

  // Continue with test execution...
}

runTest();
```

## What to Update

1. **`/mnt/c/github/claudeplus/agents/reproduction_creator.json`**
   - Replace template with correct Chrome launch method
   - Add all 6 framework issues to the template
   - Update console log capture instructions

2. **Existing reproduction scripts**
   - `reproduce_instant_throttle_bug.js` - Fix Chrome launch
   - `reproduce_ship_movement_bug.js` - Fix Chrome launch
   - Any other scripts created by old template

## Verification Checklist

After updating template, verify new scripts have:
- ✅ Direct chrome.exe path (not cmd.exe)
- ✅ Cache-busting URL with timestamp
- ✅ All 4 cache disable flags
- ✅ Response unwrapping in WebSocket server
- ✅ 10-second initialization wait
- ✅ Console log capture and parsing
- ✅ Game actually loads (console logs show game output, not just Chrome internals)

## Evidence of Working Method

See `/mnt/c/github/superstarships/test_mining_automation.js` for a complete working example that:
- Uses direct chrome.exe path
- Has all cache disable flags
- Successfully mines 180 units of resources
- Captures full console logs
- All automation commands work perfectly
