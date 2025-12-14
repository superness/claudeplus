/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 * Uses factory pattern for AuthService injection
 */

/**
 * Create auth middleware with injected AuthService
 * @param {import('../../services/AuthService')} authService - Instantiated auth service
 * @returns {Function} Express middleware function
 */
function createAuthMiddleware(authService) {
  return async function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        });
      }

      const token = authHeader.substring(7);

      try {
        // Use AuthService.verifyToken which handles blacklist checking
        const decoded = await authService.verifyToken(token);

        req.user = {
          playerId: decoded.sub,
          username: decoded.username,
          permissions: decoded.permissions || ['play'],
        };

        next();
      } catch (jwtError) {
        if (jwtError.code === 'TOKEN_EXPIRED') {
          return res.status(401).json({
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Access token has expired',
            },
          });
        }
        if (jwtError.code === 'TOKEN_REVOKED') {
          return res.status(401).json({
            error: {
              code: 'TOKEN_REVOKED',
              message: 'Token has been revoked',
            },
          });
        }
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          },
        });
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Check if user has required permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin')) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Permission '${permission}' required` },
      });
    }

    next();
  };
}

module.exports = createAuthMiddleware;
module.exports.requirePermission = requirePermission;
