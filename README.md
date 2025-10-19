# Claude Proxy System

A Windows application that communicates with Claude Code through a WSL proxy layer.

## Architecture

```
Windows Electron App → WebSocket → WSL Proxy Server → Claude Code
```

## Quick Start

1. **Start the WSL Proxy Server:**
   ```bash
   chmod +x start-proxy.sh
   ./start-proxy.sh
   ```

2. **Start the Windows Electron App:**
   ```bash
   npm install
   npm start
   ```

## Components

- **Electron App** (`src/`): Windows GUI with chat interface
- **WSL Proxy** (`proxy/`): Node.js server that manages Claude Code processes
- **Middleware Layer**: Built into proxy for request/response processing

## Testing

The proxy server runs on `localhost:8080` and the Electron app connects automatically.

Type messages in the Windows app - they get sent through the proxy to Claude Code and responses come back through the same path.