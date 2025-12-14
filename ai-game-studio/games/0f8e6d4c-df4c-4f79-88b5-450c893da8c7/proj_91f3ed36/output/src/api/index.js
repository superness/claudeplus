/**
 * API Routes Index
 * Central router configuration for all API endpoints
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const gameRoutes = require('./gameRoutes');
const economyRoutes = require('./economyRoutes');
const progressionRoutes = require('./progressionRoutes');
const cosmeticRoutes = require('./cosmeticRoutes');
const tradingRoutes = require('./tradingRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/matches', gameRoutes);
router.use('/economy', economyRoutes);
router.use('/progression', progressionRoutes);
router.use('/cosmetics', cosmeticRoutes);
router.use('/trading', tradingRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cosmic-tictactoe-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
