// Bots and the living parts of the map. hazards.js already makes bots get out of the way of anything that is
// about to hurt; this file gives them the rest of what a person does around map features:
//   - flee a tornado or a black hole (stronger the closer it is), jump out of a pull they cannot walk away from,
//     and once in a while dive into a black hole on purpose to get somewhere else
//   - go to a healing spring when hurt and quiet, and stay until mended
//   - ride a zipline to cross the map, use portals as shortcuts, climb on updrafts, bubbles and water spouts
//   - fire a barrel cannon at the person they want to reach
//   - jump out of quicksand
// How well they do it follows their tier (a hack-level bot reads everything, an easy one reacts late).
(() => {
    if (typeof BotBrain === 'undefined' || typeof Features === 'undefined') return;
    const K = Features.KINDS;
    const TIERK = { easy: 0.45, medium: 0.65, hard: 0.85, nightmare: 0.95, hack: 1 };
    const cx = (p) => p.x + p.width / 2, cy = (p) => p.y + p.height / 2;
    const near = (a, b) => Math.abs(a - b);

    // Everything a bot can use or must avoid this frame, gathered once per frame per level
    function scan(L) {
        const out = { pulls: Features.pullers(L), springs: [], zips: [], cannons: [], portals: [], lifts: [], sands: [] };
        for (const f of L.features) {
            if (f.kind === 'healingSpring') out.springs.push(f);
            else if (f.kind === 'zipline') out.zips.push(f);
            else if (f.kind === 'barrelCannon') out.cannons.push(f);
            else if (f.kind === 'portals') out.portals.push(f);
            else if (f.kind === 'quicksand') out.sands.push(f);
            else if (f.kind === 'bubbleColumn') out.lifts.push({ x: f.x, y: f.y, h: f.h, hw: 28, on: true });
            else if (f.kind === 'updraftFan') out.lifts.push({ x: f.x, y: f.y, h: 320, hw: 34, on: f.phase === 'active' || (f.phase === 'warn' && f.left < 20) });
            else if (f.kind === 'waterSpout') out.lifts.push({ x: f.x, y: f.y, h: 330, hw: 30, on: f.phase === 'active' });
        }
        return out;
    }

    const base = BotBrain.prototype.drive;
    BotBrain.prototype.drive = function (it) {
        this.fleeing = false;
        const me = this.body, g = this.game, L = g && g.level;
        if (!L || !L.features || !L.features.length || me.isDead || me.isBird || me.onCloud || this.difficulty === undefined) return base.call(this, it);
        const sk = TIERK[this.difficulty] || 0.6;
        const ctx = this.featScan && this.featScanFrame === this.frame ? this.featScan : (this.featScan = scan(L), this.featScanFrame = this.frame, this.featScan);
        const st = this.feat || (this.feat = { dive: new Map(), cannon: new Map(), spring: false, flee: null });
        const me_cx = cx(me), feet = me.y + me.height;
        // is somebody close enough that a fight matters more than a detour?
        let foeNear = false, foe = null, foeD = 1e9;
        for (const p of g.players) {
            if (p === me || p.isDead || p.team === me.team) continue;
            const d = Math.hypot(cx(p) - me_cx, cy(p) - cy(me));
            if (d < foeD) { foeD = d; foe = p; }
        }
        foeNear = foeD < 190;
        const intent = {};

        // ---- pulled in: tornado, black hole ----
        for (const q of ctx.pulls) {
            const dx = me_cx - q.x, dy = cy(me) - q.y, d = Math.hypot(dx, dy);
            if (d > q.rad * (0.5 + 0.5 * sk)) continue;
            if (q.kind === 'hole') {
                if (!st.dive.has(q)) st.dive.set(q, !!foe && foeD > 650 && me.health > me.maxHealth * 0.4 && Math.random() < 0.3 * sk);   // sometimes it's the quick way across
                if (st.dive.get(q)) { intent.dive = q; continue; }
            }
            const oldFlee = st.flee && st.flee.kind === q.kind ? st.flee : null;
            let fleeDir = oldFlee && this.frame < oldFlee.until
                ? oldFlee.dir
                : (oldFlee && Math.abs(dx) < 120 ? oldFlee.dir : Math.sign(dx) || me.facing || 1);
            let blocked = !!(oldFlee && oldFlee.blocked);
            // Recheck the edge periodically, then commit to that choice briefly.
            // Calling safeDir every frame can alternate between the preferred and
            // fallback directions as the pull nudges the fighter by a few pixels.
            if (!oldFlee || this.frame >= oldFlee.checkAt) {
                const preferred = fleeDir;
                const safeDir = this.safeDir ? this.safeDir(preferred) : preferred;
                const otherSafeDir = this.safeDir ? this.safeDir(-preferred) : -preferred;
                blocked = safeDir !== preferred;
                if (safeDir) fleeDir = safeDir;
                else if (otherSafeDir) fleeDir = otherSafeDir;
                else fleeDir = 0;
                st.flee = { kind: q.kind, dir: fleeDir, blocked, until: this.frame + 12, checkAt: this.frame + 8 };
            }
            intent.flee = { q, dx, dy, d, dir: fleeDir, blocked };
            this.fleeing = true;
        }
        if (!intent.flee) st.flee = null;

        // ---- healing spring ----
        const hackNeedsHeal = this.difficulty === 'hack' && me.health < me.maxHealth * 0.72;
        if (!intent.flee && !intent.dive && ctx.springs.length && (!foeNear || (hackNeedsHeal && foeD > 300))) {
            const healThreshold = this.difficulty === 'hack' ? 0.72 : 0.58;
            const hurt = me.health < me.maxHealth * (st.spring ? 0.93 : healThreshold);
            if (hurt) {
                let best = null, bd = 1e9;
                for (const f of ctx.springs) { const d = Math.abs(f.x - me_cx) + Math.abs(f.y - feet) * 1.5; if (d < bd && d < 900) { bd = d; best = f; } }
                if (best) { st.spring = true; it.goalX = best.x; it.goalNode = this.nav.ready ? this.nav.nodeBelow(best.x, best.y + 2) : -1; it.stop = 8; it.snatch = null; it.crouch = false; it.attack = false; it.mode = 'heal'; }
                else st.spring = false;
            } else st.spring = false;
        } else if (!hurtLow(me)) st.spring = false;

        // ---- crossing the map: ziplines, portals, lifts ----
        const goalFar = it.goalX !== null && it.goalX !== undefined ? it.goalX : null;
        if (goalFar !== null && me.grounded && !intent.flee && !foeNear && it.mode !== 'heal') {
            const goalY = it.goalNode >= 0 ? L.platforms[it.goalNode].y : feet;
            const dxg = goalFar - me_cx;
            // portals: step into one when the far end is much closer to where we are headed
            for (const f of ctx.portals) for (const [a, b] of [[f.a, f.b], [f.b, f.a]]) {
                if (near(a.y + 40, feet) > 40 || near(a.x, me_cx) > 520) continue;
                const gain = Math.hypot(a.x - goalFar, a.y - goalY) - Math.hypot(b.x - goalFar, b.y - goalY);
                if (gain > 420 && sk > Math.random() * 0.8) { it.goalX = a.x; it.goalNode = this.nav.ready ? this.nav.nodeBelow(a.x, a.y + 44) : -1; it.stop = 3; intent.portal = true; }
            }
            // ziplines: walk under an end whose far end is toward the goal, then push down
            if (!intent.portal && Math.abs(dxg) > 480) for (const f of ctx.zips) {
                if (f.riders && f.riders.has(me)) continue;
                for (const k of [0, 1]) {
                    const ex = k ? f.x1 : f.x0, ey = k ? f.y1 : f.y0, ox = k ? f.x0 : f.x1;
                    if (near(ex, me_cx) > 600 || feet - ey < 30 || feet - ey > 80) continue;
                    if (Math.abs(ox - goalFar) + 380 < Math.abs(ex - goalFar) && sk > Math.random() * 0.7) { intent.zip = { f, k, ex }; it.goalX = ex; it.goalNode = this.nav.ready ? this.nav.nodeBelow(ex, ey + 50) : -1; it.stop = 6; }
                }
            }
            // cannons: aim at where we want to go
            if (!intent.portal && !intent.zip) for (const f of ctx.cannons) {
                if (f.rider || near(f.y + 30, feet) > 40 || near(f.x, me_cx) > 420) continue;
                if (!st.cannon.has(f)) st.cannon.set(f, Math.abs(dxg) > 420 && Math.random() < 0.4 * sk);
                if (st.cannon.get(f)) { it.goalX = f.x; it.goalNode = this.nav.ready ? this.nav.nodeBelow(f.x, f.y + 34) : -1; it.stop = 3; intent.cannon = f; }
            }
            // updrafts: climb to a higher goal on a column of air or bubbles
            if (!intent.portal && !intent.zip && !intent.cannon && it.goalNode >= 0 && goalY < feet - 150) for (const c of ctx.lifts) {
                if (!c.on || near(c.y, feet) > 12 || near(c.x, me_cx) > 340 || goalY < c.y - c.h + 10 || c.h < feet - goalY) continue;
                if (near(c.x, goalFar) > 380 + c.h * 0.5) continue;
                intent.lift = c; it.goalX = c.x; it.goalNode = this.nav.ready ? this.nav.nodeBelow(c.x, c.y + 2) : -1; it.stop = 4; break;
            }
        }
        // inside a cannon: its aim sweeps, so fire when it points toward where we want to go
        for (const f of ctx.cannons) if (f.rider === me) intent.firing = f;
        // inside a column of air, going up
        if (!intent.lift) for (const c of ctx.lifts) if (c.on && Math.abs(me_cx - c.x) < c.hw && feet < c.y && feet > c.y - c.h) { intent.riding = c; break; }

        // ---- holding the Tear of God: one shot, half a second of being locked in place, and it flies dead straight along
        // the muzzle line: fire only when somebody will really be on that line when it goes off ----
        if (me.weapon && me.weapon.type === 'godtear' && !me.godCharge && !me.isBird && !me.onCloud) this.tearPlan(it, g, L, me, foe);
        // ---- the storm: outside the ring it stings, so get back in by the actual way (jumping, double jumping, around
        // walls), not by pushing against the nearest wall ----
        const sev = g.roundEvent;
        if (sev && sev.kind === 'storm' && !g.roundOver) {
            const dist = Math.hypot(me_cx - sev.cx, cy(me) - sev.cy);
            if (dist > sev.r - 110) {
                const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
                let cl = st.zone;
                if (!cl || cl.here !== here || this.frame - cl.frame > 30) {
                    const inside = (q) => Math.hypot(q.x + q.width / 2 - sev.cx, q.y - 30 - sev.cy) < sev.r - 90;
                    let node = -1, bc = 1e9;
                    const cand = [];
                    L.platforms.forEach((q, i) => { if (q.active && q.type !== 'trampoline' && !q.cage && q.width >= 50 && inside(q) && !(q.feature && !q.feature.kind)) cand.push(i); });
                    if (here >= 0) {
                        cand.sort((i, j) => Math.hypot(L.platforms[i].x - me_cx, L.platforms[i].y - feet) - Math.hypot(L.platforms[j].x - me_cx, L.platforms[j].y - feet));
                        let tried = 0;
                        for (const i of cand) { if (tried++ > 12) break; if (i === here) { node = i; bc = 0; break; } const r = this.nav.route(here, i, me.x, this.bannedEdges ? this.bannedEdges() : null); if (r && r.cost < bc) { bc = r.cost; node = i; } }
                    }
                    if (node < 0 && cand.length) { let bs = 1e9; for (const i of cand) { const q = L.platforms[i], sc = Math.max(0, q.x - me_cx, me_cx - (q.x + q.width)) + Math.abs(q.y - feet) * 0.6; if (sc < bs) { bs = sc; node = i; } } }
                    cl = st.zone = { here, frame: this.frame, node };
                }
                if (cl.node >= 0 && !(L.platforms[cl.node] && L.platforms[cl.node].active)) { st.zone = null; cl.node = -1; }
                if (cl.node >= 0 && cl.node !== here) {
                    const q = L.platforms[cl.node];
                    it.goalX = clamp2(sev.cx, q.x + 24, q.x + q.width - 24); it.goalNode = cl.node; it.stop = 16; it.snatch = null; it.jump = null; it.crouch = false; it.mode = 'storm';
                    this.zoneNav = this.frame;
                } else if (cl.node < 0 || cl.node === here) {
                    // already on the best ledge there is: head for the middle of the ring along it
                    it.goalX = clamp2(sev.cx, (L.platforms[here] || { x: 0 }).x + 20, (L.platforms[here] ? L.platforms[here].x + L.platforms[here].width : L.width) - 20); it.stop = 14; it.mode = 'storm'; this.zoneNav = this.frame;
                }
            }
        }
        // ---- the floor is lava: get up to where it can never reach ----
        const rev = g.roundEvent;
        if (rev && rev.kind === 'risingLava' && !g.roundOver && rev.t > 60) {
            const sup = me.ridePlat, safeY = Math.min(rev.top - 24, L.height), supSafe = sup && sup.y <= safeY && sup.active;
            const closing = feet > rev.y - 170;           // the lava is about to reach our feet (or already has)
            const urgency = closing || rev.t > 240 || feet > safeY;
            if (supSafe && urgency) {
                // Once a ledge is above the lava line, keep the bot on it. A nearby
                // opponent must not lure it back down into the rising hazard.
                const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
                intent.lavaSafe = sup;
                it.goalX = clamp2(me_cx, sup.x + 24, sup.x + sup.width - 24);
                it.goalNode = here; it.stop = 16; it.snatch = null; it.jump = null;
                it.crouch = false; it.mode = 'lava-safe';
                st.climb = null;
            } else if (!supSafe && urgency) {
                // the nearest platform the lava can never reach, by the actual route the nav graph knows; if none can be
                // reached from here, the highest one that can
                const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
                let cl = st.climb;
                if (!cl || cl.here !== here || this.frame - cl.frame > 40) {
                    let best = -1, bc = 1e9, high = -1, hy = 1e9;
                    if (here >= 0) {
                        const order = [];
                        L.platforms.forEach((q, i) => { if (i !== here && q.active && q.type !== 'trampoline' && !q.cage && q.width >= 50 && !(q.feature && !q.feature.kind) && q.y < feet - 30) order.push(i); });
                        order.sort((i, j) => Math.abs(L.platforms[i].x + L.platforms[i].width / 2 - me_cx) + Math.abs(L.platforms[i].y - feet) * 0.5 - (Math.abs(L.platforms[j].x + L.platforms[j].width / 2 - me_cx) + Math.abs(L.platforms[j].y - feet) * 0.5));
                        let tried = 0;
                        for (const i of order) {
                            if (tried++ > 14) break;
                            const r = this.nav.route(here, i, me.x, this.bannedEdges ? this.bannedEdges() : null);
                            if (!r) continue;
                            const q = L.platforms[i];
                            if (q.y <= safeY && r.cost < bc) { bc = r.cost; best = i; }
                            if (q.y < hy) { hy = q.y; high = i; }
                        }
                    }
                    if (here < 0) {
                        // in the air (the lava keeps throwing them up): head for the nearest platform it can never reach
                        let nb = -1, nbs = 1e9;
                        L.platforms.forEach((q, i) => { if (!q.active || q.type === 'trampoline' || q.cage || q.width < 50 || q.y > safeY || (q.feature && !q.feature.kind)) return; const sc = Math.max(0, q.x - me_cx, me_cx - (q.x + q.width)) + Math.abs(q.y - feet) * 0.4; if (sc < nbs) { nbs = sc; nb = i; } });
                        best = nb;
                    }
                    cl = st.climb = { here, frame: this.frame, node: best >= 0 ? best : high };
                }
                if (cl.node >= 0 && !(L.platforms[cl.node] && L.platforms[cl.node].active)) { st.climb = null; cl.node = -1; }
                if (cl.node >= 0) {
                    const q = L.platforms[cl.node];
                    it.goalX = clamp2(me_cx, q.x + 24, q.x + q.width - 24); if (Math.abs(it.goalX - me_cx) < 30) it.goalX = q.x + q.width / 2;
                    it.goalNode = cl.node; it.stop = 14; it.snatch = null; it.jump = null; it.attack = false; it.crouch = false; it.mode = 'climb';
                    intent.climb = true;
                }
            }
        }
        const out = base.call(this, it);
        if (me.godCharge && it.mode === 'tear-loop') { out.x = 0; out.y = 0; out.jump = false; out.attack = false; }

        // ---- what the body does about it ----
        if (intent.flee) {
            const { q, dy, d, dir } = intent.flee;
            this.plan = null;
            out.attack = false; out.y = 0; out.x = dir;
            // in its grip: jump to get off the floor and fight the pull (double jump too)
            const hard = d < q.core + 110;
            if ((hard || intent.flee.blocked) && ((me.grounded && !me.jumpPressed) || (!me.grounded && me.velocity.y > -2 && me.jumpCount < me.maxJumps && !me.jumpPressed))) out.jump = true;
            else if (me.grounded) out.jump = false;
        } else if (intent.dive) {
            const q = intent.dive, dx = q.x - cx(me), dy = q.y - cy(me);
            this.plan = null; out.x = Math.sign(dx); out.attack = false;
            if (!me.grounded && Math.abs(dy) > 20) out.jump = dy < 0 && me.velocity.y > -3 && !me.jumpPressed;
        } else if (intent.zip) {
            const { f, k } = intent.zip;
            if (K.zipline.atEnd(f, me, k)) { out.y = 1; out.x = 0; this.plan = null; }
        } else if (intent.firing) {
            const f = intent.firing, tx = it.goalX !== null && it.goalX !== undefined ? it.goalX : (foe ? cx(foe) : cx(me)), ty = it.goalNode >= 0 ? L.platforms[it.goalNode].y - 30 : (foe ? cy(foe) : cy(me) - 200);
            const want = Math.atan2(ty - f.y, tx - f.x);
            let diff = Math.abs(f.a - want); diff = Math.min(diff, Math.PI * 2 - diff);
            if (diff < 0.28 || f.hold > 62) out.attack = true;
        } else if (intent.riding) {
            // steer toward the goal while rising, and drift out over the ledge at the top
            const c = intent.riding, tx = it.goalX !== null && it.goalX !== undefined ? it.goalX : c.x;
            const goalY = it.goalNode >= 0 ? L.platforms[it.goalNode].y : feet - 300;
            if (feet < goalY + 40) out.x = Math.sign(tx - cx(me)) || 0;
            if (feet > goalY + 120) out.x = Math.abs(tx - cx(me)) > 20 ? 0 : out.x;
        }
        if (intent.lavaSafe && me.grounded && me.ridePlat === intent.lavaSafe) {
            const center = intent.lavaSafe.x + intent.lavaSafe.width / 2;
            out.x = Math.abs(center - me_cx) > 34 ? Math.sign(center - me_cx) : 0;
            out.jump = false; out.y = 0; this.plan = null;
        }
        // stuck under a ledge (a conjured ice step, a press, a hung platform): jumping only bonks the head. After a moment of
        // getting nowhere, walk out from under it, toward the goal side if that is as near, then try again.
        if (me.grounded && !me.isLaying && !intent.flee) {
            const mv = st.mv || (st.mv = { x: me.x, f: this.frame, escape: null });
            if (Math.abs(me.x - mv.x) > 14 || this.frame - mv.f > 400) { mv.x = me.x; mv.f = this.frame; }
            if (!mv.escape && this.frame - mv.f > 70 && (out.jump || this.plan || out.x === 0 || true)) {
                let c = null;
                for (const q of L.platforms) if (q.active && q.type !== 'trampoline' && q.x < me.x + me.width && q.x + q.width > me.x && q.y + q.height <= me.y + 6 && q.y + q.height > me.y - 120 && (!c || q.y + q.height > c.y + c.height)) c = q;
                if (c && !foeNear) {
                    const left = c.x - me.width - 8, right = c.x + c.width + 8, goal = it.goalX !== null && it.goalX !== undefined ? it.goalX : me_cx;
                    let dir = Math.abs(me.x - left) <= Math.abs(right - me.x) ? -1 : 1;
                    if (Math.abs(Math.abs(me.x - left) - Math.abs(right - me.x)) < 90) dir = Math.sign(goal - me_cx) || dir;
                    mv.escape = { dir, until: this.frame + 45 }; mv.f = this.frame;
                }
            }
            if (mv.escape) {
                if (this.frame > mv.escape.until) mv.escape = null;
                else { out.x = this.safeDir ? (this.safeDir(mv.escape.dir) || mv.escape.dir) : mv.escape.dir; out.jump = false; out.y = 0; this.plan = null; }
            }
        }
        // quicksand: the longer you stand in it the deeper you sink; jump to get free
        if (me.sink > 0.25 && me.grounded && !me.jumpPressed && !intent.flee) { out.jump = true; out.x = (this.frame >> 4) % 2 ? 1 : -1; }
        return out;
    };
    // The Tear flies horizontally (its muzzle height, fighters' bodies within 14px of it) and never stops until it hits
    // someone, walls or not. The shooter is frozen for CHARGE frames first, so aim where the target WILL be.
    const CHARGE_F = 30;
    BotBrain.prototype.tearPlan = function (it, g, L, me, nearest) {
        const def = WEAPONS.godtear, m = WeaponDefs.muzzle(me, def), my = m.y;
        const tier = this.difficulty, predict = tier !== 'easy';
        const enemies = g.players.filter(p => p !== me && !p.isDead && p.team !== me.team);
        if (!enemies.length) return;
        const line = (x, y, w, h) => y < my + 12 && y + h > my - 12;      // body box vs the 28px-tall shot at muzzle height
        const angel = enemies.find(e => e.isBird);

        // Intermediate+ bots can recognize the portal loop. The tear enters
        // one portal, exits the other without losing horizontal momentum, then
        // loops through the pair until it hits a fighter on either portal row.
        if (angel && tier !== 'easy' && this.skill('divineLoop')) {
            let loop = this.tearLoop;
            if (!loop || loop.angel !== angel || this.frame > loop.until || !L.features.includes(loop.pair)) {
                loop = null;
                const portals = L.features.filter(f => f.kind === 'portals' && f.a && f.b);
                for (const pair of portals) {
                    for (const [entry, exit] of [[pair.a, pair.b], [pair.b, pair.a]]) {
                        const rowsY = [entry.y, exit.y];
                        if (!rowsY.some(y => y >= angel.y - 12 && y <= angel.y + angel.height + 12)) continue;
                        const lo = Math.min(entry.x, exit.x) + 46, hi = Math.max(entry.x, exit.x) - 46;
                        if (hi <= lo) continue;
                        // A different fighter on either loop row would stop the
                        // first tear before it reached the angel.
                        const blocked = enemies.some(e => e !== angel && rowsY.some(y => y >= e.y - 14 && y <= e.y + e.height + 14) && e.x + e.width > lo && e.x < hi);
                        if (blocked) continue;
                        const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
                        for (let i = 0; i < L.platforms.length; i++) {
                            const p = L.platforms[i];
                            if (!p.active || p.motion || p.collapse || p.cage || p.type === 'trampoline' || p.width < 74) continue;
                            if (Math.abs(p.y - 44 - entry.y) > 24) continue;
                            const x = clamp2((lo + hi) / 2, p.x + 36, p.x + p.width - 36);
                            if (x < lo || x > hi) continue;
                            let routeCost = 0;
                            if (here >= 0 && here !== i) {
                                const route = this.nav.route(here, i, me.x, this.bannedEdges ? this.bannedEdges() : null);
                                if (!route) continue;
                                routeCost = route.cost;
                            } else if (here < 0 && this.nav.ready) continue;
                            const score = routeCost + Math.abs(x - (me.x + me.width / 2)) / Math.max(1, me.speed);
                            if (!loop || score < loop.score) loop = { pair, entry, exit, platform: p, node: i, x, angel, until: this.frame + 180, score };
                        }
                    }
                }
                this.tearLoop = loop;
            }
            if (loop) {
                const node = L.platforms.indexOf(loop.platform);
                if (node < 0 || !loop.platform.active) this.tearLoop = null;
                else {
                    const here = this.nav.ready ? this.nav.supportIndex(me) : -1;
                    if (here !== node || !me.grounded || Math.abs(me.x + me.width / 2 - loop.x) > 28 || Math.abs(me.velocity.x) > 0.8) {
                        it.goalX = loop.x; it.goalNode = node; it.stop = 8; it.snatch = null; it.attack = false;
                        it.jump = null; it.crouch = false; it.mode = 'tear-loop'; it.face = Math.sign(loop.entry.x - (me.x + me.width / 2));
                        this.tearWait = 0;
                        return;
                    }
                    const toward = Math.sign(loop.entry.x - (me.x + me.width / 2)) || me.facing;
                    if (me.attackCooldown <= 0) {
                        it.attack = true; it.face = toward; it.mode = 'tear-loop'; it.goalX = me.x + me.width / 2;
                        it.goalNode = node; it.stop = 400; it.crouch = false; it.shield = false; this.tearWait = 0;
                        return;
                    }
                }
            }
        }
        let best = null;
        for (const e of enemies) {
            const dirTo = Math.sign((e.x + e.width / 2) - (me.x + me.width / 2)) || me.facing;
            const nowOK = line(e.x, e.y, e.width, e.height);
            let futureOK = true;
            if (predict) {
                const o = BotSim.ghost(e), moving = Math.abs(e.velocity.x) > 1.2 ? Math.sign(e.velocity.x) : 0, inp = this.scratchInput2 ? this.scratchInput2(moving, 0, false) : { x: moving, y: 0, jump: false, attack: false, shield: false };
                for (let k = 0; k < CHARGE_F; k++) { BotSim.step(o, inp, this.world, k); if (o.dead) break; }
                futureOK = !o.dead && line(o.x, o.y, o.width, o.height) && Math.sign((o.x + o.width / 2) - (me.x + me.width / 2)) === dirTo;
                if (tier === 'hack' || tier === 'nightmare') { /* they read it, and also stay patient */ }
            }
            if (!nowOK || !futureOK) continue;
            const d = Math.abs(e.x - me.x), sc = (e.isBird ? -2000 : 0) + (e.kills || 0) * -30 + d * 0.2;   // the angel first, then whoever is winning, then the closest
            if (!best || sc < best.sc) best = { e, dirTo, sc };
        }
        if (best) {
            // something to do other than shoot a moment too early: let the target settle (a bit of patience, less at higher skill)
            if (!this.tearWait) this.tearWait = this.frame + Math.round({ easy: 24, medium: 14, hard: 8, nightmare: 4, hack: 0 }[tier] || 10);
            const canSlideFire = tier !== 'easy' && me.grounded && me.env && me.env.grip < 0.3 && this.skill('divineSlide');
            const sliding = canSlideFire && Math.abs(me.velocity.x) > 0.9;
            if (this.frame >= this.tearWait && me.attackCooldown <= 0 && me.grounded && (!canSlideFire || sliding)) {
                it.attack = true; it.face = best.dirTo; it.mode = sliding ? 'tear-slide' : 'tear'; it.crouch = false; it.shield = false;
                if (sliding) it.goalX = me.x + me.width / 2 + best.dirTo * 180;
                this.tearWait = 0; return;
            }
            if (canSlideFire && !sliding && me.grounded) {
                it.goalX = me.x + me.width / 2 + best.dirTo * 180; it.goalNode = this.nav.supportIndex(me);
                it.stop = 0; it.mode = 'tear-slide'; it.face = best.dirTo; it.attack = false;
                return;
            }
            if (me.grounded) { it.goalX = me.x + me.width / 2; it.stop = 400; it.mode = 'tear'; }   // hold still and line up
            return;
        }
        this.tearWait = 0;
        // nobody on the line: get onto the same level as the nearest enemy (going along the floor to them), never shoot blind
        const t = nearest && !nearest.isDead ? nearest : enemies[0], tx = t.x + t.width / 2;
        it.attack = false; it.mode = 'tearhunt'; it.snatch = null;
        it.goalX = tx; it.goalNode = this.nav.ready ? this.nav.nodeBelow(tx, t.y + t.height) : -1; it.stop = 60;
    };
    function hurtLow(me) { return me.health < me.maxHealth * 0.93; }
    function clamp2(v, a, b) { return Math.max(a, Math.min(b, v)); }

    // ---- slippery ground (ice, snow, frost): grip g scales both how fast you speed up and how fast you stop, so
    // you have to start braking long before the edge. Look ahead with the real rule and pick the input that stops
    // you on the platform (and as near the goal as possible).
    BotBrain.prototype.iceControl = function (out, it, L, me) {
        const g = me.env.grip, sup = me.ridePlat;
        if (!sup || sup.motion || !sup.active) return;
        const lo = sup.x - 10, hi = sup.x + sup.width - me.width + 10, sp = me.speed * (me.speedMul || 1) * (me.env.speed || 1);
        const goal = it.goalX !== null && it.goalX !== undefined ? it.goalX - me.width / 2 : null;
        const wd = out.x;
        const endOf = (first) => {
            let x = me.x, v = me.velocity.x;
            for (let t = 0; t < 400; t++) {
                const inp = t === 0 ? first : (Math.abs(v) > 0.3 ? -Math.sign(v) : 0);
                if (inp) v += (inp * sp - v) * 0.35 * g; else v *= 1 - 0.2 * g;
                x += v;
                if (t > 0 && Math.abs(v) < 0.3 && inp === 0) break;
            }
            return x;
        };
        const best = { s: 1e9, d: 0 };
        for (const d of wd ? [wd, 0, -wd] : [0, -1, 1]) {
            const e = endOf(d);
            let sc = (e < lo ? (lo - e) * 6 + 400 : e > hi ? (e - hi) * 6 + 400 : 0) + (d === wd ? 0 : 6);
            if (goal !== null && sc < 400) sc += Math.abs(e - goal) * 0.6;
            if (sc < best.s) { best.s = sc; best.d = d; }
        }
        out.x = best.d;
    };
    // wrap the end of drive for ice (kept separate so the main wrapper above stays readable)
    const driveIce = BotBrain.prototype.drive;
    BotBrain.prototype.drive = function (it) {
        const out = driveIce.call(this, it), me = this.body, L = this.game && this.game.level;
        if (me && L && me.grounded && !me.isBird && !me.onCloud && me.env && me.env.grip < 0.7 && !this.plan && !me.isLaying && it.mode !== 'tear-loop') {
            const wasFlee = this.fleeing; // (flee already chose its direction against the pull)
            if (!wasFlee) this.iceControl(out, it, L, me);
        }
        return out;
    };
})();
