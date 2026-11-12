// Projectiles: one class whose physics come from the weapon's `proj` spec.
// The same static step() drives the game and the bot's shot predictions, so the
// bot knows exactly where arcs, rockets, bounces and boomerangs will go.
class Projectile {
    constructor(x, y, vx, vy, spec, owner) {
        this.x = x; this.y = y;
        this.prevX = x; this.prevY = y;
        this.vx = vx; this.vy = vy;
        this.vx0 = vx;
        this.spec = spec;
        this.type = spec.type;
        this.owner = owner;
        this.life = spec.life;
        this.maxLife = spec.life;
        this.age = 0;
        this.size = spec.size;
        this.bounces = spec.bounces || 0;
        this.returning = false;
        this.active = true;
        this.hitSet = spec.pierce ? new Set() : null;
        this.target = null;   // seekers home in on this body
    }

    get direction() { return this.vx < 0 ? -1 : 1; }
    get speed() { return Math.hypot(this.vx, this.vy); }

    // Advance any projectile-like state one frame. Returns null, 'bounce',
    // 'platform' (s.hitPlat set), 'stick' (a mine landed), 'expire' or 'caught' (boomerang back in hand).
    static step(s, level) {
        const sp = s.spec;
        const ox = s.x, oy = s.y;
        s.age++;
        s.life--;
        // Mines: stuck where they landed, ticking down
        if (s.stuck) return s.life <= 0 ? 'expire' : null;
        if (sp.type === 'boomerang' || sp.returnAccel) {
            const o = s.owner;
            if (!s.returning) {
                s.vx -= Math.sign(s.vx0) * sp.returnAccel;
                if (Math.sign(s.vx) !== Math.sign(s.vx0)) s.returning = true;
            } else if (o && !o.isDead) {
                // Home back toward the thrower's chest
                const dx = o.x + o.width / 2 - s.x, dy = o.y + o.height / 2 - s.y;
                const d = Math.hypot(dx, dy) || 1;
                s.vx += (dx / d * sp.speed - s.vx) * 0.12;
                s.vy += (dy / d * sp.speed - s.vy) * 0.12;
                if (d < 22) return 'caught';
            }
        }
        // Seekers turn toward their target's chest a little every frame
        if (sp.homing && s.target && !s.target.isDead && !s.target.dead) {
            const t = s.target;
            const dx = t.x + t.width / 2 - s.x, dy = t.y + t.height / 2 - s.y;
            const d = Math.hypot(dx, dy) || 1, v = Math.hypot(s.vx, s.vy) || 1;
            s.vx += (dx / d * v - s.vx) * sp.homing;
            s.vy += (dy / d * v - s.vy) * sp.homing;
        }
        if (sp.accel) {
            const v = Math.hypot(s.vx, s.vy) || 1;
            const nv = Math.min(sp.maxSpeed, v + sp.accel);
            s.vx *= nv / v;
            s.vy *= nv / v;
        }
        if (sp.drag) { s.vx *= sp.drag; s.vy *= sp.drag; }
        if (sp.gravity) s.vy += sp.gravity;
        // Wavy shots weave around their line of flight
        if (sp.wave) s.vy += Math.cos(s.age * sp.wave.freq) * sp.wave.amp * sp.wave.freq * 2.2;
        s.x += s.vx;
        s.y += s.vy;
        if (s.life <= 0) return 'expire';
        if (s.x < -300 || s.x > level.width + 300 || s.y > level.height + 300 || s.y < -800) return 'expire';
        if (!sp.solid) return null;
        // Sweep the path in small steps so fast shots can't tunnel through floors
        const dist = Math.hypot(s.x - ox, s.y - oy);
        const n = Math.max(1, Math.ceil(dist / 8));
        for (let i = 1; i <= n; i++) {
            const px = ox + (s.x - ox) * i / n, py = oy + (s.y - oy) * i / n;
            for (const p of level.platforms) {
                if (!p.active) continue;
                if (px > p.x && px < p.x + p.width && py > p.y && py < p.y + p.height) {
                    s.hitPlat = p;
                    if (s.bounces > 0) {
                        s.bounces--;
                        const e = sp.elastic;
                        if (e) {
                            // Ricochet: reflect off whichever face we came through
                            if (oy <= p.y) { s.y = p.y - 1; s.x = px; s.vy = -Math.abs(s.vy) * e; s.vx *= 0.97; }
                            else if (oy >= p.y + p.height) { s.y = p.y + p.height + 1; s.x = px; s.vy = Math.abs(s.vy) * e; }
                            else { s.x = ox; s.y = oy; s.vx = -s.vx * e; }
                        } else if (oy <= p.y) { s.y = p.y - 1; s.x = px; s.vy = -Math.abs(s.vy) * 0.45; s.vx *= 0.7; }
                        else { s.x = ox; s.y = oy; s.vx = -s.vx * 0.5; }
                        return 'bounce';
                    }
                    s.x = px; s.y = py;
                    if (sp.stick) {
                        // Stick to the surface it hit and arm
                        if (oy <= p.y) s.y = p.y - 5; else if (oy >= p.y + p.height) s.y = p.y + p.height + 5; else s.x = ox;
                        s.vx = 0; s.vy = 0; s.stuck = true; s.stuckOn = p;
                        return 'stick';
                    }
                    return 'platform';
                }
            }
        }
        return null;
    }

