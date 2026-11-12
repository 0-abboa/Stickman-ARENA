// Collision geometry follows the rendered stick figure instead of the movement
// envelope used for standing on platforms and resolving walls.
(() => {
    const RAD = StickArt.RAD;
    const OUTLINE = 1.25;
    const EPS = 1e-7;

    const pointSegmentDistanceSq = (p, a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
        const t = lenSq > EPS ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
        const x = a.x + dx * t, y = a.y + dy * t;
        return (p.x - x) ** 2 + (p.y - y) ** 2;
    };

    const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    function segmentsCross(a, b, c, d) {
        const abC = orientation(a, b, c), abD = orientation(a, b, d);
        const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
        return ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
            ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS));
    }
    function segmentDistance(a, b, c, d) {
        if (segmentsCross(a, b, c, d)) return 0;
        return Math.sqrt(Math.min(
            pointSegmentDistanceSq(a, c, d), pointSegmentDistanceSq(b, c, d),
            pointSegmentDistanceSq(c, a, b), pointSegmentDistanceSq(d, a, b)
        ));
    }

    function rectEdges(box) {
        const x = Number(box.x) || 0, y = Number(box.y) || 0;
        const w = Number(box.width !== undefined ? box.width : box.w) || 0;
        const h = Number(box.height !== undefined ? box.height : box.h) || 0;
        const x0 = Math.min(x, x + w), x1 = Math.max(x, x + w);
        const y0 = Math.min(y, y + h), y1 = Math.max(y, y + h);
        const tl = { x: x0, y: y0 }, tr = { x: x1, y: y0 }, br = { x: x1, y: y1 }, bl = { x: x0, y: y1 };
        return { x0, x1, y0, y1, edges: [[tl, tr], [tr, br], [br, bl], [bl, tl]] };
    }
    function segmentRectDistance(a, b, r) {
        if ((a.x >= r.x0 && a.x <= r.x1 && a.y >= r.y0 && a.y <= r.y1) ||
            (b.x >= r.x0 && b.x <= r.x1 && b.y >= r.y0 && b.y <= r.y1)) return 0;
        let d = Infinity;
        for (const [c, e] of r.edges) d = Math.min(d, segmentDistance(a, b, c, e));
        return d;
    }

    function fallbackShape(p) {
        if (p.hidden || p.isDead) return [];
        const x = p.x + p.width / 2, h = p.height;
        const head = { x, y: p.y + Math.min(11, h * 0.24) };
        const neck = { x, y: p.y + Math.min(21, h * 0.42) };
        const hip = { x, y: p.y + h * 0.66 };
        const foot = { x, y: p.y + h - 3 };
        const radius = p.isLaying ? 8 : 7;
        return [
            { a: head, b: head, r: SK.headR + 2.2 },
            { a: head, b: neck, r: 3.25 },
            { a: neck, b: hip, r: 4.75 },
            { a: hip, b: foot, r: radius }
        ];
    }

    function shapesFor(p) {
        if (p.hidden || p.isDead) return [];
        const J = p.joints;
        if (!J || J.length < 11) return fallbackShape(p);

        // Joints are generated at the last rendered feet anchor. Shift that pose
        // to the current physics anchor so a hit during this update stays aligned.
        const anchorX = p.touchAnchorX, anchorY = p.touchAnchorY;
        const sx = p.x + p.width / 2 - (Number.isFinite(anchorX) ? anchorX : p.x + p.width / 2);
        const sy = p.y + p.height - (Number.isFinite(anchorY) ? anchorY : p.y + p.height);
        const at = (i) => ({ x: J[i].x + sx, y: J[i].y + sy });
        const out = [];
        const add = (a, b, bone) => {
            const radii = RAD[bone];
            // Split the tapered rendered limb into short capsules so its touch
            // shape stays close to the visible thickness from joint to joint.
            for (let i = 0; i < 2; i++) {
                const t0 = i / 2, t1 = (i + 1) / 2;
                const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
                const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
                const r0 = radii[0] + (radii[1] - radii[0]) * t0;
                const r1 = radii[0] + (radii[1] - radii[0]) * t1;
                out.push({ a: p0, b: p1, r: Math.max(r0, r1) + OUTLINE });
            }
        };
        const head = at(0), neck = at(1), hip = at(2);
        const shoulder = { x: J[2].x + (J[1].x - J[2].x) * 0.88 + sx, y: J[2].y + (J[1].y - J[2].y) * 0.88 + sy };

        out.push({ a: head, b: head, r: SK.headR + 2.2 });
        add(head, neck, 0);
        add(hip, neck, 1);
        add(shoulder, at(3), 2); add(at(3), at(4), 3);
        add(shoulder, at(5), 4); add(at(5), at(6), 5);
        add(hip, at(7), 6); add(at(7), at(8), 7);
        add(hip, at(9), 8); add(at(9), at(10), 9);
        out.push({ a: at(4), b: at(4), r: 2.9 + OUTLINE });
        out.push({ a: at(6), b: at(6), r: 2.9 + OUTLINE });
        // The rendered shoes are flattened ellipses; their longest radius is used
        // so contact remains consistent at every foot angle.
        const addFoot = (kneeIndex, footIndex) => {
            const knee = at(kneeIndex), foot = at(footIndex);
            const angle = Math.atan2(foot.y - knee.y, foot.x - knee.x) - Math.PI / 2 * p.facing;
            const center = {
                x: foot.x + p.facing * 1.6 * Math.cos(angle) - 0.4 * Math.sin(angle),
                y: foot.y + p.facing * 1.6 * Math.sin(angle) + 0.4 * Math.cos(angle)
            };
            out.push({ a: center, b: center, r: 4.6 + OUTLINE });
        };
        addFoot(7, 8); addFoot(9, 10);
        return out;
    }

    Object.assign(Player.prototype, {
        touchShapes() {
            return shapesFor(this);
        },

        touchDistanceToPoint(x, y) {
            const point = { x, y };
            let distance = Infinity;
            for (const s of shapesFor(this)) {
                distance = Math.min(distance, Math.sqrt(pointSegmentDistanceSq(point, s.a, s.b)) - s.r);
            }
            return Math.max(0, distance);
        },

        touchesCircle(x, y, radius) {
            return this.touchDistanceToPoint(x, y) <= Math.max(0, radius || 0);
        },

        touchesCapsule(x0, y0, x1, y1, radius) {
            const a = { x: x0, y: y0 }, b = { x: x1, y: y1 }, r = Math.max(0, radius || 0);
            return shapesFor(this).some(s => segmentDistance(s.a, s.b, a, b) <= s.r + r);
        },

        intersectsRect(box) {
            const r = rectEdges(box);
            for (const s of shapesFor(this)) {
                if (Math.max(s.a.x, s.b.x) + s.r < r.x0 || Math.min(s.a.x, s.b.x) - s.r > r.x1 ||
                    Math.max(s.a.y, s.b.y) + s.r < r.y0 || Math.min(s.a.y, s.b.y) - s.r > r.y1) continue;
                if (segmentRectDistance(s.a, s.b, r) <= s.r) return true;
            }
            return false;
        },

        touchesPlayer(other) {
            if (!other || other.isDead || other.hidden) return false;
            const a = shapesFor(this), b = shapesFor(other);
            for (const sa of a) for (const sb of b) {
                if (segmentDistance(sa.a, sa.b, sb.a, sb.b) <= sa.r + sb.r) return true;
            }
            return false;
        }
    });
})();
