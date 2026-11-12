// Platform graph for the bot. Edges are discovered by simulating real jumps with
// the bot's own movement stats, so every route is one a human could also perform.
// It also records which platform sides are survivable to walk off or be punched
// off, which drives ring-out play and keeps the bot away from deadly edges.
class BotNav {
    constructor() {
        this.level = null;
        this.platformsRef = null;
        this.edges = [];
        this.walkSafe = [];
        this.knockSafe = [];
        this.ready = false;
        this.job = null;
        this.age = 0;
        this.sig = '';
        this.hasMoving = false;
    }

    standable(p) { return p.active && p.type !== 'trampoline'; }

    // One graph per level, shared by every bot (several bots per match)
    static shared(level) {
        const cache = BotNav.cache || (BotNav.cache = new WeakMap());
        let nav = cache.get(level.platforms);
        if (!nav) { nav = new BotNav(); cache.set(level.platforms, nav); }
        return nav;
    }

    signature(level) {
        let s = '';
        for (const p of level.platforms) s += p.active ? '1' : '0';
        return s;
    }

    // Called every frame. Builds one source platform per call so a new level
    // never causes a hitch; rebuilds when ice breaks or moving platforms drift.
    tick(level, body, frame) {
        if (frame !== undefined) {
            if (frame === this.lastFrame) return;   // already ticked this frame by another bot
            this.lastFrame = frame;
        }
        if (level.platforms !== this.platformsRef) {
            this.level = level;
            this.platformsRef = level.platforms;
            this.ready = false;
            this.edges = level.platforms.map(() => []);
            this.walkSafe = level.platforms.map(() => ({ left: true, right: true }));
            this.knockSafe = level.platforms.map(() => ({ left: true, right: true }));
            this.hasMoving = level.platforms.some(p => p.motion);
            this.job = null;
        }
        this.age++;
        if (!this.job) {
            const sig = this.signature(level);
            if (!this.ready || sig !== this.sig || (this.hasMoving && this.age > 240)) this.startJob(level, sig);
        }
        if (this.job) this.workJob(body);
    }

    startJob(level, sig) {
        // Work items are (platform, takeoff sample) pairs so each frame stays cheap
        const queue = [];
        level.platforms.forEach((p, i) => {
            if (!this.standable(p)) return;
            const n = this.samplesFor(p, 30).length;
            for (let s = 0; s < n; s++) queue.push([i, s]);
            queue.push([i, -1]);   // side-safety checks
        });
        this.job = {
            queue,
            keep: level.platforms.map(() => new Map()),
            edges: level.platforms.map(() => []),
            walkSafe: level.platforms.map(() => ({ left: false, right: false })),
            knockSafe: level.platforms.map(() => ({ left: false, right: false })),
            world: BotSim.createWorld(level, 240)
        };
        this.sig = sig;
        this.age = 0;
    }

    workJob(body) {
        const job = this.job;
        if (job.queue.length) {
            const [i, si] = job.queue.shift();
            this.buildFrom(i, si, body, job);
        }
        if (!job.queue.length) {
            // Swap in the finished graph; the old one stayed usable meanwhile
            job.keep.forEach((m, i) => { job.edges[i] = Array.from(m.values()); });
            this.edges = job.edges;
            this.walkSafe = job.walkSafe;
            this.knockSafe = job.knockSafe;
            this.ready = true;
            this.job = null;
        }
    }

    standingBody(A, x, vx, body) {
        return {
            x, y: A.y - 60, width: body.width, height: 60, velocity: { x: vx, y: 0 },
            speed: body.speed, jumpForce: body.jumpForce, gravity: 0.5, grounded: true,
            facing: vx < 0 ? -1 : 1, jumpCount: 0, maxJumps: body.maxJumps, jumpPressed: false,
            isLaying: false, wings: false, onCloud: false, isBird: false
        };
    }

    // The jump styles a player actually uses: full, short hop, double jumps at
    // different timings, and stepping off a ledge (optionally jumping after)
    // Jumps a player actually uses: full, short hop, double jumps at different
    // timings, stepping off a ledge, and reversals (jump out past a ledge, then
    // steer back over a platform above - needed to climb towers)
    recipes(d) {
        const P = (...a) => BotSim.plan(...a);
        const list = [
            P(d, 999, d, 0, 40),
            P(d, 999, d, 0, 5),
            P(d, 999, d, 0, 18, 19, 40),
            P(d, 999, d, 0, 7, 8, 40),
            P(d, 999, d, 0, 12, 13, 12),
            P(d, 999, d, 0, 27, 28, 40),   // late double jump: save it for after a bouncer launch
            P(d, 999, d, 0, 40, 41, 40)
        ];
        if (d !== 0) list.push(P(d, 999, d), P(d, 999, d, 8, 40), P(d, 999, d, 8, 9, 18, 40));
        for (const rv of [8, 16]) {
            for (const d2 of [-1, 0, 1]) {
                if (d2 === d) continue;
                list.push(P(d, rv, d2, 0, 40), P(d, rv, d2, 0, 18, 19, 40));
            }
        }
        return list;
    }

