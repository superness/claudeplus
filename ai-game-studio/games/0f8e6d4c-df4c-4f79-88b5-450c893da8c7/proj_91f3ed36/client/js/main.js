/**
 * Cosmic Tic-Tac-Toe - Main Application
 * Entry point and game orchestration
 */

class App {
    constructor() {
        // Canvas elements
        this.backgroundCanvas = document.getElementById('backgroundCanvas');
        this.gameCanvas = document.getElementById('gameCanvas');

        // Initialize systems
        this.particles = new ParticleSystem(this.backgroundCanvas);
        this.audio = new AudioSystem();
        this.game = new CosmicTicTacToe(this.gameCanvas);

        // Player data
        this.playerData = {
            essence: 0,
            orbs: 0,
            shards: 0,
            playerScore: 0,
            aiScore: 0,
            faction: 'orbis',
            difficulty: 'walker'
        };

        // UI elements
        this.screens = {
            title: document.getElementById('titleScreen'),
            game: document.getElementById('gameScreen'),
            result: document.getElementById('resultOverlay')
        };

        // Animation
        this.lastTime = 0;
        this.running = true;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.resizeCanvases();
        this.loadPlayerData();

        // Set up game callbacks
        this.game.onMove = (cell, symbol) => this.onMove(cell, symbol);
        this.game.onGameEnd = (result) => this.onGameEnd(result);

        // Start animation loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvases());

        // Faction selection
        document.getElementById('selectOrbis').addEventListener('click', () => {
            this.selectFaction('orbis');
            this.audio.playClick();
        });

        document.getElementById('selectCrucia').addEventListener('click', () => {
            this.selectFaction('crucia');
            this.audio.playClick();
        });

        // AI selection
        document.querySelectorAll('.ai-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectAI(btn.dataset.ai);
                this.audio.playClick();
            });
        });

        // Start game button
        document.getElementById('startGame').addEventListener('click', () => {
            this.startGame();
            this.audio.playGameStart();
        });

        // Game canvas events
        this.gameCanvas.addEventListener('mousemove', (e) => {
            const rect = this.gameCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.game.handleMouseMove(x, y);
        });

        this.gameCanvas.addEventListener('click', (e) => {
            const rect = this.gameCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.game.handleClick(x, y)) {
                this.audio.playPlacement(this.game.playerSymbol);
            }
        });

        // New game button
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.newGame();
            this.audio.playClick();
        });

        // Back to menu button
        document.getElementById('backToMenu').addEventListener('click', () => {
            this.showScreen('title');
            this.audio.playClick();
        });

        // Play again button
        document.getElementById('playAgain').addEventListener('click', () => {
            this.screens.result.classList.remove('active');
            this.newGame();
            this.audio.playClick();
        });

        // Initialize audio on first interaction
        document.addEventListener('click', () => {
            this.audio.init();
        }, { once: true });
    }

    resizeCanvases() {
        // Background canvas
        this.backgroundCanvas.width = window.innerWidth;
        this.backgroundCanvas.height = window.innerHeight;
        this.particles.resize(window.innerWidth, window.innerHeight);

        // Game canvas
        this.game.resize();
    }

    selectFaction(faction) {
        // Update UI
        document.querySelectorAll('.faction-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        const selectedBtn = faction === 'orbis'
            ? document.getElementById('selectOrbis')
            : document.getElementById('selectCrucia');
        selectedBtn.classList.add('selected');

        // Update player data
        this.playerData.faction = faction;
        this.game.setPlayerFaction(faction);
    }

    selectAI(difficulty) {
        // Update UI
        document.querySelectorAll('.ai-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        event.currentTarget.classList.add('selected');

        // Update player data
        this.playerData.difficulty = difficulty;
        this.game.setAIDifficulty(difficulty);
    }

    startGame() {
        // Ensure a faction is selected
        if (!document.querySelector('.faction-btn.selected')) {
            this.selectFaction('orbis');
        }

        // Ensure an AI is selected
        if (!document.querySelector('.ai-btn.selected')) {
            this.selectAI('walker');
        }

        this.showScreen('game');
        this.newGame();
    }

    newGame() {
        this.game.reset();
        this.updateTurnIndicator();
        this.particles.clear();
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        this.screens[screenName].classList.add('active');
    }

    // Called when a move is made
    onMove(cell, symbol) {
        const center = this.game.getCellCenter(cell);

        // Create spectacular particle effect
        this.particles.symbolPlacement(
            this.backgroundCanvas.width / 2 + (center.x - this.game.canvas.width / 2),
            this.backgroundCanvas.height / 2 + (center.y - this.game.canvas.height / 2),
            symbol
        );

        // Play AI sound if AI moved
        if (symbol === this.game.aiSymbol) {
            setTimeout(() => {
                this.audio.playPlacement(symbol);
            }, 100);
        }

        this.updateTurnIndicator();
    }

    // Called when game ends
    onGameEnd(result) {
        const centerX = this.backgroundCanvas.width / 2;
        const centerY = this.backgroundCanvas.height / 2;

        if (result.type === 'draw') {
            // Draw - stalemate storm
            setTimeout(() => {
                this.particles.stalemateTempest(centerX, centerY);
                this.audio.playDraw();
            }, 300);

            // Update score
            this.addRewards(75, 10);

            // Show result after delay
            setTimeout(() => this.showResult('draw'), 2000);

        } else {
            const isPlayerWin = result.winner === this.game.playerSymbol;

            if (isPlayerWin) {
                // Victory cascade
                const cells = result.line.map(i => {
                    const center = this.game.getCellCenter(i);
                    return {
                        x: centerX + (center.x - this.game.canvas.width / 2),
                        y: centerY + (center.y - this.game.canvas.height / 2)
                    };
                });

                setTimeout(() => {
                    this.particles.victoryCascade(cells, result.winner);
                    this.audio.playVictory();
                }, 300);

                // Update score
                this.playerData.playerScore++;
                this.addRewards(100, 20);

                setTimeout(() => this.showResult('victory'), 2500);

            } else {
                // Defeat
                setTimeout(() => {
                    this.particles.defeatEffect(centerX, centerY);
                    this.audio.playDefeat();
                }, 300);

                // Update score
                this.playerData.aiScore++;
                this.addRewards(50, 5);

                setTimeout(() => this.showResult('defeat'), 2000);
            }
        }

        this.updateScoreDisplay();
    }

    addRewards(essence, factionCurrency) {
        // Apply difficulty multiplier
        const multiplier = AI_TIERS[this.playerData.difficulty].rewardMultiplier;
        const finalEssence = Math.floor(essence * multiplier);
        const finalFaction = Math.floor(factionCurrency * multiplier);

        this.playerData.essence += finalEssence;

        if (this.playerData.faction === 'orbis') {
            this.playerData.orbs += finalFaction;
        } else {
            this.playerData.shards += finalFaction;
        }

        this.updateResourceDisplay();
        this.savePlayerData();
    }

    showResult(type) {
        const titleEl = document.getElementById('resultTitle');
        const subtitleEl = document.getElementById('resultSubtitle');
        const essenceEl = document.getElementById('rewardEssence');
        const factionEl = document.getElementById('rewardFaction');
        const factionNameEl = document.getElementById('rewardFactionName');

        // Remove previous classes
        titleEl.classList.remove('victory', 'defeat', 'draw');

        const multiplier = AI_TIERS[this.playerData.difficulty].rewardMultiplier;

        if (type === 'victory') {
            titleEl.textContent = 'VICTORY';
            titleEl.classList.add('victory');
            subtitleEl.textContent = 'The cosmic forces bow to your mastery';
            essenceEl.textContent = '+' + Math.floor(100 * multiplier);
            factionEl.textContent = '+' + Math.floor(20 * multiplier);
        } else if (type === 'defeat') {
            titleEl.textContent = 'DEFEAT';
            titleEl.classList.add('defeat');
            subtitleEl.textContent = 'The void claims this battle, but not the war';
            essenceEl.textContent = '+' + Math.floor(50 * multiplier);
            factionEl.textContent = '+' + Math.floor(5 * multiplier);
        } else {
            titleEl.textContent = 'EQUILIBRIUM';
            titleEl.classList.add('draw');
            subtitleEl.textContent = 'Perfect balance in the cosmic dance';
            essenceEl.textContent = '+' + Math.floor(75 * multiplier);
            factionEl.textContent = '+' + Math.floor(10 * multiplier);
        }

        factionNameEl.textContent = this.playerData.faction === 'orbis' ? 'Orbs' : 'Shards';

        this.screens.result.classList.add('active');
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        const isPlayerTurn = this.game.currentTurn === this.game.playerSymbol;

        if (this.game.gameOver) {
            indicator.textContent = 'MATCH COMPLETE';
        } else {
            indicator.textContent = isPlayerTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN';
        }
    }

    updateScoreDisplay() {
        document.getElementById('playerScore').textContent = this.playerData.playerScore;
        document.getElementById('aiScore').textContent = this.playerData.aiScore;
    }

    updateResourceDisplay() {
        document.getElementById('essenceCount').textContent = this.playerData.essence;
        document.getElementById('orbsCount').textContent = this.playerData.orbs;
        document.getElementById('shardsCount').textContent = this.playerData.shards;
    }

    loadPlayerData() {
        const saved = localStorage.getItem('cosmicTicTacToe');
        if (saved) {
            const data = JSON.parse(saved);
            this.playerData = { ...this.playerData, ...data };
        }
        this.updateResourceDisplay();
        this.updateScoreDisplay();
    }

    savePlayerData() {
        localStorage.setItem('cosmicTicTacToe', JSON.stringify(this.playerData));
    }

    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update systems
        this.particles.update();
        this.game.update(deltaTime);

        // Render
        this.particles.draw();
        this.game.render();

        // Continue loop
        if (this.running) {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
