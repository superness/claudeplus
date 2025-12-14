/**
 * Cosmetic Service API Routes
 * Handles items, inventory, loadouts, and shop
 * Uses factory function pattern for dependency injection
 */

const express = require('express');
const createAuthMiddleware = require('./middleware/auth');

/**
 * Create cosmetic routes with injected services
 * Note: CosmeticService is not yet implemented - routes use placeholder stubs
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createCosmeticRoutes(authService) {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Apply auth middleware to all routes
  router.use(authMiddleware);

  /**
   * GET /cosmetics
   * Get available cosmetic items
   */
  router.get('/', async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;

      // Stub: CosmeticService not yet implemented
      res.json({
        items: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      console.error('Get cosmetics error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get cosmetics' } });
    }
  });

  /**
   * GET /players/:playerId/inventory
   * Get player's owned cosmetic items
   */
  router.get('/players/:playerId/inventory', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: CosmeticService not yet implemented
      res.json({
        inventory: [],
        collectionStats: {
          totalOwned: 0,
          totalAvailable: 0,
          completionPercent: 0,
        },
      });
    } catch (error) {
      console.error('Get inventory error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get inventory' } });
    }
  });

  /**
   * POST /cosmetics/:itemId/purchase
   * Purchase a cosmetic item
   */
  router.post('/:itemId/purchase', async (req, res) => {
    try {
      const { itemId } = req.params;

      // Stub: CosmeticService not yet implemented
      res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Purchase not yet implemented' } });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: { code: 'INSUFFICIENT_FUNDS', message: error.message } });
      }
      if (error.code === 'ALREADY_OWNED') {
        return res.status(400).json({ error: { code: 'ALREADY_OWNED', message: 'Item already in inventory' } });
      }
      if (error.code === 'REQUIREMENTS_NOT_MET') {
        return res.status(400).json({ error: { code: 'REQUIREMENTS_NOT_MET', message: 'Unlock requirements not satisfied' } });
      }
      if (error.code === 'ITEM_UNAVAILABLE') {
        return res.status(400).json({ error: { code: 'ITEM_UNAVAILABLE', message: 'Limited item not available' } });
      }
      console.error('Purchase error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Purchase failed' } });
    }
  });

  /**
   * GET /players/:playerId/loadout
   * Get player's equipped cosmetics
   */
  router.get('/players/:playerId/loadout', async (req, res) => {
    try {
      const { playerId } = req.params;

      // Stub: CosmeticService not yet implemented
      res.json({
        loadout: {
          boardTheme: null,
          symbolX: null,
          symbolO: null,
          winEffect: null,
          taunt: null,
          title: null,
          avatar: null,
        },
      });
    } catch (error) {
      console.error('Get loadout error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get loadout' } });
    }
  });

  /**
   * PUT /players/:playerId/loadout
   * Update player's equipped loadout
   */
  router.put('/players/:playerId/loadout', async (req, res) => {
    try {
      const { playerId } = req.params;

      if (playerId !== req.user.playerId) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot modify other player loadout' } });
      }

      // Stub: CosmeticService not yet implemented
      res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Loadout update not yet implemented' } });
    } catch (error) {
      if (error.code === 'ITEM_NOT_OWNED') {
        return res.status(400).json({ error: { code: 'ITEM_NOT_OWNED', message: 'Cannot equip unowned item' } });
      }
      console.error('Update loadout error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update loadout' } });
    }
  });

  /**
   * GET /shop/daily
   * Get today's shop rotation
   */
  router.get('/shop/daily', async (req, res) => {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Stub: CosmeticService not yet implemented
      res.json({
        rotationDate: now.toISOString().split('T')[0],
        refreshesAt: tomorrow.toISOString(),
        slots: [],
      });
    } catch (error) {
      console.error('Get daily shop error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get shop' } });
    }
  });

  return router;
}

module.exports = createCosmeticRoutes;
