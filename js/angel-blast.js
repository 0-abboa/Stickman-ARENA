// The angel's blast: a holy nova instead of a plain fireball. A white-gold core flash, a shock ring that
// sweeps out to exactly the 150px the damage reaches (and a second thinner one behind it), a burst of light
// rays, feathers and sparks flying outward, a pillar of light, and a bright flare where each victim is hit.
// Damage, knockback and range are unchanged (Game.angelBlast in game-combat.js).
(() => {
    const RND = (a, b) => a + Math.random() * (b - a);
    const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

    FX.drawers.nova = function (ctx, p, t) {
        const age = 1 - t, R = p.r;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalCompositeOperation = 'lighter';
        // core flash: blinding for a few frames, then it shrinks into a glow
        const core = R * (0.28 + 0.5 * (1 - Math.min(1, age * 2.2)));
        if (age < 0.5) {
            const a = 1 - age * 2, g = ctx.createRadialGradient(0, 0, 0, 0, 0, core);
            g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.45, `rgba(255,244,190,${a * 0.75})`); g.addColorStop(1, 'rgba(255,220,120,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, core, 0, Math.PI * 2); ctx.fill();
        }
        // soft golden disc behind the front of the wave
        const front = R * ease(age * 3.4);
        if (front > 2) {
            const fa = Math.max(0, 1 - age * 1.5);
            const g = ctx.createRadialGradient(0, 0, front * 0.2, 0, 0, front);
            g.addColorStop(0, 'rgba(255,230,150,0)'); g.addColorStop(0.7, `rgba(255,226,140,${0.16 * fa})`); g.addColorStop(1, `rgba(255,248,210,${0.5 * fa})`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, front, 0, Math.PI * 2); ctx.fill();
            // the front edge itself: thick and white at first, thin and gold as it spends itself
            ctx.lineWidth = 11 * (1 - age) + 1.5;
            ctx.strokeStyle = `rgba(255,${240 - 60 * age | 0},${200 - 100 * age | 0},${0.95 * fa})`;
            ctx.beginPath(); ctx.arc(0, 0, front, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 2.2; ctx.strokeStyle = `rgba(255,255,255,${fa})`;
            ctx.beginPath(); ctx.arc(0, 0, front - 4, 0, Math.PI * 2); ctx.stroke();
        }
        // second, thinner ring a beat later
        const f2 = R * 0.96 * ease((age - 0.1) * 3);
        if (f2 > 2 && age > 0.1) {
            ctx.lineWidth = 3.2 * (1 - age) + 0.8; ctx.strokeStyle = `rgba(255,236,160,${Math.max(0, 0.8 - age)})`;
            ctx.beginPath(); ctx.arc(0, 0, f2, 0, Math.PI * 2); ctx.stroke();
        }
        // rays: alternating long and short, slowly turning, fading out
        const ra = Math.max(0, 1 - age * 1.7);
        if (ra > 0.01) {
            const len = R * (0.35 + 0.95 * ease(age * 2.6)), n = 20, rot = p.rot + age * 0.5;
            for (let i = 0; i < n; i++) {
                const a = rot + i / n * Math.PI * 2, L = len * (i % 2 ? 0.58 : 1), w = i % 2 ? 0.055 : 0.085;
                const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
                g.addColorStop(0, `rgba(255,252,225,${0.75 * ra})`); g.addColorStop(1, 'rgba(255,214,110,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L); ctx.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L); ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
        // a thin ripple along the floor
        if (p.floor !== undefined && age < 0.7) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const w = R * 1.15 * ease(age * 2.4), a = 0.7 * (1 - age / 0.7);
            const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
            g.addColorStop(0, 'rgba(255,230,150,0)'); g.addColorStop(0.5, `rgba(255,246,200,${a})`); g.addColorStop(1, 'rgba(255,230,150,0)');
            ctx.fillStyle = g; ctx.fillRect(p.x - w, p.floor - 2, w * 2, 3);
            ctx.restore();
        }
    };

    FX.prototype.nova = function (x, y, r, floor) {
        return this.add({ type: 'nova', x, y, r, life: 34, rot: Math.random() * 6.28, floor });
    };

    // a flare and a burst of gold where someone is hit
    FX.prototype.holyHit = function (x, y, dir) {
        this.flashAt(x, y, '255,248,205', 54, 9);
        this.ring(x, y, '255,236,160', 46, 3, 14);
        this.sparks(x, y, '255,232,140', 12, dir > 0 ? 0 : Math.PI, 1.3, 8);
        for (let i = 0; i < 3; i++) this.star(x + RND(-12, 12), y + RND(-16, 16), '255,244,190');
    };

    Object.assign(Game.prototype, {
        angelBlast(p) {
            const fx = this.fx, cx = p.x + p.width / 2, cy = p.y + p.height / 2, R = 150;
            // floor under the blast (for the ripple), if there is one within reach
            let floor;
            for (const pl of this.level.platforms) if (pl.active && cx > pl.x && cx < pl.x + pl.width && pl.y > cy && pl.y - cy < R && (floor === undefined || pl.y < floor)) floor = pl.y;
            fx.nova(cx, cy, R, floor);
            fx.flashAt(cx, cy, '255,255,255', R * 1.5, 7);
            fx.add({ type: 'pillar', x: cx, y: 0, life: 26, color: '255,244,200', size: 22 });
            // feathers and sparks thrown outward, light motes that hang in the air
            for (let i = 0; i < 22; i++) {
                const a = Math.random() * Math.PI * 2, v = RND(2.5, 7.5);
                fx.add({ type: 'feather', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 70 + RND(0, 30), color: i % 3 ? '255,255,255' : '255,238,170', size: 4 + RND(0, 3), rot: RND(0, 6), vr: RND(-0.2, 0.2), seed: RND(0, 6), drag: 0.955 });
            }
            fx.sparks(cx, cy, '255,236,150', 26, undefined, 0, 12);
            fx.sparks(cx, cy, '255,255,255', 12, undefined, 0, 16);
            for (let i = 0; i < 12; i++) fx.later(2 + i, () => fx.star(cx + RND(-R * 0.8, R * 0.8), cy + RND(-R * 0.6, R * 0.6), '255,244,190'));
            fx.smoke(cx, cy, 5, 14);   // a little dust of it, not a fireball
            if (!this.demo) fx.screenFlash('255,246,200', 0.4);
            this.freeze = Math.max(this.freeze, 4);
            AudioSys.playAngelBlast();
            for (const t of this.players) {
                if (t === p || t.isDead || t.team === p.team) continue;
                const dist = t.touchDistanceToPoint(cx, cy);
                if (dist < R) {
                    t.lastHitType = 'bird_crystal'; t.lastHitAt = this.frameCount;
                    t.takeDamage(20, p);
                    const angle = Math.atan2(t.y - p.y, t.x - p.x);
                    t.velocity.x = Math.cos(angle) * 20;
                    t.velocity.y = Math.sin(angle) * 20;
                    const tx = t.x + t.width / 2, ty = t.y + t.height * 0.4;
                    fx.later(Math.round(dist / R * 8), () => fx.holyHit(tx, ty, Math.cos(angle)));
                }
            }
        }
    });

    // a deep boom under a bell-like chime
    AudioSys.playAngelBlast = function () {
        if (this.muteSfx) return;
        this.playNoise(0.45, 0.55);
        this.sweep(220, 40, 0.5, 0.6, 'sine');
        [[880, 0], [1318.5, 70], [1760, 140], [2637, 230]].forEach(([f, d], i) => setTimeout(() => this.playTone(f, 'sine', 0.35 - i * 0.04), d));
    };
})();
