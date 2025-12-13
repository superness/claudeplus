/**
 * Pipeline Bridge - Connects AI Game Studio to the proxy server
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PROXY_URL = 'ws://localhost:8081';
const TEMPLATES_DIR = path.join(__dirname, '../../templates');

class PipelineBridge {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.eventCallbacks = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('[PipelineBridge] Connecting to proxy server...');

      this.ws = new WebSocket(PROXY_URL);

      this.ws.on('open', () => {
        console.log('[PipelineBridge] Connected to proxy server');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (err) {
          console.error('[PipelineBridge] Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('[PipelineBridge] Disconnected from proxy');
        this.connected = false;
        this.attemptReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[PipelineBridge] WebSocket error:', err.message);
        if (!this.connected) {
          reject(err);
        }
      });
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[PipelineBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect().catch(() => {}), delay);
    }
  }

  handleMessage(msg) {
    // Notify all event callbacks
    this.eventCallbacks.forEach(cb => {
      try {
        cb(msg);
      } catch (err) {
        console.error('[PipelineBridge] Event callback error:', err);
      }
    });

    // Handle specific message types
    const handler = this.messageHandlers.get(msg.pipelineId || msg.type);
    if (handler) {
      handler(msg);
    }
  }

  onEvent(callback) {
    this.eventCallbacks.push(callback);
    return () => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx > -1) this.eventCallbacks.splice(idx, 1);
    };
  }

  loadTemplate(templateName) {
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.json`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  }

  async executeDesignPipeline(projectId, gameIdea, workingDir) {
    if (!this.connected) {
      await this.connect();
    }

    const template = this.loadTemplate('living-game-world-v1');
    const pipelineId = `design_${projectId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      // Set up handler for this pipeline
      this.messageHandlers.set(pipelineId, (msg) => {
        if (msg.type === 'pipeline-completed') {
          this.messageHandlers.delete(pipelineId);
          resolve({ success: true, pipelineId });
        } else if (msg.type === 'pipeline-error') {
          this.messageHandlers.delete(pipelineId);
          reject(new Error(msg.error || 'Pipeline failed'));
        }
      });

      // Send pipeline execution request
      this.ws.send(JSON.stringify({
        type: 'execute-pipeline',
        pipelineId,
        pipeline: template,
        userContext: `Create a game based on this idea:\n\n${gameIdea}`,
        workingDirectory: workingDir
      }));
    });
  }

  async executeFeaturePipeline(projectId, featureRequest, workingDir) {
    if (!this.connected) {
      await this.connect();
    }

    const template = this.loadTemplate('game-feature-implementer-v2');
    const pipelineId = `feature_${projectId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      this.messageHandlers.set(pipelineId, (msg) => {
        if (msg.type === 'pipeline-completed') {
          this.messageHandlers.delete(pipelineId);
          resolve({ success: true, pipelineId });
        } else if (msg.type === 'pipeline-error') {
          this.messageHandlers.delete(pipelineId);
          reject(new Error(msg.error || 'Pipeline failed'));
        }
      });

      this.ws.send(JSON.stringify({
        type: 'execute-pipeline',
        pipelineId,
        pipeline: template,
        userContext: featureRequest,
        workingDirectory: workingDir
      }));
    });
  }

  send(message) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }

  isConnected() {
    return this.connected;
  }

  /**
   * Resume a previously interrupted pipeline
   */
  async resumePipeline(pipelineId) {
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      // Set up handler for resume response
      const resumeHandler = (msg) => {
        if (msg.type === 'pipeline-resumed') {
          console.log(`[PipelineBridge] Pipeline resumed: ${pipelineId}`);
          resolve(msg);
        } else if (msg.type === 'resume-error') {
          this.messageHandlers.delete(pipelineId);
          reject(new Error(msg.error || 'Resume failed'));
        } else if (msg.type === 'pipeline-completed') {
          this.messageHandlers.delete(pipelineId);
          resolve({ completed: true, ...msg });
        } else if (msg.type === 'pipeline-error') {
          this.messageHandlers.delete(pipelineId);
          reject(new Error(msg.error || 'Pipeline failed'));
        }
      };

      this.messageHandlers.set(pipelineId, resumeHandler);

      // Send resume request
      this.ws.send(JSON.stringify({
        type: 'resume-pipeline',
        pipelineId
      }));
    });
  }

  /**
   * Check if there's a running pipeline and get its status
   */
  async checkRunningPipeline() {
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.type === 'pipeline-reconnect') {
          resolve(msg.content);
        } else if (msg.type === 'no-running-pipeline') {
          resolve(null);
        }
      };

      // Temporary handler
      this.eventCallbacks.push(handler);
      setTimeout(() => {
        const idx = this.eventCallbacks.indexOf(handler);
        if (idx > -1) this.eventCallbacks.splice(idx, 1);
        resolve(null); // Timeout - no response
      }, 5000);

      this.ws.send(JSON.stringify({
        type: 'check-running-pipeline'
      }));
    });
  }
}

module.exports = new PipelineBridge();
