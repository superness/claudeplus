const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');

// Ensure screenshot directory exists
test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
});

test.describe('Cosmic Tic-Tac-Toe Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8765');
        await page.waitForLoadState('networkidle');
        // Wait for background canvas to be ready
        await page.waitForSelector('#backgroundCanvas');
        // Allow time for animations to initialize
        await page.waitForTimeout(1000);
    });

    test('01 - Title screen renders correctly', async ({ page }) => {
        // Verify title screen is visible
        const titleScreen = page.locator('#titleScreen');
        await expect(titleScreen).toBeVisible();

        // Verify cosmic title elements
        await expect(page.locator('.title-main')).toHaveText('COSMIC');
        await expect(page.locator('.title-sub')).toHaveText('TIC-TAC-TOE');
        await expect(page.locator('.title-subtitle')).toHaveText('THE ETERNAL GRID');

        // Verify faction selection buttons
        await expect(page.locator('#selectOrbis')).toBeVisible();
        await expect(page.locator('#selectCrucia')).toBeVisible();

        // Verify AI selection buttons
        const aiButtons = page.locator('.ai-btn');
        await expect(aiButtons).toHaveCount(5);

        // Verify start button
        await expect(page.locator('#startGame')).toBeVisible();
        await expect(page.locator('#startGame')).toHaveText('BEGIN THE RITUAL');

        // Capture screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '01-title-screen.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '01-title-screen.checklist.txt'),
            `Visual Validation Checklist for 01-title-screen.png:
- [ ] Cosmic background with stars visible
- [ ] Nebula gradients (blue and purple) visible in background
- [ ] "COSMIC" title with gradient text (blue to pink)
- [ ] "TIC-TAC-TOE" subtitle visible
- [ ] "THE ETERNAL GRID" tagline visible
- [ ] Floating animation on title
- [ ] Two faction buttons: ORBIS (O) in blue and CRUCIA (X) in red/pink
- [ ] Five AI difficulty buttons visible
- [ ] "BEGIN THE RITUAL" button at bottom
- [ ] Dark space-themed overall aesthetic
`);
    });

    test('02 - Faction selection works', async ({ page }) => {
        // Select Orbis faction
        await page.click('#selectOrbis');
        await page.waitForTimeout(300);

        // Verify Orbis is selected
        const orbisBtn = page.locator('#selectOrbis');
        await expect(orbisBtn).toHaveClass(/selected/);

        // Capture screenshot of Orbis selected
        await page.screenshot({
            path: path.join(screenshotDir, '02a-orbis-selected.png'),
            fullPage: true
        });

        // Select Crucia faction
        await page.click('#selectCrucia');
        await page.waitForTimeout(300);

        // Verify Crucia is selected and Orbis is deselected
        const cruciaBtn = page.locator('#selectCrucia');
        await expect(cruciaBtn).toHaveClass(/selected/);
        await expect(orbisBtn).not.toHaveClass(/selected/);

        // Capture screenshot of Crucia selected
        await page.screenshot({
            path: path.join(screenshotDir, '02b-crucia-selected.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '02-faction-selection.checklist.txt'),
            `Visual Validation Checklist for faction selection:
02a-orbis-selected.png:
- [ ] Orbis button has glowing blue border
- [ ] Orbis button is scaled up (1.05x)
- [ ] Blue glow effect around Orbis button
- [ ] Crucia button remains unselected

02b-crucia-selected.png:
- [ ] Crucia button has glowing red/pink border
- [ ] Crucia button is scaled up (1.05x)
- [ ] Red/pink glow effect around Crucia button
- [ ] Orbis button is now deselected
`);
    });

    test('03 - AI difficulty selection works', async ({ page }) => {
        // Select different AI difficulties
        const difficulties = ['novice', 'acolyte', 'walker', 'adept', 'eternal'];

        for (const difficulty of difficulties) {
            await page.click(`[data-ai="${difficulty}"]`);
            await page.waitForTimeout(200);

            const btn = page.locator(`[data-ai="${difficulty}"]`);
            await expect(btn).toHaveClass(/selected/);
        }

        // Capture screenshot with Eternal selected (hardest AI)
        await page.screenshot({
            path: path.join(screenshotDir, '03-ai-eternal-selected.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '03-ai-selection.checklist.txt'),
            `Visual Validation Checklist for 03-ai-eternal-selected.png:
- [ ] "The Eternal" AI button is highlighted with gold border
- [ ] Gold glow effect around selected AI button
- [ ] Background becomes slightly golden on selected button
- [ ] All 5 AI buttons visible: Void Novice, Echoing Acolyte, Grid Walker, Force Adept, The Eternal
- [ ] Each button shows difficulty name and win rate
`);
    });

    test('04 - Game screen displays correctly', async ({ page }) => {
        // Select faction and AI
        await page.click('#selectOrbis');
        await page.click('[data-ai="walker"]');
        await page.waitForTimeout(300);

        // Start game
        await page.click('#startGame');
        await page.waitForTimeout(500);

        // Verify game screen is visible
        const gameScreen = page.locator('#gameScreen');
        await expect(gameScreen).toBeVisible();

        // Verify game canvas is present
        const gameCanvas = page.locator('#gameCanvas');
        await expect(gameCanvas).toBeVisible();

        // Verify turn indicator
        await expect(page.locator('#turnIndicator')).toBeVisible();

        // Verify resource display
        await expect(page.locator('#essenceCount')).toBeVisible();
        await expect(page.locator('#orbsCount')).toBeVisible();

        // Wait for game to fully render
        await page.waitForTimeout(500);

        // Capture screenshot
        await page.screenshot({
            path: path.join(screenshotDir, '04-game-screen-initial.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '04-game-screen.checklist.txt'),
            `Visual Validation Checklist for 04-game-screen-initial.png:
- [ ] 3x3 grid is visible with purple/blue glow lines
- [ ] Grid cells are empty initially
- [ ] Player info shows O (ORBIS) on left, X (CRUCIA) on right
- [ ] Turn indicator shows "YOUR TURN" or "OPPONENT'S TURN"
- [ ] Score display (0 - 0) visible
- [ ] Resource display at bottom: Cosmic Essence, Orbs, Shards
- [ ] "NEW MATCH" and "MENU" buttons visible
- [ ] Starfield background still visible
- [ ] Grid has subtle border glow
`);
    });

    test('05 - Player can make moves', async ({ page }) => {
        // Start game
        await page.click('#selectOrbis');
        await page.click('[data-ai="novice"]'); // Use easiest AI
        await page.click('#startGame');
        await page.waitForTimeout(500);

        // Get game canvas bounds
        const canvas = page.locator('#gameCanvas');
        const box = await canvas.boundingBox();

        // Calculate cell centers (3x3 grid)
        const cellWidth = box.width / 3;
        const cellHeight = box.height / 3;

        // Click center cell (cell 4)
        await page.mouse.click(
            box.x + cellWidth * 1.5,
            box.y + cellHeight * 1.5
        );

        // Wait for move animation
        await page.waitForTimeout(1500);

        // Capture screenshot after player move
        await page.screenshot({
            path: path.join(screenshotDir, '05a-player-move.png'),
            fullPage: true
        });

        // Wait for AI move
        await page.waitForTimeout(1500);

        // Capture screenshot after AI move
        await page.screenshot({
            path: path.join(screenshotDir, '05b-after-ai-move.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '05-gameplay.checklist.txt'),
            `Visual Validation Checklist for gameplay:
05a-player-move.png:
- [ ] O symbol placed in center cell
- [ ] O has blue/cyan glow effect
- [ ] O has orbital ring particle effects
- [ ] Corona particles around O symbol
- [ ] Symbol has scale-in animation (may be fully scaled)
- [ ] Turn indicator changes

05b-after-ai-move.png:
- [ ] X symbol now visible in another cell
- [ ] X has red/pink glow effect
- [ ] X has spark effects at corners
- [ ] Two symbols now on board (O and X)
- [ ] Turn indicator updates appropriately
- [ ] Background particle effects may be visible
`);
    });

    test('06 - Game victory scenario', async ({ page }) => {
        // Start game with easiest AI
        await page.click('#selectOrbis');
        await page.click('[data-ai="novice"]');
        await page.click('#startGame');
        await page.waitForTimeout(500);

        const canvas = page.locator('#gameCanvas');
        const box = await canvas.boundingBox();
        const cellWidth = box.width / 3;
        const cellHeight = box.height / 3;

        // Try to win - place moves strategically
        // This may not always result in a win since AI makes random moves
        // Play multiple games to capture various states

        const moves = [
            [0.5, 0.5],   // Cell 0 (top-left)
            [1.5, 0.5],   // Cell 1 (top-middle)
            [0.5, 1.5],   // Cell 3 (middle-left)
            [0.5, 2.5],   // Cell 6 (bottom-left) - for vertical win
        ];

        for (const [col, row] of moves) {
            await page.mouse.click(
                box.x + cellWidth * col,
                box.y + cellHeight * row
            );
            await page.waitForTimeout(1500); // Wait for AI
        }

        // Capture current game state
        await page.screenshot({
            path: path.join(screenshotDir, '06-gameplay-in-progress.png'),
            fullPage: true
        });

        // Check if result overlay appeared
        const resultOverlay = page.locator('#resultOverlay');
        if (await resultOverlay.isVisible()) {
            await page.screenshot({
                path: path.join(screenshotDir, '06b-game-result.png'),
                fullPage: true
            });
        }

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '06-game-progression.checklist.txt'),
            `Visual Validation Checklist for game progression:
06-gameplay-in-progress.png:
- [ ] Multiple symbols visible on board
- [ ] Each symbol has appropriate coloring (O=blue, X=red)
- [ ] Symbol placement animations have completed
- [ ] Grid remains visible and clear
- [ ] Game state is coherent

06b-game-result.png (if game ended):
- [ ] Result overlay appears with dark background
- [ ] Title shows "VICTORY", "DEFEAT", or "EQUILIBRIUM"
- [ ] Victory text has gold/blue gradient
- [ ] Defeat text has red glow
- [ ] Draw text has blue-to-red gradient
- [ ] Reward display shows essence and faction currency
- [ ] "PLAY AGAIN" button visible
- [ ] Particle effects in background (victory cascade or defeat effect)
`);
    });

    test('07 - Victory visual effects', async ({ page }) => {
        // Configure to play against easiest AI
        await page.click('#selectOrbis');
        await page.click('[data-ai="novice"]');
        await page.click('#startGame');
        await page.waitForTimeout(500);

        // Play until game ends (max 9 turns)
        const canvas = page.locator('#gameCanvas');
        const box = await canvas.boundingBox();
        const cellWidth = box.width / 3;
        const cellHeight = box.height / 3;

        // All cell positions
        const allCells = [
            [0.5, 0.5], [1.5, 0.5], [2.5, 0.5],
            [0.5, 1.5], [1.5, 1.5], [2.5, 1.5],
            [0.5, 2.5], [1.5, 2.5], [2.5, 2.5]
        ];

        let gameOver = false;
        let moveCount = 0;

        for (const [col, row] of allCells) {
            if (gameOver) break;

            await page.mouse.click(
                box.x + cellWidth * col,
                box.y + cellHeight * row
            );

            await page.waitForTimeout(1500);
            moveCount++;

            // Check if game ended
            const resultOverlay = page.locator('#resultOverlay');
            if (await resultOverlay.isVisible()) {
                gameOver = true;

                // Wait for victory/defeat animation
                await page.waitForTimeout(500);

                await page.screenshot({
                    path: path.join(screenshotDir, '07-game-end-result.png'),
                    fullPage: true
                });
            }
        }

        if (!gameOver) {
            // Capture final state if no clear result
            await page.screenshot({
                path: path.join(screenshotDir, '07-game-end-state.png'),
                fullPage: true
            });
        }

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '07-game-end.checklist.txt'),
            `Visual Validation Checklist for game end:
07-game-end-result.png or 07-game-end-state.png:
- [ ] Game reached a conclusion (win/lose/draw)
- [ ] If victory: Triumphant particle cascade visible
- [ ] If victory: Gold and blue particles spreading
- [ ] If defeat: Red collapsing particle effect
- [ ] If draw: Dual-colored spiral particle effect
- [ ] Result title properly styled with glow
- [ ] Reward amounts displayed correctly
- [ ] Score updated in header
`);
    });

    test('08 - Hover effects on cells', async ({ page }) => {
        // Start game
        await page.click('#selectOrbis');
        await page.click('[data-ai="walker"]');
        await page.click('#startGame');
        await page.waitForTimeout(500);

        const canvas = page.locator('#gameCanvas');
        const box = await canvas.boundingBox();
        const cellWidth = box.width / 3;
        const cellHeight = box.height / 3;

        // Hover over center cell
        await page.mouse.move(
            box.x + cellWidth * 1.5,
            box.y + cellHeight * 1.5
        );

        await page.waitForTimeout(300);

        // Capture hover state
        await page.screenshot({
            path: path.join(screenshotDir, '08-cell-hover.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '08-hover-effects.checklist.txt'),
            `Visual Validation Checklist for 08-cell-hover.png:
- [ ] Hovered cell shows preview of player symbol (semi-transparent O)
- [ ] Cell has subtle glow effect
- [ ] Pulsing animation on hover indicator
- [ ] Symbol preview matches player's faction color (blue for Orbis)
- [ ] Cursor is pointer over canvas
`);
    });

    test('09 - New game resets board', async ({ page }) => {
        // Start and play a game
        await page.click('#selectOrbis');
        await page.click('[data-ai="novice"]');
        await page.click('#startGame');
        await page.waitForTimeout(500);

        const canvas = page.locator('#gameCanvas');
        const box = await canvas.boundingBox();
        const cellWidth = box.width / 3;
        const cellHeight = box.height / 3;

        // Make a move
        await page.mouse.click(
            box.x + cellWidth * 1.5,
            box.y + cellHeight * 1.5
        );
        await page.waitForTimeout(1500);

        // Click new game
        await page.click('#newGameBtn');
        await page.waitForTimeout(500);

        // Capture reset state
        await page.screenshot({
            path: path.join(screenshotDir, '09-new-game-reset.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '09-new-game.checklist.txt'),
            `Visual Validation Checklist for 09-new-game-reset.png:
- [ ] Board is completely empty (no symbols)
- [ ] Turn indicator shows appropriate turn
- [ ] Score is preserved from previous games
- [ ] Resources are preserved
- [ ] Grid is clean and ready for new game
`);
    });

    test('10 - Return to menu', async ({ page }) => {
        // Start game
        await page.click('#selectOrbis');
        await page.click('[data-ai="walker"]');
        await page.click('#startGame');
        await page.waitForTimeout(500);

        // Return to menu
        await page.click('#backToMenu');
        await page.waitForTimeout(500);

        // Verify title screen is visible again
        const titleScreen = page.locator('#titleScreen');
        await expect(titleScreen).toBeVisible();

        // Capture menu return
        await page.screenshot({
            path: path.join(screenshotDir, '10-back-to-menu.png'),
            fullPage: true
        });

        // Write checklist
        fs.writeFileSync(path.join(screenshotDir, '10-menu-return.checklist.txt'),
            `Visual Validation Checklist for 10-back-to-menu.png:
- [ ] Title screen is visible again
- [ ] All menu elements present
- [ ] Previous selections may be remembered
- [ ] Game transitions smoothly back to menu
`);
    });
});
