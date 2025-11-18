# Game Dev Studio

A specialized chat interface for game development using Claude Code CLI and the meta game development pipeline system.

## What is it?

Game Dev Studio is a conversational AI development partner that combines:
- **Natural chat interface** - Talk to Claude Code CLI naturally about what you want to build
- **Pipeline execution** - Automatically runs game development pipelines when needed
- **Self-modifying interface** - Can update its own UI based on your requests
- **Real-time progress tracking** - See pipeline execution progress as it happens
- **Directory targeting** - Work on any game project, anywhere

## Quick Start

```bash
./start-game-dev-studio.sh
```

Then open: **http://localhost:3006/game-dev-studio.html**

## Features

### 1. **Natural Conversation**
Just chat naturally about what you want to build:
- "I want to add a combat system to my game"
- "Design a new economy mechanic"
- "Implement a crafting system"
- "Review my current game design"

### 2. **Automatic Pipeline Execution**
The studio intelligently detects when you want to:
- Start development on a new feature
- Run a design review
- Implement something
- Test gameplay

It automatically selects and runs the appropriate pipeline:
- `game-design-v1.json` - Complete feature design and implementation
- `living-game-world-v1.json` - Complex world simulation design
- `feature-development-v1.json` - Focused feature implementation

### 3. **Self-Modification**
Ask the studio to modify itself:
- "Add a button to export my designs"
- "Change the color scheme to dark blue"
- "Add a section showing recent commits"
- "Make the sidebar collapsible"

Claude will read, modify, and update `game-dev-studio.html` for you.

### 4. **Real-Time Progress Tracking**
See pipeline execution in real-time:
- Progress bars showing stage completion
- Current stage information
- Infographic links for detailed reports
- Success/error notifications

### 5. **Directory Targeting**
Work on any game project:
- Default: `/mnt/c/github/spaceship-simulator`
- Change via the directory selector
- Each session maintains its own working directory
- Full context about your specific project

## How It Works

```
User: "Build a combat system"
    ↓
Game Dev Studio (Frontend)
    ↓ WebSocket to Proxy (port 8081)
Proxy Server
    ↓ Spawns Claude Code CLI with specialized context
Claude Code CLI
    ↓ Detects: wants to build something
    ↓ Triggers pipeline execution
Pipeline System
    ↓ Runs game-design-v1 pipeline
    ↓ Sends progress updates
Game Dev Studio (Frontend)
    ↓ Shows progress, reports results
User sees: Real-time development happening
```

## Intelligent Context Detection

The studio uses pattern matching to understand your intent:

### Pipeline Triggers
Phrases that trigger pipeline execution:
- "start/run/execute/begin pipeline"
- "implement/build/create/design feature"
- "add a new system/mechanic"

### Interface Modification Triggers
Phrases that trigger self-modification:
- "modify/change/update/edit this interface"
- "improve the UI/studio/html"
- "add a new button/section/feature to this"

### General Queries
Everything else is treated as a conversation:
- Ask questions about game development
- Get design suggestions
- Request code reviews
- Discuss architecture

## Quick Commands

The sidebar provides one-click access to common tasks:

### Pipeline Actions
- **Start Game Development** - Begin full development pipeline
- **Continue Development** - Pick up where you left off
- **Design Review** - Review current design
- **Implement Feature** - Implement what was discussed
- **Test Gameplay** - Run gameplay tests

### Pipeline Status
- **Current Pipeline Status** - What's running now
- **Show Progress** - Detailed progress information
- **Recent Changes** - What changed recently

### System
- **Modify This Interface** - Trigger self-modification mode
- **Available Pipelines** - See all pipeline options
- **Stop Pipeline** - Halt current execution

## Architecture

### Frontend (`game-dev-studio.html`)
- Beautiful gradient dark theme
- WebSocket client on port 8081
- Conversation history management
- Real-time pipeline progress display
- Directory selector for targeting projects

### Proxy Integration (`proxy/server.js`)
Message types:
- `game-dev-studio-init` - Initialize with working directory
- `game-dev-studio-query` - Send user message with context
- `pipeline-started` - Pipeline began executing
- `pipeline-update` - Stage completed, progress update
- `pipeline-completed` - Pipeline finished
- `infographic-ready` - Visual report available

### Claude Code Context
Each query includes:
- Working directory
- Conversation history (last 10 messages)
- Specialized instructions based on intent
- Available pipelines and agents
- Tool access (Read/Write/Edit/Bash)

## Example Conversations

### Example 1: Building a Feature
```
You: I want to add a crafting system where players can combine items

Studio: Great idea! I'll run the game-design-v1 pipeline to design and
implement your crafting system. This pipeline will:

1. Design the crafting mechanics
2. Plan the implementation
3. Write the code
4. Test the gameplay

Starting pipeline now...

[Progress bar appears]
[Pipeline stages execute]
[Infographic link provided]

Studio: Crafting system complete! Check the infographic for details.
The system supports item combinations, recipes, and resource requirements.
```

### Example 2: Modifying the Interface
```
You: Add a dark mode toggle button

Studio: I'll modify the interface to add a dark mode toggle. Let me update
game-dev-studio.html...

[Reads file]
[Edits HTML/CSS/JavaScript]

Studio: Done! I've added a dark mode toggle in the header. It switches between
dark and light themes. Refresh your browser to see it!
```

### Example 3: Getting Help
```
You: What's the best way to implement AI for NPCs?

Studio: For NPC AI, I recommend a behavior tree approach. Here's why...

Would you like me to:
1. Design a complete NPC AI system via pipeline
2. Just discuss the architecture first
3. Show examples from your current codebase
```

