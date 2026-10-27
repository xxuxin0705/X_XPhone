// 心屿 · 零件累加器：把成百上千个小块（柱子、瓦、窗框、树枝）按材质合并成少数几个网格
// 玻璃球的折射会把球里所有东西多画一遍，所以 draw call 必须少；合并后一座岛通常只有一二十个网格
let T;
export const setThree = three => { T = three; };
const geoCache = new Map();
/** 基础几何（缓存，按需生成）：box / cyl{seg} / cone{seg} / sph{seg} / plane / ring{seg} / torus{seg} */
export function baseGeo(kind, seg = 8) {
    const k = kind + seg; let g = geoCache.get(k); if (g) return g;
    if (kind === 'box') g = new T.BoxGeometry(1, 1, 1);
    else if (kind === 'cyl') g = new T.CylinderGeometry(1, 1, 1, seg);
    else if (kind === 'cone') g = new T.ConeGeometry(1, 1, seg);
    else if (kind === 'sph') g = new T.SphereGeometry(1, seg, Math.max(4, seg * .7 | 0));
    else if (kind === 'plane') g = new T.PlaneGeometry(1, 1);
    else if (kind === 'ring') g = new T.RingGeometry(.5, 1, seg);
    else if (kind === 'torus') g = new T.TorusGeometry(1, .1, 5, seg);
    else if (kind === 'tri') { g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, 1, 0], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2)); }
    else if (kind === 'prism') { g = new T.CylinderGeometry(0, 1, 1, 3); } // 三棱柱 → 人字屋顶
    else if (kind === 'wedge') { g = new T.CylinderGeometry(0, 1, 1, 4); } // 四棱锥 → 庑殿顶、金字塔
    geoCache.set(k, g); return g;
}
export const disposeGeos = () => { geoCache.forEach(g => g.dispose()); geoCache.clear(); };

const _m = () => new T.Matrix4(), _q = () => new T.Quaternion(), _v = () => new T.Vector3(), _e = () => new T.Euler();
const nm3 = () => new T.Matrix3();
export class Acc {
    constructor() { this.b = new Map(); this.extra = []; }
    bucket(mk) { let b = this.b.get(mk); if (!b) { b = { pos: [], nor: [], uv: [], col: [], idx: [], n: 0 }; this.b.set(mk, b); } return b; }
    /** 把一份几何按矩阵变换后放进材质 mk 的桶里；col 是顶点色（给用 vertexColors 的材质） */
    add(geo, mk, m4, col) {
        const b = this.bucket(mk), p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, nmat = nm3().getNormalMatrix(m4), v = _v(), base = b.n;
        const c = col ? (col.isColor ? col : new T.Color(col)) : null;
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(m4); b.pos.push(v.x, v.y, v.z);
            if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nmat).normalize(); b.nor.push(v.x, v.y, v.z); } else b.nor.push(0, 1, 0);
            if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
            b.col.push(c ? c.r : 1, c ? c.g : 1, c ? c.b : 1);
        }
        if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) b.idx.push(base + ix[i]); } else for (let i = 0; i < p.count; i++) b.idx.push(base + i);
        b.n += p.count;
    }
    /** 放一个基础几何：kind, 材质, 位置, 尺寸, 旋转(欧拉), 顶点色 */
    put(kind, mk, [x, y, z], [sx, sy, sz], [rx, ry, rz] = [0, 0, 0], col, seg) {
        const m = _m().compose(_v().set(x, y, z), _q().setFromEuler(_e().set(rx, ry, rz)), _v().set(sx, sy, sz));
        this.add(baseGeo(kind, seg), mk, m, col);
    }
    /** 直接放一段自己算好的三角形（pos/nor 数组，可带 idx） */
    raw(mk, pos, nor, idx, col, uv) {
        const b = this.bucket(mk), base = b.n, n = pos.length / 3;
        for (let i = 0; i < pos.length; i++) b.pos.push(pos[i]);
        for (let i = 0; i < n; i++) { b.nor.push(nor ? nor[i * 3] : 0, nor ? nor[i * 3 + 1] : 1, nor ? nor[i * 3 + 2] : 0); b.uv.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0); const c = col && (Array.isArray(col) ? col[i] : col); b.col.push(c ? c.r : 1, c ? c.g : 1, c ? c.b : 1); }
        if (idx) for (let i = 0; i < idx.length; i++) b.idx.push(base + idx[i]); else for (let i = 0; i < n; i++) b.idx.push(base + i);
        b.n += n;
    }
    /** 合并成网格：mats 是 { 材质名: Material }，没登记的材质名用 fallback(mk) 造 */
    build(mats, fallback, { shadow = true } = {}) {
        const g = new T.Group();
        for (const [mk, b] of this.b) {
            if (!b.n) continue;
            const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(b.col, 3));
            geo.setIndex(b.n > 65535 ? new T.Uint32BufferAttribute(b.idx, 1) : new T.Uint16BufferAttribute(b.idx, 1)); geo.computeBoundingSphere();
            const m = new T.Mesh(geo, mats[mk] || (mats[mk] = fallback(mk))); m.castShadow = shadow && !/^(glass|lamp)/.test(mk); m.receiveShadow = shadow; m.userData.mk = mk; g.add(m);
        }
        return g;
    }
    get tris() { let t = 0; for (const b of this.b.values()) t += b.idx.length / 3; return t; }
}
/** 变换一组点（给自己算几何的零件用） */
export const xf = (m4, x, y, z) => { const v = _v().set(x, y, z).applyMatrix4(m4); return [v.x, v.y, v.z]; };
export const mat4 = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => _m().compose(_v().set(x, y, z), _q().setFromEuler(_e().set(rx, ry, rz)), _v().set(sx, sy, sz));
