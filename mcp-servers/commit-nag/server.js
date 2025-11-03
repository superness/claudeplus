#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import simpleGit from 'simple-git';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CommitNagServer {
  constructor() {
    this.server = new Server(
      {
        name: "commit-nag-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.git = simpleGit();
    this.nagInterval = null;
    this.lastNagTime = 0;
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "check_git_status",
            description: "Check current git repository status and suggest commits",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Repository path to check (defaults to current directory)",
                },
              },
            },
          },
          {
            name: "start_commit_nagging",
            description: "Start periodic commit reminders every X minutes",
            inputSchema: {
              type: "object",
              properties: {
                intervalMinutes: {
                  type: "number",
                  description: "How often to check for uncommitted changes (default: 15 minutes)",
                  default: 15,
                },
                threshold: {
                  type: "number", 
                  description: "Minimum number of changed files before nagging (default: 5)",
                  default: 5,
                },
              },
            },
          },
          {
            name: "stop_commit_nagging",
            description: "Stop the periodic commit reminders",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "commit_suggestion",
            description: "Generate a smart commit message based on changes",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Repository path (defaults to current directory)",
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "check_git_status":
            return await this.checkGitStatus(args?.path || process.cwd());

          case "start_commit_nagging":
            return await this.startCommitNagging(
              args?.intervalMinutes || 15,
              args?.threshold || 5
            );

          case "stop_commit_nagging":
            return await this.stopCommitNagging();

          case "commit_suggestion":
            return await this.generateCommitSuggestion(args?.path || process.cwd());

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async checkGitStatus(repoPath) {
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      
      const modifiedFiles = status.modified.length;
      const newFiles = status.not_added.length;
      const stagedFiles = status.staged.length;
      const totalChanges = modifiedFiles + newFiles;

      let message = `🔍 **Git Status Check**\n\n`;
      message += `📁 Repository: ${repoPath}\n`;
      message += `📝 Modified files: ${modifiedFiles}\n`;
      message += `➕ New files: ${newFiles}\n`;
      message += `✅ Staged files: ${stagedFiles}\n`;
      message += `📊 Total uncommitted changes: ${totalChanges}\n\n`;

      if (totalChanges === 0) {
        message += `🎉 **All clean!** No uncommitted changes detected.`;
      } else if (totalChanges >= 10) {
        message += `🚨 **URGENT COMMIT NEEDED!** You have ${totalChanges} uncommitted changes!\n`;
        message += `💡 Consider committing your work to avoid losing progress.`;
      } else if (totalChanges >= 5) {
        message += `⚠️ **Consider committing soon** - You have ${totalChanges} uncommitted changes.\n`;
        message += `📋 It's a good time to group related changes and commit them.`;
      } else {
        message += `✨ **Looking good!** ${totalChanges} changes in progress.`;
      }

      if (status.modified.length > 0) {
        message += `\n\n📄 **Modified files:**\n`;
        status.modified.slice(0, 10).forEach(file => {
          message += `  • ${file}\n`;
        });
        if (status.modified.length > 10) {
          message += `  ... and ${status.modified.length - 10} more\n`;
        }
      }

      if (status.not_added.length > 0) {
        message += `\n\n📄 **New files:**\n`;
        status.not_added.slice(0, 10).forEach(file => {
          message += `  • ${file}\n`;
        });
        if (status.not_added.length > 10) {
          message += `  ... and ${status.not_added.length - 10} more\n`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text", 
            text: `❌ Error checking git status: ${error.message}`,
          },
        ],
      };
    }
  }

  async startCommitNagging(intervalMinutes, threshold) {
    if (this.nagInterval) {
      clearInterval(this.nagInterval);
    }

    this.nagInterval = setInterval(async () => {
      try {
        const git = simpleGit();
        const status = await git.status();
        const totalChanges = status.modified.length + status.not_added.length;
        
        const now = Date.now();
        const timeSinceLastNag = (now - this.lastNagTime) / (1000 * 60); // minutes

        if (totalChanges >= threshold && timeSinceLastNag >= intervalMinutes) {
          console.log(`\n🔔 COMMIT NAG: You have ${totalChanges} uncommitted changes! Time to commit? 🤔\n`);
          this.lastNagTime = now;
        }
      } catch (error) {
        console.log(`❌ Commit nag error: ${error.message}`);
      }
    }, intervalMinutes * 60 * 1000);

    return {
      content: [
        {
          type: "text",
          text: `🔔 **Commit nagging started!**\n\nWill check every ${intervalMinutes} minutes for ${threshold}+ uncommitted changes.\n\nUse stop_commit_nagging to disable.`,
        },
      ],
    };
  }

  async stopCommitNagging() {
    if (this.nagInterval) {
      clearInterval(this.nagInterval);
      this.nagInterval = null;
      
      return {
        content: [
          {
            type: "text",
            text: `🔕 **Commit nagging stopped!** You're on your own now. 😄`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `ℹ️ Commit nagging wasn't running.`,
          },
        ],
      };
    }
  }

  async generateCommitSuggestion(repoPath) {
    try {
      const git = simpleGit(repoPath);
      const status = await git.status();
      const diff = await git.diff(['--stat']);
      
      if (status.modified.length === 0 && status.not_added.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `✨ No changes to commit - you're all caught up!`,
            },
          ],
        };
      }

      let suggestion = `💡 **Smart Commit Suggestion**\n\n`;
      
      // Analyze file types and changes
      const fileTypes = {};
      [...status.modified, ...status.not_added].forEach(file => {
        const ext = file.split('.').pop() || 'other';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });

      // Generate commit message based on patterns
      let commitMsg = '';
      if (fileTypes.js && fileTypes.json) {
        commitMsg = 'Update configuration and JavaScript modules';
      } else if (fileTypes.md) {
        commitMsg = 'Update documentation';
      } else if (fileTypes.json && Object.keys(fileTypes).length === 1) {
        commitMsg = 'Update configuration files';
      } else if (status.not_added.length > status.modified.length) {
        commitMsg = 'Add new files and features';
      } else {
        commitMsg = 'Update existing functionality';
      }

      suggestion += `📝 **Suggested commit message:**\n\`\`\`\n${commitMsg}\n\`\`\`\n\n`;
      suggestion += `📊 **Change summary:**\n`;
      suggestion += `• ${status.modified.length} modified files\n`;
      suggestion += `• ${status.not_added.length} new files\n\n`;
      
      if (Object.keys(fileTypes).length > 0) {
        suggestion += `📂 **File types affected:**\n`;
        Object.entries(fileTypes).forEach(([ext, count]) => {
          suggestion += `• .${ext}: ${count} file(s)\n`;
        });
      }

      return {
        content: [
          {
            type: "text",
            text: suggestion,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error generating commit suggestion: ${error.message}`,
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Commit Nag MCP server running on stdio");
  }
}

const server = new CommitNagServer();
server.run().catch(console.error);