## Technical Details

### Message Flow
```javascript
// User sends message
ws.send(JSON.stringify({
  type: 'game-dev-studio-query',
  message: userInput,
  workingDirectory: currentDir,
  history: conversationHistory
}));

// Proxy processes with specialized context
const context = buildGameDevContext(message, history, workingDir);
const response = await sendToClaude(context, workingDir);

// Response sent back
ws.send(JSON.stringify({
  type: 'assistant-message',
  content: response
}));
```

### Pipeline Progress Updates
```javascript
// Pipeline started
{ type: 'pipeline-started', pipelineId, pipelineName, totalStages }

// Stage completed
{ type: 'pipeline-update', message, progress: { current, total, currentStage } }

// Pipeline done
{ type: 'pipeline-completed', pipelineId, pipelineName, totalStages, duration }
```

## Working with Different Projects

### Changing Project Directory
1. Enter path in directory selector: `/path/to/your/game`
2. Click "Set Directory"
3. Studio updates context for that project
4. All operations target new directory

### Project-Specific Context
Claude knows about your specific project:
- Reads existing code
- Understands your architecture
- Suggests improvements based on what's there
- Maintains consistency with your style

## Self-Modification Capabilities

The studio can modify itself because:
- It has access to its own source (`game-dev-studio.html`)
- Claude Code CLI has Edit/Write tools enabled
- Context explicitly allows self-modification
- Changes take effect on browser refresh

### What You Can Ask
- "Add a new quick command button"
- "Change the color scheme"
- "Add a file browser panel"
- "Show git status in the sidebar"
- "Add keyboard shortcuts"
- "Improve the progress visualization"

## Integration with Pipeline System

### Pipeline Selection Logic
```javascript
if (wantsToRunPipeline) {
  // Check available pipelines
  // Select best match
  // Execute with user context
  // Track progress
}
```

### Available Pipelines
- **game-design-v1** - Full feature design and implementation
- **living-game-world-v1** - Complex world systems
- **feature-development-v1** - Focused implementation
- (More can be added via templates/)

### Pipeline Execution
Triggered by sending:
```javascript
{
  type: 'execute-pipeline-request',
  pipelineName: 'game-design-v1',
  userPrompt: detailedDescription,
  workingDirectory: currentDir
}
```

## Advantages Over Standard Claude Chat

| Feature | Standard Claude | Game Dev Studio |
|---------|----------------|-----------------|
| Game dev context | ❌ Generic | ✅ Specialized |
| Pipeline execution | ❌ Manual | ✅ Automatic |
| Progress tracking | ❌ None | ✅ Real-time |
| Self-modification | ❌ Can't edit UI | ✅ Edits itself |
| Directory targeting | ❌ Fixed | ✅ Configurable |
| Tool access | ❌ Limited | ✅ Full CLI tools |
| Conversation history | ✅ Yes | ✅ Yes + context |

## Requirements

- Proxy server on port 8081
- Python 3 (for HTTP server)
- Modern browser with WebSocket support
- Claude Code CLI installed
- Game development pipelines in `templates/`

## Troubleshooting

**Studio won't connect**
- Check if proxy is running: `nc -z localhost 8081`
- Start proxy: `./start-proxy.sh` or `cd proxy && node server.js`

**Pipeline doesn't start**
- Check available pipelines: ask "list available pipelines"
- Verify working directory exists
- Check proxy logs: `tail -f proxy/proxy.log`

**Self-modification not working**
- Ensure game-dev-studio.html is writable
- Check Claude has Edit tool permissions
- Refresh browser after changes

**Slow responses**
- Claude is reading files and executing
- Large pipelines take time
- Check pipeline progress in real-time

## Extending the Studio

### Add New Quick Commands
Edit the sidebar in `game-dev-studio.html`:
```javascript
<button class="quick-btn" onclick="sendQuickCommand('your-command')">
  Your Command Label
</button>
```

Then add to the commands object:
```javascript
const commands = {
  'your-command': 'The message to send to Claude',
  // ...
};
```

### Add New Pipelines
Create a new template in `templates/your-pipeline.json` following the existing format. The studio will automatically detect it.

### Customize the Theme
Ask the studio: "Change the color scheme to [your colors]"

Or edit the CSS directly in `game-dev-studio.html`.

## Future Enhancements

Potential improvements:
- Voice input/output
- Multi-project workspace
- Integrated code editor
- Visual pipeline builder
- Automated testing dashboard
- Deployment tools
- Asset management
- Collaboration features

## Related Tools

- **Pipeline Monitor** (`./start-monitor.sh`) - Monitor system logs and status
- **Pipeline Designer** (`./start-pipeline-system.sh`) - Visual pipeline editor
- **Infographic Viewer** (`./start-infographic-viewer.sh`) - View execution reports

## Documentation

See also:
- `CLAUDE.md` - Overall system architecture
- `MONITOR-README.md` - Pipeline monitoring
- `templates/*.json` - Pipeline definitions
- `agents/*.json` - Agent definitions

## Support

For issues or questions:
- Check proxy logs: `tail -f proxy/proxy.log`
- Check execution logs: `proxy/pipelines/*_execution.json`
- Review pipeline states: `proxy/pipeline-states/current.json`
- Ask the studio itself: "I'm having trouble with..."

---

**Game Dev Studio** - Your AI development partner, powered by Claude Code CLI
