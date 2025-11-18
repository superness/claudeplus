# Chrome Console Log Capture - Usage Guide

## Quick Start

```bash
# From WSL, run:
./launch-chrome-and-capture-logs.sh http://localhost:8080
```

This will:
1. ✓ Kill any existing Chrome debug instances
2. ✓ Launch Chrome on Windows via `start-chrome-debug.bat`
3. ✓ Wait for CDP endpoint to become available (max 30 seconds)
4. ✓ Connect Puppeteer and start capturing console logs
5. ✓ Write all logs to `chrome-console-output.log`

## Usage

```bash
./launch-chrome-and-capture-logs.sh [GAME_URL] [LOG_FILE]
```

**Parameters:**
- `GAME_URL` - URL of your game (default: `http://localhost:8080`)
- `LOG_FILE` - Where to write logs (default: `/mnt/c/github/claudeplus/chrome-console-output.log`)

**Examples:**

```bash
# Use default settings
./launch-chrome-and-capture-logs.sh

# Custom game URL
./launch-chrome-and-capture-logs.sh http://localhost:3000

# Custom log file location
./launch-chrome-and-capture-logs.sh http://localhost:8080 /tmp/game-logs.txt
```

## What Gets Captured

The script captures:
- ✓ All `console.log()`, `console.warn()`, `console.error()` calls
- ✓ JavaScript errors and stack traces
- ✓ Network request failures
- ✓ WebSocket connection errors

## Output Format

Logs are written in real-time to both:
1. **Terminal** (stdout)
2. **Log file** (specified location)

Format:
```
[LOG] Game initialized
[WARN] Low frame rate detected
[ERROR] WebSocket connection failed
[NETWORK FAILED] http://localhost:8080/api/data - net::ERR_CONNECTION_REFUSED
```

## Troubleshooting

**Problem: "CDP endpoint never became available"**
- Ensure no other Chrome instances are using port 9222
- Check that `start-chrome-debug.bat` exists and is valid
- Verify Chrome is installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`

**Problem: "Cannot find module 'puppeteer-core'"**
```bash
cd /mnt/c/github/claudeplus
npm install puppeteer-core
```

**Problem: Chrome opens but logs don't appear**
- Check that your game URL is correct
- Verify the game page is actually loading
- Look for JavaScript errors preventing page execution

## Integration with Game Runner Agent

The `game_runner` agent can now use this script:

```javascript
// In game_runner agent
const logCapture = spawn('/mnt/c/github/claudeplus/launch-chrome-and-capture-logs.sh', [
  gameUrl,
  '/mnt/c/github/claudeplus/output/game-console.log'
]);

// Wait for logs to accumulate
await new Promise(resolve => setTimeout(resolve, 5000));

// Read captured logs
const logs = fs.readFileSync('/mnt/c/github/claudeplus/output/game-console.log', 'utf8');
```

## Stopping Log Capture

Press `Ctrl+C` in the terminal to stop capturing logs. Chrome will remain open.

To completely stop and close Chrome:
```bash
taskkill.exe //F //IM chrome.exe
```
