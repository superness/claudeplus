/**
 * Player Entity Model
 * Core player identity and authentication
 */

class Player {
  constructor(data = {}) {
    this.playerId = data.playerId || null;
    this.username = data.username || '';
    this.email = data.email || '';
    this.displayName = data.displayName || null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.lastLogin = data.lastLogin ? new Date(data.lastLogin) : null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.accountFlags = data.accountFlags || 0;
  }

  // Account flag bit masks
  static FLAGS = {
    BANNED: 1,
    MUTED: 2,
    TRADE_RESTRICTED: 4,
  };

  isBanned() {
    return (this.accountFlags & Player.FLAGS.BANNED) !== 0;
  }

  isMuted() {
    return (this.accountFlags & Player.FLAGS.MUTED) !== 0;
  }

  isTradeRestricted() {
    return (this.accountFlags & Player.FLAGS.TRADE_RESTRICTED) !== 0;
  }

  toJSON() {
    return {
      playerId: this.playerId,
      username: this.username,
      email: this.email,
      displayName: this.displayName,
      createdAt: this.createdAt.toISOString(),
      lastLogin: this.lastLogin?.toISOString() || null,
      isActive: this.isActive,
    };
  }

  toPublicJSON() {
    return {
      playerId: this.playerId,
      username: this.username,
      displayName: this.displayName || this.username,
    };
  }
}

module.exports = Player;