    // Did the shot's path this frame cross a body? (swept, so fast shots hit)
    static sweepHits(s, fromX, fromY, body) {
        const half = s.size / 2;
        if (body && typeof body.touchesCapsule === 'function') {
            return body.touchesCapsule(fromX, fromY, s.x, s.y, half);
        }
        const dist = Math.hypot(s.x - fromX, s.y - fromY);
        const n = Math.max(1, Math.ceil(dist / 10));
        for (let i = 1; i <= n; i++) {
            const px = fromX + (s.x - fromX) * i / n, py = fromY + (s.y - fromY) * i / n;
            if (body.x < px + half && body.x + body.width > px - half &&
                body.y < py + half && body.y + body.height > py - half) return true;
        }
        return false;
    }

    // Future positions for the bot: [{x, y, r}] for frames 1..n (null once gone)
    static predict(pr, level, n) {
        const s = {
            x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, vx0: pr.vx0, life: pr.life, age: pr.age,
            spec: pr.spec, owner: pr.owner, returning: pr.returning, bounces: pr.bounces, target: pr.target, stuck: pr.stuck
        };
        const reach = pr.size / 2 + (pr.spec.blast ? pr.spec.blast.radius * 0.45 : 0);
        const out = [];
        let alive = true;
        for (let k = 0; k < n; k++) {
            if (alive) {
                const ev = Projectile.step(s, level);
                if (ev === 'expire' || ev === 'caught' || ev === 'platform') {
                    alive = false;
                    // An explosive still bursts where it stops
                    out.push(pr.spec.blast && ev !== 'caught' ? { x: s.x, y: s.y, r: pr.spec.blast.radius * 0.7 } : null);
                    continue;
                }
                out.push({ x: s.x, y: s.y, r: reach });
            } else out.push(null);
        }
        return out;
    }

    update(level) {
        this.prevX = this.x;
        this.prevY = this.y;
        return Projectile.step(this, level);
    }

    draw(ctx, alpha) {
        const x = this.prevX + (this.x - this.prevX) * alpha;
        const y = this.prevY + (this.y - this.prevY) * alpha;
        const ang = Math.atan2(this.vy, this.vx);
        ctx.save();
        if (this.spec.look) { WeaponKit.drawLook(ctx, this, x, y, ang); ctx.restore(); return; }
        switch (this.type) {
            case 'bullet': this.drawTracer(ctx, x, y, 1.8, 3, '255,236,150', 3.2); break;
            case 'pellet': this.drawTracer(ctx, x, y, 1.2, 2.5, '255,170,80', 2.6); break;
            case 'sniper': this.drawTracer(ctx, x, y, 2.6, 2.6, '170,240,255', 3.5); break;
            case 'shockwave': this.drawShockwave(ctx, x, y); break;
            case 'arrow': this.drawArrow(ctx, x, y, ang); break;
            case 'grenade': this.drawGrenade(ctx, x, y); break;
            case 'rocket': this.drawRocket(ctx, x, y, ang, alpha); break;
            case 'boomerang': this.drawBoomerang(ctx, x, y); break;
            case 'bolt': this.drawBolt(ctx, x, y, ang); break;
            case 'kunai': this.drawKunai(ctx, x, y, ang); break;
            case 'flame': this.drawFlame(ctx, x, y); break;
            case 'plasma': this.drawPlasma(ctx, x, y); break;
            case 'bomb': this.drawBomb(ctx, x, y); break;
            case 'seeker': this.drawRocket(ctx, x, y, ang, alpha, true); break;
        }
        ctx.restore();
    }

