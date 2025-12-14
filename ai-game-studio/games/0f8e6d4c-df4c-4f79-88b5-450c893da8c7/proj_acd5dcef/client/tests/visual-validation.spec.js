const { test, expect } = require('@playwright/test');
const path = require('path');

// Helper function to perform drag-and-drop move on canvas
async function dragMove(page, canvas, fromX, fromY, toX, toY) {
  const box = await canvas.boundingBox();
  const startX = box.x + fromX;
  const startY = box.y + fromY;
  const endX = box.x + toX;
  const endY = box.y + toY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);
}

test.describe('American Checkers - Visual Validation', () => {

  test('01-initial-game-state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');

    // Wait a moment for rendering
    await page.waitForTimeout(500);

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/screenshots/01-initial-game-state.png',
      fullPage: true
    });

    // Create checklist
    const checklist = `Visual Checklist - Initial Game State
========================================
[ ] 8x8 checkerboard visible with alternating light/dark squares
[ ] Dark squares are brown/tan colored
[ ] Light squares are beige/cream colored
[ ] 12 red pieces visible on bottom three rows (dark squares only)
[ ] 12 black pieces visible on top three rows (dark squares only)
[ ] Red pieces are circular with dark red color
[ ] Black pieces are circular with dark gray/black color
[ ] Each piece has a subtle shadow effect
[ ] Each piece has an inner highlight/shine
[ ] Header shows "American Checkers" title
[ ] Turn indicator shows "Red's Turn"
[ ] Red player panel visible with "Captured: 0"
[ ] Black player panel visible with "Captured: 0"
[ ] "New Game" button visible
[ ] No game over modal visible
[ ] Canvas is 512x512 pixels
`;
    require('fs').writeFileSync('test-results/screenshots/01-initial-game-state.checklist.txt', checklist);
  });

  test('02-piece-selection-with-highlights', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');

    // Click on red piece at (1,2) game coords = screen (96, 352)
    await canvas.click({ position: { x: 96, y: 352 } });
    await page.waitForTimeout(200);

    await page.screenshot({
      path: 'test-results/screenshots/02-piece-selection-with-highlights.png',
      fullPage: true
    });

    const checklist = `Visual Checklist - Piece Selection with Highlights
===================================================
[ ] Selected piece's square has yellow highlight overlay
[ ] Valid move squares show green highlight overlay
[ ] Two green highlighted squares visible (diagonal moves forward)
[ ] Unselected pieces remain normal (no highlight)
[ ] Board layout unchanged except for highlights
[ ] Turn indicator still shows "Red's Turn"
[ ] All pieces still in starting positions
`;
    require('fs').writeFileSync('test-results/screenshots/02-piece-selection-with-highlights.checklist.txt', checklist);
  });

  test('03-after-first-move', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');

    // Make move using drag: (1,2) -> (0,3)
    await dragMove(page, canvas, 96, 352, 32, 288);

    // Wait for AI to respond
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/screenshots/03-after-first-move.png',
      fullPage: true
    });

    const checklist = `Visual Checklist - After First Move (with AI Response)
======================================================
[ ] Red piece now at position (0,3) - moved forward-left
[ ] Original position (1,2) is now empty dark square
[ ] AI (Black) has made a move in response
[ ] Turn indicator shows "Red's Turn" (after AI move)
[ ] All pieces visible (no captures yet expected)
[ ] Captured counts remain at 0 for both players
`;
    require('fs').writeFileSync('test-results/screenshots/03-after-first-move.checklist.txt', checklist);
  });

  test('04-multiple-turns-with-ai', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');

    // Red move first using drag
    await dragMove(page, canvas, 96, 352, 32, 288);

    // Wait for AI to respond
    await page.waitForTimeout(1000);

    // Make another red move
    await dragMove(page, canvas, 224, 352, 160, 288);

    // Wait for AI to respond
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/screenshots/04-multiple-turns.png',
      fullPage: true
    });

    const checklist = `Visual Checklist - Multiple Turns with AI
==========================================
[ ] Red has made 2 moves
[ ] AI (Black) has responded to each move
[ ] Turn indicator shows "Red's Turn"
[ ] Board shows pieces in new positions
[ ] Game is still in progress (no winner yet)
`;
    require('fs').writeFileSync('test-results/screenshots/04-multiple-turns.checklist.txt', checklist);
  });

  test('05-game-in-progress', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');

    // Make several moves using drag-and-drop, letting AI respond each time
    // Red: (1,2) -> (0,3)
    await dragMove(page, canvas, 96, 352, 32, 288);
    await page.waitForTimeout(1000);

    // Red: (3,2) -> (2,3)
    await dragMove(page, canvas, 224, 352, 160, 288);
    await page.waitForTimeout(1000);

    // Red: (5,2) -> (4,3)
    await dragMove(page, canvas, 352, 352, 288, 288);
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/screenshots/05-game-in-progress.png',
      fullPage: true
    });

    const checklist = `Visual Checklist - Game in Progress
=====================================
[ ] Multiple moves have been made by both players
[ ] Pieces are in non-starting positions
[ ] Board still renders correctly with all pieces visible
[ ] Turn indicator shows "Red's Turn"
[ ] AI has responded to each player move
[ ] Game continues without errors
`;
    require('fs').writeFileSync('test-results/screenshots/05-game-in-progress.checklist.txt', checklist);
  });

  test('06-new-game-reset', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const canvas = page.locator('#game-canvas');

    // Make a move using drag
    await dragMove(page, canvas, 96, 352, 32, 288);
    await page.waitForTimeout(1000);

    // Click New Game
    await page.locator('#new-game-btn').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'test-results/screenshots/06-new-game-reset.png',
      fullPage: true
    });

    const checklist = `Visual Checklist - New Game Reset
===================================
[ ] All pieces back in starting positions
[ ] 12 red pieces on bottom three rows
[ ] 12 black pieces on top three rows
[ ] Turn indicator shows "Red's Turn"
[ ] Captured counts reset to 0 for both players
[ ] No highlighted squares visible
[ ] Game over modal hidden (if was showing)
`;
    require('fs').writeFileSync('test-results/screenshots/06-new-game-reset.checklist.txt', checklist);
  });

});
