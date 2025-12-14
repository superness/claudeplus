/**
 * PlayerWallet Entity Model
 * Manages all currency balances with caps
 */

class PlayerWallet {
  constructor(data = {}) {
    this.playerId = data.playerId || null;
    this.cosmicEssence = data.cosmicEssence || 0;
    this.starlightOrbs = data.starlightOrbs || 0;
    this.shadowShards = data.shadowShards || 0;
    this.voidFragments = data.voidFragments || 0;
    this.alignmentCrystals = data.alignmentCrystals || 0;
    this.primordialSparks = data.primordialSparks || 0;
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  // Currency caps
  static CAPS = {
    voidFragments: 200,
    alignmentCrystals: 50,
    primordialSparks: 10,
  };

  // Currency tiers (for rarity indication)
  static TIERS = {
    cosmicEssence: 'common',
    starlightOrbs: 'uncommon',
    shadowShards: 'uncommon',
    voidFragments: 'rare',
    alignmentCrystals: 'epic',
    primordialSparks: 'legendary',
  };

  /**
   * Add currency with cap enforcement
   */
  addCurrency(type, amount) {
    if (amount < 0) throw new Error('Cannot add negative amount');

    const cap = PlayerWallet.CAPS[type];
    if (cap !== undefined) {
      this[type] = Math.min(this[type] + amount, cap);
    } else {
      this[type] += amount;
    }
    this.updatedAt = new Date();
  }

  /**
   * Spend currency if sufficient balance
   */
  spendCurrency(type, amount) {
    if (amount < 0) throw new Error('Cannot spend negative amount');
    if (this[type] < amount) {
      throw new Error(`Insufficient ${type}: have ${this[type]}, need ${amount}`);
    }
    this[type] -= amount;
    this.updatedAt = new Date();
  }

  /**
   * Check if player can afford a cost
   */
  canAfford(costs) {
    for (const [type, amount] of Object.entries(costs)) {
      if (this[type] === undefined || this[type] < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get warnings for currencies near cap
   */
  getCapWarnings(threshold = 0.8) {
    const warnings = [];
    for (const [type, cap] of Object.entries(PlayerWallet.CAPS)) {
      const current = this[type];
      const ratio = current / cap;
      if (ratio >= threshold) {
        warnings.push({
          currency: type,
          current,
          cap,
          atCapacityPercent: (ratio * 100).toFixed(1),
        });
      }
    }
    return warnings;
  }

  toJSON() {
    return {
      playerId: this.playerId,
      currencies: {
        cosmicEssence: this.cosmicEssence,
        starlightOrbs: this.starlightOrbs,
        shadowShards: this.shadowShards,
        voidFragments: this.voidFragments,
        alignmentCrystals: this.alignmentCrystals,
        primordialSparks: this.primordialSparks,
      },
      caps: PlayerWallet.CAPS,
      warnings: this.getCapWarnings(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

module.exports = PlayerWallet;
