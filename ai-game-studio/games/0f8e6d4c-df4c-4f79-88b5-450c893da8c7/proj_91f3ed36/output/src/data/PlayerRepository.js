/**
 * Player Repository
 * Data access layer for player-related tables
 */

const BaseRepository = require('./BaseRepository');
const Player = require('../models/Player');
const PlayerProgress = require('../models/PlayerProgress');
const PlayerWallet = require('../models/PlayerWallet');

class PlayerRepository extends BaseRepository {
  constructor(db) {
    super('player', db);
  }

  /**
   * Find player by ID
   */
  async findById(playerId) {
    const row = await super.findById(playerId, 'player_id');
    return row ? this._mapToEntity(row) : null;
  }

  /**
   * Find player by username
   */
  async findByUsername(username) {
    const result = await this.query(
      'SELECT * FROM player WHERE username = $1',
      [username]
    );
    return result.rows[0] ? this._mapToEntity(result.rows[0]) : null;
  }

  /**
   * Find player by email
   */
  async findByEmail(email) {
    const result = await this.query(
      'SELECT * FROM player WHERE email = $1',
      [email]
    );
    return result.rows[0] ? this._mapToEntity(result.rows[0]) : null;
  }

  /**
   * Create new player with progress and wallet
   */
  async createPlayer(playerData) {
    await this.beginTransaction();

    try {
      // Create player record
      const playerResult = await this.query(
        `INSERT INTO player (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [playerData.username, playerData.email, playerData.passwordHash, playerData.displayName]
      );
      const player = this._mapToEntity(playerResult.rows[0]);

      // Create player progress
      await this.query(
        `INSERT INTO player_progress (player_id) VALUES ($1)`,
        [player.playerId]
      );

      // Create player wallet
      await this.query(
        `INSERT INTO player_wallet (player_id) VALUES ($1)`,
        [player.playerId]
      );

      // Create player streak
      await this.query(
        `INSERT INTO player_streak (player_id) VALUES ($1)`,
        [player.playerId]
      );

      await this.commit();
      return player;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Get player progress
   */
  async getProgress(playerId) {
    const result = await this.query(
      'SELECT * FROM player_progress WHERE player_id = $1',
      [playerId]
    );
    return result.rows[0] ? this._mapToProgress(result.rows[0]) : null;
  }

  /**
   * Update player progress
   */
  async updateProgress(playerId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${this._toSnakeCase(key)} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);
    values.push(playerId);

    const result = await this.query(
      `UPDATE player_progress SET ${fields.join(', ')}
       WHERE player_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] ? this._mapToProgress(result.rows[0]) : null;
  }

  /**
   * Get player wallet
   */
  async getWallet(playerId) {
    const result = await this.query(
      'SELECT * FROM player_wallet WHERE player_id = $1',
      [playerId]
    );
    return result.rows[0] ? this._mapToWallet(result.rows[0]) : null;
  }

  /**
   * Update player wallet
   */
  async updateWallet(playerId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${this._toSnakeCase(key)} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);
    values.push(playerId);

    const result = await this.query(
      `UPDATE player_wallet SET ${fields.join(', ')}
       WHERE player_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] ? this._mapToWallet(result.rows[0]) : null;
  }

  /**
   * Get player streak
   */
  async getStreak(playerId) {
    const result = await this.query(
      'SELECT * FROM player_streak WHERE player_id = $1',
      [playerId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update player streak
   */
  async updateStreak(playerId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${this._toSnakeCase(key)} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    values.push(playerId);

    const result = await this.query(
      `UPDATE player_streak SET ${fields.join(', ')}
       WHERE player_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  // Private helper methods

  _mapToEntity(row) {
    return new Player({
      playerId: row.player_id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      isActive: row.is_active,
      accountFlags: row.account_flags,
    });
  }

  _mapToProgress(row) {
    return new PlayerProgress({
      playerId: row.player_id,
      level: row.level,
      cosmicResonance: row.cosmic_resonance,
      prestigeLevel: row.prestige_level,
      totalMatches: row.total_matches,
      totalWins: row.total_wins,
      totalDraws: row.total_draws,
      totalLosses: row.total_losses,
      winsAsO: row.wins_as_o,
      winsAsX: row.wins_as_x,
      drawsVsEternal: row.draws_vs_eternal,
      perfectGames: row.perfect_games,
      swiftVictories: row.swift_victories,
      forkVictories: row.fork_victories,
      comebackVictories: row.comeback_victories,
      firstMatchDate: row.first_match_date,
      updatedAt: row.updated_at,
    });
  }

  _mapToWallet(row) {
    return new PlayerWallet({
      playerId: row.player_id,
      cosmicEssence: row.cosmic_essence,
      starlightOrbs: row.starlight_orbs,
      shadowShards: row.shadow_shards,
      voidFragments: row.void_fragments,
      alignmentCrystals: row.alignment_crystals,
      primordialSparks: row.primordial_sparks,
      updatedAt: row.updated_at,
    });
  }

  _toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

module.exports = PlayerRepository;
