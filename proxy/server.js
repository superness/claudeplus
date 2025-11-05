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
        
        // Check both proxy/pipelines and output/.pipeline-state directories
        const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';
        const pipelineStateDirs = [
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
                  activePipelineList.push({
                    id: pipelineId,
                    prompt: pipelineState.userContext || pipelineState.name || 'Running pipeline',
                    startTime: pipelineState.startTime,
                    status: pipelineState.status,
                    progress: `${pipelineState.completedStages?.length || 0}/${pipelineState.totalStages || 0} stages completed`,
                    currentStage: pipelineState.currentStage,
                    name: pipelineState.name,
                    template: pipelineState.template
                  });
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
        
        ws.send(JSON.stringify({
          type: 'pipeline-reconnected',
          pipelineId: message.pipelineId,
          status: 'Connected to running pipeline'
        }));
      } else {
        // Check for file-based pipeline states (like CEREBRO)
        try {
          const fs = require('fs');
          const path = require('path');
          
          const baseDir = this.baseDirectory || '/mnt/c/github/claudeplus';
          const pipelineStateDirs = [
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
            try {
              const outputDir = path.join(this.baseDirectory, 'output');
              
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
            
            ws.send(JSON.stringify({
              type: 'pipeline-reconnected',
              pipelineId: message.pipelineId,
              status: 'Connected to file-based pipeline',
              pipelineData: pipelineData,
              chatHistory: chatHistory
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
      
    } else if (message.type === 'execute-pipeline') {
      console.log(`[PROXY] Received pipeline execution request: ${message.pipeline?.name || 'unknown'}`);

      try {
        // Execute pipeline directly without multi-agent wrapper
        let workingDir = message.workingDirectory || message.pipeline?.globalConfig?.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        
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

        // Execute pipeline stages sequentially  
        const response = await this.executePipelineStages(message.pipeline, message.userContext || '', workingDir, ws);

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
    } else if (message.type === 'execute-single-agent') {
      console.log(`[PROXY] Single agent execution request: ${message.agent}`);
      
      try {
        // Create a new multi-agent system instance
        const multiAgent = new MultiAgentClaudeSystem();
        
        // Get working directory for this client
        const workingDir = message.workingDirectory || this.workingDirectory.get(ws) || process.cwd();
        console.log(`[PROXY] Using working directory: ${workingDir}`);
        
        // Execute single agent with status callbacks
        const statusCallback = (data) => {
          console.log(`[PROXY] Agent status:`, data);
          ws.send(JSON.stringify({
            type: 'agent-output',
            content: data
          }));
        };
        
        // Load the specified agent
        const agentPath = path.join(this.agentsDir, `${message.agent}.json`);
        if (!fs.existsSync(agentPath)) {
          throw new Error(`Agent "${message.agent}" not found`);
        }
        
        const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
        console.log(`[PROXY] Loaded agent: ${agentConfig.name}`);
        
        // Execute the single agent
        const result = await multiAgent.executeSingleAgent(
          agentConfig,
          message.prompt,
          workingDir,
          statusCallback
        );
        
        console.log(`[PROXY] Single agent execution completed`);
        
        // Send final result
        ws.send(JSON.stringify({
          type: 'agent-output',
          content: {
            output: result,
            agent: message.agent,
            completed: true
          }
        }));
        
      } catch (error) {
        console.error('[PROXY] Single agent execution error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: `Single agent execution error: ${error.message}`
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

  async generateCommentary(context, workingDir) {
    try {
      const commentatorPrompt = `You are providing real-time status updates for a pipeline execution system.

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

      const commentary = await this.executeClaudeWithMCP('commentator', commentatorPrompt, context, workingDir);
      const rawCommentary = commentary.trim();
      
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

  async sendCommentaryUpdate(ws, context, workingDir) {
    // Run commentary generation in background without blocking pipeline
    setImmediate(async () => {
      try {
        const commentary = await this.generateCommentary(context, workingDir);
        
        ws.send(JSON.stringify({
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
        }));
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

  async executePipelineStages(pipeline, userContext, workingDir, ws) {
    console.log(`[PROXY] Executing ${pipeline.stages?.length || 0} stages for pipeline: ${pipeline.name}`);

    // Create pipeline state for persistence
    const pipelineState = {
      id: `pipeline_${Date.now()}`,
      name: pipeline.name,
      startTime: new Date().toISOString(),
      stages: pipeline.stages,
      userContext,
      workingDir,
      currentStageIndex: 0,
      completedStages: [],
      status: 'running',
      results: {}
    };

    // Save initial pipeline state
    await this.savePipelineState(pipelineState);

    // Send initial commentary
    await this.sendCommentaryUpdate(ws, `A new pipeline execution is starting: "${pipeline.name}" with ${pipeline.stages?.length || 0} stages. The system is about to begin processing.`, workingDir);

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
    
    // Execute stages with conditional flow
    const stageMap = {};
    pipeline.stages.forEach(stage => stageMap[stage.id] = stage);
    
    let currentStageId = pipeline.stages[0]?.id; // Start with first stage
    let executionCount = 0;
    const maxExecutions = 20; // Prevent infinite loops
    
    while (currentStageId && executionCount < maxExecutions) {
      const stage = stageMap[currentStageId];
      if (!stage) break;
      
      executionCount++;
      try {
        console.log(`[PROXY] Executing stage: ${stage.name} (${stage.agent})`);
        
        // Update pipeline state
        pipelineState.currentStageIndex = executionCount - 1;
        pipelineState.currentStage = stage.name;
        await this.savePipelineState(pipelineState);
        
        // Send stage start notification
        ws.send(JSON.stringify({
          type: 'pipeline-status',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            type: 'stage-start',
            message: `Starting ${stage.name}`,
            style: 'focused'
          }
        }));

        // Send commentator update for stage start  
        await this.sendCommentaryUpdate(ws, `Stage starting: ${stage.name} (${stage.agent}). Agent type: ${stage.type}. Task: ${stage.description}`, workingDir);

        // Build input for this stage
        let stageInput = userContext;
        if (stage.inputs && stage.inputs.length > 0) {
          stageInput += '\n\nInputs from previous stages:\n';
          stage.inputs.forEach(inputStage => {
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
        
        // Add decision instructions from stage definition
        if (stage.decisions && stage.decisions.length > 0) {
          agentPrompt += `\n\nIMPORTANT: End your response with exactly one of these decisions:\n`;
          stage.decisions.forEach(decision => {
            agentPrompt += `- DECISION: ${decision.choice} (${decision.description})\n`;
          });
          agentPrompt += `\nFormat: End with "DECISION: [YOUR_CHOICE]" on the last line.`;
        }

        // Execute Claude with MCP
        const result = await this.executeClaudeWithMCP(stage.agent, agentPrompt, stageInput, workingDir);
        results[stage.id] = result;

        // Send agent output to UI
        ws.send(JSON.stringify({
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

        // Send stage complete notification
        ws.send(JSON.stringify({
          type: 'pipeline-status',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            type: 'stage-complete',
            message: `${stage.name} completed`,
            style: 'triumphant'
          }
        }));

        // Send commentator update for stage completion
        await this.sendCommentaryUpdate(ws, `Stage completed: ${stage.name} finished successfully. Output length: ${result?.length || 0} characters. Moving to next stage.`, workingDir);

        // Determine next stage based on conditional flow
        console.log(`[PROXY] [FLOW] Stage ${stage.id} completed. Determining next stage...`);
        console.log(`[PROXY] [FLOW] Stage result length: ${result?.length || 0} characters`);
        console.log(`[PROXY] [FLOW] Stage result preview: ${result?.substring(0, 200)}...`);
        
        const nextStageId = this.determineNextStage(pipeline, stage.id, result);
        console.log(`[PROXY] [FLOW] Next stage determined: ${nextStageId}`);
        
        currentStageId = nextStageId;
        
      } catch (error) {
        console.error(`[PROXY] Stage ${stage.name} failed:`, error);
        
        ws.send(JSON.stringify({
          type: 'pipeline-status',
          content: {
            timestamp: new Date().toISOString(),
            agent: stage.agent.toUpperCase(),
            type: 'stage-error',
            message: `${stage.name} failed: ${error.message}`,
            style: 'critical'
          }
        }));
        
        throw error;
      }
    }

    // Mark pipeline as complete
    pipelineState.status = 'completed';
    pipelineState.endTime = new Date().toISOString();
    await this.savePipelineState(pipelineState);

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
    
    for (let i = 0; i < fromConnections.length; i++) {
      const connection = fromConnections[i];
      const condition = connection.condition;
      
      console.log(`[PROXY] [FLOW] Evaluating connection ${i}: ${connection.from} -> ${connection.to}`);
      console.log(`[PROXY] [FLOW] Condition type: ${typeof condition}`);
      console.log(`[PROXY] [FLOW] Condition value: ${JSON.stringify(condition)}`);
      
      // Handle structured conditions
      if (typeof condition === 'object' && condition.type === 'decision_equals') {
        console.log(`[PROXY] [FLOW] Structured condition: decision_equals ${condition.value}`);
        const decision = this.extractDecision(stageResult);
        console.log(`[PROXY] [FLOW] Extracted decision: "${decision}"`);
        console.log(`[PROXY] [FLOW] Comparing "${decision}" === "${condition.value}"`);
        
        if (decision === condition.value) {
          console.log(`[PROXY] [FLOW] ✅ Flow condition met: ${condition.description} -> ${connection.to}`);
          return connection.to;
        } else {
          console.log(`[PROXY] [FLOW] ❌ Flow condition not met: "${decision}" !== "${condition.value}"`);
        }
      }
      // Handle simple string conditions (for compatibility)
      else if (typeof condition === 'string') {
        console.log(`[PROXY] [FLOW] String condition: ${condition}`);
        const conditionLower = condition.toLowerCase();
        if (conditionLower === 'plan_complete' || conditionLower === 'execution_complete') {
          console.log(`[PROXY] [FLOW] ✅ Flow condition met: ${condition} -> ${connection.to}`);
          return connection.to;
        } else {
          console.log(`[PROXY] [FLOW] ❌ String condition not recognized: ${condition}`);
        }
      }
    }
    
    // Default to first connection if no specific condition matched
    console.log(`[PROXY] No condition matched, using default: ${fromConnections[0].to}`);
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
      
      const match = line.match(/^DECISION:\s*(.+)$/i);
      if (match) {
        const decision = match[1].trim().toUpperCase();
        console.log(`[PROXY] [FLOW] ✅ Found decision: "${decision}"`);
        return decision;
      }
    }
    
    console.log(`[PROXY] [FLOW] ❌ No DECISION: found in last ${searchLines} lines`);
    return null;
  }

  async executeClaudeWithMCP(agentName, prompt, input, workingDir) {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['--permission-mode', 'bypassPermissions', '-'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PWD: workingDir,
          AGENT_NAME: agentName.toUpperCase()
        }
      });

      let output = '';
      let errorOutput = '';

      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log(`[PROXY] [${agentName}] stdout: ${chunk.trim()}`);
        output += chunk;
      });

      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.log(`[PROXY] [${agentName}] stderr: ${chunk.trim()}`);
        errorOutput += chunk;
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
        } else {
          resolve(output.trim());
        }
      });

      claude.on('error', (error) => {
        reject(error);
      });

      // Send prompt and input to Claude
      const fullPrompt = `${prompt}\n\nUser Input: ${input}`;
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