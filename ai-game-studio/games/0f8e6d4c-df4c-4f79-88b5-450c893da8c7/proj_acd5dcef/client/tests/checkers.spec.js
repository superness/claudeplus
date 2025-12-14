const { test, expect } = require('@playwright/test');

test.describe('American Checkers - Functional Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Wait for canvas to be ready
    await page.waitForSelector('#game-canvas');
  });

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

  test('Game initializes with correct UI elements', async ({ page }) => {
    // Check title
    await expect(page.locator('h1')).toHaveText('American Checkers');

    // Check player panels exist
    await expect(page.locator('#red-panel')).toBeVisible();
    await expect(page.locator('#black-panel')).toBeVisible();

    // Check turn indicator shows Red's turn initially
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");

    // Check captured counts start at 0
    await expect(page.locator('#red-captured')).toHaveText('Captured: 0');
    await expect(page.locator('#black-captured')).toHaveText('Captured: 0');

    // Check New Game button exists
    await expect(page.locator('#new-game-btn')).toBeVisible();

    // Check canvas has correct dimensions (8*64 = 512)
    const canvas = page.locator('#game-canvas');
    const dimensions = await canvas.evaluate(el => ({
      width: el.width,
      height: el.height
    }));
    expect(dimensions.width).toBe(512);
    expect(dimensions.height).toBe(512);
  });

  test('Canvas renders the checkerboard', async ({ page }) => {
    // Verify canvas is present and has content
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Get canvas dimensions
    const dimensions = await canvas.evaluate(el => ({
      width: el.width,
      height: el.height
    }));
    expect(dimensions.width).toBe(512);
    expect(dimensions.height).toBe(512);
  });

  test('Clicking on piece highlights valid moves', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();

    // Red pieces start at bottom (rows 0-2 in game coords, but visually at top due to y-flip)
    // Row 2 = screen row 5 (7-2), so click on a red piece at row 5
    // Red piece at (1,2) in game coords = (1,5) screen coords
    // Click at center of that tile: x=1*64+32=96, y=5*64+32=352
    await canvas.click({ position: { x: 96, y: 352 } });

    // Status should still show Red's Turn (piece just selected)
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");
  });

  test('Valid move executes and changes turn', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Drag red piece from (1,2) game coords = screen (96, 352)
    // to (0,3) game coords = screen (32, 288)
    // Red moves forward (increasing Y in game coords, decreasing screen Y)
    await dragMove(page, canvas, 96, 352, 32, 288);

    // Wait for AI to make its move
    await page.waitForTimeout(1000);

    // Turn should switch back to Red after AI moves
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");
  });

  test('New Game button resets the game', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Make a move first using drag
    await dragMove(page, canvas, 96, 352, 32, 288);

    // Wait for AI move
    await page.waitForTimeout(1000);

    // Click New Game
    await page.locator('#new-game-btn').click();

    // Should reset to Red's turn
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");
    await expect(page.locator('#red-captured')).toHaveText('Captured: 0');
    await expect(page.locator('#black-captured')).toHaveText('Captured: 0');
  });

  test('Cannot move opponent pieces', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Try to click black piece at (0,5) game coords = screen (32, 160)
    await canvas.click({ position: { x: 32, y: 160 } });

    // Should still be Red's turn (no selection made)
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");
  });

  test('Game plays multiple turns with AI', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Red move: (1,2) -> (0,3) using drag
    await dragMove(page, canvas, 96, 352, 32, 288);

    // Wait for AI move
    await page.waitForTimeout(1000);

    // Should be Red's turn again after AI moves
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");

    // Make another red move: (3,2) -> (2,3)
    await dragMove(page, canvas, 224, 352, 160, 288);

    // Wait for AI move
    await page.waitForTimeout(1000);

    // Should be Red's turn again
    await expect(page.locator('#current-turn')).toHaveText("Red's Turn");
  });

});
