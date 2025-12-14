/**
 * Model Unit Tests
 * Tests for entity models and business logic
 */

const {
  Player,
  PlayerProgress,
  PlayerWallet,
  Match,
  MatchMove,
  Achievement,
  PlayerAchievement,
} = require('../models');

describe('Player Model', () => {
  test('should create player with default values', () => {
    const player = new Player({ username: 'testuser', email: 'test@example.com' });
    expect(player.username).toBe('testuser');
    expect(player.email).toBe('test@example.com');
    expect(player.isActive).toBe(true);
    expect(player.accountFlags).toBe(0);
  });

  test('should detect banned account', () => {
    const player = new Player({ accountFlags: 1 });
    expect(player.isBanned()).toBe(true);
    expect(player.isMuted()).toBe(false);
  });

  test('should detect muted account', () => {
    const player = new Player({ accountFlags: 2 });
    expect(player.isMuted()).toBe(true);
    expect(player.isBanned()).toBe(false);
  });

  test('should serialize to JSON correctly', () => {
    const player = new Player({ playerId: '123', username: 'testuser' });
    const json = player.toJSON();
    expect(json.playerId).toBe('123');
    expect(json.username).toBe('testuser');
    expect(json).not.toHaveProperty('accountFlags');
  });
});

describe('PlayerWallet Model', () => {
  test('should create wallet with zero balances', () => {
    const wallet = new PlayerWallet({});
    expect(wallet.cosmicEssence).toBe(0);
    expect(wallet.voidFragments).toBe(0);
  });

  test('should add currency without exceeding cap', () => {
    const wallet = new PlayerWallet({ voidFragments: 190 });
    wallet.addCurrency('voidFragments', 50);
    expect(wallet.voidFragments).toBe(200); // Capped at 200
  });

  test('should throw on insufficient funds', () => {
    const wallet = new PlayerWallet({ cosmicEssence: 100 });
    expect(() => wallet.spendCurrency('cosmicEssence', 200)).toThrow();
  });

  test('should check affordability', () => {
    const wallet = new PlayerWallet({ cosmicEssence: 100, starlightOrbs: 50 });
    expect(wallet.canAfford({ cosmicEssence: 50, starlightOrbs: 25 })).toBe(true);
    expect(wallet.canAfford({ cosmicEssence: 200 })).toBe(false);
  });

  test('should generate cap warnings', () => {
    const wallet = new PlayerWallet({ voidFragments: 180 });
    const warnings = wallet.getCapWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].currency).toBe('voidFragments');
  });
});

describe('Match Model', () => {
  test('should create match with empty board', () => {
    const match = new Match({});
    expect(match.board.flat().every(cell => cell === null)).toBe(true);
    expect(match.status).toBe('in_progress');
  });

  test('should validate move', () => {
    const match = new Match({});
    expect(match.isValidMove(1, 1)).toBe(true);
    match.board[1][1] = 'o';
    expect(match.isValidMove(1, 1)).toBe(false);
  });

  test('should detect horizontal win', () => {
    const match = new Match({});
    match.board = [
      ['o', 'o', 'o'],
      [null, 'x', null],
      ['x', null, null],
    ];
    expect(match.checkWinner()).toBe('o');
  });

  test('should detect diagonal win', () => {
    const match = new Match({});
    match.board = [
      ['x', 'o', null],
      [null, 'x', 'o'],
      [null, null, 'x'],
    ];
    expect(match.checkWinner()).toBe('x');
  });

  test('should detect draw', () => {
    const match = new Match({});
    match.board = [
      ['x', 'o', 'x'],
      ['x', 'x', 'o'],
      ['o', 'x', 'o'],
    ];
    expect(match.checkWinner()).toBe(null);
    expect(match.isBoardFull()).toBe(true);
  });

  test('should qualify for streak rewards only at grid_walker+', () => {
    const easyMatch = new Match({ aiTier: 'void_novice' });
    const hardMatch = new Match({ aiTier: 'grid_walker' });
    expect(easyMatch.qualifiesForStreakRewards()).toBe(false);
    expect(hardMatch.qualifiesForStreakRewards()).toBe(true);
  });
});

describe('MatchMove Model', () => {
  test('should calculate cell value correctly', () => {
    const centerMove = new MatchMove({ cellRow: 1, cellCol: 1 });
    expect(centerMove.cellValue).toBe(3);

    const cornerMove = new MatchMove({ cellRow: 0, cellCol: 0 });
    expect(cornerMove.cellValue).toBe(2);

    const edgeMove = new MatchMove({ cellRow: 0, cellCol: 1 });
    expect(edgeMove.cellValue).toBe(1);
  });
});

describe('PlayerAchievement Model', () => {
  test('should update progress', () => {
    const achievement = { isProgressive: true, targetCount: 10 };
    const playerAchieve = new PlayerAchievement({ achievement });

    playerAchieve.updateProgress(5);
    expect(playerAchieve.currentProgress).toBe(5);
    expect(playerAchieve.isComplete).toBe(false);

    playerAchieve.updateProgress(5);
    expect(playerAchieve.currentProgress).toBe(10);
    expect(playerAchieve.isComplete).toBe(true);
  });

  test('should calculate progress percent', () => {
    const achievement = { isProgressive: true, targetCount: 100 };
    const playerAchieve = new PlayerAchievement({ achievement, currentProgress: 25 });
    expect(playerAchieve.getProgressPercent()).toBe(25);
  });
});
