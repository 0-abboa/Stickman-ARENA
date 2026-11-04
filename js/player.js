class Player {
    constructor(id, x, y, color, inputType) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 60;
        this.originalColor = color || Utils.randomColor();
        this.color = this.originalColor;
        this.inputType = inputType; // 'keyboard_wasd', 'bot', etc.
        this.team = id;              // free-for-all by default; teammates share a number
        this.teamColor = null;       // team mode: scarf, name tag and ground ring colour
        this.label = null;           // name shown over the head ('P1', 'BOT 2', ...)
        
        this.velocity = { x: 0, y: 0 };
        this.speed = 5;
        this.jumpForce = 12;
        this.gravity = 0.5;
        this.grounded = false;
        this.facing = 1; // 1 right, -1 left
        
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        
        this.weapon = null;
        this.shieldActive = false;
        this.wings = false; // From bird crystal
        this.scale = 1;
        
        this.attackCooldown = 0;
        this.isBot = false;
        this.isBird = false; // Angel/Bird mode
        
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.jumpPressed = false; // To prevent holding jump
        this.isLaying = false;
        this.kills = 0;
        this.onCloud = false;

        // Visual state. Everything here is advanced by animate(dt) in
        // player-anim.js, so slow motion and hit-stop slow it all down.
        this.prevX = x;       // position before the last update, for smooth rendering
        this.prevY = y;
        this.squash = 0;      // 0..1 landing/trampoline squash
        this.runPhase = 0;    // gait cycle
        this.breath = 0;      // idle breathing
        this.lean = 0;        // torso lean
        this.clock = Math.random() * 1000;
        this.attackAnim = 99; // frames since the last swing/shot started
        this.attackDur = 20;
        this.hitFlash = 0;    // white flash when damaged
        this.flinch = 0;      // ragdoll blend weight after a hit
        this.flinchNew = false;
        this.proneW = 0;      // 0 standing .. 1 lying prone
        this.pose = null;
        this.joints = null;   // world-space skeleton from the last frame
        this.trail = [];
        this.landFx = 0;      // impact speed of the last hard landing, consumed by Game
    }

    update(game) {
        if (this.isDead) return;
        this.prevX = this.x;
        this.prevY = this.y;
        this.prevH = this.height;
        this.trail.unshift(this.x, this.y);
        if (this.trail.length > 12) this.trail.length = 12;

        if (this.shieldCd > 0) this.shieldCd--;
        const input = this.readInput(game);
        let inp = input;
        const st = this.status;
        if (st && st.trap > 0) {
            // Caught in a net: no walking, jumping or crouching, but you can still hit and block.
            // Wriggling (trying to move or jump) frees you faster.
            if (input.x || input.jump || input.y) st.trap = Math.max(0, st.trap - 1.2);
            inp = Object.assign({}, input, { x: 0, y: 0, jump: false });
            this.velocity.x *= 0.6;
        }
        this.applyInput(st && st.stun > 0 ? Player.STUNNED : inp);   // stunned: no control
        this.applyPhysics(game.level);
        this.checkWeaponPickup(game.weapons, game.players);
        
        if (this.grounded) {
            this.jumpCount = 0;
        }
        if (this.launched && (this.velocity.y >= 0 || this.grounded)) this.launched = false;   // the launch is over once we start falling

        if (this.attackCooldown > 0) this.attackCooldown--;

        // Weapon update
        if (this.weapon) {
            // Calculate hand position relative to player center
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            
            // Adjust for laying down
            let handX, handY;
            if (this.isLaying) {
                // If laying, hand is lower
                handX = centerX + (this.facing * 30);
                handY = centerY + 15;
            } else {
                handX = centerX + (this.facing * 25);
                handY = centerY - 5;
            }

            this.weapon.x = handX;
            this.weapon.y = handY;
            this.weapon.rotation = 0; // Rotation handled in weapon.draw via scale
            this.weapon.update();
            
            if (this.weapon.durability <= 0 && this.weapon.type !== 'bird_crystal') {
                this.weapon.active = false; // Mark as inactive to remove from game
                this.weapon = null;
                if (this.onCloud) { this.onCloud = false; this.velocity.y = Math.min(this.velocity.y, 0); }   // staff spent: the cloud fades
            }
        }
        
        // Wings logic
        if (this.wings) {
            this.gravity = 0.35; // Slightly floatier than normal (0.5), but not too floaty
        }

        // Bird Touch Kill Logic
        if (this.isBird) {
             game.players.forEach(p => {
                 if (p !== this && !p.isDead && p.team !== this.team && Utils.rectIntersect(this, p)) {
                     p.lastHitType = 'bird_crystal'; p.lastHitAt = game.frameCount;
                     p.takeDamage(1, this); // Continuous damage instead of oneshot
                     if (game.frameCount % 10 === 0) { // Effect every few frames
                        game.createExplosion(p.x, p.y, 'red');
                        AudioSys.playHit();
                     }
                 }
             });
        }
        
        // Bounds check
        const surface = game.level.voidSurface;   // lava / chocolate / icy water kill on touch (void.js)
        if (this.y > game.level.height + 100 || (surface !== undefined && this.y + this.height > surface)) {
            this.takeDamage(1000);
        }
    }

    // Humans read the shared InputManager. Bot overrides this with its brain's
    // virtual controller, so both go through the exact same applyInput rules.
    readInput(game) {
        if (game.state === 'PAUSED') return Player.IDLE;   // menu open: you stand there while the match goes on
        return game.inputManager.getPlayerInput(this.id, this.inputType);
    }

    applyInput(input) {
        
        if (this.isBird || this.onCloud) {
            if (this.isLaying) { this.y -= 30; this.height = 60; this.isLaying = false; }   // fliers never lie down
            // Bird/Angel/Cloud Flight Physics
            const flySpeed = this.speed * 1.5;
            if (input.x !== 0) this.velocity.x += input.x * 0.5;
            if (input.jump) this.velocity.y -= 0.5; // Fly up
            if (input.y > 0) this.velocity.y += 0.5; // Fly down
            
            // Cap speed
            const maxSpeed = 8;
            const speed = Math.sqrt(this.velocity.x**2 + this.velocity.y**2);
            if (speed > maxSpeed) {
                this.velocity.x = (this.velocity.x / speed) * maxSpeed;
                this.velocity.y = (this.velocity.y / speed) * maxSpeed;
            }

            if (input.x !== 0) this.facing = input.x > 0 ? 1 : -1;
            this.shieldActive = !!this.autoShield;   // only the angel's automatic shield while flying

            // Attack
            if (input.attack && this.attackCooldown <= 0) {
                this.attack();
            }
            return;
        }

        // Laying Down Logic
        if (input.y > 0.5 && this.grounded && !this.isBird && !this.onCloud) {
            if (!this.isLaying) {
                this.y += 30; // Shift down to keep feet on ground
                this.isLaying = true;
                this.height = 30; // Reduce hitbox
            }
            this.velocity.x = 0; // Stop moving
        } else {
            if (this.isLaying) {
                this.y -= 30; // Shift up to restore height
                this.isLaying = false;
                this.height = 60; // Restore hitbox
            }
        }

        // Movement: ease toward target speed so starts/stops feel weighted
        if (!this.isLaying && input.x !== 0) {
            const target = input.x * this.speed * (this.speedMul || 1);   // slowed / frozen fighters crawl
            const control = this.grounded ? 0.35 : 0.18; // Snappy on ground, looser in air
            this.velocity.x += (target - this.velocity.x) * control;
            // Only change facing if not aiming
            if (Math.abs(input.aimX) < 0.1) {
                this.facing = input.x > 0 ? 1 : -1;
            }
        } else if (!this.isLaying) {
            // Quick ground stop, keep most momentum mid-air
            this.velocity.x *= this.grounded ? 0.8 : 0.98;
        }

        // Aiming (Controller/Touch Right Stick)
        if (Math.abs(input.aimX) > 0.1) {
            this.facing = input.aimX > 0 ? 1 : -1;
        }

        // Jump
        if (input.jump) {
            if (!this.jumpPressed) {
                if (this.wings || this.onCloud) {
                    this.velocity.y = -5; // Fly
                } else if (this.grounded || this.jumpCount < this.maxJumps) {
                    let force = this.jumpForce;
                    if (input.isMobileJump) force *= 1.5; // Higher jump for mobile
                    
                    this.velocity.y = -force;
                    this.grounded = false;
                    this.jumpCount++;
                }
                this.jumpPressed = true;
            }
        } else {
            this.jumpPressed = false;
            // Releasing jump early cuts the ascent for a controllable hop, but never a
            // bounce: a bouncer launches you at full height whether or not you hold jump
            if (!this.wings && !this.launched && this.velocity.y < -4) this.velocity.y *= 0.6;
        }

        // Attack
        if (input.attack && this.attackCooldown <= 0) {
            this.attack();
        }

        // Shield: up to 1 second per raise, then 2 seconds to recharge, and a
        // fresh press is needed to raise it again (holding the button doesn't)
        if (this.autoShield) {
            // Angel-wide automatic shield: held for as long as the angel lives
            this.shieldActive = true;
            this.shieldTime = 0;
            this.shieldLatch = false;
        } else if (this.shieldActive) {
            this.shieldTime = (this.shieldTime || 0) + 1;
            if (!input.shield || this.shieldTime >= Player.SHIELD_MAX) {
                this.shieldActive = false;
                this.shieldTime = 0;
                this.shieldCd = Player.SHIELD_CD;
                this.shieldLatch = !!input.shield;
            }
        } else if (input.shield) {
            if (!this.shieldLatch && !(this.shieldCd > 0)) {
                this.shieldActive = true;
                this.shieldTime = 0;
                if (!this.isGhost) AudioSys.playShield();
            } else this.shieldLatch = true;
        }
        if (!input.shield) this.shieldLatch = false;
    }

    applyPhysics(level) {
        if (this.isBird || this.onCloud) {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            
            // Keep in bounds
            if (this.x < 0) { this.x = 0; this.velocity.x *= -1; }
            if (this.x > level.width - this.width) { this.x = level.width - this.width; this.velocity.x *= -1; }
            if (this.y < 0) { this.y = 0; this.velocity.y *= -1; }
            if (this.y > level.height - this.height) { this.y = level.height - this.height; this.velocity.y *= -1; }
            return;
        }

        // Riding a mover: it already moved this frame, so keep our feet on it
        const ride = this.grounded ? this.ridePlat : null;
        this.ridePlat = null;
        if (ride && ride.motion && ride.active && this.x + this.width > ride.x && this.x < ride.x + ride.width) {
            this.y = ride.y - this.height;
        }

        // Where we were before moving: mover collisions are resolved by which
        // side of the platform we came from (see resolveMover)
        this._ox = this.x; this._oy = this.y; this._og = this.grounded;

        this.velocity.y += this.gravity;
        this.grounded = false; // Reset grounded state
        
        if (!isNaN(this.velocity.x)) this.x += this.velocity.x;
        this.checkCollisions(level, 'x');
        
        if (!isNaN(this.velocity.y)) this.y += this.velocity.y;
        this.checkCollisions(level, 'y');
    }

    checkCollisions(level, axis) {
        // Falling: of every surface our feet passed this frame, land on the
        // highest (the one we'd have hit first), so a fast fall onto a bouncer
        // sitting on the floor bounces instead of sinking into it
        if (axis === 'y' && this.velocity.y > 0) {
            const feet0 = this._oy + this.height;
            let first = null;
            for (const platform of level.platforms) {
                if (!platform.active || platform.motion || !Utils.rectIntersect(this, platform)) continue;
                if (platform.y >= feet0 - 1 && (!first || platform.y < first.y)) first = platform;
            }
            if (first) this.landOn(first);
        }
        for (const platform of level.platforms) {
            if (!platform.active) continue; // Ignore broken platforms
            if (!Utils.rectIntersect(this, platform)) continue;
            if (platform.motion) { this.resolveMover(platform, axis); continue; }
            if (axis === 'x') {
                // Already inside it before we moved (never push through to the far side)
                if (this._ox < platform.x + platform.width && this._ox + this.width > platform.x &&
                    this._oy < platform.y + platform.height && this._oy + this.height > platform.y) {
                    if (this.y + this.height - platform.y <= 24) { this.y = platform.y - this.height; this.velocity.y = Math.min(0, this.velocity.y); }
                    continue;
                }
                if (this.velocity.x > 0) this.x = platform.x - this.width;
                else if (this.velocity.x < 0) this.x = platform.x + platform.width;
                this.velocity.x = 0;
            } else if (this._oy + this.height <= platform.y + 1) {
                if (this.velocity.y > 0) this.landOn(platform);       // came down onto it
            } else if (this._oy >= platform.y + platform.height - 1) {
                this.y = platform.y + platform.height;                 // came up into it: bonk
                if (this.velocity.y < 0) this.velocity.y = 0;
            } else if (!(this._ox < platform.x + platform.width && this._ox + this.width > platform.x)) {
                // Carried into it from the side (riding a mover under a ledge): it's a wall
                this.x = this._ox + this.width / 2 <= platform.x + platform.width / 2 ? platform.x - this.width : platform.x + platform.width;
                this.velocity.x = 0;
            }
        }
    }

    // Feet on top of a platform: bounce off a bouncer, otherwise stand (and ride it)
    landOn(platform) {
        this.y = platform.y - this.height;
        if (platform.type === 'trampoline') {
            // Bounce!
            this.velocity.y = -(platform.power || 15); // Bounce (15 is about 225px high)
            this.grounded = false;
            this.jumpCount = 0;   // a bounce gives your jumps back
            this.launched = true; // and the launch can't be cut short by releasing jump
            platform.shake = 1; // Mat squashes visually
            this.squash = 0.6;
            if (!this.isGhost) AudioSys.playJump(); // Bot simulations stay silent
        } else {
            // Landing impact: squash harder the faster we fell
            if (this.velocity.y > 6) {
                this.squash = Math.min(1, this.velocity.y / 14);
                this.landFx = this.velocity.y; // Game spawns landing dust
            }
            this.grounded = true;
            this.velocity.y = 0;
            this.ridePlat = platform;
        }
        if (platform.motion) this.x += platform.vx;   // carried along
    }

    // Moving platforms: you land on them and ride (a lift rising under your feet
    // carries you up), and you can't jump up through them: your head hits the
    // underside like any other platform. They never shove you sideways, and one
    // sliding down onto someone standing under it just passes through. One
    // sweeping in at foot height scoops you up onto it. Their sides are walls: you can't walk
    // into one, and one sliding into you pushes you along.
    resolveMover(p, axis) {
        const py0 = p.y - (p.vy || 0);
        const feet0 = this._oy + this.height;
        if (feet0 <= Math.max(py0, p.y) + 1) {   // we were on or above its top
            if (axis === 'y') this.landOn(p);
            return;
        }
        if (axis === 'y' && this.velocity.y < 0 && this._oy >= py0 + p.height - 1) {
            this.y = p.y + p.height;              // we were below it and went up into it: bonk
            this.velocity.y = 0;
            return;
        }
        if (axis === 'x' && p.type !== 'trampoline' && this.y + this.height - p.y <= 14 && this.velocity.y >= 0) {
            this.y = p.y - this.height;   // caught our feet: step up and ride
            this.velocity.y = 0;
            this.grounded = true;
            this.ridePlat = p;
            return;
        }
        // A side wall: if we were beside it (not over or under it) before this step, we can't enter it
        // from the side, and one sliding into us pushes us along instead of passing through.
        if (axis === 'x') {
            const px0 = p.x - (p.vx || 0);
            const besideBefore = !(this._ox < px0 + p.width && this._ox + this.width > px0);
            const levelBefore = this._oy < py0 + p.height && feet0 > py0;
            if (besideBefore && levelBefore) {
                this.x = this._ox + this.width / 2 <= px0 + p.width / 2 ? p.x - this.width : p.x + p.width;
                if ((this.x < p.x) === (this.velocity.x > 0) || this.velocity.x === 0) this.velocity.x = 0;
            }
        }
    }

    // Walk over a weapon to pick it up. Already holding one? Crouch on the new
    // one to swap: yours drops at your feet (stand up before swapping again).
    // The Angel Crystal and a flying Nimbus Staff are never swapped away.
    checkWeaponPickup(weapons, players) {
        if (!this.isLaying) this.swapLatch = false;
        if (this.weapon && (!this.isLaying || this.swapLatch || this.isBird || this.onCloud)) return;

        for (let i = 0; i < weapons.length; i++) {
            const w = weapons[i];
            if (w.active && !w.owner && !(w.lock > 0) && Utils.rectIntersect(this, w.box())) {
                if (players && this.outbid(w, players)) continue;
                if (this.weapon) {
                    if (w.type === this.weapon.type) continue;
                    this.dropWeapon();
                    this.swapLatch = true;
                }
                this.weapon = w;
                w.owner = this;
                // Flight gear (crystal, staff) takes off standing: never fly lying down
                if ((w.type === 'bird_crystal' || w.type === 'magic_stick') && this.isLaying) {
                    this.y -= 30; this.height = 60; this.isLaying = false; this.proneW = 0;
                }
                if (w.type === 'bird_crystal') {
                    this.wings = true;
                    this.isBird = true;
                    this.maxHealth = 300; // Boss Health
                    this.health = this.maxHealth; 
                    this.color = '#FFFFFF'; // White Angel
                    AudioSys.playAngelicaFinale(); // Dramatic music
                } else if (w.type === 'magic_stick') {
                    this.onCloud = true;
                    AudioSys.playPowerup();
                }
                break;
            }
        }
    }

    // Two fighters touching the same weapon on the same frame: whoever comes first in the player list must
    // not win by default. A person beats a bot; otherwise the one nearer the weapon takes it.
    outbid(w, players) {
        const box = w.box(), wx = box.x + box.width / 2;
        for (const o of players) {
            if (o === this || o.isDead || o.isGhost) continue;
            if (o.weapon && !(o.isLaying && !o.swapLatch)) continue;     // already armed and not swapping
            if (o.weapon && o.weapon.type === w.type) continue;
            if (!Utils.rectIntersect(o, box)) continue;
            if (!this.isBot !== !o.isBot) { if (!o.isBot) return true; continue; }
            const dOther = Math.abs(o.x + o.width / 2 - wx), dMe = Math.abs(this.x + this.width / 2 - wx);
            if (dOther < dMe) return true;
        }
        return false;
    }

    // Let go of the held weapon at our feet (swapping for another)
    dropWeapon() {
        const w = this.weapon;
        if (!w) return;
        w.owner = null;
        w.active = true;
        w.x = this.x + this.width / 2 - w.width / 2;
        w.y = w.prevY = this.y + this.height - w.height;
        w.landed = false;
        this.weapon = null;
    }

    attack() {
        const def = this.isBird ? null : WeaponDefs.of(this);
        this.attackCooldown = def ? def.cooldown : 20;
        this.attackAnim = 0;
        this.attackDur = Math.max(10, this.attackCooldown);
        if (this.isBird) {
            this.wantsToExplode = true;
            return;
        }
        if (this.weapon) {
            // Use weapon logic (needs reference to game for projectiles)
            // We'll handle this in Game loop or pass Game to update
            // For now, we set a flag or event
            this.wantsToAttack = true; 
        } else {
            // Punch
            // Check for ice breaking
            this.wantsToPunch = true;
        }
    }

    takeDamage(amount, attacker) {
        if (this.shieldActive) amount *= 0.1; // Shield reduces damage
        if (this.isBird) amount *= 0.2; // Bird takes significantly less damage (Boss Mode)
        if (attacker && attacker !== this && !this.isGhost) { this.lastAttacker = attacker; this.lastAttackerAt = performance.now(); }
        const wasDead = this.isDead;
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.health = 0;
            this.isDead = true;
            this.shieldActive = false;   // a held shield must not outlive the fighter
            if (attacker && attacker !== this) {
                attacker.kills++;
            }
            // Drop weapon
            if (this.weapon) {
                this.weapon.owner = null;
                this.weapon.active = true;
                this.weapon.x = this.x;
                this.weapon.y = this.y;
                this.weapon = null;
                this.wings = false;
                this.onCloud = false;
            }
        }
        if (Player.onDamage && !this.isGhost) Player.onDamage(this, amount, attacker, this.shieldActive, !wasDead && this.isDead);
    }
}

Player.STUNNED = Object.freeze({ x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false });
Player.SHIELD_MAX = 60;    // frames a shield can stay up
Player.SHIELD_CD = 120;    // frames to recharge after it drops
Player.IDLE = Object.freeze({ x: 0, y: 0, aimX: 0, aimY: 0, jump: false, attack: false, shield: false, join: false });
