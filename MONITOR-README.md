# Pipeline Monitor

A specialized chat interface for monitoring and interacting with the Claude Plus pipeline/proxy system.

## What is it?

The Pipeline Monitor is a context-aware chat interface that connects you directly to Claude Code CLI, but with full knowledge of your project's architecture, log locations, and debugging strategies. It's like having a system administrator who knows exactly where everything is and how to check it.

## Key Features

- **Context-Aware**: Knows your project structure, file locations, and where to find logs
- **Smart Log Parsing**: Automatically checks structured execution logs FIRST (`proxy/pipelines/*_execution.json`) before falling back to the large proxy.log
- **Quick Commands**: One-click access to common monitoring tasks
- **Real-time Chat**: Natural language interaction with Claude Code CLI
- **Project-Specific**: Tailored specifically for the claudeplus system

## Quick Start

```bash
./start-monitor.sh
```

Then open: http://localhost:3004/pipeline-monitor.html

## What the Monitor Knows

The monitor is pre-configured with knowledge about:

### File Locations
- Structured execution logs: `proxy/pipelines/*_execution.json`
- Pipeline states: `proxy/pipeline-states/current.json`
- Agent definitions: `agents/*.json`
- Templates: `templates/*.json`
- Plain text log (last resort): `proxy/proxy.log`

### Common Tasks
- Check system status
- Find recent errors in execution logs
- Show current pipeline state
- List available pipelines and agents
- Run health checks
- Parse JSON logs intelligently

### Smart Behaviors
- Always checks structured logs FIRST
- Uses `tail -n 100` for recent log entries
- Parses JSON for specific error patterns
- Avoids reading the 30k+ line proxy.log unless necessary
- Provides concise, actionable answers

## Quick Commands

Available via sidebar buttons:

1. **System Status** - Overview of proxy and pipeline state
2. **Current Pipeline** - What's currently running
3. **Recent Errors** - Latest errors from execution logs
4. **Execution History** - Recent pipeline executions
5. **List All Pipelines** - Available pipeline templates
6. **List Agents** - All agent definitions
7. **Health Check** - System health verification
8. **Available Templates** - Template catalog

## Example Queries

Ask natural language questions like:

- "What errors happened in the last pipeline run?"
- "Show me the current pipeline state"
- "Are there any failed stages?"
- "What's the status of the task_planner agent?"
- "Check if the proxy is healthy"
- "Show recent executions"
- "What pipelines are available?"

## How It Works

1. **WebSocket Connection**: Connects to proxy on port 8081
2. **Specialized Context**: Sends monitor-specific system context to Claude
3. **Smart Routing**: Queries are routed through `pipeline-monitor-query` message type
4. **Intelligent Execution**: Claude executes with full project context
5. **Formatted Response**: Returns parsed, actionable information

## Architecture

```
Monitor UI (Browser)
    ↓ WebSocket (port 8081)
Proxy Server
    ↓ spawns Claude Code with monitor context
Claude Code CLI
    ↓ reads logs, parses JSON, runs commands
Returns concise answer
```

## Message Types

The monitor uses specialized message types:

- `pipeline-monitor-init`: Initialize with system context
- `pipeline-monitor-query`: Send monitoring query with specialized instructions
- `assistant-message`: Receive response from Claude

## When to Use

Use the Pipeline Monitor when you want to:

- Check what's happening without manually reading logs
- Debug pipeline failures quickly
- Get status updates in natural language
- Understand system state without guessing
- Ask questions about executions, errors, or configurations

## Advantages Over Direct Claude Interaction

- **No Context Guessing**: Pre-loaded with full project knowledge
- **Smart Log Reading**: Knows which logs to check and in what order
- **Focused Queries**: Built specifically for this codebase
- **Quick Commands**: Common tasks one click away
- **Persistent Connection**: Maintains context across questions

## Tips

1. Start with quick commands to get oriented
2. Ask specific questions for better answers
3. The monitor knows to avoid the huge proxy.log file
4. Errors are parsed from structured JSON logs automatically
5. You can ask follow-up questions - context is maintained

## Requirements

- Proxy server running on port 8081
- Python 3 (for simple HTTP server)
- Modern web browser with WebSocket support

## Troubleshooting

**Monitor won't connect**
- Check if proxy is running: `nc -z localhost 8081`
- Start proxy: `./start-proxy.sh`

**No responses**
- Check browser console for errors
- Verify WebSocket connection is active (green indicator)

**Slow responses**
- Claude is reading logs and processing
- Larger log files take longer to parse

## Project Integration

The monitor is documented in:
- `CLAUDE.md`: Architecture and commands section
- Proxy server: Handles `pipeline-monitor-*` message types (server.js:690-751)
- Startup script: `start-monitor.sh`

## Future Enhancements

Potential improvements:
- Log streaming for real-time updates
- Visualization of pipeline execution
- Agent performance metrics
- Historical trend analysis
- Export monitoring reports
