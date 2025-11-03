const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const MultiAgentClaudeSystem = require('./multi-agent-system');

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
    this.wss = new WebSocket.Server({ port: 8081 });
    this.claudeProcess = null;
    this.clients = new Set();
    this.conversationHistory = new Map(); // Track conversation per client
    this.workingDirectory = new Map(); // Track working directory per client
    this.activePipelines = new Map(); // Track active pipeline executions
    this.pipelineClients = new Map(); // Map pipeline IDs to WebSocket clients
    this.pipelinesDataDir = path.join(__dirname, 'pipelines'); // Directory for pipeline data files
    this.templatesDir = path.join(__dirname, '..', 'templates'); // Directory for template JSON files
    this.agentsDir = path.join(__dirname, '..', 'agents'); // Directory for agent JSON files

    this.initializePipelineStorage();
    this.initializeTemplateStorage();
    this.initializeAgentStorage();
    this.setupWebSocketServer();
    this.loadActivePipelines(); // Load pipelines from disk
    console.log('Claude Proxy Server running on port 8081');
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
        console.log('[PROXY] Windows client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[PROXY] WebSocket error:', error);
      });
    });
  }

  async handleClientMessage(message, ws) {
    if (message.type === 'pipeline-config') {
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
      
    } else if (message.type === 'directory-change') {
      console.log(`[PROXY] Directory change request: ${message.directory}`);
      
      // Convert Windows paths to WSL paths
      let wslPath = message.directory;
      if (message.directory.match(/^[A-Z]:\\/)) {
        // Convert C:\path\to\dir to /mnt/c/path/to/dir
        wslPath = message.directory.replace(/^([A-Z]):\\/, '/mnt/$1/').replace(/\\/g, '/').toLowerCase();
        console.log(`[PROXY] Converted Windows path to WSL: ${message.directory} -> ${wslPath}`);
      }
      
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
      
      ws.send(JSON.stringify({
        type: 'active-pipelines',
        pipelines: activePipelineList
      }));
      
    } else if (message.type === 'reconnect-pipeline') {
      console.log(`[PROXY] Client reconnecting to pipeline: ${message.pipelineId}`);
      
      if (this.activePipelines.has(message.pipelineId)) {
        this.pipelineClients.set(message.pipelineId, ws);
        
        ws.send(JSON.stringify({
          type: 'pipeline-reconnected',
          pipelineId: message.pipelineId,
          status: 'Connected to running pipeline'
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'pipeline-reconnect-failed',
          pipelineId: message.pipelineId,
          error: 'Pipeline not found or no longer active'
        }));
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
        ws.send(JSON.stringify({
          type: 'template-data',
          template: template
        }));
      } else {
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
      
    } else if (message.type === 'execute-pipeline') {
      console.log(`[PROXY] Received pipeline execution request: ${message.pipeline?.name || 'unknown'}`);

      try {
        // Initialize multi-agent system for pipeline execution
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        console.log(`[PROXY] Using working directory for pipeline: ${workingDir}`);
        const multiAgent = new MultiAgentClaudeSystem(workingDir);

        // Set up real-time status callback
        multiAgent.setStatusCallback((logEntry) => {
          ws.send(JSON.stringify({
            type: 'pipeline-status',
            content: logEntry
          }));
        });

        // Send status update to client
        ws.send(JSON.stringify({
          type: 'system-status',
          content: `Starting pipeline: ${message.pipeline.name}`
        }));

        // Execute pipeline directly (skip planning phase)
        const response = await multiAgent.executePipelineDirectly(message.pipeline, message.userContext || '');

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

        // Initialize multi-agent system for this request
        // Use working directory from message, fallback to stored value, then current directory
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        console.log(`[PROXY] Using working directory: ${workingDir}`);
        const multiAgent = new MultiAgentClaudeSystem(workingDir);

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
        const claude = spawn('claude', ['--permission-mode', 'bypassPermissions', '-'], {
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
    try {
      const filePath = path.join(this.pipelinesDataDir, `${pipelineId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[PROXY] Deleted pipeline data file: ${pipelineId}`);
        return true;
      }
    } catch (error) {
      console.error(`[PROXY] Error deleting pipeline data for ${pipelineId}:`, error);
    }
    return false;
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