/**
 * Economy Service API Routes
 * Handles wallet, transactions, and currency conversion
 * Uses factory function pattern for dependency injection
 */

const express = require('express');
const createAuthMiddleware = require('./middleware/auth');

/**
 * Create economy routes with injected services
 * @param {import('../services/EconomyService')} economyService - Instantiated economy service
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createEconomyRoutes(economyService, authService) {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * GET /players/:playerId/wallet
   * Get player's currency balances
   */
  router.get('/players/:playerId/wallet', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Ensure player can only access their own wallet
      if (playerId !== req.user.playerId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot access other player wallets' } });
      }

      const wallet = await economyService.getWallet(playerId);
      res.json(wallet.toJSON());
    } catch (error) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
      }
      console.error('Get wallet error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get wallet' } });
    }
  });

  /**
   * GET /players/:playerId/transactions
   * Get wallet transaction history
   */
  router.get('/players/:playerId/transactions', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { limit = 50, offset = 0, type, currency } = req.query;

      if (playerId !== req.user.playerId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot access other player transactions' } });
      }

      const result = await economyService.getTransactions({
        playerId,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
        filters: { type, currency },
      });

      res.json({
        transactions: result.transactions,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.total > parseInt(offset) + result.transactions.length,
        },
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get transactions' } });
    }
  });

  /**
   * POST /currency/convert
   * Convert currencies (intentionally inefficient rate)
   */
  router.post('/currency/convert', async (req, res) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;
      const playerId = req.user.playerId;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'fromCurrency, toCurrency, and amount required' },
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' },
        });
      }

      const result = await economyService.convertCurrency({
        playerId,
        fromCurrency,
        toCurrency,
        amount,
      });

      res.json({
        conversion: {
          fromCurrency,
          fromAmount: amount,
          toCurrency,
          toAmount: result.toAmount,
          rate: result.rate,
        },
        walletAfter: result.walletAfter,
      });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: { code: 'INSUFFICIENT_FUNDS', message: error.message } });
      }
      if (error.code === 'INVALID_CONVERSION') {
        return res.status(400).json({ error: { code: 'INVALID_CONVERSION', message: 'Invalid currency conversion pair' } });
      }
      console.error('Currency conversion error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Conversion failed' } });
    }
  });

  return router;
}

module.exports = createEconomyRoutes;
