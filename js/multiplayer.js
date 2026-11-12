// Online matches use a browser-hosted authoritative simulation. Fly assigns a
// room and relays input/state; bots keep every empty seat active immediately.
const ONLINE_FORMATS = Object.freeze({
    teams3: { teamSize: 3, teamCount: 4, capacity: 12, label: '3v3v3v3' },
    teams4: { teamSize: 4, teamCount: 2, capacity: 8, label: '4v4' },
    teams5: { teamSize: 5, teamCount: 2, capacity: 10, label: '5v5' },
    teams6: { teamSize: 6, teamCount: 2, capacity: 12, label: '6v6' }
});

const ONLINE_SKIP_FIELDS = new Set(['weapon', 'brain', 'aiInput', 'joints', 'rag', 'statusSrc', 'lastAttacker', 'target', 'socket', '__proto__', 'constructor', 'prototype']);

function onlineCopy(value, depth = 0, seen = new WeakSet()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'object' || depth > 7) return undefined;
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 3000).map(v => onlineCopy(v, depth + 1, seen));
    if (value instanceof Set) return [...value].slice(0, 500).map(v => onlineCopy(v, depth + 1, seen));
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (ONLINE_SKIP_FIELDS.has(key) || typeof item === 'function') continue;
        const copied = onlineCopy(item, depth + 1, seen);
        if (copied !== undefined) out[key] = copied;
    }
    return out;
}

