// chess.js - Fully Functional 2 Player Chess Game (Local, Bot & Firebase Online Multiplayer)
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    getDatabase,
    ref,
    set,
    push,
    onValue,
    remove,
    update,
    get,
    onDisconnect
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// Firebase Configuration (Reused from Scrabble / Durak / Azul)
const firebaseConfig = {
    apiKey: "AIzaSyBT0StKCiled3K5uAi3lcrJlFALXI5KgvE",
    authDomain: "spy-game-4ce29.firebaseapp.com",
    databaseURL: "https://spy-game-4ce29-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "spy-game-4ce29",
    storageBucket: "spy-game-4ce29.firebasestorage.app",
    messagingSenderId: "20232358549",
    appId: "1:20232358549:web:feb22d19fb56e13ec9699c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);

// -------------------------------------------------------------
// CHESS PIECE IMAGES (Wood Theme matching Chess.com)
// -------------------------------------------------------------
const PIECE_IMAGES = {
    'P': 'assets/images/chess/pieces/wp.png',
    'R': 'assets/images/chess/pieces/wr.png',
    'N': 'assets/images/chess/pieces/wn.png',
    'B': 'assets/images/chess/pieces/wb.png',
    'Q': 'assets/images/chess/pieces/wq.png',
    'K': 'assets/images/chess/pieces/wk.png',
    'p': 'assets/images/chess/pieces/bp.png',
    'r': 'assets/images/chess/pieces/br.png',
    'n': 'assets/images/chess/pieces/bn.png',
    'b': 'assets/images/chess/pieces/bb.png',
    'q': 'assets/images/chess/pieces/bq.png',
    'k': 'assets/images/chess/pieces/bk.png'
};

const CDN_PIECE_CODES = {
    'P': 'wp', 'R': 'wr', 'N': 'wn', 'B': 'wb', 'Q': 'wq', 'K': 'wk',
    'p': 'bp', 'r': 'br', 'n': 'bn', 'b': 'bb', 'q': 'bq', 'k': 'bk'
};

const PIECE_SVGS = {};
for (const [piece, localSrc] of Object.entries(PIECE_IMAGES)) {
    const cdnCode = CDN_PIECE_CODES[piece];
    PIECE_SVGS[piece] = `<img src="${localSrc}" class="chess-piece-img" alt="${piece}" draggable="false" onerror="this.onerror=null;this.src='https://images.chesscomfiles.com/chess-themes/pieces/wood/150/${cdnCode}.png';" />`;
}

const UNICODE_PIECES = {
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
};

const PIECE_VALUES = {
    'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 200,
    'P': 1, 'N': 3, 'B': 3.25, 'R': 5, 'Q': 9, 'K': 200
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Safely normalize raw Firebase board array/objects so no null or empty rows crash the renderer
function normalizeBoard(raw) {
    const result = [];
    for (let r = 0; r < 8; r++) {
        const row = [];
        for (let c = 0; c < 8; c++) {
            let piece = null;
            if (raw && raw[r]) {
                const item = raw[r][c];
                if (item && item !== '.') piece = item;
            }
            row.push(piece);
        }
        result.push(row);
    }
    return result;
}

// Convert board to Firebase safe format by replacing null with '.'
function boardToFirebase(board) {
    return board.map(row => row.map(cell => cell || '.'));
}

// -------------------------------------------------------------
// WEB AUDIO SYNTHESIZER FOR SOUND EFFECTS
// -------------------------------------------------------------
let audioCtx = null;
let soundEnabled = true;

function playSound(type) {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const now = audioCtx.currentTime;

        if (type === 'move') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'capture') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'check') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.08);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'win') {
            [440, 554.37, 659.25, 880].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0.3, now + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.4);
            });
        }
    } catch (e) {
        console.warn('Audio playback error', e);
    }
}

// -------------------------------------------------------------
// CORE CHESS ENGINE & RULES
// -------------------------------------------------------------
function isWhite(piece) {
    return piece && piece === piece.toUpperCase();
}
function isBlack(piece) {
    return piece && piece === piece.toLowerCase();
}
function isSameColor(p1, p2) {
    if (!p1 || !p2) return false;
    return (isWhite(p1) && isWhite(p2)) || (isBlack(p1) && isBlack(p2));
}

function createInitialBoard() {
    return [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
}

function copyBoard(board) {
    return board.map(row => [...row]);
}

function findKing(board, color) {
    const targetKing = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r] && board[r][c] === targetKing) return { r, c };
        }
    }
    return null;
}

function isSquareAttacked(board, r, c, attackerColor) {
    const pawnDir = attackerColor === 'w' ? 1 : -1;
    const attackerPawn = attackerColor === 'w' ? 'P' : 'p';
    for (const dc of [-1, 1]) {
        const ar = r + pawnDir;
        const ac = c + dc;
        if (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
            if (board[ar] && board[ar][ac] === attackerPawn) return true;
        }
    }

    const attackerKnight = attackerColor === 'w' ? 'N' : 'n';
    const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightMoves) {
        const ar = r + dr;
        const ac = c + dc;
        if (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
            if (board[ar] && board[ar][ac] === attackerKnight) return true;
        }
    }

    const attackerKing = attackerColor === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const ar = r + dr;
            const ac = c + dc;
            if (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
                if (board[ar] && board[ar][ac] === attackerKing) return true;
            }
        }
    }

    const attackerRook = attackerColor === 'w' ? 'R' : 'r';
    const attackerQueen = attackerColor === 'w' ? 'Q' : 'q';
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of straightDirs) {
        let ar = r + dr;
        let ac = c + dc;
        while (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
            const piece = board[ar] ? board[ar][ac] : null;
            if (piece) {
                if (piece === attackerRook || piece === attackerQueen) return true;
                break;
            }
            ar += dr;
            ac += dc;
        }
    }

    const attackerBishop = attackerColor === 'w' ? 'B' : 'b';
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
        let ar = r + dr;
        let ac = c + dc;
        while (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
            const piece = board[ar] ? board[ar][ac] : null;
            if (piece) {
                if (piece === attackerBishop || piece === attackerQueen) return true;
                break;
            }
            ar += dr;
            ac += dc;
        }
    }

    return false;
}

function isKingInCheck(board, color) {
    const kingPos = findKing(board, color);
    if (!kingPos) return false;
    const attackerColor = color === 'w' ? 'b' : 'w';
    return isSquareAttacked(board, kingPos.r, kingPos.c, attackerColor);
}

function getPseudoMoves(board, r, c, castlingRights, enPassantTarget) {
    const piece = board[r] ? board[r][c] : null;
    if (!piece) return [];

    const moves = [];
    const color = isWhite(piece) ? 'w' : 'b';
    const opponentColor = color === 'w' ? 'b' : 'w';
    const type = piece.toUpperCase();

    if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;

        const nr = r + dir;
        if (nr >= 0 && nr < 8 && board[nr] && !board[nr][c]) {
            moves.push({ from: { r, c }, to: { r: nr, c }, isPromotion: (color === 'w' && nr === 0) || (color === 'b' && nr === 7) });
            const nr2 = r + 2 * dir;
            if (r === startRow && board[nr2] && !board[nr2][c]) {
                moves.push({ from: { r, c }, to: { r: nr2, c }, isEnPassantDouble: true });
            }
        }

        for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr]) {
                const targetPiece = board[nr][nc];
                if (targetPiece && !isSameColor(piece, targetPiece)) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, isPromotion: (color === 'w' && nr === 0) || (color === 'b' && nr === 7) });
                }
                if (enPassantTarget && enPassantTarget.r === nr && enPassantTarget.c === nc) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, isEnPassant: true });
                }
            }
        }
    } else if (type === 'N') {
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightOffsets) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr]) {
                if (!board[nr][nc] || !isSameColor(piece, board[nr][nc])) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                }
            }
        }
    } else if (type === 'B' || type === 'R' || type === 'Q') {
        const dirs = [];
        if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

        for (const [dr, dc] of dirs) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr]) {
                const target = board[nr][nc];
                if (!target) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                } else {
                    if (!isSameColor(piece, target)) {
                        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                    }
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }
    } else if (type === 'K') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr]) {
                    if (!board[nr][nc] || !isSameColor(piece, board[nr][nc])) {
                        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                    }
                }
            }
        }

        const rights = castlingRights ? castlingRights[color] : { k: false, q: false };
        const kingRow = color === 'w' ? 7 : 0;
        if (rights && r === kingRow && c === 4 && !isSquareAttacked(board, r, c, opponentColor)) {
            if (rights.k && board[kingRow] && !board[kingRow][5] && !board[kingRow][6]) {
                if (!isSquareAttacked(board, kingRow, 5, opponentColor) && !isSquareAttacked(board, kingRow, 6, opponentColor)) {
                    moves.push({ from: { r, c }, to: { r: kingRow, c: 6 }, isCastle: 'k' });
                }
            }
            if (rights.q && board[kingRow] && !board[kingRow][1] && !board[kingRow][2] && !board[kingRow][3]) {
                if (!isSquareAttacked(board, kingRow, 3, opponentColor) && !isSquareAttacked(board, kingRow, 2, opponentColor)) {
                    moves.push({ from: { r, c }, to: { r: kingRow, c: 2 }, isCastle: 'q' });
                }
            }
        }
    }

    return moves;
}

