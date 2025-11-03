# Commit Nag MCP Server 🔔

An MCP server that helps you stay on top of your git commits by monitoring your repository and nagging you when you have too many uncommitted changes.

## Features

- **Git Status Monitoring**: Check current repository status with detailed summaries
- **Automatic Nagging**: Periodic reminders when you have too many uncommitted changes
- **Smart Commit Messages**: AI-powered commit message suggestions based on your changes
- **Configurable Thresholds**: Set your own limits for when to start nagging

## Tools Available

### `check_git_status`
Check the current git status of your repository.

**Parameters:**
- `path` (optional): Repository path to check (defaults to current directory)

### `start_commit_nagging`
Start periodic commit reminders.

**Parameters:**
- `intervalMinutes` (default: 15): How often to check for uncommitted changes
- `threshold` (default: 5): Minimum number of changed files before nagging

### `stop_commit_nagging`
Stop the periodic commit reminders.

### `commit_suggestion`
Generate a smart commit message based on your current changes.

**Parameters:**
- `path` (optional): Repository path (defaults to current directory)

## Installation

```bash
cd mcp-servers/commit-nag
npm install
```

## Usage

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "commit-nag": {
      "command": "node",
      "args": ["path/to/mcp-servers/commit-nag/server.js"]
    }
  }
}
```

## Example Usage

```
check_git_status()           # Check current status
start_commit_nagging()       # Start nagging every 15 minutes if 5+ changes
start_commit_nagging({"intervalMinutes": 10, "threshold": 3})  # Custom settings
commit_suggestion()          # Get a smart commit message
stop_commit_nagging()        # Stop the nagging
```

## Sample Output

```
🔍 Git Status Check

📁 Repository: /path/to/repo
📝 Modified files: 8
➕ New files: 3
✅ Staged files: 0
📊 Total uncommitted changes: 11

🚨 URGENT COMMIT NEEDED! You have 11 uncommitted changes!
💡 Consider committing your work to avoid losing progress.

📄 Modified files:
  • proxy/server.js
  • agents/lore_architect.json
  • src/pipeline-designer.js
  ...
```

## Perfect For

- Developers who get too focused and forget to commit
- Teams who want to maintain good git hygiene
- Anyone who's ever lost work due to uncommitted changes
- People who need gentle reminders to document their progress

*Because the best backup is the commit you make before you break everything!* 😄