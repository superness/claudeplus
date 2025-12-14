/**
 * Application Configuration
 * Central configuration management
 */

const path = require('path');

const config = {
  // Server settings
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
  },

  // Database settings
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'cosmic_tictactoe',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
    ssl: process.env.DB_SSL === 'true',
  },

  // Redis cache settings
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // JWT authentication settings (HS256 symmetric key algorithm)
  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      return 'dev-secret-do-not-use-in-production-min-32-chars';
    })(),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_REFRESH_SECRET environment variable is required in production');
      }
      return 'dev-refresh-secret-do-not-use-in-production';
    })(),
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'cosmictictactoe.com',
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '30d',
  },

  // Rate limiting
  rateLimit: {
    auth: { windowMs: 60000, max: 10 },
    matchActions: { windowMs: 60000, max: 60 },
    readOps: { windowMs: 60000, max: 120 },
    writeOps: { windowMs: 60000, max: 30 },
  },

  // Game settings
  game: {
    aiTiers: ['void_novice', 'echoing_acolyte', 'grid_walker', 'force_adept', 'the_eternal'],
    rewardMultipliers: {
      void_novice: 0.5,
      echoing_acolyte: 0.75,
      grid_walker: 1.0,
      force_adept: 1.5,
      the_eternal: 2.0,
    },
    baseRewards: {
      win: { cosmicEssence: 100, factionCurrency: 20 },
      draw: { cosmicEssence: 50, factionCurrency: 10 },
      loss: { cosmicEssence: 25, factionCurrency: 5 },
    },
  },

  // Currency settings
  currency: {
    caps: {
      voidFragments: 200,
      alignmentCrystals: 50,
      primordialSparks: 10,
    },
    conversionRates: {
      'cosmic_essence:starlight_orbs': 50,
      'cosmic_essence:shadow_shards': 50,
      'starlight_orbs:cosmic_essence': 1 / 25,
      'shadow_shards:cosmic_essence': 1 / 25,
    },
  },

  // Trading settings
  trading: {
    minMatchesToUnlock: 50,
    dailyTradeLimit: 5,
    minTradeAmount: 5,
    maxTradeAmount: 50,
    taxRate: 0.10,
    tradeableCurrencies: ['starlight_orbs', 'shadow_shards'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://cosmictictactoe.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  },
};

module.exports = config;
