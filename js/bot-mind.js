// Difficulty only changes how the bot *thinks*: reaction time, consistency and
// how often it pulls off each technique. Its body, speed, damage and abilities
// never change. Techniques are probabilities rolled per short window, so even
// top bots miss reads, hesitate and leave openings like a person would.
const BOT_PROFILES = {
    easy: {
        label: 'BEGINNING', color: '#43a047', shades: ['#43a047', '#66bb6a', '#2e7d32', '#8bc34a', '#00897b', '#558b2f'],
        reaction: 42, think: [10, 16], noise: 0.52, aimError: 24, spacingErr: 48, aggression: 0.24, hesitate: 0.48, adapt: false, weaponRace: 0.3, fly: 4.6, dodgeRate: 0.06,
        divineDodgeRate: 0.12, divineReaction: 14,
        skills: { shield: 0.08, dodge: 0, edgeguard: 0, lethal: 0, crouchFire: 0, divineLoop: 0, divineSlide: 0, recover: 0.4, punish: 0.12, crossup: 0 }
    },
    medium: {
        label: 'INTERMEDIATE', color: '#fb8c00', shades: ['#fb8c00', '#ffa726', '#ef6c00', '#ffb300', '#f4511e', '#ff9800'],
        reaction: 28, think: [5, 9], noise: 0.3, aimError: 13, spacingErr: 24, aggression: 0.48, hesitate: 0.24, adapt: true, weaponRace: 0.58, fly: 5.7, dodgeRate: 0.2,
        divineDodgeRate: 0.4, divineReaction: 8,
        skills: { shield: 0.28, dodge: 0.2, edgeguard: 0.08, lethal: 0.18, crouchFire: 0.05, divineLoop: 0.3, divineSlide: 0.24, recover: 0.72, punish: 0.3, crossup: 0.1 }
    },
    hard: {
        label: 'ADVANCED', color: '#e53935', shades: ['#e53935', '#ff5252', '#c62828', '#d81b60', '#ff1744', '#b71c1c'],
        reaction: 12, think: [2, 3], noise: 0.07, spacingErr: 8, aggression: 0.85, hesitate: 0.06, adapt: true, weaponRace: 0.9, fly: 7.2, dodgeRate: 0.4,
        divineDodgeRate: 0.78, divineReaction: 4,
        skills: { shield: 0.74, dodge: 0.68, edgeguard: 0.62, lethal: 0.8, crouchFire: 0.58, divineLoop: 0.76, divineSlide: 0.68, recover: 0.96, punish: 0.82, crossup: 0.52 }
    },
    nightmare: {
        label: 'PROFESSIONAL', color: '#8e24aa', shades: ['#8e24aa', '#ab47bc', '#6a1b9a', '#7b1fa2', '#ba68c8', '#4a148c'],
        reaction: 6, think: [1, 1], noise: 0.01, spacingErr: 3, aggression: 0.97, hesitate: 0.01, adapt: true, weaponRace: 1, fly: 8, dodgeRate: 0.55,
        divineDodgeRate: 0.93, divineReaction: 2,
        skills: { shield: 0.92, dodge: 0.93, edgeguard: 0.95, lethal: 1, crouchFire: 0.92, divineLoop: 0.92, divineSlide: 0.88, recover: 1, punish: 0.98, crossup: 0.85 }
    },
    // As skilled as the bot can be: near-instant reactions, no fumbles, every
    // technique every time. Still the same body and rules as a player.
    hack: {
        label: 'HACK', color: '#18ffff', shades: ['#18ffff', '#00e5ff', '#84ffff', '#00b8d4', '#40c4ff', '#0091ea'],
        reaction: 2, think: [1, 1], noise: 0, aimError: 0, spacingErr: 1, aggression: 1, hesitate: 0, adapt: true, weaponRace: 1, fly: 8, dodgeRate: 0.92,
        divineDodgeRate: 0.99, divineReaction: 0,
        skills: { shield: 1, dodge: 1, edgeguard: 1, lethal: 1, crouchFire: 1, divineLoop: 0.98, divineSlide: 0.98, recover: 1, punish: 1, crossup: 0.9 }
    }
};


