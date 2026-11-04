// Bot motor: turns an intent into controller input. Every jump, drop and
// recovery is simulated with the real physics before the bot commits to it, so
// it lands what it attempts and never walks off a ledge by accident.
Object.assign(BotBrain.prototype, {

    drive(it) {
        const me = this.body;
        const out = this.output;
        out.x = 0; out.y = 0; out.jump = false; out.attack = false; out.shield = false;
        if (me.isBird || me.onCloud) {
            this.plan = null;
            this.fly(it, out);
        } else {
            if (this.plan && !this.followPlan(out)) this.plan = null;
            if (!this.plan) {
                if (me.grounded) { this.airSince = -1; this.groundMove(it, out); }
                else {
                    // Knocked into the air: it takes a moment to react, longer for weaker bots
                    if (this.airSince < 0) this.airSince = this.frame;
                    const delay = 2 + Math.round(this.profile.reaction * (1 - this.profile.skills.recover));
                    if (this.frame - this.airSince >= delay) this.recover(it, out);
                    else this.desperate(out, true);
                }
            }
        }
        this.overlayCombat(it, out);
        return out;
    },

    commit(plan, res, tag) {
        this.plan = { plan, t: 0, length: res.t + 2, trace: res.trace, tag };
        if (tag === 'over') { this.lastOver = this.frame; this.lastOverDir = plan.x1; }
    },

    // Replay a committed plan; bail out the moment reality diverges from the
    // simulation (we got hit, or a platform did something unexpected)
    followPlan(out) {
        const pl = this.plan, me = this.body;
        if (pl.t >= pl.length) return false;
        if (pl.t > 0 && pl.trace) {
            const k = (pl.t - 1) * 4;
            if (k + 3 < pl.trace.length &&
                (Math.abs(pl.trace[k] - me.x) > 2.5 || Math.abs(pl.trace[k + 1] - me.y) > 2.5 ||
                 Math.abs(pl.trace[k + 2] - me.velocity.x) > 1.5 || Math.abs(pl.trace[k + 3] - me.velocity.y) > 1.5)) {
                return false;
            }
        }
        BotSim.planInput(pl.plan, pl.t, out);
        pl.t++;
        return true;
    },

    // Airborne with no plan (usually just got hit): find the best way back down
    recover(it, out) {
        const me = this.body, level = this.game.level;
        if (this.frame < (this.recoverBlock || 0)) { this.desperate(out); return; }
        const goal = it.goalNode >= 0 ? level.platforms[it.goalNode] : null;
        const score = (res) => {
            const p = res.landed.src;
            const c = res.x + me.width / 2;
            let s = -res.t + Math.min(40, c - p.x, p.x + p.width - c) * 0.8;   // land away from edges
            if (p === goal) s += 120;
            if (it.goalX !== null) s -= Math.abs(c - it.goalX) * 0.05;
            return s;
        };
        // Weaker bots don't always find the best way back
        const sloppy = Math.random() > this.profile.skills.recover;
        let best = BotSim.searchRecovery(me, this.world, sloppy ? (res) => score(res) - Math.random() * 120 : score, { trace: true });
        if (!best) best = BotSim.searchRecovery(me, this.world, score, { trace: true, rich: true });
        if (best) {
            this.commit(best.plan, best.res, 'recover');
            this.followPlan(out);
            return;
        }
        this.recoverBlock = this.frame + 5;
        this.desperate(out);
    },

    // Nothing reaches safety: drift toward the closest floor and jump when falling
    desperate(out, drift) {
        const me = this.body, level = this.game.level, mc = BotSim.cx(me);
        if (drift) { out.x = 0; return; }   // still reacting to the hit
        let bestX = level.width / 2, bestD = Infinity;
        for (const p of level.platforms) {
            if (!this.nav.standable(p)) continue;
            const c = Math.max(p.x, Math.min(p.x + p.width, mc));
            const d = Math.abs(c - mc) + Math.max(0, me.y - p.y);
            if (d < bestD) { bestD = d; bestX = c; }
        }
        out.x = Math.sign(bestX - mc);
        out.jump = me.velocity.y > 3 && !me.jumpPressed;
    },

    groundMove(it, out) {
        const me = this.body;
        if (it.jump && this.tryJump(it, out)) return;
        if (it.snatch && this.trySnatch(it, out)) return;
        if (it.crouch) {
            if (me.isLaying || !it.face || me.facing === it.face) out.y = 1;
            else out.x = it.face;          // turn first, get down next frame
            return;
        }
        const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
        if (here >= 0 && it.goalNode >= 0 && it.goalNode !== here) {
            const plats = this.game.level.platforms;
            // The jump graph is a snapshot: from or onto a moving platform it's
            // stale, so search live jumps first there
            const moving = plats[here].motion || plats[it.goalNode].motion;
            if (moving && this.seekJump(here, it, out)) return;
            if (this.followRoute(here, it, out)) { this.unstick(out); return; }
            if (!moving && this.seekJump(here, it, out)) return;   // no known route: look for any way closer
        }
        let x = 0;
        if (it.goalX !== null) {
            const d = it.goalX - BotSim.cx(me);
            if (Math.abs(d) > it.stop) x = Math.sign(d);
            // brake early (friction stops us in ~4x our speed) to stop on the spot
            if (x && Math.sign(me.velocity.x) === x && Math.abs(d) <= Math.abs(me.velocity.x) * 4) x = 0;
        }
        out.x = it.allowEdge ? x : this.safeDir(x);
        this.unstick(out);
    },

    // Walking into a step, a bouncer or a wall and not moving: hop over it
    // (simulated first, so it only jumps where it lands safely past it)
    unstick(out) {
        const me = this.body;
        if (this.plan || !out.x || !me.grounded || Math.abs(me.velocity.x) > 0.3) { this.pushStuck = 0; return; }
        if (++this.pushStuck < 6 || this.frame < (this.unstickBlock || 0)) return;
        const d = out.x;
        // Simple hops first, then every jump style the nav knows (including ones that steer back after a bounce)
        const tries = [BotSim.plan(d, 999, d, 0, 40), BotSim.plan(d, 999, d, 0, 12), BotSim.plan(d, 999, d, 0, 18, 19, 40)].concat(this.nav.recipes(d));
        // A bouncer in the way: hop up onto it, then let go of the stick so the bounce goes straight up
        // (holding the direction would fly off the far side), with or without a late double jump
        const feet = me.y + me.height;
        const mat = this.game.level.platforms.find(t => t.type === 'trampoline' && Math.abs(t.y + t.height - feet) < 10 &&
            (d > 0 ? t.x - (me.x + me.width) < 12 && t.x + t.width > me.x : me.x - (t.x + t.width) < 12 && t.x < me.x + me.width));
        let onMat = 0;
        if (mat) {
            onMat = 1;
            const list = [];
            for (const wt of [6, 8, 10, 12, 14]) for (const j2 of [-1, 24, 28, 32, 36]) list.push(j2 < 0 ? BotSim.plan(d, wt, 0, 0, 40) : BotSim.plan(d, wt, 0, 0, j2 - 1, j2, 40));
            tries.unshift(...list);
        }
        for (const plan of tries) {
            const res = BotSim.run(me, plan, this.world, 160, { trace: true });
            if (res.dead || !res.landed || (!onMat && (res.x - me.x) * d < 24)) continue;
            this.commit(plan, res, 'hop');
            out.x = 0; out.jump = false;
            this.followPlan(out);
            this.pushStuck = 0;
            return;
        }
        this.unstickBlock = this.frame + 20;   // nothing works from here; let the tactic pick another goal
    },

    // Refuse input that would carry us off our platform; push back if we're
    // already sliding toward a drop
    safeDir(x) {
        const me = this.body;
        const dir = x || Math.sign(me.velocity.x);
        if (!dir) return x;
        const i = this.nav.supportIndex(me);
        if (i < 0) return x;
        const p = this.game.level.platforms[i];
        const room = dir > 0 ? p.x + p.width - me.x : me.x + me.width - p.x;
        if (room > 70) return x;
        const leaves = (plan) => BotSim.run(me, plan, this.world, 30, { untilLand: false, onStep: (g) => !g.grounded }).hit;
        if (x && !leaves(BotSim.plan(x, 3, 0))) return x;
        // Stepping down onto something (a lower floor, a bouncer) is fine; only
        // refuse when walking off would actually drop us out of the arena
        if (x && this.frame >= (this.dropCheckAt || 0)) {
            this.dropCheckAt = this.frame + 6;
            this.dropOk = !BotSim.run(me, BotSim.plan(x, 10, 0), this.world, 180).dead && BotSim.canRecover(Object.assign(this.selfView(), { velocity: { x: x * me.speed, y: 0 } }), this.world);
        }
        if (x && this.dropOk) return x;
        if (!leaves(BotSim.plan(0, 999, 0))) return 0;
        return -dir;
    },

    bannedEdges() {
        const s = new Set();
        for (const [e, until] of this.banned) {
            if (until > this.frame) s.add(e);
            else this.banned.delete(e);
        }
        return s;
    },

    // Walk to the next edge's takeoff spot, then search the exact takeoff that
    // lands on the target platform from where we really are
    followRoute(here, it, out) {
        const me = this.body;
        const route = this.nav.route(here, it.goalNode, me.x, this.bannedEdges());
        if (!route || !route.edges.length) return false;
        let e = route.edges[0];
        // Stick with the way we chose for a moment instead of flip-flopping
        // between two near-equal edges (dithering back and forth above someone)
        const c = this.routeCommit;
        if (c && c.here === here && c.goal === it.goalNode && this.frame < c.until && c.edge !== e &&
            this.nav.edges[here].includes(c.edge) && !this.banned.has(c.edge)) e = c.edge;
        else if (!c || c.edge !== e || c.here !== here || c.goal !== it.goalNode) this.routeCommit = { here, goal: it.goalNode, edge: e, until: this.frame + 75 };
        if (this.routeEdge !== e) { this.routeEdge = e; this.edgeStuck = 0; }
        const gap = e.takeoffX - me.x;
        if (Math.abs(gap) > 100) {
            out.x = this.safeDir(Math.sign(gap));
            return true;
        }
        if (this.frame >= (this.takeoffBlock || 0)) {
            const found = this.searchTakeoff(e);
            if (found) {
                this.commit(found.plan, found.res, 'route');
                this.followPlan(out);
                return true;
            }
            this.takeoffBlock = this.frame + 2;
        }
        out.x = this.safeDir(Math.sign(gap) || e.dir);
        if (++this.edgeStuck > 60) {           // this edge isn't working from here
            this.banned.set(e, this.frame + 240);
            this.edgeStuck = 0;
            this.routeCommit = null;
        }
        return true;
    },

    // Live search for any jump that gets us closer to the goal platform:
    // walk a little first (either way), then a full jump, a hop, early or late
    // double jumps, stepping off, or a mid-air reversal. Every one is simulated
    // with the real physics (moving platforms where they will be, bouncers and
    // all), and we take the landing that leaves the least left to do.
    seekJump(here, it, out) {
        const me = this.body, nav = this.nav, plats = this.game.level.platforms;
        if (this.frame < (this.seekBlock || 0)) return false;
        const goal = it.goalNode, G = plats[goal];
        const gx = it.goalX !== null ? it.goalX : G.x + G.width / 2;
        const left = (i, x) => {
            if (i === goal) return Math.abs(x - gx) / me.speed;
            const r = nav.route(i, goal, x, this.bannedEdges());
            if (r) return r.cost + Math.abs(r.landX - gx) / me.speed;
            const P = plats[i];
            return 400 + Math.abs(P.x + P.width / 2 - (G.x + G.width / 2)) / 3 + Math.max(0, P.y - G.y) * 1.2;
        };
        const now = left(here, me.x);
        const P = (...a) => BotSim.plan(...a);
        let best = null;
        for (const d of [1, -1, 0]) {
            const recipes = [P(d, 999, d, 0, 40), P(d, 999, d, 0, 8), P(d, 999, d, 0, 18, 19, 40), P(d, 999, d, 0, 30, 31, 40)];
            if (d !== 0) recipes.push(P(d, 999, d), P(d, 12, -d, 0, 40), P(d, 999, d, 10, 40));
            for (const k of d === 0 ? [0] : [0, 8, 18, 32, 48]) {
                for (const base of recipes) {
                    const plan = k ? BotSim.delayed(base, k, d) : base;
                    const res = BotSim.run(me, plan, this.world, 230, { trace: true });
                    if (res.dead || !res.landed) continue;
                    const L = plats.indexOf(res.landed.src);
                    if (L < 0 || L === here) continue;
                    const cost = res.t + left(L, res.x + me.width / 2);
                    if (!best || cost < best.cost) best = { plan, res, cost };
                }
            }
        }
        if (!best || best.cost > now - 20) { this.seekBlock = this.frame + 20; return false; }
        this.commit(best.plan, best.res, 'seek');
        this.followPlan(out);
        return true;
    },

    searchTakeoff(e) {
        const me = this.body;
        const target = this.game.level.platforms[e.to];
        const toward = Math.sign(e.takeoffX - me.x) || e.dir || 1;
        const holds = e.plan.j1 < 0 ? [null] : [null, 40, 9];
        let best = null;
        for (const k of [0, 2, 4, 7, 10, 14, 19]) {
            for (const h of holds) {
                const p = BotSim.delayed(e.plan, k, toward);
                if (h !== null) {
                    p.h1 = h;
                    if (p.j2 >= 0) p.j2 = p.j1 + h + 1;
                }
                const res = BotSim.run(me, p, this.world, 220, { trace: true });
                if (res.dead || !res.landed || res.landed.src !== target) continue;
                if (!best || res.t < best.res.t) best = { plan: p, res };
            }
            if (best) break;   // the earliest takeoff wins
        }
        return best;
    },

    // Cross-ups and dodge hops: only taken if the simulation lands safely
    tryJump(it, out) {
        const me = this.body, J = it.jump;
        if (this.frame < (this.jumpBlock || 0)) return false;
        const cands = J.kind === 'plan' ? [J.plan] : [
            BotSim.plan(J.dir, 999, J.dir, 0, 40),
            BotSim.plan(J.dir, 999, J.dir, 0, 18, 19, 40),
            BotSim.plan(J.dir, 999, J.dir, 0, 12)
        ];
        const level = this.game.level;
        const here = this.nav.supportIndex(me);
        for (const plan of cands) {
            const res = BotSim.run(me, plan, this.world, 160, { trace: true });
            if (res.dead || !res.landed) continue;
            if (J.kind === 'over') {
                const landC = res.x + me.width / 2;
                if (Math.sign(landC - BotSim.cx(J.target)) !== J.dir) continue;   // must clear them
                if (here >= 0 && res.landed.src !== level.platforms[here]) continue;
            }
            this.commit(plan, res, J.kind);
            this.followPlan(out);
            return true;
        }
        this.jumpBlock = this.frame + 6;
        return false;
    },

    // Grab a weapon or the crystal out of the air before it reaches the floor
    trySnatch(it, out) {
        const me = this.body, w = it.snatch;
        if (this.frame < (this.snatchBlock || 0) || !w.active || w.owner) return false;
        const wc = w.x + w.width / 2, mc = BotSim.cx(me);
        const flier = w.type === 'bird_crystal' || w.type === 'magic_stick';
        const fall = w.type === 'bird_crystal' ? 0.5 : 5;
        const land = this.weaponRest(w, this.game.level);
        if (!land) return false;
        const rest = land.y;
        // An item lying on a bouncer is below the ledge we stand on and has no walkable route (bouncers are not
        // platforms to stand on): step off, steer round and drop onto it. Anything else lower is reached by the route.
        const below = w.y > me.y + me.height - 4;
        const onBouncer = this.onBouncer(w, land);
        if (below && !onBouncer) return false;
        if (Math.abs(wc - mc) > (onBouncer ? 760 : below ? 560 : 240)) return false;
        if (onBouncer && this.frame < (this.bounceSearchAt || 0)) return false;   // the wide search is costly: not every frame
        const boxAt = (t) => { const yy = Math.min(rest, w.y + fall * t); return Weapon.pickBox(w.type, w.x, yy, yy >= rest); };
        const d = Math.sign(wc - mc) || 1;
        const plans = [BotSim.plan(d, 999, d)];
        for (const k of [0, 5, 10, 16]) {
            for (const dir of k === 0 ? [d, 0] : [d]) {
                for (const h of [40, 16]) {
                    plans.push(BotSim.delayed(BotSim.plan(dir, 999, dir, 0, h), k, d));
                    plans.push(BotSim.delayed(BotSim.plan(dir, 999, dir, 0, h, h + 1, 40), k, d));
                }
            }
        }
        if (below) {
            // walk off the near edge (either way) for a while, then steer back under ourselves toward the item
            for (const dir of [d, -d]) for (const T of [3, 8, 14, 22, 32, 44, 58, 76, 100]) {
                plans.push(BotSim.plan(dir, T, -dir));
                plans.push(BotSim.plan(dir, T, 0));
                plans.push(BotSim.plan(dir, T, d));
            }
        }
        if (onBouncer) {
            // Bouncers can carry us a long way: walk toward / over bouncers for a while, then steer in the air.
            // (Floating bouncers are reached by launching off another one, so the horizon is long.)
            for (const dir of [d, -d]) for (const T of [6, 14, 24, 36, 50, 66, 84, 104, 128]) {
                for (const T2 of [0, 10, 22, 36]) {
                    plans.push(BotSim.plan(dir, T, -dir, T + T2, 60));
                    plans.push(BotSim.plan(dir, T, d, T + T2, 60));
                }
            }
        }
        const best = BotSim.searchTouch(me, this.world, boxAt, plans, onBouncer ? 230 : below ? 150 : 80);
        if (!best) { this.snatchBlock = this.frame + 4; if (onBouncer) this.bounceSearchAt = this.frame + 14; return false; }
        // only the way TO the item has to be safe: once it is in hand the bot thinks again (the plan's tail, which keeps walking, is never run)
        if (!flier && BotSim.run(me, best.plan, this.world, best.res.t + 6).dead) {
            this.snatchBlock = this.frame + 4;
            return false;
        }
        const traced = BotSim.run(me, best.plan, this.world, best.res.t + 1, { trace: true, untilLand: false });
        this.commit(best.plan, traced, 'snatch');
        this.followPlan(out);
        return true;
    },

    // Flight (angel or cloud): steer velocity toward the target point. Same
    // thrust a player gets from holding a direction / jump / down.
    // How clumsy a tier is in the air: 1 = beginner .. 0 = HACK (which flies with exact, continuous control)
    flyClumsy() { return { easy: 1, medium: 0.72, hard: 0.45, nightmare: 0.22, hack: 0 }[this.difficulty] || 0; },

    // A person flying picks a spot, holds a direction toward it, lets go when close, and only steers again when
    // the target has clearly moved (or they have overshot): they do not re-aim every frame. The lower the tier, the
    // wider the "close enough", the longer between corrections, the later the braking and the slower they re-aim.
    flyHuman(it, out, s) {
        const me = this.body, f = it.fly;
        const cx = me.x, cy = me.y;
        let aim = this.flyAim;
        const dist = aim ? Math.hypot(aim.x - cx, aim.y - cy) : Infinity;
        const moved = aim ? Math.hypot(f.x - aim.x, f.y - aim.y) : Infinity;
        const retarget = 70 + 230 * s;                 // how far the target must wander before a new aim is taken
        const hold = 16 + 80 * s;                      // frames a plan is kept before it may change
        if (!aim || moved > retarget || (this.frame - aim.at > hold && moved > 40) || (dist < 26 + 30 * s && moved > 24)) {
            aim = this.flyAim = { x: f.x, y: f.y, at: this.frame };
        }
        // decisions are made every few frames, not every frame
        if (this.frame >= (this.flyNext || 0)) {
            const dz = 22 + 70 * s;                    // dead zone: close enough counts as there
            const decide = (e, v, cur, accel) => {
                const brake = (v * v) / (2 * accel);   // distance needed to stop
                const toward = Math.sign(e);
                if (Math.abs(e) < dz) return Math.abs(v) > 2.5 + 3 * s && v * e > 0 && brake > Math.abs(e) * (1.1 + s) ? -toward : 0;   // arrived: coast, or brake hard if still rushing
                if (v * toward < -0.8) return toward;                                       // drifting away from it: turn round
                if (v * toward > 0 && brake > Math.abs(e) * (1.15 + 1.2 * s) - dz * 0.2) return -toward;   // about to overshoot: brake (late for the clumsy)
                return toward;
            };
            const cap = this.profile.fly || 6.5;
            const ex = aim.x - cx, ey = aim.y - cy;
            const nx = decide(ex, me.velocity.x, this.flyIn.x, 0.5);
            let ny = decide(ey, me.velocity.y, this.flyIn.y, 0.5);
            // never push past the top speed
            const sx = nx !== 0 && Math.abs(me.velocity.x) >= cap && me.velocity.x * nx > 0 ? 0 : nx;
            const sy = ny !== 0 && Math.abs(me.velocity.y) >= cap && me.velocity.y * ny > 0 ? 0 : ny;
            this.flyIn.x = sx; this.flyIn.y = sy;
            this.flyNext = this.frame + Math.round(2 + 8 * s + Math.random() * 3 * s);
        }
        out.x = this.flyIn.x;
        if (this.flyIn.y < 0) out.jump = true; else if (this.flyIn.y > 0) out.y = 1;
    },

    fly(it, out) {
        const me = this.body, f = it.fly;
        if (!f) return;
        if (!this.flyIn) this.flyIn = { x: 0, y: 0 };
        const s = this.flyClumsy();
        if (s > 0) { this.flyHuman(it, out, s); return; }
        this.flyAim = null;
        // Top speed by tier: Nightmare flies as fast as a player can, Rookies slower
        const cap = this.profile.fly || 6.5;
        const dvx = Math.max(-cap, Math.min(cap, (f.x - me.x) * 0.09));
        const dvy = Math.max(-cap, Math.min(cap, (f.y - me.y) * 0.09));
        if (dvx > me.velocity.x + 0.4) out.x = 1;
        else if (dvx < me.velocity.x - 0.4) out.x = -1;
        if (dvy < me.velocity.y - 0.4) out.jump = true;
        else if (dvy > me.velocity.y + 0.4) out.y = 1;
    },

    // Shield and swing on top of movement. Swinging needs the right facing, and
    // facing comes from the direction pressed this frame.
    overlayCombat(it, out) {
        const me = this.body;
        out.shield = !!it.shield;
        if (!it.attack || me.attackCooldown > 0) return;
        const face = it.face || me.facing;
        const flying = me.isBird || me.onCloud;
        if (this.plan) {
            const facingAfter = out.x !== 0 && !me.isLaying ? out.x : me.facing;
            if (facingAfter === face) out.attack = true;   // only if it doesn't bend the plan
            return;
        }
        if (!flying && (me.isLaying || out.y > 0)) {
            if (me.facing === face) out.attack = true;
            else if (!it.dodging) { out.y = 0; out.x = face; }   // stand, turn, swing next frame
            return;
        }
        out.x = face;
        out.attack = true;
    }
});
