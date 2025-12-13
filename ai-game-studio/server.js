/**
 * AI Game Studio Server
 * User-facing game builder with pipeline execution
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcrypt');

const db = require('./services/db');
const pipelineBridge = require('./services/pipeline-bridge');
const queueService = require('./services/queue-service');

const PORT = 3008;

// Initialize Express
const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/games', express.static(path.join(__dirname, 'games')));

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

  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Description required' });
  }

  const item = queueService.addToQueue(req.params.id, description);
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
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && clientProjects.get(client) === projectId) {
      client.send(JSON.stringify(message));
    }
  });
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

queueService.on('game-updated', (data) => {
  broadcastToProject(data.projectId, { type: 'game-updated', ...data });
});

queueService.on('project-live', (data) => {
  broadcastToProject(data.projectId, { type: 'project-live', ...data });
});

// Forward pipeline bridge events
pipelineBridge.onEvent((msg) => {
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
// Start Server
// ============================================

async function start() {
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

start();
