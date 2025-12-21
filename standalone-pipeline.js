/**
 * DYNAMIC PIPELINE DESIGNER
 * Revolutionary visual pipeline editor for AI agent development
 */

class PipelineDesigner {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.connectionLines = document.getElementById('connectionLines');
    this.propertiesContent = document.getElementById('propertiesContent');
    this.metricsDashboard = document.getElementById('metricsDashboard');
    
    this.nodes = new Map();
    this.connections = [];
    this.selectedNode = null;
    this.currentTool = 'select';
    this.draggedElement = null;
    this.offset = { x: 0, y: 0 };
    this.zoom = 1;
    this.panOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.lastPanPoint = { x: 0, y: 0 };
    this.connectingFromNode = null;
    this.pipelineConfig = {
      id: 'new-pipeline',
      name: 'New Pipeline',
      description: '',
      version: '1.0.0'
    };

    this.init();
  }

  showReconnectedPipelineStatus(content) {
    const pipeline = content.pipeline;
    
    // Show progress in the chat
    this.addChatMessage('info', 'Pipeline Status', 
      `📊 Pipeline Progress: ${content.completedStages}/${content.totalStages} stages completed`,
      `Started: ${new Date(content.startTime).toLocaleString()}\nCurrent: ${content.currentStage}`, '📊');
    
    // Show completed stages
    if (pipeline.completedStages.length > 0) {
      const completedList = pipeline.completedStages.map(stageId => {
        const stage = pipeline.stages.find(s => s.id === stageId);
        return stage ? stage.name : stageId;
      }).join(', ');
      
      this.addChatMessage('success', 'Completed Stages', 
        `✅ ${pipeline.completedStages.length} stages completed`, 
        completedList, '✅');
    }
  }

  addCommentatorMessage(message, style = 'neutral', priority = 'normal') {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    const styleIcons = {
      'excited': '🚀',
      'focused': '⚡',
      'concerned': '⚠️', 
      'triumphant': '✨',
      'critical': '🚨',
      'neutral': '💬'
    };

    const styleColors = {
      'excited': '#4CAF50',
      'focused': '#2196F3',
      'concerned': '#FF9800',
      'triumphant': '#9C27B0', 
      'critical': '#F44336',
      'neutral': '#607D8B'
    };

    const messageIcon = styleIcons[style] || '💬';
    const messageColor = styleColors[style] || '#607D8B';
    const timestamp = new Date().toLocaleTimeString();

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message commentator-message ${style} ${priority}`;
    messageDiv.style.borderLeft = `4px solid ${messageColor}`;
    messageDiv.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))';
    messageDiv.style.backdropFilter = 'blur(10px)';
    messageDiv.style.margin = '8px 0';
    messageDiv.style.animation = 'commentatorPulse 0.5s ease-out';
    
    messageDiv.innerHTML = `
      <div class="message-icon" style="font-size: 20px; filter: drop-shadow(0 0 8px ${messageColor})">${messageIcon}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-agent" style="color: ${messageColor}; font-weight: bold;">💬 Commentator</span>
          <span class="message-timestamp">${timestamp}</span>
        </div>
        <div class="message-text" style="font-style: italic; font-size: 15px; line-height: 1.4;">${message}</div>
        <div class="message-style-indicator" style="font-size: 11px; color: ${messageColor}; opacity: 0.7; text-transform: uppercase;">${style}</div>
      </div>
    `;

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Add special highlighting for high priority messages
    if (priority === 'high') {
      setTimeout(() => {
        messageDiv.style.background = `linear-gradient(135deg, ${messageColor}20, ${messageColor}10)`;
      }, 100);
    }
  }

  addChatMessage(type, agent, text, details = null, icon = null) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    const typeIcons = {
      'system': '⚙️',
      'agent': '🤖',
      'error': '❌',
      'success': '✅',
      'info': 'ℹ️',
      'warning': '⚠️'
    };

    const messageIcon = icon || typeIcons[type] || '💬';
    const timestamp = new Date().toLocaleTimeString();

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.innerHTML = `
      <div class="message-icon">${messageIcon}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-agent">${agent}</span>
          <span class="message-timestamp">${timestamp}</span>
        </div>
        <div class="message-text">${text}</div>
        ${details ? `<div class="message-details">${details}</div>` : ''}
      </div>
    `;

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  clearChatMessages() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
      chatContainer.innerHTML = '';
    }
  }

  updateNodeVisualState(stageId, state) {
    console.log(`🎨 updateNodeVisualState called: stageId="${stageId}", state="${state}"`);
    console.log(`🎨 Current nodes count: ${this.nodes.size}`);

    // Find node by stage ID and update its visual appearance
    let found = false;
    for (const [nodeId, node] of this.nodes) {
      const nodeConfigId = node.config?.id;
      const nodeConfigAgent = node.config?.agent;
      console.log(`  - Checking node: id="${nodeConfigId}", agent="${nodeConfigAgent}"`);
      if (nodeConfigId === stageId || nodeConfigAgent === stageId || nodeId === stageId) {
        found = true;
        console.log(`  ✅ Match found! Updating node visual state to: ${state}`);
        const element = node.element;
        if (!element) {
          console.log(`  ⚠️ Node element is null!`);
          continue;
        }

        // Remove existing state classes
        element.classList.remove('node-idle', 'node-running', 'node-completed', 'node-error');

        // Add new state class
        element.classList.add(`node-${state}`);

        // Update node status property
        node.status = state;

        console.log(`🎨 Updated node ${stageId} to state: ${state}`);
        break;
      }
    }

    if (!found) {
      console.log(`  ❌ No node found matching stageId: "${stageId}"`);
    }
  }

  init() {
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupToolbar();
    // Note: Default template loading moved to DOMContentLoaded to avoid duplicates
    this.startMetricsUpdate();
    this.checkExecutionEngineStatus();
    this.checkForRunningPipeline(); // Check for existing pipeline on load
  }

  setupEventListeners() {
    console.log('🔧 [SETUP] Setting up event listeners...');
    
    // Canvas events
    this.canvas.addEventListener('click', (e) => {
      console.log('🖱️ [CANVAS] Canvas click event triggered', e.target);
      this.handleCanvasClick(e);
    });
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));

    // Window events
    window.addEventListener('resize', () => this.updateConnectionLines());
    
    // Template selection - event delegation for dynamically loaded templates
    document.addEventListener('click', (e) => {
      const templateItem = e.target.closest('.template-item');
      if (templateItem && templateItem.dataset.template && !e.target.classList.contains('template-delete-btn')) {
        console.log('📋 [TEMPLATE] Template clicked:', templateItem.dataset.template);
        this.loadTemplate(templateItem.dataset.template);
      }
    });

    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    console.log('✅ [SETUP] Event listeners setup complete');
  }

  setupDragAndDrop() {
    console.log('🎯 [DRAG] Setting up drag and drop...');
    
    // Agent library drag and drop
    const agentItems = document.querySelectorAll('.agent-item');
    console.log('🤖 [DRAG] Found agent items:', agentItems.length);
    agentItems.forEach(item => {
      console.log('🤖 [DRAG] Setting up agent:', item.dataset.agent);
      item.addEventListener('dragstart', (e) => {
        console.log('🤖 [DRAG] Agent drag started:', item.dataset.agent);
        e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'agent',
          id: item.dataset.agent
        }));
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    // Pipeline template drag and drop
    const templateItems = document.querySelectorAll('.template-item');
    console.log('📋 [DRAG] Found template items:', templateItems.length);
    templateItems.forEach(item => {
      // Skip the "Create Custom" template
      if (item.id === 'createCustomTemplate') {
        console.log('📋 [DRAG] Skipping createCustomTemplate');
        return;
      }
      
      console.log('📋 [DRAG] Setting up template:', item.dataset.template, item.id);
      item.setAttribute('draggable', 'true');
      
      item.addEventListener('dragstart', (e) => {
        console.log('📋 [DRAG] Template drag started:', item.dataset.template);
        const dragData = {
          type: 'template',
          id: item.dataset.template
        };
        console.log('📋 [DRAG] Drag data:', dragData);
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = 'copy';
        
        // Visual feedback
        item.style.opacity = '0.5';
        setTimeout(() => {
          item.style.opacity = '1';
        }, 100);
      });
      
      item.addEventListener('dragend', (e) => {
        console.log('📋 [DRAG] Template drag ended:', item.dataset.template);
        item.style.opacity = '1';
      });
    });

    // Canvas drop zone
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      
      // Highlight potential drop targets when dragging templates
      const dragData = e.dataTransfer.types.includes('text/plain');
      if (dragData) {
        this.highlightDropTargets(e.target);
      }
    });

    this.canvas.addEventListener('drop', (e) => {
      console.log('🎯 [DROP] Drop event triggered on canvas');
      e.preventDefault();
      
      const rawData = e.dataTransfer.getData('text/plain');
      console.log('🎯 [DROP] Raw drag data:', rawData);
      console.log('🎯 [DROP] Raw data length:', rawData.length);
      console.log('🎯 [DROP] Raw data type:', typeof rawData);
      
      if (!rawData || rawData.trim() === '') {
        console.log('❌ [DROP] Empty drag data');
        return;
      }
      
      try {
        const dragData = JSON.parse(rawData);
        console.log('🎯 [DROP] Parsed drag data:', dragData);
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom;
        const y = (e.clientY - rect.top) / this.zoom;
        console.log('🎯 [DROP] Drop position:', { x, y, zoom: this.zoom });
        
        // Check if dropping onto an existing node
        const targetNode = this.getNodeAtPosition(x, y);
        console.log('🎯 [DROP] Target node at position:', targetNode);
        
        if (dragData.type === 'agent') {
          console.log('🤖 [DROP] Creating agent node:', dragData.id);
          this.createNodeFromAgent(dragData.id, x, y);
        } else if (dragData.type === 'template') {
          console.log('📋 [DROP] Processing template drop:', dragData.id);
          
          if (targetNode && !targetNode.isComposite) {
            console.log('📋 [DROP] Replacing node with composite:', targetNode.element.dataset.nodeId);
            this.replaceNodeWithComposite(targetNode.element.dataset.nodeId, dragData.id);
          } else {
            console.log('📋 [DROP] Creating standalone composite node');
            this.createCompositeNode(dragData.id, x, y);
          }
        }
        
        console.log('✅ [DROP] Drop operation completed successfully');
      } catch (error) {
        console.error('❌ [DROP] Error during drop operation:', error);
      }
      
      // Clear drop highlights
      this.clearDropHighlights();
    });

    this.canvas.addEventListener('dragleave', (e) => {
      this.clearDropHighlights();
    });
  }

  setupToolbar() {
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      if (btn.dataset.tool) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTool = btn.dataset.tool;
        });
      }
    });
  }

  createNodeFromAgent(agentId, x, y) {
    const agentTemplates = {
      task_planner: {
        name: 'Task Planner',
        type: 'agent',
        icon: '🧠',
        description: 'Creates detailed implementation plans',
        agent: agentId
      },
      discerning_expert: {
        name: 'Expert Reviewer',
        type: 'validator',
        icon: '🕵️',
        description: 'Validates plans with strict standards',
        agent: agentId
      },
      task_executor: {
        name: 'Task Executor',
        type: 'agent',
        icon: '⚡',
        description: 'Implements approved plans',
        agent: agentId
      },
      proof_validator: {
        name: 'Proof Validator',
        type: 'validator',
        icon: '✅',
        description: 'Final quality validation',
        agent: agentId
      }
    };

    // Look up agent in the dynamically loaded agents list
    let template = agentTemplates[agentId]; // Fallback to hardcoded if exists
    
    // Check if we have this agent loaded from the server
    if (window.loadedAgents) {
      const dynamicAgent = window.loadedAgents.find(agent => agent.id === agentId);
      if (dynamicAgent) {
        template = {
          name: dynamicAgent.name,
          type: dynamicAgent.type || 'agent',
          icon: this.getAgentIcon(dynamicAgent),
          description: dynamicAgent.description,
          agent: agentId
        };
      }
    }
    
    if (template) {
      this.createNode({
        id: this.generateNodeId(),
        x,
        y,
        ...template
      });
    }
  }

  createNode(config) {
    const nodeId = config.id || this.generateNodeId();
    const node = document.createElement('div');
    node.className = 'pipeline-node';
    node.dataset.nodeId = nodeId;
    node.style.left = `${config.x}px`;
    node.style.top = `${config.y}px`;

    node.innerHTML = `
      <div class="node-header">
        <div class="node-icon ${config.type}">${config.icon}</div>
        <div class="node-title">${config.name}</div>
      </div>
      <div class="node-description">${config.description}</div>
      <div class="node-config">
        <span>Type: ${config.type}</span>
        <span>Agent: ${config.agent || 'none'}</span>
      </div>
      <div class="node-messages" id="messages-${nodeId}" style="display: none;"></div>
    `;

    // Add event listeners
    node.addEventListener('mousedown', (e) => this.handleNodeMouseDown(e, nodeId));
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(nodeId);
    });

    this.canvas.appendChild(node);
    this.nodes.set(nodeId, {
      element: node,
      config: config,
      position: { x: config.x, y: config.y }
    });

    return nodeId;
  }

  handleNodeMouseDown(e, nodeId) {
    if (this.currentTool === 'select') {
      e.preventDefault();
      this.draggedElement = nodeId;
      const rect = this.canvas.getBoundingClientRect();
      const node = this.nodes.get(nodeId);
      this.offset = {
        x: e.clientX - rect.left - node.position.x * this.zoom,
        y: e.clientY - rect.top - node.position.y * this.zoom
      };
      this.selectNode(nodeId);
    } else if (this.currentTool === 'connect') {
      this.startConnection(nodeId);
    } else if (this.currentTool === 'delete') {
      this.deleteNode(nodeId);
    }
  }

  handleCanvasMouseMove(e) {
    if (this.isPanning) {
      // Handle canvas panning
      const deltaX = e.clientX - this.lastPanPoint.x;
      const deltaY = e.clientY - this.lastPanPoint.y;
      
      this.panOffset.x += deltaX;
      this.panOffset.y += deltaY;

      // Constrain pan to keep canvas visible
      this.constrainPan();

      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.updateCanvasTransform();
    } else if (this.draggedElement && this.currentTool === 'select') {
      // Handle node dragging
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.offset.x) / this.zoom;
      const y = (e.clientY - rect.top - this.offset.y) / this.zoom;
      
      const node = this.nodes.get(this.draggedElement);
      if (node) {
        node.position.x = x;
        node.position.y = y;
        node.element.style.left = `${x}px`;
        node.element.style.top = `${y}px`;
        this.updateConnectionLines();
      }
    }
  }

  handleCanvasMouseUp(e) {
    this.draggedElement = null;
    
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.classList.remove('panning');
    }
  }

  handleCanvasClick(e) {
    if ((e.target === this.canvas || e.target.classList.contains('canvas-grid')) && !this.isPanning) {
      this.selectNode(null);
      
      // Clear connection state if clicking on empty canvas
      if (this.connectingFromNode) {
        this.clearConnectionState();
        console.log('🔗 Connection cancelled - clicked on empty canvas');
      }
    }
  }

  handleCanvasMouseDown(e) {
    if (e.target === this.canvas || e.target.classList.contains('canvas-grid')) {
      // Start panning
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.canvas.classList.add('panning');
      e.preventDefault();
    }
  }

  handleCanvasWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, this.zoom * delta));

    if (newZoom !== this.zoom) {
      // Store old values
      const oldZoom = this.zoom;
      const oldPanX = this.panOffset.x;
      const oldPanY = this.panOffset.y;

      // Update zoom first
      this.zoom = newZoom;

      // Calculate new pan to zoom towards mouse, but don't apply yet
      const zoomFactor = newZoom / oldZoom;
      let newPanX = mouseX - (mouseX - oldPanX) * zoomFactor;
      let newPanY = mouseY - (mouseY - oldPanY) * zoomFactor;

      // Apply the calculated pan
      this.panOffset.x = newPanX;
      this.panOffset.y = newPanY;

      // THEN constrain - this will fix any out-of-bounds values
      this.constrainPan();

      this.updateCanvasTransform();
    }
  }

  constrainPan() {
    // Get viewport size
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    // Canvas actual size
    const canvasWidth = 10000;
    const canvasHeight = 10000;

    // At current zoom, how big is the canvas?
    const scaledWidth = canvasWidth * this.zoom;
    const scaledHeight = canvasHeight * this.zoom;

    // Calculate bounds to prevent showing empty canvas
    let minPanX, maxPanX, minPanY, maxPanY;

    if (scaledWidth <= viewportWidth) {
      // Canvas smaller than viewport - lock to top-left
      minPanX = maxPanX = 0;
    } else {
      // Canvas bigger than viewport
      maxPanX = 0;
      minPanX = -(scaledWidth - viewportWidth);
    }

    if (scaledHeight <= viewportHeight) {
      // Canvas smaller than viewport - lock to top-left
      minPanY = maxPanY = 0;
    } else {
      // Canvas bigger than viewport
      maxPanY = 0;
      minPanY = -(scaledHeight - viewportHeight);
    }

    // Clamp to calculated bounds
    this.panOffset.x = Math.max(minPanX, Math.min(maxPanX, this.panOffset.x));
    this.panOffset.y = Math.max(minPanY, Math.min(maxPanY, this.panOffset.y));
  }

  updateCanvasTransform() {
    this.canvas.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoom})`;
    this.updateConnectionLines();
  }

  centerViewportOnNodes() {
    console.log('📹 [CENTER] centerViewportOnNodes called');
    console.log(`📹 [CENTER] Current nodes count: ${this.nodes.size}`);

    if (this.nodes.size === 0) {
      // No nodes, center on default position (5000, 5000)
      const canvasRect = this.canvas.parentElement.getBoundingClientRect();
      this.panOffset.x = canvasRect.width / 2 - 5000 * this.zoom;
      this.panOffset.y = canvasRect.height / 2 - 5000 * this.zoom;
      console.log(`📹 [CENTER] No nodes, centering on default (5000, 5000)`);
      console.log(`📹 [CENTER] Viewport size: ${canvasRect.width}x${canvasRect.height}`);
      console.log(`📹 [CENTER] Pan offset set to: ${this.panOffset.x}, ${this.panOffset.y}`);
      this.updateCanvasTransform();
      return;
    }

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    this.nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 200); // Node width ~200px
      maxY = Math.max(maxY, y + 80);  // Node height ~80px
    });

    console.log(`📹 [CENTER] Bounding box: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);

    // Calculate center of bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    console.log(`📹 [CENTER] Center of nodes: ${centerX}, ${centerY}`);

    // Get viewport size
    const canvasRect = this.canvas.parentElement.getBoundingClientRect();
    const viewportCenterX = canvasRect.width / 2;
    const viewportCenterY = canvasRect.height / 2;

    console.log(`📹 [CENTER] Viewport center: ${viewportCenterX}, ${viewportCenterY}`);
    console.log(`📹 [CENTER] Current zoom: ${this.zoom}`);

    // Calculate pan offset to center the nodes
    this.panOffset.x = viewportCenterX - centerX * this.zoom;
    this.panOffset.y = viewportCenterY - centerY * this.zoom;

    console.log(`📹 [CENTER] Calculated pan offset: ${this.panOffset.x}, ${this.panOffset.y}`);

    // Apply constraints
    this.constrainPan();

    console.log(`📹 [CENTER] After constraints pan offset: ${this.panOffset.x}, ${this.panOffset.y}`);

    this.updateCanvasTransform();
    console.log('📹 [CENTER] ✅ Camera centered on nodes');
  }

  selectNode(nodeId) {
    // Remove previous selection
    document.querySelectorAll('.pipeline-node').forEach(node => {
      node.classList.remove('selected');
    });

    this.selectedNode = nodeId;

    if (nodeId) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.element.classList.add('selected');
        this.updatePropertiesPanel(node.config, node);
      }
    } else {
      this.updatePropertiesPanel(this.pipelineConfig, null);
    }
  }

  updatePropertiesPanel(config, node = null) {
    if (config === this.pipelineConfig) {
      // Pipeline properties
      this.propertiesContent.innerHTML = `
        <div class="property-group">
          <div class="property-label">Pipeline Name</div>
          <input type="text" class="property-input" value="${config.name}"
                 onchange="designer.updatePipelineProperty('name', this.value)" />
        </div>
        <div class="property-group">
          <div class="property-label">Description</div>
          <textarea class="property-input property-textarea"
                    onchange="designer.updatePipelineProperty('description', this.value)">${config.description}</textarea>
        </div>
        <div class="property-group">
          <div class="property-label">Version</div>
          <input type="text" class="property-input" value="${config.version}"
                 onchange="designer.updatePipelineProperty('version', this.value)" />
        </div>
        <div class="property-group">
          <div class="property-label">Global Config</div>
          <textarea class="property-input property-textarea"
                    placeholder="JSON configuration..."
                    onchange="designer.updatePipelineProperty('globalConfig', this.value)">${JSON.stringify(config.globalConfig || {}, null, 2)}</textarea>
        </div>
      `;
    } else {
      // Node properties
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      let executionOutputHTML = '';
      if (node && (node.prompt || node.output)) {
        executionOutputHTML = `
          <div class="property-group" style="margin-top: 20px; border-top: 2px solid rgba(100, 255, 218, 0.3); padding-top: 15px;">
            <div class="property-label" style="color: #64ffda; font-weight: 600; font-size: 14px;">⚡ Execution Results</div>
          </div>
        `;

        if (node.prompt) {
          executionOutputHTML += `
            <div class="property-group">
              <div class="property-label">Agent Prompt (${node.prompt.length} chars)</div>
              <textarea class="property-input property-textarea" readonly style="min-height: 150px; font-family: 'Monaco', monospace; font-size: 11px; background: rgba(0,0,0,0.3);">${escapeHtml(node.prompt)}</textarea>
            </div>
          `;
        }

        if (node.output) {
          executionOutputHTML += `
            <div class="property-group">
              <div class="property-label">Agent Output (${node.output.length} chars)</div>
              <textarea class="property-input property-textarea" readonly style="min-height: 200px; font-family: 'Monaco', monospace; font-size: 11px; background: rgba(0,0,0,0.3);">${escapeHtml(node.output)}</textarea>
            </div>
          `;
        }
      }

      this.propertiesContent.innerHTML = `
        <div class="property-group">
          <div class="property-label">Stage Name</div>
          <input type="text" class="property-input" value="${config.name}"
                 onchange="designer.updateNodeProperty('name', this.value)" />
        </div>
        <div class="property-group">
          <div class="property-label">Description</div>
          <textarea class="property-input property-textarea"
                    onchange="designer.updateNodeProperty('description', this.value)">${config.description}</textarea>
        </div>
        <div class="property-group">
          <div class="property-label">Type</div>
          <select class="property-input" onchange="designer.updateNodeProperty('type', this.value)">
            <option value="agent" ${config.type === 'agent' ? 'selected' : ''}>Agent</option>
            <option value="validator" ${config.type === 'validator' ? 'selected' : ''}>Validator</option>
            <option value="transformer" ${config.type === 'transformer' ? 'selected' : ''}>Transformer</option>
            <option value="gateway" ${config.type === 'gateway' ? 'selected' : ''}>Gateway</option>
          </select>
        </div>
        <div class="property-group">
          <div class="property-label">Agent</div>
          <input type="text" class="property-input" value="${config.agent || ''}"
                 onchange="designer.updateNodeProperty('agent', this.value)" />
        </div>
        <div class="property-group">
          <div class="property-label">Timeout (ms)</div>
          <input type="number" class="property-input" value="${config.timeout || 30000}"
                 onchange="designer.updateNodeProperty('timeout', parseInt(this.value))" />
        </div>
        <div class="property-group">
          <div class="property-label">Max Attempts</div>
          <input type="number" class="property-input" value="${config.retryPolicy?.maxAttempts || 3}"
                 onchange="designer.updateNodeRetryPolicy('maxAttempts', parseInt(this.value))" />
        </div>
        <div class="property-group">
          <div class="property-label">Configuration (JSON)</div>
          <textarea class="property-input property-textarea"
                    placeholder="Stage-specific JSON configuration..."
                    onchange="designer.updateNodeProperty('config', this.value)">${JSON.stringify(config.config || {}, null, 2)}</textarea>
        </div>
        ${executionOutputHTML}
      `;
    }
  }

  updatePipelineProperty(property, value) {
    if (property === 'globalConfig') {
      try {
        this.pipelineConfig[property] = JSON.parse(value);
      } catch (e) {
        console.warn('Invalid JSON for global config');
      }
    } else {
      this.pipelineConfig[property] = value;
    }
  }

  updateNodeProperty(property, value) {
    if (this.selectedNode) {
      const node = this.nodes.get(this.selectedNode);
      if (node) {
        if (property === 'config') {
          try {
            node.config[property] = JSON.parse(value);
          } catch (e) {
            console.warn('Invalid JSON for node config');
          }
        } else {
          node.config[property] = value;
        }
        
        // Update visual representation
        if (property === 'name') {
          const titleElement = node.element.querySelector('.node-title');
          if (titleElement) titleElement.textContent = value;
        } else if (property === 'description') {
          const descElement = node.element.querySelector('.node-description');
          if (descElement) descElement.textContent = value;
        }
      }
    }
  }

  updateNodeRetryPolicy(property, value) {
    if (this.selectedNode) {
      const node = this.nodes.get(this.selectedNode);
      if (node) {
        if (!node.config.retryPolicy) node.config.retryPolicy = {};
        node.config.retryPolicy[property] = value;
      }
    }
  }

  startConnection(fromNodeId) {
    console.log('🔗 [CONNECT] Starting connection from node:', fromNodeId);
    
    if (this.connectingFromNode) {
      console.log('🔗 [CONNECT] Completing connection to node:', fromNodeId);
      console.log('🔗 [CONNECT] Connection path:', this.connectingFromNode, '→', fromNodeId);
      
      // Complete the connection
      if (fromNodeId !== this.connectingFromNode) {
        const condition = prompt('Enter connection condition (e.g., "completed", "approved", "failed"):', 'completed');
        console.log('🔗 [CONNECT] User entered condition:', condition);
        
        if (condition) {
          console.log('🔗 [CONNECT] Creating connection...');
          this.createConnection(this.connectingFromNode, fromNodeId, condition);
          this.updateConnectionLines();
          
          // Show success message
          const fromNode = this.nodes.get(this.connectingFromNode);
          const toNode = this.nodes.get(fromNodeId);
          console.log('🔗 [CONNECT] Connection created successfully:', fromNode.config.name, '→', toNode.config.name);
          this.showConnectionSuccess(fromNode, toNode, condition);
        } else {
          console.log('🔗 [CONNECT] Connection cancelled - no condition provided');
        }
      } else {
        console.log('🔗 [CONNECT] Cannot connect node to itself');
      }
      
      // Clear connection state
      this.clearConnectionState();
    } else {
      // Start a new connection
      console.log('🔗 [CONNECT] Initiating new connection from:', fromNodeId);
      this.connectingFromNode = fromNodeId;
      
      // Clear any existing visual feedback
      this.clearConnectionState();
      
      const fromNode = this.nodes.get(fromNodeId);
      if (!fromNode) {
        console.error('❌ [CONNECT] Source node not found:', fromNodeId);
        return;
      }
      
      console.log('🔗 [CONNECT] Source node found:', fromNode.config.name);
      fromNode.element.classList.add('connecting-from');
      
      // Highlight potential targets
      const availableTargets = [];
      document.querySelectorAll('.pipeline-node').forEach(node => {
        if (node.dataset.nodeId !== fromNodeId) {
          node.classList.add('connecting-target');
          availableTargets.push(node.dataset.nodeId);
        }
      });
      
      console.log('🔗 [CONNECT] Available target nodes:', availableTargets);
      
      // Add mouse move listener for dynamic connection line
      this.canvas.addEventListener('mousemove', this.handleConnectionMouseMove.bind(this));
      
      console.log(`🔗 [CONNECT] Connection mode activated from: ${fromNode.config.name}`);
      this.showConnectionInstructions(fromNode.config.name);
    }
  }

  clearConnectionState() {
    this.connectingFromNode = null;
    document.querySelectorAll('.pipeline-node').forEach(node => {
      node.classList.remove('connecting-from', 'connecting-target');
    });
    
    // Remove temporary connection line
    const tempLine = document.getElementById('temp-connection-line');
    if (tempLine) {
      tempLine.remove();
    }
    
    // Remove instruction notification
    const instruction = document.getElementById('connection-instruction');
    if (instruction) {
      instruction.remove();
    }
    
    // Remove mouse move listener
    this.canvas.removeEventListener('mousemove', this.handleConnectionMouseMove.bind(this));
  }

  handleConnectionMouseMove(e) {
    if (!this.connectingFromNode) return;
    
    const fromNode = this.nodes.get(this.connectingFromNode);
    if (!fromNode) return;
    
    // Remove existing temporary line
    const existingTempLine = document.getElementById('temp-connection-line');
    if (existingTempLine) {
      existingTempLine.remove();
    }
    
    // Get mouse position relative to canvas
    const canvasRect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;
    
    // Get from node position
    const fromRect = fromNode.element.getBoundingClientRect();
    const fromX = fromRect.left + fromRect.width / 2 - canvasRect.left;
    const fromY = fromRect.top + fromRect.height / 2 - canvasRect.top;
    
    // Create temporary connection line
    const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tempLine.setAttribute('id', 'temp-connection-line');
    tempLine.setAttribute('x1', fromX);
    tempLine.setAttribute('y1', fromY);
    tempLine.setAttribute('x2', mouseX);
    tempLine.setAttribute('y2', mouseY);
    tempLine.setAttribute('stroke', 'rgba(100, 255, 218, 0.6)');
    tempLine.setAttribute('stroke-width', '2');
    tempLine.setAttribute('stroke-dasharray', '5,5');
    tempLine.style.pointerEvents = 'none';
    
    this.connectionLines.appendChild(tempLine);
  }

  showConnectionInstructions(fromNodeName) {
    // Remove existing instruction
    const existingInstruction = document.getElementById('connection-instruction');
    if (existingInstruction) {
      existingInstruction.remove();
    }
    
    // Create floating instruction notification
    const instruction = document.createElement('div');
    instruction.id = 'connection-instruction';
    instruction.className = 'connection-instruction-notification';
    instruction.innerHTML = `
      <div class="instruction-icon">🔗</div>
      <div class="instruction-text">
        <strong>Connection Mode Active</strong><br>
        From: ${fromNodeName}<br>
        <small>Click on a target node to create connection</small>
      </div>
    `;
    
    document.body.appendChild(instruction);
  }

  showConnectionSuccess(fromNode, toNode, condition) {
    // Create floating success notification
    const notification = document.createElement('div');
    notification.className = 'connection-success-notification';
    notification.innerHTML = `
      <div class="success-icon">✅</div>
      <div class="success-text">
        <strong>Connection Created!</strong><br>
        ${fromNode.config.name} → ${toNode.config.name}<br>
        <small>Condition: ${condition}</small>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  deleteNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.element.remove();
      this.nodes.delete(nodeId);
      
      // Remove connections involving this node
      this.connections = this.connections.filter(conn => 
        conn.from !== nodeId && conn.to !== nodeId
      );
      
      this.updateConnectionLines();
      
      if (this.selectedNode === nodeId) {
        this.selectNode(null);
      }
    }
  }

  updateConnectionLines() {
    // Clear existing lines
    this.connectionLines.innerHTML = '';
    
    // Draw new lines
    this.connections.forEach(connection => {
      this.drawConnection(connection);
    });
  }

  drawConnection(connection) {
    const fromNode = this.nodes.get(connection.from);
    const toNode = this.nodes.get(connection.to);
    
    if (fromNode && toNode && fromNode.element && toNode.element) {
      // Use the node's original position coordinates (before canvas transform)
      // This ensures connections use the same coordinate space as the nodes
      const nodeWidth = 200;
      const nodeHeight = 80; // More accurate estimate
      
      const fromX = fromNode.position.x + nodeWidth / 2;
      const fromY = fromNode.position.y + nodeHeight / 2;
      const toX = toNode.position.x + nodeWidth / 2;
      const toY = toNode.position.y + nodeHeight / 2;
      
      // Create smooth curved path
      const controlPointOffset = Math.abs(toX - fromX) * 0.5;
      const controlX1 = fromX + controlPointOffset;
      const controlY1 = fromY;
      const controlX2 = toX - controlPointOffset;
      const controlY2 = toY;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;
      path.setAttribute('d', d);
      path.setAttribute('class', 'connection-path');
      path.setAttribute('data-from', connection.from);
      path.setAttribute('data-to', connection.to);
      // Handle both string and object formats for condition
      console.log(`🔗 Drawing connection: from=${connection.from}, to=${connection.to}, condition=`, connection.condition);
      console.log(`   Type: ${typeof connection.condition}, Value:`, JSON.stringify(connection.condition));

      const conditionValue = typeof connection.condition === 'object'
        ? connection.condition.value
        : connection.condition;
      const conditionLabel = conditionValue || 'completed';

      console.log(`   Resolved label: "${conditionLabel}"`);

      path.setAttribute('data-condition', conditionLabel);

      // Add connection condition label at 1/3 position to avoid overlaps in loops
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const labelX = fromX + (toX - fromX) * 0.33;
      const labelY = fromY + (toY - fromY) * 0.33 - 10;
      label.setAttribute('x', labelX);
      label.setAttribute('y', labelY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'connection-label');
      label.textContent = conditionLabel;
      
      // Add hover events for connection manipulation
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleConnectionClick(connection);
      });
      
      this.connectionLines.appendChild(path);
      this.connectionLines.appendChild(label);
    }
  }

  handleConnectionClick(connection) {
    const fromNode = this.nodes.get(connection.from);
    const toNode = this.nodes.get(connection.to);

    if (fromNode && toNode) {
      // Handle both string and object formats for condition
      const conditionValue = typeof connection.condition === 'object'
        ? connection.condition.value
        : connection.condition;

      const choice = confirm(`Connection: ${fromNode.config.name} → ${toNode.config.name}\nCondition: ${conditionValue || 'completed'}\n\nClick OK to delete this connection, or Cancel to keep it.`);

      if (choice) {
        // Remove connection from array (handle both formats)
        this.connections = this.connections.filter(conn => {
          const connCondition = typeof conn.condition === 'object'
            ? conn.condition.value
            : conn.condition;
          const targetCondition = typeof connection.condition === 'object'
            ? connection.condition.value
            : connection.condition;
          return !(conn.from === connection.from && conn.to === connection.to && connCondition === targetCondition);
        });
        
        // Refresh connection display
        this.updateConnectionLines();
        
        console.log(`Connection deleted: ${fromNode.config.name} → ${toNode.config.name}`);
      }
    }
  }

  async loadTemplate(templateId) {
    try {
      console.log(`🧹 Clearing existing nodes (${this.nodes.size} nodes)`);
      
      // Clear existing nodes more thoroughly
      this.nodes.forEach(node => {
        if (node.element && node.element.parentNode) {
          node.element.parentNode.removeChild(node.element);
        }
      });
      this.nodes.clear();
      this.connections = [];
      
      // Also clear any orphaned DOM elements
      const canvas = document.getElementById('canvas');
      if (canvas) {
        const nodeElements = canvas.querySelectorAll('.node');
        nodeElements.forEach(element => {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
        console.log(`🧹 Removed ${nodeElements.length} orphaned node elements from DOM`);
      }
      
      // Clear connection state
      this.clearConnectionState();
      
      // Load template from server
      const template = await this.loadTemplateFromServer(templateId);
      
      if (template) {
        this.loadTemplateFromConfig(template);
      } else {
        console.error(`Template ${templateId} not found on server`);
        // Fallback to hardcoded loading for backward compatibility
        this.loadTemplateFallback(templateId);
      }
      
      this.updateConnectionLines();
    } catch (error) {
      console.error('Error loading template:', error);
      // Fallback to hardcoded loading
      this.loadTemplateFallback(templateId);
      this.updateConnectionLines();
    }
  }

  loadTemplateFallback(templateId) {
    // Fallback to old hardcoded loading
    if (templateId === 'claude-plus-v1') {
      this.loadClaudePlusTemplate();
    } else if (templateId === 'dynamic-engineering-v1') {
      this.loadDynamicEngineeringTemplate();
    } else if (templateId === 'thesis-generator-v1') {
      this.loadThesisGeneratorTemplate();
    }
  }

  loadTemplateFromConfig(template) {
    console.log(`📋 Loading template from config: ${template.name}`);

    // Set pipeline config (nodes already cleared by loadTemplate)
    this.pipelineConfig = {
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      category: template.category,
      globalConfig: {
        workingDirectory: null,
        maxRetries: 5,
        commentaryEnabled: true
      }
    };

    // Create nodes from stages with smart layout
    const nodeIds = [];

    // Check if template has custom layout positions first
    if (template.layout && template.layout.positions) {
      console.log(`📐 Using custom layout positions from template`);
      
      template.stages.forEach(stage => {
        const position = template.layout.positions[stage.id];
        const x = position ? position.x : 5000;
        const y = position ? position.y : 5000;
        
        const nodeId = this.createNode({
          id: stage.id,
          name: stage.name,
          type: stage.type || 'agent',
          icon: this.getStageIcon(stage.type),
          description: stage.description,
          agent: stage.agent,
          x: x,
          y: y,
          config: {
            inputs: stage.inputs || [],
            outputs: stage.outputs || [],
            phase: stage.phase
          }
        });
        nodeIds.push(nodeId);
      });
    } else {
      // Smart flowchart-style DAG layout
      console.log('📐 Computing smart flowchart layout from connections...');

      // Build connection map
      const connections = template.connections || [];
      const stageMap = {};
      template.stages.forEach(s => stageMap[s.id] = s);

      // Find primary flow path (follow first connection from each node)
      const primaryNext = {}; // node -> its primary next node
      const allTargets = new Set();

      connections.forEach(conn => {
        if (conn.to !== 'end') {
          allTargets.add(conn.to);
          // First connection from a node is "primary"
          if (!primaryNext[conn.from]) {
            primaryNext[conn.from] = conn.to;
          }
        }
      });

      // Find start node
      let startNode = template.startStage;
      if (!startNode) {
        for (const stage of template.stages) {
          if (!allTargets.has(stage.id)) {
            startNode = stage.id;
            break;
          }
        }
      }
      if (!startNode) startNode = template.stages[0]?.id;

      // Build primary chain (the main happy path)
      const primaryChain = [];
      const inChain = new Set();
      let current = startNode;
      while (current && !inChain.has(current)) {
        primaryChain.push(current);
        inChain.add(current);
        current = primaryNext[current];
      }

      // Find nodes not in primary chain (branch/loop nodes)
      const branchNodes = template.stages
        .map(s => s.id)
        .filter(id => !inChain.has(id));

      console.log(`📐 Primary chain: ${primaryChain.length} nodes, Branch nodes: ${branchNodes.length}`);
      console.log(`📐 Primary chain: ${primaryChain.join(' → ')}`);

      // Position settings
      const xStart = 4700;
      const yMain = 5000;
      const xSpacing = 350;
      const yBranchOffset = 200;
      const nodePositions = {};

      // If primary chain is too short (< 50% of nodes), use grid layout instead
      if (primaryChain.length < template.stages.length * 0.5) {
        console.log('📐 Primary chain too short, using smart grid layout');

        // Use the stages array order but arrange in a flowing grid
        const nodesPerRow = Math.ceil(Math.sqrt(template.stages.length * 2)); // Wide rectangle
        template.stages.forEach((stage, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          nodePositions[stage.id] = {
            x: xStart + col * xSpacing,
            y: yMain - 200 + row * 180
          };
        });
      } else {
        // Position primary chain horizontally
        primaryChain.forEach((nodeId, index) => {
          nodePositions[nodeId] = {
            x: xStart + index * xSpacing,
            y: yMain
          };
        });
      }

      // Position branch nodes near their connection points (only if we used primary chain layout)
      if (primaryChain.length >= template.stages.length * 0.5) {
        branchNodes.forEach((nodeId, index) => {
          // Default position: spread out below the main flow
          let nearX = xStart + (index + 1) * xSpacing;
          let nearY = yMain + yBranchOffset * (1 + Math.floor(index / 3)); // Stack rows if many branches

          // Try to find better position based on connections
          let foundConnection = false;

          // Check what connects TO this node
          connections.forEach(conn => {
            if (conn.to === nodeId && nodePositions[conn.from]) {
              nearX = nodePositions[conn.from].x + xSpacing * 0.5;
              foundConnection = true;
            }
          });

          // Check what this node connects TO
          connections.forEach(conn => {
            if (conn.from === nodeId && nodePositions[conn.to]) {
              if (!foundConnection) {
                nearX = nodePositions[conn.to].x - xSpacing * 0.5;
              } else {
                // Average the two positions
                nearX = (nearX + nodePositions[conn.to].x - xSpacing * 0.5) / 2;
              }
            }
          });

          // Alternate above/below for variety
          if (index % 2 === 1) {
            nearY = yMain - yBranchOffset;
          }

          nodePositions[nodeId] = { x: nearX, y: nearY };
        });
      }

      // Second pass: refine branch node positions based on connections
      // Put fix_issues type nodes (loop-back nodes) below the main flow
      connections.forEach(conn => {
        // If a node connects BACKWARD (to earlier in chain), put it below
        const fromChainIdx = primaryChain.indexOf(conn.from);
        const toChainIdx = primaryChain.indexOf(conn.to);

        if (fromChainIdx > toChainIdx && toChainIdx >= 0) {
          // This is a loop-back connection, the 'from' node should be positioned
          // such that the loop is visible - usually already handled
        }
      });

      // Special handling: find "fix" or "retry" nodes and position them nicely
      branchNodes.forEach(nodeId => {
        const stage = stageMap[nodeId];
        if (!stage) return;

        // If this node loops back, position it below the midpoint of the loop
        connections.forEach(conn => {
          if (conn.from === nodeId) {
            const targetIdx = primaryChain.indexOf(conn.to);
            if (targetIdx >= 0) {
              // Find what connects TO this node
              connections.forEach(c2 => {
                if (c2.to === nodeId) {
                  const sourceIdx = primaryChain.indexOf(c2.from);
                  if (sourceIdx >= 0 && sourceIdx > targetIdx) {
                    // This is a loop: source -> nodeId -> target (backwards)
                    const midX = (nodePositions[primaryChain[sourceIdx]].x + nodePositions[primaryChain[targetIdx]].x) / 2;
                    nodePositions[nodeId] = {
                      x: midX,
                      y: yMain + yBranchOffset
                    };
                  }
                }
              });
            }
          }
        });
      });

      // Create nodes at computed positions
      template.stages.forEach(stage => {
        const pos = nodePositions[stage.id] || { x: xStart, y: yMain };

        const nodeId = this.createNode({
          id: stage.id,
          name: stage.name,
          type: stage.type || 'agent',
          icon: this.getStageIcon(stage.type),
          description: stage.description,
          agent: stage.agent,
          x: pos.x,
          y: pos.y,
          config: {
            inputs: stage.inputs || [],
            outputs: stage.outputs || []
          }
        });
        nodeIds.push(nodeId);
      });

      console.log(`📐 Flowchart layout: ${primaryChain.length} main nodes, ${branchNodes.length} branch nodes`);
    }

    // Create edges based on flow or connections
    if (template.connections && Array.isArray(template.connections)) {
      // Use explicit connections from template
      console.log(`🔗 Creating ${template.connections.length} connections from template`);
      template.connections.forEach(conn => {
        console.log(`🔗 Loading connection: from=${conn.from}, to=${conn.to}, condition=`, conn.condition);
        const fromNode = document.querySelector(`[data-node-id="${conn.from}"]`);
        const toNode = document.querySelector(`[data-node-id="${conn.to}"]`);
        if (fromNode && toNode) {
          // Use actual condition from connection, not hardcoded 'completed'
          this.createConnection(conn.from, conn.to, conn.condition || 'completed', conn.description);
        } else {
          console.warn(`⚠️ Could not create connection: ${conn.from} -> ${conn.to} (nodes not found)`);
        }
      });
    } else if (template.flow) {
      if (template.flow.type === 'sequential') {
        // Simple sequential flow
        for (let i = 0; i < nodeIds.length - 1; i++) {
          this.createConnection(nodeIds[i], nodeIds[i + 1], 'completed');
        }
      } else if (template.flow.type === 'conditional' && template.flow.connections) {
        // Conditional flow with explicit connections
        template.flow.connections.forEach(conn => {
          const fromId = template.stages.find(s => s.id === conn.from)?.id;
          // Allow null toId for pipeline completion connections
          const toId = conn.to === null ? null : template.stages.find(s => s.id === conn.to)?.id;
          if (fromId && (toId !== undefined)) {
            this.createConnection(fromId, toId, conn.condition || 'completed', conn.description);
          }
        });
      }
    }

    console.log(`✅ Loaded template "${template.name}" from server with ${template.stages.length} stages`);

    // Center viewport on the loaded nodes
    this.centerViewportOnNodes();
  }

  getStageIcon(stageType) {
    const icons = {
      'designer': '🎨',
      'reviewer': '🔍',
      'integrator': '🔧',
      'validator': '✅',
      'agent': '🤖',
      'planner': '🧠',
      'executor': '⚡'
    };
    return icons[stageType] || '📦';
  }

  loadClaudePlusTemplate() {
    this.pipelineConfig = {
      id: 'claude-plus-v1',
      name: 'Claude Plus Multi-Agent Validation',
      description: 'Revolutionary 4-phase planning-review-execute-validate pipeline',
      version: '1.0.0',
      globalConfig: {
        workingDirectory: null,
        maxRetries: 5,
        commentaryEnabled: true
      }
    };

    // Create nodes
    const planningId = this.createNode({
      id: 'planning',
      name: 'Task Planning',
      type: 'agent',
      icon: '🧠',
      description: 'Create detailed implementation plans',
      agent: 'task_planner',
      x: 100,
      y: 100,
      config: { maxAttempts: 5, requiresApproval: true }
    });

    const reviewId = this.createNode({
      id: 'review',
      name: 'Expert Review',
      type: 'validator',
      icon: '🕵️',
      description: 'Rigorous plan validation and feedback',
      agent: 'discerning_expert',
      x: 400,
      y: 100,
      config: { strictMode: true, minQualityScore: 8.0 }
    });

    const executionId = this.createNode({
      id: 'execution',
      name: 'Task Execution',
      type: 'agent',
      icon: '⚡',
      description: 'Implement approved plans with evidence collection',
      agent: 'task_executor',
      x: 700,
      y: 100,
      config: { requireEvidence: true, validateAgainstPlan: true }
    });

    const validationId = this.createNode({
      id: 'validation',
      name: 'Proof Validation',
      type: 'validator',
      icon: '✅',
      description: 'Final quality assurance and proof verification',
      agent: 'proof_validator',
      x: 1000,
      y: 100,
      config: { requireProof: true, minEvidenceScore: 7.0 }
    });

    // Create connections
    this.createConnection(planningId, reviewId, 'plan_ready');
    this.createConnection(reviewId, executionId, 'approved');
    this.createConnection(reviewId, planningId, 'rejected');
    this.createConnection(executionId, validationId, 'completed');
    this.createConnection(validationId, executionId, 'validation_failed');
  }

  loadDynamicEngineeringTemplate() {
    this.pipelineConfig = {
      id: 'dynamic-engineering-v1',
      name: 'Dynamic Engineering Pipeline',
      description: 'Next-generation adaptive pipeline with parallel processing',
      version: '1.0.0',
      globalConfig: {
        adaptiveRouting: true,
        parallelProcessing: true,
        realTimeMonitoring: true
      }
    };

    // Create nodes for dynamic engineering template
    // Implementation would create the more complex dynamic template
  }

  loadThesisGeneratorTemplate() {
    this.pipelineConfig = {
      id: 'thesis-generator-v1',
      name: 'Academic Thesis Statement Generator',
      description: 'Specialized pipeline for generating strong, arguable thesis statements for academic writing',
      version: '1.0.0',
      globalConfig: {
        academicLevel: 'university',
        citationStyle: 'mla',
        requireEvidence: true
      }
    };

    // Create nodes for the thesis generation pipeline
    const topicAnalysisId = this.createNode({
      id: 'topic_analysis',
      name: 'Topic Analysis',
      type: 'analyzer',
      icon: '🔍',
      description: 'Deep analysis of the writing topic',
      agent: 'topic_analyzer',
      x: 100,
      y: 100,
      config: { researchDepth: 'comprehensive', identifyControversies: true }
    });

    const positionGenId = this.createNode({
      id: 'position_generation',
      name: 'Position Generation',
      type: 'generator',
      icon: '💡',
      description: 'Generate multiple thesis positions',
      agent: 'position_generator',
      x: 400,
      y: 100,
      config: { generateCount: 5, ensureArgumentability: true }
    });

    const evaluationId = this.createNode({
      id: 'thesis_evaluation',
      name: 'Quality Evaluation',
      type: 'validator',
      icon: '📊',
      description: 'Evaluate thesis quality and strength',
      agent: 'thesis_evaluator',
      x: 700,
      y: 100,
      config: { requireArgumentability: true, minScore: 7.0 }
    });

    const refinementId = this.createNode({
      id: 'thesis_refinement',
      name: 'Final Refinement',
      type: 'refiner',
      icon: '✨',
      description: 'Polish and perfect the thesis',
      agent: 'thesis_refiner',
      x: 400,
      y: 300,
      config: { provideOutline: true, identifyCounterarguments: true }
    });

    // Create connections
    this.createConnection(topicAnalysisId, positionGenId, 'analysis_complete');
    this.createConnection(positionGenId, evaluationId, 'positions_generated');
    this.createConnection(evaluationId, refinementId, 'approved_positions');
    this.createConnection(evaluationId, positionGenId, 'needs_revision');
  }

  // Animate pipeline nodes during execution
  animatePipelineNode(stageName, stageColor, stageIcon) {
    console.log(`🎬 Animating stage: ${stageName}`);
    
    // Reset all nodes to normal state first
    this.nodes.forEach((node, nodeId) => {
      const element = node.element;
      element.classList.remove('pipeline-active', 'pipeline-completed');
      element.style.borderColor = '';
      element.style.boxShadow = '';
    });
    
    // Find matching node based on stage name or node properties
    let targetNodeId = null;
    
    // Map stage names to node IDs or properties
    const stageMapping = {
      'Task Planning': ['planning', 'task_planner', 'plan'],
      'Topic Analysis': ['topic_analysis', 'analyzer'],
      'Position Generation': ['position_generation', 'generator'],
      'Quality Evaluation': ['thesis_evaluation', 'review', 'validator', 'expert'],
      'Final Refinement': ['thesis_refinement', 'refiner'],
      'Task Execution': ['execution', 'executor'],
      'Proof Validation': ['validation', 'proof_validator']
    };
    
    // Find the node that matches this stage
    this.nodes.forEach((node, nodeId) => {
      // Safely get node properties with fallbacks
      const nodeNameLower = (node.name || '').toLowerCase();
      const nodeTypeLower = (node.type || '').toLowerCase();
      const nodeAgentLower = (node.agent || '').toLowerCase();
      const nodeIdLower = (nodeId || '').toLowerCase();
      
      const keywords = stageMapping[stageName] || [stageName.toLowerCase()];
      
      for (const keyword of keywords) {
        if (nodeNameLower.includes(keyword) || 
            nodeTypeLower.includes(keyword) || 
            nodeAgentLower.includes(keyword) ||
            nodeIdLower.includes(keyword)) {
          targetNodeId = nodeId;
          break;
        }
      }
    });
    
    if (targetNodeId) {
      const node = this.nodes.get(targetNodeId);
      const element = node.element;
      
      // Add active animation class
      element.classList.add('pipeline-active');
      
      // Apply glowing border effect
      element.style.borderColor = stageColor;
      element.style.boxShadow = `0 0 20px ${stageColor}, 0 0 40px ${stageColor}55`;
      
      // Update the node icon temporarily
      const iconElement = element.querySelector('.node-icon');
      if (iconElement) {
        const originalIcon = iconElement.textContent;
        iconElement.textContent = stageIcon;
        iconElement.style.backgroundColor = stageColor;
        
        // Restore original icon after animation
        setTimeout(() => {
          iconElement.textContent = originalIcon;
          iconElement.style.backgroundColor = '';
        }, 3000);
      }
      
      console.log(`✨ Animated node ${targetNodeId} for stage ${stageName}`);
    } else {
      console.log(`⚠️ No matching node found for stage: ${stageName}`);
    }
  }

  // Show commentator popup along connection paths
  showCommentatorPopup(message, fromStage, toStage) {
    console.log(`💬 Commentator: ${message}`);
    
    // Show commentator messages in the chat interface instead of confusing canvas overlays
    this.addChatMessage('system', 'Commentator', message, null, '💬');
    
    // Show a brief visual indicator in a fixed position (not overlaying canvas)
    const indicator = document.createElement('div');
    indicator.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 8px 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        gap: 6px;
        animation: slideInRight 0.3s ease-out;
      ">
        <div style="font-size: 14px;">💬</div>
        <div style="color: white; font-size: 11px; font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${message.length > 50 ? message.substring(0, 50) + '...' : message}
        </div>
      </div>
    `;
    
    indicator.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      z-index: 2000;
      pointer-events: none;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
      }
    }, 3000);
  }

  loadDefaultTemplate() {
    this.loadTemplate('claude-plus-v1');
  }

  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  startMetricsUpdate() {
    setInterval(() => {
      this.updateMetrics();
    }, 2000);
  }

  checkForRunningPipeline() {
    console.log('🔍 [RECONNECT] Checking for running pipeline...');
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'check-running-pipeline'
      }));
    } else {
      // Wait for WebSocket connection
      setTimeout(() => this.checkForRunningPipeline(), 1000);
    }
  }

  async checkExecutionEngineStatus() {
    const statusElement = document.getElementById('executionStatus');
    const statusText = document.getElementById('statusText');
    const executeBtn = document.getElementById('executeBtn');
    
    try {
      // Try to connect to the proxy server
      const ws = new WebSocket('ws://localhost:8081');
      
      ws.onopen = () => {
        statusElement.className = 'execution-status connected';
        statusText.textContent = '🟢 Engine Ready';
        executeBtn.textContent = '🚀 Execute Pipeline';
        executeBtn.disabled = false;
        ws.close();
      };
      
      ws.onerror = () => {
        statusElement.className = 'execution-status disconnected';
        statusText.textContent = '🔴 Engine Offline';
        executeBtn.textContent = '⚠️ Start Engine First';
        executeBtn.disabled = true;
      };
      
      // Timeout after 3 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          statusElement.className = 'execution-status disconnected';
          statusText.textContent = '🔴 Engine Offline';
          executeBtn.textContent = '⚠️ Start Engine First';
          executeBtn.disabled = true;
        }
      }, 3000);
      
    } catch (error) {
      statusElement.className = 'execution-status disconnected';
      statusText.textContent = '🔴 Engine Offline';
      executeBtn.textContent = '⚠️ Start Engine First';
      executeBtn.disabled = true;
    }
    
    // Check status every 10 seconds
    setTimeout(() => {
      this.checkExecutionEngineStatus();
    }, 10000);
  }

  updateMetrics() {
    // Simulate metrics for demo
    const metrics = {
      activeExecutions: Math.floor(Math.random() * 5),
      successRate: (85 + Math.random() * 10).toFixed(1),
      avgExecutionTime: (2000 + Math.random() * 3000).toFixed(0),
      totalExecutions: 1247 + Math.floor(Math.random() * 100)
    };

    document.getElementById('activeExecutions').textContent = metrics.activeExecutions;
    document.getElementById('successRate').textContent = `${metrics.successRate}%`;
    document.getElementById('avgExecutionTime').textContent = `${metrics.avgExecutionTime}ms`;
    document.getElementById('totalExecutions').textContent = metrics.totalExecutions;
  }

  exportPipeline() {
    const pipeline = {
      ...this.pipelineConfig,
      stages: Array.from(this.nodes.values()).map(node => ({
        id: node.config.id,
        name: node.config.name,
        type: node.config.type,
        description: node.config.description,
        agent: node.config.agent,
        config: node.config.config,
        position: node.position
      })),
      connections: this.connections,
      flow: {
        type: 'conditional',
        description: 'Each stage must complete before the next begins',
        connections: this.connections
      }
    };

    return JSON.stringify(pipeline, null, 2);
  }

  createConnection(fromNodeId, toNodeId, condition = 'completed', description = null) {
    console.log('🔗 [CREATE] Creating connection:', {
      from: fromNodeId,
      to: toNodeId,
      condition: condition,
      description: description
    });

    // Check if connection already exists
    const existingConnection = this.connections.find(conn =>
      conn.from === fromNodeId && conn.to === toNodeId
    );

    if (existingConnection) {
      console.log('⚠️ [CREATE] Connection already exists, updating condition:', existingConnection);
      existingConnection.condition = condition;
      if (description) existingConnection.description = description;
    } else {
      // Add connection to the connections array
      const newConnection = {
        from: fromNodeId,
        to: toNodeId,
        condition: condition
      };
      if (description) newConnection.description = description;
      this.connections.push(newConnection);
      console.log('✅ [CREATE] New connection added. Total connections:', this.connections.length);
    }

    console.log('🔗 [CREATE] Current connections:', this.connections);
  }

  // PIPELINE COMPOSITION METHODS
  createCompositeNode(templateId, x, y) {
    // Get template configuration
    const template = this.getTemplateConfig(templateId);
    if (!template) {
      console.error('Template not found:', templateId);
      return;
    }

    // Create composite node using existing createNode method
    const compositeId = this.createNode({
      id: this.generateNodeId(),
      name: `${template.name} (Composite)`,
      type: 'composite',
      description: `Embedded pipeline: ${template.description}`,
      icon: this.getTemplateIcon(templateId),
      x: x,
      y: y,
      template: templateId,
      agent: 'composite'
    });

    // Get the created node and mark it as composite
    const node = this.nodes.get(compositeId);
    node.isComposite = true;
    node.expanded = false;
    node.config.subPipeline = template;
    node.config.template = templateId;

    // Add composite styling
    node.element.classList.add('composite');
    
    // Add expand/collapse functionality
    this.addCompositeControls(node);

    console.log(`Created composite node for ${template.name} at (${x}, ${y})`);
    return compositeId;
  }

  getTemplateConfig(templateId) {
    // This method is now async and will be replaced by loadTemplateFromServer
    // Keeping for backward compatibility during transition
    console.warn('getTemplateConfig is deprecated. Use loadTemplateFromServer instead.');
    return null;
  }

  async loadTemplateFromServer(templateId) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket('ws://localhost:8081');
        
        ws.onopen = () => {
          // Wait for connection confirmation before sending request
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'get-template',
              templateId: templateId
            }));
          }, 100);
        };
        
        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            if (response.type === 'template-data') {
              console.log(`📋 Template data received for: ${templateId}`);
              resolve(response.template);
              ws.close();
            } else if (response.type === 'template-not-found') {
              console.log(`❌ Template not found: ${templateId}`);
              resolve(null);
              ws.close();
            } else if (response.type === 'system') {
              console.log(`📡 System connection confirmed for template request`);
              // Don't close on system message, wait for actual response
            }
          } catch (error) {
            reject(error);
            ws.close();
          }
        };
        
        ws.onerror = () => {
          reject(new Error('Failed to connect to server'));
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  getTemplateIcon(templateId) {
    const icons = {
      'claude-plus-v1': '🚀',
      'thesis-generator-v1': '🎓',
      'dynamic-engineering-v1': '⚡',
      'thesis-preprocessing-v1': '🎯'
    };
    return icons[templateId] || '📦';
  }

  addCompositeControls(compositeNode) {
    const nodeElement = compositeNode.element;
    
    // Add expand/collapse button
    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = compositeNode.expanded ? '📦' : '📂';
    expandBtn.className = 'composite-expand-btn';
    expandBtn.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(100, 255, 218, 0.8);
      border: none;
      border-radius: 4px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 12px;
      color: black;
      font-weight: bold;
    `;

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCompositeExpansion(compositeNode.element.dataset.nodeId);
    });

    nodeElement.appendChild(expandBtn);

    // Add visual indicator for composite node
    nodeElement.style.borderColor = 'rgba(100, 255, 218, 0.8)';
    nodeElement.style.boxShadow = '0 0 16px rgba(100, 255, 218, 0.3)';
    
    // Add composite label
    const compositeLabel = document.createElement('div');
    compositeLabel.textContent = 'COMPOSITE';
    compositeLabel.style.cssText = `
      position: absolute;
      top: -8px;
      left: 8px;
      background: rgba(100, 255, 218, 0.9);
      color: black;
      font-size: 10px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    `;
    nodeElement.appendChild(compositeLabel);
  }

  toggleCompositeExpansion(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.isComposite) return;

    node.expanded = !node.expanded;
    const expandBtn = node.element.querySelector('.composite-expand-btn');
    
    if (node.expanded) {
      // Show sub-pipeline stages
      this.expandCompositeNode(node);
      expandBtn.innerHTML = '📦';
    } else {
      // Hide sub-pipeline stages  
      this.collapseCompositeNode(node);
      expandBtn.innerHTML = '📂';
    }
  }

  expandCompositeNode(compositeNode) {
    if (!compositeNode.config.subPipeline) return;

    const baseX = compositeNode.position.x + 50;
    const baseY = compositeNode.position.y + 100;
    const spacing = 200;

    // Create sub-nodes for each stage in the template
    compositeNode.subNodes = [];
    compositeNode.config.subPipeline.stages.forEach((stage, index) => {
      const subNodeId = this.createNode({
        id: `${compositeNode.id}_${stage.id}`,
        name: stage.name,
        type: stage.type,
        icon: this.getStageIcon(stage.type),
        description: `${stage.name} (from ${compositeNode.config.subPipeline.name})`,
        agent: stage.agent,
        x: baseX + (index * spacing),
        y: baseY,
        parentComposite: compositeNode.element.dataset.nodeId,
        isSubNode: true
      });
      
      compositeNode.subNodes.push(subNodeId);
      
      // Style sub-nodes differently
      const subNodeElement = this.nodes.get(subNodeId).element;
      subNodeElement.classList.add('sub-node');
      subNodeElement.style.transform = 'scale(0.8)';
      subNodeElement.style.opacity = '0.9';
      subNodeElement.style.borderStyle = 'dashed';
    });

    // Create connections between sub-nodes
    for (let i = 0; i < compositeNode.subNodes.length - 1; i++) {
      this.createConnection(compositeNode.subNodes[i], compositeNode.subNodes[i + 1], 'completed');
    }

    this.updateConnectionLines();
  }

  collapseCompositeNode(compositeNode) {
    if (!compositeNode.subNodes) return;

    // Remove all sub-nodes and their connections
    compositeNode.subNodes.forEach(subNodeId => {
      const subNode = this.nodes.get(subNodeId);
      if (subNode) {
        subNode.element.remove();
        this.nodes.delete(subNodeId);
      }
    });

    // Remove connections involving sub-nodes
    this.connections = this.connections.filter(conn => 
      !compositeNode.subNodes.includes(conn.from) && 
      !compositeNode.subNodes.includes(conn.to)
    );

    compositeNode.subNodes = [];
    this.updateConnectionLines();
  }

  getStageIcon(stageType) {
    const icons = {
      'agent': '🤖',
      'validator': '✅',
      'analyzer': '🔍',
      'generator': '⚡',
      'refiner': '✨',
      'transformer': '🔄',
      'gateway': '🚪',
      'parallel': '🔀'
    };
    return icons[stageType] || '🔧';
  }

  // DRAG & DROP ENHANCEMENT METHODS
  getNodeAtPosition(x, y) {
    for (const [nodeId, node] of this.nodes) {
      const rect = node.element.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      const nodeX = (rect.left - canvasRect.left) / this.zoom;
      const nodeY = (rect.top - canvasRect.top) / this.zoom;
      const nodeWidth = rect.width / this.zoom;
      const nodeHeight = rect.height / this.zoom;
      
      if (x >= nodeX && x <= nodeX + nodeWidth && 
          y >= nodeY && y <= nodeY + nodeHeight) {
        return node;
      }
    }
    return null;
  }

  highlightDropTargets(target) {
    // Highlight nodes that can accept template drops
    document.querySelectorAll('.pipeline-node').forEach(node => {
      const nodeData = this.nodes.get(node.dataset.nodeId);
      if (nodeData && !nodeData.isComposite) {
        node.classList.add('drop-target-highlight');
      }
    });
  }

  clearDropHighlights() {
    document.querySelectorAll('.drop-target-highlight').forEach(node => {
      node.classList.remove('drop-target-highlight');
    });
  }

  replaceNodeWithComposite(targetNodeId, templateId) {
    const targetNode = this.nodes.get(targetNodeId);
    const template = this.getTemplateConfig(templateId);
    
    if (!targetNode || !template) return;
    
    // Show confirmation dialog
    const confirmMessage = `🔄 Replace "${targetNode.config.name}" with "${template.name}" pipeline?\n\nThis will enhance "${targetNode.config.name}" with the capabilities of the ${template.name} pipeline.`;
    
    if (confirm(confirmMessage)) {
      // Store position and connections
      const position = targetNode.position;
      const incomingConnections = this.connections.filter(conn => conn.to === targetNodeId);
      const outgoingConnections = this.connections.filter(conn => conn.from === targetNodeId);
      
      // Remove old node
      targetNode.element.remove();
      this.nodes.delete(targetNodeId);
      
      // Create enhanced composite node
      const compositeId = this.createCompositeNode(templateId, position.x, position.y);
      const compositeNode = this.nodes.get(compositeId);
      
      // Update the composite to show it's enhancing the original functionality
      compositeNode.config.name = `${targetNode.config.name} (Enhanced with ${template.name})`;
      compositeNode.config.description = `${targetNode.config.description} - Now powered by ${template.description}`;
      compositeNode.element.querySelector('.node-title').textContent = compositeNode.config.name;
      compositeNode.element.querySelector('.node-description').textContent = compositeNode.config.description;
      
      // Restore connections with the new composite node
      incomingConnections.forEach(conn => {
        conn.to = compositeId;
      });
      outgoingConnections.forEach(conn => {
        conn.from = compositeId;
      });
      
      // Update visual connections
      this.updateConnectionLines();
      
      // Show success message
      setTimeout(() => {
        alert(`✨ Success! "${targetNode.config.name}" is now enhanced with the power of ${template.name}!\n\nClick the 📂 button to see the internal pipeline stages.`);
      }, 500);
    }
  }

  // Enhanced node creation to support drag-and-drop onto existing nodes
  handleNodeDrop(targetNodeId, dragData) {
    if (dragData.type === 'template') {
      this.replaceNodeWithComposite(targetNodeId, dragData.id);
    }
  }
  
  // Dynamically detect which stage is active from status messages
  detectActiveStage(statusMessage) {
    // Get the current pipeline configuration
    const currentPipeline = this.pipelineConfig;
    if (!currentPipeline || !currentPipeline.stages) {
      return null;
    }
    
    const messageLower = statusMessage.toLowerCase();
    
    // Check each stage in the pipeline for exact agent match
    for (const stage of currentPipeline.stages) {
      const agentName = stage.agent ? stage.agent.toLowerCase() : '';
      
      // Direct agent matching: LORE_ARCHITECT -> lore_architect
      if (agentName && (messageLower.includes(agentName) || messageLower.includes(agentName.toUpperCase()))) {
        return {
          id: stage.id,
          icon: this.getStageIcon(stage),
          color: this.getStageColor(stage)
        };
      }
    }
    
    return null;
  }
  
  // Detect active stage directly from agent name (cleaner approach)
  detectActiveStageFromAgent(agentName) {
    if (!agentName) {
      console.log('🚫 No agent name provided');
      return null;
    }
    
    const currentPipeline = this.pipelineConfig;
    console.log('📋 Pipeline config:', currentPipeline);
    console.log('📋 Pipeline stages:', currentPipeline ? currentPipeline.stages : 'undefined');
    if (!currentPipeline || !currentPipeline.stages) {
      console.log('🚫 No pipeline config or stages found');
      return null;
    }
    
    const agentLower = agentName.toLowerCase();
    console.log('🔍 Looking for agent:', agentLower, 'in', currentPipeline.stages.length, 'stages');
    
    // Find stage where agent matches exactly
    for (const stage of currentPipeline.stages) {
      const stageAgent = stage.agent ? stage.agent.toLowerCase() : '';
      console.log('  - Checking stage:', stage.id, 'agent:', stageAgent);
      
      // Direct match: LORE_ARCHITECT -> lore_architect
      if (stageAgent === agentLower || stageAgent === agentLower.replace('_', '')) {
        console.log('✅ Found matching stage:', stage.id);
        return {
          id: stage.id,
          icon: this.getStageIcon(stage),
          color: this.getStageColor(stage)
        };
      }
    }
    
    console.log('❌ No matching stage found for agent:', agentLower);
    return null;
  }
  
  // Get appropriate icon for stage based on its type or agent name
  getStageIcon(stage) {
    if (!stage || !stage.id) return '🤖';
    
    const stageId = stage.id.toLowerCase();
    const stageType = stage.type ? stage.type.toLowerCase() : '';
    
    // Icon mapping based on stage function
    if (stageId.includes('lore') || stageId.includes('architect')) return '📚';
    if (stageId.includes('historian') || stageId.includes('history')) return '📜';
    if (stageId.includes('geography') || stageId.includes('map')) return '🗺️';
    if (stageId.includes('ecology') || stageId.includes('environment')) return '🌿';
    if (stageId.includes('culture') || stageId.includes('society')) return '🏛️';
    if (stageId.includes('resource') || stageId.includes('material')) return '💎';
    if (stageId.includes('economy') || stageId.includes('trade')) return '💰';
    if (stageId.includes('market') || stageId.includes('simulator')) return '📈';
    if (stageId.includes('combat') || stageId.includes('battle')) return '⚔️';
    if (stageId.includes('balance') || stageId.includes('analyzer')) return '⚖️';
    if (stageId.includes('progression') || stageId.includes('advancement')) return '📊';
    if (stageId.includes('engagement') || stageId.includes('scorer')) return '🎯';
    if (stageId.includes('integrator') || stageId.includes('system')) return '🔧';
    if (stageId.includes('emergence') || stageId.includes('detector')) return '🔍';
    if (stageId.includes('player') || stageId.includes('experience')) return '👤';
    if (stageId.includes('data') || stageId.includes('model')) return '🗃️';
    if (stageId.includes('api') || stageId.includes('interface')) return '🔌';
    if (stageId.includes('code') || stageId.includes('generator')) return '💻';
    if (stageId.includes('technical') || stageId.includes('validator')) return '🔧';
    if (stageId.includes('gameplay') || stageId.includes('game')) return '🎮';
    if (stageId.includes('narrative') || stageId.includes('story')) return '📖';
    if (stageId.includes('final') || stageId.includes('complete')) return '✨';
    
    // Default based on stage type
    if (stageType === 'designer') return '🎨';
    if (stageType === 'reviewer' || stageType === 'validator') return '✅';
    if (stageType === 'executor') return '⚡';
    if (stageType === 'integrator') return '🔧';
    
    return '🤖'; // Default
  }
  
  // Get appropriate color for stage based on its phase or type
  getStageColor(stage) {
    if (!stage) return '#805ad5';
    
    const phase = stage.config && stage.config.phase ? stage.config.phase.toLowerCase() : '';
    const stageType = stage.type ? stage.type.toLowerCase() : '';
    
    // Color by phase
    if (phase === 'world_building') return '#9f7aea';
    if (phase === 'systems_design') return '#4299e1';
    if (phase === 'integration') return '#38b2ac';
    if (phase === 'implementation') return '#48bb78';
    if (phase === 'validation') return '#ed8936';
    
    // Color by type as fallback
    if (stageType === 'designer') return '#f56565';
    if (stageType === 'reviewer' || stageType === 'validator') return '#48bb78';
    if (stageType === 'executor') return '#38b2ac';
    if (stageType === 'integrator') return '#ed8936';
    
    return '#805ad5'; // Default purple
  }
  
  // Get appropriate icon for agent based on its role/type
  getAgentIcon(agent) {
    const agentId = agent.id ? agent.id.toLowerCase() : '';
    const agentName = agent.name ? agent.name.toLowerCase() : '';
    
    // Icon mapping based on agent function
    if (agentId.includes('commentator') || agentName.includes('commentator')) return '💬';
    if (agentId.includes('planner') || agentName.includes('planner')) return '🧠';
    if (agentId.includes('executor') || agentName.includes('executor')) return '⚡';
    if (agentId.includes('validator') || agentName.includes('validator')) return '✅';
    if (agentId.includes('expert') || agentName.includes('expert')) return '🕵️';
    if (agentId.includes('lore') || agentName.includes('lore')) return '📚';
    if (agentId.includes('historian') || agentName.includes('historian')) return '📜';
    if (agentId.includes('geography') || agentName.includes('geography')) return '🗺️';
    if (agentId.includes('combat') || agentName.includes('combat')) return '⚔️';
    if (agentId.includes('economy') || agentName.includes('economy')) return '💰';
    
    return '🤖'; // Default
  }
  
  // Update agent progress display in real-time
  updateAgentProgress(agentName, message, messageType) {
    // Create or update progress display overlay on the active node
    const agentLower = agentName.toLowerCase();
    const nodeElement = document.querySelector(`[data-node-id="${agentLower}"]`);
    
    if (nodeElement) {
      // Remove any existing progress overlay
      const existingOverlay = nodeElement.querySelector('.progress-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Create progress overlay
      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'progress-overlay';
      progressOverlay.innerHTML = `
        <div class="progress-content">
          <div class="progress-text">${message}</div>
          <div class="progress-type">${messageType === 'milestone' ? '🎯' : '⚡'}</div>
        </div>
      `;
      
      nodeElement.appendChild(progressOverlay);
      
      // Add progress styles if not already added
      if (!document.getElementById('progress-styles')) {
        const progressStyles = document.createElement('style');
        progressStyles.id = 'progress-styles';
        progressStyles.textContent = `
          .progress-overlay {
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            z-index: 1000;
            animation: fadeInProgress 0.3s ease-in;
          }
          
          .progress-content {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .progress-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .progress-type {
            flex-shrink: 0;
          }
          
          @keyframes fadeInProgress {
            from { opacity: 0; transform: translateX(-50%) translateY(10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          
          .pipeline-node.active .progress-overlay {
            background: rgba(102, 126, 234, 0.9);
          }
        `;
        document.head.appendChild(progressStyles);
      }
      
      // Auto-remove progress overlay after 8 seconds (unless it's a milestone)
      if (messageType !== 'milestone') {
        setTimeout(() => {
          if (progressOverlay.parentNode) {
            progressOverlay.remove();
          }
        }, 8000);
      }
    }
    
    // Also show in chat/log for persistence
    const icon = messageType === 'milestone' ? '🎯' : '⚡';
    this.addChatMessage('progress', agentName, message, null, icon);
  }
  
  // Add agent message to specific node
  addAgentMessageToNode(stageName, agent, output, outputLength) {
    // Find the node by matching stage name
    const matchingNode = Array.from(this.nodes.entries()).find(([nodeId, node]) => {
      return node.config.name === stageName || node.config.agent === agent;
    });
    
    if (!matchingNode) {
      console.log(`No node found for stage: ${stageName} or agent: ${agent}`);
      return;
    }
    
    const [nodeId, nodeData] = matchingNode;
    const messagesContainer = document.getElementById(`messages-${nodeId}`);
    
    if (!messagesContainer) {
      console.log(`No messages container found for node: ${nodeId}`);
      return;
    }
    
    // Show the messages container
    messagesContainer.style.display = 'block';
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'agent-message';
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-icon">📝</span>
        <span class="message-info">${agent} (${outputLength} chars)</span>
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="message-content">${this.truncateText(output, 200)}</div>
      <button class="message-expand" onclick="designer.expandMessage(this)">Show More</button>
    `;
    
    // Store full message content
    messageDiv.dataset.fullMessage = output;
    
    // Add to messages container
    messagesContainer.appendChild(messageDiv);
    
    // Limit to last 3 messages per node
    const messages = messagesContainer.querySelectorAll('.agent-message');
    if (messages.length > 3) {
      messages[0].remove();
    }
  }
  
  // Truncate text with ellipsis
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  // Expand/collapse message content
  expandMessage(button) {
    const messageDiv = button.closest('.agent-message');
    const contentDiv = messageDiv.querySelector('.message-content');
    const fullMessage = messageDiv.dataset.fullMessage;
    
    if (button.textContent === 'Show More') {
      contentDiv.innerHTML = fullMessage;
      button.textContent = 'Show Less';
    } else {
      contentDiv.innerHTML = this.truncateText(fullMessage, 200);
      button.textContent = 'Show More';
    }
  }
  
  // Add commentary to specific node
  addCommentaryToNode(stageName, message, style) {
    // Find the node by matching stage name
    const matchingNode = Array.from(this.nodes.entries()).find(([nodeId, node]) => {
      return node.config.name === stageName;
    });
    
    if (!matchingNode) {
      console.log(`No node found for commentary stage: ${stageName}`);
      return;
    }
    
    const [nodeId, nodeData] = matchingNode;
    const messagesContainer = document.getElementById(`messages-${nodeId}`);
    
    if (!messagesContainer) {
      console.log(`No messages container found for commentary node: ${nodeId}`);
      return;
    }
    
    // Show the messages container
    messagesContainer.style.display = 'block';
    
    // Create commentary element
    const commentaryDiv = document.createElement('div');
    commentaryDiv.className = 'agent-commentary';
    commentaryDiv.innerHTML = `
      <div class="commentary-header">
        <span class="commentary-icon">💬</span>
        <span class="commentary-info">Commentator (${style})</span>
        <span class="commentary-time">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="commentary-content">${message}</div>
    `;
    
    // Add to messages container
    messagesContainer.appendChild(commentaryDiv);
    
    // Limit to last 5 items per node (messages + commentary)
    const allItems = messagesContainer.querySelectorAll('.agent-message, .agent-commentary');
    if (allItems.length > 5) {
      allItems[0].remove();
    }
  }
  
  updateExecutionDashboard(agentStatus) {
    // Create dashboard if it doesn't exist
    let dashboard = document.getElementById('executionDashboard');
    if (!dashboard) {
      dashboard = document.createElement('div');
      dashboard.id = 'executionDashboard';
      dashboard.className = 'execution-dashboard';
      dashboard.innerHTML = `
        <div class="dashboard-header">
          <span class="dashboard-icon">⚙️</span>
          <span class="dashboard-title">Pipeline Execution</span>
          <button class="dashboard-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        </div>
        <div class="dashboard-content" id="dashboardContent"></div>
      `;
      document.body.appendChild(dashboard);
      
      // Make dashboard draggable
      this.makeDashboardDraggable(dashboard);
    }
    
    // Parse agent status
    let agent = 'UNKNOWN';
    let message = '';
    let type = '';
    
    if (typeof agentStatus === 'object') {
      agent = agentStatus.agent || 'UNKNOWN';
      message = agentStatus.message || '';
      type = agentStatus.type || '';
    } else if (typeof agentStatus === 'string') {
      message = agentStatus;
    }
    
    // Update dashboard content
    const content = document.getElementById('dashboardContent');
    const timestamp = new Date().toLocaleTimeString();
    const status = type === 'start' ? '🔄' : type === 'complete' ? '✅' : '📝';
    
    const entry = document.createElement('div');
    entry.className = `dashboard-entry ${type}`;
    entry.innerHTML = `
      <span class="entry-status">${status}</span>
      <span class="entry-agent">${agent}</span>
      <span class="entry-message">${message}</span>
      <span class="entry-time">${timestamp}</span>
    `;
    
    // Add to top of content
    content.insertBefore(entry, content.firstChild);
    
    // Keep only last 20 entries
    while (content.children.length > 20) {
      content.removeChild(content.lastChild);
    }
    
    // Show dashboard
    dashboard.style.display = 'block';
  }
  
  makeDashboardDraggable(dashboard) {
    const header = dashboard.querySelector('.dashboard-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        dashboard.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
}

// Working Directory Management Functions
function selectWorkingDirectory() {
  // For now, show a simple prompt (could be enhanced with file browser)
  const newPath = prompt('Enter working directory path:', document.getElementById('workingDirectory').value);
  if (newPath) {
    document.getElementById('workingDirectory').value = newPath;
    updateDirectoryStatus(newPath);
  }
}

function createOutputDirectory() {
  const workingDir = document.getElementById('workingDirectory').value;
  if (!workingDir) {
    alert('Please enter a working directory path first');
    return;
  }
  
  // Send request to proxy to create directory
  try {
    const ws = new WebSocket('ws://localhost:8081');
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'create-directory',
        path: workingDir
      }));
      ws.close();
      updateDirectoryStatus(workingDir, true);
    };
    ws.onerror = () => {
      console.log('Could not connect to proxy to create directory');
      updateDirectoryStatus(workingDir, false, 'Could not connect to proxy server');
    };
  } catch (error) {
    console.error('Error creating directory:', error);
    updateDirectoryStatus(workingDir, false, error.message);
  }
}

function updateDirectoryStatus(path, created = null, error = null) {
  const statusDiv = document.getElementById('directoryStatus');
  const statusIcon = statusDiv.querySelector('.status-icon');
  const statusText = statusDiv.querySelector('.status-text');
  
  if (error) {
    statusIcon.textContent = '❌';
    statusText.textContent = `Error: ${error}`;
    statusText.style.color = '#fca5a5';
  } else if (created === true) {
    statusIcon.textContent = '✅';
    statusText.textContent = `Directory created: ${path}`;
    statusText.style.color = '#4ade80';
  } else if (created === false) {
    statusIcon.textContent = '⚠️';
    statusText.textContent = `Directory may not exist: ${path}`;
    statusText.style.color = '#fbbf24';
  } else {
    statusIcon.textContent = '📂';
    statusText.textContent = `Output files will be created in: ${path}`;
    statusText.style.color = 'rgba(255, 255, 255, 0.7)';
  }
}

function showGeneratedFiles(files) {
  const fileOutputsDiv = document.getElementById('fileOutputs');
  if (!files || files.length === 0) {
    fileOutputsDiv.style.display = 'none';
    return;
  }
  
  fileOutputsDiv.style.display = 'block';
  fileOutputsDiv.innerHTML = `
    <div class="file-outputs-header">
      <span>📄</span>
      Generated Files (${files.length})
    </div>
    <div class="file-list">
      ${files.map(file => `
        <div class="file-item">
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-path">${file.path}</div>
          </div>
          <div class="file-actions">
            <button class="file-btn" onclick="copyFilePath('${file.path}')">Copy Path</button>
            <button class="file-btn open" onclick="openFile('${file.path}')">Open</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function copyFilePath(path) {
  navigator.clipboard.writeText(path).then(() => {
    // Show brief feedback
    const notification = document.createElement('div');
    notification.textContent = '📋 Path copied!';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }).catch(() => {
    alert(`File path: ${path}`);
  });
}

function openFile(path) {
  // Try to open file using system default application
  try {
    const ws = new WebSocket('ws://localhost:8081');
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'open-file',
        path: path
      }));
      ws.close();
    };
  } catch (error) {
    console.error('Error opening file:', error);
    // Fallback: show file path
    alert(`File location: ${path}\n\nYou can manually open this file in your preferred editor.`);
  }
}

function checkForGeneratedFiles() {
  const workingDirectory = document.getElementById('workingDirectory').value || '/mnt/c/github/claudeplus/output';
  
  try {
    const ws = new WebSocket('ws://localhost:8081');
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'list-files',
        path: workingDirectory,
        extensions: ['.md', '.txt', '.py', '.js', '.html', '.json', '.csv', '.pdf']
      }));
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.type === 'file-list') {
            const files = response.files.map(file => ({
              name: file.name,
              path: file.path,
              size: file.size,
              modified: file.modified
            }));
            showGeneratedFiles(files);
          }
        } catch (error) {
          console.error('Error parsing file list response:', error);
        }
        ws.close();
      };
    };
    
    ws.onerror = () => {
      console.log('Could not connect to proxy to check for files');
    };
  } catch (error) {
    console.error('Error checking for generated files:', error);
  }
}

// Execution Results UI Controls
function toggleExecutionResults() {
  const resultsDiv = document.getElementById('executionResults');
  const icon = document.getElementById('resultsToggleIcon');
  
  if (resultsDiv.classList.contains('collapsed')) {
    resultsDiv.classList.remove('collapsed');
    resultsDiv.classList.add('expanded');
    icon.textContent = '📖';
  } else {
    resultsDiv.classList.add('collapsed');
    resultsDiv.classList.remove('expanded');
    icon.textContent = '📋';
  }
}

function expandExecutionResults() {
  const resultsDiv = document.getElementById('executionResults');
  resultsDiv.classList.remove('collapsed');
  resultsDiv.classList.add('expanded');
  document.getElementById('resultsToggleIcon').textContent = '📖';
}

function collapseExecutionResults() {
  const resultsDiv = document.getElementById('executionResults');
  resultsDiv.classList.add('collapsed');
  resultsDiv.classList.remove('expanded');
  document.getElementById('resultsToggleIcon').textContent = '📋';
}

// Artifact Management
let selectedArtifacts = [];
let availableArtifacts = [];

function loadAvailableArtifacts() {
  // Get working directory and common output locations
  const workingDir = document.getElementById('workingDirectory').value || '/mnt/c/github/claudeplus/output';
  const searchPaths = [
    workingDir,
    '/mnt/c/github/claudeplus/output',
    '/mnt/c/github/claudeplus/proxy',
    '/mnt/c/github/claudeplus'
  ];
  
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    // Set a timeout to close the connection if no response in 5 seconds
    const timeout = setTimeout(() => {
      console.log('📦 Artifacts request timeout, using fallback');
      ws.close();
    }, 5000);
    
    ws.onopen = () => {
      console.log('📦 Sending artifacts search request');
      ws.send(JSON.stringify({
        type: 'search-artifacts',
        paths: searchPaths,
        extensions: ['.md', '.txt', '.py', '.js', '.html', '.json', '.csv', '.pdf', '.doc', '.docx']
      }));
      
      ws.onmessage = (event) => {
        try {
          clearTimeout(timeout); // Cancel timeout since we got a response
          console.log('📦 Received artifacts response:', event.data);
          const response = JSON.parse(event.data);
          if (response.type === 'artifacts-found') {
            console.log(`📦 Processing ${response.artifacts.length} artifacts`);
            availableArtifacts = response.artifacts;
            displayAvailableArtifacts(availableArtifacts);
          } else if (response.type === 'artifacts-error') {
            console.error('📦 Artifacts error:', response.error);
          } else {
            console.log('📦 Unexpected response type:', response.type);
          }
        } catch (error) {
          console.error('Error parsing artifacts response:', error);
        }
        // Delay closing to ensure message is processed
        setTimeout(() => ws.close(), 100);
      };
    };
    
    ws.onerror = () => {
      // Fallback: show your actual generated files
      const knownArtifacts = [
        {
          name: 'eve-online-physics-reference.md',
          path: '/mnt/c/github/claudeplus/output/eve-online-physics-reference.md',
          size: 16118,
          modified: '2025-10-29T11:08:00Z',
          type: 'thesis-reference'
        },
        {
          name: 'eve-physics-implementation-guide.md', 
          path: '/mnt/c/github/claudeplus/output/eve-physics-implementation-guide.md',
          size: 18798,
          modified: '2025-10-29T11:09:00Z',
          type: 'implementation-guide'
        },
        {
          name: 'CLAUDE.md',
          path: '/mnt/c/github/claudeplus/CLAUDE.md',
          size: 2220,
          modified: '2025-10-27T12:24:00Z',
          type: 'project-readme'
        }
      ];
      
      availableArtifacts = knownArtifacts;
      displayAvailableArtifacts(availableArtifacts);
    };
  } catch (error) {
    console.error('Error loading artifacts:', error);
  }
}

function displayAvailableArtifacts(artifacts) {
  const artifactList = document.getElementById('artifactList');
  const artifactItems = document.getElementById('artifactItems');
  
  if (!artifacts || artifacts.length === 0) {
    artifactList.style.display = 'none';
    return;
  }
  
  artifactList.style.display = 'block';
  
  artifactItems.innerHTML = artifacts.map((artifact, index) => `
    <div class="artifact-item" onclick="toggleArtifactSelection(${index})" data-index="${index}">
      <div class="artifact-item-info">
        <div class="artifact-item-name">${artifact.name}</div>
        <div class="artifact-item-details">
          <span class="artifact-item-size">${formatFileSize(artifact.size)}</span>
          <span class="artifact-item-date">${formatDate(artifact.modified)}</span>
        </div>
      </div>
      <div class="artifact-item-checkbox"></div>
    </div>
  `).join('');
}

function toggleArtifactSelection(index) {
  const artifact = availableArtifacts[index];
  const artifactItem = document.querySelector(`.artifact-item[data-index="${index}"]`);
  
  const existingIndex = selectedArtifacts.findIndex(a => a.path === artifact.path);
  
  if (existingIndex >= 0) {
    // Remove from selection
    selectedArtifacts.splice(existingIndex, 1);
    artifactItem.classList.remove('selected');
  } else {
    // Add to selection
    selectedArtifacts.push(artifact);
    artifactItem.classList.add('selected');
  }
  
  updateSelectedArtifactsDisplay();
}

function updateSelectedArtifactsDisplay() {
  const selectedArtifactsDiv = document.getElementById('selectedArtifacts');
  const selectedArtifactsList = document.getElementById('selectedArtifactsList');
  const selectedCount = document.getElementById('selectedCount');
  
  selectedCount.textContent = selectedArtifacts.length;
  
  if (selectedArtifacts.length === 0) {
    selectedArtifactsDiv.style.display = 'none';
    hidePromptExamples();
    return;
  }
  
  selectedArtifactsDiv.style.display = 'block';
  
  selectedArtifactsList.innerHTML = selectedArtifacts.map((artifact, index) => `
    <div class="selected-artifact-item">
      <span class="selected-artifact-name">${artifact.name}</span>
      <button class="selected-artifact-remove" onclick="removeSelectedArtifact(${index})">×</button>
    </div>
  `).join('');
  
  // Show suggested prompts for selected artifacts
  showPromptExamples();
}

function showPromptExamples() {
  if (selectedArtifacts.length === 0) return;
  
  const promptExamples = document.getElementById('promptExamples');
  const examplePrompts = document.getElementById('examplePrompts');
  
  // Generate context-aware prompt suggestions
  const suggestions = generatePromptSuggestions(selectedArtifacts);
  
  examplePrompts.innerHTML = suggestions.map(suggestion => `
    <div class="example-prompt" onclick="useExamplePrompt('${suggestion.replace(/'/g, "\\'")}')">
      ${suggestion}
    </div>
  `).join('');
  
  promptExamples.style.display = 'block';
}

function hidePromptExamples() {
  const promptExamples = document.getElementById('promptExamples');
  promptExamples.style.display = 'none';
}

function generatePromptSuggestions(artifacts) {
  const suggestions = [];
  
  // Check if we have EVE Online physics documents
  const hasEVEPhysics = artifacts.some(a => 
    a.name.toLowerCase().includes('eve') && 
    (a.name.toLowerCase().includes('physics') || a.name.toLowerCase().includes('implementation'))
  );
  
  if (hasEVEPhysics) {
    suggestions.push(
      "Create a practical game development tutorial based on these physics documents",
      "Generate Unity C# scripts implementing the EVE Online physics systems described in these documents", 
      "Write a technical comparison between EVE Online physics and other space games like Elite Dangerous",
      "Create API documentation for a game engine physics module based on these specifications",
      "Build a physics simulation demo using the mathematical models from these documents"
    );
  }
  
  // General suggestions based on artifact types
  if (artifacts.some(a => a.name.includes('reference'))) {
    suggestions.push("Expand on the technical reference with additional implementation details");
  }
  
  if (artifacts.some(a => a.name.includes('implementation') || a.name.includes('guide'))) {
    suggestions.push("Create example code and tutorials based on this implementation guide");
  }
  
  // Always include these generic options
  suggestions.push(
    "Build upon these documents to create a comprehensive developer handbook",
    "Create test cases and validation scenarios for the concepts in these documents"
  );
  
  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

function useExamplePrompt(prompt) {
  const promptTextarea = document.getElementById('executionPrompt');
  promptTextarea.value = prompt;
  promptTextarea.focus();
}

function removeSelectedArtifact(index) {
  const removedArtifact = selectedArtifacts[index];
  selectedArtifacts.splice(index, 1);
  
  // Update the available artifacts display
  const artifactItem = document.querySelector(`.artifact-item[data-index]`);
  const availableIndex = availableArtifacts.findIndex(a => a.path === removedArtifact.path);
  if (availableIndex >= 0) {
    const availableItem = document.querySelector(`.artifact-item[data-index="${availableIndex}"]`);
    if (availableItem) {
      availableItem.classList.remove('selected');
    }
  }
  
  updateSelectedArtifactsDisplay();
}

function clearSelectedArtifacts() {
  selectedArtifacts = [];
  
  // Remove selection from all items
  document.querySelectorAll('.artifact-item.selected').forEach(item => {
    item.classList.remove('selected');
  });
  
  updateSelectedArtifactsDisplay();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function buildPromptWithArtifacts(userPrompt, artifacts) {
  const artifactContext = artifacts.map(artifact => {
    return `**${artifact.name}** (${formatFileSize(artifact.size)})
Path: ${artifact.path}
Type: ${artifact.type || 'document'}`;
  }).join('\n\n');
  
  const enhancedPrompt = `${userPrompt}

## 📄 Context: Available Artifacts

I have access to the following artifacts from previous pipeline executions. Please reference and build upon these documents as appropriate:

${artifactContext}

Please use these artifacts as reference material and build upon the existing work. You can reference specific sections, extend concepts, or create complementary content based on what's already been generated.`;

  return enhancedPrompt;
}

// Execution Panel Toggle
function toggleExecutionPanel() {
  const panel = document.getElementById('executionPanel');
  const toggle = document.getElementById('panelToggle');
  
  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    toggle.textContent = '▼';
  } else {
    panel.classList.add('collapsed');
    toggle.textContent = '▶';
  }
}

// Resize functionality
let isResizing = false;

function initResize(e) {
  isResizing = true;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

function doResize(e) {
  if (!isResizing) return;
  
  const resultsDiv = document.getElementById('executionResults');
  const contentDiv = document.getElementById('executionResultsContent');
  const rect = resultsDiv.getBoundingClientRect();
  
  const newHeight = e.clientY - rect.top - 60; // Account for header height
  if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
    contentDiv.style.maxHeight = `${newHeight}px`;
  }
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
}

// Check for active pipelines on page load
function checkForActivePipelines() {
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      console.log('🔄 Checking for active pipelines...');
      // Small delay to allow server to fully initialize connection handler
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'check-active-pipelines'
        }));
      }, 300);
      
      let hasReceivedPipelinesResponse = false;
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log('🔍 [RECONNECT] Received response:', response.type, response);
          
          if (response.type === 'active-pipelines') {
            hasReceivedPipelinesResponse = true;
            console.log(`🔄 Found ${response.pipelines.length} active pipeline(s)`);
            if (response.pipelines.length > 0) {
              console.log('🎯 [RECONNECT] Showing banner for pipelines:', response.pipelines);
              showActivePipelineReconnectUI(response.pipelines);
            } else {
              console.log('ℹ️ [RECONNECT] No active pipelines found');
            }
            ws.close();
          }
        } catch (error) {
          console.error('Error parsing active pipelines response:', error);
        }
      };
      
      // Wait for active-pipelines response, close after timeout
      setTimeout(() => {
        if (!hasReceivedPipelinesResponse) {
          console.log('⏰ [RECONNECT] Timeout waiting for active-pipelines response');
          ws.close();
        }
      }, 3000);
    };
    
    ws.onerror = () => {
      console.log('🔄 No proxy connection for pipeline check');
    };
  } catch (error) {
    console.error('Error checking for active pipelines:', error);
  }
}

