# ClaudePlus

A pipeline orchestration system for Claude Code with a web-based chat interface.

## Architecture

```
Browser (Claude Chat) → WebSocket (8081) → Proxy Server → Claude Code CLI
                                              ↓
                                    Pipeline Engine (agents, templates)
```

## Quick Start

### 1. Start the Proxy Server

```bash
./start-proxy.sh
```

This starts the WebSocket proxy on port 8081 that manages Claude Code processes.

### 2. Start Claude Chat (Web Interface)

```bash
./start-claude-chat.sh
```

Opens at **http://localhost:3009** - a full-featured chat interface with:
- Multi-tab conversations
- "Hats" system for different contexts/personas
- Token usage tracking
- Pipeline execution support

## Components

### Core
- **Proxy Server** (`proxy/server.js`): WebSocket server managing Claude Code processes
- **Claude Chat** (`claude-chat/`): Web-based chat interface

### Pipeline System
- **Agents** (`agents/`): 80+ JSON-defined AI agents for specialized tasks
- **Templates** (`templates/`): Pre-configured pipeline workflows
- **Pipeline Engine**: Orchestrates multi-agent workflows

### Additional Interfaces
- `./start-pipeline-system.sh` - Visual pipeline designer (port 3003)
- `./start-monitor.sh` - Pipeline monitoring (port 3004)
- `./start-infographic-viewer.sh` - Visual execution reports (port 3005)

## Requirements

- Node.js 18+
- Claude Code CLI (`claude` command available in PATH)
- WSL2 (for Windows users)

## Configuration

The system uses Claude Code's built-in authentication. No API keys needed in config files.

For pipeline execution, agents run in the `output/` directory with pre-configured permissions.

## Project Structure

```
claudeplus/
├── proxy/              # WebSocket proxy server
├── claude-chat/        # Web chat interface
├── agents/             # Agent definitions (JSON)
├── templates/          # Pipeline templates (JSON)
├── src/                # Electron app (alternative UI)
└── output/             # Claude Code working directory
```

## License

MIT
