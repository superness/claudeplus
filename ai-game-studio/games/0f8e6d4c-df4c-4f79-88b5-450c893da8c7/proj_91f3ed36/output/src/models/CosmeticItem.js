/**
 * CosmeticItem Entity Model
 * Cosmetic items for player customization
 */

class CosmeticItem {
  constructor(data = {}) {
    this.itemId = data.itemId || null;
    this.itemCode = data.itemCode || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category || 'symbol_trail';
    this.tier = data.tier || 'common';
    this.faction = data.faction || 'neutral';

    // Pricing
    this.price = data.price || {};

    // Unlock requirements
    this.unlockAchievement = data.unlockAchievement || null;
    this.unlockLevel = data.unlockLevel || null;
    this.unlockPrestige = data.unlockPrestige || null;
    this.unlockMatchCount = data.unlockMatchCount || null;

    // Visual assets
    this.assetPath = data.assetPath || null;
    this.previewPath = data.previewPath || null;
    this.particleConfig = data.particleConfig || {};

    // Availability
    this.isTradeable = data.isTradeable || false;
    this.isLimited = data.isLimited || false;
    this.availableFrom = data.availableFrom ? new Date(data.availableFrom) : null;
    this.availableUntil = data.availableUntil ? new Date(data.availableUntil) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }

  static CATEGORIES = [
    'symbol_trail',
    'cell_animation',
    'grid_skin',
    'victory_effect',
    'profile_frame',
    'title',
    'symbol_evolution_o',
    'symbol_evolution_x',
  ];

  static TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'prestige'];

  static FACTIONS = ['orbis', 'crucia', 'neutral', 'awakened'];

  /**
   * Check if item is currently available for purchase
   */
  isAvailable() {
    if (!this.isLimited) return true;
    const now = new Date();
    if (this.availableFrom && now < this.availableFrom) return false;
    if (this.availableUntil && now > this.availableUntil) return false;
    return true;
  }

  /**
   * Check if player meets unlock requirements
   */
  meetsRequirements(playerProgress, playerAchievements = []) {
    if (this.unlockLevel && playerProgress.level < this.unlockLevel) return false;
    if (this.unlockPrestige && playerProgress.prestigeLevel < this.unlockPrestige) return false;
    if (this.unlockMatchCount && playerProgress.totalMatches < this.unlockMatchCount) return false;
    if (this.unlockAchievement && !playerAchievements.includes(this.unlockAchievement)) return false;
    return true;
  }

  toJSON() {
    return {
      itemId: this.itemId,
      itemCode: this.itemCode,
      name: this.name,
      description: this.description,
      category: this.category,
      tier: this.tier,
      faction: this.faction,
      price: this.price,
      unlockRequirements: {
        achievement: this.unlockAchievement,
        level: this.unlockLevel,
        prestige: this.unlockPrestige,
        matchCount: this.unlockMatchCount,
      },
      previewUrl: this.previewPath,
      isTradeable: this.isTradeable,
      isLimited: this.isLimited,
      isAvailable: this.isAvailable(),
    };
  }
}

module.exports = CosmeticItem;
