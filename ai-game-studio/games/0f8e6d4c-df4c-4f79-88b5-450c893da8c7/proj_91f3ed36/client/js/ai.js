/**
 * Cosmic Tic-Tac-Toe - AI System
 * Five tiers of AI opponents from Void Novice to The Eternal
 */

class TicTacToeAI {
    constructor(difficulty = 'walker') {
        this.difficulty = difficulty;
        this.symbol = 'X';
        this.playerSymbol = 'O';
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    setSymbol(symbol) {
        this.symbol = symbol;
        this.playerSymbol = symbol === 'X' ? 'O' : 'X';
    }

    // Get the best move based on AI difficulty
    getMove(board) {
        const availableMoves = this.getAvailableMoves(board);

        if (availableMoves.length === 0) return null;

        switch (this.difficulty) {
            case 'novice':
                return this.voidNoviceMove(board, availableMoves);
            case 'acolyte':
                return this.echoingAcolyteMove(board, availableMoves);
            case 'walker':
                return this.gridWalkerMove(board, availableMoves);
            case 'adept':
                return this.forceAdeptMove(board, availableMoves);
            case 'eternal':
                return this.theEternalMove(board, availableMoves);
            default:
                return this.gridWalkerMove(board, availableMoves);
        }
    }

    getAvailableMoves(board) {
        const moves = [];
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                moves.push(i);
            }
        }
        return moves;
    }

    // Void Novice - Random moves (90% player win rate)
    voidNoviceMove(board, availableMoves) {
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Echoing Acolyte - Blocks immediate wins, otherwise random (70-80% win rate)
    echoingAcolyteMove(board, availableMoves) {
        // Check for winning move
        const winMove = this.findWinningMove(board, this.symbol);
        if (winMove !== null) return winMove;

        // Block player's winning move
        const blockMove = this.findWinningMove(board, this.playerSymbol);
        if (blockMove !== null) return blockMove;

        // Random move
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Grid Walker - Minimax to depth 2, prefers center/corners (50-60% win rate)
    gridWalkerMove(board, availableMoves) {
        // Check for winning move
        const winMove = this.findWinningMove(board, this.symbol);
        if (winMove !== null) return winMove;

        // Block player's winning move
        const blockMove = this.findWinningMove(board, this.playerSymbol);
        if (blockMove !== null) return blockMove;

        // Take center if available
        if (board[4] === null) return 4;

        // Take a corner if available
        const corners = [0, 2, 6, 8].filter(c => availableMoves.includes(c));
        if (corners.length > 0) {
            return corners[Math.floor(Math.random() * corners.length)];
        }

        // Take an edge
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Force Adept - Full minimax (perfect play, mostly draws)
    forceAdeptMove(board, availableMoves) {
        return this.minimaxMove(board);
    }

    // The Eternal - Perfect play with dramatic timing (unbeatable)
    theEternalMove(board, availableMoves) {
        // Same as Force Adept but perfect
        return this.minimaxMove(board);
    }

    // Find a move that wins immediately
    findWinningMove(board, symbol) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            const values = [board[a], board[b], board[c]];
            const symbolCount = values.filter(v => v === symbol).length;
            const nullCount = values.filter(v => v === null).length;

            if (symbolCount === 2 && nullCount === 1) {
                // Find the empty cell
                if (board[a] === null) return a;
                if (board[b] === null) return b;
                if (board[c] === null) return c;
            }
        }

        return null;
    }

    // Minimax algorithm for perfect play
    minimaxMove(board) {
        let bestScore = -Infinity;
        let bestMove = null;

        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = this.symbol;
                const score = this.minimax(board, 0, false, -Infinity, Infinity);
                board[i] = null;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }

        return bestMove;
    }

    minimax(board, depth, isMaximizing, alpha, beta) {
        const winner = this.checkWinner(board);

        if (winner === this.symbol) return 10 - depth;
        if (winner === this.playerSymbol) return depth - 10;
        if (this.isBoardFull(board)) return 0;

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = this.symbol;
                    const score = this.minimax(board, depth + 1, false, alpha, beta);
                    board[i] = null;
                    maxScore = Math.max(score, maxScore);
                    alpha = Math.max(alpha, score);
                    if (beta <= alpha) break;
                }
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = this.playerSymbol;
                    const score = this.minimax(board, depth + 1, true, alpha, beta);
                    board[i] = null;
                    minScore = Math.min(score, minScore);
                    beta = Math.min(beta, score);
                    if (beta <= alpha) break;
                }
            }
            return minScore;
        }
    }

    checkWinner(board) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const [a, b, c] of lines) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }

        return null;
    }

    isBoardFull(board) {
        return board.every(cell => cell !== null);
    }
}

// AI tier information for display
const AI_TIERS = {
    novice: {
        name: 'Void Novice',
        description: 'A being of pure darkness, barely conscious of the game',
        winRate: '90%+',
        rewardMultiplier: 0.5,
        visual: 'dim, hesitant symbol manifestation'
    },
    acolyte: {
        name: 'Echoing Acolyte',
        description: 'A student of the cosmic arts, learning to defend',
        winRate: '70-80%',
        rewardMultiplier: 0.75,
        visual: 'standard energy manifestation'
    },
    walker: {
        name: 'Grid Walker',
        description: 'A practiced traveler of the Sacred Nine',
        winRate: '50-60%',
        rewardMultiplier: 1.0,
        visual: 'confident energy pulses'
    },
    adept: {
        name: 'Force Adept',
        description: 'A master of cosmic forces, nearly unbeatable',
        winRate: 'Mostly Draws',
        rewardMultiplier: 1.5,
        visual: 'intense, crackling energy'
    },
    eternal: {
        name: 'The Eternal',
        description: 'Perfection incarnate. Drawing against this being is victory.',
        winRate: 'Unbeatable',
        rewardMultiplier: 2.0,
        visual: 'overwhelming cosmic presence'
    }
};

// Export for use in other modules
window.TicTacToeAI = TicTacToeAI;
window.AI_TIERS = AI_TIERS;
