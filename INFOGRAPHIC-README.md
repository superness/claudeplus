# Pipeline Infographic System

## Overview

The Pipeline Infographic System generates **rich, real-time HTML reports** during pipeline execution. These interactive visualizations are designed for reviewing the development process, debugging agent behavior, and understanding complex multi-stage workflows.

## Features

### 🎨 Rich Visual Design
- **Gradient backgrounds** with modern, clean UI
- **Timeline visualization** showing stage progression
- **Status indicators** (running, completed, error) with color coding
- **Animated elements** for running stages
- **Auto-refresh** every 2 seconds for real-time updates

### 📊 Comprehensive Data Display
- **Pipeline metrics**: Elapsed time, stages completed, error count
- **Stage details**: Agent name, type, duration, execution number
- **Agent outputs**: Full text output from each agent (truncated for readability)
- **Routing decisions**: Visual display of conditional flow and next stage
- **Error tracking**: Complete error messages with stack traces
- **Timeline events**: All pipeline events in chronological order

### 🔄 Real-Time Updates
- Infographics update on **every pipeline event**:
  - `pipeline_initialized`
  - `stage_started`
  - `stage_completed`
  - `stage_error`
  - `stage_routed`
  - `pipeline_completed`
- HTML file refreshes automatically via meta tag
- No manual reload required

## Architecture

```
Pipeline Execution
  ↓
logPipelineExecution() in server.js
  ↓
InfographicGenerator.processEvent()
  ↓
HTML file updated in real-time
  ↓
User views in browser (auto-refresh)
```

### Key Components

1. **InfographicGenerator** (`proxy/infographic-generator.js`)
   - Node.js class that processes pipeline events
   - Accumulates stage data and metrics
   - Generates complete HTML document on each event
   - Handles escaping, truncation, and formatting

2. **Infographic Viewer** (`infographic-viewer.html`)
   - Web UI for browsing all generated infographics
   - Dropdown selector with pipeline names and status
   - Auto-refresh toggle (default: every 2 seconds)
   - "Open in Browser" button for external viewing

3. **HTTP API** (port 8081)
   - `/list-infographics` - Returns JSON list of all infographics
   - Includes pipeline ID, name, status, path, last modified

4. **Server Integration** (`proxy/server.js`)
   - Creates `InfographicGenerator` instance on pipeline start
   - Calls `processEvent()` on every `logPipelineExecution()`
   - Sends `infographic-ready` WebSocket message to client
   - Tracks infographics in `pipelineInfographics` Map

## Usage

### Starting the Viewer

```bash
./start-infographic-viewer.sh
```

This launches:
- HTTP file server on port 3005
- Opens `http://localhost:3005/infographic-viewer.html`

### Viewing Infographics

1. **Via Viewer UI** (Recommended):
   - Navigate to http://localhost:3005/infographic-viewer.html
   - Select pipeline from first dropdown
   - Select specific run from second dropdown (default: latest run)
   - Click "View All Runs" to see run history index
   - Watch real-time updates as pipeline executes

2. **Direct File Access**:
   - Infographics stored in: `proxy/pipeline-infographics/<pipeline_id>/run_<timestamp>/infographic.html`
   - Example: `file:///mnt/c/github/claudeplus/proxy/pipeline-infographics/claude-plus-v1/run_2025-01-16T14-30-22/infographic.html`
   - Run history index: `proxy/pipeline-infographics/<pipeline_id>/index.html`

3. **Run History Index**:
   - Each pipeline has an `index.html` listing all runs
   - Shows run count, timestamps, and links to each run
   - Auto-generated after each pipeline execution
   - Example: `proxy/pipeline-infographics/claude-plus-v1/index.html`

### During Pipeline Execution

When you run a pipeline, the system automatically:
1. Creates `InfographicGenerator` instance
2. Sends `infographic-ready` message with file path
3. Updates HTML on every stage event
4. Marks pipeline as completed or error on finish

## File Structure

