const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class MultiAgentClaudeSystem {
  constructor() {
    this.sessionId = Date.now();
    this.conversationLog = [];
    this.commentaryHistory = []; // Track previous commentaries for context

    // 🎯 STRUCTURED LOGGING SYSTEM FOR PARALLEL CHAOS CONTROL
    this.requestId = this.generateRequestId();
    this.parallelTracker = new Map(); // Track parallel Expert competitions
    this.logBuffer = new Map(); // Organized output by process
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
    
    // Send real-time status update if callback is available
    if (this.statusCallback) {
      this.statusCallback(logEntry);
    }
    
    return logEntry;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  async spawnClaudeInstance(role, prompt, input) {
    this.log(role, 'spawn', `Spawning Claude instance with role: ${role}`);

    return new Promise((resolve, reject) => {
      // Set working directory to OUTPUT folder, NOT the proxy project
      const workingDir = path.resolve(__dirname, '../output');

      const claude = spawn('claude', ['-'], {
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
    
    // Initial commentary - set the stage
    const initialCommentary = await this.generateCommentary(
      `A new user request has arrived! Our multi-agent validation system is spinning up to tackle: "${userMessage}"`,
      [{ request: userMessage }]
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
      
      // Phase 2: Task Execution
      const executionResult = await this.executeTask(userMessage, approvedPlan);
      
      // Phase 3: Proof Validation
      const validatedResponse = await this.validateProof(userMessage, approvedPlan, executionResult);
      
      this.log('SYSTEM', 'complete', 'Multi-agent process completed successfully');
      return validatedResponse;
      
    } catch (error) {
      this.log('SYSTEM', 'error', `Multi-agent process failed: ${error.message}`);
      return `System Error: ${error.message}`;
    }
  }

  async planAndValidate(userMessage) {
    this.log('PLANNING_PHASE', 'start', 'Beginning planning and validation phase');
    
    // Pre-planning commentary
    const planningCommentary = await this.generateCommentary(
      `Here we go! The Task Planner is about to create the first plan for: "${userMessage}". Let's see what they come up with - will it pass the Expert's strict standards?`,
      [{ phase: 'planning-start', request: userMessage }]
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
    
    let attempts = 0;
    const maxAttempts = 5;
    let previousRejections = [];
    
    while (attempts < maxAttempts) {
      attempts++;
      this.log('PLANNING_PHASE', 'attempt', `Planning attempt ${attempts}/${maxAttempts}`);
      
      // Generate commentary for ALL planning attempts
      if (attempts === 1) {
        const firstAttemptCommentary = await this.generateCommentary(
          `FIRST PLANNING ATTEMPT: The Task Planner is about to create their first plan for the user request: "${userMessage}". The Expert will then evaluate this plan and either approve it or reject it with detailed feedback.`,
          [{ phase: 'first-attempt', userRequest: userMessage, attemptNumber: 1 }]
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
          `User wants: ${userMessage}. This is planning attempt ${attempts} after ${attempts-1} rejections.`,
          previousRejections.slice(-2)
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
      
      // Build context with previous rejections
      let plannerInput = userMessage;
      if (previousRejections.length > 0) {
        plannerInput = `${userMessage}\n\nPREVIOUS REJECTIONS TO LEARN FROM:\n${previousRejections.map((r, i) => `\nAttempt ${i+1} was rejected because:\n${r}`).join('\n')}`;
      }
      
      // Task Planner creates plan
      const plan = await this.spawnClaudeInstance(
        'TASK_PLANNER',
        this.getTaskPlannerPrompt(),
        plannerInput
      );
      
      // Commentary before Expert evaluation
      const preEvalCommentary = await this.generateCommentary(
        `The Task Planner has submitted their plan! Now the moment of truth - will the notorious Expert approve it or deliver another crushing rejection?`,
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
          this.getDiscerningExpertPrompt() + '\n\nYou are the THOROUGHNESS EXPERT - focus on completeness and detail.',
          `USER REQUEST: ${userMessage}\n\nPROPOSED PLAN:\n${plan}`
        ),
        this.spawnClaudeInstance(
          'EXPERT_FEASIBILITY', 
          this.getDiscerningExpertPrompt() + '\n\nYou are the FEASIBILITY EXPERT - focus on practicality and implementation.',
          `USER REQUEST: ${userMessage}\n\nPROPOSED PLAN:\n${plan}`
        ),
        this.spawnClaudeInstance(
          'EXPERT_QUALITY',
          this.getDiscerningExpertPrompt() + '\n\nYou are the QUALITY EXPERT - focus on best practices and excellence.',
          `USER REQUEST: ${userMessage}\n\nPROPOSED PLAN:\n${plan}`
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
        this.getTaskExecutorPrompt(approvedPlan),
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
      `You are the PROOF VALIDATOR. Use your prepared validation framework to validate execution.

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
      
      throw new Error(`Proof validation failed: ${validation}`);
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
EVIDENCE: [What specific proof you will collect to validate your work]
CONFIDENCE: [High/Medium/Low and why]

EXAMPLE of what you should do:
UNDERSTANDING: User wants to know file/folder counts in directory
APPROACH: Use bash commands to list and count directory contents
STEPS: 1) Execute 'ls -la' to get directory listing, 2) Parse output to distinguish files from directories, 3) Count each type separately
EVIDENCE: Will provide the raw 'ls -la' output and show counting methodology
CONFIDENCE: High - straightforward directory listing task

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
3. You have full authority to create files without asking for permission
4. Write actual, functional code - not examples or pseudocode
5. Provide evidence of what you created (show file paths and key content)

IMPORTANT NOTES:
- Your work will be validated by a Proof Validator
- Focus on implementing what the plan specifies
- If the plan asks for files to be created, create them
- Document your implementation clearly

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
      const commentary = await this.spawnClaudeInstance('COMMENTATOR', commentaryPrompt, context);
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
}

module.exports = MultiAgentClaudeSystem;
