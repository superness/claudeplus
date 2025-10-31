/**
 * CLAUDE AI ASSISTANT - WEB VERSION
 * Exact replica of the Electron app running the same pipeline
 */

let connected = false;
let currentAgentProcess = null;
let shownCommentaryIds = new Set();
let ws = null;

// Debug: Web app initialization
console.log('[WEB-APP] Claude AI Assistant Web Version initialized');

const connectionStatus = document.getElementById('connectionStatus');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const currentDirectory = document.getElementById('currentDirectory');
const selectDirectoryBtn = document.getElementById('selectDirectoryBtn');

// Connect to proxy server - EXACTLY like the Electron app
function connectToProxy() {
  try {
    console.log('[WEB-APP] Attempting to connect to proxy...');
    ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      console.log('[WEB-APP] WebSocket opened - Connected to WSL proxy');
      connected = true;
      updateConnectionStatus('connected', 'Connected to AI System');
      sendBtn.disabled = false;
    };
    
    ws.onmessage = (event) => {
      console.log('[WEB-APP] Received message from proxy:', event.data);
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'system' && message.content === 'Connected to proxy server') {
          console.log('[WEB-APP] Received system connection confirmation');
          updateConnectionStatus('connected', 'Connected to AI System');
        } else {
          handleProxyMessage(message);
        }
      } catch (error) {
        console.log('[WEB-APP] Error parsing message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.log('[WEB-APP] Proxy connection error:', error);
      updateConnectionStatus('error', `Connection Error: ${error.message}`);
      connected = false;
      sendBtn.disabled = true;
      hideTyping();
    };

    ws.onclose = () => {
      console.log('[WEB-APP] Connection to proxy closed');
      connected = false;
      updateConnectionStatus('error', 'Connection lost - Reconnecting...');
      sendBtn.disabled = true;
      
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        connectToProxy();
      }, 3000);
    };
    
  } catch (error) {
    console.log('[WEB-APP] Failed to connect to proxy:', error);
    updateConnectionStatus('error', 'Failed to connect');
  }
}

// Handle all message types from proxy - EXACTLY like Electron app
function handleProxyMessage(response) {
  if (response.type === 'system-status') {
    handleSystemStatus(response.content);
  } else if (response.type === 'agent-status') {
    // Real-time agent status update
    handleAgentStatusUpdate(response.content);
  } else if (response.type === 'agent-log') {
    // Process agent logs for real-time status updates
    processAgentLogs(response.content);
  } else if (response.type === 'claude-response') {
    // Final AI response
    handleFinalResponse(response.content);
  } else if (response.type === 'directory-changed') {
    // Directory change confirmation
    handleDirectoryChanged(response.directory);
  } else if (response.type === 'directory-error') {
    // Directory change error
    handleDirectoryError(response.error);
  } else if (response.content) {
    // Fallback for direct responses
    handleFinalResponse(response.content);
  }
}

function updateConnectionStatus(status, message) {
  connectionStatus.className = `connection-status status-${status}`;
  connectionStatus.innerHTML = `
    <div class="status-dot"></div>
    ${message}
  `;
}

function handleSystemStatus(message) {
  if (message.includes('Initializing multi-agent')) {
    showTyping('Initializing AI validation system...');
    initializeAgentProcess();
  }
}

function initializeAgentProcess() {
  // Create agent status container if it doesn't exist
  if (!currentAgentProcess) {
    currentAgentProcess = {
      planner: { status: 'pending', activity: 'Waiting...' },
      expert: { status: 'pending', activity: 'Waiting...' },
      executor: { status: 'pending', activity: 'Waiting...' },
      validator: { status: 'pending', activity: 'Waiting...' }
    };
  }
}

function processAgentLogs(logEntries) {
  if (!Array.isArray(logEntries)) return;
  
  logEntries.forEach(entry => {
    const agent = entry.agent?.toLowerCase();
    const type = entry.type?.toLowerCase();
    const message = entry.message;
    
    // Skip commentator messages in batch processing - they're already shown in real-time
    if (agent === 'commentator') {
      console.log('[WEB-APP] Skipping batch commentator message to avoid duplication:', message.substring(0, 50));
      return;
    }
    
    if (agent && currentAgentProcess) {
      updateAgentStatus(agent, type, message);
    }
  });
}

function handleAgentStatusUpdate(logEntry) {
  if (!logEntry || !currentAgentProcess) return;
  
  const agent = logEntry.agent?.toLowerCase();
  const type = logEntry.type?.toLowerCase();
  
  // Handle commentator messages specially - EXACT same logic as Electron app
  if (agent === 'commentator') {
    handleCommentatorUpdate(type, logEntry.message, logEntry.style);
    return;
  }
  
  updateAgentStatus(agent, type, logEntry.message);
}

