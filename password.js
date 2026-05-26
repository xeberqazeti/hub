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
import { adjectives, animalNames } from './constants.js';

// Firebase Configuration
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

// Complete Seed Nouns List covering every letter from the Azerbaijani alphabet as fallbacks
const seedNouns = [
    // A
    'ailə', 'alma', 'adam', 'ağac', 'ayaqqabı',
    // B
    'banan', 'badımcan', 'balıq', 'budaq', 'bazar',
    // C
    'cırtdan', 'cavan', 'cihaz', 'cədvəl', 'cənnət',
    // Ç
    'çörək', 'çay', 'çanta', 'çiçək', 'çiyələk',
    // D
    'dağ', 'dəniz', 'dost', 'dəftər', 'duz',
    // E
    'ev', 'elm', 'elçi', 'əlcək', 'əsgər',
    // Ə
    'ərik', 'əncir', 'əti', 'əqrəb', 'əfsanə',
    // F
    'fırça', 'fındıq', 'fil', 'fırtına', 'fikir',
    // G
    'gün', 'gecə', 'günəş', 'güzgü', 'gül',
    // Ğ
    'kağız', 'yağış', 'bağban', 'dağcı', 'oğlan', // Ğ is rarely initial, usually internal
    // H
    'hava', 'həyat', 'heyvan', 'həkim', 'hədiyyə',
    // X
    'xiyar', 'xəstəxana', 'xalça', 'xəritə', 'xəyal',
    // I
    'ildırım', 'isiq', 'itki', 'inanc', 'idman',
    // İ
    'insan', 'it', 'inək', 'il', 'ibarə',
    // J
    'jurnal', 'jilet', 'jest', 'ketçup', 'joker',
    // K
    'kitab', 'kompüter', 'kamera', 'kino', 'kənd',
    // Q
    'qadın', 'qapı', 'qəzet', 'qarpız', 'qoyun',
    // L
    'limon', 'ləpə', 'lampa', 'layihə', 'ləğv',
    // M
    'maşın', 'meyvə', 'musiqi', 'məktəb', 'müəllim',
    // N
    'nar', 'nəsil', 'nəğmə', 'nəfəs', 'nəzarət',
    // O
    'otaq', 'ot', 'odun', 'oğru', 'orqan',
    // Ö
    'örpək', 'ördək', 'ölkə', 'ömür', 'öküz',
    // P
    'paltar', 'papaq', 'pəncərə', 'pendir', 'pomidor',
    // R
    'rəsm', 'rəng', 'radio', 'rəqib', 'rəhbər',
    // S
    'su', 'süd', 'saat', 'sabun', 'soğan',
    // Ş
    'şəhər', 'şəkər', 'şeftali', 'şir', 'şüşə',
    // T
    'tələbə', 'telefon', 'televizor', 'toyuq', 'teatr',
    // U
    'ushaq', 'ulduz', 'un', 'tufan', 'uyğunluq',
    // Ü
    'ürək', 'üzüm', 'ütü', 'üzük', 'üzv',
    // V
    'vərəq', 'vağzal', 'vətən', 'vulkan', 'vəzifə',
    // Y
    'yemək', 'yol', 'yarpaq', 'yemiş', 'yumurta',
    // Z
    'zəng', 'zəncir', 'zəfər', 'zolaq', 'zəlzələ'
];

let wiktiNouns = [];

