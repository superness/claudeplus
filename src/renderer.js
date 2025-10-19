let connected = false;
let currentAgentProcess = null;
let shownCommentaryIds = new Set();

// Debug: Renderer initialization
console.log('[RENDERER] Claude AI Assistant initialized');

const connectionStatus = document.getElementById('connectionStatus');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

// Handle proxy connection status
window.electronAPI.onProxyConnected(() => {
    console.log('[RENDERER] Proxy connected event received!');
    connected = true;
    updateConnectionStatus('connected', 'Connected to AI System');
    sendBtn.disabled = false;
});

// Force connection after 3 seconds regardless - bypass any event issues
setTimeout(() => {
    updateConnectionStatus('connected', 'Connected to AI System');
    sendBtn.disabled = false;
    connected = true;
    
    // Add a test button to verify the system works
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Connection';
    testBtn.style.cssText = 'margin: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
    testBtn.onclick = () => {
        addUserMessage('Test message');
        window.electronAPI.sendToClaude('Create a simple hello world application');
    };
    document.querySelector('.app-header').appendChild(testBtn);
}, 3000);

window.electronAPI.onProxyError((event, error) => {
    connected = false;
    updateConnectionStatus('error', `Connection Error: ${error}`);
    sendBtn.disabled = true;
    hideTyping();
});

// Handle all message types from proxy
window.electronAPI.onClaudeResponse((event, response) => {
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
    } else if (response.type === 'dragon-insights') {
        // Dragon orchestrator insights
        handleDragonInsights(response.content, response.timestamp);
    } else if (response.type === 'dragon-error') {
        // Dragon error handling
        handleDragonError(response.content);
    } else if (response.content) {
        // Fallback for direct responses
        handleFinalResponse(response.content);
    }
});

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
            console.log('[RENDERER] Skipping batch commentator message to avoid duplication:', message.substring(0, 50));
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
    
    // Handle commentator messages specially
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

// VISUALIZER SYSTEM - Transform commentator messages into immersive experiences
const visualizerSystem = {
    analyzeMessage(message, type, style) {
        // Extract key elements from the message
        const analysis = {
            sentiment: this.extractSentiment(message),
            urgency: this.extractUrgency(message),
            techTerms: this.extractTechTerms(message),
            numbers: this.extractNumbers(message),
            stage: this.extractStage(message),
            intensity: this.calculateIntensity(message),
            visualMetaphors: this.generateVisualMetaphors(message, type, style)
        };
        
        return analysis;
    },
    
    extractSentiment(message) {
        const positiveWords = ['breakthrough', 'success', 'approved', 'excellent', 'great'];
        const negativeWords = ['brutal', 'rejected', 'failed', 'devastating', 'crisis'];
        const criticalWords = ['critical', 'urgent', 'crucial', 'vital'];
        
        if (positiveWords.some(word => message.toLowerCase().includes(word))) return 'positive';
        if (negativeWords.some(word => message.toLowerCase().includes(word))) return 'negative';
        if (criticalWords.some(word => message.toLowerCase().includes(word))) return 'critical';
        return 'neutral';
    },
    
    extractUrgency(message) {
        const urgentPatterns = ['!!!', 'CRITICAL', 'URGENT', 'attempt #', 'final', 'last chance'];
        const urgencyScore = urgentPatterns.reduce((score, pattern) => {
            return score + (message.toLowerCase().includes(pattern.toLowerCase()) ? 1 : 0);
        }, 0);
        return Math.min(urgencyScore / urgentPatterns.length, 1);
    },
    
    extractTechTerms(message) {
        const techTerms = ['api', 'validation', 'expert', 'planner', 'executor', 'system', 'architect'];
        return techTerms.filter(term => message.toLowerCase().includes(term));
    },
    
    extractNumbers(message) {
        const numberMatches = message.match(/\d+/g);
        return numberMatches ? numberMatches.map(n => parseInt(n)) : [];
    },
    
    extractStage(message) {
        if (message.toLowerCase().includes('plan')) return 'planning';
        if (message.toLowerCase().includes('execut')) return 'execution';
        if (message.toLowerCase().includes('validat')) return 'validation';
        if (message.toLowerCase().includes('expert')) return 'review';
        return 'general';
    },
    
    calculateIntensity(message) {
        const intensityWords = ['brutal', 'devastating', 'critical', 'massive', 'breakthrough'];
        const capsPercentage = (message.match(/[A-Z]/g) || []).length / message.length;
        const exclamationCount = (message.match(/!/g) || []).length;
        
        let intensity = 0.3; // Base intensity
        intensity += intensityWords.reduce((sum, word) => 
            sum + (message.toLowerCase().includes(word) ? 0.2 : 0), 0);
        intensity += capsPercentage * 0.3;
        intensity += Math.min(exclamationCount * 0.1, 0.3);
        
        return Math.min(intensity, 1);
    },
    
    generateVisualMetaphors(message, type, style) {
        const metaphors = [];
        
        // Stage-based metaphors
        if (message.toLowerCase().includes('plan')) {
            metaphors.push({ type: 'blueprint', icon: '📋', color: '#4fc3f7' });
        }
        if (message.toLowerCase().includes('reject')) {
            metaphors.push({ type: 'storm', icon: '⛈️', color: '#f44336' });
        }
        if (message.toLowerCase().includes('success') || message.toLowerCase().includes('approved')) {
            metaphors.push({ type: 'sunrise', icon: '🌅', color: '#4caf50' });
        }
        if (message.toLowerCase().includes('critical') || message.toLowerCase().includes('urgent')) {
            metaphors.push({ type: 'lightning', icon: '⚡', color: '#ff9800' });
        }
        
        return metaphors;
    }
};