function showActivePipelineReconnectUI(pipelines) {
  // Create reconnection banner
  const banner = document.createElement('div');
  banner.id = 'pipelineReconnectBanner';
  banner.className = 'pipeline-reconnect-banner';
  banner.innerHTML = `
    <div class="reconnect-header">
      <span class="reconnect-icon">🔄</span>
      <span class="reconnect-title">Active Pipeline Detected</span>
      <button class="reconnect-close" onclick="closeReconnectBanner()">×</button>
    </div>
    <div class="reconnect-content">
      <div class="reconnect-description">
        ${pipelines.length} pipeline execution(s) are still running. Would you like to reconnect?
      </div>
      <div class="reconnect-pipelines">
        ${pipelines.map(pipeline => `
          <div class="reconnect-pipeline-item">
            <div class="pipeline-info">
              <div class="pipeline-prompt">${pipeline.prompt}</div>
              <div class="pipeline-details">Started: ${pipeline.startTime} • Status: ${pipeline.status}</div>
            </div>
            <div class="pipeline-actions">
              <button class="reconnect-btn" onclick="reconnectToPipeline('${pipeline.id}')">Reconnect</button>
              <button class="delete-pipeline-btn" onclick="deletePipeline('${pipeline.id}')">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Insert at the top of the page
  document.body.insertBefore(banner, document.body.firstChild);
}

