// Scenery painters and live ambience for the generated backdrops.
const BackdropScenery = {
    ridgePath(ctx, W, H, rng, base, amp, octaves) {
        const M = BACKDROP_MARGIN;
        const n = Math.ceil((W + M * 2) / 6);
        const r = Backdrop.ridge(rng, n, octaves || 4, 0.5);
        const pts = [];
        for (let i = 0; i < n; i++) pts.push([-M + i * 6, base - r[i] * amp]);
        ctx.beginPath();
        ctx.moveTo(-M, H + M);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(W + M, H + M);
        ctx.closePath();
        return pts;
    },

    meadow(ctx, W, H, rng) {
        const bands = [['#6f9f5a', '#4c7a3d', 0.7, 0.12], ['#4f8540', '#2f5a27', 0.8, 0.1]];
        bands.forEach(([top, bottom, base, amp], bi) => {
            const pts = this.ridgePath(ctx, W, H, rng, H * base, H * amp, 3);
            const g = ctx.createLinearGradient(0, H * (base - amp), 0, H);
            g.addColorStop(0, top); g.addColorStop(1, bottom);
            ctx.fillStyle = g; ctx.fill();
            // Trees along the ridge: pines and round crowns
            for (let i = 0; i < pts.length; i += 2 + Math.floor(rng() * 4)) {
                if (rng() < 0.45) continue;
                const [x, y] = pts[i];
                const s = (0.7 + rng() * 0.8) * (bi ? 1.3 : 1);
                ctx.fillStyle = bi ? '#244a1f' : '#3a6631';
                if (rng() < 0.55) {
                    for (let k = 0; k < 3; k++) {
                        ctx.beginPath();
                        ctx.moveTo(x - (12 - k * 3) * s, y - k * 9 * s);
                        ctx.lineTo(x, y - (16 + k * 9) * s);
                        ctx.lineTo(x + (12 - k * 3) * s, y - k * 9 * s);
                        ctx.closePath(); ctx.fill();
                    }
                } else {
                    ctx.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s);
                    // faceted crown, no circles
                    ctx.beginPath();
                    ctx.moveTo(x - 6 * s, y - 10 * s); ctx.lineTo(x - 9 * s, y - 16 * s); ctx.lineTo(x - 5 * s, y - 24 * s);
                    ctx.lineTo(x + 2 * s, y - 26 * s); ctx.lineTo(x + 9 * s, y - 20 * s); ctx.lineTo(x + 8 * s, y - 12 * s); ctx.lineTo(x + 6 * s, y - 10 * s);
                    ctx.closePath(); ctx.fill();
                    ctx.fillStyle = 'rgba(255,240,180,0.18)';
                    ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 20 * s); ctx.lineTo(x - 1 * s, y - 26 * s); ctx.lineTo(x - 2 * s, y - 18 * s); ctx.closePath(); ctx.fill();
                }
            }
        });
        // Wildflower specks in the near meadow
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = ['#fff59d', '#f48fb1', '#ffffff', '#ce93d8'][i % 4];
            ctx.globalAlpha = 0.6;
            ctx.fillRect(rng() * W, H * 0.78 + rng() * H * 0.2, 2, 2);
        }
        ctx.globalAlpha = 1;
    },

    fortress(ctx, W, H, rng, bd) {
        const pts = this.ridgePath(ctx, W, H, rng, H * 0.74, H * 0.12, 4);
        ctx.fillStyle = '#232444'; ctx.fill();
        // Two castles perched on the ridge, with lit windows
        for (let c = 0; c < 2; c++) {
            const cx = W * (0.2 + c * 0.55 + rng() * 0.1);
            const idx = Math.max(0, Math.min(pts.length - 1, Math.round((cx + BACKDROP_MARGIN) / 6)));
            const base = pts[idx][1] + 6;
            const wall = 90 + rng() * 80;
            ctx.fillStyle = '#1b1c36';
            ctx.fillRect(cx - wall / 2, base - 46, wall, 46);
            for (let x = cx - wall / 2; x < cx + wall / 2; x += 10) ctx.fillRect(x, base - 52, 6, 6);
            const towers = 2 + Math.floor(rng() * 2);
            for (let t = 0; t < towers; t++) {
                const tx = cx - wall / 2 + (t + 0.5) * wall / towers, th = 70 + rng() * 60, tw = 16 + rng() * 8;
                ctx.fillStyle = '#1b1c36';
                ctx.fillRect(tx - tw / 2, base - th, tw, th);
                ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 4, base - th); ctx.lineTo(tx, base - th - 26); ctx.lineTo(tx + tw / 2 + 4, base - th); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#8a2b3c';
                ctx.fillRect(tx, base - th - 40, 1.5, 14);
                ctx.beginPath(); ctx.moveTo(tx + 1.5, base - th - 40); ctx.lineTo(tx + 12, base - th - 36); ctx.lineTo(tx + 1.5, base - th - 32); ctx.fill();
                for (let k = 0; k < 3; k++) {
                    if (rng() < 0.35) continue;
                    bd.windows.push({ x: tx - 2.5, y: base - th + 14 + k * 18, w: 5, h: 8, ph: rng() * 6 });
                }
            }
            for (let k = 0; k < 4; k++) bd.windows.push({ x: cx - wall / 2 + 10 + rng() * (wall - 20), y: base - 34, w: 5, h: 7, ph: rng() * 6 });
        }
        for (const w of bd.windows) { ctx.fillStyle = '#ffb74d'; ctx.fillRect(w.x, w.y, w.w, w.h); }
    },

    glacier(ctx, W, H, rng) {
        this.ridgePath(ctx, W, H, rng, H * 0.78, H * 0.08, 3);
        ctx.fillStyle = '#9cc4e6'; ctx.fill();
        // Translucent ice spires with lit edges
        for (let i = 0; i < 26; i++) {
            const x = rng() * W, h = 60 + rng() * 190, w = 14 + rng() * 26, base = H * (0.74 + rng() * 0.12);
            const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
            g.addColorStop(0, 'rgba(150,205,245,0.85)');
            g.addColorStop(0.5, 'rgba(225,245,255,0.95)');
            g.addColorStop(1, 'rgba(90,150,210,0.85)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x + (rng() - 0.5) * 10, base - h); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
            ctx.stroke();
        }
    },

    islands(ctx, W, H, rng) {
        for (let i = 0; i < 5; i++) {
            const x = W * (0.1 + i * 0.2) + (rng() - 0.5) * 60, y = H * (0.42 + rng() * 0.25), w = 70 + rng() * 90;
            // Rocky underside
            const rg = ctx.createLinearGradient(0, y, 0, y + w * 0.8);
            rg.addColorStop(0, '#8d7a66'); rg.addColorStop(1, 'rgba(90,70,60,0.3)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.moveTo(x - w / 2, y);
            for (let k = 0; k <= 6; k++) ctx.lineTo(x - w / 2 + k * w / 6, y + (k % 2 ? 0.55 : 0.35) * w * (1 - Math.abs(k - 3) / 4));
            ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
            // Grass cap and a tree
            ctx.fillStyle = '#7cb85c';
            ctx.beginPath(); ctx.ellipse(x, y, w / 2, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4e8c3a';
            {
                // a faceted little canopy instead of a round one
                const tx = x + (rng() - 0.5) * w * 0.4;
                ctx.beginPath();
                [[-10, -3], [-6, -10], [1, -13], [8, -9], [10, -2], [4, 4], [-5, 4]].forEach(([px, py], i) => i ? ctx.lineTo(tx + px, y + py - 10) : ctx.moveTo(tx + px, y + py - 10));
                ctx.closePath(); ctx.fill();
            }
            // Waterfall
            if (rng() < 0.6) {
                const wx = x + (rng() - 0.5) * w * 0.6;
                const wg = ctx.createLinearGradient(0, y, 0, y + 160);
                wg.addColorStop(0, 'rgba(255,255,255,0.8)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = wg;
                ctx.fillRect(wx - 3, y, 6, 160);
            }
        }
    },

    arcane(ctx, W, H, rng) {
        this.ridgePath(ctx, W, H, rng, H * 0.8, H * 0.06, 3);
        ctx.fillStyle = '#1e0a3a'; ctx.fill();
        // Rune obelisks
        for (let i = 0; i < 5; i++) {
            const x = W * (0.08 + i * 0.21) + (rng() - 0.5) * 50, h = 90 + rng() * 120, base = H * 0.8;
            ctx.fillStyle = '#170830';
            ctx.beginPath(); ctx.moveTo(x - 12, base); ctx.lineTo(x - 8, base - h); ctx.lineTo(x, base - h - 14); ctx.lineTo(x + 8, base - h); ctx.lineTo(x + 12, base); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(200,140,255,0.8)'; ctx.lineWidth = 1.5;
            for (let k = 0; k < 4; k++) {
                const yy = base - h + 20 + k * (h - 30) / 4;
                ctx.beginPath(); ctx.moveTo(x - 4, yy); ctx.lineTo(x + 4, yy + 5); ctx.lineTo(x - 3, yy + 10); ctx.stroke();
            }
        }
        // Floating crystal shards
        for (let i = 0; i < 14; i++) {
            const x = rng() * W, y = H * (0.2 + rng() * 0.45), s = 6 + rng() * 14;
            const g = ctx.createLinearGradient(x, y - s * 2, x, y + s * 2);
            g.addColorStop(0, '#f3d6ff'); g.addColorStop(1, '#7b2fbf');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
        }
    }
};
