// Drawing kit for the third-wave weapons (weapon-defs-2.js). Each weapon's `art` is a small
// recipe (blade length and shape, guard, head, barrel, stock, ...) turned into real vector art
// here, in the same local frame as WeaponArt: grip at the origin, +x along the blade or barrel.
// Also: pickup spans for every recipe, and the generic projectile looks (`proj.look`).
const WeaponKit = {
    rgba(rgb, a) { return `rgba(${rgb},${a})`; },
    glowAt(ctx, x, y, r, rgb, a) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },
    metal(ctx, y0, y1, c) { return WeaponArt.metal(ctx, 0, y0, 0, y1, c[0], c[1]); },
    grip(ctx, len, col) {
        WeaponArt.rect(ctx, -len, -2.4, len, 4.8, col || '#3e2723', '#1b0f0a');
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8;
        for (let x = -len + 1.5; x < -1; x += 3) { ctx.beginPath(); ctx.moveTo(x, -2.4); ctx.lineTo(x + 1.6, 2.4); ctx.stroke(); }
    },
    shaft(ctx, x0, x1, col, w) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = (w || 4) + 1.4;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = w || 4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, -1); ctx.lineTo(x1, -1); ctx.stroke();
    },

    // Pickup / held extent along x: [back, front]
    span(a) {
        switch (a.k) {
            case 'blade': return [-(a.grip || 12) - 2, a.L + 4];
            case 'pole': return [-(a.B || 20), (a.L || 50) + (a.head === 'whip' ? 30 : (a.HL || 16))];
            case 'heavy': return [-6, (a.L || 30) + (a.S || 12) + 4];
            case 'fist': return [-8, a.shape === 'drill' ? 28 : a.shape === 'claw' ? 26 : 18];
            case 'gun': return [-(a.stock && a.stock !== 'none' ? 14 : 4), (a.L || 28) - 6 + (a.B || 8)];
            case 'bow': return [-12, Math.round((a.S || 26) * 0.6)];
            case 'throw': return [-12 * (a.S || 1), 14 * (a.S || 1)];
            case 'staff': return [-(a.B || 22), (a.L || 28) + 10];
        }
        return [-20, 20];
    },

    draw(ctx, a, o) {
        o = o || {};
        const fn = this['k_' + a.k];
        if (fn) { ctx.save(); fn.call(this, ctx, a, o); ctx.restore(); }
    },

    // ---------- blades ----------
    k_blade(ctx, a, o) {
        const L = a.L, W = a.W || 4, cv = a.curve || 0, grip = a.grip || 12;
        this.grip(ctx, grip, a.h);
        ctx.fillStyle = a.g || '#ffca28';
        ctx.beginPath(); ctx.arc(-grip - 1, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        const one = (dy) => {
            ctx.save(); ctx.translate(0, dy);
            if (a.laser) {
                // emitter + light blade
                WeaponArt.rect(ctx, -2, -3.5, 6, 7, '#78909c', '#263238');
                ctx.globalCompositeOperation = 'lighter';
                const flick = 0.85 + 0.15 * Math.sin((o.t || 0) * 0.9);
                for (const [w, al] of [[W * 3.2, 0.25], [W * 1.8, 0.55], [W, 1]]) {
                    ctx.strokeStyle = al === 1 ? `rgba(255,255,255,${flick})` : `rgba(${a.laser},${al * flick})`;
                    ctx.lineWidth = w; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(L, 0); ctx.stroke();
                }
                ctx.restore(); return;
            }
            // blade outline: spine on top (y<0), edge below
            ctx.beginPath();
            ctx.moveTo(2, -W * 0.7);
            if (a.edge === 'flame') { for (let x = 6; x <= L - 6; x += 6) ctx.quadraticCurveTo(x - 3, -W - 2.5, x, -W * 0.6 + cv * (x / L) * (x / L)); }
            else ctx.quadraticCurveTo(L * 0.6, -W + cv * 0.4, L - 4, -W * 0.5 + cv);
            // tip
            if (a.tip === 'square') { ctx.lineTo(L, -W + cv); ctx.lineTo(L, W * 0.9 + cv); }
            else if (a.tip === 'clip') { ctx.lineTo(L, cv - W * 0.1); ctx.lineTo(L - 6, W * 0.6 + cv); }
            else if (a.tip === 'hook') { ctx.quadraticCurveTo(L + 4, cv - W, L - 2, cv - W * 1.8); ctx.lineTo(L - 6, W * 0.4 + cv); }
            else ctx.lineTo(L + 2, cv);
            // edge back to the guard
            if (a.edge === 'serr' || a.edge === 'wave') {
                const n = Math.floor(L / 6);
                for (let i = n; i >= 1; i--) {
                    const x = i * 6, y = W * 0.9 + cv * (x / L) * (x / L);
                    if (a.edge === 'serr') { ctx.lineTo(x, y + 1.6); ctx.lineTo(x - 3, y - 0.6); }
                    else ctx.quadraticCurveTo(x - 1.5, y + (i % 2 ? 3 : -1.5), x - 3, y);
                }
            } else ctx.quadraticCurveTo(L * 0.55, W + cv * 0.5, 2, W * 0.75);
            ctx.closePath();
            ctx.fillStyle = this.metal(ctx, -W, W, a.c);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
            // edge highlight + fuller
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(4, W * 0.45); ctx.quadraticCurveTo(L * 0.55, W * 0.6 + cv * 0.5, L - 6, cv + W * 0.2); ctx.stroke();
            if (a.fuller) { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(L * 0.7, cv * 0.5); ctx.stroke(); }
            if (a.hole) { ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(L - 7, -W * 0.45, 2, 0, Math.PI * 2); ctx.fill(); }
            if (a.blood) { ctx.fillStyle = 'rgba(150,0,0,0.75)'; ctx.beginPath(); ctx.ellipse(L * 0.7, W * 0.5, 5, 1.6, 0.1, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        };
        if (a.twin) { one(-4); one(4); } else one(0);
        // glow along the blade
        if (a.glow) {
            const pulse = 0.35 + 0.25 * Math.sin((o.t || 0) * 0.12);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(${a.glow},${pulse * (o.glow === undefined ? 1 : 0.4 + 0.6 * o.glow)})`;
            ctx.lineWidth = W * 2.2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(L * 0.6, cv * 0.4, L - 2, cv); ctx.stroke();
            ctx.restore();
        }
        // guard
        const g = a.g || '#ffca28';
        switch (a.guard) {
            case 'bar': WeaponArt.poly(ctx, [-1, -W - 4, 2, -W - 4, 2, W + 4, -1, W + 4], g, 'rgba(0,0,0,0.6)'); break;
            case 'wing': WeaponArt.poly(ctx, [-2, 0, 1, -W - 7, 4, -W - 9, 2, 0, 4, W + 9, 1, W + 7], g, 'rgba(0,0,0,0.6)'); break;
            case 'disc': ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0.5, 0, 2.2, W + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'basket':
                ctx.strokeStyle = g; ctx.lineWidth = 1.8;
                ctx.beginPath(); ctx.arc(-4, 0, 7, -1.7, 1.7); ctx.stroke();
                ctx.beginPath(); ctx.arc(-4, 0, 4.5, -1.4, 1.4); ctx.stroke();
                WeaponArt.poly(ctx, [-1, -W - 2, 2, -W - 2, 2, W + 2, -1, W + 2], g, 'rgba(0,0,0,0.5)'); break;
            case 'ornate':
                WeaponArt.poly(ctx, [-2, -W - 5, 3, -W - 2, 1, 0, 3, W + 2, -2, W + 5, 0, 0], g, 'rgba(0,0,0,0.6)');
                ctx.fillStyle = a.glow ? `rgb(${a.glow})` : '#e53935'; ctx.beginPath(); ctx.arc(0.5, 0, 1.8, 0, Math.PI * 2); ctx.fill(); break;
        }
        if (a.gem) { ctx.fillStyle = a.gem; ctx.beginPath(); ctx.arc(0.5, 0, 1.8, 0, Math.PI * 2); ctx.fill(); }
    },

    // ---------- polearms ----------
    k_pole(ctx, a, o) {
        const L = a.L || 50, B = a.B || 20, HL = a.HL || 16, c = a.c;
        if (a.head === 'whip') {
            this.grip(ctx, 10, a.s);
            ctx.lineCap = 'round';
            const t = o.t || 0;
            ctx.strokeStyle = c[1]; ctx.lineWidth = 3.4;
            ctx.beginPath(); ctx.moveTo(0, 0);
            for (let i = 1; i <= 12; i++) { const x = i * 4.5, y = Math.sin(i * 0.6 + t * 0.15) * i * 0.5 + i * i * 0.08; ctx.lineTo(x, y); }
            ctx.stroke();
            ctx.strokeStyle = c[0]; ctx.lineWidth = 1.8; ctx.stroke();
            return;
        }
        this.shaft(ctx, -B, L, a.s || '#5d4037', 4);
        if (a.ribbon) { ctx.fillStyle = a.ribbon; ctx.beginPath(); ctx.moveTo(L - 2, 0); ctx.quadraticCurveTo(L - 8, 9, L - 14, 12 + Math.sin((o.t || 0) * 0.2) * 2); ctx.lineTo(L - 6, 2); ctx.closePath(); ctx.fill(); }
        if (a.rope) { ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-B + 2, 0); ctx.bezierCurveTo(-B, 12, -B + 10, 14, -B + 14, 6); ctx.stroke(); }
        WeaponArt.rect(ctx, L - 3, -2.8, 4, 5.6, '#ffb300', 'rgba(0,0,0,0.5)');
        const g = this.metal(ctx, -HL * 0.5, HL * 0.5, c), P = WeaponArt.poly.bind(WeaponArt), x = L;
        switch (a.head) {
            case 'spear': P(ctx, [x, -2, x + 4, -5, x + HL, 0, x + 4, 5, x, 2], g, 'rgba(0,0,0,0.6)'); break;
            case 'lance':
                P(ctx, [x - 10, -6, x + HL, 0, x - 10, 6], g, 'rgba(0,0,0,0.6)');
                ctx.strokeStyle = c[1]; ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 8 + i * 8, -4.5 + i * 1.4); ctx.lineTo(x - 4 + i * 8, 4.5 - i * 1.4); ctx.stroke(); }
                P(ctx, [x - 12, -9, x - 10, -9, x - 10, 9, x - 12, 9], '#9e9e9e', 'rgba(0,0,0,0.6)'); break;
            case 'trident':
                P(ctx, [x, -9, x + 3, -9, x + 3, 9, x, 9], g, 'rgba(0,0,0,0.6)');
                for (const y of [-8, 0, 8]) P(ctx, [x + 2, y - 1.4, x + HL - (y ? 3 : 0), y - 1.4, x + HL + 3 - (y ? 3 : 0), y, x + HL - (y ? 3 : 0), y + 1.4, x + 2, y + 1.4], g, 'rgba(0,0,0,0.55)', 0.8);
                break;
            case 'fork':
                P(ctx, [x, -7, x + 3, -7, x + 3, 7, x, 7], '#757575');
                for (const y of [-6, 0, 6]) { ctx.strokeStyle = c[0]; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + HL, y + y * 0.15); ctx.stroke(); }
                break;
            case 'halberd':
                P(ctx, [x, -2, x + 4, -4, x + HL, 0, x + 4, 4, x, 2], g, 'rgba(0,0,0,0.6)');
                ctx.beginPath(); ctx.moveTo(x - 6, -2); ctx.quadraticCurveTo(x + 2, -16, x - 2, -18); ctx.quadraticCurveTo(x + 10, -8, x + 6, -2); ctx.closePath();
                ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
                P(ctx, [x - 4, 2, x + 2, 2, x - 2, 9], g, 'rgba(0,0,0,0.6)'); break;
            case 'glaive': case 'naginata':
                ctx.beginPath(); ctx.moveTo(x, -2.5); ctx.quadraticCurveTo(x + HL * 0.6, a.head === 'glaive' ? -9 : -5, x + HL, a.head === 'glaive' ? -7 : -4);
                ctx.quadraticCurveTo(x + HL * 0.6, 2, x, 3); ctx.closePath();
                ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 2, 1.5); ctx.quadraticCurveTo(x + HL * 0.6, 0, x + HL - 2, -3.5); ctx.stroke(); break;
            case 'crescent':
                ctx.beginPath(); ctx.moveTo(x - 4, -2); ctx.quadraticCurveTo(x + HL, -18, x + HL * 0.8, 6); ctx.quadraticCurveTo(x + HL * 0.5, -4, x - 4, 3); ctx.closePath();
                ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'scythe':
                ctx.beginPath(); ctx.moveTo(x, -2); ctx.quadraticCurveTo(x - 6, -26, x - HL, -28); ctx.quadraticCurveTo(x - 12, -18, x - 4, -2); ctx.closePath();
                ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'hook':
                ctx.strokeStyle = c[1]; ctx.lineWidth = 4; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + HL * 0.6, 0); ctx.arc(x + HL * 0.6, -6, 6, Math.PI / 2, -Math.PI * 0.9, true); ctx.stroke();
                ctx.strokeStyle = c[0]; ctx.lineWidth = 2; ctx.stroke();
                P(ctx, [x + HL * 0.6 - 6, -10, x + HL * 0.6 - 9, -6, x + HL * 0.6 - 3, -7], c[0]); break;
            case 'ice':
                P(ctx, [x, -3, x + 5, -7, x + HL, 0, x + 5, 7, x, 3], 'rgba(200,240,255,0.85)', 'rgba(255,255,255,0.9)');
                P(ctx, [x + 4, -2, x + HL - 4, 0, x + 4, 2], 'rgba(255,255,255,0.7)'); break;
            case 'bolt':
                P(ctx, [x, -2, x + 7, -6, x + 6, -1, x + HL, -4, x + 9, 3, x + 10, -1, x, 3], g, 'rgba(0,0,0,0.6)'); break;
            case 'cap':
                P(ctx, [x - 4, -3, x + 2, -3, x + 2, 3, x - 4, 3], g, 'rgba(0,0,0,0.6)');
                P(ctx, [-B, -3, -B + 6, -3, -B + 6, 3, -B, 3], g, 'rgba(0,0,0,0.6)'); break;
        }
        if (a.glow) this.glowAt(ctx, x + HL * 0.5, 0, HL * 0.9, a.glow, 0.35 + 0.2 * Math.sin((o.t || 0) * 0.12));
    },

    // ---------- heavy weapons ----------
    k_heavy(ctx, a, o) {
        const L = a.L || 30, S = a.S || 12, c = a.c, x = L, g = this.metal(ctx, -S, S, c), P = WeaponArt.poly.bind(WeaponArt);
        if (a.head !== 'log') this.shaft(ctx, -6, L + 2, a.s || '#5d4037', 4.5);
        if (a.rope) { ctx.strokeStyle = '#bcaaa4'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.bezierCurveTo(-10, 12, 4, 16, 8, 3); ctx.stroke(); }
        const stroke = (fill) => { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.3; ctx.stroke(); };
        switch (a.head) {
            case 'mace':
                ctx.beginPath(); ctx.ellipse(x + S * 0.6, 0, S * 0.7, S * 0.8, 0, 0, Math.PI * 2); stroke(g);
                for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; P(ctx, [x + S * 0.6 + Math.cos(an - 0.25) * S * 0.6, Math.sin(an - 0.25) * S * 0.7, x + S * 0.6 + Math.cos(an) * S * 1.15, Math.sin(an) * S * 1.15, x + S * 0.6 + Math.cos(an + 0.25) * S * 0.6, Math.sin(an + 0.25) * S * 0.7], c[0], 'rgba(0,0,0,0.6)', 0.8); }
                break;
            case 'flail': {
                const t = o.t || 0, sw = Math.sin(t * 0.12) * 0.5, bx = x + 10 + Math.cos(sw) * 10, by = Math.sin(sw) * 10 + 6;
                ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 1.5]);
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(bx, by, S * 0.7, 0, Math.PI * 2); stroke(g);
                for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; P(ctx, [bx + Math.cos(an - 0.3) * S * 0.6, by + Math.sin(an - 0.3) * S * 0.6, bx + Math.cos(an) * S * 1.1, by + Math.sin(an) * S * 1.1, bx + Math.cos(an + 0.3) * S * 0.6, by + Math.sin(an + 0.3) * S * 0.6], c[0]); }
                break;
            }
            case 'club':
                ctx.beginPath(); ctx.moveTo(x - 10, -3); ctx.quadraticCurveTo(x + S, -S * 1.1, x + S * 1.4, 0); ctx.quadraticCurveTo(x + S, S * 1.1, x - 10, 3); ctx.closePath(); stroke(g);
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + i * 4 - 2, (i % 2 ? 3 : -3), 1.4, 0, Math.PI * 2); ctx.fill(); }
                break;
            case 'pick':
                ctx.beginPath(); ctx.moveTo(x - 2, -3); ctx.quadraticCurveTo(x + 6, -S * 0.9, x + 2, -S * 1.5); ctx.lineTo(x + 6, -S * 0.6); ctx.lineTo(x + 6, S * 0.4); ctx.quadraticCurveTo(x + 8, S, x + 2, S * 1.2); ctx.lineTo(x - 2, 3); ctx.closePath(); stroke(g);
                break;
            case 'anchor':
                ctx.strokeStyle = c[1]; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.arc(x + 8, 0, S * 0.9, Math.PI * 0.6, -Math.PI * 0.6, true); ctx.stroke();
                ctx.strokeStyle = c[0]; ctx.lineWidth = 3; ctx.stroke();
                P(ctx, [x + 8 + Math.cos(Math.PI * 0.6) * S * 0.9 - 4, Math.sin(Math.PI * 0.6) * S * 0.9, x + 8 + Math.cos(Math.PI * 0.6) * S * 0.9 + 3, Math.sin(Math.PI * 0.6) * S * 0.9 + 6, x + 8 + Math.cos(Math.PI * 0.6) * S * 0.9 + 3, Math.sin(Math.PI * 0.6) * S * 0.9 - 2], c[0]);
                P(ctx, [x + 8 + Math.cos(-Math.PI * 0.6) * S * 0.9 - 4, Math.sin(-Math.PI * 0.6) * S * 0.9, x + 8 + Math.cos(-Math.PI * 0.6) * S * 0.9 + 3, Math.sin(-Math.PI * 0.6) * S * 0.9 - 6, x + 8 + Math.cos(-Math.PI * 0.6) * S * 0.9 + 3, Math.sin(-Math.PI * 0.6) * S * 0.9 + 2], c[0]);
                ctx.strokeStyle = c[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-2, 0, 3, 0, Math.PI * 2); ctx.stroke();
                break;
            case 'wrench':
                ctx.beginPath(); ctx.moveTo(x - 2, -4); ctx.lineTo(x + S, -S * 0.9); ctx.lineTo(x + S * 1.2, -S * 0.3); ctx.lineTo(x + 4, -S * 0.2); ctx.lineTo(x + 4, S * 0.2); ctx.lineTo(x + S * 1.2, S * 0.3); ctx.lineTo(x + S, S * 0.9); ctx.lineTo(x - 2, 4); ctx.closePath(); stroke(g);
                break;
            case 'hammer': case 'sledge': case 'maul': case 'mallet': {
                const hw = a.head === 'sledge' ? S * 1.2 : a.head === 'mallet' ? S * 1.4 : S, hh = a.head === 'mallet' ? S * 0.9 : S;
                ctx.beginPath();
                if (a.head === 'mallet') ctx.ellipse(x + hw * 0.4, 0, hw * 0.55, hh, 0, 0, Math.PI * 2);
                else ctx.rect(x - 2, -hh, hw, hh * 2);
                stroke(g);
                if (a.head === 'mallet') { ctx.fillStyle = c[1]; ctx.beginPath(); ctx.ellipse(x + hw * 0.4, -hh + 1.5, hw * 0.5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + hw * 0.4, hh - 1.5, hw * 0.5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
                else { WeaponArt.rect(ctx, x - 2, -2.5, hw, 5, a.head === 'maul' ? c[0] : '#ffb300'); }
                if (a.head === 'maul') { ctx.save(); ctx.translate(x + hw / 2 - 1, 0); ctx.rotate((o.t || 0) * 0.05); ctx.strokeStyle = 'rgba(220,200,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, S * 0.5, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore(); }
                break;
            }
            case 'labrys':
                for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + 4, 0); ctx.quadraticCurveTo(x + 4 + S * 0.4, sgn * S * 0.5, x - 2, sgn * S * 1.1); ctx.quadraticCurveTo(x + 14 + S * 0.6, sgn * S * 0.9, x + 16 + S * 0.4, sgn * S * 1.1); ctx.quadraticCurveTo(x + 10 + S * 0.2, sgn * S * 0.5, x + 10, 0); ctx.closePath(); stroke(g); }
                break;
            case 'log':
                ctx.beginPath(); ctx.rect(-6, -7, S + 6, 14); stroke(this.metal(ctx, -7, 7, c));
                ctx.fillStyle = '#d7b98e'; ctx.beginPath(); ctx.ellipse(S, 0, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(S, 0, 1.5, 4, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -6); ctx.lineTo(i * 9 + 6, 6); ctx.stroke(); }
                ctx.fillStyle = '#558b2f'; ctx.beginPath(); ctx.ellipse(S * 0.6, -8, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill();
                break;
            case 'pan':
                ctx.beginPath(); ctx.ellipse(x + S, 0, S, S * 0.95, 0, 0, Math.PI * 2); stroke(c[1]);
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.ellipse(x + S, 0, S * 0.78, S * 0.74, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + S - 3, -3, S * 0.5, 3.6, 4.6); ctx.stroke();
                break;
            case 'rock':
                ctx.beginPath(); ctx.moveTo(x, -S * 0.6); ctx.lineTo(x + S * 0.8, -S); ctx.lineTo(x + S * 1.6, -S * 0.4); ctx.lineTo(x + S * 1.5, S * 0.6); ctx.lineTo(x + S * 0.6, S); ctx.lineTo(x - 2, S * 0.4); ctx.closePath(); stroke(g);
                if (a.glow) { ctx.strokeStyle = `rgba(${a.glow},0.9)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 3, -2); ctx.lineTo(x + S * 0.8, 1); ctx.lineTo(x + S * 1.2, -4); ctx.stroke(); }
                break;
            case 'skull':
                ctx.beginPath(); ctx.arc(x + S * 0.7, -1, S * 0.85, 0, Math.PI * 2); stroke(g);
                ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(x + S * 0.95, -3, 2, 0, Math.PI * 2); ctx.arc(x + S * 0.95, 3, 2, 0, Math.PI * 2); ctx.fill();
                WeaponArt.rect(ctx, x + S * 0.8, -S * 0.5, 2, S, 'rgba(0,0,0,0.25)');
                break;
            case 'saw': {
                WeaponArt.rect(ctx, -6, -8, 18, 16, c[0], 'rgba(0,0,0,0.6)');
                WeaponArt.rect(ctx, -6, -8, 18, 3, '#ffb74d');
                ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(12 + S, -4); ctx.arc(12 + S, 0, 4, -Math.PI / 2, Math.PI / 2); ctx.lineTo(12, 5); ctx.closePath(); stroke('#b0bec5');
                const t = o.t || 0; ctx.fillStyle = '#212121';
                for (let i = 0; i < S / 3; i++) { const px = 12 + ((i * 3 + t * 2) % S); ctx.fillRect(px, -6.5, 1.6, 1.6); ctx.fillRect(12 + S - ((i * 3 + t * 2) % S), 5, 1.6, 1.6); }
                break;
            }
        }
        if (a.glow) this.glowAt(ctx, x + S * 0.6, 0, S * 1.6, a.glow, 0.3 + 0.2 * Math.sin((o.t || 0) * 0.12));
    },

    // ---------- fist weapons ----------
    k_fist(ctx, a, o) {
        const c = a.c, g = this.metal(ctx, -9, 9, c), P = WeaponArt.poly.bind(WeaponArt);
        switch (a.shape) {
            case 'knuckle':
                for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(8, -6 + i * 4, 2.4, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
                P(ctx, [2, -8, 6, -8, 6, 8, 2, 8], c[1]); break;
            case 'claw':
                P(ctx, [-6, -6, 6, -7, 8, 7, -6, 6], c[1], 'rgba(0,0,0,0.6)');
                for (const y of [-5, 0, 5]) P(ctx, [6, y - 1.2, 24, y - 2.5, 26, y - 3, 22, y + 1, 6, y + 1.2], g, 'rgba(0,0,0,0.6)', 0.8);
                break;
            case 'glove':
                ctx.beginPath(); ctx.ellipse(6, 0, 10, 9, 0, 0, Math.PI * 2); ctx.fillStyle = this.metal(ctx, -9, 9, c); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(9, -4, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill();
                WeaponArt.rect(ctx, -8, -6, 6, 12, '#fafafa', 'rgba(0,0,0,0.5)'); break;
            case 'drill': {
                P(ctx, [-6, -7, 6, -8, 6, 8, -6, 7], c[1], 'rgba(0,0,0,0.6)');
                P(ctx, [6, -7, 28, 0, 6, 7], g, 'rgba(0,0,0,0.6)');
                const t = (o.t || 0) * 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) { const xx = 8 + ((i * 5 + t) % 20); const h = 7 * (1 - (xx - 6) / 22); ctx.beginPath(); ctx.moveTo(xx, -h); ctx.lineTo(xx + 3, h); ctx.stroke(); }
                break;
            }
            case 'rocket':
                P(ctx, [-8, -7, 8, -9, 14, -5, 16, 0, 14, 5, 8, 9, -8, 7], g, 'rgba(0,0,0,0.6)', 1.3);
                WeaponArt.rect(ctx, -12, -4, 5, 8, '#455a64');
                this.glowAt(ctx, -13, 0, 7, a.glow || '255,150,50', 0.7); break;
            default: // gauntlet
                P(ctx, [-8, -7, 6, -9, 14, -6, 16, 0, 14, 6, 6, 9, -8, 7], g, 'rgba(0,0,0,0.6)', 1.4);
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
                for (const y of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(15, y); ctx.stroke(); }
        }
        if (a.glow) this.glowAt(ctx, 6, 0, 12, a.glow, 0.35 + 0.3 * (o.glow || 0));
    },

    // ---------- guns ----------
    k_gun(ctx, a, o) {
        const L = a.L || 28, H = a.H || 8, B = a.B || 8, c = a.c, P = WeaponArt.poly.bind(WeaponArt), R = WeaponArt.rect.bind(WeaponArt);
        const x0 = -6, x1 = x0 + L, top = -H + 1;
        // stock
        if (a.stock === 'wood') P(ctx, [x0 - 14, -2, x0, top + 2, x0, 2, x0 - 14, 5], '#6d4c41', '#2b1a12');
        else if (a.stock === 'frame') { ctx.strokeStyle = c[1]; ctx.lineWidth = 2; ctx.strokeRect(x0 - 12, top + 2, 12, H - 2); }
        else if (a.stock === 'pad') { R(ctx, x0 - 10, top + 2, 10, H - 3, c[1]); R(ctx, x0 - 12, top + 1, 3, H - 1, '#212121'); }
        // body
        const bg = ctx.createLinearGradient(0, top, 0, 2);
        bg.addColorStop(0, c[0]); bg.addColorStop(1, c[1]);
        ctx.fillStyle = bg; ctx.fillRect(x0, top, L, H);
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(x0, top, L, H);
        R(ctx, x0, top, L, 1.6, 'rgba(255,255,255,0.35)');
        // accent stripe
        R(ctx, x0 + 3, top + H * 0.55, L - 8, 1.6, c[2]);
        // grip and trigger guard
        P(ctx, [x0 + 4, 1, x0 + 10, 1, x0 + 8, 11, x0 + 2, 11], '#3e2723', '#1b0f0a');
        ctx.strokeStyle = c[1]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x0 + 12, 3, 3, 0, Math.PI); ctx.stroke();
        // magazine
        switch (a.mag) {
            case 'box': P(ctx, [x0 + 14, 1, x0 + 20, 1, x0 + 21, 11, x0 + 15, 11], c[1], 'rgba(0,0,0,0.6)'); break;
            case 'drum': ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x0 + 17, 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = c[2]; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'tube': R(ctx, x0 + 10, top - 4, L - 12, 3, c[2], 'rgba(0,0,0,0.5)'); break;
            case 'tank': { const tg = ctx.createLinearGradient(x0 + 6, 0, x0 + 18, 0); tg.addColorStop(0, c[2]); tg.addColorStop(1, c[1]); ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(x0 + 12, top - 4, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); break; }
            case 'cell': R(ctx, x0 + 12, 1, 8, 6, c[2], 'rgba(0,0,0,0.6)'); this.glowAt(ctx, x0 + 16, 4, 6, a.glow || '120,255,200', 0.5 * (0.4 + 0.6 * (o.glow || 0))); break;
            case 'dome': ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(x0 + 12, top, 6, Math.PI, 0); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); break;
            case 'pod': for (let i = 0; i < 3; i++) { ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(x1 - 2, top + 2 + i * (H / 2.5), 2.4, 0, Math.PI * 2); ctx.fill(); } break;
        }
        // scope / top
        if (a.scope) { R(ctx, x0 + 8, top - 5, 14, 4, '#212121'); ctx.fillStyle = 'rgba(120,210,255,0.9)'; ctx.beginPath(); ctx.arc(x0 + 22, top - 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
        // barrel(s)
        const bx = x1, by = top + H * 0.35;
        const nb = a.barrels || 1;
        for (let i = 0; i < nb; i++) R(ctx, bx, by - 1.6 + i * 3.4 - (nb - 1) * 1.7, B, 3.2, '#263238', '#0d1215');
        const ex = bx + B;
        switch (a.muzzle) {
            case 'bell': P(ctx, [ex - 2, by - 2, ex + 4, by - 5, ex + 4, by + 5, ex - 2, by + 2], c[2], 'rgba(0,0,0,0.6)'); break;
            case 'brake': R(ctx, ex - 4, by - 3, 6, 6, '#455a64', '#0d1215'); break;
            case 'prong': ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 4, by - 4); ctx.lineTo(ex + 4, by - 4); ctx.moveTo(ex - 4, by + 4); ctx.lineTo(ex + 4, by + 4); ctx.stroke(); break;
            case 'coil': ctx.strokeStyle = '#b87333'; ctx.lineWidth = 1.4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(bx + 2 + i * (B / 4), by, 1.2, 4, 0, 0, Math.PI * 2); ctx.stroke(); } break;
            case 'dish': ctx.fillStyle = c[2]; ctx.beginPath(); ctx.ellipse(ex, by, 2.5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); break;
            case 'wide': P(ctx, [ex - 3, by - 3, ex + 3, by - 6, ex + 3, by + 6, ex - 3, by + 3], c[1], 'rgba(0,0,0,0.6)'); break;
            case 'cannon': R(ctx, bx - 2, by - 5, B + 4, 10, c[1], 'rgba(0,0,0,0.7)'); R(ctx, ex - 1, by - 6, 3, 12, c[2]); break;
        }
        if (a.loadedTip === 'harpoon' && o.loaded !== false) P(ctx, [ex, by - 1, ex + 8, by, ex, by + 1], '#cfd8dc', 'rgba(0,0,0,0.5)');
        if (a.glow) this.glowAt(ctx, ex, by, 9, a.glow, 0.25 + 0.4 * (o.glow || 0));
    },

    // ---------- bows ----------
    k_bow(ctx, a, o) {
        const S = a.S || 26, pull = (o.pull || 0) * 10, c = a.c;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-2, -S);
        if (a.recurve) { ctx.quadraticCurveTo(12, -S * 0.5, 4, 0); ctx.quadraticCurveTo(12, S * 0.5, -2, S); ctx.moveTo(-2, -S); ctx.lineTo(-5, -S - 4); ctx.moveTo(-2, S); ctx.lineTo(-5, S + 4); }
        else ctx.quadraticCurveTo(S * 0.6, 0, -2, S);
        ctx.stroke();
        ctx.strokeStyle = c[0]; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.strokeStyle = c[1]; ctx.lineWidth = 1.2; ctx.stroke();
        if (a.cams) { ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(-2, -S, 3, 0, Math.PI * 2); ctx.arc(-2, S, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = a.str || '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-2, -S); ctx.lineTo(-2 - pull, 0); ctx.lineTo(-2, S); ctx.stroke();
        if (o.loaded !== false) {
            ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(-2 - pull, 0); ctx.lineTo(22 - pull, 0); ctx.stroke();
            WeaponArt.poly(ctx, [28 - pull, 0, 22 - pull, -3, 22 - pull, 3], '#cfd8dc');
            WeaponArt.poly(ctx, [-2 - pull, 0, -6 - pull, -3, 2 - pull, 0, -6 - pull, 3], a.fletch || '#e53935');
        }
        if (a.glow) this.glowAt(ctx, 4, 0, S * 0.8, a.glow, 0.25 + 0.2 * Math.sin((o.t || 0) * 0.1));
    },

    // ---------- thrown ----------
    k_throw(ctx, a, o) {
        const c = a.c, P = WeaponArt.poly.bind(WeaponArt), Sc = a.S || 1;
        ctx.scale(Sc, Sc);
        const fillStroke = (f) => { ctx.fillStyle = f; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.1; ctx.stroke(); };
        switch (a.shape) {
            case 'shuriken': case 'razor': {
                const n = a.shape === 'razor' ? 3 : 4, r = 11;
                ctx.beginPath();
                for (let i = 0; i < n * 2; i++) { const an = i / (n * 2) * Math.PI * 2 + (o.t || 0) * 0.02, rr = i % 2 ? 3.5 : r; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
                ctx.closePath(); fillStroke(this.metal(ctx, -r, r, c));
                ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill(); break;
            }
            case 'chakram':
                ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.arc(0, 0, 7, 0, Math.PI * 2, true); fillStroke(this.metal(ctx, -11, 11, c));
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 10, 3.6, 5); ctx.stroke(); break;
            case 'knife':
                WeaponArt.rect(ctx, -10, -1.8, 9, 3.6, '#37474f');
                P(ctx, [-1, -3, 12, -2, 16, 0, 12, 2, -1, 3], this.metal(ctx, -3, 3, c), 'rgba(0,0,0,0.6)'); break;
            case 'javelin':
                this.shaft(ctx, -12, 22, c[1], 3);
                P(ctx, [22, -2, 30, 0, 22, 2], this.metal(ctx, -2, 2, c), 'rgba(0,0,0,0.6)'); break;
            case 'tomahawk':
                this.shaft(ctx, -8, 12, c[1], 3.4);
                ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(10, -10); ctx.quadraticCurveTo(17, -8, 18, 0); ctx.lineTo(14, 2); ctx.closePath(); fillStroke(this.metal(ctx, -10, 2, c)); break;
            case 'flask':
                ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(3, -10); ctx.lineTo(3, -5); ctx.quadraticCurveTo(9, -2, 8, 4); ctx.quadraticCurveTo(7, 10, 0, 10); ctx.quadraticCurveTo(-7, 10, -8, 4); ctx.quadraticCurveTo(-9, -2, -3, -5); ctx.closePath();
                fillStroke('rgba(220,240,255,0.35)');
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.moveTo(-7.5, 2); ctx.quadraticCurveTo(0, -1 + Math.sin((o.t || 0) * 0.2), 7.5, 2); ctx.quadraticCurveTo(7, 9.5, 0, 9.5); ctx.quadraticCurveTo(-7, 9.5, -7.5, 2); ctx.fill();
                WeaponArt.rect(ctx, -2.5, -13, 5, 4, c[1]);
                this.glowAt(ctx, 0, 5, 12, '255,255,255', 0.15); break;
            case 'orb': case 'holy': case 'snowball': case 'rock': case 'canister': case 'mine': case 'dynamite': case 'bolas': case 'card': default:
                this.thrownItem(ctx, a, o);
        }
        if (a.glow) this.glowAt(ctx, 0, 0, 14, a.glow, 0.3 + 0.2 * Math.sin((o.t || 0) * 0.12));
    },
    thrownItem(ctx, a, o) {
        const c = a.c, P = WeaponArt.poly.bind(WeaponArt);
        switch (a.shape) {
            case 'orb': { const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-3, -3, 2.4, 0, Math.PI * 2); ctx.fill(); break; }
            case 'holy': {
                const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9); g.addColorStop(0, '#fff8e1'); g.addColorStop(1, c[1]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 2, 8, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = c[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -14); ctx.moveTo(-3.5, -11); ctx.lineTo(3.5, -11); ctx.stroke(); break;
            }
            case 'snowball': ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(120,170,220,0.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = 'rgba(150,190,240,0.5)'; ctx.beginPath(); ctx.arc(2, 3, 4, 0, Math.PI * 2); ctx.fill(); break;
            case 'rock': P(ctx, [-8, -3, -3, -8, 5, -7, 9, -1, 6, 7, -4, 8, -9, 3], WeaponKit.metal(ctx, -8, 8, c), 'rgba(0,0,0,0.6)'); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(2, 1); ctx.lineTo(1, 5); ctx.stroke(); break;
            case 'canister': WeaponArt.rect(ctx, -5, -9, 10, 18, c[0], 'rgba(0,0,0,0.6)'); WeaponArt.rect(ctx, -5, -9, 10, 3, c[1]); WeaponArt.rect(ctx, -5, 6, 10, 3, c[1]); ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(4, -11, 3, 0, Math.PI * 1.5); ctx.stroke(); break;
            case 'mine': ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = c[0]; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = Math.floor((o.t || 0) / 10) % 2 ? '#ff1744' : '#4a0000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); break;
            case 'dynamite': for (let i = -1; i <= 1; i++) { WeaponArt.rect(ctx, -9, i * 4 - 2, 18, 4, c[0], 'rgba(0,0,0,0.6)'); } WeaponArt.rect(ctx, -3, -7, 3, 14, '#3e2723'); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(9, 0); ctx.quadraticCurveTo(14, -3, 13, -7); ctx.stroke(); if (Math.floor((o.t || 0) / 6) % 2) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(13, -7.5, 2, 0, Math.PI * 2); ctx.fill(); } break;
            case 'bolas': ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 1.2; ctx.beginPath(); for (const an of [0, 2.1, 4.2]) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * 9, Math.sin(an) * 9); } ctx.stroke(); for (const an of [0, 2.1, 4.2]) { ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(Math.cos(an) * 9, Math.sin(an) * 9, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = c[1]; ctx.stroke(); } break;
            case 'card': for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(-0.3 + i * 0.3); WeaponArt.rect(ctx, -4, -12, 8, 12, '#ffffff', 'rgba(0,0,0,0.6)'); ctx.fillStyle = i === 1 ? '#212121' : c[1]; ctx.font = 'bold 6px Orbitron, sans-serif'; ctx.fillText(['A', 'K', 'Q'][i], -2, -4); ctx.restore(); } break;
        }
    },

    // ---------- staves and wands ----------
    k_staff(ctx, a, o) {
        const L = a.L || 28, B = a.B || 22, c = a.c, t = o.t || 0, x = L;
        if (a.head === 'cane') {
            ctx.lineCap = 'round'; ctx.lineWidth = 5;
            ctx.strokeStyle = c[0]; ctx.beginPath(); ctx.moveTo(-B, 0); ctx.lineTo(x, 0); ctx.arc(x, -6, 6, Math.PI / 2, -Math.PI / 2, true); ctx.stroke();
            ctx.strokeStyle = c[1]; ctx.lineWidth = 2.2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); return;
        }
        this.shaft(ctx, -B, x, a.s || '#5d4037', 3.6);
        if (a.glow) this.glowAt(ctx, x + 6, 0, 16, a.glow, 0.35 + 0.25 * Math.sin(t * 0.12) * (o.glow === undefined ? 1 : o.glow));
        const P = WeaponArt.poly.bind(WeaponArt);
        switch (a.head) {
            case 'flame':
                for (let i = 0; i < 3; i++) { const f = Math.sin(t * 0.3 + i * 2) * 1.5; P(ctx, [x + 2, -4 + i * 4, x + 12 + f + (i === 1 ? 4 : 0), -2 + i * 2, x + 2, 0 + i * 2], ['#ffeb3b', '#ff9800', '#e53935'][i]); }
                WeaponArt.rect(ctx, x - 2, -3, 4, 6, '#3e2723'); break;
            case 'crystal':
                P(ctx, [x, 0, x + 6, -6, x + 16, 0, x + 6, 6], WeaponArt.metal(ctx, 0, -6, 0, 6, c[0], c[1]), 'rgba(255,255,255,0.8)');
                ctx.strokeStyle = c[1]; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 2, -6); ctx.quadraticCurveTo(x + 2, -2, x + 2, 0); ctx.moveTo(x - 2, 6); ctx.quadraticCurveTo(x + 2, 2, x + 2, 0); ctx.stroke(); break;
            case 'ring':
                ctx.strokeStyle = c[1]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + 7, 0, 7, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + 7, 0, 2.6 + Math.sin(t * 0.4), 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(${a.glow || '255,255,200'},0.8)`; ctx.lineWidth = 1;
                ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = i * 1.6 + t * 0.3; ctx.moveTo(x + 7 + Math.cos(an) * 3, Math.sin(an) * 3); ctx.lineTo(x + 7 + Math.cos(an) * 7, Math.sin(an) * 7); } ctx.stroke(); break;
            case 'skull':
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + 6, -1, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 3, 3, 6, 4);
                ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(x + 8, -2, 1.6, 0, Math.PI * 2); ctx.arc(x + 4, -2, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(${a.glow || '150,255,60'},${0.6 + 0.4 * Math.sin(t * 0.2)})`; ctx.beginPath(); ctx.arc(x + 8, -2, 0.9, 0, Math.PI * 2); ctx.arc(x + 4, -2, 0.9, 0, Math.PI * 2); ctx.fill(); break;
            case 'void': {
                const g = ctx.createRadialGradient(x + 7, 0, 0, x + 7, 0, 8); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#12002a'); g.addColorStop(1, c[0]);
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 7, 0, 7, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = c[0]; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x + 7, 0, 11, 3, t * 0.05, 0, Math.PI * 2); ctx.stroke(); break;
            }
            case 'leaf':
                for (const s of [-1, 1]) { ctx.fillStyle = c[s > 0 ? 0 : 1]; ctx.beginPath(); ctx.ellipse(x + 6, s * 4, 7, 3, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
                ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(x + 1, 0, 3, 0, Math.PI * 2); ctx.fill(); break;
            case 'crescent':
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + 6, 0, 8, -1.3, 1.3); ctx.arc(x + 3, 0, 6, 1.1, -1.1, true); ctx.closePath(); ctx.fill(); ctx.strokeStyle = c[1]; ctx.lineWidth = 1; ctx.stroke(); break;
            case 'sun':
                ctx.fillStyle = c[1]; ctx.beginPath(); for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI * 2 + t * 0.02, r = i % 2 ? 5 : 9; ctx.lineTo(x + 7 + Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill();
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + 7, 0, 4.4, 0, Math.PI * 2); ctx.fill(); break;
            case 'clock':
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(x + 7, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = c[1]; ctx.lineWidth = 1.6; ctx.stroke();
                ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 7 + Math.cos(t * 0.1) * 5, Math.sin(t * 0.1) * 5); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 7 + Math.cos(t * 0.01) * 3.4, Math.sin(t * 0.01) * 3.4); ctx.stroke(); break;
            case 'lute':
                ctx.fillStyle = c[0]; ctx.beginPath(); ctx.ellipse(x + 2, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = c[1]; ctx.lineWidth = 1.2; ctx.stroke();
                ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.arc(x + 2, 0, 2.4, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.5; ctx.beginPath(); for (const y of [-1, 0, 1]) { ctx.moveTo(-B + 4, y); ctx.lineTo(x + 8, y); } ctx.stroke(); break;
            case 'mirror':
                ctx.fillStyle = c[1]; ctx.beginPath(); ctx.ellipse(x + 7, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
                { const g = ctx.createLinearGradient(x, -5, x + 14, 5); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, c[0]); g.addColorStop(1, '#9fa8da'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + 7, 0, 6, 4.4, 0, 0, Math.PI * 2); ctx.fill(); }
                break;
            default: { const g = ctx.createRadialGradient(x + 5, -2, 0, x + 6, 0, 7); g.addColorStop(0, '#fff'); g.addColorStop(1, c[0]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 6, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        }
    },

    // ---------- projectile looks ----------
    drawLook(ctx, pr, x, y, ang) {
        const L = pr.spec.look, c = L.c === 'rand' ? (pr.paint || (pr.paint = ['255,80,80', '80,200,255', '255,220,60', '120,255,120', '255,120,255'][(Math.random() * 5) | 0])) : L.c;
        const age = pr.age, big = L.big ? 1.6 : 1, small = L.small ? 0.7 : 1;
        const add = () => { ctx.globalCompositeOperation = 'lighter'; };
        switch (L.s) {
            case 'tracer': pr.drawTracer(ctx, x, y, 1.8, 3, c, 3.2); break;
            case 'beam': case 'rail': {
                const len = L.s === 'rail' ? 3 : 1.6, w = L.s === 'rail' ? 5 : 3.4;
                pr.drawTracer(ctx, x, y, len, w, c, w);
                if (L.s === 'rail') { add(); ctx.strokeStyle = `rgba(${c},0.5)`; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 10; i++) { const k = i / 10, px = x - pr.vx * len * k, py = y - pr.vy * len * k; ctx.lineTo(px, py + Math.sin(i * 1.7 + age) * 5); } ctx.stroke(); }
                break;
            }
            case 'ball': ctx.fillStyle = '#424242'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill(); add(); ctx.fillStyle = 'rgba(255,220,160,0.4)'; ctx.beginPath(); ctx.arc(x - pr.vx * 0.5, y - pr.vy * 0.5, 3, 0, Math.PI * 2); ctx.fill(); break;
            case 'orb': case 'void': {
                const r = (L.s === 'void' ? 11 : 8) * big * (1 + 0.15 * Math.sin(age * 0.6));
                // trail
                add();
                for (let i = 1; i <= 4; i++) { ctx.fillStyle = `rgba(${c},${0.18 / i})`; ctx.beginPath(); ctx.arc(x - pr.vx * i * 1.2, y - pr.vy * i * 1.2, r * (1 - i * 0.12), 0, Math.PI * 2); ctx.fill(); }
                const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
                if (L.s === 'void') { ctx.globalCompositeOperation = 'source-over'; g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(10,0,25,1)'); g.addColorStop(0.62, `rgba(${c},0.9)`); g.addColorStop(1, `rgba(${c},0)`); }
                else { g.addColorStop(0, `rgba(${L.c2 || '255,255,255'},1)`); g.addColorStop(0.35, `rgba(${c},0.95)`); g.addColorStop(1, `rgba(${c},0)`); }
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
                if (L.s === 'void') { add(); ctx.strokeStyle = `rgba(${c},0.8)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.5, age * 0.15, 0, Math.PI * 2); ctx.stroke(); }
                break;
            }
            case 'shard':
                ctx.translate(x, y); ctx.rotate(ang);
                add(); ctx.fillStyle = `rgba(${c},0.35)`; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                WeaponArt.poly(ctx, [-6, 0, 0, -4, 9, 0, 0, 4], `rgba(${c},0.95)`, 'rgba(255,255,255,0.9)', 1);
                break;
            case 'zap': {
                add(); ctx.strokeStyle = `rgba(${c},0.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y);
                let px = x, py = y; for (let i = 0; i < 5; i++) { px -= pr.vx * 0.3; py -= pr.vy * 0.3 + (Math.random() - 0.5) * 10; ctx.lineTo(px, py); } ctx.stroke();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
                const g = ctx.createRadialGradient(x, y, 0, x, y, 10); g.addColorStop(0, '#fff'); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'blob': {
                const r = 5 * big;
                ctx.fillStyle = `rgba(${c},0.9)`; ctx.beginPath(); ctx.ellipse(x, y, r * (1 + Math.abs(pr.vx) * 0.03), r * (1 - Math.abs(pr.vx) * 0.02), ang, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill();
                add(); ctx.fillStyle = `rgba(${c},0.25)`; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'nail': ctx.translate(x, y); ctx.rotate(ang); WeaponArt.rect(ctx, -7, -0.8, 10, 1.6, '#bdbdbd'); WeaponArt.rect(ctx, -8, -2, 1.6, 4, '#9e9e9e'); break;
            case 'harpoon': {
                const o = pr.owner;
                if (o && !o.isDead) { ctx.strokeStyle = 'rgba(230,220,200,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(o.x + o.width / 2, o.y + 22); ctx.quadraticCurveTo((x + o.x) / 2, Math.max(y, o.y) + 20, x, y); ctx.stroke(); }
                ctx.translate(x, y); ctx.rotate(ang);
                WeaponArt.rect(ctx, -20, -1, 20, 2, '#78909c');
                WeaponArt.poly(ctx, [0, -3, 8, 0, 0, 3], '#eceff1', 'rgba(0,0,0,0.5)');
                WeaponArt.poly(ctx, [-2, 0, -6, -5, -4, 0, -6, 5], '#cfd8dc');
                break;
            }
            case 'net': {
                ctx.translate(x, y); ctx.rotate(age * 0.05);
                const r = 13 + Math.min(4, age * 0.3); ctx.strokeStyle = `rgba(${c},0.95)`; ctx.lineWidth = 1;
                ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * r / 2.5, -r); ctx.lineTo(i * r / 2.5, r); ctx.moveTo(-r, i * r / 2.5); ctx.lineTo(r, i * r / 2.5); } ctx.stroke();
                ctx.fillStyle = '#5d4037'; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(a * r, b * r, 2.2, 0, Math.PI * 2); ctx.fill(); }
                break;
            }
            case 'paint': ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1.4, y - 1.4, 1.4, 0, Math.PI * 2); ctx.fill(); break;
            case 'bubble': {
                const r = 7 + Math.sin(age * 0.2) * 0.8;
                ctx.strokeStyle = `rgba(${c},0.8)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = `rgba(${c},0.15)`; ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.4, 1.8, 0, Math.PI * 2); ctx.fill();
                add(); ctx.strokeStyle = `rgba(255,${120 + (age * 7) % 120},255,0.35)`; ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0.3, 1.6); ctx.stroke();
                break;
            }
            case 'shell': ctx.translate(x, y); ctx.rotate(ang); { const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, `rgb(${c})`); g.addColorStop(1, '#222'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, -3.5); ctx.lineTo(3, -3.5); ctx.quadraticCurveTo(8, 0, 3, 3.5); ctx.lineTo(-6, 3.5); ctx.closePath(); ctx.fill(); WeaponArt.rect(ctx, -7, -4, 2, 8, '#ffca28'); } break;
            case 'pellet': ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill(); add(); ctx.fillStyle = `rgba(${c},0.3)`; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); break;
            case 'ring': {
                const r = 10 + age * 0.7;
                add(); for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(${c},${0.7 - i * 0.2 - age / pr.maxLife * 0.5})`; ctx.lineWidth = 2.5 - i * 0.6; ctx.beginPath(); ctx.ellipse(x - pr.vx * i * 0.9, y, r * 0.35, r, 0, -Math.PI / 2, Math.PI / 2, pr.vx < 0); ctx.stroke(); }
                break;
            }
            case 'water': ctx.fillStyle = `rgba(${c},0.85)`; ctx.beginPath(); ctx.ellipse(x, y, 5, 3.4, ang, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); ctx.fill(); break;
            case 'dart': ctx.translate(x, y); ctx.rotate(ang); WeaponArt.rect(ctx, -8, -1, 10, 2, '#cfd8dc'); WeaponArt.poly(ctx, [-8, 0, -12, -3, -12, 3], `rgb(${c})`); WeaponArt.poly(ctx, [2, -1, 6, 0, 2, 1], '#fff'); break;
            case 'fire': {
                const r = 7 * big;
                add();
                for (let i = 0; i < 5; i++) { const k = i / 5; ctx.fillStyle = `rgba(255,${180 - i * 30},40,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x - pr.vx * i * 0.9 + Math.sin(age + i) * 2, y - pr.vy * i * 0.9 - i, r * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill(); }
                const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fff8e1'); g.addColorStop(0.5, `rgba(${c},0.95)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'glitch': {
                for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? `rgba(${L.c2},0.8)` : `rgba(${c},0.8)`; ctx.fillRect(x - 6 + (Math.random() - 0.5) * 8, y - 6 + i * 3, 4 + Math.random() * 10, 2.5); }
                ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 2, 4, 4);
                break;
            }
            case 'coin': ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(age * 0.4)) * 0.9 + 0.1, 1); ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff59d'; ctx.fillRect(-0.8, -2.5, 1.6, 5); break;
            case 'star': case 'spin': {
                const n = L.n || 5; ctx.translate(x, y); ctx.rotate(age * 0.4 * (pr.vx < 0 ? -1 : 1));
                if (L.s === 'star') { add(); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, `rgba(${c},0.6)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
                ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const an = i / (n * 2) * Math.PI * 2, r = i % 2 ? 2.6 : 7.5; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath();
                ctx.fillStyle = `rgb(${c})`; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
                break;
            }
            case 'disc': ctx.translate(x, y); ctx.rotate(age * 0.5); ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 1.4); ctx.stroke(); add(); ctx.strokeStyle = `rgba(${c},0.25)`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke(); break;
            case 'knife': ctx.translate(x, y); ctx.rotate(ang); WeaponArt.rect(ctx, -10, -1.4, 6, 2.8, '#37474f'); WeaponArt.poly(ctx, [-4, -2.2, 8, 0, -4, 2.2], `rgb(${c})`, 'rgba(0,0,0,0.5)'); break;
            case 'javelin': ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(2, 0); ctx.stroke(); WeaponArt.poly(ctx, [2, -2.5, 10, 0, 2, 2.5], '#cfd8dc', 'rgba(0,0,0,0.5)'); break;
            case 'axe': ctx.translate(x, y); ctx.rotate(age * 0.4 * (pr.vx < 0 ? -1 : 1)); ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(7, 0); ctx.stroke(); WeaponArt.poly(ctx, [4, -1, 6, -8, 12, -6, 12, 1, 8, 2], `rgb(${c})`, 'rgba(0,0,0,0.5)'); break;
            case 'flask': ctx.translate(x, y); ctx.rotate(age * 0.3); ctx.fillStyle = `rgba(${c},0.85)`; ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill(); WeaponArt.rect(ctx, -1.5, -6, 3, 5, 'rgba(220,240,255,0.7)'); add(); ctx.fillStyle = 'rgba(255,200,120,0.7)'; ctx.beginPath(); ctx.arc(0, -7, 2 + Math.random(), 0, Math.PI * 2); ctx.fill(); break;
            case 'rock': ctx.translate(x, y); ctx.rotate(age * 0.15); ctx.scale(big, big); WeaponArt.poly(ctx, [-6, -2, -2, -6, 4, -5, 7, 0, 4, 6, -3, 6, -7, 2], `rgb(${c})`, 'rgba(0,0,0,0.6)'); break;
            case 'snow': ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(160,200,240,0.6)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 1.5, 2.4, 0, Math.PI * 2); ctx.fill(); break;
            case 'mine': {
                ctx.translate(x, y);
                ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
                const blink = pr.stuck ? Math.floor(age / (pr.life < 60 ? 3 : 10)) % 2 === 0 : true;
                ctx.fillStyle = blink ? `rgb(${c})` : '#4a0000'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
                if (blink && pr.stuck) { add(); ctx.fillStyle = `rgba(${c},0.35)`; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); }
                ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + 0.78; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 6, Math.sin(an) * 6); ctx.lineTo(Math.cos(an) * 8.5, Math.sin(an) * 8.5); ctx.stroke(); }
                break;
            }
            case 'card': ctx.translate(x, y); ctx.rotate(age * 0.6); WeaponArt.rect(ctx, -3.5, -5, 7, 10, '#ffffff', 'rgba(0,0,0,0.6)'); ctx.fillStyle = '#d50000'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill(); break;
            case 'bolas': ctx.translate(x, y); ctx.rotate(age * 0.5); ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 1; ctx.beginPath(); for (const an of [0, 2.1, 4.2]) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * 9, Math.sin(an) * 9); } ctx.stroke(); ctx.fillStyle = `rgb(${c})`; for (const an of [0, 2.1, 4.2]) { ctx.beginPath(); ctx.arc(Math.cos(an) * 9, Math.sin(an) * 9, 3, 0, Math.PI * 2); ctx.fill(); } break;
            case 'dynamite': ctx.translate(x, y); ctx.rotate(age * 0.3); WeaponArt.rect(ctx, -6, -3, 12, 6, `rgb(${c})`, 'rgba(0,0,0,0.5)'); add(); ctx.fillStyle = 'rgba(255,230,120,1)'; ctx.beginPath(); ctx.arc(7, -3, 2 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill(); break;
            case 'thorn': ctx.translate(x, y); ctx.rotate(ang); WeaponArt.poly(ctx, [-6, -1.6, 6, 0, -6, 1.6], `rgb(${c})`, 'rgba(0,0,0,0.5)'); break;
            case 'gust': {
                add(); const r = 14 + age * 0.4;
                for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(${c},${0.5 - i * 0.12})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - pr.vx * i, y, r - i * 4, -1 + age * 0.2 + i, 1 + age * 0.2 + i); ctx.stroke(); }
                break;
            }
            case 'skull': {
                ctx.translate(x, y);
                add(); ctx.fillStyle = `rgba(${c},0.25)`; ctx.beginPath(); ctx.arc(-pr.vx, -pr.vy, 9, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#f5f5dc'; ctx.beginPath(); ctx.arc(0, -1, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-3, 3, 6, 3);
                ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(-2, -1.5, 1.4, 0, Math.PI * 2); ctx.arc(2, -1.5, 1.4, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'clock': {
                ctx.translate(x, y); add(); ctx.strokeStyle = `rgba(${c},0.9)`; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(age * 0.5) * 6, Math.sin(age * 0.5) * 6); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(age * 0.05) * 4, Math.sin(age * 0.05) * 4); ctx.stroke();
                ctx.fillStyle = `rgba(${c},0.25)`; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'note': {
                ctx.translate(x, y); ctx.rotate(Math.sin(age * 0.2) * 0.3);
                ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.ellipse(-2, 4, 3.4, 2.4, -0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(1, -7, 1.6, 11); ctx.beginPath(); ctx.moveTo(2.6, -7); ctx.quadraticCurveTo(7, -5, 6, -1); ctx.lineTo(2.6, -4); ctx.fill();
                break;
            }
            case 'arrow': {
                ctx.translate(x, y); ctx.rotate(ang);
                if (L.fire || L.zap || L.shadow || L.ice) { add(); ctx.fillStyle = `rgba(${c},0.45)`; ctx.beginPath(); ctx.ellipse(-8, 0, 16, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
                ctx.strokeStyle = L.shadow ? '#311b92' : '#8d6e63'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(2, 0); ctx.stroke();
                ctx.fillStyle = L.ice ? '#e1f5fe' : '#cfd8dc'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -3.5); ctx.lineTo(0, 3.5); ctx.closePath(); ctx.fill();
                ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-29, -4); ctx.lineTo(-19, 0); ctx.lineTo(-29, 4); ctx.closePath(); ctx.fill();
                if (L.fire) { add(); ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},40,0.9)`; ctx.beginPath(); ctx.arc(4, 0, 3 + Math.random() * 2, 0, Math.PI * 2); ctx.fill(); }
                if (L.zap) { add(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, 0); for (let i = 0; i < 4; i++) ctx.lineTo(6 - i * 6, (Math.random() - 0.5) * 8); ctx.stroke(); }
                break;
            }
            case 'rocket': ctx.scale(small, small); pr.drawRocket(ctx, x / small, y / small, ang, 0, false); break;
            default: pr.drawTracer(ctx, x, y, 1.8, 3, c, 3.2);
        }
    }
};

// Pickup spans for every recipe, so items sit in their beams and pick-boxes fit the drawing
for (const k in WEAPONS) if (WEAPONS[k].art && !WEAPON_ART_SPAN[k]) WEAPON_ART_SPAN[k] = WeaponKit.span(WEAPONS[k].art);

// WeaponArt.draw falls back to the kit for recipe weapons
(() => {
    const base = WeaponArt.draw;
    WeaponArt.draw = function (ctx, type, opts) {
        if (this[type]) return base.call(this, ctx, type, opts);
        const d = WEAPONS[type];
        if (d && d.art) WeaponKit.draw(ctx, d.art, opts || {});
    };
})();