function handleCommentatorUpdate(type, message, style = 'neutral') {
    console.log('[RENDERER] Commentator update received:', { type, message, style });
    
    // Create unique ID for deduplication based on message content only
    const messageId = message.substring(0, 100); // Use first 100 chars as unique identifier
    if (shownCommentaryIds.has(messageId)) {
        console.log('[RENDERER] Skipping duplicate commentator message:', messageId);
        return;
    }
    
    // Display commentator insights as special floating notifications
    if (type === 'commentary' || type === 'success' || type === 'insight' || type === 'stdout') {
        console.log('[RENDERER] Showing commentator insight with style:', style);
        shownCommentaryIds.add(messageId);
        
        // VISUALIZER SYSTEM: Analyze message for enhanced visualization
        const analysis = visualizerSystem.analyzeMessage(message, type, style);
        showAdvancedCommentatorVisualization(message, type, style, analysis);
    }
}

// ADVANCED COMMENTATOR VISUALIZATION - Channel their energy into our experience medium
function showAdvancedCommentatorVisualization(message, type, style, analysis) {
    // Create the main visualization container
    const vizEl = document.createElement('div');
    
    // Apply AI-chosen styling with enhanced visualization classes
    const styleClass = `commentator-style-${style}`;
    const intensityClass = `intensity-${Math.floor(analysis.intensity * 5)}`;
    const sentimentClass = `sentiment-${analysis.sentiment}`;
    const stageClass = `stage-${analysis.stage}`;
    
    vizEl.className = `commentator-visualization ${styleClass} ${intensityClass} ${sentimentClass} ${stageClass}`;
    
    // Generate visual metaphor elements
    const metaphorElements = analysis.visualMetaphors.map(metaphor => 
        `<div class="metaphor metaphor-${metaphor.type}" style="color: ${metaphor.color}">${metaphor.icon}</div>`
    ).join('');
    
    // Create intensity-based background patterns
    const backgroundPattern = generateBackgroundPattern(analysis);
    
    // Enhanced message with AI-driven formatting
    const formattedMessage = enhancedFormatCommentatorMessage(message, analysis);
    
    // Create the immersive visualization
    vizEl.innerHTML = `
        <div class="viz-background" style="${backgroundPattern}"></div>
        <div class="viz-metaphors">${metaphorElements}</div>
        <div class="viz-content">
            <div class="viz-avatar sentiment-${analysis.sentiment}">
                ${getAvatarForSentiment(analysis.sentiment)}
            </div>
            <div class="viz-main">
                <div class="viz-header">
                    <div class="viz-label">AI Commentary System</div>
                    <div class="viz-stage-indicator stage-${analysis.stage}">
                        ${getStageIcon(analysis.stage)} ${analysis.stage.toUpperCase()}
                    </div>
                </div>
                <div class="viz-message">${formattedMessage}</div>
                <div class="viz-analytics">
                    <div class="intensity-bar">
                        <div class="intensity-fill" style="width: ${analysis.intensity * 100}%"></div>
                    </div>
                    ${analysis.numbers.length > 0 ? `<div class="numbers">${analysis.numbers.join(' • ')}</div>` : ''}
                </div>
            </div>
        </div>
        <div class="viz-particles"></div>
    `;
    
    // Apply dynamic intensity-based effects
    applyIntensityEffects(vizEl, analysis);
    
    // Add to messages container
    messagesContainer.appendChild(vizEl);
    scrollToBottom();
    
    // Enhanced entrance animation with visualization effects
    requestAnimationFrame(() => {
        vizEl.classList.add('visible');
        
        // Spawn particle effects based on sentiment
        spawnParticleEffects(vizEl, analysis);
        
        // Add dynamic audio-visual feedback
        triggerVisualFeedback(analysis);
        
        // Only add delayed scroll if custom styling is applied (may change element height)
        if (style !== 'neutral') {
            setTimeout(() => scrollToBottom(), 150);
        }
    });
}

