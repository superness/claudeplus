# Chrome Console Logging for WSL Agents

Capture Chrome browser console output (logs, warnings, errors) to a file accessible by both Windows and WSL.

## Quick Start

### 1. Start Chrome with Debugging Enabled

**Windows (run from Command Prompt or double-click):**
```batch
start-chrome-debug.bat
```

Or manually:
```batch
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### 2. Start the Console Logger

**From WSL:**
```bash
cd /mnt/c/github/claudeplus
node chrome-console-logger.js
```

### 3. Open Your Game

Navigate to your game URL in the Chrome window. All console output will be captured to:
- **Windows:** `C:\GameLogs\chrome-console-<timestamp>.log`
- **WSL:** `/mnt/c/GameLogs/chrome-console-<timestamp>.log`

## What Gets Logged

- ✅ `console.log()` - Regular logs
- ✅ `console.warn()` - Warnings
- ✅ `console.error()` - Errors with stack traces
- ✅ JavaScript exceptions with full stack traces
- ✅ Browser internal logs
- ✅ Timestamps for all events

## Log Format

```
[2025-11-16T12:34:56.789Z] [CONSOLE.LOG] Game initialized
[2025-11-16T12:34:57.123Z] [CONSOLE.WARN] Low FPS detected
[2025-11-16T12:34:58.456Z] [CONSOLE.ERROR] Failed to load texture
  at loadTexture (game.js:123)
  at init (game.js:45)
[2025-11-16T12:35:00.789Z] [EXCEPTION] TypeError: Cannot read property 'x' of undefined
  at update (player.js:67)
```

## Agent Access

Your WSL-based agents can now read game logs:

```bash
# Real-time tail
tail -f /mnt/c/GameLogs/chrome-console-*.log

# Search for errors
grep "\[ERROR\]" /mnt/c/GameLogs/chrome-console-*.log

# Last 100 lines
tail -n 100 /mnt/c/GameLogs/chrome-console-*.log

# Get latest log file
ls -t /mnt/c/GameLogs/chrome-console-*.log | head -n1
```

## Troubleshooting

### "Cannot connect to Chrome DevTools Protocol"

1. Make sure Chrome is running with debugging enabled
2. Verify port 9222 is accessible:
   ```bash
   curl http://localhost:9222/json
   ```
3. Check if another Chrome instance is already using port 9222
4. Try closing all Chrome windows and restart with `start-chrome-debug.bat`

### "No targets found"

Chrome is running but no tabs are open. Open a new tab or navigate to a website.

### Logger stops receiving messages

Chrome tab was closed or navigated away. The logger connects to a specific tab. Restart the logger to connect to the current tab.

## How It Works

1. **Chrome DevTools Protocol (CDP)**: Chrome exposes a debugging interface on port 9222
2. **WebSocket Connection**: Logger connects to CDP via WebSocket
3. **Runtime Domain**: Enables `Runtime.consoleAPICalled` events for console messages
4. **Log Domain**: Enables `Log.entryAdded` events for browser logs
5. **File Streaming**: All messages written to shared log file in `C:\GameLogs`

## Integration with Pipeline System

Add console log reading capability to your agents:

```json
{
  "id": "game_debugger",
  "name": "Game Debugger",
  "tools": ["Read", "Grep", "Bash"],
  "instructions": "When debugging game issues, check Chrome console logs at /mnt/c/GameLogs/chrome-console-*.log"
}
```

Example agent commands:
```bash
# Find latest errors
grep -A 5 "\[ERROR\]" $(ls -t /mnt/c/GameLogs/chrome-console-*.log | head -n1)

# Count warnings in last session
grep -c "\[WARN\]" /mnt/c/GameLogs/chrome-console-*.log

# Extract exception stack traces
grep -A 10 "\[EXCEPTION\]" /mnt/c/GameLogs/chrome-console-*.log
```

## Next Steps

- ✅ Proof of concept works
- 🔄 Integrate with `game_runner` agent
- 🔄 Add to Game Dev Studio interface
- 🔄 Auto-start logger when running game tests
- 🔄 Add log analysis commands to pipeline system