function getLegalMoves(board, color, castlingRights, enPassantTarget) {
    const legal = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r] ? board[r][c] : null;
            if (!piece) continue;
            if ((color === 'w' && isWhite(piece)) || (color === 'b' && isBlack(piece))) {
                const candidates = getPseudoMoves(board, r, c, castlingRights, enPassantTarget);
                for (const move of candidates) {
                    const simBoard = copyBoard(board);
                    simBoard[move.to.r][move.to.c] = simBoard[move.from.r][move.from.c];
                    simBoard[move.from.r][move.from.c] = null;
                    if (move.isEnPassant) {
                        const pawnCapturedRow = move.from.r;
                        simBoard[pawnCapturedRow][move.to.c] = null;
                    }
                    if (!isKingInCheck(simBoard, color)) {
                        legal.push(move);
                    }
                }
            }
        }
    }
    return legal;
}

// -------------------------------------------------------------
// CHESS BOT AI (MINIMAX WITH ALPHA-BETA PRUNING)
// -------------------------------------------------------------
const PST_PAWN = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
];

const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r] ? board[r][c] : null;
            if (!piece) continue;
            const val = PIECE_VALUES[piece] || 0;
            const type = piece.toUpperCase();
            let pstVal = 0;
            if (type === 'P') pstVal = PST_PAWN[isWhite(piece) ? r : 7 - r][c] * 0.1;
            if (type === 'N') pstVal = PST_KNIGHT[isWhite(piece) ? r : 7 - r][c] * 0.1;

            if (isWhite(piece)) {
                score += val + pstVal;
            } else {
                score -= val + pstVal;
            }
        }
    }
    return score;
}

function minimax(board, depth, alpha, beta, isMaximizing, castlingRights, enPassantTarget) {
    const color = isMaximizing ? 'w' : 'b';
    const moves = getLegalMoves(board, color, castlingRights, enPassantTarget);

    if (moves.length === 0) {
        if (isKingInCheck(board, color)) {
            return isMaximizing ? -10000 + (3 - depth) : 10000 - (3 - depth);
        }
        return 0;
    }

    if (depth === 0) {
        return evaluateBoard(board);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const simBoard = copyBoard(board);
            simBoard[move.to.r][move.to.c] = simBoard[move.from.r][move.from.c];
            simBoard[move.from.r][move.from.c] = null;
            const evalScore = minimax(simBoard, depth - 1, alpha, beta, false, castlingRights, null);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const simBoard = copyBoard(board);
            simBoard[move.to.r][move.to.c] = simBoard[move.from.r][move.from.c];
            simBoard[move.from.r][move.from.c] = null;
            const evalScore = minimax(simBoard, depth - 1, alpha, beta, true, castlingRights, null);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getBestBotMove(board, color, difficulty, castlingRights, enPassantTarget) {
    const moves = getLegalMoves(board, color, castlingRights, enPassantTarget);
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
        const captures = moves.filter(m => board[m.to.r] && board[m.to.r][m.to.c] !== null);
        if (captures.length > 0 && Math.random() < 0.6) {
            return captures[Math.floor(Math.random() * captures.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
    }

    const depth = difficulty === 'medium' ? 2 : 3;
    let bestMove = null;
    let isMaximizing = color === 'w';
    let bestEval = isMaximizing ? -Infinity : Infinity;

    for (const move of moves) {
        const simBoard = copyBoard(board);
        simBoard[move.to.r][move.to.c] = simBoard[move.from.r][move.from.c];
        simBoard[move.from.r][move.from.c] = null;
        if (move.isPromotion) {
            simBoard[move.to.r][move.to.c] = color === 'w' ? 'Q' : 'q';
        }
        const evalScore = minimax(simBoard, depth - 1, -Infinity, Infinity, !isMaximizing, castlingRights, null);
        if (isMaximizing) {
            if (evalScore > bestEval) {
                bestEval = evalScore;
                bestMove = move;
            }
        } else {
            if (evalScore < bestEval) {
                bestEval = evalScore;
                bestMove = move;
            }
        }
    }
    return bestMove || moves[0];
}

// -------------------------------------------------------------
// UI CONTROLLER & APPLICATION STATE
// -------------------------------------------------------------

// DOM Elements
const selectChessCard = document.getElementById('select-chess');
const selectionScreen = document.getElementById('selection-screen');
const chessLobbyScreen = document.getElementById('chess-lobby-screen');
const chessGameScreen = document.getElementById('chess-game-screen');

const chessBackBtn = document.getElementById('chess-back-btn');
const chessGameBackBtn = document.getElementById('chess-game-back-btn');

const chessLocalBtn = document.getElementById('chess-local-btn');
const chessBotBtn = document.getElementById('chess-bot-btn');
const chessOnlineToggleBtn = document.getElementById('chess-online-toggle-btn');
const chessBotOptions = document.getElementById('chess-bot-options');
const chessStartBotBtn = document.getElementById('chess-start-bot-btn');
const chessDiffBtns = document.querySelectorAll('.chess-diff-btn');

const chessJoinSection = document.getElementById('chess-join-section');
const chessLobbySection = document.getElementById('chess-lobby-section');
const chessRoomInput = document.getElementById('chess-room-name');
const chessNameInput = document.getElementById('chess-player-name');
const chessJoinBtn = document.getElementById('chess-join-btn');
const chessPlayersList = document.getElementById('chess-players-list');
const chessStartBtn = document.getElementById('chess-start-btn');
const chessLeaveBtn = document.getElementById('chess-leave-btn');

const chessActiveRoomsSection = document.getElementById('chess-active-rooms-section');
const chessActiveRoomsList = document.getElementById('chess-active-rooms-list');

const chessBoardElem = document.getElementById('chess-board');
const chessStatusText = document.getElementById('chess-status-text');
const chessModeBadge = document.getElementById('chess-mode-badge');
const chessTopName = document.getElementById('chess-top-name');
const chessBottomName = document.getElementById('chess-bottom-name');
const chessTopCaptured = document.getElementById('chess-top-captured');
const chessBottomCaptured = document.getElementById('chess-bottom-captured');
const chessTopScore = document.getElementById('chess-top-score');
const chessBottomScore = document.getElementById('chess-bottom-score');
const chessTopClock = document.getElementById('chess-top-clock');
const chessBottomClock = document.getElementById('chess-bottom-clock');

const chessSetupBtn = document.getElementById('chess-setup-btn');
const chessSetupPanel = document.getElementById('chess-setup-panel');
const chessSetupMoveTool = document.getElementById('chess-setup-move-tool');
const chessSetupTrashTool = document.getElementById('chess-setup-trash-tool');
const chessSetupTurnSelect = document.getElementById('chess-setup-turn-select');
const chessSetupResetBtn = document.getElementById('chess-setup-reset-btn');
const chessSetupClearBtn = document.getElementById('chess-setup-clear-btn');
const chessSetupDoneBtn = document.getElementById('chess-setup-done-btn');
const chessSetupCancelBtn = document.getElementById('chess-setup-cancel-btn');

const chessFlipBtn = document.getElementById('chess-flip-btn');
const chessUndoBtn = document.getElementById('chess-undo-btn');
const chessResignBtn = document.getElementById('chess-resign-btn');
const chessDrawBtn = document.getElementById('chess-draw-btn');
const chessSoundBtn = document.getElementById('chess-sound-btn');
const chessThemeBtn = document.getElementById('chess-theme-btn');
const chessRulesBtn = document.getElementById('chess-rules-btn');
const chessRulesModal = document.getElementById('chess-rules-modal');
const chessRulesCloseBtn = document.getElementById('chess-rules-close-btn');

const chessTimerSelect = document.getElementById('chess-timer-select');
const chessMoveLog = document.getElementById('chess-move-log');

const chessPromoModal = document.getElementById('chess-promotion-modal');
const chessPromoChoices = document.getElementById('chess-promotion-choices');

const chessGameOverModal = document.getElementById('chess-gameover-modal');
const chessGameOverTitle = document.getElementById('chess-gameover-title');
const chessGameOverDesc = document.getElementById('chess-gameover-desc');
const chessGameOverIcon = document.getElementById('chess-gameover-icon');
const chessRematchBtn = document.getElementById('chess-rematch-btn');
const chessLobbyReturnBtn = document.getElementById('chess-lobby-return-btn');

// Game Session State
let gameMode = 'local'; // 'local', 'bot', 'online'
let botDifficulty = 'easy';
let isFlipped = false;
let boardTheme = 'wood';

// Board Setup Mode State
let isSetupMode = false;
let setupTool = 'reposition'; // 'reposition', 'trash', or piece code e.g. 'P', 'k'
let setupSelectedSquare = null;
let preSetupBoard = null;
let preSetupTurn = 'w';

let boardState = createInitialBoard();
let currentTurn = 'w';
let selectedSquare = null;
let legalMovesForSelected = [];
let lastMove = null;

let castlingRights = {
    w: { k: true, q: true },
    b: { k: true, q: true }
};
let enPassantTarget = null;
let moveHistory = [];
let isGameOver = false;

// Clock Timers
let timerSeconds = 300;
let whiteTime = 300;
let blackTime = 300;
let clockInterval = null;

// Firebase Online State
let isMultiplayer = false;
let roomName = '';
let playerName = '';
let playerId = '';
let playerColor = 'w';
let players = {};
let gameData = null;
let unsubscribeRoom = null;
let unsubscribePlayers = null;
let activeRoomsUnsubscribe = null;

// -------------------------------------------------------------
// INITIALIZATION & EVENT HANDLERS
// -------------------------------------------------------------
if (selectChessCard) {
    selectChessCard.addEventListener('click', () => {
        selectionScreen.classList.remove('active');
        chessLobbyScreen.classList.add('active');
        document.querySelector('.container').classList.add('wide-container');
        monitorActiveRooms();
    });
}

if (chessBackBtn) {
    chessBackBtn.addEventListener('click', () => {
        leaveRoom();
        chessLobbyScreen.classList.remove('active');
        selectionScreen.classList.add('active');
        document.querySelector('.container').classList.remove('wide-container');
    });
}

if (chessGameBackBtn) {
    chessGameBackBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to exit the game?')) {
            leaveRoom();
        }
    });
}

// Mode Selection Buttons
if (chessLocalBtn) {
    chessLocalBtn.addEventListener('click', () => {
        gameMode = 'local';
        isMultiplayer = false;
        startNewGame();
    });
}

if (chessBotBtn) {
    chessBotBtn.addEventListener('click', () => {
        chessBotOptions.style.display = chessBotOptions.style.display === 'none' ? 'block' : 'none';
        chessJoinSection.style.display = 'none';
    });
}

if (chessDiffBtns) {
    chessDiffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chessDiffBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            botDifficulty = btn.dataset.diff;
        });
    });
}

