// Reachability fixes. A handful of layouts leave a platform out of comfortable reach (it needs a
// frame-perfect jump, or none works). Each entry lowers one platform of a layout by `dy` pixels
// (moving platforms shift their whole swing). Found by auditing every layout with the bot's jump
// simulation at 85% jump strength (a comfortable, not frame-perfect, jump); see agent.md.
(() => {
    const FIXES = {
        "The Tower": [[3,60],[2,80],[5,140],[6,20],[4,160]],
        "Sky Bridges": [[2,80]],
        "Seesaw Skies": [[6,80]],
        "Elevator Race": [[3,80]],
        "Spring Steps": [[11,40]],
        "Archipelago": [[7,40]],
        "Crossfire": [[3,80],[2,20],[5,80],[6,80]],
        "The Bowl": [[8,120]],
        "Orbiter": [[8,100]],
        "Sky Fortress": [[8,40],[9,40]],
        "Rush Hour": [[3,120]],
        "Trapeze": [[5,20],[7,40]],
        "Pit Stop": [[3,20]],
        "Highway": [[3,60],[4,60]],
        "Volcano Rim": [[4,80]],
        "Skyscrapers": [[8,80]],
        "Hourglass": [[4,100],[3,100]],
        "Pillar Field": [[8,40]],
        "Twin Elevators": [[5,40]],
        "Conveyor": [[7,80]],
        "Canopy": [[10,60]],
        "Pinwheel": [[7,40],[8,40]],
        "Crossroads": [[1,60]],
        "Gondolas": [[5,120]],
        "Escalator": [[3,20]],
        "Crater": [[4,40]],
        "Puzzle Box": [[3,80],[4,80]],
        "Twin Bridges": [[3,40]],
        "Watchtowers": [[10,40]]
    };   // Tight spots: an upper platform hanging less than a fighter's height (plus a little room) over one below it
    // is a slot nobody can stand or pass through. Movers are checked at both ends of their swing.
    const VMIN = 68;
    function boxesOf(p) {
        const m = p.motion;
        if (!m) return [{ x: p.x, y: p.y, w: p.width, h: p.height }];
        const out = [];
        const ph = m.kind === 'orbit' ? [0, Math.PI / 2, Math.PI, 1.5 * Math.PI] : [Math.PI / 2, -Math.PI / 2];
        for (const a of ph) { const pos = Level.motionAt(m, a, p.width); out.push({ x: pos.x, y: pos.y, w: p.width, h: p.height }); }
        return out;
    }
    function tightSpots(level) {
        const P = level.platforms, out = [];
        for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) {
            if (i === j || P[i].active === false || P[j].active === false || P[i].type === 'trampoline' || P[j].type === 'trampoline') continue;
            let worst = Infinity;
            for (const a of boxesOf(P[i])) for (const b of boxesOf(P[j])) {
                const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
                if (ox < 24) continue;
                const gap = b.y - (a.y + a.h);
                if (gap > 0 && gap < VMIN && gap < worst) worst = gap;
            }
            if (worst < Infinity) out.push({ upper: i, lower: j, gap: worst });
        }
        return out;
    }
    // Raise the upper platform of each tight spot until a fighter fits
    function openTightSpots(level) {
        for (let pass = 0; pass < 6; pass++) {
            const spots = tightSpots(level);
            if (!spots.length) return;
            const sp = spots[0], p = level.platforms[sp.upper], need = VMIN - sp.gap;
            p.y -= need;
            if (p.motion) { if (p.motion.kind === 'orbit') p.motion.cy -= need; else p.motion.oy -= need; }
        }
    }

    const buildBase = Level.prototype.buildLayout;
    Level.prototype.buildLayout = function (layout) {
        buildBase.call(this, layout);
        // Tall pillars that stand on the floor seal off whatever is between them (an archway becomes a locked
        // room, a bot or a player can't walk past a wall 250px high). Lift each one a doorway's height so the
        // floor stays continuous underneath; the platform above is unchanged.
        const base = this.height - 50;
        for (const q of this.platforms) {
            if (q.motion || q.type === 'trampoline' || q.height < 170) continue;
            if (q.y + q.height < base - 2 || q.y >= base - 2) continue;   // only those standing on the floor, never the floor itself
            q.height -= 96;
        }
        openTightSpots(this);
        const list = FIXES[layout.name];
        if (list) for (const [i, dy] of list) {
            const p = this.platforms[i];
            if (!p) continue;
            p.y += dy;
            if (p.motion) { if (p.motion.kind === 'orbit') p.motion.cy += dy; else p.motion.oy += dy; }
        }
        // A lift must never carry its rider up into a platform above it (their head would end up inside it and they
        // would be pushed through): stop its swing where a fighter standing on it just clears the underside.
        for (const p of this.platforms) {
            const m = p.motion;
            if (!m || m.kind !== 'line' || !m.dy) continue;
            const x0 = m.ox - Math.abs(m.dx), x1 = m.ox + Math.abs(m.dx) + p.width;
            let ceil = -Infinity;
            for (const q of this.platforms) {
                if (q === p || q.motion || q.type === 'trampoline' || q.active === false) continue;
                if (q.x + q.width <= x0 || q.x >= x1) continue;
                const bottom = q.y + q.height;
                if (bottom <= m.oy && bottom > ceil) ceil = bottom;
            }
            if (ceil === -Infinity) continue;
            const room = m.oy - (ceil + 64);          // how far above its middle the lift may rise
            if (room < Math.abs(m.dy)) {
                const keep = Math.max(24, room);
                const sign = Math.sign(m.dy);
                m.dy = sign * keep;
                m.omega = (m.omega || 0.02) * 1;       // same swing rate over the shorter travel
                const pos = Level.motionAt(m, p.phase, p.width);
                p.x = pos.x; p.y = pos.y;
            }
        }
    };
    Level.REACH_FIXES = FIXES;
    Level.tightSpots = tightSpots;
})();
