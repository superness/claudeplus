const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Uses Claude Code to generate beautiful story-driven narratives from pipeline execution data
 * Creates magical, accessible reports that tell the story of what happened
 */
class InfographicNarrator {
  constructor(runDirectory) {
    this.runDir = runDirectory;
    this.agentOutputsDir = path.join(runDirectory, 'agent-outputs');
    this.dataDir = path.join(runDirectory, 'data');
    this.narrativePath = path.join(runDirectory, 'narrative.json');
    this.storyReportPath = path.join(runDirectory, 'story.html');
  }

  /**
   * Generate HTML report using Claude Code with the infographic_narrator agent
   */
  async generateHTMLReport(pipelineData) {
    console.log('[InfographicNarrator] Generating AI HTML report for pipeline execution...');

    // Read all agent outputs
    const agentData = this.collectAgentData();

    // Build comprehensive prompt for the narrator agent
    const narratorPrompt = this.buildNarratorPrompt(pipelineData, agentData);

    // Call Claude Code with the infographic_narrator agent
    const htmlReport = await this.callClaudeNarrator(narratorPrompt);

    // Save HTML report directly
    fs.writeFileSync(this.storyReportPath, htmlReport);

    console.log('[InfographicNarrator] HTML report generated and saved to:', this.storyReportPath);

    return htmlReport;
  }

  /**
   * Collect all agent prompt/output data from the run directory
   */
  collectAgentData() {
    const agentData = [];

    if (!fs.existsSync(this.agentOutputsDir)) {
      console.warn('[InfographicNarrator] No agent-outputs directory found');
      return agentData;
    }

    const files = fs.readdirSync(this.agentOutputsDir);

    // Group by stage and execution number
    const stages = {};
    files.forEach(file => {
      const match = file.match(/^(.+?)_(\d+)_(prompt|output)\.txt$/);
      if (match) {
        const [, stageId, execNum, type] = match;
        const key = `${stageId}_${execNum}`;

        if (!stages[key]) {
          stages[key] = { stageId, executionNumber: parseInt(execNum), prompt: '', output: '' };
        }

        const content = fs.readFileSync(path.join(this.agentOutputsDir, file), 'utf8');
        stages[key][type] = content;
      }
    });

    // Convert to array and sort by execution number
    return Object.values(stages).sort((a, b) => a.executionNumber - b.executionNumber);
  }

  /**
   * Build a comprehensive prompt for the narrator agent
   */
  buildNarratorPrompt(pipelineData, agentData) {
    const prompt = `# Generate HTML Report for Pipeline Execution

Analyze this pipeline execution data and create a COMPLETE, BEAUTIFUL HTML report.

## Pipeline Metadata
- **Pipeline Name**: ${pipelineData.name}
- **Pipeline ID**: ${pipelineData.id}
- **Total Duration**: ${pipelineData.duration}ms (${(pipelineData.duration / 1000).toFixed(1)}s)
- **Total Stages**: ${pipelineData.totalStages}
- **Completed Stages**: ${pipelineData.completedStages}
- **Errors**: ${pipelineData.errorCount}
- **Working Directory**: ${pipelineData.workingDir}
- **Status**: ${pipelineData.status}

## Stage Execution Timeline
${pipelineData.stages.map((stage, idx) => `
### Stage ${idx + 1}: ${stage.name} (Execution #${stage.executionNumber})
- **Agent**: ${stage.agent}
- **Status**: ${stage.status}
- **Duration**: ${stage.duration ? (stage.duration / 1000).toFixed(1) + 's' : 'N/A'}
- **Prompt Size**: ${stage.promptLength || 0} characters
- **Output Size**: ${stage.outputLength || 0} characters
${stage.routingDecision ? `- **Routing Decision**: ${stage.routingDecision} → ${stage.routedTo || 'Pipeline Complete'}` : ''}
${stage.routingReason ? `- **Routing Reason**: ${stage.routingReason}` : ''}
${stage.error ? `- **Error**: ${stage.error}` : ''}
`).join('\n')}

## Agent Execution Details

${agentData.map((data, idx) => `
### Execution ${idx + 1}: ${data.stageId} (#${data.executionNumber})

**Agent Prompt** (${data.prompt.length} characters):
\`\`\`
${data.prompt.substring(0, 3000)}${data.prompt.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

**Agent Output** (${data.output.length} characters):
\`\`\`
${data.output.substring(0, 3000)}${data.output.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n---\n')}

## Your Task

Create a complete HTML report (<!DOCTYPE html> through </html>) that:
1. Tells the story of what happened in this pipeline execution
2. Uses design and structure that fits this specific execution
3. Communicates clearly to product managers and developers
4. Includes all important data (timings, decisions, errors, outcomes)
5. Is visually engaging and easy to navigate

**Remember**:
- Choose your own structure (timeline? dashboard? narrative? technical report?)
- Design your own styling (colors, layout, typography, animations)
- Decide what to highlight based on what happened (retries? errors? successes?)
- Output ONLY the complete HTML document - no explanations, no commentary
- Make it beautiful and functional

Generate the complete HTML report now:`;

    return prompt;
  }

  /**
   * Call Claude Code with the infographic_narrator agent
   */
  async callClaudeNarrator(prompt) {
    return new Promise((resolve, reject) => {
      console.log('[InfographicNarrator] Spawning Claude Code process...');

      // Load narrator agent config
      const narratorAgent = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../agents/infographic_narrator.json'), 'utf8')
      );

      // Build full prompt with agent context
      const fullPrompt = `${narratorAgent.systemPrompt}\n\n---\n\n${prompt}`;

      // Spawn Claude Code process - using proven pattern from server.js:1668
      const claude = spawn('claude', ['--permission-mode', 'bypassPermissions', '-'], {
        cwd: this.runDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      let output = '';
      let errorOutput = '';

      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log('[InfographicNarrator] Claude stdout:', chunk);
        output += chunk;
      });

      claude.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.log('[InfographicNarrator] Claude stderr:', chunk);
        errorOutput += chunk;
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          console.error('[InfographicNarrator] Claude process failed with code:', code);
          console.error('[InfographicNarrator] Error output:', errorOutput);
          reject(new Error(`Claude process exited with code ${code}`));
          return;
        }

        try {
          // Extract HTML from output (should be complete HTML document)
          // Claude might include some preamble/commentary, so we extract from <!DOCTYPE to </html>
          const htmlMatch = output.match(/<!DOCTYPE[\s\S]*<\/html>/i);
          if (!htmlMatch) {
            console.error('[InfographicNarrator] No HTML found in output:', output);
            reject(new Error('Failed to extract HTML from Claude output'));
            return;
          }

          const htmlReport = htmlMatch[0];
          resolve(htmlReport);
        } catch (err) {
          console.error('[InfographicNarrator] Failed to extract HTML from Claude output:', err);
          console.error('[InfographicNarrator] Raw output:', output);
          reject(err);
        }
      });

      // Send prompt to Claude via stdin
      console.log('[InfographicNarrator] Sending prompt to Claude stdin...');
      claude.stdin.write(fullPrompt);
      claude.stdin.end();
    });
  }


  /**
   * Main entry point: Generate complete story report
   */
  async generateStoryReport(pipelineData) {
    try {
      // Generate complete HTML report using Claude Code
      const htmlReport = await this.generateHTMLReport(pipelineData);

      return {
        storyPath: this.storyReportPath,
        success: true
      };
    } catch (err) {
      console.error('[InfographicNarrator] Failed to generate story report:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = InfographicNarrator;
