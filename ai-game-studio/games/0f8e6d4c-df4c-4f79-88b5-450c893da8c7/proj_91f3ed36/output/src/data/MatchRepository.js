/**
 * Match Repository
 * Data access layer for match and move tables
 */

const BaseRepository = require('./BaseRepository');
const { Match, MatchMove } = require('../models/Match');

class MatchRepository extends BaseRepository {
  constructor(db) {
    super('match', db);
  }

  /**
   * Find match by ID
   */
  async findById(matchId) {
    const result = await this.query(
      'SELECT * FROM match WHERE match_id = $1',
      [matchId]
    );
    if (!result.rows[0]) return null;

    const match = this._mapToEntity(result.rows[0]);
    match.moves = await this.getMoves(matchId);
    return match;
  }

  /**
   * Find active match for player
   */
  async findActiveMatch(playerId) {
    const result = await this.query(
      `SELECT * FROM match
       WHERE player_id = $1 AND outcome IS NULL
       ORDER BY played_at DESC LIMIT 1`,
      [playerId]
    );
    if (!result.rows[0]) return null;

    const match = this._mapToEntity(result.rows[0]);
    match.moves = await this.getMoves(match.matchId);
    return match;
  }

  /**
   * Get match history for player
   */
  async getMatchHistory(playerId, { limit = 20, offset = 0, filters = {} } = {}) {
    let query = `SELECT * FROM match WHERE player_id = $1`;
    const params = [playerId];
    let paramIndex = 2;

    if (filters.outcome) {
      query += ` AND outcome = $${paramIndex}`;
      params.push(filters.outcome);
      paramIndex++;
    }
    if (filters.symbol) {
      query += ` AND symbol_played = $${paramIndex}`;
      params.push(filters.symbol);
      paramIndex++;
    }
    if (filters.aiTier) {
      query += ` AND ai_tier = $${paramIndex}`;
      params.push(filters.aiTier);
      paramIndex++;
    }

    query += ` ORDER BY played_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.query(query, params);
    return result.rows.map(row => this._mapToEntity(row));
  }

  /**
   * Count matches for player
   */
  async countMatches(playerId, filters = {}) {
    let query = `SELECT COUNT(*) as count FROM match WHERE player_id = $1`;
    const params = [playerId];
    let paramIndex = 2;

    if (filters.outcome) {
      query += ` AND outcome = $${paramIndex}`;
      params.push(filters.outcome);
      paramIndex++;
    }

    const result = await this.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create new match
   */
  async createMatch(matchData) {
    const result = await this.query(
      `INSERT INTO match (
        player_id, opponent_type, ai_tier, symbol_played,
        streak_count_at_start, played_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [
        matchData.playerId,
        matchData.opponentType,
        matchData.aiTier,
        matchData.symbolPlayed,
        matchData.streakCountAtStart || 0,
      ]
    );
    return this._mapToEntity(result.rows[0]);
  }

  /**
   * Update match
   */
  async updateMatch(matchId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${this._toSnakeCase(key)} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    values.push(matchId);

    const result = await this.query(
      `UPDATE match SET ${fields.join(', ')}
       WHERE match_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] ? this._mapToEntity(result.rows[0]) : null;
  }

  /**
   * Get moves for match
   */
  async getMoves(matchId) {
    const result = await this.query(
      `SELECT * FROM match_move
       WHERE match_id = $1
       ORDER BY turn_number ASC`,
      [matchId]
    );
    return result.rows.map(row => this._mapToMove(row));
  }

  /**
   * Add move to match
   */
  async addMove(moveData) {
    const result = await this.query(
      `INSERT INTO match_move (
        match_id, turn_number, cell_row, cell_col, symbol,
        is_player_move, cell_value, move_type, impact_score, timestamp_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        moveData.matchId,
        moveData.turnNumber,
        moveData.cellRow,
        moveData.cellCol,
        moveData.symbol,
        moveData.isPlayerMove,
        moveData.cellValue,
        moveData.moveType || 'normal',
        moveData.impactScore || moveData.cellValue,
        moveData.timestampMs || Date.now(),
      ]
    );
    return this._mapToMove(result.rows[0]);
  }

  // Private helper methods

  _mapToEntity(row) {
    return new Match({
      matchId: row.match_id,
      playerId: row.player_id,
      opponentType: row.opponent_type,
      opponentPlayerId: row.opponent_player_id,
      aiTier: row.ai_tier,
      symbolPlayed: row.symbol_played,
      outcome: row.outcome,
      totalMoves: row.total_moves,
      durationSeconds: row.duration_seconds,
      impactScoreTotal: row.impact_score_total,
      wasSwiftVictory: row.was_swift_victory,
      wasForkVictory: row.was_fork_victory,
      wasComeback: row.was_comeback,
      wasPerfectGame: row.was_perfect_game,
      streakCountAtStart: row.streak_count_at_start,
      streakShieldUsed: row.streak_shield_used,
      rewards: {
        cosmicEssence: row.essence_earned,
        starlightOrbs: row.orbs_earned,
        shadowShards: row.shards_earned,
        voidFragments: row.void_frags_earned,
        alignmentCrystals: row.align_crystals_earned,
        primordialSparks: row.prim_sparks_earned,
      },
      playedAt: row.played_at,
    });
  }

  _mapToMove(row) {
    return new MatchMove({
      moveId: row.move_id,
      matchId: row.match_id,
      turnNumber: row.turn_number,
      cellRow: row.cell_row,
      cellCol: row.cell_col,
      symbol: row.symbol,
      isPlayerMove: row.is_player_move,
      cellValue: row.cell_value,
      moveType: row.move_type,
      impactScore: row.impact_score,
      timestampMs: row.timestamp_ms,
    });
  }

  _toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

module.exports = MatchRepository;