    drawTracer(ctx, x, y, len, width, rgb, head) {
        const tx = x - this.vx * len, ty = y - this.vy * len;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},0.95)`);
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.lineWidth = width * 2.4;
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, head * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    drawShockwave(ctx, x, y) {
        const dir = this.direction;
        ctx.globalCompositeOperation = 'lighter';
        // Afterimages trailing behind the crescent
        for (let i = 3; i >= 0; i--) {
            ctx.save();
            ctx.translate(x - this.vx * 0.55 * i, y);
            ctx.scale(dir, 1 + i * 0.04);
            ctx.globalAlpha = i === 0 ? 1 : 0.32 / i;
            const g = ctx.createLinearGradient(-12, 0, 18, 0);
            g.addColorStop(0, 'rgba(0,200,255,0.1)');
            g.addColorStop(0.6, 'rgba(0,240,255,0.9)');
            g.addColorStop(1, 'rgba(255,255,255,1)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, -32);
            ctx.quadraticCurveTo(24, 0, 0, 32);
            ctx.quadraticCurveTo(-8, 0, 0, -32);
            ctx.fill();
            ctx.restore();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.quadraticCurveTo(24, 0, 0, 32);
        ctx.stroke();
        ctx.restore();
    }

    drawArrow(ctx, x, y, ang) {
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(2, 0); ctx.stroke();
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -3.5); ctx.lineTo(0, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-29, -4); ctx.lineTo(-19, 0); ctx.lineTo(-29, 4); ctx.closePath(); ctx.fill();
    }

    drawGrenade(ctx, x, y) {
        ctx.translate(x, y);
        ctx.rotate(this.age * 0.3 * this.direction);
        const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
        g.addColorStop(0, '#7cb342');
        g.addColorStop(1, '#2e4d1a');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b2a10'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#9e9e9e';
        ctx.fillRect(-1.5, -9, 3, 4);
        // Fuse light blinks faster as it runs out
        const rate = this.life < 30 ? 3 : 8;
        if (Math.floor(this.age / rate) % 2 === 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255,60,40,0.95)';
            ctx.beginPath(); ctx.arc(0, -1, 2.4, 0, Math.PI * 2); ctx.fill();
        }
    }

    drawBolt(ctx, x, y, ang) {
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#455a64';
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.fillStyle = '#eceff1';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2, -3.5); ctx.lineTo(2, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffca28';
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-22, -3.5); ctx.lineTo(-14, 0); ctx.lineTo(-22, 3.5); ctx.closePath(); ctx.fill();
    }

    drawKunai(ctx, x, y, ang) {
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = '#263238';
        ctx.fillRect(-12, -1.5, 8, 3);
        ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(-14, 0, 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath(); ctx.moveTo(-4, -3.5); ctx.lineTo(9, 0); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fill();
    }

    drawFlame(ctx, x, y) {
        const k = 1 - this.life / this.maxLife;   // 0 fresh .. 1 burnt out
        const r = 6 + k * 16;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,250,200,${0.9 * (1 - k)})`);
        g.addColorStop(0.35, `rgba(255,170,40,${0.75 * (1 - k)})`);
        g.addColorStop(1, 'rgba(220,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    drawPlasma(ctx, x, y) {
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 1 + 0.2 * Math.sin(this.age * 0.8);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 13 * pulse);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.3, 'rgba(120,255,240,0.95)');
        g.addColorStop(1, 'rgba(0,160,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 13 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(150,255,250,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.vx * 1.3, y - this.vy * 1.3); ctx.stroke();
    }

    drawBomb(ctx, x, y) {
        ctx.translate(x, y);
        const g = ctx.createRadialGradient(-2.5, -2.5, 1, 0, 0, 8);
        g.addColorStop(0, '#5c6bc0');
        g.addColorStop(1, '#1a1f3d');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff4081'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 7.5, -0.4, 0.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 7.5, Math.PI - 0.4, Math.PI + 0.4); ctx.stroke();
        // Fuse spark blinks faster as the fuse burns down
        const rate = this.life < 30 ? 2 : 6;
        if (Math.floor(this.age / rate) % 2 === 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255,230,120,1)';
            ctx.beginPath(); ctx.arc(0, -10, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(2, -9, 0, -10); ctx.stroke();
    }

    drawRocket(ctx, x, y, ang, alpha, seeker) {
        ctx.translate(x, y);
        ctx.rotate(ang);
        // Flame
        ctx.globalCompositeOperation = 'lighter';
        const fl = 12 + 8 * Math.abs(Math.sin((this.age + alpha) * 2.3));   // flicker on game time
        const fg = ctx.createLinearGradient(-12 - fl, 0, -10, 0);
        fg.addColorStop(0, 'rgba(255,90,20,0)');
        fg.addColorStop(0.5, 'rgba(255,150,40,0.8)');
        fg.addColorStop(1, 'rgba(255,240,180,1)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-12 - fl, 0); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const bg = ctx.createLinearGradient(0, -5, 0, 5);
        bg.addColorStop(0, '#eceff1');
        bg.addColorStop(1, '#78909c');
        ctx.fillStyle = bg;
        ctx.fillRect(-10, -4, 18, 8);
        ctx.fillStyle = seeker ? '#ff4081' : '#e53935';
        ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(15, 0); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
        if (seeker) {
            // Blinking lock-on light
            ctx.fillStyle = this.age % 10 < 5 ? '#ffeb3b' : '#ff6f00';
            ctx.beginPath(); ctx.arc(2, 0, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#455a64';
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-14, -8); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(-14, 8); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
    }

    drawBoomerang(ctx, x, y) {
        ctx.translate(x, y);
        ctx.rotate(this.age * 0.45);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(0, 0); ctx.lineTo(13, -9); ctx.stroke();
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = '#fff3e0';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-8, -7); ctx.lineTo(-3, -2); ctx.stroke();
    }
}
