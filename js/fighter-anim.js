// Fighter animation, reworked. Replaces Player.poseTarget with a pose set built on clear key
// poses (anticipation -> strike -> overshoot -> recovery) for every way of holding a weapon,
// a weightier run (hip bob, knee lift, arm swing with elbow bend), jump tuck / fall reach,
// landing knee-bend, guard stances while idle, and two whole-body moves applied after the
// skeleton is built: a forward flip on the double jump and a spin turn for weapons that hit
// both sides. Angles: from straight down, positive toward the facing side (see player-anim.js).
(() => {
    const clamp01 = (t) => Math.max(0, Math.min(1, t));
    const sg = (t, a, b) => clamp01((t - a) / (b - a));
    const eo = (t) => 1 - (1 - t) * (1 - t);                 // ease out
    const eio = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const back = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // overshoots then settles
    const mix = (a, b, t) => a + (b - a) * t;

    Object.assign(Player.prototype, {
        poseTarget() {
            const p = this.poseBuf || (this.poseBuf = {});
            const vx = this.velocity.x, vy = this.velocity.y;
            const a = Math.min(1, Math.abs(vx) / this.speed);
            const moving = this.grounded && a > 0.06;
            const ph = this.runPhase;
            const def = this.isBird ? null : WeaponDefs.of(this);
            const hold = this.isBird ? 'wing' : def.hold;
            const attacking = this.attackAnim < this.attackDur;
            const sw = Math.min(1, this.attackAnim / this.attackDur);
            const land = this.landT || 0;
            p.bob = 0; p.lean = 0; p.pull = 1;

            // ---------- legs ----------
            if (this.onCloud) { p.lf1 = 0.9; p.lf2 = -1.6; p.lb1 = 0.5; p.lb2 = -1.7; }
            else if (this.isBird) { const s = Math.sin(this.clock * 0.18) * 0.12; p.lf1 = 0.15 + s; p.lf2 = -0.35; p.lb1 = -0.1 - s; p.lb2 = -0.25; }
            else if (!this.grounded) {
                // rising: knees tucked up; at the top: hang; falling: legs reach for the floor
                const k = clamp01((vy + 6) / 12);                     // 0 rising fast .. 1 falling fast
                p.lf1 = mix(1.25, 0.3, k); p.lf2 = mix(-2.0, -0.35, k);
                p.lb1 = mix(0.45, -0.3, k); p.lb2 = mix(-1.5, -0.55, k);
            } else if (moving) {
                const sF = Math.sin(ph), cF = Math.cos(ph);
                p.lf1 = 0.88 * a * sF + 0.08 * a;
                p.lf2 = -(0.12 + 1.55 * a * Math.max(0, cF));          // the forward-swinging leg lifts its knee
                p.lb1 = -0.88 * a * sF + 0.08 * a;
                p.lb2 = -(0.12 + 1.55 * a * Math.max(0, -cF));
                p.bob = Math.abs(Math.sin(ph)) * 2.4 * a - 1.2 * a;  // down at each footfall, up between
                p.lean = 0.07 * a;
            } else {
                const b = Math.sin(this.breath) * 0.025;
                const wide = hold === 'heavy' || hold === 'pole' ? 0.08 : 0;
                p.lf1 = 0.2 + wide; p.lf2 = -0.22 - b; p.lb1 = -0.16 - wide; p.lb2 = -0.12 - b;
                p.bob = Math.sin(this.breath) * 0.7 + 0.6;
            }
            if (land > 0 && this.grounded) {                          // knees soak up a landing
                p.lf1 += 0.45 * land; p.lf2 -= 0.9 * land; p.lb1 += 0.3 * land; p.lb2 -= 0.8 * land;
                p.bob += 5 * land; p.lean += 0.12 * land;
            }

            // ---------- arms: locomotion first ----------
            if (moving) {
                const s = Math.sin(ph);
                p.af1 = -0.85 * a * s + 0.15; p.af2 = 1.0 + 0.6 * a * Math.max(0, s);
                p.ab1 = 0.85 * a * s + 0.15; p.ab2 = 1.0 + 0.6 * a * Math.max(0, -s);
            } else if (!this.grounded && !this.isBird && !this.onCloud) {
                const k = clamp01((vy + 6) / 12);
                p.af1 = mix(2.7, 1.9, k); p.af2 = mix(0.35, 0.6, k);
                p.ab1 = mix(-2.3, -1.5, k); p.ab2 = mix(-0.3, -0.6, k);
            } else {
                const b = Math.sin(this.breath) * 0.05;
                p.af1 = 0.3 + b; p.af2 = 0.75; p.ab1 = -0.15 - b; p.ab2 = 0.6;
            }

            // ---------- the weapon's stance and its attack ----------
            const alt = this.swingAlt;                               // alternate swings look different
            switch (hold) {
                case 'wing': {
                    const f = Math.sin(this.clock * 0.35) * 0.45;
                    p.af1 = 2.0 + f; p.af2 = 0.2; p.ab1 = -2.0 - f; p.ab2 = -0.2;
                    break;
                }
                case 'fist':
                    if (attacking) {
                        const wind = eo(sg(sw, 0, 0.18)), hit = eo(sg(sw, 0.18, 0.34)), rec = eio(sg(sw, 0.5, 1));
                        if (!alt) {   // jab with the lead hand
                            p.af1 = 1.1 - 0.35 * wind + 0.55 * hit - 0.1 * rec; p.af2 = 1.7 + 0.2 * wind - 1.65 * hit + 1.5 * rec;
                            p.ab1 = 1.0; p.ab2 = 1.95; p.lean = 0.18 * hit * (1 - rec);
                        } else {      // cross with the rear hand, hips turning into it
                            p.ab1 = 1.0 - 0.3 * wind + 0.7 * hit - 0.2 * rec; p.ab2 = 1.9 + 0.2 * wind - 1.85 * hit + 1.6 * rec;
                            p.af1 = 1.15 - 0.4 * hit; p.af2 = 1.8; p.lean = 0.3 * hit * (1 - rec);
                        }
                        if (this.grounded && !moving) { p.lf1 += 0.35 * hit * (1 - rec); p.lb1 -= 0.25 * hit * (1 - rec); p.bob += 1.5 * hit; }
                    } else if (!moving && this.grounded) { p.af1 = 1.15; p.af2 = 1.75; p.ab1 = 0.95; p.ab2 = 1.95; }   // guard up
                    break;
                case 'blade':
                    if (attacking) {
                        const up = eo(sg(sw, 0, 0.24)), cut = back(sg(sw, 0.24, 0.42)), rec = eio(sg(sw, 0.55, 1));
                        if (!alt) {   // overhead diagonal slash
                            p.af1 = mix(mix(0.8, 3.0, up), -0.15, cut) + 0.95 * rec * cut;
                            p.af2 = mix(mix(1.1, 0.55, up), 0.2, cut) + 0.9 * rec;
                        } else {      // rising slash from low
                            p.af1 = mix(mix(0.8, -0.35, up), 2.6, cut) - 1.8 * rec * cut;
                            p.af2 = mix(mix(1.1, 0.9, up), 0.25, cut) + 0.85 * rec;
                        }
                        p.lean = -0.14 * up * (1 - cut) + 0.32 * cut * (1 - rec);
                        p.ab1 = 0.5 - 0.7 * cut * (1 - rec); p.ab2 = 1.3;
                        if (this.grounded) { p.lf1 += 0.45 * cut * (1 - rec); p.lb1 -= 0.3 * cut * (1 - rec); p.bob += 2 * cut * (1 - rec); }
                    } else if (!moving) { p.af1 = 0.8; p.af2 = 1.15; p.ab1 = 0.55; p.ab2 = 1.4; }   // blade up in front
                    else { p.af1 = Math.max(p.af1, 0.55); p.af2 = 1.1; }
                    break;
                case 'pole':
                    if (this.weapon && def.both && attacking) {
                        // twirl: the pole sweeps all the way round
                        const t = eio(sg(sw, 0, 0.7));
                        p.af1 = 1.3 + t * Math.PI * 2; p.af2 = 0.3; p.ab1 = p.af1 - 0.35; p.ab2 = 0.5; p.lean = 0.1 * Math.sin(t * Math.PI);
                    } else {
                        const draw = eo(sg(sw, 0, 0.2)), thrust = attacking ? back(sg(sw, 0.2, 0.36)) : 0, rec = attacking ? eio(sg(sw, 0.5, 1)) : 1;
                        const th = attacking ? thrust * (1 - rec) : 0, dr = attacking ? draw * (1 - thrust) : 0;
                        p.af1 = 1.25 - 0.25 * dr + 0.35 * th; p.af2 = 0.55 + 0.5 * dr - 0.55 * th;
                        p.ab1 = 0.95 - 0.3 * dr + 0.45 * th; p.ab2 = 1.2 + 0.3 * dr - 0.9 * th;
                        p.lean = -0.1 * dr + 0.36 * th;
                        if (this.grounded && attacking) { p.lf1 += 0.6 * th; p.lb1 -= 0.45 * th; p.bob += 3 * th; }
                    }
                    break;
                case 'heavy':
                    if (attacking) {
                        const up = eo(sg(sw, 0, 0.32)), slam = eo(sg(sw, 0.32, 0.44)), rec = eio(sg(sw, 0.62, 1));
                        if (this.weapon && def.both) {   // flails, labrys: a full horizontal swing round
                            const t = eio(sg(sw, 0, 0.6));
                            p.af1 = 1.4 + t * Math.PI * 2; p.af2 = 0.35; p.ab1 = p.af1 - 0.3; p.ab2 = 0.55;
                        } else {
                            p.af1 = mix(mix(0.4, 3.25, up), 0.3, slam) + 0.15 * rec;
                            p.af2 = mix(mix(1.8, 0.45, up), 0.15, slam) + 1.7 * rec;
                            p.ab1 = p.af1 - 0.25; p.ab2 = p.af2 + 0.25;
                        }
                        p.lean = -0.22 * up * (1 - slam) + 0.48 * slam * (1 - rec);
                        if (this.grounded) { p.bob += -2 * up * (1 - slam) + 6 * slam * (1 - rec); p.lf1 += 0.6 * slam * (1 - rec); p.lb1 -= 0.5 * slam * (1 - rec); }
                    } else { p.af1 = 0.35; p.af2 = 2.1; p.ab1 = 0.1; p.ab2 = 2.3; }   // resting on the shoulder
                    break;
                case 'gun': {
                    const k = attacking ? Math.max(0, 1 - this.attackAnim / 6) : 0;
                    const rapid = def.cooldown <= 6;
                    const jit = rapid && attacking ? Math.sin(this.clock * 3.1) * 0.04 : 0;
                    p.af1 = 1.57 + 0.32 * k + jit; p.af2 = -0.06 * k;
                    p.ab1 = 1.32 + 0.28 * k + jit; p.ab2 = 0.55;
                    p.lean = -0.1 * k - (rapid && attacking ? 0.05 : 0);
                    if (this.grounded && !moving) { p.lf1 += 0.12; p.lb1 -= 0.1; }   // braced stance
                    break;
                }
                case 'bow': {
                    const drawK = attacking ? eio(sg(sw, 0.05, 0.75)) : 0, rel = attacking ? sg(sw, 0.75, 0.85) : 0;
                    p.af1 = 1.57; p.af2 = 0;
                    p.ab1 = mix(1.5, 1.75, drawK) - 0.3 * rel; p.ab2 = mix(1.2, 2.55, drawK) + 0.4 * rel;   // string hand pulls to the cheek, then snaps back
                    p.pull = attacking ? sg(sw, 0.3, 1) : 1;
                    p.lean = -0.06 * drawK;
                    break;
                }
                case 'staff':
                    if (attacking) {
                        const raise = eo(sg(sw, 0, 0.26)), cast = back(sg(sw, 0.26, 0.42)), rec = eio(sg(sw, 0.6, 1));
                        p.af1 = mix(mix(0.9, 2.9, raise), 1.6, cast) - 0.6 * rec * cast; p.af2 = mix(mix(0.8, 0.15, raise), 0.0, cast) + 0.8 * rec;
                        p.ab1 = 0.6 + 0.9 * raise * (1 - cast); p.ab2 = 1.3;
                        p.lean = -0.12 * raise * (1 - cast) + 0.28 * cast * (1 - rec);
                        if (this.grounded) { p.lf1 += 0.35 * cast * (1 - rec); p.lb1 -= 0.2 * cast * (1 - rec); }
                    } else { p.af1 = 0.95; p.af2 = 0.85; }
                    break;
                case 'throw':
                    if (attacking) {
                        const wind = eo(sg(sw, 0, 0.2)), fling = eo(sg(sw, 0.2, 0.36)), rec = eio(sg(sw, 0.55, 1));
                        p.af1 = mix(mix(0.4, 2.95, wind), -0.35, fling) + 0.75 * rec; p.af2 = mix(mix(1.3, 1.0, wind), 0.15, fling) + 1.1 * rec;
                        p.ab1 = 0.9 - 1.2 * fling * (1 - rec); p.ab2 = 0.6;
                        p.lean = -0.18 * wind * (1 - fling) + 0.34 * fling * (1 - rec);
                        if (this.grounded) { p.lf1 += 0.5 * fling * (1 - rec); p.lb1 -= 0.35 * fling * (1 - rec); }
                    } else { p.af1 = 0.45; p.af2 = 1.4; }
                    break;
            }
            // Lunging weapons: a long split-legged lunge on the strike
            if (attacking && def && def.dash) {
                const l = eo(sg(sw, 0.1, 0.3)) * (1 - eio(sg(sw, 0.55, 1)));
                p.lean += 0.4 * l; p.lf1 += 0.7 * l; p.lb1 -= 0.6 * l; p.bob += 4 * l;
            }
            // Shield: tucked, arms crossed in front
            if (this.shieldActive && !this.isBird && !this.onCloud && hold !== 'gun') {
                p.af1 = 1.35; p.af2 = 1.7; p.ab1 = 1.15; p.ab2 = 1.85; p.lean -= 0.08;
                if (this.grounded) { p.lf2 -= 0.3; p.lb2 -= 0.3; p.bob += 2; }
            }
            // Braking from a run: lean back, front leg planted, arms thrown out for balance
            const skid = this.grounded && !this.isBird && !this.onCloud && !attacking ? (this.skidT || 0) : 0;
            if (skid > 0.02) {
                const k = Math.min(1, skid);
                p.lf1 = mix(p.lf1, 1.0, k); p.lf2 = mix(p.lf2, -0.12, k); p.lb1 = mix(p.lb1, -0.42, k); p.lb2 = mix(p.lb2, -0.85, k);
                p.af1 = mix(p.af1, 2.05, k); p.af2 = mix(p.af2, 0.35, k); p.ab1 = mix(p.ab1, -1.3, k); p.ab2 = mix(p.ab2, -0.3, k);
                p.lean = mix(p.lean, -0.2, k); p.bob += 2.2 * k;
            }
            // Mid-flip: curl up into a ball so the turn reads as a tumble, not a rotating plank
            const tuck = this.tuck || 0;
            if (tuck > 0.01) {
                p.lf1 = mix(p.lf1, 1.75, tuck); p.lf2 = mix(p.lf2, -2.45, tuck); p.lb1 = mix(p.lb1, 1.4, tuck); p.lb2 = mix(p.lb2, -2.55, tuck);
                p.af1 = mix(p.af1, 1.95, tuck); p.af2 = mix(p.af2, 1.5, tuck); p.ab1 = mix(p.ab1, 1.5, tuck); p.ab2 = mix(p.ab2, 1.75, tuck);
                p.lean = mix(p.lean, 0.35, tuck);
            }
            return p;
        }
    });

    // Bookkeeping the poses need: alternate swings, landing bend, double-jump flips, spin turns
    const attackBase = Player.prototype.attack;
    Player.prototype.attack = function () {
        this.swingAlt = !this.swingAlt;
        return attackBase.call(this);
    };
    const animBase = Player.prototype.animate;
    const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);          // smootherstep
    Player.prototype.animate = function (dt, game) {
        if (this.isDead) return animBase.call(this, dt, game);
        const vx = this.velocity.x, vy = this.velocity.y;
        // landing: start the knee bend from how hard we came down
        if (this.squash > (this.lastSquash || 0) + 0.15 && this.grounded) this.landT = Math.min(1, this.squash * 1.2);
        this.lastSquash = this.squash;
        this.landT = Math.max(0, (this.landT || 0) - 0.07 * dt);

        // ---- the second jump becomes a tumble: tuck, turn about the centre of mass, open up to land ----
        if (!this.grounded && this.jumpCount >= 2 && (this.lastJumpCount || 0) < 2 && !this.isBird && !this.onCloud && !this.isLaying) this.flipU = 0.0001;
        this.lastJumpCount = this.jumpCount;
        if (this.isBird || this.onCloud || this.isLaying) this.flipU = 0;
        if (this.flipU > 0) {
            // a landing mid-turn finishes the rotation quickly instead of snapping upright
            const rate = this.grounded ? 0.16 : 1 / 34;
            this.flipU = Math.min(1, this.flipU + rate * dt);
            if (this.flipU >= 1) this.flipU = 0;
        }
        this.tuck = this.flipU > 0 ? Math.pow(Math.sin(Math.PI * this.flipU), 0.6) : 0;

        // ---- braking from a run ----
        const pvx = this.lastVx === undefined ? vx : this.lastVx;
        if (this.grounded && !this.isLaying && Math.abs(pvx) > 3.2 && pvx * vx >= 0 && Math.abs(vx) < Math.abs(pvx) - 0.45 && vx * this.facing > -0.01) this.skidT = 1;
        this.skidT = Math.max(0, (this.skidT || 0) - 0.07 * dt);
        if (this.skidT > 0.4 && game && game.fx && this.grounded && (game.frameCount + this.id) % 3 === 0) game.fx.dust(this.x + this.width / 2 - Math.sign(vx || this.facing) * 8, this.y + this.height, 1, 6, typeof DUST_TINT !== 'undefined' ? DUST_TINT[game.level.material] : undefined);
        const pvy = this.lastVy === undefined ? vy : this.lastVy;

        animBase.call(this, dt, game);
        const J = this.joints;
        if (!J) return;
        const cx = (J[1].x + J[2].x) / 2, cy = (J[1].y + J[2].y) / 2 + 2;

        // ---- secondary motion: the head trails the body a touch, then settles ----
        const hl = this.headLag || (this.headLag = { x: 0, y: 0, vx: 0, vy: 0 });
        const tx = Math.max(-3.2, Math.min(3.2, -(vx - (this.lastVx === undefined ? vx : this.lastVx)) * 2.6));
        const ty = Math.max(-2.6, Math.min(2.6, -(vy - pvy) * 1.5));
        hl.vx = (hl.vx + (tx - hl.x) * 0.22 * dt) * Math.pow(0.72, dt); hl.vy = (hl.vy + (ty - hl.y) * 0.22 * dt) * Math.pow(0.72, dt);
        hl.x += hl.vx * dt; hl.y += hl.vy * dt;
        J[0].x += hl.x; J[0].y += hl.y;
        this.lastVx = vx; this.lastVy = vy;

        const neck0 = { x: J[1].x, y: J[1].y };
        // ---- flip: smooth acceleration into the turn and out of it ----
        if (this.flipU > 0) {
            const ang = smoother(this.flipU) * Math.PI * 2 * this.facing;
            const s = Math.sin(ang), c = Math.cos(ang);
            for (const q of J) { const x = q.x - cx, y = q.y - cy; q.x = cx + x * c - y * s; q.y = cy + x * s + y * c; }
            // the body arcs a little above the straight line of the jump while it turns
            const lift = Math.sin(Math.PI * this.flipU) * 5;
            for (const q of J) q.y -= lift;
        }
        // spin weapons: the body turns right round during the swing (mirrors through its middle)
        const def = this.isBird ? null : WeaponDefs.of(this);
        if (def && def.both && this.attackAnim < this.attackDur) {
            const t = eio(sg(this.attackAnim / this.attackDur, 0, 0.6)), turn = Math.cos(t * Math.PI * 2);
            for (const q of J) q.x = cx + (q.x - cx) * (0.35 + 0.65 * Math.abs(turn)) * Math.sign(turn || 1);
        }
        // the scarf is tied at the neck: carry it along wherever the whole-body moves put the neck
        if (this.scarf) {
            const dx = J[1].x - neck0.x, dy = J[1].y - neck0.y;
            if (dx || dy) for (const q of this.scarf) { q.x += dx; q.y += dy; q.px += dx; q.py += dy; }
        }
    };
})();
