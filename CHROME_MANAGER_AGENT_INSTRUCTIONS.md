# ChromeManager - Agent Instructions for Reproduction Scripts

## CRITICAL: Always Use ChromeManager

**NEVER spawn Chrome directly!** Always use the ChromeManager module.

ChromeManager is located at `/mnt/c/github/superstarships/lib/ChromeManager.js` and handles:
- ✅ Correct chrome.exe path
- ✅ All required flags (cache disable, logging, etc.)
- ✅ Cache-busting URL timestamps
- ✅ Process lifecycle management
- ✅ Console log parsing
- ✅ Cleanup and error handling

## How to Use ChromeManager in Reproduction Scripts

### 1. Import ChromeManager

```javascript
const ChromeManager = require('./lib/ChromeManager');

// Create instance (uses sensible defaults)
const chrome = new ChromeManager();

// Or customize:
const chrome = new ChromeManager({
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  username: 'super',  // For console log path
  baseUrl: 'http://localhost:8080'
});
```

### 2. Launch Chrome

```javascript
// Launch with all correct flags automatically
await chrome.launch({
  url: '/index.html',       // Relative to baseUrl
  testMode: true           // Adds ?testMode=true
});

// This automatically:
// - Kills old Chrome processes on port 9222
// - Adds cache-busting timestamp (&t=<timestamp>)
// - Uses direct chrome.exe path
// - Applies all cache disable flags
// - Enables console logging
// - Waits for chrome_debug.log to be created
```

### 3. Wait for Game to Initialize

```javascript
// Wait 10 seconds for game to fully initialize (REQUIRED!)
await chrome.waitForReady(10);
```

### 4. Parse Console Logs

```javascript
// Get parsed console logs at any time
const consoleData = chrome.parseConsoleLogs();

// consoleData includes:
// - logFile: WSL path to chrome_debug.log
// - windowsPath: Windows path to chrome_debug.log
// - consoleLogs: Array of parsed log entries
// - consoleErrorCount: Number of errors
// - consoleExceptionCount: Number of exceptions
```

### 5. Get Console Summary

```javascript
// Print console log summary
chrome.getConsoleSummary();

// Output:
// [ChromeManager] Console Log Summary:
//   File: C:\Users\super\AppData\Local\Temp\ChromeTest_1763400000000\chrome_debug.log
//   Total lines: 1523
//   Console entries: 47
//   Errors: 2
//   Exceptions: 1
```

### 6. Cleanup

```javascript
// Kill Chrome and cleanup
await chrome.kill();
```

## Complete Reproduction Script Template Using ChromeManager

