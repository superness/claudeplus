/**
 * Application Entry Point
 * Wires together all services, routes, and middleware with proper dependency injection
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const Redis = require('ioredis');

const config = require('./config');

// Import services
const AuthService = require('./services/AuthService');
const GameService = require('./services/GameService');
const EconomyService = require('./services/EconomyService');

// Import route factories
const createAuthRoutes = require('./api/authRoutes');
const createGameRoutes = require('./api/gameRoutes');
const createEconomyRoutes = require('./api/economyRoutes');
const createProgressionRoutes = require('./api/progressionRoutes');
const createCosmeticRoutes = require('./api/cosmeticRoutes');
const createTradingRoutes = require('./api/tradingRoutes');

/**
 * Creates and configures the Express application
 */
async function createApp() {
  const app = express();

  // Initialize database pool
  const db = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.maxConnections,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  });

  // Test database connection
  try {
    await db.query('SELECT NOW()');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }

  // Initialize Redis for token blacklist (optional)
  let redis = null;
  try {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      lazyConnect: true,
    });
    await redis.connect();
    console.log('Redis connected successfully');
  } catch (err) {
    console.warn('Redis connection failed (token blacklist disabled):', err.message);
    redis = null;
  }

  // Initialize services with dependencies
  const authService = new AuthService(db, redis);
  const gameService = new GameService(db);
  const economyService = new EconomyService(db);

  // Store services on app for access in middleware
  app.set('services', { authService, gameService, economyService });
  app.set('db', db);
  app.set('redis', redis);

  // Security middleware
  app.use(helmet());

  // CORS middleware
  app.use(cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    maxAge: config.cors.maxAge,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (config.server.env === 'development') {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // Health check endpoint
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
      redis: redis ? 'unknown' : 'disabled',
    };

    try {
      await db.query('SELECT 1');
      health.database = 'connected';
    } catch {
      health.database = 'disconnected';
      health.status = 'degraded';
    }

    if (redis) {
      try {
        await redis.ping();
        health.redis = 'connected';
      } catch {
        health.redis = 'disconnected';
      }
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  // Mount API routes with injected services
  app.use('/api/v1/auth', createAuthRoutes(authService));
  app.use('/api/v1/matches', createGameRoutes(gameService, authService));
  app.use('/api/v1/economy', createEconomyRoutes(economyService, authService));
  app.use('/api/v1/progression', createProgressionRoutes(authService));
  app.use('/api/v1/cosmetics', createCosmeticRoutes(authService));
  app.use('/api/v1/trading', createTradingRoutes(economyService, authService));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found`,
      },
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: config.server.env === 'development' ? err.message : 'Internal server error',
      },
    });
  });

  return { app, db, redis };
}

/**
 * Start the server
 */
async function start() {
  try {
    const { app, db, redis } = await createApp();

    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`Cosmic Tic-Tac-Toe API running on http://${config.server.host}:${config.server.port}`);
      console.log(`Environment: ${config.server.env}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down gracefully...`);

      server.close(async () => {
        console.log('HTTP server closed');

        try {
          await db.end();
          console.log('Database pool closed');
        } catch (err) {
          console.error('Error closing database pool:', err);
        }

        if (redis) {
          try {
            await redis.quit();
            console.log('Redis connection closed');
          } catch (err) {
            console.error('Error closing Redis:', err);
          }
        }

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

// Export for testing
module.exports = { createApp, start };

// Start if run directly
if (require.main === module) {
  start();
}