function reconnectToPipeline(pipelineId) {
  try {
    console.log(`🔄 Reconnecting to pipeline: ${pipelineId}`);

    // Close existing WebSocket if any
    if (window.designer && window.designer.ws) {
      window.designer.ws.close();
    }

    // Create new WebSocket connection that will be kept alive
    const ws = new WebSocket('ws://localhost:8081');

    // Store the WebSocket in designer object for future use
    if (window.designer) {
      window.designer.ws = ws;
    }

    ws.onopen = () => {
      console.log(`✅ WebSocket connected, sending reconnect request for ${pipelineId}`);
      ws.send(JSON.stringify({
        type: 'reconnect-pipeline',
        pipelineId: pipelineId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log('📥 Received message:', response.type);

        if (response.type === 'pipeline-reconnected') {
          console.log('✅ Successfully reconnected to pipeline');
          console.log('📊 Pipeline data:', response.pipelineData);
          console.log('💬 Chat history length:', response.chatHistory?.length || 0);
          console.log('💬 Chat history:', response.chatHistory);
          console.log('🔄 Execution events length:', response.executionEvents?.length || 0);
          console.log('🔄 Execution events:', response.executionEvents);
          console.log('📁 Stage outputs:', response.stageOutputs);
          if (response.chatHistory && response.chatHistory.length > 0) {
            response.chatHistory.forEach((msg, idx) => {
              console.log(`  Message ${idx}:`, msg);
            });
          }
          closeReconnectBanner();

          // Show execution results area
          const resultsDiv = document.getElementById('executionResults');
          if (resultsDiv) {
            resultsDiv.style.display = 'block';

            // Generate chat history HTML with expandable outputs
            let chatHistoryHTML = '';
            if (response.chatHistory && response.chatHistory.length > 0) {
              chatHistoryHTML = response.chatHistory.map((msg, idx) => {
                let outputSection = '';
                if (msg.output) {
                  const outputId = `output-${idx}`;
                  outputSection = `
                    <div class="message-output-section">
                      <button class="message-output-toggle" onclick="toggleOutput('${outputId}')">
                        📄 View Output (${msg.output.length} chars)
                      </button>
                      <pre class="message-output" id="${outputId}" style="display: none;">${escapeHtml(msg.output)}</pre>
                    </div>
                  `;
                }
                let promptSection = '';
                if (msg.prompt) {
                  const promptId = `prompt-${idx}`;
                  promptSection = `
                    <div class="message-prompt-section">
                      <button class="message-prompt-toggle" onclick="toggleOutput('${promptId}')">
                        📝 View Prompt (${msg.prompt.length} chars)
                      </button>
                      <pre class="message-prompt" id="${promptId}" style="display: none;">${escapeHtml(msg.prompt)}</pre>
                    </div>
                  `;
                }
                return `
                <div class="chat-message ${msg.type}">
                  <div class="message-icon">${getMessageIcon(msg.type)}</div>
                  <div class="message-content">
                    <div class="message-header">
                      <span class="message-agent">${msg.title || 'System'}</span>
                      <span class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="message-text">${msg.message}</div>
                    ${msg.details ? `<div class="message-details">${msg.details}</div>` : ''}
                    ${promptSection}
                    ${outputSection}
                  </div>
                </div>
                `;
              }).join('');
              console.log('📝 Generated chat history HTML length:', chatHistoryHTML.length);
            } else {
              console.log('⚠️ No chat history to display');
            }

            const pipelineInfo = response.pipelineData ? response.pipelineData : {};
            const pipelineName = pipelineInfo.name || 'Reconnected Pipeline';

            resultsDiv.innerHTML = `
              <div class="execution-results-header" onclick="toggleExecutionResults()">
                <div class="execution-results-title">
                  <span>🔄</span>
                  ${pipelineName}
                </div>
                <div class="execution-results-controls">
                  <span class="results-toggle" id="resultsToggleIcon">📖</span>
                </div>
              </div>
              <div class="execution-results-content" id="executionResultsContent">
                <div class="chat-container" id="chatContainer">
                  <div class="chat-message system">
                    <div class="message-icon">🔄</div>
                    <div class="message-content">
                      <div class="message-header">
                        <span class="message-agent">System</span>
                        <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
                      </div>
                      <div class="message-text">Successfully reconnected to running pipeline</div>
                      <div class="message-details">Pipeline ID: ${pipelineId}</div>
                    </div>
                  </div>
                  ${chatHistoryHTML}
                </div>
              </div>
            `;
            resultsDiv.classList.add('expanded');

            // Set up the global designer variable to point to existing chat container
            if (window.designer) {
              console.log('✅ Designer exists, setting up reconnect...');
              window.designer.chatContainer = document.getElementById('chatContainer');
              window.designer.currentPipelineId = pipelineId;

              // Load the pipeline template into the visual grid
              if (response.pipelineData) {
                console.log('🎨 Loading pipeline template into grid...');
                console.log('📊 Pipeline data stages:', response.pipelineData.stages?.length);

                // Clear existing nodes first
                console.log('🧹 Clearing existing nodes before reconnect...');
                window.designer.nodes.forEach(node => {
                  if (node.element && node.element.parentNode) {
                    node.element.parentNode.removeChild(node.element);
                  }
                });
                window.designer.nodes.clear();
                window.designer.connections = [];

                // Now load the reconnected pipeline
                window.designer.loadTemplateFromConfig(response.pipelineData);

                // Update node visual states based on completed stages
                if (response.pipelineData.completedStages) {
                  response.pipelineData.completedStages.forEach(stageId => {
                    window.designer.updateNodeVisualState(stageId, 'completed');
                  });
                }

                // Mark current stage as running
                if (response.pipelineData.currentStage) {
                  const currentStageId = response.pipelineData.stages.find(
                    s => s.name === response.pipelineData.currentStage
                  )?.id;
                  if (currentStageId) {
                    window.designer.updateNodeVisualState(currentStageId, 'running');
                  }
                }

                // Attach stage outputs to nodes if available
                if (response.stageOutputs) {
                  for (const [stageId, output] of Object.entries(response.stageOutputs)) {
                    for (const [nodeId, node] of window.designer.nodes) {
                      if (node.config?.id === stageId || nodeId === stageId) {
                        node.output = output.output;
                        node.prompt = output.prompt;
                        console.log(`📎 Attached output to node ${stageId}`);
                        break;
                      }
                    }
                  }
                }

                // Replay execution events to restore visual state sequentially
                if (response.executionEvents && response.executionEvents.length > 0) {
                  console.log(`🔄 Replaying ${response.executionEvents.length} execution events...`);
                  response.executionEvents.forEach((event, idx) => {
                    if (event.eventType === 'stage_started') {
                      console.log(`  ${idx + 1}. Stage Started: ${event.stageName} (${event.stageId})`);
                      window.designer.updateNodeVisualState(event.stageId, 'running');
                    } else if (event.eventType === 'stage_completed') {
                      console.log(`  ${idx + 1}. Stage Completed: ${event.stageName} (${event.stageId})`);
                      window.designer.updateNodeVisualState(event.stageId, 'completed');
                    } else if (event.eventType === 'stage_error') {
                      console.log(`  ${idx + 1}. Stage Error: ${event.stageName} (${event.stageId})`);
                      window.designer.updateNodeVisualState(event.stageId, 'error');
                    }
                  });

                  // Find the currently running stage (last stage_started without corresponding stage_completed)
                  let currentRunningStageId = null;
                  const completedStageIds = new Set();

                  for (const event of response.executionEvents) {
                    if (event.eventType === 'stage_started') {
                      currentRunningStageId = event.stageId;
                    } else if (event.eventType === 'stage_completed' && event.stageId === currentRunningStageId) {
                      completedStageIds.add(event.stageId);
                      currentRunningStageId = null;
                    }
                  }

                  // Ensure current running stage is highlighted
                  if (currentRunningStageId) {
                    console.log(`🔍 Current running stage: ${currentRunningStageId}`);
                    window.designer.updateNodeVisualState(currentRunningStageId, 'running');
                  }
                }
              } else {
                console.error('❌ No pipelineData in response!');
              }
            } else {
              console.error('❌ window.designer not found!');
            }
          }

          // DO NOT close WebSocket - keep it alive for pipeline updates!

        } else if (response.type === 'pipeline-reconnect-failed') {
          console.error('❌ Failed to reconnect:', response.error);
          alert(`Failed to reconnect to pipeline: ${response.error}`);
          ws.close();

        } else if (response.type === 'pipeline-status') {
          // Handle stage status updates
          console.log('📊 Pipeline status update:', response.content?.message);
          if (window.designer && window.designer.chatContainer) {
            const content = response.content;
            const messageType = content.style === 'success' ? 'success' :
                               content.style === 'error' ? 'error' : 'info';
            window.designer.addChatMessage(
              messageType,
              content.agent || 'Pipeline',
              content.message,
              null,
              content.type === 'stage-start' ? '▶️' :
              content.type === 'stage-complete' ? '✅' : '📊'
            );

            // Update node visual state
            if (content.agent) {
              const agentLower = content.agent.toLowerCase();
              if (content.type === 'stage-start') {
                window.designer.updateNodeVisualState(agentLower, 'running');
              } else if (content.type === 'stage-complete') {
                window.designer.updateNodeVisualState(agentLower, 'completed');
              }
            }
          }

        } else if (response.type === 'pipeline-commentary') {
          // Handle commentator updates
          console.log('💬 Commentary:', response.content?.message);
          if (window.designer && window.designer.chatContainer) {
            const content = response.content;
            window.designer.addChatMessage(
              'info',
              content.agent || 'COMMENTATOR',
              content.message,
              null,
              '💬'
            );
          }

        } else if (response.type === 'pipeline-stage-update') {
          // Handle stage updates with stageId
          console.log('🎯 Stage update:', response);
          if (window.designer) {
            if (response.status === 'in-progress') {
              window.designer.updateNodeVisualState(response.stageId, 'running');
            } else if (response.status === 'completed') {
              window.designer.updateNodeVisualState(response.stageId, 'completed');

              // Store output if available
              if (response.output) {
                const node = Array.from(window.designer.nodes.values()).find(n =>
                  n.config?.id === response.stageId
                );
                if (node) {
                  node.output = response.output;
                  console.log(`📎 Attached live output to node ${response.stageId}`);
                }
              }
            } else if (response.status === 'error') {
              window.designer.updateNodeVisualState(response.stageId, 'error');
            }
          }

        } else if (response.type === 'pipeline-update') {
          // Handle general pipeline updates
          console.log('📊 Pipeline update received:', response);
          if (window.designer && window.designer.handlePipelineUpdate) {
            window.designer.handlePipelineUpdate(response);
          }

        } else if (response.type === 'pipeline-completed') {
          console.log('🏁 Pipeline completed');
          if (window.designer && window.designer.handlePipelineComplete) {
            window.designer.handlePipelineComplete(response);
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      alert('Failed to connect to proxy server. Make sure it\'s running on port 8081.');
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
    };

  } catch (error) {
    console.error('Error reconnecting to pipeline:', error);
    alert(`Error: ${error.message}`);
  }
}

function deletePipeline(pipelineId) {
  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete pipeline "${pipelineId}"? This will terminate the running process and remove all pipeline data.`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      console.log(`🗑️ Deleting pipeline: ${pipelineId}`);
      ws.send(JSON.stringify({
        type: 'delete-pipeline',
        pipelineId: pipelineId
      }));
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.type === 'pipeline-deleted') {
            console.log('🗑️ Pipeline deleted successfully');
            
            // Remove the pipeline from the UI
            const pipelineItem = document.querySelector(`[onclick="reconnectToPipeline('${pipelineId}')"]`)?.closest('.reconnect-pipeline-item');
            if (pipelineItem) {
              pipelineItem.remove();
            }
            
            // Check if there are any pipelines left in the banner
            const remainingPipelines = document.querySelectorAll('.reconnect-pipeline-item');
            if (remainingPipelines.length === 0) {
              closeReconnectBanner();
            } else {
              // Update the count in the banner
              const description = document.querySelector('.reconnect-description');
              if (description) {
                description.textContent = `${remainingPipelines.length} pipeline execution(s) are still running. Would you like to reconnect?`;
              }
            }
            
            alert(`Pipeline "${pipelineId}" has been deleted successfully.`);
            
          } else if (response.type === 'pipeline-delete-failed') {
            console.error('🗑️ Failed to delete pipeline:', response.error);
            alert(`Failed to delete pipeline: ${response.error}`);
          }
        } catch (error) {
          console.error('Error parsing delete response:', error);
        }
        ws.close();
      };
    };
    
    ws.onerror = () => {
      console.error('🗑️ Failed to connect to proxy for pipeline deletion');
      alert('Failed to connect to proxy server for deletion');
    };
    
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    alert(`Error deleting pipeline: ${error.message}`);
  }
}

function deleteTemplate(templateId) {
  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete the "${templateId}" template? This action cannot be undone.`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    // Remove the template from the UI
    const templateItem = document.querySelector(`[data-template="${templateId}"]`);
    if (templateItem) {
      templateItem.style.transition = 'all 0.3s ease';
      templateItem.style.transform = 'translateX(-100%)';
      templateItem.style.opacity = '0';
      
      setTimeout(() => {
        templateItem.remove();
        console.log(`🗑️ Template "${templateId}" removed from UI`);
      }, 300);
    }
    
    // Optionally send to server to delete any stored template data
    try {
      const ws = new WebSocket('ws://localhost:8081');
      
      ws.onopen = () => {
        console.log(`🗑️ Notifying server to delete template: ${templateId}`);
        ws.send(JSON.stringify({
          type: 'delete-template',
          templateId: templateId
        }));
        
        ws.onmessage = async (event) => {
          try {
            const response = JSON.parse(event.data);
            if (response.type === 'template-deleted') {
              console.log('🗑️ Template deleted from server storage');
              // Refresh the template list from server
              await loadTemplatesFromServer();
            }
          } catch (error) {
            console.error('Error parsing template delete response:', error);
          }
          ws.close();
        };
      };
      
      ws.onerror = () => {
        console.log('🗑️ Could not connect to server for template deletion (UI removal succeeded)');
      };
      
    } catch (error) {
      console.log('🗑️ Template removed from UI (server deletion not available)');
    }
    
  } catch (error) {
    console.error('Error deleting template:', error);
    alert(`Error deleting template: ${error.message}`);
  }
}

function getMessageIcon(type) {
  const icons = {
    'info': '💡',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌',
    'system': '🔄',
    'agent': '🤖',
    'user': '👤'
  };
  return icons[type] || '📝';
}

function closeReconnectBanner() {
  const banner = document.getElementById('pipelineReconnectBanner');
  if (banner) {
    banner.remove();
  }
}

// Global functions for toolbar actions
function loadTemplate() {
  designer.loadTemplate('claude-plus-v1');
}

async function generatePipelineFromPrompt() {
  const promptInput = document.getElementById('pipelineGeneratorPrompt');
  const statusDiv = document.getElementById('generationStatus');
  const generateBtn = document.getElementById('generatePipelineBtn');

  const userPrompt = promptInput.value.trim();

  if (!userPrompt) {
    alert('Please enter a description of the pipeline you want to create');
    return;
  }

  // Show loading status
  statusDiv.style.display = 'block';
  statusDiv.className = 'generation-status loading';
  statusDiv.innerHTML = '🔄 Connecting to Claude Code to generate your pipeline...';
  generateBtn.disabled = true;

  try {
    // Create WebSocket connection to proxy
    const ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      console.log('[GENERATOR] Connected to proxy');
      statusDiv.innerHTML = '✨ Claude Code is analyzing your request and creating the pipeline...';

      // Load existing templates and agents to provide as context
      const templateContext = window.loadedTemplates ? JSON.stringify(window.loadedTemplates[0] || {}, null, 2) : '{}';
      const agentContext = window.loadedAgents ? JSON.stringify(window.loadedAgents[0] || {}, null, 2) : '{}';

      // Send pipeline generation request
      ws.send(JSON.stringify({
        type: 'pipeline-generation-request',
        userPrompt: userPrompt,
        context: {
          templateExample: templateContext,
          agentExample: agentContext
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[GENERATOR] Message received:', message.type);

        if (message.type === 'pipeline-generation-status') {
          statusDiv.innerHTML = `⚙️ ${message.content}`;
        } else if (message.type === 'pipeline-generation-complete') {
          statusDiv.className = 'generation-status success';
          statusDiv.innerHTML = `✅ Pipeline generated successfully!<br><br>` +
            `<strong>Template:</strong> ${message.template.name}<br>` +
            `<strong>Agents Created:</strong> ${message.agents.length}<br><br>` +
            `The template and agents have been saved and are now available in the sidebar.`;

          // Reload templates and agents to show the new ones
          setTimeout(() => {
            loadTemplatesFromServer();
            loadAgentsFromServer();
            promptInput.value = '';
          }, 1000);

          ws.close();
        } else if (message.type === 'pipeline-generation-error') {
          statusDiv.className = 'generation-status error';
          statusDiv.innerHTML = `❌ Generation failed: ${message.error}`;
          ws.close();
        }
      } catch (err) {
        console.error('[GENERATOR] Error parsing message:', err);
        statusDiv.className = 'generation-status error';
        statusDiv.innerHTML = `❌ Error: ${err.message}`;
      }
    };

    ws.onerror = (error) => {
      console.error('[GENERATOR] WebSocket error:', error);
      statusDiv.className = 'generation-status error';
      statusDiv.innerHTML = '❌ Could not connect to proxy server. Make sure it\'s running on port 8081.';
      generateBtn.disabled = false;
    };

    ws.onclose = () => {
      console.log('[GENERATOR] Connection closed');
      generateBtn.disabled = false;
    };

  } catch (error) {
    console.error('[GENERATOR] Error:', error);
    statusDiv.className = 'generation-status error';
    statusDiv.innerHTML = `❌ Error: ${error.message}`;
    generateBtn.disabled = false;
  }
}

function savePipeline() {
  const pipelineData = designer.exportPipeline();
  const blob = new Blob([pipelineData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${designer.pipelineConfig.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function executePipeline() {
  console.log('Executing pipeline:', designer.pipelineConfig.name);

  // Get user context for the pipeline
  const userContext = prompt(
    `🚀 Running Pipeline: ${designer.pipelineConfig.name}\n\n` +
    `This pipeline has ${Array.from(designer.nodes.values()).length} stages.\n\n` +
    `Enter context or requirements for this execution (optional):`,
    ''
  );

  if (userContext === null) {
    // User cancelled
    return;
  }

  try {
    const pipelineData = designer.exportPipeline();
    const pipeline = JSON.parse(pipelineData);

    // Connect to proxy and execute pipeline directly
    const ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      console.log('Connected to proxy, sending execute-pipeline message');
      ws.send(JSON.stringify({
        type: 'execute-pipeline',
        pipeline: pipeline,
        userContext: userContext || '',
        workingDirectory: null // Will use proxy default
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Pipeline message:', message);

        if (message.type === 'pipeline-status') {
          console.log('[PIPELINE STATUS]', message.content);
          // Could update UI with progress here
        } else if (message.type === 'pipeline-complete') {
          console.log('[PIPELINE COMPLETE]', message.content);
          alert(`✅ Pipeline "${message.pipeline}" completed successfully!\n\nCheck console for detailed results.`);
          ws.close();
        } else if (message.type === 'pipeline-error') {
          console.error('[PIPELINE ERROR]', message.content);
          alert(`❌ Pipeline execution failed:\n\n${message.content}`);
          ws.close();
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      alert('❌ Could not connect to proxy server. Make sure it\'s running on port 8081.');
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    alert(`🚀 Pipeline execution started!\n\nPipeline: ${designer.pipelineConfig.name}\n\nWatch the console for real-time updates.`);

  } catch (error) {
    console.error('Error executing pipeline:', error);
    alert(`❌ Error: ${error.message}`);
  }
}

function showExecutionInstructions() {
  const instructions = `
🚀 TO RUN YOUR PIPELINE:

1. 📱 Switch to the Claude Plus app (should be running)
   - Look for "Claude AI Assistant" window
   - Chat interface with directory selection

2. 🗂️ Click "📁 Select" to choose working directory

3. 💬 Type a message like:
   "${getSamplePrompt()}"

4. ⚡ Watch your custom ${designer.pipelineConfig.name} pipeline execute!

✨ Your pipeline configuration:
- ${Array.from(designer.nodes.values()).length} stages
- ${designer.connections.length} connections
- Custom settings applied!
  `;
  
  alert(instructions);
}

function getSamplePrompt() {
  const prompts = [
    "Create a Python function that calculates fibonacci numbers",
    "Build a simple HTML page with CSS styling",
    "Write a JavaScript function to sort an array of objects",
    "Create a Python script that reads a CSV file and analyzes data",
    "Build a simple REST API endpoint in Python"
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function addNewStage() {
  const x = 200 + Math.random() * 400;
  const y = 200 + Math.random() * 200;
  designer.createNode({
    name: 'New Stage',
    type: 'agent',
    icon: '🔧',
    description: 'Custom stage',
    x,
    y
  });
}

function zoomIn() {
  designer.zoom = Math.min(designer.zoom * 1.2, 3);
  designer.updateCanvasTransform();
}

function zoomOut() {
  designer.zoom = Math.max(designer.zoom / 1.2, 0.3);
  designer.updateCanvasTransform();
}

function resetZoom() {
  designer.zoom = 1;
  designer.panOffset = { x: 0, y: 0 };
  designer.updateCanvasTransform();
}

function toggleMetrics() {
  designer.metricsDashboard.classList.toggle('visible');
}

function validatePipeline() {
  // Pipeline validation logic
  const issues = [];
  
  if (designer.nodes.size === 0) {
    issues.push('Pipeline must have at least one stage');
  }
  
  if (issues.length === 0) {
    alert('✅ Pipeline validation passed!');
  } else {
    alert('❌ Pipeline validation failed:\n' + issues.join('\n'));
  }
}

function showConnections() {
  if (designer.connections.length === 0) {
    alert('📭 No connections found!\n\nTo create connections:\n1. Click "🔗 Connect" in toolbar\n2. Click first node (source)\n3. Click second node (target)\n\nOr load a template like "Claude Plus V1" which has pre-built connections.');
    return;
  }

  let connectionsList = '🔗 **PIPELINE CONNECTIONS**\n\n';
  designer.connections.forEach((conn, index) => {
    const fromNode = designer.nodes.get(conn.from);
    const toNode = designer.nodes.get(conn.to);
    
    if (fromNode && toNode) {
      connectionsList += `${index + 1}. ${fromNode.config.name} → ${toNode.config.name}\n`;
      connectionsList += `   Condition: ${conn.condition}\n\n`;
    }
  });
  
  connectionsList += '\n💡 Use "🗑️ Delete" tool + click connections to remove them\n';
  connectionsList += '💡 Use "🔗 Connect" tool to add new connections';

  alert(connectionsList);
}

function clearAllConnections() {
  if (designer.connections.length === 0) {
    alert('📭 No connections to clear!');
    return;
  }
  
  if (confirm(`🧹 Clear all ${designer.connections.length} connections?\n\nThis will disconnect all nodes. You can recreate connections using the "🔗 Connect" tool.`)) {
    designer.connections = [];
    designer.updateConnectionLines();
    alert('✅ All connections cleared!');
  }
}

// Custom Pipeline Creator Functions
let customAgents = [];

function openCustomPipelineModal() {
  document.getElementById('customPipelineModal').style.display = 'flex';
  customAgents = [];
  updateCustomAgentsList();
}

function closeCustomPipelineModal() {
  document.getElementById('customPipelineModal').style.display = 'none';
  // Clear form
  document.getElementById('pipelineName').value = '';
  document.getElementById('pipelineDescription').value = '';
  document.getElementById('agentName').value = '';
  document.getElementById('agentRole').value = '';
  document.getElementById('agentPrompt').value = '';
  customAgents = [];
}

function addCustomAgent() {
  const agentName = document.getElementById('agentName').value.trim();
  const agentRole = document.getElementById('agentRole').value.trim();
  const agentPrompt = document.getElementById('agentPrompt').value.trim();
  
  if (!agentName || !agentRole || !agentPrompt) {
    alert('Please fill in all agent fields');
    return;
  }
  
  const agent = {
    id: agentName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: agentName,
    role: agentRole,
    prompt: agentPrompt,
    capabilities: ['analysis', 'processing', 'generation'],
    constraints: ['follow_guidelines', 'provide_evidence']
  };
  
  customAgents.push(agent);
  updateCustomAgentsList();
  
  // Clear agent form
  document.getElementById('agentName').value = '';
  document.getElementById('agentRole').value = '';
  document.getElementById('agentPrompt').value = '';
}

function updateCustomAgentsList() {
  const listEl = document.getElementById('customAgentsList');
  
  if (customAgents.length === 0) {
    listEl.innerHTML = '<p style="color: rgba(255,255,255,0.6); font-style: italic;">Add agents above to build your pipeline...</p>';
    return;
  }
  
  listEl.innerHTML = customAgents.map((agent, index) => `
    <div class="custom-agent-item">
      <div class="custom-agent-info">
        <h4>${agent.name}</h4>
        <p>${agent.role}</p>
      </div>
      <button class="remove-agent" onclick="removeCustomAgent(${index})">Remove</button>
    </div>
  `).join('');
}

function removeCustomAgent(index) {
  customAgents.splice(index, 1);
  updateCustomAgentsList();
}

function createCustomPipeline() {
  const pipelineName = document.getElementById('pipelineName').value.trim();
  const pipelineDescription = document.getElementById('pipelineDescription').value.trim();
  
  if (!pipelineName || !pipelineDescription || customAgents.length === 0) {
    alert('Please fill in pipeline details and add at least one agent');
    return;
  }
  
  // Create custom pipeline configuration
  const customPipelineId = pipelineName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // Clear existing pipeline
  designer.nodes.forEach(node => node.element.remove());
  designer.nodes.clear();
  designer.connections = [];
  
  // Set pipeline config
  designer.pipelineConfig = {
    id: customPipelineId,
    name: pipelineName,
    description: pipelineDescription,
    version: '1.0.0',
    custom: true,
    globalConfig: {
      workingDirectory: null,
      maxRetries: 3,
      customAgents: customAgents
    }
  };
  
  // Create nodes for each custom agent
  let x = 100;
  const y = 200;
  const nodeIds = [];
  
  customAgents.forEach((agent, index) => {
    const nodeId = designer.createNode({
      id: agent.id,
      name: agent.name,
      type: 'agent',
      icon: '🤖',
      description: agent.role,
      agent: agent.id,
      x: x,
      y: y,
      config: { 
        customPrompt: agent.prompt,
        role: agent.role 
      }
    });
    
    nodeIds.push(nodeId);
    x += 300; // Space nodes horizontally
  });
  
  // Create simple sequential connections
  for (let i = 0; i < nodeIds.length - 1; i++) {
    designer.createConnection(nodeIds[i], nodeIds[i + 1], 'completed');
  }
  
  designer.updateConnectionLines();
  closeCustomPipelineModal();
  
  // Show success message
  alert(`🚀 Custom pipeline "${pipelineName}" created successfully!\n\nYou can now execute it or save it for later use.`);
}

// Standalone pipeline execution function
function executeCurrentPipeline() {
  console.log('🚀 Starting standalone pipeline execution...');
  
  const promptTextarea = document.getElementById('executionPrompt');
  const resultsDiv = document.getElementById('executionResults');
  const executeButton = document.querySelector('.execute-btn');
  
  if (!promptTextarea || !resultsDiv) {
    console.error('❌ Required UI elements not found');
    alert('Error: Execution interface not found. Please reload the page.');
    return;
  }
  
  const userPrompt = promptTextarea.value.trim();
  if (!userPrompt) {
    console.log('❌ No prompt provided');
    alert('Please enter a prompt to execute through the pipeline.');
    return;
  }
  
  console.log(`💬 User prompt: "${userPrompt}"`);
  
  // Show results area and update UI with new structure
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <div class="execution-results-header" onclick="toggleExecutionResults()">
      <div class="execution-results-title">
        <span>🚀</span>
        Pipeline Execution Log
      </div>
      <div class="execution-results-controls">
        <button class="results-toggle" onclick="event.stopPropagation(); expandExecutionResults()">Expand</button>
        <span class="results-toggle" id="resultsToggleIcon">📖</span>
      </div>
    </div>
    <div class="execution-results-content" id="executionResultsContent">
      <div class="chat-container" id="chatContainer">
        <div class="chat-message system">
          <div class="message-icon">🚀</div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-agent">System</span>
              <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-text">Executing Pipeline...</div>
            <div class="message-details">Connecting to proxy server...</div>
          </div>
        </div>
      </div>
    </div>
    <div class="resize-handle" onmousedown="initResize(event)"></div>
  `;
  
  // Set initial state to expanded
  resultsDiv.classList.add('expanded');
  
  // Disable execute button during execution
  if (executeButton) {
    executeButton.disabled = true;
    executeButton.textContent = 'Executing...';
  }
  
  try {
    // Connect to proxy server via WebSocket
    console.log('🔌 Connecting to WebSocket at ws://localhost:8081...');
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = function() {
      console.log('✅ WebSocket connected to proxy server');
      
      // Clear previous messages and add connection status
      designer.clearChatMessages();
      designer.addChatMessage('system', 'Proxy Server', 'Connected to proxy server', 'Sending prompt through pipeline...', '🔄');
      
      // Send execute-pipeline message to proxy (NOT user-message)
      const workingDirectory = document.getElementById('workingDirectory').value || '/mnt/c/github/claudeplus/output';

      // Get the current pipeline configuration
      const pipelineData = designer.exportPipeline();
      const pipeline = JSON.parse(pipelineData);

      console.log('🎯 Executing pipeline directly:', pipeline.name);
      
      // IMPORTANT: Update pipelineConfig to include stages for stage detection
      designer.pipelineConfig = pipeline;

      const message = {
        type: 'execute-pipeline',
        pipeline: pipeline,
        userContext: userPrompt,
        workingDirectory: workingDirectory,
        timestamp: new Date().toISOString(),
        source: 'pipeline-designer'
      };

      console.log('📤 Sending execute-pipeline message to proxy:', message);
      ws.send(JSON.stringify(message));
    };
    
    ws.onmessage = function(event) {
      try {
        const response = JSON.parse(event.data);
        console.log('📥 Received from proxy:', response);
        
        if (response.type === 'system') {
          // Connection confirmation
          console.log('🔗 System message:', response.content);
          
        } else if (response.type === 'system-status') {
          // Multi-agent system initialization
          designer.addChatMessage('system', 'Multi-Agent System', response.content, null, '⚙️');

        } else if (response.type === 'pipeline-reconnect') {
          // Reconnecting to running pipeline
          console.log('🔗 Pipeline reconnect:', response.content);
          const content = response.content;
          
          designer.addChatMessage('success', 'System', 
            `🔗 Reconnected to running pipeline: ${content.pipeline.name}`, 
            `Current stage: ${content.currentStage} (${content.completedStages}/${content.totalStages} completed)`, '🔗');
          
          // Show pipeline status
          designer.showReconnectedPipelineStatus(content);
          
        } else if (response.type === 'no-running-pipeline') {
          console.log('ℹ️ No running pipeline found');
          
        } else if (response.type === 'agent-output') {
          // Agent output - show the actual work done by each agent
          console.log('📝 Agent output:', response.content);
          const content = response.content;
          
          // Add to chat
          designer.addChatMessage('agent', content.stageName, 
            `📝 ${content.agent} Output (${content.outputLength} characters)`, 
            content.output, '📝');
          
          // Add to the node itself
          designer.addAgentMessageToNode(content.stageName, content.agent, content.output, content.outputLength);
          
        } else if (response.type === 'pipeline-commentary') {
          // Commentator updates - make them prominent and persistent
          console.log('💬 Commentator update:', response.content);
          const content = response.content;
          
          // Create prominent commentator message
          designer.addCommentatorMessage(content.message, content.style, content.priority);
          
          // Also add commentary to the currently active node if available
          if (content.currentStage) {
            designer.addCommentaryToNode(content.currentStage, content.message, content.style);
          }
          
        } else if (response.type === 'pipeline-status') {
          // Pipeline execution status updates
          console.log('📊 Pipeline status update:', response.content);
          const content = response.content;

          // Detect and highlight active stage from pipeline status
          // PREFER stageId if provided (handles multiple stages with same agent)
          let activeStage = null;
          if (content && content.stageId) {
            // Direct lookup by stageId - most reliable
            console.log('🎯 Using stageId directly:', content.stageId);
            const stage = designer.pipelineConfig?.stages?.find(s => s.id === content.stageId);
            if (stage) {
              activeStage = {
                id: stage.id,
                icon: designer.getStageIcon(stage),
                color: designer.getStageColor(stage)
              };
            }
          } else if (content && content.agent) {
            // Fallback to agent-based detection for backwards compatibility
            console.log('🔍 Detecting stage for agent:', content.agent);
            activeStage = designer.detectActiveStageFromAgent(content.agent);
          }

          if (activeStage) {
            console.log('✨ Animating node:', activeStage.id, activeStage.color, activeStage.icon);
            designer.animatePipelineNode(activeStage.id, activeStage.color, activeStage.icon);

            // Show progress message in UI
            designer.updateAgentProgress(content.agent, content.message, content.type);
          } else if (content && content.agent) {
            console.log('❌ No matching stage found for agent:', content.agent);
          }

          if (content && content.message) {
            designer.addChatMessage('pipeline', content.agent || 'Pipeline', content.message, null, '🔄');
          }

        } else if (response.type === 'pipeline-complete') {
          // Pipeline execution completed successfully
          console.log('✅ Pipeline complete:', response.content);
          designer.addChatMessage('success', 'Pipeline Complete', `Pipeline "${response.pipeline}" executed successfully!`, JSON.stringify(response.content, null, 2), '🎉');

          // Re-enable execute button
          if (executeButton) {
            executeButton.disabled = false;
            executeButton.textContent = 'Execute Pipeline';
          }

        } else if (response.type === 'pipeline-error') {
          // Pipeline execution failed
          console.error('❌ Pipeline error:', response.content);
          designer.addChatMessage('error', 'Pipeline Error', 'Pipeline execution failed', response.content, '❌');

          // Re-enable execute button
          if (executeButton) {
            executeButton.disabled = false;
            executeButton.textContent = 'Execute Pipeline';
          }

        } else if (response.type === 'agent-status') {
          // Real-time agent status updates with pipeline visualization
          console.log('📊 Agent status update:', response.content);
          
          // Update live execution dashboard
          designer.updateExecutionDashboard(response.content);
          
          // FILTER OUT INTERNAL PROMPTS AND SHOW ONLY MEANINGFUL UPDATES
          // Parse the agent status to determine current pipeline stage
          let statusMessage = '';
          if (typeof response.content === 'string') {
            statusMessage = response.content;
          } else if (typeof response.content === 'object' && response.content.message) {
            statusMessage = response.content.message;
          } else {
            statusMessage = JSON.stringify(response.content);
          }
          
          // Skip internal prompts and technical messages that aren't user-facing
          const skipPatterns = [
            'You are a',
            'You are the',
            'TASK_PLANNER',
            'TASK_EXECUTOR', 
            'PROOF_VALIDATOR',
            'DISCERNING_EXPERT',
            'Your job is to',
            'Response format:',
            'UNDERSTANDING:',
            'APPROACH:',
            'STEPS:',
            'EVIDENCE:',
            'ASSESSMENT:',
            'DECISION:',
            'spawn',
            'Claude instance',
            'Process exited',
            'stderr',
            'stdout'
          ];
          
          // Check if this is an internal prompt/technical message
          const isInternalMessage = skipPatterns.some(pattern => 
            statusMessage.toLowerCase().includes(pattern.toLowerCase())
          );
          
          if (isInternalMessage) {
            console.log('🔇 Filtered internal message:', statusMessage.substring(0, 100));
            return; // Skip displaying this message
          }
          
          let currentStage = '';
          let stageIcon = '';
          let stageColor = '';

          // Dynamically determine which pipeline stage is active
          // PREFER stageId if provided (handles multiple stages with same agent)
          let activeStage = null;
          if (response.content.stageId) {
            // Direct lookup by stageId - most reliable
            const stage = designer.pipelineConfig?.stages?.find(s => s.id === response.content.stageId);
            if (stage) {
              activeStage = {
                id: stage.id,
                icon: designer.getStageIcon(stage),
                color: designer.getStageColor(stage)
              };
            }
          } else {
            // Fallback to agent-based detection for backwards compatibility
            const agentName = response.content.agent || '';
            activeStage = designer.detectActiveStageFromAgent(agentName);
          }
          if (activeStage) {
            currentStage = activeStage.id;
            stageIcon = activeStage.icon;
            stageColor = activeStage.color;
          }
          
          // Only animate and show messages that have meaningful stage information
          if (currentStage) {
            designer.animatePipelineNode(currentStage, stageColor, stageIcon);
            
            // Create or update compact pipeline status (smaller)
            let pipelineVisualization = document.getElementById('pipelineVisualization');
            if (!pipelineVisualization) {
              pipelineVisualization = document.createElement('div');
              pipelineVisualization.id = 'pipelineVisualization';
              pipelineVisualization.className = 'pipeline-status-compact';
              resultsDiv.appendChild(pipelineVisualization);
            }
            
            // Update compact status
            pipelineVisualization.innerHTML = `
              <div class="compact-status">
                <span class="status-icon" style="color: ${stageColor};">${stageIcon}</span>
                <span class="status-text">${currentStage}</span>
              </div>
            `;
          }
          
          // Show commentator popup if this is a commentator message (but filter out system prompts)
          if (response.content.agent === 'COMMENTATOR' && response.content.message && !isInternalMessage) {
            designer.showCommentatorPopup(response.content.message);
          }
          
          // Only show meaningful messages in the log, not internal prompts
          if (!isInternalMessage && statusMessage.length > 10) {
            const agentName = response.content.agent || currentStage || 'Agent';
            designer.addChatMessage('agent', agentName, statusMessage, null, stageIcon || '🤖');
          }
          
        } else if (response.type === 'claude-response') {
          // Final response from Claude
          console.log('🎯 Final Claude response received');
          designer.addChatMessage('success', 'Pipeline Complete', 'Execution finished successfully', response.content, '✅');
          
          // Check for generated files in the working directory
          setTimeout(() => {
            checkForGeneratedFiles();
          }, 1000);
          
          // Re-enable execute button
          if (executeButton) {
            executeButton.disabled = false;
            executeButton.textContent = 'Execute Pipeline';
          }
          
          // Close WebSocket
          ws.close();
          
        } else if (response.type === 'file-created') {
          // Real-time file creation notification
          console.log('📄 File created:', response.file);
          
          // Show file creation notification
          const notification = document.createElement('div');
          notification.className = 'file-creation-notification';
          notification.innerHTML = `
            <div class="file-notification-icon">📄</div>
            <div class="file-notification-text">
              <strong>File Created</strong><br>
              ${response.file.name}
            </div>
          `;
          notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(5, 150, 105, 0.95));
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            animation: slideInRight 0.3s ease-out;
          `;
          
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
          
          // Update file outputs immediately
          checkForGeneratedFiles();
          
        } else if (response.type === 'agent-log') {
          // Full agent log (optional display)
          console.log('📊 Full agent log available:', response.content);
          
        }
        
      } catch (error) {
        console.error('❌ Error parsing response:', error);
        designer.addChatMessage('error', 'Parse Error', 'Failed to parse server response', error.message, '❌');
      }
    };
    
    ws.onerror = function(error) {
      console.error('❌ WebSocket error:', error);
      designer.clearChatMessages();
      designer.addChatMessage('error', 'Connection Error', 'Failed to connect to proxy server at ws://localhost:8081', 'Make sure proxy server is running • Check port 8081 availability • Try refreshing page', '❌');
      
      // Re-enable execute button
      if (executeButton) {
        executeButton.disabled = false;
        executeButton.textContent = 'Execute Pipeline';
      }
    };
    
    ws.onclose = function(event) {
      console.log('🔌 WebSocket connection closed:', event.code, event.reason);
      if (event.code !== 1000) { // Not a normal closure
        console.log('⚠️ Unexpected WebSocket closure');
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to create WebSocket connection:', error);
    resultsDiv.innerHTML = `
      <div class="error-message">
        <strong>Setup Error:</strong> ${error.message}
      </div>
    `;
    
    // Re-enable execute button
    if (executeButton) {
      executeButton.disabled = false;
      executeButton.textContent = 'Execute Pipeline';
    }
  }
}

// Initialize the designer
const designer = new PipelineDesigner();
window.designer = designer; // Expose for reconnect functionality

// Function to load templates from server and populate the sidebar
async function loadTemplatesFromServer() {
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      // Wait a moment for connection confirmation, then send request
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'get-templates'
        }));
      }, 100);
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === 'templates-list') {
          console.log(`🎯 Received ${response.templates.length} templates from server`);
          populateTemplateSidebar(response.templates);
          ws.close();
        } else if (response.type === 'system') {
          console.log('📡 Server connection confirmed');
        }
      } catch (error) {
        console.error('Error parsing templates response:', error);
      }
    };
    
    ws.onerror = () => {
      console.error('Failed to connect to server for templates');
    };
    
  } catch (error) {
    console.error('Error loading templates from server:', error);
  }
}

// Function to populate the template sidebar with dynamic templates
function populateTemplateSidebar(templates) {
  const templatesContainer = document.querySelector('.templates-container');
  if (!templatesContainer) return;
  
  // Clear existing template items (except the create custom button)
  const existingTemplates = templatesContainer.querySelectorAll('.template-item:not(#createCustomTemplate)');
  existingTemplates.forEach(item => item.remove());
  
  // Add templates from server
  templates.forEach(template => {
    const templateItem = document.createElement('div');
    templateItem.className = 'template-item';
    templateItem.setAttribute('data-template', template.id);
    
    templateItem.innerHTML = `
      <div class="template-content">
        <div class="template-name">${getTemplateIcon(template.id)} ${template.name}</div>
        <div class="template-description">${template.description}</div>
      </div>
      <button class="template-delete-btn" onclick="deleteTemplate('${template.id}')" title="Delete Pipeline">🗑️</button>
    `;
    
    // Template click event is handled by event delegation in constructor
    
    // Insert before the create custom template button
    const createCustomBtn = document.getElementById('createCustomTemplate');
    templatesContainer.insertBefore(templateItem, createCustomBtn);
  });
  
  console.log(`Loaded ${templates.length} templates from server`);
}

// Helper function to get template icons
function getTemplateIcon(templateId) {
  const icons = {
    'claude-plus-v1': '🚀',
    'dynamic-engineering-v1': '⚡',
    'thesis-generator-v1': '🎓',
    'thesis-preprocessing-v1': '🎯'
  };
  return icons[templateId] || '📋';
}

// Agent Management Functions
async function loadAgentsFromServer() {
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'get-agents'
        }));
      }, 100);
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === 'agents-list') {
          console.log(`🤖 Received ${response.agents.length} agents from server`);
          populateAgentSidebar(response.agents);
          populateAgentManager(response.agents);
        } else if (response.type === 'system') {
          console.log('📡 Server connection confirmed');
        }
      } catch (error) {
        console.error('Error parsing agents response:', error);
      }
    };
    
    ws.onerror = () => {
      console.error('Failed to connect to server for agents');
    };
    
  } catch (error) {
    console.error('Error loading agents from server:', error);
  }
}

