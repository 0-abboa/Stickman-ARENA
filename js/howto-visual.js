// How to Play, shown as small live scenes instead of paragraphs. Each card is a canvas that plays a short
// loop with the game's own fighters, platforms, bouncers and weapons, plus a line or two of text. The loops
// only run while the panel is open and a card is on screen. Keyboard keys are drawn on desktop only; touch
// screens get a picture of the on-screen controls instead.
const HowToVisual = (() => {
    const W = 480, H = 270, GROUND = 210;
    let raf = 0, cards = [], root = null, running = false, lv = null, pattern = null;

    // ---------- tiny world ----------
    function world() {
        if (!lv) {
            if (!Graphics.textures.dirt) Graphics.init();
            lv = new Level(W, H);
            lv.material = 'dirt';
        }
        pattern = lv.getMaterialPattern();
        return lv;
    }
    const fake = { alpha: 1, frameCount: 0, level: { material: 'dirt', platforms: [], width: W, height: H }, kingId: null, teamMode: false, fx: { clock: 0, dust() {} } };
    function fighter(color, x, facing) {
        const p = new Player(Math.floor(Math.random() * 40) + 1, x, GROUND - 60, color, 'none');
        p.grounded = true; p.facing = facing || 1; p.prevX = p.x; p.prevY = p.y; p.label = '';
        for (let k = 0; k < 12; k++) p.animate(1, fake);
        return p;
    }
    // move a fighter and advance its animation one frame
    function move(p, x, y, vx, vy, grounded) {
        p.prevX = p.x; p.prevY = p.y; p.x = x; p.y = y; p.velocity.x = vx; p.velocity.y = vy; p.grounded = grounded;
        p.animate(1, fake);
    }
    // ---------- drawing helpers ----------
    const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    // sky and hills in screen space; the hills drift slower than the ground (parallax)
    function sky(ctx, t, camX) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#3f8fdc'); g.addColorStop(0.7, '#a9d6f7'); g.addColorStop(1, '#f5e3bd');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (const [x, y, s] of [[60, 46, 1.4], [300, 34, 1.1], [410, 80, 0.8]]) {
            const cx = (((x + t * 0.12 * s - camX * 0.08 * s) % (W + 160)) + W + 160) % (W + 160) - 80;
            ctx.beginPath(); ctx.ellipse(cx, y, 30 * s, 9 * s, 0, 0, Math.PI * 2); ctx.ellipse(cx + 20 * s, y + 3, 22 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
        }
        const off = camX * 0.25;
        ctx.fillStyle = '#8fcf8a'; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 160 + Math.sin((x + off) * 0.018) * 16);
        ctx.lineTo(W, H); ctx.fill();
        ctx.fillStyle = '#74bb73'; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 190 + Math.sin((x + off * 1.8) * 0.03 + 2) * 12);
        ctx.lineTo(W, H); ctx.fill();
    }
    // a camera that glides toward a target; world drawing happens between stage() and unstage()
    function camera() { return { x: 0, y: 0, z: 1, sx: 0, sy: 0, shake: 0 }; }
    function aim(c, x, y, z, k, snap) {
        if (snap) { c.x = x; c.y = y; c.z = z; c.shake = 0; return; }
        c.x += (x - c.x) * k; c.y += (y - c.y) * k; c.z += (z - c.z) * k;
        c.shake *= 0.86;
    }
    function stage(ctx, t, c) {
        sky(ctx, t, c.x);
        ctx.save();
        const sx = (Math.random() - 0.5) * c.shake, sy = (Math.random() - 0.5) * c.shake;
        ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y);
    }
    const unstage = (ctx) => ctx.restore();
    const scr = (c, x, y) => [(x - c.x) * c.z + W / 2, (y - c.y) * c.z + H / 2];
    function floor(ctx) { platform(ctx, -700, GROUND, 1900, 140); }
    function platform(ctx, x, y, w, h) {
        lv.drawPlatform(ctx, { x, y, width: w, height: h, type: 'static', seed: 7, motion: null, active: true }, pattern);
    }
    // screen-space caption that pops in, holds, then fades
    function tag(ctx, text, x, y, color, size, t, t0, t1) {
        if (t < t0 || t > t1) return;
        const age = t - t0, pop = 1 + 0.4 * Math.max(0, 1 - age / 9) * Math.cos(age * 0.9);
        const a = clamp01(age / 5) * clamp01((t1 - t) / 14);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
        // a wide face: shrink long captions to fit the picture, and keep them clear of the edges
        ctx.font = `900 ${size || 18}px Orbitron, sans-serif`;
        const tw = ctx.measureText(text).width, k = tw > W - 36 ? (W - 36) / tw : 1;
        ctx.font = `900 ${(size || 18) * k}px Orbitron, sans-serif`;
        const hw = tw * k / 2 * pop, cx = Math.max(hw + 6, Math.min(W - hw - 6, x));
        ctx.translate(cx, y); ctx.scale(pop, pop); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,14,30,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0); ctx.fillStyle = color || '#fff'; ctx.fillText(text, 0, 0); ctx.restore();
    }
    const label = (ctx, text, x, y, color, size) => tag(ctx, text, x, y, color, size, 20, 0, 999);
    // hit sparks and rings in world space: fx = [{ x, y, t0, kind, big }]
    function drawFx(ctx, list, t) {
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i], age = t - e.t0;
            if (age < 0) continue;
            const life = e.kind === 'ring' ? 22 : e.kind === 'dust' ? 26 : 14;
            if (age > life) { list.splice(i, 1); continue; }
            const k = age / life;
            ctx.save(); ctx.translate(e.x, e.y); ctx.globalCompositeOperation = 'lighter';
            if (e.kind === 'spark') {
                const r = (e.big ? 34 : 22) * ease(k * 1.6), n = e.big ? 10 : 7;
                ctx.strokeStyle = `rgba(255,${e.big ? 190 : 235},120,${1 - k})`; ctx.lineWidth = (e.big ? 4 : 3) * (1 - k) + 1; ctx.lineCap = 'round';
                for (let j = 0; j < n; j++) { const an = j / n * Math.PI * 2 + e.t0, r0 = r * 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); ctx.stroke(); }
                ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k * 2)})`; if (k < 0.5) { ctx.beginPath(); ctx.arc(0, 0, (e.big ? 14 : 9) * (1 - k), 0, Math.PI * 2); ctx.fill(); }
            } else if (e.kind === 'ring') {
                ctx.strokeStyle = e.color ? e.color.replace('A', String(1 - k)) : `rgba(255,240,170,${1 - k})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(0, 0, 8 + 40 * ease(k), 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
                for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(d * (6 + 14 * k), -3 * k, 4 + 6 * k, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();
        }
    }
    // fade in from and out to black at the ends of a loop so restarts never pop
    function edgeFade(ctx, t, len) {
        const a = Math.max(1 - t / 14, 1 - (len - 1 - t) / 14);
        if (a > 0) { ctx.save(); ctx.fillStyle = `rgba(14,18,44,${Math.min(1, a)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
    const hurt = (p) => { p.hitFlash = 1; p.flinchNew = true; };
    const swing = (p) => { p.attackCooldown = 0; p.attack(); p.wantsToAttack = false; p.wantsToPunch = false; };

    // The three picture-only pages are laid out on a 320-wide sheet; Orbitron is wide, so every line of text is
    // shrunk to fit and kept inside the sheet
    function guardText(ctx, limit) {
        if (ctx.__guarded) return;
        ctx.__guarded = true;
        const orig = ctx.fillText.bind(ctx);
        ctx.fillText = (t, x, y) => {
            let w = ctx.measureText(t).width;
            const maxW = limit - 12;
            if (w > maxW) { ctx.font = ctx.font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => (n * maxW / w).toFixed(2) + 'px'); w = maxW; }
            const al = ctx.textAlign;
            let cx = x;
            if (al === 'center') cx = Math.max(w / 2 + 6, Math.min(limit - w / 2 - 6, x));
            else if (al === 'right') cx = Math.min(limit - 6, Math.max(w + 6, x));
            else cx = Math.max(6, Math.min(limit - w - 6, x));
            orig(t, cx, y);
        };
    }

    // ---------- scenes: each returns { len, draw(ctx, t) } and loops every `len` frames ----------
    const SCENES = {
        // run, jump, jump again in the air
        move() {
            const a = fighter('#42a5f5', 40, 1), c = camera(), fx = [];
            let x = 40, y = GROUND - 60, vy = 0, air = false, vx = 0;
            return { len: 360, draw(ctx, t) {
                if (t === 0) { x = 40; y = GROUND - 60; vy = 0; air = false; vx = 0; fx.length = 0; a.facing = 1; aim(c, x + 15, GROUND - 100, 1.1, 1, true); }
                const goal = t < 70 ? 3.4 : t < 170 ? 0 : t < 255 ? 3.4 : t < 275 ? 0 : -3;
                vx += (goal - vx) * 0.18;
                if (vx > 0.3) a.facing = 1; else if (vx < -0.3) a.facing = -1;
                if ((t === 70 || t === 285) && !air) { vy = -8.6; air = true; a.jumpCount = 1; fx.push({ x: x + 15, y: GROUND, t0: t, kind: 'dust' }); }
                if ((t === 94 || t === 308) && air) { vy = -7.6; a.jumpCount = 2; fx.push({ x: x + 15, y: y + 62, t0: t, kind: 'ring', color: 'rgba(255,240,170,A)' }); }
                if (air) { vy += 0.5; y += vy; if (y >= GROUND - 60) { y = GROUND - 60; vy = 0; air = false; a.jumpCount = 0; a.squash = 0.8; fx.push({ x: x + 15, y: GROUND, t0: t, kind: 'dust' }); } }
                x += vx;
                move(a, x, y, vx, vy, !air);
                aim(c, x + 15 + vx * 14, GROUND - 100, 1.1, 0.09);
                stage(ctx, t, c); floor(ctx); a.draw(ctx, fake); drawFx(ctx, fx, t); unstage(ctx);
                tag(ctx, 'RUN', 96, 44, '#fff', 22, t, 6, 60);
                tag(ctx, 'JUMP', 96, 44, '#fff176', 24, t, 68, 118);
                tag(ctx, 'JUMP AGAIN!', 96, 76, '#ffb74d', 22, t, 94, 150);
                tag(ctx, 'DOUBLE JUMP', 96, 44, '#fff', 20, t, 285, 345);
            } };
        },
        // punch, a weapon drops, pick it up, hit harder
        fight() {
            const a = fighter('#42a5f5', 170, 1), b = fighter('#ef5350', 240, -1), c = camera(), fx = [];
            const wp = new Weapon(80, -80, 'sword'), platsF = [{ x: -700, y: GROUND, width: 1900, height: 140, active: true, type: 'static' }];
            let ax = 170, bx = 240, bvx = 0, wpHeld = false;
            const land = (big, dmg) => { fx.push({ x: b.x + 15, y: b.y + 22, t0: _t, kind: 'spark', big }); b.health = Math.max(8, b.health - dmg); hurt(b); bvx = big ? 7 : 4; c.shake = big ? 9 : 4; };
            let _t = 0;
            return { len: 480, draw(ctx, t) {
                _t = t;
                if (t === 0) { a.weapon = null; wpHeld = false; wp.owner = null; wp.x = 105; wp.y = wp.prevY = -90; wp.landed = false; wp.active = true; wp.lock = 0; ax = 170; bx = 240; bvx = 0; b.health = 100; fx.length = 0; aim(c, 205, GROUND - 40, 1.7, 1, true); }
                if (t === 30 || t === 62) { swing(a); } if (t === 36 || t === 68) land(false, 8);
                if (t >= 96) wp.update({ platforms: platsF });
                // after the punches the red fighter backs off a little, then waits
                const lead = t < 100 ? 1 : 0;
                if (t < 100) { ax += ((bx - 50) - ax) * 0.12; a.facing = 1; }
                else if (t < 150) { /* beat */ }
                else if (!wpHeld) { if (ax > wp.x + 12) { ax -= 3.6; a.facing = -1; } }
                if (!wpHeld && t > 150 && ax <= wp.x + 12) { wpHeld = true; a.weapon = wp; wp.owner = a; fx.push({ x: ax + 15, y: GROUND - 30, t0: t, kind: 'ring' }); a.facing = 1; }
                if (wpHeld && t < 330) { if (ax < bx - 56) { ax += 3.6; a.facing = 1; } }
                if (t === 340 || t === 392) swing(a); if (t === 346 || t === 398) land(true, 24);
                if (t > 420) { /* b shows low health */ }
                bx += bvx; bvx *= 0.82; if (bvx < 0.2) bx += (240 - bx) * 0.03;
                a.attackCooldown = Math.max(0, a.attackCooldown - 1);
                move(a, ax, GROUND - 60, 0, 0, true); move(b, bx, GROUND - 60, bvx, 0, true); b.facing = -1;
                if (wpHeld) { wp.x = a.x + 20; wp.y = a.y; }
                aim(c, (a.x + b.x) / 2 + 15 - (wpHeld ? 0 : (t > 100 && t < 260 ? 45 : 0)), GROUND - 42, 1.6, 0.06);
                stage(ctx, t, c); floor(ctx);
                if (!wpHeld && t >= 96) { wp.animate(1); wp.draw(ctx, 1, []); }
                a.draw(ctx, fake); b.draw(ctx, fake); drawFx(ctx, fx, t); unstage(ctx);
                tag(ctx, 'PUNCH', 240, 40, '#fff', 24, t, 24, 100);
                tag(ctx, 'WEAPONS DROP FROM THE SKY', 240, 40, '#ffe082', 20, t, 100, 250);
                tag(ctx, 'WALK OVER ONE TO TAKE IT', 240, 68, '#fff', 17, t, 140, 256);
                tag(ctx, 'HITS MUCH HARDER', 240, 40, '#ffb74d', 24, t, 336, 440);
            } };
        },
        // the shield blocks swings, but only for about a second
        shield() {
            const a = fighter('#66bb6a', 190, 1), b = fighter('#ef5350', 244, -1), c = camera(), fx = [];
            const wp = new Weapon(0, 0, 'sword'); b.weapon = wp; wp.owner = b;
            let avx = 0, ax = 190;
            return { len: 300, draw(ctx, t) {
                if (t === 0) { a.health = 100; ax = 190; avx = 0; fx.length = 0; aim(c, 220, GROUND - 42, 1.7, 1, true); }
                a.shieldActive = t > 18 && t < 160; a.shieldHit = Math.max(0, (a.shieldHit || 0) - 0.05);
                for (const s of [50, 95, 135]) { if (t === s) swing(b); if (t === s + 6) { a.shieldHit = 1; fx.push({ x: a.x + 32, y: a.y + 28, t0: t, kind: 'ring', color: 'rgba(130,210,255,A)' }); c.shake = 3; } }
                if (t === 200) swing(b);
                if (t === 206) { a.health = 55; hurt(a); fx.push({ x: a.x + 15, y: a.y + 22, t0: t, kind: 'spark', big: true }); avx = 6; c.shake = 8; }
                ax += avx; avx *= 0.8; if (t > 215) ax += (190 - ax) * 0.04;
                b.attackCooldown = Math.max(0, b.attackCooldown - 1);
                move(a, ax, GROUND - 60, avx, 0, true); move(b, 244, GROUND - 60, 0, 0, true);
                a.facing = 1; b.facing = -1; wp.x = b.x + 20; wp.y = b.y;
                aim(c, 220, GROUND - 42, 1.7, 0.08);
                stage(ctx, t, c); floor(ctx); a.draw(ctx, fake); b.draw(ctx, fake); drawFx(ctx, fx, t); unstage(ctx);
                if (t > 18 && t < 160) {
                    const f = 1 - (t - 18) / 142;
                    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(130, 50, 220, 12, 6); ctx.fill(); ctx.fillStyle = f > 0.3 ? '#81d4fa' : '#ffb74d'; ctx.beginPath(); ctx.roundRect(130, 50, Math.max(4, 220 * f), 12, 6); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(130, 50, 220, 12, 6); ctx.stroke(); ctx.restore();
                }
                tag(ctx, 'SHIELD UP', 240, 36, '#b3e5fc', 20, t, 18, 160);
                for (const s of [50, 95, 135]) tag(ctx, 'BLOCKED', 160, 130, '#81d4fa', 22, t, s + 6, s + 36);
                tag(ctx, 'IT ONLY LASTS ABOUT A SECOND', 240, 36, '#ffcc80', 18, t, 150, 290);
                tag(ctx, 'THEN IT RECHARGES. TIME IT!', 240, 62, '#fff', 16, t, 175, 290);
                tag(ctx, 'OUCH', 150, 120, '#ff8a80', 26, t, 206, 250);
            } };
        },
        // knocked back off the edge: out immediately
        edge() {
            const a = fighter('#ffca28', 292, -1), b = fighter('#ab47bc', 238, 1), c = camera(), fx = [];
            const wp = new Weapon(0, 0, 'hammer'); b.weapon = wp; wp.owner = b;
            let ax = 292, ay = GROUND - 60, avx = 0, avy = 0, out = false, rot = 0, outAt = 9999;
            return { len: 340, draw(ctx, t) {
                if (t === 0) { ax = 292; ay = GROUND - 60; avx = 0; avy = 0; out = false; rot = 0; outAt = 9999; a.health = 100; fx.length = 0; aim(c, 215, GROUND + 14, 1.0, 1, true); }
                if (t === 40) swing(b);
                if (t === 48 && !out) { out = true; avx = 4.6; avy = -5; a.health = 30; hurt(a); fx.push({ x: ax + 15, y: ay + 22, t0: t, kind: 'spark', big: true }); c.shake = 12; }
                if (out) { avy += 0.42; ax += avx; ay += avy; rot += 0.2; }
                b.attackCooldown = Math.max(0, b.attackCooldown - 1);
                if (!out) move(a, ax, ay, 0, 0, true); else move(a, ax, ay, avx, avy, false);
                move(b, 240, GROUND - 60, 0, 0, true); b.facing = 1; wp.x = b.x + 22; wp.y = b.y;
                aim(c, 215, GROUND + 14, 1.0, 0.08);
                stage(ctx, t, c);
                const g = ctx.createLinearGradient(0, GROUND + 40, 0, GROUND + 200); g.addColorStop(0, 'rgba(20,16,50,0)'); g.addColorStop(1, 'rgba(20,16,50,0.9)'); ctx.fillStyle = g; ctx.fillRect(-300, GROUND + 40, 900, 200);
                platform(ctx, 50, GROUND, 290, 44);
                b.draw(ctx, fake);
                ctx.save();
                if (out) { ctx.translate(ax + 15, ay + 30); ctx.rotate(rot); ctx.translate(-(ax + 15), -(ay + 30)); }
                a.draw(ctx, fake); ctx.restore();
                drawFx(ctx, fx, t); unstage(ctx);
                tag(ctx, 'HITS KNOCK YOU BACK', 240, 26, '#fff', 20, t, 10, 150);
                if (out && outAt === 9999 && ay > GROUND + 40) outAt = t;
                tag(ctx, 'OUT!', 330, 196, '#ff5252', 48, t, outAt, 330);
                tag(ctx, 'OFF THE EDGE = KNOCKED OUT', 240, 62, '#ffab91', 18, t, outAt + 8, 330);
            } };
        },
        // bouncers launch you onto a moving platform
        bounce() {
            const a = fighter('#26c6da', 30, 1), c = camera(), fx = [];
            const mat = lv.createPlatform(150, GROUND, 100, 20, 'trampoline', { power: 15 });
            let x = 30, y = GROUND - 60, vx = 0, vy = 0, mode = 'ground', rideT = 0, pt = 0;
            const PT = 100, PY = GROUND - 100;
            const plat = (t) => 245 + Math.sin(t * 0.03) * 34;
            return { len: 420, draw(ctx, t) {
                lv.time = t;
                if (t === 0) { x = 30; y = GROUND - 60; vx = 0; vy = 0; mode = 'ground'; rideT = 0; mat.spring = mat.springV = mat.glow = 0; fx.length = 0; a.jumpCount = 0; aim(c, 150, GROUND - 92, 1.0, 1, true); }
                const px = plat(t), pvx = plat(t) - plat(t - 1);
                if (mode === 'ground') {
                    vx += (2.6 - vx) * 0.2; x += vx;
                    if (x + 15 > 168 && x + 15 < 245) { mode = 'air'; vy = -11.4; vx = 1.6; mat.shake = 1; a.squash = 0.9; a.jumpCount = 2; fx.push({ x: x + 15, y: GROUND, t0: t, kind: 'ring', color: 'rgba(150,255,200,A)' }); }
                } else if (mode === 'air') {
                    const pf = y + 60; vy += 0.5; y += vy; if (vy < 14) vx = Math.max(0.8, Math.min(3.2, (px + PT / 2 + pvx * 12 - (x + 15)) * 0.05)); x += vx;
                    if (vy > 0 && pf <= PY + 2 && y + 60 >= PY && x + 15 > px && x + 15 < px + PT) { mode = 'ride'; y = PY - 60; vy = 0; vx = 0; rideT = 0; a.jumpCount = 0; a.squash = 0.7; fx.push({ x: x + 15, y: PY, t0: t, kind: 'dust' }); }
                    else if (y >= GROUND - 60) { y = GROUND - 60; vy = 0; vx = 0; mode = 'ground'; a.jumpCount = 0; }
                } else if (mode === 'ride') {
                    x += pvx; rideT++; if (rideT > 90) { mode = 'off'; vx = 1.6; }
                } else if (mode === 'off') {
                    x += vx; if (x + 15 > px + PT + 6) { mode = 'air'; vy = 0; } 
                }
                if (mode === 'air' && vy === 0 && x > 0) { /* stepping off */ }
                if (mat.shake > 0) { mat.springV += 6; mat.glow = 1; mat.shake = 0; }
                mat.springV += -0.35 * mat.spring - 0.18 * mat.springV; mat.spring += mat.springV; mat.glow = Math.max(0, mat.glow - 0.03);
                a.facing = 1;
                move(a, x, y, vx, vy, mode === 'ground' || mode === 'ride' || mode === 'off');
                aim(c, x + 15 + 30, GROUND - 92, 1.0, 0.07);
                stage(ctx, t, c);
                platform(ctx, -700, GROUND, 850, 140); platform(ctx, 250, GROUND, 900, 140); platform(ctx, 150, GROUND + 18, 100, 122);
                lv.drawBouncer(ctx, mat);
                platform(ctx, px, PY, PT, 16);
                a.draw(ctx, fake); drawFx(ctx, fx, t); unstage(ctx);
                tag(ctx, 'STEP ON A BOUNCER', 240, 40, '#a5ffd0', 20, t, 16, 100);
                tag(ctx, 'BOING!', 240, 40, '#a5ffd0', 28, t, 104, 160);
                tag(ctx, 'LAND ON MOVING PLATFORMS', 240, 40, '#fff', 19, t, 190, 330);
                tag(ctx, 'AND RIDE THEM', 240, 66, '#fff', 17, t, 215, 330);
            } };
        },
        // the angel crystal
        angel() {
            const a = fighter('#ef5350', 60, 1), c = camera(), fx = [];
            const crystal = new Weapon(300, 30, 'bird_crystal'), platsF = [{ x: -700, y: GROUND, width: 1900, height: 140, active: true, type: 'static' }];
            let angel = false, ax = 60, at0 = 9999;
            return { len: 460, draw(ctx, t) {
                if (t === 0) { angel = false; at0 = 9999; crystal.owner = null; crystal.x = 300; crystal.y = crystal.prevY = 30; crystal.landed = false; crystal.lock = 0; crystal.active = true; a.isBird = false; a.wings = false; a.weapon = null; a.color = a.originalColor; a.health = a.maxHealth = 100; ax = 60; fx.length = 0; aim(c, 160, GROUND - 90, 1.15, 1, true); }
                if (!angel) crystal.update({ platforms: platsF });
                if (!angel && t > 110 && ax < 288) { ax += 2.4; a.facing = 1; }
                if (!angel && ax >= 288) { angel = true; at0 = t; crystal.owner = a; a.weapon = crystal; a.isBird = true; a.wings = true; a.maxHealth = a.health = 300; fx.push({ x: ax + 15, y: GROUND - 30, t0: t, kind: 'ring', color: 'rgba(255,255,255,A)' }); c.shake = 5; }
                let ay = GROUND - 60;
                if (angel) ay -= ease((t - at0) / 60) * 62 + Math.sin(t * 0.07) * 4;
                move(a, ax, ay, 0, 0, !angel);
                aim(c, angel ? ax + 15 - 40 : (t < 100 ? 190 : (a.x + 15 + 300) / 2), GROUND - 100, 1.15, 0.05);
                stage(ctx, t, c); floor(ctx);
                if (!angel) { crystal.animate(1); crystal.draw(ctx, 1, []); }
                a.draw(ctx, fake); drawFx(ctx, fx, t); unstage(ctx);
                tag(ctx, 'EVERY FIFTH ROUND', 240, 36, '#e1bee7', 20, t, 20, 200);
                tag(ctx, 'A CRYSTAL FALLS', 240, 62, '#e1bee7', 18, t, 40, 200);
                tag(ctx, 'GRAB IT TO BECOME AN ANGEL', 240, 36, '#fff', 20, t, at0 + 5, 460);
                tag(ctx, 'FLIES · 300 HEALTH', 240, 62, '#ffe082', 18, t, at0 + 50, 460);
                tag(ctx, 'NIMBUS STAFF: FLY AND FIGHT BACK', 240, 88, '#b3e5fc', 16, t, at0 + 110, 460);
            } };
        },
        // controls: keyboard (desktop)
        keys() {
            const seq = [['A', 'D'], ['W'], ['S'], ['Q'], ['E']];
            const names = ['MOVE', 'JUMP (TWICE FOR A DOUBLE JUMP)', 'CROUCH / SWAP WEAPON', 'ATTACK', 'SHIELD'];
            const kb = (ctx, x, y, k, on, w, press) => { ctx.save(); const dy = on ? 2 * press : 0; ctx.fillStyle = on ? '#ffca28' : 'rgba(255,255,255,0.14)'; ctx.strokeStyle = on ? '#fff3b0' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y + dy, w || 30, 30, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = on ? '#2a1c00' : '#fff'; ctx.font = '800 14px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k, x + (w || 30) / 2, y + 20 + dy); ctx.restore(); };
            return { len: 300, draw(ctx, t) {
                ctx.save(); ctx.scale(1.5, 1.5);
                ctx.fillStyle = '#16204a'; ctx.fillRect(0, 0, 320, 180);
                const i = Math.floor(t / 60) % 5, on = (k) => seq[i].includes(k), pr = Math.sin(Math.min(1, (t % 60) / 10) * Math.PI);
                kb(ctx, 62, 40, 'W', on('W'), 0, pr); kb(ctx, 28, 74, 'A', on('A'), 0, pr); kb(ctx, 62, 74, 'S', on('S'), 0, pr); kb(ctx, 96, 74, 'D', on('D'), 0, pr);
                kb(ctx, 150, 40, 'Q', on('Q'), 0, pr); kb(ctx, 184, 40, 'E', on('E'), 0, pr);
                kb(ctx, 28, 112, 'SPACE', on('W'), 98, pr);
                ctx.fillStyle = '#90caf9'; ctx.font = '800 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PLAYER 1', 78, 28); ctx.font = '800 10px Orbitron, sans-serif'; ctx.fillText('PLAYER 2 (DOUBLES)', 262, 28);
                kb(ctx, 252, 40, '↑', false); kb(ctx, 218, 74, '←', false); kb(ctx, 252, 74, '↓', false); kb(ctx, 286, 74, '→', false);
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 11px Orbitron, sans-serif'; ctx.fillText('/  attack     .  shield', 262, 126);
                ctx.fillStyle = '#ffca28'; ctx.font = '900 14px Orbitron, sans-serif'; ctx.fillText(names[i], 160, 160);
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '700 10px Orbitron, sans-serif'; ctx.fillText('Esc pauses. A controller works too.', 160, 175);
                ctx.restore();
            } };
        },
        // controls: touch (phones and tablets)
        touch() {
            return { len: 240, draw(ctx, t) {
                ctx.save(); ctx.scale(1.5, 1.5);
                ctx.fillStyle = '#16204a'; ctx.fillRect(0, 0, 320, 180);
                ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(10, 12, 300, 150, 14); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(12, 14, 148, 146);
                ctx.fillStyle = '#90caf9'; ctx.font = '800 10px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DRAG ANYWHERE ON THE LEFT', 86, 34);
                const ph = (t % 240) / 240, sx = 86, sy = 100;
                ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                const tx = ph < 0.5 ? Math.sin(ph * 4 * Math.PI) * 22 : 0, ty = ph < 0.5 ? 0 : ph < 0.75 ? -22 * ease((ph - 0.5) * 8) : 22 * ease((ph - 0.75) * 8);
                ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(sx + tx, sy + ty, 14, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffca28'; ctx.font = '800 11px Orbitron, sans-serif'; ctx.fillText(ph < 0.5 ? 'LEFT / RIGHT = MOVE' : ph < 0.75 ? 'UP = JUMP' : 'DOWN = CROUCH', sx, sy + 54);
                const btn = (x, y, r, col, txt, hot) => { ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = hot ? 1 : 0.65; ctx.beginPath(); ctx.arc(x, y, r * (hot ? 0.94 : 1), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = hot ? 3 : 1.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = '800 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(txt, x, y + 3); ctx.restore(); };
                const hot = Math.floor(t / 50) % 3;
                btn(214, 78, 22, '#2196f3', 'SHIELD', hot === 0); btn(264, 78, 22, '#f44336', 'ATTACK', hot === 1);
                ctx.save(); ctx.fillStyle = '#4caf50'; ctx.globalAlpha = hot === 2 ? 1 : 0.65; ctx.beginPath(); ctx.roundRect(196, 112, 86, 30, 15); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = hot === 2 ? 3 : 1.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = '800 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('JUMP', 239, 132); ctx.restore();
                ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.roundRect(280, 20, 22, 22, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(286, 26, 3, 10); ctx.fillRect(293, 26, 3, 10);
                ctx.fillStyle = '#fff'; ctx.font = '800 8px Orbitron, sans-serif'; ctx.fillText('PAUSE / LEAVE', 270, 54);
                ctx.restore();
            } };
        },
        // winning
        goal() {
            const cols = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'];
            return { len: 360, draw(ctx, t) {
                ctx.save(); ctx.scale(1.5, 1.5);
                ctx.fillStyle = '#16204a'; ctx.fillRect(0, 0, 320, 180);
                const tt = t % 360, k = [Math.min(10, tt / 26), 4 * ease(tt / 120), 3 * ease(tt / 100), 2 * ease(tt / 90)];
                ctx.fillStyle = '#ffca28'; ctx.font = '900 14px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FIRST TO 10 KNOCKOUTS WINS', 160, 28);
                for (let i = 0; i < 4; i++) {
                    const y = 40 + i * 26, n = k[i];
                    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(20, y, 280, 20, 8); ctx.fill();
                    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.roundRect(20, y, 8, 20, 4); ctx.fill();
                    ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect(34, y + 4, Math.max(6, 240 * n / 10), 12, 6); ctx.fill(); ctx.globalAlpha = 1;
                    ctx.fillStyle = '#fff'; ctx.font = '800 12px Orbitron, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(String(Math.floor(n)), 294, y + 15);
                }
                if (tt > 270) { const a = Math.min(1, (tt - 270) / 20), pop = 1 + 0.3 * Math.max(0, 1 - (tt - 270) / 12); ctx.save(); ctx.globalAlpha = a; ctx.translate(160, 150); ctx.scale(pop, pop); ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-16, -8); ctx.lineTo(-8, 0); ctx.lineTo(0, -12); ctx.lineTo(8, 0); ctx.lineTo(16, -8); ctx.lineTo(16, 8); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.font = '900 13px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MATCH WON', 160, 174); ctx.restore(); }
                else { ctx.fillStyle = '#90caf9'; ctx.font = '800 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DOUBLES: FIRST TEAM TO 20 TOGETHER', 160, 160); }
                ctx.restore();
            } };
        }
    };

    // One concept per page, in the order a new player needs them. The controls come first.
    const PAGES = (touch) => [
        touch ? ['touch', 'Touch controls', 'Drag anywhere on the left half to move: push up to jump, down to crouch. Shield, Attack and Jump are the buttons on the right. Hold the phone sideways.']
              : ['keys', 'Keyboard', 'Player 1 uses WASD, Q and E (Space also jumps). Player 2 in Doubles uses the arrows, / and . In Solo you can use either set. Crouch (S) on a weapon to swap. A controller works too.'],
        ['goal', 'How you win', 'Knock out your rivals. Solo: first to 10 knockouts wins the match. Doubles: your team of two against three other teams, first to 20 knockouts together.'],
        ['move', 'Run and jump', 'Run, jump, and jump again in mid-air for a flip and a double jump.'],
        ['fight', 'Fight', 'Punch bare-handed. Weapons fall from the sky: walk over one to take it. They wear out, so use them while you have them.'],
        ['shield', 'Shield', 'Blocks almost all damage, but lasts only about a second, then needs a moment to recharge. Time it.'],
        ['edge', 'Knockouts', 'Every fighter has 100 health. Hits also knock you back: off the edge or into a pit and you are out at once. Crouching cancels knockback.'],
        ['bounce', 'Bouncers and platforms', 'Springy mats launch you high. Some platforms move, and thin ice can shatter.'],
        ['angel', 'Angel rounds', 'Every fifth round a crystal falls. Whoever grabs it becomes a flying angel with 300 health. The Nimbus Staff lets you fly and fight back.'],
        ['extras', 'Good to know', '']
    ];

    let page = 0, pages = [], ui = null, cur = null, touchMode = false, keyHandler = null;

    function extrasHTML() {
        return touchMode
            ? '<div><b>Controller Party</b><span>Tap JOIN to take a seat, + FIGHTER to fill another, START to begin (up to 10 fighters).</span></div><div><b>Match skill</b><span>Pick the difficulty on the main menu, from Beginning up to Hack.</span></div><div><b>Tips</b><span>Stay on solid ground when low on health. Block a big hit, then punish the swing. In Doubles, stay near your ally.</span></div>'
            : '<div><b>Controller Party</b><span>Up to 10 fighters on one screen: press Enter (or A on a controller) to join, B to add another fighter, Enter to start.</span></div><div><b>Match skill</b><span>Pick the difficulty on the main menu, from Beginning up to Hack.</span></div><div><b>Tips</b><span>Stay on solid ground when low on health. Block a big hit, then punish the swing. In Doubles, stay near your ally.</span></div>';
    }

    function show(i) {
        page = Math.max(0, Math.min(pages.length - 1, i));
        const [id, title, text] = pages[page];
        ui.title.textContent = title; ui.text.textContent = text;
        ui.stage.innerHTML = '';
        cur = null;
        if (id === 'extras') {
            const ex = document.createElement('div'); ex.className = 'ht-extra'; ex.innerHTML = extrasHTML(); ui.stage.appendChild(ex);
            ui.text.style.display = 'none';
        } else {
            ui.text.style.display = '';
            const dpr = Math.max(1.5, Math.min(2, window.devicePixelRatio || 1));
            const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; cv.className = 'ht-cv';
            ui.stage.appendChild(cv);
            const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
            if (id === 'keys' || id === 'touch' || id === 'goal') guardText(ctx, 320);
            cur = { cv, ctx, scene: SCENES[id](), t: 0 };
            cards = [cur];
        }
        if (!cur) cards = [];
        ui.stage.classList.remove('ht-flip'); void ui.stage.offsetWidth; ui.stage.classList.add('ht-flip');
        ui.dots.forEach((d, k) => d.classList.toggle('on', k === page));
        ui.count.textContent = (page + 1) + ' / ' + pages.length;
        ui.back.style.visibility = page === 0 ? 'hidden' : 'visible';
        const done = document.getElementById('howto-done');
        if (done) done.textContent = page === pages.length - 1 ? 'GOT IT' : 'NEXT';
    }

    // Next page, or false when already on the last one (the caller then closes the panel)
    function advance() { if (!running || page >= pages.length - 1) return false; show(page + 1); return true; }

    function build(body, touch) {
        stop();
        world();
        touchMode = !!touch;
        pages = PAGES(touch);
        body.innerHTML = '';
        root = body;
        const wrap = document.createElement('div'); wrap.className = 'ht-pager';
        const stage = document.createElement('div'); stage.className = 'ht-stage';
        const h = document.createElement('h3'); h.className = 'ht-title';
        const p = document.createElement('p'); p.className = 'ht-text';
        const nav = document.createElement('div'); nav.className = 'ht-nav';
        const back = document.createElement('button'); back.className = 'ht-back'; back.textContent = '‹ Back'; back.type = 'button';
        const dotsBox = document.createElement('div'); dotsBox.className = 'ht-dots';
        const dots = pages.map((_, k) => { const d = document.createElement('button'); d.type = 'button'; d.className = 'ht-dot'; d.setAttribute('aria-label', 'Page ' + (k + 1)); d.addEventListener('click', () => show(k)); dotsBox.appendChild(d); return d; });
        const count = document.createElement('span'); count.className = 'ht-count';
        nav.append(back, dotsBox, count);
        wrap.append(stage, h, p, nav);
        body.appendChild(wrap);
        ui = { stage, title: h, text: p, back, dots, count };
        back.addEventListener('click', () => show(page - 1));
        keyHandler = (e) => {
            if (e.code === 'ArrowRight') { advance(); e.preventDefault(); e.stopImmediatePropagation(); }
            else if (e.code === 'ArrowLeft') { show(page - 1); e.preventDefault(); e.stopImmediatePropagation(); }
        };
        window.addEventListener('keydown', keyHandler, true);
        running = true;
        show(0);
        raf = requestAnimationFrame(loop);
    }

    // Fixed 60 steps a second whatever the display rate: an accumulator, never a frame skip, so 75 or 120 Hz
    // screens still get every step (a "skip if under 15ms" rule would halve a 75 Hz display)
    let last = 0, acc = 0;
    function loop(now) {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        const dt = last ? Math.min(100, now - last) : 16.667;
        last = now;
        acc += dt;
        const c = cur;
        if (!c) { acc = 0; return; }
        let steps = Math.floor(acc / 16.667 + 0.05);
        if (steps < 1) return;
        acc = Math.max(0, acc - steps * 16.667);
        steps = Math.min(4, steps);
        for (let s = 0; s < steps; s++) {
            c.t = (c.t + 1) % c.scene.len;
            fake.frameCount++; fake.fx.clock += 1;
            try { c.ctx.save(); c.scene.draw(c.ctx, c.t); edgeFade(c.ctx, c.t, c.scene.len); c.ctx.restore(); } catch (e) { c.ctx.restore(); }
        }
    }
    function stop() {
        running = false; cancelAnimationFrame(raf); cards = []; cur = null;
        if (keyHandler) { window.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
    }
    // test hooks: advance the current page n frames; jump to a page
    function step(n) { const c = cur; if (!c) return; for (let i = 0; i < n; i++) { c.t = (c.t + 1) % c.scene.len; fake.frameCount++; fake.fx.clock += 1; c.ctx.save(); c.scene.draw(c.ctx, c.t); c.ctx.restore(); } }
    return { build, stop, step, advance, show, scenes: SCENES, world };
})();

window.HowToVisual = HowToVisual;
