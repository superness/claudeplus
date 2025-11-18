# Browser Automation System

**Complete browser automation for pipeline testing - no manual intervention required**

## Overview

The Claude Plus pipeline system now includes full Playwright-based browser automation, enabling agents to:

- ✅ Launch and control browsers programmatically
- ✅ Execute JavaScript in browser context
- ✅ Capture console logs automatically
- ✅ Take screenshots for evidence
- ✅ Interact with UI elements (click, type, etc.)
- ✅ Wait for dynamic content to load

**No more manual DevTools injection!** The `game_runner` agent can now fully automate browser-based tests.

---

## Architecture

```
Claude Agent (game_runner)
    ↓ bash script with curl
Proxy Server (port 8081)
    ↓ HTTP/WebSocket API
Browser Automation Service
    ↓ MCP protocol
Browser Automation MCP Server
    ↓ Playwright
Chrome/Firefox/Safari Browser
```

### Components

1. **MCP Browser Automation Server** (`mcp-servers/browser-automation/`)
   - Playwright-based automation
   - MCP protocol interface
   - Session management
   - Console log capture

2. **Browser Automation Service** (`proxy/browser-automation-service.js`)
   - Wraps MCP server with async API
   - Manages process lifecycle
   - Request/response handling

3. **Proxy Server Integration** (`proxy/server.js`)
   - HTTP endpoints for automation commands
   - WebSocket support for real-time updates
   - Session tracking per client

4. **Agent Integration** (`agents/game_runner.json`)
   - Updated system prompt with automation instructions
   - Example bash scripts for common tasks
   - HTTP API usage patterns

---

## HTTP API Reference

All endpoints accept JSON payloads and return JSON responses.

### Initialize Browser Automation

```bash
POST http://localhost:8081/browser-init

# Response
{
  "status": "ready",
  "message": "Browser automation initialized"
}
```

### Launch Browser

```bash
POST http://localhost:8081/browser-launch
Content-Type: application/json

{
  "headless": false,
  "viewport": {
    "width": 1280,
    "height": 720
  }
}

# Response
{
  "success": true,
  "result": {
    "sessionId": "session_1"
  }
}
```

### Navigate to URL

```bash
POST http://localhost:8081/browser-navigate
Content-Type: application/json

{
  "sessionId": "session_1",
  "url": "http://localhost:3000",
  "waitUntil": "load"  # load, domcontentloaded, networkidle
}
```

### Execute JavaScript

```bash
POST http://localhost:8081/browser-evaluate
Content-Type: application/json

{
  "sessionId": "session_1",
  "script": "return {title: document.title, url: window.location.href}"
}

# Response
{
  "success": true,
  "result": {
    "title": "My Game",
    "url": "http://localhost:3000"
  }
}
```

### Get Console Logs

```bash
POST http://localhost:8081/browser-get-console-logs
Content-Type: application/json

{
  "sessionId": "session_1",
  "filter": "all",  # all, log, info, warn, error, debug
  "clear": false
}

# Response
{
  "success": true,
  "result": {
    "sessionId": "session_1",
    "logCount": 42,
    "logs": [
      {
        "type": "log",
        "text": "Game initialized",
        "timestamp": "2025-01-16T10:30:00Z",
        "location": {"url": "http://localhost:3000", "lineNumber": 42}
      },
      {
        "type": "error",
        "text": "Cannot read property 'health' of undefined",
        "timestamp": "2025-01-16T10:30:05Z",
        "stack": "Error stack trace..."
      }
    ]
  }
}
```

### Take Screenshot

```bash
POST http://localhost:8081/browser-screenshot
Content-Type: application/json

{
  "sessionId": "session_1",
  "path": "/tmp/screenshot.png",
  "fullPage": false,
  "options": {
    "selector": "#game-canvas"  # Optional: screenshot specific element
  }
}
```

### Click Element

```bash
POST http://localhost:8081/browser-click
Content-Type: application/json

{
  "sessionId": "session_1",
  "selector": "#start-button",
  "timeout": 30000
}
```

### Type Text

```bash
POST http://localhost:8081/browser-type
Content-Type: application/json

{
  "sessionId": "session_1",
  "selector": "#username",
  "text": "testuser",
  "delay": 100  # ms between keystrokes
}
```

### Close Browser

```bash
POST http://localhost:8081/browser-close
Content-Type: application/json

{
  "sessionId": "session_1"
}
```

---

## Usage Examples

### Basic Test Script

```bash
#!/bin/bash

# Initialize
curl -X POST http://localhost:8081/browser-init

# Launch browser
SESSION=$(curl -s -X POST http://localhost:8081/browser-launch \
  -H "Content-Type: application/json" \
  -d '{"headless": false}' | jq -r '.result.sessionId')

# Navigate
curl -X POST http://localhost:8081/browser-navigate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\", \"url\": \"http://localhost:3000\"}"

# Execute test
curl -X POST http://localhost:8081/browser-evaluate \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\", \"script\": \"return document.title\"}"

# Capture logs
curl -X POST http://localhost:8081/browser-get-console-logs \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}" > logs.json

# Screenshot
curl -X POST http://localhost:8081/browser-screenshot \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\", \"path\": \"/tmp/test.png\"}"

# Close
curl -X POST http://localhost:8081/browser-close \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION\"}"
```

