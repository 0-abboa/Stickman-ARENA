// Every weapon in the game, as data. Combat (game-combat.js), the held and
// pickup art (weapon-art.js) and the bot's reads all come from this one table,
// so a new weapon only needs an entry here plus its drawing.
//
// kind:  melee  -> hitbox `range` px in front of the body (createMeleeAttack rules)
//        shot   -> fires `proj` from `muzzle` = [forward from center, down from top]
//        beam   -> instant laser (Nimbus Staff, rides a cloud)
//        special-> Angel Crystal (turns the holder into the angel)
// hold:  how the stickman holds/animates it (see player-anim.js)
const RARITY = {
    common:    { color: '#e8edf2', glow: '230,240,255' },
    rare:      { color: '#4fc3f7', glow: '79,195,247' },
    epic:      { color: '#ce93d8', glow: '206,147,216' },
    legendary: { color: '#ffca28', glow: '255,202,40' }
};

// Bare fists follow the same melee rules as weapons
const PUNCH = { name: 'Fists', kind: 'melee', hold: 'fist', range: 40, damage: 5, knock: 10, lift: -5, cooldown: 20 };

const WEAPONS = {
    sword: {
        name: 'Sword', kind: 'melee', hold: 'blade', range: 60, damage: 25, knock: 10, lift: -5,
        cooldown: 20, durability: 20, rarity: 'rare', weight: 3, value: 75
    },
    katana: {
        name: 'Katana', kind: 'melee', hold: 'blade', range: 55, damage: 13, knock: 8, lift: -4,
        cooldown: 11, durability: 30, rarity: 'rare', weight: 3, value: 72
    },
    spear: {
        name: 'Spear', kind: 'melee', hold: 'pole', range: 88, damage: 16, knock: 12, lift: -3,
        cooldown: 24, durability: 20, rarity: 'common', weight: 3, value: 70
    },
    hammer: {
        name: 'War Hammer', kind: 'melee', hold: 'heavy', range: 52, damage: 30, knock: 18, lift: -9,
        cooldown: 36, durability: 14, rarity: 'epic', weight: 2, value: 85, heavy: true
    },
    shooter: {
        name: 'Pistol', kind: 'shot', hold: 'gun', cooldown: 20, durability: 20, recoil: 2,
        rarity: 'common', weight: 3, value: 45, muzzle: [22, 22],
        proj: { type: 'bullet', speed: 10, damage: 10, knock: 5, size: 10, life: 100, solid: true }
    },
    smg: {
        name: 'SMG', kind: 'shot', hold: 'gun', cooldown: 6, durability: 60, recoil: 0.6, spread: 0.07,
        rarity: 'rare', weight: 2.5, value: 60, muzzle: [24, 22],
        proj: { type: 'bullet', speed: 14, damage: 4, knock: 2, size: 8, life: 70, solid: true }
    },
    shotgun: {
        name: 'Shotgun', kind: 'shot', hold: 'gun', cooldown: 32, durability: 8, recoil: 5, pellets: 6, spread: 0.24,
        rarity: 'rare', weight: 2.5, value: 62, muzzle: [26, 22],
        proj: { type: 'pellet', speed: 13, damage: 6, knock: 4, size: 8, life: 26, solid: true }
    },
    sniper: {
        name: 'Sniper', kind: 'shot', hold: 'gun', cooldown: 55, durability: 6, recoil: 4,
        rarity: 'epic', weight: 1.5, value: 70, muzzle: [34, 20],
        proj: { type: 'sniper', speed: 34, damage: 35, knock: 9, size: 8, life: 45, solid: true }
    },
    bow: {
        name: 'Bow', kind: 'shot', hold: 'bow', cooldown: 26, durability: 16,
        rarity: 'common', weight: 2.5, value: 58, muzzle: [20, 18],
        proj: { type: 'arrow', speed: 15, lift: -1.5, gravity: 0.18, damage: 20, knock: 6, size: 10, life: 120, solid: true }
    },
    grenade: {
        name: 'Grenade Launcher', kind: 'shot', hold: 'gun', cooldown: 40, durability: 6, recoil: 3,
        rarity: 'epic', weight: 1.5, value: 72, muzzle: [24, 18],
        proj: {
            type: 'grenade', speed: 9, lift: -5, gravity: 0.32, damage: 0, knock: 0, size: 12, life: 100,
            solid: true, bounces: 1, blast: { radius: 85, damage: 22, knock: 14 }
        }
    },
    rocket: {
        name: 'Rocket Launcher', kind: 'shot', hold: 'gun', cooldown: 60, durability: 4, recoil: 3,
        rarity: 'legendary', weight: 1, value: 80, muzzle: [30, 14],
        proj: {
            type: 'rocket', speed: 5, accel: 0.5, maxSpeed: 17, damage: 0, knock: 0, size: 12, life: 150,
            solid: true, blast: { radius: 100, damage: 28, knock: 17 }
        }
    },
    dagger: {
        name: 'Getsuga Blade', kind: 'shot', hold: 'blade', cooldown: 20, durability: 30,
        rarity: 'epic', weight: 2, value: 65, muzzle: [30, 20],
        proj: { type: 'shockwave', speed: 15, damage: 10, knock: 5, size: 10, life: 100, solid: false }
    },
    boomerang: {
        name: 'Boomerang', kind: 'shot', hold: 'throw', cooldown: 30, durability: 20, oneAtATime: true,
        rarity: 'rare', weight: 2, value: 55, muzzle: [16, 18],
        proj: { type: 'boomerang', speed: 13, returnAccel: 0.32, damage: 12, knock: 6, size: 18, life: 150, solid: false, pierce: true }
    },
    // ---- Second wave ----
    axe: {
        name: 'Battle Axe', kind: 'melee', hold: 'heavy', range: 56, damage: 24, knock: 15, lift: -7,
        cooldown: 30, durability: 16, rarity: 'epic', weight: 2.5, value: 82, heavy: true
    },
    scythe: {
        name: 'Reaper Scythe', kind: 'melee', hold: 'pole', range: 84, damage: 18, knock: 6, lift: -11,
        cooldown: 26, durability: 18, rarity: 'epic', weight: 2, value: 80
    },
    bat: {
        name: 'Slugger Bat', kind: 'melee', hold: 'heavy', range: 50, damage: 9, knock: 21, lift: -6,
        cooldown: 28, durability: 18, rarity: 'rare', weight: 2.5, value: 74
    },
    rapier: {
        name: 'Rapier', kind: 'melee', hold: 'pole', range: 74, damage: 8, knock: 5, lift: -2,
        cooldown: 8, durability: 40, rarity: 'rare', weight: 3, value: 66
    },
    gauntlet: {
        name: 'Power Gauntlet', kind: 'melee', hold: 'fist', range: 44, damage: 15, knock: 17, lift: -8,
        cooldown: 16, durability: 25, rarity: 'epic', weight: 2, value: 78
    },
    revolver: {
        name: 'Revolver', kind: 'shot', hold: 'gun', cooldown: 26, durability: 12, recoil: 3,
        rarity: 'rare', weight: 2.5, value: 60, muzzle: [24, 22],
        proj: { type: 'bullet', speed: 16, damage: 17, knock: 7, size: 10, life: 80, solid: true }
    },
    minigun: {
        name: 'Minigun', kind: 'shot', hold: 'gun', cooldown: 3, durability: 90, recoil: 0.35, spread: 0.14,
        rarity: 'epic', weight: 1.5, value: 76, muzzle: [34, 26],
        proj: { type: 'bullet', speed: 15, damage: 3, knock: 1.5, size: 8, life: 55, solid: true }
    },
    crossbow: {
        name: 'Crossbow', kind: 'shot', hold: 'gun', cooldown: 34, durability: 12,
        rarity: 'rare', weight: 2, value: 64, muzzle: [26, 20],
        proj: { type: 'bolt', speed: 21, gravity: 0.06, damage: 24, knock: 8, size: 10, life: 70, solid: true, pierce: true }
    },
    kunai: {
        name: 'Kunai', kind: 'shot', hold: 'throw', cooldown: 24, durability: 15, pellets: 3, spread: 0.22,
        rarity: 'rare', weight: 2.5, value: 60, muzzle: [16, 18],
        proj: { type: 'kunai', speed: 15, gravity: 0.05, damage: 8, knock: 3, size: 9, life: 60, solid: true }
    },
    flamethrower: {
        name: 'Flamethrower', kind: 'shot', hold: 'gun', cooldown: 3, durability: 70, spread: 0.18,
        rarity: 'epic', weight: 1.5, value: 74, muzzle: [34, 24],
        proj: { type: 'flame', speed: 8, gravity: -0.05, drag: 0.95, damage: 1.6, knock: 0.8, size: 22, life: 26, solid: true, pierce: true }
    },
    plasma: {
        name: 'Plasma Rifle', kind: 'shot', hold: 'gun', cooldown: 16, durability: 18, recoil: 1,
        rarity: 'epic', weight: 2, value: 72, muzzle: [30, 22],
        proj: { type: 'plasma', speed: 18, damage: 13, knock: 6, size: 14, life: 60, solid: true, bounces: 2, elastic: 1 }
    },
    bomb: {
        name: 'Bouncy Bomb', kind: 'shot', hold: 'throw', cooldown: 36, durability: 6,
        rarity: 'rare', weight: 2, value: 66, muzzle: [16, 16],
        proj: {
            type: 'bomb', speed: 8, lift: -6, gravity: 0.3, damage: 0, knock: 0, size: 14, life: 90,
            solid: true, bounces: 8, elastic: 0.78, blast: { radius: 90, damage: 24, knock: 16 }
        }
    },
    seeker: {
        name: 'Seeker Missile', kind: 'shot', hold: 'gun', cooldown: 55, durability: 4, recoil: 2,
        rarity: 'legendary', weight: 1, value: 84, muzzle: [30, 14],
        proj: {
            type: 'seeker', speed: 6, accel: 0.25, maxSpeed: 11, homing: 0.07, damage: 0, knock: 0, size: 12, life: 170,
            solid: true, blast: { radius: 80, damage: 20, knock: 14 }
        }
    },
    magic_stick: {
        name: 'Nimbus Staff', kind: 'beam', hold: 'staff', cooldown: 20, durability: 40,   // unlimited only while an angel lives (see Game.updateAngelState)
        rarity: 'legendary', weight: 4.5, value: 120, beam: { length: 400, height: 10, damage: 15 }
    },
    bird_crystal: {
        name: 'Angel Crystal', kind: 'special', hold: 'none', cooldown: 20, durability: Infinity,
        rarity: 'legendary', weight: 0, value: 1000
    }
};

