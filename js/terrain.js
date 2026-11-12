// Real ground. Every ledge and floor is built of something with a hardness and a behaviour, not a locked rectangle:
//
//  * MATERIALS: each theme has its own ground, ledges and walls (earth and timber, bedrock and stone, ice, crystal,
//    steel, basalt, sandstone and driftwood, cake and wafer, crypt stone and rotten planks, packed snow and
//    gingerbread). A material has a toughness (in "punch units": one fist punch is 1, so soft things go in three
//    punches, stone needs several explosions, steel and bedrock a lot more) and real properties: ice and snow are
//    slippery, cake slows you down, and so on.
//  * DESTRUCTION: every platform is made of cells. Punches, swings, bullets, explosions, meteors and lightning wear the
//    cells they touch away; cracks show before a cell goes, and when one does the ledge is cut in two (or the floor
//    gets a hole) and the pieces fly.
//  * SUPPORT: only a few ledges float (clouds, crystals and asteroids mostly). The rest stand on pillars (posts,
//    columns, trusses, piles, candy canes, crystals), hang from the ceiling on chains or vines and sway under weight,
//    or float on liquid and sink when too many stand on them. Break the supports and the ledge creaks, shakes and
//    falls, crushing what is under it. A big enough blast launches a loose ledge away.
const Terrain = (() => {
    const TAU = Math.PI * 2, R = Math.random, RND = (a, b) => a + R() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------- what everything is made of ----------
    // toughness in punch units, grip (1 = normal, low = slides), speed and jump multipliers, debris colour
    const M = (name, hp, o) => Object.assign({ name, hp, grip: 1, speed: 1, jump: 1, debris: '#7a6a5a', sup: 6 }, o || {});
    const MATS = {
        dirt:    { ground: M('earth', 6, { debris: '#6b4a2e', sup: 5 }), ledge: M('timber', 4, { debris: '#8d6e45', sup: 5 }), wall: M('rock', 12, { debris: '#7a7468', sup: 8 }) },
        stone:   { ground: M('bedrock', 40, { debris: '#6a6a72', sup: 16 }), ledge: M('stone', 14, { debris: '#8a8a92', sup: 14 }), wall: M('stone', 16, { debris: '#8a8a92', sup: 16 }) },
        ice:     { ground: M('ice', 5, { grip: 0.07, debris: '#cfeaf8', sup: 4 }), ledge: M('ice', 3, { grip: 0.07, debris: '#e3f5ff', sup: 4 }), wall: M('ice', 6, { grip: 0.07, debris: '#cfeaf8', sup: 5 }) },
        cloud:   { ground: M('cloud', 4, { debris: '#ffffff', sup: 3 }), ledge: M('cloud', 3, { debris: '#f4f8ff', sup: 3 }), wall: M('cloud', 4, { debris: '#ffffff', sup: 3 }) },
        magic:   { ground: M('crystal', 24, { debris: '#c09bff', sup: 12 }), ledge: M('crystal', 10, { debris: '#d1b3ff', sup: 8 }), wall: M('crystal', 14, { debris: '#b58bff', sup: 10 }) },
        neon:    { ground: M('steel', 30, { debris: '#5b6272', sup: 18 }), ledge: M('alloy', 18, { debris: '#7a8294', sup: 14 }), wall: M('steel', 22, { debris: '#5b6272', sup: 16 }) },
        lava:    { ground: M('basalt', 24, { debris: '#3a2a28', sup: 14 }), ledge: M('obsidian', 16, { debris: '#2a1a1a', sup: 12 }), wall: M('basalt', 20, { debris: '#3a2a28', sup: 14 }) },
        ocean:   { ground: M('sandstone', 8, { debris: '#c9b48a', sup: 6 }), ledge: M('driftwood', 4, { debris: '#8a6f4a', sup: 5 }), wall: M('coral', 10, { debris: '#ff8a80', sup: 8 }) },
        candy:   { ground: M('cake', 4, { speed: 0.9, debris: '#f6d7a7', sup: 4 }), ledge: M('wafer', 3, { debris: '#e8b36a', sup: 4 }), wall: M('gumdrop', 6, { debris: '#ff6fa8', sup: 5 }) },
        haunted: { ground: M('crypt stone', 18, { debris: '#4a4250', sup: 12 }), ledge: M('rotten planks', 3, { debris: '#4a3c3a', sup: 4 }), wall: M('tomb stone', 16, { debris: '#4a4250', sup: 12 }) },
        xmas:    { ground: M('packed snow', 8, { grip: 0.45, debris: '#ffffff', sup: 5 }), ledge: M('gingerbread', 4, { debris: '#a8683c', sup: 5 }), wall: M('candy cane', 8, { debris: '#e53935', sup: 7 }) }
    };
    // share of loose ledges that simply float (clouds, crystals and asteroids do; most things do not)
    // Only intentionally airborne materials get unsupported ledges. Ordinary terrain must be
    // visibly tied to another ledge, the floor, or a ceiling support.
    const FLOAT = { cloud: 0.85, magic: 0.7 };
    const PILLAR = { dirt: 'post', stone: 'column', ice: 'icepillar', magic: 'crystal', neon: 'truss', lava: 'column', ocean: 'pile', candy: 'cane', haunted: 'trunk', xmas: 'cane' };
    const HANG = { dirt: 'vine', stone: 'chain', ice: 'chain', cloud: 'rope', magic: 'tether', neon: 'cable', lava: 'chain', ocean: 'rope', candy: 'licorice', haunted: 'chain', xmas: 'garland' };
    const LIQUID = { lava: 1, candy: 1, ice: 1 };

    const matOf = (L, role) => (MATS[L.material] || MATS.dirt)[role];
    const alive = (g) => g ? g.players.filter(p => !p.isDead) : [];
    const tremor = (g, x, y, k) => { if (!g || g.demo) return; if (alive(g).some(p => !p.isBot && Math.abs(p.x - x) < 500)) g.fx.addTrauma(k); };

    // ---------- building the terrain of a freshly built layout ----------
    function apply(L) {
        L.supports = []; L.hung = []; L.rafts = []; L.fallers = []; L.terrainV = (L.terrainV || 0) + 1;
        const H = L.height, all = L.platforms;
        const visibleAnchor = (q) => q.active && q.type === 'static' && !q.motion && !q.feature && !q.featureTag && !q.noDraw;
        const ceilingAbove = (x0, x1, y) => {
            let best = -60;
            for (const q of all) if (visibleAnchor(q) && q.x < x1 && q.x + q.width > x0 && q.y + q.height <= y && q.y + q.height > best) best = q.y + q.height;
            return best;
        };
        for (const p of all.slice()) {
            if (!p.active || p.type !== 'static' || p.motion || p.feature || p.featureTag || p.noDraw || p.mech) continue;
            const role = p.y + p.height >= H - 2 ? 'ground' : p.height >= 80 ? 'wall' : 'ledge', mat = matOf(L, role);
            p.role = role; p.mat = mat;
            const cw = role === 'ground' ? 48 : 28, n = Math.max(2, Math.round(p.width / cw));
            p.cellW = p.width / n; p.cells = new Array(n).fill(mat.hp);
            p.supports = [];
            if (role === 'ground') { p.kind = 'ground'; continue; }
            // what is under it?
            let underY = H;
            // Feature platforms may be invisible collision helpers (and moving platforms move away).
            // Never terminate a backdrop support against one of those; use stable, visible terrain.
            for (const q of all) if (q !== p && visibleAnchor(q) && q.y >= p.y + p.height - 2 && Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x) >= 20 && q.y < underY) underY = q.y;
            const gap = underY - (p.y + p.height);
            if (gap < 16) { p.kind = 'rest'; continue; }
            const fl = FLOAT[L.material] || 0;
            const raftOK = LIQUID[L.material] && L.voidSurface !== undefined && p.y + p.height > L.voidSurface - 150 && p.width < 520;
            let kind;
            if (raftOK) kind = 'raft';
            else if (R() < fl) kind = 'float';
            else if (p.y < 520 && p.y > 60 && R() < 0.4) kind = 'hang';
            else if (PILLAR[L.material] && gap <= 520) kind = 'pillars';
            else if (p.y < 460) kind = 'hang';
            else kind = PILLAR[L.material] ? 'pillars' : 'float';
            p.kind = kind;
            const sm = mat.sup;
            if (kind === 'pillars') {
                const two = p.width >= 170, xs = two ? [p.x + p.width * 0.16, p.x + p.width * 0.84] : [p.x + p.width / 2];
                for (const x of xs) { const s = { kind: 'pillar', style: PILLAR[L.material], plat: p, rx: x - p.x, w: 14 + (two ? 0 : 4), y1: underY, hp: sm, maxHp: sm, x }; p.supports.push(s); L.supports.push(s); }
            } else if (kind === 'hang') {
                for (const x of [p.x + p.width * 0.22, p.x + p.width * 0.78]) { const s = { kind: 'chain', style: HANG[L.material] || 'chain', plat: p, rx: x - p.x, ax: x, y0: ceilingAbove(x - 6, x + 6, p.y), hp: Math.max(3, sm * 0.5), maxHp: Math.max(3, sm * 0.5), x, w: 4 }; p.supports.push(s); L.supports.push(s); }
                p.dyn = { x: 0, y: 0, vx: 0, vy: 0, t: R() * 200, riders: 0 }; L.hung.push(p);
            } else if (kind === 'raft') {
                p.dyn = { depth: 0, t: R() * 200, y0: p.y, load: 0, sunk: 0 }; L.rafts.push(p);
            }
        }
    }

    // ---------- damage ----------
    const chunks = (g, x, y, mat, n, spread, up) => {
        for (let i = 0; i < n; i++) g.fx.add({ type: 'chunk', x: x + RND(-spread, spread), y: y + RND(-4, 4), vx: RND(-2.4, 2.4), vy: -RND(0.5, 4) * (up || 1), life: 40 + R() * 30, color: mat.debris, size: 2.5 + R() * 4.5, gravity: 0.35, rot: R() * 6, vr: RND(-0.3, 0.3), drag: 0.99 });
    };
    const dustFor = (L) => (typeof DUST_TINT !== 'undefined' && DUST_TINT[L.material]) || '200,190,180';

    // wear the cells of p between x0 and x1 down by `units` (each cell gets its own share), returns true if any went
    function wear(g, p, x0, x1, units, spread) {
        let broke = false;
        const cw = p.cellW, n = p.cells.length;
        const i0 = clamp(Math.floor((x0 - p.x) / cw), 0, n - 1), i1 = clamp(Math.floor((x1 - p.x) / cw), 0, n - 1);
        for (let i = i0; i <= i1; i++) {
            if (p.cells[i] <= 0) continue;
            const cx = p.x + (i + 0.5) * cw, w = spread ? 1 - Math.min(1, Math.abs(cx - (x0 + x1) / 2) / (spread + cw)) * 0.5 : 1;
            const before = p.cells[i];
            p.cells[i] -= units * w;
            if (p.cells[i] <= 0) {
                broke = true; chunks(g, cx, p.y + p.height / 2, p.mat, 7, cw / 2);
                g.fx.dust(cx, p.y + p.height / 2, 4, cw, dustFor(g.level));
            } else if (before > p.cells[i] && R() < 0.5) {
                const f = 1 - p.cells[i] / p.mat.hp;
                chunks(g, cx, p.y + p.height * 0.5, p.mat, 1 + (f * 3 | 0), cw / 3, 0.5);
            }
            p.hitAt = g.frameCount;
        }
        return broke;
    }

    // a ledge has lost cells: cut it into the pieces that remain
    function settle(g, p) {
        const L = g.level, cw = p.cellW, n = p.cells.length, runs = [];
        let s = -1;
        for (let i = 0; i <= n; i++) { const ok = i < n && p.cells[i] > 0; if (ok && s < 0) s = i; else if (!ok && s >= 0) { runs.push([s, i]); s = -1; } }
        if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] === n) return;
        L.terrainV++;
        const old = { x: p.x, supports: p.supports.slice(), cells: p.cells.slice() };
        if (!runs.length) { killPlatform(g, p, false); return; }
        const pieces = [];
        runs.forEach(([a, b], k) => {
            let q = p;
            if (k === 0) { q.x = old.x + a * cw; q.width = (b - a) * cw; q.cells = old.cells.slice(a, b); }
            else {
                q = L.createPlatform(old.x + a * cw, p.y, (b - a) * cw, p.height);
                q.seed = p.seed + k * 17.3; q.mat = p.mat; q.role = p.role; q.kind = p.kind; q.cellW = cw; q.cells = old.cells.slice(a, b); q.supports = []; q.fromCut = true;
                if (p.dyn) q.dyn = Object.assign({}, p.dyn, { riders: 0 });
                if (p.kind === 'hang') L.hung.push(q);
                if (p.kind === 'raft') L.rafts.push(q);
                if (p.collapse) { q.collapse = Object.assign({}, p.collapse); L.fallers.push(q); }
            }
            pieces.push(q);
        });
        // supports go with the piece above them; any that now stand under a hole come down
        for (const s of old.supports) {
            const home = pieces.find(q => s.x >= q.x - 1 && s.x <= q.x + q.width + 1);
            if (!home) { if (!s.dead) { s.dead = true; s.hp = 0; chunks(g, s.x, (s.y0 !== undefined ? s.y0 : p.y) + 40, p.mat, 5, 8); } continue; }
            s.plat = home; s.rx = s.x - home.x; home.supports.push(s);
        }
        L.supports = L.supports.filter(s => !s.dead);
        for (const q of pieces) {
            if ((q.kind === 'pillars' || q.kind === 'hang') && !q.supports.length) startCollapse(g, q, { warn: 40 });
        }
        AudioSys.playHit && AudioSys.playHit();
    }
    function killPlatform(g, p, quiet) {
        const L = g.level;
        p.active = false;
        if (!quiet) { chunks(g, p.x + p.width / 2, p.y + p.height / 2, p.mat || { debris: '#888' }, 12, p.width / 3); g.fx.dust(p.x + p.width / 2, p.y + p.height / 2, 8, p.width / 2, dustFor(L)); }
        for (const s of p.supports || []) { s.dead = true; s.hp = 0; }
        L.supports = (L.supports || []).filter(s => !s.dead);
        L.terrainV++;
    }

    // circle (explosions, impacts): [x, y, r]
    function hitCircle(g, x, y, r, units) {
        const L = g.level; if (!L.supports) return;
        for (const p of L.platforms.slice()) {
            if (!p.active || !p.cells) continue;
            const nx = clamp(x, p.x, p.x + p.width), ny = clamp(y, p.y, p.y + p.height), d = Math.hypot(nx - x, ny - y);
            if (d > r) continue;
            const f = 1 - (d / r) * 0.55, chord = Math.sqrt(Math.max(0, r * r - (ny === y ? 0 : (ny - y) * (ny - y))));
            if (wear(g, p, x - chord, x + chord, units * f, chord)) settle(g, p);
        }
        hitSupports(g, x, y, r, units);
    }
    // rectangle (a swing): damages what it overlaps; `skip` is the ledge the attacker stands on
    function hitBox(g, box, units, skip) {
        const L = g.level; if (!L.supports) return;
        for (const p of L.platforms.slice()) {
            if (!p.active || !p.cells || p === skip) continue;
            if (p.x >= box.x + box.w || p.x + p.width <= box.x || p.y >= box.y + box.h || p.y + p.height <= box.y) continue;
            if (wear(g, p, Math.max(p.x, box.x), Math.min(p.x + p.width, box.x + box.w), units, 0)) settle(g, p);
        }
        hitSupports(g, box.x + box.w / 2, box.y + box.h / 2, Math.max(box.w, box.h) / 2 + 6, units * 0.8);
    }
    function hitSupports(g, x, y, r, units) {
        const L = g.level;
        for (const s of L.supports.slice()) {
            if (s.dead || !s.plat || !s.plat.active) continue;
            const top = s.kind === 'chain' ? s.y0 : s.plat.y + s.plat.height, bot = s.kind === 'chain' ? s.plat.y : s.y1;
            const sx = s.kind === 'chain' ? s.ax : s.plat.x + s.rx, nx = clamp(x, sx - s.w / 2, sx + s.w / 2), ny = clamp(y, top, bot), d = Math.hypot(nx - x, ny - y);
            if (d > r) continue;
            s.hp -= units * (1 - d / r * 0.5);
            s.hitAt = g.frameCount;
            if (R() < 0.6) chunks(g, nx, ny, s.plat.mat, 2, 6, 0.6);
            if (s.hp <= 0) killSupport(g, s);
        }
    }
    function killSupport(g, s) {
        if (s.dead) return;
        const L = g.level, p = s.plat;
        s.dead = true; s.hp = 0;
        const my = s.kind === 'chain' ? (s.y0 + p.y) / 2 : (p.y + p.height + s.y1) / 2;
        chunks(g, s.kind === 'chain' ? s.ax : p.x + s.rx, my, p.mat, 10, 10);
        g.fx.dust(s.kind === 'chain' ? s.ax : p.x + s.rx, my, 6, 16, dustFor(L));
        tremor(g, p.x, p.y, 0.06);
        AudioSys.playHit && AudioSys.playHit();
        p.supports = p.supports.filter(q => q !== s);
        L.supports = L.supports.filter(q => !q.dead);
        L.terrainV++;
        if (!p.supports.length && (p.kind === 'pillars' || p.kind === 'hang')) startCollapse(g, p, { warn: 45 });
        else p.weak = true;   // one of two: it creaks and drops dust, and a shove finishes it
    }

    // ---------- falling ledges ----------
    function startCollapse(g, p, o) {
        if (p.collapse || !p.active || p.role === 'ground') return;
        o = o || {};
        p.collapse = { t: 0, warn: o.warn === undefined ? 45 : o.warn, vy: o.vy || 0, vx: o.vx || 0, hit: new Set() };
        g.level.fallers.push(p);
        if (p.kind === 'hang') { p.dyn = p.dyn || { x: 0, y: 0, vx: 0, vy: 0, t: 0 }; }
    }
    const shift = (g, p, dx, dy) => (typeof Features !== 'undefined' && Features.shift) ? Features.shift(g, p, dx, dy) : (p.x += dx, p.y += dy);
    function stepFallers(L, g) {
        for (const p of L.fallers.slice()) {
            const c = p.collapse;
            if (!p.active) { L.fallers = L.fallers.filter(q => q !== p); continue; }
            c.t++;
            if (c.t <= c.warn) {
                // it creaks, dust and grit rain from the joints, it shivers
                p.jx = (R() - 0.5) * (1 + 4 * c.t / Math.max(1, c.warn));
                if (c.t % 4 === 0) g.fx.add({ type: 'chunk', x: p.x + R() * p.width, y: p.y + p.height, vx: RND(-0.4, 0.4), vy: RND(0, 1), life: 30, color: p.mat.debris, size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 });
                if (c.t % 7 === 0) g.fx.dust(p.x + R() * p.width, p.y + p.height, 2, 10, dustFor(L));
                if (c.t === 1) tremor(g, p.x, p.y, 0.05);
                continue;
            }
            p.jx = 0;
            c.vy = Math.min(22, c.vy + 0.6);
            const oldBottom = p.y + p.height;
            shift(g, p, c.vx, c.vy); c.vx *= 0.995;
            // crush whoever is under it as it comes down
            for (const pl of alive(g)) {
                if (c.hit.has(pl) || pl.ridePlat === p) continue;
                if (pl.x + pl.width > p.x && pl.x < p.x + p.width && pl.y + pl.height > p.y && pl.y < p.y + p.height) {
                    c.hit.add(pl); pl.lastHitType = 'env'; pl.lastHitAt = g.frameCount; pl.takeDamage(20, null);
                    pl.velocity.y = Math.max(pl.velocity.y, 3); pl.velocity.x += (pl.x + 15 < p.x + p.width / 2 ? -1 : 1) * 3; g.fx.sparks(pl.x + 15, pl.y + 25, '255,220,160', 8, undefined, 0, 5);
                }
            }
            // it lands on what is below and breaks
            let land = null;
            for (const q of L.platforms) {
                if (q === p || !q.active || q.type === 'trampoline' || q.fallingNow) continue;
                if (p.x + p.width > q.x && p.x < q.x + q.width && oldBottom <= q.y + 2 && p.y + p.height >= q.y && (!land || q.y < land.y)) land = q;
            }
            if (land || p.y > L.height + 60) {
                if (land) {
                    chunks(g, p.x + p.width / 2, land.y - 4, p.mat, 14, p.width / 3, 1.4); g.fx.dust(p.x + p.width / 2, land.y, 10, p.width, dustFor(L)); tremor(g, p.x, land.y, 0.18);
                    AudioSys.playExplosion && AudioSys.playExplosion();
                    hitBox(g, { x: p.x, y: land.y - 4, w: p.width, h: 10 }, 3 + p.width / 60, p);
                    for (const pl of alive(g)) if (pl.ridePlat === p) { pl.lastHitType = 'env'; pl.lastHitAt = g.frameCount; pl.takeDamage(8, null); }
                }
                killPlatform(g, p, !land);
                L.fallers = L.fallers.filter(q => q !== p);
            }
        }
    }

    // ---------- hanging and floating ledges ----------
    const ridersOf = (g, p) => alive(g).filter(pl => pl.velocity.y >= -1 && pl.y + pl.height >= p.y - 6 && pl.y + pl.height <= p.y + 10 && pl.x + pl.width > p.x && pl.x < p.x + p.width);
    function stepHung(L, g) {
        for (const p of L.hung) {
            if (!p.active || p.collapse || !p.dyn) continue;
            const d = p.dyn, riders = ridersOf(g, p), n = riders.length;
            d.t++;
            let tx = 0;
            if (n) { const avg = riders.reduce((s, r) => s + r.x + r.width / 2, 0) / n; tx = clamp((avg - (p.x + p.width / 2)) * 0.05, -8, 8); }
            if (n > d.riders) d.vy += 1.1 + Math.min(1.2, n * 0.3);      // someone lands: it dips
            d.riders = n;
            const ty = Math.min(22, n * 13), sway = Math.sin(d.t * 0.025) * 1.4;
            d.vy += (ty - d.y) * 0.06; d.vy *= 0.88; d.vx += (tx + sway - d.x) * 0.05; d.vx *= 0.9;
            const nx = clamp(d.x + d.vx, -12, 12), ny = clamp(d.y + d.vy, -4, 26);
            if (Math.abs(nx - d.x) > 0.001 || Math.abs(ny - d.y) > 0.001) shift(g, p, nx - d.x, ny - d.y);
            d.x = nx; d.y = ny;
        }
    }
    function stepRafts(L, g) {
        for (const p of L.rafts) {
            if (!p.active || p.collapse || !p.dyn) continue;
            const d = p.dyn, riders = ridersOf(g, p), n = riders.length, cap = Math.max(1, Math.floor(p.width / 85));
            d.t++;
            const over = n > cap;
            d.depth = clamp(d.depth + (over ? 0.35 * (n / cap) : n ? 0.05 : -0.2), 0, 120);
            // it rides the swell and settles under weight; under too much, it goes down
            const target = d.y0 + Math.sin(d.t * 0.045) * 2.2 + d.depth * 0.5 - p.y + (p.y - p.y);
            const ty = d.y0 + Math.sin(d.t * 0.045) * 2.2 + Math.min(18, n * 7) + d.depth * 0.4;
            const dy = clamp(ty - p.y, -1.2, 1.6);
            if (Math.abs(dy) > 0.001) shift(g, p, 0, dy);
            if (over && R() < 0.2) g.fx.add({ type: 'drop', x: p.x + R() * p.width, y: p.y + p.height, vx: RND(-0.5, 0.5), vy: -RND(1, 2.5), life: 22, color: 'rgba(255,255,255,0.7)', size: 1.6, gravity: 0.3 });
            if (d.depth >= 100) { d.sunk = 1; startCollapse(g, p, { warn: 0, vy: 0.2 }); p.sinking = true; }
        }
    }

    // ---------- properties of the surface you stand on ----------
    function envStep(L, g) {
        for (const p of alive(g)) {
            const pl = p.ridePlat;
            if (!pl || !pl.mat || !p.grounded || (pl.mat.grip === 1 && pl.mat.speed === 1 && pl.mat.jump === 1)) continue;
            const e = p.env || (p.env = { grip: 1, speed: 1, jump: 1, grav: 1 });
            e.grip = Math.min(e.grip, pl.mat.grip); e.speed = Math.min(e.speed, pl.mat.speed); e.jump = Math.min(e.jump, pl.mat.jump);
            if (pl.mat.grip < 0.3 && Math.abs(p.velocity.x) > 3 && R() < 0.2) g.fx.add({ type: 'puff', x: p.x + p.width / 2, y: p.y + p.height, vx: 0, vy: -0.3, life: 20, color: '235,248,255', size: 2, grow: 0.1, alpha: 0.55 });
        }
    }

    // a ledge that is loose (floating, hanging, falling) is launched by a big blast
    function launch(g, x, y, b) {
        const L = g.level; if (!L.supports) return;
        const k = (b.knock || 10) * 0.55, r = b.radius * 1.1;
        for (const p of L.platforms.slice()) {
            if (!p.active || !p.cells || p.role === 'ground' || p.kind === 'rest' || p.collapse) continue;
            if (p.kind === 'pillars' && p.supports.length) continue;
            const nx = clamp(x, p.x, p.x + p.width), ny = clamp(y, p.y, p.y + p.height), d = Math.hypot(nx - x, ny - y);
            if (d > r || k < 5) continue;
            const f = 1 - d / r, dx = (p.x + p.width / 2 - x) || 1, dy = (p.y - y) || -1, len = Math.hypot(dx, dy) || 1, sp = (k * f * 60) / (30 + p.width * 0.25);
            if (sp < 2) continue;
            startCollapse(g, p, { warn: 0, vx: dx / len * sp, vy: dy / len * sp - 3 });
        }
    }

    // ---------- driving it ----------
    function step(L, g) {
        if (!L.supports) return;
        for (const p of L.platforms) if (p.jx && !p.collapse && !p.weak) p.jx = 0;
        stepHung(L, g); stepRafts(L, g); stepFallers(L, g); envStep(L, g);
        // a weakened ledge (one support gone) creaks and drops dust now and then
        for (const p of L.platforms) if (p.weak && p.active && !p.collapse && R() < 0.02) { g.fx.dust(p.x + R() * p.width, p.y + p.height, 1, 8, dustFor(L)); g.fx.add({ type: 'chunk', x: p.x + R() * p.width, y: p.y + p.height, vx: 0, vy: 0.5, life: 24, color: p.mat.debris, size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 }); }
    }

    // what the bots should keep away from: ledges that are about to fall or are falling
    function dangers(L) {
        const out = [];
        if (!L.fallers) return out;
        for (const p of L.fallers) {
            if (!p.active || !p.collapse) continue;
            const c = p.collapse;
            if (c.t <= c.warn) out.push({ x: p.x, y: p.y - 70, w: p.width, h: 74, soon: c.warn - c.t + 1, kind: 'floor' });
            else out.push({ x: p.x - 6, y: p.y, w: p.width + 12, h: 340, soon: 0 });
        }
        return out;
    }
    const hasDangers = (L) => !!(L.fallers && L.fallers.length);

    // ---------- drawing ----------
    function drawSupport(ctx, L, s, t) {
        const p = s.plat; if (!p || !p.active || s.dead) return;
        const hurt = 1 - s.hp / s.maxHp;
        if (s.kind === 'chain') {
            const ax = s.ax, ay = s.y0, bx = p.x + s.rx, by = p.y + 1, st = s.style;
            const col = { vine: '#4f7a38', chain: '#7a7a84', rope: '#8d6e45', tether: 'rgba(200,160,255,0.9)', cable: '#2a2f3a', licorice: '#2a1a24', garland: '#2f8a4a' }[st] || '#7a7a84';
            ctx.strokeStyle = col; ctx.lineWidth = st === 'cable' || st === 'licorice' ? 3.4 : 2.6; ctx.lineCap = 'round';
            if (st === 'chain') { ctx.setLineDash([5, 3]); ctx.lineWidth = 3; }
            ctx.beginPath(); ctx.moveTo(ax, ay); const mx = (ax + bx) / 2 + Math.sin(t * 0.03 + ax) * 1.5; ctx.quadraticCurveTo(mx, (ay + by) / 2, bx, by); ctx.stroke(); ctx.setLineDash([]);
            if (st === 'vine') { ctx.fillStyle = '#6aa84f'; for (let k = 0.15; k < 1; k += 0.2) { const x = ax + (bx - ax) * k + 4, y = ay + (by - ay) * k; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.4, 0.7, 0, TAU); ctx.fill(); } }
            if (st === 'garland') { for (let k = 0.1; k < 1; k += 0.14) { const x = ax + (bx - ax) * k, y = ay + (by - ay) * k; ctx.fillStyle = ['#ffd740', '#ff5252', '#40c4ff'][(k * 10 | 0) % 3]; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill(); } }
            if (st === 'tether' || st === 'cable') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = st === 'tether' ? 'rgba(190,140,255,0.5)' : 'rgba(0,229,255,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore(); }
            ctx.fillStyle = '#3a3a40'; ctx.fillRect(ax - 7, ay - 4, 14, 7);   // the anchor
            ctx.fillStyle = '#5a5a62'; ctx.beginPath(); ctx.arc(bx, by, 3.2, 0, TAU); ctx.fill();
            if (hurt > 0.4) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx - 4, by - 22); ctx.lineTo(bx + 3, by - 16); ctx.lineTo(bx - 2, by - 10); ctx.stroke(); }
            return;
        }
        const x = p.x + s.rx, y0 = p.y + p.height - 2, y1 = s.y1, w = s.w, h = y1 - y0;
        if (h < 6) return;
        ctx.save();
        const st = s.style, sway = 0;
        switch (st) {
            case 'post': {
                ctx.fillStyle = '#5d4630'; ctx.fillRect(x - w / 2, y0, w, h); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x - w / 2, y0, 3, h);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 4 + i * 4, y0); ctx.lineTo(x - w / 2 + 4 + i * 4, y1); ctx.stroke(); }
                ctx.fillStyle = '#3e2f20'; for (let y = y0 + 40; y < y1 - 10; y += 70) ctx.fillRect(x - w / 2 - 2, y, w + 4, 5);   // iron collars
                ctx.fillStyle = '#4a3827'; ctx.fillRect(x - w / 2 - 4, y1 - 6, w + 8, 6);
                break; }
            case 'column': {
                const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#9a9aa2'); g.addColorStop(0.5, '#c9c9d0'); g.addColorStop(1, '#6a6a72');
                ctx.fillStyle = g; ctx.fillRect(x - w / 2, y0 + 6, w, h - 12);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (let y = y0 + 30; y < y1 - 8; y += 34) { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke(); }
                ctx.fillStyle = '#b4b4bc'; ctx.fillRect(x - w / 2 - 5, y0, w + 10, 7); ctx.fillStyle = '#85858d'; ctx.fillRect(x - w / 2 - 5, y1 - 7, w + 10, 7);
                break; }
            case 'icepillar': {
                const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, 'rgba(160,215,240,0.9)'); g.addColorStop(0.5, 'rgba(235,250,255,0.95)'); g.addColorStop(1, 'rgba(120,190,225,0.9)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y0); ctx.lineTo(x + w / 2, y0); ctx.lineTo(x + w / 2 + 3, y1); ctx.lineTo(x - w / 2 - 3, y1); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y0 + 6); ctx.lineTo(x - 1, y1 - 6); ctx.stroke();
                break; }
            case 'crystal': {
                const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#5a3aa8'); g.addColorStop(0.5, '#c9a4ff'); g.addColorStop(1, '#7a52d4');
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y0); ctx.lineTo(x + w / 2, y0); ctx.lineTo(x + w * 0.35, y1); ctx.lineTo(x - w * 0.35, y1); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(240,225,255,0.7)'; ctx.lineWidth = 1; for (let y = y0 + 26; y < y1; y += 44) { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y + 8); ctx.lineTo(x + w / 2, y); ctx.stroke(); }
                ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(x, (y0 + y1) / 2, 2, x, (y0 + y1) / 2, 40); gg.addColorStop(0, 'rgba(190,140,255,0.22)'); gg.addColorStop(1, 'rgba(190,140,255,0)'); ctx.fillStyle = gg; ctx.fillRect(x - 40, y0, 80, h);
                break; }
            case 'truss': {
                ctx.fillStyle = '#20242e'; ctx.fillRect(x - w / 2, y0, 3, h); ctx.fillRect(x + w / 2 - 3, y0, 3, h);
                ctx.strokeStyle = '#3a4150'; ctx.lineWidth = 2; ctx.beginPath(); for (let y = y0; y < y1 - 10; y += 22) { ctx.moveTo(x - w / 2 + 2, y); ctx.lineTo(x + w / 2 - 2, y + 22); ctx.moveTo(x + w / 2 - 2, y); ctx.lineTo(x - w / 2 + 2, y + 22); } ctx.stroke();
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(0,229,255,0.5)'; ctx.fillRect(x - w / 2, y0, 1.5, h); ctx.fillRect(x + w / 2 - 1.5, y0, 1.5, h); ctx.restore();
                ctx.fillStyle = '#2a2f3a'; ctx.fillRect(x - w / 2 - 4, y1 - 5, w + 8, 5);
                break; }
            case 'pile': {
                ctx.fillStyle = '#4a3a28'; ctx.fillRect(x - w / 2, y0, w, h);
                ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - w / 2, y0, 3, h);
                ctx.fillStyle = '#b9b3a0'; for (let y = y0 + 20; y < y1 - 6; y += 28) { ctx.beginPath(); ctx.arc(x - w / 2 + ((y * 7) % 11), y, 2.2, 0, TAU); ctx.fill(); }
                ctx.strokeStyle = '#2e8a6a'; ctx.lineWidth = 2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(x + (k ? w / 2 : -w / 2), y1); ctx.quadraticCurveTo(x + (k ? 1 : -1) * (w / 2 + 6) + Math.sin(t * 0.04 + k) * 3, y1 - 30, x + (k ? 1 : -1) * (w / 2 + 2), y1 - 56); ctx.stroke(); }
                break; }
            case 'cane': {
                ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y0, w, h); ctx.clip();
                ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 2, y0, w, h);
                ctx.strokeStyle = '#e53935'; ctx.lineWidth = 5; for (let y = y0 - w; y < y1 + w; y += 14) { ctx.beginPath(); ctx.moveTo(x - w / 2 - 2, y + w); ctx.lineTo(x + w / 2 + 2, y); ctx.stroke(); }
                ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w / 2, y0, 3, h);
                break; }
            case 'trunk': {
                ctx.fillStyle = '#2a2226'; ctx.beginPath(); ctx.moveTo(x - w / 2, y0);
                for (let y = y0; y <= y1; y += 14) ctx.lineTo(x - w / 2 - 2 + Math.sin(y * 0.09 + x) * 3, y);
                ctx.lineTo(x - w / 2 - 12, y1 + 2); ctx.lineTo(x + w / 2 + 12, y1 + 2);
                for (let y = y1; y >= y0; y -= 14) ctx.lineTo(x + w / 2 + 2 + Math.sin(y * 0.07 + x * 2) * 3, y);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#0c090c'; ctx.beginPath(); ctx.ellipse(x + 1, y0 + h * 0.4, 3, 6, 0, 0, TAU); ctx.fill();   // a knot-hole
                ctx.strokeStyle = 'rgba(120,150,110,0.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - w / 2, y0 + 20); ctx.quadraticCurveTo(x - w / 2 - 8, y0 + 40, x - w / 2 - 4, y0 + 66); ctx.stroke();
                break; }
            default: ctx.fillStyle = '#777'; ctx.fillRect(x - w / 2, y0, w, h);
        }
        ctx.restore();
        // worn supports show it
        if (hurt > 0.3) {
            ctx.strokeStyle = `rgba(0,0,0,${0.35 + hurt * 0.4})`; ctx.lineWidth = 1.6; ctx.beginPath();
            const n = 2 + (hurt * 5 | 0); for (let i = 0; i < n; i++) { const y = y0 + (i + 0.6) * h / (n + 1), dx = ((i * 37) % 9) - 4; ctx.moveTo(x - w / 2, y); ctx.lineTo(x + dx, y + 5); ctx.lineTo(x + w / 2, y - 3); }
            ctx.stroke();
        }
    }
    // cracks over worn cells, and the material's underside
    function drawWear(ctx, L, p, pattern) {
        const cw = p.cellW, n = p.cells.length, mat = p.mat;
        // underside: a ragged edge that shows what the ledge is made of
        const fh = p.role === 'ground' ? 0 : p.kind === 'float' ? 20 + (p.seed % 12) : 8;
        if (fh > 0) {
            // the slab is deeper than it looks: another layer of the same stuff under the edge, darker toward the bottom
            if (pattern && p.kind !== 'float') {
                ctx.save(); ctx.fillStyle = pattern; ctx.fillRect(p.x, p.y + p.height - 1, p.width, 9);
                const sg = ctx.createLinearGradient(0, p.y + p.height, 0, p.y + p.height + 9); sg.addColorStop(0, 'rgba(0,0,0,0.2)'); sg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = sg; ctx.fillRect(p.x, p.y + p.height - 1, p.width, 9);
                ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 1, p.y + p.height - 1, p.width - 2, 9);
                ctx.restore();
            }
            ctx.save();
            ctx.fillStyle = mat.debris; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + p.height + (p.kind === 'float' ? -1 : 7));
            const teeth = Math.max(3, Math.round(p.width / 16));
            for (let i = 0; i <= teeth; i++) { const u = i / teeth, x = p.x + 3 + u * (p.width - 6), taper = p.kind === 'float' ? Math.sin(Math.PI * u) : 0.5 + 0.5 * Math.sin(Math.PI * u); const d = (3 + ((p.seed * 13 + i * 29) % 100) / 100 * fh) * (p.kind === 'float' ? taper : 0.5 + 0.5 * taper); ctx.lineTo(x, p.y + p.height + (p.kind === 'float' ? 0 : 8) + d * (i % 2 ? 1 : 0.55)); }
            ctx.lineTo(p.x + p.width - 3, p.y + p.height + (p.kind === 'float' ? -1 : 7)); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill();
            ctx.restore();
        }
        let worn = false;
        for (let i = 0; i < n; i++) if (p.cells[i] < mat.hp) { worn = true; break; }
        if (!worn) return;
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
            const hp = p.cells[i]; if (hp >= mat.hp) continue;
            const f = 1 - hp / mat.hp, x = p.x + i * cw, h = p.height;
            ctx.fillStyle = `rgba(0,0,0,${0.12 * f})`; ctx.fillRect(x, p.y, cw, h);
            ctx.strokeStyle = `rgba(20,12,8,${0.4 + 0.5 * f})`; ctx.lineWidth = 1 + f;
            const k = 1 + (f * 3 | 0), s = (p.seed * 3 + i * 11) | 0;
            for (let j = 0; j < k; j++) { const cx = x + cw * (0.25 + 0.5 * (((s + j * 37) % 100) / 100)); ctx.beginPath(); ctx.moveTo(cx, p.y); ctx.lineTo(cx + ((s + j * 7) % 9) - 4, p.y + h * 0.45); ctx.lineTo(cx + ((s + j * 13) % 11) - 5, p.y + h); ctx.stroke(); }
        }
        ctx.restore();
    }

    // ---------- engine hooks ----------
    const buildBase = Level.prototype.buildLayout;
    Level.prototype.buildLayout = function (layout) {
        buildBase.call(this, layout);
        try { apply(this); } catch (e) { this.supports = []; this.hung = []; this.rafts = []; this.fallers = []; }
    };
    const updBase = Level.prototype.update;
    Level.prototype.update = function () {
        updBase.call(this);
        const g = window.game;
        if (!g || g.level !== this) return;
        try { step(this, g); } catch (e) { /* the ground never stops a match */ }
    };
    const dpsBase = Level.prototype.drawPlatforms;
    Level.prototype.drawPlatforms = function (ctx) {
        if (this.supports && this.supports.length) { ctx.save(); for (const s of this.supports) { try { drawSupport(ctx, this, s, this.time); } catch (e) { /* skip */ } } ctx.restore(); }
        dpsBase.call(this, ctx);
    };
    const dpBase = Level.prototype.drawPlatform;
    Level.prototype.drawPlatform = function (ctx, p, pattern) {
        if (p.cells && p.mat) { try { ctx.save(); drawWear(ctx, this, p, pattern); ctx.restore(); } catch (e) { ctx.restore(); } }
        dpBase.call(this, ctx, p, pattern);
    };
    // old ice rule (a punch shattered a thin ice ledge at once) is now just toughness 3: three punches
    Level.prototype.breakPlatform = function () { return null; };
    // the planner's picture of the ground changes whenever a piece breaks off
    if (typeof BotNav !== 'undefined') {
        const sigBase = BotNav.prototype.signature;
        BotNav.prototype.signature = function (level) { return sigBase.call(this, level) + '|' + (level.terrainV || 0); };
        const tickBase = BotNav.prototype.tick;
        BotNav.prototype.tick = function (level, body, frame) {
            // Ledges can now be added AND removed in the middle of the list (a piece breaking off, a conjured ice step
            // expiring). The planner's tables are indexed by position, so if any ledge it knows has moved, start over
            // rather than steer by a stale map.
            const cur = level.platforms;
            if (this.platformsRef === cur && this._known) {
                for (const [p, i] of this._known) if (cur[i] !== p) { this.platformsRef = null; break; }
            }
            if (this.platformsRef !== cur || !this._known || this._knownLen !== cur.length) { this._known = new Map(); cur.forEach((p, i) => { if (!p.mech) this._known.set(p, i); }); this._knownLen = cur.length; }
            if (this.platformsRef === level.platforms && this.edges && this.edges.length < level.platforms.length) {
                while (this.edges.length < level.platforms.length) { this.edges.push([]); this.walkSafe.push({ left: true, right: true }); this.knockSafe.push({ left: true, right: true }); }
            }
            return tickBase.call(this, level, body, frame);
        };
    }
    // the bots' physics sandbox knows what the ground it lands on does to the feet
    if (typeof BotSim !== 'undefined') {
        const stepBase = BotSim.step;
        BotSim.step = function (g, input, world, t) {
            const rp = g.ridePlat, src = rp && rp.src;
            if (g.grounded && src && src.mat && (src.mat.grip !== 1 || src.mat.speed !== 1 || src.mat.jump !== 1)) g.env = { grip: src.mat.grip, speed: src.mat.speed, jump: src.mat.jump, grav: 1 };
            else if (g.env && g.grounded && src && src.mat) g.env = undefined;
            return stepBase.call(this, g, input, world, t);
        };
    }

    // ---------- damage from the game ----------
    const meleeBase = Game.prototype.meleeAttack;
    Game.prototype.meleeAttack = function (att, def) {
        meleeBase.call(this, att, def);
        try {
            const range = WeaponDefs.reach(def), units = Math.max(1, def.damage / 5) * (def.heavy ? 1.5 : 1);
            const boxes = [{ x: att.facing === 1 ? att.x + att.width : att.x - range, y: att.y, w: range, h: att.height }];
            if (def.both) boxes.push({ x: att.facing === 1 ? att.x - range : att.x + att.width, y: att.y, w: range, h: att.height });
            for (const b of boxes) hitBox(this, b, units, att.ridePlat);
            if ((def.slam || def.heavy) && att.grounded) hitCircle(this, att.x + att.width / 2 + att.facing * range * 0.7, att.y + att.height, range * 0.7, units * 1.3);
        } catch (e) { /* skip */ }
    };
    const blastBase = Game.prototype.blast;
    Game.prototype.blast = function (x, y, b, owner, wtype) {
        blastBase.apply(this, arguments);
        try { if (b && b.radius && !b.pull) { hitCircle(this, x, y, b.radius * 0.85, 2.5 + (b.damage || 10) * 0.28); launch(this, x, y, b); } } catch (e) { /* skip */ }
    };
    const puBase = Projectile.prototype.update;
    Projectile.prototype.update = function (level) {
        const ev = puBase.call(this, level);
        if ((ev === 'platform' || ev === 'bounce' || ev === 'stick') && this.hitPlat && !this.spec.blast && !this.spec.divine) {
            const g = window.game;
            if (g && g.level === level && !this.isGhost) try { hitCircle(g, this.x, this.y, 8, 0.3 + (this.spec.damage || 4) * 0.03); } catch (e) { /* skip */ }
        }
        return ev;
    };

    return { apply, hitCircle, hitBox, startCollapse, dangers, hasDangers, step, MATS, FLOAT, PILLAR, HANG, LIQUID, launch };
})();

window.Terrain = Terrain;
