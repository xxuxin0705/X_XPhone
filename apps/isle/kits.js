// 心屿 · 建筑和道具套件：寺庙、神社、现代街道、学校、医院、咖啡馆、木屋、灯塔……
// 每个套件是一个函数，用 K（零件工具）往累加器里放柱子、瓦顶、窗框，坐标是套件自己的（原点在地面，正面朝 +z）
// 要动的零件（风车叶、摩天轮、秋千、火焰、动物）用 K.mover 单独成一个网格，build.js 每帧按 userData 动它
import { Acc, baseGeo, mat4 } from './parts.js';
let T;
export const setThree = three => { T = three; };
const TAU = Math.PI * 2, PI = Math.PI;

/** 零件工具：绑定一个累加器和当前变换 */
export function K(acc, matFor, base) {
    const B = base || new T.Matrix4(); let M = B.clone();
    const k = {
        acc, at(x, y, z, ry = 0, s = 1) { M = new T.Matrix4().multiplyMatrices(B, mat4(x, y, z, s, s, s, 0, ry, 0)); return k; },
        /** 放基础几何：kind, 材质, 位置, 尺寸, 旋转, 顶点色, 边数 */
        put(kind, mk, p, s, rot = [0, 0, 0], col, seg) { acc.add(baseGeo(kind, seg), mk, new T.Matrix4().multiplyMatrices(M, mat4(p[0], p[1], p[2], s[0], s[1], s[2], rot[0], rot[1], rot[2])), col); return k; },
        box(mk, x, y, z, w, h, d, ry = 0, col) { return k.put('box', mk, [x, y, z], [w, h, d], [0, ry, 0], col); },
        cyl(mk, x, y, z, r, h, seg = 8, col, rot) { return k.put('cyl', mk, [x, y, z], [r, h, r], rot || [0, 0, 0], col, seg); },
        tcyl(mk, x, y, z, rt, rb, h, seg = 8) { const g = new T.CylinderGeometry(rt, rb, h, seg); acc.add(g, mk, new T.Matrix4().multiplyMatrices(M, mat4(x, y, z))); g.dispose(); return k; },
        cone(mk, x, y, z, r, h, seg = 8, col, rot) { return k.put('cone', mk, [x, y, z], [r, h, r], rot || [0, 0, 0], col, seg); },
        sph(mk, x, y, z, r, seg = 8, s = [1, 1, 1], col) { return k.put('sph', mk, [x, y, z], [r * s[0], r * s[1], r * s[2]], [0, 0, 0], col, seg); },
        plane(mk, x, y, z, w, h, ry = 0, rx = 0) { return k.put('plane', mk, [x, y, z], [w, h, 1], [rx, ry, 0]); },
        raw(mk, pos, nor, idx, col) { const p = []; const v = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(M), n2 = []; for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(M); p.push(v.x, v.y, v.z); v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(nm).normalize(); n2.push(v.x, v.y, v.z); } acc.raw(mk, p, n2, idx, col); return k; },
        /** 四坡顶（庑殿）：w 宽（x）d 深（z）h 高，ridge 正脊占宽的比例，kick 翼角起翘，ov 出檐 */
        hip(mk, x, y, z, w, d, h, { ridge = .35, kick = 0, ov = .02, curve = 1.3, ry = 0 } = {}) {
            const save = M; M = new T.Matrix4().multiplyMatrices(M, mat4(x, y, z, 1, 1, 1, 0, ry, 0));
            const pos = [], nor = [], idx = [], N = 5, hw = w / 2 + ov, hd = d / 2 + ov, rl = w * ridge / 2;
            // 四个面：每个面从正脊 / 戗脊往檐口分 N 段
            const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [fx, fz] of faces) {
                const base = pos.length / 3, rows = [];
                for (let i = 0; i <= N; i++) { const u = i / N, yy = h * (1 - u) ** curve, row = []; for (let j = 0; j <= 4; j++) { const v = j / 4 - .5, c = Math.abs(v) * 2, lift = kick * u ** 3 * c ** 2; let px, pz; if (fx) { px = fx * (rl * (1 - u) + hw * u); pz = v * 2 * (hd * u + (d / 2 - .0001) * (1 - u) * .999); } else { px = v * 2 * (rl * (1 - u) + hw * u); pz = fz * hd * u; } row.push([px, yy + lift, pz]); } rows.push(row); }
                for (let i = 0; i <= N; i++) for (let j = 0; j <= 4; j++) { const [px, py, pz] = rows[i][j]; pos.push(px, py, pz); nor.push(fx * .6, .8, fz * .6); }
                for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a = base + i * 5 + j, b = a + 1, c = a + 5, dd = c + 1; if ((fx > 0) || (fz < 0)) idx.push(a, b, c, b, dd, c); else idx.push(a, c, b, b, c, dd); }
            }
            // 面上的法线：按三角形重算一遍（平均）
            const nn = new Float32Array(nor.length); for (let i = 0; i < idx.length; i += 3) { const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3; const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { nn[q] += nx; nn[q + 1] += ny; nn[q + 2] += nz; } }
            k.raw(mk, pos, Array.from(nn), idx);
            // 底面（檐口下面看得到）
            k.box('wood:x:#4a3728', 0, -.004, 0, w + ov * 2, .008, d + ov * 2);
            // 正脊
            if (rl > .005) k.box('tile:#2a2b30', 0, h, 0, rl * 2, .012, .016);
            M = save; return k;
        },
        /** 人字顶：两块斜板 + 山墙 */
        gable(mk, mkWall, x, y, z, w, d, h, { ov = .02, ry = 0, th = .008 } = {}) {
            const save = M; M = new T.Matrix4().multiplyMatrices(M, mat4(x, y, z, 1, 1, 1, 0, ry, 0));
            const L = Math.hypot(w / 2 + ov, h) , a = Math.atan2(h, w / 2 + ov);
            for (const s of [-1, 1]) k.put('box', mk, [s * (w / 4 + ov / 2), h / 2 + th / 2, 0], [L + th, th, d + ov * 2], [0, 0, -s * a]);
            for (const s of [-1, 1]) k.put('tri', mkWall, [0, 0, s * d / 2], [w, h, 1], [0, s > 0 ? 0 : PI, 0]);
            k.box('tile:#2a2b30', 0, h + th * .8, 0, .012, .012, d + ov * 2);
            M = save; return k;
        },
        /** 窗：玻璃 + 窗框（白 / 木） */
        win(x, y, z, w, h, ry = 0, frame = 'paint:#f4f1ea:0', bars = 1) { const save = M; M = new T.Matrix4().multiplyMatrices(M, mat4(x, y, z, 1, 1, 1, 0, ry, 0)); k.plane('glass', 0, 0, .002, w, h); k.box(frame, 0, h / 2, .004, w + .008, .006, .008); k.box(frame, 0, -h / 2, .004, w + .008, .006, .008); k.box(frame, -w / 2, 0, .004, .006, h, .008); k.box(frame, w / 2, 0, .004, .006, h, .008); if (bars) k.box(frame, 0, 0, .004, .004, h, .006); M = save; return k; },
        /** 门 */
        door(x, y, z, w, h, ry = 0, mk = 'wood:y:#5a3f2a') { const save = M; M = new T.Matrix4().multiplyMatrices(M, mat4(x, y, z, 1, 1, 1, 0, ry, 0)); k.box(mk, 0, h / 2, 0, w, h, .01); k.sph('gold:#d8b24a', w * .3, h * .45, .008, .004, 5); M = save; return k; },
        /** 柱廊：绕一圈柱子 */
        cols(mk, w, d, h, r, nx, nz, y = 0) { for (let i = 0; i < nx; i++) for (const z of [-d / 2, d / 2]) k.cyl(mk, -w / 2 + i * w / (nx - 1), y + h / 2, z, r, h, 8); for (let j = 1; j < nz - 1; j++) for (const x of [-w / 2, w / 2]) k.cyl(mk, x, y + h / 2, -d / 2 + j * d / (nz - 1), r, h, 8); return k; },
        /** 石灯笼 */
        lantern(x, y, z, s = 1) { const st = 'rock:#8d8a82'; k.box(st, x, y + .006 * s, z, .03 * s, .012 * s, .03 * s); k.cyl(st, x, y + .035 * s, z, .007 * s, .05 * s, 6); k.box(st, x, y + .066 * s, z, .028 * s, .01 * s, .028 * s); k.box('lamp:#ffd9a0:1.6', x, y + .084 * s, z, .02 * s, .026 * s, .02 * s); k.glow(x, y + .084 * s, z, '#ffd9a0', .1 * s, .5); k.put('wedge', st, [x, y + .108 * s, z], [.03 * s, .022 * s, .03 * s], [0, PI / 4, 0]); k.sph(st, x, y + .122 * s, z, .006 * s, 5); return k; },
        /** 挂灯笼（纸灯笼） */
        paperLamp(x, y, z, c = '#ff7a5c', r = .012) { k.sph('lamp:' + c + ':1.8', x, y, z, r, 8, [1, 1.3, 1]); k.glow(x, y, z, c, r * 9, .55); k.cyl('wood:y:#3a2a1e', x, y + r * 1.4, z, r * .45, .004, 6); k.cyl('wood:y:#3a2a1e', x, y - r * 1.4, z, r * .45, .004, 6); return k; },
        /** 夜里的光晕（加色精灵）：记下位置，build.js 生成 */
        glow(x, y, z, c = '#ffd36a', size = .12, a = .8) { const v = new T.Vector3(x, y, z).applyMatrix4(M); (acc.glows ||= []).push({ x: v.x, y: v.y, z: v.z, c, size, a }); return k; },
        /** 动的零件：单独一组网格 */
        mover(fn, data) { const a = new Acc(), kk = K(a, matFor); fn(kk); const g = a.build({}, matFor); Object.assign(g.userData, data); return g; },
    };
    return k;
}

