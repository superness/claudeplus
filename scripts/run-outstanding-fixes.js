#!/usr/bin/env node
/**
 * Outstanding Issues Implementation Pipeline Runner
 *
 * Implements fixes for outstanding action items from area owner reviews.
 * Uses pre-approved decisions from IMPLEMENTATION_DECISIONS.md.
 *
 * Usage:
 *   node run-outstanding-fixes.js                          # Run all issues
 *   node run-outstanding-fixes.js --priority=critical      # Only critical
 *   node run-outstanding-fixes.js --priority=high          # Critical + high
 *   node run-outstanding-fixes.js --issues="C-BLOCK-1,H-DHT-2"  # Specific issues
 *   node run-outstanding-fixes.js --phase=1                # Run phase 1 only
 *   node run-outstanding-fixes.js --retry-failed           # Retry failures
 *   node run-outstanding-fixes.js --list                   # List all issues
 *   node run-outstanding-fixes.js --dry-run                # Preview only
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/outstanding-implementer-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const OUTSTANDING_FILE = path.join(WORKING_DIR, 'docs/OUTSTANDING_ACTIONS.md');
const DECISIONS_FILE = path.join(WORKING_DIR, 'docs/IMPLEMENTATION_DECISIONS.md');
const OUTPUT_DIR = path.join(WORKING_DIR, 'docs/implementations');
const FAILED_FILE = path.join(__dirname, '.last-failed-outstanding.json');

// Pre-approved decisions (from user session 2026-01-14)
const DECISIONS = {
  'C-CLIENT-1': { library: 'Argon2id', note: 'Use existing @swimchain/react WASM bindings' },
  'C-ARCHIVER-1': { library: '@swimchain/react', note: 'Own package, usePow() hook' },
  'H-RPC-1': { crate: 'governor', version: '0.6', note: 'Async-native rate limiting' },
  'H-RPC-2': { transport: 'WebSocket', crate: 'tokio-tungstenite', note: 'Bidirectional events' },
  'H-BLOCKLIST-3': { strategy: 'incremental', note: 'Track dirty paths, recompute affected branch only' },
  'M-FORUM-1': { library: 'react-window', note: 'Lightweight virtualization' },
  'M-IDENTITY-2': { approach: 'skip', note: 'Minimum length only, no external library' },
  'M-DHT-3': { crate: 'mdns', version: '3.0', note: '_swimchain._tcp.local service' },
};

// All outstanding issues organized by phase
const ISSUES = {
  // Phase 1: Critical Security (Immediate)
  phase1: [
    { id: 'C-BLOCK-1', priority: 'critical', effort: 'S', desc: 'Signature verification gap in content blocks' },
    { id: 'C-ENGAGE-1', priority: 'critical', effort: 'M', desc: 'Signature not verified in submit_engagement RPC' },
    { id: 'C-ENGAGE-2', priority: 'critical', effort: 'M', desc: 'Unique engagement counters never increment' },
    { id: 'C-BLOCKLIST-1', priority: 'critical', effort: 'M', desc: 'Missing Ed25519 signature verification' },
    { id: 'C-BLOCKLIST-2', priority: 'critical', effort: 'M', desc: 'Router cannot store network updates' },
    { id: 'C-DHT-1', priority: 'critical', effort: 'M-L', desc: 'Unsigned provider records enable content poisoning' },
    { id: 'C-DHT-2', priority: 'critical', effort: 'M', desc: 'Eclipse attack vulnerability' },
    { id: 'C-CLIENT-1', priority: 'critical', effort: 'M', desc: 'Private keys stored unencrypted in localStorage' },
    { id: 'C-FORK-1', priority: 'critical', effort: 'M', desc: 'CLI fork create doesn\'t pass secret_key to RPC' },
  ],
  // Phase 2: Security & Stability
  phase2: [
    { id: 'C-API-1', priority: 'critical', effort: 'L', desc: 'Anti-abuse module completely disabled' },
    { id: 'C-ARCHIVER-1', priority: 'critical', effort: 'L', desc: 'PoW engagement completely mocked' },
    { id: 'H-BLOCK-1', priority: 'high', effort: 'M', desc: 'Unbounded seen_actions memory growth' },
    { id: 'H-BLOCK-2', priority: 'high', effort: 'M', desc: 'No mempool size limits' },
    { id: 'H-BLOCKLIST-1', priority: 'high', effort: 'M', desc: 'Sybil resistance simplified' },
    { id: 'H-BLOCKLIST-2', priority: 'high', effort: 'M', desc: 'Incomplete gossip forwarding' },
    { id: 'H-DHT-1', priority: 'high', effort: 'M', desc: 'STORE always accepts without validation' },
    { id: 'H-DHT-2', priority: 'high', effort: 'M-L', desc: 'No DHT persistence' },
    { id: 'H-DHT-3', priority: 'high', effort: 'M', desc: 'No message authentication' },
  ],
  // Phase 3: Features & UX
  phase3: [
    { id: 'H-IDENTITY-1', priority: 'high', effort: 'M', desc: 'No backup prompt after identity creation' },
    { id: 'H-IDENTITY-2', priority: 'high', effort: 'M', desc: 'Display name limit inconsistency' },
    { id: 'H-IDENTITY-3', priority: 'high', effort: 'M', desc: 'Delete confirmation too weak' },
    { id: 'H-RPC-1', priority: 'high', effort: 'L', desc: 'Rate limiting only partially implemented' },
    { id: 'H-RPC-2', priority: 'high', effort: 'L', desc: 'No real-time event support' },
    { id: 'H-RPC-3', priority: 'high', effort: 'M', desc: 'No TLS support' },
    { id: 'H-BLOCKLIST-3', priority: 'high', effort: 'L', desc: 'Merkle root recomputation on every write' },
  ],
  // Phase 4: Polish & Performance
  phase4: [
    { id: 'M-DEVICE-1', priority: 'medium', effort: 'M', desc: 'Synchronous sled flush blocks UI' },
    { id: 'M-DEVICE-2', priority: 'medium', effort: 'M', desc: 'Settings version field missing' },
    { id: 'M-DHT-1', priority: 'medium', effort: 'M', desc: 'Sequential lookup processing' },
    { id: 'M-DHT-2', priority: 'medium', effort: 'M', desc: 'O(n) full table scans in PeerStore' },
    { id: 'M-DHT-3', priority: 'medium', effort: 'L', desc: 'mDNS not implemented' },
    { id: 'M-IDENTITY-1', priority: 'medium', effort: 'M', desc: 'Single-threaded PoW mining' },
    { id: 'M-CLIENT-1', priority: 'medium', effort: 'M', desc: 'PBKDF2 blocks main thread' },
    { id: 'M-FORUM-1', priority: 'medium', effort: 'M', desc: 'No list virtualization' },
    { id: 'M-FORUM-2', priority: 'medium', effort: 'M', desc: 'Argon2id blocks main thread' },
  ],
};

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const PRIORITY_FILTER = getArg('--priority='); // 'critical', 'high', 'medium'
const PHASE_FILTER = getArg('--phase='); // '1', '2', '3', '4'
const ISSUE_FILTER = getArg('--issues='); // 'C-BLOCK-1,H-DHT-2'
const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '1');
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_ISSUES = hasFlag('--list');
const DRY_RUN = hasFlag('--dry-run');

// ANSI colors
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
};

/**
 * Get filtered issues based on command line args
 */
