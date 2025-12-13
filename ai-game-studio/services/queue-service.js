/**
 * Queue Service - Manages work queue for AI Game Studio
 * Ensures work is processed sequentially without interruption
 * Supports resuming interrupted pipelines
 */

const db = require('./db');
const pipelineBridge = require('./pipeline-bridge');
const path = require('path');
const fs = require('fs');

const GAMES_DIR = path.join(__dirname, '../games');
const PROXY_PIPELINES_DIR = path.join(__dirname, '../../proxy/pipelines');
const PROXY_STATES_DIR = path.join(__dirname, '../../proxy/pipeline-states');

// Track active pipelines for progress polling
const activePipelines = new Map(); // projectId -> { pipelineId, interval }

class QueueService {
  constructor() {
    this.processingProjects = new Set(); // Projects currently being processed
    this.eventCallbacks = [];
    this.pipelineProjectMap = new Map(); // pipelineId -> projectId
  }

  /**
   * Check for and resume any incomplete pipelines on startup
   */
  async checkAndResumeIncomplete() {
    console.log('[QueueService] Checking for incomplete pipelines...');

    try {
      // Check proxy's current.json for a running pipeline
      const currentStatePath = path.join(PROXY_STATES_DIR, 'current.json');
      if (fs.existsSync(currentStatePath)) {
        const currentState = JSON.parse(fs.readFileSync(currentStatePath, 'utf8'));

        if (currentState.status === 'running' || currentState.status === 'paused') {
          // Check if we're already processing this pipeline
          const projectMatch = currentState.workingDir?.match(/proj_([a-f0-9]+)/);
          if (projectMatch) {
            const projectId = 'proj_' + projectMatch[1];
            if (this.processingProjects.has(projectId)) {
              console.log(`[QueueService] Pipeline ${currentState.id} is already being processed`);
              return { found: false, reason: 'already_processing' };
            }
          }

          console.log(`[QueueService] Found incomplete pipeline: ${currentState.id}`);
          console.log(`[QueueService]   Name: ${currentState.name}`);
          console.log(`[QueueService]   Stage: ${currentState.currentStage} (${currentState.completedStages?.length || 0}/${currentState.stages?.length || 0})`);
          console.log(`[QueueService]   Working Dir: ${currentState.workingDir}`);

          // Try to match this to a project
          const projectMatch = currentState.workingDir?.match(/proj_([a-f0-9]+)/);
          if (projectMatch) {
            const projectId = 'proj_' + projectMatch[1];
            const project = db.getProject(projectId);

            if (project) {
              console.log(`[QueueService] Matched to project: ${project.name} (${projectId})`);

              // Store mapping
              this.pipelineProjectMap.set(currentState.id, projectId);

              // Update project's pipeline ID if not set
              if (!project.design_pipeline_id) {
                db.setDesignPipelineId(projectId, currentState.id);
              }

              return {
                found: true,
                pipelineId: currentState.id,
                projectId: projectId,
                project: project,
                state: currentState
              };
            }
          }

          return {
            found: true,
            pipelineId: currentState.id,
            projectId: null,
            project: null,
            state: currentState
          };
        }
      }

      console.log('[QueueService] No incomplete pipelines found');
      return { found: false };

    } catch (err) {
      console.error('[QueueService] Error checking incomplete pipelines:', err);
      return { found: false, error: err.message };
    }
  }

  /**
   * Resume an incomplete pipeline
   */
  async resumeIncomplete(pipelineId, projectId) {
    console.log(`[QueueService] Resuming pipeline ${pipelineId} for project ${projectId}`);

    if (projectId) {
      this.processingProjects.add(projectId);
      this.pipelineProjectMap.set(pipelineId, projectId);

      // Start progress polling
      this.startProgressPolling(projectId, 'design');
    }

    try {
      this.emit('design-started', { projectId, resumed: true, pipelineId });

      const result = await pipelineBridge.resumePipeline(pipelineId);

      if (projectId) {
        this.stopProgressPolling(projectId);

        if (result.completed) {
          db.updateProjectStatus(projectId, 'implementing', pipelineId);
          this.emit('design-completed', { projectId, pipelineId });

          // Auto-start first feature implementation
          await this.processNextInQueue(projectId);
        }
      }

      return result;

    } catch (err) {
      console.error(`[QueueService] Resume failed:`, err);

      if (projectId) {
        this.stopProgressPolling(projectId);
        this.emit('design-failed', { projectId, error: err.message });
        this.processingProjects.delete(projectId);
      }

      throw err;
    }
  }