function populateAgentSidebar(agents) {
  const agentsContainer = document.querySelector('.agents-container');
  if (!agentsContainer) return;
  
  // Store loaded agents globally for createNodeFromAgent
  window.loadedAgents = agents;
  
  agentsContainer.innerHTML = '';
  
  agents.forEach(agent => {
    const agentItem = document.createElement('div');
    agentItem.className = 'agent-item';
    agentItem.setAttribute('draggable', 'true');
    agentItem.setAttribute('data-agent', agent.id);
    
    agentItem.innerHTML = `
      <div class="agent-name">${agent.name}</div>
      <div class="agent-role">${agent.description}</div>
    `;
    
    // Set up drag event for this agent
    agentItem.addEventListener('dragstart', (e) => {
      console.log('🤖 [DRAG] Agent drag started:', agent.id);
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'agent',
        id: agent.id
      }));
    });
    
    agentsContainer.appendChild(agentItem);
  });
  
  console.log(`Loaded ${agents.length} agents into sidebar`);
}

function populateAgentManager(agents) {
  const agentsList = document.getElementById('agentsList');
  if (!agentsList) return;
  
  agentsList.innerHTML = '';
  
  agents.forEach(agent => {
    const agentItem = document.createElement('div');
    agentItem.className = 'agent-list-item';
    
    agentItem.innerHTML = `
      <div class="agent-info">
        <div class="agent-name">${agent.name}</div>
        <div class="agent-description">${agent.description}</div>
        <div style="margin-top: 8px; color: rgba(255,255,255,0.5); font-size: 10px;">
          Type: ${agent.type || 'Not specified'} | Version: ${agent.version || 'Not specified'} | Capabilities: ${Array.isArray(agent.capabilities) ? agent.capabilities.join(', ') : 'Not specified'}
        </div>
      </div>
      <div class="agent-actions">
        <button class="agent-btn" onclick="editAgent('${agent.id}')">Edit</button>
        <button class="agent-btn delete" onclick="deleteAgentFromManager('${agent.id}')">Delete</button>
      </div>
    `;
    
    agentsList.appendChild(agentItem);
  });
}

