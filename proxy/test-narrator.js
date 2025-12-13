#!/usr/bin/env node

/**
 * Test script to generate story report for an existing pipeline execution
 * Usage: node test-narrator.js [pipeline-id]
 */

const fs = require('fs');
const path = require('path');
const InfographicNarrator = require('./infographic-narrator');

// Get pipeline ID from command line or use latest
const pipelineIdArg = process.argv[2];

// Find the most recent pipeline run
function findLatestPipelineRun() {
  const infographicsDir = path.join(__dirname, 'pipeline-infographics');

  if (!fs.existsSync(infographicsDir)) {
    console.error('No pipeline-infographics directory found');
    process.exit(1);
  }

  // Get all pipeline directories
  const pipelineDirs = fs.readdirSync(infographicsDir)
    .filter(name => {
      const dirPath = path.join(infographicsDir, name);
      return fs.statSync(dirPath).isDirectory();
    });

  if (pipelineDirs.length === 0) {
    console.error('No pipeline directories found');
    process.exit(1);
  }

  // If pipeline ID specified, use it
  if (pipelineIdArg) {
    const targetDir = path.join(infographicsDir, pipelineIdArg);
    if (!fs.existsSync(targetDir)) {
      console.error(`Pipeline ID not found: ${pipelineIdArg}`);
      console.log('Available pipelines:', pipelineDirs.join(', '));
      process.exit(1);
    }
    return { pipelineId: pipelineIdArg, pipelineDir: targetDir };
  }

  // Otherwise, use the most recent pipeline
  const mostRecentPipeline = pipelineDirs.sort((a, b) => {
    const aPath = path.join(infographicsDir, a);
    const bPath = path.join(infographicsDir, b);
    return fs.statSync(bPath).mtime - fs.statSync(aPath).mtime;
  })[0];

  return {
    pipelineId: mostRecentPipeline,
    pipelineDir: path.join(infographicsDir, mostRecentPipeline)
  };
}

// Find the most recent run for a pipeline
function findLatestRun(pipelineDir) {
  const runDirs = fs.readdirSync(pipelineDir)
    .filter(name => name.startsWith('run_'))
    .map(runDir => {
      const runPath = path.join(pipelineDir, runDir);
      return {
        name: runDir,
        path: runPath,
        mtime: fs.statSync(runPath).mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (runDirs.length === 0) {
    console.error('No run directories found in', pipelineDir);
    process.exit(1);
  }

  return runDirs[0];
}

// Load pipeline data from execution log
function loadPipelineData(pipelineId) {
  const executionLogPath = path.join(__dirname, 'pipelines', `${pipelineId}_execution.json`);

  if (!fs.existsSync(executionLogPath)) {
    console.error('Execution log not found:', executionLogPath);
    process.exit(1);
  }

  const executionLog = JSON.parse(fs.readFileSync(executionLogPath, 'utf8'));
  const events = executionLog.events || [];

  // Extract pipeline metadata from events
  const initEvent = events.find(e => e.eventType === 'pipeline_initialized');
  const completeEvent = events.find(e => e.eventType === 'pipeline_completed');

  if (!initEvent) {
    console.error('Pipeline initialization event not found');
    process.exit(1);
  }

  // Build stages array from events
  const stages = [];
  const stageMap = new Map();

  events.forEach(event => {
    if (event.eventType === 'stage_started') {
      const stage = {
        id: event.stageId,
        name: event.stageName,
        agent: event.agent,
        type: event.stageType,
        description: event.description,
        startTime: event.timestamp,
        executionNumber: event.executionNumber,
        status: 'running'
      };
      stageMap.set(`${event.stageId}_${event.executionNumber}`, stage);
      stages.push(stage);
    } else if (event.eventType === 'stage_completed') {
      const key = `${event.stageId}_${event.executionNumber}`;
      const stage = stageMap.get(key);
      if (stage) {
        stage.status = 'completed';
        stage.endTime = event.timestamp;
        stage.output = event.output;
        stage.outputLength = event.outputLength;
        stage.prompt = event.prompt;
        stage.promptLength = event.promptLength;
        stage.duration = new Date(event.timestamp).getTime() - new Date(stage.startTime).getTime();
      }
    } else if (event.eventType === 'stage_error') {
      const key = `${event.stageId}_${event.executionNumber}`;
      const stage = stageMap.get(key);
      if (stage) {
        stage.status = 'error';
        stage.endTime = event.timestamp;
        stage.error = event.error;
        stage.stack = event.stack;
        stage.duration = new Date(event.timestamp).getTime() - new Date(stage.startTime).getTime();
      }
    } else if (event.eventType === 'stage_routed') {
      const key = `${event.stageId}_${event.executionNumber}`;
      const stage = stageMap.get(key);
      if (stage) {
        stage.routedTo = event.toStage;
        stage.routingDecision = event.decision;
        stage.routingReason = event.reasoning;
      }
    }
  });

  const startTime = new Date(initEvent.timestamp).getTime();
  const endTime = completeEvent ? new Date(completeEvent.timestamp).getTime() : Date.now();

  return {
    name: initEvent.pipelineName || pipelineId,
    id: pipelineId,
    duration: endTime - startTime,
    totalStages: stages.length,
    completedStages: stages.filter(s => s.status === 'completed').length,
    errorCount: stages.filter(s => s.status === 'error').length,
    workingDir: initEvent.workingDir || '/unknown',
    status: completeEvent ? 'completed' : 'running',
    stages: stages
  };
}

async function main() {
  console.log('🎭 Testing InfographicNarrator...\n');

  // Find pipeline and run
  const { pipelineId, pipelineDir } = findLatestPipelineRun();
  const latestRun = findLatestRun(pipelineDir);

  console.log(`Pipeline ID: ${pipelineId}`);
  console.log(`Run: ${latestRun.name}`);
  console.log(`Run Directory: ${latestRun.path}\n`);

  // Load pipeline data
  console.log('Loading pipeline execution data...');
  const pipelineData = loadPipelineData(pipelineId);

  console.log(`Pipeline: ${pipelineData.name}`);
  console.log(`Total Stages: ${pipelineData.totalStages}`);
  console.log(`Completed: ${pipelineData.completedStages}`);
  console.log(`Errors: ${pipelineData.errorCount}`);
  console.log(`Duration: ${(pipelineData.duration / 1000).toFixed(1)}s\n`);

  // Create narrator and generate story
  const narrator = new InfographicNarrator(latestRun.path);

  console.log('Generating AI story report...\n');
  console.log('This will:');
  console.log('1. Collect all agent prompts and outputs');
  console.log('2. Call Claude Code with the infographic_narrator agent');
  console.log('3. Generate a narrative JSON structure');
  console.log('4. Create a beautiful HTML story report\n');

  try {
    const result = await narrator.generateStoryReport(pipelineData);

    if (result.success) {
      console.log('\n✅ Story report generated successfully!\n');
      console.log(`Narrative JSON: ${result.narrativePath}`);
      console.log(`Story HTML: ${result.storyPath}\n`);
      console.log('Open story.html in your browser to view the magical report!');
    } else {
      console.error('\n❌ Story report generation failed:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

main();
