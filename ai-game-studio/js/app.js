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

// Check for incomplete pipelines that can be resumed
async function checkIncompletePipelines() {
  try {
    const result = await api('/pipelines/incomplete');

    if (result.found) {
      console.log('Found incomplete pipeline:', result);

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
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.game_idea)}</p>
      <div class="meta">
        <span class="status-badge ${p.status}">${p.status}</span>
        <span class="game-type">${p.game_type === '3d' ? '3D' : '2D'}</span>
      </div>
    </div>
  `).join('');

  // Click handlers
  list.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      const project = projects.find(p => p.id === card.dataset.id);
      if (project) openStudio(project);
    });
  });
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

  try {
    const { project } = await api('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, gameType, gameIdea })
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

// ============================================
// Studio
// ============================================

function openStudio(project) {
  currentProject = project;

  // Update UI
  document.getElementById('project-name').textContent = project.name;
  document.getElementById('project-status').textContent = project.status;
  document.getElementById('project-status').className = `status-badge ${project.status}`;

  // Set game URL
  const gameUrl = `/games/${currentUser.id}/${project.id}/`;
  document.getElementById('game-url-link').href = gameUrl;
  document.getElementById('game-url-link').textContent = gameUrl;

  // Show/hide preview placeholder
  const hasGame = project.status === 'live' || project.status === 'implementing';
  document.getElementById('preview-placeholder').classList.toggle('hidden', hasGame);
  if (hasGame) {
    document.getElementById('game-iframe').src = gameUrl;
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

// Chat form
document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  // Add user message
  addUserMessage(message);
  input.value = '';

  // Add to queue
  try {
    await api(`/projects/${currentProject.id}/queue`, {
      method: 'POST',
      body: JSON.stringify({ description: message })
    });
    addSystemMessage('Added to work queue!');
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

function renderQueue({ currentWork, queued, completed }) {
  // Current work
  const currentEl = document.getElementById('current-work');
  if (currentWork) {
    currentEl.innerHTML = `<div class="queue-item in-progress">${escapeHtml(currentWork.description)}</div>`;
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
      if (msg.message) {
        showProgress(msg.message, msg.progress || 50);
      }
      if (msg.currentStage && msg.completedCount !== undefined) {
        // Update chat with stage completion
        const stageMsg = `Stage ${msg.completedCount}/${msg.totalStages}: ${msg.currentStage}`;
        updateLastSystemMessage(stageMsg);
      }
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
