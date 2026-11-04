// Status effects and the extra weapon mechanics (weapon-defs-2.js): burn, poison, slow,
// freeze, stun, life drain, chain lightning, ground slams, shield breaks, cluster splits,
// mines and vortices, plus the trails and impacts of the projectile looks.
//
// A status lives on the body as frames left: p.status = { burn, poison, slow, freeze, stun }.
// Damage over time is credited to whoever applied it (p.statusSrc) and the weapon (statusType),
// so a burn that finishes someone still plays that weapon's death animation.
const STATUS_RGB = { burn: '255,130,40', poison: '140,255,70', slow: '170,200,255', freeze: '170,230,255', trap: '235,225,195', stun: '255,240,120', drain: '190,110,255', chain: '150,220,255' };

Object.assign(Game.prototype, {
    applyStatus(p, st, att, wtype, dealt) {
        if (!st || p.isDead) return;
        const s = p.status || (p.status = {});
        // The angel shrugs most of it off; an automatic angel-era shield halves it
        const k = p.isBird ? 0.3 : p.shieldActive ? 0.5 : 1;
        for (const key of ['burn', 'poison', 'slow', 'freeze', 'stun', 'trap']) {
            if (!st[key]) continue;
            const v = Math.round(st[key] * k);
            if (v > (s[key] || 0)) s[key] = v;
            if (key === 'freeze' && v > 0) this.fx.shards(p.x, p.y + 10, p.width, p.height - 20, 'rgba(200,240,255,0.9)', 6);
            if (key === 'stun' && v > 0) this.fx.ring(p.x + p.width / 2, p.y - 6, STATUS_RGB.stun, 22, 2, 14);
            if (key === 'trap' && v > 0) { this.fx.ring(p.x + p.width / 2, p.y + 30, STATUS_RGB.trap, 34, 2, 14); this.fx.sparks(p.x + p.width / 2, p.y + 30, STATUS_RGB.trap, 8, undefined, 0, 2); }
        }
        if (st.burn || st.poison) { p.statusSrc = att; p.statusType = wtype; }
        if (st.drain && att && !att.isDead && dealt > 0) {
            const heal = Math.min(att.maxHealth - att.health, dealt * st.drain);
            if (heal > 0) {
                att.health += heal;
                const ax = att.x + att.width / 2, ay = att.y + 26;
                this.fx.streak(p.x + p.width / 2, p.y + 26, ax, ay, 3, STATUS_RGB.drain, 14);
                this.fx.text(ax, att.y - 30, '+' + Math.round(heal), '#b388ff', 13);
                this.fx.sparks(ax, ay, STATUS_RGB.drain, 6, undefined, 0, 3);
            }
        }
        if (st.chain && att) this.chainZap(p, st.chain, att, wtype);
    },

    // Lightning jumps from the target to the next enemies nearby
    chainZap(from, ch, att, wtype) {
        const done = new Set([from, att]);
        let cur = from;
        for (let i = 0; i < ch.n; i++) {
            let best = null, bd = ch.r;
            for (const t of this.players) {
                if (done.has(t) || t.isDead || t.team === att.team) continue;
                const d = Math.hypot(t.x - cur.x, t.y - cur.y);
                if (d < bd) { bd = d; best = t; }
            }
            if (!best) break;
            done.add(best);
            const x1 = cur.x + cur.width / 2, y1 = cur.y + 26, x2 = best.x + best.width / 2, y2 = best.y + 26;
            for (let k = 0; k < 3; k++) this.fx.add({ type: 'zap', x: x1, y: y1, x2, y2, color: STATUS_RGB.chain, life: 8 + k * 2 });
            this.fx.flashAt(x2, y2, STATUS_RGB.chain, 26, 6);
            best.lastHitType = wtype; best.lastHitAt = this.frameCount;
            best.takeDamage(ch.dmg, att);
            best.velocity.y = Math.min(best.velocity.y, -2);
            cur = best;
        }
    },

    breakShield(p) {
        p.shieldActive = false; p.shieldTime = 0; p.shieldCd = Player.SHIELD_CD; p.shieldLatch = true;
        const cx = p.x + p.width / 2, cy = p.y + 22;
        this.fx.shards(cx - 20, cy - 20, 40, 40, 'rgba(170,220,255,0.95)', 14);
        this.fx.ring(cx, cy, '170,220,255', 44, 3, 12);
        this.fx.text(cx, p.y - 30, 'BREAK', '#90caf9', 14);
    },

    // A grounded heavy swing shakes the floor around where it lands
    slam(att, def, range) {
        const sl = def.slam, gx = att.x + att.width / 2 + att.facing * range * 0.7, gy = att.y + att.height;
        this.fx.ring(gx, gy, sl.k < 0 ? '190,140,255' : '255,240,210', sl.r, 4, 16);
        this.fx.cracks(gx, gy, sl.r * 0.7, 70, 7, true);
        this.fx.dust(gx, gy, 14, sl.r * 0.6, DUST_TINT[this.level.material]);
        if (sl.k < 0) this.fx.vortex(gx, gy - 20, sl.r);
        for (const t of this.players) {
            if (t === att || t.isDead || t.team === att.team || !t.grounded) continue;
            const dx = t.x + t.width / 2 - gx;
            if (Math.abs(dx) > sl.r || Math.abs(t.y + t.height - gy) > 40) continue;
            const type = att.weapon ? att.weapon.type : null;
            t.lastHitType = type; t.lastHitAt = this.frameCount;
            t.takeDamage(sl.d, att);
            t.velocity.x = Math.sign(dx || 1) * sl.k;
            t.velocity.y = -7;
            if (def.status) this.applyStatus(t, def.status, att, type, sl.d);
        }
    },

    // Cluster shells and molotovs burst into child shots when they end
    splitShot(pr) {
        const sp = pr.spec.split;
        if (!sp || pr.didSplit) return;
        pr.didSplit = true;
        for (let i = 0; i < sp.n; i++) {
            const a = -Math.PI / 2 + (i / Math.max(1, sp.n - 1) - 0.5) * sp.spread + (Math.random() - 0.5) * 0.2;
            const v = sp.spec.speed * (0.7 + Math.random() * 0.5);
            const c = new Projectile(pr.x, pr.y - 4, Math.cos(a) * v + pr.vx * 0.2, Math.sin(a) * v, sp.spec, pr.owner);
            c.wtype = pr.wtype;
            this.projectiles.push(c);
        }
        this.fx.flashAt(pr.x, pr.y, '255,220,160', 30, 6);
    },

    // A coloured pulse for blasts that carry a status (frost bombs, poison clouds...)
    statusBurst(x, y, r, st) {
        const key = ['freeze', 'poison', 'burn', 'stun', 'trap', 'slow'].find(k => st[k]);
        if (!key) return;
        const rgb = STATUS_RGB[key];
        this.fx.shock(x, y, r, rgb, 22, 6, 14);
        this.fx.cloud(x, y, 10, r * 0.6, rgb, 12, 50, 0.3);
        if (key === 'freeze') this.fx.shards(x - r / 2, y - r / 2, r, r, 'rgba(210,240,255,0.95)', 18);
        if (key === 'stun') { this.fx.screenFlash('255,255,240', 0.6); this.fx.flashAt(x, y, '255,255,255', r, 10); }
    },

    // ---------- projectile looks: trails and impacts ----------
    lookTrail(pr) {
        const L = pr.spec.look, fx = this.fx, c = L.c === 'rand' ? (pr.paint || '255,255,255') : L.c;
        if (pr.stuck) return;
        switch (L.s) {
            case 'fire': if (pr.age % 2 === 0) fx.embers(pr.x, pr.y, 1, 2); if (pr.age % 3 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 22, color: '90,70,60', size: 3, grow: 0.2, alpha: 0.35 }); break;
            case 'void': if (pr.age % 2 === 0) fx.swirl(pr.x, pr.y, { shape: 'dot', color: c, rise: 0, spin: 5, r0: 26, r1: 2, size: 2, life: 22 }); break;
            case 'orb': if (pr.age % 3 === 0) fx.sparks(pr.x, pr.y, c, 1, undefined, 0, 1.5); break;
            case 'zap': if (pr.age % 2 === 0) fx.sparks(pr.x, pr.y, c, 2, undefined, 0, 3); break;
            case 'glitch': if (pr.age % 2 === 0) fx.add({ type: 'chunk', x: pr.x + (Math.random() - 0.5) * 10, y: pr.y + (Math.random() - 0.5) * 10, vx: 0, vy: 0, life: 12, color: Math.random() < 0.5 ? `rgb(${c})` : `rgb(${L.c2})`, size: 2.5, rot: 0, vr: 0 }); break;
            case 'star': if (pr.age % 4 === 0) fx.star(pr.x, pr.y, c); break;
            case 'snow': if (pr.age % 3 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 18, color: '255,255,255', size: 2, grow: 0.1, alpha: 0.5 }); break;
            case 'blob': if (pr.age % 4 === 0) fx.add({ type: 'drop', x: pr.x, y: pr.y, vx: pr.vx * 0.1, vy: 1, life: 30, color: `rgba(${c},0.9)`, size: 1.6, gravity: 0.3 }); break;
            case 'water': if (pr.age % 2 === 0) fx.add({ type: 'drop', x: pr.x, y: pr.y, vx: pr.vx * 0.2, vy: 0.5, life: 24, color: `rgba(${c},0.8)`, size: 1.4, gravity: 0.3 }); break;
            case 'note': if (pr.age % 6 === 0) fx.sparks(pr.x, pr.y, c, 1, undefined, 0, 1); break;
            case 'skull': if (pr.age % 2 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 20, color: c, size: 3, grow: 0.15, alpha: 0.3 }); break;
            case 'arrow': if (L.fire && pr.age % 2 === 0) fx.embers(pr.x, pr.y, 1, 1); else if (L.ice && pr.age % 3 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 16, color: '220,245,255', size: 2, grow: 0.1, alpha: 0.5 }); break;
            case 'rocket': fx.smoke(pr.x - pr.vx, pr.y - pr.vy, 1, 3); break;
            case 'shell': case 'flask': case 'dynamite': if (pr.age % 3 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 16, color: '170,170,170', size: 2, grow: 0.1, alpha: 0.3 }); break;
            case 'rail': case 'beam': if (pr.age % 2 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 14, color: c, size: 2, grow: 0.08, alpha: 0.35 }); break;
        }
    },

    lookImpact(pr, p) {
        const L = pr.spec.look, c = L.c === 'rand' ? (pr.paint || '255,255,255') : L.c, fx = this.fx;
        const x = p.x + p.width / 2, y = Math.max(p.y + 6, Math.min(p.y + p.height - 6, pr.y));
        fx.flashAt(x, y, c, 18 + pr.size, 6);
        switch (L.s) {
            case 'paint': fx.drops(x, y, `rgb(${c})`, 10, pr.direction); p.paint = c; p.paintT = 200; break;
            case 'bubble': fx.ring(x, y, c, 18, 2, 10); break;
            case 'shard': case 'snow': fx.shards(x - 8, y - 8, 16, 16, 'rgba(220,245,255,0.95)', 6); break;
            case 'coin': fx.sparks(x, y, '255,215,64', 6, undefined, 0, 4); break;
            case 'glitch': for (let i = 0; i < 6; i++) fx.add({ type: 'chunk', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 20, color: i % 2 ? `rgb(${c})` : `rgb(${L.c2})`, size: 3, rot: 0, vr: 0 }); break;
            case 'ring': case 'gust': fx.ring(x, y, c, 40, 3, 12); break;
            default: fx.sparks(x, y, c, 6, pr.direction > 0 ? Math.PI : 0, 1.6, 4);
        }
    },

    // ---------- every frame, per fighter ----------
    statusTick(p) {
        const s = p.status;
        if (p.paintT > 0) p.paintT--;
        if (!s || p.isDead) { p.speedMul = 1; return; }
        const fx = this.fx, cx = p.x + p.width / 2;
        const hurt = (amount, rgb) => {
            p.lastHitType = p.statusType; p.lastHitAt = this.frameCount;
            p.takeDamage(amount, p.statusSrc && !p.statusSrc.isDead ? p.statusSrc : p.statusSrc || null);
        };
        if (s.burn > 0) {
            s.burn--;
            if (s.burn % 8 === 0) hurt(1.6);
            if (s.burn % 3 === 0) fx.flame(cx + (Math.random() - 0.5) * 16, p.y + 20 + Math.random() * 30, 8 + Math.random() * 6, 26, 22);
        }
        if (s.poison > 0) {
            s.poison--;
            if (s.poison % 12 === 0) hurt(1.2);
            if (s.poison % 6 === 0) fx.add({ type: 'puff', x: cx + (Math.random() - 0.5) * 18, y: p.y + 10 + Math.random() * 30, vx: 0, vy: -0.6, life: 30, color: STATUS_RGB.poison, size: 2.5, grow: 0.12, alpha: 0.6 });
        }
        if (s.freeze > 0) { s.freeze--; if (s.freeze % 10 === 0) fx.add({ type: 'puff', x: cx + (Math.random() - 0.5) * 20, y: p.y + Math.random() * 50, vx: 0, vy: 0.3, life: 26, color: '230,248,255', size: 2, grow: 0.08, alpha: 0.7 }); }
        if (s.slow > 0) s.slow--;
        if (s.stun > 0) s.stun--;
        if (s.trap > 0) s.trap = Math.max(0, s.trap - 1);
        p.speedMul = s.freeze > 0 ? 0.25 : s.slow > 0 ? 0.55 : 1;
        if (!(s.burn > 0 || s.poison > 0 || s.freeze > 0 || s.slow > 0 || s.stun > 0 || s.trap > 0)) { p.status = null; p.speedMul = 1; }
    }
});

Object.assign(FX.prototype, {
    // A swirling dark well: motes spiral inward to the centre
    vortex(x, y, r) {
        this.add({ type: 'flash', x, y, life: 14, color: '120,60,220', size: r * 0.6 });
        for (let i = 0; i < 18; i++) this.swirl(x, y, { shape: i % 3 ? 'dot' : 'star', color: i % 2 ? '170,110,255' : '90,40,180', rise: 0, spin: 6 + Math.random() * 3, r0: r * (0.8 + Math.random() * 0.4), r1: 2, size: 2.5 + Math.random() * 2, life: 26 + Math.random() * 14 });
        this.shock(x, y, r * 0.9, '150,90,255', 18, 4, 10);
    }
});