function openAgentManager() {
  document.getElementById('agentModal').style.display = 'block';
  loadAgentsFromServer(); // Refresh the list
}

function closeAgentManager() {
  document.getElementById('agentModal').style.display = 'none';
}

function editAgent(agentId) {
  console.log(`🔧 Editing agent: ${agentId}`);
  
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      console.log(`📡 Connected, requesting agent data for: ${agentId}`);
      ws.send(JSON.stringify({
        type: 'get-agent',
        agentId: agentId
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log(`📨 Received response type: ${response.type}`);
        
        if (response.type === 'agent-data') {
          console.log(`🤖 Agent data loaded for: ${response.agent.name}`);
          
          // Create a modal-style editor instead of prompt
          openAgentEditor(response.agent);
        } else if (response.type === 'agent-not-found') {
          alert(`Agent "${agentId}" not found on server.`);
        } else if (response.type === 'system') {
          console.log('📡 System connection message');
          return; // Don't close on system message
        }
      } catch (error) {
        console.error('Error parsing agent data:', error);
        alert('Error loading agent data. Check console for details.');
      }
      
      if (response.type !== 'system') {
        ws.close();
      }
    };
    
    ws.onerror = () => {
      console.error('❌ Failed to connect to server for agent editing');
      alert('Failed to connect to server. Make sure the proxy server is running.');
    };
    
  } catch (error) {
    console.error('Error loading agent for editing:', error);
    alert(`Error: ${error.message}`);
  }
}

