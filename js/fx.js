// Visual effects engine: particles, trauma-based screen shake, camera kick,
// screen flashes and floating damage numbers. Everything advances by step(dt),
// where dt is the game's time scale, so slow motion slows every effect too.
class FX {
    constructor() {
        this.particles = [];
        this.trauma = 0;
        this.kickX = 0;
        this.kickY = 0;
        this.flash = 0;
        this.flashColor = '255,255,255';
        this.clock = 0;
        this.max = 1100;
        this.decals = [];   // paint splats and scorch marks stuck to platforms
        this.level = null;
    }

    reset() {
        this.particles.length = 0;
        this.decals.length = 0;
        this.trauma = 0;
        this.kickX = this.kickY = 0;
        this.flash = 0;
        this.queue = [];
    }

    add(p) {
        if (this.particles.length >= this.max) this.particles.shift();
        p.max = p.life;
        if (p.vx === undefined) p.vx = 0;
        if (p.vy === undefined) p.vy = 0;
        this.particles.push(p);
        return p;
    }

    // ---------- Emitters ----------

    sparks(x, y, color, count, angle, spread, speed) {
        for (let i = 0; i < count; i++) {
            const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread;
            const s = (speed || 6) * (0.4 + Math.random() * 0.8);
            this.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 12,
                       color, size: 1.5 + Math.random() * 1.5, gravity: 0.25, drag: 0.92 });
        }
    }

    dust(x, y, count, spread, tint) {
        for (let i = 0; i < count; i++) {
            this.add({ type: 'puff', x: x + (Math.random() - 0.5) * (spread || 16), y: y - 2,
                       vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.4, life: 22 + Math.random() * 14,
                       color: tint || '225,225,225', size: 3 + Math.random() * 3, grow: 0.18, drag: 0.9, alpha: 0.5 });
        }
    }

    smoke(x, y, count, size) {
        for (let i = 0; i < count; i++) {
            this.add({ type: 'puff', x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
                       vx: (Math.random() - 0.5) * 1.2, vy: -0.4 - Math.random() * 0.8, life: 40 + Math.random() * 30,
                       color: '90,90,95', size: (size || 5) * (0.7 + Math.random() * 0.6), grow: 0.25, drag: 0.96, alpha: 0.45 });
        }
    }

    embers(x, y, count, spread) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * (spread || 6);
            this.add({ type: 'ember', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 18 + Math.random() * 18,
                       size: 3 + Math.random() * 5, drag: 0.9, gravity: -0.05 });
        }
    }

    ring(x, y, color, radius, width, life) {
        this.add({ type: 'ring', x, y, color, size: 4, grow: radius / (life || 16), width: width || 3, life: life || 16 });
    }

    flashAt(x, y, color, size, life) {
        this.add({ type: 'flash', x, y, color: color || '255,255,255', size: size || 30, life: life || 7 });
    }

    shards(x, y, w, h, color, count) {
        for (let i = 0; i < count; i++) {
            this.add({ type: 'shard', x: x + Math.random() * w, y: y + Math.random() * h,
                       vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 5, life: 50 + Math.random() * 30,
                       color, size: 4 + Math.random() * 5, gravity: 0.3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, drag: 0.99 });
        }
    }

    debris(x, y, color, count, power) {
        for (let i = 0; i < count; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = (power || 6) * (0.4 + Math.random());
            this.add({ type: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 40 + Math.random() * 30,
                       color, size: 2 + Math.random() * 3, gravity: 0.35, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, drag: 0.99 });
        }
    }

    confetti(x, y, count, colors) {
        for (let i = 0; i < count; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2, s = 4 + Math.random() * 7;
            this.add({ type: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 90 + Math.random() * 60,
                       color: colors[i % colors.length], size: 3 + Math.random() * 3, gravity: 0.12, drag: 0.975,
                       rot: Math.random() * 6, vr: 0.1 + Math.random() * 0.25 });
        }
    }

    star(x, y, color) {
        this.add({ type: 'star', x, y, vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.4, life: 24, color: color || '255,240,160', size: 4 + Math.random() * 3 });
    }

    text(x, y, str, color, size) {
        this.add({ type: 'text', x, y, vx: (Math.random() - 0.5) * 1.2, vy: -2.2, life: 46, text: str, color, size: size || 16, drag: 0.94 });
    }

    // Paint droplets in a fighter's colour; they splat where they land
    drops(x, y, color, count, dir) {
        for (let i = 0; i < count; i++) {
            const a = (dir > 0 ? 0 : dir < 0 ? Math.PI : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 1.6 - 0.5 * Math.sign(dir || 1) * 0;
            const s = 2 + Math.random() * 5;
            this.add({ type: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5, life: 80, color, size: 1.6 + Math.random() * 2, gravity: 0.4, drag: 0.99 });
        }
    }

    // Scorch mark on the platform under an explosion
    scorch(x, y, radius) {
        if (!this.level) return;
        for (const p of this.level.platforms) {
            if (!p.active || x < p.x || x > p.x + p.width || p.y < y - 30 || p.y > y + radius * 0.6) continue;
            this.decals.push({ plat: p, dx: x - p.x, y: p.y, r: radius * 0.45, scorch: true });
            if (this.decals.length > 140) this.decals.shift();
            return;
        }
    }

    // Light pillar marking where a fighter drops in
    pillar(x, rgb) {
        this.add({ type: 'pillar', x, y: 0, life: 45, color: rgb, size: 26 });
    }

    beam(x, y, length, facing, color) {
        this.add({ type: 'beam', x, y, length, facing, color, life: 10 });
    }

    explosion(x, y, radius) {
        this.flashAt(x, y, '255,240,200', radius * 1.3, 9);
        this.ring(x, y, '255,220,150', radius, 5, 18);
        this.embers(x, y, 26, radius / 9);
        this.smoke(x, y, 16, radius / 9);
        this.sparks(x, y, '255,200,80', 22, undefined, 0, radius / 8);
        this.debris(x, y, '#4e342e', 10, radius / 12);
    }

    // ---------- Camera ----------

    addTrauma(t) { this.trauma = Math.min(1, this.trauma + t); }

    kick(dx, dy, strength) {
        const d = Math.hypot(dx, dy) || 1;
        this.kickX += dx / d * strength;
        this.kickY += dy / d * strength;
    }

    screenFlash(rgb, amount) {
        this.flashColor = rgb;
        this.flash = Math.max(this.flash, amount);
    }

    // Smooth pseudo-noise (sum of sines) so shake rolls instead of jittering
    noise(t, seed) {
        return Math.sin(t * 1.9 + seed) * 0.5 + Math.sin(t * 3.7 + seed * 2.3) * 0.3 + Math.sin(t * 7.1 + seed * 4.1) * 0.2;
    }

    shake() {
        const s = this.trauma * this.trauma;
        const t = this.clock * 0.9;
        return {
            x: 16 * s * this.noise(t, 1.3) + this.kickX,
            y: 16 * s * this.noise(t, 7.9) + this.kickY,
            angle: 0.03 * s * this.noise(t, 4.2)
        };
    }

    // ---------- Simulation ----------

    step(dt) {
        if (dt <= 0) return;
        this.clock += dt;
        this.trauma = Math.max(0, this.trauma - 0.022 * dt);
        const k = Math.pow(0.8, dt);
        this.kickX *= k; this.kickY *= k;
        this.flash = Math.max(0, this.flash - 0.06 * dt);
        this.stepQueue(dt);
        const ps = this.particles;
        let w = 0;
        for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            p.life -= dt;
            if (p.life <= 0) continue;
            if (p.drag) { const d = Math.pow(p.drag, dt); p.vx *= d; p.vy *= d; }
            if (p.gravity) p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.grow) p.size += p.grow * dt;
            if (p.vr) p.rot += p.vr * dt;
            if (p.tick) p.tick(p, dt);                  // per-frame hook (trails, homing, paths)
            if (p.stopY !== undefined && p.y >= p.stopY && p.vy >= 0) {   // lands, bounces, or sticks
                if (p.bounce && Math.abs(p.vy) > 3) { p.y = p.stopY; p.vy = -p.vy * p.bounce; if (p.onBounce) p.onBounce(p); }
                else {
                    p.y = p.stopY; p.vy = 0; p.vx = 0; p.vr = 0; p.gravity = 0;
                    if (p.onLand) { const f = p.onLand; p.onLand = null; f(p); }
                }
            }
            if (p.type === 'drop' && this.level && this.landDrop(p)) continue;
            ps[w++] = p;
        }
        ps.length = w;
    }

    landDrop(p) {
        for (const pl of this.level.platforms) {
            if (!pl.active || p.x < pl.x || p.x > pl.x + pl.width || p.y < pl.y || p.y > pl.y + pl.height) continue;
            this.decals.push({ plat: pl, dx: p.x - pl.x, y: pl.y, r: p.size * (1.6 + Math.random()), color: p.color, seed: Math.random() * 6 });
            if (this.decals.length > 140) this.decals.shift();
            return true;
        }
        return false;
    }

    drawDecals(ctx) {
        ctx.save();
        for (const d of this.decals) {
            if (!d.plat.active) continue;
            const x = d.plat.x + d.dx;
            if (d.scorch) {
                const g = ctx.createRadialGradient(x, d.y, 2, x, d.y, d.r);
                g.addColorStop(0, 'rgba(20,15,10,0.55)');
                g.addColorStop(1, 'rgba(20,15,10,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.ellipse(x, d.y + 1, d.r, d.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
                continue;
            }
            // Paint splat lying on the surface: blob, drip and a satellite drop
            ctx.fillStyle = d.color;
            ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.ellipse(x, d.y + 1.5, d.r * 1.2, d.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(x + d.r * 0.3, d.y + 2 + d.r * 0.5, d.r * 0.28, d.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + Math.cos(d.seed) * d.r * 1.8, d.y + 1, d.r * 0.32, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.ellipse(x - d.r * 0.3, d.y + 0.8, d.r * 0.4, d.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.particles) {
            const t = p.life / p.max;   // 1 -> 0 over its life
            switch (p.type) {
                case 'spark':
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = `rgba(${p.color},${Math.min(1, t * 1.5)})`;
                    ctx.lineWidth = p.size;
                    ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
                    break;
                case 'puff':
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = `rgba(${p.color},${p.alpha * t})`;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                    break;
                case 'ember': {
                    ctx.globalCompositeOperation = 'lighter';
                    const g = Math.floor(120 + 135 * t), b = Math.floor(60 * t * t);
                    ctx.fillStyle = `rgba(255,${g},${b},${t})`;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.fill();
                    break;
                }
                case 'ring':
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = `rgba(${p.color},${t})`;
                    ctx.lineWidth = p.width * t + 0.5;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
                    break;
                case 'flash': {
                    ctx.globalCompositeOperation = 'lighter';
                    const r = p.size * (1.2 - 0.4 * t);
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                    g.addColorStop(0, `rgba(${p.color},${t})`);
                    g.addColorStop(1, `rgba(${p.color},0)`);
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
                    break;
                }
                case 'shard':
                case 'chunk':
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.globalAlpha = Math.min(1, t * 2);
                    ctx.fillStyle = p.color;
                    if (p.type === 'shard') {
                        ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(-p.size * 0.6, p.size * 0.5); ctx.lineTo(-p.size * 0.6, -p.size * 0.5); ctx.closePath(); ctx.fill();
                    } else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                    break;
                case 'confetti':
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.scale(1, Math.cos(p.rot * 2));
                    ctx.globalAlpha = Math.min(1, t * 3);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
                    ctx.restore();
                    break;
                case 'feather': {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot + Math.sin(p.life * 0.12 + p.seed) * 0.6);
                    ctx.scale(1, 0.55 + 0.45 * Math.cos(p.life * 0.09 + p.seed));
                    ctx.globalAlpha = Math.min(1, t * 2.2) * 0.9;
                    ctx.fillStyle = 'rgb(' + p.color + ')';
                    ctx.beginPath();
                    ctx.moveTo(-p.size, 0);
                    ctx.quadraticCurveTo(-p.size * 0.1, -p.size * 0.5, p.size, 0);
                    ctx.quadraticCurveTo(-p.size * 0.1, p.size * 0.5, -p.size, 0);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(200,215,240,0.9)';
                    ctx.lineWidth = 0.7;
                    ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size * 0.8, 0); ctx.stroke();
                    ctx.restore();
                    break;
                }
                case 'star': {
                    ctx.globalCompositeOperation = 'lighter';
                    const s = p.size * Math.sin(t * Math.PI);
                    ctx.fillStyle = `rgba(${p.color},${t})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.25, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.25, p.y);
                    ctx.closePath(); ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x, p.y + s * 0.25); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y - s * 0.25);
                    ctx.closePath(); ctx.fill();
                    break;
                }
                case 'text': {
                    ctx.globalCompositeOperation = 'source-over';
                    const age = 1 - t;
                    const pop = age < 0.15 ? 1 + (0.15 - age) * 4 : 1;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.scale(pop, pop);
                    ctx.globalAlpha = Math.min(1, t * 2.5);
                    ctx.font = `900 ${p.size}px Orbitron, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                    ctx.strokeText(p.text, 0, 0);
                    ctx.fillStyle = p.color;
                    ctx.fillText(p.text, 0, 0);
                    ctx.restore();
                    break;
                }
                case 'drop':
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                    break;
                case 'pillar': {
                    ctx.globalCompositeOperation = 'lighter';
                    const g = ctx.createLinearGradient(p.x - p.size, 0, p.x + p.size, 0);
                    g.addColorStop(0, `rgba(${p.color},0)`);
                    g.addColorStop(0.5, `rgba(${p.color},${0.55 * t})`);
                    g.addColorStop(1, `rgba(${p.color},0)`);
                    ctx.fillStyle = g;
                    ctx.fillRect(p.x - p.size, -2000, p.size * 2, 4000);
                    break;
                }
                case 'beam':
                    this.drawBeam(ctx, p, t);
                    break;
                default:
                    if (FX.drawers && FX.drawers[p.type]) FX.drawers[p.type](ctx, p, t);   // death-fx.js kinds
            }
        }
        ctx.restore();
    }

    // Laser: soft outer glow, coloured body, white-hot core
    drawBeam(ctx, p, t) {
        const x2 = p.x + p.facing * p.length;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = t * 0.25;
        ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x2, p.y); ctx.stroke();
        ctx.globalAlpha = t * 0.9;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
    }

    drawScreen(ctx, w, h) {
        if (this.flash <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}
