# Chrome Console Logging Integration for Bug Reproduction Scripts

## Overview

**CRITICAL UPDATE:** We now use Chrome's **built-in logging feature** to capture console output.

- ✅ NO WebSockets
- ✅ NO CDP connections  
- ✅ NO Puppeteer
- ✅ Just launch Chrome with `--enable-logging --v=1` and read the log file

## How Chrome Built-In Logging Works

When Chrome launches with `--enable-logging --v=1`, it writes ALL console output to:
```
C:\Users\<username>\AppData\Local\Google\Chrome\User Data\chrome_debug.log
```

The log contains lines like:
```
[8432:12344:1116/143027.123:CONSOLE:142] "Game initialized", source: game.js (89)
[8432:12344:1116/143028.456:ERROR:142] Uncaught TypeError...
```

## Using chrome-console-logger.js

**Location:** `/mnt/c/github/claudeplus/chrome-console-logger.js`

**Usage:**
```bash
node /mnt/c/github/claudeplus/chrome-console-logger.js <url> [duration_seconds]
```

**Example:**
```bash
node /mnt/c/github/claudeplus/chrome-console-logger.js http://localhost:8080 30
```

This will:
1. Launch Chrome to http://localhost:8080
2. Capture console output for 30 seconds
3. Save to `chrome-console-output.json`
4. Kill Chrome and exit

## Output Format (chrome-console-output.json)

```json
[
  {
    "timestamp": "2025-11-16T14:30:27.123Z",
    "message": "Game initialized",
    "source": "http://localhost:8080/game.js",
    "line": "89"
  }
]
```

## Integration into Reproduction Scripts

### Step 1: Launch Console Logger

**IMPORTANT:** The console logger LAUNCHES Chrome for you!

```javascript
const { spawn } = require('child_process');
const fs = require('fs');

let chromeLogger = null;
const evidence = {
  timestamp: new Date().toISOString(),
  commands: [],
  consoleLogs: [],
  consoleLogFile: null
};

async function startConsoleLogger(testDuration = 30) {
  return new Promise((resolve) => {
    const gameUrl = 'http://localhost:8080/index.html?testMode=true';

    chromeLogger = spawn('node', [
      '/mnt/c/github/claudeplus/chrome-console-logger.js',
      gameUrl,
      testDuration.toString()
    ], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    chromeLogger.stdout.on('data', (data) => {
      console.log(`[chrome-logger] ${data.toString().trim()}`);
    });

    chromeLogger.on('exit', (code) => {
      const outputFile = './chrome-console-output.json';
      if (fs.existsSync(outputFile)) {
        const logs = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        evidence.consoleLogs = logs;
        evidence.consoleLogFile = outputFile;
        console.log(`✓ Captured ${logs.length} console log entries`);
      }
    });

    setTimeout(() => resolve(), 3000);
  });
}
```

### Step 2: Run Test

```javascript
async function runTest() {
  await startConsoleLogger(30);
  await new Promise(r => setTimeout(r, 5000));
  
  // Your WebSocket automation...
}
```

### Step 3: Cleanup

```javascript
process.on('exit', () => {
  if (chromeLogger && !chromeLogger.killed) {
    chromeLogger.kill('SIGTERM');
  }
});
```

## For Pipeline Agents

**reproduction_creator**: Write scripts using template above

**game_runner**: Execute scripts and verify chrome-console-output.json exists

**bug_verifier**: Analyze evidence.consoleLogs array for errors
