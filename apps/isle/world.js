// 心屿 · 球里的 3D 小世界：七种风景（随机换）+ 心情天气
// 坐标：球心为原点、球半径为 1；世界 y 朝上。M 是「世界 → 屏幕」的旋转矩阵（3×3，按行存），屏幕 x 向右、y 向上、z 朝向看的人。
// 用正交投影，所有东西都按真实的三维位置画：转球、把岛翻到朝下，看到的就是岛的底部。
const TAU = Math.PI * 2;

/* ---------- 矩阵 ---------- */
export const Rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const Ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const Rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export const mul = (a, b) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; };
/** 绕任意轴（单位向量）转 a 弧度 */
export const Raxis = (x, y, z, a) => { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]; };
/** 防止反复相乘后矩阵变形 */
export const ortho = M => {
    let a = [M[0], M[3], M[6]], b = [M[1], M[4], M[7]];
    const n = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    a = n(a); const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; b = n([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]);
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
};
const ap = (M, x, y, z) => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];

/* ---------- 随机（同一座岛每次布局一样） ---------- */
export const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
export const hash = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* ---------- 颜色：暗天气时整体压暗（灯光不压） ---------- */
const cache = new Map();
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const shade = (h, k) => { const key = h + k; let v = cache.get(key); if (v) return v; const [r, g, b] = hexRgb(h); v = `rgb(${r * (1 - k) + 18 * k | 0},${g * (1 - k) + 26 * k | 0},${b * (1 - k) + 58 * k | 0})`; cache.set(key, v); return v; };

/* ---------- 心情天气 ---------- */
export const SCENES = { sun: '晴', sunset: '落日', rain: '细雨', storm: '风暴', aurora: '极光', night: '星夜', fog: '薄雾', fireworks: '烟花' };
const SKY = { sun: ['#7cc6f5', '#dff2ff'], sunset: ['#f39a7a', '#ffe0b0'], rain: ['#748aa1', '#b9c6d2'], storm: ['#252d3d', '#525d72'], aurora: ['#06112b', '#183460'], night: ['#0a1230', '#2b376a'], fog: ['#c2cbd2', '#eef1f3'], fireworks: ['#131533', '#2e2f63'] };
const DIM = { sun: 0, sunset: .12, rain: .22, storm: .45, aurora: .42, night: .5, fog: .1, fireworks: .45 };
export const isDark = s => DIM[s] >= .4;

/* ---------- 风景 ---------- */
// land：浮空岛（顶面 + 侧面 + 底下的岩石）；sea：一整片海面，岛只是一小块礁石
export const BIOMES = {
    city: { name: '城市', top: '#b7bdc3', side: '#8c939a', rock: '#5f6670' },
    sakura: { name: '樱花林', top: '#a9d18f', side: '#8a6a50', rock: '#6b5242', fall: 'petal' },
    ocean: { name: '大海', top: '#ecd8a9', side: '#c8b083', rock: '#8a7457', sea: true },
    snow: { name: '雪原', top: '#f1f5fa', side: '#c9d6e3', rock: '#7d8ea1', fall: 'snow' },
    meadow: { name: '风车草原', top: '#94c96f', side: '#8a6a50', rock: '#6a523f' },
    autumn: { name: '枫林', top: '#d9a55e', side: '#8a6146', rock: '#5f4636', fall: 'leaf' },
    desert: { name: '沙漠绿洲', top: '#ebcd8f', side: '#cfa66a', rock: '#a77d4c' }
};
export const BIOME_KEYS = Object.keys(BIOMES);
/** 随机挑一个，不和上一次一样 */
export const pickBiome = (last, r = Math.random) => { const ks = BIOME_KEYS.filter(k => k !== last); return ks[Math.floor(r() * ks.length) % ks.length]; };

