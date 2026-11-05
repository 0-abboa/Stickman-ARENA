// Environmental features: 36 kinds of living map pieces. Each round picks two or three that suit
// the arena's theme and fits them into the layout: rope bridges that sag and swing under whoever
// walks on them, ledges that crumble, conveyor belts, balance scales, lava vents and water spouts,
// steam pipes, a rising tide, currents and bubble columns, quicksand, gusts, fans and tornadoes,
// flame jets, tesla coils, sweeping lasers, lightning, meteors, pendulum blades, boulders,
// chandeliers, spike traps, crushers, portals, low gravity, ghost hands, healing springs, ziplines,
// barrel cannons and parachuting presents.
//
// Nothing dangerous ever pops a warning icon. A hazard tells you it is coming through the world
// itself: smoke, ash, sparks and a trembling ground before lava erupts; bubbles before a spout;
// rattling and dust before spikes; a gathering cloud and crawling static before lightning; a
// glowing streak and a growing shadow before a meteor. Bots read the same tells (Features.dangers).
const Features = (() => {
    const TAU = Math.PI * 2;
    const R = Math.random;
    const RND = (a, b) => a + R() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const K = {};

    // ---------- shared helpers ----------
    const solids = (L) => L.platforms.filter(p => p.active && p.type !== 'trampoline' && !p.motion && !p.feature);
    const floorY = (L) => L.height - 50;
    const alive = (g) => g ? g.players.filter(p => !p.isDead) : [];
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const inBox = (p, b) => p.x + p.width > b.x && p.x < b.x + b.w && p.y + p.height > b.y && p.y < b.y + b.h;
    const standingOn = (p, plat) => p.grounded && p.ridePlat === plat;
    const onTop = (p, x0, x1, y) => p.grounded && Math.abs(p.y + p.height - y) < 3 && p.x + p.width > x0 && p.x < x1;
    const claim = (L, box) => { const u = L.featureUsed || (L.featureUsed = []); if (u.some(b => overlap(b, box))) return false; u.push(box); return true; };
    // a spot on top of a solid platform with `clear` px of open air above it, `half` px either side
    function spotOnTop(L, half, clear, filter) {
        const plats = solids(L).filter(p => p.width >= half * 2 + 10 && (!filter || filter(p)));
        for (let tries = 0; tries < 30 && plats.length; tries++) {
            const p = plats[(R() * plats.length) | 0];
            const x = RND(p.x + half + 4, p.x + p.width - half - 4);
            const box = { x: x - half, y: p.y - clear, w: half * 2, h: clear };
            if (L.platforms.some(q => q !== p && q.active && overlap(box, { x: q.x, y: q.y, w: q.width, h: q.height }))) continue;
            if (!claim(L, { x: box.x - 20, y: box.y, w: box.w + 40, h: box.h + 10 })) continue;
            return { x, y: p.y, plat: p };
        }
        return null;
    }
    // an open rectangle of air (no platform inside), for things that hang or float
    function openAir(L, w, h, yMin, yMax) {
        for (let tries = 0; tries < 40; tries++) {
            const box = { x: RND(60, L.width - 60 - w), y: RND(yMin, yMax - h), w, h };
            if (L.platforms.some(q => q.active && overlap(box, { x: q.x - 10, y: q.y - 10, w: q.width + 20, h: q.height + 20 }))) continue;
            if (!claim(L, box)) continue;
            return box;
        }
        return null;
    }
    // a ledge at [x0,x1] with its top at y can be reached with an ordinary jump from some real platform
    function reachable(L, x0, x1, y) {
        // you can't jump up through a platform, so the take-off has to be beside the ledge, not under it
        for (const q of L.platforms) {
            if (!q.active || q.type === 'trampoline' || q.feature) continue;
            const rise = q.y - y;
            if (rise > 140 || rise < -320) continue;
            const allow = rise > 20 ? 130 - rise * 0.45 : 220;
            const segs = rise > 20 ? [[q.x, Math.min(q.x + q.width, x0 - 34)], [Math.max(q.x, x1 + 34), q.x + q.width]] : [[q.x, q.x + q.width]];
            for (const [a, b] of segs) {
                if (b - a < 20) continue;
                const gap = Math.max(0, a - x1, x0 - b);
                if (gap <= allow) return true;
            }
        }
        return false;
    }
    // proof by simulation: an ordinary (90% strength) jump from a real platform nearby lands on it
    function simReachable(L, plat) {
        if (typeof BotSim === 'undefined' || typeof BotNav === 'undefined') return true;
        const world = BotSim.createWorld(L, 10), body = { width: 30, speed: 5, jumpForce: 12 * 0.9, maxJumps: 2 };
        const target = world.bySrc.get(plat);
        const srcs = L.platforms.filter(q => q.active && q.type !== 'trampoline' && !q.feature && !q.motion && Math.abs(q.y - plat.y) < 320 && Math.max(0, q.x - (plat.x + plat.width), plat.x - (q.x + q.width)) < 260)
            .sort((a, b) => Math.abs(a.y - plat.y) - Math.abs(b.y - plat.y)).slice(0, 6);
        for (const q of srcs) {
            // take-off spots: the end nearest the ledge first, then every 24px back from it
            const toward = plat.x + plat.width / 2 > q.x + q.width / 2 ? 1 : -1, xs = [];
            for (let k = 0; k < 10; k++) { const x = toward > 0 ? q.x + q.width - 30 - k * 24 : q.x + k * 24; if (x >= q.x - 2 && x <= q.x + q.width - 28) xs.push(x); }
            for (const x of xs) {
                for (const d of [toward, -toward]) {
                    const src = BotNav.prototype.standingBody(q, x, d * body.speed, body);
                    for (const plan of BotNav.prototype.recipes(d)) {
                        const res = BotSim.run(src, plan, world, 150);
                        if (!res.dead && res.landed && res.landed.src === plat) return true;
                    }
                }
            }
        }
        return false;
    }
    function makePlat(L, inst, x, y, w, h, draw) {
        const p = L.createPlatform(x, y, w, h || 14);
        p.feature = inst; p.noDraw = !draw;
        L.platforms.push(p);
        return p;
    }
    // move a platform and whoever stands on it
    function shift(g, plat, dx, dy) {
        plat.x += dx; plat.y += dy;
        for (const p of alive(g)) if (p.ridePlat === plat && p.grounded) { p.x += dx; p.y += dy; }
    }
    function hurt(g, inst, p, dmg, kx, ky, opts) {
        const cd = inst.cd || (inst.cd = new Map());
        if ((cd.get(p) || 0) > g.frameCount) return false;
        cd.set(p, g.frameCount + ((opts && opts.every) || 24));
        p.lastHitType = 'env'; p.lastHitAt = g.frameCount;
        p.takeDamage(dmg, p.lastAttacker && performance.now() - (p.lastAttackerAt || 0) < 3000 ? p.lastAttacker : null);
        if (kx !== undefined) { p.velocity.x = kx; p.velocity.y = ky; p.grounded = false; p.launched = ky < -10; }
        if (opts && opts.status && g.applyStatus) g.applyStatus(p, opts.status, null, null, dmg);
        p.flinchNew = true; p.hitFlash = 1;
        return true;
    }
    const env = (p) => p.env || (p.env = { grip: 1, speed: 1, jump: 1, grav: 1 });
    const tremor = (g, x, y, k) => { if (!g || g.demo) return; const near = alive(g).some(p => !p.isBot && Math.abs(p.x - x) < 500); if (near) g.fx.addTrauma(k); };
    const glow = (ctx, x, y, r, rgb, a) => { if (a <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };
    const puff = (g, x, y, o) => g.fx.add(Object.assign({ type: 'puff', x, y, vx: RND(-0.3, 0.3), vy: -RND(0.4, 1.2), life: 50, color: '120,120,120', size: 4, grow: 0.15, alpha: 0.5 }, o));
    // a phase machine: idle -> warn -> active -> cool, with durations in frames
    function cycle(inst, d) {
        inst.t = (inst.t || 0) + 1;
        if (!inst.phase) { inst.phase = 'idle'; inst.left = d.idle(); }
        if (--inst.left <= 0) {
            const next = { idle: 'warn', warn: 'active', active: 'cool', cool: 'idle' }[inst.phase];
            inst.phase = next; inst.left = d[next](); inst.enter = true;
        } else inst.enter = false;
        return inst.phase;
    }
    const prog = (inst, total) => 1 - inst.left / total;

    // =====================================================================================
    //  PLATFORMS THAT BEHAVE
    // =====================================================================================

    // 1. Rope bridge across a gap: it sags under weight and swings when someone lands on it
    K.swingBridge = {
        themes: { dirt: 3, stone: 2, haunted: 2, ocean: 1, xmas: 1, candy: 1, any: 1 },
        place(L) {
            const S = solids(L), cands = [];
            for (const a of S) for (const b of S) {
                if (a === b) continue;
                const gap = b.x - (a.x + a.width);
                if (gap < 120 || gap > 460 || Math.abs(a.y - b.y) > 50) continue;
                const box = { x: a.x + a.width, y: Math.min(a.y, b.y) - 90, w: gap, h: 140 };
                if (L.platforms.some(q => q !== a && q !== b && q.active && overlap(box, { x: q.x, y: q.y, w: q.width, h: q.height }))) continue;
                cands.push([a, b, box]);
            }
            if (!cands.length) return null;
            const [a, b, box] = cands[(R() * cands.length) | 0];
            if (!claim(L, box)) return null;
            const inst = { x0: a.x + a.width, y0: a.y, x1: b.x, y1: b.y, segs: [], swing: 0, swingV: 0 };
            const n = Math.max(5, Math.round((inst.x1 - inst.x0) / 26)), w = (inst.x1 - inst.x0) / n;
            for (let i = 0; i < n; i++) inst.segs.push(makePlat(L, inst, inst.x0 + i * w, inst.y0, w + 0.5, 10));
            inst.prevLoad = 0;
            return inst;
        },
        shape(inst, u, load) {
            const base = inst.y0 + (inst.y1 - inst.y0) * u;
            let sag = 12 * Math.sin(Math.PI * u) + inst.swing * Math.sin(Math.PI * u);
            for (const r of load) sag += 34 * Math.max(0, 1 - Math.abs(u - r) * 2.6) * Math.sin(Math.PI * clamp(r, 0.05, 0.95));
            return base + sag;
        },
        step(inst, L, g) {
            const span = inst.x1 - inst.x0, load = [];
            let landed = false;
            for (const p of alive(g)) if (inst.segs.some(s => standingOn(p, s))) { load.push(clamp((p.x + p.width / 2 - inst.x0) / span, 0, 1)); if (Math.abs(p.velocity.x) > 2) inst.swingV += 0.04 * Math.sign(R() - 0.5); }
            if (load.length > inst.prevLoad) { inst.swingV += 1.6; landed = true; }
            inst.prevLoad = load.length;
            inst.swingV += -0.06 * inst.swing; inst.swingV *= 0.97; inst.swing += inst.swingV;
            inst.load = load;
            inst.segs.forEach((s, i) => {
                const u = (i + 0.5) / inst.segs.length, y = this.shape(inst, u, load);
                shift(g, s, 0, y - s.y);
            });
            if (landed && g) g.fx.dust(inst.x0 + span / 2, inst.y0 + 20, 4, 30, '170,140,110');
        },
        back(ctx, inst) {
            const n = inst.segs.length, span = inst.x1 - inst.x0, load = inst.load || [];
            // two hand ropes
            ctx.strokeStyle = '#6d4c2a'; ctx.lineWidth = 2.4;
            for (const off of [-30, -26]) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(inst.x0 + span * u, this.shape(inst, u, load) + off + 10 * Math.sin(Math.PI * u) * 0.3); } ctx.stroke(); }
            // posts at the ends
            ctx.fillStyle = '#4e342e'; ctx.fillRect(inst.x0 - 3, inst.y0 - 34, 5, 34); ctx.fillRect(inst.x1 - 2, inst.y1 - 34, 5, 34);
            // planks and hangers
            inst.segs.forEach((s, i) => {
                const u = (i + 0.5) / n, nx = s.x + s.width;
                ctx.strokeStyle = 'rgba(110,80,50,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x + s.width / 2, s.y); ctx.lineTo(s.x + s.width / 2, this.shape(inst, u, load) - 27); ctx.stroke();
                const yl = i ? this.shape(inst, i / n, load) : inst.y0, yr = this.shape(inst, (i + 1) / n, load);
                ctx.fillStyle = i % 2 ? '#8d6e45' : '#7a5c38';
                ctx.beginPath(); ctx.moveTo(s.x + 1, yl); ctx.lineTo(nx - 1, yr); ctx.lineTo(nx - 1, yr + 8); ctx.lineTo(s.x + 1, yl + 8); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(s.x + s.width * 0.3, Math.min(yl, yr) + 3, 2, 2);
            });
        }
    };

    // 2. Crumbling ledge: stand on it and it cracks, shakes, sheds dust and falls away, then regrows
    K.crumble = {
        themes: { stone: 3, dirt: 2, haunted: 2, lava: 2, ice: 1, any: 1 },
        place(L) {
            const S = solids(L).filter(p => p.y < floorY(L) - 60 && p.width >= 70 && p.width <= 260 && !p.featureTag);
            if (!S.length) return null;
            const p = S[(R() * S.length) | 0];
            if (!claim(L, { x: p.x, y: p.y - 10, w: p.width, h: p.height + 20 })) return null;
            p.featureTag = 'crumble';
            return { plat: p, state: 'ok', t: 0, y0: p.y };
        },
        step(inst, L, g) {
            const p = inst.plat;
            if (inst.state === 'ok') { if (alive(g).some(q => standingOn(q, p))) { inst.state = 'crack'; inst.t = 0; } }
            else if (inst.state === 'crack') {
                inst.t++;
                if (inst.t % 4 === 0) g.fx.add({ type: 'chunk', x: p.x + R() * p.width, y: p.y + p.height, vx: RND(-0.5, 0.5), vy: RND(0, 1), life: 30, color: '#7a6a5a', size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 });
                if (inst.t % 9 === 0) g.fx.dust(p.x + R() * p.width, p.y + p.height, 2, 10, DUST_TINT[L.material]);
                if (inst.t > 54) {
                    inst.state = 'gone'; inst.t = 0; p.active = false;
                    for (let i = 0; i < 12; i++) g.fx.add({ type: 'chunk', x: p.x + R() * p.width, y: p.y + R() * p.height, vx: RND(-1.5, 1.5), vy: RND(-2, 1), life: 60, color: '#6d5a48', size: 4 + R() * 5, gravity: 0.35, rot: R() * 6, vr: RND(-0.2, 0.2), drag: 0.99 });
                    g.fx.dust(p.x + p.width / 2, p.y, 10, p.width / 2, DUST_TINT[L.material]);
                    tremor(g, p.x, p.y, 0.08);
                }
            } else if (inst.state === 'gone') { inst.t++; if (inst.t > 360 && !alive(g).some(q => inBox(q, { x: p.x, y: p.y, w: p.width, h: p.height }))) { p.active = true; inst.state = 'grow'; inst.t = 0; } }
            else { inst.t++; if (inst.t > 30) inst.state = 'ok'; }
        },
        front(ctx, inst) {
            const p = inst.plat;
            if (inst.state === 'crack') {
                const k = inst.t / 54;
                ctx.strokeStyle = `rgba(30,20,10,${0.4 + k * 0.5})`; ctx.lineWidth = 1.2;
                const s = (p.seed * 7) | 0;
                for (let i = 0; i < 3 + k * 6; i++) { const x = p.x + ((s + i * 37) % 100) / 100 * p.width; ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x + ((i * 13) % 9) - 4, p.y + p.height * 0.6); ctx.lineTo(x + ((i * 7) % 11) - 5, p.y + p.height); ctx.stroke(); }
            } else if (inst.state === 'grow') { ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - inst.t / 30)})`; ctx.fillRect(p.x, p.y, p.width, p.height); }
        },
        jitter(inst) { return inst.state === 'crack' ? (R() - 0.5) * (1 + inst.t / 18) : 0; },
        danger(inst) { const p = inst.plat; return inst.state === 'crack' ? [{ x: p.x, y: p.y - 60, w: p.width, h: 62, soon: 54 - inst.t, kind: 'floor' }] : []; }
    };

    // 3. Conveyor belt: riders are carried along; the treads roll
    K.conveyor = {
        themes: { neon: 3, stone: 1, candy: 2, xmas: 2, any: 1 },
        place(L) {
            const S = solids(L).filter(p => p.width >= 140 && !p.featureTag && p.y < floorY(L) + 1);
            if (!S.length) return null;
            const p = S[(R() * S.length) | 0];
            if (!claim(L, { x: p.x, y: p.y - 4, w: p.width, h: 8 })) return null;
            p.featureTag = 'conveyor';
            return { plat: p, v: (R() < 0.5 ? -1 : 1) * RND(1.4, 2.1), off: 0, flipAt: 600 + R() * 600 };
        },
        step(inst, L, g) {
            inst.off += inst.v;
            if ((inst.flipAt -= 1) <= 0) { inst.v *= -1; inst.flipAt = 600 + R() * 600; g.fx.sparks(inst.plat.x + inst.plat.width / 2, inst.plat.y, '255,220,120', 6, -Math.PI / 2, 2, 3); }
            for (const p of alive(g)) if (standingOn(p, inst.plat)) p.x += inst.v;
        },
        back(ctx, inst) {
            const p = inst.plat;
            ctx.fillStyle = '#2b2b32'; ctx.fillRect(p.x, p.y - 4, p.width, 7);
            ctx.fillStyle = '#ffca28';
            for (let x = ((inst.off % 22) + 22) % 22; x < p.width - 6; x += 22) { ctx.beginPath(); const cx = p.x + x, d = Math.sign(inst.v); ctx.moveTo(cx - 4 * d, p.y - 3); ctx.lineTo(cx + 3 * d, p.y - 0.5); ctx.lineTo(cx - 4 * d, p.y + 2); ctx.fill(); }
            ctx.fillStyle = '#555'; for (const ex of [p.x + 4, p.x + p.width - 4]) { ctx.beginPath(); ctx.arc(ex, p.y, 4, 0, TAU); ctx.fill(); }
        }
    };

    // 4. Balance scale: two pans on one beam; the heavier side sinks and lifts the other
    K.balanceScale = {
        themes: { candy: 2, xmas: 2, stone: 2, magic: 2, dirt: 1, any: 1 },
        place(L) {
            // hang it just beside a real ledge, so the near pan is an easy hop and the far one a hop from that
            const S = solids(L).filter(p => p.y > 260 && p.y < floorY(L) + 1);
            for (let tries = 0; tries < 24; tries++) {
                const q = S[(R() * S.length) | 0]; if (!q) return null;
                const side = R() < 0.5 ? -1 : 1, y0 = q.y - RND(40, 90);
                const cxv = side > 0 ? q.x + q.width + RND(70, 120) + 175 : q.x - RND(70, 120) - 175;
                const box = { x: cxv - 180, y: y0 - 150, w: 360, h: 180 };
                if (box.x < 30 || box.x + box.w > L.width - 30 || box.y < 40) continue;
                if (L.platforms.some(o => o.active && overlap(box, { x: o.x - 6, y: o.y - 6, w: o.width + 12, h: o.height + 12 }))) continue;
                if (!claim(L, box)) continue;
                const inst = { cx: cxv, py: y0 - 130, y0, off: 0, offV: 0 };
                inst.l = makePlat(L, inst, inst.cx - 175, inst.y0, 110, 14);
                inst.r = makePlat(L, inst, inst.cx + 65, inst.y0, 110, 14);
                if (simReachable(L, inst.l) && simReachable(L, inst.r)) return inst;
                L.platforms.splice(L.platforms.indexOf(inst.l), 1); L.platforms.splice(L.platforms.indexOf(inst.r), 1); L.featureUsed.pop();
            }
            return null;
        },
        step(inst, L, g) {
            const nL = alive(g).filter(p => standingOn(p, inst.l)).length, nR = alive(g).filter(p => standingOn(p, inst.r)).length;
            const target = clamp((nL - nR) * 48, -70, 70);
            inst.offV += (target - inst.off) * 0.02; inst.offV *= 0.88; inst.off += inst.offV;
            shift(g, inst.l, 0, inst.y0 + inst.off - inst.l.y);
            shift(g, inst.r, 0, inst.y0 - inst.off - inst.r.y);
        },
        back(ctx, inst) {
            const a = Math.atan2(-2 * inst.off, 240);
            ctx.save(); ctx.translate(inst.cx, inst.py);
            ctx.fillStyle = '#5d4037'; ctx.fillRect(-4, -10, 8, 30);
            ctx.rotate(a); ctx.fillStyle = '#8d6e63'; ctx.fillRect(-130, -4, 260, 8); ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
            ctx.restore();
            for (const [pan, sx] of [[inst.l, -1], [inst.r, 1]]) {
                const ex = inst.cx + sx * 120 * Math.cos(a), ey = inst.py + sx * 120 * Math.sin(a);
                ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(pan.x + 6, pan.y); ctx.moveTo(ex, ey); ctx.lineTo(pan.x + pan.width - 6, pan.y); ctx.stroke();
                ctx.fillStyle = '#b0855a'; ctx.beginPath(); ctx.moveTo(pan.x, pan.y); ctx.lineTo(pan.x + pan.width, pan.y); ctx.lineTo(pan.x + pan.width - 10, pan.y + 14); ctx.lineTo(pan.x + 10, pan.y + 14); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffd54f'; ctx.fillRect(pan.x, pan.y, pan.width, 3);
            }
        }
    };

    // 5. Soft platform (marshmallow, cloud, raft): it sinks while someone stands on it and floats back up
    K.sinkPlatform = {
        themes: { candy: 3, cloud: 3, ocean: 2, xmas: 1, any: 1 },
        place(L) {
            const S = solids(L).filter(p => p.y < floorY(L) - 100 && p.width <= 240 && !p.featureTag);
            for (const p of S.sort(() => R() - 0.5)) {
                let room = 200;
                for (const q of L.platforms) if (q !== p && q.active && q.x < p.x + p.width && q.x + q.width > p.x && q.y > p.y) room = Math.min(room, q.y - (p.y + p.height) - 72);
                if (room < 40 || !claim(L, { x: p.x, y: p.y, w: p.width, h: p.height + room })) continue;
                p.featureTag = 'sink';
                return { plat: p, y0: p.y, depth: 0, max: Math.min(110, room), squish: 0 };
            }
            return null;
        },
        step(inst, L, g) {
            const loaded = alive(g).filter(p => standingOn(p, inst.plat)).length;
            const target = loaded ? Math.min(inst.max, 50 * loaded + 30) : 0;
            const v = clamp((target - inst.depth) * 0.03, -1.2, 0.8);
            inst.depth += v; inst.squish += ((loaded ? 1 : 0) - inst.squish) * 0.1;
            shift(g, inst.plat, 0, inst.y0 + inst.depth - inst.plat.y);
        },
        back(ctx, inst) { const p = inst.plat; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + p.width / 2, p.y + p.height + 4, p.width * 0.45 * (1 + inst.squish * 0.1), 5, 0, 0, TAU); ctx.fill(); }
    };

    // 6. Phase stones: stepping stones that fade in and out on a beat (they flicker before they go)
    K.phaseBlocks = {
        themes: { magic: 3, neon: 2, haunted: 2, ice: 1, any: 1 },
        place(L) {
            // a row of stepping stones leading off a real ledge
            const S = solids(L).filter(p => p.y > 240);
            for (let tries = 0; tries < 24; tries++) {
                const q = S[(R() * S.length) | 0]; if (!q) return null;
                const side = R() < 0.5 ? -1 : 1, y = q.y - RND(0, 50);
                const x0 = side > 0 ? q.x + q.width + RND(60, 100) : q.x - RND(60, 100) - 300;
                const box = { x: x0, y: y - 70, w: 300, h: 110 };
                if (box.x < 30 || box.x + box.w > L.width - 30) continue;
                if (L.platforms.some(o => o.active && overlap(box, { x: o.x - 6, y: o.y - 6, w: o.width + 12, h: o.height + 12 }))) continue;
                if (!claim(L, box)) continue;
                const inst = { blocks: [], t: 0 };
                for (let i = 0; i < 3; i++) inst.blocks.push({ p: makePlat(L, inst, x0 + i * 110, y + (i % 2) * 24, 80, 14), off: i * 60 });
                const near = side > 0 ? inst.blocks[0].p : inst.blocks[2].p;
                if (simReachable(L, near)) return inst;
                for (const bk of inst.blocks) L.platforms.splice(L.platforms.indexOf(bk.p), 1);
                L.featureUsed.pop();
            }
            return null;
        },
        step(inst, L, g) {
            inst.t++;
            for (const b of inst.blocks) {
                const ph = (inst.t + b.off) % 360;
                b.ph = ph;
                const solid = ph < 240;
                if (solid !== b.p.active) { b.p.active = solid; g.fx.sparks(b.p.x + 40, b.p.y + 7, '190,150,255', 8, undefined, 0, 2); }
            }
        },
        back(ctx, inst, L) {
            for (const b of inst.blocks) {
                const p = b.p, ph = b.ph || 0;
                let a = ph < 240 ? 1 : 0.15;
                if (ph > 180 && ph < 240) a = Math.random() < 0.5 ? 0.35 : 0.9;   // flickering: about to go
                if (ph >= 330) a = 0.15 + (ph - 330) / 30 * 0.6;               // coming back
                ctx.save(); ctx.globalAlpha = a;
                const gr = ctx.createLinearGradient(0, p.y, 0, p.y + 14); gr.addColorStop(0, '#d1b3ff'); gr.addColorStop(1, '#6a3db8');
                ctx.fillStyle = gr; ctx.fillRect(p.x, p.y, p.width, 14);
                ctx.strokeStyle = '#f3e5ff'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, 13);
                ctx.restore();
                glow(ctx, p.x + p.width / 2, p.y + 7, 50, '180,140,255', 0.25 * a);
            }
        },
        danger(inst) { return inst.blocks.filter(b => b.ph > 170 && b.ph < 240).map(b => ({ x: b.p.x, y: b.p.y - 60, w: b.p.width, h: 62, soon: 240 - b.ph, kind: 'floor' })); }
    };

    // 7. Ice sheet: no grip, you slide
    K.iceSlick = {
        themes: { ice: 3, xmas: 3, candy: 1, any: 1 },
        place(L) {
            const s = spotOnTop(L, 90, 70);
            if (!s) return null;
            return { x0: s.x - 90, x1: s.x + 90, y: s.y };
        },
        step(inst, L, g) { for (const p of alive(g)) if (onTop(p, inst.x0, inst.x1, inst.y)) { const e = env(p); e.grip = Math.min(e.grip, 0.07); if (Math.abs(p.velocity.x) > 3 && R() < 0.3) g.fx.add({ type: 'puff', x: p.x + p.width / 2, y: inst.y, vx: 0, vy: -0.3, life: 20, color: '230,245,255', size: 2, grow: 0.1, alpha: 0.6 }); } },
        back(ctx, inst, L) {
            const w = inst.x1 - inst.x0, t = L.time;
            const gr = ctx.createLinearGradient(0, inst.y - 4, 0, inst.y + 3); gr.addColorStop(0, 'rgba(220,245,255,0.95)'); gr.addColorStop(1, 'rgba(140,200,240,0.7)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(inst.x0, inst.y + 1); ctx.quadraticCurveTo(inst.x0 + w / 2, inst.y - 7, inst.x1, inst.y + 1); ctx.lineTo(inst.x1, inst.y + 3); ctx.lineTo(inst.x0, inst.y + 3); ctx.fill();
            const sx = inst.x0 + ((t * 2) % (w + 40)) - 20;
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx, inst.y - 4, 14, 1.5);
        }
    };

    // 8. Sticky patch (tar, caramel, honey, mud): slow feet and weak jumps
    K.tarPatch = {
        themes: { candy: 3, dirt: 2, lava: 2, haunted: 1, any: 1 },
        place(L) {
            const s = spotOnTop(L, 80, 70);
            if (!s) return null;
            const look = { candy: ['#c8792a', '#f0a850'], lava: ['#1a1414', '#3a2e2a'], dirt: ['#4a3420', '#6a4a2a'], haunted: ['#263a1e', '#3e5a2a'] }[L.material] || ['#2a2418', '#4a3e2a'];
            return { x0: s.x - 80, x1: s.x + 80, y: s.y, look, bubbles: [] };
        },
        step(inst, L, g) {
            for (const p of alive(g)) if (onTop(p, inst.x0, inst.x1, inst.y)) { const e = env(p); e.speed = Math.min(e.speed, 0.42); e.jump = Math.min(e.jump, 0.62); if (R() < 0.08) g.fx.add({ type: 'drop', x: p.x + p.width / 2, y: inst.y - 2, vx: RND(-1, 1), vy: -RND(1, 2), life: 26, color: `${inst.look[1]}`, size: 1.6, gravity: 0.3 }); }
            if (R() < 0.03) inst.bubbles.push({ x: RND(inst.x0 + 6, inst.x1 - 6), r: 0, life: 40 });
            for (const b of inst.bubbles) { b.r += 0.12; b.life--; }
            inst.bubbles = inst.bubbles.filter(b => b.life > 0);
        },
        back(ctx, inst) {
            const w = inst.x1 - inst.x0;
            ctx.fillStyle = inst.look[0]; ctx.beginPath(); ctx.moveTo(inst.x0 - 6, inst.y + 2); ctx.quadraticCurveTo(inst.x0 + w / 2, inst.y - 6, inst.x1 + 6, inst.y + 2); ctx.fill();
            ctx.fillStyle = inst.look[0]; for (let x = inst.x0 + 8; x < inst.x1; x += 26) ctx.fillRect(x, inst.y, 3, 6 + ((x * 7) % 8));
            ctx.strokeStyle = inst.look[1]; ctx.lineWidth = 1; for (const b of inst.bubbles) { ctx.beginPath(); ctx.arc(b.x, inst.y - 1, b.r, Math.PI, 0); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(inst.x0 + w * 0.3, inst.y - 3, w * 0.2, 1.2);
        }
    };

    // 9. Icicles: they tremble and shed snow, then drop; they regrow
    K.icicles = {
        themes: { ice: 3, xmas: 3, stone: 1, any: 0.5 },
        place(L) {
            const S = solids(L).filter(p => p.y > 120 && p.width >= 100);
            for (const p of S.sort(() => R() - 0.5)) {
                const under = { x: p.x, y: p.y + p.height, w: p.width, h: 120 };
                if (L.platforms.some(q => q !== p && q.active && overlap(under, { x: q.x, y: q.y, w: q.width, h: q.height }) && q.y < p.y + p.height + 90)) continue;
                if (!claim(L, under)) continue;
                const list = [];
                for (let x = p.x + 16; x < p.x + p.width - 10; x += 30 + R() * 16) list.push({ x, y0: p.y + p.height, y: p.y + p.height, len: 16 + R() * 14, vy: 0, state: 'hang', t: R() * 300, grow: 1 });
                return { plat: p, list };
            }
            return null;
        },
        step(inst, L, g) {
            for (const c of inst.list) {
                c.t--;
                if (c.state === 'hang' && c.t <= 0) { c.state = 'shake'; c.t = 60; }
                else if (c.state === 'shake') { if (c.t % 6 === 0) g.fx.add({ type: 'puff', x: c.x + RND(-3, 3), y: c.y0 + 2, vx: 0, vy: 0.6, life: 30, color: '240,250,255', size: 1.5, grow: 0.02, alpha: 0.8 }); if (c.t <= 0) { c.state = 'fall'; c.vy = 0; } }
                else if (c.state === 'fall') {
                    c.vy += 0.5; c.y += c.vy;
                    const box = { x: c.x - 4, y: c.y, w: 8, h: c.len };
                    for (const p of alive(g)) if (inBox(p, box)) { hurt(g, c, p, 12, (p.x < c.x ? -1 : 1) * 4, 2, { status: { slow: 50 } }); }
                    const hitPlat = L.platforms.find(q => q.active && q !== inst.plat && c.x > q.x && c.x < q.x + q.width && c.y + c.len >= q.y && c.y + c.len - c.vy <= q.y + 2);
                    if (hitPlat || c.y > L.height + 40) { g.fx.shards(c.x - 8, (hitPlat ? hitPlat.y : L.height) - 10, 16, 10, 'rgba(220,245,255,0.95)', 10); c.state = 'regrow'; c.t = 240; c.y = c.y0; c.grow = 0; }
                } else if (c.state === 'regrow') { c.grow = Math.min(1, c.grow + 1 / 240); if (c.t <= 0) { c.state = 'hang'; c.t = 200 + R() * 400; } }
            }
        },
        front(ctx, inst) {
            for (const c of inst.list) {
                const jit = c.state === 'shake' ? (R() - 0.5) * 2 : 0, len = c.len * (c.state === 'regrow' ? c.grow : 1);
                ctx.fillStyle = 'rgba(210,240,255,0.92)'; ctx.beginPath(); ctx.moveTo(c.x - 5 + jit, c.y); ctx.lineTo(c.x + jit, c.y + len); ctx.lineTo(c.x + 5 + jit, c.y); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(c.x - 2 + jit, c.y + 2, 1.2, len * 0.5);
            }
        },
        danger(inst) { return inst.list.filter(c => c.state === 'shake' || c.state === 'fall').map(c => ({ x: c.x - 18, y: c.y0, w: 36, h: 400, soon: c.state === 'shake' ? c.t : 0 })); }
    };

    // =====================================================================================
    //  ERUPTIONS, JETS, WATER, AIR
    // =====================================================================================

    // 10. Lava vent: smoke, ash and sparks and a trembling ground, then a column of lava
    K.lavaGeyser = {
        themes: { lava: 4, stone: 1, haunted: 0.5 },
        place(L) { const s = spotOnTop(L, 30, 260); return s ? { x: s.x, y: s.y } : null; },
        D: { idle: () => RND(240, 520), warn: () => 110, active: () => 80, cool: () => 120 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), x = inst.x, y = inst.y;
            if (ph === 'warn') {
                const k = prog(inst, 110);
                if (R() < 0.35 + k * 0.5) puff(g, x + RND(-14, 14), y - 2, { color: '70,60,58', size: 4 + k * 5, life: 70, alpha: 0.35 + k * 0.3, vy: -RND(0.6, 1.6) });
                if (R() < 0.2 + k * 0.6) g.fx.add({ type: 'puff', x: x + RND(-20, 20), y: y - RND(20, 60), vx: RND(-0.3, 0.3), vy: RND(-0.4, 0.2), life: 60, color: '160,150,150', size: 1.2, grow: 0, alpha: 0.8 });   // ash
                if (R() < 0.1 + k * 0.4) g.fx.sparks(x + RND(-10, 10), y - 2, '255,160,60', 2, -Math.PI / 2, 0.8, 3 + k * 3);
                if (inst.t % 10 === 0) { tremor(g, x, y, 0.02 + k * 0.05); g.fx.add({ type: 'chunk', x: x + RND(-20, 20), y: y - 2, vx: RND(-0.6, 0.6), vy: -RND(1, 2.5) * k, life: 24, color: '#3a2a22', size: 2, gravity: 0.3, rot: 0, vr: 0.4, drag: 0.99 }); }
            } else if (ph === 'active') {
                if (inst.enter) { AudioSys.playExplosion && AudioSys.playExplosion(); tremor(g, x, y, 0.3); g.fx.flashAt(x, y - 40, '255,180,80', 120, 10); }
                for (let i = 0; i < 4; i++) g.fx.add({ type: 'drop', x: x + RND(-12, 12), y: y - 6, vx: RND(-1.6, 1.6), vy: -RND(10, 16), life: 50, color: R() < 0.5 ? 'rgba(255,190,70,1)' : 'rgba(255,110,30,1)', size: RND(2, 4), gravity: 0.35 });
                if (R() < 0.4) g.fx.embers(x, y - RND(40, 200), 2, 20);
                const col = { x: x - 26, y: y - 270, w: 52, h: 270 };
                for (const p of alive(g)) if (inBox(p, col)) hurt(g, inst, p, 8, (p.x + 15 < x ? -1 : 1) * 3, -14, { every: 14, status: { burn: 80 } });
            } else if (ph === 'cool' && R() < 0.2) puff(g, x + RND(-8, 8), y - 4, { color: '90,80,80', size: 3, life: 60, alpha: 0.3 });
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y, ph = inst.phase, t = inst.t || 0;
            ctx.fillStyle = '#2a1410'; ctx.beginPath(); ctx.ellipse(x, y, 22, 6, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#1a0a08'; ctx.beginPath(); ctx.ellipse(x, y - 1, 12, 3, 0, 0, TAU); ctx.fill();
            const heat = ph === 'warn' ? 0.4 + 0.6 * prog(inst, 110) : ph === 'active' ? 1 : ph === 'cool' ? 0.4 : 0.15 + 0.08 * Math.sin(t * 0.05);
            glow(ctx, x, y - 2, 30 + heat * 30, '255,110,30', 0.5 * heat);
            ctx.strokeStyle = `rgba(255,140,50,${heat})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 18, y - 2); ctx.lineTo(x - 10, y + 1); ctx.moveTo(x + 10, y); ctx.lineTo(x + 20, y - 2); ctx.lineTo(x + 32, y + 1); ctx.stroke();
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const x = inst.x, y = inst.y, k = Math.min(1, (80 - inst.left) / 10), fade = Math.min(1, inst.left / 15), h = 260 * k;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, `rgba(255,120,30,${0.2 * fade})`); gr.addColorStop(0.3, `rgba(255,170,60,${0.8 * fade})`); gr.addColorStop(1, `rgba(255,230,140,${fade})`);
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 14, y); for (let i = 0; i <= 10; i++) { const u = i / 10; ctx.lineTo(x - 14 - u * 10 + Math.sin(inst.t * 0.5 + u * 8) * 4, y - h * u); } for (let i = 10; i >= 0; i--) { const u = i / 10; ctx.lineTo(x + 14 + u * 10 + Math.sin(inst.t * 0.5 + u * 8 + 2) * 4, y - h * u); } ctx.fill();
            ctx.restore();
            glow(ctx, x, y - h * 0.5, 120, '255,120,40', 0.35 * fade);
        },
        danger(inst) { const r = { x: inst.x - 40, y: inst.y - 280, w: 80, h: 282 }; return inst.phase === 'warn' ? [Object.assign(r, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(r, { soon: 0 })] : []; }
    };

    // 11. Water spout: bubbles rise and the surface bulges, then a jet throws you up (no damage)
    K.waterSpout = {
        themes: { ocean: 4, ice: 1, any: 0.6 },
        place(L) { const s = spotOnTop(L, 28, 300); return s ? { x: s.x, y: s.y } : null; },
        D: { idle: () => RND(200, 420), warn: () => 80, active: () => 120, cool: () => 60 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), x = inst.x, y = inst.y;
            if (ph === 'warn') { if (R() < 0.6) g.fx.swirl(x + RND(-12, 12), y, { shape: 'bubble', color: '200,235,255', rise: RND(30, 80), spin: RND(-1, 1), r0: 2, r1: 6, size: RND(2, 4), life: 40 }); }
            else if (ph === 'active') {
                for (let i = 0; i < 3; i++) g.fx.add({ type: 'drop', x: x + RND(-10, 10), y: y - RND(0, 20), vx: RND(-1.2, 1.2), vy: -RND(8, 14), life: 40, color: 'rgba(180,230,255,0.9)', size: RND(1.5, 3), gravity: 0.3 });
                const col = { x: x - 30, y: y - 330, w: 60, h: 330 };
                for (const p of alive(g)) if (inBox(p, col)) { p.velocity.y = Math.max(-10.5, p.velocity.y - 1.3); p.velocity.x += (x - (p.x + p.width / 2)) * 0.01; p.grounded = false; p.launched = true; p.jumpCount = Math.min(p.jumpCount, 1); }
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y;
            ctx.fillStyle = '#3a6a7a'; ctx.beginPath(); ctx.ellipse(x, y, 18, 5, 0, Math.PI, 0); ctx.fill();
            if (inst.phase === 'warn') { const k = prog(inst, 80); ctx.strokeStyle = `rgba(200,240,255,${0.3 + k * 0.5})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y - 2, 12 + k * 10, 3 + k * 3, 0, Math.PI, 0); ctx.stroke(); }
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const x = inst.x, y = inst.y, k = Math.min(1, (120 - inst.left) / 10), fade = Math.min(1, inst.left / 12), h = 320 * k;
            const gr = ctx.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, `rgba(200,240,255,${0.15 * fade})`); gr.addColorStop(1, `rgba(150,215,255,${0.75 * fade})`);
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 24, y - h * 0.6, x - 30 + Math.sin(inst.t * 0.4) * 4, y - h); ctx.lineTo(x + 30 + Math.sin(inst.t * 0.4 + 1) * 4, y - h); ctx.quadraticCurveTo(x + 24, y - h * 0.6, x + 12, y); ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * fade})`; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const yy = y - ((inst.t * 9 + i * 100) % h); ctx.beginPath(); ctx.moveTo(x - 10, yy); ctx.lineTo(x + 10, yy - 10); ctx.stroke(); }
        }
    };

    // 12. Steam pipe: a rattling cap and thin wisps, then a sideways blast of scalding steam
    K.steamVent = {
        themes: { neon: 3, stone: 2, ice: 1, xmas: 1, any: 0.5 },
        place(L) { const s = spotOnTop(L, 110, 70); return s ? { x: s.x, y: s.y, dir: R() < 0.5 ? -1 : 1 } : null; },
        D: { idle: () => RND(220, 480), warn: () => 70, active: () => 70, cool: () => 80 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), x = inst.x, y = inst.y - 14;
            if (ph === 'warn' && R() < 0.4) g.fx.add({ type: 'puff', x: x + inst.dir * 8, y, vx: inst.dir * 0.4, vy: -0.3, life: 30, color: '230,235,240', size: 2, grow: 0.05, alpha: 0.5 });
            if (ph === 'active') {
                for (let i = 0; i < 3; i++) g.fx.add({ type: 'puff', x: x + inst.dir * 10, y: y + RND(-3, 3), vx: inst.dir * RND(5, 9), vy: RND(-0.6, 0.3), life: 30, color: '235,240,245', size: RND(4, 7), grow: 0.4, alpha: 0.55 });
                const box = { x: inst.dir > 0 ? x : x - 190, y: y - 26, w: 190, h: 46 };
                for (const p of alive(g)) if (inBox(p, box)) { p.velocity.x += inst.dir * 1.4; hurt(g, inst, p, 4, undefined, undefined, { every: 20 }); }
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y, j = inst.phase === 'warn' ? (R() - 0.5) * 1.5 : 0;
            ctx.fillStyle = '#5a5f6a'; ctx.fillRect(x - 6, y - 22, 12, 22); ctx.fillRect(x - 6 + (inst.dir > 0 ? 6 : -12), y - 18 + j, 12, 8);
            ctx.fillStyle = '#7a808c'; ctx.fillRect(x - 8, y - 24 + j, 16, 4);
            if (inst.phase === 'warn') ctx.fillStyle = '#c9a227', ctx.fillRect(x - 2, y - 30 + j, 4, 6);
        },
        danger(inst) { const box = { x: inst.dir > 0 ? inst.x : inst.x - 200, y: inst.y - 60, w: 200, h: 62 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // 13. Tide: the water level rises over the low ground and slips back again; you float in it
    K.tide = {
        themes: { ocean: 3, candy: 1 },
        place(L) { return claim(L, { x: 0, y: L.height - 60, w: 1, h: 1 }) ? { t: R() * 900, level: L.height } : null; },
        step(inst, L, g) {
            inst.t++;
            const k = 0.5 - 0.5 * Math.cos(inst.t * TAU / 1500);
            inst.level = L.height - 30 - k * 150;
            for (const p of alive(g)) {
                const sub = (p.y + p.height - inst.level) / p.height;
                if (sub > 0.1) { const e = env(p); e.grav = Math.min(e.grav, 0.25); e.speed = Math.min(e.speed, 0.7); p.velocity.y += -0.32 * Math.min(1, sub); p.velocity.y *= 0.93; if (R() < 0.05) g.fx.swirl(p.x + 15, p.y + 20, { shape: 'bubble', color: '200,235,255', rise: 40, spin: 0, r0: 2, r1: 4, size: 2, life: 30 }); }
            }
        },
        front(ctx, inst, L) {
            const y = inst.level, t = inst.t;
            ctx.fillStyle = 'rgba(60,150,200,0.32)'; ctx.beginPath(); ctx.moveTo(-3000, L.height + 3000);
            for (let x = -3000; x <= L.width + 3000; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.05) * 4);
            ctx.lineTo(L.width + 3000, L.height + 3000); ctx.fill();
            ctx.strokeStyle = 'rgba(220,245,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -400; x <= L.width + 400; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.05) * 4); ctx.stroke();
        }
    };

    // 14. Current: a band of moving water (or a jet stream) that drags you along
    K.current = {
        themes: { ocean: 3, cloud: 2, magic: 1, any: 0.5 },
        place(L) { const b = openAir(L, 520, 90, 150, floorY(L) - 120); return b ? Object.assign(b, { dir: R() < 0.5 ? -1 : 1, streaks: Array.from({ length: 16 }, () => ({ u: R(), v: R(), len: 20 + R() * 40 })) }) : null; },
        step(inst, L, g) { for (const s of inst.streaks) { s.u += inst.dir * 0.006; if (s.u > 1) s.u -= 1; if (s.u < 0) s.u += 1; } for (const p of alive(g)) if (inBox(p, inst)) { p.velocity.x += inst.dir * 0.55; p.velocity.x = clamp(p.velocity.x, -11, 11); } },
        back(ctx, inst, L) {
            const water = L.material === 'ocean';
            ctx.fillStyle = water ? 'rgba(120,200,255,0.08)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(inst.x, inst.y, inst.w, inst.h);
            ctx.strokeStyle = water ? 'rgba(200,240,255,0.45)' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
            for (const s of inst.streaks) { const x = inst.x + s.u * inst.w, y = inst.y + s.v * inst.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - inst.dir * s.len, y); ctx.stroke(); }
        }
    };

    // 15. Bubble column: a gentle lift up through the column
    K.bubbleColumn = {
        themes: { ocean: 3, candy: 2, magic: 1, any: 0.6 },
        place(L) { const s = spotOnTop(L, 30, 340); return s ? { x: s.x, y: s.y, h: 340, bubbles: [] } : null; },
        step(inst, L, g) {
            if (R() < 0.6) inst.bubbles.push({ x: inst.x + RND(-18, 18), y: inst.y, r: RND(2, 5), ph: R() * TAU });
            for (const b of inst.bubbles) { b.y -= 2.4; b.ph += 0.2; }
            inst.bubbles = inst.bubbles.filter(b => b.y > inst.y - inst.h);
            const col = { x: inst.x - 28, y: inst.y - inst.h, w: 56, h: inst.h };
            for (const p of alive(g)) if (inBox(p, col)) { p.velocity.y = Math.max(-6.5, p.velocity.y - 0.9); p.grounded = false; }
        },
        back(ctx, inst) {
            const gr = ctx.createLinearGradient(0, inst.y - inst.h, 0, inst.y); gr.addColorStop(0, 'rgba(180,230,255,0)'); gr.addColorStop(1, 'rgba(180,230,255,0.16)');
            ctx.fillStyle = gr; ctx.fillRect(inst.x - 28, inst.y - inst.h, 56, inst.h);
            ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 1; for (const b of inst.bubbles) { ctx.beginPath(); ctx.arc(b.x + Math.sin(b.ph) * 3, b.y, b.r, 0, TAU); ctx.stroke(); }
            ctx.fillStyle = '#4a6a7a'; ctx.beginPath(); ctx.ellipse(inst.x, inst.y, 16, 4, 0, Math.PI, 0); ctx.fill();
        }
    };

    // 16. Quicksand: the longer you stand in it the deeper you sink; jump to get free
    K.quicksand = {
        themes: { dirt: 3, candy: 1, haunted: 1, any: 0.4 },
        place(L) { const s = spotOnTop(L, 75, 70, (p) => p.y >= floorY(L) - 1); return s ? { x0: s.x - 75, x1: s.x + 75, y: s.y, t: 0 } : null; },
        step(inst, L, g) {
            inst.t++;
            for (const p of alive(g)) {
                const inside = p.x + p.width > inst.x0 + 6 && p.x < inst.x1 - 6 && Math.abs(p.y + p.height - inst.y) < 4 && p.grounded;
                p.sink = inside ? Math.min(1, (p.sink || 0) + 0.006) : Math.max(0, (p.sink || 0) - 0.05);
                if (p.sink > 0) { const e = env(p); e.speed = Math.min(e.speed, 1 - p.sink * 0.8); e.jump = Math.min(e.jump, 1 - p.sink * 0.5); }
                if (p.sink >= 1 && inst.t % 30 === 0) hurt(g, inst, p, 3, undefined, undefined, { every: 30 });
                if (inside && R() < 0.1) g.fx.dust(p.x + 15, inst.y, 1, 12, '200,170,120');
            }
        },
        back(ctx, inst, L) {
            const w = inst.x1 - inst.x0, t = inst.t;
            ctx.fillStyle = '#c8a46a'; ctx.beginPath(); ctx.moveTo(inst.x0, inst.y + 1); ctx.quadraticCurveTo(inst.x0 + w / 2, inst.y + 5, inst.x1, inst.y + 1); ctx.lineTo(inst.x1, inst.y - 1); ctx.lineTo(inst.x0, inst.y - 1); ctx.fill();
            ctx.strokeStyle = 'rgba(120,90,50,0.6)'; ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) { const r = ((t * 0.3 + i * 20) % 60); ctx.beginPath(); ctx.ellipse(inst.x0 + w / 2, inst.y, r, r * 0.12, 0, 0, TAU); ctx.stroke(); }
        },
        front(ctx, inst, L, g) {
            // sand over the legs of whoever is sinking
            for (const p of alive(g)) if (p.sink > 0.05 && p.x + p.width > inst.x0 && p.x < inst.x1) { ctx.fillStyle = '#c8a46a'; ctx.beginPath(); ctx.ellipse(p.x + p.width / 2, inst.y, 20, 4 + p.sink * 34, 0, Math.PI, 0); ctx.fill(); }
        }
    };

    // 17. Gusts: leaves and streaks start to fly, then a gale shoves everyone one way
    K.windGust = {
        themes: { cloud: 4, dirt: 1, ice: 1, xmas: 1, any: 0.5 },
        place(L) { return claim(L, { x: -10, y: -10, w: 1, h: 1 }) ? { dir: R() < 0.5 ? -1 : 1 } : null; },
        D: { idle: () => RND(400, 800), warn: () => 90, active: () => 160, cool: () => 30 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            if (ph === 'idle' && inst.enter) inst.dir = R() < 0.5 ? -1 : 1;
            const k = ph === 'warn' ? prog(inst, 90) : ph === 'active' ? 1 : 0;
            if (k > 0 && R() < 0.3 + k * 0.7) g.fx.add({ type: 'puff', x: inst.dir > 0 ? RND(-40, L.width * 0.6) : RND(L.width * 0.4, L.width + 40), y: RND(0, L.height), vx: inst.dir * RND(4, 9) * (0.4 + k), vy: RND(-0.3, 0.3), life: 50, color: '255,255,255', size: 1.4, grow: 0, alpha: 0.5 * k });
            if (k > 0 && R() < 0.06 * k) g.fx.add({ type: 'chunk', x: inst.dir > 0 ? -20 : L.width + 20, y: RND(100, L.height - 100), vx: inst.dir * RND(4, 7), vy: RND(-1, 1), life: 140, color: ['#7cb342', '#d9541e', '#ffffff'][(R() * 3) | 0], size: 3, gravity: 0.02, rot: 0, vr: 0.2, drag: 1 });
            if (ph === 'active') for (const p of alive(g)) { p.velocity.x += inst.dir * (p.grounded ? 0.32 : 0.6); p.velocity.x = clamp(p.velocity.x, -12, 12); }
        },
        danger(inst) { return []; }
    };

    // 18. Fan: blades spin up with a rising whir, then a column of air holds you aloft
    K.updraftFan = {
        themes: { neon: 3, cloud: 2, stone: 1, any: 0.6 },
        place(L) { const s = spotOnTop(L, 34, 320); return s ? { x: s.x, y: s.y, rot: 0, spin: 0 } : null; },
        D: { idle: () => RND(200, 400), warn: () => 60, active: () => 220, cool: () => 60 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            const target = ph === 'active' ? 0.5 : ph === 'warn' ? 0.25 * prog(inst, 60) : 0;
            inst.spin += (target - inst.spin) * 0.05; inst.rot += inst.spin;
            if (ph === 'active') {
                if (R() < 0.5) g.fx.add({ type: 'puff', x: inst.x + RND(-24, 24), y: inst.y - 10, vx: 0, vy: -RND(4, 7), life: 40, color: '255,255,255', size: 1.4, grow: 0, alpha: 0.5 });
                const col = { x: inst.x - 34, y: inst.y - 320, w: 68, h: 320 };
                for (const p of alive(g)) if (inBox(p, col)) { const hgt = (inst.y - (p.y + p.height)) / 320; p.velocity.y -= 1.05 * (1 - hgt * 0.6); p.velocity.y = Math.max(p.velocity.y, -8); p.grounded = false; }
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y;
            ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x - 32, y - 10, 64, 10);
            ctx.save(); ctx.translate(x, y - 6); ctx.scale(1, 0.25);
            ctx.fillStyle = '#9ea7b5'; for (let k = 0; k < 4; k++) { const a = inst.rot + k * TAU / 4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 14, Math.sin(a) * 14, 14, 5, a, 0, TAU); ctx.fill(); }
            ctx.restore();
            ctx.strokeStyle = '#2a2e36'; ctx.lineWidth = 1; for (let k = -24; k <= 24; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, y - 12); ctx.lineTo(x + k, y - 8); ctx.stroke(); }
        }
    };

    // 19. Tornado: a dust swirl gathers, then a twister wanders the floor, sucking fighters in and flinging them
    K.tornado = {
        themes: { cloud: 3, dirt: 2, any: 0.4 },
        place(L) { return claim(L, { x: -20, y: -20, w: 1, h: 1 }) ? { x: L.width / 2, dir: 1 } : null; },
        D: { idle: () => RND(600, 1100), warn: () => 120, active: () => 420, cool: () => 40 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), fy = floorY(L);
            if (ph === 'warn' && inst.enter) { inst.x = RND(200, L.width - 200); inst.dir = R() < 0.5 ? -1 : 1; }
            if (ph === 'warn') { const k = prog(inst, 120); if (R() < 0.6) g.fx.swirl(inst.x, fy - 4, { shape: 'dot', color: '200,180,140', rise: 30 + k * 120, spin: 6, r0: 50 - k * 20, r1: 10, size: 2, life: 30 }); }
            if (ph === 'active') {
                inst.x += inst.dir * 1.6; if (inst.x < 120 || inst.x > L.width - 120) inst.dir *= -1;
                if (R() < 0.8) g.fx.swirl(inst.x, fy - RND(0, 260), { shape: 'dot', color: '210,200,180', rise: 40, spin: 9, r0: 40, r1: 30, size: 2, life: 26 });
                for (const p of alive(g)) {
                    const dx = inst.x - (p.x + p.width / 2), dy = (fy - 150) - (p.y + p.height / 2), d = Math.hypot(dx, dy);
                    if (d < 220) { const k = 1 - d / 220; p.velocity.x += Math.sign(dx) * 0.5 * k; p.velocity.y -= 0.65 * k; p.grounded = false; }
                    if (Math.abs(dx) < 34 && p.y + p.height > fy - 300) { if (hurt(g, inst, p, 6, (R() < 0.5 ? -1 : 1) * 11, -13, { every: 60 })) g.fx.dust(p.x, p.y, 6, 30, '200,180,140'); }
                }
            }
        },
        front(ctx, inst, L) {
            if (inst.phase !== 'active') return;
            const fy = floorY(L), t = inst.t, fade = Math.min(1, inst.left / 30, (420 - inst.left) / 30);
            for (let i = 0; i < 18; i++) {
                const u = i / 18, y = fy - u * 300, r = 10 + u * 70;
                ctx.strokeStyle = `rgba(200,190,170,${0.35 * fade})`; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.ellipse(inst.x + Math.sin(t * 0.08 + u * 5) * 14 * u, y, r, r * 0.22, 0, t * 0.3 + u * 4, t * 0.3 + u * 4 + 4.4); ctx.stroke();
            }
        },
        danger(inst, L) { return inst.phase === 'active' ? [{ x: inst.x - 90, y: floorY(L) - 320, w: 180, h: 322, soon: 0 }] : []; }
    };

    // =====================================================================================
    //  FIRE, ELECTRICITY, LIGHT, SKY
    // =====================================================================================

    // 20. Flame jet: a nozzle on a ledge coughs smoke and embers, then breathes fire across it
    K.flameJet = {
        themes: { lava: 3, stone: 3, haunted: 1, neon: 1, any: 0.5 },
        place(L) {
            const S = solids(L).filter(p => p.width >= 150 && !p.featureTag);
            for (const p of S.sort(() => R() - 0.5)) {
                const dir = R() < 0.5 ? 1 : -1, x = dir > 0 ? p.x + 8 : p.x + p.width - 8, y = p.y;
                const box = { x: dir > 0 ? x : x - 220, y: y - 60, w: 220, h: 58 };
                if (L.platforms.some(q => q !== p && q.active && overlap(box, { x: q.x, y: q.y, w: q.width, h: q.height }))) continue;
                if (!claim(L, box)) continue;
                return { x, y, dir };
            }
            return null;
        },
        D: { idle: () => RND(220, 420), warn: () => 80, active: () => 80, cool: () => 60 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), x = inst.x + inst.dir * 10, y = inst.y - 22;
            if (ph === 'warn') { const k = prog(inst, 80); if (R() < 0.4 + k * 0.4) puff(g, x, y, { color: '60,55,55', vx: inst.dir * RND(0.5, 1.5), vy: -RND(0.3, 0.8), size: 3, alpha: 0.4 }); if (R() < k * 0.5) g.fx.embers(x, y, 1, 6); }
            if (ph === 'active') {
                for (let i = 0; i < 2; i++) g.fx.flame(x + inst.dir * RND(10, 200), y + RND(-8, 8), RND(10, 18), RND(2, 10), 22);
                const box = { x: inst.dir > 0 ? x : x - 210, y: y - 24, w: 210, h: 44 };
                for (const p of alive(g)) if (inBox(p, box)) hurt(g, inst, p, 5, inst.dir * 5, -4, { every: 16, status: { burn: 70 } });
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y;
            ctx.fillStyle = '#3a3030'; ctx.fillRect(x - 6, y - 30, 12, 30);
            ctx.fillStyle = '#5a4a40'; ctx.fillRect(x + (inst.dir > 0 ? 2 : -14), y - 27, 12, 10);
            const k = inst.phase === 'warn' ? prog(inst, 80) : inst.phase === 'active' ? 1 : 0;
            glow(ctx, x + inst.dir * 10, y - 22, 14 + k * 20, '255,120,40', 0.2 + k * 0.6);
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const x = inst.x + inst.dir * 10, y = inst.y - 22, fade = Math.min(1, inst.left / 12, (80 - inst.left) / 6);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createLinearGradient(x, 0, x + inst.dir * 210, 0); gr.addColorStop(0, `rgba(255,240,170,${fade})`); gr.addColorStop(0.4, `rgba(255,140,40,${0.8 * fade})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + inst.dir * 110, y - 22 + Math.sin(inst.t * 0.7) * 4, x + inst.dir * 210, y - 8); ctx.lineTo(x + inst.dir * 210, y + 10); ctx.quadraticCurveTo(x + inst.dir * 110, y + 20, x, y + 4); ctx.fill();
            ctx.restore();
        },
        danger(inst) { const box = { x: inst.dir > 0 ? inst.x : inst.x - 230, y: inst.y - 62, w: 230, h: 64 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // 21. Tesla coils: sparks crawl up the coils and the air crackles, then an arc jumps between them
    K.teslaCoils = {
        themes: { neon: 4, magic: 1, stone: 1, any: 0.4 },
        place(L) {
            const s = spotOnTop(L, 130, 110);
            return s ? { a: s.x - 120, b: s.x + 120, y: s.y } : null;
        },
        D: { idle: () => RND(200, 400), warn: () => 90, active: () => 46, cool: () => 50 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), top = inst.y - 70;
            if (ph === 'warn') { const k = prog(inst, 90); for (const x of [inst.a, inst.b]) if (R() < 0.2 + k * 0.6) g.fx.sparks(x + RND(-4, 4), inst.y - RND(10, 70) * k - 4, '150,220,255', 1, -Math.PI / 2, 3, 2); }
            if (ph === 'active') {
                if (inst.enter) g.fx.flashAt((inst.a + inst.b) / 2, top, '170,230,255', 120, 8);
                const box = { x: inst.a, y: top - 18, w: inst.b - inst.a, h: 36 };
                for (const p of alive(g)) if (inBox(p, box)) hurt(g, inst, p, 10, (p.x + 15 < (inst.a + inst.b) / 2 ? -1 : 1) * 6, -6, { every: 30, status: { stun: 36 } });
            }
        },
        back(ctx, inst) {
            for (const x of [inst.a, inst.b]) {
                ctx.fillStyle = '#2a2f3a'; ctx.fillRect(x - 9, inst.y - 10, 18, 10);
                ctx.fillStyle = '#b87333'; for (let k = 0; k < 7; k++) ctx.fillRect(x - 6, inst.y - 14 - k * 7, 12, 4);
                ctx.fillStyle = '#9ea7b5'; ctx.beginPath(); ctx.arc(x, inst.y - 70, 8, 0, TAU); ctx.fill();
                const k = inst.phase === 'warn' ? prog(inst, 90) : inst.phase === 'active' ? 1 : 0.05;
                glow(ctx, x, inst.y - 70, 16 + k * 26, '150,220,255', 0.25 + k * 0.6);
            }
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const top = inst.y - 70;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let b = 0; b < 3; b++) {
                ctx.strokeStyle = b ? 'rgba(150,220,255,0.6)' : 'rgba(255,255,255,0.95)'; ctx.lineWidth = b ? 4 : 2;
                ctx.beginPath(); ctx.moveTo(inst.a, top);
                for (let i = 1; i < 12; i++) ctx.lineTo(inst.a + (inst.b - inst.a) * i / 12, top + RND(-14, 14));
                ctx.lineTo(inst.b, top); ctx.stroke();
            }
            ctx.restore();
        },
        danger(inst) { const box = { x: inst.a, y: inst.y - 100, w: inst.b - inst.a, h: 60 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // 22. Sweeping laser: a faint aiming line traces the path first, then the full beam sweeps along it
    K.laserSweep = {
        themes: { neon: 4, magic: 1, any: 0.3 },
        place(L) { const x = RND(300, L.width - 300); return claim(L, { x: x - 20, y: 0, w: 40, h: 40 }) ? { x, y: 18, a0: Math.PI * 0.25, a1: Math.PI * 0.75 } : null; },
        D: { idle: () => RND(300, 560), warn: () => 70, active: () => 120, cool: () => 30 },
        ray(inst, L, a) {
            const dx = Math.cos(a), dy = Math.sin(a);
            let best = 1600;
            for (const q of L.platforms) {
                if (!q.active || q.type === 'trampoline') continue;
                for (let d = 20; d < best; d += 8) { const x = inst.x + dx * d, y = inst.y + dy * d; if (x > q.x && x < q.x + q.width && y > q.y && y < q.y + q.height) { best = d; break; } }
            }
            return best;
        },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            const u = ph === 'active' ? prog(inst, 120) : ph === 'warn' ? 0 : 0;
            inst.a = ph === 'active' ? inst.a0 + (inst.a1 - inst.a0) * u : inst.a0;
            if (ph === 'warn' && inst.enter) { if (R() < 0.5) { const t = inst.a0; inst.a0 = inst.a1; inst.a1 = t; } }
            if (ph !== 'idle' && ph !== 'cool') inst.len = this.ray(inst, L, inst.a);
            if (ph === 'active') {
                const dx = Math.cos(inst.a), dy = Math.sin(inst.a);
                for (const p of alive(g)) {
                    const cx = p.x + p.width / 2 - inst.x, cy = p.y + p.height / 2 - inst.y, along = cx * dx + cy * dy, perp = Math.abs(cx * dy - cy * dx);
                    if (along > 0 && along < inst.len && perp < 22) hurt(g, inst, p, 6, dx * 4, -5, { every: 12, status: { burn: 30 } });
                }
                if (R() < 0.5) g.fx.sparks(inst.x + Math.cos(inst.a) * inst.len, inst.y + Math.sin(inst.a) * inst.len, '255,80,120', 2, -Math.PI / 2, 2, 3);
            }
        },
        back(ctx, inst) { ctx.fillStyle = '#20222c'; ctx.fillRect(inst.x - 16, 0, 32, 20); ctx.fillStyle = '#ff4081'; ctx.beginPath(); ctx.arc(inst.x, 20, 6, 0, TAU); ctx.fill(); glow(ctx, inst.x, 20, 18, '255,60,120', 0.5); },
        front(ctx, inst) {
            if (inst.phase === 'warn' || inst.phase === 'active') {
                const strong = inst.phase === 'active', len = inst.len || 800;
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
                if (!strong) { // the aiming line traces the whole sweep, faint
                    const k = prog(inst, 70);
                    for (let a = inst.a0, i = 0; i < 6; i++, a = inst.a0 + (inst.a1 - inst.a0) * i / 5) { ctx.strokeStyle = `rgba(255,80,120,${0.08 + k * 0.12})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(inst.x, inst.y); ctx.lineTo(inst.x + Math.cos(a) * 1200, inst.y + Math.sin(a) * 1200); ctx.stroke(); }
                } else {
                    const ex = inst.x + Math.cos(inst.a) * len, ey = inst.y + Math.sin(inst.a) * len;
                    ctx.strokeStyle = 'rgba(255,60,110,0.45)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(inst.x, inst.y); ctx.lineTo(ex, ey); ctx.stroke();
                    ctx.strokeStyle = 'rgba(255,230,240,0.95)'; ctx.lineWidth = 4; ctx.stroke();
                    glow(ctx, ex, ey, 30, '255,80,120', 0.7);
                }
                ctx.restore();
            }
        },
        danger(inst) {
            if (inst.phase !== 'warn' && inst.phase !== 'active') return [];
            const out = [];
            for (let i = 0; i <= 4; i++) { const a = inst.a0 + (inst.a1 - inst.a0) * i / 4, len = inst.len || 800; for (let d = 100; d < len; d += 140) out.push({ x: inst.x + Math.cos(a) * d - 30, y: inst.y + Math.sin(a) * d - 30, w: 60, h: 60, soon: inst.phase === 'warn' ? inst.left : 0 }); }
            return out;
        }
    };

    // 23. Lightning: a dark cloud gathers over a spot and static crawls up from the ground, then a bolt
    K.lightningStrike = {
        themes: { cloud: 4, neon: 1, haunted: 2, magic: 1, any: 0.4 },
        place(L) { return claim(L, { x: -30, y: -30, w: 1, h: 1 }) ? { x: 0, ground: 0 } : null; },
        D: { idle: () => RND(260, 520), warn: () => 100, active: () => 18, cool: () => 20 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            if (ph === 'warn' && inst.enter) {
                const ps = alive(g); const tgt = ps.length && R() < 0.6 ? ps[(R() * ps.length) | 0] : null;
                inst.x = clamp(tgt ? tgt.x + 15 + RND(-80, 80) : RND(100, L.width - 100), 60, L.width - 60);
                let gy = L.height;
                for (const q of L.platforms) if (q.active && inst.x > q.x && inst.x < q.x + q.width && q.y < gy && q.y > 60) gy = q.y;
                inst.ground = gy;
            }
            if (ph === 'warn') { const k = prog(inst, 100); if (R() < 0.15 + k * 0.6) g.fx.sparks(inst.x + RND(-30, 30), inst.ground - 2, '200,220,255', 1, -Math.PI / 2, 0.6, 2 + k * 3); }
            if (ph === 'active' && inst.enter) {
                g.fx.flashAt(inst.x, inst.ground, '220,230,255', 160, 10); g.fx.screenFlash && !g.demo && g.fx.screenFlash('220,230,255', 0.25);
                tremor(g, inst.x, inst.ground, 0.22); AudioSys.playExplosion && AudioSys.playExplosion();
                g.fx.scorch && g.fx.scorch(inst.x, inst.ground, 30);
                inst.pts = []; let x = inst.x, y = 0; while (y < inst.ground) { inst.pts.push([x, y]); x += RND(-26, 26); y += RND(20, 40); } inst.pts.push([inst.x, inst.ground]);
                for (const p of alive(g)) if (Math.abs(p.x + p.width / 2 - inst.x) < 46 && p.y < inst.ground + 2) hurt(g, inst, p, 18, (p.x + 15 < inst.x ? -1 : 1) * 8, -8, { every: 40, status: { stun: 40 } });
            }
        },
        front(ctx, inst, L) {
            if (inst.phase === 'warn') {
                const k = prog(inst, 100);
                ctx.fillStyle = `rgba(30,32,48,${0.25 + k * 0.5})`;
                for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(inst.x + (i - 2.5) * 22, 30 + Math.sin(i * 2 + inst.t * 0.05) * 6, 30 + k * 20, 16 + k * 8, 0, 0, TAU); ctx.fill(); }
                ctx.strokeStyle = `rgba(200,220,255,${k * 0.4})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(inst.x, inst.ground, 30 + Math.sin(inst.t) * 4, 5, 0, 0, TAU); ctx.stroke();
            }
            if (inst.phase === 'active' && inst.pts) {
                const a = inst.left / 18;
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (const [w, c] of [[10, `rgba(150,180,255,${0.5 * a})`], [3, `rgba(255,255,255,${a})`]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); inst.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
                ctx.restore();
            }
        },
        danger(inst) { return inst.phase === 'warn' || inst.phase === 'active' ? [{ x: inst.x - 60, y: inst.ground - 300, w: 120, h: 302, soon: inst.phase === 'warn' ? inst.left : 0 }] : []; }
    };

    // 24. Meteors: a glowing streak far up in the sky and a shadow growing on the ground, then impact
    K.meteorShower = {
        themes: { lava: 3, magic: 3, cloud: 1, any: 0.4 },
        place(L) { return claim(L, { x: -40, y: -40, w: 1, h: 1 }) ? { rocks: [], wait: RND(200, 500) } : null; },
        step(inst, L, g) {
            if ((inst.wait -= 1) <= 0) {
                inst.wait = RND(400, 800);
                const n = 2 + ((R() * 3) | 0);
                for (let i = 0; i < n; i++) {
                    const x = RND(80, L.width - 80);
                    let gy = L.height;
                    for (const q of L.platforms) if (q.active && x > q.x && x < q.x + q.width && q.y < gy && q.y > 40) gy = q.y;
                    inst.rocks.push({ x, gy, t: -i * 30, T: 110 });
                }
            }
            for (const r of inst.rocks) {
                r.t++;
                if (r.t > 0 && r.t < r.T && R() < 0.3) g.fx.add({ type: 'puff', x: r.x + RND(-20, 20), y: r.gy - 2, vx: 0, vy: -0.2, life: 20, color: '255,170,80', size: 1, grow: 0, alpha: 0.4 });
                if (r.t === r.T) {
                    g.fx.explosion ? g.fx.explosion(r.x, r.gy - 10, 70) : g.fx.flashAt(r.x, r.gy, '255,160,60', 90, 10);
                    g.fx.debris(r.x, r.gy, '#5a3a2a', 10, 7); tremor(g, r.x, r.gy, 0.25); AudioSys.playExplosion && AudioSys.playExplosion();
                    g.fx.scorch && g.fx.scorch(r.x, r.gy, 40);
                    for (const p of alive(g)) { const d = Math.hypot(p.x + 15 - r.x, p.y + 30 - r.gy); if (d < 80) hurt(g, r, p, 15, Math.sign(p.x + 15 - r.x || 1) * 10, -9, { every: 60, status: { burn: 60 } }); }
                }
            }
            inst.rocks = inst.rocks.filter(r => r.t < r.T + 2);
        },
        front(ctx, inst) {
            for (const r of inst.rocks) {
                if (r.t < 0) continue;
                const k = r.t / r.T, sx = r.x - 600 * (1 - k), sy = r.gy - 1100 * (1 - k);
                ctx.fillStyle = `rgba(20,10,10,${0.15 + k * 0.4})`; ctx.beginPath(); ctx.ellipse(r.x, r.gy, 12 + k * 40, 3 + k * 6, 0, 0, TAU); ctx.fill();
                if (k > 0.05) {
                    ctx.save(); ctx.globalCompositeOperation = 'lighter';
                    const gr = ctx.createLinearGradient(sx - 120, sy - 220, sx, sy); gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, 'rgba(255,220,140,0.9)');
                    ctx.strokeStyle = gr; ctx.lineWidth = 4 + k * 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - 120, sy - 220); ctx.lineTo(sx, sy); ctx.stroke();
                    ctx.restore();
                    glow(ctx, sx, sy, 20 + k * 30, '255,170,60', 0.8);
                }
            }
        },
        danger(inst) { return inst.rocks.filter(r => r.t >= 0).map(r => ({ x: r.x - 90, y: r.gy - 160, w: 180, h: 162, soon: r.T - r.t })); }
    };

    // =====================================================================================
    //  MACHINES AND TRAPS
    // =====================================================================================

    // 25. Pendulum blade: a great axe swings back and forth over a ledge, always moving
    K.pendulumBlade = {
        themes: { stone: 4, haunted: 3, lava: 1, any: 0.5 },
        place(L) {
            const s = spotOnTop(L, 110, 230);
            if (!s) return null;
            return { px: s.x, py: s.y - 230, len: 190, a: R() * 2 - 1, t: R() * 200 };
        },
        step(inst, L, g) {
            inst.t++;
            inst.a = Math.sin(inst.t * TAU / 170) * 0.95;
            const w = Math.cos(inst.t * TAU / 170) * 0.95 * TAU / 170;
            const bx = inst.px + Math.sin(inst.a) * inst.len, by = inst.py + Math.cos(inst.a) * inst.len;
            inst.bx = bx; inst.by = by;
            for (const p of alive(g)) if (Math.hypot(p.x + 15 - bx, p.y + 30 - by) < 40) hurt(g, inst, p, 16, Math.sign(w || 1) * 12, -7, { every: 40 });
            if (Math.abs(inst.a) < 0.05 && g.frameCount % 2 === 0) g.fx.streak(bx - 20, by, bx + 20, by, 2, '255,255,255', 8);
        },
        back(ctx, inst) {
            ctx.fillStyle = '#3a3a40'; ctx.fillRect(inst.px - 14, inst.py - 10, 28, 12);
            ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(inst.px, inst.py); ctx.lineTo(inst.bx || inst.px, inst.by || inst.py + inst.len); ctx.stroke();
        },
        front(ctx, inst) {
            const bx = inst.bx, by = inst.by; if (bx === undefined) return;
            ctx.save(); ctx.translate(bx, by); ctx.rotate(-inst.a);
            const gr = ctx.createLinearGradient(-38, 0, 38, 0); gr.addColorStop(0, '#cfd8dc'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#90a4ae');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-36, -4); ctx.quadraticCurveTo(0, 34, 36, -4); ctx.lineTo(10, -8); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#4e342e'; ctx.fillRect(-6, -14, 12, 10);
            ctx.restore();
        },
        danger(inst) { return [{ x: inst.px - inst.len - 30, y: inst.py + inst.len * 0.6, w: inst.len * 2 + 60, h: inst.len * 0.5, soon: 0, kind: 'zone' }]; }
    };

    // 26. Boulder: pebbles trickle and the ground rumbles, then a boulder rolls across the floor
    K.rollingBoulder = {
        themes: { stone: 3, dirt: 2, lava: 1, any: 0.4 },
        place(L) {
            const F = solids(L).filter(p => p.width >= 500);
            if (!F.length) return null;
            const p = F[(R() * F.length) | 0];
            if (!claim(L, { x: p.x, y: p.y - 70, w: p.width, h: 2 })) return null;
            return { plat: p, x: 0, rot: 0, dir: 1 };
        },
        D: { idle: () => RND(500, 900), warn: () => 100, active: () => 9999, cool: () => 30 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), p = inst.plat, r = 34;
            if (ph === 'warn') {
                if (inst.enter) inst.dir = R() < 0.5 ? 1 : -1;
                const ex = inst.dir > 0 ? p.x + 10 : p.x + p.width - 10;
                if (R() < 0.3) g.fx.add({ type: 'chunk', x: ex + RND(-10, 10), y: p.y - RND(40, 120), vx: inst.dir * RND(0.3, 1), vy: 0, life: 50, color: '#6d5a48', size: 2.5, gravity: 0.35, rot: 0, vr: 0.3, drag: 0.99 });
                if (inst.t % 12 === 0) { tremor(g, ex, p.y, 0.04); g.fx.dust(ex, p.y, 2, 20, DUST_TINT[L.material]); }
                inst.x = inst.dir > 0 ? p.x - r : p.x + p.width + r;
            }
            if (ph === 'active') {
                inst.x += inst.dir * 5.5; inst.rot += inst.dir * 5.5 / r;
                if (g.frameCount % 4 === 0) g.fx.dust(inst.x - inst.dir * r, p.y, 2, 10, DUST_TINT[L.material]);
                if (g.frameCount % 20 === 0) tremor(g, inst.x, p.y, 0.03);
                for (const q of alive(g)) if (Math.abs(q.x + 15 - inst.x) < r + 12 && q.y + q.height > p.y - r * 2 && q.y < p.y) hurt(g, inst, q, 14, inst.dir * 13, -8, { every: 40 });
                if ((inst.dir > 0 && inst.x > p.x + p.width + r) || (inst.dir < 0 && inst.x < p.x - r)) { inst.phase = 'cool'; inst.left = 30; }
            }
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const p = inst.plat, r = 34;
            ctx.save(); ctx.translate(inst.x, p.y - r); ctx.rotate(inst.rot);
            const gr = ctx.createRadialGradient(-10, -10, 4, 0, 0, r); gr.addColorStop(0, '#9e8a74'); gr.addColorStop(1, '#4e3e30');
            ctx.fillStyle = gr; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * TAU / 10, rr = r * (0.9 + ((i * 7) % 3) * 0.05); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(r * 0.3, r * 0.1); ctx.moveTo(-r * 0.1, r * 0.4); ctx.lineTo(r * 0.2, r * 0.6); ctx.stroke();
            ctx.restore();
        },
        danger(inst) { const p = inst.plat; return inst.phase === 'warn' || inst.phase === 'active' ? [{ x: p.x, y: p.y - 80, w: p.width, h: 80, soon: inst.phase === 'warn' ? inst.left : 0, kind: 'lane' }] : []; }
    };

    // 27. Chandelier: it sways harder, dust and sparks fall from its chain, then it drops
    K.chandelier = {
        themes: { haunted: 4, stone: 2, xmas: 2, any: 0.3 },
        place(L) {
            const s = spotOnTop(L, 60, 360);
            return s ? { x: s.x, top: Math.max(0, s.y - 520), hangY: s.y - 300, y: s.y - 300, gy: s.y, vy: 0, state: 'hang', t: RND(200, 500), sw: 0 } : null;
        },
        step(inst, L, g) {
            inst.t--; inst.sw += 0.04;
            if (inst.state === 'hang' && inst.t <= 0) { inst.state = 'creak'; inst.t = 90; }
            else if (inst.state === 'creak') { if (R() < 0.3) g.fx.add({ type: 'puff', x: inst.x + RND(-4, 4), y: inst.hangY - RND(10, 100), vx: 0, vy: 0.5, life: 40, color: '200,190,180', size: 1.5, grow: 0, alpha: 0.6 }); if (R() < 0.1) g.fx.sparks(inst.x, inst.hangY - 40, '255,220,140', 1, Math.PI / 2, 1, 2); if (inst.t <= 0) { inst.state = 'fall'; inst.vy = 0; } }
            else if (inst.state === 'fall') {
                inst.vy += 0.6; inst.y += inst.vy;
                const box = { x: inst.x - 46, y: inst.y - 10, w: 92, h: 40 };
                for (const p of alive(g)) if (inBox(p, box)) hurt(g, inst, p, 22, Math.sign(p.x + 15 - inst.x || 1) * 6, -5, { every: 60 });
                if (inst.y >= inst.gy - 20) { g.fx.shards(inst.x - 40, inst.gy - 20, 80, 20, 'rgba(255,240,200,0.95)', 26); g.fx.flashAt(inst.x, inst.gy - 20, '255,210,120', 70, 8); tremor(g, inst.x, inst.gy, 0.15); AudioSys.playHit && AudioSys.playHit(); inst.state = 'gone'; inst.t = 300; }
            } else if (inst.state === 'gone' && inst.t <= 0) { inst.state = 'rise'; inst.y = inst.top - 60; }
            else if (inst.state === 'rise') { inst.y += (inst.hangY - inst.y) * 0.03; if (Math.abs(inst.y - inst.hangY) < 1) { inst.y = inst.hangY; inst.state = 'hang'; inst.t = RND(300, 600); } }
        },
        front(ctx, inst, L) {
            if (inst.state === 'gone') return;
            const sway = inst.state === 'creak' ? Math.sin(inst.sw * 6) * 8 : Math.sin(inst.sw) * 2, x = inst.x + sway, y = inst.y;
            if (inst.state !== 'fall') { ctx.strokeStyle = '#5a5050'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(inst.x, inst.top); ctx.lineTo(x, y - 20); ctx.stroke(); }
            ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 44, 10, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 40, y); ctx.moveTo(x, y - 20); ctx.lineTo(x + 40, y); ctx.stroke();
            for (let i = -2; i <= 2; i++) { const cx = x + i * 20; ctx.fillStyle = '#f5f0e0'; ctx.fillRect(cx - 2, y - 12, 4, 10); glow(ctx, cx, y - 15, 14, '255,200,110', 0.7); ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.ellipse(cx, y - 15, 2, 3.5, 0, 0, TAU); ctx.fill(); }
            for (let i = -3; i <= 3; i++) { ctx.fillStyle = 'rgba(220,240,255,0.8)'; ctx.beginPath(); ctx.moveTo(x + i * 13, y + 6); ctx.lineTo(x + i * 13 - 2, y + 14); ctx.lineTo(x + i * 13 + 2, y + 14); ctx.fill(); }
        },
        danger(inst) { return inst.state === 'creak' || inst.state === 'fall' ? [{ x: inst.x - 70, y: inst.y, w: 140, h: inst.gy - inst.y + 4, soon: inst.state === 'creak' ? inst.t : 0 }] : []; }
    };

    // 28. Spike trap: a rattle and dust puffing out of the holes, then the spikes shoot up
    K.spikeTrap = {
        themes: { stone: 3, haunted: 2, lava: 2, ice: 1, any: 0.6 },
        place(L) { const s = spotOnTop(L, 60, 80); return s ? { x0: s.x - 60, x1: s.x + 60, y: s.y } : null; },
        D: { idle: () => RND(180, 420), warn: () => 55, active: () => 60, cool: () => 20 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            if (ph === 'warn' && R() < 0.5) g.fx.dust(RND(inst.x0, inst.x1), inst.y - 1, 1, 6, DUST_TINT[L.material]);
            if (ph === 'active') { if (inst.enter) g.fx.sparks((inst.x0 + inst.x1) / 2, inst.y, '255,255,255', 6, -Math.PI / 2, 1.4, 4); for (const p of alive(g)) if (p.x + p.width > inst.x0 && p.x < inst.x1 && p.y + p.height > inst.y - 30 && p.y + p.height <= inst.y + 2) hurt(g, inst, p, 12, p.velocity.x * 0.5, -10, { every: 30 }); }
        },
        back(ctx, inst) {
            const ph = inst.phase, ext = ph === 'active' ? Math.min(1, (60 - inst.left) / 4) : ph === 'warn' ? (R() < 0.3 ? 0.08 : 0) : 0;
            ctx.fillStyle = '#2a2a30'; for (let x = inst.x0 + 6; x < inst.x1; x += 12) ctx.fillRect(x - 3, inst.y - 1, 6, 2);
            if (ext > 0) { ctx.fillStyle = '#cfd8dc'; for (let x = inst.x0 + 6; x < inst.x1; x += 12) { ctx.beginPath(); ctx.moveTo(x - 4, inst.y); ctx.lineTo(x, inst.y - 28 * ext); ctx.lineTo(x + 4, inst.y); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let x = inst.x0 + 6; x < inst.x1; x += 12) ctx.fillRect(x - 1, inst.y - 20 * ext, 1, 10 * ext); }
        },
        danger(inst) { const box = { x: inst.x0 - 10, y: inst.y - 62, w: inst.x1 - inst.x0 + 20, h: 64 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // 29. Crusher: dust sifts down and it groans, then the piston slams onto the ledge
    K.crusher = {
        themes: { neon: 3, stone: 3, any: 0.4 },
        place(L) { const s = spotOnTop(L, 45, 220); return s ? { x: s.x, top: s.y - 220, y: s.y - 220, gy: s.y, t: 0 } : null; },
        D: { idle: () => RND(200, 380), warn: () => 60, active: () => 50, cool: () => 90 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            if (ph === 'warn') { if (R() < 0.4) g.fx.add({ type: 'puff', x: inst.x + RND(-40, 40), y: inst.y + 40, vx: 0, vy: 0.8, life: 40, color: '160,150,140', size: 1.5, grow: 0, alpha: 0.6 }); inst.y = inst.top + Math.sin(inst.t * 1.3) * 1.2; }
            else if (ph === 'active') {
                const target = inst.gy - 60;
                if (inst.y < target) { inst.y = Math.min(target, inst.y + 22); if (inst.y >= target) { tremor(g, inst.x, inst.gy, 0.3); g.fx.dust(inst.x, inst.gy, 14, 60, DUST_TINT[L.material]); g.fx.debris(inst.x, inst.gy, '#555', 6, 5); AudioSys.playHit && AudioSys.playHit(); } }
                const box = { x: inst.x - 44, y: inst.y, w: 88, h: 60 };
                for (const p of alive(g)) if (inBox(p, box)) hurt(g, inst, p, 25, (p.x + 15 < inst.x ? -1 : 1) * 14, -4, { every: 50 });
            } else if (ph === 'cool' || ph === 'idle') inst.y += (inst.top - inst.y) * 0.04;
        },
        front(ctx, inst) {
            ctx.fillStyle = '#4a4e58'; ctx.fillRect(inst.x - 10, inst.top - 40, 20, inst.y - inst.top + 40);
            const gr = ctx.createLinearGradient(0, inst.y, 0, inst.y + 60); gr.addColorStop(0, '#7a808c'); gr.addColorStop(1, '#3a3e48');
            ctx.fillStyle = gr; ctx.fillRect(inst.x - 44, inst.y, 88, 60);
            ctx.fillStyle = '#ffca28'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.beginPath(); ctx.rect(inst.x - 44, inst.y + 50, 88, 10); ctx.clip(); ctx.beginPath(); ctx.moveTo(inst.x - 44 + i * 22, inst.y + 60); ctx.lineTo(inst.x - 34 + i * 22, inst.y + 50); ctx.lineTo(inst.x - 24 + i * 22, inst.y + 50); ctx.lineTo(inst.x - 34 + i * 22, inst.y + 60); ctx.fill(); ctx.restore(); }
        },
        danger(inst) { const box = { x: inst.x - 60, y: inst.top, w: 120, h: inst.gy - inst.top + 2 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // =====================================================================================
    //  MAGIC AND HELPERS
    // =====================================================================================

    // 30. Portals: step into one, come out of the other with your momentum
    K.portals = {
        themes: { magic: 4, neon: 2, any: 0.8 },
        place(L) {
            const a = spotOnTop(L, 26, 90), b = a && spotOnTop(L, 26, 90, (p) => Math.abs(p.x + p.width / 2 - a.x) > 500 || Math.abs(p.y - a.y) > 250);
            return a && b ? { a: { x: a.x, y: a.y - 40 }, b: { x: b.x, y: b.y - 40 }, t: 0 } : null;
        },
        step(inst, L, g) {
            inst.t++;
            for (const p of alive(g)) {
                if ((p.portalCd || 0) > g.frameCount) continue;
                for (const [from, to] of [[inst.a, inst.b], [inst.b, inst.a]]) {
                    if (Math.abs(p.x + p.width / 2 - from.x) < 18 && Math.abs(p.y + p.height / 2 - from.y) < 34) {
                        g.fx.swirl(from.x, from.y, { shape: 'star', color: '190,140,255', rise: 0, spin: 6, r0: 30, r1: 2, size: 3, life: 24 });
                        p.x = to.x - p.width / 2; p.y = to.y - p.height / 2 + 6; p.prevX = p.x; p.prevY = p.y; p.trail = [];
                        p.portalCd = g.frameCount + 45;
                        g.fx.ring(to.x, to.y, '190,140,255', 40, 3, 16);
                        break;
                    }
                }
            }
        },
        back(ctx, inst) {
            for (const [o, rgb] of [[inst.a, '170,110,255'], [inst.b, '90,220,255']]) {
                glow(ctx, o.x, o.y, 60, rgb, 0.35);
                ctx.save(); ctx.translate(o.x, o.y);
                for (let k = 0; k < 4; k++) { ctx.strokeStyle = `rgba(${rgb},${0.9 - k * 0.2})`; ctx.lineWidth = 3 - k * 0.5; ctx.beginPath(); ctx.ellipse(0, 0, 16 - k * 3, 36 - k * 6, 0, inst.t * 0.08 * (k % 2 ? 1 : -1), inst.t * 0.08 * (k % 2 ? 1 : -1) + 5); ctx.stroke(); }
                ctx.fillStyle = 'rgba(10,0,30,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 24, 0, 0, TAU); ctx.fill();
                ctx.restore();
            }
        }
    };

    // 31. Low gravity bubble: jumps float inside it
    K.lowGravity = {
        themes: { magic: 4, cloud: 2, neon: 1, any: 0.5 },
        place(L) { const b = openAir(L, 300, 260, 80, floorY(L) - 60); return b ? { cx: b.x + 150, cy: b.y + 130, rx: 150, ry: 130, t: 0, motes: Array.from({ length: 18 }, () => ({ a: R() * TAU, r: R() })) } : null; },
        step(inst, L, g) {
            inst.t++;
            for (const m of inst.motes) m.a += 0.004 + m.r * 0.004;
            for (const p of alive(g)) { const dx = (p.x + p.width / 2 - inst.cx) / inst.rx, dy = (p.y + p.height / 2 - inst.cy) / inst.ry; if (dx * dx + dy * dy < 1) { const e = env(p); e.grav = Math.min(e.grav, 0.3); if (p.velocity.y > 3) p.velocity.y *= 0.95; } }
        },
        back(ctx, inst) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createRadialGradient(inst.cx, inst.cy, 10, inst.cx, inst.cy, inst.rx);
            gr.addColorStop(0, 'rgba(150,120,255,0.02)'); gr.addColorStop(0.85, 'rgba(150,120,255,0.08)'); gr.addColorStop(1, 'rgba(190,160,255,0.22)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(inst.cx, inst.cy, inst.rx, inst.ry, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = `rgba(200,180,255,${0.25 + 0.1 * Math.sin(inst.t * 0.05)})`; ctx.lineWidth = 1.5; ctx.stroke();
            for (const m of inst.motes) glow(ctx, inst.cx + Math.cos(m.a) * inst.rx * m.r, inst.cy + Math.sin(m.a * 1.3) * inst.ry * m.r, 4, '220,200,255', 0.6);
            ctx.restore();
        }
    };

    // 32. Ghost hands: mist swirls and the ground glows green through cracks, then hands rise and hold you
    K.ghostHands = {
        themes: { haunted: 4, magic: 1 },
        place(L) { const s = spotOnTop(L, 70, 90); return s ? { x0: s.x - 70, x1: s.x + 70, y: s.y } : null; },
        D: { idle: () => RND(260, 480), warn: () => 80, active: () => 70, cool: () => 40 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            if (ph === 'warn' && R() < 0.5) g.fx.swirl(RND(inst.x0, inst.x1), inst.y - 4, { shape: 'soul', color: '160,255,170', rise: RND(10, 40), spin: RND(-2, 2), r0: 4, r1: 14, size: 4, life: 40 });
            if (ph === 'active') for (const p of alive(g)) if (onTop(p, inst.x0, inst.x1, inst.y) || (p.x + p.width > inst.x0 && p.x < inst.x1 && p.y + p.height > inst.y - 40 && p.y + p.height <= inst.y + 2)) { if (hurt(g, inst, p, 6, 0, 0, { every: 50, status: { trap: 50, drain: 0 } })) p.velocity.x = 0; }
        },
        back(ctx, inst) {
            const ph = inst.phase, k = ph === 'warn' ? prog(inst, 80) : ph === 'active' ? 1 : 0;
            if (k > 0) { ctx.strokeStyle = `rgba(140,255,160,${0.3 + k * 0.5})`; ctx.lineWidth = 1.2; for (let x = inst.x0 + 10; x < inst.x1; x += 26) { ctx.beginPath(); ctx.moveTo(x, inst.y); ctx.lineTo(x + 6, inst.y + 3); ctx.lineTo(x + 3, inst.y + 7); ctx.stroke(); } glow(ctx, (inst.x0 + inst.x1) / 2, inst.y, 80, '120,255,140', 0.15 * k); }
        },
        front(ctx, inst) {
            if (inst.phase !== 'active') return;
            const up = Math.min(1, (70 - inst.left) / 10) * Math.min(1, inst.left / 10);
            for (let x = inst.x0 + 14; x < inst.x1; x += 28) {
                const h = 34 * up, wob = Math.sin(inst.t * 0.3 + x) * 3;
                ctx.fillStyle = `rgba(170,255,190,${0.55 * up})`;
                ctx.beginPath(); ctx.moveTo(x - 5, inst.y); ctx.lineTo(x - 6 + wob, inst.y - h); ctx.lineTo(x + 6 + wob, inst.y - h); ctx.lineTo(x + 5, inst.y); ctx.fill();
                for (let f = -2; f <= 2; f++) { ctx.beginPath(); ctx.ellipse(x + wob + f * 2.6, inst.y - h - 5, 1.4, 5, f * 0.25, 0, TAU); ctx.fill(); }
            }
        },
        danger(inst) { const box = { x: inst.x0, y: inst.y - 62, w: inst.x1 - inst.x0, h: 64 }; return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' ? [Object.assign(box, { soon: 0 })] : []; }
    };

    // 33. Healing spring: a campfire, hot spring or glowing coral that mends you while you stay by it
    K.healingSpring = {
        themes: { dirt: 2, xmas: 3, ice: 2, ocean: 2, candy: 1, any: 1 },
        place(L) { const s = spotOnTop(L, 40, 90); return s ? { x: s.x, y: s.y, t: 0, style: { ocean: 'coral', ice: 'spring', xmas: 'fire', candy: 'cocoa' }[L.material] || 'fire' } : null; },
        step(inst, L, g) {
            inst.t++;
            if (inst.style === 'fire' && R() < 0.5) g.fx.flame(inst.x + RND(-6, 6), inst.y - 6, RND(6, 10), RND(10, 20), 24);
            if (inst.style !== 'fire' && R() < 0.2) puff(g, inst.x + RND(-14, 14), inst.y - 4, { color: '240,245,255', size: 3, alpha: 0.35, life: 60 });
            for (const p of alive(g)) if (Math.abs(p.x + 15 - inst.x) < 46 && Math.abs(p.y + p.height - inst.y) < 6 && p.health < p.maxHealth) {
                p.health = Math.min(p.maxHealth, p.health + 0.12);
                if (inst.t % 20 === 0) g.fx.text(p.x + 15, p.y - 10, '+', '#69f0ae', 14);
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y;
            if (inst.style === 'fire' || inst.style === 'cocoa') {
                ctx.fillStyle = '#5d4037'; ctx.save(); ctx.translate(x, y - 3); ctx.rotate(0.3); ctx.fillRect(-16, -2, 32, 5); ctx.rotate(-0.6); ctx.fillRect(-16, -2, 32, 5); ctx.restore();
                ctx.fillStyle = '#9e9e9e'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(x + i * 7, y - 1, 3.5, 2.5, 0, 0, TAU); ctx.fill(); }
                glow(ctx, x, y - 10, 46, '255,170,70', 0.45 + 0.1 * Math.sin(inst.t * 0.3));
            } else {
                ctx.fillStyle = inst.style === 'coral' ? '#ff8a80' : '#90caf9'; ctx.beginPath(); ctx.ellipse(x, y - 2, 30, 6, 0, Math.PI, 0); ctx.fill();
                glow(ctx, x, y - 6, 50, inst.style === 'coral' ? '255,140,170' : '150,220,255', 0.4);
            }
            glow(ctx, x, y - 20, 30, '105,240,174', 0.12 + 0.06 * Math.sin(inst.t * 0.08));
        }
    };

    // 34. Zipline: jump into the rope to grab it and slide down to the far end
    K.zipline = {
        themes: { dirt: 2, cloud: 3, stone: 1, xmas: 2, any: 1 },
        place(L) {
            const S = solids(L).filter(p => p.y < floorY(L) - 80);
            const cands = [];
            for (const a of S) for (const b of S) { const dx = (b.x + b.width / 2) - (a.x + a.width / 2), dy = b.y - a.y; if (dx > 380 && dy > 40 && dy < 260) cands.push([a, b]); }
            if (!cands.length) return null;
            const [a, b] = cands[(R() * cands.length) | 0];
            const x0 = a.x + a.width / 2, y0 = a.y - 46, x1 = b.x + b.width / 2, y1 = b.y - 46;
            if (!claim(L, { x: Math.min(x0, x1), y: Math.min(y0, y1) - 6, w: Math.abs(x1 - x0), h: 4 })) return null;
            return { x0, y0, x1, y1, riders: new Map() };
        },
        step(inst, L, g) {
            const len = Math.hypot(inst.x1 - inst.x0, inst.y1 - inst.y0), ux = (inst.x1 - inst.x0) / len, uy = (inst.y1 - inst.y0) / len;
            for (const p of alive(g)) {
                let r = inst.riders.get(p);
                const hx = p.x + p.width / 2, hy = p.y + 6;
                if (!r) {
                    if (p.grounded || (p.zipCd || 0) > g.frameCount || p.isBird || p.onCloud) continue;
                    const s = (hx - inst.x0) * ux + (hy - inst.y0) * uy;
                    if (s < 10 || s > len - 30) continue;
                    const d = Math.abs((hx - inst.x0) * uy - (hy - inst.y0) * ux);
                    if (d < 14) { r = { s, v: 4 }; inst.riders.set(p, r); g.fx.sparks(hx, hy, '255,230,160', 4, undefined, 0, 2); }
                    continue;
                }
                // a jump (velocity set by the jump) or the end of the line lets go
                if (p.velocity.y < -6 || r.s > len - 20 || Math.hypot(hx - (inst.x0 + ux * r.s), hy - (inst.y0 + uy * r.s)) > 30) { inst.riders.delete(p); p.zipCd = g.frameCount + 30; p.velocity.x = ux * r.v; continue; }
                r.v = Math.min(11, r.v + 0.25); r.s += r.v;
                const tx = inst.x0 + ux * r.s, ty = inst.y0 + uy * r.s;
                p.x = tx - p.width / 2; p.y = ty - 6; p.velocity.x = ux * r.v; p.velocity.y = uy * r.v - p.gravity; p.jumpCount = 1;
                if (g.frameCount % 3 === 0) g.fx.sparks(tx, ty, '255,220,140', 1, Math.PI + Math.atan2(uy, ux), 0.6, 2);
            }
        },
        back(ctx, inst) {
            ctx.strokeStyle = '#3e3a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(inst.x0, inst.y0); ctx.lineTo(inst.x1, inst.y1); ctx.stroke();
            ctx.fillStyle = '#5d4037'; ctx.fillRect(inst.x0 - 3, inst.y0 - 4, 6, 50); ctx.fillRect(inst.x1 - 3, inst.y1 - 4, 6, 50);
            ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(inst.x0, inst.y0, 4, 0, TAU); ctx.arc(inst.x1, inst.y1, 4, 0, TAU); ctx.fill();
        }
    };

    // 35. Barrel cannon: hop in, it swivels, and it fires you out (attack fires early)
    K.barrelCannon = {
        themes: { dirt: 2, ocean: 2, candy: 2, any: 1 },
        place(L) { const s = spotOnTop(L, 34, 120); return s ? { x: s.x, y: s.y - 30, a: -Math.PI / 2, rider: null, t: 0 } : null; },
        step(inst, L, g) {
            inst.t++;
            inst.a = -Math.PI / 2 + Math.sin(inst.t * 0.04) * 0.9;
            if (!inst.rider) {
                for (const p of alive(g)) if (!p.isBird && !p.onCloud && (p.cannonCd || 0) < g.frameCount && Math.abs(p.x + 15 - inst.x) < 20 && Math.abs(p.y + 30 - inst.y) < 30) { inst.rider = p; inst.hold = 0; g.fx.ring(inst.x, inst.y, '255,220,140', 30, 3, 12); break; }
            } else {
                const p = inst.rider;
                if (p.isDead) { inst.rider = null; return; }
                inst.hold++;
                p.x = inst.x - p.width / 2; p.y = inst.y - p.height / 2; p.velocity.x = 0; p.velocity.y = -p.gravity; p.hidden = true;
                if (inst.hold > 70 || (inst.hold > 12 && p.attackAnim < 2)) {
                    const v = 19;
                    p.velocity.x = Math.cos(inst.a) * v; p.velocity.y = Math.sin(inst.a) * v; p.launched = true; p.grounded = false; p.jumpCount = 1; p.hidden = false;
                    p.x += Math.cos(inst.a) * 30; p.y += Math.sin(inst.a) * 30; p.cannonCd = g.frameCount + 40;
                    g.fx.smoke(inst.x + Math.cos(inst.a) * 30, inst.y + Math.sin(inst.a) * 30, 8, 6); g.fx.flashAt(inst.x + Math.cos(inst.a) * 30, inst.y + Math.sin(inst.a) * 30, '255,200,120', 40, 6);
                    tremor(g, inst.x, inst.y, 0.08); AudioSys.playGun && AudioSys.playGun('rocket');
                    inst.rider = null;
                }
            }
        },
        back(ctx, inst) {
            ctx.fillStyle = '#5d4037'; ctx.fillRect(inst.x - 16, inst.y + 18, 32, 12);
            ctx.save(); ctx.translate(inst.x, inst.y); ctx.rotate(inst.a + Math.PI / 2);
            const gr = ctx.createLinearGradient(-16, 0, 16, 0); gr.addColorStop(0, '#6d4c41'); gr.addColorStop(0.5, '#a1887f'); gr.addColorStop(1, '#5d4037');
            ctx.fillStyle = gr; ctx.fillRect(-15, -30, 30, 46);
            ctx.fillStyle = '#ffca28'; ctx.fillRect(-16, -30, 32, 4); ctx.fillRect(-16, 8, 32, 4);
            ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.ellipse(0, -30, 13, 4, 0, 0, TAU); ctx.fill();
            ctx.restore();
            if (inst.rider && inst.hold % 6 < 3) glow(ctx, inst.x + 12, inst.y + 16, 8, '255,200,90', 0.9);
        }
    };

    // 36. Parachuting presents (and candy crates): open one for a surprise weapon, or a lump of coal
    K.giftDrop = {
        themes: { xmas: 5, candy: 2, any: 0.5 },
        place(L) { return claim(L, { x: -50, y: -50, w: 1, h: 1 }) ? { gifts: [], wait: RND(240, 480) } : null; },
        step(inst, L, g) {
            if ((inst.wait -= 1) <= 0 && inst.gifts.length < 2) {
                inst.wait = RND(500, 900);
                inst.gifts.push({ x: RND(120, L.width - 120), y: -40, vy: 1.1, ph: R() * TAU, landed: false, col: ['#d32f2f', '#1976d2', '#388e3c', '#7b1fa2'][(R() * 4) | 0], life: 900 });
            }
            for (const gf of inst.gifts) {
                gf.ph += 0.05; gf.life--;
                if (!gf.landed) {
                    gf.y += gf.vy; gf.x += Math.sin(gf.ph) * 0.4;
                    const plat = L.platforms.find(q => q.active && q.type !== 'trampoline' && gf.x > q.x && gf.x < q.x + q.width && gf.y + 20 >= q.y && gf.y + 20 - gf.vy <= q.y + 2);
                    if (plat) { gf.landed = true; gf.y = plat.y - 20; g.fx.dust(gf.x, plat.y, 6, 20, '255,255,255'); }
                    if (gf.y > L.height + 60) gf.life = 0;
                }
                const opener = alive(g).find(p => !p.isBird && Math.abs(p.x + 15 - gf.x) < 26 && Math.abs(p.y + 40 - gf.y) < 40);
                if (opener && gf.life > 0) {
                    gf.life = 0;
                    g.fx.confetti(gf.x, gf.y, 60, ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#ffffff']);
                    if (R() < 0.8) { const pool = Object.keys(WEAPONS).filter(k => k !== 'bird_crystal' && k !== 'magic_stick'); const w = new Weapon(gf.x - 15, gf.y - 30, pool[(R() * pool.length) | 0]); g.weapons.push(w); }
                    else { g.fx.explosion && g.fx.explosion(gf.x, gf.y, 50); for (const p of alive(g)) if (Math.hypot(p.x + 15 - gf.x, p.y + 30 - gf.y) < 60) hurt(g, inst, p, 10, Math.sign(p.x + 15 - gf.x || 1) * 8, -7, { every: 30 }); g.fx.text(gf.x, gf.y - 30, 'COAL!', '#555', 16); }
                }
            }
            inst.gifts = inst.gifts.filter(gf => gf.life > 0);
        },
        front(ctx, inst) {
            for (const gf of inst.gifts) {
                ctx.save(); ctx.translate(gf.x, gf.y);
                if (!gf.landed) {
                    ctx.rotate(Math.sin(gf.ph) * 0.15);
                    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.arc(0, -46, 26, Math.PI, 0); ctx.fill();
                    ctx.fillStyle = '#e53935'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, -46); ctx.arc(0, -46, 26, Math.PI + i * Math.PI / 4, Math.PI + i * Math.PI / 4 + Math.PI / 8); ctx.fill(); }
                    ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-24, -46); ctx.lineTo(-10, -2); ctx.moveTo(24, -46); ctx.lineTo(10, -2); ctx.stroke();
                }
                ctx.fillStyle = gf.col; ctx.fillRect(-12, -2, 24, 22);
                ctx.fillStyle = '#ffe082'; ctx.fillRect(-2, -2, 4, 22); ctx.fillRect(-12, 7, 24, 4);
                ctx.beginPath(); ctx.ellipse(-5, -4, 5, 3, -0.5, 0, TAU); ctx.ellipse(5, -4, 5, 3, 0.5, 0, TAU); ctx.fill();
                ctx.restore();
                if (gf.landed) glow(ctx, gf.x, gf.y + 8, 30, '255,230,150', 0.25 + 0.15 * Math.sin(gf.ph * 3));
            }
        }
    };

    // ---------- choosing features for a round ----------
    function weightFor(k, mat) { const t = K[k].themes; return t[mat] !== undefined ? t[mat] : (t.any || 0); }
    function plan(L) {
        L.features = []; L.featureUsed = [];
        if (L.noFeatures) return;
        const pool = Object.keys(K).map(k => [k, weightFor(k, L.material)]).filter(([, w]) => w > 0);
        const want = 2 + (R() < 0.45 ? 1 : 0);
        const used = new Set();
        for (let tries = 0; tries < 24 && L.features.length < want; tries++) {
            let total = 0; for (const [k, w] of pool) if (!used.has(k)) total += w;
            if (total <= 0) break;
            let r = R() * total, pick = null;
            for (const [k, w] of pool) { if (used.has(k)) continue; r -= w; if (r <= 0) { pick = k; break; } }
            if (!pick) break;
            used.add(pick);
            let inst = null;
            try { inst = K[pick].place(L); } catch (e) { inst = null; }
            if (inst) { inst.kind = pick; L.features.push(inst); }
        }
    }

    // ---------- engine hooks ----------
    const buildBase = Level.prototype.buildLayout;
    Level.prototype.buildLayout = function (layout) {
        buildBase.call(this, layout);
        try { plan(this); } catch (e) { this.features = []; }
    };
    const updBase = Level.prototype.update;
    Level.prototype.update = function () {
        updBase.call(this);
        const g = window.game;
        if (!this.features || !g || g.level !== this) return;
        for (const p of g.players) if (p.env) { p.env.grip = 1; p.env.speed = 1; p.env.jump = 1; p.env.grav = 1; }
        for (const f of this.features) { try { K[f.kind].step(f, this, g); } catch (e) { /* a broken feature must never stop the match */ } }
    };
    const shadowBase = Level.prototype.drawShadow;
    Level.prototype.drawShadow = function (ctx, p) { if (!p.noDraw) shadowBase.call(this, ctx, p); };
    const platBase = Level.prototype.drawPlatform;
    Level.prototype.drawPlatform = function (ctx, p, pattern) {
        if (p.noDraw) return;
        const f = p.featureTag === 'crumble' && this.features && this.features.find(i => i.plat === p);
        if (f) { const j = K.crumble.jitter(f); ctx.save(); ctx.translate(j, 0); platBase.call(this, ctx, p, pattern); ctx.restore(); return; }
        platBase.call(this, ctx, p, pattern);
    };
    const drawBase = Level.prototype.drawPlatforms;
    Level.prototype.drawPlatforms = function (ctx) {
        drawBase.call(this, ctx);
        if (!this.features) return;
        for (const f of this.features) if (K[f.kind].back) { ctx.save(); try { K[f.kind].back(ctx, f, this, window.game); } catch (e) { /* skip */ } ctx.restore(); }
    };
    const fxDraw = FX.prototype.draw;
    FX.prototype.draw = function (ctx) {
        const g = window.game, L = g && g.level;
        if (L && L.features && g.fx === this) for (const f of L.features) if (K[f.kind].front) { ctx.save(); try { K[f.kind].front(ctx, f, L, g); } catch (e) { /* skip */ } ctx.restore(); }
        fxDraw.call(this, ctx);
    };

    // environment modifiers on a fighter (ice, tar, quicksand, water, low gravity), applied around
    // the normal movement rules so nothing else in the controls changes
    const inputBase = Player.prototype.applyInput;
    Player.prototype.applyInput = function (input) {
        const e = this.env;
        if (!e || (e.grip === 1 && e.speed === 1 && e.jump === 1)) return inputBase.call(this, input);
        const vx0 = this.velocity.x, sp = this.speed, jf = this.jumpForce;
        this.speed = sp * e.speed; this.jumpForce = jf * e.jump;
        inputBase.call(this, input);
        this.speed = sp; this.jumpForce = jf;
        if (e.grip < 1 && this.grounded) this.velocity.x = vx0 + (this.velocity.x - vx0) * e.grip;
    };
    const physBase = Player.prototype.applyPhysics;
    Player.prototype.applyPhysics = function (level) {
        const e = this.env;
        if (!e || e.grav === 1 || this.isBird || this.onCloud) return physBase.call(this, level);
        const gv = this.gravity; this.gravity = gv * e.grav;
        physBase.call(this, level);
        this.gravity = gv;
    };
    // a fighter inside a barrel cannon is hidden
    const pdraw = Player.prototype.draw;
    Player.prototype.draw = function (ctx, game) { if (this.hidden) return; pdraw.call(this, ctx, game); };

    // ---------- what bots can see coming ----------
    function dangers(L) {
        const out = [];
        if (!L || !L.features) return out;
        for (const f of L.features) if (K[f.kind].danger) { try { for (const d of K[f.kind].danger(f, L)) out.push(d); } catch (e) { /* skip */ } }
        return out;
    }

    // ---------- bots: read the same tells and get out of the way ----------
    const WINDOW = { easy: 26, medium: 50, hard: 78, nightmare: 100, hack: 140 };
    if (typeof BotBrain !== 'undefined') {
        const driveBase = BotBrain.prototype.drive;
        BotBrain.prototype.drive = function (it) {
            const out = driveBase.call(this, it);
            const me = this.body, L = this.game && this.game.level;
            if (!L || !L.features || !L.features.length || me.isBird || me.onCloud || me.isDead) return out;
            const ds = dangers(L);
            if (!ds.length) return out;
            const win = WINDOW[this.difficulty] || 50;
            if (this.difficulty !== 'hack' && this.frame % 30 === 0) this.hazardAware = Math.random() < 0.55 + 0.45 * (this.profile.skills.dodge || 0);
            if (this.difficulty !== 'hack' && this.hazardAware === false) return out;
            const box = { x: me.x - 4, y: me.y, w: me.width + 8, h: me.height };
            const threat = ds.find(d => d.soon <= win && overlap(box, d));
            if (threat) {
                if (this.plan && this.plan.tag !== 'hazard') this.plan = null;
                const toLeft = me.x + me.width - threat.x, toRight = threat.x + threat.w - me.x;
                out.x = toLeft < toRight ? -1 : 1;
                out.y = 0;
                if (threat.kind === 'lane' && threat.soon < 30) out.jump = !me.jumpPressed || me.velocity.y < 0;
                if (threat.soon < 12 && this.profile.skills.shield > Math.random() && !me.shieldCd) out.shield = true;
                return out;
            }
            // don't walk into something that is about to go off
            if (out.x) {
                const ahead = { x: me.x + out.x * 40, y: me.y, w: me.width, h: me.height };
                if (ds.some(d => d.soon <= win && overlap(ahead, d))) out.x = 0;
            }
            return out;
        };
    }

    return { KINDS: K, plan, dangers, simReachable, count: () => Object.keys(K).length };
})();