function openAgentEditor(agent) {
  console.log(`📝 Opening editor for agent: ${agent.name}`);
  
  // Create a simple modal with textarea for JSON editing
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: #2d2d30;
    border: 1px solid #64ffda;
    border-radius: 8px;
    padding: 20px;
    width: 80%;
    max-width: 800px;
    height: 80%;
    display: flex;
    flex-direction: column;
  `;
  
  const header = document.createElement('div');
  header.style.cssText = `
    color: #64ffda;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <span>Edit Agent: ${agent.name}</span>
    <button onclick="this.closest('.agent-editor-modal').remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
  `;
  
  const textarea = document.createElement('textarea');
  textarea.style.cssText = `
    flex: 1;
    background: #1e1e1e;
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    resize: none;
    margin-bottom: 15px;
  `;
  textarea.value = JSON.stringify(agent, null, 2);
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `;
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save Agent';
  saveButton.style.cssText = `
    background: #64ffda;
    color: #000;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  `;
  saveButton.onclick = () => {
    try {
      const editedAgent = JSON.parse(textarea.value);
      console.log(`💾 Saving edited agent: ${editedAgent.id}`);
      saveAgent(editedAgent);
      modal.remove();
    } catch (error) {
      alert('Invalid JSON format. Please check your syntax.');
    }
  };
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: #666;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  `;
  cancelButton.onclick = () => modal.remove();
  
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(saveButton);
  
  content.appendChild(header);
  content.appendChild(textarea);
  content.appendChild(buttonContainer);
  modal.appendChild(content);
  modal.className = 'agent-editor-modal';
  
  document.body.appendChild(modal);
  
  console.log(`✅ Agent editor opened for: ${agent.name}`);
}