```javascript
#!/usr/bin/env node
const WebSocket = require('ws');
const ChromeManager = require('./lib/ChromeManager');
const fs = require('fs');

const WS_PORT = 8765;
let gameClient = null;
let testClient = null;
let commandId = 1;
let commandQueue = [];
const evidence = { timestamp: new Date().toISOString(), commands: [] };

// Initialize ChromeManager
const chrome = new ChromeManager();

// Define test scenario
function defineScenario() {
  return [
    {
      command: 'getShipState',
      params: {},
      verify: (r) => {
        console.log(`  Initial state captured`);
        return true;
      },
      desc: 'Get initial ship state'
    },
    // ... more test steps
  ];
}

// Start WebSocket server
async function startAutomationServer() {
  return new Promise((resolve) => {
    const wss = new WebSocket.Server({ port: WS_PORT });
    console.log(`WebSocket server started on port ${WS_PORT}`);

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, 'http://localhost');
      const clientType = url.searchParams.get('client');

      if (clientType === 'game') {
        gameClient = ws;
        console.log('✓ Game connected');

        ws.on('message', (msg) => {
          if (testClient && testClient.readyState === WebSocket.OPEN) {
            // CRITICAL: Unwrap response
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
          cleanup();
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

// Send command to game
function sendGameCommand(command, params) {
  const id = String(commandId++);

  if (command === 'wait') {
    setTimeout(() => {
      handleGameResponse(JSON.stringify({
        id, success: true, data: { waited: params.duration }
      }));
    }, params.duration);
    return id;
  }

  testClient.send(JSON.stringify({
    type: 'command',
    command: { id, command, params }
  }));

  return id;
}

// Handle response from game
function handleGameResponse(data) {
  const response = JSON.parse(data);
  const currentCmd = commandQueue[0];
  if (!currentCmd) return;

  evidence.commands.push({
    command: currentCmd.command,
    params: currentCmd.params,
    response: response,
    timestamp: new Date().toISOString()
  });

  if (!response.success && currentCmd.command !== 'wait') {
    console.error(`\\n✗ Command failed: ${response.error}\\n`);
    saveEvidence('FAILED');
    cleanup();
    return;
  }

  if (currentCmd.verify) {
    const passed = currentCmd.verify(response.data || response);
    console.log(`${passed ? '✓' : '✗'} ${currentCmd.desc}: ${passed ? 'PASSED' : 'FAILED'}\\n`);

    if (!passed) {
      console.error('BUG REPRODUCED\\n');
      saveEvidence('BUG_REPRODUCED');
      cleanup();
      return;
    }
  }

  executeNextCommand();
}

// Execute next command
function executeNextCommand() {
  if (commandQueue.length === 0) {
    console.log('All tests passed - bug NOT reproduced\\n');
    saveEvidence('BUG_NOT_REPRODUCED');
    cleanup();
    return;
  }

  commandQueue.shift();
  if (commandQueue.length === 0) return;

  const cmd = commandQueue[0];
  if (cmd.command !== 'wait') {
    console.log(`\\n→ ${cmd.desc}`);
  }
  sendGameCommand(cmd.command, cmd.params);
}

// Save evidence
function saveEvidence(status) {
  const timestamp = Date.now();
  const filename = `bug_evidence_${timestamp}.json`;

  // Get console logs from ChromeManager
  const consoleData = chrome.parseConsoleLogs();

  const finalEvidence = {
    ...evidence,
    status,
    finalTimestamp: new Date().toISOString(),
    consoleLogFile: consoleData.windowsPath,
    consoleLogs: consoleData.consoleLogs,
    consoleErrorCount: consoleData.consoleErrorCount,
    consoleExceptionCount: consoleData.consoleExceptionCount
  };

  fs.writeFileSync(filename, JSON.stringify(finalEvidence, null, 2));
  console.log(`\\nEvidence saved: ${filename}`);
}

// Cleanup
async function cleanup() {
  console.log('\\nCleaning up...');
  chrome.getConsoleSummary();
  await chrome.kill();
  process.exit(0);
}

// Main function
async function runTest() {
  console.log('========================================');
  console.log('BUG REPRODUCTION TEST');
  console.log('========================================\\n');

  try {
    const serverPromise = startAutomationServer();

    // Launch Chrome with ChromeManager
    await chrome.launch({
      url: '/index.html',
      testMode: true
    });

    await serverPromise;

    // Wait 10 seconds for game initialization (CRITICAL!)
    await chrome.waitForReady(10);

    // Connect test client
    testClient = new WebSocket(`ws://localhost:${WS_PORT}?client=test`);

    testClient.on('open', () => {
      console.log('✓ Test client ready!\\n');
      commandQueue = defineScenario();
      executeNextCommand();
    });

    testClient.on('message', handleGameResponse);

  } catch (err) {
    console.error('Fatal error:', err);
    await chrome.kill();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\\n\\nReceived SIGINT, cleaning up...');
  await cleanup();
});

runTest();
```

## Benefits of Using ChromeManager

### Before (Direct Chrome Spawn)
```javascript
// ❌ Complex, error-prone, easy to mess up
const profileDir = `C:\\\\Users\\\\${username}\\\\AppData\\\\Local\\\\Temp\\\\ChromeTest_${timestamp}`;
const chromeLogPath = `/mnt/c/Users/${username}/AppData/Local/Temp/ChromeTest_${timestamp}/chrome_debug.log`;
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn('cmd.exe', ['/c', 'start', 'chrome', '--app=${gameUrl}'], {detached: true});
// ^ BROKEN! Game doesn't load properly