  /**
   * Get or create the working directory for a project
   */
  getProjectDir(userId, projectId) {
    const projectDir = path.join(GAMES_DIR, userId, projectId);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      // Create subdirectories
      fs.mkdirSync(path.join(projectDir, 'design-docs'), { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
    }
    return projectDir;
  }

  /**
   * Find the latest pipeline execution log
   */
  findLatestPipelineLog() {
    try {
      const files = fs.readdirSync(PROXY_PIPELINES_DIR)
        .filter(f => f.endsWith('_execution.json'))
        .map(f => ({
          name: f,
          path: path.join(PROXY_PIPELINES_DIR, f),
          mtime: fs.statSync(path.join(PROXY_PIPELINES_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return files[0]?.path || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Parse pipeline log for progress
   */
  parsePipelineProgress(logPath) {
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const data = JSON.parse(content);
      const events = data.events || [];

      // Find latest stage info
      let currentStage = null;
      let completedCount = 0;
      let totalStages = 24; // Default for living-game-world

      for (const event of events) {
        if (event.eventType === 'pipeline_initialized' && event.totalStages) {
          totalStages = event.totalStages;
        }
        if (event.eventType === 'stage_started') {
          currentStage = event.stageName || event.stageId;
        }
        if (event.eventType === 'stage_completed') {
          completedCount++;
        }
      }

      return {
        currentStage,
        completedCount,
        totalStages,
        progress: Math.round((completedCount / totalStages) * 100)
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Start polling for pipeline progress
   */
  startProgressPolling(projectId, phase = 'design') {
    // Stop any existing polling for this project
    this.stopProgressPolling(projectId);

    let lastProgress = null;

    const interval = setInterval(() => {
      const logPath = this.findLatestPipelineLog();
      if (!logPath) return;

      const progress = this.parsePipelineProgress(logPath);
      if (!progress) return;

      // Only emit if changed
      const progressKey = `${progress.currentStage}-${progress.completedCount}`;
      if (progressKey !== lastProgress) {
        lastProgress = progressKey;

        this.emit('pipeline-progress', {
          projectId,
          phase,
          currentStage: progress.currentStage,
          completedCount: progress.completedCount,
          totalStages: progress.totalStages,
          progress: progress.progress,
          message: `${phase === 'design' ? 'Designing' : 'Building'}: ${progress.currentStage} (${progress.completedCount}/${progress.totalStages})`
        });
      }
    }, 2000); // Poll every 2 seconds

    activePipelines.set(projectId, { interval });
  }

  /**
   * Stop polling for pipeline progress
   */
  stopProgressPolling(projectId) {
    const active = activePipelines.get(projectId);
    if (active?.interval) {
      clearInterval(active.interval);
      activePipelines.delete(projectId);
    }
  }

  /**
   * Start the design phase for a new project
   */
  async startDesignPhase(project) {
    const projectDir = this.getProjectDir(project.user_id, project.id);

    console.log(`[QueueService] Starting design phase for ${project.id}`);
    this.processingProjects.add(project.id);
    this.emit('design-started', { projectId: project.id });

    // Start progress polling
    this.startProgressPolling(project.id, 'design');

    try {
      const result = await pipelineBridge.executeDesignPipeline(
        project.id,
        project.game_idea,
        projectDir
      );

      this.stopProgressPolling(project.id);
      db.updateProjectStatus(project.id, 'implementing', result.pipelineId);
      this.emit('design-completed', { projectId: project.id });

      // Auto-start first feature implementation
      await this.processNextInQueue(project.id);
    } catch (err) {
      this.stopProgressPolling(project.id);
      console.error(`[QueueService] Design phase failed for ${project.id}:`, err);
      db.updateProjectStatus(project.id, 'error');
      this.emit('design-failed', { projectId: project.id, error: err.message });
    } finally {
      this.processingProjects.delete(project.id);
    }
  }

  /**
   * Add a feature request to the queue
   */
  addToQueue(projectId, description) {
    const workItem = db.addToQueue(projectId, description);
    this.emit('queue-updated', { projectId, item: workItem });

    // Try to process if nothing is running
    this.processNextInQueue(projectId);

    return workItem;
  }

  /**
   * Process the next item in the queue for a project
   */
  async processNextInQueue(projectId) {
    // Check if already processing this project
    if (this.processingProjects.has(projectId)) {
      console.log(`[QueueService] Project ${projectId} already processing`);
      return;
    }

    // Check if there's current work in progress
    const currentWork = db.getCurrentWork(projectId);
    if (currentWork) {
      console.log(`[QueueService] Project ${projectId} has work in progress`);
      return;
    }

    // Get next queued item
    const nextItem = db.getNextQueuedItem(projectId);
    if (!nextItem) {
      console.log(`[QueueService] No queued items for ${projectId}`);
      // Update project to live status if implementing
      const project = db.getProject(projectId);
      if (project && project.status === 'implementing') {
        db.updateProjectStatus(projectId, 'live');
        this.emit('project-live', { projectId });
      }
      return;
    }

    // Start processing
    const project = db.getProject(projectId);
    if (!project) return;

    const projectDir = this.getProjectDir(project.user_id, project.id);

    console.log(`[QueueService] Processing work item ${nextItem.id} for ${projectId}`);
    this.processingProjects.add(projectId);

    try {
      // Update status to in_progress
      const pipelineId = `feature_${projectId}_${Date.now()}`;
      db.updateWorkStatus(nextItem.id, 'in_progress', pipelineId);
      this.emit('work-started', { projectId, item: nextItem });

      // Execute feature pipeline
      await pipelineBridge.executeFeaturePipeline(
        projectId,
        nextItem.description,
        projectDir
      );

      // Mark as completed
      db.updateWorkStatus(nextItem.id, 'completed');
      this.emit('work-completed', { projectId, item: nextItem });
      this.emit('game-updated', { projectId });

      // Process next item
      this.processingProjects.delete(projectId);
      await this.processNextInQueue(projectId);

    } catch (err) {
      console.error(`[QueueService] Work item ${nextItem.id} failed:`, err);
      db.updateWorkStatus(nextItem.id, 'error');
      this.emit('work-failed', { projectId, item: nextItem, error: err.message });
      this.processingProjects.delete(projectId);
    }
  }

  /**
   * Get queue status for a project
   */
  getQueueStatus(projectId) {
    const queue = db.getQueue(projectId);
    const currentWork = db.getCurrentWork(projectId);
    return {
      currentWork,
      queued: queue.filter(w => w.status === 'queued'),
      completed: queue.filter(w => w.status === 'completed'),
      isProcessing: this.processingProjects.has(projectId)
    };
  }

  /**
   * Cancel a queued item
   */
  cancelQueuedItem(itemId) {
    const item = db.getWorkItem(itemId);
    if (item && item.status === 'queued') {
      db.deleteWorkItem(itemId);
      this.emit('queue-updated', { projectId: item.project_id });
      return true;
    }
    return false;
  }

  /**
   * Event handling
   */
  on(event, callback) {
    this.eventCallbacks.push({ event, callback });
  }

  emit(event, data) {
    this.eventCallbacks
      .filter(e => e.event === event)
      .forEach(e => {
        try {
          e.callback(data);
        } catch (err) {
          console.error(`[QueueService] Event callback error:`, err);
        }
      });
  }
}

module.exports = new QueueService();
