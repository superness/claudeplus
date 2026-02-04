#!/usr/bin/env node
/**
 * Client Area Owner Review Pipeline Runner
 *
 * Runs the area-owner-v1 pipeline against each client document in docs/clients/
 * to produce comprehensive multi-perspective reviews for UI client applications.
 *
 * Usage:
 *   node run-client-area-owner.js                        # Run all client docs (3 concurrent)
 *   node run-client-area-owner.js --concurrency=2        # Run with 2 concurrent
 *   node run-client-area-owner.js --clients="forum,chat" # Run specific clients (partial match)
 *   node run-client-area-owner.js --retry-failed         # Retry last run's failed clients
 *   node run-client-area-owner.js --list-failed          # List last run's failed clients
 *   node run-client-area-owner.js --list                 # List all available client docs
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/area-owner-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const CLIENTS_DIR = path.join(WORKING_DIR, 'docs/clients');
const OUTPUT_DIR = path.join(WORKING_DIR, 'docs/reviews/clients');
const FAILED_FILE = path.join(__dirname, '.last-failed-client-area-owner.json');
const STAGGER_DELAY_MS = 2000;

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '3');
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_FAILED = hasFlag('--list-failed');
const LIST_CLIENTS = hasFlag('--list');

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
 * Get all client documents
 */
