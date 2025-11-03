const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MultiAgentClaudeSystem {
  constructor(workingDirectory = null) {
    this.sessionId = Date.now();
    this.conversationLog = [];
    this.commentaryHistory = []; // Track previous commentaries for context
    this.workingDirectory = workingDirectory || path.join(__dirname, '..', 'output');
    this.agentsDir = path.join(__dirname, '..', 'agents'); // Directory for agent JSON files

    // 🎯 STRUCTURED LOGGING SYSTEM FOR PARALLEL CHAOS CONTROL
    this.requestId = this.generateRequestId();
    this.parallelTracker = new Map(); // Track parallel Expert competitions
    this.logBuffer = new Map(); // Organized output by process
    
    // Ensure working directory exists
    if (!fs.existsSync(this.workingDirectory)) {
      fs.mkdirSync(this.workingDirectory, { recursive: true });
    }
  }

  generateRequestId() {
    return `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  log(agent, type, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId: this.sessionId,
      agent,
      type,
      message: typeof message === 'object' ? JSON.stringify(message, null, 2) : message
    };
    
    this.conversationLog.push(logEntry);
    console.log(`[${timestamp}] [${agent}] [${type.toUpperCase()}] ${logEntry.message}`);
    
    // Send real-time status update if callback is available, but filter out internal prompts
    if (this.statusCallback) {
      // Only send meaningful updates to UI, not internal prompts or technical messages
      const isUserFacingMessage = this.shouldSendToUI(logEntry);
      if (isUserFacingMessage) {
        this.statusCallback(logEntry);
      }
    }
    
    return logEntry;
  }

  shouldSendToUI(logEntry) {
    const message = logEntry.message;
    const agent = logEntry.agent;
    const type = logEntry.type;
    
    // Always send COMMENTATOR insights and important system messages
    if (agent === 'COMMENTATOR' && (type === 'insight' || type === 'success' || type === 'commentary')) {
      return true;
    }
    
    // Skip internal technical messages
    const skipPatterns = [
      'spawning claude instance',
      'process exited',
      'you are a',
      'you are the',
      'your job is to',
      'response format:',
      'spawn error',
      'task_planner',
      'task_executor',
      'proof_validator',
      'discerning_expert'
    ];
    
    const isInternalMessage = skipPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isInternalMessage) {
      return false;
    }
    
    // Send meaningful phase updates
    if (type === 'start' || type === 'success' || type === 'complete' || type === 'error') {
      return true;
    }
    
    // Skip most technical stdout/stderr unless it contains meaningful progress info
    if (type === 'stdout' || type === 'stderr') {
      const hasMeaningfulContent = [
        'planning',
        'execution', 
        'validation',
        'approved',
        'rejected',
        'complete'
      ].some(keyword => message.toLowerCase().includes(keyword));
      
      return hasMeaningfulContent;
    }
    
    return false; // Default to not sending
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  // Agent Loading Methods
  loadAgent(agentId) {
    try {
      const filePath = path.join(this.agentsDir, `${agentId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[MULTI-AGENT] Error loading agent ${agentId}:`, error);
    }
    return null;
  }

  getAgentPrompt(agentId, context = {}) {
    const agent = this.loadAgent(agentId);
    if (!agent) {
      console.error(`[MULTI-AGENT] Agent ${agentId} not found, falling back to hardcoded prompts`);
      return this.getFallbackPrompt(agentId, context);
    }

    // Handle template prompts with context injection
    if (agent.system_prompt_template) {
      let prompt = agent.system_prompt_template;
      // Replace template variables with context values
      for (const [key, value] of Object.entries(context)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      return prompt;
    }

    // Handle specializations (like expert types)
    if (context.specialization && agent.specializations && agent.specializations[context.specialization]) {
      const spec = agent.specializations[context.specialization];
      return agent.system_prompt + spec.prompt_addition;
    }

    return agent.system_prompt;
  }

  getFallbackPrompt(agentId, context = {}) {
    // Fallback to original hardcoded prompts if agent files are not found
    switch(agentId) {
      case 'task_planner':
        return this.getTaskPlannerPrompt();
      case 'discerning_expert':
        let prompt = this.getDiscerningExpertPrompt();
        if (context.specialization === 'thoroughness') {
          prompt += '\n\nYou are the THOROUGHNESS EXPERT - focus on completeness and detail.';
        } else if (context.specialization === 'feasibility') {
          prompt += '\n\nYou are the FEASIBILITY EXPERT - focus on practicality and implementation.';
        } else if (context.specialization === 'quality') {
          prompt += '\n\nYou are the QUALITY EXPERT - focus on best practices and excellence.';
        }
        return prompt;
      case 'task_executor':
        return this.getTaskExecutorPrompt(context.approved_plan);
      case 'proof_validator':
        return this.getProofValidatorPrompt();
      case 'commentator':
        return this.getCommentatorPrompt();
      default:
        console.error(`[MULTI-AGENT] Unknown agent: ${agentId}`);
        return 'You are a helpful AI assistant.';
    }
  }

  getCommentatorPrompt() {
    return `You are a PROCESS COMMENTATOR. You provide ONLY commentary about the multi-agent workflow process.

ABSOLUTELY FORBIDDEN:
- Mentioning ANY specifics about the user's task or domain
- Providing ANY solutions, advice, or technical content
- Revealing WHAT is being worked on
- Using domain-specific terminology from the user's request

YOU MUST ONLY SAY:
- "The Task Planner is working..."
- "The Expert is reviewing..."
- "Attempt #X is starting..."
- "The plan got approved/rejected..."
- "The Validator is checking..."

EXAMPLES OF CORRECT RESPONSES:
- "The Task Planner is crafting their first plan! Let's see if it passes muster."
- "Ouch! The Expert rejected that attempt. Time for a revision."
- "Attempt #2 incoming! The Planner is back at it."
- "Success! The Expert approved the plan. Time for execution!"

NEVER mention: technology, implementation details, user requirements, domain knowledge.
Keep under 30 words. Focus ONLY on process flow.`;
  }

  async spawnClaudeInstance(role, prompt, input) {
    this.log(role, 'spawn', `Spawning Claude instance with role: ${role}`);

    return new Promise((resolve, reject) => {
      // Use the configured working directory
      const workingDir = this.workingDirectory;

      const claude = spawn('claude', ['--permission-mode', 'bypassPermissions', '-'], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PWD: workingDir,
          HOME: process.env.HOME || process.env.USERPROFILE
        }
      });

      let output = '';
      let errorOutput = '';

      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        // Don't log COMMENTATOR stdout - it gets logged properly by commentary processing
        if (role !== 'COMMENTATOR') {
          this.log(role, 'stdout', chunk.trim());
        }
        output += chunk;
      });

      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        this.log(role, 'stderr', chunk.trim());
        errorOutput += chunk;
      });

      claude.on('close', (code) => {
        this.log(role, 'close', `Process exited with code: ${code}`);

        if (code !== 0) {
          reject(new Error(`${role} failed: ${errorOutput || 'Unknown error'}`));
        } else {
          resolve(output.trim());
        }
      });

      claude.on('error', (error) => {
        this.log(role, 'error', `Spawn error: ${error.message}`);
        reject(error);
      });

      // Build the final prompt based on role
      let finalPrompt;

      // Only add file creation authority for TASK_EXECUTOR
      if (role === 'TASK_EXECUTOR') {
        finalPrompt = `${prompt}

Working Directory: ${workingDir}

User Input: ${input}`;
      } else {
        // For all other agents (COMMENTATOR, PLANNER, EXPERT, VALIDATOR), use clean prompts
        finalPrompt = `${prompt}

User Input: ${input}`;
      }

      this.log(role, 'input', finalPrompt);

      claude.stdin.write(finalPrompt + '\n');
      claude.stdin.end();
    });
  }

  async processUserRequest(userMessage) {
    this.log('SYSTEM', 'start', `Processing user request: "${userMessage}"`);
    
    // Initial commentary - set the stage (don't give away the answer!)
    const initialCommentary = await this.generateCommentary(
      `A new user request has arrived! Our multi-agent validation system is spinning up to tackle a user's request. The system will now begin the planning phase.`,
      [{ phase: 'initialization', hasRequest: true }]
    );
    this.log('COMMENTATOR', 'start', initialCommentary.content || initialCommentary);
    
    if (this.statusCallback) {
      this.statusCallback({
        timestamp: new Date().toISOString(),
        agent: 'COMMENTATOR',
        type: 'insight',
        message: initialCommentary.content || initialCommentary,
        style: initialCommentary.style || 'neutral'
      });
    }
    
    try {
      // Phase 1: Task Planning & Expert Validation Loop
      const approvedPlan = await this.planAndValidate(userMessage);
      
      // Phase 2: Task Execution with Validation Loop
      let executionResult;
      let validatedResponse;
      let maxRetries = 3;
      let retryCount = 0;
      
      do {
        // Execute the task
        executionResult = await this.executeTask(userMessage, approvedPlan);
        
        // Validate the execution
        const validationResult = await this.validateProof(userMessage, approvedPlan, executionResult);
        
        if (validationResult.status === 'validation_failed') {
          retryCount++;
          this.log('SYSTEM', 'retry', `Validation failed, retry ${retryCount}/${maxRetries}`);
          
          // Add feedback to execution context for next attempt
          if (retryCount < maxRetries) {
            const retryCommentary = await this.generateCommentary(
              `The Proof Validator rejected attempt ${retryCount}. The Task Executor is going to try again with this feedback: "${validationResult.feedback.substring(0, 200)}..."`,
              [{ retry: retryCount, maxRetries, feedback: validationResult.feedback }]
            );
            this.log('COMMENTATOR', 'retry', retryCommentary.content || retryCommentary);
          }
        } else {
          validatedResponse = validationResult;
          break;
        }
      } while (retryCount < maxRetries && validatedResponse === undefined);
      
      if (validatedResponse === undefined) {
        throw new Error(`Execution failed after ${maxRetries} validation attempts`);
      }
      
      this.log('SYSTEM', 'complete', 'Multi-agent process completed successfully');
      return validatedResponse;
      
    } catch (error) {
      this.log('SYSTEM', 'error', `Multi-agent process failed: ${error.message}`);
      return `System Error: ${error.message}`;
    }
  }

  async executePipelineDirectly(pipelineConfig, userContext = '') {
    this.log('PIPELINE_EXECUTION', 'start', `Executing pipeline: ${pipelineConfig.name}`);

    // Initial commentary
    const initialCommentary = await this.generateCommentary(
      `🚀 Pipeline "${pipelineConfig.name}" is starting! This pipeline has ${pipelineConfig.stages?.length || 0} stages across ${pipelineConfig.stages?.filter(s => s.phase).reduce((acc, s) => acc.add(s.phase), new Set()).size || 0} phases.`,
      [{ phase: 'pipeline-start', pipelineName: pipelineConfig.name }]
    );
    this.log('COMMENTATOR', 'start', initialCommentary.content || initialCommentary);

    if (this.statusCallback) {
      this.statusCallback({
        timestamp: new Date().toISOString(),
        agent: 'COMMENTATOR',
        type: 'insight',
        message: initialCommentary.content || initialCommentary,
        style: initialCommentary.style || 'EXCITED'
      });
    }

    try {
      // Group stages by phase
      const phases = {};
      (pipelineConfig.stages || []).forEach(stage => {
        const phase = stage.phase || 'default';
        if (!phases[phase]) phases[phase] = [];
        phases[phase].push(stage);
      });

      const phaseKeys = Object.keys(phases).sort();
      const results = {};

      // Execute each phase sequentially
      for (const phase of phaseKeys) {
        this.log('PIPELINE_EXECUTION', 'phase_start', `Starting phase: ${phase}`);

        const phaseCommentary = await this.generateCommentary(
          `📋 Entering Phase: ${phase} with ${phases[phase].length} agents`,
          [{ phase: 'phase-start', phaseName: phase }]
        );
        this.log('COMMENTATOR', 'phase', phaseCommentary.content || phaseCommentary);

        // Execute all stages in this phase (could be parallel or sequential based on flow)
        for (const stage of phases[phase]) {
          this.log('PIPELINE_EXECUTION', 'stage_start', `Executing stage: ${stage.name} (${stage.agent})`);

          const stageCommentary = await this.generateCommentary(
            `🎯 Running ${stage.name}: ${stage.description}`,
            [{ phase: 'stage-start', stageName: stage.name }]
          );
          this.log('COMMENTATOR', 'stage', stageCommentary.content || stageCommentary);

          if (this.statusCallback) {
            this.statusCallback({
              timestamp: new Date().toISOString(),
              agent: 'PIPELINE',
              type: 'stage_progress',
              message: `Executing: ${stage.name}`,
              style: 'FOCUSED'
            });
          }

          // Load the agent configuration
          const agentConfig = this.loadAgentConfig(stage.agent);
          if (!agentConfig) {
            throw new Error(`Agent configuration not found: ${stage.agent}`);
          }

          // Prepare input context for the agent
          let agentInput = userContext;
          if (stage.inputs && stage.inputs.length > 0) {
            agentInput += '\n\nInputs from previous stages:\n';
            stage.inputs.forEach(inputStage => {
              if (results[inputStage]) {
                agentInput += `\n[${inputStage}]:\n${results[inputStage]}\n`;
              }
            });
          }

          // Execute the agent
          const agentResult = await this.spawnClaudeInstance(
            stage.agent.toUpperCase(),
            agentConfig.systemPrompt,
            agentInput
          );

          results[stage.id] = agentResult;

          const stageCompleteCommentary = await this.generateCommentary(
            `✅ ${stage.name} completed successfully`,
            [{ phase: 'stage-complete', stageName: stage.name }]
          );
          this.log('COMMENTATOR', 'stage_complete', stageCompleteCommentary.content || stageCompleteCommentary);
        }

        const phaseCompleteCommentary = await this.generateCommentary(
          `🎉 Phase ${phase} complete! Moving to next phase...`,
          [{ phase: 'phase-complete', phaseName: phase }]
        );
        this.log('COMMENTATOR', 'phase_complete', phaseCompleteCommentary.content || phaseCompleteCommentary);
      }

      this.log('PIPELINE_EXECUTION', 'complete', 'Pipeline execution completed successfully');

      const finalCommentary = await this.generateCommentary(
        `🏆 Pipeline "${pipelineConfig.name}" completed successfully! All ${pipelineConfig.stages?.length || 0} stages executed.`,
        [{ phase: 'pipeline-complete', pipelineName: pipelineConfig.name }]
      );
      this.log('COMMENTATOR', 'complete', finalCommentary.content || finalCommentary);

      if (this.statusCallback) {
        this.statusCallback({
          timestamp: new Date().toISOString(),
          agent: 'COMMENTATOR',
          type: 'success',
          message: finalCommentary.content || finalCommentary,
          style: 'TRIUMPHANT'
        });
      }

      return {
        status: 'success',
        pipeline: pipelineConfig.name,
        results: results,
        message: 'Pipeline executed successfully'
      };

    } catch (error) {
      this.log('PIPELINE_EXECUTION', 'error', `Pipeline execution failed: ${error.message}`);

      const errorCommentary = await this.generateCommentary(
        `❌ Pipeline execution failed: ${error.message}`,
        [{ phase: 'pipeline-error', error: error.message }]
      );
      this.log('COMMENTATOR', 'error', errorCommentary.content || errorCommentary);

      if (this.statusCallback) {
        this.statusCallback({
          timestamp: new Date().toISOString(),
          agent: 'COMMENTATOR',
          type: 'error',
          message: errorCommentary.content || errorCommentary,
          style: 'CRITICAL'
        });
      }

      throw error;
    }
  }

  loadAgentConfig(agentId) {
    const agentPath = path.join(this.agentsDir, `${agentId}.json`);
    if (!fs.existsSync(agentPath)) {
      this.log('SYSTEM', 'error', `Agent config not found: ${agentPath}`);
      return null;
    }

    try {
      const agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
      this.log('SYSTEM', 'info', `Loaded agent config: ${agentId}`);
      return agentConfig;
    } catch (error) {
      this.log('SYSTEM', 'error', `Failed to load agent config ${agentId}: ${error.message}`);
      return null;
    }
  }

  async planAndValidate(userMessage) {
    this.log('PLANNING_PHASE', 'start', 'Beginning planning and validation phase');
    
    // Pre-planning commentary
    const planningCommentary = await this.generateCommentary(
      `Here we go! The Task Planner is about to create the first plan. Let's see what they come up with - will it pass the Expert's strict standards?`,
      [{ phase: 'planning-start' }]
    );
    this.log('COMMENTATOR', 'planning', planningCommentary.content || planningCommentary);
    
    if (this.statusCallback) {
      this.statusCallback({
        timestamp: new Date().toISOString(),
        agent: 'COMMENTATOR',
        type: 'insight',
        message: planningCommentary.content || planningCommentary,
        style: planningCommentary.style || 'neutral'
      });
    }
    
    // Generate test scenarios to inform planning
    this.log('TEST_GENERATION', 'start', 'Generating test scenarios for planning input');
    const testScenarios = await this.generateTestScenarios(userMessage);
    
    let attempts = 0;
    const maxAttempts = 5;
    let previousRejections = [];
    
    while (attempts < maxAttempts) {
      attempts++;
      this.log('PLANNING_PHASE', 'attempt', `Planning attempt ${attempts}/${maxAttempts}`);
      
      // Generate commentary for ALL planning attempts
      if (attempts === 1) {
        const firstAttemptCommentary = await this.generateCommentary(
          `FIRST PLANNING ATTEMPT: The Task Planner is about to create their first plan. The Expert will then evaluate this plan and either approve it or reject it with detailed feedback.`,
          [{ phase: 'first-attempt', attemptNumber: 1 }]
        );
        this.log('COMMENTATOR', 'first-attempt', firstAttemptCommentary.content || firstAttemptCommentary);
        
        if (this.statusCallback) {
          this.statusCallback({
            timestamp: new Date().toISOString(),
            agent: 'COMMENTATOR',
            type: 'insight',
            message: firstAttemptCommentary.content || firstAttemptCommentary,
            style: firstAttemptCommentary.style || 'neutral'
          });
        }
      } else {
        const commentary = await this.generateCommentary(
          `This is planning attempt ${attempts} after ${attempts-1} rejections. The Task Planner is revising their approach based on Expert feedback.`,
          [{ phase: 'retry-attempt', attemptNumber: attempts, rejectionCount: attempts-1 }]
        );
        this.log('COMMENTATOR', 'insight', commentary.content || commentary);
        
        // Send commentary to UI
        if (this.statusCallback) {
          this.statusCallback({
            timestamp: new Date().toISOString(),
            agent: 'COMMENTATOR',
            type: 'commentary',
            message: commentary.content || commentary,
            style: commentary.style || 'neutral'
          });
        }
      }
      
      // Build context with previous rejections and test scenarios
      let plannerInput = userMessage;
      if (previousRejections.length > 0) {
        plannerInput = `${userMessage}\n\nPREVIOUS REJECTIONS TO LEARN FROM:\n${previousRejections.map((r, i) => `\nAttempt ${i+1} was rejected because:\n${r}`).join('\n')}`;
      }
      
      // Add test scenarios to planner input
      plannerInput += `\n\nTEST SCENARIOS TO CONSIDER:\n${testScenarios}`;
      
      // Task Planner creates plan
      const plan = await this.spawnClaudeInstance(
        'TASK_PLANNER',
        this.getAgentPrompt('task_planner'),
        plannerInput
      );
      
      // Commentary before Expert evaluation
      const preEvalCommentary = await this.generateCommentary(
        `The Task Planner has submitted their plan! Now the moment of truth - will the Expert approve it or deliver another crushing rejection?`,
        [{ phase: 'expert-evaluation', attempt: attempts }]
      );
      this.log('COMMENTATOR', 'pre-eval', preEvalCommentary.content || preEvalCommentary);
      
      if (this.statusCallback) {
        this.statusCallback({
          timestamp: new Date().toISOString(),
          agent: 'COMMENTATOR',
          type: 'insight',
          message: preEvalCommentary.content || preEvalCommentary,
          style: preEvalCommentary.style || 'neutral'
        });
      }
      
      // ⚡ PARALLEL EXPERT EVALUATION - 3 Experts compete for best review!

      this.logStructured('PARALLEL_START', `🚀 ${this.requestId} - Launching Expert Gladiator Competition`, {
        experts: ['THOROUGHNESS', 'FEASIBILITY', 'QUALITY'],
        planLength: plan.length,
        attempt: attempts
      });
      
      const expertPromises = [
        this.spawnClaudeInstance(
          'EXPERT_THOROUGHNESS',
          this.getAgentPrompt('discerning_expert', { specialization: 'thoroughness' }),
          `USER REQUEST: ${userMessage}\n\nTEST SCENARIOS FOR REFERENCE:\n${testScenarios}\n\nPROPOSED PLAN:\n${plan}`
        ),
        this.spawnClaudeInstance(
          'EXPERT_FEASIBILITY', 
          this.getAgentPrompt('discerning_expert', { specialization: 'feasibility' }),
          `USER REQUEST: ${userMessage}\n\nTEST SCENARIOS FOR REFERENCE:\n${testScenarios}\n\nPROPOSED PLAN:\n${plan}`
        ),
        this.spawnClaudeInstance(
          'EXPERT_QUALITY',
          this.getAgentPrompt('discerning_expert', { specialization: 'quality' }),
          `USER REQUEST: ${userMessage}\n\nTEST SCENARIOS FOR REFERENCE:\n${testScenarios}\n\nPROPOSED PLAN:\n${plan}`
        )
      ];

      // Wait for all 3 experts to finish in parallel
      const expertEvaluations = await Promise.all(expertPromises);
      
      // Choose the most critical/detailed evaluation
      const expertEvaluation = this.selectBestExpertReview(expertEvaluations);
      
      this.logStructured('PARALLEL_COMPLETE', `⚡ ${this.requestId} - Expert Competition Complete`, {
        winner: this.lastWinningExpert,
        evaluationLengths: expertEvaluations.map(e => e.length),
        totalTime: Date.now() - this.parallelStartTime
      });
      
      this.log('PLANNING_PHASE', 'evaluation', expertEvaluation);
      
      // Check if plan is approved
      if (expertEvaluation.toLowerCase().includes('approved') || 
          expertEvaluation.toLowerCase().includes('accept')) {
        this.log('PLANNING_PHASE', 'success', 'Plan approved by expert');
        
        // Generate success commentary
        const successCommentary = await this.generateCommentary(
          `After ${attempts} attempts, the Expert finally approved the Task Planner's plan.`,
          [expertEvaluation]
        );
        this.log('COMMENTATOR', 'success', successCommentary.content || successCommentary);
        
        if (this.statusCallback) {
          this.statusCallback({
            timestamp: new Date().toISOString(),
            agent: 'COMMENTATOR',
            type: 'success',
            message: successCommentary.content || successCommentary,
            style: successCommentary.style || 'neutral'
          });
        }
        
        return plan;
      } else {
        this.log('PLANNING_PHASE', 'rejected', `Plan rejected: ${expertEvaluation}`);
        previousRejections.push(expertEvaluation);
        
        // Generate rejection commentary with actual Expert feedback
        const rejectionCommentary = await this.generateCommentary(
          `PLAN REJECTED: The Expert just rejected planning attempt ${attempts}. Here's what the Expert said: "${expertEvaluation.substring(0, 300)}..."`,
          [{ phase: 'rejection', attemptNumber: attempts, expertFeedback: expertEvaluation, totalRejections: attempts }]
        );
        this.log('COMMENTATOR', 'rejection', rejectionCommentary.content || rejectionCommentary);
        
        if (this.statusCallback) {
          this.statusCallback({
            timestamp: new Date().toISOString(),
            agent: 'COMMENTATOR',
            type: 'commentary',
            message: rejectionCommentary.content || rejectionCommentary,
            style: rejectionCommentary.style || 'neutral'
          });
        }
        
        // Continue loop for revision
      }
    }
    
    // Generate helpful failure commentary and ask user for guidance
    const failureCommentary = await this.generateCommentary(
      `Planning has failed after ${maxAttempts} attempts. The Expert keeps rejecting plans due to insufficient detail or unclear requirements. The system needs user guidance to proceed.`,
      previousRejections.slice(-1)
    );
    this.log('COMMENTATOR', 'failure', failureCommentary.content || failureCommentary);
    
    if (this.statusCallback) {
      this.statusCallback({
        timestamp: new Date().toISOString(),
        agent: 'COMMENTATOR',
        type: 'commentary',
        message: failureCommentary.content || failureCommentary,
        style: failureCommentary.style || 'critical'
      });
    }
    
    // Return a helpful response asking for user guidance instead of throwing an error
    return `**PLANNING VALIDATION FAILED**

After ${maxAttempts} attempts, the Expert validator has rejected all proposed plans. Here's what went wrong:

${previousRejections.map((rejection, i) => `**Attempt ${i+1}:** ${rejection.substring(0, 200)}...`).join('\n\n')}

**How would you like to proceed?**

Please provide more specific guidance such as:
- Which exact sports you want to monitor (e.g., "NFL and NBA only")
- What type of data you need (schedules, live scores, both?)
- Technical preferences (web app, desktop app, specific APIs)
- Any other requirements or constraints

**Or choose an option:**
1. **Be more specific** - Provide clearer requirements and try again
2. **Simplify scope** - Start with a basic version (e.g., just one sport)
3. **Different approach** - Try a completely different technical approach
4. **Expert feedback** - Show me the detailed Expert feedback to understand what's needed

Reply with your preference or additional details, and I'll restart the validation process with your guidance.`;
  }

  async executeTaskWithParallelValidation(userMessage, approvedPlan) {
    this.logStructured('PARALLEL_EXEC_VAL_START', '⚡ Starting parallel Execution + Validation prep...', { requestId: this.requestId });
    
    // ⚡ PARALLEL EXECUTION + VALIDATION PREP
    const [executionResult, validationFramework] = await Promise.all([
      // EXECUTOR: Execute the task
      this.spawnClaudeInstance(
        'TASK_EXECUTOR',
        this.getAgentPrompt('task_executor', { approved_plan: approvedPlan }),
        userMessage
      ),
      
      // VALIDATOR: Prepare validation criteria while execution runs
      this.spawnClaudeInstance(
        'VALIDATION_PREP',
        `You are the PROOF VALIDATOR preparing validation criteria.

APPROVED PLAN TO VALIDATE AGAINST:
${approvedPlan}

ORIGINAL USER REQUEST:
${userMessage}

PREPARATION TASK:
Create a comprehensive validation framework that defines:
1. Key deliverables that MUST be present in execution
2. Quality criteria to check for completeness
3. Evidence patterns to look for (specific commands, outputs, etc.)
4. Common failure modes to watch for
5. Success indicators that prove plan was followed

Prepare your validation framework:`,
        userMessage
      )
    ]);

    this.logStructured('PARALLEL_EXEC_VAL_READY', `⚡ Execution complete, validation framework prepared`, {
      requestId: this.requestId,
      executionLength: executionResult.length,
      frameworkLength: validationFramework.length
    });

    // Final validation with execution results
    return await this.validateWithFramework(userMessage, approvedPlan, executionResult, validationFramework);
  }

  async validateWithFramework(userMessage, plan, executionResult, validationFramework) {
    this.logStructured('FINAL_VALIDATION_START', 'VALIDATOR: Final validation with framework...', { requestId: this.requestId });
    
    // Generate commentary about validation phase
    const validationCommentary = await this.generateCommentary(
      `Now we're in the final validation phase. The Proof Validator will check if the Task Executor actually followed the approved plan and provided solid evidence.`,
      [{ phase: 'validation', plan: plan.substring(0, 200), execution: executionResult.substring(0, 200) }]
    );
    this.log('COMMENTATOR', 'insight', validationCommentary.content || validationCommentary);
    
    if (this.statusCallback) {
      this.statusCallback({
        timestamp: new Date().toISOString(),
        agent: 'COMMENTATOR',
        type: 'insight',
        message: validationCommentary.content || validationCommentary,
        style: validationCommentary.style || 'neutral'
      });
    }
    
    const validation = await this.spawnClaudeInstance(
      'PROOF_VALIDATOR',
      this.getAgentPrompt('proof_validator') + `

VALIDATION FRAMEWORK:
${validationFramework}

EXECUTION RESULT TO VALIDATE:
${executionResult}

ORIGINAL REQUEST: ${userMessage}
APPROVED PLAN: ${plan}

Apply your validation framework systematically:
1. Check each deliverable from your framework
2. Verify quality criteria are met
3. Confirm evidence patterns are present
4. Look for failure modes you identified
5. Assess success indicators

Provide final validation decision:`,
      userMessage
    );
    
    if (validation.toLowerCase().includes('validated') || 
        validation.toLowerCase().includes('approved')) {
      this.logStructured('VALIDATION_SUCCESS', 'Proof validated successfully', { requestId: this.requestId });
      
      // Generate final success commentary
      const finalCommentary = await this.generateCommentary(
        `Excellent! The Proof Validator has approved the work. Our multi-agent validation system has successfully delivered a verified response.`,
        [validation]
      );
      this.log('COMMENTATOR', 'success', finalCommentary.content || finalCommentary);
      
      if (this.statusCallback) {
        this.statusCallback({
          timestamp: new Date().toISOString(),
          agent: 'COMMENTATOR',
          type: 'success',
          message: finalCommentary.content || finalCommentary,
          style: finalCommentary.style || 'neutral'
        });
      }
      
      return executionResult;
    } else {
      this.logStructured('VALIDATION_REJECTED', `Proof validation failed`, { requestId: this.requestId });
      
      // Generate failure commentary
      const failureCommentary = await this.generateCommentary(
        `Oh no! The Proof Validator rejected the work. This means the Task Executor didn't follow the plan properly or didn't provide sufficient evidence.`,
        [validation]
      );
      this.log('COMMENTATOR', 'insight', failureCommentary.content || failureCommentary);
      
      if (this.statusCallback) {
        this.statusCallback({
          timestamp: new Date().toISOString(),
          agent: 'COMMENTATOR',
          type: 'commentary',
          message: failureCommentary.content || failureCommentary,
          style: failureCommentary.style || 'neutral'
        });
      }
      
      // Instead of throwing error, implement retry logic
      return { 
        status: 'validation_failed', 
        feedback: validation,
        shouldRetry: true 
      };
    }
  }

  // Keep backward compatibility
  async executeTask(userMessage, approvedPlan) {
    return await this.executeTaskWithParallelValidation(userMessage, approvedPlan);
  }

  async validateProof(userMessage, plan, executionResult) {
    // This method is now integrated into executeTaskWithParallelValidation
    // Keep for backward compatibility but redirect to new flow
    return executionResult;
  }

  getTaskPlannerPrompt() {
    return `You are a TASK PLANNER Claude instance. Your job is to create a PLAN, not execute the task.

CRITICAL: You must respond EXACTLY in this format. Do not provide final answers or results.

UNDERSTANDING: [What you understand the user wants]
APPROACH: [How you will find information/perform the task]  
STEPS: [Numbered list of specific steps with tools/commands you'll use]
TEST_CONSIDERATIONS: [How you will address the test scenarios provided]
EVIDENCE: [What specific proof you will collect to validate your work]
CONFIDENCE: [High/Medium/Low and why]

EXAMPLE of what you should do:
UNDERSTANDING: User wants to know file/folder counts in directory
APPROACH: Use bash commands to list and count directory contents
STEPS: 1) Execute 'ls -la' to get directory listing, 2) Parse output to distinguish files from directories, 3) Count each type separately
TEST_CONSIDERATIONS: Will test with directories containing various file types, hidden files, and edge cases like empty directories
EVIDENCE: Will provide the raw 'ls -la' output and show counting methodology
CONFIDENCE: High - straightforward directory listing task

IMPORTANT: Consider the TEST SCENARIOS provided in your input when creating your plan. Address how your approach will handle the test cases and edge scenarios.

DO NOT give final answers. CREATE A PLAN with specific commands/tools you will use.`;
  }

  getDiscerningExpertPrompt() {
    return `You are a DISCERNING EXPERT Claude instance. Your job is to critically evaluate task plans.

You must be EXTREMELY STRICT and only approve plans that:
1. Show crystal clear understanding of the user's request
2. Have a logical, step-by-step approach
3. Specify CONCRETE, VERIFIABLE evidence that will prove the task was completed
4. Have high confidence with good reasoning

REJECT plans that are:
- Vague or unclear
- Missing specific evidence collection steps
- Overconfident without justification  
- Unable to provide concrete proof of completion

Response format:
ASSESSMENT: [Detailed critique of the plan]
EVIDENCE_QUALITY: [Rate the proposed evidence as Strong/Weak/Insufficient]
DECISION: [APPROVED or REJECTED with specific reasoning]

Only use APPROVED if you are completely satisfied the plan will provide solid proof.`;
  }

  getTaskExecutorPrompt(approvedPlan) {
    return `You are the TASK EXECUTOR. Your job is to implement the approved plan by creating actual code files.

APPROVED PLAN TO EXECUTE:
${approvedPlan}

EXECUTION REQUIREMENTS:
1. Follow the approved plan step-by-step
2. Create all necessary files using the Write tool
3. You have full authority to create files - permissions are pre-approved
4. Write actual, functional code - not examples or pseudocode
5. Provide evidence of what you created (show file paths and key content)

CRITICAL FILE LOCATION REQUIREMENTS:
- You will see "Working Directory: [path]" in your input
- ALL files must be created in that working directory
- Use absolute paths starting with the working directory path
- Example: If working directory is "/mnt/c/github/project/output", create files like "/mnt/c/github/project/output/filename.py"
- NEVER create files in other locations

IMPORTANT NOTES:
- Your work will be validated by a Proof Validator
- Focus on implementing what the plan specifies
- If the plan asks for files to be created, create them immediately
- Document your implementation clearly
- File operations are pre-authorized - proceed without hesitation

Execute the plan now:`;
  }

  getProofValidatorPrompt() {
    return `You are a PROOF VALIDATOR Claude instance. Your job is to verify that the task was actually completed correctly.

You must:
1. Check that the execution result matches what was promised in the plan
2. Verify that concrete evidence was actually provided
3. Confirm the work quality meets the original request
4. Be EXTREMELY STRICT - reject if proof is insufficient

Response format:
PLAN_ADHERENCE: [Did executor follow the approved plan?]
EVIDENCE_PROVIDED: [Rate the actual evidence as Strong/Weak/Missing]
QUALITY_ASSESSMENT: [Does the work meet the original request?]
DECISION: [VALIDATED or REJECTED with specific reasoning]

Only use VALIDATED if you have solid proof the task was completed correctly.`;
  }

  async generateCommentary(context, latestEvents) {
    // Create commentary based on recent agent interactions
    const previousCommentaries = this.commentaryHistory.slice(-2).join(' '); // Last 2 commentaries for context

    const commentaryPrompt = `You are providing real-time status updates for a multi-agent software engineering system.

The system has 4 specialized agents working together:
- Task Planner: Creates detailed implementation plans
- Expert Reviewer: Evaluates and approves/rejects plans
- Task Executor: Implements the approved plans
- Proof Validator: Verifies the implementation quality

Previous updates: ${previousCommentaries || 'This is the start of a new validation process.'}

Current situation: ${context}

Event details: ${JSON.stringify(latestEvents, null, 2)}

Please provide a concise 1-2 sentence status update about what's happening in the pipeline right now. Be engaging and informative.

Format your response as: [STYLE:type] Your update here

Style types available:
- CRITICAL: For failures/rejections
- SUCCESS: For approvals/completions
- ELECTRIC: For high-energy processing
- MYSTICAL: For complex analysis
- WARNING: For concerning issues
- NEUTRAL: For standard updates

Example: [STYLE:CRITICAL] The Expert validator rejected the plan on attempt #2 due to insufficient API specifications!

Your status update:`;

    try {
      const commentary = await this.spawnClaudeInstance('COMMENTATOR', this.getAgentPrompt('commentator', { context: context }), 'Provide process commentary only.');
      const rawCommentary = commentary.trim();
      
      // Parse styling directive if present
      const styleMatch = rawCommentary.match(/^\[STYLE:(\w+)\]\s*(.*)$/);
      let cleanCommentary, styleChoice;
      
      if (styleMatch) {
        styleChoice = styleMatch[1].toLowerCase();
        cleanCommentary = styleMatch[2];
      } else {
        styleChoice = 'neutral';
        cleanCommentary = rawCommentary;
      }
      
      // Store this commentary in history for future context (without style directive)
      this.commentaryHistory.push(cleanCommentary);
      
      // Keep only last 3 commentaries to avoid context overflow
      if (this.commentaryHistory.length > 3) {
        this.commentaryHistory.shift();
      }
      
      // Return both content and styling choice
      return {
        content: cleanCommentary,
        style: styleChoice
      };
    } catch (error) {
      return `Commentary system temporarily unavailable: ${error.message}`;
    }
  }

  getFullLog() {
    return this.conversationLog;
  }

  // 🎯 STRUCTURED LOGGING FOR ORGANIZED CHAOS
  logStructured(event, message, data = {}) {
    const timestamp = new Date().toISOString();
    const structuredLog = {
      timestamp,
      requestId: this.requestId,
      event,
      message,
      data,
      sessionId: this.sessionId
    };
    
    console.log(`🎯 [${event}] ${message}`, data);
    
    // Store in organized buffer
    if (!this.logBuffer.has(event)) {
      this.logBuffer.set(event, []);
    }
    this.logBuffer.get(event).push(structuredLog);
  }

  // ⚡ SELECT BEST EXPERT REVIEW FROM PARALLEL EVALUATIONS
  selectBestExpertReview(expertEvaluations) {
    this.parallelStartTime = this.parallelStartTime || Date.now();
    
    // Score each review based on length, specificity, and critical analysis
    const scoredReviews = expertEvaluations.map((review, index) => {
      const names = ['THOROUGHNESS', 'FEASIBILITY', 'QUALITY'];
      const score = this.scoreExpertReview(review);
      return { review, score, expert: names[index] };
    });

    // Sort by score (highest first) and return the best review
    scoredReviews.sort((a, b) => b.score - a.score);
    const best = scoredReviews[0];
    
    // Store winner for structured logging
    this.lastWinningExpert = best.expert;
    
    this.logStructured('EXPERT_BATTLE', `🏆 ${best.expert} Expert wins the gladiator competition!`, {
      winner: best.expert,
      score: best.score,
      allScores: scoredReviews.map(r => ({ expert: r.expert, score: r.score })),
      margin: best.score - scoredReviews[1].score
    });
    
    return best.review;
  }

  scoreExpertReview(review) {
    let score = 0;
    
    // Length indicates thoroughness
    score += Math.min(review.length / 10, 100);
    
    // Keywords indicating detailed analysis
    const qualityWords = ['specific', 'detail', 'requirement', 'implementation', 'architecture', 'risk', 'concern', 'issue'];
    qualityWords.forEach(word => {
      if (review.toLowerCase().includes(word)) score += 20;
    });
    
    // Rejection indicates critical thinking
    if (review.toLowerCase().includes('reject') || review.toLowerCase().includes('insufficient')) {
      score += 50;
    }
    
    return score;
  }

  async generateTestScenarios(userMessage) {
    try {
      const response = await this.spawnClaudeInstance(
        'TEST_SCENARIO_GENERATOR',
        `You are a test scenario generator. Create 3-5 realistic test scenarios that would help validate a solution for the given request.

Format your response as a simple list of scenarios, each on a new line starting with "- ".

Keep scenarios concise but specific. Focus on edge cases, common use cases, and potential challenges.`,
        `Generate test scenarios for this request: "${userMessage}"`
      );
      
      return response || '- Standard use case validation\n- Error handling verification\n- Performance under load';
    } catch (error) {
      this.log('TEST_GENERATION', 'error', `Failed to generate test scenarios: ${error.message}`);
      return '- Standard use case validation\n- Error handling verification\n- Performance under load';
    }
  }
}

module.exports = MultiAgentClaudeSystem;
