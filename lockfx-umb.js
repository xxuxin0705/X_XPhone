// 小手机 · 动态锁屏「伞下烟火」：用的是你给的三张图——
//   底图：花火大会的照片（原来那把纸伞换成透明的金鱼伞，往后撑着挡住头和上半身）；
//   伞面：透明金鱼伞照片里的水纹、伞骨、伞柄；金鱼和挂件从照片里抠出来，单独会动。
// 天上一开始是黑的，过几秒照片里的烟花一朵一朵炸开，最后满天烟花 + 地面瀑布焰火（就是原照片的样子）。
// 动效：水纹上的光沿着漩涡一圈圈流过去（水在流）、金鱼在伞面上游、挂件小金鱼轻轻晃。
// 互动：点天空 → 那里放一朵烟花；点伞面 → 水波荡开、金鱼吓得游开；点挂件 → 晃起来；歪手机挂件也跟着晃。
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const cnv = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
const dot = (r, col) => { const c = cnv(r * 2, r * 2), x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; };
const angD = (a, b) => { let d = (b - a) % TAU; d > Math.PI && (d -= TAU); d < -Math.PI && (d += TAU); return d; };

// 底图坐标（905×1580）：人站在 x=452；新伞的圆心和半径；烟花层从 y=0 开始，地面焰火层从 y=900 开始
const BW = 905, BH = 1580, PX = 452, DISC = [453, 1060, 255], GY = 900, HZ = 930;
// 伞面贴图（512，对应照片里半径 510 的圆）：漩涡中心、挂件挂的位置（伞面局部坐标，半径 1）
const VORT = [.024, -.059], PIVOT = [-.402, -.071];
// 金鱼贴图（都已转成鱼头朝右）：x, y, w, h；最后一个是挂件小金鱼
const FISH = [[0, 0, 121, 63], [125, 0, 77, 33], [206, 0, 51, 39], [261, 0, 54, 29], [319, 0, 58, 43], [381, 0, 62, 34]], CHARM = [447, 0, 50, 36];
// 照片里一朵朵能认出来的烟花（底图坐标 x, y, 半径）：蓝白色带放射线的、金色小菊花、大团的菊花
// 已经去掉了蓝色烟雾、只留火星，拼在 hanabi_burst.webp 里：图集里的 x, y, 边长, 原来的半径
const SITES = [[0, 0, 210, 150], [212, 0, 182, 130], [396, 0, 140, 100], [538, 0, 147, 105], [687, 0, 140, 100], [829, 0, 77, 55], [908, 0, 84, 60], [0, 212, 70, 50], [72, 212, 84, 60], [158, 212, 168, 120], [328, 212, 168, 120], [498, 212, 154, 110]];
const FILES = { bg: 'hanabi_bg.webp', fw: 'hanabi_fw.webp', gnd: 'hanabi_gnd.webp', water: 'hanabi_water.webp', burst: 'hanabi_burst.webp', umb: 'hanabi_umb.webp', fish: 'hanabi_fish.webp' };
const IMG = {}; let imgP;
export const loadHanabi = () => imgP ||= Promise.all(Object.entries(FILES).map(([k, f]) => new Promise(res => { const i = new Image(); i.decoding = 'async'; const done = () => { IMG[k] = i; res(); }; i.onload = () => (i.decode ? i.decode().then(done, done) : done()); i.onerror = () => res(); i.src = new URL('./assets/' + f, import.meta.url).href; })));

// 沿漩涡的光带（转起来就像水在往里流）
function spiral(sz) {
  const c = cnv(sz, sz), x = c.getContext('2d'), d = x.createImageData(sz, sz), h = sz / 2;
  for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) {
    const dx = (i - h) / h, dy = (j - h) / h, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const v = (.5 + .5 * Math.cos(2 * a + 7 * Math.log(r + .05))) ** 6 * ss(.03, .2, r) * (1 - ss(.9, 1.05, r)), o = (j * sz + i) * 4;
    d.data[o] = d.data[o + 1] = d.data[o + 2] = 255; d.data[o + 3] = v * 255;
  }
  x.putImageData(d, 0, 0); return c;
}

