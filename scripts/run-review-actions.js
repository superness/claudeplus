#!/usr/bin/env node
/**
 * Review Action Implementation Pipeline Runner
 *
 * Reads area owner reviews and implements fixes for each action item.
 * Processes one review at a time (implementation is more complex than review).
 *
 * Usage:
 *   node run-review-actions.js                          # Run all reviews
 *   node run-review-actions.js --type=features          # Only feature reviews
 *   node run-review-actions.js --type=clients           # Only client reviews
 *   node run-review-actions.js --reviews="rpc,cli"      # Specific reviews (partial match)
 *   node run-review-actions.js --retry-failed           # Retry last run's failed reviews
 *   node run-review-actions.js --list-failed            # List last run's failed reviews
 *   node run-review-actions.js --list                   # List all available reviews
 *   node run-review-actions.js --dry-run                # Parse reviews but don't implement
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const PROXY_URL = 'ws://localhost:8081';
const TEMPLATE_PATH = path.join(__dirname, '../templates/review-actioner-v1.json');
const WORKING_DIR = '/mnt/c/github/swimchain';
const FEATURE_REVIEWS_DIR = path.join(WORKING_DIR, 'docs/reviews');
const CLIENT_REVIEWS_DIR = path.join(WORKING_DIR, 'docs/reviews/clients');
const OUTPUT_DIR = path.join(WORKING_DIR, 'docs/actions');
const FAILED_FILE = path.join(__dirname, '.last-failed-review-actions.json');
const STAGGER_DELAY_MS = 3000;

// Parse arguments
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=')[1];
const hasFlag = (flag) => args.includes(flag);

const REVIEW_TYPE = getArg('--type=') || 'all'; // 'all', 'features', 'clients'
const MAX_CONCURRENCY = parseInt(getArg('--concurrency=') || '1'); // Default 1 for safety
const RETRY_FAILED = hasFlag('--retry-failed');
const LIST_FAILED = hasFlag('--list-failed');
const LIST_REVIEWS = hasFlag('--list');
const DRY_RUN = hasFlag('--dry-run');

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
 * Get all review documents
 */
