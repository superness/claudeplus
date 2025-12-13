/**
 * AI Game Studio Server
 * User-facing game builder with pipeline execution
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const db = require('./services/db');
const pipelineBridge = require('./services/pipeline-bridge');
const queueService = require('./services/queue-service');
const serverManager = require('./services/server-manager');

const PORT = 3008;

// Initialize Express
const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/games', express.static(path.join(__dirname, 'games')));

// Serve imported game files from custom paths
app.get('/imported/:projectId/*', (req, res) => {
  const project = db.getProject(req.params.projectId);
  if (!project || !project.custom_path) {
    return res.status(404).send('Not found');
  }

  const filePath = path.join(project.custom_path, req.params[0] || 'index.html');

  // Security: ensure requested file is within custom_path
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(path.normalize(project.custom_path))) {
    return res.status(403).send('Forbidden');
  }

  res.sendFile(normalizedPath);
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track client subscriptions
const clientProjects = new Map(); // ws -> projectId

// ============================================
// Authentication Middleware
// ============================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);
  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = session.user_id;
  req.user = db.getUserById(session.user_id);
  next();
}

// ============================================
// Auth Routes
// ============================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    if (db.getUserByEmail(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = db.createUser(email, passwordHash);

    // Create session
    const session = db.createSession(user.id);

    res.json({
      user: { id: user.id, email: user.email },
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    console.error('[API] Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const session = db.createSession(user.id);

    res.json({
      user: { id: user.id, email: user.email },
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    console.error('[API] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization.slice(7);
  db.deleteSession(token);
  res.json({ success: true });
});

// ============================================
// Project Routes
// ============================================

app.get('/api/projects', authMiddleware, (req, res) => {
  const projects = db.getProjectsByUser(req.userId);
  res.json({ projects });
});

app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { name, gameIdea, gameType, designComplexity } = req.body;

    if (!name || !gameIdea) {
      return res.status(400).json({ error: 'Name and game idea required' });
    }

    // Validate designComplexity if provided
    const validComplexities = ['simple', 'standard', 'complex', null, ''];
    const complexity = validComplexities.includes(designComplexity) ? (designComplexity || null) : null;

    // Create project with optional complexity override
    const project = db.createProject(req.userId, name, gameIdea, gameType || '2d', complexity);

    console.log(`[API] Created project ${project.id} with complexity: ${complexity || 'auto-detect'}`);

    // Start design phase asynchronously
    queueService.startDesignPhase(project);

    res.json({ project });
  } catch (err) {
    console.error('[API] Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/api/projects/:id', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({ project });
});

app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }
  db.deleteProject(req.params.id);
  res.json({ success: true });
});

// Import an existing external game project
app.post('/api/projects/import', authMiddleware, (req, res) => {
  try {
    const { name, description, path: gamePath } = req.body;

    if (!name || !gamePath) {
      return res.status(400).json({ error: 'Name and path are required' });
    }

    // Convert Windows path to WSL format if needed
    let wslPath = gamePath;
    if (gamePath.match(/^[A-Z]:\\/i)) {
      wslPath = gamePath.replace(/^([A-Z]):\\/i, '/mnt/$1/').replace(/\\/g, '/').toLowerCase();
    }

    // Verify path exists
    const fs = require('fs');
    if (!fs.existsSync(wslPath)) {
      return res.status(400).json({ error: `Path not found: ${wslPath}` });
    }

    const project = db.importProject(
      req.userId,
      name,
      description || `Imported from ${gamePath}`,
      wslPath,
      'live' // Imported projects start as live
    );

    console.log(`[API] Imported project ${project.id} from ${wslPath}`);
    res.json({ project });
  } catch (err) {
    console.error('[API] Import project error:', err);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

// ============================================
// Work Queue Routes
// ============================================

app.get('/api/projects/:id/queue', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const status = queueService.getQueueStatus(req.params.id);
  res.json(status);
});

app.post('/api/projects/:id/queue', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { description, pipelineType } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Description required' });
  }

  // Validate pipeline type: 'feature' or 'bugfix'
  const validTypes = ['feature', 'bugfix'];
  const type = validTypes.includes(pipelineType) ? pipelineType : 'feature';

  const item = queueService.addToQueue(req.params.id, description, type);
  res.json({ item });
});

app.delete('/api/projects/:id/queue/:itemId', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const success = queueService.cancelQueuedItem(req.params.itemId);
  res.json({ success });
});

// Mark a work item as completed or failed (for stale/abandoned items)
app.post('/api/projects/:id/queue/:itemId/complete', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { status } = req.body; // 'completed' or 'error'
  const newStatus = status === 'error' ? 'error' : 'completed';

  try {
    db.updateWorkStatus(req.params.itemId, newStatus);
    queueService.emit('work-completed', { projectId: project.id, itemId: req.params.itemId });

    // Check if there are more queued items to process
    const queueStatus = queueService.getQueueStatus(project.id);
    if (queueStatus.queued.length > 0) {
      // Process the next item in the queue
      console.log(`[API] Processing next queued item for ${project.id}`);
      queueService.processNextInQueue(project.id);
    } else if (!queueStatus.currentWork) {
      // No more work, mark project as live
      db.updateProjectStatus(project.id, 'live');
      queueService.emit('project-live', { projectId: project.id });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('[API] Complete work item error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// Pipeline Progress Routes
// ============================================

// Get current pipeline progress for a project
app.get('/api/projects/:id/pipeline-progress', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const progress = queueService.getPipelineProgress(req.params.id);
  res.json(progress);
});

// Start tracking pipeline progress for a project (called when opening studio)
app.post('/api/projects/:id/track-progress', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const result = queueService.startTrackingProject(req.params.id);
  res.json(result);
});

// Manually trigger queue processing for a project
app.post('/api/projects/:id/process-queue', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  console.log(`[API] Manual queue processing trigger for ${project.id}`);
  queueService.processNextInQueue(req.params.id);
  res.json({ triggered: true, projectId: req.params.id });
});

// ============================================
// Pipeline Stories Routes
// ============================================

// Get pipeline stories for a project
app.get('/api/projects/:id/stories', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const stories = [];
    const infographicsDir = path.join(__dirname, '../proxy/pipeline-infographics');
    const pipelinesDir = path.join(__dirname, '../proxy/pipelines');

    if (!fs.existsSync(infographicsDir)) {
      return res.json({ stories: [] });
    }

    // Scan all pipeline folders and find ones that match this project
    const pipelineFolders = fs.readdirSync(infographicsDir)
      .filter(d => d.startsWith('pipeline_'))
      .sort()
      .reverse(); // newest first

    for (const folder of pipelineFolders) {
      const pipelineDir = path.join(infographicsDir, folder);

      // Check execution log to see if this pipeline was for our project
      const pipelineTimestamp = folder.replace('pipeline_', '');
      const executionLogPath = path.join(pipelinesDir, `${folder}_execution.json`);

      let isForThisProject = false;
      let pipelineType = 'feature';
      let description = 'Pipeline run';

      if (fs.existsSync(executionLogPath)) {
        try {
          const logContent = fs.readFileSync(executionLogPath, 'utf8');
          // Check if working directory contains our project ID
          if (logContent.includes(req.params.id)) {
            isForThisProject = true;
            // Try to determine type from log
            if (logContent.includes('living-game-world') || logContent.includes('game-design')) {
              pipelineType = 'design';
              description = 'Initial Design';
            } else if (logContent.includes('feature-implementer')) {
              pipelineType = 'feature';
            }
          }
        } catch (e) {
          // Ignore read errors
        }
      }

      // Also check if this matches known pipeline IDs
      if (project.design_pipeline_id === folder) {
        isForThisProject = true;
        pipelineType = 'design';
        description = 'Initial Design';
      }

      if (!isForThisProject) continue;

      // Find the latest run directory with story.html
      const runs = fs.readdirSync(pipelineDir)
        .filter(d => d.startsWith('run_'))
        .sort()
        .reverse();

      for (const run of runs) {
        const storyPath = path.join(pipelineDir, run, 'story.html');
        if (fs.existsSync(storyPath)) {
          stories.push({
            pipelineId: folder,
            runId: run,
            timestamp: run.replace('run_', ''),
            description,
            url: `/pipeline-stories/${folder}/${run}/story.html`,
            type: pipelineType
          });
          break; // Only latest run per pipeline
        }
      }
    }

    res.json({ stories });
  } catch (err) {
    console.error('[API] Get stories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve pipeline stories as static files
app.use('/pipeline-stories', express.static(path.join(__dirname, '../proxy/pipeline-infographics')));

// ============================================
// Pipeline Resume Routes
// ============================================

// Check for incomplete pipelines
app.get('/api/pipelines/incomplete', authMiddleware, async (req, res) => {
  try {
    const result = await queueService.checkAndResumeIncomplete();
    res.json(result);
  } catch (err) {
    console.error('[API] Check incomplete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resume a specific pipeline
app.post('/api/pipelines/:pipelineId/resume', authMiddleware, async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { projectId } = req.body;

    // Verify project ownership if projectId provided
    if (projectId) {
      const project = db.getProject(projectId);
      if (!project || project.user_id !== req.userId) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const result = await queueService.resumeIncomplete(pipelineId, projectId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('[API] Resume pipeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// Server Management Routes
// ============================================

// Helper to get project path
function getProjectPath(project) {
  if (project.custom_path) {
    return project.custom_path;
  }
  return path.join(__dirname, 'games', project.user_id, project.id, 'output');
}

// Analyze project for server configuration
app.post('/api/projects/:id/server/analyze', authMiddleware, async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const projectPath = getProjectPath(project);
    const config = await serverManager.analyzeProject(projectPath);

    // Save config to database
    db.updateServerConfig(req.params.id, config);

    console.log(`[API] Analyzed server config for ${project.id}:`, config.detected);
    res.json({ config });
  } catch (err) {
    console.error('[API] Analyze server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start game server
app.post('/api/projects/:id/server/start', authMiddleware, async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const projectPath = getProjectPath(project);

    // Get config from database or analyze
    let config = db.getProjectServerConfig(req.params.id);
    if (!config) {
      config = await serverManager.analyzeProject(projectPath);
      db.updateServerConfig(req.params.id, config);
    }

    // Apply any overrides from request
    const startConfig = {
      startCommand: req.body.startCommand || config.overrides?.startCommand || config.detected?.startCommand,
      port: req.body.port || config.overrides?.port || config.detected?.port,
      nodeEnv: req.body.nodeEnv || 'development'
    };

    const result = await serverManager.startServer(req.params.id, projectPath, startConfig);

    // Update database status
    db.updateServerStatus(req.params.id, 'running', result.pid);

    console.log(`[API] Started server for ${project.id} on port ${result.port}`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] Start server error:', err);
    db.updateServerStatus(req.params.id, 'error', null);
    res.status(500).json({ error: err.message });
  }
});

// Stop game server
app.post('/api/projects/:id/server/stop', authMiddleware, async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const result = await serverManager.stopServer(req.params.id);

    // Update database status
    db.updateServerStatus(req.params.id, 'stopped', null);

    console.log(`[API] Stopped server for ${project.id}`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] Stop server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Restart game server
app.post('/api/projects/:id/server/restart', authMiddleware, async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const projectPath = getProjectPath(project);

    // Get config
    let config = db.getProjectServerConfig(req.params.id);
    if (!config) {
      config = await serverManager.analyzeProject(projectPath);
      db.updateServerConfig(req.params.id, config);
    }

    const startConfig = {
      startCommand: req.body.startCommand || config.overrides?.startCommand || config.detected?.startCommand,
      port: req.body.port || config.overrides?.port || config.detected?.port,
      nodeEnv: req.body.nodeEnv || 'development'
    };

    const result = await serverManager.restartServer(req.params.id, projectPath, startConfig);

    // Update database status
    db.updateServerStatus(req.params.id, 'running', result.pid);

    console.log(`[API] Restarted server for ${project.id}`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] Restart server error:', err);
    db.updateServerStatus(req.params.id, 'error', null);
    res.status(500).json({ error: err.message });
  }
});

// Get server status
app.get('/api/projects/:id/server/status', authMiddleware, (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const status = serverManager.getServerStatus(req.params.id);
    const config = db.getProjectServerConfig(req.params.id);

    res.json({
      ...status,
      config
    });
  } catch (err) {
    console.error('[API] Get server status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run npm script
app.post('/api/projects/:id/server/run-script', authMiddleware, async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project || project.user_id !== req.userId) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const { script } = req.body;
  if (!script) {
    return res.status(400).json({ error: 'Script name required' });
  }

  try {
    const projectPath = getProjectPath(project);

    console.log(`[API] Running script '${script}' for ${project.id}`);
    const result = await serverManager.runScript(req.params.id, projectPath, script);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] Run script error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WebSocket Handling
// ============================================

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'subscribe':
          // Subscribe to project updates
          if (msg.projectId) {
            clientProjects.set(ws, msg.projectId);
            console.log(`[WS] Client subscribed to ${msg.projectId}`);
          }
          break;

        case 'unsubscribe':
          clientProjects.delete(ws);
          break;

        case 'inject-pipeline-feedback':
          // Forward feedback to proxy server for injection into running pipeline
          console.log(`[WS] Forwarding feedback to proxy: "${msg.feedback?.substring(0, 50)}..."`);
          pipelineBridge.send({
            type: 'inject-pipeline-feedback',
            projectId: msg.projectId,
            pipelineId: msg.pipelineId,
            feedback: msg.feedback
          });
          break;
      }
    } catch (err) {
      console.error('[WS] Message error:', err);
    }
  });

  ws.on('close', () => {
    clientProjects.delete(ws);
    console.log('[WS] Client disconnected');
  });
});

// Broadcast to clients subscribed to a project
function broadcastToProject(projectId, message) {
  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && clientProjects.get(client) === projectId) {
      client.send(JSON.stringify(message));
      sentCount++;
    }
  });
  if (message.type === 'pipeline-progress' || message.type === 'agent-output') {
    console.log(`[WS] Broadcast ${message.type} to ${sentCount} clients for ${projectId}`);
  }
}

// ============================================
// Queue Service Events -> WebSocket
// ============================================

queueService.on('design-started', (data) => {
  broadcastToProject(data.projectId, { type: 'design-started', ...data });
});

queueService.on('design-completed', (data) => {
  broadcastToProject(data.projectId, { type: 'design-completed', ...data });
});

queueService.on('design-failed', (data) => {
  broadcastToProject(data.projectId, { type: 'design-failed', ...data });
});

queueService.on('work-started', (data) => {
  broadcastToProject(data.projectId, { type: 'work-started', ...data });
});

queueService.on('work-completed', (data) => {
  broadcastToProject(data.projectId, { type: 'work-completed', ...data });
});

queueService.on('work-failed', (data) => {
  broadcastToProject(data.projectId, { type: 'work-failed', ...data });
});

queueService.on('queue-updated', (data) => {
  broadcastToProject(data.projectId, { type: 'queue-updated', ...data });
});

queueService.on('pipeline-progress', (data) => {
  broadcastToProject(data.projectId, { type: 'pipeline-progress', ...data });
});

queueService.on('agent-output', (data) => {
  broadcastToProject(data.projectId, { type: 'agent-output', ...data });
});

queueService.on('game-updated', (data) => {
  broadcastToProject(data.projectId, { type: 'game-updated', ...data });
});

queueService.on('project-live', (data) => {
  broadcastToProject(data.projectId, { type: 'project-live', ...data });
});

// Forward pipeline bridge events
pipelineBridge.onEvent((msg) => {
  // Handle commentary messages specially
  if (msg.type === 'pipeline-commentary') {
    // Try to find which project this is for from active pipelines
    // Commentary is broadcast to all clients by the proxy, so forward to all projects
    const content = msg.content || {};
    console.log(`[Server] Received commentary: ${content.message?.substring(0, 50)}...`);

    // Broadcast commentary to all connected clients that are subscribed to a project
    wss.clients.forEach(client => {
      if (client.readyState === 1 && clientProjects.has(client)) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'pipeline-commentary',
          ...content
        }));
      }
    });
    return;
  }

  // Handle feedback injection responses
  if (msg.type === 'feedback-injected' || msg.type === 'feedback-error' || msg.type === 'pipeline-feedback-update') {
    console.log(`[Server] Received feedback response: ${msg.type}`);

    // Broadcast to all connected clients (they can filter by pipelineId if needed)
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(msg));
      }
    });
    return;
  }

  // Extract projectId from pipeline messages
  if (msg.pipelineId) {
    const match = msg.pipelineId.match(/_(proj_\w+)_/);
    if (match) {
      broadcastToProject(match[1], {
        type: 'pipeline-progress',
        ...msg
      });
    }
  }
});

// ============================================
// Server Manager Events -> WebSocket
// ============================================

serverManager.on('server-started', (data) => {
  broadcastToProject(data.projectId, { type: 'server-started', ...data });
});

serverManager.on('server-stopped', (data) => {
  broadcastToProject(data.projectId, { type: 'server-stopped', ...data });
});

serverManager.on('server-output', (data) => {
  broadcastToProject(data.projectId, { type: 'server-output', ...data });
});

serverManager.on('server-error', (data) => {
  broadcastToProject(data.projectId, { type: 'server-error', ...data });
});

serverManager.on('script-output', (data) => {
  broadcastToProject(data.projectId, { type: 'script-output', ...data });
});

// ============================================
// Start Server
// ============================================

async function start() {
  // Clean up any orphaned server processes from previous runs
  try {
    await serverManager.cleanupOrphanedServers(db);
    console.log('[Server] Cleaned up orphaned server processes');
  } catch (err) {
    console.warn('[Server] Error cleaning up orphaned servers:', err.message);
  }

  try {
    // Connect to proxy server
    await pipelineBridge.connect();
    console.log('[Server] Connected to pipeline proxy');
  } catch (err) {
    console.warn('[Server] Could not connect to proxy (will retry):', err.message);
  }

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                    AI GAME STUDIO                       ║
║                                                          ║
║  Web UI:     http://localhost:${PORT}                     ║
║  API:        http://localhost:${PORT}/api                 ║
║  Games:      http://localhost:${PORT}/games/{user}/{proj} ║
╚══════════════════════════════════════════════════════════╝
`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await serverManager.stopAllServers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await serverManager.stopAllServers();
  process.exit(0);
});

start();
