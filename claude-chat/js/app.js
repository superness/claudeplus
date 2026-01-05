/**
 * Claude Chat - Frontend Application
 * Real-time chat interface with Claude Code CLI via proxy
 * Supports multiple tabs with independent conversations and directories
 */

const app = (function() {
  // WebSocket
  let ws = null;

  // Tab management
  let tabs = [];
  let activeTabId = null;
  let tabIdCounter = 0;

  // Typing animation state (shared, only applies to active tab display)
  const CHARS_PER_TICK = 8;
  const TYPING_DELAY = 10;
  let typingTimer = null;

  // DOM elements (cached on init)
  let tabList, chatMessages, chatInput, sendBtn, abortBtn, statusDot, statusText, emptyState;

  // Hats state
  let availableHats = [];

  // Pipelines state
  let availablePipelines = [];

  // Create a new tab state object
  function createTabState(directory = '/mnt/c/github/claudeplus', title = null) {
    const id = 'tab-' + (++tabIdCounter);
    const dirName = directory.split('/').pop() || directory;
    return {
      id,
      title: title || dirName,
      directory,
      conversationId: null,
      isProcessing: false,
      messages: [], // {type: 'user'|'assistant'|'system'|'error', content: string}
      // Usage tracking per tab
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      messageCount: 0,
      // Activity tracking per tab
      toolLog: [],
      lastToolState: '',
      lastTodoState: [],
      todos: [],
      streamText: '',
      typingQueue: '',
      lastTotalLength: 0,
      thinkingText: '',
      // Hats for this tab (supports multiple)
      hatIds: [],
      // Pipeline to use for this tab (null = direct chat, string = pipeline id)
      pipelineId: null
    };
  }

  // Get current active tab
  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId);
  }

  // Initialize
  function init() {
    tabList = document.getElementById('tabList');
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendBtn = document.getElementById('sendBtn');
    abortBtn = document.getElementById('abortBtn');
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    emptyState = document.getElementById('emptyState');

    // Load saved tabs or create default
    loadTabs();

    // Set up event listeners
    setupEventListeners();

    // Connect to proxy
    connectWebSocket();
  }

  function setupEventListeners() {
    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });

    // Enter to send, Shift+Enter for newline
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function loadTabs() {
    try {
      const saved = localStorage.getItem('claude-chat-tabs');
      if (saved) {
        const data = JSON.parse(saved);
        tabs = data.tabs || [];
        activeTabId = data.activeTabId;
        tabIdCounter = data.tabIdCounter || 0;

        // Ensure we have at least one tab
        if (tabs.length === 0) {
          const defaultDir = localStorage.getItem('claude-chat-dir') || '/mnt/c/github/claudeplus';
          createTab(defaultDir);
        } else {
          // Re-render tabs
          renderTabs();
          // Switch to active tab
          if (!tabs.find(t => t.id === activeTabId)) {
            activeTabId = tabs[0].id;
          }
          switchToTab(activeTabId);
        }
      } else {
        // No saved tabs, create default
        const defaultDir = localStorage.getItem('claude-chat-dir') || '/mnt/c/github/claudeplus';
        createTab(defaultDir);
      }
    } catch (e) {
      console.error('Failed to load tabs:', e);
      createTab('/mnt/c/github/claudeplus');
    }
  }

  function saveTabs() {
    try {
      localStorage.setItem('claude-chat-tabs', JSON.stringify({
        tabs,
        activeTabId,
        tabIdCounter
      }));
    } catch (e) {
      console.error('Failed to save tabs:', e);
    }
  }

  function createTab(directory = '/mnt/c/github/claudeplus', title = null) {
    const tab = createTabState(directory, title);
    tabs.push(tab);
    activeTabId = tab.id;
    renderTabs();
    switchToTab(tab.id);
    saveTabs();

    // Initialize with proxy if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      initTabWithProxy(tab);
    }

    return tab;
  }

  function initTabWithProxy(tab) {
    ws.send(JSON.stringify({
      type: 'claude-chat-init',
      workingDirectory: tab.directory,
      tabId: tab.id
    }));
  }

  function closeTab(tabId, event) {
    if (event) {
      event.stopPropagation();
    }

    // Don't close last tab
    if (tabs.length <= 1) {
      return;
    }

    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    tabs.splice(index, 1);

    // If closing active tab, switch to adjacent tab
    if (activeTabId === tabId) {
      const newIndex = Math.min(index, tabs.length - 1);
      activeTabId = tabs[newIndex].id;
      switchToTab(activeTabId);
    }

    renderTabs();
    saveTabs();
  }

  function unlockTab(tabId, event) {
    if (event) {
      event.stopPropagation();
    }

    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Force unlock the tab
    finishProcessing(tab);
    addMessage(tab, 'system', 'Tab manually unlocked.');
    renderTabs();
  }

  function switchToTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    activeTabId = tabId;

    // Clear typing timer when switching
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }

    // Update directory input
    document.getElementById('workingDir').value = tab.directory;

    // Re-render messages
    renderMessages(tab);

    // Update activity panel
    updateActivityPanel(tab);

    // Update hat selector for this tab
    renderHatSelector();

    // Update pipeline selector for this tab
    renderPipelineSelector();

    // Update tabs UI
    renderTabs();
    saveTabs();
  }

  function renderTabs() {
    tabList.innerHTML = tabs.map(tab => {
      const isActive = tab.id === activeTabId;
      const dirShort = tab.directory.split('/').pop() || tab.directory;
      const processingIndicator = tab.isProcessing
        ? `<span class="tab-processing" onclick="app.unlockTab('${tab.id}', event)" title="Click to unlock tab">⟳</span>`
        : '';
      return `
        <div class="tab ${isActive ? 'active' : ''} ${tab.isProcessing ? 'processing' : ''}" onclick="app.switchToTab('${tab.id}')">
          ${processingIndicator}
          <span class="tab-title" ondblclick="app.startRenameTab('${tab.id}', event)">${escapeHtml(tab.title)}</span>
          <span class="tab-close" onclick="app.closeTab('${tab.id}', event)">&times;</span>
        </div>
      `;
    }).join('');
  }

  function startRenameTab(tabId, event) {
    event.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const tabEl = event.target.closest('.tab');
    const titleEl = tabEl.querySelector('.tab-title');

    // Replace with input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-title-input';
    input.value = tab.title;

    input.onblur = () => finishRenameTab(tabId, input.value);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = tab.title;
        input.blur();
      }
    };

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  function finishRenameTab(tabId, newTitle) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && newTitle.trim()) {
      tab.title = newTitle.trim();
      saveTabs();
    }
    renderTabs();
  }

  function renderMessages(tab) {
    // Hide empty state if messages exist
    if (tab.messages.length > 0) {
      emptyState.style.display = 'none';
    } else {
      emptyState.style.display = 'flex';
    }

    chatMessages.innerHTML = '';

    // Re-add empty state
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.id = 'emptyState';
    emptyDiv.innerHTML = `
      <div class="icon">&#128172;</div>
      <h3>Start a conversation</h3>
      <p>Ask Claude about your codebase, request changes, or get help with development tasks.</p>
    `;
    emptyDiv.style.display = tab.messages.length > 0 ? 'none' : 'flex';
    chatMessages.appendChild(emptyDiv);
    emptyState = emptyDiv;

    // Render messages
    tab.messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'message ' + msg.type;
      if (msg.type === 'assistant') {
        div.innerHTML = renderMarkdown(msg.content);

        // Add reflection subtext if present in metadata
        if (msg.metadata?.reflection?.actionTaken) {
          const reflectionDiv = document.createElement('div');
          reflectionDiv.className = 'message-reflection';
          reflectionDiv.innerHTML = `<span class="reflection-icon">💭</span> <span class="reflection-text">${escapeHtml(msg.metadata.reflection.actionTaken)}</span>`;
          div.appendChild(reflectionDiv);
        }
      } else {
        div.textContent = msg.content;
      }
      chatMessages.appendChild(div);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update processing state
    updateProcessingUI(tab);
  }

  function updateProcessingUI(tab) {
    if (tab.isProcessing) {
      sendBtn.disabled = true;
      chatInput.disabled = true;
      abortBtn.style.display = 'inline-block';
    } else {
      sendBtn.disabled = false;
      chatInput.disabled = false;
      abortBtn.style.display = 'none';
    }
  }

  function updateActivityPanel(tab) {
    // Update usage
    document.getElementById('totalCost').textContent = '$' + tab.totalCost.toFixed(4);
    document.getElementById('inputTokens').textContent = formatNumber(tab.totalInputTokens);
    document.getElementById('outputTokens').textContent = formatNumber(tab.totalOutputTokens);
    document.getElementById('messageCount').textContent = tab.messageCount;

    // Update tool list
    updateToolList(tab);

    // Update todo list
    updateTodoList(tab.todos);

    // Update thinking
    const thinkingPanel = document.getElementById('thinkingPanel');
    if (tab.thinkingText) {
      thinkingPanel.classList.add('visible');
      thinkingPanel.textContent = tab.thinkingText.slice(-300);
    } else {
      thinkingPanel.classList.remove('visible');
    }

    // Update stream panel
    const streamPanel = document.getElementById('streamPanel');
    const streamContent = document.getElementById('streamContent');
    if (tab.streamText) {
      streamPanel.classList.add('visible');
      streamContent.innerHTML = renderMarkdown(tab.streamText);
    } else {
      streamPanel.classList.remove('visible');
      streamContent.innerHTML = '';
    }

    // Update agent status
    if (tab.isProcessing) {
      updateAgentStatus('Working...');
    } else {
      updateAgentStatus('Idle');
    }
  }

  function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';

      // Initialize all tabs with proxy
      tabs.forEach(tab => {
        initTabWithProxy(tab);
      });

      // Load available hats
      loadHats();

      // Load available pipelines
      loadPipelines();
    };

    ws.onclose = () => {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Disconnected';

      // Reconnect after delay
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };
  }

  function handleMessage(msg) {
    console.log('Received:', msg.type, msg);

    // Determine which tab this message is for
    let tab = null;
    if (msg.tabId) {
      tab = tabs.find(t => t.id === msg.tabId);
    } else if (msg.conversationId) {
      tab = tabs.find(t => t.conversationId === msg.conversationId);
    }

    // Fall back to active tab if no match
    if (!tab) {
      tab = getActiveTab();
    }

    if (!tab) return;

    switch (msg.type) {
      case 'claude-chat-init-ack':
        tab.conversationId = msg.conversationId;
        addMessage(tab, 'system', 'Connected to Claude. Working directory: ' + tab.directory);
        break;

      case 'assistant-message':
        finishProcessing(tab);
        addMessage(tab, 'assistant', msg.content, { reflection: msg.reflection });
        break;

      case 'assistant-message-stream':
        handleTextStream(tab, msg);
        break;

      case 'agent-stream':
        handleAgentStream(tab, msg);
        break;

      case 'ai-usage':
        handleUsage(tab, msg);
        break;

      case 'error':
        finishProcessing(tab);
        addMessage(tab, 'error', msg.message || msg.error || 'An error occurred');
        break;

      case 'claude-aborted':
        finishProcessing(tab);
        addMessage(tab, 'system', 'Request aborted.');
        break;

      // Hat message handlers (these don't need a tab context)
      case 'hats-list':
        availableHats = msg.hats || [];
        renderHatSelector();
        break;

      case 'hat-saved':
        if (msg.success) {
          loadHats(); // Reload hats list
          closeHatEditor();
        }
        break;

      case 'hat-deleted':
        if (msg.success) {
          loadHats(); // Reload hats list
        }
        break;

      case 'hat-data':
        if (msg.hat) {
          openHatEditor(msg.hat);
        }
        break;

      // Pipeline message handlers
      case 'templates-list':
        availablePipelines = msg.templates || [];
        renderPipelineSelector();
        break;

      // Pipeline execution events (from standard pipeline executor)
      case 'pipeline-started':
        if (tab) {
          addMessage(tab, 'system', `Pipeline started: ${msg.pipelineName} (${msg.totalStages} stages)`);
          // Store pipeline info on tab for tracking
          tab.activePipeline = {
            id: msg.pipelineId,
            name: msg.pipelineName,
            stages: msg.stages || [],
            currentStage: 0
          };
        }
        break;

      case 'pipeline-status':
        if (tab && msg.content) {
          const content = msg.content;
          // Update agent status display
          if (content.type === 'stage-start') {
            updateAgentStatus(`${content.agent}: ${content.message}`);
          } else if (content.type === 'stage-complete') {
            updateAgentStatus(`${content.agent}: Complete`);
          }
        }
        break;

      case 'pipeline-stage-update':
        if (tab) {
          const statusText = msg.status === 'in-progress' ? 'Running' : msg.status;
          updateAgentStatus(`Stage: ${msg.stageName} (${statusText})`);
        }
        break;

      case 'infographic-ready':
        if (tab && msg.infographicPath) {
          addMessage(tab, 'system', `Pipeline infographic available: ${msg.infographicPath}`);
        }
        break;

      case 'pipeline-complete':
        if (tab) {
          finishProcessing(tab);
          if (msg.content) {
            addMessage(tab, 'assistant', msg.content);
          }
          delete tab.activePipeline;
        }
        break;
    }
  }

  // Pipeline Management Functions
  function loadPipelines() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get-templates' }));
    }
  }

  function setPipeline(pipelineId) {
    const tab = getActiveTab();
    if (!tab) return;

    const oldPipeline = tab.pipelineId;
    tab.pipelineId = pipelineId || null;

    // Log the change
    if (pipelineId) {
      const pipeline = availablePipelines.find(p => p.id === pipelineId);
      addMessage(tab, 'system', `Switched to pipeline: ${pipeline?.name || pipelineId}`);
    } else if (oldPipeline) {
      addMessage(tab, 'system', 'Switched to Direct Chat mode');
    }

    saveTabs();
    renderPipelineSelector();
  }

  function renderPipelineSelector() {
    const select = document.getElementById('pipelineSelect');
    if (!select) return;

    const tab = getActiveTab();
    const currentPipelineId = tab?.pipelineId || '';

    // Filter to only show 'chat' category pipelines for the selector
    // But also show the currently selected pipeline if it exists
    const chatPipelines = availablePipelines.filter(p =>
      p.category === 'chat' || p.id === currentPipelineId
    );

    // Build options
    let html = '<option value="">Direct Chat</option>';
    chatPipelines.forEach(pipeline => {
      const selected = pipeline.id === currentPipelineId ? 'selected' : '';
      html += `<option value="${pipeline.id}" ${selected}>${pipeline.name}</option>`;
    });

    // If current pipeline not in list (different category), add it
    if (currentPipelineId && !chatPipelines.find(p => p.id === currentPipelineId)) {
      const pipeline = availablePipelines.find(p => p.id === currentPipelineId);
      if (pipeline) {
        html += `<option value="${pipeline.id}" selected>${pipeline.name}</option>`;
      }
    }

    select.innerHTML = html;
  }

  // Hat Management Functions
  function loadHats() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get-hats' }));
    }
  }

  function selectHat(hatId) {
    const tab = getActiveTab();
    if (!tab) return;

    // Ensure hatIds is an array
    if (!Array.isArray(tab.hatIds)) {
      tab.hatIds = [];
    }

    // Toggle the hat
    const index = tab.hatIds.indexOf(hatId);
    if (index === -1) {
      // Add hat
      tab.hatIds.push(hatId);
      const hat = availableHats.find(h => h.id === hatId);
      if (hat && !hat.isDefault) {
        addMessage(tab, 'system', `Added "${hat.name}" hat`);
      }
    } else {
      // Remove hat
      tab.hatIds.splice(index, 1);
      const hat = availableHats.find(h => h.id === hatId);
      if (hat) {
        addMessage(tab, 'system', `Removed "${hat.name}" hat`);
      }
    }

    saveTabs();
    renderHatSelector();
  }

  function renderHatSelector() {
    const selector = document.getElementById('hatSelector');
    if (!selector) return;

    const tab = getActiveTab();
    // Support both old single hatId and new hatIds array
    let selectedHatIds = tab?.hatIds || [];
    if (!Array.isArray(selectedHatIds)) {
      selectedHatIds = tab?.hatId && tab.hatId !== 'default' ? [tab.hatId] : [];
    }

    const selectedHats = selectedHatIds.map(id => availableHats.find(h => h.id === id)).filter(Boolean);
    const nonDefaultHats = availableHats.filter(h => !h.isDefault);

    // Build hat button showing selected hats and dropdown
    selector.innerHTML = `
      <div class="hat-selected-list">
        ${selectedHats.length === 0 ? `
          <button class="hat-btn hat-btn-empty" id="hatBtn" title="Add hats">
            <span class="hat-icon" style="color: #666">${getHatIconSvg('circle')}</span>
            <span class="hat-name">No Hats</span>
            <svg class="hat-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        ` : `
          ${selectedHats.map(hat => `
            <span class="hat-selected-chip" style="border-color: ${hat.color}40; background: ${hat.color}15" title="${hat.name}">
              <span class="hat-icon" style="color: ${hat.color}">${getHatIconSvg(hat.icon)}</span>
              <span class="hat-chip-name">${hat.name}</span>
              <button class="hat-chip-remove" onclick="event.stopPropagation(); app.selectHat('${hat.id}')" title="Remove">&times;</button>
            </span>
          `).join('')}
          <button class="hat-add-btn" id="hatBtn" title="Add more hats">+</button>
        `}
      </div>
      <div class="hat-dropdown" id="hatDropdown">
        <div class="hat-dropdown-header">
          <span>Select Hats</span>
          <button class="hat-manage-btn" onclick="app.openHatEditor()" title="Create new hat">+</button>
        </div>
        ${nonDefaultHats.length === 0 ? `
          <div class="hat-empty-msg">No custom hats yet. Create one!</div>
        ` : nonDefaultHats.map(hat => `
          <div class="hat-option ${selectedHatIds.includes(hat.id) ? 'active' : ''}" onclick="app.selectHat('${hat.id}')">
            <span class="hat-checkbox">${selectedHatIds.includes(hat.id) ? '&#10003;' : ''}</span>
            <span class="hat-icon" style="color: ${hat.color}">${getHatIconSvg(hat.icon)}</span>
            <div class="hat-option-info">
              <span class="hat-option-name">${hat.name}</span>
              <span class="hat-option-desc">${hat.description || ''}</span>
            </div>
            <button class="hat-edit-btn" onclick="event.stopPropagation(); app.editHat('${hat.id}')" title="Edit">&#9998;</button>
          </div>
        `).join('')}
      </div>
    `;

    // Add click handler for dropdown toggle
    const hatBtn = document.getElementById('hatBtn');
    const hatDropdown = document.getElementById('hatDropdown');

    hatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hatDropdown.classList.toggle('visible');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!selector.contains(e.target)) {
        hatDropdown.classList.remove('visible');
      }
    });
  }

  function getHatIconSvg(icon) {
    const icons = {
      'circle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
      'search': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      'layers': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      'bug': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M6 10H2M22 10h-4M6 14H2M22 14h-4M12 6V2M8 6L6 4M16 6l2-2"/></svg>',
      'code': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      'book': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      'star': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      'zap': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      'shield': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      'cpu': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>'
    };
    return icons[icon] || icons['circle'];
  }

  function openHatEditor(hat = null) {
    const modal = document.getElementById('hatEditorModal');
    if (!modal) return;

    const isEdit = hat !== null;
    const defaultHat = {
      id: '',
      name: '',
      description: '',
      icon: 'circle',
      color: '#00d9ff',
      systemPrompt: '',
      documentationPaths: []
    };

    const editHat = hat || defaultHat;

    modal.innerHTML = `
      <div class="hat-editor">
        <div class="hat-editor-header">
          <h3>${isEdit ? 'Edit Hat' : 'Create New Hat'}</h3>
          <button class="hat-editor-close" onclick="app.closeHatEditor()">&times;</button>
        </div>
        <div class="hat-editor-body">
          <div class="hat-editor-row">
            <label>Name</label>
            <input type="text" id="hatName" value="${editHat.name}" placeholder="My Custom Hat">
          </div>
          <div class="hat-editor-row">
            <label>Description</label>
            <input type="text" id="hatDescription" value="${editHat.description}" placeholder="What this hat does...">
          </div>
          <div class="hat-editor-row hat-editor-row-inline">
            <div>
              <label>Icon</label>
              <select id="hatIcon">
                ${['circle', 'search', 'layers', 'bug', 'code', 'book', 'star', 'zap', 'shield', 'cpu'].map(icon =>
                  `<option value="${icon}" ${editHat.icon === icon ? 'selected' : ''}>${icon}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label>Color</label>
              <input type="color" id="hatColor" value="${editHat.color}">
            </div>
          </div>
          <div class="hat-editor-row">
            <label>System Prompt</label>
            <textarea id="hatSystemPrompt" rows="8" placeholder="Instructions for Claude when wearing this hat...">${editHat.systemPrompt || ''}</textarea>
          </div>
          <div class="hat-editor-row">
            <label>Documentation Paths (one per line)</label>
            <textarea id="hatDocPaths" rows="3" placeholder="/path/to/doc1.md&#10;/path/to/doc2.txt">${(editHat.documentationPaths || []).join('\n')}</textarea>
          </div>
        </div>
        <div class="hat-editor-footer">
          ${isEdit && !editHat.isDefault ? `<button class="hat-delete-btn" onclick="app.deleteHat('${editHat.id}')">Delete</button>` : '<div></div>'}
          <div>
            <button class="hat-cancel-btn" onclick="app.closeHatEditor()">Cancel</button>
            <button class="hat-save-btn" onclick="app.saveHat('${isEdit ? editHat.id : ''}')">Save</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('visible');
  }

  function closeHatEditor() {
    const modal = document.getElementById('hatEditorModal');
    if (modal) {
      modal.classList.remove('visible');
    }
  }

  function editHat(hatId) {
    // Close dropdown first
    const dropdown = document.getElementById('hatDropdown');
    if (dropdown) dropdown.classList.remove('visible');

    // Request hat data from server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get-hat', hatId }));
    }
  }

  function saveHat(existingId = '') {
    const name = document.getElementById('hatName').value.trim();
    const description = document.getElementById('hatDescription').value.trim();
    const icon = document.getElementById('hatIcon').value;
    const color = document.getElementById('hatColor').value;
    const systemPrompt = document.getElementById('hatSystemPrompt').value;
    const docPathsRaw = document.getElementById('hatDocPaths').value;

    if (!name) {
      alert('Please enter a hat name');
      return;
    }

    // Generate ID from name if new
    const id = existingId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const docPaths = docPathsRaw.split('\n').map(p => p.trim()).filter(p => p);

    const hatData = {
      id,
      name,
      description,
      icon,
      color,
      systemPrompt,
      documentationPaths: docPaths,
      isDefault: false
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'save-hat', hat: hatData }));
    }
  }

  function deleteHat(hatId) {
    if (!confirm('Are you sure you want to delete this hat?')) return;

    // Remove hat from any tabs using it
    tabs.forEach(tab => {
      if (Array.isArray(tab.hatIds)) {
        const index = tab.hatIds.indexOf(hatId);
        if (index !== -1) {
          tab.hatIds.splice(index, 1);
        }
      }
      // Also handle legacy hatId field
      if (tab.hatId === hatId) {
        tab.hatId = 'default';
      }
    });
    saveTabs();

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'delete-hat', hatId }));
    }

    closeHatEditor();
  }

  function handleAgentStream(tab, msg) {
    const content = msg.content || msg;
    const eventType = content.eventType;

    if (tab.id === activeTabId) {
      updateAgentStatus('Working...');
    }

    switch (eventType) {
      case 'tool_start':
        tab.toolLog.push({ tool: content.tool, status: 'running', input: '' });
        if (tab.id === activeTabId) updateToolList(tab);
        updateAgentStatus(`Using ${content.tool}...`);
        break;

      case 'tool_call':
        if (tab.toolLog.length > 0) {
          const last = tab.toolLog[tab.toolLog.length - 1];
          last.input = content.input || '';
        }
        if (tab.id === activeTabId) updateToolList(tab);
        break;

      case 'tool_result':
        if (tab.toolLog.length > 0) {
          const last = tab.toolLog[tab.toolLog.length - 1];
          last.status = 'complete';
          last.result = content.result;
        }
        if (tab.id === activeTabId) updateToolList(tab);
        if (tab.id === activeTabId) updateAgentStatus('Processing...');
        break;

      case 'file_operation':
        if (tab.toolLog.length > 0) {
          const last = tab.toolLog[tab.toolLog.length - 1];
          last.input = content.file || '';
        }
        if (tab.id === activeTabId) updateToolList(tab);
        if (tab.id === activeTabId) updateAgentStatus(`${content.tool}ing ${content.file}...`);
        break;

      case 'todo_update':
        if (content.todos) {
          tab.todos = content.todos;
          if (tab.id === activeTabId) updateTodoList(content.todos);
        }
        break;

      case 'thinking_start':
      case 'thinking':
        if (content.text) {
          tab.thinkingText = content.text;
          if (tab.id === activeTabId) showThinking(content.text);
        }
        if (tab.id === activeTabId) updateAgentStatus('Thinking...');
        break;

      case 'text_delta':
        handleTextDelta(tab, content);
        if (tab.id === activeTabId) updateAgentStatus('Generating...');
        break;

      case 'complete':
        if (tab.id === activeTabId) {
          updateAgentStatus(`Done (${(content.duration / 1000).toFixed(1)}s)`);
          setTimeout(() => {
            if (!tab.isProcessing) {
              updateAgentStatus('Idle');
            }
          }, 2000);
        }
        break;

      // Pipeline stage events (from standard pipeline executor)
      case 'stage_start':
        if (tab.id === activeTabId) {
          updateAgentStatus(`Stage: ${content.stageName || content.agent || 'Running'}...`);
        }
        break;
    }

    saveTabs();
  }

  function handleTextDelta(tab, content) {
    if (content.accumulated && content.totalLength) {
      const newChars = content.totalLength - tab.lastTotalLength;
      if (newChars > 0 && content.accumulated.length >= newChars) {
        tab.typingQueue += content.accumulated.slice(-newChars);
      }
      tab.lastTotalLength = content.totalLength;

      // Only animate if this is the active tab
      if (tab.id === activeTabId) {
        const streamPanel = document.getElementById('streamPanel');
        const streamContent = document.getElementById('streamContent');
        streamPanel.classList.add('visible');

        if (!typingTimer) {
          typingTimer = setInterval(() => {
            const activeTab = getActiveTab();
            if (activeTab && activeTab.typingQueue.length > 0) {
              const chars = activeTab.typingQueue.slice(0, CHARS_PER_TICK);
              activeTab.typingQueue = activeTab.typingQueue.slice(CHARS_PER_TICK);
              activeTab.streamText += chars;

              // Keep last 1000 chars
              if (activeTab.streamText.length > 1000) {
                activeTab.streamText = activeTab.streamText.slice(-1000);
              }

              streamContent.innerHTML = renderMarkdown(activeTab.streamText) + '<span class="stream-cursor"></span>';
              streamPanel.scrollTop = streamPanel.scrollHeight;
            }
          }, TYPING_DELAY);
        }
      }
    }
  }

  function handleTextStream(tab, msg) {
    if (msg.delta) {
      tab.streamText += msg.delta;
      if (tab.streamText.length > 1000) {
        tab.streamText = tab.streamText.slice(-1000);
      }

      if (tab.id === activeTabId) {
        const streamPanel = document.getElementById('streamPanel');
        const streamContent = document.getElementById('streamContent');
        streamPanel.classList.add('visible');
        streamContent.innerHTML = renderMarkdown(tab.streamText) + '<span class="stream-cursor"></span>';
        streamPanel.scrollTop = streamPanel.scrollHeight;
      }
    }
  }

  function handleUsage(tab, msg) {
    const usage = msg.content || msg;

    tab.totalCost += usage.estimatedCostUsd || 0;
    tab.totalInputTokens += usage.inputTokens || 0;
    tab.totalOutputTokens += usage.outputTokens || 0;

    if (tab.id === activeTabId) {
      document.getElementById('totalCost').textContent = '$' + tab.totalCost.toFixed(4);
      document.getElementById('inputTokens').textContent = formatNumber(tab.totalInputTokens);
      document.getElementById('outputTokens').textContent = formatNumber(tab.totalOutputTokens);
    }

    saveTabs();
  }

  function updateToolList(tab) {
    const toolPanel = document.getElementById('toolPanel');
    const toolList = document.getElementById('toolList');

    // Separate running and completed tools
    const running = tab.toolLog.filter(t => t.status === 'running');
    const complete = tab.toolLog.filter(t => t.status === 'complete');

    // Create a state signature for change detection
    const stateString = JSON.stringify({
      running: running.map(t => t.tool),
      completeCount: complete.length
    });
    if (stateString === tab.lastToolState) return;
    tab.lastToolState = stateString;

    // Toggle has-running class for glow effect
    if (running.length > 0) {
      toolPanel.classList.add('has-running');
    } else {
      toolPanel.classList.remove('has-running');
    }

    // Build the display
    let html = '';

    // Show running tools prominently (if any) - limit to 3
    if (running.length > 0) {
      const maxVisible = 3;
      const visibleRunning = running.slice(-maxVisible); // Show most recent
      const hiddenCount = running.length - maxVisible;

      const runningHtml = visibleRunning.map(t => {
        const shortName = getShortToolName(t.tool);
        const inputPreview = t.input ? t.input.substring(0, 40) : '';
        return `
          <div class="tool-running-item" title="${escapeHtml(t.tool)}${t.input ? ': ' + escapeHtml(t.input.substring(0, 100)) : ''}">
            <span class="tool-spinner"></span>
            <span class="tool-running-name">${escapeHtml(shortName)}</span>
            ${inputPreview ? `<span class="tool-running-input">${escapeHtml(inputPreview)}</span>` : ''}
          </div>
        `;
      }).join('');

      let sectionHtml = runningHtml;
      if (hiddenCount > 0) {
        sectionHtml += `<div class="tool-running-more">+${hiddenCount} more...</div>`;
      }
      html += `<div class="tool-running-section">${sectionHtml}</div>`;
    }

    // Show completed tools as a compact summary
    if (complete.length > 0) {
      // Count tools by name
      const counts = {};
      complete.forEach(t => {
        const name = getShortToolName(t.tool);
        counts[name] = (counts[name] || 0) + 1;
      });

      const summaryParts = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 6) // Show top 6 tool types
        .map(([name, count]) => count > 1 ? `${name} (${count})` : name);

      const totalOps = complete.length;
      html += `<div class="tool-summary">${totalOps} ops: ${summaryParts.join(', ')}</div>`;
    }

    // Empty state
    if (running.length === 0 && complete.length === 0) {
      html = '<div class="tool-empty">Waiting for activity...</div>';
    }

    toolList.innerHTML = html;
  }

  // Shorten tool names for compact display
  function getShortToolName(tool) {
    const shortNames = {
      'Read': 'Read',
      'Write': 'Write',
      'Edit': 'Edit',
      'Bash': 'Bash',
      'Glob': 'Glob',
      'Grep': 'Grep',
      'Task': 'Task',
      'WebFetch': 'Web',
      'WebSearch': 'Search',
      'TodoWrite': 'Todo',
      'NotebookEdit': 'NB'
    };
    return shortNames[tool] || tool.substring(0, 6);
  }

  let todoScrollIndex = 0;
  const TODO_VISIBLE_COUNT = 3;

  function updateTodoList(todos) {
    const todoPanel = document.getElementById('todoPanel');
    const todoList = document.getElementById('todoList');

    if (!todos || todos.length === 0) {
      todoPanel.classList.remove('visible');
      return;
    }

    todoPanel.classList.add('visible');

    // Find the in_progress task and try to center it in view
    const inProgressIndex = todos.findIndex(t => t.status === 'in_progress');
    if (inProgressIndex >= 0) {
      // Center the in_progress task in the visible window
      todoScrollIndex = Math.max(0, Math.min(inProgressIndex - 1, todos.length - TODO_VISIBLE_COUNT));
    }

    renderTodoItems(todos);
  }

  function renderTodoItems(todos) {
    const todoList = document.getElementById('todoList');
    const totalTodos = todos.length;
    const canScrollUp = todoScrollIndex > 0;
    const canScrollDown = todoScrollIndex + TODO_VISIBLE_COUNT < totalTodos;

    // Get visible slice of todos
    const visibleTodos = todos.slice(todoScrollIndex, todoScrollIndex + TODO_VISIBLE_COUNT);

    let html = '';

    // Scroll up button
    if (canScrollUp) {
      html += `<div class="todo-scroll-btn todo-scroll-up" onclick="window.todoScrollUp()">▲ ${todoScrollIndex} more</div>`;
    }

    // Visible todo items
    html += visibleTodos.map(t => {
      const icon = t.status === 'completed' ? '&#10003;' : t.status === 'in_progress' ? '&#9679;' : '&#9675;';
      return `
        <div class="todo-item ${t.status}">
          <span class="todo-icon">${icon}</span>
          <span class="todo-text">${escapeHtml(t.content)}</span>
        </div>
      `;
    }).join('');

    // Scroll down button
    if (canScrollDown) {
      const remaining = totalTodos - (todoScrollIndex + TODO_VISIBLE_COUNT);
      html += `<div class="todo-scroll-btn todo-scroll-down" onclick="window.todoScrollDown()">▼ ${remaining} more</div>`;
    }

    todoList.innerHTML = html;
  }

  // Expose scroll functions to window for onclick handlers
  window.todoScrollUp = function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.todos) return;
    todoScrollIndex = Math.max(0, todoScrollIndex - 1);
    renderTodoItems(tab.todos);
  };

  window.todoScrollDown = function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.todos) return;
    todoScrollIndex = Math.min(tab.todos.length - TODO_VISIBLE_COUNT, todoScrollIndex + 1);
    renderTodoItems(tab.todos);
  };

  function showThinking(text) {
    const thinkingPanel = document.getElementById('thinkingPanel');
    thinkingPanel.classList.add('visible');
    thinkingPanel.textContent = text.slice(-300);
  }

  function hideThinking() {
    document.getElementById('thinkingPanel').classList.remove('visible');
  }

  function updateAgentStatus(status) {
    document.getElementById('agentStatus').textContent = status;
  }

  function addMessage(tab, type, content, metadata = {}) {
    tab.messages.push({ type, content, metadata });

    // Only update UI if this is the active tab
    if (tab.id === activeTabId) {
      emptyState.style.display = 'none';

      const div = document.createElement('div');
      div.className = 'message ' + type;
      if (type === 'assistant') {
        div.innerHTML = renderMarkdown(content);

        // Add reflection subtext if present
        if (metadata.reflection && metadata.reflection.actionTaken) {
          const reflectionDiv = document.createElement('div');
          reflectionDiv.className = 'message-reflection';
          reflectionDiv.innerHTML = `<span class="reflection-icon">💭</span> <span class="reflection-text">${escapeHtml(metadata.reflection.actionTaken)}</span>`;
          div.appendChild(reflectionDiv);
        }
      } else {
        div.textContent = content;
      }
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    saveTabs();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sendMessage() {
    const tab = getActiveTab();
    if (!tab) return;

    const message = chatInput.value.trim();
    if (!message || tab.isProcessing) return;

    // Hide empty state
    emptyState.style.display = 'none';

    // Add user message
    addMessage(tab, 'user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Start processing
    startProcessing(tab);

    // Build conversation history from saved messages (last 20 exchanges)
    // IMPORTANT: Exclude the message we just added (the current user message)
    const history = [];
    const msgs = tab.messages.filter(m => m.type === 'user' || m.type === 'assistant');
    // Remove the last message (the one we just added) before building pairs
    const previousMsgs = msgs.slice(0, -1);

    // Build user/assistant pairs for history
    for (let i = 0; i < previousMsgs.length; i++) {
      const msg = previousMsgs[i];
      const nextMsg = previousMsgs[i + 1];

      if (msg.type === 'user' && nextMsg?.type === 'assistant') {
        history.push({
          user: msg.content,
          assistant: nextMsg.content
        });
        i++; // Skip the assistant message we just paired
      }
      // Skip unpaired messages (system errors, aborts, etc. that may have broken pairs)
    }

    // Send to proxy with history and hat context
    // Support both old single hatId and new hatIds array
    let hatIds = tab.hatIds || [];
    if (!Array.isArray(hatIds) || hatIds.length === 0) {
      hatIds = tab.hatId && tab.hatId !== 'default' ? [tab.hatId] : [];
    }

    // Debug: Log what history we're sending (comprehensive)
    console.log(`[CHAT-DEBUG] ============ SENDING MESSAGE ============`);
    console.log(`[CHAT-DEBUG] Tab ID: ${tab.id}`);
    console.log(`[CHAT-DEBUG] Tab messages count: ${tab.messages.length}`);
    console.log(`[CHAT-DEBUG] Filtered (user/assistant only): ${msgs.length}`);
    console.log(`[CHAT-DEBUG] Previous (excluding current): ${previousMsgs.length}`);
    console.log(`[CHAT-DEBUG] History pairs built: ${history.length}`);
    console.log(`[CHAT-DEBUG] Current message: ${message.substring(0, 80)}...`);
    console.log(`[CHAT-DEBUG] History items being sent:`);
    history.forEach((h, i) => {
      console.log(`[CHAT-DEBUG]   [${i}] User: ${h.user?.substring(0, 50)}... | Asst: ${h.assistant?.substring(0, 50)}...`);
    });
    console.log(`[CHAT-DEBUG] =========================================`)

    // Save full history to disk before sending message (async, non-blocking)
    // This makes the complete conversation available to Claude via file read
    try {
      fetch('http://localhost:3009/save-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabName: tab.name,
          history: tab.messages, // All messages, not just history pairs
          workingDirectory: tab.directory
        })
      }).then(r => r.json())
        .then(result => console.log('[CHAT-DEBUG] History saved:', result.path))
        .catch(e => console.warn('[CHAT-DEBUG] Could not save history:', e));
    } catch (e) {
      console.warn('[CHAT-DEBUG] History save failed:', e);
    }

    ws.send(JSON.stringify({
      type: 'claude-chat-message',
      message: message,
      workingDirectory: tab.directory,
      conversationId: tab.conversationId,
      tabId: tab.id,
      tabName: tab.name, // Include tab name for history file
      history: history.slice(-10), // Last 10 exchanges for context (inline)
      fullHistory: history, // Full history for file-based access
      hatIds: hatIds, // Include hat IDs for context injection (supports multiple)
      pipelineId: tab.pipelineId // Pipeline to route message through (null = direct chat)
    }));

    tab.messageCount++;
    document.getElementById('messageCount').textContent = tab.messageCount;
    saveTabs();
  }

  function startProcessing(tab) {
    tab.isProcessing = true;

    if (tab.id === activeTabId) {
      sendBtn.disabled = true;
      chatInput.disabled = true;
      abortBtn.style.display = 'inline-block';
    }

    // Reset activity state
    tab.toolLog = [];
    tab.lastToolState = '';
    tab.streamText = '';
    tab.typingQueue = '';
    tab.lastTotalLength = 0;
    tab.thinkingText = '';

    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }

    if (tab.id === activeTabId) {
      updateToolList(tab);
      document.getElementById('streamPanel').classList.remove('visible');
      document.getElementById('streamContent').innerHTML = '';
      hideThinking();
      updateAgentStatus('Starting...');
    }

    saveTabs();
  }

  function finishProcessing(tab) {
    tab.isProcessing = false;

    if (tab.id === activeTabId) {
      sendBtn.disabled = false;
      chatInput.disabled = false;
      abortBtn.style.display = 'none';
      chatInput.focus();
    }

    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }

    // Hide stream panel after a bit
    if (tab.id === activeTabId) {
      setTimeout(() => {
        if (!tab.isProcessing) {
          document.getElementById('streamPanel').classList.remove('visible');
          hideThinking();
        }
      }, 1000);
    }

    saveTabs();
  }

  function abortClaude() {
    const tab = getActiveTab();
    if (!tab) return;

    ws.send(JSON.stringify({
      type: 'claude-chat-abort',
      conversationId: tab.conversationId,
      tabId: tab.id
    }));
  }

  function clearChat() {
    const tab = getActiveTab();
    if (!tab) return;

    if (!confirm('Clear all messages in this tab? This cannot be undone.')) {
      return;
    }

    // Clear messages
    tab.messages = [];
    tab.toolLog = [];
    tab.todos = [];
    tab.streamText = '';
    tab.typingQueue = '';
    tab.thinkingText = '';
    tab.totalCost = 0;
    tab.totalInputTokens = 0;
    tab.totalOutputTokens = 0;
    tab.messageCount = 0;

    // Re-render
    renderMessages(tab);
    updateActivityPanel(tab);
    saveTabs();
  }

  function setDirectory() {
    const tab = getActiveTab();
    if (!tab) return;

    const input = document.getElementById('workingDir');
    const newDir = input.value.trim();

    tab.directory = newDir;
    tab.title = newDir.split('/').pop() || newDir;

    ws.send(JSON.stringify({
      type: 'directory-change',
      directory: newDir,
      tabId: tab.id
    }));

    addMessage(tab, 'system', 'Working directory changed to: ' + newDir);
    renderTabs();
    saveTabs();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<span class="md-h3">$1</span>');
    html = html.replace(/^## (.+)$/gm, '<span class="md-h2">$1</span>');
    html = html.replace(/^# (.+)$/gm, '<span class="md-h1">$1</span>');

    // Bullets
    html = html.replace(/^[\-\*] (.+)$/gm, '<span class="md-bullet">$1</span>');

    // Newlines
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    sendMessage,
    setDirectory,
    abortClaude,
    clearChat,
    createTab,
    closeTab,
    switchToTab,
    startRenameTab,
    unlockTab,
    // Hat management
    selectHat,
    openHatEditor,
    closeHatEditor,
    editHat,
    saveHat,
    deleteHat,
    // Pipeline management
    setPipeline
  };
})();
