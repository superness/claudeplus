# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ongoing Issues
- 9 is still running long

## Commands

### Proxy Server
- **Start WSL Proxy Server**: `./start-proxy.sh` (runs on port 8081)
- **Proxy Manual Start**: `cd proxy && npm install && node server.js`

### Electron Apps
- **Main App**: `npm install && npm start` (or `npm run dev`)

## Architecture

This is a Claude Proxy System with a three-tier architecture:

```
Windows Electron App → WebSocket → WSL Proxy Server → Claude Code
```

### Core Components

1. **Main Electron App** (`src/`): Windows GUI chat interface
   - Entry point: `src/main.js`
   - WebSocket client connecting to proxy on port 8081
   - Uses preload script for secure IPC

2. **WSL Proxy Server** (`proxy/`): Node.js WebSocket server
   - Entry point: `proxy/server.js`
   - Manages Claude Code processes via spawn
   - Includes multi-agent system (`multi-agent-system.js`)
   - Logs to `/mnt/c/github/claudeplus/proxy/proxy.log`


### Key Technical Details

- Proxy server kills existing processes on port 8081 before starting
- Electron apps use `contextIsolation: true` and `nodeIntegration: false`
- WebSocket communication for real-time messaging
- Multi-agent system for request/response processing

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.