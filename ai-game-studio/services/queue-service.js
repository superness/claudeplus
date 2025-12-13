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
          const projectMatch = currentState.workingDir?.match(/proj_([a-f0-9]+)/i);
          if (projectMatch) {
            const projectId = 'proj_' + projectMatch[1].toLowerCase();
            // Check both processingProjects AND activePipelines (progress polling)
            if (this.processingProjects.has(projectId) || activePipelines.has(projectId)) {
              console.log(`[QueueService] Pipeline ${currentState.id} is already being processed (processingProjects: ${this.processingProjects.has(projectId)}, activePipelines: ${activePipelines.has(projectId)})`);
              return { found: false, reason: 'already_processing' };
            }
          }

          // Check execution log for recent activity (pipeline actively running even if server restarted)
          const logPath = this.findLatestPipelineLog();
          if (logPath) {
            const progress = this.parsePipelineProgress(logPath);
            if (progress?.lastEventTime) {
              const timeSinceLastEvent = Date.now() - progress.lastEventTime.getTime();
              const fiveMinutes = 5 * 60 * 1000;
              if (timeSinceLastEvent < fiveMinutes) {
                console.log(`[QueueService] Pipeline ${currentState.id} has recent activity (${Math.round(timeSinceLastEvent / 1000)}s ago) - actively running`);
                return { found: false, reason: 'actively_running' };
              }
            }
          }

          console.log(`[QueueService] Found incomplete pipeline: ${currentState.id}`);
          console.log(`[QueueService]   Name: ${currentState.name}`);
          console.log(`[QueueService]   Stage: ${currentState.currentStage} (${currentState.completedStages?.length || 0}/${currentState.stages?.length || 0})`);
          console.log(`[QueueService]   Working Dir: ${currentState.workingDir}`);

          // Try to match this to a project (reuse projectMatch from above)
          if (projectMatch) {
            const projectId = 'proj_' + projectMatch[1].toLowerCase();
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
   * Find the latest pipeline execution log for a specific project
   */
  findLatestPipelineLogForProject(projectId) {
    try {
      const files = fs.readdirSync(PROXY_PIPELINES_DIR)
        .filter(f => f.endsWith('_execution.json'))
        .map(f => ({
          name: f,
          path: path.join(PROXY_PIPELINES_DIR, f),
          mtime: fs.statSync(path.join(PROXY_PIPELINES_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Find the most recent log that contains this project ID
      for (const file of files) {
        try {
          const content = fs.readFileSync(file.path, 'utf8');
          if (content.includes(projectId)) {
            return file.path;
          }
        } catch (e) {
          continue;
        }
      }

      // No matching log found - don't fallback to other projects
      return null;
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
      let currentAgent = null;
      let completedCount = 0;
      let totalStages = 24; // Default for living-game-world
      let lastEventTime = null;
      let lastCompletedOutput = null;
      let lastCompletedAgent = null;

      for (const event of events) {
        if (event.eventType === 'pipeline_initialized' && event.totalStages) {
          totalStages = event.totalStages;
        }
        if (event.eventType === 'stage_started') {
          currentStage = event.stageName || event.stageId;
          currentAgent = event.agent;
        }
        if (event.eventType === 'stage_completed') {
          completedCount++;
          // Capture the output (up to 3000 chars for reasonable display)
          if (event.output) {
            lastCompletedOutput = event.output.substring(0, 3000);
            if (event.output.length > 3000) lastCompletedOutput += '\n\n[... truncated, see full output in pipeline story]';
          }
          lastCompletedAgent = event.agent;
        }
        // Track the most recent event timestamp
        if (event.timestamp) {
          lastEventTime = new Date(event.timestamp);
        }
      }

      return {
        currentStage,
        currentAgent,
        completedCount,
        totalStages,
        progress: Math.round((completedCount / totalStages) * 100),
        lastEventTime,
        lastCompletedOutput,
        lastCompletedAgent
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
    let lastOutputKey = null;

    console.log(`[QueueService] Starting progress polling for ${projectId} (${phase})`);

    const interval = setInterval(() => {
      const logPath = this.findLatestPipelineLogForProject(projectId);
      if (!logPath) return;

      const progress = this.parsePipelineProgress(logPath);
      if (!progress) return;

      // Emit stage change
      const progressKey = `${progress.currentStage}-${progress.completedCount}`;
      if (progressKey !== lastProgress) {
        lastProgress = progressKey;

        this.emit('pipeline-progress', {
          projectId,
          phase,
          currentStage: progress.currentStage,
          currentAgent: progress.currentAgent,
          completedCount: progress.completedCount,
          totalStages: progress.totalStages,
          progress: progress.progress,
          message: `${phase === 'design' ? 'Designing' : 'Building'}: ${progress.currentStage} (step ${progress.completedCount})`
        });
      }

      // Emit agent output when a stage completes (commentator message)
      const outputKey = `${progress.lastCompletedAgent}-${progress.completedCount}`;
      if (progress.lastCompletedOutput && outputKey !== lastOutputKey) {
        lastOutputKey = outputKey;

        this.emit('agent-output', {
          projectId,
          phase,
          agent: progress.lastCompletedAgent,
          output: progress.lastCompletedOutput,
          completedCount: progress.completedCount,
          totalStages: progress.totalStages
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
        projectDir,
        { manualComplexity: project.design_complexity || null }
      );

      this.stopProgressPolling(project.id);
      db.updateProjectStatus(project.id, 'implementing', result.pipelineId);
      this.emit('design-completed', { projectId: project.id });

      // Auto-queue full game build from design docs
      console.log(`[QueueService] Auto-queuing full game build for ${project.id}`);
      db.addToQueue(project.id, `Build the "${project.name}" game using the design documents provided. The user's vision: "${project.game_idea}". Make sure to implement all its features!`);
      this.emit('queue-updated', { projectId: project.id });

      // Start first feature implementation
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

      // Start progress polling for feature pipeline
      this.startProgressPolling(projectId, 'feature');

      // Execute feature pipeline
      await pipelineBridge.executeFeaturePipeline(
        projectId,
        nextItem.description,
        projectDir
      );

      // Stop polling and mark as completed
      this.stopProgressPolling(projectId);
      db.updateWorkStatus(nextItem.id, 'completed');
      this.emit('work-completed', { projectId, item: nextItem });
      this.emit('game-updated', { projectId });

      // Process next item
      this.processingProjects.delete(projectId);
      await this.processNextInQueue(projectId);

    } catch (err) {
      console.error(`[QueueService] Work item ${nextItem.id} failed:`, err);
      this.stopProgressPolling(projectId);
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
   * Get detailed pipeline progress for a project
   */
  getPipelineProgress(projectId) {
    const project = db.getProject(projectId);
    if (!project) {
      return { active: false };
    }

    // Check if there's an active pipeline
    const isActive = this.processingProjects.has(projectId) || activePipelines.has(projectId);

    // Get progress from execution log
    const logPath = this.findLatestPipelineLog();
    if (!logPath) {
      return { active: isActive, progress: null };
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const data = JSON.parse(content);
      const events = data.events || [];

      // Build detailed progress info
      let currentStage = null;
      let currentAgent = null;
      let completedStages = [];
      let totalStages = 24;
      let lastEventTime = null;
      let pipelineName = null;

      for (const event of events) {
        if (event.eventType === 'pipeline_initialized') {
          totalStages = event.totalStages || totalStages;
          pipelineName = event.pipelineName;
        }
        if (event.eventType === 'stage_started') {
          currentStage = event.stageName || event.stageId;
          currentAgent = event.agent;
        }
        if (event.eventType === 'stage_completed') {
          completedStages.push({
            name: event.stageName || event.stageId,
            agent: event.agent,
            timestamp: event.timestamp
          });
        }
        if (event.timestamp) {
          lastEventTime = new Date(event.timestamp);
        }
      }

      // Check if pipeline is actively running (had activity in last 5 min)
      const timeSinceLastEvent = lastEventTime ? Date.now() - lastEventTime.getTime() : Infinity;
      const isActivelyRunning = timeSinceLastEvent < 5 * 60 * 1000;

      return {
        active: isActive || isActivelyRunning,
        pipelineName,
        currentStage,
        currentAgent,
        completedStages,
        completedCount: completedStages.length,
        totalStages,
        progress: Math.round((completedStages.length / totalStages) * 100),
        lastEventTime: lastEventTime?.toISOString(),
        timeSinceLastEvent: Math.round(timeSinceLastEvent / 1000)
      };
    } catch (err) {
      console.error('[QueueService] Error reading pipeline progress:', err);
      return { active: isActive, error: err.message };
    }
  }

  /**
   * Start tracking a project's pipeline progress (called when user opens studio)
   */
  startTrackingProject(projectId) {
    const project = db.getProject(projectId);
    if (!project) {
      return { tracking: false, reason: 'project_not_found' };
    }

    // Check if project has an active pipeline
    if (project.status === 'designing' || this.processingProjects.has(projectId)) {
      // Start progress polling if not already polling
      if (!activePipelines.has(projectId)) {
        const phase = project.status === 'designing' ? 'design' : 'feature';
        this.startProgressPolling(projectId, phase);
        console.log(`[QueueService] Started tracking progress for ${projectId}`);
      }
      return { tracking: true, status: project.status };
    }

    // Check execution log for recent activity even if server doesn't know about it
    const logPath = this.findLatestPipelineLog();
    if (logPath) {
      const progress = this.parsePipelineProgress(logPath);
      if (progress?.lastEventTime) {
        const timeSinceLastEvent = Date.now() - progress.lastEventTime.getTime();
        if (timeSinceLastEvent < 5 * 60 * 1000) {
          // Pipeline is actively running, start polling
          this.startProgressPolling(projectId, 'design');
          console.log(`[QueueService] Detected active pipeline, started tracking for ${projectId}`);
          return { tracking: true, status: 'active_pipeline_detected' };
        }
      }
    }

    // If project is in implementing status, reconcile and process
    if (project.status === 'implementing') {
      const queueStatus = this.getQueueStatus(projectId);

      // Check if any "in_progress" work items have actually completed (missed signal)
      if (queueStatus.currentWork) {
        const workItem = queueStatus.currentWork;
        console.log(`[QueueService] Checking if pipeline completed for work item ${workItem.id} (pipeline: ${workItem.pipeline_id})`);

        let shouldMarkComplete = false;
        let isAbandoned = false;

        // Check if pipeline completed
        if (this.checkPipelineCompleted(workItem.pipeline_id, projectId)) {
          shouldMarkComplete = true;
        } else {
          // Check if work item is stale (started more than 2 hours ago with no pipeline activity)
          const startTime = new Date(workItem.started_at || workItem.created_at);
          const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
          if (startTime.getTime() < twoHoursAgo) {
            // Check if there's been any recent pipeline activity
            const logPath = this.findLatestPipelineLog();
            if (logPath) {
              const progress = this.parsePipelineProgress(logPath);
              if (!progress?.lastEventTime || progress.lastEventTime.getTime() < twoHoursAgo) {
                console.log(`[QueueService] Work item ${workItem.id} appears abandoned (no activity for 2+ hours)`);
                isAbandoned = true;
                shouldMarkComplete = true;
              }
            } else {
              isAbandoned = true;
              shouldMarkComplete = true;
            }
          }
        }

        if (shouldMarkComplete) {
          const newStatus = isAbandoned ? 'error' : 'completed';
          console.log(`[QueueService] Reconciling: work item ${workItem.id} marked as ${newStatus}`);
          db.updateWorkStatus(workItem.id, newStatus);
          this.emit('work-completed', { projectId, item: workItem, abandoned: isAbandoned });

          // Check if more work queued, otherwise mark project live
          const updatedQueue = this.getQueueStatus(projectId);
          if (updatedQueue.queued.length === 0) {
            db.updateProjectStatus(projectId, 'live');
            this.emit('project-live', { projectId });
            return { tracking: false, status: 'live', reconciled: true };
          } else {
            // More work queued, start processing it
            console.log(`[QueueService] Reconciled, ${updatedQueue.queued.length} items still queued`);
            this.processNextInQueue(projectId);
            return { tracking: true, status: 'implementing', reconciled: true };
          }
        }
      }

      // Process next queued item if nothing is running
      const refreshedStatus = this.getQueueStatus(projectId);
      if (refreshedStatus.queued.length > 0 && !refreshedStatus.isProcessing && !refreshedStatus.currentWork) {
        console.log(`[QueueService] Project ${projectId} has ${refreshedStatus.queued.length} queued items, starting processing`);
        this.processNextInQueue(projectId);
        return { tracking: true, status: 'processing_queued_work' };
      }
    }

    return { tracking: false, status: project.status };
  }

  /**
   * Check if a pipeline has completed by reading its execution log
   * This is tricky because the pipelineId we store (e.g., feature_proj_xxx_1765649601561)
   * doesn't exactly match the log filename (pipeline_1765649601650_execution.json)
   * due to timing differences between when we create our ID and when proxy creates the log.
   */
  checkPipelineCompleted(pipelineId, projectId) {
    if (!pipelineId && !projectId) return false;

    try {
      const files = fs.readdirSync(PROXY_PIPELINES_DIR)
        .filter(f => f.endsWith('_execution.json'))
        .sort()
        .reverse(); // newest first

      // Extract project ID from pipelineId if not provided
      if (!projectId && pipelineId) {
        const match = pipelineId.match(/proj_([a-f0-9]+)/i);
        if (match) {
          projectId = 'proj_' + match[1].toLowerCase();
        }
      }

      // Extract timestamp from pipelineId for approximate matching
      const timestampMatch = pipelineId?.match(/(\d{13})$/);
      const pipelineTimestamp = timestampMatch ? parseInt(timestampMatch[1]) : null;

      for (const logFile of files) {
        const logPath = path.join(PROXY_PIPELINES_DIR, logFile);

        try {
          const content = fs.readFileSync(logPath, 'utf8');

          // Check if this log is for our project (working dir contains project ID)
          if (projectId && !content.includes(projectId)) {
            continue;
          }

          // If we have a timestamp, check if the log timestamp is close (within 5 seconds)
          if (pipelineTimestamp) {
            const logTimestampMatch = logFile.match(/pipeline_(\d+)_execution/);
            if (logTimestampMatch) {
              const logTimestamp = parseInt(logTimestampMatch[1]);
              const diff = Math.abs(logTimestamp - pipelineTimestamp);
              // Skip if timestamps are more than 5 seconds apart
              if (diff > 5000) {
                continue;
              }
            }
          }

          // Check if this pipeline completed
          if (content.includes('"eventType":"pipeline_completed"')) {
            console.log(`[QueueService] Found completed pipeline in ${logFile}`);
            return true;
          }
        } catch (readErr) {
          // Skip files we can't read
          continue;
        }
      }

      return false;
    } catch (err) {
      console.error('[QueueService] Error checking pipeline completion:', err.message);
      return false;
    }
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
