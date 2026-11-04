// Bot tactics: what to do in each situation. Each tactic fills an "intent"
// (where to stand, when to swing, shield, crouch or jump) that the motor in
// bot-motor.js turns into controller input.
Object.assign(BotBrain.prototype, {

    // Melee: spacing, punishing, ring-outs, cross-ups, bracing. Never just
    // stands and trades: an outgunned bot keeps out of reach and darts in on
    // whiffs, and everyone keeps some footwork going.
    tacticMelee(it, opp) {
        const me = this.body, P = this.profile;
        it.mode = 'melee';
        const mc = BotSim.cx(me), oc = BotSim.cx(opp);
        const dx = oc - mc, dist = Math.abs(dx);
        // Which side they are on. Standing inside each other, keep the side we were on instead of flipping
        // every frame (that is what made two bots shuffle through one another without ever swinging)
        const toward = Math.abs(dx) < 10 ? (this.lastToward || me.facing) : Math.sign(dx);
        this.lastToward = toward;
        const reach = this.reachOf(me), theirs = this.reachOf(opp);
        const vgap = BotSim.vgap(me, opp);
        // An opponent who never swings back can't ring us out: no bracing, no dancing
        const danger = !this.isPassive(opp) && this.inDanger(opp, dist);
        const lethalRead = this.skill('lethal');
        const push = lethalRead ? this.pushDir(opp) : 0;
        const myDef = WeaponDefs.of(me), oppDef = WeaponDefs.of(opp);
        const oppShot = oppDef.kind === 'shot';
        const theirDps = oppShot ? this.shotDps(oppDef) : this.meleeDps(opp);
        const outgunned = theirDps > this.meleeDps(me) * 1.5 + 10;
        const recovering = opp.cd > 6;
        const passive = this.isPassive(opp);

        // Swing?
        const hitDir = this.meleeDir(opp);
        const chance = this.swingChance(opp, hitDir || toward, { passive, danger, outgunned, reach, theirs, push, lethalRead, myDef });
        this.swingP = chance;   // kept so swingBetween() can take a swing that opens up between think ticks
        if (hitDir && me.attackCooldown <= 0 && Math.random() < chance) { it.attack = true; it.face = hitDir; }
        if (!it.attack && me.attackCooldown <= 0 && this.iceBreak(opp)) {
            it.attack = true;
            it.face = me.facing;
        }

        // Crouching cancels knockback, so with our back to a deadly edge we dig in,
        // but only briefly (two fighters crouched and jabbing forever is silly):
        // after a second of bracing, move instead for a while
        const braceOk = this.frame >= (this.braceBan || 0) && !opp.isLaying;
        if (danger && !it.attack && me.grounded && !outgunned && braceOk && this.skill('crouchFire')) {
            if (!this.bracing) { this.bracing = true; this.braceSince = this.frame; }
            if (this.frame - this.braceSince < 50 + Math.random() * 30) {
                it.crouch = true;
                it.face = toward;
                return;
            }
            this.braceBan = this.frame + 120 + Math.floor(Math.random() * 90);
        }
        this.bracing = false;

        // Footwork: how far from them to stand
        let want;
        if (oppShot) {
            const R = WeaponDefs.range(oppDef);
            // Short guns (flamethrower, shotgun): stay just outside them until they
            // reload. Long guns: get in their face where they can't kite us.
            want = R < 230 && !recovering ? Math.max(reach - 14, R + 40) : reach - 16;
        } else if (outgunned) {
            want = recovering ? reach - 14 : theirs + 24 + 12 * Math.sin(this.frame / 9);
        } else if (this.strategy === 'pressure') want = reach - 16;
        else if (this.strategy === 'footsies') want = reach > theirs ? reach - 6 : theirs + 8;
        else if (this.strategy === 'zone') want = reach - 4 + (me.attackCooldown > 0 ? 34 : 0);   // tip range, hop back after a poke
        else if (this.strategy === 'counter') want = theirs + 14;                                 // just outside them; their swing is the cue
        else if (this.strategy === 'rushdown') want = Math.max(32, reach - 26);                   // in their face
        else want = theirs + 4 + 10 * Math.sin(this.frame / 7);   // bait: dance at their range
        const sit = this.situation;
        if (sit === 'finisher') want = Math.min(want, reach - 20);
        else if (sit === 'kiteDot' && !opp.stunned) want = Math.max(want, theirs + 45);
        if ((opp.cd > 4 && !oppShot) || passive) want = Math.min(want, reach - 14);   // recovering or passive: step in
        else if (myDef !== PUNCH && myDef.cooldown >= 26) want = Math.max(want, reach - 8);   // heavy weapon: fight at the tip
        else if (myDef !== PUNCH && myDef.cooldown <= 12) want = Math.min(want, reach - 18);  // quick blade: stay in their face
        want = Math.max(32, want + this.jitter);   // never closer than a body width: no standing inside each other

        // Footwork against a real threat (they swing back and can reach us):
        // step in, back off, hop. Never instead of a swing that would land.
        const threat = !passive && opp.cd <= 4 && dist < theirs + 30;
        if (dist < 170 && vgap < 40 && threat && !(hitDir && me.attackCooldown <= 0)) {
            const fw = this.footwork;
            if (!fw || this.frame >= fw.until) {
                const r = Math.random();
                this.footwork = {
                    kind: r < 0.55 ? 'hold' : r < 0.75 ? 'out' : r < 0.95 ? 'in' : 'hop',
                    until: this.frame + 16 + Math.floor(Math.random() * 40)
                };
            }
            const f = this.footwork.kind;
            if (f === 'out') want += 30;
            else if (f === 'in' && !outgunned) want -= 14;
            else if (f === 'hop' && me.grounded && !it.attack && this.frame - (this.lastHop || -999) > 80) {
                it.jump = { kind: 'plan', plan: BotSim.plan(0, 999, 0, 0, 6) };
                this.lastHop = this.frame;
            }
        }

        // Get onto the side that knocks them toward a deadly edge, or escape ours,
        // but only when the far side actually has more floor (no ping-pong hopping
        // on small platforms)
        const better = this.roomPast(opp, toward) > this.edgeRoom(-toward) + 40;
        // ...and never straight back over them again a moment later
        const reversal = this.lastOverDir === -toward && this.frame - (this.lastOver || -999) < 240;
        const canHop = me.grounded && better && !reversal && !passive && this.frame - (this.lastOver || -999) > 100 && this.skill('crossup');
        const rushHop = this.strategy === 'rushdown' && canHop && dist < 120 && opp.cd > 2 && Math.random() < 0.3;
        if (rushHop || (canHop && push && Math.sign(dx) !== push && dist < 170 && vgap < 30 && (opp.cd > 6 || dist > theirs + 10))) {
            it.jump = { kind: 'over', dir: toward, target: opp };
        } else if (canHop && (danger || (outgunned && this.edgeRoom(-toward) < 50)) && !it.attack) {
            it.jump = { kind: 'over', dir: toward, target: opp };
        }
        // A cloud flier lasers along its own height: get under them and keep
        // hopping so the beam (10px tall) keeps missing
        if (opp.onCloud) {
            want = 10;
            if (me.grounded && !it.jump && Math.abs(me.y - opp.y) < 40 && this.frame - (this.lastHop || -999) > 45) {
                it.jump = { kind: 'plan', plan: BotSim.plan(toward, 999, toward, 0, 40) };
                this.lastHop = this.frame;
            }
        }
        // They're hovering just above us (cloud, wings, a big jump): jump up and hit them
        const above = me.y - (opp.y + opp.height);
        if (!it.attack && !it.jump && me.grounded && dist < 110 && above > -10 && above < 170 &&
            (opp.onCloud || !opp.grounded) && this.frame - (this.lastHop || -999) > 30) {
            it.jump = { kind: 'plan', plan: BotSim.plan(Math.sign(dx) || 0, 999, Math.sign(dx) || 0, 0, 40) };
            this.lastHop = this.frame;
        }
        it.goalX = oc - toward * want;
        // They are seen a reaction time late, so aiming at where they were can send us straight through where
        // they are now. On their level, never aim past their real position: stay on our own side of them.
        const real = opp.ref;
        if (real && !real.isDead && vgap < 40 && !opp.onCloud && !me.isBird && !me.onCloud && !(it.jump && it.jump.kind === 'over')) {
            const rc = BotSim.cx(real), mySide = mc === rc ? (this.lastToward ? -this.lastToward : 1) : Math.sign(mc - rc);
            it.goalX = mySide > 0 ? Math.max(it.goalX, rc + 32) : Math.min(it.goalX, rc - 32);
        }
        it.goalNode = this.nodeOf(opp);
        it.stop = 3;
        if (!it.face) it.face = toward;
    },

    // Shooter / dagger: keep range, crouch-fire low shots that hit standing and
    // crouching targets alike, hop over them if cornered
    tacticRanged(it, opp) {
        const me = this.body;
        it.mode = 'ranged';
        const mc = BotSim.cx(me), oc = BotSim.cx(opp);
        const dx = oc - mc, dist = Math.abs(dx);
        const toward = dx === 0 ? me.facing : Math.sign(dx);
        if (dist < 70 && me.grounded && this.frame - (this.lastOver || -999) > 100 && this.edgeRoom(-toward) < 70 &&
            !(this.lastOverDir === -toward && this.frame - this.lastOver < 240) &&
            this.roomPast(opp, toward) > this.edgeRoom(-toward) + 40) {
            it.jump = { kind: 'over', dir: toward, target: opp };
        }
        // Stand at a distance that suits the weapon's real reach (boomerang and
        // shotgun close, rifles far), and outside theirs when ours is longer
        const mine = WeaponDefs.range(me.weapon.def);
        const oppDef = WeaponDefs.of(opp);
        const theirR = oppDef.kind === 'shot' ? WeaponDefs.range(oppDef) : this.reachOf(opp);
        let want;
        if (mine < 260) {
            // Short gun (flamethrower, shotgun, kunai...): chase them down, fire up close
            want = Math.max(50, mine * 0.45);
            it.goalX = oc - toward * (want + this.jitter * 2);
            it.goalNode = dist < want ? -1 : this.nodeOf(opp);
        } else {
            // Long gun: the whole point is never letting them close in. Hold range
            // (more of it when we're the one losing on health), shoot from where we
            // stand when the shot lines up, otherwise move to a spot level with
            // them at our range, and back off from anyone who can reach us.
            want = Math.max(140, Math.min(380, mine * 0.6));
            if (theirR + 50 < mine * 0.9) want = Math.max(want, Math.min(380, theirR + 60));
            if (me.health < opp.health) want = Math.min(460, want + 80);
            // Only something that can rush us (a melee weapon or a short gun) is a
            // reason to back off; a rifle duel is won by lining up, not retreating
            const threatR = oppDef.kind === 'shot' ? (theirR < 260 ? theirR : 0) : this.reachOf(opp);
            const tooClose = !this.isPassive(opp) && dist < Math.max(threatR + 60, want * 0.55);
            if (this.frame >= (this.lineCheckAt || 0)) {
                this.lineCheckAt = this.frame + 4;
                this.lineClear = this.shotHitTime(opp, toward, false) >= 0 || this.shotHitTime(opp, toward, true) >= 0;
            }
            if (tooClose) {
                it.goalX = mc - toward * 150;            // back away from them on our own ground
                it.goalNode = -1;
            } else if (this.lineClear) {
                it.goalX = mc + Math.sin(this.frame / 20 + me.id) * 70;   // lined up: shoot while swaying, never frozen
                it.goalNode = -1;
            } else {
                const spot = this.firingSpot(opp, want);
                if (spot) { it.goalX = spot.x; it.goalNode = spot.node; }
                else {
                    // Nowhere better: hold our distance rather than walk into them
                    it.goalX = Math.abs(oc - mc) > want ? mc : oc - toward * want;
                    it.goalNode = -1;
                }
            }
        }
        it.stop = 14;
        it.face = toward;
        this.rangedFire(it, opp);
    },

    // The cheapest place to shoot opp from with a long gun: a platform level with
    // their feet (straight shots line up), at about our range, never close to them
    firingSpot(opp, want) {
        const nav = this.nav, me = this.body;
        if (!nav.ready) return null;
        const key = 'spot:' + (opp.ref ? opp.ref.id : 'x');
        const c = this.cache.get(key);
        if (c && this.frame - c.frame < 20) return c.v;
        const plats = this.game.level.platforms;
        const here = nav.supportIndex(me) >= 0 ? nav.supportIndex(me) : nav.nodeBelow(BotSim.cx(me), me.y + me.height);
        const feet = opp.y + opp.height, oc = BotSim.cx(opp);
        // Straight shots leave the muzzle at a fixed height: stand where that height
        // lands on their body. Lobbed shots (arrows, grenades, bombs) are forgiving.
        const def = me.weapon.def, spec = def.proj;
        const m = def.muzzle[1];
        const lob = spec.gravity > 0 || spec.lift < 0 || spec.homing;
        const okHeight = (top) => lob ? Math.abs(top - feet) < 110 : (feet - top >= m - 50 && feet - top <= m - 4);
        let best = null;
        plats.forEach((p, i) => {
            if (!nav.standable(p) || p.motion || !okHeight(p.y)) return;
            for (const side of [-1, 1]) {
                const x = Math.max(p.x + 20, Math.min(p.x + p.width - 20, oc + side * want));
                const d = Math.abs(x - oc);
                if (d < Math.max(140, want * 0.55)) continue;
                let cost;
                if (i === here) cost = Math.abs(x - BotSim.cx(me)) / me.speed;
                else {
                    const r = here >= 0 ? nav.route(here, i, me.x, this.bannedEdges()) : null;
                    if (!r) continue;
                    cost = r.cost + Math.abs(x - r.landX) / me.speed;
                }
                cost += Math.abs(d - want) * 0.1;
                if (!best || cost < best.cost) best = { node: i, x, cost };
            }
        });
        this.cache.set(key, { frame: this.frame, v: best });
        return best;
    },

    rangedFire(it, opp) {
        const me = this.body;
        if (me.attackCooldown > 0 || !me.weapon) return;
        const wdef = me.weapon.def;
        // A boomerang has to come back before it can be thrown again
        if (wdef.oneAtATime && this.game.projectiles.some(q => q.active && q.owner === me && q.spec === wdef.proj)) return;
        const toward = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
        if (wdef.kind === 'beam') {   // the staff: a laser along the line, fired when they're in it
            if (this.laserHits(opp, toward)) { it.attack = true; it.face = toward; }
            return;
        }
        const tries = [];
        if (this.skill('crouchFire') && me.grounded && me.facing === toward) tries.push(true);
        tries.push(false);
        for (const low of tries) {
            const t = this.shotHitTime(opp, toward, low);
            if (t < 0) continue;
            const def = me.weapon.def;
            const patience = def.proj.blast ? def.proj.life : Math.max(40, Math.min(70, def.proj.life * 0.6));
            if (isFinite(def.durability) && t > patience) continue;   // save ammo for shots that land soon
            if (def.proj.blast && Math.abs(BotSim.cx(opp) - BotSim.cx(me)) < def.proj.blast.radius * 0.8) continue;   // too close to blast
            it.attack = true;
            it.face = toward;
            it.crouch = low;
            if (low) it.goalX = null;
            return;
        }
    },

    // Magic stick: hover level with them at laser range and keep firing
    tacticCloud(it, opp) {
        const me = this.body, level = this.game.level;
        it.mode = 'cloud';
        if (!opp) { it.fly = { x: level.width / 2 - me.width / 2, y: 120 }; return; }
        if (opp.isBird) { this.tacticCloudAngel(it, opp); return; }
        const mc = BotSim.cx(me), oc = BotSim.cx(opp);
        const toward = oc >= mc ? 1 : -1;
        let side = mc < oc ? -1 : 1;
        let tx = oc + side * 250;
        if (tx < 40 || tx > level.width - 40) { side = -side; tx = oc + side * 250; }
        // Imperfect hover: the aim height drifts, so the beam often misses
        if (this.frame >= (this.flyJitterUntil || 0)) {
            this.flyJitter = (Math.random() - 0.5) * 110 * (1.1 - this.profile.aggression);
            this.flyJitterUntil = this.frame + 40 + Math.floor(Math.random() * 40);
        }
        let ty = opp.y + this.flyJitter;                          // our beam = roughly their chest
        if (Math.abs(oc - mc) < 130) ty = opp.y - 150;           // too close to their fists
        ty = Math.max(10, Math.min(level.height - 80, ty));
        it.fly = { x: tx - me.width / 2, y: ty };
        it.face = toward;
        // Fires only some of the time it's lined up
        if (me.attackCooldown <= 0 && this.laserHits(opp, toward) && Math.random() < Math.pow(this.profile.aggression, 1.5) * 0.85) it.attack = true;
    },

    // Angel: lead the target instead of trailing it, cut across circles, come in
    // off a shooter's firing line, ride them for contact damage and blast when
    // it rings them out or shuts a gunner down
    tacticBird(it, opp) {
        const me = this.body, P = this.profile;
        it.mode = 'bird';
        if (!opp) { it.fly = { x: this.game.level.width / 2, y: 150 }; return; }
        const toward = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
        const push = this.pushDir(opp) || toward;
        const d = Math.hypot(BotSim.cx(opp) - BotSim.cx(me), (opp.y + opp.height / 2) - (me.y + me.height / 2));
        const lead = Math.min(28, d / (P.fly || 6));
        let tx = opp.x + opp.velocity.x * lead, ty = opp.y + opp.velocity.y * lead;
        // Not closing in? They're running circles: aim at the middle of their loop
        if (this.chaseRef !== opp.ref) { this.chaseRef = opp.ref; this.chaseBest = d; this.chaseSince = this.frame; }
        if (d < this.chaseBest - 15) { this.chaseBest = d; this.chaseSince = this.frame; }
        if (this.frame - this.chaseSince > 70) {
            const h = this.history.get(opp.ref);
            if (h && h.length > 20) {
                let sx = 0, sy = 0;
                for (const q of h) { sx += q.x; sy += q.y; }
                tx = sx / h.length; ty = sy / h.length;
            }
            if (this.frame - this.chaseSince > 140) { this.chaseBest = d; this.chaseSince = this.frame; }
        }
        const shooter = opp.onCloud || WeaponDefs.isShot(opp.weapon);
        if (shooter && d > 130) ty = opp.y + (opp.y > 170 ? -95 : 95);   // stay off their line of fire
        else if (me.attackCooldown <= 4 && d < 160) tx = opp.x - push * 40;  // line up the blast on the inward side
        if (this.frame >= (this.flyJitterUntil || 0)) {
            this.flyJitter = (Math.random() - 0.5) * 70 * (1.1 - P.aggression);
            this.flyJitterUntil = this.frame + 40 + Math.floor(Math.random() * 40);
        }
        it.fly = { x: tx + this.flyJitter, y: ty + this.flyJitter * 0.5 };
        it.face = toward;
        if (me.attackCooldown <= 0 && d < 140) {
            const a = Math.atan2(opp.y - me.y, opp.x - me.x);
            const lethal = this.knockLethal(opp, 1, Math.cos(a) * 20, Math.sin(a) * 20);
            const outward = Math.sign(opp.x - me.x) === push && Math.abs(Math.sin(a)) < 0.6;
            const A = P.aggression;
            let chance = lethal || outward ? 0.35 + 0.6 * A : opp.shield ? 0.02 : 0.08 + 0.3 * A;
            if (shooter) chance = Math.max(chance, 0.2 + 0.5 * A);
            if (Math.random() < chance) it.attack = true;
        }
    },

    // Fighting the angel. It takes a fifth of the damage, burns anyone touching
    // it, and its blast (150px, 20 damage, big knockback) recharges in a third of
    // a second. So: shoot it from just outside the blast with a gun; bare-handed,
    // wait out of range while the blast is charged, dart in right after it fires,
    // strike (jumping up if it hovers), and never stand inside it.
    tacticAngel(it, opp) {
        const me = this.body;
        it.mode = 'angel';
        const mc = BotSim.cx(me), oc = BotSim.cx(opp);
        const dx = oc - mc, dist = Math.abs(dx);
        const toward = dx === 0 ? me.facing : Math.sign(dx);
        const rise = (me.y + me.height / 2) - (opp.y + opp.height / 2);   // > 0: it's above us
        if (me.weapon && WeaponDefs.isShot(me.weapon.type)) {
            // Gunners circle the angel's ground track, firing whenever the ring brings them in line
            const R = 220 + this.jitter, th = this.frame * 0.03 + me.id * 1.3;
            it.goalX = oc + Math.cos(th) * R;
            it.goalNode = -1;
            it.stop = 6;
            it.face = toward;
            this.rangedFire(it, opp);
            return;
        }
        const reach = this.reachOf(me);
        // Go in when it has just blasted, or behind a charged shield (the
        // shield model raises it as the blast comes); back off while it recharges
        const shieldReady = me.shieldActive || (!(me.shieldCd > 0) && !me.shieldLatch);
        const opening = opp.cd > 8 || shieldReady;
        const hitDir = this.meleeDir(opp);
        if (hitDir && me.attackCooldown <= 0 && (opening || dist < reach)) { it.attack = true; it.face = hitDir; }
        let want = opening ? reach - 14 : 190 + this.jitter;
        if (dist < 34 && Math.abs(rise) < 60 && !me.shieldActive) want = 120;   // inside it unshielded: get out
        if (opening && me.grounded && dist < 120 && rise > 40 && rise < 190 && this.frame - (this.lastHop || -999) > 25) {
            it.jump = { kind: 'plan', plan: BotSim.plan(Math.sign(dx) || 0, 999, Math.sign(dx) || 0, 0, 40) };
            this.lastHop = this.frame;
        }
        // Keep away from our ledges: its knockback rings people out
        const i = this.nav.ready ? this.nav.supportIndex(me) : -1;
        let gx = oc - toward * want;
        if (i >= 0) {
            const p = this.game.level.platforms[i];
            if (p.width > 160) gx = Math.max(p.x + 60, Math.min(p.x + p.width - 60, gx));
        }
        it.goalX = gx;
        it.goalNode = -1;
        it.stop = 6;
        if (!it.face) it.face = toward;
    },

    // They're off the stage: hold the ledge they're coming back to and hit them
    // as they arrive so they get knocked back out
    tacticEdgeguard(it, opp) {
        const me = this.body;
        it.mode = 'edgeguard';
        const i = this.nav.supportIndex(me);
        const p = this.game.level.platforms[i];
        const side = BotSim.cx(opp) < p.x + p.width / 2 ? -1 : 1;
        const edge = side < 0 ? p.x : p.x + p.width;
        it.goalX = edge - side * (me.width / 2 + 6);
        it.goalNode = i;
        it.stop = 3;
        it.face = side;
        if (WeaponDefs.isShot(this.weaponType(me))) { this.rangedFire(it, opp); return; }
        const hitDir = this.meleeDir(opp);
        if (hitDir && me.attackCooldown <= 0) { it.attack = true; it.face = hitDir; }
    },

    tacticFetch(it, prize, opp) {
        const me = this.body, w = prize.w;
        it.mode = 'fetch';
        // Don't chase one prize forever (blocked, contested, or just out of reach)
        const falling = prize.land.y > w.y + 1;
        if (this.fetchW !== w || falling) { this.fetchW = w; this.fetchSince = this.frame; }
        else if (this.frame - this.fetchSince > (w.type === 'bird_crystal' ? 600 : 480)) this.prizeBan.set(w, this.frame + 900);
        it.goalX = prize.land.x + w.width / 2;
        it.goalNode = this.nav.ready ? this.nav.nodeBelow(it.goalX, prize.land.y + w.height) : -1;
        // Not getting any closer (blocked, or it sits on something we can't stand on)?
        const d = Math.abs(it.goalX - BotSim.cx(me)) + Math.abs(prize.land.y + w.height - (me.y + me.height));
        if (this.fetchW !== this.fetchProgW || d < this.fetchBest - 20) { this.fetchProgW = this.fetchW; this.fetchBest = d; this.fetchBestAt = this.frame; }
        else if (this.frame - this.fetchBestAt > 100 && me.grounded && !falling && w.type !== 'bird_crystal' && !(this.onBouncer(w, prize.land) && w.y > me.y + me.height - 4 && this.frame - this.fetchBestAt < 260)) this.prizeBan.set(w, this.frame + 600);
        it.stop = 4;
        // A sealed crystal can't be taken yet: wait right under where it lands
        it.snatch = me.weapon || w.lock > 40 ? null : w;
        // Holding something already: stand on it and crouch to swap (the crystal swaps
        // as it comes down onto us)
        if (prize.swap && Math.abs(it.goalX - BotSim.cx(me)) < 14 && me.grounded) {
            const resting = Math.abs(prize.land.y + w.height - (me.y + me.height)) < 6;
            const comingDown = w.type === 'bird_crystal' && w.y + w.height > me.y - 100 && w.y < me.y + me.height;
            if (resting || comingDown) { it.crouch = true; it.goalX = null; return; }
        }
        if (opp && me.weapon && WeaponDefs.isShot(me.weapon.type)) this.rangedFire(it, opp);
        else if (opp) {
            const hitDir = this.meleeDir(opp);
            if (hitDir && me.attackCooldown <= 0) { it.attack = true; it.face = hitDir; }
        }
    },

    // Round won (or nobody left to fight): people don't freeze, they show off
    tacticCelebrate(it) {
        const me = this.body, level = this.game.level;
        it.mode = 'celebrate';
        if (!this.party || this.frame >= this.party.until) {
            const r = Math.random();
            this.party = {
                kind: r < 0.35 ? 'stroll' : r < 0.6 ? 'hop' : r < 0.8 ? 'bob' : 'swing',
                until: this.frame + 20 + Math.floor(Math.random() * 45),
                x: BotSim.cx(me) + (Math.random() - 0.5) * 240,
                face: Math.random() < 0.5 ? -1 : 1
            };
        }
        const P = this.party;
        if (me.isBird || me.onCloud) {
            const a = this.frame * 0.05;
            it.fly = { x: P.x + Math.cos(a) * 110, y: Math.max(60, Math.min(level.height - 140, me.y + Math.sin(a) * 40 - 4)) };
            return;
        }
        if (P.kind === 'stroll') { it.goalX = P.x; it.stop = 8; }
        else if (P.kind === 'hop' && me.grounded && this.frame - (this.lastHop || -999) > 22) {
            it.jump = { kind: 'plan', plan: BotSim.plan(0, 999, 0, 0, 8) };
            this.lastHop = this.frame;
        } else if (P.kind === 'bob') it.crouch = this.frame % 16 < 8;
        else if (P.kind === 'swing') { it.attack = this.frame % 24 === 0; it.face = this.frame % 48 < 24 ? P.face : -P.face; }
    },

    tacticIdle(it) {
        const level = this.game.level;
        it.mode = 'idle';
        it.goalX = level.width / 2;
        it.goalNode = this.nav.ready ? this.nav.nodeBelow(level.width / 2, level.height * 0.5) : -1;
        it.stop = 30;
    },

    // Duck or jump incoming bullets / shockwaves (verified by simulation)
    dodgeProjectiles(it, projs) {
        const me = this.body;
        if (!me.grounded || this.plan || !projs.length) return;
        const mc = BotSim.cx(me);
        const incoming = projs.map(pr => this.pathOf(pr));
        const mdir = it.goalX === null ? 0 : (Math.sign(it.goalX - mc) || 0);
        const stay = BotSim.plan(mdir, 999, mdir);
        if (it.crouch) stay.crouch = 999;
        const t = BotSim.hitBy(me, stay, this.world, incoming, 45);
        if (t < 0) return;
        // 1) duck under it
        const duck = BotSim.plan(0, 999, 0);
        duck.crouch = t + 6;
        if (BotSim.hitBy(me, duck, this.world, incoming, Math.min(45, t + 12)) < 0) {
            if (it.attack && it.face && it.face !== me.facing) it.attack = false;   // turning means standing up
            it.crouch = true;
            it.dodging = true;
            it.face = me.facing;
            it.goalX = null;
            return;
        }
        // 2) jump it, timed so we're in the air as it passes
        for (const j of [0, 2, 4, 7, 10]) {
            if (j >= t) break;
            for (const d of [0, mdir, -mdir]) {
                const hop = BotSim.plan(d, 999, d, j, 40);
                if (BotSim.hitBy(me, hop, this.world, incoming, 45) >= 0) continue;
                const land = BotSim.run(me, hop, this.world, 160);
                if (land.dead || !land.landed) continue;
                it.jump = { kind: 'plan', plan: hop };
                it.crouch = false;
                it.dodging = true;
                return;
            }
        }
        // 3) run out from under it (bouncing bombs, rockets, seekers)
        const here = this.nav.supportIndex(me);
        for (const d of [-mdir || -1, mdir || 1]) {
            const run = BotSim.plan(d, 24, 0);
            if (BotSim.hitBy(me, run, this.world, incoming, 45) >= 0) continue;
            const end = BotSim.run(me, run, this.world, 60);
            if (end.dead || !end.landed || (here >= 0 && end.landed.src !== this.game.level.platforms[here])) continue;
            it.goalX = mc + d * 150;
            it.goalNode = -1;
            it.jump = null;
            it.crouch = false;
            it.attack = false;
            it.dodging = true;
            return;
        }
        // can't avoid it: applyDefense may still time the shield for it
    },

    // The shield lasts 1 second and then needs 2 to recharge, so it's a timing
    // read: estimate how many frames until something actually hits us, raise it
    // just for that, and drop it once the danger has passed (the recharge only
    // starts on release). Each threat gets one read, made with the tier's skill.
    applyDefense(it, opp, projs) {
        const me = this.body, P = this.profile;
        let soon = Infinity;
        // A projectile we've noticed whose path meets our body
        for (const pr of projs) {
            const path = this.pathOf(pr);
            for (let k = 0; k < 24; k++) {
                const s = path[k];
                if (s && s.x > me.x - 4 - s.r && s.x < me.x + me.width + 4 + s.r && s.y > me.y - 4 - s.r && s.y < me.y + me.height + 4 + s.r) {
                    soon = Math.min(soon, k + 1);
                    break;
                }
            }
        }
        if (opp) {
            const dist = Math.abs(BotSim.cx(opp) - BotSim.cx(me));
            const facingUs = opp.facing === (BotSim.cx(me) >= BotSim.cx(opp) ? 1 : -1);
            const level = Math.abs((opp.y + opp.height / 2) - (me.y + me.height / 2));
            if (opp.isBird) {
                if (dist < 170 && level < 170 && opp.cd <= 3) soon = Math.min(soon, Math.max(1, opp.cd));   // blast is coming
            } else if (opp.onCloud) {
                if (dist < 420 && level < 30 && facingUs && opp.cd <= 2) soon = Math.min(soon, 2);       // lined up with the beam
            } else if (WeaponDefs.of(opp).kind !== 'shot' && dist < this.reachOf(opp) + 10 && BotSim.vgap(me, opp) < 30 && facingUs && opp.cd <= 2) {
                // In their reach while they're ready: will they swing? Their habits say how likely
                const m = this.models.get(opp.ref);
                const swingy = m ? Math.min(1, m.aggr * 25) : 0.5;
                if (this.frame >= (this.swingReadUntil || 0)) {
                    this.swingRead = Math.random() < 0.2 + 0.8 * swingy;
                    this.swingReadUntil = this.frame + 12;
                }
                if (this.swingRead) soon = Math.min(soon, 2);
            }
        }
        if (me.shieldActive) {
            if (soon <= 20) it.shield = true;   // keep it up while it's still coming
            return;
        }
        if (soon > 10 || me.shieldCd > 0 || me.shieldLatch) return;
        // One read per incoming threat: right often for top tiers, rarely for rookies
        if (this.frame >= (this.shieldReadUntil || 0)) {
            this.shieldRead = Math.random() < P.skills.shield;
            this.shieldReadUntil = this.frame + 18;
        }
        if (this.shieldRead) it.shield = true;
    },

    // How likely a connecting swing is to be thrown right now, by the situation and the bot's style
    swingChance(opp, dir, c) {
        const me = this.body, A = this.profile.aggression;
        const ringOut = c.lethalRead && this.knockLethal(opp, dir, c.myDef.knock, c.myDef.lift);
        let p;
        if (ringOut || c.passive) p = 1;                                       // a sitting duck: swing on every cooldown
        else if (opp.shield) p = 0.05;                                          // 10% damage: wait for it to drop, then punish the recharge
        else if (opp.cd > 4 || opp.shieldCd > 0) p = this.skill('punish') ? 1 : A * 0.5;   // they can't answer
        else if (c.outgunned) p = 0.12 * A;                                     // don't trade into a bigger weapon
        else if (c.danger) p = 0.5 + A * 0.5;                                   // clear space
        else if (this.situation === 'finisher') p = Math.min(1, A * 1.2);              // one more hit ends it
        else if (this.strategy === 'rushdown') p = Math.min(1, A * 1.1);
        else if (this.strategy === 'counter') p = 0.25 * A;                            // the punish (above) is the plan
        else if (this.strategy === 'zone') p = Math.abs(BotSim.cx(opp) - BotSim.cx(me)) > c.reach - 26 ? A : 0.4 * A;   // only from the tip
        else if (this.strategy === 'pressure' || c.reach > c.theirs + 8) p = A;
        else if (dir === c.push) p = 0.75 * A;
        else p = (this.strategy === 'bait' ? 0.35 : 0.6) * A;
        // Heavy, slow weapons leave you open after a whiff: swing them on openings, not on a whim
        const slow = c.myDef.cooldown >= 26 && c.myDef !== PUNCH;
        if (slow && !ringOut && opp.cd <= 4 && !c.passive && !(opp.shieldCd > 0)) p *= 0.45;
        return p;
    },

    // Thinking happens every few frames, but a swing can open up on any frame (they step into reach).
    // Take it then, at the same overall rate, instead of waiting for the next think tick.
    swingBetween() {
        const it = this.intent, me = this.body;
        if (!it || it.mode !== 'melee' || it.attack || it.dodging || !(this.swingP > 0) || me.attackCooldown > 0 || !this.target) return;
        if (this.frame < this.hesitateUntil || me.shieldActive) return;
        const opp = this.perceive(this.target.ref);
        if (!opp || opp.dead || Math.abs(BotSim.cx(opp) - BotSim.cx(me)) > 110) return;
        const dir = this.meleeDir(opp);
        if (!dir) return;
        const perFrame = 1 - Math.pow(1 - Math.min(0.999, this.swingP), 1 / 8);
        if (Math.random() < perFrame * (1 - this.profile.noise * 0.5)) { it.attack = true; it.face = dir; }
    },

    // Lower difficulties hesitate and fumble now and then
    applyNoise(it) {
        const n = this.profile.noise;
        if (n <= 0 || it.mode === 'fetch') return;   // fumbling never gets in the way of picking something up
        if (it.attack && Math.random() < n) it.attack = false;
        if (it.jump && Math.random() < n) it.jump = null;
        if (it.crouch && Math.random() < n * 0.5) it.crouch = false;
    }
});
