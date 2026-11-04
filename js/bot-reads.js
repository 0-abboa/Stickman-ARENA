// Situation reads shared by the bot's tactics. Each one answers a concrete game
// question ("does a punch land right now?", "would that knock them out of the
// arena?") by running the same rules the game uses.
Object.assign(BotBrain.prototype, {

    weaponType(o) {
        const w = o.weapon;
        return typeof w === 'string' ? w : (w ? w.type : null);
    },

    // Center-to-center distance at which o can hit something in front of it
    reachOf(o) {
        if (o.isBird) return 150;
        const def = WeaponDefs.of(o);
        return def.kind === 'melee' ? 30 + WeaponDefs.reach(def) : 30;   // guns/beams are handled as projectiles
    },

    meleeRange() {
        const def = WeaponDefs.of(this.body);
        return def.kind === 'melee' ? WeaponDefs.reach(def) : 40;   // createMeleeAttack box width
    },

    // Direction (-1/1) in which a swing this frame connects with opp, else 0.
    // Mirrors createMeleeAttack using our position after this frame's movement.
    meleeDir(opp) {
        const me = this.body;
        const range = this.meleeRange();
        const dir = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
        if (me.isLaying && me.facing !== dir) return 0;   // can't turn while down
        const g = BotSim.ghost(me);
        g.jumpPressed = me.jumpPressed;
        BotSim.step(g, this.scratchInput(me.isLaying ? 0 : dir, me.isLaying ? 1 : 0), this.world, 0);
        const box = { x: dir === 1 ? g.x + g.width : g.x - range, y: g.y, width: range, height: g.height };
        if (Utils.rectIntersect(box, opp)) return dir;
        // Spinning weapons hit both sides at once, so the box behind counts too
        if (WeaponDefs.of(me).both) {
            const back = { x: dir === 1 ? g.x - range : g.x + g.width, y: g.y, width: range, height: g.height };
            if (Utils.rectIntersect(back, opp)) return dir;
        }
        return 0;
    },

    // Would knocking o with velocity (dir*kvx, kvy) send it out of the arena
    // even if it answers with its best recovery (jumps, air control, crouch)?
    knockLethal(o, dir, kvx, kvy) {
        if (kvx === undefined) { kvx = 10; kvy = -5; }
        if (o.isBird || o.onCloud) return false;   // fliers can't fall out
        const id = o.ref ? o.ref.id : 'x';
        const key = 'kl:' + id + ':' + dir + ':' + kvx.toFixed(1) + ':' + kvy.toFixed(1);
        const hit = this.cache.get(key);
        if (hit && this.frame - hit.frame < 4) return hit.v;
        const s = Object.assign({}, o, { velocity: { x: dir * kvx, y: kvy }, jumpPressed: false });
        const v = !BotSim.canRecover(s, this.world);
        this.cache.set(key, { frame: this.frame, v });
        return v;
    },

    // Which way we want to knock opp: toward a deadly side if one exists,
    // otherwise toward the nearer edge of their platform
    pushDir(opp) {
        const key = 'push:' + (opp.ref ? opp.ref.id : 'x');
        const c = this.cache.get(key);
        if (c && this.frame - c.frame < 15) return c.v;
        let v = 0;
        const deadL = this.knockLethal(opp, -1), deadR = this.knockLethal(opp, 1);
        if (deadL !== deadR) v = deadL ? -1 : 1;
        else {
            const node = this.nodeOf(opp);
            if (node >= 0) {
                const p = this.game.level.platforms[node];
                const safe = this.nav.knockSafe[node] || { left: true, right: true };
                const oc = BotSim.cx(opp);
                const l = (oc - p.x) * (safe.left ? 1 : 0.4);
                const r = (p.x + p.width - oc) * (safe.right ? 1 : 0.4);
                v = l < r ? -1 : 1;
            }
        }
        this.cache.set(key, { frame: this.frame, v });
        return v;
    },

    // Could opp ring us out right now?
    inDanger(opp, dist) {
        if (!this.skill('lethal') || opp.isBird) return false;
        if (dist > this.reachOf(opp) + 45 || BotSim.vgap(this.body, opp) > 40) return false;
        const away = BotSim.cx(this.body) >= BotSim.cx(opp) ? 1 : -1;
        const d = WeaponDefs.of(opp);
        const melee = d.kind === 'melee';
        return this.knockLethal(this.selfView(), away, melee ? d.knock : 10, melee ? d.lift : -5);
    },

    nodeOf(o) {
        if (!this.nav.ready) return -1;
        if (o.grounded) {
            const i = this.nav.supportIndex(o);
            if (i >= 0) return i;
        }
        return this.nav.nodeBelow(BotSim.cx(o), o.y + o.height);
    },

    // How hard o hits up close, per second (fists, blades, hammers)
    meleeDps(o) {
        const d = WeaponDefs.of(o);
        if (d.kind !== 'melee') return 15;
        return d.damage * 60 / d.cooldown + Math.abs(d.knock) * 1.5 + WeaponDefs.statusDps(d.status) + (d.both ? 4 : 0);
    },

    // Same for a gun at point blank
    shotDps(d) {
        const pr = d.proj;
        if (!pr) return 30;
        const dmg = (pr.blast ? pr.blast.damage : pr.damage) * (d.pellets || 1);
        return dmg * 60 / d.cooldown + pr.knock * 1.5 + WeaponDefs.statusDps(pr.status || (pr.blast && pr.blast.status));
    },

    // Floor on the far side of opp (beyond them, in direction dir) on our platform
    roomPast(opp, dir) {
        const i = this.nav.supportIndex(this.body);
        if (i < 0) return 0;
        const p = this.game.level.platforms[i];
        const oc = BotSim.cx(opp);
        return dir > 0 ? p.x + p.width - (oc + 40) : (oc - 40) - p.x;
    },

    // Floor left in front of us before our platform ends
    edgeRoom(dir) {
        const i = this.nav.supportIndex(this.body);
        if (i < 0) return Infinity;
        const p = this.game.level.platforms[i];
        const me = this.body;
        return dir > 0 ? p.x + p.width - (me.x + me.width) : me.x - p.x;
    },

    // Opp is in the air beside our platform with nothing safe under them
    isOffstage(opp) {
        if (opp.grounded || opp.onCloud || opp.isBird || !this.nav.ready) return false;
        const i = this.nav.supportIndex(this.body);
        if (i < 0) return false;
        const p = this.game.level.platforms[i];
        const oc = BotSim.cx(opp);
        if (oc > p.x - 8 && oc < p.x + p.width + 8) return false;
        const gap = oc < p.x ? p.x - oc : oc - (p.x + p.width);
        if (gap > 260 || opp.y > p.y + 220 || opp.y < p.y - 260) return false;
        // Only if doing nothing would kill them: they must come back through us
        const key = 'off:' + (opp.ref ? opp.ref.id : 'x');
        const c = this.cache.get(key);
        if (c && this.frame - c.frame < 6) return c.v;
        const v = BotSim.run(opp, BotSim.plan(0, 999, 0), this.world, 150).dead;
        this.cache.set(key, { frame: this.frame, v });
        return v;
    },

    // On ice a punch shatters the platform in front of our chest; worth it when
    // that platform is the one they're standing on
    iceBreak(opp) {
        const me = this.body;
        if (me.weapon || this.game.level.material !== 'ice' || !opp.grounded) return false;
        const node = this.nav.supportIndex(opp);
        if (node < 0 || node === this.nav.supportIndex(me)) return false;
        const p = this.game.level.platforms[node];
        const px = me.x + me.facing * 40, py = me.y + 20;
        return px > p.x && px < p.x + p.width && py > p.y && py < p.y + p.height;
    },

    // Where a dropped weapon will come to rest (same rules as Weapon.update)
    weaponRest(w, level) {
        if (w.owner) return { x: w.x, y: w.y };
        let rest = Infinity;
        for (const p of level.platforms) {
            if (!p.active) continue;
            if (w.x < p.x + p.width && w.x + w.width > p.x && p.y >= w.y + w.height - 6 && p.y - w.height < rest) {
                rest = p.y - w.height;
            }
        }
        if (rest === Infinity) return null;   // nothing below: it falls out of the arena
        return { x: w.x, y: Math.max(w.y, rest) };
    },

    // Is this resting item lying on a bouncer? (nodeBelow never lists bouncers, so routes can't end on one)
    onBouncer(w, land) {
        const top = land.y + w.height;
        for (const p of this.game.level.platforms) {
            if (p.active && p.type === 'trampoline' && Math.abs(p.y - top) < 3 && w.x + w.width / 2 > p.x && w.x + w.width / 2 < p.x + p.width) return true;
        }
        return false;
    },

    etaTo(cx, feetY) {
        const me = this.body;
        const base = Math.abs(cx - BotSim.cx(me)) / me.speed;
        if (!this.nav.ready) return base + Math.abs(feetY - (me.y + me.height)) / 3;
        const from = this.nav.supportIndex(me);
        const to = this.nav.nodeBelow(cx, feetY);
        if (from < 0 || to < 0) return base + 40;
        if (from === to) return base;
        const r = this.nav.route(from, to, me.x, this.bannedEdges());
        return r ? r.cost + Math.abs(cx - r.landX) / me.speed : Infinity;   // no way there
    },

    oppEta(opp, cx, feetY) {
        const feet = opp.y + opp.height;
        return Math.abs(cx - BotSim.cx(opp)) / 5 + Math.max(0, feet - feetY) / 3 + Math.max(0, feetY - feet) / 8;
    },

    // Nobody sees a new weapon the instant it appears. A bot notices it after a
    // moment: slower for weaker tiers, quicker as the level climbs, and HACK sees
    // it at once. Each bot rolls its own delay per weapon, so they don't all jump together.
    // Once a weapon is noticed, going for it is not a skill check (no hesitation, no noise). The delay only
    // covers a weapon that has just appeared: nobody reacts instantly to a new drop in the middle of a fight.
    noticed(w, game) {
        if (this.difficulty === 'hack') return true;                       // HACK is pure bot skill
        const seen = this.weaponSeen || (this.weaponSeen = new WeakMap());
        let e = seen.get(w);
        if (!e) {
            const me = this.body;
            let fighting = false;
            if (game && game.players) {
                for (const o of game.players) {
                    if (o === me || o.isDead || (me.team !== undefined && o.team === me.team)) continue;
                    if (Math.abs(o.x - me.x) < 190 && Math.abs(o.y - me.y) < 120) { fighting = true; break; }
                }
            }
            const base = { easy: 120, medium: 80, hard: 34, nightmare: 12 }[this.difficulty];
            const key = w.type === 'bird_crystal' || w.type === 'magic_stick';   // the angel race stays fair
            const delay = (base === undefined ? 0 : base) * (fighting ? 1 : 0.4) * (key ? 0.35 : 1) * (0.7 + Math.random() * 0.8);
            e = { at: this.frame, delay };
            seen.set(w, e);
        }
        return this.frame - e.at >= e.delay;
    },

    // The weapon (or crystal) most worth going for right now, if any. Everyone
    // wants the Angel Crystal; the Nimbus Staff is the answer to an angel; and a
    // weapon is a race against EVERY rival (not just whoever we're fighting).
    bestPrize(game, opp) {
        const me = this.body;
        if (me.isBird || me.onCloud) return null;
        const angelLive = game.players.some(p => p.isBird && !p.isDead && p.team !== me.team);
        const rivals = game.players.filter(p => p !== me && !p.isDead && p.team !== me.team && !p.isBird && !p.onCloud);
        // Fighters on top of us are hitting us while we walk away: how much that costs per second
        let attackDps = 0;
        for (const p of rivals) {
            const s = this.perceive(p);
            if (!s || this.hostility(p, s) <= 0.5 || Math.hypot(s.x - me.x, s.y - me.y) > 180) continue;
            const d = WeaponDefs.of(p);
            attackDps = Math.max(attackDps, (d.kind === 'shot' ? this.shotDps(d) : this.meleeDps(p)) * 0.4);
        }
        const engaged = !!opp && Math.abs(BotSim.cx(opp) - BotSim.cx(me)) < 170 && BotSim.vgap(me, opp) < 60;
        // Armed already: only worth it for a clearly better weapon (or when ours is nearly spent)
        let floor = 0;
        if (me.weapon) {
            const cd = WEAPONS[me.weapon.type] || {};
            const cw = isFinite(cd.durability) ? me.weapon.durability / cd.durability : 1;
            floor = (cd.value || 30) * Math.max(0.35, cw) + 25;
            if (cw < 0.25) floor = 20;
        }
        let best = null;
        for (const w of game.weapons) {
            if (!w.active || w.owner) continue;
            const crystal = w.type === 'bird_crystal', staff = w.type === 'magic_stick';
            const rush = crystal || (staff && angelLive);                   // everyone drops everything for these
            if (!rush) {
                // Picking up what is lying around is the most basic thing in the game: every tier notices and goes for it
                if (w.lock > 120) continue;                            // still sealed for a while
            }
            if ((this.prizeBan.get(w) || 0) > this.frame) continue;    // gave up on this one
            const land = this.weaponRest(w, game.level);
            if (!land) continue;
            const cx = land.x + w.width / 2, feet = land.y + w.height;
            const falling = land.y > w.y + 1;
            let mine = this.etaTo(cx, feet);
            if (mine === Infinity) {
                // Can't walk there; only worth it if we can snatch it on the way down
                if (!falling) continue;
                mine = Math.abs(cx - BotSim.cx(me)) / me.speed + 60;
            }
            const wd = WEAPONS[w.type] || {};
            const worn = isFinite(wd.durability) ? Math.max(0.35, w.durability / wd.durability) : 1;
            let score = (wd.value || 30) * worn - mine * 0.3;
            if (crystal) score += 600;                                       // the crystal beats anything else on the map
            if (angelLive) {
                if (staff) score += 500;                                     // the real answer to an angel
                else if (wd.kind === 'shot') score *= 1.7;
            }
            if (!crystal) {
                if (engaged && me.weapon && !rush) continue;                 // not mid-duel for a marginal upgrade
                // Walking away from a fight costs the hits we take on the way: worth it for a
                // strong weapon close by, not for a marginal one far away, never when it'd kill us
                if (attackDps) {
                    const cost = attackDps * mine / 60;
                    if (cost > me.health * 0.6) continue;
                    score -= cost * 0.8;
                }
                // Race against every rival that would actually take it
                let rivalEta = Infinity;
                const wp = this.weaponPower(w.type, 1);
                for (const p of rivals) {
                    if (this.powerOf(p) >= wp * 0.8) continue;
                    rivalEta = Math.min(rivalEta, this.oppEta(p, cx, feet));
                }
                if (rivalEta + 15 < mine) score -= 80;                       // they get there first
            }
            if (score <= floor) continue;
            if (me.weapon && ((falling && !crystal) || w.type === me.weapon.type)) continue;   // swaps need it on the ground
            if (!best || score > best.score) {
                best = { w, land, score, swap: !!me.weapon, sealed: w.lock > 0,
                         urgent: crystal || (staff && (angelLive || !me.weapon)) };
            }
        }
        return best;
    },

    // Frame our shot would hit opp (standing or crouched "low" shot), else -1.
    // Runs the real projectile physics (arcs, rockets, bounces, blast radius)
    // against opp carrying on with their current motion.
    shotHitTime(opp, dir, low) {
        const me = this.body;
        const def = WeaponDefs.of(me);
        if (def.kind !== 'shot') return -1;
        const g = BotSim.ghost(me);
        BotSim.step(g, this.scratchInput(low ? 0 : dir, low ? 1 : 0), this.world, 0);
        if (g.facing !== dir) return -1;
        const spec = def.proj;
        const m = WeaponDefs.muzzle(g, def);
        const s = { x: m.x, y: m.y, vx: spec.speed * dir, vy: spec.lift || 0, vx0: spec.speed * dir, life: spec.life,
                    age: 0, spec, owner: me, returning: false, bounces: spec.bounces || 0, target: null };
        const box = { x: 0, y: 0, size: spec.size + (spec.blast ? spec.blast.radius * 0.6 : 0) };
        const o = BotSim.ghost(opp);
        o.jumpPressed = true;
        if (spec.homing) s.target = o;   // a seeker locks on to them
        const oin = this.scratchInput2(Math.abs(opp.velocity.x) > 1 ? Math.sign(opp.velocity.x) : 0,
            opp.isLaying ? 1 : 0, opp.velocity.y < 0 && !opp.grounded);
        // Slow orbs, lobbed shells and mines need a longer look ahead than bullets
        const horizon = spec.blast || spec.stick ? Math.min(140, spec.life) : 70;
        const near = (r) => Math.hypot(BotSim.cx(o) - s.x, o.y + o.height / 2 - s.y) < r;
        for (let k = 0; k < horizon; k++) {
            if (k > 0) BotSim.step(o, oin, this.world, k);
            const fx = s.x, fy = s.y;
            const ev = Projectile.step(s, this.world);
            if (ev === 'expire' && spec.blast && Math.hypot(BotSim.cx(o) - s.x, o.y + o.height / 2 - s.y) < spec.blast.radius * 0.7) return k;   // fuse runs out next to them
            if (ev === 'expire' || ev === 'caught') return -1;
            box.x = s.x; box.y = s.y;
            if (Projectile.sweepHits(box, fx, fy, o)) return k;
            if (ev === 'platform') {
                if (spec.blast && near(spec.blast.radius * 0.7)) return k;
                return -1;
            }
            // A mine that lands where they will walk over it
            if (ev === 'stick') return near(spec.stick + 30) ? k : -1;
        }
        return -1;
    },

    // Predicted path of a projectile for the next n frames (cached per frame)
    pathOf(pr, n) {
        let c = this.pathCache.get(pr);
        if (!c || c.frame !== this.frame) {
            c = { frame: this.frame, path: Projectile.predict(pr, this.world, n || 50) };
            this.pathCache.set(pr, c);
        }
        return c.path;
    },

    // Does a laser fired this frame (magic stick, flying) hit opp?
    laserHits(opp, dir) {
        const me = this.body;
        const g = BotSim.ghost(me);
        BotSim.step(g, this.scratchInput(dir, 0), this.world, 0);
        const sx = g.x + g.width / 2 + dir * 20, sy = g.y + g.height / 2;
        const box = { x: dir === 1 ? sx : sx - 400, y: sy - 5, width: 400, height: 10 };
        return Utils.rectIntersect(box, opp);
    }
});
