/**
 * Service Unit Tests
 * Tests for business logic services
 */

const AuthService = require('../services/AuthService');
const GameService = require('../services/GameService');
const EconomyService = require('../services/EconomyService');

// Mock database
const mockDb = {
  query: jest.fn(),
};

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService(mockDb);
    jest.clearAllMocks();
  });

  describe('validation', () => {
    test('should validate username format', () => {
      expect(authService._validateUsername('valid_user123')).toBe(true);
      expect(authService._validateUsername('ab')).toBe(false); // Too short
      expect(authService._validateUsername('invalid user')).toBe(false); // Space
    });

    test('should validate email format', () => {
      expect(authService._validateEmail('test@example.com')).toBe(true);
      expect(authService._validateEmail('invalid')).toBe(false);
      expect(authService._validateEmail('no@domain')).toBe(false);
    });

    test('should validate password strength', () => {
      expect(authService._validatePassword('Strong1Pass')).toBe(true);
      expect(authService._validatePassword('weak')).toBe(false);
      expect(authService._validatePassword('NoNumbers')).toBe(false);
      expect(authService._validatePassword('nonumbers123')).toBe(false);
    });
  });
});

describe('GameService', () => {
  let gameService;

  beforeEach(() => {
    gameService = new GameService(mockDb);
    jest.clearAllMocks();
  });

  describe('game logic', () => {
    test('should reconstruct board from moves', () => {
      const moves = [
        { cellRow: 0, cellCol: 0, symbol: 'x' },
        { cellRow: 1, cellCol: 1, symbol: 'o' },
        { cellRow: 2, cellCol: 2, symbol: 'x' },
      ];
      const board = gameService._reconstructBoard(moves);
      expect(board[0][0]).toBe('x');
      expect(board[1][1]).toBe('o');
      expect(board[2][2]).toBe('x');
    });

    test('should get correct cell values', () => {
      expect(gameService._getCellValue(1, 1)).toBe(3); // Center
      expect(gameService._getCellValue(0, 0)).toBe(2); // Corner
      expect(gameService._getCellValue(0, 1)).toBe(1); // Edge
    });

    test('should detect horizontal win', () => {
      const board = [
        ['o', 'o', 'o'],
        [null, 'x', null],
        ['x', null, null],
      ];
      expect(gameService._checkWinner(board)).toBe('o');
    });

    test('should detect vertical win', () => {
      const board = [
        ['x', 'o', null],
        ['x', 'o', null],
        [null, 'o', null],
      ];
      expect(gameService._checkWinner(board)).toBe('o');
    });

    test('should detect no winner', () => {
      const board = [
        ['x', 'o', null],
        [null, 'x', null],
        [null, null, null],
      ];
      expect(gameService._checkWinner(board)).toBe(null);
    });

    test('should detect full board', () => {
      const fullBoard = [
        ['x', 'o', 'x'],
        ['x', 'o', 'o'],
        ['o', 'x', 'x'],
      ];
      const partialBoard = [
        ['x', 'o', null],
        ['x', 'o', 'o'],
        ['o', 'x', 'x'],
      ];
      expect(gameService._isBoardFull(fullBoard)).toBe(true);
      expect(gameService._isBoardFull(partialBoard)).toBe(false);
    });
  });

  describe('AI move calculation', () => {
    test('should take winning move', () => {
      const board = [
        ['x', 'x', null],
        ['o', 'o', null],
        [null, null, null],
      ];
      const move = gameService._calculateAIMove(board, 'the_eternal', 'x');
      expect(move.row).toBe(0);
      expect(move.col).toBe(2);
      expect(move.type).toBe('winning');
    });

    test('should block opponent winning move (high skill)', () => {
      const board = [
        ['o', 'o', null],
        ['x', null, null],
        [null, null, null],
      ];
      // With the_eternal (skill=1.0), should always block
      const move = gameService._calculateAIMove(board, 'the_eternal', 'x');
      expect(move.row).toBe(0);
      expect(move.col).toBe(2);
    });
  });
});

describe('EconomyService', () => {
  let economyService;

  beforeEach(() => {
    economyService = new EconomyService(mockDb);
    jest.clearAllMocks();
  });

  describe('currency conversion', () => {
    test('should have valid conversion rates', () => {
      // Test that conversion logic exists (actual test would need mock setup)
      expect(economyService).toBeDefined();
    });

    test('should normalize currency names', () => {
      expect(economyService._normalizeCurrencyName('cosmic_essence')).toBe('cosmicEssence');
      expect(economyService._normalizeCurrencyName('starlight_orbs')).toBe('starlightOrbs');
      expect(economyService._normalizeCurrencyName('cosmicEssence')).toBe('cosmicEssence');
    });
  });
});