    samplesFor(A, w) {
        let xs = [A.x - w + 3, A.x + A.width - 3, A.x + A.width / 2 - w / 2];
        if (A.width > 150) xs.push(A.x + A.width * 0.25 - w / 2, A.x + A.width * 0.75 - w / 2);
        // A bouncer sitting on this floor is an obstacle you hop onto, not a place to stand: drop takeoff spots
        // inside it and add the two spots right beside it (the bot walks up to the mat and jumps on)
        const mats = this.level ? this.level.platforms.filter(t => t.type === 'trampoline' && Math.abs(t.y + t.height - A.y) < 6 && t.x + t.width > A.x && t.x < A.x + A.width) : [];
        if (mats.length) {
            xs = xs.filter(x => !mats.some(t => x + w > t.x && x < t.x + t.width));
            for (const t of mats) {
                if (t.x - w - 1 >= A.x - w + 3) xs.push(t.x - w - 1);
                if (t.x + t.width + 1 <= A.x + A.width - 3) xs.push(t.x + t.width + 1);
            }
        }
        return xs;
    }

    buildFrom(i, si, body, job) {
        const plats = this.level.platforms;
        const A = plats[i];
        if (!A) return;   // the ledge it was going to look at is gone
        if (si >= 0) {
            const x = this.samplesFor(A, body.width)[si];
            const keep = job.keep[i];
            for (const d of [-1, 0, 1]) {
                const src = this.standingBody(A, x, d * body.speed, body);
                for (const plan of this.recipes(d)) {
                    const res = BotSim.run(src, plan, job.world, 220);
                    if (res.dead || !res.landed) continue;
                    const to = plats.indexOf(res.landed.src);
                    if (to < 0 || to === i) continue;
                    const key = to + ':' + si;
                    const prev = keep.get(key);
                    if (!prev || res.t + 1 < prev.frames) {
                        keep.set(key, { to, takeoffX: x, dir: d, plan, frames: res.t + 1, landX: res.x });
                    }
                }
            }
            return;
        }
        job.walkSafe[i] = {
            left: this.sideSurvives(A, -1, body, job.world, false),
            right: this.sideSurvives(A, 1, body, job.world, false)
        };
        job.knockSafe[i] = {
            left: this.sideSurvives(A, -1, body, job.world, true),
            right: this.sideSurvives(A, 1, body, job.world, true)
        };
    }

    // Can a body leaving this side of A (walking off, or punched off from the
    // edge) get back onto any platform with its best recovery?
    sideSurvives(A, side, body, world, knocked) {
        const x = side > 0 ? A.x + A.width - 4 : A.x - body.width + 4;
        const src = this.standingBody(A, x, side * (knocked ? 10 : body.speed), body);
        if (knocked) src.velocity.y = -5;   // what createMeleeAttack applies
        return BotSim.canRecover(src, world);
    }

    // Dijkstra over platforms. Cost is in frames: walking to the takeoff spot
    // (plus a turnaround when the run-up faces the wrong way) and air time.
    route(from, to, startX, banned) {
        if (!this.ready || from < 0 || to < 0) return null;
        if (from === to) return { edges: [], cost: 0, landX: startX };
        const n = this.edges.length;
        const dist = new Array(n).fill(Infinity);
        const posX = new Array(n).fill(0);
        const via = new Array(n).fill(null);
        const done = new Array(n).fill(false);
        dist[from] = 0;
        posX[from] = startX;
        for (;;) {
            let u = -1;
            for (let k = 0; k < n; k++) {
                if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
            }
            if (u < 0 || u === to) break;
            done[u] = true;
            for (const e of this.edges[u]) {
                if (banned && banned.has(e)) continue;
                let walk = Math.abs(e.takeoffX - posX[u]) / 5;
                if (e.dir !== 0 && Math.sign(e.takeoffX - posX[u]) === -e.dir) walk += 12;
                const c = dist[u] + walk + e.frames + 8;
                if (c < dist[e.to]) {
                    dist[e.to] = c;
                    posX[e.to] = e.landX;
                    via[e.to] = { from: u, edge: e };
                }
            }
        }
        if (!via[to]) return null;
        const edges = [];
        for (let v = to; v !== from; v = via[v].from) edges.unshift(via[v].edge);
        return { edges, cost: dist[to], landX: posX[to] };
    }

    // Index of the platform a body is standing on, or -1
    supportIndex(body) {
        if (!this.level) return -1;
        const plats = this.level.platforms;
        const feet = body.y + body.height;
        for (let i = 0; i < plats.length; i++) {
            const p = plats[i];
            if (!this.standable(p)) continue;
            if (Math.abs(feet - p.y) < 1.5 && body.x + body.width > p.x && body.x < p.x + p.width) return i;
        }
        return -1;
    }

    // Highest standable platform at or below feetY that spans cx, or -1
    nodeBelow(cx, feetY) {
        if (!this.level) return -1;
        const plats = this.level.platforms;
        let best = -1;
        for (let i = 0; i < plats.length; i++) {
            const p = plats[i];
            if (!this.standable(p)) continue;
            if (cx < p.x - 12 || cx > p.x + p.width + 12 || p.y < feetY - 4) continue;
            if (best < 0 || p.y < plats[best].y) best = i;
        }
        return best;
    }
}