### Complete Game Test (Automated)

See `example-game-test-automation.sh` for a full example that:

1. Starts game server
2. Launches browser
3. Loads game
4. Executes test scenario
5. Captures console logs
6. Takes screenshot
7. Saves all evidence
8. Stops server
9. Returns structured results

**No manual steps required!**

---

## Integration with Agents

### game_runner Agent

The `game_runner` agent now has full automation capabilities. It can:

```json
{
  "executionStatus": "completed",
  "automationUsed": true,
  "browserSession": "session_123",
  "executionLog": [...],
  "evidenceCaptured": [
    {
      "type": "console_logs",
      "path": "console.json",
      "logCount": 42,
      "errors": 3
    },
    {
      "type": "screenshot",
      "path": "tests/screenshot.png"
    },
    {
      "type": "javascript_result",
      "data": {"maxVelocity": 0, "throttle": 0}
    }
  ],
  "observations": [
    "Browser launched successfully",
    "Game loaded in 2.3s",
    "Console captured 42 entries (3 errors)",
    "JavaScript execution returned: {maxVelocity: 0}"
  ]
}
```

### bug_verifier Agent

Can now verify bugs automatically by:

1. Reviewing automation results from game_runner
2. Analyzing console logs for errors
3. Checking JavaScript execution results
4. Comparing screenshots to expected state

**No more INCONCLUSIVE verdicts due to manual steps!**

---

## Testing the System

### Quick Test

```bash
# Start proxy server (if not running)
cd /mnt/c/github/claudeplus
./start-proxy.sh

# Run basic test
./test-browser-automation.sh
```

### Game Test Example

```bash
# Ensure proxy server is running
cd /mnt/c/github/claudeplus
./start-proxy.sh

# Run game test (customize paths in script first)
./example-game-test-automation.sh
```

---

## Troubleshooting

### Browser automation not initialized

**Error**: `Browser automation not initialized. Call /browser-init first.`

**Solution**: Always call `/browser-init` before other commands:

```bash
curl -X POST http://localhost:8081/browser-init
```

### MCP server failed to start

**Error**: `MCP server failed to start within 5 seconds`

**Solution**:

1. Check if Playwright browsers are installed:
   ```bash
   cd mcp-servers/browser-automation
   npx playwright install chromium
   ```

2. Check MCP server logs in proxy output

3. Ensure Node.js version >= 18.0.0

### Session not found

**Error**: `Session session_xyz not found`

**Solution**: Browser session may have closed. Create new session with `/browser-launch`

### Timeout errors

**Error**: Request timeout or element not found

**Solution**: Increase timeout values:

```json
{
  "selector": "#element",
  "timeout": 60000  // 60 seconds instead of default 30
}
```

---

## Performance Notes

- **Headless mode**: Use `"headless": true` for faster tests (no GUI rendering)
- **Session reuse**: Reuse browser sessions for multiple tests to save launch time
- **Parallel sessions**: Multiple sessions can run concurrently (one per sessionId)
- **Console log limits**: Console logs are kept in memory - clear periodically with `/browser-clear-console-logs`

---

## Security Notes

- Browser automation runs with full browser privileges
- Only accessible on localhost (port 8081)
- No authentication required (proxy server is local-only)
- Be cautious when navigating to external URLs

---

## Next Steps

1. **Update bug-fix pipeline**: Modify routing logic to avoid infinite loops when using automation
2. **Create automation templates**: Pre-built test scenarios for common game bugs
3. **Add screenshot diffing**: Compare screenshots to detect visual regressions
4. **Network interception**: Add Playwright network monitoring for API testing
5. **Video recording**: Capture video of test execution for debugging

---

## Files Created/Modified

### New Files
- `mcp-servers/browser-automation/index.js` - Enhanced with console log capture
- `proxy/browser-automation-service.js` - Service wrapper for MCP server
- `test-browser-automation.sh` - Basic test script
- `example-game-test-automation.sh` - Complete game test example
- `BROWSER-AUTOMATION-README.md` - This documentation

### Modified Files
- `proxy/server.js` - Added HTTP endpoints and WebSocket handlers
- `agents/game_runner.json` - Updated with automation instructions

---

## Credits

Built on:
- [Playwright](https://playwright.dev/) - Browser automation framework
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) - AI integration standard
- Claude Plus Pipeline System - Multi-agent orchestration

---

**🎉 Happy Automating!**

No more infinite verification loops. No more manual DevTools injection. Just pure, automated browser testing power.
