/**
 * DYNAMIC PIPELINE ENGINE
 * Revolutionary AI agent pipeline orchestration system
 */

const { PipelineDefinition, PipelineStage, AgentDefinition } = require('./pipeline-definitions');
const EventEmitter = require('events');

class DynamicPipelineEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pipelines = new Map();
    this.executions = new Map();
    this.agents = new Map();
    this.metrics = new Map();
    this.config = {
      maxConcurrentExecutions: options.maxConcurrentExecutions || 10,
      defaultTimeout: options.defaultTimeout || 60000,
      retryAttempts: options.retryAttempts || 3,
      metricsEnabled: options.metricsEnabled !== false,
      realTimeUpdates: options.realTimeUpdates !== false,
      ...options
    };
    
    this.setupMetricsCollection();
  }

  // PIPELINE MANAGEMENT
  registerPipeline(definition) {
    const pipeline = new PipelineDefinition(definition);
    const validation = pipeline.validate();
    
    if (!validation.valid) {
      throw new Error(`Pipeline validation failed: ${validation.errors.join(', ')}`);
    }
    
    this.pipelines.set(pipeline.id, pipeline);
    this.emit('pipeline:registered', { pipelineId: pipeline.id, pipeline });
    
    return pipeline;
  }

  getPipeline(id) {
    return this.pipelines.get(id);
  }

  getAllPipelines() {
    return Array.from(this.pipelines.values());
  }

  // AGENT MANAGEMENT
  registerAgent(definition) {
    const agent = new AgentDefinition(definition);
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', { agentId: agent.id, agent });
    return agent;
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  // PIPELINE EXECUTION
  async executePipeline(pipelineId, input, options = {}) {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline "${pipelineId}" not found`);
    }

    const executionId = this.generateExecutionId();
    const execution = new PipelineExecution(executionId, pipeline, input, {
      ...this.config,
      ...options
    });

    this.executions.set(executionId, execution);
    
    // Set up event forwarding
    execution.on('stage:started', (data) => {
      this.emit('execution:stage:started', { executionId, ...data });
    });
    
    execution.on('stage:completed', (data) => {
      this.emit('execution:stage:completed', { executionId, ...data });
    });
    
    execution.on('stage:failed', (data) => {
      this.emit('execution:stage:failed', { executionId, ...data });
    });
    
    execution.on('execution:completed', (data) => {
      this.emit('execution:completed', { executionId, ...data });
    });
    
    execution.on('execution:failed', (data) => {
      this.emit('execution:failed', { executionId, ...data });
    });

    // Start execution
    try {
      const result = await execution.execute();
      this.recordMetrics(executionId, execution);
      return {
        executionId,
        result,
        metrics: execution.getMetrics(),
        timeline: execution.getTimeline()
      };
    } catch (error) {
      this.recordMetrics(executionId, execution, error);
      throw error;
    }
  }

  // EXECUTION MONITORING
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  getActiveExecutions() {
    return Array.from(this.executions.values())
      .filter(exec => exec.status === 'running');
  }

  async stopExecution(executionId) {
    const execution = this.getExecution(executionId);
    if (execution) {
      await execution.stop();
      this.emit('execution:stopped', { executionId });
    }
  }

  // METRICS AND MONITORING
  setupMetricsCollection() {
    this.startTime = Date.now();
    this.metrics.set('system', {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      systemUptime: 0
    });
  }

  recordMetrics(executionId, execution, error = null) {
    const systemMetrics = this.metrics.get('system');
    systemMetrics.totalExecutions++;
    
    if (error) {
      systemMetrics.failedExecutions++;
    } else {
      systemMetrics.successfulExecutions++;
    }
    
    const executionTime = execution.getExecutionTime();
    systemMetrics.averageExecutionTime = 
      (systemMetrics.averageExecutionTime * (systemMetrics.totalExecutions - 1) + executionTime) / 
      systemMetrics.totalExecutions;
    
    systemMetrics.systemUptime = Date.now() - this.startTime;
    
    this.emit('metrics:updated', { systemMetrics, executionId });
  }

  getSystemMetrics() {
    return this.metrics.get('system');
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

class PipelineExecution extends EventEmitter {
  constructor(id, pipeline, input, options = {}) {
    super();
    this.id = id;
    this.pipeline = pipeline;
    this.input = input;
    this.options = options;
    this.status = 'pending';
    this.startTime = null;
    this.endTime = null;
    this.stages = new Map();
    this.results = new Map();
    this.context = new Map();
    this.timeline = [];
    this.errors = [];
  }

  async execute() {
    this.status = 'running';
    this.startTime = Date.now();
    this.addTimelineEvent('execution_started', { input: this.input });
    
    try {
      // Initialize all stages
      this.pipeline.getAllStages().forEach(stageDef => {
        this.stages.set(stageDef.id, new StageExecution(stageDef, this));
      });

      // Execute stages based on dependencies
      const result = await this.executeStages();
      
      this.status = 'completed';
      this.endTime = Date.now();
      this.addTimelineEvent('execution_completed', { result });
      this.emit('execution:completed', { result });
      
      return result;
    } catch (error) {
      this.status = 'failed';
      this.endTime = Date.now();
      this.errors.push(error);
      this.addTimelineEvent('execution_failed', { error: error.message });
      this.emit('execution:failed', { error });
      throw error;
    }
  }

  async executeStages() {
    const executed = new Set();
    const results = new Map();
    
    // Find stages with no dependencies (entry points)
    const readyStages = this.pipeline.getAllStages()
      .filter(stage => stage.dependencies.length === 0);
    
    if (readyStages.length === 0) {
      throw new Error('No entry point stages found (stages with no dependencies)');
    }

    // Execute stages in dependency order
    while (executed.size < this.pipeline.stages.size) {
      const currentlyReady = this.pipeline.getAllStages()
        .filter(stage => 
          !executed.has(stage.id) && 
          stage.dependencies.every(dep => executed.has(dep))
        );

      if (currentlyReady.length === 0) {
        throw new Error('Circular dependency detected or unreachable stages');
      }

      // Execute ready stages (potentially in parallel)
      const parallelStages = currentlyReady.filter(stage => stage.parallel);
      const sequentialStages = currentlyReady.filter(stage => !stage.parallel);

      // Execute parallel stages
      if (parallelStages.length > 0) {
        const parallelPromises = parallelStages.map(stage => 
          this.executeStage(stage.id)
        );
        const parallelResults = await Promise.all(parallelPromises);
        parallelStages.forEach((stage, index) => {
          results.set(stage.id, parallelResults[index]);
          executed.add(stage.id);
        });
      }

      // Execute sequential stages
      for (const stage of sequentialStages) {
        const result = await this.executeStage(stage.id);
        results.set(stage.id, result);
        executed.add(stage.id);
      }
    }

    // Return final results
    return this.buildFinalResult(results);
  }

  async executeStage(stageId) {
    const stage = this.stages.get(stageId);
    if (!stage) {
      throw new Error(`Stage "${stageId}" not found`);
    }

    this.addTimelineEvent('stage_started', { stageId });
    this.emit('stage:started', { stageId, stage: stage.definition });

    try {
      const result = await stage.execute();
      this.results.set(stageId, result);
      this.addTimelineEvent('stage_completed', { stageId, result });
      this.emit('stage:completed', { stageId, result });
      return result;
    } catch (error) {
      this.addTimelineEvent('stage_failed', { stageId, error: error.message });
      this.emit('stage:failed', { stageId, error });
      throw error;
    }
  }

  buildFinalResult(stageResults) {
    // Find the final stage(s) - stages that no other stage depends on
    const finalStages = this.pipeline.getAllStages()
      .filter(stage => 
        !this.pipeline.getAllStages().some(other => 
          other.dependencies.includes(stage.id)
        )
      );

    if (finalStages.length === 1) {
      return stageResults.get(finalStages[0].id);
    } else {
      // Multiple final stages - return combined result
      const combinedResult = {};
      finalStages.forEach(stage => {
        combinedResult[stage.id] = stageResults.get(stage.id);
      });
      return combinedResult;
    }
  }

  async stop() {
    this.status = 'stopping';
    // Stop all running stages
    for (const stage of this.stages.values()) {
      if (stage.status === 'running') {
        await stage.stop();
      }
    }
    this.status = 'stopped';
    this.endTime = Date.now();
    this.addTimelineEvent('execution_stopped');
  }

  addTimelineEvent(type, data = {}) {
    this.timeline.push({
      timestamp: Date.now(),
      type,
      data
    });
  }

  getMetrics() {
    return {
      executionTime: this.getExecutionTime(),
      stageCount: this.stages.size,
      successfulStages: Array.from(this.stages.values()).filter(s => s.status === 'completed').length,
      failedStages: Array.from(this.stages.values()).filter(s => s.status === 'failed').length,
      timeline: this.timeline,
      errors: this.errors
    };
  }

  getExecutionTime() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || Date.now();
    return endTime - this.startTime;
  }

  getTimeline() {
    return this.timeline;
  }
}

class StageExecution {
  constructor(definition, pipelineExecution) {
    this.definition = definition;
    this.pipeline = pipelineExecution;
    this.status = 'pending';
    this.startTime = null;
    this.endTime = null;
    this.result = null;
    this.error = null;
    this.attempts = 0;
  }

  async execute() {
    this.status = 'running';
    this.startTime = Date.now();
    this.attempts++;

    try {
      // Get input data from dependencies
      const inputData = this.getInputData();
      
      // Execute stage based on type
      let result;
      switch (this.definition.type) {
        case 'agent':
          result = await this.executeAgent(inputData);
          break;
        case 'validator':
          result = await this.executeValidator(inputData);
          break;
        case 'transformer':
          result = await this.executeTransformer(inputData);
          break;
        case 'gateway':
          result = await this.executeGateway(inputData);
          break;
        case 'parallel':
          result = await this.executeParallel(inputData);
          break;
        default:
          throw new Error(`Unknown stage type: ${this.definition.type}`);
      }

      this.result = result;
      this.status = 'completed';
      this.endTime = Date.now();
      return result;
    } catch (error) {
      this.error = error;
      
      // Check if we should retry
      if (this.attempts < this.definition.retryPolicy.maxAttempts) {
        // Wait for backoff period
        const backoffTime = this.calculateBackoff();
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.execute(); // Retry
      }
      
      this.status = 'failed';
      this.endTime = Date.now();
      throw error;
    }
  }

  getInputData() {
    const inputData = {};
    
    // Get data from dependency stages
    this.definition.dependencies.forEach(depId => {
      const depResult = this.pipeline.results.get(depId);
      if (depResult) {
        inputData[depId] = depResult;
      }
    });

    // Add pipeline input if this is an entry stage
    if (this.definition.dependencies.length === 0) {
      inputData.pipelineInput = this.pipeline.input;
    }

    return inputData;
  }

  async executeAgent(inputData) {
    // This would integrate with the existing Claude agent system
    // For now, we'll simulate agent execution
    return {
      type: 'agent_result',
      stageName: this.definition.name,
      inputData,
      timestamp: Date.now(),
      agentId: this.definition.agent
    };
  }

  async executeValidator(inputData) {
    // Validation logic
    return {
      type: 'validation_result',
      valid: true,
      score: 8.5,
      feedback: 'Validation passed',
      inputData
    };
  }

  async executeTransformer(inputData) {
    // Data transformation logic
    return {
      type: 'transformed_data',
      originalData: inputData,
      transformedData: inputData, // Would apply transformations
      timestamp: Date.now()
    };
  }

  async executeGateway(inputData) {
    // Gateway/routing logic
    return {
      type: 'gateway_decision',
      route: 'default',
      inputData,
      decision: 'proceed'
    };
  }

  async executeParallel(inputData) {
    // Parallel execution logic
    return {
      type: 'parallel_result',
      branches: [],
      inputData
    };
  }

  calculateBackoff() {
    const baseDelay = 1000; // 1 second
    switch (this.definition.retryPolicy.backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, this.attempts - 1);
      case 'linear':
        return baseDelay * this.attempts;
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  async stop() {
    this.status = 'stopped';
    this.endTime = Date.now();
  }
}

module.exports = {
  DynamicPipelineEngine,
  PipelineExecution,
  StageExecution
};