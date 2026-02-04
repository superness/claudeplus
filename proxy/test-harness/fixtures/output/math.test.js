const { add, subtract } = require('./math');

describe('add', () => {
  test('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('adds two negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });

  test('adds positive and negative numbers', () => {
    expect(add(5, -3)).toBe(2);
    expect(add(-5, 3)).toBe(-2);
  });

  test('adds zero', () => {
    expect(add(0, 5)).toBe(5);
    expect(add(5, 0)).toBe(5);
    expect(add(0, 0)).toBe(0);
  });

  test('adds decimal numbers', () => {
    expect(add(1.5, 2.5)).toBe(4);
    expect(add(0.1, 0.2)).toBeCloseTo(0.3);
  });

  test('handles large numbers', () => {
    expect(add(1000000, 2000000)).toBe(3000000);
  });
});

describe('subtract', () => {
  test('subtracts two positive numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  test('subtracts two negative numbers', () => {
    expect(subtract(-5, -3)).toBe(-2);
  });

  test('subtracts positive and negative numbers', () => {
    expect(subtract(5, -3)).toBe(8);
    expect(subtract(-5, 3)).toBe(-8);
  });

  test('subtracts zero', () => {
    expect(subtract(5, 0)).toBe(5);
    expect(subtract(0, 5)).toBe(-5);
    expect(subtract(0, 0)).toBe(0);
  });

  test('subtracts decimal numbers', () => {
    expect(subtract(5.5, 2.5)).toBe(3);
    expect(subtract(0.3, 0.1)).toBeCloseTo(0.2);
  });

  test('handles large numbers', () => {
    expect(subtract(3000000, 1000000)).toBe(2000000);
  });
});