function getFilteredIssues() {
  let allIssues = [
    ...ISSUES.phase1,
    ...ISSUES.phase2,
    ...ISSUES.phase3,
    ...ISSUES.phase4,
  ];

  // Filter by phase
  if (PHASE_FILTER) {
    const phases = PHASE_FILTER.split(',').map(p => `phase${p.trim()}`);
    allIssues = phases.flatMap(p => ISSUES[p] || []);
  }

  // Filter by priority
  if (PRIORITY_FILTER) {
    const priorities = PRIORITY_FILTER.toLowerCase().split(',').map(p => p.trim());
    if (priorities.includes('critical')) {
      allIssues = allIssues.filter(i => i.priority === 'critical');
    } else if (priorities.includes('high')) {
      allIssues = allIssues.filter(i => ['critical', 'high'].includes(i.priority));
    } else if (priorities.includes('medium')) {
      allIssues = allIssues.filter(i => ['critical', 'high', 'medium'].includes(i.priority));
    }
  }

  // Filter by specific issues
  if (ISSUE_FILTER) {
    const issueIds = ISSUE_FILTER.toUpperCase().split(',').map(i => i.trim());
    allIssues = allIssues.filter(i => issueIds.some(id => i.id.includes(id)));
  }

  return allIssues;
}

/**
 * Load failed issues from last run
 */