function saveAgent(agentData) {
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'save-agent',
        agent: agentData
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === 'agent-saved') {
          alert(`Agent "${agentData.id}" saved successfully!`);
          loadAgentsFromServer(); // Refresh the list
        } else if (response.type === 'agent-save-failed') {
          alert(`Failed to save agent: ${response.error}`);
        }
      } catch (error) {
        console.error('Error parsing save response:', error);
      }
      ws.close();
    };
    
  } catch (error) {
    console.error('Error saving agent:', error);
  }
}

function deleteAgentFromManager(agentId) {
  if (!confirm(`Are you sure you want to delete agent "${agentId}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'delete-agent',
        agentId: agentId
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === 'agent-deleted' && response.success) {
          alert(`Agent "${agentId}" deleted successfully!`);
          loadAgentsFromServer(); // Refresh the list
        } else {
          alert(`Failed to delete agent "${agentId}"`);
        }
      } catch (error) {
        console.error('Error parsing delete response:', error);
      }
      ws.close();
    };
    
  } catch (error) {
    console.error('Error deleting agent:', error);
  }
}

// Event listeners for template selection
document.addEventListener('DOMContentLoaded', async () => {
  // Load templates from server first
  await loadTemplatesFromServer();
  
  // Load agents from server
  await loadAgentsFromServer();
  
  // Custom pipeline creator
  document.getElementById('createCustomTemplate').addEventListener('click', () => {
    openCustomPipelineModal();
  });

  // Default load - try to load claude-plus-v1, fallback if needed
  try {
    await designer.loadTemplate('claude-plus-v1');
  } catch (error) {
    console.error('Error loading default template:', error);
  }
  
  // Check for active pipelines that might be running
  checkForActivePipelines();
  
  // Restore state on load
  restoreState();
});

// Node expansion functionality
function expandNodes() {
  if (!designer || designer.nodes.size === 0) {
    alert('No nodes to expand! Load a template first.');
    return;
  }

  console.log('🔄 Expanding nodes for better visibility...');
  
  // Calculate bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const [nodeId, node] of designer.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }
  
  const currentWidth = maxX - minX;
  const currentHeight = maxY - minY;
  const centerX = minX + currentWidth / 2;
  const centerY = minY + currentHeight / 2;
  
  // Expansion factor - increase spacing by 2x
  const expansionFactor = 2;
  
  // Expand each node position from center
  for (const [nodeId, node] of designer.nodes) {
    const offsetX = node.position.x - centerX;
    const offsetY = node.position.y - centerY;
    
    const newX = centerX + (offsetX * expansionFactor);
    const newY = centerY + (offsetY * expansionFactor);
    
    node.position.x = newX;
    node.position.y = newY;
    
    // Update DOM element position
    if (node.element) {
      node.element.style.left = `${newX}px`;
      node.element.style.top = `${newY}px`;
    }
  }
  
  // Redraw connections
  if (designer.updateConnectionLines) {
    designer.updateConnectionLines();
  }
  
  // Save state after expansion
  saveState();
  
  console.log(`✅ Expanded ${designer.nodes.size} nodes with ${expansionFactor}x spacing`);
}

function contractNodes() {
  if (!designer || designer.nodes.size === 0) {
    alert('No nodes to contract! Load a template first.');
    return;
  }

  console.log('🔄 Contracting nodes for tighter layout...');
  
  // Calculate bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const [nodeId, node] of designer.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }
  
  const currentWidth = maxX - minX;
  const currentHeight = maxY - minY;
  const centerX = minX + currentWidth / 2;
  const centerY = minY + currentHeight / 2;
  
  // Contraction factor - decrease spacing by 0.5x
  const contractionFactor = 0.5;
  
  // Contract each node position toward center
  for (const [nodeId, node] of designer.nodes) {
    const offsetX = node.position.x - centerX;
    const offsetY = node.position.y - centerY;
    
    const newX = centerX + (offsetX * contractionFactor);
    const newY = centerY + (offsetY * contractionFactor);
    
    node.position.x = newX;
    node.position.y = newY;
    
    // Update DOM element position
    if (node.element) {
      node.element.style.left = `${newX}px`;
      node.element.style.top = `${newY}px`;
    }
  }
  
  // Redraw connections
  if (designer.updateConnectionLines) {
    designer.updateConnectionLines();
  }
  
  // Save state after contraction
  saveState();
  
  console.log(`✅ Contracted ${designer.nodes.size} nodes with ${contractionFactor}x spacing`);
}

// State persistence functionality
function saveState() {
  const state = {
    timestamp: Date.now(),
    nodes: {},
    connections: designer.connections || [],
    pipelineConfig: designer.pipelineConfig || {},
    executionState: {
      isRunning: designer.isExecuting || false,
      currentPipeline: designer.currentPipelineId || null,
      logs: Array.from(document.querySelectorAll('.chat-message')).map(msg => msg.outerHTML)
    }
  };
  
  // Save node positions and states
  for (const [nodeId, node] of designer.nodes) {
    state.nodes[nodeId] = {
      position: { ...node.position },
      config: { ...node.config },
      status: node.status || 'idle',
      progress: node.progress || null
    };
  }
  
  localStorage.setItem('pipelineDesignerState', JSON.stringify(state));
  console.log('💾 State saved to localStorage');
}

function restoreState() {
  try {
    const savedState = localStorage.getItem('pipelineDesignerState');
    if (!savedState) return;
    
    const state = JSON.parse(savedState);
    const ageMinutes = (Date.now() - state.timestamp) / (1000 * 60);
    
    // Only restore if state is less than 24 hours old
    if (ageMinutes > 1440) {
      console.log('🕒 Saved state too old, starting fresh');
      localStorage.removeItem('pipelineDesignerState');
      return;
    }
    
    console.log('🔄 Restoring state from localStorage...');
    
    // Restore pipeline config
    if (state.pipelineConfig) {
      designer.pipelineConfig = state.pipelineConfig;
    }
    
    // Restore execution state
    if (state.executionState) {
      if (state.executionState.isRunning) {
        console.log('⚡ Detected previously running pipeline, attempting reconnection...');
        // Could add reconnection logic here
      }
      
      // Restore chat logs
      if (state.executionState.logs && state.executionState.logs.length > 0) {
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
          chatContainer.innerHTML = state.executionState.logs.join('');
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
    }
    
    // Restore node positions when nodes are loaded
    if (state.nodes && Object.keys(state.nodes).length > 0) {
      // Set up a delayed restoration after templates load
      setTimeout(() => {
        for (const [nodeId, nodeState] of Object.entries(state.nodes)) {
          const node = designer.nodes.get(nodeId);
          if (node && nodeState.position) {
            node.position = { ...nodeState.position };
            if (node.element) {
              node.element.style.left = `${nodeState.position.x}px`;
              node.element.style.top = `${nodeState.position.y}px`;
            }
            
            // Restore node status/progress if available
            if (nodeState.status) {
              node.status = nodeState.status;
            }
            if (nodeState.progress) {
              node.progress = nodeState.progress;
              // Could update visual indicators here
            }
          }
        }
        designer.updateConnectionLines();
        console.log('✅ Node positions and states restored');
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ Error restoring state:', error);
    localStorage.removeItem('pipelineDesignerState');
  }
}

// Auto-save state when nodes are moved or modified
function setupAutoSave() {
  // Override node movement to trigger saves
  const originalHandlers = [];

  // Save state on any significant change
  setInterval(() => {
    if (designer && designer.nodes.size > 0) {
      saveState();
    }
  }, 30000); // Auto-save every 30 seconds
}

// Toggle properties panel collapse/expand
function togglePropertiesPanel() {
  const panel = document.getElementById('propertiesPanel');
  if (panel) {
    panel.classList.toggle('collapsed');
  }
}

// Toggle output/prompt visibility in chat
function toggleOutput(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = element.style.display === 'none' ? 'block' : 'none';
  }
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}