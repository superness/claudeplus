/**
 * Auth Service API Routes
 * Handles authentication, registration, and session management
 * Uses factory function pattern for dependency injection
 */

const express = require('express');

/**
 * Create auth routes with injected AuthService
 * @param {import('../services/AuthService')} authService - Instantiated auth service
 * @returns {express.Router}
 */
function createAuthRoutes(authService) {
  const router = express.Router();

  /**
   * POST /auth/register
   * Create new player account
   */
  router.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing required fields: username, email, password',
          },
        });
      }

      const result = await authService.register({ username, email, password });

      res.status(201).json({
        playerId: result.playerId,
        username: result.username,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: 3600,
      });
    } catch (error) {
      if (error.code === 'USERNAME_TAKEN') {
        return res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: error.message } });
      }
      if (error.code === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: error.message } });
      }
      if (error.code === 'WEAK_PASSWORD') {
        return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: error.message } });
      }
      if (error.code === 'INVALID_USERNAME') {
        return res.status(400).json({ error: { code: 'INVALID_USERNAME', message: error.message } });
      }
      if (error.code === 'INVALID_EMAIL') {
        return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: error.message } });
      }
      console.error('Registration error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
    }
  });

  /**
   * POST /auth/login
   * Authenticate existing player
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Email and password required' },
        });
      }

      const result = await authService.login({ email, password });

      res.json({
        playerId: result.playerId,
        username: result.username,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: 3600,
      });
    } catch (error) {
      if (error.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      }
      if (error.code === 'ACCOUNT_DISABLED') {
        return res.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: error.message } });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
    }
  });

  /**
   * POST /auth/refresh
   * Obtain new access token using refresh token
   */
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Refresh token required' },
        });
      }

      const result = await authService.refreshToken(refreshToken);

      res.json({
        accessToken: result.accessToken,
        expiresIn: 3600,
      });
    } catch (error) {
      if (error.code === 'TOKEN_EXPIRED') {
        return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired' } });
      }
      if (error.code === 'TOKEN_REVOKED') {
        return res.status(401).json({ error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' } });
      }
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
    }
  });

  /**
   * POST /auth/logout
   * Invalidate current session
   */
  router.post('/logout', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await authService.logout(token);
      }
      res.json({ message: 'Successfully logged out' });
    } catch (error) {
      // Logout should always succeed from client perspective
      res.json({ message: 'Successfully logged out' });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
