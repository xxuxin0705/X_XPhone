// 小手机 · 动态锁屏「雪夜」：一张实拍雪夜照片（圣诞树 + 发光的小雪人）做底，所有动效叠在照片上
// 互动：点圣诞树（暖光 → 彩灯 → 关）、长按圣诞树（抖落积雪）、点树顶星星、点雪人（晃一晃、亮一下、冒小雪花）、长按雪人（换身体里灯的颜色）、
//       雪地上写字（WebGL 实时算凹槽的明暗，新雪会慢慢把字盖住）、点飞过镜头的大冰晶（贴在玻璃上慢慢化成水珠滑下去）、
//       双击天空 / 摇手机（像摇雪花水晶球）、放着不动窗边会结霜（用手指擦掉）、倾斜手机有景深视差。
// 每次打开锁屏都重新初始化：写的字、擦的霜都会恢复原样。
export const SCENES = [['snownight', '雪夜']];
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const cnv = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16), f = (s) => Math.round(lerp(a >> s & 255, b >> s & 255, t)); return `rgb(${f(16)},${f(8)},${f(0)})`; };
// 可复现的随机数（每次打开画出来的树一样）
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// 柔光圆点贴图
const dot = (r, col, core = 0) => { const c = cnv(r * 2, r * 2), x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, rgba(col, 1)); core && g.addColorStop(core, rgba(col, .85)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; };
let _cf; const canFilter = () => _cf ??= (() => { try { const x = cnv(2, 2).getContext('2d'); x.filter = 'blur(2px)'; return x.filter == 'blur(2px)'; } catch { return false; } })();
// 模糊：支持 ctx.filter 用它（大半径半分辨率做），否则缩小再放大
const blurC = (src, r) => {
  if (r < .4) return src; const c = cnv(src.width, src.height), x = c.getContext('2d');
  if (canFilter()) {
    if (r < 6) { x.filter = `blur(${r}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }
    const h = cnv(c.width / 2, c.height / 2), hx = h.getContext('2d'); hx.filter = `blur(${r / 2}px)`; hx.drawImage(src, 0, 0, h.width, h.height); x.imageSmoothingQuality = 'high'; x.drawImage(h, 0, 0, c.width, c.height); return c;
  }
  const f = Math.max(2, r / 1.4), sm = cnv(c.width / f, c.height / f), y = sm.getContext('2d'); y.imageSmoothingQuality = 'high'; y.drawImage(src, 0, 0, sm.width, sm.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, c.width, c.height); return c;
};
const vgrad = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };


/* ================= 照片素材（加载一次，之后每次开锁屏直接用） ================= */
// 底图里的坐标（照片像素）：雪人位置、树的轮廓、树顶、彩灯挂点（从照片里树枝积雪的亮边挑出来的）、雪人身上的小光点
const META = {"W":1282,"H":1585,"sm":{"x":551.4,"y":928.3,"w":379.3,"h":371.7},"star":[430,342],"tree":[[430,345],[560,640],[665,1100],[430,1130],[190,1105],[320,640]],"bulbs":[[628,1081],[363,1079],[608,1076],[563,1076],[534,1075],[471,1063],[440,1056],[409,1053],[607,1053],[519,1050],[582,1048],[499,1045],[644,1037],[458,1036],[390,1032],[519,1017],[475,1012],[335,998],[298,995],[408,991],[383,980],[614,976],[329,975],[236,975],[488,970],[267,960],[474,955],[301,953],[586,953],[244,947],[498,946],[356,946],[560,942],[344,935],[383,928],[244,924],[451,922],[419,909],[635,907],[229,906],[490,900],[613,897],[275,889],[322,887],[627,886],[412,882],[528,876],[496,875],[624,853],[340,851],[563,847],[580,846],[378,845],[275,839],[320,837],[593,835],[350,835],[293,832],[505,821],[557,815],[531,814],[384,786],[582,782],[455,781],[424,779],[309,779],[496,776],[568,771],[418,758],[518,746],[454,731],[349,726],[536,722],[482,695],[554,693],[305,690],[323,690],[536,682],[376,682],[405,680],[315,674],[454,669],[422,664],[385,637],[495,626],[510,605],[491,605],[541,602],[352,599],[436,593],[525,578],[445,564],[366,564],[481,549],[438,526],[452,499],[491,496],[458,471],[457,453],[454,424],[422,401],[432,379]],"spark":[[0.46,0.265],[0.463,0.265],[0.334,0.339],[0.609,0.354],[0.575,0.363],[0.549,0.374],[0.607,0.41],[0.332,0.583],[0.437,0.641],[0.458,0.651],[0.455,0.657],[0.604,0.658],[0.385,0.681],[0.631,0.69],[0.422,0.704],[0.464,0.719],[0.642,0.725],[0.509,0.736],[0.326,0.744],[0.703,0.76],[0.645,0.773],[0.218,0.775],[0.216,0.777],[0.467,0.783],[0.5,0.787],[0.656,0.787],[0.574,0.793],[0.64,0.801],[0.203,0.808],[0.203,0.81],[0.71,0.817],[0.72,0.818],[0.72,0.821],[0.219,0.825],[0.639,0.838],[0.689,0.845],[0.266,0.849],[0.646,0.857],[0.558,0.865],[0.518,0.867],[0.303,0.868],[0.244,0.88],[0.21,0.882],[0.249,0.891],[0.259,0.894],[0.216,0.899],[0.257,0.902],[0.264,0.902],[0.278,0.902],[0.282,0.907],[0.686,0.91],[0.263,0.913],[0.241,0.914],[0.245,0.915],[0.261,0.915],[0.243,0.917],[0.678,0.917],[0.272,0.918],[0.273,0.922],[0.234,0.923],[0.26,0.926],[0.248,0.929],[0.281,0.931],[0.272,0.934],[0.249,0.937],[0.286,0.939],[0.509,0.942],[0.277,0.943],[0.284,0.946],[0.282,0.949],[0.417,0.953],[0.574,0.968]]};
const IMG = {}; let imgP;
const loadImgs = () => imgP ||= Promise.all([['bg', 'snownight.webp'], ['sm', 'snowman.webp']].map(([k, f]) => new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = new URL('./assets/' + f, import.meta.url).href; })));
// 只给雪人身体里发光的部分（亮处）上色，帽子围巾不变
const glowTints = img => { try {
  const w = img.naturalWidth, h = img.naturalHeight, b = cnv(w, h), x = b.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const l = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11), wgt = clamp((l - 165) / 70) * clamp((a[i] - a[i + 2] - 10) / 40); a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = a[i + 3] * wgt; }
  x.putImageData(d, 0, 0); return SMC.map(c => c && tint(b, c));
} catch { return null; } };
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

/* ================= 冰晶雪花（大特写） ================= */
function crystal(S, seed) {
  const R = rng(seed), c = cnv(S, S), g = c.getContext('2d'), Rr = S * .46, segs = [], w0 = S * lerp(.03, .042, R()), nb = 4 + (R() * 3 | 0), fern = R() < .7, plate = !fern || R() < .55;
  // 一条臂的骨架（朝上）：主干 + 左右对称 60° 的侧枝（侧枝上再长小枝）
  segs.push([0, -Rr * .12, 0, -Rr * .97, w0, w0 * .6, 1]);
  for (let i = 1; i <= nb; i++) {
    const t = i / (nb + 1) + (R() - .5) * .05, y = -Rr * t, L = Rr * (1 - t) * lerp(.45, .78, R()) * (fern ? 1 : .55), w = w0 * lerp(.85, .55, t);
    for (const sd of [-1, 1]) {
      const ex = sd * Math.sin(Math.PI / 3) * L, ey = y - Math.cos(Math.PI / 3) * L; segs.push([0, y, ex, ey, w, w * .55, 1]);
      if (fern) for (let q = 1; q <= 3; q++) { const f = q / 4 + (R() - .5) * .05, bx = ex * f, by = y + (ey - y) * f, l2 = L * (1 - f) * lerp(.3, .5, R()); segs.push([bx, by, bx, by - l2, w * .5, w * .3, 0]); segs.push([bx, by, bx + sd * l2 * .87, by + l2 * .5, w * .5, w * .3, 0]); }
    }
  }
  const arms = [0, 1, 2, 3, 4, 5].map(() => segs.map(([x0, y0, x1, y1, wa, wb, m]) => { const f = m ? 1 : lerp(.82, 1.12, R()); return [x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, wa, wb, m]; }));
  const draw = (x, wf, col, cap = 'butt') => { x.strokeStyle = col; x.lineCap = cap; for (let k = 0; k < 6; k++) { x.save(); x.translate(S / 2, S / 2); x.rotate(k * TAU / 6 + (R() - .5) * .006); for (const [x0, y0, x1, y1, wa, wb] of arms[k]) { const n = 4; for (let j = 0; j < n; j++) { const t0 = j / n, t1 = (j + 1) / n; x.lineWidth = lerp(wa, wb, (t0 + t1) / 2) * wf; x.beginPath(); x.moveTo(lerp(x0, x1, t0), lerp(y0, y1, t0)); x.lineTo(lerp(x0, x1, t1), lerp(y0, y1, t1)); x.stroke(); } } x.restore(); } };
  // 臂尖：小小的六边形端面
  const tips = x => { for (let k = 0; k < 6; k++) { x.save(); x.translate(S / 2, S / 2); x.rotate(k * TAU / 6); for (const [, , x1, y1, , wb, main] of segs) if (main) { x.beginPath(); for (let q = 0; q < 6; q++) x.lineTo(x1 + Math.cos(q * TAU / 6) * wb * .75, y1 + Math.sin(q * TAU / 6) * wb * .75); x.fill(); } x.restore(); } };
  const hex = (x, r, rot = TAU / 12) => { x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(S / 2 + Math.cos(k * TAU / 6 + rot) * r, S / 2 + Math.sin(k * TAU / 6 + rot) * r); x.closePath(); };
  const pr = Rr * (plate ? .25 : .15);
  const body = cnv(S, S), bx = body.getContext('2d'); draw(bx, 1, '#fff', 'square'); bx.fillStyle = '#fff'; tips(bx); hex(bx, pr); bx.fill();
  // 棱边的彩色折射 + 柔光：只从轮廓外露出来
  g.globalAlpha = .5; g.drawImage(tint(body, '#7fd6ff'), S * .006, -S * .003); g.drawImage(tint(body, '#ffa0d8'), -S * .006, S * .003); g.globalAlpha = 1;
  g.drawImage(body, 0, 0);
  // 内部：半透明、带一点蓝灰（看得出厚度），只留下一圈很细的亮边
  const inn = cnv(S, S), ix = inn.getContext('2d'); draw(ix, .7, '#fff', 'butt'); hex(ix, pr * .86); ix.fillStyle = '#fff'; ix.fill(); ix.globalCompositeOperation = 'source-in';
  const ig = ix.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, Rr); ig.addColorStop(0, 'rgba(95,120,160,.92)'); ig.addColorStop(.6, 'rgba(120,150,195,.85)'); ig.addColorStop(1, 'rgba(150,180,220,.8)'); ix.fillStyle = ig; ix.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .62; g.drawImage(inn, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = .35; g.drawImage(inn, 0, 0); g.globalAlpha = 1;
  // 晶体里的细纹：沿着枝的方向几条平行的亮线、几个小气泡
  draw(g, .12, 'rgba(255,255,255,.95)', 'round'); draw(g, .4, 'rgba(255,255,255,.14)', 'round');
  const bub = dot(S * .006, '#ffffff', .5); for (let k = 0; k < 40; k++) { const a2 = R() * TAU, d = Rr * Math.sqrt(R()) * .9; const [bx2, by2] = [S / 2 + Math.cos(a2) * d, S / 2 + Math.sin(a2) * d]; bx.getImageData && g.drawImage(bub, bx2, by2); }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(body, 0, 0); g.drawImage(body, 0, 0); g.globalCompositeOperation = 'source-over';
  // 中心的六边形板：一圈圈的亮环 + 放射的脊
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = S * .0035; [.86, .62, .38].forEach(f => { hex(g, pr * f); g.stroke(); });
  g.save(); g.translate(S / 2, S / 2); g.lineWidth = S * .003; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * TAU / 6 - Math.PI / 2) * pr, Math.sin(k * TAU / 6 - Math.PI / 2) * pr); g.stroke(); } g.restore();
  // 受光：左上亮、右下冷
  g.globalCompositeOperation = 'source-atop'; const lg = g.createLinearGradient(0, 0, S, S); lg.addColorStop(0, 'rgba(255,255,255,.3)'); lg.addColorStop(.55, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(40,80,160,.28)'); g.fillStyle = lg; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-over'; g.globalAlpha = .4; g.drawImage(blurC(body, S * .014), 0, 0); g.globalAlpha = 1;
  // 闪光点（几处臂尖和棱上）
  g.globalCompositeOperation = 'lighter'; const sp = dot(S * .02, '#ffffff', .3);
  for (let k = 0; k < 7; k++) { const a2 = (R() * 6 | 0) * TAU / 6 - Math.PI / 2, d = Rr * lerp(.35, .97, R()); g.drawImage(sp, S / 2 + Math.cos(a2) * d - S * .02, S / 2 + Math.sin(a2) * d - S * .02); }
  g.globalCompositeOperation = 'source-over';
  return c;
}
const tint = (src, col) => { const c = cnv(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; };
// 十字星芒
function flare(r, col = '#ffffff') {
  const c = cnv(r * 2, r * 2), g = c.getContext('2d'); g.drawImage(dot(r * .35, col, .2), r * .65, r * .65);
  g.globalCompositeOperation = 'lighter';
  for (const [w, l, a] of [[r * .05, r, .9], [r * .03, r * .6, .5]]) for (let k = 0; k < (a > .6 ? 2 : 4); k++) {
    g.save(); g.translate(r, r); g.rotate(k * Math.PI / (a > .6 ? 2 : 4) + (a > .6 ? 0 : Math.PI / 4)); const gr = g.createLinearGradient(-l, 0, l, 0);
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(-l, -w / 2, l * 2, w); g.restore();
  }
  return c;
}
// 窗上的水珠
function drop(r) {
  const c = cnv(r * 2.4, r * 2.8), g = c.getContext('2d'), x = r * 1.2, y = r * 1.5;
  g.beginPath(); g.moveTo(x, y - r * 1.35); g.bezierCurveTo(x + r * .5, y - r * .6, x + r, y - r * .1, x + r, y + r * .3); g.arc(x, y + r * .3, r, 0, Math.PI); g.bezierCurveTo(x - r, y - r * .1, x - r * .5, y - r * .6, x, y - r * 1.35); g.closePath();
  const gr = g.createRadialGradient(x - r * .2, y + r * .1, r * .1, x, y + r * .2, r * 1.3); gr.addColorStop(0, 'rgba(200,220,255,.08)'); gr.addColorStop(.7, 'rgba(160,190,230,.18)'); gr.addColorStop(1, 'rgba(20,30,50,.55)');
  g.fillStyle = gr; g.fill(); g.lineWidth = r * .12; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(x - r * .38, y - r * .1, r * .16, r * .28, -.4, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,240,220,.6)'; g.beginPath(); g.ellipse(x + r * .35, y + r * .75, r * .3, r * .12, 0, 0, TAU); g.fill();
  return c;
}
// 窗边的霜花：一圈柔和的白雾 + 从四边长进来的白色冰蕨，分 4 圈（越往里越晚长出来）
function frostLayers(W, H, k) {
  const D = Math.min(W, H) * .36, R = rng(77), L = [0, 1, 2, 3].map(() => cnv(W * k, H * k));
  // 雾面：整屏白色，中间挖掉一个模糊的圆角矩形
  const haze = cnv(W * k, H * k), hx = haze.getContext('2d'); hx.scale(k, k); hx.fillStyle = 'rgba(232,242,255,.5)'; hx.fillRect(0, 0, W, H);
  const hole = cnv(W * k, H * k), ho = hole.getContext('2d'); ho.scale(k, k); ho.fillStyle = '#000'; ho.beginPath(); ho.roundRect(D * .4, D * .4, W - D * .8, H - D * .8, D * .5); ho.fill();
  hx.setTransform(1, 0, 0, 1, 0, 0); hx.globalCompositeOperation = 'destination-out'; hx.drawImage(blurC(hole, D * .45 * k), 0, 0);
  const fern = (g, x, y, ang, len, d, lw) => {
    if (len < 1.5 || d > 5) return; const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
    g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
    const n = 4 + (R() * 4 | 0);
    for (let i = 1; i <= n; i++) { const t = i / (n + 1), bx = lerp(x, x1, t), by = lerp(y, y1, t), l = len * (1 - t) * lerp(.3, .55, R()); fern(g, bx, by, ang + Math.PI / 3 * lerp(.85, 1.1, R()), l, d + 1, lw * .7); fern(g, bx, by, ang - Math.PI / 3 * lerp(.85, 1.1, R()), l, d + 1, lw * .7); }
  };
  for (let i = 0; i < 4; i++) {
    const g = L[i].getContext('2d'); g.scale(k, k); g.lineCap = 'round';
    i < 2 && (g.globalAlpha = [.42, .22][i], g.drawImage(haze, 0, 0, W, H), g.globalAlpha = 1);
    g.strokeStyle = 'rgba(245,250,255,.75)'; g.shadowColor = 'rgba(200,225,255,.9)'; g.shadowBlur = 3 * k;
    const band = [D * i / 4, D * (i + 1) / 4], seeds = 22 + i * 6;
    for (let q = 0; q < seeds; q++) {
      const side = R() * 4 | 0, pp = R(), d = lerp(band[0], band[1], R()) * .5;
      const [x, y, ang] = side == 0 ? [pp * W, d, Math.PI / 2] : side == 1 ? [pp * W, H - d, -Math.PI / 2] : side == 2 ? [d, pp * H, 0] : [W - d, pp * H, Math.PI];
      fern(g, x, y, ang + lerp(-.8, .8, R()), lerp(D * .16, D * .38, R()), 0, Math.max(.7, D * .008));
    }
    // 小冰晶
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.85)';
    for (let q = 0; q < 40; q++) { const side = R() * 4 | 0, pp = R(), d = lerp(band[0], band[1], R()) * .7, [x, y] = side == 0 ? [pp * W, d] : side == 1 ? [pp * W, H - d] : side == 2 ? [d, pp * H] : [W - d, pp * H]; g.fillRect(x, y, 1.2, 1.2); }
  }
  return { L, D };
}

/* ================= 雪地上写的字：WebGL 只算凹槽的明暗，叠在照片的雪上 ================= */
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;varying vec2 v;uniform sampler2D Hm;uniform vec2 Hp;uniform float T;uniform vec4 G;uniform vec3 Sw;uniform vec3 Tw;
float hs(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
 vec2 u=vec2(v.x,1.-v.y);float s0=texture2D(Hm,u).r,sl=texture2D(Hm,u-vec2(Hp.x,0.)).r,sr=texture2D(Hm,u+vec2(Hp.x,0.)).r,su=texture2D(Hm,u-vec2(0.,Hp.y)).r,sd=texture2D(Hm,u+vec2(0.,Hp.y)).r;
 vec2 px=vec2(u.x*G.x,G.y+u.y*G.z);float per=clamp((px.y-G.w)/(G.y+G.z-G.w),.15,1.);
 vec3 n=normalize(vec3(-(sr-sl)*9./per,1.,-(sd-su)*9./per));
 vec3 L=normalize(vec3(-.5,.72,.48));float d=dot(n,L)-L.y;
 float g=clamp((.5-s0)*2.6,0.,1.),rim=clamp((s0-.5)*3.,0.,1.);
 vec3 sc=vec3(.29,.28,.31);vec3 hc=vec3(1.,.97,.9);
 float sa=clamp(-d*1.,0.,.5)+g*.3,ha=clamp(d*1.8,0.,.75)+rim*.22;
 vec3 c=sc*sa;float a=sa;
 c=c*(1.-ha)+hc*ha;a=a+ha*(1.-a);
 vec2 ds=Sw.xy-px;float sw=Sw.z*max(0.,dot(n,normalize(vec3(ds.x,40.,ds.y))))/(1.+dot(ds,ds)/9000.);
 vec2 dt=Tw.xy-px;float tw=Tw.z*max(0.,dot(n,normalize(vec3(dt.x,60.,dt.y))))/(1.+dot(dt,dt)/22000.);
 vec3 warm=vec3(1.,.66,.32)*(sw+tw)*g*1.6;c+=warm;a=max(a,length(warm)*.6);
 float r=hs(floor(px*.7)+floor(T*.2));c+=step(.985,r)*g*(.6+.4*sin(T*3.+r*50.))*vec3(1.);a=max(a,step(.985,r)*g*.9);
 gl_FragColor=vec4(c,a);}`;
function grooves(w, h, k) {
  const c = cnv(w * k, h * k), gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true }); if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o)); return o; };
  let pr; try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw Error('link'); } catch (e) { console.warn('[小手机] 雪地着色器不可用，改用普通绘制', e); return null; }
  gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE)); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
  gl.viewport(0, 0, c.width, c.height); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    c, lose: () => gl.getExtension('WEBGL_lose_context')?.loseContext(),
    geo(W, y0, gh, hz) { gl.uniform4f(U('G'), W, y0, gh, hz); },
    tex(src) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.uniform2f(U('Hp'), 1 / src.width, 1 / src.height); },
    draw(t, sw, tw) { gl.uniform1f(U('T'), t); gl.uniform3fv(U('Sw'), sw); gl.uniform3fv(U('Tw'), tw); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
  };
}