function getReviewDocs() {
  const reviews = [];

  // Feature reviews
  if ((REVIEW_TYPE === 'all' || REVIEW_TYPE === 'features') && fs.existsSync(FEATURE_REVIEWS_DIR)) {
    const files = fs.readdirSync(FEATURE_REVIEWS_DIR)
      .filter(f => f.endsWith('_AREA_OWNER_REVIEW.md') && !f.startsWith('.'));

    for (const f of files) {
      reviews.push({
        filename: f,
        path: path.join(FEATURE_REVIEWS_DIR, f),
        name: f.replace('_AREA_OWNER_REVIEW.md', ''),
        displayName: f.replace('_AREA_OWNER_REVIEW.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        id: `feature-${f.replace('_AREA_OWNER_REVIEW.md', '')}`,
        type: 'feature',
      });
    }
  }

  // Client reviews
  if ((REVIEW_TYPE === 'all' || REVIEW_TYPE === 'clients') && fs.existsSync(CLIENT_REVIEWS_DIR)) {
    const files = fs.readdirSync(CLIENT_REVIEWS_DIR)
      .filter(f => f.endsWith('_AREA_OWNER_REVIEW.md') && !f.startsWith('.'));

    for (const f of files) {
      reviews.push({
        filename: f,
        path: path.join(CLIENT_REVIEWS_DIR, f),
        name: f.replace('_AREA_OWNER_REVIEW.md', ''),
        displayName: f.replace('_AREA_OWNER_REVIEW.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' (Client)',
        id: `client-${f.replace('_AREA_OWNER_REVIEW.md', '')}`,
        type: 'client',
      });
    }
  }

  return reviews.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Load failed reviews from last run
 */
function loadFailedReviews() {
  try {
    if (fs.existsSync(FAILED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf8'));
      return data.reviews || [];
    }
  } catch (e) {
    console.error('Could not load failed reviews:', e.message);
  }
  return [];
}

/**
 * Save failed reviews for retry
 */
function saveFailedReviews(reviews, errors) {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      reviews,
      errors,
    };
    fs.writeFileSync(FAILED_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Could not save failed reviews:', e.message);
  }
}

// Handle --list
if (LIST_REVIEWS) {
  const docs = getReviewDocs();
  if (docs.length === 0) {
    console.log(`${colors.yellow}No area owner reviews found.${colors.reset}`);
    console.log('Run the area-owner pipeline first to generate reviews.');
    process.exit(0);
  }
  console.log(`${colors.bright}Available Area Owner Reviews (${docs.length}):${colors.reset}\n`);

  const features = docs.filter(d => d.type === 'feature');
  const clients = docs.filter(d => d.type === 'client');

  if (features.length > 0) {
    console.log(`${colors.cyan}Feature Reviews (${features.length}):${colors.reset}`);
    features.forEach((doc, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${doc.displayName}`);
    });
    console.log();
  }

  if (clients.length > 0) {
    console.log(`${colors.magenta}Client Reviews (${clients.length}):${colors.reset}`);
    clients.forEach((doc, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${doc.displayName}`);
    });
  }
  process.exit(0);
}

// Handle --list-failed
if (LIST_FAILED) {
  const failed = loadFailedReviews();
  if (failed.length === 0) {
    console.log('No failed reviews from last run.');
  } else {
    console.log('Failed reviews from last run:');
    failed.forEach(r => console.log(`  - ${r}`));
    console.log(`\nRun with --retry-failed to retry these reviews.`);
  }
  process.exit(0);
}

// Determine which reviews to run
const allDocs = getReviewDocs();

if (allDocs.length === 0) {
  console.log(`${colors.yellow}No area owner reviews found.${colors.reset}`);
  console.log('Run the area-owner pipeline first to generate reviews:');
  console.log('  node run-area-owner.js');
  console.log('  node run-client-area-owner.js');
  process.exit(0);
}

let REVIEWS;

if (RETRY_FAILED) {
  const failedIds = loadFailedReviews();
  if (failedIds.length === 0) {
    console.log('No failed reviews to retry.');
    process.exit(0);
  }
  REVIEWS = allDocs.filter(d => failedIds.includes(d.id));
  console.log(`Retrying ${REVIEWS.length} failed reviews...`);
} else if (getArg('--reviews=')) {
  const patterns = getArg('--reviews=').toLowerCase().split(',').map(s => s.trim());
  REVIEWS = allDocs.filter(d =>
    patterns.some(p => d.id.toLowerCase().includes(p) || d.name.toLowerCase().includes(p))
  );
  if (REVIEWS.length === 0) {
    console.error(`${colors.red}No reviews matched the patterns: ${patterns.join(', ')}${colors.reset}`);
    console.log('Use --list to see available reviews.');
    process.exit(1);
  }
} else {
  REVIEWS = allDocs;
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
let totalFixesApplied = 0;

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
  const total = REVIEWS.length;
  const progress = Math.round(((completed + failed) / total) * 100);

  // Header
  console.log(`${colors.bright}${colors.green}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║${colors.reset}           ${colors.bright}Review Action Implementation Pipeline${colors.reset}                 ${colors.green}║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
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

  // Stats
  console.log(`  ${colors.bright}Stats:${colors.reset}`);
  console.log(`    Elapsed:     ${colors.cyan}${elapsed}${colors.reset}`);
  console.log(`    Active:      ${colors.yellow}${activeCount}${colors.reset} / ${MAX_CONCURRENCY}`);
  console.log(`    Completed:   ${colors.green}${completed}${colors.reset} / ${total}`);
  console.log(`    Failed:      ${colors.red}${failed}${colors.reset}`);
  console.log(`    Stages:      ${colors.blue}${totalStagesCompleted}${colors.reset}`);
  if (RETRY_FAILED) {
    console.log(`    ${colors.magenta}Mode: Retry Failed${colors.reset}`);
  }
  console.log();

  // Active pipelines
  console.log(`  ${colors.bright}Active:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  let hasActive = false;
  for (const [reviewId, state] of pipelineStates) {
    if (state.status === 'running') {
      hasActive = true;
      const review = REVIEWS.find(r => r.id === reviewId);
      const name = review?.displayName || reviewId;
      const stageInfo = state.currentStage ? ` → ${state.currentStage}` : '';
      const duration = formatDuration(Date.now() - state.startTime);
      console.log(`    ${colors.yellow}●${colors.reset} ${name.substring(0, 35).padEnd(35)} [${duration}]${stageInfo.substring(0, 25)}`);
    }
  }

  if (!hasActive) {
    console.log(`    ${colors.dim}(none)${colors.reset}`);
  }
  console.log();

  // Recent completions
  console.log(`  ${colors.bright}Recent Completions:${colors.reset}`);
  console.log(`  ${'─'.repeat(66)}`);

  const recentCompleted = completedPipelines.slice(-3);
  if (recentCompleted.length === 0) {
    console.log(`    ${colors.dim}(none yet)${colors.reset}`);
  } else {
    for (const reviewId of recentCompleted) {
      const state = pipelineStates.get(reviewId);
      const review = REVIEWS.find(r => r.id === reviewId);
      const name = review?.displayName || reviewId;
      const duration = state ? formatDuration(state.endTime - state.startTime) : '?';
      console.log(`    ${colors.green}✓${colors.reset} ${name.substring(0, 45).padEnd(45)} [${duration}]`);
    }
  }
  console.log();

  // Failed
  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed (${failedPipelines.length}):${colors.reset}`);
    console.log(`  ${'─'.repeat(66)}`);
    const recentFailed = failedPipelines.slice(-2);
    for (const reviewId of recentFailed) {
      const state = pipelineStates.get(reviewId);
      const review = REVIEWS.find(r => r.id === reviewId);
      const name = review?.displayName || reviewId;
      const error = categorizeError(state?.error);
      console.log(`    ${colors.red}✗${colors.reset} ${name.substring(0, 35).padEnd(35)} ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
  }

  // Queue
  const queued = REVIEWS.slice(queueIndex);
  const inQueue = queued.length - activeCount;
  if (inQueue > 0) {
    console.log(`  ${colors.bright}Queued:${colors.reset} ${inQueue} remaining`);
  }

  console.log();
  console.log(`  ${colors.dim}Press Ctrl+C to stop | Concurrency: ${MAX_CONCURRENCY} (use --concurrency=N)${colors.reset}`);
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
 * Run a pipeline for a review
 */
function runPipeline(review, template) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(PROXY_URL);
    const pipelineId = `review-action-${review.id}-${Date.now()}`;
    let resolved = false;

    const markResolved = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Initialize state
    pipelineStates.set(review.id, {
      status: 'running',
      startTime: Date.now(),
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });

    // 90-minute timeout (implementation takes longer)
    const timeout = setTimeout(() => {
      const state = pipelineStates.get(review.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Timeout after 90 minutes';
        failedPipelines.push(review.id);
        failedErrors.set(review.id, state.error);
        ws.close();
        markResolved({ review, success: false, error: 'Timeout' });
      }
    }, 90 * 60 * 1000);

    ws.on('open', () => {
      const dryRunNote = DRY_RUN ? '\n\n**DRY RUN MODE**: Parse the review and identify actions, but do NOT make any code changes.' : '';

      const message = {
        type: 'execute-pipeline',
        pipelineId,
        pipeline: {
          ...template,
          name: `Review Actions: ${review.displayName}`,
        },
        userContext: `
Implement fixes for the area owner review: "${review.displayName}"

Review document path: ${review.path}
Feature/Client name: ${review.name}
Review type: ${review.type}
Output directory: ${OUTPUT_DIR}
${dryRunNote}

Instructions:
1. Parse the area owner review at ${review.path}
2. Extract all action items organized by priority (CRITICAL, HIGH, MEDIUM)
3. Implement fixes for each priority level, starting with CRITICAL
4. After implementing, validate changes (cargo check, npm run typecheck, etc.)
5. Generate action log documenting all changes made
6. Write the action log to: ${OUTPUT_DIR}/${review.name}_ACTION_LOG.md

Rules:
- Make minimal, focused changes
- Follow existing code patterns
- Skip items that are unclear or risky
- Document everything for review
`,
        workingDirectory: WORKING_DIR,
      };

      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const state = pipelineStates.get(review.id);

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
            completedPipelines.push(review.id);
            ws.close();
            markResolved({ review, success: true });
            break;

          case 'pipeline-error':
            clearTimeout(timeout);
            if (state) {
              state.status = 'failed';
              state.endTime = Date.now();
              state.error = msg.content || 'Unknown error';
            }
            failedPipelines.push(review.id);
            failedErrors.set(review.id, state?.error || 'Unknown error');
            ws.close();
            markResolved({ review, success: false, error: msg.content });
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
      const state = pipelineStates.get(review.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = err.message;
        failedPipelines.push(review.id);
        failedErrors.set(review.id, err.message);
      }
      markResolved({ review, success: false, error: err.message });
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      const state = pipelineStates.get(review.id);
      if (state && state.status === 'running') {
        state.status = 'failed';
        state.endTime = Date.now();
        state.error = 'Connection closed unexpectedly';
        failedPipelines.push(review.id);
        failedErrors.set(review.id, state.error);
        markResolved({ review, success: false, error: 'Connection closed' });
      }
    });
  });
}