if (chessStartBotBtn) {
    chessStartBotBtn.addEventListener('click', () => {
        gameMode = 'bot';
        isMultiplayer = false;
        startNewGame();
    });
}

if (chessOnlineToggleBtn) {
    chessOnlineToggleBtn.addEventListener('click', () => {
        chessJoinSection.style.display = chessJoinSection.style.display === 'none' ? 'block' : 'none';
        chessBotOptions.style.display = 'none';
        if (chessJoinSection.style.display === 'block') {
            monitorActiveRooms();
        }
    });
}

if (chessJoinBtn) {
    chessJoinBtn.addEventListener('click', () => {
        joinOnlineRoom();
    });
}

if (chessStartBtn) {
    chessStartBtn.addEventListener('click', () => {
        startOnlineGame();
    });
}

if (chessLeaveBtn) {
    chessLeaveBtn.addEventListener('click', () => {
        leaveRoom();
    });
}

// Sound & Theme Controls
if (chessSoundBtn) {
    chessSoundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        chessSoundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });
}

if (chessThemeBtn) {
    const themes = ['wood', 'emerald', 'cyber'];
    chessThemeBtn.addEventListener('click', () => {
        const currentIdx = themes.indexOf(boardTheme);
        boardTheme = themes[(currentIdx + 1) % themes.length];
        const boardOuter = document.querySelector('.chess-board-outer');
        if (boardOuter) {
            boardOuter.className = `chess-board-outer theme-${boardTheme}`;
        }
        renderBoard();
    });
}

if (chessFlipBtn) {
    chessFlipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped;
        renderBoard();
    });
}

if (chessUndoBtn) {
    chessUndoBtn.addEventListener('click', () => {
        if (isMultiplayer) {
            alert('Undo is only available in Local or vs Computer mode!');
            return;
        }
        undoLastMove();
    });
}

if (chessResignBtn) {
    chessResignBtn.addEventListener('click', async () => {
        if (isGameOver) return;
        if (confirm('Are you sure you want to resign?')) {
            const winnerColor = playerColor === 'w' ? 'Black' : 'White';
            if (isMultiplayer && roomName) {
                await update(ref(database, `game/chess/rooms/${roomName}`), {
                    isGameOver: true,
                    statusText: `${winnerColor} wins by Resignation!`,
                    winnerIcon: winnerColor === 'White' ? '♔' : '♚'
                });
            } else {
                const winner = currentTurn === 'w' ? 'Black' : 'White';
                endGame(`${winner} wins by Resignation!`, winner === 'White' ? '♔' : '♚');
            }
        }
    });
}

if (chessDrawBtn) {
    chessDrawBtn.addEventListener('click', async () => {
        if (isGameOver) return;
        if (confirm('Offer a Draw to opponent?')) {
            if (isMultiplayer && roomName) {
                await update(ref(database, `game/chess/rooms/${roomName}`), {
                    isGameOver: true,
                    statusText: 'Game ended in a Mutual Draw! 🤝',
                    winnerIcon: '🤝'
                });
            } else {
                endGame('Game ended in a Mutual Draw! 🤝', '🤝');
            }
        }
    });
}

if (chessRulesBtn) {
    chessRulesBtn.addEventListener('click', () => {
        chessRulesModal.style.display = 'flex';
    });
}
if (chessRulesCloseBtn) {
    chessRulesCloseBtn.addEventListener('click', () => {
        chessRulesModal.style.display = 'none';
    });
}

if (chessRematchBtn) {
    chessRematchBtn.addEventListener('click', () => {
        chessGameOverModal.style.display = 'none';
        if (isMultiplayer && roomName && gameData && gameData.hostId === playerId) {
            startOnlineGame();
        } else if (!isMultiplayer) {
            startNewGame();
        }
    });
}