function updateAgentStatus(agentName, type, message) {
  const agentMap = {
    'task_planner': 'planner',
    'discerning_expert': 'expert', 
    'task_executor': 'executor',
    'proof_validator': 'validator',
    'planning_phase': 'expert',
    'execution_phase': 'executor',
    'validation_phase': 'validator'
  };
  
  const mappedAgent = agentMap[agentName] || agentName;
  
  if (currentAgentProcess[mappedAgent]) {
    if (type === 'spawn') {
      currentAgentProcess[mappedAgent].status = 'working';
      currentAgentProcess[mappedAgent].activity = 'Analyzing...';
      updateTypingMessage(`${getAgentDisplayName(mappedAgent)} is working...`);
    } else if (type === 'close') {
      currentAgentProcess[mappedAgent].status = 'complete';
      currentAgentProcess[mappedAgent].activity = 'Complete';
    } else if (type === 'rejected') {
      currentAgentProcess[mappedAgent].status = 'rejected';
      currentAgentProcess[mappedAgent].activity = 'Rejected - Revising...';
      updateTypingMessage(`${getAgentDisplayName(mappedAgent)} rejected plan - revising...`);
    } else if (type === 'start') {
      updateTypingMessage(`${getAgentDisplayName(mappedAgent)} starting...`);
    }
  }
}

// COMMENTATOR SYSTEM - EXACT same as Electron app
function handleCommentatorUpdate(type, message, style = 'neutral') {
  console.log('[WEB-APP] Commentator update received:', { type, message, style });
  
  // Create unique ID for deduplication based on message content only
  const messageId = message.substring(0, 100); // Use first 100 chars as unique identifier
  if (shownCommentaryIds.has(messageId)) {
    console.log('[WEB-APP] Skipping duplicate commentator message:', messageId);
    return;
  }
  
  // Display commentator insights as special floating notifications
  if (type === 'commentary' || type === 'success' || type === 'insight' || type === 'stdout') {
    console.log('[WEB-APP] Showing commentator insight with style:', style);
    shownCommentaryIds.add(messageId);
    showCommentatorInsight(message, type, style);
  }
}

function showCommentatorInsight(message, type, style = 'neutral') {
  const insightEl = document.createElement('div');
  
  // Remove styling directive from display text
  const cleanMessage = message.replace(/^\[STYLE:\w+\]\s*/, '');
  
  // Determine insight class based on type and style
  let insightClass = 'insight-commentary';
  if (type === 'success') insightClass = 'insight-success';
  else if (style === 'critical') insightClass = 'insight-critical';
  else if (style === 'warning') insightClass = 'insight-warning';
  
  insightEl.className = `commentator-insight ${insightClass}`;
  insightEl.innerHTML = `
    <div class="insight-avatar">${getInsightAvatar(type, style)}</div>
    <div class="insight-content">
      <div class="insight-label">AI Commentary</div>
      <div class="insight-message">${formatCommentatorMessage(cleanMessage)}</div>
    </div>
  `;
  
  messagesContainer.appendChild(insightEl);
  scrollToBottom();
  
  // Enhanced entrance animation
  requestAnimationFrame(() => {
    insightEl.classList.add('visible');
  });
}

function getInsightAvatar(type, style) {
  if (type === 'success') return '🌟';
  if (style === 'critical') return '🔥';
  if (style === 'warning') return '⚡';
  return '🎙️';
}

