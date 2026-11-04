// Death effects. Two layers:
//
//  * a general pool of send-offs (classic, confetti, shatter, ink, ash, lightning,
//    fireworks, implosion and the ghost's ascension) used for fists, falls and anything
//    without a signature, and
//  * two large signature effects for every weapon (death-weapons.js), picked when
//    that weapon made the kill.
//
// This file holds the particle kinds they draw with (FX.drawers), the delayed-callback
// queue, the general pool and the picker. Everything advances with FX.step(dt), so slow
// motion slows it too.

// ---------- tiny helpers shared with death-weapons.js ----------

const DFX = {
    rnd: (a, b) => a + Math.random() * (b - a),
    seeded(seed) { let s = (Math.floor(seed * 1e6) % 2147483646) + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; },
    lighten(hex, k) {
        const n = parseInt(String(hex).replace('#', ''), 16) || 0;
        const f = (v) => Math.round(v + (255 - v) * k);
        return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }
};

// ---------- particle kinds ----------

FX.drawers = {
    // Jagged electric arc, redrawn with fresh jitter every frame
    zap(ctx, p, t) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const n = 6, dx = p.x2 - p.x, dy = p.y2 - p.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        const pts = [[p.x, p.y]];
        for (let i = 1; i < n; i++) { const j = (Math.random() - 0.5) * 0.35 * len; pts.push([p.x + dx * i / n + nx * j, p.y + dy * i / n + ny * j]); }
        pts.push([p.x2, p.y2]);
        for (const [w, col, a] of [[7, p.color, 0.25], [3, p.color, 0.8], [1.2, '255,255,255', 1]]) {
            ctx.strokeStyle = `rgba(${col},${a * Math.min(1, t * 2)})`; ctx.lineWidth = w;
            ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        }
    },

    // A real floating stickman: the fighter's spirit, pale and glowing, with angel wings and a halo,
    // rising out of the body and swaying as it goes
    ghost(ctx, p, t) {
        const age = 1 - t, f = p.facing || 1, sc = p.scale || 1.15;
        const rise = 14 + (p.riseMax === undefined ? 250 : p.riseMax) * Math.pow(age, 1.45), sway = Math.sin(age * 9) * (p.riseMax === undefined ? 8 : 2), bob = Math.sin(age * 20) * 2;
        const wv = Math.sin(age * 22);
        const o = (x, y) => ({ x: p.x + sway + x * f * sc, y: p.y - rise + bob + y * sc });
        const J = [o(0, -28), o(0, -19), o(0, 0),
            o(10, -13 + wv * 2), o(21, -21 + wv * 4),            // front arm lifted, waving
            o(-9, -13 - wv), o(-18, -7 + wv * 3),                // back arm
            o(4 + wv, 13), o(-2 + wv * 2, 27),                   // legs trail like a wisp
            o(-3, 14), o(-10 - wv * 2, 27)];
        const a = Math.min(1, age * 7) * Math.min(1, t * 3.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(J[2].x, J[2].y - 10, 4, J[2].x, J[2].y - 10, 90 * sc);
        gl.addColorStop(0, `rgba(210,235,255,${0.35 * a})`); gl.addColorStop(1, 'rgba(210,235,255,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(J[2].x, J[2].y - 10, 90 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a;
        if (p.wings && typeof Player !== 'undefined' && Player.prototype.drawAngelWings) Player.prototype.drawAngelWings.call({ clock: age * 160, grounded: false }, ctx, J);
        StickArt.figure(ctx, J, p.raw ? p.color : DFX.lighten(p.color, 0.72), { alpha: 0.9 * a, facing: f, expression: age < 0.3 ? 'hurt' : (age % 0.4 < 0.03 ? 'blink' : 'normal') });
        if (p.wings && typeof Player !== 'undefined' && Player.prototype.drawAngelWings) Player.prototype.drawHalo.call({ clock: age * 160 }, ctx, J);
        ctx.restore();
    },

    // Straight glowing line: 'grow' draws out from the start, 'bullet' is a moving tracer
    streak(ctx, p, t) {
        const age = 1 - t, dx = p.x2 - p.x, dy = p.y2 - p.y;
        let hx, hy, tx, ty;
        if (p.bullet) { const hu = Math.min(1, age * 1.15), tu = Math.max(0, hu - (p.tail || 0.22)); hx = p.x + dx * hu; hy = p.y + dy * hu; tx = p.x + dx * tu; ty = p.y + dy * tu; }
        else { const u = Math.min(1, age / 0.22); hx = p.x + dx * u; hy = p.y + dy * u; tx = p.x; ty = p.y; }
        const a = p.bullet ? 1 : Math.pow(t, 0.8);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [w, col, al] of [[p.w * 3.2, p.color, 0.22], [p.w, p.color, 0.85], [Math.max(1, p.w * 0.38), '255,255,255', 1]]) {
            ctx.strokeStyle = `rgba(${col},${al * a})`; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        }
        ctx.restore();
    },

    // Expanding shockwave: thick ring, inner echo and radial speed lines
    shock(ctx, p, t) {
        const age = 1 - t, e = 1 - Math.pow(1 - age, 2), r = p.r * e;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${p.color},${0.8 * t})`; ctx.lineWidth = p.w * t + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * t})`; ctx.lineWidth = Math.max(1, p.w * 0.3 * t);
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.88, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < (p.lines || 0); i++) {
            const a = i / p.lines * Math.PI * 2 + 0.3;
            ctx.strokeStyle = `rgba(${p.color},${0.7 * t})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r * 0.72, p.y + Math.sin(a) * r * 0.72); ctx.lineTo(p.x + Math.cos(a) * r * 1.12, p.y + Math.sin(a) * r * 1.12); ctx.stroke();
        }
        ctx.restore();
    },

    // Cracks spreading over the floor (flat) or a pane of glass (not flat)
    cracks(ctx, p, t) {
        const rnd = DFX.seeded(p.seed), grow = Math.min(1, (1 - t) * 6), a = Math.min(1, t * 3);
        ctx.save();
        ctx.translate(p.x, p.y); if (p.flat) ctx.scale(1, 0.3);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const rays = [];
        for (let i = 0; i < p.n; i++) {
            const ang = i / p.n * Math.PI * 2 + rnd() * 0.5, len = p.r * (0.55 + rnd() * 0.45) * grow, pts = [[0, 0]];
            let x = 0, y = 0, aa = ang;
            for (let k = 1; k <= 6; k++) { aa += (rnd() - 0.5) * 0.7; x += Math.cos(aa) * len / 6; y += Math.sin(aa) * len / 6; pts.push([x, y]); }
            rays.push(pts);
        }
        for (const [col, w] of [['rgba(20,14,10,' + 0.85 * a + ')', 3.2], ['rgba(255,225,170,' + 0.5 * a + ')', 1]]) {
            ctx.strokeStyle = col; ctx.lineWidth = w;
            for (const pts of rays) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
        }
        ctx.restore();
    },

    // Flying or falling objects, each drawn pointing along +x (upright ones are drawn upright)
    prop(ctx, p, t) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, t * 4);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        const s = p.size || 40, col = p.color || '#cfd8dc';
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const body = (path, fill, stroke = '#1a1a22') => { path(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.stroke(); };
        switch (p.shape) {
            case 'sword': {
                body(() => { ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.07); ctx.lineTo(s * 0.85, -s * 0.05); ctx.lineTo(s, 0); ctx.lineTo(s * 0.85, s * 0.05); ctx.lineTo(-s * 0.1, s * 0.07); ctx.closePath(); }, '#e6eef7');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -s * 0.015, s * 0.8, s * 0.03);
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.16, -s * 0.2, s * 0.07, s * 0.4); }, '#ffca28');
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.42, -s * 0.045, s * 0.26, s * 0.09); }, '#6d4c41');
                break;
            }
            case 'spear': {
                body(() => { ctx.beginPath(); ctx.rect(-s, -s * 0.025, s * 1.5, s * 0.05); }, '#8d6e63');
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.09); ctx.lineTo(s * 0.95, 0); ctx.lineTo(s * 0.5, s * 0.09); ctx.closePath(); }, '#eceff1');
                break;
            }
            case 'arrow': case 'bolt': {
                const L = p.shape === 'bolt' ? 0.7 : 1;
                body(() => { ctx.beginPath(); ctx.rect(-s * L, -s * 0.02, s * L * 1.7, s * 0.04); }, p.shape === 'bolt' ? '#5d4037' : '#a1887f', '#3e2723');
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.7 * L, -s * 0.07); ctx.lineTo(s * 0.95 * L, 0); ctx.lineTo(s * 0.7 * L, s * 0.07); ctx.closePath(); }, '#cfd8dc');
                ctx.fillStyle = p.shape === 'bolt' ? '#ffffff' : '#ef5350';
                for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-s * L, 0); ctx.lineTo(-s * L * 0.7, k * s * 0.1); ctx.lineTo(-s * L * 0.5, 0); ctx.closePath(); ctx.fill(); }
                break;
            }
            case 'kunai': {
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.9, 0); ctx.lineTo(s * 0.2, -s * 0.13); ctx.lineTo(0, 0); ctx.lineTo(s * 0.2, s * 0.13); ctx.closePath(); }, '#37474f');
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.35, -s * 0.035, s * 0.35, s * 0.07); }, '#263238');
                ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.arc(-s * 0.42, 0, s * 0.07, 0, Math.PI * 2); ctx.stroke();
                break;
            }
            case 'missile': {
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.9, 0); ctx.quadraticCurveTo(s * 0.55, -s * 0.16, 0, -s * 0.13); ctx.lineTo(-s * 0.5, -s * 0.13); ctx.lineTo(-s * 0.5, s * 0.13); ctx.lineTo(0, s * 0.13); ctx.quadraticCurveTo(s * 0.55, s * 0.16, s * 0.9, 0); ctx.closePath(); }, '#cfd8dc');
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.9, 0); ctx.quadraticCurveTo(s * 0.7, -s * 0.1, s * 0.55, -s * 0.12); ctx.lineTo(s * 0.55, s * 0.12); ctx.quadraticCurveTo(s * 0.7, s * 0.1, s * 0.9, 0); }, '#ef5350');
                body(() => { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.13); ctx.lineTo(-s * 0.75, -s * 0.3); ctx.lineTo(-s * 0.3, -s * 0.13); ctx.closePath(); ctx.moveTo(-s * 0.5, s * 0.13); ctx.lineTo(-s * 0.75, s * 0.3); ctx.lineTo(-s * 0.3, s * 0.13); ctx.closePath(); }, '#78909c');
                break;
            }
            case 'hammer': {
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.05, -s * 0.9, s * 0.1, s * 1.3); }, '#8d6e63');
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.38, -s * 1.1, s * 0.76, s * 0.34); }, '#90a4ae');
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-s * 0.34, -s * 1.07, s * 0.68, s * 0.06);
                break;
            }
            case 'anvil': {
                body(() => { ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.28); ctx.lineTo(s * 0.5, -s * 0.28); ctx.lineTo(s * 0.78, -s * 0.12); ctx.lineTo(s * 0.45, -s * 0.06); ctx.lineTo(s * 0.3, s * 0.14); ctx.lineTo(s * 0.45, s * 0.3); ctx.lineTo(-s * 0.45, s * 0.3); ctx.lineTo(-s * 0.3, s * 0.14); ctx.lineTo(-s * 0.4, -s * 0.06); ctx.closePath(); }, '#546e7a');
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-s * 0.5, -s * 0.26, s * 0.95, s * 0.05);
                break;
            }
            case 'fist': {
                body(() => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.45, -s * 0.4, s * 0.9, s * 0.8, s * 0.22) : ctx.rect(-s * 0.45, -s * 0.4, s * 0.9, s * 0.8); }, '#ffb300');
                ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = s * 0.04;
                for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.45 + i * s * 0.225, -s * 0.4); ctx.lineTo(-s * 0.45 + i * s * 0.225, -s * 0.1); ctx.stroke(); }
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.4, s * 0.38, s * 0.8, s * 0.3); }, '#e65100');
                break;
            }
            case 'hat': {
                body(() => { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s * 0.14, 0, 0, Math.PI * 2); }, '#8d5524');
                body(() => { ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.05); ctx.quadraticCurveTo(-s * 0.3, -s * 0.5, 0, -s * 0.42); ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.32, -s * 0.05); ctx.closePath(); }, '#a0632a');
                break;
            }
            case 'bomb': {
                body(() => { ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); }, '#263238');
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.18, s * 0.12, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#a1887f'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.quadraticCurveTo(s * 0.15, -s * 0.75, s * 0.3, -s * 0.7); ctx.stroke();
                ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,80,0.9)'; ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.7, s * 0.09 + Math.random() * s * 0.04, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'boomerang': {
                ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.quadraticCurveTo(s * 0.45, -s * 0.5, s * 0.45, s * 0.5); ctx.lineTo(s * 0.28, s * 0.5); ctx.quadraticCurveTo(s * 0.28, -s * 0.28, -s * 0.5, -s * 0.34); ctx.closePath();
                ctx.fillStyle = '#ffb74d'; ctx.fill(); ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = s * 0.05; ctx.stroke();
                break;
            }
            case 'log': {
                body(() => { ctx.beginPath(); ctx.rect(-s * 0.55, -s * 0.16, s * 1.1, s * 0.32); }, '#8d5a2b');
                ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = s * 0.02;
                for (const k of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.moveTo(-s * 0.5, k * s * 0.4); ctx.lineTo(s * 0.5, k * s * 0.4); ctx.stroke(); }
                body(() => { ctx.beginPath(); ctx.ellipse(s * 0.55, 0, s * 0.07, s * 0.16, 0, 0, Math.PI * 2); }, '#d7b98e');
                break;
            }
            case 'dagger': {
                body(() => { ctx.beginPath(); ctx.moveTo(s * 0.9, 0); ctx.lineTo(0, -s * 0.09); ctx.lineTo(0, s * 0.09); ctx.closePath(); }, '#263238', '#ff5252');
                break;
            }
        }
        ctx.restore();
    },

    // One mote travelling a rising spiral around a point
    swirl(ctx, p, t) {
        const age = 1 - t, a = p.a0 + p.spin * age, r = p.r0 + (p.r1 - p.r0) * age;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.35 - p.rise * age, s = p.size * Math.min(1, t * 3) * Math.min(1, age * 8), al = Math.min(1, t * 2.5);
        ctx.save(); ctx.translate(x, y);
        const col = p.color;
        switch (p.shape) {
            case 'petal': ctx.rotate(a * 1.7); ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2); ctx.fill(); break;
            case 'leaf': ctx.rotate(a * 2.1); ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.8, s, 0); ctx.quadraticCurveTo(0, s * 0.8, -s, 0); ctx.fill(); ctx.strokeStyle = `rgba(0,60,20,${al * 0.6})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke(); break;
            case 'square': ctx.rotate(a * 2); ctx.fillStyle = `rgba(${col},${al})`; ctx.fillRect(-s / 2, -s / 2, s, s); break;
            case 'bullet': ctx.rotate(a + Math.PI / 2); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${col},${al})`; ctx.lineWidth = Math.max(1.5, s * 0.35); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); break;
            case 'star': ctx.rotate(a * 2); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.4 : s, q = i / 10 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); } ctx.closePath(); ctx.fill(); break;
            case 'ember': ctx.globalCompositeOperation = 'lighter'; { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s); g.addColorStop(0, `rgba(255,240,170,${al})`); g.addColorStop(0.5, `rgba(${col},${al * 0.8})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); } break;
            case 'soul': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},${al * 0.85})`; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, Math.PI, 0); ctx.quadraticCurveTo(s * 0.6, s * 0.9, 0, s * 1.2); ctx.quadraticCurveTo(-s * 0.6, s * 0.9, -s * 0.6, 0); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(20,20,40,${al})`; ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.08, s * 0.1, 0, Math.PI * 2); ctx.arc(s * 0.2, -s * 0.08, s * 0.1, 0, Math.PI * 2); ctx.fill(); break;
            case 'boom': ctx.rotate(a * 4); ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.quadraticCurveTo(s * 0.45, -s * 0.5, s * 0.45, s * 0.5); ctx.lineTo(s * 0.25, s * 0.5); ctx.quadraticCurveTo(s * 0.25, -s * 0.25, -s * 0.5, -s * 0.3); ctx.fill(); break;
            default: ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},${al})`; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    },

    // A tongue of flame that rises, wobbles and shrinks
    flame(ctx, p, t) {
        const age = 1 - t, s = p.size * (0.45 + 0.55 * Math.sin(Math.min(1, age * 1.6) * Math.PI * 0.75)) * Math.min(1, t * 2.2);
        const x = p.x + Math.sin(age * 9 + p.seed) * 6, y = p.y - age * p.rise;
        ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, s * 0.3, 0, -s * 1.3);
        g.addColorStop(0, `rgba(255,80,20,${0.85 * t + 0.1})`); g.addColorStop(0.45, `rgba(255,170,40,${0.8 * t + 0.1})`); g.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -s * 1.25); ctx.bezierCurveTo(s * 0.7, -s * 0.5, s * 0.55, s * 0.25, 0, s * 0.3); ctx.bezierCurveTo(-s * 0.55, s * 0.25, -s * 0.7, -s * 0.5, 0, -s * 1.25); ctx.fill();
        ctx.restore();
    },

    // Hard-edged glowing disc (sun, moon, fireball)
    disc(ctx, p, t) {
        const age = 1 - t, r = p.r * (0.55 + 0.45 * Math.min(1, age * 4)) * (p.shrink ? t : 1) * (1 + age * (p.expand || 0)), a = Math.min(1, t * 2.2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
        g.addColorStop(0, `rgba(${p.color},${a})`); g.addColorStop(0.8, `rgba(${p.color2 || p.color},${0.8 * a})`); g.addColorStop(1, `rgba(${p.color2 || p.color},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

};

