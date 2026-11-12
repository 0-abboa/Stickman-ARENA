// Round events: now and then a whole round is played under pressure. A doomsday bomb locked in a cage
// counts down, and if more than one side is still standing when it goes off, nobody wins; a bomb bounces
// around the arena with its fuse burning; lava rises from below; a wall of spikes with one gap sweeps
// across from right to left; the lights go out; earthquakes shake the ground
// loose; a storm closes in; a lit bomb is passed fighter to fighter like a hot potato; an ice age creeps
// over the floors. ?event=<name> in the URL forces one (for previews).
const RoundEvents = (() => {
    const TAU = Math.PI * 2, R = Math.random, RND = (a, b) => a + R() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const alive = (g) => g.players.filter(p => !p.isDead);
    const cx = (p) => p.x + p.width / 2, cy = (p) => p.y + p.height / 2;
    const glow = (ctx, x, y, r, rgb, a) => { if (a <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };
    const solids = (L) => L.platforms.filter(p => p.active && p.type !== 'trampoline' && !p.motion);
    // event damage follows the trap rules: never takes a healthy fighter out in one go
    function sting(g, ev, p, dmg, kx, ky, status, every) {
        const cd = ev.cd || (ev.cd = new Map());
        if ((cd.get(p) || 0) > g.frameCount) return false;
        cd.set(p, g.frameCount + (every || 24));
        if (!p.trapLog || g.frameCount - p.trapLog.t > 120) p.trapLog = { t: g.frameCount, dealt: 0 };
        const room = 34 - p.trapLog.dealt;
        if (room <= 0) return false;
        dmg = Math.min(dmg, room); p.trapLog.dealt += dmg;
        p.lastHitType = 'env'; p.lastHitAt = g.frameCount;
        p.takeDamage(dmg, p.lastAttacker && performance.now() - (p.lastAttackerAt || 0) < 3000 ? p.lastAttacker : null);
        if (kx !== undefined) { p.velocity.x = clamp(kx, -7, 7); p.velocity.y = Math.max(ky, -12); p.grounded = false; }
        if (status) g.applyStatus(p, status, null, null, dmg);
        p.flinchNew = true; p.hitFlash = 1;
        return true;
    }
    const fmt = (frames) => { const s = Math.max(0, Math.ceil(frames / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    // the big one: every fighter still standing is caught in it, so with two sides left nobody wins
    function doomsday(g, x, y) {
        g.fx.explosion ? g.fx.explosion(x, y, 260) : null;
        g.fx.flashAt(x, y, '255,230,180', 900, 20);
        if (!g.demo) { g.fx.screenFlash('255,240,220', 1); g.fx.addTrauma(1); }
        for (let i = 0; i < 6; i++) g.fx.ring(x, y, '255,200,120', 260 + i * 260, 10 - i, 22 + i * 8);
        AudioSys.playExplosion();
        for (const p of alive(g)) { p.shieldActive = false; p.lastAttacker = null; p.lastHitType = 'env'; p.velocity.x = Math.sign(cx(p) - x || 1) * 14; p.velocity.y = -12; p.takeDamage(9999, null); }
    }
    function bombArt(ctx, x, y, r, t, left, lit) {
        ctx.save(); ctx.translate(x, y);
        const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r); gr.addColorStop(0, '#5a5f6a'); gr.addColorStop(1, '#14161c');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a2e36'; ctx.fillRect(-r * 0.25, -r * 1.15, r * 0.5, r * 0.3);
        ctx.strokeStyle = '#8d6e45'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.quadraticCurveTo(r * 0.4, -r * 1.6, r * 0.2, -r * 1.9); ctx.stroke();
        if (lit) { glow(ctx, r * 0.2, -r * 1.9, 14, '255,200,90', 0.9); ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(r * 0.2, -r * 1.9, 2.5 + Math.random() * 2, 0, TAU); ctx.fill(); }
        // a little red read-out on the casing
        const urgent = left < 600;
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-r * 0.62, -r * 0.24, r * 1.24, r * 0.5);
        ctx.fillStyle = urgent && (t % 20 < 10) ? '#ff8a80' : '#ff1744'; ctx.font = `bold ${Math.round(r * 0.42)}px Orbitron, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fmt(left), 0, 0.02 * r);
        ctx.restore();
        if (urgent) glow(ctx, x, y, r * 2.4, '255,60,40', 0.2 + 0.3 * (t % 20 < 10 ? 1 : 0));
    }

    const E = {};

    // 1. Doomsday bomb, locked in a cage nobody can open
    E.cagedBomb = {
        title: 'DOOMSDAY BOMB', sub: 'IT CANNOT BE REACHED. FINISH IT BEFORE IT BLOWS',
        start(g, ev) {
            const L = g.level, hits = (x, y, m) => L.platforms.some(q => q.active && x - 56 - m < q.x + q.width && x + 56 + m > q.x && y - 70 - m < q.y + q.height && y + 50 + m > q.y);
            // hang it in open air near the middle, clear of every ledge, so it blocks no path
            let best = null;
            for (let i = 0; i < 400 && !best; i++) {
                const x = L.width / 2 + (R() - 0.5) * L.width * Math.min(0.9, 0.15 + i / 300), y = L.height * RND(0.32, 0.58);
                if (!hits(x, y, 40)) best = [x, y];
            }
            if (!best) for (let i = 0; i < 400 && !best; i++) { const x = RND(120, L.width - 120), y = RND(100, L.height - 200); if (!hits(x, y, 10)) best = [x, y]; }
            if (!best) throw new Error('no room');
            [ev.x, ev.y] = best; ev.left = 60 * 45; ev.t = 0;
            // the cage: solid bars on every side; you can stand on its roof but never get in
            ev.bars = [];
            const add = (x, y, w, h) => { const b = L.createPlatform(x, y, w, h); b.cage = true; b.mech = true; b.noDraw = true; L.platforms.push(b); ev.bars.push(b); };
            add(ev.x - 52, ev.y - 66, 104, 10); add(ev.x - 52, ev.y + 36, 104, 10); add(ev.x - 52, ev.y - 56, 8, 92); add(ev.x + 44, ev.y - 56, 8, 92);
        },
        step(g, ev) {
            ev.t++; ev.left--;
            if (ev.left < 600 && ev.left % (ev.left < 180 ? 10 : 30) === 0) AudioSys.playAttack && AudioSys.playAttack();
            if (ev.left <= 0 && !ev.blown) { ev.blown = true; doomsday(g, ev.x, ev.y); }
        },
        world(ctx, g, ev) {
            bombArt(ctx, ev.x, ev.y, 26, ev.t, ev.left, true);
            ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = 3; ctx.setLineDash([7, 4]);
            ctx.beginPath(); ctx.moveTo(ev.x, ev.y - 66); ctx.lineTo(ev.x, -80); ctx.stroke(); ctx.setLineDash([]);
            const sw = Math.sin(ev.t * 0.04) * 0.6;
            ctx.strokeStyle = '#9ea7b5'; ctx.lineWidth = 3;
            for (let x = ev.x - 46; x <= ev.x + 46; x += 13) { ctx.beginPath(); ctx.moveTo(x, ev.y - 60); ctx.lineTo(x, ev.y + 40); ctx.stroke(); }
            ctx.fillStyle = '#5a606c'; ctx.fillRect(ev.x - 52, ev.y - 66, 104, 10); ctx.fillRect(ev.x - 52, ev.y + 36, 104, 10); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(ev.x - 52, ev.y - 66, 104, 3); void sw;
            ctx.fillStyle = '#c9a227'; ctx.fillRect(ev.x + 30, ev.y + 4, 16, 14); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ev.x + 38, ev.y + 4, 5, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#7a5f10'; ctx.fillRect(ev.x + 36, ev.y + 9, 4, 5);
        },
        hud(ctx, W, y, g, ev) { timer(ctx, W, y, ev.left, 'DOOMSDAY'); }
    };

    // 2. A bomb that bounces around the arena; hitting it knocks it away
    E.bouncingBomb = {
        title: 'LIVE BOMB', sub: 'IT BOUNCES. IT TICKS. BAT IT AWAY',
        start(g, ev) { const L = g.level; ev.x = L.width / 2; ev.y = 140; ev.vx = (R() < 0.5 ? -1 : 1) * 4.2; ev.vy = 2.5; ev.r = 24; ev.left = 60 * 40; ev.t = 0; },
        step(g, ev) {
            const L = g.level;
            ev.t++; ev.left--;
            ev.x += ev.vx; ev.y += ev.vy;
            // bounce off the arena edges and every platform
            if (ev.x < ev.r) { ev.x = ev.r; ev.vx = Math.abs(ev.vx); }
            if (ev.x > L.width - ev.r) { ev.x = L.width - ev.r; ev.vx = -Math.abs(ev.vx); }
            if (ev.y < ev.r) { ev.y = ev.r; ev.vy = Math.abs(ev.vy); }
            if (ev.y > L.height - ev.r - 30) { ev.y = L.height - ev.r - 30; ev.vy = -Math.abs(ev.vy); }
            for (const q of L.platforms) {
                if (!q.active || q.cage) continue;
                const nx = clamp(ev.x, q.x, q.x + q.width), ny = clamp(ev.y, q.y, q.y + q.height), dx = ev.x - nx, dy = ev.y - ny, d = Math.hypot(dx, dy);
                if (d < ev.r && d > 0.01) { const ux = dx / d, uy = dy / d, dot = ev.vx * ux + ev.vy * uy; if (dot < 0) { ev.vx -= 2 * dot * ux; ev.vy -= 2 * dot * uy; } ev.x = nx + ux * ev.r; ev.y = ny + uy * ev.r; if (q.type === 'trampoline') { ev.vy = -7; } }
            }
            // fighters bump it; a swing or a shot sends it flying
            for (const p of alive(g)) {
                const dx = ev.x - cx(p), dy = ev.y - cy(p);
                if (Math.abs(dx) < ev.r + 15 && Math.abs(dy) < ev.r + 30) {
                    const hitNow = p.attackAnim < 4 && !(ev.hitBy && ev.hitBy.get(p) > g.frameCount);
                    if (hitNow) { ev.vx = p.facing * 9; ev.vy = -5; (ev.hitBy || (ev.hitBy = new Map())).set(p, g.frameCount + 12); g.fx.sparks(ev.x, ev.y, '255,230,160', 8, undefined, 0, 4); AudioSys.playHit(); }
                    else { ev.vx = Math.sign(dx || 1) * Math.max(3, Math.abs(ev.vx)); p.velocity.x -= Math.sign(dx || 1) * 2; }
                }
            }
            for (const pr of g.projectiles) if (pr.active && Math.hypot(pr.x - ev.x, pr.y - ev.y) < ev.r + 6) { ev.vx += (pr.vx || 0) * 0.5; ev.vy += (pr.vy || 0) * 0.5 - 1; pr.active = false; g.fx.sparks(ev.x, ev.y, '255,230,160', 6); }
            const sp = Math.hypot(ev.vx, ev.vy); if (sp > 11) { ev.vx *= 11 / sp; ev.vy *= 11 / sp; } if (sp < 3.5) { ev.vx *= 1.05; ev.vy *= 1.05; }
            if (ev.left < 600 && ev.left % (ev.left < 180 ? 10 : 30) === 0) AudioSys.playAttack && AudioSys.playAttack();
            if (ev.left <= 0 && !ev.blown) { ev.blown = true; doomsday(g, ev.x, ev.y); }
        },
        world(ctx, g, ev) { if (!ev.blown) bombArt(ctx, ev.x, ev.y, ev.r, ev.t, ev.left, true); },
        hud(ctx, W, y, g, ev) { timer(ctx, W, y, ev.left, 'LIVE BOMB'); },
        dangers(g, ev) { return [{ x: ev.x - 60, y: ev.y - 60, w: 120, h: 120, soon: 40 }]; }
    };

    // 3. The floor is lava: it rises steadily from below
    E.risingLava = {
        title: 'THE FLOOR IS LAVA', sub: 'CLIMB',
        start(g, ev) { const L = g.level; ev.y = L.height + 40; ev.t = 0; const tops = solids(L).map(q => q.y).sort((a, b) => a - b); ev.top = (tops[Math.min(tops.length - 1, 3)] || L.height * 0.4) + 30; const m = L.material; ev.look = m === 'candy' ? ['#7a4a26', '#c98a50', '200,140,90'] : m === 'ice' || m === 'xmas' ? ['#3a7ab0', '#bfe6ff', '170,220,255'] : m === 'ocean' ? ['#1a5a8a', '#8ad6ff', '120,200,255'] : ['#c0380e', '#ffd36e', '255,130,40']; ev.hot = !(m === 'ice' || m === 'xmas' || m === 'ocean'); },
        step(g, ev) {
            const L = g.level;
            ev.t++;
            if (ev.t > 240 && ev.y > ev.top) ev.y -= 0.22;
            for (const p of alive(g)) if (p.y + p.height > ev.y + 4) {
                // touching it burns (or freezes) and throws you back up; it never swallows you whole
                // (lava burns through shields and an angel's resistance, on its own timer apart from the trap budget)
                let burned = false;
                if ((p.lavaCd || 0) <= g.frameCount) {
                    p.lavaCd = g.frameCount + 18; p.lastHitType = 'env'; p.lastHitAt = g.frameCount;
                    const bd = p.isBird, sh = p.shieldActive; p.isBird = false; p.shieldActive = false;
                    p.takeDamage(16, null);
                    p.isBird = bd; if (!p.isDead) p.shieldActive = sh;
                    if (!p.isDead && g.applyStatus) g.applyStatus(p, ev.hot ? { burn: 90 } : { freeze: 60 }, null, null, 16);
                    p.flinchNew = true; p.hitFlash = 1; burned = true;
                }
                if (burned) g.fx.add({ type: 'drop', x: cx(p), y: ev.y, vx: 0, vy: -3, life: 30, color: `rgba(${ev.look[2]},1)`, size: 2, gravity: 0.3 });
                p.velocity.y = Math.min(p.velocity.y, -9); p.y = Math.min(p.y, ev.y - p.height + 2); p.jumpCount = 1;
            }
            if (R() < 0.3) g.fx.add({ type: 'puff', x: RND(0, L.width), y: ev.y, vx: 0, vy: -0.6, life: 40, color: ev.look[2], size: 2, grow: 0.05, alpha: 0.4 });
        },
        world(ctx, g, ev) {
            const L = g.level, y = ev.y, t = ev.t;
            if (y > L.height + 30) return;
            const gr = ctx.createLinearGradient(0, y - 4, 0, y + 400); gr.addColorStop(0, ev.look[1]); gr.addColorStop(0.08, ev.look[0]); gr.addColorStop(1, '#1a0602');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-3000, L.height + 3000);
            for (let x = -3000; x <= L.width + 3000; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.05) * 3 + Math.sin(x * 0.05 - t * 0.04) * 1.5);
            ctx.lineTo(L.width + 3000, L.height + 3000); ctx.fill();
            glow(ctx, L.width / 2, y, L.width * 0.7, ev.look[2], ev.hot ? 0.18 : 0.08);
        },
        // Only the lava surface and the area below it are dangerous. The old
        // box extended 90px above the surface, so bots treated a genuinely safe
        // ledge as hazardous and stepped off it into the lava.
        dangers(g, ev) { return [{ x: -100, y: ev.y + 4, w: g.level.width + 200, h: Math.max(100, g.level.height - ev.y + 200), soon: 0, kind: 'floor' }]; }
    };

    // 4. A wall of spikes with one gap sweeps from right to left; find the gap
    E.spikeWall = {
        title: 'SPIKE WALL', sub: 'GET THROUGH THE GAP',
        start(g, ev) { ev.t = 0; this.newWall(g, ev); },
        newWall(g, ev) { const L = g.level; ev.x = L.width + 40; ev.gapY = RND(L.height * 0.25, L.height * 0.75); ev.gap = 150; ev.wait = 0; ev.drift = (R() - 0.5) * 0.6; },
        step(g, ev) {
            const L = g.level;
            ev.t++;
            if (ev.wait > 0) { if (--ev.wait <= 0) this.newWall(g, ev); return; }
            ev.x -= 1.15; ev.gapY = clamp(ev.gapY + ev.drift, 150, L.height - 150); if (ev.gapY <= 150 || ev.gapY >= L.height - 150) ev.drift *= -1;
            if (ev.t % 6 === 0) g.fx.add({ type: 'chunk', x: ev.x, y: L.height - 40, vx: RND(-1, 1), vy: -RND(1, 3), life: 20, color: '#555', size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 });
            for (const p of alive(g)) {
                const inGap = cy(p) > ev.gapY - ev.gap / 2 + 20 && cy(p) < ev.gapY + ev.gap / 2 - 20;
                if (!inGap && p.x + p.width > ev.x - 16 && p.x < ev.x + 16) { sting(g, ev, p, 14, cx(p) < ev.x ? -6 : 6, -6, null, 30); if (cx(p) < ev.x) p.x = Math.min(p.x, ev.x - 16 - p.width); else p.x = Math.max(p.x, ev.x + 16); }
            }
            if (ev.x < -60) ev.wait = 180;
        },
        world(ctx, g, ev) {
            if (ev.wait > 0) return;
            const L = g.level, x = ev.x, g0 = ev.gapY - ev.gap / 2, g1 = ev.gapY + ev.gap / 2;
            for (const [y0, y1] of [[-200, g0], [g1, L.height + 200]]) {
                const gr = ctx.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, '#2a2e36'); gr.addColorStop(0.5, '#6a707c'); gr.addColorStop(1, '#2a2e36');
                ctx.fillStyle = gr; ctx.fillRect(x - 9, y0, 18, y1 - y0);
                ctx.fillStyle = '#cfd8dc';
                for (let y = Math.max(-20, y0) + 6; y < Math.min(L.height + 20, y1) - 4; y += 16) for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * 9, y - 6); ctx.lineTo(x + d * 24, y); ctx.lineTo(x + d * 9, y + 6); ctx.fill(); }
            }
            ctx.fillStyle = '#ffca28'; ctx.fillRect(x - 11, g0 - 6, 22, 6); ctx.fillRect(x - 11, g1, 22, 6);
            glow(ctx, x, ev.gapY, ev.gap * 0.6, '255,220,140', 0.12);
        },
        dangers(g, ev) { if (ev.wait > 0) return []; const L = g.level, g0 = ev.gapY - ev.gap / 2, g1 = ev.gapY + ev.gap / 2; return [{ x: ev.x - 80, y: -200, w: 110, h: g0 + 200, soon: 0 }, { x: ev.x - 80, y: g1, w: 110, h: L.height - g1 + 200, soon: 0 }]; }
    };

    // 5. Blackout: the lights go out; only fighters, fire and lightning light the arena
    E.blackout = {
        title: 'BLACKOUT', sub: 'FIGHT IN THE DARK',
        start(g, ev) { ev.t = 0; ev.flash = 0; },
        step(g, ev) { ev.t++; if (R() < 0.004) { ev.flash = 1; AudioSys.playExplosion && R() < 0.3 && AudioSys.playExplosion(); } ev.flash *= 0.9; },
        screen(ctx, W, H, g, ev) {
            const fade = Math.min(1, ev.t / 120) * (1 - ev.flash * 0.9);
            if (fade <= 0.02) return;
            const dark = ev.canvas && ev.canvas.width === W && ev.canvas.height === H ? ev.canvas : (ev.canvas = Object.assign(document.createElement('canvas'), { width: W, height: H }));
            const d = dark.getContext('2d');
            d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H); d.fillStyle = 'rgba(2,3,10,0.94)'; d.fillRect(0, 0, W, H);
            d.globalCompositeOperation = 'destination-out';
            const vs = g.viewScale || 1, z = g.camera.zoom * vs;
            const toS = (x, y) => [W / 2 + (x - g.camera.x) * z, H / 2 + (y - g.camera.y) * z];
            const hole = (x, y, r) => { const [sx, sy] = toS(x, y), rr = r * z; const gr = d.createRadialGradient(sx, sy, rr * 0.2, sx, sy, rr); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); };
            for (const p of alive(g)) { hole(cx(p), cy(p), 170); if (p.status && p.status.burn > 0) hole(cx(p), cy(p), 260); }   // a burning fighter lights the dark
            for (const w of g.weapons) if (w.active && !w.owner) hole(w.x + 15, w.y + 15, (w.def && w.def.glowMul ? 60 * w.def.glowMul : 60));
            for (const pr of g.projectiles) if (pr.active) hole(pr.x, pr.y, pr.spec && pr.spec.divine ? 220 : (pr.type === 'flame' || (pr.spec && pr.spec.look && /fire|flask/.test(pr.spec.look.s || '')) ? 130 : 50));
            // fire and light of every kind: flames, embers, explosion flashes, glowing map features, the lava itself
            let n = 0;
            for (const q of g.fx.particles) {
                if (q.type === 'flame') { if (n++ < 200) hole(q.x, q.y, 70 + q.size * 4); }
                else if (q.type === 'ember') { if (n++ < 200 && q.life > 4) hole(q.x, q.y, 34 + q.size * 3); }
                else if (q.type === 'flash') { if (n++ < 200) hole(q.x, q.y, q.size * 0.95 * (q.life / q.max)); }
            }
            if (typeof Features !== 'undefined' && Features.lights) for (const l of Features.lights(g.level)) hole(l.x, l.y, l.r);
            ctx.save(); ctx.globalAlpha = fade; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dark, 0, 0); ctx.restore();
        }
    };

    // 7. Earthquakes: the ground rumbles, rocks fall, some ledges shake loose for a while
    E.earthquake = {
        title: 'EARTHQUAKE', sub: 'HOLD ON',
        start(g, ev) { ev.t = 0; ev.next = 300; ev.quake = 0; ev.rocks = []; ev.loose = []; },
        step(g, ev) {
            const L = g.level;
            ev.t++;
            if (--ev.next <= 0 && ev.quake <= 0) { ev.quake = 150; ev.next = 480 + RND(0, 300); }
            if (ev.quake > 0) {
                ev.quake--;
                if (!g.demo && ev.quake % 6 === 0) g.fx.addTrauma(0.12);
                if (R() < 0.08) ev.rocks.push({ x: RND(40, L.width - 40), y: -20, vy: 0, r: RND(6, 12) });
                for (const p of alive(g)) if (p.grounded && R() < 0.03) { p.velocity.y = -RND(2, 4); p.grounded = false; }
                if (ev.quake === 100) { const ledges = solids(L).filter(p => !p.cage && p.y < L.height - 120 && p.width < 260 && !p.feature); for (const q of ledges) if (R() < 0.2) { q.active = false; ev.loose.push({ q, back: 300 }); g.fx.dust(q.x + q.width / 2, q.y, 10, q.width / 2, DUST_TINT[L.material]); for (let i = 0; i < 8; i++) g.fx.add({ type: 'chunk', x: q.x + R() * q.width, y: q.y, vx: RND(-1, 1), vy: RND(-1, 1), life: 60, color: '#6d5a48', size: 4, gravity: 0.35, rot: 0, vr: 0.2, drag: 0.99 }); } }
            }
            for (const l of ev.loose) if (--l.back <= 0 && !l.q.active) { l.q.active = true; g.fx.flashAt(l.q.x + l.q.width / 2, l.q.y, '255,255,255', 30, 6); }
            ev.loose = ev.loose.filter(l => !l.q.active);
            for (const r of ev.rocks) {
                r.vy += 0.4; r.y += r.vy;
                for (const p of alive(g)) if (Math.abs(cx(p) - r.x) < 15 + r.r && r.y > p.y && r.y < p.y + 20) { sting(g, r, p, 7, 0, 1, null, 40); r.dead = true; }
                if (L.platforms.some(q => q.active && r.x > q.x && r.x < q.x + q.width && r.y > q.y && r.y < q.y + 20)) { r.dead = true; g.fx.debris(r.x, r.y, '#6d5a48', 4, 3); }
                if (r.y > L.height + 40) r.dead = true;
            }
            ev.rocks = ev.rocks.filter(r => !r.dead);
        },
        world(ctx, g, ev) { for (const r of ev.rocks) { ctx.fillStyle = '#6d5a48'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(r.x + r.r * 0.3, r.y + r.r * 0.3, r.r * 0.6, 0, TAU); ctx.fill(); } },
        dangers(g, ev) { return ev.rocks.map(r => ({ x: r.x - 30, y: r.y, w: 60, h: 300, soon: 10 })); }
    };

    // 8. Storm: a ring of storm closes in; outside it you take damage
    E.storm = {
        title: 'THE STORM', sub: 'STAY INSIDE THE RING',
        start(g, ev) { const L = g.level; ev.t = 0; ev.cx = L.width * RND(0.35, 0.65); ev.cy = L.height * RND(0.45, 0.65); ev.r = 1300; ev.min = 280; },
        step(g, ev) {
            ev.t++;
            if (ev.t > 240) ev.r = Math.max(ev.min, ev.r - 0.42);
            for (const p of alive(g)) if (Math.hypot(cx(p) - ev.cx, cy(p) - ev.cy) > ev.r) sting(g, ev, p, 3, undefined, undefined, { slow: 30 }, 24);
        },
        world(ctx, g, ev) {
            const L = g.level;
            ctx.save();
            ctx.beginPath(); ctx.rect(-3000, -3000, L.width + 6000, L.height + 6000); ctx.arc(ev.cx, ev.cy, ev.r, 0, TAU, true);
            ctx.fillStyle = 'rgba(80,40,140,0.28)'; ctx.fill('evenodd');
            ctx.strokeStyle = `rgba(190,140,255,${0.6 + 0.2 * Math.sin(ev.t * 0.1)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ev.cx, ev.cy, ev.r, 0, TAU); ctx.stroke();
            ctx.restore();
            for (let i = 0; i < 3; i++) { const a = R() * TAU; ctx.strokeStyle = 'rgba(220,200,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ev.cx, ev.cy, ev.r + RND(0, 30), a, a + 0.15); ctx.stroke(); }
        },
        steer(g, ev, me) { const d = cx(me) - ev.cx; return Math.hypot(d, cy(me) - ev.cy) > ev.r - 60 ? -Math.sign(d) : 0; }
    };

    // 9. Hot potato: a lit bomb clings to one fighter; touch someone to hand it over before it blows
    E.hotPotato = {
        title: 'HOT POTATO', sub: 'PASS THE BOMB: TOUCH SOMEONE',
        start(g, ev) { ev.t = 0; ev.botSteer = new WeakMap(); this.give(g, ev); },
        give(g, ev) { const ps = alive(g); ev.holder = ps.length ? ps[(R() * ps.length) | 0] : null; ev.left = 60 * 18; ev.cd = 0; },
        step(g, ev) {
            ev.t++;
            if (!ev.holder || ev.holder.isDead) { if (ev.pause === undefined) ev.pause = 120; if (--ev.pause <= 0) { ev.pause = undefined; this.give(g, ev); } return; }
            ev.left--; if (ev.cd > 0) ev.cd--;
            const h = ev.holder;
            if (ev.cd <= 0) for (const p of alive(g)) if (p !== h && h.touchesPlayer(p)) { ev.holder = p; ev.cd = 40; g.fx.sparks(cx(p), p.y, '255,200,90', 10, -Math.PI / 2, 1.5, 4); break; }
            if (ev.left < 300 && ev.left % (ev.left < 120 ? 8 : 24) === 0) AudioSys.playAttack && AudioSys.playAttack();
            if (ev.left <= 0) {
                const holder = ev.holder;
                const x = cx(holder), y = cy(holder);
                g.fx.explosion ? g.fx.explosion(x, y, 120) : null; AudioSys.playExplosion(); if (!g.demo) g.fx.addTrauma(0.4);
                // The carrier is caught in the point-blank blast and always dies,
                // even if they were shielding or temporarily resistant to damage.
                holder.lastHitType = 'env'; holder.lastHitAt = g.frameCount; holder.shieldActive = false;
                holder.velocity.x = (R() < 0.5 ? -1 : 1) * 8; holder.velocity.y = -10; holder.grounded = false;
                const lethalDamage = Math.max(1, holder.health / (holder.isBird ? 0.2 : 1) + 1);
                holder.takeDamage(lethalDamage, null); holder.flinchNew = true; holder.hitFlash = 1;
                // Everyone else caught in the blast takes a full 50 damage. Do not
                // use sting(): its environmental damage cap would reduce this hit.
                for (const p of alive(g)) if (p !== holder && p.touchDistanceToPoint(x, y) < 140) {
                    p.lastHitType = 'env'; p.lastHitAt = g.frameCount;
                    p.takeDamage(50, null);
                    p.velocity.x = Math.sign(cx(p) - x || 1) * 7; p.velocity.y = -7; p.grounded = false;
                    p.flinchNew = true; p.hitFlash = 1;
                }
                ev.holder = null;
            }
        },
        steer(g, ev, me) {
            const h = ev.holder;
            if (!h || h.isDead) return 0;
            const states = ev.botSteer || (ev.botSteer = new WeakMap());
            const prev = states.get(me);
            const mc = cx(me), hc = cx(h), dx = mc - hc;
            if (h === me) {
                const foes = alive(g).filter(p => p !== me);
                if (!foes.length) return 0;
                const nearest = foes.reduce((best, p) => Math.abs(cx(p) - mc) < Math.abs(cx(best) - mc) ? p : best, foes[0]);
                let target = prev && prev.holder === h && prev.target && !prev.target.isDead ? prev.target : nearest;
                if (target !== nearest && Math.abs(cx(nearest) - mc) + 64 < Math.abs(cx(target) - mc)) target = nearest;
                const tx = cx(target) - mc;
                let dir = Math.abs(tx) > 24 ? Math.sign(tx) : (prev && prev.holder === h && prev.dir) || me.facing || 1;
                if (prev && prev.holder === h && prev.target === target && ev.t < prev.until && tx * prev.dir >= -12) dir = prev.dir;
                states.set(me, { holder: h, target, dir, until: ev.t + 12 });
                return dir;
            }
            if (Math.abs(dx) >= 300) { states.delete(me); return 0; }
            let dir;
            if (prev && prev.holder === h && ev.t < prev.until && dx * prev.dir >= -12) {
                dir = prev.dir;
            } else {
                // Keep a small dead band at the holder's center so tiny position
                // changes cannot reverse the bot's input every frame.
                dir = Math.abs(dx) > 24 ? Math.sign(dx) : (prev && prev.holder === h && prev.dir) || -h.facing || 1;
            }
            states.set(me, { holder: h, dir, until: ev.t + 12 });
            return dir;
        },
        world(ctx, g, ev) { const h = ev.holder; if (!h || h.isDead) return; bombArt(ctx, cx(h), h.y - 30, 13, ev.t, ev.left, true); }
    };

    // 10. Ice age: frost creeps over every floor, footing gets worse and standing still freezes you
    E.iceAge = {
        title: 'ICE AGE', sub: 'KEEP MOVING',
        start(g, ev) { ev.t = 0; },
        step(g, ev) {
            const L = g.level;
            ev.t++;
            const k = Math.min(1, ev.t / 1800);
            for (const p of alive(g)) {
                if (p.grounded) { const e = p.env || (p.env = { grip: 1, speed: 1, jump: 1, grav: 1 }); e.grip = Math.min(e.grip, 1 - 0.85 * k); }
                p.still = Math.abs(p.velocity.x) < 0.3 && p.grounded ? (p.still || 0) + 1 : 0;
                if (p.still > 240 && k > 0.4) { g.applyStatus(p, { freeze: 60 }, null, null, 0); p.still = 0; }
            }
            if (R() < 0.5) g.fx.add({ type: 'puff', x: RND(0, L.width), y: -10, vx: RND(-0.4, 0.4), vy: RND(0.8, 1.6), life: 300, color: '255,255,255', size: 1.6, grow: 0, alpha: 0.8 });
        },
        world(ctx, g, ev) {
            const k = Math.min(1, ev.t / 1800);
            if (k < 0.05) return;
            ctx.fillStyle = `rgba(210,240,255,${0.65 * k})`;
            for (const q of g.level.platforms) if (q.active && q.type !== 'trampoline' && !q.noDraw) { ctx.fillRect(q.x, q.y - 2, q.width, 4); for (let x = q.x + 8; x < q.x + q.width - 6; x += 22) { ctx.beginPath(); ctx.moveTo(x - 2, q.y + q.height); ctx.lineTo(x, q.y + q.height + 4 + 8 * k); ctx.lineTo(x + 2, q.y + q.height); ctx.fill(); } }
        }
    };

    // countdown read-out at the top of the screen
    function timer(ctx, W, y, left, label) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const urgent = left < 600, pulse = urgent ? 1 + 0.08 * Math.max(0, Math.sin(left * 0.3)) : 1;
        ctx.translate(W / 2, y + 28); ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(8,10,20,0.7)'; ctx.beginPath(); ctx.roundRect(-70, -24, 140, 48, 12); ctx.fill();
        ctx.strokeStyle = urgent ? '#ff5252' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 10px Orbitron, sans-serif'; ctx.fillText(label, 0, -9);
        ctx.fillStyle = urgent ? '#ff5252' : '#ffffff'; ctx.font = '900 20px Orbitron, sans-serif'; ctx.fillText(fmt(left), 0, 15);
        ctx.restore();
    }

    // ---------- choosing and running ----------
    let forced = null;
    try { const q = new URLSearchParams(location.search).get('event'); if (q && E[q]) forced = q; } catch (e) { /* tests */ }
    const startBase = Game.prototype.startLevel;
    Game.prototype.startLevel = function (regenerate) {
        // undo what the last event did to a level that is being reused
        const old = this.roundEvent;
        if (old && old.loose) for (const l of old.loose) l.q.active = true;
        if (this.level) this.level.platforms = this.level.platforms.filter(q => !q.cage);
        this.roundEvent = null;
        const r = startBase.apply(this, arguments);
        this.roundEvent = null;
        if (this.level) this.level.extraDangers = [];
        const angel = this.levelNum % 5 === 0;
        if (this.state === 'LOBBY' || (angel && !forced)) return r;
        const chance = this.demo ? 0.25 : 0.38;
        const kind = forced || (R() < chance ? Object.keys(E)[(R() * Object.keys(E).length) | 0] : null);
        if (!kind) return r;
        const ev = { kind };
        try { E[kind].start(this, ev); this.roundEvent = ev; } catch (e) { this.roundEvent = null; return r; }
        return r;
    };
    // the event is announced right after FIGHT!
    const cdBase = Game.prototype.beginCountdown;
    Game.prototype.beginCountdown = function (openMatch) {
        cdBase.call(this, openMatch);
        const ev = this.roundEvent;
        if (ev) this.banner(E[ev.kind].title, E[ev.kind].sub, '#ff8a65', Math.max(0, this.countdownEnd - performance.now()) + 900, 2600);
    };
    if (typeof BotBrain !== 'undefined') {
        const driveBase = BotBrain.prototype.drive;
        BotBrain.prototype.drive = function (it) {
            const out = driveBase.call(this, it);
            const g = this.game, ev = g && g.roundEvent, me = this.body;
            if (!ev || !E[ev.kind].steer || !me || me.isDead || me.isBird) return out;
            if (this.zoneNav === this.frame) return out;   // the bot's own route planning (bot-features.js) is already taking it there
            if (this.difficulty === 'easy' && this.frame % 90 > 45) return out;
            const s = E[ev.kind].steer(g, ev, me);
            if (s) { out.x = s; if (this.plan && this.plan.tag !== 'event') this.plan = null; }
            return out;
        };
    }
    // runs inside the level step, after the map features reset and set their effects
    const updBase = Level.prototype.update;
    Level.prototype.update = function () {
        updBase.call(this);
        const g = window.game, ev = g && g.roundEvent;
        if (!ev || g.level !== this || g.roundOver) return;
        if (!this.features) for (const p of g.players) if (p.env) { p.env.grip = 1; p.env.speed = 1; p.env.jump = 1; p.env.grav = 1; }
        try { E[ev.kind].step(g, ev); } catch (e) { /* never stop the match */ }
        this.extraDangers = E[ev.kind].dangers ? E[ev.kind].dangers(g, ev) : [];
    };
    const fxDraw = FX.prototype.draw;
    FX.prototype.draw = function (ctx) {
        const g = window.game, ev = g && g.roundEvent;
        if (ev && g.fx === this && E[ev.kind].world) { ctx.save(); try { E[ev.kind].world(ctx, g, ev); } catch (e) { /* skip */ } ctx.restore(); }
        fxDraw.call(this, ctx);
    };
    const vigBase = Game.prototype.drawVignette;
    Game.prototype.drawVignette = function (ctx, W, H) {
        vigBase.call(this, ctx, W, H);
        const ev = this.roundEvent;
        if (ev && E[ev.kind].screen) { try { E[ev.kind].screen(ctx, W, H, this, ev); } catch (e) { /* skip */ } }
    };
    // the countdown sits just under the round badge
    const hudBase = Game.prototype.drawHUD;
    Game.prototype.drawHUD = function (ctx, W, H) {
        hudBase.call(this, ctx, W, H);
        const ev = this.roundEvent;
        if (!ev || !E[ev.kind].hud) return;
        const n = this.players.length, rows = n > 5 ? 2 : 1, perRow = Math.ceil(n / rows);
        const cardW = n <= 2 ? 220 : Math.min(220, (W - 32 - (perRow - 1) * 8) / perRow), cardH = cardW < 170 ? 40 : 54;
        const by = n <= 2 ? 12 : 14 + rows * (cardH + 6) + 4;
        try { E[ev.kind].hud(ctx, W, by + 66, this, ev); } catch (e) { /* skip */ }
    };
    return { E, count: () => Object.keys(E).length };
})();
