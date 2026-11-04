// Death animations for the third-wave weapons (weapon-defs-2.js). Same rules as death-anim.js:
// the BODY dies in a way that fits the weapon (frozen and shattered, melted, vaporised by a scan
// line, sucked into a vortex, turned to gold, folded like paper...) and a small ACCENT plays on it.
// Every weapon's [body, accent] pair is unique.
(() => {
    const N = DFX.n, RND = DFX.rnd, ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ALLB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const D = DeathAnim;
    const lerp = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
    const arr = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const rgbArr = (s) => s.split(',').map(Number);
    // The killing weapon's signature colour ("r,g,b")
    const wcol = (k, fb) => {
        const d = k.weapon && WEAPONS[k.weapon];
        if (!d) return fb;
        const L = d.proj && d.proj.look;
        if (L && L.c && L.c !== 'rand') return L.c;
        if (d.art && d.art.glow) return d.art.glow;
        if (d.art && d.art.c) return arr(d.art.c[0]).join(',');
        return fb;
    };
    const floor = (g, c) => { const m = D.mid(c); return D.floorUnder(g, m.x, m.y); };
    const scatter = (c, k, lo, hi, up) => { const m = D.mid(c); for (const p of c.rag.pts) { const a = Math.atan2(p.y - m.y, p.x - m.x), s = RND(lo, hi); p.vx += Math.cos(a) * s + k.dir * 0.5; p.vy += Math.sin(a) * s - (up || 2); } };
    const fadeOut = (c, from, len) => { c.anim.alpha = Math.max(0, 1 - (c.anim.age - from) / len); if (c.anim.alpha <= 0.02) { c.anim.done = true; return true; } return false; };

    // ---------- new body animations ----------
    Object.assign(BODY, {
        // split head to toe: the two halves fall apart left and right
        splitVertical(g, c, k) {
            c.anim.split = { d: 0, tilt: 0 };
            c.rag.frozen = true;
            const m = D.mid(c);
            g.fx.streak(m.x, m.y - 50, m.x, m.y + 40, 4, '255,255,255', 12);
            g.fx.flashAt(m.x, m.y, '255,255,255', 40, 6);
            D.hook(c, (dt, age) => {
                const u = Math.min(1, age / 30);
                c.anim.split.d = 9 * u * u; c.anim.split.tilt = 0.5 * u * u;
                if (age > 30) { c.rag.frozen = false; c.anim.split.tilt = 0.5; return fadeOut(c, 60, 70); }
                return false;
            });
        },

        // melts into a bubbling puddle
        melt(g, c, k) {
            const col = rgbArr(wcol(k, '140,255,70')), J = c.rag.pts;
            c.anim.tint = (b, cc) => lerp(arr(cc), col, Math.min(1, c.anim.age / 24));
            let fl = null, cx = 0;
            D.hook(c, (dt, age) => {
                if (fl === null) { fl = floor(g, c); cx = D.mid(c).x; c.rag.frozen = true; }
                const u = Math.min(1, age / 70);
                c.anim.xf = { ox: cx, oy: fl, sx: 1 + u * 0.9, sy: Math.max(0.04, 1 - u) };
                if (age % 4 < dt) g.fx.add({ type: 'drop', x: cx + RND(-14, 14), y: fl - 50 * (1 - u) + RND(0, 20), vx: 0, vy: 1, life: 26, color: `rgba(${col.join(',')},0.9)`, size: 1.8, gravity: 0.3 });
                if (age % 6 < dt) g.fx.add({ type: 'puff', x: cx + RND(-30, 30) * u, y: fl - 4, vx: 0, vy: -0.4, life: 26, color: col.join(','), size: 2, grow: 0.1, alpha: 0.6 });
                c.anim.under = (ctx) => { ctx.fillStyle = `rgba(${col.join(',')},${0.75 * u})`; ctx.beginPath(); ctx.ellipse(cx, fl - 1.5, 10 + 40 * u, 3 + 3 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${0.4 * u})`; ctx.beginPath(); ctx.ellipse(cx - 10 * u, fl - 3, 8 * u, 1.2, 0, 0, Math.PI * 2); ctx.fill(); };
                return age > 70 ? fadeOut(c, 110, 90) : false;
            });
        },

        // frozen solid in a block of ice, then it shatters
        freeze(g, c, k) {
            const J = c.rag.pts; let done = false;
            c.anim.tint = (b, cc) => lerp(arr(cc), [190, 235, 255], Math.min(1, c.anim.age / 8));
            c.rag.frozen = true;
            c.anim.overlay = (ctx) => {
                if (done) return;
                const xs = J.map(p => p.x), ys = J.map(p => p.y), x0 = Math.min(...xs) - 9, x1 = Math.max(...xs) + 9, y0 = Math.min(...ys) - 12, y1 = Math.max(...ys) + 5;
                const u = Math.min(1, c.anim.age / 8);
                ctx.fillStyle = `rgba(190,235,255,${0.35 * u})`; ctx.strokeStyle = `rgba(255,255,255,${0.85 * u})`; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(x0 + 4, y0); ctx.lineTo(x1, y0 + 3); ctx.lineTo(x1 - 2, y1); ctx.lineTo(x0, y1 - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = `rgba(255,255,255,${0.5 * u})`; ctx.beginPath(); ctx.moveTo(x0 + 6, y0 + 6); ctx.lineTo(x0 + 12, y1 - 8); ctx.stroke();
                if (c.anim.age > 30) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); const m = D.mid(c); ctx.moveTo(m.x - 6, y0); ctx.lineTo(m.x + 3, m.y - 5); ctx.lineTo(m.x - 4, m.y + 8); ctx.lineTo(m.x + 6, y1); ctx.stroke(); }
            };
            g.fx.cloud(D.mid(c).x, D.mid(c).y, N(8), 30, '230,248,255', 9, 40, 0.2);
            D.hook(c, (dt, age) => {
                if (age > 42 && !done) {
                    done = true; c.rag.frozen = false; c.rag.cut(ALLB); scatter(c, k, 1.5, 4, 2);
                    const m = D.mid(c); g.fx.shards(m.x - 20, m.y - 40, 40, 70, 'rgba(200,240,255,0.95)', N(28)); g.fx.ring(m.x, m.y, '220,245,255', 60, 3, 12);
                }
                return done ? fadeOut(c, 80, 60) : false;
            });
        },

        // the soul is torn out; the body goes grey and slumps
        soulRip(g, c, k) {
            const col = wcol(k, '190,110,255');
            c.anim.tint = (b, cc) => lerp(arr(cc), [120, 120, 128], Math.min(1, c.anim.age / 20));
            D.push(c, ALL, -k.dir * 1, -2);
            const m = D.mid(c);
            g.fx.add({ type: 'ghost', x: m.x, y: m.y + 24, color: `rgb(${col})`, facing: -k.dir, wings: false, life: 70, riseMax: 30, scale: 0.8 });
            g.fx.streak(m.x, m.y, m.x + k.dir * 70, m.y - 30, 3, col, 18);
            for (let i = 0; i < N(8); i++) g.fx.swirl(m.x, m.y, { shape: 'soul', color: col, rise: RND(10, 50), spin: k.dir * RND(2, 5), r0: 4, r1: RND(30, 60), size: 5, life: 46 + RND(0, 20) });
        },

        // a scan line wipes the body away from the top, leaving glowing ash
        vaporize(g, c, k) {
            const col = wcol(k, '255,90,90'), J = c.rag.pts;
            c.rag.frozen = true;
            c.anim.tint = (b, cc) => lerp(arr(cc), rgbArr(col), 0.6);
            let top = null, bot = null;
            D.hook(c, (dt, age) => {
                if (top === null) { top = Math.min(...J.map(p => p.y)) - 12; bot = Math.max(...J.map(p => p.y)) + 4; }
                const y = top + (bot - top) * Math.min(1, age / 32);
                c.anim.clipTop = y;
                c.anim.overlay = (ctx) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createLinearGradient(0, y - 6, 0, y + 6); g2.addColorStop(0, `rgba(${col},0)`); g2.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g2.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g2; const m = D.mid(c); ctx.fillRect(m.x - 34, y - 6, 68, 12); ctx.restore(); };
                if (age % 2 < dt) { const m = D.mid(c); for (let i = 0; i < 2; i++) g.fx.add({ type: 'chunk', x: m.x + RND(-12, 12), y, vx: RND(-0.6, 0.6), vy: -RND(0.4, 1.6), life: 40, color: Math.random() < 0.5 ? `rgb(${col})` : '#fff', size: 1.6, rot: 0, vr: 0, gravity: -0.02 }); }
                if (age >= 34) { c.anim.hidden = true; c.anim.overlay = null; c.anim.done = true; const m = D.mid(c); g.fx.flashAt(m.x, bot - 4, col, 30, 8); g.fx.scorch(m.x, D.floorUnder(g, m.x, bot - 10), 16); return true; }
                return false;
            });
        },

        // trapped in a bubble that floats up and pops
        bubbleFloat(g, c, k) {
            const J = c.rag.pts; let popped = false;
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                if (age < 50) {
                    const m = D.mid(c);
                    D.kin(c, Math.sin(age * 0.15) * 0.6, -1.1 * dt);
                    D.rot(c, m.x, m.y, Math.sin(age * 0.1) * 0.01);
                    c.anim.overlay = (ctx) => { const mm = D.mid(c), r = 38 + Math.sin(age * 0.3); ctx.save(); ctx.strokeStyle = 'rgba(190,230,255,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mm.x, mm.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(170,220,255,0.12)'; ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,${150 + (age * 5) % 100},255,0.4)`; ctx.beginPath(); ctx.arc(mm.x, mm.y, r - 3, 3.6, 4.6); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(mm.x - r * 0.45, mm.y - r * 0.45, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
                    c.anim.expression = 'hurt';
                    return false;
                }
                if (!popped) { popped = true; c.anim.overlay = null; c.rag.frozen = false; c.anim.expression = 'ko'; const m = D.mid(c); g.fx.ring(m.x, m.y, '200,235,255', 44, 2, 10); for (let i = 0; i < N(10); i++) g.fx.add({ type: 'drop', x: m.x + RND(-30, 30), y: m.y + RND(-30, 30), vx: RND(-2, 2), vy: RND(-3, 0), life: 30, color: 'rgba(190,230,255,0.9)', size: 1.6, gravity: 0.3 }); }
                return true;
            });
        },

        // sucked into a vortex: spins and shrinks to a point
        vacuum(g, c, k) {
            const m0 = D.mid(c), tx = m0.x + k.dir * 30, ty = m0.y - 20;
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                const m = D.mid(c), u = Math.min(1, age / 40);
                D.kin(c, (tx - m.x) * 0.08 * dt, (ty - m.y) * 0.08 * dt);
                D.rot(c, m.x, m.y, 0.25 * dt * (0.5 + u));
                c.anim.xf = { ox: m.x, oy: m.y, sx: Math.max(0.02, 1 - u), sy: Math.max(0.02, 1 - u) };
                if (age % 2 < dt) g.fx.swirl(tx, ty, { shape: 'dot', color: '150,90,255', rise: 0, spin: 7, r0: 60, r1: 2, size: 2.5, life: 22 });
                if (age >= 40) { g.fx.flashAt(tx, ty, '170,110,255', 30, 8); g.fx.ring(tx, ty, '170,110,255', 30, 2, 10); c.anim.hidden = true; c.anim.done = true; return true; }
                return false;
            });
        },

        // sinks into the floor as if it were water
        sinkIn(g, c, k) {
            let fl = null;
            D.hook(c, (dt, age) => {
                const m = D.mid(c);
                if (fl === null) { if (age < 22) return false; fl = D.floorUnder(g, m.x, m.y); c.rag.frozen = true; c.anim.clipBottom = fl; }
                D.kin(c, 0, 0.9 * dt);
                c.anim.under = null;
                if (age % 5 < dt) g.fx.ring(m.x + RND(-10, 10), fl, '170,210,255', 14 + RND(0, 16), 1.5, 18);
                if (age % 4 < dt) g.fx.add({ type: 'puff', x: m.x + RND(-16, 16), y: fl - 3, vx: 0, vy: -0.8, life: 20, color: '200,230,255', size: 2, grow: 0.1, alpha: 0.7 });
                if (Math.min(...c.rag.pts.map(p => p.y)) > fl + 4) { c.anim.done = true; c.anim.hidden = true; return true; }
                return false;
            });
        },

        // bounces away like a rubber ball, boinging off the floor
        bounceAway(g, c, k) {
            const J = c.rag.pts; let n = 0;
            D.push(c, ALL, k.dir * 7, -10);
            D.hook(c, (dt, age) => {
                const lowest = Math.max(...J.map(p => p.y)), fl = D.floorUnder(g, J[2].x, J[2].y - 30);
                const vy = J.reduce((s, p) => s + p.vy, 0) / J.length;
                if (n < 4 && lowest > fl - 3 && vy > 1.5) {
                    n++;
                    for (const p of J) { p.vy = -9 + n * 1.6; p.py = p.y - p.vy; p.vx += k.dir * 1.5; p.px = p.x - p.vx; }
                    g.fx.ring(J[2].x, fl, '255,170,220', 26, 2, 10); g.fx.star(J[0].x, J[0].y - 10, '255,230,250');
                }
                return n >= 4 || age > 180;
            });
        },

        // collapses inward to a point and pops
        implode(g, c, k) {
            const J = c.rag.pts; let gone = false;
            c.rag.frozen = true;
            c.anim.tint = (b, cc) => lerp(arr(cc), [150, 90, 255], Math.min(1, c.anim.age / 20));
            D.hook(c, (dt, age) => {
                const m = D.mid(c);
                if (age < 26) { for (const p of J) { p.x += (m.x - p.x) * 0.09 * dt; p.y += (m.y - p.y) * 0.09 * dt; p.px = p.x; p.py = p.y; } c.rag.shake(1); if (age % 3 < dt) g.fx.swirl(m.x, m.y, { shape: 'star', color: '200,160,255', rise: 0, spin: 6, r0: 50, r1: 3, size: 3, life: 18 }); return false; }
                if (!gone) { gone = true; c.anim.hidden = true; g.fx.flashAt(m.x, m.y, '200,160,255', 60, 10); g.fx.shock(m.x, m.y, 70, '170,110,255', 16, 5, 12); for (let i = 0; i < N(16); i++) g.fx.add({ type: 'chunk', x: m.x, y: m.y, vx: RND(-5, 5), vy: RND(-6, 2), life: 40, color: i % 2 ? '#7c4dff' : k.col, size: 2.4, gravity: 0.25, rot: RND(0, 6), vr: 0.3 }); }
                c.anim.done = age > 30;
                return age > 30;
            });
        },

        // drilled into a spin, lifted, then dropped
        drillUp(g, c, k) {
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                const m = D.mid(c);
                if (age < 30) { D.rot(c, m.x, m.y, 0.5 * dt * k.dir); D.kin(c, 0, -1.4 * dt); if (age % 2 < dt) g.fx.add({ type: 'chunk', x: m.x + RND(-10, 10), y: m.y, vx: RND(-4, 4), vy: RND(-3, 1), life: 30, color: ['#ffd54f', '#8d6e63', '#bdbdbd'][(age | 0) % 3], size: 2, gravity: 0.3, rot: 0, vr: 0.4 }); return false; }
                c.rag.frozen = false; D.push(c, ALL, k.dir * 3, -4); c.rag.spin(0.06 * k.dir);
                return true;
            });
        },

        // shrinks away to nothing in green rings
        shrink(g, c, k) {
            const col = wcol(k, '120,255,120');
            let fl = null, cx = 0;
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                if (fl === null) { fl = floor(g, c); cx = D.mid(c).x; }
                const s = Math.max(0.06, 1 - age / 36);
                c.anim.xf = { ox: cx, oy: fl, sx: s, sy: s };
                if (age % 5 < dt) g.fx.add({ type: 'ring', x: cx, y: fl - 30 * s, life: 16, color: col, size: 34 * s + 6, width: 2 });
                if (age > 36) { if (!c.anim.popped) { c.anim.popped = true; g.fx.star(cx, fl - 4, '255,255,255'); g.fx.flashAt(cx, fl - 4, col, 16, 6); } return fadeOut(c, 60, 40); }
                return false;
            });
        },

        // caught in a net: topples and struggles, then lies still
        netted(g, c, k) {
            const J = c.rag.pts;
            D.push(c, ALL, k.dir * 3, -2);
            c.anim.overlay = (ctx) => {
                const m = D.mid(c), xs = J.map(p => p.x), ys = J.map(p => p.y), x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, y0 = Math.min(...ys) - 8, y1 = Math.max(...ys) + 4;
                ctx.save(); ctx.strokeStyle = 'rgba(230,220,190,0.9)'; ctx.lineWidth = 1;
                ctx.beginPath(); for (let x = x0; x <= x1; x += 7) { ctx.moveTo(x, y0); ctx.lineTo(x + (y1 - y0) * 0.2, y1); } for (let y = y0; y <= y1; y += 7) { ctx.moveTo(x0, y); ctx.lineTo(x1, y + (x1 - x0) * 0.1); } ctx.stroke();
                ctx.fillStyle = '#5d4037'; for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            };
            D.hook(c, (dt, age) => { if (age > 20 && age < 80 && age % 12 < dt) { c.rag.shake(4); for (const i of [4, 6, 8, 10]) J[i].vy -= 1.5; } return age > 80; });
        },

        // splattered with paint and knocked flat
        paint(g, c, k) {
            const cols = ['255,80,80', '80,200,255', '255,220,60', '120,255,120', '255,120,255'];
            const mine = cols.slice().sort(() => Math.random() - 0.5).slice(0, 3);
            const blots = []; for (let i = 0; i < 9; i++) blots.push({ bone: [1, 1, 2, 4, 6, 8, 0, 3, 7][i], u: RND(0.2, 0.8), r: RND(2.5, 5), c: mine[i % 3] });
            c.anim.tint = (b, cc) => lerp(arr(cc), rgbArr(mine[b % 3]), 0.45);
            D.push(c, ALL, k.dir * 6, -4);
            c.anim.overlay = (ctx) => { const J = c.rag.pts; for (const b of blots) { if (c.rag.cutB.has(b.bone)) continue; const [i, j] = RAG_BONES[b.bone], x = J[i].x + (J[j].x - J[i].x) * b.u, y = J[i].y + (J[j].y - J[i].y) * b.u; ctx.fillStyle = `rgb(${b.c})`; ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill(); } };
            const m = D.mid(c);
            for (const col of mine) g.fx.drops(m.x, m.y, `rgb(${col})`, 8, k.dir);
        },

        // time stops: grey and frozen mid-air under a clock, then it all hits at once
        timeStop(g, c, k) {
            const J = c.rag.pts; let go = false;
            c.rag.frozen = true;
            c.anim.tint = (b, cc) => { const a = arr(cc), gy = (a[0] + a[1] + a[2]) / 3; return go ? cc : `rgb(${gy},${gy},${gy})`; };
            c.anim.overlay = (ctx) => {
                if (go) return;
                const m = D.mid(c), a = c.anim.age;
                ctx.save(); ctx.strokeStyle = 'rgba(255,220,140,0.8)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(m.x, m.y, 44, 0, Math.PI * 2); ctx.stroke();
                for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(m.x + Math.cos(an) * 40, m.y + Math.sin(an) * 40); ctx.lineTo(m.x + Math.cos(an) * 44, m.y + Math.sin(an) * 44); ctx.stroke(); }
                ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(a * 0.3 - 1.57) * 32, m.y + Math.sin(a * 0.3 - 1.57) * 32); ctx.stroke();
                ctx.restore();
            };
            D.hook(c, (dt, age) => {
                if (age < 44) return false;
                if (!go) { go = true; c.rag.frozen = false; D.push(c, ALL, k.dir * 10, -6); c.rag.spin(0.05 * k.dir); const m = D.mid(c); g.fx.shock(m.x, m.y, 70, '255,220,140', 14, 4, 12); g.fx.flashAt(m.x, m.y, '255,255,255', 50, 8); }
                return true;
            });
        },

        // breaks into pixels that scatter
        pixelate(g, c, k) {
            const col = wcol(k, '0,255,200');
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                if (age < 12) { c.anim.xray = Math.floor(age / 2) % 2 === 0; return false; }
                if (!c.anim.hidden) {
                    c.anim.hidden = true; c.anim.xray = false;
                    const J = c.rag.pts;
                    for (const [a, b] of RAG_BONES) for (let u = 0; u <= 1; u += 0.25) {
                        const x = J[a].x + (J[b].x - J[a].x) * u, y = J[a].y + (J[b].y - J[a].y) * u;
                        g.fx.add({ type: 'chunk', x: Math.round(x / 4) * 4, y: Math.round(y / 4) * 4, vx: RND(-1.6, 1.6) + k.dir, vy: -RND(0.5, 3), life: 50 + RND(0, 30), color: Math.random() < 0.6 ? k.col : `rgb(${col})`, size: 3.6, gravity: 0.15, rot: 0, vr: 0 });
                    }
                    g.fx.flashAt(D.mid(c).x, D.mid(c).y, col, 40, 6);
                    c.anim.done = true;
                }
                return true;
            });
        },

        // turns to solid gold and tips over like a statue
        goldStatue(g, c, k) {
            const J = c.rag.pts; let a0 = 0, pivot = null, landed = false;
            c.anim.tint = (b, cc) => { const u = Math.min(1, c.anim.age / 16), sh = 0.15 * Math.sin(c.anim.age * 0.2 + b); return lerp(arr(cc), [255, 200 + 30 * sh, 60], u); };
            c.rag.frozen = true;
            D.hook(c, (dt, age) => {
                if (age % 5 < dt) { const q = J[(Math.random() * 11) | 0]; g.fx.star(q.x, q.y, '255,240,180'); }
                if (age < 18) return false;
                if (!pivot) { const f = J[8].y > J[10].y ? J[8] : J[10]; pivot = { x: f.x, y: f.y }; }
                if (!landed) {
                    const da = 0.02 + a0 * 0.12; a0 += da * dt;
                    D.rot(c, pivot.x, pivot.y, da * dt * k.dir);
                    if (a0 > 1.45) { landed = true; g.fx.dust(D.mid(c).x, pivot.y, N(12), 40, '255,220,140'); g.fx.cracks(D.mid(c).x, pivot.y, 40, 60, 6, true); for (let i = 0; i < N(6); i++) g.fx.add({ type: 'chunk', x: D.mid(c).x, y: pivot.y - 4, vx: RND(-3, 3), vy: -RND(2, 5), life: 50, color: '#ffd54f', size: 2.4, gravity: 0.35, rot: 0, vr: 0.3 }); }
                    return false;
                }
                return true;
            });
        },

        // folds flat like paper and flutters to the floor
        origami(g, c, k) {
            c.rag.frozen = true;
            let fl = null;
            D.hook(c, (dt, age) => {
                const m = D.mid(c);
                if (fl === null) fl = floor(g, c);
                const u = Math.min(1, age / 14);
                c.anim.xf = { ox: m.x, oy: m.y, sx: Math.max(0.12, 1 - u * 0.88) * (Math.cos(age * 0.12) > 0 ? 1 : -1), sy: 1, rot: Math.sin(age * 0.08) * 0.6 };
                if (m.y < fl - 18) D.kin(c, Math.sin(age * 0.09) * 1.2, 0.9 * dt);
                return age > 160 ? fadeOut(c, 160, 40) : false;
            });
        },

        // legs tied together: hops and topples face first
        wrapped(g, c, k) {
            const J = c.rag.pts;
            D.push(c, ALL, k.dir * 2, -3);
            c.anim.overlay = (ctx) => { const x = (J[8].x + J[10].x) / 2, y = (J[8].y + J[10].y) / 2, x2 = (J[7].x + J[9].x) / 2, y2 = (J[7].y + J[9].y) / 2; ctx.save(); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const u = i / 3; ctx.beginPath(); ctx.ellipse(x + (x2 - x) * u, y + (y2 - y) * u, 6, 3, Math.atan2(y2 - y, x2 - x) + 1.57, 0, Math.PI * 2); ctx.stroke(); } ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(x + 6, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
            D.hook(c, (dt, age) => {
                // the rope keeps the legs together
                for (const [a, b] of [[8, 10], [7, 9]]) { const mx = (J[a].x + J[b].x) / 2, my = (J[a].y + J[b].y) / 2; J[a].x += (mx - J[a].x) * 0.5; J[a].y += (my - J[a].y) * 0.5; J[b].x += (mx - J[b].x) * 0.5; J[b].y += (my - J[b].y) * 0.5; }
                if (age > 8 && age < 12) for (const i of [0, 1]) J[i].vx += k.dir * 0.8;
                return age > 120;
            });
        },

        // turns to stone from the feet up and crumbles
        petrify(g, c, k) {
            const J = c.rag.pts; let done = false;
            c.rag.frozen = true;
            const ys = J.map(p => p.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
            c.anim.tint = (b, cc) => { const [i, j] = RAG_BONES[b], y = (J[i].y + J[j].y) / 2, line = y1 - (y1 - y0 + 10) * Math.min(1, c.anim.age / 30); return y > line ? '#8a8580' : cc; };
            D.hook(c, (dt, age) => {
                if (age < 30 && age % 3 < dt) g.fx.add({ type: 'puff', x: J[2].x + RND(-12, 12), y: y1 - (y1 - y0) * age / 30, vx: 0, vy: -0.3, life: 20, color: '170,165,160', size: 2, grow: 0.1, alpha: 0.6 });
                if (age > 46 && !done) { done = true; c.rag.frozen = false; c.rag.cut(ALLB); scatter(c, k, 0.5, 2, 1); const m = D.mid(c); for (let i = 0; i < N(18); i++) g.fx.add({ type: 'chunk', x: m.x + RND(-12, 12), y: m.y + RND(-30, 30), vx: RND(-2, 2), vy: -RND(0, 3), life: 70, color: ['#8a8580', '#6d6a66', '#a29c96'][i % 3], size: 2.5 + RND(0, 2.5), gravity: 0.35, rot: RND(0, 6), vr: 0.2 }); g.fx.dust(m.x, D.floorUnder(g, m.x, m.y), N(10), 30, '170,165,160'); }
                return done ? fadeOut(c, 110, 60) : false;
            });
        },

        // swept up by a twister, spun round and dropped
        twister(g, c, k) {
            c.rag.frozen = true;
            let cx = null, base = 0;
            D.hook(c, (dt, age) => {
                const m = D.mid(c);
                if (cx === null) { cx = m.x; base = floor(g, c); }
                if (age < 50) {
                    D.kin(c, (cx + Math.sin(age * 0.3) * 10 - m.x) * 0.3, -1.3 * dt);
                    c.anim.xf = { ox: m.x, oy: m.y, sx: Math.cos(age * 0.5), sy: 1 };
                    if (age % 2 < dt) for (let i = 0; i < 2; i++) g.fx.swirl(cx, base, { shape: 'leaf', color: '200,240,220', rise: RND(80, 150), spin: 9, r0: 10, r1: 40, size: 3, life: 30 });
                    return false;
                }
                c.anim.xf = null; c.rag.frozen = false; D.push(c, ALL, k.dir * 4, -2); c.rag.spin(0.08);
                return true;
            });
        },

        // made to dance a jig, then collapses
        dance(g, c, k) {
            const J = c.rag.pts;
            D.hook(c, (dt, age) => {
                if (age < 60) {
                    if (age % 14 < dt) { for (const p of J) p.vy -= 4.2; for (const i of [4, 6]) { J[i].vy -= 3; J[i].vx += (i === 4 ? 2 : -2) * Math.sin(age); } g.fx.swirl(J[0].x, J[0].y - 10, { shape: 'note', color: '255,150,220', rise: 40, spin: 2, r0: 4, r1: 20, size: 6, life: 30 }); }
                    // keep upright: neck pulled above the hip
                    J[1].x += (J[2].x - J[1].x) * 0.2; J[0].x += (J[2].x - J[0].x) * 0.2;
                    J[8].vx += Math.sin(age * 0.5) * 0.6; J[10].vx -= Math.sin(age * 0.5) * 0.6;
                    c.anim.expression = 'angry';
                    return false;
                }
                c.anim.expression = 'ko'; D.push(c, ALL, k.dir * 2, -1);
                return true;
            });
        },

        // goes glassy, cracks, and shatters like a mirror
        shatter(g, c, k) {
            const J = c.rag.pts; let done = false;
            c.rag.frozen = true;
            c.anim.tint = (b) => `hsl(${230 + b * 4},40%,${82 + 10 * Math.sin(c.anim.age * 0.3 + b)}%)`;
            c.anim.overlay = (ctx) => { if (done || c.anim.age < 10) return; const m = D.mid(c); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = i * 0.9, r = 10 + (c.anim.age - 10) * 1.4; ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(an) * r, m.y + Math.sin(an) * r * 1.4); } ctx.stroke(); ctx.restore(); };
            D.hook(c, (dt, age) => {
                if (age > 30 && !done) { done = true; c.rag.frozen = false; c.rag.cut(ALLB); scatter(c, k, 2, 5, 2); const m = D.mid(c); g.fx.shards(m.x - 18, m.y - 40, 36, 70, 'rgba(225,230,255,0.95)', N(30)); g.fx.flashAt(m.x, m.y, '230,230,255', 50, 8); }
                return done ? fadeOut(c, 70, 50) : false;
            });
        }
    });

    // ---------- new accents ----------
    const mid = (c) => D.mid(c);
    const burst = (g, c, shape, color, n, o) => { const m = mid(c); for (let i = 0; i < N(n); i++) g.fx.swirl(m.x, m.y, Object.assign({ shape, color, rise: RND(30, 90), spin: RND(-4, 4), r0: 6, r1: RND(26, 54), size: 4 + RND(0, 2), life: 54 + RND(0, 24) }, o || {})); };
    const chunks = (g, c, cols, n, o) => { const m = mid(c); for (let i = 0; i < N(n); i++) g.fx.add(Object.assign({ type: 'chunk', x: m.x, y: m.y, vx: RND(-3.5, 3.5), vy: -RND(2, 6), life: 55, color: cols[i % cols.length], size: 2 + RND(0, 2), gravity: 0.35, rot: RND(0, 6), vr: RND(-0.4, 0.4), drag: 0.99 }, o || {})); };
    const drips = (g, c, col, n, o) => { const m = mid(c); for (let i = 0; i < N(n); i++) g.fx.later(i, () => g.fx.add(Object.assign({ type: 'drop', x: m.x + RND(-20, 20), y: m.y + RND(-30, 10), vx: RND(-1.5, 1.5), vy: -RND(0, 3), life: 40, color: col, size: 1.7, gravity: 0.3 }, o || {}))); };
    const sparks = (g, c, col, n, sp) => { const m = mid(c); g.fx.sparks(m.x, m.y, col, N(n), undefined, 0, sp || 6); };
    const rings = (g, c, col, n, r, gap) => { const m = mid(c); for (let i = 0; i < n; i++) g.fx.later(i * (gap || 4), () => g.fx.shock(m.x, m.y, r + i * 10, col, 18, 3, 0)); };

    Object.assign(ACCENT, {
        tracers(g, c, k) { const m = mid(c); for (let i = 0; i < N(6); i++) g.fx.later(i * 2, () => { const y = m.y + RND(-26, 20); g.fx.streak(m.x - k.dir * 90, y, m.x + k.dir * 90, y + RND(-6, 6), 1.6, '255,236,150', 8); }); },
        brass(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); for (let i = 0; i < N(18); i++) g.fx.later(i, () => g.fx.add({ type: 'chunk', x: m.x - k.dir * 10, y: m.y - 10, vx: -k.dir * RND(1, 3.5), vy: -RND(3, 6), life: 120, color: ['#ffca28', '#ffb300'][i % 2], size: 2.2, gravity: 0.4, rot: RND(0, 6), vr: 0.5, stopY: fl - 2 })); },
        coins(g, c, k) { burst(g, c, 'coin', '255,210,60', 12, { rise: RND(10, 40) }); chunks(g, c, ['#ffd54f', '#ffca28'], 8); },
        rocks(g, c, k) { chunks(g, c, ['#8d8d8d', '#6d6a66', '#a29c96'], 14, { size: 3 + RND(0, 3) }); },
        slime(g, c, k) { drips(g, c, 'rgba(140,255,70,0.9)', 16); const m = mid(c); g.fx.cloud(m.x, m.y, N(4), 20, '140,255,70', 7, 40, 0.3); },
        runes(g, c, k) { burst(g, c, 'rune', wcol(k, '255,140,40'), 8, { rise: RND(50, 100), spin: RND(-2, 2), size: 6 }); },
        snowflakes(g, c, k) { burst(g, c, 'flake', '230,248,255', 12, { rise: -RND(0, 20), spin: RND(-2, 2), size: 5 }); },
        bolts(g, c, k) { const m = mid(c); for (let i = 0; i < N(6); i++) { const a = RND(0, 6.28); g.fx.add({ type: 'zap', x: m.x, y: m.y, x2: m.x + Math.cos(a) * RND(30, 60), y2: m.y + Math.sin(a) * RND(30, 60), color: '255,240,140', life: 10 }); } },
        ripple(g, c, k) { rings(g, c, '255,255,255', 3, 30, 5); },
        petalsBlue(g, c, k) { burst(g, c, 'petal', '150,210,255', 14); },
        sand(g, c, k) { const m = mid(c); for (let i = 0; i < N(20); i++) g.fx.add({ type: 'chunk', x: m.x + RND(-10, 10), y: m.y + RND(-30, 30), vx: RND(0.5, 2) * k.dir, vy: RND(-1, 1), life: 60, color: ['#e0c38c', '#cfae6d', '#f0dcae'][i % 3], size: 1.4, gravity: 0.08, rot: 0, vr: 0 }); },
        gears(g, c, k) { burst(g, c, 'gear', '190,190,200', 6, { rise: RND(10, 40), size: 6 }); chunks(g, c, ['#9e9e9e', '#ffca28'], 6); },
        steam(g, c, k) { const m = mid(c); for (let i = 0; i < N(10); i++) g.fx.add({ type: 'puff', x: m.x + RND(-16, 16), y: m.y + RND(-20, 20), vx: RND(-0.3, 0.3), vy: -RND(0.6, 1.4), life: 50, color: '235,240,245', size: 4, grow: 0.25, alpha: 0.6 }); },
        whipCrack(g, c, k) { const m = mid(c); g.fx.text(m.x, m.y - 50, 'CRACK!', '#fff3e0', 18); g.fx.shock(m.x - k.dir * 30, m.y - 20, 30, '255,240,200', 10, 3, 6); },
        sawdust(g, c, k) { chunks(g, c, ['#d7b98e', '#c49a6c', '#ffe0b2'], 22, { size: 1.6, vx: RND(-5, 5) }); },
        sparkGold(g, c, k) { sparks(g, c, '255,210,90', 14, 7); },
        bubbles(g, c, k) { const m = mid(c); for (let i = 0; i < N(10); i++) g.fx.swirl(m.x, m.y, { shape: 'bubble', color: '190,230,255', rise: RND(60, 130), spin: RND(-1, 1), r0: 4, r1: RND(10, 30), size: 3 + RND(0, 3), life: 60 + RND(0, 30) }); },
        sparkPurple(g, c, k) { sparks(g, c, '200,120,255', 14, 7); },
        sparkGreen(g, c, k) { sparks(g, c, '120,255,160', 14, 7); },
        hatSmoke(g, c, k) { ACCENT.hat(g, c, k); const m = mid(c); g.fx.cloud(m.x, m.y, N(8), 30, '80,76,72', 10, 50, 0.6); },
        sigil(g, c, k) { const m = mid(c); g.fx.add({ type: 'sigil', x: m.x, y: D.floorUnder(g, m.x, m.y) - 2, life: 60, color: wcol(k, '170,110,255'), size: 46 }); },
        haloRings(g, c, k) { const m = mid(c); for (let i = 0; i < 3; i++) g.fx.later(i * 6, () => g.fx.add({ type: 'ring', x: m.x, y: m.y - 30 - i * 14, life: 20, color: '140,255,140', size: 16 + i * 4, width: 2 })); },
        frostMist(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y, N(12), 40, '220,245,255', 12, 60, 0.15); },
        arcCrown(g, c, k) { const h = c.rag.pts[0]; for (let i = 0; i < N(8); i++) g.fx.later(i * 3, () => { const a = RND(-3, 0); g.fx.add({ type: 'zap', x: h.x, y: h.y, x2: h.x + Math.cos(a) * 26, y2: h.y + Math.sin(a) * 26, color: '150,220,255', life: 6 }); }); },
        nails(g, c, k) { chunks(g, c, ['#bdbdbd', '#9e9e9e'], 12, { size: 1.6 }); g.fx.text(mid(c).x, mid(c).y - 46, 'TAK TAK', '#e0e0e0', 12); },
        inkDrops(g, c, k) { for (const col of ['255,80,80', '80,200,255', '255,220,60']) drips(g, c, `rgba(${col},0.95)`, 5); },
        pixels(g, c, k) { burst(g, c, 'square', '0,255,200', 10, { size: 4 }); burst(g, c, 'square', '255,0,200', 6, { size: 3 }); },
        starfield(g, c, k) { const m = mid(c); for (let i = 0; i < N(18); i++) g.fx.swirl(m.x, m.y, { shape: 'star', color: '200,180,255', rise: 0, spin: 4, r0: RND(60, 110), r1: 2, size: 2.5, life: 40 + RND(0, 20) }); },
        soundRings(g, c, k) { const m = mid(c); for (let i = 0; i < 4; i++) g.fx.later(i * 3, () => g.fx.add({ type: 'ring', x: m.x + k.dir * i * 12, y: m.y, life: 18, color: '200,255,255', size: 20 + i * 6, width: 2 })); },
        splash(g, c, k) { drips(g, c, 'rgba(120,190,255,0.9)', 18, { vy: -RND(2, 5) }); },
        flareSmoke(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y, N(10), 30, '255,90,60', 9, 60, 0.7); },
        prism(g, c, k) { const m = mid(c); ['255,90,90', '255,190,70', '255,240,90', '110,230,110', '90,190,255', '170,120,255'].forEach((col, i) => g.fx.sparks(m.x, m.y, col, N(4), -Math.PI / 2 + (i - 2.5) * 0.4, 0.3, 6)); },
        shootingStars(g, c, k) { const m = mid(c); for (let i = 0; i < N(5); i++) g.fx.later(i * 4, () => { const x = m.x + RND(-60, 60); g.fx.streak(x, m.y - 80, x + 40, m.y - 40, 2, '255,240,160', 12); g.fx.star(x + 40, m.y - 40, '255,240,160'); }); },
        thorns(g, c, k) { chunks(g, c, ['#689f38', '#33691e'], 12, { size: 1.8 }); burst(g, c, 'leaf', '110,180,60', 5); },
        shrapnel(g, c, k) { chunks(g, c, ['#795548', '#9e9e9e', '#ff9800'], 16, { vx: RND(-6, 6), vy: -RND(3, 8) }); },
        targetPing(g, c, k) { const m = mid(c); g.fx.add({ type: 'ring', x: m.x, y: m.y, life: 22, color: '41,182,246', size: 40, width: 2 }); g.fx.add({ type: 'ring', x: m.x, y: m.y, life: 30, color: '41,182,246', size: 56, width: 1 }); },
        plasmaDrips(g, c, k) { drips(g, c, 'rgba(255,80,200,0.95)', 14); sparks(g, c, '255,80,200', 8, 4); },
        beepLight(g, c, k) { const m = mid(c); for (let i = 0; i < 5; i++) g.fx.later(i * 8, () => g.fx.flashAt(m.x, m.y - 20, '255,40,40', 18, 4)); },
        dirtSpray(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); g.fx.dust(m.x, fl, N(14), 40, DUST_TINT[g.level.material]); chunks(g, c, ['#6d4c41', '#8d6e63'], 8); },
        iceShards(g, c, k) { const m = mid(c); g.fx.shards(m.x - 20, m.y - 20, 40, 40, 'rgba(200,240,255,0.95)', N(16)); },
        toxicCloud(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y, N(12), 40, '120,220,60', 12, 70, 0.2); },
        cards(g, c, k) { burst(g, c, 'card', '255,255,255', 10, { rise: RND(20, 70), size: 6 }); },
        whiteout(g, c, k) { const m = mid(c); g.fx.flashAt(m.x, m.y, '255,255,255', 120, 14); g.fx.screenFlash('255,255,255', 0.35); },
        pebbles(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); for (let i = 0; i < N(10); i++) g.fx.add({ type: 'chunk', x: m.x, y: m.y, vx: RND(-3, 3), vy: -RND(2, 5), life: 90, color: '#8d8784', size: 2.6, gravity: 0.4, rot: 0, vr: 0.2, stopY: fl - 2, bounce: 0.4 }); },
        choir(g, c, k) { const m = mid(c); g.fx.add({ type: 'pillar', x: m.x, y: 0, life: 50, color: '255,230,140', size: 22 }); burst(g, c, 'star', '255,230,140', 8, { rise: 120 }); },
        sparksRed(g, c, k) { sparks(g, c, '255,80,80', 14, 7); },
        quake(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); g.fx.cracks(m.x, fl, 70, 80, 9, true); g.fx.dust(m.x, fl, N(10), 50, DUST_TINT[g.level.material]); },
        grassTuft(g, c, k) { burst(g, c, 'leaf', '120,200,90', 10, { rise: RND(10, 40) }); },
        phoenixFeathers(g, c, k) { const m = mid(c); for (let i = 0; i < N(8); i++) g.fx.add({ type: 'feather', x: m.x + RND(-14, 14), y: m.y + RND(-20, 20), vx: RND(-1, 1), vy: -RND(0.2, 1), life: 70, color: '255,140,40', size: 4, rot: RND(0, 6), vr: 0.1, seed: RND(0, 6), drag: 0.985 }); g.fx.embers(m.x, m.y, N(10), 3); },
        frostFeathers(g, c, k) { const m = mid(c); for (let i = 0; i < N(8); i++) g.fx.add({ type: 'feather', x: m.x + RND(-14, 14), y: m.y + RND(-20, 20), vx: RND(-1, 1), vy: RND(0.2, 0.8), life: 80, color: '190,235,255', size: 4, rot: RND(0, 6), vr: 0.1, seed: RND(0, 6), drag: 0.985 }); },
        goldFeathers(g, c, k) { const m = mid(c); for (let i = 0; i < N(10); i++) g.fx.add({ type: 'feather', x: m.x + RND(-20, 20), y: m.y + RND(-20, 20), vx: RND(-1.5, 1.5), vy: RND(0.2, 0.8), life: 80, color: '255,210,90', size: 4, rot: RND(0, 6), vr: 0.1, seed: RND(0, 6), drag: 0.985 }); },
        thunderclap(g, c, k) { const m = mid(c); g.fx.add({ type: 'zap', x: m.x, y: 0, x2: m.x, y2: m.y, color: '255,240,140', life: 10 }); g.fx.flashAt(m.x, m.y, '255,240,140', 60, 8); },
        shadowSmoke(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y, N(10), 30, '40,20,70', 10, 60, 0.5); },
        fireRing(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); for (let i = 0; i < N(10); i++) g.fx.flame(m.x + Math.cos(i / N(10) * 6.28) * 34, fl - 4, 10, 30, 36); },
        icicles(g, c, k) { const m = mid(c), fl = D.floorUnder(g, m.x, m.y); for (let i = 0; i < N(7); i++) g.fx.prop('icicle', m.x + RND(-40, 40), fl, { size: 18 + RND(0, 14), rot: -Math.PI / 2, life: 70 }); },
        stormCloud(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y - 70, N(8), 40, '90,95,110', 14, 60, 0); for (let i = 0; i < 3; i++) g.fx.later(6 + i * 8, () => g.fx.add({ type: 'zap', x: m.x + RND(-20, 20), y: m.y - 70, x2: m.x + RND(-10, 10), y2: m.y, color: '255,240,140', life: 8 })); },
        skullPuff(g, c, k) { const m = mid(c); g.fx.cloud(m.x, m.y, N(8), 24, '140,255,70', 9, 50, 0.5); g.fx.swirl(m.x, m.y, { shape: 'skull', color: '200,255,180', rise: 70, spin: 0, r0: 0, r1: 0, size: 9, life: 60 }); },
        voidSparks(g, c, k) { const m = mid(c); for (let i = 0; i < N(12); i++) g.fx.swirl(m.x, m.y, { shape: 'dot', color: '160,80,255', rise: 0, spin: -5, r0: RND(40, 80), r1: 0, size: 2.5, life: 30 }); },
        mossBits(g, c, k) { chunks(g, c, ['#6d8b4a', '#8a8580', '#4e7a3a'], 14); },
        windStreaks(g, c, k) { const m = mid(c); for (let i = 0; i < N(7); i++) g.fx.later(i * 2, () => { const y = m.y + RND(-30, 30); g.fx.streak(m.x - 60, y, m.x + 60, y - 10, 1.6, '220,255,240', 12); }); },
        sunRays(g, c, k) { const m = mid(c); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fx.streak(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14, m.x + Math.cos(a) * 60, m.y + Math.sin(a) * 60, 3, '255,230,120', 16); } },
        boneDust(g, c, k) { chunks(g, c, ['#f5f5dc', '#e0dccb'], 14, { gravity: 0.05, vy: -RND(0.5, 2) }); },
        clockHands(g, c, k) { burst(g, c, 'gear', '255,220,140', 5, { size: 7, rise: 50 }); },
        notes(g, c, k) { burst(g, c, 'note', '255,150,220', 9, { size: 6, rise: RND(50, 110) }); },
        hearts(g, c, k) { burst(g, c, 'heart', '255,90,130', 8, { size: 6, rise: RND(50, 110) }); },
        mirrorShards(g, c, k) { const m = mid(c); g.fx.shards(m.x - 10, m.y - 30, 20, 40, 'rgba(240,240,255,0.95)', N(10)); g.fx.star(m.x, m.y - 20, '255,255,255'); }
    });

    // ---------- extra particle shapes used above ----------
    const swirlBase = FX.drawers.swirl;
    FX.drawers.swirl = function (ctx, p, t) {
        const extra = { coin: 1, rune: 1, flake: 1, gear: 1, card: 1, bubble: 1, note: 1, heart: 1, skull: 1 };
        if (!extra[p.shape]) return swirlBase.call(this, ctx, p, t);
        const age = 1 - t, a = p.a0 + p.spin * age, r = p.r0 + (p.r1 - p.r0) * age;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.35 - p.rise * age, s = p.size * Math.min(1, t * 3) * Math.min(1, age * 8), al = Math.min(1, t * 2.5);
        ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= al;
        const col = p.color;
        switch (p.shape) {
            case 'coin': ctx.scale(Math.abs(Math.cos(a * 3)) * 0.9 + 0.1, 1); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'rune': ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s); ctx.lineTo(s * 0.5, -s * 0.2); ctx.lineTo(-s * 0.4, s * 0.3); ctx.lineTo(s * 0.4, s); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); break;
            case 'flake': ctx.rotate(a); ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 1.1; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(s * 0.6, 0); ctx.lineTo(s * 0.85, -s * 0.25); ctx.moveTo(s * 0.6, 0); ctx.lineTo(s * 0.85, s * 0.25); } ctx.stroke(); break;
            case 'gear': ctx.rotate(a * 2); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); for (let i = 0; i < 16; i++) { const q = i / 16 * Math.PI * 2, rr = i % 2 ? s * 0.75 : s; ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill(); break;
            case 'card': ctx.rotate(a * 1.5); ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.5, -s * 0.7, s, s * 1.4); ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6; ctx.strokeRect(-s * 0.5, -s * 0.7, s, s * 1.4); ctx.fillStyle = Math.sin(p.a0 * 7) > 0 ? '#d50000' : '#212121'; ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2); ctx.fill(); break;
            case 'bubble': ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.4, s * 0.25, 0, Math.PI * 2); ctx.fill(); break;
            case 'note': ctx.rotate(Math.sin(a) * 0.4); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.6, s * 0.45, s * 0.32, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(s * 0.1, -s, s * 0.18, s * 1.6); break;
            case 'heart': ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.moveTo(0, s * 0.8); ctx.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.6, -s, 0, -s * 0.35); ctx.bezierCurveTo(s * 0.6, -s, s * 1.2, -s * 0.1, 0, s * 0.8); ctx.fill(); break;
            case 'skull': ctx.fillStyle = `rgba(${col},0.9)`; ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-s * 0.35, s * 0.35, s * 0.7, s * 0.4); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.2, s * 0.17, 0, Math.PI * 2); ctx.arc(s * 0.25, -s * 0.2, s * 0.17, 0, Math.PI * 2); ctx.fill(); break;
        }
        ctx.restore();
    };

    // A glowing magic circle on the floor
    FX.drawers.sigil = function (ctx, p, t) {
        const age = 1 - t, s = p.size * Math.min(1, age * 5), al = Math.min(1, t * 2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.32); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${p.color},${al})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2); ctx.stroke();
        ctx.rotate(age * 2); ctx.beginPath();
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72); }
        ctx.closePath(); ctx.stroke();
        ctx.restore();
    };

    // New stuck/flying prop shapes, and the killing weapon itself
    const propBase = FX.drawers.prop;
    FX.drawers.prop = function (ctx, p, t) {
        const s = p.size || 40;
        const own = { nail: 1, thorn: 1, harpoon: 1, javelin: 1, weapon: 1, icicle: 1 };
        if (!own[p.shape]) return propBase.call(this, ctx, p, t);
        ctx.save(); ctx.globalAlpha *= Math.min(1, t * 4); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        switch (p.shape) {
            case 'nail': ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-s * 0.1, -1, s * 0.5, 2); ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-s * 0.12, -3, 2, 6); break;
            case 'thorn': ctx.fillStyle = '#558b2f'; ctx.beginPath(); ctx.moveTo(-s * 0.1, -2); ctx.lineTo(s * 0.35, 0); ctx.lineTo(-s * 0.1, 2); ctx.closePath(); ctx.fill(); break;
            case 'harpoon': ctx.fillStyle = '#78909c'; ctx.fillRect(-s * 0.5, -1.2, s * 0.85, 2.4); ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.moveTo(s * 0.35, -3.5); ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 0.35, 3.5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(230,220,200,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(-s * 0.8, 10, -s * 1.1, 4); ctx.stroke(); break;
            case 'javelin': ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke(); ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.moveTo(s * 0.4, -3); ctx.lineTo(s * 0.55, 0); ctx.lineTo(s * 0.4, 3); ctx.closePath(); ctx.fill(); break;
            case 'icicle': { const g = ctx.createLinearGradient(0, 0, s, 0); g.addColorStop(0, 'rgba(200,240,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.6)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -s * 0.15); ctx.lineTo(s, 0); ctx.lineTo(0, s * 0.15); ctx.closePath(); ctx.fill(); break; }
            case 'weapon': {
                const span = WEAPON_ART_SPAN[p.w] || [-20, 20], k = s / Math.max(20, span[1] - span[0]);
                ctx.scale(k, k); ctx.translate(-span[1] * 0.55, 0);
                WeaponArt.draw(ctx, p.w, { t: 0, glow: 0.5 });
                break;
            }
        }
        ctx.restore();
    };
})();
