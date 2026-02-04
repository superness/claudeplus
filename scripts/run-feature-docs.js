#!/usr/bin/env node
/**
 * Feature Documentation Pipeline Runner
 *
 * Runs the feature-documenter-v1 pipeline for each section in MASTER_FEATURES.md
 * with configurable concurrent pipelines and real-time progress updates.
 *
 * Usage:
 *   node run-feature-docs.js                           # Run all sections (3 concurrent)
 *   node run-feature-docs.js --concurrency=2           # Run with 2 concurrent
 *   node run-feature-docs.js --sections="RPC API,CLI"  # Run specific sections
 *   node run-feature-docs.js --retry-failed            # Retry last run's failed sections
 *   node run-feature-docs.js --list-failed             # List last run's failed sections
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/feature-documenter-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const FAILED_SECTIONS_FILE = path.join(__dirname, '.last-failed-sections.json');
const STAGGER_DELAY_MS = 2000; // Delay between starting new pipelines

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '3');
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_FAILED = hasFlag('--list-failed');

// All sections from MASTER_FEATURES.md
const ALL_SECTIONS = [
  'Identity & Cryptography',
  'Proof-of-Work Systems',
  'Block Formation & Consensus',
  'Content & Decay Engine',
  'Storage Layer',
  'Network & Transport',
  'Synchronization',
  'Sponsorship & Sybil Resistance',
  'Spam & Reputation',
  'Private Spaces & Encryption',
  'Engagement & Social',
  'RPC API',
  'CLI Interface',
  'Frontend SDK',
  'React SDK',
  'WASM Bindings',
  'DHT & Peer Discovery',
  'Fork System',
  'Blocklist Protocol',
  'Device Constraints',
  'Seeding & Availability',
  'API Layer',
  'Client Applications',
  'Mobile Platform',
  'Desktop Platform',
];

// Load failed sections from last run
function loadFailedSections() {
  try {
    if (fs.existsSync(FAILED_SECTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_SECTIONS_FILE, 'utf8'));
      return data.sections || [];
    }
  } catch (e) {
    console.error('Could not load failed sections:', e.message);
  }
  return [];
}

// Save failed sections for retry
function saveFailedSections(sections, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      sections,
      errors,
    };
    fs.writeFileSync(FAILED_SECTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed sections:', e.message);
  }
}

// Handle --list-failed
if (LIST_FAILED) {
  const failed = loadFailedSections();
  if (failed.length === 0) {
    console.log('No failed sections from last run.');
  } else {
    console.log('Failed sections from last run:');
    failed.forEach(s => console.log(`  - ${s}`));
    console.log(`\nRun with --retry-failed to retry these sections.`);
  }
  process.exit(0);
}

// Determine which sections to run
let SECTIONS;
if (RETRY_FAILED) {
  SECTIONS = loadFailedSections();
  if (SECTIONS.length === 0) {
    console.log('No failed sections to retry.');
    process.exit(0);
  }
  console.log(`Retrying ${SECTIONS.length} failed sections...`);
} else if (getArg('--sections=')) {
  SECTIONS = getArg('--sections=').split(',').map(s => s.trim());
} else {
  SECTIONS = ALL_SECTIONS;
}

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
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

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
  if (error.includes('EPIPE')) return 'EPIPE: Process pipe broken (overload)';
  if (error.includes('--include-partial-messages')) return 'CLI flag error (proxy issue)';
  if (error.includes('Connection closed')) return 'Connection lost';
  if (error.includes('timeout')) return 'Timeout';
  // Truncate long errors
  return error.substring(0, 80);
}

/**
 * Render progress display
 */
