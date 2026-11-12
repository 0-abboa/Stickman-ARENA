// Stickman animation. animate(dt) runs every rendered frame with the game's
// time scale, so slow motion and hit-stop slow every limb, flash and ragdoll.
// Pose angles are measured from straight down, positive = toward facing.
const SK = { thigh: 15, shin: 14, torso: 19, upper: 12, fore: 11, headR: 9 };

// Lying prone (crouch): local joint positions, origin at the feet, x = forward
const PRONE = [
    [19, -15], [11, -10], [-10, -6],      // head, neck, hip
    [17, -2], [26, -6], [12, -1], [21, -3],   // front elbow/hand, back elbow/hand
    [-23, -3], [-36, -2], [-22, -5], [-35, -4] // front knee/foot, back knee/foot
];

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }

Object.assign(Player.prototype, {
    animate(dt, game) {
        if (this.isDead) return;
        this.clock += dt;
        const vx = this.velocity.x;
        if (this.grounded && !this.isLaying) this.runPhase += vx * this.facing * 0.058 * dt;
        this.breath += 0.045 * dt;
        const lean = this.grounded
            ? Math.max(-1, Math.min(1, vx * this.facing / this.speed)) * 0.16
            : (this.velocity.y < 0 ? -0.06 : 0.08);
        this.lean += (lean - this.lean) * (1 - Math.pow(0.82, dt));
        this.squash *= Math.pow(0.8, dt);
        this.hitFlash = Math.max(0, this.hitFlash - 0.08 * dt);
        if (this.shieldHit > 0) this.shieldHit = Math.max(0, this.shieldHit - 0.06 * dt);
        // Health bar damage trail catches up after the hit
        if (this.hpTrail === undefined || this.hpTrail < this.health) this.hpTrail = this.health;
        else this.hpTrail = Math.max(this.health, this.hpTrail - Math.max(0.15, (this.hpTrail - this.health) * 0.04) * dt);
        this.attackAnim += dt;
        this.proneW += ((this.isLaying ? 1 : 0) - this.proneW) * (1 - Math.pow(0.55, dt));
        const thrown = !this.grounded && Math.abs(vx) > 6;   // stay limp while flying from a hit
        if (!thrown) this.flinch = Math.max(0, this.flinch - 0.04 * dt);
        this.updatePose(dt);
        this.buildSkeleton(game, dt);
    },

    // Target joint angles for the current state
    poseTarget() {
        const p = this.poseBuf || (this.poseBuf = {});
        const vx = this.velocity.x;
        const a = Math.min(1, Math.abs(vx) / this.speed);
        const moving = this.grounded && a > 0.06;
        const ph = this.runPhase;
        const def = this.isBird ? null : WeaponDefs.of(this);
        const hold = this.isBird ? 'wing' : def.hold;
        const attacking = this.attackAnim < this.attackDur;
        const sw = Math.min(1, this.attackAnim / this.attackDur);
        p.bob = 0;
        p.lean = 0;
        p.pull = 1;

        // ---- Legs ----
        if (this.onCloud) {
            p.lf1 = 0.9; p.lf2 = -1.6; p.lb1 = 0.5; p.lb2 = -1.7;
        } else if (this.isBird) {
            const s = Math.sin(this.clock * 0.18) * 0.12;
            p.lf1 = 0.15 + s; p.lf2 = -0.35; p.lb1 = -0.1 - s; p.lb2 = -0.25;
        } else if (!this.grounded) {
            if (this.velocity.y < 0) { p.lf1 = 1.0; p.lf2 = -1.5; p.lb1 = 0.25; p.lb2 = -1.0; }
            else { p.lf1 = 0.45; p.lf2 = -0.5; p.lb1 = -0.25; p.lb2 = -0.35; }
        } else if (moving) {
            // Stance leg straight and sweeping back; swing leg folds as it passes under
            const sF = Math.sin(ph), cF = Math.cos(ph);
            p.lf1 = 0.62 * a * sF;
            p.lf2 = -(0.12 + 1.35 * a * Math.max(0, cF));
            p.lb1 = -0.62 * a * sF;
            p.lb2 = -(0.12 + 1.35 * a * Math.max(0, -cF));
        } else {
            const b = Math.sin(this.breath) * 0.02;
            p.lf1 = 0.12; p.lf2 = -0.1 - b; p.lb1 = -0.1; p.lb2 = -0.06 - b;
            p.bob = Math.sin(this.breath) * 0.6;
        }

        // ---- Arms (state first, then the weapon's hold overrides) ----
        if (moving) {
            const s = Math.sin(ph);
            p.af1 = -0.75 * a * s; p.af2 = 1.2 + 0.25 * a;
            p.ab1 = 0.75 * a * s; p.ab2 = 1.2 + 0.25 * a;
        } else if (!this.grounded && !this.isBird && !this.onCloud) {
            if (this.velocity.y < 0) { p.af1 = 2.5; p.af2 = 0.3; p.ab1 = -2.2; p.ab2 = -0.3; }
            else { p.af1 = 1.6; p.af2 = 0.5; p.ab1 = -1.4; p.ab2 = -0.5; }
        } else {
            const b = Math.sin(this.breath) * 0.05;
            p.af1 = 0.22 + b; p.af2 = 0.55; p.ab1 = -0.18 - b; p.ab2 = 0.45;
        }

        switch (hold) {
            case 'wing': {
                const f = Math.sin(this.clock * 0.35) * 0.45;
                p.af1 = 2.0 + f; p.af2 = 0.2; p.ab1 = -2.0 - f; p.ab2 = -0.2;
                break;
            }
            case 'fist':
                if (attacking) {
                    // Wind up, snap the jab out, then recover to guard
                    const wind = seg(sw, 0, 0.2), hit = easeOut(seg(sw, 0.2, 0.38)), back = seg(sw, 0.5, 1);
                    p.af1 = 0.9 - 1.4 * wind + 2.15 * hit - 0.5 * back;
                    p.af2 = 1.6 + 0.3 * wind - 1.55 * hit + 1.0 * back;
                    p.ab1 = 1.0; p.ab2 = 1.9;
                    p.lean = 0.2 * hit * (1 - back);
                    if (this.grounded && !moving) { p.lf1 += 0.35 * hit; p.lb1 -= 0.2 * hit; }
                } else if (this.shieldActive) {
                    p.af1 = 1.15; p.af2 = 1.7; p.ab1 = 0.95; p.ab2 = 1.9;
                }
                break;
            case 'blade':
                if (attacking) {
                    const up = easeOut(seg(sw, 0, 0.22)), cut = easeOut(seg(sw, 0.22, 0.45)), back = seg(sw, 0.55, 1);
                    p.af1 = 0.6 + 2.1 * up - 3.1 * cut + 0.9 * back;
                    p.af2 = 1.1 - 0.5 * up - 0.5 * cut + 0.9 * back;
                    p.lean = 0.22 * cut * (1 - back);
                } else { p.af1 = 0.55; p.af2 = 1.1; }
                p.ab1 = 0.6; p.ab2 = 1.4;
                break;
            case 'pole': {
                const thrust = attacking ? easeOut(seg(sw, 0.1, 0.3)) * (1 - seg(sw, 0.5, 1)) : 0;
                p.af1 = 1.25 + 0.3 * thrust; p.af2 = 0.6 - 0.6 * thrust;
                p.ab1 = 0.95 + 0.2 * thrust; p.ab2 = 1.2 - 0.6 * thrust;
                p.lean = 0.28 * thrust;
                break;
            }
            case 'heavy':
                if (attacking) {
                    const up = easeOut(seg(sw, 0, 0.3)), slam = easeOut(seg(sw, 0.3, 0.45)), back = seg(sw, 0.6, 1);
                    p.af1 = 0.4 + 2.7 * up - 2.6 * slam + 0.3 * back;
                    p.af2 = 1.6 - 1.2 * up - 0.3 * slam + 0.9 * back;
                    p.lean = -0.1 * up + 0.35 * slam * (1 - back);
                } else { p.af1 = 0.35; p.af2 = 2.1; }
                p.ab1 = p.af1 - 0.25; p.ab2 = p.af2 + 0.2;
                break;
            case 'gun': {
                const kick = attacking ? 0.4 * Math.max(0, 1 - this.attackAnim / 6) : 0;
                p.af1 = 1.57 - kick; p.af2 = 0;
                p.ab1 = 1.3 - kick; p.ab2 = 0.55;
                p.lean = -0.05 * kick;
                break;
            }
            case 'bow':
                p.af1 = 1.57; p.af2 = 0;
                p.ab1 = 1.45; p.ab2 = 2.4;
                p.pull = attacking ? seg(sw, 0.35, 1) : 1;
                break;
            case 'staff':
                p.af1 = attacking ? 1.57 : 1.0; p.af2 = attacking ? 0.05 : 0.8;
                break;
            case 'throw':
                if (attacking) {
                    const wind = seg(sw, 0, 0.18), fling = easeOut(seg(sw, 0.18, 0.35));
                    p.af1 = 0.4 + 2.4 * wind - 1.6 * fling; p.af2 = 1.3 - 0.9 * fling;
                } else { p.af1 = 0.4; p.af2 = 1.3; }
                break;
        }
        return p;
    },

    // Ease toward the target pose; snappier while attacking
    updatePose(dt) {
        const target = this.poseTarget();
        if (!this.pose) { this.pose = Object.assign({}, target); return; }
        const base = this.attackAnim < this.attackDur ? 0.55 : 0.4;
        const k = 1 - Math.pow(1 - base, dt);
        for (const key in target) this.pose[key] += (target[key] - this.pose[key]) * k;
    },

    // World-space joints: FK from the pose, prone blend, squash and stretch,
    // foot planting, then the ragdoll flinch layered on top
    buildSkeleton(game, dt) {
        const P = this.pose;
        const alpha = game ? game.alpha : 1;
        const L = this.localBuf || (this.localBuf = Array.from({ length: 11 }, () => ({ x: 0, y: 0 })));
        const set = (i, x, y) => { L[i].x = x; L[i].y = y; };
        const hipY = -(SK.thigh + SK.shin) + P.bob;
        const lean = this.lean + P.lean;
        const sl = Math.sin(lean), cl = Math.cos(lean);
        set(2, 0, hipY);
        set(1, sl * SK.torso, hipY - cl * SK.torso);
        set(0, L[1].x + sl * SK.headR, L[1].y - cl * SK.headR);
        const shx = L[2].x + (L[1].x - L[2].x) * 0.88, shy = L[2].y + (L[1].y - L[2].y) * 0.88;
        const limb = (i, ox, oy, a1, a2, l1, l2) => {
            set(i, ox + Math.sin(a1) * l1, oy + Math.cos(a1) * l1);
            set(i + 1, L[i].x + Math.sin(a1 + a2) * l2, L[i].y + Math.cos(a1 + a2) * l2);
        };
        limb(3, shx, shy, P.af1 + lean * 0.5, P.af2, SK.upper, SK.fore);
        limb(5, shx, shy, P.ab1 + lean * 0.5, P.ab2, SK.upper, SK.fore);
        limb(7, 0, hipY, P.lf1, P.lf2, SK.thigh, SK.shin);
        limb(9, 0, hipY, P.lb1, P.lb2, SK.thigh, SK.shin);
        // Plant the lower foot on the floor so running doesn't float
        if (this.grounded && !this.isBird && !this.onCloud) {
            const low = Math.max(L[8].y, L[10].y);
            for (const j of L) j.y -= low;
        }
        // Blend into the prone pose when crouching
        const w = this.proneW;
        if (w > 0.001) {
            const breathe = Math.sin(this.breath) * 0.4;
            for (let i = 0; i < 11; i++) {
                L[i].x += (PRONE[i][0] - L[i].x) * w;
                L[i].y += (PRONE[i][1] + (i < 2 ? breathe : 0) - L[i].y) * w;
            }
        }
        // Into the world: interpolated feet origin, facing, scale, squash/stretch
        const ox = this.prevX + (this.x - this.prevX) * alpha + this.width / 2;
        const feet = this.y + this.height;
        const prevFeet = this.prevY + (this.prevH || this.height);
        const oy = Math.abs(feet - prevFeet) > 40 ? feet : prevFeet + (feet - prevFeet) * alpha;
        this.touchAnchorX = ox;
        this.touchAnchorY = oy;
        const rise = this.grounded ? 0 : Math.max(-1, Math.min(1, -this.velocity.y / 12));
        const sx = (1 - rise * 0.05 + this.squash * 0.25) * this.scale;
        const sy = (1 + rise * 0.08 - this.squash * 0.3) * this.scale;
        const J = this.jointBuf || (this.jointBuf = Array.from({ length: 11 }, () => ({ x: 0, y: 0 })));
        for (let i = 0; i < 11; i++) {
            J[i].x = ox + L[i].x * this.facing * sx;
            J[i].y = oy + L[i].y * sy;
        }
        // Ragdoll flinch: neck and hip stay on the body, everything else flails
        if (this.flinchNew) {
            this.flinchNew = false;
            this.rag = new Ragdoll(J, this.velocity.x * 0.7, this.velocity.y * 0.7, { headR: SK.headR });
            this.rag.shake(5);
            this.flinch = 1;
        }
        if (this.rag && this.flinch > 0.01 && game) {
            const pins = this.pinBuf || (this.pinBuf = []);
            for (let i = 0; i < 11; i++) pins[i] = (i === 1 || i === 2) ? J[i] : null;
            this.rag.setPins(pins);
            this.rag.step(dt, game.level);
            const f = this.flinch;
            for (let i = 0; i < 11; i++) {
                const r = this.rag.pts[i];
                J[i].x += (r.x - J[i].x) * f;
                J[i].y += (r.y - J[i].y) * f;
            }
        } else this.rag = null;
        this.joints = J;
        this.updateScarf(dt, J);
    },

    // A scarf tied at the neck: verlet rope that trails with motion and
    // flutters, stepped by dt like everything else
    updateScarf(dt, J) {
        const n = 9, seg = 5.5;
        const ax = J[1].x - this.facing * 1.5, ay = J[1].y + 1;
        let s = this.scarf;
        if (!s || Math.hypot(s[0].x - ax, s[0].y - ay) > 80) {
            s = this.scarf = [];
            for (let i = 0; i < n; i++) s.push({ x: ax - this.facing * i * seg, y: ay + i, px: ax - this.facing * i * seg, py: ay + i });
        }
        s[0].x = ax; s[0].y = ay;
        if (dt > 0) {
            const damp = Math.pow(0.9, dt);
            const flutter = Math.sin(this.clock * 0.25) * 0.25;
            for (let i = 1; i < n; i++) {
                const p = s[i];
                const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
                p.px = p.x; p.py = p.y;
                // Light drag pulls the tail out behind the fighter; flutter waves it
                p.x += vx - this.facing * 0.3 * (i / n) * dt * dt;
                p.y += vy + (0.22 + flutter * (i / n)) * dt * dt;
            }
        }
        for (let it = 0; it < 3; it++) {
            for (let i = 1; i < n; i++) {
                const a = s[i - 1], b = s[i];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
                const k = (d - seg) / d;
                if (i === 1) { b.x -= dx * k; b.y -= dy * k; }
                else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; }
            }
        }
        // hard length cap, so a frozen frame or a big teleport can never leave a stretched ribbon
        for (let i = 1; i < n; i++) {
            const a = s[i - 1], b = s[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), cap = seg * 1.25;
            if (d > cap) { const k = cap / d; b.x = a.x + dx * k; b.y = a.y + dy * k; b.px = b.x; b.py = b.y; }
        }
    }
});
