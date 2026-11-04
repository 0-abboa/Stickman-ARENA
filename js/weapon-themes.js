// Weapons that fit an arena's theme drop more often there (an ice wand on the glacier, a lava
// hammer in the volcano). Each weapon gets an affinity 0..3 per theme from what it is: its name,
// its status effects and how its shots look. Weight in a theme = base weight x (1 + 2.2 x affinity).
// The full per-theme ranking is written out in WEAPON_SPAWN_RANKING.md (generated from this file).
(() => {
    // keyword -> affinity, per theme (matched against the weapon key and its name)
    const THEME_WORDS = {
        dirt:    { bow: 2, axe: 2, club: 2, log: 3, trunk: 3, pitch: 3, fork: 2, machete: 2, sling: 1, javelin: 1, tomahawk: 2, thorn: 3, seed: 3, earth: 2, bat: 1, rock: 1, spear: 1, longbow: 3, bolas: 2 },
        stone:   { hammer: 2, sledge: 3, pick: 3, mace: 2, rock: 3, boulder: 3, earth: 3, crusher: 2, morning: 2, flail: 2, shield: 1, broadsword: 1, claymore: 2, halberd: 2, pike: 1, executioner: 1, dynamite: 2, crossbow: 1 },
        ice:     { ice: 3, frost: 3, freeze: 3, snow: 3, snowball: 3, icicle: 3, glacier: 3, mirror: 2, crystal: 2, shard: 2 },
        cloud:   { wind: 3, storm: 3, thunder: 2, cloud: 3, sky: 2, feather: 2, bow: 1, boomerang: 2, chakram: 1, sonic: 2, bubble: 1, star: 1 },
        magic:   { staff: 2, wand: 3, magic: 3, void: 3, gravity: 3, singularity: 3, star: 2, crystal: 2, chrono: 3, time: 3, mirror: 2, plasma: 1, holy: 2, rune: 2, bard: 1, music: 1, ray: 1 },
        neon:    { laser: 3, plasma: 2, rail: 3, glitch: 3, photon: 3, ion: 2, tesla: 2, cyber: 3, neon: 3, ray: 2, sonic: 2, gun: 1, rifle: 1, smg: 1, minigun: 1, burst: 1, swarm: 2, rocket: 1, seeker: 2, drill: 1 },
        lava:    { fire: 3, flame: 3, inferno: 3, meteor: 3, lava: 3, molotov: 3, flare: 3, phoenix: 3, sun: 2, tiger: 2, dynamite: 2, bomb: 1, grenade: 1, rocket: 1, mortar: 1, bazooka: 1, rpg: 1, obsidian: 3, blood: 1 },
        ocean:   { trident: 3, harpoon: 3, anchor: 3, water: 3, bubble: 3, net: 3, coral: 3, shell: 2, wave: 2, cutlass: 3, hook: 2, grapple: 2, musket: 2, blunderbuss: 2, pirate: 3, kraken: 3 },
        candy:   { candy: 3, cane: 3, lollipop: 3, sugar: 3, paint: 3, paintball: 3, bubble: 2, card: 2, trick: 2, squeaky: 3, mallet: 2, music: 2, bard: 2, lute: 2, boxing: 2, coin: 2, gold: 2, confetti: 0, star: 2 },
        haunted: { scythe: 3, reaper: 3, shadow: 3, bone: 3, skull: 2, soul: 3, ghost: 3, venom: 2, poison: 2, kris: 2, blood: 3, moon: 2, wraith: 3, bat: 2, crusher: 2, holy: 2, executioner: 2, chainsaw: 2, pumpkin: 3 }
    };
    // status effects and shot looks that belong to a theme
    const THEME_STATUS = { ice: ['freeze', 'slow'], lava: ['burn'], haunted: ['drain', 'poison'], neon: ['chain', 'stun'], cloud: ['chain'], magic: ['drain'], ocean: ['slow'] };
    const THEME_LOOK = {
        ice: ['shard', 'snow'], lava: ['fire', 'flask', 'shell'], ocean: ['bubble', 'water', 'harpoon', 'net'], candy: ['paint', 'note', 'card', 'coin', 'spin'],
        neon: ['beam', 'rail', 'glitch', 'zap', 'orb'], haunted: ['skull', 'void'], magic: ['void', 'star', 'clock', 'orb'], cloud: ['gust', 'ring', 'zap'], stone: ['rock'], dirt: ['thorn', 'arrow']
    };
    // whole words of the key and the display name ("Venom Kris" -> venom, kris), plurals folded
    const words = (type) => new Set((type + ' ' + ((WEAPONS[type] && WEAPONS[type].name) || '')).toLowerCase().split(/[^a-z]+/).filter(Boolean).flatMap(w => [w, w.replace(/s$/, '')]));

    const cache = {};
    WeaponDefs.affinity = function (type, theme) {
        const key = type + '|' + theme;
        if (cache[key] !== undefined) return cache[key];
        const d = WEAPONS[type];
        if (!d || !theme) return (cache[key] = 0);
        let a = 0;
        const w = words(type), kw = THEME_WORDS[theme] || {};
        for (const k in kw) if (w.has(k)) a = Math.max(a, kw[k]);
        const st = d.status || (d.proj && (d.proj.status || (d.proj.blast && d.proj.blast.status)));
        if (st) for (const s of THEME_STATUS[theme] || []) if (st[s]) a = Math.max(a, s === 'slow' || s === 'stun' || s === 'poison' ? 1 : 2);
        const look = d.proj && d.proj.look && d.proj.look.s;
        if (look && (THEME_LOOK[theme] || []).includes(look)) a = Math.max(a, 1.5);
        return (cache[key] = Math.min(3, a));
    };

    WeaponDefs.themeWeight = function (type, theme) {
        const d = WEAPONS[type];
        if (!d || !d.weight) return 0;
        return d.weight * (1 + 2.2 * WeaponDefs.affinity(type, theme));
    };

    // Chance of each weapon dropping in a theme, highest first: [{ type, name, p }]
    WeaponDefs.ranking = function (theme) {
        const list = Object.keys(WEAPONS).map(t => ({ type: t, name: WEAPONS[t].name, w: WeaponDefs.themeWeight(t, theme) })).filter(e => e.w > 0);
        const total = list.reduce((s, e) => s + e.w, 0);
        return list.map(e => ({ type: e.type, name: e.name, p: e.w / total, affinity: WeaponDefs.affinity(e.type, theme) })).sort((a, b) => b.p - a.p);
    };

    // Weighted random drop, tilted toward the arena's theme
    const base = WeaponDefs.randomType;
    WeaponDefs.randomType = function (theme) {
        if (!theme) return base.call(this);
        let total = 0;
        for (const k in WEAPONS) total += WeaponDefs.themeWeight(k, theme);
        let r = Math.random() * total;
        for (const k in WEAPONS) {
            const w = WeaponDefs.themeWeight(k, theme);
            r -= w;
            if (r <= 0 && w > 0) return k;
        }
        return 'sword';
    };
    WeaponDefs.THEMES = Object.keys(THEME_WORDS);
})();