if (chessLobbyReturnBtn) {
    chessLobbyReturnBtn.addEventListener('click', () => {
        chessGameOverModal.style.display = 'none';
        leaveRoom();
    });
}

if (chessTimerSelect) {
    chessTimerSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        timerSeconds = val === 'none' ? 0 : parseInt(val, 10);
        resetClocks();
    });
}

// -------------------------------------------------------------
// BOARD SETUP / CUSTOM POSITION EDITOR
// -------------------------------------------------------------
function canUseSetupMode() {
    if (!isMultiplayer) return true;
    const myPlayer = players[playerId];
    return (gameData && gameData.hostId === playerId) || (myPlayer && myPlayer.isHost);
}

function updateSetupBtnVisibility() {
    if (!chessSetupBtn) return;
    if (canUseSetupMode() && moveHistory.length === 0 && !isGameOver) {
        chessSetupBtn.style.display = 'flex';
    } else {
        chessSetupBtn.style.display = 'none';
    }
}

function enterSetupMode() {
    if (!canUseSetupMode()) {
        alert('Only the host can edit the board before moves start!');
        return;
    }
    isSetupMode = true;
    setupTool = 'reposition';
    setupSelectedSquare = null;
    selectedSquare = null;
    legalMovesForSelected = [];
    preSetupBoard = copyBoard(boardState);
    preSetupTurn = currentTurn;

    stopClocks();

    if (chessBoardElem) {
        chessBoardElem.classList.add('setup-mode-active');
    }
    if (chessSetupPanel) {
        chessSetupPanel.style.display = 'flex';
    }
    if (chessSetupBtn) {
        chessSetupBtn.classList.add('active');
    }
    if (chessSetupTurnSelect) {
        chessSetupTurnSelect.value = currentTurn;
    }

    // Reset tool buttons
    updateSetupToolUI();
    renderBoard();
    updateUIInfo();
}

function exitSetupMode(applyChanges = true) {
    if (!isSetupMode) return;

    if (applyChanges) {
        // Validate board has 1 white king and 1 black king
        let whiteKings = 0;
        let blackKings = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = boardState[r] ? boardState[r][c] : null;
                if (p === 'K') whiteKings++;
                if (p === 'k') blackKings++;
            }
        }

        if (whiteKings !== 1 || blackKings !== 1) {
            alert(`A valid chess game requires exactly 1 White King and 1 Black King!\n(Current: White Kings: ${whiteKings}, Black Kings: ${blackKings})`);
            return;
        }

        // Apply chosen turn
        if (chessSetupTurnSelect) {
            currentTurn = chessSetupTurnSelect.value;
        }

        // Dynamically compute castling rights based on piece placement
        castlingRights = {
            w: {
                k: boardState[7] && boardState[7][4] === 'K' && boardState[7][7] === 'R',
                q: boardState[7] && boardState[7][4] === 'K' && boardState[7][0] === 'R'
            },
            b: {
                k: boardState[0] && boardState[0][4] === 'k' && boardState[0][7] === 'r',
                q: boardState[0] && boardState[0][4] === 'k' && boardState[0][0] === 'r'
            }
        };

        enPassantTarget = null;
        moveHistory = [];
        lastMove = null;
        isGameOver = false;

        if (isMultiplayer && roomName) {
            update(ref(database, `game/chess/rooms/${roomName}`), {
                board: boardToFirebase(boardState),
                turn: currentTurn,
                castlingRights: castlingRights,
                enPassantTarget: null,
                moveHistory: [],
                lastMove: null,
                isGameOver: false,
                statusText: ''
            });
        }

        resetClocks();
        playSound('move');
    } else {
        // Cancel changes
        if (preSetupBoard) {
            boardState = copyBoard(preSetupBoard);
            currentTurn = preSetupTurn;
        }
        if (timerSeconds > 0 && !isGameOver) {
            startClocks();
        }
    }

    isSetupMode = false;
    setupSelectedSquare = null;

    if (chessBoardElem) {
        chessBoardElem.classList.remove('setup-mode-active');
    }
    if (chessSetupPanel) {
        chessSetupPanel.style.display = 'none';
    }
    if (chessSetupBtn) {
        chessSetupBtn.classList.remove('active');
    }

    renderBoard();
    updateUIInfo();
}

function updateSetupToolUI() {
    // Piece buttons
    document.querySelectorAll('.setup-piece-btn').forEach(btn => {
        if (btn.dataset.piece === setupTool) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Tool buttons
    if (chessSetupMoveTool) {
        chessSetupMoveTool.classList.toggle('active', setupTool === 'reposition');
    }
    if (chessSetupTrashTool) {
        chessSetupTrashTool.classList.toggle('active', setupTool === 'trash');
    }
}

if (chessSetupBtn) {
    chessSetupBtn.addEventListener('click', () => {
        if (isSetupMode) {
            exitSetupMode(false);
        } else {
            enterSetupMode();
        }
    });
}

if (chessSetupDoneBtn) {
    chessSetupDoneBtn.addEventListener('click', () => {
        exitSetupMode(true);
    });
}

if (chessSetupCancelBtn) {
    chessSetupCancelBtn.addEventListener('click', () => {
        exitSetupMode(false);
    });
}

if (chessSetupMoveTool) {
    chessSetupMoveTool.addEventListener('click', () => {
        setupTool = 'reposition';
        setupSelectedSquare = null;
        updateSetupToolUI();
        renderBoard();
    });
}

if (chessSetupTrashTool) {
    chessSetupTrashTool.addEventListener('click', () => {
        setupTool = 'trash';
        setupSelectedSquare = null;
        updateSetupToolUI();
        renderBoard();
    });
}

// Setup Piece Palette Clicks
document.querySelectorAll('.setup-piece-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setupTool = btn.dataset.piece;
        setupSelectedSquare = null;
        updateSetupToolUI();
        renderBoard();
    });
});

if (chessSetupResetBtn) {
    chessSetupResetBtn.addEventListener('click', () => {
        boardState = createInitialBoard();
        if (chessSetupTurnSelect) chessSetupTurnSelect.value = 'w';
        currentTurn = 'w';
        setupSelectedSquare = null;
        renderBoard();
        updateUIInfo();
        playSound('move');
    });
}

if (chessSetupClearBtn) {
    chessSetupClearBtn.addEventListener('click', () => {
        boardState = [
            [null, null, null, null, 'k', null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, 'K', null, null, null]
        ];
        setupSelectedSquare = null;
        renderBoard();
        updateUIInfo();
        playSound('capture');
    });
}

function handleSetupSquareClick(r, c) {
    if (!canUseSetupMode()) return;

    if (setupTool === 'trash') {
        if (boardState[r] && boardState[r][c] !== null) {
            boardState[r][c] = null;
            playSound('capture');
            renderBoard();
            updateUIInfo();
            if (isMultiplayer && roomName) {
                update(ref(database, `game/chess/rooms/${roomName}`), {
                    board: boardToFirebase(boardState)
                });
            }
        }
        return;
    }

    // Piece placement from palette
    if (setupTool !== 'reposition') {
        const pieceToPlace = setupTool;
        // Pawns cannot be on row 0 or row 7 in chess
        if ((pieceToPlace === 'P' || pieceToPlace === 'p') && (r === 0 || r === 7)) {
            alert('Pawns cannot be placed on the 1st or 8th rank!');
            return;
        }

        // If placing a King, remove any existing king of the same color first to keep 1 king
        if (pieceToPlace === 'K' || pieceToPlace === 'k') {
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if (boardState[row][col] === pieceToPlace) {
                        boardState[row][col] = null;
                    }
                }
            }
        }

        boardState[r][c] = pieceToPlace;
        playSound('move');
        renderBoard();
        updateUIInfo();

        if (isMultiplayer && roomName) {
            update(ref(database, `game/chess/rooms/${roomName}`), {
                board: boardToFirebase(boardState)
            });
        }
        return;
    }

    // Reposition mode (pick up and drop)
    if (!setupSelectedSquare) {
        if (boardState[r] && boardState[r][c] !== null) {
            setupSelectedSquare = { r, c };
            renderBoard();
        }
    } else {
        if (setupSelectedSquare.r === r && setupSelectedSquare.c === c) {
            setupSelectedSquare = null;
            renderBoard();
        } else {
            const movingPiece = boardState[setupSelectedSquare.r][setupSelectedSquare.c];
            if ((movingPiece === 'P' || movingPiece === 'p') && (r === 0 || r === 7)) {
                alert('Pawns cannot be moved to the 1st or 8th rank!');
                return;
            }
            boardState[r][c] = movingPiece;
            boardState[setupSelectedSquare.r][setupSelectedSquare.c] = null;
            setupSelectedSquare = null;
            playSound('move');
            renderBoard();
            updateUIInfo();

            if (isMultiplayer && roomName) {
                update(ref(database, `game/chess/rooms/${roomName}`), {
                    board: boardToFirebase(boardState)
                });
            }
        }
    }
}

