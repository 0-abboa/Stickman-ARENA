// The backdrops: 15 variants, three per arena material (the material still decides
// the platform art and ice-breaking; the variant is only the scenery behind it).
// Each is a palette plus a recipe read by BackdropLayers.plan() in backdrop-layers.js:
//   ridges  a stack of n silhouettes from far (haze-coloured) to near (dark), with
//           decorations chosen by depth t (0 far .. 1 near)
//   ceil    the same for cave ceilings      extras  landmarks / islands / asteroids
//   clouds  drifting soft cloud bands        mist    drifting haze    parts  particles
//   ground  the strip behind the fighters    fg      opaque edge props in front
const CLOUDS_WHITE = { shade: '150,175,205', hi: '255,255,255', lo: '235,242,250' };
const cloudBands = (a, y, v) => [
    { f: 0.04, n: 5, s: [0.4, 0.7], a: a * 0.6, v: v * 0.5, y: [y[0], y[1] - 0.06] },
    { f: 0.11, n: 5, s: [0.6, 1.0], a: a * 0.8, v: v * 0.7, y: [y[0] + 0.03, y[1]] },
    { f: 0.2, n: 4, s: [0.8, 1.2], a: a, v: v, y: [y[0], y[1] + 0.04] },
    { f: 0.28, n: 3, s: [0.9, 1.4], a: a, v: v * 1.2, y: [y[0], y[1] + 0.02] },
    { f: 0.36, n: 3, s: [1.0, 1.5], a: a, v: v * 1.4, y: [y[0] - 0.02, y[1]] },
    { f: 0.58, n: 2, s: [1.3, 1.9], a: a * 0.8, v: v * 1.7, y: [y[0] - 0.02, y[1] - 0.04] }
];
const mistBands = (rgb, a, y) => [
    { f: 0.16, y: [y[0], y[1]], rgb, a: a * 0.9, n: 3 },
    { f: 0.27, y: [y[0] + 0.04, y[1] + 0.04], rgb, a, n: 3 },
    { f: 0.38, y: [y[0] + 0.1, y[1] + 0.1], rgb, a: a * 0.9, n: 2 },
    { f: 0.5, y: [0.8, 0.92], rgb, a: a * 0.9, n: 2 },
    { f: 0.66, y: [0.84, 0.95], rgb, a: a * 0.8, n: 2 }
];

