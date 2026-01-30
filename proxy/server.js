const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from ai-game-studio/.env
require('dotenv').config({ path: path.join(__dirname, '..', 'ai-game-studio', '.env') });

const Anthropic = require('@anthropic-ai/sdk');
const InfographicGenerator = require('./infographic-generator');
const InfographicNarrator = require('./infographic-narrator');
const BrowserAutomationService = require('./browser-automation-service');
const TestLibraryManager = require('./test-library-manager');

// Create log file and override console.log
const logFile = path.join(__dirname, 'proxy.log');
const originalConsoleLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logEntry);
  originalConsoleLog(...args);
};

class ClaudeProxy {
  constructor() {
    // Create HTTP server first
    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.httpServer.listen(8081);

    // Attach WebSocket server to HTTP server
    this.wss = new WebSocket.Server({ server: this.httpServer });

    // Anthropic client for direct API calls (ONLY for commentary feature)
    // IMPORTANT: API key is NOT passed to Claude CLI processes - they use subscription login
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic();
      console.log('[PROXY] Anthropic SDK initialized for commentary feature ONLY');
      console.log('[PROXY] Claude CLI processes will use subscription login (API key excluded from env)');
    } else {
      this.anthropic = null;
      console.log('[PROXY] No ANTHROPIC_API_KEY - commentary will be disabled');
      console.log('[PROXY] Claude CLI processes will use subscription login');
    }

    this.claudeProcess = null;
    this.clients = new Set();
    this.conversationHistory = new Map(); // Track conversation per client
    this.workingDirectory = new Map(); // Track working directory per client
    this.activePipelines = new Map(); // Track active pipeline executions
    this.pipelineClients = new Map(); // Map pipeline IDs to WebSocket clients
    this.pipelinesDataDir = path.join(__dirname, 'pipelines'); // Directory for pipeline data files
    this.templatesDir = path.join(__dirname, '..', 'templates'); // Directory for template JSON files
    this.agentsDir = path.join(__dirname, '..', 'agents'); // Directory for agent JSON files
    this.pipelineInfographics = new Map(); // Track infographic generators per pipeline
    this.infographicsDir = path.join(__dirname, 'pipeline-infographics'); // Infographics output directory
    this.browserAutomation = null; // Browser automation service instance
    this.browserSessions = new Map(); // Track browser sessions per pipeline/client
    this.testLibrary = new TestLibraryManager(); // Test library manager
    this.claudeChatProcesses = new Map(); // Track Claude processes per chat conversation
    this.clientTypes = new Map(); // Track client types: 'claude-chat', 'game-studio', 'pipeline', etc.
    this.hatsDir = path.join(__dirname, '..', 'claude-chat', 'hats'); // Directory for hat JSON files

    // REST API: Track chat requests and responses
    this.chatApiRequests = new Map(); // requestId -> { status, response, streamingText, tools, errors, startTime }
    this.chatApiRequestCounter = 0;

    // REST API: Track API-created tabs with conversation history
    this.chatApiTabs = new Map(); // tabId -> { name, messages, workingDirectory, hatIds, createdAt, lastActivity }
    this.chatApiTabCounter = 0;

