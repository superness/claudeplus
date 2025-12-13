/**
 * AI Game Studio - Main Application
 */

const API_BASE = '/api';

// State
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let currentProject = null;
let projects = [];
let ws = null;
let lastShownStage = null;

// Server management state
let serverStatus = null;
let serverConfig = null;
let serverLogs = [];

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const studioScreen = document.getElementById('studio-screen');
const userArea = document.getElementById('user-area');
const userEmail = document.getElementById('user-email');

// ============================================
// API Helpers
// ============================================

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// ============================================
// Authentication
// ============================================

async function checkAuth() {
  if (!authToken) {
    showScreen('auth');
    return;
  }

  try {
    const { user } = await api('/auth/me');
    currentUser = user;
    userEmail.textContent = user.email;
    showScreen('dashboard');
    loadProjects();

    // Check for incomplete pipelines after authentication
    checkIncompletePipelines();
  } catch (err) {
    localStorage.removeItem('authToken');
    authToken = null;
    showScreen('auth');
  }
}

// Track pipelines we've already handled this session
const handledPipelines = new Set();

// Check for incomplete pipelines that can be resumed
async function checkIncompletePipelines() {
  try {
    const result = await api('/pipelines/incomplete');

    if (result.found && !handledPipelines.has(result.pipelineId)) {
      console.log('Found incomplete pipeline:', result);

      // Check if this pipeline is already actively running (recently started)
      const startTime = new Date(result.state?.startTime);
      const timeSinceStart = Date.now() - startTime.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      // If pipeline started less than 5 minutes ago and is "running", it's probably active
      if (result.state?.status === 'running' && timeSinceStart < fiveMinutes) {
        console.log('Pipeline appears to be actively running, skipping resume prompt');
        handledPipelines.add(result.pipelineId);
        return;
      }

      // Show resume notification
      showResumeNotification(result);
    }
  } catch (err) {
    console.error('Failed to check incomplete pipelines:', err);
  }
}

