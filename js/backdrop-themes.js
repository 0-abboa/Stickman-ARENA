// Five more arena themes (materials): neon, lava, ocean, candy, haunted. Each gets three
// backdrop variants in the same recipe format as backdrop-variants.js, plus the new painters
// they need: skyline ridges, glowing wireframe ridges, chocolate drips, buildings, palms,
// lava falls, coral, kelp, lollipops, gravestones, pumpkins, shipwrecks, haunted mansions...
// Painters plug into BackdropLayers (DECO, ground tufts, landmarks, foreground props, particles).
(() => {
    const L = BackdropLayers, D = L.DECO;

    // ---------- scenery pieces that sit on ridges ----------
    Object.assign(D, {
        building(ctx, x, y, h, c, rng) {
            const w = h * (0.35 + rng() * 0.35), hh = h * (0.8 + rng() * 0.6);
            ctx.fillStyle = c; ctx.fillRect(x - w / 2, y - hh, w, hh + 2);
            if (rng() < 0.5) ctx.fillRect(x - w * 0.15, y - hh - h * 0.12, w * 0.3, h * 0.12);
            if (rng() < 0.4) { ctx.fillRect(x - 0.5, y - hh - h * 0.35, 1.2, h * 0.35); }
            const lit = ['255,220,140', '120,230,255', '255,110,200'][Math.floor(rng() * 3)];
            ctx.fillStyle = `rgba(${lit},0.55)`;
            for (let wy = y - hh + 4; wy < y - 4; wy += 6) for (let wx = x - w / 2 + 3; wx < x + w / 2 - 3; wx += 5) if (rng() < 0.35) ctx.fillRect(wx, wy, 2.4, 2.6);
        },
        antenna(ctx, x, y, h, c) {
            ctx.strokeStyle = c; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.moveTo(x - h * 0.15, y - h * 0.6); ctx.lineTo(x + h * 0.15, y - h * 0.6); ctx.stroke();
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,80,0.9)'; ctx.beginPath(); ctx.arc(x, y - h, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        },
        palm(ctx, x, y, h, c) {
            ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, h * 0.06);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * 0.15, y - h * 0.5, x + h * 0.05, y - h); ctx.stroke();
            ctx.fillStyle = c;
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + (i - 2.5) * 0.55, len = h * 0.5;
                ctx.save(); ctx.translate(x + h * 0.05, y - h); ctx.rotate(a + Math.PI / 2);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.25, len, len * 0.2); ctx.quadraticCurveTo(len * 0.5, 0, 0, 0); ctx.fill();
                ctx.restore();
            }
        },
        lavaFall(ctx, x, y, h, c) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, y, 0, y + h * 2.4);
            g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(0.4, 'rgba(255,110,30,0.7)'); g.addColorStop(1, 'rgba(255,60,10,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x - 5, y + h, x - 8, y + h * 2.4); ctx.lineTo(x + 8, y + h * 2.4); ctx.quadraticCurveTo(x + 5, y + h, x + 3, y); ctx.closePath(); ctx.fill();
            const gl = ctx.createRadialGradient(x, y + h * 0.6, 1, x, y + h * 0.6, h * 1.4);
            gl.addColorStop(0, 'rgba(255,120,40,0.25)'); gl.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = gl; ctx.fillRect(x - h * 1.4, y - h, h * 2.8, h * 3);
            ctx.restore();
        },
        obsidian(ctx, x, y, h, c, rng) {
            const w = h * 0.18;
            ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + (rng() - 0.5) * w, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(160,120,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - h * 0.2); ctx.lineTo(x, y - h * 0.9); ctx.stroke();
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,100,30,0.5)'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.stroke(); ctx.restore();
        },
        coral(ctx, x, y, h, c, rng) {
            ctx.strokeStyle = c; ctx.lineCap = 'round';
            const br = (bx, by, a, len, wd, d) => {
                const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
                ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
                if (d > 0) { br(ex, ey, a - 0.45 - rng() * 0.3, len * 0.7, wd * 0.75, d - 1); br(ex, ey, a + 0.45 + rng() * 0.3, len * 0.7, wd * 0.75, d - 1); }
                else { ctx.fillStyle = BG.mix(c, '#ffffff', 0.35); ctx.beginPath(); ctx.arc(ex, ey, wd * 0.9, 0, Math.PI * 2); ctx.fill(); }
            };
            br(x, y + 2, -Math.PI / 2, h * 0.38, Math.max(2, h * 0.09), 3);
        },
        seaweed(ctx, x, y, h, c) {
            ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, h * 0.08); ctx.lineCap = 'round';
            for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * 3, y); ctx.bezierCurveTo(x + k * 3 + 8, y - h * 0.3, x + k * 3 - 8, y - h * 0.6, x + k * 4 + 3, y - h * (0.8 + Math.abs(k) * 0.1)); ctx.stroke(); }
        },
        anemone(ctx, x, y, h, c) {
            const rgb = BG.rgb(c).join(',');
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - h * 0.4, 1, x, y - h * 0.4, h); gl.addColorStop(0, `rgba(${rgb},0.35)`); gl.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = gl; ctx.fillRect(x - h, y - h * 1.4, h * 2, h * 1.6);
            ctx.strokeStyle = `rgba(${rgb},0.9)`; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.22; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * h * 0.5, y + Math.sin(a) * h * 0.4, x + Math.cos(a) * h * 0.7, y + Math.sin(a) * h * 0.8); ctx.stroke(); }
            ctx.restore();
        },
        lollipop(ctx, x, y, h, c) {
            ctx.fillStyle = '#f5f5f5'; ctx.fillRect(x - h * 0.03, y - h * 0.65, h * 0.06, h * 0.65);
            const r = h * 0.3, cy = y - h * 0.65 - r * 0.8;
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = r * 0.22;
            ctx.beginPath(); for (let a = 0; a < 12; a += 0.3) { const rr = r * a / 12; ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.stroke();
        },
        candyCane(ctx, x, y, h) {
            ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, h * 0.12);
            const path = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 0.8); ctx.arc(x + h * 0.15, y - h * 0.8, h * 0.15, Math.PI, 0); };
            ctx.strokeStyle = '#ffffff'; path(); ctx.stroke();
            ctx.strokeStyle = '#e53935'; ctx.setLineDash([h * 0.1, h * 0.1]); path(); ctx.stroke(); ctx.setLineDash([]);
        },
        gumdrop(ctx, x, y, h, c) {
            const g = ctx.createLinearGradient(0, y - h * 0.6, 0, y);
            g.addColorStop(0, BG.mix(c, '#ffffff', 0.4)); g.addColorStop(1, c);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - h * 0.4, y); ctx.quadraticCurveTo(x - h * 0.42, y - h * 0.6, x, y - h * 0.6); ctx.quadraticCurveTo(x + h * 0.42, y - h * 0.6, x + h * 0.4, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 4; i++) ctx.fillRect(x - h * 0.25 + i * h * 0.14, y - h * 0.4 + (i % 2) * h * 0.12, 1.6, 1.6);
        },
        gravestone(ctx, x, y, h, c, rng) {
            const w = h * 0.45, tilt = (rng() - 0.5) * 0.25;
            ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
            ctx.fillStyle = c;
            if (rng() < 0.3) { ctx.fillRect(-h * 0.05, -h, h * 0.1, h); ctx.fillRect(-h * 0.25, -h * 0.75, h * 0.5, h * 0.1); }
            else { ctx.beginPath(); ctx.moveTo(-w / 2, 2); ctx.lineTo(-w / 2, -h * 0.65); ctx.arc(0, -h * 0.65, w / 2, Math.PI, 0); ctx.lineTo(w / 2, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-w * 0.3, -h * 0.6, w * 0.6, h * 0.06); }
            ctx.restore();
        },
        pumpkin(ctx, x, y, h, c) {
            const r = h * 0.4;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const gl = ctx.createRadialGradient(x, y - r, 1, x, y - r, r * 3); gl.addColorStop(0, 'rgba(255,150,40,0.3)'); gl.addColorStop(1, 'rgba(255,100,0,0)');
            ctx.fillStyle = gl; ctx.fillRect(x - r * 3, y - r * 4, r * 6, r * 6); ctx.restore();
            ctx.fillStyle = c; for (const dx of [-0.45, 0.45, 0]) { ctx.beginPath(); ctx.ellipse(x + dx * r, y - r, r * 0.6, r * 0.85, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = '#3e5a1a'; ctx.fillRect(x - 1.5, y - r * 2, 3, r * 0.4);
            ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 1.2); ctx.lineTo(x - r * 0.2, y - r * 1.45); ctx.lineTo(x - r * 0.05, y - r * 1.2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 1.2); ctx.lineTo(x + r * 0.2, y - r * 1.45); ctx.lineTo(x + r * 0.4, y - r * 1.2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x - r * 0.45, y - r * 0.85); ctx.quadraticCurveTo(x, y - r * 0.5, x + r * 0.45, y - r * 0.85); ctx.quadraticCurveTo(x, y - r * 0.7, x - r * 0.45, y - r * 0.85); ctx.fill();
        },
        reed(ctx, x, y, h, c) {
            ctx.strokeStyle = c; ctx.lineWidth = 1.4;
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 2, y); ctx.quadraticCurveTo(x + k * 2 + 3, y - h * 0.5, x + k * 3 - 2, y - h * (0.7 + k * 0.08)); ctx.stroke(); }
            ctx.fillStyle = BG.mix(c, '#3e2723', 0.6); ctx.fillRect(x + 2, y - h * 0.85, 2.4, h * 0.18);
        }
    });

    // ---------- new ridge shapes and finishes ----------
    const ridgeBase = L.ridge;
    L.ridge = function (ctx, rng, W, H, s, V) {
        if (s.shape === 'skyline' && s.anchor !== 'top') {
            const M = BACKDROP_MARGIN, base = H * s.base, amp = H * s.amp * 1.25;
            let x = -M;
            const g = ctx.createLinearGradient(0, base - amp, 0, H);
            g.addColorStop(0, s.c[0]); g.addColorStop(1, s.c[1]);
            ctx.fillStyle = g;
            const tops = [];
            while (x < W + M) {
                const w = 20 + rng() * 50 + s.t * 30, h = amp * (0.25 + rng() * 0.85);
                ctx.fillRect(x, base - h, w + 1, H + M - base + h);
                if (rng() < 0.3) { ctx.fillRect(x + w * 0.4, base - h - amp * 0.12, w * 0.2, amp * 0.12); ctx.fillRect(x + w * 0.48, base - h - amp * 0.3, 2, amp * 0.2); }
                tops.push([x, base - h, w]);
                x += w + (rng() < 0.2 ? 6 : 0);
            }
            // lit windows on the nearer layers
            if (s.t > 0.25) {
                for (const [bx, by, bw] of tops) for (let wy = by + 5; wy < H; wy += 7) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
                    if (rng() < 0.22) { ctx.fillStyle = `rgba(${['255,220,140', '140,230,255', '255,120,210'][Math.floor(rng() * 3)]},${0.25 + 0.35 * s.t})`; ctx.fillRect(wx, wy, 2.4, 3); }
                }
            }
            if (s.wire) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${s.wire},0.5)`; ctx.lineWidth = 1.2; for (const [bx, by, bw] of tops) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke(); } ctx.restore(); }
            for (const d of [].concat(s.deco || [])) {
                const count = d.n * (W / 1500 + 0.3);
                for (let i = 0; i < count; i++) { const t = tops[Math.floor(rng() * tops.length)]; D[d.k].call(D, ctx, t[0] + rng() * t[2], t[1], d.h * (0.7 + rng() * 0.6), BG.pick(d.c, rng), rng); }
            }
            if (s.fog) this.fog(ctx, W, base - amp, H, s.fog);
            return;
        }
        ridgeBase.call(this, ctx, rng, W, H, s, V);
        // Glowing wireframe outline (synthwave mountains) or chocolate drips along the crest
        if ((s.wire || s.drip) && s.anchor !== 'top') {
            const M = BACKDROP_MARGIN, step = 24;
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            if (s.wire) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = `rgba(${s.wire},${0.18 + 0.3 * s.t})`; ctx.lineWidth = 1;
                for (let x = -M; x < W + M; x += step) { ctx.beginPath(); ctx.moveTo(x, H * (s.base - s.amp * 1.4)); ctx.lineTo(x + (x - W / 2) * 0.15, H); ctx.stroke(); }
                for (let y = H * (s.base - s.amp); y < H; y += Math.max(6, 10 + (y - H * s.base) * 0.1)) { ctx.beginPath(); ctx.moveTo(-M, y); ctx.lineTo(W + M, y); ctx.stroke(); }
            }
            if (s.drip) {
                ctx.fillStyle = s.drip;
                const top = H * (s.base - s.amp * 1.6);
                for (let x = -M; x < W + M; x += 10 + rng() * 14) { const len = 8 + rng() * 26; ctx.beginPath(); ctx.moveTo(x - 4, top - 40); ctx.lineTo(x - 4, top + len); ctx.arc(x, top + len, 4, Math.PI, 0, true); ctx.lineTo(x + 4, top - 40); ctx.fill(); }
            }
            ctx.restore();
        }
    };

    // Ridge finishes (wire, drip) ride along from the recipe onto each ridge layer
    const planBase = L.plan;
    L.plan = function (V) {
        const st = planBase.call(this, V);
        if (V.ridges) for (const s of st) if (s.k === 'ridge' && s.anchor !== 'top') { s.wire = V.ridges.wire; s.drip = V.ridges.drip; }
        return st;
    };

    // ---------- landmarks ----------
    const landmarkBase = L.landmark;
    L.landmark = function (ctx, rng, W, H, s, Mx) {
        const x = Mx + (W - 2 * Mx) * s.x, y = H * s.y, z = s.size, c = s.c || ['#333', '#111'];
        // Landmark palettes may mix CSS hex colors with the RGB triplets used by
        // older glow painters. Canvas rgba() only accepts the latter inside it.
        const asRgb = (color, fallback) => {
            const value = color || fallback;
            return typeof value === 'string' && value[0] === '#' ? BG.rgb(value).join(',') : value;
        };
        const glow = (gx, gy, r, rgb, a) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); ctx.restore(); };
        switch (s.kind) {
            case 'spireTower':
                ctx.fillStyle = c[0];
                ctx.beginPath(); ctx.moveTo(x - z * 0.18, y); ctx.lineTo(x - z * 0.08, y - z * 1.6); ctx.lineTo(x + z * 0.08, y - z * 1.6); ctx.lineTo(x + z * 0.18, y); ctx.closePath(); ctx.fill();
                ctx.fillRect(x - z * 0.22, y - z * 1.15, z * 0.44, z * 0.1);
                ctx.fillRect(x - 1, y - z * 2.1, 2, z * 0.5);
                const towerGlow = asRgb(c[1], '255,60,90');
                glow(x, y - z * 2.1, z * 0.4, towerGlow, 0.8);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${towerGlow},0.6)`;
                for (let i = 0; i < 8; i++) ctx.fillRect(x - z * 0.06, y - z * (0.2 + i * 0.17), z * 0.12, 2);
                ctx.restore();
                return;
            case 'billboard': {
                ctx.fillStyle = '#111'; ctx.fillRect(x - 2, y - z * 0.8, 4, z * 0.8);
                const g = ctx.createLinearGradient(x - z * 0.6, 0, x + z * 0.6, 0);
                g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
                ctx.fillStyle = g; ctx.fillRect(x - z * 0.6, y - z * 1.2, z * 1.2, z * 0.45);
                glow(x, y - z * 1, z, BG.rgb(c[0]).join(','), 0.25);
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold ${Math.round(z * 0.16)}px Orbitron, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(s.text || 'FIGHT', x, y - z * 0.92);
                return;
            }
            case 'gate':
                ctx.fillStyle = c[0];
                ctx.fillRect(x - z * 0.7, y - z * 1.2, z * 0.25, z * 1.2); ctx.fillRect(x + z * 0.45, y - z * 1.2, z * 0.25, z * 1.2);
                ctx.beginPath(); ctx.moveTo(x - z * 0.8, y - z * 1.2); ctx.quadraticCurveTo(x, y - z * 1.8, x + z * 0.8, y - z * 1.2); ctx.lineTo(x + z * 0.7, y - z * 1.05); ctx.quadraticCurveTo(x, y - z * 1.55, x - z * 0.7, y - z * 1.05); ctx.closePath(); ctx.fill();
                for (const sx of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(x + sx * z, y - z * 1.2); ctx.lineTo(x + sx * z * 1.15, y - z * 1.55); ctx.lineTo(x + sx * z * 0.9, y - z * 1.3); ctx.fill(); }
                glow(x, y - z * 0.6, z * 0.8, '255,90,30', 0.55);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,40,0.35)'; ctx.fillRect(x - z * 0.45, y - z * 1.1, z * 0.9, z * 1.1); ctx.restore();
                return;
            case 'shipwreck':
                ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18);
                ctx.fillStyle = c[0];
                ctx.beginPath(); ctx.moveTo(-z, -z * 0.35); ctx.lineTo(z * 0.9, -z * 0.4); ctx.quadraticCurveTo(z * 0.8, 0, z * 0.5, z * 0.05); ctx.lineTo(-z * 0.7, z * 0.05); ctx.closePath(); ctx.fill();
                ctx.fillRect(-z * 0.1, -z * 1.3, z * 0.06, z * 0.95); ctx.fillRect(z * 0.45, -z * 1.0, z * 0.05, z * 0.65);
                ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(-z * 0.07, -z * 1.25); ctx.lineTo(z * 0.35, -z * 0.95); ctx.lineTo(-z * 0.07, -z * 0.7); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-z * 0.5 + i * z * 0.32, -z * 0.18, z * 0.04, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
                return;
            case 'candyCastle': {
                const tw = z * 0.24;
                for (const [dx, th, col] of [[-0.6, 1.1, c[0]], [0.6, 1.1, c[0]], [-0.25, 1.5, c[1]], [0.25, 1.4, c[1]], [0, 1.8, c[0]]]) {
                    const tx = x + dx * z;
                    ctx.fillStyle = col; ctx.fillRect(tx - tw / 2, y - z * th, tw, z * th);
                    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(tx - tw / 2, y - z * th + k * z * 0.3 + 6, tw, 3);
                    ctx.fillStyle = c[2] || '#ff80ab'; ctx.beginPath(); ctx.moveTo(tx - tw * 0.7, y - z * th); ctx.lineTo(tx, y - z * th - z * 0.4); ctx.lineTo(tx + tw * 0.7, y - z * th); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, y - z * th - z * 0.42, 3, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = c[1]; ctx.fillRect(x - z * 0.6, y - z * 0.55, z * 1.2, z * 0.55);
                ctx.fillStyle = '#5d3a1a'; ctx.beginPath(); ctx.arc(x, y - z * 0.18, z * 0.16, Math.PI, 0); ctx.fillRect(x - z * 0.16, y - z * 0.18, z * 0.32, z * 0.18); ctx.fill();
                return;
            }
            case 'mansion': {
                ctx.fillStyle = c[0];
                ctx.fillRect(x - z * 0.8, y - z * 0.7, z * 1.6, z * 0.7);
                ctx.beginPath(); ctx.moveTo(x - z * 0.9, y - z * 0.7); ctx.lineTo(x - z * 0.3, y - z * 1.15); ctx.lineTo(x + z * 0.3, y - z * 1.15); ctx.lineTo(x + z * 0.9, y - z * 0.7); ctx.closePath(); ctx.fill();
                ctx.fillRect(x + z * 0.45, y - z * 1.5, z * 0.22, z * 0.9);
                ctx.beginPath(); ctx.moveTo(x + z * 0.4, y - z * 1.5); ctx.lineTo(x + z * 0.56, y - z * 1.85); ctx.lineTo(x + z * 0.72, y - z * 1.5); ctx.fill();
                ctx.fillRect(x - z * 0.6, y - z * 1.3, z * 0.12, z * 0.3);
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                const windowGlow = asRgb(c[1], '255,200,90');
                for (const [wx, wy] of [[-0.55, -0.5], [-0.25, -0.5], [0.15, -0.5], [0.5, -1.25], [-0.1, -0.95]]) { ctx.fillStyle = `rgba(${windowGlow},0.8)`; ctx.fillRect(x + wx * z, y + wy * z, z * 0.09, z * 0.13); }
                ctx.restore();
                glow(x, y - z * 0.6, z, windowGlow, 0.15);
                return;
            }
            case 'bigMoon': {
                const cy = y - z;
                glow(x, cy, z * 3, '230,230,255', 0.25);
                const g = ctx.createRadialGradient(x - z * 0.3, cy - z * 0.3, z * 0.1, x, cy, z);
                g.addColorStop(0, '#fffde7'); g.addColorStop(1, c[0] || '#cfd8dc');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, z, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(120,120,150,0.2)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * z * 1.2, cy + (rng() - 0.5) * z * 1.2, z * (0.06 + rng() * 0.14), 0, Math.PI * 2); ctx.fill(); }
                return;
            }
            case 'retroSun': {
                const cy = y - z;
                glow(x, cy, z * 2.6, '255,90,170', 0.35);
                ctx.save(); ctx.beginPath(); ctx.arc(x, cy, z, 0, Math.PI * 2); ctx.clip();
                const g = ctx.createLinearGradient(0, cy - z, 0, cy + z); g.addColorStop(0, '#ffe66d'); g.addColorStop(0.5, '#ff8a5c'); g.addColorStop(1, '#ff2d95');
                ctx.fillStyle = g; ctx.fillRect(x - z, cy - z, z * 2, z * 2);
                ctx.globalCompositeOperation = 'destination-out';
                for (let i = 0; i < 7; i++) { const sy = cy + z * (0.05 + i * 0.14), sh = 2 + i * 1.6; ctx.fillRect(x - z, sy, z * 2, sh); }
                ctx.restore();
                return;
            }
        }
        landmarkBase.call(this, ctx, rng, W, H, s, Mx);
    };

    // ---------- the ground strip ----------
    const groundBase = L.ground;
    L.ground = function (ctx, rng, W, H, V) {
        groundBase.call(this, ctx, rng, W, H, V);
        const G = V.ground, M = BACKDROP_MARGIN, top = H * 0.935;
        const spots = (per, fn) => { const n = Math.round(W / per); for (let i = 0; i < n; i++) fn(-M + rng() * (W + M * 2), top - 4 + rng() * 14, i); };
        const pick = (a) => BG.pick(a, rng);
        switch (G.tufts) {
            case 'neonGrid':
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${G.glow || '255,60,200'},0.5)`; ctx.lineWidth = 1;
                for (let y = top + 4, k = 0; y < H + M; y += 4 + k * 3, k++) { ctx.beginPath(); ctx.moveTo(-M, y); ctx.lineTo(W + M, y); ctx.stroke(); }
                for (let x = -M; x < W + M; x += 30) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(W / 2 + (x - W / 2) * 2.4, H + M); ctx.stroke(); }
                ctx.restore();
                break;
            case 'lavaLake':
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                { const g = ctx.createLinearGradient(0, top, 0, H + M); g.addColorStop(0, 'rgba(255,200,90,0.85)'); g.addColorStop(0.3, 'rgba(255,90,20,0.6)'); g.addColorStop(1, 'rgba(120,20,0,0.3)'); ctx.fillStyle = g; ctx.fillRect(-M, top + 6, W + M * 2, H); }
                ctx.strokeStyle = 'rgba(255,240,160,0.6)'; ctx.lineWidth = 1.2;
                spots(40, (x, y) => { ctx.beginPath(); ctx.ellipse(x, y + 10, 10 + rng() * 14, 2, 0, 0, Math.PI * 2); ctx.stroke(); });
                ctx.restore();
                spots(90, (x, y) => this.DECO.obsidian(ctx, x, y + 8, 10 + rng() * 18, '#140808', rng));
                break;
            case 'coralBed':
                spots(46, (x, y) => this.DECO.coral(ctx, x, y + 8, 18 + rng() * 22, pick(G.c || ['#ff7f7f', '#ffb74d', '#f06292', '#ba68c8']), rng));
                spots(60, (x, y) => this.DECO.seaweed(ctx, x, y + 8, 20 + rng() * 30, '#2e7d5a'));
                spots(120, (x, y) => { ctx.fillStyle = '#f8e7c8'; ctx.beginPath(); ctx.ellipse(x, y + 8, 5, 3, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = 'rgba(160,120,90,0.6)'; ctx.lineWidth = 0.8; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + k * 2, y + 5); ctx.stroke(); } });
                break;
            case 'seabed':
                spots(70, (x, y) => this.DECO.rock(ctx, x, y + 8, 8 + rng() * 14, G.c || '#2a5a62'));
                spots(55, (x, y) => this.DECO.seaweed(ctx, x, y + 8, 22 + rng() * 26, '#2e6a50'));
                break;
            case 'abyss':
                spots(60, (x, y) => this.DECO.rock(ctx, x, y + 8, 8 + rng() * 16, '#0a1622'));
                spots(70, (x, y) => this.DECO.anemone(ctx, x, y + 8, 12 + rng() * 14, pick(['#4dd0e1', '#ba68c8', '#80deea'])));
                break;
            case 'candy':
                spots(70, (x, y) => this.DECO.gumdrop(ctx, x, y + 8, 12 + rng() * 10, pick(['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff'])));
                spots(150, (x, y) => this.DECO.candyCane(ctx, x, y + 8, 24 + rng() * 14));
                spots(10, (x, y) => { ctx.fillStyle = pick(['#ff5252', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb']); ctx.fillRect(x, y + rng() * 10, 3, 1.4); });
                break;
            case 'graves':
                spots(90, (x, y) => this.DECO.gravestone(ctx, x, y + 8, 18 + rng() * 14, pick(G.c || ['#4a4a5a', '#3a3a48']), rng));
                spots(220, (x, y) => this.DECO.deadtree(ctx, x, y + 8, 40 + rng() * 30, '#14121c', rng));
                break;
            case 'pumpkins':
                spots(110, (x, y) => this.DECO.pumpkin(ctx, x, y + 8, 14 + rng() * 10, pick(['#ff8f00', '#ef6c00'])));
                spots(40, (x, y) => { ctx.fillStyle = pick(['#8a4a1a', '#b5651d', '#5a2a0a']); ctx.beginPath(); ctx.ellipse(x, y + 6, 6, 2, rng() * 3, 0, Math.PI * 2); ctx.fill(); });
                break;
            case 'swamp':
                ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(40,70,40,0.4)'; ctx.fillRect(-M, top + 10, W + M * 2, H); ctx.restore();
                spots(30, (x, y) => this.DECO.reed(ctx, x, y + 8, 22 + rng() * 22, '#2a3a24'));
                break;
        }
    };

    // ---------- foreground props (top hang <= ~56px, bottoms rise <= ~46px) ----------
    const fgBase = L.fgSprite;
    L.fgSprite = function (kind, c, rng) {
        const col = (i) => c[i % c.length];
        switch (kind) {
            case 'wires': return this.spr(260, 60, (ctx, w, h) => {
                for (let k = 0; k < 3; k++) {
                    const y0 = 2 + k * 3, sag = 18 + k * 10;
                    ctx.strokeStyle = '#0b0b12'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(w / 2, y0 + sag * 2, w, y0); ctx.stroke();
                    for (let i = 1; i < 8; i++) { const u = i / 8, x = u * w, y = y0 + 4 * sag * u * (1 - u); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y + 3, 0, x, y + 3, 7); g.addColorStop(0, `rgba(${BG.rgb(col(i + k)).join(',')},0.95)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 7, y - 4, 14, 14); ctx.restore(); }
                }
            });
            case 'neonRail': return this.spr(240, 46, (ctx, w, h) => {
                ctx.fillStyle = '#07070d'; ctx.fillRect(0, h - 10, w, 10);
                for (let x = 6; x < w; x += 40) ctx.fillRect(x, h - 34, 4, 34);
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (const [y, ci] of [[h - 32, 0], [h - 20, 1]]) { ctx.strokeStyle = `rgba(${BG.rgb(col(ci)).join(',')},0.9)`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.strokeStyle = `rgba(${BG.rgb(col(ci)).join(',')},0.25)`; ctx.lineWidth = 8; ctx.stroke(); }
                ctx.restore();
            });
            case 'chains': return this.spr(240, 60, (ctx, w, h) => {
                for (let i = 0; i < 5; i++) {
                    const x = 18 + i * 50 + rng() * 10, len = 24 + rng() * 32;
                    ctx.strokeStyle = col(0); ctx.lineWidth = 2;
                    for (let y = 0; y < len; y += 7) { ctx.beginPath(); ctx.ellipse(x, y + 3, (y / 7) % 2 ? 1.4 : 3, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
                    ctx.fillStyle = col(1); ctx.beginPath(); ctx.moveTo(x - 4, len); ctx.quadraticCurveTo(x + 8, len + 8, x + 2, len + 14); ctx.lineTo(x, len + 6); ctx.fill();
                }
            });
            case 'lavaDrips': return this.spr(240, 58, (ctx, w, h) => {
                ctx.fillStyle = col(0); ctx.fillRect(0, 0, w, 8);
                for (let i = 0; i < 11; i++) D.stalactite(ctx, 10 + i * 22 + rng() * 8, 4, 18 + rng() * 30, col(0));
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < 6; i++) { const x = 14 + rng() * (w - 28), y = 14 + rng() * 26; const g = ctx.createRadialGradient(x, y, 0, x, y, 6); g.addColorStop(0, 'rgba(255,200,90,1)'); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 6, y - 6, 12, 12); }
                ctx.restore();
            });
            case 'kelp': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 14; i++) { const x = rng() * w, hh = 24 + rng() * 22; ctx.strokeStyle = col(i); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, h + 2); ctx.bezierCurveTo(x + 10, h - hh * 0.3, x - 10, h - hh * 0.6, x + 4, h - hh); ctx.stroke(); }
            });
            case 'coralFg': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 6; i++) D.coral(ctx, 14 + i * 42 + rng() * 10, h + 2, 34 + rng() * 22, col(i), rng);
            });
            case 'surface': return this.spr(260, 50, (ctx, w, h) => {
                const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col(0)); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
                for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, 6 + k * 6 + Math.sin(x * 0.08 + k) * 2); ctx.stroke(); }
            });
            case 'candyDrips': return this.spr(240, 56, (ctx, w, h) => {
                ctx.fillStyle = col(0); ctx.fillRect(0, 0, w, 10);
                for (let x = 0; x < w; x += 12 + rng() * 10) { const len = 10 + rng() * 34; ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x - 5, len); ctx.arc(x, len, 5, Math.PI, 0, true); ctx.lineTo(x + 5, 0); ctx.fill(); }
                for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb'][i % 5]; ctx.save(); ctx.translate(rng() * w, 2 + rng() * 8); ctx.rotate(rng() * 3); ctx.fillRect(-2, -0.7, 4, 1.4); ctx.restore(); }
            });
            case 'lollipops': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 4; i++) D.lollipop(ctx, 20 + i * 62 + rng() * 10, h + 2, 40 + rng() * 10, col(i));
                for (let i = 0; i < 5; i++) D.gumdrop(ctx, rng() * w, h + 2, 14 + rng() * 8, col(i + 1));
            });
            case 'cobwebs': return this.spr(240, 60, (ctx, w, h) => {
                ctx.strokeStyle = 'rgba(220,220,235,0.55)'; ctx.lineWidth = 0.8;
                for (const cx of [0, w]) {
                    for (let i = 0; i < 6; i++) { const a = (cx ? Math.PI / 2 : 0) + i / 5 * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.cos(a) * 56 * (cx ? -1 : 1) * (cx ? -1 : 1), Math.sin(a) * 56); ctx.stroke(); }
                    for (let r = 12; r < 56; r += 11) { ctx.beginPath(); ctx.arc(cx, 0, r, cx ? Math.PI / 2 : 0, cx ? Math.PI : Math.PI / 2); ctx.stroke(); }
                }
                ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.3, -2); ctx.quadraticCurveTo(w * 0.5, 14, w * 0.7, -2); ctx.stroke();
                ctx.strokeStyle = 'rgba(220,220,235,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(w * 0.5, 8); ctx.lineTo(w * 0.5, 40); ctx.stroke();
                ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(w * 0.5, 42, 4, 0, Math.PI * 2); ctx.fill();
            });
            case 'graveFence': return this.spr(240, 46, (ctx, w, h) => {
                ctx.fillStyle = col(0);
                ctx.fillRect(0, h - 30, w, 3); ctx.fillRect(0, h - 12, w, 3);
                for (let x = 4; x < w; x += 14) { ctx.fillRect(x, h - 40, 3, 40); ctx.beginPath(); ctx.moveTo(x - 2, h - 40); ctx.lineTo(x + 1.5, h - 46); ctx.lineTo(x + 5, h - 40); ctx.fill(); }
                D.gravestone(ctx, w * 0.7, h + 2, 30, col(1), rng);
            });
            case 'pumpkinsFg': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 4; i++) D.pumpkin(ctx, 26 + i * 60 + rng() * 10, h + 2, 28 + rng() * 10, col(i));
            });
            case 'reeds': return this.spr(240, 46, (ctx, w, h) => {
                for (let i = 0; i < 16; i++) D.reed(ctx, rng() * w, h + 2, 30 + rng() * 16, col(i));
            });
        }
        return fgBase.call(this, kind, c, rng);
    };

    // ---------- particles ----------
    const spawnBase = L.spawnParts, stepBase = L.stepParts, drawBase = L.drawParts;
    L.spawnParts = function (bd, rng, V, b, f) {
        const before = bd.parts[b].length;
        spawnBase.call(this, bd, rng, V, b, f);
        const W = bd.W, H = bd.H;
        for (const p of bd.parts[b].slice(before)) {
            switch (p.kind) {
                case 'bubble': p.s = 1.5 + rng() * 3.5; p.vy = -(0.3 + rng() * 0.6); break;
                case 'fish': p.s = 3 + rng() * 4; p.vx = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.6); p.vy = 0; p.y = H * (0.2 + rng() * 0.6); p.col = BG.pick(['#ffb74d', '#4fc3f7', '#f06292', '#fff176'], rng); break;
                case 'jelly': p.s = 6 + rng() * 8; p.vy = -(0.08 + rng() * 0.15); break;
                case 'sprinkle': p.s = 2 + rng() * 2; p.vy = 0.3 + rng() * 0.5; p.rot = rng() * 6; p.vr = (rng() - 0.5) * 0.08; p.col = BG.pick(['#ff5252', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb', '#ffffff'], rng); break;
                case 'bat': p.s = 0.6 + rng() * 0.6; p.vx = 0.6 + rng() * 0.8; p.vy = 0; p.y = H * (0.1 + rng() * 0.4); break;
                case 'ghostlight': p.s = 1.6 + rng() * 2; p.vy = (rng() - 0.5) * 0.1; p.y = H * (0.4 + rng() * 0.5); break;
                case 'neonDust': p.s = 1 + rng() * 1.5; p.vy = -(0.05 + rng() * 0.1); break;
            }
        }
    };
    L.stepParts = function (bd, dt) {
        stepBase.call(this, bd, dt);
        for (const list of bd.parts) for (const p of list) {
            switch (p.kind) {
                case 'bubble': p.x += Math.sin(p.ph * 2) * 0.3 * dt; p.y += p.vy * dt; break;
                case 'fish': p.x += p.vx * dt; p.y += Math.sin(p.ph) * 0.15 * dt; break;
                case 'jelly': p.y += p.vy * (1 + Math.sin(p.ph * 2)) * dt; p.x += Math.sin(p.ph * 0.5) * 0.1 * dt; break;
                case 'sprinkle': p.x += Math.sin(p.ph) * 0.3 * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
                case 'bat': p.x += p.vx * dt; p.y += Math.sin(p.ph * 3) * 0.6 * dt; break;
                case 'ghostlight': p.x += Math.sin(p.ph * 0.7) * 0.3 * dt; p.y += Math.cos(p.ph * 0.5) * 0.2 * dt; break;
                case 'neonDust': p.x += Math.sin(p.ph) * 0.15 * dt; p.y += p.vy * dt; break;
            }
        }
    };
    L.drawParts = function (ctx, bd, b) {
        const list = bd.parts[b], bs = PART_SCALE[b], own = [];
        const rest = [];
        for (const p of list) (['bubble', 'fish', 'jelly', 'sprinkle', 'bat', 'ghostlight', 'neonDust'].includes(p.kind) ? own : rest).push(p);
        if (rest.length) { const keep = bd.parts[b]; bd.parts[b] = rest; drawBase.call(this, ctx, bd, b); bd.parts[b] = keep; }
        for (const p of own) {
            const s = p.s * bs;
            switch (p.kind) {
                case 'bubble':
                    ctx.strokeStyle = 'rgba(200,235,255,0.55)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(p.x - s * 0.4, p.y - s * 0.5, 1.2, 1.2);
                    break;
                case 'fish':
                    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.vx < 0 ? -1 : 1, 1); ctx.globalAlpha = 0.7;
                    ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(-s * 1.5, -s * 0.45 * (1 + Math.sin(p.ph * 8) * 0.3)); ctx.lineTo(-s * 1.5, s * 0.45); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    break;
                case 'jelly': {
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
                    const pulse = 1 + 0.12 * Math.sin(p.ph * 4);
                    ctx.drawImage(Backdrop.dot('150,120,255'), p.x - s * 2, p.y - s * 2, s * 4, s * 4);
                    ctx.fillStyle = 'rgba(200,170,255,0.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * pulse, s * 0.7 / pulse, 0, Math.PI, 0); ctx.fill();
                    ctx.strokeStyle = 'rgba(200,170,255,0.4)'; ctx.lineWidth = 1;
                    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(p.x + k * s * 0.3, p.y); ctx.quadraticCurveTo(p.x + k * s * 0.3 + Math.sin(p.ph * 3 + k) * 3, p.y + s, p.x + k * s * 0.25, p.y + s * 2); ctx.stroke(); }
                    ctx.restore();
                    break;
                }
                case 'sprinkle':
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-s, -s * 0.3, s * 2, s * 0.6); ctx.restore();
                    break;
                case 'bat': {
                    const f = Math.sin(p.ph * 12) * 5 * p.s * bs;
                    ctx.fillStyle = 'rgba(10,8,16,0.85)';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x - 6 * bs * p.s, p.y - f - 3, p.x - 12 * bs * p.s, p.y - f); ctx.quadraticCurveTo(p.x - 6 * bs * p.s, p.y + 1, p.x, p.y + 2);
                    ctx.quadraticCurveTo(p.x + 6 * bs * p.s, p.y + 1, p.x + 12 * bs * p.s, p.y - f); ctx.quadraticCurveTo(p.x + 6 * bs * p.s, p.y - f - 3, p.x, p.y); ctx.fill();
                    break;
                }
                case 'ghostlight': case 'neonDust': {
                    const tw = 0.5 + 0.5 * Math.sin(p.ph * 3), sz = s * (p.kind === 'neonDust' ? 3 : 6);
                    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.6 * tw;
                    ctx.drawImage(Backdrop.dot(p.rgb || '140,255,170'), p.x - sz / 2, p.y - sz / 2, sz, sz);
                    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
                    break;
                }
            }
        }
    };

    // ---------- live ambience: light shafts, searchlights, coloured window flicker ----------
    const skyBase = L.animSky;
    L.animSky = function (ctx, bd) {
        skyBase.call(this, ctx, bd);
        const a = bd.V.ambient || {}, t = bd.time, W = bd.W, H = bd.H;
        if (a.shafts) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 7; i++) {
                const x = W * (0.08 + i * 0.14) + Math.sin(t * 0.004 + i) * 30, w = 40 + 30 * Math.sin(i * 2.3);
                const al = (0.05 + 0.035 * Math.sin(t * 0.01 + i * 1.3)) * (a.shaftA || 1);
                const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
                g.addColorStop(0, `rgba(${a.shaftRgb || '180,240,255'},${al})`); g.addColorStop(1, `rgba(${a.shaftRgb || '180,240,255'},0)`);
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.3, 0); ctx.lineTo(x + w * 0.3, 0); ctx.lineTo(x + w * 1.6 + 60, H * 0.9); ctx.lineTo(x + w * 0.2 + 60, H * 0.9); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
        if (a.searchlights) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const x = W * (0.2 + i * 0.3), ang = -Math.PI / 2 + Math.sin(t * 0.006 + i * 2) * 0.6, len = H * 1.1;
                const g = ctx.createLinearGradient(x, H * 0.75, x + Math.cos(ang) * len, H * 0.75 + Math.sin(ang) * len);
                g.addColorStop(0, 'rgba(200,230,255,0.16)'); g.addColorStop(1, 'rgba(200,230,255,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, H * 0.75); ctx.lineTo(x + Math.cos(ang - 0.05) * len, H * 0.75 + Math.sin(ang - 0.05) * len); ctx.lineTo(x + Math.cos(ang + 0.05) * len, H * 0.75 + Math.sin(ang + 0.05) * len); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
        if (a.lavaGlow) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, H * 0.6, 0, H);
            g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, `rgba(255,90,20,${0.14 + 0.06 * Math.sin(t * 0.03)})`);
            ctx.fillStyle = g; ctx.fillRect(-100, H * 0.6, W + 200, H * 0.5);
            ctx.restore();
        }
    };
    L.animMid = function (ctx, bd, layer) {
        if (!bd.windows.length) return;
        ctx.save();
        ctx.translate(-layer.mx, 0);
        ctx.globalCompositeOperation = 'lighter';
        for (const w of bd.windows) {
            const fl = 0.45 + 0.35 * Math.sin(bd.time * 0.07 + w.ph) * Math.sin(bd.time * 0.031 + w.ph * 2);
            const pad = w.rgb ? 0.6 : 3;   // city windows are small and sharp; fortress windows glow wide
            ctx.fillStyle = `rgba(${w.rgb || '255,180,80'},${fl})`;
            ctx.fillRect(w.x - pad, w.y - pad, w.w + pad * 2, w.h + pad * 2);
        }
        ctx.restore();
    };

    // A city of lit windows that flicker (mid layer)
    BackdropScenery.city = function (ctx, W, H, rng, bd, V) {
        const base = H * 0.86, cols = (V.city && V.city.c) || ['#0d0b1e', '#14112c'];
        let x = -20;
        while (x < W + 20) {
            const w = 40 + rng() * 70, h = H * (0.18 + rng() * 0.32);
            ctx.fillStyle = BG.pick(cols, rng); ctx.fillRect(x, base - h, w, h + 200);
            for (let wy = base - h + 8; wy < base - 6; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
                if (rng() < 0.18) bd.windows.push({ x: wx, y: wy, w: 3, h: 4, ph: rng() * 6, rgb: BG.pick((V.city && V.city.lit) || ['255,200,120', '120,230,255', '255,100,210'], rng) });
                else if (rng() < 0.3) { ctx.fillStyle = 'rgba(255,220,160,0.12)'; ctx.fillRect(wx, wy, 4, 5); }
            }
            if (rng() < 0.4) { ctx.fillStyle = BG.pick(cols, rng); ctx.fillRect(x + w / 2 - 1, base - h - 30, 2, 30); }
            x += w + 4 + rng() * 10;
        }
    };

    // ---------- the 15 variants ----------
    const C = (shade, hi, lo) => ({ shade, hi, lo });
    Object.assign(BG_VARIANTS, {
        neon: [
            {
                name: 'Neon Downtown',
                sky: [[0, '#05010f'], [0.45, '#1a0a3d'], [0.8, '#4a1a6e'], [1, '#c2408a']],
                body: { kind: 'moon', x: 0.82, y: 0.18, r: 22, rgb: '255,170,230' }, haze: '220,80,200', stars: 80,
                cloudTint: C('40,15,70', '160,90,200', '90,40,130'),
                ridges: { n: 7, base: [0.62, 0.9], amp: [0.18, 0.08], oct: [3, 3], far: ['#3a1a5e', '#5a2a7e'], near: ['#0a0614', '#05030a'], fog: [0.5, 0.08], shape: 'skyline', wire: '255,60,200',
                    deco: (t) => t < 0.5 ? null : { k: 'antenna', n: 10, h: 26, c: '#05030a' } },
                mid: 'city', midF: 0.34,
                extras: [{ k: 'landmark', kind: 'spireTower', f: 0.2, x: 0.62, y: 0.78, size: 120, c: ['#120a24', '255,60,120'] },
                         { k: 'landmark', kind: 'billboard', f: 0.42, x: 0.2, y: 0.82, size: 90, c: ['#ff2d95', '#00e5ff'], text: 'STICK FIGHT' }],
                clouds: cloudBands(0.25, [0.08, 0.3], 0.05), mist: mistBands('200,60,180', 0.18, [0.66, 0.8]),
                parts: [{ kind: 'rain', n: [40, 22] }, { kind: 'neonDust', n: [24, 12], rgb: '255,90,220' }],
                ambient: { searchlights: true },
                ground: { top: '#0d0718', bot: '#05030a', tufts: 'neonGrid', glow: '255,60,200' },
                fg: { top: { k: 'wires', c: ['#ff2d95', '#00e5ff', '#ffea00'] }, bottom: { k: 'neonRail', c: ['#00e5ff', '#ff2d95'] } },
                post: 'neon'
            },
            {
                name: 'Synthwave Horizon',
                sky: [[0, '#0b0326'], [0.4, '#2d0b5a'], [0.7, '#a1207d'], [1, '#ff7a59']],
                body: null, haze: '255,90,160', stars: 160,
                cloudTint: C('90,20,90', '255,150,200', '200,80,160'),
                ridges: { n: 6, base: [0.6, 0.86], amp: [0.2, 0.07], oct: [3, 2], far: ['#3a0f5a', '#5a1a7a'], near: ['#14052a', '#0a0218'], fog: [0.35, 0.05], wire: '255,60,220',
                    deco: (t) => t < 0.6 ? null : { k: 'palm', n: 8, h: 54, c: '#0a0218' } },
                extras: [{ k: 'landmark', kind: 'retroSun', f: 0.06, x: 0.5, y: 0.66, size: 110 }],
                clouds: cloudBands(0.3, [0.1, 0.3], 0.04), mist: mistBands('255,90,180', 0.16, [0.66, 0.8]),
                parts: [{ kind: 'neonDust', n: [30, 14], rgb: '0,230,255' }],
                ambient: { shooting: true },
                ground: { top: '#120320', bot: '#05010c', tufts: 'neonGrid', glow: '0,230,255' },
                fg: { top: null, bottom: { k: 'neonRail', c: ['#ff2dd5', '#00e5ff'] } },
                post: 'synth'
            },
            {
                name: 'Cyber Rooftops',
                sky: [[0, '#020814'], [0.5, '#0a2238'], [0.85, '#164a5e'], [1, '#2f7a7a']],
                body: null, haze: '60,200,200',
                cloudTint: C('10,30,40', '80,150,160', '40,90,100'),
                ridges: { n: 8, base: [0.55, 0.9], amp: [0.22, 0.08], oct: [3, 3], far: ['#164a5e', '#246070'], near: ['#03080e', '#020408'], fog: [0.55, 0.1], shape: 'skyline', wire: '0,255,200',
                    deco: (t) => t < 0.4 ? null : { k: 'antenna', n: 14, h: 30, c: '#020408' } },
                mid: 'city', midF: 0.36, city: { c: ['#06121a', '#0a1a24'], lit: ['0,255,200', '120,200,255', '255,240,140'] },
                extras: [{ k: 'landmark', kind: 'billboard', f: 0.3, x: 0.72, y: 0.7, size: 110, c: ['#00e5c4', '#2962ff'], text: 'ARENA' },
                         { k: 'landmark', kind: 'spireTower', f: 0.14, x: 0.3, y: 0.72, size: 100, c: ['#0a1a24', '0,255,200'] }],
                clouds: cloudBands(0.4, [0.04, 0.24], 0.07), mist: mistBands('60,200,200', 0.22, [0.6, 0.8]),
                parts: [{ kind: 'rain', n: [70, 40] }],
                ambient: { searchlights: true, lightning: true },
                ground: { top: '#04121a', bot: '#020608', tufts: 'neonGrid', glow: '0,255,200' },
                fg: { top: { k: 'wires', c: ['#00e5c4', '#ffea00', '#2979ff'] }, bottom: { k: 'neonRail', c: ['#00e5c4', '#2979ff'] } },
                post: 'cyber'
            }
        ],
        lava: [
            {
                name: 'Molten Core',
                sky: [[0, '#0d0202'], [0.5, '#3a0a04'], [0.85, '#8a2a0a'], [1, '#ff6a1a']],
                body: null, haze: '255,90,30',
                cloudTint: C('40,10,5', '140,50,25', '90,30,15'),
                ridges: { n: 10, base: [0.6, 0.9], amp: [0.18, 0.06], oct: [6, 4], far: ['#5a1a0a', '#7a2a10'], near: ['#0a0202', '#050101'], fog: [0.5, 0.12], lava: true,
                    deco: (t) => t < 0.3 ? { k: 'lavaFall', n: 4, h: 30, c: '#ff6a1a' } : t < 0.7 ? { k: 'obsidian', n: 18, h: 44, c: '#120404' } : { k: 'obsidian', n: 14, h: 62, c: '#070101' } },
                ceil: { n: 6, base: [0.04, 0.18], amp: [0.1, 0.12], far: ['#3a0a04', '#5a1a0a'], near: ['#080101', '#030000'], fog: [0.5, 0.1],
                    deco: (t) => ({ k: 'stalactite', n: 22, h: 60 + t * 50, c: '#1a0503' }) },
                clouds: [], mist: mistBands('255,90,30', 0.2, [0.6, 0.8]),
                parts: [{ kind: 'ember', n: [40, 24], rgb: '255,150,60' }, { kind: 'ash', n: [16, 8] }],
                ambient: { lavaGlow: true },
                ground: { top: '#1a0402', bot: '#0a0100', tufts: 'lavaLake' },
                fg: { top: { k: 'lavaDrips', c: ['#140302', '#2a0804'] }, bottom: { k: 'lava', c: ['#140302', '#2a0804'] } },
                post: 'inferno'
            },
            {
                name: 'Obsidian Wastes',
                sky: [[0, '#08040a'], [0.5, '#2a0a12'], [0.8, '#6a1a14'], [1, '#d0501a']],
                body: { kind: 'sun', x: 0.3, y: 0.5, r: 30, rgb: '255,120,60' }, haze: '220,80,40',
                cloudTint: C('30,10,12', '120,50,40', '70,25,20'),
                ridges: { n: 12, base: [0.55, 0.88], amp: [0.22, 0.06], oct: [6, 4], far: ['#4a1a1e', '#6a2a26'], near: ['#06030a', '#030105'], fog: [0.5, 0.1], lava: true,
                    deco: (t) => t < 0.25 ? null : { k: 'obsidian', n: 20, h: 30 + t * 50, c: t < 0.6 ? '#1a0a12' : '#050208' } },
                extras: [{ k: 'landmark', kind: 'volcano', f: 0.14, x: 0.72, y: 0.66, size: 160, c: ['#2a0e10', '#120406'] }],
                clouds: cloudBands(0.4, [0.04, 0.26], 0.06), mist: mistBands('200,80,50', 0.18, [0.62, 0.78]),
                parts: [{ kind: 'ash', n: [40, 24] }, { kind: 'ember', n: [16, 8], rgb: '255,120,50' }],
                ambient: { lavaGlow: true, lightning: true },
                ground: { top: '#1a0606', bot: '#080202', tufts: 'lava', c: '#0e0406' },
                fg: { top: null, bottom: { k: 'lava', c: ['#0e0406', '#1e080a'] } },
                post: 'ashen'
            },
            {
                name: 'Inferno Gate',
                sky: [[0, '#1a0300'], [0.4, '#6a1200'], [0.75, '#d9480f'], [1, '#ffb347']],
                body: null, haze: '255,140,60',
                cloudTint: C('80,15,0', '255,160,80', '200,90,30'),
                ridges: { n: 10, base: [0.6, 0.9], amp: [0.18, 0.06], oct: [5, 4], far: ['#8a2a08', '#aa4410'], near: ['#140300', '#080100'], fog: [0.45, 0.08], lava: true,
                    deco: (t) => t < 0.3 ? null : t < 0.7 ? { k: 'rockSpike', n: 18, h: 50, c: '#2a0800' } : { k: 'rockSpike', n: 14, h: 70, c: '#0e0200' } },
                extras: [{ k: 'landmark', kind: 'gate', f: 0.24, x: 0.5, y: 0.82, size: 120, c: ['#1a0400'] }],
                clouds: cloudBands(0.6, [0.04, 0.3], 0.08), mist: mistBands('255,130,50', 0.2, [0.6, 0.78]),
                parts: [{ kind: 'ember', n: [50, 30], rgb: '255,170,70' }],
                ambient: { lavaGlow: true },
                ground: { top: '#2a0600', bot: '#0e0200', tufts: 'lavaLake' },
                fg: { top: { k: 'chains', c: ['#2a1a14', '#4a2a1a'] }, bottom: { k: 'lava', c: ['#1a0400', '#2a0800'] } },
                post: 'inferno'
            }
        ],
        ocean: [
            {
                name: 'Coral Reef',
                sky: [[0, '#4fd2e8'], [0.3, '#1b9cc4'], [0.7, '#0b5a8a'], [1, '#06305a']],
                body: null, haze: '40,150,200',
                cloudTint: C('30,110,150', '150,230,250', '90,190,220'),
                ridges: { n: 10, base: [0.62, 0.9], amp: [0.16, 0.05], oct: [5, 3], far: ['#2a8ab4', '#3aa0c4'], near: ['#0a3a52', '#062a3c'], fog: [0.55, 0.08],
                    deco: (t) => t < 0.25 ? null : t < 0.6 ? [{ k: 'coral', n: 30, h: 26, c: ['#ff8a80', '#ffab40', '#f48fb1', '#ce93d8'] }, { k: 'seaweed', n: 20, h: 30, c: '#2e8a6a' }]
                        : [{ k: 'coral', n: 20, h: 44, c: ['#ff5252', '#ff9100', '#f06292', '#ba68c8'] }, { k: 'seaweed', n: 16, h: 50, c: '#1b6a50' }] },
                clouds: [], mist: mistBands('120,220,240', 0.15, [0.5, 0.75]),
                parts: [{ kind: 'bubble', n: [30, 16] }, { kind: 'fish', n: [14, 8] }, { kind: 'mote', n: [20, 10], rgb: '200,250,255', rise: -0.03 }],
                ambient: { shafts: true },
                ground: { top: '#e8d6a8', bot: '#a8946a', tufts: 'coralBed' },
                fg: { top: { k: 'surface', c: ['rgba(150,230,250,0.55)'] }, bottom: { k: 'coralFg', c: ['#ff5252', '#ff9100', '#f06292', '#ba68c8', '#4dd0e1'] } },
                post: 'reef'
            },
            {
                name: 'Abyssal Trench',
                sky: [[0, '#031426'], [0.4, '#020a18'], [1, '#00040a']],
                body: null, haze: '20,60,110',
                cloudTint: C('5,15,30', '30,70,110', '15,40,70'),
                ridges: { n: 9, base: [0.6, 0.9], amp: [0.2, 0.06], oct: [6, 4], far: ['#0a2440', '#0e2e50'], near: ['#02060c', '#010306'], fog: [0.6, 0.12],
                    deco: (t) => t < 0.3 ? null : { k: 'anemone', n: 14, h: 16 + t * 18, c: ['#4dd0e1', '#ba68c8', '#80deea', '#f48fb1'] } },
                clouds: [], mist: mistBands('30,90,160', 0.18, [0.55, 0.8]),
                parts: [{ kind: 'jelly', n: [8, 4] }, { kind: 'ghostlight', n: [26, 14], rgb: '100,220,255' }, { kind: 'bubble', n: [12, 6] }],
                ambient: { shafts: true, shaftRgb: '60,140,220', shaftA: 0.5 },
                ground: { top: '#06121e', bot: '#02060c', tufts: 'abyss' },
                fg: { top: null, bottom: { k: 'kelp', c: ['#0e3a3a', '#0a2a30', '#123a44'] } },
                post: 'abyss'
            },
            {
                name: 'Sunken Ruins',
                sky: [[0, '#6ad6d0'], [0.35, '#2a9aa0'], [0.75, '#105a6a'], [1, '#08303e']],
                body: null, haze: '60,170,170',
                cloudTint: C('30,110,120', '150,230,230', '90,180,180'),
                ridges: { n: 10, base: [0.6, 0.9], amp: [0.16, 0.05], oct: [5, 3], far: ['#2a8a90', '#3aa0a4'], near: ['#08303a', '#04202a'], fog: [0.5, 0.08],
                    deco: (t) => t < 0.25 ? null : t < 0.6 ? [{ k: 'pillar', n: 10, h: 60, c: '#2a6a70' }, { k: 'seaweed', n: 18, h: 30, c: '#2e7a5a' }] : [{ k: 'arch', n: 4, h: 70, c: '#0e3a40' }, { k: 'pillar', n: 8, h: 80, c: '#0a2e34' }] },
                extras: [{ k: 'landmark', kind: 'shipwreck', f: 0.26, x: 0.68, y: 0.84, size: 110, c: ['#1a2a2a', '#6a5a4a'] },
                         { k: 'landmark', kind: 'temple', f: 0.14, x: 0.25, y: 0.76, size: 90, c: ['#3a8a8a', '#2a6a6a'] }],
                clouds: [], mist: mistBands('100,200,200', 0.16, [0.55, 0.78]),
                parts: [{ kind: 'bubble', n: [26, 14] }, { kind: 'fish', n: [10, 6] }],
                ambient: { shafts: true, shaftRgb: '200,255,240' },
                ground: { top: '#b8b090', bot: '#6a6248', tufts: 'seabed', c: '#3a6a6a' },
                fg: { top: { k: 'surface', c: ['rgba(140,230,220,0.5)'] }, bottom: { k: 'kelp', c: ['#1e6a4a', '#2a8a5a', '#145a3a'] } },
                post: 'reef'
            }
        ],
        candy: [
            {
                name: 'Candy Hills',
                sky: [[0, '#7ec8ff'], [0.5, '#b8e0ff'], [0.85, '#ffd6ec'], [1, '#fff0f6']],
                body: { kind: 'sun', x: 0.78, y: 0.2, r: 44, rgb: '255,240,200' }, haze: '255,210,235',
                cloudTint: C('255,180,220', '255,255,255', '255,230,245'),
                ridges: { n: 10, base: [0.6, 0.88], amp: [0.16, 0.05], oct: [3, 2], far: ['#f8bbd0', '#fce4ec'], near: ['#f06292', '#c2185b'], fog: [0.35, 0.05],
                    deco: (t) => t < 0.3 ? null : t < 0.65 ? [{ k: 'lollipop', n: 22, h: 30, c: ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae'] }, { k: 'gumdrop', n: 20, h: 14, c: ['#ff80ab', '#80d8ff', '#ccff90'] }] : [{ k: 'candyCane', n: 14, h: 44 }, { k: 'lollipop', n: 12, h: 52, c: ['#e040fb', '#ff6e40', '#18ffff'] }] },
                extras: [{ k: 'landmark', kind: 'candyCastle', f: 0.22, x: 0.3, y: 0.78, size: 90, c: ['#fff0f6', '#f8bbd0', '#ff4081'] }],
                clouds: cloudBands(0.7, [0.06, 0.36], 0.06), mist: mistBands('255,220,240', 0.16, [0.6, 0.76]),
                parts: [{ kind: 'sprinkle', n: [30, 16] }, { kind: 'mote', n: [12, 6], rgb: '255,240,250', rise: -0.06 }],
                ambient: { rays: true, rayRgb: '255,230,245', birds: 3 },
                ground: { top: '#f48fb1', bot: '#c2185b', tufts: 'candy' },
                fg: { top: { k: 'candyDrips', c: ['#fff0f6'] }, bottom: { k: 'lollipops', c: ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb'] } },
                post: 'candy'
            },
            {
                name: 'Chocolate River',
                sky: [[0, '#ff9ec6'], [0.4, '#ffc49e'], [0.8, '#ffe0b2'], [1, '#fff3e0']],
                body: { kind: 'sun', x: 0.4, y: 0.42, r: 56, rgb: '255,220,170' }, haze: '255,200,170',
                cloudTint: C('230,150,150', '255,250,240', '255,220,210'),
                ridges: { n: 9, base: [0.6, 0.88], amp: [0.18, 0.05], oct: [3, 3], far: ['#c48b6a', '#d8a080'], near: ['#5d3a1a', '#3e2410'], fog: [0.4, 0.06], drip: '#f8e1c8',
                    deco: (t) => t < 0.4 ? null : { k: 'gumdrop', n: 26, h: 20 + t * 14, c: ['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff'] } },
                extras: [{ k: 'landmark', kind: 'candyCastle', f: 0.16, x: 0.75, y: 0.72, size: 80, c: ['#8d5a3a', '#f8e1c8', '#ff80ab'] }],
                clouds: cloudBands(0.7, [0.06, 0.3], 0.06), mist: mistBands('255,220,200', 0.14, [0.6, 0.76]),
                parts: [{ kind: 'sprinkle', n: [24, 12] }],
                ambient: { rays: true, rayRgb: '255,220,180' },
                ground: { top: '#6d4127', bot: '#3e2410', tufts: 'candy' },
                fg: { top: { k: 'candyDrips', c: ['#5d3a1a'] }, bottom: { k: 'lollipops', c: ['#ff80ab', '#80d8ff', '#ffe57f'] } },
                post: 'candy'
            },
            {
                name: 'Frosted Night',
                sky: [[0, '#140a2e'], [0.5, '#3a1a5e'], [0.85, '#7a3a8e'], [1, '#c26aa6']],
                body: { kind: 'moon', x: 0.2, y: 0.2, r: 30, rgb: '255,230,250' }, haze: '220,140,220', stars: 200,
                cloudTint: C('90,40,120', '240,200,250', '170,110,200'),
                ridges: { n: 10, base: [0.58, 0.88], amp: [0.16, 0.05], oct: [3, 2], far: ['#7a4a9e', '#9a6abe'], near: ['#2a0e3e', '#1a0628'], fog: [0.45, 0.06], snow: 3,
                    deco: (t) => t < 0.3 ? null : [{ k: 'lollipop', n: 16, h: 36 + t * 16, c: ['#ff80ab', '#80d8ff', '#ea80fc'] }, { k: 'gumdrop', n: 14, h: 16, c: ['#ff80ab', '#80d8ff', '#ccff90'] }] },
                extras: [{ k: 'landmark', kind: 'candyCastle', f: 0.24, x: 0.62, y: 0.78, size: 96, c: ['#3a1a5e', '#ea80fc', '#ff80ab'] }],
                clouds: cloudBands(0.3, [0.06, 0.3], 0.04), mist: mistBands('230,160,230', 0.16, [0.62, 0.78]),
                parts: [{ kind: 'snow', n: [44, 24] }, { kind: 'sparkle', n: [20, 10], rgb: '255,200,255' }],
                ambient: { shooting: true },
                ground: { top: '#f3e5f5', bot: '#ce93d8', tufts: 'candy' },
                fg: { top: { k: 'candyDrips', c: ['#ffffff'] }, bottom: { k: 'lollipops', c: ['#ea80fc', '#80d8ff', '#ff80ab'] } },
                post: 'frost'
            }
        ],
        haunted: [
            {
                name: 'Graveyard Moon',
                sky: [[0, '#05040e'], [0.5, '#141432'], [0.85, '#2e2a52'], [1, '#4a3e6a']],
                body: null, haze: '120,110,170', stars: 140,
                cloudTint: C('20,18,40', '110,100,150', '60,55,95'),
                ridges: { n: 10, base: [0.6, 0.9], amp: [0.16, 0.05], oct: [5, 3], far: ['#2a2848', '#3a3658'], near: ['#08070e', '#040308'], fog: [0.55, 0.1],
                    deco: (t) => t < 0.3 ? null : t < 0.65 ? [{ k: 'deadtree', n: 14, h: 50, c: '#14121e' }, { k: 'gravestone', n: 30, h: 16, c: '#1e1c2a' }] : [{ k: 'deadtree', n: 10, h: 80, c: '#08070e' }, { k: 'gravestone', n: 20, h: 26, c: '#0e0d16' }] },
                extras: [{ k: 'landmark', kind: 'bigMoon', f: 0.04, x: 0.7, y: 0.42, size: 90, c: ['#cfd8dc'] },
                         { k: 'landmark', kind: 'mansion', f: 0.2, x: 0.3, y: 0.76, size: 90, c: ['#0e0c18', '255,200,90'] }],
                clouds: cloudBands(0.3, [0.06, 0.34], 0.04), mist: mistBands('150,140,190', 0.3, [0.66, 0.84]),
                parts: [{ kind: 'bat', n: [10, 5] }, { kind: 'ghostlight', n: [12, 6], rgb: '170,200,255' }],
                ambient: {},
                ground: { top: '#14121e', bot: '#06050a', tufts: 'graves' },
                fg: { top: { k: 'cobwebs', c: ['#ffffff'] }, bottom: { k: 'graveFence', c: ['#06050a', '#1e1c2a'] } },
                post: 'haunted'
            },
            {
                name: 'Pumpkin Hollow',
                sky: [[0, '#1a0a2a'], [0.45, '#5a1a4a'], [0.8, '#c2481a'], [1, '#ff9a3a']],
                body: { kind: 'moon', x: 0.6, y: 0.28, r: 36, rgb: '255,200,120' }, haze: '255,130,60', stars: 60,
                cloudTint: C('60,20,40', '230,140,90', '150,70,60'),
                ridges: { n: 10, base: [0.6, 0.88], amp: [0.17, 0.05], oct: [5, 3], far: ['#6a2a3a', '#8a3a3a'], near: ['#120608', '#080204'], fog: [0.5, 0.08],
                    deco: (t) => t < 0.3 ? null : t < 0.7 ? [{ k: 'deadtree', n: 16, h: 50, c: '#1a0a0a' }, { k: 'pumpkin', n: 12, h: 18, c: '#e65100' }] : [{ k: 'deadtree', n: 10, h: 76, c: '#080204' }, { k: 'pumpkin', n: 8, h: 26, c: '#ef6c00' }] },
                extras: [{ k: 'landmark', kind: 'cabin', f: 0.3, x: 0.75, y: 0.82, size: 46, c: ['#1a0a0a', '#2a1410'], base: '#120608' }],
                clouds: cloudBands(0.4, [0.06, 0.3], 0.05), mist: mistBands('255,140,80', 0.2, [0.64, 0.8]),
                parts: [{ kind: 'leaf', n: [16, 10], cols: ['#d9541e', '#8a3a1a', '#f29f1d'] }, { kind: 'firefly', n: [14, 8], rgb: '255,170,60' }],
                ambient: {},
                ground: { top: '#2a1208', bot: '#0e0503', tufts: 'pumpkins' },
                fg: { top: { k: 'branches', c: ['#0a0404'] }, bottom: { k: 'pumpkinsFg', c: ['#ef6c00', '#e65100', '#ff8f00'] } },
                post: 'harvest'
            },
            {
                name: 'Wraith Marsh',
                sky: [[0, '#040a06'], [0.5, '#0e2214'], [0.85, '#2a4a2a'], [1, '#5a7a4a']],
                body: { kind: 'moon', x: 0.3, y: 0.24, r: 26, rgb: '200,255,200' }, haze: '120,180,110',
                cloudTint: C('15,30,18', '110,150,110', '60,90,62'),
                ridges: { n: 10, base: [0.6, 0.9], amp: [0.14, 0.05], oct: [5, 3], far: ['#1e3a24', '#2a4a2e'], near: ['#040806', '#020402'], fog: [0.6, 0.1],
                    deco: (t) => t < 0.3 ? null : [{ k: 'deadtree', n: 18, h: 40 + t * 40, c: t < 0.6 ? '#0e1a10' : '#040806' }, { k: 'reed', n: 30, h: 20, c: '#1a2a18' }] },
                clouds: cloudBands(0.25, [0.06, 0.3], 0.04), mist: mistBands('140,200,130', 0.34, [0.6, 0.86]),
                parts: [{ kind: 'ghostlight', n: [26, 14], rgb: '160,255,170' }, { kind: 'firefly', n: [12, 6], rgb: '190,255,140' }],
                ambient: {},
                ground: { top: '#0e1a10', bot: '#040806', tufts: 'swamp' },
                fg: { top: { k: 'vines', c: ['#0e1e12', '#1a2e1a', '#243a20'] }, bottom: { k: 'reeds', c: ['#14200f', '#1e2e18', '#0e160a'] } },
                post: 'marsh'
            }
        ]
    });
})();
