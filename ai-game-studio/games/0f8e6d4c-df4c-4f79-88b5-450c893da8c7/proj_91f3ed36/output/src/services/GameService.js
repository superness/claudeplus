/**
 * Game Service
 * Handles match creation, moves, and game logic
 */

const { Match, MatchMove } = require('../models/Match');
const MatchRepository = require('../data/MatchRepository');
const PlayerRepository = require('../data/PlayerRepository');
const config = require('../config');

class GameService {
  constructor(db) {
    this.matchRepo = new MatchRepository(db);
    this.playerRepo = new PlayerRepository(db);
  }

  /**
   * Create a new match
   */
  async createMatch({ playerId, opponentType, aiTier, symbolChoice }) {
    // Check for existing active match
    const activeMatch = await this.matchRepo.findActiveMatch(playerId);
    if (activeMatch) {
      const error = new Error('Player already has an active match');
      error.code = 'ACTIVE_MATCH_EXISTS';
      throw error;
    }

    // Get player streak for context
    const streak = await this.playerRepo.getStreak(playerId);

    // Create match
    const match = await this.matchRepo.createMatch({
      playerId,
      opponentType,
      aiTier,
      symbolPlayed: symbolChoice,
      streakCountAtStart: streak?.current_win_streak || 0,
    });

    // Initialize game state
    match.board = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    match.currentTurn = 'player';
    match.status = 'in_progress';

    return match;
  }