// -------------------------------------------------------------
// FIREBASE REAL-TIME ONLINE MULTIPLAYER (Scrabble / Durak Style)
// -------------------------------------------------------------

// Active Rooms Listing (Monitor rooms waiting in lobby)
function monitorActiveRooms() {
    const roomsRef = ref(database, 'game/chess/rooms');
    if (activeRoomsUnsubscribe) activeRoomsUnsubscribe();

    activeRoomsUnsubscribe = onValue(roomsRef, (snap) => {
        const allRooms = snap.val() || {};
        const activeRooms = [];

        for (const [rName, rData] of Object.entries(allRooms)) {
            if (rData.status === 'lobby') {
                const playerNames = rData.players ? Object.values(rData.players).map(p => p.name).join(', ') : '';
                const pCount = rData.players ? Object.keys(rData.players).length : 0;
                activeRooms.push({ roomName: rName, playerNames, pCount });
            }
        }

        if (!chessActiveRoomsSection || !chessActiveRoomsList) return;

        if (activeRooms.length === 0) {
            chessActiveRoomsSection.style.display = 'none';
        } else {
            chessActiveRoomsSection.style.display = 'block';
            chessActiveRoomsList.innerHTML = activeRooms.map(r => `
                <div class="card" style="padding: 0.6rem 0.8rem; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" onclick="window.joinChessActiveRoom('${escapeHtml(r.roomName)}')">
                    <div>
                        <strong style="color: var(--primary-light);">♟️ ${escapeHtml(r.roomName)}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Players: ${escapeHtml(r.playerNames)}</div>
                    </div>
                    <span class="badge" style="background: var(--success);">${r.pCount}/2 Players</span>
                </div>
            `).join('');
        }
    });
}

window.joinChessActiveRoom = function(name) {
    if (chessRoomInput) chessRoomInput.value = name;
    if (chessNameInput && !chessNameInput.value.trim()) {
        chessNameInput.value = 'Player ' + Math.floor(100 + Math.random() * 900);
    }
    joinOnlineRoom();
};

async function joinOnlineRoom() {
    let rInput = chessRoomInput ? chessRoomInput.value.trim().toLowerCase() : '';
    let nInput = chessNameInput ? chessNameInput.value.trim() : '';

    if (!rInput) {
        rInput = 'chess' + Math.floor(1000 + Math.random() * 9000);
        if (chessRoomInput) chessRoomInput.value = rInput;
    }
    if (!nInput) {
        nInput = 'Player ' + Math.floor(100 + Math.random() * 900);
        if (chessNameInput) chessNameInput.value = nInput;
    }

    roomName = rInput;
    playerName = nInput;

    try {
        const roomRef = ref(database, `game/chess/rooms/${roomName}`);
        const snap = await get(roomRef);
        const data = snap.val() || {};

        if (data.status === 'started') {
            return alert('Game has already started in this room!');
        }

        const playersRef = ref(database, `game/chess/rooms/${roomName}/players`);
        const pSnap = await get(playersRef);
        const existingPlayers = pSnap.val() || {};
        const pKeys = Object.keys(existingPlayers);

        if (pKeys.length >= 2) {
            return alert('Room is full (max 2 players for Chess).');
        }

        const isHost = pKeys.length === 0;
        playerColor = isHost ? 'w' : 'b';

        const newPlayerRef = push(playersRef);
        playerId = newPlayerRef.key;

        await set(newPlayerRef, {
            name: playerName,
            color: playerColor,
            isHost
        });

        if (isHost) {
            await update(roomRef, {
                status: 'lobby',
                hostId: playerId
            });
        }

        onDisconnect(newPlayerRef).remove();

        gameMode = 'online';
        isMultiplayer = true;

        if (chessJoinSection) chessJoinSection.style.display = 'none';
        if (chessLobbySection) chessLobbySection.style.display = 'block';

        setupRealtimeListeners();
    } catch (e) {
        console.error('Error joining chess room:', e);
        alert('Failed to join/create online room: ' + e.message);
    }
}

function setupRealtimeListeners() {
    const playersRef = ref(database, `game/chess/rooms/${roomName}/players`);
    const roomRef = ref(database, `game/chess/rooms/${roomName}`);

    if (unsubscribePlayers) unsubscribePlayers();
    if (unsubscribeRoom) unsubscribeRoom();

    unsubscribePlayers = onValue(playersRef, (snap) => {
        players = snap.val() || {};
        if (playerId && snap.exists() && !players[playerId]) {
            leaveRoom();
            return;
        }
        updateLobbyUI();
    });

    unsubscribeRoom = onValue(roomRef, (snap) => {
        gameData = snap.val() || {};

        if (gameData.status === 'started') {
            chessLobbyScreen.classList.remove('active');
            chessGameScreen.classList.add('active');

            if (gameData.board) boardState = normalizeBoard(gameData.board);
            if (gameData.turn) currentTurn = gameData.turn;
            if (gameData.castlingRights) castlingRights = gameData.castlingRights;
            enPassantTarget = gameData.enPassantTarget || null;
            moveHistory = gameData.moveHistory || [];
            lastMove = gameData.lastMove || null;

            isFlipped = playerColor === 'b';

            if (chessModeBadge) chessModeBadge.textContent = `Online 2P (${playerColor === 'w' ? 'White ♔' : 'Black ♚'})`;

            const pValues = Object.values(players);
            const hostPlayer = pValues.find(p => p.isHost) || { name: 'White' };
            const guestPlayer = pValues.find(p => !p.isHost) || { name: 'Black' };

            if (playerColor === 'w') {
                if (chessBottomName) chessBottomName.textContent = `${hostPlayer.name} (You ♔)`;
                if (chessTopName) chessTopName.textContent = `${guestPlayer.name} (Opponent ♚)`;
            } else {
                if (chessBottomName) chessBottomName.textContent = `${guestPlayer.name} (You ♚)`;
                if (chessTopName) chessTopName.textContent = `${hostPlayer.name} (Opponent ♔)`;
            }

            renderBoard();
            updateUIInfo();

            if (gameData.isGameOver && !isGameOver) {
                endGame(gameData.statusText || 'Game Over', gameData.winnerIcon || '🏆');
            }
        } else {
            chessGameScreen.classList.remove('active');
            chessLobbyScreen.classList.add('active');
        }
    });
}

function updateLobbyUI() {
    const pKeys = Object.keys(players);
    if (!chessPlayersList) return;

    const myPlayer = players[playerId];
    const isHost = (gameData && gameData.hostId === playerId) || (myPlayer && myPlayer.isHost);

    chessPlayersList.innerHTML = Object.values(players).map(p => `
        <div class="card" style="padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,0.05); background: var(--bg-card);">
            <span>${p.color === 'w' ? '♔' : '♚'} <strong>${escapeHtml(p.name)}</strong> ${p.name === playerName ? '(You)' : ''}</span>
            ${p.isHost ? '<span class="badge" style="background: var(--warning); color: #000; font-weight: bold;">Host (White ♔)</span>' : '<span class="badge" style="background: var(--accent); color: #000; font-weight: bold;">Guest (Black ♚)</span>'}
        </div>
    `).join('');

    if (isHost) {
        if (chessStartBtn) {
            chessStartBtn.style.display = 'block';
            chessStartBtn.textContent = pKeys.length >= 2 ? '🚀 Start Game (2 Players Ready)' : '🚀 Start Game (1 Player / Wait for 2nd)';
        }
    } else {
        if (chessStartBtn) chessStartBtn.style.display = 'none';
    }
}