    this.initializePipelineStorage();
    this.initializeHatStorage();
    this.initializeTemplateStorage();
    this.initializeAgentStorage();
    this.setupWebSocketServer();
    this.loadActivePipelines(); // Load pipelines from disk
    console.log('Claude Proxy Server running on port 8081 (HTTP + WebSocket)');
  }

  handleHttpRequest(req, res) {
    // Enable CORS for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Browser automation HTTP endpoints
    if (req.url === '/browser-init' && req.method === 'POST') {
      this.handleBrowserInit(req, res);
      return;
    }

    if (req.url.startsWith('/browser-') && req.method === 'POST') {
      this.handleBrowserCommand(req, res);
      return;
    }

    // API endpoint to list available infographics
    if (req.url === '/list-infographics' && req.method === 'GET') {
      try {
        const infographics = [];

        if (fs.existsSync(this.infographicsDir)) {
          const pipelineDirs = fs.readdirSync(this.infographicsDir);

          pipelineDirs.forEach(pipelineId => {
            const pipelineDir = path.join(this.infographicsDir, pipelineId);
            const stats = fs.statSync(pipelineDir);

            // Skip files, only process directories
            if (!stats.isDirectory()) return;

            // Get all run directories
            const runDirs = fs.readdirSync(pipelineDir)
              .filter(name => name.startsWith('run_'))
              .map(runDir => {
                const runPath = path.join(pipelineDir, runDir);
                const infographicPath = path.join(runPath, 'infographic.html');
                const runStats = fs.statSync(runPath);

                if (fs.existsSync(infographicPath)) {
                  return {
                    runDir,
                    timestamp: runDir.replace('run_', ''),
                    path: infographicPath,
                    modified: runStats.mtime
                  };
                }
                return null;
              })
              .filter(run => run !== null)
              .sort((a, b) => b.modified - a.modified); // Most recent first

            if (runDirs.length === 0) return;

            // Get pipeline name from execution log
            let pipelineName = pipelineId;
            let status = 'unknown';

            try {
              const executionLogPath = path.join(this.pipelinesDataDir, `${pipelineId}_execution.json`);
              if (fs.existsSync(executionLogPath)) {
                const executionLog = JSON.parse(fs.readFileSync(executionLogPath, 'utf8'));
                const events = executionLog.events || [];

                if (events.length > 0) {
                  const lastEvent = events[events.length - 1];
                  if (lastEvent.eventType === 'pipeline_completed') {
                    status = 'completed';
                  } else if (lastEvent.eventType === 'stage_error') {
                    status = 'error';
                  } else {
                    status = 'running';
                  }

                  if (lastEvent.pipelineName) {
                    pipelineName = lastEvent.pipelineName;
                  }
                }
              }
            } catch (err) {
              console.warn(`[PROXY] Could not read execution log for ${pipelineId}:`, err.message);
            }

            // Add pipeline with all runs
            const indexPath = path.join(pipelineDir, 'index.html');
            const httpBase = path.join(__dirname, '..');  // Parent of proxy/ where HTTP server runs
            const relativeIndexPath = path.relative(httpBase, indexPath);
            const relativeLatestRunPath = path.relative(httpBase, runDirs[0].path);

            infographics.push({
              id: pipelineId,
              name: pipelineName,
              indexPath: fs.existsSync(indexPath) ? `http://localhost:3005/${relativeIndexPath.replace(/\\/g, '/')}` : null,
              latestRunPath: `http://localhost:3005/${relativeLatestRunPath.replace(/\\/g, '/')}`,
              totalRuns: runDirs.length,
              status: status,
              lastModified: runDirs[0].modified.toISOString(),
              runs: runDirs.map(run => {
                const relativeRunPath = path.relative(httpBase, run.path);
                return {
                  timestamp: run.timestamp,
                  path: `http://localhost:3005/${relativeRunPath.replace(/\\/g, '/')}`,
                  modified: run.modified.toISOString()
                };
              })
            });
          });
        }

        // Sort by last modified (newest first)
        infographics.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ infographics }));
      } catch (error) {
        console.error('[PROXY] Error listing infographics:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // API endpoint to get current pipeline state
    if (req.url === '/api/pipeline-state' && req.method === 'GET') {
      try {
        const currentStatePath = path.join(__dirname, 'pipeline-states', 'current.json');

        if (fs.existsSync(currentStatePath)) {
          const state = JSON.parse(fs.readFileSync(currentStatePath, 'utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(state));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({}));
        }
      } catch (error) {
        console.error('[PROXY] Error reading pipeline state:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Story generation moved to infographic-server.js (port 3005)

    // API endpoint to get recent execution events
    if (req.url.startsWith('/api/recent-events') && req.method === 'GET') {
      try {
        const url = new URL(req.url, `http://localhost:8081`);
        const limit = parseInt(url.searchParams.get('limit') || '10');

        // Find the most recent execution log
        let allEvents = [];

        if (fs.existsSync(this.pipelinesDataDir)) {
          const executionFiles = fs.readdirSync(this.pipelinesDataDir)
            .filter(f => f.endsWith('_execution.json'))
            .map(f => ({
              name: f,
              path: path.join(this.pipelinesDataDir, f),
              mtime: fs.statSync(path.join(this.pipelinesDataDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

          // Read the most recent execution log
          if (executionFiles.length > 0) {
            const logData = JSON.parse(fs.readFileSync(executionFiles[0].path, 'utf8'));
            allEvents = logData.events || [];
          }
        }

        // Return most recent events
        const recentEvents = allEvents.slice(-limit).reverse();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(recentEvents));
      } catch (error) {
        console.error('[PROXY] Error reading execution events:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // ========== REST API: Chat Endpoints ==========

    // POST /api/chat/send - Send a message to a specific tab
    if (req.url === '/api/chat/send' && req.method === 'POST') {
      this.handleChatApiSend(req, res);
      return;
    }

    // GET /api/chat/response/:requestId - Get/wait for response
    if (req.url.startsWith('/api/chat/response/') && req.method === 'GET') {
      const requestId = req.url.replace('/api/chat/response/', '').split('?')[0];
      this.handleChatApiResponse(req, res, requestId);
      return;
    }

    // GET /api/chat/status/:requestId - Check request status without waiting
    if (req.url.startsWith('/api/chat/status/') && req.method === 'GET') {
      const requestId = req.url.replace('/api/chat/status/', '').split('?')[0];
      this.handleChatApiStatus(req, res, requestId);
      return;
    }

    // POST /api/chat/abort/:requestId - Abort a running request
    if (req.url.startsWith('/api/chat/abort/') && req.method === 'POST') {
      const requestId = req.url.replace('/api/chat/abort/', '').split('?')[0];
      this.handleChatApiAbort(req, res, requestId);
      return;
    }

    // GET /api/chat/requests - List all active/recent requests
    if (req.url === '/api/chat/requests' && req.method === 'GET') {
      this.handleChatApiListRequests(req, res);
      return;
    }

    // ========== REST API: Tab Management Endpoints ==========

    // POST /api/tabs - Create a new tab
    if (req.url === '/api/tabs' && req.method === 'POST') {
      this.handleTabCreate(req, res);
      return;
    }

    // GET /api/tabs - List all API-created tabs
    if (req.url === '/api/tabs' && req.method === 'GET') {
      this.handleTabList(req, res);
      return;
    }

    // GET /api/tabs/:tabId - Get a specific tab
    if (req.url.match(/^\/api\/tabs\/[^\/]+$/) && req.method === 'GET') {
      const tabId = req.url.replace('/api/tabs/', '');
      this.handleTabGet(req, res, tabId);
      return;
    }

    // DELETE /api/tabs/:tabId - Delete a tab
    if (req.url.match(/^\/api\/tabs\/[^\/]+$/) && req.method === 'DELETE') {
      const tabId = req.url.replace('/api/tabs/', '');
      this.handleTabDelete(req, res, tabId);
      return;
    }

    // Default: upgrade to WebSocket
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('This service requires WebSocket connection');
  }

  // ========== REST API: Chat Handler Methods ==========

  // Helper to parse JSON body from request
  async parseJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  // POST /api/chat/send - Send a message and get a request ID
  async handleChatApiSend(req, res) {
    try {
      const body = await this.parseJsonBody(req);

      // Validate required fields
      if (!body.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'message is required' }));
        return;
      }

      // Generate request ID
      const requestId = `chat_${++this.chatApiRequestCounter}_${Date.now()}`;

      // Check if using an API-created tab
      let history = body.history || [];
      let workingDirectory = body.workingDirectory || process.cwd();
      let hatIds = body.hatIds || [];
      let tabId = body.tabId || 'api-' + requestId;
      let apiTab = null;

      if (body.tabId && this.chatApiTabs.has(body.tabId)) {
        apiTab = this.chatApiTabs.get(body.tabId);
        tabId = body.tabId;

        // Use tab's settings if not overridden in request
        workingDirectory = body.workingDirectory || apiTab.workingDirectory;
        hatIds = body.hatIds || apiTab.hatIds;

        // Build history from tab's messages
        if (history.length === 0 && apiTab.messages.length > 0) {
          // Convert messages to history format
          for (let i = 0; i < apiTab.messages.length; i += 2) {
            const userMsg = apiTab.messages[i];
            const assistantMsg = apiTab.messages[i + 1];
            if (userMsg && userMsg.role === 'user' && assistantMsg && assistantMsg.role === 'assistant') {
              history.push({
                user: userMsg.content,
                assistant: assistantMsg.content
              });
            }
          }
        }

        // Add user message to tab
        apiTab.messages.push({
          role: 'user',
          content: body.message,
          timestamp: Date.now()
        });
        apiTab.lastActivity = Date.now();

        console.log(`[PROXY] [API] Using API tab ${tabId} with ${history.length} history pairs`);
      }

      // Initialize request tracking
      this.chatApiRequests.set(requestId, {
        status: 'running',
        response: null,
        streamingText: '',
        tools: [],
        todos: [],
        errors: [],
        startTime: Date.now(),
        tabId: tabId,
        apiTab: apiTab, // Reference to API tab for updating
        message: body.message,
        workingDirectory: workingDirectory,
        hatIds: hatIds,
        history: history,
        pipelineId: body.pipelineId || null
      });

      console.log(`[PROXY] [API] Chat request ${requestId} started: "${body.message.substring(0, 50)}..."`);

      // Start the Claude process asynchronously
      this.executeChatApiRequest(requestId, body);

      // Return the request ID immediately
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        requestId,
        tabId,
        status: 'running',
        message: 'Request accepted, use GET /api/chat/response/' + requestId + ' to get the response'
      }));

    } catch (error) {
      console.error('[PROXY] [API] Chat send error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // GET /api/chat/response/:requestId - Wait for and return the response
  async handleChatApiResponse(req, res, requestId) {
    const request = this.chatApiRequests.get(requestId);

    if (!request) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request not found' }));
      return;
    }

    // Parse timeout from query string (default 5 minutes)
    const url = new URL(req.url, 'http://localhost:8081');
    const timeoutMs = parseInt(url.searchParams.get('timeout') || '300000');
    const pollInterval = 100; // Check every 100ms

    const startWait = Date.now();

    // Poll until response is ready or timeout
    const checkResponse = () => {
      const req = this.chatApiRequests.get(requestId);

      if (!req) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request not found' }));
        return;
      }

      if (req.status === 'completed' || req.status === 'error' || req.status === 'aborted') {
        // Clean up old requests after response (keep for 5 minutes)
        setTimeout(() => this.chatApiRequests.delete(requestId), 300000);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          requestId,
          status: req.status,
          response: req.response,
          tools: req.tools,
          todos: req.todos,
          errors: req.errors,
          duration: Date.now() - req.startTime
        }));
        return;
      }

      // Check timeout
      if (Date.now() - startWait > timeoutMs) {
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          requestId,
          status: 'timeout',
          message: 'Request is still running, try again later',
          streamingText: req.streamingText.slice(-1000) // Last 1000 chars of progress
        }));
        return;
      }

      // Keep polling
      setTimeout(checkResponse, pollInterval);
    };

    checkResponse();
  }

  // GET /api/chat/status/:requestId - Check status without waiting
  handleChatApiStatus(req, res, requestId) {
    const request = this.chatApiRequests.get(requestId);

    if (!request) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requestId,
      status: request.status,
      duration: Date.now() - request.startTime,
      toolCount: request.tools.length,
      todoCount: request.todos.length,
      streamingProgress: request.streamingText.length,
      hasResponse: request.response !== null
    }));
  }

  // POST /api/chat/abort/:requestId - Abort a running request
  async handleChatApiAbort(req, res, requestId) {
    const request = this.chatApiRequests.get(requestId);

    if (!request) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request not found' }));
      return;
    }

    if (request.status !== 'running') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request is not running', status: request.status }));
      return;
    }

    // Kill the Claude process if it exists
    const claude = this.claudeChatProcesses.get(requestId);
    if (claude) {
      claude.kill('SIGTERM');
      this.claudeChatProcesses.delete(requestId);
    }

    request.status = 'aborted';
    request.response = request.streamingText || 'Request was aborted';

    console.log(`[PROXY] [API] Chat request ${requestId} aborted`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requestId,
      status: 'aborted',
      message: 'Request has been aborted'
    }));
  }

  // GET /api/chat/requests - List all active/recent requests
  handleChatApiListRequests(req, res) {
    const requests = [];
    for (const [requestId, request] of this.chatApiRequests) {
      requests.push({
        requestId,
        status: request.status,
        message: request.message.substring(0, 100) + (request.message.length > 100 ? '...' : ''),
        startTime: new Date(request.startTime).toISOString(),
        duration: Date.now() - request.startTime,
        tabId: request.tabId
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ requests }));
  }

  // ========== REST API: Tab Management Handler Methods ==========

  // POST /api/tabs - Create a new tab
  async handleTabCreate(req, res) {
    try {
      const body = await this.parseJsonBody(req);

      // Generate tab ID if not provided
      const tabId = body.tabId || `api-tab-${++this.chatApiTabCounter}-${Date.now()}`;

      // Check if tab already exists
      if (this.chatApiTabs.has(tabId)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tab already exists', tabId }));
        return;
      }

      // Create the tab
      const tab = {
        name: body.name || tabId,
        messages: [],
        workingDirectory: body.workingDirectory || process.cwd(),
        hatIds: body.hatIds || [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      this.chatApiTabs.set(tabId, tab);

      console.log(`[PROXY] [API] Tab created: ${tabId} (name: ${tab.name})`);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tabId,
        name: tab.name,
        workingDirectory: tab.workingDirectory,
        hatIds: tab.hatIds,
        createdAt: new Date(tab.createdAt).toISOString(),
        message: 'Tab created successfully'
      }));

    } catch (error) {
      console.error('[PROXY] [API] Tab create error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  // GET /api/tabs - List all API-created tabs
  handleTabList(req, res) {
    const tabs = [];
    for (const [tabId, tab] of this.chatApiTabs) {
      tabs.push({
        tabId,
        name: tab.name,
        messageCount: tab.messages.length,
        workingDirectory: tab.workingDirectory,
        hatIds: tab.hatIds,
        createdAt: new Date(tab.createdAt).toISOString(),
        lastActivity: new Date(tab.lastActivity).toISOString()
      });
    }

    // Sort by last activity (most recent first)
    tabs.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tabs }));
  }

  // GET /api/tabs/:tabId - Get a specific tab
  handleTabGet(req, res, tabId) {
    const tab = this.chatApiTabs.get(tabId);

    if (!tab) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tab not found', tabId }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tabId,
      name: tab.name,
      messages: tab.messages,
      workingDirectory: tab.workingDirectory,
      hatIds: tab.hatIds,
      createdAt: new Date(tab.createdAt).toISOString(),
      lastActivity: new Date(tab.lastActivity).toISOString()
    }));
  }

  // DELETE /api/tabs/:tabId - Delete a tab
  handleTabDelete(req, res, tabId) {
    if (!this.chatApiTabs.has(tabId)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tab not found', tabId }));
      return;
    }

    this.chatApiTabs.delete(tabId);

    console.log(`[PROXY] [API] Tab deleted: ${tabId}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tabId,
      message: 'Tab deleted successfully'
    }));
  }

  // Execute a chat request via REST API
  async executeChatApiRequest(requestId, body) {
    const request = this.chatApiRequests.get(requestId);
    if (!request) return;

    const workingDir = request.workingDirectory;

    try {
      // Build hat context if specified
      let hatContext = '';
      if (request.hatIds.length > 0) {
        hatContext = this.buildMultiHatContext(request.hatIds);
      }

      // Build conversation history context
      let contextMessages = '';
      if (request.history.length > 0) {
        const recentHistory = request.history.slice(-10);
        contextMessages = recentHistory.map(h =>
          `Human: ${h.user}\n\nAssistant: ${h.assistant}`
        ).join('\n\n---\n\n');
        contextMessages = `\n\nPrevious conversation:\n${contextMessages}\n\n---\n\nCurrent request: `;
      }

      const fullMessage = hatContext + contextMessages + body.message;

      // Spawn Claude with streaming
      const { ANTHROPIC_API_KEY: _apiKey, ...cleanEnv } = process.env;
      const claude = spawn('claude', [
        '--permission-mode', 'bypassPermissions',
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '-'
      ], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...cleanEnv, PWD: workingDir }
      });

      // Track the process so we can abort it
      this.claudeChatProcesses.set(requestId, claude);

      let lineBuffer = '';
      let currentToolBlock = null;

      claude.stdout.on('data', (data) => {
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            let event = JSON.parse(line);
            if (event.type === 'stream_event' && event.event) {
              event = event.event;
            }

            // Tool start
            if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
              const block = event.content_block;
              currentToolBlock = { name: block.name, id: block.id, input: '', startTime: Date.now() };
              request.tools.push({ name: block.name, status: 'running', startTime: Date.now() });
            }

            // Text streaming
            else if (event.type === 'content_block_delta') {
              const delta = event.delta;

              if (delta?.type === 'text_delta' && delta.text) {
                request.streamingText += delta.text;
              }

              // Tool input
              else if (delta?.type === 'input_json_delta' && currentToolBlock) {
                currentToolBlock.input += delta.partial_json || '';
              }
            }

            // Block stop
            else if (event.type === 'content_block_stop' && currentToolBlock) {
              let parsedInput = currentToolBlock.input;
              try { parsedInput = JSON.parse(currentToolBlock.input); } catch (e) {}

              // Update tool status
              const tool = request.tools.find(t => t.name === currentToolBlock.name && t.status === 'running');
              if (tool) {
                tool.status = 'completed';
                tool.duration = Date.now() - tool.startTime;
                if (parsedInput.file_path) tool.file = parsedInput.file_path;
              }

              // Special handling for TodoWrite
              if (currentToolBlock.name === 'TodoWrite' && parsedInput?.todos) {
                request.todos = parsedInput.todos;
              }

              currentToolBlock = null;
            }

            // Result event (final output)
            else if (event.type === 'result' && event.result) {
              request.streamingText = event.result;
            }

          } catch (e) {
            // Not JSON, might be plain text output
            request.streamingText += line + '\n';
          }
        }
      });

      claude.stderr.on('data', (data) => {
        console.log(`[PROXY] [API] Claude stderr: ${data.toString()}`);
        request.errors.push(data.toString());
      });

      claude.on('close', (code) => {
        // Remove from tracking
        this.claudeChatProcesses.delete(requestId);

        // Mark as completed
        request.status = code === 0 ? 'completed' : 'error';
        request.response = request.streamingText.trim();

        // If using an API tab, add the assistant response to the tab
        if (request.apiTab) {
          request.apiTab.messages.push({
            role: 'assistant',
            content: request.response,
            timestamp: Date.now()
          });
          request.apiTab.lastActivity = Date.now();
          console.log(`[PROXY] [API] Added assistant response to API tab ${request.tabId}`);
        }

        console.log(`[PROXY] [API] Chat request ${requestId} completed with code ${code}`);
      });

      claude.on('error', (error) => {
        console.error('[PROXY] [API] Claude spawn error:', error);
        this.claudeChatProcesses.delete(requestId);
        request.status = 'error';
        request.errors.push(error.message);
        request.response = `Failed to start Claude: ${error.message}`;
      });

      // Send the message
      claude.stdin.write(fullMessage + '\n');
      claude.stdin.end();

    } catch (error) {
      console.error('[PROXY] [API] executeChatApiRequest error:', error);
      request.status = 'error';
      request.errors.push(error.message);
      request.response = `Error: ${error.message}`;
    }
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws) => {
      console.log('[PROXY] Windows client connected');
      this.clients.add(ws);

      // Initialize conversation history and working directory for this client
      this.conversationHistory.set(ws, []);
      this.workingDirectory.set(ws, process.cwd()); // Default to current working directory

      // Send connection confirmation
      console.log('[PROXY] Sending connection confirmation to client');
      ws.send(JSON.stringify({
        type: 'system',
        content: 'Connected to proxy server'
      }));

      ws.on('message', (data) => {
        console.log('[PROXY] Received message from client:', data.toString());
        try {
          const message = JSON.parse(data.toString());
          
          this.handleClientMessage(message, ws);
        } catch (error) {
          console.error('[PROXY] Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.conversationHistory.delete(ws);
        this.workingDirectory.delete(ws);
        this.clientTypes.delete(ws);
        console.log('[PROXY] Windows client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[PROXY] WebSocket error:', error);
      });
    });
  }


  async handleBrowserInit(req, res) {
    try {
      if (!this.browserAutomation) {
        this.browserAutomation = new BrowserAutomationService();
        await this.browserAutomation.start();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready', message: 'Browser automation initialized' }));
    } catch (error) {
      console.error('[PROXY] Browser init failed:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handleBrowserCommand(req, res) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        if (!this.browserAutomation) {
          throw new Error('Browser automation not initialized. Call /browser-init first.');
        }

        const args = body ? JSON.parse(body) : {};
        const command = req.url.replace('/browser-', '');
        let result;

        switch (command) {
          case 'launch':
            result = await this.browserAutomation.launchBrowser(args);
            result = { sessionId: result };
            break;

          case 'navigate':
            result = await this.browserAutomation.navigate(args.sessionId, args.url, args.waitUntil);
            break;

          case 'click':
            result = await this.browserAutomation.click(args.sessionId, args.selector, args.timeout);
            break;

          case 'type':
            result = await this.browserAutomation.type(args.sessionId, args.selector, args.text, args.delay);
            break;

          case 'evaluate':
            result = await this.browserAutomation.evaluate(args.sessionId, args.script);
            break;

          case 'screenshot':
            result = await this.browserAutomation.screenshot(args.sessionId, args.path, args.options);
            break;

          case 'get-console-logs':
            result = await this.browserAutomation.getConsoleLogs(args.sessionId, args.filter, args.clear);
            break;

          case 'clear-console-logs':
            result = await this.browserAutomation.clearConsoleLogs(args.sessionId);
            break;

          case 'close':
            result = await this.browserAutomation.closeBrowser(args.sessionId);
            break;

          default:
            throw new Error(`Unknown browser command: ${command}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (error) {
        console.error('[PROXY] Browser command failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message, stack: error.stack }));
      }
    });
  }

  async handleClientMessage(message, ws) {
    if (message.type === 'get-system-metrics') {
      // 🚀 CEREBRO ENHANCEMENT: System metrics endpoint
      console.log(`[PROXY] Client requesting system metrics`);
      
      const metrics = this.getSystemMetrics();
      ws.send(JSON.stringify({
        type: 'system-metrics',
        content: metrics
      }));
      
    } else if (message.type === 'check-running-pipeline') {
      console.log(`[PROXY] Client checking for running pipeline`);
      
      const runningPipeline = await this.loadCurrentPipelineState();
      if (runningPipeline) {
        ws.send(JSON.stringify({
          type: 'pipeline-reconnect',
          content: {
            pipeline: runningPipeline,
            message: `Found running pipeline: ${runningPipeline.name}`,
            currentStage: runningPipeline.currentStage,
            completedStages: runningPipeline.completedStages.length,
            totalStages: runningPipeline.stages.length,
            startTime: runningPipeline.startTime
          }
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'no-running-pipeline',
          content: { message: 'No running pipeline found' }
        }));
      }
      
    } else if (message.type === 'pipeline-config') {
      console.log(`[PROXY] Pipeline configuration received from designer`);
      
      // Store pipeline configuration for this client
      this.pipelineConfig = message.pipeline;
      
      // Send confirmation back to designer
      ws.send(JSON.stringify({
        type: 'pipeline-config-received',
        pipeline: message.pipeline.name,
        stages: message.pipeline.stages?.length || 0
      }));
      
      console.log(`[PROXY] Pipeline "${message.pipeline.name}" configured with ${message.pipeline.stages?.length || 0} stages`);
      
    } else if (message.type === 'resume-pipeline') {
      console.log(`[PROXY] Pipeline resume request: ${message.pipelineId}`);

      try {
        await this.resumePipeline(message.pipelineId, ws);
      } catch (error) {
        console.error('[PROXY] Failed to resume pipeline:', error);
        ws.send(JSON.stringify({
          type: 'resume-error',
          error: error.message
        }));
      }

    } else if (message.type === 'directory-change') {
      console.log(`[PROXY] Directory change request: ${message.directory}`);

      // Convert Windows paths to WSL paths
      let wslPath = message.directory;
      if (message.directory.match(/^[A-Z]:\\/)) {
        // Convert C:\path\to\dir to /mnt/c/path/to/dir
        wslPath = message.directory.replace(/^([A-Z]):\\/, '/mnt/$1/').replace(/\\/g, '/').toLowerCase();
        console.log(`[PROXY] Converted Windows path to WSL: ${message.directory} -> ${wslPath}`);
      }
      
      // Clean up any double slashes or malformed paths
      wslPath = wslPath.replace(/\/+/g, '/').replace(/\/$/, '');
      console.log(`[PROXY] Cleaned WSL path: ${wslPath}`);
      
      // Validate directory exists
      if (fs.existsSync(wslPath)) {
        this.workingDirectory.set(ws, wslPath);
        console.log(`[PROXY] Working directory updated to: ${wslPath}`);
        
        // Send confirmation back to client
        ws.send(JSON.stringify({
          type: 'directory-changed',
          directory: wslPath
        }));
      } else {
        console.log(`[PROXY] Directory ${wslPath} does not exist, using current directory`);
        // Use current working directory as fallback
        const fallbackDir = process.cwd();
        this.workingDirectory.set(ws, fallbackDir);
        
        ws.send(JSON.stringify({
          type: 'directory-changed',
          directory: fallbackDir,
          warning: `Original path not found, using: ${fallbackDir}`
        }));
      }
    } else if (message.type === 'search-artifacts') {
      console.log(`[PROXY] Searching for artifacts in paths:`, message.paths);
      
      const fs = require('fs');
      const path = require('path');
      const artifacts = [];
      
      try {
        for (const searchPath of message.paths) {
          if (fs.existsSync(searchPath)) {
            const files = fs.readdirSync(searchPath);
            
            for (const file of files) {
              const filePath = path.join(searchPath, file);
              const stats = fs.statSync(filePath);
              
              if (stats.isFile()) {
                const ext = path.extname(file).toLowerCase();
                if (message.extensions.includes(ext)) {
                  artifacts.push({
                    name: file,
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    type: getFileType(file, ext)
                  });
                }
              }
            }
          }
        }
        
        console.log(`[PROXY] Found ${artifacts.length} artifacts`);
        
        ws.send(JSON.stringify({
          type: 'artifacts-found',
          artifacts: artifacts
        }));
        
      } catch (error) {
        console.error(`[PROXY] Error searching artifacts:`, error);
        ws.send(JSON.stringify({
          type: 'artifacts-error',
          error: error.message
        }));
      }
      
    } else if (message.type === 'check-active-pipelines') {
      console.log('[PROXY] Client checking for active pipelines');
      
      const activePipelineList = Array.from(this.activePipelines.entries()).map(([id, pipeline]) => ({
        id,
        prompt: pipeline.prompt,
        startTime: pipeline.startTime,
        status: pipeline.status,
        progress: pipeline.progress || 'Running...'
      }));

      // Also check for file-based pipeline states (like CEREBRO)
      try {
        const fs = require('fs');
        const path = require('path');

        // Check proxy/pipeline-states, proxy/pipelines, and output/.pipeline-state directories
        const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';
        const pipelineStateDirs = [
          path.join(baseDir, 'proxy/pipeline-states'),
          path.join(baseDir, 'proxy/pipelines'),
          path.join(baseDir, 'output/.pipeline-state')
        ];
        
        for (const stateDir of pipelineStateDirs) {
          if (fs.existsSync(stateDir)) {
            const files = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
            
            for (const file of files) {
              try {
                const filePath = path.join(stateDir, file);
                const pipelineState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // Only include if status is 'running' and not already in activePipelines
                if (pipelineState.status === 'running' && !activePipelineList.find(p => p.id === pipelineState.pipelineId || p.id === pipelineState.id)) {
                  const pipelineId = pipelineState.pipelineId || pipelineState.id;

                  // Verify the process is actually running by checking PID
                  let processIsAlive = false;
                  if (pipelineState.pid) {
                    try {
                      // Check if process exists (kill with signal 0 doesn't kill, just checks)
                      process.kill(pipelineState.pid, 0);
                      processIsAlive = true;
                      console.log(`[PROXY] Pipeline ${pipelineId} has alive process: ${pipelineState.pid}`);
                    } catch (e) {
                      console.log(`[PROXY] Pipeline ${pipelineId} process ${pipelineState.pid} is dead`);
                      processIsAlive = false;
                    }
                  }

                  // Only include if process is actually alive
                  if (processIsAlive) {
                    activePipelineList.push({
                      id: pipelineId,
                      prompt: pipelineState.userContext || pipelineState.name || 'Running pipeline',
                      startTime: pipelineState.startTime,
                      status: pipelineState.status,
                      progress: `${pipelineState.completedStages?.length || 0}/${pipelineState.totalStages || 0} stages completed`,
                      currentStage: pipelineState.currentStage,
                      name: pipelineState.name,
                      template: pipelineState.template,
                      pid: pipelineState.pid
                    });
                  }
                }
              } catch (err) {
                console.warn(`[PROXY] Error reading pipeline state file ${file}:`, err.message);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[PROXY] Error checking pipeline state files:', err.message);
      }
      
      ws.send(JSON.stringify({
        type: 'active-pipelines',
        pipelines: activePipelineList
      }));
      
    } else if (message.type === 'reconnect-pipeline') {
      console.log(`[PROXY] Client reconnecting to pipeline: ${message.pipelineId}`);

      if (this.activePipelines.has(message.pipelineId)) {
        this.pipelineClients.set(message.pipelineId, ws);

        // Load pipeline state and chat history
        const chatHistory = [];
        let pipelineData = null;

        try {
          const fs = require('fs');
          const path = require('path');
          const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';

          // Try to load pipeline state file
          const pipelineStateDirs = [
            path.join(baseDir, 'proxy/pipeline-states'),
            path.join(baseDir, 'proxy/pipelines')
          ];

          for (const stateDir of pipelineStateDirs) {
            const filePath = path.join(stateDir, `${message.pipelineId}.json`);
            if (fs.existsSync(filePath)) {
              pipelineData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              break;
            }
          }

          // Try to load execution log
          const executionLogPath = path.join(baseDir, 'proxy/pipelines', `${message.pipelineId}_execution.json`);
          console.log(`[PROXY] Looking for execution log at: ${executionLogPath}`);
          const stageOutputs = {}; // Store all stage outputs
          let executionEvents = []; // Store all events for replay

          if (fs.existsSync(executionLogPath)) {
            console.log(`[PROXY] Execution log found! Loading...`);
            const executionLogContent = fs.readFileSync(executionLogPath, 'utf8');
            console.log(`[PROXY] Execution log size: ${executionLogContent.length} bytes`);

            // Parse execution log - could be JSON array or newline-delimited JSON
            try {
              const parsed = JSON.parse(executionLogContent);
              executionEvents = parsed.events || [];
              console.log(`[PROXY] Parsed ${executionEvents.length} execution events from JSON`);
            } catch (e) {
              // Try newline-delimited JSON
              console.log(`[PROXY] JSON parse failed, trying newline-delimited format...`);
              executionEvents = executionLogContent.trim().split('\n').map(line => JSON.parse(line));
              console.log(`[PROXY] Parsed ${executionEvents.length} execution events from newline-delimited format`);
            }
          } else {
            console.log(`[PROXY] ⚠️ Execution log NOT found at ${executionLogPath}`);
          }

          // Convert execution events to chat history AND collect stage outputs
          for (const event of executionEvents) {
            if (event.eventType === 'stage_completed') {
              // Store the full output for this stage
              stageOutputs[event.stageId] = {
                stageName: event.stageName,
                agent: event.agent,
                output: event.output || '',
                prompt: event.prompt || '',
                outputLength: event.outputLength,
                promptLength: event.promptLength,
                timestamp: event.timestamp
              };

              chatHistory.push({
                type: 'success',
                title: `${event.stageName} COMPLETED`,
                message: `✅ Stage completed successfully`,
                details: `Agent: ${event.agent}\nOutput: ${event.outputLength} characters\nPrompt: ${event.promptLength} characters`,
                timestamp: event.timestamp,
                output: event.output,
                prompt: event.prompt
              });
            } else if (event.eventType === 'stage_started') {
              chatHistory.push({
                type: 'info',
                title: `${event.stageName} STARTED`,
                message: `🔄 Processing with ${event.agent}`,
                timestamp: event.timestamp,
                prompt: event.prompt,
                stageId: event.stageId,
                agent: event.agent,
                stageName: event.stageName
              });
            } else if (event.eventType === 'stage_error') {
              chatHistory.push({
                type: 'error',
                title: `${event.stageName} ERROR`,
                message: `❌ ${event.error}`,
                timestamp: event.timestamp,
                error: event.error,
                stack: event.stack,
                stageId: event.stageId
              });
            } else if (event.eventType === 'stage_routed') {
              chatHistory.push({
                type: 'info',
                title: 'ROUTING',
                message: `➡️ ${event.fromStage} → ${event.toStage}`,
                details: `Decision: ${event.decision}\n${event.reasoning}`,
                timestamp: event.timestamp
              });
            }
          }
        } catch (err) {
          console.warn(`[PROXY] Error loading pipeline data for reconnect:`, err.message);
          console.warn(`[PROXY] Stack trace:`, err.stack);
        }

        console.log(`[PROXY] Sending reconnection response with:`);
        console.log(`  - Chat history entries: ${chatHistory.length}`);
        console.log(`  - Execution events: ${executionEvents.length}`);
        console.log(`  - Stage outputs: ${Object.keys(stageOutputs).length}`);
        console.log(`  - Pipeline data: ${pipelineData ? 'loaded' : 'not found'}`);

        ws.send(JSON.stringify({
          type: 'pipeline-reconnected',
          pipelineId: message.pipelineId,
          status: 'Connected to running pipeline',
          pipelineData: pipelineData,
          chatHistory: chatHistory,
          stageOutputs: stageOutputs, // Include all stage outputs
          executionEvents: executionEvents // Include raw execution events for detailed replay
        }));
      } else {
        // Check for file-based pipeline states (like CEREBRO)
        try {
          const fs = require('fs');
          const path = require('path');

          const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';
          const pipelineStateDirs = [
            path.join(baseDir, 'proxy/pipeline-states'),
            path.join(baseDir, 'proxy/pipelines'),
            path.join(baseDir, 'output/.pipeline-state')
          ];
          
          let pipelineFound = false;
          let pipelineData = null;
          
          for (const stateDir of pipelineStateDirs) {
            const filePath = path.join(stateDir, `${message.pipelineId}.json`);
            if (fs.existsSync(filePath)) {
              pipelineData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (pipelineData.status === 'running') {
                pipelineFound = true;
                break;
              }
            }
          }
          
          if (pipelineFound && pipelineData) {
            // Create a virtual connection for file-based pipelines
            this.pipelineClients.set(message.pipelineId, ws);

            // Load any existing outputs/chat history for this pipeline
            const chatHistory = [];
            const stageOutputs = {}; // Store all stage outputs
            let executionEvents = []; // Store all events for replay

            // Try to load execution log
            const executionLogPath = path.join(baseDir, 'proxy/pipelines', `${message.pipelineId}_execution.json`);
            console.log(`[PROXY] [FILE-BASED] Looking for execution log at: ${executionLogPath}`);

            if (fs.existsSync(executionLogPath)) {
              console.log(`[PROXY] [FILE-BASED] Execution log found! Loading...`);
              const executionLogContent = fs.readFileSync(executionLogPath, 'utf8');
              console.log(`[PROXY] [FILE-BASED] Execution log size: ${executionLogContent.length} bytes`);

              // Parse execution log - could be JSON array or newline-delimited JSON
              try {
                const parsed = JSON.parse(executionLogContent);
                executionEvents = parsed.events || [];
                console.log(`[PROXY] [FILE-BASED] Parsed ${executionEvents.length} execution events from JSON`);
              } catch (e) {
                // Try newline-delimited JSON
                console.log(`[PROXY] [FILE-BASED] JSON parse failed, trying newline-delimited format...`);
                executionEvents = executionLogContent.trim().split('\n').map(line => JSON.parse(line));
                console.log(`[PROXY] [FILE-BASED] Parsed ${executionEvents.length} execution events from newline-delimited format`);
              }

              // Convert execution events to chat history AND collect stage outputs
              for (const event of executionEvents) {
                if (event.eventType === 'stage_completed') {
                  // Store the full output for this stage
                  stageOutputs[event.stageId] = {
                    stageName: event.stageName,
                    agent: event.agent,
                    output: event.output || '',
                    prompt: event.prompt || '',
                    outputLength: event.outputLength,
                    promptLength: event.promptLength,
                    timestamp: event.timestamp
                  };

                  chatHistory.push({
                    type: 'success',
                    title: `${event.stageName} COMPLETED`,
                    message: `✅ Stage completed successfully`,
                    details: `Agent: ${event.agent}\nOutput: ${event.outputLength} characters\nPrompt: ${event.promptLength} characters`,
                    timestamp: event.timestamp,
                    output: event.output,
                    prompt: event.prompt
                  });
                } else if (event.eventType === 'stage_started') {
                  chatHistory.push({
                    type: 'info',
                    title: `${event.stageName} STARTED`,
                    message: `🔄 Processing with ${event.agent}`,
                    timestamp: event.timestamp,
                    prompt: event.prompt,
                    stageId: event.stageId,
                    agent: event.agent,
                    stageName: event.stageName
                  });
                } else if (event.eventType === 'stage_error') {
                  chatHistory.push({
                    type: 'error',
                    title: `${event.stageName} ERROR`,
                    message: `❌ ${event.error}`,
                    timestamp: event.timestamp,
                    error: event.error,
                    stack: event.stack,
                    stageId: event.stageId
                  });
                } else if (event.eventType === 'stage_routed') {
                  chatHistory.push({
                    type: 'info',
                    title: 'ROUTING',
                    message: `➡️ ${event.fromStage} → ${event.toStage}`,
                    details: `Decision: ${event.decision}\n${event.reasoning}`,
                    timestamp: event.timestamp
                  });
                }
              }
            } else {
              console.log(`[PROXY] [FILE-BASED] ⚠️ Execution log NOT found at ${executionLogPath}`);
            }
            try {
              const outputDir = path.join(baseDir, 'output');
              
              // Add pipeline status information
              chatHistory.push({
                type: 'info',
                title: 'Pipeline Status',
                message: `🧠 ${pipelineData.name}`,
                details: `Status: ${pipelineData.status}\nCurrent Stage: ${pipelineData.currentStage}\nProgress: ${pipelineData.completedStages?.length || 0}/${pipelineData.totalStages || 0} stages`,
                timestamp: new Date().toISOString()
              });
              
              // Add completed stages with details
              if (pipelineData.stages && pipelineData.stages.length > 0) {
                for (const stage of pipelineData.stages) {
                  if (stage.status === 'completed') {
                    chatHistory.push({
                      type: 'success',
                      title: `${stage.id.toUpperCase()} COMPLETED`,
                      message: `✅ Stage completed successfully`,
                      details: `Started: ${new Date(stage.startTime).toLocaleString()}\nEnded: ${new Date(stage.endTime).toLocaleString()}`,
                      timestamp: stage.endTime || stage.startTime
                    });
                  } else if (stage.status === 'in_progress') {
                    chatHistory.push({
                      type: 'info',
                      title: `${stage.id.toUpperCase()} IN PROGRESS`,
                      message: `🔄 Currently processing this stage...`,
                      details: `Started: ${new Date(stage.startTime).toLocaleString()}`,
                      timestamp: stage.startTime
                    });
                  }
                }
              }
              
              // Add summary of completed stages
              if (pipelineData.completedStages && pipelineData.completedStages.length > 0) {
                chatHistory.push({
                  type: 'success',
                  title: 'Progress Summary',
                  message: `📊 ${pipelineData.completedStages.length}/${pipelineData.totalStages} stages completed`,
                  details: `Completed: ${pipelineData.completedStages.join(', ')}\nCurrent: ${pipelineData.currentStage}`,
                  timestamp: new Date().toISOString()
                });
              }
              
              // Add sample CEREBRO output if this is CEREBRO
              if (message.pipelineId.includes('cerebro')) {
                chatHistory.push({
                  type: 'agent',
                  title: 'CEREBRO System Analysis',
                  message: `🧠 CEREBRO PROTOCOL: MISSION ACCOMPLISHED`,
                  details: `CEREBRO has successfully executed the system analysis phase and identified key improvement opportunities for the pipeline designer.`,
                  timestamp: new Date().toISOString()
                });
              }
              
            } catch (err) {
              console.warn(`[PROXY] Error loading pipeline outputs:`, err.message);
            }

            console.log(`[PROXY] [FILE-BASED] Sending reconnection response with:`);
            console.log(`  - Chat history entries: ${chatHistory.length}`);
            console.log(`  - Execution events: ${executionEvents.length}`);
            console.log(`  - Stage outputs: ${Object.keys(stageOutputs).length}`);
            console.log(`  - Pipeline data: ${pipelineData ? 'loaded' : 'not found'}`);

            ws.send(JSON.stringify({
              type: 'pipeline-reconnected',
              pipelineId: message.pipelineId,
              status: 'Connected to file-based pipeline',
              pipelineData: pipelineData,
              chatHistory: chatHistory,
              stageOutputs: stageOutputs, // Include all stage outputs
              executionEvents: executionEvents // Include raw execution events for detailed replay
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'pipeline-reconnect-failed',
              pipelineId: message.pipelineId,
              error: 'Pipeline not found or no longer active'
            }));
          }
        } catch (err) {
          console.error(`[PROXY] Error reconnecting to file-based pipeline:`, err);
          ws.send(JSON.stringify({
            type: 'pipeline-reconnect-failed',
            pipelineId: message.pipelineId,
            error: 'Error reading pipeline state'
          }));
        }
      }
      
    } else if (message.type === 'delete-pipeline') {
      console.log(`[PROXY] Deleting pipeline: ${message.pipelineId}`);
      
      if (this.activePipelines.has(message.pipelineId)) {
        const pipeline = this.activePipelines.get(message.pipelineId);
        
        try {
          // Kill the process if it's still running
          if (pipeline.pid) {
            const { exec } = require('child_process');
            exec(`kill -9 ${pipeline.pid}`, (error) => {
              if (error) {
                console.log(`[PROXY] Process ${pipeline.pid} may have already terminated`);
              } else {
                console.log(`[PROXY] Killed process ${pipeline.pid} for pipeline ${message.pipelineId}`);
              }
            });
          }
          
          // Remove from active pipelines
          this.activePipelines.delete(message.pipelineId);
          this.pipelineClients.delete(message.pipelineId);
          
          // Delete the data file
          const deleted = this.deletePipelineData(message.pipelineId);
          
          ws.send(JSON.stringify({
            type: 'pipeline-deleted',
            pipelineId: message.pipelineId,
            success: deleted
          }));
          
          console.log(`[PROXY] Pipeline ${message.pipelineId} deleted successfully`);
          
        } catch (error) {
          console.error(`[PROXY] Error deleting pipeline ${message.pipelineId}:`, error);
          ws.send(JSON.stringify({
            type: 'pipeline-delete-failed',
            pipelineId: message.pipelineId,
            error: error.message
          }));
        }
      } else {
        // Pipeline might not be active but still have data file
        const deleted = this.deletePipelineData(message.pipelineId);
        
        ws.send(JSON.stringify({
          type: 'pipeline-deleted',
          pipelineId: message.pipelineId,
          success: deleted
        }));
      }

    } else if (message.type === 'inject-pipeline-feedback') {
      console.log(`[PROXY] Injecting user feedback into pipeline: ${message.pipelineId}`);

      try {
        // Load current pipeline state
        const statePath = path.join(__dirname, 'pipeline-states', `${message.pipelineId}.json`);
        const currentPath = path.join(__dirname, 'pipeline-states', 'current.json');

        let pipelineState = null;

        // Try to load by specific ID first, then current
        if (message.pipelineId && fs.existsSync(statePath)) {
          pipelineState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        } else if (fs.existsSync(currentPath)) {
          pipelineState = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
        }

        if (!pipelineState) {
          throw new Error('No active pipeline found to inject feedback');
        }

        // Initialize userFeedback array if not present
        if (!pipelineState.userFeedback) {
          pipelineState.userFeedback = [];
        }

        // Add the feedback with timestamp
        const feedbackEntry = {
          timestamp: new Date().toISOString(),
          message: message.feedback,
          stage: pipelineState.currentStage,
          stageIndex: pipelineState.currentStageIndex,
          consumed: false  // Will be marked true once an agent receives it
        };

        pipelineState.userFeedback.push(feedbackEntry);

        // Save updated pipeline state
        fs.writeFileSync(statePath, JSON.stringify(pipelineState, null, 2));
        fs.writeFileSync(currentPath, JSON.stringify(pipelineState, null, 2));

        console.log(`[PROXY] Feedback injected: "${message.feedback.substring(0, 50)}..."`);
        console.log(`[PROXY] Total feedback entries: ${pipelineState.userFeedback.length}`);

        // Log the feedback injection
        this.logPipelineExecution(pipelineState.id, 'user_feedback_injected', {
          feedback: message.feedback,
          currentStage: pipelineState.currentStage,
          stageIndex: pipelineState.currentStageIndex,
          totalFeedback: pipelineState.userFeedback.length
        });

        // Send confirmation back
        ws.send(JSON.stringify({
          type: 'feedback-injected',
          pipelineId: pipelineState.id,
          feedbackCount: pipelineState.userFeedback.length,
          message: `Feedback will be included in the next stage: "${pipelineState.currentStage}"`
        }));

        // Send feedback update to the originating client only
        // (ws already received the injection-ack above)

      } catch (error) {
        console.error('[PROXY] Failed to inject feedback:', error);
        ws.send(JSON.stringify({
          type: 'feedback-error',
          error: error.message
        }));
      }

    } else if (message.type === 'get-templates') {
      console.log('[PROXY] Client requesting all templates');
      
      try {
        const templates = this.getAllTemplates();
        console.log(`[PROXY] Got ${templates.length} templates, sending response`);
        
        ws.send(JSON.stringify({
          type: 'templates-list',
          templates: templates
        }));
        
        console.log('[PROXY] Templates response sent');
      } catch (error) {
        console.error('[PROXY] Error in get-templates handler:', error);
        ws.send(JSON.stringify({
          type: 'templates-error',
          error: error.message
        }));
      }
      
    } else if (message.type === 'delete-template') {
      console.log(`[PROXY] Deleting template: ${message.templateId}`);
      
      const deleted = this.deleteTemplate(message.templateId);
      
      ws.send(JSON.stringify({
        type: 'template-deleted',
        templateId: message.templateId,
        success: deleted
      }));
      
    } else if (message.type === 'get-template') {
      console.log(`[PROXY] Client requesting template: ${message.templateId}`);
      
      const template = this.loadTemplate(message.templateId);
      
      if (template) {
        console.log(`[PROXY] Template ${message.templateId} loaded, has connections:`, !!(template.flow && template.flow.connections));
        if (template.flow && template.flow.connections) {
          console.log(`[PROXY] Template has ${template.flow.connections.length} connections`);
        }
        
        const response = {
          type: 'template-data',
          template: template
        };
        
        console.log(`[PROXY] Sending template response, size: ${JSON.stringify(response).length} bytes`);
        ws.send(JSON.stringify(response));
        console.log(`[PROXY] Template ${message.templateId} response sent successfully`);
      } else {
        console.log(`[PROXY] Template ${message.templateId} not found`);
        ws.send(JSON.stringify({
          type: 'template-not-found',
          templateId: message.templateId
        }));
      }
      
    } else if (message.type === 'get-agents') {
      console.log('[PROXY] Client requesting all agents');
      
      try {
        const agents = this.getAllAgents();
        console.log(`[PROXY] Got ${agents.length} agents, sending response`);
        
        ws.send(JSON.stringify({
          type: 'agents-list',
          agents: agents
        }));
        
        console.log('[PROXY] Agents response sent');
      } catch (error) {
        console.error('[PROXY] Error in get-agents handler:', error);
        ws.send(JSON.stringify({
          type: 'agents-error',
          error: error.message
        }));
      }
      
    } else if (message.type === 'get-agent') {
      console.log(`[PROXY] Client requesting agent: ${message.agentId}`);
      
      const agent = this.loadAgent(message.agentId);
      
      if (agent) {
        ws.send(JSON.stringify({
          type: 'agent-data',
          agent: agent
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'agent-not-found',
          agentId: message.agentId
        }));
      }
      
    } else if (message.type === 'delete-agent') {
      console.log(`[PROXY] Deleting agent: ${message.agentId}`);
      
      const deleted = this.deleteAgent(message.agentId);
      
      ws.send(JSON.stringify({
        type: 'agent-deleted',
        agentId: message.agentId,
        success: deleted
      }));
      
    } else if (message.type === 'save-agent') {
      console.log(`[PROXY] Saving agent: ${message.agent.id}`);
      
      const saved = this.saveAgent(message.agent);
      
      ws.send(JSON.stringify({
        type: saved ? 'agent-saved' : 'agent-save-failed',
        agentId: message.agent.id,
        success: saved
      }));

    // Hat Management Handlers
    } else if (message.type === 'get-hats') {
      console.log('[PROXY] Client requesting all hats');

      try {
        const hats = this.getAllHats();
        console.log(`[PROXY] Got ${hats.length} hats, sending response`);

        ws.send(JSON.stringify({
          type: 'hats-list',
          hats: hats
        }));
      } catch (error) {
        console.error('[PROXY] Error in get-hats handler:', error);
        ws.send(JSON.stringify({
          type: 'hats-error',
          error: error.message
        }));
      }

    } else if (message.type === 'get-hat') {
      console.log(`[PROXY] Client requesting hat: ${message.hatId}`);

      const hat = this.loadHat(message.hatId);

      if (hat) {
        ws.send(JSON.stringify({
          type: 'hat-data',
          hat: hat
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'hat-not-found',
          hatId: message.hatId
        }));
      }

    } else if (message.type === 'save-hat') {
      console.log(`[PROXY] Saving hat: ${message.hat.id}`);

      const saved = this.saveHat(message.hat);

      ws.send(JSON.stringify({
        type: saved ? 'hat-saved' : 'hat-save-failed',
        hatId: message.hat.id,
        success: saved
      }));

    } else if (message.type === 'delete-hat') {
      console.log(`[PROXY] Deleting hat: ${message.hatId}`);

      const deleted = this.deleteHat(message.hatId);

      ws.send(JSON.stringify({
        type: 'hat-deleted',
        hatId: message.hatId,
        success: deleted
      }));

    } else if (message.type === 'execute-pipeline') {
      console.log(`[PROXY] Received pipeline execution request: ${message.pipeline?.name || 'unknown'}`);

      try {
        // Execute pipeline directly without multi-agent wrapper
        let workingDir = message.workingDirectory || message.pipeline?.globalConfig?.workingDirectory || this.workingDirectory.get(ws) || process.cwd();

        // Trim whitespace from working directory path
        if (workingDir) {
          workingDir = workingDir.trim();
        }

        // Convert Windows paths to WSL paths if needed
        if (workingDir && workingDir.match(/^[A-Z]:\\/)) {
          const originalPath = workingDir;
          workingDir = workingDir.replace(/^([A-Z]):\\/, '/mnt/$1/').replace(/\\/g, '/').toLowerCase();
          console.log(`[PROXY] Converted pipeline working directory: ${originalPath} -> ${workingDir}`);
        }

        console.log(`[PROXY] Using working directory for pipeline: ${workingDir}`);

        // Send status update to client
        ws.send(JSON.stringify({
          type: 'system-status',
          content: `Starting pipeline: ${message.pipeline.name}`
        }));

        // Execute pipeline stages sequentially (pass client pipelineId if provided)
        const response = await this.executePipelineStages(message.pipeline, message.userContext || '', workingDir, ws, message.pipelineId);

        // Send final response back to client
        ws.send(JSON.stringify({
          type: 'pipeline-complete',
          content: response,
          pipeline: message.pipeline.name
        }));

      } catch (error) {
        console.error('[PROXY] Pipeline execution error:', error);
        ws.send(JSON.stringify({
          type: 'pipeline-error',
          content: error.message,
          stack: error.stack
        }));
      }

    } else if (message.type === 'browser-automation-init') {
      console.log('[PROXY] Initializing browser automation service');

      try {
        if (!this.browserAutomation) {
          this.browserAutomation = new BrowserAutomationService();
          await this.browserAutomation.start();
        }

        ws.send(JSON.stringify({
          type: 'browser-automation-ready',
          message: 'Browser automation service initialized'
        }));
      } catch (error) {
        console.error('[PROXY] Browser automation init failed:', error);
        ws.send(JSON.stringify({
          type: 'browser-automation-error',
          error: error.message
        }));
      }

    } else if (message.type === 'browser-automation-command') {
      console.log(`[PROXY] Browser automation command: ${message.command}`);

      try {
        if (!this.browserAutomation) {
          throw new Error('Browser automation not initialized. Send browser-automation-init first.');
        }

        let result;

        switch (message.command) {
          case 'launch':
            result = await this.browserAutomation.launchBrowser(message.args || {});
            // Store session for this client
            this.browserSessions.set(ws, result);
            break;

          case 'navigate':
            result = await this.browserAutomation.navigate(
              message.sessionId || this.browserSessions.get(ws),
              message.args.url,
              message.args.waitUntil
            );
            break;

          case 'click':
            result = await this.browserAutomation.click(
              message.sessionId || this.browserSessions.get(ws),
              message.args.selector,
              message.args.timeout
            );
            break;

          case 'type':
            result = await this.browserAutomation.type(
              message.sessionId || this.browserSessions.get(ws),
              message.args.selector,
              message.args.text,
              message.args.delay
            );
            break;

          case 'evaluate':
            result = await this.browserAutomation.evaluate(
              message.sessionId || this.browserSessions.get(ws),
              message.args.script
            );
            break;

          case 'screenshot':
            result = await this.browserAutomation.screenshot(
              message.sessionId || this.browserSessions.get(ws),
              message.args.path,
              message.args.options
            );
            break;

          case 'getConsoleLogs':
            result = await this.browserAutomation.getConsoleLogs(
              message.sessionId || this.browserSessions.get(ws),
              message.args.filter,
              message.args.clear
            );
            break;

          case 'clearConsoleLogs':
            result = await this.browserAutomation.clearConsoleLogs(
              message.sessionId || this.browserSessions.get(ws)
            );
            break;

          case 'close':
            result = await this.browserAutomation.closeBrowser(
              message.sessionId || this.browserSessions.get(ws)
            );
            this.browserSessions.delete(ws);
            break;

          default:
            throw new Error(`Unknown browser automation command: ${message.command}`);
        }

        ws.send(JSON.stringify({
          type: 'browser-automation-result',
          command: message.command,
          result
        }));
      } catch (error) {
        console.error(`[PROXY] Browser automation command failed:`, error);
        ws.send(JSON.stringify({
          type: 'browser-automation-error',
          command: message.command,
          error: error.message,
          stack: error.stack
        }));
      }

    } else if (message.type === 'user-message') {
      console.log(`[PROXY] Received user message: ${message.content}`);

      try {
        // Get conversation history for this client
        const history = this.conversationHistory.get(ws) || [];

        // Build context from history
        let contextualMessage = message.content;
        if (history.length > 0) {
          const conversationContext = history.map(h =>
            `User: ${h.user}\nAssistant: ${h.assistant}`
          ).join('\n\n');

          contextualMessage = `Previous conversation:\n${conversationContext}\n\nCurrent request: ${message.content}`;
        }

        // Use working directory from message, fallback to stored value, then current directory
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        console.log(`[PROXY] Using working directory: ${workingDir}`);

        // Send status update to client
        ws.send(JSON.stringify({
          type: 'system-status',
          content: 'Processing request...'
        }));

        // Process directly with Claude
        const response = await this.sendToClaude(contextualMessage, ws);

        // Store this exchange in history
        history.push({
          user: message.content,
          assistant: response
        });
        this.conversationHistory.set(ws, history);

        // Send final response back to Windows client
        ws.send(JSON.stringify({
          type: 'claude-response',
          content: response
        }));
        
      } catch (error) {
        console.error('[PROXY] Claude processing error:', error);
        ws.send(JSON.stringify({
          type: 'claude-response',
          content: `Claude processing error: ${error.message}`
        }));
      }
    } else if (message.type === 'pipeline-monitor-init') {
      console.log('[PROXY] Pipeline monitor initialized');

      // Send back system context confirmation
      ws.send(JSON.stringify({
        type: 'assistant-message',
        content: 'Pipeline monitor ready. I have full context of the system architecture and know where to find all logs and states.'
      }));

    } else if (message.type === 'pipeline-monitor-query') {
      console.log(`[PROXY] Monitor query: ${message.message}`);

      try {
        // Get or initialize conversation history for this monitor client
        const history = this.conversationHistory.get(ws) || [];

        // Build conversation context if we have history
        let conversationContext = '';
        if (message.history && message.history.length > 0) {
          conversationContext = '\n\nPREVIOUS CONVERSATION:\n';
          conversationContext += message.history.slice(-10).map(h => {
            if (h.role === 'user') {
              return `User: ${h.content}`;
            } else if (h.role === 'assistant') {
              return `Assistant: ${h.content}`;
            }
            return '';
          }).filter(Boolean).join('\n\n');
          conversationContext += '\n\n';
        }

        // Build specialized context for pipeline monitoring
        const monitorContext = `PIPELINE MONITOR QUERY

Working Directory: /mnt/c/github/claudeplus

Your specialized role: You are monitoring the Claude Plus pipeline system. Answer questions about:
- Pipeline status and execution
- Error analysis from structured logs
- Agent states and completions
- System health
${conversationContext}
Current User Question: ${message.message}

IMPORTANT INSTRUCTIONS:
1. Check structured execution logs FIRST: proxy/pipelines/*_execution.json
2. Use 'tail -n 100' to read recent log entries
3. Parse JSON for specific error events, stage completions, routing decisions
4. Check current pipeline state: proxy/pipeline-states/current.json
5. Only check proxy/proxy.log as LAST RESORT (it's 30k+ lines)
6. Be concise and actionable
7. Focus on answering the specific question
8. Remember previous conversation context to provide relevant follow-up answers

Common commands you should use:
- tail -n 100 /mnt/c/github/claudeplus/proxy/pipelines/<pipeline>_execution.json
- cat /mnt/c/github/claudeplus/proxy/pipeline-states/current.json
- ls -lt /mnt/c/github/claudeplus/proxy/pipeline-states/
- grep "stage_error" /mnt/c/github/claudeplus/proxy/pipelines/*_execution.json

Answer the question directly and concisely.`;

        // Get working directory
        const workingDir = '/mnt/c/github/claudeplus';

        // Send to Claude with monitor context
        const response = await this.sendToClaude(monitorContext, ws);

        // Store this exchange in history
        history.push({
          user: message.message,
          assistant: response
        });
        this.conversationHistory.set(ws, history);

        // Send response back
        ws.send(JSON.stringify({
          type: 'assistant-message',
          content: response
        }));

      } catch (error) {
        console.error('[PROXY] Monitor query error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: `Error processing query: ${error.message}`
        }));
      }

    } else if (message.type === 'game-dev-studio-init') {
      console.log('[PROXY] Game Dev Studio initialized');
      console.log(`[PROXY] Working directory: ${message.workingDirectory}`);

      // Set working directory
      if (message.workingDirectory) {
        this.workingDirectory.set(ws, message.workingDirectory);
      }

      // Send back confirmation
      ws.send(JSON.stringify({
        type: 'assistant-message',
        content: `Game Dev Studio ready! I'm set up to work on your game project at: ${message.workingDirectory}\n\nI can run pipelines, implement features, and modify this interface. What would you like to build?`
      }));

    } else if (message.type === 'game-dev-studio-query') {
      console.log(`[PROXY] Game Dev Studio query: ${message.message}`);

      try {
        // Get or initialize conversation history
        const history = this.conversationHistory.get(ws) || [];

        // Build conversation context
        let conversationContext = '';
        if (message.history && message.history.length > 0) {
          conversationContext = '\n\nPREVIOUS CONVERSATION:\n';
          conversationContext += message.history.slice(-10).map(h => {
            if (h.role === 'user') {
              return `User: ${h.content}`;
            } else if (h.role === 'assistant') {
              return `Assistant: ${h.content}`;
            }
            return '';
          }).filter(Boolean).join('\n\n');
          conversationContext += '\n\n';
        }

        // Detect if user wants to modify THIS interface (game-dev-studio.html)
        const wantsToModifyStudioInterface = /\b(modify|change|update|edit|improve)\s+(this|the)?\s*(interface|studio)/i.test(message.message);

        // Detect if this is a content creation request (zones, quests, enemies, dialogues)
        const isContentRequest = /\[CONTENT\]|create\s+(a\s+)?(new\s+)?(zone|area|level|world|map)|design\s+(a\s+)?(new\s+)?(enemy|enemies|mob|mobs|boss|creature)|write\s+(a\s+)?(new\s+)?(quest|dialogue|dialog|conversation|npc)|validate\s+content|content\s+(system|compiler|validation)|\.zone\.yaml|\.quest\.yaml|\.dlg\b/i.test(message.message);

        // Build specialized context
        let studioContext = `GAME DEV STUDIO - Pipeline Interface Helper

Working Directory: ${message.workingDirectory}

Your specialized role: You are a helper interface between the user and the meta game development pipeline system.

CRITICAL RULES:
- Your ONLY job is to help users run pipelines on their game project
- You do NOT directly edit game files yourself
- You do NOT implement features yourself
- You ARE the interface layer that translates user requests into pipeline executions

What you DO:
1. Listen to what the user wants to build/fix/improve in their game
2. Frame their request appropriately for the pipeline system
3. Execute the pipeline with their request
4. Report progress and results back to them

What you DON'T DO:
- Don't use Edit/Write/Bash tools on the game project files
- Don't implement game features directly
- Don't suggest they do it themselves
${conversationContext}
Current User Request: ${message.message}

IMPORTANT INSTRUCTIONS:`;

        if (wantsToModifyStudioInterface) {
          studioContext += `

USER WANTS TO MODIFY THIS INTERFACE (game-dev-studio.html)

This is the ONLY exception where you directly edit files - when they want to change THIS interface.

1. Read the current game-dev-studio.html file at /mnt/c/github/claudeplus/game-dev-studio.html
2. Understand what changes the user wants
3. Use the Edit or Write tool to modify the HTML/CSS/JavaScript
4. Explain what you changed and why
5. Tell them to refresh their browser to see changes

Be creative and implement their requested changes to the interface!`;

        } else if (isContentRequest) {
          // Content creation request - use content-generation-v1 pipeline
          studioContext += `

CONTENT CREATION REQUEST - USE CONTENT GENERATION PIPELINE

The user wants to create game CONTENT (zones, quests, enemies, dialogues). Use the specialized content-generation-v1 pipeline.

This pipeline uses the declarative content system with:
- .zone.yaml files - ASCII maps, NPCs, enemies, spawn points
- .quest.yaml files - Objectives, rewards, prerequisites
- .dlg files - Screenplay-style NPC dialogue trees

Your ONLY job:
1. Parse what content the user wants to create
2. Identify: faction (Imperial/Tau/Ork), content type, level range, theme
3. Output the pipeline execution request in the special format below
4. The proxy will detect it and execute the content pipeline

HOW TO EXECUTE THE CONTENT PIPELINE:

Output this exact format:
[PIPELINE-EXECUTE]
{
  "pipelineName": "content-generation-v1",
  "userPrompt": "<detailed content creation request>",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Then add a brief message explaining what content you're creating.

REQUIRED INFO TO EXTRACT:
- Faction: Imperial, Tau, or Ork (default to Imperial if unclear)
- Level Range: e.g., 1-5 for tutorial, 10-15 for mid-game
- Content Type: zone, quest, enemy, dialogue, or full area (all)
- Theme/Setting: desert, hive city, jungle, space hulk, etc.

Examples:

User: "Create a Tau outpost zone with some quests"
Your response:
[PIPELINE-EXECUTE]
{
  "pipelineName": "content-generation-v1",
  "userPrompt": "Create a Tau faction outpost zone with the following requirements: Faction: Tau, Level Range: 5-10, Content needed: zone with ASCII map, 2-3 quests introducing Tau technology and philosophy, enemies including Kroot hounds and Fire Warriors, dialogue for Tau Earth Caste merchants. The zone should have a clean, advanced aesthetic with Tau architecture.",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Running the content generation pipeline to create a Tau outpost zone...

---

User: "Design enemies for an Ork camp"
Your response:
[PIPELINE-EXECUTE]
{
  "pipelineName": "content-generation-v1",
  "userPrompt": "Design enemies for an Ork faction camp. Create enemy definitions including: Ork Boyz (basic melee), Ork Shootaz (ranged), Gretchin (weak support), and an Ork Nob boss. Include stats, abilities, attack patterns, and drop tables following GW1-style horizontal progression. Level range 8-12.",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Running the content generation pipeline to design Ork camp enemies...

---

User: "[CONTENT] Validate all content files"
Your response:
[PIPELINE-EXECUTE]
{
  "pipelineName": "content-generation-v1",
  "userPrompt": "Validate all existing content files in the content/ directory. Run npm run content:validate to check .zone.yaml, .quest.yaml, and .dlg files for syntax errors, missing references, and schema compliance. Report any issues found and suggest fixes.",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Running the content generation pipeline to validate content files...

---

CRITICAL RULES:
- EVERY content request must output [PIPELINE-EXECUTE]...[/PIPELINE-EXECUTE]
- ALWAYS use "content-generation-v1" as the pipelineName for content requests
- Include faction, level range, and content type in the prompt
- DO NOT use Read/Write/Edit/Bash tools on content files directly
- Let the specialized content agents handle the creation`;

        } else {
          // Regular development request - use dev-cycle-meta-v1 pipeline
          studioContext += `

USER GAME REQUEST - ALWAYS USE PIPELINE

For ANY request about the game (questions, development, changes, etc.), you ALWAYS run the pipeline.

Your ONLY job:
1. Take whatever the user said
2. Wordsmith it into a clear, detailed prompt for the pipeline
3. Output the pipeline execution request in the special format below
4. The proxy will detect it and execute the pipeline automatically

HOW TO EXECUTE A PIPELINE:

Output this exact format:
[PIPELINE-EXECUTE]
{
  "pipelineName": "dev-cycle-meta-v1",
  "userPrompt": "<your reworded/detailed version of their request>",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Then add a brief message to the user explaining what you're doing.

Examples:

User: "Tell me about ship fitting"
Your response:
[PIPELINE-EXECUTE]
{
  "pipelineName": "dev-cycle-meta-v1",
  "userPrompt": "The user wants to understand how the ship fitting system works in the game. Review the ship fitting code, examine the implementation, and provide a detailed explanation of the system's features, how it works, and what capabilities it has.",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Running the meta development pipeline to analyze and explain the ship fitting system...

---

User: "make the ship faster"
Your response:
[PIPELINE-EXECUTE]
{
  "pipelineName": "dev-cycle-meta-v1",
  "userPrompt": "The user wants to increase the ship's speed. Review the current ship movement code, identify the speed parameter, and increase it to make the ship move faster. Test the change to ensure it works properly.",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

Running the meta development pipeline to increase ship speed...

---

CRITICAL RULES:
- EVERY request must output [PIPELINE-EXECUTE]...[/PIPELINE-EXECUTE]
- ALWAYS use "dev-cycle-meta-v1" as the pipelineName
- DO NOT use Read/Write/Edit/Bash tools on game files
- DO NOT answer questions directly - let the pipeline handle it
- Just wordsmith the prompt and output the execution request`;
        }

        studioContext += `

Remember: You're working in a game development context. Be creative, helpful, and proactive about suggesting pipelines or modifications!`;

        // Get working directory
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();

        // Send to Claude with game dev context
        const response = await this.sendToClaude(studioContext, ws);

        // Store exchange in history
        history.push({
          user: message.message,
          assistant: response
        });
        this.conversationHistory.set(ws, history);

        // Send response back
        ws.send(JSON.stringify({
          type: 'assistant-message',
          content: response
        }));

      } catch (error) {
        console.error('[PROXY] Game Dev Studio query error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: `Error processing query: ${error.message}`
        }));
      }

    } else if (message.type === 'supercoin-dev-studio-init') {
      console.log('[PROXY] SuperCoin Dev Studio initialized');
      console.log(`[PROXY] Working directory: ${message.workingDirectory}`);

      // Set working directory
      if (message.workingDirectory) {
        this.workingDirectory.set(ws, message.workingDirectory);
      }

      // Send back confirmation
      ws.send(JSON.stringify({
        type: 'assistant-message',
        content: `SuperCoin Dev Studio ready! I'm set up to work on your project at: ${message.workingDirectory}\n\nI can run development pipelines, implement features, fix bugs, and help with code quality. What would you like to work on?`
      }));

    } else if (message.type === 'supercoin-dev-studio-query') {
      console.log(`[PROXY] SuperCoin Dev Studio query: ${message.message}`);

      try {
        // Get or initialize conversation history
        const history = this.conversationHistory.get(ws) || [];

        // Build conversation context
        let conversationContext = '';
        if (message.history && message.history.length > 0) {
          conversationContext = '\n\nPREVIOUS CONVERSATION:\n';
          conversationContext += message.history.slice(-10).map(h => {
            if (h.role === 'user') {
              return `User: ${h.content}`;
            } else if (h.role === 'assistant') {
              return `Assistant: ${h.content}`;
            }
            return '';
          }).filter(Boolean).join('\n\n');
          conversationContext += '\n\n';
        }

        // Detect if user wants to modify THIS interface (supercoin-dev-studio.html)
        const wantsToModifyStudioInterface = /\b(modify|change|update|edit|improve)\s+(this|the)?\s*(interface|studio)/i.test(message.message);

        // Build specialized context
        let studioContext = `SUPERCOIN DEV STUDIO - Development Assistant

Working Directory: ${message.workingDirectory}
Project: SuperCoinServ

Your role: You are a development assistant for the SuperCoinServ project. You help with:
- Understanding the codebase
- Running bug-fix and feature-development pipelines
- Code review and testing
- Debugging and analysis
- Suggesting improvements

CAPABILITIES:
${conversationContext}
Current User Request: ${message.message}

IMPORTANT INSTRUCTIONS:`;

        if (wantsToModifyStudioInterface) {
          studioContext += `

USER WANTS TO MODIFY THIS INTERFACE (supercoin-dev-studio.html)

1. Read the current supercoin-dev-studio.html file at /mnt/c/github/claudeplus/supercoin-dev-studio.html
2. Understand what changes the user wants
3. Use the Edit or Write tool to modify the HTML/CSS/JavaScript
4. Explain what you changed and why
5. Tell them to refresh their browser to see changes

Be creative and implement their requested changes to the interface!`;

        } else {
          studioContext += `

For development requests, you can:
1. Answer questions about the codebase (explore and explain)
2. Suggest running pipelines for bugs and features
3. Help with code review and testing
4. Provide development guidance

When appropriate, suggest or execute pipelines:
- For bug fixes: Use "bug-fix-v1" pipeline
- For new features: Use "feature-development-v1" pipeline

To execute a pipeline, output this format:
[PIPELINE-EXECUTE]
{
  "pipelineName": "bug-fix-v1" or "feature-development-v1",
  "userPrompt": "<detailed description of the task>",
  "workingDirectory": "${message.workingDirectory}"
}
[/PIPELINE-EXECUTE]

For questions and exploration, use your tools to:
- Read files to understand code
- Search for patterns with grep
- List files with glob
- Explain how things work

Be conversational, helpful, and proactive about suggesting the best approach!`;
        }

        // Get working directory
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();

        // Send to Claude with SuperCoin dev context
        const response = await this.sendToClaude(studioContext, ws);

        // Store exchange in history
        history.push({
          user: message.message,
          assistant: response
        });
        this.conversationHistory.set(ws, history);

        // Send response back
        ws.send(JSON.stringify({
          type: 'assistant-message',
          content: response
        }));

      } catch (error) {
        console.error('[PROXY] SuperCoin Dev Studio query error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: `Error processing query: ${error.message}`
        }));
      }

    } else if (message.type === 'execute-single-agent') {
      console.log(`[PROXY] Single agent execution not available - system removed`);

      ws.send(JSON.stringify({
        type: 'error',
        content: 'Single agent execution feature has been removed'
      }));
    } else if (message.type === 'pipeline-generation-request') {
      console.log(`[PROXY] Pipeline generation request received`);
      console.log(`[PROXY] User prompt: ${message.userPrompt}`);

      try {
        // Send status update
        ws.send(JSON.stringify({
          type: 'pipeline-generation-status',
          content: 'Starting Claude Code to generate your pipeline...'
        }));

        // Build the system prompt for Claude Code
        const systemPrompt = `You are a Pipeline and Agent Generator. Your job is to create a complete pipeline template JSON and all necessary agent JSON files based on the user's natural language description.

USER REQUEST:
${message.userPrompt}

TEMPLATE SCHEMA (use this as reference):
${message.context.templateExample}

AGENT SCHEMA (use this as reference):
${message.context.agentExample}

IMPORTANT INSTRUCTIONS:
1. Create a pipeline template JSON with:
   - Unique id (lowercase with hyphens)
   - Descriptive name
   - Clear description
   - List of stages (each stage needs: id, name, type, agent, description)
   - Each stage should have "inputs" array listing stage IDs it depends on
   - Stages that make decisions should have "decisions" array with choice and description

2. Create proper flow.connections array:
   - CRITICAL: Connections use SIMPLE STRING CONDITIONS, not JavaScript expressions
   - Each connection needs: "from" (stage id), "to" (stage id or null), "condition" (simple string), "description"
   - Condition strings should match the decision "choice" values from the stage's decisions array
   - Use simple keywords like: "APPROVED", "REJECTED", "NEEDS_FIXES", "complete", "ready", etc.
   - DO NOT use JavaScript expressions like "output.confidence > 0.7" - these will NOT work
   - For unconditional transitions, use simple keywords like "complete" or "ready"
   - End-of-pipeline connections should have "to": null
   - Example valid conditions: "APPROVED", "REJECTED", "plan_complete", "execution_complete"
   - Example INVALID conditions: "planning.output.confidence > 0.7", "validation.output.success === true"

3. Create all agent JSON files referenced in the pipeline with:
   - Unique id matching the agent references in stages
   - Clear systemPrompt or system_prompt_template
   - Appropriate type (planner, executor, validator, analyzer, reviewer, etc.)
   - Capabilities list
   - Each agent's prompt should end with "DECISION: [keyword]" matching the condition strings
   - For reviewer/validator agents, ensure decision keywords match connection conditions

4. Output your response in this EXACT format:

=== TEMPLATE ===
{
  "id": "template-id",
  "name": "Template Name",
  ...complete template JSON...
}

=== AGENT: agent_id_1 ===
{
  "id": "agent_id_1",
  "name": "Agent Name",
  ...complete agent JSON...
}

=== AGENT: agent_id_2 ===
{
  "id": "agent_id_2",
  ...complete agent JSON...
}

5. Make sure all stage.agent references in the template match the agent IDs you create.
6. Create meaningful, functional prompts for each agent that end with "DECISION: [keyword]".
7. Ensure connection conditions match the decision keywords from agent prompts.

EXAMPLE OF CORRECT CONNECTION FORMAT:
{
  "flow": {
    "type": "conditional",
    "connections": [
      {
        "from": "planner",
        "to": "reviewer",
        "condition": "plan_complete",
        "description": "Plan is complete, send to reviewer"
      },
      {
        "from": "reviewer",
        "to": "executor",
        "condition": "APPROVED",
        "description": "Reviewer approved, execute the plan"
      },
      {
        "from": "reviewer",
        "to": "planner",
        "condition": "REJECTED",
        "description": "Reviewer rejected, revise the plan"
      },
      {
        "from": "executor",
        "to": null,
        "condition": "complete",
        "description": "Execution complete, end pipeline"
      }
    ]
  }
}

Note: The reviewer stage would have decisions: [{"choice": "APPROVED", ...}, {"choice": "REJECTED", ...}]

Generate the complete pipeline system now:`;

        // Execute Claude Code to generate the pipeline
        const { output: response, usage } = await this.executeClaudeWithMCP(
          'pipeline_generator',
          systemPrompt,
          message.userPrompt,
          process.cwd(),
          null,  // pipelineState
          ws     // originatingWs
        );

        // Emit usage event
        this.broadcastUsageEvent(usage, ws);

        console.log(`[PROXY] Claude Code response received, length: ${response.length}`);

        // Parse the response to extract template and agents
        const parsedResults = this.parsePipelineGenerationResponse(response);

        if (parsedResults.template && parsedResults.agents.length > 0) {
          // Save template to templates directory
          const templateSaved = this.saveTemplate(parsedResults.template);

          // Save all agents to agents directory
          const agentsSaved = parsedResults.agents.map(agent => this.saveAgent(agent));

          if (templateSaved && agentsSaved.every(saved => saved)) {
            ws.send(JSON.stringify({
              type: 'pipeline-generation-complete',
              template: parsedResults.template,
              agents: parsedResults.agents
            }));

            console.log(`[PROXY] Pipeline generation successful: ${parsedResults.template.id}, ${parsedResults.agents.length} agents`);
          } else {
            throw new Error('Failed to save template or agents to disk');
          }
        } else {
          throw new Error('Could not parse template or agents from Claude Code response');
        }

      } catch (error) {
        console.error('[PROXY] Pipeline generation error:', error);
        ws.send(JSON.stringify({
          type: 'pipeline-generation-error',
          error: error.message,
          stack: error.stack
        }));
      }
    } else if (message.type === 'claude-chat-init') {
      // Initialize a Claude Chat session
      console.log('[PROXY] Claude Chat session initialized');
      const conversationId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mark this client as claude-chat type (won't receive pipeline broadcasts)
      this.clientTypes.set(ws, 'claude-chat');

      // Set working directory
      if (message.workingDirectory) {
        this.workingDirectory.set(ws, message.workingDirectory);
      }

      // Initialize conversation history
      this.conversationHistory.set(ws, []);

      ws.send(JSON.stringify({
        type: 'claude-chat-init-ack',
        conversationId: conversationId
      }));

    } else if (message.type === 'claude-chat-message') {
      console.log(`[PROXY] Claude Chat message: ${message.message?.substring(0, 100)}...`);

      try {
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        const conversationId = message.conversationId || 'default';
        const tabId = message.tabId; // Capture tabId to include in all responses
        const pipelineId = message.pipelineId; // Pipeline to route through (null = direct chat)

        // If pipelineId is specified, route through standard pipeline execution
        if (pipelineId) {
          console.log(`[PROXY] [PIPELINE-CHAT] Routing message through pipeline: ${pipelineId}`);

          // Load the pipeline template
          const templatePath = path.join(this.templatesDir, `${pipelineId}.json`);
          if (!fs.existsSync(templatePath)) {
            console.error(`[PROXY] [PIPELINE-CHAT] Pipeline not found: ${pipelineId}`);
            ws.send(JSON.stringify({
              type: 'error',
              tabId: tabId,
              message: `Pipeline not found: ${pipelineId}`
            }));
            return;
          }

          const pipeline = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

          // Build hat context if specified
          let hatContext = '';
          let hatIds = message.hatIds || [];
          if (!Array.isArray(hatIds) || hatIds.length === 0) {
            hatIds = message.hatId && message.hatId !== 'default' ? [message.hatId] : [];
          }
          if (hatIds.length > 0) {
            hatContext = this.buildMultiHatContext(hatIds);
          }

          // Build conversation history context
          const clientHistory = message.history || [];
          let contextMessages = '';
          if (clientHistory.length > 0) {
            const recentHistory = clientHistory.slice(-10);
            contextMessages = recentHistory.map(h =>
              `Human: ${h.user}\n\nAssistant: ${h.assistant}`
            ).join('\n\n---\n\n');
            contextMessages = `\n\nPrevious conversation:\n${contextMessages}\n\n---\n\nCurrent request: `;
          }

          const userContext = hatContext + contextMessages + message.message;

          // Use standard pipeline execution (same as standalone-pipeline.html)
          // Execute asynchronously and handle response
          this.executePipelineStages(pipeline, userContext, workingDir, ws)
            .then((result) => {
              console.log(`[PROXY] [PIPELINE-CHAT] Pipeline completed for tab ${tabId}`);

              // Extract final output from results (last stage output)
              let finalOutput = '';
              if (typeof result === 'object') {
                const stageKeys = Object.keys(result);
                if (stageKeys.length > 0) {
                  finalOutput = result[stageKeys[stageKeys.length - 1]] || '';
                }
              } else {
                finalOutput = result || '';
              }

              // Clean DECISION markers from output
              finalOutput = String(finalOutput).replace(/\n*\*{0,2}DECISION:\s*\w+\*{0,2}\s*$/i, '').trim();

              // Store in conversation history
              const history = this.conversationHistory.get(ws) || [];
              history.push({ user: message.message, assistant: finalOutput });
              this.conversationHistory.set(ws, history);

              // Send final response as chat message
              ws.send(JSON.stringify({
                type: 'assistant-message',
                tabId: tabId,
                content: finalOutput
              }));
            })
            .catch((error) => {
              console.error(`[PROXY] [PIPELINE-CHAT] Pipeline error:`, error);
              ws.send(JSON.stringify({
                type: 'error',
                tabId: tabId,
                message: `Pipeline error: ${error.message}`
              }));
            });
          return;
        }

        // Get conversation history - prefer client-provided history, fall back to server-side
        const clientHistory = message.history || [];
        const serverHistory = this.conversationHistory.get(ws) || [];
        const history = clientHistory.length > 0 ? clientHistory : serverHistory;

        // Build context from history (last 10 exchanges)
        let contextMessages = '';
        console.log(`[PROXY] [CHAT-HISTORY] Client history length: ${clientHistory.length}, Server history length: ${serverHistory.length}`);

        // DIAGNOSTIC: Write detailed history debug to file
        const debugLogPath = path.join(__dirname, 'chat-history-debug.log');
        const debugTimestamp = new Date().toISOString();
        const debugEntry = [
          `\n\n========== ${debugTimestamp} ==========`,
          `Tab ID: ${tabId}`,
          `Current message: ${message.message?.substring(0, 100)}...`,
          `Client history count: ${clientHistory.length}`,
          `Server history count: ${serverHistory.length}`,
          `Using: ${clientHistory.length > 0 ? 'client' : 'server'} history`,
          `History items (user message first 50 chars):`
        ];
        history.forEach((h, i) => {
          debugEntry.push(`  [${i}] User: ${h.user?.substring(0, 50)}... | Assistant: ${h.assistant?.substring(0, 50)}...`);
        });
        fs.appendFileSync(debugLogPath, debugEntry.join('\n'));

        if (history.length > 0) {
          const recentHistory = history.slice(-10);
          console.log(`[PROXY] [CHAT-HISTORY] Using ${recentHistory.length} history exchanges for context`);
          contextMessages = recentHistory.map(h =>
            `Human: ${h.user}\n\nAssistant: ${h.assistant}`
          ).join('\n\n---\n\n');
          contextMessages = `\n\nPrevious conversation:\n${contextMessages}\n\n---\n\nCurrent request: `;
          console.log(`[PROXY] [CHAT-HISTORY] Context prefix length: ${contextMessages.length} chars`);
        } else {
          console.log(`[PROXY] [CHAT-HISTORY] No history available - starting fresh conversation`);
        }

        // Write FULL conversation history to a file in the working directory
        // This allows the AI to read the complete history when needed
        const fullHistory = message.fullHistory || [];
        if (fullHistory.length > 0) {
          const tabName = message.tabName || tabId;
          const safeTabName = tabName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
          const historyFilePath = path.join(workingDir, `.chat-history-${safeTabName}.md`);

          let historyContent = `# Full Chat History\n\n`;
          historyContent += `**Tab:** ${tabName}\n`;
          historyContent += `**Updated:** ${new Date().toISOString()}\n`;
          historyContent += `**Total Exchanges:** ${fullHistory.length}\n\n`;
          historyContent += `---\n\n`;

          fullHistory.forEach((h, i) => {
            historyContent += `## Exchange ${i + 1}\n\n`;
            historyContent += `**Human:**\n${h.user}\n\n`;
            historyContent += `**Assistant:**\n${h.assistant}\n\n`;
            historyContent += `---\n\n`;
          });

          try {
            fs.writeFileSync(historyFilePath, historyContent);
            console.log(`[PROXY] [CHAT-HISTORY] Wrote full history (${fullHistory.length} exchanges) to ${historyFilePath}`);
          } catch (err) {
            console.error(`[PROXY] [CHAT-HISTORY] Failed to write history file: ${err.message}`);
          }
        }

        // Build hat context if hats are specified (supports multiple)
        let hatContext = '';
        // Support both new hatIds array and legacy hatId field
        let hatIds = message.hatIds || [];
        if (!Array.isArray(hatIds) || hatIds.length === 0) {
          hatIds = message.hatId && message.hatId !== 'default' ? [message.hatId] : [];
        }

        if (hatIds.length > 0) {
          hatContext = this.buildMultiHatContext(hatIds);
          if (hatContext) {
            console.log(`[PROXY] [HAT] Applied ${hatIds.length} hat(s): ${hatIds.join(', ')} (${hatContext.length} chars)`);
          }
        }

        const fullMessage = hatContext + contextMessages + message.message;
        console.log(`[PROXY] [CHAT-HISTORY] Full message length: ${fullMessage.length} chars (hat: ${hatContext.length}, context: ${contextMessages.length}, message: ${message.message.length})`);

        // Spawn Claude with streaming
        const { ANTHROPIC_API_KEY: _apiKey, ...cleanEnv } = process.env;
        const claude = spawn('claude', [
          '--permission-mode', 'bypassPermissions',
          '--print',
          '--verbose',
          '--output-format', 'stream-json',
          '--include-partial-messages',
          '-'
        ], {
          cwd: workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...cleanEnv, PWD: workingDir }
        });

        // Track the process so we can abort it
        this.claudeChatProcesses.set(conversationId, claude);

        let lineBuffer = '';
        let streamingText = '';
        let currentToolBlock = null;
        let pendingToolCompletion = null; // Track tool waiting for result confirmation
        let lastBroadcast = 0;
        let usageData = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

        const broadcastEvent = (eventType, data) => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'agent-stream',
              tabId: tabId, // Include tabId so client routes to correct tab
              content: { eventType, ...data }
            }));
          }
        };

        // Helper to complete a pending tool
        const completePendingTool = () => {
          if (pendingToolCompletion) {
            broadcastEvent('tool_result', {
              tool: pendingToolCompletion.name,
              result: 'completed'
            });
            console.log(`[PROXY] [CHAT] ✓ Tool completed: ${pendingToolCompletion.name}`);
            pendingToolCompletion = null;
          }
        };

        claude.stdout.on('data', (data) => {
          lineBuffer += data.toString();
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              let event = JSON.parse(line);
              if (event.type === 'stream_event' && event.event) {
                event = event.event;
              }

              // DEBUG: Log all event types to understand what Claude Code CLI emits
              if (event.type && !['content_block_delta'].includes(event.type)) {
                console.log(`[PROXY] [CHAT-EVENT] event.type=${event.type}${event.message?.role ? ` message.role=${event.message.role}` : ''}`);
              }

              // Tool start
              if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
                // A new tool starting means any previous tool has completed
                completePendingTool();

                const block = event.content_block;
                currentToolBlock = { name: block.name, id: block.id, input: '' };
                broadcastEvent('tool_start', { tool: block.name });
              }

              // Text block start - previous tool completed
              else if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
                completePendingTool();
              }

              // Text streaming
              else if (event.type === 'content_block_delta') {
                const delta = event.delta;

                if (delta?.type === 'text_delta' && delta.text) {
                  // First text delta after a tool means the tool completed
                  completePendingTool();

                  streamingText += delta.text;
                  const now = Date.now();
                  if (now - lastBroadcast > 200) {
                    broadcastEvent('text_delta', {
                      text: delta.text,
                      accumulated: streamingText.slice(-500),
                      totalLength: streamingText.length
                    });
                    lastBroadcast = now;
                  }
                }

                // Thinking
                else if (delta?.type === 'thinking_delta' && delta.thinking) {
                  broadcastEvent('thinking', { text: delta.thinking });
                }

                // Tool input
                else if (delta?.type === 'input_json_delta' && currentToolBlock) {
                  currentToolBlock.input += delta.partial_json || '';
                }
              }

              // Thinking start
              else if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
                broadcastEvent('thinking_start', {});
              }

              // Block stop
              else if (event.type === 'content_block_stop' && currentToolBlock) {
                let parsedInput = currentToolBlock.input;
                try { parsedInput = JSON.parse(currentToolBlock.input); } catch (e) {}

                // Special handling for TodoWrite
                if (currentToolBlock.name === 'TodoWrite' && parsedInput?.todos) {
                  broadcastEvent('todo_update', { todos: parsedInput.todos });
                }
                // File operations
                else if (['Read', 'Write', 'Edit'].includes(currentToolBlock.name)) {
                  const filePath = parsedInput?.file_path || '';
                  broadcastEvent('file_operation', {
                    tool: currentToolBlock.name,
                    file: filePath.split('/').pop() || filePath
                  });
                }
                else {
                  broadcastEvent('tool_call', {
                    tool: currentToolBlock.name,
                    input: typeof parsedInput === 'string' ? parsedInput.slice(0, 200) : JSON.stringify(parsedInput).slice(0, 200)
                  });
                }
                // Mark this tool as pending completion - will be confirmed when we see
                // the next content (tool or text) or at message end
                pendingToolCompletion = { name: currentToolBlock.name, id: currentToolBlock.id };
                currentToolBlock = null;
              }

              // Tool result (direct event type) - clear pending since we got explicit result
              else if (event.type === 'tool_result') {
                pendingToolCompletion = null;
                broadcastEvent('tool_result', {
                  result: typeof event.result === 'string' ? event.result.slice(0, 500) : 'completed'
                });
              }

              // Handle user messages containing tool results - clear pending since we got explicit result
              else if (event.type === 'user' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'tool_result') {
                    pendingToolCompletion = null;
                    const resultPreview = typeof block.content === 'string'
                      ? block.content.slice(0, 500)
                      : JSON.stringify(block.content).slice(0, 500);
                    broadcastEvent('tool_result', {
                      result: resultPreview,
                      is_error: block.is_error || false
                    });
                  }
                }
              }

              // Usage info
              else if (event.type === 'usage' || event.usage) {
                const usage = event.usage || event;
                usageData.inputTokens += usage.input_tokens || 0;
                usageData.outputTokens += usage.output_tokens || 0;
                // Claude 4 pricing approximation
                usageData.estimatedCostUsd = (usageData.inputTokens * 0.000003) + (usageData.outputTokens * 0.000015);
              }

              // Result event (final output)
              else if (event.type === 'result' && event.result) {
                streamingText = event.result;
              }

            } catch (e) {
              // Not JSON, might be plain text output
              streamingText += line + '\n';
            }
          }
        });

        claude.stderr.on('data', (data) => {
          console.log(`[PROXY] Claude Chat stderr: ${data.toString()}`);
        });

        claude.on('close', (code) => {
          // Complete any remaining pending tool
          completePendingTool();

          // Remove from tracking
          this.claudeChatProcesses.delete(conversationId);

          // Broadcast completion
          broadcastEvent('complete', {
            duration: Date.now() - parseInt(conversationId.split('_')[1]) || 0,
            workLogCount: 0
          });

          // Send usage
          if (usageData.inputTokens > 0 || usageData.outputTokens > 0) {
            ws.send(JSON.stringify({
              type: 'ai-usage',
              tabId: tabId,
              content: usageData
            }));
          }

          // Store in history
          history.push({
            user: message.message,
            assistant: streamingText.trim()
          });
          this.conversationHistory.set(ws, history);

          // Send final response
          ws.send(JSON.stringify({
            type: 'assistant-message',
            tabId: tabId,
            content: streamingText.trim()
          }));

          console.log(`[PROXY] Claude Chat completed with code ${code}`);
        });

        claude.on('error', (error) => {
          console.error('[PROXY] Claude Chat spawn error:', error);
          this.claudeChatProcesses.delete(conversationId);
          ws.send(JSON.stringify({
            type: 'error',
            tabId: tabId,
            message: `Failed to start Claude: ${error.message}`
          }));
        });

        // Send the message
        claude.stdin.write(fullMessage + '\n');
        claude.stdin.end();

      } catch (error) {
        console.error('[PROXY] Claude Chat error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          tabId: tabId,
          message: error.message
        }));
      }

    } else if (message.type === 'claude-chat-abort') {
      console.log('[PROXY] Claude Chat abort requested');
      const conversationId = message.conversationId || 'default';
      const tabId = message.tabId;
      const claude = this.claudeChatProcesses.get(conversationId);

      if (claude) {
        claude.kill('SIGTERM');
        this.claudeChatProcesses.delete(conversationId);
        ws.send(JSON.stringify({
          type: 'claude-aborted',
          tabId: tabId,
          conversationId
        }));
      }

    } // DISABLED: Dragon-vision system disabled
    // else if (message.type === 'dragon-command') {
    //   console.log(`[PROXY] 🐉 Dragon command received:`, message.content);
    //
    //   try {
    //     // Dragon orchestrator system removed
    //     const dragonInsights = await multiAgent.dragonOrchestrator.processCommand(message.content);
    //
    //     // Send dragon insights back to client
    //     ws.send(JSON.stringify({
    //       type: 'dragon-insights',
    //       content: dragonInsights,
    //       timestamp: message.timestamp
    //     }));
    //
    //     console.log(`[PROXY] 🐉 Dragon insights sent to client`);
    //
    //   } catch (error) {
    //     console.error('[PROXY] 🐉 Dragon command error:', error);
    //     ws.send(JSON.stringify({
    //       type: 'dragon-error',
    //       content: `Dragon orchestrator error: ${error.message}`
    //     }));
    //   }
    // }
  }

  processMessage(content) {
    // Middleware layer - add your custom logic here
    console.log('Processing message through middleware:', content);
    
    // For now, just pass through
    return content;
  }

  async sendToClaude(message, ws = null) {
    console.log(`[PROXY] Attempting to send message to Claude: "${message}"`);
    try {
      // Save 'this' context for use in callbacks
      const self = this;

      return new Promise((resolve, reject) => {
        console.log('[PROXY] Spawning claude process...');
        // Create env without ANTHROPIC_API_KEY so Claude CLI uses subscription login, not API key
        const { ANTHROPIC_API_KEY, ...cleanEnv } = process.env;
        const claude = spawn('claude', ['--permission-mode', 'bypassPermissions', '-'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv
        });

        let output = '';
        let errorOutput = '';

        claude.stdout.on('data', (data) => {
          const chunk = data.toString();
          console.log(`[PROXY] Claude stdout: ${chunk}`);
          output += chunk;
        });

        claude.stderr.on('data', (data) => {
          const chunk = data.toString();
          console.log(`[PROXY] Claude stderr: ${chunk}`);
          errorOutput += chunk;
        });

        claude.on('close', (code) => {
          console.log(`[PROXY] Claude process closed with code: ${code}`);
          console.log(`[PROXY] Final output: "${output}"`);
          console.log(`[PROXY] Final error: "${errorOutput}"`);

          if (code !== 0) {
            resolve(`Error: ${errorOutput || 'Claude process failed'}`);
          } else {
            // Check if output contains a pipeline execution request
            const pipelineRequestMatch = output.match(/\[PIPELINE-EXECUTE\]([\s\S]*?)\[\/PIPELINE-EXECUTE\]/);

            if (pipelineRequestMatch) {
              try {
                const pipelineRequest = JSON.parse(pipelineRequestMatch[1].trim());
                console.log(`[PROXY] Detected pipeline execution request:`, pipelineRequest);

                // Extract the user-facing message (everything after the JSON block)
                const userMessage = output.replace(/\[PIPELINE-EXECUTE\][\s\S]*?\[\/PIPELINE-EXECUTE\]/, '').trim();

                // Execute the pipeline asynchronously (don't wait)
                self.executePipeline(
                  pipelineRequest.pipelineName,
                  pipelineRequest.userPrompt,
                  pipelineRequest.workingDirectory,
                  ws
                ).then(pipelineResult => {
                  console.log(`[PROXY] Pipeline completed, sending results back to Game Dev Studio`);

                  // Now send the pipeline results to Claude to format a response for the user
                  const resultMessage = `PIPELINE EXECUTION COMPLETE

The ${pipelineRequest.pipelineName} pipeline has finished executing.

Original user request: ${message}

Pipeline output:
${pipelineResult}

Your job now: Review the pipeline output and provide a helpful, conversational response to the user explaining what was done or what was found. Be concise and friendly.`;

                  self.sendToClaude(resultMessage, ws).then(finalResponse => {
                    // Send final response to user
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'assistant-message',
                        content: finalResponse
                      }));
                    }
                  });

                }).catch(err => {
                  console.error(`[PROXY] Pipeline execution failed:`, err);
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'assistant-message',
                      content: `Pipeline execution failed: ${err.message || err}`
                    }));
                  }
                });

                // Return immediate acknowledgment message
                resolve(userMessage || `Running ${pipelineRequest.pipelineName} pipeline...`);
              } catch (e) {
                console.error(`[PROXY] Failed to parse pipeline request:`, e);
                resolve(output || 'No response from Claude');
              }
            } else {
              resolve(output || 'No response from Claude');
            }
          }
        });

        claude.on('error', (error) => {
          console.log(`[PROXY] Claude spawn error: ${error.message}`);
          resolve(`Failed to start Claude: ${error.message}`);
        });

        console.log('[PROXY] Writing message to Claude stdin...');
        claude.stdin.write(message + '\n');
        claude.stdin.end();
        console.log('[PROXY] Message sent to Claude');
      });
      
    } catch (error) {
      return `Proxy error: ${error.message}`;
    }
  }

  // Detect running Claude processes that might be active pipelines
  detectRunningPipelines() {
    const { exec } = require('child_process');
    
    exec('ps aux | grep claude | grep -v grep', (error, stdout, stderr) => {
      if (error) return;
      
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      
      lines.forEach((line, index) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11 && parts[10] === 'claude') {
          const pid = parts[1];
          const startTime = parts[8];
          const pipelineId = `pipeline_${pid}`;
          
          const pipelineData = {
            pid: pid,
            prompt: 'Unknown pipeline (recovered from process)',
            startTime: startTime,
            status: 'running',
            progress: 'Pipeline detected from running process'
          };
          
          this.activePipelines.set(pipelineId, pipelineData);
          this.savePipelineData(pipelineId, pipelineData);
          
          console.log(`[PROXY] Detected running pipeline: ${pipelineId} (PID: ${pid})`);
        }
      });
      
      if (this.activePipelines.size > 0) {
        console.log(`[PROXY] Found ${this.activePipelines.size} active pipeline(s)`);
      }
    });
  }

  // Pipeline Storage Methods
  initializePipelineStorage() {
    // Create pipelines data directory if it doesn't exist
    if (!fs.existsSync(this.pipelinesDataDir)) {
      fs.mkdirSync(this.pipelinesDataDir, { recursive: true });
      console.log(`[PROXY] Created pipeline storage directory: ${this.pipelinesDataDir}`);
    }
  }

  savePipelineData(pipelineId, pipelineData) {
    try {
      const filePath = path.join(this.pipelinesDataDir, `${pipelineId}.json`);
      const dataToSave = {
        ...pipelineData,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`[PROXY] Saved pipeline data: ${pipelineId}`);
    } catch (error) {
      console.error(`[PROXY] Error saving pipeline data for ${pipelineId}:`, error);
    }
  }

  // Comprehensive execution history logging
  logPipelineExecution(pipelineId, eventType, eventData) {
    try {
      const executionLogPath = path.join(this.pipelinesDataDir, `${pipelineId}_execution.json`);

      // Load existing execution log or create new one
      let executionLog = {
        pipelineId: pipelineId,
        startTime: new Date().toISOString(),
        events: []
      };

      if (fs.existsSync(executionLogPath)) {
        const existingData = fs.readFileSync(executionLogPath, 'utf8');
        executionLog = JSON.parse(existingData);
      }

      // Add new event
      const event = {
        timestamp: new Date().toISOString(),
        eventType: eventType,
        ...eventData
      };

      executionLog.events.push(event);
      executionLog.lastUpdated = new Date().toISOString();

      // Save updated log
      fs.writeFileSync(executionLogPath, JSON.stringify(executionLog, null, 2));
      console.log(`[PROXY] [EXECUTION-LOG] ${pipelineId}: ${eventType}`);

      // Update real-time infographic
      const infographic = this.pipelineInfographics.get(pipelineId);
      if (infographic) {
        infographic.processEvent(event);
        console.log(`[PROXY] [INFOGRAPHIC] Updated HTML infographic for ${pipelineId}`);
      }
    } catch (error) {
      console.error(`[PROXY] Error logging pipeline execution for ${pipelineId}:`, error);
    }
  }

  loadPipelineData(pipelineId) {
    try {
      const filePath = path.join(this.pipelinesDataDir, `${pipelineId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[PROXY] Error loading pipeline data for ${pipelineId}:`, error);
    }
    return null;
  }

  deletePipelineData(pipelineId) {
    let deleted = false;
    try {
      // Delete from proxy/pipelines directory
      const filePath = path.join(this.pipelinesDataDir, `${pipelineId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[PROXY] Deleted pipeline data file: ${pipelineId}`);
        deleted = true;
      }

      // Also delete from proxy/pipeline-states directory
      const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';
      const stateFilePath = path.join(baseDir, 'proxy/pipeline-states', `${pipelineId}.json`);
      if (fs.existsSync(stateFilePath)) {
        fs.unlinkSync(stateFilePath);
        console.log(`[PROXY] Deleted pipeline state file: ${pipelineId}`);
        deleted = true;
      }

      // If this was current.json, also delete it
      const currentFilePath = path.join(baseDir, 'proxy/pipeline-states', 'current.json');
      if (fs.existsSync(currentFilePath)) {
        const currentState = JSON.parse(fs.readFileSync(currentFilePath, 'utf8'));
        if (currentState.id === pipelineId) {
          fs.unlinkSync(currentFilePath);
          console.log(`[PROXY] Deleted current pipeline state`);
          deleted = true;
        }
      }
    } catch (error) {
      console.error(`[PROXY] Error deleting pipeline data for ${pipelineId}:`, error);
    }
    return deleted;
  }

  loadActivePipelines() {
    try {
      const files = fs.readdirSync(this.pipelinesDataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const pipelineId = path.basename(file, '.json');
        const pipelineData = this.loadPipelineData(pipelineId);
        
        if (pipelineData && pipelineData.status === 'running') {
          // Verify the process is still running
          const { exec } = require('child_process');
          exec(`ps -p ${pipelineData.pid}`, (error) => {
            if (error) {
              // Process no longer running, mark as stopped
              pipelineData.status = 'stopped';
              this.savePipelineData(pipelineId, pipelineData);
              console.log(`[PROXY] Pipeline ${pipelineId} marked as stopped (process no longer running)`);
            } else {
              // Process still running, add to active pipelines
              this.activePipelines.set(pipelineId, pipelineData);
              console.log(`[PROXY] Restored active pipeline: ${pipelineId}`);
            }
          });
        }
      }
    } catch (error) {
      console.error('[PROXY] Error loading active pipelines:', error);
    }
  }

  getAllPipelines() {
    try {
      const files = fs.readdirSync(this.pipelinesDataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      return jsonFiles.map(file => {
        const pipelineId = path.basename(file, '.json');
        return this.loadPipelineData(pipelineId);
      }).filter(Boolean);
    } catch (error) {
      console.error('[PROXY] Error getting all pipelines:', error);
      return [];
    }
  }

  // Template Storage Methods
  initializeTemplateStorage() {
    // Templates directory should exist, but check just in case
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      console.log(`[PROXY] Created template storage directory: ${this.templatesDir}`);
    }
  }

  loadTemplate(templateId) {
    try {
      const filePath = path.join(this.templatesDir, `${templateId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[PROXY] Error loading template ${templateId}:`, error);
    }
    return null;
  }

  getAllTemplates() {
    try {
      console.log(`[PROXY] Loading templates from: ${this.templatesDir}`);
      const files = fs.readdirSync(this.templatesDir);
      console.log(`[PROXY] Found files:`, files);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      console.log(`[PROXY] JSON files:`, jsonFiles);
      
      const templates = jsonFiles.map(file => {
        const templateId = path.basename(file, '.json');
        const template = this.loadTemplate(templateId);
        console.log(`[PROXY] Loaded template ${templateId}:`, template ? 'SUCCESS' : 'FAILED');
        return template;
      }).filter(Boolean);
      
      console.log(`[PROXY] Returning ${templates.length} templates`);
      return templates;
    } catch (error) {
      console.error('[PROXY] Error getting all templates:', error);
      return [];
    }
  }

  deleteTemplate(templateId) {
    try {
      const filePath = path.join(this.templatesDir, `${templateId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[PROXY] Deleted template file: ${templateId}`);
        return true;
      }
    } catch (error) {
      console.error(`[PROXY] Error deleting template ${templateId}:`, error);
    }
    return false;
  }

  saveTemplate(templateData) {
    try {
      const filePath = path.join(this.templatesDir, `${templateData.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(templateData, null, 2));
      console.log(`[PROXY] Saved template: ${templateData.id}`);
      return true;
    } catch (error) {
      console.error(`[PROXY] Error saving template ${templateData.id}:`, error);
      return false;
    }
  }

  // Agent Storage Methods
  initializeAgentStorage() {
    // Agents directory should exist, but check just in case
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
      console.log(`[PROXY] Created agent storage directory: ${this.agentsDir}`);
    }
  }

  loadAgent(agentId) {
    try {
      const filePath = path.join(this.agentsDir, `${agentId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[PROXY] Error loading agent ${agentId}:`, error);
    }
    return null;
  }

  getAllAgents() {
    try {
      const files = fs.readdirSync(this.agentsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      return jsonFiles.map(file => {
        const agentId = path.basename(file, '.json');
        return this.loadAgent(agentId);
      }).filter(Boolean);
    } catch (error) {
      console.error('[PROXY] Error getting all agents:', error);
      return [];
    }
  }

  deleteAgent(agentId) {
    try {
      const filePath = path.join(this.agentsDir, `${agentId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[PROXY] Deleted agent file: ${agentId}`);
        return true;
      }
    } catch (error) {
      console.error(`[PROXY] Error deleting agent ${agentId}:`, error);
    }
    return false;
  }

  saveAgent(agentData) {
    try {
      const filePath = path.join(this.agentsDir, `${agentData.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(agentData, null, 2));
      console.log(`[PROXY] Saved agent: ${agentData.id}`);
      return true;
    } catch (error) {
      console.error(`[PROXY] Error saving agent ${agentData.id}:`, error);
      return false;
    }
  }

  // Hat Storage Methods
  initializeHatStorage() {
    if (!fs.existsSync(this.hatsDir)) {
      fs.mkdirSync(this.hatsDir, { recursive: true });
      console.log(`[PROXY] Created hat storage directory: ${this.hatsDir}`);
    }
    console.log(`[PROXY] Hat storage initialized at: ${this.hatsDir}`);
  }

  loadHat(hatId) {
    try {
      const filePath = path.join(this.hatsDir, `${hatId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[PROXY] Error loading hat ${hatId}:`, error);
    }
    return null;
  }

  getAllHats() {
    try {
      const files = fs.readdirSync(this.hatsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      return jsonFiles.map(file => {
        const hatId = path.basename(file, '.json');
        return this.loadHat(hatId);
      }).filter(Boolean);
    } catch (error) {
      console.error('[PROXY] Error getting all hats:', error);
      return [];
    }
  }

  saveHat(hatData) {
    try {
      hatData.updatedAt = new Date().toISOString();
      if (!hatData.createdAt) {
        hatData.createdAt = hatData.updatedAt;
      }
      const filePath = path.join(this.hatsDir, `${hatData.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(hatData, null, 2));
      console.log(`[PROXY] Saved hat: ${hatData.id}`);
      return true;
    } catch (error) {
      console.error(`[PROXY] Error saving hat ${hatData.id}:`, error);
      return false;
    }
  }

  deleteHat(hatId) {
    try {
      const filePath = path.join(this.hatsDir, `${hatId}.json`);
      if (fs.existsSync(filePath)) {
        // Don't allow deleting the default hat
        const hat = this.loadHat(hatId);
        if (hat && hat.isDefault) {
          console.log(`[PROXY] Cannot delete default hat: ${hatId}`);
          return false;
        }
        fs.unlinkSync(filePath);
        console.log(`[PROXY] Deleted hat file: ${hatId}`);
        return true;
      }
    } catch (error) {
      console.error(`[PROXY] Error deleting hat ${hatId}:`, error);
    }
    return false;
  }

  buildHatContext(hatId) {
    // Build the context string from a hat's system prompt and documentation
    const hat = this.loadHat(hatId);
    if (!hat || hat.isDefault) {
      return ''; // No context for default hat
    }

    let context = '';

    // Add system prompt
    if (hat.systemPrompt && hat.systemPrompt.trim()) {
      context += `<hat-context name="${hat.name}">\n`;
      context += hat.systemPrompt;
      context += '\n</hat-context>\n\n';
    }

    // Add documentation files
    if (hat.documentationPaths && hat.documentationPaths.length > 0) {
      context += '<hat-documentation>\n';
      for (const docPath of hat.documentationPaths) {
        try {
          if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf8');
            const filename = path.basename(docPath);
            context += `\n--- ${filename} ---\n`;
            context += content;
            context += '\n--- end ---\n';
          } else {
            console.log(`[PROXY] Hat documentation file not found: ${docPath}`);
          }
        } catch (error) {
          console.error(`[PROXY] Error reading hat documentation ${docPath}:`, error);
        }
      }
      context += '</hat-documentation>\n\n';
    }

    return context;
  }

  buildMultiHatContext(hatIds) {
    // Build combined context from multiple hats
    if (!hatIds || hatIds.length === 0) {
      return '';
    }

    // For single hat, use the existing method
    if (hatIds.length === 1) {
      return this.buildHatContext(hatIds[0]);
    }

    // For multiple hats, combine their contexts
    let combinedContext = '';
    const loadedHats = [];

    for (const hatId of hatIds) {
      const hat = this.loadHat(hatId);
      if (hat && !hat.isDefault) {
        loadedHats.push(hat);
      }
    }

    if (loadedHats.length === 0) {
      return '';
    }

    // Add all system prompts in hat-context blocks
    for (const hat of loadedHats) {
      if (hat.systemPrompt && hat.systemPrompt.trim()) {
        combinedContext += `<hat-context name="${hat.name}">\n`;
        combinedContext += hat.systemPrompt;
        combinedContext += '\n</hat-context>\n\n';
      }
    }

    // Combine all documentation from all hats (deduped by path)
    const allDocPaths = new Set();
    for (const hat of loadedHats) {
      if (hat.documentationPaths && hat.documentationPaths.length > 0) {
        for (const docPath of hat.documentationPaths) {
          allDocPaths.add(docPath);
        }
      }
    }

    if (allDocPaths.size > 0) {
      combinedContext += '<hat-documentation>\n';
      for (const docPath of allDocPaths) {
        try {
          if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf8');
            const filename = path.basename(docPath);
            combinedContext += `\n--- ${filename} ---\n`;
            combinedContext += content;
            combinedContext += '\n--- end ---\n';
          } else {
            console.log(`[PROXY] Hat documentation file not found: ${docPath}`);
          }
        } catch (error) {
          console.error(`[PROXY] Error reading hat documentation ${docPath}:`, error);
        }
      }
      combinedContext += '</hat-documentation>\n\n';
    }

    return combinedContext;
  }

  parsePipelineGenerationResponse(response) {
    console.log(`[PROXY] Parsing pipeline generation response...`);

    const results = {
      template: null,
      agents: []
    };

    try {
      // Extract template section
      const templateMatch = response.match(/=== TEMPLATE ===\s*([\s\S]*?)(?=\n=== AGENT:|$)/);
      if (templateMatch && templateMatch[1]) {
        const templateJson = templateMatch[1].trim();
        results.template = JSON.parse(templateJson);
        console.log(`[PROXY] Parsed template: ${results.template.id}`);
      }

      // Extract all agent sections
      const agentMatches = response.matchAll(/=== AGENT: ([\w_-]+) ===\s*([\s\S]*?)(?=\n=== AGENT:|$)/g);
      for (const match of agentMatches) {
        const agentId = match[1];
        const agentJson = match[2].trim();
        try {
          const agent = JSON.parse(agentJson);
          results.agents.push(agent);
          console.log(`[PROXY] Parsed agent: ${agentId}`);
        } catch (err) {
          console.error(`[PROXY] Failed to parse agent ${agentId}:`, err);
        }
      }

      console.log(`[PROXY] Parsing complete: ${results.template ? 'template OK' : 'no template'}, ${results.agents.length} agents`);
      return results;
    } catch (error) {
      console.error(`[PROXY] Error parsing pipeline generation response:`, error);
      return results;
    }
  }

  async generateCommentary(context, workingDir, pipelineId = null) {
    const startTime = Date.now();
    try {
      const prompt = `You are providing real-time status updates for a pipeline execution system.

Current context: ${context}

Provide engaging, concise commentary (1-2 sentences max) about what's happening. Include a style directive in brackets at the start.

STYLE OPTIONS:
- [STYLE:EXCITED] - For positive progress, breakthroughs
- [STYLE:FOCUSED] - For intense work, analysis
- [STYLE:CONCERNED] - For issues, retries, problems
- [STYLE:TRIUMPHANT] - For completions, successes
- [STYLE:CRITICAL] - For failures, serious issues

Example: [STYLE:EXCITED] The Lore Architect just awakened and is ready to craft some epic worldbuilding magic!

Your commentary:`;

      // Use direct Anthropic API call - much cheaper than Claude Code CLI
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      });

      const durationMs = Date.now() - startTime;
      const rawCommentary = response.content[0].text.trim();

      // Extract usage from response
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      // Haiku pricing: $0.80/1M input, $4.00/1M output
      const cost = (inputTokens / 1000000) * 0.80 + (outputTokens / 1000000) * 4.00;

      const usageData = {
        agentName: 'commentator',
        model: 'claude-3-5-haiku-20241022',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        durationMs,
        estimatedCostUsd: cost,
        pipelineId
      };

      console.log(`[PROXY] [COMMENTARY] Direct API: ${inputTokens}/${outputTokens} tokens, $${cost.toFixed(6)}, ${durationMs}ms`);
      this.broadcastUsageEvent({ ...usageData, actionType: 'commentary' });

      console.log(`[PROXY] [COMMENTARY] Raw output: "${rawCommentary.substring(0, 200)}..."`);

      // Parse styling directive if present
      const styleMatch = rawCommentary.match(/^\[STYLE:(\w+)\]\s*(.*)$/);
      let cleanCommentary, styleChoice;

      if (styleMatch) {
        styleChoice = styleMatch[1].toLowerCase();
        cleanCommentary = styleMatch[2];
      } else {
        styleChoice = 'neutral';
        cleanCommentary = rawCommentary;
      }

      return {
        content: cleanCommentary,
        style: styleChoice
      };
    } catch (error) {
      console.error('[PROXY] Commentary generation failed:', error);
      return {
        content: `Pipeline is running smoothly...`,
        style: 'neutral'
      };
    }
  }

  // Broadcast AI usage event to connected clients
  broadcastUsageEvent(usageData, targetWs = null) {
    const usageMessage = JSON.stringify({
      type: 'ai-usage',
      content: {
        timestamp: usageData.timestamp || new Date().toISOString(),
        agentName: usageData.agentName,
        actionType: usageData.actionType || 'agent_execution',
        model: usageData.model,
        inputTokens: usageData.inputTokens,
        outputTokens: usageData.outputTokens,
        totalTokens: usageData.totalTokens,
        inputCharCount: usageData.inputCharCount,
        outputCharCount: usageData.outputCharCount,
        durationMs: usageData.durationMs,
        estimatedCostUsd: usageData.estimatedCostUsd,
        pipelineId: usageData.pipelineId,
        stageId: usageData.stageId,
        stageName: usageData.stageName
      }
    });

    // Only send to the target WebSocket (not all clients)
    if (targetWs && targetWs.readyState === 1) {
      try {
        targetWs.send(usageMessage);
      } catch (err) {
        console.error('[PROXY] Failed to send usage event to client:', err.message);
      }
    }

    console.log(`[PROXY] [USAGE] Sent usage event to target client: ${usageData.agentName}, ${usageData.totalTokens} tokens, $${usageData.estimatedCostUsd?.toFixed(6) || '0.000000'}`);
  }

  async sendCommentaryUpdate(ws, context, workingDir, pipelineId = null) {
    // Run commentary generation in background without blocking pipeline
    setImmediate(async () => {
      try {
        const commentary = await this.generateCommentary(context, workingDir, pipelineId);

        const commentaryMessage = JSON.stringify({
          type: 'pipeline-commentary', // Different type so it doesn't interfere with status
          content: {
            timestamp: new Date().toISOString(),
            agent: 'COMMENTATOR',
            type: 'commentary',
            message: commentary.content,
            style: commentary.style,
            priority: 'high', // Mark as important
            persistent: true   // Should stay visible longer
          }
        });

        // Send only to the originating client
        if (ws && ws.readyState === 1) {
          ws.send(commentaryMessage);
        }
      } catch (error) {
        console.error('[PROXY] Background commentary failed:', error);
      }
    });
  }

  async savePipelineState(pipelineState) {
    try {
      const stateDir = path.join(__dirname, 'pipeline-states');
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      
      const statePath = path.join(stateDir, `${pipelineState.id}.json`);
      fs.writeFileSync(statePath, JSON.stringify(pipelineState, null, 2));
      
      // Also save as "current" for easy lookup
      const currentPath = path.join(stateDir, 'current.json');
      fs.writeFileSync(currentPath, JSON.stringify(pipelineState, null, 2));
      
      console.log(`[PROXY] Pipeline state saved: ${pipelineState.id}`);
    } catch (error) {
      console.error('[PROXY] Failed to save pipeline state:', error);
    }
  }

  async loadCurrentPipelineState() {
    try {
      const currentPath = path.join(__dirname, 'pipeline-states', 'current.json');
      if (fs.existsSync(currentPath)) {
        const stateData = fs.readFileSync(currentPath, 'utf8');
        const pipelineState = JSON.parse(stateData);

        // Only return if pipeline is actually running
        if (pipelineState.status === 'running') {
          console.log(`[PROXY] Found running pipeline: ${pipelineState.name}`);
          return pipelineState;
        }
      }
      return null;
    } catch (error) {
      console.error('[PROXY] Failed to load pipeline state:', error);
      return null;
    }
  }

  async autoCommitPipelineChanges(pipelineState, workingDir) {
    try {
      console.log(`[PROXY] [AUTO-COMMIT] Checking for changes to commit in ${workingDir}`);

      // Check if working directory is a git repository
      const { execSync } = require('child_process');

      try {
        execSync('git rev-parse --git-dir', { cwd: workingDir, stdio: 'pipe' });
      } catch (err) {
        console.log(`[PROXY] [AUTO-COMMIT] Not a git repository: ${workingDir}`);
        return;
      }

      // Check if there are any changes
      let statusOutput;
      try {
        statusOutput = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf8' });
      } catch (err) {
        console.error(`[PROXY] [AUTO-COMMIT] Failed to check git status:`, err.message);
        return;
      }

      if (!statusOutput || statusOutput.trim().length === 0) {
        console.log(`[PROXY] [AUTO-COMMIT] No changes to commit`);
        return;
      }

      console.log(`[PROXY] [AUTO-COMMIT] Changes detected, creating commit...`);

      // Generate commit message based on pipeline results
      const pipelineName = pipelineState.name || 'Pipeline';
      const completedStages = pipelineState.completedStages || [];
      const totalStages = completedStages.length;

      // Build a summary of what was done
      let commitMessage = `Pipeline auto-commit: ${pipelineName}\n\n`;
      commitMessage += `Completed ${totalStages} stage${totalStages !== 1 ? 's' : ''}:\n`;

      // Add completed stages to commit message
      completedStages.forEach((stageId, index) => {
        const stage = pipelineState.stages?.find(s => s.id === stageId);
        const stageName = stage?.name || stageId;
        commitMessage += `${index + 1}. ${stageName}\n`;
      });

      commitMessage += `\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n`;
      commitMessage += `Co-Authored-By: Claude <noreply@anthropic.com>`;

      // Stage all modified files
      try {
        execSync('git add -u', { cwd: workingDir, stdio: 'pipe' });
        console.log(`[PROXY] [AUTO-COMMIT] Staged modified files`);
      } catch (err) {
        console.error(`[PROXY] [AUTO-COMMIT] Failed to stage files:`, err.message);
        return;
      }

      // Create commit
      try {
        execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: workingDir,
          stdio: 'pipe'
        });
        console.log(`[PROXY] [AUTO-COMMIT] ✅ Commit created successfully`);

        // Get the commit hash
        const commitHash = execSync('git rev-parse --short HEAD', {
          cwd: workingDir,
          encoding: 'utf8'
        }).trim();
        console.log(`[PROXY] [AUTO-COMMIT] Commit hash: ${commitHash}`);

        return commitHash;
      } catch (err) {
        console.error(`[PROXY] [AUTO-COMMIT] Failed to create commit:`, err.message);
        return null;
      }
    } catch (error) {
      console.error(`[PROXY] [AUTO-COMMIT] Error during auto-commit:`, error.message);
      return null;
    }
  }

  async executePipeline(pipelineName, userPrompt, workingDir, ws) {
    console.log(`[PROXY] Loading and executing pipeline: ${pipelineName}`);

    try {
      // Load the pipeline template
      const templatePath = path.join(this.templatesDir, `${pipelineName}.json`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Pipeline template not found: ${pipelineName}`);
      }

      const pipelineTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      console.log(`[PROXY] Loaded pipeline template: ${pipelineTemplate.name}`);

      // Execute the pipeline with the user prompt as context
      return await this.executePipelineStages(pipelineTemplate, userPrompt, workingDir, ws);

    } catch (error) {
      console.error(`[PROXY] Failed to execute pipeline ${pipelineName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a pipeline for chat messages - supports conditional routing and sub-pipelines
   * This sends responses back in chat-compatible format with tabId for proper routing
   */
  async executeChatPipeline(pipeline, userContext, workingDir, ws, tabId, conversationId) {
    console.log(`[PROXY] [PIPELINE-CHAT] Starting chat pipeline: ${pipeline.name} for tab ${tabId}`);

    try {
      // For chat pipelines, we run through stages but format output as chat messages
      const results = {};
      const stageMap = {};
      pipeline.stages.forEach(stage => stageMap[stage.id] = stage);

      let currentStageId = pipeline.stages[0]?.id;
      let executionCount = 0;
      const maxExecutions = 20; // Higher limit for complex pipelines with sub-pipelines

      while (currentStageId && executionCount < maxExecutions) {
        const stage = stageMap[currentStageId];
        if (!stage) break;

        executionCount++;
        console.log(`[PROXY] [PIPELINE-CHAT] Executing stage: ${stage.name} (${stage.agent || 'sub_pipeline'})`);

        // Send stage start notification
        ws.send(JSON.stringify({
          type: 'agent-stream',
          tabId: tabId,
          content: { eventType: 'stage_start', stageName: stage.name, agent: stage.agent || 'sub_pipeline' }
        }));

        // Handle sub-pipeline stages
        if (stage.type === 'sub_pipeline' && stage.config?.pipeline) {
          console.log(`[PROXY] [PIPELINE-CHAT] Executing sub-pipeline: ${stage.config.pipeline}`);

          // Load sub-pipeline template
          const subPipelinePath = path.join(__dirname, '..', 'templates', `${stage.config.pipeline}.json`);
          if (!fs.existsSync(subPipelinePath)) {
            console.error(`[PROXY] [PIPELINE-CHAT] Sub-pipeline not found: ${stage.config.pipeline}`);
            results[stage.id] = `Error: Sub-pipeline ${stage.config.pipeline} not found`;
          } else {
            const subPipeline = JSON.parse(fs.readFileSync(subPipelinePath, 'utf8'));

            // Build sub-pipeline input
            let subInput = userContext;
            const stageInputs = stage.inputs || [];
            if (stageInputs.length > 0) {
              subInput += '\n\nContext from parent pipeline:\n';
              stageInputs.forEach(inputStage => {
                if (results[inputStage]) {
                  subInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
                }
              });
            }

            // Recursively execute sub-pipeline (but capture output, don't send as final message)
            const subResults = await this.executeChatSubPipeline(subPipeline, subInput, workingDir, ws, tabId);
            results[stage.id] = subResults;
          }

          // Determine next stage after sub-pipeline
          currentStageId = this.determineNextStage(pipeline, stage.id, 'complete');
          continue;
        }

        // Build stage input
        let stageInput = userContext;
        const stageInputs = stage.inputs || [];
        if (stageInputs.length > 0) {
          stageInput += '\n\nInputs from previous stages:\n';
          stageInputs.forEach(inputStage => {
            if (results[inputStage]) {
              stageInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
            }
          });
        }

        // Load agent config
        const agentPath = path.join(__dirname, '..', 'agents', `${stage.agent}.json`);
        let agentPrompt = `You are ${stage.agent.toUpperCase()}. Complete your task.`;

        if (fs.existsSync(agentPath)) {
          const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
          if (agentConfig.system_prompt_template) {
            agentPrompt = agentConfig.system_prompt_template;
          } else if (agentConfig.systemPrompt) {
            agentPrompt = agentConfig.systemPrompt;
          }
        }

        // Add decision instructions if stage has decisions defined
        let availableDecisions = stage.decisions || [];
        if (availableDecisions.length === 0) {
          // Extract decisions from pipeline connections
          const connections = pipeline.flow?.connections || [];
          const stageConnections = connections.filter(conn => conn.from === stage.id);
          availableDecisions = stageConnections.map(conn => ({
            choice: typeof conn.condition === 'object' ? conn.condition.value : conn.condition,
            description: conn.description || `Go to ${conn.to}`
          }));
        }

        if (availableDecisions.length > 0 && !agentPrompt.includes('DECISION:')) {
          agentPrompt += `\n\n=== ROUTING DECISION REQUIRED ===\n`;
          agentPrompt += `After your response, you MUST choose exactly ONE decision from:\n`;
          availableDecisions.forEach(decision => {
            agentPrompt += `- ${decision.choice}: ${decision.description}\n`;
          });
          agentPrompt += `\n**CRITICAL**: Your VERY LAST LINE must be exactly:\n`;
          agentPrompt += `DECISION: [ONE_OF_THE_ABOVE_CHOICES]\n`;
          agentPrompt += `Example: DECISION: ${availableDecisions[0].choice}\n`;
        }

        // Execute Claude with streaming for this stage
        const { output, usage } = await this.executeChatPipelineStage(
          stage.agent, agentPrompt, stageInput, workingDir, ws, tabId
        );

        results[stage.id] = output;

        // Send usage for this stage
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
          ws.send(JSON.stringify({
            type: 'ai-usage',
            tabId: tabId,
            content: usage
          }));
        }

        // Determine next stage using proper conditional routing
        currentStageId = this.determineNextStage(pipeline, stage.id, output);
        console.log(`[PROXY] [PIPELINE-CHAT] Next stage: ${currentStageId || 'END'}`);
      }

      // Get final output from last executed stage (usually response_synthesis)
      const lastExecutedStages = Object.keys(results);
      const lastStageId = lastExecutedStages[lastExecutedStages.length - 1];
      let finalOutput = results[lastStageId] || '';

      // Clean up the final output - remove DECISION lines from user-facing response
      finalOutput = finalOutput.replace(/\n*\*{0,2}DECISION:\s*\w+\*{0,2}\s*$/i, '').trim();

      // Extract reflection metadata from hat_reflection stage if present
      let reflectionMetadata = null;
      if (results['hat_reflection']) {
        const reflectionOutput = results['hat_reflection'];

        // Extract "Action Taken:" section
        const actionMatch = reflectionOutput.match(/\*{0,2}Action Taken:\*{0,2}\s*\n?\s*(.+?)(?:\n\n|\n\*{0,2}|$)/is);
        if (actionMatch) {
          const actionText = actionMatch[1].trim();
          // Only include if something was actually updated (not "No updates needed")
          if (actionText && !actionText.toLowerCase().includes('no update') && !actionText.toLowerCase().includes('none')) {
            reflectionMetadata = {
              actionTaken: actionText,
              timestamp: new Date().toISOString()
            };
            console.log(`[PROXY] [PIPELINE-CHAT] Reflection action: ${actionText}`);
          }
        }
      }

      // Store in conversation history
      const history = this.conversationHistory.get(ws) || [];
      history.push({
        user: userContext,
        assistant: finalOutput
      });
      this.conversationHistory.set(ws, history);

      // Send final response as chat message with optional reflection metadata
      ws.send(JSON.stringify({
        type: 'assistant-message',
        tabId: tabId,
        content: finalOutput,
        reflection: reflectionMetadata
      }));

      console.log(`[PROXY] [PIPELINE-CHAT] Pipeline completed for tab ${tabId}`);

    } catch (error) {
      console.error(`[PROXY] [PIPELINE-CHAT] Error:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        tabId: tabId,
        message: `Pipeline error: ${error.message}`
      }));
    }
  }

  /**
   * Execute a sub-pipeline for chat - returns combined output instead of sending as final message
   */
  async executeChatSubPipeline(pipeline, userContext, workingDir, ws, tabId) {
    console.log(`[PROXY] [PIPELINE-CHAT-SUB] Executing sub-pipeline: ${pipeline.name}`);

    const results = {};
    const stageMap = {};
    pipeline.stages.forEach(stage => stageMap[stage.id] = stage);

    let currentStageId = pipeline.stages[0]?.id;
    let executionCount = 0;
    const maxExecutions = 10;

    while (currentStageId && executionCount < maxExecutions) {
      const stage = stageMap[currentStageId];
      if (!stage) break;

      executionCount++;
      console.log(`[PROXY] [PIPELINE-CHAT-SUB] Stage: ${stage.name} (${stage.agent})`);

      // Send stage notification
      ws.send(JSON.stringify({
        type: 'agent-stream',
        tabId: tabId,
        content: { eventType: 'stage_start', stageName: `[Sub] ${stage.name}`, agent: stage.agent }
      }));

      // Build stage input
      let stageInput = userContext;
      const stageInputs = stage.inputs || [];
      if (stageInputs.length > 0) {
        stageInput += '\n\nInputs from previous stages:\n';
        stageInputs.forEach(inputStage => {
          if (results[inputStage]) {
            stageInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
          }
        });
      }

      // Load agent config and prompt
      const agentPath = path.join(__dirname, '..', 'agents', `${stage.agent}.json`);
      let agentPrompt = `You are ${stage.agent.toUpperCase()}. Complete your task.`;

      if (fs.existsSync(agentPath)) {
        const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
        agentPrompt = agentConfig.system_prompt_template || agentConfig.systemPrompt || agentPrompt;
      }

      // Add decision instructions if needed
      let availableDecisions = stage.decisions || [];
      if (availableDecisions.length === 0) {
        const connections = pipeline.flow?.connections || [];
        const stageConnections = connections.filter(conn => conn.from === stage.id);
        availableDecisions = stageConnections.map(conn => ({
          choice: typeof conn.condition === 'object' ? conn.condition.value : conn.condition,
          description: conn.description || `Go to ${conn.to}`
        }));
      }

      if (availableDecisions.length > 0 && !agentPrompt.includes('DECISION:')) {
        agentPrompt += `\n\n=== ROUTING DECISION REQUIRED ===\n`;
        agentPrompt += `After your response, choose ONE decision:\n`;
        availableDecisions.forEach(d => agentPrompt += `- ${d.choice}: ${d.description}\n`);
        agentPrompt += `\nYour LAST LINE must be: DECISION: [CHOICE]\n`;
      }

      // Execute stage
      const { output, usage } = await this.executeChatPipelineStage(
        stage.agent, agentPrompt, stageInput, workingDir, ws, tabId
      );

      results[stage.id] = output;

      if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        ws.send(JSON.stringify({
          type: 'ai-usage',
          tabId: tabId,
          content: usage
        }));
      }

      currentStageId = this.determineNextStage(pipeline, stage.id, output);
    }

    // Return combined output from sub-pipeline
    return Object.values(results).join('\n\n---\n\n');
  }

  /**
   * Execute a single stage of a chat pipeline with streaming output
   */
  async executeChatPipelineStage(agentName, agentPrompt, stageInput, workingDir, ws, tabId) {
    return new Promise((resolve) => {
      const { ANTHROPIC_API_KEY: _apiKey, ...cleanEnv } = process.env;

      const claude = spawn('claude', [
        '--permission-mode', 'bypassPermissions',
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '-p', agentPrompt,
        '-'
      ], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...cleanEnv, PWD: workingDir }
      });

      let lineBuffer = '';
      let streamingText = '';
      let currentToolBlock = null;
      let usageData = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

      const broadcastEvent = (eventType, data) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'agent-stream',
            tabId: tabId,
            content: { eventType, ...data }
          }));
        }
      };

      claude.stdout.on('data', (data) => {
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            let event = JSON.parse(line);
            if (event.type === 'stream_event' && event.event) {
              event = event.event;
            }

            // Tool start
            if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
              const block = event.content_block;
              currentToolBlock = { name: block.name, id: block.id, input: '' };
              broadcastEvent('tool_start', { tool: block.name });
            }

            // Tool input accumulation
            if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
              if (currentToolBlock) {
                currentToolBlock.input += event.delta.partial_json || '';
              }
            }

            // Tool completion
            if (event.type === 'content_block_stop' && currentToolBlock) {
              let parsedInput = currentToolBlock.input;
              try { parsedInput = JSON.parse(currentToolBlock.input); } catch (e) {}

              // Special handling for TodoWrite - emit todo_update
              if (currentToolBlock.name === 'TodoWrite' && parsedInput?.todos) {
                broadcastEvent('todo_update', { todos: parsedInput.todos });
              }
              // File operations
              else if (['Read', 'Write', 'Edit'].includes(currentToolBlock.name)) {
                const filePath = parsedInput?.file_path || '';
                broadcastEvent('file_operation', {
                  tool: currentToolBlock.name,
                  file: filePath.split('/').pop() || filePath
                });
              }
              else {
                broadcastEvent('tool_call', {
                  tool: currentToolBlock.name,
                  input: typeof parsedInput === 'string' ? parsedInput.slice(0, 200) : JSON.stringify(parsedInput).slice(0, 200)
                });
              }
              currentToolBlock = null;
            }

            // Handle user messages containing tool results (marks tools as complete)
            if (event.type === 'user' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'tool_result') {
                  const resultPreview = typeof block.content === 'string'
                    ? block.content.slice(0, 500)
                    : JSON.stringify(block.content).slice(0, 500);
                  broadcastEvent('tool_result', {
                    result: resultPreview,
                    is_error: block.is_error || false
                  });
                }
              }
            }

            // Text streaming
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text || '';
              streamingText += text;
              // Include accumulated (last 500 chars) for frontend text display
              broadcastEvent('text_delta', {
                text,
                accumulated: streamingText.slice(-500),
                totalLength: streamingText.length
              });
            }

            // Text block start
            if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
              const initialText = event.content_block.text || '';
              if (initialText) {
                streamingText += initialText;
                broadcastEvent('text_delta', {
                  text: initialText,
                  accumulated: streamingText.slice(-500),
                  totalLength: streamingText.length
                });
              }
            }

            // Usage data
            if (event.type === 'usage' || event.type === 'message_delta') {
              if (event.usage) {
                usageData.inputTokens = event.usage.input_tokens || usageData.inputTokens;
                usageData.outputTokens = event.usage.output_tokens || usageData.outputTokens;
              }
            }

            // Final result
            if (event.type === 'result' && event.result) {
              streamingText = event.result;
            }

          } catch (e) {
            streamingText += line + '\n';
          }
        }
      });

      claude.stderr.on('data', (data) => {
        console.log(`[PROXY] [PIPELINE-CHAT] Stage stderr: ${data.toString()}`);
      });

      claude.on('close', (code) => {
        broadcastEvent('complete', { workLogCount: 0 });
        resolve({
          output: streamingText.trim(),
          usage: usageData
        });
      });

      claude.on('error', (error) => {
        console.error(`[PROXY] [PIPELINE-CHAT] Stage error:`, error);
        resolve({
          output: `Error: ${error.message}`,
          usage: usageData
        });
      });

      // Send the input
      claude.stdin.write(stageInput + '\n');
      claude.stdin.end();
    });
  }

  async resumePipeline(pipelineId, ws) {
    console.log(`[PROXY] Resuming pipeline: ${pipelineId}`);

    try {
      // Load pipeline state from disk
      const stateFilePath = path.join(__dirname, 'pipeline-states', `${pipelineId}.json`);
      if (!fs.existsSync(stateFilePath)) {
        throw new Error(`Pipeline state file not found: ${pipelineId}`);
      }

      const pipelineState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));

      console.log(`[PROXY] Loaded pipeline state: ${pipelineState.name}`);
      console.log(`[PROXY] Current stage index: ${pipelineState.currentStageIndex}`);
      console.log(`[PROXY] Completed stages: ${pipelineState.completedStages.length}`);
      console.log(`[PROXY] Total stages: ${pipelineState.stages.length}`);
      console.log(`[PROXY] Status: ${pipelineState.status}`);

      // Update status to running
      pipelineState.status = 'running';
      pipelineState.pid = process.pid;
      await this.savePipelineState(pipelineState);

      // Store pipeline client mapping
      this.pipelineClients.set(pipelineState.id, ws);

      // Notify client of resume
      ws.send(JSON.stringify({
        type: 'pipeline-resumed',
        pipelineId: pipelineState.id,
        pipelineName: pipelineState.name,
        currentStage: pipelineState.currentStage,
        completedStages: pipelineState.completedStages.length,
        totalStages: pipelineState.stages.length,
        startTime: pipelineState.startTime
      }));

      // Continue execution from where it left off
      return await this.resumePipelineExecution(pipelineState, ws);

    } catch (error) {
      console.error(`[PROXY] Failed to resume pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  async resumePipelineExecution(pipelineState, ws) {
    console.log(`[PROXY] Resuming execution for pipeline: ${pipelineState.name}`);

    const { stages, connections, userContext, workingDir, currentStageIndex, completedStages, results } = pipelineState;

    // Restore infographic generator
    const infographic = new InfographicGenerator(pipelineState.id, pipelineState.name);
    this.pipelineInfographics.set(pipelineState.id, infographic);
    console.log(`[PROXY] Infographic restored: ${infographic.getInfographicPath()}`);

    // Send infographic URL to client
    ws.send(JSON.stringify({
      type: 'infographic-ready',
      pipelineId: pipelineState.id,
      infographicPath: infographic.getInfographicPath(),
      infographicUrl: `file://${infographic.getInfographicPath()}`
    }));

    // Build stage map
    const stageMap = {};
    stages.forEach(stage => stageMap[stage.id] = stage);

    // Find the current stage to resume from
    // Use the last completed stage to determine what failed and needs re-running
    // The lastCompletedStage was the one that routed TO the failed stage
    let previousStageId = completedStages.length > 0 ? completedStages[completedStages.length - 1] : null;

    // Find what stage the previous stage routed to - that's the one that failed
    let currentStageId = null;
    if (previousStageId) {
      const matchingConnection = connections.find(conn => {
        if (conn.from !== previousStageId) return false;
        // Check if this connection was taken based on the result
        const prevResult = results[previousStageId] || '';
        const condition = typeof conn.condition === 'object' ? conn.condition.value : conn.condition;
        return prevResult.toLowerCase().includes(condition.toLowerCase());
      });
      currentStageId = matchingConnection?.to || null;
    }

    // Fallback: try to find stage by name from pipelineState.currentStage
    if (!currentStageId && pipelineState.currentStage) {
      const stageByName = stages.find(s => s.name === pipelineState.currentStage);
      currentStageId = stageByName?.id || null;
    }

    let executionCount = completedStages.length;
    const maxExecutions = 100;

    console.log(`[PROXY] Resuming from stage: ${currentStageId} (previous: ${previousStageId})`);
    console.log(`[PROXY] Execution count: ${executionCount}`);

    // Send resume notification
    await this.sendCommentaryUpdate(ws, `Resuming pipeline "${pipelineState.name}" from stage "${currentStageId}". ${executionCount} stages already completed.`, workingDir, pipelineState.id);

    // Continue the execution loop from where it left off
    while (currentStageId && executionCount < maxExecutions) {
      const stage = stageMap[currentStageId];
      if (!stage) break;

      executionCount++;

      try {
        console.log(`[PROXY] Executing stage: ${stage.name} (${stage.agent})`);

        // Log stage start
        this.logPipelineExecution(pipelineState.id, 'stage_started', {
          executionNumber: executionCount,
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          stageType: stage.type,
          description: stage.description,
          inputs: stage.inputs || []
        });

        // Update pipeline state
        pipelineState.currentStageIndex = executionCount - 1;
        pipelineState.currentStage = stage.name;
        await this.savePipelineState(pipelineState);

        // Send stage start notification
        ws.send(JSON.stringify({
          type: 'pipeline-status',
          pipelineId: pipelineState.id,
          content: {
            timestamp: new Date().toISOString(),
            stageId: stage.id,
            stageName: stage.name,
            agent: stage.agent.toUpperCase(),
            type: 'stage-start',
            message: `Starting ${stage.name}`,
            style: 'focused'
          }
        }));

        // Send commentary for stage start
        const inputSummary = (stage.inputs || []).length > 0 ? `Inputs: ${stage.inputs.join(', ')}` : 'No specific inputs';
        await this.sendCommentaryUpdate(ws, `Stage "${stage.name}" starting. Agent: ${stage.agent}. Task: ${stage.description}. ${inputSummary}`, workingDir, pipelineState.id);

        // Build input for this stage
        let stageInput = userContext;
        const stageInputs = stage.inputs || stage.config?.inputs || [];

        // Collect all input stage IDs, including loop-back detection
        const allInputStages = new Set(stageInputs);

        // AUTO-INCLUDE LOOP-BACK: If the previous stage routed back to this stage,
        // automatically include the previous stage's output even if not explicitly listed
        if (previousStageId && previousStageId !== stage.id && results[previousStageId]) {
          allInputStages.add(previousStageId);
          console.log(`[PROXY] Loop-back detected: Auto-including output from '${previousStageId}' as input to '${stage.id}'`);
        }

        if (allInputStages.size > 0) {
          stageInput += '\n\nInputs from previous stages:\n';
          allInputStages.forEach(inputStage => {
            if (results[inputStage] && inputStage !== stage.id) {
              stageInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
            }
          });
        }

        // CHECK FOR PENDING USER FEEDBACK (persists until acknowledged)
        try {
          const feedbackStatePath = path.join(__dirname, 'pipeline-states', `${pipelineState.id}.json`);
          if (fs.existsSync(feedbackStatePath)) {
            const latestState = JSON.parse(fs.readFileSync(feedbackStatePath, 'utf8'));
            const pendingFeedback = (latestState.userFeedback || []).filter(f => !f.consumed);

            if (pendingFeedback.length > 0) {
              stageInput += '\n\n=== USER FEEDBACK (REQUIRES ACKNOWLEDGMENT) ===\n';
              stageInput += 'The user has provided feedback that must be addressed.\n';
              stageInput += 'If you have ADDRESSED this feedback, include "FEEDBACK_ADDRESSED" in your response.\n';
              stageInput += 'If this feedback is not relevant to your task, include "FEEDBACK_PASS" to pass it to the next agent.\n\n';

              pendingFeedback.forEach((feedback, idx) => {
                const shownToList = feedback.shownTo || [];
                const showCount = shownToList.length;
                stageInput += `[Feedback ${idx + 1}] (shown to ${showCount} prior agents):\n`;
                stageInput += `${feedback.message}\n`;
                stageInput += `(Submitted at: ${feedback.timestamp})\n\n`;

                // Track that we showed this feedback to this stage
                if (!shownToList.includes(stage.id)) {
                  shownToList.push(stage.id);
                  feedback.shownTo = shownToList;
                }
              });

              console.log(`[PROXY] (Resume) Showing ${pendingFeedback.length} user feedback items to stage ${stage.id}`);

              // Save the updated shownTo tracking
              latestState.userFeedback = latestState.userFeedback.map(f => {
                const matching = pendingFeedback.find(pf => pf.timestamp === f.timestamp);
                return matching || f;
              });
              fs.writeFileSync(feedbackStatePath, JSON.stringify(latestState, null, 2));

              // Track that we need to check for acknowledgment after this stage
              pipelineState.pendingFeedbackCheck = pendingFeedback.map(f => f.id || f.timestamp);
            }
          }
        } catch (feedbackError) {
          console.error('[PROXY] Error loading user feedback in resume:', feedbackError.message);
        }

        // CHECK FOR SUB-PIPELINE EXECUTION
        if (stage.type === 'sub_pipeline' && stage.config && stage.config.pipeline) {
          console.log(`[PROXY] Sub-pipeline detected: ${stage.config.pipeline}`);

          const subPipelinePath = path.join(__dirname, '..', 'templates', `${stage.config.pipeline}.json`);
          if (!fs.existsSync(subPipelinePath)) {
            throw new Error(`Sub-pipeline template not found: ${stage.config.pipeline}`);
          }

          const subPipelineTemplate = JSON.parse(fs.readFileSync(subPipelinePath, 'utf8'));
          const subPipelineContext = stage.config.inheritContext ? userContext : (stage.prompt || userContext);
          const subPipelineResult = await this.executePipelineStages(subPipelineTemplate, subPipelineContext, workingDir, ws);

          results[stage.id] = JSON.stringify({
            subPipeline: subPipelineTemplate.name,
            result: subPipelineResult,
            status: 'completed'
          });

          pipelineState.results = results;
          completedStages.push(stage.id);
          pipelineState.completedStages = completedStages;
          await this.savePipelineState(pipelineState);

          const matchingConnection = connections.find(conn => conn.from === stage.id);

          this.logPipelineExecution(pipelineState.id, 'stage_routed', {
            fromStage: stage.id,
            toStage: matchingConnection?.to || null,
            decision: "SUB_PIPELINE_COMPLETED"
          });

          // Track previous stage for loop-back input injection
          previousStageId = stage.id;
          currentStageId = matchingConnection?.to || null;

          continue;
        }

        // Load agent config and build prompt
        const agentPath = path.join(__dirname, '..', 'agents', `${stage.agent}.json`);
        let agentPrompt = `You are ${stage.agent.toUpperCase()}. Complete your task.`;

        if (fs.existsSync(agentPath)) {
          const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
          if (agentConfig.system_prompt_template) {
            agentPrompt = agentConfig.system_prompt_template;
          } else {
            agentPrompt = agentConfig.systemPrompt || agentPrompt;
          }
        }

        // Add decision instructions
        let availableDecisions = stage.decisions || [];
        if (availableDecisions.length === 0) {
          const stageConnections = connections.filter(conn => conn.from === stage.id);
          availableDecisions = stageConnections.map(conn => ({
            choice: typeof conn.condition === 'object' ? conn.condition.value : conn.condition,
            description: conn.description || `Go to ${conn.to}`
          }));
        }

        if (availableDecisions.length > 0) {
          agentPrompt += `\n\n=== ROUTING DECISION REQUIRED ===\n`;
          agentPrompt += `After your response, you MUST choose exactly ONE decision from:\n`;
          availableDecisions.forEach(decision => {
            agentPrompt += `- ${decision.choice}: ${decision.description}\n`;
          });
          agentPrompt += `\n**CRITICAL**: Your VERY LAST LINE must be exactly:\n`;
          agentPrompt += `DECISION: [ONE_OF_THE_ABOVE_CHOICES]\n`;
          agentPrompt += `Example: DECISION: ${availableDecisions[0].choice}\n`;
          agentPrompt += `Do NOT add explanations after the decision keyword.\n`;
        }

        // Execute Claude
        const { output: result, usage } = await this.executeClaudeWithMCP(stage.agent, agentPrompt, stageInput, workingDir, pipelineState, ws);
        results[stage.id] = result;

        // Emit usage event for this stage
        this.broadcastUsageEvent({
          ...usage,
          actionType: 'pipeline_stage',
          stageName: stage.name,
          stageId: stage.id
        }, ws);

        // Log and save
        this.logPipelineExecution(pipelineState.id, 'stage_completed', {
          executionNumber: executionCount,
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          output: result,
          completedStagesCount: completedStages.length + 1,
          usage: usage  // Include usage data in execution log
        });

        pipelineState.results = results;
        completedStages.push(stage.id);
        pipelineState.completedStages = completedStages;
        await this.savePipelineState(pipelineState);

        // Send stage complete notification with full result
        ws.send(JSON.stringify({
          type: 'pipeline-status',
          pipelineId: pipelineState.id,
          content: {
            timestamp: new Date().toISOString(),
            stageId: stage.id,
            stageName: stage.name,
            agent: stage.agent.toUpperCase(),
            type: 'stage-complete',
            message: `${stage.name} completed`,
            result: result || '',  // Include full agent output
            style: 'triumphant'
          }
        }));

        // Determine next stage (build temporary pipeline object for routing)
        const tempPipeline = { stages, connections };
        const decision = this.extractDecision(result);

        // Check if agent acknowledged user feedback
        if (pipelineState.pendingFeedbackCheck && pipelineState.pendingFeedbackCheck.length > 0) {
          const feedbackAddressed = result?.includes('FEEDBACK_ADDRESSED');
          const feedbackPassed = result?.includes('FEEDBACK_PASS');

          if (feedbackAddressed) {
            // Mark feedback as consumed - agent addressed it
            try {
              const feedbackStatePath = path.join(__dirname, 'pipeline-states', `${pipelineState.id}.json`);
              if (fs.existsSync(feedbackStatePath)) {
                const latestState = JSON.parse(fs.readFileSync(feedbackStatePath, 'utf8'));
                latestState.userFeedback = (latestState.userFeedback || []).map(f => ({
                  ...f,
                  consumed: true,
                  consumedBy: stage.id,
                  consumedAt: new Date().toISOString(),
                  resolution: 'addressed'
                }));
                fs.writeFileSync(feedbackStatePath, JSON.stringify(latestState, null, 2));
                const currentPath = path.join(__dirname, 'pipeline-states', 'current.json');
                fs.writeFileSync(currentPath, JSON.stringify(latestState, null, 2));

                console.log(`[PROXY] (Resume) User feedback ADDRESSED by ${stage.id}`);
                this.logPipelineExecution(pipelineState.id, 'user_feedback_addressed', {
                  stageId: stage.id,
                  stageName: stage.name
                });
              }
            } catch (e) {
              console.error('[PROXY] Error marking feedback addressed in resume:', e.message);
            }
            pipelineState.pendingFeedbackCheck = [];
          } else if (feedbackPassed) {
            console.log(`[PROXY] (Resume) User feedback PASSED by ${stage.id} - will show to next agent`);
          } else {
            console.log(`[PROXY] (Resume) User feedback shown to ${stage.id} but not explicitly acknowledged - continuing to next agent`);
          }
        }

        // Send commentary update for stage completion
        const resultPreview = result?.substring(0, 500) || '';
        const contextInfo = `Stage "${stage.name}" (${stage.agent}) completed. Decision: ${decision || 'none'}. Output preview: ${resultPreview}`;
        await this.sendCommentaryUpdate(ws, contextInfo, workingDir, pipelineState.id);

        const nextStageId = this.determineNextStage(tempPipeline, stage.id, result);

        this.logPipelineExecution(pipelineState.id, 'stage_routed', {
          fromStage: stage.id,
          toStage: nextStageId,
          decision: decision,
          reasoning: decision ? `Decision "${decision}" matched connection condition` : 'No decision found, using default routing'
        });

        // Track previous stage for loop-back input injection
        previousStageId = stage.id;
        currentStageId = nextStageId;

      } catch (error) {
        console.error(`[PROXY] Stage ${stage.name} failed:`, error);

        this.logPipelineExecution(pipelineState.id, 'stage_error', {
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          error: error.message,
          stack: error.stack
        });

        pipelineState.status = 'error';
        pipelineState.error = error.message;
        await this.savePipelineState(pipelineState);

        throw error;
      }
    }

    // Pipeline completed
    console.log(`[PROXY] Pipeline ${pipelineState.name} completed with ${executionCount} total stage executions`);

    pipelineState.status = 'completed';
    pipelineState.endTime = new Date().toISOString();
    await this.savePipelineState(pipelineState);

    this.logPipelineExecution(pipelineState.id, 'pipeline_completed', {
      totalStagesRun: executionCount,
      completedStages: completedStages,
      duration: Date.now() - new Date(pipelineState.startTime).getTime(),
      finalResults: Object.keys(results)
    });

    ws.send(JSON.stringify({
      type: 'pipeline-completed',
      pipelineId: pipelineState.id,
      results: Object.keys(results)
    }));

    return results;
  }

  // Helper to get current WebSocket for a pipeline (handles reconnection)
  getPipelineWebSocket(pipelineId, fallbackWs) {
    const currentWs = this.pipelineClients.get(pipelineId);
    return (currentWs && currentWs.readyState === 1) ? currentWs : fallbackWs;
  }

  async executePipelineStages(pipeline, userContext, workingDir, ws, clientPipelineId = null) {
    console.log(`[PROXY] Executing ${pipeline.stages?.length || 0} stages for pipeline: ${pipeline.name}`);

    // Create pipeline state for persistence
    // Use client-provided pipelineId if available so completion signals match
    const pipelineState = {
      id: clientPipelineId || `pipeline_${Date.now()}`,
      name: pipeline.name,
      startTime: new Date().toISOString(),
      stages: pipeline.stages,
      connections: pipeline.flow?.connections || pipeline.connections || [],
      userContext,
      workingDir,
      currentStageIndex: 0,
      completedStages: [],
      status: 'running',
      results: {}
    };

    // Save initial pipeline state
    await this.savePipelineState(pipelineState);

    // Store the initial WebSocket connection
    this.pipelineClients.set(pipelineState.id, ws);

    // Initialize infographic generator for real-time HTML reporting
    const infographic = new InfographicGenerator(pipelineState.id, pipeline.name);
    this.pipelineInfographics.set(pipelineState.id, infographic);
    console.log(`[PROXY] Infographic initialized: ${infographic.getInfographicPath()}`);

    // Generate index page for all runs of this pipeline
    const indexPath = InfographicGenerator.generatePipelineIndex(pipelineState.id);
    if (indexPath) {
      console.log(`[PROXY] Pipeline index updated: ${indexPath}`);
    }

    // Send infographic URL to client
    ws.send(JSON.stringify({
      type: 'infographic-ready',
      pipelineId: pipelineState.id,
      infographicPath: infographic.getInfographicPath(),
      infographicUrl: `file://${infographic.getInfographicPath()}`
    }));

    // Send pipeline started notification for game dev studio
    ws.send(JSON.stringify({
      type: 'pipeline-started',
      pipelineId: pipelineState.id,
      pipelineName: pipeline.name,
      totalStages: pipeline.stages?.length || 0,
      stages: pipeline.stages.map(s => ({
        id: s.id,
        name: s.name,
        agent: s.agent,
        description: s.description
      }))
    }));

    // Send initial commentary
    await this.sendCommentaryUpdate(ws, `A new pipeline execution is starting: "${pipeline.name}" with ${pipeline.stages?.length || 0} stages. The system is about to begin processing.`, workingDir, pipelineState.id);

    // Copy MCP config to working directory
    const sourceMcpConfig = '/mnt/c/github/spaceship-simulator/.mcp.json';
    const targetMcpConfig = path.join(workingDir, '.mcp.json');
    
    if (fs.existsSync(sourceMcpConfig)) {
      const mcpContent = fs.readFileSync(sourceMcpConfig, 'utf8');
      const mcpConfig = JSON.parse(mcpContent);
      
      // Update relative paths for working directory
      if (mcpConfig.mcpServers && mcpConfig.mcpServers['progress-reporter']) {
        const serverPath = path.relative(workingDir, '/mnt/c/github/claudeplus/mcp-servers/progress-reporter/server.js');
        mcpConfig.mcpServers['progress-reporter'].args = [serverPath];
      }
      
      fs.writeFileSync(targetMcpConfig, JSON.stringify(mcpConfig, null, 2));
      console.log(`[PROXY] MCP config copied to ${targetMcpConfig}`);
    }

    const results = {};

    // Log pipeline initialization
    this.logPipelineExecution(pipelineState.id, 'pipeline_initialized', {
      pipelineName: pipeline.name,
      userContext: userContext,
      workingDir: workingDir,
      totalStages: pipeline.stages.length,
      stageNames: pipeline.stages.map(s => s.name),
      connections: pipeline.flow?.connections || pipeline.connections || []
    });

    // Execute stages with conditional flow
    const stageMap = {};
    pipeline.stages.forEach(stage => stageMap[stage.id] = stage);

    let currentStageId = pipeline.stages[0]?.id; // Start with first stage
    let previousStageId = null; // Track the previous stage for loop-back detection
    let executionCount = 0;
    const maxExecutions = 100; // Prevent infinite loops (allow sufficient iterations for complex debugging)

    while (currentStageId && executionCount < maxExecutions) {
      const stage = stageMap[currentStageId];
      if (!stage) break;

      executionCount++;
      try {
        console.log(`[PROXY] Executing stage: ${stage.name} (${stage.agent})`);

        // Log stage start
        this.logPipelineExecution(pipelineState.id, 'stage_started', {
          executionNumber: executionCount,
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          stageType: stage.type,
          description: stage.description,
          inputs: stage.inputs || []
        });

        // Update pipeline state
        pipelineState.currentStageIndex = executionCount - 1;
        pipelineState.currentStage = stage.name;
        await this.savePipelineState(pipelineState);
        
        // Send stage start notification (use current WebSocket in case of reconnection)
        const currentWs = this.getPipelineWebSocket(pipelineState.id, ws);
        currentWs.send(JSON.stringify({
          type: 'pipeline-status',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            type: 'stage-start',
            message: `Starting ${stage.name}`,
            style: 'focused'
          }
        }));

        // Send stage update for visualization
        currentWs.send(JSON.stringify({
          type: 'pipeline-stage-update',
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          status: 'in-progress'
        }));

        // Build input for this stage
        let stageInput = userContext;
        const stageInputs = stage.inputs || stage.config?.inputs || [];

        // Collect all input stage IDs, including loop-back detection
        const allInputStages = new Set(stageInputs);

        // AUTO-INCLUDE LOOP-BACK: If the previous stage routed back to this stage,
        // automatically include the previous stage's output even if not explicitly listed
        if (previousStageId && previousStageId !== stage.id && results[previousStageId]) {
          allInputStages.add(previousStageId);
          console.log(`[PROXY] Loop-back detected: Auto-including output from '${previousStageId}' as input to '${stage.id}'`);
        }

        if (allInputStages.size > 0) {
          stageInput += '\n\nInputs from previous stages:\n';
          allInputStages.forEach(inputStage => {
            // Prevent stages from accessing their own previous results to avoid confusion
            if (results[inputStage] && inputStage !== stage.id) {
              stageInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
            }
          });
        }

        // INJECT USER FEEDBACK: Check for any pending user feedback and include it
        // Reload pipeline state to get latest feedback (may have been updated while running)
        try {
          const feedbackStatePath = path.join(__dirname, 'pipeline-states', `${pipelineState.id}.json`);
          if (fs.existsSync(feedbackStatePath)) {
            const latestState = JSON.parse(fs.readFileSync(feedbackStatePath, 'utf8'));
            const pendingFeedback = (latestState.userFeedback || []).filter(f => !f.consumed);

            if (pendingFeedback.length > 0) {
              stageInput += '\n\n=== USER FEEDBACK (IMPORTANT - Address these concerns) ===\n';
              stageInput += 'The user has provided the following feedback during pipeline execution.\n';
              stageInput += 'You MUST incorporate this feedback into your work.\n';
              stageInput += 'If you have ADDRESSED this feedback, include "FEEDBACK_ADDRESSED" in your response.\n';
              stageInput += 'If this feedback is NOT relevant to your role, include "FEEDBACK_PASS" to pass it to the next agent.\n\n';

              pendingFeedback.forEach((feedback, idx) => {
                stageInput += `[Feedback ${idx + 1} - ${new Date(feedback.timestamp).toLocaleTimeString()}]\n`;
                stageInput += `${feedback.message}\n\n`;
              });

              stageInput += '=== END USER FEEDBACK ===\n';

              // Track that this stage received feedback (but don't mark consumed yet)
              latestState.userFeedback = latestState.userFeedback.map(f => {
                if (!f.consumed) {
                  return {
                    ...f,
                    shownTo: [...(f.shownTo || []), stage.id],
                    lastShownAt: new Date().toISOString()
                  };
                }
                return f;
              });

              // Save updated state
              fs.writeFileSync(feedbackStatePath, JSON.stringify(latestState, null, 2));
              const currentPath = path.join(__dirname, 'pipeline-states', 'current.json');
              fs.writeFileSync(currentPath, JSON.stringify(latestState, null, 2));

              console.log(`[PROXY] Showing ${pendingFeedback.length} user feedback items to stage ${stage.id} (persists until acknowledged)`);

              // Log feedback shown (not consumed)
              this.logPipelineExecution(pipelineState.id, 'user_feedback_shown', {
                stageId: stage.id,
                stageName: stage.name,
                feedbackCount: pendingFeedback.length,
                feedbackMessages: pendingFeedback.map(f => f.message)
              });

              // Store pending feedback IDs to check for acknowledgment after stage completes
              pipelineState.pendingFeedbackCheck = pendingFeedback.map(f => f.id || f.timestamp);
            }
          }
        } catch (feedbackErr) {
          console.error('[PROXY] Error loading user feedback:', feedbackErr.message);
        }

        // Send commentator update for stage start with inputs context
        const inputSummary = stageInput ? `Input preview: ${stageInput.substring(0, 400)}...` : 'No input context';
        await this.sendCommentaryUpdate(ws, `Stage "${stage.name}" starting. Agent: ${stage.agent}. Task: ${stage.description}. ${inputSummary}`, workingDir, pipelineState.id);
        
        // CHECK FOR SUB-PIPELINE EXECUTION
        if (stage.type === 'sub_pipeline' && stage.config && stage.config.pipeline) {
          console.log(`[PROXY] Sub-pipeline detected: ${stage.config.pipeline}`);

          // Load the sub-pipeline template
          const subPipelinePath = path.join(__dirname, '..', 'templates', `${stage.config.pipeline}.json`);
          if (!fs.existsSync(subPipelinePath)) {
            throw new Error(`Sub-pipeline template not found: ${stage.config.pipeline}`);
          }

          const subPipelineTemplate = JSON.parse(fs.readFileSync(subPipelinePath, 'utf8'));
          console.log(`[PROXY] Loaded sub-pipeline: ${subPipelineTemplate.name} with ${subPipelineTemplate.stages.length} stages`);

          // Send notification that we're entering sub-pipeline (use current WebSocket)
          const subPipelineStartWs = this.getPipelineWebSocket(pipelineState.id, ws);
          subPipelineStartWs.send(JSON.stringify({
            type: 'pipeline-status',
            content: {
              timestamp: new Date().toISOString(),
              agent: 'SUB_PIPELINE',
              type: 'sub-pipeline-start',
              message: `Entering sub-pipeline: ${subPipelineTemplate.name}`,
              subPipeline: subPipelineTemplate.name,
              style: 'focused'
            }
          }));

          await this.sendCommentaryUpdate(ws, `🔀 Entering sub-pipeline: "${subPipelineTemplate.name}". This pipeline has ${subPipelineTemplate.stages.length} stages and will execute nested within the current pipeline.`, workingDir, pipelineState.id);

          // Execute the sub-pipeline with context determined by inheritContext flag
          // If inheritContext is true, use the full user context
          // If inheritContext is false, use ONLY the stage's prompt field (targeted, specific prompt)
          const subPipelineContext = stage.config.inheritContext ? userContext : (stage.prompt || userContext);
          const subPipelineResult = await this.executePipelineStages(subPipelineTemplate, subPipelineContext, workingDir, ws);

          // Store sub-pipeline result
          results[stage.id] = JSON.stringify({
            subPipeline: subPipelineTemplate.name,
            subPipelineId: subPipelineTemplate.id,
            result: subPipelineResult,
            status: 'completed'
          });

          // Send notification that sub-pipeline completed (use current WebSocket)
          const subPipelineCompleteWs = this.getPipelineWebSocket(pipelineState.id, ws);
          subPipelineCompleteWs.send(JSON.stringify({
            type: 'pipeline-status',
            content: {
              timestamp: new Date().toISOString(),
              agent: 'SUB_PIPELINE',
              type: 'sub-pipeline-complete',
              message: `Sub-pipeline completed: ${subPipelineTemplate.name}`,
              subPipeline: subPipelineTemplate.name,
              style: 'success'
            }
          }));

          await this.sendCommentaryUpdate(ws, `✅ Sub-pipeline "${subPipelineTemplate.name}" completed successfully. Returning to meta-pipeline.`, workingDir, pipelineState.id);

          // Log sub-pipeline execution
          this.logPipelineExecution(pipelineState.id, 'sub_pipeline_completed', {
            executionNumber: executionCount,
            stageId: stage.id,
            stageName: stage.name,
            subPipelineId: subPipelineTemplate.id,
            subPipelineName: subPipelineTemplate.name,
            subPipelineStages: subPipelineTemplate.stages.length
          });

          // Mark stage completed
          pipelineState.completedStages.push(stage.id);
          await this.savePipelineState(pipelineState);

          // Continue to next stage - for sub-pipelines, use PARENT pipeline's connections (from pipelineState)
          // NOT the sub-pipeline's connections (from pipeline parameter)
          const parentConnections = pipelineState.connections || [];
          const matchingConnection = parentConnections.find(conn =>
            conn.from === stage.id
          );

          // Track previous stage for loop-back input injection
          previousStageId = stage.id;
          currentStageId = matchingConnection?.to || null;
          console.log(`[PROXY] Sub-pipeline complete. Next stage: ${currentStageId || 'END'}`);
          console.log(`[PROXY] [DEBUG] Found ${parentConnections.length} parent connections, matching connection for ${stage.id}:`, matchingConnection);

          // Log routing decision for sub-pipeline completion
          this.logPipelineExecution(pipelineState.id, 'stage_routed', {
            fromStage: stage.id,
            toStage: currentStageId,
            decision: "SUB_PIPELINE_COMPLETED",
            reasoning: "Sub-pipeline completed successfully, automatically routing to next stage in parent pipeline"
          });

          continue; // Skip to next iteration
        }

        // Load agent config
        const agentPath = path.join(__dirname, '..', 'agents', `${stage.agent}.json`);
        let agentPrompt = `You are ${stage.agent.toUpperCase()}. Complete your task.`;

        if (fs.existsSync(agentPath)) {
          const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
          
          // Handle system_prompt_template with placeholder injection
          if (agentConfig.system_prompt_template) {
            agentPrompt = agentConfig.system_prompt_template;
            
            // Inject placeholders from previous stage results
            if (stage.inputs && stage.inputs.length > 0) {
              stage.inputs.forEach(inputStage => {
                if (results[inputStage]) {
                  // Replace {approved_plan}, {plan}, {previous_output}, etc.
                  agentPrompt = agentPrompt.replace(/\{approved_plan\}/g, results[inputStage]);
                  agentPrompt = agentPrompt.replace(/\{plan\}/g, results[inputStage]);
                  agentPrompt = agentPrompt.replace(/\{previous_output\}/g, results[inputStage]);
                }
              });
            }
          } else {
            agentPrompt = agentConfig.systemPrompt || agentPrompt;
          }
        }
        
        // Add decision instructions - either from stage definition or extract from pipeline connections
        let availableDecisions = [];
        
        if (stage.decisions && stage.decisions.length > 0) {
          // Use explicitly defined stage decisions
          availableDecisions = stage.decisions;
        } else {
          // Extract decisions from pipeline connections
          const connections = pipeline.flow?.connections || pipeline.connections || [];
          const stageConnections = connections.filter(conn => conn.from === stage.id);
          
          availableDecisions = stageConnections.map(conn => ({
            choice: typeof conn.condition === 'object' ? conn.condition.value : conn.condition,
            description: conn.description || `Go to ${conn.to}`
          }));
        }
        
        if (availableDecisions.length > 0) {
          agentPrompt += `\n\n=== ROUTING DECISION REQUIRED ===\n`;
          agentPrompt += `After your response, you MUST choose exactly ONE decision from:\n`;
          availableDecisions.forEach(decision => {
            agentPrompt += `- ${decision.choice}: ${decision.description}\n`;
          });
          agentPrompt += `\n**CRITICAL**: Your VERY LAST LINE must be exactly:\n`;
          agentPrompt += `DECISION: [ONE_OF_THE_ABOVE_CHOICES]\n`;
          agentPrompt += `Example: DECISION: ${availableDecisions[0].choice}\n`;
          agentPrompt += `Do NOT add explanations after the decision keyword.\n`;
        }

        // DEBUG: Log what prompt is being sent
        console.log(`[PROXY] [DEBUG] Agent ${stage.agent} final prompt (${agentPrompt.length} chars): ${agentPrompt.substring(0, 300)}...`);

        // Get the WebSocket for this pipeline
        const pipelineWs = this.getPipelineWebSocket(pipelineState.id, ws);

        // Execute Claude with MCP, passing pipeline state to save PID
        const { output: result, usage } = await this.executeClaudeWithMCP(stage.agent, agentPrompt, stageInput, workingDir, pipelineState, pipelineWs);
        results[stage.id] = result;

        // Emit usage event for this stage
        const usageWs = pipelineWs;
        this.broadcastUsageEvent({
          ...usage,
          actionType: 'pipeline_stage',
          stageName: stage.name,
          stageId: stage.id
        }, usageWs);

        // Log stage completion with full output and prompt
        this.logPipelineExecution(pipelineState.id, 'stage_completed', {
          executionNumber: executionCount,
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          prompt: agentPrompt,  // Full prompt sent to agent
          promptLength: agentPrompt.length,
          outputLength: result?.length || 0,
          output: result,  // Full output stored for analysis
          completedStagesCount: pipelineState.completedStages.length + 1,
          totalExecutions: executionCount,
          usage: usage  // Include usage data in execution log
        });

        // Send agent output to UI (use current WebSocket)
        const agentOutputWs = this.getPipelineWebSocket(pipelineState.id, ws);
        agentOutputWs.send(JSON.stringify({
          type: 'agent-output',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            stageName: stage.name,
            output: result,
            outputLength: result?.length || 0
          }
        }));

        // Update pipeline state with results
        pipelineState.results[stage.id] = result;
        pipelineState.completedStages.push(stage.id);
        await this.savePipelineState(pipelineState);

        // Send stage complete notification with full result (use current WebSocket)
        const stageCompleteWs = this.getPipelineWebSocket(pipelineState.id, ws);
        stageCompleteWs.send(JSON.stringify({
          type: 'pipeline-status',
          pipelineId: pipelineState.id,
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            stageName: stage.name,
            type: 'stage-complete',
            message: `${stage.name} completed`,
            result: result || '',  // Include full agent output
            style: 'triumphant'
          }
        }));

        // Send stage completion update for visualization (use current WebSocket)
        stageCompleteWs.send(JSON.stringify({
          type: 'pipeline-stage-update',
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          status: 'completed',
          output: result ? result.substring(0, 300) + (result.length > 300 ? '...' : '') : null
        }));

        // Send pipeline update for game dev studio (use current WebSocket)
        stageCompleteWs.send(JSON.stringify({
          type: 'pipeline-update',
          message: `Completed: ${stage.name}`,
          progress: {
            current: pipelineState.completedStages.length,
            total: pipeline.stages.length,
            currentStage: stage.name
          }
        }));

        // Determine next stage based on conditional flow
        console.log(`[PROXY] [FLOW] Stage ${stage.id} completed. Determining next stage...`);
        console.log(`[PROXY] [FLOW] Stage result length: ${result?.length || 0} characters`);
        console.log(`[PROXY] [FLOW] Stage result preview: ${result?.substring(0, 200)}...`);

        const decision = this.extractDecision(result);

        // Check if agent acknowledged user feedback
        if (pipelineState.pendingFeedbackCheck && pipelineState.pendingFeedbackCheck.length > 0) {
          const feedbackAddressed = result?.includes('FEEDBACK_ADDRESSED');
          const feedbackPassed = result?.includes('FEEDBACK_PASS');

          if (feedbackAddressed) {
            // Mark feedback as consumed - agent addressed it
            try {
              const feedbackStatePath = path.join(__dirname, 'pipeline-states', `${pipelineState.id}.json`);
              if (fs.existsSync(feedbackStatePath)) {
                const latestState = JSON.parse(fs.readFileSync(feedbackStatePath, 'utf8'));
                latestState.userFeedback = (latestState.userFeedback || []).map(f => ({
                  ...f,
                  consumed: true,
                  consumedBy: stage.id,
                  consumedAt: new Date().toISOString(),
                  resolution: 'addressed'
                }));
                fs.writeFileSync(feedbackStatePath, JSON.stringify(latestState, null, 2));
                const currentPath = path.join(__dirname, 'pipeline-states', 'current.json');
                fs.writeFileSync(currentPath, JSON.stringify(latestState, null, 2));

                console.log(`[PROXY] User feedback ADDRESSED by ${stage.id}`);
                this.logPipelineExecution(pipelineState.id, 'user_feedback_addressed', {
                  stageId: stage.id,
                  stageName: stage.name
                });
              }
            } catch (e) {
              console.error('[PROXY] Error marking feedback addressed:', e.message);
            }
            pipelineState.pendingFeedbackCheck = [];
          } else if (feedbackPassed) {
            console.log(`[PROXY] User feedback PASSED by ${stage.id} - will show to next agent`);
          } else {
            console.log(`[PROXY] User feedback shown to ${stage.id} but not explicitly acknowledged - continuing to next agent`);
          }
        }

        // Send commentator update for stage completion with actual content
        const resultPreview = result?.substring(0, 500) || '';
        const contextInfo = `Stage "${stage.name}" (${stage.agent}) completed. Decision: ${decision || 'none'}. Output preview: ${resultPreview}`;
        await this.sendCommentaryUpdate(ws, contextInfo, workingDir, pipelineState.id);
        const nextStageId = this.determineNextStage(pipeline, stage.id, result);
        console.log(`[PROXY] [FLOW] Next stage determined: ${nextStageId}`);

        // Log routing decision
        this.logPipelineExecution(pipelineState.id, 'stage_routed', {
          fromStage: stage.id,
          toStage: nextStageId,
          decision: decision,
          reasoning: decision ? `Decision "${decision}" matched connection condition` : 'No decision found, using default routing'
        });

        // Track previous stage for loop-back input injection
        previousStageId = stage.id;
        currentStageId = nextStageId;
        
      } catch (error) {
        console.error(`[PROXY] Stage ${stage.name} failed:`, error);

        // Log stage error
        this.logPipelineExecution(pipelineState.id, 'stage_error', {
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          error: error.message,
          stack: error.stack
        });

        const stageErrorWs = this.getPipelineWebSocket(pipelineState.id, ws);
        stageErrorWs.send(JSON.stringify({
          type: 'pipeline-status',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            type: 'stage-error',
            message: `${stage.name} failed: ${error.message}`,
            style: 'critical'
          }
        }));

        // Send stage error update for visualization (use current WebSocket)
        stageErrorWs.send(JSON.stringify({
          type: 'pipeline-stage-update',
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          status: 'error',
          error: error.message
        }));

        throw error;
      }
    }

    // Mark pipeline as complete
    pipelineState.status = 'completed';
    pipelineState.endTime = new Date().toISOString();
    await this.savePipelineState(pipelineState);

    // Send pipeline completed notification for game dev studio (use current WebSocket)
    const pipelineCompletedWs = this.getPipelineWebSocket(pipelineState.id, ws);
    pipelineCompletedWs.send(JSON.stringify({
      type: 'pipeline-completed',
      pipelineId: pipelineState.id,
      pipelineName: pipeline.name,
      totalStages: pipelineState.completedStages.length,
      duration: new Date(pipelineState.endTime) - new Date(pipelineState.startTime)
    }));

    // Log pipeline completion
    this.logPipelineExecution(pipelineState.id, 'pipeline_completed', {
      totalStagesRun: pipelineState.completedStages.length,
      completedStages: pipelineState.completedStages,
      duration: new Date(pipelineState.endTime) - new Date(pipelineState.startTime),
      finalResults: Object.keys(results)
    });

    // Generate AI-powered story report using InfographicNarrator
    try {
      console.log('[PROXY] Generating AI story report for pipeline execution...');

      const infographic = this.pipelineInfographics.get(pipelineState.id);
      if (infographic) {
        const runDirectory = infographic.getRunDirectory();
        const narrator = new InfographicNarrator(runDirectory);

        // Prepare pipeline data for narrator
        const pipelineData = {
          name: pipeline.name,
          id: pipelineState.id,
          duration: new Date(pipelineState.endTime) - new Date(pipelineState.startTime),
          totalStages: pipelineState.stages.length,
          completedStages: pipelineState.completedStages.length,
          errorCount: pipelineState.stages.filter(s => s.status === 'error').length,
          workingDir: workingDir,
          status: 'completed',
          stages: pipelineState.stages || []
        };

        // TEMPORARILY DISABLED - story generation uses API key
        // TODO: Re-enable when subscription-based CLI is confirmed working
        if (false) { narrator.generateStoryReport(pipelineData).then(result => {
          if (result.success) {
            console.log('[PROXY] Story report generated:', result.storyPath);

            // Notify client that story is ready (use current WebSocket)
            const storyReadyWs = this.getPipelineWebSocket(pipelineState.id, ws);
            storyReadyWs.send(JSON.stringify({
              type: 'story-report-ready',
              pipelineId: pipelineState.id,
              storyPath: result.storyPath,
              narrativePath: result.narrativePath,
              message: '✨ Magical story report generated!'
            }));
          } else {
            console.error('[PROXY] Story report generation failed:', result.error);
          }
        }).catch(err => {
          console.error('[PROXY] Story report generation error:', err);
        }); }
      }
    } catch (narratorError) {
      console.error('[PROXY] Failed to generate story report:', narratorError);
      // Don't fail the pipeline if narrator fails - just log it
    }

    // Auto-commit changes if working on a git repository
    // NOTE: Test collection is now handled by the test_librarian agent in the pipeline
    try {
      const commitHash = await this.autoCommitPipelineChanges(pipelineState, workingDir);
      if (commitHash) {
        console.log(`[PROXY] Pipeline changes committed: ${commitHash}`);

        // Notify client about the commit
        ws.send(JSON.stringify({
          type: 'pipeline-commit',
          pipelineId: pipelineState.id,
          commitHash,
          message: `Pipeline changes automatically committed: ${commitHash}`
        }));
      }
    } catch (commitError) {
      console.error('[PROXY] Failed to auto-commit pipeline changes:', commitError);
      // Don't fail the pipeline if commit fails - just log it
    }

    return Object.values(results).join('\n\n---\n\n');
  }

  determineNextStage(pipeline, currentStageId, stageResult) {
    console.log(`[PROXY] [FLOW] determineNextStage called for stage: ${currentStageId}`);
    console.log(`[PROXY] [FLOW] Pipeline object keys: ${Object.keys(pipeline)}`);
    console.log(`[PROXY] [FLOW] Pipeline.flow exists: ${!!pipeline.flow}`);
    if (pipeline.flow) {
      console.log(`[PROXY] [FLOW] Pipeline.flow keys: ${Object.keys(pipeline.flow)}`);
      console.log(`[PROXY] [FLOW] Pipeline.flow.connections exists: ${!!pipeline.flow.connections}`);
    }
    
    // Find connections from current stage (check both locations for compatibility)
    const connections = pipeline.flow?.connections || pipeline.connections || [];
    console.log(`[PROXY] [FLOW] Total connections in pipeline: ${connections.length}`);
    console.log(`[PROXY] [FLOW] Using connections from: ${pipeline.flow?.connections ? 'pipeline.flow.connections' : pipeline.connections ? 'pipeline.connections' : 'none'}`);
    
    const fromConnections = connections.filter(conn => conn.from === currentStageId);
    console.log(`[PROXY] [FLOW] Connections from ${currentStageId}: ${fromConnections.length}`);
    fromConnections.forEach((conn, i) => {
      console.log(`[PROXY] [FLOW] Connection ${i}: ${conn.from} -> ${conn.to}, condition: ${JSON.stringify(conn.condition)}`);
    });
    
    if (fromConnections.length === 0) {
      console.log(`[PROXY] [FLOW] No connections from ${currentStageId}, pipeline ends`);
      return null;
    }
    
    // Check stage result for decision keywords
    const resultLower = stageResult.toLowerCase();
    console.log(`[PROXY] [FLOW] Stage result (first 100 chars): ${stageResult.substring(0, 100)}`);
    console.log(`[PROXY] [FLOW] Stage result (last 100 chars): ${stageResult.substring(Math.max(0, stageResult.length - 100))}`);
    
    console.log(`[PROXY] [FLOW] Evaluating ${fromConnections.length} connections...`);

    // Extract decision from agent output (if present)
    const decision = this.extractDecision(stageResult);
    console.log(`[PROXY] [FLOW] Extracted decision: "${decision}"`);

    // Try to match against connection conditions
    for (let i = 0; i < fromConnections.length; i++) {
      const connection = fromConnections[i];
      const condition = typeof connection.condition === 'object'
        ? connection.condition.value
        : connection.condition;

      console.log(`[PROXY] [FLOW] Evaluating connection ${i}: ${connection.from} -> ${connection.to}`);
      console.log(`[PROXY] [FLOW] Condition: "${condition}"`);

      // FIRST: Handle decision-based conditions (explicit DECISION: lines take priority)
      if (decision && condition && decision.toUpperCase() === condition.toUpperCase()) {
        console.log(`[PROXY] [FLOW] ✅ Decision matches condition -> ${connection.to}`);
        return connection.to;
      }
    }

    // SECOND: If no explicit decision matched, check for auto-complete conditions
    for (let i = 0; i < fromConnections.length; i++) {
      const connection = fromConnections[i];
      const condition = typeof connection.condition === 'object'
        ? connection.condition.value
        : connection.condition;

      // Handle auto-complete conditions (stage completion, no decision needed)
      // Only use this if there was NO explicit decision
      if (!decision && condition && condition.toLowerCase().endsWith('_complete')) {
        console.log(`[PROXY] [FLOW] ✅ Auto-complete condition matched (no decision) -> ${connection.to}`);
        return connection.to;
      }
    }

    // Default to first connection if no match
    console.log(`[PROXY] [FLOW] No condition matched, using first connection: ${fromConnections[0].to}`);
    return fromConnections[0].to;
  }

  extractDecision(stageResult) {
    console.log(`[PROXY] [FLOW] extractDecision called`);
    
    // Look for "DECISION: VALUE" format at the end of the output
    const lines = stageResult.split('\n');
    console.log(`[PROXY] [FLOW] Total lines in result: ${lines.length}`);
    
    const searchLines = Math.min(10, lines.length);
    console.log(`[PROXY] [FLOW] Searching last ${searchLines} lines for DECISION:`);
    
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
      const line = lines[i].trim();
      console.log(`[PROXY] [FLOW] Line ${i}: "${line}"`);
      
      // Handle both plain and markdown-formatted decisions
      // Extract only the decision keyword (stops at first non-word character like space, parenthesis, etc.)
      const match = line.match(/^\*{0,2}\s*DECISION:\s*(\w+)/i);
      if (match) {
        const decision = match[1].trim().toUpperCase();
        console.log(`[PROXY] [FLOW] ✅ Found decision: "${decision}"`);
        return decision;
      }
    }
    
    console.log(`[PROXY] [FLOW] ❌ No DECISION: found in last ${searchLines} lines`);
    return null;
  }

  async executeClaudeWithMCP(agentName, prompt, input, workingDir, pipelineState = null, originatingWs = null) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const fullPrompt = `${prompt}\n\nUser Input: ${input}`;
      const inputCharCount = fullPrompt.length;

      // Use stream-json for real-time feedback (requires --print --verbose --include-partial-messages)
      // IMPORTANT: Exclude ANTHROPIC_API_KEY so Claude CLI uses subscription login, not API key
      const { ANTHROPIC_API_KEY: _apiKey, ...cleanEnv } = process.env;
      const claude = spawn('claude', [
        '--permission-mode', 'bypassPermissions',
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '-'  // Read from stdin
      ], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...cleanEnv,
          PWD: workingDir,
          AGENT_NAME: agentName.toUpperCase()
        }
      });

      // Save PID to pipeline state if provided
      if (pipelineState && claude.pid) {
        pipelineState.pid = claude.pid;
        this.savePipelineState(pipelineState).catch(err => {
          console.error('[PROXY] Failed to save PID to pipeline state:', err);
        });
        console.log(`[PROXY] Saved PID ${claude.pid} for pipeline ${pipelineState.id}`);
      }

      let lineBuffer = '';
      let errorOutput = '';
      let streamingText = '';
      let workLog = [];
      let usageData = {
        agentName,
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputCharCount,
        outputCharCount: 0,
        durationMs: 0,
        estimatedCostUsd: 0,
        timestamp: new Date().toISOString(),
        pipelineId: pipelineState?.id || null,
        stageId: pipelineState?.currentStage || null,
        modelBreakdown: {}
      };
      let currentToolBlock = null;
      let lastBroadcast = 0;
      let pendingToolCompletion = null; // Track tool that's waiting for result confirmation

      // Helper to complete a pending tool
      const completePendingTool = () => {
        if (pendingToolCompletion) {
          broadcastStreamEvent('tool_result', {
            tool: pendingToolCompletion.name,
            result: 'completed' // Tool results aren't streamed, so we just mark complete
          });
          console.log(`[PROXY] [${agentName}] ✓ Tool completed: ${pendingToolCompletion.name}`);
          pendingToolCompletion = null;
        }
      };

      // Send real-time event to the originating client only (not broadcast to all)
      const broadcastStreamEvent = (eventType, data) => {
        if (!originatingWs || originatingWs.readyState !== 1) return;

        const message = JSON.stringify({
          type: 'agent-stream',
          content: {
            timestamp: new Date().toISOString(),
            agent: agentName.toUpperCase(),
            pipelineId: pipelineState?.id || null,
            eventType,
            ...data
          }
        });
        try { originatingWs.send(message); } catch (e) {}
      };

      claude.stdout.on('data', (data) => {
        lineBuffer += data.toString();

        // Process complete lines
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            let event = JSON.parse(line);

            // Unwrap stream_event wrapper if present
            if (event.type === 'stream_event' && event.event) {
              event = event.event;
            }

            // DEBUG: Log all event types to understand what Claude Code CLI emits
            if (event.type && !['content_block_delta'].includes(event.type)) {
              console.log(`[PROXY] [MCP-EVENT] ${agentName}: event.type=${event.type}${event.message?.role ? ` message.role=${event.message.role}` : ''}`);
            }

            // Handle different event types
            if (event.type === 'content_block_start') {
              const block = event.content_block;
              if (block?.type === 'tool_use') {
                // A new tool starting means any previous tool has completed
                completePendingTool();

                currentToolBlock = { name: block.name, id: block.id, input: '' };
                workLog.push({
                  type: 'tool_start',
                  tool: block.name,
                  timestamp: new Date().toISOString()
                });
                broadcastStreamEvent('tool_start', { tool: block.name });
                console.log(`[PROXY] [${agentName}] 🔧 Tool: ${block.name}`);
              } else if (block?.type === 'text') {
                // Text content starting means any previous tool has completed
                completePendingTool();
              }
            }

            else if (event.type === 'content_block_delta') {
              const delta = event.delta;

              // Text streaming (thinking/reasoning commentary)
              if (delta?.type === 'text_delta' && delta.text) {
                // First text delta after a tool means the tool completed
                completePendingTool();

                streamingText += delta.text;

                // Throttle broadcasts to avoid flooding (every 300ms for more real-time feel)
                const now = Date.now();
                if (now - lastBroadcast > 300) {
                  // Send more context - last 500 chars for better visibility
                  broadcastStreamEvent('text_delta', {
                    text: delta.text,
                    accumulated: streamingText.slice(-500),
                    totalLength: streamingText.length
                  });
                  lastBroadcast = now;
                }
              }

              // Thinking block content (if Claude exposes this)
              else if (delta?.type === 'thinking_delta' && delta.thinking) {
                broadcastStreamEvent('thinking', {
                  text: delta.thinking,
                  type: 'reasoning'
                });
              }

              // Tool input being constructed
              else if (delta?.type === 'input_json_delta' && currentToolBlock) {
                currentToolBlock.input += delta.partial_json || '';
              }
            }

            // Handle thinking blocks if they appear as content blocks
            else if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
              broadcastStreamEvent('thinking_start', { type: 'reasoning' });
              console.log(`[PROXY] [${agentName}] 💭 Thinking...`);
            }

            else if (event.type === 'content_block_stop') {
              if (currentToolBlock) {
                // Try to parse the accumulated input
                let parsedInput = currentToolBlock.input;
                try {
                  parsedInput = JSON.parse(currentToolBlock.input);
                } catch (e) {}

                workLog.push({
                  type: 'tool_call',
                  tool: currentToolBlock.name,
                  input: parsedInput,
                  timestamp: new Date().toISOString()
                });

                // Special handling for TodoWrite - broadcast the full todo list
                if (currentToolBlock.name === 'TodoWrite' && parsedInput?.todos) {
                  broadcastStreamEvent('todo_update', {
                    tool: 'TodoWrite',
                    todos: parsedInput.todos
                  });
                  console.log(`[PROXY] [${agentName}] 📋 Todo update: ${parsedInput.todos.length} items`);
                }
                // Special handling for planning tools
                else if (currentToolBlock.name === 'EnterPlanMode') {
                  broadcastStreamEvent('plan_start', { tool: 'EnterPlanMode' });
                  console.log(`[PROXY] [${agentName}] 📝 Entering plan mode`);
                }
                else if (currentToolBlock.name === 'ExitPlanMode') {
                  broadcastStreamEvent('plan_complete', {
                    tool: 'ExitPlanMode',
                    launchSwarm: parsedInput?.launchSwarm
                  });
                  console.log(`[PROXY] [${agentName}] ✅ Exiting plan mode`);
                }
                // Special handling for file operations - show what's being read/written
                else if (['Read', 'Write', 'Edit'].includes(currentToolBlock.name)) {
                  const filePath = parsedInput?.file_path || parsedInput?.path || '';
                  broadcastStreamEvent('file_operation', {
                    tool: currentToolBlock.name,
                    file: filePath.split('/').pop() || filePath,
                    fullPath: filePath
                  });
                }
                // Default tool_call broadcast
                else {
                  broadcastStreamEvent('tool_call', {
                    tool: currentToolBlock.name,
                    input: typeof parsedInput === 'string' ? parsedInput.slice(0, 200) : JSON.stringify(parsedInput).slice(0, 200)
                  });
                }
                // Mark this tool as pending completion - will be confirmed when we see
                // the next content (tool or text) or at message end
                pendingToolCompletion = { name: currentToolBlock.name, id: currentToolBlock.id };
                currentToolBlock = null;
              }
            }

            // Tool result - if we get an explicit tool_result event, use it
            else if (event.type === 'tool_result') {
              // Clear pending since we got an explicit result
              pendingToolCompletion = null;
              const result = event.content || event.result || '';
              const resultPreview = typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
              workLog.push({
                type: 'tool_result',
                tool_use_id: event.tool_use_id,
                content: resultPreview,
                timestamp: new Date().toISOString()
              });
              broadcastStreamEvent('tool_result', { result: resultPreview });
            }

            // Message complete - extract usage
            else if (event.type === 'message_stop' || event.type === 'message') {
              // Complete any pending tool before message ends
              completePendingTool();

              if (event.message?.usage || event.usage) {
                const usage = event.message?.usage || event.usage;
                usageData.inputTokens = usage.input_tokens || 0;
                usageData.outputTokens = usage.output_tokens || 0;
                usageData.cacheReadTokens = usage.cache_read_input_tokens || 0;
                usageData.cacheWriteTokens = usage.cache_creation_input_tokens || 0;
                usageData.totalTokens = usageData.inputTokens + usageData.outputTokens;
              }
              if (event.message?.model) {
                usageData.model = event.message.model;
              }
            }

            // Handle assistant messages (completed tool calls)
            else if (event.type === 'assistant' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'tool_use') {
                  workLog.push({
                    type: 'tool_call',
                    tool: block.name,
                    input: block.input,
                    timestamp: new Date().toISOString()
                  });
                  broadcastStreamEvent('tool_start', { tool: block.name });
                  console.log(`[PROXY] [${agentName}] 🔧 Tool: ${block.name}`);
                } else if (block.type === 'text' && block.text) {
                  // Skip - this text was already streamed via content_block_delta events
                  // Broadcasting again would cause duplicate messages
                }
              }
              // Extract usage from assistant message
              if (event.message.usage) {
                usageData.inputTokens = event.message.usage.input_tokens || usageData.inputTokens;
                usageData.outputTokens = event.message.usage.output_tokens || usageData.outputTokens;
                usageData.totalTokens = usageData.inputTokens + usageData.outputTokens;
              }
              if (event.message.model) {
                usageData.model = event.message.model;
              }
            }

            // Handle user messages (tool results)
            else if (event.type === 'user' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'tool_result') {
                  // Clear pending since we got an explicit result
                  pendingToolCompletion = null;

                  const resultPreview = typeof block.content === 'string'
                    ? block.content.slice(0, 200)
                    : JSON.stringify(block.content).slice(0, 200);
                  workLog.push({
                    type: 'tool_result',
                    tool_use_id: block.tool_use_id,
                    content: resultPreview,
                    is_error: block.is_error || false,
                    timestamp: new Date().toISOString()
                  });
                  broadcastStreamEvent('tool_result', {
                    result: resultPreview,
                    is_error: block.is_error || false
                  });
                }
              }
            }

            // Result event (final output)
            else if (event.type === 'result') {
              // Complete any pending tool at result time
              completePendingTool();

              if (event.result) {
                streamingText = event.result;
              }
              if (event.usage) {
                usageData.inputTokens = event.usage.input_tokens || usageData.inputTokens;
                usageData.outputTokens = event.usage.output_tokens || usageData.outputTokens;
                usageData.totalTokens = usageData.inputTokens + usageData.outputTokens;
              }
              if (event.total_cost_usd !== undefined) {
                usageData.estimatedCostUsd = event.total_cost_usd;
              }
              if (event.model) {
                usageData.model = event.model;
              }
            }

          } catch (parseErr) {
            // Not JSON, might be plain text output
            if (line.trim()) {
              streamingText += line + '\n';
            }
          }
        }
      });

      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.log(`[PROXY] [${agentName}] stderr: ${chunk.trim()}`);
        errorOutput += chunk;
      });

      claude.on('close', (code) => {
        // Complete any remaining pending tool
        completePendingTool();

        const endTime = Date.now();
        usageData.durationMs = endTime - startTime;
        usageData.outputCharCount = streamingText.length;

        // Broadcast completion
        broadcastStreamEvent('complete', {
          duration: usageData.durationMs,
          workLogCount: workLog.length
        });

        // Log usage
        console.log(`[PROXY] [USAGE] Agent: ${agentName}, Model: ${usageData.model}, Input: ${usageData.inputTokens} tokens, Output: ${usageData.outputTokens} tokens, Duration: ${usageData.durationMs}ms, Cost: $${usageData.estimatedCostUsd.toFixed(6)}`);
        console.log(`[PROXY] [${agentName}] Work log: ${workLog.length} entries`);

        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
        } else {
          resolve({
            output: streamingText.trim(),
            usage: usageData,
            workLog
          });
        }
      });

      claude.on('error', (error) => {
        reject(error);
      });

      // Send prompt to Claude via stdin
      console.log(`[PROXY] [${agentName}] Sending prompt: ${fullPrompt.substring(0, 200)}...`);
      claude.stdin.write(fullPrompt);
      claude.stdin.end();
    });
  }

  // 🚀 CEREBRO ENHANCEMENT: System Metrics Method
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    return {
      server: {
        uptime: Math.round(process.uptime()),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      connections: {
        activeClients: this.clients.size,
        activePipelines: this.activePipelines.size,
        conversationHistories: this.conversationHistory.size
      },
      performance: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        loadAverage: require('os').loadavg(),
        freeMem: Math.round(require('os').freemem() / 1024 / 1024),
        totalMem: Math.round(require('os').totalmem() / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to determine file type based on name and extension
function getFileType(filename, ext) {
  const name = filename.toLowerCase();
  
  if (name.includes('physics') && ext === '.md') return 'physics-document';
  if (name.includes('implementation') && ext === '.md') return 'implementation-guide';
  if (name.includes('reference') && ext === '.md') return 'technical-reference';
  if (name.includes('thesis') && ext === '.md') return 'thesis-document';
  if (name === 'claude.md') return 'project-readme';
  if (name === 'readme.md') return 'readme';
  
  switch (ext) {
    case '.md': return 'markdown-document';
    case '.txt': return 'text-document';
    case '.py': return 'python-script';
    case '.js': return 'javascript-code';
    case '.html': return 'html-document';
    case '.json': return 'json-data';
    case '.csv': return 'csv-data';
    case '.pdf': return 'pdf-document';
    default: return 'document';
  }
}

// Start the proxy server
const proxy = new ClaudeProxy();