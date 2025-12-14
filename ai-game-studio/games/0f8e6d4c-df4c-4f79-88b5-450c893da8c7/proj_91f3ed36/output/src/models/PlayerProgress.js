/**
 * PlayerProgress Entity Model
 * Tracks player level, XP, and match statistics
 */

class PlayerProgress {
  constructor(data = {}) {
    this.playerId = data.playerId || null;
    this.level = data.level || 1;
    this.cosmicResonance = data.cosmicResonance || 0;
    this.prestigeLevel = data.prestigeLevel || 0;
    this.totalMatches = data.totalMatches || 0;
    this.totalWins = data.totalWins || 0;
    this.totalDraws = data.totalDraws || 0;
    this.totalLosses = data.totalLosses || 0;
    this.winsAsO = data.winsAsO || 0;
    this.winsAsX = data.winsAsX || 0;
    this.drawsVsEternal = data.drawsVsEternal || 0;
    this.perfectGames = data.perfectGames || 0;
    this.swiftVictories = data.swiftVictories || 0;
    this.forkVictories = data.forkVictories || 0;
    this.comebackVictories = data.comebackVictories || 0;
    this.firstMatchDate = data.firstMatchDate ? new Date(data.firstMatchDate) : null;
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static MAX_LEVEL = 100;
  static MAX_PRESTIGE = 10;

  // XP thresholds per level (example curve)
  static getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  getXPToNextLevel() {
    if (this.level >= PlayerProgress.MAX_LEVEL) return 0;
    return PlayerProgress.getXPForLevel(this.level + 1) - this.cosmicResonance;
  }

  canLevelUp() {
    return (
      this.level < PlayerProgress.MAX_LEVEL &&
      this.cosmicResonance >= PlayerProgress.getXPForLevel(this.level + 1)
    );
  }

  getWinRate() {
    if (this.totalMatches === 0) return 0;
    return (this.totalWins / this.totalMatches) * 100;
  }

  toJSON() {
    return {
      playerId: this.playerId,
      level: this.level,
      cosmicResonance: this.cosmicResonance,
      cosmicResonanceToNext: this.getXPToNextLevel(),
      prestigeLevel: this.prestigeLevel,
      totalMatches: this.totalMatches,
      totalWins: this.totalWins,
      totalDraws: this.totalDraws,
      totalLosses: this.totalLosses,
      winsAsO: this.winsAsO,
      winsAsX: this.winsAsX,
      drawsVsEternal: this.drawsVsEternal,
      perfectGames: this.perfectGames,
      swiftVictories: this.swiftVictories,
      forkVictories: this.forkVictories,
      comebackVictories: this.comebackVictories,
      firstMatchDate: this.firstMatchDate?.toISOString().split('T')[0] || null,
      winRate: this.getWinRate().toFixed(1),
    };
  }
}

module.exports = PlayerProgress;
