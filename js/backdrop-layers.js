// Layered backdrops, v2. A backdrop VARIANT (backdrop-variants.js) is a palette plus a
// recipe; this file turns it into ~28 depth layers, back to front: sky, star
// fields, ridge silhouettes with trees / pillars / crystals / mushrooms..., cloud
// banks, mist, landmarks, floating islands or asteroids, particles, a ground strip,
// and a few OPAQUE props in front of the fighters at the top and bottom edges.
//
// Parallax comes ONLY from the real game camera: a layer with factor f shifts by
// f x (camera - centre) and scales by 1 + (zoom - 1) x f. f = 1 is the world itself,
// so layers near f ~ 1 (ground, foreground) barely move against the arena floor,
// and far layers lag behind it. Nothing sways or drifts on its own except slow
// ambience (clouds, particles).
const BG_WIDE = 0.2;                 // extra width painted each side, for windows wider than the arena
const BG_PAN = 0.14;                 // widest camera shift we pad for, as a fraction of the screen
const BG_PARTS_F = [0.42, 0.86];     // depth of the two particle layers
const BG_FRONT_F = 1.1;              // the foreground props
const PART_SCALE = [1, 1.5];

const BG = {
    lerp: (a, b, t) => a + (b - a) * t,
    rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
    mix(c1, c2, t) {
        const a = BG.rgb(c1), b = BG.rgb(c2);
        return '#' + [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join('');
    },
    pick(c, rng) { return Array.isArray(c) ? c[Math.floor(rng() * c.length)] : c; },
    smooth(arr, k) {
        for (let pass = 0; pass < k; pass++) {
            const out = new Float32Array(arr.length);
            for (let i = 0; i < arr.length; i++) {
                let s = 0, n = 0;
                for (let j = -3; j <= 3; j++) { s += arr[Math.max(0, Math.min(arr.length - 1, i + j))]; n++; }
                out[i] = s / n;
            }
            arr = out;
        }
        return arr;
    }
};

const BackdropLayers = {
    mxFor(f, W) { return Math.ceil(f * BG_PAN * W) + 30 + Math.ceil(W * BG_WIDE); },
    myFor(f, H) { return Math.ceil(f * BG_PAN * H) + 30; },

    // ---------- Assembly ----------

    assemble(bd, rng, V) {
        const tint = V.cloudTint || { shade: '150,175,205', hi: '255,255,255', lo: '235,242,250' };
        bd.cloudSprites = [0, 1, 2, 3, 4].map(() => this.cloudSprite(rng, tint));
        bd.parts = [[], []];
        const steps = this.plan(V);
        steps.forEach((s, i) => { s.o = i; });
        steps.sort((a, b) => a.f - b.f || a.o - b.o);
        for (const s of steps) this.addStep(bd, rng, V, s);
        this.foreground(bd, rng, V);
    },

    // The list of layers for a variant, each with its parallax factor f
    plan(V) {
        const st = [{ k: 'sky', f: 0.02 }];
        if (V.stars) {
            st.push({ k: 'stars', f: 0.03, n: Math.round(V.stars * 0.4), size: 1.2 });
            st.push({ k: 'stars', f: 0.05, n: Math.round(V.stars * 0.25), size: 1.5 });
            st.push({ k: 'stars', f: 0.08, n: Math.round(V.stars * 0.2), size: 1.9 });
        }
        const R = V.ridges;
        if (R) {
            for (let i = 0; i < R.n; i++) {
                const t = R.n > 1 ? i / (R.n - 1) : 0, e = Math.pow(t, 0.9);
                st.push({
                    k: 'ridge', f: 0.05 + Math.pow(t, 1.25) * 0.62, t, i,
                    base: BG.lerp(R.base[0], R.base[1], e), amp: BG.lerp(R.amp[0], R.amp[1], e),
                    oct: Math.round(BG.lerp(R.oct[0], R.oct[1], t)),
                    c: [BG.mix(R.far[0], R.near[0], e), BG.mix(R.far[1], R.near[1], e)],
                    fog: [V.haze, BG.lerp(R.fog[0], R.fog[1], t)],
                    shape: typeof R.shape === 'function' ? R.shape(t, i) : (R.shape || 'ridge'),
                    snow: i < (R.snow || 0), lava: !!R.lava && t > 0.35,
                    deco: R.deco ? (typeof R.deco === 'function' ? R.deco(t, i) : R.deco) : null, windmill: !!R.windmill && i === Math.round(R.n * 0.45)
                });
            }
        }
        const C = V.ceil;
        if (C) {
            for (let i = 0; i < C.n; i++) {
                const t = C.n > 1 ? i / (C.n - 1) : 0;
                st.push({
                    k: 'ridge', anchor: 'top', f: 0.06 + Math.pow(t, 1.2) * 0.5, t, i,
                    base: BG.lerp(C.base[0], C.base[1], t), amp: BG.lerp(C.amp[0], C.amp[1], t), oct: 4,
                    c: [BG.mix(C.far[0], C.near[0], t), BG.mix(C.far[1], C.near[1], t)],
                    fog: [V.haze, BG.lerp(C.fog[0], C.fog[1], t)], shape: 'ridge', deco: C.deco ? (typeof C.deco === 'function' ? C.deco(t, i) : C.deco) : null
                });
            }
        }
        for (const c of V.clouds || []) st.push(Object.assign({ k: 'clouds' }, c));
        for (const m of V.mist || []) st.push(Object.assign({ k: 'mist' }, m));
        for (const e of V.extras || []) st.push(Object.assign({}, e));
        if (V.mid) st.push({ k: 'mid', f: V.midF || 0.3 });
        if (V.ambient && V.ambient.birds) st.push({ k: 'birds', f: 0.34 });
        st.push({ k: 'ground', f: 0.8 });
        if (V.parts && V.parts.length) { st.push({ k: 'parts', f: BG_PARTS_F[0], b: 0 }); st.push({ k: 'parts', f: BG_PARTS_F[1], b: 1 }); }
        return st;
    },

    // One painted layer: a canvas covering [-Mx, W+Mx] x [top, bottom]. Painters work in
    // "P space" (x in 0..W+2Mx) so scenery fills the margins too.
    paint(bd, f, top, bottom, tag, fn) {
        const W = bd.W, H = bd.H, q = bd.q;
        const Mx = this.mxFor(f, W), My = this.myFor(f, H);
        top = Math.max(top, -My);
        bottom = Math.min(bottom, H + My);
        if (bottom - top < 4) return;
        const Wext = W + Mx * 2;
        const c = Backdrop.canvas(Math.max(1, Math.ceil(Wext * q)), Math.max(1, Math.ceil((bottom - top) * q)));
        const ctx = c.getContext('2d');
        ctx.setTransform(q, 0, 0, q, 0, -top * q);
        fn(ctx, Wext, H, Mx);
        bd.layers.push({ f, tag, canvas: c, ox: -Mx, oy: top, w: Wext, h: bottom - top, mx: Mx });
    },

    addStep(bd, rng, V, s) {
        const W = bd.W, H = bd.H;
        switch (s.k) {
            case 'sky':
                this.paint(bd, s.f, -1e9, 1e9, 'sky', (ctx, Wx, Hh, Mx) => Backdrop.paintSky(ctx, Wx, Hh, V, rng, Mx));
                break;
            case 'stars': {
                const xr = s.f * BG_PAN * W + 40 + W * BG_WIDE, items = [];
                for (let i = 0; i < s.n; i++) items.push({ x: -xr + rng() * (W + 2 * xr), y: rng() * H * 0.62, ph: rng() * 6.28, s: s.size * (0.6 + rng() * 0.8) });
                bd.layers.push({ f: s.f, tag: 'stars', items });
                break;
            }
            case 'ridge': {
                const decos = [].concat(s.deco || []);
                const dh = decos.reduce((m, d) => Math.max(m, d.h || 0), 0);
                if (s.anchor === 'top') this.paint(bd, s.f, -1e9, H * (s.base + s.amp * 1.7) + dh * 1.6 + 30, 'ridge', (ctx, Wx, Hh) => this.ridge(ctx, rng, Wx, Hh, s, V));
                else this.paint(bd, s.f, Math.floor(H * (s.base - s.amp * 1.4) - (s.shape === 'cloudbank' ? H * 0.2 : dh * 1.9) - 40), 1e9, 'ridge', (ctx, Wx, Hh) => this.ridge(ctx, rng, Wx, Hh, s, V));
                break;
            }
            case 'mid':
                this.paint(bd, s.f, H * 0.08, 1e9, 'mid', (ctx, Wx, Hh) => {
                    const fn = BackdropScenery[V.mid];
                    if (fn) fn.call(BackdropScenery, ctx, Wx, Hh, rng, bd, V);
                });
                break;
            case 'ground':
                this.paint(bd, s.f, H * 0.86, 1e9, 'ground', (ctx, Wx, Hh) => this.ground(ctx, rng, Wx, Hh, V));
                break;
            case 'islands':
                this.paint(bd, s.f, H * s.y[0] - 140, H * s.y[1] + s.w[1] * 1.5 + 160, 'islands', (ctx, Wx, Hh) => this.islands(ctx, rng, Wx, Hh, s, V));
                break;
            case 'landmark':
                this.paint(bd, s.f, H * s.y - s.size * 1.9 - 60, H * s.y + 90, 'landmark', (ctx, Wx, Hh, Mx) => this.landmark(ctx, rng, Wx, Hh, s, Mx));
                break;
            case 'clouds': {
                const items = [], xr = s.f * BG_PAN * W + 160 + W * BG_WIDE;
                for (let i = 0; i < s.n; i++) {
                    items.push({ x: -xr + rng() * (W + 2 * xr), y: H * (s.y[0] + rng() * (s.y[1] - s.y[0])), s: s.s[0] + rng() * (s.s[1] - s.s[0]),
                                 v: s.v * (0.7 + rng() * 0.6), sp: Math.floor(rng() * bd.cloudSprites.length), xr });
                }
                bd.layers.push({ f: s.f, tag: 'clouds', a: s.a, items });
                break;
            }
            case 'mist': {
                const items = [];
                for (let i = 0; i < s.n; i++) items.push({ x: rng() * (W + 600) - 300, y: H * (s.y[0] + rng() * (s.y[1] - s.y[0])), s: 0.8 + rng() * 0.9, v: 0.05 + rng() * 0.08 });
                bd.layers.push({ f: s.f, tag: 'mist', items, a: s.a, sprite: Backdrop.mistSprite(s.rgb) });
                break;
            }
            case 'birds':
                bd.layers.push({ f: s.f, tag: 'birds' });
                break;
            case 'parts':
                bd.layers.push({ f: s.f, tag: 'parts', b: s.b });
                this.spawnParts(bd, rng, V, s.b, s.f);
                break;
        }
    },

    // ---------- Soft clouds ----------

    // Overlapping feathered puffs on a flat base: no hard circles, no outlines
    cloudSprite(rng, tint) {
        const c = Backdrop.canvas(320, 140), ctx = c.getContext('2d');
        const puffs = [];
        const n = 12 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i++) {
            const x = 50 + rng() * 220, lift = 1 - Math.abs(x - 160) / 130;
            puffs.push([x, 92 - lift * (18 + rng() * 26) - rng() * 8, 24 + rng() * 22 + lift * 12]);
        }
        const draw = (dy, rgb, a0, k = 1) => {
            for (const [x, y, r0] of puffs) {
                const r = r0 * k;
                const g = ctx.createRadialGradient(x, y + dy, r * 0.1, x, y + dy, r);
                g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(0.6, `rgba(${rgb},${a0 * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(x - r, y + dy - r, r * 2, r * 2);
            }
        };
        draw(8, tint.shade, 0.5, 0.7);       // belly shadow stays inside the puff, so no dark rims
        draw(0, tint.lo, 0.62);
        draw(-6, tint.hi, 0.42, 0.75);
        // flat, fading underside
        ctx.globalCompositeOperation = 'destination-out';
        const m = ctx.createLinearGradient(0, 88, 0, 128);
        m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = m; ctx.fillRect(0, 88, 320, 52);
        return c;
    },

    // ---------- Ridges and what grows on them ----------

    // A sea of billowing cumulus: big shaded domes of varied size on a solid cloud
    // sheet, lit from the upper left. Far layers have small domes, near ones big.
    cloudSea(ctx, rng, W, H, s) {
        const M = BACKDROP_MARGIN, n = Math.ceil((W + M * 2) / 5);
        const base = H * s.base, amp = H * s.amp;
        const prof = BG.smooth(Backdrop.ridge(rng, n, 3, 0.5), 6);
        const edgeY = (x) => base - prof[Math.max(0, Math.min(n - 1, Math.round((x + M) / 5)))] * amp * 1.3;
        const c0 = s.c[0], c1 = s.c[1];
        const lum = (parseInt(c0.slice(1, 3), 16) * 0.3 + parseInt(c0.slice(3, 5), 16) * 0.59 + parseInt(c0.slice(5, 7), 16) * 0.11) / 255;
        const sun = BG.rgb(BG.mix(c0, '#ffffff', 0.35 + 0.5 * lum)), shadow = BG.rgb(lum > 0.6 ? BG.mix(c1, '#6f8cba', 0.45) : BG.mix(c1, c0, 0.4));
        const body = BG.rgb(c0);
        // Value noise lattice (wraps), summed over octaves: the density field of the cloud
        const G = 128, grid = new Float32Array(G * G);
        for (let i = 0; i < grid.length; i++) grid[i] = rng();
        const vn = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
            const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
            const x0 = xi & 127, x1 = (xi + 1) & 127, y0 = (yi & 127) * G, y1 = ((yi + 1) & 127) * G;
            const a = grid[y0 + x0] + (grid[y0 + x1] - grid[y0 + x0]) * u, b = grid[y1 + x0] + (grid[y1 + x1] - grid[y1 + x0]) * u;
            return a + (b - a) * v;
        };
        const fbm = (x, y) => (vn(x, y) * 0.5 + vn(x * 2.03 + 11.7, y * 2.03 + 5.3) * 0.27 + vn(x * 4.1 + 3.1, y * 4.1 + 17.9) * 0.15 + vn(x * 8.3 + 23.3, y * 8.3 + 9.1) * 0.08);
        const Z = H * (0.15 + 0.08 * s.t);            // how thick the billowing zone is
        const lx = Z * 2.6, ly = Z * 1.35;           // feature size: wide, flattish billows
        const seedX = rng() * 90, seedY = rng() * 90;
        const dens = (x, y) => {
            const h = (y - edgeY(x)) / Z;
            return (fbm(x / lx + seedX, y / ly + seedY) - 0.5) * 1.55 + 0.2 + h * 0.95;
        };
        const D = 3;                                   // noise is sampled every 3px and smoothed up
        const y0 = Math.floor(H * (s.base - s.amp * 1.4) - H * 0.22 - 20), y1 = Math.ceil(H * (s.base + s.amp * 1.4) + Z * 1.5);
        const ww = Math.ceil((W + M * 2) / D), hh = Math.ceil((y1 - y0) / D);
        const img = ctx.createImageData(ww, hh), px = img.data;
        const ox = 0.07, oy = 0.1;                      // toward the light (up and left), in noise space
        for (let j = 0; j < hh; j++) {
            const y = y0 + j * D;
            for (let i = 0; i < ww; i++) {
                const x = -M + i * D, v = dens(x, y);
                if (v < -0.02) continue;
                const al = Math.min(1, v / 0.3), sm = al * al * (3 - 2 * al);
                const vl = (fbm(x / lx + seedX - ox, y / ly + seedY - oy) - 0.5) * 1.55 + 0.2 + ((y - oy * ly - edgeY(x)) / Z) * 0.95;
                let t = 0.55 + (v - vl) * 3.2;                        // facing the light = bright
                t -= Math.max(0, Math.min(1, (v - 0.4) * 0.55)) * 0.55;   // deep inside is shadowed
                t = Math.max(0, Math.min(1, t));
                // thin wispy edges pick up a little sun and scatter it
                t = Math.min(1, t + (1 - sm) * 0.25);
                const k = (j * ww + i) * 4;
                if (t < 0.5) { const u = t * 2; px[k] = shadow[0] + (body[0] - shadow[0]) * u; px[k + 1] = shadow[1] + (body[1] - shadow[1]) * u; px[k + 2] = shadow[2] + (body[2] - shadow[2]) * u; }
                else { const u = (t - 0.5) * 2; px[k] = body[0] + (sun[0] - body[0]) * u; px[k + 1] = body[1] + (sun[1] - body[1]) * u; px[k + 2] = body[2] + (sun[2] - body[2]) * u; }
                px[k + 3] = sm * 255;
            }
        }
        const tmp = Backdrop.canvas(ww, hh);
        tmp.getContext('2d').putImageData(img, 0, 0);
        // the solid cloud floor below the noisy band, then the band on top
        const floor = ctx.createLinearGradient(0, y1 - Z * 2, 0, H + M);
        floor.addColorStop(0, `rgb(${shadow[0] * 0.55 + body[0] * 0.45 | 0},${shadow[1] * 0.55 + body[1] * 0.45 | 0},${shadow[2] * 0.55 + body[2] * 0.45 | 0})`);
        floor.addColorStop(1, `rgb(${shadow[0]},${shadow[1]},${shadow[2]})`);
        ctx.fillStyle = floor;
        ctx.fillRect(-M, y1 - 2, W + M * 2, H + M * 2 - y1);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tmp, -M, y0, ww * D, hh * D);
        if (s.fog) this.fog(ctx, W, base - amp * 1.5, H, s.fog);
    },

    ridge(ctx, rng, W, H, s, V) {
        if (s.shape === 'cloudbank' && s.anchor !== 'top') return this.cloudSea(ctx, rng, W, H, s);
        const M = BACKDROP_MARGIN, step = 5, n = Math.ceil((W + M * 2) / step), top = s.anchor === 'top';
        let r = Backdrop.ridge(rng, n, s.oct || 4, 0.5);
        if (s.shape === 'dunes') r = BG.smooth(Backdrop.ridge(rng, n, 2, 0.45), 8);
        else if (s.shape === 'mesas') {
            const q = Backdrop.ridge(rng, n, 3, 0.5);
            r = BG.smooth(q.map(v => Math.round(v * 4) / 4), 3);
        } else if (s.shape === 'cloudbank') r = BG.smooth(r, 3);
        const pts = [];
        for (let i = 0; i < n; i++) {
            const x = -M + i * step, v = r[i];
            pts.push([x, top ? H * s.base + Math.pow(v, 1.2) * H * s.amp * 1.4 : H * s.base - Math.pow(v, 1.25) * H * s.amp * 1.6 + H * s.amp * 0.3]);
        }
        ctx.beginPath();
        if (top) {
            ctx.moveTo(-M, -M - 300);
            for (const [x, y] of pts) ctx.lineTo(x, y);
            ctx.lineTo(W + M, -M - 300);
        } else {
            ctx.moveTo(-M, H + M);
            for (const [x, y] of pts) ctx.lineTo(x, y);
            ctx.lineTo(W + M, H + M);
        }
        ctx.closePath();
        const g = top ? ctx.createLinearGradient(0, -M, 0, H * (s.base + s.amp * 1.5)) : ctx.createLinearGradient(0, H * (s.base - s.amp * 1.3), 0, H);
        if (top) { g.addColorStop(0, s.c[1]); g.addColorStop(1, s.c[0]); } else { g.addColorStop(0, s.c[0]); g.addColorStop(1, s.c[1]); }
        ctx.fillStyle = g; ctx.fill();
        if (s.snow) {
            ctx.save(); ctx.clip();
            const line = H * s.base - H * s.amp * 0.55;
            ctx.beginPath(); ctx.moveTo(-M, -M);
            for (let x = -M; x <= W + M; x += 12) ctx.lineTo(x, line + Math.sin(x * 0.05) * 10 + rng() * 14);
            ctx.lineTo(W + M, -M); ctx.closePath();
            ctx.fillStyle = 'rgba(240,244,255,0.78)'; ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        if (s.lava) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,100,30,0.28)'; ctx.lineWidth = 7;
            ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1)); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,190,90,0.6)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1)); ctx.stroke();
            ctx.restore();
        }
        for (const d of [].concat(s.deco || [])) {
            const count = d.n * (W / 1500 + 0.3);
            for (let i = 0; i < count; i++) {
                const [x, y] = pts[Math.floor(rng() * pts.length)];
                this.DECO[d.k].call(this.DECO, ctx, x, top ? y - 2 : y + 2, d.h * (0.7 + rng() * 0.7), BG.pick(d.c, rng), rng);
            }
        }
        if (s.windmill) this.DECO.windmill(ctx, pts, rng);
        if (s.fog) this.fog(ctx, W, top ? H * (s.base + s.amp * 1.5) : H * (s.base - s.amp * 1.5), top ? -M : H, s.fog);
    },

    // Tint everything already painted toward the haze colour (atmospheric perspective)
    fog(ctx, W, y0, y1, fog) {
        const M = BACKDROP_MARGIN;
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, `rgba(${fog[0]},${fog[1] * 0.45})`);
        g.addColorStop(1, `rgba(${fog[0]},${fog[1]})`);
        ctx.fillStyle = g;
        ctx.fillRect(-M, -4000, W + M * 2, 8000);
        ctx.restore();
    },

    DECO: {
        pine(ctx, x, y, h, c) {
            const w = h * 0.36;
            ctx.fillStyle = c;
            for (let k = 0; k < 3; k++) {
                const by = y - h * 0.1 - k * h * 0.27, tw = w * (1 - k * 0.27);
                ctx.beginPath(); ctx.moveTo(x - tw, by); ctx.lineTo(x, by - h * 0.44); ctx.lineTo(x + tw, by); ctx.closePath(); ctx.fill();
            }
            ctx.fillRect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14);
        },
        snowPine(ctx, x, y, h, c) {
            this.pine(ctx, x, y, h, c);
            const w = h * 0.36;
            ctx.fillStyle = '#eef6ff';
            for (let k = 0; k < 3; k++) {
                const by = y - h * 0.1 - k * h * 0.27, tw = w * (1 - k * 0.27), tip = by - h * 0.44;
                ctx.beginPath(); ctx.moveTo(x - tw * 0.55, by - h * 0.2); ctx.lineTo(x, tip); ctx.lineTo(x + tw * 0.55, by - h * 0.2); ctx.closePath(); ctx.fill();
            }
        },
        round(ctx, x, y, h, c) {
            ctx.fillStyle = '#3a2a1b';
            ctx.fillRect(x - h * 0.04, y - h * 0.5, h * 0.08, h * 0.5);
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.arc(x, y - h * 0.72, h * 0.42, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + h * 0.25, y - h * 0.6, h * 0.28, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x - h * 0.26, y - h * 0.62, h * 0.26, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,250,200,0.14)';
            ctx.beginPath(); ctx.arc(x - h * 0.12, y - h * 0.82, h * 0.22, 0, Math.PI * 2); ctx.fill();
        },
        tower(ctx, x, y, h, c, rng) {
            const w = h * 0.9;
            ctx.fillStyle = c;
            ctx.fillRect(x - w / 2, y - h * 0.34, w, h * 0.36);
            for (let cx = x - w / 2; cx < x + w / 2; cx += 7) ctx.fillRect(cx, y - h * 0.34 - 4, 4, 4);
            for (const t of [-0.34, 0.34]) {
                const tx = x + w * t, tw = h * 0.16, th = h * (0.7 + rng() * 0.3);
                ctx.fillRect(tx - tw / 2, y - th, tw, th);
                ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 2, y - th); ctx.lineTo(tx, y - th - h * 0.3); ctx.lineTo(tx + tw / 2 + 2, y - th); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,190,100,0.85)';
                ctx.fillRect(tx - 1, y - th * 0.7, 2, 3);
                ctx.fillStyle = c;
            }
        },
        deadtree(ctx, x, y, h, c, rng) {
            ctx.strokeStyle = c; ctx.lineCap = 'round';
            const branch = (bx, by, ang, len, wd, depth) => {
                const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
                ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
                if (depth <= 0) return;
                branch(ex, ey, ang - 0.5 - rng() * 0.4, len * 0.7, wd * 0.7, depth - 1);
                branch(ex, ey, ang + 0.5 + rng() * 0.4, len * 0.66, wd * 0.7, depth - 1);
            };
            branch(x, y + 2, -Math.PI / 2 + (rng() - 0.5) * 0.3, h * 0.42, Math.max(1.5, h * 0.06), 3);
        },
        iceSpire(ctx, x, y, h, c, rng) {
            const w = h * 0.2;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + (rng() - 0.5) * w, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h * 0.96); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
        },
        spire(ctx, x, y, h, c) {
            const w = h * 0.16;
            const g = ctx.createLinearGradient(0, y - h, 0, y);
            g.addColorStop(0, '#d9b8ff'); g.addColorStop(0.4, c); g.addColorStop(1, '#1a0838');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h * 0.35); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x - w * 0.6, y); ctx.lineTo(x - w, y - h * 0.35); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(235,205,255,0.35)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y); ctx.stroke();
        },
        crystal(ctx, x, y, h, c, rng) {
            const rgb = BG.rgb(c).join(',');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - h * 0.4, 1, x, y - h * 0.4, h * 0.9);
            gl.addColorStop(0, `rgba(${rgb},0.26)`); gl.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = gl; ctx.fillRect(x - h, y - h * 1.5, h * 2, h * 2);
            ctx.restore();
            [[-0.2, 0.7, -0.22], [0.2, 0.55, 0.25], [0, 1, 0]].forEach(([dx, sc, lean]) => {
                const hh = h * sc, w = h * 0.13 * sc + 2;
                const g = ctx.createLinearGradient(0, y - hh, 0, y);
                g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, c); g.addColorStop(1, BG.mix(c, '#000000', 0.75));
                ctx.fillStyle = g;
                const bx = x + dx * h * 0.5;
                ctx.beginPath(); ctx.moveTo(bx + lean * hh, y - hh); ctx.lineTo(bx + w, y - hh * 0.3); ctx.lineTo(bx + w * 0.7, y); ctx.lineTo(bx - w * 0.7, y); ctx.lineTo(bx - w, y - hh * 0.3); ctx.closePath(); ctx.fill();
            });
        },
        hangCrystal(ctx, x, y, h, c, rng) {
            ctx.save(); ctx.translate(x, y); ctx.scale(1, -1);
            this.crystal(ctx, 0, 0, h, c, rng);
            ctx.restore();
        },
        stalactite(ctx, x, y, h, c) {
            const w = h * 0.16;
            const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
            g.addColorStop(0, BG.mix(c, '#ffffff', 0.18)); g.addColorStop(1, BG.mix(c, '#000000', 0.35));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + Math.sin(x) * 0.3 * w, y + h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
        },
        rockSpike(ctx, x, y, h, c, rng) {
            const w = h * 0.22;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.3, y - h * 0.6); ctx.lineTo(x + (rng() - 0.5) * w * 0.6, y - h); ctx.lineTo(x + w * 0.5, y - h * 0.5); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h * 0.6); ctx.lineTo(x, y - h * 0.95); ctx.lineTo(x - w * 0.1, y - h * 0.4); ctx.closePath(); ctx.fill();
        },
        rock(ctx, x, y, h, c) {
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.moveTo(x - h * 0.7, y); ctx.lineTo(x - h * 0.5, y - h * 0.6); ctx.lineTo(x - h * 0.05, y - h); ctx.lineTo(x + h * 0.5, y - h * 0.55); ctx.lineTo(x + h * 0.75, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.moveTo(x - h * 0.5, y - h * 0.6); ctx.lineTo(x - h * 0.05, y - h); ctx.lineTo(x + h * 0.1, y - h * 0.55); ctx.closePath(); ctx.fill();
        },
        cactus(ctx, x, y, h, c) {
            const w = h * 0.2;
            ctx.fillStyle = c;
            const rr = (a, b, cw, ch) => { ctx.beginPath(); ctx.moveTo(a, b + ch); ctx.lineTo(a, b + cw / 2); ctx.arc(a + cw / 2, b + cw / 2, cw / 2, Math.PI, 0); ctx.lineTo(a + cw, b + ch); ctx.closePath(); ctx.fill(); };
            rr(x - w / 2, y - h, w, h);
            rr(x - w * 1.9, y - h * 0.8, w * 0.7, h * 0.36);
            rr(x + w * 1.2, y - h * 0.65, w * 0.7, h * 0.4);
            ctx.fillRect(x - w * 1.3, y - h * 0.56, w * 0.9, w * 0.6);
            ctx.fillRect(x + w * 0.4, y - h * 0.42, w * 0.9, w * 0.6);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(x - w * 0.15, y - h * 0.95, w * 0.2, h * 0.9);
        },
        pillar(ctx, x, y, h, c, rng) {
            const w = h * 0.2, top = y - h;
            ctx.fillStyle = c;
            ctx.fillRect(x - w * 0.62, y - h * 0.06, w * 1.24, h * 0.06);
            ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.06); ctx.lineTo(x - w / 2, top + h * 0.12);
            ctx.lineTo(x - w * 0.2, top + h * 0.05 * rng()); ctx.lineTo(x + w * 0.1, top + h * 0.1); ctx.lineTo(x + w / 2, top + h * 0.02 + h * 0.08 * rng()); ctx.lineTo(x + w / 2, y - h * 0.06); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x - w * 0.5, top + h * 0.15, w * 0.2, h * 0.78);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + w * 0.22, top + h * 0.15, w * 0.28, h * 0.78);
        },
        arch(ctx, x, y, h, c) {
            const w = h * 0.75;
            ctx.strokeStyle = c; ctx.lineWidth = h * 0.15; ctx.lineCap = 'butt';
            ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.55); ctx.arc(x, y - h * 0.55, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y); ctx.stroke();
        },
        mushroom(ctx, x, y, h, c, rng) {
            const cap = BG.pick(c, rng), rgb = BG.rgb(cap).join(',');
            ctx.fillStyle = BG.mix(cap, '#ffffff', 0.55);
            ctx.fillRect(x - h * 0.07, y - h * 0.55, h * 0.14, h * 0.55);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - h * 0.62, 1, x, y - h * 0.62, h * 0.85);
            gl.addColorStop(0, `rgba(${rgb},0.3)`); gl.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = gl; ctx.fillRect(x - h, y - h * 1.5, h * 2, h * 2); ctx.restore();
            ctx.fillStyle = cap;
            ctx.beginPath(); ctx.ellipse(x, y - h * 0.58, h * 0.5, h * 0.36, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (k - 1) * h * 0.22, y - h * 0.68 - (k % 2) * h * 0.06, h * 0.05, 0, Math.PI * 2); ctx.fill(); }
        },
        puff(ctx, x, y, h, c) {
            const rgb = BG.rgb(c).join(',');
            for (const [dx, dy, r] of [[0, 0, 0.5], [-0.45, 0.12, 0.38], [0.45, 0.1, 0.4], [0.9, 0.2, 0.3], [-0.9, 0.2, 0.3]]) {
                const g = ctx.createRadialGradient(x + dx * h, y - dy * h, 1, x + dx * h, y - dy * h, r * h);
                g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.65, `rgba(${rgb},0.9)`); g.addColorStop(1, `rgba(${rgb},0)`);
                ctx.fillStyle = g; ctx.fillRect(x + (dx - r) * h, y - dy * h - r * h, r * h * 2, r * h * 2);
            }
        },
        windmill(ctx, pts, rng) {
            const [x, y] = pts[Math.floor(pts.length * (0.3 + rng() * 0.4))];
            const h = 58;
            ctx.fillStyle = '#6a8662';
            ctx.beginPath(); ctx.moveTo(x - 9, y + 2); ctx.lineTo(x - 5, y - h); ctx.lineTo(x + 5, y - h); ctx.lineTo(x + 9, y + 2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#4e6a48';
            ctx.beginPath(); ctx.moveTo(x - 8, y - h); ctx.lineTo(x, y - h - 14); ctx.lineTo(x + 8, y - h); ctx.closePath(); ctx.fill();
            ctx.save(); ctx.translate(x, y - h + 3); ctx.rotate(rng() * 1.5);
            ctx.fillStyle = '#e8e0cc';
            for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillRect(2, -3, 44, 6); }
            ctx.restore();
        }
    },

    // ---------- Single big features ----------

    landmark(ctx, rng, W, H, s, Mx) {
        const x = Mx + (W - 2 * Mx) * s.x, y = H * s.y, z = s.size, c = s.c || ['#8a6a4a', '#5a3d28'];
        if (s.base) {
            ctx.fillStyle = s.base;
            ctx.beginPath(); ctx.ellipse(x, y + 4, z * 1.5, z * 0.16, 0, Math.PI, 0); ctx.fill();
            ctx.fillRect(x - z * 1.5, y + 3, z * 3, 90);
        }
        const kind = s.kind;
        if (kind === 'pyramid') {
            ctx.fillStyle = c[0]; ctx.beginPath(); ctx.moveTo(x - z, y); ctx.lineTo(x, y - z * 0.95); ctx.lineTo(x + z * 0.2, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(x + z * 0.2, y); ctx.lineTo(x, y - z * 0.95); ctx.lineTo(x + z, y); ctx.closePath(); ctx.fill();
        } else if (kind === 'temple') {
            ctx.fillStyle = c[1];
            ctx.fillRect(x - z * 0.95, y - z * 0.08, z * 1.9, z * 0.08);
            ctx.fillRect(x - z * 0.85, y - z * 0.16, z * 1.7, z * 0.08);
            for (let i = 0; i < 6; i++) { ctx.fillStyle = c[i % 2 ? 0 : 1]; ctx.fillRect(x - z * 0.75 + i * z * 0.3 - z * 0.05, y - z * 0.7, z * 0.1, z * 0.54); }
            ctx.fillStyle = c[1];
            ctx.fillRect(x - z * 0.85, y - z * 0.78, z * 1.7, z * 0.08);
            ctx.beginPath(); ctx.moveTo(x - z * 0.9, y - z * 0.78); ctx.lineTo(x, y - z * 1.12); ctx.lineTo(x + z * 0.9, y - z * 0.78); ctx.closePath(); ctx.fill();
        } else if (kind === 'volcano') {
            const g = ctx.createLinearGradient(0, y - z, 0, y);
            g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - z * 1.4, y); ctx.lineTo(x - z * 0.22, y - z); ctx.lineTo(x + z * 0.22, y - z); ctx.lineTo(x + z * 1.4, y); ctx.closePath(); ctx.fill();
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - z, 2, x, y - z, z * 0.9);
            gl.addColorStop(0, 'rgba(255,150,60,0.7)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.fillStyle = gl; ctx.fillRect(x - z, y - z * 1.9, z * 2, z * 1.8);
            ctx.strokeStyle = 'rgba(255,120,40,0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + (i - 1) * z * 0.12, y - z); ctx.quadraticCurveTo(x + (i - 1) * z * 0.5, y - z * 0.55, x + (i - 1) * z * 0.7, y - z * 0.1); ctx.stroke(); }
            ctx.restore();
        } else if (kind === 'cabin') {
            ctx.fillStyle = c[1]; ctx.fillRect(x - z * 0.5, y - z * 0.5, z, z * 0.5);
            ctx.beginPath(); ctx.moveTo(x - z * 0.65, y - z * 0.5); ctx.lineTo(x, y - z * 0.95); ctx.lineTo(x + z * 0.65, y - z * 0.5); ctx.closePath(); ctx.fillStyle = c[0]; ctx.fill();
            ctx.fillStyle = c[1]; ctx.fillRect(x + z * 0.25, y - z * 1.05, z * 0.14, z * 0.35);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,190,90,0.95)'; ctx.fillRect(x - z * 0.22, y - z * 0.36, z * 0.22, z * 0.2);
            const gl = ctx.createRadialGradient(x - z * 0.11, y - z * 0.26, 1, x - z * 0.11, y - z * 0.26, z * 0.8);
            gl.addColorStop(0, 'rgba(255,190,90,0.35)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gl; ctx.fillRect(x - z, y - z, z * 2, z * 1.4); ctx.restore();
        } else if (kind === 'lighthouse') {
            ctx.fillStyle = c[0];
            ctx.beginPath(); ctx.moveTo(x - z * 0.2, y); ctx.lineTo(x - z * 0.12, y - z * 1.2); ctx.lineTo(x + z * 0.12, y - z * 1.2); ctx.lineTo(x + z * 0.2, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = c[1];
            for (let i = 0; i < 3; i++) ctx.fillRect(x - z * (0.19 - i * 0.026), y - z * (0.3 + i * 0.3), z * (0.38 - i * 0.052), z * 0.13);
            ctx.fillRect(x - z * 0.17, y - z * 1.3, z * 0.34, z * 0.1);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - z * 1.34, 1, x, y - z * 1.34, z * 0.9);
            gl.addColorStop(0, 'rgba(255,240,170,0.9)'); gl.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = gl; ctx.fillRect(x - z, y - z * 2.3, z * 2, z * 2); ctx.restore();
        } else if (kind === 'planet') {
            const cy = y - z;
            const g = ctx.createRadialGradient(x - z * 0.35, cy - z * 0.35, z * 0.1, x, cy, z);
            g.addColorStop(0, c[0]); g.addColorStop(0.65, c[1]); g.addColorStop(1, BG.mix(c[1], '#000000', 0.6));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, z, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.arc(x, cy, z, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            for (let i = 0; i < 4; i++) ctx.fillRect(x - z, cy - z * 0.6 + i * z * 0.32, z * 2, z * 0.1);
            ctx.restore();
            if (s.ring) {
                ctx.strokeStyle = s.ring; ctx.lineWidth = z * 0.09;
                ctx.beginPath(); ctx.ellipse(x, cy, z * 1.7, z * 0.34, -0.3, 0, Math.PI * 2); ctx.stroke();
            }
        } else if (kind === 'stormCloud') {
            const rgb = BG.rgb(c[0]).join(','), rgb2 = BG.rgb(c[1]).join(',');
            // dark underside first, then lighter tops: every puff fades to nothing at its rim, so no rings
            const pf = [];
            for (let i = 0; i < 26; i++) pf.push([x + (rng() - 0.5) * z * 2.6, y - z * 0.25 - rng() * z * 0.8, z * (0.26 + rng() * 0.34)]);
            const blob = (px, py, r, col, a) => {
                const g = ctx.createRadialGradient(px, py, 0, px, py, r);
                g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.5, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`);
                ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
            };
            for (const [px, py, r] of pf) blob(px, py + r * 0.3, r, rgb, 0.5);
            for (const [px, py, r] of pf) blob(px, py, r * 0.9, rgb2, 0.42);
            for (const [px, py, r] of pf) blob(px - r * 0.15, py - r * 0.3, r * 0.6, rgb2, 0.3);
        } else if (kind === 'giantMushroom') {
            const cap = c[0], rgb = BG.rgb(cap).join(',');
            ctx.fillStyle = BG.mix(cap, '#ffffff', 0.6);
            ctx.beginPath(); ctx.moveTo(x - z * 0.12, y); ctx.lineTo(x - z * 0.08, y - z * 0.9); ctx.lineTo(x + z * 0.08, y - z * 0.9); ctx.lineTo(x + z * 0.12, y); ctx.closePath(); ctx.fill();
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - z, 2, x, y - z, z * 1.3);
            gl.addColorStop(0, `rgba(${rgb},0.3)`); gl.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = gl; ctx.fillRect(x - z * 1.5, y - z * 2.4, z * 3, z * 2.8); ctx.restore();
            ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, y - z * 0.92, z * 0.9, z * 0.6, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * z * 1.3, y - z * (1.05 + rng() * 0.3), z * 0.07, 0, Math.PI * 2); ctx.fill(); }
        } else if (kind === 'glowCrystals') {
            for (let i = 0; i < 7; i++) this.DECO.crystal(ctx, x + (i - 3) * z * 0.22, y, z * (0.6 + rng() * 0.6), c[i % c.length], rng);
        }
    },

    // ---------- Floating islands, asteroids ----------

    islands(ctx, rng, W, H, s, V) {
        const M = BACKDROP_MARGIN, style = s.style || 'grass';
        const list = [];
        for (let i = 0; i < s.n * (W / 1500 + 0.3); i++) list.push({ x: -M + rng() * (W + M * 2), y: H * (s.y[0] + rng() * (s.y[1] - s.y[0])), w: s.w[0] + rng() * (s.w[1] - s.w[0]) });
        list.sort((a, b) => a.y - b.y);
        const cols = s.cols || {};
        for (const { x, y, w } of list) {
            if (style === 'rock') {
                const pts = [], nv = 9;
                for (let k = 0; k < nv; k++) { const a = k / nv * Math.PI * 2, rr = w * (0.38 + rng() * 0.18); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7]); }
                const g = ctx.createLinearGradient(x - w / 2, y - w / 2, x + w / 2, y + w / 2);
                g.addColorStop(0, cols.a || '#6a5a7a'); g.addColorStop(1, cols.b || '#2a2236');
                ctx.fillStyle = g; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * w * 0.4, y + (rng() - 0.5) * w * 0.25, w * (0.04 + rng() * 0.05), 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(x - w * 0.12, y - w * 0.14, w * 0.2, w * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
                continue;
            }
            const depth = w * (0.55 + rng() * 0.45);
            const rg = ctx.createLinearGradient(0, y, 0, y + depth);
            rg.addColorStop(0, cols.rockTop || '#9a8670'); rg.addColorStop(1, cols.rockBot || 'rgba(95,75,62,0.35)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.moveTo(x - w / 2, y);
            const segs = 7;
            for (let k = 0; k <= segs; k++) ctx.lineTo(x - w / 2 + k * w / segs, y + (k % 2 ? 0.5 : 0.28) * depth * (1 - Math.abs(k - segs / 2) / (segs / 2 + 0.6)) + (rng() - 0.5) * 4);
            ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
            if (style === 'crystal') {
                ctx.fillStyle = cols.top || '#5a2a9c';
                ctx.beginPath(); ctx.ellipse(x, y, w / 2, w * 0.07, 0, 0, Math.PI * 2); ctx.fill();
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                const gl = ctx.createRadialGradient(x, y + depth * 0.5, 2, x, y + depth * 0.5, w * 0.9);
                gl.addColorStop(0, `rgba(${cols.glow || '180,100,255'},0.2)`); gl.addColorStop(1, `rgba(${cols.glow || '180,100,255'},0)`);
                ctx.fillStyle = gl; ctx.fillRect(x - w, y - w * 0.3, w * 2, w * 2);
                ctx.restore();
                const cc = cols.crystals || ['#c88bff', '#a96bff', '#e3a6ff'];
                for (let k = 0; k < 3; k++) this.DECO.crystal(ctx, x + (k - 1) * w * 0.28, y, w * (0.3 + rng() * 0.25), cc[k % cc.length], rng);
            } else if (style === 'silhouette') {
                ctx.fillStyle = cols.top || '#2a1740';
                ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(4, w * 0.09), 0, 0, Math.PI * 2); ctx.fill();
                const trees = Math.round(w / 60);
                for (let k = 0; k < trees; k++) this.DECO.pine(ctx, x + (rng() - 0.5) * w * 0.7, y - 1, 14 + w * 0.12 + rng() * 6, cols.top || '#2a1740');
            } else {
                ctx.fillStyle = cols.top || '#7cb85c';
                ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(4, w * 0.09), 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = cols.top2 || '#9ad06f';
                ctx.beginPath(); ctx.ellipse(x - w * 0.08, y - 1, w * 0.36, Math.max(2, w * 0.05), 0, 0, Math.PI * 2); ctx.fill();
                const trees = Math.round(w / 55);
                for (let k = 0; k < trees; k++) this.DECO.round(ctx, x + (rng() - 0.5) * w * 0.7, y - 1, 12 + w * 0.1 + rng() * 6, cols.tree || '#4e8c3a');
                if (s.fall && rng() < 0.7) {
                    const wx = x + (rng() - 0.5) * w * 0.5;
                    const wg = ctx.createLinearGradient(0, y, 0, y + 190);
                    wg.addColorStop(0, 'rgba(255,255,255,0.85)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = wg; ctx.fillRect(wx - 3, y + depth * 0.25, 6, 190);
                }
            }
        }
        if (s.fog) this.fog(ctx, W, H * s.y[0], H * s.y[1] + 200, s.fog);
    },

    // ---------- The strip of ground just behind the fighters ----------

    ground(ctx, rng, W, H, V) {
        const M = BACKDROP_MARGIN, G = V.ground, top = H * 0.935;
        const edge = [];
        for (let x = -M; x <= W + M; x += 8) edge.push([x, top + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.07) * 3 + (rng() - 0.5) * 3]);
        const g = ctx.createLinearGradient(0, top - 10, 0, H + M);
        g.addColorStop(0, G.top); g.addColorStop(1, G.bot);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-M, H + M);
        for (const [x, y] of edge) ctx.lineTo(x, y);
        ctx.lineTo(W + M, H + M); ctx.closePath(); ctx.fill();
        const pick = (arr) => BG.pick(arr, rng);
        const spots = (per, fn) => { const n = Math.round(W / per); for (let i = 0; i < n; i++) fn(-M + rng() * (W + M * 2), top - 4 + rng() * 14, i); };
        const D = this.DECO;
        switch (G.tufts) {
            case 'grass': case 'leaves':
                for (const [x, y] of edge) for (let k = 0; k < 3; k++) {
                    ctx.strokeStyle = pick(G.c || ['#2f7d32', '#43a047', '#1d5a22']);
                    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
                    const hh = 8 + rng() * 20, lean = (rng() - 0.5) * 10;
                    ctx.beginPath(); ctx.moveTo(x + k * 2, y + 3); ctx.quadraticCurveTo(x + k * 2 + lean * 0.4, y - hh * 0.5, x + k * 2 + lean, y - hh); ctx.stroke();
                }
                if (G.tufts === 'leaves') spots(26, (x, y) => { ctx.fillStyle = pick(G.litter || ['#d9541e', '#f29f1d', '#b5382a']); ctx.beginPath(); ctx.ellipse(x, y + 8 * rng(), 5 + rng() * 5, 2.2, rng() * 3, 0, Math.PI * 2); ctx.fill(); });
                else spots(40, (x, y, i) => {
                    ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x, y - 12); ctx.stroke();
                    ctx.fillStyle = ['#ffffff', '#fff176', '#f48fb1', '#ce93d8'][i % 4]; ctx.beginPath(); ctx.arc(x, y - 13, 3.4, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(x, y - 13, 1.2, 0, Math.PI * 2); ctx.fill();
                });
                break;
            case 'sand':
                ctx.strokeStyle = 'rgba(255,230,170,0.25)'; ctx.lineWidth = 1.2;
                spots(30, (x, y) => { ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.quadraticCurveTo(x + 14, y + 4, x + 30, y + 8); ctx.stroke(); });
                spots(90, (x, y) => D.rock(ctx, x, y + 6, 6 + rng() * 8, G.c || '#9a6a3a'));
                spots(260, (x, y) => D.cactus(ctx, x, y + 6, 22 + rng() * 14, '#3f7a3a'));
                break;
            case 'rocks': case 'moss': case 'lava':
                spots(70, (x, y) => D.rock(ctx, x, y + 6, 8 + rng() * 14, G.c || '#1d1b3e'));
                if (G.tufts === 'moss') spots(34, (x, y) => { ctx.fillStyle = 'rgba(90,160,90,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 10 + rng() * 14, 3, 0, Math.PI, 0); ctx.fill(); });
                if (G.tufts === 'lava' || G.glow) {
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,120,50,0.5)'; ctx.lineWidth = 1.5;
                    spots(110, (x, y) => { ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x + 8, y + 17); ctx.lineTo(x + 5, y + 23); ctx.lineTo(x + 14, y + 27); ctx.stroke(); });
                    ctx.restore();
                }
                break;
            case 'snow':
                spots(40, (x, y) => { ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 20 + rng() * 40, 6 + rng() * 8, 0, Math.PI, 0); ctx.fill(); });
                spots(170, (x, y) => D.snowPine(ctx, x, y + 6, 22 + rng() * 14, '#2b5a46'));
                break;
            case 'crystals':
                spots(90, (x, y) => D.crystal(ctx, x, y + 6, 14 + rng() * 22, pick(G.c || ['#6ad6ff', '#3fa7e0']), rng));
                break;
            case 'puffs':
                spots(22, (x, y) => D.puff(ctx, x, y + 8, 30 + rng() * 30, G.c || '#ffffff'));
                break;
            case 'mushrooms':
                spots(80, (x, y) => D.mushroom(ctx, x, y + 8, 16 + rng() * 22, G.c || ['#ff7ac8', '#4de8d0'], rng));
                break;
            case 'rubble':
                spots(60, (x, y) => D.rock(ctx, x, y + 8, 8 + rng() * 16, G.c || '#3a2f4a'));
                break;
        }
    },

    // ---------- Particles ----------

    spawnParts(bd, rng, V, b, f) {
        const W = bd.W, H = bd.H, xr = f * BG_PAN * W + 50 + W * BG_WIDE, bs = PART_SCALE[b];
        for (const spec of V.parts || []) {
            const n = spec.n[b] || 0;
            for (let i = 0; i < n; i++) {
                const p = { kind: spec.kind, b, rgb: spec.rgb, x: -xr + rng() * (W + 2 * xr), y: rng() * (H + 40) - 20, xr, ph: rng() * 6.28, bs, vx: 0 };
                switch (spec.kind) {
                    case 'mote': p.s = 1 + rng() * 2; p.vy = spec.rise || -0.08; break;
                    case 'firefly': p.s = 1.4 + rng() * 1.6; p.vy = (rng() - 0.5) * 0.1; p.y = H * (0.45 + rng() * 0.5); break;
                    case 'leaf': case 'petal': p.s = (spec.kind === 'petal' ? 2 : 3) + rng() * 3; p.vx = 0.1 + rng() * 0.3; p.vy = 0.25 + rng() * 0.4; p.rot = rng() * 6; p.vr = (rng() - 0.5) * 0.05; p.col = BG.pick(spec.cols, rng); break;
                    case 'snow': p.s = 1 + rng() * 2; p.vy = 0.25 + rng() * 0.6; break;
                    case 'ash': p.s = 1 + rng() * 1.6; p.vy = 0.15 + rng() * 0.4; p.vx = 0.1; break;
                    case 'ember': p.s = 1.2 + rng() * 2; p.vy = -(0.2 + rng() * 0.45); break;
                    case 'sparkle': p.s = 1.4 + rng() * 2.4; p.vy = -(0.05 + rng() * 0.18); break;
                    case 'dust': p.s = 1.4 + rng() * 2; p.vx = 0.4 + rng() * 0.7; p.vy = (rng() - 0.5) * 0.1; break;
                    case 'wisp': p.s = 30 + rng() * 60; p.vx = 0.3 + rng() * 0.7; p.vy = 0; p.y = H * (0.08 + rng() * 0.8); break;
                    case 'rain': p.s = 16 + rng() * 14; p.vx = -1.6; p.vy = 7 + rng() * 3; break;
                }
                bd.parts[b].push(p);
            }
        }
    },

    stepParts(bd, dt) {
        const W = bd.W, H = bd.H;
        for (const list of bd.parts) for (const p of list) {
            p.ph += 0.03 * dt;
            switch (p.kind) {
                case 'mote': case 'sparkle': p.x += Math.sin(p.ph) * 0.2 * dt; p.y += p.vy * dt; break;
                case 'firefly': p.x += Math.sin(p.ph * 0.8) * 0.35 * dt; p.y += (Math.cos(p.ph * 0.6) * 0.25 + p.vy) * dt; break;
                case 'leaf': case 'petal': p.x += (p.vx + Math.sin(p.ph * 1.3) * 0.5) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
                case 'snow': case 'ash': p.x += (Math.sin(p.ph * 0.7) * 0.35 + p.vx) * dt; p.y += p.vy * dt; break;
                case 'ember': p.x += Math.sin(p.ph * 1.5) * 0.25 * dt; p.y += p.vy * dt; break;
                case 'dust': case 'wisp': p.x += p.vx * dt; p.y += (p.vy || 0) * dt; break;
                case 'rain': p.x += p.vx * dt; p.y += p.vy * dt; break;
            }
            if (p.y > H + 24) { p.y = -20; p.x = -p.xr + Math.random() * (W + 2 * p.xr); }
            else if (p.y < -24) { p.y = H + 20; p.x = -p.xr + Math.random() * (W + 2 * p.xr); }
            if (p.x > W + p.xr) p.x = -p.xr;
            else if (p.x < -p.xr) p.x = W + p.xr;
        }
    },

    drawParts(ctx, bd, b) {
        const list = bd.parts[b], bs = PART_SCALE[b];
        if (!list.length) return;
        const t = bd.time;
        for (const p of list) {
            switch (p.kind) {
                case 'leaf': case 'petal':
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.fillStyle = p.col;
                    ctx.beginPath(); ctx.ellipse(0, 0, p.s * bs, p.s * bs * 0.45, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                    break;
                case 'wisp':
                    ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * bs; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x - p.s * bs, p.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore();
                    break;
                case 'rain':
                    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.2 * bs; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke(); ctx.restore();
                    break;
                case 'snow': case 'ash': {
                    const sz = p.s * 3.2 * bs;
                    ctx.globalAlpha = p.kind === 'ash' ? 0.6 : 0.85;
                    ctx.drawImage(Backdrop.dot(p.kind === 'ash' ? '150,140,140' : '255,255,255'), p.x - sz / 2, p.y - sz / 2, sz, sz);
                    ctx.globalAlpha = 1;
                    break;
                }
                case 'dust': {
                    const sz = p.s * 4 * bs;
                    ctx.globalAlpha = 0.35;
                    ctx.drawImage(Backdrop.dot(p.rgb || '230,200,150'), p.x - sz / 2, p.y - sz / 2, sz, sz);
                    ctx.globalAlpha = 1;
                    break;
                }
                default: {
                    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.ph * 3 + t * 0.02));
                    const sz = p.s * 4.5 * bs * (p.kind === 'sparkle' ? 0.7 + 0.5 * tw : 1);
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = Math.min(1, tw);
                    ctx.drawImage(Backdrop.dot(p.rgb || (p.kind === 'firefly' ? '220,255,120' : '255,255,220')), p.x - sz / 2, p.y - sz / 2, sz, sz);
                    ctx.globalAlpha = 1;
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
        }
    },

    // ---------- Live ambience per layer ----------

    anim(ctx, bd, layer) {
        switch (layer.tag) {
            case 'sky': return this.animSky(ctx, bd);
            case 'stars': return this.animStars(ctx, bd, layer);
            case 'clouds': return this.animClouds(ctx, bd, layer);
            case 'mist': return this.animMist(ctx, bd, layer);
            case 'mid': return this.animMid(ctx, bd, layer);
            case 'birds': return this.animBirds(ctx, bd);
            case 'parts': return this.drawParts(ctx, bd, layer.b);
        }
    },

    animStars(ctx, bd, layer) {
        const t = bd.time;
        ctx.fillStyle = '#ffffff';
        for (const s of layer.items) {
            ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.02 + s.ph));
            ctx.fillRect(s.x, s.y, s.s, s.s);
        }
        ctx.globalAlpha = 1;
    },

    animClouds(ctx, bd, layer) {
        ctx.globalAlpha = layer.a;
        for (const c of layer.items) ctx.drawImage(bd.cloudSprites[c.sp], c.x - 160 * c.s, c.y - 70 * c.s, 320 * c.s, 140 * c.s);
        ctx.globalAlpha = 1;
    },

    animMist(ctx, bd, layer) {
        const W = bd.W;
        for (const m of layer.items) {
            const x = ((m.x + bd.time * m.v) % (W + 600)) - 300;
            ctx.globalAlpha = layer.a;
            ctx.drawImage(layer.sprite, x - 280 * m.s, m.y - 60 * m.s, 560 * m.s, 120 * m.s);
        }
        ctx.globalAlpha = 1;
    },

    animMid(ctx, bd, layer) {
        if (!bd.windows.length) return;
        ctx.save();
        ctx.translate(-layer.mx, 0);   // windows are recorded in the layer's own (margin-shifted) space
        ctx.globalCompositeOperation = 'lighter';
        for (const w of bd.windows) {
            const fl = 0.45 + 0.35 * Math.sin(bd.time * 0.07 + w.ph) * Math.sin(bd.time * 0.031 + w.ph * 2);
            ctx.fillStyle = `rgba(255,180,80,${fl})`;
            ctx.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
        }
        ctx.restore();
    },

    animBirds(ctx, bd) {
        ctx.strokeStyle = 'rgba(40,40,60,0.7)';
        ctx.lineWidth = 1.5;
        for (const b of bd.birds) {
            const f = Math.sin(b.ph) * 4 * b.s;
            ctx.beginPath();
            ctx.moveTo(b.x - 7 * b.s, b.y - f);
            ctx.quadraticCurveTo(b.x - 3 * b.s, b.y - 2, b.x, b.y);
            ctx.quadraticCurveTo(b.x + 3 * b.s, b.y - 2, b.x + 7 * b.s, b.y - f);
            ctx.stroke();
        }
    },

    animSky(ctx, bd) {
        const t = bd.time, W = bd.W, H = bd.H, a = bd.V.ambient || {};
        ctx.save();
        if (a.rays && bd.V.body) {
            ctx.globalCompositeOperation = 'lighter';
            const sx = W * bd.V.body.x, sy = H * bd.V.body.y;
            for (let i = 0; i < 6; i++) {
                const ang = 0.9 + i * 0.32 + Math.sin(t * 0.004 + i) * 0.03;
                const len = H * 1.3;
                const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
                const al = 0.05 + 0.025 * Math.sin(t * 0.01 + i * 1.7);
                g.addColorStop(0, `rgba(${a.rayRgb || '255,245,210'},${al})`);
                g.addColorStop(1, `rgba(${a.rayRgb || '255,245,210'},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + Math.cos(ang - 0.06) * len, sy + Math.sin(ang - 0.06) * len);
                ctx.lineTo(sx + Math.cos(ang + 0.06) * len, sy + Math.sin(ang + 0.06) * len);
                ctx.closePath(); ctx.fill();
            }
        }
        if (a.aurora) {
            ctx.globalCompositeOperation = 'lighter';
            const bands = [['80,255,170', 0.16], ['80,190,255', 0.22], ['210,100,255', 0.12]];
            bands.forEach(([rgb, base], k) => {
                const y0 = H * base;
                const g = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 150);
                g.addColorStop(0, `rgba(${rgb},0)`);
                g.addColorStop(0.25, `rgba(${rgb},${0.28 + 0.08 * Math.sin(t * 0.015 + k)})`);
                g.addColorStop(1, `rgba(${rgb},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                const top = (x) => y0 + Math.sin(x * 0.004 + t * 0.005 + k * 2) * 40 + Math.sin(x * 0.011 - t * 0.009 + k) * 16;
                ctx.moveTo(-60, top(-60));
                for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, top(x));
                for (let x = W + 60; x >= -60; x -= 16) ctx.lineTo(x, top(x) + 150);
                ctx.closePath(); ctx.fill();
            });
        }
        if (a.runes) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(190,130,255,0.18)';
            ctx.lineWidth = 2;
            [[0.25, 0.35, 120], [0.8, 0.55, 90]].forEach(([fx, fy, r], k) => {
                const x = W * fx, y = H * fy, rot = t * 0.0015 * (k ? -1 : 1);
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    const ang = rot + i * Math.PI * 2 / 6 * 2;
                    const px = x + Math.cos(ang) * r * 0.75, py = y + Math.sin(ang) * r * 0.75;
                    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                }
                ctx.stroke();
                for (let i = 0; i < 16; i++) {
                    const ang = rot * 2 + i * Math.PI / 8;
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(ang) * r * 0.82, y + Math.sin(ang) * r * 0.82);
                    ctx.lineTo(x + Math.cos(ang) * r * 0.95, y + Math.sin(ang) * r * 0.95);
                    ctx.stroke();
                }
            });
        }
        if (bd.shoot) {
            ctx.globalCompositeOperation = 'lighter';
            const s = bd.shoot;
            const g = ctx.createLinearGradient(s.x - 90, s.y - 40, s.x, s.y);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(1, `rgba(255,255,255,${Math.min(1, s.life / 20)})`);
            ctx.strokeStyle = g; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(s.x - 90, s.y - 40); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
        if (bd.bolt && bd.bolt.life > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(235,240,255,${Math.min(1, bd.bolt.life / 6)})`;
            ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
            ctx.beginPath(); bd.bolt.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        }
        ctx.restore();
    },

    // ---------- Foreground: a few OPAQUE props in front of the fighters, at the edges ----------

    spr(w, h, fn) {
        const c = Backdrop.canvas(w, h);
        fn(c.getContext('2d'), w, h);
        return c;
    },

    // kind: what the prop is; c: palette. Tops hang from y=0 (<= ~56px), bottoms rise from y=h (<= ~46px).
    fgSprite(kind, c, rng) {
        const col = (i) => c[i % c.length];
        const D = this.DECO;
        switch (kind) {
            case 'leaves': return this.spr(240, 60, (ctx, w, h) => {
                ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(w * 0.5, 22, w, 8); ctx.stroke();
                for (let i = 0; i < 14; i++) {
                    const x = 8 + i * (w - 16) / 13, y = 6 + Math.sin(i / 13 * Math.PI) * 14, len = 26 + rng() * 18, a = (rng() - 0.5) * 1.2;
                    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
                    const g = ctx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, BG.mix(col(i), '#000000', 0.35)); g.addColorStop(1, col(i));
                    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.42, len * 0.5, 0, len); ctx.quadraticCurveTo(-len * 0.42, len * 0.5, 0, 0); ctx.fill();
                    ctx.restore();
                }
            });
            case 'vines': case 'glowVines': return this.spr(240, 64, (ctx, w, h) => {
                for (let i = 0; i < 9; i++) {
                    const x = 10 + i * (w - 20) / 8, len = 24 + rng() * 34;
                    ctx.strokeStyle = BG.mix(col(i), '#000000', 0.3); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, len * 0.3, x - 8, len * 0.7, x + 3, len); ctx.stroke();
                    for (let k = 1; k < 4; k++) { ctx.fillStyle = col(i + k); ctx.beginPath(); ctx.ellipse(x + (k % 2 ? 5 : -5), len * k / 4, 6, 3, 0.6, 0, Math.PI * 2); ctx.fill(); }
                    if (kind === 'glowVines') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col(i + 1); ctx.beginPath(); ctx.arc(x + 3, len, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
                }
            });
            case 'branches': return this.spr(240, 60, (ctx, w, h) => {
                ctx.strokeStyle = c[0]; ctx.lineCap = 'round';
                const br = (x, y, a, len, wd, d) => {
                    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
                    ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
                    if (d > 0) { br(ex, ey, a - 0.5 - rng() * 0.5, len * 0.72, wd * 0.66, d - 1); br(ex, ey, a + 0.45 + rng() * 0.5, len * 0.68, wd * 0.66, d - 1); }
                };
                br(w * 0.2, -4, 1.2, 34, 7, 3); br(w * 0.55, -4, 1.7, 30, 6, 3); br(w * 0.85, -4, 1.4, 28, 5, 3);
            });
            case 'icicles': return this.spr(240, 58, (ctx, w, h) => {
                ctx.fillStyle = c[0]; ctx.fillRect(0, 0, w, 6);
                for (let i = 0; i < 16; i++) {
                    const x = i * w / 16 + rng() * 6, len = 18 + rng() * 38, bw = 6 + rng() * 6;
                    const g = ctx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
                    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - bw, 4); ctx.lineTo(x, len); ctx.lineTo(x + bw, 4); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(x - bw, 4); ctx.lineTo(x - 1, len * 0.9); ctx.lineTo(x - 1, 4); ctx.closePath(); ctx.fill();
                }
            });
            case 'stalactites': return this.spr(240, 60, (ctx, w, h) => {
                ctx.fillStyle = c[0]; ctx.fillRect(0, 0, w, 8);
                for (let i = 0; i < 11; i++) D.stalactite(ctx, 10 + i * (w - 20) / 10 + rng() * 8, 4, 22 + rng() * 34, c[0]);
            });
            case 'snowBranch': return this.spr(240, 56, (ctx, w, h) => {
                ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(w * 0.5, 16, w, 6); ctx.stroke();
                for (let i = 0; i < 15; i++) {
                    const x = 6 + i * (w - 12) / 14, y = 6 + Math.sin(i / 14 * Math.PI) * 9, len = 18 + rng() * 18;
                    ctx.strokeStyle = c[0]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 8, y + len); ctx.stroke();
                    ctx.fillStyle = '#f4f9ff'; ctx.beginPath(); ctx.ellipse(x, y + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
                }
            });
            case 'crystals': return this.spr(240, 58, (ctx, w, h) => {
                for (let i = 0; i < 9; i++) D.hangCrystal(ctx, 12 + i * (w - 24) / 8, 0, 22 + rng() * 30, col(i), rng);
            });
            case 'puffs': return this.spr(260, 60, (ctx, w, h) => {
                ctx.fillStyle = col(0); ctx.fillRect(0, 0, w, 14);
                for (let i = 0; i < 9; i++) D.puff(ctx, 20 + i * (w - 40) / 8, 18 + (i % 2) * 8, 30 + rng() * 14, col(i));
            });
            // ---- bottoms ----
            case 'grass': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 36; i++) {
                    const x = rng() * w, hh = 18 + rng() * 26, lean = (rng() - 0.5) * 16;
                    ctx.fillStyle = col(i); ctx.beginPath(); ctx.moveTo(x - 3.5, h); ctx.quadraticCurveTo(x + lean * 0.3, h - hh * 0.55, x + lean, h - hh); ctx.quadraticCurveTo(x + lean * 0.3 + 4, h - hh * 0.5, x + 3.5, h); ctx.fill();
                }
            });
            case 'rocks': case 'lava': case 'rubble': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 6; i++) D.rock(ctx, 14 + i * (w - 28) / 5 + rng() * 10, h + 2, 14 + rng() * 24, col(i));
                if (kind === 'lava') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,120,50,0.8)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = 20 + rng() * (w - 40); ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 6, h - 10); ctx.lineTo(x + 2, h - 18); ctx.stroke(); } ctx.restore(); }
            });
            case 'snow': return this.spr(240, 44, (ctx, w, h) => {
                for (let i = 0; i < 5; i++) { ctx.fillStyle = '#f4f9ff'; ctx.beginPath(); ctx.ellipse(20 + i * (w - 40) / 4, h + 4, 36 + rng() * 20, 14 + rng() * 10, 0, Math.PI, 0); ctx.fill(); }
                for (let i = 0; i < 7; i++) D.iceSpire(ctx, 10 + rng() * (w - 20), h, 10 + rng() * 22, c[1] || '#bfe2f7', rng);
            });
            case 'upCrystals': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 9; i++) D.crystal(ctx, 12 + i * (w - 24) / 8, h, 14 + rng() * 26, col(i), rng);
            });
            case 'cactus': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 3; i++) D.cactus(ctx, 30 + i * 90 + rng() * 20, h, 30 + rng() * 12, col(0));
                for (let i = 0; i < 4; i++) D.rock(ctx, 14 + rng() * (w - 28), h + 2, 8 + rng() * 10, col(1));
            });
            case 'mushrooms': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 7; i++) D.mushroom(ctx, 14 + i * (w - 28) / 6 + rng() * 6, h + 2, 18 + rng() * 22, c, rng);
            });
            case 'cloudPuffs': return this.spr(260, 46, (ctx, w, h) => {
                for (let i = 0; i < 8; i++) D.puff(ctx, 20 + i * (w - 40) / 7, h - 2, 26 + rng() * 14, col(i));
            });
            case 'leafLitter': return this.spr(240, 40, (ctx, w, h) => {
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.ellipse(w / 2, h + 8, w * 0.52, 22, 0, Math.PI, 0); ctx.fill();
                for (let i = 0; i < 40; i++) { ctx.fillStyle = col(i + 1); ctx.beginPath(); ctx.ellipse(rng() * w, h - rng() * 24, 6 + rng() * 5, 2.4, rng() * 3, 0, Math.PI * 2); ctx.fill(); }
            });
        }
        return this.spr(2, 2, () => {});
    },

    foreground(bd, rng, V) {
        const W = bd.W, H = bd.H, sc = Math.max(0.8, Math.min(1.25, H / 760));
        bd.fg = [];
        const F = V.fg || {};
        const make = (spec, anchor) => {
            if (!spec) return;
            const sprites = [0, 1, 2].map(() => this.fgSprite(spec.k, spec.c, rng));
            let x = -0.3 * W;
            while (x < W * 1.3) {
                const spr = sprites[Math.floor(rng() * sprites.length)], s = sc * (0.85 + rng() * 0.25);
                bd.fg.push({ spr, x, s, flip: rng() < 0.5, anchor });
                x += spr.width * s * (0.7 + rng() * 0.2);
            }
        };
        make(F.top, 'top');
        make(F.bottom, 'bottom');
    },

    drawFront(ctx, bd, cam, sh) {
        const W = bd.W, H = bd.H, f = BG_FRONT_F;
        if (bd.fg.length) {
            const zoom = cam ? cam.zoom : 1, cx = cam ? cam.x : W / 2, cy = cam ? cam.y : H / 2;
            ctx.save();
            ctx.translate(W / 2 + sh.x * f, H / 2 + sh.y * f);
            const z = 1 + (zoom - 1) * f;
            ctx.scale(z, z);
            ctx.translate(-(W / 2 + (cx - W / 2) * f), -(H / 2 + (cy - H / 2) * f));
            const overTop = 22, overBottom = 12;   // props reach past the screen edge so a camera shift never opens a gap
            for (const p of bd.fg) {
                const w = p.spr.width * p.s, h = p.spr.height * p.s;
                ctx.save();
                ctx.translate(p.x + (p.flip ? w : 0), p.anchor === 'top' ? -overTop : H + overBottom - h);
                if (p.flip) ctx.scale(-1, 1);
                ctx.drawImage(p.spr, 0, 0, w, h);
                ctx.restore();
            }
            ctx.restore();
        }
        if (bd.flash > 0.01) { ctx.fillStyle = `rgba(215,225,255,${bd.flash * 0.2})`; ctx.fillRect(0, 0, W, H); }
    }
};
