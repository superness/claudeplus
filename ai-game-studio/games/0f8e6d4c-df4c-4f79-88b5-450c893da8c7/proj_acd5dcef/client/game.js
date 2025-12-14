// American Checkers - Complete Game Implementation
// Implements all 9 systems from the design document

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        tileSize: 64,
        lightColor: '#FFCE9E',
        darkColor: '#D18B47',
        redPieceColor: '#C41E3A',
        blackPieceColor: '#1C1C1C',
        highlightColor: 'rgba(0, 255, 0, 0.4)',
        selectedColor: 'rgba(255, 255, 0, 0.5)',
        kingIndicatorColor: '#FFD700',
        boardSize: 8
    };

    // ==================== 1. BOARD SYSTEM ====================
    class BoardSystem {
        constructor() {
            this.tiles = [];
            this.initBoard();
        }

        initBoard() {
            this.tiles = [];
            for (let y = 0; y < 8; y++) {
                this.tiles[y] = [];
                for (let x = 0; x < 8; x++) {
                    this.tiles[y][x] = {
                        x: x,
                        y: y,
                        isDark: this.isDarkSquare(x, y),
                        piece: null
                    };
                }
            }
        }

        isDarkSquare(x, y) {
            return (x + y) % 2 === 1;
        }

        isValidPosition(x, y) {
            return x >= 0 && x < 8 && y >= 0 && y < 8;
        }

        getPiece(x, y) {
            if (!this.isValidPosition(x, y)) return null;
            return this.tiles[y][x].piece;
        }

        setPiece(x, y, piece) {
            if (!this.isValidPosition(x, y)) return;
            this.tiles[y][x].piece = piece;
            if (piece) {
                piece.x = x;
                piece.y = y;
            }
        }

        removePiece(x, y) {
            if (!this.isValidPosition(x, y)) return null;
            const piece = this.tiles[y][x].piece;
            this.tiles[y][x].piece = null;
            return piece;
        }

        movePiece(fromX, fromY, toX, toY) {
            const piece = this.removePiece(fromX, fromY);
            if (piece) {
                this.setPiece(toX, toY, piece);
            }
            return piece;
        }
    }

    // ==================== 2. PIECE SYSTEM ====================
    class PieceSystem {
        constructor(board) {
            this.board = board;
            this.pieces = [];
            this.pieceIdCounter = 0;
        }

        createPiece(owner, x, y, isKing = false) {
            const piece = {
                id: `${owner}-${this.pieceIdCounter++}`,
                owner: owner,
                isKing: isKing,
                x: x,
                y: y
            };
            this.pieces.push(piece);
            return piece;
        }

        setupInitialPieces() {
            this.pieces = [];
            this.pieceIdCounter = 0;

            // Red pieces (bottom, rows 0-2)
            const redPositions = [
                {x:1,y:0}, {x:3,y:0}, {x:5,y:0}, {x:7,y:0},
                {x:0,y:1}, {x:2,y:1}, {x:4,y:1}, {x:6,y:1},
                {x:1,y:2}, {x:3,y:2}, {x:5,y:2}, {x:7,y:2}
            ];

            // Black pieces (top, rows 5-7)
            const blackPositions = [
                {x:0,y:5}, {x:2,y:5}, {x:4,y:5}, {x:6,y:5},
                {x:1,y:6}, {x:3,y:6}, {x:5,y:6}, {x:7,y:6},
                {x:0,y:7}, {x:2,y:7}, {x:4,y:7}, {x:6,y:7}
            ];

            redPositions.forEach(pos => {
                const piece = this.createPiece('red', pos.x, pos.y);
                this.board.setPiece(pos.x, pos.y, piece);
            });

            blackPositions.forEach(pos => {
                const piece = this.createPiece('black', pos.x, pos.y);
                this.board.setPiece(pos.x, pos.y, piece);
            });
        }

        removePieceFromGame(piece) {
            const index = this.pieces.indexOf(piece);
            if (index > -1) {
                this.pieces.splice(index, 1);
            }
            this.board.removePiece(piece.x, piece.y);
        }

        getPieceCount(owner) {
            return this.pieces.filter(p => p.owner === owner).length;
        }

        getPiecesForPlayer(owner) {
            return this.pieces.filter(p => p.owner === owner);
        }
    }

    // ==================== 3. MOVEMENT SYSTEM ====================
    class MovementSystem {
        constructor(board) {
            this.board = board;
        }

        isValidMove(piece, toX, toY) {
            const dx = Math.abs(toX - piece.x);
            const dy = Math.abs(toY - piece.y);

            // Must be diagonal by 1
            if (dx !== 1 || dy !== 1) return false;

            // Target must be valid position
            if (!this.board.isValidPosition(toX, toY)) return false;

            // Target must be empty dark square
            if (!this.board.isDarkSquare(toX, toY)) return false;
            if (this.board.getPiece(toX, toY) !== null) return false;

            // Direction check for non-kings
            if (!piece.isKing) {
                const actualDy = toY - piece.y;
                if (piece.owner === 'red' && actualDy <= 0) return false;
                if (piece.owner === 'black' && actualDy >= 0) return false;
            }

            return true;
        }

        getValidMoves(piece) {
            const moves = [];
            const directions = piece.isKing
                ? [[-1,-1], [1,-1], [-1,1], [1,1]]
                : piece.owner === 'red'
                    ? [[-1,1], [1,1]]
                    : [[-1,-1], [1,-1]];

            directions.forEach(([dx, dy]) => {
                const toX = piece.x + dx;
                const toY = piece.y + dy;
                if (this.isValidMove(piece, toX, toY)) {
                    moves.push({
                        piece: piece,
                        fromX: piece.x,
                        fromY: piece.y,
                        toX: toX,
                        toY: toY,
                        isJump: false,
                        capturedPiece: null
                    });
                }
            });

            return moves;
        }
    }

    // ==================== 4. CAPTURE SYSTEM ====================
    class CaptureSystem {
        constructor(board) {
            this.board = board;
        }

        isValidJump(piece, toX, toY) {
            const dx = toX - piece.x;
            const dy = toY - piece.y;

            // Must be diagonal by 2
            if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) return false;

            // Target must be valid position
            if (!this.board.isValidPosition(toX, toY)) return false;

            // Target must be empty dark square
            if (!this.board.isDarkSquare(toX, toY)) return false;
            if (this.board.getPiece(toX, toY) !== null) return false;

            // Direction check for non-kings
            if (!piece.isKing) {
                if (piece.owner === 'red' && dy <= 0) return false;
                if (piece.owner === 'black' && dy >= 0) return false;
            }

            // Check jumped piece exists and is enemy
            const jumpedX = piece.x + dx / 2;
            const jumpedY = piece.y + dy / 2;
            const jumpedPiece = this.board.getPiece(jumpedX, jumpedY);

            if (!jumpedPiece) return false;
            if (jumpedPiece.owner === piece.owner) return false;

            return true;
        }

        getAvailableJumps(piece) {
            const jumps = [];
            const directions = piece.isKing
                ? [[-2,-2], [2,-2], [-2,2], [2,2]]
                : piece.owner === 'red'
                    ? [[-2,2], [2,2]]
                    : [[-2,-2], [2,-2]];

            directions.forEach(([dx, dy]) => {
                const toX = piece.x + dx;
                const toY = piece.y + dy;
                if (this.isValidJump(piece, toX, toY)) {
                    const jumpedX = piece.x + dx / 2;
                    const jumpedY = piece.y + dy / 2;
                    jumps.push({
                        piece: piece,
                        fromX: piece.x,
                        fromY: piece.y,
                        toX: toX,
                        toY: toY,
                        isJump: true,
                        capturedPiece: this.board.getPiece(jumpedX, jumpedY)
                    });
                }
            });

            return jumps;
        }

        hasAnyJump(pieces) {
            return pieces.some(p => this.getAvailableJumps(p).length > 0);
        }

        getAllJumpsForPlayer(pieces) {
            let allJumps = [];
            pieces.forEach(piece => {
                allJumps = allJumps.concat(this.getAvailableJumps(piece));
            });
            return allJumps;
        }
    }

    // ==================== 5. TURN SYSTEM ====================
    class TurnSystem {
        constructor(pieceSystem, movementSystem, captureSystem) {
            this.pieceSystem = pieceSystem;
            this.movementSystem = movementSystem;
            this.captureSystem = captureSystem;
            this.reset();
        }

        reset() {
            this.currentPlayer = 'red';
            this.isMultiJumpInProgress = false;
            this.multiJumpPiece = null;
            this.turnNumber = 1;
        }

        endTurn() {
            this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
            this.isMultiJumpInProgress = false;
            this.multiJumpPiece = null;
            this.turnNumber++;
        }

        startMultiJump(piece) {
            this.isMultiJumpInProgress = true;
            this.multiJumpPiece = piece;
        }

        getValidMoves() {
            const playerPieces = this.pieceSystem.getPiecesForPlayer(this.currentPlayer);

            if (this.isMultiJumpInProgress) {
                return this.captureSystem.getAvailableJumps(this.multiJumpPiece);
            }

            // Mandatory capture rule
            if (this.captureSystem.hasAnyJump(playerPieces)) {
                return this.captureSystem.getAllJumpsForPlayer(playerPieces);
            }

            // Regular moves
            let allMoves = [];
            playerPieces.forEach(piece => {
                allMoves = allMoves.concat(this.movementSystem.getValidMoves(piece));
            });
            return allMoves;
        }

        getValidMovesForPiece(piece) {
            if (piece.owner !== this.currentPlayer) return [];

            if (this.isMultiJumpInProgress) {
                if (piece !== this.multiJumpPiece) return [];
                return this.captureSystem.getAvailableJumps(piece);
            }

            const playerPieces = this.pieceSystem.getPiecesForPlayer(this.currentPlayer);

            // Mandatory capture rule
            if (this.captureSystem.hasAnyJump(playerPieces)) {
                return this.captureSystem.getAvailableJumps(piece);
            }

            return this.movementSystem.getValidMoves(piece);
        }
    }

    // ==================== 6. KING PROMOTION SYSTEM ====================
    class KingPromotionSystem {
        checkPromotion(piece) {
            if (piece.isKing) return false;

            if (piece.owner === 'red' && piece.y === 7) {
                piece.isKing = true;
                return true;
            }
            if (piece.owner === 'black' && piece.y === 0) {
                piece.isKing = true;
                return true;
            }
            return false;
        }
    }

    // ==================== 7. WIN CONDITION SYSTEM ====================
    class WinConditionSystem {
        constructor(pieceSystem, turnSystem) {
            this.pieceSystem = pieceSystem;
            this.turnSystem = turnSystem;
            this.movesWithoutCapture = 0;
        }

        reset() {
            this.movesWithoutCapture = 0;
        }

        recordMove(wasCapture) {
            if (wasCapture) {
                this.movesWithoutCapture = 0;
            } else {
                this.movesWithoutCapture++;
            }
        }

        checkGameEnd() {
            const redPieces = this.pieceSystem.getPieceCount('red');
            const blackPieces = this.pieceSystem.getPieceCount('black');

            if (redPieces === 0) {
                return { status: 'black_wins', reason: 'All red pieces captured' };
            }
            if (blackPieces === 0) {
                return { status: 'red_wins', reason: 'All black pieces captured' };
            }

            const validMoves = this.turnSystem.getValidMoves();
            if (validMoves.length === 0) {
                return {
                    status: this.turnSystem.currentPlayer === 'red' ? 'black_wins' : 'red_wins',
                    reason: `${this.turnSystem.currentPlayer === 'red' ? 'Red' : 'Black'} has no valid moves`
                };
            }

            if (this.movesWithoutCapture >= 80) {
                return { status: 'draw', reason: '40 moves without capture' };
            }

            return { status: 'ongoing', reason: null };
        }
    }

    // ==================== 8. INPUT SYSTEM ====================
    class InputSystem {
        constructor(canvas, board, turnSystem, onMoveCallback) {
            this.canvas = canvas;
            this.board = board;
            this.turnSystem = turnSystem;
            this.onMoveCallback = onMoveCallback;
            this.selectedPiece = null;
            this.highlightedMoves = [];

            // Drag state
            this.isDragging = false;
            this.dragPiece = null;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
            this.dragX = 0;
            this.dragY = 0;

            // Bind event handlers
            this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

            // Touch support
            this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        }

        getCanvasCoordinates(event) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const canvasX = (event.clientX - rect.left) * scaleX;
            const canvasY = (event.clientY - rect.top) * scaleY;
            return { canvasX, canvasY };
        }

        getBoardPosition(canvasX, canvasY) {
            const x = Math.floor(canvasX / CONFIG.tileSize);
            const y = 7 - Math.floor(canvasY / CONFIG.tileSize);
            return { x, y };
        }

        handleMouseDown(event) {
            const { canvasX, canvasY } = this.getCanvasCoordinates(event);
            const { x, y } = this.getBoardPosition(canvasX, canvasY);

            if (!this.board.isValidPosition(x, y)) return;

            const clickedPiece = this.board.getPiece(x, y);

            // Can only drag current player's pieces
            if (clickedPiece && clickedPiece.owner === this.turnSystem.currentPlayer) {
                // Check multi-jump restriction
                if (this.turnSystem.isMultiJumpInProgress &&
                    clickedPiece !== this.turnSystem.multiJumpPiece) {
                    return;
                }

                // Start dragging
                this.isDragging = true;
                this.dragPiece = clickedPiece;
                this.selectPiece(clickedPiece);

                // Calculate drag offset (center of piece)
                const pieceScreenX = clickedPiece.x * CONFIG.tileSize + CONFIG.tileSize / 2;
                const pieceScreenY = (7 - clickedPiece.y) * CONFIG.tileSize + CONFIG.tileSize / 2;
                this.dragOffsetX = canvasX - pieceScreenX;
                this.dragOffsetY = canvasY - pieceScreenY;
                this.dragX = canvasX;
                this.dragY = canvasY;

                this.canvas.style.cursor = 'grabbing';
            }
        }

        handleMouseMove(event) {
            const { canvasX, canvasY } = this.getCanvasCoordinates(event);

            if (this.isDragging && this.dragPiece) {
                this.dragX = canvasX;
                this.dragY = canvasY;

                // Trigger re-render to show dragging piece
                if (this.onDragUpdate) {
                    this.onDragUpdate();
                }
            } else {
                // Hover cursor changes
                const { x, y } = this.getBoardPosition(canvasX, canvasY);
                if (this.board.isValidPosition(x, y)) {
                    const piece = this.board.getPiece(x, y);
                    if (piece && piece.owner === this.turnSystem.currentPlayer) {
                        this.canvas.style.cursor = 'grab';
                    } else if (this.selectedPiece) {
                        const isValidTarget = this.highlightedMoves.some(m => m.toX === x && m.toY === y);
                        this.canvas.style.cursor = isValidTarget ? 'pointer' : 'default';
                    } else {
                        this.canvas.style.cursor = 'default';
                    }
                }
            }
        }

        handleMouseUp(event) {
            if (!this.isDragging || !this.dragPiece) {
                this.isDragging = false;
                this.dragPiece = null;
                return;
            }

            const { canvasX, canvasY } = this.getCanvasCoordinates(event);
            const { x, y } = this.getBoardPosition(canvasX, canvasY);

            // Check if dropped on valid move
            if (this.board.isValidPosition(x, y)) {
                const targetMove = this.highlightedMoves.find(m => m.toX === x && m.toY === y);
                if (targetMove) {
                    this.onMoveCallback(targetMove);
                    this.clearSelection();
                } else {
                    // Invalid drop - keep piece selected for click-based move
                }
            }

            this.isDragging = false;
            this.dragPiece = null;
            this.canvas.style.cursor = 'default';

            if (this.onDragUpdate) {
                this.onDragUpdate();
            }
        }

        handleMouseLeave(event) {
            if (this.isDragging) {
                // Cancel drag on leave
                this.isDragging = false;
                this.dragPiece = null;
                this.canvas.style.cursor = 'default';
                if (this.onDragUpdate) {
                    this.onDragUpdate();
                }
            }
        }

        // Touch handlers
        handleTouchStart(event) {
            event.preventDefault();
            const touch = event.touches[0];
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        }

        handleTouchMove(event) {
            event.preventDefault();
            const touch = event.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }

        handleTouchEnd(event) {
            event.preventDefault();
            // Use last known drag position for drop
            if (this.isDragging && this.dragPiece) {
                const { x, y } = this.getBoardPosition(this.dragX, this.dragY);

                if (this.board.isValidPosition(x, y)) {
                    const targetMove = this.highlightedMoves.find(m => m.toX === x && m.toY === y);
                    if (targetMove) {
                        this.onMoveCallback(targetMove);
                        this.clearSelection();
                    }
                }
            }

            this.isDragging = false;
            this.dragPiece = null;
            if (this.onDragUpdate) {
                this.onDragUpdate();
            }
        }

        selectPiece(piece) {
            this.selectedPiece = piece;
            this.highlightedMoves = this.turnSystem.getValidMovesForPiece(piece);
        }

        clearSelection() {
            this.selectedPiece = null;
            this.highlightedMoves = [];
            this.isDragging = false;
            this.dragPiece = null;
        }

        forceSelectPiece(piece) {
            this.selectPiece(piece);
        }

        // For rendering: get drag state
        getDragState() {
            if (this.isDragging && this.dragPiece) {
                return {
                    piece: this.dragPiece,
                    x: this.dragX - this.dragOffsetX,
                    y: this.dragY - this.dragOffsetY
                };
            }
            return null;
        }
    }

    // ==================== 9. RENDERING SYSTEM ====================
    class RenderingSystem {
        constructor(canvas, board, inputSystem, pieceSystem, turnSystem) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.board = board;
            this.inputSystem = inputSystem;
            this.pieceSystem = pieceSystem;
            this.turnSystem = turnSystem;

            this.canvas.width = CONFIG.boardSize * CONFIG.tileSize;
            this.canvas.height = CONFIG.boardSize * CONFIG.tileSize;

            // Animation state for selected piece pulse
            this.animationFrame = 0;
            this.startAnimation();
        }

        startAnimation() {
            const animate = () => {
                this.animationFrame = (this.animationFrame + 1) % 60;
                this.render();
                requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        }

        render() {
            this.drawBoard();
            this.drawHighlights();
            this.drawPieces();
            this.drawDraggingPiece();
        }

        drawBoard() {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const screenY = 7 - y; // Flip Y for screen coordinates
                    const isDark = this.board.isDarkSquare(x, y);
                    this.ctx.fillStyle = isDark ? CONFIG.darkColor : CONFIG.lightColor;
                    this.ctx.fillRect(
                        x * CONFIG.tileSize,
                        screenY * CONFIG.tileSize,
                        CONFIG.tileSize,
                        CONFIG.tileSize
                    );
                }
            }
        }

        drawHighlights() {
            // Highlight selected piece
            if (this.inputSystem.selectedPiece) {
                const piece = this.inputSystem.selectedPiece;
                const screenY = 7 - piece.y;
                this.ctx.fillStyle = CONFIG.selectedColor;
                this.ctx.fillRect(
                    piece.x * CONFIG.tileSize,
                    screenY * CONFIG.tileSize,
                    CONFIG.tileSize,
                    CONFIG.tileSize
                );
            }

            // Highlight valid moves
            this.inputSystem.highlightedMoves.forEach(move => {
                const screenY = 7 - move.toY;
                this.ctx.fillStyle = CONFIG.highlightColor;
                this.ctx.fillRect(
                    move.toX * CONFIG.tileSize,
                    screenY * CONFIG.tileSize,
                    CONFIG.tileSize,
                    CONFIG.tileSize
                );
            });
        }

        drawPieces() {
            const dragState = this.inputSystem.getDragState();
            this.pieceSystem.pieces.forEach(piece => {
                // Skip rendering piece at original position if being dragged
                if (dragState && dragState.piece === piece) {
                    return;
                }
                this.drawPiece(piece);
            });
        }

        drawDraggingPiece() {
            const dragState = this.inputSystem.getDragState();
            if (!dragState) return;

            const piece = dragState.piece;
            const centerX = dragState.x;
            const centerY = dragState.y;
            const radius = CONFIG.tileSize * 0.38;

            // Draw drop shadow
            this.ctx.beginPath();
            this.ctx.arc(centerX + 4, centerY + 6, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fill();

            // Draw main piece (slightly larger when dragging)
            const dragRadius = radius * 1.1;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, dragRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = piece.owner === 'red' ? CONFIG.redPieceColor : CONFIG.blackPieceColor;
            this.ctx.fill();

            // Draw border
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            // Draw inner highlight
            this.ctx.beginPath();
            this.ctx.arc(centerX - dragRadius * 0.2, centerY - dragRadius * 0.2, dragRadius * 0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = piece.owner === 'red' ? 'rgba(255, 150, 150, 0.4)' : 'rgba(100, 100, 100, 0.4)';
            this.ctx.fill();

            // Draw king crown if applicable
            if (piece.isKing) {
                this.drawCrown(centerX, centerY, dragRadius);
            }
        }

        drawPiece(piece) {
            const centerX = piece.x * CONFIG.tileSize + CONFIG.tileSize / 2;
            const screenY = 7 - piece.y;
            const centerY = screenY * CONFIG.tileSize + CONFIG.tileSize / 2;
            const radius = CONFIG.tileSize * 0.38;

            const isSelected = this.inputSystem.selectedPiece === piece;

            // Draw selection glow effect (pulsing) if this piece is selected
            if (isSelected) {
                // Calculate pulse effect (0.6 to 1.0 opacity)
                const pulsePhase = Math.sin((this.animationFrame / 60) * Math.PI * 2);
                const glowOpacity = 0.6 + (pulsePhase + 1) * 0.2;
                const glowRadius = radius + 8 + pulsePhase * 3;

                // Draw outer glow
                const gradient = this.ctx.createRadialGradient(
                    centerX, centerY, radius,
                    centerX, centerY, glowRadius
                );
                gradient.addColorStop(0, `rgba(255, 255, 0, ${glowOpacity})`);
                gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
            }

            // Draw piece shadow
            this.ctx.beginPath();
            this.ctx.arc(centerX + 2, centerY + 2, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fill();

            // Draw main piece
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = piece.owner === 'red' ? CONFIG.redPieceColor : CONFIG.blackPieceColor;
            this.ctx.fill();

            // Draw piece border (thicker and brighter yellow if selected)
            if (isSelected) {
                this.ctx.strokeStyle = '#FFD700';
                this.ctx.lineWidth = 4;
            } else {
                this.ctx.strokeStyle = piece.owner === 'red' ? '#8B0000' : '#000000';
                this.ctx.lineWidth = 2;
            }
            this.ctx.stroke();

            // Draw inner highlight
            this.ctx.beginPath();
            this.ctx.arc(centerX - radius * 0.2, centerY - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = piece.owner === 'red' ? 'rgba(255, 150, 150, 0.4)' : 'rgba(100, 100, 100, 0.4)';
            this.ctx.fill();

            // Draw king crown
            if (piece.isKing) {
                this.drawCrown(centerX, centerY, radius);
            }
        }

        drawCrown(centerX, centerY, pieceRadius) {
            const crownWidth = pieceRadius * 0.9;
            const crownHeight = pieceRadius * 0.5;
            const x = centerX - crownWidth / 2;
            const y = centerY - crownHeight / 2;

            this.ctx.fillStyle = CONFIG.kingIndicatorColor;
            this.ctx.strokeStyle = '#B8860B';
            this.ctx.lineWidth = 1.5;

            // Draw crown shape
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + crownHeight);
            this.ctx.lineTo(x, y + crownHeight * 0.4);
            this.ctx.lineTo(x + crownWidth * 0.2, y + crownHeight * 0.6);
            this.ctx.lineTo(x + crownWidth * 0.35, y);
            this.ctx.lineTo(x + crownWidth * 0.5, y + crownHeight * 0.5);
            this.ctx.lineTo(x + crownWidth * 0.65, y);
            this.ctx.lineTo(x + crownWidth * 0.8, y + crownHeight * 0.6);
            this.ctx.lineTo(x + crownWidth, y + crownHeight * 0.4);
            this.ctx.lineTo(x + crownWidth, y + crownHeight);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    // ==================== 10. AI SYSTEM ====================
    class AISystem {
        constructor(pieceSystem, movementSystem, captureSystem, board) {
            this.pieceSystem = pieceSystem;
            this.movementSystem = movementSystem;
            this.captureSystem = captureSystem;
            this.board = board;
            this.difficulty = 'medium'; // easy, medium, hard
        }

        // Get all valid moves for AI (black player)
        getAllMoves() {
            const pieces = this.pieceSystem.getPiecesForPlayer('black');

            // Check for mandatory captures first
            if (this.captureSystem.hasAnyJump(pieces)) {
                return this.captureSystem.getAllJumpsForPlayer(pieces);
            }

            // Get all regular moves
            let allMoves = [];
            pieces.forEach(piece => {
                allMoves = allMoves.concat(this.movementSystem.getValidMoves(piece));
            });
            return allMoves;
        }

        // Evaluate board position (positive = good for AI/black)
        evaluateBoard() {
            let score = 0;

            this.pieceSystem.pieces.forEach(piece => {
                const value = piece.isKing ? 3 : 1;
                const positionBonus = this.getPositionBonus(piece);

                if (piece.owner === 'black') {
                    score += value + positionBonus;
                } else {
                    score -= value + positionBonus;
                }
            });

            return score;
        }

        // Position bonuses for strategic play
        getPositionBonus(piece) {
            let bonus = 0;

            // Advance bonus (pieces closer to promotion)
            if (piece.owner === 'black' && !piece.isKing) {
                bonus += (7 - piece.y) * 0.1;
            } else if (piece.owner === 'red' && !piece.isKing) {
                bonus += piece.y * 0.1;
            }

            // Center control bonus
            if (piece.x >= 2 && piece.x <= 5 && piece.y >= 2 && piece.y <= 5) {
                bonus += 0.2;
            }

            // Edge protection (back row)
            if ((piece.owner === 'black' && piece.y === 7) ||
                (piece.owner === 'red' && piece.y === 0)) {
                bonus += 0.15;
            }

            return bonus;
        }

        // Evaluate a specific move
        evaluateMove(move) {
            let score = 0;

            // Captures are valuable
            if (move.isJump) {
                score += 5;
                if (move.capturedPiece && move.capturedPiece.isKing) {
                    score += 3; // Extra value for capturing kings
                }
            }

            // Check for promotion opportunity
            if (!move.piece.isKing && move.piece.owner === 'black' && move.toY === 0) {
                score += 4;
            }

            // Avoid moving pieces that protect the back row early
            if (move.piece.y === 7 && move.fromY === 7) {
                score -= 0.5;
            }

            // Prefer center control
            if (move.toX >= 2 && move.toX <= 5 && move.toY >= 2 && move.toY <= 5) {
                score += 0.3;
            }

            return score;
        }

        // Simple minimax with limited depth
        minimax(depth, isMaximizing, alpha, beta) {
            if (depth === 0) {
                return this.evaluateBoard();
            }

            const pieces = this.pieceSystem.getPiecesForPlayer(isMaximizing ? 'black' : 'red');

            // Get moves for current player
            let moves;
            if (this.captureSystem.hasAnyJump(pieces)) {
                moves = this.captureSystem.getAllJumpsForPlayer(pieces);
            } else {
                moves = [];
                pieces.forEach(piece => {
                    moves = moves.concat(this.movementSystem.getValidMoves(piece));
                });
            }

            if (moves.length === 0) {
                return isMaximizing ? -100 : 100;
            }

            if (isMaximizing) {
                let maxEval = -Infinity;
                for (const move of moves) {
                    // Simulate move
                    const state = this.saveState(move);
                    this.applyMove(move);

                    const evalScore = this.minimax(depth - 1, false, alpha, beta);

                    // Restore state
                    this.restoreState(state);

                    maxEval = Math.max(maxEval, evalScore);
                    alpha = Math.max(alpha, evalScore);
                    if (beta <= alpha) break;
                }
                return maxEval;
            } else {
                let minEval = Infinity;
                for (const move of moves) {
                    const state = this.saveState(move);
                    this.applyMove(move);

                    const evalScore = this.minimax(depth - 1, true, alpha, beta);

                    this.restoreState(state);

                    minEval = Math.min(minEval, evalScore);
                    beta = Math.min(beta, evalScore);
                    if (beta <= alpha) break;
                }
                return minEval;
            }
        }

        // Save state before simulating move
        saveState(move) {
            return {
                piece: move.piece,
                pieceX: move.piece.x,
                pieceY: move.piece.y,
                pieceIsKing: move.piece.isKing,
                capturedPiece: move.capturedPiece,
                capturedX: move.capturedPiece ? move.capturedPiece.x : null,
                capturedY: move.capturedPiece ? move.capturedPiece.y : null
            };
        }

        // Apply move for simulation
        applyMove(move) {
            this.board.movePiece(move.fromX, move.fromY, move.toX, move.toY);
            if (move.capturedPiece) {
                this.board.removePiece(move.capturedPiece.x, move.capturedPiece.y);
            }
            // Check promotion
            if (!move.piece.isKing && move.piece.owner === 'black' && move.toY === 0) {
                move.piece.isKing = true;
            }
        }

        // Restore state after simulation
        restoreState(state) {
            const piece = state.piece;
            // Remove piece from its current (simulated) position
            this.board.removePiece(piece.x, piece.y);
            // Restore piece to original position
            piece.x = state.pieceX;
            piece.y = state.pieceY;
            piece.isKing = state.pieceIsKing;
            this.board.setPiece(state.pieceX, state.pieceY, piece);

            // Restore captured piece
            if (state.capturedPiece) {
                this.board.setPiece(state.capturedX, state.capturedY, state.capturedPiece);
            }
        }

        // Choose best move
        chooseBestMove() {
            const moves = this.getAllMoves();
            if (moves.length === 0) return null;

            let depth;
            switch (this.difficulty) {
                case 'easy': depth = 1; break;
                case 'medium': depth = 2; break;
                case 'hard': depth = 3; break;
                default: depth = 2;
            }

            // For easy mode, add some randomness
            if (this.difficulty === 'easy' && Math.random() < 0.3) {
                return moves[Math.floor(Math.random() * moves.length)];
            }

            let bestMove = null;
            let bestScore = -Infinity;

            for (const move of moves) {
                // Quick evaluation for this move
                let moveScore = this.evaluateMove(move);

                // Add minimax evaluation for harder difficulties
                if (this.difficulty !== 'easy') {
                    const state = this.saveState(move);
                    this.applyMove(move);
                    moveScore += this.minimax(depth - 1, false, -Infinity, Infinity) * 0.5;
                    this.restoreState(state);
                }

                // Add small random factor to prevent predictability
                moveScore += Math.random() * 0.1;

                if (moveScore > bestScore) {
                    bestScore = moveScore;
                    bestMove = move;
                }
            }

            return bestMove || moves[0];
        }

        // Get continuation jumps for multi-jump sequences
        getContinuationJumps(piece) {
            return this.captureSystem.getAvailableJumps(piece);
        }
    }

    // ==================== GAME CONTROLLER ====================
    class GameController {
        constructor() {
            this.canvas = document.getElementById('game-canvas');
            this.isAIEnabled = true; // AI plays as black
            this.aiThinking = false;
            this.initSystems();
            this.initUI();
            this.startNewGame();
        }

        initSystems() {
            this.board = new BoardSystem();
            this.pieceSystem = new PieceSystem(this.board);
            this.movementSystem = new MovementSystem(this.board);
            this.captureSystem = new CaptureSystem(this.board);
            this.turnSystem = new TurnSystem(this.pieceSystem, this.movementSystem, this.captureSystem);
            this.kingPromotionSystem = new KingPromotionSystem();
            this.winConditionSystem = new WinConditionSystem(this.pieceSystem, this.turnSystem);
            this.aiSystem = new AISystem(this.pieceSystem, this.movementSystem, this.captureSystem, this.board);
            this.inputSystem = new InputSystem(
                this.canvas,
                this.board,
                this.turnSystem,
                this.executeMove.bind(this)
            );
            this.renderingSystem = new RenderingSystem(
                this.canvas,
                this.board,
                this.inputSystem,
                this.pieceSystem,
                this.turnSystem
            );

            // Connect drag update callback for real-time dragging render
            this.inputSystem.onDragUpdate = () => {
                this.renderingSystem.render();
            };
        }

        initUI() {
            this.turnIndicator = document.getElementById('current-turn');
            this.statusMessage = document.getElementById('status-message');
            this.redCaptured = document.getElementById('red-captured');
            this.blackCaptured = document.getElementById('black-captured');
            this.redPanel = document.getElementById('red-panel');
            this.blackPanel = document.getElementById('black-panel');
            this.gameOverModal = document.getElementById('game-over-modal');
            this.winnerText = document.getElementById('winner-text');
            this.winReason = document.getElementById('win-reason');

            document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
            document.getElementById('play-again-btn').addEventListener('click', () => this.startNewGame());
        }

        startNewGame() {
            this.board.initBoard();
            this.pieceSystem.setupInitialPieces();
            this.turnSystem.reset();
            this.winConditionSystem.reset();
            this.inputSystem.clearSelection();
            this.redCapturedCount = 0;
            this.blackCapturedCount = 0;
            this.gameOverModal.classList.add('hidden');
            this.updateUI();
            this.renderingSystem.render();
        }

        executeMove(move) {
            const piece = move.piece;

            // Execute the move
            this.board.movePiece(move.fromX, move.fromY, move.toX, move.toY);

            let wasCapture = false;

            // Handle capture
            if (move.isJump && move.capturedPiece) {
                this.pieceSystem.removePieceFromGame(move.capturedPiece);
                wasCapture = true;

                // Update captured counts
                if (move.capturedPiece.owner === 'red') {
                    this.blackCapturedCount++;
                } else {
                    this.redCapturedCount++;
                }
            }

            // Record move for draw detection
            this.winConditionSystem.recordMove(wasCapture);

            // Check for promotion
            const wasPromoted = this.kingPromotionSystem.checkPromotion(piece);

            // Check for multi-jump continuation
            let continueJumping = false;
            if (move.isJump && !wasPromoted) {
                const additionalJumps = this.captureSystem.getAvailableJumps(piece);
                if (additionalJumps.length > 0) {
                    continueJumping = true;
                    this.turnSystem.startMultiJump(piece);
                    this.inputSystem.forceSelectPiece(piece);
                    this.setStatus('Multi-jump! Continue capturing.');
                }
            }

            if (!continueJumping) {
                this.turnSystem.endTurn();

                // Trigger AI move if it's AI's turn
                if (this.isAIEnabled && this.turnSystem.currentPlayer === 'black') {
                    this.scheduleAIMove();
                }
            }

            this.updateUI();
            this.renderingSystem.render();

            // Check for game end
            const result = this.winConditionSystem.checkGameEnd();
            if (result.status !== 'ongoing') {
                this.endGame(result);
            }
        }

        scheduleAIMove() {
            if (this.aiThinking) return;
            this.aiThinking = true;
            this.setStatus('AI is thinking...');

            // Add small delay to make AI moves visible
            setTimeout(() => {
                this.executeAIMove();
            }, 500);
        }

        executeAIMove(multiJumpPiece = null) {
            // Guard: Verify it's actually the AI's turn before executing
            // This prevents stale setTimeout callbacks from executing AI moves on red's turn
            if (this.turnSystem.currentPlayer !== 'black') {
                this.aiThinking = false;
                return;
            }

            let move;
            if (multiJumpPiece) {
                // Continuing a multi-jump - only get jumps for this specific piece
                const continuationJumps = this.aiSystem.getContinuationJumps(multiJumpPiece);
                move = continuationJumps.length > 0 ? continuationJumps[0] : null;
            } else {
                // Initial AI move - choose best move from all options
                move = this.aiSystem.chooseBestMove();
            }
            if (!move) {
                this.aiThinking = false;
                return;
            }

            // Execute the AI's move
            this.board.movePiece(move.fromX, move.fromY, move.toX, move.toY);

            let wasCapture = false;
            if (move.isJump && move.capturedPiece) {
                this.pieceSystem.removePieceFromGame(move.capturedPiece);
                wasCapture = true;
                this.redCapturedCount++;
            }

            this.winConditionSystem.recordMove(wasCapture);

            const wasPromoted = this.kingPromotionSystem.checkPromotion(move.piece);

            // Check for multi-jump
            let continueJumping = false;
            if (move.isJump && !wasPromoted) {
                const additionalJumps = this.aiSystem.getContinuationJumps(move.piece);
                if (additionalJumps.length > 0) {
                    continueJumping = true;
                }
            }

            this.updateUI();
            this.renderingSystem.render();

            // Check for game end
            const result = this.winConditionSystem.checkGameEnd();
            if (result.status !== 'ongoing') {
                this.aiThinking = false;
                this.endGame(result);
                return;
            }

            if (continueJumping) {
                // Continue AI multi-jump with the same piece
                setTimeout(() => {
                    this.executeAIMove(move.piece);
                }, 400);
            } else {
                // End AI turn
                this.turnSystem.endTurn();
                this.aiThinking = false;
                this.updateUI();
            }
        }

        updateUI() {
            // Update turn indicator
            const currentPlayer = this.turnSystem.currentPlayer;
            this.turnIndicator.textContent = `${currentPlayer === 'red' ? 'Red' : 'Black'}'s Turn`;
            this.turnIndicator.className = currentPlayer;

            // Update active player panel
            this.redPanel.classList.toggle('active', currentPlayer === 'red');
            this.blackPanel.classList.toggle('active', currentPlayer === 'black');

            // Update captured counts
            this.redCaptured.textContent = `Captured: ${this.redCapturedCount}`;
            this.blackCaptured.textContent = `Captured: ${this.blackCapturedCount}`;

            // Clear status if not in multi-jump
            if (!this.turnSystem.isMultiJumpInProgress) {
                // Check for forced captures
                const playerPieces = this.pieceSystem.getPiecesForPlayer(currentPlayer);
                if (this.captureSystem.hasAnyJump(playerPieces)) {
                    this.setStatus('You must capture!');
                } else {
                    this.setStatus('');
                }
            }
        }

        setStatus(message) {
            this.statusMessage.textContent = message;
        }

        endGame(result) {
            let winnerMessage;
            if (result.status === 'red_wins') {
                winnerMessage = 'Red Wins!';
            } else if (result.status === 'black_wins') {
                winnerMessage = 'Black Wins!';
            } else {
                winnerMessage = 'Draw!';
            }

            this.winnerText.textContent = winnerMessage;
            this.winReason.textContent = result.reason;
            this.gameOverModal.classList.remove('hidden');
        }
    }

    // Initialize game when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        new GameController();
    });
})();
