// 心屿 · 果冻软体（XPBD）：整个球是一团用弹簧连起来的粒子 + 体积约束
// 表面一层（二十面体细分 2 次，162 个）、内层（42 个）、中心 1 个。抓住哪就哪紧跟手指，其余被拖着慢慢跟上——所以会被拉长、拧歪，松手整团晃回去
// 中心被软软地拴在原位：拉表面的一点，球就绕中心滚，能翻过来；摇一摇时解开拴绳、打开重力，球真的砸到地上压扁再弹起
// 纯数学，不依赖 three.js，Node 里可以直接测
const TAU = Math.PI * 2;

/* ---------- 二十面体细分球 ---------- */
function icosphere(sub) {
    const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < sub; s++) {
        const mid = new Map(), m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid.has(k)) return mid.get(k); const p = V[a].map((c, i) => c + V[b][i]), l = Math.hypot(...p); V.push(p.map(c => c / l)); mid.set(k, V.length - 1); return V.length - 1; };
        F = F.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    }
    return { V, F };
}
const edgesOf = F => { const s = new Set(), out = []; for (const [a, b, c] of F) for (const [i, j] of [[a, b], [b, c], [c, a]]) { const k = i < j ? i + '_' + j : j + '_' + i; if (!s.has(k)) { s.add(k); out.push([i, j]); } } return out; };

