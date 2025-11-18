#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium, firefox, webkit } from 'playwright';

/**
 * Browser Automation MCP Server
 * Provides browser automation capabilities using Playwright
 */

class BrowserAutomationServer {
  constructor() {
    this.server = new Server(
      {
        name: 'browser-automation',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Browser state management
    this.browsers = new Map(); // sessionId -> browser instance
    this.contexts = new Map(); // sessionId -> browser context
    this.pages = new Map(); // sessionId -> page instance
    this.sessionCounter = 0;

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'browser_launch',
          description: 'Launch a new browser instance. Returns a session ID for subsequent operations.',
          inputSchema: {
            type: 'object',
            properties: {
              browserType: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                default: 'chromium',
                description: 'Type of browser to launch'
              },
              headless: {
                type: 'boolean',
                default: false,
                description: 'Run browser in headless mode (no visible window)'
              },
              viewport: {
                type: 'object',
                properties: {
                  width: { type: 'number', default: 1280 },
                  height: { type: 'number', default: 720 }
                },
                description: 'Browser viewport size'
              }
            }
          }
        },
        {
          name: 'browser_navigate',
          description: 'Navigate to a URL in the browser',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              url: {
                type: 'string',
                description: 'URL to navigate to'
              },
              waitUntil: {
                type: 'string',
                enum: ['load', 'domcontentloaded', 'networkidle'],
                default: 'load',
                description: 'When to consider navigation complete'
              }
            },
            required: ['sessionId', 'url']
          }
        },
        {
          name: 'browser_click',
          description: 'Click an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              selector: {
                type: 'string',
                description: 'CSS selector or text to click'
              },
              timeout: {
                type: 'number',
                default: 30000,
                description: 'Maximum time to wait for element (ms)'
              }
            },
            required: ['sessionId', 'selector']
          }
        },
        {
          name: 'browser_type',
          description: 'Type text into an input field',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              selector: {
                type: 'string',
                description: 'CSS selector for input element'
              },
              text: {
                type: 'string',
                description: 'Text to type'
              },
              delay: {
                type: 'number',
                default: 0,
                description: 'Delay between keystrokes (ms)'
              }
            },
            required: ['sessionId', 'selector', 'text']
          }
        },
        {
          name: 'browser_screenshot',
          description: 'Take a screenshot of the page or specific element',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              path: {
                type: 'string',
                description: 'File path to save screenshot'
              },
              fullPage: {
                type: 'boolean',
                default: false,
                description: 'Capture full scrollable page'
              },
              selector: {
                type: 'string',
                description: 'CSS selector to screenshot specific element (optional)'
              }
            },
            required: ['sessionId', 'path']
          }
        },
        {
          name: 'browser_get_text',
          description: 'Get text content from an element',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              selector: {
                type: 'string',
                description: 'CSS selector for element'
              }
            },
            required: ['sessionId', 'selector']
          }
        },
        {
          name: 'browser_get_attribute',
          description: 'Get attribute value from an element',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              selector: {
                type: 'string',
                description: 'CSS selector for element'
              },
              attribute: {
                type: 'string',
                description: 'Attribute name to get'
              }
            },
            required: ['sessionId', 'selector', 'attribute']
          }
        },
        {
          name: 'browser_evaluate',
          description: 'Execute JavaScript in the page context',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              script: {
                type: 'string',
                description: 'JavaScript code to execute'
              }
            },
            required: ['sessionId', 'script']
          }
        },
        {
          name: 'browser_wait_for_selector',
          description: 'Wait for an element to appear on the page',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              selector: {
                type: 'string',
                description: 'CSS selector to wait for'
              },
              state: {
                type: 'string',
                enum: ['attached', 'detached', 'visible', 'hidden'],
                default: 'visible',
                description: 'State to wait for'
              },
              timeout: {
                type: 'number',
                default: 30000,
                description: 'Maximum wait time (ms)'
              }
            },
            required: ['sessionId', 'selector']
          }
        },
        {
          name: 'browser_get_page_info',
          description: 'Get current page information (title, URL, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'browser_get_console_logs',
          description: 'Get all captured console logs from the browser',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              },
              filter: {
                type: 'string',
                enum: ['all', 'log', 'info', 'warn', 'error', 'debug'],
                default: 'all',
                description: 'Filter logs by type'
              },
              clear: {
                type: 'boolean',
                default: false,
                description: 'Clear logs after retrieving them'
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'browser_clear_console_logs',
          description: 'Clear all captured console logs',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID from browser_launch'
              }
            },
            required: ['sessionId']
          }
        },
        {
          name: 'browser_close',
          description: 'Close the browser session',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID to close'
              }
            },
            required: ['sessionId']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'browser_launch':
            return await this.launchBrowser(args);
          case 'browser_navigate':
            return await this.navigate(args);
          case 'browser_click':
            return await this.click(args);
          case 'browser_type':
            return await this.type(args);
          case 'browser_screenshot':
            return await this.screenshot(args);
          case 'browser_get_text':
            return await this.getText(args);
          case 'browser_get_attribute':
            return await this.getAttribute(args);
          case 'browser_evaluate':
            return await this.evaluate(args);
          case 'browser_wait_for_selector':
            return await this.waitForSelector(args);
          case 'browser_get_page_info':
            return await this.getPageInfo(args);
          case 'browser_get_console_logs':
            return await this.getConsoleLogs(args);
          case 'browser_clear_console_logs':
            return await this.clearConsoleLogs(args);
          case 'browser_close':
            return await this.closeBrowser(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}\n${error.stack}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async launchBrowser(args) {
    const { browserType = 'chromium', headless = false, viewport = {} } = args;
    const sessionId = `session_${++this.sessionCounter}`;

    let browser;
    switch (browserType) {
      case 'firefox':
        browser = await firefox.launch({ headless });
        break;
      case 'webkit':
        browser = await webkit.launch({ headless });
        break;
      default:
        browser = await chromium.launch({ headless });
    }

    const context = await browser.newContext({
      viewport: {
        width: viewport.width || 1280,
        height: viewport.height || 720
      }
    });

    const page = await context.newPage();

    // Initialize console log capture
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location()
      });
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleLogs.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    this.browsers.set(sessionId, browser);
    this.contexts.set(sessionId, context);
    this.pages.set(sessionId, page);
    this.consoleLogs = this.consoleLogs || new Map();
    this.consoleLogs.set(sessionId, consoleLogs);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sessionId,
            browserType,
            headless,
            viewport: { width: viewport.width || 1280, height: viewport.height || 720 },
            message: 'Browser launched successfully with console capture enabled'
          }, null, 2)
        }
      ]
    };
  }

  async navigate(args) {
    const { sessionId, url, waitUntil = 'load' } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    await page.goto(url, { waitUntil });

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to ${url}`
        }
      ]
    };
  }

  async click(args) {
    const { sessionId, selector, timeout = 30000 } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    await page.click(selector, { timeout });

    return {
      content: [
        {
          type: 'text',
          text: `Clicked element: ${selector}`
        }
      ]
    };
  }

  async type(args) {
    const { sessionId, selector, text, delay = 0 } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    await page.type(selector, text, { delay });

    return {
      content: [
        {
          type: 'text',
          text: `Typed "${text}" into ${selector}`
        }
      ]
    };
  }

  async screenshot(args) {
    const { sessionId, path, fullPage = false, selector } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    if (selector) {
      const element = await page.$(selector);
      if (!element) throw new Error(`Element not found: ${selector}`);
      await element.screenshot({ path });
    } else {
      await page.screenshot({ path, fullPage });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot saved to ${path}`
        }
      ]
    };
  }

  async getText(args) {
    const { sessionId, selector } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    const text = await page.textContent(selector);

    return {
      content: [
        {
          type: 'text',
          text: text || ''
        }
      ]
    };
  }

  async getAttribute(args) {
    const { sessionId, selector, attribute } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    const value = await page.getAttribute(selector, attribute);

    return {
      content: [
        {
          type: 'text',
          text: value || ''
        }
      ]
    };
  }

  async evaluate(args) {
    const { sessionId, script } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    const result = await page.evaluate(script);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async waitForSelector(args) {
    const { sessionId, selector, state = 'visible', timeout = 30000 } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    await page.waitForSelector(selector, { state, timeout });

    return {
      content: [
        {
          type: 'text',
          text: `Element ${selector} is ${state}`
        }
      ]
    };
  }

  async getPageInfo(args) {
    const { sessionId } = args;
    const page = this.pages.get(sessionId);
    if (!page) throw new Error(`Session ${sessionId} not found`);

    const info = {
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize()
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2)
        }
      ]
    };
  }

  async getConsoleLogs(args) {
    const { sessionId, filter = 'all', clear = false } = args;
    if (!this.consoleLogs) this.consoleLogs = new Map();

    const logs = this.consoleLogs.get(sessionId) || [];
    let filteredLogs = logs;

    if (filter !== 'all') {
      filteredLogs = logs.filter(log => log.type === filter);
    }

    if (clear) {
      this.consoleLogs.set(sessionId, []);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sessionId,
            logCount: filteredLogs.length,
            logs: filteredLogs
          }, null, 2)
        }
      ]
    };
  }

  async clearConsoleLogs(args) {
    const { sessionId } = args;
    if (!this.consoleLogs) this.consoleLogs = new Map();

    this.consoleLogs.set(sessionId, []);

    return {
      content: [
        {
          type: 'text',
          text: `Console logs cleared for session ${sessionId}`
        }
      ]
    };
  }

  async closeBrowser(args) {
    const { sessionId } = args;
    const browser = this.browsers.get(sessionId);
    if (!browser) throw new Error(`Session ${sessionId} not found`);

    await browser.close();
    this.browsers.delete(sessionId);
    this.contexts.delete(sessionId);
    this.pages.delete(sessionId);
    if (this.consoleLogs) this.consoleLogs.delete(sessionId);

    return {
      content: [
        {
          type: 'text',
          text: `Browser session ${sessionId} closed`
        }
      ]
    };
  }

  async cleanup() {
    console.log('Cleaning up browser sessions...');
    for (const [sessionId, browser] of this.browsers.entries()) {
      try {
        await browser.close();
        console.log(`Closed session ${sessionId}`);
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Browser Automation MCP server running on stdio');
  }
}

const server = new BrowserAutomationServer();
server.run().catch(console.error);
