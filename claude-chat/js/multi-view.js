/**
 * Claude Chat Multi-View Dashboard
 * Real-time monitoring of all Claude Chat conversations from a single display
 */

class MultiViewDashboard {
    constructor() {
        this.ws = null;
        this.tabs = new Map(); // tabId -> tab data
        this.messageTimestamps = []; // For messages/min calculation
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.layout = 'grid'; // 'grid' or 'list'
        this.focusedTabId = null;

        // DOM elements
        this.tabsGrid = document.getElementById('tabsGrid');
        this.placeholderCard = document.getElementById('placeholderCard');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.tabCountEl = document.getElementById('tabCount');
        this.messagesPerMinEl = document.getElementById('messagesPerMin');
        this.totalCostEl = document.getElementById('totalCost');
        this.layoutToggle = document.getElementById('layoutToggle');
        this.focusModal = document.getElementById('focusModal');
        this.focusTitle = document.getElementById('focusTitle');
        this.focusBody = document.getElementById('focusBody');
        this.focusClose = document.getElementById('focusClose');

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startMessageRateCalculation();
        this.fetchInitialTabs();
    }

    setupEventListeners() {
        this.layoutToggle.addEventListener('click', () => this.toggleLayout());
        this.focusClose.addEventListener('click', () => this.closeFocusModal());
        this.focusModal.addEventListener('click', (e) => {
            if (e.target === this.focusModal) this.closeFocusModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeFocusModal();
        });
    }

    async fetchInitialTabs() {
        try {
            const response = await fetch('http://localhost:8081/api/tabs');
            if (response.ok) {
                const data = await response.json();
                const tabs = data.tabs || data; // Handle both {tabs: [...]} and [...] formats
                console.log('[MultiView] Loaded initial tabs:', tabs);
                if (Array.isArray(tabs)) {
                    tabs.forEach(tab => this.addOrUpdateTab(tab));
                }
                this.updateStats();
            }
        } catch (error) {
            console.warn('[MultiView] Failed to fetch initial tabs:', error);
        }
    }

