// The arena is always this size, whatever the window: layouts, bots and physics never see the screen.
// The game scales the view to fit (see Game.resize / render).
const ARENA_W = 1600, ARENA_H = 900;

class Level {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.platforms = [];
        this.levelNum = 1;
        this.material = 'dirt'; // dirt, stone, magic, cloud, ice
        this.isMagicLevel = false;
        this.time = 0;        // visual clock, advanced by animate(dt)
        this.backdrop = null; // generated parallax scenery (backdrop.js)
    }

    generate(levelNum) {
        this.levelNum = levelNum;
        this.platforms = [];
        this.variantSeed = Math.random();   // which backdrop (of 3 per material) this round uses
        // Magic bird level every 5 levels
        this.isMagicLevel = (levelNum % 5 === 0);
        const materials = Level.available ? Level.available() : (Level.MATERIALS || ['dirt', 'stone', 'cloud', 'ice']);   // seasonal themes only in season (seasons.js)
        this.material = materials[Math.floor(Math.random() * materials.length)];
        if (this.isMagicLevel && !Level.forcedTheme) this.material = 'magic';

        // Pick a layout (never the same one twice in a row)
        const list = LEVEL_LAYOUTS;
        let k = Math.floor(Math.random() * list.length);
        if (list.length > 1 && list[k].name === this.layoutName) k = (k + 1) % list.length;
        this.buildLayout(list[k]);
        this.generateBackgroundProps();
    }

    buildLayout(layout) {
        this.platforms = [];
        this.variantSeed = Math.random();
        this.layout = layout;
        this.layoutName = layout.name;
        const W = this.width, H = this.height;
        this.builtW = W; this.builtH = H;
        const self = this;
        const api = {
            W, H,
            x: (f) => f * W,
            // k px above the bottom; short screens squeeze tiers (never under 100px apart)
            y: (k) => Math.max(110, H - k * Math.min(1, (H - 130) / 590)),
            plat: (x, y, w, h) => self.createPlatform(x, y, w, h > 0 ? h : 22),
            // Bottom slab; anything taller than the 50px floor squeezes like y() does
            ground: (x, w, h) => { const top = (h || 50) <= 50 ? H - (h || 50) : api.y(h); return self.createPlatform(x, top, w, H - top); },
            bounce: (x, y, w, power) => self.createPlatform(x, y, w || 90, 20, 'trampoline', { power: power || 15 }),
            // opts: { dx, dy } swing distance, { r } orbit radius, speed (px/frame at the fastest), phase
            mover: (x, y, w, opts) => self.createPlatform(x, y, w, 20, 'moving', opts || { dx: 100 }),
            movingBounce: (x, y, w, opts, power) => self.createPlatform(x, y, w || 90, 20, 'trampoline', Object.assign({ power: power || 15 }, opts)),
            // Same platform on both sides: f is the centre as a fraction of the width
            sym: (f, y, w, fn) => { fn(f * W - w / 2, y, w); fn((1 - f) * W - w / 2, y, w); }
        };
        layout.build(api);
        // Keep everything on screen
        for (const p of this.platforms) {
            if (p.motion) continue;
            p.x = Math.max(-40, Math.min(W - p.width + 40, p.x));
        }
    }

    generateBackgroundProps() {
        this.backdrop = null;   // painted lazily once the canvas size is final
    }

    createPlatform(x, y, w, h, type='static', opts) {
        opts = opts || {};
        const p = {
            x: x,
            y: y,
            width: w,
            height: h,
            type: type,
            vx: 0, vy: 0,
            power: opts.power || 15,       // bouncers: launch speed (15 = normal, 19+ = launch pad)
            motion: null,
            phase: 0,
            active: true, // For breaking
            seed: Math.random() * 1000,   // per-platform variation in the art
            shake: 0,                      // set by a bounce; consumed by animate()
            spring: 0, springV: 0, glow: 0 // bouncer mat spring + glow
        };
        // Movers glide along a line (dx/dy, eased at the ends) or round a circle (r)
        if (type === 'moving' || opts.dx || opts.dy || opts.r) {
            const speed = opts.speed || 2;
            if (opts.r) {
                p.motion = { kind: 'orbit', cx: x + w / 2, cy: y, r: opts.r, omega: (opts.dir || 1) * speed / opts.r };
            } else {
                const dx = opts.dx || 0, dy = opts.dy || 0;
                const amp = Math.max(1, Math.abs(dx), Math.abs(dy));
                p.motion = { kind: 'line', ox: x, oy: y, dx: dx || (type === 'moving' && !dy ? 100 : 0), dy, omega: speed / amp };
            }
            p.phase = opts.phase || 0;
            const pos = Level.motionAt(p.motion, p.phase, w);
            p.x = pos.x; p.y = pos.y;
        }
        this.platforms.push(p);
        return p;
    }

    // Position of a mover at a given phase (shared with the bot's physics sandbox)
    static motionAt(m, phase, w) {
        if (m.kind === 'orbit') return { x: m.cx + Math.cos(phase) * m.r - w / 2, y: m.cy + Math.sin(phase) * m.r };
        const s = Math.sin(phase);
        return { x: m.ox + m.dx * s, y: m.oy + m.dy * s };
    }

    static stepMotion(p) {
        p.phase += p.motion.omega;
        const pos = Level.motionAt(p.motion, p.phase, p.width);
        p.vx = pos.x - p.x;
        p.vy = pos.y - p.y;
        p.x = pos.x;
        p.y = pos.y;
    }

    breakPlatform(x, y) {
        const p = this.platforms.find(p =>
            p.active &&
            x > p.x && x < p.x + p.width &&
            y > p.y && y < p.y + p.height
        );
        if (p) {
            p.active = false;
            return p; // Return platform for effects
        }
        return null;
    }

    // Gameplay: moving platforms (once per game update)
    update() {
        for (const p of this.platforms) {
            if (p.motion && p.active) Level.stepMotion(p);
        }
    }

    // Visual: ambience, bouncer springs and glows (every frame, scaled by dt)
    animate(dt) {
        if (dt <= 0) return;
        this.time += dt;
        if (this.backdrop) Backdrop.step(this.backdrop, dt);
        for (const p of this.platforms) {
            if (p.type !== 'trampoline') continue;
            if (p.shake > 0) { p.springV += 7 * p.shake; p.glow = 1; p.shake = 0; }
            p.springV += (-0.35 * p.spring - 0.18 * p.springV) * dt;
            p.spring += p.springV * dt;
            p.glow = Math.max(0, p.glow - 0.03 * dt);
        }
    }

    drawForeground(ctx, cam, shake) {
        if (this.backdrop) Backdrop.drawFront(ctx, this.backdrop, cam, shake);
    }

    drawBackdrop(ctx, cam, shake) {
        const bd = this.backdrop;
        // the window may show more than the arena (other aspect ratio): continue the sky past its edges
        if (bd && bd.V && bd.V.sky) {
            const g = ctx.createLinearGradient(0, 0, 0, this.height);
            for (const [s, c] of bd.V.sky) g.addColorStop(s, c);
            ctx.fillStyle = g; ctx.fillRect(-6000, -6000, this.width + 12000, this.height + 12000);
        }
        if (!bd || bd.W !== Math.round(this.width) || bd.H !== Math.round(this.height) || bd.material !== this.material || bd.variantSeed !== this.variantSeed) {
            this.backdrop = Backdrop.build(this);
        }
        Backdrop.draw(ctx, this.backdrop, cam, shake);
    }

    drawPlatforms(ctx) {
        if (!Graphics.textures.dirt) Graphics.init();
        const pattern = this.getMaterialPattern();
        for (const p of this.platforms) if (p.active && p.type !== 'trampoline') this.drawShadow(ctx, p);
        for (const p of this.platforms) {
            if (!p.active) continue;
            if (p.type === 'trampoline') this.drawBouncer(ctx, p);
            else this.drawPlatform(ctx, p, pattern);
        }
    }

    drawShadow(ctx, p) {
        const g = ctx.createLinearGradient(0, p.y + p.height, 0, p.y + p.height + 26);
        g.addColorStop(0, 'rgba(0,0,0,0.28)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x + 4, p.y + p.height, p.width - 8, 26);
    }

    drawPlatform(ctx, p, pattern) {
        const w = p.width, h = p.height, t = this.time;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = pattern || '#654321';
        ctx.fillRect(0, 0, w, h);
        const shade = ctx.createLinearGradient(0, 0, 0, h);
        shade.addColorStop(0, 'rgba(255,255,255,0.12)');
        shade.addColorStop(0.55, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, 0, w, 2);

        if (this.material === 'dirt') {
            // Grass lip and blades swaying in the breeze
            ctx.fillStyle = '#43a047';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(w, 0);
            for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, 3 + (Math.sin(x * 0.7 + p.seed) + 1) * 2.5);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#7cc56f';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let x = 3; x < w - 2; x += 6) {
                const sway = Math.sin(t * 0.05 + x * 0.25 + p.seed) * 2;
                const hgt = 4 + ((x * 7 + p.seed) % 5);
                ctx.moveTo(x, 1); ctx.lineTo(x + sway, -hgt);
            }
            ctx.stroke();
        } else if (this.material === 'ice') {
            const sheen = ctx.createLinearGradient(0, 0, w, 0);
            sheen.addColorStop(0, 'rgba(255,255,255,0)');
            sheen.addColorStop(0.3, 'rgba(255,255,255,0.35)');
            sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen;
            ctx.fillRect(0, 4, w, Math.min(10, h / 2));
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillRect(0, 0, w, 2.5);
            // A glint that slides along the frosted rim
            const gx = (t * 1.6 + p.seed * 7) % (w + 120) - 60;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const gg = ctx.createRadialGradient(gx, 1, 0, gx, 1, 12);
            gg.addColorStop(0, 'rgba(255,255,255,0.9)');
            gg.addColorStop(1, 'rgba(180,230,255,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(gx - 12, -11, 24, 24);
            ctx.restore();
        } else if (this.material === 'stone') {
            ctx.fillStyle = 'rgba(90,140,70,0.55)';
            for (let x = (p.seed % 23); x < w - 10; x += 37 + (p.seed % 11)) {
                ctx.beginPath(); ctx.ellipse(x + 6, 1.5, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 20 + (p.seed % 30); x < w - 10; x += 70) {
                ctx.moveTo(x, h * 0.3); ctx.lineTo(x + 6, h * 0.55); ctx.lineTo(x + 2, h * 0.8);
            }
            ctx.stroke();
        } else if (this.material === 'cloud') {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            for (let x = 6; x < w; x += 16) {
                ctx.beginPath(); ctx.arc(x, 1, 7 + Math.sin(x + p.seed) * 2, Math.PI, 0); ctx.fill();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h + 2 + Math.abs(Math.sin((x + p.seed) * 0.4)) * 3);
            ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
        } else if (this.material === 'magic') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const pulse = 0.35 + 0.3 * Math.sin(t * 0.06 + p.seed);
            ctx.strokeStyle = `rgba(224,170,255,${pulse})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
            ctx.strokeStyle = `rgba(240,200,255,${pulse + 0.2})`;
            ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
            ctx.restore();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        if (p.motion) {
            // Thrusters under each end and a direction chevron
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const ex of [10, w - 10]) {
                const fl = 10 + 5 * Math.sin(t * 0.5 + ex);
                const g = ctx.createLinearGradient(0, h, 0, h + fl);
                g.addColorStop(0, 'rgba(120,220,255,0.9)');
                g.addColorStop(1, 'rgba(120,220,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(ex - 5, h); ctx.lineTo(ex, h + fl); ctx.lineTo(ex + 5, h); ctx.closePath(); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(160,230,255,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (Math.abs(p.vy) > Math.abs(p.vx)) {
                const dir = p.vy >= 0 ? 1 : -1;
                ctx.moveTo(w / 2 - 4, h / 2 - dir * 4); ctx.lineTo(w / 2, h / 2 + dir * 3); ctx.lineTo(w / 2 + 4, h / 2 - dir * 4);
            } else {
                const dir = p.vx >= 0 ? 1 : -1;
                ctx.moveTo(w / 2 - dir * 4, h / 2 - 4); ctx.lineTo(w / 2 + dir * 3, h / 2); ctx.lineTo(w / 2 - dir * 4, h / 2 + 4);
            }
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    // Bouncer: coil springs, a sagging neon mat, glow and rising chevrons
    drawBouncer(ctx, p) {
        const w = p.width, h = p.height, t = this.time;
        const sag = Math.max(-4, Math.min(9, p.spring));
        const glow = 0.4 + 0.15 * Math.sin(t * 0.08 + p.seed) + p.glow * 0.6;
        const pad = p.power > 16;   // launch pad
        const C = pad ? { glow: '255,171,64', chev: '255,224,170', m0: '#ffe0b2', m1: '#ffab40', m2: '#e65100', rim: '255,235,205' }
                      : { glow: '105,240,174', chev: '150,255,200', m0: '#b9f6ca', m1: '#69f0ae', m2: '#00a152', rim: '200,255,225' };
        ctx.save();
        ctx.translate(p.x, p.y);
        // Glow pooled above the mat
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createLinearGradient(0, -46, 0, 6);
        gl.addColorStop(0, `rgba(${C.glow},0)`);
        gl.addColorStop(1, `rgba(${C.glow},${0.35 * glow})`);
        ctx.fillStyle = gl;
        ctx.fillRect(2, -46, w - 4, 52);
        // Chevrons rising off the pad
        ctx.strokeStyle = `rgba(${C.chev},1)`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const ph = ((t * 0.02 + i / 3) % 1);
            ctx.globalAlpha = (1 - ph) * 0.8 * glow;
            const y = -8 - ph * 34;
            ctx.beginPath(); ctx.moveTo(w / 2 - 9, y + 6); ctx.lineTo(w / 2, y); ctx.lineTo(w / 2 + 9, y + 6); ctx.stroke();
        }
        ctx.restore();
        // Frame and legs
        ctx.fillStyle = '#263238';
        ctx.fillRect(3, 8, 5, h + 4);
        ctx.fillRect(w - 8, 8, 5, h + 4);
        ctx.fillStyle = '#37474f';
        ctx.fillRect(0, h - 4, w, 6);
        ctx.fillStyle = '#ffca28';
        for (let x = 4; x < w - 6; x += 12) { ctx.beginPath(); ctx.moveTo(x, h - 4); ctx.lineTo(x + 6, h - 4); ctx.lineTo(x + 2, h + 2); ctx.lineTo(x - 4, h + 2); ctx.fill(); }
        // Coil springs between frame and mat
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 2;
        const top = 4 + sag, bottom = h - 4;
        for (let sx = 14; sx < w - 12; sx += Math.max(18, (w - 28) / 3)) {
            ctx.beginPath();
            const n = 5;
            for (let k = 0; k <= n; k++) {
                const y = top + (bottom - top) * k / n;
                ctx.lineTo(sx + (k % 2 ? 4 : -4), y);
            }
            ctx.stroke();
        }
        // Mat sagging in the middle, neon gradient with a bright rim
        const mat = ctx.createLinearGradient(0, sag, 0, sag + 10);
        mat.addColorStop(0, C.m0);
        mat.addColorStop(0.4, C.m1);
        mat.addColorStop(1, C.m2);
        ctx.fillStyle = mat;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.quadraticCurveTo(w / 2, sag * 2, w - 4, 0);
        ctx.lineTo(w - 4, 8);
        ctx.quadraticCurveTo(w / 2, 8 + sag * 2, 4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${C.rim},${0.5 + 0.5 * glow})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(6, 0.5); ctx.quadraticCurveTo(w / 2, sag * 2 + 0.5, w - 6, 0.5); ctx.stroke();
        ctx.restore();
        ctx.restore();
    }

    getMaterialPattern() {
        switch(this.material) {
            case 'dirt': return Graphics.textures.dirt;
            case 'stone': return Graphics.textures.stone;
            case 'magic': return Graphics.textures.magic;
            case 'cloud': return Graphics.textures.cloud;
            case 'ice': return Graphics.textures.ice;
            default: return Graphics.textures.dirt;
        }
    }
}