async function startOnlineGame() {
    if (!roomName || !playerId) return;

    const initialBoard = createInitialBoard();
    const initialRights = { w: { k: true, q: true }, b: { k: true, q: true } };

    await update(ref(database, `game/chess/rooms/${roomName}`), {
        status: 'started',
        board: boardToFirebase(initialBoard),
        turn: 'w',
        castlingRights: initialRights,
        enPassantTarget: null,
        moveHistory: [],
        lastMove: null,
        isGameOver: false,
        statusText: ''
    });
}

async function leaveRoom() {
    stopClocks();
    if (unsubscribePlayers) unsubscribePlayers();
    if (unsubscribeRoom) unsubscribeRoom();

    if (playerId && roomName) {
        await remove(ref(database, `game/chess/rooms/${roomName}/players/${playerId}`));
        const snap = await get(ref(database, `game/chess/rooms/${roomName}/players`));
        if (!snap.exists()) {
            await remove(ref(database, `game/chess/rooms/${roomName}`));
        } else {
            const remaining = snap.val();
            const nextHostId = Object.keys(remaining)[0];
            await update(ref(database, `game/chess/rooms/${roomName}`), { hostId: nextHostId });
            await update(ref(database, `game/chess/rooms/${roomName}/players/${nextHostId}`), { isHost: true, color: 'w' });
        }
    }

    playerId = '';
    roomName = '';
    players = {};
    gameData = null;
    isMultiplayer = false;
    exitSetupMode(false);

    if (chessJoinSection) chessJoinSection.style.display = 'none';
    if (chessLobbySection) chessLobbySection.style.display = 'none';

    chessGameScreen.classList.remove('active');
    chessLobbyScreen.classList.add('active');
    document.querySelector('.container').classList.remove('wide-container');
    monitorActiveRooms();
}

// -------------------------------------------------------------
// GAMEPLAY ACTIONS & MOVES
// -------------------------------------------------------------
function startNewGame() {
    exitSetupMode(false);
    boardState = createInitialBoard();
    currentTurn = 'w';
    selectedSquare = null;
    legalMovesForSelected = [];
    lastMove = null;
    castlingRights = { w: { k: true, q: true }, b: { k: true, q: true } };
    enPassantTarget = null;
    moveHistory = [];
    isGameOver = false;
    isFlipped = false;

    chessLobbyScreen.classList.remove('active');
    chessGameScreen.classList.add('active');

    if (chessModeBadge) {
        chessModeBadge.textContent = gameMode === 'local' ? 'Local 2P' : `vs Bot (${botDifficulty})`;
    }

    if (chessTopName) chessTopName.textContent = gameMode === 'bot' ? `Bot ${botDifficulty.toUpperCase()} 🤖` : 'Player 2 (Black ♚)';
    if (chessBottomName) chessBottomName.textContent = 'Player 1 (White ♔)';

    resetClocks();
    renderBoard();
    updateUIInfo();
    playSound('move');
}

function resetClocks() {
    stopClocks();
    whiteTime = timerSeconds;
    blackTime = timerSeconds;
    updateClockDisplay();
    if (timerSeconds > 0 && !isGameOver) {
        startClocks();
    }
}

function startClocks() {
    stopClocks();
    clockInterval = setInterval(() => {
        if (isGameOver || timerSeconds === 0) return;
        if (currentTurn === 'w') {
            whiteTime--;
            if (whiteTime <= 0) {
                endGame('Black wins on Time! ⏱️', '♚');
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                endGame('White wins on Time! ⏱️', '♔');
            }
        }
        updateClockDisplay();
    }, 1000);
}

function stopClocks() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

function updateClockDisplay() {
    if (timerSeconds === 0) {
        if (chessTopClock) chessTopClock.textContent = '∞';
        if (chessBottomClock) chessBottomClock.textContent = '∞';
        return;
    }

    const formatTime = (s) => {
        const m = Math.floor(Math.max(0, s) / 60);
        const sec = Math.max(0, s) % 60;
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    if (chessTopClock) {
        chessTopClock.textContent = formatTime(playerColor === 'b' ? whiteTime : blackTime);
        if ((playerColor === 'b' ? whiteTime : blackTime) < 30) chessTopClock.classList.add('low-time');
        else chessTopClock.classList.remove('low-time');
    }
    if (chessBottomClock) {
        chessBottomClock.textContent = formatTime(playerColor === 'b' ? blackTime : whiteTime);
        if ((playerColor === 'b' ? blackTime : whiteTime) < 30) chessBottomClock.classList.add('low-time');
        else chessBottomClock.classList.remove('low-time');
    }
}

function onSquareClick(r, c) {
    if (isSetupMode) {
        handleSetupSquareClick(r, c);
        return;
    }

    if (isGameOver) return;

    if (isMultiplayer) {
        if ((currentTurn === 'w' && playerColor !== 'w') || (currentTurn === 'b' && playerColor !== 'b')) {
            return;
        }
    }
    if (gameMode === 'bot' && currentTurn === 'b') {
        return;
    }

    const piece = boardState[r] ? boardState[r][c] : null;

    const targetMove = legalMovesForSelected.find(m => m.to.r === r && m.to.c === c);
    if (targetMove) {
        executeMove(targetMove);
        return;
    }

    if (piece && ((currentTurn === 'w' && isWhite(piece)) || (currentTurn === 'b' && isBlack(piece)))) {
        selectedSquare = { r, c };
        legalMovesForSelected = getLegalMoves(boardState, currentTurn, castlingRights, enPassantTarget)
            .filter(m => m.from.r === r && m.from.c === c);
    } else {
        selectedSquare = null;
        legalMovesForSelected = [];
    }

    updateSelectionHighlights();
}

function executeMove(move) {
    const fromPiece = boardState[move.from.r][move.from.c];
    const targetPiece = boardState[move.to.r][move.to.c];
    const isCapture = targetPiece !== null || move.isEnPassant;

    if (move.isPromotion) {
        promptPromotion(move, (promotedPiece) => {
            finalizeMove(move, promotedPiece, isCapture);
        });
        return;
    }

    finalizeMove(move, null, isCapture);
}

async function finalizeMove(move, promotedPiece = null, isCapture = false) {
    const fromPiece = boardState[move.from.r][move.from.c];
    
    const snapshot = {
        board: copyBoard(boardState),
        turn: currentTurn,
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
        move
    };

    boardState[move.to.r][move.to.c] = promotedPiece || fromPiece;
    boardState[move.from.r][move.from.c] = null;

    if (move.isEnPassant) {
        const capturedPawnRow = move.from.r;
        boardState[capturedPawnRow][move.to.c] = null;
    }

    if (move.isCastle) {
        const row = move.from.r;
        if (move.isCastle === 'k') {
            boardState[row][5] = boardState[row][7];
            boardState[row][7] = null;
        } else if (move.isCastle === 'q') {
            boardState[row][3] = boardState[row][0];
            boardState[row][0] = null;
        }
    }

    if (move.isEnPassantDouble) {
        enPassantTarget = { r: (move.from.r + move.to.r) / 2, c: move.from.c };
    } else {
        enPassantTarget = null;
    }

    if (fromPiece === 'K') { castlingRights.w.k = false; castlingRights.w.q = false; }
    if (fromPiece === 'k') { castlingRights.b.k = false; castlingRights.b.q = false; }
    if (fromPiece === 'R' && move.from.r === 7 && move.from.c === 0) castlingRights.w.q = false;
    if (fromPiece === 'R' && move.from.r === 7 && move.from.c === 7) castlingRights.w.k = false;
    if (fromPiece === 'r' && move.from.r === 0 && move.from.c === 0) castlingRights.b.q = false;
    if (fromPiece === 'r' && move.from.r === 0 && move.from.c === 7) castlingRights.b.k = false;

    const san = generateSAN(snapshot.board, move, promotedPiece);
    snapshot.san = san;
    moveHistory.push(snapshot);

    lastMove = move;
    selectedSquare = null;
    legalMovesForSelected = [];

    const nextTurn = currentTurn === 'w' ? 'b' : 'w';

    const inCheck = isKingInCheck(boardState, nextTurn);
    if (inCheck) {
        playSound('check');
    } else if (isCapture) {
        playSound('capture');
    } else {
        playSound('move');
    }

    const nextLegalMoves = getLegalMoves(boardState, nextTurn, castlingRights, enPassantTarget);
    let isGameEnd = false;
    let endMessage = '';
    let endIcon = '🏆';

    if (nextLegalMoves.length === 0) {
        isGameEnd = true;
        if (inCheck) {
            const winner = currentTurn === 'w' ? 'White' : 'Black';
            endMessage = `Checkmate! ${winner} wins! 🏆`;
            endIcon = winner === 'White' ? '♔' : '♚';
        } else {
            endMessage = 'Stalemate! Game is a Draw. 🤝';
            endIcon = '🤝';
        }
    }

    currentTurn = nextTurn;

    if (isMultiplayer && roomName) {
        await update(ref(database, `game/chess/rooms/${roomName}`), {
            board: boardToFirebase(boardState),
            turn: currentTurn,
            castlingRights: castlingRights,
            enPassantTarget: enPassantTarget || null,
            moveHistory: moveHistory,
            lastMove: move,
            isGameOver: isGameEnd,
            statusText: endMessage,
            winnerIcon: endIcon
        });
    } else {
        if (isGameEnd) {
            endGame(endMessage, endIcon);
        }
        renderBoard();
        updateUIInfo();

        if (gameMode === 'bot' && currentTurn === 'b' && !isGameOver) {
            setTimeout(() => {
                const botMove = getBestBotMove(boardState, 'b', botDifficulty, castlingRights, enPassantTarget);
                if (botMove) {
                    executeMove(botMove);
                }
            }, 400);
        }
    }
}

function promptPromotion(move, callback) {
    chessPromoChoices.innerHTML = '';
    const promoPieces = currentTurn === 'w' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    promoPieces.forEach(p => {
        const btn = document.createElement('div');
        btn.className = 'chess-promo-btn';
        btn.innerHTML = PIECE_SVGS[p];
        btn.addEventListener('click', () => {
            chessPromoModal.style.display = 'none';
            callback(p);
        });
        chessPromoChoices.appendChild(btn);
    });

    chessPromoModal.style.display = 'flex';
}

function undoLastMove() {
    if (moveHistory.length === 0 || isGameOver) return;

    const popCount = (gameMode === 'bot' && moveHistory.length >= 2) ? 2 : 1;

    for (let i = 0; i < popCount; i++) {
        const lastSnapshot = moveHistory.pop();
        if (!lastSnapshot) break;
        boardState = copyBoard(lastSnapshot.board);
        currentTurn = lastSnapshot.turn;
        castlingRights = JSON.parse(JSON.stringify(lastSnapshot.castlingRights));
        enPassantTarget = lastSnapshot.enPassantTarget;
    }

    lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].move : null;
    selectedSquare = null;
    legalMovesForSelected = [];
    renderBoard();
    updateUIInfo();
    playSound('move');
}

