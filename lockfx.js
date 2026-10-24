// 小手机 · 动态锁屏：6 个纯 Canvas 程序绘制的场景（不依赖任何外部图片），静态部分预渲染、每帧只画会动的层
// 用法：const h = mountScene(canvas, 'sakura'); … h.stop();
export const SCENES = [['cathedral', '光之教堂'], ['sakura', '樱花飘落'], ['snow', '初雪'], ['rain', '小雨'], ['alice', '爱丽丝仙境'], ['thread', '红线']];

const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const cnv = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
// 柔光圆点贴图
const dot = (r, col, core = 0) => { const c = cnv(r * 2, r * 2), x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, rgba(col, 1)); core && g.addColorStop(core, rgba(col, .85)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; };
// 模糊剪影：阴影偏移技巧，Safari 不支持 ctx.filter 也能用
const blurred = (w, h, blur, col, path) => { const p = blur * 2 + 2, c = cnv(w + p * 2, h + p * 2), x = c.getContext('2d'); x.shadowColor = col; x.shadowBlur = blur; x.shadowOffsetX = 1e4; x.translate(p - 1e4, p); path(x); x.fill(); return c; };
// 真模糊：支持 ctx.filter 用它，否则缩小再放大（各浏览器通用）
let _cf; const canFilter = () => _cf ??= (() => { try { const x = cnv(2, 2).getContext('2d'); x.filter = 'blur(2px)'; return x.filter == 'blur(2px)'; } catch { return false; } })();
const blurC = (src, r, pad = 0) => {
  const c = cnv(src.width + pad * 2, src.height + pad * 2), x = c.getContext('2d');
  if (canFilter()) {
    if (r < 8) { x.filter = `blur(${r}px)`; x.drawImage(src, pad, pad); x.filter = 'none'; return c; }
    const h = cnv(c.width / 2, c.height / 2), hx = h.getContext('2d'); hx.filter = `blur(${r / 2}px)`; hx.drawImage(src, pad / 2, pad / 2, src.width / 2, src.height / 2); // 大半径：半分辨率模糊再放大，快很多
    x.imageSmoothingQuality = 'high'; x.drawImage(h, 0, 0, c.width, c.height); return c;
  }
  const f = Math.max(2, r / 1.6), sm = cnv(c.width / f, c.height / f), y = sm.getContext('2d'); y.imageSmoothingQuality = 'high'; y.drawImage(src, pad / f, pad / f, src.width / f, src.height / f);
  x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, c.width, c.height); return c;
};
const vgrad = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
// 尖拱（哥特窗）路径
const arch = (g, x, y, w, h, k = .42) => { const sy = y + h * k; g.moveTo(x, y + h); g.lineTo(x, sy); g.bezierCurveTo(x, sy - (sy - y) * .55, x + w * .28, y + (sy - y) * .08, x + w / 2, y); g.bezierCurveTo(x + w * .72, y + (sy - y) * .08, x + w, sy - (sy - y) * .55, x + w, sy); g.lineTo(x + w, y + h); g.closePath(); };
// 樱花瓣（顶端带缺口的水滴形），坐标约 ±0.5
const petal = (g, s = 1) => { g.beginPath(); g.moveTo(0, .5 * s); g.bezierCurveTo(.36 * s, .3 * s, .44 * s, -.2 * s, .23 * s, -.47 * s); g.quadraticCurveTo(.1 * s, -.52 * s, 0, -.36 * s); g.quadraticCurveTo(-.1 * s, -.52 * s, -.23 * s, -.47 * s); g.bezierCurveTo(-.44 * s, -.2 * s, -.36 * s, .3 * s, 0, .5 * s); g.closePath(); };
const star4 = (g, x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2, q = i % 2 ? r * .22 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); };
const GLASS = ['#f4a6c9', '#c3a6f2', '#9fd0f5', '#f7d9a0', '#a9e3cc', '#e7a1e0', '#ffc7dc', '#b9c8ff', '#fbe0f0'];

