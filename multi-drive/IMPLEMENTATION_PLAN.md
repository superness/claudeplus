# Multi-Drive Maestro Implementation Plan

## Implementation Status: COMPLETE ✅

**Quick Start:**
```bash
# 1. Restart proxy server
cd /mnt/c/github/claudeplus/proxy && node server.js &

# 2. Open UI
# http://localhost:3008/maestro-orchestrator.html
# OR
./start-maestro.sh
```

All core components have been implemented:

- [x] Decision Parser (`src/decision-parser.js`)
- [x] API Client (`src/api-client.js`)
- [x] Maestro Client (`src/maestro-client.js`)
- [x] Agent Hats (`hats/*.json` and copied to `claude-chat/hats/`)
- [x] Proxy API Endpoints (`/api/maestro/*`)
- [x] Tab Schema Extension (maestro fields)
- [x] Maestro UI (`maestro-orchestrator.html`)
- [x] WebSocket handlers for real-time updates
- [x] Start script (`start-maestro.sh`)

### Quick Start

```bash
# From the multi-drive directory
cd /mnt/c/github/claudeplus/multi-drive

# Execute a Maestro orchestration
node src/index.js execute "Add a dark mode toggle to the settings page" \
  --dir /mnt/c/your/project \
  --hat product-maestro

# Check status
node src/index.js status maestro-1234567890

# Abort if needed
node src/index.js abort maestro-1234567890
```

### Programmatic Usage

```javascript
const { MaestroClient } = require('./src');

const maestro = new MaestroClient({
  baseUrl: 'http://localhost:8081',
  maxParallel: 3
});

maestro.onProgress = (event) => console.log(event);
maestro.onChildCreated = (info) => console.log('Child created:', info);
maestro.onChildCompleted = (info) => console.log('Child completed:', info);

const result = await maestro.execute(
  "Implement user authentication with OAuth",
  { workingDirectory: '/mnt/c/project' }
);
```

---

## Design Decisions (User-Specified)

1. **Parallel Execution**: Up to 3 agents run simultaneously
2. **UI Display**: Flat tab list with parent indicators (not nested tree)
3. **Tab Persistence**: Child tabs persist after completion (not auto-cleanup)
4. **Result Handling**: Parent tab receives callback with child result to decide next action

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│        "Implement user authentication with OAuth"                │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Product Maestro Tab (Parent)                                    │
│  Hat: product-maestro                                            │
│  ─────────────────────────────────────────────────────────────  │
│  1. ABUDDI evaluation: Complexity 8/10                           │
│  2. Decision: DELEGATE (3 subtasks)                              │
│  3. Output markers parsed by orchestrator                        │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ Child Tab 1     │        │ Child Tab 2     │        │ Child Tab 3     │
│ [→ Parent-123]  │        │ [→ Parent-123]  │        │ [→ Parent-123]  │
│ ───────────────│        │ ───────────────│        │ ───────────────│
│ "Design OAuth"  │        │ "Implement JWT" │        │ "Write tests"   │
│ Hat: feature-   │        │ Hat: sub-ic     │        │ Hat: sub-ic     │
│ owner           │        │                 │        │                 │
│                 │        │ ATOMIC ✓        │        │ ATOMIC ✓        │
│ Delegates...    │        │ Returns result  │        │ Returns result  │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         │                 ┌────────┴────────┐                 │
         │                 ▼                 ▼                 │
         │        ┌───────────────┐ ┌───────────────┐          │
         │        │ Grandchild 1  │ │ Grandchild 2  │          │
         │        │ [→ Child-1]   │ │ [→ Child-1]   │          │
         │        └───────────────┘ └───────────────┘          │
         │                                                     │
         └────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Product Maestro Tab (Parent)                                    │
│  Receives: [result1, result2, result3]                           │
│  Synthesizes final response                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Extended Tab Schema

**Current schema** (`proxy/server.js` line 677):
```javascript
{
  name: string,
  messages: Message[],
  workingDirectory: string,
  hatIds: string[],
  createdAt: number,
  lastActivity: number
}
```

