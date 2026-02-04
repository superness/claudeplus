# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the chat server (serves frontend on port 3009)
npm start

# Start from parent directory
cd .. && ./start-claude-chat.sh
```

**Note**: The proxy server must be running on port 8081 for chat to work:
```bash
cd ../proxy && npm install && node server.js
```

## Architecture

Claude Chat is a web-based chat interface that connects to the Claude Plus proxy system.

```
Browser (localhost:3009) → WebSocket (8081) → Proxy Server → Claude Code CLI
```

### Components

**server.js** - Simple HTTP server for static files and chat history persistence
- Serves frontend on port 3009
- POST `/save-history` - Saves chat history as markdown files

**js/app.js** - Frontend application (~1600 lines)
- Tab management with API persistence (synced with proxy) and localStorage fallback
- WebSocket client connecting to `ws://localhost:8081`
- Message rendering with markdown support
- Real-time agent status, tool activity, and usage tracking
- Hat (context/persona) system for switching Claude's behavior
- Pipeline selector for executing multi-stage workflows

**hats/*.json** - Contextual personas
- Each hat provides a `systemPrompt`, documentation paths, and styling
- Hats are loaded from proxy and applied per-tab
- Multiple hats can be active simultaneously

### WebSocket Message Types

**Outbound (to proxy):**
- `claude-chat-init` - Initialize tab with working directory
- `user-message` - Send user input to Claude
- `abort-claude` - Cancel running request
- `get-hats` / `set-hat` / `save-hat` / `delete-hat` - Hat management
- `get-templates` - Load available pipelines

**Inbound (from proxy):**
- `claude-chat-init-ack` - Tab initialized with conversationId
- `assistant-message` / `assistant-message-stream` - Claude responses
- `agent-stream` - Real-time tool/thinking/todo updates
- `ai-usage` - Token usage and cost
- `hats-list` / `hat-data` - Hat data
- `templates-list` - Available pipelines
- `pipeline-started` / `pipeline-status` / `pipeline-completed` - Pipeline execution

### Tab State Structure

Each tab maintains:
- `id`, `title`, `directory` - Identity and working path
- `conversationId` - Links to proxy conversation
- `messages` - Array of `{type, content, metadata}`
- `hatIds` - Active hats for this tab
- `pipelineId` - Selected pipeline (null = direct chat)
- Usage tracking: `totalCost`, `totalInputTokens`, `totalOutputTokens`
- Activity state: `toolLog`, `todos`, `streamText`, `thinkingText`

### Key Functions in app.js

- `connectWebSocket()` - Establishes connection to proxy
- `handleMessage(msg)` - Routes incoming WebSocket messages
- `sendMessage()` - Sends user input to Claude
- `createTab()` / `switchToTab()` / `closeTab()` - Tab lifecycle
- `loadHats()` / `renderHatSelector()` - Hat system
- `handleAgentStream()` - Processes real-time agent updates (tools, thinking, todos)

## File Structure

```
claude-chat/
├── server.js              # HTTP server (port 3009)
├── index.html             # Main UI
├── js/app.js              # Frontend application
├── css/style.css          # Styling (~24KB)
├── hats/                  # Hat definitions
│   ├── default.json       # No-context default
│   ├── claudeplus.json    # Claude Plus expert mode
│   └── *.json             # Other personas
└── .chat-history-*.md     # Persisted chat histories
```

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