Object.assign(FX.prototype, {
    // Run fn after `frames` of game time
    later(frames, fn) { if (frames <= 0) return fn(); (this.queue || (this.queue = [])).push({ t: frames, fn }); },

    stepQueue(dt) {
        const q = this.queue;
        if (!q || !q.length) return;
        for (const e of q) e.t -= dt;
        const due = q.filter(e => e.t <= 0);
        if (due.length) { this.queue = q.filter(e => e.t > 0); for (const e of due) e.fn(); }
    }
});

// Short constructors for the larger effects
Object.assign(FX.prototype, {
    streak(x, y, x2, y2, w, color, life = 16, bullet = false, tail) { return this.add({ type: 'streak', x, y, x2, y2, w, color, life, bullet, tail }); },
    shock(x, y, r, color, life = 24, w = 8, lines = 16) { return this.add({ type: 'shock', x, y, r, color, life, w, lines }); },
    cracks(x, y, r, life = 90, n = 9, flat = true) { return this.add({ type: 'cracks', x, y, r, life, n, flat, seed: Math.random() }); },
    prop(shape, x, y, o) { return this.add(Object.assign({ type: 'prop', shape, x, y, life: 60, size: 40, rot: 0 }, o)); },
    disc(x, y, r, color, color2, life = 30, o) { return this.add(Object.assign({ type: 'disc', x, y, r, color, color2, life }, o)); },
    swirl(x, y, o) { return this.add(Object.assign({ type: 'swirl', x, y, life: 60, rise: 200, a0: Math.random() * 6.28, spin: 8, r0: 14, r1: 70, shape: 'dot', color: '255,255,255', size: 4 }, o)); },
    flame(x, y, size, rise, life = 40) { return this.add({ type: 'flame', x, y, size, rise, life, seed: Math.random() * 6 }); },
    // Dust and smoke that billow out and thin away
    cloud(x, y, count, spread, rgb, size = 14, life = 50, up = 0.6) {
        for (let i = 0; i < count; i++) this.add({ type: 'puff', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.4, vx: (Math.random() - 0.5) * 2.2, vy: -Math.random() * up - 0.1, life: life * (0.7 + Math.random() * 0.6), color: rgb, size: size * (0.6 + Math.random() * 0.8), alpha: 0.55, grow: 0.35, drag: 0.97 });
    },
    // Radial tracer lines from a point
    spray(x, y, n, len, w, color, life = 14, spread = Math.PI * 2, mid = 0) {
        for (let i = 0; i < n; i++) { const a = mid - spread / 2 + (n > 1 ? i / (n - 1) : 0.5) * spread + (Math.random() - 0.5) * 0.12, L = len * (0.7 + Math.random() * 0.5); this.streak(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, w, color, life, true); }
    },
    // A compact explosion: fireball, shockwave, smoke, embers, sparks (counts trimmed by a third)
    boom(x, y, r) {
        this.disc(x, y, r * 1.1, '255,240,200', '255,140,40', 18);
        this.shock(x, y, r * 1.5, '255,190,90', 22, 8, 12);
        this.embers(x, y, DFX.n(18), r / 10);
        this.sparks(x, y, '255,200,80', DFX.n(14), undefined, 0, r / 8);
        this.cloud(x, y, DFX.n(6), r * 0.8, '70,60,60', r * 0.2, 55, 1.2);
    }
});

DFX.n = (k) => Math.max(1, Math.round(k * 2 / 3));   // every particle count is trimmed by a third