// The bot's brain. It sees the match with a human-like reaction delay, models
// its opponent, picks a strategy that adapts to what is working, and emits the
// same input a controller would (see Player.applyInput). Tactics live in
// bot-tactics.js and input execution in bot-motor.js.
class BotBrain {
    constructor(body, difficulty) {
        this.body = body;
        this.difficulty = BOT_PROFILES[difficulty] ? difficulty : 'medium';
        this.profile = BOT_PROFILES[this.difficulty];
        this.baseProfile = this.profile;
        this.nav = null;           // shared per level, see think()
        this.frame = 0;
        this.history = new Map();   // player -> recent snapshots (perception buffer)
        this.models = new Map();    // player -> learned habits
        this.cache = new Map();
        this.pathCache = new Map();
        this.banned = new Map();    // route edges that failed recently -> expiry frame
        this.prizeBan = new Map();  // weapons we gave up chasing -> expiry frame
        this.strategy = 'pressure';
        this.strategyStats = {
            pressure: { n: 1, avg: 0 },
            footsies: { n: 1, avg: 0 },
            bait: { n: 1, avg: 0 },
            zone: { n: 1, avg: 0 },       // poke at the very tip of our reach, step out after each swing
            counter: { n: 1, avg: 0 },    // wait just outside their reach, block their swing, punish the recovery
            rushdown: { n: 1, avg: 0 }    // stay in their face, jump in, swing on every opening
        };
        this.window = { frames: 0, dealt: 0, taken: 0 };
        this.intent = null;
        this.plan = null;           // committed, pre-simulated movement being executed
        this.jitter = 0;
        this.shieldUntil = 0;
        this.shieldRoll = false;
        this.levelRef = null;
        this.rolls = {};
        this.nextThink = 0;
        this.hesitateUntil = 0;
        this.airSince = -1;
        this.lastHealth = body.health;
        this.output = { x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false };
        this.scratchA = { x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false };
        this.scratchB = { x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false };
    }

    newRound() {
        this.idleRef = null; this.wander = null; this.lurkBan = 0; this.lurkSince = 0; this.ctx = null;
        this.plan = null;
        this.intent = null;
        this.history.clear();
        this.cache.clear();
        this.pathCache.clear();
        this.banned.clear();
        this.prizeBan.clear();
        this.fetchW = null;
        this.lastHealth = this.body.health;
        for (const m of this.models.values()) m.lastHealth = Infinity;
    }

    // One frame of thinking; returns the controller state for Player.applyInput
    think(game) {
        const me = this.body;
        this.game = game;
        this.frame++;
        // Skill tier (see effectiveTier: the kit no longer changes it)
        const want = BOT_PROFILES[this.effectiveTier()] || this.baseProfile;
        if (this.profile !== want) this.profile = want;
        if (game.level.platforms !== this.levelRef) {
            this.levelRef = game.level.platforms;
            this.newRound();
        }
        this.nav = BotNav.shared(game.level);
        this.nav.tick(game.level, me, game.frameCount);
        this.world = BotSim.createWorld(game.level, 200);
        if (this.frame % 120 === 0) for (const k of this.pathCache.keys()) if (!k.active) this.pathCache.delete(k);
        this.observe(game);
        this.trackIdle();
        this.target = this.pickTarget(game);
        this.trackFrustration();
        this.trackModels(game);
        if (this.frame % 30 === 0) this.jitter = (Math.random() * 2 - 1) * this.profile.spacingErr;
        // An angel that just died can't be chased any more: re-plan now instead of finishing the old angel intent
        const angelDown = this.intentFor && this.intentFor.isBird && this.intentFor.isDead;
        const holdingDodgePlan = this.intent && this.intent.dodging && this.frame < this.nextThink;
        const divineThreat = !holdingDodgePlan && game.projectiles.some(pr => {
            if (!pr.active || !pr.spec || !pr.spec.divine || pr.owner === me || (pr.owner && pr.owner.team === me.team) || pr.age < (this.profile.divineReaction || 0)) return false;
            const path = this.pathOf(pr, 42);
            return BotSim.hitBy(me, BotSim.plan(0, 999, 0), this.world, [path], 38) >= 0;
        });
        if (!this.intent || this.frame >= this.nextThink || angelDown || divineThreat) {
            this.intent = this.decide(game);
            this.intentFor = this.target ? this.target.ref : null;
            const [a, b] = this.profile.think;
            this.nextThink = this.frame + a + Math.floor(Math.random() * (b - a + 1));
            // Now and then a person just... pauses. Gives the opponent openings.
            if (this.frame >= this.hesitateUntil && this.intent.mode !== 'fetch' && !(this.target && this.isPassive(this.target)) && Math.random() < this.profile.hesitate * (b - a + 1) / 60) {
                this.hesitateUntil = this.frame + 12 + Math.floor(Math.random() * 25);
            }
            if (this.frame < this.hesitateUntil) {
                const it = this.intent;
                it.attack = false; it.jump = null; it.crouch = false; it.snatch = null;
                it.goalX = null; it.goalNode = -1;
                if (Math.random() < 0.5) it.shield = false;
            }
        }
        this.swingBetween();
        return this.drive(this.intent);
    }

