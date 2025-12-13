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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    // Migration: Add design_complexity column if it doesn't exist
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN design_complexity TEXT');
      console.log('[DB] Added design_complexity column');
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
  addToQueue(projectId, description) {
    const id = 'work_' + uuidv4().slice(0, 8);
    const priority = this.getNextPriority(projectId);
    const stmt = this.db.prepare(
      'INSERT INTO work_queue (id, project_id, description, priority) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, projectId, description, priority);
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
}

module.exports = new DatabaseService();