/* ==================== 1. 光之教堂 ==================== */
const cathedral = {
  ink: '#fff', shade: 'rgba(40,20,60,.45)', fps: 30, dpr: 1.5,
  init(W, H, d) {
    const cx = W / 2, ww = W * .36, wh = H * .3, wb = H * .665, wt = wb - wh, vy = H * .6, s = { cx, ww, wh, wb, wt, vy };
    // —— 彩色玻璃窗（窗内局部坐标）——
    const win = cnv(ww * d, wh * d), g = win.getContext('2d'); g.scale(d, d);
    g.save(); g.beginPath(); arch(g, 0, 0, ww, wh, .5); g.clip();
    g.fillStyle = vgrad(g, 0, wh, [[0, '#ddd0e8'], [1, '#c2b3d2']]); g.fillRect(0, 0, ww, wh); // 被逆光照亮的石质窗框
    const rx = ww / 2, ry = wh * .27, rr = ww * .36, lw = ww * .012;
    g.fillStyle = '#fff1fd'; g.beginPath(); g.arc(rx, ry, rr * .98, 0, TAU); g.fill();
    for (let i = 0; i < 16; i++) { // 玫瑰窗花瓣
      const a0 = i * TAU / 16, a1 = a0 + TAU / 16;
      g.beginPath(); g.arc(rx, ry, rr * .95, a0, a1); g.arc(rx, ry, rr * .42, a1, a0, true); g.closePath(); g.fillStyle = rgba(GLASS[i % GLASS.length], .9); g.fill();
      g.beginPath(); g.arc(rx + Math.cos(a0 + TAU / 32) * rr * .7, ry + Math.sin(a0 + TAU / 32) * rr * .7, rr * .12, 0, TAU); g.fillStyle = rgba(GLASS[(i + 4) % GLASS.length], .95); g.fill();
    }
    g.beginPath(); g.arc(rx, ry, rr * .42, 0, TAU); g.fillStyle = '#ffe3f2'; g.fill();
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(rx + Math.cos(i * TAU / 8) * rr * .24, ry + Math.sin(i * TAU / 8) * rr * .24, rr * .1, 0, TAU); g.fillStyle = rgba(GLASS[i], .9); g.fill(); }
    g.strokeStyle = '#5b4d6b'; g.lineWidth = lw;
    [.98, .95, .82, .58, .42, .12].forEach(k => { g.beginPath(); g.arc(rx, ry, rr * k, 0, TAU); g.stroke(); });
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; g.beginPath(); g.moveTo(rx + Math.cos(a) * rr * .42, ry + Math.sin(a) * rr * .42); g.lineTo(rx + Math.cos(a) * rr * .95, ry + Math.sin(a) * rr * .95); g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * rr * .42, ry + Math.sin(a) * rr * .42); g.stroke(); }
    for (const [fx, fy] of [[ww * .14, wh * .5], [ww * .86, wh * .5]]) { g.fillStyle = rgba(pick(GLASS), .9); g.beginPath(); g.arc(fx, fy, ww * .055, 0, TAU); g.fill(); g.strokeStyle = '#5b4d6b'; g.lineWidth = lw; g.stroke(); }
    for (let j = 0; j < 3; j++) { // 三扇尖顶长窗 + 彩色格子
      const lx = ww * (.08 + j * .3), lww = ww * .24, ly = wh * .55, lh = wh * .45;
      g.save(); g.beginPath(); arch(g, lx, ly, lww, lh, .28); g.clip();
      const cols = 3, rows = 7;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { g.fillStyle = rgba(pick(GLASS), rnd(.75, .95)); g.fillRect(lx + q * lww / cols, ly + r * lh / rows, lww / cols, lh / rows); }
      g.strokeStyle = '#5b4d6b'; g.lineWidth = lw * .7;
      for (let q = 1; q < cols; q++) { g.beginPath(); g.moveTo(lx + q * lww / cols, ly); g.lineTo(lx + q * lww / cols, ly + lh); g.stroke(); }
      for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(lx, ly + r * lh / rows); g.lineTo(lx + lww, ly + r * lh / rows); g.stroke(); }
      g.restore(); g.beginPath(); arch(g, lx, ly, lww, lh, .28); g.lineWidth = lw * 1.8; g.strokeStyle = '#4b3f57'; g.stroke();
    }
    const hot = g.createRadialGradient(rx, wh * .45, 0, rx, wh * .45, wh * .7); hot.addColorStop(0, 'rgba(255,255,255,.45)'); hot.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'screen'; g.fillStyle = hot; g.fillRect(0, 0, ww, wh); g.restore();
    g.beginPath(); arch(g, 0, 0, ww, wh, .5); g.lineWidth = lw * 3; g.strokeStyle = '#463b52'; g.stroke();
    s.win = win;

    // —— 中殿：渐变、拱廊、肋拱、立柱（远→近）——
    const bg = cnv(W * d, H * d), b = bg.getContext('2d'); b.scale(d, d);
    b.fillStyle = vgrad(b, 0, H, [[0, '#2a2532'], [.35, '#5a5168'], [.58, '#9a8fa8'], [.68, '#6c6279'], [1, '#1e1a24']]); b.fillRect(0, 0, W, H);
    const back = b.createRadialGradient(cx, wt + wh * .5, 0, cx, wt + wh * .5, W * .8); back.addColorStop(0, 'rgba(232,214,240,.85)'); back.addColorStop(.45, 'rgba(160,144,178,.35)'); back.addColorStop(1, 'rgba(90,80,104,0)');
    b.fillStyle = back; b.fillRect(0, 0, W, H);
    const N = 8, P = [];
    for (let k = 0; k < N; k++) { const p = Math.pow(k / (N - 1), .75); P.push({ p, xl: lerp(-W * .02, cx - ww * .78, p), cw: lerp(W * .1, W * .022, p), fy: lerp(H * 1.02, wb + H * .02, p), sy: lerp(H * .26, wt + wh * .12, p), ay: lerp(-H * .12, wt - wh * .5, p) }); }
    const tone = p => { const a = lerp(42, 150, p), c = lerp(36, 138, p), e = lerp(50, 165, p); return `rgb(${a | 0},${c | 0},${e | 0})`; };
    for (let k = N - 2; k >= 0; k--) { // 侧廊拱门（暗）
      const A = P[k], B = P[k + 1];
      for (const sd of [-1, 1]) {
        const x1 = sd < 0 ? A.xl + A.cw : 2 * cx - B.xl, x2 = sd < 0 ? B.xl : 2 * cx - A.xl - A.cw, top = lerp(A.sy, B.sy, .5) + (A.fy - A.sy) * .12, bot = lerp(A.fy, B.fy, .5);
        b.beginPath(); arch(b, Math.min(x1, x2), top, Math.abs(x2 - x1), bot - top, .3); b.fillStyle = vgrad(b, top, bot, [[0, 'rgba(25,20,32,.55)'], [1, 'rgba(25,20,32,.25)']]); b.fill();
      }
    }
    const rib = A => { const xr = 2 * cx - A.xl - A.cw, a0 = [A.xl + A.cw * .5, A.sy], pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, L = u < .5, v = L ? u * 2 : (u - .5) * 2;
      const p0 = L ? a0 : [cx, A.ay], p1 = L ? [a0[0], A.sy - (A.sy - A.ay) * .6] : [cx + (cx - A.xl) * .3, A.ay], p2 = L ? [cx - (cx - A.xl) * .3, A.ay] : [xr + A.cw * .5, A.sy - (A.sy - A.ay) * .6], p3 = L ? [cx, A.ay] : [xr + A.cw * .5, A.sy];
      pts.push([0, 1].map(j => (1 - v) ** 3 * p0[j] + 3 * (1 - v) ** 2 * v * p1[j] + 3 * (1 - v) * v * v * p2[j] + v ** 3 * p3[j])); } return pts; };
    for (let k = N - 2; k >= 0; k--) { // 拱顶曲面：相邻两道肋拱之间填充明暗
      const o = rib(P[k]), i2 = rib(P[k + 1]); b.beginPath(); o.forEach((p, i) => i ? b.lineTo(...p) : b.moveTo(...p)); [...i2].reverse().forEach(p => b.lineTo(...p)); b.closePath();
      b.fillStyle = vgrad(b, P[k].ay, P[k].sy, [[0, `rgba(28,22,36,${lerp(.5, .15, P[k].p)})`], [1, `rgba(120,105,140,${lerp(.25, .05, P[k].p)})`]]); b.fill();
    }
    for (let k = N - 1; k >= 0; k--) {
      const A = P[k], col = tone(A.p), xr = 2 * cx - A.xl - A.cw;
      b.beginPath(); b.moveTo(A.xl + A.cw * .5, A.sy); b.bezierCurveTo(A.xl + A.cw * .5, A.sy - (A.sy - A.ay) * .6, cx - (cx - A.xl) * .3, A.ay, cx, A.ay); b.bezierCurveTo(cx + (cx - A.xl) * .3, A.ay, xr + A.cw * .5, A.sy - (A.sy - A.ay) * .6, xr + A.cw * .5, A.sy);
      b.lineWidth = A.cw * .55; b.strokeStyle = col; b.stroke(); b.lineWidth = A.cw * .12; b.strokeStyle = rgba('#e8dcf2', lerp(.08, .25, A.p)); b.stroke();
      for (const x of [A.xl, xr]) {
        const gc = b.createLinearGradient(x, 0, x + A.cw, 0), inner = x < cx;
        gc.addColorStop(0, inner ? col : 'rgba(205,190,222,.55)'); gc.addColorStop(.5, col); gc.addColorStop(1, inner ? 'rgba(205,190,222,.55)' : col);
        b.fillStyle = gc; b.fillRect(x, A.sy - (A.sy - A.ay) * .1, A.cw, A.fy - A.sy + (A.sy - A.ay) * .1);
        b.fillStyle = rgba('#000000', .12 * (1 - A.p)); b.fillRect(x, A.fy - A.cw * .25, A.cw, A.cw * .25);
      }
    }
    b.save(); b.shadowColor = 'rgba(255,206,244,1)'; b.shadowBlur = 70 * d; b.drawImage(win, cx - ww / 2, wt, ww, wh); b.shadowBlur = 30 * d; b.drawImage(win, cx - ww / 2, wt, ww, wh); b.shadowBlur = 10 * d; b.drawImage(win, cx - ww / 2, wt, ww, wh); b.restore();
    for (let i = 0; i < 3; i++) { const sw = ww * (1.15 + i * .22), sh = H * .011, y = wb + i * sh; b.fillStyle = vgrad(b, y, y + sh, [[0, '#cfc2db'], [.25, '#8d829b'], [1, '#6a6078']]); b.fillRect(cx - sw / 2, y, sw, sh); }
    const fy0 = wb + H * .033;
    b.save(); b.beginPath(); b.rect(0, fy0, W, H - fy0); b.clip();
    b.fillStyle = vgrad(b, fy0, H, [[0, '#6e6479'], [.3, '#463e51'], [1, '#17141c']]); b.fillRect(0, fy0, W, H - fy0);
    b.strokeStyle = 'rgba(255,240,255,.07)'; b.lineWidth = 1;
    for (let i = -12; i <= 12; i++) { b.beginPath(); b.moveTo(cx + i * ww * .09, fy0); b.lineTo(cx + i * W * .26, H); b.stroke(); }
    for (let i = 1; i < 12; i++) { const y = fy0 + (H - fy0) * Math.pow(i / 12, 1.8); b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    b.restore();
    for (const [x, w] of [[-W * .07, W * .15], [W * .92, W * .15]]) { b.fillStyle = vgrad(b, 0, H, [[0, '#120f16'], [.6, '#1d1923'], [1, '#0c0a0e']]); b.fillRect(x, 0, w, H); b.fillStyle = rgba('#d8c8ea', .1); b.fillRect(x < 0 ? x + w - 2 : x, 0, 2, H); }
    b.fillStyle = vgrad(b, 0, H * .38, [[0, 'rgba(18,14,24,.6)'], [1, 'rgba(18,14,24,0)']]); b.fillRect(0, 0, W, H * .38);
    const vg = b.createRadialGradient(cx, H * .55, H * .25, cx, H * .55, H * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,12,.55)'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'screen'; for (let i = 0; i < 7; i++) this.beam(b, [cx, wt + wh * .35], Math.PI / 2 + (i - 3) * .2, H * .55, W * .04, i % 2 ? '#ffe2f4' : '#efe2ff', .07); b.globalCompositeOperation = 'source-over'; // 窗口向下散开的光（静态）
    s.bg = bg; s.fy0 = fy0; s.mote = dot(8 * d, '#fff4fb', .2); s.glass = Object.fromEntries(GLASS.map(c2 => [c2, dot(24 * d, c2)]));
    s.dust = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.5, 1.9), vx: rnd(-3, 3), vy: rnd(-7, -1.5), ph: rnd(0, TAU) }));
    return s;
  },
  beam(c, P, ang, len, w, col, a) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, ex = P[0] + dx * len, ey = P[1] + dy * len;
    for (const k of [1, .62, .3]) { // 三层叠出柔边
      const g = c.createLinearGradient(P[0], P[1], ex, ey); g.addColorStop(0, rgba(col, 0)); g.addColorStop(.18, rgba(col, a * .45)); g.addColorStop(.45, rgba(col, a)); g.addColorStop(.85, rgba(col, a * .4)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(P[0] + nx * w * .18 * k, P[1] + ny * w * .18 * k); c.lineTo(ex + nx * w * k, ey + ny * w * k); c.lineTo(ex - nx * w * k, ey - ny * w * k); c.lineTo(P[0] - nx * w * .18 * k, P[1] - ny * w * .18 * k); c.fill();
    }
  },
  draw(c, t, dt, W, H, s) {
    const { cx, ww, wh, wb, wt } = s;
    c.drawImage(s.bg, 0, 0, W, H);
    // 地面倒影：逐条带一点水波位移
    const rh = wh * .62, n = 40, fy = s.fy0 - H * .004;
    for (let i = 0; i < n; i++) { const u = i / n, sy = (1 - u) * wh, sh = wh / n * 1.6; c.globalAlpha = .3 * (1 - u) ** 1.4; c.drawImage(s.win, 0, (sy - sh) / wh * s.win.height, s.win.width, sh / wh * s.win.height, cx - ww / 2 + Math.sin(t * 1.2 + i * .35) * (.5 + u * 2), fy + u * rh, ww, rh / n + 1); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'screen';
    // 光束：左右两束交替（来回切换），角度缓慢摆动
    const sw = ss(.15, .85, .5 + .5 * Math.sin(t * TAU / 16 - Math.PI / 2));
    for (const [side, wgt] of [[-1, 1 - sw], [1, sw]]) {
      if (wgt < .01) continue;
      const P = [cx + side * W * .68, H * .1], F = [cx - side * W * (.1 + .06 * Math.sin(t * .27)), H * .88], base = Math.atan2(F[1] - P[1], F[0] - P[0]), L = Math.hypot(F[0] - P[0], F[1] - P[1]) * 1.2;
      [[-.085, .2, '#ffc2e4', .18], [-.03, .11, '#dccaff', .24], [.035, .17, '#fff0de', .14], [.095, .08, '#ffb3da', .22], [.14, .05, '#cfdcff', .16]].forEach(([o, w, col, a], i) => this.beam(c, P, base + o * side + Math.sin(t * .4 + i) * .012, L, W * w, col, a * wgt * (.82 + .18 * Math.sin(t * 1.3 + i * 2))));
      s.pool ||= Array.from({ length: 24 }, (_, i) => ({ u: rnd(-1, 1), v: rnd(-1, 1), r: rnd(.03, .07), c: GLASS[i % GLASS.length], ph: rnd(0, TAU) }));
      const wp = c.createRadialGradient(F[0], F[1], 0, F[0], F[1], W * .26); wp.addColorStop(0, `rgba(255,236,248,${.2 * wgt})`); wp.addColorStop(1, 'rgba(255,236,248,0)'); c.fillStyle = wp; c.save(); c.translate(F[0], F[1]); c.scale(1, .32); c.translate(-F[0], -F[1]); c.fillRect(F[0] - W * .3, F[1] - W * .3, W * .6, W * .6); c.restore();
      for (const q of s.pool) { // 地上的彩色光斑（彩窗投影），沿光束方向拉长
        const x = F[0] + q.u * W * .2 - side * q.v * W * .06, y = F[1] + q.v * H * .035, rr = q.r * W, a = (.38 + .12 * Math.sin(t * .9 + q.ph)) * wgt;
        c.save(); c.translate(x, y); c.rotate(side * .12); c.scale(1.3, .42); c.globalAlpha = Math.min(1, a * 1.6); c.drawImage(s.glass[q.c], -rr, -rr, rr * 2, rr * 2); c.restore();
      }
      s.P = P; s.F = F; s.sd = wgt > .5 ? side : s.sd;
    }
    const hz = c.createRadialGradient(cx, wt + wh * .45, 0, cx, wt + wh * .45, W); hz.addColorStop(0, `rgba(245,225,255,${.16 + .06 * Math.sin(t * .8)})`); hz.addColorStop(1, 'rgba(245,225,255,0)'); c.fillStyle = hz; c.fillRect(0, 0, W, H);
    // 浮尘：在光束里更亮
    c.globalCompositeOperation = 'lighter';
    const [px, py] = s.P || [0, 0], [fx, fy2] = s.F || [W, H], lx = fx - px, ly = fy2 - py, ll = Math.hypot(lx, ly) || 1;
    for (const m of s.dust) {
      m.x += (m.vx + Math.sin(t * .5 + m.ph) * 4) * dt; m.y += m.vy * dt; m.y < -5 && (m.y = H + 5, m.x = rnd(0, W)); m.x < -5 && (m.x = W + 5); m.x > W + 5 && (m.x = -5);
      const dist = Math.abs((m.x - px) * ly - (m.y - py) * lx) / ll, inb = 1 - clamp(dist / (W * .14));
      c.globalAlpha = clamp((.18 + inb * .75) * (.6 + .4 * Math.sin(t * 2 + m.ph))); c.drawImage(s.mote, m.x - m.r * 2.5, m.y - m.r * 2.5, m.r * 5, m.r * 5);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
};

/* ==================== 2. 樱花飘落（有一片会飘到眼前） ==================== */
const sakura = {
  ink: '#8a3159', shade: 'rgba(255,248,251,.95)',
  flower(b, x, y, r, rot, k, a = 1) {
    b.save(); b.translate(x, y); b.rotate(rot); b.globalAlpha = a;
    for (let i = 0; i < 5; i++) { b.save(); b.rotate(i * TAU / 5); b.translate(0, -r * .5); const g = b.createRadialGradient(0, r * .45, 0, 0, 0, r * .75); g.addColorStop(0, '#fff9fb'); g.addColorStop(.55, '#fdd7e5'); g.addColorStop(1, '#f49bbd'); b.fillStyle = g; b.rotate(Math.PI); petal(b, r * 1.08); b.fill(); b.strokeStyle = 'rgba(236,140,175,.35)'; b.lineWidth = .6 * k; b.stroke(); b.restore(); }
    const cg = b.createRadialGradient(0, 0, 0, 0, 0, r * .35); cg.addColorStop(0, '#d93a72'); cg.addColorStop(1, 'rgba(240,120,160,0)'); b.fillStyle = cg; b.beginPath(); b.arc(0, 0, r * .35, 0, TAU); b.fill();
    for (let i = 0; i < 11; i++) { const a2 = i * TAU / 11 + rnd(-.1, .1), l = r * rnd(.32, .42); b.strokeStyle = '#d4527f'; b.lineWidth = .55 * k; b.beginPath(); b.moveTo(0, 0); b.lineTo(Math.cos(a2) * l, Math.sin(a2) * l); b.stroke(); b.fillStyle = '#ffcf5c'; b.beginPath(); b.arc(Math.cos(a2) * l, Math.sin(a2) * l, .95 * k, 0, TAU); b.fill(); }
    b.restore();
  },
  branch(W, H, d, k, pts, w0, w1, n, rmin, rmax) { // 画一根带花的枝到单独画布
    const c = cnv(W * d, H * d), b = c.getContext('2d'); b.scale(d, d); b.lineCap = 'round';
    for (const [P, a, z] of pts) for (let i = 0; i < P.length - 1; i++) { b.lineWidth = lerp(a, z, i / (P.length - 1)); b.strokeStyle = '#4e3034'; b.beginPath(); b.moveTo(...P[i]); b.lineTo(...P[i + 1]); b.stroke(); b.lineWidth *= .3; b.strokeStyle = 'rgba(160,110,110,.5)'; b.beginPath(); b.moveTo(P[i][0], P[i][1] - b.lineWidth); b.lineTo(P[i + 1][0], P[i + 1][1] - b.lineWidth); b.stroke(); }
    const all = pts.flatMap(([P]) => P.slice(2));
    for (let i = 0; i < n; i++) { const p = pick(all); this.flower(b, p[0] + rnd(-16, 16) * k, p[1] + rnd(-14, 14) * k, rnd(rmin, rmax) * k, rnd(0, TAU), k, rnd(.9, 1)); }
    for (let i = 0; i < n / 4; i++) { const p = pick(all); b.fillStyle = '#e76b98'; b.beginPath(); b.ellipse(p[0] + rnd(-12, 12) * k, p[1] + rnd(-10, 10) * k, 3.2 * k, 5 * k, rnd(0, TAU), 0, TAU); b.fill(); }
    return c;
  },
  init(W, H, d) {
    const s = {}, k = W / 390, bg = cnv(W * d, H * d), b = bg.getContext('2d'); b.scale(d, d);
    const curve = (x0, y0, x1, y1, x2, y2, n = 22) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n; return [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * x1 + u * u * x2, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * y1 + u * u * y2]; });
    b.fillStyle = vgrad(b, 0, H, [[0, '#efb2cb'], [.22, '#fbd9e6'], [.48, '#fff1f5'], [.72, '#f8d9e8'], [1, '#d9c6ef']]); b.fillRect(0, 0, W, H);
    const sun = b.createRadialGradient(W * .82, H * .05, 0, W * .82, H * .05, W * .9); sun.addColorStop(0, 'rgba(255,253,244,1)'); sun.addColorStop(.25, 'rgba(255,244,240,.55)'); sun.addColorStop(1, 'rgba(255,244,240,0)'); b.fillStyle = sun; b.fillRect(0, 0, W, H);
    // 远处一整片樱花林（画好后整体虚化）
    const far = cnv(W * d, H * d), f = far.getContext('2d'); f.scale(d, d);
    for (let i = 0; i < 120; i++) { const x = rnd(-.1, 1.1) * W, y = H * (.68 + Math.random() ** 1.6 * .4) - Math.abs(Math.sin(x / W * 5)) * H * .05, r = rnd(.03, .09) * W; f.fillStyle = pick(['#f5b3cb', '#f9c9da', '#fbd8e5', '#f1a2c0', '#ffe9f0', '#e7b6dd']); f.globalAlpha = rnd(.4, .75); f.beginPath(); f.arc(x, y, r, 0, TAU); f.fill(); }
    b.drawImage(blurC(far, 7 * d), 0, 0, W, H);
    // 柔和的斜光
    b.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) { const a = 2.25 + i * .09, g = b.createLinearGradient(W * .85, 0, W * .85 + Math.cos(a) * H, Math.sin(a) * H); g.addColorStop(0, 'rgba(255,250,240,.35)'); g.addColorStop(1, 'rgba(255,250,240,0)'); b.fillStyle = g; b.beginPath(); b.moveTo(W * .85, -10); b.lineTo(W * .85 + Math.cos(a - .025) * H * 1.2, Math.sin(a - .025) * H * 1.2); b.lineTo(W * .85 + Math.cos(a + .025) * H * 1.2, Math.sin(a + .025) * H * 1.2); b.fill(); }
    b.globalCompositeOperation = 'source-over';
    // 中景：右侧略虚的花枝；近景：左上清晰的大花枝
    const right = this.branch(W, H, d, k, [[curve(1.08 * W, .3 * H, .85 * W, .27 * H, .62 * W, .36 * H), 8 * k, 2 * k], [curve(.86 * W, .28 * H, .8 * W, .2 * H, .7 * W, .17 * H, 10), 3.5 * k, 1.2 * k]], 0, 0, 30, 9, 15);
    b.globalAlpha = .9; b.drawImage(blurC(right, 1.6 * d), 0, 0, W, H); b.globalAlpha = 1;
    const main = curve(-.08 * W, .01 * H, .3 * W, .02 * H, .66 * W, .17 * H), br1 = curve(.24 * W, .05 * H, .3 * W, .13 * H, .4 * W, .24 * H, 12), br2 = curve(.46 * W, .1 * H, .55 * W, .06 * H, .72 * W, .06 * H, 12), br3 = curve(.08 * W, .03 * H, .1 * W, .1 * H, .05 * W, .17 * H, 10);
    b.drawImage(this.branch(W, H, d, k, [[main, 11 * k, 2.2 * k], [br1, 5 * k, 1.4 * k], [br2, 5 * k, 1.4 * k], [br3, 4 * k, 1.2 * k]], 0, 0, 58, 12, 21), 0, 0, W, H);
    // 前景：两团大大的虚焦樱花（营造景深）
    const fg = cnv(W * d, H * d), fgx = fg.getContext('2d'); fgx.scale(d, d);
    for (const [x, y] of [[-.02 * W, .92 * H], [1.02 * W, .62 * H]]) for (let i = 0; i < 9; i++) this.flower(fgx, x + rnd(-.13, .13) * W, y + rnd(-.07, .07) * H, rnd(26, 42) * k, rnd(0, TAU), k);
    b.globalAlpha = .85; b.drawImage(blurC(fg, 9 * d), 0, 0, W, H); b.globalAlpha = 1;
    b.fillStyle = vgrad(b, 0, H * .32, [[0, 'rgba(170,60,110,.22)'], [1, 'rgba(170,60,110,0)']]); b.fillRect(0, 0, W, H * .32);
    s.bg = bg;
    // 花瓣贴图：清晰 + 三档真实虚化（保留渐变颜色）
    const ps = 96 * d, sp = cnv(ps, ps * 1.1), g = sp.getContext('2d'); g.translate(ps / 2, ps * .55);
    const gr = g.createRadialGradient(0, ps * .38, 0, 0, 0, ps * .62); gr.addColorStop(0, '#fffafc'); gr.addColorStop(.45, '#fdd5e4'); gr.addColorStop(1, '#f088b0');
    g.fillStyle = gr; petal(g, ps * .9); g.fill(); g.strokeStyle = 'rgba(220,100,145,.3)'; g.lineWidth = d; g.beginPath(); g.moveTo(0, ps * .42); g.quadraticCurveTo(ps * .04, 0, 0, -ps * .3); g.stroke();
    const pad = (src, r) => blurC(src, r * d, r * d * 2.2);
    const hs = cnv(ps, ps * 1.1), hg = hs.getContext('2d'); hg.translate(ps / 2, ps * .55); // 主角花瓣颜色更深一点，虚化后也看得清
    const hgr = hg.createRadialGradient(0, ps * .38, 0, 0, 0, ps * .62); hgr.addColorStop(0, '#ffffff'); hgr.addColorStop(.4, '#fbc2d8'); hgr.addColorStop(1, '#e45e93');
    hg.fillStyle = hgr; petal(hg, ps * .9); hg.fill(); hg.strokeStyle = 'rgba(200,60,110,.35)'; hg.lineWidth = d * 1.2; hg.beginPath(); hg.moveTo(0, ps * .42); hg.quadraticCurveTo(ps * .04, 0, 0, -ps * .3); hg.stroke();
    s.sp = [sp, pad(sp, 2), hs, pad(hs, 6), pad(hs, 15)];
    s.k = k; s.petals = Array.from({ length: 78 }, () => this.spawn(W, H, k, true)); s.hero = { at: 2.2 };
    s.glow = dot(10 * d, '#fff6e8', .25); s.mote = Array.from({ length: 26 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 2.6) * k, ph: rnd(0, TAU), v: rnd(-6, 6) * k }));
    return s;
  },
  spawn(W, H, k, any) { const z = Math.random() ** .75; return { z, x: rnd(-.25, 1) * W, y: any ? rnd(-.1, 1) * H : rnd(-.15, -.03) * H, sz: lerp(9, 28, z) * k, vy: lerp(18, 58, z) * k, sw: lerp(8, 28, z) * k, ph: rnd(0, TAU), fq: rnd(.6, 1.4), rot: rnd(0, TAU), rv: rnd(-1.2, 1.2), fl: rnd(0, TAU), fv: rnd(1.2, 3.2) }; },
  dp(c, s, i, x, y, sz, rot, fl, a) {
    if (a <= .005) return; const img = s.sp[i], base = s.sp[0], w = sz * img.width / base.width, h = w * img.height / img.width;
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(Math.cos(fl) * .82 + Math.sign(Math.cos(fl) || 1) * .18, 1); c.globalAlpha = a; c.drawImage(img, -w / 2, -h / 2, w, h); c.restore();
  },
  draw(c, t, dt, W, H, s) {
    c.drawImage(s.bg, 0, 0, W, H);
    const wind = (18 + 12 * Math.sin(t * .13) + 6 * Math.sin(t * .41)) * s.k;
    s.petals.sort((a, b) => a.z - b.z);
    for (const p of s.petals) {
      p.x += (wind * (.4 + p.z) + Math.sin(t * p.fq + p.ph) * p.sw) * dt; p.y += p.vy * (1 + .25 * Math.sin(t * p.fq * .7 + p.ph)) * dt; p.rot += p.rv * dt; p.fl += p.fv * dt;
      if (p.y > H + 40 || p.x > W + 50) Object.assign(p, this.spawn(W, H, s.k));
      const far = p.z < .35; this.dp(c, s, far ? 1 : 0, p.x, p.y, p.sz, p.rot, p.fl, far ? .6 : .95);
    }
    c.globalCompositeOperation = 'screen';
    for (const m of s.mote) { m.y -= 4 * s.k * dt; m.x += m.v * dt * .3; m.y < -5 && (m.y = H + 5); c.globalAlpha = .35 + .35 * Math.sin(t * 1.3 + m.ph); c.drawImage(s.glow, m.x - m.r * 3, m.y - m.r * 3, m.r * 6, m.r * 6); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // 主角花瓣：远处清晰地飘下来 → 越飘越近、越来越大 → 失焦着从眼前掠过
    const h = s.hero;
    if (t >= h.at && !h.on) Object.assign(h, { on: 1, t0: t, x0: rnd(.32, .68) * W, y0: rnd(.1, .16) * H, x1: rnd(.42, .58) * W, y1: H * .4, x2: pick([-.15, 1.15]) * W, y2: H * .95, rot: rnd(0, TAU), rv: rnd(-.6, .6), fl: rnd(0, TAU) });
    if (h.on) {
      const u = (t - h.t0) / 5.2;
      if (u >= 1) { h.on = 0; h.at = t + rnd(4, 7); }
      else {
        const e = u ** 1.5, x = (1 - e) ** 2 * h.x0 + 2 * (1 - e) * e * h.x1 + e * e * h.x2, y = (1 - e) ** 2 * h.y0 + 2 * (1 - e) * e * h.y1 + e * e * h.y2;
        const sz = lerp(18 * s.k, W * .95, Math.pow(u, 2.2)), fl = h.fl + u * 2.2, rot = h.rot + u * h.rv * 3, A = ss(0, .06, u) * (1 - ss(.9, 1, u));
        const w0 = 1 - ss(.38, .55, u), w2 = ss(.38, .55, u) * (1 - ss(.62, .8, u)), w3 = ss(.62, .8, u);
        this.dp(c, s, 2, x, y, sz, rot, fl, A * w0); this.dp(c, s, 3, x, y, sz, rot, fl, A * w2 * .95); this.dp(c, s, 4, x, y, sz, rot, fl, A * w3 * .85);
        if (u > .55) { c.fillStyle = `rgba(255,200,222,${.12 * ss(.55, .8, u) * (1 - ss(.85, 1, u))})`; c.fillRect(0, 0, W, H); }
      }
    }
    const lk = c.createRadialGradient(W * .82, H * .05, 0, W * .82, H * .05, W * .6); lk.addColorStop(0, `rgba(255,252,240,${.25 + .1 * Math.sin(t * .6)})`); lk.addColorStop(1, 'rgba(255,252,240,0)'); c.fillStyle = lk; c.fillRect(0, 0, W, H);
  },
};

