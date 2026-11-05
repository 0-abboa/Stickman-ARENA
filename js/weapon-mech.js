// Signature mechanics. Most weapons used to differ only in numbers and looks; here a weapon gets a
// trick of its own that changes how you fight with it: a katana that dashes through a crowd, a
// machete that knocks the weapon out of a hand, a frost blade that raises a wall of ice, a grapple
// that pulls you to a ledge, a frying pan that bats bullets back, a shrink ray, a gun that swaps
// places with whoever it hits, a javelin that becomes a ledge, knives you teleport to, a mallet
// that squashes, a bubble that floats someone away, a ground pound that runs along the floor...
//
// Hooks (all optional) on MECH[type]:
//   use(g, p, def)      the attack button: return true to replace the weapon's normal attack
//   hit(g, att, t, amt) after any hit landed with this weapon (melee or shot); runs after knockback
//   hold(g, p, def)     every frame while it is held (charging, spinning, passive effects)
// Custom things in the world (waves, turrets, hooks, ice walls...) are entities in g.mechEnts.
const WeaponMech = (() => {
    const TAU = Math.PI * 2, R = Math.random, RND = (a, b) => a + R() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const cx = (p) => p.x + p.width / 2, cy = (p) => p.y + p.height / 2;
    const foes = (g, p) => g.players.filter(t => t !== p && !t.isDead && t.team !== p.team);
    const near = (g, p, r, front) => foes(g, p).filter(t => Math.hypot(cx(t) - cx(p), cy(t) - cy(p)) < r && (!front || Math.sign(cx(t) - cx(p)) === p.facing || Math.abs(cx(t) - cx(p)) < 20)).sort((a, b) => Math.abs(cx(a) - cx(p)) - Math.abs(cx(b) - cx(p)));
    const typeOf = (p) => p.weapon ? p.weapon.type : null;
    const glow = (ctx, x, y, r, rgb, a) => { if (a <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };
    // deal damage as this weapon (death animations, kill credit, statuses all work)
    function strike(g, att, t, dmg, kx, ky, status, type) {
        if (!t || t.isDead || t.team === att.team) return;
        t.lastHitType = type || typeOf(att); t.lastHitAt = g.frameCount;
        t.mechSilent = true; t.takeDamage(dmg, att); t.mechSilent = false;
        if (kx !== undefined) { t.velocity.x = kx; t.velocity.y = ky; t.grounded = false; }
        if (status) g.applyStatus(t, status, att, t.lastHitType, dmg);
        AudioSys.playHit();
    }
    const later = (g, fn) => (g.mechPost || (g.mechPost = [])).push(fn);
    const ent = (g, e) => { (g.mechEnts || (g.mechEnts = [])).push(e); return e; };
    const platAt = (L, x, y) => L.platforms.find(q => q.active && q.type !== 'trampoline' && x > q.x && x < q.x + q.width && y > q.y && y < q.y + q.height);
    const groundBelow = (L, x, y) => { let best = null; for (const q of L.platforms) if (q.active && q.type !== 'trampoline' && x > q.x && x < q.x + q.width && q.y >= y - 2 && (!best || q.y < best.y)) best = q; return best; };
    const reflectShots = (g, p, range, ms) => {
        let n = 0;
        for (const pr of g.projectiles) {
            if (!pr.active || pr.owner === p || (pr.owner && pr.owner.team === p.team)) continue;
            if (Math.abs(pr.x - cx(p)) < range && Math.abs(pr.y - cy(p)) < 60 && Math.sign(pr.x - cx(p)) === p.facing) {
                pr.vx = Math.abs(pr.vx || 8) * p.facing * (ms || 1.2); pr.vy = -Math.abs(pr.vy) * 0.3; pr.direction = p.facing; pr.owner = p; pr.hitSet = null;
                g.fx.sparks(pr.x, pr.y, '255,255,255', 8, p.facing > 0 ? 0 : Math.PI, 1, 5); n++;
            }
        }
        if (n) { g.fx.ring(cx(p) + p.facing * 30, cy(p), '255,255,255', 30, 3, 10); AudioSys.playAttack(); }
        return n;
    };
    // a straight-line hit along a dash or beam
    const lineHits = (g, p, x0, y0, x1, y1, w) => foes(g, p).filter(t => {
        const px = cx(t) - x0, py = cy(t) - y0, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
        const u = clamp((px * dx + py * dy) / L2, 0, 1), qx = x0 + dx * u, qy = y0 + dy * u;
        return Math.hypot(cx(t) - qx, cy(t) - qy) < w;
    });
    const tempPlat = (g, x, y, w, h, life, look) => {
        const pl = g.level.createPlatform(x, y, w, h); pl.temp = { life, look, max: life }; pl.noDraw = true; pl.mech = true; g.level.platforms.push(pl);
        return ent(g, { kind: 'tempPlat', pl, life, look, max: life });
    };

    const M = {};

    // ================= BLADES =================
    M.katana = {   // iaido: a flash-step that cuts everyone on the line
        use(g, p) {
            const x0 = cx(p), y0 = cy(p);
            let dist = 170;
            for (const q of g.level.platforms) if (q.active && q.type !== 'trampoline' && y0 > q.y && y0 < q.y + q.height) { const edge = p.facing > 0 ? q.x - (x0 + 15) : (x0 - 15) - (q.x + q.width); if (edge >= 0 && edge < dist) dist = edge; }
            p.x += p.facing * dist; p.prevX = p.x; p.iframes = 12;
            g.fx.streak(x0, y0, cx(p), y0, 6, '220,240,255', 14);
            for (const t of lineHits(g, p, x0, y0, cx(p), y0, 38)) strike(g, p, t, 18, p.facing * 8, -5);
            p.attackAnim = 0; AudioSys.playSwing(false);
            return true;
        }
    };
    M.cutlass = { use(g, p) { reflectShots(g, p, 80); return false; } };   // swashbuckler's parry: swings bat shots back
    M.broadsword = { hit(g, a, t) { later(g, () => { t.velocity.y = -15; t.velocity.x = a.facing * 2; t.launched = true; }); } };   // launcher uppercut
    M.claymore = {   // three-hit combo: the third swing hits triple and sends a shockwave along the floor
        use(g, p) { p.combo = (g.frameCount - (p.comboAt || -999) < 50) ? (p.combo || 0) + 1 : 1; p.comboAt = g.frameCount; if (p.combo >= 3) { p.combo = 0; p.comboBig = true; if (p.grounded) { groundWave(g, p, p.facing, 20, '230,230,255'); } } return false; },
        hit(g, a, t, amt) { if (a.comboBig) { a.comboBig = false; strike(g, a, t, amt * 1.5); g.fx.flashAt(cx(t), cy(t), '255,255,255', 50, 6); } }
    };
    M.falchion = { hit(g, a, t, amt) { const sp = Math.abs(a.velocity.x); if (sp > 2) strike(g, a, t, amt * sp / 5); } };   // momentum: run and slash
    M.machete = { hit(g, a, t) { if (t.weapon && t.weapon.type !== 'bird_crystal' && R() < 0.4) { const w = t.weapon; t.dropWeapon(); w.y -= 30; w.lock = 20; g.fx.text(cx(t), t.y - 20, 'DISARMED', '#ffca28', 14); } } };
    M.kris = {   // venom stacks: the third cut bursts
        hit(g, a, t) { t.venom = (g.frameCount - (t.venomAt || -999) < 300 ? (t.venom || 0) : 0) + 1; t.venomAt = g.frameCount; if (t.venom >= 3) { t.venom = 0; strike(g, a, t, 22, a.facing * 6, -6); g.fx.cloud(cx(t), cy(t), 10, 30, '140,255,70', 12, 50, 0.4); g.fx.flashAt(cx(t), cy(t), '140,255,70', 60, 8); } }
    };
    M.flamesword = { use(g, p) { if (p.grounded) zone(g, p, cx(p) + p.facing * 50, p.y + p.height, 90, 140, 'fire'); return false; } };   // leaves the ground burning
    M.frostblade = {   // raises a wall of ice in front
        use(g, p) {
            const x = cx(p) + p.facing * 56 - 10, gr = groundBelow(g.level, x + 10, p.y + p.height - 4);
            if (gr && !(g.mechEnts || []).some(e => e.kind === 'tempPlat' && e.owner === p)) { const e = tempPlat(g, x, gr.y - 70, 20, 70, 200, 'ice'); e.owner = p; g.fx.shards(x, gr.y - 70, 20, 70, 'rgba(220,245,255,0.95)', 12); }
            return false;
        }
    };
    M.thunderblade = { hit(g, a, t) { ent(g, { kind: 'boltMark', t, owner: a, life: 40 }); } };   // marks the target for a lightning strike
    M.shadowblade = {   // steps through the shadows behind the nearest enemy
        use(g, p) { const t = near(g, p, 280)[0]; if (t) { g.fx.swirl(cx(p), cy(p), { shape: 'soul', color: '170,90,255', rise: 0, spin: 5, r0: 30, r1: 2, size: 4, life: 20 }); const side = cx(t) > cx(p) ? 1 : -1; p.x = cx(t) + side * 34 - p.width / 2; p.y = t.y; p.facing = -side; p.prevX = p.x; p.prevY = p.y; p.velocity.x = 0; g.fx.swirl(cx(p), cy(p), { shape: 'soul', color: '170,90,255', rise: 0, spin: -5, r0: 2, r1: 30, size: 4, life: 20 }); } return false; }
    };
    M.lasersword = { use(g, p) { reflectShots(g, p, 70, 1.4); return false; }, hit(g, a, t) { if (t.shieldActive && !t.autoShield) { t.shieldActive = false; t.shieldCd = 90; } } };   // cuts through shields, deflects shots
    M.executioner = { hit(g, a, t) { if (!t.isDead && t.health < t.maxHealth * 0.3 && !t.isBird) { strike(g, a, t, 999); g.fx.text(cx(t), t.y - 24, 'EXECUTED', '#ff5252', 16); } } };
    M.nodachi = { use(g, p) { later(g, () => ent(g, { kind: 'crescent', owner: p, x: cx(p) + p.facing * 30, y: cy(p), dir: p.facing, life: 34, hit: new Set() })); return false; } };   // the slash flies on as a crescent
    M.twinblades = { use(g, p) { p.whirl = 24; return false; }, hold(g, p) { if (p.whirl > 0) { p.whirl--; if (p.whirl % 6 === 0) for (const t of near(g, p, 70)) strike(g, p, t, 4, Math.sign(cx(t) - cx(p)) * 5, -3); } } };   // whirlwind

    // ================= POLEARMS =================
    M.trident = { use(g, p) { if (p.grounded) ent(g, { kind: 'wave', owner: p, x: cx(p) + p.facing * 40, y: p.y + p.height, dir: p.facing, life: 70, hit: new Set(), rgb: '120,200,255', push: 11 }); return false; } };
    M.halberd = { hit(g, a, t) { g.applyStatus(t, { stun: 34 }, a, 'halberd', 0); later(g, () => { t.velocity.y = 2; }); } };   // sweeps the legs
    M.glaive = {   // hold to spin it overhead: a moving blender
        use(g, p) { p.spin = 40; return false; },
        hold(g, p) { const inp = p.lastInput; if (p.spin > 0 || (inp && inp.attack && p.spinAt === g.frameCount - 1)) { p.spinAt = g.frameCount; if (p.spin > 0) p.spin--; else p.spin = 0; if (g.frameCount % 8 === 0) for (const t of near(g, p, 80)) strike(g, p, t, 5, Math.sign(cx(t) - cx(p)) * 7, -5); p.spinFx = (p.spinFx || 0) + 0.5; } }
    };
    M.naginata = { use(g, p) { if (!p.grounded) { p.velocity.y = -11; p.jumpCount = Math.max(1, p.jumpCount); for (const t of foes(g, p).filter(t => Math.abs(cx(t) - cx(p)) < 50 && t.y > p.y && t.y - p.y < 120)) strike(g, p, t, 14, 0, 6); g.fx.ring(cx(p), p.y + p.height, '255,255,255', 30, 3, 10); } return false; } };   // pole vault
    M.hookstaff = { use(g, p) { if (!(g.mechEnts || []).some(e => e.kind === 'hook' && e.owner === p)) ent(g, { kind: 'hook', owner: p, x: cx(p), y: cy(p) - 10, vx: p.facing * 15, vy: -6, life: 40, state: 'fly' }); return true; } };   // grapple: pulls you to ledges, or them to you
    M.lance = { hit(g, a, t, amt) { const sp = Math.abs(a.velocity.x); if (sp > 4) { strike(g, a, t, amt * (sp / 4), a.facing * (8 + sp * 1.6), -8); g.fx.flashAt(cx(t), cy(t), '255,240,200', 50, 6); } } };   // joust: hit it at a run
    M.quarterstaff = { use(g, p) { if (p.grounded) { p.velocity.y = -15; p.launched = true; p.grounded = false; g.fx.dust(cx(p), p.y + p.height, 6, 20, DUST_TINT[g.level.material]); } return false; } };   // vault high
    M.pitchfork = { hit(g, a, t) { later(g, () => { t.x = cx(a) - a.facing * 30 - t.width / 2; t.y = a.y - 30; t.velocity.x = -a.facing * 9; t.velocity.y = -9; t.prevX = t.x; t.prevY = t.y; }); } };   // tossed over your shoulder
    M.thunderpike = { use(g, p) { if (p.grounded && !(g.mechEnts || []).some(e => e.kind === 'rod' && e.owner === p)) ent(g, { kind: 'rod', owner: p, x: cx(p) + p.facing * 40, y: p.y + p.height, life: 300 }); return false; } };   // plants a lightning rod
    M.whip = {   // snatches the weapon right out of their hand
        hit(g, a, t) {
            if (!t.weapon || t.weapon.type === 'bird_crystal' || t.weapon.type === 'magic_stick' || R() > 0.5) return;
            later(g, () => { if (!a.weapon || a.isDead) return; const mine = a.weapon, theirs = t.weapon; if (!theirs) return; t.weapon = null; mine.owner = null; mine.active = true; mine.x = a.x; mine.y = a.y; mine.landed = false; a.weapon = theirs; theirs.owner = a; g.fx.streak(cx(t), cy(t), cx(a), cy(a), 2, '255,230,160', 12); g.fx.text(cx(a), a.y - 24, 'SNATCHED', '#ffca28', 14); });
        }
    };
    M.warscythe = { use(g, p) { for (const t of near(g, p, 130)) { strike(g, p, t, 10, Math.sign(cx(t) - cx(p)) * 6, -4); p.health = Math.min(p.maxHealth, p.health + 5); } g.fx.ring(cx(p), cy(p), '200,40,60', 130, 4, 14); return false; } };   // reap all around, heal per soul

    // ================= HEAVY =================
    M.chainsaw = {   // hold to rev: grinds whoever is in front, but you crawl
        hold(g, p) { const inp = p.lastInput; if (inp && inp.attack) { p.velocity.x *= 0.82; if (g.frameCount % 6 === 0) { const hits = foes(g, p).filter(t => Math.abs(cx(t) - (cx(p) + p.facing * 38)) < 34 && Math.abs(cy(t) - cy(p)) < 40); for (const t of hits) strike(g, p, t, 3, p.facing * 2, -1); g.fx.sparks(cx(p) + p.facing * 40, cy(p), hits.length ? '255,80,60' : '255,220,140', 3, p.facing > 0 ? 0 : Math.PI, 1, 4); if (hits.length && p.weapon && g.frameCount % 24 === 0) p.weapon.durability--; } } }
    };
    M.morningstar = {   // the ball orbits you while you hold it
        hold(g, p) { p.orbitA = (p.orbitA || 0) + 0.18; const bx = cx(p) + Math.cos(p.orbitA) * 62, by = cy(p) + Math.sin(p.orbitA) * 40; p.orbitPos = [bx, by]; for (const t of foes(g, p)) if (Math.hypot(cx(t) - bx, cy(t) - by) < 26 && (t.orbitHitAt || 0) < g.frameCount - 30) { t.orbitHitAt = g.frameCount; strike(g, p, t, 8, Math.sign(cx(t) - cx(p)) * 9, -5); } }
    };
    M.club = { use(g, p) { if (p.grounded) { groundWave(g, p, 1, 10, '200,170,120'); groundWave(g, p, -1, 10, '200,170,120'); g.fx.addTrauma && !g.demo && g.fx.addTrauma(0.1); } return false; } };   // ground pound both ways
    M.anchor = { use(g, p) { if (!p.grounded) { p.velocity.y = 22; p.velocity.x = 0; p.diving = 'anchor'; return true; } return false; }, hold(g, p) { if (p.diving === 'anchor' && p.grounded) { p.diving = null; for (const t of near(g, p, 140)) strike(g, p, t, 22, Math.sign(cx(t) - cx(p) || 1) * 12, -9); g.fx.ring(cx(p), p.y + p.height, '255,255,255', 120, 5, 16); g.fx.dust(cx(p), p.y + p.height, 14, 60, DUST_TINT[g.level.material]); g.fx.addTrauma && !g.demo && g.fx.addTrauma(0.25); } } };
    M.wrench = { use(g, p) { if (p.grounded && !(g.mechEnts || []).some(e => e.kind === 'turret' && e.owner === p)) { ent(g, { kind: 'turret', owner: p, x: cx(p) + p.facing * 34, y: p.y + p.height, life: 480, cd: 30, a: p.facing > 0 ? 0 : Math.PI }); return true; } return false; } };   // builds a sentry
    M.mallet = { hit(g, a, t) { t.squashed = 70; g.applyStatus(t, { stun: 50 }, a, 'mallet', 0); later(g, () => { t.velocity.y = -7; }); } };   // flattens them like a cartoon
    M.labrys = { use(g, p) { if (!(g.mechEnts || []).some(e => e.kind === 'rang' && e.owner === p)) { ent(g, { kind: 'rang', owner: p, x: cx(p), y: cy(p), vx: p.facing * 14, vy: 0, life: 80, hit: new Set(), dmg: 14, rgb: '200,200,220' }); return true; } return false; } };
    M.logtrunk = { use(g, p) { if (p.grounded) { ent(g, { kind: 'roller', owner: p, x: cx(p) + p.facing * 40, y: p.y + p.height, dir: p.facing, life: 160, rot: 0, hit: new Set() }); return true; } return false; } };   // rolls the log down the floor
    M.pan = { use(g, p) { p.panGuard = 16; return false; }, hold(g, p) { if (p.panGuard > 0) { p.panGuard--; reflectShots(g, p, 70, 1.6); } }, hit(g, a, t) { g.applyStatus(t, { stun: 30 }, a, 'pan', 0); g.fx.star(cx(t), t.y - 6, '255,240,140'); } };   // bonk: and it bats bullets back
    M.thorhammer = { use(g, p) { if (!(g.mechEnts || []).some(e => e.kind === 'rang' && e.owner === p)) { ent(g, { kind: 'rang', owner: p, x: cx(p), y: cy(p), vx: p.facing * 16, vy: 0, life: 70, hit: new Set(), dmg: 18, rgb: '150,200,255', thunder: true }); return true; } return false; } };   // thrown, returns, calls lightning
    M.meteor = { use(g, p) { const t = near(g, p, 600, true)[0]; const x = t ? cx(t) : cx(p) + p.facing * 200; const gr = groundBelow(g.level, x, (t ? t.y : p.y)) ; ent(g, { kind: 'meteorCall', owner: p, x, gy: gr ? gr.y : g.level.height, t: 0, T: 55 }); return false; } };
    M.gravmaul = { use(g, p) { if (p.grounded) { for (const t of near(g, p, 220)) later(g, () => { t.velocity.x = Math.sign(cx(p) + p.facing * 40 - cx(t)) * 9; t.velocity.y = -4; }); g.fx.swirl(cx(p) + p.facing * 40, p.y + p.height, { shape: 'dot', color: '170,110,255', rise: 0, spin: 6, r0: 200, r1: 4, size: 3, life: 24 }); } return false; } };   // implosion

    // ================= FISTS =================
    M.knuckles = { use(g, p) { p.combo = (g.frameCount - (p.comboAt || -999) < 40) ? (p.combo || 0) + 1 : 1; p.comboAt = g.frameCount; return false; }, hit(g, a, t) { if (a.combo >= 4) { a.combo = 0; later(g, () => { t.velocity.y = -14; t.velocity.x = a.facing * 3; }); g.fx.flashAt(cx(t), t.y + 10, '255,230,160', 40, 6); } } };
    M.boxglove = { use(g, p) { const hits = foes(g, p).filter(t => { const d = (cx(t) - cx(p)) * p.facing; return d > 0 && d < 150 && Math.abs(cy(t) - cy(p)) < 40; }); for (const t of hits) strike(g, p, t, 12, p.facing * 18, -7); p.springAt = g.frameCount; AudioSys.playSwing(true); p.attackAnim = 0; return true; } };   // spring punch
    M.rocketfist = { use(g, p) { if (!(g.mechEnts || []).some(e => e.kind === 'rang' && e.owner === p)) { ent(g, { kind: 'rang', owner: p, x: cx(p), y: cy(p) - 6, vx: p.facing * 17, vy: 0, life: 60, hit: new Set(), dmg: 14, rgb: '255,160,60', fist: true }); return true; } return false; } };
    M.tigerclaw = { use(g, p) { if (!p.grounded) { p.velocity.x = p.facing * 12; p.velocity.y = 10; p.diving = 'pounce'; } return false; }, hold(g, p) { if (p.diving === 'pounce') { for (const t of foes(g, p)) if (Math.hypot(cx(t) - cx(p), cy(t) - cy(p)) < 40) { strike(g, p, t, 14, p.facing * 9, -6, { burn: 60 }); p.diving = null; } if (p.grounded) p.diving = null; } } };
    M.claws = { hold(g, p) { if (p.grounded || !p.lastInput) return; const dir = p.lastInput.x; if (!dir) return; const wall = g.level.platforms.find(q => q.active && q.type !== 'trampoline' && p.y + 30 > q.y && p.y + 30 < q.y + q.height && (dir > 0 ? Math.abs(q.x - (p.x + p.width)) < 3 : Math.abs(q.x + q.width - p.x) < 3)); if (wall && p.velocity.y > 0) { p.velocity.y = Math.min(p.velocity.y, 1.2); p.jumpCount = Math.min(p.jumpCount, 1); if (g.frameCount % 6 === 0) g.fx.sparks(dir > 0 ? p.x + p.width : p.x, p.y + 20, '255,255,255', 1, Math.PI / 2, 1, 2); } } };   // claw onto walls and slide

    // ================= GUNS =================
    M.shotgun = { use(g, p) { if (!p.grounded) { p.velocity.x = -p.facing * 9; p.velocity.y = Math.min(p.velocity.y, -7); } return false; } };   // fire mid-air to blast yourself back
    M.sniper = { hold(g, p) { const still = Math.abs(p.velocity.x) < 0.3 && p.grounded; p.aimed = still ? Math.min(60, (p.aimed || 0) + 1) : 0; }, hit(g, a, t, amt) { if (a.aimed >= 45) { strike(g, a, t, amt); g.fx.text(cx(t), t.y - 24, 'AIMED', '#80d8ff', 14); } } };   // stand still to steady the scope: double damage
    M.revolver = { use(g, p, def) { for (let i = 1; i <= 2; i++) g.fx.later(i * 5, () => { if (p.weapon && p.weapon.type === 'revolver' && !p.isDead) g.fireShot(p, def); }); return false; } };   // fan the hammer
    M.minigun = { hold(g, p) { const inp = p.lastInput; p.spinUp = inp && inp.attack ? Math.min(90, (p.spinUp || 0) + 1) : Math.max(0, (p.spinUp || 0) - 3); if (p.spinUp > 0) p.velocity.x *= 0.9; if (p.spinUp < 30 && p.attackCooldown > 0 && inp && inp.attack) p.attackCooldown += 0.6; } };   // spins up slowly, slows you
    M.raygun = { hit(g, a, t) { t.shrink = 420; g.fx.ring(cx(t), cy(t), '120,255,120', 40, 3, 14); g.fx.text(cx(t), t.y - 20, 'SHRUNK', '#69f0ae', 14); } };
    M.freezeray = { hit(g, a, t) { g.applyStatus(t, { freeze: 160 }, a, 'freezeray', 0); if (!(g.mechEnts || []).some(e => e.kind === 'tempPlat' && e.on === t)) { const e = tempPlat(g, t.x - 8, t.y - 6, t.width + 16, 10, 150, 'ice'); e.on = t; } } };   // the frozen become a ledge
    M.tesla = { use(g, p) { const t = near(g, p, 280, true)[0]; if (t) { strike(g, p, t, 9, p.facing * 4, -3, { stun: 20 }); ent(g, { kind: 'arc', x0: cx(p) + p.facing * 20, y0: cy(p) - 6, x1: cx(t), y1: cy(t), life: 8 }); const t2 = foes(g, p).find(o => o !== t && Math.hypot(cx(o) - cx(t), cy(o) - cy(t)) < 160); if (t2) { strike(g, p, t2, 6, 0, -2, { stun: 14 }); ent(g, { kind: 'arc', x0: cx(t), y0: cy(t), x1: cx(t2), y1: cy(t2), life: 8 }); } AudioSys.playGun('plasma'); p.attackAnim = 0; return true; } return false; } };   // arcs to the nearest foe and jumps on
    M.acidgun = { hit(g, a, t) { const gr = groundBelow(g.level, cx(t), t.y + t.height - 4); if (gr) zone(g, a, cx(t), gr.y, 70, 180, 'acid'); } };
    M.nailgun = { hit(g, a, t) { const wall = g.level.platforms.some(q => q.active && Math.abs((a.facing > 0 ? q.x : q.x + q.width) - (a.facing > 0 ? t.x + t.width : t.x)) < 30 && t.y + 30 > q.y && t.y < q.y + q.height); if (wall || !t.grounded) g.applyStatus(t, { trap: 60 }, a, 'nailgun', 0); } };   // pinned to the wall
    M.bubblegun = { hit(g, a, t) { if (!t.bubble) { t.bubble = 110; g.fx.ring(cx(t), cy(t), '200,235,255', 40, 2, 12); } } };   // floated away in a bubble
    M.gravgun = { use(g, p) { if (p.held) return true; const t = near(g, p, 230, true)[0]; if (t) { p.held = { t, life: 40 }; t.heldBy = p; g.fx.streak(cx(p), cy(p), cx(t), cy(t), 3, '170,110,255', 10); AudioSys.playGun('plasma'); p.attackAnim = 0; return true; } return false; } };   // tractor beam: grab, then fling
    M.sonic = { use(g, p) { for (const t of near(g, p, 150)) strike(g, p, t, 4, Math.sign(cx(t) - cx(p) || p.facing) * 16, -9); g.fx.ring(cx(p), cy(p), '200,220,255', 150, 6, 18); g.fx.ring(cx(p), cy(p), '255,255,255', 90, 3, 12); AudioSys.playExplosion(); p.attackAnim = 0; return true; } };   // sonic boom all around
    M.watercannon = { hold(g, p) { const inp = p.lastInput; if (!inp || !inp.attack) return; p.velocity.x -= p.facing * 0.15; if (g.frameCount % 2 === 0) g.fx.add({ type: 'drop', x: cx(p) + p.facing * 24, y: cy(p) - 4, vx: p.facing * RND(9, 13), vy: RND(-1.5, 0.5), life: 30, color: 'rgba(150,215,255,0.9)', size: RND(2, 3.5), gravity: 0.15 }); for (const t of foes(g, p)) { const d = (cx(t) - cx(p)) * p.facing; if (d > 0 && d < 260 && Math.abs(cy(t) - cy(p)) < 40) { t.velocity.x += p.facing * 0.9 * (1 - d / 300); } } if (g.frameCount % 20 === 0 && p.weapon) p.weapon.durability--; } };   // a stream that shoves, never hurts
    M.dartgun = { hit(g, a, t) { t.asleep = 200; g.applyStatus(t, { stun: 200 }, a, 'dartgun', 0); g.fx.text(cx(t), t.y - 20, 'Zzz', '#b3e5fc', 16); } };   // sleeps until hit again
    M.glitchgun = { hit(g, a, t) { later(g, () => { if (a.isDead || t.isDead) return; const ax = a.x, ay = a.y; a.x = t.x; a.y = t.y; t.x = ax; t.y = ay; a.prevX = a.x; a.prevY = a.y; t.prevX = t.x; t.prevY = t.y; a.velocity.y = Math.min(a.velocity.y, 0); g.fx.flashAt(cx(a), cy(a), '0,255,200', 40, 6); g.fx.flashAt(cx(t), cy(t), '255,0,200', 40, 6); }); } };   // swap places
    M.ioncannon = { use(g, p) { const t = near(g, p, 800, true)[0]; const x = t ? cx(t) : cx(p) + p.facing * 300; ent(g, { kind: 'orbital', owner: p, x, t: 0, T: 60 }); return false; } };   // marks a spot for an orbital beam
    M.seedgun = { hit(g, a, t) { const gr = groundBelow(g.level, cx(t), t.y + t.height - 4); if (gr) zone(g, a, cx(t), gr.y, 60, 360, 'thorn'); } };   // seeds sprout into a thorn bush
    M.snowcannon = { use(g, p) { if (p.grounded) { ent(g, { kind: 'snowroll', owner: p, x: cx(p) + p.facing * 30, y: p.y + p.height, dir: p.facing, r: 8, life: 180, hit: new Set() }); p.attackAnim = 0; return true; } return false; } };   // a snowball that grows as it rolls

    // ================= THROWN AND BOWS =================
    M.knives = { use(g, p) { const k = (g.mechEnts || []).find(e => e.kind === 'warpKnife' && e.owner === p); if (k) { g.fx.swirl(cx(p), cy(p), { shape: 'star', color: '200,230,255', rise: 0, spin: 5, r0: 20, r1: 2, size: 3, life: 16 }); p.x = k.x - p.width / 2; p.y = k.y - p.height / 2; p.prevX = p.x; p.prevY = p.y; p.velocity.y = 0; k.life = 0; g.fx.flashAt(k.x, k.y, '200,230,255', 40, 6); return true; } ent(g, { kind: 'warpKnife', owner: p, x: cx(p), y: cy(p) - 6, vx: p.facing * 16, vy: -2, life: 120, stuck: false }); p.attackAnim = 0; AudioSys.playSwing(false); return true; } };   // throw, then blink to the knife
    M.javelin = { hit() {}, use(g, p) { ent(g, { kind: 'javelinPlat', owner: p, x: cx(p), y: cy(p) - 10, vx: p.facing * 17, vy: -3, life: 90, stuck: false, dir: p.facing }); p.attackAnim = 0; AudioSys.playSwing(false); return true; } };   // sticks in a wall as a ledge
    M.cards = { use(g, p) { for (let i = 0; i < 3; i++) ent(g, { kind: 'card', owner: p, x: cx(p) + p.facing * (30 + i * 26), y: cy(p) - 20 + i * 12, t: 0, wait: 40 + i * 8, vx: 0, vy: 0, hit: false }); p.attackAnim = 0; return true; } };   // cards hang in the air, then dart at the nearest foe
    M.smokebomb = { hit(g, a, t) { t.confused = 120; if (!t.isBot && !g.demo) g.fx.screenFlash('255,255,255', 0.8); } };   // flash bang: blinded fighters stumble the wrong way
    M.stormbow = { hit(g, a, t) { ent(g, { kind: 'arrowRain', owner: a, x: cx(t), t: 0, life: 70 }); } };   // calls an arrow rain on the target
    M.compoundbow = { use(g, p) { ent(g, { kind: 'zipArrow', owner: p, x: cx(p), y: cy(p) - 8, vx: p.facing * 18, vy: -2.5, life: 80, x0: cx(p), y0: p.y + 4 }); p.attackAnim = 0; AudioSys.playGun('arrow'); return true; } };   // leaves a zipline behind it
    M.icebow = { use(g, p) { ent(g, { kind: 'iceArrow', owner: p, x: cx(p), y: cy(p) - 8, vx: p.facing * 16, vy: -2, life: 80 }); p.attackAnim = 0; AudioSys.playGun('arrow'); return true; } };   // freezes a ledge where it lands
    M.boulder = { use(g, p) { ent(g, { kind: 'roller', owner: p, x: cx(p) + p.facing * 40, y: p.y + p.height, dir: p.facing, life: 140, rot: 0, hit: new Set(), boulder: true, airY: p.y + 10, vy: -4 }); p.attackAnim = 0; return true; } };

    // ================= STAFFS =================
    M.icestaff = { use(g, p) { const gr = groundBelow(g.level, cx(p), p.y + p.height - 4); const y = (p.grounded ? p.y + p.height : p.y + p.height + 6); for (let i = 1; i <= 3; i++) g.fx.later(i * 4, () => tempPlat(g, cx(p) + p.facing * (i * 70) - 32, y - i * 26, 64, 12, 240, 'ice')); return false; } };   // conjures ice steps ahead
    M.stormstaff = { use(g, p) { if (!(g.mechEnts || []).some(e => e.kind === 'twister' && e.owner === p)) { const gr = groundBelow(g.level, cx(p) + p.facing * 60, p.y); ent(g, { kind: 'twister', owner: p, x: cx(p) + p.facing * 60, y: gr ? gr.y : p.y + p.height, dir: p.facing, life: 220 }); return true; } return false; } };
    M.earthstaff = { use(g, p) { const t = near(g, p, 500, true)[0]; const x = t ? cx(t) : cx(p) + p.facing * 160; const gr = groundBelow(g.level, x, t ? t.y : p.y); if (gr) ent(g, { kind: 'pillar', owner: p, x, gy: gr.y, t: 0, T: 30, h: 0 }); p.attackAnim = 0; return true; } };   // a rock pillar bursts up under them
    M.windstaff = { use(g, p) { for (const t of foes(g, p)) { const d = (cx(t) - cx(p)) * p.facing; if (d > 0 && d < 340 && Math.abs(cy(t) - cy(p)) < 70) { t.velocity.x = p.facing * 15 * (1 - d / 400); t.velocity.y = -5; t.grounded = false; } } for (let i = 0; i < 14; i++) g.fx.add({ type: 'puff', x: cx(p) + p.facing * 20, y: cy(p) + RND(-30, 30), vx: p.facing * RND(8, 14), vy: RND(-0.5, 0.5), life: 26, color: '255,255,255', size: 2, grow: 0.3, alpha: 0.5 }); p.attackAnim = 0; AudioSys.playSwing(false); return true; } };   // a gale that hurts no one
    M.timewand = { use(g, p) { ent(g, { kind: 'timeBubble', owner: p, x: cx(p) + p.facing * 120, y: cy(p), r: 110, life: 240 }); p.attackAnim = 0; return true; } };   // freezes time in a bubble
    M.musicwand = { hit(g, a, t) { t.dance = 100; g.fx.text(cx(t), t.y - 22, '♪', '#ffd740', 18); } };   // they can't help dancing (no attacks)
    M.mirrorwand = { use(g, p) { p.mirror = 150; g.fx.ring(cx(p), cy(p), '200,240,255', 40, 3, 12); return false; }, hold(g, p) { if (p.mirror > 0) { p.mirror--; for (const pr of g.projectiles) if (pr.active && pr.owner !== p && Math.hypot(pr.x - cx(p), pr.y - cy(p)) < 50) { pr.vx = -pr.vx; pr.vy = -pr.vy; pr.direction = -pr.direction; pr.owner = p; pr.hitSet = null; g.fx.sparks(pr.x, pr.y, '200,240,255', 4); } } } };   // a mirror shield around you
    M.candywand = { hit(g, a, t) { a.sugar = 180; } };   // sugar rush: every hit makes you faster

    // ---------- ground waves, zones and the entity engine ----------
    function groundWave(g, p, dir, dmg, rgb) { ent(g, { kind: 'wave', owner: p, x: cx(p) + dir * 30, y: p.y + p.height, dir, life: 40, hit: new Set(), rgb, dmg, push: 9 }); }
    function zone(g, p, x, y, w, life, look) { ent(g, { kind: 'zone', owner: p, x, y, w, life, max: life, look }); }

    const E = {
        tempPlat(g, e) { e.life--; if (e.on && !e.on.isDead) { e.pl.x = e.on.x - 8; e.pl.y = e.on.y - 6; if (!(e.on.status && e.on.status.freeze > 0)) e.life = Math.min(e.life, 1); } if (e.life <= 0) { e.pl.active = false; const i = g.level.platforms.indexOf(e.pl); if (i >= 0) g.level.platforms.splice(i, 1); g.fx.shards(e.pl.x, e.pl.y, e.pl.width, e.pl.height, 'rgba(220,245,255,0.95)', 10); return false; } return true; },
        boltMark(g, e) { if (--e.life > 0) { if (e.life % 6 === 0) g.fx.sparks(cx(e.t), e.t.y - 8, '255,240,120', 1, -Math.PI / 2, 1, 2); return true; } if (!e.t.isDead) { strike(g, e.owner, e.t, 14, 0, -6, { stun: 30 }, 'thunderblade'); ent(g, { kind: 'arc', x0: cx(e.t) + RND(-30, 30), y0: 0, x1: cx(e.t), y1: cy(e.t), life: 10, sky: true }); g.fx.flashAt(cx(e.t), cy(e.t), '255,250,200', 60, 8); } return false; },
        crescent(g, e) { e.x += e.dir * 13; if (--e.life <= 0) return false; for (const t of foes(g, e.owner)) if (!e.hit.has(t) && Math.abs(cx(t) - e.x) < 26 && Math.abs(cy(t) - e.y) < 46) { e.hit.add(t); strike(g, e.owner, t, 12, e.dir * 7, -4, null, 'nodachi'); } return true; },
        wave(g, e) { e.x += e.dir * 9; if (--e.life <= 0) return false; const gr = groundBelow(g.level, e.x, e.y - 6); if (!gr) return false; e.y = gr.y; if (g.frameCount % 2 === 0) g.fx.dust(e.x, e.y, 1, 8, e.rgb === '120,200,255' ? '200,235,255' : DUST_TINT[g.level.material]); for (const t of foes(g, e.owner)) if (!e.hit.has(t) && Math.abs(cx(t) - e.x) < 26 && t.y + t.height > e.y - 40 && t.y + t.height <= e.y + 4) { e.hit.add(t); if (e.dmg) strike(g, e.owner, t, e.dmg, e.dir * e.push, -9); else { t.velocity.x = e.dir * e.push; t.velocity.y = -6; t.grounded = false; } } return true; },
        zone(g, e) { if (--e.life <= 0) return false; const kind = e.look; if (kind === 'fire' && R() < 0.5) g.fx.flame(e.x + RND(-e.w / 2, e.w / 2), e.y - 4, RND(6, 12), RND(8, 20), 22); if (kind === 'acid' && R() < 0.2) g.fx.add({ type: 'puff', x: e.x + RND(-e.w / 2, e.w / 2), y: e.y - 2, vx: 0, vy: -0.4, life: 30, color: '160,255,80', size: 2, grow: 0.1, alpha: 0.5 }); for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < e.w / 2 && Math.abs(t.y + t.height - e.y) < 6 && (t.zoneHitAt || 0) < g.frameCount - 20) { t.zoneHitAt = g.frameCount; strike(g, e.owner, t, kind === 'thorn' ? 4 : 3, undefined, undefined, kind === 'fire' ? { burn: 50 } : kind === 'acid' ? { poison: 60 } : { slow: 60 }); } return true; },
        hook(g, e) {
            const p = e.owner; if (p.isDead) return false;
            if (e.state === 'fly') {
                e.vy += 0.25; e.x += e.vx; e.y += e.vy;
                const t = foes(g, p).find(o => Math.abs(cx(o) - e.x) < 18 && Math.abs(cy(o) - e.y) < 30);
                if (t) { e.state = 'pullFoe'; e.t = t; e.life = 18; strike(g, p, t, 6, 0, 0, null, 'hookstaff'); }
                else if (platAt(g.level, e.x, e.y)) { e.state = 'pullMe'; e.life = 26; g.fx.sparks(e.x, e.y, '255,230,160', 6); }
                else if (--e.life <= 0) return false;
            } else if (e.state === 'pullFoe') { const t = e.t; t.velocity.x = Math.sign(cx(p) - cx(t)) * 11; t.velocity.y = -3; e.x = cx(t); e.y = cy(t); if (--e.life <= 0 || Math.abs(cx(p) - cx(t)) < 40) return false; }
            else { const dx = e.x - cx(p), dy = e.y - cy(p), d = Math.hypot(dx, dy) || 1; p.velocity.x = dx / d * 13; p.velocity.y = dy / d * 13 - 2; p.grounded = false; p.jumpCount = 1; if (--e.life <= 0 || d < 40) { p.velocity.y = Math.min(p.velocity.y, -6); return false; } }
            return true;
        },
        rod(g, e) { if (--e.life <= 0) return false; if (e.life % 40 === 0) { for (const t of foes(g, e.owner)) if (Math.hypot(cx(t) - e.x, cy(t) - (e.y - 40)) < 130) { strike(g, e.owner, t, 7, 0, -4, { stun: 24 }, 'thunderpike'); ent(g, { kind: 'arc', x0: e.x, y0: e.y - 70, x1: cx(t), y1: cy(t), life: 8 }); } } return true; },
        turret(g, e) { if (--e.life <= 0 || e.owner.isDead) { g.fx.debris(e.x, e.y - 10, '#607d8b', 6, 4); return false; } const t = foes(g, e.owner).filter(o => Math.hypot(cx(o) - e.x, cy(o) - (e.y - 20)) < 420).sort((a, b) => Math.hypot(cx(a) - e.x, cy(a) - e.y) - Math.hypot(cx(b) - e.x, cy(b) - e.y))[0]; if (t) { const a = Math.atan2(cy(t) - (e.y - 22), cx(t) - e.x); e.a += clamp(((a - e.a + Math.PI * 3) % TAU) - Math.PI, -0.08, 0.08); if (--e.cd <= 0) { e.cd = 34; ent(g, { kind: 'bolt', owner: e.owner, x: e.x + Math.cos(e.a) * 18, y: e.y - 22 + Math.sin(e.a) * 18, vx: Math.cos(e.a) * 11, vy: Math.sin(e.a) * 11, life: 60 }); AudioSys.playGun('bullet'); } } return true; },
        bolt(g, e) { e.x += e.vx; e.y += e.vy; if (--e.life <= 0 || platAt(g.level, e.x, e.y)) return false; for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 16 && Math.abs(cy(t) - e.y) < 32) { strike(g, e.owner, t, 5, Math.sign(e.vx) * 4, -2, null, 'wrench'); return false; } return true; },
        rang(g, e) {
            const p = e.owner; if (p.isDead) return false;
            e.life--;
            if (e.life < e.back || e.returning) { if (!e.returning && e.thunder) { ent(g, { kind: 'arc', x0: e.x + RND(-20, 20), y0: 0, x1: e.x, y1: e.y, life: 10, sky: true }); for (const t of foes(g, p)) if (Math.hypot(cx(t) - e.x, cy(t) - e.y) < 70) strike(g, p, t, 12, 0, -6, { stun: 24 }, typeOf(p)); } e.returning = true; const dx = cx(p) - e.x, dy = cy(p) - e.y, d = Math.hypot(dx, dy) || 1; e.vx += dx / d * 1.6; e.vy += dy / d * 1.6; const sp = Math.hypot(e.vx, e.vy); if (sp > 16) { e.vx *= 16 / sp; e.vy *= 16 / sp; } if (d < 24) return false; }
            if (e.back === undefined) e.back = e.life - 22;
            e.x += e.vx; e.y += e.vy; e.rot = (e.rot || 0) + 0.5;
            for (const t of foes(g, p)) if (!e.hit.has(t) && Math.abs(cx(t) - e.x) < 22 && Math.abs(cy(t) - e.y) < 34) { e.hit.add(t); strike(g, p, t, e.dmg, Math.sign(e.vx) * 8, -5, null, typeOf(p)); }
            if (e.life <= -80) return false;
            return true;
        },
        roller(g, e) {
            if (e.boulder && e.vy !== undefined && !e.rolling) { e.vy += 0.4; e.airY += e.vy; e.x += e.dir * 6; const gr = groundBelow(g.level, e.x, e.airY); if (gr && e.airY + 28 >= gr.y) { e.rolling = true; e.y = gr.y; } else if (e.airY > g.level.height + 50) return false; else { e.y = e.airY + 28; } }
            else { const gr = groundBelow(g.level, e.x, e.y - 8); if (!gr || Math.abs(gr.y - e.y) > 10) { e.y += 8; if (e.y > g.level.height + 40) return false; } else e.y = gr.y; e.x += e.dir * 6; }
            e.rot += e.dir * 0.2; if (--e.life <= 0) return false;
            for (const t of foes(g, e.owner)) if (!e.hit.has(t) && Math.abs(cx(t) - e.x) < 30 && t.y + t.height > e.y - 50 && t.y < e.y) { e.hit.add(t); strike(g, e.owner, t, 12, e.dir * 13, -8, null, e.boulder ? 'boulder' : 'logtrunk'); }
            return true;
        },
        meteorCall(g, e) { e.t++; if (e.t === e.T) { g.fx.explosion ? g.fx.explosion(e.x, e.gy - 10, 70) : null; g.fx.debris(e.x, e.gy, '#5a3a2a', 8, 6); g.fx.addTrauma && !g.demo && g.fx.addTrauma(0.2); AudioSys.playExplosion(); for (const t of foes(g, e.owner)) if (Math.hypot(cx(t) - e.x, cy(t) - (e.gy - 20)) < 80) strike(g, e.owner, t, 20, Math.sign(cx(t) - e.x || 1) * 11, -10, { burn: 70 }, 'meteor'); return false; } return true; },
        orbital(g, e) { e.t++; if (e.t >= e.T) { if (e.t === e.T) { g.fx.flashAt(e.x, g.level.height / 2, '150,220,255', 200, 10); AudioSys.playExplosion(); } for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 34) strike(g, e.owner, t, 6, 0, -3, { stun: 10 }, 'ioncannon'); return e.t < e.T + 24; } return true; },
        snowroll(g, e) { const gr = groundBelow(g.level, e.x, e.y - 8); if (!gr || Math.abs(gr.y - e.y) > 10) { e.y += 8; if (e.y > g.level.height + 40) return false; } else e.y = gr.y; e.x += e.dir * 5; e.r = Math.min(40, e.r + 0.25); if (--e.life <= 0) { g.fx.shards(e.x - e.r, e.y - e.r * 2, e.r * 2, e.r * 2, 'rgba(255,255,255,0.95)', 14); return false; } for (const t of foes(g, e.owner)) if (!e.hit.has(t) && Math.abs(cx(t) - e.x) < e.r + 12 && t.y + t.height > e.y - e.r * 2) { e.hit.add(t); strike(g, e.owner, t, 4 + e.r * 0.4, e.dir * (6 + e.r * 0.3), -7, { slow: 60 }, 'snowcannon'); } return true; },
        warpKnife(g, e) { if (--e.life <= 0) return false; if (e.stuck) return true; e.vy += 0.15; e.x += e.vx; e.y += e.vy; if (platAt(g.level, e.x, e.y)) { e.stuck = true; g.fx.sparks(e.x, e.y, '255,255,255', 4); return true; } for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 16 && Math.abs(cy(t) - e.y) < 30) { strike(g, e.owner, t, 9, Math.sign(e.vx) * 4, -3, null, 'knives'); e.stuck = true; e.vx = 0; e.vy = 0; } if (e.y > g.level.height + 50) return false; return true; },
        javelinPlat(g, e) {
            if (e.stuck) { if (--e.life <= 0) { const i = g.level.platforms.indexOf(e.pl); if (i >= 0) g.level.platforms.splice(i, 1); return false; } return true; }
            e.vy += 0.2; e.x += e.vx; e.y += e.vy;
            for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 16 && Math.abs(cy(t) - e.y) < 32) { strike(g, e.owner, t, 16, Math.sign(e.vx) * 7, -4, null, 'javelin'); return false; }
            const q = platAt(g.level, e.x + e.dir * 22, e.y);
            if (q) { e.stuck = true; e.life = 420; const tipX = e.dir > 0 ? q.x : q.x + q.width; e.x = tipX - e.dir * 30; e.pl = g.level.createPlatform(Math.min(tipX, tipX - e.dir * 56), e.y - 3, 56, 6); e.pl.noDraw = true; e.pl.mech = true; g.level.platforms.push(e.pl); g.fx.sparks(tipX, e.y, '255,220,150', 6); AudioSys.playAttack(); return true; }
            if (--e.life <= 0 || e.y > g.level.height + 50) return false;
            return true;
        },
        card(g, e) {
            e.t++;
            if (e.t < e.wait) { e.y += Math.sin(e.t * 0.2) * 0.4; return true; }
            if (e.t === e.wait) { const t = foes(g, e.owner).sort((a, b) => Math.hypot(cx(a) - e.x, cy(a) - e.y) - Math.hypot(cx(b) - e.x, cy(b) - e.y))[0]; const a = t ? Math.atan2(cy(t) - e.y, cx(t) - e.x) : (e.owner.facing > 0 ? 0 : Math.PI); e.vx = Math.cos(a) * 15; e.vy = Math.sin(a) * 15; }
            e.x += e.vx; e.y += e.vy;
            for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 14 && Math.abs(cy(t) - e.y) < 30) { strike(g, e.owner, t, 7, Math.sign(e.vx) * 4, -3, null, 'cards'); return false; }
            return e.t < e.wait + 60 && !platAt(g.level, e.x, e.y);
        },
        arrowRain(g, e) { e.t++; if (e.t % 4 === 0) { const x = e.x + RND(-70, 70); ent(g, { kind: 'bolt', owner: e.owner, x, y: -20, vx: RND(-0.5, 0.5), vy: 16, life: 70, arrow: true }); } return e.t < e.life; },
        zipArrow(g, e) { e.vy += 0.12; e.x += e.vx; e.y += e.vy; const q = platAt(g.level, e.x, e.y); for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 16 && Math.abs(cy(t) - e.y) < 30) { strike(g, e.owner, t, 12, Math.sign(e.vx) * 5, -3, null, 'compoundbow'); return false; } if (q || --e.life <= 0) { if (q && typeof Features !== 'undefined' && Math.abs(e.x - e.x0) > 160) { const z = Features.KINDS.zipline; const inst = { kind: 'zipline', x0: e.x0, y0: e.y0, x1: e.x, y1: e.y, riders: new Map(), temp: 600 }; if (inst.y1 < inst.y0) { [inst.x0, inst.x1] = [inst.x1, inst.x0]; [inst.y0, inst.y1] = [inst.y1, inst.y0]; } (g.level.features || (g.level.features = [])).push(inst); ent(g, { kind: 'zipLife', inst, life: 600 }); } return false; } return true; },
        zipLife(g, e) { if (--e.life <= 0) { const i = g.level.features.indexOf(e.inst); if (i >= 0) g.level.features.splice(i, 1); return false; } return true; },
        iceArrow(g, e) { e.vy += 0.12; e.x += e.vx; e.y += e.vy; for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 16 && Math.abs(cy(t) - e.y) < 30) { strike(g, e.owner, t, 12, Math.sign(e.vx) * 4, -3, { freeze: 60 }, 'icebow'); return false; } const q = platAt(g.level, e.x, e.y); if (q || --e.life <= 0 || e.y > g.level.height) { tempPlat(g, e.x - 40, (q ? e.y - 30 : e.y) - 6, 80, 12, 260, 'ice'); g.fx.shards(e.x - 20, e.y - 10, 40, 20, 'rgba(220,245,255,0.95)', 10); return false; } return true; },
        twister(g, e) { if (--e.life <= 0) return false; e.x += e.dir * 2; const gr = groundBelow(g.level, e.x, e.y - 8); if (!gr) return false; e.y = gr.y; if (R() < 0.7) g.fx.swirl(e.x, e.y - RND(0, 120), { shape: 'dot', color: '220,230,240', rise: 30, spin: 9, r0: 30, r1: 22, size: 2, life: 22 }); for (const t of foes(g, e.owner)) { const dx = e.x - cx(t), d = Math.abs(dx); if (d < 120 && Math.abs(cy(t) - (e.y - 60)) < 100) { t.velocity.x += Math.sign(dx) * 0.6; t.velocity.y -= 0.7; t.grounded = false; if (d < 26 && (t.twistAt || 0) < g.frameCount - 40) { t.twistAt = g.frameCount; strike(g, e.owner, t, 6, (R() < 0.5 ? -1 : 1) * 10, -12, null, 'stormstaff'); } } } return true; },
        pillar(g, e) { e.t++; if (e.t < e.T) { if (e.t % 3 === 0) g.fx.add({ type: 'chunk', x: e.x + RND(-20, 20), y: e.gy - 2, vx: RND(-1, 1), vy: -RND(1, 3), life: 20, color: '#6d5a48', size: 2, gravity: 0.3, rot: 0, vr: 0.3, drag: 0.99 }); return true; } if (e.t === e.T) { e.pl = g.level.createPlatform(e.x - 22, e.gy, 44, 0); e.pl.noDraw = true; e.pl.mech = true; g.level.platforms.push(e.pl); for (const t of foes(g, e.owner)) if (Math.abs(cx(t) - e.x) < 34 && Math.abs(t.y + t.height - e.gy) < 30) strike(g, e.owner, t, 12, 0, -16, null, 'earthstaff'); g.fx.dust(e.x, e.gy, 10, 30, DUST_TINT[g.level.material]); } const h = Math.min(120, (e.t - e.T) * 20); if (e.pl && e.t < e.T + 300) { e.pl.y = e.gy - h; e.pl.height = h; e.h = h; return true; } if (e.pl) { const i = g.level.platforms.indexOf(e.pl); if (i >= 0) g.level.platforms.splice(i, 1); g.fx.dust(e.x, e.gy - 40, 10, 30, DUST_TINT[g.level.material]); } return false; },
        timeBubble(g, e) { if (--e.life <= 0) return false; for (const t of foes(g, e.owner)) if (Math.hypot(cx(t) - e.x, cy(t) - e.y) < e.r) { t.velocity.x *= 0.7; t.velocity.y *= 0.8; t.timeSlow = 2; } for (const pr of g.projectiles) if (pr.active && pr.owner !== e.owner && Math.hypot(pr.x - e.x, pr.y - e.y) < e.r) { pr.vx *= 0.85; pr.vy *= 0.85; } return true; },
        arc(g, e) { return --e.life > 0; }
    };

    // ---------- drawing the entities ----------
    const D = {
        tempPlat(ctx, e) { const p = e.pl, a = Math.min(1, e.life / 20); ctx.save(); ctx.globalAlpha = a; const gr = ctx.createLinearGradient(0, p.y, 0, p.y + p.height); gr.addColorStop(0, 'rgba(230,248,255,0.95)'); gr.addColorStop(1, 'rgba(120,190,240,0.85)'); ctx.fillStyle = gr; ctx.fillRect(p.x, p.y, p.width, p.height); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1); ctx.restore(); },
        crescent(ctx, e) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x - e.dir * 20, e.y, 40, -0.9 * e.dir + (e.dir < 0 ? Math.PI : 0), 0.9 * e.dir + (e.dir < 0 ? Math.PI : 0), e.dir < 0); ctx.stroke(); ctx.restore(); },
        wave(ctx, e) { const a = Math.min(1, e.life / 10); ctx.fillStyle = `rgba(${e.rgb},${0.5 * a})`; ctx.beginPath(); ctx.moveTo(e.x - e.dir * 30, e.y); ctx.quadraticCurveTo(e.x, e.y - 40, e.x + e.dir * 12, e.y); ctx.fill(); },
        zone(ctx, e) { const a = Math.min(1, e.life / 30, (e.max - e.life) / 10); const col = { fire: '255,120,40', acid: '150,255,60', thorn: '60,120,40' }[e.look]; if (e.look === 'thorn') { ctx.fillStyle = `rgba(${col},${a})`; for (let i = -3; i <= 3; i++) { const x = e.x + i * e.w / 7; ctx.beginPath(); ctx.moveTo(x - 6, e.y); ctx.lineTo(x, e.y - 16 - (i % 2) * 6); ctx.lineTo(x + 6, e.y); ctx.fill(); } } else { ctx.fillStyle = `rgba(${col},${0.35 * a})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.w / 2, 5, 0, 0, TAU); ctx.fill(); glow(ctx, e.x, e.y, e.w * 0.6, col, 0.25 * a); } },
        hook(ctx, e) { const p = e.owner; ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx(p), cy(p) - 10); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, Math.PI); ctx.stroke(); },
        rod(ctx, e) { ctx.fillStyle = '#37474f'; ctx.fillRect(e.x - 2, e.y - 70, 4, 70); glow(ctx, e.x, e.y - 72, 16 + 6 * Math.sin(e.life * 0.3), '255,240,120', 0.7); },
        turret(ctx, e) { ctx.fillStyle = '#455a64'; ctx.fillRect(e.x - 12, e.y - 14, 24, 14); ctx.fillStyle = '#607d8b'; ctx.beginPath(); ctx.arc(e.x, e.y - 22, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#263238'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(e.x, e.y - 22); ctx.lineTo(e.x + Math.cos(e.a) * 20, e.y - 22 + Math.sin(e.a) * 20); ctx.stroke(); glow(ctx, e.x, e.y - 22, 6, e.life % 30 < 15 ? '255,60,60' : '60,255,120', 0.8); },
        bolt(ctx, e) { if (e.arrow) { ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(e.x, e.y - 16); ctx.lineTo(e.x, e.y); ctx.stroke(); return; } glow(ctx, e.x, e.y, 8, '255,200,80', 0.9); },
        rang(ctx, e) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.fist ? 0 : e.rot); if (e.fist) { ctx.scale(Math.sign(e.vx) || 1, 1); ctx.fillStyle = '#ef6c00'; ctx.fillRect(-10, -7, 18, 14); ctx.fillStyle = '#ffb74d'; ctx.fillRect(-10, -7, 6, 14); glow(ctx, -14, 0, 12, '255,160,60', 0.8); } else { ctx.fillStyle = `rgb(${e.rgb})`; ctx.fillRect(-4, -18, 8, 36); ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(0, -6); ctx.lineTo(18, -14); ctx.lineTo(18, 4); ctx.lineTo(0, -2); ctx.lineTo(-18, 4); ctx.closePath(); ctx.fill(); } ctx.restore(); if (e.thunder) glow(ctx, e.x, e.y, 20, '150,200,255', 0.5); },
        roller(ctx, e) { const r = e.boulder ? 26 : 20; ctx.save(); ctx.translate(e.x, e.y - r); ctx.rotate(e.rot); if (e.boulder) { ctx.fillStyle = '#7a6a5a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.4, r * 0.3); ctx.stroke(); } else { ctx.fillStyle = '#6d4c41'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 2; for (let k = 6; k < r; k += 5) { ctx.beginPath(); ctx.arc(0, 0, k, 0, TAU); ctx.stroke(); } } ctx.restore(); },
        meteorCall(ctx, e) { const k = e.t / e.T, sx = e.x - 400 * (1 - k), sy = e.gy - 800 * (1 - k); ctx.fillStyle = `rgba(20,10,10,${0.2 + k * 0.4})`; ctx.beginPath(); ctx.ellipse(e.x, e.gy, 10 + k * 36, 3 + k * 5, 0, 0, TAU); ctx.fill(); glow(ctx, sx, sy, 18 + k * 20, '255,170,60', 0.9); ctx.strokeStyle = 'rgba(255,200,120,0.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx - 60, sy - 120); ctx.lineTo(sx, sy); ctx.stroke(); },
        orbital(ctx, e, g) { if (e.t < e.T) { const k = e.t / e.T; ctx.strokeStyle = `rgba(150,220,255,${0.15 + k * 0.4})`; ctx.lineWidth = 1 + k * 2; ctx.beginPath(); ctx.moveTo(e.x, 0); ctx.lineTo(e.x, g.level.height); ctx.stroke(); ctx.beginPath(); ctx.ellipse(e.x, g.level.height - 60, 30 * (1 - k) + 6, 6, 0, 0, TAU); ctx.stroke(); } else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,220,255,0.5)'; ctx.fillRect(e.x - 30, 0, 60, g.level.height); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(e.x - 8, 0, 16, g.level.height); ctx.restore(); } },
        snowroll(ctx, e) { ctx.fillStyle = '#fafcff'; ctx.beginPath(); ctx.arc(e.x, e.y - e.r, e.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,190,220,0.4)'; ctx.beginPath(); ctx.arc(e.x + e.r * 0.2, e.y - e.r * 0.8, e.r * 0.8, 0, Math.PI); ctx.fill(); },
        warpKnife(ctx, e) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.stuck ? 0 : Math.atan2(e.vy, e.vx)); ctx.fillStyle = '#cfd8dc'; ctx.fillRect(-10, -1.5, 16, 3); ctx.fillStyle = '#5d4037'; ctx.fillRect(-14, -2, 5, 4); ctx.restore(); glow(ctx, e.x, e.y, 14, '200,230,255', 0.4 + 0.2 * Math.sin(e.life * 0.3)); },
        javelinPlat(ctx, e) { ctx.save(); ctx.translate(e.x, e.y); if (!e.stuck) ctx.rotate(Math.atan2(e.vy, e.vx)); else if (e.dir < 0) ctx.scale(-1, 1); ctx.fillStyle = '#8d6e45'; ctx.fillRect(-30, -2.5, 56, 5); ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(36, 0); ctx.lineTo(26, 4); ctx.fill(); ctx.restore(); },
        card(ctx, e) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.t * 0.3); ctx.fillStyle = '#fafafa'; ctx.fillRect(-6, -9, 12, 18); ctx.fillStyle = '#e53935'; ctx.fillRect(-2, -3, 4, 6); ctx.restore(); },
        zipArrow(ctx, e) { ctx.strokeStyle = '#3e3a36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x, e.y); ctx.stroke(); },
        iceArrow(ctx, e) { glow(ctx, e.x, e.y, 10, '180,230,255', 0.8); },
        twister(ctx, e) { const a = Math.min(1, e.life / 30); for (let i = 0; i < 10; i++) { const u = i / 10, r = 6 + u * 40; ctx.strokeStyle = `rgba(220,230,240,${0.35 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x + Math.sin(e.life * 0.1 + u * 5) * 8 * u, e.y - u * 150, r, r * 0.22, 0, e.life * 0.3 + u * 4, e.life * 0.3 + u * 4 + 4.4); ctx.stroke(); } },
        pillar(ctx, e) { if (!e.pl) { ctx.strokeStyle = 'rgba(60,40,30,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x - 24, e.gy); ctx.lineTo(e.x - 6, e.gy - 2); ctx.lineTo(e.x + 4, e.gy + 1); ctx.lineTo(e.x + 24, e.gy - 1); ctx.stroke(); return; } const p = e.pl; ctx.fillStyle = '#7a6a5a'; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y + p.height); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x + 10, p.y); ctx.lineTo(p.x + p.width - 8, p.y + 2); ctx.lineTo(p.x + p.width + 4, p.y + p.height); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(p.x + 12, p.y + 10); ctx.lineTo(p.x + 20, p.y + p.height * 0.6); ctx.stroke(); },
        timeBubble(ctx, e) { const a = Math.min(1, e.life / 30); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,180,255,${0.5 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(160,130,255,${0.08 * a})`; ctx.fill(); ctx.strokeStyle = `rgba(230,220,255,${0.6 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.life * 0.05) * e.r * 0.5, e.y + Math.sin(e.life * 0.05) * e.r * 0.5); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.life * 0.004) * e.r * 0.3, e.y + Math.sin(e.life * 0.004) * e.r * 0.3); ctx.stroke(); ctx.restore(); },
        arc(ctx, e) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [w, c] of [[6, 'rgba(150,210,255,0.5)'], [2, 'rgba(255,255,255,0.95)']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(e.x0, e.y0); for (let i = 1; i < 8; i++) ctx.lineTo(e.x0 + (e.x1 - e.x0) * i / 8 + RND(-10, 10), e.y0 + (e.y1 - e.y0) * i / 8 + RND(-10, 10)); ctx.lineTo(e.x1, e.y1); ctx.stroke(); } ctx.restore(); }
    };

    // ---------- hooks into combat ----------
    const useBase = Game.prototype.useWeapon;
    Game.prototype.useWeapon = function (p) {
        if (!p.weapon) return;
        const type = typeOf(p), m = M[type];
        if (m && m.use) {
            const def = WEAPONS[type];
            let handled = false;
            try { handled = m.use(this, p, def); } catch (e) { handled = false; }
            if (handled) { if (p.weapon && isFinite(p.weapon.durability)) p.weapon.durability--; return; }
        }
        useBase.call(this, p);
    };
    const dmgBase = Player.prototype.takeDamage;
    Player.prototype.takeDamage = function (amount, attacker) {
        if (this.iframes > 0 && attacker) return;
        if (this.asleep > 0 && attacker) { this.asleep = 0; if (this.status) this.status.stun = 0; }
        if (this.shrink > 0) amount *= 1.3;
        if (attacker && attacker.shrink > 0) amount *= 0.6;
        const before = this.health;
        dmgBase.call(this, amount, attacker);
        const g = window.game;
        if (!g || this.mechSilent || this.inStatusTick || !attacker || attacker === this || this.health >= before) return;
        const m = M[this.lastHitType];
        if (m && m.hit && attacker.weapon && attacker.weapon.type === this.lastHitType) { try { m.hit(g, attacker, this, amount); } catch (e) { /* ignore */ } }
    };
    // remember the live controls (holding the attack button, which way you push)
    for (const C of [Player, typeof Bot !== 'undefined' ? Bot : null]) {
        if (!C) continue;
        const rb = C.prototype.readInput;
        C.prototype.readInput = function (game) { const inp = rb.call(this, game); this.lastInput = inp; if (this.confused > 0 && inp && inp.x) return Object.assign({}, inp, { x: -inp.x }); if (this.dance > 0 && inp) return Object.assign({}, inp, { attack: false, shield: false }); return inp; };
    }
    const fxBase = Game.prototype.playerFx;
    Game.prototype.playerFx = function (p) {
        fxBase.call(this, p);
        if (p.iframes > 0) p.iframes--;
        if (p.confused > 0) p.confused--;
        if (p.dance > 0) { p.dance--; if (p.dance % 10 === 0) this.fx.text(cx(p) + RND(-10, 10), p.y - 10, '♪', '#ffd740', 12); }
        if (p.asleep > 0) { p.asleep--; if (p.asleep % 40 === 0) this.fx.text(cx(p) + 8, p.y - 10, 'z', '#b3e5fc', 12); }
        if (p.shrink > 0) { p.shrink--; p.scale = 0.65 + 0.35 * Math.max(0, 1 - p.shrink / 20) * (p.shrink < 20 ? 1 : 0); if (p.shrink === 0) p.scale = 1; }
        if (p.squashed > 0) p.squashed--;
        if (p.sugar > 0) { p.sugar--; p.speedMul = Math.max(p.speedMul || 1, 1.45); if (p.sugar % 6 === 0) this.fx.add({ type: 'puff', x: cx(p), y: p.y + 40, vx: -p.velocity.x * 0.2, vy: -0.2, life: 20, color: ['255,128,171', '128,216,255', '255,229,127'][p.sugar % 3], size: 2, grow: 0, alpha: 0.8 }); }
        if (p.bubble > 0) { p.bubble--; p.velocity.x *= 0.85; p.velocity.y = Math.max(-2.2, p.velocity.y - 0.8); p.grounded = false; if (p.status) p.status.stun = Math.max(p.status.stun || 0, 2); else p.status = { stun: 2 }; if (p.bubble === 0) this.fx.ring(cx(p), cy(p), '200,235,255', 40, 2, 10); }
        if (p.held) { const h = p.held, t = h.t; if (t.isDead || p.isDead || !p.weapon) { p.held = null; t.heldBy = null; } else { t.x = cx(p) + p.facing * 60 - t.width / 2; t.y = p.y - 20; t.velocity.x = 0; t.velocity.y = 0; t.grounded = false; if (--h.life <= 0) { t.velocity.x = p.facing * 17; t.velocity.y = -9; strike(this, p, t, 10, p.facing * 17, -9, null, 'gravgun'); t.heldBy = null; p.held = null; } } }
        const m = M[typeOf(p)];
        if (m && m.hold && !p.isDead) { try { m.hold(this, p, WEAPONS[typeOf(p)]); } catch (e) { /* ignore */ } }
        if (!p.weapon || typeOf(p) !== 'anchor') if (p.diving === 'anchor') p.diving = null;
    };
    const projBase = Game.prototype.updateProjectiles;
    Game.prototype.updateProjectiles = function () {
        projBase.call(this);
        const post = this.mechPost; this.mechPost = [];
        if (post) for (const fn of post) { try { fn(); } catch (e) { /* ignore */ } }
        if (this.mechEnts && this.mechEnts.length) this.mechEnts = this.mechEnts.filter(e => { try { return E[e.kind] ? E[e.kind](this, e) : false; } catch (err) { return false; } });
    };
    const fxDraw = FX.prototype.draw;
    FX.prototype.draw = function (ctx) {
        const g = window.game;
        if (g && g.fx === this) {
            if (g.mechEnts) for (const e of g.mechEnts) if (D[e.kind]) { ctx.save(); try { D[e.kind](ctx, e, g); } catch (err) { /* skip */ } ctx.restore(); }
            for (const p of g.players) {
                if (p.isDead) continue;
                if (p.orbitPos && typeOf(p) === 'morningstar') { const [bx, by] = p.orbitPos; ctx.strokeStyle = '#757575'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx(p), cy(p)); ctx.lineTo(bx, by); ctx.stroke(); ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(bx, by, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#cfd8dc'; for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + p.orbitA; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 9, by + Math.sin(a) * 9); ctx.lineTo(bx + Math.cos(a) * 15, by + Math.sin(a) * 15); ctx.lineTo(bx + Math.cos(a + 0.3) * 9, by + Math.sin(a + 0.3) * 9); ctx.fill(); } }
                if (p.aimed > 10 && typeOf(p) === 'sniper') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,60,60,${Math.min(0.6, p.aimed / 60)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx(p) + p.facing * 30, p.y + 20); ctx.lineTo(cx(p) + p.facing * 1400, p.y + 20); ctx.stroke(); ctx.restore(); }
                if (p.bubble > 0) { ctx.strokeStyle = 'rgba(210,240,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx(p), cy(p), 40, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(200,235,255,0.15)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(cx(p) - 14, cy(p) - 16, 6, 10, -0.6, 0, TAU); ctx.fill(); }
                if (p.mirror > 0) { ctx.strokeStyle = `rgba(200,240,255,${0.3 + 0.2 * Math.sin(p.mirror * 0.3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx(p), cy(p), 46, 0, TAU); ctx.stroke(); }
                if (p.spin > 0 && typeOf(p) === 'glaive') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx(p), p.y + 6, 70, 14, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
                if (p.held) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(170,110,255,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx(p) + p.facing * 20, cy(p)); ctx.lineTo(cx(p.held.t), cy(p.held.t)); ctx.stroke(); ctx.restore(); }
                if (p.springAt && this.frameCount - p.springAt < 8 && typeOf(p) === 'boxglove') { const k = 1 - (g.frameCount - p.springAt) / 8; ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 12; i++) ctx.lineTo(cx(p) + p.facing * (20 + i * 10 * k), cy(p) - 4 + (i % 2 ? 4 : -4)); ctx.stroke(); ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(cx(p) + p.facing * (20 + 120 * k), cy(p) - 4, 12, 0, TAU); ctx.fill(); }
            }
        }
        fxDraw.call(this, ctx);
    };
    // squashed (mallet) and shrunk fighters look it
    const pdraw = Player.prototype.draw;
    Player.prototype.draw = function (ctx, game) {
        if (this.squashed > 0) { const k = Math.min(1, this.squashed / 20); ctx.save(); const fx = this.x + this.width / 2, fy = this.y + this.height; ctx.translate(fx, fy); ctx.scale(1 + 0.6 * k, 1 - 0.55 * k); ctx.translate(-fx, -fy); pdraw.call(this, ctx, game); ctx.restore(); return; }
        pdraw.call(this, ctx, game);
    };
    // dancing fighters can't swing
    const atkBase = Player.prototype.attack;
    Player.prototype.attack = function () { if (this.dance > 0) return; return atkBase.call(this); };
    // a new round clears every trick in the world
    const startBase = Game.prototype.startLevel;
    Game.prototype.startLevel = function (regenerate) {
        this.mechEnts = []; this.mechPost = [];
        for (const p of this.players) { p.iframes = 0; p.confused = 0; p.dance = 0; p.asleep = 0; p.shrink = 0; p.scale = 1; p.squashed = 0; p.sugar = 0; p.bubble = 0; p.held = null; p.heldBy = null; p.diving = null; p.mirror = 0; p.whirl = 0; p.spin = 0; p.venom = 0; p.combo = 0; p.aimed = 0; p.spinUp = 0; p.panGuard = 0; }
        return startBase.call(this, regenerate);
    };

    // what a weapon's trick is, shown over it when a person walks up to it
    const HINT = {
        katana: 'flash-step through them', cutlass: 'swings bat shots back', broadsword: 'launches them upward', claymore: 'third swing hits triple', falchion: 'hits harder at a run',
        machete: 'can knock their weapon away', kris: 'third cut bursts with venom', flamesword: 'sets the ground alight', frostblade: 'raises a wall of ice', thunderblade: 'calls lightning on them',
        shadowblade: 'steps behind the nearest foe', lasersword: 'cuts through shields', executioner: 'finishes the badly hurt', nodachi: 'the slash flies on', twinblades: 'whirlwind',
        trident: 'sends a wave along the floor', halberd: 'sweeps their legs', glaive: 'hold to spin it', naginata: 'vault up in mid-air', hookstaff: 'grapple to ledges',
        lance: 'joust: hit at a run', quarterstaff: 'pole-vault high', pitchfork: 'tosses them behind you', thunderpike: 'plants a lightning rod', whip: 'snatches their weapon',
        warscythe: 'reaps all around, heals you', chainsaw: 'hold to grind', morningstar: 'the ball orbits you', club: 'ground pound', anchor: 'mid-air: plunge down',
        wrench: 'builds a sentry turret', mallet: 'squashes them flat', labrys: 'thrown, comes back', logtrunk: 'rolls down the floor', pan: 'bats bullets back',
        thorhammer: 'thrown, returns with thunder', meteor: 'calls down a meteor', gravmaul: 'drags them in', knuckles: 'every 4th punch uppercuts', boxglove: 'spring punch',
        rocketfist: 'the fist flies and returns', tigerclaw: 'mid-air: pounce', claws: 'cling to walls', shotgun: 'mid-air: blasts you back', sniper: 'stand still to aim',
        revolver: 'fans three shots', minigun: 'spins up, slows you', raygun: 'shrinks them', freezeray: 'the frozen become a ledge', tesla: 'arcs to the nearest foe',
        acidgun: 'leaves acid puddles', nailgun: 'pins them to walls', bubblegun: 'floats them away', gravgun: 'grab and fling', sonic: 'boom all around you',
        watercannon: 'hold: a stream that shoves', dartgun: 'puts them to sleep', glitchgun: 'swaps places with them', ioncannon: 'orbital strike', seedgun: 'grows thorn bushes',
        snowcannon: 'a snowball that grows', knives: 'throw, then teleport to it', javelin: 'sticks in walls as a ledge', cards: 'cards wait, then strike', smokebomb: 'blinds and confuses',
        stormbow: 'arrow rain', compoundbow: 'leaves a zipline', icebow: 'freezes a ledge where it lands', boulder: 'rolls along the floor', icestaff: 'conjures ice steps',
        stormstaff: 'summons a twister', earthstaff: 'raises a rock pillar under them', windstaff: 'a harmless gale', timewand: 'slows time in a bubble', musicwand: 'makes them dance',
        mirrorwand: 'a mirror that reflects shots', candywand: 'sugar rush on every hit'
    };
    const wdraw = Weapon.prototype.draw;
    Weapon.prototype.draw = function (ctx, alpha, players) {
        wdraw.call(this, ctx, alpha, players);
        if (this.owner || !this.active || !players) return;
        const x = this.x + this.width / 2, y = this.y;
        const viewer = players.find(p => !p.isBot && !p.isDead && Math.abs(p.x + 15 - x) < 150 && Math.abs(p.y + 30 - y) < 140);
        if (!viewer) return;
        const def = WEAPONS[this.type], h = HINT[this.type];
        if (!def) return;
        ctx.save();
        ctx.textAlign = 'center'; ctx.font = '800 12px Orbitron, sans-serif';
        const rar = RARITY[def.rarity] || RARITY.common;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(def.name, x, y - 34); ctx.fillStyle = rar.color; ctx.fillText(def.name, x, y - 34);
        if (h) { ctx.font = '600 10px Orbitron, sans-serif'; ctx.strokeText(h, x, y - 20); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(h, x, y - 20); }
        ctx.restore();
    };

    // damage over time is not a fresh hit
    const stBase = Game.prototype.statusTick;
    Game.prototype.statusTick = function (p) { p.inStatusTick = true; try { stBase.call(this, p); } finally { p.inStatusTick = false; } };
    // short-lived ledges (ice walls, javelins, pillars) are solid, but the route planner leaves them out
    if (typeof BotNav !== 'undefined') {
        const st = BotNav.prototype.standable;
        BotNav.prototype.standable = function (p) { return st.call(this, p) && !p.mech; };
        BotNav.prototype.signature = function (level) { let s = ''; for (const p of level.platforms) if (!p.mech) s += p.active ? '1' : '0'; return s; };
    }

    return { M, HINT, count: () => Object.keys(M).length };
})();