export const hanabi = {
  ink: '#ffffff', shade: 'rgba(0,0,0,.5)', dpr: 2, fps: 60, interactive: true, hint: '点天空放烟花 · 点伞面拨水 · 点挂着的小金鱼',
  init(W, H, dpr) {
    const small = W < 200, k = dpr, s = { W, H, k, small, t: 0, bursts: [], rockets: [], waves: [], G: 0, F: 0, flash: 0, tilt: 0, tiltT: 0, ready: 0, fade: 0 };
    const sc = s.sc = Math.max(W / BW, H / BH); s.ox = clamp(W / 2 - PX * sc, W - BW * sc, 0); s.oy = (H - BH * sc) / 2;
    s.dx = s.ox + DISC[0] * sc; s.dy = s.oy + DISC[1] * sc; s.dr = DISC[2] * sc;
    const ts = Math.round(s.dr * 2 * k); s.tmp = cnv(Math.min(ts, 320), Math.min(ts, 320)); s.tx = s.tmp.getContext('2d');
    s.spiral = spiral(small ? 96 : 192); s.glow = dot(48, 'rgba(255,170,90,1)'); s.blue = dot(48, 'rgba(190,215,255,1)');
    s.fish = FISH.map((f, i) => { const a = i / FISH.length * TAU + rnd(-.3, .3), r = rnd(.35, .8); return { f, x: VORT[0] + Math.cos(a) * r, y: VORT[1] + Math.sin(a) * r, sp: rnd(.08, .16), z: i ? 1.75 : 1.35, ph: rnd(0, TAU), hd: a + Math.PI / 2, vx: 0, vy: 0, wf: rnd(.3, .7) }; });
    s.ch = { a: .15, v: 0 };
    s.t0 = small ? 0 : 3.5; s.sp = small ? 3 : 1; s.next = s.t0;
    const go = () => { if (!s.dead) s.ready = 1; }; IMG.bg ? (go(), s.fade = 1) : loadHanabi().then(go);
    if (!small) { s.ori = e => { if (e.gamma != null) s.tiltT = clamp(e.gamma / 40, -1, 1); }; addEventListener('deviceorientation', s.ori); }
    return s;
  },
  stop(s) { s.dead = 1; s.ori && removeEventListener('deviceorientation', s.ori); },
  // 屏幕 ↔ 底图 ↔ 伞面局部
  bg2s(s, x, y) { return [s.ox + x * s.sc, s.oy + y * s.sc]; },
  s2bg(s, x, y) { return [(x - s.ox) / s.sc, (y - s.oy) / s.sc]; },
  loc(s, x, y) { return [(x - s.dx) / s.dr, (y - s.dy) / s.dr]; },
  chPos(s) { const [px, py] = PIVOT, L = .3, a = s.ch.a; return [s.dx + (px + Math.sin(a) * L) * s.dr, s.dy + (py + Math.cos(a) * L) * s.dr]; },
  // 放一朵：先有一道升空的光，到了位置再炸开（炸出来的就是照片里那一片烟花）
  launch(s, bx, by) {
    const [l] = this.s2bg(s, 0, 0), [r] = this.s2bg(s, s.W, 0);
    bx ??= rnd(Math.max(60, l + 40), Math.min(BW - 60, r - 40)); by ??= rnd(90, 700); by = clamp(by, 60, 760);
    s.rockets.push({ x0: bx + rnd(-40, 40), bx, by, t: 0, d: rnd(.8, 1.15) * (s.small ? .6 : 1) });
  },
  burst(s, bx, by) {
    const q = SITES[Math.random() * SITES.length | 0], gold = q[3] < 70, r = q[3] * (gold ? rnd(1.7, 2.3) : rnd(.95, 1.3)) * (s.small ? .8 : 1);
    s.bursts.push({ q, bx, by, r, t: 0, gold }); s.bursts.length > 12 && s.bursts.shift();
    s.flash = Math.min(1.4, s.flash + .6);
  },
  // 节目单：安静几秒 → 一朵一朵 → 越来越密，整片天亮起来，地面焰火升起来 → 之后一直是满天烟花，偶尔再炸几朵
  schedule(s, dt) {
    const T = (s.t - s.t0) * s.sp; if (T < 0) return;
    if (s.t >= s.next) { const fin = T > 11 && T < 19; this.launch(s); fin && Math.random() < .5 && this.launch(s); s.next = s.t + (fin ? rnd(.35, .7) : T < 11 ? rnd(1.1, 1.9) : rnd(1.3, 2.6)) / s.sp; }
    s.G = ss(12, 19, T); s.F = ss(13, 17.5, T);
  },
  input(s, type, x, y) {
    if (type == 'down') {
      s.ptr = { x0: x, y0: y, rt: performance.now(), moved: 0, mode: '' };
      const [cx, cy] = this.chPos(s); if (Math.hypot(cx - x, cy - y) < Math.max(22, s.dr * .14)) { s.ptr.mode = 'ch'; s.ch.v += (x < cx ? 1 : -1) * rnd(2.5, 3.5); navigator.vibrate?.(8); return true; }
      const [a, b] = this.loc(s, x, y); if (Math.hypot(a, b) < 1) { s.ptr.mode = 'umb'; return true; }
      s.ptr.mode = 'sky'; return false;
    }
    const p = s.ptr; if (!p) return false;
    if (type == 'move') { p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0)); return p.mode != 'sky'; }
    s.ptr = null; if (type == 'cancel') return false;
    const quick = performance.now() - p.rt < 400 && p.moved < 12;
    if (p.mode == 'umb') { quick && this.ripple(s, x, y); return true; }
    if (p.mode == 'sky' && quick) { const [bx, by] = this.s2bg(s, x, y); if (by < HZ) { this.launch(s, bx, by); if (s.t < s.t0) { s.t0 = s.t + .8; s.next = s.t + 1.6; } } return false; }
    return p.mode == 'ch';
  },
  ripple(s, x, y) {
    const [a, b] = this.loc(s, x, y); s.waves.push({ x: a, y: b, t: s.t }); s.waves.length > 4 && s.waves.shift(); navigator.vibrate?.(6);
    for (const f of s.fish) { const dx = f.x - a, dy = f.y - b, d = Math.hypot(dx, dy); if (d < .6) { const m = (1 - d / .6) * 1.6 + .3; f.vx += dx / (d || 1) * m; f.vy += dy / (d || 1) * m; } }
    const [px, py] = PIVOT; Math.hypot(px - a, py + .3 - b) < .5 && (s.ch.v += rnd(-1.5, 1.5));
  },
  draw(c, t, dt, W, H, s) {
    s.t = t; const k = s.k, sc = s.sc;
    c.fillStyle = '#04060f'; c.fillRect(0, 0, W, H); if (!s.ready) return;
    s.fade = Math.min(1, s.fade + dt * 3); c.globalAlpha = s.fade;
    this.schedule(s, dt); s.tilt = lerp(s.tilt, s.tiltT, 1 - Math.exp(-dt * 3)); s.flash *= Math.exp(-dt * 2.2);
    const bw = BW * sc, bh = BH * sc, X = s.ox, Y = s.oy, G = s.G, F = s.F, L = clamp(G * .7 + F * .3 + s.flash * .35, 0, 1.3);
    c.drawImage(IMG.bg, X, Y, bw, bh);
    c.globalCompositeOperation = 'lighter';
    // 满天的烟花（照片里的）：慢慢亮起来，亮了以后火星一直往下落、闪
    if (G > .002) {
      const fh = IMG.fw.height * sc; c.globalAlpha = G * .9 * s.fade; c.drawImage(IMG.fw, X, Y, bw, fh);
      const ph = (t * .55) % 1; c.globalAlpha = G * .32 * Math.sin(Math.PI * ph) * s.fade; c.drawImage(IMG.fw, X, Y + ph * 14 * sc, bw, fh);
    }
    // 地面的瀑布焰火：从地面往上长出来，一直往上喷、闪
    if (F > .002) {
      const gy = Y + GY * sc, gh = IMG.gnd.height * sc, top = lerp(Y + bh, gy, F);
      c.save(); c.beginPath(); c.rect(0, top, W, H); c.clip();
      c.globalAlpha = F * (.86 + .14 * Math.sin(t * 17) * Math.sin(t * 5.3)) * s.fade; c.drawImage(IMG.gnd, X, gy, bw, gh);
      const ph = (t * 1.3) % 1; c.globalAlpha = F * .35 * Math.sin(Math.PI * ph) * s.fade; c.drawImage(IMG.gnd, X, gy - ph * 18 * sc, bw, gh);
      c.restore();
    }
    // 升空的光
    for (let i = s.rockets.length - 1; i >= 0; i--) {
      const r = s.rockets[i]; r.t += dt; const u = clamp(r.t / r.d), e = 1 - (1 - u) ** 2.2, bx = lerp(r.x0, r.bx, e), by = lerp(HZ, r.by, e), [x, y] = this.bg2s(s, bx, by), [x1, y1] = this.bg2s(s, lerp(r.x0, r.bx, Math.max(0, e - .12)), lerp(HZ, r.by, Math.max(0, e - .12)));
      const g = c.createLinearGradient(x1, y1, x, y); g.addColorStop(0, 'rgba(255,230,190,0)'); g.addColorStop(1, 'rgba(255,240,215,.85)'); c.globalAlpha = s.fade; c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x, y); c.stroke();
      c.drawImage(s.blue, x - 4, y - 4, 8, 8);
      if (u >= 1) { s.rockets.splice(i, 1); this.burst(s, r.bx, r.by); }
    }
    // 一朵朵炸开：从中心往外胀开、亮一下，然后慢慢往下落、暗下去
    for (let i = s.bursts.length - 1; i >= 0; i--) {
      const b = s.bursts[i]; b.t += dt; const a = b.t; if (a > 3) { s.bursts.splice(i, 1); continue; } const [qx, qy, qn] = b.q, img = IMG.burst;
      const e = 1 - (1 - clamp(a / .55)) ** 3, z = (.12 + .88 * e) * (1 + a * .05), al = (a < .55 ? .4 + .6 * e : 1) * (1 - ss(1, 3, a)) * (a > 1.5 && Math.random() < .25 ? .7 : 1);
      const [x, y] = this.bg2s(s, b.bx, b.by + a * a * 10), R = b.r * sc * z;
      if (a < .55) for (const [f, q] of [[.86, .45], [.72, .22]]) { c.globalAlpha = al * q * s.fade; c.drawImage(img, qx, qy, qn, qn, x - R * f, y - R * f, R * f * 2, R * f * 2); } // 往外飞的拖影
      c.globalAlpha = Math.min(1, al * 1.2) * s.fade; c.drawImage(img, qx, qy, qn, qn, x - R, y - R, R * 2, R * 2);
      a < 1.4 && (c.globalAlpha = al * .55 * (1 - a / 1.4) * s.fade, c.drawImage(img, qx, qy, qn, qn, x - R, y - R, R * 2, R * 2)); // 刚炸开的时候更亮
      if (a < .35) { const q = (1 - a / .35) ** 2, rr = b.r * sc * .5; c.globalAlpha = q * .7 * s.fade; c.drawImage(s.blue, x - rr, y - rr, rr * 2, rr * 2); }
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = s.fade;
    this.umbrella(c, s, dt, t, L);
    c.globalAlpha = 1;
  },
  umbrella(c, s, dt, t, L) {
    const { dx, dy, dr, k } = s, x0 = dx - dr, y0 = dy - dr, d2 = dr * 2, fa = s.fade;
    c.save(); c.beginPath(); c.arc(dx, dy, dr, 0, TAU); c.clip();
    c.globalCompositeOperation = 'multiply'; c.drawImage(IMG.umb, x0, y0, d2, d2);
    c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(.82 + .25 * L) * fa; c.drawImage(IMG.water, x0, y0, d2, d2);
    // 水在流：光沿着漩涡一圈圈流过去
    const tx = s.tx, z = s.tmp.width; tx.globalCompositeOperation = 'copy'; tx.drawImage(IMG.water, 0, 0, z, z); tx.globalCompositeOperation = 'destination-in';
    for (const [w, al] of [[.42, 1], [-.27, .6]]) { tx.save(); tx.translate((.5 + VORT[0] / 2) * z, (.5 + VORT[1] / 2) * z); tx.rotate(t * w); tx.globalAlpha = al; tx.drawImage(s.spiral, -z * .55, -z * .55, z * 1.1, z * 1.1); tx.restore(); }
    tx.globalAlpha = 1; c.globalAlpha = (.55 + .3 * L) * fa; c.drawImage(s.tmp, x0, y0, d2, d2);
    // 点出来的水波
    for (let i = s.waves.length - 1; i >= 0; i--) { const w = s.waves[i], a = t - w.t; if (a > 1.8) { s.waves.splice(i, 1); continue; } const r = a * .7, al = (1 - a / 1.8) ** 1.5 * .7; c.strokeStyle = '#eaf4ff'; for (let j = 0; j < 3; j++) { const rj = r - j * .065; if (rj <= 0) continue; c.globalAlpha = al * (1 - j * .3) * fa; c.lineWidth = Math.max(.8, (3 - j) * dr * .006); c.beginPath(); c.arc(dx + w.x * dr, dy + w.y * dr, rj * dr, 0, TAU); c.stroke(); } }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = fa;
    this.swim(c, s, dt, t);
    c.restore();
    // 伞边：一圈淡淡的蓝边和高光
    c.globalCompositeOperation = 'screen'; c.globalAlpha = (.55 + .25 * L) * fa; c.strokeStyle = 'rgb(150,195,245)'; c.lineWidth = Math.max(1.2, dr * .012); c.beginPath(); c.arc(dx, dy, dr - c.lineWidth / 2, 0, TAU); c.stroke();
    c.globalAlpha = (.35 + .3 * L) * fa; c.strokeStyle = 'rgb(235,245,255)'; c.lineWidth = Math.max(1, dr * .008); c.beginPath(); c.arc(dx, dy, dr * .985, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = fa;
    this.charm(c, s, dt, t);
  },
  // 金鱼：跟着水流顺时针游，尾巴摆（把贴图切成几条竖条，越往尾巴摆得越多）
  swim(c, s, dt, t) {
    const { dx, dy, dr } = s, img = IMG.fish, u = dr / 510;
    for (const f of s.fish) {
      const ox = f.x - VORT[0], oy = f.y - VORT[1], r = Math.hypot(ox, oy) || .01, tx = -oy / r, ty = ox / r, flow = (.12 + .2 * (1 - r)) * r;
      let vx = tx * (f.sp + flow) + f.vx, vy = ty * (f.sp + flow) + f.vy;
      vx += Math.sin(t * f.wf + f.ph) * .04 * -ty; vy += Math.sin(t * f.wf + f.ph) * .04 * tx;
      if (r > .8) { vx -= ox / r * (r - .8) * 3; vy -= oy / r * (r - .8) * 3; } if (r < .28) { vx += ox / r * (.28 - r) * 3; vy += oy / r * (.28 - r) * 3; }
      f.x += vx * dt; f.y += vy * dt; const ex = Math.exp(-dt * 1.8); f.vx *= ex; f.vy *= ex;
      const sp = Math.hypot(vx, vy); f.hd += angD(f.hd, Math.atan2(vy, vx)) * (1 - Math.exp(-dt * 4)); f.ph += dt * (3.5 + sp * 12);
      const [sx, sy, sw, sh] = f.f, w = sw * u * f.z, h = sh * u * f.z;
      c.save(); c.translate(dx + f.x * dr, dy + f.y * dr); c.rotate(f.hd);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .35 * s.fade; c.drawImage(s.glow, -w * .8, -h * 1.3, w * 1.6, h * 2.6); c.globalCompositeOperation = 'source-over'; c.globalAlpha = s.fade;
      const N = 6, st = sw / N; for (let i = 0; i < N; i++) { const q = 1 - i / N, off = Math.sin(f.ph - i * .9) * h * .16 * q * q; c.drawImage(img, sx + i * st, sy, st + .6, sh, -w / 2 + i * w / N, -h / 2 + off, w / N + .6, h); }
      c.restore();
    }
  },
  // 挂件：挂在伞骨上的小金鱼（绳子 + 三颗珠子），会晃
  charm(c, s, dt, t) {
    const h = s.ch, g = 9, L = .3; h.v += (-g / L * Math.sin(h.a) - s.tilt * 6 * Math.cos(h.a)) * dt; h.v *= Math.exp(-dt * .9); h.v += Math.sin(t * .7) * .25 * dt; h.a += h.v * dt;
    const { dx, dy, dr } = s, px = dx + PIVOT[0] * dr, py = dy + PIVOT[1] * dr, [ex, ey] = this.chPos(s), lw = Math.max(.7, dr * .004);
    c.strokeStyle = 'rgba(235,242,255,.8)'; c.lineWidth = lw; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke();
    c.fillStyle = 'rgba(240,246,255,.92)'; for (const q of [.62, .74, .86]) { c.beginPath(); c.arc(lerp(px, ex, q), lerp(py, ey, q), Math.max(1.2, dr * .014), 0, TAU); c.fill(); }
    const [sx, sy, sw, sh] = CHARM, u = dr / 510 * 1.7, w = sw * u, hh = sh * u;
    c.save(); c.translate(ex, ey); c.rotate(-h.a); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .2 * s.fade; c.drawImage(s.glow, -hh, 0, hh * 2, w * 1.2); c.globalCompositeOperation = 'source-over'; c.globalAlpha = s.fade;
    c.rotate(-Math.PI / 2); c.drawImage(IMG.fish, sx, sy, sw, sh, -w, -hh / 2, w, hh); c.restore();
  },
};
