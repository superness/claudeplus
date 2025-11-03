# Browser Automation MCP Server

Provides browser automation capabilities to Claude Code using Playwright.

## Features

- 🌐 Launch browsers (Chromium, Firefox, WebKit)
- 🖱️ Interact with web pages (click, type, navigate)
- 📸 Take screenshots
- 🔍 Inspect elements and execute JavaScript
- ⏱️ Wait for elements and page states
- 🤖 Perfect for automated QA testing

## Installation

```bash
cd mcp-servers/browser-automation
npm install
npx playwright install chromium  # or firefox, webkit
```

## Configuration

Add this to your Claude Code MCP settings (usually `~/.config/claude-code/mcp_settings.json` or similar):

```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "node",
      "args": ["/path/to/claudeplus/mcp-servers/browser-automation/index.js"]
    }
  }
}
```

For Windows WSL paths:
```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "node",
      "args": ["/mnt/c/github/claudeplus/mcp-servers/browser-automation/index.js"]
    }
  }
}
```

## Available Tools

### browser_launch
Launch a new browser instance.

**Parameters:**
- `browserType`: "chromium" | "firefox" | "webkit" (default: "chromium")
- `headless`: boolean (default: false) - run without visible window
- `viewport`: { width: number, height: number } - browser window size

**Returns:** `{ sessionId: string }` - use this ID for all subsequent operations

**Example:**
```javascript
{
  "browserType": "chromium",
  "headless": false,
  "viewport": { "width": 1920, "height": 1080 }
}
```

### browser_navigate
Navigate to a URL.

**Parameters:**
- `sessionId`: string (required)
- `url`: string (required)
- `waitUntil`: "load" | "domcontentloaded" | "networkidle" (default: "load")

### browser_click
Click an element on the page.

**Parameters:**
- `sessionId`: string (required)
- `selector`: string (required) - CSS selector
- `timeout`: number (default: 30000) - max wait time in ms

### browser_type
Type text into an input field.

**Parameters:**
- `sessionId`: string (required)
- `selector`: string (required) - CSS selector for input
- `text`: string (required) - text to type
- `delay`: number (default: 0) - delay between keystrokes in ms

### browser_screenshot
Take a screenshot of the page.

**Parameters:**
- `sessionId`: string (required)
- `path`: string (required) - file path to save (e.g., "screenshot.png")
- `fullPage`: boolean (default: false) - capture entire scrollable page
- `selector`: string (optional) - screenshot only this element

### browser_get_text
Get text content from an element.

**Parameters:**
- `sessionId`: string (required)
- `selector`: string (required) - CSS selector

**Returns:** Text content of the element

### browser_get_attribute
Get an attribute value from an element.

**Parameters:**
- `sessionId`: string (required)
- `selector`: string (required) - CSS selector
- `attribute`: string (required) - attribute name (e.g., "href", "class", "id")

**Returns:** Attribute value

### browser_evaluate
Execute JavaScript in the page context.

**Parameters:**
- `sessionId`: string (required)
- `script`: string (required) - JavaScript code to execute

**Returns:** Result of the script execution

**Example:**
```javascript
{
  "sessionId": "session_1",
  "script": "document.querySelectorAll('.ship-card').length"
}
```

### browser_wait_for_selector
Wait for an element to appear.

**Parameters:**
- `sessionId`: string (required)
- `selector`: string (required) - CSS selector
- `state`: "attached" | "detached" | "visible" | "hidden" (default: "visible")
- `timeout`: number (default: 30000) - max wait time in ms

### browser_get_page_info
Get current page information.

**Parameters:**
- `sessionId`: string (required)

**Returns:** `{ url: string, title: string, viewport: object }`

### browser_close
Close the browser session.

**Parameters:**
- `sessionId`: string (required)

## Usage Example

Here's a complete test scenario for testing a spaceship game:

```
1. Launch browser
   - Tool: browser_launch
   - Args: { "headless": false, "viewport": { "width": 1920, "height": 1080 } }
   - Result: { "sessionId": "session_1" }

2. Navigate to game
   - Tool: browser_navigate
   - Args: { "sessionId": "session_1", "url": "http://localhost:3000" }

3. Wait for game to load
   - Tool: browser_wait_for_selector
   - Args: { "sessionId": "session_1", "selector": "#game-canvas" }

4. Take initial screenshot
   - Tool: browser_screenshot
   - Args: { "sessionId": "session_1", "path": "test-screenshots/initial.png" }

5. Click on ship inventory
   - Tool: browser_click
   - Args: { "sessionId": "session_1", "selector": "#ship-inventory-btn" }

6. Verify inventory opened
   - Tool: browser_get_text
   - Args: { "sessionId": "session_1", "selector": ".inventory-header" }
   - Expected: "Ship Inventory"

7. Check ship count
   - Tool: browser_evaluate
   - Args: { "sessionId": "session_1", "script": "document.querySelectorAll('.ship-card').length" }

8. Screenshot inventory
   - Tool: browser_screenshot
   - Args: { "sessionId": "session_1", "path": "test-screenshots/inventory.png" }

9. Close browser
   - Tool: browser_close
   - Args: { "sessionId": "session_1" }
```

## Tips

- **Visible vs Headless**: Use `headless: false` during development to see what's happening. Use `headless: true` for CI/CD pipelines.

- **Selectors**: Use specific selectors to avoid ambiguity:
  - Good: `#ship-inventory-btn`, `.ship-card[data-id="ship-123"]`
  - Bad: `button`, `div`

- **Waits**: Always wait for elements before interacting:
  ```javascript
  // Wait for element to be visible
  browser_wait_for_selector({ sessionId, selector: "#button" })
  // Then click it
  browser_click({ sessionId, selector: "#button" })
  ```

- **Screenshots**: Take screenshots at key moments to create visual test documentation

- **JavaScript Evaluation**: Use `browser_evaluate` to check complex state:
  ```javascript
  {
    "script": "window.gameState.resources.ore"
  }
  ```

## Troubleshooting

**Error: "Session not found"**
- Make sure you saved the sessionId from browser_launch
- Check if the browser was accidentally closed

**Element not found**
- Use browser_screenshot to see current page state
- Try browser_wait_for_selector before clicking
- Verify your CSS selector is correct

**Timeout errors**
- Increase the timeout parameter
- Check if the page actually loads (use browser_get_page_info)
- Look for JavaScript errors (use browser_evaluate with console.log)

## Advanced Usage

### Testing Forms
```javascript
// Fill out a form
browser_type({ sessionId, selector: "#username", text: "testuser" })
browser_type({ sessionId, selector: "#password", text: "password123" })
browser_click({ sessionId, selector: "#login-btn" })
browser_wait_for_selector({ sessionId, selector: ".dashboard" })
```

### Checking Console Errors
```javascript
browser_evaluate({
  sessionId,
  script: `
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => {
      errors.push(args.join(' '));
      originalError(...args);
    };
    errors;
  `
})
```

### Performance Timing
```javascript
browser_evaluate({
  sessionId,
  script: `performance.timing.loadEventEnd - performance.timing.navigationStart`
})
```

## License

MIT
