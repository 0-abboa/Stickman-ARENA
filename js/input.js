// 78 more arenas (three times the original 39). Same API and spacing rules as level-layouts.js:
// tiers ~130px apart (one jump), double jump two tiers, bouncer ~225px, launch pad (19+) 360px+;
// horizontal gaps a running jump can clear; enough wide static floor for everyone to spawn on.
(() => {
    const more = [
        { name: 'Twin Peaks', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            sym(0.25, y(190), 200, plat); sym(0.25, y(320), 120, plat);
            plat(x(0.5) - 80, y(450), 160);
            bounce(x(0.5) - 50, H - 70, 100);
            sym(0.06, y(260), 110, plat);
        } },
        { name: 'Pyramid', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            [[620, 165], [440, 290], [260, 415], [110, 540]].forEach(([w, k]) => plat(x(0.5) - w / 2, y(k), w));
            sym(0.06, y(200), 120, plat);
            sym(0.12, H - 70, 90, bounce);
        } },
        { name: 'Inverted Pyramid', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            plat(x(0.5) - 340, y(150), 130); plat(x(0.5) + 210, y(150), 130);
            plat(x(0.5) - 190, y(280), 380);
            plat(x(0.5) - 310, y(410), 250); plat(x(0.5) + 60, y(410), 250);
            sym(0.1, y(220), 130, plat);
            sym(0.14, H - 70, 90, bounce);
        } },
        { name: 'Checkerboard', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2 === 0) plat(x(0.09 + j * 0.164) - 65, y(150 + i * 125), 130);
        } },
        { name: 'Ladder Left', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) plat(x(0.06 + i * 0.16), y(150 + i * 120), 150);
            plat(x(0.7), y(510), x(0.25));
            plat(x(0.78), y(260), 150);
            bounce(W - 140, H - 70, 100);
        } },
        { name: 'Ladder Right', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) plat(W - x(0.06 + i * 0.16) - 150, y(150 + i * 120), 150);
            plat(x(0.05), y(510), x(0.25));
            plat(x(0.22) - 150, y(260), 150);
            bounce(40, H - 70, 100);
        } },
        { name: 'The Gauntlet', build({ W, H, x, y, plat, ground, mover }) {
            const n = 5, gap = 90, seg = (W - gap * (n - 1)) / n;
            for (let i = 0; i < n; i++) ground(i * (seg + gap), seg);
            for (let i = 0; i < n - 1; i++) mover(i * (seg + gap) + seg - 30, y(170), 150, { dy: 30, speed: 0.9, phase: i });
            plat(x(0.5) - 120, y(330), 240);
            plat(x(0.15) - 70, y(330), 140); plat(x(0.85) - 70, y(330), 140);
        } },
        { name: 'Pit Stop', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, x(0.36)); ground(x(0.64), W - x(0.64));
            bounce(x(0.5) - 60, H - 22, 120, 20);
            plat(x(0.5) - 90, y(420), 180);
            sym(0.22, y(240), 150, plat);
            sym(0.08, y(370), 120, plat);
        } },
        { name: 'Floating Rings', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, x(0.12)); ground(x(0.88), W - x(0.88));
            for (const cx of [0.3, 0.7]) for (let i = 0; i < 3; i++) mover(x(cx) - 50, y(300), 100, { r: 110, speed: 1.2, phase: i * Math.PI * 2 / 3 });
            plat(x(0.5) - 70, y(200), 140);
            plat(x(0.5) - 80, y(480), 160);
            sym(0.04, y(260), 110, plat);
        } },
        { name: 'Clock Tower', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            plat(x(0.5) - 35, y(420), 70, y(220) - y(420));   // the tower floats: there is a way under it
            plat(x(0.5) - 90, y(420), 180);
            for (let i = 0; i < 2; i++) mover(x(0.5) - 50, y(360), 100, { r: Math.min(190, H - 150 - y(360)), speed: 1.3, phase: i * Math.PI });
            sym(0.16, y(200), 150, plat);
            sym(0.12, y(340), 120, plat);
        } },
        { name: 'Highway', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            mover(x(0.5) - 110, y(200), 220, { dx: W * 0.3, speed: 2 });
            mover(x(0.5) - 110, y(380), 220, { dx: W * 0.3, speed: 2, phase: Math.PI });
            sym(0.05, y(290), 140, plat);
            plat(x(0.5) - 70, y(520), 140);
        } },
        { name: 'Pendulum', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            for (let i = 0; i < 3; i++) mover(x(0.25 + i * 0.25) - 55, y(220 + (i % 2) * 120), 110, { dx: W * 0.08, dy: 25, speed: 1.2, phase: i * 1.3 });
            sym(0.07, y(180), 130, plat);
            plat(x(0.5) - 90, y(480), 180);
            sym(0.27, y(470), 110, plat);
        } },
        { name: 'Volcano Rim', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, x(0.3), 200); ground(x(0.7), W - x(0.7), 200);
            ground(x(0.3), x(0.4));
            bounce(x(0.5) - 50, H - 70, 100, 19);
            plat(x(0.5) - 80, y(460), 160);
            sym(0.12, y(330), 130, plat);
        } },
        { name: 'Skyscrapers', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            [[0.16, 190], [0.38, 250], [0.62, 230], [0.84, 170]].forEach(([f, k]) => plat(x(f) - 45, y(k), 90, H - 50 - y(k)));
            bounce(x(0.27) - 45, H - 70, 90); bounce(x(0.73) - 45, H - 70, 90); bounce(x(0.5) - 45, H - 70, 90, 18);
            plat(x(0.5) - 70, y(520), 140);
        } },
        { name: 'Cliffside', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, x(0.28), 300); ground(x(0.28), x(0.24), 180); ground(x(0.52), W - x(0.52));
            plat(x(0.62), y(200), 160); plat(x(0.8), y(320), 160); plat(x(0.58), y(440), 150);
            plat(x(0.06), y(430), 150);
            bounce(W - 120, H - 70, 90, 18);
        } },
        { name: 'Archway', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            sym(0.36, y(300), 40, (a, b, w) => plat(a, b, w, H - 50 - b));
            plat(x(0.36) - 20, y(300), x(0.28) + 40);
            plat(x(0.5) - 70, y(440), 140);
            sym(0.12, y(200), 150, plat);
            sym(0.18, y(360), 110, plat);
        } },
        { name: 'Hourglass', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            [[500, 160], [260, 290], [120, 400], [300, 520]].forEach(([w, k]) => plat(x(0.5) - w / 2, y(k), w));
            plat(x(0.08), y(330), 130); plat(W - x(0.08) - 130, y(330), 130);
            bounce(x(0.5) - 45, H - 70, 90);
        } },
        { name: 'Stepping Grid', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) plat(x(0.07 + j * 0.143) - 40, y(170 + i * 140) + ((j % 2) * 30), 80);
        } },
        { name: 'Lifts and Ledges', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            sym(0.2, y(250), 100, (a, b, w) => mover(a, b, w, { dy: 95, speed: 1.2 }));
            for (const k of [200, 330, 460]) plat(x(0.5) - 80, y(k), 160);
            sym(0.05, y(380), 120, plat);
        } },
        { name: 'Seesaw Pair', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            mover(x(0.3) - 80, y(260), 160, { dy: 80, speed: 1 });
            mover(x(0.7) - 80, y(260), 160, { dy: 80, speed: 1, phase: Math.PI });
            plat(x(0.5) - 60, y(180), 120);
            plat(x(0.5) - 90, y(450), 180);
            sym(0.06, y(300), 120, plat);
        } },
        { name: 'Cloud Atolls', build({ W, H, x, y, plat, bounce }) {
            plat(x(0.1) - 90, y(140), 180, 30); plat(x(0.9) - 90, y(140), 180, 30);
            plat(x(0.5) - 120, y(140), 240, 30);
            plat(x(0.3) - 80, y(270), 160, 26); plat(x(0.7) - 80, y(270), 160, 26);
            plat(x(0.5) - 70, y(400), 140, 26); plat(x(0.15) - 70, y(410), 140, 26); plat(x(0.85) - 70, y(410), 140, 26);
            bounce(x(0.3) - 45, H - 22, 90, 19); bounce(x(0.7) - 45, H - 22, 90, 19);
        } },
        { name: 'Waterfall Steps', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) { plat(x(0.04 + i * 0.1), y(450 - i * 100), 130); plat(W - x(0.04 + i * 0.1) - 130, y(450 - i * 100), 130); }
            plat(x(0.5) - 80, y(330), 160);
            bounce(x(0.5) - 45, H - 70, 90, 18);
        } },
        { name: 'Fortress Walls', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            sym(0.3, y(250), 50, (a, b, w) => plat(a, b, w, H - 50 - b));
            sym(0.3, y(250), 160, plat);
            plat(x(0.5) - 90, y(380), 180);
            sym(0.1, y(180), 120, plat);
            sym(0.16, H - 70, 80, bounce);
        } },
        { name: 'Spiral', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 6; i++) { const a = i * 1.9, r = 0.32 - i * 0.04; plat(x(0.5 + Math.cos(a) * r) - 65, y(150 + i * 80), 130); }
            plat(x(0.06), y(240), 130); plat(W - x(0.06) - 130, y(240), 130);
        } },
        { name: 'Bridges', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, x(0.16)); ground(x(0.84), W - x(0.84));
            plat(x(0.16), y(200), x(0.3)); plat(x(0.54), y(200), x(0.3));
            plat(x(0.22), y(380), x(0.56) - 0);
            mover(x(0.5) - 50, y(150), 100, { dy: 40, speed: 1 });
            plat(x(0.5) - 60, y(520), 120);
        } },
        { name: 'Catwalks', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            plat(x(0.04), y(170), x(0.4), 14); plat(x(0.56), y(170), x(0.4), 14);
            plat(x(0.22), y(300), x(0.56), 14);
            plat(x(0.04), y(430), x(0.36), 14); plat(x(0.6), y(430), x(0.36), 14);
            plat(x(0.42), y(540), x(0.16), 14);
        } },
        { name: 'Elevator Hub', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            mover(x(0.5) - 60, y(330), 120, { dy: 170, speed: 1.3 });
            for (const k of [200, 330, 460]) sym(0.36, y(k), 120, plat);
            sym(0.12, y(260), 130, plat);
        } },
        { name: 'Orbit Station', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(x(0.38), x(0.24));
            for (let i = 0; i < 5; i++) mover(x(0.5) - 50, y(380), 100, { r: 220, speed: 1.4, phase: i * Math.PI * 2 / 5 });
            sym(0.08, y(150), 150, plat);
            sym(0.08, y(400), 120, plat);
        } },
        { name: 'Bounce Castle', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) bounce(x(0.2 + i * 0.2) - 45, H - 70, 90, i % 2 ? 18 : 15);
            sym(0.04, y(260), 50, (a, b, w) => plat(a, b, w, H - 50 - b));
            plat(x(0.3) - 70, y(380), 140); plat(x(0.7) - 70, y(380), 140);
            plat(x(0.5) - 90, y(520), 180);
        } },
        { name: 'Pillar Field', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            [110, 200, 150, 240, 170, 220, 130].forEach((k, i) => plat(x(0.1 + i * 0.133) - 30, y(k), 60, H - 50 - y(k)));
            plat(x(0.5) - 80, y(470), 160);
        } },
        { name: 'Shifting Sands', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            for (let i = 0; i < 5; i++) mover(x(0.12 + i * 0.19) - 55, y(180), 110, { dx: 40, speed: 1.1, phase: i * 1.7 });
            for (let i = 0; i < 3; i++) plat(x(0.25 + i * 0.25) - 70, y(320), 140);
            plat(x(0.5) - 70, y(460), 140);
        } },
        { name: 'Rooftops', build({ W, H, x, y, plat, ground, bounce }) {
            const blocks = [[0, 0.2, 160], [0.27, 0.18, 260], [0.52, 0.2, 120], [0.79, 0.21, 220]];
            for (const [f, w, h] of blocks) ground(x(f), x(w), h);
            bounce(x(0.235) - 30, H - 22, 60, 19); bounce(x(0.5) - 30, H - 22, 60, 19); bounce(x(0.75) - 30, H - 22, 60, 19);
            plat(x(0.4) - 70, y(420), 140); plat(x(0.66) - 70, y(380), 140);
        } },
        { name: "Crow's Nest", build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            plat(x(0.5) - 15, y(470), 30, H - 50 - y(470));
            plat(x(0.5) - 70, y(470), 140);
            sym(0.38, y(220), 110, plat); sym(0.38, y(350), 90, plat);
            sym(0.1, y(250), 140, plat);
            sym(0.2, H - 70, 90, bounce);
        } },
        { name: 'Overpass', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            plat(x(0.05), y(260), x(0.38)); plat(x(0.57), y(260), x(0.38));
            mover(x(0.5) - 50, y(260), 100, { dy: 70, speed: 1 });
            sym(0.25, y(400), 140, plat);
            plat(x(0.5) - 60, y(520), 120);
        } },
        { name: 'Underpass', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            plat(x(0.3), y(190), x(0.4), 30);
            sym(0.12, y(300), 150, plat);
            plat(x(0.5) - 110, y(330), 220);
            plat(x(0.5) - 70, y(470), 140);
            sym(0.1, H - 70, 90, (a, b, w) => bounce(a, b, w, 17));
        } },
        { name: 'Zigzag Climb', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) plat(i % 2 ? W - x(0.32) - 140 : x(0.32), y(160 + i * 120), 140);
            mover(x(0.5) - 50, y(280), 100, { dx: 80, speed: 1 });
            plat(x(0.06), y(300), 120); plat(W - x(0.06) - 120, y(300), 120);
        } },
        { name: 'Double Helix', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            for (const f of [0.35, 0.65]) for (let i = 0; i < 2; i++) mover(x(f) - 45, y(300), 90, { r: 120, speed: 1.2, phase: i * Math.PI + (f > 0.5 ? Math.PI / 2 : 0), dir: f > 0.5 ? -1 : 1 });
            sym(0.08, y(210), 140, plat);
            plat(x(0.5) - 60, y(480), 120);
        } },
        { name: 'Wind Tunnel', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            bounce(30, H - 70, 100, 21); bounce(W - 130, H - 70, 100, 21);
            plat(x(0.12), y(470), x(0.3)); plat(x(0.58), y(470), x(0.3));
            plat(x(0.3) - 70, y(260), 140); plat(x(0.7) - 70, y(260), 140);
            plat(x(0.5) - 60, y(360), 120);
            plat(x(0.5) - 60, y(160), 120);
        } },
        { name: 'Stepping Stones', build({ W, H, x, y, plat, bounce }) {
            const n = 9;
            for (let i = 0; i < n; i++) plat(x((i + 0.5) / n) - 45, y(90 + (i % 3) * 25), 90, 24);
            plat(x(0.25) - 80, y(280), 160); plat(x(0.75) - 80, y(280), 160);
            plat(x(0.5) - 90, y(410), 180);
            bounce(x(0.5) - 40, H - 20, 80, 19);
        } },
        { name: 'Colosseum', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            sym(0.13, y(240), 40, (a, b, w) => plat(a, b, w, H - 50 - b));
            sym(0.04, y(160), 90, plat); sym(0.04, y(330), 90, plat);
            plat(x(0.5) - 100, y(220), 200);
            plat(x(0.5) - 70, y(380), 140);
            sym(0.3, H - 70, 80, bounce);
        } },
        { name: 'Twin Elevators', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, x(0.25)); ground(x(0.75), W - x(0.75)); ground(x(0.42), x(0.16));
            mover(x(0.335) - 50, y(250), 100, { dy: 120, speed: 1.2 });
            mover(x(0.665) - 50, y(250), 100, { dy: 120, speed: 1.2, phase: Math.PI });
            plat(x(0.5) - 140, y(470), 280);
            plat(x(0.08), y(300), 130); plat(W - x(0.08) - 130, y(300), 130);
        } },
        { name: 'Dragon Spine', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 9; i++) plat(x(0.06 + i * 0.11) - 40, y(160 + Math.sin(i / 8 * Math.PI) * 320), 80);
            plat(x(0.3) - 60, y(300), 120); plat(x(0.7) - 60, y(300), 120);
        } },
        { name: 'Moon Base', build({ W, H, x, y, plat, ground, mover, bounce, sym }) {
            ground(0, W);
            sym(0.22, y(190), 180, plat);
            plat(x(0.5) - 60, y(300), 120);
            mover(x(0.5) - 55, y(480), 110, { r: 80, speed: 1, phase: 0 });
            sym(0.08, y(360), 120, plat);
            sym(0.36, H - 70, 70, (a, b, w) => bounce(a, b, w, 18));
        } },
        { name: 'Treehouse', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            plat(x(0.5) - 25, y(560), 50, y(300) - y(560));   // the trunk hangs from the canopy: walk under it
            sym(0.42, y(180), 130, plat); sym(0.4, y(310), 110, plat); sym(0.42, y(440), 130, plat);
            plat(x(0.5) - 90, y(560), 180);
            sym(0.1, y(250), 140, plat);
        } },
        { name: 'Floodgates', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            for (const f of [0.25, 0.5, 0.75]) plat(x(f) - 20, y(110), 40, 60);
            sym(0.12, y(240), 140, plat); sym(0.37, y(260), 120, plat);
            plat(x(0.5) - 80, y(400), 160);
            sym(0.22, y(450), 110, plat);
        } },
        { name: 'Sky Ladder', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) plat(x(0.5) - 50, y(150 + i * 125), 100);
            sym(0.18, H - 70, 90, (a, b, w) => bounce(a, b, w, 19));
            sym(0.15, y(410), 160, plat);
            sym(0.3, y(250), 110, plat);
        } },
        { name: 'Battlements', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            for (let i = 0; i < 8; i++) plat(x(0.06 + i * 0.125) - 35, y(i % 2 ? 230 : 200), 70);
            plat(x(0.25) - 80, y(370), 160); plat(x(0.75) - 80, y(370), 160);
            plat(x(0.5) - 60, y(490), 120);
        } },
        { name: 'The Ring', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; plat(x(0.5) + Math.cos(a) * x(0.28) - 55, y(330) + Math.sin(a) * 150, 110); }
        } },
        { name: 'Conveyor', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) mover(x(0.14 + i * 0.24) - 60, y(220), 120, { dx: x(0.06), speed: 1.4, phase: i * Math.PI / 2 });
            sym(0.18, y(360), 140, plat);
            plat(x(0.5) - 80, y(480), 160);
        } },
        { name: 'Ziggurat', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) { plat(x(0.05 + i * 0.09), y(140 + i * 120), x(0.14)); plat(W - x(0.05 + i * 0.09) - x(0.14), y(140 + i * 120), x(0.14)); }
            plat(x(0.4), y(630), x(0.2));
        } },
        { name: 'Valley', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, x(0.25), 260); ground(x(0.75), W - x(0.75), 260); ground(x(0.25), x(0.5));
            plat(x(0.33) - 60, y(200), 120); plat(x(0.67) - 60, y(200), 120);
            plat(x(0.5) - 120, y(360), 240);
            bounce(x(0.5) - 45, H - 70, 90);
        } },
        { name: 'Mesa', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            ground(x(0.32), x(0.36), 200);
            sym(0.12, y(180), 150, plat);
            sym(0.18, y(330), 120, plat);
            plat(x(0.5) - 70, y(350), 140);
        } },
        { name: 'Canopy', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            for (let i = 0; i < 5; i++) plat(x(0.04 + i * 0.2), y(450), x(0.12));
            sym(0.25, y(200), 120, plat); sym(0.15, y(320), 110, plat);
            plat(x(0.5) - 60, y(300), 120);
        } },
        { name: 'Basement', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let i = 0; i < 6; i++) plat(x(0.08 + i * 0.17) - 55, y(i % 2 ? 150 : 250), 110);
            plat(x(0.2), y(380), x(0.6), 16);
        } },
        { name: 'Penthouse', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            plat(x(0.3), y(520), x(0.4));
            for (let i = 0; i < 3; i++) { plat(x(0.06 + i * 0.07), y(160 + i * 120), 120); plat(W - x(0.06 + i * 0.07) - 120, y(160 + i * 120), 120); }
            mover(x(0.5) - 50, y(260), 100, { dy: 90, speed: 1 });
        } },
        { name: 'Slingshot', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, x(0.18)); ground(x(0.82), W - x(0.82));
            bounce(x(0.18) - 100, H - 70, 90, 22); bounce(x(0.82) + 10, H - 70, 90, 22);
            plat(x(0.35), y(430), x(0.3));
            plat(x(0.32), y(200), x(0.36));
            plat(x(0.22), y(300), 120); plat(x(0.78) - 120, y(300), 120);
        } },
        { name: 'Pinwheel', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            for (let i = 0; i < 4; i++) mover(x(0.5) - 50, y(330), 100, { r: 150, speed: 1.6, phase: i * Math.PI / 2 });
            sym(0.12, y(200), 150, plat); sym(0.12, y(450), 150, plat);
        } },
        { name: 'Bumper Lanes', build({ W, H, x, y, plat, ground, mover, bounce }) {
            ground(0, W);
            for (let i = 0; i < 3; i++) mover(x(0.2 + i * 0.3) - 50, y(190), 100, { dx: x(0.1), speed: 1.6, phase: i * 2 });
            for (let i = 0; i < 3; i++) bounce(x(0.05 + i * 0.45) + (i === 2 ? -90 : 0), H - 70, 90, 16);
            plat(x(0.3) - 80, y(330), 160); plat(x(0.7) - 80, y(330), 160);
            plat(x(0.5) - 60, y(460), 120);
        } },
        { name: 'Tightrope', build({ W, H, x, y, plat, ground }) {
            ground(0, x(0.12)); ground(x(0.88), W - x(0.88));
            plat(x(0.12), y(160), x(0.76), 10);
            plat(x(0.06), y(290), x(0.38), 10); plat(x(0.56), y(290), x(0.38), 10);
            plat(x(0.2), y(420), x(0.6), 10);
            plat(x(0.5) - 70, y(530), 140);
        } },
        { name: 'Lantern Festival', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, x(0.15)); ground(x(0.85), W - x(0.85));
            for (let i = 0; i < 5; i++) mover(x(0.2 + i * 0.15) - 55, y(190), 110, { dy: 30, speed: 0.6, phase: i * 1.1 });
            for (let i = 0; i < 4; i++) mover(x(0.275 + i * 0.15) - 55, y(350), 110, { dy: 30, speed: 0.6, phase: i * 1.7 });
            plat(x(0.5) - 70, y(500), 140);
            plat(x(0.04), y(300), 110); plat(W - x(0.04) - 110, y(300), 110);
        } },
        { name: 'Crossroads', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            plat(x(0.1), y(300), x(0.33), 16); plat(x(0.57), y(300), x(0.33), 16);
            for (const k of [170, 430, 550]) plat(x(0.5) - 60, y(k), 120);
            plat(x(0.15) - 60, y(430), 120); plat(x(0.85) - 60, y(430), 120);
        } },
        { name: 'Shipwreck', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, x(0.2)); ground(x(0.8), W - x(0.8)); ground(x(0.2), x(0.6), 30);
            plat(x(0.28), y(200), x(0.44));
            
            plat(x(0.48), y(330), 40, y(200) - y(330));
            plat(x(0.42), y(330), x(0.16));
            plat(x(0.05), y(260), 120); plat(W - x(0.05) - 120, y(260), 120);
            bounce(x(0.1) - 40, H - 70, 80, 17);
        } },
        { name: 'Staggered Rows', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let r = 0; r < 4; r++) for (let j = 0; j < 4; j++) plat(x(0.08 + j * 0.25 + (r % 2) * 0.12) - 55, y(150 + r * 125), 110);
        } },
        { name: 'Hanging Gardens', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            sym(0.22, y(320), 160, plat);
            plat(x(0.5) - 90, y(460), 180);
            plat(x(0.5) - 60, y(200), 120);
            sym(0.08, y(200), 130, plat);
        } },
        { name: 'Lighthouse', build({ W, H, x, y, plat, ground, bounce, mover }) {
            ground(0, W);
            plat(x(0.85) - 40, y(480), 80, H - 50 - y(480));
            plat(x(0.85) - 80, y(480), 160);
            plat(x(0.85) - 140, y(220), 60); plat(x(0.85) - 140, y(350), 60);
            for (let i = 0; i < 3; i++) plat(x(0.1 + i * 0.2) - 70, y(180 + (i % 2) * 140), 140);
            mover(x(0.45) - 55, y(430), 110, { dx: 80, speed: 1 });
            bounce(x(0.62) - 40, H - 70, 80, 17);
        } },
        { name: 'Gondolas', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, x(0.24)); ground(x(0.76), W - x(0.76));
            const r = x(0.2), cy = Math.min(y(300), H - 60 - r);   // the wheel never dips below the screen
            for (let i = 0; i < 4; i++) mover(x(0.5) - 50, cy, 100, { r, speed: 1.4, phase: i * Math.PI / 2 });
            plat(x(0.5) - 60, cy, 120);
            plat(x(0.04), y(220), 110); plat(W - x(0.04) - 110, y(220), 110);
        } },
        { name: 'Piston Room', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            for (let i = 0; i < 5; i++) mover(x(0.14 + i * 0.18) - 45, y(200), 90, { dy: 50, speed: 2, phase: i * 1.2 });
            plat(x(0.2), y(400), x(0.6), 16);
            plat(x(0.5) - 60, y(530), 120);
        } },
        { name: 'Escalator', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            mover(x(0.3) - 60, y(270), 120, { dx: x(0.12), dy: -100, speed: 1.4 });
            mover(x(0.7) - 60, y(270), 120, { dx: -x(0.12), dy: -100, speed: 1.4 });
            plat(x(0.5) - 80, y(470), 160);
            plat(x(0.05), y(180), 130); plat(W - x(0.05) - 130, y(180), 130);
        } },
        { name: 'Diagonal Drift', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, W);
            for (let i = 0; i < 3; i++) mover(x(0.25 + i * 0.25) - 55, y(260 + i * 50), 110, { dx: 60, dy: 60, speed: 1.2, phase: i * 2 });
            sym(0.06, y(200), 130, plat); sym(0.12, y(420), 120, plat);
        } },
        { name: 'Floating Fortress', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, x(0.2)); ground(x(0.8), W - x(0.8));
            plat(x(0.28), y(220), x(0.44), 40);
            plat(x(0.28), y(330), 30, y(220) - y(330)); plat(x(0.72) - 30, y(330), 30, y(220) - y(330));
            plat(x(0.4), y(420), x(0.2));
            bounce(x(0.2) + 20, H - 22, 100, 19); bounce(x(0.8) - 120, H - 22, 100, 19);
            plat(x(0.04), y(300), 110); plat(W - x(0.04) - 110, y(300), 110);
        } },
        { name: 'Ravine', build({ W, H, x, y, plat, ground, mover, sym }) {
            ground(0, x(0.34)); ground(x(0.66), W - x(0.66));
            mover(x(0.5) - 60, y(150), 120, { dx: x(0.1), speed: 1.4 });
            mover(x(0.5) - 60, y(330), 120, { dx: x(0.1), speed: 1.4, phase: Math.PI });
            sym(0.18, y(230), 130, plat); sym(0.1, y(380), 110, plat);
            plat(x(0.5) - 60, y(500), 120);
        } },
        { name: 'Beehive', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            for (let r = 0; r < 4; r++) { const n = r % 2 ? 4 : 5; for (let j = 0; j < n; j++) plat(x((j + (r % 2 ? 1 : 0.5)) / 5) - 50, y(150 + r * 120), 100); }
        } },
        { name: 'Crater', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, x(0.25), 180); ground(x(0.75), W - x(0.75), 180); ground(x(0.25), x(0.5));
            bounce(x(0.5) - 55, H - 70, 110, 21);
            plat(x(0.5) - 100, y(480), 200);
            sym(0.36, y(260), 100, plat);
            sym(0.08, y(330), 120, plat);
        } },
        { name: 'Observation Deck', build({ W, H, x, y, plat, ground, mover }) {
            ground(0, W);
            plat(x(0.25), y(460), x(0.5));
            for (let i = 0; i < 3; i++) { plat(x(0.06 + i * 0.05), y(160 + i * 110), 110); plat(W - x(0.06 + i * 0.05) - 110, y(160 + i * 110), 110); }
            mover(x(0.5) - 50, y(260), 100, { dy: 110, speed: 1.1 });
        } },
        { name: 'Puzzle Box', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            plat(x(0.2), y(250), x(0.2), 20); plat(x(0.6), y(250), x(0.2), 20);
            plat(x(0.2), y(250), 20, 100); plat(x(0.8) - 20, y(250), 20, 100);   // posts hang under the roofs
            plat(x(0.4), y(380), x(0.2), 20);
            plat(x(0.06), y(400), 120); plat(W - x(0.06) - 120, y(400), 120);
            bounce(x(0.5) - 45, H - 70, 90, 17);
        } },
        { name: 'Starfall', build({ W, H, x, y, plat, ground }) {
            ground(0, W);
            [[0.12, 180], [0.3, 250], [0.5, 170], [0.7, 250], [0.88, 180], [0.2, 380], [0.42, 400], [0.58, 400], [0.8, 380], [0.5, 530]].forEach(([f, k]) => plat(x(f) - 50, y(k), 100));
        } },
        { name: 'Twin Bridges', build({ W, H, x, y, plat, ground, bounce }) {
            ground(0, W);
            plat(x(0.05), y(220), x(0.55));
            plat(x(0.4), y(380), x(0.55));
            plat(x(0.1), y(500), 140); plat(x(0.75), y(150), 140);
            bounce(W - 120, H - 70, 90, 18);
        } },
        { name: 'Final Stand', build({ W, H, x, y, plat, ground, bounce, mover }) {
            ground(x(0.36), x(0.28));
            ground(0, x(0.14)); ground(x(0.86), W - x(0.86));
            bounce(x(0.25) - 45, H - 22, 90, 20); bounce(x(0.75) - 45, H - 22, 90, 20);
            plat(x(0.5) - 80, y(270), 160);
            mover(x(0.5) - 50, y(420), 100, { dx: x(0.2), speed: 1.2 });
            plat(x(0.05), y(300), 110); plat(W - x(0.05) - 110, y(300), 110);
        } },
        { name: 'Steam Vents', build({ W, H, x, y, plat, ground, bounce, sym }) {
            ground(0, W);
            for (let i = 0; i < 5; i++) bounce(x(0.1 + i * 0.2) - 30, H - 70, 60, i % 2 ? 19 : 17);
            sym(0.2, y(330), 140, plat);
            plat(x(0.5) + 90, y(340), 120);
            plat(x(0.5) - 80, y(470), 160);
            sym(0.04, y(200), 100, plat);
        } },
        { name: 'Watchtowers', build({ W, H, x, y, plat, ground, sym }) {
            ground(0, W);
            sym(0.2, y(380), 30, (a, b, w) => plat(a, b, w, H - 50 - b));
            sym(0.2, y(380), 120, plat);
            sym(0.12, y(240), 80, plat); sym(0.28, y(160), 80, plat);
            plat(x(0.5) - 120, y(250), 240);
            plat(x(0.5) - 60, y(470), 120);
        } },
        { name: 'Sky Docks', build({ W, H, x, y, plat, mover, bounce }) {
            plat(0, y(120), x(0.2), 30); plat(x(0.8), y(120), x(0.2), 30);
            plat(x(0.35), y(120), x(0.3), 30);
            mover(x(0.27) - 50, y(250), 100, { dy: 80, speed: 1 }); mover(x(0.73) - 50, y(250), 100, { dy: 80, speed: 1, phase: Math.PI });
            plat(x(0.5) - 90, y(380), 180, 26);
            plat(x(0.08), y(380), 120, 26); plat(W - x(0.08) - 120, y(380), 120, 26);
            bounce(x(0.27) - 40, H - 20, 80, 19); bounce(x(0.73) - 40, H - 20, 80, 19);
        } },
        { name: 'Terraces', build({ W, H, x, y, plat, ground }) {
            ground(0, x(0.2), 120); ground(x(0.2), x(0.2), 70); ground(x(0.4), x(0.2)); ground(x(0.6), x(0.2), 70); ground(x(0.8), x(0.2), 120);
            plat(x(0.3) - 70, y(260), 140); plat(x(0.7) - 70, y(260), 140);
            plat(x(0.5) - 80, y(390), 160);
            plat(x(0.1) - 50, y(380), 100); plat(x(0.9) - 50, y(380), 100);
        } }
    ];
    LEVEL_LAYOUTS.push(...more);
})();