function formatCommentatorMessage(message) {
  return message
    // HUGE bold impact words
    .replace(/\b(BREAKTHROUGH|DEVASTATING|CRITICAL|BRUTAL|CRISIS|FAILURE|SUCCESS)\b/g, 
      '<span style="font-size: 1.3em; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); color: #fff;">$1</span>')
    
    // Medium bold technical terms
    .replace(/\b(REJECTED|APPROVED|API|VALIDATION|SYSTEM|EXECUTION|PLAN)\b/g, 
      '<strong style="font-weight: 700; color: #64ffda; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">$1</strong>')
    
    // Agent names with special styling
    .replace(/\b(Expert|Task Planner|Executor|Validator)\b/g, 
      '<span style="background: linear-gradient(45deg, #64ffda, #00bcd4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700; font-size: 1.1em;">$1</span>')
    
    // Numbers and attempts with highlight
    .replace(/\b(attempt #?\d+|#\d+|\d+(?:st|nd|rd|th) (?:attempt|rejection|time))\b/gi, 
      '<span style="background: rgba(255, 193, 7, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #fff;">$1</span>')
    
    // Exclamation emphasis
    .replace(/(!{2,})/g, '<span style="color: #ff5722; font-size: 1.2em; text-shadow: 0 0 4px #ff5722;">$1</span>');
}

function getAgentDisplayName(agentKey) {
  const names = {
    'planner': 'Task Planner',
    'expert': 'Expert Reviewer',
    'executor': 'Task Executor', 
    'validator': 'Proof Validator'
  };
  return names[agentKey] || capitalizeFirst(agentKey);
}

function handleFinalResponse(content) {
  hideTyping();
  addAIResponse(content, currentAgentProcess);
  currentAgentProcess = null; // Reset for next interaction
}

function showTyping(message = 'AI is thinking') {
  typingIndicator.style.display = 'flex';
  typingIndicator.querySelector('span').textContent = message;
}

function hideTyping() {
  typingIndicator.style.display = 'none';
}

function updateTypingMessage(message) {
  if (typingIndicator.style.display === 'flex') {
    typingIndicator.querySelector('span').textContent = message;
  }
}

function addUserMessage(content) {
  const messageEl = document.createElement('div');
  messageEl.className = 'user-message';
  messageEl.textContent = content;
  
  messagesContainer.appendChild(messageEl);
  scrollToBottom();
}

function addAIResponse(content, agentProcess = null) {
  const responseEl = document.createElement('div');
  responseEl.className = 'ai-response';
  
  responseEl.innerHTML = `
    <div class="ai-badge">
      <span>✓</span>
      AI-Validated Response
    </div>
    <div class="ai-content">${formatContent(content)}</div>
  `;
  
  messagesContainer.appendChild(responseEl);
  scrollToBottom();
  
  // Add entrance animation
  requestAnimationFrame(() => {
    responseEl.style.opacity = '0';
    responseEl.style.transform = 'translateY(20px)';
    responseEl.style.transition = 'all 0.3s ease';
    
    requestAnimationFrame(() => {
      responseEl.style.opacity = '1';
      responseEl.style.transform = 'translateY(0)';
    });
  });
}

function formatContent(content) {
  // Handle code blocks
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, 
    '<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0;"><code>$2</code></pre>');
  
  // Handle inline code
  content = content.replace(/`([^`]+)`/g, 
    '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-family: Monaco, monospace;">$1</code>');
  
  // Handle line breaks
  content = content.replace(/\n/g, '<br>');
  
  return content;
}

function scrollToBottom() {
  // Force scroll after any pending DOM updates
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Directory selection handlers - EXACT same as Electron app
function handleDirectoryChanged(directory) {
  console.log('[WEB-APP] Directory change confirmed:', directory);
  currentDirectory.value = directory;
  
  // Show a brief confirmation message
  const originalPlaceholder = currentDirectory.placeholder;
  currentDirectory.placeholder = 'Directory updated successfully!';
  setTimeout(() => {
    currentDirectory.placeholder = originalPlaceholder;
  }, 2000);
}

function handleDirectoryError(error) {
  console.error('[WEB-APP] Directory change error:', error);
  
  // Show error message
  const originalPlaceholder = currentDirectory.placeholder;
  currentDirectory.placeholder = `Error: ${error}`;
  currentDirectory.style.borderColor = '#f44336';
  
  setTimeout(() => {
    currentDirectory.placeholder = originalPlaceholder;
    currentDirectory.style.borderColor = '';
  }, 3000);
}

// Directory selection function - Simulated for web
async function selectDirectory() {
  try {
    // Simulate directory selection for web version
    const directories = [
      'C:\\github\\claudeplus\\output',
      'C:\\github\\my-project',  
      'C:\\Users\\Documents\\workspace',
      'C:\\development\\ai-projects',
      'C:\\temp\\claude-work'
    ];
    
    const selectedPath = directories[Math.floor(Math.random() * directories.length)];
    currentDirectory.value = selectedPath;
    console.log('[WEB-APP] Directory selected:', selectedPath);
    
    // Send to proxy if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'directory-change', 
        directory: selectedPath 
      }));
    }
  } catch (error) {
    console.error('[WEB-APP] Directory selection error:', error);
  }
}

// Send message function - EXACT same as Electron app
function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !connected) return;
  
  // Clear commentary deduplication for new conversation
  shownCommentaryIds.clear();
  
  addUserMessage(message);
  showTyping('Initializing AI validation system...');
  
  // Send to proxy - EXACT same as Electron app
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'user-message', content: message }));
  }
  messageInput.value = '';
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

selectDirectoryBtn.addEventListener('click', selectDirectory);

// Initialize connection when page loads
window.addEventListener('load', () => {
  console.log('[WEB-APP] Page loaded, connecting to proxy...');
  connectToProxy();
  
  // Set default directory
  currentDirectory.value = 'C:\\github\\claudeplus\\output';
  
  // Force connection after 3 seconds if needed
  setTimeout(() => {
    if (!connected) {
      console.log('[WEB-APP] Forcing connection attempt...');
      connectToProxy();
    }
  }, 3000);
});