/**
 * Process the queue with concurrency limit
 */
async function processQueue(template) {
  const promises = new Map();

  while (queueIndex < REVIEWS.length || promises.size > 0) {
    // Start new pipelines up to concurrency limit
    while (promises.size < MAX_CONCURRENCY && queueIndex < REVIEWS.length) {
      const review = REVIEWS[queueIndex];
      queueIndex++;
      activeCount++;

      const promise = runPipeline(review, template)
        .finally(() => {
          activeCount--;
          promises.delete(review.id);
          renderProgress();
        });

      promises.set(review.id, promise);
      renderProgress();

      // Stagger start
      if (queueIndex < REVIEWS.length && promises.size < MAX_CONCURRENCY) {
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
  console.log(`${colors.bright}Review Action Implementation Pipeline${colors.reset}`);
  console.log(`Reviews: ${REVIEWS.length}`);
  console.log(`Concurrency: ${MAX_CONCURRENCY}`);
  console.log(`Type filter: ${REVIEW_TYPE}`);
  if (DRY_RUN) {
    console.log(`${colors.yellow}Mode: DRY RUN (no changes)${colors.reset}`);
  }
  if (RETRY_FAILED) {
    console.log(`${colors.magenta}Mode: Retrying failed${colors.reset}`);
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

  // Warning for non-dry-run
  if (!DRY_RUN) {
    console.log(`${colors.yellow}WARNING: This pipeline will modify code files!${colors.reset}`);
    console.log(`${colors.yellow}Use --dry-run to preview without changes.${colors.reset}`);
    console.log();
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)');
    await sleep(3000);
  }

  // Initialize states
  for (const review of REVIEWS) {
    pipelineStates.set(review.id, {
      status: 'queued',
      startTime: null,
      currentStage: null,
      stagesCompleted: 0,
      error: null,
    });
  }

  // Start processing
  console.log('Starting implementation...');
  await sleep(1000);

  renderProgress();

  await processQueue(template);

  // Save failed
  if (failedPipelines.length > 0) {
    const errors = {};
    failedPipelines.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Unknown';
    });
    saveFailedReviews(failedPipelines, errors);
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

  console.log(`${colors.bright}${colors.green}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║${colors.reset}                ${colors.bright}Review Actions Implementation Complete${colors.reset}            ${colors.green}║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  if (DRY_RUN) {
    console.log(`  ${colors.yellow}*** DRY RUN - No changes were made ***${colors.reset}`);
    console.log();
  }

  console.log(`  Total Time:   ${colors.cyan}${totalTime}${colors.reset}`);
  console.log(`  Completed:    ${colors.green}${completedPipelines.length}${colors.reset}`);
  console.log(`  Failed:       ${colors.red}${failedPipelines.length}${colors.reset}`);
  console.log(`  Total Stages: ${colors.blue}${totalStagesCompleted}${colors.reset}`);
  console.log();

  if (completedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.green}Completed:${colors.reset}`);
    for (const reviewId of completedPipelines) {
      const review = REVIEWS.find(r => r.id === reviewId);
      console.log(`    ${colors.green}✓${colors.reset} ${review?.displayName || reviewId}`);
    }
    console.log();
  }

  if (failedPipelines.length > 0) {
    console.log(`  ${colors.bright}${colors.red}Failed:${colors.reset}`);
    for (const reviewId of failedPipelines) {
      const review = REVIEWS.find(r => r.id === reviewId);
      const error = categorizeError(failedErrors.get(reviewId));
      console.log(`    ${colors.red}✗${colors.reset} ${review?.displayName || reviewId}`);
      console.log(`      ${colors.dim}${error}${colors.reset}`);
    }
    console.log();
    console.log(`  ${colors.yellow}To retry failed:${colors.reset}`);
    console.log(`    node run-review-actions.js --retry-failed`);
    console.log();
  }

  console.log(`  Action Logs: ${colors.cyan}${OUTPUT_DIR}${colors.reset}`);
  console.log();

  if (!DRY_RUN && completedPipelines.length > 0) {
    console.log(`  ${colors.bright}Next Steps:${colors.reset}`);
    console.log(`    1. Review action logs in ${OUTPUT_DIR}`);
    console.log(`    2. Run tests: cargo test && npm test`);
    console.log(`    3. Review git diff for changes made`);
    console.log(`    4. Commit changes if satisfied`);
    console.log();
  }

  process.exit(failedPipelines.length > 0 ? 1 : 0);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log();
  console.log(`${colors.yellow}Interrupted by user${colors.reset}`);
  console.log(`Completed: ${completedPipelines.length}, Failed: ${failedPipelines.length}`);

  const remaining = REVIEWS.slice(queueIndex).map(r => r.id);
  const allFailed = [...failedPipelines, ...remaining.filter(id => !completedPipelines.includes(id))];
  if (allFailed.length > 0) {
    const errors = {};
    allFailed.forEach(id => {
      errors[id] = failedErrors.get(id) || 'Interrupted';
    });
    saveFailedReviews(allFailed, errors);
    console.log(`Saved ${allFailed.length} incomplete actions for --retry-failed`);
  }

  process.exit(130);
});

main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