const WeaponDefs = {
    get(type) { return WEAPONS[type] || null; },

    // Definition of whatever a body (Player or perceived snapshot) attacks with
    of(body) {
        const w = body.weapon;
        const type = typeof w === 'string' ? w : (w ? w.type : null);
        return (type && WEAPONS[type]) || PUNCH;
    },

    typeOf(body) {
        const w = body.weapon;
        return typeof w === 'string' ? w : (w ? w.type : null);
    },

    isShot(type) { return !!(WEAPONS[type] && WEAPONS[type].kind === 'shot'); },

    // Extra damage per second a status effect is worth (burns and poison tick; freezes,
    // stuns and slows open the target up; chains hit a second body; drain heals us)
    statusDps(st) {
        if (!st) return 0;
        return (st.burn ? st.burn / 60 * 4 : 0) + (st.poison ? st.poison / 60 * 2.5 : 0) + (st.freeze ? st.freeze / 10 : 0) +
               (st.stun ? st.stun / 6 : 0) + (st.slow ? st.slow / 20 : 0) + (st.chain ? st.chain.n * st.chain.dmg * 0.4 : 0) + (st.drain ? 6 * st.drain : 0);
    },

    // How far in front of the body a melee swing reaches (a lunge adds to it)
    reach(def) { return def.range + (def.dash ? def.dash * 4 : 0); },

    // Weighted random pick for the regular weapon drops
    randomType() {
        let total = 0;
        for (const k in WEAPONS) total += WEAPONS[k].weight;
        let r = Math.random() * total;
        for (const k in WEAPONS) {
            r -= WEAPONS[k].weight;
            if (r <= 0 && WEAPONS[k].weight > 0) return k;
        }
        return 'sword';
    },

    // How far a shot really travels before it lands, expires or turns back,
    // measured once by simulating it over flat ground (the bot fights at this range)
    range(def) {
        if (def._range !== undefined) return def._range;
        const spec = def.proj;
        if (!spec) return (def._range = 0);
        const floor = { x: -1e6, y: 60 - def.muzzle[1], width: 2e6, height: 50, active: true, type: 'static' };
        const level = { width: 1e6, height: 1e6, platforms: [floor] };
        const s = { x: 0, y: 0, vx: spec.speed, vy: spec.lift || 0, vx0: spec.speed, life: spec.life, age: 0,
                    spec, owner: null, returning: false, bounces: 0 };
        let far = 0;
        for (let k = 0; k < spec.life; k++) {
            const ev = Projectile.step(s, level);
            far = Math.max(far, s.x);
            if ((ev && ev !== 'bounce') || s.returning) break;
        }
        return (def._range = far);
    },

    // Where a shot leaves the gun. Measured from the body's top, so a crouched
    // shooter (shorter body) fires low enough to hit crouching targets too.
    muzzle(body, def) {
        return { x: body.x + body.width / 2 + body.facing * def.muzzle[0], y: body.y + def.muzzle[1] };
    }
};
