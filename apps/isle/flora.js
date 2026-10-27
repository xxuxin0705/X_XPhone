// 心屿 · 植物：树是「长」出来的（树干沿带噪声的曲线分枝，再铺上几百片实例化的叶片），还有草地、灌木、野花
// 叶片是贴了 canvas 画的叶形的小平面，按树种分成几个 InstancedMesh（一种叶子一个 draw call）
import { leafTex, SURF } from './mats.js';
let T;
export const setThree = three => { T = three; };
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const UP = () => V(0, 1, 0);
const perp = t => { const a = Math.abs(t.y) < .9 ? UP() : V(1, 0, 0); return V().crossVectors(t, a).normalize(); };
const randUnit = r => { const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z); return V(Math.cos(a) * s, Math.sin(a) * s, z); };

/* ---------- 叶片收集器：同一种叶子 → 一个 InstancedMesh ---------- */
export class Leaves {
    constructor() { this.sets = new Map(); }
    /** kind 叶形；color 叶色；p 片基部位置；d 片的朝上方向；n 片的法线（可空：随机）；w h 尺寸 */
    add(kind, color, p, d, n, w, h, r) {
        const key = kind + '|' + color; let s = this.sets.get(key); if (!s) { s = { kind, color, m: [] }; this.sets.set(key, s); }
        const up = d.clone().normalize(); let nn = n ? n.clone() : randUnit(r); nn.addScaledVector(up, -nn.dot(up)); if (nn.lengthSq() < 1e-6) nn = perp(up); nn.normalize();
        const right = V().crossVectors(up, nn).normalize();
        const m = new T.Matrix4().makeBasis(right.multiplyScalar(w), up.clone().multiplyScalar(h), nn); m.setPosition(p.x + up.x * h * .5, p.y + up.y * h * .5, p.z + up.z * h * .5);
        s.m.push(m);
    }
    build() {
        const g = new T.Group();
        for (const s of this.sets.values()) {
            const im = new T.InstancedMesh(new T.PlaneGeometry(1, 1), SURF.leaf(leafTex(s.kind), { color: s.color }), s.m.length);
            s.m.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.userData.leaves = true; g.add(im);
        }
        return g;
    }
    get count() { let n = 0; for (const s of this.sets.values()) n += s.m.length; return n; }
}

/* ---------- 树枝：沿曲线生长 + 管体 ---------- */
function grow(r, start, dir, len, r0, r1, P = {}) {
    const seg = P.seg || len / 4, n = Math.max(2, Math.ceil(len / seg)), ds = len / n, pts = [start.clone()], rads = [r0], d = dir.clone().normalize(), curl = V(), p = start.clone();
    for (let i = 1; i <= n; i++) {
        const t = i / n; curl.multiplyScalar(P.decay ?? .7).add(randUnit(r).multiplyScalar(P.wobble ?? .5)); curl.addScaledVector(d, -curl.dot(d)); d.addScaledVector(curl, ds * 6);
        d.y += ((P.up || 0) - (P.droop || 0) * t) * ds * 6; d.normalize(); p.addScaledVector(d, ds); pts.push(p.clone()); rads.push(r1 + (r0 - r1) * (1 - t) ** (P.taper ?? 1));
    }
    return { pts, rads };
}
/** 把一根树枝做成管体放进累加器（树干 bark 桶）。粗的多边，细的少边 */
function tube(acc, br, mk, col, S) {
    const { pts, rads } = br, n = pts.length; S = S || Math.max(4, Math.min(9, Math.round(3 + rads[0] * 260)));
    const Tn = []; for (let i = 0; i < n; i++) Tn.push(pts[Math.min(i + 1, n - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize());
    const N = [perp(Tn[0])]; for (let i = 1; i < n; i++) { const v = N[i - 1].clone(); v.addScaledVector(Tn[i], -v.dot(Tn[i])); if (v.lengthSq() < 1e-6) v.copy(perp(Tn[i])); N.push(v.normalize()); }
    const pos = [], nor = [], idx = [];
    for (let i = 0; i < n; i++) { const B = V().crossVectors(Tn[i], N[i]); for (let j = 0; j <= S; j++) { const a = j / S * TAU, dir = N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)); const q = pts[i].clone().addScaledVector(dir, rads[i]); pos.push(q.x, q.y, q.z); nor.push(dir.x, dir.y, dir.z); } }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    // 封顶
    const tip = pts[n - 1], tn = Tn[n - 1]; const ti = pos.length / 3; pos.push(tip.x, tip.y, tip.z); nor.push(tn.x, tn.y, tn.z); for (let j = 0; j < S; j++) idx.push((n - 1) * (S + 1) + j, (n - 1) * (S + 1) + j + 1, ti);
    acc.raw(mk, pos, nor, idx, col);
}
const sampleAt = (br, t) => { const n = br.pts.length - 1, f = Math.min(1, Math.max(0, t)) * n, i = Math.min(Math.floor(f), n - 1), u = f - i; return { p: br.pts[i].clone().lerp(br.pts[i + 1], u), d: br.pts[i + 1].clone().sub(br.pts[i]).normalize() }; };
/** 沿着树枝从 t0 到 1 铺叶片 */
function leafAlong(lv, br, kind, color, r, { t0 = .4, every = .018, w = .03, h = .035, tip = 6, jitter = .6, upBias = 0 }) {
    const len = br.pts.reduce((s, p, i) => i ? s + p.distanceTo(br.pts[i - 1]) : 0, 0); const n = Math.max(1, Math.round(len * (1 - t0) / every));
    for (let i = 0; i < n; i++) { const { p, d } = sampleAt(br, t0 + (1 - t0) * (i + .5) / n); const side = perp(d).applyAxisAngle(d, r() * TAU); const dir = d.clone().multiplyScalar(.3).add(side).add(V(0, upBias, 0)).add(randUnit(r).multiplyScalar(jitter)).normalize(); lv.add(kind, color, p.clone().addScaledVector(side, br.rads[0] * .5), dir, null, w * (.8 + r() * .4), h * (.8 + r() * .4), r); }
    const { p, d } = sampleAt(br, 1); for (let i = 0; i < tip; i++) { const dir = d.clone().add(randUnit(r).multiplyScalar(.9)).add(V(0, upBias, 0)).normalize(); lv.add(kind, color, p, dir, null, w * (.9 + r() * .4), h * (.9 + r() * .4), r); }
}