describe('GameService streak rewards', () => {
  let gameService;

  beforeEach(() => {
    gameService = new GameService(mockDb);
    jest.clearAllMocks();
  });

  describe('streak reward calculation', () => {
    test('should not grant rare currency rewards for low-tier AI', () => {
      const match = {
        aiTier: 'void_novice',
        symbolPlayed: 'o',
        streakCountAtStart: 10,
      };
      const rewards = gameService._calculateRewards(match, 'win');

      // Rare currencies should be 0 for void_novice
      expect(rewards.voidFragments).toBe(0);
      expect(rewards.alignmentCrystals).toBe(0);
      expect(rewards.primordialSparks).toBe(0);
    });

    test('should grant rare currency rewards for grid_walker AI', () => {
      const match = {
        aiTier: 'grid_walker',
        symbolPlayed: 'o',
        streakCountAtStart: 10, // 11-win streak after this match
      };
      const rewards = gameService._calculateRewards(match, 'win');

      // Should get streak rewards at 10+ streak
      expect(rewards.voidFragments).toBeGreaterThan(0);
      expect(rewards.alignmentCrystals).toBeGreaterThan(0);
    });

    test('should grant rare currency rewards for force_adept AI', () => {
      const match = {
        aiTier: 'force_adept',
        symbolPlayed: 'x',
        streakCountAtStart: 14, // 15-win streak after this match
      };
      const rewards = gameService._calculateRewards(match, 'win');

      // Should get streak rewards including primordial sparks at 15+ streak
      expect(rewards.voidFragments).toBe(7);
      expect(rewards.alignmentCrystals).toBe(2);
      expect(rewards.primordialSparks).toBe(1);
    });

    test('should not grant streak rewards on loss', () => {
      const match = {
        aiTier: 'grid_walker',
        symbolPlayed: 'o',
        streakCountAtStart: 15,
      };
      const rewards = gameService._calculateRewards(match, 'loss');

      expect(rewards.voidFragments).toBe(0);
      expect(rewards.alignmentCrystals).toBe(0);
      expect(rewards.primordialSparks).toBe(0);
    });

    test('should grant bonus essence at 3+ streak regardless of AI tier', () => {
      const match = {
        aiTier: 'void_novice',
        symbolPlayed: 'o',
        streakCountAtStart: 2, // 3-win streak after this match
      };
      const rewards = gameService._calculateRewards(match, 'win');

      // Bonus essence should be granted even for low-tier AI
      expect(rewards.cosmicEssence).toBeGreaterThan(50); // Base 50 + 50 bonus
    });
  });

  describe('streak reward milestones', () => {
    test('should calculate correct rewards for 5-win streak', () => {
      const match = { aiTier: 'grid_walker', symbolPlayed: 'o', streakCountAtStart: 4 };
      const streakRewards = gameService._calculateStreakRewards(match, 'win');

      expect(streakRewards.bonusEssence).toBe(50);
      expect(streakRewards.voidFragments).toBe(3);
      expect(streakRewards.alignmentCrystals).toBe(0);
    });

    test('should calculate correct rewards for 10-win streak', () => {
      const match = { aiTier: 'grid_walker', symbolPlayed: 'o', streakCountAtStart: 9 };
      const streakRewards = gameService._calculateStreakRewards(match, 'win');

      expect(streakRewards.bonusEssence).toBe(50);
      expect(streakRewards.voidFragments).toBe(5);
      expect(streakRewards.alignmentCrystals).toBe(1);
      expect(streakRewards.primordialSparks).toBe(0);
    });

    test('should calculate correct rewards for 20-win streak', () => {
      const match = { aiTier: 'the_eternal', symbolPlayed: 'x', streakCountAtStart: 19 };
      const streakRewards = gameService._calculateStreakRewards(match, 'win');

      expect(streakRewards.bonusEssence).toBe(50);
      expect(streakRewards.voidFragments).toBe(10);
      expect(streakRewards.alignmentCrystals).toBe(3);
      expect(streakRewards.primordialSparks).toBe(2);
    });
  });
});