    // Does the bot use this technique right now? Rolled per 45-frame window so
    // it commits (no flickering) but still misses reads regularly.
    skill(name) {
        const r = this.rolls[name];
        if (r && this.frame < r.until) return r.v;
        const v = Math.random() < (this.profile.skills[name] || 0);
        this.rolls[name] = { v, until: this.frame + 45 };
        return v;
    }

    scratchInput(x, y, jump) {
        const s = this.scratchA;
        s.x = x; s.y = y; s.jump = !!jump; s.attack = false; s.shield = false;
        return s;
    }

    scratchInput2(x, y, jump) {
        const s = this.scratchB;
        s.x = x; s.y = y; s.jump = !!jump; s.attack = false; s.shield = false;
        return s;
    }

    // ---------- Perception ----------

    snapshot(p) {
        return {
            ref: p, x: p.x, y: p.y, width: p.width, height: p.height,
            velocity: { x: p.velocity.x, y: p.velocity.y },
            speed: p.speed, jumpForce: p.jumpForce, gravity: p.gravity,
            grounded: p.grounded, facing: p.facing, jumpCount: p.jumpCount, maxJumps: p.maxJumps,
            jumpPressed: false, launched: !!p.launched, isLaying: p.isLaying, wings: p.wings, onCloud: p.onCloud, isBird: p.isBird,
            cd: p.attackCooldown, shield: p.shieldActive, shieldCd: p.shieldCd || 0, health: p.health, maxHealth: p.maxHealth,
            weapon: p.weapon ? p.weapon.type : null, dead: p.isDead, frame: this.frame, ridePlat: p.ridePlat, kills: p.kills || 0,
            speedMul: p.speedMul || 1, stunned: !!(p.status && p.status.stun > 0), frozen: !!(p.status && p.status.freeze > 0),
            dot: p.status ? (p.status.burn > 0 ? 1 : 0) + (p.status.poison > 0 ? 1 : 0) : 0,
            env: p.env
        };
    }

    selfView() { return this.snapshot(this.body); }

    observe(game) {
        for (const p of game.players) {
            if (p === this.body) continue;
            let h = this.history.get(p);
            if (!h) { h = []; this.history.set(p, h); }
            h.push(this.snapshot(p));
            if (h.length > 48) h.shift();
        }
    }

    // What the bot "sees" of p: a snapshot `reaction` frames old, carried forward
    // the way a player anticipates motion (they keep doing what they were doing).
    perceive(p) {
        const h = this.history.get(p);
        if (!h || !h.length) return null;
        const lag = Math.min(this.profile.reaction, h.length - 1);
        const snap = h[h.length - 1 - lag];
        if (lag === 0 || snap.dead) return Object.assign({}, snap);
        // Target picking, bestPrize and tactics all ask for the same fighter in the same frame:
        // replay the physics once per frame and hand out copies
        const memo = this.seenMemo || (this.seenMemo = new Map());
        const hit = memo.get(p);
        if (hit && hit.frame === this.frame && hit.n === h.length && hit.lag === lag) return Object.assign({}, hit.out, { velocity: Object.assign({}, hit.out.velocity) });
        const out = this.replay(snap, lag);
        memo.set(p, { frame: this.frame, n: h.length, lag, out });
        return Object.assign({}, out, { velocity: Object.assign({}, out.velocity) });
    }

