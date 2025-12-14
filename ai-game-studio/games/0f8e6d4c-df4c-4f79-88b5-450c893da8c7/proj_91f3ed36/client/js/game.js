/**
 * Cosmic Tic-Tac-Toe - Core Game Engine
 * Handles game state, rendering, and spectacular visual effects
 */

class CosmicTicTacToe {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Game state
        this.board = Array(9).fill(null);
        this.playerSymbol = 'O';
        this.aiSymbol = 'X';
        this.currentTurn = 'X'; // X always goes first
        this.gameOver = false;
        this.winner = null;
        this.winningLine = null;

        // AI
        this.ai = new TicTacToeAI('walker');

        // Visual settings
        this.cellSize = 150;
        this.gridPadding = 50;
        this.gridSize = this.cellSize * 3;

        // Animation state
        this.animations = [];
        this.cellGlow = Array(9).fill(0);
        this.hoveredCell = -1;
        this.symbolAnimations = {};

        // Colors
        this.colors = {
            orbis: {
                primary: '#00d4ff',
                secondary: '#0080ff',
                glow: 'rgba(0, 212, 255, 0.8)'
            },
            crucia: {
                primary: '#ff3366',
                secondary: '#ff6600',
                glow: 'rgba(255, 51, 102, 0.8)'
            },
            grid: '#2a2a4a',
            gridGlow: 'rgba(100, 100, 200, 0.3)',
            void: '#0a0a0f'
        };

        // Resize handling
        this.resize();

