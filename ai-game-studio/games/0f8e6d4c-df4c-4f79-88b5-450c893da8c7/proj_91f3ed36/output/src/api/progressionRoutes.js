/**
 * Progression Service API Routes
 * Handles levels, skills, and achievements
 * Uses factory function pattern for dependency injection
 */

const express = require('express');
const createAuthMiddleware = require('./middleware/auth');

/**
 * Create progression routes with injected services
 * Note: ProgressionService is not yet implemented - routes use placeholder stubs
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createProgressionRoutes(authService) {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * GET /players/:playerId/progress
   * Get player's progression state
   */
  router.get('/players/:playerId/progress', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: ProgressionService not yet implemented
      res.json({
        playerId,
        level: 1,
        xp: 0,
        xpToNextLevel: 1000,
        totalMatches: 0,
        totalWins: 0,
        totalDraws: 0,
        totalLosses: 0,
      });
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get progress' } });
    }
  });

  /**
   * GET /players/:playerId/skills
   * Get player's skill tree progress
   */
  router.get('/players/:playerId/skills', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: ProgressionService not yet implemented
      res.json({
        playerId,
        trees: {
          opening: { nodesUnlocked: [], progress: 0 },
          midgame: { nodesUnlocked: [], progress: 0 },
          endgame: { nodesUnlocked: [], progress: 0 },
        },
        awakenedPath: null,
      });
    } catch (error) {
      console.error('Get skills error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get skills' } });
    }
  });

  /**
   * POST /players/:playerId/skills/:nodeId/unlock
   * Unlock a skill tree node
   */
  router.post('/players/:playerId/skills/:nodeId/unlock', async (req, res) => {
    try {
      const { playerId, nodeId } = req.params;

      if (playerId !== req.user.playerId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot unlock skills for other players' } });
      }

      // Stub: ProgressionService not yet implemented
      res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Skill unlock not yet implemented' } });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_CURRENCY') {
        return res.status(400).json({ error: { code: 'INSUFFICIENT_CURRENCY', message: error.message } });
      }
      if (error.code === 'PREREQUISITE_NOT_MET') {
        return res.status(400).json({ error: { code: 'PREREQUISITE_NOT_MET', message: 'Required node not unlocked' } });
      }
      if (error.code === 'ALREADY_UNLOCKED') {
        return res.status(400).json({ error: { code: 'ALREADY_UNLOCKED', message: 'Node already owned' } });
      }
      console.error('Unlock skill error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unlock skill' } });
    }
  });

  /**
   * GET /players/:playerId/achievements
   * Get player's achievement progress
   */
  router.get('/players/:playerId/achievements', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: ProgressionService not yet implemented
      res.json({
        achievements: [],
        summary: {
          total: 0,
          completed: 0,
          claimed: 0,
          completionPercent: 0,
        },
      });
    } catch (error) {
      console.error('Get achievements error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get achievements' } });
    }
  });

  /**
   * POST /players/:playerId/achievements/:achieveId/claim
   * Claim rewards for completed achievement
   */
  router.post('/players/:playerId/achievements/:achieveId/claim', async (req, res) => {
    try {
      const { playerId, achieveId } = req.params;

      if (playerId !== req.user.playerId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot claim rewards for other players' } });
      }

      // Stub: ProgressionService not yet implemented
      res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Achievement claim not yet implemented' } });
    } catch (error) {
      if (error.code === 'NOT_COMPLETE') {
        return res.status(400).json({ error: { code: 'NOT_COMPLETE', message: 'Achievement not completed' } });
      }
      if (error.code === 'ALREADY_CLAIMED') {
        return res.status(400).json({ error: { code: 'ALREADY_CLAIMED', message: 'Rewards already claimed' } });
      }
      console.error('Claim achievement error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to claim reward' } });
    }
  });

  /**
   * GET /players/:playerId/streak
   * Get player's current streak status
   */
  router.get('/players/:playerId/streak', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: ProgressionService not yet implemented
      res.json({
        playerId,
        currentWinStreak: 0,
        maxWinStreak: 0,
        currentSessionStreak: 0,
        lastMatchResult: null,
        streakBonusMultiplier: 1.0,
      });
    } catch (error) {
      console.error('Get streak error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get streak' } });
    }
  });

  return router;
}

module.exports = createProgressionRoutes;
