// Living backdrops: every scene gets a few kinds of animated actors on their own parallax layers,
// so nothing behind the arena is a dead painting. Grass and kelp sway, birds and bats flock past,
// deer graze, balloons and airships drift, a dragon or a witch crosses the sky now and then,
// flying cars stream between towers, volcanoes erupt in the distance, fish school, ghosts drift,
// Santa's sleigh flies over the village... Far layers are tinted toward the scene's haze.
// A variant lists its actors in `life`; otherwise LIFE_BY_NAME picks them by the scene's name.
(() => {
    const TAU = Math.PI * 2;
    const R = Math.random;
    const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    // colour pushed toward the layer's haze, so distant actors sit in the scene
    const tint = (L, hex, a) => {
        const c = rgbOf(hex), h = L.haze, k = L.fog;
        return `rgba(${Math.round(c[0] + (h[0] - c[0]) * k)},${Math.round(c[1] + (h[1] - c[1]) * k)},${Math.round(c[2] + (h[2] - c[2]) * k)},${a === undefined ? 1 : a})`;
    };
    const glow = (ctx, x, y, r, rgb, a) => {
        if (a <= 0.01 || r <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(Backdrop.dot(rgb), x - r, y - r, r * 2, r * 2);
        ctx.restore();
    };
    const wrapX = (a, L, m) => { m = m || 80; if (a.x > L.x1 + m) a.x = L.x0 - m; else if (a.x < L.x0 - m) a.x = L.x1 + m; };

    // a flapping bird (or bat) silhouette
    const bird = (ctx, x, y, s, ph, fill, bat) => {
        const f = Math.sin(ph) * 5 * s;
        ctx.fillStyle = fill;
        ctx.beginPath();
        if (bat) {
            ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6 * s, y - f - 3 * s, x - 12 * s, y - f); ctx.lineTo(x - 9 * s, y + 1 * s); ctx.lineTo(x - 6 * s, y - 1 * s); ctx.lineTo(x - 3 * s, y + 2 * s);
            ctx.lineTo(x, y + 1 * s); ctx.lineTo(x + 3 * s, y + 2 * s); ctx.lineTo(x + 6 * s, y - 1 * s); ctx.lineTo(x + 9 * s, y + 1 * s); ctx.lineTo(x + 12 * s, y - f); ctx.quadraticCurveTo(x + 6 * s, y - f - 3 * s, x, y);
        } else {
            ctx.moveTo(x - 11 * s, y - f); ctx.quadraticCurveTo(x - 5 * s, y - f * 0.4 - 2 * s, x, y); ctx.quadraticCurveTo(x + 5 * s, y - f * 0.4 - 2 * s, x + 11 * s, y - f);
            ctx.quadraticCurveTo(x + 5 * s, y - f * 0.2, x, y + 2 * s); ctx.quadraticCurveTo(x - 5 * s, y - f * 0.2, x - 11 * s, y - f);
        }
        ctx.fill();
    };

    // ---------- the actor kinds: f = parallax depth, spawn(L) fills L.items, step(L, dt), draw(ctx, L) ----------
    const K = {};

    // --- sky crossers ---
    K.flock = {
        f: 0.24,
        spawn(L, o) { L.col = (o && o.col) || '#1d2330'; for (let g = 0; g < 3; g++) { const gx = L.x0 + R() * (L.x1 - L.x0), gy = L.H * (0.1 + R() * 0.3), v = 0.5 + R() * 0.5; for (let i = 0; i < 5 + (R() * 4 | 0); i++) L.items.push({ x: gx - i * 16, y: gy + Math.abs(i - 2) * 7 * (i % 2 ? 1 : -1), v, ph: R() * TAU, s: 0.55 + R() * 0.3 }); } },
        step(L, dt) { for (const b of L.items) { b.x += b.v * dt; b.y += Math.sin(b.ph * 0.13) * 0.08 * dt; b.ph += 0.22 * dt; wrapX(b, L, 160); } },
        draw(ctx, L) { for (const b of L.items) bird(ctx, b.x, b.y, b.s, b.ph, tint(L, L.col)); }
    };
    K.owls = { f: 0.3, spawn(L) { K.flock.spawn(L, { col: '#f3f6fb' }); for (const b of L.items) { b.v *= 0.7; b.s *= 1.2; } }, step: (L, dt) => K.flock.step(L, dt), draw: (ctx, L) => K.flock.draw(ctx, L) };
    K.crows = { f: 0.32, spawn(L) { K.flock.spawn(L, { col: '#07060a' }); }, step: (L, dt) => K.flock.step(L, dt), draw: (ctx, L) => K.flock.draw(ctx, L) };
    K.cardinals = { f: 0.55, spawn(L) { K.flock.spawn(L, { col: '#c62828' }); L.items.length = Math.min(L.items.length, 7); for (const b of L.items) { b.v = 0.9 + R() * 0.6; b.y = L.H * (0.5 + R() * 0.3); } }, step: (L, dt) => K.flock.step(L, dt), draw: (ctx, L) => K.flock.draw(ctx, L) };
    K.vultures = {
        f: 0.2,
        spawn(L) { for (let i = 0; i < 4; i++) L.items.push({ cx: L.W * (0.2 + R() * 0.6), cy: L.H * (0.15 + R() * 0.15), r: 50 + R() * 60, a: R() * TAU, v: 0.006 + R() * 0.006, ph: R() * TAU }); },
        step(L, dt) { for (const b of L.items) { b.a += b.v * dt; b.ph += 0.05 * dt; } },
        draw(ctx, L) { for (const b of L.items) bird(ctx, b.cx + Math.cos(b.a) * b.r, b.cy + Math.sin(b.a) * b.r * 0.35, 0.9, Math.sin(b.ph) * 0.4, tint(L, '#2a1a10')); }
    };
    K.bats = {
        f: 0.3,
        spawn(L) { for (let i = 0; i < 14; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.1 + R() * 0.4), v: (R() < 0.5 ? -1 : 1) * (0.8 + R() * 0.8), ph: R() * TAU, s: 0.5 + R() * 0.5 }); },
        step(L, dt) { for (const b of L.items) { b.x += b.v * dt; b.y += Math.sin(b.ph * 0.7) * 0.9 * dt; b.ph += 0.6 * dt; wrapX(b, L); } },
        draw(ctx, L) { for (const b of L.items) bird(ctx, b.x, b.y, b.s, b.ph, tint(L, '#0a0810'), true); }
    };
    K.fireBirds = {
        f: 0.22,
        spawn(L) { for (let i = 0; i < 5; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.12 + R() * 0.35), v: 0.9 + R() * 0.7, ph: R() * TAU, s: 0.8 + R() * 0.4, trail: [] }); },
        step(L, dt) { for (const b of L.items) { b.x += b.v * dt; b.y += Math.sin(b.ph * 0.1) * 0.3 * dt; b.ph += 0.25 * dt; b.trail.unshift([b.x, b.y]); if (b.trail.length > 14) b.trail.pop(); if (b.x > L.x1 + 120) { b.x = L.x0 - 120; b.trail = []; } } },
        draw(ctx, L) { for (const b of L.items) { b.trail.forEach(([x, y], i) => glow(ctx, x - i * 2, y, 10 - i * 0.5, '255,140,40', 0.4 - i * 0.025)); glow(ctx, b.x, b.y, 22, '255,170,60', 0.6); bird(ctx, b.x, b.y, b.s, b.ph, 'rgba(255,214,120,0.95)'); } }
    };
    // A dragon crossing the far sky now and then. It is scenery, not a map feature: small, far away, pushed into the haze
    // of its layer, and quick (it is across the arena in a few seconds). A proper dragon silhouette: plump torso, a long
    // S-curved neck and a horned head, two big bat wings that beat (the downstroke is faster than the upstroke, the body
    // rises and falls against them), folded legs, and a long tail that swishes a little behind the beat. Now and then a
    // jet of fire.
    K.dragon = {
        f: 0.08,
        spawn(L) { L.fog = Math.max(L.fog, 0.5); L.items.push({ x: L.x0 - 300, y: L.H * 0.2, v: 3.3, ph: 0, wait: 160 + R() * 500, breath: 0, breathIn: 90 + R() * 160 }); },
        step(L, dt) {
            const d = L.items[0];
            if (d.wait > 0) { d.wait -= dt; return; }
            d.x += d.v * dt; d.ph += 0.19 * dt;
            d.y = L.H * 0.2 + Math.sin(d.ph * 0.12) * 18 + (d.x - L.x0) * 0.012;
            if (d.breath <= 0) { d.breathIn -= dt; if (d.breathIn <= 0) { d.breath = 1; d.breathIn = 300 + R() * 400; } } else { d.breath += dt / 38; if (d.breath > 3) d.breath = 0; }
            if (d.x > L.x1 + 300) { d.x = L.x0 - 300; d.wait = 500 + R() * 900; d.breath = 0; }
        },
        draw(ctx, L) {
            const d = L.items[0]; if (d.wait > 0) return;
            const S = 1.45, t = d.ph;
            // wing beat: a stroke that is quick going down and slower coming up
            const beat = Math.sin(t) + 0.28 * Math.sin(2 * t + 0.6), bob = -beat * 5 * S * 0.6;
            const body = tint(L, '#1b1016'), belly = tint(L, '#5a2a26', 0.9), memb = tint(L, '#33161d', 0.92), membFar = tint(L, '#28101a', 0.9), bone = tint(L, '#0f0709'), rim = tint(L, '#a14a34', 0.7);
            const ox = d.x, oy = d.y + bob;
            ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const breathing = d.breath > 0.05 && d.breath < 3, open = breathing ? Math.min(1, d.breath * 3) * (d.breath > 2.3 ? Math.max(0, (3 - d.breath) / 0.7) : 1) : 0;
            const wing = (far) => {
                const ph = far ? t - 0.45 : t, fl = Math.sin(ph) + 0.28 * Math.sin(2 * ph + 0.6), lag = Math.sin(ph - 0.9) + 0.28 * Math.sin(2 * ph - 0.3);
                const sx = 4 + (far ? 8 : 0), sy = -10 - (far ? 3 : 0), k = far ? 0.85 : 1;
                // arm: shoulder -> elbow -> wrist; angles measured from straight up, positive toward the tail
                const a1 = (0.25 - 1.0 * fl) , a2 = a1 + 0.5 - 0.35 * lag;
                const el = { x: sx - Math.sin(a1) * 34 * k, y: sy - Math.cos(a1) * 34 * k }, wr = { x: el.x - Math.sin(a2) * 42 * k, y: el.y - Math.cos(a2) * 42 * k };
                const tips = [], lens = [66, 76, 70, 52];
                for (let j = 0; j < 4; j++) { const a = a2 + 0.7 + j * 0.46 - 0.55 * lag * (0.3 + j * 0.25); tips.push({ x: wr.x - Math.sin(a) * lens[j] * k, y: wr.y - Math.cos(a) * lens[j] * k }); }
                const root = { x: -16, y: 2 };
                ctx.fillStyle = far ? membFar : memb; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(el.x, el.y); ctx.lineTo(wr.x, wr.y);
                let prev = wr;
                for (const tp of tips) { const mx = (prev.x + tp.x) / 2, my = (prev.y + tp.y) / 2; ctx.quadraticCurveTo(mx + (wr.x - mx) * 0.3, my + (wr.y - my) * 0.3, tp.x, tp.y); prev = tp; }
                ctx.quadraticCurveTo((prev.x + root.x) / 2 + 6, (prev.y + root.y) / 2 + 4, root.x, root.y); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = bone; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(el.x, el.y); ctx.lineTo(wr.x, wr.y); ctx.stroke();
                ctx.lineWidth = 1.3; for (const tp of tips) { ctx.beginPath(); ctx.moveTo(wr.x, wr.y); ctx.lineTo(tp.x, tp.y); ctx.stroke(); }
            };
            wing(true);
            // tail: a long taper that swishes, each part a little behind the one before
            const tail = []; for (let i = 0; i <= 14; i++) { const u = i / 14; tail.push({ x: -22 - u * 108, y: 4 + u * 10 + Math.sin(t * 0.9 - u * 4.2) * (2 + u * 12) }); }
            ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-22, -7);
            for (let i = 0; i <= 14; i++) ctx.lineTo(tail[i].x, tail[i].y - 9 * Math.pow(1 - i / 14, 0.9) - 0.6);
            for (let i = 14; i >= 0; i--) ctx.lineTo(tail[i].x, tail[i].y + 9 * Math.pow(1 - i / 14, 0.9) + 0.6);
            ctx.lineTo(-22, 10); ctx.closePath(); ctx.fill();
            const te = tail[14], tp = tail[13], ta = Math.atan2(te.y - tp.y, te.x - tp.x);
            ctx.save(); ctx.translate(te.x, te.y); ctx.rotate(ta); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -11, -16, 0); ctx.quadraticCurveTo(-4, 11, 0, 0); ctx.fill(); ctx.restore();
            // hind legs and torso
            const leg = (x, off) => { ctx.strokeStyle = bone; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x - 7, 15 + Math.sin(t + off) * 2); ctx.lineTo(x - 15, 12 + Math.sin(t + off) * 2); ctx.stroke(); };
            leg(-12, 0.3); leg(10, 1.1);
            ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 29, 13, -0.08, 0, TAU); ctx.fill();
            ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(1, 5.5, 25, 6, -0.08, 0, Math.PI); ctx.fill();
            // dorsal spikes along back, neck and tail root
            ctx.fillStyle = bone; for (let i = -4; i <= 4; i++) { const x = i * 6, y = -12 + Math.abs(i) * 0.5; ctx.beginPath(); ctx.moveTo(x - 2.5, y + 1); ctx.lineTo(x - 1, y - 5.5); ctx.lineTo(x + 2, y + 1); ctx.fill(); }
            // neck: an S that sways a beat behind the wings; the head rides at the end of it
            const nk = Math.sin(t - 0.8) * 3.5, n0 = { x: 22, y: -6 }, n1 = { x: 38 + nk * 0.3, y: -26 + nk }, n2 = { x: 56, y: -22 + nk * 0.7 }, hd = { x: 62, y: -26 + nk * 0.9 };
            ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(n0.x, n0.y - 9);
            ctx.bezierCurveTo(n1.x - 6, n1.y - 6, n2.x - 4, n2.y - 7, hd.x, hd.y - 6);
            ctx.lineTo(hd.x + 1, hd.y + 6); ctx.bezierCurveTo(n2.x + 2, n2.y + 8, n1.x + 8, n1.y + 12, n0.x + 2, n0.y + 9); ctx.closePath(); ctx.fill();
            // head
            ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(0.12 - open * 0.0 + Math.sin(t - 1.1) * 0.05);
            ctx.save(); ctx.translate(2, 3); ctx.rotate(open * 0.5); ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(19, 1); ctx.lineTo(23, 4); ctx.lineTo(8, 6); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill(); ctx.restore();
            ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(4, -9, 17, -4); ctx.quadraticCurveTo(26, -2, 27, 2); ctx.lineTo(10, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = bone; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-12, -14, -22, -9); ctx.quadraticCurveTo(-12, -9, -2, -3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(1, -7); ctx.quadraticCurveTo(-3, -17, -13, -18); ctx.quadraticCurveTo(-4, -13, 4, -6); ctx.fill();
            ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(8, -3, 2, 1.2, 0.2, 0, TAU); ctx.fill();
            ctx.restore();
            wing(false);
            ctx.restore();
            // eye glow, smoke from the nostril, and the jet of fire
            const hx = ox + (hd.x + 4) * S, hy = oy + (hd.y - 3) * S, mx = ox + (hd.x + 26) * S, my = oy + (hd.y + 4) * S;
            glow(ctx, hx, hy, 9 * S, '255,170,60', 0.6);
            if (breathing) {
                const k = d.breath, throat = Math.min(1, k * 2.4);
                glow(ctx, hx - 4 * S, hy + 6 * S, 16 * S * throat, '255,120,30', 0.55 * throat);
                if (k > 0.3) { const f = Math.min(1, (k - 0.3) / 0.4) * (k > 2.3 ? Math.max(0, (3 - k) / 0.7) : 1); for (let i = 0; i < 26; i++) { const u = i / 26, px = mx + u * 150 * S * f, py = my + u * 22 * S * f + Math.sin(t * 2.2 + i * 1.4) * (3 + u * 9) * S * 0.5; glow(ctx, px, py, (6 + u * 22) * S * 0.7, u < 0.3 ? '255,235,170' : u < 0.65 ? '255,150,50' : '225,70,20', (0.8 - u * 0.6) * f); } }
            }
        }
    };
    K.witch = {
        f: 0.06,
        spawn(L) { L.items.push({ x: L.x0 - 100, y: L.H * 0.3, ph: 0, wait: 120 + R() * 400 }); },
        step(L, dt) { const w = L.items[0]; if (w.wait > 0) { w.wait -= dt; return; } w.x += 1.3 * dt; w.ph += 0.05 * dt; w.y = L.H * 0.3 + Math.sin(w.ph) * 20 - (w.x - L.x0) * 0.04; if (w.x > L.x1 + 100) { w.x = L.x0 - 100; w.wait = 600 + R() * 900; } },
        draw(ctx, L) {
            const w = L.items[0]; if (w.wait > 0) return;
            ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(-0.12); ctx.fillStyle = '#05040a'; ctx.strokeStyle = '#05040a';
            ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(20, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-38, -2); ctx.lineTo(-40, 10); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(2, -14); ctx.lineTo(8, 1); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(2, -16, 4, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(10, -18); ctx.lineTo(0, -34); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(-16, -6 + Math.sin(w.ph * 6) * 3, -22, -2); ctx.lineTo(-4, -2); ctx.fill();
            ctx.restore();
        }
    };
    K.sleigh = {
        f: 0.07,
        spawn(L) { L.items.push({ x: L.x0 - 200, y: L.H * 0.2, ph: 0, wait: 60 + R() * 300, trail: [] }); },
        step(L, dt) { const s = L.items[0]; if (s.wait > 0) { s.wait -= dt; return; } s.x += 1.6 * dt; s.ph += 0.08 * dt; s.y = L.H * 0.2 + Math.sin(s.ph * 0.4) * 14; s.trail.unshift([s.x - 20, s.y + 6]); if (s.trail.length > 40) s.trail.pop(); if (s.x > L.x1 + 260) { s.x = L.x0 - 200; s.wait = 500 + R() * 900; s.trail = []; } },
        draw(ctx, L) {
            const s = L.items[0]; if (s.wait > 0) return;
            s.trail.forEach(([x, y], i) => glow(ctx, x + Math.sin(i + s.ph) * 2, y + i * 0.2, 5 - i * 0.1, '255,230,150', 0.6 - i * 0.015));
            ctx.save(); ctx.translate(s.x, s.y); ctx.fillStyle = '#0a0d1a'; ctx.strokeStyle = '#0a0d1a'; ctx.lineWidth = 1.4;
            // sleigh
            ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-2, 0); ctx.lineTo(0, -8); ctx.lineTo(-20, -10); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-28, 4); ctx.lineTo(2, 4); ctx.quadraticCurveTo(6, 4, 6, 0); ctx.stroke();
            ctx.beginPath(); ctx.arc(-14, -14, 4, 0, TAU); ctx.fill(); ctx.fillRect(-22, -20, 10, 8);
            // reins and four reindeer
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(70, -10); ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const rx = 14 + i * 16, ry = -10 + Math.sin(s.ph * 2 + i) * 2, leg = Math.sin(s.ph * 3 + i) * 3;
                ctx.beginPath(); ctx.ellipse(rx, ry, 6, 2.6, 0, 0, TAU); ctx.fill();
                ctx.beginPath(); ctx.moveTo(rx + 5, ry - 1); ctx.lineTo(rx + 8, ry - 6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rx + 8, ry - 6); ctx.lineTo(rx + 6, ry - 10); ctx.moveTo(rx + 8, ry - 6); ctx.lineTo(rx + 11, ry - 10); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(rx - 4, ry + 2); ctx.lineTo(rx - 6 - leg, ry + 6); ctx.moveTo(rx + 3, ry + 2); ctx.lineTo(rx + 5 + leg, ry + 6); ctx.stroke();
            }
            ctx.restore();
            glow(ctx, s.x + 78, s.y - 16, 7, '255,60,60', 0.9);   // the red nose
        }
    };
    K.balloons = {
        f: 0.16,
        spawn(L, o) { const cols = o && o.cols || [['#e53935', '#ffeb3b'], ['#1e88e5', '#ffffff'], ['#43a047', '#ffca28'], ['#8e24aa', '#ff80ab']]; for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.12 + R() * 0.35), v: 0.12 + R() * 0.15, ph: R() * TAU, s: 0.7 + R() * 0.6, c: cols[i % cols.length] }); },
        step(L, dt) { for (const b of L.items) { b.x += b.v * dt; b.ph += 0.01 * dt; b.y += Math.sin(b.ph) * 0.06 * dt; wrapX(b, L, 120); } },
        draw(ctx, L) {
            for (const b of L.items) {
                const s = b.s * 14;
                ctx.save(); ctx.translate(b.x, b.y);
                for (let k = 0; k < 6; k++) { ctx.fillStyle = tint(L, b.c[k % 2]); ctx.beginPath(); ctx.ellipse(0, 0, s * (1 - k / 6), s * 1.15, 0, 0, TAU); ctx.fill(); }
                ctx.strokeStyle = tint(L, '#4e342e'); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-s * 0.5, s); ctx.lineTo(-s * 0.25, s * 1.6); ctx.moveTo(s * 0.5, s); ctx.lineTo(s * 0.25, s * 1.6); ctx.stroke();
                ctx.fillStyle = tint(L, '#6d4c41'); ctx.fillRect(-s * 0.28, s * 1.6, s * 0.56, s * 0.4);
                if (Math.sin(b.ph * 30) > 0.9) glow(ctx, 0, s * 1.3, s * 0.8, '255,170,60', 0.7);
                ctx.restore();
            }
        }
    };
    K.candyBalloons = {
        f: 0.4,
        spawn(L) { for (let i = 0; i < 12; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.3 + R() * 0.8), v: -(0.15 + R() * 0.25), ph: R() * TAU, s: 6 + R() * 6, c: ['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff', '#ff5252'][i % 6] }); },
        step(L, dt) { for (const b of L.items) { b.y += b.v * dt; b.ph += 0.03 * dt; b.x += Math.sin(b.ph) * 0.2 * dt; if (b.y < -60) { b.y = L.H + 40; b.x = L.x0 + R() * (L.x1 - L.x0); } } },
        draw(ctx, L) { for (const b of L.items) { ctx.strokeStyle = tint(L, '#ffffff', 0.6); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(b.x, b.y + b.s * 1.2); ctx.quadraticCurveTo(b.x + Math.sin(b.ph * 2) * 4, b.y + b.s * 2.5, b.x, b.y + b.s * 4); ctx.stroke(); ctx.fillStyle = tint(L, b.c); ctx.beginPath(); ctx.ellipse(b.x, b.y, b.s * 0.85, b.s * 1.1, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(b.x - b.s * 0.3, b.y - b.s * 0.4, b.s * 0.18, b.s * 0.3, -0.5, 0, TAU); ctx.fill(); } }
    };
    K.airship = {
        f: 0.18,
        spawn(L) { L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.18 + R() * 0.12), v: 0.18, ph: 0 }); },
        step(L, dt) { for (const a of L.items) { a.x += a.v * dt; a.ph += 0.03 * dt; wrapX(a, L, 200); } },
        draw(ctx, L) {
            for (const a of L.items) {
                ctx.save(); ctx.translate(a.x, a.y + Math.sin(a.ph) * 4); ctx.rotate(Math.sin(a.ph * 0.7) * 0.04);
                const g = ctx.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, tint(L, '#d7ccc8')); g.addColorStop(1, tint(L, '#8d6e63'));
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 70, 20, 0, 0, TAU); ctx.fill();
                ctx.strokeStyle = tint(L, '#5d4037', 0.6); ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 70, 20 * Math.abs(k) / 3, 0, 0, TAU); ctx.stroke(); }
                ctx.fillStyle = tint(L, '#5d4037'); ctx.fillRect(-22, 22, 44, 10); ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-86, -16); ctx.lineTo(-86, 16); ctx.closePath(); ctx.fill();
                const pr = Math.abs(Math.sin(a.ph * 20)) * 8; ctx.fillRect(-90, -pr, 2, pr * 2);
                glow(ctx, 0, 27, 14, '255,210,120', 0.5);
                ctx.restore();
            }
        }
    };
    K.windStreaks = {
        f: 0.5,
        spawn(L) { for (let i = 0; i < 10; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.1 + R() * 0.7), v: 6 + R() * 6, len: 60 + R() * 120, a: 0.1 + R() * 0.2 }); },
        step(L, dt) { for (const w of L.items) { w.x += w.v * dt; if (w.x > L.x1 + 200) { w.x = L.x0 - 200; w.y = L.H * (0.1 + R() * 0.7); } } },
        draw(ctx, L) { ctx.lineCap = 'round'; for (const w of L.items) { ctx.strokeStyle = `rgba(255,255,255,${w.a})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w.x - w.len, w.y); ctx.quadraticCurveTo(w.x - w.len * 0.5, w.y - 6, w.x, w.y); ctx.stroke(); } }
    };

    // --- ground life ---
    K.grassSway = {
        f: 0.84,
        spawn(L, o) { const cols = o && o.cols || ['#2f7d32', '#43a047', '#1d5a22', '#558b2f']; for (let x = L.x0; x < L.x1; x += 7 + R() * 6) L.items.push({ x, h: 10 + R() * 22, c: cols[(R() * cols.length) | 0], ph: R() * TAU, fl: R() < 0.08 ? ['#ffffff', '#fff176', '#f48fb1', '#ce93d8'][(R() * 4) | 0] : null }); },
        step(L, dt) { L.t = (L.t || 0) + dt; },
        draw(ctx, L) {
            const base = L.H * 0.95, t = L.t || 0;
            ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
            for (const g of L.items) {
                const sway = Math.sin(t * 0.03 + g.x * 0.01 + g.ph) * 4 + Math.sin(t * 0.011 + g.x * 0.003) * 3;
                ctx.strokeStyle = tint(L, g.c); ctx.beginPath(); ctx.moveTo(g.x, base + 6); ctx.quadraticCurveTo(g.x + sway * 0.4, base - g.h * 0.5, g.x + sway, base - g.h); ctx.stroke();
                if (g.fl) { ctx.fillStyle = g.fl; ctx.beginPath(); ctx.arc(g.x + sway, base - g.h, 2.6, 0, TAU); ctx.fill(); }
            }
        }
    };
    K.kelpSway = {
        f: 0.7,
        spawn(L) { for (let x = L.x0; x < L.x1; x += 40 + R() * 70) L.items.push({ x, h: 60 + R() * 130, c: ['#1e6a4a', '#2a8a5a', '#145a3a', '#3a7a3a'][(R() * 4) | 0], ph: R() * TAU }); },
        step(L, dt) { L.t = (L.t || 0) + dt; },
        draw(ctx, L) {
            const base = L.H * 0.97, t = L.t || 0;
            ctx.lineCap = 'round';
            for (const k of L.items) {
                ctx.strokeStyle = tint(L, k.c); ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(k.x, base);
                for (let i = 1; i <= 8; i++) { const u = i / 8; ctx.lineTo(k.x + Math.sin(t * 0.025 + k.ph + u * 3) * 14 * u, base - k.h * u); }
                ctx.stroke();
                ctx.fillStyle = tint(L, k.c);
                for (let i = 2; i < 8; i += 2) { const u = i / 8, x = k.x + Math.sin(t * 0.025 + k.ph + u * 3) * 14 * u, y = base - k.h * u; ctx.beginPath(); ctx.ellipse(x + 5, y, 6, 2.4, 0.5 + Math.sin(t * 0.03 + i) * 0.3, 0, TAU); ctx.fill(); }
            }
        }
    };
    K.butterflies = {
        f: 0.72,
        spawn(L, o) { for (let i = 0; i < 10; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.6 + R() * 0.3), vx: (R() - 0.5) * 0.8, vy: 0, ph: R() * TAU, c: (o && o.cols || ['#ffca28', '#ff7043', '#ffffff', '#4fc3f7', '#f48fb1'])[i % 5], glowing: o && o.glow }); },
        step(L, dt) { for (const b of L.items) { b.ph += 0.35 * dt; b.vx += (R() - 0.5) * 0.08 * dt; b.vx = Math.max(-1, Math.min(1, b.vx)); b.vy += (R() - 0.5) * 0.08 * dt; b.vy *= 0.96; b.x += b.vx * dt; b.y += b.vy * dt; b.y = Math.max(L.H * 0.45, Math.min(L.H * 0.92, b.y)); wrapX(b, L); } },
        draw(ctx, L) { for (const b of L.items) { const f = Math.abs(Math.sin(b.ph)); if (b.glowing) glow(ctx, b.x, b.y, 10, '200,160,255', 0.5); ctx.fillStyle = tint(L, b.c); for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(b.x + sgn * 3 * f, b.y - 1, 3.5 * f + 0.6, 2.6, sgn * 0.5, 0, TAU); ctx.fill(); } ctx.fillStyle = '#212121'; ctx.fillRect(b.x - 0.5, b.y - 2.5, 1, 4); } }
    };
    K.deer = {
        f: 0.46,
        spawn(L, o) { for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), dir: R() < 0.5 ? -1 : 1, walk: 0, graze: R() * 200, ph: R() * TAU, s: 0.9 + R() * 0.3, antlers: R() < 0.5 }); L.col = o && o.col || '#3e2a1c'; },
        step(L, dt) { for (const d of L.items) { d.ph += 0.1 * dt; if (d.graze > 0) { d.graze -= dt; if (d.graze <= 0) d.walk = 80 + R() * 160; } else { d.walk -= dt; d.x += d.dir * 0.35 * dt; if (d.walk <= 0) { d.graze = 120 + R() * 260; if (R() < 0.3) d.dir *= -1; } } wrapX(d, L); } },
        draw(ctx, L) {
            const base = L.H * 0.9;
            for (const d of L.items) {
                const s = d.s * 1.4, walking = d.graze <= 0, head = walking ? 0 : Math.sin(d.ph * 0.3) * 3 + 6, leg = walking ? Math.sin(d.ph * 1.5) * 4 : 0;
                ctx.save(); ctx.translate(d.x, base); ctx.scale(d.dir * s, s); ctx.fillStyle = tint(L, L.col); ctx.strokeStyle = tint(L, L.col); ctx.lineCap = 'round';
                ctx.beginPath(); ctx.ellipse(0, -18, 12, 6, 0, 0, TAU); ctx.fill();
                ctx.lineWidth = 2; for (const [lx, sgn] of [[-8, 1], [-5, -1], [7, 1], [9, -1]]) { ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx + leg * sgn, 0); ctx.stroke(); }
                ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(9, -20); ctx.lineTo(14, -30 + head); ctx.stroke();
                ctx.beginPath(); ctx.ellipse(17, -31 + head, 4, 2.4, 0.3, 0, TAU); ctx.fill();
                if (d.antlers) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, -33 + head); ctx.lineTo(12, -41 + head); ctx.lineTo(9, -44 + head); ctx.moveTo(12, -39 + head); ctx.lineTo(16, -43 + head); ctx.stroke(); }
                ctx.restore();
            }
        }
    };
    K.reindeer = { f: 0.5, spawn(L) { K.deer.spawn(L, { col: '#5a3a24' }); for (const d of L.items) d.antlers = true; }, step: (L, dt) => K.deer.step(L, dt), draw: (ctx, L) => K.deer.draw(ctx, L) };
    K.penguins = {
        f: 0.72,
        spawn(L) { for (let i = 0; i < 6; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), dir: R() < 0.5 ? -1 : 1, slide: 0, ph: R() * TAU, wait: R() * 200 }); },
        step(L, dt) { for (const p of L.items) { p.ph += 0.2 * dt; if (p.slide > 0) { p.slide -= dt; p.x += p.dir * 2.4 * dt; } else if (p.wait > 0) p.wait -= dt; else { p.x += p.dir * 0.3 * dt; if (R() < 0.004 * dt) p.slide = 50 + R() * 60; if (R() < 0.003 * dt) { p.wait = 80 + R() * 160; if (R() < 0.4) p.dir *= -1; } } wrapX(p, L); } },
        draw(ctx, L) {
            const base = L.H * 0.95;
            for (const p of L.items) {
                ctx.save(); ctx.translate(p.x, base); ctx.scale(p.dir, 1);
                if (p.slide > 0) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -5, 12, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(1, -3, 9, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff9800'; ctx.fillRect(11, -6, 4, 2); }
                else { const w = Math.sin(p.ph) * 0.15; ctx.rotate(p.wait > 0 ? 0 : w); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -10, 6, 10, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(1.5, -9, 4, 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff9800'; ctx.fillRect(5, -16, 3.5, 1.6); ctx.fillRect(-3, -1, 3, 1.4); ctx.fillRect(1, -1, 3, 1.4); }
                ctx.restore();
            }
        }
    };
    K.tumbleweed = {
        f: 0.76,
        spawn(L) { for (let i = 0; i < 2; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: 0, vy: 0, rot: 0, r: 9 + R() * 6 }); },
        step(L, dt) { for (const w of L.items) { w.x += 2 * dt; w.rot += 0.12 * dt; w.vy += 0.3 * dt; w.y += w.vy * dt; if (w.y > 0) { w.y = 0; w.vy = -(1.5 + R() * 3); } wrapX(w, L, 60); } },
        draw(ctx, L) { const base = L.H * 0.94; ctx.strokeStyle = tint(L, '#8d6e45'); ctx.lineWidth = 1; for (const w of L.items) { ctx.save(); ctx.translate(w.x, base - w.r + w.y); ctx.rotate(w.rot); for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.ellipse(0, 0, w.r, w.r * 0.4, k * 0.45, 0, TAU); ctx.stroke(); } ctx.restore(); } }
    };
    K.dustDevil = {
        f: 0.4,
        spawn(L) { L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), v: 0.4, ph: 0, life: 0 }); },
        step(L, dt) { const d = L.items[0]; d.ph += 0.2 * dt; d.x += d.v * dt; d.life += dt; if (d.life > 900) { d.life = 0; d.x = L.x0 + R() * (L.x1 - L.x0); } },
        draw(ctx, L) {
            const d = L.items[0], base = L.H * 0.9, a = Math.min(1, d.life / 80, (900 - d.life) / 80) * 0.35;
            for (let i = 0; i < 12; i++) { const u = i / 12, y = base - u * 140, r = 6 + u * 30; ctx.strokeStyle = tint(L, '#c8a070', a * (1 - u * 0.5)); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(d.x + Math.sin(d.ph * 0.3 + u * 4) * 10 * u, y, r, r * 0.25, 0, d.ph + u * 3, d.ph + u * 3 + 4); ctx.stroke(); }
        }
    };
    K.gumdropHoppers = {
        f: 0.74,
        spawn(L) { for (let i = 0; i < 7; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: 0, vy: 0, dir: R() < 0.5 ? -1 : 1, c: ['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff'][i % 5], sq: 0, wait: R() * 60 }); },
        step(L, dt) { for (const g of L.items) { if (g.y < 0 || g.vy < 0) { g.vy += 0.35 * dt; g.y += g.vy * dt; g.x += g.dir * 1.2 * dt; if (g.y >= 0) { g.y = 0; g.vy = 0; g.sq = 1; g.wait = 20 + R() * 60; } } else if ((g.wait -= dt) <= 0) { g.vy = -(4 + R() * 3); if (R() < 0.2) g.dir *= -1; } g.sq *= 0.85; wrapX(g, L); } },
        draw(ctx, L) { const base = L.H * 0.95; for (const g of L.items) { const sx = 1 + g.sq * 0.4, sy = 1 - g.sq * 0.3 + Math.min(0, g.vy) * -0.02; ctx.save(); ctx.translate(g.x, base + g.y); ctx.scale(sx, sy); ctx.fillStyle = tint(L, g.c); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-10, -14, 0, -14); ctx.quadraticCurveTo(10, -14, 9, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#212121'; ctx.fillRect(-3.5, -9, 1.8, 2.4); ctx.fillRect(2, -9, 1.8, 2.4); ctx.restore(); } }
    };
    K.crabs = {
        f: 0.8,
        spawn(L) { for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), dir: R() < 0.5 ? -1 : 1, ph: R() * TAU, wait: 0 }); },
        step(L, dt) { for (const c of L.items) { c.ph += 0.4 * dt; if (c.wait > 0) c.wait -= dt; else { c.x += c.dir * 0.9 * dt; if (R() < 0.005 * dt) { c.wait = 40 + R() * 100; c.dir = R() < 0.5 ? -1 : 1; } } wrapX(c, L); } },
        draw(ctx, L) { const base = L.H * 0.955; for (const c of L.items) { ctx.save(); ctx.translate(c.x, base); ctx.fillStyle = tint(L, '#e5533a'); ctx.strokeStyle = tint(L, '#c0392b'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, -5, 7, 4.5, 0, 0, TAU); ctx.fill(); const l = c.wait > 0 ? 0 : Math.sin(c.ph) * 2; for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(s * 4, -4); ctx.lineTo(s * (8 + k * 2), -1 + (k % 2 ? l : -l)); ctx.stroke(); } ctx.beginPath(); ctx.arc(s * 9, -9, 2.4, 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff'; ctx.fillRect(-2.5, -11, 1.6, 1.6); ctx.fillRect(1, -11, 1.6, 1.6); ctx.restore(); } }
    };

    // --- sea ---
    K.fishSchool = {
        f: 0.32,
        spawn(L) { for (let g = 0; g < 2; g++) { const school = { cx: L.x0 + R() * (L.x1 - L.x0), cy: L.H * (0.3 + R() * 0.35), v: (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.3), ph: R() * TAU, fish: [] }; for (let i = 0; i < 22; i++) school.fish.push({ a: R() * TAU, r: 10 + R() * 40, s: 2.5 + R() * 2 }); L.items.push(school); } L.col = ['#4fc3f7', '#ffb74d', '#cfd8dc'][(R() * 3) | 0]; },
        step(L, dt) { for (const s of L.items) { s.cx += s.v * dt; s.ph += 0.02 * dt; s.cy += Math.sin(s.ph) * 0.2 * dt; for (const f of s.fish) f.a += 0.02 * dt; if (s.cx > L.x1 + 200) s.cx = L.x0 - 200; if (s.cx < L.x0 - 200) s.cx = L.x1 + 200; } },
        draw(ctx, L) { for (const s of L.items) { ctx.fillStyle = tint(L, L.col, 0.85); for (const f of s.fish) { const x = s.cx + Math.cos(f.a) * f.r * 1.6, y = s.cy + Math.sin(f.a * 1.3) * f.r * 0.5; ctx.save(); ctx.translate(x, y); ctx.scale(s.v < 0 ? -1 : 1, 1); ctx.beginPath(); ctx.ellipse(0, 0, f.s * 1.4, f.s * 0.6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-f.s, 0); ctx.lineTo(-f.s * 2, -f.s * 0.6); ctx.lineTo(-f.s * 2, f.s * 0.6); ctx.fill(); ctx.restore(); } } }
    };
    K.whale = {
        f: 0.08,
        spawn(L, o) { L.items.push({ x: L.x0 - 300, y: L.H * (0.3 + R() * 0.2), ph: 0, v: 0.25, space: o && o.space }); },
        step(L, dt) { const w = L.items[0]; w.x += w.v * dt; w.ph += 0.015 * dt; if (w.x > L.x1 + 400) { w.x = L.x0 - 400; w.y = L.H * (0.3 + R() * 0.2); } },
        draw(ctx, L) {
            const w = L.items[0], t = Math.sin(w.ph) * 10;
            ctx.save(); ctx.translate(w.x, w.y + Math.sin(w.ph * 0.5) * 8);
            if (w.space) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; }
            ctx.fillStyle = w.space ? 'rgba(160,190,255,0.8)' : tint(L, '#0e2236');
            ctx.beginPath(); ctx.moveTo(110, 0); ctx.quadraticCurveTo(100, -34, 30, -34); ctx.quadraticCurveTo(-60, -30, -120, -4 + t * 0.3); ctx.lineTo(-150, -26 + t); ctx.lineTo(-146, 2 + t * 0.5); ctx.lineTo(-156, 24 + t); ctx.lineTo(-120, 6 + t * 0.3); ctx.quadraticCurveTo(-40, 28, 40, 24); ctx.quadraticCurveTo(100, 20, 110, 0); ctx.fill();
            ctx.beginPath(); ctx.moveTo(30, 18); ctx.quadraticCurveTo(10, 40 + t * 0.5, -10, 44 + t * 0.5); ctx.quadraticCurveTo(10, 26, 20, 16); ctx.fill();
            if (w.space) for (let i = 0; i < 10; i++) glow(ctx, -100 + i * 22, -10 + Math.sin(i * 2) * 10, 6, '220,230,255', 0.8);
            ctx.restore();
        }
    };
    K.spaceWhale = { f: 0.08, spawn(L) { K.whale.spawn(L, { space: true }); }, step: (L, dt) => K.whale.step(L, dt), draw: (ctx, L) => K.whale.draw(ctx, L) };
    K.turtle = {
        f: 0.4,
        spawn(L) { L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.35 + R() * 0.3), ph: 0 }); },
        step(L, dt) { for (const t of L.items) { t.x += 0.35 * dt; t.ph += 0.05 * dt; t.y += Math.sin(t.ph * 0.3) * 0.1 * dt; wrapX(t, L, 100); } },
        draw(ctx, L) { for (const t of L.items) { const fl = Math.sin(t.ph) * 0.6; ctx.save(); ctx.translate(t.x, t.y); ctx.fillStyle = tint(L, '#4e7a3a'); for (const [fx, fy, s] of [[8, -6, 1], [8, 6, -1], [-10, -5, 1], [-10, 5, -1]]) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(s * (0.5 + fl)); ctx.beginPath(); ctx.ellipse(0, s * 6, 3, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); } ctx.beginPath(); ctx.ellipse(18, 0, 6, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = tint(L, '#6b4a2a'); ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = tint(L, '#3e2a18'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke(); ctx.restore(); } }
    };
    K.manta = {
        f: 0.24,
        spawn(L) { for (let i = 0; i < 2; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.25 + R() * 0.3), ph: R() * TAU, v: 0.45 + R() * 0.2 }); },
        step(L, dt) { for (const m of L.items) { m.x += m.v * dt; m.ph += 0.04 * dt; m.y += Math.sin(m.ph * 0.5) * 0.25 * dt; wrapX(m, L, 120); } },
        draw(ctx, L) { for (const m of L.items) { const f = Math.sin(m.ph) * 12; ctx.fillStyle = tint(L, '#1a3448'); ctx.beginPath(); ctx.moveTo(m.x + 26, m.y); ctx.quadraticCurveTo(m.x, m.y - 30 - f, m.x - 18, m.y - 38 - f); ctx.quadraticCurveTo(m.x - 10, m.y, m.x - 18, m.y + 38 + f); ctx.quadraticCurveTo(m.x, m.y + 30 + f, m.x + 26, m.y); ctx.fill(); ctx.strokeStyle = tint(L, '#1a3448'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.x - 12, m.y); ctx.quadraticCurveTo(m.x - 40, m.y + Math.sin(m.ph * 2) * 6, m.x - 60, m.y); ctx.stroke(); } }
    };
    K.jellies = {
        f: 0.28,
        spawn(L) { for (let i = 0; i < 6; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.2 + R() * 0.7), ph: R() * TAU, s: 12 + R() * 12, c: ['150,120,255', '120,220,255', '255,140,220'][i % 3] }); },
        step(L, dt) { for (const j of L.items) { j.ph += 0.04 * dt; j.y -= (0.15 + Math.max(0, Math.sin(j.ph)) * 0.5) * dt; j.x += Math.sin(j.ph * 0.3) * 0.15 * dt; if (j.y < -60) { j.y = L.H + 60; j.x = L.x0 + R() * (L.x1 - L.x0); } } },
        draw(ctx, L) { for (const j of L.items) { const p = 1 + 0.18 * Math.sin(j.ph); glow(ctx, j.x, j.y, j.s * 2.4, j.c, 0.35); ctx.fillStyle = `rgba(${j.c},0.45)`; ctx.beginPath(); ctx.ellipse(j.x, j.y, j.s * p, j.s * 0.75 / p, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = `rgba(${j.c},0.4)`; ctx.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(j.x + k * j.s * 0.25, j.y); ctx.quadraticCurveTo(j.x + k * j.s * 0.25 + Math.sin(j.ph * 2 + k) * 5, j.y + j.s, j.x + k * j.s * 0.2, j.y + j.s * 2); ctx.stroke(); } } }
    };

    // --- fire and stone ---
    K.volcano = {
        f: 0.09,
        spawn(L) { L.items.push({ x: L.W * (0.15 + R() * 0.7), y: L.H * 0.6, next: 60 + R() * 200, rocks: [], smoke: [] }); },
        step(L, dt) {
            const v = L.items[0];
            if ((v.next -= dt) <= 0) { v.next = 220 + R() * 400; for (let i = 0; i < 14; i++) v.rocks.push({ x: v.x, y: v.y, vx: (R() - 0.5) * 5, vy: -(4 + R() * 5), life: 120 }); v.flash = 1; }
            if (R() < 0.3 * dt) v.smoke.push({ x: v.x + (R() - 0.5) * 10, y: v.y, r: 10 + R() * 10, life: 260 });
            for (const r of v.rocks) { r.vy += 0.06 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt; }
            for (const s of v.smoke) { s.y -= 0.4 * dt; s.x += 0.15 * dt; s.r += 0.12 * dt; s.life -= dt; }
            v.rocks = v.rocks.filter(r => r.life > 0); v.smoke = v.smoke.filter(s => s.life > 0);
            v.flash = (v.flash || 0) * Math.pow(0.95, dt);
        },
        draw(ctx, L) {
            const v = L.items[0];
            ctx.fillStyle = tint(L, '#2a1010'); ctx.beginPath(); ctx.moveTo(v.x - 160, v.y + 140); ctx.lineTo(v.x - 22, v.y); ctx.lineTo(v.x + 22, v.y); ctx.lineTo(v.x + 160, v.y + 140); ctx.fill();
            glow(ctx, v.x, v.y, 60 + v.flash * 80, '255,120,30', 0.35 + v.flash * 0.6);
            for (const s of v.smoke) { ctx.fillStyle = `rgba(60,40,40,${0.25 * Math.min(1, s.life / 80)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
            for (const r of v.rocks) glow(ctx, r.x, r.y, 6, '255,170,60', Math.min(1, r.life / 40));
        }
    };
    K.lavaBubbles = {
        f: 0.82,
        spawn(L) { for (let i = 0; i < 10; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), r: 0, max: 5 + R() * 10, grow: 0.05 + R() * 0.08, pop: 0 }); },
        step(L, dt) { for (const b of L.items) { if (b.pop > 0) { b.pop -= dt; if (b.pop <= 0) { b.r = 0; b.x = L.x0 + R() * (L.x1 - L.x0); } } else { b.r += b.grow * dt; if (b.r >= b.max) b.pop = 16; } } },
        draw(ctx, L) { const base = L.H * 0.955; for (const b of L.items) { if (b.pop > 0) { const k = 1 - b.pop / 16; ctx.strokeStyle = `rgba(255,200,90,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, base, b.max * (1 + k), Math.PI, 0); ctx.stroke(); for (let i = 0; i < 4; i++) glow(ctx, b.x + Math.cos(i * 1.4) * k * 18, base - k * 20 - Math.sin(i * 2) * 6, 3, '255,180,60', 1 - k); } else { ctx.fillStyle = 'rgba(255,140,40,0.85)'; ctx.beginPath(); ctx.arc(b.x, base, b.r, Math.PI, 0); ctx.fill(); glow(ctx, b.x, base - b.r * 0.5, b.r * 2, '255,150,50', 0.4); } } }
    };
    K.torches = {
        f: 0.34,
        spawn(L) { for (let x = L.x0 + 60; x < L.x1; x += 140 + R() * 160) L.items.push({ x, y: L.H * (0.62 + R() * 0.12), ph: R() * TAU }); },
        step(L, dt) { for (const t of L.items) t.ph += (0.2 + R() * 0.2) * dt; },
        draw(ctx, L) { for (const t of L.items) { const fl = 0.75 + 0.25 * Math.sin(t.ph) * Math.sin(t.ph * 2.3); ctx.fillStyle = tint(L, '#2a1a10'); ctx.fillRect(t.x - 1.5, t.y, 3, 16); glow(ctx, t.x, t.y - 4, 26 * fl, '255,150,50', 0.55 * fl); ctx.fillStyle = `rgba(255,${190 + 40 * fl | 0},90,0.95)`; ctx.beginPath(); ctx.moveTo(t.x - 3, t.y); ctx.quadraticCurveTo(t.x - 3, t.y - 6 * fl, t.x + Math.sin(t.ph) * 1.5, t.y - 11 * fl); ctx.quadraticCurveTo(t.x + 3, t.y - 6 * fl, t.x + 3, t.y); ctx.fill(); } }
    };
    K.banners = {
        f: 0.36,
        spawn(L) { for (let x = L.x0 + 80; x < L.x1; x += 220 + R() * 200) L.items.push({ x, y: L.H * (0.5 + R() * 0.12), c: ['#8e1b1b', '#1b3a8e', '#c9a227'][(R() * 3) | 0], ph: R() * TAU }); },
        step(L, dt) { for (const b of L.items) b.ph += 0.06 * dt; },
        draw(ctx, L) { for (const b of L.items) { ctx.fillStyle = tint(L, '#1a1410'); ctx.fillRect(b.x - 1, b.y - 6, 2, 60); ctx.fillStyle = tint(L, b.c); ctx.beginPath(); ctx.moveTo(b.x + 1, b.y - 4); for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(b.x + 1 + u * 34, b.y - 4 + Math.sin(b.ph + u * 4) * 3 * u); } for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(b.x + 1 + u * 34, b.y + 16 + Math.sin(b.ph + u * 4 + 0.4) * 3 * u); } ctx.fill(); } }
    };
    K.crystalPulse = {
        f: 0.4,
        spawn(L) { for (let i = 0; i < 16; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.3 + R() * 0.6), ph: R() * TAU, c: ['120,220,255', '200,150,255', '140,255,220'][i % 3], r: 8 + R() * 18 }); },
        step(L, dt) { for (const c of L.items) c.ph += 0.03 * dt; },
        draw(ctx, L) { for (const c of L.items) { const a = Math.max(0, Math.sin(c.ph)); glow(ctx, c.x, c.y, c.r * (1 + a), c.c, a * 0.6); if (a > 0.92) { ctx.strokeStyle = `rgba(255,255,255,${(a - 0.92) * 10})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x - 6, c.y); ctx.lineTo(c.x + 6, c.y); ctx.moveTo(c.x, c.y - 6); ctx.lineTo(c.x, c.y + 6); ctx.stroke(); } } }
    };

    // --- magic ---
    K.floatingRocks = {
        f: 0.22,
        spawn(L) { for (let i = 0; i < 6; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.15 + R() * 0.45), w: 20 + R() * 40, ph: R() * TAU, c: ['160,110,255', '110,220,255', '255,140,220'][i % 3] }); },
        step(L, dt) { for (const r of L.items) { r.ph += 0.015 * dt; r.x += 0.06 * dt; wrapX(r, L, 80); } },
        draw(ctx, L) { for (const r of L.items) { const y = r.y + Math.sin(r.ph) * 10; ctx.fillStyle = tint(L, '#2a1e44'); ctx.beginPath(); ctx.moveTo(r.x - r.w / 2, y); ctx.lineTo(r.x + r.w / 2, y); ctx.lineTo(r.x + r.w * 0.2, y + r.w * 0.7); ctx.lineTo(r.x - r.w * 0.1, y + r.w * 0.9); ctx.closePath(); ctx.fill(); glow(ctx, r.x, y - 4, r.w * 0.6, r.c, 0.3 + 0.2 * Math.sin(r.ph * 3)); ctx.fillStyle = `rgba(${r.c},0.8)`; ctx.beginPath(); ctx.moveTo(r.x - 3, y); ctx.lineTo(r.x, y - 12); ctx.lineTo(r.x + 3, y); ctx.fill(); for (let k = 0; k < 3; k++) glow(ctx, r.x + Math.cos(r.ph * 4 + k * 2) * r.w * 0.7, y + Math.sin(r.ph * 4 + k * 2) * 8, 3, r.c, 0.8); } }
    };
    K.runeRings = {
        f: 0.14,
        spawn(L) {
            // Arcane Void always has at least four portal rings, spaced across
            // the arena so they read as a backdrop motif instead of a cluster.
            const xs = [0.14, 0.38, 0.62, 0.86];
            for (const x of xs) L.items.push({ x: L.W * x + (R() - 0.5) * 48, y: L.H * (0.2 + R() * 0.2), r: 40 + R() * 40, a: R() * TAU, v: (R() < 0.5 ? -1 : 1) * (0.004 + R() * 0.006) });
        },
        step(L, dt) { for (const r of L.items) r.a += r.v * dt; },
        draw(ctx, L) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const r of L.items) { ctx.strokeStyle = 'rgba(190,140,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.8, 0, TAU); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = r.a + k * TAU / 8; ctx.save(); ctx.translate(r.x + Math.cos(a) * r.r * 0.9, r.y + Math.sin(a) * r.r * 0.9); ctx.rotate(a); ctx.strokeStyle = 'rgba(220,180,255,0.7)'; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, 3); ctx.moveTo(-3, 3); ctx.lineTo(0, -4); ctx.stroke(); ctx.restore(); } } ctx.restore(); }
    };

    // --- city ---
    K.flyingCars = {
        f: 0.32,
        spawn(L) { for (let lane = 0; lane < 3; lane++) { const y = L.H * (0.28 + lane * 0.12), dir = lane % 2 ? -1 : 1; for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y, dir, v: 2 + R() * 2 + lane * 0.5, c: ['255,60,140', '0,229,255', '255,200,80'][(R() * 3) | 0] }); } },
        step(L, dt) { for (const c of L.items) { c.x += c.dir * c.v * dt; wrapX(c, L, 100); } },
        draw(ctx, L) { for (const c of L.items) { ctx.fillStyle = tint(L, '#151225'); ctx.beginPath(); ctx.ellipse(c.x, c.y, 13, 4, 0, 0, TAU); ctx.fill(); ctx.fillRect(c.x - 6, c.y - 6, 12, 4); const fx = c.x + c.dir * 13, bx = c.x - c.dir * 13; glow(ctx, fx, c.y, 10, '255,255,230', 0.8); glow(ctx, bx, c.y, 8, '255,40,60', 0.8); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(bx, 0, bx - c.dir * 70, 0); g.addColorStop(0, `rgba(${c.c},0.5)`); g.addColorStop(1, `rgba(${c.c},0)`); ctx.fillStyle = g; ctx.fillRect(Math.min(bx, bx - c.dir * 70), c.y - 1.5, 70, 3); ctx.restore(); } }
    };
    K.drones = {
        f: 0.42,
        spawn(L) { for (let i = 0; i < 7; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.12 + R() * 0.5), tx: 0, ty: 0, ph: R() * TAU }); for (const d of L.items) { d.tx = d.x; d.ty = d.y; } },
        step(L, dt) { for (const d of L.items) { d.ph += 0.1 * dt; if (Math.hypot(d.tx - d.x, d.ty - d.y) < 4) { d.tx = Math.max(L.x0, Math.min(L.x1, d.x + (R() - 0.5) * 300)); d.ty = L.H * (0.12 + R() * 0.5); } d.x += (d.tx - d.x) * 0.01 * dt; d.y += (d.ty - d.y) * 0.01 * dt; } },
        draw(ctx, L) { for (const d of L.items) { ctx.fillStyle = tint(L, '#1a1a24'); ctx.fillRect(d.x - 6, d.y - 1.5, 12, 3); ctx.fillRect(d.x - 2, d.y - 3, 4, 6); const blink = Math.sin(d.ph) > 0.6; glow(ctx, d.x - 6, d.y, 5, '255,50,60', blink ? 0.9 : 0.2); glow(ctx, d.x + 6, d.y, 5, '60,255,140', blink ? 0.2 : 0.9); ctx.strokeStyle = 'rgba(200,220,255,0.3)'; ctx.beginPath(); ctx.moveTo(d.x - 10, d.y - 3); ctx.lineTo(d.x - 2, d.y - 3); ctx.moveTo(d.x + 2, d.y - 3); ctx.lineTo(d.x + 10, d.y - 3); ctx.stroke(); } }
    };
    K.billboards = {
        f: 0.3,
        spawn(L) { for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + 100 + R() * (L.x1 - L.x0 - 200), y: L.H * (0.3 + R() * 0.25), w: 60 + R() * 50, h: 26 + R() * 16, c: ['255,45,149', '0,229,255', '170,255,0', '255,200,60'][i % 4], ph: R() * TAU, glitch: 0 }); },
        step(L, dt) { for (const b of L.items) { b.ph += 0.05 * dt; if (b.glitch > 0) b.glitch -= dt; else if (R() < 0.004 * dt) b.glitch = 12 + R() * 20; } },
        draw(ctx, L) {
            for (const b of L.items) {
                const on = b.glitch > 0 ? (R() < 0.5 ? 0.2 : 1) : 0.85 + 0.15 * Math.sin(b.ph * 3);
                ctx.fillStyle = tint(L, '#0c0a18'); ctx.fillRect(b.x - b.w / 2 - 3, b.y - b.h / 2 - 3, b.w + 6, b.h + 6); ctx.fillRect(b.x - 1.5, b.y + b.h / 2, 3, 40);
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = `rgba(${b.c},${on})`; ctx.lineWidth = 2; ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
                ctx.fillStyle = `rgba(${b.c},${0.18 * on})`; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
                // scrolling bars of "text"
                const off = (b.ph * 12) % (b.w + 30);
                ctx.fillStyle = `rgba(${b.c},${0.8 * on})`;
                for (let k = 0; k < 4; k++) { const x = b.x - b.w / 2 + ((off + k * 22) % (b.w - 12)) + 4; ctx.fillRect(x, b.y - 3, 10, 6); }
                ctx.restore();
                glow(ctx, b.x, b.y, b.w * 0.7, b.c, 0.2 * on);
            }
        }
    };
    K.train = {
        f: 0.36,
        spawn(L) { L.items.push({ x: L.x0 - 600, y: L.H * 0.58, wait: 200 }); },
        step(L, dt) { const t = L.items[0]; if (t.wait > 0) { t.wait -= dt; return; } t.x += 6 * dt; if (t.x > L.x1 + 700) { t.x = L.x0 - 700; t.wait = 300 + R() * 500; } },
        draw(ctx, L) {
            const t = L.items[0];
            ctx.fillStyle = tint(L, '#0a0a14'); ctx.fillRect(L.x0 - 200, t.y + 10, L.x1 - L.x0 + 400, 5);
            if (t.wait > 0) return;
            for (let c = 0; c < 6; c++) { const x = t.x - c * 92; ctx.fillStyle = tint(L, '#1c1a2c'); ctx.fillRect(x - 44, t.y - 12, 88, 22); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,160,0.6)'; for (let w = 0; w < 6; w++) ctx.fillRect(x - 38 + w * 13, t.y - 6, 8, 6); ctx.restore(); }
            glow(ctx, t.x + 46, t.y, 30, '255,255,220', 0.7);
        }
    };

    // --- haunted ---
    K.ghosts = {
        f: 0.38,
        spawn(L) { for (let i = 0; i < 5; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.3 + R() * 0.45), ph: R() * TAU, v: (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.3), s: 0.8 + R() * 0.6 }); },
        step(L, dt) { for (const g of L.items) { g.ph += 0.03 * dt; g.x += g.v * dt; wrapX(g, L); } },
        draw(ctx, L) {
            for (const g of L.items) {
                const a = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(g.ph * 0.7)), y = g.y + Math.sin(g.ph) * 10, s = g.s * 14;
                ctx.save(); ctx.translate(g.x, y); ctx.scale(g.v < 0 ? -1 : 1, 1);
                glow(ctx, 0, 0, s * 2.4, '200,210,255', a * 0.6);
                ctx.fillStyle = `rgba(235,240,255,${a})`; ctx.beginPath(); ctx.moveTo(-s, s);
                ctx.lineTo(-s, -s * 0.2); ctx.arc(0, -s * 0.2, s, Math.PI, 0); ctx.lineTo(s, s);
                for (let k = 3; k >= 0; k--) ctx.quadraticCurveTo(-s + (k + 0.5) * s * 0.5, s + Math.sin(g.ph * 3 + k) * 4 + 5, -s + k * s * 0.5, s);
                ctx.fill();
                ctx.fillStyle = `rgba(20,20,40,${a * 1.4})`; ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.3, s * 0.14, s * 0.22, 0, 0, TAU); ctx.ellipse(s * 0.3, -s * 0.3, s * 0.14, s * 0.22, 0, 0, TAU); ctx.fill();
                ctx.restore();
            }
        }
    };
    K.jackLanterns = {
        f: 0.6,
        spawn(L) { for (let x = L.x0 + 40; x < L.x1; x += 120 + R() * 140) L.items.push({ x, y: L.H * (0.86 + R() * 0.06), ph: R() * TAU, s: 10 + R() * 6 }); },
        step(L, dt) { for (const j of L.items) j.ph += (0.15 + R() * 0.25) * dt; },
        draw(ctx, L) { for (const j of L.items) { const fl = 0.7 + 0.3 * Math.sin(j.ph) * Math.sin(j.ph * 1.7); glow(ctx, j.x, j.y - j.s * 0.6, j.s * 3 * fl, '255,150,40', 0.5 * fl); ctx.fillStyle = '#e65100'; ctx.beginPath(); ctx.ellipse(j.x, j.y - j.s * 0.6, j.s, j.s * 0.75, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(255,${200 + 50 * fl | 0},90,${fl})`; ctx.beginPath(); ctx.moveTo(j.x - j.s * 0.5, j.y - j.s * 0.8); ctx.lineTo(j.x - j.s * 0.25, j.y - j.s * 1.05); ctx.lineTo(j.x - j.s * 0.1, j.y - j.s * 0.8); ctx.moveTo(j.x + j.s * 0.1, j.y - j.s * 0.8); ctx.lineTo(j.x + j.s * 0.25, j.y - j.s * 1.05); ctx.lineTo(j.x + j.s * 0.5, j.y - j.s * 0.8); ctx.fill(); ctx.fillRect(j.x - j.s * 0.5, j.y - j.s * 0.5, j.s, j.s * 0.18); ctx.fillStyle = '#33691e'; ctx.fillRect(j.x - 1, j.y - j.s * 1.45, 2.5, j.s * 0.3); } }
    };
    K.swampBubbles = {
        f: 0.8,
        spawn(L) { K.lavaBubbles.spawn(L); },
        step: (L, dt) => K.lavaBubbles.step(L, dt),
        draw(ctx, L) { const base = L.H * 0.955; for (const b of L.items) { if (b.pop > 0) { const k = 1 - b.pop / 16; ctx.strokeStyle = `rgba(150,220,140,${(1 - k) * 0.6})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(b.x, base, b.max * (1 + k), Math.PI, 0); ctx.stroke(); } else { ctx.strokeStyle = 'rgba(150,220,140,0.55)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(60,90,50,0.6)'; ctx.beginPath(); ctx.arc(b.x, base, b.r, Math.PI, 0); ctx.fill(); ctx.stroke(); } } }
    };

    // --- candy ---
    K.chocoRiver = {
        f: 0.86,
        spawn(L) { for (let i = 0; i < 18; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), y: R(), len: 20 + R() * 40 }); },
        step(L, dt) { L.t = (L.t || 0) + dt; for (const w of L.items) { w.x += 0.6 * dt; wrapX(w, L, 60); } },
        draw(ctx, L) { const base = L.H * 0.96, t = L.t || 0; ctx.fillStyle = 'rgba(90,50,24,0.85)'; ctx.beginPath(); ctx.moveTo(L.x0 - 200, L.H + 200); for (let x = L.x0 - 200; x <= L.x1 + 200; x += 20) ctx.lineTo(x, base + Math.sin(x * 0.02 + t * 0.04) * 3); ctx.lineTo(L.x1 + 200, L.H + 200); ctx.fill(); ctx.strokeStyle = 'rgba(200,140,90,0.6)'; ctx.lineWidth = 1.5; for (const w of L.items) { const y = base + 6 + w.y * 18; ctx.beginPath(); ctx.moveTo(w.x, y); ctx.quadraticCurveTo(w.x + w.len / 2, y - 2, w.x + w.len, y); ctx.stroke(); } }
    };

    // --- Christmas ---
    K.ledStrings = {
        f: 0.92,
        spawn(L) {
            // a few strings sagging between anchors across the top, plus a couple lower down
            let x = L.x0 - 40;
            while (x < L.x1 + 40) { const w = 220 + R() * 160; L.items.push({ x0: x, x1: x + w, y0: L.H * (0.02 + R() * 0.04), y1: L.H * (0.02 + R() * 0.04), sag: 18 + R() * 16, n: Math.round(w / 22), seed: (R() * 5) | 0 }); x += w; }
            for (let i = 0; i < 3; i++) { const x0 = L.x0 + R() * (L.x1 - L.x0), w = 160 + R() * 120, y = L.H * (0.55 + R() * 0.2); L.items.push({ x0, x1: x0 + w, y0: y, y1: y + (R() - 0.5) * 30, sag: 14 + R() * 10, n: Math.round(w / 20), seed: (R() * 5) | 0 }); }
        },
        step(L, dt) { L.t = (L.t || 0) + dt; },
        draw(ctx, L) { for (const s of L.items) BackdropLayers.xmasLights(ctx, s.x0, s.y0, s.x1, s.y1, s.sag, s.n, (L.t || 0) + 1, s.seed, 1.4); }
    };
    K.chimneySmoke = {
        f: 0.3,
        spawn(L, o, bd) {
            L.spots = [];
            const mid = bd && bd.layers.find(l => l.tag === 'mid');
            if (bd && bd.chimneys && mid) { L.f = mid.f; for (const [x, y] of bd.chimneys) L.spots.push({ x: x - mid.mx, y }); }
            else for (let i = 0; i < 5; i++) L.spots.push({ x: L.x0 + R() * (L.x1 - L.x0), y: L.H * (0.62 + R() * 0.12) });
        },
        step(L, dt) { for (const s of L.spots) if (R() < 0.12 * dt) L.items.push({ x: s.x, y: s.y, r: 3 + R() * 3, life: 200 }); for (const p of L.items) { p.y -= 0.35 * dt; p.x += 0.25 * dt + Math.sin(p.life * 0.05) * 0.1; p.r += 0.06 * dt; p.life -= dt; } L.items = L.items.filter(p => p.life > 0); },
        draw(ctx, L) { for (const p of L.items) { ctx.fillStyle = `rgba(220,225,235,${0.35 * Math.min(1, p.life / 80)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } }
    };
    K.carolers = {
        f: 0.66,
        spawn(L) { const x = L.x0 + R() * (L.x1 - L.x0); for (let i = 0; i < 3; i++) L.items.push({ x: x + i * 14, ph: R() * TAU, c: ['#c62828', '#2e7d32', '#1565c0'][i] }); L.notes = []; },
        step(L, dt) { for (const c of L.items) c.ph += 0.05 * dt; if (R() < 0.04 * dt) L.notes.push({ x: L.items[1].x + (R() - 0.5) * 20, y: L.H * 0.88, life: 120, ph: R() * TAU }); for (const n of L.notes) { n.y -= 0.4 * dt; n.ph += 0.05 * dt; n.life -= dt; } L.notes = L.notes.filter(n => n.life > 0); },
        draw(ctx, L) {
            const base = L.H * 0.92;
            for (const c of L.items) { const sw = Math.sin(c.ph) * 1.5; ctx.save(); ctx.translate(c.x, base); ctx.rotate(sw * 0.04); ctx.fillStyle = tint(L, '#263238'); ctx.fillRect(-3, -14, 6, 14); ctx.beginPath(); ctx.arc(0, -18, 4, 0, TAU); ctx.fill(); ctx.fillStyle = tint(L, c.c); ctx.fillRect(-4, -13, 8, 2.5); ctx.fillRect(2, -13, 2.5, 6); ctx.fillStyle = tint(L, '#fafafa'); ctx.fillRect(-3, -23, 6, 2); ctx.restore(); }
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '12px serif'; for (const n of L.notes) { ctx.globalAlpha = Math.min(1, n.life / 40); ctx.fillText('♪', n.x + Math.sin(n.ph) * 6, n.y); } ctx.globalAlpha = 1;
        }
    };
    K.elves = {
        f: 0.68,
        spawn(L) { for (let i = 0; i < 4; i++) L.items.push({ x: L.x0 + R() * (L.x1 - L.x0), dir: R() < 0.5 ? -1 : 1, ph: R() * TAU, c: ['#d32f2f', '#1976d2', '#fbc02d', '#7b1fa2'][i] }); },
        step(L, dt) { for (const e of L.items) { e.ph += 0.25 * dt; e.x += e.dir * 0.8 * dt; wrapX(e, L); } },
        draw(ctx, L) {
            const base = L.H * 0.93;
            for (const e of L.items) {
                const bob = Math.abs(Math.sin(e.ph)) * 2, leg = Math.sin(e.ph) * 3;
                ctx.save(); ctx.translate(e.x, base - bob); ctx.scale(e.dir, 1);
                ctx.strokeStyle = tint(L, '#1b5e20'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-2 - leg, 0); ctx.moveTo(1, -6); ctx.lineTo(2 + leg, 0); ctx.stroke();
                ctx.fillStyle = tint(L, '#2e7d32'); ctx.fillRect(-4, -14, 8, 8);
                ctx.fillStyle = tint(L, '#ffccbc'); ctx.beginPath(); ctx.arc(0, -17, 3.5, 0, TAU); ctx.fill();
                ctx.fillStyle = tint(L, '#2e7d32'); ctx.beginPath(); ctx.moveTo(-4, -19); ctx.lineTo(4, -19); ctx.lineTo(-6, -27); ctx.closePath(); ctx.fill();
                ctx.fillStyle = tint(L, e.c); ctx.fillRect(4, -16, 9, 8); ctx.fillStyle = tint(L, '#ffe082'); ctx.fillRect(7.5, -16, 2, 8); ctx.fillRect(4, -12.5, 9, 1.5);
                ctx.restore();
            }
        }
    };

    // ---------- which scene gets which actors ----------
    const LIFE_BY_NAME = {
        'Golden Meadow': ['flock', 'balloons', 'deer', 'butterflies', 'grassSway'],
        'Autumn Forest': ['flock', 'deer', 'crows', 'grassSway'],
        'Desert Mesas': ['vultures', 'balloons', 'dustDevil', 'tumbleweed'],
        'Dusk Fortress': ['dragon', 'bats', 'banners', 'torches'],
        'Overgrown Ruins': ['flock', 'torches', 'butterflies', 'grassSway'],
        'Volcanic Crag': ['volcano', 'dragon', 'fireBirds', 'lavaBubbles'],
        'Aurora Glacier': ['owls', 'whale', 'penguins'],
        'Frozen Forest': ['owls', 'deer', 'penguins'],
        'Crystal Cavern': ['bats', 'crystalPulse', 'floatingRocks'],
        'Sky Kingdom': ['airship', 'balloons', 'flock', 'windStreaks'],
        'Sunset Skies': ['balloons', 'flock', 'airship'],
        'Storm Isles': ['airship', 'windStreaks', 'crows'],
        'Arcane Void': ['runeRings', 'floatingRocks', 'crystalPulse'],
        'Crystal Garden': ['floatingRocks', 'butterflies', 'crystalPulse'],
        'Nebula Reef': ['spaceWhale', 'jellies', 'floatingRocks'],
        'Neon Downtown': ['flyingCars', 'drones', 'billboards'],
        'Synthwave Horizon': ['flyingCars', 'drones', 'train'],
        'Cyber Rooftops': ['flyingCars', 'billboards', 'drones', 'train'],
        'Molten Core': ['bats', 'fireBirds', 'lavaBubbles'],
        'Obsidian Wastes': ['volcano', 'dragon', 'lavaBubbles'],
        'Inferno Gate': ['fireBirds', 'torches', 'lavaBubbles'],
        'Coral Reef': ['fishSchool', 'turtle', 'kelpSway', 'crabs'],
        'Abyssal Trench': ['whale', 'jellies', 'fishSchool'],
        'Sunken Ruins': ['fishSchool', 'manta', 'kelpSway', 'crabs'],
        'Candy Hills': ['candyBalloons', 'butterflies', 'gumdropHoppers'],
        'Chocolate River': ['candyBalloons', 'gumdropHoppers', 'chocoRiver'],
        'Frosted Night': ['candyBalloons', 'gumdropHoppers', 'crystalPulse'],
        'Graveyard Moon': ['witch', 'crows', 'ghosts'],
        'Pumpkin Hollow': ['witch', 'bats', 'jackLanterns'],
        'Wraith Marsh': ['ghosts', 'crows', 'swampBubbles']
    };
    BackdropLayers.LIFE = K;
    BackdropLayers.LIFE_BY_NAME = LIFE_BY_NAME;
    const lifeOf = (V) => (V.life || LIFE_BY_NAME[V.name] || ['flock', 'grassSway']).filter(k => K[k]);

    // ---------- hooks into the layer engine ----------
    const planBase = BackdropLayers.plan;
    BackdropLayers.plan = function (V) {
        const st = planBase.call(this, V);
        for (const kind of lifeOf(V)) st.push({ k: 'life', f: K[kind].f, kind });
        return st;
    };
    const stepBase = BackdropLayers.addStep;
    BackdropLayers.addStep = function (bd, rng, V, s) {
        if (s.k !== 'life') return stepBase.call(this, bd, rng, V, s);
        const W = bd.W, H = bd.H, xr = s.f * BG_PAN * W + W * BG_WIDE + 80;
        const haze = (V.haze || '200,200,200').split(',').map(Number);
        const L = { f: s.f, tag: 'life', kind: s.kind, items: [], W, H, x0: -xr, x1: W + xr, haze, fog: Math.max(0, 0.6 * (1 - s.f / 0.6)) };
        try { K[s.kind].spawn(L, null, bd); } catch (e) { L.items = []; }
        bd.layers.push(L);
    };
    const animBase = BackdropLayers.anim;
    BackdropLayers.anim = function (ctx, bd, layer) {
        if (layer.tag !== 'life') return animBase.call(this, ctx, bd, layer);
        ctx.save();
        try { K[layer.kind].draw(ctx, layer, bd); } catch (e) { /* a broken actor never stops the frame */ }
        ctx.restore();
    };
    const bdStep = Backdrop.step;
    Backdrop.step = function (bd, dt) {
        bdStep.call(this, bd, dt);
        if (!bd || dt <= 0) return;
        for (const layer of bd.layers) if (layer.tag === 'life') { try { K[layer.kind].step(layer, dt, bd); } catch (e) { /* ignore */ } }
    };
})();
