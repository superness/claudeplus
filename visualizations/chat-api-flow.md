# Chat API Process Visualization Model

This document defines visual components for understanding Claude Chat API request lifecycle.

## Request Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAT API REQUEST FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────────────┐ │
│  │ REST Client  │───▶│  POST /api/chat   │───▶│  handleChatApiSend()    │ │
│  │ (curl/app)   │    │    /send          │    │                          │ │
│  └──────────────┘    └───────────────────┘    └────────────┬─────────────┘ │
│                                                            │               │
│                                                            ▼               │
│                      ┌────────────────────────────────────────┐            │
│                      │  Generate requestId                   │            │
│                      │  chat_${counter}_${timestamp}         │            │
│                      └────────────┬───────────────────────────┘            │
│                                   │                                        │
│          ┌────────────────────────┼────────────────────────┐              │
│          │                        │                        │              │
│          ▼                        ▼                        ▼              │
│  ┌───────────────┐    ┌───────────────────┐    ┌─────────────────────┐    │
│  │ Load Tab      │    │ Build Hat Context │    │ Build History       │    │
│  │ (if tabId)    │    │ (if hatIds)       │    │ (from tab/request)  │    │
│  └───────────────┘    └───────────────────┘    └─────────────────────┘    │
│          │                        │                        │              │
│          └────────────────────────┼────────────────────────┘              │
│                                   ▼                                        │
│                      ┌────────────────────────────────────────┐            │
│                      │  Initialize Request Tracking           │            │
│                      │  chatApiRequests.set(requestId, {      │            │
│                      │    status: 'running',                  │            │
│                      │    streamingText: '',                  │            │
│                      │    tools: [],                          │            │
│                      │    todos: [],                          │            │
│                      │    errors: []                          │            │
│                      │  })                                    │            │
│                      └────────────┬───────────────────────────┘            │
│                                   │                                        │
│                                   ▼                                        │
│     ┌─────────────────────────────────────────────────────────────────┐   │
│     │                 HTTP 202 Accepted                                │   │
│     │  { requestId, tabId, status: 'running', message: '...' }       │   │
│     └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                        │
│                                   ▼                                        │
│     ┌─────────────────────────────────────────────────────────────────┐   │
│     │              executeChatApiRequest(requestId, body)              │   │
│     │                      (ASYNC - runs in background)                │   │
│     └─────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Claude CLI Process Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               CLAUDE CODE CLI PROCESS EXECUTION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  spawn(claudePath, [                                                 │   │
│  │    '--permission-mode', 'bypassPermissions',                        │   │
│  │    '--print',                                                        │   │
│  │    '--verbose',                                                      │   │
│  │    '--output-format', 'stream-json',                                │   │
│  │    '--include-partial-messages',                                     │   │
│  │    '-'   ◀── stdin for message                                      │   │
│  │  ], {                                                                │   │
│  │    cwd: workingDirectory,                                           │   │
│  │    env: { ...cleanEnv, PWD: workingDirectory }                      │   │
│  │  })                                                                  │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        STDIN                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ [Hat Context] + [History Context] + [User Message]              │  │  │
│  │  │                                                                  │  │  │
│  │  │ Example:                                                         │  │  │
│  │  │ <hat-context name="Claude Chat Dev" priority="primary">         │  │  │
│  │  │   You are wearing the Claude Chat Dev hat...                    │  │  │
│  │  │ </hat-context>                                                   │  │  │
│  │  │                                                                  │  │  │
│  │  │ Previous conversation:                                          │  │  │
│  │  │ Human: What files exist?                                        │  │  │
│  │  │ Assistant: I found index.html, app.js...                        │  │  │
│  │  │ ---                                                              │  │  │
│  │  │ Current request: Add a new button to the header                 │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                          │
│                                 ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     STDOUT (stream-json)                              │  │
│  │                                                                       │  │
│  │  ┌─ Event Types ──────────────────────────────────────────────────┐  │  │
│  │  │                                                                 │  │  │
│  │  │  content_block_start + tool_use  ──▶  Tool Started             │  │  │
│  │  │  content_block_delta + text_delta ──▶ Text Streaming           │  │  │
│  │  │  content_block_delta + input_json ──▶ Tool Input Building      │  │  │
│  │  │  content_block_stop              ──▶  Tool/Block Completed     │  │  │
│  │  │  result                          ──▶  Final Response           │  │  │
│  │  │                                                                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                          │
│                                 ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       PROCESS CLOSE                                   │  │
│  │                                                                       │  │
│  │   Exit Code 0 ──▶ status: 'completed'                                │  │
│  │   Exit Code ≠0 ──▶ status: 'error'                                   │  │
│  │                                                                       │  │
│  │   Final: request.response = streamingText.trim()                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Event Stream Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING EVENT TIMELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Time ───────────────────────────────────────────────────────────────────▶  │
│                                                                             │
│  0ms        50ms       100ms      200ms      500ms     1000ms    2000ms    │
│   │          │          │          │          │          │          │       │
│   ▼          ▼          ▼          ▼          ▼          ▼          ▼       │
│   │          │          │          │          │          │          │       │
│   │ ┌────────────────┐  │          │          │          │          │       │
│   │ │ text_delta     │  │          │          │          │          │       │
│   └─│ "Let me "      │──┘          │          │          │          │       │
│     └────────────────┘             │          │          │          │       │
│             │ ┌─────────────────┐  │          │          │          │       │
│             │ │ text_delta      │  │          │          │          │       │
│             └─│ "read the "     │──┘          │          │          │       │
│               └─────────────────┘             │          │          │       │
│                        │ ┌────────────────────────────────────────┐ │       │
│                        │ │ content_block_start (tool_use)        │ │       │
│                        └─│ name: "Read"                          │─┘       │
│                          └────────────────────────────────────────┘        │
│                                    │ ┌────────────────────────────┐        │
│                                    │ │ input_json_delta           │        │
│                                    └─│ {"file_path": "/..."}     │─┐      │
│                                      └────────────────────────────┘ │      │
│                                               │ ┌──────────────────┐│      │
│                                               │ │ content_block_   ││      │
│                                               └─│ stop             │┘      │
│                                                 └──────────────────┘       │
│                                                         │ ┌────────────┐   │
│                                                         │ │ text_delta │   │
│                                                         └─│ "I can... "│─┐ │
│                                                           └────────────┘ │ │
│                                                                    │ ┌───┴─┴┐
│                                                                    │ │result│
│                                                                    └─│ "..." │
│                                                                      └──────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Request State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REQUEST STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌─────────────┐                                    │
│                          │   pending   │  (not used currently -            │
│                          │             │   request starts as running)      │
│                          └─────────────┘                                    │
│                                                                             │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                                                                   │     │
│    │     POST /api/chat/send                                          │     │
│    │            │                                                      │     │
│    │            ▼                                                      │     │
│    │    ┌───────────────┐                                             │     │
│    │    │               │                                             │     │
│    │    │   running     │◀────────────────────────────┐              │     │
│    │    │               │                              │              │     │
│    │    └───────┬───────┘                              │              │     │
│    │            │                                      │              │     │
│    │            │                                      │              │     │
│    │  ┌─────────┼─────────┬─────────────┐             │              │     │
│    │  │         │         │             │             │              │     │
│    │  │ exit=0  │ exit≠0  │ /abort      │  (retry)   │              │     │
│    │  │         │         │             │             │              │     │
│    │  ▼         ▼         ▼             │             │              │     │
│    │ ┌────────┐┌────────┐┌────────┐     │             │              │     │
│    │ │complete││ error  ││aborted │     │             │              │     │
│    │ │   ed   ││        ││        │─────┘             │              │     │
│    │ └────────┘└────────┘└────────┘                   │              │     │
│    │                                                   │              │     │
│    │     All terminal states cleaned up               │              │     │
│    │     after 5 minutes (300000ms)                   │              │     │
│    │                                                   │              │     │
│    └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Client Polling Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLIENT POLLING PATTERNS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pattern 1: FIRE AND WAIT                                                  │
│  ──────────────────────────────────────────────────────────────────────    │
│                                                                             │
│  Client                           Proxy                      Claude CLI    │
│    │                                │                              │        │
│    │──POST /api/chat/send──────────▶│                              │        │
│    │◀─202 { requestId }─────────────│                              │        │
│    │                                │──spawn claude───────────────▶│        │
│    │                                │                              │        │
│    │──GET /api/chat/response/xxx────▶│  (waits up to timeout)     │        │
│    │      (blocks)                  │◀──events────────────────────│        │
│    │                                │◀──close─────────────────────│        │
│    │◀─200 { status, response }──────│                              │        │
│    │                                │                              │        │
│                                                                             │
│  Pattern 2: STATUS POLLING                                                 │
│  ──────────────────────────────────────────────────────────────────────    │
│                                                                             │
│  Client                           Proxy                      Claude CLI    │
│    │                                │                              │        │
│    │──POST /api/chat/send──────────▶│                              │        │
│    │◀─202 { requestId }─────────────│                              │        │
│    │                                │──spawn claude───────────────▶│        │
│    │                                │                              │        │
│    │──GET /api/chat/status/xxx─────▶│                              │        │
│    │◀─200 { status: running }───────│                              │        │
│    │                                │                              │        │
│    │──GET /api/chat/status/xxx─────▶│                              │        │
│    │◀─200 { status: running }───────│◀──events────────────────────│        │
│    │                                │                              │        │
│    │──GET /api/chat/status/xxx─────▶│◀──close─────────────────────│        │
│    │◀─200 { status: completed }─────│                              │        │
│    │                                │                              │        │
│    │──GET /api/chat/response/xxx───▶│                              │        │
│    │◀─200 { response }──────────────│                              │        │
│                                                                             │
│  Pattern 3: ABORT                                                          │
│  ──────────────────────────────────────────────────────────────────────    │
│                                                                             │
│  Client                           Proxy                      Claude CLI    │
│    │                                │                              │        │
│    │──POST /api/chat/send──────────▶│                              │        │
│    │◀─202 { requestId }─────────────│                              │        │
│    │                                │──spawn claude───────────────▶│        │
│    │                                │                              │        │
│    │──POST /api/chat/abort/xxx─────▶│                              │        │
│    │                                │──SIGTERM─────────────────────▶│        │
│    │◀─200 { status: aborted }───────│                              │        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tool Execution Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOOL EXECUTION VISUALIZATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Request: chat_1_1738531234567                                       │   │
│  │ Status: 🟢 running                                                   │   │
│  │ Duration: 4.2s                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Tools ───────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐          │ │
│  │  │ Read   │  │ Read   │  │ Grep   │  │ Edit   │  │ Write  │          │ │
│  │  │ ✓ 0.8s │  │ ✓ 0.3s │  │ ✓ 0.5s │  │ ⟳ ...  │  │ ○      │          │ │
│  │  │ app.js │  │ style  │  │ btn    │  │ app.js │  │        │          │ │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘          │ │
│  │                                                                        │ │
│  │  Legend: ✓ completed  ⟳ running  ○ pending  ✗ error                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Todo List ───────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  [✓] Read current implementation                                       │ │
│  │  [✓] Identify button location                                          │ │
│  │  [⟳] Add new button HTML                                               │ │
│  │  [ ] Add button styling                                                │ │
│  │  [ ] Add click handler                                                 │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─ Streaming Output ────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  I'll add a new button to the header. Let me first read the           │ │
│  │  current app.js to understand the structure...                        │ │
│  │                                                                        │ │
│  │  I found the header section. Now I'll add the new button with         │ │
│  │  appropriate styling...█                                              │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### Request Object