/* ================= 场景 ================= */
const COLS = ['#ff4d5e', '#ffd25a', '#5fe08a', '#58b4ff', '#ff8ad8', '#ffffff'];
const SMC = [null, '#ff6fa8', '#6fb6ff', '#7dffb0', '#c89bff']; // 雪人身体里的灯：默认暖黄 → 粉 → 蓝 → 绿 → 紫
const snownight = {
  ink: '#ffffff', shade: 'rgba(0,0,0,.5)', dpr: 2, fps: 60, interactive: true,
  init(W, H, dpr) {
    const small = W < 200, k = dpr, s = { W, H, k, small, t: 0, idle: 0, tilt: 0, tiltT: 0, wind: 0, swirl: 0, ready: 0, fadeIn: 0 };
    // 照片铺满屏幕（cover），以树和雪人为中心；四周多留一点给倾斜视差
    const M = META, sc = Math.max(W / M.W, H / M.H) * 1.04, fx = 588 / M.W, fy = .52;
    s.sc = sc; s.ox = clamp(W / 2 - fx * M.W * sc, W - M.W * sc, 0); s.oy = clamp(H * .5 - fy * M.H * sc, H - M.H * sc, 0);
    const P = s.P = (x, y) => [s.ox + x * sc, s.oy + y * sc];
    const [tx0, ty0] = P(M.star[0], M.star[1]), [, tby] = P(430, 1110); s.tree = { x: tx0, by: tby, h: tby - ty0, poly: M.tree.map(([x, y]) => P(x, y)) };
    s.star = { x: tx0, y: ty0 - sc * 6, r: sc * 22 };
    const [smx, smy] = P(M.sm.x, M.sm.y); s.sm = { x: smx, y: smy, w: M.sm.w * sc, h: M.sm.h * sc, cx: smx + M.sm.w * sc * .5, by: smy + M.sm.h * sc, wob: 0, wobT: -9, glow: 0, col: 0, colT: 1 };
    s.bulbs = M.bulbs.map(([x, y], i) => { const [X, Y] = P(x, y); return { x: X, y: Y, d: (tby - Y) / s.tree.h, c: i % COLS.length, ph: Math.random() * TAU }; });
    s.spark = M.spark;
    s.ground = P(0, 1165)[1]; s.hz = P(0, 1000)[1];
    // 贴图
    const u = Math.min(W, H * .5);
    s.spr = { warm: dot(24, '#ffc477', .12), white: dot(8, '#ffffff', .25), bok: dot(32, '#e6eeff', .55), wbok: dot(32, '#ffd9a8', .55), glow: dot(64, '#ffb060'), flare: flare(40, '#fff1d6'), flareW: flare(40, '#ffffff'), puff: dot(16, '#f2f5fa', .3) };
    s.cols = COLS.map(c => dot(14, c, .25)); s.smGlow = SMC.map(c => dot(64, c || '#ffb466'));
    const streak = s.streak = cnv(64, 12), sx = streak.getContext('2d'), sgr = sx.createLinearGradient(0, 0, 64, 0); sgr.addColorStop(0, 'rgba(255,255,255,0)'); sgr.addColorStop(.6, 'rgba(255,255,255,.9)'); sgr.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = sgr; sx.beginPath(); sx.ellipse(32, 6, 32, 4, 0, 0, TAU); sx.fill();
    // 落雪：照片里本来就有长曝光的雪，这里再叠三层会动的（远 / 中 / 近处虚焦的大光斑）
    const A = W * H / (390 * 844);
    s.far = Array.from({ length: Math.round((small ? 50 : 150) * A) }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.6, 1.3), v: rnd(20, 40), ph: rnd(0, TAU), a: rnd(.3, .65) }));
    s.mid = Array.from({ length: Math.round((small ? 30 : 120) * A) }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 2.4), v: rnd(70, 140), ph: rnd(0, TAU), a: rnd(.45, .9) }));
    s.near = Array.from({ length: small ? 2 : 8 }, () => ({ x: rnd(0, W), y: rnd(-H, H), r: rnd(u * .02, u * .06), v: rnd(160, 290), ph: rnd(0, TAU), a: rnd(.16, .4) }));
    s.puffs = []; s.chunks = []; s.sparks = []; s.hearts = []; s.heroes = []; s.stuck = [];
    s.lights = 0; s.mode = 0; s.starT = -9; s.nextHero = small ? 1e9 : 5; s.dw = 0;
    // 暗角
    const vg = s.vig = cnv(W * k * .5, H * k * .5), vx = vg.getContext('2d'), vgr = vx.createRadialGradient(vg.width / 2, vg.height * .55, Math.min(vg.width, vg.height) * .35, vg.width / 2, vg.height * .55, Math.max(vg.width, vg.height) * .72);
    vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(1, 'rgba(0,0,0,.42)'); vx.fillStyle = vgr; vx.fillRect(0, 0, vg.width, vg.height);
    // 雪地写字的高度图
    s.y0 = s.ground - H * .02; s.hm = cnv(W, H - s.y0); s.hx = s.hm.getContext('2d'); s.hx.fillStyle = '#808080'; s.hx.fillRect(0, 0, W, H); s.dabs = []; s.hDirty = 1; s.rebuildT = 0;
    s.core = dot(32, '#000000', .25); s.rim = dot(32, '#ffffff');
    if (!small) try { s.gl = grooves(W, H - s.y0, Math.min(k, 2)); s.gl?.geo(W, s.y0, H - s.y0, s.hz); } catch { s.gl = null; }
    // 霜和冰晶：开屏后再生成，不拖慢第一帧
    s.frostF = 0; s.wipe = cnv(W, H); s.wx = s.wipe.getContext('2d'); s.fdirty = 1; s.crys = [];
    !small && setTimeout(() => { if (s.dead) return; s.crys = [crystal(Math.round(200 * k), 7), crystal(Math.round(200 * k), 12), crystal(Math.round(200 * k), 31)].map(c => [c, blurC(c, 3 * k), blurC(c, 9 * k)]); s.frost = frostLayers(W, H, .5); s.fc = cnv(W * .5, H * .5); }, 80);
    loadImgs().then(() => { if (s.dead) return; s.ready = 1; if (IMG.sm && !small) s.smTint = glowTints(IMG.sm); });
    if (!small) { s.ori = e => { if (e.gamma != null) s.tiltT = clamp(e.gamma / 35, -1, 1); }; s.mot = e => { const a = e.acceleration || e.accelerationIncludingGravity; if (!a) return; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0) - (e.acceleration ? 0 : 9.8); m > 13 && snownight.globe(s); }; addEventListener('deviceorientation', s.ori); addEventListener('devicemotion', s.mot); }
    return s;
  },
  stop(s) { s.dead = 1; s.ori && removeEventListener('deviceorientation', s.ori); s.mot && removeEventListener('devicemotion', s.mot); s.gl?.lose(); },
  globe(s) { if (s.swirl > .4) return; s.swirl = 1; for (const p of [...s.mid, ...s.far]) p.vx = rnd(-120, 120), p.vy = rnd(-260, -40); },
  toggleTree(s) { s.mode = (s.mode + 1) % 3; const now = s.t; s.bulbs.forEach(b => { b.on = s.mode ? now + b.d * 1.3 + Math.random() * .12 : now + (1 - b.d) * .6; }); if (s.mode == 1) s.starT = now + 1.45; },
  poke(s) { const m = s.sm; m.wobT = s.t; m.glow = 1; navigator.vibrate?.(10); for (let i = 0; i < 7; i++) s.hearts.push({ x: m.cx + rnd(-.25, .25) * m.w, y: m.y + m.h * .3, vx: rnd(-14, 14), vy: rnd(-55, -35), l: 0, d: rnd(2.2, 3.2), r: rnd(.04, .07) * m.w, rot: rnd(0, TAU), i: Math.random() * 3 | 0 }); },
  onTree(s, x, y) { return inPoly(x, y, s.tree.poly); },
  onSm(s, x, y) { const m = s.sm; return x > m.x + m.w * .15 && x < m.x + m.w * .85 && y > m.y && y < m.by; },
  dab(s, x, y, deep = 1) { if (y < s.ground + s.H * .005) return; const r = Math.max(1.2, (y - s.hz) * .04) * deep; s.dabs.push({ x, y: y - s.y0, r, t: s.t, deep }); s.dabs.length > 5000 && s.dabs.shift(); this.paint(s, s.dabs.at(-1), 1); s.hDirty = 1; },
  paint(s, d, a) { const h = s.hx; h.globalAlpha = .05 * a; h.drawImage(s.rim, d.x - d.r * 2, d.y - d.r * 2, d.r * 4, d.r * 4); h.globalAlpha = .22 * a * d.deep; h.drawImage(s.core, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2); h.globalAlpha = 1; },
  input(s, type, x, y) {
    s.idle = 0;
    if (type == 'down') {
      s.ptr = { x, y, x0: x, y0: y, t: s.t, rt: performance.now(), moved: 0, mode: '' };
      if (s.frostF > .4 && s.frost && this.frostAt(s, x, y) > .25) { s.ptr.mode = 'wipe'; this.wipe(s, x, y, x, y); return true; }
      const h = s.heroes.find(h => Math.hypot(h.x - x, h.y - y) < h.sz * .42 && h.foc > .25);
      if (h) { s.heroes.splice(s.heroes.indexOf(h), 1); s.stuck.push({ x: h.x, y: h.y, sz: h.sz, rot: h.rot, i: h.i, t: s.t, sy: 0, trail: [] }); s.ptr.mode = 'none'; return true; }
      if (y > s.ground && !this.onSm(s, x, y)) { s.ptr.mode = 'write'; s.ptr.lx = x; s.ptr.ly = y; return true; }
      return false;
    }
    const p = s.ptr; if (!p) return false;
    if (type == 'move') {
      if (Math.hypot(x - p.x0, y - p.y0) > 9) p.moved = 1;
      if (p.mode == 'write') { const dx = x - p.lx, dy = y - p.ly, L = Math.hypot(dx, dy), step = Math.max(1, (y - s.hz) * .014);
        for (let q = step; q <= L; q += step) { const xx = p.lx + dx * q / L, yy = p.ly + dy * q / L; this.dab(s, xx, yy); Math.random() < .25 && this.powder(s, xx, yy, 1); }
        if (L >= step) { p.lx = x; p.ly = y; } }
      else if (p.mode == 'wipe') this.wipe(s, p.x, p.y, x, y);
      p.x = x; p.y = y; return p.mode == 'write' || p.mode == 'wipe';
    }
    if (type == 'up' || type == 'cancel') {
      s.ptr = null; if (type == 'cancel' || p.moved || p.mode == 'wipe' || p.mode == 'none') return true;
      if (p.mode == 'write') { this.dab(s, x, y, 1.5); this.powder(s, x, y, 7); return true; }
      if (p.held) return true;
      if (Math.hypot(x - s.star.x, y - s.star.y) < s.star.r * 1.8 && s.mode) { for (let i = 0; i < 40; i++) { const a = rnd(0, TAU), v = rnd(30, 160); s.sparks.push({ x: s.star.x, y: s.star.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, l: rnd(.6, 1.4), c: Math.random() < .5 ? 1 : (Math.random() * 5 | 0) + 2 }); } return true; }
      if (this.onSm(s, x, y)) { this.poke(s); return true; }
      if (this.onTree(s, x, y)) { this.toggleTree(s); return true; }
      if (y < s.ground) { if (s.t - (s.lastTap || -9) < .35) { this.globe(s); s.lastTap = -9; } else s.lastTap = s.t; return true; }
      return false;
    }
  },
  powder(s, x, y, n) { const d = clamp((y - s.hz) / (s.H - s.hz)); for (let i = 0; i < n; i++) s.puffs.push({ x, y, vx: rnd(-60, 60) * d, vy: rnd(-90, -20) * d, r: rnd(.6, 1.8) * (d * 2 + .4), l: rnd(.4, .9), l0: .9 }); },
  wipe(s, x0, y0, x1, y1) { const w = s.wx; w.strokeStyle = '#000'; w.lineCap = 'round'; w.lineWidth = 34; w.beginPath(); w.moveTo(x0, y0); w.lineTo(x1, y1); w.stroke(); s.fdirty = 1; },
  frostAt(s, x, y) { const d = Math.min(x, y, s.W - x, s.H - y), D = s.frost.D; if (s.wx.getImageData(Math.round(clamp(x, 0, s.W - 1)), Math.round(clamp(y, 0, s.H - 1)), 1, 1).data[3] > 100) return 0; return clamp(s.frostF - d / (D / 4)); },
  draw(c, t, dt, W, H, s) {
    s.t = t; s.idle += dt; const k = s.k, tr = s.tree, m = s.sm;
    s.tilt += (s.tiltT - s.tilt) * Math.min(1, dt * 3); s.wind = Math.sin(t * .23) * 18 + Math.sin(t * .71) * 8 + s.tilt * 40; s.swirl = Math.max(0, s.swirl - dt * .35);
    // 长按圣诞树：抖落积雪；长按雪人：换身体里灯的颜色
    const p = s.ptr; if (p && !p.mode && !p.moved && !p.held && performance.now() - p.rt > 550) {
      if (this.onSm(s, p.x0, p.y0)) { p.held = 1; m.col = (m.col + 1) % SMC.length; m.colT = 0; m.glow = 1; navigator.vibrate?.(14); }
      else if (this.onTree(s, p.x0, p.y0)) { p.held = 1; s.shake = t; navigator.vibrate?.(18);
        for (let i = 0; i < 26; i++) { const b = s.bulbs[Math.random() * s.bulbs.length | 0]; s.chunks.push({ x: b.x, y: b.y, vx: rnd(-20, 20), vy: rnd(-30, 10), r: rnd(1.5, 4) * tr.h / 380, l: 2.4, rot: rnd(0, TAU) }); }
        for (let i = 0; i < 60; i++) { const b = s.bulbs[Math.random() * s.bulbs.length | 0]; s.puffs.push({ x: b.x + rnd(-10, 10), y: b.y, vx: rnd(-25, 25), vy: rnd(-10, 30), r: rnd(1, 3), l: rnd(.8, 1.8), l0: 1.8 }); } }
    }
    // 1. 照片（随手机倾斜微微平移）
    s.fadeIn = s.ready ? Math.min(1, s.fadeIn + dt * 2.5) : 0;
    const px = s.tilt * 6, tw = s.shake && t - s.shake < .6 ? Math.sin((t - s.shake) * 40) * 1.5 * (1 - (t - s.shake) / .6) : 0;
    c.fillStyle = '#05070b'; c.fillRect(0, 0, W, H);
    if (IMG.bg) { c.globalAlpha = s.fadeIn; c.drawImage(IMG.bg, s.ox + px * .4, s.oy, META.W * s.sc, META.H * s.sc); c.globalAlpha = 1; }
    const gx = px * .4;
    // 2. 远处落雪
    this.flakes(c, s, s.far, dt, 0);
    // 3. 圣诞树的彩灯 / 星星
    const on = s.bulbs.length ? s.bulbs.filter(b => s.mode ? t > b.on : t < b.on).length / s.bulbs.length : 0; s.lights += (on - s.lights) * Math.min(1, dt * 4);
    c.globalCompositeOperation = 'lighter';
    if (s.lights > .01) { const gR = tr.h * .62; c.globalAlpha = s.lights * (.22 + .02 * Math.sin(t * 3)); c.drawImage(s.spr.glow, tr.x - gR + gx, tr.by - tr.h * .45 - gR, gR * 2, gR * 2); }
    const bs = tr.h * .026;
    for (const b of s.bulbs) {
      const lit = s.mode ? t > b.on : t < b.on; if (!lit) continue; const age = s.mode ? t - b.on : 1;
      const pop = age < .25 ? 1 + (1 - age / .25) * 1.2 : 1, tw2 = s.mode == 2 ? .55 + .45 * Math.sin(t * 3.2 + b.ph) : .85 + .15 * Math.sin(t * 1.7 + b.ph), ci = s.mode == 2 ? (b.c + Math.floor(t * .5 + b.ph)) % 5 : -1;
      c.globalAlpha = tw2 * .95; c.drawImage(ci < 0 ? s.spr.warm : s.cols[ci], b.x - bs * pop + gx + tw, b.y - bs * pop, bs * 2 * pop, bs * 2 * pop);
      c.globalAlpha = tw2; c.drawImage(s.spr.white, b.x - bs * .3 + gx + tw, b.y - bs * .3, bs * .6, bs * .6);
    }
    const sOn = s.mode && t > s.starT; s.starA = (s.starA || 0) + ((sOn ? 1 : 0) - (s.starA || 0)) * Math.min(1, dt * 3);
    if (s.starA > .01) {
      const st = s.star, burst = sOn && t - s.starT < .6 ? 1 + (1 - (t - s.starT) / .6) * 2.5 : 1, R = st.r * 2.6 * burst;
      c.globalAlpha = s.starA; c.save(); c.translate(st.x + gx, st.y); c.rotate(t * .1); c.drawImage(s.spr.flare, -R, -R, R * 2, R * 2); c.restore();
      c.globalAlpha = s.starA * .6; c.drawImage(s.spr.glow, st.x - st.r * 3 + gx, st.y - st.r * 3, st.r * 6, st.r * 6);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = s.starA; c.fillStyle = '#ffe9a8'; c.beginPath(); for (let i = 0; i < 10; i++) { const a2 = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? st.r * .45 : st.r; c.lineTo(st.x + gx + Math.cos(a2) * rr, st.y + Math.sin(a2) * rr); } c.fill(); c.globalCompositeOperation = 'lighter';
    }
    for (const sp of s.sparks) { sp.l -= dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 60 * dt; c.globalAlpha = clamp(sp.l); c.drawImage(sp.c == 1 ? s.spr.white : s.cols[sp.c - 2], sp.x - 6 + gx, sp.y - 6, 12, 12); }
    s.sparks = s.sparks.filter(sp => sp.l > 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // 4. 雪地上写的字
    if (s.dabs.length) {
      if (t - s.rebuildT > 1) { s.rebuildT = t; s.dabs = s.dabs.filter(d => t - d.t < 240); s.hx.globalAlpha = 1; s.hx.fillStyle = '#808080'; s.hx.fillRect(0, 0, W, H); for (const d of s.dabs) this.paint(s, d, Math.exp(-(t - d.t) / 85)); s.hDirty = 1; }
      if (s.gl) { if (s.hDirty) { s.gl.tex(s.hm); s.hDirty = 0; } s.gl.draw(t, [m.cx, m.by - s.y0, .6 + m.glow * 1.4], [tr.x, tr.by - s.y0, s.lights * 1.4]); c.drawImage(s.gl.c, 0, s.y0, W, H - s.y0); }
      else for (const d of s.dabs.slice(-1500)) { const a = Math.exp(-(t - d.t) / 85); c.globalAlpha = .14 * a; c.drawImage(s.core, d.x - d.r * .7, d.y + s.y0 - d.r * .5, d.r * 1.6, d.r * 1.6); c.globalAlpha = 1; }
    }
    // 5. 雪人：单独一层（离镜头更近，视差更大），点一下晃一晃
    m.glow = Math.max(0, m.glow - dt * .6); m.colT = Math.min(1, m.colT + dt * 1.5);
    const mx = px * 1.25, wob = t - m.wobT < 1.6 ? Math.sin((t - m.wobT) * 11) * .09 * Math.exp(-(t - m.wobT) * 2.2) : 0, sq = t - m.wobT < .25 ? Math.sin((t - m.wobT) / .25 * Math.PI) * .05 : 0;
    const gl2 = .22 + .05 * Math.sin(t * 1.6) + m.glow * .5, gr = m.w * .95;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = gl2 * .5 * s.fadeIn; c.drawImage(s.smGlow[m.col], m.cx - gr + mx, m.by - m.h * .42 - gr, gr * 2, gr * 2); c.globalCompositeOperation = 'source-over';
    if (IMG.sm) {
      c.save(); c.globalAlpha = s.fadeIn; c.translate(m.cx + mx, m.by); c.rotate(wob); c.scale(1 + sq, 1 - sq); c.drawImage(IMG.sm, -m.w / 2, -m.h, m.w, m.h);
      if (m.col && s.smTint?.[m.col]) { c.globalCompositeOperation = 'color'; c.globalAlpha = .85 * m.colT * s.fadeIn; c.drawImage(s.smTint[m.col], -m.w / 2, -m.h, m.w, m.h); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .18 * m.colT * s.fadeIn; c.drawImage(s.smTint[m.col], -m.w / 2, -m.h, m.w, m.h); }
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < s.spark.length; i++) { const [u, v] = s.spark[i], a = Math.pow(.5 + .5 * Math.sin(t * 2.2 + i * 1.7), 8) * (.35 + m.glow * .65); if (a < .05) continue; c.globalAlpha = Math.min(1, a) * s.fadeIn; const r = m.w * .014; c.drawImage(s.spr.white, -m.w / 2 + u * m.w - r, -m.h + v * m.h - r, r * 2, r * 2); }
      c.restore(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    for (const h of s.hearts) { h.l += dt; h.x += (h.vx + Math.sin(h.l * 3 + h.rot) * 12) * dt; h.y += h.vy * dt; h.rot += dt; const a = Math.sin(clamp(h.l / h.d) * Math.PI); if (s.crys.length) this.drawCrystal(c, s, h.i, h.x + mx, h.y, h.r * 2, h.rot, 1, 1, a * .9); else { c.globalAlpha = a; c.drawImage(s.spr.white, h.x - h.r, h.y - h.r, h.r * 2, h.r * 2); c.globalAlpha = 1; } }
    s.hearts = s.hearts.filter(h => h.l < h.d);
    // 雪粉 / 抖落的雪块
    for (const q of s.puffs) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 140 * dt; q.vx *= .97; c.globalAlpha = clamp(q.l / q.l0) * .9; c.drawImage(s.spr.puff, q.x - q.r * 2, q.y - q.r * 2, q.r * 4, q.r * 4); }
    s.puffs = s.puffs.filter(q => q.l > 0 && q.y < H);
    for (const q of s.chunks) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; c.globalAlpha = clamp(q.l); c.fillStyle = '#eef2f8'; c.beginPath(); c.ellipse(q.x + gx, q.y, q.r * 1.3, q.r, q.rot, 0, TAU); c.fill(); if (q.y > tr.by && !q.hit) { q.hit = 1; this.powder(s, q.x, q.y, 3); q.l = 0; } }
    s.chunks = s.chunks.filter(q => q.l > 0); c.globalAlpha = 1;
    // 6. 中景落雪
    this.flakes(c, s, s.mid, dt, 1);
    // 7. 冰晶大雪花（景深：远 → 清晰 → 近处又虚掉）
    if (s.crys.length && t > s.nextHero && s.heroes.length < 2) {
      s.nextHero = t + rnd(6, 12); const fromL = Math.random() < .5, sz = Math.min(W, H) * rnd(.26, .44);
      s.heroes.push({ x0: fromL ? -sz * .3 : W + sz * .3, y0: rnd(-.05, .25) * H, x1: fromL ? W * rnd(.55, 1.1) : W * rnd(-.1, .45), y1: H * rnd(.75, 1.05), t0: t, dur: rnd(7, 10), sz, rot: rnd(0, TAU), vr: rnd(-.35, .35), fl: rnd(0, TAU), vf: rnd(.5, 1.1), i: Math.random() * s.crys.length | 0, foc: 0 });
    }
    for (const h of s.heroes) {
      const q = (t - h.t0) / h.dur; h.x = lerp(h.x0, h.x1, q) + Math.sin(q * 5 + h.fl) * W * .05; h.y = lerp(h.y0, h.y1, ss(0, 1, q) * .7 + q * .3); h.rot += h.vr * dt; h.fl += h.vf * dt;
      const foc = h.foc = 1 - Math.abs(q - .45) / .55, sz = h.sz * lerp(.75, 1.1, q), flip = Math.cos(h.fl);
      this.drawCrystal(c, s, h.i, h.x, h.y, sz, h.rot, flip, clamp(foc), clamp(q * 4) * clamp((1 - q) * 5));
      if (Math.abs(flip) > .97 && foc > .6) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (Math.abs(flip) - .97) / .03 * .8; const r = sz * .3; c.drawImage(s.spr.flareW, h.x + Math.cos(h.rot) * sz * .3 - r, h.y + Math.sin(h.rot) * sz * .3 - r, r * 2, r * 2); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    }
    s.heroes = s.heroes.filter(h => t - h.t0 < h.dur);
    // 贴在玻璃上的雪花：先清楚地停一会儿，再慢慢化成水珠滑下去
    for (const g of s.stuck) {
      const a = t - g.t, melt = clamp((a - 2.5) / 2.5);
      if (melt < 1) this.drawCrystal(c, s, g.i, g.x, g.y, g.sz * lerp(1, .35, melt), g.rot, 1, 1 - melt * .8, 1 - melt);
      if (melt > .3) {
        g.drop ||= drop(Math.round(g.sz * .06 * k)); const v = melt >= 1 ? Math.min(60, (a - 5) * 25) : 0; g.sy += v * dt; g.x += Math.sin(a * 3 + g.rot) * dt * 4;
        if (v > 0 && (!g.trail.length || g.y + g.sy - g.trail.at(-1)[1] > 3)) g.trail.push([g.x, g.y + g.sy]);
        const fade = clamp((14 - a) / 3); c.globalAlpha = fade * .35; c.strokeStyle = 'rgba(200,215,240,.6)'; c.lineWidth = g.sz * .05; c.lineCap = 'round'; c.beginPath(); g.trail.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
        c.globalAlpha = clamp((melt - .3) / .5) * fade; const dw = g.drop.width / k, dh = g.drop.height / k; c.drawImage(g.drop, g.x - dw / 2, g.y + g.sy - dh * .55, dw, dh); c.globalAlpha = 1;
      }
    }
    s.stuck = s.stuck.filter(g => t - g.t < 14 && g.y + g.sy < H + 40);
    this.flakes(c, s, s.near, dt, 2);
    c.drawImage(s.vig, 0, 0, W, H);
    // 8. 放着不动 → 窗边慢慢结霜（擦过的地方过一会儿又会结上）
    if (s.frost) {
      const target = s.idle > 12 ? clamp((s.idle - 12) / 6, 0, 4) : s.frostF; if (Math.abs(target - s.frostF) > .001) { s.frostF += (target - s.frostF) * Math.min(1, dt * .9); s.fdirty = 1; }
      if ((s.dw += dt) > 1.5) { s.dw = 0; s.wx.globalCompositeOperation = 'destination-out'; s.wx.globalAlpha = .04; s.wx.fillRect(0, 0, W, H); s.wx.globalAlpha = 1; s.wx.globalCompositeOperation = 'source-over'; s.fdirty = 1; }
      if (s.frostF > .02) {
        if (s.fdirty) { s.fdirty = 0; const f = s.fc.getContext('2d'); f.clearRect(0, 0, s.fc.width, s.fc.height); s.frost.L.forEach((L, i) => { const a = clamp(s.frostF - i); if (a > 0) { f.globalAlpha = a; f.drawImage(L, 0, 0); } }); f.globalAlpha = 1; f.globalCompositeOperation = 'destination-out'; f.drawImage(blurC(s.wipe, 6), 0, 0, s.fc.width, s.fc.height); f.globalCompositeOperation = 'source-over'; }
        c.drawImage(s.fc, 0, 0, W, H);
      }
    }
  },
  flakes(c, s, arr, dt, layer) {
    const W = s.W, H = s.H, tr = s.tree, m = s.sm, lit = s.lights, sw = s.swirl, wind = s.wind * [.4, 1, 1.8][layer];
    c.globalCompositeOperation = layer ? 'source-over' : 'lighter';
    for (const p of arr) {
      if (sw > 0 && p.vx != null) { p.x += p.vx * dt * sw; p.y += p.vy * dt * sw; const dx = p.x - W / 2, dy = p.y - H * .45; p.x += -dy * dt * sw * .8; p.y += dx * dt * sw * .8; p.vy += 120 * dt; }
      p.y += p.v * dt * (1 - sw * .7); p.x += (wind + Math.sin(s.t * 1.3 + p.ph) * [6, 14, 30][layer]) * dt;
      if (p.y > H + p.r * 2) { p.y = -p.r * 2 - Math.random() * 40; p.x = rnd(-20, W + 20); p.vx = p.vy = null; } if (p.x < -40) p.x += W + 80; if (p.x > W + 40) p.x -= W + 80;
      const nearSm = clamp(1 - Math.hypot(p.x - m.cx, p.y - (m.by - m.h * .45)) / (m.w * .9)), warm = Math.max(lit > .05 ? clamp(1 - Math.hypot(p.x - tr.x, p.y - (tr.by - tr.h * .45)) / (tr.h * .62)) * lit : 0, nearSm * .8);
      if (layer == 2) { const r = p.r; c.globalCompositeOperation = 'lighter'; c.globalAlpha = p.a; c.drawImage(warm > .3 ? s.spr.wbok : s.spr.bok, p.x - r, p.y - r, r * 2, r * 2); continue; }
      if (layer == 0) { c.globalAlpha = p.a; c.fillStyle = warm > .2 ? '#ffe2b8' : '#dfe7f5'; c.fillRect(p.x, p.y, p.r, p.r); continue; }
      const len = Math.max(p.r * 2.5, p.v * .13), ang = Math.atan2(p.v, wind);
      c.globalAlpha = p.a * .85; c.save(); c.translate(p.x, p.y); c.rotate(ang); c.drawImage(s.streak, -len / 2, -p.r, len, p.r * 2); c.restore();
      if (warm > .05) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = warm; c.drawImage(s.spr.warm, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6); c.globalCompositeOperation = 'source-over'; }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  drawCrystal(c, s, i, x, y, sz, rot, flip, foc, a) {
    const v = s.crys[i]; if (!v || a <= .01) return; const b = (1 - foc) * 2, lo = Math.floor(b), fr = b - lo;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(Math.max(.12, Math.abs(flip)), 1); c.rotate(-rot * .3);
    c.globalAlpha = a * (1 - fr); c.drawImage(v[Math.min(2, lo)], -sz / 2, -sz / 2, sz, sz); if (fr > .01 && lo < 2) { c.globalAlpha = a * fr; c.drawImage(v[lo + 1], -sz / 2, -sz / 2, sz, sz); }
    c.restore(); c.globalAlpha = 1;
  },
};

