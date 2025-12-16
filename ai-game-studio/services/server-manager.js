/**
 * Server Manager - Manages game server processes for full-stack games
 * Handles start/stop/restart, log streaming, health monitoring, and npm script execution
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Circular buffer for log storage
class CircularBuffer {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.buffer = [];
  }

  push(item) {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll() {
    return [...this.buffer];
  }

  getLast(n) {
    return this.buffer.slice(-n);
  }

  clear() {
    this.buffer = [];
  }
}

class ServerManager {
  constructor() {
    this.runningServers = new Map(); // projectId -> ServerProcess
    this.eventCallbacks = [];
  }

  // ============================================
  // Port Management
  // ============================================

  /**
   * Check if a port is in use and return the PID using it
   */
  async getPortUser(port) {
    return new Promise((resolve) => {
      exec(`lsof -i :${port} -t 2>/dev/null`, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null); // Port is free
        } else {
          const pids = stdout.trim().split('\n').map(p => parseInt(p, 10)).filter(p => !isNaN(p));
          resolve(pids.length > 0 ? pids : null);
        }
      });
    });
  }

  /**
   * Kill processes using a specific port
   */
  async clearPort(port, signal = 'SIGTERM') {
    const pids = await this.getPortUser(port);
    if (!pids || pids.length === 0) {
      console.log(`[ServerManager] Port ${port} is already free`);
      return { cleared: true, wasInUse: false };
    }

    console.log(`[ServerManager] Port ${port} in use by PIDs: ${pids.join(', ')}. Clearing...`);

    return new Promise((resolve) => {
      let killed = 0;
      let errors = [];

      pids.forEach(pid => {
        try {
          process.kill(pid, signal);
          killed++;
          console.log(`[ServerManager] Sent ${signal} to PID ${pid}`);
        } catch (err) {
          if (err.code !== 'ESRCH') { // ESRCH = process already dead
            errors.push(`PID ${pid}: ${err.message}`);
          }
        }
      });

      // Wait a bit for processes to die
      setTimeout(async () => {
        // Check if port is now free
        const stillInUse = await this.getPortUser(port);
        if (stillInUse && stillInUse.length > 0) {
          // Try SIGKILL as last resort
          if (signal !== 'SIGKILL') {
            console.log(`[ServerManager] Port ${port} still in use, sending SIGKILL`);
            const result = await this.clearPort(port, 'SIGKILL');
            resolve(result);
          } else {
            resolve({ cleared: false, wasInUse: true, errors, remainingPids: stillInUse });
          }
        } else {
          resolve({ cleared: true, wasInUse: true, killedPids: pids });
        }
      }, 1000);
    });
  }

  /**
   * Ensure a port is available before starting a server
   */
  async ensurePortAvailable(port, projectId) {
    const pids = await this.getPortUser(port);
    if (!pids || pids.length === 0) {
      return { available: true };
    }

    // Check if any of these PIDs belong to a server we're managing
    for (const [managedProjectId, serverInfo] of this.runningServers) {
      if (pids.includes(serverInfo.pid) || (serverInfo.clientPid && pids.includes(serverInfo.clientPid))) {
        if (managedProjectId === projectId) {
          // Same project - stop it first
          console.log(`[ServerManager] Port ${port} used by same project, stopping first`);
          await this.stopServer(projectId);
        } else {
          // Different project using the port
          console.log(`[ServerManager] Port ${port} used by project ${managedProjectId}`);
          this.emit('port-conflict', {
            projectId,
            port,
            conflictingProjectId: managedProjectId,
            pids
          });
          // Stop the conflicting project's server
          await this.stopServer(managedProjectId);
        }
        // Recheck
        return this.ensurePortAvailable(port, projectId);
      }
    }

    // Unknown process using the port - ask to clear
    console.log(`[ServerManager] Port ${port} used by unknown process(es): ${pids.join(', ')}`);
    this.emit('port-conflict', {
      projectId,
      port,
      pids,
      message: `Port ${port} is in use by process(es): ${pids.join(', ')}`
    });

    // Clear the port
    const result = await this.clearPort(port);
    if (result.cleared) {
      console.log(`[ServerManager] Port ${port} cleared successfully`);
      return { available: true, wasCleared: true };
    } else {
      return { available: false, error: `Could not clear port ${port}`, details: result };
    }
  }

  // ============================================
  // Package.json Analysis
  // ============================================

  /**
   * Analyze a project directory to detect server configuration
   */
  async analyzeProject(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return {
        detected: {
          startCommand: null,
          port: 3000,
          scripts: [],
          hasBackend: false,
          framework: null,
          hasClient: false,
          clientPort: null,
          frontendUrl: null
        },
        overrides: {}
      };
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const scripts = Object.keys(packageJson.scripts || {});
      const startCommand = this.detectStartCommand(packageJson);
      const port = await this.detectPort(projectPath, packageJson);
      const framework = this.detectFramework(packageJson);
      const hasBackend = framework !== null || this.hasBackendDependencies(packageJson);

      // Check for separate client folder
      const clientInfo = this.detectClientFolder(projectPath);

      return {
        detected: {
          startCommand,
          port,
          scripts,
          hasBackend,
          framework,
          hasClient: clientInfo.hasClient,
          clientPort: clientInfo.port,
          clientStartCommand: clientInfo.startCommand,
          frontendUrl: clientInfo.hasClient ? `http://localhost:${clientInfo.port}` : null
        },
        overrides: {},
        lastAnalyzed: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ServerManager] Failed to analyze package.json:', err);
      return {
        detected: {
          startCommand: null,
          port: 3000,
          scripts: [],
          hasBackend: false,
          framework: null,
          hasClient: false,
          clientPort: null,
          frontendUrl: null
        },
        overrides: {},
        error: err.message
      };
    }
  }

  /**
   * Detect a separate client/frontend folder
   */
  detectClientFolder(projectPath) {
    const clientPaths = ['client', 'frontend', 'web', 'app'];

    for (const clientDir of clientPaths) {
      const clientPath = path.join(projectPath, clientDir);
      const clientPackageJson = path.join(clientPath, 'package.json');

      if (fs.existsSync(clientPackageJson)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(clientPackageJson, 'utf8'));
          const scripts = pkg.scripts || {};

          // Detect port from scripts first (e.g., "serve -p 3000")
          let port = 3000; // Default
          for (const script of Object.values(scripts)) {
            const portMatch = script.match(/(?:--port[=\s]+|-p\s+)(\d+)/);
            if (portMatch) {
              port = parseInt(portMatch[1], 10);
              break;
            }
          }

          // Also check vite.config.ts/js
          const viteConfigTs = path.join(clientPath, 'vite.config.ts');
          const viteConfigJs = path.join(clientPath, 'vite.config.js');
          const viteConfigPath = fs.existsSync(viteConfigTs) ? viteConfigTs :
                                 fs.existsSync(viteConfigJs) ? viteConfigJs : null;

          if (viteConfigPath) {
            try {
              const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
              const vitePortMatch = viteConfig.match(/port\s*:\s*(\d+)/);
              if (vitePortMatch) {
                port = parseInt(vitePortMatch[1], 10);
              }
            } catch (e) {
              // Ignore vite config parse errors
            }
          }

          // Determine start command
          let startCommand = null;
          if (scripts.dev) startCommand = 'npm run dev';
          else if (scripts.start) startCommand = 'npm start';
          else if (scripts.serve) startCommand = 'npm run serve';

          return {
            hasClient: true,
            path: clientPath,
            port,
            startCommand,
            isVite: fs.existsSync(viteConfigTs) || fs.existsSync(viteConfigJs)
          };
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    return { hasClient: false, port: null, startCommand: null };
  }

  /**
   * Detect the best start command from package.json
   * Priority: dev > start > main field
   */
  detectStartCommand(packageJson) {
    const scripts = packageJson.scripts || {};

    // Priority order for start commands
    if (scripts.dev) {
      return 'npm run dev';
    }
    if (scripts.start) {
      return 'npm start';
    }
    if (packageJson.main) {
      return `node ${packageJson.main}`;
    }

    // Check for common patterns
    if (scripts.serve) {
      return 'npm run serve';
    }
    if (scripts.server) {
      return 'npm run server';
    }

    return null;
  }

  /**
   * Detect port from .env file or script arguments
   */
  async detectPort(projectPath, packageJson) {
    // Check .env file first
    const envPath = path.join(projectPath, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
        if (portMatch) {
          return parseInt(portMatch[1], 10);
        }
      } catch (err) {
        // Ignore errors reading .env
      }
    }

    // Check scripts for port flags
    const scripts = packageJson.scripts || {};
    for (const script of Object.values(scripts)) {
      const portMatch = script.match(/--port[=\s]+(\d+)|-p\s+(\d+)/);
      if (portMatch) {
        return parseInt(portMatch[1] || portMatch[2], 10);
      }
    }

    // Default port based on framework
    const framework = this.detectFramework(packageJson);
    const frameworkPorts = {
      'express': 3000,
      'fastify': 3000,
      'koa': 3000,
      'nest': 3000,
      'next': 3000,
      'nuxt': 3000,
      'vite': 5173,
      'react': 3000,
      'vue': 8080,
      'angular': 4200
    };

    return frameworkPorts[framework] || 3000;
  }

  /**
   * Detect the framework from dependencies
   */
  detectFramework(packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Server frameworks (priority order)
    if (deps['express']) return 'express';
    if (deps['fastify']) return 'fastify';
    if (deps['koa']) return 'koa';
    if (deps['@nestjs/core']) return 'nest';
    if (deps['hapi'] || deps['@hapi/hapi']) return 'hapi';

    // Full-stack frameworks
    if (deps['next']) return 'next';
    if (deps['nuxt']) return 'nuxt';

    // Frontend build tools (less likely to need server management)
    if (deps['vite']) return 'vite';

    return null;
  }

  /**
   * Check if package has backend dependencies
   */
  hasBackendDependencies(packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    const backendIndicators = [
      'express', 'fastify', 'koa', 'hapi', '@nestjs/core',
      'pg', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'redis',
      'sequelize', 'typeorm', 'prisma', 'knex',
      'ws', 'socket.io', 'jsonwebtoken', 'bcrypt', 'passport'
    ];

    return backendIndicators.some(dep => deps[dep]);
  }

  // ============================================
  // Server Lifecycle
  // ============================================

  /**
   * Start a game server (and client if present)
   */
  async startServer(projectId, projectPath, config = {}) {
    // Stop existing server if running
    if (this.runningServers.has(projectId)) {
      await this.stopServer(projectId);
    }

    // Analyze project to detect backend and client
    const analysis = await this.analyzeProject(projectPath);

    // Determine port and clear if needed
    const port = config.port || analysis.detected?.port || 3000;
    const clientPort = analysis.detected?.clientPort;

    console.log(`[ServerManager] Ensuring port ${port} is available...`);
    const portResult = await this.ensurePortAvailable(port, projectId);
    if (!portResult.available) {
      throw new Error(`Cannot start server: ${portResult.error}`);
    }
    if (portResult.wasCleared) {
      console.log(`[ServerManager] Cleared stale process from port ${port}`);
      this.emit('server-output', {
        projectId,
        output: `Cleared stale process from port ${port}`,
        type: 'info'
      });
    }

    // Also clear client port if we have one
    if (clientPort && clientPort !== port) {
      console.log(`[ServerManager] Ensuring client port ${clientPort} is available...`);
      const clientPortResult = await this.ensurePortAvailable(clientPort, projectId);
      if (!clientPortResult.available) {
        console.warn(`[ServerManager] Client port ${clientPort} could not be cleared: ${clientPortResult.error}`);
      }
    }

    // Determine start command
    let startCommand = config.startCommand || analysis.detected?.startCommand;

    if (!startCommand) {
      throw new Error('No start command found. Please configure server settings.');
    }

    // Parse command into parts
    const [cmd, ...args] = startCommand.split(' ');

    console.log(`[ServerManager] Starting server for ${projectId}: ${startCommand}`);
    console.log(`[ServerManager] Working directory: ${projectPath}`);

    // Also start client if detected
    let clientProcess = null;
    let clientInfo = null;
    if (analysis.detected?.hasClient) {
      const clientPath = path.join(projectPath, 'client');
      const clientCmd = analysis.detected.clientStartCommand || 'npm run dev';
      console.log(`[ServerManager] Also starting client: ${clientCmd} in ${clientPath}`);

      clientProcess = spawn('npm', ['run', 'dev'], {
        cwd: clientPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PWD: clientPath,
          NODE_ENV: config.nodeEnv || 'development'
        }
      });

      clientInfo = {
        process: clientProcess,
        pid: clientProcess.pid,
        port: analysis.detected.clientPort,
        url: analysis.detected.frontendUrl
      };

      // Log client output
      clientProcess.stdout.on('data', (data) => {
        this.handleOutput(projectId, 'stdout', `[client] ${data.toString()}`);
      });
      clientProcess.stderr.on('data', (data) => {
        this.handleOutput(projectId, 'stderr', `[client] ${data.toString()}`);
      });
      clientProcess.on('close', (code) => {
        console.log(`[ServerManager] Client process exited with code ${code}`);
      });
    }

    return new Promise((resolve, reject) => {
      const serverProcess = spawn(cmd, args, {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PWD: projectPath,
          NODE_ENV: config.nodeEnv || 'development'
        }
      });

      const serverInfo = {
        projectId,
        process: serverProcess,
        pid: serverProcess.pid,
        status: 'starting',
        port: config.port || 3000,
        startedAt: new Date(),
        logs: new CircularBuffer(1000),
        command: startCommand,
        url: null,
        exitCode: null,
        healthCheckInterval: null,
        // Client info for projects with separate frontend
        clientProcess: clientProcess,
        clientPid: clientInfo?.pid || null,
        clientPort: clientInfo?.port || analysis.detected?.clientPort || null,
        // Use detected frontendUrl even if client process wasn't started
        frontendUrl: clientInfo?.url || analysis.detected?.frontendUrl || null
      };

      this.runningServers.set(projectId, serverInfo);

      // Handle stdout
      serverProcess.stdout.on('data', (data) => {
        const text = data.toString();
        this.handleOutput(projectId, 'stdout', text);

        // Try to detect port from output
        const portMatch = text.match(/(?:listening|running|started).*?(?:port|:)\s*(\d+)/i);
        if (portMatch && serverInfo.status === 'starting') {
          serverInfo.port = parseInt(portMatch[1], 10);
          serverInfo.url = `http://localhost:${serverInfo.port}`;
          serverInfo.status = 'running';

          this.emit('server-started', {
            projectId,
            pid: serverInfo.pid,
            port: serverInfo.port,
            url: serverInfo.url,
            command: startCommand,
            // Include frontend URL if we have a separate client
            frontendUrl: serverInfo.frontendUrl,
            clientPort: serverInfo.clientPort
          });

          // Start health checks
          this.startHealthCheck(projectId);

          resolve({
            pid: serverInfo.pid,
            port: serverInfo.port,
            url: serverInfo.url,
            frontendUrl: serverInfo.frontendUrl,
            status: 'running'
          });
        }
      });

      // Handle stderr - detect EADDRINUSE and other errors
      serverProcess.stderr.on('data', async (data) => {
        const text = data.toString();
        this.handleOutput(projectId, 'stderr', text);

        // Detect EADDRINUSE error
        if (text.includes('EADDRINUSE') && serverInfo.status === 'starting' && !serverInfo.retrying) {
          const portMatch = text.match(/(?:address already in use|EADDRINUSE).*?(\d+)/i);
          const conflictPort = portMatch ? parseInt(portMatch[1], 10) : serverInfo.port;

          console.log(`[ServerManager] Port ${conflictPort} conflict detected, attempting to clear...`);
          serverInfo.retrying = true;

          this.emit('server-output', {
            projectId,
            output: `Port ${conflictPort} in use, clearing and retrying...`,
            type: 'warning'
          });

          // Kill the current failed process
          try {
            process.kill(serverProcess.pid, 'SIGTERM');
          } catch (e) {}

          // Clear the port and retry
          const clearResult = await this.clearPort(conflictPort);
          if (clearResult.cleared) {
            console.log(`[ServerManager] Port cleared, retrying server start...`);
            // Small delay before retry
            setTimeout(async () => {
              try {
                const result = await this.startServer(projectId, projectPath, config);
                resolve(result);
              } catch (retryErr) {
                reject(retryErr);
              }
            }, 1500);
          } else {
            reject(new Error(`Failed to clear port ${conflictPort}: ${JSON.stringify(clearResult)}`));
          }
        }
      });

      // Handle process errors
      serverProcess.on('error', (err) => {
        console.error(`[ServerManager] Process error for ${projectId}:`, err);
        serverInfo.status = 'error';
        serverInfo.exitCode = -1;

        this.emit('server-error', {
          projectId,
          error: err.message,
          exitCode: -1
        });

        this.runningServers.delete(projectId);
        reject(err);
      });

      // Handle process exit
      serverProcess.on('close', (code) => {
        console.log(`[ServerManager] Server ${projectId} exited with code ${code}`);

        if (serverInfo.healthCheckInterval) {
          clearInterval(serverInfo.healthCheckInterval);
        }

        const wasRunning = serverInfo.status === 'running';
        serverInfo.status = 'stopped';
        serverInfo.exitCode = code;

        this.emit('server-stopped', {
          projectId,
          exitCode: code,
          reason: wasRunning ? 'exit' : 'startup-failed'
        });

        this.runningServers.delete(projectId);

        // If we haven't resolved yet (server never started), reject
        if (serverInfo.status === 'starting') {
          reject(new Error(`Server failed to start (exit code: ${code})`));
        }
      });

      // Timeout for startup
      setTimeout(() => {
        if (serverInfo.status === 'starting') {
          // Assume it's running if process is still alive
          serverInfo.status = 'running';
          serverInfo.url = `http://localhost:${serverInfo.port}`;

          this.emit('server-started', {
            projectId,
            pid: serverInfo.pid,
            port: serverInfo.port,
            url: serverInfo.url,
            command: startCommand
          });

          this.startHealthCheck(projectId);

          resolve({
            pid: serverInfo.pid,
            port: serverInfo.port,
            url: serverInfo.url,
            status: 'running'
          });
        }
      }, 10000); // 10 second startup timeout
    });
  }

  /**
   * Stop a game server
   */
  async stopServer(projectId) {
    const serverInfo = this.runningServers.get(projectId);
    if (!serverInfo) {
      console.log(`[ServerManager] No running server for ${projectId}`);
      return { success: true, reason: 'not-running' };
    }

    console.log(`[ServerManager] Stopping server ${projectId} (PID: ${serverInfo.pid})`);

    // Clear health check
    if (serverInfo.healthCheckInterval) {
      clearInterval(serverInfo.healthCheckInterval);
    }

    serverInfo.status = 'stopping';

    return new Promise((resolve) => {
      // Kill entire process tree recursively - npm spawns shell which spawns node which spawns more
      // pkill -P only kills direct children, we need to kill ALL descendants
      const killDescendants = (pid, signal = 'TERM') => {
        // Use pgrep to find all descendants recursively, then kill them
        exec(`pgrep -P ${pid}`, (err, stdout) => {
          if (!err && stdout.trim()) {
            const childPids = stdout.trim().split('\n');
            childPids.forEach(childPid => {
              killDescendants(childPid, signal); // Recursive
              try {
                process.kill(parseInt(childPid), signal === 'TERM' ? 'SIGTERM' : 'SIGKILL');
              } catch (e) {}
            });
          }
        });
      };

      const killTree = () => {
        try {
          // Kill all descendants first (recursive)
          killDescendants(serverInfo.pid, 'TERM');

          // Then kill the main process
          setTimeout(() => {
            try { serverInfo.process.kill('SIGTERM'); } catch (e) {}
          }, 100);

          // Also kill client process tree if present
          if (serverInfo.clientProcess && serverInfo.clientPid) {
            killDescendants(serverInfo.clientPid, 'TERM');
            setTimeout(() => {
              try { serverInfo.clientProcess.kill('SIGTERM'); } catch (e) {}
            }, 100);
          }
        } catch (e) {
          console.log(`[ServerManager] Error in graceful kill:`, e.message);
        }
      };

      const forceKillTree = () => {
        try {
          // Force kill all descendants
          killDescendants(serverInfo.pid, 'KILL');
          setTimeout(() => {
            try { serverInfo.process.kill('SIGKILL'); } catch (e) {}
          }, 100);

          // Also force kill client process tree if present
          if (serverInfo.clientProcess && serverInfo.clientPid) {
            killDescendants(serverInfo.clientPid, 'KILL');
            setTimeout(() => {
              try { serverInfo.clientProcess.kill('SIGKILL'); } catch (e) {}
            }, 100);
          }
        } catch (e) {
          console.log(`[ServerManager] Error in force kill:`, e.message);
        }
      };

      // Also find and kill by port as a final fallback
      const killByPort = () => {
        if (serverInfo.port) {
          exec(`lsof -t -i:${serverInfo.port} | xargs -r kill -9`, (err) => {});
        }
        if (serverInfo.clientPort) {
          exec(`lsof -t -i:${serverInfo.clientPort} | xargs -r kill -9`, (err) => {});
        }
      };

      killTree();

      // Force kill after 3 seconds
      const forceKillTimeout = setTimeout(() => {
        if (this.runningServers.has(projectId)) {
          console.log(`[ServerManager] Force killing server ${projectId}`);
          forceKillTree();
          killByPort();
        }
      }, 3000);

      // Handle close event
      const handleClose = () => {
        clearTimeout(forceKillTimeout);
        this.runningServers.delete(projectId);
        resolve({ success: true });
      };

      serverInfo.process.once('close', handleClose);

      // Fallback timeout in case close event never fires
      setTimeout(() => {
        this.runningServers.delete(projectId);
        killByPort();
        resolve({ success: true, reason: 'timeout' });
      }, 8000);
    });
  }

  /**
   * Restart a game server
   */
  async restartServer(projectId, projectPath, config = {}) {
    await this.stopServer(projectId);
    // Small delay to ensure port is released
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.startServer(projectId, projectPath, config);
  }

  /**
   * Check if a server is running
   */
  isServerRunning(projectId) {
    const serverInfo = this.runningServers.get(projectId);
    if (!serverInfo) return false;

    try {
      process.kill(serverInfo.pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get server status and recent logs
   */
  getServerStatus(projectId) {
    const serverInfo = this.runningServers.get(projectId);

    if (!serverInfo) {
      return {
        status: 'stopped',
        pid: null,
        port: null,
        url: null,
        logs: [],
        uptime: null
      };
    }

    const uptime = serverInfo.startedAt
      ? Math.round((Date.now() - serverInfo.startedAt.getTime()) / 1000)
      : null;

    return {
      status: serverInfo.status,
      pid: serverInfo.pid,
      port: serverInfo.port,
      url: serverInfo.url,
      frontendUrl: serverInfo.frontendUrl,
      clientPort: serverInfo.clientPort,
      command: serverInfo.command,
      logs: serverInfo.logs.getLast(100),
      uptime,
      startedAt: serverInfo.startedAt?.toISOString()
    };
  }

  // ============================================
  // Script Execution
  // ============================================

  /**
   * Run an npm script
   */
  async runScript(projectId, projectPath, scriptName) {
    console.log(`[ServerManager] Running script '${scriptName}' for ${projectId}`);

    this.emit('script-output', {
      projectId,
      script: scriptName,
      status: 'running',
      output: `Running npm run ${scriptName}...`
    });

    return new Promise((resolve, reject) => {
      const scriptProcess = spawn('npm', ['run', scriptName], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PWD: projectPath
        }
      });

      let output = '';
      let errorOutput = '';

      scriptProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.emit('script-output', {
          projectId,
          script: scriptName,
          status: 'running',
          output: text
        });
      });

      scriptProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        this.emit('script-output', {
          projectId,
          script: scriptName,
          status: 'running',
          output: text
        });
      });

      scriptProcess.on('close', (code) => {
        const status = code === 0 ? 'completed' : 'failed';
        const finalOutput = output + errorOutput;

        this.emit('script-output', {
          projectId,
          script: scriptName,
          status,
          output: finalOutput,
          exitCode: code
        });

        if (code === 0) {
          resolve({ success: true, output: finalOutput, exitCode: code });
        } else {
          reject(new Error(`Script '${scriptName}' failed with exit code ${code}`));
        }
      });

      scriptProcess.on('error', (err) => {
        this.emit('script-output', {
          projectId,
          script: scriptName,
          status: 'failed',
          output: err.message,
          exitCode: -1
        });
        reject(err);
      });
    });
  }

  // ============================================
  // Health Monitoring
  // ============================================

  /**
   * Start health check interval for a server
   */
  startHealthCheck(projectId) {
    const serverInfo = this.runningServers.get(projectId);
    if (!serverInfo) return;

    // Clear existing interval
    if (serverInfo.healthCheckInterval) {
      clearInterval(serverInfo.healthCheckInterval);
    }

    serverInfo.healthCheckInterval = setInterval(() => {
      if (!this.isServerRunning(projectId)) {
        console.log(`[ServerManager] Health check failed for ${projectId}`);

        clearInterval(serverInfo.healthCheckInterval);
        serverInfo.status = 'error';

        this.emit('server-error', {
          projectId,
          error: 'Server process died unexpectedly',
          exitCode: serverInfo.exitCode
        });

        this.runningServers.delete(projectId);
      }
    }, 30000); // Check every 30 seconds
  }

  // ============================================
  // Output Handling
  // ============================================

  /**
   * Handle output from server process
   */
  handleOutput(projectId, stream, data) {
    const serverInfo = this.runningServers.get(projectId);
    if (serverInfo) {
      serverInfo.logs.push({
        stream,
        data,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('server-output', {
      projectId,
      stream,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get recent logs for a server
   */
  getRecentLogs(projectId, lines = 100) {
    const serverInfo = this.runningServers.get(projectId);
    if (!serverInfo) return [];
    return serverInfo.logs.getLast(lines);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Stop all running servers (for graceful shutdown)
   */
  async stopAllServers() {
    const promises = [];
    for (const projectId of this.runningServers.keys()) {
      promises.push(this.stopServer(projectId));
    }
    await Promise.all(promises);
  }

  /**
   * Kill orphaned server processes on startup
   * (servers that were running when the app crashed)
   */
  async cleanupOrphanedServers(db) {
    try {
      // Get projects with non-null server_pid
      const projects = db.db.prepare(
        "SELECT id, server_pid FROM projects WHERE server_pid IS NOT NULL"
      ).all();

      for (const project of projects) {
        try {
          // Check if process is still running
          process.kill(project.server_pid, 0);
          // Process exists, kill it
          console.log(`[ServerManager] Killing orphaned server PID ${project.server_pid}`);
          process.kill(project.server_pid, 'SIGKILL');
        } catch (e) {
          // Process doesn't exist, just clear the PID
        }
        // Clear the PID in database
        db.updateServerStatus(project.id, 'stopped', null);
      }
    } catch (err) {
      console.error('[ServerManager] Error cleaning up orphaned servers:', err);
    }
  }

  // ============================================
  // Event System
  // ============================================

  on(event, callback) {
    this.eventCallbacks.push({ event, callback });
  }

  emit(event, data) {
    this.eventCallbacks
      .filter(e => e.event === event)
      .forEach(e => {
        try {
          e.callback(data);
        } catch (err) {
          console.error(`[ServerManager] Event callback error:`, err);
        }
      });
  }
}

module.exports = new ServerManager();