/* ---------- 套件 ---------- */
export const KITS = {
    /* 寺庙：石台、朱柱、双层庑殿顶、檐下灯笼、香炉、求签处、石灯笼、钟 */
    temple(k, rc, r) {
        const st = 'rock:#9a978f', red = 'lacquer:#b8402c', wall = 'plaster:#efe4cf', tile = 'tile:#3a3d47';
        k.box(st, 0, .012, 0, .32, .024, .26).box(st, 0, .03, 0, .28, .012, .22);
        for (let i = 0; i < 3; i++) k.box(st, 0, .006 + i * .006, .13 + .03 - i * .012, .1, .012, .024);
        k.box(wall, 0, .09, -.01, .2, .11, .14); k.cols(red, .24, .18, .11, .008, 5, 4, .036);
        k.door(0, .036, .062, .05, .07); k.box(red, 0, .14, .0, .25, .012, .2);
        k.hip(tile, 0, .15, 0, .28, .22, .05, { ridge: .3, kick: .012, ov: .035 });
        k.box(wall, 0, .215, 0, .16, .05, .11); k.cols(red, .17, .12, .05, .006, 3, 3, .2);
        k.hip(tile, 0, .25, 0, .2, .15, .05, { ridge: .3, kick: .014, ov: .035 });
        for (const s of [-1, 1]) k.sph('gold:#e3b64f', s * .03, .305, 0, .008, 6);
        for (let i = -2; i <= 2; i++) k.paperLamp(i * .05, .128, .1, '#ff8c5a', .009);
        // 香炉
        k.cyl('metal:#4a4f58', 0, .05, .2, .022, .03, 10).cyl('metal:#4a4f58', 0, .07, .2, .028, .006, 10); for (let i = 0; i < 3; i++) k.cyl('metal:#4a4f58', Math.cos(i * 2.1) * .018, .02, .2 + Math.sin(i * 2.1) * .018, .003, .03, 5); k.cyl('rock:#6d6760', 0, .067, .2, .018, .004, 10);
        for (let i = 0; i < 7; i++) k.cyl('paint:#c9a070:0', (r() - .5) * .024, .08, .2 + (r() - .5) * .024, .0008, .025, 4);
        // 求签处：木架 + 签筒 + 系签的绳
        k.box('wood:x:#6b4a30', -.19, .05, .08, .07, .004, .04).cyl('wood:y:#6b4a30', -.22, .025, .07, .004, .05, 6).cyl('wood:y:#6b4a30', -.16, .025, .07, .004, .05, 6).cyl('wood:y:#6b4a30', -.22, .025, .09, .004, .05, 6).cyl('wood:y:#6b4a30', -.16, .025, .09, .004, .05, 6);
        k.cyl('wood:y:#8a6a4a', -.19, .064, .085, .009, .024, 8); for (let i = 0; i < 9; i++) k.cyl('wood:y:#d8c3a0', -.19 + (r() - .5) * .012, .08, .085 + (r() - .5) * .012, .0012, .02, 4);
        for (const s of [-1, 1]) k.cyl('wood:y:#6b4a30', -.19 + s * .045, .05, .14, .004, .1, 6); k.cyl('wood:y:#6b4a30', -.19, .1, .14, .002, .09, 4, null, [0, 0, PI / 2]);
        for (let i = 0; i < 14; i++) k.plane('paint:#ffffff:0', -.23 + i * .0065, .092 - r() * .004, .14, .004, .014, 0, (r() - .5) * .4);
        // 石灯笼、钟
        k.lantern(-.12, 0, .17).lantern(.12, 0, .17).lantern(-.22, 0, -.1, .8).lantern(.22, 0, -.1, .8);
        k.at(.2, 0, -.06); k.cols('wood:y:#5a3f2a', .06, .05, .09, .005, 2, 2, 0); k.hip(tile, 0, .09, 0, .08, .07, .022, { kick: .006, ov: .015 }); k.sph('metal:#6a5a3a', 0, .06, 0, .014, 10, [1, 1.3, 1]); k.cyl('metal:#6a5a3a', 0, .038, 0, .015, .006, 10); k.at(0, 0, 0);
        // 参道：碎石
        for (let i = 0; i < 40; i++) k.sph('rock:#b5b0a6', (r() - .5) * .06, .001, .17 + r() * .15, .003 + r() * .003, 4);
    },
    /* 神社：鸟居、小殿、手水舍、绘马 */
    shrine(k, rc, r) {
        const red = 'lacquer:#c7432e', wood = 'wood:y:#7a5a3c', tile = 'tile:#454852';
        k.box('rock:#9a978f', 0, .01, 0, .18, .02, .14); for (let i = 0; i < 3; i++) k.box('rock:#9a978f', 0, .005 + i * .005, .08 + .04 - i * .012, .07, .01, .022);
        k.cols(red, .13, .1, .08, .006, 3, 3, .02); k.box('plaster:#f1e9d8', 0, .06, -.01, .11, .08, .08); k.door(0, .02, .03, .04, .055, 0, 'wood:y:#4a3222');
        k.box(red, 0, .1, 0, .15, .01, .12); k.hip(tile, 0, .105, 0, .16, .13, .045, { ridge: .5, kick: .01, ov: .03 });
        for (const s of [-1, 1]) { k.box('wood:x:#3a2a1e', s * .02, .17, 0, .004, .03, .004); } k.box('wood:z:#3a2a1e', 0, .18, 0, .06, .004, .004);
        for (let i = -1; i <= 1; i++) k.paperLamp(i * .04, .085, .07, '#ffffff', .007);
        // 鸟居
        k.at(0, 0, .22); k.cyl(red, -.06, .09, 0, .007, .18, 8).cyl(red, .06, .09, 0, .007, .18, 8).box(red, 0, .165, 0, .15, .012, .012).box('lacquer:#2a2a30', 0, .19, 0, .17, .012, .02).box(red, 0, .18, 0, .018, .018, .012);
        for (const s of [-1, 1]) k.cyl('rock:#8a877f', s * .06, .005, 0, .012, .01, 8); k.at(0, 0, 0);
        // 手水舍
        k.at(.15, 0, .1); k.cols(wood, .05, .04, .07, .004, 2, 2); k.hip(tile, 0, .07, 0, .07, .06, .02, { kick: .005, ov: .012 }); k.box('rock:#777', 0, .018, 0, .04, .036, .03); k.cyl('paint:#4a7fa0:1', 0, .037, 0, .015, .002, 10); k.at(0, 0, 0);
        // 绘马架
        k.at(-.15, 0, .12); for (const s of [-1, 1]) k.cyl(wood, s * .04, .04, 0, .004, .08, 6); k.box(wood, 0, .08, 0, .09, .006, .006); k.box(wood, 0, .05, 0, .09, .004, .004); for (let i = 0; i < 9; i++) k.put('box', 'wood:x:#d7b98a', [-.036 + i * .009, .036, (r() - .5) * .004], [.009, .012, .002], [0, (r() - .5) * .3, 0]); k.at(0, 0, 0);
        k.lantern(-.08, 0, .16, .7).lantern(.08, 0, .16, .7);
        for (let i = 0; i < 30; i++) k.sph('rock:#b5b0a6', (r() - .5) * .05, .001, .12 + r() * .1, .003 + r() * .003, 4);
    },
    /* 宝塔：五层 */
    pagoda(k, rc, r) {
        const red = 'lacquer:#b23f2c', tile = 'tile:#3a3d47';
        k.box('rock:#9a978f', 0, .01, 0, .18, .02, .18);
        for (let i = 0; i < 5; i++) { const s = 1 - i * .13, y = .02 + i * .062, w = .11 * s; k.box('plaster:#efe4cf', 0, y + .025, 0, w, .05, w); k.cols(red, w + .01, w + .01, .05, .004, 3, 3, y); k.box(red, 0, y + .05, 0, w + .03, .006, w + .03); k.hip(tile, 0, y + .055, 0, w + .03, w + .03, .022, { ridge: .1, kick: .008, ov: .025 }); if (i < 4) for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.paperLamp(x * (w / 2 + .025), y + .05, z * (w / 2 + .025), '#ffb36a', .005); }
        k.cyl('gold:#e3b64f', 0, .36, 0, .004, .08, 6); for (let i = 0; i < 6; i++) k.put('torus', 'gold:#e3b64f', [0, .33 + i * .011, 0], [.012 - i * .0012, .012 - i * .0012, .012 - i * .0012], [PI / 2, 0, 0], null, 10); k.sph('gold:#e3b64f', 0, .405, 0, .006, 6);
    },
    /* 现代街道：一段马路、人行道、便利店、公寓楼、红绿灯、公交站、车 */
    street(k, rc, r) {
        const road = 'asphalt', walk = 'concrete:#c4c2bb';
        k.box(road, 0, .003, 0, .5, .006, .12); k.box(walk, 0, .006, .085, .5, .012, .05); k.box(walk, 0, .006, -.085, .5, .012, .05);
        for (let i = -5; i <= 5; i++) k.box('paint:#f4f1e8:0', i * .045, .0065, 0, .025, .001, .005);
        for (let i = -3; i <= 3; i++) k.box('paint:#f4f1e8:0', .16, .0065, i * .015, .04, .001, .008);
        for (let i = 0; i < 3; i++) k.box('paint:#f4f1e8:0', -.22 + i * .02, .0065, .052, .012, .001, .02);
        // 便利店
        k.at(-.12, .012, .125); k.box(walk, 0, .05, 0, .16, .1, .1); k.plane('glass', 0, .04, -.051, .13, .06, PI); k.box('paint:#ffffff:0', 0, .075, -.052, .13, .004, .004); k.box('paint:#2d7ac9:1', 0, .092, -.052, .16, .02, .006); k.box('lamp:#ffffff:1.4', 0, .092, -.056, .1, .012, .002); k.glow(0, .09, -.07, '#ffffff', .16, .5); k.box('paint:#e8452c:1', -.06, .092, -.056, .01, .012, .002); k.box('paint:#2fa84f:1', .06, .092, -.056, .01, .012, .002); k.door(-.035, 0, -.052, .03, .06, PI, 'metal:#aab0b8'); k.box('metal:#4a4f58', 0, .102, 0, .16, .004, .1);
        // 自动贩卖机
        k.box('paint:#e0352b:1', .095, .035, -.03, .022, .07, .02); k.plane('lamp:#ffffff:1.2', .095, .045, -.041, .016, .03, PI); k.at(0, 0, 0);
        // 公寓楼
        k.at(.14, .012, .14); k.box('concrete:#d3d0c8', 0, .12, 0, .16, .24, .12); for (let f = 0; f < 5; f++) for (let i = -2; i <= 2; i++) { k.win(i * .03, .035 + f * .045, -.061, .018, .022, PI, 'metal:#5b6068', 1); if (i % 2 == 0) k.box('concrete:#bfbcb4', i * .03, .022 + f * .045, -.068, .026, .003, .014); k.box('metal:#5b6068', i * .03, .03 + f * .045, -.074, .026, .012, .002); } k.box('concrete:#bfbcb4', 0, .245, 0, .17, .01, .13); k.box('metal:#5b6068', .05, .26, .03, .02, .02, .02); k.box('metal:#aab0b8', -.04, .265, -.02, .002, .03, .002); k.at(0, 0, 0);
        // 后排楼
        k.at(-.05, .012, -.2); k.box('concrete:#c9c6bf', 0, .09, 0, .2, .18, .1); for (let f = 0; f < 4; f++) for (let i = -3; i <= 3; i++) k.win(i * .026, .03 + f * .042, .051, .016, .02, 0, 'metal:#5b6068', 1); k.box('lamp:#ff5fa2:1.6', .06, .15, .052, .05, .012, .003); k.box('lamp:#5fd3ff:1.6', -.06, .11, .052, .04, .01, .003); k.at(0, 0, 0);
        // 红绿灯、路灯、公交站
        k.at(.2, .012, .06); k.cyl('metal:#3a3f47', 0, .06, 0, .003, .12, 6); k.box('metal:#3a3f47', -.03, .118, 0, .07, .003, .003); k.box('paint:#2a2d33:0', -.06, .105, 0, .012, .03, .01); k.sph('lamp:#ff3b30:2:1', -.06, .114, .006, .004, 6); k.sph('lamp:#ffcc00:.3:0', -.06, .105, .006, .004, 6); k.sph('lamp:#30d158:2:1', -.06, .096, .006, .004, 6); k.at(0, 0, 0);
        k.at(.02, .012, .07); k.box('metal:#5b6068', 0, .07, 0, .003, .003, .003); for (const x of [-.03, .03]) k.cyl('metal:#5b6068', x, .035, -.015, .002, .07, 5); k.box('glass', 0, .07, -.015, .07, .002, .03); k.box('paint:#e8e6df:0', 0, .07, -.03, .07, .04, .003); k.box('lamp:#ffffff:1', 0, .07, -.031, .05, .02, .001); k.box('metal:#5b6068', 0, .018, -.01, .06, .004, .015); k.at(0, 0, 0);
        KITS.lamp(k.at(-.2, .012, .07), rc, r); KITS.lamp(k.at(.1, .012, -.07), rc, r); k.at(0, 0, 0);
        // 车（动的）
        const cars = [['#d9534f', .05, -.03, 0, .6], ['#f7f7f7', -.15, .03, PI, .5], ['#3b6fc9', .14, .03, PI, .45]];
        for (const [c, x, z, ry, sp] of cars) k.acc.extra.push(k.mover(kk => { kk.box('paint:' + c + ':1', 0, .012, 0, .03, .012, .016); kk.box('paint:' + c + ':1', -.002, .022, 0, .018, .009, .015); kk.plane('glass', .008, .022, 0, .01, .008, PI / 2); kk.plane('glass', -.011, .022, 0, .01, .008, -PI / 2); for (const [wx, wz] of [[-.009, .009], [.009, .009], [-.009, -.009], [.009, -.009]]) kk.cyl('paint:#222222:0', wx, .006, wz, .005, .003, 8, null, [PI / 2, 0, 0]); kk.sph('lamp:#fff3c4:1.5', .015, .014, .006, .002, 5); kk.sph('lamp:#fff3c4:1.5', .015, .014, -.006, .002, 5); kk.sph('lamp:#ff3030:1.2', -.015, .014, .006, .002, 5); kk.sph('lamp:#ff3030:1.2', -.015, .014, -.006, .002, 5); }, { drive: { x, z, ry, v: sp, len: .22 } }));
    },
    /* 学校：两层教学楼、钟、旗杆、操场 */
    school(k, rc, r) {
        k.box('concrete:#cfc8bc', 0, .005, 0, .36, .01, .26); k.box('paint:#c96a4a:0', .08, .011, .06, .18, .002, .1); k.box('paint:#f4f1e8:0', .08, .0125, .06, .17, .001, .002); k.box('paint:#f4f1e8:0', .08, .0125, .06, .002, .001, .09);
        k.at(-.08, .01, -.04); k.box('plaster:#efe6d6', 0, .06, 0, .2, .12, .08); for (let f = 0; f < 2; f++) for (let i = -3; i <= 3; i++) k.win(i * .027, .03 + f * .055, .041, .02, .028, 0, 'paint:#f4f1ea:0', 1); k.door(0, 0, .041, .03, .05); k.box('concrete:#bfb8ac', 0, .125, 0, .21, .01, .09); k.box('plaster:#efe6d6', 0, .145, 0, .04, .03, .03); k.plane('paint:#ffffff:0', 0, .15, .016, .024, .024); k.box('paint:#333333:0', 0, .15, .017, .002, .009, .001); k.box('paint:#333333:0', .003, .152, .017, .007, .002, .001); k.at(0, 0, 0);
        k.cyl('metal:#aab0b8', .14, .09, -.06, .002, .18, 5); k.plane('paint:#e8452c:1', .155, .165, -.06, .03, .018, PI / 2);
        k.box('metal:#6b7079', .08, .03, .12, .003, .06, .003).box('metal:#6b7079', .08, .06, .12, .05, .003, .003);
        for (let i = 0; i < 6; i++) k.box('wood:x:#8a6a4a', -.16 + i * .01, .03, .11, .008, .003, .03);
    },
    /* 医院：白楼、红十字、急诊入口雨棚 */
    hospital(k, rc, r) {
        k.box('concrete:#d4d2cb', 0, .005, 0, .3, .01, .22);
        k.at(0, .01, -.02); k.box('plaster:#f5f3ee', 0, .09, 0, .22, .18, .12); for (let f = 0; f < 3; f++) for (let i = -3; i <= 3; i++) k.win(i * .028, .04 + f * .05, .061, .018, .026, 0, 'metal:#8d939c', 0); k.box('paint:#e8452c:1', 0, .175, .062, .03, .01, .004); k.box('paint:#e8452c:1', 0, .175, .062, .01, .03, .004); k.box('lamp:#ff6b5e:1.4', 0, .175, .064, .028, .008, .001);
        k.box('concrete:#bfbcb4', 0, .19, 0, .23, .01, .13); k.box('paint:#e8452c:1', 0, .198, 0, .03, .005, .03); k.box('paint:#ffffff:0', 0, .2, 0, .022, .002, .007); k.box('paint:#ffffff:0', 0, .2, 0, .007, .002, .022);
        k.box('metal:#8d939c', 0, .07, .09, .09, .004, .05); for (const x of [-.04, .04]) k.cyl('metal:#8d939c', x, .035, .11, .003, .07, 6); k.door(0, 0, .061, .05, .06, 0, 'glass'); k.box('lamp:#ff3b30:1.6', 0, .075, .116, .06, .008, .004); k.at(0, 0, 0);
        // 救护车
        k.acc.extra.push(k.mover(kk => { kk.box('paint:#f5f5f5:1', 0, .018, 0, .04, .024, .02); kk.box('paint:#f5f5f5:1', .018, .013, 0, .012, .014, .019); kk.box('paint:#e8452c:1', -.005, .02, 0, .03, .006, .0205); kk.plane('glass', .025, .017, 0, .016, .01, PI / 2); for (const [wx, wz] of [[-.012, .011], [.012, .011], [-.012, -.011], [.012, -.011]]) kk.cyl('paint:#222222:0', wx, .006, wz, .005, .003, 8, null, [PI / 2, 0, 0]); kk.sph('lamp:#ff3b30:2.5', 0, .032, 0, .004, 6); }, { drive: { x: -.08, z: .09, ry: 0, v: .3, len: .14 }, park: 1 }));
    },
    /* 咖啡馆：遮阳棚、落地窗、露天桌椅、盆栽 */
    cafe(k, rc, r) {
        const acc = rc.pal.accent;
        k.box('rock:#9a978f', 0, .005, 0, .22, .01, .2);
        k.at(0, .01, -.03); k.box('plaster:#f6efe3', 0, .055, 0, .18, .11, .12); k.plane('glass', -.03, .04, .061, .08, .055); k.box('wood:x:#5a3f2a', -.03, .07, .062, .084, .006, .006); k.box('wood:y:#5a3f2a', -.072, .04, .062, .006, .06, .006); k.box('wood:y:#5a3f2a', .012, .04, .062, .006, .06, .006); k.door(.055, 0, .062, .03, .065, 0, 'wood:y:#5a3f2a');
        for (let i = 0; i < 6; i++) k.put('box', 'paint:' + (i % 2 ? acc : '#f7f3ea') + ':0', [-.075 + i * .03, .085, .085], [.03, .004, .05], [.35, 0, 0]); k.box('wood:x:#5a3f2a', 0, .075, .065, .18, .008, .008);
        k.box('lamp:#ffd27a:1.3', .0, .1, .062, .07, .012, .004); k.glow(0, .1, .07, '#ffd27a', .14, .5); k.box('paint:#3a2a1e:0', 0, .1, .061, .074, .016, .002);
        k.gable('tile:#6b4a3a:90', 'plaster:#f6efe3', 0, .11, 0, .19, .13, .04, { ov: .015 }); k.at(0, 0, 0);
        for (const [x, z] of [[-.07, .07], [.06, .075]]) { k.cyl('metal:#3a3f47', x, .02, z, .002, .04, 5); k.cyl('metal:#3a3f47', x, .04, z, .016, .003, 12); for (let i = 0; i < 2; i++) { const a = i * PI + .5, cx = x + Math.cos(a) * .025, cz = z + Math.sin(a) * .025; k.cyl('metal:#3a3f47', cx, .012, cz, .0015, .024, 4); k.cyl('wood:y:#8a6a4a', cx, .025, cz, .008, .003, 8); k.box('metal:#3a3f47', cx - Math.cos(a) * .007, .036, cz - Math.sin(a) * .007, .003, .02, .012, -a); } }
        k.cyl('paint:#c9a070:0', -.03, .028, .085, .006, .002, 10); k.cyl('paint:#f5f5f5:0', -.03, .032, .085, .004, .006, 8);
        for (const [x, z] of [[-.1, -.02], [.1, -.02]]) { k.cyl('paint:#b5684a:0', x, .012, z, .014, .024, 9); }
    },
    /* 居酒屋 / 小酒馆：暖帘、红灯笼、招牌 */
    izakaya(k, rc, r) {
        k.box('rock:#8d8a82', 0, .005, 0, .2, .01, .16); k.at(0, .01, -.02); k.box('wood:y:#4a3626', 0, .055, 0, .16, .11, .1); k.door(.04, 0, .051, .035, .06, 0, 'wood:y:#2f2218');
        for (let i = 0; i < 3; i++) k.plane('paint:#8e2a2a:0', -.03 + i * .022, .07, .052, .02, .035); k.box('wood:x:#2f2218', -.01, .089, .053, .07, .005, .005);
        k.plane('glass', -.04, .035, .051, .05, .03); k.box('wood:x:#2f2218', -.04, .05, .052, .052, .005, .005); k.box('wood:x:#2f2218', -.04, .02, .052, .052, .005, .005);
        k.paperLamp(-.07, .095, .06, '#ff4d3a', .011).paperLamp(.07, .095, .06, '#ff4d3a', .011);
        k.box('lamp:#ffb36a:1.4', 0, .095, .055, .09, .018, .004); k.box('wood:x:#2f2218', 0, .095, .053, .094, .022, .002);
        k.gable('tile:#3a3d47', 'wood:y:#4a3626', 0, .11, 0, .17, .11, .035, { ov: .02 }); k.at(0, 0, 0);
        k.box('wood:x:#5a3f2a', -.08, .02, .07, .04, .004, .02).box('wood:x:#5a3f2a', -.08, .01, .07, .036, .02, .004);
    },
    /* 小车站：站台、雨棚、停着的小火车 */
    station(k, rc, r) {
        k.box('concrete:#bdb9b0', 0, .008, .03, .3, .016, .08); for (let i = -6; i <= 6; i++) k.box('paint:#f4d35e:0', i * .022, .017, .0, .012, .001, .006);
        for (const x of [-.1, 0, .1]) k.cyl('metal:#4a505a', x, .055, .04, .003, .08, 6); k.box('metal:#4a505a', 0, .095, .04, .3, .004, .04); k.put('box', 'tile:#556070:60', [0, .1, .04], [.32, .006, .09], [-.15, 0, 0]);
        k.box('paint:#2a3a5a:0', 0, .07, .062, .06, .02, .004); k.box('lamp:#ffffff:1', 0, .07, .064, .05, .012, .001);
        k.box('wood:x:#8a6a4a', .06, .03, .05, .05, .004, .015); k.box('wood:x:#8a6a4a', .06, .04, .044, .05, .015, .004); for (const x of [.04, .08]) k.box('metal:#4a505a', x, .015, .05, .003, .03, .012);
        for (const z of [-.055, -.025]) k.box('metal:#6b7079', 0, .004, z, .5, .004, .004); for (let i = -11; i <= 11; i++) k.box('wood:x:#5a4634', i * .022, .002, -.04, .008, .003, .045);
        k.acc.extra.push(k.mover(kk => { const c = 'paint:' + rc.pal.accent + ':1'; kk.box(c, 0, .028, 0, .14, .04, .035); kk.box('paint:#f0ede6:1', 0, .05, 0, .14, .008, .036); for (let i = -2; i <= 2; i++) { kk.plane('glass', i * .028, .032, .018, .018, .016); kk.plane('glass', i * .028, .032, -.018, .018, .016, PI); } for (const wx of [-.045, -.025, .025, .045]) for (const wz of [.012, -.012]) kk.cyl('metal:#333333', wx, .007, wz, .007, .006, 8, null, [PI / 2, 0, 0]); kk.sph('lamp:#fff3c4:1.5', .071, .03, .01, .003, 5); kk.sph('lamp:#fff3c4:1.5', .071, .03, -.01, .003, 5); }, { drive: { x: 0, z: -.04, ry: 0, v: .08, len: .18 }, train: 1 }));
    },
    /* 灯塔 */
    lighthouse(k, rc, r) {
        k.cyl('rock:#8d8a82', 0, .01, 0, .09, .02, 14);
        for (let i = 0; i < 6; i++) { const rr = .045 - i * .004; k.tcyl(i % 2 ? 'paint:#d9433a:0' : 'paint:#f4efe4:0', 0, .03 + i * .04, 0, rr - .004, rr, .04, 14); }
        k.cyl('metal:#3a3f47', 0, .27, 0, .034, .006, 14); for (let i = 0; i < 8; i++) k.cyl('metal:#3a3f47', Math.cos(i / 8 * TAU) * .03, .285, Math.sin(i / 8 * TAU) * .03, .0015, .03, 4);
        k.cyl('glass', 0, .29, 0, .024, .03, 12); k.cyl('lamp:#fff3b0:2.5', 0, .29, 0, .014, .028, 8); k.glow(0, .29, 0, '#fff3b0', .3, .8); k.cone('paint:#d9433a:0', 0, .32, 0, .034, .03, 14); k.sph('metal:#3a3f47', 0, .337, 0, .004, 5);
        k.win(0, .1, .046, .014, .02, 0, 'metal:#3a3f47', 1).win(0, .18, .041, .012, .018, 0, 'metal:#3a3f47', 1); k.door(0, .02, .047, .02, .035, 0, 'paint:#2a3a5a:0');
        k.acc.extra.push(k.mover(kk => { const g = new T.ConeGeometry(.12, 1, 12, 1, true); kk.acc.add(g, 'beam', mat4(.5, 0, 0, 1, 1, 1, 0, 0, PI / 2)); g.dispose(); }, { beam: 1, y: .29 }));
    },
    /* 风车：石基 + 木叶 */
    windmill(k, rc, r) {
        k.tcyl('rock:#9d968a', 0, .11, 0, .045, .06, .22, 12); k.cone('tile:#7a4b3a:50', 0, .25, 0, .06, .06, 12);
        k.win(0, .1, .053, .02, .025, 0, 'wood:x:#5a3f2a', 1).win(0, .17, .049, .016, .02, 0, 'wood:x:#5a3f2a', 1); k.door(0, .005, .058, .03, .05);
        k.box('wood:x:#5a3f2a', 0, .035, .06, .04, .006, .03); for (let i = 0; i < 3; i++) k.box('wood:x:#5a3f2a', 0, .005 + i * .01, .075 - i * .01, .04, .01, .012);
        k.acc.extra.push(k.mover(kk => { kk.sph('wood:y:#5a3f2a', 0, 0, 0, .012, 6); for (let i = 0; i < 4; i++) { const a = i * PI / 2; kk.put('box', 'wood:y:#7a5a3c', [Math.cos(a) * .09, Math.sin(a) * .09, 0], [.006, .18, .006], [0, 0, a + PI / 2]); for (let j = 1; j < 5; j++) kk.put('box', 'paint:#f4efe4:0', [Math.cos(a) * .035 * j + Math.sin(a) * .012, Math.sin(a) * .035 * j - Math.cos(a) * .012, 0], [.028, .004, .002], [0, 0, a]); } }, { spin: 'z', v: .5, at: [0, .22, .075] }));
    },
    /* 城堡：石墙、垛口、塔楼、尖顶、旗子 */
    castle(k, rc, r) {
        const st = 'rock:#b8b1a4', roof = 'tile:' + rc.pal.roof + ':50';
        k.box(st, 0, .05, 0, .22, .1, .16); for (let i = -4; i <= 4; i++) { k.box(st, i * .024, .108, .08, .012, .016, .012); k.box(st, i * .024, .108, -.08, .012, .016, .012); }
        for (const [x, z] of [[-.1, -.07], [.1, -.07], [-.1, .07], [.1, .07]]) { k.cyl(st, x, .09, z, .03, .18, 10); k.cone(roof, x, .21, z, .036, .06, 10); k.win(x, .12, z + .03, .012, .02, 0, 'metal:#3a3f47', 0); }
        k.cyl(st, 0, .12, 0, .04, .24, 10); k.cone(roof, 0, .275, 0, .048, .07, 10); k.cyl('metal:#3a3f47', 0, .32, 0, .0015, .03, 4); k.plane('paint:' + rc.pal.accent + ':0', .01, .33, 0, .02, .012, PI / 2);
        k.door(0, 0, .081, .04, .06, 0, 'wood:y:#4a3222'); k.box('wood:x:#5a3f2a', 0, .005, .1, .05, .006, .04); k.win(-.06, .06, .081, .016, .024, 0, 'metal:#3a3f47', 1).win(.06, .06, .081, .016, .024, 0, 'metal:#3a3f47', 1);
        k.paperLamp(-.03, .07, .085, '#ffd27a', .006).paperLamp(.03, .07, .085, '#ffd27a', .006);
    },
    /* 天文台 */
    observatory(k, rc, r) {
        k.cyl('concrete:#e2e3e6', 0, .05, 0, .06, .1, 14); k.sph('metal:#aeb4bc', 0, .1, 0, .062, 14); k.box('metal:#4a505a', 0, .13, .02, .02, .07, .05); k.win(0, .05, .061, .02, .024, 0, 'metal:#4a505a', 1); k.door(0, 0, .061, .025, .04, 0, 'metal:#4a505a');
        k.put('cyl', 'metal:#3b4250', [0, .14, .03], [.012, .09, .012], [-.7, 0, 0], null, 10); k.cyl('metal:#aeb4bc', .09, .04, 0, .003, .08, 6); k.box('paint:#f4efe4:0', .09, .085, 0, .02, .02, .02);
    },
    /* 帐篷 + 营地 */
    tent(k, rc, r) {
        const c = 'paint:' + rc.pal.accent + ':0'; k.gable(c, c, 0, .002, 0, .1, .12, .07, { ov: .008, th: .004 }); k.put('tri', 'paint:#2a2420:0', [0, .003, .062], [.04, .045, 1], [0, 0, 0]);
        k.cyl('wood:y:#5a3f2a', 0, .045, .068, .003, .09, 5); k.cyl('wood:y:#5a3f2a', 0, .045, -.068, .003, .09, 5);
        for (const [x, z] of [[-.09, .09], [.09, .09]]) k.cyl('wood:y:#5a3f2a', x, .005, z, .002, .01, 4);
        k.box('wood:x:#8a6a4a', .09, .01, -.02, .06, .006, .02).box('wood:x:#8a6a4a', .09, .005, -.02, .056, .01, .004);
        k.box('paint:#3b6fc9:0', -.09, .012, -.03, .03, .024, .02); k.cyl('paint:#f4efe4:0', -.06, .008, .06, .01, .012, 10);
    },
    /* 木屋：圆木叠墙、人字顶、石烟囱、门廊 */
    cabin(k, rc, r) {
        const log = 'wood:x:#8b6a4b', logZ = 'wood:z:#8b6a4b';
        k.box('rock:#777', 0, .008, 0, .17, .016, .14);
        for (let i = 0; i < 7; i++) { const y = .022 + i * .014; k.cyl(log, 0, y, .06, .007, .18, 7, null, [0, 0, PI / 2]); k.cyl(log, 0, y, -.06, .007, .18, 7, null, [0, 0, PI / 2]); k.cyl(logZ, .08, y + .007, 0, .007, .14, 7, null, [PI / 2, 0, 0]); k.cyl(logZ, -.08, y + .007, 0, .007, .14, 7, null, [PI / 2, 0, 0]); }
        k.box('wood:x:#5a3f2a', 0, .07, 0, .15, .1, .11);
        k.gable('tile:#4a3a30:70', 'wood:x:#6b4a30', 0, .12, 0, .17, .14, .06, { ov: .025 }); k.box('rock:#777', .05, .15, -.02, .025, .09, .025);
        k.door(0, .016, .066, .035, .06); k.win(-.05, .06, .066, .03, .028, 0, 'paint:#f4f1ea:0', 1).win(.085, .06, 0, .03, .028, PI / 2, 'paint:#f4f1ea:0', 1);
        k.box('wood:x:#8b6a4b', 0, .014, .1, .17, .008, .06); for (const x of [-.07, .07]) k.cyl('wood:y:#8b6a4b', x, .07, .12, .005, .11, 6); k.box('wood:x:#8b6a4b', 0, .125, .11, .19, .006, .08, 0);
        k.paperLamp(0, .1, .125, '#ffd27a', .006); k.box('wood:x:#8a6a4a', -.11, .02, .11, .03, .004, .015);
        for (let i = 0; i < 8; i++) k.cyl(logZ, .1 + (i % 4) * .012, .006 + (i / 4 | 0) * .011, -.09, .005, .04, 6, null, [PI / 2, 0, 0]);
    },
    /* 民居：灰泥墙、瓦顶、烟囱、小院篱笆 */
    house(k, rc, r) {
        const wall = 'plaster:' + rc.pal.wall, tile = 'tile:' + rc.pal.roof + ':80';
        k.box('rock:#8d8a82', 0, .006, 0, .15, .012, .13); k.box(wall, 0, .06, 0, .13, .1, .11);
        k.gable(tile, wall, 0, .11, 0, .15, .13, .055, { ov: .022 }); k.box('rock:#6d6760', -.04, .14, -.02, .02, .07, .02);
        k.door(.03, .012, .056, .03, .055); k.win(-.035, .06, .056, .03, .03, 0, 'paint:#f4f1ea:0', 1).win(.0, .06, -.056, .03, .03, PI, 'paint:#f4f1ea:0', 1).win(.066, .06, 0, .03, .03, PI / 2, 'paint:#f4f1ea:0', 1);
        k.cyl('paint:#b5684a:0', -.06, .02, .08, .01, .016, 8);
        for (let i = 0; i < 9; i++) k.box('wood:y:#d8c3a0', -.1 + i * .025, .018, .1, .006, .024, .004); k.box('wood:x:#d8c3a0', 0, .022, .1, .22, .004, .003);
    },
    /* 钟楼 */
    tower(k, rc, r) {
        const st = 'rock:#b0a99c'; k.box(st, 0, .14, 0, .09, .28, .09); k.box(st, 0, .29, 0, .1, .02, .1); for (let i = -1; i <= 1; i++) { k.box(st, i * .035, .31, .045, .014, .018, .01); k.box(st, i * .035, .31, -.045, .014, .018, .01); }
        k.cone('tile:' + rc.pal.roof + ':50', 0, .35, 0, .06, .1, 4, null, [0, PI / 4, 0]); k.cyl('gold:#e3b64f', 0, .41, 0, .003, .03, 5);
        for (const ry of [0, PI / 2, PI, -PI / 2]) { const dx = Math.sin(ry) * .046, dz = Math.cos(ry) * .046; k.put('cyl', 'paint:#f8f4ea:0', [dx, .24, dz], [.028, .002, .028], [PI / 2, ry, 0], null, 20); k.put('box', 'paint:#2a2a2a:0', [dx, .244, dz], [.003, .02, .001], [0, ry, .3]); k.put('box', 'paint:#2a2a2a:0', [dx, .244, dz], [.003, .014, .001], [0, ry, -1.3]); }
        k.door(0, 0, .046, .03, .05, 0, 'wood:y:#4a3222'); k.win(0, .12, .046, .018, .03, 0, 'metal:#3a3f47', 1).win(0, .18, .046, .018, .03, 0, 'metal:#3a3f47', 1);
    },
    /* 金字塔 + 狮身人面 + 方尖碑 */
    pyramid(k, rc, r) {
        for (let i = 0; i < 9; i++) { const s = .19 * (1 - i / 9); k.box('rock:#d9b982', 0, .011 + i * .022, 0, s, .022, s); }
        k.box('rock:#d9b982', .17, .012, .07, .06, .024, .025); k.sph('rock:#d9b982', .19, .035, .07, .013, 8); k.box('rock:#d9b982', .19, .045, .07, .02, .012, .024);
        k.box('rock:#c9a86a', -.17, .04, .08, .014, .08, .014); k.cone('rock:#c9a86a', -.17, .085, .08, .01, .012, 4);
    },
    /* 摩天轮 */
    ferris(k, rc, r) {
        const fr = 'metal:#6b7079'; for (const s of [-1, 1]) { k.put('cyl', fr, [s * .06, .12, 0], [.006, .26, .006], [0, 0, -s * .3], null, 6); k.put('cyl', fr, [s * .06, .12, .03], [.004, .26, .004], [0, 0, -s * .3], null, 6); } k.box('concrete:#c4c2bb', 0, .006, 0, .2, .012, .1);
        k.box('paint:' + rc.pal.accent + ':1', 0, .03, .07, .05, .04, .03); k.box('lamp:#ffffff:1.2', 0, .052, .086, .04, .008, .002);
        k.acc.extra.push(k.mover(kk => { kk.put('torus', 'paint:#f0f2f5:1', [0, 0, 0], [.13, .13, .13], [0, 0, 0], null, 36); kk.put('torus', 'paint:#f0f2f5:1', [0, 0, .02], [.13, .13, .13], [0, 0, 0], null, 36); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; kk.put('cyl', fr, [Math.cos(a) * .065, Math.sin(a) * .065, .01], [.003, .13, .003], [0, 0, a + PI / 2], null, 5); const c = ['#f2a7b5', '#9fc6e8', '#f5d27a', '#a8e6a1'][i % 4]; kk.box('paint:' + c + ':1', Math.cos(a) * .13, Math.sin(a) * .13 - .012, .01, .024, .022, .022); kk.plane('glass', Math.cos(a) * .13, Math.sin(a) * .13 - .01, .022, .016, .012); kk.sph('lamp:' + c + ':1.6', Math.cos(a) * .13, Math.sin(a) * .13, .035, .004, 5); } }, { spin: 'z', v: .25, at: [0, .25, .0], keepUp: 1 }));
    },
    /* 路灯 */
    lamp(k, rc, r) { k.tcyl('metal:#3a3f47', 0, .07, 0, .003, .005, .14, 6); k.cyl('metal:#3a3f47', 0, .15, 0, .002, .03, 5, null, [0, 0, PI / 2]); k.put('cyl', 'metal:#3a3f47', [.015, .15, 0], [.008, .008, .008], [0, 0, 0], null, 6); k.sph('lamp:#ffe2a0:1.6', .015, .143, 0, .006, 7); k.glow(.015, .14, 0, '#ffe2a0', .14, .7); },
    /* 长椅 */
    bench(k, rc, r) { const w = 'wood:x:' + rc.pal.wood; for (let i = 0; i < 3; i++) k.box(w, 0, .025, -.012 + i * .012, .08, .004, .01); for (let i = 0; i < 2; i++) k.put('box', w, [0, .045 + i * .012, -.02], [.08, .009, .004], [.15, 0, 0]); for (const x of [-.03, .03]) { k.box('metal:#3a3f47', x, .012, 0, .004, .024, .03); k.put('box', 'metal:#3a3f47', [x, .04, -.022], [.004, .04, .004], [.15, 0, 0]); } },
    /* 篝火 */
    bonfire(k, rc, r) {
        for (let i = 0; i < 5; i++) k.put('cyl', 'wood:x:#4a3220', [0, .008, 0], [.006, .07, .006], [0, i * 1.26, PI / 2 - .35], null, 5);
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; k.sph('rock:#6e6a63', Math.cos(a) * .035, .006, Math.sin(a) * .035, .009, 6, [1 + r() * .4, .7, 1]); }
        k.acc.extra.push(k.mover(kk => { kk.cone('lamp:#ff7a1f:6:1', 0, .03, 0, .02, .055, 7); kk.cone('lamp:#ffd23a:7:1', 0, .028, 0, .011, .04, 6); }, { flame: 1 })); k.glow(0, .04, 0, '#ffa040', .22, .8);
    },
    /* 秋千 */
    swing(k, rc, r) {
        const w = 'wood:y:' + rc.pal.wood; for (const s of [-1, 1]) { k.put('cyl', w, [s * .045, .07, .02], [.005, .15, .005], [.15, 0, s * .2], null, 6); k.put('cyl', w, [s * .045, .07, -.02], [.005, .15, .005], [-.15, 0, s * .2], null, 6); } k.cyl(w, 0, .14, 0, .005, .11, 6, null, [0, 0, PI / 2]);
        k.acc.extra.push(k.mover(kk => { for (const x of [-.02, .02]) kk.cyl('paint:#999999:0', x, -.05, 0, .0012, .1, 4); kk.box('paint:' + rc.pal.accent + ':0', 0, -.1, 0, .05, .006, .02); }, { swing: 1, at: [0, .14, 0] }));
    },
    /* 池塘：水、石头、荷叶 */
    pond(k, rc, r) { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + r() * .3; k.sph('rock:#8a7e6c', Math.cos(a) * .11, .004, Math.sin(a) * .11, .012, 6, [1 + r() * .5, .6, 1]); } for (let i = 0; i < 8; i++) { const a = r() * TAU, d = r() * .08; k.put('cyl', 'paint:#4f8a3a:0', [Math.cos(a) * d, .006, Math.sin(a) * d], [.012, .001, .012], [0, 0, 0], null, 9); if (i < 3) k.sph('paint:#f5a8c0:0', Math.cos(a) * d, .01, Math.sin(a) * d, .006, 6, [1, .7, 1]); } },
    hotspring(k, rc, r) { for (let i = 0; i < 11; i++) { const a = i / 11 * TAU; k.sph('rock:#8a8580', Math.cos(a) * .075, .006, Math.sin(a) * .075, .014, 6, [1.2, .7, 1]); } k.box('wood:x:#5a3f2a', .07, .03, -.07, .03, .003, .02); for (const x of [.06, .08]) k.cyl('wood:y:#5a3f2a', x, .015, -.07, .003, .03, 5); k.sph('paint:#f5f5f5:0', .04, .012, .06, .008, 6); },
    crater(k, rc, r) { k.tcyl('rock:#3b312c', 0, .045, 0, .09, .15, .09, 12); k.cyl('lamp:#ff4a12:4:1', 0, .09, 0, .07, .004, 12); for (let i = 0; i < 6; i++) { const a = r() * TAU; k.put('box', 'lamp:#ff7a2a:3:1', [Math.cos(a) * .11, .03 + r() * .03, Math.sin(a) * .11], [.004, .05, .003], [0, a, .8]); } },
    rock(k, rc, r) { k.sph('rock:' + rc.pal.cliff, 0, .012, 0, .03, 7, [1 + r() * .7, .6 + r() * .4, 1 + r() * .5]); if (r() < .5) k.sph('rock:' + rc.pal.cliff, .025, .006, .015, .014, 6, [1.2, .7, 1]); },
    /* 动物 */
    sheep(k, rc, r) { const w = 'paint:#f3f1ea:0'; k.sph(w, 0, .028, 0, .02, 8, [1.3, 1, 1]); for (let i = 0; i < 5; i++) k.sph(w, (r() - .5) * .03, .03 + r() * .012, (r() - .5) * .022, .011, 6); k.sph('paint:#3b3a40:0', .03, .036, 0, .011, 7, [1.2, 1, 1]); for (const [x, z] of [[-.012, -.01], [.012, -.01], [-.012, .01], [.012, .01]]) k.cyl('paint:#3b3a40:0', x, .008, z, .003, .018, 5); },
    fox(k, rc, r) { const o = 'paint:#e0772f:0'; k.sph(o, 0, .025, 0, .018, 8, [1.6, 1, 1]); k.sph(o, .028, .034, 0, .013, 7); k.cone(o, .025, .05, .006, .005, .012, 4); k.cone(o, .025, .05, -.006, .005, .012, 4); k.put('cone', o, [-.03, .028, 0], [.01, .04, .01], [0, 0, PI / 2 - .4], null, 6); k.sph('paint:#ffffff:0', -.048, .036, 0, .006, 5); k.sph('paint:#ffffff:0', .036, .028, 0, .007, 5); for (const [x, z] of [[-.01, -.008], [.012, -.008], [-.01, .008], [.012, .008]]) k.cyl('paint:#3b2a20:0', x, .008, z, .0025, .016, 4); },
    boat(k, rc, r) { k.box('wood:x:' + rc.pal.wood, 0, .006, 0, .06, .012, .024); k.box('wood:x:' + rc.pal.wood, 0, .013, 0, .064, .003, .028); k.cyl('wood:y:#6b5a4a', 0, .04, 0, .002, .07, 5); k.put('tri', 'paint:#fff4da:0', [.02, .02, 0], [.045, .05, 1], [0, PI / 2, 0]); k.put('tri', 'paint:#fff4da:0', [.02, .02, 0], [.045, .05, 1], [0, -PI / 2, 0]); },
    bridge(k, rc, r) { for (let i = 0; i < 9; i++) k.put('box', 'wood:x:' + rc.pal.wood, [-.08 + i * .02, .015 + Math.sin(i / 8 * PI) * .02, 0], [.02, .005, .05], [0, 0, -Math.cos(i / 8 * PI) * .3]); for (const z of [-.025, .025]) { for (let i = 0; i < 5; i++) k.cyl('wood:y:' + rc.pal.wood, -.08 + i * .04, .03 + Math.sin(i / 4 * PI) * .02, z, .003, .03, 5); k.put('cyl', 'lacquer:#b8402c', [0, .05, z], [.003, .17, .003], [0, 0, PI / 2], null, 5); } },
};
/** 树种之外、零件库里没有的类型会落到这里：什么都不画 */
export const hasKit = t => !!KITS[t];
