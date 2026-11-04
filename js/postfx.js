// Screen-space post-processing, after the world and before the HUD. Every theme has a stack
// (backdrop variants can name one with `post`, otherwise the material's default):
//
//   bloom       bright areas glow: a downsampled, brightened, blurred copy added back on top
//   grade       colour grading: soft-light tint top/bottom, plus optional colour cast and fade
//   vignette    darkened (or tinted) edges          grain     animated film grain
//   scan        CRT scanlines (+ rolling band)       ca        chromatic aberration (always, or on hits)
//   haze        heat shimmer over the lower screen  caustics  moving underwater light
//   frost       icy corners                          fog       drifting ground fog
//   rays        screen-space light shafts from the top
//   zoomBlur    radial blur during slow motion (KOs, round ends)
//
// Quality adapts: if frames run long, the costly passes (bloom, haze, ca, zoom blur) switch off.
const PostFX = (() => {
    const P = {
        // ---- the five originals' materials ----
        dirt:    { bloom: 0.3, th: 0.8, grade: ['255,196,120', 0.14, '90,140,255', 0.06], vignette: ['10,6,0', 0.42], grain: 0.03, rays: '255,240,200' },
        stone:   { bloom: 0.2, th: 0.6, grade: ['170,110,210', 0.14, '40,30,60', 0.12], vignette: ['8,4,16', 0.5], grain: 0.04, fade: 0.04 },
        ice:     { bloom: 0.4, th: 0.65, grade: ['120,210,255', 0.16, '20,40,90', 0.1], vignette: ['0,10,30', 0.42], grain: 0.025, frost: 0.55 },
        cloud:   { bloom: 0.3, th: 0.82, grade: ['255,236,205', 0.12, '150,190,255', 0.08], vignette: ['20,30,60', 0.3], grain: 0.02, rays: '255,250,230' },
        magic:   { bloom: 0.42, th: 0.5, grade: ['200,90,255', 0.18, '40,10,90', 0.12], vignette: ['20,0,40', 0.5], grain: 0.03, ca: 0.6 },
        // ---- the newer themes (variant `post` keys) ----
        neon:    { bloom: 0.55, th: 0.45, grade: ['255,60,200', 0.16, '0,200,255', 0.14], vignette: ['10,0,25', 0.55], grain: 0.03, scan: 0.08, ca: 1 },
        synth:   { bloom: 0.6, th: 0.42, grade: ['255,80,180', 0.2, '80,30,200', 0.14], vignette: ['20,0,40', 0.55], grain: 0.035, scan: 0.12, ca: 1.4, roll: true },
        cyber:   { bloom: 0.5, th: 0.46, grade: ['0,255,200', 0.14, '0,60,90', 0.16], vignette: ['0,12,16', 0.6], grain: 0.04, scan: 0.07, ca: 1, cast: ['0,60,70', 0.08] },
        inferno: { bloom: 0.45, th: 0.6, grade: ['255,120,40', 0.15, '120,10,0', 0.16], vignette: ['30,0,0', 0.55], grain: 0.035, haze: 1, ca: 0.4 },
        ashen:   { bloom: 0.36, th: 0.55, grade: ['230,120,80', 0.14, '40,20,30', 0.16], vignette: ['15,4,6', 0.6], grain: 0.05, haze: 0.6, fade: 0.06 },
        reef:    { bloom: 0.36, th: 0.72, grade: ['80,230,255', 0.14, '0,60,120', 0.16], vignette: ['0,20,40', 0.45], grain: 0.02, caustics: 0.5, cast: ['0,90,130', 0.06] },
        abyss:   { bloom: 0.4, th: 0.66, grade: ['60,160,255', 0.14, '0,10,40', 0.2], vignette: ['0,4,14', 0.7], grain: 0.04, caustics: 0.2, fog: '20,60,120' },
        candy:   { bloom: 0.4, th: 0.8, grade: ['255,170,220', 0.16, '170,210,255', 0.1], vignette: ['120,40,90', 0.22], grain: 0.015, rays: '255,230,245' },
        frost:   { bloom: 0.45, th: 0.5, grade: ['230,160,255', 0.14, '40,20,90', 0.12], vignette: ['20,0,40', 0.45], grain: 0.02, frost: 0.3 },
        haunted: { bloom: 0.3, th: 0.55, grade: ['150,160,220', 0.14, '20,20,50', 0.18], vignette: ['0,0,10', 0.72], grain: 0.06, fade: 0.08, fog: '150,140,200', desat: 0.25 },
        harvest: { bloom: 0.4, th: 0.52, grade: ['255,150,60', 0.18, '60,10,50', 0.14], vignette: ['20,0,10', 0.6], grain: 0.05, fog: '255,140,80' },
        marsh:   { bloom: 0.38, th: 0.5, grade: ['140,255,150', 0.14, '0,30,10', 0.2], vignette: ['0,8,2', 0.7], grain: 0.05, fog: '140,200,130', desat: 0.15 }
    };
    // A few original backdrops get their own twist
    const BY_NAME = { 'Volcanic Crag': 'inferno', 'Storm Isles': Object.assign({}, P.cloud, { grade: ['150,170,210', 0.14, '20,25,40', 0.18], desat: 0.3, rays: null }), 'Crystal Cavern': Object.assign({}, P.ice, { bloom: 0.5, th: 0.45, frost: 0.2 }), 'Arcane Void': Object.assign({}, P.magic, { ca: 1 }), 'Desert Mesas': Object.assign({}, P.dirt, { haze: 0.5, grade: ['255,170,90', 0.18, '90,120,200', 0.06] }), 'Dusk Fortress': Object.assign({}, P.stone, { rays: null }) };

    let small = null, sctx = null, tmp = null, tctx = null, hz = null, hctx = null, grainPat = null, scanPat = null, caustic = null, frostC = null;
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    let quality = 2, slowFrames = 0, fastFrames = 0, lastT = 0;
    const filterOk = (() => { try { const c = mk(2, 2).getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (e) { return false; } })();

    function profileFor(level) {
        const bd = level.backdrop, V = bd && bd.V;
        if (V && BY_NAME[V.name]) { const b = BY_NAME[V.name]; return typeof b === 'string' ? P[b] : b; }
        if (V && V.post && P[V.post]) return P[V.post];
        return P[level.material] || P.dirt;
    }

    function bloom(ctx, canvas, W, H, amt, th) {
        const sw = Math.max(1, Math.round(W / 6)), sh = Math.max(1, Math.round(H / 6));
        if (!small || small.width !== sw || small.height !== sh) { small = mk(sw, sh); sctx = small.getContext('2d'); }
        sctx.globalCompositeOperation = 'copy';
        sctx.filter = filterOk ? `brightness(${(0.375 / th).toFixed(3)}) contrast(4) saturate(1.4) blur(${Math.max(1.5, sw / 160)}px)` : 'none';   // keeps only what is brighter than th
        sctx.drawImage(canvas, 0, 0, sw, sh);
        sctx.filter = 'none';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = amt * (filterOk ? 1 : 0.5);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(small, 0, 0, W, H);
        // a wider, softer second halo
        ctx.globalAlpha = amt * 0.45;
        ctx.drawImage(small, -W * 0.02, -H * 0.02, W * 1.04, H * 1.04);
        ctx.restore();
    }

    function grade(ctx, W, H, g, fx) {
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, `rgba(${g[0]},${g[1] * 1.6})`); gr.addColorStop(1, `rgba(${g[2]},${g[3] * 1.6})`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function vignette(ctx, W, H, v, extra) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.74);
        g.addColorStop(0, `rgba(${v[0]},0)`); g.addColorStop(1, `rgba(${v[0]},${Math.min(0.9, v[1] + extra)})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    function grain(ctx, W, H, a, t) {
        if (!grainPat) {
            const c = mk(128, 128), g = c.getContext('2d'), img = g.createImageData(128, 128);
            for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
            g.putImageData(img, 0, 0);
            grainPat = ctx.createPattern(c, 'repeat');
        }
        ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
        const o = Math.floor(t * 7) % 128;
        ctx.translate(-o, -((o * 37) % 128));
        ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 128, H + 128);
        ctx.restore();
    }

    function scan(ctx, W, H, a, t, roll) {
        if (!scanPat) { const c = mk(4, 4), g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 2, 4, 1); scanPat = ctx.createPattern(c, 'repeat'); }
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = scanPat; ctx.fillRect(0, 0, W, H); ctx.restore();
        if (roll) {
            const y = (t * 2.2) % (H + 200) - 100;
            const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, y - 60, W, 120);
        }
    }

    // Split red and blue apart a little (more on heavy hits)
    function chroma(ctx, canvas, W, H, d) {
        const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));
        if (!tmp || tmp.width !== hw || tmp.height !== hh) { tmp = mk(hw, hh); tctx = tmp.getContext('2d'); }
        for (const [rgb, dx] of [['255,0,0', d], ['0,80,255', -d]]) {
            tctx.globalCompositeOperation = 'copy'; tctx.drawImage(canvas, 0, 0, hw, hh);
            tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = `rgb(${rgb})`; tctx.fillRect(0, 0, hw, hh);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16;
            ctx.drawImage(tmp, dx, 0, W, H);
            ctx.restore();
        }
    }

    // Heat shimmer: the lower part of the screen wobbles in thin strips
    function haze(ctx, canvas, W, H, amt, t) {
        const y0 = Math.floor(H * 0.55), hh = H - y0;
        if (!hz || hz.width !== W || hz.height !== hh) { hz = mk(W, hh); hctx = hz.getContext('2d'); }
        hctx.globalCompositeOperation = 'copy';
        hctx.drawImage(canvas, 0, y0, W, hh, 0, 0, W, hh);
        const strip = 6;
        for (let y = 0; y < hh; y += strip) {
            const k = y / hh, dx = Math.sin(t * 0.09 + y * 0.09) * 2.2 * amt * k;
            ctx.drawImage(hz, 0, y, W, strip, dx, y0 + y, W, strip);
        }
    }

    // Underwater light: a seamless web of bright ridges (interfering waves, thresholded) that drifts
    // slowly in two layers, strongest near the surface and fading with depth. No hard scribbles.
    function caustics(ctx, W, H, a, t) {
        if (!caustic) {
            const N = 128;
            caustic = mk(N, N);
            const g = caustic.getContext('2d'), img = g.createImageData(N, N);
            const waves = [[5, 2, 0.4], [-3, 6, 1.9], [6, -4, 3.1], [2, -6, 5.0], [-6, -2, 2.2], [4, 5, 4.1]];
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                let v = 0;
                for (const [kx, ky, ph] of waves) v += Math.sin(((kx * x + ky * y) / N) * Math.PI * 2 + ph);
                v /= waves.length;
                const c = Math.pow(Math.max(0, 1 - Math.abs(v) * 4.2), 4);
                const i = (y * N + x) * 4;
                img.data[i] = 205; img.data[i + 1] = 245; img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * c);
            }
            g.putImageData(img, 0, 0);
        }
        const strips = 8, sh = Math.ceil(H * 0.8 / strips), depth = sh * strips;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [sp, sc, dir] of [[0.2, 1.5, 1], [0.13, 2.1, -1]]) {
            const pat = ctx.createPattern(caustic, 'repeat');
            const shimmer = 0.75 + 0.25 * Math.sin(t * 0.021 * sc);
            for (let i = 0; i < strips; i++) {
                ctx.save();
                ctx.globalAlpha = a * 1.1 * shimmer * Math.pow(1 - (i + 0.5) / strips, 1.6);
                ctx.beginPath(); ctx.rect(0, i * sh, W, sh); ctx.clip();
                ctx.scale(sc, sc); ctx.translate(dir * (t * sp) % 128, (t * sp * 0.55) % 128);
                ctx.fillStyle = pat; ctx.fillRect(-128, -128, W / sc + 256, depth / sc + 256);
                ctx.restore();
            }
        }
        ctx.restore();
    }

    function frost(ctx, W, H, a) {
        if (!frostC || frostC.width !== W || frostC.height !== H) {
            frostC = mk(W, H);
            const g = frostC.getContext('2d');
            for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
                const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.45);
                gr.addColorStop(0, 'rgba(235,248,255,0.85)'); gr.addColorStop(0.5, 'rgba(210,240,255,0.25)'); gr.addColorStop(1, 'rgba(210,240,255,0)');
                g.fillStyle = gr; g.fillRect(0, 0, W, H);
                g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
                for (let i = 0; i < 26; i++) {
                    let x = cx, y = cy; const a0 = Math.atan2(H / 2 - cy, W / 2 - cx) + (Math.random() - 0.5) * 1.4;
                    g.beginPath(); g.moveTo(x, y);
                    for (let k = 0; k < 8; k++) { x += Math.cos(a0 + (Math.random() - 0.5)) * 14; y += Math.sin(a0 + (Math.random() - 0.5)) * 14; g.lineTo(x, y); }
                    g.stroke();
                }
            }
        }
        ctx.save(); ctx.globalAlpha = a; ctx.drawImage(frostC, 0, 0); ctx.restore();
    }

    function fog(ctx, W, H, rgb, t) {
        ctx.save();
        for (let i = 0; i < 6; i++) {
            const x = ((i * W * 0.31 + t * (0.3 + i * 0.07)) % (W * 1.6)) - W * 0.3, r = W * 0.28;
            const g = ctx.createRadialGradient(x, H, 0, x, H, r);
            g.addColorStop(0, `rgba(${rgb},0.16)`); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(x - r, H - r, r * 2, r);
        }
        ctx.restore();
    }

    function rays(ctx, W, H, rgb, t) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
            const x = W * (0.1 + i * 0.2) + Math.sin(t * 0.003 + i) * 40, w = W * 0.05;
            const g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
            const a = 0.035 + 0.02 * Math.sin(t * 0.008 + i * 2);
            g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.3, 0); ctx.lineTo(x + w * 0.3, 0); ctx.lineTo(x + w * 2.4, H * 0.8); ctx.lineTo(x + w * 0.8, H * 0.8); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    function zoomBlur(ctx, canvas, W, H, amt) {
        const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));
        if (!tmp || tmp.width !== hw || tmp.height !== hh) { tmp = mk(hw, hh); tctx = tmp.getContext('2d'); }
        tctx.globalCompositeOperation = 'copy'; tctx.drawImage(canvas, 0, 0, hw, hh);
        ctx.save();
        for (let i = 1; i <= 3; i++) {
            const s = 1 + 0.012 * i * amt;
            ctx.globalAlpha = 0.16 * amt;
            ctx.drawImage(tmp, W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s);
        }
        ctx.restore();
    }

    return {
        P,
        quality: () => quality,
        apply(game, ctx, W, H) {
            const level = game.level, fx = game.fx, t = fx.clock, canvas = ctx.canvas;
            const pr = profileFor(level);
            // adaptive quality from the real frame time
            const now = performance.now(), ft = lastT ? now - lastT : 16; lastT = now;
            // aim for a steady 60 fps: a frame over ~19ms means the effects are too heavy for this machine, so shed them
            // quickly; only bring them back after a long run of frames well inside the budget
            if (ft > 19.5 && ft < 120) { slowFrames++; fastFrames = 0; } else if (ft < 15.5 || ft > 120) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
            if (slowFrames > 12 && quality > 0) { quality--; slowFrames = 0; }
            if (fastFrames > 1200 && quality < 2) { quality++; fastFrames = 0; }
            const heavy = quality >= 2, mid = quality >= 1;
            if (pr.haze && heavy) haze(ctx, canvas, W, H, pr.haze, t);
            if (pr.bloom && mid) bloom(ctx, canvas, W, H, pr.bloom * (heavy ? 1 : 0.7), pr.th);
            if (pr.caustics) caustics(ctx, W, H, pr.caustics * 0.18, t);
            if (pr.rays) rays(ctx, W, H, pr.rays, t);
            if (pr.grade) grade(ctx, W, H, pr.grade, fx);
            if (pr.cast) { ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = pr.cast[1]; ctx.fillStyle = `rgb(${pr.cast[0]})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
            const lowHp = !game.demo && game.players.some(p => !p.isBot && !p.isDead && p.health < p.maxHealth * 0.25);
            const desat = (pr.desat || 0) + (lowHp ? 0.35 : 0);
            if (desat > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = Math.min(0.8, desat); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
            if (pr.fade) { ctx.fillStyle = `rgba(40,40,50,${pr.fade})`; ctx.save(); ctx.globalCompositeOperation = 'lighten'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
            if (pr.fog) fog(ctx, W, H, pr.fog, t);
            if (pr.frost) frost(ctx, W, H, pr.frost);
            // chromatic split: a theme's constant amount, plus a kick on heavy hits
            const kick = fx.trauma > 0.12 ? fx.trauma * 6 : 0;
            if (heavy && (pr.ca || kick)) chroma(ctx, canvas, W, H, (pr.ca || 0) + kick);
            if (game.slowMotion && heavy) zoomBlur(ctx, canvas, W, H, Math.min(1, (1 - game.timeScale) * 1.4));
            if (pr.scan) scan(ctx, W, H, pr.scan, t, pr.roll);
            if (pr.vignette) vignette(ctx, W, H, pr.vignette, game.slowMotion ? 0.15 : 0);
            if (pr.grain) grain(ctx, W, H, pr.grain, t);
        }
    };
})();

// Replace the old single grade + vignette with the full stack
Object.assign(Game.prototype, {
    drawGrade(ctx, W, H) { PostFX.apply(this, ctx, W, H); },
    drawVignette() {}
});
