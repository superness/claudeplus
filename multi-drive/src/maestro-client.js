/**
 * Maestro Client - Recursive AI Orchestration
 *
 * The core orchestrator that implements the Multi-Drive Maestro pattern:
 * 1. Every agent evaluates complexity (ABUDDI)
 * 2. Simple tasks: implement directly
 * 3. Complex tasks: delegate to child tabs via Chat API
 * 4. Results flow back up for synthesis
 */

const ApiClient = require('./api-client');
const DecisionParser = require('./decision-parser');

class MaestroClient {
  constructor(options = {}) {
    this.apiClient = new ApiClient(options.baseUrl || 'http://localhost:8081');
    this.maxParallel = options.maxParallel || 3;
    this.defaultWorkingDir = options.workingDirectory || process.cwd();

    // Track active orchestrations
    this.activeOrchestrations = new Map(); // rootTabId -> orchestration state
    this.tabCounter = 0;

    // Event callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onChildCreated = options.onChildCreated || (() => {});
    this.onChildCompleted = options.onChildCompleted || (() => {});
    this.onSynthesisStart = options.onSynthesisStart || (() => {});
  }

  /**
   * Main entry point - start a Maestro orchestration
   *
   * @param {string} request - The user's request
   * @param {Object} options - Optional settings
   * @returns {Promise<Object>} Final synthesized result
   */
  async execute(request, options = {}) {
    const workingDirectory = options.workingDirectory || this.defaultWorkingDir;
    const rootHat = options.hatId || 'product-maestro';

    // Generate unique root tab ID
    const rootTabId = `maestro-${++this.tabCounter}-${Date.now()}`;

    // Create orchestration tracking
    const orchestration = {
      rootTabId,
      status: 'active',
      startTime: Date.now(),
      request,
      workingDirectory,
      tabs: new Map(), // tabId -> tab state
      results: []
    };
    this.activeOrchestrations.set(rootTabId, orchestration);

    try {
      // Create root tab with Maestro metadata
      const rootTab = await this.createMaestroTab({
        tabId: rootTabId,
        name: `Maestro: ${request.slice(0, 40)}${request.length > 40 ? '...' : ''}`,
        workingDirectory,
        hatIds: [rootHat],
        maestro: {
          parentTabId: null,
          childTabIds: [],
          status: 'active',
          depth: 0,
          originalRequest: request,
          pendingChildren: 0,
          childResults: {}
        }
      });

      orchestration.tabs.set(rootTabId, rootTab);

      this.onProgress({
        type: 'orchestration_started',
        rootTabId,
        request: request.slice(0, 100)
      });

      // Process the root tab (recursive)
      const result = await this.processTab(rootTabId, request, orchestration);

      orchestration.status = 'complete';
      orchestration.result = result;
      orchestration.endTime = Date.now();

      this.onProgress({
        type: 'orchestration_complete',
        rootTabId,
        duration: orchestration.endTime - orchestration.startTime,
        result
      });

      return result;

    } catch (error) {
      orchestration.status = 'failed';
      orchestration.error = error.message;
      orchestration.endTime = Date.now();

      this.onProgress({
        type: 'orchestration_failed',
        rootTabId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process a single tab - determine if IMPLEMENT or DELEGATE
   */
  async processTab(tabId, message, orchestration) {
    const tab = orchestration.tabs.get(tabId);
    const depth = tab?.maestro?.depth || 0;

    this.onProgress({
      type: 'tab_processing',
      tabId,
      depth,
      message: message.slice(0, 100)
    });

    // Send message to the tab
    const response = await this.apiClient.sendMessage(tabId, message, {
      workingDirectory: tab?.workingDirectory,
      hatIds: tab?.hatIds
    });

    // Parse the decision
    const decision = DecisionParser.parse(response.response || response.text || '');

    if (decision.type === 'IMPLEMENT') {
      // Atomic task - mark complete and return result
      await this.updateTabStatus(tabId, 'complete', orchestration);

      this.onProgress({
        type: 'tab_implemented',
        tabId,
        depth,
        summary: decision.summary || 'Task completed'
      });

      return decision.result;
    }

    if (decision.type === 'DELEGATE') {
      // Complex task - create child tabs and process
      return await this.handleDelegation(tabId, decision, orchestration);
    }

    // Unknown decision type - treat as implementation
    return decision;
  }

  /**
   * Handle delegation to child tabs
   */
  async handleDelegation(parentTabId, decision, orchestration) {
    const parentTab = orchestration.tabs.get(parentTabId);
    const parentDepth = parentTab?.maestro?.depth || 0;
    const subtasks = decision.subtasks || [];

    if (subtasks.length === 0) {
      console.warn('DELEGATE decision with no subtasks, treating as IMPLEMENT');
      return decision.result || { status: 'success', note: 'No subtasks to delegate' };
    }

    this.onProgress({
      type: 'delegation_started',
      parentTabId,
      subtaskCount: subtasks.length,
      complexityScore: decision.complexityScore,
      reason: decision.delegationReason
    });

    // Update parent status to waiting
    await this.updateTabStatus(parentTabId, 'waiting', orchestration);

    // Group subtasks by priority
    const byPriority = this.groupByPriority(subtasks);
    const allResults = [];

    for (const priorityGroup of byPriority) {
      // Process up to maxParallel at once within each priority group
      const chunks = this.chunk(priorityGroup, this.maxParallel);

      for (const chunk of chunks) {
        // Create and process children in parallel
        const chunkPromises = chunk.map(subtask =>
          this.processSubtask(parentTabId, subtask, orchestration)
        );

        const chunkResults = await Promise.allSettled(chunkPromises);

        // Collect results
        for (const promiseResult of chunkResults) {
          if (promiseResult.status === 'fulfilled') {
            allResults.push(promiseResult.value);

            // Report to parent
            await this.reportResultToParent(parentTabId, promiseResult.value, orchestration);
          } else {
            // Handle failure
            allResults.push({
              status: 'failed',
              error: promiseResult.reason?.message || 'Unknown error'
            });
          }
        }
      }
    }

    // All children complete - synthesize results
    this.onSynthesisStart({ parentTabId, resultCount: allResults.length });

    const synthesized = await this.synthesize(parentTabId, allResults, orchestration);

    await this.updateTabStatus(parentTabId, 'complete', orchestration);

    return synthesized;
  }

  /**
   * Process a single subtask by creating a child tab
   */
  async processSubtask(parentTabId, subtask, orchestration) {
    const parentTab = orchestration.tabs.get(parentTabId);
    const childDepth = (parentTab?.maestro?.depth || 0) + 1;

    // Create child tab
    const childTabId = `${parentTabId}-child-${++this.tabCounter}`;

    const childTab = await this.createMaestroTab({
      tabId: childTabId,
      name: subtask.name,
      workingDirectory: subtask.workingDirectory || parentTab?.workingDirectory,
      hatIds: [subtask.hat || 'sub-ic'],
      maestro: {
        parentTabId,
        childTabIds: [],
        status: 'active',
        depth: childDepth,
        originalRequest: subtask.context,
        pendingChildren: 0,
        childResults: {}
      }
    });

    orchestration.tabs.set(childTabId, childTab);

    // Track child in parent
    if (parentTab?.maestro) {
      parentTab.maestro.childTabIds.push(childTabId);
      parentTab.maestro.pendingChildren = (parentTab.maestro.pendingChildren || 0) + 1;
    }

    this.onChildCreated({
      parentTabId,
      childTabId,
      name: subtask.name,
      hat: subtask.hat,
      depth: childDepth
    });

    // RECURSIVE CALL - process the child tab
    const result = await this.processTab(childTabId, subtask.context, orchestration);

    // Update parent tracking
    if (parentTab?.maestro) {
      parentTab.maestro.pendingChildren = Math.max(0, parentTab.maestro.pendingChildren - 1);
    }

    this.onChildCompleted({
      parentTabId,
      childTabId,
      name: subtask.name,
      result
    });

    return {
      childTabId,
      name: subtask.name,
      status: result?.status || 'success',
      result
    };
  }

  /**
   * Report a child result to the parent tab
   */
  async reportResultToParent(parentTabId, childResult, orchestration) {
    const parentTab = orchestration.tabs.get(parentTabId);

    if (parentTab?.maestro) {
      parentTab.maestro.childResults[childResult.childTabId] = {
        status: childResult.status,
        result: childResult.result,
        receivedAt: Date.now()
      };
    }

    // Send message to parent about the result
    const resultMessage = `
CHILD_RESULT_RECEIVED:
{
  "childTabId": "${childResult.childTabId}",
  "childName": "${childResult.name}",
  "status": "${childResult.status}",
  "result": ${JSON.stringify(childResult.result, null, 2)}
}

This child task has completed. Continue tracking progress.
`;

    // Note: We don't wait for response here - parent continues processing
    // This is informational for the parent's context
    try {
      await this.apiClient.sendMessage(parentTabId, resultMessage, {
        workingDirectory: parentTab?.workingDirectory,
        hatIds: parentTab?.hatIds
      });
    } catch (e) {
      console.warn(`Failed to notify parent ${parentTabId}:`, e.message);
    }
  }

  /**
   * Synthesize results from all children
   */
  async synthesize(parentTabId, childResults, orchestration) {
    const parentTab = orchestration.tabs.get(parentTabId);

    const synthesisMessage = `
ALL_CHILDREN_COMPLETE:

The following subtasks have completed:

${childResults.map((r, i) => `
### Subtask ${i + 1}: ${r.name || 'Unknown'}
- Status: ${r.status}
- Result: ${JSON.stringify(r.result, null, 2)}
`).join('\n')}

---

Based on these results, provide a synthesized summary and final result for the original request:
"${parentTab?.maestro?.originalRequest || 'Unknown request'}"

Output your synthesis, then end with:
RESULT: { "status": "success", "synthesis": "..." }
`;

    // Switch to synthesizer hat
    const response = await this.apiClient.sendMessage(parentTabId, synthesisMessage, {
      workingDirectory: parentTab?.workingDirectory,
      hatIds: ['synthesizer']
    });

    // Parse synthesized result
    const parsed = DecisionParser.parseImplementation(response.response || response.text || '');

    return parsed.result || {
      status: 'success',
      childResults,
      synthesis: DecisionParser.stripMarkers(response.response || response.text || '')
    };
  }

  /**
   * Create a tab with Maestro metadata
   */
  async createMaestroTab(options) {
    try {
      const result = await this.apiClient.createTab(options);
      return {
        ...result,
        maestro: options.maestro
      };
    } catch (e) {
      console.error(`Failed to create tab ${options.tabId}:`, e.message);
      throw e;
    }
  }

  /**
   * Update tab status
   */
  async updateTabStatus(tabId, status, orchestration) {
    const tab = orchestration.tabs.get(tabId);
    if (tab?.maestro) {
      tab.maestro.status = status;
    }

    try {
      await this.apiClient.updateTab(tabId, {
        maestro: tab?.maestro
      });
    } catch (e) {
      console.warn(`Failed to update tab status for ${tabId}:`, e.message);
    }
  }

  /**
   * Group subtasks by priority
   */
  groupByPriority(subtasks) {
    const groups = new Map();

    for (const task of subtasks) {
      const priority = task.priority || 1;
      if (!groups.has(priority)) {
        groups.set(priority, []);
      }
      groups.get(priority).push(task);
    }

    // Sort by priority (lower number = higher priority)
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, tasks]) => tasks);
  }

  /**
   * Chunk array into groups of max size
   */
  chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get orchestration status
   */
  getStatus(rootTabId) {
    return this.activeOrchestrations.get(rootTabId);
  }

  /**
   * Abort an orchestration
   */
  async abort(rootTabId) {
    const orchestration = this.activeOrchestrations.get(rootTabId);
    if (!orchestration) return;

    orchestration.status = 'aborted';

    // Attempt to abort all active tabs
    for (const [tabId, tab] of orchestration.tabs) {
      if (tab.maestro?.status === 'active' || tab.maestro?.status === 'waiting') {
        try {
          await this.apiClient.deleteTab(tabId);
        } catch (e) {
          console.warn(`Failed to delete tab ${tabId}:`, e.message);
        }
      }
    }
  }
}

module.exports = MaestroClient;