function renderProgress() {
  clearScreen();

  const elapsed = formatDuration(Date.now() - startTime);
  const completed = completedPipelines.length;
  const failed = failedPipelines.length;
  const total = SECTIONS.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  // Header
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}        ${colors.bright}Feature Documentation Pipeline Runner${colors.reset}                   ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
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
  console.log(`    Stages:      ${colors.blue}${totalStagesCompleted}${colors.reset} completed`);
  if (RETRY_FAILED) {
    console.log(`    ${colors.magenta}Mode: Retry Failed${colors.reset}`);
  }
  console.log();

  // Active pipelines
  console.log(`  ${colors.bright}Active Pipelines:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  let hasActive = false;
  for (const [section, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const stageInfo = state.currentStage ? ` → ${state.currentStage}` : '';
      const duration = formatDuration(Date.now() - state.startTime);
      console.log(`    ${colors.yellow}●${colors.reset} ${section.substring(0, 35).padEnd(35)} [${duration}]${stageInfo}`);
    }
  }

  if (!hasActive) {
    console.log(`    ${colors.dim}(none)${colors.reset}`);
  }
  console.log();

  // Recent completions
  console.log(`  ${colors.bright}Recent Completions:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  const recentCompleted = completedPipelines.slice(-5);
  if (recentCompleted.length === 0) {
    console.log(`    ${colors.dim}(none yet)${colors.reset}`);
  } else {
    for (const section of recentCompleted) {
      const state = pipelineStates.get(section);
      const duration = state ? formatDuration(state.endTime - state.startTime) : '?';
      console.log(`    ${colors.green}✓${colors.reset} ${section.substring(0, 45).padEnd(45)} [${duration}]`);
    }
  }
  console.log();

  // Failed pipelines (if any)
  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed (${failedPipelines.length}):${colors.reset}`);
    console.log(`  ${'─'.repeat(66)}`);
    const recentFailed = failedPipelines.slice(-3);
    for (const section of recentFailed) {
      const state = pipelineStates.get(section);
      const error = categorizeError(state?.error);
      console.log(`    ${colors.red}✗${colors.reset} ${section.substring(0, 35).padEnd(35)} ${colors.dim}${error}${colors.reset}`);
    }
    if (failedPipelines.length > 3) {
      console.log(`    ${colors.dim}... and ${failedPipelines.length - 3} more${colors.reset}`);
    }
    console.log();
  }

  // Queue status
  const queued = SECTIONS.slice(queueIndex);
  const inQueue = queued.length - activeCount;
  if (inQueue > 0) {
    console.log(`  ${colors.bright}Queued:${colors.reset} ${inQueue} remaining`);
    const preview = queued.slice(activeCount, activeCount + 3).map(s => s.substring(0, 20)).join(', ');
    console.log(`    ${colors.dim}${preview}${inQueue > 3 ? '...' : ''}${colors.reset}`);
  }

  console.log();
  console.log(`  ${colors.dim}Press Ctrl+C to stop | Stagger: ${STAGGER_DELAY_MS}ms${colors.reset}`);
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
 * Create a WebSocket connection and run a pipeline
 */
function runPipeline(section, template) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `feature-doc-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Initialize state
    pipelineStates.set(section, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });

    // Timeout after 30 minutes per pipeline
    const timeout = setTimeout(() => {
      const state = pipelineStates.get(section);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 30 minutes';
        failedPipelines.push(section);
        failedErrors.set(section, state.error);
        ws.close();
        markResolved({ section, success: false, error: 'Timeout' });
      }
    }, 30 * 60 * 1000);

    ws.on('open', () => {
      // Send pipeline execution request
      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Feature Doc: ${section}`,
        },
        userContext: `
Document the "${section}" section from the Swimchain Master Features document.

Master features document: /mnt/c/github/swimchain/docs/MASTER_FEATURES.md
Output directory: /mnt/c/github/swimchain/docs/features/

Section to document: ${section}

Instructions:
1. Read the MASTER_FEATURES.md document and find the "${section}" section
2. Explore the codebase to find all related implementations
3. Extract detailed feature information
4. Identify gaps between documented and implemented features
5. Write comprehensive documentation to docs/features/${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_FEATURE_DOC.md
6. Review for quality
`,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(section);

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
            completedPipelines.push(section);
            ws.close();
            markResolved({ section, success: true });
            break;

          case 'pipeline-error':
            clearTimeout(timeout);
            if (state) {
              state.status = 'failed';
              state.endTime = Date.now();
              state.error = msg.content || 'Unknown error';
            }
            failedPipelines.push(section);
            failedErrors.set(section, state?.error || 'Unknown error');
            ws.close();
            markResolved({ section, success: false, error: msg.content });
            break;

          case 'system-status':
          case 'agent-output':
            // Just update display
            renderProgress();
            break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      const state = pipelineStates.get(section);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(section);
        failedErrors.set(section, err.message);
      }
      markResolved({ section, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      // Ensure we resolve even on unexpected close
      const state = pipelineStates.get(section);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed unexpectedly';
        failedPipelines.push(section);
        failedErrors.set(section, state.error);
        markResolved({ section, success: false, error: 'Connection closed' });
      }
    });
  });
}

/**
 * Process the queue with concurrency limit and staggered starts
 */
async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < SECTIONS.length || promises.size > 0) {
    // Start new pipelines up to concurrency limit (with stagger)
    while (promises.size < MAX_CONCURRENCY && queueIndex < SECTIONS.length) {
      const section = SECTIONS[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(section, template)
        .finally(() => {
          activeCount--;
          promises.delete(section);
          renderProgress();
        });

      promises.set(section, promise);
      renderProgress();

      // Stagger start of next pipeline to reduce load
      if (queueIndex < SECTIONS.length && promises.size < MAX_CONCURRENCY) {
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
  console.log(`${colors.bright}Feature Documentation Pipeline Runner${colors.reset}`);
  console.log(`Sections: ${SECTIONS.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  console.log(`Stagger delay: ${STAGGER_DELAY_MS}ms`);
  if (RETRY_FAILED) {
    console.log(`${colors.magenta}Mode: Retrying failed sections${colors.reset}`);
  }
  console.log();

  // Check if proxy is running
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

  // Initialize all sections as queued
  for (const section of SECTIONS) {
    pipelineStates.set(section, {
      status: 'queued',
      startTime: null,
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });
  }

  // Start processing
  console.log('Starting pipelines...');
  await sleep(1000);

  renderProgress();

  await processQueue(template);

  // Save failed sections for retry
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(s => {
      errors[s] = failedErrors.get(s) || 'Unknown';
    });
    saveFailedSections(failedPipelines, errors);
  } else {
    // Clear failed sections file on full success
    try {
      if (fs.existsSync(FAILED_SECTIONS_FILE)) {
        fs.unlinkSync(FAILED_SECTIONS_FILE);
      }
    } catch (e) {}
  }

  // Final summary
  clearScreen();
  const totalTime = formatDuration(Date.now() - startTime);

  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}                    ${colors.bright}Pipeline Run Complete${colors.reset}                         ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`  Total Time:   ${colors.cyan}${totalTime}${colors.reset}`);
  console.log(`  Completed:    ${colors.green}${completedPipelines.length}${colors.reset}`);
  console.log(`  Failed:       ${colors.red}${failedPipelines.length}${colors.reset}`);
  console.log(`  Total Stages: ${colors.blue}${totalStagesCompleted}${colors.reset}`);
  console.log();

  if (completedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.green}Completed Sections:${colors.reset}`);
    for (const section of completedPipelines) {
      console.log(`    ${colors.green}✓${colors.reset} ${section}`);
    }
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed Sections:${colors.reset}`);
    for (const section of failedPipelines) {
      const error = categorizeError(failedErrors.get(section));
      console.log(`    ${colors.red}✗${colors.reset} ${section}`);
      console.log(`      ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
    console.log(`  ${colors.yellow}To retry failed sections:${colors.reset}`);
    console.log(`    node run-feature-docs.js --retry-failed`);
    console.log();
  }

  console.log(`  Output: ${colors.cyan}/mnt/c/github/swimchain/docs/features/${colors.reset}`);
  console.log();

  process.exit(failedPipelines.length > 0 ? 1 : 0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log();
  console.log(`${colors.yellow}Interrupted by user${colors.reset}`);
  console.log(`Completed: ${completedPipelines.length}, Failed: ${failedPipelines.length}`);

  // Save failed + remaining as failed for retry
  const remaining = SECTIONS.slice(queueIndex);
  const allFailed = [...failedPipelines, ...remaining.filter(s => !completedPipelines.includes(s))];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(s => {
      errors[s] = failedErrors.get(s) || 'Interrupted';
    });
    saveFailedSections(allFailed, errors);
    console.log(`Saved ${allFailed.length} incomplete sections for --retry-failed`);
  }

  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
