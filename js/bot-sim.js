// Physics sandbox for the bot. It runs the real Player movement code on throwaway
// "ghost" copies, so every plan the bot considers obeys exactly the rules a human
// plays by: same speed, acceleration, jump height, double jump and gravity.
const BotSim = {
    input: { x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false },

    cx(o) { return o.x + o.width / 2; },

    // Vertical gap between two bodies (0 when they overlap vertically)
    vgap(a, b) {
        if (a.y + a.height <= b.y) return b.y - (a.y + a.height);
        if (b.y + b.height <= a.y) return a.y - (b.y + b.height);
        return 0;
    },

    // Copy of the level that sims can advance without touching the real one.
    // Moving platforms get their future path precomputed; index 0 is "this
    // frame" because level.update runs before players each frame.
    createWorld(level, horizon) {
        horizon = horizon || 200;
        const platforms = [];
        const track = [];
        const bySrc = new Map();
        for (const p of level.platforms) {
            const c = {
                x: p.x, y: p.y, width: p.width, height: p.height, type: p.type, power: p.power,
                vx: p.vx, vy: p.vy, motion: p.motion, active: p.active, shake: 0, src: p
            };
            platforms.push(c);
            bySrc.set(p, c);
            if (p.motion && p.active) {
                const xs = new Float64Array(horizon + 1), ys = new Float64Array(horizon + 1);
                const vxs = new Float64Array(horizon + 1), vys = new Float64Array(horizon + 1);
                const q = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, phase: p.phase, motion: p.motion, width: p.width };
                xs[0] = q.x; ys[0] = q.y; vxs[0] = q.vx; vys[0] = q.vy;
                for (let t = 1; t <= horizon; t++) {
                    Level.stepMotion(q);
                    xs[t] = q.x; ys[t] = q.y; vxs[t] = q.vx; vys[t] = q.vy;
                }
                track.push({ plat: c, xs, ys, vxs, vys });
            }
        }
        return { width: level.width, height: level.height, voidSurface: level.voidSurface, platforms, track, horizon, t: 0, bySrc };
    },

    setTime(world, t) {
        const i = t > world.horizon ? world.horizon : t;
        if (world.t === i) return;
        world.t = i;
        for (const tr of world.track) {
            tr.plat.x = tr.xs[i];
            tr.plat.y = tr.ys[i];
            tr.plat.vx = tr.vxs[i];
            tr.plat.vy = tr.vys[i];
        }
    },

    // Fresh ghost built from a Player or a perceived snapshot of one
    ghost(src) {
        const g = Object.create(Player.prototype);
        g.isGhost = true;
        g.x = src.x; g.y = src.y;
        g.width = src.width; g.height = src.height;
        g.velocity = { x: src.velocity.x, y: src.velocity.y };
        g.speed = src.speed; g.speedMul = src.speedMul || 1; g.jumpForce = src.jumpForce; g.gravity = src.gravity;
        g.grounded = src.grounded; g.facing = src.facing;
        g.jumpCount = src.jumpCount; g.maxJumps = src.maxJumps;
        g.jumpPressed = !!src.jumpPressed;
        g.launched = src.launched !== undefined ? !!src.launched : src.velocity.y < -13;   // mid-bounce
        g.isLaying = src.isLaying; g.wings = src.wings;
        g.onCloud = src.onCloud; g.isBird = src.isBird;
        g.isBot = false; g.shieldActive = false; g.attackCooldown = 1e9; // sims never swing
        g.squash = 0; g.landFx = 0; g.weapon = null; g.dead = false;
        g.ridePlat = src.ridePlat || null;   // mapped onto the sim's copy in step()
        return g;
    },

    // One frame, in the same order Game.update and Player.update use
    step(g, input, world, t) {
        this.setTime(world, t);
        if (g.ridePlat && world.bySrc && world.bySrc.has(g.ridePlat)) g.ridePlat = world.bySrc.get(g.ridePlat);
        g.applyInput(input);
        g.applyPhysics(world);
        if (g.grounded) g.jumpCount = 0;
        if (g.launched && (g.velocity.y >= 0 || g.grounded)) g.launched = false;
        if (g.wings) g.gravity = 0.35;
        if (g.y > world.height + 100 || (world.voidSurface !== undefined && g.y + g.height > world.voidSurface)) g.dead = true;
    },

    // A plan is a tiny input script: optionally walk wx until frame wt, hold x1
    // until frame t1, then x2 (a mid-air reversal); jump is held during
    // [j1, j1+h1) and [j2, j2+h2); down is held until `crouch`.
    plan(x1, t1, x2, j1, h1, j2, h2) {
        return {
            x1, t1, x2,
            j1: j1 === undefined ? -1 : j1, h1: h1 || 0,
            j2: j2 === undefined ? -1 : j2, h2: h2 || 0,
            crouch: 0, wt: 0, wx: 0
        };
    },

    xAt(p, t) { return t < p.wt ? p.wx : (t < p.t1 ? p.x1 : p.x2); },

    planInput(p, t, out) {
        out.x = this.xAt(p, t);
        out.y = t < p.crouch ? 1 : 0;
        out.jump = (p.j1 >= 0 && t >= p.j1 && t < p.j1 + p.h1) ||
                   (p.j2 >= 0 && t >= p.j2 && t < p.j2 + p.h2);
        out.attack = false;
        out.shield = false;
        return out;
    },

    // The same plan started k frames later, walking walkDir until then
    delayed(p, k, walkDir) {
        return {
            wt: k, wx: walkDir,
            x1: p.x1, t1: p.t1 >= 999 ? 999 : p.t1 + k, x2: p.x2,
            j1: p.j1 >= 0 ? p.j1 + k : -1, h1: p.h1,
            j2: p.j2 >= 0 ? p.j2 + k : -1, h2: p.h2,
            crouch: 0
        };
    },

    // True once the plan has stopped asking for any input after frame t
    planIdleAfter(p, t) {
        return this.xAt(p, t) === 0 && t >= p.wt && t >= p.j1 + p.h1 && t >= p.j2 + p.h2 && t >= p.crouch;
    },

    supportOf(g, world) {
        const feet = g.y + g.height;
        for (const p of world.platforms) {
            if (!p.active || p.type === 'trampoline') continue;
            if (Math.abs(feet - p.y) < 1 && g.x + g.width > p.x && g.x < p.x + p.width) return p;
        }
        return null;
    },

    // Simulate a plan until the body lands after being airborne, dies, or maxT
    // runs out. opts: onStep(g, t) -> true ends the run as a "hit";
    // untilLand:false keeps going after landing; trace records x, y, vx, vy per
    // frame so execution can tell when the bot gets knocked off course.
    run(src, plan, world, maxT, opts) {
        const g = this.ghost(src);
        const inp = this.input;
        const trace = opts && opts.trace ? [] : null;
        const onStep = opts && opts.onStep;
        const untilLand = !(opts && opts.untilLand === false);
        const res = { dead: false, landed: null, hit: false, t: maxT - 1, x: 0, y: 0, trace };
        let wasAir = !g.grounded;
        let still = 0;
        for (let t = 0; t < maxT; t++) {
            this.planInput(plan, t, inp);
            this.step(g, inp, world, t);
            if (trace) trace.push(g.x, g.y, g.velocity.x, g.velocity.y);
            res.t = t;
            if (g.dead) { res.dead = true; break; }
            if (onStep && onStep(g, t)) { res.hit = true; break; }
            if (!g.grounded) { wasAir = true; still = 0; continue; }
            if (!untilLand) continue;
            if (wasAir) { res.landed = this.supportOf(g, world); break; }
            // Standing still with nothing left to press: the outcome is settled
            if (Math.abs(g.velocity.x) < 0.05 && this.planIdleAfter(plan, t) && ++still > 2) {
                res.landed = this.supportOf(g, world);
                break;
            }
        }
        if (!res.dead && !res.landed && g.grounded) res.landed = this.supportOf(g, world);
        res.x = g.x; res.y = g.y; res.vx = g.velocity.x;
        return res;
    },

    // Candidate ways to get back to solid ground from the current state
    recoveryPlans(src, rich) {
        const out = [];
        const jumpsLeft = src.grounded ? src.maxJumps : src.maxJumps - src.jumpCount;
        const first = src.jumpPressed ? 1 : 0;   // a held jump must be released first
        const j1s = rich ? [0, 3, 6, 10, 14, 19, 25, 32, 40] : [0, 7, 15, 26];
        const holds = rich ? [3, 9, 40] : [6, 40];
        const gaps = rich ? [1, 6, 12, 20] : [1, 10];
        if (src.isLaying && src.grounded) {
            const brace = this.plan(0, 999, 0);
            brace.crouch = 999;   // staying down cancels horizontal knockback
            out.push(brace);
        }
        for (const d of [1, -1, 0]) {
            out.push(this.plan(d, 999, d));
            if (jumpsLeft <= 0) continue;
            for (const j of j1s) {
                for (const h of holds) {
                    const j1 = j + first;
                    out.push(this.plan(d, 999, d, j1, h));
                    if (jumpsLeft < 2) continue;
                    for (const gp of gaps) out.push(this.plan(d, 999, d, j1, h, j1 + h + gp, 40));
                }
            }
        }
        return out;
    },

    // Best recovery by score(res, plan); opts: rich, any (first success), trace, maxT
    searchRecovery(src, world, score, opts) {
        opts = opts || {};
        const plans = this.recoveryPlans(src, opts.rich);
        const runOpts = opts.trace ? { trace: true } : null;
        let best = null;
        for (const plan of plans) {
            const res = this.run(src, plan, world, opts.maxT || 160, runOpts);
            if (res.dead || !res.landed) continue;
            const s = score ? score(res, plan) : -res.t;
            if (!best || s > best.score) {
                best = { plan, res, score: s };
                if (opts.any) return best;
            }
        }
        return best;
    },

    canRecover(src, world) {
        return !!this.searchRecovery(src, world, null, { any: true });
    },

    // Quickest plan whose body touches box(t): snatching weapons or the crystal
    searchTouch(src, world, boxAt, plans, maxT) {
        let best = null;
        for (const plan of plans) {
            const res = this.run(src, plan, world, maxT, {
                untilLand: false,
                onStep: (g, t) => Utils.rectIntersect(g, boxAt(t))
            });
            if (res.hit && !res.dead && (!best || res.t < best.res.t)) best = { plan, res };
        }
        return best;
    },

    // First frame a body following `plan` is hit by any predicted projectile
    // path (from Projectile.predict: entry t = position after frame t), or -1
    hitBy(src, plan, world, paths, maxT) {
        let hitT = -1;
        this.run(src, plan, world, maxT, {
            untilLand: false,
            onStep: (g, t) => {
                for (const path of paths) {
                    const s = path[t];
                    if (!s) continue;
                    if (g.x < s.x + s.r && g.x + g.width > s.x - s.r && g.y < s.y + s.r && g.y + g.height > s.y - s.r) {
                        hitT = t;
                        return true;
                    }
                }
                return false;
            }
        });
        return hitT;
    }
};