/* ---------- 小物件（以底部中点为原点，往上是 -y，高度约 40） ---------- */
const P = {
    pine(x, c, snowy) { x.fillStyle = c('#6b4b35'); x.fillRect(-2, -8, 4, 8); for (let i = 0; i < 3; i++) { const w = 15 - i * 3.5, y = -6 - i * 9; x.fillStyle = c(i % 2 ? '#3f8a63' : '#2f6b4f'); x.beginPath(); x.moveTo(-w, y); x.lineTo(0, y - 15); x.lineTo(w, y); x.fill(); if (snowy) { x.fillStyle = c('#ffffff'); x.beginPath(); x.moveTo(-w * .45, y - 9); x.lineTo(0, y - 15); x.lineTo(w * .45, y - 9); x.quadraticCurveTo(0, y - 7, -w * .45, y - 9); x.fill(); } } },
    round(x, c, cols) { x.fillStyle = c('#7a5639'); x.fillRect(-2.5, -14, 5, 14); [[0, -26, 12], [-8, -20, 9], [8, -20, 9], [0, -16, 9]].forEach(([a, b, r], i) => { x.fillStyle = c(cols[i % cols.length]); x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); }); },
    sakura(x, c, t) { x.strokeStyle = c('#7b5644'); x.lineCap = 'round'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(2, -12, -2, -22); x.stroke(); x.lineWidth = 2.2; x.beginPath(); x.moveTo(-1, -16); x.lineTo(9, -24); x.moveTo(-1, -19); x.lineTo(-10, -26); x.stroke(); const s = Math.sin(t * 1.4) * .8; [[0, -32, 13, '#f6b5c9'], [-12, -27, 10, '#f9cfdc'], [12, -27, 10, '#ef9ab3'], [-5, -22, 8, '#fbd9e4'], [7, -21, 8, '#f6b5c9']].forEach(([a, b, r, col]) => { x.fillStyle = c(col); x.beginPath(); x.arc(a + s, b, r, 0, TAU); x.fill(); }); },
    palm(x, c, t) { x.strokeStyle = c('#8a6c4b'); x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(5, -16, 2, -32); x.stroke(); const s = Math.sin(t * 1.2) * .06; for (let i = 0; i < 6; i++) { x.save(); x.translate(2, -32); x.rotate(i / 6 * TAU + .2 + s); x.fillStyle = c(i % 2 ? '#3f7d5c' : '#5d9a6e'); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(7, -8, 16, -4, 20, 6); x.quadraticCurveTo(9, -1, 0, 0); x.fill(); x.restore(); } },
    cactus(x, c) { x.fillStyle = c('#4f9a5d'); const r = (a, b, w, h) => { x.beginPath(); x.roundRect(a, b, w, h, w / 2); x.fill(); }; r(-4, -30, 8, 30); r(-12, -20, 6, 12); r(-12, -12, 10, 5); r(6, -24, 6, 12); r(3, -16, 9, 5); },
    building(x, c, w, h, col, lit, sd) { x.fillStyle = c(col); x.fillRect(-w / 2, -h, w, h); x.fillStyle = c('#00000022'); x.fillRect(w / 2 - w * .28, -h, w * .28, h); const r = rng(sd); for (let yy = -h + 5; yy < -5; yy += 7) for (let xx = -w / 2 + 3; xx < w / 2 - 4; xx += 6) { x.fillStyle = lit ? (r() < .55 ? '#ffd76a' : c('#3b4660')) : c(r() < .3 ? '#cfe6f5' : '#9fb7c9'); x.fillRect(xx, yy, 3, 4); } x.fillStyle = c('#5f6670'); x.fillRect(-w / 2 - 1, -h - 2, w + 2, 2); },
    house(x, c, wall, roof, lit) { x.fillStyle = c(wall); x.fillRect(-11, -14, 22, 14); x.fillStyle = c(roof); x.beginPath(); x.moveTo(-14, -14); x.lineTo(0, -26); x.lineTo(14, -14); x.fill(); x.fillStyle = c('#6b5a4a'); x.fillRect(5, -24, 4, 7); x.fillStyle = lit ? '#ffd76a' : c('#7c95a8'); x.fillRect(-7, -10, 6, 5); x.fillStyle = c('#8a6146'); x.fillRect(2, -9, 5, 9); if (lit) { x.fillStyle = 'rgba(255,215,106,.25)'; x.beginPath(); x.arc(-4, -8, 11, 0, TAU); x.fill(); } },
    windmill(x, c, t) { x.fillStyle = c('#efe6d6'); x.beginPath(); x.moveTo(-8, 0); x.lineTo(-5, -34); x.lineTo(5, -34); x.lineTo(8, 0); x.fill(); x.fillStyle = c('#b5534a'); x.beginPath(); x.moveTo(-7, -34); x.lineTo(0, -41); x.lineTo(7, -34); x.fill(); x.fillStyle = c('#7a5639'); x.fillRect(-3, -8, 6, 8); x.save(); x.translate(0, -36); x.rotate(t * .9); for (let i = 0; i < 4; i++) { x.rotate(TAU / 4); x.fillStyle = c('#f8f3ea'); x.fillRect(1, -2.5, 20, 5); x.strokeStyle = c('#a99b87'); x.lineWidth = .6; x.strokeRect(1, -2.5, 20, 5); } x.fillStyle = c('#7a5639'); x.beginPath(); x.arc(0, 0, 2.5, 0, TAU); x.fill(); x.restore(); },
    lighthouse(x, c, on, t) { for (let i = 0; i < 5; i++) { x.fillStyle = c(i % 2 ? '#c4554d' : '#f7f1e4'); x.beginPath(); x.moveTo(-(7 - i) , -i * 8); x.lineTo(7 - i, -i * 8); x.lineTo(6.4 - i, -(i + 1) * 8); x.lineTo(-(6.4 - i), -(i + 1) * 8); x.fill(); } x.fillStyle = c('#3a3a44'); x.fillRect(-3.5, -46, 7, 6); x.fillStyle = on ? '#fff3b0' : c('#9aa9aa'); x.beginPath(); x.arc(0, -43, 2.6, 0, TAU); x.fill(); if (on) { x.save(); x.translate(0, -43); x.rotate(t * 1.2); const g = x.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, 'rgba(255,240,170,.55)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(70, -12); x.lineTo(70, 12); x.fill(); x.restore(); } },
    snowman(x, c) { x.fillStyle = c('#ffffff'); x.beginPath(); x.arc(0, -8, 8, 0, TAU); x.arc(0, -21, 6, 0, TAU); x.fill(); x.fillStyle = c('#2d2d36'); x.fillRect(-4, -31, 8, 4); x.fillRect(-6, -27.5, 12, 1.5); x.fillStyle = '#ef8a3a'; x.beginPath(); x.moveTo(0, -21); x.lineTo(6, -20); x.lineTo(0, -19); x.fill(); x.fillStyle = c('#c94b4b'); x.fillRect(-6, -16, 12, 2.5); },
    sheep(x, c) { x.fillStyle = c('#fbfaf6'); [[-4, -7], [3, -8], [0, -10], [6, -6], [-6, -5]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 4.5, 0, TAU); x.fill(); }); x.fillStyle = c('#3b3a40'); x.beginPath(); x.ellipse(9, -8, 3, 2.5, 0, 0, TAU); x.fill(); x.fillRect(-4, -3, 1.5, 3); x.fillRect(3, -3, 1.5, 3); },
    lamp(x, c, on) { x.fillStyle = c('#4a505a'); x.fillRect(-1, -24, 2, 24); x.fillRect(-1, -24, 6, 2); x.fillStyle = on ? '#ffe28a' : c('#d9dde2'); x.beginPath(); x.arc(5, -21, 2.5, 0, TAU); x.fill(); if (on) { x.fillStyle = 'rgba(255,226,138,.22)'; x.beginPath(); x.arc(5, -18, 10, 0, TAU); x.fill(); } },
    torii(x, c) { x.fillStyle = c('#d2463b'); x.fillRect(-12, -26, 3, 26); x.fillRect(9, -26, 3, 26); x.fillRect(-16, -29, 32, 3); x.fillRect(-13, -22, 26, 2.5); x.fillStyle = c('#2d2d36'); x.fillRect(-17, -31, 34, 2); },
    bench(x, c) { x.fillStyle = c('#8a6146'); x.fillRect(-9, -7, 18, 2.5); x.fillRect(-9, -12, 18, 2); x.fillStyle = c('#4a505a'); x.fillRect(-8, -5, 1.5, 5); x.fillRect(6.5, -5, 1.5, 5); },
    tent(x, c) { x.fillStyle = c('#e07b5a'); x.beginPath(); x.moveTo(-13, 0); x.lineTo(0, -18); x.lineTo(13, 0); x.fill(); x.fillStyle = c('#5b3a2e'); x.beginPath(); x.moveTo(-3, 0); x.lineTo(0, -9); x.lineTo(3, 0); x.fill(); },
    pyramid(x, c) { x.fillStyle = c('#e2bd7a'); x.beginPath(); x.moveTo(-24, 0); x.lineTo(0, -28); x.lineTo(24, 0); x.fill(); x.fillStyle = c('#c79d5c'); x.beginPath(); x.moveTo(0, -28); x.lineTo(24, 0); x.lineTo(6, 0); x.fill(); },
    wheel(x, c, t, lit) { x.strokeStyle = c('#6c7480'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(-8, 0); x.lineTo(0, -22); x.lineTo(8, 0); x.stroke(); x.save(); x.translate(0, -22); x.strokeStyle = c('#e9eef3'); x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, 16, 0, TAU); x.stroke(); x.rotate(t * .25); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); x.stroke(); x.fillStyle = lit ? ['#ffd76a', '#ff9ab1', '#9fe3ff'][i % 3] : c(['#f2a7b5', '#9fc6e8', '#f5d27a'][i % 3]); x.fillRect(Math.cos(a) * 16 - 2, Math.sin(a) * 16 - 2, 4, 4); } x.restore(); },
    boat(x, c) { x.fillStyle = c('#a57a61'); x.beginPath(); x.moveTo(-12, -4); x.lineTo(12, -4); x.lineTo(7, 2); x.lineTo(-7, 2); x.fill(); x.fillStyle = c('#fff4da'); x.beginPath(); x.moveTo(0, -27); x.lineTo(0, -6); x.lineTo(13, -6); x.fill(); },
    whale(x, c, t) { const up = Math.max(0, Math.sin(t * .8)); x.fillStyle = c('#4a7fc4'); x.beginPath(); x.ellipse(0, 2 - up * 6, 16, 7, 0, Math.PI, TAU); x.fill(); x.beginPath(); x.moveTo(14, -up * 6); x.lineTo(24, -6 - up * 6); x.lineTo(22, -up * 6 + 1); x.fill(); if (up > .6) { x.strokeStyle = 'rgba(220,240,255,.8)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-8, -10); x.quadraticCurveTo(-10, -18, -14, -20); x.moveTo(-8, -10); x.quadraticCurveTo(-6, -18, -2, -20); x.stroke(); } },
    rock(x, c, col) { x.fillStyle = c(col); x.beginPath(); x.ellipse(0, -3, 7, 4.5, 0, Math.PI, TAU); x.fill(); }
};

/** 按风景摆东西：返回 [{ p:[x,y,z], s, d:(ctx, shade, ctx2) }]，ground 是顶面上的平面图案 */
function layout(key, seed) {
    const r = rng(seed), B = BIOMES[key], items = [], gr = B.sea ? .26 : .7;
    const spot = (minR, maxR) => { const a = r() * TAU, d = minR + Math.sqrt(r()) * (maxR - minR); return [Math.cos(a) * d * gr, Math.sin(a) * d * gr]; };
    const add = (n, f, s = 1, minR = .1, maxR = .92) => { for (let i = 0; i < n; i++) { const [x, z] = spot(minR, maxR); items.push({ x, z, s: s * (.85 + r() * .3), d: f, k: r() * 1e6 | 0 }); } };
    const one = (x, z, f, s = 1) => items.push({ x: x * gr, z: z * gr, s, d: f, k: r() * 1e6 | 0 });
    if (key === 'city') {
        const cols = ['#9fb1c6', '#c7b49c', '#b8c2cc', '#d9a99c', '#a8b8a4', '#c9c2d8'];
        for (let i = 0; i < 9; i++) { const [x, z] = spot(.25, .9), w = 10 + r() * 8, h = 22 + r() * 34, col = cols[i % cols.length]; items.push({ x, z, s: 1, k: r() * 1e6 | 0, d: (c, sh, e) => P.building(c, sh, w, h, col, e.lit, e.k) }); }
        one(0, 0, (c, sh, e) => P.wheel(c, sh, e.t, e.lit), 1.1);
        add(4, (c, sh, e) => P.lamp(c, sh, e.lit), .8, .15, .5);
        add(2, (c, sh) => P.round(c, sh, ['#5f9f6a', '#78b47b']), .8, .2, .6);
    } else if (key === 'sakura') {
        add(7, (c, sh, e) => P.sakura(c, sh, e.t), 1, .25, .95);
        one(0, .05, (c, sh) => P.torii(c, sh), 1);
        add(1, (c, sh) => P.bench(c, sh), 1, .3, .5);
        add(2, (c, sh, e) => P.lamp(c, sh, e.lit), .8, .3, .6);
    } else if (key === 'ocean') {
        one(.15, -.2, (c, sh, e) => P.lighthouse(c, sh, e.lit || e.wet, e.t), 1);
        one(-.45, .2, (c, sh, e) => P.palm(c, sh, e.t), .8);
        one(.4, .45, (c, sh, e) => P.house(c, sh, '#f4e9d4', '#b5684f', e.lit), .8);
        add(3, (c, sh) => P.rock(c, sh, '#9a8a74'), .8, .7, .95);
    } else if (key === 'snow') {
        add(8, (c, sh) => P.pine(c, sh, true), 1, .35, .95);
        one(-.1, .25, (c, sh) => P.snowman(c, sh), 1);
        one(.3, -.2, (c, sh, e) => P.house(c, sh, '#8a6146', '#f3f6fa', true), 1);
    } else if (key === 'meadow') {
        one(.1, -.15, (c, sh, e) => P.windmill(c, sh, e.t), 1.2);
        add(4, (c, sh) => P.sheep(c, sh), 1, .2, .85);
        add(3, (c, sh) => P.round(c, sh, ['#4f8f57', '#6aa86b', '#5d9a60']), 1, .55, .95);
        one(-.45, .3, (c, sh, e) => P.house(c, sh, '#fff6e6', '#c46c4f', e.lit), .9);
    } else if (key === 'autumn') {
        add(7, (c, sh) => P.round(c, sh, ['#e8743b', '#f2a33a', '#c9472c', '#e05a35']), 1.05, .25, .95);
        add(1, (c, sh) => P.bench(c, sh), 1, .1, .3);
        one(.35, .25, (c, sh) => P.tent(c, sh), 1);
        add(2, (c, sh, e) => P.lamp(c, sh, e.lit), .8, .2, .5);
    } else if (key === 'desert') {
        one(-.2, -.35, (c, sh) => P.pyramid(c, sh), 1.3);
        add(4, (c, sh) => P.cactus(c, sh), .9, .4, .95);
        for (let i = 0; i < 3; i++) { const a = r() * TAU; one(.42 + Math.cos(a) * .2, .3 + Math.sin(a) * .2, (c, sh, e) => P.palm(c, sh, e.t), .75); }
        one(-.4, .45, (c, sh) => P.tent(c, sh), .9);
    }
    return items.map(o => ({ ...o, p: [o.x, 0, o.z] }));
}

/** 顶面上的平面图案（在顶面自己的坐标里画，单位 = 球半径） */
function ground(x, key, gr, sh, r) {
    const dot = (cols, n, rad) => { for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * gr * .95; x.fillStyle = sh(cols[i % cols.length]); x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, rad, 0, TAU); x.fill(); } };
    if (key === 'city') { x.fillStyle = sh('#d3d8dc'); x.beginPath(); x.arc(0, 0, gr * .32, 0, TAU); x.fill(); x.strokeStyle = sh('#6f777f'); x.lineWidth = .05; x.beginPath(); x.moveTo(-gr, .02); x.lineTo(gr, .02); x.moveTo(.02, -gr); x.lineTo(.02, gr); x.stroke(); x.strokeStyle = sh('#f2f2ea'); x.lineWidth = .006; x.setLineDash([.03, .03]); x.stroke(); x.setLineDash([]); }
    if (key === 'sakura') { x.strokeStyle = sh('#d9c9a8'); x.lineWidth = .05; x.beginPath(); x.moveTo(0, gr); x.quadraticCurveTo(.15, .2, 0, 0); x.stroke(); dot(['#f6b5c9', '#fbd9e4'], 40, .012); }
    if (key === 'ocean') { x.fillStyle = sh('#8fbf6f'); x.beginPath(); x.arc(-.02, -.02, gr * .62, 0, TAU); x.fill(); }
    if (key === 'snow') { x.fillStyle = sh('#bfe0ef'); x.beginPath(); x.ellipse(-.25, -.2, .14, .09, .4, 0, TAU); x.fill(); dot(['#dde7f1'], 20, .03); }
    if (key === 'meadow') { x.strokeStyle = sh('#d9c9a8'); x.lineWidth = .04; x.beginPath(); x.moveTo(-gr, .2); x.quadraticCurveTo(0, -.1, .02, -.12); x.stroke(); dot(['#ffe27a', '#f6a3b4', '#ffffff', '#b9a3e8'], 70, .01); }
    if (key === 'autumn') { x.strokeStyle = sh('#bfa384'); x.lineWidth = .045; x.beginPath(); x.moveTo(gr, -.1); x.quadraticCurveTo(0, .15, -gr, -.05); x.stroke(); dot(['#c9472c', '#f2a33a', '#e8743b'], 60, .013); }
    if (key === 'desert') { x.strokeStyle = sh('#d9b678'); x.lineWidth = .02; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(.3, -.5 + i * .12, .5, 3.6, 4.6); x.stroke(); } x.fillStyle = sh('#73b884'); x.beginPath(); x.ellipse(.42, .3, .2, .14, 0, 0, TAU); x.fill(); x.fillStyle = sh('#4fb5c6'); x.beginPath(); x.ellipse(.42, .3, .15, .1, 0, 0, TAU); x.fill(); }
}

