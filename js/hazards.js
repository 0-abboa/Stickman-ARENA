// Environmental features: 36 kinds of living map pieces. Each round picks two or three that suit
// the arena's theme and fits them into the layout: rope bridges that sag and swing under whoever
// walks on them, ledges that crumble, conveyor belts, balance scales, lava vents and water spouts,
// steam pipes, a rising tide, currents and bubble columns, quicksand, gusts, fans and tornadoes,
// flame jets, tesla coils, sweeping lasers, lightning, meteors, pendulum blades, boulders,
// chandeliers, spike traps, presses, black holes, drop tiles, portals, low gravity, ghost hands, healing springs, ziplines,
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
    const inBox = (p, b) => p.intersectsRect(b);
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
    // what something above [x0, x1] can hang from: the underside of the nearest platform over it, or the
    // top of the arena (drawn reaching past the edge of the screen)
    function ceilingAbove(L, x0, x1, y) {
        let best = -60;
        for (const q of L.platforms) if (q.active && q.type !== 'trampoline' && !q.motion && q.x < x1 && q.x + q.width > x0 && q.y + q.height <= y && q.y + q.height > best) best = q.y + q.height;
        return best;
    }
    function makePlat(L, inst, x, y, w, h, draw) {
        const p = L.createPlatform(x, y, w, h || 14);
        p.feature = inst; p.noDraw = !draw;
        return p;
    }
    // move a platform and whoever stands on it
    // (anyone whose feet are on its top is carried, whether or not the physics has flagged them as grounded this
    // frame, and never twice in one frame)
    function shift(g, plat, dx, dy) {
        const top = plat.y, x0 = plat.x;
        plat.x += dx; plat.y += dy;
        for (const p of alive(g)) {
            if (p.carriedAt === g.frameCount && p.carriedBy !== plat) continue;
            const feet = p.y + p.height;
            const riding = p.ridePlat === plat && p.grounded;
            const on = p.velocity.y >= -1 && feet >= top - 6 && feet <= top + 10 && p.x + p.width > x0 && p.x < x0 + plat.width;
            if (!riding && !on) continue;
            p.x += dx; p.y += dy; p.carriedAt = g.frameCount; p.carriedBy = plat;
        }
    }
    // A trap can hurt you, but never finish a healthy fighter in one go: all traps together deal at most
    // TRAP_BUDGET damage to one fighter in any two seconds (a fighter already low on health can still die),
    // and their knockback is a stagger, not a throw off the map.
    const TRAP_BUDGET = 34;
    function hurt(g, inst, p, dmg, kx, ky, opts) {
        const cd = inst.cd || (inst.cd = new Map());
        if ((cd.get(p) || 0) > g.frameCount) return false;
        cd.set(p, g.frameCount + ((opts && opts.every) || 24));
        if (!p.trapLog || g.frameCount - p.trapLog.t > 120) p.trapLog = { t: g.frameCount, dealt: 0 };
        if (!(opts && opts.exempt)) {   // (the press is the one trap that is allowed to take a big bite)
            const room = TRAP_BUDGET - p.trapLog.dealt;
            if (room <= 0) return false;
            dmg = Math.min(dmg, room);
        }
        p.trapLog.dealt += dmg;
        p.lastHitType = 'env'; p.lastHitAt = g.frameCount;
        p.takeDamage(dmg, p.lastAttacker && performance.now() - (p.lastAttackerAt || 0) < 3000 ? p.lastAttacker : null);
        if (kx !== undefined) { p.velocity.x = clamp(kx, -6.5, 6.5); p.velocity.y = Math.max(ky, -11); p.grounded = false; p.launched = false; }
        if (opts && opts.status && g.applyStatus) g.applyStatus(p, opts.status, null, null, dmg);
        p.flinchNew = true; p.hitFlash = 1;
        return true;
    }
    const env = (p) => p.env || (p.env = { grip: 1, speed: 1, jump: 1, grav: 1 });
    // Water puts out fire at once: a burning fighter that touches it stops burning, in a puff of steam
    function douse(g, p) {
        if (!p.status || !(p.status.burn > 0)) return false;
        p.status.burn = 0;
        if (g && g.fx) { g.fx.add({ type: 'puff', x: p.x + p.width / 2, y: p.y + p.height * 0.4, vx: 0, vy: -1.2, life: 40, color: '235,240,245', size: 6, grow: 0.5, alpha: 0.7 }); for (let i = 0; i < 6; i++) g.fx.add({ type: 'puff', x: p.x + p.width / 2 + RND(-10, 10), y: p.y + p.height * 0.5 + RND(-14, 14), vx: RND(-0.5, 0.5), vy: -RND(0.6, 1.6), life: 34, color: '225,232,240', size: 3, grow: 0.3, alpha: 0.55 }); g.fx.text && g.fx.text(p.x + p.width / 2, p.y - 12, 'EXTINGUISHED', '#8fd8ff', 11); }
        return true;
    }
    // How much a force can turn a shot: cards, paper, bubbles and flames are tossed about; arrows and bolts a fair
    // amount; bullets, rockets and rocks hardly; the Tear of God by no more than 10 degrees in total.
    const LIGHT = /card|note|coin|paper|snow|bubble|feather|leaf|spin|ring|boomerang|chakram|flame|gust|petal|confetti|music/;
    const MEDIUM = /arrow|bolt|kunai|dagger|harpoon|net|dart|needle|thorn|shard|orb|plasma|void|star|spike/;
    function projK(pr) {
        const sp = pr.spec, name = ((sp.look && sp.look.s) || '') + ' ' + (pr.type || '');
        if (sp.divine) return 1;
        if (LIGHT.test(name)) return 1;
        if (MEDIUM.test(name)) return 0.5;
        if (/bullet|pellet|sniper|rail|beam/.test(name)) return 0.14;
        return 0.22;   // rockets, shells, rocks, grenades: heavy
    }
    const DIVINE_MAX_TURN = 10 * Math.PI / 180;
    // push a projectile with acceleration (ax, ay): its direction turns (by the part of the push that is sideways to
    // its flight, over its speed), slow light ones are also dragged along it
    function bend(pr, ax, ay) {
        if (!pr.active || pr.stuck) return;
        const k = projK(pr), v = Math.hypot(pr.vx, pr.vy);
        if (v < 0.5) { if (k >= 0.8) { pr.vx += ax * 0.5; pr.vy += ay * 0.5; } return; }
        const ux = pr.vx / v, uy = pr.vy / v, perp = -uy * ax + ux * ay, par = ux * ax + uy * ay;
        let dth = clamp(perp / v, -0.45, 0.45) * k;
        if (pr.spec.divine) { const room = DIVINE_MAX_TURN - (pr.defl || 0); if (room <= 0) return; dth = clamp(dth, -room, room); pr.defl = (pr.defl || 0) + Math.abs(dth); }
        const c = Math.cos(dth), sn = Math.sin(dth), vx = pr.vx, vy = pr.vy;
        pr.vx = vx * c - vy * sn; pr.vy = vx * sn + vy * c;
        if (k >= 0.8 && !pr.spec.divine) { const sp2 = Math.min(0.6, Math.abs(par) * 0.08) * Math.sign(par); pr.vx += ux * sp2 * k; pr.vy += uy * sp2 * k; }
    }
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
        themes: { dirt: 3, stone: 2, haunted: 2, ocean: 1, xmas: 1, candy: 1, cloud: 1 },
        place(L) {
            const S = solids(L), cands = [];
            for (const a of S) for (const b of S) {
                if (a === b) continue;
                const gap = b.x - (a.x + a.width);
                // A bridge should be a walkable connection, not a deep valley between two high
                // platforms. Keep its anchors close to level so neither exit needs a blocked jump.
                if (gap < 120 || gap > 460 || Math.abs(a.y - b.y) > 16) continue;
                const box = { x: a.x + a.width, y: Math.min(a.y, b.y) - 90, w: gap, h: 140 };
                if (L.platforms.some(q => q !== a && q !== b && q.active && overlap(box, { x: q.x, y: q.y, w: q.width, h: q.height }))) continue;
                cands.push([a, b, box]);
            }
            if (!cands.length) return null;
            const [a, b, box] = cands[(R() * cands.length) | 0];
            if (!claim(L, box)) return null;
            const inst = { x0: a.x + a.width, y0: a.y, x1: b.x, y1: b.y, segs: [], swing: 0, swingV: 0 };
            for (const [platform, x] of [[a, inst.x0], [b, inst.x1]]) {
                (platform.bridgeStepZones || (platform.bridgeStepZones = [])).push([x - 32, x + 32]);
            }
            const n = Math.max(5, Math.round((inst.x1 - inst.x0) / 26)), w = (inst.x1 - inst.x0) / n;
            for (let i = 0; i < n; i++) {
                const plank = makePlat(L, inst, inst.x0 + i * w, inst.y0, w + 0.5, 10);
                plank.bridgeStep = true;
                inst.segs.push(plank);
            }
            inst.prevLoad = 0;
            return inst;
        },
        shape(inst, u, load) {
            const base = inst.y0 + (inst.y1 - inst.y0) * u;
            let sag = 8 * Math.sin(Math.PI * u) + inst.swing * Math.sin(Math.PI * u);
            for (const r of load) sag += 7 * Math.max(0, 1 - Math.abs(u - r) * 2.6) * Math.sin(Math.PI * clamp(r, 0.05, 0.95));
            // Preserve a little movement and weight, but cap the low point so the bridge stays
            // climbable in both directions instead of forming a pit behind the player.
            return base + clamp(sag, 0, 20);
        },
        step(inst, L, g) {
            const span = inst.x1 - inst.x0, load = [];
            let landed = false;
            // whoever has their feet on the planks weighs them down (judged by where the feet are, not by a flag that
            // flickers as the planks move)
            for (const p of alive(g)) {
                const feet = p.y + p.height, mid = p.x + p.width / 2;
                if (mid < inst.x0 - 4 || mid > inst.x1 + 4 || p.velocity.y < -1) continue;
                if (inst.segs.some(sg => feet >= sg.y - 6 && feet <= sg.y + sg.height + 8 && p.x + p.width > sg.x && p.x < sg.x + sg.width)) {
                    load.push(clamp((mid - inst.x0) / span, 0, 1));
                    if (Math.abs(p.velocity.x) > 2) inst.swingV += 0.012 * Math.sign(R() - 0.5);
                }
            }
            if (load.length > inst.prevLoad) { inst.swingV += 0.35; landed = true; }
            inst.prevLoad = load.length;
            inst.swingV += -0.06 * inst.swing; inst.swingV *= 0.95; inst.swing = clamp(inst.swing + inst.swingV, -4, 4);
            inst.load = load;
            // each plank eases toward where the rope would hold it: a few pixels a frame, so a fighter walking on it is
            // carried smoothly instead of being left behind
            inst.segs.forEach((sg, i) => {
                const u = (i + 0.5) / inst.segs.length, target = this.shape(inst, u, load), dy = clamp(target - sg.y, -1.6, 2.4);
                if (Math.abs(dy) > 0.001) shift(g, sg, 0, dy);
            });
            if (landed && g) g.fx.dust(inst.x0 + span / 2, inst.y0 + 20, 4, 30, '170,140,110');
        },
        back(ctx, inst) {
            const n = inst.segs.length, span = inst.x1 - inst.x0;
            // drawn from where the planks really are, so what you see is what you stand on
            const yAt = (i) => i <= 0 ? inst.y0 : i >= n ? inst.y1 : (inst.segs[i - 1].y + inst.segs[i].y) / 2;
            const ropeY = (u) => { const f = u * n, i = Math.min(n - 1, Math.max(0, f | 0)), a = yAt(i), b = yAt(i + 1); return a + (b - a) * (f - i); };
            // two hand ropes
            ctx.strokeStyle = '#6d4c2a'; ctx.lineWidth = 2.4;
            for (const off of [-30, -26]) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; ctx.lineTo(inst.x0 + span * u, ropeY(u) + off + 10 * Math.sin(Math.PI * u) * 0.3); } ctx.stroke(); }
            // posts at the ends
            ctx.fillStyle = '#4e342e'; ctx.fillRect(inst.x0 - 3, inst.y0 - 34, 5, 34); ctx.fillRect(inst.x1 - 2, inst.y1 - 34, 5, 34);
            // planks and hangers
            inst.segs.forEach((s, i) => {
                const nx = s.x + s.width;
                ctx.strokeStyle = 'rgba(110,80,50,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x + s.width / 2, s.y); ctx.lineTo(s.x + s.width / 2, ropeY((i + 0.5) / n) - 27); ctx.stroke();
                const yl = yAt(i), yr = yAt(i + 1);
                ctx.fillStyle = i % 2 ? '#8d6e45' : '#7a5c38';
                ctx.beginPath(); ctx.moveTo(s.x + 1, s.y + (yl - s.y) * 0.5); ctx.lineTo(nx - 1, s.y + (yr - s.y) * 0.5); ctx.lineTo(nx - 1, s.y + (yr - s.y) * 0.5 + 8); ctx.lineTo(s.x + 1, s.y + (yl - s.y) * 0.5 + 8); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(s.x + s.width * 0.3, s.y + 3, 2, 2);
            });
        }
    };

    // 2. Crumbling ledge: stand on it and it cracks, shakes, sheds dust and falls away, then regrows
    K.crumble = {
        themes: { stone: 3, dirt: 2, haunted: 2, lava: 2, ice: 1 },
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
        themes: { neon: 3, stone: 1, candy: 2, xmas: 2 },
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
        themes: { candy: 2, xmas: 2, stone: 2, magic: 2, dirt: 1, ice: 1.5 },
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
                const inst = { cx: cxv, py: y0 - 130, y0, off: 0, offV: 0 }; inst.anchor = ceilingAbove(L, cxv - 6, cxv + 6, inst.py - 10);
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
            // hung from the ceiling by a chain
            ctx.strokeStyle = '#7a7a82'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(inst.cx, inst.anchor); ctx.lineTo(inst.cx, inst.py); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#3a3a40'; ctx.fillRect(inst.cx - 12, inst.anchor - 4, 24, 8);
            ctx.save(); ctx.translate(inst.cx, inst.py);
            ctx.fillStyle = '#5d4037'; ctx.fillRect(-4, -10, 8, 14);
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
        themes: { candy: 3, cloud: 3, ocean: 2, xmas: 1 },
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
        themes: { magic: 3, neon: 2, haunted: 2, ice: 1 },
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
                // solid stones are always clearly drawn: the warning is a flicker between full and ~60%, never a ghost you can still stand on
                let a = ph < 240 ? 1 : 0.12;
                if (ph > 180 && ph < 240) a = ((inst.t >> 2) & 1) ? 0.6 : 1;     // flickering: about to go
                if (ph >= 330) a = 0.12 + (ph - 330) / 30 * 0.4;                 // coming back (not solid yet)
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
        themes: { ice: 3, xmas: 3, candy: 1 },
        place(L) {
            const s = spotOnTop(L, 90, 70);
            if (!s) return null;
            return { x0: s.x - 90, x1: s.x + 90, y: s.y };
        },
        step(inst, L, g) { for (const p of alive(g)) if (!p.isBird && !p.onCloud && onTop(p, inst.x0, inst.x1, inst.y)) { const e = env(p); e.grip = Math.min(e.grip, 0.07); if (Math.abs(p.velocity.x) > 3 && R() < 0.3) g.fx.add({ type: 'puff', x: p.x + p.width / 2, y: inst.y, vx: 0, vy: -0.3, life: 20, color: '230,245,255', size: 2, grow: 0.1, alpha: 0.6 }); } },
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
        themes: { candy: 3, dirt: 2, lava: 2, haunted: 1 },
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
        themes: { ice: 3, xmas: 3, stone: 1 },
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
                // a real fountain: thick blobs of lava are thrown up, slow, arc over and fall back as rain
                if (inst.enter) { AudioSys.playExplosion && AudioSys.playExplosion(); tremor(g, x, y, 0.3); g.fx.flashAt(x, y - 40, '255,180,80', 120, 10); }
                const k = inst.left / 80;   // strongest at the start, dying down
                inst.blobs = inst.blobs || [];
                for (let i = 0; i < 2 + Math.round(4 * k); i++) inst.blobs.push({ x: x + RND(-7, 7), y: y - 4, vx: RND(-1.3, 1.3), vy: -RND(10, 12.5 + 4.5 * k), r: RND(5, 10), age: 0 });
                if (R() < 0.4) g.fx.embers(x, y - RND(40, 200), 2, 20);
                // whoever is standing in the vent when it goes is blown up and out of it
                const ventBox = { x: x - 28, y: y - 90, w: 56, h: 92 };
                for (const p of alive(g)) if (p.intersectsRect(ventBox)) {
                    const side = p.x + p.width / 2 < x ? -1 : 1;
                    if ((p.ventAt || 0) > g.frameCount) continue;
                    p.ventAt = g.frameCount + 30;
                    hurt(g, inst, p, 24, side * 4.5, -13, { every: 40, status: { burn: 50 } });
                    p.velocity.x = side * 4.5; p.velocity.y = -13; p.grounded = false;
                }
            }
            if (inst.blobs && inst.blobs.length) {
                for (const b of inst.blobs) {
                    b.vy += 0.38; b.x += b.vx; b.y += b.vy; b.age++;
                    if (b.vy > 0) {
                        const q = L.platforms.find(o => o.active && o.type !== 'trampoline' && b.x > o.x && b.x < o.x + o.width && b.y >= o.y - 2 && b.y - b.vy <= o.y + 2);
                        if (q) { b.dead = true; (inst.splats || (inst.splats = [])).push({ plat: q, dx: b.x - q.x, x: b.x, y: q.y, r: b.r * 1.2, life: 260 }); if (R() < 0.5) g.fx.add({ type: 'drop', x: b.x, y: q.y - 2, vx: RND(-1.5, 1.5), vy: -RND(1, 3), life: 26, color: 'rgba(255,150,50,1)', size: 1.6, gravity: 0.3 }); }
                        else if (b.y > L.height + 40) b.dead = true;
                    }
                    for (const p of alive(g)) if (p.touchesCircle(b.x, b.y, b.r * 0.7)) { if (hurt(g, inst, p, 14, (p.x + p.width / 2 < b.x ? -1 : 1) * 3, -6, { every: 16, status: { burn: 50 } })) g.fx.flashAt(b.x, b.y, '255,190,90', 24, 4); }
                }
                inst.blobs = inst.blobs.filter(b => !b.dead);
            }
            if (inst.splats) { for (const sp of inst.splats) { sp.life--; if (sp.plat) { sp.x = sp.plat.x + sp.dx + (sp.plat.jx || 0); sp.y = sp.plat.y; if (!sp.plat.active) sp.life = 0; } } inst.splats = inst.splats.filter(sp => sp.life > 0); }
            if (ph === 'cool' && R() < 0.2) puff(g, x + RND(-8, 8), y - 4, { color: '90,80,80', size: 3, life: 60, alpha: 0.3 });
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
            if (inst.splats) for (const sp of inst.splats) {
                // splashed lava glows, then cools to a dark crust
                const k = sp.life / 260;
                ctx.fillStyle = k > 0.6 ? `rgba(255,${120 + 100 * (k - 0.6) / 0.4 | 0},40,0.9)` : `rgba(${60 + 190 * k / 0.6 | 0},${20 + 60 * k / 0.6 | 0},${16},${0.85 * Math.min(1, sp.life / 40)})`;
                ctx.beginPath(); ctx.ellipse(sp.x, sp.y - 1, sp.r, sp.r * 0.3, 0, Math.PI, 0); ctx.fill();
                if (k > 0.4) glow(ctx, sp.x, sp.y - 2, sp.r * 2.2, '255,120,40', 0.4 * k);
            }
            if (!inst.blobs || !inst.blobs.length) return;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (const b of inst.blobs) { const heat = Math.max(0, 1 - b.age / 70); glow(ctx, b.x, b.y, b.r * 3, heat > 0.5 ? '255,170,60' : '255,90,30', 0.22 + 0.25 * heat); }
            ctx.restore();
            for (const b of inst.blobs) {
                const heat = Math.max(0, 1 - b.age / 70);
                // fresh lava is near white-yellow, it reddens as it flies, and darkens on the way down
                const r = 255, gch = 90 + 150 * heat, bch = 30 + 110 * Math.max(0, heat - 0.6);
                ctx.fillStyle = `rgb(${r},${gch | 0},${bch | 0})`;
                ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * (1 + Math.min(0.6, Math.abs(b.vy) * 0.04)), Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, TAU); ctx.fill();
                if (heat < 0.5) { ctx.fillStyle = `rgba(60,20,10,${0.6 * (0.5 - heat) * 2})`; ctx.beginPath(); ctx.arc(b.x + b.r * 0.2, b.y + b.r * 0.2, b.r * 0.6, 0, TAU); ctx.fill(); }
            }
        },
        danger(inst, L) {
            const out = [];
            if (inst.phase === 'warn' || inst.phase === 'active') {
                out.push({ x: inst.x - 34, y: inst.y - 92, w: 68, h: 94, soon: inst.phase === 'warn' ? inst.left : 0, kind: 'lava-vent' });
            }
            if (inst.phase !== 'active') return out;
            for (const b of inst.blobs || []) {
                let x = b.x, y = b.y, vx = b.vx, vy = b.vy, stopped = false;
                for (let t = 1; t <= 24; t++) {
                    const oldY = y; vy += 0.38; x += vx; y += vy;
                    let landed = null;
                    if (vy > 0) for (const p of L.platforms) {
                        if (!p.active || p.motion || p.type === 'trampoline' || x + b.r < p.x || x - b.r > p.x + p.width) continue;
                        if (oldY + b.r <= p.y && y + b.r >= p.y) { landed = p; y = p.y - b.r; stopped = true; break; }
                    }
                    if (t % 3 === 0 || landed) out.push({ x: x - b.r, y: y - b.r, w: b.r * 2, h: b.r * 2, soon: t, kind: 'lava-drop' });
                    if (stopped || y > L.height + 20) break;
                }
            }
            return out;
        }
    };

    // 11. Water spout: bubbles rise and the surface bulges, then a jet throws you up (no damage)
    K.waterSpout = {
        themes: { ocean: 4, ice: 1 },
        place(L) { const s = spotOnTop(L, 28, 300); return s ? { x: s.x, y: s.y } : null; },
        D: { idle: () => RND(200, 420), warn: () => 80, active: () => 120, cool: () => 60 },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), x = inst.x, y = inst.y;
            if (ph === 'warn') { if (R() < 0.6) g.fx.swirl(x + RND(-12, 12), y, { shape: 'bubble', color: '200,235,255', rise: RND(30, 80), spin: RND(-1, 1), r0: 2, r1: 6, size: RND(2, 4), life: 40 }); }
            else if (ph === 'active') {
                for (let i = 0; i < 3; i++) g.fx.add({ type: 'drop', x: x + RND(-10, 10), y: y - RND(0, 20), vx: RND(-1.2, 1.2), vy: -RND(8, 14), life: 40, color: 'rgba(180,230,255,0.9)', size: RND(1.5, 3), gravity: 0.3 });
                // crown of spray at the top of the jet: droplets thrown out and sideways that arc and fall back
                const h = 300 * Math.min(1, (120 - inst.left) / 12);
                if (h > 120) for (let i = 0; i < 2; i++) g.fx.add({ type: 'drop', x: x + RND(-9, 9), y: y - h, vx: RND(-2.4, 2.4), vy: -RND(1, 4.5), life: 46, color: 'rgba(200,238,255,0.9)', size: RND(1.2, 2.6), gravity: 0.3 });
                const col = { x: x - 30, y: y - 330, w: 60, h: 330 };
                for (const p of alive(g)) if (inBox(p, col)) { douse(g, p); p.velocity.y = Math.max(-10.5, p.velocity.y - 1.3); p.velocity.x += (x - (p.x + p.width / 2)) * 0.01; p.grounded = false; p.launched = true; p.jumpCount = Math.min(p.jumpCount, 1); }
            }
        },
        back(ctx, inst) {
            const x = inst.x, y = inst.y;
            ctx.fillStyle = '#3a6a7a'; ctx.beginPath(); ctx.ellipse(x, y, 18, 5, 0, Math.PI, 0); ctx.fill();
            if (inst.phase === 'warn') { const k = prog(inst, 80); ctx.strokeStyle = `rgba(200,240,255,${0.3 + k * 0.5})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y - 2, 12 + k * 10, 3 + k * 3, 0, Math.PI, 0); ctx.stroke(); }
        },
        // the jet climbs, thins out and breaks into a crown of spray that arcs over and rains back down
        front(ctx, inst) {
            const x = inst.x, y = inst.y, t = inst.t;
            if (inst.phase !== 'active') return;
            const up = Math.min(1, (120 - inst.left) / 12), fade = Math.min(1, inst.left / 16);
            const h = 300 * up;
            if (h < 4) return;
            const wob = (u) => Math.sin(t * 0.4 + u * 7) * (1.5 + u * 4);
            const gr = ctx.createLinearGradient(0, y - h, 0, y);
            gr.addColorStop(0, 'rgba(210,242,255,0)'); gr.addColorStop(0.2, `rgba(205,240,255,${0.5 * fade})`); gr.addColorStop(1, `rgba(150,215,255,${0.82 * fade})`);
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 16, y);
            for (let i = 0; i <= 14; i++) { const u = i / 14; ctx.lineTo(x - (15 - 9 * u) + wob(u), y - h * u); }
            for (let i = 14; i >= 0; i--) { const u = i / 14; ctx.lineTo(x + (15 - 9 * u) + wob(u + 0.4), y - h * u); }
            ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade})`; ctx.lineWidth = 1.4;
            for (let i = 0; i < 3; i++) { const u = ((t * 0.03 + i / 3) % 1); ctx.beginPath(); ctx.moveTo(x - 9 * (1 - u * 0.5) + wob(u), y - h * u); ctx.lineTo(x + 9 * (1 - u * 0.5) + wob(u), y - h * u - 8); ctx.stroke(); }
            // mist where the water leaves the top, so the column fades out instead of being cut
            glow(ctx, x, y - h, 46, '215,242,255', 0.35 * fade * up);
            // foam splashing around the vent
            ctx.fillStyle = `rgba(235,248,255,${0.5 * fade})`; for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 0.2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 20, y - 2 + Math.sin(a) * 2, 7, 3, 0, 0, TAU); ctx.fill(); }
        }
    };

    // 12. Steam pipe: a rattling cap and thin wisps, then a sideways blast of scalding steam
    K.steamVent = {
        themes: { neon: 3, stone: 2, ice: 1, xmas: 1 },
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
                if (sub > 0.1 && L.material !== 'candy') douse(g, p);   // (chocolate is not water)
                if (sub > 0.1) { const e = env(p); e.grav = Math.min(e.grav, 0.25); e.speed = Math.min(e.speed, 0.7); p.velocity.y += -0.32 * Math.min(1, sub); p.velocity.y *= 0.93; if (R() < 0.05) g.fx.swirl(p.x + 15, p.y + 20, { shape: 'bubble', color: '200,235,255', rise: 40, spin: 0, r0: 2, r1: 4, size: 2, life: 30 }); }
            }
        },
        front(ctx, inst, L) {
            const y = inst.level, t = inst.t, choc = L.material === 'candy', body = choc ? 'rgba(110,62,30,0.55)' : 'rgba(60,150,200,0.32)', edge = choc ? 'rgba(255,225,200,0.7)' : 'rgba(220,245,255,0.6)';
            ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-3000, L.height + 3000);
            for (let x = -3000; x <= L.width + 3000; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.05) * 4);
            ctx.lineTo(L.width + 3000, L.height + 3000); ctx.fill();
            ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.beginPath(); for (let x = -400; x <= L.width + 400; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.05) * 4); ctx.stroke();
        }
    };

    // 14. Current: a band of moving water (or a jet stream) that drags you along
    K.current = {
        themes: { ocean: 3, cloud: 2, magic: 1 },
        place(L) {
            const b = openAir(L, 520, 90, 150, floorY(L) - 120);
            if (!b) return null;
            return Object.assign(b, { dir: R() < 0.5 ? -1 : 1, t: 0,
                ribbons: Array.from({ length: 9 }, () => ({ u: R(), v: 0.15 + R() * 0.7, len: 60 + R() * 110, sp: 0.004 + R() * 0.004, ph: R() * TAU, amp: 3 + R() * 5 })),
                motes: Array.from({ length: 22 }, () => ({ u: R(), v: R(), sp: 0.006 + R() * 0.006, ph: R() * TAU, s: 1 + R() * 2.5 })) });
        },
        step(inst, L, g) {
            inst.t++;
            for (const r of inst.ribbons) { r.u += inst.dir * r.sp; if (r.u > 1.3) r.u -= 1.6; if (r.u < -0.3) r.u += 1.6; }
            for (const m of inst.motes) { m.u += inst.dir * m.sp; m.ph += 0.05; if (m.u > 1) m.u -= 1; if (m.u < 0) m.u += 1; }
            for (const p of alive(g)) if (inBox(p, inst)) { if (L.material === 'ocean') douse(g, p); p.velocity.x += inst.dir * 0.55; p.velocity.x = clamp(p.velocity.x, -11, 11); }
        },
        back(ctx, inst, L) {
            const look = { ocean: '210,240,255', haunted: '190,230,200', cloud: '255,255,255', lava: '255,200,160', neon: '170,230,255' }[L.material] || '235,240,245';
            const env = (u, v) => Math.max(0, Math.sin(Math.PI * clamp(u, 0, 1))) * Math.sin(Math.PI * v);   // fades out toward every edge
            ctx.lineCap = 'round';
            for (const r of inst.ribbons) {
                // a soft curling ribbon of moving water / air, faded at both ends
                const x0 = inst.x + r.u * inst.w, y0 = inst.y + r.v * inst.h, n = 14;
                for (let i = 0; i < n; i++) {
                    const k0 = i / n, k1 = (i + 1) / n;
                    const xa = x0 - inst.dir * r.len * k0, xb = x0 - inst.dir * r.len * k1;
                    const ya = y0 + Math.sin(inst.t * 0.05 + r.ph + k0 * 4) * r.amp, yb = y0 + Math.sin(inst.t * 0.05 + r.ph + k1 * 4) * r.amp;
                    const a = 0.32 * Math.sin(Math.PI * k0) * env((xa - inst.x) / inst.w, r.v);
                    if (a < 0.01) continue;
                    ctx.strokeStyle = `rgba(${look},${a})`; ctx.lineWidth = 1.2 + 1.6 * Math.sin(Math.PI * k0);
                    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
                }
            }
            for (const m of inst.motes) {
                const x = inst.x + m.u * inst.w, y = inst.y + m.v * inst.h + Math.sin(m.ph) * 4, a = 0.55 * env(m.u, m.v);
                if (a < 0.02) continue;
                if (L.material === 'ocean') { ctx.strokeStyle = `rgba(${look},${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, m.s + 1, 0, TAU); ctx.stroke(); }
                else { ctx.fillStyle = `rgba(${look},${a})`; ctx.beginPath(); ctx.ellipse(x, y, m.s * 1.8, m.s * 0.7, Math.sin(m.ph) * 0.4, 0, TAU); ctx.fill(); }
            }
        }
    };

    // 15. Bubble column: a gentle lift up through the column
    K.bubbleColumn = {
        themes: { ocean: 3, candy: 2, magic: 1 },
        place(L) { const s = spotOnTop(L, 30, 340); return s ? { x: s.x, y: s.y, h: 340, bubbles: [] } : null; },
        step(inst, L, g) {
            if (R() < 0.6) inst.bubbles.push({ x: inst.x + RND(-18, 18), y: inst.y, r: RND(2, 5), ph: R() * TAU });
            for (const b of inst.bubbles) { b.y -= 2.4; b.ph += 0.2; }
            inst.bubbles = inst.bubbles.filter(b => b.y > inst.y - inst.h);
            const col = { x: inst.x - 28, y: inst.y - inst.h, w: 56, h: inst.h };
            for (const p of alive(g)) if (inBox(p, col)) { douse(g, p); p.velocity.y = Math.max(-6.5, p.velocity.y - 0.9); p.grounded = false; }
        },
        back(ctx, inst) {
            const gr = ctx.createLinearGradient(inst.x - 30, 0, inst.x + 30, 0); gr.addColorStop(0, 'rgba(180,230,255,0)'); gr.addColorStop(0.5, 'rgba(180,230,255,0.12)'); gr.addColorStop(1, 'rgba(180,230,255,0)');
            ctx.fillStyle = gr;
            for (let k = 0; k < 8; k++) { ctx.globalAlpha = 1 - k / 8; ctx.fillRect(inst.x - 30, inst.y - inst.h * (k + 1) / 8, 60, inst.h / 8 + 1); }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 1; for (const b of inst.bubbles) { ctx.beginPath(); ctx.arc(b.x + Math.sin(b.ph) * 3, b.y, b.r, 0, TAU); ctx.stroke(); }
            ctx.fillStyle = '#4a6a7a'; ctx.beginPath(); ctx.ellipse(inst.x, inst.y, 16, 4, 0, Math.PI, 0); ctx.fill();
        }
    };

    // 16. Quicksand: the longer you stand in it the deeper you sink; jump to get free
    K.quicksand = {
        themes: { dirt: 3, candy: 1, haunted: 1 },
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
        themes: { cloud: 4, dirt: 1, ice: 1, xmas: 1 },
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
        themes: { neon: 3, cloud: 2, stone: 1 },
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

    // 19. Tornado: a storm deck darkens over the arena and a funnel reaches down out of it, touches down and
    // wanders the floor. Everything near is pulled toward it (the closer, the harder: the pull adds to the
    // fighter's VELOCITY every frame) and lifted; only whoever is caught in the narrow core is hurt, and spat out.
    // At the end the funnel narrows to a rope and is drawn back up into the cloud. In the ocean it is a waterspout.
    K.tornado = {
        themes: { cloud: 3, dirt: 2, ocean: 2, stone: 0.6 },
        CB: 36, CORE: 20,
        place(L) {
            if (!claim(L, { x: -20, y: -20, w: 1, h: 1 })) return null;
            return { x: L.width / 2, dir: 1, k: 0, deck: 0, t: 0,
                debris: Array.from({ length: 56 }, () => ({ a: R() * TAU, v: R(), sp: 0.5 + R(), r: 0.5 + R() * 0.8, s: 1.6 + R() * 3.4, kind: (R() * 3) | 0 })) };
        },
        D: { idle: () => RND(600, 1100), warn: () => 170, active: () => 420, cool: () => 100 },
        look(L) {
            return ({ ocean: { body: '165,208,232', dark: '38,58,78', rock: '#e6f6ff', leaf: '#8fd0ee', water: true },
                cloud: { body: '226,228,238', dark: '62,68,86', rock: '#ffffff', leaf: '#cfd8e8' },
                stone: { body: '170,160,150', dark: '58,58,66', rock: '#6b625a', leaf: '#8a8a8a' } })[L.material]
                || { body: '178,154,122', dark: '66,66,76', rock: '#6d5a48', leaf: '#7cb342' };
        },
        // funnel width at v (0 at the cloud, 1 at the tip): a trumpet that flares up into the cloud
        radius(v, k) { return (13 + 150 * Math.pow(1 - v, 2.4)) * (0.45 + 0.55 * Math.min(1, k * 1.4)); },
        axisX(inst, v) { return inst.x - inst.dir * 46 * (1 - v) + Math.sin(inst.t * 0.045 + v * 3.4) * 20 * (0.3 + v); },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), fy = floorY(L), cb = this.CB;
            inst.t++;
            if (ph === 'warn' && inst.enter) { inst.x = RND(260, L.width - 260); inst.dir = R() < 0.5 ? -1 : 1; }
            const kt = ph === 'warn' ? prog(inst, 170) : ph === 'active' ? 1 : ph === 'cool' ? inst.left / 100 : 0;
            inst.k += (kt - inst.k) * (ph === 'cool' ? 0.1 : 0.07); if (inst.k < 0.005) inst.k = 0;
            inst.deck += ((ph === 'idle' ? 0 : 1) - inst.deck) * 0.04; if (inst.deck < 0.01) inst.deck = 0;
            const yb = cb + (fy - cb) * inst.k;
            if (ph === 'warn') {
                const k = prog(inst, 170);
                // the air starts to move toward the spot, dust lifts off the floor, the ground trembles
                if (R() < 0.35 + k * 0.5) { const sx = inst.x + (R() < 0.5 ? -1 : 1) * RND(160, 520); g.fx.add({ type: 'puff', x: sx, y: fy - RND(8, 220), vx: Math.sign(inst.x - sx) * RND(3, 6) * (0.4 + k), vy: -0.1, life: 36, color: '235,235,235', size: 1.3, grow: 0, alpha: 0.5 }); }
                if (k > 0.5 && R() < 0.6) g.fx.swirl(inst.x, fy - 4, { shape: 'dot', color: this.look(L).body, rise: 20 + k * 90, spin: 6, r0: 60 - k * 30, r1: 8, size: 2, life: 30 });
                if (inst.t % 12 === 0) tremor(g, inst.x, fy, 0.02 + k * 0.05);
            }
            if (ph === 'active') {
                inst.x += inst.dir * 1.25 + Math.sin(inst.t * 0.02) * 0.3;
                if (inst.x < 150 || inst.x > L.width - 150) inst.dir *= -1;
                if (inst.t % 14 === 0) tremor(g, inst.x, fy, 0.04);
            }
            if (inst.k > 0.85 && R() < 0.5) {
                g.fx.dust(inst.x + RND(-40, 40), fy, 1, 20, this.look(L).body);
                if (R() < 0.25) g.fx.add({ type: 'chunk', x: inst.x + RND(-30, 30), y: fy - 3, vx: RND(-5, 5), vy: -RND(2, 6), life: 40, color: this.look(L).rock, size: 2 + R() * 3, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 });
            }
            if (inst.k <= 0.5 || ph === 'warn') return;
            const power = Math.min(1, (inst.k - 0.5) * 2);
            // the wind bends shots too (more for light ones): toward the funnel and up the column
            for (const pr of g.projectiles) {
                if (!pr.active || pr.y < cb - 20 || pr.y > yb + 70) continue;
                const v = clamp((pr.y - cb) / Math.max(1, yb - cb), 0, 1), dx = this.axisX(inst, v) - pr.x, d = Math.abs(dx), rad = this.radius(v, inst.k), reach = (240 + rad * 1.1) * 2;
                if (d > reach) continue;
                const f = 1 - d / reach;
                bend(pr, Math.sign(dx) * 8 * f * f * power, d < rad + 30 ? -2 * f * power : 0);
            }
            for (const p of alive(g)) {
                if (p.isBird || p.onCloud) continue;
                const pcx = p.x + p.width / 2, pcy = p.y + p.height / 2;
                if (pcy < cb - 20 || pcy > yb + 70) continue;
                const v = clamp((pcy - cb) / Math.max(1, yb - cb), 0, 1), dx = this.axisX(inst, v) - pcx, d = Math.abs(dx), rad = this.radius(v, inst.k);
                const reach = (240 + rad * 1.1) * 6;   // triple the previous (2x) reach
                if (d > reach) continue;
                // the closer, the stronger (squared falloff): a change in velocity, so it builds up and carries on
                const f = 1 - d / reach, a = 2.1 * f * f * power;   // and twice the pull
                p.velocity.x = clamp(p.velocity.x + Math.sign(dx) * a * Math.min(1, d / 16), -17, 17);
                if (d < rad + 30) { const lf = 1 - d / (rad + 30); p.velocity.y = Math.max(-9, p.velocity.y - 0.72 * lf * power); p.grounded = false; }
                else if (f > 0.2 && p.grounded) p.velocity.y -= 0.3 * f;   // the wind peels you off the floor
                // only the narrow core hurts, and it throws you out the side
                if (d < this.CORE + rad * 0.3 && pcy > cb + 40) {
                    if (hurt(g, inst, p, 8, (dx > 0 ? 1 : -1) * 8 * (R() < 0.5 ? -1 : 1), -10, { every: 50 })) g.fx.dust(pcx, pcy, 6, 30, this.look(L).body);
                }
            }
        },
        puller(inst, L) { return inst.k > 0.5 && inst.phase !== 'warn' ? { x: inst.x, y: floorY(L) - 80, rad: 1680, core: 60, kind: 'tornado' } : null; },
        // soft cauliflower puff sprites (grey storm, mid tone, dust, light), cached per colour
        puff(rgb) {
            const cache = this._puffs || (this._puffs = {});
            if (cache[rgb] !== undefined) return cache[rgb];
            cache[rgb] = false;
            if (typeof document === 'undefined') return false;
            const c = document.createElement('canvas'); c.width = c.height = 96;
            const x = c.getContext('2d');
            if (!x || !x.createRadialGradient) return false;
            const blobs = [[0, 0, 34], [-17, -9, 24], [15, -11, 24], [-14, 13, 22], [16, 12, 22], [0, -20, 18], [0, 21, 18], [-25, 2, 15], [25, 1, 15]];
            for (const [bx, by, br] of blobs) {
                const g = x.createRadialGradient(48 + bx, 48 + by, 1, 48 + bx, 48 + by, br);
                g.addColorStop(0, `rgba(${rgb},0.85)`); g.addColorStop(0.55, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
                x.fillStyle = g; x.fillRect(48 + bx - br, 48 + by - br, br * 2, br * 2);
            }
            return (cache[rgb] = c);
        },
        front(ctx, inst, L) {
            const k = inst.k;
            const lk = this.look(L), t = inst.t, fy = floorY(L), cb = this.CB, yb = cb + (fy - cb) * k;
            if (inst.deck > 0.02) this.deckDraw(ctx, inst, lk, cb, t);
            if (k < 0.02) return;
            const N = 40, pts = [];
            for (let i = 0; i <= N; i++) { const v = i / N; pts.push({ v, x: this.axisX(inst, v), y: cb + (yb - cb) * v, r: this.radius(v, k) }); }
            const at = (v) => { const f = clamp(v, 0, 1) * N, i = Math.min(N - 1, f | 0), u = f - i, A = pts[i], Bq = pts[i + 1]; return { x: A.x + (Bq.x - A.x) * u, y: A.y + (Bq.y - A.y) * u, r: A.r + (Bq.r - A.r) * u }; };
            const dark = this.puff(lk.dark), mid = this.puff(lk.dark.split(',').map((v, j) => Math.round((+v + +lk.body.split(',')[j]) / 2)).join(',')), dust = this.puff(lk.body), light = this.puff('236,232,222');
            if (!dark || !dust) { return; }
            if (!inst.puffs) inst.puffs = Array.from({ length: 380 }, (_, i) => ({ v0: Math.random(), a0: Math.random() * TAU, sp: 0.7 + Math.random() * 0.6, rr: 0.55 + Math.random() * 0.6, sz: 0.7 + Math.random() * 0.8, tone: Math.random() }));
            const draw = (back) => {
                for (const q of inst.puffs) {
                    // puffs rise up the funnel from the tip into the cloud, spinning faster near the tip
                    const v = 1 - ((1 - q.v0) + t * 0.0016 * q.sp) % 1;
                    if (v > k + 0.02) continue;
                    const c = at(v), th = q.a0 + t * (0.1 + 0.38 * v * v) * q.sp, depth = Math.sin(th);
                    if ((depth < 0) !== back) continue;
                    const rx = Math.cos(th) * c.r * q.rr, size = (13 + c.r * 0.62) * q.sz;
                    if (size < 5) continue;
                    const spr = v < 0.22 ? (q.tone < 0.7 ? dark : mid) : v < 0.6 ? (q.tone < 0.35 ? dark : q.tone < 0.8 ? mid : dust) : (q.tone < 0.5 ? dust : q.tone < 0.9 ? mid : light);
                    ctx.globalAlpha = (back ? 0.2 : 0.3) * (0.55 + 0.45 * Math.min(1, k * 1.5)) * (v > 0.9 ? 0.6 : 1);
                    ctx.drawImage(spr, c.x + rx - size, c.y + depth * c.r * 0.12 - size * 0.7, size * 2, size * 1.4);
                }
            };
            ctx.save();
            draw(true);
            // the dark heart of the funnel, then the near side of the swirl over it
            ctx.globalAlpha = 1;
            for (let i = 2; i <= N; i += 2) { const q = pts[i]; if (q.r < 4) continue; ctx.globalAlpha = 0.18 * Math.min(1, k * 1.5); ctx.drawImage(dark, q.x - q.r * 0.75, q.y - q.r * 0.5, q.r * 1.5, q.r + 14); }
            draw(false);
            ctx.globalAlpha = 1;
            // debris flung round it: planks, rocks, shrubs, each with a streak behind it
            for (const d of inst.debris) {
                const v = 1 - ((d.v + t * 0.003 * d.sp) % 1);
                if (v > k + 0.02) continue;
                const c = at(v), a = d.a + t * (0.12 + 0.34 * v * v) * d.sp, ex = c.x + Math.cos(a) * c.r * (0.7 + d.r * 0.55), ey = c.y + Math.sin(a) * c.r * 0.1, sg = Math.sign(-Math.sin(a)) || 1;
                ctx.save(); ctx.translate(ex, ey);
                ctx.strokeStyle = `rgba(${lk.body},0.35)`; ctx.lineWidth = d.s * 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sg * (8 + c.r * 0.35), 0); ctx.stroke();
                ctx.rotate(a * 3);
                if (lk.water) { ctx.fillStyle = 'rgba(240,250,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, d.s * 0.8, 0, TAU); ctx.fill(); }
                else if (d.kind === 0) { ctx.fillStyle = lk.rock; ctx.fillRect(-d.s * 1.3, -d.s * 0.6, d.s * 2.6, d.s * 1.2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-d.s * 1.3, 0, d.s * 2.6, d.s * 0.6); }
                else if (d.kind === 1) { ctx.fillStyle = lk.leaf; ctx.beginPath(); ctx.ellipse(0, 0, d.s * 1.4, d.s * 0.6, 0, 0, TAU); ctx.fill(); }
                else { ctx.fillStyle = '#5b4632'; ctx.fillRect(-d.s * 2.2, -d.s * 0.35, d.s * 4.4, d.s * 0.7); }
                ctx.restore();
            }
            // the ground: a wide churning skirt of dust and thrown dirt around the base
            if (k > 0.55) {
                const ground = Math.min(1, (k - 0.55) / 0.45), q = pts[N];
                for (let j = 0; j < 16; j++) {
                    const a = j * 2.4 + t * (0.09 + (j % 3) * 0.03), sw = 40 + (j % 5) * 26, px = q.x + Math.cos(a) * sw * ground, py = fy - 8 - (j % 4) * 7 + Math.sin(a) * 4, sz = (34 + (j % 4) * 14) * ground;
                    ctx.globalAlpha = 0.34 * ground; ctx.drawImage(j % 3 ? dust : mid, px - sz, py - sz * 0.45, sz * 2, sz * 0.9);
                }
                // dust drawn up into the funnel foot
                for (let j = 0; j < 8; j++) { const sz = (28 + j * 5) * ground, py = fy - 14 - j * 22; ctx.globalAlpha = 0.3 * ground; ctx.drawImage(dust, q.x + Math.sin(t * 0.07 + j) * (10 + j * 2) - sz, py - sz * 0.6, sz * 2, sz * 1.2); }
            }
            ctx.restore();
        },
        deckDraw(ctx, inst, lk, cb, t) {
            const a = inst.deck, x = inst.x - inst.dir * 40, dark = this.puff(lk.dark), mid = this.puff('104,108,122');
            if (!dark) return;
            ctx.save();
            // a rolling wall cloud: layers of big billows, ragged underneath, thinning out at the sides
            for (let i = 0; i < 34; i++) {
                const u = (i * 0.618034) % 1, w = (u - 0.5) * 700, row = i % 4, edge = Math.max(0.15, 1 - Math.abs(w) / 380);
                const sz = 70 + ((i * 37) % 31) * 2 + row * 10, cx = x + w + Math.sin(t * 0.01 + i) * 12, cy = cb - 30 + row * 16 + Math.abs(w) * 0.05 + Math.sin(i * 2 + t * 0.013) * 4;
                ctx.globalAlpha = Math.min(1, 0.7 * a * edge);
                ctx.drawImage(row < 2 ? dark : mid, cx - sz, cy - sz * 0.55, sz * 2, sz * 1.1);
            }
            ctx.restore();
        },
        danger(inst, L) {
            if (inst.k < 0.3) return [];
            const fy = floorY(L), x = inst.x;
            return [{ x: x - 80, y: fy - 360, w: 160, h: 362, soon: inst.phase === 'warn' ? inst.left : 0, kind: 'pull' }];
        }
    };

    // =====================================================================================
    //  FIRE, ELECTRICITY, LIGHT, SKY
    // =====================================================================================

    // 20. Flame jet: a nozzle on a ledge coughs smoke and embers, then breathes fire across it
    K.flameJet = {
        themes: { lava: 3, stone: 3, haunted: 1, neon: 1 },
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
        themes: { neon: 4, magic: 1, stone: 1 },
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
        themes: { neon: 4, magic: 1 },
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
                    if (p.touchesCapsule(inst.x, inst.y, inst.x + dx * inst.len, inst.y + dy * inst.len, 22)) hurt(g, inst, p, 6, dx * 4, -5, { every: 12, status: { burn: 30 } });
                }
                if (R() < 0.5) g.fx.sparks(inst.x + Math.cos(inst.a) * inst.len, inst.y + Math.sin(inst.a) * inst.len, '255,80,120', 2, -Math.PI / 2, 2, 3);
            }
        },
        back(ctx, inst) { ctx.fillStyle = '#16181f'; ctx.fillRect(inst.x - 4, -80, 8, 84); ctx.fillStyle = '#20222c'; ctx.fillRect(inst.x - 16, 0, 32, 20); ctx.fillStyle = '#ff4081'; ctx.beginPath(); ctx.arc(inst.x, 20, 6, 0, TAU); ctx.fill(); glow(ctx, inst.x, 20, 18, '255,60,120', 0.5); },
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
        themes: { cloud: 4, neon: 1, haunted: 2, magic: 1 },
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
                const boltHit = (p) => (inst.pts || []).some((pt, i, pts) => i > 0 && p.touchesCapsule(pts[i - 1][0], pts[i - 1][1], pt[0], pt[1], 7));
                for (const p of alive(g)) if (boltHit(p)) hurt(g, inst, p, 18, (p.x + 15 < inst.x ? -1 : 1) * 8, -8, { every: 40, status: { stun: 40 } });
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
        themes: { lava: 3, magic: 3, cloud: 1 },
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
                    for (const p of alive(g)) if (p.touchesCircle(r.x, r.gy - 10, 80)) hurt(g, r, p, 15, Math.sign(p.x + 15 - r.x || 1) * 10, -9, { every: 60, status: { burn: 60 } });
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
        themes: { stone: 4, haunted: 3, lava: 1 },
        place(L) {
            const s = spotOnTop(L, 110, 230);
            if (!s) return null;
            const top = ceilingAbove(L, s.x - 10, s.x + 10, s.y - 240), len = (s.y - 34) - top;
            if (len < 150) return null;
            return { px: s.x, py: top, len, amp: Math.min(0.95, Math.asin(Math.min(1, 210 / len))), T: Math.round(150 * Math.sqrt(len / 190)), a: 0, t: R() * 200 };
        },
        step(inst, L, g) {
            inst.t++;
            inst.a = Math.sin(inst.t * TAU / inst.T) * inst.amp;
            const w = Math.cos(inst.t * TAU / inst.T) * inst.amp * TAU / inst.T;
            const bx = inst.px + Math.sin(inst.a) * inst.len, by = inst.py + Math.cos(inst.a) * inst.len;
            inst.bx = bx; inst.by = by;
            for (const p of alive(g)) if (p.touchesCircle(bx, by, 40)) hurt(g, inst, p, 16, Math.sign(w || 1) * 12, -7, { every: 40 });
            if (Math.abs(inst.a) < 0.05 && g.frameCount % 2 === 0) g.fx.streak(bx - 20, by, bx + 20, by, 2, '255,255,255', 8);
        },
        back(ctx, inst) {
            ctx.fillStyle = '#3a3a40'; ctx.fillRect(inst.px - 16, inst.py - 6, 32, 12); ctx.fillStyle = '#6a6a72'; ctx.beginPath(); ctx.arc(inst.px, inst.py + 4, 5, 0, TAU); ctx.fill();
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
        // where the blade is now and will be over the next 0.4s: the bots can cross while it is away on the far side
        danger(inst) {
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (let k = 0; k <= 24; k += 4) {
                const a = Math.sin((inst.t + k) * TAU / inst.T) * inst.amp, bx = inst.px + Math.sin(a) * inst.len, by = inst.py + Math.cos(a) * inst.len;
                x0 = Math.min(x0, bx - 50); x1 = Math.max(x1, bx + 50); y0 = Math.min(y0, by - 50); y1 = Math.max(y1, by + 50);
            }
            return [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0, soon: 0, kind: 'zone' }];
        }
    };

    // 26. Boulder: pebbles trickle and the ground rumbles, then a boulder rolls across the floor
    K.rollingBoulder = {
        themes: { stone: 3, dirt: 2, lava: 1 },
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
                for (const q of alive(g)) if (q.touchesCircle(inst.x, p.y - r, r + 12)) hurt(g, inst, q, 14, inst.dir * 13, -8, { every: 40 });
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
        themes: { haunted: 4, stone: 2, xmas: 2 },
        place(L) {
            const s = spotOnTop(L, 60, 360);
            return s ? { x: s.x, top: ceilingAbove(L, s.x - 10, s.x + 10, s.y - 330), hangY: s.y - 300, y: s.y - 300, gy: s.y, vy: 0, state: 'hang', t: RND(200, 500), sw: 0 } : null;
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
        themes: { stone: 3, haunted: 2, lava: 2, ice: 1 },
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

    // 29. Press: a slab as wide as the platform below it hangs from the ceiling on two pistons, spikes along its
    // underside. Long before it drops the beacons start flashing, the pistons hiss and the slab shivers and sinks a
    // little while the platform below lights up in hazard stripes. Then it slams down: 35 damage to anything under it.
    K.press = {
        themes: { neon: 3, stone: 3, lava: 2, haunted: 1, candy: 1, ice: 1, xmas: 1 },
        H: 44, SP: 22, GAP: 230,
        place(L) {
            const cands = L.platforms.filter(p => p.active && p.type === 'static' && !p.motion && !p.feature && !p.featureTag && p.width >= 300 && p.width <= 640 && p.y >= 300);
            for (const p of cands.sort(() => R() - 0.5)) {
                const box = { x: p.x, y: p.y - this.GAP - this.H - this.SP - 4, w: p.width, h: this.GAP + this.H + this.SP + 4 };
                if (L.platforms.some(q => q !== p && q.active && overlap(box, { x: q.x, y: q.y, w: q.width, h: q.height }))) continue;
                if (!claim(L, { x: p.x, y: box.y - 30, w: p.width, h: box.h + 36 })) continue;
                const rest = p.y - this.GAP - this.SP - this.H;          // top of the slab at rest
                const inst = { plat: p, rest, low: p.y - 5 - this.SP - this.H, vy: 0, t: 0, shake: 0 };
                inst.anchor = ceilingAbove(L, p.x + 20, p.x + p.width - 20, rest - 4);
                inst.block = makePlat(L, inst, p.x, rest, p.width, this.H);
                return inst;
            }
            return null;
        },
        D: { idle: () => RND(260, 460), warn: () => 130, active: () => 60, cool: () => 110 },
        skin(L) {
            return ({
                neon:    { a: '#3c4150', b: '#161925', edge: '#00e5ff', glow: '0,229,255', spike: '#b8c4d0', tip: '#ff2d95', hatch: '#00e5ff' },
                stone:   { a: '#8e8e96', b: '#4a4a52', edge: '#c9a227', glow: '255,200,90', spike: '#cfd8dc', tip: '#eceff1', hatch: '#ffca28' },
                lava:    { a: '#3a2a28', b: '#150c0b', edge: '#ff7a2a', glow: '255,120,40', spike: '#2b1a1a', tip: '#ff6a1a', hatch: '#ff8a3a' },
                haunted: { a: '#4a3f4f', b: '#221b27', edge: '#9d7cff', glow: '150,120,255', spike: '#e7e0cf', tip: '#ffffff', hatch: '#b39dff' },
                candy:   { a: '#ecb86e', b: '#b97a3a', edge: '#ff6fa8', glow: '255,140,190', spike: '#ffffff', tip: '#ff4f8f', hatch: '#ff6fa8' },
                ice:     { a: '#d4f0fc', b: '#6fb3d8', edge: '#ffffff', glow: '190,235,255', spike: '#eefaff', tip: '#ffffff', hatch: '#8fd8ff' },
                xmas:    { a: '#a8683c', b: '#6b3a1e', edge: '#ffffff', glow: '255,230,200', spike: '#ffffff', tip: '#e53935', hatch: '#e53935' }
            })[L.material] || { a: '#6a6e78', b: '#2a2e36', edge: '#ffca28', glow: '255,200,90', spike: '#cfd8dc', tip: '#ffffff', hatch: '#ffca28' };
        },
        slabBottom(inst) { return inst.block.y + this.H + this.SP; },
        hit(inst, g, moving) {
            const b = inst.block, box = { x: b.x, y: b.y, w: b.width, h: this.H + this.SP };
            for (const p of alive(g)) {
                if (!inBox(p, box) || (inst.hitSet && inst.hitSet.has(p))) continue;
                (inst.hitSet || (inst.hitSet = new Set())).add(p);
                const side = p.x + p.width / 2 < b.x + b.width / 2 ? -1 : 1;
                hurt(g, inst, p, 35, side * 5, -6, { every: 90, exempt: true });
                p.squashed = 40;
                g.fx.sparks(p.x + p.width / 2, p.y + p.height * 0.4, '255,210,180', 10, undefined, 0, 6);
            }
        },
        step(inst, L, g) {
            const ph = cycle(inst, this.D), b = inst.block, rest = inst.rest, low = inst.low, cx = b.x + b.width / 2;
            if (ph === 'idle') { b.active = true; b.y += (rest - b.y) * 0.2; inst.vy = 0; inst.hitSet = null; if (R() < 0.02) g.fx.add({ type: 'puff', x: b.x + RND(6, b.width - 6), y: b.y + this.H + this.SP, vx: 0, vy: 0.4, life: 30, color: '170,160,150', size: 1.2, grow: 0, alpha: 0.4 }); }
            else if (ph === 'warn') {
                const k = prog(inst, 130);
                b.active = true;
                // it shivers on its pistons and sinks a little, faster as the time runs out
                const shake = Math.sin(inst.t * (0.9 + k * 1.6)) * (0.4 + k * 2.2);
                b.y = rest + k * k * 26 + shake;
                if (R() < 0.15 + k * 0.5) g.fx.add({ type: 'puff', x: b.x + RND(6, b.width - 6), y: b.y + this.H + this.SP, vx: RND(-0.3, 0.3), vy: 0.9, life: 40, color: '170,160,150', size: 1.6, grow: 0.02, alpha: 0.6 });
                if (R() < 0.1 + k * 0.4) g.fx.add({ type: 'puff', x: b.x + (R() < 0.5 ? 8 : b.width - 8), y: rest - 6, vx: RND(-0.5, 0.5), vy: -RND(0.8, 1.8), life: 34, color: '235,240,245', size: 3, grow: 0.25, alpha: 0.5 });   // piston steam
                if (inst.t % 8 === 0) tremor(g, cx, b.y, 0.01 + k * 0.04);
            } else if (ph === 'active') {
                if (inst.enter) { b.active = false; inst.vy = 2; inst.hitSet = null; }
                if (b.y < low) {
                    inst.vy = Math.min(32, inst.vy + 2.4); b.y = Math.min(low, b.y + inst.vy);
                    this.hit(inst, g, true);
                    if (b.y >= low) {
                        inst.vy = 0; this.hit(inst, g, false);
                        tremor(g, cx, low, 0.35); g.fx.dust(cx, inst.plat.y, 22, b.width * 0.9, DUST_TINT[L.material]); g.fx.debris(cx, inst.plat.y, '#555', 10, 7); g.fx.flashAt(cx, inst.plat.y - 4, '255,230,190', 120, 8); AudioSys.playHit && AudioSys.playHit(); AudioSys.playExplosion && AudioSys.playExplosion();
                    }
                }
            } else {   // cool: it hauls itself back up on the pistons
                b.y += (rest - b.y) * 0.05 - 0.3; if (b.y <= rest + 0.5) { b.y = rest; b.active = true; }
            }
            // the slab is a ledge only while it is up at rest, where nobody can reach it
            if (ph !== 'idle' && ph !== 'warn' && b.y > rest + 30) b.active = false;
        },
        back(ctx, inst, L) {
            const b = inst.block, sk = this.skin(L), top = inst.anchor, w = b.width;
            // housing on the ceiling and two hydraulic pistons
            ctx.fillStyle = '#23262e'; ctx.fillRect(b.x + 6, top - 6, w - 12, 18);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(b.x + 6, top - 6, w - 12, 3);
            for (const px of [b.x + 34, b.x + w - 34]) {
                const len = b.y - (top + 12);
                ctx.fillStyle = '#3a3f4a'; ctx.fillRect(px - 15, top + 10, 30, 14);
                ctx.fillStyle = '#5a606c'; ctx.fillRect(px - 11, top + 24, 22, Math.max(2, len * 0.5));
                ctx.fillStyle = '#9aa3b2'; ctx.fillRect(px - 6, top + 24 + len * 0.5, 12, Math.max(2, len * 0.5 + 2));
                ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(px - 5, top + 24 + len * 0.5, 3, Math.max(2, len * 0.5));
            }
        },
        front(ctx, inst, L, g) {
            const b = inst.block, p = inst.plat, sk = this.skin(L), w = b.width, ph = inst.phase, t = inst.t;
            const warn = ph === 'warn' ? prog(inst, 130) : ph === 'active' ? 1 : 0;
            // the footprint on the platform lights up in hazard stripes, and the air under the slab flushes
            if (warn > 0) {
                const pulse = 0.5 + 0.5 * Math.sin(t * (0.2 + warn * 0.7));
                ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y - 6, w, 6); ctx.clip();
                ctx.fillStyle = `rgba(${sk.glow},${(0.16 + 0.34 * pulse) * Math.min(1, warn * 3)})`; ctx.fillRect(p.x, p.y - 6, w, 6);
                ctx.strokeStyle = sk.hatch; ctx.globalAlpha = Math.min(1, warn * 3) * (0.5 + 0.5 * pulse); ctx.lineWidth = 3;
                for (let x = p.x - 12 + ((t * 0.8) % 16); x < p.x + w + 6; x += 16) { ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x + 8, p.y - 6); ctx.stroke(); }
                ctx.restore();
                const gr = ctx.createLinearGradient(0, p.y - this.GAP, 0, p.y); gr.addColorStop(0, `rgba(${sk.glow},0)`); gr.addColorStop(1, `rgba(${sk.glow},${0.06 + 0.1 * pulse * warn})`);
                ctx.fillStyle = gr; ctx.fillRect(p.x, p.y - this.GAP, w, this.GAP);
            }
            // slab
            const gr = ctx.createLinearGradient(0, b.y, 0, b.y + this.H); gr.addColorStop(0, sk.a); gr.addColorStop(1, sk.b);
            ctx.fillStyle = gr; ctx.fillRect(b.x, b.y, w, this.H);
            ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(b.x, b.y, w, 3);
            ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, w, this.H);
            // plating: rivets and seams, themed
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = b.x + 40; x < b.x + w - 20; x += 80) ctx.fillRect(x, b.y + 4, 2, this.H - 8);
            ctx.fillStyle = sk.edge; for (const rx of [b.x + 8, b.x + w - 8]) for (const ry of [b.y + 9, b.y + this.H - 9]) { ctx.beginPath(); ctx.arc(rx, ry, 2.4, 0, TAU); ctx.fill(); }
            if (L.material === 'lava') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,140,50,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = b.x + 14; x < b.x + w - 14; x += 46) { ctx.moveTo(x, b.y + 4); ctx.lineTo(x + 8, b.y + 22); ctx.lineTo(x + 2, b.y + 38); } ctx.stroke(); ctx.restore(); }
            if (L.material === 'candy') { ctx.strokeStyle = 'rgba(120,70,20,0.45)'; ctx.lineWidth = 1.5; for (let x = b.x + 18; x < b.x + w; x += 22) { ctx.beginPath(); ctx.moveTo(x, b.y + 3); ctx.lineTo(x, b.y + this.H - 3); ctx.stroke(); } for (let y = b.y + 14; y < b.y + this.H; y += 14) { ctx.beginPath(); ctx.moveTo(b.x + 3, y); ctx.lineTo(b.x + w - 3, y); ctx.stroke(); } }
            // beacons at both ends: they flash, faster and faster, from the first moment of the warning
            for (const bx of [b.x + 20, b.x + w - 20]) {
                const rate = ph === 'warn' ? 0.15 + warn * 0.9 : 0.03, on = Math.sin(t * rate * 2) > (ph === 'idle' ? 0.8 : -0.2);
                ctx.fillStyle = on ? '#ff3d2e' : '#4a1410'; ctx.beginPath(); ctx.arc(bx, b.y - 5, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(bx - 6, b.y - 5, 12, 5);
                if (on) glow(ctx, bx, b.y - 6, 40, '255,70,50', 0.6);
            }
            // spikes underneath
            const sy = b.y + this.H, n = Math.max(6, Math.round(w / 24)), sw = w / n;
            for (let i = 0; i < n; i++) {
                const x0 = b.x + i * sw;
                ctx.fillStyle = sk.spike; ctx.beginPath(); ctx.moveTo(x0 + 1.5, sy); ctx.lineTo(x0 + sw / 2, sy + this.SP); ctx.lineTo(x0 + sw - 1.5, sy); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(x0 + sw / 2, sy); ctx.lineTo(x0 + sw / 2, sy + this.SP); ctx.lineTo(x0 + sw - 1.5, sy); ctx.closePath(); ctx.fill();
                if (warn > 0.4) glow(ctx, x0 + sw / 2, sy + this.SP, 8, sk.glow, 0.5 * warn);
                ctx.fillStyle = sk.tip; ctx.fillRect(x0 + sw / 2 - 1, sy + this.SP - 3, 2, 3);
            }
        },
        danger(inst) {
            const b = inst.block, p = inst.plat, box = { x: p.x, y: b.y + this.H, w: b.width, h: Math.max(4, p.y - (b.y + this.H)) };
            return inst.phase === 'warn' ? [Object.assign(box, { soon: inst.left })] : inst.phase === 'active' && b.y < inst.low - 1 ? [Object.assign(box, { soon: 0 })] : [];
        }
    };

    // =====================================================================================
    //  MAGIC AND HELPERS
    // =====================================================================================

    // 30. Portals: step into one, come out of the other with your momentum
    K.portals = {
        themes: { magic: 4, neon: 2 },
        place(L) {
            // the two ends must be far apart, or the portal is pointless: across the arena, or far up and over
            for (let tries = 0; tries < 12; tries++) {
                const a = spotOnTop(L, 26, 90);
                if (!a) return null;
                const b = spotOnTop(L, 26, 90, (p) => { const far = Math.max(Math.abs(p.x - a.x), Math.abs(p.x + p.width - a.x)); return far > 800 || (far > 560 && Math.abs(p.y - a.y) > 280); });
                if (b && (Math.abs(b.x - a.x) > 760 || (Math.abs(b.x - a.x) > 540 && Math.abs(b.y - a.y) > 260))) return { a: { x: a.x, y: a.y - 40 }, b: { x: b.x, y: b.y - 40 }, t: 0 };
                L.featureUsed.pop(); if (b) L.featureUsed.pop();
            }
            return null;
        },
        // anything with a position can pass: fighters, shots (however fast: the Tear of God crosses it in a blink, so the
        // whole path of the last frame is checked, not just where it ended up), thrown things, weapons lying around, splashes
        inside: (o, x, y) => Math.abs(x - o.x) < 16 && Math.abs(y - o.y) < 34,
        crossed(o, x0, y0, x1, y1) {
            const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10));
            for (let i = 0; i <= n; i++) if (this.inside(o, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return true;
            return false;
        },
        step(inst, L, g) {
            inst.t++;
            const pairs = [[inst.a, inst.b], [inst.b, inst.a]];
            const pass = (obj, cx, cy, px, py, move, cd) => {
                if ((obj.portalCd || 0) > g.frameCount) return false;
                for (const [from, to] of pairs) if (this.crossed(from, px, py, cx, cy)) {
                    move(to.x - from.x, to.y - from.y); obj.portalCd = g.frameCount + (cd || 30); g.fx.ring(to.x, to.y, '190,140,255', 26, 2, 10); g.fx.ring(from.x, from.y, '190,140,255', 20, 2, 8);
                    return true;
                }
                return false;
            };
            for (const p of alive(g)) {
                if ((p.portalCd || 0) > g.frameCount) continue;
                const cx = p.x + p.width / 2, cy = p.y + p.height / 2, px = (p.prevX !== undefined ? p.prevX : p.x - p.velocity.x) + p.width / 2, py = (p.prevY !== undefined ? p.prevY : p.y - p.velocity.y) + p.height / 2;
                for (const [from, to] of pairs) {
                    if (this.crossed(from, px, py, cx, cy)) {
                        g.fx.swirl(from.x, from.y, { shape: 'star', color: '190,140,255', rise: 0, spin: 6, r0: 30, r1: 2, size: 3, life: 24 });
                        p.x = to.x - p.width / 2; p.y = to.y - p.height / 2 + 6; p.prevX = p.x; p.prevY = p.y; p.trail = [];
                        p.portalCd = g.frameCount + 45;
                        g.fx.ring(to.x, to.y, '190,140,255', 40, 3, 16);
                        break;
                    }
                }
            }
            for (const pr of g.projectiles) if (pr.active) pass(pr, pr.x, pr.y, pr.x - pr.vx, pr.y - pr.vy, (dx, dy) => { pr.x += dx; pr.y += dy; if (pr.prevX !== undefined) { pr.prevX += dx; pr.prevY += dy; } pr.hitSet = pr.spec.pierce ? new Set() : null; }, 2);   // shots may go through again right away, so a pair of facing portals can loop one for ever
            for (const w of g.weapons) if (w.active && !w.owner) pass(w, w.x + w.width / 2, w.y + w.height / 2, w.x + w.width / 2, w.prevY !== undefined ? w.prevY + w.height / 2 : w.y + w.height / 2, (dx, dy) => { w.x += dx; w.y += dy; w.prevY = w.y; w.landed = false; });
            for (const e of g.mechEnts || []) if (e.vx !== undefined && !e.stuck && e.x !== undefined) pass(e, e.x, e.y, e.x - e.vx, e.y - (e.vy || 0), (dx, dy) => { e.x += dx; e.y += dy; });
            const parts = g.fx.particles || [];
            for (const q of parts) if ((q.type === 'drop' || q.type === 'chunk' || q.type === 'puff' || q.type === 'spark' || q.type === 'feather' || q.type === 'flash') && q.x !== undefined) pass(q, q.x, q.y, q.x - (q.vx || 0), q.y - (q.vy || 0), (dx, dy) => { q.x += dx; q.y += dy; });
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
        themes: { magic: 4, cloud: 2, neon: 1 },
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
        themes: { dirt: 2, xmas: 3, ice: 2, ocean: 2, candy: 1 },
        place(L) { const s = spotOnTop(L, 40, 90); return s ? { x: s.x, y: s.y, t: 0, style: { ocean: 'coral', ice: 'spring', xmas: 'fire', candy: 'cocoa' }[L.material] || 'fire' } : null; },
        step(inst, L, g) {
            inst.t++;
            if (inst.style === 'fire' && R() < 0.5) g.fx.flame(inst.x + RND(-6, 6), inst.y - 6, RND(6, 10), RND(10, 20), 24);
            if (inst.style !== 'fire' && R() < 0.2) puff(g, inst.x + RND(-14, 14), inst.y - 4, { color: '240,245,255', size: 3, alpha: 0.35, life: 60 });
            const pickupBox = { x: inst.x - 46, y: inst.y - 6, w: 92, h: 12 };
            if (inst.style === 'coral' || inst.style === 'spring') for (const p of alive(g)) if (p.intersectsRect(pickupBox)) douse(g, p);
            for (const p of alive(g)) if (p.intersectsRect(pickupBox) && p.health < p.maxHealth) {
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
        themes: { dirt: 2, cloud: 3, stone: 1, xmas: 2 },
        place(L) {
            const S = solids(L).filter(p => p.y < floorY(L) - 80);
            const cands = [];
            for (const a of S) for (const b of S) { const dx = (b.x + b.width / 2) - (a.x + a.width / 2), dy = b.y - a.y; if (dx > 380 && dy > 40 && dy < 260) cands.push([a, b]); }
            if (!cands.length) return null;
            const [a, b] = cands[(R() * cands.length) | 0];
            const x0 = a.x + a.width / 2, y0 = a.y - 46, x1 = b.x + b.width / 2, y1 = b.y - 46;
            if (!claim(L, { x: Math.min(x0, x1), y: Math.min(y0, y1) - 6, w: Math.abs(x1 - x0), h: 4 })) return null;
            return { x0, y0, x1, y1, landings: [a, b], riders: new Map() };
        },
        // Stand under either end and push down to grab the handle; it carries you to the other end (either way).
        // Jump to let go early. Touching the rope does nothing.
        atEnd(inst, p, k) {
            const ex = k ? inst.x1 : inst.x0, ey = k ? inst.y1 : inst.y0, feet = p.y + p.height;
            return p.grounded && p.touchesCircle(ex, ey, 26) && feet - ey > 34 && feet - ey < 66;
        },
        step(inst, L, g) {
            const len = Math.hypot(inst.x1 - inst.x0, inst.y1 - inst.y0), ux = (inst.x1 - inst.x0) / len, uy = (inst.y1 - inst.y0) / len;
            inst.near = [false, false];
            for (const p of alive(g)) {
                let r = inst.riders.get(p);
                const inp = p.lastInput, down = !!(inp && inp.y > 0.5);
                if (!down) p.zipArmed = true;
                if (!r) {
                    if (p.isBird || p.onCloud || [...inst.riders.values()].some(o => o.end === 0) && [...inst.riders.values()].some(o => o.end === 1)) continue;
                    for (const k of [0, 1]) {
                        const landing = inst.landings && inst.landings[k];
                        if (inst.landings && (!landing || !landing.active || landing.collapse || landing.motion)) continue;
                        if (!this.atEnd(inst, p, k)) continue;
                        if (!p.isBot) inst.near[k] = true;
                        if (down && p.zipArmed && !(p.zipCd > g.frameCount)) {
                            if (p.isLaying) { p.y -= 30; p.height = 60; p.isLaying = false; }
                            r = { s: k ? len - 2 : 2, dir: k ? -1 : 1, v: 4.5, end: k };
                            inst.riders.set(p, r); p.zipArmed = false;
                            g.fx.sparks(k ? inst.x1 : inst.x0, k ? inst.y1 : inst.y0, '255,230,160', 5, undefined, 0, 2);
                            break;
                        }
                    }
                    if (!r) continue;
                }
                // going downhill speeds you up, uphill slows you (never below a walk)
                const slope = uy * r.dir;
                r.v = clamp(r.v + 0.12 + slope * 0.35, 4.5, 10);
                r.s += r.dir * r.v;
                const arrived = r.dir > 0 ? r.s >= len - 6 : r.s <= 6;
                if (p.velocity.y < -6 || arrived) {
                    inst.riders.delete(p); p.zipCd = g.frameCount + 20;
                    if (arrived) {
                        const ex = r.dir > 0 ? inst.x1 : inst.x0, ey = r.dir > 0 ? inst.y1 : inst.y0;
                        const end = r.dir > 0 ? 1 : 0, landing = inst.landings && inst.landings[end];
                        if (landing && landing.active && !landing.collapse && !landing.motion) {
                            p.x = clamp(ex - p.width / 2, landing.x, landing.x + landing.width - p.width);
                            p.y = landing.y - p.height; p.prevX = p.x; p.prevY = p.y;
                            p.velocity.x = ux * r.dir * 2; p.velocity.y = 0; p.grounded = true; p.ridePlat = landing;
                        } else if (inst.landings) {
                            // If an endpoint platform was destroyed during the ride, release upward
                            // instead of placing the rider underneath the cable over the pit.
                            p.x = ex - p.width / 2; p.y = ey - p.height; p.prevX = p.x; p.prevY = p.y;
                            p.velocity.x = ux * r.dir * 2; p.velocity.y = -7; p.grounded = false; p.ridePlat = null;
                        } else {
                            p.x = ex - p.width / 2; p.y = ey + 6; p.velocity.x = ux * r.dir * 2; p.velocity.y = 1;
                        }
                        g.fx.dust(ex, ey + 50, 3, 14, DUST_TINT[L.material]);
                    } else p.velocity.x = ux * r.dir * r.v;
                    continue;
                }
                const tx = inst.x0 + ux * r.s, ty = inst.y0 + uy * r.s;
                p.x = tx - p.width / 2; p.y = ty - 6; p.prevX = p.prevX === undefined ? p.x : p.prevX;
                p.velocity.x = ux * r.dir * r.v; p.velocity.y = uy * r.dir * r.v - p.gravity; p.grounded = false; p.jumpCount = 1;
                r.tx = tx; r.ty = ty;
                if (g.frameCount % 3 === 0) g.fx.sparks(tx, ty, '255,220,140', 1, Math.atan2(-uy * r.dir, -ux * r.dir), 0.6, 2);
            }
        },
        back(ctx, inst) {
            const sag = 8;
            ctx.strokeStyle = '#3e3a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(inst.x0, inst.y0); ctx.quadraticCurveTo((inst.x0 + inst.x1) / 2, (inst.y0 + inst.y1) / 2 + sag * 2, inst.x1, inst.y1); ctx.stroke();
            ctx.fillStyle = '#5d4037'; ctx.fillRect(inst.x0 - 3, inst.y0 - 4, 6, 50); ctx.fillRect(inst.x1 - 3, inst.y1 - 4, 6, 50);
            ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(inst.x0, inst.y0, 4, 0, TAU); ctx.arc(inst.x1, inst.y1, 4, 0, TAU); ctx.fill();
            // a handle waits at each end that nobody is riding from; it glows when someone stands under it
            const busy = [...inst.riders.values()];
            for (const k of [0, 1]) {
                if (busy.some(r => r.end === k)) continue;
                const ex = k ? inst.x1 : inst.x0, ey = k ? inst.y1 : inst.y0, hx = ex + (k ? -10 : 10);
                if (inst.near && inst.near[k]) glow(ctx, hx, ey + 14, 22, '255,220,140', 0.55 + 0.2 * Math.sin(Date.now() * 0.008));
                this.handle(ctx, hx, ey);
            }
            for (const r of busy) if (r.tx !== undefined) this.handle(ctx, r.tx, r.ty);
        },
        handle(ctx, x, y) {
            ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(x, y + 2, 4, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12); ctx.stroke();
            ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, y + 13); ctx.lineTo(x + 9, y + 13); ctx.stroke();
        }
    };

    // 35. Barrel cannon: hop in, it swivels, and it fires you out (attack fires early)
    K.barrelCannon = {
        themes: { dirt: 2, ocean: 2, candy: 2 },
        place(L) { const s = spotOnTop(L, 34, 120); return s ? { x: s.x, y: s.y - 30, a: -Math.PI / 2, rider: null, t: 0 } : null; },
        step(inst, L, g) {
            inst.t++;
            inst.a = -Math.PI / 2 + Math.sin(inst.t * 0.04) * 0.9;
            if (!inst.rider) {
                const entryBox = { x: inst.x - 16, y: inst.y - 30, w: 32, h: 48 };
                for (const p of alive(g)) if (!p.isBird && !p.onCloud && (p.cannonCd || 0) < g.frameCount && p.intersectsRect(entryBox)) { inst.rider = p; inst.hold = 0; g.fx.ring(inst.x, inst.y, '255,220,140', 30, 3, 12); break; }
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
        themes: { xmas: 5, candy: 2 },
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
                const giftBox = { x: gf.x - 26, y: gf.y - 40, w: 52, h: 80 };
                const opener = alive(g).find(p => !p.isBird && p.intersectsRect(giftBox));
                if (opener && gf.life > 0) {
                    gf.life = 0;
                    g.fx.confetti(gf.x, gf.y, 60, ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#ffffff']);
                    if (R() < 0.8) { const pool = Object.keys(WEAPONS).filter(k => k !== 'bird_crystal' && k !== 'magic_stick' && k !== 'godtear'); const w = new Weapon(gf.x - 15, gf.y - 30, pool[(R() * pool.length) | 0]); g.weapons.push(w); }
                    else { g.fx.explosion && g.fx.explosion(gf.x, gf.y, 50); for (const p of alive(g)) if (p.touchesCircle(gf.x, gf.y, 60)) hurt(g, inst, p, 10, Math.sign(p.x + 15 - gf.x || 1) * 8, -7, { every: 30 }); g.fx.text(gf.x, gf.y - 30, 'COAL!', '#555', 16); }
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

    // 37. Black hole: space starts to bend and stars stream toward a point, then a hole opens. Everything near is
    // pulled in (the closer, the harder, as a change of velocity). Whoever reaches the centre is swallowed, a portal
    // opens somewhere else on the map and throws them out of it. Nobody is hurt; the trip is the punishment.
    K.blackHole = {
        themes: { magic: 5, neon: 1.5, ice: 1.5 },
        REACH: 1700, VISR: 720, CORE: 40, MAXV: 22,   // the pull reaches across the whole arena (5x), and is 5x as strong
        place(L) {
            if (!claim(L, { x: -60, y: -60, w: 1, h: 1 })) return null;
            const inst = { cx: L.width / 2, cy: L.height / 2, t: 0, k: 0, exits: [], swallowed: [],
                parts: Array.from({ length: 150 }, () => ({ a: R() * TAU, r: 40 + R() * 640, sp: 0.4 + R() * 0.9, tone: R(), s: 0.8 + R() * 1.8 })) };
            this.relocate(inst, L);
            return inst;
        },
        D: { idle: () => RND(520, 900), warn: () => 180, active: () => 440, cool: () => 80 },
        // a random point in the open air (clear of every platform by 70px), anywhere on the map
        relocate(inst, L) {
            for (let tries = 0; tries < 60; tries++) {
                const x = RND(150, L.width - 150), y = RND(140, floorY(L) - 120);
                if (L.platforms.some(o => o.active && x > o.x - 70 && x < o.x + o.width + 70 && y > o.y - 70 && y < o.y + o.height + 70)) continue;
                inst.cx = x; inst.cy = y; return;
            }
        },
        // where the portal opens: far from the hole, over a real ledge with room to be thrown out
        exitSpot(inst, L, p) {
            const S = L.platforms.filter(q => q.active && q.type !== 'trampoline' && !q.feature && q.width >= 60 && q.y > 140);
            for (let tries = 0; tries < 30 && S.length; tries++) {
                const q = S[(R() * S.length) | 0], x = RND(q.x + 24, q.x + q.width - 24), y = q.y - 64;
                if (Math.hypot(x - inst.cx, y - inst.cy) < 480) continue;
                if (L.platforms.some(o => o.active && o !== q && x > o.x - 14 && x < o.x + o.width + 14 && y > o.y - 70 && y < o.y + o.height + 10)) continue;
                return { x, y };
            }
            return { x: clamp(L.width - inst.cx + RND(-80, 80), 80, L.width - 80), y: RND(160, floorY(L) - 160) };
        },
        step(inst, L, g) {
            const ph = cycle(inst, this.D);
            // every time it opens it opens somewhere new: a random spot in the open
            if (ph === 'warn' && inst.enter) this.relocate(inst, L);
            const cx = inst.cx, cy = inst.cy;
            inst.t++;
            const kt = ph === 'warn' ? prog(inst, 180) * 0.55 : ph === 'active' ? 1 : ph === 'cool' ? inst.left / 80 : 0;
            inst.k += (kt - inst.k) * 0.06; if (inst.k < 0.004) inst.k = 0;
            // infalling stars: each one spirals in faster as it nears, and is replaced out at the rim
            if (inst.k > 0) for (const q of inst.parts) {
                q.r -= (0.8 + 2600 / (q.r + 30) * 0.09) * q.sp * (0.4 + inst.k); q.a += (0.012 + 5 / (q.r + 20) * 0.1) * q.sp;
                if (q.r < 22) { q.r = 260 + R() * 420; q.a = R() * TAU; }
            }
            if (ph === 'warn' && inst.t % 10 === 0) tremor(g, cx, cy, 0.02 + inst.k * 0.05);
            if (ph === 'active') {
                if (inst.enter) { AudioSys.playPowerup && AudioSys.playPowerup(); g.fx.flashAt(cx, cy, '190,150,255', 220, 10); tremor(g, cx, cy, 0.25); }
                if (inst.t % 8 === 0) tremor(g, cx, cy, 0.04);
            }
            if (inst.enter && ph === 'cool') g.fx.flashAt(cx, cy, '255,230,255', 160, 8);
            if (inst.k > 0.35) {
                const power = Math.min(1, (inst.k - 0.35) / 0.4);
                for (const p of alive(g)) {
                    if (p.hidden || (p.holeCd || 0) > g.frameCount) continue;
                    const pcx = p.x + p.width / 2, pcy = p.y + p.height / 2, dx = cx - pcx, dy = cy - pcy;
                    const bodyDistance = p.touchDistanceToPoint(cx, cy), centerDistance = Math.hypot(dx, dy) || 1;
                    if (bodyDistance > this.REACH) continue;
                    // pull toward the hole (inverse-square-ish: the closer, the stronger) plus a little swirl around it
                    const f = 1 - bodyDistance / this.REACH, a = 9.5 * f * f * power;
                    p.velocity.x = clamp(p.velocity.x + dx / centerDistance * a - dy / centerDistance * 0.4 * f * power, -this.MAXV, this.MAXV);
                    p.velocity.y = clamp(p.velocity.y + dy / centerDistance * a * 0.95 - (a > 0.3 ? 0.35 : 0), -this.MAXV, this.MAXV);
                    if (a > 0.25) p.grounded = false;
                    // standing, crouching or mid-swing makes no difference: part of the pull moves the body directly
                    p.x += dx / centerDistance * Math.min(6, a * 0.45); p.y += dy / centerDistance * Math.min(4, a * 0.3 * (dy < 0 ? 1 : 0.4));
                    // (swept: at this speed a fighter can cross the centre between two frames)
                    const px0 = pcx - p.velocity.x, py0 = pcy - p.velocity.y;
                    const crossesCore = p.touchesCapsule(px0, py0, pcx, pcy, this.CORE);
                    if ((bodyDistance < this.CORE || crossesCore) && inst.phase === 'active') {
                        const dest = this.exitSpot(inst, L, p);
                        p.hidden = true; p.velocity.x = 0; p.velocity.y = 0; p.grounded = false;
                        inst.swallowed.push({ p, t: 0, dest });
                        inst.exits.push({ x: dest.x, y: dest.y, t: 0, p });
                        g.fx.ring(cx, cy, '190,150,255', 70, 3, 16); g.fx.flashAt(cx, cy, '255,255,255', 90, 6);
                        AudioSys.playPowerup && AudioSys.playPowerup();
                    }
                }
                // shots bend toward it, loose bits are dragged in
                for (const pr of g.projectiles) if (pr.active) { const dx = cx - pr.x, dy = cy - pr.y, d = Math.hypot(dx, dy) || 1; if (d < this.REACH) { const f = 1 - d / this.REACH, a = 9.5 * f * f * power; bend(pr, dx / d * a, dy / d * a); } }
                for (const q of g.fx.particles) if (q.x !== undefined && q.type !== 'text') { const dx = cx - q.x, dy = cy - q.y, d = Math.hypot(dx, dy) || 1; if (d < 900) { const f = 1 - d / 900; q.vx += dx / d * 1.2 * f; q.vy += dy / d * 1.2 * f; } }
            }
            // in transit: held in the hole a moment, then thrown out of the portal that has opened
            for (const s of inst.swallowed) {
                s.t++; const p = s.p;
                if (p.isDead) { s.done = true; p.hidden = false; continue; }
                p.x = cx - p.width / 2; p.y = cy - p.height / 2; p.velocity.x = 0; p.velocity.y = 0; p.hidden = true;
                if (s.t === 30) {
                    p.hidden = false;
                    const ang = RND(-2.5, -0.64), v = 15;
                    p.x = s.dest.x - p.width / 2; p.y = s.dest.y - p.height / 2; p.prevX = p.x; p.prevY = p.y; p.trail = [];
                    // thrown away from the nearest wall / toward the middle if it opens near an edge
                    let vx = Math.cos(ang) * v; if (s.dest.x < 160) vx = Math.abs(vx); else if (s.dest.x > L.width - 160) vx = -Math.abs(vx);
                    p.velocity.x = vx; p.velocity.y = Math.sin(ang) * v; p.grounded = false; p.launched = true; p.jumpCount = 1;
                    p.holeCd = g.frameCount + 150; p.portalCd = g.frameCount + 60;
                    g.fx.ring(s.dest.x, s.dest.y, '190,150,255', 90, 4, 18); g.fx.flashAt(s.dest.x, s.dest.y, '255,255,255', 140, 8);
                    g.fx.sparks(s.dest.x, s.dest.y, '200,170,255', 18, undefined, 0, 8);
                    AudioSys.playExplosion && AudioSys.playExplosion();
                    s.done = true;
                }
            }
            inst.swallowed = inst.swallowed.filter(s => !s.done);
            for (const e of inst.exits) e.t++;
            inst.exits = inst.exits.filter(e => e.t < 90);
            if (!inst.sprite && typeof document !== 'undefined') this.makeSprite(inst);
        },
        makeSprite(inst) {
            const S = 360, c = document.createElement('canvas'); c.width = c.height = S;
            const x = c.getContext('2d'); if (!x || !x.createRadialGradient) return;
            const rng = Graphics.rng ? Graphics.rng(7) : Math.random;
            // a swirling accretion disk: a hot annulus plus hundreds of bright streaks along the flow
            x.translate(S / 2, S / 2);
            const base = x.createRadialGradient(0, 0, S * 0.1, 0, 0, S * 0.5);
            base.addColorStop(0, 'rgba(255,250,230,0)'); base.addColorStop(0.18, 'rgba(255,214,150,0.55)'); base.addColorStop(0.4, 'rgba(255,120,50,0.4)'); base.addColorStop(0.7, 'rgba(190,50,190,0.22)'); base.addColorStop(1, 'rgba(90,60,220,0)');
            x.fillStyle = base; x.beginPath(); x.arc(0, 0, S * 0.5, 0, TAU); x.fill();
            x.lineCap = 'round';
            for (let i = 0; i < 220; i++) {
                const r = S * (0.12 + rng() * 0.36), a0 = rng() * TAU, len = 0.2 + rng() * 1.1, u = (r / S - 0.12) / 0.36;
                const col = u < 0.3 ? '255,250,225' : u < 0.55 ? '255,190,100' : u < 0.8 ? '255,110,190' : '150,120,255';
                x.strokeStyle = `rgba(${col},${0.1 + rng() * 0.3})`; x.lineWidth = 0.8 + rng() * 3.2 * (1 - u * 0.5);
                x.beginPath(); x.arc(0, 0, r, a0, a0 + len); x.stroke();
            }
            inst.sprite = c;
        },
        puller(inst, L) { return inst.k > 0.35 ? { x: inst.cx, y: inst.cy, rad: this.REACH, core: 70, kind: 'hole' } : null; },
        front(ctx, inst, L) {
            const k = inst.k, cx = inst.cx, cy = inst.cy, t = inst.t;
            for (const e of inst.exits) {
                // the exit portal: an opening ring of light, a swirl, then it closes
                const o = e.t < 20 ? e.t / 20 : e.t < 60 ? 1 : 1 - (e.t - 60) / 30, r = 34 * o;
                glow(ctx, e.x, e.y, 90 * o, '210,180,255', 0.6 * o);
                ctx.save(); ctx.translate(e.x, e.y); ctx.globalCompositeOperation = 'lighter';
                for (let j = 0; j < 4; j++) { ctx.strokeStyle = `rgba(${j % 2 ? '255,255,255' : '190,140,255'},${(0.9 - j * 0.18) * o})`; ctx.lineWidth = 3 - j * 0.5; const ph = t * 0.12 * (j % 2 ? 1 : -1); ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - j * 0.16) * 0.55, r * (1 - j * 0.16), 0, ph, ph + 5); ctx.stroke(); }
                ctx.fillStyle = `rgba(255,255,255,${0.55 * o})`; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.25, r * 0.55, 0, 0, TAU); ctx.fill();
                ctx.restore();
            }
            if (k < 0.01) return;
            const R0 = 120 + 40 * k;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            // space bending: a wide violet-blue well and ripples running inward
            glow(ctx, cx, cy, this.VISR, '90,60,220', 0.12 * k);
            glow(ctx, cx, cy, R0 * 1.5, '150,90,255', 0.18 * k);
            for (let j = 0; j < 3; j++) { const u = ((t * 0.012 + j / 3) % 1), rr = this.VISR * (1 - u); ctx.strokeStyle = `rgba(190,160,255,${0.22 * k * Math.sin(Math.PI * u)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); }
            // stars falling in: streaks stretched along their spiral
            ctx.lineCap = 'round';
            for (const q of inst.parts) {
                const x0 = cx + Math.cos(q.a) * q.r, y0 = cy + Math.sin(q.a) * q.r * 0.8, v = 1.2 + 90 / (q.r + 20), x1 = cx + Math.cos(q.a - 0.04 * v) * (q.r + 5 * v), y1 = cy + Math.sin(q.a - 0.04 * v) * (q.r + 5 * v) * 0.8;
                const heat = Math.max(0, 1 - q.r / 220);
                ctx.strokeStyle = `rgba(${200 + 55 * heat | 0},${190 - 40 * (1 - heat) | 0},${255 - 120 * heat | 0},${(0.25 + 0.6 * heat) * k})`; ctx.lineWidth = q.s * (0.6 + heat);
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            }
            // relativistic jets above and below
            for (const sgn of [-1, 1]) {
                const gr = ctx.createLinearGradient(0, cy, 0, cy + sgn * 230 * k); gr.addColorStop(0, `rgba(200,220,255,${0.7 * k})`); gr.addColorStop(1, 'rgba(120,150,255,0)');
                ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 1.5 + Math.sin(t * 0.3) * 1.5, cy + sgn * 230 * k); ctx.lineTo(cx + 1.5, cy + sgn * 230 * k); ctx.lineTo(cx + 5, cy); ctx.fill();
            }
            // accretion disk: the sprite spins, squashed into a tilted plane; its far half also arches over the hole
            if (inst.sprite) {
                const sc = (R0 * 2.3) / 360;
                ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = Math.min(0.8, k * 0.9);
                ctx.save(); ctx.scale(1, 0.3); ctx.rotate(t * 0.035); ctx.drawImage(inst.sprite, -180 * sc, -180 * sc, 360 * sc, 360 * sc); ctx.restore();
                ctx.save(); ctx.scale(0.5, 0.98); ctx.rotate(-t * 0.02); ctx.globalAlpha *= 0.3; ctx.drawImage(inst.sprite, -180 * sc * 0.9, -180 * sc * 0.9, 360 * sc * 0.9, 360 * sc * 0.9); ctx.restore();
                ctx.restore();
            }
            // lensed ring hugging the horizon
            ctx.strokeStyle = `rgba(255,236,200,${0.75 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 36 * k + 4, 0, TAU); ctx.stroke();
            ctx.strokeStyle = `rgba(255,150,80,${0.28 * k})`; ctx.lineWidth = 8; ctx.stroke();
            ctx.restore();
            // the horizon itself: black, with a soft edge
            const hz = ctx.createRadialGradient(cx, cy, 2, cx, cy, 44 * k + 6); hz.addColorStop(0, 'rgba(0,0,0,1)'); hz.addColorStop(0.8, 'rgba(0,0,0,0.96)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = hz; ctx.beginPath(); ctx.arc(cx, cy, 44 * k + 6, 0, TAU); ctx.fill();
            // anyone being swallowed is stretched into a streak toward the centre
            for (const s of inst.swallowed) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,255,255,${0.9 - s.t / 40})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 26 + s.t); ctx.lineTo(cx, cy + 26 - s.t); ctx.stroke(); ctx.restore(); }
        },
        danger(inst) { return inst.k > 0.2 ? [{ x: inst.cx - 90, y: inst.cy - 90, w: 180, h: 180, soon: inst.phase === 'warn' ? inst.left : 0, kind: 'pull' }] : []; }
    };

    // 38. Drop tiles: ground that cannot take your weight. Step on it and it shivers for half a second, then falls
    // away; three seconds later it comes back (never on top of someone).
    K.dropTile = {
        themes: { dirt: 2, stone: 2, neon: 2, candy: 2, ice: 1, cloud: 1, magic: 2, lava: 2, haunted: 2, xmas: 2, ocean: 2 },
        FALL: 30, BACK: 180,
        place(L) {
            const S = solids(L).filter(p => p.y < floorY(L) - 60 && p.width >= 70 && p.width <= 260 && !p.featureTag);
            const inst = { tiles: [], t: 0 };
            for (const p of S.sort(() => R() - 0.5)) {
                if (inst.tiles.length >= 2) break;
                if (!claim(L, { x: p.x, y: p.y - 10, w: p.width, h: p.height + 20 })) continue;
                p.featureTag = 'drop';
                inst.tiles.push({ plat: p, state: 'ok', t: 0, dy: 0, vy: 0 });
            }
            return inst.tiles.length ? inst : null;
        },
        step(inst, L, g) {
            inst.t++;
            for (const k of inst.tiles) {
                const p = k.plat; p.jx = 0; p.ga = undefined; p.dy = 0;
                if (k.state === 'ok') { if (alive(g).some(q => standingOn(q, p))) { k.state = 'shake'; k.t = 0; } }
                else if (k.state === 'shake') {
                    k.t++; p.jx = (R() - 0.5) * (2 + k.t / 8);
                    if (k.t % 3 === 0) g.fx.add({ type: 'chunk', x: p.x + R() * p.width, y: p.y + p.height, vx: RND(-0.4, 0.4), vy: RND(0, 1), life: 24, color: '#7a6a5a', size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 });
                    if (k.t % 6 === 0) g.fx.dust(p.x + R() * p.width, p.y + p.height, 2, 10, DUST_TINT[L.material]);
                    if (k.t >= this.FALL) { k.state = 'gone'; k.t = 0; k.dy = 0; k.vy = 0; p.active = false; g.fx.dust(p.x + p.width / 2, p.y, 8, p.width / 2, DUST_TINT[L.material]); tremor(g, p.x, p.y, 0.05); }
                } else if (k.state === 'gone') {
                    k.t++; k.vy += 0.55; k.dy += k.vy;
                    if (k.t >= this.BACK && !alive(g).some(q => inBox(q, { x: p.x, y: p.y, w: p.width, h: p.height }))) { p.active = true; k.state = 'grow'; k.t = 0; }
                } else { k.t++; p.ga = 0.25 + 0.75 * (k.t / 24); if (k.t >= 24) { k.state = 'ok'; p.ga = undefined; } }
            }
        },
        front(ctx, inst, L) {
            const pat = L.getMaterialPattern();
            for (const k of inst.tiles) {
                const p = k.plat;
                if (k.state === 'shake') {
                    const u = k.t / this.FALL, pulse = 0.5 + 0.5 * Math.sin(k.t * (0.7 + u * 1.2));
                    ctx.fillStyle = `rgba(255,170,60,${(0.12 + 0.3 * pulse) * (0.4 + u)})`; ctx.fillRect(p.x + (p.jx || 0), p.y, p.width, p.height);
                    ctx.strokeStyle = `rgba(30,20,10,${0.35 + u * 0.55})`; ctx.lineWidth = 1.2;
                    const s = (p.seed * 7) | 0;
                    for (let i = 0; i < 2 + u * 6; i++) { const x = p.x + ((s + i * 37) % 100) / 100 * p.width; ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x + ((i * 13) % 9) - 4, p.y + p.height * 0.6); ctx.lineTo(x + ((i * 7) % 11) - 5, p.y + p.height); ctx.stroke(); }
                } else if (k.state === 'gone' && k.dy < 700) {
                    // the tile tumbles away, fading
                    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k.t / 40);
                    ctx.translate(p.x + p.width / 2, p.y + p.height / 2 + k.dy); ctx.rotate(k.t * 0.02 * (p.seed % 2 < 1 ? 1 : -1)); ctx.translate(-(p.x + p.width / 2), -(p.y + p.height / 2));
                    L.drawPlatform(ctx, Object.assign({}, p, { active: true, jx: 0, dy: 0, ga: undefined }), pat);
                    ctx.restore();
                }
            }
        },
        danger(inst) { return inst.tiles.filter(k => k.state === 'shake').map(k => ({ x: k.plat.x, y: k.plat.y - 60, w: k.plat.width, h: 62, soon: this.FALL - k.t, kind: 'floor' })); }
    };

    // =====================================================================================
    //  LOOKS: every map feature is built from the arena's own materials (a frosted-steel scale on the glacier, a candy
    //  waffle press in the sweets, rusted iron in the ruins), with real shading: gradients, rims, rivets, links.
    // =====================================================================================
    const PALS = {
        dirt:    { wood: ['#a07a4a', '#5f452a'], metal: ['#8a8f99', '#3d4048'], rope: '#a8844a', accent: '#ffca28', dark: '#2a1f14', light: '#d9b97c' },
        stone:   { wood: ['#8a7762', '#4d4034'], metal: ['#8a909c', '#3a3e48'], rope: '#7a7366', accent: '#d4a82a', dark: '#22252c', light: '#c9c4b8' },
        ice:     { wood: ['#dff1fb', '#86bcd8'], metal: ['#c4e0ef', '#5f93b3'], rope: '#eef8fd', accent: '#7fdcff', dark: '#1d3d52', light: '#ffffff' },
        cloud:   { wood: ['#ffffff', '#c5d3ea'], metal: ['#e6edf8', '#8fa3c4'], rope: '#ffffff', accent: '#ffd66b', dark: '#51608a', light: '#ffffff' },
        magic:   { wood: ['#c9a4ff', '#5d36b0'], metal: ['#9a86e0', '#35246e'], rope: '#d9b8ff', accent: '#f0c8ff', dark: '#1d1240', light: '#f3e5ff' },
        neon:    { wood: ['#4b5470', '#171a28'], metal: ['#5a6580', '#181b28'], rope: '#2ee6ff', accent: '#00e5ff', dark: '#0a0b14', light: '#9fb4d8' },
        lava:    { wood: ['#4a3430', '#150c0b'], metal: ['#5a4540', '#1a100e'], rope: '#7a5a48', accent: '#ff8a2a', dark: '#0a0504', light: '#a08070' },
        ocean:   { wood: ['#c7a770', '#6f5a3a'], metal: ['#79a0ac', '#2f4d5a'], rope: '#e2d2a4', accent: '#7fe8d6', dark: '#16242c', light: '#f3e8c8' },
        candy:   { wood: ['#fbd49a', '#c88a4a'], metal: ['#ffb8dc', '#d4649c'], rope: '#ff6fa8', accent: '#ffffff', dark: '#6a2a46', light: '#fff4e0' },
        haunted: { wood: ['#56463f', '#221a1c'], metal: ['#76707e', '#2a2430'], rope: '#625870', accent: '#a98aff', dark: '#0e0a10', light: '#b8b0c4' },
        xmas:    { wood: ['#b8743f', '#6b3a1e'], metal: ['#f0463c', '#8e1a1a'], rope: '#2f8a4a', accent: '#ffd740', dark: '#2a1208', light: '#fff4e0' }
    };
    const pal = (L) => PALS[L.material] || PALS.dirt;
    // a rounded slab with a vertical gradient, a lit top edge, a shaded underside and an outline
    function slab(ctx, x, y, w, h, c, r, outline) {
        r = Math.min(r === undefined ? 3 : r, h / 2, w / 2);
        const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + r, y + 0.5, Math.max(0, w - r * 2), Math.min(2, h * 0.2));
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + r, y + h - Math.min(2.5, h * 0.25), Math.max(0, w - r * 2), Math.min(2.5, h * 0.25));
        if (outline !== false) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r) : ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.stroke(); }
    }
    const rivet = (ctx, x, y, r, c) => { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.6, r, 0, TAU); ctx.fill(); ctx.fillStyle = c || '#c8ccd4'; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.3, 0, TAU); ctx.fill(); };
    // a chain of alternating links between two points
    function chainLine(ctx, x0, y0, x1, y1, col, link) {
        link = link || 7;
        const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(d / link)), a = Math.atan2(y1 - y0, x1 - x0);
        ctx.save(); ctx.lineWidth = 1.7;
        for (let i = 0; i < n; i++) {
            const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
            ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, 0, link * 0.7, i % 2 ? 1.2 : 2.3, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }
    const softShadow = (ctx, x, y, w, a) => { const g = ctx.createRadialGradient(x, y, 1, x, y, w); g.addColorStop(0, `rgba(0,0,0,${a || 0.25})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(0, y); ctx.scale(1, 0.18); ctx.translate(0, -y); ctx.fillStyle = g; ctx.fillRect(x - w, y - w, w * 2, w * 2); ctx.restore(); };
    const twist = (ctx, pts, col, w) => {   // a two-strand twisted rope along a polyline
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = w + 1.2; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1] + 0.8) : ctx.moveTo(q[0], q[1] + 0.8)); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = Math.max(0.8, w * 0.32); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1] - w * 0.2) : ctx.moveTo(q[0], q[1] - w * 0.2)); ctx.stroke();
    };

    // ---- balance scale: a beam on a jewelled pivot, hung by chain; chained bowls ----
    K.balanceScale.back = function (ctx, inst, L) {
        const P = pal(L), a = Math.atan2(-2 * inst.off, 240), cx = inst.cx, py = inst.py;
        // chain up to the ceiling plate
        chainLine(ctx, cx, inst.anchor + 6, cx, py - 12, P.metal[0], 7);
        slab(ctx, cx - 16, inst.anchor - 6, 32, 10, P.metal, 3); rivet(ctx, cx - 10, inst.anchor - 1, 1.6); rivet(ctx, cx + 10, inst.anchor - 1, 1.6);
        // the beam: tapered, rounded, with end knobs
        ctx.save(); ctx.translate(cx, py); ctx.rotate(a);
        const bg = ctx.createLinearGradient(0, -6, 0, 7); bg.addColorStop(0, P.metal[0]); bg.addColorStop(0.5, P.metal[1]); bg.addColorStop(1, P.dark);
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-134, 0); ctx.quadraticCurveTo(-120, -6, -60, -6); ctx.lineTo(60, -6); ctx.quadraticCurveTo(120, -6, 134, 0); ctx.quadraticCurveTo(120, 7, 60, 7); ctx.lineTo(-60, 7); ctx.quadraticCurveTo(-120, 7, -134, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-100, -5, 200, 1.6);
        for (const sx of [-1, 1]) { ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(sx * 132, 0, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(sx * 132 - 1.5, -1.5, 1.6, 0, TAU); ctx.fill(); }
        for (let x = -90; x <= 90; x += 30) if (Math.abs(x) > 10) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 0.5, -4, 1, 9); }
        ctx.restore();
        // the pivot: a ring, a gem and a little crown
        ctx.fillStyle = P.metal[1]; ctx.beginPath(); ctx.arc(cx, py, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
        const gg = ctx.createRadialGradient(cx - 2, py - 2, 1, cx, py, 7); gg.addColorStop(0, '#fff'); gg.addColorStop(0.4, P.accent); gg.addColorStop(1, P.dark); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, py, 6.5, 0, TAU); ctx.fill();
        glow(ctx, cx, py, 22, '255,240,200', 0.18);
        // the bowls
        for (const [pan, sx] of [[inst.l, -1], [inst.r, 1]]) {
            const ex = cx + sx * 132 * Math.cos(a), ey = py + sx * 132 * Math.sin(a), px0 = pan.x, px1 = pan.x + pan.width, py0 = pan.y;
            chainLine(ctx, ex, ey + 4, px0 + 8, py0 + 1, P.metal[0], 6); chainLine(ctx, ex, ey + 4, px1 - 8, py0 + 1, P.metal[0], 6); chainLine(ctx, ex, ey + 4, (px0 + px1) / 2, py0 + 12, P.metal[1], 6);
            // bowl: curved underside, bright rim, a band of accent
            const bg2 = ctx.createLinearGradient(0, py0, 0, py0 + 16); bg2.addColorStop(0, P.metal[0]); bg2.addColorStop(1, P.metal[1]);
            ctx.fillStyle = bg2; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py0); ctx.quadraticCurveTo(px1 - 4, py0 + 18, (px0 + px1) / 2, py0 + 18); ctx.quadraticCurveTo(px0 + 4, py0 + 18, px0, py0); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = P.accent; ctx.fillRect(px0 + 3, py0 + 4, pan.width - 6, 2.2);
            ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(px0 + 6, py0 + 8, pan.width * 0.4, 1.6);
            slab(ctx, px0 - 2, py0 - 2, pan.width + 4, 5, [P.light, P.metal[0]], 2);
            rivet(ctx, px0 + 10, py0 + 10, 1.5); rivet(ctx, px1 - 10, py0 + 10, 1.5);
            softShadow(ctx, (px0 + px1) / 2, py0 + 26, pan.width * 0.5, 0.18);
        }
    };

    // ---- rope bridge: planks with grain and bolts, twisted hand ropes, knotted posts ----
    K.swingBridge.back = function (ctx, inst, L) {
        const P = pal(L), n = inst.segs.length, span = inst.x1 - inst.x0;
        const yAt = (i) => i <= 0 ? inst.y0 : i >= n ? inst.y1 : (inst.segs[i - 1].y + inst.segs[i].y) / 2;
        const ropeY = (u) => { const f = u * n, i = Math.min(n - 1, Math.max(0, f | 0)), a = yAt(i), b = yAt(i + 1); return a + (b - a) * (f - i); };
        // posts with caps and knots
        for (const [x, y] of [[inst.x0 - 2, inst.y0], [inst.x1 + 1, inst.y1]]) {
            slab(ctx, x - 4, y - 40, 8, 40, P.wood, 2); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(x, y - 42, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.strokeStyle = P.rope; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y - 28); ctx.lineTo(x + 4, y - 24); ctx.moveTo(x - 4, y - 24); ctx.lineTo(x + 4, y - 28); ctx.stroke();
        }
        // hand ropes (twisted, with a slight second sag)
        for (const off of [-30, -26]) { const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([inst.x0 + span * u, ropeY(u) + off + 10 * Math.sin(Math.PI * u) * 0.3]); } twist(ctx, pts, P.rope, 2.2); }
        inst.segs.forEach((s, i) => {
            const nx = s.x + s.width, yl = yAt(i), yr = yAt(i + 1), mx = s.x + s.width / 2;
            // hanger rope up to the hand rope, with a little knot
            ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(mx, s.y); ctx.lineTo(mx, ropeY((i + 0.5) / n) - 27); ctx.stroke();
            ctx.strokeStyle = P.rope; ctx.lineWidth = 1; ctx.stroke();
            // the plank, drawn as a slightly tilted slab following the sag, with grain and nails
            const t0 = s.y + (yl - s.y) * 0.5, t1 = s.y + (yr - s.y) * 0.5;
            const g = ctx.createLinearGradient(0, Math.min(t0, t1), 0, Math.min(t0, t1) + 10); g.addColorStop(0, i % 2 ? P.wood[0] : P.light); g.addColorStop(0.25, P.wood[0]); g.addColorStop(1, P.wood[1]);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s.x + 0.6, t0); ctx.lineTo(nx - 0.6, t1); ctx.lineTo(nx - 0.6, t1 + 9); ctx.lineTo(s.x + 0.6, t0 + 9); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(s.x + 2, Math.min(t0, t1) + 0.8, s.width - 4, 1.2);
            ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(s.x + 4, t0 + 4); ctx.lineTo(nx - 4, t1 + 4.5); ctx.stroke();
            rivet(ctx, s.x + 4, t0 + 4.5, 0.9, '#d8d8d8');
        });
    };

    // ---- conveyor: a belt over rollers, rotating wheels at the ends, chevrons showing the way ----
    K.conveyor.back = function (ctx, inst, L) {
        const P = pal(L), p = inst.plat, d = Math.sign(inst.v) || 1;
        // belt body
        slab(ctx, p.x, p.y - 5, p.width, 9, [P.dark, P.metal[1]], 4);
        ctx.save(); ctx.beginPath(); ctx.rect(p.x + 3, p.y - 5, p.width - 6, 9); ctx.clip();
        // moving treads
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        for (let x = ((inst.off % 14) + 14) % 14 - 14; x < p.width; x += 14) ctx.fillRect(p.x + x, p.y - 5, 2, 9);
        ctx.fillStyle = P.accent; ctx.globalAlpha = 0.95;
        for (let x = ((inst.off % 24) + 24) % 24 - 24; x < p.width; x += 24) { const cx = p.x + x; ctx.beginPath(); ctx.moveTo(cx - 4 * d, p.y - 3.6); ctx.lineTo(cx + 3 * d, p.y - 0.5); ctx.lineTo(cx - 4 * d, p.y + 2.6); ctx.lineTo(cx - 2 * d, p.y - 0.5); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        // end rollers: a drum with spokes that really turn
        for (const ex of [p.x + 1, p.x + p.width - 1]) {
            const g = ctx.createRadialGradient(ex - 1.5, p.y - 2.5, 1, ex, p.y, 7); g.addColorStop(0, P.light); g.addColorStop(1, P.metal[1]);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, p.y, 6.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const a = inst.off * 0.16 + k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(ex - Math.cos(a) * 5, p.y - Math.sin(a) * 5); ctx.lineTo(ex + Math.cos(a) * 5, p.y + Math.sin(a) * 5); ctx.stroke(); }
            rivet(ctx, ex, p.y, 1.3, P.accent);
        }
        glow(ctx, p.x + p.width / 2, p.y - 2, p.width * 0.45, hexRgb(P.accent), 0.07);
    };
    const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

    // ---- soft platform (marshmallow / cloud / raft): buoyancy pods and a ripple when it sinks ----
    K.sinkPlatform.back = function (ctx, inst, L) {
        const P = pal(L), p = inst.plat, sink = inst.depth / Math.max(1, inst.max);
        softShadow(ctx, p.x + p.width / 2, p.y + p.height + 6, p.width * 0.55, 0.14);
        // two buoyancy pods under the ends, squashing as it sinks
        for (const sx of [p.x + 12, p.x + p.width - 12]) {
            const g = ctx.createRadialGradient(sx - 2, p.y + p.height + 1, 1, sx, p.y + p.height + 3, 9); g.addColorStop(0, P.light); g.addColorStop(1, P.wood[1]);
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, p.y + p.height + 4, 8, 5 - sink * 1.6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
        }
        if (sink > 0.05) { ctx.strokeStyle = `rgba(255,255,255,${0.35 * sink})`; ctx.lineWidth = 1.4; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(p.x + p.width / 2, p.y + p.height + 9, p.width * (0.5 + k * 0.1), 3 + k, 0, 0, TAU); ctx.stroke(); } }
    };

    // ---- steam pipe: a flanged pipe with an elbow, a pressure gauge and a grille ----
    K.steamVent.back = function (ctx, inst, L) {
        const P = pal(L), x = inst.x, y = inst.y, d = inst.dir, j = inst.phase === 'warn' ? (R() - 0.5) * 1.6 : 0;
        softShadow(ctx, x, y + 1, 22, 0.25);
        slab(ctx, x - 9, y - 6, 18, 6, P.metal, 2); rivet(ctx, x - 6, y - 3, 1.2); rivet(ctx, x + 6, y - 3, 1.2);   // base flange
        slab(ctx, x - 6, y - 26 + j, 12, 21, P.metal, 3);                                                         // riser
        slab(ctx, x - 8, y - 22 + j, 16, 4, [P.light, P.metal[0]], 1.5);                                          // collar
        // elbow and nozzle toward the side it blows
        ctx.fillStyle = P.metal[1]; ctx.beginPath(); ctx.arc(x, y - 26 + j, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        slab(ctx, d > 0 ? x : x - 17, y - 29 + j, 17, 8, P.metal, 3);
        slab(ctx, d > 0 ? x + 13 : x - 20, y - 31 + j, 7, 12, [P.light, P.metal[1]], 2);
        // grille slits and a pressure gauge that climbs as it warns
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect((d > 0 ? x + 14 : x - 19) + 0.5, y - 29 + j + k * 3.4, 4.4, 1.5);
        ctx.fillStyle = '#e8eaee'; ctx.beginPath(); ctx.arc(x, y - 14 + j, 4.4, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        const k = inst.phase === 'warn' ? 0.35 + 0.6 * (1 - inst.left / 70) : inst.phase === 'active' ? 1 : 0.1;
        ctx.strokeStyle = k > 0.8 ? '#ff3d2e' : '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - 14 + j); ctx.lineTo(x + Math.cos(Math.PI * (1.15 + 0.7 * k)) * 3.4, y - 14 + j + Math.sin(Math.PI * (1.15 + 0.7 * k)) * 3.4); ctx.stroke();
        if (inst.phase === 'warn') glow(ctx, x + d * 18, y - 25 + j, 14, '255,240,200', 0.25 * k);
    };

    // ---- flame jet: a bracketed gas nozzle with a heat ring ----
    K.flameJet.back = function (ctx, inst, L) {
        const P = pal(L), x = inst.x, y = inst.y, d = inst.dir, k = inst.phase === 'warn' ? 1 - inst.left / 80 : inst.phase === 'active' ? 1 : 0;
        slab(ctx, x - 9, y - 6, 18, 6, P.metal, 2); rivet(ctx, x - 6, y - 3, 1.2); rivet(ctx, x + 6, y - 3, 1.2);
        slab(ctx, x - 5, y - 30, 10, 25, [P.metal[0], P.dark], 3);                      // the gas bottle
        ctx.fillStyle = P.accent; ctx.fillRect(x - 5, y - 20, 10, 3);                   // hazard band
        slab(ctx, d > 0 ? x + 2 : x - 15, y - 28, 13, 9, P.metal, 3);                  // nozzle body
        // nozzle bell, going dull red as it warms up
        const bx = x + d * 13, g = ctx.createLinearGradient(bx, 0, bx + d * 9, 0); g.addColorStop(0, P.metal[1]); g.addColorStop(1, `rgb(${70 + 150 * k | 0},${50 + 20 * k | 0},${40})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, y - 27); ctx.lineTo(bx + d * 9, y - 31); ctx.lineTo(bx + d * 9, y - 17); ctx.lineTo(bx, y - 21); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        glow(ctx, bx + d * 9, y - 24, 12 + 22 * k, '255,120,40', 0.2 + 0.6 * k);
        // pilot light
        ctx.fillStyle = `rgba(110,190,255,${0.5 + 0.4 * Math.sin(inst.t * 0.4)})`; ctx.beginPath(); ctx.arc(x - d * 2, y - 33, 1.8, 0, TAU); ctx.fill();
    };

    // ---- tesla coils: base, copper windings with a lit edge, a polished top sphere with a halo ----
    K.teslaCoils.back = function (ctx, inst, L) {
        const P = pal(L), k = inst.phase === 'warn' ? 1 - inst.left / 90 : inst.phase === 'active' ? 1 : 0.05;
        for (const x of [inst.a, inst.b]) {
            softShadow(ctx, x, inst.y + 1, 18, 0.22);
            slab(ctx, x - 11, inst.y - 9, 22, 9, P.metal, 3); rivet(ctx, x - 7, inst.y - 4.5, 1.3); rivet(ctx, x + 7, inst.y - 4.5, 1.3);
            slab(ctx, x - 4, inst.y - 20, 8, 12, [P.metal[1], P.dark], 2);
            for (let i = 0; i < 7; i++) {   // copper windings
                const yy = inst.y - 22 - i * 6.5, g = ctx.createLinearGradient(x - 8, 0, x + 8, 0); g.addColorStop(0, '#6b3a14'); g.addColorStop(0.35, '#f0a850'); g.addColorStop(0.6, '#c87a2a'); g.addColorStop(1, '#5a2e10');
                ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 8 + i * 0.2, yy, 16 - i * 0.4, 5, 2.4) : ctx.rect(x - 8, yy, 16, 5); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
            }
            ctx.fillStyle = P.metal[1]; ctx.fillRect(x - 1.5, inst.y - 62, 3, 6);
            const sg = ctx.createRadialGradient(x - 3, inst.y - 74, 1, x, inst.y - 71, 9); sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.4, '#cfd8e6'); sg.addColorStop(1, '#5a6478');
            ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, inst.y - 71, 8.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
            glow(ctx, x, inst.y - 71, 18 + k * 30, '150,220,255', 0.2 + k * 0.55);
            if (k > 0.2 && R() < k) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(190,235,255,${0.5 + 0.4 * k})`; ctx.lineWidth = 1; ctx.beginPath(); let px = x, py = inst.y - 71, a = R() * TAU; ctx.moveTo(px, py); for (let i = 0; i < 4; i++) { a += (R() - 0.5) * 2; px += Math.cos(a) * 8; py += Math.sin(a) * 8; ctx.lineTo(px, py); } ctx.stroke(); ctx.restore(); }
        }
    };

    // ---- updraft fan: a grilled housing, shaded blades, a hub, rim lights ----
    K.updraftFan.back = function (ctx, inst, L) {
        const P = pal(L), x = inst.x, y = inst.y, k = Math.min(1, inst.spin / 0.5);
        softShadow(ctx, x, y + 1, 40, 0.22);
        slab(ctx, x - 34, y - 11, 68, 11, P.metal, 4);
        for (let i = -3; i <= 3; i++) rivet(ctx, x + i * 10, y - 5.5, 1.2);
        ctx.fillStyle = P.dark; ctx.beginPath(); ctx.ellipse(x, y - 11, 30, 5.5, 0, 0, TAU); ctx.fill();
        // blades: four lens shapes foreshortened into the housing, shaded by their angle
        ctx.save(); ctx.translate(x, y - 11); ctx.scale(1, 0.24);
        for (let b = 0; b < 4; b++) {
            const a = inst.rot + b * TAU / 4, bx = Math.cos(a) * 14, by = Math.sin(a) * 14, lit = 0.5 + 0.5 * Math.cos(a - 0.8);
            ctx.save(); ctx.translate(bx, by); ctx.rotate(a); const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, P.metal[1]); g.addColorStop(0.5 + lit * 0.2, P.light); g.addColorStop(1, P.metal[1]);
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
        }
        ctx.restore();
        ctx.fillStyle = P.accent; ctx.beginPath(); ctx.ellipse(x, y - 11, 4, 1.6, 0, 0, TAU); ctx.fill();   // the hub
        // grille ring and rim lights
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 11, 30, 5.5, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = P.accent; ctx.globalAlpha = 0.5 + 0.5 * k; for (const sx of [-30, 30]) { ctx.beginPath(); ctx.arc(x + sx, y - 5.5, 1.8, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
        if (k > 0.1) glow(ctx, x, y - 12, 38, hexRgb(P.accent), 0.14 * k);
    };

    // ---- pendulum: a ceiling mount with bearing, chain links, and a bevelled double-bladed axe ----
    K.pendulumBlade.back = function (ctx, inst, L) {
        const P = pal(L);
        slab(ctx, inst.px - 18, inst.py - 8, 36, 12, P.metal, 3); rivet(ctx, inst.px - 12, inst.py - 2, 1.4); rivet(ctx, inst.px + 12, inst.py - 2, 1.4);
        const g = ctx.createRadialGradient(inst.px - 1.5, inst.py + 2, 1, inst.px, inst.py + 4, 7); g.addColorStop(0, P.light); g.addColorStop(1, P.dark); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(inst.px, inst.py + 4, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
        chainLine(ctx, inst.px, inst.py + 9, inst.bx || inst.px, (inst.by || inst.py + inst.len) - 10, P.metal[0], 7);
    };
    K.pendulumBlade.front = function (ctx, inst, L) {
        const P = pal(L), bx = inst.bx, by = inst.by; if (bx === undefined) return;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(-inst.a);
        // shaft block, then two crescent blades bevelled in two tones
        slab(ctx, -6, -16, 12, 12, P.wood, 2);
        for (const s of [-1, 1]) {
            const g = ctx.createLinearGradient(s * 4, 0, s * 40, 0); g.addColorStop(0, '#e9eef3'); g.addColorStop(0.55, '#b8c3cc'); g.addColorStop(1, '#7d8a96');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s * 5, -9); ctx.quadraticCurveTo(s * 46, -4, s * 38, 20); ctx.quadraticCurveTo(s * 20, 8, s * 5, 6); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.1; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(s * 8, -6); ctx.quadraticCurveTo(s * 40, -2, s * 35, 16); ctx.stroke();   // honed edge
        }
        ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(0, -2, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-1.4, -3.4, 1.4, 0, TAU); ctx.fill();
        ctx.restore();
    };

    // ---- chandelier: wrought-iron ring with scrolled arms, glass pendants, real candles ----
    K.chandelier.front = function (ctx, inst, L) {
        if (inst.state === 'gone') return;
        const P = pal(L), sway = inst.state === 'creak' ? Math.sin(inst.sw * 6) * 8 : Math.sin(inst.sw) * 2, x = inst.x + sway, y = inst.y;
        if (inst.state !== 'fall') chainLine(ctx, inst.x, inst.top + 4, x, y - 22, P.metal[0], 8);
        ctx.strokeStyle = '#1b1514'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.ellipse(x, y, 44, 10, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = P.accent; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = '#1b1514'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.quadraticCurveTo(x - 24, y - 12, x - 42, y); ctx.moveTo(x, y - 22); ctx.quadraticCurveTo(x + 24, y - 12, x + 42, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 22, 5, 0, TAU); ctx.fillStyle = P.accent; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        for (let i = -2; i <= 2; i++) {
            const cx = x + i * 20, cy = y + Math.abs(i) * 1.6;
            ctx.fillStyle = '#2a2220'; ctx.fillRect(cx - 4, cy - 3, 8, 4);                                                          // cup
            const wg = ctx.createLinearGradient(cx - 2, 0, cx + 2, 0); wg.addColorStop(0, '#d8cfb8'); wg.addColorStop(0.5, '#fff8e6'); wg.addColorStop(1, '#bfb393'); ctx.fillStyle = wg; ctx.fillRect(cx - 2, cy - 14, 4, 11);   // wax
            glow(ctx, cx, cy - 17, 17, '255,190,100', 0.55 + 0.1 * Math.sin(inst.sw * 7 + i));
            ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(cx, cy - 17, 1.8, 3.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy - 16.5, 0.8, 1.8, 0, 0, TAU); ctx.fill();
        }
        for (let i = -4; i <= 4; i++) {   // glass pendants
            const px = x + i * 10, py = y + 5 + Math.abs(i) * 0.6, g = ctx.createLinearGradient(px, py, px, py + 12); g.addColorStop(0, 'rgba(235,248,255,0.95)'); g.addColorStop(1, 'rgba(150,200,235,0.7)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px - 2.4, py); ctx.lineTo(px + 2.4, py); ctx.lineTo(px, py + 11 + (i % 2) * 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
        }
    };

    // ---- spike trap: a studded grating, deep holes, bright shaded spikes ----
    K.spikeTrap.back = function (ctx, inst, L) {
        const P = pal(L), ph = inst.phase, ext = ph === 'active' ? Math.min(1, (60 - inst.left) / 4) : ph === 'warn' ? (R() < 0.3 ? 0.08 : 0) : 0, w = inst.x1 - inst.x0;
        slab(ctx, inst.x0 - 2, inst.y - 3, w + 4, 4, [P.metal[0], P.dark], 1.5);
        for (let x = inst.x0 + 6; x < inst.x1; x += 12) { ctx.fillStyle = '#05060a'; ctx.fillRect(x - 3.2, inst.y - 2.4, 6.4, 3.4); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - 3.2, inst.y + 0.6, 6.4, 0.6); }
        rivet(ctx, inst.x0 + 1, inst.y - 1, 1.1); rivet(ctx, inst.x1 - 1, inst.y - 1, 1.1);
        if (ext > 0) for (let x = inst.x0 + 6; x < inst.x1; x += 12) {
            const h = 28 * ext, g = ctx.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, '#8d99a6'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#6d7a88');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 3.6, inst.y - 1); ctx.lineTo(x, inst.y - h); ctx.lineTo(x + 3.6, inst.y - 1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x - 0.6, inst.y - h + 4, 1.2, h * 0.5);
        }
    };

    // ---- zipline: stout posts with pulleys, a taut braided cable, a proper grip ----
    K.zipline.back = function (ctx, inst, L) {
        const P = pal(L), sag = 8;
        for (const [x, y] of [[inst.x0, inst.y0], [inst.x1, inst.y1]]) {
            slab(ctx, x - 4, y - 4, 8, 52, P.wood, 2); slab(ctx, x - 10, y - 8, 20, 6, P.metal, 2); rivet(ctx, x - 6, y - 5, 1.2); rivet(ctx, x + 6, y - 5, 1.2);
            ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(x, y - 1, 4.6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1.4, y - 2.4, 1.4, 0, TAU); ctx.fill();
        }
        const pts = []; for (let i = 0; i <= 18; i++) { const u = i / 18; pts.push([inst.x0 + (inst.x1 - inst.x0) * u, inst.y0 + (inst.y1 - inst.y0) * u + Math.sin(Math.PI * u) * sag]); }
        twist(ctx, pts, P.metal[0], 2.2);
        const busy = [...inst.riders.values()];
        for (const k of [0, 1]) {
            if (busy.some(r => r.end === k)) continue;
            const ex = k ? inst.x1 : inst.x0, ey = k ? inst.y1 : inst.y0, hx = ex + (k ? -10 : 10);
            if (inst.near && inst.near[k]) glow(ctx, hx, ey + 14, 24, '255,225,150', 0.55 + 0.2 * Math.sin(Date.now() * 0.008));
            this.handle(ctx, hx, ey, P);
        }
        for (const r of busy) if (r.tx !== undefined) this.handle(ctx, r.tx, r.ty, P);
    };
    K.zipline.handle = function (ctx, x, y, P) {
        ctx.fillStyle = '#9aa4ae'; ctx.beginPath(); ctx.arc(x, y + 2, 4.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = (P && P.metal[1]) || '#555'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 12); ctx.stroke();
        slab(ctx, x - 10, y + 11.5, 20, 4.5, [(P && P.accent) || '#ffca28', '#8a6a10'], 2);
    };

    // ---- barrel cannon: staved barrel, iron hoops, a cradle ----
    K.barrelCannon.back = function (ctx, inst, L) {
        const P = pal(L);
        slab(ctx, inst.x - 20, inst.y + 17, 40, 13, P.wood, 3); rivet(ctx, inst.x - 14, inst.y + 24, 1.4); rivet(ctx, inst.x + 14, inst.y + 24, 1.4);
        ctx.save(); ctx.translate(inst.x, inst.y); ctx.rotate(inst.a + Math.PI / 2);
        const g = ctx.createLinearGradient(-17, 0, 17, 0); g.addColorStop(0, P.wood[1]); g.addColorStop(0.35, P.wood[0]); g.addColorStop(0.7, P.wood[0]); g.addColorStop(1, P.wood[1]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, -32); ctx.quadraticCurveTo(-19, -8, -15, 18); ctx.lineTo(15, 18); ctx.quadraticCurveTo(19, -8, 14, -32); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (let i = -10; i <= 10; i += 5) { ctx.beginPath(); ctx.moveTo(i * 1.2, -31); ctx.lineTo(i * 1.3, 18); ctx.stroke(); }
        for (const yy of [-26, -4, 12]) { slab(ctx, -19, yy, 38, 4.5, [P.metal[0], P.dark], 1.5); }
        ctx.fillStyle = '#0c0807'; ctx.beginPath(); ctx.ellipse(0, -31, 13, 4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = P.accent; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
        if (inst.rider && inst.hold % 6 < 3) glow(ctx, inst.x + 12, inst.y + 16, 8, '255,200,90', 0.9);
    };

    // ---- laser emitter: a gimbal on a ceiling mount with a lens that charges ----
    K.laserSweep.back = function (ctx, inst, L) {
        const P = pal(L), k = inst.phase === 'warn' ? 1 - inst.left / 70 : inst.phase === 'active' ? 1 : 0.15;
        slab(ctx, inst.x - 5, -80, 10, 84, [P.dark, P.metal[1]], 2);
        slab(ctx, inst.x - 18, 0, 36, 18, P.metal, 5); rivet(ctx, inst.x - 12, 5, 1.3); rivet(ctx, inst.x + 12, 5, 1.3);
        ctx.fillStyle = P.dark; ctx.beginPath(); ctx.arc(inst.x, 20, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = P.metal[0]; ctx.lineWidth = 2; ctx.stroke();
        const lg = ctx.createRadialGradient(inst.x - 2, 18, 1, inst.x, 20, 7); lg.addColorStop(0, '#fff'); lg.addColorStop(0.4, `rgba(255,${80 + 100 * k | 0},${120 + 80 * k | 0},1)`); lg.addColorStop(1, '#5a0a24');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(inst.x, 20, 6.5, 0, TAU); ctx.fill(); glow(ctx, inst.x, 20, 18 + 22 * k, '255,60,120', 0.35 + 0.5 * k);
    };

    // ---- campfire / hot spring / coral / cocoa ----
    K.healingSpring.back = function (ctx, inst, L) {
        const x = inst.x, y = inst.y, t = inst.t;
        softShadow(ctx, x, y, 30, 0.22);
        if (inst.style === 'fire' || inst.style === 'cocoa') {
            // a ring of stones, crossed logs with bark and glowing ends, ash
            for (let i = -4; i <= 4; i++) { const sx = x + i * 6.5, sy = y - 1 - (Math.abs(i) === 4 ? 1 : 0), g = ctx.createRadialGradient(sx - 1, sy - 2, 1, sx, sy, 5); g.addColorStop(0, '#bcbcc4'); g.addColorStop(1, '#5e5e66'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, 4.2, 3, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke(); }
            for (const rot of [0.34, -0.34]) { ctx.save(); ctx.translate(x, y - 4); ctx.rotate(rot); const g = ctx.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#7a5a3a'); g.addColorStop(1, '#3a2616'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-18, -3, 36, 6, 3) : ctx.rect(-18, -3, 36, 6); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.fillStyle = `rgba(255,${110 + 40 * Math.sin(t * 0.2)},40,0.8)`; ctx.beginPath(); ctx.arc(rot > 0 ? 17 : -17, 0, 2.6, 0, TAU); ctx.fill(); ctx.restore(); }
            glow(ctx, x, y - 12, 52, '255,170,70', 0.5 + 0.1 * Math.sin(t * 0.3));
            if (inst.style === 'cocoa') { ctx.fillStyle = '#f5e6d3'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 9, y - 22, 18, 14, 3) : ctx.rect(x - 9, y - 22, 18, 14); ctx.fill(); ctx.fillStyle = '#6b3d1e'; ctx.fillRect(x - 8, y - 21, 16, 4); ctx.strokeStyle = '#f5e6d3'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x + 11, y - 15, 4, -1.2, 1.2); ctx.stroke(); }
        } else {
            // a pool: rim stones, water with a shine, rising steam
            const c = inst.style === 'coral' ? ['#ff8a80', '255,140,170'] : ['#90caf9', '150,220,255'];
            ctx.fillStyle = '#6a6a72'; ctx.beginPath(); ctx.ellipse(x, y - 1, 34, 8, 0, 0, TAU); ctx.fill();
            const wg = ctx.createLinearGradient(0, y - 8, 0, y + 4); wg.addColorStop(0, 'rgba(190,235,255,0.95)'); wg.addColorStop(1, 'rgba(70,150,210,0.95)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(x, y - 2, 29, 6, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 0.05) * 6, y - 3, 12, 2.4, 0, 0, TAU); ctx.stroke();
            if (inst.style === 'coral') for (let i = -2; i <= 2; i++) { ctx.fillStyle = ['#ff8a80', '#ffab91', '#f48fb1'][(i + 2) % 3]; ctx.beginPath(); ctx.moveTo(x + i * 10 - 3, y - 4); ctx.lineTo(x + i * 10, y - 16 - Math.abs(i) * 2); ctx.lineTo(x + i * 10 + 3, y - 4); ctx.fill(); }
            glow(ctx, x, y - 6, 52, c[1], 0.32);
        }
        glow(ctx, x, y - 20, 30, '105,240,174', 0.1 + 0.05 * Math.sin(t * 0.08));
    };


    // ---- portals: a rune-carved ring around a turning vortex, sparkles circling ----
    K.portals.back = function (ctx, inst, L) {
        const P = pal(L), t = inst.t;
        for (const [o, rgb, hue] of [[inst.a, '170,110,255', '#b794ff'], [inst.b, '90,220,255', '#7fe8ff']]) {
            glow(ctx, o.x, o.y, 70, rgb, 0.3 + 0.06 * Math.sin(t * 0.05));
            ctx.save(); ctx.translate(o.x, o.y);
            // stone frame: a dark outer ring, a lit inner ring, runes that glow in turn
            ctx.lineWidth = 7; ctx.strokeStyle = '#1d1a26'; ctx.beginPath(); ctx.ellipse(0, 0, 17, 38, 0, 0, TAU); ctx.stroke();
            const fg = ctx.createLinearGradient(-18, 0, 18, 0); fg.addColorStop(0, '#6a6478'); fg.addColorStop(0.5, '#c9c4d6'); fg.addColorStop(1, '#5a5468');
            ctx.lineWidth = 4; ctx.strokeStyle = fg; ctx.beginPath(); ctx.ellipse(0, 0, 17, 38, 0, 0, TAU); ctx.stroke();
            for (let i = 0; i < 12; i++) { const a = i * TAU / 12, on = Math.sin(t * 0.08 - i * 0.6) > 0.2; ctx.fillStyle = on ? hue : 'rgba(40,34,54,0.9)'; ctx.fillRect(Math.cos(a) * 17 - 1.4, Math.sin(a) * 38 - 2, 2.8, 4); }
            // the vortex: dark heart, bright rim, arms turning
            const vg = ctx.createRadialGradient(0, 0, 2, 0, 0, 30); vg.addColorStop(0, 'rgba(8,0,24,0.95)'); vg.addColorStop(0.6, `rgba(${rgb},0.55)`); vg.addColorStop(1, `rgba(${rgb},0.1)`);
            ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(0, 0, 14, 35, 0, 0, TAU); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 14, 35, 0, 0, TAU); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(${rgb},0.7)`; ctx.lineWidth = 2; ctx.beginPath(); for (let u = 0; u < 1; u += 0.05) { const a = t * 0.12 * (k % 2 ? 1 : -1) + k * 2.1 + u * 6, r = u * 34; (u ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * r * 0.45, Math.sin(a) * r); } ctx.stroke(); }
            ctx.restore();
            ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 6; k++) { const a = t * 0.04 + k * TAU / 6; ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 0.2 + k)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * 21, Math.sin(a) * 43, 1.4, 0, TAU); ctx.fill(); }
            ctx.restore();
        }
    };

    // ---- gifts: a parachute with gores and lines, a wrapped box with a real bow ----
    K.giftDrop.front = function (ctx, inst, L) {
        for (const gf of inst.gifts) {
            ctx.save(); ctx.translate(gf.x, gf.y);
            if (!gf.landed) {
                ctx.rotate(Math.sin(gf.ph) * 0.14);
                for (let i = 0; i < 6; i++) {   // canopy gores
                    const a0 = Math.PI + i * Math.PI / 6, a1 = a0 + Math.PI / 6; ctx.fillStyle = i % 2 ? '#fff8f0' : '#e53935';
                    ctx.beginPath(); ctx.moveTo(0, -46); ctx.arc(0, -46, 28, a0, a1); ctx.closePath(); ctx.fill();
                }
                ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -46, 28, Math.PI, 0); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-8, -62, 8, 3.5, -0.4, 0, TAU); ctx.fill();
                ctx.strokeStyle = 'rgba(70,60,50,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); for (const x of [-27, -14, 0, 14, 27]) { ctx.moveTo(x, -46); ctx.lineTo(x * 0.4, -2); } ctx.stroke();
            }
            const cb = gf.col, g = ctx.createLinearGradient(0, -2, 0, 20); g.addColorStop(0, cb); g.addColorStop(1, 'rgba(0,0,0,0.35)');
            ctx.fillStyle = cb; ctx.fillRect(-12, -2, 24, 22); ctx.fillStyle = g; ctx.fillRect(-12, -2, 24, 22);
            ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-12, -2, 24, 3);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(-11.5, -1.5, 23, 21);
            ctx.fillStyle = '#ffe082'; ctx.fillRect(-2.2, -2, 4.4, 22); ctx.fillRect(-12, 7, 24, 4.4);                         // ribbon
            ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.ellipse(-5.5, -4.5, 5.5, 3.2, -0.5, 0, TAU); ctx.ellipse(5.5, -4.5, 5.5, 3.2, 0.5, 0, TAU); ctx.fill();   // bow
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke(); ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(0, -3.5, 2.2, 0, TAU); ctx.fill();
            ctx.restore();
            if (gf.landed) glow(ctx, gf.x, gf.y + 8, 32, '255,230,150', 0.22 + 0.12 * Math.sin(gf.ph * 3));
        }
    };

    // ---- boulder: a faceted rock, lit from above, cracks and a mossy patch ----
    K.rollingBoulder.front = function (ctx, inst, L) {
        if (inst.phase !== 'active') return;
        const p = inst.plat, r = 34, moss = L.material === 'dirt' || L.material === 'haunted';
        softShadow(ctx, inst.x, p.y, r * 1.1, 0.3);
        ctx.save(); ctx.translate(inst.x, p.y - r); ctx.rotate(inst.rot);
        const g = ctx.createRadialGradient(-12, -14, 4, 0, 0, r); g.addColorStop(0, '#b4a690'); g.addColorStop(0.55, '#7d6e5a'); g.addColorStop(1, '#3f342a');
        ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < 11; i++) { const a = i * TAU / 11, rr = r * (0.9 + ((i * 7) % 3) * 0.055); (i ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.05); ctx.lineTo(r * 0.3, -r * 0.1); ctx.moveTo(-r * 0.15, r * 0.4); ctx.lineTo(r * 0.2, r * 0.62); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.28, -r * 0.3); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.14, -0.6, 0, TAU); ctx.fill();
        if (moss) { ctx.fillStyle = 'rgba(86,130,66,0.8)'; ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.35, r * 0.32, r * 0.16, 0.5, 0, TAU); ctx.fill(); }
        ctx.restore();
    };

    // ---- icicles: tapering glassy shards with a bright edge and a drip ----
    K.icicles.front = function (ctx, inst, L) {
        for (const c of inst.list) {
            const jit = c.state === 'shake' ? (R() - 0.5) * 2 : 0, len = c.len * (c.state === 'regrow' ? c.grow : 1);
            if (len < 2) continue;
            const g = ctx.createLinearGradient(c.x - 5, 0, c.x + 5, 0); g.addColorStop(0, 'rgba(150,205,235,0.95)'); g.addColorStop(0.45, 'rgba(240,252,255,0.98)'); g.addColorStop(1, 'rgba(120,185,225,0.95)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x - 5.5 + jit, c.y); ctx.lineTo(c.x + jit + (c.x % 3 - 1), c.y + len); ctx.lineTo(c.x + 5.5 + jit, c.y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(c.x - 1.6 + jit, c.y + 2, 1.2, len * 0.55);
            if (c.state === 'hang' && ((c.x * 7 + inst.list.length) % 5 === 0)) { const dp = (Date.now() * 0.001 + c.x) % 1; ctx.fillStyle = `rgba(190,235,255,${1 - dp})`; ctx.beginPath(); ctx.arc(c.x, c.y + len + dp * 12, 1.2, 0, TAU); ctx.fill(); }
        }
    };

    // ---- lava vent: a cracked crater of dark rock around a bubbling magma pool ----
    K.lavaGeyser.back = function (ctx, inst, L) {
        const x = inst.x, y = inst.y, ph = inst.phase, t = inst.t || 0;
        const heat = ph === 'warn' ? 0.4 + 0.6 * (1 - inst.left / 110) : ph === 'active' ? 1 : ph === 'cool' ? 0.4 : 0.18 + 0.08 * Math.sin(t * 0.05);
        // rim rocks
        for (let i = -3; i <= 3; i++) { const rx = x + i * 7.5, rh = 5 + ((i * 17) % 3 + 3) % 3 * 1.6, g = ctx.createLinearGradient(0, y - rh, 0, y); g.addColorStop(0, '#4a3632'); g.addColorStop(1, '#1a0d0a'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(rx - 5, y); ctx.lineTo(rx - 2.5, y - rh); ctx.lineTo(rx + 3, y - rh * 0.8); ctx.lineTo(rx + 5, y); ctx.fill(); ctx.strokeStyle = `rgba(255,${110 + 60 * heat | 0},40,${0.3 + 0.6 * heat})`; ctx.lineWidth = 0.9; ctx.stroke(); }
        // the pool
        const pg = ctx.createRadialGradient(x, y - 1, 1, x, y - 1, 14); pg.addColorStop(0, `rgb(255,${200 * heat + 40 | 0},${90 * heat | 0})`); pg.addColorStop(1, `rgb(${120 + 90 * heat | 0},30,10)`);
        ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(x, y - 1, 13, 3.6, 0, 0, TAU); ctx.fill();
        if (heat > 0.4 && R() < 0.1 * heat) { ctx.strokeStyle = 'rgba(255,230,160,0.8)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x + RND(-8, 8), y - 1.5, 1 + R() * 2, Math.PI, 0); ctx.stroke(); }
        glow(ctx, x, y - 3, 30 + heat * 34, '255,110,30', 0.5 * heat);
    };

    // ---- low-gravity bubble: a thin iridescent shell with glints ----
    K.lowGravity.back = function (ctx, inst, L) {
        const t = inst.t;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(inst.cx, inst.cy, 10, inst.cx, inst.cy, inst.rx); gr.addColorStop(0, 'rgba(150,120,255,0.015)'); gr.addColorStop(0.8, 'rgba(150,120,255,0.07)'); gr.addColorStop(1, 'rgba(200,170,255,0.24)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(inst.cx, inst.cy, inst.rx, inst.ry, 0, 0, TAU); ctx.fill();
        // soap-film rim: the colour slides round it
        for (let k = 0; k < 24; k++) { const a0 = k / 24 * TAU + t * 0.01, a1 = a0 + TAU / 24 + 0.02, hue = (k * 15 + t * 0.6) % 360; ctx.strokeStyle = `hsla(${hue},85%,72%,${0.28 + 0.1 * Math.sin(t * 0.05 + k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(inst.cx, inst.cy, inst.rx, inst.ry, 0, a0, a1); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(inst.cx, inst.cy, inst.rx * 0.82, inst.ry * 0.82, -0.6, 3.6, 4.5); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(inst.cx, inst.cy, inst.rx * 0.9, inst.ry * 0.9, -0.6, 3.1, 3.35); ctx.stroke();
        for (const m of inst.motes) glow(ctx, inst.cx + Math.cos(m.a) * inst.rx * m.r, inst.cy + Math.sin(m.a * 1.3) * inst.ry * m.r, 4, '220,200,255', 0.6);
        ctx.restore();
    };

    // ---- ghost hands: bony hands rising out of glowing cracks ----
    K.ghostHands.front = function (ctx, inst, L) {
        if (inst.phase !== 'active') return;
        const up = Math.min(1, (70 - inst.left) / 10) * Math.min(1, inst.left / 10);
        for (let x = inst.x0 + 14; x < inst.x1; x += 28) {
            const h = 36 * up, wob = Math.sin(inst.t * 0.3 + x) * 3, y = inst.y;
            ctx.save(); ctx.globalAlpha = 0.9;
            const g = ctx.createLinearGradient(0, y, 0, y - h); g.addColorStop(0, 'rgba(120,230,150,0.2)'); g.addColorStop(1, 'rgba(190,255,205,0.95)');
            ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + wob, y - h * 0.55, x + wob * 1.4, y - h); ctx.stroke();   // the forearm
            ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(210,255,220,0.95)';
            for (let f = -2; f <= 2; f++) { const a = -Math.PI / 2 + f * 0.4 + Math.sin(inst.t * 0.2 + f) * 0.12, fx = x + wob * 1.4; ctx.beginPath(); ctx.moveTo(fx, y - h); ctx.lineTo(fx + Math.cos(a) * 9, y - h + Math.sin(a) * 9); ctx.lineTo(fx + Math.cos(a + 0.5 * Math.sign(f || 1)) * 14, y - h + Math.sin(a + 0.5 * Math.sign(f || 1)) * 14); ctx.stroke(); }
            ctx.restore();
            glow(ctx, x + wob, y - h, 14, '160,255,180', 0.3 * up);
        }
    };

    // ---- ice sheet: a gloss of frost with little crystals ----
    K.iceSlick.back = function (ctx, inst, L) {
        const w = inst.x1 - inst.x0, t = L.time;
        const gr = ctx.createLinearGradient(0, inst.y - 5, 0, inst.y + 3); gr.addColorStop(0, 'rgba(235,250,255,0.98)'); gr.addColorStop(1, 'rgba(140,200,240,0.75)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(inst.x0, inst.y + 1); ctx.quadraticCurveTo(inst.x0 + w / 2, inst.y - 8, inst.x1, inst.y + 1); ctx.lineTo(inst.x1, inst.y + 3); ctx.lineTo(inst.x0, inst.y + 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 5; i++) { const x = inst.x0 + 14 + i * (w - 28) / 4, h = 3 + (i * 7) % 4; ctx.beginPath(); ctx.moveTo(x - 2, inst.y - 1); ctx.lineTo(x, inst.y - h - 2); ctx.lineTo(x + 2, inst.y - 1); ctx.fill(); }
        const sx = inst.x0 + ((t * 2) % (w + 40)) - 20; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(sx, inst.y - 5, 16, 1.5); glow(ctx, sx + 8, inst.y - 4, 10, '230,250,255', 0.5);
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
        if (p.jx || p.dy || p.ga !== undefined) {   // a feature is shaking / dropping / fading this platform
            ctx.save(); ctx.translate(p.jx || 0, p.dy || 0); if (p.ga !== undefined) ctx.globalAlpha *= p.ga;
            platBase.call(this, ctx, p, pattern); ctx.restore(); return;
        }
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
    // Every timed hazard announces itself: from ~1.8s before it goes off, the area it will hit pulses in amber
    // caution light (stripes along the surface under it), faster and brighter as the moment gets closer.
    const TELEGRAPH_FRAMES = 110;
    function telegraph(ctx, f, L) {
        const KK = K[f.kind];
        if (!KK.danger || KK.ownTelegraph) return;
        let ds; try { ds = KK.danger(f, L); } catch (e) { return; }
        for (const d of ds) {
            if (d.kind === 'zone' || d.kind === 'pull' || !(d.soon > 0) || d.soon > TELEGRAPH_FRAMES) continue;
            const u = 1 - d.soon / TELEGRAPH_FRAMES, pulse = 0.5 + 0.5 * Math.sin(L.time * (0.18 + u * 0.7)), a = Math.min(1, u * 2.2);
            ctx.save();
            const tall = d.h > 140;
            if (tall) {   // tall columns (lightning, icicles, meteors): a soft amber shaft with edges
                const gr = ctx.createLinearGradient(0, d.y, 0, d.y + d.h); gr.addColorStop(0, 'rgba(255,190,60,0)'); gr.addColorStop(1, `rgba(255,190,60,${(0.08 + 0.14 * pulse) * a})`);
                ctx.fillStyle = gr; ctx.fillRect(d.x, d.y, d.w, d.h);
                ctx.strokeStyle = `rgba(255,200,80,${0.35 * a * (0.5 + pulse)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d.x, d.y + d.h * 0.3); ctx.lineTo(d.x, d.y + d.h); ctx.moveTo(d.x + d.w, d.y + d.h * 0.3); ctx.lineTo(d.x + d.w, d.y + d.h); ctx.stroke();
            } else { ctx.fillStyle = `rgba(255,190,60,${(0.05 + 0.1 * pulse) * a})`; ctx.fillRect(d.x, d.y, d.w, d.h); }
            // hazard stripes along the bottom edge (the surface the danger sits on)
            ctx.beginPath(); ctx.rect(d.x, d.y + d.h - 6, d.w, 6); ctx.clip();
            ctx.fillStyle = `rgba(255,200,40,${(0.25 + 0.4 * pulse) * a})`; ctx.fillRect(d.x, d.y + d.h - 6, d.w, 6);
            ctx.strokeStyle = `rgba(30,20,0,${0.7 * a})`; ctx.lineWidth = 3;
            for (let x = d.x - 12 + ((L.time * 0.9) % 16); x < d.x + d.w + 6; x += 16) { ctx.beginPath(); ctx.moveTo(x, d.y + d.h); ctx.lineTo(x + 8, d.y + d.h - 6); ctx.stroke(); }
            ctx.restore();
        }
    }
    const fxDraw = FX.prototype.draw;
    FX.prototype.draw = function (ctx) {
        const g = window.game, L = g && g.level;
        if (L && L.features && g.fx === this) for (const f of L.features) {
            ctx.save(); try { if (K[f.kind].front) K[f.kind].front(ctx, f, L, g); telegraph(ctx, f, L); } catch (e) { /* skip */ } ctx.restore();
        }
        fxDraw.call(this, ctx);
    };

    // a splash from a water or bubble weapon puts out whoever it hits
    const liBase = Game.prototype.lookImpact;
    if (liBase) Game.prototype.lookImpact = function (pr, p) { liBase.call(this, pr, p); if (pr.spec.look && /water|bubble|net|snow|shard|ice|frost/.test(pr.spec.look.s || '')) douse(this, p); };
    // ice does the same: anything that freezes or chills puts a fire out
    const asBase = Game.prototype.applyStatus;
    if (asBase) Game.prototype.applyStatus = function (p, st) { const r = asBase.apply(this, arguments); if (st && (st.freeze > 0) && p && p.status && p.status.burn > 0) douse(this, p); return r; };

    // a swing that reaches into one portal also comes out of the other
    const meleeBase = Game.prototype.meleeAttack;
    Game.prototype.meleeAttack = function (att, def) {
        meleeBase.call(this, att, def);
        const L = this.level;
        if (!L || !L.features) return;
        const range = WeaponDefs.reach(def);
        const box = { x: att.facing === 1 ? att.x + att.width : att.x - range, y: att.y, w: range, h: att.height };
        for (const f of L.features) {
            if (f.kind !== 'portals') continue;
            for (const [from, to] of [[f.a, f.b], [f.b, f.a]]) {
                if (!overlap(box, { x: from.x - 16, y: from.y - 34, w: 32, h: 68 })) continue;
                // the part of the swing past the portal continues from the other side, same direction
                const out = att.facing === 1 ? { x: to.x, y: to.y - att.height / 2, w: Math.max(10, box.x + box.w - from.x), h: att.height } : { x: to.x - Math.max(10, from.x - box.x), y: to.y - att.height / 2, w: Math.max(10, from.x - box.x), h: att.height };
                for (const p of this.players) {
                    if (p === att || p.isDead || p.team === att.team || !inBox(p, out)) continue;
                    p.lastHitType = att.weapon && def !== PUNCH ? att.weapon.type : null; p.lastHitAt = this.frameCount;
                    p.takeDamage(def.damage, att);
                    p.velocity.x = (def.pull ? -1 : 1) * att.facing * Math.abs(def.knock); p.velocity.y = def.lift;
                    if (def.status) this.applyStatus(p, def.status, att, p.lastHitType, def.damage);
                    this.fx.sparks(p.x + p.width / 2, p.y + 25, '190,140,255', 8, undefined, 0, 4);
                    AudioSys.playHit();
                }
                this.fx.streak(to.x, to.y, to.x + att.facing * Math.min(80, out.w), to.y, 3, '220,200,255', 10);
            }
        }
    };

    // environment modifiers on a fighter (ice, tar, quicksand, water, low gravity), applied around
    // the normal movement rules so nothing else in the controls changes
    const inputBase = Player.prototype.applyInput;
    Player.prototype.applyInput = function (input) {
        const e = this.env;
        if (this.isBird || this.onCloud) return inputBase.call(this, input);
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
        const out = L && L.extraDangers ? L.extraDangers.slice() : [];   // round events add theirs here
        if (typeof Terrain !== 'undefined' && Terrain.dangers && L) for (const d of Terrain.dangers(L)) out.push(d);   // ledges about to fall
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
            if (!L || ((!L.features || !L.features.length) && !(L.extraDangers && L.extraDangers.length) && !(typeof Terrain !== 'undefined' && Terrain.hasDangers && Terrain.hasDangers(L))) || me.isBird || me.onCloud || me.isDead) return out;
            const ds = dangers(L);
            if (!ds.length) return out;
            const win = WINDOW[this.difficulty] || 50;
            if (this.difficulty !== 'hack' && this.frame % 30 === 0) this.hazardAware = Math.random() < 0.85 + 0.15 * (this.profile.skills.dodge || 0);
            if (this.difficulty !== 'hack' && this.hazardAware === false) return out;
            const box = { x: me.x - 4, y: me.y, w: me.width + 8, h: me.height };
            const underLavaCover = (d) => d.kind === 'lava-drop' && L.platforms.some(p => p.active && !p.motion && p.type !== 'trampoline' &&
                p.x < me.x + me.width && p.x + p.width > me.x && p.x < d.x + d.w && p.x + p.width > d.x &&
                d.y + d.h <= p.y + 10 && p.y + p.height <= me.y + 6);
            const shelteredFromLava = me.grounded && ds.some(d => d.soon <= win && underLavaCover(d));
            const threat = ds.find(d => d.soon <= win && !underLavaCover(d) && (overlap(box, d) || d.kind === 'lava-drop' &&
                me.x + me.width + 72 > d.x && me.x - 72 < d.x + d.w &&
                Math.abs(me.y + me.height / 2 - (d.y + d.h / 2)) < 150));
            if (threat) {
                if (this.plan && this.plan.tag !== 'hazard') this.plan = null;
                // Choose an escape by simulating it on the same platform graph as
                // normal navigation. Picking the nearest edge of a warning box
                // ignored ledges and repeatedly sent bots into void or lava.
                const horizon = Math.min(60, Math.max(18, (threat.soon || 0) + 8));
                const wantedX = out.x;
                let best = null;
                const choices = [[0, false], [-1, false], [1, false]];
                if (['lane', 'floor', 'lava-drop', 'lava-vent'].includes(threat.kind)) choices.push([-1, true], [1, true], [0, true]);
                for (const [dir, jump] of choices) {
                    const plan = BotSim.plan(dir, 999, dir, jump ? 0 : -1, jump ? 12 : 0);
                    let exposure = 0;
                    const res = BotSim.run(me, plan, this.world, horizon, {
                        untilLand: false,
                        onStep: (ghost, t) => {
                            const body = { x: ghost.x, y: ghost.y, w: ghost.width, h: ghost.height };
                            for (const d of ds) if (d.soon <= win && t + 4 >= Math.max(0, d.soon || 0) && overlap(body, d)) exposure++;
                            return false;
                        }
                    });
                    const unsupported = !res.landed && !res.dead;
                    const score = exposure * 12 + (res.dead ? 10000 : 0) + (unsupported ? 650 : 0) + (dir === wantedX ? 0 : 3) + (jump ? 2 : 0);
                    if (!best || score < best.score) best = { dir, jump, score };
                }
                if (best) { out.x = best.dir; out.jump = best.jump; }
                out.y = 0;
                if (threat.soon < 12 && this.profile.skills.shield > Math.random() && !me.shieldCd) out.shield = true;
                return out;
            }
            if (shelteredFromLava) {
                // The overhead ledge blocks the falling blob, so waiting here is
                // safer than leaving cover to chase a target or a pickup.
                this.plan = null; out.x = 0; out.y = 0; out.jump = false;
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

    // things that drag fighters in (tornado, black hole): [{x, y, rad, core, kind}]
    function pullers(L) {
        const out = [];
        if (!L || !L.features) return out;
        for (const f of L.features) { const KK = K[f.kind]; if (KK.puller) { try { const q = KK.puller(f, L); if (q) out.push(q); } catch (e) { /* skip */ } } }
        return out;
    }
    // light sources among the map features, for rounds where the lights go out (round-events.js: blackout):
    // anything burning, sparking or glowing lights its surroundings: [{x, y, r}]
    function lights(L) {
        const out = [];
        if (!L || !L.features) return out;
        const fy = floorY(L);
        for (const f of L.features) {
            try {
                switch (f.kind) {
                    case 'flameJet': { const k = f.phase === 'warn' ? prog(f, 80) * 0.5 : f.phase === 'active' ? 1 : 0.12; out.push({ x: f.x + f.dir * 10, y: f.y - 22, r: 60 + 80 * k }); if (f.phase === 'active') for (let d = 50; d <= 200; d += 50) out.push({ x: f.x + f.dir * d, y: f.y - 22, r: 120 }); break; }
                    case 'lavaGeyser': { const k = f.phase === 'active' ? 1 : f.phase === 'warn' ? 0.4 + 0.5 * prog(f, 110) : 0.25; out.push({ x: f.x, y: f.y - 4, r: 70 + 90 * k }); if (f.phase === 'active') for (const b of f.blobs || []) out.push({ x: b.x, y: b.y, r: 90 }); for (const sp of f.splats || []) out.push({ x: sp.x, y: sp.y - 2, r: 40 + 30 * sp.life / 260 }); break; }
                    case 'teslaCoils': { const k = f.phase === 'active' ? 1 : f.phase === 'warn' ? prog(f, 90) : 0.1; for (const x of [f.a, f.b]) out.push({ x, y: f.y - 70, r: 50 + 70 * k }); if (f.phase === 'active') for (let i = 1; i < 5; i++) out.push({ x: f.a + (f.b - f.a) * i / 5, y: f.y - 70, r: 130 }); break; }
                    case 'lightningStrike': if (f.phase === 'active') { out.push({ x: f.x, y: f.ground - 40, r: 320 }); out.push({ x: f.x, y: f.ground - 200, r: 300 }); } else if (f.phase === 'warn') out.push({ x: f.x, y: f.ground - 10, r: 60 * prog(f, 100) }); break;
                    case 'meteorShower': for (const r of f.rocks) if (r.t > 0) { const k = r.t / r.T; out.push({ x: r.x - 600 * (1 - k), y: r.gy - 1100 * (1 - k), r: 90 + 90 * k }); } break;
                    case 'portals': for (const o of [f.a, f.b]) out.push({ x: o.x, y: o.y, r: 100 }); break;
                    case 'blackHole': if (f.k > 0.05) out.push({ x: f.cx, y: f.cy, r: 120 + 160 * f.k }); for (const e of f.exits || []) out.push({ x: e.x, y: e.y, r: 130 }); break;
                    case 'healingSpring': out.push({ x: f.x, y: f.y - 12, r: f.style === 'fire' || f.style === 'cocoa' ? 150 : 100 }); break;
                    case 'chandelier': if (f.state !== 'gone') out.push({ x: f.x, y: f.y - 10, r: 170 }); break;
                    case 'laserSweep': if (f.phase === 'active' && f.len) { for (let d = 60; d < f.len; d += 120) out.push({ x: f.x + Math.cos(f.a) * d, y: f.y + Math.sin(f.a) * d, r: 110 }); out.push({ x: f.x, y: f.y, r: 70 }); } break;
                    case 'press': for (const bx of [f.block.x + 20, f.block.x + f.block.width - 20]) out.push({ x: bx, y: f.block.y - 6, r: f.phase === 'warn' ? 80 : 30 }); break;
                    case 'steamVent': break;
                    default: break;
                }
            } catch (e) { /* skip */ }
        }
        return out;
    }
    return { KINDS: K, plan, dangers, pullers, lights, simReachable, shift, hurt, env, douse, ceilingAbove, count: () => Object.keys(K).length };
})();