class MultiplayerClient {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.explicitLeave = false;
        this.isGuest = false;
        this.isHost = false;
        this.uiPaused = false;
        this.socket = null;
        this.roomId = null;
        this.resumeToken = null;
        this.mySeat = null;
        this.localSeats = [];
        this.localSeatNames = new Map();
        this.localControlTypes = [];
        this.partySize = 1;
        this.summary = null;
        this.skill = 'easy';
        this.name = 'PLAYER';
        this.lastInputSent = 0;
        this.lastSnapshotSent = 0;
        this.snapshotAppliedAt = 0;
        this.snapshotInterval = 40;
        this.snapshotSeq = 0;
        this.lastSnapshotReceived = -1;
        this.nextNetId = 1;
        this.retries = 0;
        this.retryTimer = null;
        this.connectTimer = null;
        this.statusEl = document.getElementById('online-status');
        this.statusText = document.getElementById('online-status-text');
    }

    static endpoint() {
        const host = location.hostname.endsWith('.fly.dev') ? location.host : 'jimmyqrg.fly.dev';
        return `${location.protocol === 'https:' ? 'wss:' : 'wss:'}//${host}/ws`;
    }

    showStatus(message, error = false) {
        if (this.statusText.textContent === message && this.statusEl.style.display !== 'none') {
            this.statusEl.dataset.error = error ? 'true' : 'false';
            return;
        }
        this.statusText.textContent = message;
        this.statusEl.style.display = 'flex';
        this.statusEl.dataset.error = error ? 'true' : 'false';
    }

    hideStatus() {
        this.statusEl.style.display = 'none';
        delete this.statusEl.dataset.error;
    }

    startMatch(format, skill, name, partySize = 1) {
        if (!ONLINE_FORMATS[format]) return;
        if (this.active) this.leave(false);
        this.active = true;
        this.explicitLeave = false;
        this.isGuest = false;
        this.isHost = false;
        this.uiPaused = false;
        this.roomId = null;
        this.resumeToken = null;
        this.mySeat = null;
        this.localSeats = [];
        this.localSeatNames.clear();
        this.localControlTypes = [];
        this.summary = null;
        this.format = format;
        this.skill = skill;
        this.partySize = Math.max(1, Math.min(ONLINE_FORMATS[format].teamSize, Math.trunc(Number(partySize) || 1)));
        this.name = String(name || 'PLAYER').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || 'PLAYER';
        this.retries = 0;
        this.lastSnapshotReceived = -1;
        document.getElementById('online-menu').style.display = 'none';
        document.getElementById('online-error').textContent = '';
        this.showStatus('Connecting to the Fly match server…');
        this.connect(false);
    }

    connect(resume) {
        if (!this.active || this.explicitLeave) return;
        let socket;
        try { socket = new WebSocket(MultiplayerClient.endpoint()); }
        catch { this.failBeforeMatch('Could not create a connection to the match server.'); return; }
        this.socket = socket;
        this.connectTimer = setTimeout(() => {
            if (socket.readyState === WebSocket.CONNECTING) socket.close();
        }, 9000);
        socket.addEventListener('open', () => {
            clearTimeout(this.connectTimer);
            this.retries = 0;
            if (resume && this.roomId && this.resumeToken) {
                this.send({ type: 'resume', roomId: this.roomId, resumeToken: this.resumeToken });
            } else {
                this.send({ type: 'join', format: this.format, skill: this.skill, name: this.name, partySize: this.partySize });
            }
        });
        socket.addEventListener('message', event => {
            try { this.onMessage(JSON.parse(event.data)); }
            catch { console.warn('Ignored an unreadable Stickman Arena multiplayer message.'); }
        });
        socket.addEventListener('close', () => {
            clearTimeout(this.connectTimer);
            if (this.socket !== socket) return;
            this.socket = null;
            if (!this.active || this.explicitLeave) return;
            if (!this.roomId) {
                this.failBeforeMatch('The match server did not respond. Please try again.');
                return;
            }
            const waits = [300, 650, 1100, 1700, 2300, 3000];
            if (this.retries >= waits.length) {
                this.showStatus('Connection lost. Rejoin within a few seconds to keep your seat.', true);
                this.retryTimer = setTimeout(() => this.expireConnection(), 12_000);
                return;
            }
            this.showStatus('Reconnecting to your match…');
            this.retryTimer = setTimeout(() => {
                if (this.active && !this.explicitLeave) {
                    this.retries++;
                    this.connect(true);
                }
            }, waits[this.retries]);
        });
        socket.addEventListener('error', () => {});
    }

    send(message) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false;
        try { this.socket.send(JSON.stringify(message)); return true; }
        catch { return false; }
    }

    onMessage(message) {
        if (!message || typeof message.type !== 'string') return;
        if (message.type === 'error') {
            if (message.code === 'resume-expired') { this.expireConnection(); return; }
            if (!this.roomId) { this.failBeforeMatch(message.message || 'Could not find a match.'); return; }
            this.showStatus(message.message || 'The match server reported a problem.', true);
            return;
        }
        if (message.type === 'match_found') {
            const resumedHost = this.roomId === message.roomId && this.game.mode === 'online' && message.role === 'host';
            this.roomId = message.roomId;
            this.resumeToken = message.resumeToken;
            this.mySeat = message.seat;
            this.localSeats = (Array.isArray(message.playerSeats) && message.playerSeats.length
                ? message.playerSeats.map(item => item.seat)
                : [message.seat]).filter(Number.isInteger);
            this.localSeatNames = new Map((message.playerSeats || []).map(item => [item.seat, item.name]));
            this.partySize = Math.max(1, this.localSeats.length);
            if (!this.localControlTypes.length) this.configureLocalControls();
            this.summary = message;
            this.isHost = message.role === 'host';
            this.isGuest = !this.isHost;
            this.lastSnapshotReceived = -1;
            if (this.isHost) {
                if (resumedHost) this.syncHostRoster(message);
                else this.startHostGame(message);
                this.showStatus(`${message.label || ONLINE_FORMATS[message.format]?.label || 'MATCH'} · ${this.localSeats.length > 1 ? `${this.localSeats.length} local players are` : 'You are'} in. Bots fill every other seat.`);
            } else {
                this.startGuestShell(message);
                this.showStatus('Match found · waiting for the current game state…');
                if (message.snapshot) this.applySnapshot(message.snapshot);
            }
            return;
        }
        if (message.type === 'room_update') {
            this.summary = message;
            if (this.isHost) this.syncHostRoster(message);
            return;
        }
        if (message.type === 'remote_input' && this.isHost) {
            if (Number.isInteger(message.seat) && !this.localSeats.includes(message.seat)) {
                this.game.networkInputs ||= Object.create(null);
                this.game.networkInputs[message.seat] = this.normalizeInput(message.input);
            }
            return;
        }
        if (message.type === 'snapshot' && this.isGuest) {
            this.applySnapshot(message.data);
            return;
        }
        if (message.type === 'host_changed') {
            const promoted = this.localSeats.includes(message.hostSeat);
            this.isHost = promoted;
            this.isGuest = !promoted;
            this.lastSnapshotSent = 0;
            this.lastSnapshotReceived = -1;
            if (promoted) {
                this.showStatus('Host changed · your game is now simulating the match.');
                this.syncHostRoster(this.summary || {});
                if (this.game.roundOver && this.game.networkTransitionRemaining > 0) {
                    this.game.networkTransitionAt = performance.now() + this.game.networkTransitionRemaining;
                    this.game.networkTransitionRemaining = 0;
                }
            } else this.showStatus('Match host changed · syncing the game…');
            return;
        }
        if (message.type === 'room_closed') {
            if (!this.active && this.explicitLeave) return;
            this.active = false;
            this.explicitLeave = true;
            this.isHost = this.isGuest = false;
            this.uiPaused = false;
            this.localSeats = []; this.localSeatNames.clear(); this.localControlTypes = [];
            this.hideStatus();
            this.game.quitGame();
        }
    }

    failBeforeMatch(message) {
        this.active = false;
        this.explicitLeave = true;
        clearTimeout(this.retryTimer); clearTimeout(this.connectTimer);
        this.localSeats = []; this.localSeatNames.clear(); this.localControlTypes = [];
        if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
        this.socket = null;
        this.hideStatus();
        const modal = document.getElementById('online-menu');
        if (modal) modal.style.display = 'grid';
        const error = document.getElementById('online-error');
        if (error) error.textContent = message;
    }

    expireConnection() {
        if (!this.active) return;
        this.active = false;
        this.explicitLeave = true;
        this.isHost = this.isGuest = false;
        this.uiPaused = false;
        this.localSeats = []; this.localSeatNames.clear(); this.localControlTypes = [];
        this.hideStatus();
        document.getElementById('online-error').textContent = 'Your match connection expired. Start a new match to play again.';
        this.game.quitGame();
    }

    startHostGame(match) {
        const game = this.game, format = ONLINE_FORMATS[match.format];
        if (!format) { this.failBeforeMatch('This match format is not supported by this game version.'); return; }
        this.prepareGame(format);
        const colors = shuffled(FOUR_COLORS);
        game.players = [];
        for (let seat = 0; seat < format.capacity; seat++) {
            const team = Math.floor(seat / format.teamSize), color = colors[team % colors.length];
            const p = new Bot(seat, 100, 100, this.skill, seat);
            p.team = team; p.teamColor = color; p.color = p.originalColor = color;
            p.label = `BOT ${seat + 1}`;
            game.players.push(p);
        }
        this.summary = match;
        this.syncHostRoster(match);
        game.state = 'PLAYING';
        game.matchStart = true;
        game.matchmaking = { start: performance.now(), dur: 900 };
        game.startLevel(false);
    }

    startGuestShell(match) {
        const format = ONLINE_FORMATS[match.format];
        if (!format) { this.failBeforeMatch('This match format is not supported by this game version.'); return; }
        this.prepareGame(format);
        this.game.players = [];
        this.game.state = 'PLAYING';
        this.game.matchStart = false;
        this.game.level.generate(1);
        this.game.render();
    }

    prepareGame(format) {
        const game = this.game;
        AudioSys.init(); AudioSys.muteSfx = false; AudioSys.stopMusic(); AudioSys.startMusic();
        game.demo = false; game.mode = 'online'; game.teamMode = true;
        game.onlineFormat = format; game.onlineSkill = this.skill; game.matchOver = null;
        game.matchStart = true; game.levelNum = 1; game.networkInputs = Object.create(null);
        game.onlinePlayerName = this.name; game.networkTransitionAt = 0; game.networkTransitionRemaining = 0;
        game.players = []; game.weapons = []; game.projectiles = []; game.corpses = []; game.feed = [];
        game.kingId = null; game.fx.reset(); game.level.generate(1);
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('online-menu').style.display = 'none';
        document.getElementById('lobby-touch').style.display = 'none';
        const mobile = game.isTouchDevice();
        document.getElementById('mobile-controls').style.display = mobile ? 'block' : 'none';
        document.getElementById('btn-pause-mobile').style.display = mobile ? 'flex' : 'none';
    }

    syncHostRoster(summary) {
        if (!this.isHost || !Array.isArray(summary.seats)) return;
        const game = this.game;
        for (const seatInfo of summary.seats) {
            const seat = seatInfo.seat, p = game.players[seat];
            if (!p) continue;
            if (this.localSeats.includes(seat)) {
                const partyIndex = this.localSeats.indexOf(seat);
                this.makeHuman(p, this.localSeatNames.get(seat) || (partyIndex === 0 ? this.name : `${this.name} ${partyIndex + 1}`), true, partyIndex);
                continue;
            }
            if (seatInfo.isBot) this.makeBot(p, seat);
            else this.makeHuman(p, seatInfo.name, false);
        }
    }

    localInputType(partyIndex) {
        return this.localControlTypes[partyIndex] || (partyIndex === 0 ? 'universal' : `gamepad_${partyIndex - 1}`);
    }

    configureLocalControls() {
        if (this.partySize === 1) {
            this.localControlTypes = ['universal'];
            return;
        }
        const input = this.game.inputManager;
        input.pollGamepads();
        const pads = Object.keys(input.gamepads).map(Number).sort((a, b) => a - b);
        const controls = Array(this.partySize).fill(null);
        let nextSeat = 0;

        // Assign already-connected controllers first, in browser controller order.
        for (const index of pads) {
            if (nextSeat >= controls.length) break;
            controls[nextSeat++] = `gamepad_${index}`;
        }

        // Keyboard/touch fills any seats that do not have a controller yet.
        if (nextSeat < controls.length) {
            controls[nextSeat++] = this.game.isTouchDevice() ? 'online_primary' : 'keyboard_wasd';
        }
        if (nextSeat < controls.length) controls[nextSeat++] = 'keyboard_arrows';

        // Keep later seats ready for controllers connected after the match starts.
        let padIndex = 0;
        while (nextSeat < controls.length) {
            while (pads.includes(padIndex) || controls.includes(`gamepad_${padIndex}`)) padIndex++;
            controls[nextSeat++] = `gamepad_${padIndex++}`;
        }
        this.localControlTypes = controls;
    }

    makeHuman(player, name, local, partyIndex = 0) {
        if (Object.getPrototypeOf(player) !== Player.prototype) Object.setPrototypeOf(player, Player.prototype);
        player.isBot = false; player.inputType = local ? this.localInputType(partyIndex) : 'network';
        player.label = String(name || (local ? this.name : 'PLAYER')).slice(0, 20);
        player.brain = null; player.aiInput = null; player.difficulty = undefined;
        if (!local) {
            this.game.networkInputs ||= Object.create(null);
            this.game.networkInputs[player.id] ||= Player.IDLE;
        }
    }

    makeBot(player, seat) {
        if (Object.getPrototypeOf(player) !== Bot.prototype) Object.setPrototypeOf(player, Bot.prototype);
        player.isBot = true; player.inputType = 'bot'; player.difficulty = this.skill;
        player.label = `BOT ${seat + 1}`;
        player.aiInput = null;
        player.brain = new BotBrain(player, this.skill);
        if (this.game.networkInputs) delete this.game.networkInputs[seat];
    }

    normalizeInput(input) {
        if (!input || typeof input !== 'object') return Player.IDLE;
        const axis = v => Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0;
        return { x: axis(input.x), y: axis(input.y), aimX: axis(input.aimX), aimY: axis(input.aimY),
            // Fold stick-up into jump; the relay also preserves touch + stick for flight controls.
            jump: !!input.jump || !!input.stickJump, isMobileJump: !!input.isMobileJump, attack: !!input.attack, shield: !!input.shield,
            touch: !!input.touch,
            stick: input.stick ? { x: axis(input.stick.x), y: axis(input.stick.y) } : undefined };
    }

    tick(now) {
        if (!this.active || !this.game || this.game.mode !== 'online') return;
        if (this.socket?.readyState === WebSocket.OPEN) {
            if (this.isGuest && this.localSeats.length && now - this.lastInputSent >= 40) {
                this.lastInputSent = now;
                const inputs = this.localSeats.map((seat, partyIndex) => {
                    const player = this.game.players[seat];
                    const inputType = this.localInputType(partyIndex);
                    const input = this.uiPaused || !player ? Player.IDLE : this.game.inputManager.getPlayerInput(seat, inputType);
                    return { seat, input: this.normalizeInput(input) };
                });
                this.send({ type: 'input', inputs });
            }
            if (this.isHost && now - this.lastSnapshotSent >= 33) {
                this.lastSnapshotSent = now;
                this.send({ type: 'snapshot', data: this.makeSnapshot() });
            }
        }
        if (this.isHost && this.game.roundOver && this.game.networkTransitionAt && now >= this.game.networkTransitionAt) {
            this.game.networkTransitionAt = 0;
            this.game.networkTransitionRemaining = 0;
            if (this.game.matchOver) this.game.quitGame();
            else { this.game.levelNum++; this.game.startLevel(); }
        }
    }

    makeSnapshot() {
        const game = this.game, objectIds = new WeakMap();
        let nextId = this.nextNetId;
        const netId = object => {
            if (!object || typeof object !== 'object') return null;
            if (!objectIds.has(object)) {
                if (!object.netId) object.netId = nextId++;
                else nextId = Math.max(nextId, object.netId + 1);
                objectIds.set(object, object.netId);
            }
            return objectIds.get(object);
        };
        const heldWeapons = game.players.map(p => p.weapon).filter(Boolean);
        const allWeapons = [...new Set([...game.weapons, ...heldWeapons])];
        const players = game.players.map(p => {
            const state = {};
            for (const [key, value] of Object.entries(p)) {
                if (ONLINE_SKIP_FIELDS.has(key) || key === 'statusSrc' || key === 'lastAttacker') continue;
                const copied = onlineCopy(value);
                if (copied !== undefined) state[key] = copied;
            }
            state.id = p.id; state.isBot = !!p.isBot; state.difficulty = p.difficulty || null;
            state.inputType = p.inputType; state.label = p.label || (p.isBot ? `BOT ${p.id + 1}` : 'PLAYER');
            state.weaponId = netId(p.weapon);
            state.statusSrcId = p.statusSrc?.id ?? null;
            state.lastAttackerId = p.lastAttacker?.id ?? null;
            return state;
        });
        const weapons = allWeapons.map(w => {
            const state = {};
            for (const [key, value] of Object.entries(w)) {
                if (key === 'def' || key === 'owner') continue;
                const copied = onlineCopy(value);
                if (copied !== undefined) state[key] = copied;
            }
            state.netId = netId(w); state.ownerId = w.owner?.id ?? null;
            return state;
        });
        const projectiles = game.projectiles.filter(p => p.active).slice(-180).map(p => {
            const state = {};
            for (const [key, value] of Object.entries(p)) {
                if (key === 'spec' || key === 'owner' || key === 'target' || key === 'hitSet') continue;
                const copied = onlineCopy(value);
                if (copied !== undefined) state[key] = copied;
            }
            state.netId = netId(p); state.ownerId = p.owner?.id ?? null; state.targetId = p.target?.id ?? null;
            state.spec = onlineCopy(p.spec); state.hitSet = p.hitSet ? [...p.hitSet].map(x => x?.id).filter(Number.isInteger) : null;
            return state;
        });
        const platforms = game.level.platforms.map(p => onlineCopy(p));
        const level = {};
        for (const [key, value] of Object.entries(game.level)) {
            if (['platforms', 'backdrop', 'layout'].includes(key)) continue;
            const copied = onlineCopy(value);
            if (copied !== undefined) level[key] = copied;
        }
        const snapshot = {
            seq: ++this.snapshotSeq,
            mode: game.mode, levelNum: game.levelNum, state: 'PLAYING',
            frameCount: game.frameCount, roundTime: game.roundTime, roundOver: !!game.roundOver,
            matchOver: game.matchOver ? { winnerId: game.matchOver.winner?.id ?? null } : null,
            winnerId: game.winner?.id ?? null, kingId: game.kingId,
            countdownRemaining: Math.max(0, game.countdownEnd - performance.now()),
            transitionRemaining: game.networkTransitionAt ? Math.max(0, game.networkTransitionAt - performance.now()) : game.networkTransitionRemaining || 0,
            timeScale: game.timeScale, slowMotion: !!game.slowMotion,
            godSlowRemaining: Math.max(0, (game.godSlow || 0) - performance.now()),
            freeze: game.freeze || 0, roundToken: game.roundToken, weaponTimer: game.weaponTimer,
            level, platforms, players, weapons,
            projectiles,
            banners: (game.banners || []).filter(b => b.start + b.dur > performance.now()).map(b => ({ text: b.text, sub: b.sub, color: b.color, remaining: Math.max(0, b.start + b.dur - performance.now()), delay: Math.max(0, b.start - performance.now()), dur: b.dur }))
        };
        this.nextNetId = nextId;
        return snapshot;
    }

    applySnapshot(snapshot) {
        snapshot = onlineCopy(snapshot);
        if (!snapshot || !Array.isArray(snapshot.players) || !Array.isArray(snapshot.platforms)) return;
        if (snapshot.seq !== undefined && snapshot.seq < this.lastSnapshotReceived && this.lastSnapshotReceived > 0) return;
        this.lastSnapshotReceived = snapshot.seq ?? this.lastSnapshotReceived + 1;
        const game = this.game;
        if (game.mode !== 'online') this.startGuestShell(this.summary || { format: this.format });
        game.demo = false; game.mode = 'online'; game.teamMode = true; game.state = 'PLAYING';
        game.levelNum = snapshot.levelNum || 1;
        Object.assign(game.level, snapshot.level || {});
        game.level.platforms = snapshot.platforms.map((state, i) => Object.assign(game.level.platforms[i] || {}, state));
        game.level.backdrop = null;
        game.fx.level = game.level;
        const previousPlayers = new Map(game.players.map(p => [p.id, p]));
        game.players = snapshot.players.map(state => {
            const p = previousPlayers.get(state.id) || new Player(state.id, state.x, state.y, state.color, state.isBot ? 'bot' : 'network');
            if (Object.getPrototypeOf(p) !== Player.prototype) Object.setPrototypeOf(p, Player.prototype);
            const oldX = Number.isFinite(p.x) ? p.x : state.x;
            const oldY = Number.isFinite(p.y) ? p.y : state.y;
            const oldH = Number.isFinite(p.height) ? p.height : state.height;
            Object.assign(p, state);
            p.prevX = oldX; p.prevY = oldY; p.prevH = oldH;
            p.isBot = !!state.isBot;
            p.inputType = this.localSeats.includes(state.id)
                ? this.localInputType(this.localSeats.indexOf(state.id))
                : (p.isBot ? 'bot' : 'network');
            p.brain = null; p.aiInput = null; p.joints = null;
            return p;
        });
        const byId = new Map(game.players.map(p => [p.id, p]));
        for (const p of game.players) {
            if (p.statusSrcId !== undefined) p.statusSrc = byId.get(p.statusSrcId) || null;
            if (p.lastAttackerId !== undefined) p.lastAttacker = byId.get(p.lastAttackerId) || null;
        }
        const priorWeapons = new Map([...game.weapons, ...game.players.map(p => p.weapon).filter(Boolean)].map(w => [w.netId, w]));
        const weaponMap = new Map();
        for (const state of snapshot.weapons || []) {
            const w = priorWeapons.get(state.netId) || new Weapon(state.x, state.y, state.type);
            Object.assign(w, state); w.def = WEAPONS[w.type] || WEAPONS.sword; w.owner = byId.get(state.ownerId) || null;
            weaponMap.set(state.netId, w);
        }
        for (const state of snapshot.players) {
            const p = byId.get(state.id);
            p.weapon = state.weaponId == null ? null : (weaponMap.get(state.weaponId) || null);
            if (p.weapon) p.weapon.owner = p;
        }
        game.weapons = (snapshot.weapons || []).filter(w => w.ownerId == null).map(w => weaponMap.get(w.netId)).filter(Boolean);
        const priorProjectiles = new Map(game.projectiles.map(p => [p.netId, p]));
        game.projectiles = (snapshot.projectiles || []).map(state => {
            const owner = byId.get(state.ownerId) || null;
            const pr = priorProjectiles.get(state.netId) || new Projectile(state.x, state.y, state.vx, state.vy, state.spec, owner);
            Object.assign(pr, state); pr.owner = owner; pr.target = byId.get(state.targetId) || null;
            pr.spec = state.spec || {}; pr.type = pr.spec.type || state.type; pr.hitSet = state.hitSet ? new Set(state.hitSet.map(id => byId.get(id)).filter(Boolean)) : null;
            return pr;
        });
        game.frameCount = snapshot.frameCount || 0; game.roundTime = snapshot.roundTime || 0;
        game.roundOver = !!snapshot.roundOver; game.matchOver = snapshot.matchOver ? { winner: byId.get(snapshot.matchOver.winnerId) || null } : null;
        game.winner = byId.get(snapshot.winnerId) || null; game.kingId = snapshot.kingId ?? null;
        game.weaponTimer = snapshot.weaponTimer || 0; game.timeScale = snapshot.timeScale || 1;
        game.slowMotion = !!snapshot.slowMotion;
        game.godSlow = performance.now() + (snapshot.godSlowRemaining || 0);
        game.freeze = snapshot.freeze || 0;
        game.roundToken = snapshot.roundToken || game.roundToken;
        game.countdownEnd = performance.now() + Math.max(0, snapshot.countdownRemaining || 0);
        game.networkTransitionRemaining = snapshot.transitionRemaining || 0;
        game.banners = (snapshot.banners || []).map(b => ({ text: b.text, sub: b.sub, color: b.color, start: performance.now() + (b.delay || 0), dur: b.dur || 900 }));
        game.camera = game.camera || { x: game.level.width / 2, y: game.level.height / 2, zoom: 1 };
        game.fx.level = game.level;
        this.snapshotAppliedAt = performance.now();
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
        const mobile = game.isTouchDevice();
        document.getElementById('mobile-controls').style.display = mobile ? 'block' : 'none';
        document.getElementById('btn-pause-mobile').style.display = mobile ? 'flex' : 'none';
        this.showStatus(`${ONLINE_FORMATS[this.format]?.label || 'ONLINE MATCH'} · ${this.localSeats.length > 1 ? `${this.localSeats.length} local players` : this.name} · seat${this.localSeats.length > 1 ? 's' : ''} ${this.localSeats.map(seat => seat + 1).join(', ')}`);
    }

    interpolation(now) {
        if (!this.isGuest || !this.snapshotAppliedAt) return 1;
        return Math.max(0, Math.min(1, (now - this.snapshotAppliedAt) / this.snapshotInterval));
    }

    leave(closeRoom) {
        if (!this.active) return;
        this.explicitLeave = true;
        this.active = false;
        clearTimeout(this.retryTimer); clearTimeout(this.connectTimer);
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.send({ type: 'leave', closeRoom: !!closeRoom });
            this.socket.close(1000, 'Player left');
        } else if (this.socket) this.socket.close();
        this.socket = null;
        this.roomId = null; this.resumeToken = null; this.mySeat = null; this.localSeats = []; this.localSeatNames.clear(); this.localControlTypes = [];
        this.isHost = this.isGuest = false; this.uiPaused = false;
        this.hideStatus();
    }
}

window.MultiplayerClient = MultiplayerClient;
