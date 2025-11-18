const { spawn } = require('child_process');
const path = require('path');

/**
 * Browser Automation Service
 * Wraps the MCP browser-automation server for pipeline integration
 */
class BrowserAutomationService {
  constructor() {
    this.mcpProcess = null;
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.isReady = false;
  }

  /**
   * Start the MCP browser automation server
   */
  async start() {
    return new Promise((resolve, reject) => {
      const mcpServerPath = path.join(__dirname, '../mcp-servers/browser-automation/index.js');

      this.mcpProcess = spawn('node', [mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(mcpServerPath)
      });

      let initBuffer = '';

      this.mcpProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        initBuffer += chunk;
        console.log('[Browser Automation] Init stdout chunk:', chunk);

        // Look for initialization complete message
        if (initBuffer.includes('Browser Automation MCP server running')) {
          console.log('[Browser Automation] Init complete! Buffer:', initBuffer);
          this.isReady = true;
          resolve();

          // Switch to message parsing mode
          this.mcpProcess.stdout.removeAllListeners('data');
          this.setupMessageHandling();
        }
      });

      this.mcpProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        initBuffer += chunk;
        console.error('[Browser Automation MCP stderr]', chunk);

        // Check stderr for initialization message too
        if (initBuffer.includes('Browser Automation MCP server running')) {
          console.log('[Browser Automation] Init complete! Buffer:', initBuffer);
          this.isReady = true;
          resolve();

          // Switch to message parsing mode
          this.mcpProcess.stdout.removeAllListeners('data');
          this.setupMessageHandling();
        }
      });

      this.mcpProcess.on('error', (error) => {
        console.error('[Browser Automation] Process error:', error);
        reject(error);
      });

      this.mcpProcess.on('exit', (code) => {
        console.log('[Browser Automation] Process exited with code', code);
        this.isReady = false;
      });

      // Timeout after 10 seconds (increased from 5)
      setTimeout(() => {
        if (!this.isReady) {
          console.error('[Browser Automation] Init timeout. Buffer contents:', initBuffer);
          console.error('[Browser Automation] Looking for: "Browser Automation MCP server running"');
          reject(new Error('MCP server failed to start within 10 seconds'));
        }
      }, 10000);
    });
  }

  /**
   * Setup message handling for MCP protocol
   */
  setupMessageHandling() {
    let buffer = '';

    this.mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();

      // Process complete JSON messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(message);
          } catch (error) {
            console.error('[Browser Automation] Failed to parse message:', line, error);
          }
        }
      }
    });
  }

  /**
   * Handle incoming messages from MCP server
   */
  handleMessage(message) {
    const requestId = message.id;
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP request failed'));
      } else {
        resolve(message.result);
      }

      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Send a request to the MCP server
   */
  async sendRequest(method, params = {}) {
    if (!this.isReady) {
      throw new Error('MCP server not ready');
    }

    const requestId = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${requestId} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName, args = {}) {
    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    // Extract text content from MCP response
    if (result.content && result.content[0]) {
      const text = result.content[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return result;
  }

  /**
   * High-level browser automation methods
   */

  async launchBrowser(options = {}) {
    const result = await this.callTool('browser_launch', {
      browserType: options.browserType || 'chromium',
      headless: options.headless !== undefined ? options.headless : false,
      viewport: options.viewport || { width: 1280, height: 720 }
    });
    return result.sessionId;
  }

  async navigate(sessionId, url, waitUntil = 'load') {
    return await this.callTool('browser_navigate', { sessionId, url, waitUntil });
  }

  async click(sessionId, selector, timeout = 30000) {
    return await this.callTool('browser_click', { sessionId, selector, timeout });
  }

  async type(sessionId, selector, text, delay = 0) {
    return await this.callTool('browser_type', { sessionId, selector, text, delay });
  }

  async evaluate(sessionId, script) {
    return await this.callTool('browser_evaluate', { sessionId, script });
  }

  async screenshot(sessionId, filePath, options = {}) {
    return await this.callTool('browser_screenshot', {
      sessionId,
      path: filePath,
      fullPage: options.fullPage || false,
      selector: options.selector
    });
  }

  async getText(sessionId, selector) {
    return await this.callTool('browser_get_text', { sessionId, selector });
  }

  async getAttribute(sessionId, selector, attribute) {
    return await this.callTool('browser_get_attribute', { sessionId, selector, attribute });
  }

  async waitForSelector(sessionId, selector, state = 'visible', timeout = 30000) {
    return await this.callTool('browser_wait_for_selector', {
      sessionId,
      selector,
      state,
      timeout
    });
  }

  async getPageInfo(sessionId) {
    return await this.callTool('browser_get_page_info', { sessionId });
  }

  async getConsoleLogs(sessionId, filter = 'all', clear = false) {
    return await this.callTool('browser_get_console_logs', { sessionId, filter, clear });
  }

  async clearConsoleLogs(sessionId) {
    return await this.callTool('browser_clear_console_logs', { sessionId });
  }

  async closeBrowser(sessionId) {
    return await this.callTool('browser_close', { sessionId });
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isReady = false;
    }
  }
}

module.exports = BrowserAutomationService;