    connectWebSocket() {
        this.setConnectionStatus('connecting');

        try {
            this.ws = new WebSocket('ws://localhost:8081');

            this.ws.onopen = () => {
                console.log('[MultiView] WebSocket connected');
                this.setConnectionStatus('connected');
                this.reconnectAttempts = 0;

                // Send initialization message
                this.ws.send(JSON.stringify({
                    type: 'multi-view-init',
                    timestamp: new Date().toISOString()
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[MultiView] Failed to parse message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[MultiView] WebSocket error:', error);
                this.setConnectionStatus('error');
            };

            this.ws.onclose = () => {
                console.log('[MultiView] WebSocket closed');
                this.setConnectionStatus('disconnected');
                this.attemptReconnect();
            };
        } catch (error) {
            console.error('[MultiView] Failed to connect:', error);
            this.setConnectionStatus('error');
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[MultiView] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), delay);
        } else {
            console.error('[MultiView] Max reconnection attempts reached');
            this.setConnectionStatus('failed');
        }
    }

    handleMessage(message) {
        console.log('[MultiView] Received:', message.type, message);

        switch (message.type) {
            case 'api-tab-update':
                this.handleTabUpdate(message);
                break;
            case 'api-tab-message':
                this.handleTabMessage(message);
                break;
            case 'api-tab-stream':
                this.handleTabStream(message);
                break;
            case 'api-tab-deleted':
                this.handleTabDeleted(message);
                break;
            case 'api-tabs-list':
                this.handleTabsList(message);
                break;
            case 'agent-stream':
                this.handleAgentStream(message);
                break;
            case 'assistant-message-stream':
                this.handleAssistantStream(message);
                break;
            case 'ai-usage':
                this.handleUsage(message);
                break;
            default:
                // Ignore other message types
                break;
        }
    }

    handleTabUpdate(message) {
        const { tabId, tab } = message;
        if (tabId && tab) {
            this.addOrUpdateTab({ ...tab, id: tabId });
            this.recordMessage();
        }
    }

    handleTabMessage(message) {
        const { tabId, message: msg } = message;
        if (tabId && msg) {
            const tab = this.tabs.get(tabId);
            if (tab) {
                if (!tab.messages) tab.messages = [];
                tab.messages.push(msg);
                tab.lastActivity = new Date().toISOString();
                this.updateTabCard(tabId);
                this.recordMessage();
            }
        }
    }

    handleTabStream(message) {
        const { tabId, chunk, streamType } = message;
        if (tabId) {
            const tab = this.tabs.get(tabId);
            if (tab) {
                if (!tab.currentStream) {
                    tab.currentStream = { text: '', type: streamType || 'response' };
                }
                tab.currentStream.text += chunk || '';
                tab.currentStream.type = streamType || tab.currentStream.type;
                tab.lastActivity = new Date().toISOString();
                tab.isStreaming = true;
                this.updateTabCard(tabId);
            }
        }
    }

    handleTabDeleted(message) {
        const { tabId } = message;
        if (tabId) {
            this.tabs.delete(tabId);
            this.removeTabCard(tabId);
            this.updateStats();
        }
    }

    handleTabsList(message) {
        const { tabs } = message;
        if (tabs) {
            tabs.forEach(tab => this.addOrUpdateTab(tab));
            this.updateStats();
        }
    }

    handleAgentStream(message) {
        const { tabId, conversationId } = message;
        const id = tabId || conversationId;
        if (id) {
            const tab = this.tabs.get(id);
            if (tab) {
                // Update tool activity
                if (message.toolName) {
                    tab.currentTool = {
                        name: message.toolName,
                        status: message.toolStatus || 'running'
                    };
                }
                // Update thinking
                if (message.thinking) {
                    tab.currentThinking = message.thinking;
                }
                // Update todos
                if (message.todos) {
                    tab.todos = message.todos;
                }
                tab.lastActivity = new Date().toISOString();
                tab.isStreaming = true;
                this.updateTabCard(id);
            }
        }
    }

    handleAssistantStream(message) {
        const { tabId, conversationId, content } = message;
        const id = tabId || conversationId;
        if (id && content) {
            const tab = this.tabs.get(id);
            if (tab) {
                if (!tab.currentStream) {
                    tab.currentStream = { text: '', type: 'response' };
                }
                tab.currentStream.text += content;
                tab.lastActivity = new Date().toISOString();
                tab.isStreaming = true;
                this.updateTabCard(id);
            }
        }
    }

    handleUsage(message) {
        const { tabId, conversationId, cost, inputTokens, outputTokens } = message;
        const id = tabId || conversationId;
        if (id) {
            const tab = this.tabs.get(id);
            if (tab) {
                tab.cost = (tab.cost || 0) + (cost || 0);
                tab.inputTokens = (tab.inputTokens || 0) + (inputTokens || 0);
                tab.outputTokens = (tab.outputTokens || 0) + (outputTokens || 0);
                this.updateTabCard(id);
                this.updateStats();
            }
        }
    }

    addOrUpdateTab(tab) {
        const tabId = tab.id || tab.tabId;
        if (!tabId) return;

        const existingTab = this.tabs.get(tabId);
        if (existingTab) {
            // Merge with existing data
            Object.assign(existingTab, tab);
            existingTab.lastActivity = new Date().toISOString();
        } else {
            // New tab
            this.tabs.set(tabId, {
                ...tab,
                id: tabId,
                lastActivity: new Date().toISOString(),
                messages: tab.messages || [],
                currentStream: null,
                currentTool: null,
                currentThinking: null,
                todos: [],
                cost: tab.cost || 0,
                inputTokens: tab.inputTokens || 0,
                outputTokens: tab.outputTokens || 0,
                isStreaming: false
            });
        }

        this.updateTabCard(tabId);
        this.updateStats();
    }

    updateTabCard(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        let card = document.getElementById(`tab-card-${tabId}`);

        if (!card) {
            card = this.createTabCard(tabId);
            this.tabsGrid.insertBefore(card, this.placeholderCard);
        }

        this.renderTabCard(card, tab);
        this.placeholderCard.style.display = 'none';
    }

    createTabCard(tabId) {
        const card = document.createElement('div');
        card.id = `tab-card-${tabId}`;
        card.className = 'tab-card';
        card.addEventListener('click', () => this.openFocusModal(tabId));
        return card;
    }

    renderTabCard(card, tab) {
        const title = tab.title || tab.name || `Tab ${(tab.id || '').slice(0, 8)}`;
        const directory = tab.directory || tab.workingDir || tab.workingDirectory || 'No directory';
        const isActive = tab.isStreaming || tab.currentTool;

        // Get recent activity
        let activityContent = '';
        let activityClass = '';

        if (tab.currentTool) {
            activityContent = `<span class="tool-icon">🔧</span> ${tab.currentTool.name}`;
            activityClass = 'activity-tool';
        } else if (tab.currentThinking) {
            activityContent = `<span class="thinking-icon">💭</span> ${this.truncate(tab.currentThinking, 100)}`;
            activityClass = 'activity-thinking';
        } else if (tab.currentStream && tab.currentStream.text) {
            activityContent = this.truncate(tab.currentStream.text, 150);
            activityClass = 'activity-stream';
        } else if (tab.messages && tab.messages.length > 0) {
            const lastMsg = tab.messages[tab.messages.length - 1];
            activityContent = this.truncate(lastMsg.content || lastMsg.text || '', 150);
            activityClass = 'activity-message';
        } else {
            activityContent = '<em>No recent activity</em>';
            activityClass = 'activity-none';
        }

        // Render todos if any
        let todosHtml = '';
        if (tab.todos && tab.todos.length > 0) {
            const inProgress = tab.todos.filter(t => t.status === 'in_progress');
            const completed = tab.todos.filter(t => t.status === 'completed');
            const pending = tab.todos.filter(t => t.status === 'pending');

            todosHtml = `
                <div class="tab-todos">
                    <div class="todos-summary">
                        ${inProgress.length > 0 ? `<span class="todo-badge in-progress">▶ ${inProgress.length}</span>` : ''}
                        ${completed.length > 0 ? `<span class="todo-badge completed">✓ ${completed.length}</span>` : ''}
                        ${pending.length > 0 ? `<span class="todo-badge pending">○ ${pending.length}</span>` : ''}
                    </div>
                    ${inProgress.length > 0 ? `
                        <div class="current-todo">
                            ${inProgress[0].activeForm || inProgress[0].content}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        card.className = `tab-card ${isActive ? 'active' : ''} ${tab.isStreaming ? 'streaming' : ''}`;

        card.innerHTML = `
            <div class="tab-card-header">
                <div class="tab-title-row">
                    <span class="tab-status-dot ${isActive ? 'active' : ''}"></span>
                    <h3 class="tab-title">${this.escapeHtml(title)}</h3>
                </div>
                <div class="tab-meta">
                    <span class="tab-directory" title="${this.escapeHtml(directory)}">
                        📁 ${this.truncatePath(directory)}
                    </span>
                </div>
            </div>
            <div class="tab-card-body">
                <div class="tab-activity ${activityClass}">
                    ${activityContent}
                </div>
                ${todosHtml}
            </div>
            <div class="tab-card-footer">
                <div class="tab-stats">
                    <span class="tab-stat" title="Messages">💬 ${tab.messages?.length || 0}</span>
                    <span class="tab-stat" title="Cost">💰 $${(tab.cost || 0).toFixed(4)}</span>
                </div>
                <span class="tab-time">${this.formatTime(tab.lastActivity)}</span>
            </div>
            ${tab.isStreaming ? '<div class="streaming-indicator"><div class="pulse"></div></div>' : ''}
        `;
    }

    removeTabCard(tabId) {
        const card = document.getElementById(`tab-card-${tabId}`);
        if (card) {
            card.remove();
        }
        if (this.tabs.size === 0) {
            this.placeholderCard.style.display = 'flex';
        }
    }

    openFocusModal(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        this.focusedTabId = tabId;
        this.focusTitle.textContent = tab.title || `Tab ${tabId.slice(0, 8)}`;

        // Render full conversation
        let content = '<div class="focus-messages">';

        if (tab.messages && tab.messages.length > 0) {
            tab.messages.forEach(msg => {
                const type = msg.type || msg.role || 'unknown';
                const text = msg.content || msg.text || '';
                content += `
                    <div class="focus-message ${type}">
                        <div class="message-role">${type}</div>
                        <div class="message-content">${this.formatMessageContent(text)}</div>
                    </div>
                `;
            });
        } else {
            content += '<p class="no-messages">No messages yet</p>';
        }

        if (tab.currentStream && tab.currentStream.text) {
            content += `
                <div class="focus-message assistant streaming">
                    <div class="message-role">assistant (streaming)</div>
                    <div class="message-content">${this.formatMessageContent(tab.currentStream.text)}</div>
                </div>
            `;
        }

        content += '</div>';

        // Add todos section
        if (tab.todos && tab.todos.length > 0) {
            content += '<div class="focus-todos"><h4>Tasks</h4><ul>';
            tab.todos.forEach(todo => {
                const icon = todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '▶' : '○';
                content += `<li class="todo-${todo.status}">${icon} ${this.escapeHtml(todo.content)}</li>`;
            });
            content += '</ul></div>';
        }

        // Add stats
        content += `
            <div class="focus-stats">
                <div class="focus-stat">
                    <span class="label">Total Cost</span>
                    <span class="value">$${(tab.cost || 0).toFixed(4)}</span>
                </div>
                <div class="focus-stat">
                    <span class="label">Input Tokens</span>
                    <span class="value">${(tab.inputTokens || 0).toLocaleString()}</span>
                </div>
                <div class="focus-stat">
                    <span class="label">Output Tokens</span>
                    <span class="value">${(tab.outputTokens || 0).toLocaleString()}</span>
                </div>
                <div class="focus-stat">
                    <span class="label">Messages</span>
                    <span class="value">${tab.messages?.length || 0}</span>
                </div>
            </div>
        `;

        this.focusBody.innerHTML = content;
        this.focusModal.classList.add('visible');
    }

    closeFocusModal() {
        this.focusModal.classList.remove('visible');
        this.focusedTabId = null;
    }

    toggleLayout() {
        this.layout = this.layout === 'grid' ? 'list' : 'grid';
        this.tabsGrid.className = `tabs-grid ${this.layout}`;
        this.layoutToggle.querySelector('.layout-icon').textContent =
            this.layout === 'grid' ? '◫' : '☰';
    }

    setConnectionStatus(status) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');

        this.connectionStatus.className = `connection-status ${status}`;

        const statusMessages = {
            connecting: 'Connecting...',
            connected: 'Connected',
            disconnected: 'Disconnected',
            error: 'Connection Error',
            failed: 'Connection Failed'
        };

        statusText.textContent = statusMessages[status] || status;
    }

    recordMessage() {
        this.messageTimestamps.push(Date.now());
    }

    startMessageRateCalculation() {
        setInterval(() => {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            this.messageTimestamps = this.messageTimestamps.filter(t => t > oneMinuteAgo);
            this.messagesPerMinEl.textContent = this.messageTimestamps.length;
        }, 1000);
    }

    updateStats() {
        this.tabCountEl.textContent = this.tabs.size;

        let totalCost = 0;
        this.tabs.forEach(tab => {
            totalCost += tab.cost || 0;
        });
        this.totalCostEl.textContent = `$${totalCost.toFixed(2)}`;
    }

    // Utility functions
    truncate(text, maxLength) {
        if (!text) return '';
        text = String(text);
        if (text.length <= maxLength) return this.escapeHtml(text);
        return this.escapeHtml(text.slice(0, maxLength)) + '...';
    }

    truncatePath(path) {
        if (!path) return '';
        const parts = path.split(/[/\\]/);
        if (parts.length <= 3) return path;
        return '...' + parts.slice(-2).join('/');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    formatMessageContent(text) {
        if (!text) return '';
        // Basic markdown-like formatting
        return this.escapeHtml(text)
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new MultiViewDashboard();
    console.log('[MultiView] Dashboard initialized');
});
