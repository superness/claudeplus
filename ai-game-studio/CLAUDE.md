# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Start the server:**
```bash
./start.sh          # Interactive launcher with proxy check
npm start           # Direct start (node server.js)
```

**Prerequisites:** The proxy server must be running on port 8081 before starting AI Game Studio.
```bash
cd ../proxy && node server.js   # Start proxy server first
```

**Install dependencies:**
```bash
npm install
```

## Architecture

AI Game Studio is a user-facing web application for AI-assisted game development. Users describe a game idea, and the system generates design documents and builds the game using AI pipelines.

```
Browser → AI Game Studio (port 3008) → WebSocket (port 8081) → Proxy Server → Claude Code Pipelines
```

### Core Components

1. **Server** (`server.js`): Express + WebSocket server on port 3008
   - REST API for auth, projects, and work queue (`/api/*`)
   - WebSocket server for real-time updates to browser clients
   - Static file serving for the frontend and game files

2. **Services** (`services/`):
   - `db.js`: SQLite database (better-sqlite3) for users, sessions, projects, and work queue
   - `pipeline-bridge.js`: WebSocket client connecting to proxy server (port 8081)
   - `queue-service.js`: Sequential work queue processing, pipeline progress polling, resume support

3. **Frontend** (`js/app.js`, `index.html`, `css/style.css`):
   - Single-page app with auth, dashboard, and studio screens
   - WebSocket connection for real-time project updates
   - Game preview iframe for live game rendering

### Data Flow

1. User creates project with game idea
2. `queue-service` triggers design pipeline via `pipeline-bridge`
3. Proxy server executes `living-game-world-v1` pipeline template
4. Progress updates flow back via WebSocket to browser
5. Design docs created in `games/{userId}/{projectId}/design-docs/`
6. Feature requests added to work queue, processed sequentially

### Database Schema

- `users`: id, email, password_hash
- `sessions`: token, user_id, expires_at
- `projects`: id, user_id, name, game_idea, game_type, status, design_pipeline_id, feature_pipeline_id
- `work_queue`: id, project_id, description, status, priority, pipeline_id

### Project Status Flow

`designing` → `implementing` → `live` (or `error`)

### Key Directories

- `games/{userId}/{projectId}/`: Generated game files per user/project
- `data/studio.db`: SQLite database
- `../proxy/`: Parent proxy server (required dependency)
- `../templates/`: Pipeline templates referenced by pipeline-bridge

### API Endpoints

**Auth:**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `POST /api/auth/logout` - Logout

**Projects:**
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project (triggers design pipeline)
- `GET /api/projects/:id` - Get project
- `DELETE /api/projects/:id` - Delete project

**Work Queue:**
- `GET /api/projects/:id/queue` - Get queue status
- `POST /api/projects/:id/queue` - Add work item
- `DELETE /api/projects/:id/queue/:itemId` - Cancel queued item

**Pipeline Resume:**
- `GET /api/pipelines/incomplete` - Check for incomplete pipelines
- `POST /api/pipelines/:pipelineId/resume` - Resume incomplete pipeline