function loadFailedIssues() {
  try {
    if (fs.existsSync(FAILED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
      return data.issues || [];
    }
  } catch (e) {
    console.error('Could not load failed issues:', e.message);
  }
  return [];
}

/**
 * Save failed issues for retry
 */
function saveFailedIssues(issues, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      issues,
      errors,
    };
    fs.writeFileSync(FAILED_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed issues:', e.message);
  }
}

// Handle --list
if (LIST_ISSUES) {
  console.log(`${colors.bright}Outstanding Issues by Phase:${colors.reset}\n`);

  for (const [phase, issues] of Object.entries(ISSUES)) {
    const phaseNum = phase.replace('phase', '');
    const phaseNames = {
      '1': 'Critical Security (Immediate)',
      '2': 'Security & Stability',
      '3': 'Features & UX',
      '4': 'Polish & Performance',
    };
    console.log(`${colors.cyan}Phase ${phaseNum}: ${phaseNames[phaseNum]}${colors.reset}`);
    console.log('─'.repeat(60));

    for (const issue of issues) {
      const priorityColor = issue.priority === 'critical' ? colors.red :
                           issue.priority === 'high' ? colors.yellow : colors.blue;
      const decision = DECISIONS[issue.id] ? `${colors.green}✓${colors.reset}` : ' ';
      console.log(`  ${decision} ${colors.bright}${issue.id.padEnd(14)}${colors.reset} [${priorityColor}${issue.priority.padEnd(8)}${colors.reset}] ${issue.effort.padEnd(3)} ${issue.desc}`);
    }
    console.log();
  }

  console.log(`${colors.dim}✓ = has pre-approved decision${colors.reset}`);
  console.log(`${colors.dim}Total: ${Object.values(ISSUES).flat().length} issues${colors.reset}`);
  process.exit(0);
}

// Get issues to process
let issuesToProcess = RETRY_FAILED ?
  getFilteredIssues().filter(i => loadFailedIssues().includes(i.id)) :
  getFilteredIssues();

if (issuesToProcess.length === 0) {
  console.log(`${colors.yellow}No issues to process.${colors.reset}`);
  console.log('Use --list to see all available issues.');
  process.exit(0);
}

// Pipeline state tracking
const pipelineStates = new Map();
const completedPipelines = [];
const failedPipelines = [];
const failedErrors = new Map();
let activeCount = 0;
let queueIndex = 0;

const startTime = Date.now();
let totalStagesCompleted = 0;

/**
 * Format duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Clear screen
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Render progress
 */
function renderProgress() {
  clearScreen();

  const elapsed = formatDuration(Date.now() - startTime);
  const completed = completedPipelines.length;
  const failed = failedPipelines.length;
  const total = issuesToProcess.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}          ${colors.bright}Outstanding Issues Implementation Pipeline${colors.reset}            ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  if (DRY_RUN) {
    console.log(`  ${colors.yellow}*** DRY RUN MODE - No changes will be made ***${colors.reset}`);
    console.log();
  }

  // Progress bar
  const barWidth = 50;
  const completedWidth = Math.round((completed / total) * barWidth);
  const failedWidth = Math.round((failed / total) * barWidth);
  const emptyWidth = barWidth - completedWidth - failedWidth;
  const bar = `${colors.green}${'█'.repeat(completedWidth)}${colors.red}${'█'.repeat(failedWidth)}${colors.dim}${'░'.repeat(Math.max(0, emptyWidth))}${colors.reset}`;

  console.log(`  Progress: [${bar}] ${progress}%`);
  console.log();

  console.log(`  ${colors.bright}Stats:${colors.reset}`);
  console.log(`    Elapsed:     ${colors.cyan}${elapsed}${colors.reset}`);
  console.log(`    Active:      ${colors.yellow}${activeCount}${colors.reset} / ${MAX_CONCURRENCY}`);
  console.log(`    Completed:   ${colors.green}${completed}${colors.reset} / ${total}`);
  console.log(`    Failed:      ${colors.red}${failed}${colors.reset}`);
  console.log();

  // Active
  console.log(`  ${colors.bright}Active:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  let hasActive = false;
  for (const [issueId, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const issue = issuesToProcess.find(i => i.id === issueId);
      const duration = formatDuration(Date.now() - state.startTime);
      const stage = state.currentStage || 'starting';
      console.log(`    ${colors.yellow}●${colors.reset} ${issueId.padEnd(14)} [${duration}] ${stage}`);
    }
  }
  if (!hasActive) console.log(`    ${colors.dim}(none)${colors.reset}`);
  console.log();

  // Recent completions
  console.log(`  ${colors.bright}Recent:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);
  const recent = completedPipelines.slice(-3);
  if (recent.length === 0) {
    console.log(`    ${colors.dim}(none yet)${colors.reset}`);
  } else {
    for (const issueId of recent) {
      const state = pipelineStates.get(issueId);
      const duration = state ? formatDuration(state.endTime - state.startTime) : '?';
      console.log(`    ${colors.green}✓${colors.reset} ${issueId.padEnd(14)} [${duration}]`);
    }
  }
  console.log();

  // Failed
  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed:${colors.reset}`);
    for (const issueId of failedPipelines.slice(-2)) {
      const error = failedErrors.get(issueId) || 'Unknown';
      console.log(`    ${colors.red}✗${colors.reset} ${issueId.padEnd(14)} ${colors.dim}${error.substring(0, 40)}${colors.reset}`);
    }
    console.log();
  }

  console.log(`  ${colors.dim}Press Ctrl+C to stop${colors.reset}`);
}

/**
 * Load template
 */
function loadTemplate() {
  return JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure output directory
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Build context for an issue
 */
function buildIssueContext(issue) {
  const decision = DECISIONS[issue.id];
  const decisionText = decision ?
    `\n\nPRE-APPROVED DECISION for ${issue.id}:\n${JSON.stringify(decision, null, 2)}` : '';

  return `