function generateSAN(board, move, promotedPiece) {
    const piece = board[move.from.r][move.from.c];
    const type = piece.toUpperCase();
    const isCapture = board[move.to.r][move.to.c] !== null || move.isEnPassant;
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    if (move.isCastle === 'k') return 'O-O';
    if (move.isCastle === 'q') return 'O-O-O';

    let notation = '';
    if (type !== 'P') {
        notation += type;
    } else if (isCapture) {
        notation += files[move.from.c];
    }

    if (isCapture) notation += 'x';
    notation += `${files[move.to.c]}${8 - move.to.r}`;

    if (promotedPiece) {
        notation += `=${promotedPiece.toUpperCase()}`;
    }
    return notation;
}

function endGame(message, icon = '🏆') {
    isGameOver = true;
    stopClocks();
    playSound('win');

    if (chessGameOverTitle) chessGameOverTitle.textContent = message.includes('Checkmate') ? 'Checkmate!' : 'Game Over';
    if (chessGameOverDesc) chessGameOverDesc.textContent = message;
    if (chessGameOverIcon) chessGameOverIcon.textContent = icon;
    if (chessGameOverModal) chessGameOverModal.style.display = 'flex';
}

// -------------------------------------------------------------
// RENDERING BOARD & UI
// -------------------------------------------------------------
function renderBoard() {
    if (!chessBoardElem) return;

    const kingInCheckPos = isKingInCheck(boardState, currentTurn) ? findKing(boardState, currentTurn) : null;
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Check if board squares already exist; if not, build them once
    const existingSquares = chessBoardElem.querySelectorAll('.chess-square');
    const needsBuild = existingSquares.length !== 64 || chessBoardElem.dataset.flipped !== String(isFlipped);

    if (needsBuild) {
        chessBoardElem.innerHTML = '';
        chessBoardElem.dataset.flipped = String(isFlipped);

        for (let i = 0; i < 64; i++) {
            let r = Math.floor(i / 8);
            let c = i % 8;

            if (isFlipped) {
                r = 7 - r;
                c = 7 - c;
            }

            const square = document.createElement('div');
            const isLight = (r + c) % 2 === 0;
            square.className = `chess-square ${isLight ? 'light-sq' : 'dark-sq'}`;
            square.dataset.r = r;
            square.dataset.c = c;

            if ((!isFlipped && c === 0) || (isFlipped && c === 7)) {
                const rankLabel = document.createElement('span');
                rankLabel.className = 'coord-rank';
                rankLabel.textContent = 8 - r;
                square.appendChild(rankLabel);
            }
            if ((!isFlipped && r === 7) || (isFlipped && r === 0)) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'coord-file';
                fileLabel.textContent = files[c];
                square.appendChild(fileLabel);
            }

            square.addEventListener('click', () => onSquareClick(r, c));
            chessBoardElem.appendChild(square);
        }
    }

    // Update squares, highlights, and pieces in-place
    const squares = chessBoardElem.querySelectorAll('.chess-square');
    squares.forEach(square => {
        const r = parseInt(square.dataset.r, 10);
        const c = parseInt(square.dataset.c, 10);

        // Update highlight classes
        if (isSetupMode) {
            if (setupSelectedSquare && setupSelectedSquare.r === r && setupSelectedSquare.c === c) {
                square.classList.add('selected-sq');
            } else {
                square.classList.remove('selected-sq');
            }
            square.classList.remove('last-move-sq');
            square.classList.remove('in-check-sq');
        } else {
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                square.classList.add('selected-sq');
            } else {
                square.classList.remove('selected-sq');
            }

            if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
                square.classList.add('last-move-sq');
            } else {
                square.classList.remove('last-move-sq');
            }

            if (kingInCheckPos && kingInCheckPos.r === r && kingInCheckPos.c === c) {
                square.classList.add('in-check-sq');
            } else {
                square.classList.remove('in-check-sq');
            }
        }

        // Update move indicator rings & dots
        const existingDot = square.querySelector('.move-dot');
        if (existingDot) existingDot.remove();
        const existingRing = square.querySelector('.capture-ring');
        if (existingRing) existingRing.remove();

        const legalMove = !isSetupMode ? legalMovesForSelected.find(m => m.to.r === r && m.to.c === c) : null;
        if (legalMove) {
            const isCaptureTarget = (boardState[r] && boardState[r][c] !== null) || legalMove.isEnPassant;
            if (isCaptureTarget) {
                const ring = document.createElement('div');
                ring.className = 'capture-ring';
                square.appendChild(ring);
            } else {
                const dot = document.createElement('div');
                dot.className = 'move-dot';
                square.appendChild(dot);
            }
        }

        // Update pieces in-place per square without re-creating DOM nodes if the piece hasn't changed
        const currentPiece = (boardState && boardState[r]) ? boardState[r][c] : null;
        let pieceElem = square.querySelector('.chess-piece');

        if (currentPiece) {
            if (pieceElem) {
                if (pieceElem.dataset.piece !== currentPiece) {
                    pieceElem.dataset.piece = currentPiece;
                    const img = pieceElem.querySelector('img');
                    if (img) {
                        img.src = PIECE_IMAGES[currentPiece];
                        img.alt = currentPiece;
                    } else {
                        pieceElem.innerHTML = PIECE_SVGS[currentPiece] || UNICODE_PIECES[currentPiece];
                    }
                }
            } else {
                pieceElem = document.createElement('div');
                pieceElem.className = 'chess-piece';
                pieceElem.dataset.piece = currentPiece;
                pieceElem.innerHTML = PIECE_SVGS[currentPiece] || UNICODE_PIECES[currentPiece];
                square.appendChild(pieceElem);
            }
        } else {
            if (pieceElem) {
                pieceElem.remove();
            }
        }
    });
}