```javascript
// chatApiRequests.get(requestId)
{
  status: 'running' | 'completed' | 'error' | 'aborted',
  response: string | null,           // Final response text
  streamingText: string,             // Accumulated text during streaming
  tools: [
    {
      name: 'Read' | 'Edit' | 'Write' | 'Grep' | 'Glob' | 'Bash' | ...,
      status: 'running' | 'completed',
      startTime: number,             // timestamp
      duration?: number,             // ms (after completion)
      file?: string                  // file_path if applicable
    }
  ],
  todos: [
    {
      content: string,
      status: 'pending' | 'in_progress' | 'completed'
    }
  ],
  errors: string[],                  // stderr output
  startTime: number,                 // request start timestamp
  tabId: string,                     // associated tab
  apiTab: object | null,             // reference to API tab for persistence
  message: string,                   // original user message
  workingDirectory: string,          // cwd for claude process
  hatIds: string[],                  // active hats
  history: [{ user: string, assistant: string }],  // conversation history
  pipelineId: string | null          // optional pipeline association
}
```

### Tab Object

```javascript
// chatApiTabs.get(tabId)
{
  name: string,                      // tab display name
  messages: [
    {
      role: 'user' | 'assistant',
      content: string,
      timestamp: number
    }
  ],
  workingDirectory: string,
  hatIds: string[],
  createdAt: number,
  lastActivity: number
}
```