/* ==================== 3. 初雪 ==================== */
const snow = {
  ink: '#fff', shade: 'rgba(10,20,60,.5)', fps: 40,
  init(W, H, d) {
    const s = {}, k = W / 390, bg = cnv(W * d, H * d), b = bg.getContext('2d'); b.scale(d, d);
    b.fillStyle = vgrad(b, 0, H, [[0, '#090f29'], [.35, '#16224a'], [.62, '#34457a'], [.75, '#5b6ea3'], [1, '#2a3766']]); b.fillRect(0, 0, W, H);
    const mx = W * .74, my = H * .2, mr = W * .065, halo = b.createRadialGradient(mx, my, mr, mx, my, mr * 7); halo.addColorStop(0, 'rgba(210,222,255,.4)'); halo.addColorStop(1, 'rgba(210,222,255,0)'); b.fillStyle = halo; b.fillRect(0, 0, W, H);
    const md = b.createRadialGradient(mx - mr * .3, my - mr * .3, 0, mx, my, mr); md.addColorStop(0, '#ffffff'); md.addColorStop(1, '#dfe6fb'); b.fillStyle = md; b.beginPath(); b.arc(mx, my, mr, 0, TAU); b.fill();
    b.fillStyle = 'rgba(150,165,205,.18)'; [[.3, -.2, .22], [-.25, .25, .16], [.1, .35, .1], [-.35, -.3, .09]].forEach(([a, c2, r]) => { b.beginPath(); b.arc(mx + a * mr, my + c2 * mr, r * mr, 0, TAU); b.fill(); });
    const ridge = (y0, amp, f, col0, col1, cap) => {
      const pts = []; for (let i = 0; i <= 60; i++) { const x = i / 60 * W; pts.push([x, y0 + (Math.sin(i * f) * .5 + Math.sin(i * f * 2.3 + 1) * .3 + Math.sin(i * f * 5.1 + 2) * .2) * amp]); }
      b.beginPath(); b.moveTo(0, H); pts.forEach(p => b.lineTo(...p)); b.lineTo(W, H); b.fillStyle = vgrad(b, y0 - amp, H * .9, [[0, col0], [1, col1]]); b.fill();
      if (cap) { b.beginPath(); pts.forEach((p, i) => i ? b.lineTo(...p) : b.moveTo(...p)); b.strokeStyle = cap; b.lineWidth = 2 * k; b.stroke(); }
      return pts;
    };
    ridge(H * .6, H * .05, .35, '#4c5d93', '#26325e', 'rgba(200,215,255,.45)');
    const hill = ridge(H * .7, H * .025, .18, '#dfe7fa', '#94a7d3', 'rgba(255,255,255,.7)');
    const tree = (x, y, h) => { const w = h * .42; for (let i = 0; i < 4; i++) { const ty = y - h * (i * .22), tw = w * (1 - i * .2); b.fillStyle = '#121c3b'; b.beginPath(); b.moveTo(x, ty - h * .38); b.lineTo(x + tw / 2, ty); b.lineTo(x - tw / 2, ty); b.fill(); b.fillStyle = 'rgba(232,240,255,.85)'; b.beginPath(); b.moveTo(x, ty - h * .38); b.lineTo(x + tw * .32, ty - h * .1); b.lineTo(x + tw * .08, ty - h * .14); b.fill(); } b.fillStyle = '#121c3b'; b.fillRect(x - h * .03, y, h * .06, h * .08); };
    const hy = x => { const i = clamp(Math.round(x / W * 60), 0, 60); return hill[i][1]; };
    const tx = [...Array.from({ length: 14 }, () => rnd(-.05, .3)), ...Array.from({ length: 14 }, () => rnd(.68, 1.05)), ...Array.from({ length: 4 }, () => rnd(.3, .68))].sort((a, b2) => a - b2);
    tx.forEach(u => tree(u * W, hy(u * W) + rnd(2, 10) * k, rnd(28, 62) * k * (u > .3 && u < .68 ? .6 : 1)));
    const cx = W * .56, cy = hy(W * .56) + 6 * k, cw = 30 * k; // 亮着灯的小木屋
    b.fillStyle = '#2b2737'; b.fillRect(cx - cw / 2, cy - cw * .6, cw, cw * .6); b.fillStyle = '#eef3ff'; b.beginPath(); b.moveTo(cx - cw * .65, cy - cw * .55); b.lineTo(cx, cy - cw * 1.05); b.lineTo(cx + cw * .65, cy - cw * .55); b.fill();
    const lw = b.createRadialGradient(cx, cy - cw * .3, 0, cx, cy - cw * .3, cw * 1.6); lw.addColorStop(0, 'rgba(255,200,120,.55)'); lw.addColorStop(1, 'rgba(255,200,120,0)'); b.fillStyle = lw; b.fillRect(cx - cw * 2, cy - cw * 2, cw * 4, cw * 4);
    b.fillStyle = '#ffd28a'; b.fillRect(cx - cw * .3, cy - cw * .42, cw * .22, cw * .2); b.fillRect(cx + cw * .08, cy - cw * .42, cw * .22, cw * .2);
    b.beginPath(); b.moveTo(0, H * .86); b.bezierCurveTo(W * .3, H * .82, W * .7, H * .9, W, H * .85); b.lineTo(W, H); b.lineTo(0, H); b.fillStyle = vgrad(b, H * .82, H, [[0, '#f1f5ff'], [.4, '#c8d4ef'], [1, '#8d9dc9']]); b.fill();
    b.fillStyle = vgrad(b, 0, H * .35, [[0, 'rgba(4,8,24,.45)'], [1, 'rgba(4,8,24,0)']]); b.fillRect(0, 0, W, H * .35);
    s.bg = bg; s.k = k; s.cabin = [cx, cy - cw * .3, cw];
    s.stars = Array.from({ length: 90 }, () => ({ x: rnd(0, W), y: rnd(0, H * .55), r: rnd(.3, 1.2) * k, ph: rnd(0, TAU), f: rnd(.6, 2.2) }));
    s.glint = Array.from({ length: 26 }, () => ({ x: rnd(0, W), y: rnd(.87, .99) * H, ph: rnd(0, TAU) }));
    s.flake = dot(16 * d, '#ffffff', .25);
    const cs = 64 * d, cr = cnv(cs, cs), g = cr.getContext('2d'); g.translate(cs / 2, cs / 2); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = 'rgba(200,220,255,.9)'; g.shadowBlur = 4 * d;
    for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * TAU / 6); g.lineWidth = 2.2 * d; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -cs * .44); g.stroke(); g.lineWidth = 1.5 * d; for (const [y, l] of [[.18, .1], [.28, .08], [.36, .05]]) { g.beginPath(); g.moveTo(0, -cs * y); g.lineTo(cs * l, -cs * (y + l)); g.moveTo(0, -cs * y); g.lineTo(-cs * l, -cs * (y + l)); g.stroke(); } g.restore(); }
    s.cryst = cr;
    const L = (n, r0, r1, v0, v1, a) => Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(-H, H), r: rnd(r0, r1) * k, vy: rnd(v0, v1) * k, ph: rnd(0, TAU), a }));
    s.layers = [L(150, .5, 1.1, 10, 20, .7), L(70, 1.2, 2.4, 22, 38, .9), L(12, 5, 11, 45, 70, .32)];
    s.cr = Array.from({ length: 6 }, () => ({ x: rnd(0, W), y: rnd(-H, 0), sz: rnd(10, 20) * k, vy: rnd(18, 30) * k, rot: rnd(0, TAU), rv: rnd(-.6, .6), ph: rnd(0, TAU) }));
    s.fog = Array.from({ length: 4 }, (_, i) => ({ x: rnd(0, W), y: H * (.62 + i * .04), w: W * rnd(.5, .9), v: rnd(4, 10) * k }));
    return s;
  },
  draw(c, t, dt, W, H, s) {
    c.drawImage(s.bg, 0, 0, W, H);
    for (const st of s.stars) { c.globalAlpha = .35 + .55 * (.5 + .5 * Math.sin(t * st.f + st.ph)); c.fillStyle = '#fff'; c.fillRect(st.x, st.y, st.r * 1.6, st.r * 1.6); }
    c.globalCompositeOperation = 'screen'; // 极光：两条缓慢飘动的光带
    for (const [y0, hue, amp] of [[.3, 160, 1], [.38, 280, .7]]) for (let i = 0; i <= 40; i++) {
      const u = i / 40, x = u * W, y = H * y0 + Math.sin(u * 5 + t * .25 + hue) * H * .035 + Math.sin(u * 11 - t * .4) * H * .012, len = H * (.07 + .05 * Math.sin(u * 7 + t * .5 + hue)), a = amp * (.1 + .07 * Math.sin(u * 9 + t * .8)) * Math.sin(u * Math.PI);
      const g = c.createLinearGradient(0, y - len, 0, y + len * .3); g.addColorStop(0, `hsla(${hue},80%,70%,0)`); g.addColorStop(.7, `hsla(${hue},85%,68%,${a})`); g.addColorStop(1, `hsla(${hue},85%,75%,0)`);
      c.fillStyle = g; c.fillRect(x - W / 40, y - len, W / 40 * 2.1, len * 1.3);
    }
    c.globalCompositeOperation = 'source-over';
    const [hx, hy, hw] = s.cabin, fl = .8 + .2 * Math.sin(t * 7) * Math.sin(t * 3.1), lg = c.createRadialGradient(hx, hy, 0, hx, hy, hw * 1.3); lg.addColorStop(0, `rgba(255,190,110,${.25 * fl})`); lg.addColorStop(1, 'rgba(255,190,110,0)'); c.globalAlpha = 1; c.fillStyle = lg; c.fillRect(hx - hw * 2, hy - hw * 2, hw * 4, hw * 4);
    for (const f of s.fog) { f.x += f.v * dt; f.x - f.w > W && (f.x = -f.w); const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.w); g.addColorStop(0, 'rgba(220,230,255,.12)'); g.addColorStop(1, 'rgba(220,230,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(f.x, f.y, f.w, f.w * .18, 0, 0, TAU); c.fill(); }
    for (const gl of s.glint) { const a = Math.max(0, Math.sin(t * 1.7 + gl.ph)) ** 8; if (a > .02) { c.globalAlpha = a; c.fillStyle = '#fff'; star4(c, gl.x, gl.y, 4 * s.k); c.fill(); } }
    const wind = (10 * Math.sin(t * .07) + 5 * Math.sin(t * .23)) * s.k;
    s.layers.forEach((L, li) => { for (const p of L) {
      p.y += p.vy * dt; p.x += (wind * (li + 1) * .5 + Math.sin(t * .8 + p.ph) * (6 + li * 6) * s.k) * dt;
      p.y > H + 20 && (p.y = -20, p.x = rnd(0, W)); p.x > W + 20 && (p.x = -20); p.x < -20 && (p.x = W + 20);
      c.globalAlpha = p.a; const r = p.r * (li == 2 ? 2.4 : 2.2); c.drawImage(s.flake, p.x - r, p.y - r, r * 2, r * 2);
    } });
    c.globalAlpha = .9;
    for (const p of s.cr) { p.y += p.vy * dt; p.x += (wind + Math.sin(t * .6 + p.ph) * 10 * s.k) * dt; p.rot += p.rv * dt; p.y > H + 30 && (p.y = -30, p.x = rnd(0, W)); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.drawImage(s.cryst, -p.sz / 2, -p.sz / 2, p.sz, p.sz); c.restore(); }
    c.globalAlpha = 1;
  },
};

