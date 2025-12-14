/**
 * Auth Service
 * Handles authentication, registration, token management, and logout with blacklist
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const PlayerRepository = require('../data/PlayerRepository');

class AuthService {
  /**
   * @param {import('pg').Pool} db - Database connection pool
   * @param {import('ioredis').Redis|null} redis - Redis client for token blacklist (optional)
   */
  constructor(db, redis = null) {
    this.playerRepo = new PlayerRepository(db);
    this.redis = redis;
    this.TOKEN_BLACKLIST_PREFIX = 'token_blacklist:';
  }

  /**
   * Register new player
   */
  async register({ username, email, password }) {
    // Validate username
    if (!this._validateUsername(username)) {
      const error = new Error('Username must be 3-32 characters, alphanumeric with underscores');
      error.code = 'INVALID_USERNAME';
      throw error;
    }

    // Validate email
    if (!this._validateEmail(email)) {
      const error = new Error('Invalid email format');
      error.code = 'INVALID_EMAIL';
      throw error;
    }

    // Validate password
    if (!this._validatePassword(password)) {
      const error = new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
      error.code = 'WEAK_PASSWORD';
      throw error;
    }

    // Check for existing username
    const existingUsername = await this.playerRepo.findByUsername(username);
    if (existingUsername) {
      const error = new Error('Username already taken');
      error.code = 'USERNAME_TAKEN';
      throw error;
    }

    // Check for existing email
    const existingEmail = await this.playerRepo.findByEmail(email);
    if (existingEmail) {
      const error = new Error('Email already registered');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create player
    const player = await this.playerRepo.createPlayer({
      username,
      email,
      passwordHash,
      displayName: username,
    });

    // Generate tokens
    const accessToken = this._generateAccessToken(player);
    const refreshToken = this._generateRefreshToken(player);

    return {
      playerId: player.playerId,
      username: player.username,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login existing player
   */
  async login({ email, password }) {
    const player = await this.playerRepo.findByEmail(email);

    if (!player) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Get password hash from database (need raw row)
    const result = await this.playerRepo.query(
      'SELECT password_hash FROM player WHERE player_id = $1',
      [player.playerId]
    );
    const passwordHash = result.rows[0]?.password_hash;

    const validPassword = await bcrypt.compare(password, passwordHash);
    if (!validPassword) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    if (!player.isActive) {
      const error = new Error('Account is disabled');
      error.code = 'ACCOUNT_DISABLED';
      throw error;
    }

    // Update last login
    await this.playerRepo.update(player.playerId, { last_login: new Date() }, 'player_id');

    // Generate tokens
    const accessToken = this._generateAccessToken(player);
    const refreshToken = this._generateRefreshToken(player);

    return {
      playerId: player.playerId,
      username: player.username,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Check if token is blacklisted
      if (await this._isTokenBlacklisted(refreshToken)) {
        const error = new Error('Token has been revoked');
        error.code = 'TOKEN_REVOKED';
        throw error;
      }

      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

      const player = await this.playerRepo.findById(decoded.sub);
      if (!player || !player.isActive) {
        const error = new Error('Invalid refresh token');
        error.code = 'INVALID_TOKEN';
        throw error;
      }

      const accessToken = this._generateAccessToken(player);

      return { accessToken };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        error.code = 'TOKEN_EXPIRED';
      }
      throw error;
    }
  }

  /**
   * Logout - invalidate token by adding to blacklist
   */
  async logout(token) {
    if (!token) {
      return { success: true };
    }

    try {
      // Decode token to get expiration time
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return { success: true };
      }

      // Add to blacklist with TTL matching token expiration
      await this._blacklistToken(token, decoded.exp);

      return { success: true };
    } catch (error) {
      // Logout should not fail even if blacklist fails
      console.error('Error blacklisting token:', error);
      return { success: true };
    }
  }

  /**
   * Verify access token and check blacklist
   */
  async verifyToken(token) {
    // Check if token is blacklisted
    if (await this._isTokenBlacklisted(token)) {
      const error = new Error('Token has been revoked');
      error.code = 'TOKEN_REVOKED';
      throw error;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
      });
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        error.code = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        error.code = 'INVALID_TOKEN';
      }
      throw error;
    }
  }

  // Private helper methods

  _generateAccessToken(player) {
    return jwt.sign(
      {
        sub: player.playerId,
        username: player.username,
        permissions: ['play', 'trade', 'customize'],
      },
      config.jwt.secret,
      {
        algorithm: config.jwt.algorithm,
        expiresIn: config.jwt.accessTokenExpiry,
        issuer: config.jwt.issuer,
      }
    );
  }

  _generateRefreshToken(player) {
    return jwt.sign(
      {
        sub: player.playerId,
        type: 'refresh',
        jti: crypto.randomBytes(16).toString('hex'), // Unique token ID
      },
      config.jwt.refreshSecret,
      {
        expiresIn: config.jwt.refreshTokenExpiry,
      }
    );
  }

  async _blacklistToken(token, expirationTimestamp) {
    if (!this.redis) {
      // If Redis not available, log warning (tokens will remain valid until expiration)
      console.warn('Redis not available - token blacklist disabled');
      return;
    }

    const key = this.TOKEN_BLACKLIST_PREFIX + this._hashToken(token);
    const ttl = Math.max(0, expirationTimestamp - Math.floor(Date.now() / 1000));

    if (ttl > 0) {
      await this.redis.setex(key, ttl, '1');
    }
  }

  async _isTokenBlacklisted(token) {
    if (!this.redis) {
      return false; // If no Redis, cannot check blacklist
    }

    const key = this.TOKEN_BLACKLIST_PREFIX + this._hashToken(token);
    const result = await this.redis.get(key);
    return result !== null;
  }

  _hashToken(token) {
    // Hash the token for storage (don't store raw tokens)
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  _validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,32}$/.test(username);
  }

  _validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  _validatePassword(password) {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }
}

module.exports = AuthService;
