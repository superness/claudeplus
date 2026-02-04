#!/usr/bin/env node
/**
 * Area Owner Review Pipeline Runner
 *
 * Runs the area-owner-v1 pipeline against each feature document in docs/features/
 * to produce comprehensive multi-perspective reviews.
 *
 * Usage:
 *   node run-area-owner.js                              # Run all feature docs (3 concurrent)
 *   node run-area-owner.js --concurrency=2              # Run with 2 concurrent
 *   node run-area-owner.js --features="rpc,cli"         # Run specific features (partial match)
 *   node run-area-owner.js --retry-failed               # Retry last run's failed features
 *   node run-area-owner.js --list-failed                # List last run's failed features
 *   node run-area-owner.js --list                       # List all available feature docs
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/area-owner-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const FEATURES_DIR = path.join(WORKING_DIR, 'docs/features');
const OUTPUT_DIR = path.join(WORKING_DIR, 'docs/reviews');
const FAILED_FILE = path.join(__dirname, '.last-failed-area-owner.json');
const STAGGER_DELAY_MS = 2000;

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '3');
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_FAILED = hasFlag('--list-failed');
const LIST_FEATURES = hasFlag('--list');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Get all feature documents
 */
function getFeatureDocs() {
  if (!fs.existsSync(FEATURES_DIR)) {
    console.error(`${colors.red}Error: Features directory not found: ${FEATURES_DIR}${colors.reset}`);
    console.error('Run the feature-documenter pipeline first to generate feature docs.');
    process.exit(1);
  }

  const files = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('_FEATURE_DOC.md'))
    .map(f => ({
      filename: f,
      path: path.join(FEATURES_DIR, f),
      name: f.replace('_FEATURE_DOC.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      id: f.replace('_FEATURE_DOC.md', ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return files;
}

/**
 * Load failed features from last run
 */
function loadFailedFeatures() {
  try {
    if (fs.existsSync(FAILED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
      return data.features || [];
    }
  } catch (e) {
    console.error('Could not load failed features:', e.message);
  }
  return [];
}

/**
 * Save failed features for retry
 */
function saveFailedFeatures(features, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      features,
      errors,
    };
    fs.writeFileSync(FAILED_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed features:', e.message);
  }
}

// Handle --list
if (LIST_FEATURES) {
  const docs = getFeatureDocs();
  console.log(`${colors.bright}Available Feature Documents (${docs.length}):${colors.reset}\n`);
  docs.forEach((doc, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${doc.name}`);
    console.log(`      ${colors.dim}${doc.filename}${colors.reset}`);
  });
  process.exit(0);
}

// Handle --list-failed
if (LIST_FAILED) {
  const failed = loadFailedFeatures();
  if (failed.length === 0) {
    console.log('No failed features from last run.');
  } else {
    console.log('Failed features from last run:');
    failed.forEach(f => console.log(`  - ${f}`));
    console.log(`\nRun with --retry-failed to retry these features.`);
  }
  process.exit(0);
}

// Determine which features to run
const allDocs = getFeatureDocs();
let FEATURES;

if (RETRY_FAILED) {
  const failedIds = loadFailedFeatures();
  if (failedIds.length === 0) {
    console.log('No failed features to retry.');
    process.exit(0);
  }
  FEATURES = allDocs.filter(d => failedIds.includes(d.id));
  console.log(`Retrying ${FEATURES.length} failed features...`);
} else if (getArg('--features=')) {
  const patterns = getArg('--features=').toLowerCase().split(',').map(s => s.trim());
  FEATURES = allDocs.filter(d =>
    patterns.some(p => d.id.toLowerCase().includes(p) || d.name.toLowerCase().includes(p))
  );
  if (FEATURES.length === 0) {
    console.error(`${colors.red}No features matched the patterns: ${patterns.join(', ')}${colors.reset}`);
    console.log('Use --list to see available feature documents.');
    process.exit(1);
  }
} else {
  FEATURES = allDocs;
}

// Pipeline state tracking
const pipelineStates = new Map();
const completedPipelines = [];
const failedPipelines = [];
const failedErrors = new Map();
let activeCount = 0;
let queueIndex = 0;

// Stats
const startTime = Date.now();
let totalStagesCompleted = 0;

// Stage names for the area-owner pipeline
const STAGE_NAMES = [
  'Feature Context Loading',
  'Functionality Review',
  'Performance Review',
  'Vision & Spec Review',
  'UX Review',
  'Accessibility Review',
  'Quality Review',
  'Security Review',
  'Synthesis',
];

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Format duration in human readable form
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Categorize error for display
 */
function categorizeError(error) {
  if (!error) return 'Unknown error';
  if (error.includes('EPIPE')) return 'EPIPE: Process pipe broken';
  if (error.includes('Connection closed')) return 'Connection lost';
  if (error.includes('timeout')) return 'Timeout';
  return error.substring(0, 60);
}

/**
 * Render progress display
 */
function renderProgress() {
  clearScreen();

  const elapsed = formatDuration(Date.now() - startTime);
  const completed = completedPipelines.length;
  const failed = failedPipelines.length;
  const total = FEATURES.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  // Header
  console.log(`${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║${colors.reset}            ${colors.bright}Area Owner Review Pipeline Runner${colors.reset}                   ${colors.magenta}║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  // Progress bar
  const barWidth = 50;
  const completedWidth = Math.round((completed / total) * barWidth);
  const failedWidth = Math.round((failed / total) * barWidth);
  const emptyWidth = barWidth - completedWidth - failedWidth;
  const bar = `${colors.green}${'█'.repeat(completedWidth)}${colors.red}${'█'.repeat(failedWidth)}${colors.dim}${'░'.repeat(Math.max(0, emptyWidth))}${colors.reset}`;

  console.log(`  Progress: [${bar}] ${progress}%`);
  console.log();

  // Stats
  console.log(`  ${colors.bright}Stats:${colors.reset}`);
  console.log(`    Elapsed:     ${colors.cyan}${elapsed}${colors.reset}`);
  console.log(`    Active:      ${colors.yellow}${activeCount}${colors.reset} / ${MAX_CONCURRENCY}`);
  console.log(`    Completed:   ${colors.green}${completed}${colors.reset} / ${total}`);
  console.log(`    Failed:      ${colors.red}${failed}${colors.reset}`);
  console.log(`    Reviews:     ${colors.blue}${totalStagesCompleted}${colors.reset} stages`);
  if (RETRY_FAILED) {
    console.log(`    ${colors.magenta}Mode: Retry Failed${colors.reset}`);
  }
  console.log();

  // Active pipelines
  console.log(`  ${colors.bright}Active Reviews:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  let hasActive = false;
  for (const [featureId, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const feature = FEATURES.find(f => f.id === featureId);
      const name = feature?.name || featureId;
      const stageInfo = state.currentStage ? ` → ${state.currentStage}` : '';
      const duration = formatDuration(Date.now() - state.startTime);
      const stageNum = state.stagesCompleted + 1;
      console.log(`    ${colors.yellow}●${colors.reset} ${name.substring(0, 30).padEnd(30)} [${duration}] (${stageNum}/9)${stageInfo.substring(0, 20)}`);
    }
  }

  if (!hasActive) {
    console.log(`    ${colors.dim}(none)${colors.reset}`);
  }
  console.log();

  // Recent completions
  console.log(`  ${colors.bright}Recent Completions:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  const recentCompleted = completedPipelines.slice(-4);
  if (recentCompleted.length === 0) {
    console.log(`    ${colors.dim}(none yet)${colors.reset}`);
  } else {
    for (const featureId of recentCompleted) {
      const state = pipelineStates.get(featureId);
      const feature = FEATURES.find(f => f.id === featureId);
      const name = feature?.name || featureId;
      const duration = state ? formatDuration(state.endTime - state.startTime) : '?';
      console.log(`    ${colors.green}✓${colors.reset} ${name.substring(0, 45).padEnd(45)} [${duration}]`);
    }
  }
  console.log();

  // Failed pipelines
  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed (${failedPipelines.length}):${colors.reset}`);
    console.log(`  ${'─'.repeat(66)}`);
    const recentFailed = failedPipelines.slice(-3);
    for (const featureId of recentFailed) {
      const state = pipelineStates.get(featureId);
      const feature = FEATURES.find(f => f.id === featureId);
      const name = feature?.name || featureId;
      const error = categorizeError(state?.error);
      console.log(`    ${colors.red}✗${colors.reset} ${name.substring(0, 35).padEnd(35)} ${colors.dim}${error}${colors.reset}`);
    }
    if (failedPipelines.length > 3) {
      console.log(`    ${colors.dim}... and ${failedPipelines.length - 3} more${colors.reset}`);
    }
    console.log();
  }

  // Queue status
  const queued = FEATURES.slice(queueIndex);
  const inQueue = queued.length - activeCount;
  if (inQueue > 0) {
    console.log(`  ${colors.bright}Queued:${colors.reset} ${inQueue} remaining`);
    const preview = queued.slice(activeCount, activeCount + 3).map(f => f.name.substring(0, 20)).join(', ');
    console.log(`    ${colors.dim}${preview}${inQueue > 3 ? '...' : ''}${colors.reset}`);
  }

  console.log();
  console.log(`  ${colors.dim}Press Ctrl+C to stop | Pipeline: area-owner-v1${colors.reset}`);
}

/**
 * Load pipeline template
 */
function loadTemplate() {
  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return JSON.parse(templateContent);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Create a WebSocket connection and run a pipeline
 */
function runPipeline(feature, template) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `area-owner-${feature.id}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Initialize state
    pipelineStates.set(feature.id, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });

    // Timeout after 90 minutes (area-owner has many stages)
    const timeout = setTimeout(() => {
      const state = pipelineStates.get(feature.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 90 minutes';
        failedPipelines.push(feature.id);
        failedErrors.set(feature.id, state.error);
        ws.close();
        markResolved({ feature, success: false, error: 'Timeout' });
      }
    }, 90 * 60 * 1000);

    ws.on('open', () => {
      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Area Owner Review: ${feature.name}`,
        },
        userContext: `
Review the "${feature.name}" feature from multiple expert perspectives.

Feature document path: ${feature.path}
Feature name: ${feature.name}
Output directory: ${OUTPUT_DIR}

Instructions:
1. Load and understand the feature document at ${feature.path}
2. Review from each perspective:
   - Functionality: completeness, correctness, API design, integration
   - Performance: complexity, resources, scalability, optimization
   - Vision: alignment with Swimchain vision, spec compliance, architecture
   - UX: usability, discoverability, efficiency, delight
   - Accessibility: WCAG compliance (perceivable, operable, understandable, robust)
   - Quality: code quality, test coverage, error handling, reliability
   - Security: auth, crypto, input validation, data protection
3. Synthesize all reviews into a prioritized action plan
4. Write the final review to: ${OUTPUT_DIR}/${feature.id}_AREA_OWNER_REVIEW.md

Each reviewer should score their area out of 100 and provide actionable recommendations.
`,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(feature.id);

        switch (msg.type) {
          case 'pipeline-stage-update':
          case 'stage-started':
            if (state) {
              state.currentStage = msg.stageName || msg.stage || 'unknown';
            }
            renderProgress();
            break;

          case 'stage-completed':
            if (state) {
              state.stagesCompleted++;
              totalStagesCompleted++;
            }
            renderProgress();
            break;

          case 'pipeline-complete':
            clearTimeout(timeout);
            if (state) {
              state.status = 'completed';
              state.endTime = Date.now();
            }
            completedPipelines.push(feature.id);
            ws.close();
            markResolved({ feature, success: true });
            break;

          case 'pipeline-error':
            clearTimeout(timeout);
            if (state) {
              state.status = 'failed';
              state.endTime = Date.now();
              state.error = msg.content || 'Unknown error';
            }
            failedPipelines.push(feature.id);
            failedErrors.set(feature.id, state?.error || 'Unknown error');
            ws.close();
            markResolved({ feature, success: false, error: msg.content });
            break;

          case 'system-status':
          case 'agent-output':
            renderProgress();
            break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      const state = pipelineStates.get(feature.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(feature.id);
        failedErrors.set(feature.id, err.message);
      }
      markResolved({ feature, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      const state = pipelineStates.get(feature.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed unexpectedly';
        failedPipelines.push(feature.id);
        failedErrors.set(feature.id, state.error);
        markResolved({ feature, success: false, error: 'Connection closed' });
      }
    });
  });
}

/**
 * Process the queue with concurrency limit and staggered starts
 */
async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < FEATURES.length || promises.size > 0) {
    // Start new pipelines up to concurrency limit
    while (promises.size < MAX_CONCURRENCY && queueIndex < FEATURES.length) {
      const feature = FEATURES[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(feature, template)
        .finally(() => {
          activeCount--;
          promises.delete(feature.id);
          renderProgress();
        });

      promises.set(feature.id, promise);
      renderProgress();

      // Stagger start
      if (queueIndex < FEATURES.length && promises.size < MAX_CONCURRENCY) {
        await sleep(STAGGER_DELAY_MS);
      }
    }

    // Wait for at least one to complete
    if (promises.size > 0) {
      await Promise.race(promises.values());
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log(`${colors.bright}Area Owner Review Pipeline Runner${colors.reset}`);
  console.log(`Features: ${FEATURES.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  console.log(`Stagger delay: ${STAGGER_DELAY_MS}ms`);
  if (RETRY_FAILED) {
    console.log(`${colors.magenta}Mode: Retrying failed features${colors.reset}`);
  }
  console.log();

  // Ensure output directory
  ensureOutputDir();
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log();

  // Check proxy
  console.log('Checking proxy connection...');

  try {
    const testWs = new WebSocket(PROXY_URL);
    await new Promise((resolve, reject) => {
      testWs.on('open', () => {
        testWs.close();
        resolve();
      });
      testWs.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  } catch (err) {
    console.error(`${colors.red}Error: Cannot connect to proxy at ${PROXY_URL}${colors.reset}`);
    console.error('Make sure the Claude Plus proxy is running: node proxy/server.js');
    process.exit(1);
  }

  console.log(`${colors.green}Proxy connected!${colors.reset}`);
  console.log();

  // Load template
  console.log('Loading template...');
  const template = loadTemplate();
  console.log(`${colors.green}Template loaded: ${template.name}${colors.reset}`);
  console.log();

  // Initialize states
  for (const feature of FEATURES) {
    pipelineStates.set(feature.id, {
      status: 'queued',
      startTime: null,
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });
  }

  // Start processing
  console.log('Starting reviews...');
  await sleep(1000);

  renderProgress();

  await processQueue(template);

  // Save failed
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Unknown';
    });
    saveFailedFeatures(failedPipelines, errors);
  } else {
    try {
      if (fs.existsSync(FAILED_FILE)) {
        fs.unlinkSync(FAILED_FILE);
      }
    } catch (e) {}
  }

  // Final summary
  clearScreen();
  const totalTime = formatDuration(Date.now() - startTime);

  console.log(`${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║${colors.reset}                    ${colors.bright}Area Owner Reviews Complete${colors.reset}                   ${colors.magenta}║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`  Total Time:   ${colors.cyan}${totalTime}${colors.reset}`);
  console.log(`  Completed:    ${colors.green}${completedPipelines.length}${colors.reset}`);
  console.log(`  Failed:       ${colors.red}${failedPipelines.length}${colors.reset}`);
  console.log(`  Total Stages: ${colors.blue}${totalStagesCompleted}${colors.reset}`);
  console.log();

  if (completedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.green}Completed Reviews:${colors.reset}`);
    for (const featureId of completedPipelines) {
      const feature = FEATURES.find(f => f.id === featureId);
      console.log(`    ${colors.green}✓${colors.reset} ${feature?.name || featureId}`);
    }
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed Reviews:${colors.reset}`);
    for (const featureId of failedPipelines) {
      const feature = FEATURES.find(f => f.id === featureId);
      const error = categorizeError(failedErrors.get(featureId));
      console.log(`    ${colors.red}✗${colors.reset} ${feature?.name || featureId}`);
      console.log(`      ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
    console.log(`  ${colors.yellow}To retry failed:${colors.reset}`);
    console.log(`    node run-area-owner.js --retry-failed`);
    console.log();
  }

  console.log(`  Output: ${colors.cyan}${OUTPUT_DIR}${colors.reset}`);
  console.log();

  process.exit(failedPipelines.length > 0 ? 1 : 0);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log();
  console.log(`${colors.yellow}Interrupted by user${colors.reset}`);
  console.log(`Completed: ${completedPipelines.length}, Failed: ${failedPipelines.length}`);

  const remaining = FEATURES.slice(queueIndex).map(f => f.id);
  const allFailed = [...failedPipelines, ...remaining.filter(id => !completedPipelines.includes(id))];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Interrupted';
    });
    saveFailedFeatures(allFailed, errors);
    console.log(`Saved ${allFailed.length} incomplete reviews for --retry-failed`);
  }

  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
