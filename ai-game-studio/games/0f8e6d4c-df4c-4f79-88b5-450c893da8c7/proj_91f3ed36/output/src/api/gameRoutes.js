/**
 * Game Service API Routes
 * Handles match creation, moves, and game state
 * Uses factory function pattern for dependency injection
 */

const express = require('express');
const createAuthMiddleware = require('./middleware/auth');

/**
 * Create game routes with injected services
 * @param {import('../services/GameService')} gameService - Instantiated game service
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createGameRoutes(gameService, authService) {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * POST /matches
   * Start a new match
   */
  router.post('/', async (req, res) => {
    try {
      const { opponentType, aiTier, symbolChoice } = req.body;
      const playerId = req.user.playerId;

      // Validate AI tier
      const validTiers = ['void_novice', 'echoing_acolyte', 'grid_walker', 'force_adept', 'the_eternal'];
      if (opponentType === 'ai' && !validTiers.includes(aiTier)) {
        return res.status(400).json({
          error: { code: 'INVALID_AI_TIER', message: `Invalid AI tier. Must be one of: ${validTiers.join(', ')}` },
        });
      }

      // Validate symbol choice
      if (!['o', 'x'].includes(symbolChoice)) {
        return res.status(400).json({
          error: { code: 'INVALID_SYMBOL', message: 'Symbol must be "o" or "x"' },
        });
      }

      const match = await gameService.createMatch({
        playerId,
        opponentType: opponentType || 'ai',
        aiTier,
        symbolChoice,
      });

      res.status(201).json(match.toJSON());
    } catch (error) {
      if (error.code === 'ACTIVE_MATCH_EXISTS') {
        return res.status(409).json({ error: { code: 'ACTIVE_MATCH_EXISTS', message: error.message } });
      }
      console.error('Create match error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create match' } });
    }
  });

  // IMPORTANT: Static routes MUST come BEFORE parameterized routes
  // Otherwise '/matches/active' would match '/:matchId' with matchId='active'

  /**
   * GET /matches/active
   * Get player's current active match
   */
  router.get('/active', async (req, res) => {
    try {
      const playerId = req.user.playerId;
      const match = await gameService.getActiveMatch(playerId);

      if (!match) {
        return res.status(204).send();
      }

      res.json({ match: match.toJSON() });
    } catch (error) {
      console.error('Get active match error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get active match' } });
    }
  });

  /**
   * GET /matches/history
   * Get player's match history with pagination
   */
  router.get('/history', async (req, res) => {
    try {
      const playerId = req.user.playerId;
      const { limit = 20, offset = 0, outcome, symbol, aiTier } = req.query;

      const result = await gameService.getMatchHistory({
        playerId,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
        filters: { outcome, symbol, aiTier },
      });

      res.json({
        matches: result.matches.map(m => m.toJSON()),
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.total > parseInt(offset) + result.matches.length,
        },
      });
    } catch (error) {
      console.error('Get match history error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get match history' } });
    }
  });

  // Parameterized routes come AFTER static routes

  /**
   * GET /matches/:matchId
   * Get match state and history
   */
  router.get('/:matchId', async (req, res) => {
    try {
      const { matchId } = req.params;
      const match = await gameService.getMatch(matchId);

      if (!match) {
        return res.status(404).json({ error: { code: 'MATCH_NOT_FOUND', message: 'Match not found' } });
      }

      res.json(match.toJSON());
    } catch (error) {
      console.error('Get match error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get match' } });
    }
  });

  /**
   * POST /matches/:matchId/moves
   * Execute a move in active match
   */
  router.post('/:matchId/moves', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { row, col } = req.body;
      const playerId = req.user.playerId;

      // Validate cell position
      if (row === undefined || col === undefined || row < 0 || row > 2 || col < 0 || col > 2) {
        return res.status(400).json({
          error: { code: 'INVALID_CELL', message: 'Row and col must be between 0 and 2' },
        });
      }

      const result = await gameService.makeMove({
        matchId,
        playerId,
        row,
        col,
      });

      res.json(result);
    } catch (error) {
      if (error.code === 'MATCH_NOT_FOUND') {
        return res.status(404).json({ error: { code: 'MATCH_NOT_FOUND', message: 'Match not found' } });
      }
      if (error.code === 'CELL_OCCUPIED') {
        return res.status(400).json({ error: { code: 'CELL_OCCUPIED', message: 'Cell already occupied' } });
      }
      if (error.code === 'NOT_YOUR_TURN') {
        return res.status(400).json({ error: { code: 'NOT_YOUR_TURN', message: 'Not your turn' } });
      }
      if (error.code === 'MATCH_ENDED') {
        return res.status(410).json({ error: { code: 'MATCH_ENDED', message: 'Match already completed' } });
      }
      if (error.code === 'UNAUTHORIZED') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: error.message } });
      }
      console.error('Make move error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to execute move' } });
    }
  });

  return router;
}

module.exports = createGameRoutes;