    replay(snap, lag) {
        const out = Object.assign({}, snap);
        const g = BotSim.ghost(snap);
        g.jumpPressed = true;   // a held jump keeps rising without triggering a new jump
        const rising = snap.velocity.y < 0 && !snap.grounded;
        const inp = this.scratchInput2(Math.abs(snap.velocity.x) > 1 ? Math.sign(snap.velocity.x) : 0, snap.isLaying ? 1 : 0, rising);
        for (let k = 0; k < lag && !g.dead; k++) BotSim.step(g, inp, this.world, 0);
        out.x = g.x; out.y = g.y; out.height = g.height;
        out.velocity = { x: g.velocity.x, y: g.velocity.y };
        out.grounded = g.grounded; out.jumpCount = g.jumpCount; out.isLaying = g.isLaying;
        out.cd = Math.max(0, snap.cd - lag);
        return out;
    }

    // Projectiles are only "noticed" once they have existed for a reaction time;
    // after that their path is fully predictable (straight, constant speed).
    perceivedProjectiles(game) {
        const out = [];
        const lag = this.profile.reaction;
        for (const pr of game.projectiles) {
            if (!pr.active || pr.owner === this.body || (pr.owner && pr.owner.team === this.body.team)) continue;
            const delay = pr.spec && pr.spec.divine ? (this.profile.divineReaction || 0) : lag;
            if (pr.age < delay) continue;
            out.push(pr);
        }
        return out;
    }

    readProjectileThreats(it, projs) {
        if (!projs || !projs.length) return;
        const reads = this.dodgeReads || (this.dodgeReads = new WeakMap());
        const seen = projs.filter(pr => {
            if (!reads.has(pr)) {
                const chance = pr.spec && pr.spec.divine ? (this.profile.divineDodgeRate || 0) : (this.profile.dodgeRate || 0);
                reads.set(pr, Math.random() < chance);
            }
            return reads.get(pr);
        });
        if (seen.length) this.dodgeProjectiles(it, seen);
    }

    pickTarget(game) {
        const me = this.body;
        let best = null, bestScore = Infinity;
        // Who is everyone else already fighting? Teammates gang up on the same
        // enemy; rivals spread out so nobody gets mobbed and nobody is ignored.
        const focus = new Set();
        const pressure = new Map();
        for (const a of game.players) {
            if (a === me || a.isDead || !a.brain || !a.brain.target) continue;
            const t = a.brain.target.ref;
            if (a.team === me.team) focus.add(t);
            else pressure.set(t, (pressure.get(t) || 0) + 1);
        }
        const ctx = this.assess(game);
        for (const p of game.players) {
            if (p === me || p.isDead || p.team === me.team) continue;
            const seen = this.perceive(p);
            if (!seen) continue;
            const score = this.scoreTarget(p, seen, ctx, focus, pressure);
            if (score < bestScore) { bestScore = score; best = seen; }
        }
        return best;
    }

    // Making progress on our target? Closing in, landing hits, or trading blows
    // all count. Getting nowhere for 5-10 seconds (they're out of reach, or we
    // keep failing to get there) makes them "frustrating": we go fight someone
    // else for a while. If nobody else is left, we keep trying to reach them.
    trackFrustration() {
        const t = this.target, me = this.body;
        if (!t || me.isBird || me.onCloud || t.isBird) { this.prog = null; return; }
        const ref = t.ref;
        const d = Math.abs(BotSim.cx(t) - BotSim.cx(me)) + Math.abs(t.y - me.y);
        let pr = this.prog;
        if (!pr || pr.ref !== ref) pr = this.prog = { ref, best: d, at: this.frame, hp: ref.health, limit: 300 + Math.random() * 300 };
        const hurt = ref.health < pr.hp - 0.5 && ref.lastAttacker === me;
        pr.hp = ref.health;
        if (hurt || d < pr.best - 25 || d < this.reachOf(me) + 30) { pr.best = Math.min(pr.best, d); pr.at = this.frame; }
        if (hurt) pr.best = d;
        if (this.frame - pr.at > pr.limit) {
            (this.frustBan || (this.frustBan = new Map())).set(ref, this.frame + 480 + Math.random() * 300);
            this.prog = null;
        }
    }

