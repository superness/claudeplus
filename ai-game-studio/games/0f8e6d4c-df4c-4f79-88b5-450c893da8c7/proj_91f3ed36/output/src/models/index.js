/**
 * Cosmic Tic-Tac-Toe Entity Models
 * Central export for all game entities
 */

const Player = require('./Player');
const PlayerProgress = require('./PlayerProgress');
const PlayerWallet = require('./PlayerWallet');
const { Match, MatchMove } = require('./Match');
const CosmeticItem = require('./CosmeticItem');
const { Achievement, PlayerAchievement } = require('./Achievement');
const { SkillTree, SkillNode, PlayerSkills } = require('./SkillTree');

module.exports = {
  // Core player entities
  Player,
  PlayerProgress,
  PlayerWallet,

  // Game entities
  Match,
  MatchMove,

  // Progression entities
  Achievement,
  PlayerAchievement,
  SkillTree,
  SkillNode,
  PlayerSkills,

  // Cosmetic entities
  CosmeticItem,
};
