/**
 * Base Repository
 * Abstract data access layer with common CRUD operations
 */

class BaseRepository {
  constructor(tableName, db) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Find record by primary key
   */
  async findById(id, idColumn = 'id') {
    const query = `SELECT * FROM ${this.tableName} WHERE ${idColumn} = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all records with optional filters
   */
  async findAll({ where = {}, limit = 100, offset = 0, orderBy = null } = {}) {
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause
    const conditions = [];
    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    // Add LIMIT and OFFSET
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Count records with optional filters
   */
  async count(where = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    let paramIndex = 1;

    const conditions = [];
    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Insert a new record
   */
  async create(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update record by primary key
   */
  async update(id, data, idColumn = 'id') {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${idColumn} = $${columns.length + 1}
      RETURNING *
    `;

    const result = await this.db.query(query, [...values, id]);
    return result.rows[0] || null;
  }

  /**
   * Delete record by primary key
   */
  async delete(id, idColumn = 'id') {
    const query = `DELETE FROM ${this.tableName} WHERE ${idColumn} = $1 RETURNING *`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Execute raw query
   */
  async query(sql, params = []) {
    return this.db.query(sql, params);
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    return this.db.query('BEGIN');
  }

  /**
   * Commit transaction
   */
  async commit() {
    return this.db.query('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    return this.db.query('ROLLBACK');
  }
}

module.exports = BaseRepository;
