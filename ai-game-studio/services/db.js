/**
 * Database Service - SQLite for AI Game Studio
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../data/studio.db');

class DatabaseService {
  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  init() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        game_idea TEXT NOT NULL,
        game_type TEXT DEFAULT '2d',
        design_complexity TEXT,
        status TEXT DEFAULT 'designing',
        design_pipeline_id TEXT,
        feature_pipeline_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Add design_complexity column if it doesn't exist (for existing databases)
      -- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle this in code

      CREATE TABLE IF NOT EXISTS work_queue (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        priority INTEGER DEFAULT 0,
        pipeline_id TEXT,
        pipeline_type TEXT DEFAULT 'feature',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS ai_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        pipeline_id TEXT,
        stage_id TEXT,
        agent_name TEXT,
        action_type TEXT NOT NULL,
        model TEXT DEFAULT 'claude-sonnet-4-20250514',
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON ai_usage(project_id);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_pipeline ON ai_usage(pipeline_id);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action_type);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
    `);

    // Migration: Add design_complexity column if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN design_complexity TEXT');
      console.log('[DB] Added design_complexity column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Migration: Add custom_path column for imported external projects
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN custom_path TEXT');
      console.log('[DB] Added custom_path column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Migration: Add server_config column for server settings (JSON)
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN server_config TEXT');
      console.log('[DB] Added server_config column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Migration: Add server_status column
    try {
      this.db.exec("ALTER TABLE projects ADD COLUMN server_status TEXT DEFAULT 'stopped'");
      console.log('[DB] Added server_status column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Migration: Add server_pid column
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN server_pid INTEGER');
      console.log('[DB] Added server_pid column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Migration: Add pipeline_type column to work_queue
    try {
      this.db.exec("ALTER TABLE work_queue ADD COLUMN pipeline_type TEXT DEFAULT 'feature'");
      console.log('[DB] Added pipeline_type column to work_queue');
    } catch (err) {
      // Column already exists, ignore error
    }

    console.log('[DB] Database initialized');
  }

  // User methods
  createUser(email, passwordHash) {
    const id = uuidv4();
    const stmt = this.db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
    stmt.run(id, email, passwordHash);
    return { id, email };
  }

  getUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT id, email, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  // Session methods
  createSession(userId) {
    const token = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
    stmt.run(token, userId, expiresAt);
    return { token, expiresAt };
  }

  getSession(token) {
    // Use parameterized query to avoid quoting issues
    const now = new Date().toISOString();
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?');
    return stmt.get(token, now);
  }

  deleteSession(token) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  // Project methods
  createProject(userId, name, gameIdea, gameType = '2d', designComplexity = null) {
    const id = 'proj_' + uuidv4().slice(0, 8);
    const stmt = this.db.prepare(
      'INSERT INTO projects (id, user_id, name, game_idea, game_type, design_complexity) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, userId, name, gameIdea, gameType, designComplexity);
    return this.getProject(id);
  }

  /**
   * Import an existing external project
   * @param {string} userId - User ID
   * @param {string} name - Project name
   * @param {string} description - Brief description of the game
   * @param {string} customPath - Path to existing game files (WSL format)
   * @param {string} status - Initial status (default: 'live')
   */
  importProject(userId, name, description, customPath, status = 'live') {
    const id = 'proj_' + uuidv4().slice(0, 8);
    const stmt = this.db.prepare(
      'INSERT INTO projects (id, user_id, name, game_idea, game_type, status, custom_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, userId, name, description, '2d', status, customPath);
    return this.getProject(id);
  }

  getProject(id) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id);
  }

  getProjectsByUser(userId) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  }

  updateProjectStatus(id, status, pipelineId = null) {
    const now = new Date().toISOString();
    if (pipelineId) {
      const field = status === 'designing' ? 'design_pipeline_id' : 'feature_pipeline_id';
      const stmt = this.db.prepare(`UPDATE projects SET status = ?, ${field} = ?, updated_at = ? WHERE id = ?`);
      stmt.run(status, pipelineId, now, id);
    } else {
      const stmt = this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?');
      stmt.run(status, now, id);
    }
    return this.getProject(id);
  }

  deleteProject(id) {
    // Delete work queue items first
    this.db.prepare('DELETE FROM work_queue WHERE project_id = ?').run(id);
    // Delete project
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // Work queue methods
  addToQueue(projectId, description, pipelineType = 'feature') {
    const id = 'work_' + uuidv4().slice(0, 8);
    const priority = this.getNextPriority(projectId);
    const stmt = this.db.prepare(
      'INSERT INTO work_queue (id, project_id, description, priority, pipeline_type) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, projectId, description, priority, pipelineType);
    return this.getWorkItem(id);
  }

  getWorkItem(id) {
    const stmt = this.db.prepare('SELECT * FROM work_queue WHERE id = ?');
    return stmt.get(id);
  }

  getNextPriority(projectId) {
    const stmt = this.db.prepare('SELECT MAX(priority) as max FROM work_queue WHERE project_id = ?');
    const result = stmt.get(projectId);
    return (result.max || 0) + 1;
  }

  getQueue(projectId) {
    const stmt = this.db.prepare(
      'SELECT * FROM work_queue WHERE project_id = ? ORDER BY status DESC, priority ASC'
    );
    return stmt.all(projectId);
  }

  getNextQueuedItem(projectId) {
    // Use parameterized query for string literal
    const stmt = this.db.prepare(
      'SELECT * FROM work_queue WHERE project_id = ? AND status = ? ORDER BY priority ASC LIMIT 1'
    );
    return stmt.get(projectId, 'queued');
  }

  getCurrentWork(projectId) {
    // Use parameterized query for string literal
    const stmt = this.db.prepare(
      'SELECT * FROM work_queue WHERE project_id = ? AND status = ? LIMIT 1'
    );
    return stmt.get(projectId, 'in_progress');
  }

  updateWorkStatus(id, status, pipelineId = null) {
    const now = new Date().toISOString();
    let stmt;
    if (status === 'in_progress') {
      stmt = this.db.prepare('UPDATE work_queue SET status = ?, pipeline_id = ?, started_at = ? WHERE id = ?');
      stmt.run(status, pipelineId, now, id);
    } else if (status === 'completed') {
      stmt = this.db.prepare('UPDATE work_queue SET status = ?, completed_at = ? WHERE id = ?');
      stmt.run(status, now, id);
    } else {
      stmt = this.db.prepare('UPDATE work_queue SET status = ? WHERE id = ?');
      stmt.run(status, id);
    }
    return this.getWorkItem(id);
  }

  deleteWorkItem(id) {
    this.db.prepare('DELETE FROM work_queue WHERE id = ?').run(id);
  }

  // Get projects with incomplete design pipelines
  getIncompleteDesignProjects() {
    const stmt = this.db.prepare(
      'SELECT * FROM projects WHERE status = ? AND design_pipeline_id IS NOT NULL'
    );
    return stmt.all('designing');
  }

  // Get projects with in-progress work items (incomplete feature pipelines)
  getIncompleteWorkItems() {
    const stmt = this.db.prepare(
      'SELECT * FROM work_queue WHERE status = ? AND pipeline_id IS NOT NULL'
    );
    return stmt.all('in_progress');
  }

  // Get project by pipeline ID
  getProjectByPipelineId(pipelineId) {
    const stmt = this.db.prepare(
      'SELECT * FROM projects WHERE design_pipeline_id = ? OR feature_pipeline_id = ?'
    );
    return stmt.get(pipelineId, pipelineId);
  }

  // Update project's design pipeline ID
  setDesignPipelineId(projectId, pipelineId) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'UPDATE projects SET design_pipeline_id = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(pipelineId, now, projectId);
    return this.getProject(projectId);
  }

  // ============================================
  // Server Management Methods
  // ============================================

  /**
   * Update server configuration for a project
   */
  updateServerConfig(projectId, config) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'UPDATE projects SET server_config = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(JSON.stringify(config), now, projectId);
    return this.getProject(projectId);
  }

  /**
   * Update server status and PID for a project
   */
  updateServerStatus(projectId, status, pid = null) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'UPDATE projects SET server_status = ?, server_pid = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(status, pid, now, projectId);
    return this.getProject(projectId);
  }

  /**
   * Get server configuration for a project
   */
  getProjectServerConfig(projectId) {
    const project = this.getProject(projectId);
    if (project && project.server_config) {
      try {
        return JSON.parse(project.server_config);
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  /**
   * Get all projects with non-null server PID (for cleanup on startup)
   */
  getProjectsWithRunningServers() {
    const stmt = this.db.prepare(
      'SELECT id, server_pid FROM projects WHERE server_pid IS NOT NULL'
    );
    return stmt.all();
  }

  // ============================================
  // Chat History Methods
  // ============================================

  /**
   * Add a chat message to history
   * @param {string} projectId - Project ID
   * @param {string} messageType - Type: 'user', 'system', 'agent', 'stage', 'commentary'
   * @param {string} content - Message content (can be stringified JSON for complex messages)
   * @param {object} metadata - Optional metadata (agent name, stage info, etc.)
   */
  addChatMessage(projectId, messageType, content, metadata = null) {
    const stmt = this.db.prepare(
      'INSERT INTO chat_history (project_id, message_type, content, metadata) VALUES (?, ?, ?, ?)'
    );
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    const result = stmt.run(projectId, messageType, content, metadataStr);
    return result.lastInsertRowid;
  }

  /**
   * Get chat history for a project
   * @param {string} projectId - Project ID
   * @param {number} limit - Maximum messages to return (0 = all)
   */
  getChatHistory(projectId, limit = 100) {
    let stmt;
    if (limit > 0) {
      stmt = this.db.prepare(
        'SELECT * FROM chat_history WHERE project_id = ? ORDER BY created_at ASC LIMIT ?'
      );
      return stmt.all(projectId, limit).map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));
    } else {
      stmt = this.db.prepare(
        'SELECT * FROM chat_history WHERE project_id = ? ORDER BY created_at ASC'
      );
      return stmt.all(projectId).map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));
    }
  }

  /**
   * Clear chat history for a project
   */
  clearChatHistory(projectId) {
    const stmt = this.db.prepare('DELETE FROM chat_history WHERE project_id = ?');
    return stmt.run(projectId);
  }

  // ============================================
  // AI Usage Tracking Methods
  // ============================================

  // Pricing per 1M tokens (as of Dec 2024)
  static PRICING = {
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
    'default': { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 }
  };

  /**
   * Calculate cost from token counts
   */
  calculateCost(model, inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) {
    const pricing = DatabaseService.PRICING[model] || DatabaseService.PRICING['default'];
    const cost = (
      (inputTokens / 1000000) * pricing.input +
      (outputTokens / 1000000) * pricing.output +
      (cacheReadTokens / 1000000) * pricing.cacheRead +
      (cacheWriteTokens / 1000000) * pricing.cacheWrite
    );
    return Math.round(cost * 1000000) / 1000000; // Round to 6 decimal places
  }

  /**
   * Record AI usage
   */
  recordAiUsage(data) {
    const {
      projectId = null,
      pipelineId = null,
      stageId = null,
      agentName = null,
      actionType,
      model = 'claude-sonnet-4-20250514',
      inputTokens = 0,
      outputTokens = 0,
      cacheReadTokens = 0,
      cacheWriteTokens = 0,
      durationMs = 0,
      metadata = null,
      costUsd: providedCost = null  // Accept actual cost from Claude CLI
    } = data;

    const totalTokens = inputTokens + outputTokens;
    // Use provided cost from Claude CLI if available, otherwise calculate
    const costUsd = providedCost !== null ? providedCost : this.calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);

    const stmt = this.db.prepare(`
      INSERT INTO ai_usage (
        project_id, pipeline_id, stage_id, agent_name, action_type, model,
        input_tokens, output_tokens, total_tokens, cache_read_tokens, cache_write_tokens,
        cost_usd, duration_ms, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      projectId, pipelineId, stageId, agentName, actionType, model,
      inputTokens, outputTokens, totalTokens, cacheReadTokens, cacheWriteTokens,
      costUsd, durationMs, metadata ? JSON.stringify(metadata) : null
    );

    return { id: result.lastInsertRowid, costUsd, totalTokens };
  }

  /**
   * Get AI usage for a project
   */
  getProjectUsage(projectId, options = {}) {
    const { limit = 100, offset = 0, actionType = null, startDate = null, endDate = null } = options;

    let query = 'SELECT * FROM ai_usage WHERE project_id = ?';
    const params = [projectId];

    if (actionType) {
      query += ' AND action_type = ?';
      params.push(actionType);
    }
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  /**
   * Get usage summary for a project
   */
  getProjectUsageSummary(projectId) {
    const stmt = this.db.prepare(`
      SELECT
        action_type,
        COUNT(*) as call_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cache_write_tokens) as total_cache_write,
        SUM(cost_usd) as total_cost,
        AVG(duration_ms) as avg_duration_ms
      FROM ai_usage
      WHERE project_id = ?
      GROUP BY action_type
    `);
    return stmt.all(projectId);
  }

  /**
   * Get usage summary for a pipeline
   */
  getPipelineUsageSummary(pipelineId) {
    const stmt = this.db.prepare(`
      SELECT
        stage_id,
        agent_name,
        action_type,
        COUNT(*) as call_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(duration_ms) as avg_duration_ms
      FROM ai_usage
      WHERE pipeline_id = ?
      GROUP BY stage_id, agent_name
      ORDER BY MIN(created_at)
    `);
    return stmt.all(pipelineId);
  }

  /**
   * Get global usage summary (all projects)
   */
  getGlobalUsageSummary(options = {}) {
    const { startDate = null, endDate = null } = options;

    let query = `
      SELECT
        action_type,
        COUNT(*) as call_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(duration_ms) as avg_duration_ms
      FROM ai_usage
    `;
    const params = [];

    if (startDate || endDate) {
      query += ' WHERE 1=1';
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }
    }

    query += ' GROUP BY action_type';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Get total cost across all usage
   */
  getTotalCost(projectId = null) {
    let query = 'SELECT SUM(cost_usd) as total_cost, SUM(total_tokens) as total_tokens, COUNT(*) as call_count FROM ai_usage';
    const params = [];

    if (projectId) {
      query += ' WHERE project_id = ?';
      params.push(projectId);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);
    return {
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      callCount: result.call_count || 0
    };
  }

  /**
   * Get daily usage breakdown
   */
  getDailyUsage(projectId = null, days = 30) {
    let query = `
      SELECT
        DATE(created_at) as date,
        action_type,
        COUNT(*) as call_count,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost
      FROM ai_usage
      WHERE created_at >= DATE('now', '-' || ? || ' days')
    `;
    const params = [days];

    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    query += ' GROUP BY DATE(created_at), action_type ORDER BY date DESC, action_type';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }
}

module.exports = new DatabaseService();