const BG_VARIANTS = {
    dirt: [
        {
            name: 'Golden Meadow',
            sky: [[0, '#1d4e8f'], [0.45, '#5aa0dc'], [0.82, '#f5c27a'], [1, '#fde6b4']],
            body: { kind: 'sun', x: 0.76, y: 0.3, r: 46, rgb: '255,238,175' }, haze: '253,230,180', cloudTint: CLOUDS_WHITE,
            ridges: {
                n: 12, base: [0.58, 0.88], amp: [0.2, 0.045], oct: [5, 3], far: ['#a9c0e1', '#cddbed'], near: ['#3f7a3a', '#244d24'], fog: [0.45, 0.06], snow: 2, windmill: true,
                deco: (t) => t < 0.25 ? null : t < 0.5 ? { k: 'pine', n: 80, h: 20, c: '#6f93a0' } : t < 0.75 ? { k: 'round', n: 40, h: 16, c: '#5f8f58' } : { k: 'pine', n: 50, h: 46, c: '#2a5628' }
            },
            mid: 'meadow', midF: 0.31,
            clouds: cloudBands(0.85, [0.06, 0.34], 0.07), mist: mistBands('253,238,205', 0.2, [0.62, 0.74]),
            parts: [{ kind: 'mote', n: [30, 12], rgb: '255,248,200', rise: -0.1 }, { kind: 'leaf', n: [8, 6], cols: ['#7cb342', '#aed581', '#f9a825'] }],
            ambient: { rays: true, birds: 5 },
            ground: { top: '#255c2a', bot: '#10331a', tufts: 'grass' },
            fg: { top: { k: 'leaves', c: ['#2f6b2d', '#3d8a36', '#6fb04a'] }, bottom: { k: 'grass', c: ['#1d5a22', '#2f7d32', '#4caf50', '#154a1c'] } }
        },
        {
            name: 'Autumn Forest',
            sky: [[0, '#2b3a67'], [0.38, '#b8607a'], [0.72, '#f2a65a'], [1, '#ffd9a0']],
            body: { kind: 'sun', x: 0.3, y: 0.42, r: 58, rgb: '255,205,140' }, haze: '255,190,130',
            cloudTint: { shade: '190,110,110', hi: '255,225,190', lo: '245,190,160' },
            ridges: {
                n: 12, base: [0.58, 0.88], amp: [0.19, 0.05], oct: [5, 3], far: ['#c38a96', '#e6b3a0'], near: ['#5a2a1c', '#341710'], fog: [0.5, 0.06],
                deco: (t) => t < 0.2 ? null : t < 0.55 ? { k: 'round', n: 90, h: 18, c: ['#d9541e', '#f29f1d', '#b5382a', '#e8c33a'] }
                    : t < 0.8 ? [{ k: 'round', n: 50, h: 34, c: ['#d9541e', '#f29f1d', '#b5382a', '#e8c33a'] }, { k: 'pine', n: 14, h: 40, c: '#3a2a14' }]
                        : [{ k: 'deadtree', n: 22, h: 60, c: '#2a1209' }, { k: 'round', n: 20, h: 54, c: ['#b5382a', '#d9541e'] }]
            },
            extras: [{ k: 'landmark', kind: 'cabin', f: 0.4, x: 0.66, y: 0.85, size: 38, c: ['#5a2a1c', '#7a4a2a'], base: '#3b1c10' }],
            clouds: cloudBands(0.8, [0.06, 0.34], 0.07), mist: mistBands('255,200,150', 0.2, [0.62, 0.74]),
            parts: [{ kind: 'leaf', n: [14, 9], cols: ['#d9541e', '#f29f1d', '#b5382a', '#e8c33a'] }, { kind: 'mote', n: [22, 8], rgb: '255,210,140', rise: -0.08 }],
            ambient: { rays: true, rayRgb: '255,200,140', birds: 3 },
            ground: { top: '#6b3a1c', bot: '#2f170b', tufts: 'leaves', c: ['#8a5a2a', '#a86a2a', '#5a3a1a'], litter: ['#d9541e', '#f29f1d', '#b5382a', '#e8c33a'] },
            fg: { top: { k: 'leaves', c: ['#c2421a', '#e8891d', '#a8321e', '#e8c33a'] }, bottom: { k: 'leafLitter', c: ['#5a3a1a', '#d9541e', '#f29f1d', '#b5382a'] } }
        },
        {
            name: 'Desert Mesas',
            sky: [[0, '#2468b8'], [0.5, '#79b8e8'], [0.85, '#fbe3b0'], [1, '#fff0cf']],
            body: { kind: 'sun', x: 0.7, y: 0.26, r: 64, rgb: '255,246,200' }, haze: '255,226,170', cloudTint: CLOUDS_WHITE,
            ridges: {
                n: 12, base: [0.54, 0.88], amp: [0.16, 0.05], oct: [3, 3], far: ['#d9a47a', '#ecc8a0'], near: ['#b4743a', '#7a4a22'], fog: [0.5, 0.08],
                shape: (t) => t < 0.45 ? 'mesas' : 'dunes',
                deco: (t) => t < 0.45 ? null : t < 0.85 ? [{ k: 'cactus', n: 6, h: 32, c: '#3f7a3a' }, { k: 'rock', n: 12, h: 12, c: '#8a5a2a' }] : { k: 'cactus', n: 5, h: 48, c: '#2f6a30' }
            },
            extras: [{ k: 'landmark', kind: 'pyramid', f: 0.2, x: 0.28, y: 0.6, size: 84, c: ['#e8bc80', '#b8864a'], base: '#dba86a' },
                     { k: 'landmark', kind: 'pyramid', f: 0.15, x: 0.7, y: 0.58, size: 52, c: ['#e8bc80', '#b8864a'], base: '#dfb078' }],
            clouds: cloudBands(0.45, [0.05, 0.3], 0.06), mist: mistBands('255,226,170', 0.22, [0.62, 0.76]),
            parts: [{ kind: 'dust', n: [16, 8], rgb: '235,205,150' }, { kind: 'mote', n: [14, 6], rgb: '255,240,190', rise: -0.06 }],
            ambient: { rays: true, birds: 2 },
            ground: { top: '#d8a860', bot: '#a8732c', tufts: 'sand', c: '#8a5a2a' },
            fg: { top: null, bottom: { k: 'cactus', c: ['#3f7a3a', '#9a6a3a'] } }
        }
    ],
    stone: [
        {
            name: 'Dusk Fortress',
            sky: [[0, '#0e0f24'], [0.4, '#2a2954'], [0.78, '#6f4a73'], [1, '#c98f7a']],
            body: { kind: 'moon', x: 0.22, y: 0.24, r: 30, rgb: '235,225,255' }, haze: '201,143,122', stars: 140,
            cloudTint: { shade: '60,50,90', hi: '150,135,185', lo: '110,95,150' },
            ridges: {
                n: 12, base: [0.5, 0.86], amp: [0.22, 0.05], oct: [5, 3], far: ['#4b4676', '#6d5a84'], near: ['#161530', '#0d0c22'], fog: [0.4, 0.08],
                deco: (t) => t < 0.2 ? null : t < 0.45 ? { k: 'tower', n: 5, h: 70, c: '#2e2a52' } : t < 0.7 ? { k: 'deadtree', n: 30, h: 40, c: '#272347' } : { k: 'deadtree', n: 34, h: 62, c: '#161530' }
            },
            mid: 'fortress', midF: 0.3,
            clouds: cloudBands(0.32, [0.06, 0.34], 0.06), mist: mistBands('190,170,220', 0.17, [0.62, 0.76]),
            parts: [{ kind: 'ember', n: [18, 10], rgb: '255,150,70' }],
            ambient: {},
            ground: { top: '#12112b', bot: '#08071a', tufts: 'rocks', c: '#1d1b3e', glow: true },
            fg: { top: { k: 'branches', c: ['#0a0918'] }, bottom: { k: 'rocks', c: ['#0a0918', '#1a1838'] } }
        },
        {
            name: 'Overgrown Ruins',
            sky: [[0, '#0a1d2b'], [0.45, '#1d4a52'], [0.8, '#5f9a82'], [1, '#d2e4a8']],
            body: { kind: 'moon', x: 0.3, y: 0.22, r: 34, rgb: '230,245,225' }, haze: '150,200,170', stars: 90,
            cloudTint: { shade: '30,70,70', hi: '170,220,200', lo: '110,170,150' },
            ridges: {
                n: 12, base: [0.56, 0.87], amp: [0.18, 0.05], oct: [5, 3], far: ['#3a6b66', '#5a8c7c'], near: ['#0d2822', '#08181a'], fog: [0.5, 0.07],
                deco: (t) => t < 0.2 ? null : t < 0.5 ? [{ k: 'pillar', n: 12, h: 50, c: '#2c5650' }, { k: 'arch', n: 3, h: 60, c: '#2a504a' }]
                    : t < 0.8 ? [{ k: 'pillar', n: 10, h: 62, c: '#1e403b' }, { k: 'round', n: 40, h: 28, c: '#173a30' }] : { k: 'round', n: 28, h: 52, c: '#10291f' }
            },
            extras: [{ k: 'landmark', kind: 'temple', f: 0.26, x: 0.62, y: 0.74, size: 100, c: ['#2a4f49', '#1c3a36'], base: '#1f4540' }],
            clouds: cloudBands(0.3, [0.06, 0.32], 0.05), mist: mistBands('150,210,180', 0.2, [0.62, 0.76]),
            parts: [{ kind: 'firefly', n: [22, 10] }, { kind: 'mote', n: [12, 6], rgb: '200,255,200', rise: -0.05 }],
            ambient: {},
            ground: { top: '#143a33', bot: '#08201c', tufts: 'moss', c: '#254c46' },
            fg: { top: { k: 'vines', c: ['#1f5a3a', '#2d7a48', '#3a9a5a'] }, bottom: { k: 'rocks', c: ['#1a3a36', '#244a44'] } }
        },
        {
            name: 'Volcanic Crag',
            sky: [[0, '#1a0606'], [0.4, '#5a1409'], [0.75, '#d4561c'], [1, '#ffb347']],
            body: { kind: 'sun', x: 0.52, y: 0.6, r: 36, rgb: '255,150,70' }, haze: '255,110,50',
            cloudTint: { shade: '60,20,15', hi: '150,70,50', lo: '110,45,30' },
            ridges: {
                n: 12, base: [0.56, 0.88], amp: [0.22, 0.06], oct: [6, 4], far: ['#6a2a1a', '#9a4a24'], near: ['#120505', '#080202'], fog: [0.5, 0.1], lava: true,
                deco: (t) => t < 0.3 ? null : t < 0.7 ? { k: 'rockSpike', n: 16, h: 50, c: '#2a0f0a' } : { k: 'rockSpike', n: 15, h: 66, c: '#0f0404' }
            },
            extras: [{ k: 'landmark', kind: 'volcano', f: 0.22, x: 0.5, y: 0.66, size: 150, c: ['#3a1a12', '#1a0a08'] },
                     { k: 'landmark', kind: 'volcano', f: 0.15, x: 0.14, y: 0.64, size: 90, c: ['#4a2216', '#2a120c'] }],
            clouds: cloudBands(0.5, [0.05, 0.3], 0.06), mist: mistBands('255,100,50', 0.18, [0.62, 0.78]),
            parts: [{ kind: 'ember', n: [30, 18], rgb: '255,140,60' }, { kind: 'ash', n: [14, 8] }],
            ambient: {},
            ground: { top: '#2a0e09', bot: '#0e0403', tufts: 'lava', c: '#1a0a08' },
            fg: { top: null, bottom: { k: 'lava', c: ['#1a0a08', '#2a0f0a'] } }
        }
    ],
    ice: [
        {
            name: 'Aurora Glacier',
            sky: [[0, '#020617'], [0.45, '#071d44'], [0.8, '#11466f'], [1, '#2a7fae']],
            body: { kind: 'moon', x: 0.8, y: 0.2, r: 24, rgb: '220,240,255' }, haze: '120,190,230', stars: 220,
            cloudTint: { shade: '120,160,205', hi: '235,246,255', lo: '190,220,245' },
            ridges: {
                n: 12, base: [0.5, 0.86], amp: [0.24, 0.05], oct: [5, 3], far: ['#7ba7d4', '#abcbe9'], near: ['#a8cde8', '#d4e8f6'], fog: [0.4, 0.06], snow: 2,
                deco: (t) => t < 0.2 ? null : t < 0.5 ? { k: 'iceSpire', n: 40, h: 54, c: '#b7d8f2' } : t < 0.75 ? { k: 'pine', n: 60, h: 32, c: '#4d7ca4' } : { k: 'snowPine', n: 40, h: 56, c: '#3a6a93' }
            },
            mid: 'glacier', midF: 0.3,
            clouds: cloudBands(0.16, [0.08, 0.34], 0.04), mist: mistBands('180,215,245', 0.2, [0.62, 0.78]),
            parts: [{ kind: 'snow', n: [56, 32] }],
            ambient: { aurora: true, shooting: true },
            ground: { top: '#d5eafa', bot: '#9bc3e3', tufts: 'snow' },
            fg: { top: { k: 'icicles', c: ['#e8f6ff', '#8fc8ee'] }, bottom: { k: 'snow', c: ['#f4f9ff', '#bfe2f7'] } }
        },
        {
            name: 'Frozen Forest',
            sky: [[0, '#030b1f'], [0.4, '#0d2a52'], [0.75, '#2d6a96'], [1, '#9fd0e8']],
            body: { kind: 'moon', x: 0.28, y: 0.2, r: 28, rgb: '235,245,255' }, haze: '150,200,235', stars: 120,
            cloudTint: { shade: '90,130,180', hi: '220,238,255', lo: '170,205,235' },
            ridges: {
                n: 12, base: [0.55, 0.88], amp: [0.17, 0.05], oct: [5, 3], far: ['#5f86b8', '#86a9cc'], near: ['#0d2a46', '#071a2e'], fog: [0.5, 0.07],
                deco: (t) => t < 0.15 ? null : t < 0.5 ? { k: 'snowPine', n: 110, h: 16, c: '#5a7aa6' } : t < 0.8 ? { k: 'snowPine', n: 90, h: 30, c: '#244a74' } : { k: 'snowPine', n: 60, h: 56, c: '#0f2a46' }
            },
            extras: [{ k: 'landmark', kind: 'cabin', f: 0.38, x: 0.35, y: 0.82, size: 40, c: ['#2a1d14', '#4a3a2a'], base: '#0f2a46' }],
            clouds: cloudBands(0.2, [0.08, 0.3], 0.04), mist: mistBands('170,210,240', 0.2, [0.62, 0.78]),
            parts: [{ kind: 'snow', n: [64, 36] }],
            ambient: { shooting: true },
            ground: { top: '#e8f2fc', bot: '#a9cfe8', tufts: 'snow' },
            fg: { top: { k: 'snowBranch', c: ['#1f4a3c'] }, bottom: { k: 'snow', c: ['#f4f9ff', '#bfe2f7'] } }
        },
        {
            name: 'Crystal Cavern',
            sky: [[0, '#02040d'], [0.5, '#0a1b3a'], [0.8, '#133a66'], [1, '#1c5c8c']],
            body: null, haze: '70,150,220', cloudTint: { shade: '20,50,90', hi: '90,170,230', lo: '50,110,170' },
            ridges: {
                n: 9, base: [0.62, 0.9], amp: [0.14, 0.05], oct: [5, 3], far: ['#1b4a7a', '#2b6aa0'], near: ['#08162a', '#040b18'], fog: [0.5, 0.1],
                deco: (t) => t < 0.1 ? null : { k: 'crystal', n: 16, h: 40 + t * 30, c: ['#4fc3f7', '#81d4fa', '#26c6da'] }
            },
            ceil: {
                n: 8, base: [0.05, 0.22], amp: [0.1, 0.12], far: ['#1b4a7a', '#2b6aa0'], near: ['#050d1c', '#020610'], fog: [0.5, 0.1],
                deco: (t) => [{ k: 'stalactite', n: 26, h: 60 + t * 60, c: '#2a5a8a' }, { k: 'hangCrystal', n: 8, h: 40, c: '#6fd6ff' }]
            },
            extras: [{ k: 'landmark', kind: 'glowCrystals', f: 0.22, x: 0.5, y: 0.8, size: 96, c: ['#4fc3f7', '#26c6da', '#81d4fa'] }],
            mist: mistBands('70,170,230', 0.22, [0.6, 0.78]),
            parts: [{ kind: 'sparkle', n: [34, 18], rgb: '120,220,255' }, { kind: 'mote', n: [16, 8], rgb: '150,230,255', rise: -0.05 }],
            ambient: {},
            ground: { top: '#0d2a4a', bot: '#061426', tufts: 'crystals', c: ['#4fc3f7', '#26c6da'] },
            fg: { top: { k: 'stalactites', c: ['#1a3a5e'] }, bottom: { k: 'upCrystals', c: ['#4fc3f7', '#26c6da', '#81d4fa'] } }
        }
    ],
    cloud: [
        {
            name: 'Sky Kingdom',
            sky: [[0, '#0f5bb5'], [0.5, '#4aa3ec'], [0.85, '#a9d6f7'], [1, '#fff1dc']],
            body: { kind: 'sun', x: 0.25, y: 0.22, r: 56, rgb: '255,250,225' }, haze: '255,241,220', cloudTint: CLOUDS_WHITE,
            ridges: {
                n: 9, base: [0.6, 0.88], amp: [0.14, 0.05], oct: [4, 3], far: ['#dfeaf8', '#f1f6fc'], near: ['#a9c3e2', '#7ea2cc'], fog: [0.35, 0.05], shape: 'cloudbank',
                deco: { k: 'puff', n: 34, h: 26, c: '#ffffff' }
            },
            mid: 'islands', midF: 0.3,
            extras: [
                { k: 'islands', f: 0.12, n: 8, w: [40, 70], y: [0.16, 0.5], fog: ['255,241,220', 0.5] },
                { k: 'islands', f: 0.2, n: 6, w: [60, 100], y: [0.24, 0.6], fog: ['255,241,220', 0.36] },
                { k: 'islands', f: 0.4, n: 4, w: [110, 170], y: [0.4, 0.74], fog: ['255,241,220', 0.1], fall: true }
            ],
            clouds: cloudBands(0.55, [0.06, 0.42], 0.08), mist: mistBands('255,245,230', 0.16, [0.62, 0.76]),
            parts: [{ kind: 'wisp', n: [6, 4] }, { kind: 'mote', n: [16, 8], rgb: '255,255,240', rise: -0.08 }],
            ambient: { rays: true, birds: 4 },
            ground: { top: '#ffffff', bot: '#d9e9fb', tufts: 'puffs', c: '#ffffff' },
            fg: { top: { k: 'puffs', c: ['#ffffff', '#e6f0fc'] }, bottom: { k: 'cloudPuffs', c: ['#ffffff', '#e6f0fc', '#cfe0f5'] } }
        },
        {
            name: 'Sunset Skies',
            sky: [[0, '#2a1456'], [0.35, '#c2468f'], [0.65, '#ff8a5c'], [1, '#ffd27a']],
            body: { kind: 'sun', x: 0.5, y: 0.64, r: 80, rgb: '255,214,140' }, haze: '255,170,130',
            cloudTint: { shade: '190,90,130', hi: '255,220,190', lo: '250,160,150' },
            ridges: {
                n: 9, base: [0.58, 0.88], amp: [0.14, 0.05], oct: [4, 3], far: ['#ee9aa8', '#f8c0a8'], near: ['#5a2a64', '#3a1a4a'], fog: [0.5, 0.08], shape: 'cloudbank',
                deco: { k: 'puff', n: 34, h: 26, c: '#e88aa0' }
            },
            extras: [
                { k: 'islands', f: 0.18, n: 6, w: [50, 90], y: [0.3, 0.58], style: 'silhouette', cols: { top: '#3a1a4a', rockTop: '#4a2458', rockBot: 'rgba(40,20,60,0.4)' }, fog: ['255,170,130', 0.4] },
                { k: 'landmark', kind: 'lighthouse', f: 0.34, x: 0.78, y: 0.8, size: 64, c: ['#e8d8d0', '#c0405a'], base: '#3a1a4a' },
                { k: 'islands', f: 0.4, n: 4, w: [90, 150], y: [0.46, 0.76], style: 'silhouette', cols: { top: '#2a1240', rockTop: '#3a1a4a', rockBot: 'rgba(30,10,50,0.4)' }, fog: ['255,170,130', 0.1] }
            ],
            clouds: cloudBands(0.8, [0.08, 0.5], 0.08), mist: mistBands('255,180,140', 0.16, [0.62, 0.76]),
            parts: [{ kind: 'sparkle', n: [20, 10], rgb: '255,190,150' }],
            ambient: { rays: true, rayRgb: '255,200,150', birds: 4 },
            ground: { top: '#4a2060', bot: '#2a1040', tufts: 'puffs', c: '#7a3a7a' },
            fg: { top: { k: 'puffs', c: ['#6a2a6a', '#8a3a7a'] }, bottom: { k: 'cloudPuffs', c: ['#5a2a6a', '#7a3a7a'] } }
        },
        {
            name: 'Storm Isles',
            sky: [[0, '#0b1220'], [0.4, '#1d2b44'], [0.75, '#3a4d6b'], [1, '#5d7490']],
            body: null, haze: '120,140,170', cloudTint: { shade: '30,38,58', hi: '110,125,155', lo: '70,85,115' },
            ridges: {
                n: 9, base: [0.52, 0.88], amp: [0.16, 0.05], oct: [4, 3], far: ['#4a5a78', '#6a7a96'], near: ['#1a2438', '#0e1522'], fog: [0.5, 0.08], shape: 'cloudbank',
                deco: { k: 'puff', n: 34, h: 30, c: '#5a6a88' }
            },
            extras: [
                { k: 'landmark', kind: 'stormCloud', f: 0.1, x: 0.5, y: 0.36, size: 200, c: ['#2a3448', '#4a5a78'] },
                { k: 'landmark', kind: 'stormCloud', f: 0.22, x: 0.18, y: 0.42, size: 140, c: ['#222c40', '#3f4e6a'] },
                { k: 'islands', f: 0.2, n: 5, w: [60, 100], y: [0.4, 0.66], cols: { top: '#2f4a3a', top2: '#3f5a48', tree: '#1f3a2c', rockTop: '#4a4a58', rockBot: 'rgba(30,30,40,0.4)' }, fog: ['120,140,170', 0.4] },
                { k: 'islands', f: 0.4, n: 3, w: [100, 150], y: [0.5, 0.78], cols: { top: '#2f4a3a', top2: '#3f5a48', tree: '#1f3a2c', rockTop: '#4a4a58', rockBot: 'rgba(30,30,40,0.4)' }, fog: ['120,140,170', 0.1] }
            ],
            clouds: cloudBands(0.8, [0.05, 0.4], 0.1), mist: mistBands('130,150,180', 0.2, [0.62, 0.78]),
            parts: [{ kind: 'rain', n: [50, 26] }],
            ambient: { lightning: true },
            ground: { top: '#2a3448', bot: '#10151f', tufts: 'puffs', c: '#3a4560' },
            fg: { top: { k: 'puffs', c: ['#2a3448', '#3a4560'] }, bottom: { k: 'cloudPuffs', c: ['#2a3448', '#3a4560'] } }
        }
    ],
    magic: [
        {
            name: 'Arcane Void',
            sky: [[0, '#05010f'], [0.4, '#1d0638'], [0.75, '#3b0a6b'], [1, '#12002b']],
            body: { kind: 'planet', x: 0.72, y: 0.26, r: 60, rgb: '200,150,255' }, haze: '160,90,220', stars: 260, nebula: true,
            cloudTint: { shade: '70,30,120', hi: '190,140,255', lo: '130,80,200' },
            ridges: {
                n: 12, base: [0.5, 0.86], amp: [0.22, 0.05], oct: [5, 3], far: ['#2b1155', '#411b78'], near: ['#14052a', '#210a42'], fog: [0.45, 0.08],
                deco: (t) => t < 0.15 ? null : t < 0.5 ? { k: 'spire', n: 22, h: 90, c: '#4c2090' } : t < 0.75 ? { k: 'crystal', n: 12, h: 46, c: '#8247c4' } : { k: 'crystal', n: 14, h: 36, c: '#9a52d6' }
            },
            mid: 'arcane', midF: 0.3,
            extras: [
                { k: 'islands', f: 0.14, n: 8, w: [30, 60], y: [0.14, 0.5], style: 'crystal', fog: ['160,90,220', 0.5] },
                { k: 'islands', f: 0.38, n: 4, w: [70, 120], y: [0.22, 0.55], style: 'crystal', fog: ['160,90,220', 0.2] }
            ],
            clouds: cloudBands(0.22, [0.06, 0.34], 0.05), mist: mistBands('150,90,220', 0.22, [0.62, 0.78]),
            parts: [{ kind: 'sparkle', n: [30, 18], rgb: '230,190,255' }],
            ambient: { runes: true, shooting: true },
            ground: { top: '#190733', bot: '#0a0219', tufts: 'crystals', c: ['#a35be0', '#8247c4', '#c46ad6'] },
            fg: { top: { k: 'crystals', c: ['#c88bff', '#a96bff'] }, bottom: { k: 'upCrystals', c: ['#d58bff', '#b36bff', '#ff8be6'] } }
        },
        {
            name: 'Crystal Garden',
            sky: [[0, '#06111c'], [0.4, '#0b3a4d'], [0.75, '#1d7a78'], [1, '#7be0c0']],
            body: { kind: 'planet', x: 0.7, y: 0.22, r: 38, rgb: '255,150,210' }, haze: '120,230,200', stars: 100,
            nebula: true, nebulaCols: ['40,200,180', '230,90,170', '60,150,230', '120,230,200'],
            cloudTint: { shade: '20,90,100', hi: '130,230,210', lo: '60,160,160' },
            ridges: {
                n: 12, base: [0.56, 0.88], amp: [0.18, 0.05], oct: [5, 3], far: ['#1a6a6e', '#2a9a8c'], near: ['#08242a', '#04141a'], fog: [0.45, 0.07],
                deco: (t) => t < 0.2 ? null : t < 0.55 ? { k: 'mushroom', n: 26, h: 28, c: ['#ff7ac8', '#4de8d0', '#b388ff'] }
                    : t < 0.8 ? [{ k: 'mushroom', n: 20, h: 44, c: ['#ff7ac8', '#4de8d0', '#b388ff'] }, { k: 'crystal', n: 10, h: 40, c: '#4de8d0' }] : { k: 'mushroom', n: 14, h: 60, c: ['#ff7ac8', '#4de8d0'] }
            },
            extras: [{ k: 'landmark', kind: 'giantMushroom', f: 0.26, x: 0.3, y: 0.76, size: 120, c: ['#ff7ac8'] },
                     { k: 'landmark', kind: 'giantMushroom', f: 0.4, x: 0.8, y: 0.84, size: 90, c: ['#4de8d0'] }],
            clouds: cloudBands(0.25, [0.06, 0.32], 0.05), mist: mistBands('100,230,200', 0.22, [0.62, 0.78]),
            parts: [{ kind: 'firefly', n: [22, 10], rgb: '255,170,230' }, { kind: 'sparkle', n: [18, 8], rgb: '120,255,230' }],
            ambient: { shooting: true },
            ground: { top: '#0d3a3a', bot: '#051a1a', tufts: 'mushrooms', c: ['#ff7ac8', '#4de8d0'] },
            fg: { top: { k: 'glowVines', c: ['#2a8a6a', '#4de8d0', '#ff7ac8'] }, bottom: { k: 'mushrooms', c: ['#ff7ac8', '#4de8d0', '#b388ff'] } }
        },
        {
            name: 'Nebula Reef',
            sky: [[0, '#05010f'], [0.5, '#1a0b3f'], [1, '#3a1055']],
            body: null, haze: '120,90,220', stars: 360, nebula: true,
            cloudTint: { shade: '80,30,140', hi: '220,140,255', lo: '150,80,220' },
            extras: [
                { k: 'landmark', kind: 'planet', f: 0.06, x: 0.2, y: 0.52, size: 70, c: ['#ff9ad0', '#8a4ad0'], ring: 'rgba(255,208,240,0.7)' },
                { k: 'islands', f: 0.1, n: 10, w: [20, 40], y: [0.08, 0.6], style: 'rock', cols: { a: '#6a5a8a', b: '#241a3a' }, fog: ['120,90,220', 0.5] },
                { k: 'landmark', kind: 'planet', f: 0.12, x: 0.78, y: 0.46, size: 110, c: ['#8ac0ff', '#2a4ac0'] },
                { k: 'islands', f: 0.18, n: 8, w: [30, 60], y: [0.15, 0.7], style: 'rock', cols: { a: '#7a6a9a', b: '#2a1f44' }, fog: ['120,90,220', 0.4] },
                { k: 'landmark', kind: 'planet', f: 0.22, x: 0.46, y: 0.78, size: 50, c: ['#ffd27a', '#d0603a'] },
                { k: 'islands', f: 0.28, n: 7, w: [40, 80], y: [0.2, 0.75], style: 'rock', cols: { a: '#8a7aaa', b: '#2e2250' }, fog: ['120,90,220', 0.3] },
                { k: 'islands', f: 0.44, n: 5, w: [60, 110], y: [0.3, 0.8], style: 'rock', cols: { a: '#9a8aba', b: '#32265a' }, fog: ['120,90,220', 0.15] },
                { k: 'islands', f: 0.62, n: 2, w: [70, 110], y: [0.5, 0.82], style: 'rock', cols: { a: '#aa9aca', b: '#3a2e66' }, fog: ['120,90,220', 0.06] }
            ],
            clouds: [
                { f: 0.05, n: 4, s: [0.9, 1.4], a: 0.3, v: 0.03, y: [0.05, 0.5] }, { f: 0.13, n: 4, s: [1.0, 1.6], a: 0.3, v: 0.04, y: [0.1, 0.6] },
                { f: 0.24, n: 3, s: [1.2, 1.8], a: 0.28, v: 0.05, y: [0.2, 0.7] }, { f: 0.38, n: 3, s: [1.2, 1.8], a: 0.25, v: 0.06, y: [0.3, 0.75] }
            ],
            mist: mistBands('140,100,230', 0.22, [0.5, 0.74]),
            parts: [{ kind: 'sparkle', n: [46, 26], rgb: '210,170,255' }],
            ambient: { shooting: true },
            ground: { top: '#1a0b30', bot: '#0a0418', tufts: 'rubble', c: '#3a2f5a' },
            fg: { top: null, bottom: { k: 'rubble', c: ['#2a2040', '#3a2f5a'] } }
        }
    ]
};
