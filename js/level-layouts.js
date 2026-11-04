// Every arena layout. Each build() places platforms through a small API (see
// Level.buildLayout): x(f) is a fraction of the width, y(k) is k px above the
// bottom (squeezed on short screens so tiers never touch), ground() lays a
// slab on the bottom, bounce() a bouncer (power 15 normal, 19+ launch pad),
// mover() a platform that glides ({dx}/{dy}) or orbits ({r}), and sym() places
// a mirrored pair. Tiers sit 130px apart: one jump climbs a tier, a double
// jump climbs two, a bouncer about 225px, a launch pad 360px or more.
const LEVEL_LAYOUTS = [
    // ---------- The originals, reworked ----------
    { name: 'Arena', build({ W, H, x, y, plat, ground, bounce, mover, sym }) {
        ground(0, W);
        plat(0, y(390), 36, H - 50 - y(390));
        plat(W - 36, y(390), 36, H - 50 - y(390));
        plat(x(0.5) - 100, y(180), 200);
        mover(x(0.5) - 70, y(310), 140, { dy: 28, speed: 0.8 });
        plat(x(0.5) - 100, y(440), 200);
        sym(0.2, y(250), 150, plat);
        bounce(48, H - 70, 80);
        bounce(W - 128, H - 70, 80);
    } },
    { name: 'Islands', build({ W, H, x, y, plat, bounce, mover }) {
        for (let i = 0; i < 4; i++) {
            const count = 2 + (i % 2);
            const spacing = W / count;
            for (let j = 0; j < count; j++) {
                const w = 150 + Math.random() * 110;
                plat(j * spacing + spacing / 2 - w / 2 + (Math.random() - 0.5) * 60, y(150 + i * 130), w, 28);
            }
        }
        bounce(x(0.25) - 45, H - 22, 90, 17);
        bounce(x(0.75) - 45, H - 22, 90, 17);
    } },
    { name: 'The Tower', build({ W, H, x, y, plat, ground, mover, bounce }) {
        ground(0, W);
        let left = true;
        for (let i = 0; i < 5; i++) {
            const k = 180 + i * 130;
            if (i === 2) mover(left ? 100 : W - 250, y(k), 150, { dx: 60, speed: 1 });
            else plat(left ? 100 : W - 250, y(k), 150);
            left = !left;
        }
        plat(x(0.5) - 110, y(450), 220);
        bounce(x(0.5) - 45, H - 70, 90);
    } },
    { name: 'Trampoline Park', build({ W, H, x, y, plat, ground, bounce, sym }) {
        ground(0, W);
        sym(0.17, H - 70, 100, bounce);
        sym(0.38, H - 70, 90, (a, b, c) => bounce(a, b, c, 18));
        bounce(x(0.5) - 50, y(300), 100);
        sym(0.07, y(300), 150, plat);
        plat(x(0.5) - 90, y(520), 180);
        sym(0.28, y(430), 120, plat);
    } },
    { name: 'The Pit', build({ W, H, x, y, plat, ground, bounce, mover }) {
        // Two cliffs, a rock in the middle, and ferries shuttling across
        ground(0, x(0.24), 200);
        ground(x(0.76), W - x(0.76), 200);
        plat(x(0.5) - 70, y(320), 140, 30);   // high enough for ferry riders to pass under
        mover(x(0.37) - 55, y(200), 110, { dx: x(0.07), speed: 1.4 });
        mover(x(0.63) - 55, y(200), 110, { dx: x(0.07), speed: 1.4, phase: Math.PI });
        mover(x(0.5) - 55, y(480), 110, { dy: 50, speed: 1 });
        bounce(x(0.33) - 50, H - 22, 100, 19);
        bounce(x(0.67) - 50, H - 22, 100, 19);
        plat(60, y(360), 140);
        plat(W - 200, y(360), 140);
    } },
    { name: 'Rolling Hills', build({ W, H, y, plat, bounce, mover }) {
        // A random walk of hills with comfortable gaps. A few hills turn into a
        // bouncer or a lift, but only where their neighbours are still a jump apart.
        const hills = [{ px: 0, w: 180, k: 100 }];
        let px = 180 + 70 + Math.random() * 60, k = 100;
        while (px < W - 400) {
            const w = Math.min(140 + Math.random() * 180, W - 260 - px);
            if (w < 90) break;
            hills.push({ px, w, k });
            px += w + 60 + Math.random() * 80;
            k = Math.max(100, Math.min(400, k + (Math.random() - 0.5) * 180));
        }
        hills.push({ px: W - 180, w: 180, k: 100 });
        let prevSpecial = false;
        hills.forEach((h, i) => {
            const prev = hills[i - 1], next = hills[i + 1];
            const span = prev && next ? next.px - (prev.px + prev.w) : Infinity;
            const r = Math.random();
            if (!prevSpecial && span < 230 && r < 0.2) { mover(h.px, y(h.k), Math.min(h.w, 150), { dy: 40, speed: 0.9 }); prevSpecial = true; }
            else if (!prevSpecial && span < 230 && r < 0.35) { bounce(h.px, y(h.k - 20), Math.min(h.w, 110)); prevSpecial = true; }
            else { plat(h.px, y(h.k), h.w, 40); prevSpecial = false; }
        });
    } },

    // ---------- New arenas ----------
    { name: 'Elevator Shafts', build({ W, H, x, y, plat, ground, mover, sym }) {
        ground(0, x(0.3));
        ground(x(0.7), W - x(0.7));
        mover(x(0.36) - 50, y(260), 100, { dy: 150, speed: 1.4 });
        mover(x(0.5) - 50, y(260), 100, { dy: 150, speed: 1.4, phase: Math.PI });
        mover(x(0.64) - 50, y(260), 100, { dy: 150, speed: 1.4 });
        sym(0.13, y(250), 160, plat);
        plat(x(0.5) - 120, y(520), 240);
    } },
    { name: 'Ferris Wheel', build({ W, H, x, y, plat, ground, mover, bounce, sym }) {
        ground(0, x(0.28));
        ground(x(0.72), W - x(0.72));
        for (let i = 0; i < 4; i++) mover(x(0.5) - 55, y(340), 110, { r: 165, speed: 1.6, phase: i * Math.PI / 2 });
        sym(0.12, y(260), 150, plat);
        bounce(x(0.5) - 50, H - 30, 100, 19);
    } },
    { name: 'Sky Bridges', build({ W, H, x, y, plat, mover, bounce, sym }) {
        sym(0.07, y(130), 170, plat);
        sym(0.07, y(390), 140, plat);
        mover(x(0.5) - 90, y(150), 180, { dx: W * 0.22, speed: 1.8 });
        mover(x(0.5) - 80, y(280), 160, { dx: W * 0.22, speed: 1.8, phase: Math.PI });
        mover(x(0.5) - 70, y(410), 140, { dx: W * 0.15, speed: 1.4, phase: 1 });
        bounce(x(0.5) - 60, H - 24, 120, 20);
    } },
    { name: 'Bounce House', build({ W, H, x, y, plat, ground, bounce, sym }) {
        ground(0, x(0.16));
        ground(x(0.84), W - x(0.84));
        const n = 5, span = x(0.68) / n;
        for (let i = 0; i < n; i++) bounce(x(0.16) + i * span + 6, H - 40, span - 12, i % 2 ? 17 : 15);
        sym(0.3, y(300), 140, plat);
        plat(x(0.5) - 90, y(420), 180);
        sym(0.1, y(380), 120, plat);
    } },
    { name: 'Grand Staircase', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, W);
        for (let i = 0; i < 4; i++) {
            plat(x(0.06 + i * 0.09), y(170 + i * 115), 120);
            plat(W - x(0.06 + i * 0.09) - 120, y(170 + i * 115), 120);
        }
        mover(x(0.5) - 70, y(620), 140, { dx: W * 0.12, speed: 1.2 });
        plat(x(0.5) - 60, y(220), 120);
    } },
    { name: 'Twin Towers', build({ W, H, x, y, plat, ground, mover, sym }) {
        ground(0, x(0.3));
        ground(x(0.7), W - x(0.7));
        for (let i = 0; i < 4; i++) sym(0.15 + (i % 2) * 0.05, y(180 + i * 130), 130, plat);
        mover(x(0.5) - 60, y(300), 120, { r: 60, speed: 1.2 });
        mover(x(0.5) - 70, y(500), 140, { dx: Math.max(40, W * 0.3 - 290), speed: 1.4 });   // stays clear of the towers
    } },
    { name: 'Pinball', build({ W, H, x, y, plat, ground, bounce, sym }) {
        ground(0, W);
        plat(0, y(420), 36, H - 50 - y(420));
        plat(W - 36, y(420), 36, H - 50 - y(420));
        sym(0.2, H - 70, 80, bounce);
        sym(0.38, y(240), 80, (a, b, c) => bounce(a, b, c, 17));
        bounce(x(0.5) - 40, y(180), 80);
        sym(0.28, y(400), 140, plat);
        plat(x(0.5) - 80, y(520), 160);
        sym(0.1, y(260), 100, plat);
    } },
    { name: 'Ferry Crossing', build({ W, H, x, y, plat, ground, mover, bounce }) {
        ground(0, x(0.3), 120);
        ground(x(0.7), W - x(0.7), 120);
        mover(x(0.5) - 70, y(130), 140, { dx: W * 0.17, speed: 1.5 });
        mover(x(0.5) - 60, y(330), 120, { dx: W * 0.17, speed: 1.5, phase: Math.PI });
        plat(x(0.15) - 60, y(270), 120);
        plat(x(0.85) - 60, y(270), 120);
        bounce(x(0.5) - 50, H - 20, 100, 21);
    } },
    { name: 'Clockwork', build({ W, H, x, y, plat, ground, mover, sym }) {
        ground(0, W);
        for (let i = 0; i < 3; i++) {
            const r = Math.min(130, W * 0.1);   // wheels never reach the middle ledge
            mover(x(0.26) - 50, y(340), 100, { r, speed: 1.4, phase: i * 2.09 });
            mover(x(0.74) - 50, y(340), 100, { r, speed: 1.4, phase: i * 2.09, dir: -1 });
        }
        plat(x(0.5) - 60, y(340), 120);
        sym(0.05, y(200), 120, plat);
    } },
    { name: 'Layer Cake', build({ W, H, x, y, plat, ground, bounce }) {
        ground(0, W);
        plat(0, y(185), x(0.7));
        plat(x(0.3), y(320), x(0.7));
        plat(0, y(455), x(0.7));
        bounce(W - 120, H - 70, 100);
        bounce(20, y(205), 90);
    } },
    { name: 'Seesaw Skies', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, x(0.2));
        ground(x(0.8), W - x(0.8));
        for (let i = 0; i < 4; i++) {
            mover(x(0.26 + i * 0.16) - 55, y(260), 110, { dy: 110, speed: 1.3, phase: i % 2 ? Math.PI : 0 });
        }
        plat(x(0.5) - 80, y(520), 160);
    } },
    { name: 'Floating Market', build({ W, H, x, y, plat, ground, bounce }) {
        ground(x(0.38), x(0.24));
        const spots = [[0.1, 140], [0.9, 140], [0.25, 260], [0.75, 260], [0.5, 330], [0.14, 400], [0.86, 400], [0.35, 470], [0.65, 470]];
        for (const [f, k] of spots) plat(x(f) - 60, y(k), 120);
        bounce(x(0.18) - 40, H - 25, 80, 19);
        bounce(x(0.82) - 40, H - 25, 80, 19);
    } },
    { name: 'Launch Pads', build({ W, H, x, y, plat, ground, bounce, sym }) {
        ground(0, W);
        // Pads launch you up beside the perches; drift over to land
        sym(0.08, H - 70, 90, (a, b, c) => bounce(a, b, c, 20));
        sym(0.3, H - 70, 90, (a, b, c) => bounce(a, b, c, 21));
        sym(0.18, y(420), 130, plat);
        sym(0.4, y(500), 110, plat);
        plat(x(0.5) - 80, y(240), 160);
    } },
    { name: 'Halo', build({ W, H, x, y, plat, ground, mover, sym }) {
        ground(0, x(0.25));
        ground(x(0.75), W - x(0.75));
        plat(x(0.5) - 80, y(330), 160);
        for (let i = 0; i < 3; i++) mover(x(0.5) - 50, y(330), 100, { r: 200, speed: 1.6, phase: i * 2.09 });
        sym(0.1, y(230), 130, plat);
    } },
    { name: 'Elevator Race', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, W);
        mover(x(0.3) - 50, y(300), 100, { dy: 150, speed: 1.5 });
        mover(x(0.7) - 50, y(300), 100, { dy: 150, speed: 1.5, phase: Math.PI });
        plat(x(0.5) - 100, y(560), 200);
        plat(40, y(200), 140);
        plat(W - 180, y(200), 140);
        plat(x(0.5) - 60, y(230), 120);
    } },
    { name: 'Drift', build({ W, H, x, y, plat, ground, mover }) {
        ground(x(0.4), x(0.2));
        mover(x(0.17) - 90, y(120), 180, { dx: 70, speed: 0.8 });
        mover(x(0.83) - 90, y(120), 180, { dx: 70, speed: 0.8, phase: Math.PI });
        mover(x(0.3) - 70, y(260), 140, { dx: 90, speed: 1 });
        mover(x(0.7) - 70, y(260), 140, { dx: 90, speed: 1, phase: Math.PI });
        mover(x(0.5) - 80, y(400), 160, { dx: 140, speed: 1.2 });
        plat(30, y(380), 120);
        plat(W - 150, y(380), 120);
    } },
    { name: 'Spring Steps', build({ W, H, x, y, plat, ground, bounce, sym }) {
        // Stairs climb from both edges toward a launch pit in the middle; the
        // lowest steps carry springy bumpers
        for (let i = 0; i < 4; i++) {
            const k = 60 + i * 90;
            sym(0.0625 + i * 0.1, 0, x(0.1), (a, b, c) => {   // steps touch: no sliver gaps between them
                const g = ground(a, c, k);
                if (i === 0) bounce(a + 4, g.y - 20, Math.min(60, c * 0.45), 17);
            });
        }
        bounce(x(0.5) - 50, H - 22, 100, 21);
        plat(x(0.5) - 120, y(560), 240);
    } },
    { name: 'Castle Siege', build({ W, H, x, y, plat, ground, mover, bounce, sym }) {
        ground(0, W);
        ground(0, x(0.22), 190);
        ground(x(0.78), W - x(0.78), 190);
        sym(0.08, y(330), 100, plat);
        mover(x(0.5) - 80, y(220), 160, { dx: W * 0.18, speed: 1.4 });
        plat(x(0.5) - 70, y(400), 140);
        bounce(x(0.5) - 45, H - 70, 90);
    } },
    { name: 'Archipelago', build({ W, H, x, y, plat, mover, bounce }) {
        plat(0, y(110), x(0.2), 60);
        plat(x(0.4), y(150), x(0.2), 60);
        plat(x(0.8), y(110), x(0.2), 60);
        mover(x(0.3) - 50, y(200), 100, { dx: 50, speed: 1 });
        mover(x(0.7) - 50, y(200), 100, { dx: 50, speed: 1, phase: Math.PI });
        plat(x(0.15) - 70, y(320), 140);
        plat(x(0.85) - 70, y(320), 140);
        plat(x(0.5) - 80, y(420), 160);
        bounce(x(0.3) - 40, H - 20, 80, 19);
        bounce(x(0.7) - 40, H - 20, 80, 19);
    } },
    { name: 'Canyon', build({ W, H, x, y, plat, ground, mover, bounce }) {
        ground(0, x(0.25), 300);
        ground(x(0.75), W - x(0.75), 300);
        ground(x(0.25), x(0.5), 40);
        bounce(x(0.35) - 45, H - 60, 90, 19);
        bounce(x(0.65) - 45, H - 60, 90, 19);
        mover(x(0.5) - 70, y(300), 140, { dx: W * 0.16, speed: 1.6 });
        plat(x(0.5) - 60, y(160), 120);
    } },
    { name: 'Zigzag Lifts', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, W);
        mover(x(0.2) - 50, y(220), 100, { dy: 80, speed: 1.2 });
        mover(x(0.4) - 50, y(340), 100, { dy: 80, speed: 1.2, phase: Math.PI });
        mover(x(0.6) - 50, y(340), 100, { dy: 80, speed: 1.2 });
        mover(x(0.8) - 50, y(220), 100, { dy: 80, speed: 1.2, phase: Math.PI });
        plat(x(0.5) - 70, y(530), 140);
    } },
    { name: 'Merry-Go-Round', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, W);
        for (let i = 0; i < 6; i++) mover(x(0.5) - 45, y(380), 90, { r: Math.min(200, W * 0.2), speed: 1.7, phase: i * Math.PI / 3 });
        plat(30, y(200), 130);
        plat(W - 160, y(200), 130);
    } },
    { name: 'Hammock', build({ W, H, x, y, plat, ground, mover, bounce }) {
        ground(0, x(0.12));
        ground(x(0.88), W - x(0.88));
        plat(x(0.18), y(170), x(0.64), 30);
        mover(x(0.35) - 70, y(320), 140, { dx: W * 0.14, speed: 1.2 });
        mover(x(0.65) - 70, y(460), 140, { dx: W * 0.14, speed: 1.2, phase: Math.PI });
        bounce(x(0.5) - 50, H - 25, 100, 20);
    } },
    { name: 'Pillars', build({ W, H, x, y, plat, ground, bounce }) {
        const n = 7, gap = W / n;
        const tall = [90, 210, 140, 270, 140, 210, 90];
        for (let i = 0; i < n; i++) {
            const k = tall[i];
            const g = ground(i * gap + gap * 0.18, gap * 0.64, k);
            if (i === 1 || i === 5) bounce(i * gap + gap * 0.3, g.y - 20, gap * 0.4, 17);
        }
        plat(x(0.5) - 80, y(460), 160);
    } },
    { name: 'Crossfire', build({ W, H, x, y, plat, ground, mover, sym }) {
        ground(0, W);
        // Fast shuttles cross the middle between the pillar ledges, with room to ride
        plat(x(0.5) - 40, y(180), 80);
        plat(x(0.5) - 40, y(440), 80);
        mover(x(0.5) - 70, y(310), 140, { dx: W * 0.3, speed: 2.2 });
        mover(x(0.5) - 70, y(570), 140, { dx: W * 0.3, speed: 2.2, phase: Math.PI });
        sym(0.1, y(310), 120, plat);
    } },
    { name: 'Split Level', build({ W, H, x, y, plat, ground, mover, bounce }) {
        ground(0, x(0.5), 50);
        ground(x(0.5), x(0.5), 290);
        bounce(x(0.38) - 45, H - 70, 90, 20);
        mover(x(0.2) - 55, y(260), 110, { dy: 120, speed: 1.2 });
        plat(x(0.75) - 70, y(430), 140);
        plat(x(0.15) - 60, y(480), 120);
    } },
    { name: 'The Bowl', build({ W, H, x, y, plat, ground, bounce, sym }) {
        ground(x(0.3), x(0.4), 50);
        sym(0.24, 0, x(0.12), (a, b, c) => ground(a, c, 140));
        sym(0.12, 0, x(0.12), (a, b, c) => ground(a, c, 230));
        sym(0.03, 0, x(0.06), (a, b, c) => ground(a, c, 320));
        bounce(x(0.5) - 50, H - 70, 100, 19);
        plat(x(0.5) - 70, y(430), 140);
    } },
    { name: 'Orbiter', build({ W, H, x, y, plat, ground, mover, sym }) {
        // A two-seat wheel in the middle; stepping stones lead out to it and
        // everything stays clear of its path so riders are never scraped off
        const r = Math.min(150, W * 0.12);
        sym(0.12, 0, x(0.24), (a, b, c) => ground(a, c, 60));
        mover(x(0.5) - 60, y(300), 120, { r, speed: 1.8 });
        mover(x(0.5) - 60, y(300), 120, { r, speed: 1.8, phase: Math.PI });
        sym(0.12, y(300), 120, plat);
        sym(Math.max(0.12 + 125 / W, (W / 2 - r - 150) / W), y(190), 110, plat);   // stepping stones out to the wheel, beside (not under) the side ledges
        plat(x(0.5) - 50, y(560), 100);
    } },
    { name: 'Cloud Hop', build({ W, H, x, y, plat, mover }) {
        const cols = 6;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < cols; c++) {
                if ((r + c) % 2) continue;
                const cx = (c + 0.5) * W / cols, k = 110 + r * 130;
                if (r % 2 && c % 3 === 1) mover(cx - 50, y(k), 100, { dy: 22, speed: 0.6, phase: c });
                else plat(cx - 55, y(k), 110);
            }
        }
    } },
    { name: 'Sky Fortress', build({ W, H, x, y, plat, ground, mover, bounce, sym }) {
        ground(x(0.1), x(0.8));
        sym(0.18, y(200), 130, plat);
        sym(0.3, H - 70, 80, (a, b, c) => bounce(a, b, c, 18));
        mover(x(0.5) - 80, y(260), 160, { dy: 60, speed: 1 });
        for (let i = 0; i < 2; i++) mover(x(0.5) - 50, y(520), 100, { r: 100, speed: 1.4, phase: i * Math.PI });
        sym(0.08, y(420), 120, plat);
    } },
    { name: 'Rush Hour', build({ W, H, x, y, plat, ground, mover }) {
        ground(0, W);
        const reach = Math.max(120, W * 0.38 - 150);   // shuttles stop short of the side ledges
        mover(x(0.5) - 60, y(160), 120, { dx: reach, speed: 3 });
        mover(x(0.5) - 60, y(290), 120, { dx: reach, speed: 2.4, phase: 2 });
        mover(x(0.5) - 60, y(420), 120, { dx: reach, speed: 3, phase: 4 });
        plat(20, y(350), 110);
        plat(W - 130, y(350), 110);
    } },
    { name: 'Trapeze', build({ W, H, x, y, plat, mover, bounce, sym }) {
        sym(0.08, y(150), 160, (a, b, c) => plat(a, b, c, 40));
        mover(x(0.3) - 50, y(260), 100, { r: 90, speed: 1.5 });
        mover(x(0.7) - 50, y(260), 100, { r: 90, speed: 1.5, dir: -1 });
        plat(x(0.5) - 70, y(200), 140);
        sym(0.1, y(420), 120, plat);
        plat(x(0.5) - 60, y(480), 120);
        bounce(x(0.5) - 60, H - 22, 120, 21);
    } },
    { name: 'Spring Fortress', build({ W, H, x, y, plat, ground, bounce, movingBounce, sym }) {
        ground(0, W);
        movingBounce(x(0.5) - 45, H - 70, 90, { dx: W * 0.25, speed: 1.6 });
        sym(0.15, y(220), 160, plat);
        sym(0.4, y(350), 110, plat);
        plat(x(0.5) - 60, y(480), 120);
        sym(0.04, y(200), 60, (a, b, c) => bounce(a, H - 70, c, 18));
    } }
];