/* ---------- 3×3 小工具（列主序数组 [a00,a10,a20,a01,…]） ---------- */
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(c => c / l); };
const qmat = ([x, y, z, w]) => [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
const qaxis = (ax, ay, az, a) => { const s = Math.sin(a / 2); return [ax * s, ay * s, az * s, Math.cos(a / 2)]; };
/** 从形变矩阵 A 里提出旋转（Müller 2016 的迭代法，用上一帧的四元数热启动） */
function extractRotation(A, q, iters = 6) {
    for (let k = 0; k < iters; k++) {
        const R = qmat(q);
        let ox = 0, oy = 0, oz = 0, d = 0;
        for (let c = 0; c < 3; c++) { const r0 = R[c * 3], r1 = R[c * 3 + 1], r2 = R[c * 3 + 2], a0 = A[c * 3], a1 = A[c * 3 + 1], a2 = A[c * 3 + 2]; ox += r1 * a2 - r2 * a1; oy += r2 * a0 - r0 * a2; oz += r0 * a1 - r1 * a0; d += r0 * a0 + r1 * a1 + r2 * a2; }
        const s = 1 / (Math.abs(d) + 1e-9); ox *= s; oy *= s; oz *= s; const w = Math.hypot(ox, oy, oz); if (w < 1e-9) break;
        q = qnorm(qmul(qaxis(ox / w, oy / w, oz / w, w), q));
    }
    return q;
}

/**
 * 做一个果冻球
 * @param {{firm?:number, damp?:number}} o firm 0~1 越大越硬；damp 每秒衰减
 */
export function softBall(o = {}) {
    const surf = icosphere(2), inner = icosphere(1);
    const nS = surf.V.length, nI = inner.V.length, n = nS + nI + 1, C = n - 1, RI = .55;
    const X = new Float64Array(n * 3), P = new Float64Array(n * 3), Vl = new Float64Array(n * 3), R0 = new Float64Array(n * 3), W = new Float64Array(n);
    surf.V.forEach((v, i) => R0.set(v, i * 3)); inner.V.forEach((v, i) => R0.set(v.map(c => c * RI), (nS + i) * 3)); R0.set([0, 0, 0], C * 3);
    X.set(R0); W.fill(1); W[C] = .5; // 中心粒子重一点
    const dist = (i, j) => Math.hypot(R0[i * 3] - R0[j * 3], R0[i * 3 + 1] - R0[j * 3 + 1], R0[i * 3 + 2] - R0[j * 3 + 2]);
    // 约束：表面边、内层边、表面→最近的 3 个内层点、内层→中心、表面→中心（防止塌）
    const E = [], add = (i, j, k) => E.push([i, j, dist(i, j), k]);
    for (const [i, j] of edgesOf(surf.F)) add(i, j, 0);
    for (const [i, j] of edgesOf(inner.F)) add(nS + i, nS + j, 1);
    for (let i = 0; i < nS; i++) { const near = [...Array(nI).keys()].map(j => [j, dist(i, nS + j)]).sort((a, b) => a[1] - b[1]).slice(0, 3); for (const [j] of near) add(i, nS + j, 1); add(i, C, 2); }
    for (let j = 0; j < nI; j++) add(nS + j, C, 1);
    const F = surf.F; // 表面三角形：算体积
    const vol = () => { let v = 0; for (const [a, b, c] of F) { const ax = X[a * 3], ay = X[a * 3 + 1], az = X[a * 3 + 2], bx = X[b * 3], by = X[b * 3 + 1], bz = X[b * 3 + 2], cx = X[c * 3], cy = X[c * 3 + 1], cz = X[c * 3 + 2]; v += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6; } return v; };
    const V0 = vol();
    // 形状匹配的静止量（只用表面点）：Aqq⁻¹
    let rc = [0, 0, 0]; const Aqq = new Float64Array(9);
    for (let i = 0; i < nS; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Aqq[b * 3 + a] += R0[i * 3 + a] * R0[i * 3 + b];
    const AqqInv = Aqq.map((v, k) => (k % 4 === 0 ? 1 / v : 0)); // 球面点：对角阵

    const S = {
        n, nS, X, R0, F, firm: o.firm ?? .3, damp: o.damp ?? 2, smooth: o.smooth ?? .12, kE: o.kE || [1e-3, 8e-4, 1e-3], kT: o.kT ?? 3e-7, gravity: 0, tether: 1, anchor: [0, 0, 0], floor: -1.02, walls: null,
        grab: null, q: [0, 0, 0, 1], A: [1, 0, 0, 0, 1, 0, 0, 0, 1], c: [0, 0, 0], ke: 0,
    };
    /** 抓住：p 是抓的那一点（世界坐标），r 抓的范围 */
    S.grabAt = (p, r = .5) => {
        const g = { ids: [], w: [], off: [], target: p.slice() };
        for (let i = 0; i < nS; i++) { const d = Math.hypot(X[i * 3] - p[0], X[i * 3 + 1] - p[1], X[i * 3 + 2] - p[2]); if (d < r) { const w = (1 - d / r) ** 2; g.ids.push(i); g.w.push(w); g.off.push([X[i * 3] - p[0], X[i * 3 + 1] - p[1], X[i * 3 + 2] - p[2]]); } }
        if (!g.ids.length) return null; S.grab = g; return g;
    };
    S.release = () => { S.grab = null; };
    /** 所有粒子加速度（拍一下 / 跳一下） */
    S.kick = (vx, vy, vz, spin = [0, 0, 0]) => { const c = S.c; for (let i = 0; i < n; i++) { const rx = X[i * 3] - c[0], ry = X[i * 3 + 1] - c[1], rz = X[i * 3 + 2] - c[2]; Vl[i * 3] += vx + spin[1] * rz - spin[2] * ry; Vl[i * 3 + 1] += vy + spin[2] * rx - spin[0] * rz; Vl[i * 3 + 2] += vz + spin[0] * ry - spin[1] * rx; } };
    /** 绕中心转（不倒翁回正、慢慢自转用）：轴 + 角度，位置和速度一起转 */
    S.rotate = (ax, ay, az, a) => { const M = qmat(qaxis(ax, ay, az, a)), c = S.c; for (let i = 0; i < n; i++) { for (const B of [X, Vl]) { const isX = B === X, x = B[i * 3] - (isX ? c[0] : 0), y = B[i * 3 + 1] - (isX ? c[1] : 0), z = B[i * 3 + 2] - (isX ? c[2] : 0); B[i * 3] = M[0] * x + M[3] * y + M[6] * z + (isX ? c[0] : 0); B[i * 3 + 1] = M[1] * x + M[4] * y + M[7] * z + (isX ? c[1] : 0); B[i * 3 + 2] = M[2] * x + M[5] * y + M[8] * z + (isX ? c[2] : 0); } } };

    /** 往前算 dt 秒（内部分 sub 个小步） */
    const G = new Float64Array(nS * 3), Ef = Float64Array.from(E.flat()), GM = new Float64Array(9); let gq = [0, 0, 0, 1];
    S.step = (dt, sub = 5) => {
        const h = dt / sub, h2 = h * h;
        // 柔度（XPBD）：越小越硬。表面边最软（能拉长、起褶），内部支撑硬一点，体积几乎不变
        const soft = (1 - S.firm) ** 2, aE = [S.kE[0] * soft + 1e-6, S.kE[1] * soft + 5e-7, S.kE[2] * soft + 1e-6], aV = 1e-8, aT = S.kT, aG = 2e-7;
        const g = S.grab, ne = E.length;
        for (let s = 0; s < sub; s++) {
            for (let i = 0; i < n; i++) { Vl[i * 3 + 1] += S.gravity * h; const i3 = i * 3; P[i3] = X[i3]; P[i3 + 1] = X[i3 + 1]; P[i3 + 2] = X[i3 + 2]; X[i3] += Vl[i3] * h; X[i3 + 1] += Vl[i3 + 1] * h; X[i3 + 2] += Vl[i3 + 2] * h; }
            // 边
            for (let e = 0; e < ne; e++) {
                const i = Ef[e * 4], j = Ef[e * 4 + 1], L = Ef[e * 4 + 2], k = Ef[e * 4 + 3], i3 = i * 3, j3 = j * 3;
                const dx = X[i3] - X[j3], dy = X[i3 + 1] - X[j3 + 1], dz = X[i3 + 2] - X[j3 + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
                const wi = W[i], wj = W[j], dl = -(d - L) / (wi + wj + aE[k] / h2) / d;
                X[i3] += dx * dl * wi; X[i3 + 1] += dy * dl * wi; X[i3 + 2] += dz * dl * wi;
                X[j3] -= dx * dl * wj; X[j3 + 1] -= dy * dl * wj; X[j3 + 2] -= dz * dl * wj;
            }
            // 体积（像灌满水的气球）：梯度 = 相邻三角形的叉积 / 6
            {
                G.fill(0); let v = 0;
                for (const [a, b, c] of F) {
                    const a3 = a * 3, b3 = b * 3, c3 = c * 3, ax = X[a3], ay = X[a3 + 1], az = X[a3 + 2], bx = X[b3], by = X[b3 + 1], bz = X[b3 + 2], cx = X[c3], cy = X[c3 + 1], cz = X[c3 + 2];
                    const gax = by * cz - bz * cy, gay = bz * cx - bx * cz, gaz = bx * cy - by * cx; v += ax * gax + ay * gay + az * gaz;
                    G[a3] += gax; G[a3 + 1] += gay; G[a3 + 2] += gaz;
                    G[b3] += cy * az - cz * ay; G[b3 + 1] += cz * ax - cx * az; G[b3 + 2] += cx * ay - cy * ax;
                    G[c3] += ay * bz - az * by; G[c3 + 1] += az * bx - ax * bz; G[c3 + 2] += ax * by - ay * bx;
                }
                v /= 6; let sw = 0; for (let i = 0; i < nS * 3; i++) { G[i] /= 6; sw += G[i] * G[i]; }
                const dl = -(v - V0) / (sw + aV / h2); for (let i = 0; i < nS * 3; i++) X[i] += G[i] * dl;
            }
            // 抓着的点跟着手指
            if (g) for (let k = 0; k < g.ids.length; k++) { const i = g.ids[k], wk = g.w[k], f = wk / (wk + aG / h2); for (let a = 0; a < 3; a++) X[i * 3 + a] -= (X[i * 3 + a] - g.target[a] - g.off[k][a]) * f; }
            // 中心拴在原位（软弹簧）
            if (S.tether > 0) { const k = W[C] / (W[C] + aT / S.tether / h2); for (let a = 0; a < 3; a++) X[C * 3 + a] -= (X[C * 3 + a] - S.anchor[a]) * k; }
            // 整体形状（形状匹配）：每个表面点轻轻拉向「整个球被均匀拉伸 / 转动后它该在的位置」——拉出来是光滑的椭圆，不会鼓出一个个包
            if (S.smooth > 0) {
                let cx = 0, cy = 0, cz = 0; for (let i = 0; i < nS; i++) { cx += X[i * 3]; cy += X[i * 3 + 1]; cz += X[i * 3 + 2]; } cx /= nS; cy /= nS; cz /= nS;
                const Ap = new Float64Array(9); for (let i = 0; i < nS; i++) { const px = X[i * 3] - cx, py = X[i * 3 + 1] - cy, pz = X[i * 3 + 2] - cz; for (let b = 0; b < 3; b++) { const q = R0[i * 3 + b] * AqqInv[b * 4]; Ap[b * 3] += px * q; Ap[b * 3 + 1] += py * q; Ap[b * 3 + 2] += pz * q; } }
                gq = extractRotation(Ap, gq, 2); const Rm = qmat(gq);
                const det = Ap[0] * (Ap[4] * Ap[8] - Ap[7] * Ap[5]) - Ap[3] * (Ap[1] * Ap[8] - Ap[7] * Ap[2]) + Ap[6] * (Ap[1] * Ap[5] - Ap[4] * Ap[2]), sc = 1 / Math.cbrt(Math.max(.05, det)), be = .65, k = S.smooth;
                for (let m = 0; m < 9; m++) GM[m] = Rm[m] * (1 - be) + Ap[m] * sc * be; // 目标变换 = 旋转 和 保体积的拉伸 混一下
                for (let i = 0; i < nS; i++) { const rx = R0[i * 3], ry = R0[i * 3 + 1], rz = R0[i * 3 + 2]; X[i * 3] += (cx + GM[0] * rx + GM[3] * ry + GM[6] * rz - X[i * 3]) * k; X[i * 3 + 1] += (cy + GM[1] * rx + GM[4] * ry + GM[7] * rz - X[i * 3 + 1]) * k; X[i * 3 + 2] += (cz + GM[2] * rx + GM[5] * ry + GM[8] * rz - X[i * 3 + 2]) * k; }
            }
            // 地面、墙
            const wl = S.walls;
            for (let i = 0; i < n; i++) {
                const i3 = i * 3;
                if (X[i3 + 1] < S.floor) { X[i3 + 1] = S.floor; X[i3] -= (X[i3] - P[i3]) * .3; X[i3 + 2] -= (X[i3 + 2] - P[i3 + 2]) * .3; } // 摩擦
                if (wl) { if (X[i3] < -wl.x) X[i3] = -wl.x; else if (X[i3] > wl.x) X[i3] = wl.x; if (X[i3 + 1] > wl.top) X[i3 + 1] = wl.top; }
            }
            const dmp = Math.exp(-S.damp * h);
            for (let i = 0; i < n * 3; i++) Vl[i] = (X[i] - P[i]) / h * dmp;
        }
        // 形状匹配：整体的位置、旋转、拉伸（给岛和相机用）
        const c = [0, 0, 0]; for (let i = 0; i < nS; i++) for (let a = 0; a < 3; a++) c[a] += X[i * 3 + a] / nS; S.c = c;
        const Apq = new Float64Array(9); for (let i = 0; i < nS; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Apq[b * 3 + a] += (X[i * 3 + a] - c[a]) * R0[i * 3 + b];
        const A = new Array(9).fill(0); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let k = 0; k < 3; k++) A[b * 3 + a] += Apq[k * 3 + a] * AqqInv[b * 3 + k];
        S.A = A; S.q = extractRotation(A, S.q);
        let ke = 0; for (let i = 0; i < n * 3; i++) ke += Vl[i] * Vl[i]; S.ke = ke / n;
    };
    /** 旋转矩阵（列主序 3×3） */
    S.R = () => qmat(S.q);
    /** 抓的点现在平均在哪（测试用）离中心多远 */
    S.grabDepth = () => { const g = S.grab; if (!g) return null; let x = 0, y = 0, z = 0, ws = 0; for (let k = 0; k < g.ids.length; k++) { const i = g.ids[k], w = g.w[k]; x += X[i * 3] * w; y += X[i * 3 + 1] * w; z += X[i * 3 + 2] * w; ws += w; } return Math.hypot(x / ws - S.c[0], y / ws - S.c[1], z / ws - S.c[2]); };
    S.volRatio = () => vol() / V0;
    /** 球面离正圆差多少（最大的半径偏差）：回弹好了就接近 0 */
    S.dev = () => { let m = 0; for (let i = 0; i < nS; i++) m = Math.max(m, Math.abs(Math.hypot(X[i * 3] - S.c[0], X[i * 3 + 1] - S.c[1], X[i * 3 + 2] - S.c[2]) - 1)); return m; };
    S.reset = () => { X.set(R0); Vl.fill(0); S.q = [0, 0, 0, 1]; gq = [0, 0, 0, 1]; S.grab = null; S.gravity = 0; S.tether = 1; };
    return S;
}

/** 渲染网格的每个顶点跟着最近的 3 个表面粒子走：预先算好权重 */
export function skinWeights(renderPos, S, k = 4) {
    const nv = renderPos.length / 3, ids = new Int32Array(nv * k), ws = new Float32Array(nv * k), base = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
        const x = renderPos[v * 3], y = renderPos[v * 3 + 1], z = renderPos[v * 3 + 2], l = Math.hypot(x, y, z) || 1;
        const best = []; for (let i = 0; i < S.nS; i++) { const d = Math.hypot(S.R0[i * 3] - x / l, S.R0[i * 3 + 1] - y / l, S.R0[i * 3 + 2] - z / l); best.push([i, d]); }
        best.sort((a, b) => a[1] - b[1]); let tw = 0; const sel = best.slice(0, k).map(([i, d]) => { const w = 1 / (d * d + 1e-4); tw += w; return [i, w]; });
        let bx = 0, by = 0, bz = 0; sel.forEach(([i, w], j) => { ids[v * k + j] = i; ws[v * k + j] = w / tw; bx += S.R0[i * 3] * w / tw; by += S.R0[i * 3 + 1] * w / tw; bz += S.R0[i * 3 + 2] * w / tw; });
        base.set([x - bx, y - by, z - bz], v * 3); // 顶点相对于这几个粒子加权位置的小偏移（跟着整体旋转走）
    }
    return { ids, ws, base, k };
}
/** 按粒子现在的位置更新渲染顶点 */
export function skin(out, S, sw) {
    const { ids, ws, base, k } = sw, X = S.X, R = S.R(), nv = out.length / 3;
    for (let v = 0; v < nv; v++) {
        let x = 0, y = 0, z = 0; for (let j = 0; j < k; j++) { const i = ids[v * k + j], w = ws[v * k + j]; x += X[i * 3] * w; y += X[i * 3 + 1] * w; z += X[i * 3 + 2] * w; }
        const bx = base[v * 3], by = base[v * 3 + 1], bz = base[v * 3 + 2];
        out[v * 3] = x + R[0] * bx + R[3] * by + R[6] * bz; out[v * 3 + 1] = y + R[1] * bx + R[4] * by + R[7] * bz; out[v * 3 + 2] = z + R[2] * bx + R[5] * by + R[8] * bz;
    }
}
