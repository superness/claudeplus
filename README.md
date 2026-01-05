# ClaudePlus

A suite of tools for building AI-powered applications with Claude Code. Includes chat interfaces, pipeline orchestration, and specialized development studios.

## What's Included

| Tool | Description | Port |
|------|-------------|------|
| **Claude Chat** | Multi-tab chat interface with "hats" for different contexts | 3009 |
| **AI Game Studio** | AI-assisted game development platform | 3008 |
| **Pipeline Designer** | Visual drag-and-drop pipeline builder | 3003 |
| **Pipeline Monitor** | Real-time pipeline execution monitoring | 3004 |
| **Infographic Viewer** | Visual execution reports and AI story summaries | 3005 |

## Quick Start

**Prerequisites:**
- Node.js 18+
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- WSL2 (Windows users)

### 1. Start the Proxy Server (required for all tools)

```bash
./start-proxy.sh
```

### 2. Launch Your Tool of Choice

**Claude Chat** - General purpose chat with context switching:
```bash
./start-claude-chat.sh
# Open http://localhost:3009
```

**AI Game Studio** - Build games with AI assistance:
```bash
cd ai-game-studio && npm install && npm start
# Open http://localhost:3008
```

**Pipeline Designer** - Create multi-agent workflows:
```bash
./start-pipeline-system.sh
# Open http://localhost:3003
```

## Claude Chat

A feature-rich web interface for Claude Code conversations.

**Features:**
- Multiple conversation tabs
- "Hats" system - switch between different personas/contexts (e.g., "Game Developer", "Code Reviewer")
- Token usage tracking per conversation
- Pipeline execution support
- Persistent chat history

```bash
./start-claude-chat.sh
```

## AI Game Studio

An end-to-end platform for AI-assisted game development.

**Features:**
- Describe a game idea in natural language
- AI generates design documents automatically
- Feature requests queued and processed sequentially
- Live game preview in browser
- User accounts and project management

```bash
cd ai-game-studio
npm install
npm start
```

## Pipeline System

Orchestrate complex multi-agent workflows using pre-built templates or custom pipelines.

### Available Pipeline Templates

| Template | Purpose |
|----------|---------|
| `bug-fix-v1` | Automated bug reproduction, fix, and validation |
| `feature-development-v1` | TDD-style feature implementation |
| `thesis-generator-v1` | Academic thesis generation |
| `business-plan-elaborator-v1` | Business plan development |
| `living-game-world-v1` | Complex game world simulation |
| `book-authoring-v1` | Multi-chapter book writing |

### Pipeline Tools

**Designer** - Visual pipeline builder:
```bash
./start-pipeline-system.sh  # http://localhost:3003
```

**Monitor** - Watch pipeline execution:
```bash
./start-monitor.sh  # http://localhost:3004
```

**Infographic Viewer** - Beautiful execution reports:
```bash
./start-infographic-viewer.sh  # http://localhost:3005
```

## Agent Library

80+ specialized AI agents for different tasks:

- **Development**: `task_planner`, `task_executor`, `proof_validator`, `code_generator`
- **Game Design**: `combat_designer`, `economy_designer`, `lore_architect`, `quest_writer`
- **Research**: `thesis_analyzer`, `research_synthesizer`, `whitepaper_author`
- **Business**: `market_analyst`, `revenue_modeler`, `funding_strategist`
- **Quality**: `design_validator`, `technical_validator`, `qa_tester`

Agents are defined in `agents/*.json` and can be customized or extended.

## Architecture

```
Browser → WebSocket (8081) → Proxy Server → Claude Code CLI
                                   ↓
                         Pipeline Engine
                                   ↓
                    Agents + Templates + Working Directory
```

**Key Components:**
- `proxy/server.js` - WebSocket server managing Claude Code processes
- `claude-chat/` - Web chat interface
- `ai-game-studio/` - Game development platform
- `agents/` - Agent definitions (JSON)
- `templates/` - Pipeline templates (JSON)
- `standalone-pipeline.js` - Pipeline execution engine

## Project Structure

```
claudeplus/
├── proxy/                 # WebSocket proxy server
├── claude-chat/           # Chat interface with hats
├── ai-game-studio/        # Game development platform
├── agents/                # 80+ agent definitions
├── templates/             # Pipeline templates
├── src/                   # Electron desktop app
├── mcp-servers/           # MCP server integrations
├── start-proxy.sh         # Start proxy server
├── start-claude-chat.sh   # Start chat interface
└── start-*.sh             # Various launchers
```

## Configuration

The system uses Claude Code's built-in authentication - no API keys needed in config files.

**Customizing Agents:**
Edit files in `agents/` directory. Each agent has:
- `name` - Identifier
- `systemPrompt` - Instructions for the agent
- `model` - Which Claude model to use
- `tools` - Available tools (Read, Write, Bash, etc.)

**Creating Pipelines:**
Edit files in `templates/` directory. Pipelines define:
- `stages` - Sequence of agent tasks
- `connections` - How stages link together
- `routing` - Conditional flow based on agent decisions

## Requirements

- **Node.js 18+**
- **Claude Code CLI** - Install from https://claude.ai/code
- **WSL2** - Required for Windows users (proxy runs in WSL)

## Troubleshooting

**Proxy won't start:**
```bash
# Check if port 8081 is in use
lsof -i :8081
# Kill existing process if needed
lsof -ti:8081 | xargs kill -9
```

**Claude command not found:**
```bash
# Ensure Claude Code is installed and in PATH
which claude
# If not found, add to PATH or use full path in start-proxy.sh
```

**WebSocket connection failed:**
- Ensure proxy is running (`./start-proxy.sh`)
- Check browser console for errors
- Verify port 8081 is accessible

## License

MIT
