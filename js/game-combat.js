// Combat: every attack goes through the weapon table (weapon-defs.js), so new
// weapons work without new code paths. Damage feedback (numbers, sparks,
// hit-stop, shake, ragdoll flinch, KO) is centralised in onDamage/onKO.

// Damage at or above this shakes the screen; everything lighter just flashes and flinches
const HEAVY_HIT = 35;
const DUST_TINT = { dirt: '170,140,110', stone: '185,185,195', ice: '230,245,255', cloud: '255,255,255', magic: '210,170,255' };

Object.assign(Game.prototype, {
    punch(p) {
        this.meleeAttack(p, PUNCH);
        // Punches shatter ice in front of your chest
        if (this.level.material === 'ice') {
            const b = this.level.breakPlatform(p.x + (p.facing * 40), p.y + 20);
            if (b) {
                this.fx.shards(b.x, b.y, b.width, b.height, 'rgba(210,235,255,0.95)', 26);
                this.fx.ring(b.x + b.width / 2, b.y + b.height / 2, '200,235,255', 50, 3, 16);
                AudioSys.playHit();
            }
        }
    },

    useWeapon(p) {
        const def = WEAPONS[p.weapon.type];
        if (!def) return;
        let used = true;
        if (def.kind === 'melee') this.meleeAttack(p, def);
        else if (def.kind === 'shot') used = this.fireShot(p, def);
        else if (def.kind === 'beam') this.fireBeam(p, def);
        if (used && isFinite(p.weapon.durability)) p.weapon.durability--;
    },

    meleeAttack(att, def) {
        const range = WeaponDefs.reach(def);
        // Lunging weapons carry the attacker forward with the swing
        if (def.dash) { att.velocity.x = att.facing * def.dash * 1.6; this.fx.streak(att.x + att.width / 2 - att.facing * 10, att.y + 30, att.x + att.width / 2 - att.facing * 60, att.y + 30, 3, '255,255,255', 10); }
        const boxes = [{ x: att.facing === 1 ? att.x + att.width : att.x - range, y: att.y, width: range, height: att.height, dir: att.facing }];
        if (def.both) boxes.push({ x: att.facing === 1 ? att.x - range : att.x + att.width, y: att.y, width: range, height: att.height, dir: -att.facing });
        if (def === PUNCH) AudioSys.playAttack(); else AudioSys.playSwing(!!def.heavy);
        const type = att.weapon && def !== PUNCH ? att.weapon.type : null;
        const hitOnce = new Set();
        for (const box of boxes) for (const p of this.players) {
            if (p === att || p.isDead || p.team === att.team || hitOnce.has(p) || !p.intersectsRect(box)) continue;   // no friendly fire
            hitOnce.add(p);
            if (def.shieldBreak && p.shieldActive && !p.autoShield) this.breakShield(p);
            p.lastHitType = type; p.lastHitAt = this.frameCount;
            p.takeDamage(def.damage, att);
            // Hooks and whips drag the target in; everything else knocks it away
            const dir = def.pull ? -box.dir : box.dir;
            p.velocity.x = dir * Math.abs(def.knock);
            p.velocity.y = def.lift;
            if (def.status) this.applyStatus(p, def.status, att, type, def.damage);
            AudioSys.playHit();
        }
        if (def.slam && att.grounded) this.slam(att, def, range);
        if (def.heavy && att.grounded) {
            const gx = att.x + att.width / 2 + att.facing * (range * 0.7), gy = att.y + att.height;
            this.fx.dust(gx, gy, 12, 40, DUST_TINT[this.level.material]);
            this.fx.ring(gx, gy, '255,255,255', 46, 3, 14);
            this.fx.debris(gx, gy, '#6d4c41', 6, 5);
        }
    },

    fireShot(p, def) {
        const spec = def.proj;
        if (def.oneAtATime && this.projectiles.some(q => q.active && q.owner === p && q.spec === spec)) return false;
        const m = WeaponDefs.muzzle(p, def);
        const n = def.pellets || 1;
        for (let i = 0; i < n; i++) {
            let a = 0;
            if (n > 1) a = (i / (n - 1) - 0.5) * def.spread + (Math.random() - 0.5) * 0.04;
            else if (def.spread) a = (Math.random() - 0.5) * def.spread;
            const vx = Math.cos(a) * spec.speed * p.facing;
            const vy = Math.sin(a) * spec.speed + (spec.lift || 0);
            const pr = new Projectile(m.x, m.y, vx, vy, spec, p);
            pr.wtype = p.weapon ? p.weapon.type : null;
            if (spec.homing) pr.target = this.seekTarget(p);
            this.projectiles.push(pr);
        }
        if (def.recoil) p.velocity.x -= p.facing * def.recoil;
        AudioSys.playGun(spec.type);
        // Muzzle smoke and an ejected casing for firearms
        if (def.hold === 'gun') {
            this.fx.smoke(m.x, m.y, spec.type === 'rocket' ? 6 : 2, spec.type === 'rocket' ? 7 : 3);
            if (spec.type === 'bullet' || spec.type === 'pellet' || spec.type === 'sniper') {
                this.fx.add({ type: 'chunk', x: m.x - p.facing * 14, y: m.y, vx: -p.facing * (1 + Math.random() * 2), vy: -3 - Math.random() * 2,
                              life: 40, color: '#ffca28', size: 2.5, gravity: 0.35, rot: 0, vr: 0.4, drag: 0.99 });
            }
        }
        if (spec.type === 'shockwave') this.fx.sparks(m.x, m.y, '120,240,255', 8, p.facing > 0 ? 0 : Math.PI, 1.2, 6);
        // Casting from a staff: a burst of the spell's colour at the tip
        if (def.hold === 'staff' && spec.look) {
            const c = spec.look.c === 'rand' ? '255,255,255' : spec.look.c;
            this.fx.flashAt(m.x, m.y, c, 22, 6);
            this.fx.sparks(m.x, m.y, c, 6, p.facing > 0 ? 0 : Math.PI, 1.6, 4);
        } else if (spec.look && def.hold === 'gun') this.fx.flashAt(m.x, m.y, spec.look.c === 'rand' ? '255,255,255' : spec.look.c, 16, 4);
        return true;
    },

    // Seeker lock-on: the nearest enemy, strongly preferring the side we face
    seekTarget(p) {
        let best = null, bestS = Infinity;
        const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
        for (const t of this.players) {
            if (t === p || t.isDead || t.team === p.team) continue;
            const dx = t.x + t.width / 2 - cx, dy = t.y + t.height / 2 - cy;
            const s = Math.hypot(dx, dy) + (Math.sign(dx) === p.facing ? 0 : 500);
            if (s < bestS) { bestS = s; best = t; }
        }
        return best;
    },

    // Nimbus Staff laser: instant hit along a line in front of the caster
    fireBeam(p, def) {
        const b = def.beam;
        const startX = p.x + p.width / 2 + (p.facing * 20);
        const startY = p.y + p.height / 2;
        this.fx.beam(startX, startY, b.length, p.facing, '#00FFFF');
        this.fx.flashAt(startX, startY, '120,255,255', 26, 6);
        const hitBox = { x: p.facing === 1 ? startX : startX - b.length, y: startY - b.height / 2, width: b.length, height: b.height };
        for (const t of this.players) {
            if (t === p || t.isDead || t.team === p.team || !t.intersectsRect(hitBox)) continue;
            t.lastHitType = 'magic_stick'; t.lastHitAt = this.frameCount;
            t.takeDamage(b.damage, p);
            AudioSys.playHit();
            this.fx.sparks(t.x + t.width / 2, startY, '120,255,255', 12, p.facing > 0 ? Math.PI : 0, 1.4, 6);
        }
        AudioSys.playShoot();
    },

    // The angel's explosion (original rules: 150px, 20 damage, 20 knockback)
    angelBlast(p) {
        const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
        this.fx.explosion(cx, cy, 150);
        this.fx.ring(cx, cy, '255,240,150', 150, 6, 20);
        AudioSys.playExplosion();
        for (const t of this.players) {
            if (t === p || t.isDead || t.team === p.team) continue;
            const dist = t.touchDistanceToPoint(cx, cy);
            if (dist < 150) {
                t.lastHitType = 'bird_crystal'; t.lastHitAt = this.frameCount;
                t.takeDamage(20, p);
                const angle = Math.atan2(t.y - p.y, t.x - p.x);
                t.velocity.x = Math.cos(angle) * 20;
                t.velocity.y = Math.sin(angle) * 20;
            }
        }
    },

    // Grenade / rocket explosion: damage falls off with distance; the shooter
    // only gets pushed (rocket jumps), and nearby ice shatters
    blast(x, y, b, owner, wtype) {
        if (b.pull) this.fx.vortex(x, y, b.radius);
        else { this.fx.explosion(x, y, b.radius); this.fx.scorch(x, y, b.radius); }
        if (b.status) this.statusBurst(x, y, b.radius, b.status);
        if (b.damage >= HEAVY_HIT && !this.demo) this.fx.addTrauma(0.4);
        this.fx.screenFlash('255,220,160', 0.35);
        this.freeze = Math.max(this.freeze, 3);
        AudioSys.playExplosion();
        for (const t of this.players) {
            if (t.isDead || (owner && t !== owner && t.team === owner.team)) continue;   // teammates are safe
            const tx = t.x + t.width / 2, ty = t.y + t.height / 2;
            const dist = t.touchDistanceToPoint(x, y);
            if (dist >= b.radius) continue;
            const f = 1 - (dist / b.radius) * 0.5;
            const nx = (tx - x) / (dist || 1), ny = (ty - y) / (dist || 1);
            if (t !== owner) {
                if (wtype !== undefined) { t.lastHitType = wtype; t.lastHitAt = this.frameCount; }
                t.takeDamage(b.damage * f, owner);
                if (b.status) this.applyStatus(t, b.status, owner, wtype, b.damage * f);
            }
            const k = b.knock * f * (t === owner ? 0.8 : 1);
            if (b.pull) {
                // A vortex drags everything toward its heart
                t.velocity.x = -nx * k;
                t.velocity.y = -ny * k * 0.8 - 2;
            } else {
                t.velocity.x = nx * k;
                t.velocity.y = Math.min(ny * k, 0) - 3;
            }
        }
        if (this.level.material === 'ice') {
            for (const pl of this.level.platforms) {
                if (!pl.active || pl.type === 'trampoline') continue;
                const px = Math.max(pl.x, Math.min(x, pl.x + pl.width)), py = Math.max(pl.y, Math.min(y, pl.y + pl.height));
                if (Math.hypot(px - x, py - y) < b.radius * 0.5 && pl.width < 400) {
                    pl.active = false;
                    this.fx.shards(pl.x, pl.y, pl.width, pl.height, 'rgba(210,235,255,0.95)', 20);
                }
            }
        }
    },

    updateProjectiles() {
        const fx = this.fx;
        for (const pr of this.projectiles) {
            if (!pr.active) continue;
            const fromX = pr.x, fromY = pr.y;
            const ev = pr.update(this.level);
            // Trails
            if (pr.type === 'rocket' || pr.type === 'seeker') { fx.smoke(pr.x - pr.vx, pr.y - pr.vy, 1, 4); fx.embers(pr.x - pr.vx, pr.y - pr.vy, 1, 1); }
            else if (pr.type === 'plasma' && pr.age % 2 === 0) fx.sparks(pr.x, pr.y, '120,255,240', 1, undefined, 0, 2);
            else if (pr.type === 'sniper') fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 26, color: '200,240,255', size: 2, grow: 0.06, alpha: 0.4 });
            else if (pr.type === 'shockwave' && pr.age % 2 === 0) fx.sparks(pr.x, pr.y + (Math.random() - 0.5) * 50, '120,240,255', 1, Math.PI / 2 + pr.direction * Math.PI / 2, 0.6, 2);
            else if (pr.type === 'grenade' && pr.age % 3 === 0) fx.add({ type: 'puff', x: pr.x, y: pr.y, life: 18, color: '160,160,160', size: 2, grow: 0.1, alpha: 0.35 });

            if (ev === 'caught') { pr.active = false; continue; }
            if (ev === 'bounce' && (pr.type !== 'bomb' || Math.abs(pr.vy) > 2)) {
                fx.sparks(pr.x, pr.y, pr.type === 'plasma' ? '120,255,240' : '255,230,160', 4);
                AudioSys.playAttack();
            }
            if (pr.spec.look) this.lookTrail(pr);
            if (ev === 'stick') { fx.sparks(pr.x, pr.y, '255,220,150', 4); AudioSys.playAttack(); }
            // An armed mine goes off when an enemy comes close
            if (pr.stuck && pr.spec.stick && pr.age > 20) {
                const near = this.players.some(p => !p.isDead && p !== pr.owner && !(pr.owner && p.team === pr.owner.team) &&
                    p.touchesCircle(pr.x, pr.y, pr.spec.stick + 20));
                if (near) { this.blast(pr.x, pr.y, pr.spec.blast, pr.owner, pr.wtype); this.splitShot(pr); pr.active = false; continue; }
            }
            if (ev === 'platform' || ev === 'expire') {
                this.splitShot(pr);
                if (pr.spec.blast) this.blast(pr.x, pr.y, pr.spec.blast, pr.owner, pr.wtype);
                else if (ev === 'platform') {
                    fx.sparks(pr.x, pr.y, '255,220,150', 6, pr.vx > 0 ? Math.PI : 0, 2.2, 3);
                    fx.dust(pr.x, pr.y, 2, 4, DUST_TINT[this.level.material]);
                }
                pr.active = false;
                continue;
            }
            for (const p of this.players) {
                if (p === pr.owner || p.isDead || (pr.owner && p.team === pr.owner.team)) continue;
                if (pr.hitSet && pr.hitSet.has(p)) continue;
                if (!Projectile.sweepHits(pr, fromX, fromY, p)) continue;
                if (pr.spec.blast) { this.splitShot(pr); this.blast(pr.x, pr.y, pr.spec.blast, pr.owner, pr.wtype); pr.active = false; break; }
                p.lastHitType = pr.wtype; p.lastHitAt = this.frameCount;
                p.takeDamage(pr.spec.damage, pr.owner);
                p.velocity.x = pr.direction * pr.spec.knock;
                if (pr.spec.pull && pr.owner) {
                    // Harpoons reel the target in
                    const o = pr.owner, dx = o.x - p.x;
                    p.velocity.x = Math.sign(dx) * Math.min(pr.spec.pull, Math.abs(dx) * 0.08 + 6);
                    p.velocity.y = -4;
                }
                if (pr.spec.status) this.applyStatus(p, pr.spec.status, pr.owner, pr.wtype, pr.spec.damage);
                if (pr.spec.look) this.lookImpact(pr, p);
                AudioSys.playHit();
                if (pr.type === 'shockwave') {
                    fx.sparks(p.x + p.width / 2, p.y + p.height / 2, '0,255,255', 15, undefined, 0, 7);
                    fx.sparks(p.x + p.width / 2, p.y + p.height / 2, '255,255,255', 10, undefined, 0, 9);
                }
                if (pr.hitSet) pr.hitSet.add(p);
                else { this.splitShot(pr); pr.active = false; break; }
            }
        }
        this.projectiles = this.projectiles.filter(p => p.active);
    },

    // Every damage event lands here (hooked from Player.takeDamage)
    onDamage(p, amount, attacker, shielded, killed) {
        const fx = this.fx;
        const cx = p.x + p.width / 2, cy = p.y + p.height * 0.4;
        const dir = attacker && attacker !== p ? (Math.sign(cx - (attacker.x + attacker.width / 2)) || 1) : 0;
        if (shielded) {
            p.shieldHit = 1;
            fx.ring(cx, cy, '160,220,255', 34, 3, 12);
        }
        if (amount >= 1.5 || killed) {
            p.hitFlash = Math.min(1, p.hitFlash + 0.6 + amount * 0.02);
            p.flinchNew = true;
            fx.flashAt(cx - dir * 8, cy, '255,255,255', 16 + amount, 6);
            fx.sparks(cx - dir * 6, cy, shielded ? '170,220,255' : '255,230,160', 6 + Math.min(14, amount | 0),
                      dir ? (dir > 0 ? 0 : Math.PI) : undefined, 1.5, 5 + amount * 0.2);
            if (amount < 1000) {
                const n = Math.max(1, Math.round(amount));
                fx.text(cx, p.y - 18, String(n), shielded ? '#90caf9' : amount >= 20 ? '#ff7043' : '#fff59d', 14 + Math.min(16, amount * 0.5));
            }
            if (!shielded && amount >= 8 && amount < 1000) fx.drops(cx, cy, p.isBird ? '#ffffff' : p.color, Math.min(12, Math.round(amount / 2.5)), dir);
            // The screen only shakes for an extremely heavy hit (never in the menu demo)
            if (amount >= HEAVY_HIT && amount < 1000 && !this.demo) {
                fx.addTrauma(Math.min(0.5, 0.15 + (amount - HEAVY_HIT) * 0.01));
                if (dir) fx.kick(dir, 0, Math.min(6, (amount - HEAVY_HIT) * 0.3 + 2));
            }
            if (amount >= 15) this.freeze = Math.max(this.freeze, Math.min(7, Math.round(2 + amount / 6)));
        } else {
            // Chip damage (angel contact): grouped so numbers don't spam
            p.chip = (p.chip || 0) + amount;
            if (p.chip >= 5) {
                fx.text(cx, p.y - 18, String(Math.round(p.chip)), '#ffab91', 12);
                fx.sparks(cx, cy, '255,180,180', 3);
                p.chip = 0;
            }
        }
        if (killed) this.onKO(p, attacker, amount);
    },

    onKO(p, attacker, amount) {
        const fx = this.fx;
        const fell = amount >= 1000;
        const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
        if (!fell) {
            this.deathEffect(p, attacker);     // decides how they die; the corpse plays it (death-anim.js)
            if (!this.demo) fx.screenFlash('255,255,255', 0.3);
            this.freeze = Math.max(this.freeze, 8);
        } else {
            p.corpseSpawned = true;   // fell out of the arena: nothing left to ragdoll
        }
        AudioSys.playKO();
        // No kill-feed text: names are hidden so everyone feels like a real player
    },

    // Per-update feedback for movement: dust, jump puffs, bouncer launches
    playerFx(p) {
        if (p.isDead) return;
        const fx = this.fx, feet = p.y + p.height, cx = p.x + p.width / 2;
        const tint = DUST_TINT[this.level.material];
        if (p.landFx) {
            const impact = Math.min(1, p.landFx / 14);
            p.landFx = 0;
            if (impact > 0.15) {
                fx.dust(cx, feet, 4 + Math.round(impact * 10), 24, tint);
                if (impact > 0.6) fx.ring(cx, feet, '255,255,255', 30 * impact, 2, 12);
            }
        }
        if (p.grounded && !p.isLaying && Math.abs(p.velocity.x) > 3.5 && this.frameCount % 5 === p.id % 5) {
            fx.dust(cx - p.facing * 8, feet, 1, 6, tint);
        }
        const jf = -p.jumpForce + 1;
        if (p.velocity.y < jf && p.velocity.y > -14 && (p.lastVy === undefined || p.lastVy >= jf)) {
            if (p.jumpCount >= 2) { fx.ring(cx, feet, '255,255,255', 22, 2, 14); fx.dust(cx, feet, 4, 10, '255,255,255'); }
            else fx.dust(cx, feet, 5, 18, tint);
        }
        if (p.velocity.y <= -14.9 && (p.lastVy === undefined || p.lastVy > -14)) {
            fx.ring(cx, feet, '105,240,174', 38, 3, 16);
            fx.sparks(cx, feet, '150,255,200', 12, -Math.PI / 2, 1.2, 7);
        }
        p.lastVy = p.velocity.y;
        // Pickup toast in the weapon's rarity colour
        if (p.weapon !== p.lastWeapon) {
            if (p.weapon && p.weapon.type !== 'bird_crystal') {
                const r = RARITY[p.weapon.def.rarity] || RARITY.common;
                fx.text(cx, p.y - 34, '+ PICKUP', r.color, 14);
                fx.ring(cx, p.y + p.height / 2, r.glow, 44, 3, 14);
            } else if (p.weapon) {
                fx.screenFlash('255,210,255', 0.5);
                fx.ring(cx, p.y + p.height / 2, '255,200,255', 140, 6, 24);
                if (!this.demo) this.banner('ASCENDED', 'THE ANGEL RISES', '#e040fb', 0, 1800);
            }
            p.lastWeapon = p.weapon;
        }
        if (this.kingId === p.id && this.frameCount % 18 === 0 && p.joints) {
            fx.star(p.joints[0].x + (Math.random() - 0.5) * 22, p.joints[0].y - 22, '255,230,120');
        }
        if (p.isBird) {
            if (this.frameCount % 5 === 0) fx.add({ type: 'puff', x: cx + (Math.random() - 0.5) * 34, y: p.y + 18, vx: (Math.random() - 0.5), vy: 0.6, life: 34, color: '255,250,220', size: 2.2, alpha: 0.8, drag: 0.98 });
            // Shed feathers drift down from the wings, and holy motes rise off the halo
            if (this.frameCount % 11 === 0) {
                const side = Math.random() < 0.5 ? -1 : 1;
                fx.add({ type: 'feather', x: cx + side * (16 + Math.random() * 26), y: p.y + 10 + Math.random() * 14, vx: side * (0.2 + Math.random() * 0.4), vy: 0.35 + Math.random() * 0.3, life: 90, color: '255,255,255', size: 4 + Math.random() * 2.5, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.06, seed: Math.random() * 6, drag: 0.985 });
            }
            if (this.frameCount % 14 === 0 && p.joints) fx.star(p.joints[0].x + (Math.random() - 0.5) * 30, p.joints[0].y - 12 - Math.random() * 16, '255,236,150');
        }
        if (p.onCloud && this.frameCount % 4 === 0) {
            fx.add({ type: 'puff', x: cx + (Math.random() - 0.5) * 30, y: feet + 10, vx: (Math.random() - 0.5) * 0.5, vy: 0.3, life: 30, color: '255,255,255', size: 4, alpha: 0.5, grow: 0.1 });
        }
    },

    // Kept for Player.update (angel contact) and older callers
    createExplosion(x, y, color) {
        const rgb = color === 'red' ? '255,90,90' : color === 'gold' ? '255,215,64' : '255,255,160';
        this.fx.sparks(x + 15, y + 30, rgb, 8, undefined, 0, 5);
    }
});
