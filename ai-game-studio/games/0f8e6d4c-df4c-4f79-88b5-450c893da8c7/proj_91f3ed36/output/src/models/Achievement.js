/**
 * Achievement Entity Model
 * Tracks achievement definitions and player progress
 */

class Achievement {
  constructor(data = {}) {
    this.achieveId = data.achieveId || null;
    this.achieveCode = data.achieveCode || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.tier = data.tier || 'bronze';
    this.category = data.category || 'combat';

    // Tracking
    this.isProgressive = data.isProgressive || false;
    this.targetCount = data.targetCount || null;

    // Rewards
    this.rewards = data.rewards || {};
    this.rewardCosmeticId = data.rewardCosmeticId || null;
    this.rewardXP = data.rewardXP || 0;

    // Special unlocks
    this.unlocksTitle = data.unlocksTitle || null;
    this.unlocksFeature = data.unlocksFeature || null;

    // Metadata
    this.isHidden = data.isHidden || false;
    this.isSeasonal = data.isSeasonal || false;
    this.seasonId = data.seasonId || null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }

  static TIERS = ['bronze', 'silver', 'gold', 'platinum', 'legendary'];

  static CATEGORIES = ['combat', 'progression', 'collection', 'social'];

  toJSON() {
    return {
      achieveId: this.achieveId,
      achieveCode: this.achieveCode,
      name: this.name,
      description: this.description,
      tier: this.tier,
      category: this.category,
      isProgressive: this.isProgressive,
      targetCount: this.targetCount,
      rewards: this.rewards,
      unlocksTitle: this.unlocksTitle,
      isHidden: this.isHidden,
    };
  }
}

/**
 * PlayerAchievement - Tracks individual player's achievement progress
 */
class PlayerAchievement {
  constructor(data = {}) {
    this.entryId = data.entryId || null;
    this.playerId = data.playerId || null;
    this.achieveId = data.achieveId || null;
    this.achievement = data.achievement || null; // Populated Achievement object
    this.currentProgress = data.currentProgress || 0;
    this.isComplete = data.isComplete || false;
    this.unlockedAt = data.unlockedAt ? new Date(data.unlockedAt) : null;
    this.rewardClaimed = data.rewardClaimed || false;
  }

  /**
   * Update progress for progressive achievement
   */
  updateProgress(amount = 1) {
    if (!this.achievement?.isProgressive) return this;

    this.currentProgress += amount;
    if (this.achievement.targetCount && this.currentProgress >= this.achievement.targetCount) {
      this.isComplete = true;
      this.unlockedAt = new Date();
    }
    return this;
  }

  /**
   * Complete a non-progressive achievement
   */
  complete() {
    this.isComplete = true;
    this.unlockedAt = new Date();
    return this;
  }

  /**
   * Claim rewards (mark as claimed)
   */
  claimRewards() {
    if (!this.isComplete) throw new Error('Achievement not complete');
    if (this.rewardClaimed) throw new Error('Rewards already claimed');
    this.rewardClaimed = true;
    return this.achievement?.rewards || {};
  }

  getProgressPercent() {
    if (!this.achievement?.isProgressive) return this.isComplete ? 100 : 0;
    if (!this.achievement.targetCount) return 0;
    return Math.min(100, (this.currentProgress / this.achievement.targetCount) * 100);
  }

  toJSON() {
    return {
      achieveId: this.achieveId,
      achieveCode: this.achievement?.achieveCode,
      name: this.achievement?.name,
      description: this.achievement?.description,
      tier: this.achievement?.tier,
      category: this.achievement?.category,
      isProgressive: this.achievement?.isProgressive,
      currentProgress: this.currentProgress,
      targetCount: this.achievement?.targetCount,
      progressPercent: this.getProgressPercent().toFixed(1),
      isComplete: this.isComplete,
      unlockedAt: this.unlockedAt?.toISOString() || null,
      rewardClaimed: this.rewardClaimed,
      rewards: this.achievement?.rewards,
    };
  }
}

module.exports = { Achievement, PlayerAchievement };