    // Is there any route from our platform to theirs? (cached briefly; ranged
    // weapons and fliers don't need one)
    canReach(seen) {
        const me = this.body;
        if (!this.nav || !this.nav.ready || me.isBird || me.onCloud || seen.isBird || seen.onCloud) return true;
        if (me.weapon && WeaponDefs.isShot(me.weapon.type)) return true;
        const c = this.reachCache || (this.reachCache = new Map());
        const hit = c.get(seen.ref);
        if (hit && this.frame - hit.frame < 30) return hit.v;
        const from = this.nav.supportIndex(me) >= 0 ? this.nav.supportIndex(me) : this.nav.nodeBelow(BotSim.cx(me), me.y + me.height);
        const to = this.nodeOf(seen);
        const v = from < 0 || to < 0 || from === to || !!this.nav.route(from, to, me.x);
        c.set(seen.ref, { frame: this.frame, v });
        return v;
    }

    // ---------- Opponent model + strategy selection ----------

    trackModels(game) {
        const me = this.body;
        const taken = Math.max(0, this.lastHealth - me.health);
        this.lastHealth = me.health;
        for (const p of game.players) {
            if (p === me) continue;
            let m = this.models.get(p);
            if (!m) {
                m = { aggr: 0.02, whiff: 0.5, jumpy: 0.01, shieldy: 0.3, lastCd: 0, lastVy: 0, lastHealth: p.health };
                this.models.set(p, m);
            }
            const dist = Math.abs(BotSim.cx(p) - BotSim.cx(me));
            const close = dist < 130 && !p.isDead;
            const attacked = p.attackCooldown > m.lastCd;            // a new swing started
            const jumped = p.velocity.y < -p.jumpForce + 1 && m.lastVy >= -p.jumpForce + 1;
            if (close) {
                m.aggr += ((attacked ? 1 : 0) - m.aggr) * 0.02;
                m.shieldy += ((p.shieldActive ? 1 : 0) - m.shieldy) * 0.01;
            }
            if (attacked && close) m.whiff += ((taken > 0 ? 0 : 1) - m.whiff) * 0.15;
            // Fast reads: frames within reach without swinging (calm), frames standing around (still)
            if (dist < 240 && !p.isDead) m.calm = attacked ? 0 : (m.calm || 0) + 1;
            else m.calm = Math.max(0, (m.calm || 0) - 2);
            m.still = p.grounded && Math.abs(p.velocity.x) < 0.4 && !p.shieldActive && !attacked && !jumped ? (m.still || 0) + 1 : 0;
            m.jumpy += ((jumped ? 1 : 0) - m.jumpy) * 0.01;
            if (m.lastHealth !== Infinity) this.window.dealt += Math.max(0, m.lastHealth - p.health);
            m.lastCd = p.attackCooldown;
            m.lastVy = p.velocity.y;
            m.lastHealth = p.health;
        }
        this.window.taken += taken;
        if (this.target && Math.abs(BotSim.cx(this.target) - BotSim.cx(me)) < 350) this.window.frames++;
        if (this.window.frames >= 300) this.rotateStrategy();
    }

    // UCB1 bandit over fighting styles, nudged by what we've learned about them
    rotateStrategy() {
        const w = this.window;
        const reward = (w.dealt - w.taken * 1.15) / 10;
        const s = this.strategyStats[this.strategy];
        s.n++;
        s.avg += (reward - s.avg) / s.n;
        this.window = { frames: 0, dealt: 0, taken: 0 };
        if (!this.profile.adapt) return;
        const prior = this.strategyPrior();
        let total = 0;
        for (const k in this.strategyStats) total += this.strategyStats[k].n;
        let best = this.strategy, bestV = -Infinity;
        for (const k in this.strategyStats) {
            const st = this.strategyStats[k];
            const v = st.avg + prior[k] + 1.2 * Math.sqrt(Math.log(total) / st.n);
            if (v > bestV) { bestV = v; best = k; }
        }
        this.strategy = best;
    }

