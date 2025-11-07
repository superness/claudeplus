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

4. **MCP Browser Automation** (`mcp-servers/browser-automation/`): Playwright-based browser automation
   - Provides web scraping and browser testing capabilities

5. **Web Interfaces**: Multiple access points
   - Main Electron app (`src/index.html`)
   - Web-based chat interface (`src/claude-app-web.html`)
   - Standalone pipeline designer (via `./start-pipeline-system.sh`)

### Key Technical Details

- **Proxy Communication**: WebSocket on port 8081, JSON message protocol with types: `user-message`, `directory-change`, `pipeline-config`, `get-templates`, `get-agents`, etc.
- **Path Conversion**: Windows paths (C:\path) automatically converted to WSL paths (/mnt/c/path) in proxy
- **Process Management**: Proxy kills existing processes on port 8081 before starting
- **Conversation History**: Maintained per WebSocket client for context across requests
- **Pipeline Persistence**: Active pipelines saved to `proxy/pipelines/*.json`, templates in `templates/`, agents in `agents/`
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
- **Testing**: qa_tester, final_integrator
- **Domain Experts**: world_historian, sociologist_reviewer, market_simulator, resource_designer, progression_designer

### Template System
Pre-configured pipeline workflows in `templates/`:
- `claude-plus-v1.json`: Basic Claude Plus workflow
- `game-design-v1.json`: Game development pipeline  
- `living-game-world-v1.json`: Complex world simulation pipeline
- `thesis-generator-v1.json`: Academic thesis generation workflow

### Debugging and Logs
- **Proxy Logs**: `proxy/proxy.log` (auto-created, gitignored)
- **Claude Code Output**: `output/` directory with permissions pre-configured
- **Pipeline State**: Active pipelines saved to `proxy/pipelines/*.json`
- **Agent Definitions**: All agents stored in `agents/` directory as JSON files

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.