        // Event callbacks
        this.onMove = null;
        this.onGameEnd = null;
    }

    resize() {
        // Make canvas responsive
        const containerWidth = Math.min(window.innerWidth - 40, 600);
        this.cellSize = Math.floor(containerWidth / 3.5);
        this.gridPadding = this.cellSize * 0.3;
        this.gridSize = this.cellSize * 3;

        this.canvas.width = this.gridSize + this.gridPadding * 2;
        this.canvas.height = this.gridSize + this.gridPadding * 2;
    }

    // Get cell position from pixel coordinates
    getCellFromPoint(x, y) {
        const gridX = x - this.gridPadding;
        const gridY = y - this.gridPadding;

        if (gridX < 0 || gridX > this.gridSize || gridY < 0 || gridY > this.gridSize) {
            return -1;
        }

        const col = Math.floor(gridX / this.cellSize);
        const row = Math.floor(gridY / this.cellSize);

        return row * 3 + col;
    }

    // Get cell center coordinates
    getCellCenter(index) {
        const row = Math.floor(index / 3);
        const col = index % 3;

        return {
            x: this.gridPadding + col * this.cellSize + this.cellSize / 2,
            y: this.gridPadding + row * this.cellSize + this.cellSize / 2
        };
    }

    // Handle mouse move for hover effects
    handleMouseMove(x, y) {
        const cell = this.getCellFromPoint(x, y);

        if (cell !== this.hoveredCell) {
            this.hoveredCell = cell;

            if (cell >= 0 && this.board[cell] === null && !this.gameOver) {
                this.cellGlow[cell] = 0.5;
            }
        }
    }

    // Handle click to make a move
    handleClick(x, y) {
        if (this.gameOver) return false;
        if (this.currentTurn !== this.playerSymbol) return false;

        const cell = this.getCellFromPoint(x, y);

        if (cell >= 0 && this.board[cell] === null) {
            this.makeMove(cell, this.playerSymbol);
            return true;
        }

        return false;
    }

    // Make a move
    makeMove(cell, symbol) {
        if (this.board[cell] !== null || this.gameOver) return false;

        this.board[cell] = symbol;

        // Start symbol animation
        this.symbolAnimations[cell] = {
            scale: 0,
            alpha: 0,
            rotation: symbol === 'O' ? 0 : Math.PI * 2
        };

        // Trigger callback
        if (this.onMove) {
            this.onMove(cell, symbol);
        }

        // Check for winner
        const result = this.checkGameEnd();

        if (result) {
            this.gameOver = true;
            this.winner = result.winner;
            this.winningLine = result.line;

            if (this.onGameEnd) {
                this.onGameEnd(result);
            }
        } else {
            // Switch turns
            this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';

            // AI move if it's AI's turn
            if (this.currentTurn === this.aiSymbol) {
                setTimeout(() => this.aiMove(), 800);
            }
        }

        return true;
    }

    // AI makes a move
    aiMove() {
        if (this.gameOver) return;

        const move = this.ai.getMove(this.board);
        if (move !== null) {
            this.makeMove(move, this.aiSymbol);
        }
    }

    // Check for game end
    checkGameEnd() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return {
                    winner: this.board[a],
                    line: line,
                    type: 'win'
                };
            }
        }

        // Check for draw
        if (this.board.every(cell => cell !== null)) {
            return {
                winner: null,
                line: null,
                type: 'draw'
            };
        }

        return null;
    }

    // Reset game
    reset() {
        this.board = Array(9).fill(null);
        this.currentTurn = 'X';
        this.gameOver = false;
        this.winner = null;
        this.winningLine = null;
        this.symbolAnimations = {};
        this.cellGlow = Array(9).fill(0);

        // If AI is X, it goes first
        if (this.aiSymbol === 'X') {
            setTimeout(() => this.aiMove(), 500);
        }
    }

    // Set player faction
    setPlayerFaction(faction) {
        if (faction === 'orbis') {
            this.playerSymbol = 'O';
            this.aiSymbol = 'X';
        } else {
            this.playerSymbol = 'X';
            this.aiSymbol = 'O';
        }
        this.ai.setSymbol(this.aiSymbol);
    }

    // Set AI difficulty
    setAIDifficulty(difficulty) {
        this.ai.setDifficulty(difficulty);
    }

    // Update animations
    update(deltaTime) {
        // Update symbol animations
        for (const cell in this.symbolAnimations) {
            const anim = this.symbolAnimations[cell];
            anim.scale = Math.min(1, anim.scale + deltaTime * 4);
            anim.alpha = Math.min(1, anim.alpha + deltaTime * 3);

            const symbol = this.board[cell];
            if (symbol === 'O') {
                anim.rotation += deltaTime * 0.5;
            } else {
                anim.rotation = Math.max(0, anim.rotation - deltaTime * 8);
            }
        }

        // Update cell glow decay
        for (let i = 0; i < 9; i++) {
            if (i !== this.hoveredCell) {
                this.cellGlow[i] = Math.max(0, this.cellGlow[i] - deltaTime * 2);
            }
        }
    }

    // Render the game
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw cell backgrounds and glow
        for (let i = 0; i < 9; i++) {
            const center = this.getCellCenter(i);
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = this.gridPadding + col * this.cellSize;
            const y = this.gridPadding + row * this.cellSize;

            // Cell background
            if (this.cellGlow[i] > 0) {
                const glowColor = this.playerSymbol === 'O'
                    ? this.colors.orbis.glow
                    : this.colors.crucia.glow;

                ctx.fillStyle = glowColor.replace('0.8', `${this.cellGlow[i] * 0.3}`);
                ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
            }
        }

        // Draw grid lines
        this.drawGrid();

        // Draw symbols
        for (let i = 0; i < 9; i++) {
            if (this.board[i]) {
                this.drawSymbol(i, this.board[i]);
            }
        }

        // Draw winning line
        if (this.winningLine) {
            this.drawWinningLine();
        }

        // Draw hover indicator
        if (this.hoveredCell >= 0 && this.board[this.hoveredCell] === null && !this.gameOver) {
            this.drawHoverIndicator(this.hoveredCell);
        }
    }

    // Draw the grid
    drawGrid() {
        const ctx = this.ctx;
        const padding = this.gridPadding;
        const size = this.gridSize;

        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.colors.gridGlow;
        ctx.shadowBlur = 10;

        // Vertical lines
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(padding + i * this.cellSize, padding);
            ctx.lineTo(padding + i * this.cellSize, padding + size);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(padding, padding + i * this.cellSize);
            ctx.lineTo(padding + size, padding + i * this.cellSize);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    // Draw a symbol
    drawSymbol(index, symbol) {
        const ctx = this.ctx;
        const center = this.getCellCenter(index);
        const anim = this.symbolAnimations[index] || { scale: 1, alpha: 1, rotation: 0 };
        const size = this.cellSize * 0.35 * anim.scale;

        ctx.save();
        ctx.globalAlpha = anim.alpha;
        ctx.translate(center.x, center.y);
        ctx.rotate(anim.rotation);

        if (symbol === 'O') {
            this.drawO(ctx, size);
        } else {
            this.drawX(ctx, size);
        }

        ctx.restore();
    }

    // Draw O symbol with orbital rings
    drawO(ctx, size) {
        const colors = this.colors.orbis;

        // Outer glow
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 30;

        // Main circle
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glow ring
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = size * 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Particle corona effect
        ctx.shadowBlur = 0;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i + Date.now() * 0.001;
            const px = Math.cos(angle) * size * 1.2;
            const py = Math.sin(angle) * size * 1.2;

            ctx.fillStyle = colors.primary;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw X symbol with energy effects
    drawX(ctx, size) {
        const colors = this.colors.crucia;

        // Outer glow
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 30;

        // Main X
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = size * 0.15;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(-size, -size);
        ctx.lineTo(size, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size, -size);
        ctx.lineTo(-size, size);
        ctx.stroke();

        // Inner energy lines
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = size * 0.08;

        ctx.beginPath();
        ctx.moveTo(-size * 0.7, -size * 0.7);
        ctx.lineTo(size * 0.7, size * 0.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.7, -size * 0.7);
        ctx.lineTo(-size * 0.7, size * 0.7);
        ctx.stroke();

        // Spark effects at corners
        ctx.shadowBlur = 0;
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        corners.forEach(([dx, dy]) => {
            const sparkSize = 5 + Math.sin(Date.now() * 0.01 + dx * dy) * 3;
            ctx.fillStyle = colors.primary;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(dx * size * 1.1, dy * size * 1.1, sparkSize, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw hover indicator
    drawHoverIndicator(index) {
        const ctx = this.ctx;
        const center = this.getCellCenter(index);
        const size = this.cellSize * 0.3;

        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
        ctx.translate(center.x, center.y);

        if (this.playerSymbol === 'O') {
            ctx.strokeStyle = this.colors.orbis.primary;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = this.colors.crucia.primary;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size, -size);
            ctx.lineTo(size, size);
            ctx.moveTo(size, -size);
            ctx.lineTo(-size, size);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Draw winning line animation
    drawWinningLine() {
        if (!this.winningLine) return;

        const ctx = this.ctx;
        const [a, b, c] = this.winningLine;
        const start = this.getCellCenter(a);
        const end = this.getCellCenter(c);

        const colors = this.winner === 'O' ? this.colors.orbis : this.colors.crucia;
        const progress = Math.min(1, (Date.now() % 1000) / 500);

        // Pulsing glow
        const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;

        ctx.save();
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 30 + pulse * 20;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.restore();
    }
}

// Export for use in other modules
window.CosmicTicTacToe = CosmicTicTacToe;