function updateSelectionHighlights() {
    if (!chessBoardElem) return;
    const squares = chessBoardElem.querySelectorAll('.chess-square');

    squares.forEach(sq => {
        const r = parseInt(sq.dataset.r, 10);
        const c = parseInt(sq.dataset.c, 10);

        // Update selected state
        if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            sq.classList.add('selected-sq');
        } else {
            sq.classList.remove('selected-sq');
        }

        // Remove existing dots and rings
        const existingDot = sq.querySelector('.move-dot');
        if (existingDot) existingDot.remove();
        const existingRing = sq.querySelector('.capture-ring');
        if (existingRing) existingRing.remove();

        // Check for legal moves on this square
        const legalMove = legalMovesForSelected.find(m => m.to.r === r && m.to.c === c);
        if (legalMove) {
            const isCaptureTarget = (boardState[r] && boardState[r][c] !== null) || legalMove.isEnPassant;
            if (isCaptureTarget) {
                const ring = document.createElement('div');
                ring.className = 'capture-ring';
                sq.appendChild(ring);
            } else {
                const dot = document.createElement('div');
                dot.className = 'move-dot';
                sq.appendChild(dot);
            }
        }
    });
}

function updateUIInfo() {
    updateSetupBtnVisibility();

    if (chessStatusText) {
        if (isSetupMode) {
            chessStatusText.textContent = '🛠️ Board Setup Mode (Host)';
        } else if (isGameOver) {
            chessStatusText.textContent = 'Game Ended';
        } else {
            const inCheck = isKingInCheck(boardState, currentTurn);
            const turnName = currentTurn === 'w' ? 'White' : 'Black';

            if (isMultiplayer) {
                const isYourTurn = (currentTurn === 'w' && playerColor === 'w') || (currentTurn === 'b' && playerColor === 'b');
                if (inCheck) {
                    chessStatusText.textContent = isYourTurn ? '⚠️ YOU ARE IN CHECK!' : `⚠️ ${turnName} is in CHECK!`;
                } else {
                    chessStatusText.textContent = isYourTurn ? '🟢 YOUR TURN!' : `⏳ Waiting for ${turnName}...`;
                }
            } else {
                chessStatusText.textContent = inCheck ? `⚠️ ${turnName} is in CHECK!` : `${turnName}'s Turn`;
            }
        }
    }

    const topBar = document.getElementById('chess-player-top');
    const bottomBar = document.getElementById('chess-player-bottom');

    const isBottomWhite = !isFlipped;
    const isWhiteTurn = currentTurn === 'w';

    if (topBar && bottomBar) {
        if ((isWhiteTurn && isBottomWhite) || (!isWhiteTurn && !isBottomWhite)) {
            bottomBar.classList.add('active-turn');
            topBar.classList.remove('active-turn');
        } else {
            topBar.classList.add('active-turn');
            bottomBar.classList.remove('active-turn');
        }
    }

    let whiteMaterial = 0;
    let blackMaterial = 0;
    const capturedWhite = [];
    const capturedBlack = [];

    const initialCounts = { 'P': 8, 'N': 2, 'B': 2, 'R': 2, 'Q': 1, 'p': 8, 'n': 2, 'b': 2, 'r': 2, 'q': 1 };
    const currentCounts = { 'P': 0, 'N': 0, 'B': 0, 'R': 0, 'Q': 0, 'p': 0, 'n': 0, 'b': 0, 'r': 0, 'q': 0 };

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = boardState[r] ? boardState[r][c] : null;
            if (p) {
                if (currentCounts[p] !== undefined) currentCounts[p]++;
                if (isWhite(p)) whiteMaterial += PIECE_VALUES[p];
                else blackMaterial += PIECE_VALUES[p];
            }
        }
    }

    for (const [p, init] of Object.entries(initialCounts)) {
        const diff = init - (currentCounts[p] || 0);
        for (let i = 0; i < diff; i++) {
            if (isWhite(p)) capturedWhite.push(p);
            else capturedBlack.push(p);
        }
    }

    const whiteScoreDiff = Math.max(0, whiteMaterial - blackMaterial);
    const blackScoreDiff = Math.max(0, blackMaterial - whiteMaterial);

    const renderCaptured = (container, list) => {
        if (!container) return;
        const key = list.join('');
        if (container.dataset.capturedKey === key) return;
        container.dataset.capturedKey = key;
        container.innerHTML = list.map(p => 
            `<img src="${PIECE_IMAGES[p]}" class="chess-captured-mini" alt="${p}" title="${p}" />`
        ).join('');
    };

    if (isFlipped) {
        if (chessBottomCaptured) renderCaptured(chessBottomCaptured, capturedWhite);
        if (chessTopCaptured) renderCaptured(chessTopCaptured, capturedBlack);
        if (chessBottomScore) chessBottomScore.textContent = blackScoreDiff > 0 ? `+${blackScoreDiff}` : '';
        if (chessTopScore) chessTopScore.textContent = whiteScoreDiff > 0 ? `+${whiteScoreDiff}` : '';
    } else {
        if (chessBottomCaptured) renderCaptured(chessBottomCaptured, capturedBlack);
        if (chessTopCaptured) renderCaptured(chessTopCaptured, capturedWhite);
        if (chessBottomScore) chessBottomScore.textContent = whiteScoreDiff > 0 ? `+${whiteScoreDiff}` : '';
        if (chessTopScore) chessTopScore.textContent = blackScoreDiff > 0 ? `+${blackScoreDiff}` : '';
    }

    if (chessMoveLog) {
        chessMoveLog.innerHTML = '';
        for (let i = 0; i < moveHistory.length; i += 2) {
            const moveRow = document.createElement('div');
            moveRow.className = 'chess-move-row';

            const numSpan = document.createElement('span');
            numSpan.className = 'chess-move-num';
            numSpan.textContent = `${Math.floor(i / 2) + 1}.`;

            const whiteSpan = document.createElement('span');
            whiteSpan.className = 'chess-move-white';
            whiteSpan.textContent = moveHistory[i].san || '';

            const blackSpan = document.createElement('span');
            blackSpan.className = 'chess-move-black';
            blackSpan.textContent = moveHistory[i + 1] ? moveHistory[i + 1].san : '';

            moveRow.appendChild(numSpan);
            moveRow.appendChild(whiteSpan);
            moveRow.appendChild(blackSpan);
            chessMoveLog.appendChild(moveRow);
        }
        chessMoveLog.scrollTop = chessMoveLog.scrollHeight;
    }
}