/* ==================== 4. 小雨（隔着湿玻璃看雨夜的街） ==================== */
const rain = {
  ink: '#fff', shade: 'rgba(0,10,25,.5)',
  init(W, H, d) {
    const s = {}, k = W / 390;
    // 先画一张清晰的夜景（楼、窗、霓虹、路灯、车灯、湿地倒影），再整体虚化成窗外失焦的样子
    const city = cnv(W * d, H * d), b = city.getContext('2d'); b.scale(d, d);
    b.fillStyle = vgrad(b, 0, H, [[0, '#0b1424'], [.5, '#1a2a44'], [.72, '#2b3550'], [1, '#121a29']]); b.fillRect(0, 0, W, H);
    const sky = b.createRadialGradient(W * .5, H * .62, 0, W * .5, H * .62, W); sky.addColorStop(0, 'rgba(255,170,140,.22)'); sky.addColorStop(1, 'rgba(255,170,140,0)'); b.fillStyle = sky; b.fillRect(0, 0, W, H);
    const gy = H * .74, warm = ['#ffd59a', '#ffc27a', '#fff0c8'], cool = ['#9fd2ff', '#c9e6ff'];
    for (let layer = 0; layer < 2; layer++) { let x = -10 * k; while (x < W) {
      const bw = rnd(.1, .2) * W * (layer ? 1.1 : .8), bh = rnd(.12, layer ? .32 : .42) * H, top = gy - bh;
      b.fillStyle = layer ? '#0c1422' : '#16213a'; b.fillRect(x, top, bw - 3 * k, bh);
      for (let wy = top + 8 * k; wy < gy - 10 * k; wy += 11 * k) for (let wx = x + 5 * k; wx < x + bw - 10 * k; wx += 9 * k) if (Math.random() < (layer ? .42 : .3)) { b.fillStyle = rgba(Math.random() < .75 ? pick(warm) : pick(cool), rnd(.5, 1)); b.fillRect(wx, wy, 4.5 * k, 6 * k); }
      if (Math.random() < .35) { b.fillStyle = pick(['#ff5fa2', '#5fe3ff', '#ff7b54', '#b18cff']); b.fillRect(x + bw * .2, top + bh * rnd(.15, .5), bw * .5, 7 * k); }
      x += bw;
    } }
    b.fillStyle = '#0a0f19'; b.fillRect(0, gy, W, H - gy);
    for (let i = 0; i < 7; i++) { const x = (i + .5) / 7 * W; b.fillStyle = '#ffcf8a'; b.beginPath(); b.arc(x, gy - H * .06, 4 * k, 0, TAU); b.fill(); }
    for (let i = 0; i < 9; i++) { const x = rnd(0, W), y = gy + rnd(.02, .1) * H, red = Math.random() < .5; b.fillStyle = red ? '#ff3b4a' : '#fff6e0'; b.beginPath(); b.arc(x, y, 3 * k, 0, TAU); b.arc(x + 12 * k, y, 3 * k, 0, TAU); b.fill(); }
    b.save(); b.translate(0, gy * 2); b.scale(1, -1); b.globalAlpha = .35; b.drawImage(city, 0, gy * d, W * d, (H - gy) * d * .8, 0, gy - (H - gy) * .8, W, (H - gy) * .8); b.restore(); // 湿地面的倒影
    for (let i = 0; i < 26; i++) { // 散景光斑（带亮边）
      const r = rnd(10, 34) * k, x = rnd(0, W), y = H * rnd(.45, .95), col = pick([...warm, ...cool, '#ff8fb3', '#ff9a7a']), g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, .2)); g.addColorStop(.8, rgba(col, .32)); g.addColorStop(.93, rgba(col, .5)); g.addColorStop(1, rgba(col, 0)); b.fillStyle = g; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
    }
    const bg = blurC(city, 13 * d), x2 = bg.getContext('2d');
    x2.globalCompositeOperation = 'screen'; x2.globalAlpha = .75; x2.drawImage(blurC(city, 6 * d), 0, 0); x2.globalAlpha = .5; x2.drawImage(bg, 0, 0); x2.globalAlpha = 1; x2.globalCompositeOperation = 'source-over'; x2.scale(d, d); // 提亮：灯光更有光晕
    x2.fillStyle = vgrad(x2, 0, H * .42, [[0, 'rgba(4,8,18,.6)'], [1, 'rgba(4,8,18,0)']]); x2.fillRect(0, 0, W, H * .42);
    x2.fillStyle = 'rgba(160,185,220,.05)'; x2.fillRect(0, 0, W, H);
    s.bg = bg; s.city = city; s.k = k;
    s.small = cnv(W * d, H * d); const sm = s.small.getContext('2d'); sm.scale(d, d); // 玻璃上的细小水珠
    for (let i = 0; i < 650; i++) { const x = rnd(0, W), y = rnd(0, H), r = Math.random() ** 2 * 2.2 * k + .35 * k; sm.fillStyle = 'rgba(0,5,15,.32)'; sm.beginPath(); sm.arc(x, y + r * .35, r, 0, TAU); sm.fill(); sm.fillStyle = 'rgba(205,225,255,.3)'; sm.beginPath(); sm.arc(x, y, r, 0, TAU); sm.fill(); sm.fillStyle = 'rgba(255,255,255,.75)'; sm.fillRect(x - r * .45, y - r * .55, r * .45, r * .45); }
    s.streak = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, H), l: rnd(14, 36) * k, v: rnd(420, 820) * k, a: rnd(.05, .16) }));
    s.drops = Array.from({ length: 58 }, () => this.drop(W, H, k, true)); s.trail = [];
    return s;
  },
  drop(W, H, k, any) { const r = (Math.random() ** 1.6 * 7 + 2.4) * k; return { x: rnd(0, W), y: any ? rnd(0, H) : rnd(-.05, .6) * H, r: any ? r : r * .4, R: r, vy: 0, mv: 0, wob: rnd(0, TAU), lt: 0 }; },
  draw(c, t, dt, W, H, s) {
    const d = s.bg.width / W, k = s.k;
    c.drawImage(s.bg, 0, 0, W, H);
    c.strokeStyle = 'rgb(205,225,255)'; c.lineWidth = .8 * k; // 玻璃外的雨丝
    for (const r of s.streak) { r.y += r.v * dt; r.x -= r.v * .08 * dt; if (r.y > H + 40) { r.y = -40; r.x = rnd(0, W * 1.1); } c.globalAlpha = r.a; c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x + r.l * .08, r.y - r.l); c.stroke(); }
    c.globalAlpha = 1; c.drawImage(s.small, 0, 0, W, H);
    s.trail = s.trail.filter(p => (p.life -= dt) > 0);
    for (const p of s.trail) { c.globalAlpha = Math.min(1, p.life / 3) * .85; c.fillStyle = 'rgba(205,225,255,.4)'; c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 1.25, 0, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    for (const p of s.drops) {
      if (!p.mv) { p.r = Math.min(p.R, p.r + dt * .35 * k); p.r > 5 * k && Math.random() < dt * .07 && (p.mv = 1); }
      else { p.vy = Math.min(160 * k, p.vy + 95 * k * dt); p.y += p.vy * dt; p.x += Math.sin(t * 3 + p.wob) * 7 * k * dt; p.lt += p.vy * dt; if (p.lt > rnd(9, 22) * k) { p.lt = 0; s.trail.push({ x: p.x + rnd(-1.5, 1.5) * k, y: p.y - p.r * rnd(1.2, 2), r: rnd(.5, 1.6) * k, life: rnd(2, 5) }); } if (p.y - p.r > H) Object.assign(p, this.drop(W, H, k)); }
      const { x, y, r } = p, ry = r * 1.18, L = r * 6;
      c.save(); c.beginPath(); c.ellipse(x, y, r, ry, 0, 0, TAU); c.clip(); // 折射：水珠里是倒过来、缩小、清晰的街景
      c.translate(x, y); c.scale(1, -1); const sy = clamp((y + H * .25 - L) * d, 0, s.bg.height - 2 * L * d); c.drawImage(s.bg, clamp((x - L) * d, 0, s.bg.width - 2 * L * d), sy, 2 * L * d, 2 * L * d, -r * 1.1, -ry * 1.1, r * 2.2, ry * 2.2); c.fillStyle = 'rgba(190,210,240,.16)'; c.fillRect(-r * 1.2, -ry * 1.2, r * 2.4, ry * 2.4); c.restore();
      const sh = c.createLinearGradient(x, y - ry, x, y + ry); sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,255,255,.3)');
      c.fillStyle = sh; c.beginPath(); c.ellipse(x, y, r, ry, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.32)'; c.lineWidth = .9 * k; c.beginPath(); c.ellipse(x, y + .6 * k, r, ry, 0, .1 * Math.PI, .9 * Math.PI); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(x - r * .35, y - ry * .45, r * .24, r * .15, -.6, 0, TAU); c.fill();
    }
    const mist = c.createLinearGradient(0, H * .8, 0, H); mist.addColorStop(0, 'rgba(170,195,230,0)'); mist.addColorStop(1, `rgba(170,195,230,${.14 + .04 * Math.sin(t * .5)})`); c.fillStyle = mist; c.fillRect(0, H * .8, W, H * .2);
  },
};

