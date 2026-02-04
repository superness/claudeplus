/**
 * Multi-Drive Maestro
 *
 * Recursive AI agent orchestration system built on top of Claude Chat.
 * Uses tabs as agent contexts with parent/child relationships for delegation.
 */

const MaestroClient = require('./maestro-client');
const ApiClient = require('./api-client');
const DecisionParser = require('./decision-parser');

module.exports = {
  MaestroClient,
  ApiClient,
  DecisionParser
};

// CLI entry point when run directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Multi-Drive Maestro - Recursive AI Orchestration

Usage:
  node src/index.js <command> [options]

Commands:
  execute <message>    Start a Maestro orchestration
  status <rootTabId>   Check orchestration status
  abort <rootTabId>    Abort an orchestration

Options:
  --dir <path>         Working directory (default: cwd)
  --hat <hatId>        Root hat (default: product-maestro)
  --max-parallel <n>   Max parallel agents (default: 3)
  --base-url <url>     Proxy server URL (default: http://localhost:8081)

Example:
  node src/index.js execute "Implement user authentication" --dir /mnt/c/project
`);
    process.exit(0);
  }

  const command = args[0];

  // Parse options
  const options = {
    baseUrl: 'http://localhost:8081',
    workingDirectory: process.cwd(),
    hatId: 'product-maestro',
    maxParallel: 3
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      options.workingDirectory = args[++i];
    } else if (args[i] === '--hat' && args[i + 1]) {
      options.hatId = args[++i];
    } else if (args[i] === '--max-parallel' && args[i + 1]) {
      options.maxParallel = parseInt(args[++i]);
    } else if (args[i] === '--base-url' && args[i + 1]) {
      options.baseUrl = args[++i];
    }
  }

  const maestro = new MaestroClient(options);

  // Set up progress callback
  maestro.onProgress = (event) => {
    console.log(`[${event.type}]`, JSON.stringify(event, null, 2));
  };

  async function run() {
    try {
      switch (command) {
        case 'execute': {
          const message = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
          if (!message) {
            console.error('Error: message is required');
            process.exit(1);
          }
          console.log(`Starting Maestro orchestration: "${message}"`);
          const result = await maestro.execute(message, options);
          console.log('\n=== Final Result ===');
          console.log(JSON.stringify(result, null, 2));
          break;
        }

        case 'status': {
          const rootTabId = args[1];
          if (!rootTabId) {
            console.error('Error: rootTabId is required');
            process.exit(1);
          }
          const api = new ApiClient(options.baseUrl);
          const status = await api.getMaestroStatus(rootTabId);
          console.log(JSON.stringify(status, null, 2));
          break;
        }

        case 'abort': {
          const rootTabId = args[1];
          if (!rootTabId) {
            console.error('Error: rootTabId is required');
            process.exit(1);
          }
          const api = new ApiClient(options.baseUrl);
          const result = await api.abortMaestro(rootTabId);
          console.log(JSON.stringify(result, null, 2));
          break;
        }

        default:
          console.error(`Unknown command: ${command}`);
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  run();
}
