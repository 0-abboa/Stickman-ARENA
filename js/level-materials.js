// Platform materials for the five newer themes (neon, lava, ocean, candy, haunted): a seamless
// texture each, the surface finish drawn on every platform (glowing edges, lava cracks, coral and
// shells, frosting and sprinkles, moss and cobwebs), and the dust colour of each surface.
(() => {
    const MATS = ['neon', 'lava', 'ocean', 'candy', 'haunted'];
    Object.assign(DUST_TINT, { neon: '120,220,255', lava: '255,140,80', ocean: '220,210,180', candy: '255,200,230', haunted: '150,140,170' });
    Level.MATERIALS = ['dirt', 'stone', 'cloud', 'ice'].concat(MATS);

    // ---------- textures (128px seamless tiles) ----------
    const tile = (fn, seed) => {
        const [c, ctx] = Graphics.makeTile(128);
        fn(ctx, Graphics.rng(seed), 128);
        return ctx.createPattern(c, 'repeat');
    };
    const T = {
        neon: () => tile((ctx, r, S) => {
            const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#1c1b2e'); g.addColorStop(1, '#0c0b16');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            // plates and seams
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
            for (let y = 0; y <= S; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
            for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < S; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke(); }
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
            for (let y = 1; y <= S; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
            ctx.fillStyle = 'rgba(160,170,200,0.35)';
            for (let y = 6; y < S; y += 32) for (let x = 6; x < S; x += 26) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
            // faint circuit traces
            ctx.strokeStyle = 'rgba(0,229,255,0.12)'; ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) { let x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * 40; else y += (r() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
            for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.04})`; ctx.fillRect(r() * S, r() * S, 1, 1); }
        }, 31),
        lava: () => tile((ctx, r, S) => {
            const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#2a1a1c'); g.addColorStop(1, '#120a0c');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            // basalt cells
            for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rr = 8 + r() * 14; ctx.fillStyle = `rgba(${40 + r() * 30 | 0},${22 + r() * 16 | 0},${24 + r() * 16 | 0},0.7)`; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
            // glowing cracks (wrap around the tile edges)
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 6; i++) {
                let x = r() * S, y = r() * S;
                const path = [[x, y]];
                for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.3) * 22; path.push([x, y]); }
                for (const [w, a] of [[5, 0.12], [2.2, 0.45], [0.9, 0.9]]) {
                    ctx.strokeStyle = `rgba(255,${a > 0.5 ? 200 : 110},${a > 0.5 ? 90 : 30},${a})`; ctx.lineWidth = w;
                    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { ctx.beginPath(); path.forEach(([px, py], j) => j ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)); ctx.stroke(); }
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        }, 41),
        ocean: () => tile((ctx, r, S) => {
            const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#c9b48a'); g.addColorStop(1, '#8a7656');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            // sandstone strata and grains
            for (let y = 10; y < S; y += 18 + r() * 8) { ctx.strokeStyle = 'rgba(110,90,60,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5); ctx.stroke(); }
            for (let i = 0; i < 500; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,240,210,0.25)' : 'rgba(90,70,40,0.25)'; ctx.fillRect(r() * S, r() * S, 1.2, 1.2); }
            // shells and pink coral bits
            for (let i = 0; i < 6; i++) { const x = r() * S, y = r() * S; ctx.fillStyle = 'rgba(255,240,225,0.85)'; ctx.beginPath(); ctx.ellipse(x, y, 4, 3, r() * 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(160,120,90,0.6)'; ctx.lineWidth = 0.6; ctx.stroke(); }
            for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(255,${120 + r() * 60 | 0},${140 + r() * 40 | 0},0.6)`; ctx.beginPath(); ctx.arc(r() * S, r() * S, 1.5 + r() * 2, 0, Math.PI * 2); ctx.fill(); }
        }, 51),
        candy: () => tile((ctx, r, S) => {
            // sponge cake with cream layers and a strawberry jam stripe
            ctx.fillStyle = '#f6d7a7'; ctx.fillRect(0, 0, S, S);
            for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${200 + r() * 30 | 0},${150 + r() * 30 | 0},${90 + r() * 20 | 0},0.5)`; ctx.beginPath(); ctx.arc(r() * S, r() * S, 0.8 + r() * 2, 0, Math.PI * 2); ctx.fill(); }
            for (const [y, h, c] of [[30, 10, '#fff8f0'], [40, 6, '#e91e63'], [86, 10, '#fff8f0'], [96, 5, '#8d5a3a']]) {
                ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.4); ctx.lineTo(S, y + h); ctx.lineTo(0, y + h); ctx.closePath(); ctx.fill();
            }
        }, 61),
        haunted: () => tile((ctx, r, S) => {
            // old planks over dark stone
            ctx.fillStyle = '#2a2430'; ctx.fillRect(0, 0, S, S);
            for (let y = 0; y < S; y += 16) {
                const g = ctx.createLinearGradient(0, y, 0, y + 16); g.addColorStop(0, '#4a3c3a'); g.addColorStop(1, '#2e2424');
                ctx.fillStyle = g; ctx.fillRect(0, y + 1, S, 14);
                ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
                for (let k = 0; k < 4; k++) { const yy = y + 3 + r() * 10; ctx.beginPath(); ctx.moveTo(0, yy); for (let x = 0; x <= S; x += 16) ctx.lineTo(x, yy + (r() - 0.5) * 1.5); ctx.stroke(); }
                const seam = (y / 16) % 2 ? 40 : 90;
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(seam, y + 1, 2, 14);
                ctx.fillStyle = '#7a7480'; ctx.fillRect(seam - 4, y + 4, 1.6, 1.6); ctx.fillRect(seam + 4, y + 10, 1.6, 1.6);
            }
            for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(90,120,70,0.35)'; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 4 + r() * 8, 2, r() * 3, 0, Math.PI * 2); ctx.fill(); }
        }, 71)
    };
    const initBase = Graphics.init;
    Graphics.init = function () {
        initBase.call(this);
        for (const m of MATS) this.textures[m] = T[m]();
    };
    const patBase = Level.prototype.getMaterialPattern;
    Level.prototype.getMaterialPattern = function () {
        return MATS.includes(this.material) ? Graphics.textures[this.material] : patBase.call(this);
    };

    // ---------- surface finishes ----------
    const FINISH = {
        neon(ctx, p, w, h, t) {
            const hue = (p.seed * 37) % 3, rgb = ['0,229,255', '255,45,149', '170,255,0'][hue | 0];
            const pulse = 0.65 + 0.35 * Math.sin(t * 0.08 + p.seed);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(${rgb},${0.25 * pulse})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(1, 1.5); ctx.lineTo(w - 1, 1.5); ctx.stroke();
            ctx.strokeStyle = `rgba(${rgb},${0.95 * pulse})`; ctx.lineWidth = 2; ctx.stroke();
            ctx.strokeStyle = `rgba(${rgb},${0.35 * pulse})`; ctx.lineWidth = 1; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
            // a light travelling along the edge
            const lx = (t * 3 + p.seed * 13) % (w + 60) - 30;
            const g = ctx.createRadialGradient(lx, 1.5, 0, lx, 1.5, 18); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(lx - 18, -16, 36, 34);
            // underglow
            const ug = ctx.createLinearGradient(0, h, 0, h + 26); ug.addColorStop(0, `rgba(${rgb},${0.22 * pulse})`); ug.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = ug; ctx.fillRect(4, h, w - 8, 26);
            ctx.restore();
        },
        lava(ctx, p, w, h, t) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const pulse = 0.6 + 0.4 * Math.sin(t * 0.05 + p.seed);
            const g = ctx.createLinearGradient(0, 0, 0, 6); g.addColorStop(0, `rgba(255,170,60,${0.7 * pulse})`); g.addColorStop(1, 'rgba(255,80,0,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, 6);
            // lava drips glowing under the ledge
            for (let x = (p.seed % 19) + 8; x < w - 6; x += 34 + (p.seed % 13)) {
                const k = ((t * 0.02 + x * 0.13 + p.seed) % 1), len = 4 + k * 10;
                const dg = ctx.createLinearGradient(0, h, 0, h + len); dg.addColorStop(0, 'rgba(255,200,90,0.9)'); dg.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.fillStyle = dg; ctx.fillRect(x - 1.5, h, 3, len);
            }
            const ug = ctx.createLinearGradient(0, h, 0, h + 30); ug.addColorStop(0, `rgba(255,90,20,${0.25 * pulse})`); ug.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = ug; ctx.fillRect(4, h, w - 8, 30);
            ctx.restore();
        },
        ocean(ctx, p, w, h, t) {
            // coral lip, seaweed tufts swaying, a shell or two
            ctx.fillStyle = '#e6d3a8'; ctx.fillRect(0, 0, w, 3);
            for (let x = (p.seed % 23) + 6; x < w - 6; x += 22 + (p.seed % 9)) {
                const sway = Math.sin(t * 0.04 + x * 0.3 + p.seed) * 3;
                ctx.strokeStyle = '#2e8a6a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x, 1); ctx.quadraticCurveTo(x + sway, -6, x + sway * 1.6, -12); ctx.stroke();
                if ((x * 7 + p.seed) % 3 < 1) { ctx.fillStyle = ['#ff8a80', '#f48fb1', '#ffab40'][(x | 0) % 3]; ctx.beginPath(); ctx.arc(x + 8, -2, 3, Math.PI, 0); ctx.fill(); }
            }
            // caustic shimmer on the top
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,250,255,0.18)'; ctx.lineWidth = 1;
            ctx.beginPath(); for (let x = 0; x <= w; x += 6) ctx.lineTo(x, 5 + Math.sin(x * 0.12 + t * 0.06) * 2); ctx.stroke(); ctx.restore();
        },
        candy(ctx, p, w, h, t) {
            // frosting with drips and sprinkles
            const fr = ['#fff8f0', '#ffd1e3', '#d1f2ff'][(p.seed | 0) % 3];
            ctx.fillStyle = fr;
            ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(w, -2); ctx.lineTo(w, 4);
            for (let x = w; x >= 0; x -= 9) { const d = ((x * 13 + p.seed) % 17) > 11 ? 6 + ((x * 7 + p.seed) % 8) : 0; ctx.lineTo(x, 4 + d); ctx.lineTo(x - 4.5, 4); }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
            const cols = ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb'];
            for (let i = 0; i < w / 7; i++) { const x = (i * 7.3 + p.seed * 3) % w, y = ((i * 5.7 + p.seed) % 3); ctx.fillStyle = cols[i % 5]; ctx.save(); ctx.translate(x, y); ctx.rotate(i); ctx.fillRect(-2, -0.6, 4, 1.2); ctx.restore(); }
            ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(4, -1, w - 8, 1.2);
        },
        haunted(ctx, p, w, h, t) {
            // moss on top, a cobweb in a corner, faint ghostly glow beneath
            ctx.fillStyle = 'rgba(70,100,60,0.8)';
            for (let x = (p.seed % 17); x < w - 8; x += 26 + (p.seed % 11)) { ctx.beginPath(); ctx.ellipse(x + 6, 0.5, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
            if (w > 80) {
                const cx = (p.seed % 2) < 1 ? 0 : w, sgn = cx ? -1 : 1;
                ctx.strokeStyle = 'rgba(220,220,235,0.35)'; ctx.lineWidth = 0.6;
                for (let i = 0; i < 4; i++) { const a = i / 3 * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(cx + sgn * Math.cos(a) * 22, h + Math.sin(a) * 22); ctx.stroke(); }
                for (let r = 7; r < 22; r += 7) { ctx.beginPath(); ctx.arc(cx, h, r, sgn > 0 ? 0 : Math.PI / 2, sgn > 0 ? Math.PI / 2 : Math.PI); ctx.stroke(); }
            }
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const ug = ctx.createLinearGradient(0, h, 0, h + 22); ug.addColorStop(0, `rgba(150,140,255,${0.1 + 0.06 * Math.sin(t * 0.04 + p.seed)})`); ug.addColorStop(1, 'rgba(150,140,255,0)');
            ctx.fillStyle = ug; ctx.fillRect(4, h, w - 8, 22);
            ctx.restore();
        }
    };
    Level.FINISH = FINISH;
    const drawBase = Level.prototype.drawPlatform;
    Level.prototype.drawPlatform = function (ctx, p, pattern) {
        drawBase.call(this, ctx, p, pattern);
        const f = FINISH[this.material];
        if (!f) return;
        ctx.save(); ctx.translate(p.x, p.y);
        f(ctx, p, p.width, p.height, this.time);
        ctx.restore();
    };
})();