## CSS Design System for Chat API Visualizations

```css
:root {
  /* Status Colors */
  --status-pending: #6b7280;
  --status-running: #f59e0b;
  --status-completed: #10b981;
  --status-error: #ef4444;
  --status-aborted: #8b5cf6;

  /* Tool Type Colors */
  --tool-read: #3b82f6;
  --tool-write: #10b981;
  --tool-edit: #f59e0b;
  --tool-bash: #ef4444;
  --tool-grep: #8b5cf6;
  --tool-glob: #06b6d4;

  /* Timeline Colors */
  --timeline-bg: #1e1e2e;
  --timeline-track: #374151;
  --timeline-event: #60a5fa;

  /* Card Styles */
  --card-bg: #262637;
  --card-border: #374151;
  --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}
```

## Prototype Ideas

### 1. Live Request Dashboard
- Shows all active/recent requests
- Real-time tool progress bars
- Streaming text preview
- Abort button per request

### 2. Request Timeline View
- Horizontal timeline of events
- Tool blocks showing duration
- Text output markers
- Error indicators

### 3. Tab Activity Monitor
- All tabs with message counts
- Last activity timestamps
- Active request indicators
- Hat badges

### 4. Tool Usage Analytics
- Tool frequency histogram
- Average duration per tool type
- Error rate per tool
- File access patterns
