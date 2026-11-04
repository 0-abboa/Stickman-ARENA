// Stickman Arena: game state, rounds and the main loop.
// Time model: the fight advances in fixed steps (update) through an
// accumulator. timeScale eases down to slow motion at the end of a round and
// `freeze` holds a few frames of hit-stop on big hits. Every visual system
// (animation, particles, ragdolls, camera, ambience) runs from animate(dt) with
// the same scaled dt, so everything slows down together. Combat lives in
// game-combat.js and drawing in game-render.js.
const THEME_NAMES = { dirt: 'Golden Meadow', stone: 'Dusk Fortress', ice: 'Aurora Glacier', cloud: 'Sky Kingdom', magic: 'Arcane Void' };
// Solo and Doubles colours: red, blue, green, yellow, dealt out at random each match
const FOUR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835'];
// Controller Party: up to 10 fighters, each given a random unused colour
const PARTY_COLORS = ['#e53935', '#ff9800', '#fdd835', '#c0ca33', '#43a047', '#00bcd4', '#1e88e5', '#8e24aa', '#e040fb', '#ff4f9a'];
const MAX_PARTY = 10;
// A match ends when someone gets this many knockouts (in Doubles: a team's combined total)
const KILL_GOAL = 10, TEAM_KILL_GOAL = 20;
const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// A random colour from the palette that no fighter is wearing yet
const freeColor = (palette, players) => { const used = new Set(players.map(p => p.color)); const free = palette.filter(c => !used.has(c)); return free.length ? shuffled(free)[0] : palette[players.length % palette.length]; };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        Graphics.init();
        this.inputManager = new InputManager();
        this.level = new Level(ARENA_W, ARENA_H);
        this.fx = new FX();
        this.fx.level = this.level;
        this.particles = this.fx.particles;

        this.players = [];
        this.weapons = [];
        this.projectiles = [];
        this.corpses = [];
        this.state = 'MENU';
        this.levelNum = 1;
        this.weaponTimer = 0;
        this.kingId = null;
        this.frameCount = 0;
        this.roundToken = 0;
        this.matchStart = false; // next startLevel() opens a match with the 3-2-1 countdown
        this.countdownEnd = 0;   // performance.now() when the countdown ends (world frozen until then)

        this.timeScale = 1;
        this.acc = 0;
        this.alpha = 1;
        this.freeze = 0;
        this.letterbox = 0;
        this.camera = { x: ARENA_W / 2, y: ARENA_H / 2, zoom: 1 };
        this.banners = [];
        this.feed = [];

        Player.onDamage = (p, amount, attacker, shielded, killed) => this.onDamage(p, amount, attacker, shielded, killed);
        this.setupUI();

        // Start the menu music on the first interaction
        const startIntro = () => {
            AudioSys.init();
            AudioSys.playIntroMusic();
            ['click', 'keydown', 'touchstart', 'mousemove', 'focus'].forEach(evt =>
                window.removeEventListener(evt, startIntro)
            );
            const credits = document.querySelector('.credits');
            if (credits) credits.style.display = 'none';
        };
        ['click', 'keydown', 'touchstart', 'mousemove', 'focus'].forEach(evt =>
            window.addEventListener(evt, startIntro)
        );

        this.startDemo();
        this.loop();
        setInterval(() => { if (document.hidden) this.tick(300); }, 250);
    }

    // The canvas follows the window; the arena does not. viewScale fits the whole arena inside the window.
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.viewScale = Math.max(0.05, Math.min(this.canvas.width / ARENA_W, this.canvas.height / ARENA_H));
        if (this.level && this.level.platforms.length === 0 && this.state === 'PLAYING') this.level.generate(this.levelNum);
        this.vignette = null;
    }

    setupUI() {
        document.getElementById('btn-solo').onclick = () => this.startGame('solo');
        document.getElementById('btn-doubles').onclick = () => this.startGame('doubles');
        document.getElementById('btn-party').onclick = () => this.startGame('party');
        // Tint the difficulty picker with the chosen tier's colour
        const sel = document.getElementById('bot-difficulty');
        const tint = { easy: '#81c784', medium: '#ffb74d', hard: '#ef5350', nightmare: '#ce93d8', hack: '#18ffff' };
        const paint = () => { sel.style.color = tint[sel.value] || '#ffeb3b'; };
        sel.addEventListener('change', paint);
        paint();
        // Party lobby buttons for touch screens: act on the next lobby tick
        const lt = (id, fn) => { document.getElementById(id).onclick = fn; };
        lt('lt-join', () => { if (this.lobbyAct) this.lobbyAct.join = true; });
        lt('lt-bot', () => { if (this.lobbyAct) this.lobbyAct.bot = true; });
        lt('lt-start', () => { if (this.lobbyAct) this.lobbyAct.start = true; });
        lt('lt-leave', () => this.quitGame());
        document.getElementById('btn-resume').onclick = () => this.togglePause();
        document.getElementById('btn-quit').onclick = () => this.quitGame();
    }

    // Attract mode: two bots fight behind the main menu
    startDemo() {
        this.demo = true;
        this.mode = 'demo';
        this.countdownEnd = 0;
        this.matchmaking = null;
        this.matchOver = null;
        if (this.inputManager.releaseAll) this.inputManager.releaseAll();
        this.teamMode = false;
        AudioSys.muteSfx = true;
        this.state = 'MENU';
        this.demoCast();
        this.kingId = null;
        this.levelNum = 1 + Math.floor(Math.random() * 4);
        this.startLevel();
    }

    // Behind the main menu: 2 to 10 fighters, each with its own random colour and skill
    demoCast() {
        const n = 2 + Math.floor(Math.random() * 9);
        const cols = shuffled(PARTY_COLORS);
        const tiers = ['easy', 'medium', 'hard', 'nightmare', 'hack'];
        this.players = [];
        for (let i = 0; i < n; i++) {
            const b = new Bot(i, 100 + i * 120, 100, tiers[Math.floor(Math.random() * tiers.length)], i);
            b.color = b.originalColor = cols[i % cols.length];
            this.players.push(b);
        }
    }

    startGame(mode) {
        AudioSys.init();
        AudioSys.muteSfx = false;
        AudioSys.stopMusic();
        AudioSys.startMusic();
        this.demo = false;
        this.matchOver = null;
        this.state = 'PLAYING';
        this.matchStart = true;
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('pause-menu').style.display = 'none';

        this.players = [];
        this.weapons = [];
        this.projectiles = [];
        this.corpses = [];
        this.feed = [];
        this.kingId = null;
        this.levelNum = 1;
        this.fx.reset();
        this.level.generate(this.levelNum);

        const isMobile = this.isTouchDevice();
        // Touch screens drive Solo and Doubles with the on-screen sticks (the party lobby shows them once a touch player is in)
        const showMobileControls = isMobile && (mode === 'solo' || mode === 'doubles');
        document.getElementById('mobile-controls').style.display = showMobileControls ? 'block' : 'none';
        document.getElementById('btn-pause-mobile').style.display = showMobileControls ? 'flex' : 'none';

        const difficulty = document.getElementById('bot-difficulty').value;
        this.teamMode = mode === 'doubles';
        this.mode = mode;
        if (mode === 'solo') {
            // You against three bots, everyone for themselves, each in a random one of the four colours
            const cols = shuffled(FOUR_COLORS);
            const me = new Player(0, 100, 100, cols[0], 'universal');
            me.label = 'YOU';
            this.players.push(me);
            for (let i = 1; i <= 3; i++) {
                const b = new Bot(i, 100, 100, difficulty, i - 1);
                b.color = b.originalColor = cols[i];
                b.label = `P${i + 1}`;
                this.players.push(b);
            }
        } else if (mode === 'doubles') {
            // Two players (WASD + Arrows) as one team against three bot teams of two.
            // Each team gets its own random colour from red, blue, green, yellow.
            const cols = shuffled(FOUR_COLORS);
            // On a touch screen there is only one pair of hands: you play with the sticks and a bot takes the other seat on your team
            const p1 = isMobile ? new Player(0, 100, 100, cols[0], 'universal') : new Player(0, 100, 100, cols[0], 'keyboard_wasd');
            const p2 = isMobile ? new Bot(1, 100, 100, difficulty, 99) : new Player(1, 100, 100, cols[0], 'keyboard_arrows');
            p1.label = isMobile ? 'YOU' : 'P1'; p2.label = isMobile ? 'ALLY' : 'P2';
            if (isMobile) p2.color = p2.originalColor = cols[0];
            for (const p of [p1, p2]) { p.team = 0; p.teamColor = cols[0]; this.players.push(p); }
            let id = 2;
            for (let t = 1; t <= 3; t++) {
                for (let k = 0; k < 2; k++) {
                    const b = new Bot(id, 100, 100, difficulty, (t - 1) * 2 + k);
                    b.team = t;
                    b.color = b.originalColor = cols[t];
                    b.teamColor = cols[t];
                    b.label = `TEAM ${t + 1}`;
                    this.players.push(b);
                    id++;
                }
            }
        } else {
            this.state = 'LOBBY';
            this.lobbyKeys = {};
            this.lobbyAct = {};
            document.getElementById('lobby-touch').style.display = isMobile ? 'flex' : 'none';
        }
        // Solo and Doubles open with a short "finding players" screen
        this.matchmaking = (mode === 'solo' || mode === 'doubles') ? { start: performance.now(), dur: 2600 } : null;
        this.startLevel(false);
    }

    togglePause() {
        // Solo / Doubles keep running behind the menu (you just stand there,
        // like stepping away from an online match); a local party really pauses
        const freezes = this.mode === 'party';
        if (this.state === 'LOBBY') { this.quitGame(); return; }   // Esc / controller B leaves the party lobby
        if (this.state === 'PLAYING') {
            this.pausedAt = performance.now();
            this.state = 'PAUSED';
            document.getElementById('pause-menu').style.display = 'flex';
            if (freezes) AudioSys.stopMusic();
        } else if (this.state === 'PAUSED') {
            // A frozen pause during the 3-2-1 resumes the countdown where it was
            const away = performance.now() - (this.pausedAt || performance.now());
            if (freezes && this.countdownEnd > this.pausedAt) {
                this.countdownEnd += away;
                for (const b of this.banners) b.start += away;
            }
            this.state = 'PLAYING';
            document.getElementById('pause-menu').style.display = 'none';
            if (freezes) AudioSys.startMusic();
        }
    }

    isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }

    quitGame() {
        document.getElementById('lobby-touch').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
        document.getElementById('mobile-controls').style.display = 'none';
        AudioSys.stopMusic();
        this.startDemo();
    }

    startLevel(regenerate = true) {
        if (regenerate) this.level.generate(this.levelNum);
        const openMatch = this.matchStart;
        this.matchStart = false;
        this.roundToken++;
        this.weapons = [];
        this.projectiles = [];
        this.corpses = [];
        this.weaponTimer = 0;
        this.roundOver = false;
        this.slowMotion = false;
        this.winner = null;
        this.frameCount = 0;
        this.roundTime = 0;
        this.timeScale = 1;
        this.acc = 0;
        this.freeze = 0;
        this.fx.reset();

        // Shuffle who stands where each round (teammates stay side by side), and
        // on crystal rounds keep everyone well away from where it comes down
        const crystalX = this.levelNum % 5 === 0 ? this.level.width / 2 : null;
        const spawnXs = this.spawnPoints(this.players.length, crystalX);
        const order = [];
        for (const team of shuffled([...new Set(this.players.map(p => p.team))])) {
            for (const p of shuffled(this.players.filter(q => q.team === team))) order.push(p);
        }
        const slot = new Map(order.map((p, i) => [p, i]));
        this.players.forEach((p) => {
            const i = slot.get(p);
            p.x = spawnXs[i];
            p.y = 100;
            p.velocity = { x: 0, y: 0 };
            p.isDead = false;
            p.weapon = null;
            p.wings = false;
            p.isBird = false;
            p.onCloud = false;
            p.jumpCount = 0;
            p.gravity = 0.5; // Angel wings made it floatier; don't carry that into the next level
            p.isLaying = false;
            p.proneW = 0;   // the lying-down pose blend starts fully up each round
            p.shieldActive = false;
            p.shieldCd = 0; p.shieldTime = 0; p.shieldLatch = false;
            p.height = 60;
            p.maxHealth = 100;
            p.health = p.maxHealth;
            p.color = p.originalColor;
            // Visual state starts fresh each round
            p.prevX = p.x; p.prevY = p.y; p.prevH = p.height;
            p.trail = []; p.pose = null; p.rag = null; p.flinch = 0; p.hitFlash = 0;
            p.attackAnim = 99; p.corpseSpawned = false; p.hpTrail = p.health;
            // Nothing carries over between rounds or matches: burn, poison, freeze, stun, slow, paint,
            // queued attacks and the scarf rope all start clean
            p.status = null; p.statusSrc = null; p.statusType = null; p.speedMul = 1;
            p.paint = null; p.paintT = 0; p.scarf = null; p.lastAttacker = null; p.lastAttackerAt = 0;
            p.attackCooldown = 0; p.wantsToAttack = false; p.wantsToPunch = false; p.wantsToExplode = false;
            p.squash = 0; p.landFx = 0;
        });

        if (this.levelNum % 5 === 0) {
            this.weapons.push(this.makeCrystal());
            if (!this.demo) {
                this.showMessage("THE CRYSTAL DESCENDS...");
                AudioSys.playDramaticIntro();
            }
        } else if (!this.demo) {
            AudioSys.startMusic();
        }
        document.getElementById('level-display').innerText = this.levelNum;
        // Open each round pulled in high, then ease back out to the arena
        this.camera = { x: ARENA_W / 2, y: ARENA_H * 0.4, zoom: 1.3 };
        for (const p of this.players) this.fx.pillar(p.x + p.width / 2, Utils.hexRgb(p.color));
        // Every round (not just the first) opens with a frozen 3-2-1
        if (!this.demo && this.state !== 'LOBBY') this.beginCountdown(openMatch);
        else this.countdownEnd = 0;
    }

    // Name of this round's backdrop (e.g. "Autumn Forest"), known before its first draw
    sceneName() {
        const V = Backdrop.variantFor(this.level.material, this.level.variantSeed);
        return V ? V.name : (THEME_NAMES[this.level.material] || '');
    }

    // 3-2-1-FIGHT before every round. The world stays frozen (see loop) until it ends.
    beginCountdown(openMatch) {
        const theme = this.sceneName();
        const sub = `ROUND ${this.levelNum} · ` + (this.level.layoutName || theme).toUpperCase();
        const d = openMatch && this.matchmaking ? this.matchmaking.dur : 0;   // after "finding players"
        this.banners = [];
        this.countdownEnd = performance.now() + d + 3000;
        this.banner('3', sub, '#ffffff', d, 950);
        this.banner('2', sub, '#ffffff', d + 1000, 950);
        this.banner('1', sub, '#ffffff', d + 2000, 950);
        this.banner('FIGHT!', '', '#ffca28', d + 3000, 900);
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        if (this.inputManager.checkPause(this.state === 'LOBBY')) this.togglePause();
        this.tick(4);
        this.render();
    }

    // Advance the world by the real time since the last tick, at 60 steps per
    // second whatever the display rate. A background timer keeps calling this
    // while the tab is hidden (no animation frames there), so a match goes on
    // without you just like an online one would.
    tick(maxSteps) {
        const now = performance.now();
        const frames = this.lastTick === undefined ? 1 : Math.min(maxSteps, Math.max(0, (now - this.lastTick) / (1000 / 60)));
        this.lastTick = now;
        const live = this.state === 'PAUSED' && this.mode !== 'party';   // only a local party truly pauses
        const running = this.state === 'PLAYING' || this.state === 'LOBBY' || live || (this.state === 'MENU' && this.demo);
        const target = this.slowMotion ? 0.2 : 1;
        this.timeScale += (target - this.timeScale) * Math.min(1, 0.08 * frames);
        if (Math.abs(target - this.timeScale) < 0.01) this.timeScale = target;
        let dt = running ? this.timeScale * frames : 0;
        if (this.freeze > 0 && running) { this.freeze = Math.max(0, this.freeze - frames); dt = 0; }
        if (now < this.countdownEnd) dt = 0;   // match countdown: nothing moves yet

        if (running && dt > 0) {
            this.acc += dt;
            let steps = 0;
            while (this.acc >= 1 && steps < maxSteps) {
                this.acc -= 1;
                steps++;
                try {
                    this.update();
                } catch (e) {
                    console.error("Update Error:", e);
                }
            }
            if (steps >= maxSteps) this.acc = 0;
            this.alpha = this.timeScale >= 0.999 ? 1 : Math.min(1, this.acc);
        }
        this.letterbox += ((this.slowMotion && !this.demo ? 1 : 0) - this.letterbox) * Math.min(1, 0.06 * frames);
        this.animate(Math.min(dt, 3));
    }

    update() {
        if (this.state === 'LOBBY') { this.updateLobby(); return; }
        this.frameCount++;
        this.roundTime++;
        this.updateAngelState();

        if (!this.roundOver) {
            // A round ends when only one team (or nobody) is left standing
            const alive = this.players.filter(p => !p.isDead);
            const teamsLeft = new Set(alive.map(p => p.team));
            const teams = new Set(this.players.map(p => p.team));
            if ((teams.size > 1 && teamsLeft.size <= 1) || alive.length === 0) {
                const best = alive.slice().sort((a, b) => b.health - a.health)[0] || null;
                this.endRound(best);
            }
        }
        if (this.kingId !== null) {
            const king = this.players.find(p => p.id === this.kingId);
            if (king && king.isDead) this.kingId = null;
        }

        this.weaponTimer++;
        if (this.weaponTimer > 600) {
            this.weaponTimer = 0;
            this.spawnRandomWeapon();
        }

        this.level.update();
        for (const p of this.players) {
            p.update(this);
            this.statusTick(p);
            this.playerFx(p);
            if (p.wantsToPunch) { this.punch(p); p.wantsToPunch = false; }
            if (p.wantsToAttack) { if (p.weapon) this.useWeapon(p); p.wantsToAttack = false; }
            if (p.wantsToExplode) { this.angelBlast(p); p.wantsToExplode = false; }
        }
        for (const w of this.weapons) w.update(this.level);
        this.weapons = this.weapons.filter(w => w.active);
        this.updateProjectiles();
        this.checkKillGoal();
    }

    // Combined knockouts per team (everyone is their own team outside Doubles)
    teamKills() {
        const m = new Map();
        for (const p of this.players) {
            const e = m.get(p.team) || { n: 0, color: p.teamColor || p.color };
            e.n += p.kills || 0;
            m.set(p.team, e);
        }
        return m;
    }

    // First to KILL_GOAL knockouts wins the match; in Doubles, the first team to
    // TEAM_KILL_GOAL combined. Ends the round on the spot.
    checkKillGoal() {
        if (this.demo || this.matchOver || this.state === 'LOBBY') return;
        let winner = null;
        if (this.teamMode) {
            for (const [team, e] of this.teamKills()) {
                if (e.n >= TEAM_KILL_GOAL) winner = this.players.filter(p => p.team === team).sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
            }
        } else winner = this.players.find(p => (p.kills || 0) >= KILL_GOAL) || null;
        if (!winner) return;
        this.matchOver = { winner };
        if (!this.roundOver) this.endRound(winner);
    }

    // While an angel lives: the Nimbus Staff never runs out, and every other
    // fighter is automatically shielded. Both end the moment it dies, and come
    // back if another angel appears.
    updateAngelState() {
        const live = this.players.some(p => p.isBird && !p.isDead);
        for (const p of this.players) {
            const want = live && !p.isBird && !p.isDead;
            if (want === !!p.autoShield) continue;
            p.autoShield = want;
            if (!want) { p.shieldActive = false; p.shieldCd = 0; p.shieldTime = 0; p.shieldLatch = false; }
        }
        // An angel always has an answer on the map: if no Nimbus Staff exists 2 seconds in, one drops
        const staffExists = this.weapons.some(w => w.type === 'magic_stick' && (w.active || w.owner));
        this.staffWait = live && !staffExists ? (this.staffWait || 0) + 1 : 0;
        if (this.staffWait > 120) {
            this.staffWait = 0;
            this.weapons.push(new Weapon(Utils.random(80, this.level.width - 80), -50, 'magic_stick'));
            if (!this.demo) this.showMessage('THE NIMBUS STAFF APPEARS!');
            AudioSys.playPowerup();
        }
        const staffDef = WEAPONS.magic_stick.durability;
        for (const w of this.weapons) {
            if (w.type !== 'magic_stick') continue;
            if (live) {
                if (w.durability !== Infinity) { w.finite = w.durability; w.durability = Infinity; }
            } else if (w.durability === Infinity) {
                w.durability = w.finite !== undefined ? w.finite : staffDef;
            }
        }
    }

    endRound(winner) {
        this.roundOver = true;
        this.slowMotion = true;
        this.winner = winner;
        const token = this.roundToken;
        if (winner) {
            this.kingId = winner.id;
            if (!this.demo) {
                AudioSys.playPowerup();
                const humanWon = this.players.some(p => !p.isBot && p.team === winner.team);
                const color = this.teamMode ? winner.teamColor : winner.color;
                if (this.matchOver) {
                    this.banner(humanWon ? 'MATCH WON' : 'MATCH LOST', this.teamMode ? `FIRST TEAM TO ${TEAM_KILL_GOAL} KILLS` : `FIRST TO ${KILL_GOAL} KILLS`, color, 250, 4800);
                } else this.banner(humanWon ? 'VICTORY' : 'DEFEAT', '', color, 250, 3200);
            }
            const c = winner.joints ? winner.joints[2] : { x: winner.x, y: winner.y };
            this.fx.confetti(c.x, c.y - 30, 90, [winner.color, '#ffca28', '#ffffff', '#69f0ae', '#ff4081']);
        } else if (!this.demo) {
            this.banner('DRAW', '', '#cfd8dc', 250, 2600);
        }
        setTimeout(() => {
            if (token !== this.roundToken) return;   // a new match started meanwhile
            if (this.state !== 'PLAYING' && this.state !== 'PAUSED' && !(this.demo && this.state === 'MENU')) return;
            if (this.matchOver) { this.quitGame(); return; }   // the match is decided: back to the menu
            // Every round leads to the next one, whoever won (the same round never repeats)
            this.levelNum++;
            if (this.demo) this.demoCast();
            this.startLevel();
        }, this.matchOver ? 5400 : 4000);
    }

    // Controller Party lobby: controllers press A, keyboard players press their
    // jump key (W or Up), B adds a bot, Enter (or a controller's Start/RT) begins
    updateLobby() {
        const im = this.inputManager;
        const pressed = (code) => { const now = !!im.keys[code], was = !!this.lobbyKeys[code]; this.lobbyKeys[code] = now; return now && !was; };
        const join = (type, color) => {
            if (this.players.length >= MAX_PARTY || this.players.find(p => p.inputType === type)) return;
            const p = new Player(this.players.length, 100, 100, freeColor(PARTY_COLORS, this.players), type);
            p.label = `P${this.players.length + 1}`;
            p.joinT = performance.now();
            this.players.push(p);
            AudioSys.playPowerup();
        };
        for (let i = 0; i < MAX_PARTY; i++) {
            const input = im.getPlayerInput(i, `gamepad_${i}`);
            if (input.join) join(`gamepad_${i}`);
        }
        if (pressed('KeyW') || pressed('Space')) join('keyboard_wasd');
        if (pressed('ArrowUp')) join('keyboard_arrows');
        const act = this.lobbyAct || {};
        this.lobbyAct = {};
        if (act.join) join('universal');                 // a touch player (sticks on screen)
        if ((pressed('KeyB') || act.bot) && this.players.length < MAX_PARTY) {
            const n = this.players.filter(p => p.isBot).length;
            const b = new Bot(this.players.length, 100, 100, document.getElementById('bot-difficulty').value, n);
            b.color = b.originalColor = freeColor(PARTY_COLORS, this.players);
            b.label = `P${this.players.length + 1}`;
            b.joinT = performance.now();
            this.players.push(b);
            AudioSys.playPowerup();
        }
        let start = pressed('Enter') || pressed('NumpadEnter') || !!act.start;
        for (const p of this.players) {
            if (!p.inputType.startsWith('gamepad')) continue;
            const gi = parseInt(p.inputType.split('_')[1]);
            if (im.padDown(gi, 9) || im.padDown(gi, 7) || im.padDown(gi, 5)) start = true;
        }
        if (start && this.players.length >= 2) {
            document.getElementById('lobby-touch').style.display = 'none';
            if (this.isTouchDevice() && this.players.some(p => p.inputType === 'universal')) {
                document.getElementById('mobile-controls').style.display = 'block';
                document.getElementById('btn-pause-mobile').style.display = 'flex';
            }
            this.state = 'PLAYING';
            this.matchStart = true;
            this.startLevel();
            AudioSys.playJump();
        }
    }

    // The Angel Crystal drifts down mid-arena, sealed for its first 5 seconds
    // so nobody can grab it the moment a round starts
    makeCrystal() {
        const w = new Weapon(this.level.width / 2 - 15, -100, 'bird_crystal');
        w.lock = 300;
        return w;
    }

    // Spread spawns across the arena, each nudged so it drops onto solid ground
    // rather than into a pit. With a crystal, nobody starts within 200px of it.
    spawnPoints(n, avoidX) {
        const W = this.level.width, margin = 80, keep = 200;
        const ok = (x) => avoidX === null || avoidX === undefined || Math.abs(x - avoidX) > keep;
        let solid = this.level.platforms.filter(p => p.active && p.type === 'static' && p.y > 160 && p.width >= 80);   // never a mover
        const usable = solid.filter(p => ok(p.x + 20) || ok(p.x + p.width - 20));
        if (usable.length) solid = usable;
        // Candidate x positions evenly over the allowed spans
        const spans = avoidX === null || avoidX === undefined ? [[margin, W - margin]]
            : [[margin, avoidX - keep], [avoidX + keep, W - margin]].filter(([a, b]) => b - a > 40);
        if (!spans.length) spans.push([margin, W - margin]);
        const total = spans.reduce((a, [l, r]) => a + r - l, 0);
        const xs = [];
        for (let i = 0; i < n; i++) {
            let u = (i + 0.5) / n * total, x = spans[0][0];
            for (const [l, r] of spans) { if (u <= r - l) { x = l + u; break; } u -= r - l; }
            const under = solid.filter(p => x > p.x + 15 && x < p.x + p.width - 15);
            if (!under.length && solid.length) {
                const near = solid.reduce((a, p) => Math.abs(p.x + p.width / 2 - x) < Math.abs(a.x + a.width / 2 - x) ? p : a);
                x = Math.max(near.x + 20, Math.min(near.x + near.width - 20, x));
                if (!ok(x)) x = Math.abs(near.x + 20 - avoidX) > Math.abs(near.x + near.width - 20 - avoidX) ? near.x + 20 : near.x + near.width - 20;
            }
            xs.push(Math.round(x - 15));
        }
        return xs;
    }

    spawnRandomWeapon() {
        const crystalExists = this.weapons.some(w => w.type === 'bird_crystal');
        const birdExists = this.players.some(p => p.isBird);
        if (this.levelNum % 5 === 0 && !crystalExists && !birdExists) {
            this.weapons.push(this.makeCrystal());
            if (!this.demo) this.showMessage("THE CRYSTAL APPEARS!");
            AudioSys.playPowerup();
            return;
        }
        // Crystal arenas hand out the Nimbus Staff far more often: a way to fight the angel
        const type = this.levelNum % 5 === 0 && Math.random() < 0.4 ? 'magic_stick' : WeaponDefs.randomType(this.level.material);   // themed drops (weapon-themes.js)
        const x = Utils.random(50, this.level.width - 50);
        this.weapons.push(new Weapon(x, -50, type));
        AudioSys.playPowerup();
    }

    showMessage(text) {
        if (this.demo) return;
        const el = document.getElementById('message-area');
        el.innerText = text;
        el.style.opacity = 1;
        clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => el.style.opacity = 0, 2000);
    }

    // Big centred title card. delay/dur in real milliseconds.
    banner(text, sub, color, delay, dur) {
        this.banners.push({ text, sub, color, start: performance.now() + delay, dur });
    }
}

// Start game
window.onload = () => {
    window.game = new Game();
};