/* ---------- 树种 ---------- */
const BARK = { broad: '#6b5440', maple: '#5a4636', sakura: '#5c4a44', pine: '#5e4634', cypress: '#5a4634', palm: '#8a6c4b', bamboo: '#7fa85c' };
/**
 * 长一棵树。acc 树干累加器，lv 叶片收集器，r 随机函数，sp 树种，o: { p 根部位置, h 高度, col 叶色数组, snowy }
 */
export function tree(acc, lv, r, sp, o) {
    const { p, h } = o, bark = 'wood:y:' + (BARK[sp] || '#6b5440'), col = o.col || ['#4e8a3c', '#5f9b47', '#3f7a33'];
    const leaf = (kind, br, extra) => leafAlong(lv, br, kind, col[(r() * col.length) | 0], r, extra);
    if (sp === 'broad' || sp === 'maple' || sp === 'sakura') {
        const spread = sp === 'sakura' ? 1.15 : 1, kind = sp === 'maple' ? 'maple' : sp === 'sakura' ? 'blossom' : 'broad', rT = .016 * (h / .25) + .003;
        const trunk = grow(r, p.clone().add(V(0, -.01, 0)), V((r() - .5) * .25, 1, (r() - .5) * .25), h * .32 + .01, rT, rT * .75, { wobble: .25, decay: .8 }); tube(acc, trunk, bark);
        const top = trunk.pts.at(-1), tdir = top.clone().sub(trunk.pts.at(-2)).normalize(), nL = 3 + (r() * 2 | 0), az0 = r() * TAU;
        for (let i = 0; i < nL; i++) {
            const az = az0 + i / nL * TAU + (r() - .5) * .6, ang = (.55 + r() * .35) * spread, side = perp(tdir).applyAxisAngle(tdir, az), dir = tdir.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang));
            const lead = grow(r, top, dir, h * (.38 + r() * .18), rT * .7, rT * .22, { wobble: .45, decay: .7, up: sp === 'sakura' ? -.1 : .15, droop: sp === 'sakura' ? .35 : .1 }); tube(acc, lead, bark);
            leaf(kind, lead, { t0: .4, every: .014, w: .026, h: .03, tip: 9, upBias: .25 });
            const nS = 2 + (r() * 2 | 0); for (let j = 0; j < nS; j++) { const { p: sp0, d: sd } = sampleAt(lead, .35 + r() * .5); const s2 = perp(sd).applyAxisAngle(sd, r() * TAU), d2 = sd.clone().multiplyScalar(.6).add(s2.multiplyScalar(.8)).add(V(0, .3, 0)).normalize(); const sub = grow(r, sp0, d2, h * (.18 + r() * .14), rT * .3, rT * .08, { wobble: .5, decay: .7, droop: .25 }); tube(acc, sub, bark, null, 4); leaf(kind, sub, { t0: .15, every: .012, w: .024, h: .028, tip: 8, upBias: .3 }); }
        }
    } else if (sp === 'pine') {
        const rT = .013 * (h / .3) + .003, trunk = grow(r, p.clone().add(V(0, -.01, 0)), V((r() - .5) * .1, 1, (r() - .5) * .1), h + .01, rT, rT * .15, { wobble: .12, decay: .85, seg: h / 8 }); tube(acc, trunk, bark);
        const c0 = col[(r() * col.length) | 0]; let az = r() * TAU;
        for (let t = .3; t < .96; t += .085 + r() * .03) { const { p: bp, d: bd } = sampleAt(trunk, t), nb = 4 + (r() * 2 | 0), L = h * .42 * (1 - t) ** .8 + .015; for (let i = 0; i < nb; i++) { az += TAU / nb + (r() - .5) * .5; const side = perp(bd).applyAxisAngle(bd, az), dir = side.clone().multiplyScalar(1).add(V(0, -.15 + r() * .3, 0)).normalize(); const br = grow(r, bp, dir, L * (.8 + r() * .4), rT * .35 * (1 - t * .6), rT * .06, { wobble: .25, decay: .75, droop: .2, up: .08, seg: L / 3 }); tube(acc, br, bark, null, 4); leafAlong(lv, br, 'needle', c0, r, { t0: .15, every: .012, w: .034, h: .034, tip: 5, jitter: .3, upBias: .4 }); } }
        for (let i = 0; i < 5; i++) lv.add('needle', c0, trunk.pts.at(-1).clone().add(V(0, -.01 * i, 0)), V((r() - .5), .6, (r() - .5)).normalize(), null, .022, .022, r);
    } else if (sp === 'cypress') {
        const rT = .009 * (h / .3) + .002, trunk = grow(r, p.clone().add(V(0, -.01, 0)), V((r() - .5) * .08, 1, (r() - .5) * .08), h, rT, rT * .1, { wobble: .08, decay: .85, seg: h / 6 }); tube(acc, trunk, bark, null, 5);
        const c0 = col[(r() * col.length) | 0], N = Math.round(h * 520);
        for (let i = 0; i < N; i++) { const t = .08 + r() * .9, { p: bp } = sampleAt(trunk, t), rad = h * .12 * (1 - t) ** .6 + .004, a = r() * TAU, rr = rad * Math.sqrt(r()); lv.add('needle', c0, bp.clone().add(V(Math.cos(a) * rr, 0, Math.sin(a) * rr)), V(Math.cos(a) * .5, 1, Math.sin(a) * .5).add(randUnit(r).multiplyScalar(.4)).normalize(), null, .02, .024, r); }
    } else if (sp === 'palm') {
        const lean = V((r() - .5) * .6, 1, (r() - .5) * .6).normalize(), rT = .011 * (h / .3) + .003;
        const trunk = grow(r, p.clone().add(V(0, -.01, 0)), lean, h, rT, rT * .6, { wobble: .05, decay: .9, up: .35, seg: h / 7 }); tube(acc, trunk, 'wood:y:#8a6c4b', null, 7);
        for (let i = 0; i < trunk.pts.length - 1; i += 2) { const { p: q } = sampleAt(trunk, i / (trunk.pts.length - 1)); acc.put('cyl', 'wood:y:#6f5538', [q.x, q.y, q.z], [trunk.rads[i] * 1.25, .004, trunk.rads[i] * 1.25], [0, 0, 0], null, 7); }
        const top = trunk.pts.at(-1), c0 = col[(r() * col.length) | 0], nF = 7 + (r() * 3 | 0), az0 = r() * TAU;
        for (let i = 0; i < nF; i++) { const az = az0 + i / nF * TAU, d = V(Math.cos(az), .55 - i % 2 * .35, Math.sin(az)).normalize(), L = h * .62 * (.85 + r() * .3); for (const roll of [0, 1]) { const nrm = V().crossVectors(d, UP()).normalize().applyAxisAngle(d, roll * Math.PI / 2 + (r() - .5) * .3); lv.add('frond', c0, top.clone().add(V(0, -.004, 0)), d, nrm, L * .36, L, r); } }
        for (let i = 0; i < 3; i++) acc.put('sph', 'paint:#8b5a2b:0', [top.x + (r() - .5) * .015, top.y - .01, top.z + (r() - .5) * .015], [.008, .009, .008], [0, 0, 0], null, 6);
    } else if (sp === 'bamboo') {
        const n = 3 + (r() * 3 | 0), c0 = col[(r() * col.length) | 0];
        for (let i = 0; i < n; i++) { const hh = h * (.7 + r() * .5), x = p.x + (r() - .5) * .05, z = p.z + (r() - .5) * .05, lean = V((r() - .5) * .25, 1, (r() - .5) * .25).normalize(), segs = 5 + (r() * 3 | 0), rr = .005 + r() * .002; let q = V(x, p.y - .005, z); for (let s = 0; s < segs; s++) { const L = hh / segs, q2 = q.clone().addScaledVector(lean, L); const m = new T.Matrix4().lookAt(q2, q, UP()); const mid = q.clone().lerp(q2, .5); const rot = new T.Euler().setFromRotationMatrix(m); acc.put('cyl', 'paint:#9fbf6a:0', [mid.x, mid.y, mid.z], [rr * (1 - s / segs * .3), L, rr * (1 - s / segs * .3)], [rot.x + Math.PI / 2, rot.y, rot.z], null, 6); acc.put('cyl', 'paint:#7a9a4c:0', [q2.x, q2.y, q2.z], [rr * 1.3, .004, rr * 1.3], [rot.x + Math.PI / 2, rot.y, rot.z], null, 6); if (s >= segs - 3) for (let k = 0; k < 4; k++) lv.add('bamboo', c0, q2.clone(), V(r() - .5, .2 + r() * .4, r() - .5).normalize(), null, .02, .05, r); q = q2; } }
    }
}
/** 灌木：一小团叶片 */
export function bush(lv, r, p, col, kind = 'broad', size = .05) {
    const n = Math.round(size * 500); for (let i = 0; i < n; i++) { const d = randUnit(r); d.y = Math.abs(d.y) * .8 + .2; const q = p.clone().addScaledVector(d, size * (.5 + r() * .5) * (1 - d.y * .3)); lv.add(kind, col[(r() * col.length) | 0], q, d.clone().add(V(0, .5, 0)).normalize(), null, .026, .03, r); }
}
/** 仙人掌 */
export function cactus(acc, r, p, h) {
    const g = 'paint:#4f9a5d:0'; acc.put('cyl', g, [p.x, p.y + h / 2, p.z], [.016, h, .016], [0, 0, 0], null, 10); acc.put('sph', g, [p.x, p.y + h, p.z], [.016, .012, .016], [0, 0, 0], null, 8);
    for (const s of [-1, 1]) { if (r() < .25) continue; const y = p.y + h * (.35 + r() * .3); acc.put('cyl', g, [p.x + s * .022, y, p.z], [.009, .035, .009], [0, 0, Math.PI / 2], null, 8); acc.put('cyl', g, [p.x + s * .04, y + .022, p.z], [.009, .045, .009], [0, 0, 0], null, 8); acc.put('sph', g, [p.x + s * .04, y + .045, p.z], [.009, .007, .009], [0, 0, 0], null, 6); }
    for (let i = 0; i < 12; i++) { const a = r() * TAU, y = p.y + r() * h; acc.put('cyl', 'paint:#f4edd8:0', [p.x + Math.cos(a) * .017, y, p.z + Math.sin(a) * .017], [.0008, .008, .0008], [0, 0, Math.PI / 2 - a], null, 3); }
}
/** 大蘑菇 */
export function mushroom(acc, r, p, h, cap, glow) {
    acc.put('cyl', 'plaster:#f1e7d6', [p.x, p.y + h / 2, p.z], [.018, h, .022], [0, 0, 0], null, 9);
    acc.put('sph', 'paint:' + cap + ':1', [p.x, p.y + h, p.z], [.07, .045, .07], [0, 0, 0], null, 12);
    acc.put('cyl', 'plaster:#e3d6c0', [p.x, p.y + h - .004, p.z], [.064, .006, .064], [0, 0, 0], null, 12);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = r() * .05; acc.put('sph', 'paint:#ffffff:0', [p.x + Math.cos(a) * d, p.y + h + .045 * Math.sqrt(1 - (d / .07) ** 2) * .9, p.z + Math.sin(a) * d], [.008, .004, .008], [0, 0, 0], null, 5); }
    if (glow) acc.put('sph', 'lamp:' + cap + ':2', [p.x, p.y + h - .012, p.z], [.03, .012, .03], [0, 0, 0], null, 8);
}
/** 草地：几千根小三角，按高度带色 */
export function grass(r, n, hAt, R, ok, c1, c2) {
    const im = new T.InstancedMesh(new T.BufferGeometry(), SURF.grass(c1, c2), n); const g = im.geometry;
    g.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, 1, 0], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(); let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * .97, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!ok(x, z)) continue; q.setFromEuler(e.set((r() - .5) * .4, r() * TAU, (r() - .5) * .4)); m.compose(v.set(x, hAt(x, z) - .001, z), q, s.set(.0025 + r() * .002, .008 + r() * .012, 1)); im.setMatrixAt(k++, m); }
    im.count = k; im.instanceMatrix.needsUpdate = true; im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; return im;
}
/** 野花：小片彩色花朵 */
export function flowers(lv, r, n, hAt, R, ok, cols, kind = 'blossom') {
    for (let i = 0; i < n * 3; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * .95, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!ok(x, z)) continue; lv.add(kind, cols[(r() * cols.length) | 0], V(x, hAt(x, z) + .004, z), V((r() - .5) * .3, 1, (r() - .5) * .3).normalize(), null, .014, .016, r); if (--n <= 0) break; }
}