/* ==================== 5. 爱丽丝梦游仙境：掉进兔子洞 ==================== */
const alice = {
  ink: '#fff', shade: 'rgba(48,22,100,.85)', fps: 40,
  init(W, H, d) {
    const s = {}, k = W / 390, cx = W / 2, cy = H * .57, bg = cnv(W * d, H * d), b = bg.getContext('2d'); b.scale(d, d);
    const rg = b.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * .62); rg.addColorStop(0, '#fff3fc'); rg.addColorStop(.1, '#f9cdf0'); rg.addColorStop(.3, '#cfa2ee'); rg.addColorStop(.55, '#8a73d4'); rg.addColorStop(.8, '#4a3c94'); rg.addColorStop(1, '#1d1846'); b.fillStyle = rg; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { b.fillStyle = rgba(pick(['#ffffff', '#ffe9a8', '#ffd1f0', '#c8f0ff']), rnd(.2, .7)); const r = rnd(.3, 1.2) * k; b.beginPath(); b.arc(rnd(0, W), rnd(0, H), r, 0, TAU); b.fill(); }
    const mist = cnv(W * d, H * d), mx = mist.getContext('2d'); mx.scale(d, d);
    for (let i = 0; i < 40; i++) { mx.fillStyle = pick(['#ffc6ec', '#b9f1ef', '#d8c2ff', '#fff0b8']); mx.globalAlpha = rnd(.25, .5); mx.beginPath(); mx.arc(rnd(-.1, 1.1) * W, H * (.86 + rnd(0, .2)), rnd(.08, .2) * W, 0, TAU); mx.fill(); }
    b.drawImage(blurC(mist, 18 * d), 0, 0, W, H);
    s.bg = bg; s.k = k; s.cx = cx; s.cy = cy;
    s.bub = Array.from({ length: 12 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(8, 22) * k, v: rnd(8, 18) * k, ph: rnd(0, TAU) }));
    // 背景大钟面
    const R = W * .44, cl = cnv(R * 2 * d, R * 2 * d), g = cl.getContext('2d'); g.scale(d, d); g.translate(R, R); g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    g.lineWidth = 2 * k; g.beginPath(); g.arc(0, 0, R * .96, 0, TAU); g.stroke(); g.lineWidth = .8 * k; g.beginPath(); g.arc(0, 0, R * .8, 0, TAU); g.stroke();
    g.font = `${R * .11}px "Cormorant Garamond",Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    'XII I II III IV V VI VII VIII IX X XI'.split(' ').forEach((n, i) => { const a = i * TAU / 12 - Math.PI / 2; g.fillText(n, Math.cos(a) * R * .88, Math.sin(a) * R * .88); });
    for (let i = 0; i < 60; i++) { const a = i * TAU / 60; g.lineWidth = (i % 5 ? .6 : 1.6) * k; g.beginPath(); g.moveTo(Math.cos(a) * R * .76, Math.sin(a) * R * .76); g.lineTo(Math.cos(a) * R * (i % 5 ? .73 : .7), Math.sin(a) * R * (i % 5 ? .73 : .7)); g.stroke(); }
    s.clock = cl; s.R = R;
    // 道具贴图
    const S = 128 * d, mk = f => { const c2 = cnv(S, S), x = c2.getContext('2d'); x.translate(S / 2, S / 2); x.scale(S / 128, S / 128); f(x); return c2; };
    const card = (suit, red, lab) => mk(x => { x.fillStyle = '#fffdf8'; x.shadowColor = 'rgba(60,30,90,.35)'; x.shadowBlur = 6 * d; x.beginPath(); x.roundRect ? x.roundRect(-30, -42, 60, 84, 7) : x.rect(-30, -42, 60, 84); x.fill(); x.shadowBlur = 0; x.strokeStyle = '#e7d9c4'; x.lineWidth = 1.5; x.stroke(); x.fillStyle = red ? '#d8344f' : '#2a2340'; x.font = 'bold 15px Georgia,serif'; x.textAlign = 'center'; x.fillText(lab, -20, -24); x.font = '38px Georgia,"Segoe UI Symbol",serif'; x.textBaseline = 'middle'; x.fillText(suit, 0, 4); x.font = '12px Georgia,serif'; x.fillText(suit, -20, -10); });
    const watch = mk(x => { x.strokeStyle = '#d9a93c'; x.lineWidth = 3; x.beginPath(); x.arc(0, -46, 8, 0, TAU); x.stroke(); x.fillStyle = '#e8bd52'; x.fillRect(-5, -40, 10, 7); const gr = x.createRadialGradient(-8, -8, 2, 0, 0, 36); gr.addColorStop(0, '#fff2c2'); gr.addColorStop(1, '#c8902a'); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 36, 0, TAU); x.fill(); x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(0, 0, 29, 0, TAU); x.fill(); x.strokeStyle = '#6b5a3a'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; x.lineWidth = i % 3 ? 1 : 2.2; x.beginPath(); x.moveTo(Math.cos(a) * 25, Math.sin(a) * 25); x.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); x.stroke(); } x.lineWidth = 2.4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -18); x.moveTo(0, 0); x.lineTo(12, 5); x.stroke(); x.fillStyle = '#6b5a3a'; x.beginPath(); x.arc(0, 0, 2.5, 0, TAU); x.fill(); });
    const cup = mk(x => { x.fillStyle = '#f9e8f4'; x.beginPath(); x.ellipse(0, 26, 44, 10, 0, 0, TAU); x.fill(); x.strokeStyle = '#d58bb5'; x.lineWidth = 2; x.stroke(); const gr = x.createLinearGradient(-30, 0, 30, 0); gr.addColorStop(0, '#ffd6ea'); gr.addColorStop(.5, '#fff6fb'); gr.addColorStop(1, '#f2b5d6'); x.fillStyle = gr; x.beginPath(); x.moveTo(-32, -12); x.bezierCurveTo(-30, 22, 30, 22, 32, -12); x.closePath(); x.fill(); x.stroke(); x.beginPath(); x.ellipse(0, -12, 32, 7, 0, 0, TAU); x.fillStyle = '#b07a5a'; x.fill(); x.stroke(); x.beginPath(); x.arc(38, 0, 9, -1.2, 1.4); x.lineWidth = 4; x.stroke(); x.fillStyle = '#ff7eb6'; [[-14, 4], [6, 8], [18, -2], [-4, -2]].forEach(([a, b2]) => { x.beginPath(); x.arc(a, b2, 3, 0, TAU); x.fill(); }); });
    const key = mk(x => { x.strokeStyle = '#e2b54c'; x.fillStyle = '#e2b54c'; x.lineWidth = 6; x.beginPath(); x.arc(-30, 0, 14, 0, TAU); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(-30, 0, 6, 0, TAU); x.stroke(); x.fillRect(-16, -3, 56, 6); x.fillRect(26, 3, 6, 12); x.fillRect(36, 3, 5, 9); x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(-14, -3, 50, 1.5); });
    const rose = mk(x => { x.fillStyle = '#3f8a5a'; x.beginPath(); x.ellipse(-20, 22, 16, 7, -.6, 0, TAU); x.fill(); x.beginPath(); x.ellipse(18, 24, 15, 6, .5, 0, TAU); x.fill(); for (let i = 0; i < 7; i++) { const r = 30 - i * 4; x.fillStyle = i % 2 ? '#e0405f' : '#c92a4a'; x.beginPath(); x.arc(Math.cos(i * 2.3) * i * .8, Math.sin(i * 2.3) * i * .8, r, 0, TAU); x.fill(); x.strokeStyle = 'rgba(120,10,30,.35)'; x.lineWidth = 1.5; x.beginPath(); x.arc(Math.cos(i * 2.3) * i, Math.sin(i * 2.3) * i, r * .9, i, i + 3.6); x.stroke(); } });
    const bottle = mk(x => { const gr = x.createLinearGradient(-26, 0, 26, 0); gr.addColorStop(0, 'rgba(160,220,255,.75)'); gr.addColorStop(.4, 'rgba(230,248,255,.95)'); gr.addColorStop(1, 'rgba(120,180,240,.75)'); x.fillStyle = gr; x.beginPath(); x.moveTo(-8, -40); x.lineTo(8, -40); x.lineTo(8, -22); x.bezierCurveTo(30, -14, 28, 40, 0, 42); x.bezierCurveTo(-28, 40, -30, -14, -8, -22); x.closePath(); x.fill(); x.fillStyle = 'rgba(190,120,255,.55)'; x.beginPath(); x.moveTo(-24, 8); x.bezierCurveTo(-22, 40, 22, 40, 24, 8); x.fill(); x.fillStyle = '#9b6b3c'; x.fillRect(-9, -50, 18, 11); x.fillStyle = '#fff8e8'; x.save(); x.rotate(-.12); x.fillRect(-20, -8, 40, 18); x.fillStyle = '#5a3f2a'; x.font = 'italic bold 8.5px Georgia,serif'; x.textAlign = 'center'; x.fillText('DRINK ME', 0, 4); x.restore(); });
    const hat = mk(x => { x.fillStyle = '#3b2f5c'; x.beginPath(); x.ellipse(0, 26, 46, 12, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(-28, 24); x.lineTo(-24, -34); x.quadraticCurveTo(0, -42, 24, -34); x.lineTo(28, 24); x.fill(); x.fillStyle = '#d9577e'; x.fillRect(-27, 6, 54, 10); x.fillStyle = '#fff8e8'; x.save(); x.translate(14, -2); x.rotate(.2); x.fillRect(-9, -10, 18, 13); x.fillStyle = '#3b2f5c'; x.font = 'bold 7px Georgia'; x.textAlign = 'center'; x.fillText('10/6', 0, -1); x.restore(); });
    s.spr = [watch, watch, card('♥', 1, 'A'), card('♠', 0, 'K'), card('♦', 1, 'Q'), card('♣', 0, 'J'), card('♥', 1, 'Q'), cup, key, rose, rose, bottle, hat];
    s.items = Array.from({ length: 24 }, (_, i) => this.item(s, i / 24));
    s.spark = Array.from({ length: 46 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(2, 6) * k, ph: rnd(0, TAU), f: rnd(.8, 2.4), c: pick(['#ffffff', '#ffe9a8', '#ffc4e8', '#c8f0ff']), vy: rnd(-8, -2) * k }));
    return s;
  },
  item(s, rr = 0) { return { img: pick(s.spr), a: rnd(0, TAU), rr, v: rnd(.05, .09), rot: rnd(0, TAU), rv: rnd(-.8, .8), fl: rnd(0, TAU), fv: rnd(.6, 1.6), sz: rnd(.8, 1.2) }; },
  draw(c, t, dt, W, H, s) {
    const { cx, cy, k } = s;
    c.drawImage(s.bg, 0, 0, W, H);
    c.lineCap = 'round'; // 兔子洞漩涡
    for (let arm = 0; arm < 4; arm++) { c.beginPath(); for (let i = 0; i <= 70; i++) { const u = i / 70, r = u * Math.hypot(W, H) * .7, a = arm * TAU / 4 + u * 5 - t * .12; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .92); } c.strokeStyle = arm % 2 ? `rgba(255,214,246,${.09 + .03 * Math.sin(t + arm)})` : `rgba(190,240,255,${.07 + .03 * Math.sin(t + arm)})`; c.lineWidth = 30 * k; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 2.5 * k; c.stroke(); }
    c.save(); c.globalAlpha = .16; c.translate(cx, cy); c.rotate(Math.sin(t * .1) * .05); c.drawImage(s.clock, -s.R, -s.R, s.R * 2, s.R * 2);
    c.strokeStyle = '#fff'; c.lineWidth = 3 * k; c.globalAlpha = .22; const hA = -t * .05, mA = -t * .6; // 时针倒着走
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(hA) * s.R * .4, -Math.cos(hA) * s.R * .4); c.stroke(); c.lineWidth = 1.8 * k; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(mA) * s.R * .62, -Math.cos(mA) * s.R * .62); c.stroke(); c.restore();
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, W * .2); glow.addColorStop(0, `rgba(255,250,255,${.42 + .1 * Math.sin(t * .9)})`); glow.addColorStop(1, 'rgba(255,250,255,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const Rm = Math.hypot(W, H) * .6, base = W * .3 / 128;
    s.items.sort((a, b) => a.rr - b.rr);
    for (const it of s.items) { // 道具从洞心飘出、越飘越近
      it.rr += dt * it.v * (.35 + it.rr); it.a += dt * .1; it.rot += it.rv * dt; it.fl += it.fv * dt;
      if (it.rr > 1.15) Object.assign(it, this.item(s, .02));
      const sc = lerp(.14, 1.5, it.rr ** 1.15) * base * it.sz * 128, x = cx + Math.cos(it.a) * it.rr * Rm, y = cy + Math.sin(it.a) * it.rr * Rm * .9;
      c.save(); c.translate(x, y); c.rotate(it.rot); c.scale(Math.cos(it.fl) * .8 + Math.sign(Math.cos(it.fl)) * .2, 1); c.globalAlpha = ss(0, .12, it.rr) * (1 - ss(.95, 1.15, it.rr)); c.drawImage(it.img, -sc / 2, -sc / 2, sc, sc); c.restore();
    }
    for (const q of s.bub) { // 彩虹肥皂泡
      q.y -= q.v * dt; q.x += Math.sin(t * .7 + q.ph) * 8 * k * dt; q.y < -q.r * 2 && (q.y = H + q.r * 2, q.x = rnd(0, W));
      const g = c.createRadialGradient(q.x - q.r * .3, q.y - q.r * .3, q.r * .2, q.x, q.y, q.r); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.75, 'rgba(255,255,255,.05)'); g.addColorStop(.9, `hsla(${(t * 40 + q.ph * 60) % 360},90%,80%,.45)`); g.addColorStop(1, 'rgba(255,255,255,.6)');
      c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(q.x - q.r * .4, q.y - q.r * .45, q.r * .2, q.r * .1, -.7, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'lighter';
    for (const p of s.spark) { p.y += p.vy * dt; p.y < -10 && (p.y = H + 10, p.x = rnd(0, W)); const a = Math.max(0, Math.sin(t * p.f + p.ph)); c.globalAlpha = a * .9; c.fillStyle = p.c; star4(c, p.x, p.y, p.r * (.6 + .4 * a)); c.fill(); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = vgrad(c, 0, H * .3, [[0, 'rgba(30,20,70,.35)'], [1, 'rgba(30,20,70,0)']]); c.fillRect(0, 0, W, H * .3);
  },
};

/* ==================== 6. 红线：两根线互相寻找，相遇后缠绕成心 ==================== */
const heart = u => { const a = u * TAU; return [16 * Math.sin(a) ** 3 / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17]; };
const thread = {
  ink: '#ffeef2', shade: 'rgba(120,0,20,.55)',
  init(W, H, d) {
    const s = { k: W / 390 }, bg = cnv(W * d, H * d), b = bg.getContext('2d'); b.scale(d, d);
    b.fillStyle = vgrad(b, 0, H, [[0, '#14090f'], [.5, '#27111b'], [1, '#0f070b']]); b.fillRect(0, 0, W, H);
    const gl = b.createRadialGradient(W / 2, H * .6, 0, W / 2, H * .6, W * .9); gl.addColorStop(0, 'rgba(120,20,45,.35)'); gl.addColorStop(1, 'rgba(120,20,45,0)'); b.fillStyle = gl; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { b.fillStyle = `rgba(255,${rnd(180, 255) | 0},${rnd(190, 255) | 0},${rnd(.01, .05)})`; b.fillRect(rnd(0, W), rnd(0, H), 1, 1); }
    s.bg = bg; s.dust = Array.from({ length: 40 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.4, 1.4) * s.k, ph: rnd(0, TAU), vy: rnd(-6, -1) * s.k }));
    s.sp = dot(10 * d, '#ff6b81', .2); this.reset(s, W, H, 0); return s;
  },
  reset(s, W, H, t) {
    const k = s.k, mk = (x, y, a) => ({ x, y, a, hist: [[x, y]], ph: rnd(0, 100) });
    s.t0 = t; s.fade = 1; s.sparks = []; s.A && (delete s.A.cut, delete s.B.cut);
    s.A = mk(rnd(.05, .2) * W, rnd(.75, .95) * H, -.6); s.B = mk(rnd(.8, .95) * W, rnd(.3, .45) * H, 2.6);
    s.hc = [W / 2, H * .63]; s.hr = W * .3; s.sp0 = 95 * k;
  },
  step(h, tx, ty, dt, ease) { h.x = lerp(h.x, tx, 1 - Math.exp(-dt * ease)); h.y = lerp(h.y, ty, 1 - Math.exp(-dt * ease)); },
  push(h, max, k) { const l = h.hist[h.hist.length - 1]; if (Math.hypot(h.x - l[0], h.y - l[1]) > 1.6 * k) h.hist.push([h.x, h.y]); while (h.hist.length > max) h.hist.shift(); },
  line(c, h, a, k) {
    const P = h.hist, n = P.length; if (n < 3) return;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, col, al] of [[7 * k, '#ff2d4f', .1], [3.2 * k, '#e3203f', .9], [1.1 * k, '#ff9aa9', .8]]) {
      const seg = 24;
      for (let i = 0; i < n - 1; i += seg) { // 尾部渐隐
        c.globalAlpha = a * al * Math.min(1, (i + seg) / Math.min(n, 160) + .05);
        c.beginPath(); c.moveTo(...P[i]); for (let j = i + 1; j < Math.min(n, i + seg + 1); j++) { const m = [(P[j - 1][0] + P[j][0]) / 2, (P[j - 1][1] + P[j][1]) / 2]; c.quadraticCurveTo(P[j - 1][0], P[j - 1][1], m[0], m[1]); } c.lineTo(...P[Math.min(n - 1, i + seg)]);
        c.strokeStyle = col; c.lineWidth = w; c.stroke();
      }
    }
    c.globalAlpha = a; c.drawImage(this.sprite, h.x - 9 * k, h.y - 9 * k, 18 * k, 18 * k);
  },
  draw(c, t, dt, W, H, s) {
    this.sprite = s.sp; const k = s.k, T = t - s.t0, { A, B } = s, [hx, hy] = s.hc, hr = s.hr;
    c.drawImage(s.bg, 0, 0, W, H);
    let max = 200;
    if (T < 8) { // ① 寻找：各自游走，越来越被对方吸引
      for (const [h, o] of [[A, B], [B, A]]) {
        const wa = Math.sin(t * .7 + h.ph) * 1.4 + Math.sin(t * 1.9 + h.ph * 2) * .6, to = Math.atan2(o.y - h.y, o.x - h.x), att = ss(1.5, 7.5, T) * .85;
        let da = ((to - h.a + Math.PI * 3) % TAU) - Math.PI; h.a += (wa * (1 - att) * .9 + da * att * 1.6) * dt;
        const edge = (h.x < W * .06 || h.x > W * .94 || h.y < H * .2 || h.y > H * .95); edge && (h.a += (Math.atan2(H * .6 - h.y, W / 2 - h.x) - h.a) * dt * 3);
        const v = s.sp0 * (1 - ss(6, 8, T) * .4); h.x += Math.cos(h.a) * v * dt; h.y += Math.sin(h.a) * v * dt;
      }
    } else if (T < 10.5) { // ② 相遇：互相绕圈，一起移到心形起点
      const u = ss(8, 10.5, T), h0 = heart(0), mx = lerp((A.x + B.x) / 2, hx + h0[0] * hr, u), my = lerp((A.y + B.y) / 2, hy + h0[1] * hr, u), r = lerp(Math.max(18 * k, Math.hypot(A.x - B.x, A.y - B.y) / 2), 6 * k, u), a = T * 4.2;
      this.step(A, mx + Math.cos(a) * r, my + Math.sin(a) * r, dt, 6); this.step(B, mx - Math.cos(a) * r, my - Math.sin(a) * r, dt, 6); max = 260;
    } else if (T < 17) { // ③ 缠绕着画出一颗心
      const u = ss(10.5, 17, T), [px, py] = heart(u), [qx, qy] = heart(Math.min(1, u + .003)), nx = -(qy - py), ny = qx - px, nl = Math.hypot(nx, ny) || 1, tw = Math.sin(u * TAU * 9) * 6 * k;
      this.step(A, hx + px * hr + nx / nl * tw, hy + py * hr + ny / nl * tw, dt, 10); this.step(B, hx + px * hr - nx / nl * tw, hy + py * hr - ny / nl * tw, dt, 10); max = 1400;
      for (const h of [A, B]) { h.cut ??= h.hist.length; const n = Math.min(h.cut, Math.ceil(dt * 70)); h.cut -= n; h.hist.splice(0, n); } // 寻找时留下的线头慢慢收回
    } else { max = 1400; const h0 = heart(0); for (const h of [A, B]) if (h.cut) { h.hist.splice(0, h.cut); h.cut = 0; } this.step(A, hx + h0[0] * hr + Math.cos(t * 2) * 3 * k, hy + h0[1] * hr + Math.sin(t * 2) * 3 * k, dt, 2); this.step(B, hx + h0[0] * hr - Math.cos(t * 2) * 3 * k, hy + h0[1] * hr - Math.sin(t * 2) * 3 * k, dt, 2); T > 19.5 && (s.fade = 1 - ss(19.5, 21, T)); T > 21.2 && this.reset(s, W, H, t); }
    this.push(A, max, k); this.push(B, max, k);
    const near = Math.hypot(A.x - B.x, A.y - B.y);
    if (near < 14 * k && Math.random() < .6) s.sparks.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, vx: rnd(-30, 30) * k, vy: rnd(-40, 10) * k, l: rnd(.6, 1.2) });
    if (T > 16.5 && T < 19.5) { // 心形完成后的光晕
      const p = Math.sin((T - 16.5) / 3 * Math.PI), g = c.createRadialGradient(hx, hy, 0, hx, hy, hr * 1.5); g.addColorStop(0, `rgba(255,60,90,${.18 * p})`); g.addColorStop(1, 'rgba(255,60,90,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.globalCompositeOperation = 'lighter'; this.line(c, A, s.fade, k); this.line(c, B, s.fade, k);
    s.sparks = s.sparks.filter(p => (p.l -= dt) > 0);
    for (const p of s.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = p.l * s.fade; c.drawImage(s.sp, p.x - 4 * k, p.y - 4 * k, 8 * k, 8 * k); }
    for (const m of s.dust) { m.y += m.vy * dt; m.y < 0 && (m.y = H, m.x = rnd(0, W)); c.globalAlpha = .3 + .3 * Math.sin(t + m.ph); c.fillStyle = '#ffb3c0'; c.fillRect(m.x, m.y, m.r, m.r); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
};

export const FX = { cathedral, sakura, snow, rain, alice, thread };
export const sceneInk = k => FX[k] ? { ink: FX[k].ink, shade: FX[k].shade } : { ink: '#fff', shade: 'rgba(0,0,0,.4)' };

// 挂载到 canvas：自动适配尺寸 / 像素比，页面隐藏时暂停；opts.fps 限帧（小预览用），opts.t 起始时间（截图用）
export function mountScene(cv, key, opts = {}) {
  const S = FX[key] || cathedral, ctx = cv.getContext('2d'); let W = 0, H = 0, st, raf, last = 0, acc = 0, dead = 0, t = opts.t || 0;
  const dpr = Math.min(opts.dpr || globalThis.devicePixelRatio || 1, S.dpr || 2), step = 1 / Math.min(opts.fps || 60, S.fps || 60);
  const size = () => { const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height; if (w == W && h == H && st) return; W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st = S.init(W, H, dpr); };
  const frame = dt => { size(); t += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); S.draw(ctx, t, dt, W, H, st); };
  const loop = now => { if (dead) return; raf = requestAnimationFrame(loop); const dt = last ? Math.min(.1, (now - last) / 1e3) : 0; last = now; if (document.hidden || !cv.isConnected || opts.active && !opts.active() || !cv.clientWidth) return; acc += dt; if (acc < step * .9) return; frame(Math.min(.05, acc)); acc = 0; };
  raf = requestAnimationFrame(loop);
  return { stop() { dead = 1; cancelAnimationFrame(raf); }, advance(sec, n = 1) { for (let i = 0; i < n; i++) frame(sec / n); } };
}
