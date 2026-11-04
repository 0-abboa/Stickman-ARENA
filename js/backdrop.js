// Generated backdrops. A level paints a stack of ~28 parallax layers once into
// offscreen canvases from one of 15 variants (backdrop-variants.js; engine and
// painters in backdrop-layers.js), then animates slow ambience on top: drifting
// clouds, sun rays, aurora, lightning, particles at two depths, birds, flickering
// windows, runes, twinkling stars. Parallax comes only from the real game camera
// (see Backdrop.draw). Ambience advances by step(dt), so it slows down with the game.
const BACKDROP_MARGIN = 70;

const Backdrop = {
    rng(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    },

    // Fractal 1D noise sampled across the width: returns heights in [0,1]
    ridge(rng, n, octaves, rough) {
        const out = new Float32Array(n);
        let amp = 1, total = 0, freq = 3;
        for (let o = 0; o < octaves; o++) {
            const pts = Array.from({ length: freq + 2 }, () => rng());
            for (let i = 0; i < n; i++) {
                const u = i / (n - 1) * freq;
                const k = Math.floor(u), f = u - k;
                const s = (1 - Math.cos(f * Math.PI)) / 2;
                out[i] += (pts[k] * (1 - s) + pts[k + 1] * s) * amp;
            }
            total += amp;
            amp *= rough;
            freq *= 2;
        }
        for (let i = 0; i < n; i++) out[i] /= total;
        return out;
    },

    canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    },

    // Which of the material's three backdrops this level uses (stable for the round)
    variantFor(material, seed) {
        const list = BG_VARIANTS[material] || BG_VARIANTS.dirt;
        const pick = seed === undefined ? Math.random() : seed;
        return list[Math.floor(pick * list.length) % list.length];
    },

    build(level) {
        const W = Math.max(1, Math.round(level.width)), H = Math.max(1, Math.round(level.height));
        const V = this.variantFor(level.material, level.variantSeed);
        level.backdropName = V.name;
        const seed = Math.floor(Math.random() * 1e9);
        const rng = this.rng(seed);
        // Huge screens paint the layers at reduced resolution to keep memory sane
        const vs = (window.game && window.game.viewScale) || 1;
        const q = Math.max(0.8, Math.min(1.25, vs, Math.sqrt(2.6e6 / (W * H))));   // sharper layers on big screens, capped for memory
        const bd = { W, H, q, V, material: level.material, variantSeed: level.variantSeed, time: 0, layers: [], windows: [], seed, fg: [], parts: [[], []], birds: [], shoot: null, bolt: null, flash: 0 };
        this.initAmbient(bd, rng);
        BackdropLayers.assemble(bd, rng, V);
        return bd;
    },

    // Soft round sprite in a colour, cached ('r,g,b')
    dot(rgb) {
        const cache = this._dots || (this._dots = {});
        if (cache[rgb]) return cache[rgb];
        const c = this.canvas(48, 48), ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.35, `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 48, 48);
        return (cache[rgb] = c);
    },

    // Wide flat puff for drifting mist
    mistSprite(rgb) {
        const cache = this._mists || (this._mists = {});
        if (cache[rgb]) return cache[rgb];
        const c = this.canvas(256, 64), ctx = c.getContext('2d');
        ctx.translate(128, 32); ctx.scale(1, 0.25);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
        g.addColorStop(0, `rgba(${rgb},0.9)`); g.addColorStop(0.5, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(-128, -128, 256, 256);
        return (cache[rgb] = c);
    },

    // Mx: horizontal margin baked into W, so the sun still sits at its screen position
    paintSky(ctx, W, H, V, rng, Mx) {
        Mx = Mx || 0;
        const M = BACKDROP_MARGIN;
        const g = ctx.createLinearGradient(0, -M, 0, H + M);
        for (const [s, c] of V.sky) g.addColorStop(s, c);
        ctx.fillStyle = g;
        ctx.fillRect(-M, -M, W + M * 2, H + M * 2);
        if (V.nebula) {
            ctx.globalCompositeOperation = 'lighter';
            const cols = V.nebulaCols || ['120,40,200', '40,90,220', '220,60,160', '90,30,160'];
            for (let i = 0; i < 9; i++) {
                const x = rng() * W, y = rng() * H * 0.7, r = 120 + rng() * 260;
                const n = ctx.createRadialGradient(x, y, 0, x, y, r);
                n.addColorStop(0, `rgba(${cols[i % 4]},${0.16 + rng() * 0.12})`);
                n.addColorStop(1, `rgba(${cols[i % 4]},0)`);
                ctx.fillStyle = n;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        if (V.stars) {
            for (let i = 0; i < Math.round(V.stars * 0.5); i++) {
                const y = rng() * H * 0.75;
                ctx.fillStyle = `rgba(255,255,255,${(0.2 + rng() * 0.8) * (1 - y / H)})`;
                const s = rng() < 0.08 ? 2 : 1;
                ctx.fillRect(rng() * W, y, s, s);
            }
        }
        const b = V.body;
        if (b) {
        const bx = Mx + (W - 2 * Mx) * b.x, by = H * b.y;
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(bx, by, b.r * 0.4, bx, by, b.r * 6);
        halo.addColorStop(0, `rgba(${b.rgb},0.55)`);
        halo.addColorStop(0.3, `rgba(${b.rgb},0.15)`);
        halo.addColorStop(1, `rgba(${b.rgb},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(bx - b.r * 6, by - b.r * 6, b.r * 12, b.r * 12);
        ctx.globalCompositeOperation = 'source-over';
        if (b.kind === 'planet') {
            const pg = ctx.createRadialGradient(bx - b.r * 0.4, by - b.r * 0.4, b.r * 0.1, bx, by, b.r);
            pg.addColorStop(0, '#f3d9ff'); pg.addColorStop(0.6, '#9c5fd6'); pg.addColorStop(1, '#3d1466');
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(230,200,255,0.6)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(bx, by, b.r * 1.7, b.r * 0.35, -0.35, 0, Math.PI * 2); ctx.stroke();
        } else {
            const sg = ctx.createRadialGradient(bx - b.r * 0.3, by - b.r * 0.3, 1, bx, by, b.r);
            sg.addColorStop(0, '#ffffff');
            sg.addColorStop(1, `rgba(${b.rgb},1)`);
            ctx.fillStyle = sg;
            ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fill();
            if (b.kind === 'moon') {
                ctx.fillStyle = 'rgba(120,120,160,0.25)';
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    ctx.arc(bx + (rng() - 0.5) * b.r, by + (rng() - 0.5) * b.r, b.r * (0.08 + rng() * 0.15), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        }
        // Warm/cool glow along the horizon
        const hz = ctx.createLinearGradient(0, H * 0.55, 0, H);
        hz.addColorStop(0, `rgba(${V.haze},0)`);
        hz.addColorStop(1, `rgba(${V.haze},0.35)`);
        ctx.fillStyle = hz;
        ctx.fillRect(-BACKDROP_MARGIN, H * 0.55, W + BACKDROP_MARGIN * 2, H * 0.45 + BACKDROP_MARGIN);
    },

    initAmbient(bd, rng) {
        const a = bd.V.ambient || {}, W = bd.W, H = bd.H;
        for (let i = 0; i < (a.birds || 0); i++) {
            bd.birds.push({ x: rng() * W, y: 60 + rng() * H * 0.3, v: 0.4 + rng() * 0.4, ph: rng() * 6, s: 0.6 + rng() * 0.5 });
        }
    },

    step(bd, dt) {
        if (!bd || dt <= 0) return;
        bd.time += dt;
        const W = bd.W, H = bd.H, a = bd.V.ambient || {};
        for (const layer of bd.layers) {
            if (layer.tag !== 'clouds') continue;
            for (const c of layer.items) { c.x += c.v * dt; if (c.x > W + c.xr + 260) c.x = -c.xr - 260; }
        }
        for (const b of bd.birds) { b.x += b.v * dt; b.ph += 0.2 * dt; if (b.x > W + 40) { b.x = -40; b.y = 60 + Math.random() * H * 0.3; } }
        BackdropLayers.stepParts(bd, dt);
        if (a.shooting) {
            if (!bd.shoot && Math.random() < 0.003 * dt) bd.shoot = { x: Math.random() * W, y: Math.random() * H * 0.3, life: 40 };
            if (bd.shoot) { bd.shoot.x += 9 * dt; bd.shoot.y += 4 * dt; bd.shoot.life -= dt; if (bd.shoot.life <= 0) bd.shoot = null; }
        }
        if (a.lightning) {
            if ((!bd.bolt || bd.bolt.life <= 0) && Math.random() < 0.0035 * dt) {
                const pts = [], x0 = W * (0.1 + Math.random() * 0.8);
                let x = x0, y = -10;
                while (y < H * (0.4 + Math.random() * 0.25)) { pts.push([x, y]); x += (Math.random() - 0.5) * 50; y += 26 + Math.random() * 34; }
                bd.bolt = { pts, life: 9 };
                bd.flash = 1;
            }
            if (bd.bolt && bd.bolt.life > 0) bd.bolt.life -= dt;
        }
        if (bd.flash > 0) bd.flash *= Math.pow(0.88, dt);
    },

    // cam: the REAL game camera { x, y, zoom }. A layer with factor f shifts by
    // f x (cam - centre) and scales by 1 + (zoom - 1) x f; f = 1 is the world itself.
    draw(ctx, bd, cam, sh) {
        const W = bd.W, H = bd.H;
        const zoom = cam ? cam.zoom : 1, cx = cam ? cam.x : W / 2, cy = cam ? cam.y : H / 2;
        for (const layer of bd.layers) {
            const f = layer.f;
            ctx.save();
            ctx.translate(W / 2 + sh.x * f, H / 2 + sh.y * f);
            const z = 1 + (zoom - 1) * f;
            ctx.scale(z, z);
            ctx.translate(-(W / 2 + (cx - W / 2) * f), -(H / 2 + (cy - H / 2) * f));
            if (layer.canvas) ctx.drawImage(layer.canvas, layer.ox, layer.oy, layer.w, layer.h);
            BackdropLayers.anim(ctx, bd, layer);
            ctx.restore();
        }
    },

    // Opaque props in front of the fighters, plus the lightning flash (after the world is drawn)
    drawFront(ctx, bd, cam, sh) {
        BackdropLayers.drawFront(ctx, bd, cam, sh);
    }
};
