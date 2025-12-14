/**
 * Complexity Classifier Service
 * Uses Claude Haiku to classify game ideas into complexity tiers
 */

const Anthropic = require('@anthropic-ai/sdk');

class ComplexityClassifier {
  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Classify a game idea into complexity tiers
   * @param {string} gameIdea - The user's game idea description
   * @returns {Promise<'simple'|'standard'|'complex'>} - The complexity level
   */
  async classify(gameIdea) {
    const prompt = `You are classifying game ideas to select the right DESIGN pipeline. The design pipeline produces documentation, then a separate feature-implementer pipeline builds the actual game.

SIMPLE (2-stage design, ~15-30 min) - Client-side only, no backend needed
- Single core mechanic, no server, no database, no API
- All game state lives in browser (Phaser.js/Three.js)
- Examples: Tic-tac-toe, Snake, Pong, Breakout, Minesweeper, Flappy Bird, Memory match, 2048
- Pipeline: system_designer → design_reviewer → done

STANDARD (12-stage design, ~4-6 hrs) - May need light backend
- Multiple systems, basic progression OR economy
- Might need server for leaderboards, saves, or multiplayer
- Examples: Platformer with levels, Tower defense, Match-3 with upgrades, Simple RPG, Racing with unlocks
- Pipeline: includes lore, combat, progression, balance, data modeling, API design

COMPLEX (24-stage design, ~8-20 hrs) - Full backend architecture needed
- Deep lore/worldbuilding, interconnected economy + progression + combat
- Needs database schemas, microservices, complex API
- Examples: Open world RPG, City builder, MMO features, Survival with crafting, Strategy with diplomacy
- Pipeline: full world-building, economy simulation, all validators, backend code generation

Game idea: "${gameIdea}"

Respond with ONLY one word: simple, standard, or complex`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const result = response.content[0].text.toLowerCase().trim();

      // Validate response
      if (['simple', 'standard', 'complex'].includes(result)) {
        console.log(`[ComplexityClassifier] Classified "${gameIdea.substring(0, 50)}..." as: ${result}`);
        return result;
      }

      // Fallback if response is unexpected
      console.log(`[ComplexityClassifier] Unexpected response "${result}", defaulting to standard`);
      return 'standard';

    } catch (error) {
      console.error('[ComplexityClassifier] Error classifying game idea:', error.message);
      // Default to standard on error - safest middle ground
      return 'standard';
    }
  }

  /**
   * Get the pipeline template name for a complexity level
   * @param {string} complexity - The complexity level
   * @returns {string} - The pipeline template name
   */
  getTemplateForComplexity(complexity) {
    const templateMap = {
      'simple': 'simple-game-design-v1',
      'standard': 'standard-game-design-v1',
      'complex': 'living-game-world-v1'
    };
    return templateMap[complexity] || 'standard-game-design-v1';
  }

  /**
   * Get human-readable description for a complexity level
   * @param {string} complexity - The complexity level
   * @returns {object} - Description and estimated time
   */
  getComplexityInfo(complexity) {
    const info = {
      'simple': {
        name: 'Simple',
        description: 'Quick design for client-side games (no backend)',
        estimatedTime: '15-30 minutes',
        stages: 2,
        needsBackend: false
      },
      'standard': {
        name: 'Standard',
        description: 'Balanced design for games with multiple systems',
        estimatedTime: '4-6 hours',
        stages: 12,
        needsBackend: 'optional'
      },
      'complex': {
        name: 'Complex',
        description: 'Full world-building with backend architecture',
        estimatedTime: '8-20 hours',
        stages: 24,
        needsBackend: true
      }
    };
    return info[complexity] || info['standard'];
  }
}

module.exports = new ComplexityClassifier();