**Extended schema for Maestro**:
```javascript
{
  // Existing fields
  name: string,
  messages: Message[],
  workingDirectory: string,
  hatIds: string[],
  createdAt: number,
  lastActivity: number,

  // NEW: Maestro orchestration fields
  maestro: {
    parentTabId: string | null,       // Tab that created this one (null = root)
    childTabIds: string[],            // Tabs created by this one
    status: 'active' | 'waiting' | 'complete' | 'failed',

    // Only present when status === 'waiting'
    pendingChildren: number,          // How many children haven't returned
    childResults: {                   // Results received from children
      [childTabId]: {
        status: 'success' | 'failure',
        result: any,
        receivedAt: number
      }
    },

    // Metadata for debugging/visualization
    depth: number,                    // 0 = root, 1 = child, 2 = grandchild
    originalRequest: string,          // What was asked of this tab
    delegationReason: string          // Why this tab delegated (complexity score, etc)
  }
}
```

---

## Delegation Protocol

### Output Markers

When an agent decides to delegate, it outputs structured markers:

```
MAESTRO_DECISION: DELEGATE

COMPLEXITY_SCORE: 7/10
COMPLEXITY_BREAKDOWN:
- Atomic Scope: 8 files (HIGH)
- Breadth: 3 domains (MEDIUM)
- Uncertainty: Auth patterns unclear (MEDIUM)
- Dependencies: DB, Redis, Frontend (HIGH)
- Depth: 2 layers (LOW)
- Impact: Core system (HIGH)

DELEGATION_REASON: Task requires OAuth integration, JWT implementation, and comprehensive testing across multiple domains.

[SUBTASK]
{
  "name": "Design OAuth Integration",
  "hat": "feature-owner",
  "priority": 1,
  "context": "Design the OAuth 2.0 flow for Google/GitHub providers. Output: API specification and data models.",
  "workingDirectory": "/mnt/c/project",
  "dependencies": []
}
[/SUBTASK]

[SUBTASK]
{
  "name": "Implement JWT Token System",
  "hat": "sub-ic",
  "priority": 1,
  "context": "Implement JWT generation, validation, and refresh token logic.",
  "workingDirectory": "/mnt/c/project",
  "dependencies": []
}
[/SUBTASK]

[SUBTASK]
{
  "name": "Write Authentication Tests",
  "hat": "sub-ic",
  "priority": 2,
  "context": "Create comprehensive test suite for auth flows.",
  "workingDirectory": "/mnt/c/project",
  "dependencies": ["Design OAuth Integration"]
}
[/SUBTASK]
```

### Implementation Markers

When an agent handles work directly:

```
MAESTRO_DECISION: IMPLEMENT

IMPLEMENTATION_SUMMARY: Created JWT utility module with generation and validation functions.

FILES_MODIFIED:
- src/auth/jwt.js (created)
- src/auth/index.js (modified)

RESULT:
{
  "status": "success",
  "artifacts": ["src/auth/jwt.js"],
  "notes": "Used RS256 algorithm for enhanced security"
}
```

---

## API Endpoints

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/maestro/execute` | Start a Maestro orchestration |
| `GET` | `/api/maestro/status/:rootTabId` | Get orchestration tree status |
| `POST` | `/api/maestro/result/:tabId` | Report child result to parent |
| `POST` | `/api/maestro/abort/:rootTabId` | Abort entire tree |

### POST /api/maestro/execute

**Request:**
```json
{
  "message": "Implement user authentication with OAuth",
  "workingDirectory": "/mnt/c/project",
  "maxParallelAgents": 3,
  "hatId": "product-maestro"
}
```

**Response:**
```json
{
  "rootTabId": "maestro-1234",
  "status": "started",
  "message": "Maestro orchestration started"
}
```

### POST /api/maestro/result/:tabId

Called internally when a child tab completes.

**Request:**
```json
{
  "childTabId": "child-567",
  "status": "success",
  "result": { ... }
}
```

**Triggers:** Parent tab receives a new message with the result, allowing it to decide what to do next.

---

## Hat Definitions

### product-maestro.json

```json
{
  "id": "product-maestro",
  "name": "Product Maestro",
  "description": "Top-level orchestrator that evaluates complexity and delegates to Feature Owners",
  "icon": "crown",
  "color": "#7c3aed",
  "systemPrompt": "...(see below)..."
}
```

**System Prompt Core:**
```
You are the Product Maestro - the top-level orchestrator in a recursive AI delegation system.

## Your Role
You receive high-level requests and decide whether to:
1. IMPLEMENT directly (if atomic/simple)
2. DELEGATE to Feature Owners (if complex)

## ABUDDI Complexity Scoring

