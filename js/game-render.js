// Rendering: animate(dt) advances every visual system with the same scaled
// time step; render() draws the parallax backdrop, the world through a dynamic
// camera, then screen-space overlays (vignette, letterbox, HUD, banners).
Object.assign(Game.prototype, {
    animate(dt) {
        this.level.animate(dt);
        this.fx.step(dt);
        for (const p of this.players) {
            p.animate(dt, this);
            // A fresh KO becomes a ragdoll carrying the knockback it took
            if (p.isDead && !p.corpseSpawned && p.joints) {
                p.corpseSpawned = true;
                const rag = new Ragdoll(p.joints, p.velocity.x, p.velocity.y - 2, { headR: SK.headR, spin: (Math.random() - 0.5) * 0.06 });
                rag.shake(3);
                const corpse = { rag, color: p.isBird ? '#ffffff' : p.color, facing: p.facing };
                this.corpses.push(corpse);
                DeathAnim.attach(this, corpse, p.death || { body: 'topple', accent: null, dir: p.facing, weapon: null });   // how they die (death-anim.js)
                p.death = null;
            }
        }
        for (const w of this.weapons) w.animate(dt);
        // Bouncers shed sparkles now and then
        this.sparkleT = (this.sparkleT || 0) + dt;
        if (this.sparkleT > 14) {
            this.sparkleT = 0;
            for (const pl of this.level.platforms) {
                if (pl.active && pl.type === 'trampoline') this.fx.star(pl.x + 8 + Math.random() * (pl.width - 16), pl.y - 4, '150,255,200');
            }
        }
        for (const c of this.corpses) { c.rag.step(dt, this.level); DeathAnim.step(c, dt, this); }
        this.corpses = this.corpses.filter(c => c.rag.age < 420 && c.rag.pts[2].y < this.level.height + 400 && !(c.anim && c.anim.done));
        this.updateCamera(dt);
    },

    // The camera works in arena units. `viewScale` (window / arena) is applied when drawing, so on a small
    // screen the camera zooms in a little on the fight (never more than it takes to keep everyone in view).
    updateCamera(dt) {
        const lvl = this.level, AW = lvl.width, AH = lvl.height, cam = this.camera, vs = this.viewScale || 1;
        const cw = this.canvas.width, ch = this.canvas.height;
        let tx = AW / 2, ty = AH / 2, tz = 1, fx0 = null, fx1 = null;
        const zmax = Math.max(1.08, Math.min(2.2, 0.62 / vs));            // phones: zoom in until fighters are about 62% of full size
        const alive = this.players.filter(p => !p.isDead && p.joints);
        // The player's view should follow the people they control. Let bots
        // influence framing, but never let a cluster of bots drag the camera
        // away from a living human fighter.
        const humans = alive.filter(p => !p.isBot);
        const focus = humans.length ? humans : alive;
        if (this.roundOver && this.winner && !this.winner.isDead && this.winner.joints) {
            const c = this.winner.joints[2];
            tx = c.x; ty = c.y - 20; tz = Math.max(1.35, zmax);     // push in on the winner
        } else if (alive.length && this.state !== 'LOBBY') {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const p of alive) {
                const c = p.joints[2];
                x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
                y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
            }
            let focusX = 0, focusY = 0;
            let focusMinX = Infinity, focusMaxX = -Infinity;
            for (const p of focus) {
                const c = p.joints[2];
                focusX += c.x; focusY += c.y;
                focusMinX = Math.min(focusMinX, c.x); focusMaxX = Math.max(focusMaxX, c.x);
            }
            focusX /= focus.length; focusY /= focus.length;
            fx0 = focusMinX; fx1 = focusMaxX;
            tx = focusX; ty = focusY;
            if (zmax > 1.08) {
                // Fit the entire active group around the human-centered target.
                // This keeps bots visible without allowing them to recenter the view.
                const halfW = Math.max(Math.abs(x0 - focusX), Math.abs(x1 - focusX));
                const halfH = Math.max(Math.abs(y0 - focusY), Math.abs(y1 - focusY));
                const fit = Math.min(cw / (vs * (halfW * 2 + 260)), ch / (vs * (halfH * 2 + 260)));
                tz = Math.max(1, Math.min(zmax, fit));
            } else {
                const spread = Math.max((x1 - x0) / AW, (y1 - y0) / AH);
                tz = Math.max(1, Math.min(1.08, 1.12 - spread * 0.6));
            }
        }
        const k = 1 - Math.pow(0.92, Math.max(dt, 0.35));
        cam.zoom += (tz - cam.zoom) * k;
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        const hw = cw / (2 * vs * cam.zoom), hh = ch / (2 * vs * cam.zoom);   // half the view, in arena units
        // Keep the human focus inside the view when possible. If multiple human
        // players spread wider than the viewport, center them without an inverted
        // clamp (which previously snapped the camera to one edge of the group).
        if (2 * hw >= AW) cam.x = AW / 2;                                   // the window is wider than the arena: stay centred
        else {
            let lo = hw, hi = AW - hw;
            if (fx0 !== null) {
                const margin = Math.min(70, hw * 0.12);
                const focusLo = Math.max(hw, fx1 - hw + margin);
                const focusHi = Math.min(AW - hw, fx0 + hw - margin);
                if (focusLo <= focusHi) { lo = focusLo; hi = focusHi; }
            }
            cam.x = Math.max(lo, Math.min(hi, cam.x));
        }
        cam.y = 2 * hh >= AH ? AH / 2 : Math.max(hh, Math.min(AH - hh, cam.y));
    },

    render() {
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
        if (W < 2 || H < 2) return;   // hidden / collapsed frame: nothing to draw yet
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const sh = this.fx.shake();
        const vs = this.viewScale || 1, AW = this.level.width, AH = this.level.height;
        // backdrop and foreground props are drawn in arena space, centred and scaled to fit the window
        const arenaView = () => { ctx.translate((W - AW * vs) / 2, (H - AH * vs) / 2); ctx.scale(vs, vs); };
        ctx.save(); arenaView();
        this.level.drawBackdrop(ctx, this.camera, sh);   // parallax follows the real camera
        ctx.restore();

        ctx.save();
        ctx.translate(W / 2 + sh.x, H / 2 + sh.y);
        ctx.rotate(sh.angle);
        ctx.scale(this.camera.zoom * vs, this.camera.zoom * vs);
        ctx.translate(-this.camera.x, -this.camera.y);
        this.level.drawPlatforms(ctx);
        this.fx.drawDecals(ctx);
        for (const w of this.weapons) w.draw(ctx, this.alpha, this.players);
        for (const c of this.corpses) {
            const a = c.rag.age < 330 ? 1 : Math.max(0, 1 - (c.rag.age - 330) / 90);
            DeathAnim.draw(ctx, c, a);
        }
        for (const p of this.players) p.draw(ctx, this);
        for (const pr of this.projectiles) pr.draw(ctx, this.alpha);
        this.fx.draw(ctx);
        ctx.restore();
        ctx.save(); arenaView();
        this.level.drawForeground(ctx, this.camera, sh);   // opaque edge props in front of the action
        ctx.restore();

        this.drawGrade(ctx, W, H);
        this.drawVignette(ctx, W, H);
        this.drawDanger(ctx, W, H);
        this.fx.drawScreen(ctx, W, H);
        this.drawLetterbox(ctx, W, H);
        if (!this.demo && (this.state === 'PLAYING' || this.state === 'PAUSED')) this.drawHUD(ctx, W, H);
        if (this.state === 'LOBBY') this.drawLobby(ctx, W, H);
        if (this.matchmaking && !this.demo) this.drawMatchmaking(ctx, W, H);
        this.drawBanners(ctx, W, H);
    },

    drawVignette(ctx, W, H) {
        if (!this.vignette || this.vignette.width !== W || this.vignette.height !== H) {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const v = c.getContext('2d');
            const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,10,0.45)');
            v.fillStyle = g;
            v.fillRect(0, 0, W, H);
            this.vignette = c;
        }
        ctx.drawImage(this.vignette, 0, 0);
    },

    // Per-theme colour grade plus a little animated film grain
    drawGrade(ctx, W, H) {
        const grade = { dirt: ['255,190,110', 0.12], stone: ['150,90,190', 0.14], ice: ['90,200,255', 0.12], cloud: ['255,235,200', 0.1], magic: ['200,80,255', 0.16] }[this.level.material];
        if (grade) {
            ctx.save();
            ctx.globalCompositeOperation = 'soft-light';
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, `rgba(${grade[0]},${grade[1] * 1.4})`);
            g.addColorStop(1, `rgba(${grade[0]},${grade[1] * 0.6})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
        if (!this.grain) {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const g = c.getContext('2d');
            const img = g.createImageData(128, 128);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            this.grain = ctx.createPattern(c, 'repeat');
        }
        if (this.grain) {
            ctx.save();
            ctx.globalAlpha = 0.035;
            ctx.globalCompositeOperation = 'overlay';
            const o = Math.floor(this.fx.clock * 7) % 128;   // advances with game time
            ctx.translate(-o, -((o * 37) % 128));
            ctx.fillStyle = this.grain;
            ctx.fillRect(0, 0, W + 128, H + 128);
            ctx.restore();
        }
    },

    // Red pulse at the screen edges while a human player is close to death
    drawDanger(ctx, W, H) {
        if (this.demo) return;
        const low = this.players.some(p => !p.isBot && !p.isDead && p.health < p.maxHealth * 0.25);
        if (!low) return;
        const a = 0.18 + 0.12 * Math.sin(this.fx.clock * 0.12);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
        g.addColorStop(0, 'rgba(255,0,0,0)');
        g.addColorStop(1, `rgba(200,0,20,${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    },

    drawLetterbox(ctx, W, H) {
        if (this.letterbox < 0.01) return;
        const h = H * 0.09 * this.letterbox;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, h);
        ctx.fillRect(0, H - h, W, h);
    },

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    drawHUD(ctx, W, H) {
        const touchScale = typeof this.isTouchDevice === 'function' && this.isTouchDevice() ? 0.88 : 1;
        if (touchScale !== 1) { ctx.save(); ctx.scale(touchScale, touchScale); W /= touchScale; H /= touchScale; }
        const n = this.players.length;
        const gap = 8;
        const rows = n > 5 ? 2 : 1;
        const perRow = Math.ceil(n / rows);
        const cardW = n <= 2 ? 220 : Math.min(220, (W - 32 - (perRow - 1) * gap) / perRow);
        const compact = cardW < 170;
        const cardH = compact ? 40 : 54;
        this.players.forEach((p, i) => {
            const r = Math.floor(i / perRow), c = i % perRow;
            const inRow = r === rows - 1 ? n - r * perRow : perRow;
            const startX = (W - (inRow * cardW + (inRow - 1) * gap)) / 2;
            const x = n === 2 ? (i === 0 ? 16 : W - 16 - cardW) : startX + c * (cardW + gap);
            this.drawCard(ctx, p, x, 14 + r * (cardH + 6), cardW, cardH, compact);
        });
        // Round badge: between two cards, or below the card rows
        const by = n <= 2 ? 12 : 14 + rows * (cardH + 6) + 4;
        ctx.save();
        ctx.textAlign = 'center';
        const sceneLabel = this.sceneName().toUpperCase();
        ctx.font = '600 10px Orbitron, sans-serif';
        const sceneLabelWidth = ctx.measureText(sceneLabel).width;
        const badgeW = Math.min(Math.max(148, sceneLabelWidth + 28), Math.max(120, W - 24));
        this.roundRect(ctx, W / 2 - badgeW / 2, by, badgeW, 40, 20);
        ctx.fillStyle = 'rgba(8,12,26,0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 16px Orbitron, sans-serif';
        ctx.fillText(`ROUND ${this.levelNum}`, W / 2, by + 18);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '600 10px Orbitron, sans-serif';
        // Widen the badge to the actual scene name so Canvas does not horizontally
        // compress long holiday names into the old 128px label area.
        const availableLabelWidth = badgeW - 24;
        if (sceneLabelWidth > availableLabelWidth) {
            const labelSize = Math.max(7, 10 * availableLabelWidth / sceneLabelWidth);
            ctx.font = `600 ${labelSize}px Orbitron, sans-serif`;
        }
        ctx.fillText(sceneLabel, W / 2, by + 33);
        // Kill goal under the round badge: first to 10, or each team's combined total toward 20
        ctx.font = '800 10px Orbitron, sans-serif';
        if (this.teamMode) {
            const teams = [...this.teamKills().values()];
            const parts = teams.map(t => `${t.n}`), gap2 = 14;
            const label = `FIRST TEAM TO ${TEAM_KILL_GOAL} KILLS`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(label, W / 2, by + 56);
            let tx = W / 2 - (parts.length * 26 + (parts.length - 1) * gap2) / 2;
            teams.forEach((t, i) => {
                this.roundRect(ctx, tx, by + 62, 26, 16, 8); ctx.fillStyle = t.color; ctx.fill();
                ctx.fillStyle = '#10142a'; ctx.fillText(parts[i], tx + 13, by + 74);
                tx += 26 + gap2;
            });
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`FIRST TO ${KILL_GOAL} KILLS`, W / 2, by + 56);
        }
        ctx.restore();
        this.feedY = n <= 2 ? 100 : by + 84;
        this.drawFeed(ctx, W);
        if (touchScale !== 1) ctx.restore();
    },

    drawCard(ctx, p, x, y, w, h, compact) {
        ctx.save();
        this.roundRect(ctx, x, y, w, h, 10);
        ctx.fillStyle = p.isDead ? 'rgba(40,10,10,0.55)' : 'rgba(8,12,26,0.6)';
        ctx.fill();
        ctx.strokeStyle = p.teamColor ? p.teamColor : 'rgba(255,255,255,0.16)';
        ctx.lineWidth = p.teamColor ? 1.5 : 1;
        ctx.stroke();
        ctx.fillStyle = p.color;
        this.roundRect(ctx, x, y, 6, h, 3);
        ctx.fill();
        if (compact) {
            ctx.font = '800 11px Orbitron, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = p.teamColor || (p.isBot ? StickArt.shade(p.color, 1.35) : '#fff');
            const local = this.mode === 'online' ? this.multiplayer?.localSeats?.includes(p.id) : !p.isBot;
            const localIndex = local && this.mode === 'online' ? this.multiplayer.localSeats.indexOf(p.id) : -1;
            const compactName = this.mode === 'online' ? (local ? (this.multiplayer.localSeats.length > 1 ? `YOU ${localIndex + 1}` : 'YOU') : p.isBot ? `B${p.id + 1}` : String(p.label || 'P').slice(0, 3).toUpperCase()) : (local ? 'YOU' : '');
            if (compactName) ctx.fillText(compactName, x + 12, y + 15, Math.max(10, w - 36));
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.fillText(String(p.kills), x + w - 8, y + 15);
            this.drawKillIcon(ctx, x + w - 14 - ctx.measureText(String(p.kills)).width, y + 11, 5);
            const bw = w - 20, ratio = Math.max(0, p.health / p.maxHealth);
            const trail = Math.max(ratio, (p.hpTrail === undefined ? p.health : p.hpTrail) / p.maxHealth);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(x + 12, y + 23, bw, 7);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(x + 12, y + 23, bw * trail, 7);
            ctx.fillStyle = ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffca28' : '#ef5350';
            ctx.fillRect(x + 12, y + 23, bw * ratio, 7);
            if (p.isDead) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '700 9px Orbitron, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('K.O.', x + 12, y + 37);
            }
            ctx.restore();
            return;
        }
        const local = this.mode === 'online' ? this.multiplayer?.localSeats?.includes(p.id) : !p.isBot;
        const localIndex = local && this.mode === 'online' ? this.multiplayer.localSeats.indexOf(p.id) : -1;
        const name = this.mode === 'online' ? (local ? (this.multiplayer.localSeats.length > 1 ? `YOU ${localIndex + 1}` : 'YOU') : p.label || (p.isBot ? `BOT ${p.id + 1}` : 'PLAYER')) : (p.isBot ? '' : 'YOU');
        ctx.font = '800 12px Orbitron, sans-serif';
        ctx.fillStyle = p.isBot && BOT_PROFILES[p.difficulty] ? StickArt.shade(BOT_PROFILES[p.difficulty].color, 1.35) : p.teamColor || '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(name, x + 14, y + 17);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(p.kills), x + w - 10, y + 17);
        this.drawKillIcon(ctx, x + w - 18 - ctx.measureText(String(p.kills)).width, y + 12.5, 6);
        // Health with damage trail
        const bx = x + 14, by = y + 25, bw = w - 74, bh = 8;
        const ratio = Math.max(0, p.health / p.maxHealth);
        const trail = Math.max(ratio, (p.hpTrail === undefined ? p.health : p.hpTrail) / p.maxHealth);
        this.roundRect(ctx, bx, by, bw, bh, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(bx, by, bw * trail, bh);
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, ratio > 0.3 ? '#43a047' : '#c62828');
        g.addColorStop(1, ratio > 0.5 ? '#9ccc65' : ratio > 0.3 ? '#ffca28' : '#ff7043');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw * ratio, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '600 10px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(p.isDead ? 'K.O.' : `${Math.ceil(p.health)} HP`, bx, y + 47);
        if (!p.isDead) this.drawShieldPip(ctx, bx + 66, y + 43, p);
        // Weapon slot: icon + ammo pips
        const sx = x + w - 52, sy = y + 23;
        this.roundRect(ctx, sx, sy, 42, 26, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        if (p.weapon) {
            const type = p.weapon.type, span = WEAPON_ART_SPAN[type] || [-20, 20];
            const s = Math.min(0.9, 36 / (span[1] - span[0]));
            ctx.save();
            ctx.translate(sx + 21, sy + 13);
            ctx.scale(s, s);
            ctx.translate(-(span[0] + span[1]) / 2, 0);
            WeaponArt.draw(ctx, type, { t: p.clock, glow: 1 });
            ctx.restore();
            const d = p.weapon.def.durability;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = '600 9px Orbitron, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(isFinite(d) && isFinite(p.weapon.durability) ? `${p.weapon.durability}/${d}` : '∞', x + w - 10, y + 47);
        }
        ctx.restore();
    },

    // Shield state: bright while ready, draining while up, refilling while it recharges
    drawShieldPip(ctx, cx, cy, p) {
        const r = 5.5;
        const up = p.shieldActive, cd = p.shieldCd || 0;
        const k = up ? 1 - (p.shieldTime || 0) / Player.SHIELD_MAX : cd > 0 ? 1 - cd / Player.SHIELD_CD : 1;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy - r * 0.55); ctx.lineTo(cx + r * 0.8, cy + r * 0.45);
        ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy + r * 0.45); ctx.lineTo(cx - r, cy - r * 0.55); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = up ? '#81d4fa' : cd > 0 ? 'rgba(144,202,249,0.45)' : '#4fc3f7';
        ctx.fillRect(cx - r, cy + r - 2 * r * k, 2 * r, 2 * r * k);
        ctx.restore();
        ctx.strokeStyle = cd > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    },

    // Kill counter icon: two crossed swords
    drawKillIcon(ctx, cx, cy, r) {
        ctx.save();
        ctx.lineCap = 'round';
        for (const d of [1, -1]) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(d * Math.PI / 4);
            ctx.strokeStyle = '#eceff1';
            ctx.lineWidth = Math.max(1.4, r * 0.32);
            ctx.beginPath(); ctx.moveTo(0, -r * 1.25); ctx.lineTo(0, r * 0.55); ctx.stroke();          // blade
            ctx.strokeStyle = '#ffca28';
            ctx.lineWidth = Math.max(1.2, r * 0.28);
            ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.55); ctx.lineTo(r * 0.5, r * 0.55); ctx.stroke();  // guard
            ctx.beginPath(); ctx.moveTo(0, r * 0.6); ctx.lineTo(0, r * 1.15); ctx.stroke();               // grip
            ctx.restore();
        }
        ctx.restore();
    },

    drawFeed(ctx, W) {
        const now = performance.now();
        let y = this.feedY || 86;
        ctx.save();
        ctx.font = '700 12px Orbitron, sans-serif';
        ctx.textAlign = 'right';
        for (const f of this.feed) {
            const age = (now - f.start) / 1000;
            if (age > 5) continue;
            ctx.globalAlpha = Math.min(1, (5 - age) * 2);
            const text = `${f.killer ? f.killer + '  ⟶  ' : ''}${f.victim}   ${f.how}`;
            const tw = ctx.measureText(text).width;
            this.roundRect(ctx, W - 24 - tw - 12, y - 14, tw + 20, 22, 8);
            ctx.fillStyle = 'rgba(8,12,26,0.6)';
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(text, W - 24, y + 1);
            y += 28;
        }
        ctx.restore();
    },

    // Banners animate in real time (UI, not the world) so they stay readable
    drawBanners(ctx, W, H) {
        const now = performance.now();
        this.banners = this.banners.filter(b => now < b.start + b.dur);
        for (const b of this.banners) {
            const t = (now - b.start) / b.dur;
            if (t < 0) continue;
            const inT = Math.min(1, t / 0.12);
            const scale = 1 + (1 - inT) * 0.6;
            const alpha = Math.min(inT, t > 0.78 ? (1 - t) / 0.22 : 1);
            const big = b.sub ? 64 : 84;
            ctx.save();
            ctx.translate(W / 2, H * 0.38);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = `italic 900 ${big}px Orbitron, sans-serif`;
            ctx.lineJoin = 'round';
            for (const [lw, a] of [[18, 0.15], [10, 0.3]]) {
                ctx.strokeStyle = b.color;
                ctx.globalAlpha = alpha * a;
                ctx.lineWidth = lw;
                ctx.strokeText(b.text, 0, 0);
            }
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.strokeText(b.text, 0, 0);
            const g = ctx.createLinearGradient(0, -big, 0, 0);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(1, b.color);
            ctx.fillStyle = g;
            ctx.fillText(b.text, 0, 0);
            if (b.sub) {
                ctx.font = '800 20px Orbitron, sans-serif';
                ctx.lineWidth = 4;
                ctx.strokeText(b.sub, 0, 36);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(b.sub, 0, 36);
            }
            ctx.restore();
        }
    },

    // Small animated stickman for lobby and matchmaking cards
    drawMiniFighter(ctx, cx, baseY, color, t, seed, scale, wave) {
        const k = scale || 1.4;
        const bob = Math.sin(t * 0.004 + seed) * 1.5;
        const w = wave ? Math.sin(t * 0.012 + seed) : 0;
        const P = (x, y) => ({ x: cx + x * k, y: baseY + y * k });
        const J = [
            P(0, -57 + bob), P(0, -48 + bob), P(0, -29 + bob * 0.5),
            P(9, -40 + bob - w * 4), P(wave ? 13 : 12, wave ? -58 + bob - w * 6 : -30 + bob),
            P(-8, -38 + bob), P(-12, -28 + bob),
            P(5, -15), P(7, 0), P(-5, -15), P(-7, 0)
        ];
        StickArt.figure(ctx, J, color, { facing: 1, expression: 'normal' });
    },

    // Rounded "key" chip: [key] label
    drawKeyChip(ctx, x, y, key, label) {
        ctx.font = '800 13px Orbitron, sans-serif';
        const kw = Math.max(26, ctx.measureText(key).width + 14);
        ctx.font = '600 13px Orbitron, sans-serif';
        const lw = ctx.measureText(label).width;
        const total = kw + lw + 22;
        this.roundRect(ctx, x, y, total, 30, 15);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        this.roundRect(ctx, x + 4, y + 4, kw, 22, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.fillStyle = '#10142a';
        ctx.font = '800 13px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(key, x + 4 + kw / 2, y + 20);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 13px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x + kw + 12, y + 20);
        return total;
    },

    // Dark, softly animated backdrop shared by the party lobby and matchmaking
    drawPanelBackdrop(ctx, W, H, t, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, 'rgba(10,8,34,0.92)');
        g.addColorStop(1, 'rgba(4,18,40,0.92)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        const glows = [['229,57,53', 0.15, 0.25], ['30,136,229', 0.85, 0.3], ['253,216,53', 0.3, 0.9], ['67,160,71', 0.8, 0.85]];
        for (const [rgb, fx, fy] of glows) {
            const x = W * fx + Math.sin(t * 0.0004 + fx * 9) * 60, y = H * fy + Math.cos(t * 0.0005 + fy * 7) * 40;
            const r = Math.max(W, H) * 0.35;
            const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, `rgba(${rgb},0.16)`);
            rg.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = rg;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // Slow diagonal light stripes
        ctx.globalAlpha = alpha * 0.05;
        ctx.fillStyle = '#ffffff';
        const off = (t * 0.03) % 160;
        for (let x = -H; x < W + H; x += 160) {
            ctx.beginPath();
            ctx.moveTo(x + off, 0); ctx.lineTo(x + off + 50, 0); ctx.lineTo(x + off + 50 - H, H); ctx.lineTo(x + off - H, H);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },

    drawTitle(ctx, W, y, text, sub) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'italic 900 46px Orbitron, sans-serif';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,202,40,0.25)';
        ctx.lineWidth = 12;
        ctx.strokeText(text, W / 2, y);
        const g = ctx.createLinearGradient(0, y - 40, 0, y);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#ffd54f');
        ctx.fillStyle = g;
        ctx.fillText(text, W / 2, y);
        if (sub) {
            ctx.font = '700 12px Orbitron, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(sub.split('').join(String.fromCharCode(8202)), W / 2, y + 24);
        }
        ctx.restore();
    },

    // Controller Party: who's in, how to join, how to start
    drawLobby(ctx, W, H) {
        const t = performance.now();
        // Small screens (phones): draw the whole lobby at a reduced scale so everything fits, with room left for the touch buttons
        const touch = this.isTouchDevice(), ls = Math.min(1, (H - (touch ? 60 : 0)) / 560, W / 900);
        ctx.save();
        ctx.scale(ls, ls);
        W /= ls; H /= ls;
        this.drawPanelBackdrop(ctx, W, H, t, 1);
        this.drawTitle(ctx, W, 74, 'CONTROLLER PARTY', 'LOCAL MULTIPLAYER  ·  UP TO 10 FIGHTERS');
        // Fighter counter
        const n = this.players.length;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '800 14px Orbitron, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(`${n} / 10 FIGHTERS`, W / 2, 174);
        ctx.restore();

        // Slots: two rows of five
        const cols = 5, gap = 14;
        const slotW = Math.min(176, (W - 80 - gap * (cols - 1)) / cols);
        const slotH = touch ? 118 : Math.max(150, Math.min(214, (H - 300) / 2 - gap));
        const startX = (W - (cols * slotW + (cols - 1) * gap)) / 2, startY = 192;
        const how = (p) => p.isBot ? 'ONLINE' :
            p.inputType === 'universal' ? 'TOUCH' : p.inputType === 'keyboard_wasd' ? 'KEYBOARD · WASD' : p.inputType === 'keyboard_arrows' ? 'KEYBOARD · ARROWS' :
            `CONTROLLER ${parseInt(p.inputType.split('_')[1]) + 1}`;
        for (let i = 0; i < 10; i++) {
            const x = startX + (i % cols) * (slotW + gap), y = startY + Math.floor(i / cols) * (slotH + gap);
            const p = this.players[i];
            ctx.save();
            if (p) {
                // Pop in when someone joins
                const age = (t - (p.joinT || 0)) / 280;
                const pop = age < 1 ? 1 + Math.sin(age * Math.PI) * 0.08 : 1;
                ctx.translate(x + slotW / 2, y + slotH / 2);
                ctx.scale(pop, pop);
                ctx.translate(-(x + slotW / 2), -(y + slotH / 2));
                this.roundRect(ctx, x, y, slotW, slotH, 16);
                const bg = ctx.createLinearGradient(0, y, 0, y + slotH);
                bg.addColorStop(0, `rgba(${Utils.hexRgb(p.color)},0.35)`);
                bg.addColorStop(0.55, 'rgba(255,255,255,0.05)');
                bg.addColorStop(1, 'rgba(0,0,0,0.25)');
                ctx.fillStyle = bg;
                ctx.fill();
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                // Spotlight behind the fighter
                const sx = x + slotW / 2, sy = y + slotH * 0.5;
                const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, slotW * 0.5);
                sg.addColorStop(0, `rgba(${Utils.hexRgb(p.color)},0.35)`);
                sg.addColorStop(1, `rgba(${Utils.hexRgb(p.color)},0)`);
                ctx.fillStyle = sg;
                ctx.fillRect(x, y, slotW, slotH);
                this.drawMiniFighter(ctx, sx, y + slotH - 54, p.color, t, i * 1.7, Math.min(1.5, slotH / 140), age < 6);
                ctx.textAlign = 'center';
                ctx.font = '900 15px Orbitron, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.fillText('READY', sx, y + slotH - 26);
                ctx.font = '700 10px Orbitron, sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.65)';
                ctx.fillText(how(p), sx, y + slotH - 11);
            } else {
                // Open slot: dashed outline, pulsing plus
                this.roundRect(ctx, x, y, slotW, slotH, 16);
                ctx.fillStyle = 'rgba(255,255,255,0.025)';
                ctx.fill();
                ctx.setLineDash([7, 6]);
                ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.setLineDash([]);
                const pulse = 0.4 + 0.3 * Math.sin(t * 0.004 + i);
                ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                const px = x + slotW / 2, py = y + slotH / 2 - 10;
                ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
                ctx.textAlign = 'center';
                ctx.font = '700 11px Orbitron, sans-serif';
                ctx.fillStyle = `rgba(255,255,255,${pulse + 0.15})`;
                ctx.fillText('PRESS TO JOIN', px, py + 34);
            }
            ctx.restore();
        }
        // Start bar
        const ready = n >= 2;
        const bw = 340, bx = (W - bw) / 2, by = Math.min(H - 54, startY + 2 * (slotH + gap) + 8);
        ctx.save();
        this.roundRect(ctx, bx, by, bw, 40, 20);
        if (ready) {
            const pulse = 0.75 + 0.25 * Math.sin(t * 0.006);
            const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
            g.addColorStop(0, `rgba(255,202,40,${pulse})`);
            g.addColorStop(1, `rgba(255,143,0,${pulse})`);
            ctx.fillStyle = g;
        } else ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.font = '900 15px Orbitron, sans-serif';
        ctx.fillStyle = ready ? '#1a1300' : 'rgba(255,255,255,0.55)';
        ctx.fillText(ready ? (touch ? 'TAP START TO FIGHT' : 'PRESS ENTER OR START TO FIGHT') : 'WAITING FOR 2+ FIGHTERS', W / 2, by + 26);
        ctx.restore();
        ctx.restore();   // the small-screen scale
    },

    // Solo / Doubles intro: fighters "connect" one by one, then MATCH FOUND
    drawMatchmaking(ctx, W, H) {
        const mm = this.matchmaking;
        const t = performance.now(), el = t - mm.start;
        if (el > mm.dur + 400) { this.matchmaking = null; return; }
        const fade = el > mm.dur ? 1 - (el - mm.dur) / 400 : Math.min(1, el / 200);
        this.drawPanelBackdrop(ctx, W, H, t, fade);
        ctx.save();
        ctx.globalAlpha = fade;
        const found = el > mm.dur - 450;
        this.drawTitle(ctx, W, H * 0.22, found ? 'MATCH FOUND' : 'FINDING PLAYERS' + '.'.repeat(1 + Math.floor(el / 300) % 3),
            this.teamMode ? 'TEAMS OF TWO' : 'FREE-FOR-ALL');
        const ps = this.players;
        const n = ps.length;
        const groups = this.teamMode ? [0, 1, 2, 3].map(tm => ps.filter(p => p.team === tm)) : ps.map(p => [p]);
        const cardW = Math.min(150, (W - 80) / Math.max(4, n) - 12), cardH = 168;
        const groupGap = this.teamMode ? 26 : 14;
        const totalW = groups.reduce((a, g) => a + g.length * (cardW + 10) - 10, 0) + (groups.length - 1) * groupGap;
        let x = (W - totalW) / 2;
        const y = H * 0.36;
        let idx = 0;
        groups.forEach(g => {
            g.forEach(p => {
                const local = !p.isBot;
                const at = local ? 0 : 350 + idx * (mm.dur - 1000) / Math.max(1, n - 1);
                const here = el >= at;
                const age = (el - at) / 260;
                ctx.save();
                const pop = here && age < 1 ? 1 + Math.sin(age * Math.PI) * 0.1 : 1;
                ctx.translate(x + cardW / 2, y + cardH / 2);
                ctx.scale(pop, pop);
                ctx.translate(-(x + cardW / 2), -(y + cardH / 2));
                this.roundRect(ctx, x, y, cardW, cardH, 14);
                if (here) {
                    const bg = ctx.createLinearGradient(0, y, 0, y + cardH);
                    bg.addColorStop(0, `rgba(${Utils.hexRgb(p.color)},0.38)`);
                    bg.addColorStop(1, 'rgba(0,0,0,0.25)');
                    ctx.fillStyle = bg;
                    ctx.fill();
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    this.drawMiniFighter(ctx, x + cardW / 2, y + cardH - 44, p.color, t, idx * 1.3, 1.3, age < 4);
                    ctx.textAlign = 'center';
                    ctx.font = '900 12px Orbitron, sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(local ? 'YOU' : 'JOINED', x + cardW / 2, y + cardH - 16);
                    // Connection bars
                    for (let b = 0; b < 4; b++) {
                        ctx.fillStyle = b < 3 + (idx % 2) ? '#69f0ae' : 'rgba(255,255,255,0.25)';
                        ctx.fillRect(x + cardW - 26 + b * 5, y + 18 - b * 3, 3, 4 + b * 3);
                    }
                } else {
                    ctx.fillStyle = 'rgba(255,255,255,0.04)';
                    ctx.fill();
                    ctx.setLineDash([6, 5]);
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Spinner
                    const sx = x + cardW / 2, sy = y + cardH / 2 - 8, a = t * 0.008;
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.arc(sx, sy, 14, a, a + 4.2); ctx.stroke();
                    ctx.textAlign = 'center';
                    ctx.font = '700 10px Orbitron, sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillText('SEARCHING', sx, sy + 36);
                }
                ctx.restore();
                x += cardW + 10;
                idx++;
            });
            x += groupGap - 10;
        });
        ctx.restore();
    }
});