Implement fix for outstanding issue: ${issue.id}

Issue Details:
- ID: ${issue.id}
- Priority: ${issue.priority}
- Effort: ${issue.effort}
- Description: ${issue.desc}
${decisionText}

Reference Documents:
- Outstanding actions: ${OUTSTANDING_FILE}
- Decisions: ${DECISIONS_FILE}
- Output directory: ${OUTPUT_DIR}

Instructions:
1. Read OUTSTANDING_ACTIONS.md to get full implementation plan for ${issue.id}
2. Read IMPLEMENTATION_DECISIONS.md for any pre-approved choices
3. Read the relevant source files listed in the issue
4. Implement the fix following existing code patterns
5. Run validation (cargo check for Rust, npm run typecheck for TypeScript)
6. Write implementation log to: ${OUTPUT_DIR}/${issue.id}_IMPL_LOG.md

Rules:
- Follow existing code patterns exactly
- Make minimal, focused changes
- If blocked or unclear, document why and stop
- Do NOT make architectural decisions not covered by IMPLEMENTATION_DECISIONS.md
`;
}

/**
 * Run pipeline for an issue
 */
function runPipeline(issue, template) {
  return new Promise((resolve) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `outstanding-${issue.id}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    pipelineStates.set(issue.id, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      error: null,
    });

    const timeout = setTimeout(() => {
      const state = pipelineStates.get(issue.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 60 minutes';
        failedPipelines.push(issue.id);
        failedErrors.set(issue.id, state.error);
        ws.close();
        markResolved({ issue, success: false, error: 'Timeout' });
      }
    }, 60 * 60 * 1000);

    ws.on('open', () => {
      const dryRunNote = DRY_RUN ? '\n\n**DRY RUN**: Analyze and plan but do NOT make changes.' : '';

      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Fix: ${issue.id} - ${issue.desc}`,
        },
        userContext: buildIssueContext(issue) + dryRunNote,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(issue.id);

        switch (msg.type) {
          case 'pipeline-stage-update':
          case 'stage-started':
            if (state) state.currentStage = msg.stageName || msg.stage || 'unknown';
            renderProgress();
            break;

          case 'stage-completed':
            totalStagesCompleted++;
            renderProgress();
            break;

          case 'pipeline-complete':
            clearTimeout(timeout);
            if (state) {
              state.status = 'completed';
              state.endTime = Date.now();
            }
            completedPipelines.push(issue.id);
            ws.close();
            markResolved({ issue, success: true });
            break;

          case 'pipeline-error':
            clearTimeout(timeout);
            if (state) {
              state.status = 'failed';
              state.endTime = Date.now();
              state.error = msg.content || 'Unknown error';
            }
            failedPipelines.push(issue.id);
            failedErrors.set(issue.id, state?.error || 'Unknown');
            ws.close();
            markResolved({ issue, success: false, error: msg.content });
            break;
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      const state = pipelineStates.get(issue.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(issue.id);
        failedErrors.set(issue.id, err.message);
      }
      markResolved({ issue, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      const state = pipelineStates.get(issue.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed';
        failedPipelines.push(issue.id);
        failedErrors.set(issue.id, state.error);
        markResolved({ issue, success: false, error: 'Connection closed' });
      }
    });
  });
}

/**
 * Process queue
 */
async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < issuesToProcess.length || promises.size > 0) {
    while (promises.size < MAX_CONCURRENCY && queueIndex < issuesToProcess.length) {
      const issue = issuesToProcess[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(issue, template)
        .finally(() => {
          activeCount--;
          promises.delete(issue.id);
          renderProgress();
        });

      promises.set(issue.id, promise);
      renderProgress();

      if (queueIndex < issuesToProcess.length && promises.size < MAX_CONCURRENCY) {
        await sleep(2000);
      }
    }

    if (promises.size > 0) {
      await Promise.race(promises.values());
    }
  }
}

/**
 * Main
 */
async function main() {
  console.log(`${colors.bright}Outstanding Issues Implementation Pipeline${colors.reset}`);
  console.log(`Issues: ${issuesToProcess.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  if (DRY_RUN) console.log(`${colors.yellow}Mode: DRY RUN${colors.reset}`);
  console.log();

  ensureOutputDir();

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
    console.error('Start proxy: node proxy/server.js');
    process.exit(1);
  }
  console.log(`${colors.green}Connected!${colors.reset}\n`);

  const template = loadTemplate();
  console.log(`${colors.green}Template loaded${colors.reset}\n`);

  if (!DRY_RUN) {
    console.log(`${colors.yellow}WARNING: This will modify code files!${colors.reset}`);
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)');
    await sleep(3000);
  }

  for (const issue of issuesToProcess) {
    pipelineStates.set(issue.id, { status: 'queued', startTime: null, currentStage: null, error: null });
  }

  renderProgress();
  await processQueue(template);

  // Save failed
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(id => { errors[id] = failedErrors.get(id) || 'Unknown'; });
    saveFailedIssues(failedPipelines, errors);
  } else {
    try { if (fs.existsSync(FAILED_FILE)) fs.unlinkSync(FAILED_FILE); } catch (e) {}
  }

  // Final summary
  clearScreen();
  const totalTime = formatDuration(Date.now() - startTime);

  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}              ${colors.bright}Outstanding Implementation Complete${colors.reset}                ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  if (DRY_RUN) console.log(`  ${colors.yellow}*** DRY RUN - No changes made ***${colors.reset}\n`);

  console.log(`  Total Time:   ${colors.cyan}${totalTime}${colors.reset}`);
  console.log(`  Completed:    ${colors.green}${completedPipelines.length}${colors.reset}`);
  console.log(`  Failed:       ${colors.red}${failedPipelines.length}${colors.reset}`);
  console.log();

  if (completedPipelines.length > 0) {
    console.log(`  ${colors.green}Completed:${colors.reset}`);
    completedPipelines.forEach(id => console.log(`    ${colors.green}✓${colors.reset} ${id}`));
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.red}Failed:${colors.reset}`);
    failedPipelines.forEach(id => {
      console.log(`    ${colors.red}✗${colors.reset} ${id}: ${failedErrors.get(id) || 'Unknown'}`);
    });
    console.log(`\n  Retry with: node run-outstanding-fixes.js --retry-failed`);
    console.log();
  }

  console.log(`  Logs: ${colors.cyan}${OUTPUT_DIR}${colors.reset}`);
  console.log();

  if (!DRY_RUN && completedPipelines.length > 0) {
    console.log(`  ${colors.bright}Next Steps:${colors.reset}`);
    console.log(`    1. Review implementation logs in ${OUTPUT_DIR}`);
    console.log(`    2. Run tests: cargo test && npm test`);
    console.log(`    3. Review git diff`);
    console.log(`    4. Commit if satisfied`);
  }

  process.exit(failedPipelines.length > 0 ? 1 : 0);
}

process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Interrupted${colors.reset}`);
  const remaining = issuesToProcess.slice(queueIndex).map(i => i.id);
  const allFailed = [...failedPipelines, ...remaining];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(id => { errors[id] = failedErrors.get(id) || 'Interrupted'; });
    saveFailedIssues(allFailed, errors);
    console.log(`Saved ${allFailed.length} issues for --retry-failed`);
  }
  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal:${colors.reset}`, err);
  process.exit(1);
});
