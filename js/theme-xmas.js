// The Christmas theme ('xmas'): snowy gingerbread platforms with icing and strings of LED bulbs
// that twinkle under every ledge, three backdrops (a lit-up village, decorated pine woods, the
// workshop at the North Pole) full of cozy cottages, decorated trees, presents, lamp posts and
// snowmen, a snow-drift void, its own colour grade, and the dust and rim light of fresh snow.
// It is only offered from mid-November to the end of December (seasons.js).
(() => {
    const L = BackdropLayers, D = L.DECO;
    const BULBS = ['255,70,70', '255,210,80', '90,220,120', '80,170,255', '255,140,220'];

    Object.assign(DUST_TINT, { xmas: '240,248,255' });
    RIM_LIGHT.xmas = ['255,214,150', -1, -1.2, 0.4];

    // ---------- small helpers ----------
    const glow = (ctx, x, y, r, rgb, a) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
    };
    // a sagging string of bulbs from (x0,y0) to (x1,y1); twinkle t (0 = static paint)
    const lightString = (ctx, x0, y0, x1, y1, sag, n, t, seed, scale) => {
        const s = scale || 1;
        ctx.strokeStyle = 'rgba(20,30,20,0.85)'; ctx.lineWidth = 1 * s;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); ctx.stroke();
        for (let i = 1; i < n; i++) {
            const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + 4 * sag * u * (1 - u);
            const rgb = BULBS[(i + seed) % BULBS.length];
            const on = t ? 0.55 + 0.45 * Math.sin(t * 0.09 + i * 1.7 + seed) : 0.9;
            ctx.fillStyle = `rgba(${rgb},${0.5 + on * 0.5})`;
            ctx.beginPath(); ctx.ellipse(x, y + 2.2 * s, 1.6 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill();
            glow(ctx, x, y + 2.2 * s, 7 * s, rgb, 0.55 * on);
        }
    };
    L.xmasLights = lightString;

    // ---------- scenery pieces ----------
    Object.assign(D, {
        xmasTree(ctx, x, y, h, c, rng) {
            const w = h * 0.42;
            ctx.fillStyle = '#3e2723'; ctx.fillRect(x - h * 0.04, y - h * 0.12, h * 0.08, h * 0.14);
            for (let k = 0; k < 4; k++) {
                const ty = y - h * 0.1 - k * h * 0.22, tw = w * (1 - k * 0.2);
                ctx.fillStyle = k % 2 ? BG.mix(c, '#ffffff', 0.08) : c;
                ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - h * 0.36); ctx.lineTo(x + tw, ty); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.quadraticCurveTo(x, ty - h * 0.06, x + tw, ty); ctx.quadraticCurveTo(x, ty - h * 0.02, x - tw, ty); ctx.fill();
            }
            // ornaments and a garland of light
            for (let i = 0; i < 9; i++) {
                const u = rng(), ty = y - h * (0.15 + u * 0.7), half = w * (1 - u * 0.85) * 0.8;
                const ox = x + (rng() - 0.5) * 2 * half, rgb = BULBS[i % BULBS.length];
                ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.arc(ox, ty, Math.max(1.2, h * 0.025), 0, Math.PI * 2); ctx.fill();
                glow(ctx, ox, ty, h * 0.07, rgb, 0.4);
            }
            // star on top
            const sy = y - h * 0.1 - 3 * h * 0.22 - h * 0.36;
            glow(ctx, x, sy, h * 0.22, '255,230,120', 0.7);
            ctx.fillStyle = '#ffe082'; ctx.beginPath();
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.4 : 1) * h * 0.06; ctx.lineTo(x + Math.cos(a) * r, sy + Math.sin(a) * r); }
            ctx.closePath(); ctx.fill();
        },
        cottage(ctx, x, y, h, c, rng) {
            const w = h * (0.8 + rng() * 0.4), wall = BG.pick(['#7a3b2e', '#8d5b3a', '#5d4037', '#a1593b', '#4e5d73'], rng);
            const roofH = h * 0.45, wallH = h * 0.55;
            // chimney
            ctx.fillStyle = '#4a2c22'; ctx.fillRect(x + w * 0.18, y - wallH - roofH * 0.95, w * 0.12, roofH * 0.7);
            ctx.fillStyle = '#fafafa'; ctx.fillRect(x + w * 0.16, y - wallH - roofH * 0.98, w * 0.16, 3);
            // walls and door
            ctx.fillStyle = wall; ctx.fillRect(x - w / 2, y - wallH, w, wallH + 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let yy = y - wallH + 4; yy < y; yy += 5) ctx.fillRect(x - w / 2, yy, w, 0.8);
            ctx.fillStyle = '#3e2016'; ctx.fillRect(x - w * 0.08, y - wallH * 0.55, w * 0.16, wallH * 0.55);
            ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(x, y - wallH * 0.42, w * 0.06, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e53935'; ctx.fillRect(x - 1, y - wallH * 0.36, 2, 3);
            // windows: warm and lit
            for (const wx of [-0.3, 0.3]) {
                const cx = x + wx * w, cy = y - wallH * 0.55;
                glow(ctx, cx, cy, w * 0.3, '255,190,100', 0.5);
                ctx.fillStyle = '#ffd27a'; ctx.fillRect(cx - w * 0.09, cy - w * 0.08, w * 0.18, w * 0.16);
                ctx.fillStyle = 'rgba(90,40,10,0.8)'; ctx.fillRect(cx - 0.6, cy - w * 0.08, 1.2, w * 0.16); ctx.fillRect(cx - w * 0.09, cy - 0.6, w * 0.18, 1.2);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - w * 0.11, cy + w * 0.08, w * 0.22, 2);
            }
            // roof under thick snow
            ctx.fillStyle = '#5a2a22'; ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - wallH); ctx.lineTo(x, y - wallH - roofH); ctx.lineTo(x + w * 0.62, y - wallH); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.moveTo(x - w * 0.66, y - wallH + 2); ctx.lineTo(x, y - wallH - roofH - 3); ctx.lineTo(x + w * 0.66, y - wallH + 2);
            for (let k = 6; k >= 0; k--) ctx.lineTo(x - w * 0.66 + w * 1.32 * k / 6, y - wallH + 2 + (k % 2 ? 4 : 1)); ctx.closePath(); ctx.fill();
            // lights along the eaves
            lightString(ctx, x - w * 0.6, y - wallH + 1, x, y - wallH - roofH + 2, 2, 5, 0, Math.floor(rng() * 5), Math.max(0.6, h / 60));
            lightString(ctx, x, y - wallH - roofH + 2, x + w * 0.6, y - wallH + 1, 2, 5, 0, Math.floor(rng() * 5), Math.max(0.6, h / 60));
            return { w, chimX: x + w * 0.24, chimY: y - wallH - roofH * 0.98, wins: [-0.3, 0.3].map(wx => ({ x: x + wx * w - w * 0.09, y: y - wallH * 0.55 - w * 0.08, w: w * 0.18, h: w * 0.16 })) };
        },
        present(ctx, x, y, h, c, rng) {
            let yy = y;
            for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) {
                const w = h * (0.7 - k * 0.15), hh = h * (0.5 - k * 0.1), col = BG.pick(['#d32f2f', '#1976d2', '#388e3c', '#fbc02d', '#7b1fa2', '#f5f5f5'], rng);
                const xo = x + (rng() - 0.5) * h * 0.2;
                ctx.fillStyle = col; ctx.fillRect(xo - w / 2, yy - hh, w, hh);
                ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(xo + w * 0.2, yy - hh, w * 0.3, hh);
                const rib = col === '#fbc02d' || col === '#f5f5f5' ? '#c62828' : '#ffe082';
                ctx.fillStyle = rib; ctx.fillRect(xo - w * 0.06, yy - hh, w * 0.12, hh); ctx.fillRect(xo - w / 2, yy - hh * 0.58, w, hh * 0.14);
                ctx.beginPath(); ctx.ellipse(xo - w * 0.12, yy - hh - 2, w * 0.12, w * 0.07, -0.5, 0, Math.PI * 2); ctx.ellipse(xo + w * 0.12, yy - hh - 2, w * 0.12, w * 0.07, 0.5, 0, Math.PI * 2); ctx.fill();
                yy -= hh;
            }
        },
        lampPost(ctx, x, y, h, c) {
            ctx.fillStyle = '#20262e'; ctx.fillRect(x - 1.2, y - h, 2.4, h);
            ctx.fillRect(x - 4, y - h - 2, 8, 3);
            ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x - 3, y - h - 9, 6, 7);
            glow(ctx, x, y - h - 5, h * 0.6, '255,210,120', 0.6);
            ctx.fillStyle = '#fafafa'; ctx.fillRect(x - 5, y - h - 11, 10, 2.5);
            // a candy-cane stripe and a wreath
            ctx.fillStyle = '#c62828'; for (let k = 0; k < h * 0.8; k += 6) ctx.fillRect(x - 1.2, y - k - 3, 2.4, 2);
            ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - h * 0.55, 3.5, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#e53935'; ctx.fillRect(x - 1, y - h * 0.55 + 2, 2, 2.5);
        },
        snowman(ctx, x, y, h) {
            ctx.fillStyle = '#f7fbff';
            for (const [dy, r] of [[0.2, 0.22], [0.52, 0.16], [0.78, 0.11]]) { ctx.beginPath(); ctx.arc(x, y - h * dy, h * r, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = 'rgba(150,180,210,0.35)'; ctx.beginPath(); ctx.arc(x + h * 0.05, y - h * 0.18, h * 0.2, 0, Math.PI); ctx.fill();
            ctx.fillStyle = '#212121'; ctx.fillRect(x - h * 0.12, y - h * 0.96, h * 0.24, h * 0.04); ctx.fillRect(x - h * 0.08, y - h * 1.12, h * 0.16, h * 0.17);
            ctx.fillRect(x - h * 0.05, y - h * 0.8, 1.6, 1.6); ctx.fillRect(x + h * 0.03, y - h * 0.8, 1.6, 1.6);
            ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(x, y - h * 0.76); ctx.lineTo(x + h * 0.14, y - h * 0.74); ctx.lineTo(x, y - h * 0.72); ctx.fill();
            ctx.fillStyle = '#c62828'; ctx.fillRect(x - h * 0.12, y - h * 0.66, h * 0.24, h * 0.05); ctx.fillRect(x + h * 0.06, y - h * 0.66, h * 0.05, h * 0.16);
            ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - h * 0.15, y - h * 0.52); ctx.lineTo(x - h * 0.34, y - h * 0.66); ctx.moveTo(x + h * 0.15, y - h * 0.52); ctx.lineTo(x + h * 0.33, y - h * 0.62); ctx.stroke();
        },
        candyPole(ctx, x, y, h) {
            ctx.fillStyle = '#fafafa'; ctx.fillRect(x - h * 0.04, y - h, h * 0.08, h);
            ctx.fillStyle = '#d32f2f'; for (let k = 0; k < h; k += h * 0.12) { ctx.beginPath(); ctx.moveTo(x - h * 0.04, y - k); ctx.lineTo(x + h * 0.04, y - k - h * 0.05); ctx.lineTo(x + h * 0.04, y - k - h * 0.09); ctx.lineTo(x - h * 0.04, y - k - h * 0.04); ctx.fill(); }
            ctx.fillStyle = '#ffe082'; ctx.beginPath(); ctx.arc(x, y - h - 3, h * 0.06, 0, Math.PI * 2); ctx.fill();
        }
    });

    // ---------- a street of cozy cottages (mid layer): lit windows flicker, chimneys smoke ----------
    BackdropScenery.village = function (ctx, W, H, rng, bd) {
        const base = H * 0.87;
        bd.chimneys = [];
        let x = 20 + rng() * 40, prev = null;
        while (x < W - 10) {
            const h = 70 + rng() * 50;
            const g = D.cottage(ctx, x, base, h, null, rng);
            bd.chimneys.push([g.chimX, g.chimY]);
            for (const w of g.wins) bd.windows.push({ x: w.x, y: w.y, w: w.w, h: w.h, ph: rng() * 6, rgb: '255,190,100' });
            if (prev) lightString(ctx, prev[0], prev[1], x - g.w * 0.62, base - h * 0.5, 10, 8, 0, Math.floor(rng() * 5), 1.2);
            const gap = 40 + rng() * 90;
            if (rng() < 0.7) D.xmasTree(ctx, x + g.w * 0.62 + gap * 0.5, base + 2, 40 + rng() * 30, '#1f5a3a', rng);
            if (rng() < 0.5) D.lampPost(ctx, x + g.w * 0.62 + gap * 0.2, base + 2, 40);
            for (let k = 0; k < 2; k++) D.present(ctx, x + g.w * 0.62 + gap * (0.3 + rng() * 0.5), base + 2, 10 + rng() * 6, null, rng);
            prev = [x + g.w * 0.62, base - h * 0.5];
            x += g.w * 1.25 + gap;
        }
        // snow drifts in front of the houses
        ctx.fillStyle = '#eef4fb';
        ctx.beginPath(); ctx.moveTo(0, H + 50); for (let xx = 0; xx <= W; xx += 20) ctx.lineTo(xx, base + 4 + Math.sin(xx * 0.03) * 4); ctx.lineTo(W, H + 50); ctx.fill();
    };

    // ---------- landmarks ----------
    const landmarkBase = L.landmark;
    L.landmark = function (ctx, rng, W, H, s, Mx) {
        const x = Mx + (W - 2 * Mx) * s.x, y = H * s.y, z = s.size;
        switch (s.kind) {
            case 'bigTree':
                glow(ctx, x, y - z, z * 1.6, '255,200,120', 0.25);
                D.xmasTree(ctx, x, y, z * 2, '#1f5a3a', rng);
                for (let i = 0; i < 7; i++) D.present(ctx, x + (i - 3) * z * 0.18, y + 2, z * 0.26, null, rng);
                return;
            case 'workshop': {
                const w = z * 1.8, wh = z * 0.8;
                ctx.fillStyle = '#6d2a22'; ctx.fillRect(x - w / 2, y - wh, w, wh + 2);
                ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let yy = y - wh + 6; yy < y; yy += 7) ctx.fillRect(x - w / 2, yy, w, 1);
                ctx.fillStyle = '#3a1612'; ctx.beginPath(); ctx.moveTo(x - w * 0.58, y - wh); ctx.lineTo(x, y - wh - z * 0.6); ctx.lineTo(x + w * 0.58, y - wh); ctx.fill();
                ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - wh + 3); ctx.lineTo(x, y - wh - z * 0.64); ctx.lineTo(x + w * 0.62, y - wh + 3); ctx.lineTo(x, y - wh - z * 0.5); ctx.closePath(); ctx.fill();
                for (let i = 0; i < 5; i++) { const wx = x - w * 0.38 + i * w * 0.19; glow(ctx, wx, y - wh * 0.55, z * 0.25, '255,190,90', 0.45); ctx.fillStyle = '#ffd27a'; ctx.fillRect(wx - z * 0.06, y - wh * 0.7, z * 0.12, z * 0.16); }
                ctx.fillStyle = '#2e1410'; ctx.fillRect(x - z * 0.14, y - wh * 0.5, z * 0.28, wh * 0.5);
                lightString(ctx, x - w * 0.58, y - wh + 2, x, y - wh - z * 0.6, 3, 9, 0, 1, z / 60);
                lightString(ctx, x, y - wh - z * 0.6, x + w * 0.58, y - wh + 2, 3, 9, 0, 3, z / 60);
                D.candyPole(ctx, x + w * 0.62, y, z * 0.9);
                ctx.fillStyle = '#fafafa'; ctx.font = `bold ${Math.round(z * 0.12)}px sans-serif`; ctx.textAlign = 'center';
                ctx.fillStyle = '#ffe082'; ctx.fillRect(x - z * 0.45, y - wh - z * 0.08, z * 0.9, z * 0.13);
                ctx.fillStyle = '#6d2a22'; ctx.fillText('NORTH POLE', x, y - wh + z * 0.02);
                return;
            }
        }
        landmarkBase.call(this, ctx, rng, W, H, s, Mx);
    };

    // ---------- ground strip ----------
    const groundBase = L.ground;
    L.ground = function (ctx, rng, W, H, V) {
        groundBase.call(this, ctx, rng, W, H, V);
        if (V.ground.tufts !== 'xmas') return;
        const M = BACKDROP_MARGIN, top = H * 0.935;
        const spots = (per, fn) => { const n = Math.round(W / per); for (let i = 0; i < n; i++) fn(-M + rng() * (W + M * 2), top - 4 + rng() * 14, i); };
        spots(34, (x, y) => { ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 20 + rng() * 40, 6 + rng() * 8, 0, Math.PI, 0); ctx.fill(); });
        spots(140, (x, y) => D.xmasTree(ctx, x, y + 6, 30 + rng() * 18, '#1f5a3a', rng));
        spots(90, (x, y) => D.present(ctx, x, y + 8, 12 + rng() * 6, null, rng));
        spots(260, (x, y) => D.lampPost(ctx, x, y + 8, 34 + rng() * 8));
        spots(320, (x, y) => D.snowman(ctx, x, y + 8, 26 + rng() * 8));
    };

    // ---------- foreground props ----------
    const fgBase = L.fgSprite;
    L.fgSprite = function (kind, c, rng) {
        switch (kind) {
            case 'garland': return this.spr(260, 60, (ctx, w) => {
                ctx.strokeStyle = '#1b4d2e'; ctx.lineWidth = 7; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(w / 2, 50, w, 4); ctx.stroke();
                ctx.strokeStyle = '#2e7d4a'; ctx.lineWidth = 3; ctx.stroke();
                for (let i = 1; i < 12; i++) { const u = i / 12, x = u * w, y = 4 + 4 * 23 * u * (1 - u); ctx.fillStyle = `rgb(${BULBS[i % 5]})`; ctx.beginPath(); ctx.arc(x, y + 4, 3, 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.ellipse(w / 2 - 8, 30, 8, 5, -0.4, 0, Math.PI * 2); ctx.ellipse(w / 2 + 8, 30, 8, 5, 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(w / 2 - 3, 30, 6, 16);
            });
            case 'presentsFg': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 5; i++) D.present(ctx, 20 + i * 48 + rng() * 10, h + 2, 30 + rng() * 10, null, rng);
                D.snowman(ctx, w * (0.3 + rng() * 0.4), h + 2, 44);
            });
        }
        return fgBase.call(this, kind, c, rng);
    };

    // ---------- platforms: gingerbread planks, icing, snow cap and LED strings ----------
    const tex = () => {
        const [c, ctx] = Graphics.makeTile(128);
        const r = Graphics.rng(91), S = 128;
        ctx.fillStyle = '#9a5b2e'; ctx.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 32) {
            const g = ctx.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, '#b06a36'); g.addColorStop(1, '#7c4522');
            ctx.fillStyle = g; ctx.fillRect(0, y + 1, S, 30);
            ctx.strokeStyle = '#fff6ea'; ctx.lineWidth = 2;
            ctx.beginPath(); for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + 6 + ((x / 8) % 2) * 4); ctx.stroke();
            for (let x = ((y / 32) % 2) * 32 + 16; x < S; x += 64) { ctx.fillStyle = 'rgba(60,30,10,0.4)'; ctx.fillRect(x, y + 1, 2, 30); ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(x - 10, y + 20, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x + 12, y + 20, 2.4, 0, Math.PI * 2); ctx.fill(); }
        }
        for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(60,30,10,${r() * 0.25})`; ctx.fillRect(r() * S, r() * S, 1.5, 1.5); }
        return ctx.createPattern(c, 'repeat');
    };
    const initBase = Graphics.init;
    Graphics.init = function () { initBase.call(this); this.textures.xmas = tex(); };
    if (Graphics.textures && Graphics.textures.dirt) Graphics.textures.xmas = tex();
    const patBase = Level.prototype.getMaterialPattern;
    Level.prototype.getMaterialPattern = function () {
        if (this.material === 'xmas') { if (!Graphics.textures.xmas) Graphics.textures.xmas = tex(); return Graphics.textures.xmas; }
        return patBase.call(this);
    };
    Level.FINISH.xmas = function (ctx, p, w, h, t) {
        // snow cap with icicles
        ctx.fillStyle = '#f7fbff';
        ctx.beginPath(); ctx.moveTo(-2, 3); ctx.quadraticCurveTo(w * 0.25, -7, w * 0.5, -3); ctx.quadraticCurveTo(w * 0.75, -8, w + 2, 3); ctx.lineTo(w + 2, 5); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(170,200,230,0.5)'; ctx.fillRect(0, 3, w, 2);
        ctx.fillStyle = 'rgba(225,245,255,0.9)';
        for (let x = (p.seed % 13) + 5; x < w - 4; x += 15 + (p.seed % 7)) { const len = 4 + ((x * 7 + p.seed) % 9); ctx.beginPath(); ctx.moveTo(x - 2, h); ctx.lineTo(x, h + len); ctx.lineTo(x + 2, h); ctx.fill(); }
        // a string of bulbs looping under the ledge, twinkling
        if (w > 40) {
            const loops = Math.max(1, Math.round(w / 90));
            for (let k = 0; k < loops; k++) {
                const x0 = 4 + (w - 8) * k / loops, x1 = 4 + (w - 8) * (k + 1) / loops;
                lightString(ctx, x0, h - 1, x1, h - 1, 5, 6, t + 1, k + Math.floor(p.seed), 1);
            }
        }
    };

    // ---------- the void: a deep snow drift ----------
    const platBase = Level.prototype.drawPlatforms;
    Level.prototype.drawPlatforms = function (ctx) {
        if (this.material === 'xmas') {
            const H = this.height, t = this.time;
            ctx.save();
            ctx.fillStyle = 'rgba(235,245,255,0.8)'; ctx.fillRect(-3000, H + 14, this.width + 6000, 3000);
            for (let i = 0; i < 60; i++) {
                const x = ((i * 61 + t * 0.2) % 2400) - 400, r = 30 + (i % 5) * 10;
                const g = ctx.createRadialGradient(x, H + 6, 0, x, H + 6, r);
                g.addColorStop(0, 'rgba(250,252,255,0.85)'); g.addColorStop(1, 'rgba(250,252,255,0)');
                ctx.fillStyle = g; ctx.fillRect(x - r, H + 6 - r, r * 2, r * 2);
            }
            ctx.restore();
        }
        platBase.call(this, ctx);
    };

    // ---------- colour grade ----------
    PostFX.P.xmas = { bloom: 0.4, th: 0.6, grade: ['255,200,140', 0.12, '30,50,110', 0.16], vignette: ['10,20,50', 0.5], grain: 0.025 };
    PostFX.P.xmasNight = { bloom: 0.42, th: 0.62, grade: ['255,190,120', 0.1, '20,30,90', 0.2], vignette: ['5,8,30', 0.6], grain: 0.03, frost: 0.18 };

    // ---------- the three backdrops ----------
    const C = (shade, hi, lo) => ({ shade, hi, lo });
    BG_VARIANTS.xmas = [
        {
            name: 'Christmas Village',
            sky: [[0, '#081232'], [0.5, '#16306a'], [0.85, '#3b5fa0'], [1, '#7a9ccc']],
            body: { kind: 'moon', x: 0.78, y: 0.2, r: 34, rgb: '255,250,230' }, haze: '170,200,240', stars: 220,
            cloudTint: C('40,60,110', '230,240,255', '150,170,210'),
            ridges: { n: 9, base: [0.56, 0.86], amp: [0.15, 0.04], oct: [4, 3], far: ['#3e5a8c', '#52709e'], near: ['#1e2c4a', '#121c32'], fog: [0.45, 0.05], snow: 9,
                deco: (t) => t < 0.25 ? { k: 'snowPine', n: 30, h: 18, c: '#3a5a78' } : t < 0.6 ? [{ k: 'xmasTree', n: 12, h: 34, c: '#1f5a3a' }, { k: 'cottage', n: 6, h: 34 }] : [{ k: 'cottage', n: 5, h: 54 }, { k: 'xmasTree', n: 8, h: 56, c: '#1b4d32' }, { k: 'lampPost', n: 6, h: 40 }, { k: 'present', n: 10, h: 14 }] },
            extras: [{ k: 'landmark', kind: 'bigTree', f: 0.2, x: 0.5, y: 0.8, size: 64 }],
            mid: 'village', midF: 0.3,
            clouds: cloudBands(0.25, [0.04, 0.24], 0.03), mist: mistBands('150,175,220', 0.08, [0.66, 0.82]),
            parts: [{ kind: 'snow', n: [70, 40] }, { kind: 'sparkle', n: [14, 6], rgb: '255,230,160' }],
            ambient: { shooting: true },
            life: ['ledStrings', 'chimneySmoke', 'sleigh', 'carolers'],
            ground: { top: '#f4f8ff', bot: '#c2d4ea', tufts: 'xmas' },
            fg: { top: { k: 'garland', c: [] }, bottom: { k: 'presentsFg', c: [] } },
            post: 'xmasNight'
        },
        {
            name: 'Twinkling Pines',
            sky: [[0, '#2a1a4a'], [0.45, '#6a3a7a'], [0.8, '#e08a7a'], [1, '#ffd6a8']],
            body: { kind: 'sun', x: 0.25, y: 0.62, r: 46, rgb: '255,200,150' }, haze: '255,200,180',
            cloudTint: C('120,70,120', '255,230,220', '230,170,170'),
            ridges: { n: 10, base: [0.6, 0.9], amp: [0.16, 0.05], oct: [4, 3], far: ['#7a6a9a', '#9a86b0'], near: ['#34283e', '#1e1628'], fog: [0.4, 0.06], snow: 10,
                deco: (t) => t < 0.3 ? { k: 'snowPine', n: 34, h: 20, c: '#5a5a80' } : [{ k: 'xmasTree', n: 16, h: 30 + t * 40, c: t < 0.6 ? '#2a6a4a' : '#1b4d32' }, { k: 'present', n: 10, h: 12 + t * 8 }, { k: 'snowman', n: 3, h: 22 + t * 10 }] },
            extras: [{ k: 'landmark', kind: 'cabin', f: 0.3, x: 0.72, y: 0.84, size: 46, c: ['#5a2a1a', '#3a1a10'], base: '#e6eef8' }],
            clouds: cloudBands(0.5, [0.05, 0.3], 0.04), mist: mistBands('230,190,200', 0.08, [0.62, 0.8]),
            parts: [{ kind: 'snow', n: [56, 30] }, { kind: 'mote', n: [10, 5], rgb: '255,220,180', rise: -0.04 }],
            ambient: { rays: true, rayRgb: '255,210,170' },
            life: ['ledStrings', 'deer', 'cardinals', 'chimneySmoke'],
            ground: { top: '#f4f8ff', bot: '#c8d6ea', tufts: 'xmas' },
            fg: { top: { k: 'garland', c: [] }, bottom: { k: 'presentsFg', c: [] } },
            post: 'xmas'
        },
        {
            name: 'North Pole',
            sky: [[0, '#03081c'], [0.5, '#0c1e46'], [0.85, '#1e4070'], [1, '#3e6a9a']],
            body: null, haze: '120,200,220', stars: 260,
            cloudTint: C('20,40,80', '200,230,255', '120,160,200'),
            ridges: { n: 9, base: [0.6, 0.9], amp: [0.13, 0.04], oct: [3, 3], far: ['#2a4a7a', '#3a5a8a'], near: ['#16223e', '#0c1428'], fog: [0.45, 0.06], snow: 9,
                deco: (t) => t < 0.3 ? null : [{ k: 'candyPole', n: 8, h: 40 + t * 20 }, { k: 'present', n: 14, h: 14 + t * 6 }, { k: 'xmasTree', n: 6, h: 40 + t * 20, c: '#1f5a3a' }] },
            extras: [{ k: 'landmark', kind: 'workshop', f: 0.2, x: 0.42, y: 0.8, size: 70 }],
            mid: 'village', midF: 0.32,
            clouds: cloudBands(0.2, [0.04, 0.2], 0.03), mist: mistBands('140,180,220', 0.08, [0.66, 0.82]),
            parts: [{ kind: 'snow', n: [64, 34] }, { kind: 'sparkle', n: [18, 8], rgb: '200,240,255' }],
            ambient: { aurora: true, shooting: true },
            life: ['ledStrings', 'sleigh', 'elves', 'chimneySmoke'],
            ground: { top: '#f4f8ff', bot: '#c2d4ea', tufts: 'xmas' },
            fg: { top: { k: 'garland', c: [] }, bottom: { k: 'presentsFg', c: [] } },
            post: 'xmasNight'
        }
    ];
})();