export const FX = { snownight };
export const __dev = { crystal, frostLayers };
export const sceneInk = k => FX[k] ? { ink: FX[k].ink, shade: FX[k].shade } : { ink: '#fff', shade: 'rgba(0,0,0,.4)' };
export const sceneKey = k => FX[k] ? k : SCENES[0][0];
export const preloadScene = () => loadImgs();

// 挂载到 canvas：自动适配尺寸 / 像素比，页面隐藏时暂停；opts.fps 限帧（小预览用），opts.t 起始时间（截图用）
// 返回的 input(type, clientX, clientY) 把手指交给场景（返回 true 表示场景用掉了这次触摸）
export function mountScene(cv, key, opts = {}) {
  const S = FX[sceneKey(key)], ctx = cv.getContext('2d'); let W = 0, H = 0, st, raf, last = 0, acc = 0, dead = 0, t = opts.t || 0;
  const dpr = Math.min(opts.dpr || globalThis.devicePixelRatio || 1, S.dpr || 2), step = 1 / Math.min(opts.fps || 60, S.fps || 60);
  const size = () => { const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height; if (w == W && h == H && st) return; st && S.stop?.(st); W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st = S.init(W, H, dpr); };
  const frame = dt => { size(); t += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); S.draw(ctx, t, dt, W, H, st); };
  const loop = now => { if (dead) return; raf = requestAnimationFrame(loop); const dt = last ? Math.min(.1, (now - last) / 1e3) : 0; last = now; if (document.hidden || !cv.isConnected || opts.active && !opts.active() || !cv.clientWidth) return; acc += dt; if (acc < step * .9) return; frame(Math.min(.05, acc)); acc = 0; };
  raf = requestAnimationFrame(loop);
  return {
    interactive: !!S.interactive && !opts.fps,
    input(type, cx, cy) { if (!st || !S.input) return false; const r = cv.getBoundingClientRect(); return !!S.input(st, type, (cx - r.left) * W / (r.width || 1), (cy - r.top) * H / (r.height || 1)); },
    stop() { dead = 1; cancelAnimationFrame(raf); st && S.stop?.(st); },
    advance(sec, n = 1) { for (let i = 0; i < n; i++) frame(sec / n); }, state: () => st,
  };
}
