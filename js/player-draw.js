// Drawing for stickmen. Everything is drawn from the world-space skeleton built
// by player-anim.js, so the same art serves living fighters and ragdoll corpses.
const StickArt = {
    shade(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
        const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
        const b = Math.min(255, Math.max(0, (n & 255) * f));
        return `rgb(${r | 0},${g | 0},${b | 0})`;
    },

    // Blend a hex colour toward another (hex or "rgb(r,g,b)"); returns hex so shade() still works
    mix(hex, other, t) {
        const a = parseInt(hex.slice(1), 16);
        const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(other);
        const o = other[0] === '#' ? (() => { const n = parseInt(other.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })() : [+m[1], +m[2], +m[3]];
        const c = [(a >> 16) & 255, (a >> 8) & 255, a & 255].map((v, i) => Math.round(v + (o[i] - v) * t));
        return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    },

    line(ctx, pts, color, width, outline) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (outline) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = width + 2.5;
            ctx.stroke();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    },

    // Full figure: back limbs, torso, head, front limbs. opts: { alpha, ko,
    // expression, facing, flat (single colour silhouette, for afterimages/flash) }
    figure(ctx, J, color, opts) {
        opts = opts || {};
        const flat = opts.flat;
        const sh = { x: J[2].x + (J[1].x - J[2].x) * 0.88, y: J[2].y + (J[1].y - J[2].y) * 0.88 };
        const back = flat ? color : this.shade(color, 0.65);
        const outline = !flat;
        ctx.save();
        ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.line(ctx, [sh, J[5], J[6]], back, 3.8, outline);
        this.line(ctx, [J[2], J[9], J[10]], back, 4, outline);
        this.line(ctx, [J[2], J[1]], color, 4.4, outline);
        this.line(ctx, [J[2], J[7], J[8]], color, 4.2, outline);
        this.line(ctx, [sh, J[3], J[4]], color, 4, outline);
        if (!flat) {
            // Rim light along the lit (upper-left) side of the body
            ctx.globalAlpha *= 0.35;
            this.line(ctx, [{ x: J[2].x - 0.8, y: J[2].y - 0.8 }, { x: J[1].x - 0.8, y: J[1].y - 0.8 }], '#ffffff', 1.2, false);
            ctx.globalAlpha /= 0.35;
            ctx.fillStyle = color;
            for (const i of [4, 8]) { ctx.beginPath(); ctx.arc(J[i].x, J[i].y, 2.6, 0, Math.PI * 2); ctx.fill(); }
        }
        this.head(ctx, J, color, opts);
        ctx.restore();
    },

    head(ctx, J, color, opts) {
        const h = J[0], n = J[1];
        const r = SK.headR;
        if (opts.flat) {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(h.x, h.y, r + 1, 0, Math.PI * 2); ctx.fill();
            return;
        }
        const g = ctx.createRadialGradient(h.x - 3, h.y - 3, 1, h.x, h.y, r + 1);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#dfe3e8');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5.2; ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 3.2; ctx.stroke();
        // Face oriented along the head's up direction and facing
        const ux = (h.x - n.x) / r, uy = (h.y - n.y) / r;          // "up" unit-ish
        const f = opts.facing || 1;
        const fx = -uy * f, fy = ux * f;                            // "forward"
        const ex = h.x + fx * 4 + ux * 1.5, ey = h.y + fy * 4 + uy * 1.5;
        ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        const exp = opts.expression || 'normal';
        if (exp === 'ko') {
            for (const s of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(ex - 2 + s, ey - 2); ctx.lineTo(ex + 2 + s, ey + 2);
                ctx.moveTo(ex + 2 + s, ey - 2); ctx.lineTo(ex - 2 + s, ey + 2);
                ctx.stroke();
            }
            return;
        }
        if (exp === 'blink') {
            ctx.beginPath(); ctx.moveTo(ex - 2, ey); ctx.lineTo(ex + 2, ey); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(ex, ey, exp === 'hurt' ? 1.2 : 1.6, 0, Math.PI * 2); ctx.fill();
            if (exp === 'angry') {
                ctx.beginPath();
                ctx.moveTo(ex - fx * 3 + ux * 3.5, ey - fy * 3 + uy * 3.5);
                ctx.lineTo(ex + fx * 2 + ux * 2, ey + fy * 2 + uy * 2);
                ctx.stroke();
            }
        }
        // Mouth
        const mx = h.x + fx * 4.5 - ux * 3.5, my = h.y + fy * 4.5 - uy * 3.5;
        ctx.beginPath();
        if (exp === 'hurt') { ctx.moveTo(mx - 2, my + 1); ctx.lineTo(mx + 2, my - 1); }
        else if (exp === 'angry') { ctx.moveTo(mx - 2, my); ctx.lineTo(mx + 2, my); }
        else ctx.arc(mx, my - 1, 2, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }
};

// ---- cached angel wing sprites (see drawAngelWings) ----
const WING_PHASES = 12, WING_SCALE = 1.5, WING_BOX = 110;   // phases of the flap; sprite pixels per world px; world px each side of the shoulder
const WING_SPRITES = {};
function wingSprite(phase, rest) {
    const key = phase + (rest ? 'r' : '');
    if (WING_SPRITES[key]) return WING_SPRITES[key];
    const flap = phase / (WING_PHASES - 1) * 2 - 1, r = rest ? 0.55 : 0;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(WING_BOX * 2 * WING_SCALE);
    const x = c.getContext('2d');
    x.scale(WING_SCALE, WING_SCALE);
    x.translate(WING_BOX, WING_BOX);                             // the shoulder is the origin; this is the right-hand wing
    const feather = (px, py, ang, len, wid, tint) => {
        x.save();
        x.translate(px, py); x.rotate(ang);
        x.beginPath();
        x.moveTo(0, 0);
        x.bezierCurveTo(len * 0.25, -wid, len * 0.8, -wid * 0.8, len, 0);
        x.bezierCurveTo(len * 0.8, wid * 0.7, len * 0.25, wid * 0.9, 0, 0);
        const g = x.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, tint); g.addColorStop(1, '#fff0b8');
        x.fillStyle = g; x.fill();
        x.strokeStyle = 'rgba(150,175,215,0.55)'; x.lineWidth = 0.8; x.stroke();
        x.restore();
    };
    const arm = -Math.PI / 2 + (0.85 - flap * 0.5 + r * 0.5);    // shoulder -> wrist
    const wx = Math.cos(arm) * 34, wy = Math.sin(arm) * 34;
    const gl = x.createRadialGradient(wx * 0.6, wy * 0.6, 4, wx * 0.6, wy * 0.6, 80);   // soft glow instead of a per-feather shadow
    gl.addColorStop(0, 'rgba(255,240,180,0.35)'); gl.addColorStop(1, 'rgba(255,240,180,0)');
    x.fillStyle = gl; x.beginPath(); x.arc(wx * 0.6, wy * 0.6, 80, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 7; i++) { const u = i / 6; feather(wx, wy, arm + (0.12 + u * (1.5 - r * 0.5)), 60 - u * 14, 8.5, '#dbe6fb'); }
    for (let i = 0; i < 6; i++) { const u = i / 5, f = 0.15 + u * 0.7; feather(wx * f, wy * f, arm + (1.25 - r * 0.3 + u * 0.35), 44 - u * 6, 7.5, '#e9f0fd'); }
    for (let i = 0; i < 6; i++) { const u = i / 5, f = 0.1 + u * 0.8; feather(wx * f, wy * f, arm + (0.7 + u * 0.55), 24 - u * 4, 6, '#ffffff'); }
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3.5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(wx, wy); x.stroke();
    return WING_SPRITES[key] = c;
}

