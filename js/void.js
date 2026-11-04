// What lies below the arena, per theme. Liquid themes have a deadly surface just under the
// floor (molten lava, a chocolate river, freezing water): touching it kills, and the body sinks
// into it with its own death animation. The other themes keep the bottomless fall, but the bottom
// of the screen shows what you fall into (a digital void, a sea of cloud, ghostly fog, a magic
// rift, the abyss...) and the fall ends in a themed effect there.
(() => {
    const RND = DFX.rnd, N = DFX.n;
    const LIQUID = { lava: { rgb: '255,120,30' }, candy: { rgb: '110,62,30' }, ice: { rgb: '90,160,200' } };

    // y of the deadly surface (feet below this die), or undefined for a bottomless fall
    Object.defineProperty(Level.prototype, 'voidSurface', {
        get() { return LIQUID[this.material] ? this.height - 26 : undefined; }
    });

    // Liquid themes: bouncers that sit in a pit float on the surface instead of under it,
    // and nothing in the foreground hides the liquid
    const buildBase = Level.prototype.buildLayout;
    Level.prototype.buildLayout = function (layout) {
        buildBase.call(this, layout);
        if (!LIQUID[this.material]) return;
        const s = this.height - 26;
        for (const p of this.platforms) if (p.type === 'trampoline' && p.y + p.height > s - 2) p.y = s - p.height - 4;
    };
    const fgBase = BackdropLayers.foreground;
    BackdropLayers.foreground = function (bd, rng, V) {
        if (LIQUID[bd.material] && V.fg && V.fg.bottom) V = Object.assign({}, V, { fg: { top: V.fg.top, bottom: null } });
        fgBase.call(this, bd, rng, V);
    };

    // ---------- drawing the void (world space, before platforms) ----------
    const wave = (x, t, a) => Math.sin(x * 0.018 + t * 0.03) * a + Math.sin(x * 0.051 - t * 0.047) * a * 0.5;
    // The visible world rectangle (plus a wide margin) so a liquid never shows an edge, however the
    // camera moves, zooms or shakes: everything below is drawn across [x0, x1] and down to y1
    const extents = (ctx, L) => {
        const tr = ctx.getTransform && ctx.getTransform();
        if (!tr || !tr.inverse) return { x0: -3000, x1: L.width + 3000, y1: L.height + 3000 };
        const inv = tr.inverse(), cw = ctx.canvas.width, ch = ctx.canvas.height;
        const pts = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => inv.transformPoint ? inv.transformPoint({ x, y }) : { x, y });
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        return { x0: Math.floor((Math.min(...xs) - 300) / 24) * 24, x1: Math.max(...xs) + 300, y1: Math.max(Math.max(...ys) + 400, L.height + 400) };
    };
    // Repeat a scatter pattern of period P across the visible range: fn(offsetX)
    const tile = (V, P, fn) => { for (let k = Math.floor(V.x0 / P); k * P <= V.x1; k++) fn(k * P); };

    const VOID_DRAW = {
        lava(ctx, L, t, V) {
            const W = L.width, H = L.height, s = L.voidSurface;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createLinearGradient(0, s - 90, 0, s);
            gl.addColorStop(0, 'rgba(255,90,20,0)'); gl.addColorStop(1, `rgba(255,110,30,${0.32 + 0.06 * Math.sin(t * 0.05)})`);
            ctx.fillStyle = gl; ctx.fillRect(V.x0, s - 90, V.x1 - V.x0, 92);
            ctx.restore();
            ctx.beginPath(); ctx.moveTo(V.x0, V.y1);
            for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + wave(x, t, 2.2));
            ctx.lineTo(V.x1, V.y1); ctx.closePath();
            const g = ctx.createLinearGradient(0, s - 3, 0, s + 700);
            g.addColorStop(0, '#fff3b0'); g.addColorStop(0.03, '#ffb32e'); g.addColorStop(0.12, '#f05a14'); g.addColorStop(0.4, '#9a1d08'); g.addColorStop(1, '#4a0a03');
            ctx.fillStyle = g; ctx.fill();
            ctx.save(); ctx.clip();
            tile(V, 1500, (ox) => {
                for (let i = 0; i < 22; i++) {
                    const x = ((i * 97 + t * (0.25 + (i % 3) * 0.08)) % 1500) + ox, y = s + 4 + (i % 4) * 4;
                    ctx.fillStyle = 'rgba(60,14,4,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, 22 + (i % 5) * 6, 3 + (i % 3), 0, 0, Math.PI * 2); ctx.fill();
                }
            });
            ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,240,170,0.55)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + 1 + wave(x, t, 2.2)); ctx.stroke();
            ctx.restore();
            tile(V, 1500, (ox) => {
                for (let i = 0; i < 12; i++) {
                    const ph = (t * 0.012 + i * 0.37) % 1, x = (i * 123.3 + Math.floor(t * 0.012 + i * 0.37) * 61) % 1500 + ox, r = 2 + ph * 6;
                    ctx.strokeStyle = `rgba(255,220,140,${0.8 * (1 - ph)})`; ctx.lineWidth = 1.2;
                    ctx.beginPath(); ctx.arc(x, s + 1 - r * 0.4, r, Math.PI, 0); ctx.stroke();
                }
            });
        },
        candy(ctx, L, t, V) {
            const s = L.voidSurface;
            ctx.beginPath(); ctx.moveTo(V.x0, V.y1);
            for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + wave(x, t * 0.6, 2.6));
            ctx.lineTo(V.x1, V.y1); ctx.closePath();
            const g = ctx.createLinearGradient(0, s - 3, 0, s + 700);
            g.addColorStop(0, '#a8714a'); g.addColorStop(0.04, '#6b3d1e'); g.addColorStop(0.4, '#3e2010'); g.addColorStop(1, '#241108');
            ctx.fillStyle = g; ctx.fill();
            ctx.save(); ctx.clip();
            ctx.strokeStyle = 'rgba(255,230,210,0.5)'; ctx.lineWidth = 1.5;
            for (let k = 0; k < 3; k++) { ctx.globalAlpha = 1 - k * 0.35; ctx.beginPath(); for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + 3 + k * 5 + wave(x + k * 90, t * 0.6, 1.6)); ctx.stroke(); }
            ctx.restore();
        },
        ice(ctx, L, t, V) {
            const s = L.voidSurface;
            ctx.beginPath(); ctx.moveTo(V.x0, V.y1);
            for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + wave(x, t, 1.4));
            ctx.lineTo(V.x1, V.y1); ctx.closePath();
            const g = ctx.createLinearGradient(0, s, 0, s + 700);
            g.addColorStop(0, '#5fa8cf'); g.addColorStop(0.08, '#1d5a7e'); g.addColorStop(0.5, '#0b3148'); g.addColorStop(1, '#041621');
            ctx.fillStyle = g; ctx.fill();
            tile(V, 1500, (ox) => {
                for (let i = 0; i < 14; i++) {
                    const x = ((i * 131 + t * 0.15) % 1500) + ox, w = 18 + (i % 4) * 9;
                    ctx.fillStyle = 'rgba(235,248,255,0.92)'; ctx.beginPath(); ctx.moveTo(x - w / 2, s + 2); ctx.lineTo(x - w / 2 + 4, s - 2); ctx.lineTo(x + w / 2 - 3, s - 2.5); ctx.lineTo(x + w / 2, s + 2); ctx.closePath(); ctx.fill();
                }
            });
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,245,255,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); for (let x = V.x0; x <= V.x1; x += 12) ctx.lineTo(x, s + 1 + wave(x, t, 1.4)); ctx.stroke(); ctx.restore();
        },
        // ---- bottomless themes: show what lies below ----
        neon(ctx, L, t, V) {
            const H = L.height;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, H - 70, 0, H); g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, 'rgba(255,45,149,0.28)');
            ctx.fillStyle = g; ctx.fillRect(V.x0, H - 70, V.x1 - V.x0, 80);
            ctx.fillStyle = 'rgba(255,45,149,0.28)'; ctx.fillRect(V.x0, H + 10, V.x1 - V.x0, V.y1 - H);
            ctx.strokeStyle = 'rgba(0,229,255,0.35)'; ctx.lineWidth = 1;
            for (let k = 0; k < 5; k++) { const y = H - 4 - k * k * 3 - ((t * 0.4) % 4); ctx.globalAlpha = 1 - k * 0.18; ctx.beginPath(); ctx.moveTo(V.x0, y); ctx.lineTo(V.x1, y); ctx.stroke(); }
            ctx.restore();
        },
        cloud(ctx, L, t, V) {
            const H = L.height;
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(V.x0, H + 20, V.x1 - V.x0, V.y1 - H);
            tile(V, 1500, (ox) => {
                for (let i = 0; i < 30; i++) {
                    const x = ((i * 53 + t * 0.2) % 1500) + ox, r = 26 + (i % 4) * 9;
                    const g = ctx.createRadialGradient(x, H + 6, 0, x, H + 6, r);
                    g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = g; ctx.fillRect(x - r, H + 6 - r, r * 2, r * 2);
                }
            });
        },
        haunted(ctx, L, t, V) {
            const H = L.height;
            ctx.fillStyle = 'rgba(120,112,170,0.3)'; ctx.fillRect(V.x0, H + 20, V.x1 - V.x0, V.y1 - H);
            tile(V, 1500, (ox) => {
                for (let i = 0; i < 22; i++) {
                    const x = ((i * 71 + t * (i % 2 ? 0.3 : -0.25)) % 1500 + 1500) % 1500 + ox, r = 40 + (i % 3) * 14;
                    const g = ctx.createRadialGradient(x, H, 0, x, H, r);
                    g.addColorStop(0, 'rgba(170,160,210,0.32)'); g.addColorStop(1, 'rgba(170,160,210,0)');
                    ctx.fillStyle = g; ctx.fillRect(x - r, H - r, r * 2, r * 2);
                }
            });
        },
        magic(ctx, L, t, V) {
            const H = L.height;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, H - 60, 0, H); g.addColorStop(0, 'rgba(150,80,255,0)'); g.addColorStop(1, `rgba(170,90,255,${0.3 + 0.08 * Math.sin(t * 0.04)})`);
            ctx.fillStyle = g; ctx.fillRect(V.x0, H - 60, V.x1 - V.x0, 70);
            ctx.fillStyle = 'rgba(170,90,255,0.3)'; ctx.fillRect(V.x0, H + 10, V.x1 - V.x0, V.y1 - H);
            ctx.restore();
        },
        ocean(ctx, L, t, V) {
            const H = L.height;
            const g = ctx.createLinearGradient(0, H - 80, 0, H); g.addColorStop(0, 'rgba(2,10,24,0)'); g.addColorStop(1, 'rgba(2,10,24,0.75)');
            ctx.fillStyle = g; ctx.fillRect(V.x0, H - 80, V.x1 - V.x0, 90);
            ctx.fillStyle = 'rgba(2,10,24,0.75)'; ctx.fillRect(V.x0, H + 10, V.x1 - V.x0, V.y1 - H);
        },
        dirt(ctx, L, t, V) {
            const g = ctx.createLinearGradient(0, L.height - 50, 0, L.height); g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(1, 'rgba(10,6,4,0.55)');
            ctx.fillStyle = g; ctx.fillRect(V.x0, L.height - 50, V.x1 - V.x0, 60);
            ctx.fillStyle = 'rgba(10,6,4,0.55)'; ctx.fillRect(V.x0, L.height + 10, V.x1 - V.x0, V.y1 - L.height);
        },
        stone(ctx, L, t, V) { VOID_DRAW.dirt(ctx, L, t, V); }
    };
    const platBase = Level.prototype.drawPlatforms;
    Level.prototype.drawPlatforms = function (ctx) {
        const d = VOID_DRAW[this.material];
        if (d) { ctx.save(); d(ctx, this, this.time, extents(ctx, this)); ctx.restore(); }
        platBase.call(this, ctx);
    };

    // ---------- a fighter goes into the void ----------
    Object.assign(Game.prototype, {
        voidDeath(p) {
            const fx = this.fx, L = this.level, mat = L.material, W = L.width, H = L.height;
            const x = Math.max(10, Math.min(W - 10, p.x + p.width / 2));
            const liquid = LIQUID[mat];
            if (liquid) {
                const s = L.voidSurface;
                p.death = { body: mat === 'lava' ? 'lavaSink' : mat === 'candy' ? 'chocoSink' : 'iceSink', accent: null, dir: p.facing || 1, weapon: null };
                p.corpseSpawned = false;   // the body stays, at the surface, and sinks
                // pin the body's feet at the surface so the corpse starts there
                p.y = Math.min(p.y, s - p.height + 14);
                if (mat === 'lava') {
                    fx.flashAt(x, s, '255,200,90', 90, 12);
                    fx.add({ type: 'ring', x, y: s, life: 26, color: '255,220,140', size: 6, grow: 3.4, width: 3 });
                    for (let i = 0; i < N(36); i++) { const a = -Math.PI / 2 + RND(-1.1, 1.1), v = RND(3, 10); fx.add({ type: 'drop', x: x + RND(-10, 10), y: s - 2, vx: Math.cos(a) * v * 0.6 + p.velocity.x * 0.2, vy: Math.sin(a) * v, life: 60, color: ['rgba(255,240,170,1)', 'rgba(255,170,50,1)', 'rgba(240,80,20,1)'][i % 3], size: 2 + RND(0, 2.5), gravity: 0.32 }); }
                    fx.embers(x, s - 6, N(30), 6);
                    fx.cloud(x, s - 40, N(10), 26, '120,104,98', 10, 80, 1.3);
                    if (!this.demo) { fx.addTrauma(0.25); fx.screenFlash('255,150,60', 0.25); }
                } else if (mat === 'candy') {
                    for (let i = 0; i < N(26); i++) { const a = -Math.PI / 2 + RND(-1, 1), v = RND(2, 7); fx.add({ type: 'drop', x: x + RND(-8, 8), y: s - 2, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, life: 50, color: ['rgba(110,62,30,1)', 'rgba(150,95,55,1)'][i % 2], size: 2.2 + RND(0, 2), gravity: 0.3 }); }
                    fx.add({ type: 'ring', x, y: s, life: 30, color: '200,150,110', size: 6, grow: 2.4, width: 3 });
                    for (let i = 0; i < N(10); i++) fx.swirl(x, s - 10, { shape: 'square', color: ['255,82,82', '64,196,255', '255,215,64', '105,240,174'][i % 4], rise: RND(30, 70), spin: RND(-4, 4), r0: 4, r1: 30, size: 3, life: 40 });
                } else {
                    for (let i = 0; i < N(30); i++) { const a = -Math.PI / 2 + RND(-1, 1), v = RND(3, 9); fx.add({ type: 'drop', x: x + RND(-8, 8), y: s - 2, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, life: 50, color: 'rgba(200,235,255,0.95)', size: 1.8 + RND(0, 1.8), gravity: 0.32 }); }
                    fx.shards(x - 20, s - 20, 40, 20, 'rgba(225,245,255,0.95)', N(14));
                    fx.add({ type: 'ring', x, y: s, life: 30, color: '220,245,255', size: 6, grow: 2.8, width: 2 });
                    fx.cloud(x, s - 14, N(10), 30, '230,245,255', 12, 60, 0.4);
                }
                return;
            }
            p.corpseSpawned = true;   // gone below the screen; the effect plays at the edge
            const y = H - 4;
            switch (mat) {
                case 'neon':
                    for (let i = 0; i < N(30); i++) fx.add({ type: 'chunk', x: x + RND(-20, 20), y: y - RND(0, 10), vx: RND(-2, 2), vy: -RND(2, 8), life: 40 + RND(0, 20), color: Math.random() < 0.5 ? p.color : ['#00e5ff', '#ff2d95'][i % 2], size: 3.4, gravity: 0.12, rot: 0, vr: 0 });
                    fx.streak(x - 160, y - 8, x + 160, y - 8, 3, '0,229,255', 16);
                    fx.flashAt(x, y, '255,45,149', 60, 8);
                    break;
                case 'cloud':
                    fx.cloud(x, y, N(14), 40, '255,255,255', 16, 60, 0.8);
                    fx.later(30, () => { fx.star(x, H - 30, '255,255,255'); fx.flashAt(x, H - 30, '255,255,255', 20, 6); });
                    break;
                case 'haunted':
                    fx.add({ type: 'ghost', x, y: y + 20, color: p.color, facing: p.facing, wings: false, life: 110, riseMax: 120 });
                    fx.cloud(x, y, N(12), 50, '150,140,190', 16, 70, 0.6);
                    for (let i = 0; i < N(6); i++) fx.swirl(x, y, { shape: 'soul', color: '200,190,255', rise: RND(60, 140), spin: RND(-3, 3), r0: 4, r1: 30, size: 6, life: 70 });
                    break;
                case 'magic':
                    fx.add({ type: 'sigil', x, y: y - 6, life: 50, color: '190,120,255', size: 60 });
                    for (let i = 0; i < N(16); i++) fx.swirl(x, y - 10, { shape: 'star', color: '220,180,255', rise: RND(30, 90), spin: 6, r0: 50, r1: 3, size: 3, life: 40 });
                    break;
                case 'ocean':
                    for (let i = 0; i < N(18); i++) fx.later(i * 2, () => fx.swirl(x + RND(-12, 12), y, { shape: 'bubble', color: '200,235,255', rise: RND(80, 200), spin: RND(-1, 1), r0: 2, r1: 10, size: 3 + RND(0, 3), life: 60 }));
                    break;
                default:
                    fx.dust(x, y, N(14), 40, DUST_TINT[mat]);
                    fx.later(24, () => fx.star(x, H - 20, '255,240,160'));
            }
        }
    });

    // ---------- bodies sinking into a liquid ----------
    const lerp = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
    const arr = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const sink = (opts) => (g, c, k) => {
        const D = DeathAnim, J = c.rag.pts, s = g.level.voidSurface || g.level.height - 10;
        const flail = opts.flail;
        c.rag.frozen = true;
        // stand the body up in the liquid, feet just under the surface
        const low = Math.max(...J.map(p => p.y));
        D.kin(c, 0, s + 6 - low);
        c.anim.clipBottom = s + 1;
        c.anim.expression = 'hurt';
        let depth = 0;
        const top0 = Math.min(...J.map(p => p.y));
        c.anim.tint = (b, col) => {
            // colour darkens from below as it goes under (and glows first, for lava)
            const [i, j] = RAG_BONES[b], y = (J[i].y + J[j].y) / 2, u = Math.max(0, Math.min(1, Math.max(0, (y - (s - 22)) / 22) * 0.75 + c.anim.age / (opts.len * 3)));
            return opts.glow ? (u < 0.5 ? lerp(arr(col), opts.glow, u * 2) : lerp(opts.glow, opts.char, (u - 0.5) * 2)) : lerp(arr(col), opts.char, Math.min(1, u));
        };
        // Where the body meets the liquid: a bright, wobbling meniscus and rings pushed outward
        c.anim.overlay = (ctx) => {
            const m = D.mid(c), a = c.anim.age, w = 16 + Math.sin(a * 0.3) * 2;
            ctx.save();
            if (opts.rim) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(m.x, s, 0, m.x, s, 40); gl.addColorStop(0, `rgba(${opts.rim},0.55)`); gl.addColorStop(1, `rgba(${opts.rim},0)`); ctx.fillStyle = gl; ctx.fillRect(m.x - 40, s - 40, 80, 50); }
            ctx.fillStyle = opts.lip; ctx.beginPath(); ctx.ellipse(m.x, s + 1, w, 3.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = opts.ring; ctx.lineWidth = 1.2;
            for (let k = 0; k < 2; k++) { const r = ((a * 0.6 + k * 12) % 24) + w; ctx.globalAlpha = 1 - ((a * 0.6 + k * 12) % 24) / 24; ctx.beginPath(); ctx.ellipse(m.x, s + 1, r, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
            ctx.restore();
        };
        D.hook(c, (dt, age) => {
            // thrash at first, then go limp and slide under
            const speed = opts.speed * (age < flail ? 0.25 : 1) * (1 + depth / 80);
            D.kin(c, Math.sin(age * 0.2) * 0.15, speed * dt);
            depth += speed * dt;
            if (age < flail) {
                c.anim.expression = 'hurt';
                for (const i of [3, 4, 5, 6]) { J[i].y += Math.sin(age * 0.6 + i) * 1.6; J[i].x += Math.cos(age * 0.5 + i) * 1.2; }
            } else c.anim.expression = 'ko';
            const m = D.mid(c);
            if (age % opts.fxEvery < dt) opts.fx(g, m.x + RND(-12, 12), s, age, depth);
            if (Math.min(...J.map(p => p.y)) > s + 4) { opts.end(g, m.x, s); c.anim.done = true; c.anim.hidden = true; return true; }
            return false;
        });
    };
    Object.assign(BODY, {
        lavaSink: sink({
            speed: 0.55, flail: 26, len: 40, glow: [255, 150, 40], char: [28, 22, 20], fxEvery: 2, rim: '255,170,60', lip: 'rgba(255,236,160,0.95)', ring: 'rgba(255,220,140,0.9)',
            fx(g, x, s, age) {
                if (age % 4 < 1) g.fx.flame(x + RND(-14, 14), s - 1, 6 + RND(0, 6), 18 + RND(0, 18), 22);
                if (age % 6 < 1) g.fx.add({ type: 'puff', x: x + RND(-10, 10), y: s - 40 - RND(0, 20), vx: RND(-0.3, 0.3), vy: -RND(0.8, 1.6), life: 70, color: '110,98,94', size: 4, grow: 0.3, alpha: 0.4 });
                if (age % 4 < 1) g.fx.add({ type: 'drop', x: x + RND(-14, 14), y: s - 1, vx: RND(-1.5, 1.5), vy: -RND(1, 3.5), life: 30, color: 'rgba(255,200,90,1)', size: 1.8, gravity: 0.3 });
                if (age % 3 < 1) g.fx.embers(x, s - 4, 1, 2);
            },
            end(g, x, s) {
                g.fx.add({ type: 'ring', x, y: s, life: 40, color: '255,220,140', size: 8, grow: 1.4, width: 2 });
                g.fx.cloud(x, s - 10, N(10), 20, '60,55,55', 12, 100, 1.2);
                g.fx.later(10, () => { g.fx.flashAt(x, s, '255,200,90', 30, 8); g.fx.embers(x, s - 4, N(10), 3); });
            }
        }),
        chocoSink: sink({
            speed: 0.4, flail: 34, len: 60, char: [92, 52, 26], fxEvery: 5, lip: 'rgba(170,110,70,0.95)', ring: 'rgba(220,170,130,0.8)',
            fx(g, x, s) { g.fx.add({ type: 'ring', x, y: s, life: 24, color: '200,150,110', size: 5, grow: 0.8, width: 1.5 }); },
            end(g, x, s) { g.fx.add({ type: 'ring', x, y: s, life: 40, color: '200,150,110', size: 6, grow: 1.2, width: 2 }); for (let i = 0; i < N(6); i++) g.fx.swirl(x, s - 6, { shape: 'square', color: ['255,82,82', '64,196,255', '255,215,64'][i % 3], rise: 30, spin: 3, r0: 4, r1: 20, size: 3, life: 36 }); }
        }),
        iceSink: sink({
            speed: 0.5, flail: 20, len: 30, char: [170, 220, 245], fxEvery: 4, lip: 'rgba(230,248,255,0.9)', ring: 'rgba(220,245,255,0.8)',
            fx(g, x, s) { g.fx.add({ type: 'puff', x: x + RND(-12, 12), y: s - 4, vx: 0, vy: -0.5, life: 40, color: '230,245,255', size: 3, grow: 0.2, alpha: 0.6 }); if (Math.random() < 0.4) g.fx.swirl(x, s + 4, { shape: 'bubble', color: '220,245,255', rise: 20, spin: 0, r0: 2, r1: 6, size: 2.5, life: 26 }); },
            end(g, x, s) { g.fx.shards(x - 14, s - 10, 28, 10, 'rgba(225,245,255,0.95)', N(10)); g.fx.add({ type: 'ring', x, y: s, life: 34, color: '220,245,255', size: 6, grow: 1.3, width: 2 }); }
        })
    });

    // The fall itself triggers the themed end (game-combat's onKO hands falls to us)
    const koBase = Game.prototype.onKO;
    Game.prototype.onKO = function (p, attacker, amount) {
        koBase.call(this, p, attacker, amount);
        if (amount >= 1000) this.voidDeath(p);
    };
})();
