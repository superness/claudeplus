/**
 * SkillTree Entity Models
 * Represents skill trees, nodes, and player progress
 */

class SkillTree {
  constructor(data = {}) {
    this.treeId = data.treeId || null;
    this.treeCode = data.treeCode || '';
    this.faction = data.faction || 'neutral';
    this.name = data.name || '';
    this.description = data.description || '';
    this.masteryTitle = data.masteryTitle || null;
    this.totalNodes = data.totalNodes || 0;
    this.nodes = data.nodes || [];
  }

  static FACTIONS = ['orbis', 'crucia', 'awakened'];

  getBranches() {
    const branches = new Set();
    this.nodes.forEach(node => branches.add(node.branch));
    return Array.from(branches);
  }

  toJSON() {
    return {
      treeId: this.treeId,
      treeCode: this.treeCode,
      faction: this.faction,
      name: this.name,
      description: this.description,
      masteryTitle: this.masteryTitle,
      totalNodes: this.totalNodes,
      branches: this.getBranches(),
    };
  }
}

/**
 * SkillNode - Individual node within a skill tree
 */
class SkillNode {
  constructor(data = {}) {
    this.nodeId = data.nodeId || null;
    this.treeId = data.treeId || null;
    this.nodeCode = data.nodeCode || '';
    this.branch = data.branch || '';
    this.tier = data.tier || 1;
    this.name = data.name || '';
    this.description = data.description || '';

    // Costs
    this.cost = data.cost || {};

    // Prerequisite
    this.prereqNodeId = data.prereqNodeId || null;

    // Effect
    this.effectType = data.effectType || null;
    this.effectConfig = data.effectConfig || {};

    this.displayOrder = data.displayOrder || 0;
  }

  static EFFECT_TYPES = [
    'symbol_enhancement',
    'grid_enhancement',
    'victory_enhancement',
  ];

  static MAX_TIER = 4;

  toJSON() {
    return {
      nodeId: this.nodeId,
      nodeCode: this.nodeCode,
      branch: this.branch,
      tier: this.tier,
      name: this.name,
      description: this.description,
      cost: this.cost,
      prerequisites: this.prereqNodeId ? [this.prereqNodeId] : [],
      effectType: this.effectType,
    };
  }
}

/**
 * PlayerSkills - Tracks which nodes a player has unlocked
 */
class PlayerSkills {
  constructor(data = {}) {
    this.playerId = data.playerId || null;
    this.unlockedNodes = data.unlockedNodes || []; // Array of SkillNode objects
  }

  hasNode(nodeId) {
    return this.unlockedNodes.some(n => n.nodeId === nodeId);
  }

  canUnlock(node, wallet) {
    // Check prerequisite
    if (node.prereqNodeId && !this.hasNode(node.prereqNodeId)) {
      return { canUnlock: false, reason: 'PREREQUISITE_NOT_MET' };
    }

    // Check already unlocked
    if (this.hasNode(node.nodeId)) {
      return { canUnlock: false, reason: 'ALREADY_UNLOCKED' };
    }

    // Check cost
    if (!wallet.canAfford(node.cost)) {
      return { canUnlock: false, reason: 'INSUFFICIENT_CURRENCY' };
    }

    return { canUnlock: true };
  }

  unlockNode(node) {
    if (this.hasNode(node.nodeId)) {
      throw new Error('Node already unlocked');
    }
    this.unlockedNodes.push({
      ...node,
      unlockedAt: new Date(),
    });
  }

  getTreeProgress(tree) {
    const treeNodes = this.unlockedNodes.filter(n => n.treeId === tree.treeId);
    return {
      nodesUnlocked: treeNodes.length,
      totalNodes: tree.totalNodes,
      isMastered: treeNodes.length >= tree.totalNodes,
    };
  }

  toJSON() {
    return {
      playerId: this.playerId,
      unlockedNodes: this.unlockedNodes.map(n => ({
        nodeId: n.nodeId,
        nodeCode: n.nodeCode,
        name: n.name,
        tier: n.tier,
        unlockedAt: n.unlockedAt?.toISOString(),
      })),
    };
  }
}

module.exports = { SkillTree, SkillNode, PlayerSkills };
