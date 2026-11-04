const Graphics = {
    textures: {},

    init: function() {
        this.textures.dirt = this.createDirtTexture();
        this.textures.stone = this.createStoneTexture();
        this.textures.magic = this.createMagicTexture();
        this.textures.ice = this.createIceTexture();
        this.textures.cloud = this.createCloudTexture();
    },

    // Small helper: builds a 64x64 offscreen canvas and returns [canvas, ctx]
    makeTile: function(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size || 64;
        canvas.height = size || 64;
        return [canvas, canvas.getContext('2d')];
    },

    // Seeded RNG so textures look the same every load (no flicker between levels)
    rng: function(seed) {
        let s = seed >>> 0;
        return function() {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    },

    createDirtTexture: function() {
        const [canvas, ctx] = this.makeTile(64);
        const rnd = this.rng(7);

        // Soil base with vertical falloff (darker toward the bottom)
        const soil = ctx.createLinearGradient(0, 0, 0, 64);
        soil.addColorStop(0, '#6d4c41');
        soil.addColorStop(1, '#3e2723');
        ctx.fillStyle = soil;
        ctx.fillRect(0, 0, 64, 64);

        // Clumps and pebbles
        for (let i = 0; i < 160; i++) {
            const x = rnd() * 64, y = 12 + rnd() * 52;
            const r = 0.8 + rnd() * 2.2;
            const shade = rnd();
            ctx.fillStyle = shade > 0.5 ? 'rgba(33,20,16,0.55)' : 'rgba(141,110,99,0.5)';
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.7, rnd() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Grass lip with a jagged, lit edge and blades
        const grass = ctx.createLinearGradient(0, 0, 0, 14);
        grass.addColorStop(0, '#66bb6a');
        grass.addColorStop(1, '#2e7d32');
        ctx.fillStyle = grass;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(64, 0);
        ctx.lineTo(64, 9);
        for (let x = 64; x >= 0; x -= 4) {
            ctx.lineTo(x, 8 + rnd() * 5);
        }
        ctx.closePath();
        ctx.fill();

        // Blades poking over the top edge
        ctx.strokeStyle = '#81c784';
        ctx.lineWidth = 1.2;
        for (let x = 1; x < 64; x += 3) {
            ctx.beginPath();
            ctx.moveTo(x, 2);
            ctx.lineTo(x + (rnd() - 0.5) * 3, -1 - rnd() * 3);
            ctx.stroke();
        }

        return ctx.createPattern(canvas, 'repeat');
    },

    createStoneTexture: function() {
        const [canvas, ctx] = this.makeTile(64);
        const rnd = this.rng(19);

        ctx.fillStyle = '#6e6e76';
        ctx.fillRect(0, 0, 64, 64);

        // Ashlar blocks: staggered rows, each block gets its own tone
        const rows = [0, 16, 32, 48];
        rows.forEach((y, r) => {
            const offset = r % 2 === 0 ? 0 : 16;
            for (let x = -offset; x < 64; x += 32) {
                const tone = 96 + Math.floor(rnd() * 22);
                const grad = ctx.createLinearGradient(x, y, x, y + 16);
                grad.addColorStop(0, `rgb(${tone + 10},${tone + 10},${tone + 18})`);
                grad.addColorStop(1, `rgb(${tone - 12},${tone - 12},${tone - 6})`);
                ctx.fillStyle = grad;
                ctx.fillRect(x + 1, y + 1, 30, 14);
            }
        });

        // Mortar lines (dark groove + faint highlight under it)
        ctx.fillStyle = '#3c3c44';
        rows.forEach(y => ctx.fillRect(0, y, 64, 2));
        for (let r = 0; r < 4; r++) {
            const offset = r % 2 === 0 ? 0 : 16;
            for (let x = offset; x <= 64; x += 32) {
                ctx.fillRect(x - 1, rows[r], 2, 16);
            }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        rows.forEach(y => ctx.fillRect(0, y + 2, 64, 1));

        // Speckle grit
        for (let i = 0; i < 90; i++) {
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.07)';
            ctx.fillRect(rnd() * 64, rnd() * 64, 1 + rnd(), 1 + rnd());
        }

        return ctx.createPattern(canvas, 'repeat');
    },

    createMagicTexture: function() {
        const [canvas, ctx] = this.makeTile(64);
        const rnd = this.rng(41);

        // Deep violet base with a soft radial core
        const base = ctx.createRadialGradient(32, 32, 4, 32, 32, 46);
        base.addColorStop(0, '#7b1fa2');
        base.addColorStop(1, '#2a0845');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 64, 64);

        // Rune ring
        ctx.strokeStyle = 'rgba(224,170,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(32, 32, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(32, 32, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Tick marks around the ring
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
            ctx.lineTo(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27);
            ctx.stroke();
        }

        // Small glowing motes
        for (let i = 0; i < 14; i++) {
            ctx.fillStyle = `rgba(236,200,255,${0.3 + rnd() * 0.6})`;
            ctx.beginPath();
            ctx.arc(rnd() * 64, rnd() * 64, 0.6 + rnd() * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        return ctx.createPattern(canvas, 'repeat');
    },

    createIceTexture: function() {
        const [canvas, ctx] = this.makeTile(64);
        const rnd = this.rng(73);

        // Cold gradient base
        const base = ctx.createLinearGradient(0, 0, 64, 64);
        base.addColorStop(0, '#b3e5fc');
        base.addColorStop(0.5, '#4fc3f7');
        base.addColorStop(1, '#0288d1');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 64, 64);

        // Facets: translucent triangles give a faceted crystal look
        for (let i = 0; i < 10; i++) {
            const x = rnd() * 64, y = rnd() * 64, s = 10 + rnd() * 18;
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,60,120,0.12)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + s, y + s * 0.4);
            ctx.lineTo(x + s * 0.3, y + s);
            ctx.closePath();
            ctx.fill();
        }

        // Cracks
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(18, 34);
        ctx.lineTo(30, 44);
        ctx.lineTo(64, 30);
        ctx.stroke();

        // Glints
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 64);
        ctx.lineTo(64, 0);
        ctx.moveTo(20, 64);
        ctx.lineTo(64, 20);
        ctx.stroke();

        return ctx.createPattern(canvas, 'repeat');
    },

    createCloudTexture: function() {
        const [canvas, ctx] = this.makeTile(64);
        const rnd = this.rng(101);

        // Soft sky-blue base that goes lighter toward the top
        const base = ctx.createLinearGradient(0, 0, 0, 64);
        base.addColorStop(0, '#ffffff');
        base.addColorStop(1, '#cfe9fb');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 64, 64);

        // Puffs: overlapping circles with a shadowed underside
        for (let i = 0; i < 9; i++) {
            const x = rnd() * 64, y = 10 + rnd() * 44, r = 6 + rnd() * 7;
            ctx.fillStyle = 'rgba(160,200,230,0.35)';
            ctx.beginPath();
            ctx.arc(x, y + 3, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        return ctx.createPattern(canvas, 'repeat');
    }
};
