// Position-based ragdoll for stickmen. Joints: 0 head, 1 neck, 2 hip,
// 3/4 front elbow/hand, 5/6 back elbow/hand, 7/8 front knee/foot, 9/10 back knee/foot.
// Used two ways: a full ragdoll when a fighter is knocked out, and a pinned one
// (neck + hip follow the body) that makes limbs flail when someone gets hit.
// Everything steps by dt, so slow motion and hit-stop slow it down too.
const RAG_BONES = [[0, 1], [1, 2], [1, 3], [3, 4], [1, 5], [5, 6], [2, 7], [7, 8], [2, 9], [9, 10]];
// Soft braces (minimum distances only) so the body can't fold into a ball
const RAG_BRACES = [[0, 2], [4, 2], [6, 2], [8, 2], [10, 2], [7, 9], [0, 3], [0, 5]];

class Ragdoll {
    constructor(joints, vx, vy, opts) {
        opts = opts || {};
        this.pts = joints.map(j => ({ x: j.x, y: j.y, px: j.x, py: j.y, vx, vy, pin: false }));
        this.rest = RAG_BONES.map(([a, b]) => Math.hypot(joints[a].x - joints[b].x, joints[a].y - joints[b].y) || 1);
        this.brace = RAG_BRACES.map(([a, b]) => 0.6 * (Math.hypot(joints[a].x - joints[b].x, joints[a].y - joints[b].y) || 1));
        this.headR = opts.headR || 9;
        this.age = 0;
        this.alpha = 1;
        this.cutB = new Set();   // severed bones (death animations)
        this.frozen = false;     // kinematic: a death animation moves the points itself
        this.spin(opts.spin || 0);
    }

    // Tumble: give every joint a velocity around the hip
    spin(w) {
        if (!w) return;
        const h = this.pts[2];
        for (const p of this.pts) {
            p.vx += -(p.y - h.y) * w;
            p.vy += (p.x - h.x) * w;
        }
    }

    // Kick joints with random jitter so limbs don't move as one rigid block
    shake(amount) {
        for (const p of this.pts) {
            p.vx += (Math.random() - 0.5) * amount;
            p.vy += (Math.random() - 0.5) * amount;
        }
    }

    // Sever bones: the body comes apart into separate pieces that fall on their own
    cut(list) {
        for (const k of list) this.cutB.add(k);
        const comp = this.pts.map((_, i) => i), find = (i) => { while (comp[i] !== i) i = comp[i] = comp[comp[i]]; return i; };
        RAG_BONES.forEach(([a, b], k) => { if (!this.cutB.has(k)) comp[find(a)] = find(b); });
        this.comp = this.pts.map((_, i) => find(i));
    }

    setPins(pins) {
        for (let i = 0; i < this.pts.length; i++) {
            const pin = pins && pins[i];
            const p = this.pts[i];
            p.pin = !!pin;
            if (pin) { p.px = p.x; p.py = p.y; p.x = pin.x; p.y = pin.y; }
        }
    }

    step(dt, level) {
        if (dt <= 0) return;
        this.dt = dt;
        this.age += dt;
        if (this.frozen) return;
        const g = 0.5;
        const air = Math.pow(0.992, dt);
        for (const p of this.pts) {
            if (p.pin) continue;
            p.px = p.x; p.py = p.y;
            p.vy += g * dt;
            p.vx *= air; p.vy *= air;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        for (let it = 0; it < 5; it++) {
            for (let k = 0; k < RAG_BONES.length; k++) if (!this.cutB.has(k)) this.satisfy(RAG_BONES[k][0], RAG_BONES[k][1], this.rest[k], false);
            for (let k = 0; k < RAG_BRACES.length; k++) if (!this.comp || this.comp[RAG_BRACES[k][0]] === this.comp[RAG_BRACES[k][1]]) this.satisfy(RAG_BRACES[k][0], RAG_BRACES[k][1], this.brace[k], true);
            if (level) this.collide(level);
        }
        // Hard limit: a joint shoved out of a platform (or flung by an impulse) can leave a bone far longer than
        // it should be; never let a bone stay stretched past 20%
        for (let pass = 0, bad = true; pass < 10 && bad; pass++) {
            bad = false;
            for (let k = 0; k < RAG_BONES.length; k++) {
                if (this.cutB.has(k)) continue;
                const a = this.pts[RAG_BONES[k][0]], b = this.pts[RAG_BONES[k][1]], lim = this.rest[k] * 1.2;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
                if (d <= lim) continue;
                bad = true;
                const wa = a.pin ? 0 : 1, wb = b.pin ? 0 : 1;
                if (!wa && !wb) continue;
                const f = (d - lim) / d / (wa + wb);
                a.x += dx * f * wa; a.y += dy * f * wa; b.x -= dx * f * wb; b.y -= dy * f * wb;
            }
        }
        for (const p of this.pts) {
            if (p.pin) continue;
            p.vx = (p.x - p.px) / dt;
            p.vy = (p.y - p.py) / dt;
        }
    }

    satisfy(ia, ib, rest, minOnly) {
        const a = this.pts[ia], b = this.pts[ib];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (minOnly && d >= rest) return;
        const wa = a.pin ? 0 : 1, wb = b.pin ? 0 : 1;
        if (!wa && !wb) return;
        const diff = (d - rest) / d / (wa + wb);
        a.x += dx * diff * wa; a.y += dy * diff * wa;
        b.x -= dx * diff * wb; b.y -= dy * diff * wb;
    }

    collide(level) {
        for (let i = 0; i < this.pts.length; i++) {
            const p = this.pts[i];
            if (p.pin) continue;
            const r = i === 0 ? this.headR : 2.5;
            // the arena's side edges: bodies bounce off them instead of flying out of the world
            if (level.width) {
                if (p.x < 6) { const v = p.x - p.px; p.x = 6; p.px = p.x + v * 0.35; }
                else if (p.x > level.width - 6) { const v = p.x - p.px; p.x = level.width - 6; p.px = p.x + v * 0.35; }
            }
            for (const pl of level.platforms) {
                if (!pl.active) continue;
                if (p.x <= pl.x - r || p.x >= pl.x + pl.width + r || p.y <= pl.y - r || p.y >= pl.y + pl.height + r) continue;
                const top = p.y - (pl.y - r), bottom = pl.y + pl.height + r - p.y;
                const left = p.x - (pl.x - r), right = pl.x + pl.width + r - p.x;
                const m = Math.min(top, bottom, left, right);
                if (m === top) {
                    p.y = pl.y - r;
                    p.x = p.px + (p.x - p.px) * 0.55;    // ground friction
                    if (pl.type === 'trampoline' && p.y - p.py > 2) p.py = p.y + 9 * this.dt;   // bounce corpses
                } else if (m === bottom) p.y = pl.y + pl.height + r;
                else if (m === left) p.x = pl.x - r;
                else p.x = pl.x + pl.width + r;
            }
        }
    }

    joints() { return this.pts; }
}