  /**
   * Execute a move in a match
   */
  async makeMove({ matchId, playerId, row, col }) {
    const match = await this.matchRepo.findById(matchId);

    if (!match) {
      const error = new Error('Match not found');
      error.code = 'MATCH_NOT_FOUND';
      throw error;
    }

    if (match.playerId !== playerId) {
      const error = new Error('Not your match');
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    if (match.status !== 'in_progress') {
      const error = new Error('Match already completed');
      error.code = 'MATCH_ENDED';
      throw error;
    }

    // Reconstruct board from moves
    const board = this._reconstructBoard(match.moves);

    if (board[row][col] !== null) {
      const error = new Error('Cell already occupied');
      error.code = 'CELL_OCCUPIED';
      throw error;
    }

    // Make player move
    const playerSymbol = match.symbolPlayed;
    board[row][col] = playerSymbol;

    const playerMove = await this.matchRepo.addMove({
      matchId,
      turnNumber: match.moves.length + 1,
      cellRow: row,
      cellCol: col,
      symbol: playerSymbol,
      isPlayerMove: true,
      cellValue: this._getCellValue(row, col),
      moveType: this._classifyMove(board, row, col, playerSymbol),
    });

    // Check for game end
    const winner = this._checkWinner(board);
    if (winner || this._isBoardFull(board)) {
      return this._handleGameEnd(match, board, winner);
    }

    // AI makes a move
    const aiSymbol = playerSymbol === 'o' ? 'x' : 'o';
    const aiMove = this._calculateAIMove(board, match.aiTier, aiSymbol);

    board[aiMove.row][aiMove.col] = aiSymbol;

    const aiMoveRecord = await this.matchRepo.addMove({
      matchId,
      turnNumber: match.moves.length + 2,
      cellRow: aiMove.row,
      cellCol: aiMove.col,
      symbol: aiSymbol,
      isPlayerMove: false,
      cellValue: this._getCellValue(aiMove.row, aiMove.col),
      moveType: aiMove.type,
    });

    // Check for game end after AI move
    const winnerAfterAI = this._checkWinner(board);
    if (winnerAfterAI || this._isBoardFull(board)) {
      return this._handleGameEnd(match, board, winnerAfterAI);
    }

    return {
      matchId: match.matchId,
      move: playerMove.toJSON(),
      board,
      aiResponse: aiMoveRecord.toJSON(),
      boardAfterAI: board,
      currentTurn: 'player',
      status: 'in_progress',
    };
  }

  /**
   * Get match by ID
   */
  async getMatch(matchId) {
    return this.matchRepo.findById(matchId);
  }

  /**
   * Get player's active match
   */
  async getActiveMatch(playerId) {
    return this.matchRepo.findActiveMatch(playerId);
  }

  /**
   * Get player's match history
   */
  async getMatchHistory({ playerId, limit, offset, filters }) {
    const matches = await this.matchRepo.getMatchHistory(playerId, { limit, offset, filters });
    const total = await this.matchRepo.countMatches(playerId, filters);
    return { matches, total };
  }

  // Private helper methods

  _reconstructBoard(moves) {
    const board = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    for (const move of moves) {
      board[move.cellRow][move.cellCol] = move.symbol;
    }
    return board;
  }

  _getCellValue(row, col) {
    if (row === 1 && col === 1) return 3; // Center
    if ((row + col) % 2 === 0) return 2; // Corners
    return 1; // Edges
  }

  _classifyMove(board, row, col, symbol) {
    const moveNumber = board.flat().filter(c => c !== null).length;
    if (moveNumber === 1) return 'opening';

    // Check if this is a winning move
    if (this._checkWinner(board) === symbol) return 'winning';

    // Check if this blocks opponent
    const oppSymbol = symbol === 'o' ? 'x' : 'o';
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = oppSymbol;
    if (this._checkWinner(testBoard) === oppSymbol) return 'block';

    return 'normal';
  }

  _checkWinner(board) {
    const lines = [
      [[0, 0], [0, 1], [0, 2]],
      [[1, 0], [1, 1], [1, 2]],
      [[2, 0], [2, 1], [2, 2]],
      [[0, 0], [1, 0], [2, 0]],
      [[0, 1], [1, 1], [2, 1]],
      [[0, 2], [1, 2], [2, 2]],
      [[0, 0], [1, 1], [2, 2]],
      [[0, 2], [1, 1], [2, 0]],
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const cellA = board[a[0]][a[1]];
      const cellB = board[b[0]][b[1]];
      const cellC = board[c[0]][c[1]];
      if (cellA && cellA === cellB && cellB === cellC) {
        return cellA;
      }
    }
    return null;
  }

  _isBoardFull(board) {
    return board.flat().every(cell => cell !== null);
  }

  _calculateAIMove(board, aiTier, aiSymbol) {
    const emptyCells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[r][c] === null) {
          emptyCells.push({ row: r, col: c });
        }
      }
    }

    // AI difficulty based on tier
    const skillLevel = {
      void_novice: 0.1,
      echoing_acolyte: 0.3,
      grid_walker: 0.5,
      force_adept: 0.8,
      the_eternal: 1.0,
    }[aiTier] || 0.5;

    // Check for winning move
    for (const cell of emptyCells) {
      const testBoard = board.map(r => [...r]);
      testBoard[cell.row][cell.col] = aiSymbol;
      if (this._checkWinner(testBoard) === aiSymbol) {
        return { ...cell, type: 'winning' };
      }
    }

    // Check for blocking move (based on skill level)
    if (Math.random() < skillLevel) {
      const oppSymbol = aiSymbol === 'o' ? 'x' : 'o';
      for (const cell of emptyCells) {
        const testBoard = board.map(r => [...r]);
        testBoard[cell.row][cell.col] = oppSymbol;
        if (this._checkWinner(testBoard) === oppSymbol) {
          return { ...cell, type: 'block' };
        }
      }
    }

    // Strategic move (center/corner preference based on skill)
    if (Math.random() < skillLevel) {
      if (board[1][1] === null) return { row: 1, col: 1, type: 'strategic' };
      const corners = [[0, 0], [0, 2], [2, 0], [2, 2]].filter(
        ([r, c]) => board[r][c] === null
      );
      if (corners.length > 0) {
        const [r, c] = corners[Math.floor(Math.random() * corners.length)];
        return { row: r, col: c, type: 'strategic' };
      }
    }

    // Random move
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    return { ...randomCell, type: 'normal' };
  }

  async _handleGameEnd(match, board, winner) {
    const outcome = !winner
      ? 'draw'
      : winner === match.symbolPlayed
      ? 'win'
      : 'loss';

    // Calculate rewards
    const rewards = this._calculateRewards(match, outcome);

    // Update match record
    await this.matchRepo.updateMatch(match.matchId, {
      outcome,
      totalMoves: match.moves.length,
      essenceEarned: rewards.cosmicEssence,
      orbsEarned: rewards.starlightOrbs,
      shardsEarned: rewards.shadowShards,
      voidFragsEarned: rewards.voidFragments,
      alignCrystalsEarned: rewards.alignmentCrystals,
      primSparksEarned: rewards.primordialSparks,
    });

    // Update player stats
    await this._updatePlayerStats(match.playerId, outcome, match);

    return {
      matchId: match.matchId,
      board,
      status: 'completed',
      outcome,
      rewards,
    };
  }

  _calculateRewards(match, outcome) {
    // Use config for reward multipliers instead of Match static property
    const multiplier = config.game.rewardMultipliers[match.aiTier] || 1.0;

    const baseRewards = {
      win: { cosmicEssence: 100, starlightOrbs: 20 },
      draw: { cosmicEssence: 50, starlightOrbs: 10 },
      loss: { cosmicEssence: 25, starlightOrbs: 5 },
    }[outcome];

    const rewards = {
      cosmicEssence: Math.floor(baseRewards.cosmicEssence * multiplier),
      starlightOrbs: match.symbolPlayed === 'o' ? Math.floor(baseRewards.starlightOrbs * multiplier) : 0,
      shadowShards: match.symbolPlayed === 'x' ? Math.floor(baseRewards.starlightOrbs * multiplier) : 0,
      voidFragments: 0,
      alignmentCrystals: 0,
      primordialSparks: 0,
    };

    // CRITICAL FIX: Streak rewards are ONLY granted for Grid Walker+ AI tiers
    // This prevents the "Streak Shield Farm" exploit where players farm rare currencies
    // with easy AI opponents while protected by streak shields
    const streakRewards = this._calculateStreakRewards(match, outcome);

    // Only apply rare currency streak rewards if AI tier is Grid Walker or higher
    const eligibleForRareRewards = ['grid_walker', 'force_adept', 'the_eternal'].includes(match.aiTier);

    if (eligibleForRareRewards) {
      rewards.voidFragments = streakRewards.voidFragments;
      rewards.alignmentCrystals = streakRewards.alignmentCrystals;
      rewards.primordialSparks = streakRewards.primordialSparks;
    }

    // Basic streak bonus (cosmic essence) is always granted
    rewards.cosmicEssence += streakRewards.bonusEssence;

    return rewards;
  }

  /**
   * Calculate streak-based rewards
   * Rare currencies (VF, AC, PS) require Grid Walker+ AI per balance audit
   */
  _calculateStreakRewards(match, outcome) {
    const streakCount = match.streakCountAtStart || 0;

    const rewards = {
      voidFragments: 0,
      alignmentCrystals: 0,
      primordialSparks: 0,
      bonusEssence: 0,
    };

    if (outcome !== 'win') {
      return rewards;
    }

    // Streak milestones with rewards
    // 3-win: bonus essence
    // 5-win: void fragments
    // 10-win: alignment crystals + void fragments
    // 15-win: primordial spark + alignment crystals
    // 20-win: major primordial spark bonus

    const currentStreak = streakCount + 1; // This win continues the streak

    if (currentStreak >= 3) {
      rewards.bonusEssence = 50;
    }
    if (currentStreak >= 5 && currentStreak < 10) {
      rewards.voidFragments = 3;
    }
    if (currentStreak >= 10 && currentStreak < 15) {
      rewards.voidFragments = 5;
      rewards.alignmentCrystals = 1;
    }
    if (currentStreak >= 15 && currentStreak < 20) {
      rewards.voidFragments = 7;
      rewards.alignmentCrystals = 2;
      rewards.primordialSparks = 1;
    }
    if (currentStreak >= 20) {
      rewards.voidFragments = 10;
      rewards.alignmentCrystals = 3;
      rewards.primordialSparks = 2;
    }

    return rewards;
  }

  async _updatePlayerStats(playerId, outcome, match) {
    const progress = await this.playerRepo.getProgress(playerId);
    const updates = {
      totalMatches: progress.totalMatches + 1,
    };

    if (outcome === 'win') {
      updates.totalWins = progress.totalWins + 1;
      if (match.symbolPlayed === 'o') updates.winsAsO = progress.winsAsO + 1;
      if (match.symbolPlayed === 'x') updates.winsAsX = progress.winsAsX + 1;
    } else if (outcome === 'draw') {
      updates.totalDraws = progress.totalDraws + 1;
    } else {
      updates.totalLosses = progress.totalLosses + 1;
    }

    await this.playerRepo.updateProgress(playerId, updates);

    // Update streak data
    await this._updateStreak(playerId, outcome, match);
  }

  /**
   * Update player streak data based on match outcome
   */
  async _updateStreak(playerId, outcome, match) {
    const streak = await this.playerRepo.getStreak(playerId);
    const currentWinStreak = streak?.current_win_streak || 0;
    const bestWinStreak = streak?.best_win_streak || 0;
    const currentDrawStreak = streak?.current_draw_streak || 0;
    const bestDrawStreak = streak?.best_draw_streak || 0;
    const streakProtected = streak?.streak_protected || false;

    let streakUpdate = {
      lastMatchOutcome: outcome,
      lastMatchAt: new Date(),
    };

    if (outcome === 'win') {
      // Win: increment win streak, reset draw streak
      const newWinStreak = currentWinStreak + 1;
      streakUpdate.currentWinStreak = newWinStreak;
      streakUpdate.bestWinStreak = Math.max(bestWinStreak, newWinStreak);
      streakUpdate.currentDrawStreak = 0;
    } else if (outcome === 'draw') {
      // Draw: reset win streak, increment draw streak (for The Eternal achievement)
      streakUpdate.currentWinStreak = 0;
      if (match.aiTier === 'the_eternal') {
        const newDrawStreak = currentDrawStreak + 1;
        streakUpdate.currentDrawStreak = newDrawStreak;
        streakUpdate.bestDrawStreak = Math.max(bestDrawStreak, newDrawStreak);
      }
    } else {
      // Loss: reset win streak unless protected by streak shield
      if (streakProtected) {
        // Consume streak shield, keep streak
        streakUpdate.streakProtected = false;
      } else {
        // Reset win streak
        streakUpdate.currentWinStreak = 0;
      }
      streakUpdate.currentDrawStreak = 0;
    }

    await this.playerRepo.updateStreak(playerId, streakUpdate);
  }
}

module.exports = GameService;
