// Situational thinking on top of the tactic chain in BotBrain.decide. Before each decision the bot
// reads the situation (health, kit, statuses, teammates, hazards) and may switch to one of these
// plans, which the tactics read (this.situation) or which reshape the chosen intent afterwards:
//
//   finisher      the target is nearly dead and reachable: all in, swing on every opening
//   disengage     we're losing badly (low health, outgunned): fall back to the safest far platform
//   kiteDot       the target is burning or poisoned: keep out of reach and let it tick
//   punishStatus  the target is stunned or frozen: close in and hit now
//   protectAlly   a teammate is low and being hit: go after whoever is hitting them
//   regroup       outnumbered and our teammate is far: move toward them
//   mineLayer     holding mines with nobody close: plant them where the target will walk
//   ambush        the target walks right under our platform: drop on them swinging
//   lobber        blast / lobbed weapons: fight from a spacing the arc can actually land at
//   counterPick   prefer the dropped weapon that beats what the target holds (in bestPrize)
//
// Every read is a general rule over measured quantities (health, dps, reach, distance), never a
// special case for one map or weapon.
(() => {
    const P = BotBrain.prototype;

    P.readSituation = function (game) {
        const me = this.body, opp = this.target;
        if (!opp || me.isBird || me.onCloud || opp.isBird) return null;
        const dist = Math.abs(BotSim.cx(opp) - BotSim.cx(me)), vgap = BotSim.vgap(me, opp);
        const myHp = me.health / me.maxHealth, theirHp = opp.health / (opp.maxHealth || 100);
        const myDef = WeaponDefs.of(me), oppDef = WeaponDefs.of(opp);
        const myDps = myDef.kind === 'shot' ? this.shotDps(myDef) : this.meleeDps(me);
        const theirDps = oppDef.kind === 'shot' ? this.shotDps(oppDef) : this.meleeDps(opp);
        if (this.difficulty === 'hack' && myHp < 0.58) {
            const now = performance.now();
            const nearbyEnemies = game.players.filter(p => p !== me && !p.isDead && p.team !== me.team &&
                Math.hypot(BotSim.cx(p) - BotSim.cx(me), p.y - me.y) < 360).length;
            const recentlyHit = me.lastAttacker && now - (me.lastAttackerAt || 0) < 1400;
            if (nearbyEnemies >= 2 || (nearbyEnemies && recentlyHit && theirHp > myHp + 0.08)) {
                return { k: 'disengage', urgent: myHp < 0.4 || nearbyEnemies >= 2 };
            }
        }
        // Team play first: a teammate in trouble outranks our own duel
        if (game.teamMode) {
            const ally = game.players.find(p => p !== me && !p.isDead && p.team === me.team);
            if (ally) {
                const attacker = ally.lastAttacker && !ally.lastAttacker.isDead && ally.lastAttacker.team !== me.team && performance.now() - (ally.lastAttackerAt || 0) < 2000 ? ally.lastAttacker : null;
                if (attacker && ally.health < ally.maxHealth * 0.4 && attacker !== opp.ref && Math.abs(attacker.x - me.x) < 700) return { k: 'protectAlly', who: attacker };
                const near = game.players.filter(p => !p.isDead && p.team !== me.team && Math.hypot(p.x - me.x, p.y - me.y) < 260).length;
                if (near >= 2 && Math.abs(ally.x - me.x) > 450) return { k: 'regroup', ally };
            }
        }
        if (opp.stunned || opp.frozen) return { k: 'punishStatus' };
        if (theirHp < 0.2 && dist < 360 && vgap < 140 && myHp > 0.15) return { k: 'finisher' };
        if (myHp < 0.25 && theirDps > myDps * 1.5 + 8 && theirHp > myHp + 0.2 && !this.isPassive(opp)) return { k: 'disengage' };
        if (opp.dot && myDef.kind === 'melee' && myHp < theirHp + 0.3 && dist < 260) return { k: 'kiteDot' };
        const spec = myDef.proj;
        if (spec && spec.stick && dist > 160) return { k: 'mineLayer' };
        if (spec && (spec.blast || (spec.lift < -3 && spec.gravity > 0.15))) return { k: 'lobber' };
        const below = opp.y - (me.y + me.height);
        if (myDef.kind !== 'shot' && me.grounded && below > 50 && below < 220 && dist < 140 && opp.grounded) return { k: 'ambush' };
        return null;
    };

    // The safest platform far from the threat that we can actually reach (cached ~1s)
    P.retreatSpot = function (opp) {
        const nav = this.nav, me = this.body;
        if (!nav.ready) return null;
        const c = this.retreatCache;
        if (c && this.frame - c.frame < 60) return c.v;
        const plats = this.game.level.platforms, here = nav.supportIndex(me) >= 0 ? nav.supportIndex(me) : nav.nodeBelow(BotSim.cx(me), me.y + me.height);
        let best = null;
        plats.forEach((p, i) => {
            if (!nav.standable(p) || p.motion || p.width < 70) return;
            const x = p.x + p.width / 2, d = Math.abs(x - BotSim.cx(opp)) + Math.abs(p.y - opp.y) * 0.6;
            if (i !== here && !(here >= 0 && nav.route(here, i, me.x, this.bannedEdges()))) return;
            const score = d + p.width * 0.3 - (i === here ? 0 : 40);
            if (!best || score > best.score) best = { node: i, x, score };
        });
        this.retreatCache = { frame: this.frame, v: best };
        return best;
    };

    // Reshape the chosen intent for plans that are about where to stand
    P.applySituation = function (it, game) {
        const sit = this.sitInfo, me = this.body, opp = this.target;
        if (!sit || !opp || !['melee', 'ranged', 'idle', 'lurk'].includes(it.mode)) return;
        it.situation = sit.k;
        switch (sit.k) {
            case 'disengage': {
                const spot = this.retreatSpot(opp);
                if (spot && (sit.urgent || !it.attack)) {
                    it.goalX = spot.x; it.goalNode = spot.node; it.stop = 10;
                    if (sit.urgent) { it.attack = false; it.jump = null; it.snatch = null; it.crouch = false; }
                }
                // block anything coming while we back off
                if (Math.abs(BotSim.cx(opp) - BotSim.cx(me)) < this.reachOf(opp) + 30 && opp.cd <= 4 && this.skill('shield')) it.shield = true;
                break;
            }
            case 'regroup':
                if (!it.attack) { it.goalX = sit.ally.x + sit.ally.width / 2 + (me.x < sit.ally.x ? -40 : 40); it.goalNode = this.nodeOf(sit.ally); }
                break;
            case 'mineLayer': {
                // plant a mine a little ahead of the target, on our side of them
                const toward = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
                if (me.attackCooldown <= 0 && me.grounded && Math.abs(opp.y - me.y) < 120 && Math.random() < 0.25) { it.attack = true; it.face = toward; }
                break;
            }
            case 'lobber': {
                // arcs and blasts need room: hold 200-320px, never inside our own blast
                const d = Math.abs(BotSim.cx(opp) - BotSim.cx(me)), toward = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
                if (d < 190 && !it.attack) { it.goalX = BotSim.cx(me) - toward * 120; it.goalNode = -1; }
                else if (d > 340 && !it.attack) { it.goalX = BotSim.cx(opp) - toward * 280; }
                break;
            }
            case 'ambush': {
                // step off the edge above them; the swing lands as we drop
                const toward = BotSim.cx(opp) >= BotSim.cx(me) ? 1 : -1;
                it.goalX = BotSim.cx(opp); it.goalNode = -1; it.allowEdge = true; it.face = toward;
                if (me.attackCooldown <= 0 && !me.grounded && Math.abs(BotSim.cx(opp) - BotSim.cx(me)) < this.reachOf(me)) it.attack = true;
                break;
            }
        }
    };

    // Wrap the decision: read the situation first (tactics consult this.situation), then reshape
    const decideBase = P.decide;
    P.decide = function (game) {
        // A new opponent: open with the style that suits them (what we know of them, and what has worked)
        if (this.target && this.target.ref !== this.stratFor && this.profile.adapt) {
            this.stratFor = this.target.ref;
            const prior = this.strategyPrior();
            let best = this.strategy, bv = -Infinity;
            for (const k in this.strategyStats) { const v = (prior[k] || 0) + this.strategyStats[k].avg + Math.random() * 0.15; if (v > bv) { bv = v; best = k; } }
            this.strategy = best;
        }
        this.sitInfo = this.readSituation(game);
        this.situation = this.sitInfo ? this.sitInfo.k : null;
        // Protecting a teammate: fight the one hitting them
        if (this.sitInfo && this.sitInfo.k === 'protectAlly') {
            const seen = this.perceive(this.sitInfo.who);
            if (seen && !seen.dead) this.target = seen;
        }
        const it = decideBase.call(this, game);
        this.applySituation(it, game);
        return it;
    };

    // Counter-pick: prefer a dropped weapon that beats what our target is holding
    const prizeBase = P.bestPrize;
    P.bestPrize = function (game, opp) {
        const best = prizeBase.call(this, game, opp);
        if (!best || !opp || best.urgent) return best;
        const oppDef = WeaponDefs.of(opp);
        const score = (type) => {
            const d = WEAPONS[type]; if (!d) return 0;
            let s = 0;
            if (oppDef.kind === 'shot' && WeaponDefs.range(oppDef) > 260) s += d.kind === 'shot' ? 12 : (d.dash ? 14 : 0);       // a rifle: shoot back, or close the gap fast
            if (oppDef.kind === 'melee' && WeaponDefs.reach(oppDef) >= 80) s += d.kind === 'shot' ? 14 : 0;                      // a long pole: outrange it
            if (oppDef.kind === 'melee' && oppDef.cooldown <= 12) s += (d.status && (d.status.stun || d.status.freeze)) ? 12 : 0; // a fast blade: stop it cold
            if (opp.shield) s += d.shieldBreak ? 10 : 0;
            return s;
        };
        // Look for something that beats it by enough to be worth the detour
        let pick = best;
        for (const w of game.weapons) {
            if (!w.active || w.owner || w === best.w || w.type === 'bird_crystal' || (this.prizeBan.get(w) || 0) > this.frame || !this.noticed(w, game)) continue;
            const land = this.weaponRest(w, game.level);
            if (!land || land.y > w.y + 1) continue;   // only what's already on the ground
            const eta = this.etaTo(land.x + w.width / 2, land.y + w.height);
            if (!isFinite(eta) || eta > 200) continue;
            const s = (WEAPONS[w.type].value || 40) + score(w.type) - eta * 0.3;
            if (s > pick.score + score(pick.w.type) + 6) pick = { w, land, score: s, swap: !!this.body.weapon, sealed: w.lock > 0, urgent: false };
        }
        return pick;
    };
})();
