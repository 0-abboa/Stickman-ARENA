// Fighter and weapon visuals, reworked.
//  * Bodies are drawn as tapered, rounded limbs (thick thigh to slim shin, chest wider than hips),
//    each with a dark outline, a body colour, and a soft highlight on the lit side; hands are
//    round fists, feet are little shoes that follow the shin. The back limbs sit in shade.
//  * The head gets shading, an eye with a white, a pupil and a glint, brows and a mouth per mood.
//  * Held weapons: smooth swing ribbons in the weapon's own colour with a bright cutting edge,
//    a specular glint that sweeps along blades now and then, gun recoil with a coloured star
//    muzzle flash, and a cast flare at a staff's tip. Melee hits leave a crescent slash mark.
//  * Corpses use the same tapered limbs.
(() => {
    // limb radii [start, end] by bone: 0 neck, 1 torso (neck->hip), 2/3 front upper/fore arm,
    // 4/5 back upper/fore arm, 6/7 front thigh/shin, 8/9 back thigh/shin
    const RAD = [[2, 2], [3.5, 3.0], [2.5, 2.05], [2.05, 1.75], [2.4, 2.0], [2.0, 1.7], [3.0, 2.3], [2.3, 1.8], [2.9, 2.2], [2.2, 1.75]];
    const OUT = 1.25;   // outline thickness

    // A tapered capsule from a (radius ra) to b (radius rb)
    function capsule(ctx, a, b, ra, rb) {
        const dx = b.x - a.x, dy = b.y - a.y, th = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.arc(a.x, a.y, ra, th + Math.PI / 2, th - Math.PI / 2);
        ctx.arc(b.x, b.y, rb, th - Math.PI / 2, th + Math.PI / 2);
        ctx.closePath();
    }
    StickArt.capsule = capsule;
    StickArt.RAD = RAD;

    // Draw one chain of limbs (list of [a, b, bone]) as outline, fill, then highlight
    function chain(ctx, segs, color, flat, light) {
        if (!flat) {
            ctx.fillStyle = 'rgba(8,8,14,0.62)';
            for (const [a, b, k] of segs) { capsule(ctx, a, b, RAD[k][0] + OUT, RAD[k][1] + OUT); ctx.fill(); }
        }
        ctx.fillStyle = color;
        for (const [a, b, k] of segs) { capsule(ctx, a, b, RAD[k][0], RAD[k][1]); ctx.fill(); }
        if (flat) return;
        // soft highlight along the upper-left edge of each limb
        ctx.fillStyle = light;
        for (const [a, b, k] of segs) {
            const ox = -0.75, oy = -0.75;
            capsule(ctx, { x: a.x + ox, y: a.y + oy }, { x: b.x + ox, y: b.y + oy }, RAD[k][0] * 0.42, RAD[k][1] * 0.42);
            ctx.fill();
        }
    }

    function foot(ctx, knee, ft, facing, color, flat) {
        const ang = Math.atan2(ft.y - knee.y, ft.x - knee.x) - Math.PI / 2 * facing;   // the shoe points forward off the shin
        ctx.save();
        ctx.translate(ft.x, ft.y); ctx.rotate(ang);
        if (!flat) { ctx.fillStyle = 'rgba(8,8,14,0.62)'; ctx.beginPath(); ctx.ellipse(facing * 1.6, 0.4, 4.6 + OUT, 2.4 + OUT, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(facing * 1.6, 0.4, 4.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function hand(ctx, h, color, flat) {
        if (!flat) { ctx.fillStyle = 'rgba(8,8,14,0.62)'; ctx.beginPath(); ctx.arc(h.x, h.y, 2.9 + OUT, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(h.x, h.y, 2.9, 0, Math.PI * 2); ctx.fill();
        if (!flat) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(h.x - 0.9, h.y - 0.9, 1.1, 0, Math.PI * 2); ctx.fill(); }
    }

    const shadeCache = new Map();
    const shades = (color) => {
        let s = shadeCache.get(color);
        if (!s) {
            s = { back: StickArt.shade(color, 0.62), light: (() => { const n = parseInt(color.slice(1), 16); return `rgba(${Math.min(255, ((n >> 16) & 255) + 90)},${Math.min(255, ((n >> 8) & 255) + 90)},${Math.min(255, (n & 255) + 90)},0.4)`; })() };
            s.backLight = 'rgba(255,255,255,0.12)';
            shadeCache.set(color, s);
            if (shadeCache.size > 200) shadeCache.clear();
        }
        return s;
    };

    StickArt.figure = function (ctx, J, color, opts) {
        opts = opts || {};
        const flat = !!opts.flat, facing = opts.facing || 1;
        if (color[0] !== '#') color = '#ffffff';
        const S = shades(color);
        const sh = { x: J[2].x + (J[1].x - J[2].x) * 0.88, y: J[2].y + (J[1].y - J[2].y) * 0.88 };
        ctx.save();
        ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
        const backCol = flat ? color : S.back;
        // back arm and leg (in shade)
        chain(ctx, [[J[2], J[9], 8], [J[9], J[10], 9]], backCol, flat, S.backLight);
        foot(ctx, J[9], J[10], facing, backCol, flat);
        chain(ctx, [[sh, J[5], 4], [J[5], J[6], 5]], backCol, flat, S.backLight);
        hand(ctx, J[6], backCol, flat);
        // torso: hips narrower than the chest
        chain(ctx, [[J[2], J[1], 1]], color, flat, S.light);
        // front leg and arm
        chain(ctx, [[J[2], J[7], 6], [J[7], J[8], 7]], color, flat, S.light);
        foot(ctx, J[7], J[8], facing, color, flat);
        chain(ctx, [[sh, J[3], 2], [J[3], J[4], 3]], color, flat, S.light);
        hand(ctx, J[4], color, flat);
        this.head(ctx, J, color, opts);
        ctx.restore();
    };

    StickArt.head = function (ctx, J, color, opts) {
        const h = J[0], n = J[1], r = SK.headR;
        if (opts.flat) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(h.x, h.y, r + 1.4, 0, Math.PI * 2); ctx.fill(); return; }
        // outline, coloured rim, shaded face
        ctx.fillStyle = 'rgba(8,8,14,0.62)'; ctx.beginPath(); ctx.arc(h.x, h.y, r + 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(h.x, h.y, r + 1.1, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(h.x - 3, h.y - 3.5, 1, h.x, h.y, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#eef1f5'); g.addColorStop(1, '#cfd6de');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, r - 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(h.x - 3.2, h.y - 4.2, 2.2, 1.3, -0.6, 0, Math.PI * 2); ctx.fill();
        // face frame: "up" from the neck, "forward" from facing
        const ux = (h.x - n.x) / r, uy = (h.y - n.y) / r, f = opts.facing || 1;
        if (opts.style) StickArt.headgear(ctx, h, ux, uy, f, color, opts.style, opts.t || 0);
        const fx = -uy * f, fy = ux * f;
        const ex = h.x + fx * 3.9 + ux * 1.6, ey = h.y + fy * 3.9 + uy * 1.6;
        const exp = opts.expression || 'normal';
        ctx.lineCap = 'round';
        if (exp === 'ko') {
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1.7;
            for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ex - 2 + s, ey - 2); ctx.lineTo(ex + 2 + s, ey + 2); ctx.moveTo(ex + 2 + s, ey - 2); ctx.lineTo(ex - 2 + s, ey + 2); ctx.stroke(); }
            const mx = h.x + fx * 4 - ux * 3.6, my = h.y + fy * 4 - uy * 3.6;
            ctx.beginPath(); ctx.ellipse(mx, my, 1.6, 1.1, 0, 0, Math.PI * 2); ctx.stroke();
            return;
        }
        if (exp === 'blink') { ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 2.2, ey); ctx.lineTo(ex + 2.2, ey); ctx.stroke(); }
        else {
            // white of the eye, pupil looking ahead, glint
            const er = exp === 'hurt' ? 2.0 : 2.6;
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.15, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            const px = ex + fx * 0.9, py = ey + fy * 0.9;
            ctx.fillStyle = '#121218'; ctx.beginPath(); ctx.arc(px, py, exp === 'hurt' ? 1.0 : 1.45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px - fx * 0.4 + ux * 0.5, py - fy * 0.4 + uy * 0.5, 0.5, 0, Math.PI * 2); ctx.fill();
            // brow
            ctx.strokeStyle = '#121218'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (exp === 'angry') { ctx.moveTo(ex - fx * 2.8 + ux * 4.4, ey - fy * 2.8 + uy * 4.4); ctx.lineTo(ex + fx * 2.4 + ux * 2.6, ey + fy * 2.4 + uy * 2.6); }
            else if (exp === 'hurt') { ctx.moveTo(ex - fx * 2.4 + ux * 3.0, ey - fy * 2.4 + uy * 3.0); ctx.lineTo(ex + fx * 2.4 + ux * 4.2, ey + fy * 2.4 + uy * 4.2); }
            else { ctx.moveTo(ex - fx * 2.2 + ux * 3.9, ey - fy * 2.2 + uy * 3.9); ctx.lineTo(ex + fx * 2.2 + ux * 4.1, ey + fy * 2.2 + uy * 4.1); }
            ctx.stroke();
        }
        // mouth
        const mx = h.x + fx * 4.4 - ux * 3.6, my = h.y + fy * 4.4 - uy * 3.6;
        ctx.strokeStyle = '#121218'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (exp === 'hurt') { ctx.moveTo(mx - 2, my + 0.8); ctx.quadraticCurveTo(mx, my - 1.2, mx + 2, my + 0.8); }
        else if (exp === 'angry') { ctx.moveTo(mx - 2.2, my); ctx.lineTo(mx + 2.2, my - 0.4); }
        else ctx.arc(mx, my - 1, 2, 0.25, Math.PI - 0.25);
        ctx.stroke();
    };

    // ---------- a look per fighter: headgear drawn in the head's own frame ----------
    // local frame: origin at the head centre, -y up out of the skull, +x toward the face
    StickArt.STYLES = ['band', 'spikes', 'cap', 'mohawk', 'tuft', 'bandana', 'crest', 'horns'];
    StickArt.headgear = function (ctx, h, ux, uy, f, color, style, t) {
        const r = SK.headR;
        ctx.save();
        ctx.translate(h.x, h.y); ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2); ctx.scale(f, 1);
        const dark = StickArt.shade(color, 0.55), lite = StickArt.shade(color, 1.35), ink = 'rgba(8,8,14,0.62)';
        const fillOut = (path, fill) => { path(); ctx.lineWidth = 2.2; ctx.strokeStyle = ink; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); };
        switch (style) {
            case 'band': {   // ninja headband with tails that flutter behind
                ctx.lineCap = 'round';
                const w = Math.sin(t * 0.3) * 2;
                for (const [dy, len] of [[-2, 13], [1, 10]]) { ctx.strokeStyle = ink; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(-r + 1, -2); ctx.quadraticCurveTo(-r - len * 0.5, dy + w, -r - len, dy + 3 - w); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke(); }
                ctx.strokeStyle = ink; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.arc(0, 0, r - 0.2, -Math.PI * 0.95, -Math.PI * 0.08); ctx.stroke();
                ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
                ctx.fillStyle = '#cfd8dc'; ctx.fillRect(2, -r * 0.62 - 1.2, 3.6, 2.6);
                break;
            }
            case 'spikes':   // spiky hair
                fillOut(() => { ctx.beginPath(); ctx.moveTo(-r, -1); for (let i = 0; i <= 5; i++) { const a = -Math.PI + i / 5 * Math.PI * 0.95; const rr = i % 2 ? r + 1 : r + 6; ctx.lineTo(Math.cos(a) * rr - 1, Math.sin(a) * rr - 1); } ctx.lineTo(r * 0.6, -r * 0.55); ctx.quadraticCurveTo(0, -r * 0.35, -r, -1); ctx.closePath(); }, dark);
                break;
            case 'cap':   // baseball cap, brim forward
                fillOut(() => { ctx.beginPath(); ctx.arc(0, -1, r + 0.6, Math.PI, 0); ctx.lineTo(r + 7, -1.5); ctx.lineTo(r + 7, 0.6); ctx.lineTo(-r, 0.4); ctx.closePath(); }, color);
                ctx.fillStyle = lite; ctx.beginPath(); ctx.arc(-1, -r * 0.7, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -1, r - 1.5, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
                break;
            case 'mohawk':
                fillOut(() => { ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.6); for (let i = 0; i <= 6; i++) { const x = -r * 0.7 + i * r * 0.23; ctx.lineTo(x, -r - (i % 2 ? 3 : 7) - Math.sin(i) * 1); } ctx.lineTo(r * 0.7, -r * 0.6); ctx.closePath(); }, color);
                break;
            case 'tuft':   // a little curl of hair on top
                ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(-1, -r + 1); ctx.quadraticCurveTo(2, -r - 8, -4, -r - 7); ctx.stroke();
                ctx.strokeStyle = dark; ctx.lineWidth = 2.4; ctx.stroke();
                break;
            case 'bandana':   // bandana over the head, knot behind
                fillOut(() => { ctx.beginPath(); ctx.arc(0, 0, r + 0.8, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(r * 0.55, -r * 0.35); ctx.quadraticCurveTo(0, -r * 0.55, -r, -0.5); ctx.closePath(); }, color);
                ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (const [x, y] of [[-3, -6], [2, -7], [-6, -3]]) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill(); }
                fillOut(() => { ctx.beginPath(); ctx.moveTo(-r, -2); ctx.lineTo(-r - 6, -5 + Math.sin(t * 0.3)); ctx.lineTo(-r - 5, 0); ctx.closePath(); }, color);
                break;
            case 'crest':   // knight's plume
                fillOut(() => { ctx.beginPath(); ctx.moveTo(-2, -r); ctx.bezierCurveTo(-6, -r - 10, -14, -r - 6, -r - 6, -r + 4 + Math.sin(t * 0.2)); ctx.quadraticCurveTo(-8, -r - 2, 2, -r + 1); ctx.closePath(); }, color);
                break;
            case 'horns':
                for (const s of [-1, 1]) fillOut(() => { ctx.beginPath(); ctx.moveTo(s * 3.5 - 1.8, -r + 1); ctx.quadraticCurveTo(s * 7, -r - 4, s * 6, -r - 8); ctx.quadraticCurveTo(s * 4, -r - 3, s * 3.5 + 1.8, -r + 1.5); ctx.closePath(); }, '#f4ecd8');
                break;
        }
        ctx.restore();
    };

    // ---------- scarf: a light cloth ribbon (fighters whose headgear already has tails go without) ----------
    const TAILS = { band: 1, bandana: 1, crest: 1 };
    Player.prototype.drawScarf = function (ctx, color) {
        const style = StickArt.STYLES[this.id % StickArt.STYLES.length];
        if (TAILS[style]) return;
        const s = this.scarf, n = Math.min(s.length, 7);
        if (n < 2) return;
        const col = color[0] === '#' ? color : '#ffffff', S = shades(col);
        // ribbon outline: offset both edges from the rope by a width that tapers
        const left = [], right = [];
        for (let i = 0; i < n; i++) {
            const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = 3.2 * (1 - i / n) + 0.9;
            left.push([s[i].x - dy / d * w, s[i].y + dx / d * w]); right.push([s[i].x + dy / d * w, s[i].y - dx / d * w]);
        }
        ctx.save();
        ctx.beginPath(); left.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,8,14,0.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = StickArt.shade(col, 0.8); ctx.fill();
        ctx.strokeStyle = S.light; ctx.lineWidth = 1;
        for (let i = 1; i < n - 1; i += 2) { ctx.beginPath(); ctx.moveTo(left[i][0], left[i][1]); ctx.lineTo(right[i][0], right[i][1]); ctx.stroke(); }
        ctx.restore();
    };

    // ---------- held weapons ----------
    const glowOf = (def) => {
        const a = def.art;
        if (a && a.laser) return a.laser;
        if (a && a.glow) return a.glow;
        if (def.proj && def.proj.look && def.proj.look.c && def.proj.look.c !== 'rand') return def.proj.look.c;
        return (RARITY[def.rarity] || RARITY.common).glow;
    };

    Player.prototype.drawHeld = function (ctx, J) {
        const type = WeaponDefs.typeOf(this), def = WeaponDefs.of(this);
        const attacking = this.attackAnim < this.attackDur, sw = this.attackAnim / this.attackDur;
        if (!type || type === 'bird_crystal') {
            // fists: a curved smear behind the punching hand
            const h = this.swingAlt ? J[6] : J[4];
            const tr = this.fistTrail || (this.fistTrail = []);
            if (attacking && sw < 0.45) { tr.push({ x: h.x, y: h.y }); if (tr.length > 6) tr.shift(); } else tr.length = 0;
            if (tr.length > 2) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
                for (let i = 1; i < tr.length; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.5 * i / tr.length})`; ctx.lineWidth = 1 + 4 * i / tr.length; ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
                ctx.restore();
            }
            this.swingTrail = null;
            return;
        }
        const handP = J[4], elbow = J[3];
        const fore = Math.atan2(handP.y - elbow.y, handP.x - elbow.x);
        const ang = fore + (HOLD_ANGLE[def.hold] || 0) * this.facing;
        const span = WEAPON_ART_SPAN[type] || [-20, 20];
        const rgb = glowOf(def);
        // ---- swing ribbon (melee) ----
        const tipLen = def.kind === 'melee' ? (TIP_LEN[type] || span[1]) : 0;
        if (tipLen && attacking && sw < 0.62) {
            const tr = this.swingTrail || (this.swingTrail = []);
            const base = def.hold === 'heavy' ? 0.55 : def.hold === 'fist' ? 0.2 : 0.3;
            tr.push({ tx: handP.x + Math.cos(ang) * tipLen, ty: handP.y + Math.sin(ang) * tipLen, bx: handP.x + Math.cos(ang) * tipLen * base, by: handP.y + Math.sin(ang) * tipLen * base });
            if (tr.length > 9) tr.shift();
            if (tr.length > 1) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (let i = 1; i < tr.length; i++) {
                    const a = tr[i - 1], b = tr[i], k = i / tr.length;
                    const g = ctx.createLinearGradient((a.bx + b.bx) / 2, (a.by + b.by) / 2, (a.tx + b.tx) / 2, (a.ty + b.ty) / 2);
                    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.7, `rgba(${rgb},${0.38 * k})`); g.addColorStop(1, `rgba(255,255,255,${0.6 * k})`);
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.moveTo(a.bx, a.by); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b.bx, b.by); ctx.closePath(); ctx.fill();
                }
                // the cutting edge
                ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = def.heavy ? 2.6 : 1.6; ctx.lineCap = 'round';
                ctx.beginPath(); tr.forEach((q, i) => i ? ctx.lineTo(q.tx, q.ty) : ctx.moveTo(q.tx, q.ty)); ctx.stroke();
                ctx.restore();
            }
        } else this.swingTrail = null;

        // ---- the weapon ----
        const recoil = def.kind === 'shot' && def.hold === 'gun' ? Math.max(0, 1 - this.attackAnim / 5) * (2 + (def.recoil || 1) * 1.4) : 0;
        ctx.save();
        ctx.translate(handP.x, handP.y);
        ctx.rotate(ang);
        ctx.scale(1, this.facing);
        ctx.translate(-recoil, 0);
        const ready = this.attackCooldown <= 0;
        WeaponArt.draw(ctx, type, { t: this.clock, pull: this.pose ? this.pose.pull : 1, loaded: type === 'bow' ? this.pose && this.pose.pull > 0.25 : ready, glow: ready ? 1 : 0.3 });
        // a specular glint that travels along blades and heads every couple of seconds
        if (def.kind === 'melee' && def.hold !== 'fist') {
            const ph = ((this.clock + this.id * 41) % 150) / 150;
            if (ph < 0.22) {
                const x = span[0] + (span[1] - span[0]) * (ph / 0.22);
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(x, 0, 0, x, 0, 9);
                g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g; ctx.fillRect(x - 9, -9, 18, 18);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        ctx.restore();

        // ---- muzzle flash / cast flare ----
        if (def.kind === 'shot' && this.attackAnim < 4) {
            const reach = def.hold === 'staff' ? span[1] : span[1] - recoil;
            const mx = handP.x + Math.cos(ang) * reach, my = handP.y + Math.sin(ang) * reach;
            const k = 1 - this.attackAnim / 4, frgb = def.hold === 'gun' && !(def.art && def.art.glow) ? '255,214,120' : rgb;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.translate(mx, my); ctx.rotate(ang + (this.flashSpin = (this.flashSpin || 0) + 1.3));
            const R = (def.hold === 'staff' ? 16 : 13) * (0.6 + k * 0.6) * (def.pellets > 2 ? 1.3 : 1);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            g.addColorStop(0, `rgba(255,255,255,${k})`); g.addColorStop(0.35, `rgba(${frgb},${0.85 * k})`); g.addColorStop(1, `rgba(${frgb},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255,255,240,${0.9 * k})`;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? R * 0.25 : R * (i % 4 ? 0.9 : 1.6); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath(); ctx.fill();
            if (def.hold === 'staff') { ctx.strokeStyle = `rgba(${rgb},${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.stroke(); }
            ctx.restore();
        }
    };

    // ---------- crescent slash marks where melee hits land ----------
    FX.drawers.slash = function (ctx, p, t) {
        const age = 1 - t, len = p.len * (0.5 + 0.5 * Math.min(1, age * 4));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, t * 1.8);
        const g = ctx.createLinearGradient(-len, 0, len, 0);
        g.addColorStop(0, `rgba(${p.color},0)`); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, `rgba(${p.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(0, -p.w * 2.2, len, 0); ctx.quadraticCurveTo(0, -p.w * 0.6, -len, 0); ctx.fill();
        if (p.cross) { ctx.rotate(1.2); ctx.beginPath(); ctx.moveTo(-len * 0.8, 0); ctx.quadraticCurveTo(0, -p.w * 1.6, len * 0.8, 0); ctx.quadraticCurveTo(0, -p.w * 0.4, -len * 0.8, 0); ctx.fill(); }
        ctx.restore();
    };
    const dmgBase = Game.prototype.onDamage;
    Game.prototype.onDamage = function (p, amount, attacker, shielded, killed) {
        dmgBase.call(this, p, amount, attacker, shielded, killed);
        if (!attacker || attacker === p || amount < 2 || amount >= 1000 || attacker.isBird) return;
        const def = WeaponDefs.of(attacker);
        if (def.kind !== 'melee' || Math.abs(attacker.x - p.x) > 220) return;
        const cx = p.x + p.width / 2, cy = p.y + p.height * 0.38;
        const dir = Math.sign(cx - (attacker.x + attacker.width / 2)) || 1;
        const heavy = def.heavy || amount >= 20;
        this.fx.add({ type: 'slash', x: cx, y: cy, rot: (attacker.swingAlt ? -0.5 : 0.5) * dir + (Math.random() - 0.5) * 0.4, len: heavy ? 30 : 20, w: heavy ? 6 : 4, life: heavy ? 14 : 10, color: glowOf(def), cross: def === PUNCH ? false : amount >= 25 });
    };

    // ---------- corpses: the same tapered limbs ----------
    const deathDraw = DeathAnim.draw;
    DeathAnim.draw = function (ctx, c, alpha) {
        const a = c.anim;
        if (!a || a.hidden || a.xray) return deathDraw.call(this, ctx, c, alpha);
        // Draw the limbs ourselves, then let the original pass draw everything else with the body hidden
        const A = alpha * a.alpha;
        if (A > 0.01 && !a.split && a.clipTop === undefined && a.clipBottom === undefined && !a.xf) {
            const col = c.color[0] === '#' ? c.color : '#ffffff';
            ctx.save(); ctx.globalAlpha = A;
            const segs = this.segments(c);
            ctx.fillStyle = 'rgba(8,8,14,0.6)';
            for (const sgm of segs) { const r = RAD[sgm.k]; capsule(ctx, sgm.p0, sgm.p1, r[0] + OUT, r[1] + OUT); ctx.fill(); }
            for (const sgm of segs) {
                let color = a.tint ? a.tint(sgm.k, col, c) : col;
                if (sgm.back && !a.tint) color = StickArt.shade(col, 0.62);
                ctx.fillStyle = color; const r = RAD[sgm.k]; capsule(ctx, sgm.p0, sgm.p1, r[0], r[1]); ctx.fill();
            }
            ctx.restore();
            const keep = { hidden: a.hidden, hideHead: a.hideHead };
            a.hidden = true;
            deathDraw.call(this, ctx, c, alpha);   // props, overlays...
            a.hidden = keep.hidden;
            // the head on top
            if (!a.hideHead) {
                ctx.save(); ctx.globalAlpha = A;
                StickArt.head(ctx, c.rag.pts, a.tint ? a.tint(0, col, c) : col, { expression: a.expression, facing: c.facing });
                ctx.restore();
            }
            return;
        }
        deathDraw.call(this, ctx, c, alpha);
    };
})();