```
proxy/
├── infographic-generator.js          # Core generator class
├── pipeline-infographics/             # Generated HTML files (PER-RUN FOLDERS)
│   ├── claude-plus-v1/                # Pipeline-specific directory
│   │   ├── index.html                 # Run history index
│   │   ├── run_2025-01-16T14-30-22/  # Timestamped run folder
│   │   │   ├── infographic.html       # Rich HTML report
│   │   │   ├── images/                # Images from this run
│   │   │   ├── data/                  # Data files from this run
│   │   │   └── agent-outputs/         # Full agent output text files
│   │   │       ├── classify_request_1.txt
│   │   │       ├── define_feature_1.txt
│   │   │       └── ...
│   │   ├── run_2025-01-16T15-45-10/
│   │   │   └── ...
│   │   └── run_2025-01-16T16-20-05/
│   │       └── ...
│   ├── bug-fix-v1/
│   │   ├── index.html
│   │   └── run_2025-01-16T17-00-00/
│   │       └── ...
│   └── ...
├── pipelines/                         # Execution logs (JSON)
│   ├── claude-plus-v1_execution.json
│   └── ...
└── server.js                          # Integration point

infographic-viewer.html                # Viewer UI with run selector
start-infographic-viewer.sh            # Startup script
```

## Infographic Content

Each HTML infographic includes:

### Header Section
- **Pipeline name** with gradient styling
- **Pipeline ID** for reference
- **Metrics grid**:
  - Elapsed time (seconds)
  - Stages completed / total
  - Error count
  - Overall status (Running / Complete)

### Timeline Section
- **Visual timeline** with connecting line
- **Stage cards** for each executed stage:
  - Stage name and description
  - Agent name and type
  - Execution number (for loops/retries)
  - Duration in seconds
  - Status badge (running/completed/error)
  - Full agent output (scrollable)
  - Routing decision and next stage
  - Error details with stack traces

### Errors Summary
- **Dedicated error section** (if errors occurred)
- All errors grouped together
- Stage context for each error
- Full error messages and stack traces

## Visual Design

