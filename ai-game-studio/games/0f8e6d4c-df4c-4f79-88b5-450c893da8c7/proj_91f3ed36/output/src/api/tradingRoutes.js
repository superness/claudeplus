/**
 * Trading Service API Routes
 * Handles player-to-player trades
 * Uses factory function pattern for dependency injection
 */

const express = require('express');
const createAuthMiddleware = require('./middleware/auth');
const config = require('../config');

/**
 * Create trading routes with injected services
 * @param {import('../services/TradingService')} tradingService - Instantiated trading service
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createTradingRoutes(tradingService, authService) {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * GET /trading/status
   * Check if trading is available for player
   */
  router.get('/status', async (req, res) => {
    try {
      const playerId = req.user.playerId;
      const status = await tradingService.getTradingStatus(playerId);
      res.json(status);
    } catch (error) {
      console.error('Get trading status error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get trading status' } });
    }
  });

  /**
   * POST /trades
   * Create a trade offer to another player
   */
  router.post('/', async (req, res) => {
    try {
      const playerId = req.user.playerId;
      const { receiverUsername, resourceType, amount } = req.body;

      // Validate required fields
      if (!receiverUsername || !resourceType || amount === undefined) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Missing required fields: receiverUsername, resourceType, amount' },
        });
      }

      const result = await tradingService.executeTrade({
        senderId: playerId,
        receiverUsername,
        resourceType,
        amount: parseInt(amount, 10),
      });

      res.status(201).json(result);
    } catch (error) {
      if (error.code === 'INVALID_AMOUNT') {
        return res.status(400).json({ error: { code: 'INVALID_AMOUNT', message: error.message } });
      }
      if (error.code === 'INVALID_RESOURCE') {
        return res.status(400).json({ error: { code: 'INVALID_RESOURCE', message: error.message } });
      }
      if (error.code === 'TRADING_LOCKED') {
        return res.status(400).json({ error: { code: 'TRADING_LOCKED', message: error.message } });
      }
      if (error.code === 'DAILY_LIMIT_REACHED') {
        return res.status(400).json({ error: { code: 'DAILY_LIMIT_REACHED', message: error.message } });
      }
      if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: { code: 'INSUFFICIENT_FUNDS', message: error.message } });
      }
      if (error.code === 'SELF_TRADE') {
        return res.status(400).json({ error: { code: 'SELF_TRADE', message: error.message } });
      }
      if (error.code === 'RECEIVER_NOT_FOUND') {
        return res.status(404).json({ error: { code: 'RECEIVER_NOT_FOUND', message: error.message } });
      }
      console.error('Trade error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Trade failed' } });
    }
  });

  /**
   * GET /trades/history
   * Get player's trade history
   */
  router.get('/history', async (req, res) => {
    try {
      const playerId = req.user.playerId;
      const { limit = 20, offset = 0 } = req.query;

      const result = await tradingService.getTradeHistory(playerId, {
        limit: Math.min(parseInt(limit, 10), 100),
        offset: parseInt(offset, 10),
      });

      res.json(result);
    } catch (error) {
      console.error('Get trade history error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get trade history' } });
    }
  });

  return router;
}

module.exports = createTradingRoutes;
