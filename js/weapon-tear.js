// The Tear of God: a one-use weapon that almost never drops (0.5% of drops; ?testtear=1 makes it 80% so it can
// be tried). It glows three times as bright and far as any other pickup. One shot:
// really fast, passes through walls, leaves a trail of light and feathers, and does infinite damage to the first
// fighter it hits (where it stops). Whoever it kills is launched back (not far), and their soul is launched twice as far, and the soul's
// soul three times as far, and so on for nine souls; each is the same figure, 75% as opaque as the one before and
// tinted another 25% light blue. The kill plays in three seconds of slow motion and everything has faded exactly
// when it ends.
(() => {
    const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const DIVINE = 9999;                       // the shot's damage: anything above 5000 is "infinite"
    const SLOW_MS = 3000;                      // real-time length of the kill's slow motion (and of the fade)
    const SOULS = 9;
    const BLUE = [159, 214, 255];

    WEAPONS.godtear = {
        name: 'Tear of God', kind: 'shot', hold: 'staff', cooldown: 30, durability: 1, rarity: 'legendary', weight: 0, value: 300,
        muzzle: [30, 16], glowMul: 3, glow: '200,235,255', divine: true,
        proj: { type: 'divine', speed: 46, damage: DIVINE, knock: 30, size: 28, life: Infinity, solid: false, divine: true },   // life: Infinity = it never decays, so two portals facing each other keep it flying for ever; solid: false = through walls; no pierce = it stops in the first fighter it hits
        art: null, death: ['godTear', 'godSouls']
    };
    WEAPON_ART_SPAN.godtear = [-24, 62];

    // a flight staff about to drop is a Tear of God one time in six (never two Tears at once); ?testtear=1 makes every staff one
    Game.prototype.staffType = function () {
        const has = this.weapons.some(w => w.active && w.type === 'godtear') || this.players.some(p => p.weapon && p.weapon.type === 'godtear');
        return !has && Math.random() < (Game.tearChance() > 0.5 ? 1 : 1 / 6) ? 'godtear' : 'magic_stick';
    };
    // chance that a drop is the Tear (checked before the ordinary weighted pick)
    Game.tearChance = () => { try { return /[?&]testtear=1\b/.test(location.search) ? 0.8 : 0.005; } catch (e) { return 0.005; } };

    // =====================================================================================
    //  THE TEAR (a drop of liquid light) AND THE ART AROUND IT
    // =====================================================================================
    // teardrop outline, point up: x = R sin(a) sin(a/2)^m, y = -R cos(a)
    function dropPath(ctx, R) {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const a = i / 64 * TAU, x = R * Math.sin(a) * Math.pow(Math.sin(a / 2), 1.35) * 1.05, y = -R * Math.cos(a) * 1.35 + R * 0.12;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
    }
    // the drop itself: deep blue at the rim, white-hot core, glassy highlights, a bright caustic low down
    function tear(ctx, R, t) {
        dropPath(ctx, R);
        const g = ctx.createRadialGradient(-R * 0.25, -R * 0.1, R * 0.05, 0, R * 0.2, R * 1.45);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d8f2ff'); g.addColorStop(0.7, '#7fc4ff'); g.addColorStop(1, '#3a86f0');
        ctx.fillStyle = g; ctx.fill();
        ctx.save(); dropPath(ctx, R); ctx.clip();
        // light caught inside: a soft white core, a bright caustic at the bottom, a faint cross-flow
        const core = ctx.createRadialGradient(0, R * 0.1, 0, 0, R * 0.1, R * 0.8); core.addColorStop(0, 'rgba(255,255,255,0.95)'); core.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = core; ctx.fillRect(-R, -R * 1.5, R * 2, R * 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = R * 0.08;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-R, -R * 0.6 + k * R * 0.55 + Math.sin(t * 0.07 + k) * R * 0.08); ctx.quadraticCurveTo(0, -R * 0.2 + k * R * 0.55 + Math.sin(t * 0.09 + k) * R * 0.2, R, -R * 0.6 + k * R * 0.55); ctx.stroke(); }
        ctx.restore();
        // rim and glassy highlights
        dropPath(ctx, R); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1, R * 0.09); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-R * 0.42, R * 0.28, R * 0.13, R * 0.4, 0.35, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(R * 0.3, R * 0.6, R * 0.09, 0, TAU); ctx.fill();
    }
    // the pickup / held art: a crystal-clear teardrop with a small galaxy turning inside it, two gold rings orbiting it
    // like an armillary sphere (their far halves behind the drop, their near halves in front), light beads circling,
    // and a soft glow
    WeaponArt.godtear = function (ctx, o) {
        const t = (o && o.t) || 0, bob = Math.sin(t * 0.08) * 1.4, R = 13;
        ctx.save(); ctx.translate(18, bob);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(0, 3, 2, 0, 3, 36); gl.addColorStop(0, 'rgba(215,238,255,0.5)'); gl.addColorStop(0.5, 'rgba(150,200,255,0.2)'); gl.addColorStop(1, 'rgba(120,180,255,0)'); ctx.fillStyle = gl; ctx.fillRect(-36, -33, 72, 72);
        ctx.restore();
        const ring = (tilt, spin, near) => {
            ctx.save(); ctx.rotate(tilt); ctx.scale(1, 0.3);
            const g = ctx.createLinearGradient(-24, 0, 24, 0); g.addColorStop(0, 'rgba(255,214,120,0.95)'); g.addColorStop(0.5, 'rgba(255,246,200,1)'); g.addColorStop(1, 'rgba(255,190,90,0.95)');
            ctx.strokeStyle = g; ctx.lineWidth = near ? 2.4 : 1.6; ctx.globalAlpha = near ? 1 : 0.55;
            ctx.beginPath(); ctx.arc(0, 0, 24, near ? 0 : Math.PI, near ? Math.PI : TAU); ctx.stroke();
            ctx.restore();
        };
        ring(0.62 + Math.sin(t * 0.03) * 0.08, 0, false); ring(-0.62 - Math.sin(t * 0.03) * 0.08, 0, false);
        // the drop, with a galaxy inside
        tear(ctx, R, t);
        ctx.save(); ctx.translate(0, 4); dropPath(ctx, R); ctx.restore();
        ctx.save(); dropPath(ctx, R); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 14; k++) { const a = t * (0.012 + (k % 3) * 0.006) + k * 2.4, r = 2 + (k * 1.7) % 9; ctx.fillStyle = `rgba(${k % 2 ? '255,255,255' : '180,215,255'},${0.45 + 0.4 * Math.sin(t * 0.1 + k)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * r, 4 + Math.sin(a) * r * 0.8, 0.7 + (k % 3) * 0.35, 0, TAU); ctx.fill(); }
        ctx.restore();
        ring(0.62 + Math.sin(t * 0.03) * 0.08, 0, true); ring(-0.62 - Math.sin(t * 0.03) * 0.08, 0, true);
        // beads of light circling it, with a short tail
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
            for (let j = 0; j < 6; j++) { const a = t * 0.06 + k * TAU / 3 - j * 0.12, x = Math.cos(a) * 26, y = Math.sin(a) * 8 + Math.sin(a) * 2; ctx.fillStyle = `rgba(235,248,255,${(0.7 - j * 0.11) * (Math.sin(a) > 0 ? 1 : 0.5)})`; ctx.beginPath(); ctx.arc(x, y - 2, 1.9 - j * 0.22, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
        ctx.restore();
    };

    // =====================================================================================
    //  THE SHOT
    // =====================================================================================
    // anything above DIVINE-ish is "infinite": it goes through shields and the angel's resistance and always kills
    const tdBase = Player.prototype.takeDamage;
    Player.prototype.takeDamage = function (amount, attacker) {
        if (amount >= 5000 && !this.isGhost) {
            const sh = this.shieldActive, bd = this.isBird;
            this.shieldActive = false; this.isBird = false; this.autoShieldWas = this.autoShield; this.divineHit = true;
            tdBase.call(this, 900, attacker);
            this.isBird = bd; this.shieldActive = this.isDead ? false : sh;
            return;
        }
        return tdBase.call(this, amount, attacker);
    };
    // the damage shown is three rows of ten 9s, not the 900 that is really dealt
    const odBase = Game.prototype.onDamage;
    Game.prototype.onDamage = function (p, amount, attacker, shielded, killed) {
        if (p.divineHit) {
            p.divineHit = false;
            const fx = this.fx, tx = fx.text;
            fx.text = function (x, y, txt, col, size) { for (let r = 0; r < 3; r++) tx.call(this, x, y - r * 19, '9999999999', '#d6f0ff', 17); };   // three rows of ten 9s
            try { odBase.call(this, p, amount, attacker, false, killed); } finally { fx.text = tx; }
            return;
        }
        return odBase.call(this, p, amount, attacker, shielded, killed);
    };

    // Half a second of preparation before it goes off: the shooter is locked where they stand (no moving, jumping,
    // swinging or shielding, and knocked back by nothing) while energy gathers; then the shot is released.
    const CHARGE = 30;
    const fsBase = Game.prototype.fireShot;
    Game.prototype.fireShot = function (p, def) {
        if (def.divine && !p.godReleasing) {
            if (!p.godCharge) { p.godCharge = { t: 0 }; this.godChargeFx(p, def); }
            return false;
        }
        const used = fsBase.call(this, p, def);
        if (used && def.divine) this.godFire(p, def);
        return used;
    };
    Game.prototype.godChargeFx = function (p, def) {
        this.fx.add({ type: 'godcharge', x: p.x, y: p.y, life: CHARGE + 1, p, def, flip: Math.random() < 0.5 ? 1 : -1 });
        AudioSys.playPowerup && AudioSys.playPowerup();
    };
    const guBase = Game.prototype.update;
    Game.prototype.update = function () {
        guBase.call(this);
        for (const p of this.players) {
            const c = p.godCharge;
            if (!c) continue;
            const w = p.weapon;
            if (p.isDead || !w || w.type !== 'godtear') { p.godCharge = null; continue; }
            c.t++;
            if (!this.demo) this.fx.addTrauma(0.012 + 0.03 * (c.t / CHARGE));
            if (c.t >= CHARGE) {
                p.godCharge = null; p.godReleasing = true;
                const used = this.fireShot(p, WEAPONS.godtear);
                p.godReleasing = false;
                if (used && p.weapon === w && isFinite(w.durability)) w.durability--;
            }
        }
    };
    // Normally the Tear user is locked in place during its charge. On ice, a
    // player who has already built momentum can keep sliding and steer gently;
    // intermediate+ bots learn to exploit that without making the charge a free run.
    const aiBase = Player.prototype.applyInput;
    Player.prototype.applyInput = function (input) {
        if (this.godCharge) {
            const icySlide = this.grounded && this.env && this.env.grip < 0.3 && Math.abs(this.velocity.x) > 0.9;
            if (icySlide) {
                this.godCharge.sliding = true;
                return aiBase.call(this, { x: input.x, y: 0, jump: false, attack: false, shield: false, aimX: input.aimX || 0, aimY: input.aimY || 0 });
            }
            this.velocity.x = 0; this.velocity.y = 0;
            return aiBase.call(this, Player.STUNNED);
        }
        return aiBase.call(this, input);
    };
    const apBase = Player.prototype.applyPhysics;
    Player.prototype.applyPhysics = function (level) {
        if (this.godCharge) {
            if (this.godCharge.sliding && this.env && this.env.grip < 0.3) {
                if (!this.grounded) this.velocity.x = 0;
                return apBase.call(this, level);
            }
            this.velocity.x = 0; this.velocity.y = 0; return;
        }
        return apBase.call(this, level);
    };

    // the firing: a pillar of light, rings and feathers at the muzzle as the tear leaves
    Game.prototype.godFire = function (p, def) {
        const fx = this.fx, m = WeaponDefs.muzzle(p, def), d = p.facing;
        fx.add({ type: 'pillar', x: p.x + p.width / 2, y: 0, size: 34, color: '210,238,255', life: 44 });
        for (let i = 0; i < 4; i++) fx.ring(m.x, m.y, i % 2 ? '255,248,220' : '170,220,255', 60 + i * 70, 6 - i, 18 + i * 6);
        fx.flashAt(m.x, m.y, '255,255,255', 120, 8);
        fx.sparks(m.x, m.y, '255,255,255', 30, d > 0 ? 0 : Math.PI, 1.6, 14);
        fx.sparks(m.x, m.y, '170,220,255', 24, undefined, 0, 9);
        for (let i = 0; i < 14; i++) fx.add({ type: 'feather', x: p.x + p.width / 2 + (Math.random() - 0.5) * 120, y: p.y + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 3 + d * 1.2, vy: -0.4 - Math.random() * 1.4, life: 90 + Math.random() * 40, color: '255,255,255', size: 5 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.08, seed: Math.random() * 6, drag: 0.985 });
        fx.screenFlash('235,248,255', 0.3);
        if (!this.demo) { fx.addTrauma(0.55); fx.kick(d, 0, 6); }
        AudioSys.playExplosion && AudioSys.playExplosion(); AudioSys.playPowerup && AudioSys.playPowerup();
    };

    // trail of light and feathers behind a flying tear
    const upBase = Game.prototype.updateProjectiles;
    Game.prototype.updateProjectiles = function () {
        const fx = this.fx;
        for (const pr of this.projectiles) {
            if (!pr.active || !pr.spec.divine) continue;
            for (let i = 0; i < 3; i++) {
                const f = i / 3, x = pr.x - pr.vx * f, y = pr.y - pr.vy * f;
                fx.add({ type: 'tearglow', x, y, life: 30, size: 34 });
                if (i === 0) fx.add({ type: 'spark', x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 22, color: '255,255,255', size: 2.2, gravity: 0, drag: 0.93 });
            }
            if (pr.age % 2 === 0) fx.ring(pr.x, pr.y, '170,220,255', 26, 4, 14);
            if (pr.age % 3 === 0) fx.add({ type: 'feather', x: pr.x + (Math.random() - 0.5) * 30, y: pr.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 2, vy: 0.3 + Math.random() * 0.5, life: 70, color: '255,255,255', size: 4 + Math.random() * 3, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.1, seed: Math.random() * 6, drag: 0.98 });
        }
        return upBase.call(this);
    };

    const pdBase = Projectile.prototype.draw;
    Projectile.prototype.draw = function (ctx, alpha) {
        if (!this.spec.divine) return pdBase.call(this, ctx, alpha);
        const x = this.prevX + (this.x - this.prevX) * alpha, y = this.prevY + (this.y - this.prevY) * alpha, ang = Math.atan2(this.vy, this.vx), t = this.age;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        // the comet's tail: the drop's point stretches out into long soft ribbons that wave and thin to nothing
        const L = 620;
        for (const [w, a0, ph] of [[15, 0.42, 0], [8, 0.55, 1.7], [3.2, 0.9, 3.1]]) {
            const tg = ctx.createLinearGradient(-L, 0, -6, 0); tg.addColorStop(0, 'rgba(150,205,255,0)'); tg.addColorStop(0.7, `rgba(190,230,255,${a0 * 0.55})`); tg.addColorStop(1, `rgba(255,255,255,${a0})`);
            ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-6, -w * 0.55);
            for (let i = 1; i <= 12; i++) { const u = i / 12; ctx.lineTo(-6 - u * L, -w * 0.5 * (1 - u) + Math.sin(t * 0.5 + u * 7 + ph) * 5 * u); }
            for (let i = 12; i >= 1; i--) { const u = i / 12; ctx.lineTo(-6 - u * L, w * 0.5 * (1 - u) + Math.sin(t * 0.5 + u * 7 + ph) * 5 * u); }
            ctx.lineTo(-6, w * 0.55); ctx.closePath(); ctx.fill();
        }
        // halo and rings around the head
        const r = 62, hg = ctx.createRadialGradient(0, 0, 4, 0, 0, r); hg.addColorStop(0, 'rgba(235,248,255,0.65)'); hg.addColorStop(0.4, 'rgba(160,215,255,0.28)'); hg.addColorStop(1, 'rgba(110,180,255,0)');
        ctx.fillStyle = hg; ctx.fillRect(-r, -r, r * 2, r * 2);
        // the drop, round side leading, point trailing into the tail
        ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.rotate(-Math.PI / 2); tear(ctx, 15, t); ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        // sparkles shed along it
        for (let k = 0; k < 6; k++) { const u = ((t * 0.09 + k / 6) % 1); ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - u)})`; ctx.beginPath(); ctx.arc(-20 - u * 240, Math.sin(k * 2.3 + t * 0.3) * (5 + u * 16), 1.2 + (1 - u) * 2, 0, TAU); ctx.fill(); }
        ctx.restore();
    };

    FX.drawers = FX.drawers || {};
    // the preparation: a rune circle spins up under the shooter, a column of light drops from the sky, streams of
    // energy spiral in to an orb that swells at the muzzle and crackles, and the air rings contract around it
    FX.drawers.godcharge = function (ctx, q, t) {
        const pl = q.p; if (!pl) return;
        const u = clamp(1 - t, 0, 1), cx = pl.x + pl.width / 2, feet = pl.y + pl.height, m = WeaponDefs.muzzle(pl, q.def), mx = m.x, my = m.y;
        const ease = 1 - Math.pow(1 - u, 2), fade = Math.min(1, t * 6);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // column of light from the sky
        const cw = 8 + 46 * ease, cg = ctx.createLinearGradient(cx - cw, 0, cx + cw, 0); cg.addColorStop(0, 'rgba(190,225,255,0)'); cg.addColorStop(0.5, `rgba(235,248,255,${0.38 * ease})`); cg.addColorStop(1, 'rgba(190,225,255,0)');
        ctx.fillStyle = cg; ctx.fillRect(cx - cw, feet - 1500, cw * 2, 1500);
        // rune circle on the ground
        ctx.save(); ctx.translate(cx, feet - 1); ctx.scale(1, 0.2);
        const R = 30 + 78 * ease, spin = u * 5 * q.flip;
        ctx.strokeStyle = `rgba(255,232,150,${0.9 * fade})`; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(190,225,255,${0.8 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 0.74, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,248,220,${0.85 * fade})`; ctx.lineWidth = 3;
        for (let i = 0; i < 28; i++) { const a = i * TAU / 28 + spin, l = (i % 2 ? 0.08 : 0.15) * R; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
        // an inner ring of arcs turning against the outer one
        ctx.strokeStyle = `rgba(255,236,170,${0.9 * fade})`; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const a = -spin * 1.4 + i * TAU / 6; ctx.beginPath(); ctx.arc(0, 0, R * 0.5, a, a + 0.55); ctx.stroke(); }
        ctx.restore();
        // light welling up from the circle
        glow2(ctx, cx, feet - 6, 40 + 80 * ease, '210,238,255', 0.35 * ease);
        // streams of energy spiralling in to the muzzle
        for (let arm = 0; arm < 4; arm++) for (let j = 0; j < 16; j++) {
            const v = j / 16, prog = (u * 1.3 + v * 0.55) % 1, rr = (1 - prog) * (190 - 60 * u), a = arm * TAU / 4 + prog * 7.5 + u * 5 * q.flip;
            const x = mx + Math.cos(a) * rr, y = my + Math.sin(a) * rr * 0.75, s = 1.2 + prog * 3.4;
            ctx.fillStyle = `rgba(${j % 3 ? '215,240,255' : '255,238,170'},${(0.25 + 0.6 * prog) * fade})`; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        }
        // air rings contracting onto the orb
        for (let k = 0; k < 3; k++) { const w = (u * 1.6 + k / 3) % 1, rr = 130 * (1 - w); ctx.strokeStyle = `rgba(200,230,255,${0.5 * w * fade})`; ctx.lineWidth = 2 * w + 0.5; ctx.beginPath(); ctx.arc(mx, my, rr, 0, TAU); ctx.stroke(); }
        // the orb: swells and whitens, crackles
        const r0 = 3 + 18 * ease * ease;
        glow2(ctx, mx, my, r0 * 3.4, '170,215,255', 0.5);
        glow2(ctx, mx, my, r0 * 1.8, '255,255,255', 0.85);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mx, my, r0 * 0.6, 0, TAU); ctx.fill();
        ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
            let x = mx, y = my, a = Math.random() * TAU; const len = r0 * (1.6 + Math.random() * 1.8);
            ctx.strokeStyle = `rgba(${k % 2 ? '255,255,255' : '170,215,255'},${0.8 * ease})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y);
            for (let i = 0; i < 5; i++) { a += (Math.random() - 0.5) * 1.6; x += Math.cos(a) * len / 5; y += Math.sin(a) * len / 5; ctx.lineTo(x, y); }
            ctx.stroke();
        }
        // the last few frames: a swelling flash
        if (u > 0.82) { const f = (u - 0.82) / 0.18; glow2(ctx, mx, my, 40 + 150 * f, '255,255,255', 0.7 * f); }
        ctx.restore();
    };
    function glow2(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    FX.drawers.tearglow = function (ctx, p, t) { ctx.globalCompositeOperation = 'lighter'; const r = p.size * (0.8 + 0.5 * (1 - t)), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(215,240,255,${0.3 * t})`); g.addColorStop(1, 'rgba(150,200,255,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); };

    // =====================================================================================
    //  THE DEATH: body and nine souls, in three seconds of slow motion
    // =====================================================================================
    const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const tintToward = (col, w) => { const n = parseInt(String(col).replace('#', ''), 16) || 0; const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return hex(r + (BLUE[0] - r) * w, g + (BLUE[1] - g) * w, b + (BLUE[2] - b) * w); };

    // The body is thrown backwards, not far: the torso leans back with the head leading, the arms and legs trail
    // forward (back toward whoever fired) and are dragged along. Joint order as in ragdoll.js.
    function launchPose(rest, dir, wob) {
        const P = new Array(11), sn = Math.sin;
        const hip = { x: 0, y: 0 };
        const th = 0.5 + 0.06 * sn(wob * 1.3);
        const neck = { x: dir * Math.cos(th) * rest[1], y: -sn(th) * rest[1] };
        const head = { x: neck.x + dir * Math.cos(th + 0.28) * rest[0], y: neck.y - sn(th + 0.28) * rest[0] };
        const limb = (from, len, a) => ({ x: from.x - dir * Math.cos(a) * len, y: from.y + sn(a) * len });
        const e1 = limb(neck, rest[2], 0.55 + 0.14 * sn(wob + 0.5)), h1 = limb(e1, rest[3], 0.18 + 0.22 * sn(wob + 1.1));
        const e2 = limb(neck, rest[4], 0.8 + 0.14 * sn(wob + 2.1)), h2 = limb(e2, rest[5], 0.42 + 0.2 * sn(wob + 2.8));
        const k1 = limb(hip, rest[6], 0.3 + 0.1 * sn(wob + 3.3)), f1 = limb(k1, rest[7], 0.5 + 0.2 * sn(wob + 4.0));
        const k2 = limb(hip, rest[8], 0.5 + 0.1 * sn(wob + 4.6)), f2 = limb(k2, rest[9], 0.72 + 0.2 * sn(wob + 5.2));
        P[0] = head; P[1] = neck; P[2] = hip; P[3] = e1; P[4] = h1; P[5] = e2; P[6] = h2; P[7] = k1; P[8] = f1; P[9] = k2; P[10] = f2;
        return P;
    }

    Object.assign(BODY, {
        godTear(g, c, k) {
            const a = c.anim, rag = c.rag, hip0 = { x: rag.pts[2].x, y: rag.pts[2].y }, dir = k.dir || 1;
            const t0 = performance.now(), D1 = 150, rest = rag.rest;
            rag.frozen = true; a.expression = 'ko'; a.godSouls = true;
            g.godSlow = t0 + SLOW_MS;      // three real seconds of slow motion, ending exactly as the last soul fades
            const startFloor = hip0.y;
            const place = () => {
                const u = clamp((performance.now() - t0) / SLOW_MS, 0, 1), e = 1 - Math.pow(1 - u, 3);
                const dx = dir * D1 * e, dy = -30 * e;   // thrown back and a little bit up
                const pose = launchPose(rest, dir, u * 9);
                for (let i = 0; i < 11; i++) { const q = rag.pts[i]; q.x = hip0.x + dx + pose[i].x; q.y = hip0.y + dy + pose[i].y; q.px = q.x; q.py = q.y; q.vx = 0; q.vy = 0; }
                a.godU = u; a.godD = { x: dx, y: dy };
                a.alpha = u >= 1 ? 0 : Math.pow(1 - u, 1.15);
            };
            place();
            // streaks of light along the launch
            g.fx.streak && g.fx.streak(hip0.x - dir * 30, hip0.y - 10, hip0.x + dir * 280, hip0.y - 30, 6, '210,238,255', 18);
            g.fx.ring(hip0.x, hip0.y, '210,238,255', 150, 6, 26);
            g.fx.flashAt(hip0.x, hip0.y, '255,255,255', 240, 14);
            DeathAnim.hook(c, () => { place(); if (a.godU >= 1) { a.done = true; return true; } return false; });
            // the souls are drawn under the body: each the same pose, shifted by k times the body's displacement
            a.under = function (ctx, cc, A) {
                const D = a.godD || { x: 0, y: 0 }, J = rag.pts;
                for (let s = SOULS; s >= 1; s--) {
                    const op = Math.pow(0.75, s), w = 1 - Math.pow(0.75, s);
                    const ox = D.x * s * (dir >= 0 ? 1 : 1), oy = -s * 3 * (a.godU || 0);
                    const SJ = J.map(q => ({ x: q.x + ox, y: q.y + oy }));
                    const hp = SJ[2];
                    if (hp.x < -200 || hp.x > (g.level.width || 1600) + 200) continue;
                    ctx.save(); ctx.globalCompositeOperation = 'lighter';
                    const gr = ctx.createRadialGradient(hp.x, hp.y, 2, hp.x, hp.y, 46); gr.addColorStop(0, `rgba(190,228,255,${0.22 * op * A})`); gr.addColorStop(1, 'rgba(140,200,255,0)');
                    ctx.fillStyle = gr; ctx.fillRect(hp.x - 46, hp.y - 46, 92, 92);
                    ctx.restore();
                    StickArt.figure(ctx, SJ, tintToward(c.color, w), { alpha: op * A, expression: 'ko', facing: c.facing });
                }
            };
        }
    });
    Object.assign(ACCENT, {
        godSouls(g, c, k) {
            const m = DeathAnim.mid(c);
            for (let i = 0; i < 40; i++) g.fx.add({ type: 'feather', x: m.x + (Math.random() - 0.5) * 60, y: m.y + (Math.random() - 0.5) * 60, vx: k.dir * (1 + Math.random() * 7), vy: -Math.random() * 2.4, life: 120 + Math.random() * 80, color: '255,255,255', size: 4 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.1, seed: Math.random() * 6, drag: 0.985 });
            for (let i = 0; i < 24; i++) g.fx.star && g.fx.star(m.x + (Math.random() - 0.5) * 80, m.y + (Math.random() - 0.5) * 80, '210,238,255');
        }
    });

    // (the How to Play page draws the same launch)
    window.GodTear = { launchPose, tintToward, SOULS, D1: 150 };

    // the slow motion: three real seconds, whatever the frame rate
    const koBase = Game.prototype.onKO;
    Game.prototype.onKO = function (p, attacker, amount) {
        koBase.call(this, p, attacker, amount);
        if (p.death && p.death.body === 'godTear' && !this.demo) this.fx.screenFlash('235,248,255', 0.7);
    };
})();
