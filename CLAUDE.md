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
   - Spawns Claude Code processes via `multi-agent-system.js`
   - Tracks conversation history per client
   - Manages working directories (converts Windows paths to WSL paths)
   - Logs to `proxy/proxy.log`
   - Claude instances execute in `output/` directory (auto-created with permissions config)

3. **Multi-Agent System** (`proxy/multi-agent-system.js`): Orchestration layer
   - Spawns multiple Claude Code instances for plan-review-execute-validate workflow
   - Uses agents defined in `agents/*.json` (task_planner, task_executor, proof_validator, etc.)
   - Working directory defaults to `output/` with Claude Code permissions pre-configured
   - Real-time status callbacks to proxy for UI updates

4. **Pipeline Designer** (`src/pipeline-designer.js`, `src/pipeline-designer.html`): Visual pipeline editor
   - Drag-and-drop interface for building AI agent pipelines
   - Uses templates from `templates/*.json`
   - Configures agent workflows dynamically
   - Can be accessed standalone via `./start-pipeline-system.sh`

### Key Technical Details

- **Proxy Communication**: WebSocket on port 8081, JSON message protocol with types: `user-message`, `directory-change`, `pipeline-config`, `get-templates`, `get-agents`, etc.
- **Path Conversion**: Windows paths (C:\path) automatically converted to WSL paths (/mnt/c/path) in proxy
- **Process Management**: Proxy kills existing processes on port 8081 before starting
- **Conversation History**: Maintained per WebSocket client for context across requests
- **Pipeline Persistence**: Active pipelines saved to `proxy/pipelines/*.json`, templates in `templates/`, agents in `agents/`
- **Claude Code Execution**: All Claude instances run in `output/` directory with pre-configured permissions (Write, Edit, Bash, Read, Glob, Grep)

## Agent System

The multi-agent system uses JSON-defined agents with specific roles:
- **task_planner**: Creates execution plans with UNDERSTANDING, APPROACH, STEPS, TEST_CONSIDERATIONS, EVIDENCE, CONFIDENCE
- **task_executor**: Executes the plan with tool usage
- **proof_validator**: Validates execution results
- **discerning_expert**: Reviews plans before execution
- Custom agents can be created and stored in `agents/` directory

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.