Score each dimension 1-10:
- **A**tomic Scope: How many files/modules affected?
- **B**readth: How many expertise domains needed?
- **U**ncertainty: How many unknowns to resolve?
- **D**ependencies: How many integration points?
- **D**epth: How many layers of abstraction?
- **I**mpact: What's the blast radius of changes?

**Thresholds:**
- Score < 20: IMPLEMENT directly
- Score 20-35: Delegate to 1 Feature Owner
- Score 35-50: Delegate to 2-3 Feature Owners
- Score > 50: Requires decomposition into smaller features

## Output Format

For DELEGATE decisions, output:
```
MAESTRO_DECISION: DELEGATE

COMPLEXITY_SCORE: X/60
COMPLEXITY_BREAKDOWN:
- Atomic Scope: X (reasoning)
- Breadth: X (reasoning)
...

[SUBTASK]
{
  "name": "...",
  "hat": "feature-owner" | "sub-ic",
  "priority": 1 | 2,
  "context": "...",
  "workingDirectory": "...",
  "dependencies": []
}
[/SUBTASK]
```

For IMPLEMENT decisions, do the work and output:
```
MAESTRO_DECISION: IMPLEMENT
...actual implementation...
RESULT: { "status": "success", ... }
```
```

### feature-owner.json

Same pattern but scoped to feature-level decisions. Delegates to Sub-ICs.

### sub-ic.json

Implementation-focused. Rarely delegates, usually IMPLEMENTs.

### synthesizer.json

Receives results from multiple children and produces a coherent summary.

---

## Orchestration Flow (maestro-client.js)

```javascript
class MaestroOrchestrator {
  constructor(proxyBaseUrl, maxParallel = 3) {
    this.proxyBaseUrl = proxyBaseUrl;
    this.maxParallel = maxParallel;
    this.activeChildren = new Map(); // tabId -> Promise
  }

  /**
   * Main entry point for Maestro orchestration
   */
  async execute(request, workingDirectory, rootHat = 'product-maestro') {
    // 1. Create root tab
    const rootTab = await this.createTab({
      name: `Maestro: ${request.slice(0, 30)}...`,
      workingDirectory,
      hatIds: [rootHat],
      maestro: {
        parentTabId: null,
        childTabIds: [],
        status: 'active',
        depth: 0,
        originalRequest: request
      }
    });

    // 2. Send request and wait for decision
    return await this.processTab(rootTab.tabId, request);
  }

  /**
   * Process a single tab - either implement or delegate
   */
  async processTab(tabId, message) {
    // Send message to tab
    const response = await this.sendMessage(tabId, message);

    // Parse decision markers
    const decision = this.parseDecision(response);

    if (decision.type === 'IMPLEMENT') {
      // Mark tab complete, return result
      await this.updateTabStatus(tabId, 'complete');
      return decision.result;
    }

    if (decision.type === 'DELEGATE') {
      // Create child tabs and process
      return await this.handleDelegation(tabId, decision.subtasks);
    }
  }

  /**
   * Handle delegation to child tabs with parallel execution
   */
  async handleDelegation(parentTabId, subtasks) {
    // Group by priority
    const byPriority = this.groupByPriority(subtasks);
    const results = [];

    for (const priorityGroup of byPriority) {
      // Process up to maxParallel at once within priority group
      const chunks = this.chunk(priorityGroup, this.maxParallel);

      for (const chunk of chunks) {
        // Create and process children in parallel
        const chunkPromises = chunk.map(subtask =>
          this.processSubtask(parentTabId, subtask)
        );

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        // Report each result to parent
        for (const result of chunkResults) {
          await this.reportResultToParent(parentTabId, result);
        }
      }
    }

    // After all children complete, synthesize
    return await this.synthesize(parentTabId, results);
  }

  /**
   * Process a single subtask - creates child tab and recurses
   */
  async processSubtask(parentTabId, subtask) {
    const parent = await this.getTab(parentTabId);

    // Create child tab
    const childTab = await this.createTab({
      name: subtask.name,
      workingDirectory: subtask.workingDirectory,
      hatIds: [subtask.hat],
      maestro: {
        parentTabId,
        childTabIds: [],
        status: 'active',
        depth: parent.maestro.depth + 1,
        originalRequest: subtask.context
      }
    });

    // Add to parent's children
    await this.addChildToParent(parentTabId, childTab.tabId);

    // RECURSIVE CALL - same pattern!
    const result = await this.processTab(childTab.tabId, subtask.context);

    return {
      tabId: childTab.tabId,
      name: subtask.name,
      status: result.status || 'success',
      result
    };
  }

