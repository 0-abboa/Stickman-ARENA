// Death animations. A KO is shown as the fighter's body dying in a way that fits the weapon that
// did it (cut in half, beheaded, pinned to the wall, flattened, burned to bones, riddled, ...),
// with a small flourish on the body. Nothing here is an attack: no beams, no big blasts.
//
//  * Each weapon has a pair: [body animation, accent]. Both always play together.
//  * A body animation changes how the corpse behaves and looks: it severs bones, moves, scales or
//    tints the ragdoll (Ragdoll.cut / frozen) and draws bullet holes and stuck props on it.
//  * An accent is a few small particles tied to the body (a glint, petals, casings, a wisp...).
//
// The corpse is created in Game.animate, which calls DeathAnim.attach with what onKO decided.

const BONES = RAG_BONES;
const DB = { NECK: 0, TORSO: 1, FUP: 2, FLOW: 3, BUP: 4, BLOW: 5, FTH: 6, FSH: 7, BTH: 8, BSH: 9 };
const ALLB = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LIMBS = [DB.FUP, DB.BUP, DB.FTH, DB.BTH];
const N = DFX.n, RND = DFX.rnd;

const DeathAnim = {
    // ---------- helpers ----------
    floorUnder(g, x, y) {
        let best = null;
        for (const p of g.level.platforms) if (p.active && x >= p.x && x <= p.x + p.width && p.y >= y - 4 && (best === null || p.y < best)) best = p.y;
        return best === null ? g.level.height : best;
    },
    mid(c) { const J = c.rag.pts; return { x: (J[1].x + J[2].x) / 2, y: (J[1].y + J[2].y) / 2 }; },
    push(c, joints, vx, vy) { for (const i of joints) { c.rag.pts[i].vx += vx; c.rag.pts[i].vy += vy; } },
    // joints on each side of a severed bone
    side(c, k) { const comp = c.rag.comp; return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(i => comp[i] === comp[BONES[k][1]]); },
    kin(c, dx, dy) { for (const p of c.rag.pts) { p.x += dx; p.y += dy; p.px = p.x; p.py = p.y; } },
    rot(c, cx, cy, a) { const s = Math.sin(a), co = Math.cos(a); for (const p of c.rag.pts) { const x = p.x - cx, y = p.y - cy; p.x = cx + x * co - y * s; p.y = cy + x * s + y * co; p.px = p.x; p.py = p.y; } },
    // nearest solid wall the body is heading for: arena edge or a tall block
    wallAhead(g, x, y, dir, max) {
        let best = dir > 0 ? g.level.width - 14 : 14;
        for (const p of g.level.platforms) {
            if (!p.active || p.motion || p.height < 48 || y < p.y - 6 || y > p.y + p.height + 6) continue;
            const e = dir > 0 ? p.x : p.x + p.width;
            if ((e - x) * dir > 12 && (e - x) * dir < (best - x) * dir) best = e;
        }
        return Math.abs(best - x) <= max ? best : null;
    },
    hook(c, fn) { c.anim.hooks.push(fn); },

    // ---------- lifecycle ----------
    attach(g, c, death) {
        c.anim = { age: 0, hooks: [], alpha: 1, props: [], holes: [], tint: null, xf: null, hidden: false, hideHead: false, xray: false, overlay: null, expression: 'ko' };
        const k = { dir: death.dir, rgb: Utils.hexRgb(c.color), col: c.color, weapon: death.weapon };
        if (death.body && BODY[death.body]) BODY[death.body](g, c, k);
        if (death.accent && ACCENT[death.accent]) ACCENT[death.accent](g, c, k);
    },

    step(c, dt, g) {
        const a = c.anim;
        if (!a) return;
        a.age += dt;
        a.hooks = a.hooks.filter(h => !h(dt, a.age));
    },

    // ---------- drawing ----------

    // Where the shoulder is drawn: just below the neck along the torso line. (It used to be a point 88% of the
    // way from hip to neck, which sits in the gap once the waist is cut and drew the arms as endless lines.)
    shoulder(J) {
        const dx = J[2].x - J[1].x, dy = J[2].y - J[1].y, d = Math.hypot(dx, dy) || 1;
        return { x: J[1].x + dx / d * 2.3, y: J[1].y + dy / d * 2.3 };
    },

    // The line segments of the body as drawn, back to front: [{ k, back, p0, p1 }]. A severed bone shows as
    // two short stubs (each at most 40% of the bone's real length, however far the pieces have drifted).
    segments(c) {
        const J = c.rag.pts, cut = c.rag.cutB, sh = this.shoulder(J), out = [];
        const add = (k, back) => {
            if (k === DB.NECK) return;
            const p0 = (k === DB.FUP || k === DB.BUP) ? sh : J[BONES[k][0]], p1 = J[BONES[k][1]];
            if (!cut.has(k)) { out.push({ k, back, p0, p1 }); return; }
            const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d * 0.4, c.rag.rest[k] * 0.4);
            out.push({ k, back, p0, p1: { x: p0.x + dx / d * len, y: p0.y + dy / d * len } });
            out.push({ k, back, p0: { x: p1.x - dx / d * len, y: p1.y - dy / d * len }, p1 });
        };
        for (const k of [DB.BUP, DB.BLOW, DB.BTH, DB.BSH]) add(k, true);
        add(DB.TORSO, false);
        for (const k of [DB.FTH, DB.FSH, DB.FUP, DB.FLOW]) add(k, false);
        return out;
    },

    draw(ctx, c, alpha) {
        const a = c.anim, J = c.rag.pts, col = c.color;
        const A = alpha * (a ? a.alpha : 1);
        if (A <= 0.01) return;
        if (!a) { StickArt.figure(ctx, J, col, { alpha: A, expression: 'ko', facing: c.facing }); return; }
        ctx.save();
        ctx.globalAlpha = A;
        if (a.xf) { ctx.translate(a.xf.ox, a.xf.oy); if (a.xf.rot) ctx.rotate(a.xf.rot); ctx.scale(a.xf.sx, a.xf.sy); ctx.translate(-a.xf.ox, -a.xf.oy); }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Cut lengthwise: the two halves of the drawing slide apart
        if (a.split && !a.splitting) {
            const m = this.mid(c), d = a.split.d;
            a.splitting = true;
            for (const side of [-1, 1]) {
                ctx.save();
                ctx.beginPath(); ctx.rect(side < 0 ? m.x - 400 + side * d : m.x + side * d, m.y - 400, 400, 800); ctx.clip();
                ctx.translate(side * d, Math.abs(d) * 0.15); ctx.rotate(side * a.split.tilt);
                this.draw(ctx, c, alpha);
                ctx.restore();
            }
            a.splitting = false;
            ctx.restore();
            return;
        }
        // Wiped away by a scan line (top) or sunk into the floor (bottom)
        if (a.clipTop !== undefined || a.clipBottom !== undefined) {
            ctx.beginPath(); ctx.rect(-5000, a.clipTop !== undefined ? a.clipTop : -5000, 10000, (a.clipBottom !== undefined ? a.clipBottom : 5000) - (a.clipTop !== undefined ? a.clipTop : -5000)); ctx.clip();
        }
        if (a.under) a.under(ctx, c, A);
        if (!a.hidden) {
            const W = [0, 4.4, 4, 4, 3.8, 3.8, 4.2, 4.2, 4, 4];
            for (const sg of this.segments(c)) {
                let color = a.tint ? a.tint(sg.k, col, c) : col;
                if (sg.back && !a.tint) color = StickArt.shade(col, 0.65);
                const w = W[sg.k];
                ctx.beginPath(); ctx.moveTo(sg.p0.x, sg.p0.y); ctx.lineTo(sg.p1.x, sg.p1.y);
                if (a.xray) { ctx.strokeStyle = '#000'; ctx.lineWidth = w + 3.5; ctx.stroke(); }
                else { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = w + 2.5; ctx.stroke(); }
                ctx.strokeStyle = a.xray ? '#fff' : color; ctx.lineWidth = w; ctx.stroke();
            }
            ctx.fillStyle = a.xray ? '#fff' : (a.tint ? a.tint(DB.FLOW, col, c) : col);
            for (const i of [4, 8]) { ctx.beginPath(); ctx.arc(J[i].x, J[i].y, 2.6, 0, Math.PI * 2); ctx.fill(); }
            if (!a.hideHead) StickArt.head(ctx, J, a.tint ? a.tint(DB.NECK, col, c) : col, { expression: a.expression, facing: c.facing });
            // bullet holes
            for (const h of a.holes) {
                if (c.rag.cutB.has(h.bone)) continue;     // the bone it was in has come off
                const [i, j] = BONES[h.bone], x = J[i].x + (J[j].x - J[i].x) * h.u, y = J[i].y + (J[j].y - J[i].y) * h.u;
                ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(x, y, h.r, 0, Math.PI * 2); ctx.fill();
                const glow = Math.max(0, 1 - (a.age - h.t) / 18);
                if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,230,160,${glow * 0.9})`; ctx.beginPath(); ctx.arc(x, y, h.r * (1 + glow), 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
            }
        }
        // stuck props (arrows, a spear...) ride the bone they are in
        for (const p of a.props) {
            if (c.rag.cutB.has(p.bone)) continue;
            const [i, j] = BONES[p.bone], x = J[i].x + (J[j].x - J[i].x) * p.u, y = J[i].y + (J[j].y - J[i].y) * p.u;
            const rot = Math.atan2(J[j].y - J[i].y, J[j].x - J[i].x) + p.rel;
            FX.drawers.prop(ctx, { shape: p.shape, w: p.w, x, y, rot, size: p.size, life: 1, max: 1 }, 1);
        }
        if (a.overlay) a.overlay(ctx, c, A);
        ctx.restore();
    }
};

const lerpRGB = (c1, c2, t) => `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
const hexArr = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const smoke = (g, x, y, n, rgb = '90,90,95', size = 8) => g.fx.cloud(x, y, n, 26, rgb, size, 46, 0.7);

// ---------- body animations ----------

// What sticks in a body pinned or bristling: by weapon (default spear / arrow)
const PROP_OF = { crossbow: 'bolt', spear: 'spear', pike: 'spear', bow: 'arrow', longbow: 'arrow', triplebow: 'arrow', compoundbow: 'arrow',
    nailgun: 'nail', seedgun: 'thorn', knives: 'dagger', harpoon: 'harpoon', javelin: 'javelin', warpick: 'weapon' };

const BODY = {
    // cut clean through the waist: the halves slide apart
    waist(g, c, k) {
        const J = c.rag.pts;
        c.rag.cut([DB.TORSO]);
        const top = [0, 1, 3, 4, 5, 6], bot = [2, 7, 8, 9, 10];
        DeathAnim.push(c, top, k.dir * 3.2, -4.5); DeathAnim.push(c, bot, -k.dir * 1.2, 1);
        c.rag.spin(0.012 * k.dir);
        const m = DeathAnim.mid(c);
        g.fx.streak(m.x - 46, m.y, m.x + 46, m.y, 4, '255,255,255', 12);
    },

    // head comes off and bounces away
    behead(g, c, k) {
        c.rag.cut([DB.NECK]);
        DeathAnim.push(c, [0], k.dir * 4, -7);
        c.rag.pts[0].vx += k.dir * 1; c.anim.expression = 'ko';
        DeathAnim.hook(c, () => { c.rag.pts[0].vx *= 0.995; return c.anim.age > 60; });
    },

    // limbs come off the body one by one
    dismember(g, c, k) {
        c.rag.cut([DB.NECK, ...LIMBS]);
        DeathAnim.push(c, DeathAnim.side(c, DB.FUP), k.dir * 3, -5); DeathAnim.push(c, DeathAnim.side(c, DB.BUP), -k.dir * 2, -4);
        DeathAnim.push(c, DeathAnim.side(c, DB.FTH), k.dir * 2, -2); DeathAnim.push(c, DeathAnim.side(c, DB.BTH), -k.dir * 3, -3);
        DeathAnim.push(c, [0], k.dir * 2, -6);
    },

    // sliced down the side: the back arm and leg fall away
    sideSlice(g, c, k) {
        c.rag.cut([DB.BUP, DB.BTH]);
        DeathAnim.push(c, DeathAnim.side(c, DB.BUP), -k.dir * 3.5, -3); DeathAnim.push(c, DeathAnim.side(c, DB.BTH), -k.dir * 4, -2);
        DeathAnim.push(c, [0, 1, 2, 3, 4, 7, 8], k.dir * 2, -1.5);
    },

    // cut into little pieces that shift and settle
    sushi(g, c, k) {
        c.rag.cut(ALLB);
        for (let i = 0; i < 11; i++) { c.rag.pts[i].vx += (i - 5) * 0.35 * k.dir + RND(-1, 1); c.rag.pts[i].vy += -RND(1, 3); }
    },

    // everything flies apart
    gibs(g, c, k) {
        c.rag.cut(ALLB);
        const m = DeathAnim.mid(c);
        for (const p of c.rag.pts) { const a = Math.atan2(p.y - m.y, p.x - m.x), s = RND(4, 8); p.vx += Math.cos(a) * s; p.vy += Math.sin(a) * s - 3; }
        c.anim.tint = (b, col, cc) => lerpRGB(hexArr(col), [38, 34, 34], Math.min(1, c.anim.age / 14));   // scorched
        g.fx.disc(m.x, m.y, 50, '255,240,200', '255,150,60', 10);
        smoke(g, m.x, m.y, N(6), '60,55,55', 9);
    },

    // flung away at speed, spinning, trailing stars
    launch(g, c, k) {
        DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 14, -11);
        c.rag.spin(0.1 * k.dir);
        DeathAnim.hook(c, (dt, age) => { if (age % 2 < dt) { const m = DeathAnim.mid(c); g.fx.star(m.x, m.y, '255,240,160'); } return age > 40; });
    },

    // knocked flat out stiff, like a plank
    plank(g, c, k) {
        const J = c.rag.pts; let released = false;
        for (const p of J) p.vx += k.dir * 22;
        DeathAnim.hook(c, (dt, age) => {
            if (age < 16 && !released) { const v = J.reduce((s, p) => s + p.vx, 0) / J.length; for (const p of J) p.vx = v; if (v < 5) released = true; }
            if (age % 2 < dt && age < 16) { const m = DeathAnim.mid(c); g.fx.streak(m.x - k.dir * 20, m.y + RND(-28, 28), m.x - k.dir * 62, m.y + RND(-28, 28), 2, '255,255,255', 8); }
            return age > 20;
        });
    },

    // spun like a top
    spinTop(g, c, k) {
        DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 9, -9);
        DeathAnim.hook(c, (dt, age) => { if (age < 34) { const m = DeathAnim.mid(c); DeathAnim.rot(c, m.x, m.y, 0.4 * k.dir * dt); for (const p of c.rag.pts) p.vy -= 0.28 * dt; } return age > 34; });
    },

    // pinned to the wall through the chest (or skewered where it falls)
    pinned(g, c, k) {
        const J = c.rag.pts, m = DeathAnim.mid(c), wall = DeathAnim.wallAhead(g, m.x, m.y, k.dir, 650);
        const shape = PROP_OF[k.weapon] || 'spear', size = { bolt: 64, arrow: 64, harpoon: 80, javelin: 96, weapon: 70 }[shape] || 100, n = shape === 'bolt' || shape === 'arrow' ? 3 : 1;
        const props = (ang) => { for (let i = 0; i < n; i++) c.anim.props.push({ shape, w: k.weapon, bone: DB.TORSO, u: 0.35 + i * 0.3 - (n - 1) * 0.15, rel: Math.atan2(Math.sin(ang), Math.cos(ang)) - Math.atan2(J[2].y - J[1].y, J[2].x - J[1].x) + (i - (n - 1) / 2) * 0.12, size }); };
        if (!wall) { props(k.dir > 0 ? 0 : Math.PI); DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 5, -3); return; }
        c.rag.frozen = true;
        const stopX = wall - k.dir * 11;
        DeathAnim.hook(c, (dt, age) => {
            const mm = DeathAnim.mid(c), step = Math.min(Math.abs(stopX - mm.x), 34 * dt);
            if (Math.abs(stopX - mm.x) > 1.5) { DeathAnim.kin(c, k.dir * step, (m.y - mm.y) * 0.1); return false; }
            // arrived: hang on the wall by the chest, limbs dangling
            c.rag.frozen = false;
            const py = Math.min(mm.y, DeathAnim.floorUnder(g, stopX, mm.y) - 46);   // hang on the wall with the feet off the floor
            J[1].x = stopX; J[1].y = py - 11; J[2].x = stopX; J[2].y = py + 11;
            c.rag.setPins([null, { x: J[1].x, y: J[1].y }, { x: J[2].x, y: J[2].y }]);
            props(k.dir > 0 ? 0 : Math.PI);
            for (const i of [3, 4, 5, 6, 7, 8, 9, 10]) { J[i].vx = -k.dir * 1.5; J[i].vy = -1; }
            g.fx.shock(stopX, py, 54, '255,235,190', 12, 3, 0);
            g.fx.cloud(stopX, py, N(8), 40, '190,180,165', 9, 36, 0.4);
            for (const i of [4, 6, 8, 10]) { J[i].vx += RND(-2, 2); }
            return true;
        });
    },

    // squashed flat, then wobbles
    flatten(g, c, k) {
        const J = c.rag.pts; let t0 = null, fl = 0;
        DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0, 14);
        DeathAnim.hook(c, (dt, age) => {
            const floor = DeathAnim.floorUnder(g, J[2].x, J[2].y);
            if (t0 === null) {
                if (floor - J[2].y < 14 || age > 40) { t0 = age; fl = floor; c.rag.frozen = true; g.fx.cloud(J[2].x - 30, fl, N(8), 40, '190,180,165', 10, 40, 0.3); g.fx.cloud(J[2].x + 30, fl, N(8), 40, '190,180,165', 10, 40, 0.3); g.fx.cracks(J[2].x, fl, 70, 80, 7, true); for (let i = 0; i < N(4); i++) g.fx.star(J[2].x + RND(-40, 40), fl - 20, '255,240,160'); }
                return false;
            }
            const u = Math.min(1, (age - t0) / 5), wob = Math.sin((age - t0) * 0.5) * 0.04 * Math.max(0, 1 - (age - t0) / 30);
            c.anim.xf = { ox: J[2].x, oy: fl + 3, sx: 1 + 0.45 * u, sy: 1 - 0.86 * u + wob };
            return false;
        });
    },

    // stuck full of arrows
    bristle(g, c, k) {
        const shapes = PROP_OF[k.weapon] || 'arrow';
        for (let i = 0; i < 6; i++) c.anim.props.push({ shape: shapes, w: k.weapon, bone: [DB.TORSO, DB.TORSO, DB.FTH, DB.BTH, DB.FUP, DB.BUP][i], u: RND(0.3, 0.7), rel: (k.dir > 0 ? Math.PI : 0) + Math.PI / 2 * (i % 2 ? 1 : -1) * 0 + RND(-0.7, 0.7) - 1.57 * 0, size: 44 });
        DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 3, -3);
    },

    // jerks as bullets hit, then drops
    riddle(g, c, k) {
        const J = c.rag.pts, n = { shooter: 3, revolver: 6, smg: 9, minigun: 15, shotgun: 12 }[k.weapon] || 6, dur = { minigun: 34, smg: 22, shotgun: 8, revolver: 14, shooter: 6 }[k.weapon] || 14;
        for (let i = 0; i < n; i++) c.anim.holes.push({ bone: [DB.TORSO, DB.TORSO, DB.FTH, DB.BTH, DB.FUP, DB.BUP][i % 6], u: RND(0.2, 0.85), r: 1.8 + RND(0, 1.4), t: Math.floor(i / n * dur) });
        c.rag.frozen = false;
        DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * (k.weapon === 'shotgun' ? 11 : 2.5), k.weapon === 'shotgun' ? -4 : -3);
        DeathAnim.hook(c, (dt, age) => {
            if (age < dur && k.weapon !== 'shotgun') { c.rag.shake(5); for (const p of J) { p.vx += k.dir * 0.5; p.vy -= 0.3; } if (age % 3 < dt) { const m = DeathAnim.mid(c); g.fx.sparks(m.x + RND(-6, 6), m.y + RND(-14, 14), '255,230,160', 2, undefined, 0, 4); } }
            return age > dur;
        });
    },

    // the head pops, the body slumps
    headPop(g, c, k) {
        const J = c.rag.pts;
        c.anim.hideHead = true;
        g.fx.shards(J[0].x - 6, J[0].y - 6, 12, 12, '#eceff1', N(10));
        g.fx.ring(J[0].x, J[0].y, '255,255,255', 40, 3, 10);
        smoke(g, J[0].x, J[0].y, N(5), '200,200,205', 8);
        DeathAnim.push(c, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 2, -1);
    },

    // bones show through (x-ray), then the skeleton falls apart
    skeleton(g, c, k) {
        let done = false;
        c.anim.tint = (b) => '#f1ece0';
        c.anim.xray = true;
        DeathAnim.hook(c, (dt, age) => {
            c.anim.xray = age < 12 && Math.floor(age / 3) % 2 === 0;
            if (age > 34 && !done) { done = true; c.rag.cut(ALLB); for (const p of c.rag.pts) { p.vx += RND(-1.6, 1.6); p.vy += -RND(1, 3); } const m = DeathAnim.mid(c); g.fx.dust(m.x, m.y + 14, N(8), 30, '230,225,210'); }
            return age > 36;
        });
    },

    // electrocuted: the skeleton flashes, then he is left charred
    zapped(g, c, k) {
        const J = c.rag.pts;
        c.anim.tint = (b, col) => lerpRGB(hexArr(col), [36, 34, 40], Math.min(1, Math.max(0, (c.anim.age - 20) / 14)));
        DeathAnim.hook(c, (dt, age) => {
            if (age < 26) { c.anim.xray = Math.floor(age / 2) % 2 === 0; c.rag.shake(7); for (const p of J) p.vy -= 0.25; if (age % 2 < dt) { const i = (Math.random() * 11) | 0, a = RND(0, 6.28); g.fx.add({ type: 'zap', x: J[i].x, y: J[i].y, x2: J[i].x + Math.cos(a) * RND(14, 34), y2: J[i].y + Math.sin(a) * RND(14, 34), color: '140,220,255', life: 7 }); } }
            else { c.anim.xray = false; if (age % 5 < dt) { const m = DeathAnim.mid(c); smoke(g, m.x + RND(-10, 10), m.y, 1, '60,60,66', 7); } }
            return age > 60;
        });
    },

    // burns black and crumbles to ash
    burn(g, c, k) {
        const J = c.rag.pts; let done = false;
        c.anim.tint = (b, col) => { const a = c.anim.age; return a < 14 ? lerpRGB(hexArr(col), [255, 140, 40], a / 14) : lerpRGB([255, 140, 40], [34, 30, 28], Math.min(1, (a - 14) / 36)); };
        DeathAnim.hook(c, (dt, age) => {
            if (age < 70 && age % 3 < dt) { const i = (Math.random() * 11) | 0; g.fx.flame(J[i].x, J[i].y + 4, 12 + RND(0, 10), 34 + RND(0, 20), 22); }
            if (age > 62 && !done) { done = true; c.rag.cut(ALLB); for (const p of J) { p.vx += RND(-1, 1); p.vy += -RND(0.5, 2); } for (let i = 0; i < N(26); i++) { const q = J[(Math.random() * 11) | 0]; g.fx.add({ type: 'chunk', x: q.x, y: q.y, vx: RND(-1.5, 1.5), vy: -RND(0.4, 2), life: 60 + RND(0, 40), color: '#3a3532', size: 1.5 + RND(0, 2), gravity: -0.01, rot: RND(0, 6), vr: RND(-0.2, 0.2), drag: 0.99 }); } smoke(g, J[2].x, J[2].y, N(6), '60,58,56', 10); }
            if (age > 70) c.anim.alpha = Math.max(0.35, 1 - (age - 70) / 140);
            return age > 220;
        });
    },

    // swells like a balloon and pops
    balloon(g, c, k) {
        const J = c.rag.pts; let popped = false;
        DeathAnim.hook(c, (dt, age) => {
            const m = DeathAnim.mid(c);
            if (age < 24) { for (const p of J) p.vy -= 0.62 * dt; const s = 1 + age / 24 * 0.9; c.anim.xf = { ox: m.x, oy: m.y, sx: s, sy: s }; c.anim.expression = 'hurt'; return false; }
            if (!popped) { popped = true; c.anim.xf = null; c.anim.expression = 'ko'; c.rag.cut(ALLB); for (const p of J) { const a = Math.atan2(p.y - m.y, p.x - m.x), s = RND(3, 6); p.vx += Math.cos(a) * s; p.vy += Math.sin(a) * s - 2; } g.fx.ring(m.x, m.y, '255,255,255', 70, 3, 12); smoke(g, m.x, m.y, N(8), '60,55,55', 10); for (let i = 0; i < N(6); i++) g.fx.star(m.x + RND(-30, 30), m.y + RND(-30, 30), '255,240,160'); }
            return true;
        });
    },

    // up in smoke: shrinks away into a puff of cloud
    cloudPoof(g, c, k) {
        const J = c.rag.pts;
        c.rag.frozen = true;
        c.anim.tint = (b, col) => lerpRGB(hexArr(col), [255, 255, 255], Math.min(1, c.anim.age / 12));
        DeathAnim.hook(c, (dt, age) => {
            const m = DeathAnim.mid(c), s = Math.max(0.02, 1 - age / 30);
            c.anim.xf = { ox: m.x, oy: m.y, sx: s, sy: s }; DeathAnim.kin(c, 0, -0.5 * dt);
            if (age % 2 < dt && age < 30) g.fx.add({ type: 'puff', x: m.x + RND(-18, 18), y: m.y + RND(-26, 22), vx: RND(-0.6, 0.6), vy: -RND(0.2, 0.8), life: 50, color: '255,255,255', size: 9 + RND(0, 7), alpha: 0.75, grow: 0.3, drag: 0.98 });
            if (age >= 30) { c.anim.hidden = true; c.anim.done = true; return true; }
            return false;
        });
    },

    // blasted into the sky, shrinking to a twinkle
    blastOff(g, c, k) {
        let vx = k.dir * 5, vy = -7;
        c.rag.frozen = true;
        DeathAnim.hook(c, (dt, age) => {
            vx *= Math.pow(1.045, dt); vy *= Math.pow(1.045, dt);
            DeathAnim.kin(c, vx * dt, vy * dt);
            const m = DeathAnim.mid(c), s = Math.max(0.05, 1 - age / 48);
            c.anim.xf = { ox: m.x, oy: m.y, sx: s, sy: s };
            DeathAnim.rot(c, m.x, m.y, 0.08 * dt);
            if (age % 2 < dt) g.fx.add({ type: 'puff', x: m.x, y: m.y, vx: 0, vy: 0, life: 22, color: '235,235,235', size: 5 + 5 * s, alpha: 0.6, grow: 0.5 });
            if (age >= 48) { for (let i = 0; i < 3; i++) g.fx.star(m.x + RND(-6, 6), m.y + RND(-6, 6), '255,255,200'); g.fx.flashAt(m.x, m.y, '255,255,220', 30, 8); c.anim.hidden = true; c.anim.done = true; return true; }
            return false;
        });
    },

    // frozen in the crosshairs, then bursts
    lockGibs(g, c, k) {
        const J = c.rag.pts; let popped = false;
        c.rag.frozen = true;
        c.anim.overlay = (ctx, cc) => {
            const a = c.anim.age; if (a > 20) return;
            const m = DeathAnim.mid(c), r = 40 - a * 0.8;
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a * 0.12); ctx.strokeStyle = `rgba(255,70,70,${a % 6 < 3 ? 1 : 0.4})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 1.3, 0); ctx.stroke(); }
            ctx.restore();
        };
        DeathAnim.hook(c, (dt, age) => {
            if (age < 20) return false;
            if (!popped) { popped = true; c.rag.frozen = false; c.rag.cut(ALLB); const m = DeathAnim.mid(c); for (const p of J) { const a = Math.atan2(p.y - m.y, p.x - m.x), s = RND(3, 7); p.vx += Math.cos(a) * s; p.vy += Math.sin(a) * s - 2; } g.fx.disc(m.x, m.y, 46, '255,240,200', '255,130,40', 10); smoke(g, m.x, m.y, N(6), '70,65,65', 9); }
            return true;
        });
    },

    // turns to crystal, then shatters
    crystal(g, c, k) {
        let done = false;
        c.rag.frozen = true;
        c.anim.tint = (b, col) => `hsl(${(c.anim.age * 14 + b * 30) % 360},90%,72%)`;
        DeathAnim.hook(c, (dt, age) => {
            if (age % 4 < dt) { const q = c.rag.pts[(Math.random() * 11) | 0]; g.fx.star(q.x, q.y, '255,255,255'); }
            if (age > 34 && !done) {
                done = true; c.rag.frozen = false; c.rag.cut(ALLB);
                const m = DeathAnim.mid(c); for (const p of c.rag.pts) { const a = Math.atan2(p.y - m.y, p.x - m.x), s = RND(1.5, 4); p.vx += Math.cos(a) * s; p.vy += Math.sin(a) * s - 2; }
                for (const col of ['#ff7878', '#ffd26e', '#82ffa0', '#78beff', '#d28cff']) g.fx.shards(m.x - 14, m.y - 28, 28, 56, col, N(6));
                g.fx.ring(m.x, m.y, '255,255,255', 60, 3, 12);
            }
            return age > 36;
        });
    },

    // swapped for a log in a puff of smoke
    kawarimi(g, c, k) {
        const m = DeathAnim.mid(c), floor = DeathAnim.floorUnder(g, m.x, m.y);
        c.anim.hidden = true; c.rag.frozen = true;
        g.fx.prop('log', m.x, m.y, { size: 70, rot: 0.3, vy: -3, vx: k.dir * 1.5, vr: 0.08 * k.dir, gravity: 0.5, stopY: floor - 11, life: 190 });
        g.fx.cloud(m.x, m.y, N(22), 60, '210,210,215', 14, 50, 0.5);
        g.fx.shock(m.x, m.y, 56, '235,235,240', 14, 3, 0);
        DeathAnim.hook(c, (dt, age) => { if (age > 30) { c.anim.done = true; return true; } return false; });
    },

    // plain knock-back (the general fall)
    topple(g, c, k) { DeathAnim.push(c, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k.dir * 4, -4); },

    // crumbles to dust
    dust(g, c, k) {
        const J = c.rag.pts; let done = false;
        c.anim.tint = (b, col) => lerpRGB(hexArr(col), [200, 198, 192], Math.min(1, c.anim.age / 20));
        DeathAnim.hook(c, (dt, age) => {
            for (let i = 0; i < N(3); i++) { const q = J[(Math.random() * 11) | 0]; g.fx.add({ type: 'chunk', x: q.x, y: q.y, vx: RND(0.2, 1.6) * k.dir, vy: -RND(0.2, 1.2), life: 50 + RND(0, 40), color: Math.random() < 0.7 ? '#c8c6c0' : k.col, size: 1.4 + RND(0, 2), gravity: -0.01, rot: RND(0, 6), vr: RND(-0.2, 0.2), drag: 0.99 }); }
            if (age > 24 && !done) { done = true; c.rag.cut(ALLB); for (const p of J) { p.vx += RND(-1, 1); p.vy += -RND(0.5, 1.5); } }
            if (age > 24) c.anim.alpha = Math.max(0, 1 - (age - 24) / 50);
            if (c.anim.alpha <= 0.02) { c.anim.done = true; return true; }
            return false;
        });
    }
};

// ---------- accents: small things on and around the body ----------

const ACCENT = {
    glint(g, c, k) { const m = DeathAnim.mid(c); g.fx.flashAt(m.x, m.y, '255,255,255', 56, 8); g.fx.sparks(m.x, m.y, '255,255,255', N(10), undefined, 0, 8); },
    petals(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(14); i++) g.fx.swirl(m.x, m.y, { shape: 'petal', color: '255,175,200', rise: RND(30, 90), spin: RND(-4, 4), r0: 6, r1: RND(30, 56), size: 4 + RND(0, 2), life: 60 + RND(0, 30) }); },
    leaves(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(12); i++) g.fx.swirl(m.x, m.y, { shape: 'leaf', color: '110,190,90', rise: RND(30, 90), spin: RND(-5, 5), r0: 6, r1: RND(30, 56), size: 5 + RND(0, 2), life: 56 + RND(0, 30) }); },
    leavesDark(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(10); i++) g.fx.swirl(m.x, m.y, { shape: 'leaf', color: '55,75,62', rise: RND(30, 80), spin: RND(-5, 5), r0: 6, r1: RND(30, 56), size: 5, life: 56 + RND(0, 24) }); },
    feathers(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(9); i++) g.fx.add({ type: 'feather', x: m.x + RND(-14, 14), y: m.y + RND(-20, 20), vx: RND(-1, 1), vy: RND(0.2, 0.8), life: 80, color: '240,240,235', size: 4, rot: RND(0, 6), vr: RND(-0.1, 0.1), seed: RND(0, 6), drag: 0.985 }); },
    casings(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(9); i++) g.fx.add({ type: 'chunk', x: m.x, y: m.y, vx: RND(-2.6, 2.6), vy: -RND(3, 7), life: 60, color: ['#ffca28', '#ffb300', '#ffd54f'][i % 3], size: 2 + RND(0, 1.5), gravity: 0.4, rot: RND(0, 6), vr: RND(-0.4, 0.4), drag: 0.99 }); },
    chips(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(14); i++) g.fx.add({ type: 'chunk', x: m.x, y: m.y, vx: RND(-4, 4), vy: -RND(2, 6), life: 50, color: ['#8d6e63', '#a1887f', '#d7b98e'][i % 3], size: 2 + RND(0, 2.5), gravity: 0.38, rot: RND(0, 6), vr: RND(-0.4, 0.4), drag: 0.99 }); },
    smokeUp(g, c, k) { const m = DeathAnim.mid(c); smoke(g, m.x, m.y, N(6), '90,90,95', 9); },
    embers(g, c, k) { const m = DeathAnim.mid(c); g.fx.embers(m.x, m.y, N(14), 4); },
    embersDark(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(14); i++) g.fx.swirl(m.x, m.y + 10, { shape: 'ember', color: '255,60,90', rise: RND(40, 110), spin: RND(-5, 5), r0: 6, r1: 34, size: 6, life: 50 + RND(0, 24) }); smoke(g, m.x, m.y, N(4), '18,10,28', 9); },
    stars(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(7); i++) g.fx.star(m.x + RND(-30, 30), m.y + RND(-30, 30), '255,240,160'); },
    ringSmall(g, c, k) { const m = DeathAnim.mid(c); g.fx.shock(m.x, m.y, 60, '255,235,190', 14, 4, 8); g.fx.sparks(m.x, m.y, '255,235,190', N(8), undefined, 0, 6); },
    scopeGlint(g, c, k) { const m = DeathAnim.mid(c); g.fx.star(c.rag.pts[0].x, c.rag.pts[0].y, '255,255,255'); g.fx.flashAt(c.rag.pts[0].x, c.rag.pts[0].y, '255,255,255', 40, 6); },
    sparkBlue(g, c, k) { const m = DeathAnim.mid(c); g.fx.sparks(m.x, m.y, '140,220,255', N(14), undefined, 0, 7); },
    hat(g, c, k) { const h = c.rag.pts[0]; g.fx.prop('hat', h.x, h.y - 8, { size: 40, vy: -8, vx: k.dir * 2, gravity: 0.4, vr: 0.14, life: 80, stopY: DeathAnim.floorUnder(g, h.x, h.y) - 6 }); g.fx.cloud(h.x, h.y, 3, 20, '200,190,170', 7, 30, 0.3); },
    dustSpiral(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(14); i++) g.fx.swirl(m.x, m.y, { shape: 'dot', color: '215,190,140', rise: RND(20, 60), spin: RND(-8, 8), r0: 8, r1: RND(26, 50), size: 3 + RND(0, 2), life: 50 + RND(0, 20) }); },
    wisp(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(4); i++) g.fx.swirl(m.x, m.y, { shape: 'soul', color: '200,170,255', rise: RND(70, 140), spin: RND(-4, 4), r0: 6, r1: 24, size: 7, life: 70 + RND(0, 30) }); smoke(g, m.x, m.y, N(4), '40,20,70', 8); },
    rainbow(g, c, k) { const m = DeathAnim.mid(c); ['255,90,90', '255,190,70', '255,240,90', '110,230,110', '90,190,255', '170,120,255'].forEach((col, i) => g.fx.later(i * 2, () => g.fx.shock(m.x, m.y, 54 - i * 4, col, 18, 3, 0))); g.fx.cloud(m.x, m.y - 6, N(5), 30, '255,255,255', 9, 44, 0.3); },
    drizzle(g, c, k) { const m = DeathAnim.mid(c); for (let i = 0; i < N(14); i++) g.fx.later(i, () => g.fx.add({ type: 'drop', x: m.x + RND(-24, 24), y: m.y - 30, vx: 0, vy: 3, life: 40, color: 'rgba(170,200,255,0.9)', size: 1.6, gravity: 0.3 })); },
    ashRing(g, c, k) { const m = DeathAnim.mid(c); g.fx.scorch(m.x, DeathAnim.floorUnder(g, m.x, m.y), 36); smoke(g, m.x, m.y + 10, N(4), '70,65,60', 8); },
    ghost(g, c, k) {
        const m = DeathAnim.mid(c);
        g.fx.flashAt(m.x, m.y, '215,235,255', 60, 10);
        g.fx.add({ type: 'ghost', x: m.x, y: m.y + 30, color: k.col, facing: c.facing, wings: true, life: 130 });
        g.fx.add({ type: 'pillar', x: m.x, y: 0, life: 50, color: '255,244,200', size: 14 });
        for (let i = 0; i < N(10); i++) g.fx.later(i * 9, () => g.fx.add({ type: 'feather', x: m.x + RND(-30, 30), y: m.y - 20 - i * 10 + RND(0, 20), vx: RND(-0.8, 0.8), vy: 0.5 + RND(0, 0.6), life: 80, color: '255,255,255', size: 4 + RND(0, 2), rot: RND(0, 6), vr: RND(-0.1, 0.1), seed: RND(0, 6), drag: 0.985 }));
    }
};

// ---------- which animation for which weapon: [body, accent] ----------

const WEAPON_DEATH = {
    sword: ['waist', 'glint'],            katana: ['behead', 'petals'],
    spear: ['pinned', 'ringSmall'],       hammer: ['flatten', 'stars'],
    axe: ['dismember', 'chips'],          scythe: ['skeleton', 'wisp'],
    bat: ['launch', 'ringSmall'],         rapier: ['sushi', 'glint'],
    gauntlet: ['plank', 'ringSmall'],     shooter: ['riddle', 'casings'],
    smg: ['riddle', 'tracers'],               shotgun: ['riddle', 'smokeUp'],
    sniper: ['headPop', 'scopeGlint'],    bow: ['bristle', 'feathers'],
    grenade: ['gibs', 'smokeUp'],         rocket: ['blastOff', 'stars'],
    dagger: ['sideSlice', 'embersDark'],  boomerang: ['spinTop', 'dustSpiral'],
    revolver: ['riddle', 'hat'],          minigun: ['riddle', 'brass'],  
    crossbow: ['pinned', 'chips'],        kunai: ['kawarimi', 'leavesDark'],
    flamethrower: ['burn', 'embers'],     plasma: ['zapped', 'sparkBlue'],
    bomb: ['balloon', 'stars'],           seeker: ['lockGibs', 'smokeUp'],
    magic_stick: ['cloudPoof', 'rainbow'], bird_crystal: ['crystal', 'stars']
};
// No weapon (fists, a fall of damage...): the spirit leaves, and one of a few plain endings
const GENERAL_BODY = ['topple', 'dust', 'gibs'];

Object.assign(Game.prototype, {
    // The weapon type that did the killing, if any (an angel counts as the crystal)
    killerWeapon(attacker) {
        if (!attacker) return null;
        if (attacker.isBird) return 'bird_crystal';
        let t = typeof WeaponDefs !== 'undefined' ? WeaponDefs.typeOf(attacker) : null;
        if (!t && attacker.lastWeapon) t = typeof attacker.lastWeapon === 'string' ? attacker.lastWeapon : attacker.lastWeapon.type;
        return t || null;
    },

    // Called when a fighter is KO'd: decide how they die. The corpse is built in animate(), which attaches it.
    deathEffect(p, attacker, force) {
        // The weapon that landed the blow (a projectile or a burn can outlive a weapon swap)
        const recent = p.lastHitAt !== undefined && this.frameCount - p.lastHitAt < 90;
        const type = recent && p.lastHitType !== undefined ? p.lastHitType : this.killerWeapon(attacker);
        let body, accent;
        const pair = type && (WEAPON_DEATH[type] || (WEAPONS[type] && WEAPONS[type].death));
        if (force) [body, accent] = force.split('+');
        else if (pair) [body, accent] = pair;
        else { body = GENERAL_BODY[(Math.random() * GENERAL_BODY.length) | 0]; accent = 'ghost'; }
        p.death = { body, accent, weapon: type, dir: attacker && attacker.x !== undefined ? (p.x >= attacker.x ? 1 : -1) : (p.facing || 1) };
        return p.death;
    }
});
