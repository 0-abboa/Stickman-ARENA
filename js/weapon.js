// A weapon pickup. Falling and resting follow the original rules exactly (the
// bot predicts them); the bobbing, aura and loot beam are purely visual.
const WEAPON_ART_SPAN = {
    sword: [-13, 47], katana: [-13, 50], spear: [-30, 62], hammer: [-12, 53], shooter: [-6, 20],
    smg: [-16, 26], shotgun: [-22, 34], sniper: [-24, 46], bow: [-12, 28], grenade: [-10, 28],
    rocket: [-22, 35], dagger: [-12, 46], boomerang: [-6, 20], magic_stick: [-31, 31], bird_crystal: [-12, 12],
    axe: [-12, 52], scythe: [-30, 58], bat: [-8, 46], rapier: [-12, 58], gauntlet: [-8, 16], revolver: [-6, 26],
    minigun: [-14, 40], crossbow: [-14, 30], kunai: [-6, 24], flamethrower: [-18, 38], plasma: [-14, 36],
    bomb: [-10, 10], seeker: [-20, 36]
};

class Weapon {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.prevY = y;
        this.width = 30;
        this.height = 30;
        this.type = type;
        this.def = WEAPONS[type] || WEAPONS.sword;
        this.durability = this.def.durability;
        this.active = true;
        this.owner = null;
        this.anim = Math.random() * 100;
        this.landed = false;
        this.landFlash = 0;
        this.lock = 0;   // frames before anyone can pick it up (the crystal starts sealed)
    }

    // The area that picks the item up. It follows what is drawn: long weapons
    // can be grabbed by the blade, short ones aren't over-generous, and a
    // landed item (which bobs above its resting spot) is grabbed where it floats.
    static pickBox(type, x, y, landed) {
        const span = WEAPON_ART_SPAN[type] || [-20, 20];
        const len = span[1] - span[0];
        const drawn = len * Math.min(1.1, 50 / len);
        const w = Math.max(24, Math.min(56, drawn * 0.9));
        const h = type === 'bow' ? 40 : 24;
        const cx = x + 15, cy = y + 15 - (landed ? 8 : 0);
        return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    }

    box() { return Weapon.pickBox(this.type, this.x, this.y, this.landed); }

    update(level) {
        if (!this.active) return;
        this.prevY = this.y;
        if (this.owner) return;
        if (this.lock > 0) this.lock--;
        // Slow fall for the crystal, fast drop for everything else
        const gravity = this.type === 'bird_crystal' ? 0.5 : 5;
        const before = this.y;
        this.y += gravity;
        if (level) {
            for (const platform of level.platforms) {
                if (platform.active === false) continue;   // a ledge that is gone holds nothing up: the item falls
                if (this.x < platform.x + platform.width &&
                    this.x + this.width > platform.x &&
                    this.y + this.height > platform.y &&
                    this.y < platform.y + platform.height) {
                    this.y = platform.y - this.height;
                }
            }
            // Fell into a pit: gone, like anything else that leaves the arena
            if (this.y > level.height + 60) { this.active = false; return; }
        }
        const resting = Math.abs(this.y - before) < 0.01;
        if (resting && !this.landed) this.landFlash = 1;
        this.landed = resting;
    }

    animate(dt) {
        this.anim += dt;
        if (this.landFlash > 0) this.landFlash = Math.max(0, this.landFlash - 0.04 * dt);
    }

    // players: used to show the name tag when someone is close
    draw(ctx, alpha, players) {
        if (!this.active || this.owner) return;
        const y = this.prevY + (this.y - this.prevY) * alpha;
        const cx = this.x + this.width / 2;
        const ground = y + this.height;
        const rar = this.def.glow ? { glow: this.def.glow } : (RARITY[this.def.rarity] || RARITY.common);
        const gm = this.def.glowMul || 1;   // the Tear of God shines three times as bright and far
        const bob = this.landed ? Math.sin(this.anim * 0.07) * 4 - 8 : 0;
        const cy = y + this.height / 2 + bob;
        ctx.save();

        if (this.landed) {
            // Loot beam rising from the floor
            ctx.globalCompositeOperation = 'lighter';
            const bh = 120 * gm, bw = 9 * gm;
            const beam = ctx.createLinearGradient(0, ground - bh, 0, ground);
            beam.addColorStop(0, `rgba(${rar.glow},0)`);
            beam.addColorStop(1, `rgba(${rar.glow},${0.28 * (1 + (gm - 1) * 0.12)})`);
            ctx.fillStyle = beam;
            if (gm > 1) {   // a wide column with soft edges rather than a hard white bar
                const hb = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0); hb.addColorStop(0, `rgba(${rar.glow},0)`); hb.addColorStop(0.5, `rgba(${rar.glow},0.11)`); hb.addColorStop(1, `rgba(${rar.glow},0)`);
                ctx.fillStyle = hb; ctx.fillRect(cx - bw, ground - bh, bw * 2, bh);
                ctx.fillStyle = beam; ctx.globalAlpha = 0.25; ctx.fillRect(cx - 6, ground - bh, 12, bh); ctx.globalAlpha = 1;
            } else ctx.fillRect(cx - bw, ground - bh, bw * 2, bh);
            // Ground glow ring
            ctx.strokeStyle = `rgba(${rar.glow},${Math.min(1, (0.35 + 0.2 * Math.sin(this.anim * 0.1)) * (gm > 1 ? 1.6 : 1))})`;
            ctx.lineWidth = gm > 1 ? 2.5 : 2;
            ctx.beginPath(); ctx.ellipse(cx, ground - 1, 20 * gm, 5 * gm, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }

        // Soft aura behind the item
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.55 + 0.2 * Math.sin(this.anim * 0.09);
        const ar = 34 * gm, aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, ar);
        aura.addColorStop(0, `rgba(${rar.glow},${Math.min(0.24, 0.45 * pulse * (1 + (gm - 1) * 0.15))})`);
        if (gm > 1) aura.addColorStop(0.5, `rgba(${rar.glow},${0.3 * pulse})`);
        aura.addColorStop(1, `rgba(${rar.glow},0)`);
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(cx, cy, ar, 0, Math.PI * 2); ctx.fill();
        if (gm > 1) {   // a second, wider halo and slow rays
            const ar2 = ar * 1.9, a2 = ctx.createRadialGradient(cx, cy, ar * 0.4, cx, cy, ar2);
            a2.addColorStop(0, `rgba(${rar.glow},${0.11 * pulse})`); a2.addColorStop(1, `rgba(${rar.glow},0)`);
            ctx.fillStyle = a2; ctx.beginPath(); ctx.arc(cx, cy, ar2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(${rar.glow},${0.14 * pulse})`; ctx.lineWidth = 1.5;
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + this.anim * 0.01; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * ar * 0.5, cy + Math.sin(a) * ar * 0.5); ctx.lineTo(cx + Math.cos(a) * ar * 1.6, cy + Math.sin(a) * ar * 1.6); ctx.stroke(); }
        }
        if (this.landFlash > 0) {
            ctx.strokeStyle = `rgba(${rar.glow},${this.landFlash})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, ground - 4, 10 + (1 - this.landFlash) * 40, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';

        // Sealed crystal: a shrinking ring shows when it can be taken
        if (this.lock > 0) {
            const k = this.lock / 300;
            ctx.strokeStyle = `rgba(255,200,255,${0.4 + 0.4 * Math.sin(this.anim * 0.2)})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        }
        if (this.lock > 0) ctx.globalAlpha = 0.6;

        // The weapon itself, scaled to fit and gently rocking
        const span = WEAPON_ART_SPAN[this.type] || [-20, 20];
        const len = span[1] - span[0];
        const s = Math.min(1.1, 50 / len) * (gm > 1 ? 1.75 : 1);
        ctx.translate(cx, cy);
        ctx.rotate(this.type === 'bow' ? 0 : -0.35 + Math.sin(this.anim * 0.05) * 0.12);
        ctx.scale(s, s);
        ctx.translate(-(span[0] + span[1]) / 2, 0);
        WeaponArt.draw(ctx, this.type, { t: this.anim, glow: 1 });
        ctx.restore();
    }
}
