#!/usr/bin/env node
/**
 * Client Documentation Pipeline Runner
 *
 * Runs the client-documenter-v1 pipeline for each UI client application.
 *
 * Usage:
 *   node run-client-docs.js                           # Run all clients (3 concurrent)
 *   node run-client-docs.js --concurrency=2           # Run with 2 concurrent
 *   node run-client-docs.js --clients="forum,chat"    # Run specific clients
 *   node run-client-docs.js --retry-failed            # Retry last run's failed clients
 *   node run-client-docs.js --list-failed             # List last run's failed clients
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/client-documenter-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const FAILED_CLIENTS_FILE = path.join(__dirname, '.last-failed-clients.json');
const STAGGER_DELAY_MS = 2000;

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '3');
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_FAILED = hasFlag('--list-failed');

// All UI-facing clients
const ALL_CLIENTS = [
  'forum-client',
  'chat-client',
  'search-client',
  'feed-client',
  'analytics-client',
  'archiver-client',
  'bridge-client',
  'mobile-client',
];

// Load failed clients from last run
function loadFailedClients() {
  try {
    if (fs.existsSync(FAILED_CLIENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_CLIENTS_FILE, 'utf8'));
      return data.clients || [];
    }
  } catch (e) {
    console.error('Could not load failed clients:', e.message);
  }
  return [];
}

// Save failed clients for retry
function saveFailedClients(clients, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      clients,
      errors,
    };
    fs.writeFileSync(FAILED_CLIENTS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed clients:', e.message);
  }
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
let CLIENTS;
if (RETRY_FAILED) {
  CLIENTS = loadFailedClients();
  if (CLIENTS.length === 0) {
    console.log('No failed clients to retry.');
    process.exit(0);
  }
  console.log(`Retrying ${CLIENTS.length} failed clients...`);
} else if (getArg('--clients=')) {
  const requested = getArg('--clients=').split(',').map(c => c.trim());
  CLIENTS = requested.map(c => c.endsWith('-client') ? c : `${c}-client`);
} else {
  CLIENTS = ALL_CLIENTS;
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

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

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

function categorizeError(error) {
  if (!error) return 'Unknown error';
  if (error.includes('EPIPE')) return 'EPIPE: Process pipe broken';
  if (error.includes('--include-partial-messages')) return 'CLI flag error';
  if (error.includes('Connection closed')) return 'Connection lost';
  if (error.includes('timeout')) return 'Timeout';
  return error.substring(0, 80);
}

function renderProgress() {
  clearScreen();

  const elapsed = formatDuration(Date.now() - startTime);
  const completed = completedPipelines.length;
  const failed = failedPipelines.length;
  const total = CLIENTS.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  // Header
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}          ${colors.bright}Client Documentation Pipeline Runner${colors.reset}                  ${colors.cyan}║${colors.reset}`);
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
  for (const [client, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const stageInfo = state.currentStage ? ` → ${state.currentStage}` : '';
      const duration = formatDuration(Date.now() - state.startTime);
      console.log(`    ${colors.yellow}●${colors.reset} ${client.padEnd(25)} [${duration}]${stageInfo}`);
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
    for (const client of recentCompleted) {
      const state = pipelineStates.get(client);
      const duration = state ? formatDuration(state.endTime - state.startTime) : '?';
      console.log(`    ${colors.green}✓${colors.reset} ${client.padEnd(35)} [${duration}]`);
    }
  }
  console.log();

  // Failed pipelines
  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed (${failedPipelines.length}):${colors.reset}`);
    console.log(`  ${'─'.repeat(66)}`);
    for (const client of failedPipelines.slice(-3)) {
      const error = categorizeError(failedErrors.get(client));
      console.log(`    ${colors.red}✗${colors.reset} ${client.padEnd(25)} ${colors.dim}${error}${colors.reset}`);
    }
    if (failedPipelines.length > 3) {
      console.log(`    ${colors.dim}... and ${failedPipelines.length - 3} more${colors.reset}`);
    }
    console.log();
  }

  // Queue status
  const inQueue = CLIENTS.length - queueIndex;
  if (inQueue > activeCount) {
    console.log(`  ${colors.bright}Queued:${colors.reset} ${inQueue - activeCount} remaining`);
  }

  console.log();
  console.log(`  ${colors.dim}Press Ctrl+C to stop | Stagger: ${STAGGER_DELAY_MS}ms${colors.reset}`);
}

function loadTemplate() {
  const content = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return JSON.parse(content);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runPipeline(client, template) {
  return new Promise((resolve) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `client-doc-${client}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    pipelineStates.set(client, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });

    // 60-minute timeout
    const timeout = setTimeout(() => {
      const state = pipelineStates.get(client);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 60 minutes';
        failedPipelines.push(client);
        failedErrors.set(client, state.error);
        ws.close();
        markResolved({ client, success: false, error: 'Timeout' });
      }
    }, 60 * 60 * 1000);

    ws.on('open', () => {
      const clientPath = `${WORKING_DIR}/${client}`;
      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Client Doc: ${client}`,
        },
        userContext: `
Document the "${client}" Swimchain client application.

Client path: ${clientPath}
Output directory: /mnt/c/github/swimchain/docs/clients/

Client to document: ${client}

Instructions:
1. Analyze the client at ${clientPath}
2. Extract all React components and their props
3. Extract all custom hooks and state management
4. Map user-facing features to implementation
5. Write comprehensive documentation to docs/clients/${client}_CLIENT_DOC.md
6. Review for quality and completeness

Focus on:
- Component hierarchy and reusability
- State management patterns
- RPC integration with Swimchain node
- User flows and interactions
- Any special features (PoW, encryption, etc.)
`,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(client);

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
            completedPipelines.push(client);
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
            failedPipelines.push(client);
            failedErrors.set(client, state?.error || 'Unknown');
            ws.close();
            markResolved({ client, success: false, error: msg.content });
            break;

          case 'system-status':
          case 'agent-output':
            renderProgress();
            break;
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      const state = pipelineStates.get(client);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(client);
        failedErrors.set(client, err.message);
      }
      markResolved({ client, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      const state = pipelineStates.get(client);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed unexpectedly';
        failedPipelines.push(client);
        failedErrors.set(client, state.error);
        markResolved({ client, success: false, error: 'Connection closed' });
      }
    });
  });
}

async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < CLIENTS.length || promises.size > 0) {
    while (promises.size < MAX_CONCURRENCY && queueIndex < CLIENTS.length) {
      const client = CLIENTS[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(client, template)
        .finally(() => {
          activeCount--;
          promises.delete(client);
          renderProgress();
        });

      promises.set(client, promise);
      renderProgress();

      if (queueIndex < CLIENTS.length && promises.size < MAX_CONCURRENCY) {
        await sleep(STAGGER_DELAY_MS);
      }
    }

    if (promises.size > 0) {
      await Promise.race(promises.values());
    }
  }
}

async function main() {
  console.log(`${colors.bright}Client Documentation Pipeline Runner${colors.reset}`);
  console.log(`Clients: ${CLIENTS.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  if (RETRY_FAILED) {
    console.log(`${colors.magenta}Mode: Retrying failed clients${colors.reset}`);
  }
  console.log();

  // Check proxy
  console.log('Checking proxy connection...');
  try {
    const testWs = new WebSocket(PROXY_URL);
    await new Promise((resolve, reject) => {
      testWs.on('open', () => { testWs.close(); resolve(); });
      testWs.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
  } catch (err) {
    console.error(`${colors.red}Error: Cannot connect to proxy at ${PROXY_URL}${colors.reset}`);
    console.error('Make sure the Claude Plus proxy is running.');
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
    pipelineStates.set(client, {
      status: 'queued',
      startTime: null,
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });
  }

  console.log('Starting pipelines...');
  await sleep(1000);
  renderProgress();

  await processQueue(template);

  // Save failed
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(c => { errors[c] = failedErrors.get(c) || 'Unknown'; });
    saveFailedClients(failedPipelines, errors);
  } else {
    try { if (fs.existsSync(FAILED_CLIENTS_FILE)) fs.unlinkSync(FAILED_CLIENTS_FILE); } catch (e) {}
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
    console.log(`  ${colors.bright}${colors.green}Completed Clients:${colors.reset}`);
    for (const client of completedPipelines) {
      console.log(`    ${colors.green}✓${colors.reset} ${client}`);
    }
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed Clients:${colors.reset}`);
    for (const client of failedPipelines) {
      const error = categorizeError(failedErrors.get(client));
      console.log(`    ${colors.red}✗${colors.reset} ${client}`);
      console.log(`      ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
    console.log(`  ${colors.yellow}To retry failed clients:${colors.reset}`);
    console.log(`    node run-client-docs.js --retry-failed`);
    console.log();
  }

  console.log(`  Output: ${colors.cyan}/mnt/c/github/swimchain/docs/clients/${colors.reset}`);
  console.log();

  process.exit(failedPipelines.length > 0 ? 1 : 0);
}

process.on('SIGINT', () => {
  console.log();
  console.log(`${colors.yellow}Interrupted by user${colors.reset}`);

  const remaining = CLIENTS.slice(queueIndex);
  const allFailed = [...failedPipelines, ...remaining.filter(c => !completedPipelines.includes(c))];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(c => { errors[c] = failedErrors.get(c) || 'Interrupted'; });
    saveFailedClients(allFailed, errors);
    console.log(`Saved ${allFailed.length} incomplete clients for --retry-failed`);
  }

  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