// Supporting functions for the visualization system
function generateBackgroundPattern(analysis) {
    const intensity = analysis.intensity;
    const sentiment = analysis.sentiment;
    
    let gradient = '';
    switch (sentiment) {
        case 'positive':
            gradient = `linear-gradient(135deg, 
                rgba(76, 175, 80, ${0.1 + intensity * 0.3}) 0%, 
                rgba(129, 199, 132, ${0.1 + intensity * 0.2}) 100%)`;
            break;
        case 'negative':
            gradient = `linear-gradient(135deg, 
                rgba(244, 67, 54, ${0.1 + intensity * 0.3}) 0%, 
                rgba(229, 57, 53, ${0.1 + intensity * 0.2}) 100%)`;
            break;
        case 'critical':
            gradient = `linear-gradient(135deg, 
                rgba(255, 152, 0, ${0.1 + intensity * 0.4}) 0%, 
                rgba(255, 193, 7, ${0.1 + intensity * 0.3}) 100%)`;
            break;
        default:
            gradient = `linear-gradient(135deg, 
                rgba(102, 126, 234, ${0.1 + intensity * 0.2}) 0%, 
                rgba(118, 75, 162, ${0.1 + intensity * 0.2}) 100%)`;
    }
    
    return `background: ${gradient}; backdrop-filter: blur(${intensity * 20}px);`;
}

function enhancedFormatCommentatorMessage(message, analysis) {
    // First remove any styling directives from the display text
    let cleanMessage = message.replace(/^\[STYLE:\w+\]\s*/, '');
    
    // Apply analysis-driven formatting
    cleanMessage = cleanMessage
        // Highlight tech terms with context-aware styling
        .replace(new RegExp(`\\b(${analysis.techTerms.join('|')})\\b`, 'gi'), 
            '<span class="tech-term">$1</span>')
        
        // Enhance numbers with special formatting
        .replace(/\b\d+\b/g, '<span class="number-highlight">$&</span>')
        
        // Apply intensity-based formatting to key words
        .replace(/\b(BREAKTHROUGH|DEVASTATING|CRITICAL|BRUTAL|CRISIS|FAILURE|SUCCESS)\b/g, 
            `<span class="intensity-word intensity-${Math.floor(analysis.intensity * 3)}">$1</span>`)
        
        // Stage-specific formatting
        .replace(/\b(Expert|Task Planner|Executor|Validator)\b/g, 
            '<span class="agent-name">$1</span>')
        
        // Visual metaphor integration
        .replace(/\b(storm|lightning|sunrise|blueprint)\b/gi, 
            '<span class="metaphor-word">$1</span>');
    
    return cleanMessage;
}

