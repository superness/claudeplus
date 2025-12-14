/**
 * Progression Service
 * Handles player levels, XP, skill trees, and achievements
 */

const PlayerRepository = require('../data/PlayerRepository');
const config = require('../config');

// XP requirements per level (exponential curve)
const XP_PER_LEVEL = [
  0,      // Level 1 (starting)
  100,    // Level 2
  250,    // Level 3
  450,    // Level 4
  700,    // Level 5
  1000,   // Level 6
  1350,   // Level 7
  1750,   // Level 8
  2200,   // Level 9
  2700,   // Level 10
];

// After level 10, each level requires: previous + 550
function getXPForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return XP_PER_LEVEL[level - 1] || 0;
  // For levels 11+, use formula
  let xp = XP_PER_LEVEL[9]; // Level 10 requirement
  for (let i = 11; i <= level; i++) {
    xp += 550 + (i - 10) * 50; // Increasing increments
  }
  return xp;
}

class ProgressionService {
  constructor(db) {
    this.playerRepo = new PlayerRepository(db);
    this.db = db;
  }

  /**
   * Get player's progression state
   */
  async getProgress(playerId) {
    const progress = await this.playerRepo.getProgress(playerId);
    if (!progress) {
      const error = new Error('Player progress not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const currentLevel = progress.level;
    const currentXP = progress.cosmicResonance;
    const xpForCurrentLevel = getXPForLevel(currentLevel);
    const xpForNextLevel = getXPForLevel(currentLevel + 1);

    return {
      playerId,
      level: currentLevel,
      cosmicResonance: currentXP,
      cosmicResonanceToNext: xpForNextLevel,
      progressPercent: Math.floor(((currentXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100),
      prestigeLevel: progress.prestigeLevel || 0,
      totalMatches: progress.totalMatches,
      totalWins: progress.totalWins,
      totalDraws: progress.totalDraws,
      totalLosses: progress.totalLosses,
      winsAsO: progress.winsAsO,
      winsAsX: progress.winsAsX,
      drawsVsEternal: progress.drawsVsEternal || 0,
      perfectGames: progress.perfectGames || 0,
      swiftVictories: progress.swiftVictories || 0,
      forkVictories: progress.forkVictories || 0,
      comebackVictories: progress.comebackVictories || 0,
      firstMatchDate: progress.firstMatchDate,
      unlocks: this._getUnlocksForLevel(currentLevel),
    };
  }

  /**
   * Add XP to player and handle level ups
   */
  async addXP(playerId, amount, source = {}) {
    const progress = await this.playerRepo.getProgress(playerId);
    const currentLevel = progress.level;
    let newXP = progress.cosmicResonance + amount;
    let newLevel = currentLevel;
    const levelUps = [];

    // Check for level ups
    while (newLevel < 100 && newXP >= getXPForLevel(newLevel + 1)) {
      newLevel++;
      levelUps.push({
        level: newLevel,
        unlocks: this._getUnlocksForLevel(newLevel),
      });
    }

    // Update player progress
    await this.playerRepo.updateProgress(playerId, {
      cosmicResonance: newXP,
      level: newLevel,
    });

    // Record XP transaction if tracking enabled
    if (source.track) {
      await this._recordXPTransaction(playerId, amount, source);
    }

    return {
      xpAdded: amount,
      newXP,
      oldLevel: currentLevel,
      newLevel,
      levelUps,
    };
  }

  /**
   * Get player's skill tree progress
   */
  async getSkillProgress(playerId) {
    // Query skill trees and player's unlocked nodes
    const treesResult = await this.db.query(
      `SELECT * FROM skill_tree ORDER BY tree_code`
    );

    const playerSkillsResult = await this.db.query(
      `SELECT ps.*, sn.* FROM player_skills ps
       JOIN skill_node sn ON ps.node_id = sn.node_id
       WHERE ps.player_id = $1`,
      [playerId]
    );

    const unlockedNodeIds = new Set(playerSkillsResult.rows.map(r => r.node_id));

    const trees = [];
    for (const treeRow of treesResult.rows) {
      const nodesResult = await this.db.query(
        `SELECT * FROM skill_node WHERE tree_id = $1 ORDER BY tier, display_order`,
        [treeRow.tree_id]
      );

      const unlockedNodes = nodesResult.rows.filter(n => unlockedNodeIds.has(n.node_id));
      const lockedNodes = nodesResult.rows.filter(n => !unlockedNodeIds.has(n.node_id));

      trees.push({
        treeId: treeRow.tree_id,
        treeCode: treeRow.tree_code,
        name: treeRow.name,
        faction: treeRow.faction,
        nodesUnlocked: unlockedNodes.length,
        totalNodes: nodesResult.rows.length,
        isMastered: unlockedNodes.length === nodesResult.rows.length,
        unlockedNodes: unlockedNodes.map(this._mapSkillNode),
        lockedNodes: lockedNodes.map(this._mapSkillNode),
      });
    }

    // Check for Awakened Path accessibility
    const progress = await this.playerRepo.getProgress(playerId);
    const orbisMastered = trees.find(t => t.treeCode === 'orbis')?.isMastered || false;
    const cruciaMastered = trees.find(t => t.treeCode === 'crucia')?.isMastered || false;

    return {
      trees,
      awakenedPath: {
        accessible: orbisMastered && cruciaMastered && progress.winsAsO >= 50 && progress.winsAsX >= 50,
        requirements: {
          orbisMastery: orbisMastered,
          cruciaMastery: cruciaMastered,
          winsAsO: progress.winsAsO,
          winsAsX: progress.winsAsX,
          requiredWins: 50,
        },
      },
    };
  }

  /**
   * Unlock a skill tree node
   */
  async unlockSkillNode(playerId, nodeId) {
    // Get node details
    const nodeResult = await this.db.query(
      `SELECT sn.*, st.faction FROM skill_node sn
       JOIN skill_tree st ON sn.tree_id = st.tree_id
       WHERE sn.node_id = $1`,
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      const error = new Error('Skill node not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const node = nodeResult.rows[0];

    // Check if already unlocked
    const existingResult = await this.db.query(
      `SELECT * FROM player_skills WHERE player_id = $1 AND node_id = $2`,
      [playerId, nodeId]
    );

    if (existingResult.rows.length > 0) {
      const error = new Error('Node already unlocked');
      error.code = 'ALREADY_UNLOCKED';
      throw error;
    }

    // Check prerequisites
    if (node.prereq_node_id) {
      const prereqResult = await this.db.query(
        `SELECT * FROM player_skills WHERE player_id = $1 AND node_id = $2`,
        [playerId, node.prereq_node_id]
      );

      if (prereqResult.rows.length === 0) {
        const error = new Error('Prerequisite node not unlocked');
        error.code = 'PREREQUISITE_NOT_MET';
        throw error;
      }
    }

    // Check and spend currency
    const wallet = await this.playerRepo.getWallet(playerId);
    const costs = {};

    if (node.cost_orbs > 0) {
      if (wallet.starlightOrbs < node.cost_orbs) {
        const error = new Error('Insufficient Starlight Orbs');
        error.code = 'INSUFFICIENT_CURRENCY';
        throw error;
      }
      costs.starlightOrbs = node.cost_orbs;
    }

    if (node.cost_shards > 0) {
      if (wallet.shadowShards < node.cost_shards) {
        const error = new Error('Insufficient Shadow Shards');
        error.code = 'INSUFFICIENT_CURRENCY';
        throw error;
      }
      costs.shadowShards = node.cost_shards;
    }

    if (node.cost_align_crystals > 0) {
      if (wallet.alignmentCrystals < node.cost_align_crystals) {
        const error = new Error('Insufficient Alignment Crystals');
        error.code = 'INSUFFICIENT_CURRENCY';
        throw error;
      }
      costs.alignmentCrystals = node.cost_align_crystals;
    }

    // Deduct currencies
    const walletUpdate = {};
    if (costs.starlightOrbs) walletUpdate.starlightOrbs = wallet.starlightOrbs - costs.starlightOrbs;
    if (costs.shadowShards) walletUpdate.shadowShards = wallet.shadowShards - costs.shadowShards;
    if (costs.alignmentCrystals) walletUpdate.alignmentCrystals = wallet.alignmentCrystals - costs.alignmentCrystals;

    if (Object.keys(walletUpdate).length > 0) {
      await this.playerRepo.updateWallet(playerId, walletUpdate);
    }

    // Unlock the node
    await this.db.query(
      `INSERT INTO player_skills (player_id, node_id) VALUES ($1, $2)`,
      [playerId, nodeId]
    );

    // Get updated tree progress
    const treeProgress = await this.db.query(
      `SELECT COUNT(*) as unlocked FROM player_skills ps
       JOIN skill_node sn ON ps.node_id = sn.node_id
       WHERE ps.player_id = $1 AND sn.tree_id = $2`,
      [playerId, node.tree_id]
    );

    const totalNodesResult = await this.db.query(
      `SELECT COUNT(*) as total FROM skill_node WHERE tree_id = $1`,
      [node.tree_id]
    );

    return {
      unlocked: this._mapSkillNode(node),
      currencySpent: costs,
      walletAfter: await this.playerRepo.getWallet(playerId),
      treeProgress: {
        nodesUnlocked: parseInt(treeProgress.rows[0].unlocked),
        totalNodes: parseInt(totalNodesResult.rows[0].total),
      },
    };
  }

  /**
   * Get player's achievement progress
   */
  async getAchievements(playerId, filters = {}) {
    let query = `
      SELECT a.*, pa.current_progress, pa.is_complete, pa.unlocked_at, pa.reward_claimed
      FROM achievement a
      LEFT JOIN player_achievement pa ON a.achieve_id = pa.achieve_id AND pa.player_id = $1
      WHERE 1=1
    `;
    const params = [playerId];
    let paramIndex = 2;

    if (filters.category) {
      query += ` AND a.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.status === 'complete') {
      query += ` AND pa.is_complete = TRUE`;
    } else if (filters.status === 'in_progress') {
      query += ` AND pa.is_complete = FALSE AND pa.current_progress > 0`;
    } else if (filters.status === 'locked') {
      query += ` AND (pa.is_complete IS NULL OR (pa.is_complete = FALSE AND COALESCE(pa.current_progress, 0) = 0))`;
    }

    if (!filters.includeHidden) {
      query += ` AND a.is_hidden = FALSE`;
    }

    query += ` ORDER BY a.tier, a.category, a.name`;

    const result = await this.db.query(query, params);

    const achievements = result.rows.map(row => ({
      achieveId: row.achieve_id,
      achieveCode: row.achieve_code,
      name: row.name,
      description: row.description,
      tier: row.tier,
      category: row.category,
      isProgressive: row.is_progressive,
      currentProgress: row.current_progress || 0,
      targetCount: row.target_count,
      isComplete: row.is_complete || false,
      unlockedAt: row.unlocked_at,
      rewardClaimed: row.reward_claimed || false,
      rewards: {
        cosmicEssence: row.reward_essence,
        starlightOrbs: row.reward_orbs,
        shadowShards: row.reward_shards,
        voidFragments: row.reward_void_frags,
        alignmentCrystals: row.reward_align_crystals,
        primordialSparks: row.reward_prim_sparks,
        cosmicResonance: row.reward_xp,
      },
    }));

    const summary = {
      total: achievements.length,
      complete: achievements.filter(a => a.isComplete).length,
      inProgress: achievements.filter(a => !a.isComplete && a.currentProgress > 0).length,
      locked: achievements.filter(a => !a.isComplete && a.currentProgress === 0).length,
    };

    return { achievements, summary };
  }

  /**
   * Claim achievement reward
   */
  async claimAchievementReward(playerId, achieveId) {
    const result = await this.db.query(
      `SELECT a.*, pa.is_complete, pa.reward_claimed
       FROM achievement a
       JOIN player_achievement pa ON a.achieve_id = pa.achieve_id
       WHERE pa.player_id = $1 AND a.achieve_id = $2`,
      [playerId, achieveId]
    );

    if (result.rows.length === 0) {
      const error = new Error('Achievement not found or not unlocked');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const achievement = result.rows[0];

    if (!achievement.is_complete) {
      const error = new Error('Achievement not completed');
      error.code = 'NOT_COMPLETE';
      throw error;
    }

    if (achievement.reward_claimed) {
      const error = new Error('Reward already claimed');
      error.code = 'ALREADY_CLAIMED';
      throw error;
    }

    // Grant rewards
    const wallet = await this.playerRepo.getWallet(playerId);
    const rewards = {};
    const walletUpdate = {};

    if (achievement.reward_essence > 0) {
      rewards.cosmicEssence = achievement.reward_essence;
      walletUpdate.cosmicEssence = wallet.cosmicEssence + achievement.reward_essence;
    }
    if (achievement.reward_orbs > 0) {
      rewards.starlightOrbs = achievement.reward_orbs;
      walletUpdate.starlightOrbs = wallet.starlightOrbs + achievement.reward_orbs;
    }
    if (achievement.reward_shards > 0) {
      rewards.shadowShards = achievement.reward_shards;
      walletUpdate.shadowShards = wallet.shadowShards + achievement.reward_shards;
    }
    if (achievement.reward_void_frags > 0) {
      rewards.voidFragments = achievement.reward_void_frags;
      walletUpdate.voidFragments = Math.min(wallet.voidFragments + achievement.reward_void_frags, 200);
    }
    if (achievement.reward_align_crystals > 0) {
      rewards.alignmentCrystals = achievement.reward_align_crystals;
      walletUpdate.alignmentCrystals = Math.min(wallet.alignmentCrystals + achievement.reward_align_crystals, 50);
    }
    if (achievement.reward_prim_sparks > 0) {
      rewards.primordialSparks = achievement.reward_prim_sparks;
      walletUpdate.primordialSparks = Math.min(wallet.primordialSparks + achievement.reward_prim_sparks, 10);
    }

    // Update wallet
    if (Object.keys(walletUpdate).length > 0) {
      await this.playerRepo.updateWallet(playerId, walletUpdate);
    }

    // Add XP if applicable
    if (achievement.reward_xp > 0) {
      await this.addXP(playerId, achievement.reward_xp, { source: 'achievement', id: achieveId });
    }

    // Mark reward as claimed
    await this.db.query(
      `UPDATE player_achievement SET reward_claimed = TRUE WHERE player_id = $1 AND achieve_id = $2`,
      [playerId, achieveId]
    );

    return {
      achievement: {
        achieveCode: achievement.achieve_code,
        name: achievement.name,
      },
      rewardsClaimed: rewards,
      walletAfter: await this.playerRepo.getWallet(playerId),
      titleUnlocked: achievement.unlocks_title,
    };
  }

  // Private helper methods

  _getUnlocksForLevel(level) {
    const unlocks = {
      skillTree: level >= 5,
      trading: level >= 10,
      gridWalkerAI: level >= 15,
      forceAdeptAI: level >= 30,
      theEternalAI: level >= 50,
    };
    return unlocks;
  }

  _mapSkillNode(row) {
    return {
      nodeId: row.node_id,
      nodeCode: row.node_code,
      name: row.name,
      description: row.description,
      branch: row.branch,
      tier: row.tier,
      cost: {
        starlightOrbs: row.cost_orbs || 0,
        shadowShards: row.cost_shards || 0,
        alignmentCrystals: row.cost_align_crystals || 0,
      },
      prerequisites: row.prereq_node_id ? [row.prereq_node_id] : [],
      effectType: row.effect_type,
      effectConfig: row.effect_config,
    };
  }

  async _recordXPTransaction(playerId, amount, source) {
    // Get current XP balance to record accurate balance_after
    const progress = await this.playerRepo.getProgress(playerId);
    const balanceAfter = progress?.cosmicResonance || 0;

    await this.db.query(
      `INSERT INTO wallet_transaction
       (player_id, txn_type, resource, amount, balance_after, source_id, source_type, description)
       VALUES ($1, 'xp_gain', 'cosmic_resonance', $2, $3, $4, $5, $6)`,
      [playerId, amount, balanceAfter, source.id, source.type, source.description]
    );
  }
}

module.exports = ProgressionService;
