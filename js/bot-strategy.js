// Bot strategy: reading the whole match, not just the nearest body. Everything
// here is a general rule over measured quantities (kit power, who is attacking
// whom, health, distances, ETAs), never a special case for one map or weapon.
//
//  power      how dangerous a fighter's kit is (weapon value, wear, flight, angel)
//  hostility  is this fighter actually coming at me / has it been hitting me?
//  fights     who is already brawling with whom (so a third party can wait)
//  claims     who is about to pick up which weapon (arming is a threat in advance)
//  calm/still has this opponent stopped fighting back, or stopped moving at all?
Object.assign(BotBrain.prototype, {

    // ---------- Kit power ----------

    weaponPower(type, durFrac) {
        if (!type) return 22;                               // bare fists
        if (type === 'bird_crystal') return 1000;
        if (type === 'magic_stick') return 140;
        const d = WEAPONS[type];
        if (!d) return 30;
        const worn = durFrac === undefined ? 1 : Math.max(0.3, Math.min(1, durFrac));
        return (d.value || 40) * (0.55 + 0.45 * worn);
    },

    powerOf(o) {
        if (o.isBird) return 1000;
        if (o.onCloud) return 140;
        const w = o.weapon;
        if (w && typeof w === 'object') {
            const d = WEAPONS[w.type] || {};
            return this.weaponPower(w.type, isFinite(d.durability) ? w.durability / d.durability : 1);
        }
        return this.weaponPower(w || null);
    },

    // ---------- Intent and engagement ----------

    // 0..1: this fighter has been hitting us, or is closing in facing us, ready to swing
    hostility(p, seen) {
        const me = this.body;
        let h = 0;
        if (me.lastAttacker === p) {
            const age = performance.now() - me.lastAttackerAt;
            if (age < 3500) h = 1 - (age / 3500) * 0.6;
        }
        const dx = BotSim.cx(me) - (seen.x + seen.width / 2), dist = Math.abs(dx);
        if (dist < 300) {
            const facing = seen.facing === (Math.sign(dx) || 1);
            const closing = seen.velocity.x * (Math.sign(dx) || 1) > 0.8;
            if (facing && (closing || seen.cd > 0)) h = Math.max(h, dist < 160 ? 0.7 : 0.45);
        }
        return h;
    },

    // Someone else this fighter is currently brawling with (damage in the last 2.5s, close by), or null
    fightOf(p) {
        const me = this.body, now = performance.now();
        for (const q of this.game.players) {
            if (q === me || q === p || q.isDead || q.team === p.team) continue;
            const hit = (p.lastAttacker === q && now - (p.lastAttackerAt || 0) < 2500) ||
                        (q.lastAttacker === p && now - (q.lastAttackerAt || 0) < 2500);
            if (hit && Math.hypot(p.x - q.x, p.y - q.y) < 320) return q;
        }
        return null;
    },

    // ---------- Match read, refreshed every few frames ----------

    assess(game) {
        if (this.ctx && this.frame - this.ctx.frame < 6) return this.ctx;
        const me = this.body;
        const ctx = { frame: this.frame, myPower: this.powerOf(this.selfView()), claims: new Map(), cautious: me.health < me.maxHealth * (me.status && (me.status.burn > 0 || me.status.poison > 0) ? 0.5 : 0.35) };
        // Who will arm themselves in the next moments? A fighter heading for a good
        // weapon (and getting there first) is as dangerous as if it already held it.
        for (const w of game.weapons) {
            if (!w.active || w.owner || w.lock > 0 || !this.noticed(w, game)) continue;
            const wp = this.weaponPower(w.type, 1);
            if (wp < 50) continue;
            const land = this.weaponRest(w, game.level);
            if (!land) continue;
            const cx = land.x + w.width / 2, feet = land.y + w.height;
            let bestP = null, bestEta = Infinity;
            for (const p of game.players) {
                if (p.isDead || p === me || p.team === me.team || p.isBird || p.onCloud) continue;
                if (this.powerOf(p) >= wp * 0.8) continue;             // already as well armed
                const eta = this.oppEta(p, cx, feet);
                if (eta < bestEta) { bestEta = eta; bestP = p; }
            }
            if (bestP && bestEta < 70) {
                const prev = ctx.claims.get(bestP);
                if (!prev || wp > prev) ctx.claims.set(bestP, wp * (bestEta < 30 ? 0.95 : 0.7));
            }
        }
        this.ctx = ctx;
        return ctx;
    },

    // ---------- Target choice: lower is better ----------

    scoreTarget(p, seen, ctx, focus, pressure) {
        const me = this.body;
        const d = Math.hypot(seen.x - me.x, seen.y - me.y);
        const h = this.hostility(p, seen);
        const hpFrac = seen.health / Math.max(1, seen.maxHealth);
        const claim = ctx.claims.get(p) || 0;
        const pw = Math.max(this.powerOf(seen), claim);
        let s = Math.min(d, 600) * 0.2;                                   // travel cost, deliberately mild
        if (seen.isBird) return s - 5000;                                  // an angel is everyone's problem
        // Threat: armed and beatable fighters come first; much better-armed ones are
        // left alone unless they are actually on us (we avoid them, see tacticMelee)
        const r = pw / Math.max(22, ctx.myPower);
        if (r <= 1.25) s -= pw * 5.0;
        else s += Math.min(190, (r - 1.25) * 90) * (1 - h);
        if (seen.onCloud) s -= 120;                                        // fliers can shoot from anywhere
        s -= 260 * h;                                                      // answer whoever is attacking us
        s -= (1 - hpFrac) * 120 + (hpFrac < 0.3 ? 70 : 0);                 // wounded: finish them
        s -= Math.min(8, seen.kills || 0) * 45;                            // runaway leaders get hunted
        // Already brawling with someone else: wade in only to finish a loser
        const other = p.isDead ? null : this.fightOf(p);
        if (other && h < 0.3) {
            const oFrac = other.health / Math.max(1, other.maxHealth);
            s += (hpFrac < 0.35 || oFrac < 0.35) ? -60 : 140;
        }
        // Hurt ourselves: don't pick on armed fighters
        if (ctx.cautious) s += pw * 0.9 * (1 - h);
        // Teammates gang up; rivals spread out
        if (focus.has(p)) s -= 160;
        s += (pressure.get(p) || 0) * 90;
        if (!p.isBot && !(pressure.get(p))) s -= 120;                      // a player nobody is fighting draws someone over
        if (this.target && this.target.ref === p) s -= 70;                 // stick with a target
        if (!this.canReach(seen)) s += 700;
        const fed = this.frustBan && this.frustBan.get(p);
        if (fed && fed > this.frame) s += 900;
        return s;
    },

    // ---------- How the opponent behaves (fast read, no waiting for the slow model) ----------

    // They have stopped fighting back: within reach for a while without swinging
    isPassive(opp) {
        if (opp && (opp.stunned || opp.frozen)) return true;   // can't fight back right now: go in
        const m = opp && this.models.get(opp.ref);
        if (!m) return false;
        return (m.calm || 0) > 45 || (m.still || 0) > 70 || (m.aggr < 0.012 && this.frame > 120);
    },

    // They aren't doing anything at all
    isAfk(opp) {
        const m = opp && this.models.get(opp.ref);
        return !!m && (m.still || 0) > 50;
    },

    // ---------- Letting two rivals fight, then striking ----------

    // Third party: both are busy with each other and neither is a danger to us yet.
    // Stand off, grab what we can, and move in when one is nearly done (or after a
    // while: nobody waits forever).
    wantsLurk(opp, other) {
        const me = this.body;
        if (!other || me.isBird || me.onCloud || opp.isBird || opp.onCloud) return false;
        if (this.frame < (this.lurkBan || 0)) return false;
        if (this.hostility(opp.ref, opp) >= 0.3 || this.hostility(other, this.perceive(other) || opp) >= 0.3) return false;
        const oFrac = other.health / Math.max(1, other.maxHealth), pFrac = opp.health / Math.max(1, opp.maxHealth);
        if (oFrac < 0.4 || pFrac < 0.4) return false;                      // time to finish the loser
        // Clearly better armed than both: no need to wait
        if (this.powerOf(this.selfView()) > Math.max(this.powerOf(opp), this.powerOf(other)) * 1.4) return false;
        if (!this.lurkSince) this.lurkSince = this.frame;
        if (this.frame - this.lurkSince > 420) { this.lurkBan = this.frame + 700; this.lurkSince = 0; return false; }
        return true;
    },

    tacticLurk(it, opp, other) {
        const me = this.body, level = this.game.level;
        it.mode = 'lurk';
        const mc = BotSim.cx(me);
        const centre = (BotSim.cx(opp) + BotSim.cx(other)) / 2;
        const side = mc < centre ? -1 : 1;
        let gx = centre + side * 290;
        const i = this.nav.ready ? this.nav.supportIndex(me) : -1;
        if (i >= 0) {
            const p = level.platforms[i];
            gx = Math.max(p.x + 40, Math.min(p.x + p.width - 40, gx));
        }
        it.goalX = gx + Math.sin(this.frame / 30 + me.id) * 25;
        it.goalNode = -1;
        it.stop = 22;
        it.face = side < 0 ? 1 : -1;
        // Ranged weapons plink the fight from where we stand
        if (me.weapon && WeaponDefs.isShot(me.weapon.type)) this.rangedFire(it, opp);
    },

    // ---------- Skill tier for what we're holding ----------

    // The kit never changes a bot's skill: an angel and the wand fliers hunting it all
    // play at their own tier. (Angels used to drop a tier, capped at Intermediate,
    // while wand fliers jumped to HACK: the angel could never land a hit.)
    effectiveTier() {
        return this.difficulty;
    },

    // ---------- Flying against an angel ----------

    // Where is the angel going? Velocity and acceleration over the last ~13
    // frames (works for a human pilot too), and how directly it is chasing us.
    angelMotion(A) {
        const h = this.history.get(A.ref), me = this.body;
        if (!h || h.length < 13) return { v: { x: 0, y: 0 }, a: { x: 0, y: 0 }, pursuit: 0, speed: 0 };
        const n = h.length, p0 = h[n - 1], p1 = h[n - 7], p2 = h[n - 13];
        const v1 = { x: (p0.x - p1.x) / 6, y: (p0.y - p1.y) / 6 }, v2 = { x: (p1.x - p2.x) / 6, y: (p1.y - p2.y) / 6 };
        const a = { x: (v1.x - v2.x) / 6, y: (v1.y - v2.y) / 6 };
        const speed = Math.hypot(v1.x, v1.y);
        const tx = me.x - A.x, ty = me.y - A.y, td = Math.hypot(tx, ty) || 1;
        return { v: v1, a, pursuit: speed > 0.5 ? (v1.x * tx + v1.y * ty) / (speed * td) : 0, speed };
    },

    // The staff is the only thing that really hurts an angel, and an angel's blast
    // (150px) and touch burn the staff-bearer first. So: stay outside its reach, on
    // a ring around where it WILL be, choosing each moment the point on that ring
    // that is safe, away from walls, not through the angel, and lined up with its
    // height (the beam is a horizontal line), and fire whenever it lines up.
    tacticCloudAngel(it, A) {
        const me = this.body, level = this.game.level, W = level.width, H = level.height;
        const mx = me.x + me.width / 2, my = me.y + me.height / 2;
        const Ax = A.x + A.width / 2, Ay = A.y + A.height / 2;
        const mo = this.angelMotion(A);
        const dist = Math.hypot(Ax - mx, Ay - my);
        const lead = Math.max(4, Math.min(18, dist / 9));
        const clampP = (x, y) => [Math.max(50, Math.min(W - 50, x)), Math.max(50, Math.min(H - 120, y))];
        const [px, py] = clampP(Ax + mo.v.x * lead + 0.5 * mo.a.x * lead * lead, Ay + mo.v.y * lead + 0.5 * mo.a.y * lead * lead);
        const blastReady = A.cd <= 6;
        // A pilot flying straight at us: survival first (a wider ring, safer margin, aim only when it's free)
        const chased = mo.pursuit > 0.5 && dist < 360;
        const R = (blastReady ? 285 : 215) + (mo.pursuit > 0.5 ? 40 : 0) + (chased ? 50 : 0);
        const safe = chased ? 230 : 190;
        const phi = Math.atan2(my - py, mx - px);
        const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
        const segDist = (x1, y1, x2, y2, qx, qy) => {
            const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((qx - x1) * dx + (qy - y1) * dy) / l2));
            return Math.hypot(x1 + dx * t - qx, y1 + dy * t - qy);
        };
        if (!this.orbitDir) this.orbitDir = Math.random() < 0.5 ? 1 : -1;
        let best = null;
        for (let k = 0; k < 24; k++) {
            const th = k * Math.PI * 2 / 24;
            const [cx2, cy2] = clampP(px + Math.cos(th) * R, py + Math.sin(th) * R * 0.85);
            let c = 0;
            const dA = Math.hypot(cx2 - Ax, cy2 - Ay), dP = Math.hypot(cx2 - px, cy2 - py);
            if (Math.min(dA, dP) < safe) c += 700;                             // inside its blast range, now or soon
            c += Math.abs(dP - R) * 0.35;
            c += Math.hypot(cx2 - mx, cy2 - my) * 0.3;                         // cheap to reach
            if (segDist(mx, my, cx2, cy2, Ax, Ay) < 175) c += 450;             // never fly THROUGH its danger zone
            const edge = Math.min(cx2, W - cx2, cy2, H - cy2);
            c += Math.max(0, 170 - edge) * (chased ? 2.2 : 1.3);                                // don't get cornered
            c += Math.min(Math.abs(cy2 - py), 170) * (chased ? 0.15 : 0.5);   // lined up = can fire
            c += Math.abs(angDiff(th, phi) - this.orbitDir * 0.6) * 80;       // keep circling the same way
            if (!best || c < best.c) best = { c, x: cx2, y: cy2, th };
        }
        const turned = angDiff(best.th, phi);
        if (Math.abs(turned) > 0.3) this.orbitDir = turned > 0 ? 1 : -1;
        it.fly = { x: best.x - me.width / 2, y: best.y - me.height / 2 };
        it.face = Ax >= mx ? 1 : -1;
        if (me.attackCooldown <= 0 && dist > (chased ? 200 : 150) && this.laserHits(A, it.face) && Math.random() < 0.55 + 0.45 * this.profile.aggression) it.attack = true;
    },

    // ---------- Restlessness: the general failsafe against any standoff ----------

    // Barely moved for ~4 seconds without being in a fight? Whatever it was waiting
    // for isn't coming: drop the target, the prize, the plan and the lurk, and walk
    // somewhere else for a couple of seconds, like a person getting restless.
    trackIdle() {
        const me = this.body;
        if (me.isDead || me.isBird || me.onCloud) { this.idleRef = null; return; }
        const r = this.idleRef;
        if (!r || Math.abs(me.x - r.x) + Math.abs(me.y - r.y) > 24) { this.idleRef = { x: me.x, y: me.y, at: this.frame }; return; }
        if (this.frame - r.at < 240) return;
        const t = this.target;
        const engaged = t && Math.abs(t.x - me.x) < 150 && Math.abs(t.y - me.y) < 90;
        this.idleRef = { x: me.x, y: me.y, at: this.frame };
        const waitingForCrystal = this.intent && this.intent.mode === 'fetch' && this.fetchW && this.fetchW.type === 'bird_crystal';
        if (engaged || waitingForCrystal || (this.intent && this.intent.mode === 'celebrate')) return;
        if (t) (this.frustBan || (this.frustBan = new Map())).set(t.ref, this.frame + 300);
        if (this.fetchW) this.prizeBan.set(this.fetchW, this.frame + 600);
        this.lurkBan = this.frame + 900; this.lurkSince = 0;
        this.plan = null; this.intent = null; this.nextThink = 0;
        // somewhere else: a platform other than ours
        const plats = this.game.level.platforms, here = this.nav.ready ? this.nav.supportIndex(me) : -1;
        const options = [];
        plats.forEach((p, i) => { if (i !== here && this.nav.standable(p) && !p.motion && p.width > 60) options.push(i); });
        const pick = options.length ? options[Math.floor(Math.random() * options.length)] : -1;
        this.wander = { until: this.frame + 150, node: pick };
    },

    tacticWander(it) {
        const level = this.game.level, w = this.wander;
        it.mode = 'wander';
        if (w.node >= 0) { const p = level.platforms[w.node]; it.goalNode = w.node; it.goalX = p.x + p.width / 2; }
        else it.goalX = level.width * (0.2 + Math.random() * 0.6);
        it.stop = 20;
    }
});