/* ---------- 凸包（岛的侧面 + 底部的轮廓） ---------- */
const hull = pts => { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); };

/**
 * 一个世界（某一座岛）：布局固定，每帧按当前朝向画
 * @param {string} key 风景
 * @param {number} seed 摆放随机种子
 */
export function makeWorld(key, seed) {
    const B = BIOMES[key] || BIOMES.ocean, sea = !!B.sea;
    const gr = sea ? .26 : .7, gy = sea ? -.04 : -.1, thick = sea ? .1 : .07, tip = sea ? gy - .12 : -.72, wy = -.1;
    const items = layout(key, seed).map(o => ({ ...o, p: [o.p[0], gy, o.p[2]] }));
    const rimPts = (y, rad, n = 40) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU) * rad, y, Math.sin(i / n * TAU) * rad]);
    const stars = Array.from({ length: 46 }, (_, i) => { const r = rng(seed + i * 97); const a = r() * TAU, y = .15 + r() * .8, h = Math.sqrt(1 - y * y); return [Math.cos(a) * h * .93, y * .93, Math.sin(a) * h * .93, r()]; });
    const fall = []; for (let i = 0; i < 40; i++) fall.push({ a: Math.random() * 2 - 1, b: Math.random() * 2.4 - 1.2, v: .002 + Math.random() * .003, w: Math.random() * TAU });
    const drops = []; let bolt = 0; const sparks = [];
    // 云：天上几朵慢慢飘；浮空岛下面一圈云海
    const clouds = Array.from({ length: 5 }, (_, i) => { const r = rng(seed + 300 + i); return { a: r() * TAU, y: .35 + r() * .35, d: .55 + r() * .3, s: .7 + r() * .6 }; });
    const sea2 = Array.from({ length: 14 }, (_, i) => { const r = rng(seed + 500 + i); return { a: i / 14 * TAU + r() * .3, d: .62 + r() * .3, y: -.5 - r() * .12, s: .8 + r() * .5 }; });
    let K = 1; const puff = (x, p, s, col) => { const w = s * K * .16; x.fillStyle = col; for (const [dx, dy, r] of [[0, 0, 1], [-.9, .25, .7], [.9, .25, .75], [-.4, -.35, .7], [.45, -.3, .65]]) { x.beginPath(); x.arc(p[0] + dx * w, p[1] + dy * w, r * w, 0, TAU); x.fill(); } };

    /**
     * @param {CanvasRenderingContext2D} x
     * @param {{cx:number, cy:number, kx:number, ky:number, M:number[], t:number, scene:string, sea:number}} V
     */
    return function draw(x, V) {
        const { cx, cy, kx, ky, M, t, scene } = V, dim = DIM[scene] ?? .1, dark = dim >= .4, k = Math.max(kx, ky); K = k;
        const sh = h => dim ? shade(h, dim * .75) : h;
        const pr = (p0, p1, p2) => { const v = ap(M, p0, p1, p2); return [cx + v[0] * kx, cy - v[1] * ky, v[2]]; };
        const U = [M[1], M[4], M[7]], ulen = Math.hypot(U[0], U[1]);
        const un = ulen > 1e-3 ? [U[0] / ulen, -U[1] / ulen] : [0, -1]; // 屏幕上「世界的上方」
        const perp = [-un[1], un[0]], upz = U[2];
        const disk = (y, ox = 0, oz = 0) => { const o = pr(ox, y, oz); x.transform(M[0] * kx, -M[3] * ky, M[2] * kx, -M[5] * ky, o[0], o[1]); };
        const R = k;

        /* 天空：渐变方向跟着世界的上方 */
        const sk = SKY[scene] || SKY.sunset;
        let g = x.createLinearGradient(cx + un[0] * R, cy + un[1] * R, cx - un[0] * R, cy - un[1] * R); // 天顶 → 地平线
        g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
        if (sea) { const wc = pr(0, wy, 0), f = Math.max(.02, Math.min(.98, (1 - ((wc[0] - cx) * un[0] + (wc[1] - cy) * un[1]) / R * (ulen > .05 ? 1 / ulen : 1)) / 2)); g = x.createLinearGradient(cx + un[0] * R, cy + un[1] * R, cx - un[0] * R, cy - un[1] * R); g.addColorStop(0, sk[0]); g.addColorStop(Math.max(0, f - .01), sk[1]); g.addColorStop(Math.min(1, f + .01), sh('#2a7aa3')); g.addColorStop(1, sh('#0b2c4a')); }
        x.fillStyle = g; x.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
        if (['night', 'aurora', 'fireworks'].includes(scene)) for (const s of stars) { const p = pr(s[0], s[1], s[2]); x.fillStyle = `rgba(255,255,255,${.35 + .65 * Math.abs(Math.sin(t * 1.3 + s[3] * 9))})`; x.beginPath(); x.arc(p[0], p[1], .8 + s[3] * 1.2, 0, TAU); x.fill(); }
        if (scene === 'sun') { const p = pr(.42, .55, -.45); g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], R * .3); g.addColorStop(0, 'rgba(255,236,150,.95)'); g.addColorStop(.3, 'rgba(255,236,150,.55)'); g.addColorStop(1, 'rgba(255,236,150,0)'); x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], R * .3, 0, TAU); x.fill(); }
        if (scene === 'sunset') { const p = pr(0, .1, -.8); g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], R * .55); g.addColorStop(0, 'rgba(255,214,140,.95)'); g.addColorStop(.25, 'rgba(255,190,120,.6)'); g.addColorStop(1, 'rgba(255,190,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], R * .55, 0, TAU); x.fill(); }
        if (scene === 'night' || scene === 'aurora') { const p = pr(-.4, .6, -.4); x.fillStyle = '#fff6cf'; x.beginPath(); x.arc(p[0], p[1], R * .08, 0, TAU); x.fill(); x.fillStyle = sk[0]; x.beginPath(); x.arc(p[0] + R * .03, p[1] - R * .02, R * .07, 0, TAU); x.fill(); }
        if (scene === 'aurora') for (let b = 0; b < 3; b++) { x.beginPath(); for (let i = 0; i <= 24; i++) { const a = -1.2 + i / 24 * 2.4, y = .55 + b * .08 + Math.sin(a * 3 + t * .7 + b) * .05; const p = pr(Math.sin(a) * .8, y, -Math.cos(a) * .55); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.strokeStyle = ['rgba(120,235,190,.35)', 'rgba(160,200,235,.28)', 'rgba(200,170,225,.24)'][b]; x.lineWidth = R * .12; x.lineCap = 'round'; x.stroke(); }
        if (scene === 'fireworks') { if (sparks.length < 150 && Math.random() < .05) { const a = Math.random() * TAU, o = [Math.cos(a) * .5, .45 + Math.random() * .3, Math.sin(a) * .4], col = `hsl(${Math.random() * 360},90%,70%)`; for (let i = 0; i < 22; i++) { const b = i / 22 * TAU; sparks.push({ o, vx: Math.cos(b), vy: Math.sin(b), r: 0, l: 50, c: col }); } } for (const s of sparks) { s.r += .004; s.l--; const p = pr(s.o[0] + s.vx * s.r, s.o[1] + s.vy * s.r - (50 - s.l) * .0006, s.o[2]); x.globalAlpha = Math.max(0, s.l / 50); x.fillStyle = s.c; x.fillRect(p[0] - 1, p[1] - 1, 2.2, 2.2); } x.globalAlpha = 1; for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].l <= 0) sparks.splice(i, 1); }

        if (!dark && scene !== 'fog') for (const c of clouds) { const a = c.a + t * .02, p = pr(Math.cos(a) * c.d, c.y, Math.sin(a) * c.d); puff(x, p, c.s, scene === 'sunset' ? 'rgba(255,236,220,.75)' : scene === 'rain' ? 'rgba(220,226,232,.7)' : 'rgba(255,255,255,.8)'); }
        const cloudSea = () => { if (sea) return; const L = sea2.map(c => { const a = c.a + t * .015; return { p: pr(Math.cos(a) * c.d, c.y, Math.sin(a) * c.d), s: c.s }; }).sort((a, b) => a.p[2] - b.p[2]); for (const c of L) puff(x, c.p, c.s * 1.3, dark ? 'rgba(150,165,200,.45)' : 'rgba(255,255,255,.7)'); };

        /* 海面（只有大海这种风景有） */
        const water = () => {
            const rr = Math.sqrt(1 - wy * wy) * .99, wet = scene === 'storm' ? 1.6 : 1;
            x.save(); disk(wy);
            g = x.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, sh('#4fb6d2')); g.addColorStop(1, sh('#1f6f9c')); x.fillStyle = g; x.globalAlpha = upz < 0 ? .78 : 1;
            x.beginPath(); x.arc(0, 0, rr, 0, TAU); x.fill(); x.globalAlpha = 1;
            x.strokeStyle = dark ? 'rgba(185,220,244,.25)' : 'rgba(255,255,255,.5)'; x.lineWidth = .008; x.lineCap = 'round';
            for (let i = 0; i < 26; i++) { const r = rng(seed + i * 13), a = r() * TAU, d = .3 + r() * .6, l = .05 + r() * .06; const ph = Math.sin(t * 1.5 * wet + i) * .02; x.beginPath(); x.arc(0, 0, d * rr + ph, a, a + l / d); x.stroke(); }
            x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = .012; x.beginPath(); x.arc(0, 0, gr + .03 + Math.sin(t * 2) * .01, 0, TAU); x.stroke();
            x.restore();
        };

        /* 岛：侧面 + 底部的岩石（凸包），顶面，物件 */
        const props = () => {
            const e = { t, lit: dark || scene === 'rain' || scene === 'fog', wet: scene === 'rain' || scene === 'storm' };
            const sc = R / 118, hf = Math.max(ulen, .14), list = items.map(o => ({ o, s: pr(...o.p) })).sort((a, b) => a.s[2] - b.s[2]);
            for (const { o, s } of list) { const kk = sc * o.s; x.save(); x.transform(perp[0] * kk, perp[1] * kk, -un[0] * hf * kk, -un[1] * hf * kk, s[0], s[1]); o.d(x, sh, { ...e, k: o.k }); x.restore(); }
            if (sea) { // 小船、鲸鱼在海面上
                const boat = Math.sin(t * .15) * .5 + 2, bp = pr(Math.cos(boat) * .62, wy, Math.sin(boat) * .62), wa = t * .2, wp = pr(Math.cos(wa) * .55, wy, Math.sin(wa) * .55);
                for (const [p, f, s] of [[bp, P.boat, .8], [wp, P.whale, .9]].sort((a, b) => a[0][2] - b[0][2])) { const kk = sc * s; x.save(); x.transform(perp[0] * kk, perp[1] * kk, -un[0] * hf * kk, -un[1] * hf * kk, p[0], p[1]); f(x, sh, t); x.restore(); }
            }
        };
        const top = () => { x.save(); disk(gy); x.fillStyle = sh(B.top); x.beginPath(); x.arc(0, 0, gr, 0, TAU); x.fill(); x.beginPath(); x.arc(0, 0, gr, 0, TAU); x.clip(); ground(x, key, gr, sh, rng(seed)); x.restore(); };
        const under = () => {
            const pts = [...rimPts(gy, gr), ...rimPts(gy - thick, gr * .98)].map(p => pr(...p).slice(0, 2));
            const tp = pr(0, tip, 0); pts.push([tp[0], tp[1]]);
            if (!sea) for (const [a, d] of [[.5, .55], [2.4, .5], [4.2, .6]]) { const q = pr(Math.cos(a) * gr * d, gy - .3, Math.sin(a) * gr * d); pts.push([q[0], q[1]]); }
            const h = hull(pts); x.beginPath(); h.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
            const a = pr(0, gy, 0), b = pr(0, tip, 0); g = x.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, sh(B.side)); g.addColorStop(.25, sh(B.rock)); g.addColorStop(1, sh('#3f3530')); x.fillStyle = g; x.fill();
            if (!sea) { x.strokeStyle = sh('#00000022'); x.lineWidth = 1; for (let i = 0; i < 7; i++) { const r = rng(seed + i * 7), a1 = r() * TAU, p1 = pr(Math.cos(a1) * gr * .7, gy - .1 - r() * .2, Math.sin(a1) * gr * .7), p2 = pr(Math.cos(a1) * gr * .3, gy - .3 - r() * .2, Math.sin(a1) * gr * .3); x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.stroke(); } }
        };
        if (sea && upz >= 0) water();
        if (upz >= 0) { cloudSea(); under(); top(); props(); } else { props(); top(); under(); cloudSea(); }
        if (sea && upz < 0) water();

        /* 天气和飘落物：方向跟着世界的「下方」 */
        const fallDir = [-un[0], -un[1]];
        const kind = B.fall, wetN = scene === 'storm' ? 90 : scene === 'rain' ? 55 : 0;
        if (wetN) { while (drops.length < wetN) drops.push({ a: Math.random() * 2 - 1, b: -1.2 - Math.random(), v: .03 + Math.random() * .02 }); x.strokeStyle = 'rgba(220,235,255,.6)'; x.lineWidth = 1;
            for (const d of drops) { d.b += d.v; if (d.b > 1.2) { d.b = -1.2; d.a = Math.random() * 2 - 1; } const px = cx + (perp[0] * d.a + fallDir[0] * d.b) * R, py = cy + (perp[1] * d.a + fallDir[1] * d.b) * R, sl = scene === 'storm' ? .35 : 0; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (fallDir[0] + perp[0] * sl) * 9, py + (fallDir[1] + perp[1] * sl) * 9); x.stroke(); } drops.length = wetN; } else drops.length = 0;
        if (kind) for (const f of fall) { f.b += f.v * (kind === 'snow' ? 1 : 1.3); f.w += .03; if (f.b > 1.2) { f.b = -1.2; f.a = Math.random() * 2 - 1; } const sway = Math.sin(f.w) * .05, px = cx + (perp[0] * (f.a + sway) + fallDir[0] * f.b) * R, py = cy + (perp[1] * (f.a + sway) + fallDir[1] * f.b) * R;
            if (kind === 'snow') { x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(px, py, 1.6, 0, TAU); x.fill(); }
            else { x.save(); x.translate(px, py); x.rotate(f.w); x.fillStyle = kind === 'petal' ? '#f8c1d2' : ['#e8743b', '#c9472c', '#f2a33a'][(f.a * 10 & 3) % 3]; x.beginPath(); x.ellipse(0, 0, 3, 1.6, 0, 0, TAU); x.fill(); x.restore(); } }
        if (scene === 'fog') { x.fillStyle = 'rgba(236,240,243,.5)'; x.fillRect(cx - R * 2, cy - R * .25 + Math.sin(t) * 4, R * 4, R * .55); }
        if (scene === 'storm') { if (bolt <= 0 && Math.random() < .012) bolt = 10; if (bolt > 0) { bolt--; x.fillStyle = `rgba(255,255,255,${bolt / 28})`; x.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4); x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); let p = pr(.3, .9, 0); x.moveTo(p[0], p[1]); for (let i = 1; i < 6; i++) { p = pr(.3 + (Math.random() - .5) * .25, .9 - i * .16, 0); x.lineTo(p[0], p[1]); } x.stroke(); } }
    };
}