// Theme light for the rim: [rgb, offset x, offset y (toward the light), strength]
const RIM_LIGHT = {
    dirt: ['255,236,190', -1.2, -1.2, 0.35], stone: ['210,170,255', -1.2, -1, 0.3], ice: ['190,235,255', -1.2, -1.2, 0.45], cloud: ['255,250,235', -1.2, -1.2, 0.4],
    magic: ['220,150,255', 1.2, -1, 0.5], neon: ['0,229,255', -1.3, -0.6, 0.6], lava: ['255,140,50', 0.4, 1.4, 0.6], ocean: ['150,240,255', -0.6, -1.4, 0.45],
    candy: ['255,200,235', -1.2, -1.2, 0.4], haunted: ['170,190,255', 1, -1.2, 0.45]
};
const HOLD_ANGLE = { blade: -1.3, pole: 0, heavy: -1.45, gun: 0, bow: 0, staff: -1.35, throw: -0.6 };
const TIP_LEN = { sword: 47, katana: 50, spear: 62, hammer: 50, dagger: 46, axe: 50, scythe: 58, bat: 46, rapier: 58 };

Object.assign(Player.prototype, {
    expression() {
        if (this.hitFlash > 0.35) return 'hurt';
        if (this.attackAnim < this.attackDur || this.shieldActive) return 'angry';
        if ((this.clock + this.id * 97) % 190 < 6) return 'blink';
        if (this.health < this.maxHealth * 0.3) return 'hurt';
        return 'normal';
    },

    draw(ctx, game) {
        if (this.isDead || !this.joints) return;
        const J = this.joints;
        const color = this.isBird ? '#FFFFFF' : this.color;
        const feetY = this.prevY + (this.y - this.prevY) * game.alpha + this.height;

        if (this.grounded && !this.onCloud) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(J[2].x, feetY + 1, 15 * this.scale, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Speed afterimages
        const fast = Math.abs(this.velocity.x) > 6.5 || this.flinch > 0.4;
        if (fast && this.trail.length >= 8) {
            for (let k = 3; k >= 1; k--) {
                const dx = this.trail[k * 2] - this.x, dy = this.trail[k * 2 + 1] - this.y;
                const ghost = J.map(j => ({ x: j.x + dx * 1.4, y: j.y + dy * 1.4 }));
                StickArt.figure(ctx, ghost, color, { flat: true, alpha: 0.09 * (4 - k) });
            }
        }
        if (game.teamMode && this.teamColor && this.grounded) {
            // Team ring under the feet
            ctx.save();
            ctx.strokeStyle = this.teamColor;
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.ellipse(J[2].x, feetY + 1, 18, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
        if (this.scarf && !this.isBird) this.drawScarf(ctx, this.teamColor || color);
        if (this.isBird) { this.drawAura(ctx, J); this.drawAngelWings(ctx, J); }
        else if (this.wings) this.drawWings(ctx, J);
        if (this.onCloud) this.drawCloud(ctx, feetY);

        const st = this.status;
        const tinted = st && st.freeze > 0 ? StickArt.mix(color, '#b3e5fc', 0.75) : color;
        StickArt.figure(ctx, J, this.paintT > 0 && this.paint && !(st && st.freeze > 0) ? StickArt.mix(color, `rgb(${this.paint})`, Math.min(0.55, this.paintT / 120)) : tinted,
                        { facing: this.facing, expression: st && st.stun > 0 ? 'hurt' : this.expression(), style: this.isBird ? null : StickArt.STYLES && StickArt.STYLES[this.id % StickArt.STYLES.length], t: this.clock });
        this.drawRim(ctx, J, game);
        this.drawHeld(ctx, J);
        if (st) this.drawStatus(ctx, J, st);
        if (this.hitFlash > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            StickArt.figure(ctx, J, '#ffffff', { flat: true, alpha: this.hitFlash * 0.9 });
            ctx.restore();
        }
        if (this.isBird) this.drawHalo(ctx, J);
        if (this.shieldActive) this.drawShield(ctx);
        if (game.kingId === this.id) this.drawCrown(ctx, J);
        this.drawOverhead(ctx, J, game.kingId === this.id);
    },

    // Rim light in the colour of the arena's light (lava glow from below, neon from the side...)
    drawRim(ctx, J, game) {
        const L = RIM_LIGHT[game.level.material];
        if (!L) return;
        const [rgb, lx, ly, a] = L;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const sh = { x: J[2].x + (J[1].x - J[2].x) * 0.88, y: J[2].y + (J[1].y - J[2].y) * 0.88 };
        ctx.beginPath();
        for (const chain of [[J[2], J[1]], [J[2], J[7], J[8]], [J[2], J[9], J[10]], [sh, J[3], J[4]], [sh, J[5], J[6]]]) {
            chain.forEach((q, i) => i ? ctx.lineTo(q.x + lx, q.y + ly) : ctx.moveTo(q.x + lx, q.y + ly));
        }
        ctx.stroke();
        ctx.beginPath(); ctx.arc(J[0].x + lx * 0.6, J[0].y + ly * 0.6, SK.headR + 0.4, Math.atan2(ly, lx) - 1, Math.atan2(ly, lx) + 1); ctx.stroke();
        ctx.restore();
    },

    // Burning, poisoned, frozen, slowed and stunned fighters show it on the body
    drawStatus(ctx, J, st) {
        const t = this.clock;
        ctx.save();
        if (st.freeze > 0) {
            // A crust of ice over the body
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(200,240,255,0.55)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(J[1].x, J[1].y); ctx.lineTo(J[2].x, J[2].y); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(225,245,255,0.85)';
            for (const i of [4, 6, 8, 10, 0]) { ctx.beginPath(); ctx.moveTo(J[i].x - 3, J[i].y); ctx.lineTo(J[i].x, J[i].y - 6); ctx.lineTo(J[i].x + 3, J[i].y); ctx.closePath(); ctx.fill(); }
        }
        if (st.trap > 0) {
            // A net thrown over the body: a ring of cord with a mesh across it, shaking as they struggle
            const cx = (J[1].x + J[2].x) / 2, cy = (J[1].y + J[2].y) / 2 + 4, R = 27, k = Math.min(1, st.trap / 24);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = '#efe6c8'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
            const sh = Math.sin(t * 0.9) * 1.2;
            ctx.beginPath(); ctx.ellipse(cx + sh, cy, R * 0.8, R, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 1;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath(); ctx.moveTo(cx + i * 7 - 9 + sh, cy - R * 0.9); ctx.lineTo(cx + i * 7 + 9 + sh, cy + R * 0.9); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx + i * 7 + 9 + sh, cy - R * 0.9); ctx.lineTo(cx + i * 7 - 9 + sh, cy + R * 0.9); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        if (st.burn > 0) {
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(J[2].x, J[2].y - 8, 2, J[2].x, J[2].y - 8, 30);
            g.addColorStop(0, `rgba(255,140,40,${0.35 + 0.1 * Math.sin(t * 0.5)})`); g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(J[2].x, J[2].y - 8, 30, 0, Math.PI * 2); ctx.fill();
        }
        if (st.poison > 0) {
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < 3; i++) {
                const a = t * 0.08 + i * 2.1, x = J[0].x + Math.cos(a) * 9, y = J[0].y - 12 - ((t * 0.6 + i * 9) % 18);
                ctx.fillStyle = `rgba(140,255,70,${0.8 - ((t * 0.6 + i * 9) % 18) / 24})`;
                ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
            }
        }
        if (st.slow > 0 && !(st.freeze > 0)) {
            ctx.strokeStyle = 'rgba(170,200,255,0.6)'; ctx.lineWidth = 1.5;
            for (const i of [8, 10]) { ctx.beginPath(); ctx.arc(J[i].x, J[i].y - 2, 5 + Math.sin(t * 0.2 + i) * 1, 0, Math.PI * 2); ctx.stroke(); }
        }
        if (st.stun > 0) {
            // Stars circling the head
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < 3; i++) {
                const a = t * 0.15 + i * 2.09, x = J[0].x + Math.cos(a) * 13, y = J[0].y - 13 + Math.sin(a) * 4;
                ctx.fillStyle = '#fff176'; ctx.beginPath();
                for (let k = 0; k < 10; k++) { const r = k % 2 ? 1.5 : 3.6, q = k / 10 * Math.PI * 2 - Math.PI / 2 + a; ctx.lineTo(x + Math.cos(q) * r, y + Math.sin(q) * r); }
                ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
    },

    // The held weapon rides the forearm; melee swings leave a smear
    drawHeld(ctx, J) {
        const type = WeaponDefs.typeOf(this);
        const def = WeaponDefs.of(this);
        const attacking = this.attackAnim < this.attackDur;
        if (!type || type === 'bird_crystal') {
            // Fist streak during the jab
            const sw = this.attackAnim / this.attackDur;
            if (attacking && sw > 0.18 && sw < 0.42) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                ctx.lineWidth = 2;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(J[4].x - this.facing * 18, J[4].y + i * 4);
                    ctx.lineTo(J[4].x - this.facing * 4, J[4].y + i * 3);
                    ctx.stroke();
                }
                ctx.restore();
            }
            this.swingTrail = null;
            return;
        }
        const hand = J[4], elbow = J[3];
        const fore = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
        const ang = fore + (HOLD_ANGLE[def.hold] || 0) * this.facing;
        // Swing smear between the hand and the blade tip
        const tipLen = TIP_LEN[type] || (def.kind === 'melee' && def.hold !== 'fist' && WEAPON_ART_SPAN[type] ? WEAPON_ART_SPAN[type][1] : 0);
        if (tipLen && attacking && this.attackAnim < this.attackDur * 0.6) {
            const tr = this.swingTrail || (this.swingTrail = []);
            tr.push({ tx: hand.x + Math.cos(ang) * tipLen, ty: hand.y + Math.sin(ang) * tipLen,
                      bx: hand.x + Math.cos(ang) * tipLen * 0.35, by: hand.y + Math.sin(ang) * tipLen * 0.35 });
            if (tr.length > 7) tr.shift();
            if (tr.length > 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let i = 1; i < tr.length; i++) {
                    const a = tr[i - 1], b = tr[i];
                    ctx.fillStyle = `rgba(${RARITY[def.rarity].glow},${0.08 + 0.4 * i / tr.length})`;
                    ctx.beginPath();
                    ctx.moveTo(a.bx, a.by); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b.bx, b.by);
                    ctx.closePath(); ctx.fill();
                }
                ctx.restore();
            }
        } else this.swingTrail = null;

        ctx.save();
        ctx.translate(hand.x, hand.y);
        ctx.rotate(ang);
        ctx.scale(1, this.facing);
        const ready = this.attackCooldown <= 0;
        WeaponArt.draw(ctx, type, {
            t: this.clock, pull: this.pose ? this.pose.pull : 1,
            loaded: type === 'bow' ? this.pose && this.pose.pull > 0.25 : ready, glow: ready ? 1 : 0.3
        });
        ctx.restore();
        // Muzzle flash right after a shot
        if (def.kind === 'shot' && def.hold === 'gun' && this.attackAnim < 3) {
            const span = WEAPON_ART_SPAN[type];
            const mx = hand.x + Math.cos(ang) * span[1], my = hand.y + Math.sin(ang) * span[1];
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(mx, my, 1, mx, my, 16);
            g.addColorStop(0, 'rgba(255,250,220,1)');
            g.addColorStop(0.4, 'rgba(255,190,60,0.8)');
            g.addColorStop(1, 'rgba(255,120,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    },

    drawScarf(ctx, color) {
        const s = this.scarf;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const tint = StickArt.shade(color, 0.78);
        const stripe = StickArt.shade(color, 1.5);
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 1; i < s.length; i++) {
                const w = 6.5 * (1 - i / s.length) + 2;
                ctx.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.5)' : pass === 1 ? tint : stripe;
                ctx.lineWidth = pass === 0 ? w + 2.2 : pass === 1 ? w : Math.max(0.8, w * 0.3);
                ctx.beginPath(); ctx.moveTo(s[i - 1].x, s[i - 1].y); ctx.lineTo(s[i].x, s[i].y); ctx.stroke();
            }
        }
        ctx.restore();
    },

    drawShield(ctx) {
        const c = this.joints[2];
        const cy = c.y - 8;
        const t = this.clock;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = 44 + Math.sin(t * 0.12) * 1.5;
        const g = ctx.createRadialGradient(c.x, cy, r * 0.55, c.x, cy, r);
        g.addColorStop(0, 'rgba(60,140,255,0)');
        g.addColorStop(0.85, 'rgba(80,170,255,0.22)');
        g.addColorStop(1, 'rgba(160,220,255,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, cy, r, 0, Math.PI * 2); ctx.fill();
        // Rotating highlight arcs
        ctx.strokeStyle = 'rgba(200,235,255,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const a = t * 0.04 + i * 2.1;
            ctx.beginPath(); ctx.arc(c.x, cy, r - 2, a, a + 0.7); ctx.stroke();
        }
        if (this.shieldHit > 0) {
            ctx.strokeStyle = `rgba(220,245,255,${this.shieldHit})`;
            ctx.lineWidth = 4 * this.shieldHit;
            ctx.beginPath(); ctx.arc(c.x, cy, r + (1 - this.shieldHit) * 14, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    },

    drawWings(ctx, J) {
        const n = J[1];
        const flap = Math.sin(this.clock * 0.35);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const side of [-1, 1]) {
            for (let k = 0; k < 5; k++) {
                const a = -Math.PI / 2 + side * (0.5 + k * 0.28 + flap * 0.25);
                const len = 34 - k * 3;
                const x2 = n.x + Math.cos(a) * len * side * side + side * 6;
                const y2 = n.y + Math.sin(a) * len + 8;
                const g = ctx.createLinearGradient(n.x, n.y, x2, y2);
                g.addColorStop(0, 'rgba(255,255,255,0.65)');
                g.addColorStop(1, this.isBird ? 'rgba(255,240,180,0.1)' : 'rgba(120,255,255,0.1)');
                ctx.strokeStyle = g;
                ctx.lineWidth = 5 - k * 0.6;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(n.x + side * 3, n.y + 4);
                ctx.quadraticCurveTo(n.x + side * (len * 0.6), y2 - 10, x2 + Math.cos(a) * 4, y2);
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    // Soft holy glow with slowly turning rays behind the angel
    drawAura(ctx, J) {
        const c = J[1], t = this.clock;
        const pulse = 0.85 + Math.sin(t * 0.07) * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(c.x, c.y + 8, 4, c.x, c.y + 8, 78 * pulse);
        g.addColorStop(0, 'rgba(255,244,200,0.34)');
        g.addColorStop(0.5, 'rgba(255,225,150,0.12)');
        g.addColorStop(1, 'rgba(255,225,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, c.y + 8, 78 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.translate(c.x, c.y + 8);
        ctx.rotate(t * 0.006);
        for (let i = 0; i < 9; i++) {
            ctx.rotate(Math.PI * 2 / 9);
            const rg = ctx.createLinearGradient(0, 0, 0, -92);
            rg.addColorStop(0, 'rgba(255,240,190,0.16)');
            rg.addColorStop(1, 'rgba(255,240,190,0)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(3, -6); ctx.lineTo(9, -92); ctx.lineTo(-9, -92); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },

    // Layered feathered wings: coverts, secondaries and long primaries that sweep with each flap.
    // Drawing ~40 gradient feathers per frame (with a glow) cost ~40 ms and dropped the game to 20 FPS, so
    // each flap phase is drawn once into a sprite and every later frame is one drawImage per wing.
    drawAngelWings(ctx, J) {
        const n = J[1];
        const flap = Math.sin(this.clock * 0.16);                  // slow, majestic beat
        const phase = Math.round((flap + 1) / 2 * (WING_PHASES - 1));
        const spr = wingSprite(phase, !!this.grounded);
        const half = WING_BOX * WING_SCALE, size = half * 2;
        for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(n.x + side * 3, n.y + 5);
            ctx.scale(side / WING_SCALE, 1 / WING_SCALE);
            ctx.drawImage(spr, -half, -half, size, size);
            ctx.restore();
        }
    },

    // Glowing gold halo hovering above the head with orbiting sparkles
    drawHalo(ctx, J) {
        const h = J[0], n = J[1];
        const tilt = Math.atan2(h.x - n.x, n.y - h.y);
        const bob = Math.sin(this.clock * 0.08) * 1.8;
        const t = this.clock * 0.05;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(tilt);
        ctx.translate(0, -SK.headR - 9 + bob);
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
        glow.addColorStop(0, 'rgba(255,230,120,0.35)'); glow.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(150,95,10,0.85)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 4.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 4.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, -0.8, 13, 4.2, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        // sparkles circling the ring
        for (let i = 0; i < 3; i++) {
            const a = t + i * Math.PI * 2 / 3;
            const sx = Math.cos(a) * 13, sy = Math.sin(a) * 4.6, s = 2.6 + Math.sin(t * 3 + i) * 1.1;
            ctx.fillStyle = 'rgba(255,250,210,0.95)';
            ctx.beginPath();
            ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.28, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * 0.28, sy); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(sx - s, sy); ctx.lineTo(sx, sy + s * 0.28); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy - s * 0.28); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },

    drawCloud(ctx, feetY) {
        const cx = this.joints[2].x, cy = feetY + 4 + Math.sin(this.clock * 0.06) * 2;
        ctx.save();
        const puffs = [[0, 0, 15], [-15, 4, 11], [15, 4, 11], [-8, 8, 10], [8, 8, 10]];
        ctx.fillStyle = 'rgba(160,190,220,0.6)';
        for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(cx + x, cy + y + 3, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        for (const [x, y, r] of puffs) { ctx.beginPath(); ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,230,140,0.25)';
        ctx.beginPath(); ctx.ellipse(cx, cy + 6, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    // Gold crown on the head: gems, outline, a shine sweeping across
    drawCrown(ctx, J) {
        const h = J[0], n = J[1];
        const tilt = Math.atan2(h.x - n.x, n.y - h.y);
        const bob = Math.sin(this.clock * 0.08) * 1.2;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(tilt);
        ctx.translate(0, -SK.headR - 9 + bob);
        const path = () => {
            ctx.beginPath();
            ctx.moveTo(-12, 6); ctx.lineTo(-13, -6); ctx.lineTo(-6, 0); ctx.lineTo(0, -10);
            ctx.lineTo(6, 0); ctx.lineTo(13, -6); ctx.lineTo(12, 6); ctx.closePath();
        };
        const g = ctx.createLinearGradient(0, -10, 0, 6);
        g.addColorStop(0, '#fff59d');
        g.addColorStop(0.5, '#ffc107');
        g.addColorStop(1, '#e65100');
        path();
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#6d4c00'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#b71c1c'; ctx.beginPath(); ctx.arc(0, 2, 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1565c0';
        ctx.beginPath(); ctx.arc(-7, 3, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, 3, 1.6, 0, Math.PI * 2); ctx.fill();
        // Shine sweep clipped to the crown
        ctx.save();
        path(); ctx.clip();
        const sx = ((this.clock * 0.6) % 70) - 35;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.moveTo(sx, -12); ctx.lineTo(sx + 5, -12); ctx.lineTo(sx - 1, 8); ctx.lineTo(sx - 6, 8); ctx.fill();
        ctx.restore();
        ctx.restore();
    },

    // Health bar (with a lagging damage trail) and name tag, kept upright
    drawOverhead(ctx, J, crowned) {
        const top = Math.min(J[0].y - SK.headR, J[1].y) - 14 - (crowned ? 17 : 0) - (this.isBird ? 12 : 0);
        const cx = J[2].x;
        const w = this.isBird ? 58 : 44;
        const ratio = Math.max(0, this.health / this.maxHealth);
        const trail = Math.max(ratio, (this.hpTrail === undefined ? this.health : this.hpTrail) / this.maxHealth);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cx - w / 2 - 1.5, top - 1.5, w + 3, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(cx - w / 2, top, w * trail, 4);
        const g = ctx.createLinearGradient(0, top, 0, top + 4);
        const col = ratio > 0.5 ? ['#81c784', '#2e7d32'] : ratio > 0.25 ? ['#ffd54f', '#f57f17'] : ['#ef5350', '#b71c1c'];
        g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
        ctx.fillStyle = g;
        ctx.fillRect(cx - w / 2, top, w * ratio, 4);
        ctx.restore();
    }
});
