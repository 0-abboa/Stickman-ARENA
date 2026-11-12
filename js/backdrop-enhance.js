// Extra atmosphere shared by the arena scenes, plus a continuous themed depth
// field below seasonal arenas on tall screens.
(() => {
    const colorHex = (value, fallback) => {
        if (typeof value !== 'string') return fallback;
        if (/^#[0-9a-f]{6}$/i.test(value)) return value;
        const rgb = value.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
        if (rgb) return '#' + rgb.slice(1).map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('');
        return fallback;
    };
    const colorRgb = (value, fallback = '180,190,220') => {
        if (typeof value !== 'string') return fallback;
        if (/^#[0-9a-f]{6}$/i.test(value)) {
            const n = parseInt(value.slice(1), 16);
            return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`;
        }
        const rgb = value.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
        return rgb ? rgb.slice(1).map(n => Math.max(0, Math.min(255, Number(n))).toString()).join(',') : fallback;
    };
    const rgba = (hex, alpha) => `rgba(${colorRgb(hex)},${alpha})`;

    // The painted ridges occlude these broad, slow lights, giving the horizon
    // more separation while retaining each scene's palette and contrast.
    const animBase = BackdropLayers.anim;
    BackdropLayers.anim = function (ctx, bd, layer) {
        animBase.call(this, ctx, bd, layer);
        if (layer.tag !== 'sky') return;
        const W = bd.W, H = bd.H, t = bd.time || 0, V = bd.V;
        const light = (V.ambient && V.ambient.rayRgb) || (V.body && V.body.rgb) || V.haze || '180,190,220';
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 2; i++) {
            const phase = i * Math.PI * 1.2;
            const x = W * (0.27 + i * 0.46) + Math.sin(t * 0.0014 + phase) * W * 0.085;
            const y = H * (0.53 + i * 0.055) + Math.cos(t * 0.0011 + phase) * H * 0.018;
            const radius = H * (0.38 + i * 0.06);
            const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
            glow.addColorStop(0, `rgba(${colorRgb(light)},0.055)`);
            glow.addColorStop(0.42, `rgba(${colorRgb(light)},0.024)`);
            glow.addColorStop(1, `rgba(${colorRgb(light)},0)`);
            ctx.fillStyle = glow;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
    };

    const holidayIds = new Set([
        ...Object.keys(Level.SEASONS || {}),
        ...Object.keys(Level.SEASON_RULES || {}),
        'xmas'
    ]);
    // haunted already has a dedicated, themed void surface in void.js.
    holidayIds.delete('haunted');
    const drawSeasonalDepth = (ctx, level) => {
        const H = level.height, bd = level.backdrop, V = bd.V;
        const ground = V.ground || {};
        const sky = V.sky || [];
        const fallback = colorHex(sky[0] && sky[0][1], '#101827');
        const groundTop = colorHex(ground.top, colorHex(sky[sky.length - 1] && sky[sky.length - 1][1], '#342b3d'));
        const groundBottom = colorHex(ground.bot, fallback);
        const groundColors = Array.isArray(ground.c) ? ground.c : [ground.c];
        const accent = colorHex(groundColors.find(c => typeof c === 'string' && c[0] === '#'), colorHex(V.body && V.body.rgb, '#e2c274'));
        const deep = BG.mix(groundBottom, '#030712', 0.44);
        const lowest = BG.mix(deep, '#01030a', 0.56);
        let x0 = -level.width * 0.25, x1 = level.width * 1.25, bottom = H + 320;
        try {
            const inv = ctx.getTransform().inverse(), cw = ctx.canvas.width, ch = ctx.canvas.height;
            const corners = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => inv.transformPoint({ x, y }));
            x0 = Math.min(...corners.map(p => p.x)) - 120;
            x1 = Math.max(...corners.map(p => p.x)) + 120;
            bottom = Math.max(H + 260, Math.max(...corners.map(p => p.y)) + 80);
        } catch (e) { /* retain a safe world-space fallback */ }

        const depth = bottom - H, t = bd.time || 0;
        const wash = ctx.createLinearGradient(0, H - 26, 0, bottom);
        wash.addColorStop(0, rgba(groundTop, 0));
        wash.addColorStop(0.028, rgba(accent, 0.18));
        wash.addColorStop(0.065, rgba(groundBottom, 0.92));
        wash.addColorStop(0.2, rgba(BG.mix(groundBottom, fallback, 0.36), 0.97));
        wash.addColorStop(0.58, rgba(deep, 0.99));
        wash.addColorStop(1, rgba(lowest, 1));
        ctx.fillStyle = wash;
        ctx.fillRect(x0, H - 26, x1 - x0, bottom - H + 26);

        const bands = [
            { at: 0.17, amp: 0.034, color: BG.mix(groundTop, groundBottom, 0.62), alpha: 0.34, speed: 0.0022 },
            { at: 0.43, amp: 0.026, color: BG.mix(groundBottom, fallback, 0.38), alpha: 0.48, speed: -0.0015 },
            { at: 0.73, amp: 0.018, color: BG.mix(deep, '#02040a', 0.5), alpha: 0.74, speed: 0.0009 }
        ];
        for (let k = 0; k < bands.length; k++) {
            const band = bands[k], baseY = H + depth * band.at, amp = Math.max(7, depth * band.amp);
            ctx.beginPath();
            ctx.moveTo(x0, bottom);
            for (let x = x0; x <= x1 + 32; x += 32) {
                const y = baseY + Math.sin(x * 0.0027 + t * band.speed + k * 1.8) * amp
                    + Math.sin(x * 0.0061 - t * band.speed * 0.65 + k) * amp * 0.32;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(x1, bottom);
            ctx.closePath();
            ctx.fillStyle = rgba(band.color, band.alpha);
            ctx.fill();
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const pulse = 0.05 + (Math.sin(t * 0.018) + 1) * 0.016;
        const rim = ctx.createLinearGradient(0, H - 38, 0, H + 82);
        rim.addColorStop(0, rgba(accent, 0));
        rim.addColorStop(0.58, rgba(accent, pulse));
        rim.addColorStop(1, rgba(accent, 0));
        ctx.fillStyle = rim;
        ctx.fillRect(x0, H - 38, x1 - x0, 120);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
            const phase = i * 2.399 + (bd.seed || 1) * 0.00001;
            const x = x0 + ((i * 0.61803398875 + 0.17) % 1) * (x1 - x0) + Math.sin(t * 0.003 + phase) * 13;
            const y = H + depth * (0.12 + ((i * 0.38196601125 + t * 0.000035) % 0.72));
            const a = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.025 + phase));
            const r = i % 3 === 0 ? 2.2 : 1.3;
            ctx.fillStyle = rgba(accent, a);
            ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = rgba(colorHex(V.body && V.body.rgb, '#fff0c0'), a * 0.8);
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    };

    // Seasonal material IDs have their own backdrop palettes but are not
    // recognized by the legacy below-arena renderer. Fill that exposed region
    // before platforms are painted so it cannot become a flat sky-colour block.
    const drawPlatformsBase = Level.prototype.drawPlatforms;
    Level.prototype.drawPlatforms = function (ctx) {
        if (holidayIds.has(this.material) && this.backdrop) drawSeasonalDepth(ctx, this);
        drawPlatformsBase.call(this, ctx);
    };
})();
