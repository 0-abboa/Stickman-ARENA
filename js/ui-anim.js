// UI animation on the canvas HUD: player cards slide in at the start of a round (staggered),
// shake and flash red when hit, pulse when low, flash gold on a kill; banners get a light sweep
// and a burst of sparks; rounds open with sliding shutters and a scene title card.
(() => {
    const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    const back = (t) => { t = Math.max(0, Math.min(1, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    const THEME_LABEL = { dirt: 'Grasslands', stone: 'Old Stone', ice: 'Frozen', cloud: 'Skies', magic: 'Arcane', neon: 'Neon City', lava: 'Inferno', ocean: 'Deep Ocean', candy: 'Candy Land', haunted: 'Haunted', xmas: 'Christmas', newyear: 'New Year', chinesenewyear: 'Chinese New Year', valentines: "Valentine's Day", stpatricks: "St. Patrick's Day", easter: 'Easter', earthday: 'Earth Day', pride: 'Pride', juneteenth: 'Juneteenth', independence: 'Independence Day', laborday: 'Labor Day', diademuertos: 'Día de Muertos', thanksgiving: 'Thanksgiving' };

    const cardBase = Game.prototype.drawCard;
    Game.prototype.drawCard = function (ctx, p, x, y, w, h, compact) {
        const idx = this.players.indexOf(p), rt = (performance.now() - (this.roundOpenAt || -1e9)) / 16.7;
        // track hits and kills for this card
        const u = p.hud || (p.hud = { hp: p.health, shake: 0, flash: 0, kills: p.kills || 0, gold: 0 });
        if (p.health < u.hp - 0.5) { u.shake = Math.min(14, u.shake + 4 + (u.hp - p.health) * 0.3); u.flash = 1; }
        if ((p.kills || 0) > u.kills) u.gold = 1;
        u.hp = p.health; u.kills = p.kills || 0;
        u.shake *= 0.86; u.flash *= 0.9; u.gold *= 0.96;
        const slide = 1 - back((rt - idx * 4) / 26);
        const dx = (Math.random() - 0.5) * u.shake, dy = -slide * (y + h + 20) + (Math.random() - 0.5) * u.shake * 0.5;
        ctx.save();
        ctx.translate(dx, dy);
        cardBase.call(this, ctx, p, x, y, w, h, compact);
        // overlays: hit flash, low-health pulse, kill glow
        const low = !p.isDead && p.health < p.maxHealth * 0.25;
        const glow = (rgb, a, lw) => { ctx.save(); this.roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 11); ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = lw; ctx.shadowColor = `rgba(${rgb},${a})`; ctx.stroke(); ctx.restore(); };
        if (u.flash > 0.05) { ctx.save(); this.roundRect(ctx, x, y, w, h, 10); ctx.fillStyle = `rgba(255,60,60,${u.flash * 0.35})`; ctx.fill(); ctx.restore(); }
        if (low) glow('255,70,70', 0.45 + 0.4 * Math.sin(this.fx.clock * 0.2), 2.5);
        if (u.gold > 0.05) glow('255,215,64', u.gold, 3);
        ctx.restore();
    };

    const bannerBase = Game.prototype.drawBanners;
    Game.prototype.drawBanners = function (ctx, W, H) {
        const now = performance.now();
        // a light sweep and sparks behind each fresh banner
        for (const b of this.banners) {
            const t = (now - b.start) / b.dur;
            if (t < 0 || t > 1) continue;
            const rgb = /^#/.test(b.color) ? [parseInt(b.color.slice(1, 3), 16), parseInt(b.color.slice(3, 5), 16), parseInt(b.color.slice(5, 7), 16)].join(',') : '255,255,255';
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const k = ease(t / 0.35), y = H * 0.38 - 30;
            const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
            g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},${0.22 * (1 - t)})`); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(W / 2 - W * 0.5 * k, y - 60, W * k, 120);
            if (!b.sparks) { b.sparks = []; for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 6; b.sparks.push({ a, v, s: 1 + Math.random() * 2.5 }); } }
            const st = Math.min(1, t / 0.5);
            for (const s of b.sparks) {
                const r = s.v * 60 * ease(st), x = W / 2 + Math.cos(s.a) * r * 1.8, yy = H * 0.38 - 30 + Math.sin(s.a) * r * 0.6;
                ctx.fillStyle = `rgba(${rgb},${(1 - st) * 0.9})`;
                ctx.beginPath(); ctx.arc(x, yy, s.s, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        bannerBase.call(this, ctx, W, H);
    };

    // Round opening: shutters slide apart, then the scene's title card slides in (real time, so the
    // match countdown, which freezes game time, still opens with them)
    const startBase = Game.prototype.startLevel;
    Game.prototype.startLevel = function (regenerate) { this.roundOpenAt = performance.now(); return startBase.call(this, regenerate); };
    const renderBase = Game.prototype.render;
    Game.prototype.render = function () {
        renderBase.call(this);
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, rt = (performance.now() - (this.roundOpenAt || -1e9)) / 16.7;
        if (this.demo || this.state !== 'PLAYING' || W < 2) return;
        if (rt < 34) {
            const k = ease(rt / 34), off = W * 0.55 * k;
            ctx.save();
            ctx.fillStyle = '#070910';
            ctx.beginPath(); ctx.moveTo(-off, 0); ctx.lineTo(W * 0.6 - off, 0); ctx.lineTo(W * 0.4 - off, H); ctx.lineTo(-off, H); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(W * 0.6 + off, 0); ctx.lineTo(W + off, 0); ctx.lineTo(W + off, H); ctx.lineTo(W * 0.4 + off, H); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = `rgba(255,202,40,${1 - k})`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(W * 0.6 - off, 0); ctx.lineTo(W * 0.4 - off, H); ctx.moveTo(W * 0.6 + off, 0); ctx.lineTo(W * 0.4 + off, H); ctx.stroke();
            ctx.restore();
        }
        if (rt > 10 && rt < 260) {
            const inK = ease((rt - 10) / 30), outK = ease((rt - 210) / 50), a = inK * (1 - outK);
            const name = (this.sceneName ? this.sceneName() : '').toUpperCase(), sub = THEME_LABEL[this.level.material] || '';
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(28 - (1 - inK) * 60, H - 70);
            ctx.font = 'italic 900 26px Orbitron, sans-serif';
            ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(name, 0, 0);
            ctx.fillStyle = '#fff'; ctx.fillText(name, 0, 0);
            const tw = ctx.measureText(name).width;
            ctx.fillStyle = '#ffca28'; ctx.fillRect(0, 8, tw * inK, 3);
            ctx.font = '700 12px Orbitron, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(sub.toUpperCase() + ' · ' + (this.level.layoutName || '').toUpperCase(), 0, 28);
            ctx.restore();
        }
    };
})();