function getClientDocs() {
  if (!fs.existsSync(CLIENTS_DIR)) {
    console.error(`${colors.red}Error: Clients directory not found: ${CLIENTS_DIR}${colors.reset}`);
    console.error('Run the client-documenter pipeline first to generate client docs.');
    process.exit(1);
  }

  const files = fs.readdirSync(CLIENTS_DIR)
    .filter(f => f.endsWith('_CLIENT_DOC.md'))
    .map(f => ({
      filename: f,
      path: path.join(CLIENTS_DIR, f),
      name: f.replace('_CLIENT_DOC.md', ''),
      displayName: f.replace('_CLIENT_DOC.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      id: f.replace('_CLIENT_DOC.md', ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return files;
}

/**
 * Load failed clients from last run
 */
function loadFailedClients() {
  try {
    if (fs.existsSync(FAILED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
      return data.clients || [];
    }
  } catch (e) {
    console.error('Could not load failed clients:', e.message);
  }
  return [];
}

/**
 * Save failed clients for retry
 */
function saveFailedClients(clients, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      clients,
      errors,
    };
    fs.writeFileSync(FAILED_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed clients:', e.message);
  }
}

// Handle --list
if (LIST_CLIENTS) {
  const docs = getClientDocs();
  console.log(`${colors.bright}Available Client Documents (${docs.length}):${colors.reset}\n`);
  docs.forEach((doc, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${doc.displayName}`);
    console.log(`      ${colors.dim}${doc.filename}${colors.reset}`);
  });
  process.exit(0);
}

// Handle --list-failed
if (LIST_FAILED) {
  const failed = loadFailedClients();
  if (failed.length === 0) {
    console.log('No failed clients from last run.');
  } else {
    console.log('Failed clients from last run:');
    failed.forEach(c => console.log(`  - ${c}`));
    console.log(`\nRun with --retry-failed to retry these clients.`);
  }
  process.exit(0);
}

// Determine which clients to run
const allDocs = getClientDocs();
let CLIENTS;

if (RETRY_FAILED) {
  const failedIds = loadFailedClients();
  if (failedIds.length === 0) {
    console.log('No failed clients to retry.');
    process.exit(0);
  }
  CLIENTS = allDocs.filter(d => failedIds.includes(d.id));
  console.log(`Retrying ${CLIENTS.length} failed clients...`);
} else if (getArg('--clients=')) {
  const patterns = getArg('--clients=').toLowerCase().split(',').map(s => s.trim());
  CLIENTS = allDocs.filter(d =>
    patterns.some(p => d.id.toLowerCase().includes(p) || d.name.toLowerCase().includes(p))
  );
  if (CLIENTS.length === 0) {
    console.error(`${colors.red}No clients matched the patterns: ${patterns.join(', ')}${colors.reset}`);
    console.log('Use --list to see available client documents.');
    process.exit(1);
  }
} else {
  CLIENTS = allDocs;
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
  const total = CLIENTS.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  // Header
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}          ${colors.bright}Client Area Owner Review Pipeline Runner${colors.reset}              ${colors.cyan}║${colors.reset}`);
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
  console.log(`    Reviews:     ${colors.blue}${totalStagesCompleted}${colors.reset} stages`);
  if (RETRY_FAILED) {
    console.log(`    ${colors.magenta}Mode: Retry Failed${colors.reset}`);
  }
  console.log();

  // Active pipelines
  console.log(`  ${colors.bright}Active Reviews:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  let hasActive = false;
  for (const [clientId, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const client = CLIENTS.find(c => c.id === clientId);
      const name = client?.displayName || clientId;
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
    for (const clientId of recentCompleted) {
      const state = pipelineStates.get(clientId);
      const client = CLIENTS.find(c => c.id === clientId);
      const name = client?.displayName || clientId;
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
    for (const clientId of recentFailed) {
      const state = pipelineStates.get(clientId);
      const client = CLIENTS.find(c => c.id === clientId);
      const name = client?.displayName || clientId;
      const error = categorizeError(state?.error);
      console.log(`    ${colors.red}✗${colors.reset} ${name.substring(0, 35).padEnd(35)} ${colors.dim}${error}${colors.reset}`);
    }
    if (failedPipelines.length > 3) {
      console.log(`    ${colors.dim}... and ${failedPipelines.length - 3} more${colors.reset}`);
    }
    console.log();
  }

  // Queue status
  const queued = CLIENTS.slice(queueIndex);
  const inQueue = queued.length - activeCount;
  if (inQueue > 0) {
    console.log(`  ${colors.bright}Queued:${colors.reset} ${inQueue} remaining`);
    const preview = queued.slice(activeCount, activeCount + 3).map(c => c.displayName.substring(0, 15)).join(', ');
    console.log(`    ${colors.dim}${preview}${inQueue > 3 ? '...' : ''}${colors.reset}`);
  }

  console.log();
  console.log(`  ${colors.dim}Press Ctrl+C to stop | Pipeline: area-owner-v1 (clients)${colors.reset}`);
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
function runPipeline(client, template) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `client-area-owner-${client.id}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Initialize state
    pipelineStates.set(client.id, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });

    // 90-minute timeout (client reviews can be complex)
    const timeout = setTimeout(() => {
      const state = pipelineStates.get(client.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 90 minutes';
        failedPipelines.push(client.id);
        failedErrors.set(client.id, state.error);
        ws.close();
        markResolved({ client, success: false, error: 'Timeout' });
      }
    }, 90 * 60 * 1000);

    ws.on('open', () => {
      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Client Area Owner Review: ${client.displayName}`,
        },
        userContext: `
Review the "${client.displayName}" client application from multiple expert perspectives.

Client document path: ${client.path}
Client name: ${client.name}
Output directory: ${OUTPUT_DIR}

This is a React/TypeScript UI client application for the Swimchain decentralized social platform.

Instructions:
1. Load and understand the client documentation at ${client.path}
2. Review from each perspective:
   - Functionality: completeness, correctness, API design, integration with Swimchain node
   - Performance: React rendering, bundle size, lazy loading, caching
   - Vision: alignment with Swimchain's decentralized vision, user empowerment
   - UX: usability, discoverability, efficiency, mobile responsiveness
   - Accessibility: WCAG compliance, keyboard navigation, screen reader support
   - Quality: component structure, TypeScript usage, test coverage, error handling
   - Security: XSS prevention, secure RPC calls, key management, input validation
3. Synthesize all reviews into a prioritized action plan
4. Write the final review to: ${OUTPUT_DIR}/${client.id}_AREA_OWNER_REVIEW.md

Focus on client-specific concerns:
- React component architecture and reusability
- State management patterns (hooks, context)
- RPC integration with Swimchain node
- WASM bindings usage (crypto, PoW)
- User authentication and key handling
`,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(client.id);

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
            completedPipelines.push(client.id);
            ws.close();
            markResolved({ client, success: true });
            break;

          case 'pipeline-error':
            clearTimeout(timeout);
            if (state) {
              state.status = 'failed';
              state.endTime = Date.now();
              state.error = msg.content || 'Unknown error';
            }
            failedPipelines.push(client.id);
            failedErrors.set(client.id, state?.error || 'Unknown error');
            ws.close();
            markResolved({ client, success: false, error: msg.content });
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
      const state = pipelineStates.get(client.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(client.id);
        failedErrors.set(client.id, err.message);
      }
      markResolved({ client, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      const state = pipelineStates.get(client.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed unexpectedly';
        failedPipelines.push(client.id);
        failedErrors.set(client.id, state.error);
        markResolved({ client, success: false, error: 'Connection closed' });
      }
    });
  });
}

/**
 * Process the queue with concurrency limit and staggered starts
 */
async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < CLIENTS.length || promises.size > 0) {
    // Start new pipelines up to concurrency limit
    while (promises.size < MAX_CONCURRENCY && queueIndex < CLIENTS.length) {
      const client = CLIENTS[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(client, template)
        .finally(() => {
          activeCount--;
          promises.delete(client.id);
          renderProgress();
        });

      promises.set(client.id, promise);
      renderProgress();

      // Stagger start
      if (queueIndex < CLIENTS.length && promises.size < MAX_CONCURRENCY) {
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
  console.log(`${colors.bright}Client Area Owner Review Pipeline Runner${colors.reset}`);
  console.log(`Clients: ${CLIENTS.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  console.log(`Stagger delay: ${STAGGER_DELAY_MS}ms`);
  if (RETRY_FAILED) {
    console.log(`${colors.magenta}Mode: Retrying failed clients${colors.reset}`);
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
      setTimeout(() => reject(new Error('Timeout')), 5000);
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
  for (const client of CLIENTS) {
    pipelineStates.set(client.id, {
      status: 'queued',
      startTime: null,
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });
  }

  // Start processing
  console.log('Starting client reviews...');
  await sleep(1000);

  renderProgress();

  await processQueue(template);

  // Save failed
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Unknown';
    });
    saveFailedClients(failedPipelines, errors);
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

  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}                  ${colors.bright}Client Area Owner Reviews Complete${colors.reset}              ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();
  console.log(`  Total Time:   ${colors.cyan}${totalTime}${colors.reset}`);
  console.log(`  Completed:    ${colors.green}${completedPipelines.length}${colors.reset}`);
  console.log(`  Failed:       ${colors.red}${failedPipelines.length}${colors.reset}`);
  console.log(`  Total Stages: ${colors.blue}${totalStagesCompleted}${colors.reset}`);
  console.log();

  if (completedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.green}Completed Reviews:${colors.reset}`);
    for (const clientId of completedPipelines) {
      const client = CLIENTS.find(c => c.id === clientId);
      console.log(`    ${colors.green}✓${colors.reset} ${client?.displayName || clientId}`);
    }
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed Reviews:${colors.reset}`);
    for (const clientId of failedPipelines) {
      const client = CLIENTS.find(c => c.id === clientId);
      const error = categorizeError(failedErrors.get(clientId));
      console.log(`    ${colors.red}✗${colors.reset} ${client?.displayName || clientId}`);
      console.log(`      ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
    console.log(`  ${colors.yellow}To retry failed:${colors.reset}`);
    console.log(`    node run-client-area-owner.js --retry-failed`);
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

  const remaining = CLIENTS.slice(queueIndex).map(c => c.id);
  const allFailed = [...failedPipelines, ...remaining.filter(id => !completedPipelines.includes(id))];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Interrupted';
    });
    saveFailedClients(allFailed, errors);
    console.log(`Saved ${allFailed.length} incomplete reviews for --retry-failed`);
  }

  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
