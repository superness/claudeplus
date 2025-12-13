# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Proxy Server
- **Start WSL Proxy Server**: `./start-proxy.sh` (runs on port 8081)
- **Manual Start**: `cd proxy && npm install && node server.js`

### Electron Apps
- **Main Chat App**: `npm install && npm start` (or `npm run dev`)

### Pipeline System
- **Start Pipeline System**: `./start-pipeline-system.sh` (launches proxy + file server + web UI on http://localhost:3003)
- **Start Pipeline Monitor**: `./start-monitor.sh` (launches monitoring interface on http://localhost:3004/pipeline-monitor.html)
- **Start Infographic Viewer**: `./start-infographic-viewer.sh` (launches rich media viewer on http://localhost:3005/infographic-viewer.html)
- **Start Game Dev Studio**: `./start-game-dev-studio.sh` (launches AI development partner on http://localhost:3006/game-dev-studio.html)
- **Start SuperCoin Dev Studio**: `./start-supercoin-dev-studio.sh` (launches focused dev environment on http://localhost:3007/supercoin-dev-studio.html)

### MCP Server Components
- **Browser Automation Server**: `cd mcp-servers/browser-automation && npm install && npm start`
- **Browser Automation Dev**: `cd mcp-servers/browser-automation && npm run dev`

## Architecture

This is a Claude Proxy System with a three-tier architecture:

```
Windows Electron App → WebSocket (port 8081) → WSL Proxy Server → Claude Code Processes
```

### Core Components

1. **Main Electron App** (`src/`): Windows GUI chat interface
   - Entry point: `src/main.js`
   - Renderer: `src/renderer.js`, `src/index.html`
   - WebSocket client connecting to proxy on port 8081
   - Uses secure IPC with `contextIsolation: true` and `nodeIntegration: false`
   - Includes directory selection for changing Claude working directory

2. **WSL Proxy Server** (`proxy/server.js`): Node.js WebSocket server
   - Manages WebSocket connections from Electron clients
   - Spawns Claude Code processes directly
   - Tracks conversation history per client
   - Manages working directories (converts Windows paths to WSL paths)
   - Logs to `proxy/proxy.log`
   - Claude instances execute in `output/` directory (auto-created with permissions config)

3. **Pipeline Designer** (`src/pipeline-designer.js`, `src/pipeline-designer.html`): Visual pipeline editor
   - Drag-and-drop interface for building AI agent pipelines
   - Uses templates from `templates/*.json`
   - Configures agent workflows dynamically
   - Can be accessed standalone via `./start-pipeline-system.sh`

4. **Pipeline Monitor** (`pipeline-monitor.html`): Specialized monitoring interface
   - Chat interface with Claude Code CLI for system monitoring
   - Context-aware about project structure and log locations
   - Intelligently parses structured execution logs (proxy/pipelines/*_execution.json)
   - Quick commands for status, errors, execution history, health checks
   - Knows to check structured logs FIRST before reading proxy.log
   - Access via `./start-monitor.sh` on http://localhost:3004/pipeline-monitor.html

   **How to Read Execution Logs Correctly:**

   **CRITICAL RULE**: A pipeline stage is ONLY complete when you see a completion event (`stage_completed`, `stage_error`, or `stage_routed`) AFTER the `stage_started` event.

   **Correct Procedure**:
   1. Read last 50-100 lines: `tail -n 100 /path/to/pipeline_execution.json`
   2. Find the LAST `stage_started` event (bottom of log)
   3. Check if a completion event exists AFTER it (same stageId)
   4. If NO completion event → pipeline is **STILL RUNNING**
   5. If completion event exists → stage is **COMPLETE**

   **Event Types**:
   - `pipeline_initialized` - Pipeline configuration loaded
   - `stage_started` - Stage began execution (timestamp = start time, NOT completion time)
   - `stage_completed` - Stage finished successfully with results
   - `stage_error` - Stage failed with error details
   - `stage_routed` - Stage returned routing decision (next_stage)
   - `pipeline_completed` - Entire pipeline finished

   **Example - Pipeline Still Running**:
   ```json
   {"eventType": "stage_started", "timestamp": "2025-11-23T16:06:22.364Z", "stageId": "handle_recovery"}
   [no more events after this]
   ```
   Status: Stage 16 is RUNNING (started at 16:06, no completion yet)

   **Example - Pipeline Complete**:
   ```json
   {"eventType": "stage_started", "timestamp": "2025-11-23T16:06:22.364Z", "stageId": "handle_recovery"}
   {"eventType": "stage_completed", "timestamp": "2025-11-23T16:08:45.123Z", "stageId": "handle_recovery"}
   ```
   Status: Stage 16 COMPLETED (finished at 16:08, took 2min 23sec)

   **Common Mistake**:
   ❌ Seeing `stage_started` timestamp and assuming it's complete
   ✅ Always verify a completion event exists AFTER `stage_started`

5. **Pipeline Infographic Viewer** (`infographic-viewer.html`): Real-time visual execution reports
   - Rich HTML infographics generated during pipeline runs
   - Visual timeline of all stages with agent outputs
   - Agent decisions, routing, and error tracking
   - Auto-refresh every 2 seconds for real-time updates
   - Support for images, code snippets, and structured data
   - Designed for reviewing development process and debugging
   - Generated by `InfographicGenerator` class in `proxy/infographic-generator.js`
   - Infographics stored in `proxy/pipeline-infographics/`
   - Access via `./start-infographic-viewer.sh` on http://localhost:3005/infographic-viewer.html

   **NEW: AI Story Reports** - Magical, narrative-driven execution summaries
   - After pipeline completion, `InfographicNarrator` generates beautiful story reports
   - Uses Claude Code with the `infographic_narrator` agent to create engaging narratives
   - Tells the story of what happened in an accessible, non-technical way
   - Includes progressive disclosure: simple summaries → detailed narratives → technical deep-dives
   - Modern, animated HTML with:
     - Starfield background with floating hero section
     - Chapter-based storytelling with emoji indicators
     - Mood-based visual styling (discovery, challenge, triumph, setback, resolution)
     - Collapsible technical details for each chapter
     - Beautiful conclusion with outcomes, lessons, and metrics
     - Full technical appendix with timeline, agent insights, and data flows
   - Files generated per run:
     - `narrative.json` - AI-generated story structure
     - `story.html` - Beautiful HTML story report (open this!)
   - Auto-generated on pipeline completion (async, non-blocking)
   - Manual generation: `cd proxy && node test-narrator.js [pipeline-id]`
   - Located in: `proxy/pipeline-infographics/<pipeline-id>/run_<timestamp>/story.html`

6. **Game Dev Studio** (`game-dev-studio.html`): AI development partner chat interface
   - Natural conversation with Claude Code CLI for game development
   - Automatically triggers pipeline execution when building features
   - Can modify its own interface based on user requests
   - Real-time pipeline progress tracking with visual updates
   - Directory targeting for working on any game project
   - Specialized context for game development workflows
   - Quick commands for common development tasks
   - Access via `./start-game-dev-studio.sh` on http://localhost:3006/game-dev-studio.html

7. **SuperCoin Dev Studio** (`supercoin-dev-studio.html`): Focused development environment for SuperCoinServ
   - Dedicated chat interface with Claude Code CLI for the SuperCoinServ project
   - Pre-configured working directory: `/mnt/c/github/private-SuperCoinServ`
   - Context-aware development assistance (codebase exploration, debugging, testing)
   - Can run bug-fix and feature-development pipelines
   - Quick commands for project status, tests, code review
   - Real-time pipeline progress tracking
   - Can modify its own interface based on user requests
   - Orange/gold color scheme distinct from other studios
   - Access via `./start-supercoin-dev-studio.sh` on http://localhost:3007/supercoin-dev-studio.html

   **Pipeline Execution Format:**
   ```
   [PIPELINE-EXECUTE]
   {
     "pipelineName": "pool-bug-fix" | "pool-feature-development" | "full-mining-cycle",
     "userPrompt": "Description of task",
     "workingDirectory": "/mnt/c/github/private-SuperCoinServ"
   }
   [/PIPELINE-EXECUTE]
   ```

8. **MCP Browser Automation** (`mcp-servers/browser-automation/`): Playwright-based browser automation
   - Provides web scraping and browser testing capabilities

9. **Web Interfaces**: Multiple access points
   - Main Electron app (`src/index.html`)
   - Web-based chat interface (`src/claude-app-web.html`)
   - Standalone pipeline designer (via `./start-pipeline-system.sh`)
   - Pipeline monitor (via `./start-monitor.sh`)
   - Pipeline infographic viewer (via `./start-infographic-viewer.sh`)
   - Game Dev Studio (via `./start-game-dev-studio.sh`)
   - SuperCoin Dev Studio (via `./start-supercoin-dev-studio.sh`)

### Key Technical Details

- **Proxy Communication**: WebSocket on port 8081, JSON message protocol with types: `user-message`, `directory-change`, `pipeline-config`, `get-templates`, `get-agents`, `pipeline-monitor-init`, `pipeline-monitor-query`, `game-dev-studio-init`, `game-dev-studio-query`, `supercoin-dev-studio-init`, `supercoin-dev-studio-query`, `pipeline-started`, `pipeline-update`, `pipeline-completed`, `infographic-ready`, etc.
- **HTTP API**: Port 8081 also serves HTTP endpoints: `/list-infographics` for querying available pipeline visualizations
- **Path Conversion**: Windows paths (C:\path) automatically converted to WSL paths (/mnt/c/path) in proxy
- **Process Management**: Proxy kills existing processes on port 8081 before starting
- **Conversation History**: Maintained per WebSocket client for context across requests
- **Pipeline Persistence**: Active pipelines saved to `proxy/pipelines/*.json`, templates in `templates/`, agents in `agents/`
- **Infographic Generation**: Real-time HTML reports generated in `proxy/pipeline-infographics/`, updated on every pipeline event
- **Claude Code Execution**: All Claude instances run in `output/` directory with pre-configured permissions (Write, Edit, Bash, Read, Glob, Grep)

## Agent System

The system uses 38+ JSON-defined agents organized by category:

### Core Workflow Agents
- **task_planner**: Creates execution plans with UNDERSTANDING, APPROACH, STEPS, TEST_CONSIDERATIONS, EVIDENCE, CONFIDENCE
- **task_executor**: Executes the plan with tool usage
- **proof_validator**: Validates execution results
- **discerning_expert**: Reviews plans before execution

### Specialized Agent Categories
- **Game Design**: combat_designer, economy_designer, geography_designer, lore_architect, culture_architect
- **System Design**: system_designer, systems_integrator, api_designer, data_modeler, code_generator
- **Validation**: design_validator, technical_validator, gameplay_validator, ecology_validator, narrative_validator
- **Analysis**: balance_analyzer, balance_auditor, engagement_scorer, emergence_detector, player_experience_simulator
- **Testing & Validation**:
  - **test_planner**: Writes actual test script files (not just plans)
  - **feature_validator**: Executes pre-written test scripts for feature validation
  - **game_runner**: Executes bug reproduction scripts
  - **qa_tester**: Final test quality checks
  - **final_integrator**: Integration testing
- **Test Management**: test_librarian (collects, validates, and commits tests to library)
- **Domain Experts**: world_historian, sociologist_reviewer, market_simulator, resource_designer, progression_designer

### Mining Automation Agents (SuperCoinServ)
17 specialized agents for cryptocurrency mining pool development in `agents/`:
- **Infrastructure**: bitcoin_daemon_manager, pool_server_manager, miner_manager, wallet_manager
- **Integration**: daemon_pool_connector, miner_pool_connector, job_validator, share_validator, block_validator
- **System Testing**: cycle_integration_tester, performance_analyzer, stratum_monitor, rpc_tester, network_monitor
- **Support**: config_generator, log_analyzer, error_recovery_agent

### Template System
Pre-configured pipeline workflows in `templates/`:

**General Development:**
- `claude-plus-v1.json`: Basic Claude Plus workflow
- `bug-fix-v1.json`: Comprehensive bug fix pipeline with test finalization
- `feature-development-v1.json`: Test-first feature development with test finalization
- `game-design-v1.json`: Game development pipeline
- `living-game-world-v1.json`: Complex world simulation pipeline
- `thesis-generator-v1.json`: Academic thesis generation workflow

**Mining System Pipelines (SuperCoinServ):**
- `intelligent-mining-infrastructure-setup.json`: **NEW** Intelligent AI-orchestrated mining infrastructure setup with dynamic delegation (recommended)
- `mining-infrastructure-setup.json`: Basic mining infrastructure setup (daemon → wallet → pool → miner)
- `daemon-pool-integration.json`: Daemon↔Pool RPC integration testing
- `miner-integration.json`: Miner↔Pool stratum integration testing
- `share-submission-test.json`: Share submission validation
- `block-discovery-test.json`: Block discovery cycle validation
- `full-mining-cycle.json`: Comprehensive end-to-end mining cycle test
- `mining-health-check-v1.json`: Ongoing health monitoring and diagnostics
- `pool-feature-development.json`: Feature development with mining cycle validation
- `pool-bug-fix.json`: Bug fixing with mining cycle reproduction

### Mining Automation System

Production-ready cryptocurrency mining pool testing with real components (no mocks) for SuperCoinServ development. Handles: bitcoind regtest mode, funded wallets, CoiniumServ pool, miners (cpuminer/cgminer), job delivery validation, share submission testing, block discovery verification.

**Key Pipelines:**
- `intelligent-mining-infrastructure-setup` / `mining-infrastructure-setup`: Full stack setup with dependency verification
- `daemon-pool-integration` / `miner-integration`: RPC and stratum communication testing
- `full-mining-cycle`: End-to-end mining stack validation
- `pool-bug-fix` / `pool-feature-development`: Development workflows with mining cycle tests

### Meta-Pipeline Orchestration System

The meta-pipeline system provides **complete SDLC automation** - a pipeline that builds and orchestrates other pipelines. This is a second-order automation system that manages the entire software development lifecycle.

**System Overview:**

The meta-pipeline orchestrator (`meta-pipeline-orchestrator.json`) is a master workflow that:
- Builds specialized pipeline templates on demand
- Routes development tasks to appropriate workflows
- Chains pipelines together for complex multi-stage operations
- Provides health checks, monitoring, and rollback capabilities

**Built Pipeline Categories:**

1. **Development Pipelines (3):**
   - `bug-fix-pipeline.json` - Bug reproduction → fix → validation → test collection
   - `feature-development-pipeline.json` - Feature planning → TDD → validation → test collection
   - `refactoring-pipeline.json` - Code analysis → refactor → validation

2. **Testing Pipelines (3):**
   - `unit-test-pipeline.json` - Unit test creation and execution
   - `integration-test-pipeline.json` - Integration test orchestration
   - `performance-test-pipeline.json` - Performance profiling and benchmarking

3. **Deployment Pipelines (3):**
   - `build-and-package-pipeline.json` - Build artifacts → package → verify
   - `deployment-pipeline.json` - Deploy → smoke test → health check
   - `rollback-pipeline.json` - Rollback → restore state → verify

4. **Monitoring Pipelines (3):**
   - `health-check-pipeline.json` - System health monitoring
   - `performance-monitoring-pipeline.json` - Performance metrics and alerts
   - `error-detection-pipeline.json` - Error detection and triage

5. **Meta Pipelines (1):**
   - `meta-pipeline-orchestrator.json` - Routes tasks and chains workflows

**How the Meta-Orchestrator Works:**

The orchestrator uses a **routing agent** (`agent_router`) that:
1. Analyzes the user's development request
2. Determines which pipeline(s) are needed
3. Chains multiple pipelines if necessary (e.g., feature → integration-test → deploy)
4. Returns routing decisions with `next_pipeline` fields

**Example Routing Scenarios:**

- "Fix this bug" → `bug-fix-pipeline`
- "Add new feature" → `feature-development-pipeline` → `integration-test-pipeline`
- "Deploy to production" → `build-and-package-pipeline` → `deployment-pipeline` → `health-check-pipeline`
- "Rollback deployment" → `rollback-pipeline` → `health-check-pipeline`
- "Optimize performance" → `refactoring-pipeline` → `performance-test-pipeline`

**Built Agent Ecosystem:**

The meta-pipeline created **28 specialized agents** organized by workflow:

**Pipeline Builder Agents:**
- `pipeline_architect` - Designs new pipeline structures
- `agent_architect` - Creates new agent definitions
- `component_validator` - Validates pipeline/agent JSON files
- `integration_reviewer` - Reviews how pipelines integrate

**Development Agents:**
- `bug_analyzer`, `root_cause_analyzer`, `fix_implementer`
- `feature_architect`, `implementation_planner`, `code_implementer`
- `refactoring_planner`, `code_refactorer`

**Testing Agents:**
- `unit_test_writer`, `integration_test_designer`, `performance_profiler`
- `test_executor`, `test_validator`

**Deployment Agents:**
- `build_manager`, `package_creator`, `artifact_validator`
- `deployment_manager`, `smoke_tester`, `rollback_manager`

**Monitoring Agents:**
- `health_checker`, `performance_monitor`, `error_detector`
- `metrics_analyzer`, `alert_manager`

**Support Agents:**
- `agent_router` - Routes tasks to appropriate pipelines
- `diagnostics_agent` - System diagnostics and troubleshooting
- `emergency_shutdown` - Emergency shutdown and recovery

**System Size:** 66 files (53 agents, 21 pipelines) in `agents/` and `templates/` directories.

**Using the Meta-Pipeline System:**

The meta-orchestrator is designed for **complex multi-stage development workflows**:

```
[PIPELINE-EXECUTE]
{
  "pipelineName": "meta-pipeline-orchestrator",
  "userPrompt": "Add user authentication feature, test it, and deploy to staging",
  "workingDirectory": "/path/to/project"
}
```

The orchestrator will automatically chain:
1. `feature-development-pipeline` (TDD implementation)
2. `integration-test-pipeline` (E2E validation)
3. `build-and-package-pipeline` (Build artifacts)
4. `deployment-pipeline` (Deploy to staging)
5. `health-check-pipeline` (Verify deployment)

**Benefits of Meta-Pipeline System:**

1. **Self-Evolving**: The system can create new pipelines and agents as needed
2. **Intelligent Routing**: Automatically determines workflow based on task description
3. **Pipeline Chaining**: Combines multiple workflows for complex operations
4. **Complete SDLC Coverage**: Development → Testing → Deployment → Monitoring
5. **Rollback Safety**: Automated rollback with state restoration
6. **Health Monitoring**: Continuous health checks and error detection
7. **Performance Optimization**: Automated performance profiling and benchmarking

## Debugging and Logs

**IMPORTANT**: When debugging pipeline failures or execution issues, ALWAYS check the structured execution logs FIRST before reading the plain text proxy.log file.

#### Primary Debug Sources (check in this order):

1. **Structured Pipeline Execution Logs** (PREFERRED): `proxy/pipelines/<pipeline-id>_execution.json`
   - Example: `proxy/pipelines/claude-plus-v1_execution.json`
   - **USE THIS FIRST** - Contains structured JSON events with timestamps, errors, stack traces, and full execution history
   - Each event has: `timestamp`, `eventType`, `stageId`, `stageName`, `agent`, and error details
   - Events include: `pipeline_initialized`, `stage_started`, `stage_completed`, `stage_error`, `stage_routed`, `pipeline_completed`
   - Error events contain: `error` (message), `stack` (full stack trace)
   - Read the end of the file with `tail -n 100` to see recent executions
   - Each pipeline execution appends to this file with all events

2. **Pipeline State Files**: `proxy/pipeline-states/pipeline_<timestamp>.json` and `proxy/pipeline-states/current.json`
   - Contains current pipeline state: stages, connections, workingDir, completedStages, status, results
   - Use for understanding pipeline configuration and current execution state
   - `current.json` always points to the most recent pipeline

3. **Plain Text Proxy Log**: `proxy/proxy.log` (LAST RESORT)
   - Contains unstructured console output from proxy server
   - Very large file (30k+ lines), difficult to parse
   - Use only if structured logs don't exist
   - Search with grep for specific error patterns: `grep "ERROR\|ENOENT\|failed" proxy/proxy.log`

#### Common Error Patterns in Execution Logs:

- **`spawn claude ENOENT`**: Claude Code executable not found in PATH
  - Check if `claude` command is available: `which claude`
  - Fix by using `npx @anthropic-ai/claude-code` or full path in spawn calls

- **`stage_error` events**: Agent execution failed
  - Check `error` and `stack` fields in the event
  - Review `stageId` and `agent` to identify which stage failed

- **Missing `stage_completed` after `stage_started`**: Agent hung or crashed
  - Check for timeout issues or infinite loops

#### Debug Workflow Example:
```bash
# Step 1: Check structured execution log (ALWAYS START HERE)
tail -n 100 /mnt/c/github/claudeplus/proxy/pipelines/claude-plus-v1_execution.json

# Step 2: Check current pipeline state
cat /mnt/c/github/claudeplus/proxy/pipeline-states/current.json

# Step 3: Only if needed, search plain text log
grep "ERROR\|spawn.*ENOENT" /mnt/c/github/claudeplus/proxy/proxy.log | tail -n 50
```

#### Additional Debug Resources:
- **Claude Code Output**: `output/` directory with permissions pre-configured
- **Agent Definitions**: All agents stored in `agents/` directory as JSON files

## Test Library System

The system maintains a centralized test library that automatically collects tests from completed bug-fix and feature-development pipelines.

### Test Library Structure

```
test-library/
├── test-metadata.json          # Central metadata and statistics
└── categories/
    ├── bug-fixes/              # Tests from bug fix pipelines
    ├── features/               # Tests from feature development pipelines
    ├── integration/            # Integration tests
    └── regression/             # Regression tests
```

### How It Works

The test library system is integrated directly into pipeline templates as dedicated stages:

1. **Test Finalization Stage** (qa_tester agent):
   - Ensures tests are properly named and documented
   - Adds descriptive comments explaining what the test does
   - Prepares tests for collection
   - Runs after fix validation or feature completion

2. **Test Collection Stage** (test_librarian agent):
   - Scans working directory for test files (test-*.sh, test-*.bat, *.test.js, *.spec.js, reproduction-*.sh, validation-*.sh, etc.)
   - Validates each test file:
     - File exists and is readable
     - File is not empty
     - Has proper permissions (executable for .sh/.bat files)
     - Metadata file exists and is valid JSON
     - Contains meaningful code (not just comments)
   - Copies valid tests to `test-library/categories/` (bug-fixes, features, integration, regression)
   - Creates metadata sidecar files (.metadata.json) with pipeline context
   - Updates central metadata file with statistics
   - Commits test library changes to git with descriptive commit message
   - Returns decision: `tests_collected_and_committed`, `no_tests_found`, or `all_tests_invalid`

3. **Pipeline Integration**:
   - Both `bug-fix-v1` and `feature-development-v1` pipelines include these stages
   - Test collection happens as a normal pipeline stage (not proxy automation)
   - Agent has full context about pipeline, working directory, and test files
   - Git commit is created by the agent, not the proxy

4. **Metadata Tracking**: Each test includes:
   - Original file path and source directory
   - Pipeline ID, name, and type that created it
   - Timestamp when added to library
   - Auto-generated tags (bug-fix, feature, shell, javascript, reproduction, validation, etc.)
   - Extracted description from test file comments
   - Validation results (file size, code lines, permissions)

### Using the Test Library

**Query tests by category:**
```javascript
const TestLibraryManager = require('./proxy/test-library-manager');
const testLibrary = new TestLibraryManager();

// Get all bug fix tests
const bugFixTests = testLibrary.queryTests({ category: 'bug-fixes' });

// Get tests by pipeline
const pipelineTests = testLibrary.queryTests({ pipelineId: 'bug-fix-v1' });

// Get tests by tags
const reproductionTests = testLibrary.queryTests({ tags: ['reproduction'] });

// Get recent tests (last 7 days)
const recentTests = testLibrary.queryTests({
  since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
});
```

**View statistics:**
```javascript
const stats = testLibrary.getStatistics();
console.log(stats);
// {
//   totalTests: 45,
//   bugFixTests: 22,
//   featureTests: 18,
//   integrationTests: 3,
//   regressionTests: 2
// }
```

### Test File Naming Conventions

To ensure tests are collected properly, name test files with these patterns:
- `test-*.sh` or `test-*.bat` - General test scripts
- `reproduction-*.sh` or `reproduction-*.bat` - Bug reproduction scripts
- `validation-*.sh` or `validation-*.bat` - Fix validation scripts
- `*.test.js` or `*.spec.js` - JavaScript test files

### Pipeline Stages

**Bug Fix Pipeline:**
```
bug_analysis → create_reproduction → run_reproduction → verify_bug →
root_cause → implement_fix → run_validation → validate_fix →
finalize_tests → collect_tests_to_library
```

**Feature Development Pipeline:**
```
define_feature → plan_tests (writes test script) → plan_implementation →
implement_feature → run_tests (executes test script) → observe_behavior →
validate_expectations → finalize_tests → collect_tests_to_library
```

Key differences in test handling:
- **test_planner**: Uses Write tool to create `test_[feature].js` file
- **feature_validator**: Finds and executes the pre-written test script
- **test_librarian**: Collects test script to library and commits

The `collect_tests_to_library` stage:
- Uses the `test_librarian` agent
- Automatically scans, validates, and collects tests
- Creates git commit with test library changes
- Returns decision based on outcome

### Benefits

1. **Regression Prevention**: All bug reproduction tests are preserved for future regression testing
2. **Feature Validation**: Feature tests document expected behavior and can verify future changes
3. **Knowledge Base**: Tests serve as executable documentation of system behavior
4. **Automation Ready**: Tests are immediately runnable for CI/CD integration
5. **Traceable**: Every test links back to the pipeline and issue that created it
6. **Version Controlled**: All tests are committed to git with clear provenance
7. **Quality Assured**: Automatic validation ensures tests are well-formed and executable
8. **Pipeline-Driven**: Test collection is part of the workflow, not hidden automation

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.