    strategyPrior() {
        const m = this.target ? this.models.get(this.target.ref) : null;
        if (!m) return { pressure: 0.3, footsies: 0, bait: 0, zone: 0, counter: 0, rushdown: 0.1 };
        const aggr = Math.min(1, m.aggr * 20);   // ~1 = swings every cooldown
        const me = this.body, opp = this.target;
        const reach = this.reachOf(me), theirs = this.reachOf(opp);
        const myDef = WeaponDefs.of(me);
        const hpEdge = (me.health / me.maxHealth) - (opp.health / (opp.maxHealth || 100));
        return {
            pressure: 0.6 * m.shieldy + 0.3 * (1 - aggr),  // turtles get pushed to the edge
            footsies: 0.5 * aggr,
            bait: 0.8 * aggr * m.whiff,                    // swing-happy whiffers get baited
            zone: reach > theirs + 15 ? 0.5 + 0.3 * aggr : 0,                                  // we outrange them: keep them at the tip
            counter: 0.7 * aggr * m.whiff * (this.skill('shield') ? 1 : 0.4),                  // they swing a lot and miss: block and punish
            rushdown: (myDef.cooldown <= 12 ? 0.35 : 0) + 0.4 * Math.max(0, hpEdge) + 0.3 * (1 - m.shieldy)   // fast weapon, or we're ahead on health
        };
    }

    // ---------- Decision ----------

    decide(game) {
        const me = this.body, P = this.profile;
        const opp = this.target;
        const it = {
            mode: 'idle', goalX: null, goalNode: -1, stop: 6, attack: false, face: 0,
            shield: false, crouch: false, jump: null, snatch: null, allowEdge: false,
            fly: null, dodging: false
        };
        const projs = this.perceivedProjectiles(game);
        if (game.roundOver || (!opp && !game.weapons.some(w => w.active && !w.owner))) { this.tacticCelebrate(it); return it; }
        if (this.wander && this.frame < this.wander.until && !me.isBird && !me.onCloud && !(opp && opp.isBird)) {
            this.tacticWander(it);
            this.readProjectileThreats(it, projs);
            this.applyDefense(it, opp, projs);
            return it;
        }
        if (me.isBird) this.tacticBird(it, opp);
        else if (me.onCloud) this.tacticCloud(it, opp);
        else {
            const prize = this.bestPrize(game, opp);
            const ranged = me.weapon && WeaponDefs.isShot(me.weapon.type);
            const other = opp && !opp.isBird ? this.fightOf(opp.ref) : null;   // someone else brawling with our target
            const armsAngel = prize && (WeaponDefs.isShot(prize.w.type) || prize.w.type === 'magic_stick');
            if (opp && opp.isBird && armsAngel && prize.score > 40) this.tacticFetch(it, prize, opp);   // grab a gun for it first
            else if (opp && opp.isBird) this.tacticAngel(it, opp);
            else if (prize && (prize.urgent || !opp)) this.tacticFetch(it, prize, opp);
            else if (opp && this.skill('edgeguard') && this.isOffstage(opp)) this.tacticEdgeguard(it, opp);
            else if (prize) this.tacticFetch(it, prize, opp);
            else if (opp && other && this.wantsLurk(opp, other)) this.tacticLurk(it, opp, other);
            else if (opp && ranged) this.tacticRanged(it, opp);
            else if (opp) { this.lurkSince = 0; this.tacticMelee(it, opp); }
            else this.tacticIdle(it);
        }
        this.readProjectileThreats(it, projs);
        this.applyDefense(it, opp, projs);
        this.applyNoise(it);
        return it;
    }
}

BotBrain.IDLE = Object.freeze({ x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false });
