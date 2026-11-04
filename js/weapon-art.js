// Vector art for every weapon. Each is drawn in a local frame with the grip at
// the origin and +x pointing along the blade or barrel, so the same drawing works
// held in a hand (rotated with the forearm) or floating as a pickup.
const WeaponArt = {
    metal(ctx, x0, y0, x1, y1, light, dark) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, light);
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.55, light);
        g.addColorStop(1, dark);
        return g;
    },

    poly(ctx, pts, fill, stroke, lw) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.2; ctx.stroke(); }
    },

    rect(ctx, x, y, w, h, fill, stroke) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
    },

    // opts: { t: animation time, pull: bow draw 0..1, loaded: bool, glow: 0..1 }
    draw(ctx, type, opts) {
        opts = opts || {};
        const fn = this[type];
        if (fn) fn.call(this, ctx, opts);
    },

    sword(ctx) {
        this.rect(ctx, -10, -2.5, 10, 5, '#5d4037', '#2b1a12');
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1;
        for (let x = -9; x < 0; x += 3) { ctx.beginPath(); ctx.moveTo(x, -2.5); ctx.lineTo(x + 2, 2.5); ctx.stroke(); }
        this.poly(ctx, [-1, -8, 2, -8, 2, 8, -1, 8], '#ffca28', '#8d6e00');
        this.poly(ctx, [2, -3, 40, -2.5, 47, 0, 40, 2.5, 2, 3], this.metal(ctx, 0, -3, 0, 3, '#cfd8dc', '#78909c'), '#37474f');
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(38, 0); ctx.stroke();
        ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(-11, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    },

    katana(ctx) {
        this.rect(ctx, -13, -2.2, 13, 4.4, '#212121');
        ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 0.9;
        for (let x = -12; x < -1; x += 3) { ctx.beginPath(); ctx.moveTo(x, -2.2); ctx.lineTo(x + 1.5, 0); ctx.lineTo(x, 2.2); ctx.stroke(); }
        ctx.fillStyle = '#ffb300';
        ctx.beginPath(); ctx.ellipse(0, 0, 2, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -2);
        ctx.quadraticCurveTo(28, -5, 50, -7);
        ctx.lineTo(50, -5);
        ctx.quadraticCurveTo(28, 0, 2, 2);
        ctx.closePath();
        ctx.fillStyle = this.metal(ctx, 0, -5, 0, 2, '#eceff1', '#90a4ae');
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(4, 1); ctx.quadraticCurveTo(28, -1.5, 49, -5); ctx.stroke();
    },

    spear(ctx) {
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(44, 0); ctx.stroke();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.8;
        ctx.stroke();
        this.poly(ctx, [44, -1.5, 50, -5, 62, 0, 50, 5, 44, 1.5], this.metal(ctx, 0, -5, 0, 5, '#e0e0e0', '#757575'), '#424242');
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(37, 7); ctx.lineTo(40, 8); ctx.lineTo(43, 2); ctx.fill();
        this.rect(ctx, 41, -2.5, 3, 5, '#ffb300');
    },

    hammer(ctx) {
        ctx.strokeStyle = '#2b1a12'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(32, 0); ctx.stroke();
        ctx.strokeStyle = '#795548'; ctx.lineWidth = 3;
        ctx.stroke();
        const g = this.metal(ctx, 30, -14, 44, 14, '#b0bec5', '#455a64');
        this.poly(ctx, [30, -14, 44, -14, 46, -10, 46, 10, 44, 14, 30, 14, 28, 10, 28, -10], g, '#263238', 1.5);
        this.rect(ctx, 28, -3, 18, 6, '#ffb300');
        this.poly(ctx, [46, -4, 53, 0, 46, 4], '#90a4ae', '#263238');
    },

    shooter(ctx) {
        this.poly(ctx, [-2, 0, 5, 0, 3, 11, -4, 11], '#3e2723', '#1b0f0a');
        this.rect(ctx, -6, -6, 22, 7, '#37474f', '#11181c');
        this.rect(ctx, -6, -6, 22, 2, '#78909c');
        this.rect(ctx, 16, -5, 4, 4, '#212121');
        ctx.strokeStyle = '#11181c'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(4, 3, 3, 0, Math.PI); ctx.stroke();
    },

    smg(ctx) {
        this.rect(ctx, -16, -4, 8, 5, '#263238');
        this.rect(ctx, -8, -7, 26, 9, '#37474f', '#11181c');
        this.rect(ctx, -8, -7, 26, 2, '#90a4ae');
        this.poly(ctx, [4, 2, 9, 2, 11, 15, 6, 15], '#212121', '#000');
        this.rect(ctx, -3, 2, 4, 7, '#3e2723');
        this.rect(ctx, 18, -5, 8, 3, '#212121');
        this.rect(ctx, 2, -10, 3, 3, '#212121');
    },

    shotgun(ctx) {
        this.poly(ctx, [-22, -2, -8, -5, -8, 3, -22, 6], '#6d4c41', '#3e2723');
        this.rect(ctx, -8, -6, 42, 5, '#37474f', '#11181c');
        this.rect(ctx, -8, -1, 34, 4, '#263238', '#11181c');
        this.rect(ctx, 12, 1, 12, 5, '#8d6e63', '#3e2723');
        this.rect(ctx, -8, -6, 42, 1.5, '#b0bec5');
    },

    sniper(ctx) {
        this.poly(ctx, [-24, -3, -10, -5, -10, 3, -24, 5], '#4e342e', '#2b1a12');
        this.rect(ctx, -10, -5, 56, 5, '#263238', '#0d1215');
        this.rect(ctx, -10, -5, 56, 1.5, '#78909c');
        this.rect(ctx, 2, -12, 18, 5, '#212121');
        ctx.fillStyle = 'rgba(100,200,255,0.9)';
        ctx.beginPath(); ctx.arc(20, -9.5, 2.2, 0, Math.PI * 2); ctx.fill();
        this.rect(ctx, -2, 0, 4, 8, '#3e2723');
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(28, 8); ctx.moveTo(32, 0); ctx.lineTo(36, 8); ctx.stroke();
    },

    bow(ctx, o) {
        const pull = (o.pull || 0) * 10;
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-2, -24); ctx.quadraticCurveTo(14, 0, -2, 24); ctx.stroke();
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-2, -24); ctx.lineTo(-2 - pull, 0); ctx.lineTo(-2, 24); ctx.stroke();
        if (o.loaded !== false) {
            ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(-2 - pull, 0); ctx.lineTo(22 - pull, 0); ctx.stroke();
            this.poly(ctx, [28 - pull, 0, 22 - pull, -3, 22 - pull, 3], '#cfd8dc');
        }
    },

    grenade(ctx) {
        this.rect(ctx, -10, -5, 10, 7, '#33691e', '#1b2a10');
        ctx.fillStyle = '#558b2f';
        ctx.beginPath(); ctx.arc(4, -1, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b2a10'; ctx.lineWidth = 1.5; ctx.stroke();
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2;
            ctx.fillStyle = '#263238';
            ctx.beginPath(); ctx.arc(4 + Math.cos(a) * 4.5, -1 + Math.sin(a) * 4.5, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        this.rect(ctx, 10, -5, 18, 8, '#37474f', '#11181c');
        this.rect(ctx, -3, 3, 4, 8, '#3e2723');
    },

    rocket(ctx, o) {
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, '#9e9d24');
        g.addColorStop(1, '#4e4b16');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -6, 46, 12);
        ctx.strokeStyle = '#2c2a0c'; ctx.lineWidth = 1.2; ctx.strokeRect(-20, -6, 46, 12);
        this.rect(ctx, -22, -7, 4, 14, '#37474f');
        this.rect(ctx, 24, -7, 4, 14, '#37474f');
        if (o.loaded !== false) this.poly(ctx, [28, -4, 35, 0, 28, 4], '#e53935', '#7f0000');
        this.rect(ctx, 0, -12, 10, 6, '#212121');
        this.rect(ctx, -2, 6, 4, 8, '#3e2723');
        this.rect(ctx, 8, 6, 4, 6, '#3e2723');
    },

    dagger(ctx, o) {
        this.rect(ctx, -12, -2.5, 12, 5, '#fafafa', '#9e9e9e');
        ctx.strokeStyle = '#212121'; ctx.lineWidth = 0.8;
        for (let x = -11; x < 0; x += 3) { ctx.beginPath(); ctx.moveTo(x, -2.5); ctx.lineTo(x + 2, 2.5); ctx.stroke(); }
        this.poly(ctx, [0, -4, 32, -9, 46, 0, 34, 5, 0, 4], '#111', '#000');
        this.poly(ctx, [2, 3, 34, 4.5, 46, 0, 34, 2.5, 2, 1.5], '#e0e0e0');
        if (o.glow) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(0,229,255,${0.35 * o.glow})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(32, -9); ctx.lineTo(46, 0); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
    },

    boomerang(ctx) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 7.5;
        ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(4, 0); ctx.lineTo(20, 4); ctx.stroke();
        ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 5.5; ctx.stroke();
        ctx.strokeStyle = '#ffe0b2'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(18, 3.5); ctx.stroke();
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(1, 3); ctx.stroke();
    },

    axe(ctx) {
        ctx.strokeStyle = '#2b1a12'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(44, 0); ctx.stroke();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3; ctx.stroke();
        const g = this.metal(ctx, 30, -18, 30, 16, '#cfd8dc', '#546e7a');
        ctx.beginPath();
        ctx.moveTo(30, -3); ctx.quadraticCurveTo(40, -10, 34, -20);
        ctx.quadraticCurveTo(52, -10, 52, 2);
        ctx.quadraticCurveTo(52, 14, 34, 18);
        ctx.quadraticCurveTo(40, 8, 30, 3);
        ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(49, -8); ctx.quadraticCurveTo(52, 2, 49, 11); ctx.stroke();
        this.rect(ctx, 26, -3, 6, 6, '#ffb300');
    },

    scythe(ctx) {
        ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(48, 0); ctx.stroke();
        ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2.8; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(46, -2);
        ctx.quadraticCurveTo(40, -26, 14, -30);
        ctx.quadraticCurveTo(34, -20, 40, -2);
        ctx.closePath();
        ctx.fillStyle = this.metal(ctx, 20, -30, 44, -2, '#e0e0e0', '#607d8b');
        ctx.fill();
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#7e57c2';
        ctx.beginPath(); ctx.arc(46, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        this.rect(ctx, 52, -2, 6, 4, '#90a4ae');
    },

    bat(ctx) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        const g = ctx.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#ffe0b2'); g.addColorStop(0.5, '#d7a86e'); g.addColorStop(1, '#8d6e63');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(6, -2.5); ctx.lineTo(36, -6.5);
        ctx.quadraticCurveTo(47, -6.5, 46, 0); ctx.quadraticCurveTo(47, 6.5, 36, 6.5);
        ctx.lineTo(6, 2.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, -2.5); ctx.lineTo(-4, 2.5); ctx.moveTo(-2, -2.5); ctx.lineTo(0, 2.5); ctx.stroke();
        this.rect(ctx, -10, -3.5, 3, 7, '#212121');
    },

    rapier(ctx) {
        ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(2, 0, 7, -1.9, 1.9); ctx.stroke();
        this.rect(ctx, -12, -2, 12, 4, '#4e342e', '#21130c');
        this.poly(ctx, [-1, -6, 2, -6, 2, 6, -1, 6], '#ffb300', '#8d6e00');
        this.poly(ctx, [2, -1.4, 52, -0.6, 58, 0, 52, 0.6, 2, 1.4], this.metal(ctx, 0, -2, 0, 2, '#eceff1', '#90a4ae'), '#455a64', 0.8);
        ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(-12, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    },

    gauntlet(ctx, o) {
        const g = this.metal(ctx, -8, -9, -8, 9, '#ffd54f', '#e65100');
        this.poly(ctx, [-8, -7, 6, -9, 14, -6, 16, 0, 14, 6, 6, 9, -8, 7], g, '#4e2600', 1.4);
        ctx.strokeStyle = 'rgba(80,30,0,0.6)'; ctx.lineWidth = 1;
        for (const y of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(15, y); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(2, 0, 0, 2, 0, 9);
        glow.addColorStop(0, `rgba(255,120,40,${0.5 + 0.4 * (o.glow || 0)})`);
        glow.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(2, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    },

    revolver(ctx) {
        this.poly(ctx, [-2, 0, 5, 0, 1, 12, -6, 11], '#6d4c41', '#2b1a12');
        this.rect(ctx, -6, -7, 12, 9, '#455a64', '#11181c');
        ctx.fillStyle = '#263238';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-3 + i * 3.5, -2.5, 1.3, 0, Math.PI * 2); ctx.fill(); }
        this.rect(ctx, 6, -6, 20, 4, '#78909c', '#11181c');
        this.rect(ctx, 22, -8, 2, 2, '#212121');
        ctx.strokeStyle = '#11181c'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(3, 3, 3, 0, Math.PI); ctx.stroke();
    },

    minigun(ctx, o) {
        this.rect(ctx, -14, -8, 18, 16, '#37474f', '#11181c');
        this.rect(ctx, -10, 8, 4, 8, '#3e2723');
        const spin = (o.t || 0) * 0.6;
        for (let i = 0; i < 3; i++) {
            const y = Math.sin(spin + i * 2.1) * 4;
            this.rect(ctx, 4, y - 1.5, 36, 3, i === 0 ? '#90a4ae' : '#607d8b', '#263238');
        }
        this.rect(ctx, 4, -6, 4, 12, '#263238');
        this.rect(ctx, 34, -6, 3, 12, '#263238');
        this.rect(ctx, -6, -12, 10, 4, '#ffb300');
    },

    crossbow(ctx, o) {
        this.poly(ctx, [-14, -2, 20, -3, 22, 3, -14, 4], '#5d4037', '#2b1a12');
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.quadraticCurveTo(10, -14, 4, -18); ctx.moveTo(14, 0); ctx.quadraticCurveTo(10, 14, 4, 18); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(0, 0); ctx.lineTo(4, 18); ctx.stroke();
        if (o.loaded !== false) {
            ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(26, -1); ctx.stroke();
            this.poly(ctx, [30, -1, 25, -4, 25, 2], '#eceff1');
        }
        this.rect(ctx, -4, 3, 4, 8, '#3e2723');
    },

    kunai(ctx) {
        ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(-3, 0, 3, 0, Math.PI * 2); ctx.stroke();
        this.rect(ctx, 0, -1.8, 9, 3.6, '#263238');
        this.poly(ctx, [9, -4.5, 24, 0, 9, 4.5], this.metal(ctx, 0, -4, 0, 4, '#eceff1', '#78909c'), '#37474f');
    },

    flamethrower(ctx, o) {
        this.rect(ctx, -18, -10, 10, 18, '#c62828', '#4a0000');
        this.rect(ctx, -18, -10, 10, 3, '#ef9a9a');
        this.rect(ctx, -8, -5, 34, 8, '#455a64', '#11181c');
        this.rect(ctx, 26, -6, 8, 10, '#263238');
        this.rect(ctx, 0, 3, 4, 8, '#3e2723');
        // Pilot light
        ctx.globalCompositeOperation = 'lighter';
        const f = 4 + Math.sin((o.t || 0) * 0.5) * 1.5;
        const g = ctx.createRadialGradient(37, -1, 0, 37, -1, f);
        g.addColorStop(0, 'rgba(160,220,255,0.95)');
        g.addColorStop(1, 'rgba(60,120,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(37, -1, f, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    },

    plasma(ctx, o) {
        this.poly(ctx, [-14, -3, -4, -6, -4, 4, -14, 6], '#eceff1', '#78909c');
        this.rect(ctx, -4, -7, 32, 10, '#eceff1', '#546e7a');
        this.rect(ctx, -4, -7, 32, 2, '#ffffff');
        this.rect(ctx, 28, -4, 8, 4, '#90a4ae');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(80,255,230,${0.45 + 0.45 * (o.glow || 0)})`;
        ctx.fillRect(2, -3, 22, 3);
        ctx.globalCompositeOperation = 'source-over';
        this.rect(ctx, 2, 3, 4, 8, '#37474f');
    },

    bomb(ctx, o) {
        const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10);
        g.addColorStop(0, '#5c6bc0'); g.addColorStop(1, '#1a1f3d');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff4081'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, 0, 9, -0.5, 0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(3, -12, 1, -14); ctx.stroke();
        if (Math.floor((o.t || 0) / 8) % 2 === 0) {
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath(); ctx.arc(1, -14.5, 2, 0, Math.PI * 2); ctx.fill();
        }
    },

    seeker(ctx, o) {
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, '#37474f'); g.addColorStop(1, '#11181c');
        ctx.fillStyle = g;
        ctx.fillRect(-18, -6, 44, 12);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.strokeRect(-18, -6, 44, 12);
        this.rect(ctx, -18, -6, 44, 2, '#ff4081');
        if (o.loaded !== false) this.poly(ctx, [26, -4, 34, 0, 26, 4], '#ff4081', '#880e4f');
        this.rect(ctx, 2, -13, 12, 7, '#212121');
        ctx.fillStyle = Math.floor((o.t || 0) / 10) % 2 ? '#ffeb3b' : '#ff6f00';
        ctx.beginPath(); ctx.arc(8, -9.5, 2, 0, Math.PI * 2); ctx.fill();
        this.rect(ctx, -2, 6, 4, 8, '#3e2723');
    },

    magic_stick(ctx, o) {
        const t = o.t || 0;
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(28, 0, 1, 28, 0, 16);
        glow.addColorStop(0, `rgba(255,220,120,${0.55 + 0.25 * Math.sin(t * 0.15)})`);
        glow.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(28, 0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const shaft = ctx.createLinearGradient(0, -3, 0, 3);
        shaft.addColorStop(0, '#e53935');
        shaft.addColorStop(1, '#7f0000');
        ctx.fillStyle = shaft;
        ctx.fillRect(-26, -2.5, 52, 5);
        this.poly(ctx, [24, -3.5, 31, -4.5, 31, 4.5, 24, 3.5], '#ffd54f', '#8d6e00');
        this.poly(ctx, [-24, -3.5, -31, -4.5, -31, 4.5, -24, 3.5], '#ffd54f', '#8d6e00');
    },

    bird_crystal(ctx, o) {
        const t = o.t || 0;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
            const a = t * 0.02 + i * Math.PI / 3;
            const g = ctx.createLinearGradient(0, 0, Math.cos(a) * 34, Math.sin(a) * 34);
            g.addColorStop(0, 'rgba(255,128,255,0.45)');
            g.addColorStop(1, 'rgba(255,128,255,0)');
            ctx.strokeStyle = g; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        const g = ctx.createLinearGradient(-10, -14, 10, 14);
        g.addColorStop(0, '#ffd6ff');
        g.addColorStop(0.5, '#e040fb');
        g.addColorStop(1, '#6a1b9a');
        this.poly(ctx, [0, -15, 10, -2, 0, 15, -10, -2], g, '#4a0072', 1.5);
        this.poly(ctx, [0, -15, 4, -2, 0, 15, -3, -2], 'rgba(255,255,255,0.45)');
    }
};