// Deep sequential crawling of Wiktionary main nouns category (crawls through all 10 paginated pages sequentially A-Z)
async function fetchWiktionaryNouns() {
    try {
        console.log('🔄 Crawling all 10 paginated pages of Category:Azerbaijani_nouns (A-Z)...');
        let allNouns = [];
        let cmcontinue = '';
        
        // Loop 10 times to sequentially fetch up to 5,000 main base nouns across all alphabetical ranges/pages
        for (let page = 0; page < 10; page++) {
            const url = `https://en.wiktionary.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Azerbaijani_nouns&cmlimit=500&format=json&origin=*${cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.query && data.query.categorymembers) {
                const pageNouns = data.query.categorymembers
                    .map(m => m.title.toLowerCase())
                    .filter(title => {
                        const clean = title.trim();
                        // Exclude subcategory names, files, and multi-part/compound nouns (containing spaces or hyphens)
                        return !clean.includes(':') && 
                               !clean.includes('/') && 
                               !clean.includes(' ') && 
                               !clean.includes('-') && 
                               clean.length > 1;
                    });
                allNouns = allNouns.concat(pageNouns);
            }

            // Move to next paginated range
            if (data.continue && data.continue.cmcontinue) {
                cmcontinue = data.continue.cmcontinue;
            } else {
                break;
            }
        }

        // Deduplicate words
        const uniqueNouns = [...new Set(allNouns)];

        if (uniqueNouns.length > 50) {
            wiktiNouns = uniqueNouns;
            console.log(`✅ Crawled main nouns successfully! Loaded ${wiktiNouns.length} unique base Azerbaijani nouns (with zero suffix/inflected variants)!`);
        }
    } catch (err) {
        console.warn('⚠️ Wiktionary main noun crawl failed, using seed nouns list.', err);
    }
}

// Call on startup
fetchWiktionaryNouns();

function getNounsPool() {
    return wiktiNouns.length > 20 ? wiktiNouns : seedNouns;
}

// Game State
let roomName = '';
let playerId = '';
let playerName = '';
let players = {};
let gameStatus = 'lobby';
let unsubscribePlayers = null;
let unsubscribeRoom = null;
let unsubscribeActiveRooms = null;

// DOM Elements
const selectionScreen = document.getElementById('selection-screen');
const selectPassword = document.getElementById('select-password');
const lobbyScreen = document.getElementById('password-lobby-screen');
const gameScreen = document.getElementById('password-game-screen');
const joinSection = document.getElementById('password-join-section');
const lobbySection = document.getElementById('password-lobby-section');
const playersList = document.getElementById('password-players-list');
const gamePlayersList = document.getElementById('password-game-players-list');
const nounsGrid = document.getElementById('password-nouns-grid');

const activeRoomsSection = document.getElementById('password-active-rooms-section');
const activeRoomsList = document.getElementById('password-active-rooms-list');

// Buttons
const joinBtn = document.getElementById('password-join-btn');
const startBtn = document.getElementById('password-start-btn');
const leaveBtn = document.getElementById('password-leave-btn');
const backBtn = document.getElementById('password-back-btn');
const quitBtn = document.getElementById('password-quit-btn');
const skipBtn = document.getElementById('password-skip-btn');

// Room Name and Player Inputs
const roomInput = document.getElementById('password-room-name');
const nameInput = document.getElementById('password-player-name');

// Set Screen Navigation
if (selectPassword) {
    selectPassword.addEventListener('click', () => {
        selectionScreen.classList.remove('active');
        lobbyScreen.classList.add('active');
        startActiveRoomsListener();
    });
}

if (backBtn) backBtn.addEventListener('click', leavePasswordLobby);
if (quitBtn) quitBtn.addEventListener('click', leavePasswordLobby);
if (leaveBtn) leaveBtn.addEventListener('click', leavePasswordLobby);
if (joinBtn) joinBtn.addEventListener('click', joinPasswordRoom);
if (startBtn) startBtn.addEventListener('click', startPasswordGame);
if (skipBtn) skipBtn.addEventListener('click', skipNouns);

// Active Rooms Listener for Password Game
function startActiveRoomsListener() {
    if (unsubscribeActiveRooms) return;

    if (!playerId && activeRoomsSection) {
        activeRoomsSection.style.display = 'block';
    }

    const roomsRef = ref(database, 'game/password');
    unsubscribeActiveRooms = onValue(roomsRef, (snapshot) => {
        const rooms = snapshot.val() || {};
        const activeRooms = [];

        for (const [rName, roomData] of Object.entries(rooms)) {
            const players = roomData.players || {};
            const playerCount = Object.keys(players).length;

            if (playerCount > 0 && roomData.status === 'lobby') {
                activeRooms.push({
                    name: rName,
                    count: playerCount
                });
            }
        }

        // Always display default quick-join rooms "Otaq 1" and "Otaq 2"
        const defaultRooms = ['Otaq 1', 'Otaq 2'];
        defaultRooms.forEach(defRoom => {
            const lowerName = defRoom.toLowerCase();
            const exists = activeRooms.some(r => r.name.toLowerCase() === lowerName);
            if (!exists) {
                const roomData = rooms[lowerName] || {};
                const players = roomData.players || {};
                const count = Object.keys(players).length;
                const status = roomData.status || 'lobby';

                // Display if lobby state or doesn't exist yet
                if (status === 'lobby') {
                    activeRooms.push({
                        name: defRoom,
                        count: count
                    });
                }
            }
        });

        if (activeRoomsList) {
            if (activeRooms.length === 0) {
                activeRoomsList.innerHTML = '<p class="waiting-text">No active rooms found. Create one above!</p>';
            } else {
                activeRoomsList.innerHTML = activeRooms.map(room => `
                    <button class="btn btn-secondary password-active-room-btn" data-room="${escapeHtml(room.name)}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; width: 100%;">
                        <span>${escapeHtml(room.name)}</span>
                        <span class="badge" style="background: var(--primary);">${room.count} player${room.count > 1 ? 's' : ''}</span>
                    </button>
                `).join('');

                // Click listeners for active room buttons
                document.querySelectorAll('.password-active-room-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const targetRoom = e.currentTarget.getAttribute('data-room');
                        quickJoinRoom(targetRoom);
                    });
                });
            }
        }
    });
}

function stopActiveRoomsListener() {
    if (unsubscribeActiveRooms) {
        unsubscribeActiveRooms();
        unsubscribeActiveRooms = null;
    }
    if (activeRoomsSection) {
        activeRoomsSection.style.display = 'none';
    }
}

function quickJoinRoom(targetRoom) {
    if (roomInput) roomInput.value = targetRoom;

    // Generate cool random name
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimalStr = animalNames[Math.floor(Math.random() * animalNames.length)];
    const [, ...animalParts] = randomAnimalStr.split(' ');
    const randomAnimal = animalParts.join('');

    const randomName = `${randomAdjective}${randomAnimal}`;
    if (nameInput) nameInput.value = randomName;

    joinPasswordRoom();
}

async function joinPasswordRoom() {
    roomName = roomInput.value.trim().toLowerCase();
    playerName = nameInput.value.trim();

    if (!roomName) return alert('Enter room name');
    if (!playerName) return alert('Enter name');

    try {
        const playerRef = ref(database, `game/password/${roomName}/players`);
        const roomRef = ref(database, `game/password/${roomName}`);

        // Get snapshot to check status
        const snap = await get(roomRef);
        const roomData = snap.val() || {};

        if (roomData.status === 'started') {
            return alert('Game has already started in this room!');
        }

        const newPlayerRef = push(playerRef);
        playerId = newPlayerRef.key;

        await set(newPlayerRef, {
            name: playerName,
            joinedAt: Date.now()
        });

        // Set status to lobby if it doesn't exist
        if (!roomData.status) {
            await update(roomRef, { status: 'lobby' });
        }

        onDisconnect(newPlayerRef).remove();

        joinSection.style.display = 'none';
        lobbySection.style.display = 'block';

        stopActiveRoomsListener();
        setupRealtimeListeners();
    } catch (err) {
        console.error(err);
        alert('Failed to join room: ' + err.message);
    }
}

function setupRealtimeListeners() {
    const roomRef = ref(database, `game/password/${roomName}`);
    const playersRef = ref(database, `game/password/${roomName}/players`);

    unsubscribePlayers = onValue(playersRef, (snap) => {
        players = snap.val() || {};
        const pArray = Object.keys(players);

        // If we were kicked or removed
        if (playerId && !players[playerId]) {
            resetToSelection();
            return;
        }

        updateLobbyUI();
        updateGamePlayersUI();

        // Show Start button if we have at least 2 players
        if (startBtn) {
            startBtn.style.display = pArray.length >= 2 ? 'block' : 'none';
        }
    });

    unsubscribeRoom = onValue(roomRef, (snap) => {
        const data = snap.val() || {};
        gameStatus = data.status || 'lobby';

        if (gameStatus === 'started') {
            showGameScreen(data);
        } else {
            showLobbyScreen();
        }
    });
}

function updateLobbyUI() {
    if (!playersList) return;
    playersList.innerHTML = Object.values(players).map(p => `
        <div class="player-item">
            <span class="player-icon">👤</span>
            <span class="player-name">${escapeHtml(p.name)}</span>
        </div>
    `).join('');
}

function updateGamePlayersUI() {
    if (!gamePlayersList) return;
    gamePlayersList.innerHTML = Object.values(players).map(p => `
        <div class="player-item">
            <span class="player-icon">👤</span>
            <span class="player-name">${escapeHtml(p.name)}</span>
        </div>
    `).join('');
}

function showLobbyScreen() {
    gameScreen.classList.remove('active');
    lobbyScreen.classList.add('active');
    joinSection.style.display = 'none';
    lobbySection.style.display = 'block';
}

function showGameScreen(roomData) {
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');

    // Display the nouns
    const currentNouns = roomData.currentNouns || [];
    const highlights = roomData.highlights || {};
    const playerArray = Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    // Make nouns grid interactive
    nounsGrid.innerHTML = currentNouns.map((noun, index) => {
        const nounHighlights = highlights[index] || {};
        const highlightedPlayers = Object.keys(nounHighlights);

        let highlightClass = '';
        let badgeHTML = '';

        if (highlightedPlayers.length > 0) {
            const isP1Highlighted = playerArray[0] && nounHighlights[playerArray[0][0]];
            const isP2Highlighted = playerArray[1] && nounHighlights[playerArray[1][0]];

            if (isP1Highlighted && isP2Highlighted) {
                highlightClass = 'highlighted-both';
            } else if (isP1Highlighted) {
                highlightClass = 'highlighted-p1';
            } else if (isP2Highlighted) {
                highlightClass = 'highlighted-p2';
            } else {
                highlightClass = 'highlighted-p1'; // fallback/multiplayer
            }

            badgeHTML = `<div class="noun-badges">` + highlightedPlayers.map(pId => {
                const name = players[pId] ? players[pId].name : 'User';
                const pClass = playerArray[0] && pId === playerArray[0][0] ? 'p1' : 'p2';
                return `<span class="noun-badge ${pClass}">${escapeHtml(name)}</span>`;
            }).join('') + `</div>`;
        }

        return `
            <div class="noun-card ${highlightClass}" data-index="${index}">
                <span>${escapeHtml(noun)}</span>
                ${badgeHTML}
            </div>
        `;
    }).join('');

    // Attach click listeners to nouns
    document.querySelectorAll('.noun-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const index = e.currentTarget.getAttribute('data-index');
            toggleHighlight(index);
        });
    });
}

// Generate unique non-repeating words using rooms history in Firebase
async function getUniqueNouns(count) {
    const roomRef = ref(database, `game/password/${roomName}`);
    const roomSnap = await get(roomRef);
    const roomData = roomSnap.val() || {};
    const usedNouns = roomData.usedNouns || {};
    const pool = getNounsPool();
    
    // Filter out used nouns
    const availableNouns = pool.filter(word => !usedNouns[word]);
    
    // If pool is too small, reset used nouns history
    let nounsToChooseFrom = availableNouns;
    if (availableNouns.length < count) {
        console.log('🔄 Word pool exhausted, resetting used nouns history...');
        nounsToChooseFrom = pool;
        await set(ref(database, `game/password/${roomName}/usedNouns`), {});
    }
    
    const chosenNouns = [];
    const tempPool = [...nounsToChooseFrom];
    for (let i = 0; i < count; i++) {
        if (tempPool.length === 0) break;
        const randIndex = Math.floor(Math.random() * tempPool.length);
        chosenNouns.push(tempPool.splice(randIndex, 1)[0]);
    }
    
    // Mark as used in database
    const newUsedUpdates = {};
    chosenNouns.forEach(noun => {
        newUsedUpdates[`usedNouns/${noun}`] = true;
    });
    await update(roomRef, newUsedUpdates);
    
    return chosenNouns;
}

async function startPasswordGame() {
    try {
        const chosenNouns = await getUniqueNouns(5);

        const roomRef = ref(database, `game/password/${roomName}`);
        await update(roomRef, {
            status: 'started',
            currentNouns: chosenNouns,
            highlights: {},
            skips: null
        });
    } catch (err) {
        console.error(err);
        alert('Failed to start game: ' + err.message);
    }
}

async function toggleHighlight(nounIndex) {
    try {
        const highlightsRef = ref(database, `game/password/${roomName}/highlights/${nounIndex}/${playerId}`);
        const snap = await get(highlightsRef);

        if (snap.exists()) {
            await remove(highlightsRef);
        } else {
            await set(highlightsRef, true);
        }
    } catch (err) {
        console.error(err);
    }
}

async function skipNouns() {
    try {
        const chosenNouns = await getUniqueNouns(5);

        const roomRef = ref(database, `game/password/${roomName}`);
        await update(roomRef, {
            currentNouns: chosenNouns,
            highlights: {},
            skips: null
        });
    } catch (err) {
        console.error(err);
    }
}

async function leavePasswordLobby() {
    if (playerId && roomName) {
        try {
            await remove(ref(database, `game/password/${roomName}/players/${playerId}`));
            
            // If room is empty, clear the room
            const playersRef = ref(database, `game/password/${roomName}/players`);
            const playersSnap = await get(playersRef);
            if (!playersSnap.exists()) {
                await remove(ref(database, `game/password/${roomName}`));
            }
        } catch (err) {
            console.error(err);
        }
    }
    resetToSelection();
}

function resetToSelection() {
    if (unsubscribePlayers) {
        unsubscribePlayers();
        unsubscribePlayers = null;
    }
    if (unsubscribeRoom) {
        unsubscribeRoom();
        unsubscribeRoom = null;
    }
    stopActiveRoomsListener();

    playerId = '';
    roomName = '';
    players = {};
    gameStatus = 'lobby';

    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    selectionScreen.classList.add('active');

    // Reset UI fields
    joinSection.style.display = 'block';
    lobbySection.style.display = 'none';
    roomInput.value = '';
    nameInput.value = '';
}

function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}