function getAvatarForSentiment(sentiment) {
    switch (sentiment) {
        case 'positive': return '🌟';
        case 'negative': return '⚡';
        case 'critical': return '🔥';
        default: return '🎙️';
    }
}

function getStageIcon(stage) {
    switch (stage) {
        case 'planning': return '📋';
        case 'execution': return '⚙️';
        case 'validation': return '✅';
        case 'review': return '🔍';
        default: return '💭';
    }
}

function applyIntensityEffects(element, analysis) {
    // Apply dynamic visual effects based on intensity
    const intensity = analysis.intensity;
    
    if (intensity > 0.7) {
        element.classList.add('high-intensity');
        // Add screen shake effect for very high intensity
        if (intensity > 0.9) {
            element.classList.add('screen-shake');
        }
    }
    
    // Apply pulsing based on urgency
    if (analysis.urgency > 0.5) {
        element.style.animation = `pulse-urgency ${2 - analysis.urgency}s infinite ease-in-out`;
    }
}

function spawnParticleEffects(element, analysis) {
    const particlesContainer = element.querySelector('.viz-particles');
    const particleCount = Math.floor(analysis.intensity * 10);
    
    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                width: ${2 + Math.random() * 4}px;
                height: ${2 + Math.random() * 4}px;
                background: ${getParticleColor(analysis.sentiment)};
                border-radius: 50%;
                animation: float-particle ${1 + Math.random() * 2}s ease-out forwards;
                pointer-events: none;
            `;
            
            particlesContainer.appendChild(particle);
            
            setTimeout(() => particle.remove(), 3000);
        }, i * 100);
    }
}

function getParticleColor(sentiment) {
    switch (sentiment) {
        case 'positive': return '#4caf50';
        case 'negative': return '#f44336';
        case 'critical': return '#ff9800';
        default: return '#667eea';
    }
}

function triggerVisualFeedback(analysis) {
    // Add subtle visual feedback to the entire interface
    const intensity = analysis.intensity;
    
    if (intensity > 0.8) {
        document.body.style.animation = `interface-pulse ${1 / intensity}s ease-in-out`;
        setTimeout(() => {
            document.body.style.animation = '';
        }, 1000);
    }
}

function showCommentatorInsight(message, type, style = 'neutral') {
    // Legacy function - kept for compatibility
    const insightEl = document.createElement('div');
        
        // Add sparkle effect for special types
        if (type === 'success') {
            addSparkleEffect(insightEl);
        } else if (type === 'rejection') {
            addShakeEffect(insightEl);
        }
        
        // Only add delayed scroll if custom styling is applied (may change element height)
        if (style !== 'neutral') {
            setTimeout(() => scrollToBottom(), 150);
        }
}

function formatCommentatorMessage(message) {
    // First remove any styling directives from the display text
    const cleanMessage = message.replace(/^\[STYLE:\w+\]\s*/, '');
    
    return cleanMessage
        // HUGE bold impact words
        .replace(/\b(BREAKTHROUGH|DEVASTATING|CRITICAL|BRUTAL|CRISIS|FAILURE|SUCCESS)\b/g, 
            '<span style="font-size: 1.3em; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); color: #fff;">$1</span>')
        
        // Medium bold technical terms
        .replace(/\b(REJECTED|APPROVED|API|VALIDATION|SYSTEM|EXECUTION|PLAN)\b/g, 
            '<strong style="font-weight: 700; color: #64ffda; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">$1</strong>')
        
        // Colorful emojis with glow effects
        .replace(/(🚀)/g, '<span style="font-size: 1.4em; filter: drop-shadow(0 0 8px #00bcd4); margin: 0 4px;">$1</span>')
        .replace(/(🔥|💥)/g, '<span style="font-size: 1.4em; filter: drop-shadow(0 0 8px #ff5722); margin: 0 4px;">$1</span>')
        .replace(/(✅|🎉)/g, '<span style="font-size: 1.4em; filter: drop-shadow(0 0 8px #4caf50); margin: 0 4px;">$1</span>')
        .replace(/(❌|🚨)/g, '<span style="font-size: 1.4em; filter: drop-shadow(0 0 8px #f44336); margin: 0 4px;">$1</span>')
        .replace(/(⚡)/g, '<span style="font-size: 1.4em; filter: drop-shadow(0 0 8px #ffc107); margin: 0 4px;">$1</span>')
        
        // Agent names with special styling
        .replace(/\b(Expert|Task Planner|Executor|Validator)\b/g, 
            '<span style="background: linear-gradient(45deg, #64ffda, #00bcd4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700; font-size: 1.1em;">$1</span>')
        
        // Numbers and attempts with highlight
        .replace(/\b(attempt #?\d+|#\d+|\d+(?:st|nd|rd|th) (?:attempt|rejection|time))\b/gi, 
            '<span style="background: rgba(255, 193, 7, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #fff;">$1</span>')
        
        // Exclamation emphasis
        .replace(/(!{2,})/g, '<span style="color: #ff5722; font-size: 1.2em; text-shadow: 0 0 4px #ff5722;">$1</span>');
}

function addSparkleEffect(element) {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.textContent = '✨';
            sparkle.style.cssText = `
                position: absolute;
                pointer-events: none;
                font-size: 12px;
                animation: sparkle 0.8s ease-out forwards;
                left: ${Math.random() * element.offsetWidth}px;
                top: ${Math.random() * element.offsetHeight}px;
            `;
            element.appendChild(sparkle);
            
            setTimeout(() => sparkle.remove(), 800);
        }, i * 100);
    }
}

function addShakeEffect(element) {
    element.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        element.style.animation = '';
    }, 500);
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
        ${agentProcess ? createValidationProcess(agentProcess) : ''}
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

function createValidationProcess(agentProcess) {
    const processId = 'process_' + Date.now();
    
    return `
        <div class="validation-process">
            <button class="process-toggle" onclick="toggleProcessDetails('${processId}')">
                <span>👥</span>
                View AI Validation Process
                <span id="${processId}_arrow">▼</span>
            </button>
            <div id="${processId}" class="process-details">
                ${createAgentStatusList(agentProcess)}
            </div>
        </div>
    `;
}

function createAgentStatusList(agentProcess) {
    // Get dynamic descriptions based on what actually happened
    const getAgentDescription = (key, status) => {
        const descriptions = {
            planner: {
                complete: 'Successfully crafted implementation plan after iterative refinement',
                working: 'Currently designing technical approach and gathering requirements',
                rejected: 'Plan was rejected - revising technical specifications and scope',
                pending: 'Waiting to start planning phase'
            },
            expert: {
                complete: 'Approved plan after rigorous technical validation',
                working: 'Critically reviewing plan for technical accuracy and feasibility',
                rejected: 'Found critical flaws in plan - demanding better specifications',
                pending: 'Standing by to evaluate submitted plan'
            },
            executor: {
                complete: 'Successfully executed plan and delivered concrete evidence',
                working: 'Implementing approved plan using specified tools and methods',
                rejected: 'Execution failed validation - needs to improve implementation',
                pending: 'Ready to execute once plan is approved'
            },
            validator: {
                complete: 'Confirmed all work meets quality standards with strong proof',
                working: 'Validating execution results against approved plan requirements',
                rejected: 'Found issues with execution - requiring fixes before approval',
                pending: 'Prepared to validate final execution results'
            }
        };
        return descriptions[key]?.[status] || descriptions[key]?.pending || 'Processing...';
    };

    const getAgentDetails = (key, status) => {
        if (status === 'complete') {
            return {
                planner: 'Plan passed Expert validation with concrete deliverables and success metrics',
                expert: 'Technical review completed - plan approved for implementation',
                executor: 'All planned tasks completed with verifiable evidence collected',
                validator: 'Final validation passed - all requirements satisfied with proof'
            }[key];
        } else if (status === 'rejected') {
            return {
                planner: 'Must address Expert feedback on technical specifications and scope',
                expert: 'Rejected plan due to insufficient detail or technical issues',
                executor: 'Implementation didn\'t match approved plan or lacked evidence',
                validator: 'Proof validation failed - execution quality below standards'
            }[key];
        } else {
            return {
                planner: 'Analyzing requirements and designing technical implementation approach',
                expert: 'Applying rigorous validation criteria to ensure plan quality',
                executor: 'Following approved methodology to build and test solution',
                validator: 'Checking execution against plan requirements and evidence standards'
            }[key];
        }
    };

    const agents = [
        { 
            key: 'planner', 
            name: 'Task Planner', 
            emoji: '🧠', 
            description: getAgentDescription('planner', agentProcess?.planner?.status),
            details: getAgentDetails('planner', agentProcess?.planner?.status)
        },
        { 
            key: 'expert', 
            name: 'Expert Reviewer', 
            emoji: '🕵️', 
            description: getAgentDescription('expert', agentProcess?.expert?.status),
            details: getAgentDetails('expert', agentProcess?.expert?.status)
        },
        { 
            key: 'executor', 
            name: 'Task Executor', 
            emoji: '⚡', 
            description: getAgentDescription('executor', agentProcess?.executor?.status),
            details: getAgentDetails('executor', agentProcess?.executor?.status)
        },
        { 
            key: 'validator', 
            name: 'Proof Validator', 
            emoji: '✅', 
            description: getAgentDescription('validator', agentProcess?.validator?.status),
            details: getAgentDetails('validator', agentProcess?.validator?.status)
        }
    ];
    
    return agents.map(agent => {
        const status = agentProcess[agent.key] || { status: 'pending', activity: 'Not started' };
        const statusClass = status.status === 'complete' ? 'status-complete' : 
                          status.status === 'working' ? 'status-working' : 
                          status.status === 'rejected' ? 'status-rejected' : '';
        
        return `
            <div class="agent-status">
                <div class="agent-avatar agent-${agent.key}">${agent.emoji}</div>
                <div class="agent-details">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-activity">${agent.description}</div>
                    <div class="agent-details-text">${agent.details}</div>
                </div>
                <div class="agent-status-icon ${statusClass}"></div>
            </div>
        `;
    }).join('');
}

function toggleProcessDetails(processId) {
    const details = document.getElementById(processId);
    const arrow = document.getElementById(processId + '_arrow');
    
    if (details.classList.contains('expanded')) {
        details.classList.remove('expanded');
        arrow.textContent = '▼';
    } else {
        details.classList.add('expanded');
        arrow.textContent = '▲';
    }
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
        // Also ensure smooth scrolling behavior
        messagesContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !connected) return;
    
    // Clear commentary deduplication for new conversation
    shownCommentaryIds.clear();
    
    addUserMessage(message);
    showTyping('Initializing AI validation system...');
    
    window.electronAPI.sendToClaude(message);
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

// Make toggleProcessDetails available globally
window.toggleProcessDetails = toggleProcessDetails;

function setupTitleBarControls() {
    console.log('[RENDERER] Setting up title bar controls');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');
    
    console.log('[RENDERER] Found buttons:', { minimizeBtn, maximizeBtn, closeBtn });

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            console.log('[RENDERER] Minimize clicked');
            window.electronAPI.minimizeWindow();
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            console.log('[RENDERER] Maximize clicked');
            window.electronAPI.maximizeWindow();
        });
    }

    if (closeBtn) {
        console.log('[RENDERER] Adding close button listener');
        closeBtn.addEventListener('click', () => {
            console.log('[RENDERER] Close button clicked - sending close signal');
            window.electronAPI.closeWindow();
        });
    } else {
        console.error('[RENDERER] Close button not found!');
    }
}

// DRAGON ORCHESTRATOR FUNCTIONS 🐉
function handleDragonInsights(insights, timestamp) {
    console.log('[RENDERER] 🐉 Dragon insights received:', insights);
    
    // Create mystical dragon message
    const dragonMessage = createMessage('dragon', insights, 'received');
    dragonMessage.classList.add('dragon-orchestrator-message');
    
    // Add dragon styling based on mood
    if (insights.mood) {
        dragonMessage.classList.add(`dragon-mood-${insights.mood}`);
    }
    
    // Show screenshot analysis if available
    if (insights.screenshotAnalysis) {
        const analysisElement = document.createElement('div');
        analysisElement.className = 'dragon-screenshot-analysis';
        analysisElement.innerHTML = `
            <div class="analysis-header">🐉 Dragon Vision Analysis</div>
            <div class="analysis-content">${formatContent(insights.screenshotAnalysis)}</div>
        `;
        dragonMessage.appendChild(analysisElement);
    }
    
    // Show orchestration guidance
    if (insights.orchestrationGuidance) {
        const guidanceElement = document.createElement('div');
        guidanceElement.className = 'dragon-orchestration-guidance';
        guidanceElement.innerHTML = `
            <div class="guidance-header">🌟 Dragon Guidance</div>
            <div class="guidance-content">${formatContent(insights.orchestrationGuidance)}</div>
        `;
        dragonMessage.appendChild(guidanceElement);
    }
    
    messagesContainer.appendChild(dragonMessage);
    scrollToBottom();
}

function handleDragonError(error) {
    console.error('[RENDERER] 🐉 Dragon error:', error);
    
    const errorMessage = createMessage('dragon', `🐲 Dragon encountered turbulence: ${error}`, 'error');
    errorMessage.classList.add('dragon-error-message');
    
    messagesContainer.appendChild(errorMessage);
    scrollToBottom();
}

// Dragon orchestrator integration with visualizer
function triggerDragonOrchestration() {
    console.log('[RENDERER] 🐉 Triggering dragon orchestration...');
    
    // Take screenshot and send to dragon
    window.electronAPI.dragonTakeScreenshot().then((screenshotData) => {
        if (screenshotData && !screenshotData.error) {
            console.log('[RENDERER] 🐉 Screenshot captured, sending to dragon for analysis');
            
            // Send to dragon orchestrator for analysis
            window.electronAPI.dragonOrchestrate({
                type: 'screenshot-analysis',
                screenshot: screenshotData,
                context: 'User interface analysis and experience optimization',
                timestamp: Date.now()
            });
        } else {
            console.error('[RENDERER] 🐉 Screenshot failed:', screenshotData?.error);
        }
    }).catch(error => {
        console.error('[RENDERER] 🐉 Dragon screenshot error:', error);
    });
}

// Auto-trigger dragon orchestration on meaningful events
function setupDragonOrchestration() {
    // Trigger when final responses are received
    const originalHandleFinalResponse = window.handleFinalResponse;
    if (typeof originalHandleFinalResponse === 'function') {
        window.handleFinalResponse = function(content) {
            originalHandleFinalResponse.call(this, content);
            
            // Give the UI time to update, then let the dragon analyze
            setTimeout(() => {
                triggerDragonOrchestration();
            }, 2000);
        };
    }
}

// Initialize systems on DOM load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[RENDERER] DOMContentLoaded - initializing systems');
    setupTitleBarControls();
    setupDragonOrchestration();
    
    // Add keyboard shortcut to close app (Ctrl+Q or Alt+F4)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'q') || (e.altKey && e.key === 'F4')) {
            window.electronAPI.closeWindow();
        }
    });
    
    console.log('[RENDERER] 🐉 Dragon orchestration system initialized');
});