// Manual console log parsing
const logContent = fs.readFileSync(chromeLogPath, 'utf8');
const lines = logContent.split('\\n');
// ... 50 lines of parsing logic
```

### After (ChromeManager)
```javascript
// ✅ Simple, reliable, bulletproof
const chrome = new ChromeManager();

await chrome.launch({ url: '/index.html', testMode: true });
await chrome.waitForReady(10);

const consoleData = chrome.parseConsoleLogs();
// Done! All complexity handled.
```

## ChromeManager API Reference

### Constructor Options

```javascript
new ChromeManager({
  chromePath: string,      // Default: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  username: string,        // Default: process.env.USER || 'super'
  timestamp: number,       // Default: Date.now()
  profileDir: string,      // Default: `C:\\temp\\chrome-test-${timestamp}`
  baseUrl: string         // Default: 'http://localhost:8080'
})
```

### Methods

**`launch(options)`** - Launch Chrome
- `options.url` (string): URL path relative to baseUrl (default: '/index.html')
- `options.testMode` (boolean): Add testMode=true query param (default: true)
- `options.remoteDebuggingPort` (number): Remote debugging port (default: 9222)
- Returns: Promise<{ url, profileDir, logPath, logPathWindows }>

**`waitForReady(seconds)`** - Wait for initialization
- `seconds` (number): Seconds to wait (default: 10)
- Returns: Promise<void>

**`kill()`** - Kill Chrome process
- Returns: Promise<void>

**`parseConsoleLogs()`** - Parse chrome_debug.log
- Returns: { logFile, windowsPath, totalLines, consoleLogs, consoleErrorCount, consoleExceptionCount }

**`getConsoleSummary()`** - Print console log summary
- Returns: Parsed console data (same as parseConsoleLogs)

**`getChromeLogPath()`** - Get WSL path to chrome_debug.log
- Returns: string (e.g., `/mnt/c/Users/super/AppData/Local/Temp/ChromeTest_1763400000000/chrome_debug.log`)

**`getChromeLogPathWindows()`** - Get Windows path to chrome_debug.log
- Returns: string (e.g., `C:\\Users\\super\\AppData\\Local\\Temp\\ChromeTest_1763400000000\\chrome_debug.log`)

**`killExistingChrome()`** - Kill old Chrome on port 9222
- Returns: void

## Agent Prompt Update

Add this to reproduction_creator systemPrompt:

```
# CRITICAL: ALWAYS Use ChromeManager

**NEVER spawn Chrome directly!** ALWAYS use the ChromeManager module.

ChromeManager is located at `/mnt/c/github/superstarships/lib/ChromeManager.js`.

## How to Use

1. Import ChromeManager:
   ```javascript
   const ChromeManager = require('./lib/ChromeManager');
   const chrome = new ChromeManager();
   ```

2. Launch Chrome:
   ```javascript
   await chrome.launch({ url: '/index.html', testMode: true });
   ```

3. Wait for initialization:
   ```javascript
   await chrome.waitForReady(10);  // 10 seconds
   ```

4. Parse console logs:
   ```javascript
   const consoleData = chrome.parseConsoleLogs();
   ```

5. Cleanup:
   ```javascript
   await chrome.kill();
   ```

See `/mnt/c/github/claudeplus/CHROME_MANAGER_AGENT_INSTRUCTIONS.md` for complete template.
```

## Why ChromeManager Solves All Problems

1. **Correct Chrome Launch**: Direct chrome.exe path, not cmd.exe
2. **All Flags Included**: Cache disable, logging, no extensions, etc.
3. **Cache-Busting**: Automatic timestamp in URL
4. **Process Management**: Proper lifecycle, cleanup, error handling
5. **Console Logs**: Automatic parsing with error/exception counts
6. **Consistent**: Same method works every time
7. **Maintainable**: Fix once in ChromeManager, all scripts benefit
8. **Simple API**: 5 method calls instead of 100+ lines of boilerplate