  /**
   * Report child result to parent tab
   */
  async reportResultToParent(parentTabId, childResult) {
    // Update parent's tracking
    const parent = await this.getTab(parentTabId);
    parent.maestro.childResults[childResult.tabId] = {
      status: childResult.status,
      result: childResult.result,
      receivedAt: Date.now()
    };
    await this.updateTab(parentTabId, parent);

    // Send message to parent about the result
    const resultMessage = `
CHILD_RESULT_RECEIVED:
{
  "childTabId": "${childResult.tabId}",
  "childName": "${childResult.name}",
  "status": "${childResult.status}",
  "result": ${JSON.stringify(childResult.result, null, 2)}
}

Based on this result, decide:
1. Are more subtasks needed?
2. Should we proceed to synthesis?
3. Is retry needed?
`;

    await this.sendMessage(parentTabId, resultMessage);
  }

  /**
   * Synthesize results from all children
   */
  async synthesize(parentTabId, childResults) {
    const synthesisMessage = `
ALL_CHILDREN_COMPLETE:
${JSON.stringify(childResults, null, 2)}

Synthesize these results into a coherent response for the original request.
`;

    // Switch to synthesizer hat for this phase
    await this.updateTabHats(parentTabId, ['synthesizer']);
    const synthesized = await this.sendMessage(parentTabId, synthesisMessage);

    await this.updateTabStatus(parentTabId, 'complete');
    return synthesized;
  }
}
```

---

## UI Changes (app.js)

### Tab Display with Parent Indicators

**Current tab HTML:**
```html
<div class="tab" data-tab-id="tab-123">
  <span class="tab-name">My Tab</span>
  <button class="close-tab">×</button>
</div>
```

**With Maestro indicator:**
```html
<div class="tab tab--child" data-tab-id="child-456" data-parent-id="tab-123">
  <span class="tab-parent-indicator">↳</span>
  <span class="tab-name">JWT Implementation</span>
  <span class="tab-status tab-status--active"></span>
  <button class="close-tab">×</button>
</div>
```

### CSS Additions

```css
.tab--child {
  padding-left: 1.5rem;
}

.tab--child .tab-parent-indicator {
  opacity: 0.5;
  margin-right: 0.25rem;
}

.tab-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 0.5rem;
}

.tab-status--active {
  background: #22c55e;
  animation: pulse 2s infinite;
}

.tab-status--waiting {
  background: #eab308;
}

.tab-status--complete {
  background: #3b82f6;
}

.tab-status--failed {
  background: #ef4444;
}
```

---

## File Structure

```
multi-drive/
├── src/
│   ├── maestro-client.js      # Main orchestrator class
│   ├── decision-parser.js     # Parse MAESTRO_DECISION markers
│   ├── abuddi-scorer.js       # Complexity scoring prompts
│   └── api-client.js          # HTTP client for proxy API
├── hats/
│   ├── product-maestro.json
│   ├── feature-owner.json
│   ├── sub-ic.json
│   └── synthesizer.json
├── tests/
│   ├── delegation.test.js
│   ├── synthesis.test.js
│   └── parallel.test.js
└── docs/
    ├── FEATURE_OWNER_ARCHITECTURE.md
    └── IMPLEMENTATION_PLAN.md (this file)
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Extend tab schema in `proxy/server.js`
2. Add `/api/maestro/*` endpoints
3. Create `decision-parser.js`

### Phase 2: Agent Hats
1. Create `product-maestro.json`
2. Create `feature-owner.json`
3. Create `sub-ic.json`
4. Create `synthesizer.json`

### Phase 3: Orchestrator
1. Implement `maestro-client.js`
2. Add parallel execution with max-3 limit
3. Implement result callback flow

### Phase 4: UI Integration
1. Add parent indicator to tabs
2. Add status indicators
3. Tab filtering/grouping options

### Phase 5: Testing & Refinement
1. Test single-level delegation
2. Test multi-level recursion
3. Test parallel execution limits
4. Test failure handling

---

## Open Questions

1. **WebSocket vs REST for streaming?** - Child tabs may produce long outputs. Should results stream to parent via WebSocket or batch at completion?

2. **Dependency ordering** - If subtask B depends on subtask A, should we wait for A to complete before starting B, or start B optimistically?

3. **Context window limits** - Deep recursion + synthesis could exceed context. Should we summarize intermediate results?