// Show a notification to resume an incomplete pipeline
function showResumeNotification(result) {
  const { pipelineId, projectId, project, state } = result;

  const completedCount = state.completedStages?.length || 0;
  const totalStages = state.stages?.length || 0;
  const progress = Math.round((completedCount / totalStages) * 100);

  const projectName = project?.name || 'Unknown Project';
  const currentStage = state.currentStage || 'Unknown Stage';

  // Create or update notification banner
  let banner = document.getElementById('resume-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'resume-banner';
    banner.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #4a9eff, #7c3aed);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      max-width: 600px;
    `;
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <div style="flex: 1;">
      <strong>Incomplete Pipeline Found!</strong><br>
      <span style="opacity: 0.9;">${projectName} - ${currentStage} (${progress}% complete)</span>
    </div>
    <button id="resume-btn" style="
      background: white;
      color: #4a9eff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
    ">Resume</button>
    <button id="dismiss-btn" style="
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
    ">Later</button>
  `;

  document.getElementById('resume-btn').addEventListener('click', async () => {
    handledPipelines.add(pipelineId);
    banner.innerHTML = '<span>Resuming pipeline...</span>';

    try {
      await api(`/pipelines/${pipelineId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ projectId })
      });

      banner.remove();

      // If we have a project, open the studio
      if (project) {
        const fullProject = projects.find(p => p.id === projectId) || project;
        openStudio(fullProject);
        addSystemMessage(`Pipeline resumed! Continuing from "${currentStage}"...`);
      }
    } catch (err) {
      banner.innerHTML = `<span style="color: #ff6b6b;">Resume failed: ${err.message}</span>`;
      setTimeout(() => banner.remove(), 5000);
    }
  });

  document.getElementById('dismiss-btn').addEventListener('click', () => {
    handledPipelines.add(pipelineId);
    banner.remove();
  });
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    const { user, token } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    authToken = token;
    localStorage.setItem('authToken', token);
    currentUser = user;
    userEmail.textContent = user.email;
    showScreen('dashboard');
    loadProjects();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('signup-error');

  try {
    const { user, token } = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    authToken = token;
    localStorage.setItem('authToken', token);
    currentUser = user;
    userEmail.textContent = user.email;
    showScreen('dashboard');
    loadProjects();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Ignore logout errors
  }
  localStorage.removeItem('authToken');
  authToken = null;
  currentUser = null;
  showScreen('auth');
});

// Auth tabs
document.querySelectorAll('.auth-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
  });
});

// ============================================
// Screen Management
// ============================================

function showScreen(screen) {
  authScreen.classList.add('hidden');
  dashboardScreen.classList.add('hidden');
  studioScreen.classList.add('hidden');
  userArea.classList.add('hidden');

  switch (screen) {
    case 'auth':
      authScreen.classList.remove('hidden');
      break;
    case 'dashboard':
      dashboardScreen.classList.remove('hidden');
      userArea.classList.remove('hidden');
      break;
    case 'studio':
      studioScreen.classList.remove('hidden');
      userArea.classList.remove('hidden');
      break;
  }
}

// ============================================
// Projects / Dashboard
// ============================================

async function loadProjects() {
  try {
    const { projects: projectList } = await api('/projects');
    projects = projectList;
    renderProjects();
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

function renderProjects() {
  const list = document.getElementById('projects-list');
  const empty = document.getElementById('no-projects');

  if (projects.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  list.classList.remove('hidden');
  empty.classList.add('hidden');

  list.innerHTML = projects.map(p => `
    <div class="project-card" data-id="${p.id}">
      <button class="delete-project-btn" data-id="${p.id}" title="Delete project">&times;</button>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.game_idea)}</p>
      <div class="meta">
        <span class="status-badge ${p.status}">${p.status}</span>
        <span class="game-type">${p.game_type === '3d' ? '3D' : '2D'}</span>
      </div>
    </div>
  `).join('');

  // Click handlers for cards
  list.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open if clicking delete button
      if (e.target.classList.contains('delete-project-btn')) return;
      const project = projects.find(p => p.id === card.dataset.id);
      if (project) openStudio(project);
    });
  });

  // Click handlers for delete buttons
  list.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projectId = btn.dataset.id;
      const project = projects.find(p => p.id === projectId);
      if (project && confirm(`Delete "${project.name}"? This cannot be undone.`)) {
        await deleteProject(projectId);
      }
    });
  });
}

// Delete a project
async function deleteProject(projectId) {
  try {
    await api(`/projects/${projectId}`, { method: 'DELETE' });
    projects = projects.filter(p => p.id !== projectId);
    renderProjects();
  } catch (err) {
    alert('Failed to delete project: ' + err.message);
  }
}

// New Game Modal
document.getElementById('new-game-btn').addEventListener('click', () => {
  document.getElementById('new-game-modal').classList.remove('hidden');
});

document.getElementById('cancel-new-game').addEventListener('click', () => {
  document.getElementById('new-game-modal').classList.add('hidden');
});

document.getElementById('new-game-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('game-name').value;
  const gameType = document.getElementById('game-type').value;
  const gameIdea = document.getElementById('game-idea').value;
  const designComplexity = document.getElementById('design-complexity').value || null;

  try {
    const { project } = await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, gameType, gameIdea, designComplexity })
    });

    document.getElementById('new-game-modal').classList.add('hidden');
    document.getElementById('new-game-form').reset();

    // Add to list and open
    projects.unshift(project);
    renderProjects();
    openStudio(project);
  } catch (err) {
    alert('Failed to create project: ' + err.message);
  }
});

// Import Game Modal
document.getElementById('import-game-btn').addEventListener('click', () => {
  document.getElementById('import-game-modal').classList.remove('hidden');
});

document.getElementById('cancel-import-game').addEventListener('click', () => {
  document.getElementById('import-game-modal').classList.add('hidden');
});

document.getElementById('import-game-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('import-name').value;
  const path = document.getElementById('import-path').value;
  const description = document.getElementById('import-description').value;

  try {
    const { project } = await api('/projects/import', {
      method: 'POST',
      body: JSON.stringify({ name, path, description })
    });

    document.getElementById('import-game-modal').classList.add('hidden');
    document.getElementById('import-game-form').reset();

    // Add to list and open
    projects.unshift(project);
    renderProjects();
    openStudio(project);
  } catch (err) {
    alert('Failed to import project: ' + err.message);
  }
});

// ============================================
// Studio
// ============================================

function openStudio(project) {
  currentProject = project;
  lastShownStage = null; // Reset progress tracking

  // Update UI
  document.getElementById('project-name').textContent = project.name;
  document.getElementById('project-status').textContent = project.status;
  document.getElementById('project-status').className = `status-badge ${project.status}`;

  // Determine game URL based on project type
  let baseUrl, clientUrl, rootUrl;

  if (project.custom_path) {
    // Imported project - use /imported/ route
    baseUrl = `/imported/${project.id}`;
    clientUrl = `${baseUrl}/client/`;
    rootUrl = `${baseUrl}/`;
  } else {
    // Regular project - use /games/ route
    baseUrl = `/games/${currentUser.id}/${project.id}`;
    clientUrl = `${baseUrl}/client/`;
    rootUrl = `${baseUrl}/`;
  }

  // Show/hide preview placeholder
  const hasGame = project.status === 'live' || project.status === 'implementing';
  document.getElementById('preview-placeholder').classList.toggle('hidden', hasGame);

  if (hasGame) {
    // Try multiple locations for index.html
    const tryUrls = [
      `${clientUrl}index.html`,    // client/index.html
      `${baseUrl}/output/index.html`, // output/index.html (common pattern)
      `${rootUrl}index.html`       // root index.html
    ];

    async function findGameUrl() {
      for (const testUrl of tryUrls) {
        try {
          const res = await fetch(testUrl, { method: 'HEAD' });
          if (res.ok) {
            // Return the directory containing index.html
            return testUrl.replace('/index.html', '/');
          }
        } catch (e) {
          // Continue to next URL
        }
      }
      return rootUrl; // Default to root
    }

    findGameUrl().then(gameUrl => {
      document.getElementById('game-url-link').href = gameUrl;
      document.getElementById('game-url-link').textContent = gameUrl;
      document.getElementById('game-iframe').src = gameUrl;
    });
  } else {
    document.getElementById('game-url-link').href = rootUrl;
    document.getElementById('game-url-link').textContent = rootUrl;
  }

  // Load queue
  loadQueue();

  // Connect WebSocket
  connectWebSocket();

  // Add initial system message
  const messagesEl = document.getElementById('chat-messages');
  messagesEl.innerHTML = '';
  addSystemMessage(getWelcomeMessage(project));

  showScreen('studio');

  // Start tracking - this triggers queue processing for any project with queued work
  // Even 'live' projects may have queued items that need processing
  startTrackingAndShowProgress(project.id);

  // Load server status and auto-start for full-stack projects
  serverLogs = []; // Reset logs
  loadServerStatus().then(async () => {
    // Auto-start for imported projects with backend detected
    if (project.custom_path && serverConfig?.detected?.hasBackend) {
      if (serverStatus?.status !== 'running') {
        addSystemMessage('Full-stack project detected. Starting server automatically...');
        await startGameServer();
      }
    }
  });
}

// Start tracking pipeline progress and show engaging updates
async function startTrackingAndShowProgress(projectId) {
  try {
    // Tell server to start tracking (this also reconciles completed pipelines)
    const trackResult = await api(`/projects/${projectId}/track-progress`, { method: 'POST' });

    // If reconciliation happened, refresh queue and update status
    if (trackResult.reconciled) {
      console.log('Pipeline reconciled, refreshing queue...');
      loadQueue();
      if (trackResult.status === 'live') {
        updateProjectStatus('live');
        addSystemMessage('Your game is now live!');
        hideProgress();
        return;
      } else if (trackResult.status === 'implementing') {
        addSystemMessage('Previous work completed! Processing next item...');
        // Continue to show progress for the new work
      }
    }

    // Fetch current progress
    const progress = await api(`/projects/${projectId}/pipeline-progress`);

    if (progress.active && progress.completedStages) {
      showPipelineProgress(progress);
    }
  } catch (err) {
    console.error('Failed to fetch pipeline progress:', err);
  }
}

// Show pipeline progress in an engaging way
function showPipelineProgress(progress) {
  if (!progress.completedStages || progress.completedStages.length === 0) {
    return;
  }

  // Agent descriptions for engaging messages
  const agentDescriptions = {
    'task_planner': 'Planning out the game development approach',
    'lore_architect': 'Crafting the backstory and world history',
    'geography_designer': 'Designing the game world and locations',
    'culture_architect': 'Building cultures, factions, and societies',
    'economy_designer': 'Creating the economic systems and resources',
    'combat_designer': 'Designing combat mechanics and balance',
    'progression_designer': 'Planning player progression and rewards',
    'system_designer': 'Architecting core game systems',
    'api_designer': 'Designing the game\'s API and interfaces',
    'data_modeler': 'Structuring game data and models',
    'code_generator': 'Generating initial game code',
    'design_validator': 'Validating design consistency',
    'technical_validator': 'Checking technical feasibility',
    'gameplay_validator': 'Ensuring gameplay is fun and balanced',
    'balance_analyzer': 'Analyzing game balance',
    'balance_auditor': 'Auditing balance across systems',
    'systems_integrator': 'Integrating all systems together',
    'final_integrator': 'Final integration and polish'
  };

  // Show completed stages summary
  const recentStages = progress.completedStages.slice(-5);

  addSystemMessage(`Pipeline Progress: ${progress.completedCount}/${progress.totalStages} stages complete (${progress.progress}%)`);

  // Show recent completed stages
  recentStages.forEach(stage => {
    const desc = agentDescriptions[stage.agent] || stage.name;
    addStageMessage(stage.agent, desc, true);
  });

  // Show current stage if available
  if (progress.currentStage) {
    const currentDesc = agentDescriptions[progress.currentAgent] || progress.currentStage;
    addStageMessage(progress.currentAgent, currentDesc, false);
    showProgress(`Working: ${currentDesc}`, progress.progress);
  }
}

// Add a stage completion message with styling
function addStageMessage(agent, description, completed) {
  const messagesEl = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message stage-message';

  const icon = completed ? '✓' : '⟳';
  const statusClass = completed ? 'completed' : 'in-progress';

  div.innerHTML = `
    <span class="stage-icon ${statusClass}">${icon}</span>
    <span class="stage-agent">${agent || 'Agent'}</span>
    <span class="stage-desc">${escapeHtml(description)}</span>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function getWelcomeMessage(project) {
  switch (project.status) {
    case 'designing':
      return 'Creating design documents for your game... This usually takes a few minutes.';
    case 'implementing':
      return 'Design complete! Building features now. You can add more requests below.';
    case 'live':
      return 'Your game is live! Try it in the preview. Add features or changes below.';
    default:
      return 'Loading project...';
  }
}

document.getElementById('back-to-dashboard').addEventListener('click', () => {
  disconnectWebSocket();
  currentProject = null;
  showScreen('dashboard');
  loadProjects();
});

document.getElementById('delete-project-studio').addEventListener('click', async () => {
  if (!currentProject) return;
  if (confirm(`Delete "${currentProject.name}"? This cannot be undone.`)) {
    await deleteProject(currentProject.id);
    disconnectWebSocket();
    currentProject = null;
    showScreen('dashboard');
  }
});

// Chat form
document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  // Add user message
  addUserMessage(message);
  input.value = '';

  // Check for server commands first
  const serverCmd = parseServerCommand(message);
  if (serverCmd) {
    const handled = await executeServerCommand(serverCmd);
    if (handled) return;
  }

  // Get pipeline type from selector
  const pipelineTypeSelect = document.getElementById('pipeline-type-select');
  const pipelineType = pipelineTypeSelect?.value || 'feature';

  // Add to queue with pipeline type
  try {
    await api(`/projects/${currentProject.id}/queue`, {
      method: 'POST',
      body: JSON.stringify({ description: message, pipelineType })
    });
    const typeLabel = pipelineType === 'bugfix' ? 'Bug fix' : 'Feature';
    addSystemMessage(`${typeLabel} added to work queue!`);
    loadQueue();
  } catch (err) {
    addSystemMessage('Failed to queue request: ' + err.message);
  }
});

function addUserMessage(text) {
  const messagesEl = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message user';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
  const messagesEl = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message system';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Preview controls
document.getElementById('refresh-preview').addEventListener('click', () => {
  const iframe = document.getElementById('game-iframe');
  iframe.src = iframe.src;
});

document.getElementById('fullscreen-preview').addEventListener('click', () => {
  const iframe = document.getElementById('game-iframe');
  if (iframe.requestFullscreen) {
    iframe.requestFullscreen();
  }
});

// ============================================
// Work Queue
// ============================================

async function loadQueue() {
  if (!currentProject) return;

  try {
    const status = await api(`/projects/${currentProject.id}/queue`);
    renderQueue(status);
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
}

// Mark a work item as completed (for stale/abandoned items)
async function markWorkComplete(itemId) {
  if (!currentProject) return;

  try {
    const result = await api(`/projects/${currentProject.id}/queue/${itemId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status: 'completed' })
    });

    if (result.success) {
      addSystemMessage('Work item marked as complete.');
      loadQueue();

      // Refresh project status if needed
      const { project } = await api(`/projects/${currentProject.id}`);
      if (project.status !== currentProject.status) {
        updateProjectStatus(project.status);
      }
    }
  } catch (err) {
    addSystemMessage('Failed to mark item complete: ' + err.message);
  }
}

function renderQueue({ currentWork, queued, completed }) {
  // Current work
  const currentEl = document.getElementById('current-work');
  if (currentWork) {
    currentEl.innerHTML = `
      <div class="queue-item in-progress">
        ${escapeHtml(currentWork.description)}
        <button class="btn-small mark-complete" data-id="${currentWork.id}" title="Mark as complete (for stale items)">Done</button>
      </div>`;

    // Add click handler for mark complete button
    currentEl.querySelector('.mark-complete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Mark this work item as completed? Use this for stale/abandoned pipelines.')) {
        await markWorkComplete(currentWork.id);
      }
    });
  } else {
    currentEl.innerHTML = '<div class="empty-queue">Nothing running</div>';
  }

  // Queued items
  const queuedEl = document.getElementById('queued-items');
  if (queued && queued.length > 0) {
    queuedEl.innerHTML = queued.map(item => `
      <div class="queue-item" data-id="${item.id}">${escapeHtml(item.description)}</div>
    `).join('');
  } else {
    queuedEl.innerHTML = '<div class="empty-queue">No items queued</div>';
  }

  // Completed items (last 5)
  const completedEl = document.getElementById('completed-items');
  if (completed && completed.length > 0) {
    completedEl.innerHTML = completed.slice(0, 5).map(item => `
      <div class="queue-item completed">${escapeHtml(item.description)}</div>
    `).join('');
  } else {
    completedEl.innerHTML = '<div class="empty-queue">No completed items</div>';
  }

  // Also load stories
  loadStories();
}

// Load pipeline stories for the current project
async function loadStories() {
  if (!currentProject) return;

  try {
    const { stories } = await api(`/projects/${currentProject.id}/stories`);
    renderStories(stories);
  } catch (err) {
    console.error('Failed to load stories:', err);
  }
}

function renderStories(stories) {
  const storiesEl = document.getElementById('pipeline-stories');

  if (stories && stories.length > 0) {
    storiesEl.innerHTML = stories.map(story => {
      const date = new Date(story.timestamp.replace('T', ' ').replace(/-/g, (m, i) => i > 6 ? ':' : '-'));
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const icon = story.type === 'design' ? '📋' : '🔧';
      const shortDesc = story.description.length > 40 ? story.description.substring(0, 40) + '...' : story.description;

      return `
        <a href="${story.url}" target="_blank" class="story-item queue-item">
          <span class="story-icon">${icon}</span>
          <div class="story-info">
            <div class="story-desc">${escapeHtml(shortDesc)}</div>
            <div class="story-time">${timeStr}</div>
          </div>
        </a>
      `;
    }).join('');
  } else {
    storiesEl.innerHTML = '<div class="empty-queue">No stories yet</div>';
  }
}

// ============================================
// Server Management
// ============================================

async function loadServerStatus() {
  if (!currentProject) return;

  try {
    const status = await api(`/projects/${currentProject.id}/server/status`);
    serverStatus = status;
    serverConfig = status.config;

    // Show or hide server panel based on backend detection
    const hasBackend = serverConfig?.detected?.hasBackend;
    const serverPanel = document.getElementById('server-panel');

    if (hasBackend || currentProject.custom_path) {
      serverPanel.classList.remove('hidden');
      renderServerPanel();
    } else {
      serverPanel.classList.add('hidden');
    }

    return status;
  } catch (err) {
    console.error('Failed to load server status:', err);
  }
}

async function analyzeServerConfig() {
  if (!currentProject) return;

  try {
    addSystemMessage('Analyzing project configuration...');
    const { config } = await api(`/projects/${currentProject.id}/server/analyze`, {
      method: 'POST'
    });
    serverConfig = config;
    renderServerPanel();

    if (config.detected?.hasBackend) {
      addSystemMessage(`Detected: ${config.detected.framework || 'Node.js'} server, port ${config.detected.port}`);
    } else {
      addSystemMessage('No backend server detected in this project.');
    }
  } catch (err) {
    addSystemMessage('Failed to analyze project: ' + err.message);
  }
}

async function startGameServer() {
  if (!currentProject) return;

  try {
    updateServerUI('starting');
    addSystemMessage('Starting server...');

    const result = await api(`/projects/${currentProject.id}/server/start`, {
      method: 'POST'
    });

    serverStatus = { ...serverStatus, ...result, status: 'running' };
    renderServerPanel();
    addSystemMessage(`Server started on ${result.url}`);
  } catch (err) {
    updateServerUI('error');
    addSystemMessage('Failed to start server: ' + err.message);
  }
}

async function stopGameServer() {
  if (!currentProject) return;

  try {
    updateServerUI('stopping');
    addSystemMessage('Stopping server...');

    await api(`/projects/${currentProject.id}/server/stop`, {
      method: 'POST'
    });

    serverStatus = { ...serverStatus, status: 'stopped', pid: null, url: null };
    renderServerPanel();
    addSystemMessage('Server stopped.');
  } catch (err) {
    addSystemMessage('Failed to stop server: ' + err.message);
  }
}

async function restartGameServer() {
  if (!currentProject) return;

  try {
    updateServerUI('stopping');
    addSystemMessage('Restarting server...');

    const result = await api(`/projects/${currentProject.id}/server/restart`, {
      method: 'POST'
    });

    serverStatus = { ...serverStatus, ...result, status: 'running' };
    renderServerPanel();
    addSystemMessage(`Server restarted on ${result.url}`);
  } catch (err) {
    updateServerUI('error');
    addSystemMessage('Failed to restart server: ' + err.message);
  }
}

async function runNpmScript(scriptName) {
  if (!currentProject || !scriptName) return;

  try {
    addSystemMessage(`Running npm run ${scriptName}...`);
    const result = await api(`/projects/${currentProject.id}/server/run-script`, {
      method: 'POST',
      body: JSON.stringify({ script: scriptName })
    });

    if (result.success) {
      addSystemMessage(`Script '${scriptName}' completed successfully.`);
    }
  } catch (err) {
    addSystemMessage(`Script '${scriptName}' failed: ${err.message}`);
  }
}

function renderServerPanel() {
  // Update status display
  const statusDot = document.getElementById('server-status-dot');
  const statusText = document.getElementById('server-status-text');
  const uptimeEl = document.getElementById('server-uptime');
  const urlContainer = document.getElementById('server-url-container');
  const urlEl = document.getElementById('server-url');
  const startBtn = document.getElementById('server-start-btn');
  const stopBtn = document.getElementById('server-stop-btn');
  const restartBtn = document.getElementById('server-restart-btn');
  const scriptsContainer = document.getElementById('server-scripts-container');
  const scriptSelect = document.getElementById('server-script-select');
  const runScriptBtn = document.getElementById('run-script-btn');

  const status = serverStatus?.status || 'stopped';

  // Update status dot
  statusDot.className = 'status-dot ' + status;

  // Update status text
  const statusLabels = {
    'running': 'Running',
    'starting': 'Starting...',
    'stopping': 'Stopping...',
    'stopped': 'Stopped',
    'error': 'Error'
  };
  statusText.textContent = statusLabels[status] || status;

  // Update uptime
  if (serverStatus?.uptime && status === 'running') {
    const mins = Math.floor(serverStatus.uptime / 60);
    const secs = serverStatus.uptime % 60;
    uptimeEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  } else {
    uptimeEl.textContent = '';
  }

  // Update URL
  if (serverStatus?.url && status === 'running') {
    urlContainer.classList.remove('hidden');
    urlEl.href = serverStatus.url;
    urlEl.textContent = serverStatus.url;
  } else {
    urlContainer.classList.add('hidden');
  }

  // Update buttons
  const isRunning = status === 'running';
  const isTransitioning = status === 'starting' || status === 'stopping';

  startBtn.disabled = isRunning || isTransitioning;
  stopBtn.disabled = !isRunning || isTransitioning;
  restartBtn.disabled = !isRunning || isTransitioning;

  // Update scripts dropdown
  if (serverConfig?.detected?.scripts && serverConfig.detected.scripts.length > 0) {
    scriptsContainer.classList.remove('hidden');
    scriptSelect.innerHTML = '<option value="">Run script...</option>' +
      serverConfig.detected.scripts.map(s => `<option value="${s}">${s}</option>`).join('');
    runScriptBtn.disabled = false;
  } else {
    scriptsContainer.classList.add('hidden');
  }

  // Update logs display
  renderServerLogs();
}

function updateServerUI(status) {
  if (serverStatus) {
    serverStatus.status = status;
  } else {
    serverStatus = { status };
  }
  renderServerPanel();
}

function renderServerLogs() {
  const logsContent = document.getElementById('server-logs-content');

  if (serverLogs.length === 0) {
    logsContent.innerHTML = '<div class="log-placeholder">Server logs will appear here...</div>';
    return;
  }

  logsContent.innerHTML = serverLogs.slice(-100).map(log => {
    const stream = log.stream || 'stdout';
    return `<div class="log-line ${stream}">${escapeHtml(log.data)}</div>`;
  }).join('');

  // Auto-scroll to bottom
  logsContent.scrollTop = logsContent.scrollHeight;
}

function appendServerLog(stream, data) {
  serverLogs.push({ stream, data, timestamp: new Date().toISOString() });
  // Keep only last 500 logs
  if (serverLogs.length > 500) {
    serverLogs = serverLogs.slice(-500);
  }
  renderServerLogs();
}

function clearServerLogs() {
  serverLogs = [];
  renderServerLogs();
}

// Server control event listeners
document.getElementById('server-start-btn')?.addEventListener('click', startGameServer);
document.getElementById('server-stop-btn')?.addEventListener('click', stopGameServer);
document.getElementById('server-restart-btn')?.addEventListener('click', restartGameServer);
document.getElementById('analyze-server-btn')?.addEventListener('click', analyzeServerConfig);
document.getElementById('clear-logs-btn')?.addEventListener('click', clearServerLogs);

document.getElementById('server-script-select')?.addEventListener('change', (e) => {
  const runBtn = document.getElementById('run-script-btn');
  runBtn.disabled = !e.target.value;
});

document.getElementById('run-script-btn')?.addEventListener('click', () => {
  const script = document.getElementById('server-script-select').value;
  if (script) {
    runNpmScript(script);
    document.getElementById('server-script-select').value = '';
    document.getElementById('run-script-btn').disabled = true;
  }
});

// Parse AI chat commands for server management
function parseServerCommand(message) {
  const lowerMsg = message.toLowerCase().trim();

  if (lowerMsg.includes('start') && (lowerMsg.includes('server') || lowerMsg.includes('backend'))) {
    return { action: 'start' };
  }
  if (lowerMsg.includes('stop') && (lowerMsg.includes('server') || lowerMsg.includes('backend'))) {
    return { action: 'stop' };
  }
  if (lowerMsg.includes('restart') && (lowerMsg.includes('server') || lowerMsg.includes('backend'))) {
    return { action: 'restart' };
  }
  if (lowerMsg.includes('run') && lowerMsg.includes('migration')) {
    return { action: 'script', script: 'migrate' };
  }
  if (lowerMsg.includes('run') && lowerMsg.includes('seed')) {
    return { action: 'script', script: 'seed' };
  }
  if (lowerMsg.match(/run\s+([\w:-]+)/)) {
    const match = lowerMsg.match(/run\s+([\w:-]+)/);
    return { action: 'script', script: match[1] };
  }
  if (lowerMsg.includes('check') && lowerMsg.includes('log')) {
    return { action: 'logs' };
  }

  return null;
}

// Execute a parsed server command
async function executeServerCommand(cmd) {
  switch (cmd.action) {
    case 'start':
      await startGameServer();
      return true;
    case 'stop':
      await stopGameServer();
      return true;
    case 'restart':
      await restartGameServer();
      return true;
    case 'script':
      await runNpmScript(cmd.script);
      return true;
    case 'logs':
      // Scroll to logs panel
      document.getElementById('server-logs-content')?.scrollIntoView({ behavior: 'smooth' });
      addSystemMessage('Showing server logs...');
      return true;
    default:
      return false;
  }
}

// ============================================
// WebSocket
// ============================================

function connectWebSocket() {
  if (ws) {
    ws.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.addEventListener('open', () => {
    console.log('WebSocket connected');
    if (currentProject) {
      ws.send(JSON.stringify({ type: 'subscribe', projectId: currentProject.id }));
    }
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.addEventListener('close', () => {
    console.log('WebSocket disconnected');
    // Reconnect after delay
    setTimeout(() => {
      if (currentProject) connectWebSocket();
    }, 3000);
  });
}

function disconnectWebSocket() {
  if (ws) {
    ws.send(JSON.stringify({ type: 'unsubscribe' }));
    ws.close();
    ws = null;
  }
}

function handleWebSocketMessage(msg) {
  console.log('WS message:', msg);

  switch (msg.type) {
    case 'design-started':
      showProgress('Starting design phase...', 5);
      addSystemMessage('Creating design documents for your game...');
      break;

    case 'design-completed':
      showProgress('Design complete!', 100);
      updateProjectStatus('implementing');
      addSystemMessage('Design documents created! Starting implementation...');
      break;

    case 'work-started':
      showProgress(`Building: ${msg.item?.description || 'feature'}...`, 10);
      loadQueue();
      break;

    case 'work-completed':
      hideProgress();
      addSystemMessage(`Completed: ${msg.item?.description || 'feature'}`);
      loadQueue();
      break;

    case 'game-updated':
      addSystemMessage('Game updated! Refreshing preview...');
      document.getElementById('game-iframe').src = document.getElementById('game-iframe').src;
      document.getElementById('preview-placeholder').classList.add('hidden');
      break;

    case 'project-live':
      updateProjectStatus('live');
      addSystemMessage('Your game is now live!');
      hideProgress();
      break;

    case 'pipeline-progress':
      // Real-time progress from pipeline polling
      handlePipelineProgress(msg);
      break;

    case 'agent-output':
      // Agent completed with output (commentator message)
      handleAgentOutput(msg);
      break;

    case 'pipeline-commentary':
      // High-level AI commentary about what's happening
      handlePipelineCommentary(msg);
      break;

    case 'queue-updated':
      loadQueue();
      break;

    case 'design-failed':
    case 'work-failed':
      hideProgress();
      addSystemMessage(`Error: ${msg.error || 'Something went wrong'}`);
      updateProjectStatus('error');
      break;

    // Server management events
    case 'server-started':
      serverStatus = { ...serverStatus, status: 'running', pid: msg.pid, port: msg.port, url: msg.url };
      renderServerPanel();
      addSystemMessage(`Server started on ${msg.url}`);
      clearServerLogs();
      break;

    case 'server-stopped':
      serverStatus = { ...serverStatus, status: 'stopped', pid: null, url: null };
      renderServerPanel();
      addSystemMessage(`Server stopped (exit code: ${msg.exitCode})`);
      break;

    case 'server-output':
      appendServerLog(msg.stream, msg.data);
      break;

    case 'server-error':
      serverStatus = { ...serverStatus, status: 'error' };
      renderServerPanel();
      addSystemMessage(`Server error: ${msg.error}`);
      break;

    case 'script-output':
      if (msg.status === 'running') {
        appendServerLog('info', msg.output);
      } else if (msg.status === 'completed') {
        addSystemMessage(`Script completed successfully.`);
      } else if (msg.status === 'failed') {
        addSystemMessage(`Script failed with exit code ${msg.exitCode}`);
      }
      break;
  }
}

// Handle agent output (commentator messages)
function handleAgentOutput(msg) {
  if (!msg.output) return;

  // Format agent name nicely
  const agentName = msg.agent?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Agent';

  // Mark any in-progress stage messages as complete
  document.querySelectorAll('.stage-message .stage-icon.in-progress').forEach(icon => {
    icon.classList.remove('in-progress');
    icon.classList.add('completed');
    icon.textContent = '✓';
  });

  // Create a collapsible commentator message
  addAgentMessage(agentName, msg.output, msg.completedCount, msg.totalStages);
}

// Add an agent commentator message to chat
function addAgentMessage(agentName, output, completed, total) {
  const messagesEl = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message agent-message';

  // Truncate output for initial display, show full on click
  const shortOutput = output.length > 300 ? output.substring(0, 300) + '...' : output;
  const hasMore = output.length > 300;

  div.innerHTML = `
    <div class="agent-header">
      <span class="agent-icon">🤖</span>
      <span class="agent-name">${escapeHtml(agentName)}</span>
      <span class="agent-progress">Step ${completed}</span>
    </div>
    <div class="agent-content ${hasMore ? 'truncated' : ''}">${escapeHtml(shortOutput)}</div>
    ${hasMore ? '<button class="expand-btn">Show full output</button>' : ''}
  `;

  // Add expand functionality
  if (hasMore) {
    const btn = div.querySelector('.expand-btn');
    const content = div.querySelector('.agent-content');
    let expanded = false;
    btn.addEventListener('click', () => {
      expanded = !expanded;
      content.textContent = expanded ? output : shortOutput;
      content.classList.toggle('truncated', !expanded);
      content.classList.toggle('expanded', expanded);
      btn.textContent = expanded ? 'Show less' : 'Show full output';
    });
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Handle pipeline commentary (high-level AI updates)
function handlePipelineCommentary(msg) {
  if (!msg.message) return;

  const messagesEl = document.getElementById('chat-messages');
  const div = document.createElement('div');

  // Map style to CSS class and emoji
  const styleMap = {
    'EXCITED': { class: 'commentary-excited', emoji: '✨' },
    'FOCUSED': { class: 'commentary-focused', emoji: '🔍' },
    'CONCERNED': { class: 'commentary-concerned', emoji: '⚠️' },
    'TRIUMPHANT': { class: 'commentary-triumphant', emoji: '🎉' },
    'CRITICAL': { class: 'commentary-critical', emoji: '❌' }
  };

  const styleInfo = styleMap[msg.style] || { class: 'commentary-focused', emoji: '💭' };

  div.className = `chat-message commentary-message ${styleInfo.class}`;
  div.innerHTML = `
    <div class="commentary-content">
      <span class="commentary-emoji">${styleInfo.emoji}</span>
      <span class="commentary-text">${escapeHtml(msg.message)}</span>
    </div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Handle real-time pipeline progress updates
function handlePipelineProgress(msg) {
  const agentDescriptions = {
    'task_planner': 'Planning the game development approach',
    'lore_architect': 'Crafting backstory and world history',
    'geography_designer': 'Designing the game world and locations',
    'culture_architect': 'Building cultures and societies',
    'economy_designer': 'Creating economic systems',
    'combat_designer': 'Designing combat mechanics',
    'progression_designer': 'Planning player progression',
    'system_designer': 'Architecting core systems',
    'api_designer': 'Designing APIs and interfaces',
    'data_modeler': 'Structuring game data',
    'code_generator': 'Generating game code',
    'design_validator': 'Validating design consistency',
    'technical_validator': 'Checking technical feasibility',
    'gameplay_validator': 'Ensuring fun gameplay',
    'balance_analyzer': 'Analyzing game balance',
    'balance_auditor': 'Auditing balance across systems',
    'systems_integrator': 'Integrating all systems',
    'final_integrator': 'Final integration and polish'
  };

  // Update progress bar
  if (msg.progress !== undefined) {
    const desc = agentDescriptions[msg.currentStage] || msg.currentStage || 'Working...';
    showProgress(`${desc} (${msg.progress}%)`, msg.progress);
  }

  // Show stage as a message if it's a new stage
  if (msg.currentStage && msg.currentStage !== lastShownStage) {
    lastShownStage = msg.currentStage;
    const desc = agentDescriptions[msg.currentStage] || msg.currentStage;
    addStageMessage(msg.currentStage, desc, false);
  }
}

// Update the last system message instead of adding new ones (for progress)
function updateLastSystemMessage(text) {
  const messagesEl = document.getElementById('chat-messages');
  const lastMsg = messagesEl.querySelector('.chat-message.system:last-child');
  if (lastMsg && lastMsg.dataset.progress) {
    lastMsg.textContent = text;
  } else {
    const div = document.createElement('div');
    div.className = 'chat-message system';
    div.dataset.progress = 'true';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function showProgress(text, percent) {
  const indicator = document.getElementById('progress-indicator');
  indicator.classList.remove('hidden');
  indicator.querySelector('.progress-fill').style.width = `${percent}%`;
  indicator.querySelector('.progress-text').textContent = text;
}

function hideProgress() {
  document.getElementById('progress-indicator').classList.add('hidden');
}

function calculateProgress(msg) {
  // Simple progress calculation based on stage completion
  if (msg.completedStagesCount && msg.totalStages) {
    return Math.round((msg.completedStagesCount / msg.totalStages) * 100);
  }
  return 50;
}

function updateProjectStatus(status) {
  if (currentProject) {
    currentProject.status = status;
    document.getElementById('project-status').textContent = status;
    document.getElementById('project-status').className = `status-badge ${status}`;
  }
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Initialize
// ============================================

checkAuth();