### Color Scheme
- **Primary gradient**: Purple (#667eea) to Violet (#764ba2)
- **Status colors**:
  - Running: Yellow (#ffc107) with pulse animation
  - Completed: Green (#28a745)
  - Error: Red (#dc3545)
- **Backgrounds**: White cards on gradient body
- **Borders**: Subtle shadows and rounded corners

### Typography
- **Font**: System font stack (SF Pro, Segoe UI, Roboto)
- **Hierarchy**:
  - H1: 2.5em (pipeline name)
  - H2: 2em (section headers)
  - Stage title: 1.4em
  - Body: 1em
  - Metadata: 0.9em

### Layout
- **Responsive grid** for metrics
- **Timeline layout** with left-side indicator dots
- **Card-based design** for stages
- **Hover effects** for interactivity

## Technical Details

### Auto-Refresh Mechanism
- HTML meta tag: `<meta http-equiv="refresh" content="2">`
- Refreshes entire page every 2 seconds
- No JavaScript required for refresh
- Browser handles caching and performance

### Output Truncation
- Agent outputs limited to 5000 characters
- Prevents massive HTML files
- Shows truncation notice with original length
- Full output available in execution logs

### HTML Escaping
- All user content escaped to prevent XSS
- Uses `escapeHtml()` function for:
  - Pipeline names
  - Agent outputs
  - Error messages
  - Stack traces

### Performance
- Separate directory per pipeline run
- Each run preserved in timestamped folder
- Agent outputs saved as individual text files
- File size typically < 500KB per run
- Fast generation (< 10ms per update)
- No file overwrites - complete history retained

## Integration with Existing Systems

### Pipeline Monitor
- Monitor uses **structured JSON logs** (`*_execution.json`)
- Infographics use **same events** for visualization
- Complementary tools:
  - Monitor: Text-based, CLI-driven debugging
  - Infographics: Visual, browser-based review

### Execution Logs
- Infographics generated from same events
- Both systems receive identical event data
- Infographics add visual layer on top of logs

### WebSocket Messages
New message type: `infographic-ready`
```json
{
  "type": "infographic-ready",
  "pipelineId": "pipeline_1234567890",
  "infographicPath": "/mnt/c/github/claudeplus/proxy/pipeline-infographics/pipeline_1234567890.html",
  "infographicUrl": "file:///mnt/c/github/claudeplus/proxy/pipeline-infographics/pipeline_1234567890.html"
}
```

## Use Cases

### 1. Development Process Review
- **Problem**: Need to see what each agent produced during development
- **Solution**: Open infographic, scroll through timeline, review all outputs
- **Benefit**: Complete visual record of entire process

### 2. Debugging Failed Pipelines
- **Problem**: Pipeline failed at stage 5, need to understand why
- **Solution**: View infographic, jump to error section, see stack trace and context
- **Benefit**: All error details in one visual page

### 3. Understanding Agent Decisions
- **Problem**: Why did the validator reject the plan?
- **Solution**: View validator stage output and routing decision
- **Benefit**: See exact decision text and reasoning

### 4. Performance Analysis
- **Problem**: Which stage is taking the longest?
- **Solution**: Check duration metrics for each stage in timeline
- **Benefit**: Identify bottlenecks visually

### 5. Stakeholder Demos
- **Problem**: Need to show executives how the AI system works
- **Solution**: Open completed infographic in browser, walk through stages
- **Benefit**: Professional, polished visualization

## New Features: Per-Run Directories

### ✅ Implemented (v2)

Each pipeline run now gets its own timestamped directory with:

1. **Unique Run Folders**: `run_2025-01-16T14-30-22/`
   - Timestamp in ISO format (sortable, human-readable)
   - Complete isolation between runs
   - No overwrites - full history preserved

2. **Dedicated Subdirectories**:
   - `images/` - For agent-generated images
   - `data/` - For structured data files
   - `agent-outputs/` - Full text output from each agent
   - Example: `agent-outputs/classify_request_1.txt`

3. **Run History Index**:
   - Auto-generated `index.html` per pipeline
   - Lists all runs with timestamps
   - Direct links to each run's infographic
   - Shows total run count and latest run date

4. **Enhanced Viewer**:
   - Two-level dropdown: Pipeline → Run
   - "View All Runs" button for history index
   - Auto-selects latest run by default
   - Preserved auto-refresh functionality

5. **Updated HTTP API**:
   - `/list-infographics` now includes `runs` array
   - Each pipeline includes `totalRuns` count
   - `indexPath` for run history page
   - `latestRunPath` for quick access

### Benefits

- ✅ **Complete history**: Never lose a pipeline run
- ✅ **Comparison**: Compare runs side-by-side
- ✅ **Debugging**: Review past failures
- ✅ **Auditing**: Track all executions over time
- ✅ **Rich media**: Store images/data per run

## Future Enhancements

Potential additions to the system:

- **Image display**: Render images from `images/` folder in infographic
- **Code syntax highlighting**: Colorize code snippets in outputs
- **Diff visualization**: Show before/after for file changes
- **Interactive filtering**: Hide/show stages by type
- **Search functionality**: Find text in outputs across runs
- **Export to PDF**: Generate static reports
- **Custom theming**: Light/dark mode toggle
- **Performance graphs**: Chart execution times across runs
- **Comparative view**: Side-by-side run comparison

## Troubleshooting

### Infographic not updating
1. Check proxy server is running: `ps aux | grep "node server.js"`
2. Verify infographic file exists: `ls proxy/pipeline-infographics/`
3. Check browser console for errors
4. Try manual refresh (Ctrl+R)

### Viewer shows "No pipelines"
1. Ensure proxy server is running on port 8081
2. Check HTTP API: `curl http://localhost:8081/list-infographics`
3. Verify infographics directory exists: `ls proxy/pipeline-infographics/`
4. Check for run directories: `ls proxy/pipeline-infographics/*/run_*`

### Infographic missing data
1. Check execution log: `tail proxy/pipelines/<pipeline>_execution.json`
2. Verify events are being logged
3. Check proxy.log for errors
4. Verify run directory was created: `ls -la proxy/pipeline-infographics/<pipeline>/run_*`
5. Check agent output files: `ls proxy/pipeline-infographics/<pipeline>/run_*/agent-outputs/`

## Summary

The Pipeline Infographic System provides a **rich, real-time visual layer** on top of the existing pipeline execution infrastructure. It transforms raw execution logs into **beautiful HTML reports** that make it easy to review, debug, and present the development process.

**Key benefits**:
- ✅ Real-time updates during execution
- ✅ Complete visibility into agent outputs
- ✅ Professional visual design
- ✅ Zero configuration required
- ✅ Works with existing pipelines
- ✅ Browser-based (no special tools needed)
- ✅ Automatic generation on every event

**Start using it today**:
```bash
./start-infographic-viewer.sh
```

Then run any pipeline and watch the magic happen! 🎨
