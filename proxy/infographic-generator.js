const fs = require('fs');
const path = require('path');

/**
 * Generates rich HTML infographic summaries from pipeline execution events
 * Designed for real-time visual review of the development process
 */
class InfographicGenerator {
  constructor(pipelineId, pipelineName, outputDir = 'pipeline-infographics') {
    this.pipelineId = pipelineId;
    this.pipelineName = pipelineName;
    this.outputDir = path.join(__dirname, outputDir);

    // Create timestamped run directory
    this.runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // e.g., 2025-01-16T14-30-22
    this.runDir = path.join(this.outputDir, pipelineId, `run_${this.runTimestamp}`);
    this.infographicPath = path.join(this.runDir, 'infographic.html');

    // Create subdirectories for media
    this.imagesDir = path.join(this.runDir, 'images');
    this.dataDir = path.join(this.runDir, 'data');
    this.outputsDir = path.join(this.runDir, 'agent-outputs');

    // Execution data accumulator
    this.stages = [];
    this.currentStage = null;
    this.startTime = Date.now();
    this.errors = [];
    this.completedCount = 0;

    this.ensureOutputDirectory();
    this.initializeInfographic();
  }

  ensureOutputDirectory() {
    // Create all directories
    [this.runDir, this.imagesDir, this.dataDir, this.outputsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Process a pipeline event and update the infographic
   */
  processEvent(event) {
    switch (event.eventType) {
      case 'pipeline_initialized':
        this.handlePipelineInit(event);
        break;
      case 'stage_started':
        this.handleStageStart(event);
        break;
      case 'stage_completed':
        this.handleStageComplete(event);
        break;
      case 'stage_error':
        this.handleStageError(event);
        break;
      case 'stage_routed':
        this.handleStageRoute(event);
        break;
      case 'pipeline_completed':
        this.handlePipelineComplete(event);
        break;
    }

    this.updateInfographic();
  }

  handlePipelineInit(event) {
    this.startTime = new Date(event.timestamp).getTime();
  }

  handleStageStart(event) {
    this.currentStage = {
      id: event.stageId,
      name: event.stageName,
      agent: event.agent,
      type: event.stageType,
      description: event.description,
      startTime: event.timestamp,
      status: 'running',
      executionNumber: event.executionNumber
    };
    this.stages.push(this.currentStage);
  }

  handleStageComplete(event) {
    if (this.currentStage && this.currentStage.id === event.stageId) {
      this.currentStage.status = 'completed';
      this.currentStage.endTime = event.timestamp;
      this.currentStage.output = event.output;
      this.currentStage.outputLength = event.outputLength;
      this.currentStage.prompt = event.prompt;  // Capture agent prompt
      this.currentStage.promptLength = event.promptLength;
      this.currentStage.duration = new Date(event.timestamp).getTime() - new Date(this.currentStage.startTime).getTime();
      this.completedCount++;

      // Save full agent output to file
      if (event.output) {
        const outputFile = path.join(this.outputsDir, `${event.stageId}_${this.currentStage.executionNumber || 1}_output.txt`);
        fs.writeFileSync(outputFile, event.output);
        this.currentStage.outputFile = outputFile;
      }

      // Save full agent prompt to file
      if (event.prompt) {
        const promptFile = path.join(this.outputsDir, `${event.stageId}_${this.currentStage.executionNumber || 1}_prompt.txt`);
        fs.writeFileSync(promptFile, event.prompt);
        this.currentStage.promptFile = promptFile;
      }
    }
  }

  handleStageError(event) {
    if (this.currentStage && this.currentStage.id === event.stageId) {
      this.currentStage.status = 'error';
      this.currentStage.endTime = event.timestamp;
      this.currentStage.error = event.error;
      this.currentStage.stack = event.stack;
      this.currentStage.duration = new Date(event.timestamp).getTime() - new Date(this.currentStage.startTime).getTime();
    }
    this.errors.push({
      stage: event.stageId,
      error: event.error,
      stack: event.stack,
      timestamp: event.timestamp
    });
  }

  handleStageRoute(event) {
    // Add routing info to current stage
    if (this.currentStage) {
      this.currentStage.routedTo = event.toStage;
      this.currentStage.routingDecision = event.decision;
      this.currentStage.routingReason = event.reasoning;
    }
  }

  handlePipelineComplete(event) {
    this.endTime = new Date(event.timestamp).getTime();
    this.totalDuration = event.duration;
    this.finalResults = event.finalResults;
    this.generateAISummary();
  }

  /**
   * Generate AI-powered executive summary of the pipeline execution
   */
  generateAISummary() {
    // Collect key metrics and events
    const summary = {
      pipelineName: this.pipelineName,
      totalStages: this.stages.length,
      completedStages: this.completedCount,
      errorCount: this.errors.length,
      totalDuration: this.totalDuration || (Date.now() - this.startTime),
      stages: this.stages.map(s => ({
        name: s.name,
        agent: s.agent,
        status: s.status,
        duration: s.duration,
        outputLength: s.outputLength,
        promptLength: s.promptLength,
        routingDecision: s.routingDecision,
        error: s.error
      }))
    };

    // Generate narrative summary
    const narrativeParts = [];

    narrativeParts.push(`This ${this.pipelineName} pipeline execution processed ${this.stages.length} stages over ${(summary.totalDuration / 1000).toFixed(1)} seconds.`);

    if (this.stages.length > 0) {
      const firstStage = this.stages[0];
      narrativeParts.push(`The pipeline began with ${firstStage.name} using the ${firstStage.agent} agent.`);
    }

    const routingStages = this.stages.filter(s => s.routingDecision);
    if (routingStages.length > 0) {
      narrativeParts.push(`${routingStages.length} routing decision${routingStages.length > 1 ? 's were' : ' was'} made during execution, directing the workflow through different stages based on agent outputs.`);
    }

    if (this.errors.length > 0) {
      narrativeParts.push(`⚠️ ${this.errors.length} error${this.errors.length > 1 ? 's' : ''} occurred during execution, requiring intervention or retry.`);
    } else {
      narrativeParts.push(`✅ All stages completed successfully with no errors.`);
    }

    const totalOutput = this.stages.reduce((sum, s) => sum + (s.outputLength || 0), 0);
    const totalPrompt = this.stages.reduce((sum, s) => sum + (s.promptLength || 0), 0);
    narrativeParts.push(`Agents produced ${totalOutput.toLocaleString()} characters of output in response to ${totalPrompt.toLocaleString()} characters of prompts.`);

    this.aiSummary = {
      narrative: narrativeParts.join(' '),
      metrics: summary
    };

    // Save summary to file
    const summaryPath = path.join(this.dataDir, 'ai-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(this.aiSummary, null, 2));
  }

  initializeInfographic() {
    const html = this.generateHTML();
    fs.writeFileSync(this.infographicPath, html);
  }

  updateInfographic() {
    const html = this.generateHTML();
    fs.writeFileSync(this.infographicPath, html);
  }

  generateHTML() {
    const elapsed = this.endTime ? this.totalDuration : Date.now() - this.startTime;
    const elapsedSeconds = (elapsed / 1000).toFixed(1);
    const aiSummaryHTML = this.aiSummary ? `
    <div class="ai-summary">
      <h2>📊 AI-Generated Executive Summary</h2>
      <div class="summary-narrative">
        ${this.escapeHtml(this.aiSummary.narrative)}
      </div>
    </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- NO meta refresh - viewer handles refreshing via iframe reload to preserve toggle state -->
  <title>Pipeline: ${this.escapeHtml(this.pipelineName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .metric {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .metric-label {
      font-size: 0.85em;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 1.8em;
      font-weight: bold;
      color: #333;
      margin-top: 5px;
    }
    .timeline {
      position: relative;
      padding-left: 40px;
      margin-top: 20px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    }
    .stage {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      position: relative;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .stage:hover {
      transform: translateX(5px);
    }
    .stage::before {
      content: '';
      position: absolute;
      left: -28px;
      top: 30px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 2px #667eea;
    }
    .stage.running::before { background: #ffc107; box-shadow: 0 0 0 2px #ffc107, 0 0 20px #ffc107; }
    .stage.completed::before { background: #28a745; box-shadow: 0 0 0 2px #28a745; }
    .stage.error::before { background: #dc3545; box-shadow: 0 0 0 2px #dc3545; }
    .stage-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }
    .stage-title {
      font-size: 1.4em;
      font-weight: bold;
      color: #333;
    }
    .stage-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-running { background: #fff3cd; color: #856404; }
    .badge-completed { background: #d4edda; color: #155724; }
    .badge-error { background: #f8d7da; color: #721c24; }
    .stage-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 15px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .meta-item {
      font-size: 0.9em;
    }
    .meta-label {
      color: #6c757d;
      font-weight: 500;
    }
    .meta-value {
      color: #333;
      font-weight: bold;
      margin-left: 5px;
    }
    .stage-output {
      margin-top: 15px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      max-height: 500px;
      overflow-y: auto;
    }
    .stage-output pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
      line-height: 1.6;
      color: #333;
    }
    .error-box {
      background: #fff5f5;
      border: 2px solid #fc8181;
      border-radius: 8px;
      padding: 20px;
      margin-top: 15px;
    }
    .error-title {
      color: #c53030;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .error-stack {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.85em;
      color: #742a2a;
      background: white;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
    }
    .routing-info {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin-top: 15px;
      border-radius: 6px;
    }
    .routing-decision {
      font-weight: bold;
      color: #1976D2;
      margin-bottom: 5px;
    }
    .completion-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .completion-banner h2 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .running-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #ffc107;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 1.5s infinite;
    }
    .ai-summary {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      border-left: 6px solid #667eea;
    }
    .ai-summary h2 {
      font-size: 1.8em;
      margin-bottom: 15px;
      color: #333;
    }
    .summary-narrative {
      font-size: 1.1em;
      line-height: 1.8;
      color: #555;
    }
    .collapsible {
      cursor: pointer;
      padding: 12px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      margin: 10px 0;
      font-weight: bold;
      color: #495057;
      transition: background 0.2s;
    }
    .collapsible:hover {
      background: #e9ecef;
    }
    .collapsible::before {
      content: '▶ ';
      display: inline-block;
      transition: transform 0.2s;
    }
    .collapsible.active::before {
      transform: rotate(90deg);
    }
    .collapsible-content {
      display: none;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      margin-top: 5px;
      border-left: 4px solid #667eea;
    }
    .collapsible-content.active {
      display: block;
    }
    .prompt-section {
      background: #fff5e6;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
    }
    .output-section {
      background: #e8f5e9;
      border-left: 4px solid #4caf50;
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
    }
    .section-label {
      font-weight: bold;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      color: #555;
    }
    .char-count {
      font-size: 0.85em;
      color: #6c757d;
      font-style: italic;
    }
    pre.code-content {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.85em;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 15px;
      border-radius: 6px;
      max-height: none;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    ${this.endTime ? `
    <div class="completion-banner">
      <h2>✅ Pipeline Completed Successfully</h2>
      <p>Total execution time: ${elapsedSeconds}s</p>
    </div>
    ` : ''}

    ${aiSummaryHTML}

    <div class="header">
      <h1>${this.endTime ? '' : '<span class="running-indicator"></span>'}${this.escapeHtml(this.pipelineName)}</h1>
      <p style="color: #6c757d; font-size: 1.1em; margin-top: 5px;">Pipeline ID: ${this.escapeHtml(this.pipelineId)}</p>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Elapsed Time</div>
          <div class="metric-value">${elapsedSeconds}s</div>
        </div>
        <div class="metric">
          <div class="metric-label">Stages Completed</div>
          <div class="metric-value">${this.completedCount}/${this.stages.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Errors</div>
          <div class="metric-value" style="color: ${this.errors.length > 0 ? '#dc3545' : '#28a745'}">${this.errors.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Status</div>
          <div class="metric-value" style="font-size: 1.2em;">${this.endTime ? '✅ Complete' : '⚡ Running'}</div>
        </div>
      </div>
    </div>

    <div class="timeline">
      ${this.stages.map(stage => this.renderStage(stage)).join('\n')}
    </div>

    ${this.errors.length > 0 ? `
    <div style="background: white; border-radius: 12px; padding: 25px; margin-top: 20px;">
      <h2 style="color: #dc3545; margin-bottom: 15px;">⚠️ Errors Summary</h2>
      ${this.errors.map(err => `
        <div class="error-box">
          <div class="error-title">Stage: ${this.escapeHtml(err.stage)}</div>
          <div>${this.escapeHtml(err.error)}</div>
          ${err.stack ? `<pre class="error-stack">${this.escapeHtml(err.stack)}</pre>` : ''}
        </div>
      `).join('\n')}
    </div>
    ` : ''}
  </div>

  <script>
    // Interactive collapsible sections
    document.addEventListener('DOMContentLoaded', function() {
      const collapsibles = document.querySelectorAll('.collapsible');

      collapsibles.forEach(button => {
        button.addEventListener('click', function() {
          this.classList.toggle('active');
          const targetId = this.getAttribute('data-target');
          const content = document.getElementById(targetId);

          if (content) {
            content.classList.toggle('active');
          }
        });
      });

      // Add "Expand All" / "Collapse All" buttons
      const header = document.querySelector('.header');
      if (header && collapsibles.length > 0) {
        const controlsDiv = document.createElement('div');
        controlsDiv.style.marginTop = '20px';

        const collapseAllBtn = document.createElement('button');
        collapseAllBtn.textContent = 'Collapse All Sections';
        collapseAllBtn.style.cssText = 'padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: bold;';
        collapseAllBtn.addEventListener('click', function() {
          collapsibles.forEach(btn => {
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const content = document.getElementById(targetId);
            if (content) content.classList.add('active');
          });
        });

        const expandAllBtn = document.createElement('button');
        expandAllBtn.textContent = 'Expand All Sections';
        expandAllBtn.style.cssText = 'padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
        expandAllBtn.addEventListener('click', function() {
          collapsibles.forEach(btn => {
            btn.classList.remove('active');
            const targetId = btn.getAttribute('data-target');
            const content = document.getElementById(targetId);
            if (content) content.classList.remove('active');
          });
        });

        controlsDiv.appendChild(collapseAllBtn);
        controlsDiv.appendChild(expandAllBtn);
        header.appendChild(controlsDiv);
      }
    });
  </script>
</body>
</html>`;
  }

  renderStage(stage) {
    const duration = stage.duration ? `${(stage.duration / 1000).toFixed(1)}s` : 'In progress...';
    const statusClass = stage.status || 'pending';
    const badgeClass = `badge-${statusClass}`;
    const stageId = stage.id.replace(/[^a-zA-Z0-9]/g, '_');

    return `
    <div class="stage ${statusClass}">
      <div class="stage-header">
        <div>
          <div class="stage-title">${this.escapeHtml(stage.name)}</div>
          <div style="color: #6c757d; font-size: 0.9em; margin-top: 5px;">${this.escapeHtml(stage.description || '')}</div>
        </div>
        <span class="stage-badge ${badgeClass}">${statusClass}</span>
      </div>

      <div class="stage-meta">
        <div class="meta-item">
          <span class="meta-label">Agent:</span>
          <span class="meta-value">${this.escapeHtml(stage.agent)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Type:</span>
          <span class="meta-value">${this.escapeHtml(stage.type)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Duration:</span>
          <span class="meta-value">${duration}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Execution #:</span>
          <span class="meta-value">${stage.executionNumber || 1}</span>
        </div>
        ${stage.promptLength ? `
        <div class="meta-item">
          <span class="meta-label">Prompt Size:</span>
          <span class="meta-value">${stage.promptLength.toLocaleString()} chars</span>
        </div>
        ` : ''}
        ${stage.outputLength ? `
        <div class="meta-item">
          <span class="meta-label">Output Size:</span>
          <span class="meta-value">${stage.outputLength.toLocaleString()} chars</span>
        </div>
        ` : ''}
      </div>

      ${stage.prompt ? `
      <div class="prompt-section">
        <div class="section-label">📥 AGENT PROMPT <span class="char-count">(${(stage.promptLength || stage.prompt.length || 0).toLocaleString()} characters)</span></div>
        <button class="collapsible" data-target="prompt_${stageId}_${stage.executionNumber || 1}">Click to expand prompt from ${this.escapeHtml(stage.agent)}</button>
        <div class="collapsible-content" id="prompt_${stageId}_${stage.executionNumber || 1}">
          <pre class="code-content">${this.escapeHtml(stage.prompt)}</pre>
        </div>
      </div>
      ` : ''}

      ${stage.output ? `
      <div class="output-section">
        <div class="section-label">📤 AGENT OUTPUT <span class="char-count">(${(stage.outputLength || stage.output.length || 0).toLocaleString()} characters)</span></div>
        <button class="collapsible" data-target="output_${stageId}_${stage.executionNumber || 1}">Click to expand output from ${this.escapeHtml(stage.agent)}</button>
        <div class="collapsible-content" id="output_${stageId}_${stage.executionNumber || 1}">
          <pre class="code-content">${this.escapeHtml(stage.output)}</pre>
        </div>
      </div>
      ` : ''}

      ${stage.error ? `
      <div class="error-box">
        <div class="error-title">❌ Error</div>
        <div>${this.escapeHtml(stage.error)}</div>
        ${stage.stack ? `<pre class="error-stack">${this.escapeHtml(stage.stack)}</pre>` : ''}
      </div>
      ` : ''}

      ${stage.routingDecision ? `
      <div class="routing-info">
        <div class="routing-decision">🔀 Routing Decision: ${this.escapeHtml(stage.routingDecision)}</div>
        <div style="font-size: 0.9em; color: #555; margin-top: 5px;">${this.escapeHtml(stage.routingReason || '')}</div>
        ${stage.routedTo ? `<div style="margin-top: 10px; font-weight: bold;">→ Next Stage: <strong>${this.escapeHtml(stage.routedTo)}</strong></div>` : '<div style="margin-top: 10px; font-weight: bold;">→ Pipeline Complete</div>'}
      </div>
      ` : ''}
    </div>`;
  }

  truncateOutput(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '\n... [truncated]';
  }

  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getInfographicPath() {
    return this.infographicPath;
  }

  getRunDirectory() {
    return this.runDir;
  }

  getRunTimestamp() {
    return this.runTimestamp;
  }

  /**
   * Generate an index page listing all runs for this pipeline
   */
  static generatePipelineIndex(pipelineId, outputDir = 'pipeline-infographics') {
    const pipelineDir = path.join(__dirname, outputDir, pipelineId);

    if (!fs.existsSync(pipelineDir)) {
      return null;
    }

    // Get all run directories
    const runs = fs.readdirSync(pipelineDir)
      .filter(name => name.startsWith('run_'))
      .map(runDir => {
        const runPath = path.join(pipelineDir, runDir);
        const infographicPath = path.join(runPath, 'infographic.html');
        const stats = fs.statSync(runPath);

        return {
          name: runDir,
          timestamp: runDir.replace('run_', ''),
          path: infographicPath,
          modified: stats.mtime,
          exists: fs.existsSync(infographicPath)
        };
      })
      .filter(run => run.exists)
      .sort((a, b) => b.modified - a.modified); // Most recent first

    const indexPath = path.join(pipelineDir, 'index.html');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pipeline Runs: ${pipelineId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .run-list {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .run-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e9ecef;
      transition: background 0.2s;
    }
    .run-item:hover {
      background: #f8f9fa;
    }
    .run-item:last-child {
      border-bottom: none;
    }
    .run-info h3 {
      font-size: 1.2em;
      margin-bottom: 5px;
      color: #333;
    }
    .run-info p {
      color: #6c757d;
      font-size: 0.9em;
    }
    .run-link {
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      transition: transform 0.2s;
    }
    .run-link:hover {
      transform: translateY(-2px);
    }
    .metric {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      display: inline-block;
      margin-right: 10px;
      border-left: 4px solid #667eea;
    }
    .metric-label {
      font-size: 0.85em;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #333;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Pipeline Runs</h1>
      <p style="color: #6c757d; font-size: 1.1em; margin-top: 5px;">Pipeline: ${pipelineId}</p>
      <div style="margin-top: 20px;">
        <div class="metric">
          <div class="metric-label">Total Runs</div>
          <div class="metric-value">${runs.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Latest Run</div>
          <div class="metric-value" style="font-size: 0.9em;">${runs.length > 0 && runs[0].modified ? runs[0].modified.toLocaleString() : 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="run-list">
      <h2 style="margin-bottom: 20px; color: #333;">Execution History</h2>
      ${runs.map((run, index) => `
        <div class="run-item">
          <div class="run-info">
            <h3>${index === 0 ? '🟢 ' : ''}Run ${runs.length - index}</h3>
            <p><strong>Timestamp:</strong> ${run.timestamp.replace('T', ' ')}</p>
            <p><strong>Modified:</strong> ${run.modified ? run.modified.toLocaleString() : 'N/A'}</p>
          </div>
          <a href="${run.name}/infographic.html" class="run-link">View Report →</a>
        </div>
      `).join('\n')}
      ${runs.length === 0 ? '<p style="color: #6c757d; text-align: center;">No runs found</p>' : ''}
    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(indexPath, html);
    return indexPath;
  }
}

module.exports = InfographicGenerator;
