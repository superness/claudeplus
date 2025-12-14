/**
 * Match Entity Model
 * Represents a single tic-tac-toe game session
 */

class Match {
  constructor(data = {}) {
    this.matchId = data.matchId || null;
    this.playerId = data.playerId || null;
    this.opponentType = data.opponentType || 'ai';
    this.opponentPlayerId = data.opponentPlayerId || null;
    this.aiTier = data.aiTier || null;
    this.symbolPlayed = data.symbolPlayed || 'o';
    this.outcome = data.outcome || null;
    this.totalMoves = data.totalMoves || 0;
    this.durationSeconds = data.durationSeconds || 0;
    this.impactScoreTotal = data.impactScoreTotal || 0;
    this.wasSwiftVictory = data.wasSwiftVictory || false;
    this.wasForkVictory = data.wasForkVictory || false;
    this.wasComeback = data.wasComeback || false;
    this.wasPerfectGame = data.wasPerfectGame || false;
    this.streakCountAtStart = data.streakCountAtStart || 0;
    this.streakShieldUsed = data.streakShieldUsed || false;
    this.rewards = data.rewards || {};
    this.playedAt = data.playedAt ? new Date(data.playedAt) : new Date();

    // Game state
    this.board = data.board || [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    this.moves = data.moves || [];
    this.currentTurn = data.currentTurn || 'player';
    this.status = data.status || 'in_progress';
  }

  static AI_TIERS = {
    VOID_NOVICE: 'void_novice',
    ECHOING_ACOLYTE: 'echoing_acolyte',
    GRID_WALKER: 'grid_walker',
    FORCE_ADEPT: 'force_adept',
    THE_ETERNAL: 'the_eternal',
  };

  static REWARD_MULTIPLIERS = {
    void_novice: 0.5,
    echoing_acolyte: 0.75,
    grid_walker: 1.0,
    force_adept: 1.5,
    the_eternal: 2.0,
  };

  static OUTCOMES = {
    WIN: 'win',
    LOSS: 'loss',
    DRAW: 'draw',
  };

  /**
   * Check if a cell is valid and empty
   */
  isValidMove(row, col) {
    if (row < 0 || row > 2 || col < 0 || col > 2) return false;
    return this.board[row][col] === null;
  }

  /**
   * Make a move on the board
   */
  makeMove(row, col, symbol, isPlayerMove = true) {
    if (!this.isValidMove(row, col)) {
      throw new Error('Invalid move');
    }
    if (this.status !== 'in_progress') {
      throw new Error('Match is not in progress');
    }

    this.board[row][col] = symbol;
    const move = new MatchMove({
      matchId: this.matchId,
      turnNumber: this.moves.length + 1,
      cellRow: row,
      cellCol: col,
      symbol,
      isPlayerMove,
    });
    this.moves.push(move);
    this.totalMoves = this.moves.length;

    // Check for win/draw
    const winner = this.checkWinner();
    if (winner) {
      this.status = 'completed';
      this.outcome = winner === this.symbolPlayed ? 'win' : 'loss';
    } else if (this.isBoardFull()) {
      this.status = 'completed';
      this.outcome = 'draw';
    }

    return move;
  }

  /**
   * Check for a winner on the board
   */
  checkWinner() {
    const lines = [
      // Rows
      [[0, 0], [0, 1], [0, 2]],
      [[1, 0], [1, 1], [1, 2]],
      [[2, 0], [2, 1], [2, 2]],
      // Columns
      [[0, 0], [1, 0], [2, 0]],
      [[0, 1], [1, 1], [2, 1]],
      [[0, 2], [1, 2], [2, 2]],
      // Diagonals
      [[0, 0], [1, 1], [2, 2]],
      [[0, 2], [1, 1], [2, 0]],
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const cellA = this.board[a[0]][a[1]];
      const cellB = this.board[b[0]][b[1]];
      const cellC = this.board[c[0]][c[1]];
      if (cellA && cellA === cellB && cellB === cellC) {
        return cellA;
      }
    }
    return null;
  }

  /**
   * Check if board is full (draw condition)
   */
  isBoardFull() {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (this.board[row][col] === null) return false;
      }
    }
    return true;
  }

  /**
   * Check if this AI tier qualifies for rare currency rewards
   */
  qualifiesForStreakRewards() {
    return ['grid_walker', 'force_adept', 'the_eternal'].includes(this.aiTier);
  }

  toJSON() {
    return {
      matchId: this.matchId,
      playerId: this.playerId,
      opponentType: this.opponentType,
      aiTier: this.aiTier,
      symbolPlayed: this.symbolPlayed,
      board: this.board,
      currentTurn: this.currentTurn,
      status: this.status,
      outcome: this.outcome,
      totalMoves: this.totalMoves,
      durationSeconds: this.durationSeconds,
      impactScoreTotal: this.impactScoreTotal,
      wasSwiftVictory: this.wasSwiftVictory,
      wasForkVictory: this.wasForkVictory,
      wasComeback: this.wasComeback,
      wasPerfectGame: this.wasPerfectGame,
      rewards: this.rewards,
      playedAt: this.playedAt.toISOString(),
    };
  }
}

/**
 * MatchMove - Individual move within a match
 */
class MatchMove {
  constructor(data = {}) {
    this.moveId = data.moveId || null;
    this.matchId = data.matchId || null;
    this.turnNumber = data.turnNumber || 0;
    this.cellRow = data.cellRow || 0;
    this.cellCol = data.cellCol || 0;
    this.symbol = data.symbol || null;
    this.isPlayerMove = data.isPlayerMove !== undefined ? data.isPlayerMove : true;
    this.cellValue = this.calculateCellValue();
    this.moveType = data.moveType || 'normal';
    this.impactScore = data.impactScore || this.cellValue;
    this.timestampMs = data.timestampMs || Date.now();
  }

  // Cell values: center=3, corner=2, edge=1
  calculateCellValue() {
    if (this.cellRow === 1 && this.cellCol === 1) return 3; // Center
    if ((this.cellRow + this.cellCol) % 2 === 0) return 2; // Corners
    return 1; // Edges
  }

  toJSON() {
    return {
      turnNumber: this.turnNumber,
      row: this.cellRow,
      col: this.cellCol,
      symbol: this.symbol,
      isPlayerMove: this.isPlayerMove,
      cellValue: this.cellValue,
      moveType: this.moveType,
      impactScore: this.impactScore,
    };
  }
}

module.exports = { Match, MatchMove };
