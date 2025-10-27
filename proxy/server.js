const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const MultiAgentClaudeSystem = require('./multi-agent-system');

// Create log file and override console.log
const logFile = '/mnt/c/github/claudeplus/proxy/proxy.log';
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
    this.wss = new WebSocket.Server({ port: 8081 });
    this.claudeProcess = null;
    this.clients = new Set();
    this.conversationHistory = new Map(); // Track conversation per client

    this.setupWebSocketServer();
    console.log('Claude Proxy Server running on port 8081');
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws) => {
      console.log('[PROXY] Windows client connected');
      this.clients.add(ws);

      // Initialize conversation history for this client
      this.conversationHistory.set(ws, []);

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
        console.log('[PROXY] Windows client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[PROXY] WebSocket error:', error);
      });
    });
  }

  async handleClientMessage(message, ws) {
    if (message.type === 'user-message') {
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

        // Initialize multi-agent system for this request
        const multiAgent = new MultiAgentClaudeSystem();

        // Set up real-time status callback
        multiAgent.setStatusCallback((logEntry) => {
          ws.send(JSON.stringify({
            type: 'agent-status',
            content: logEntry
          }));
        });

        // Send status update to client
        ws.send(JSON.stringify({
          type: 'system-status',
          content: 'Initializing multi-agent validation system...'
        }));

        // Process through multi-agent system WITH CONTEXT
        const response = await multiAgent.processUserRequest(contextualMessage);

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

        // Optionally send the full conversation log
        ws.send(JSON.stringify({
          type: 'agent-log',
          content: multiAgent.getFullLog()
        }));
        
      } catch (error) {
        console.error('[PROXY] Multi-agent system error:', error);
        ws.send(JSON.stringify({
          type: 'claude-response',
          content: `Multi-agent system error: ${error.message}`
        }));
      }
    } // DISABLED: Dragon-vision system disabled
    // else if (message.type === 'dragon-command') {
    //   console.log(`[PROXY] 🐉 Dragon command received:`, message.content);
    //
    //   try {
    //     // Get the dragon orchestrator from multi-agent system
    //     const multiAgent = new MultiAgentClaudeSystem();
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

  async sendToClaude(message) {
    console.log(`[PROXY] Attempting to send message to Claude: "${message}"`);
    try {
      return new Promise((resolve, reject) => {
        console.log('[PROXY] Spawning claude process...');
        const claude = spawn('claude', ['-'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
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
            resolve(output || 'No response from Claude');
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
}

// Start the proxy server
const proxy = new ClaudeProxy();