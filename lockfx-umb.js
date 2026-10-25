// 小手机 · 动态锁屏「伞下烟火」：黄昏的海边，一个人背对着镜头，把透明金鱼伞往后撑在肩上（挡住头和上半身），看海上的烟花。
// 素材都是照片抠出来的：海边黄昏（底图）、透明金鱼伞（伞面 + 6 条金鱼）、人的背影；烟花是五颜六色的粒子，倒映在海面上。
// 节奏：一开始没有烟花 → 忽然放了一个 → 又一个 → 接着很多一起放，之后一直放，隔一阵来一波高潮。
// 动效：光沿着伞面的水纹流动；金鱼在伞面上游；烟花亮的时候天、海、伞都被照亮。
// 互动：点天空 → 那里放一朵；点伞 → 水波荡开、金鱼吓得游开、伞晃一下；歪手机伞也会跟着轻轻晃。
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const cnv = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const dot = (r, col, core = 0) => { const c = cnv(r * 2, r * 2), x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r); core && g.addColorStop(0, rgba('#ffffff', 1)); g.addColorStop(core, rgba(col, 1)); g.addColorStop(Math.min(1, core + .3), rgba(col, .45)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; };
const angD = (a, b) => { let d = (b - a) % TAU; d > Math.PI && (d -= TAU); d < -Math.PI && (d += TAU); return d; };

// 底图（1000×1622）：地平线 y=1050；人（300×605）；伞（625×640，伞尖在 388,226）；金鱼贴图（鱼头朝右）
const SEA = [1000, 1622, 1050], PER = [300, 605], UMB = [625, 640], TIP = [388, 226];
const FISH = [[0, 0, 67, 36], [71, 0, 65, 24], [140, 0, 57, 42], [201, 0, 74, 40], [279, 0, 77, 41], [360, 0, 74, 30]];
const FILES = { sea: 'hanabi_sea.webp', person: 'hanabi_person.webp', umb: 'hanabi_umb.webp', water: 'hanabi_water.webp', fish: 'hanabi_fish.webp' };
const IMG = {}; let imgP;
export const loadHanabi = () => imgP ||= Promise.all(Object.entries(FILES).map(([k, f]) => new Promise(res => { const i = new Image(); i.decoding = 'async'; const done = () => { IMG[k] = i; res(); }; i.onload = () => (i.decode ? i.decode().then(done, done) : done()); i.onerror = () => res(); i.src = new URL('./assets/' + f, import.meta.url).href; })));

// 烟花颜色（五颜六色）
const COL = { red: '#ff3d5e', orange: '#ff9442', gold: '#ffd66b', lime: '#b4ff6b', green: '#4dffa0', cyan: '#5ff3ff', blue: '#6a8dff', purple: '#b776ff', pink: '#ff74d4', white: '#fff7ea' };
const PAIRS = [['red', 'gold'], ['cyan', 'white'], ['purple', 'pink'], ['green', 'gold'], ['blue', 'cyan'], ['pink', 'white'], ['orange', 'gold'], ['lime', 'cyan'], ['red', 'white'], ['purple', 'blue'], ['gold', 'red'], ['white', 'cyan']];
const KINDS = ['peony', 'peony', 'chrys', 'willow', 'ring', 'multi', 'split', 'glitter', 'peony', 'chrys', 'multi', 'heart', 'palm'];
const CAP = 1600;

// 沿伞面水纹流动的光带
function spiral(sz) {
  const c = cnv(sz, sz), x = c.getContext('2d'), d = x.createImageData(sz, sz), h = sz / 2;
  for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) {
    const dx = (i - h) / h, dy = (j - h) / h, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), v = (.5 + .5 * Math.cos(2 * a + 7 * Math.log(r + .05))) ** 5 * ss(.02, .15, r), o = (j * sz + i) * 4;
    d.data[o] = d.data[o + 1] = d.data[o + 2] = 255; d.data[o + 3] = v * 255;
  }
  x.putImageData(d, 0, 0); return c;
}

export const hanabi = {
  ink: '#ffffff', shade: 'rgba(20,10,60,.45)', dpr: 2, fps: 60, interactive: true, hint: '点天空放烟花 · 点伞拨水',
  init(W, H, dpr) {
    const small = W < 200, k = dpr, s = { W, H, k, small, t: 0, P: [], rk: [], lights: [], smoke: [], waves: [], wob: 0, wv: 0, tilt: 0, tiltT: 0, ready: 0, fade: 0, plan: [] };
    s.u = Math.min(W / 390, H / 844);
    // 底图铺满（以中间为准）
    const sc = s.sc = Math.max(W / SEA[0], H / SEA[1]); s.ox = (W - SEA[0] * sc) / 2; s.oy = (H - SEA[1] * sc) / 2; s.hz = s.oy + SEA[2] * sc;
    // 人：底边超出屏幕一点
    const ps = s.ps = Math.min(W * .56 / PER[0], H * .5 / PER[1]); s.pw = PER[0] * ps; s.ph = PER[1] * ps; s.px = W / 2 - s.pw * .46; s.py = H + 8 * s.u - s.ph;
    // 伞：盖住头和肩膀，往后歪一点
    const us = s.us = Math.min(W * .84 / UMB[0], H * .4 / UMB[1]); s.uw = UMB[0] * us; s.uh = UMB[1] * us;
    s.ucx = W / 2 + s.uw * .02; s.ucy = s.py + s.ph * .26; s.urot = -.1; s.piv = [W / 2, s.py + s.ph * .42]; // 手握着的地方（晃的时候绕这里转）
    // 粒子贴图
    s.hd = Object.fromEntries(Object.entries(COL).map(([n, c]) => [n, dot(10, c, n == 'white' ? .2 : .06)])); s.gl = Object.fromEntries(Object.entries(COL).map(([n, c]) => [n, dot(48, c)]));
    s.smk = dot(48, '#9aa6d6'); s.fglow = dot(32, '#ffa050');
    // 拖尾层（半分辨率）：快散 / 慢散（柳叶、金色棕榈）
    s.tr = [cnv(W * k * .5, H * k * .5), cnv(W * k * .5, H * k * .5)]; s.trx = s.tr.map(c => { const x = c.getContext('2d'); x.setTransform(k * .5, 0, 0, k * .5, 0, 0); return x; });
    s.tmp = cnv(Math.min(Math.round(s.uw * k), 700), Math.min(Math.round(s.uh * k), 700)); s.tx = s.tmp.getContext('2d'); s.spiral = spiral(small ? 96 : 200);
    s.fish = FISH.map((f, i) => { const a = i / FISH.length * TAU + rnd(-.3, .3), r = rnd(.3, .7); return { f, x: Math.cos(a) * r, y: Math.sin(a) * r, sp: rnd(.12, .22) * (Math.random() < .3 ? -1 : 1), ph: rnd(0, TAU), hd: 0, vx: 0, vy: 0, z: rnd(1.02, 1.18), wf: rnd(.3, .7) }; });
    // 节目单：一开始安静 → 忽然一个 → 又一个 → 一下子很多 → 之后一直放
    const t0 = s.t0 = small ? .2 : 2.4, sp = small ? .5 : 1;
    s.plan = [[t0, 1], [t0 + 2.6 * sp, 1], [t0 + 4.6 * sp, 4], [t0 + 5.2 * sp, 2]]; s.next = t0 + 6.2 * sp; s.wave = t0 + 14;
    const go = () => { if (!s.dead) s.ready = 1; }; IMG.sea ? (go(), s.fade = 1) : loadHanabi().then(go);
    if (!small) { s.ori = e => { if (e.gamma != null) s.tiltT = clamp(e.gamma / 40, -1, 1); }; addEventListener('deviceorientation', s.ori); }
    return s;
  },
  stop(s) { s.dead = 1; s.ori && removeEventListener('deviceorientation', s.ori); },
  // 伞的变换：伞贴图坐标 → 屏幕
  umbM(s) { const a = s.urot + s.wob + s.tilt * .04, [px, py] = s.piv; return new DOMMatrix().translate(px, py).rotate(a * 180 / Math.PI).translate(-px, -py).translate(s.ucx, s.ucy).scale(s.us).translate(-UMB[0] / 2, -UMB[1] / 2); },
  onUmb(s, x, y) { const p = this.umbM(s).inverse().transformPoint(new DOMPoint(x, y)), dx = (p.x - UMB[0] / 2) / (UMB[0] * .47), dy = (p.y - UMB[1] / 2) / (UMB[1] * .47); return dx * dx + dy * dy < 1 ? [p.x, p.y] : null; },
  launch(s, x, y, kind) {
    const W = s.W, H = s.H; x ??= rnd(W * .12, W * .88); y ??= rnd(H * .25, H * .44); s.nl = (s.nl || 0) + 1; y = clamp(y, H * .06, s.hz - H * .14);
    s.rk.push({ x0: clamp(x + rnd(-W * .08, W * .08), 0, W), x, y, t: 0, d: rnd(1, 1.4) * (s.small ? .6 : 1), kind: kind || KINDS[Math.random() * KINDS.length | 0], c: PAIRS[Math.random() * PAIRS.length | 0] });
  },
  burst(s, x, y, kind, c) {
    const sm = s.small, sz = s.W * rnd(.2, .3) * (sm ? .75 : 1) * (kind == 'willow' ? 1.15 : kind == 'heart' ? .85 : 1), P = s.P, add = o => P.length < CAP && P.push(o);
    const n = Math.round((sm ? .35 : 1) * { peony: 130, chrys: 120, willow: 80, ring: 70, multi: 140, split: 54, glitter: 110, heart: 80, palm: 16 }[kind]);
    const base = { x, y, t: 0, g: s.H * .06, dr: 1.7, c: c[0], c2: c[1], z: rnd(1.6, 2.3) * s.u };
    const tilt = rnd(.35, 1), rot = rnd(0, TAU);
    for (let i = 0; i < n; i++) {
      let vx, vy;
      if (kind == 'ring') { const a = i / n * TAU; vx = Math.cos(a); vy = Math.sin(a) * tilt; [vx, vy] = [vx * Math.cos(rot) - vy * Math.sin(rot), vx * Math.sin(rot) + vy * Math.cos(rot)]; }
      else if (kind == 'heart') { const a = i / n * TAU; vx = 16 * Math.sin(a) ** 3 / 17; vy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17; }
      else { const u = rnd(-1, 1), a = rnd(0, TAU), q = Math.sqrt(1 - u * u); vx = q * Math.cos(a); vy = q * Math.sin(a); const m = kind == 'palm' ? rnd(.8, 1) : rnd(.9, 1.02); vx *= m; vy *= m; }
      const v = sz * (kind == 'willow' ? 2.1 : kind == 'heart' ? 1.5 : 1.75);
      const o = { ...base, vx: vx * v, vy: vy * v, k: kind, d: rnd(1.5, 2.2) };
      if (kind == 'multi') o.c = o.c2 = PAIRS[i % PAIRS.length][0];
      if (kind == 'willow') Object.assign(o, { d: rnd(3, 4), dr: 2.3, g: s.H * .04, c: 'gold', c2: 'orange', slow: 1 });
      if (kind == 'palm') Object.assign(o, { d: rnd(2.2, 2.8), dr: 1.2, c: 'gold', c2: 'white', slow: 1, z: o.z * 1.8 });
      if (kind == 'chrys') Object.assign(o, { slow: 1, d: rnd(1.8, 2.4) });
      if (kind == 'heart') Object.assign(o, { d: rnd(1.8, 2.2), dr: 1.5, g: s.H * .02, c: 'pink', c2: 'red' });
      if (kind == 'glitter') Object.assign(o, { c: 'white', c2: c[0] });
      add(o);
    }
    s.nb = (s.nb || 0) + 1;
    s.lights.push({ x, y, c: c[0], I: 1, r: sz * 2.6 }); s.lights.length > 8 && s.lights.shift();
    if (!sm) for (let i = 0; i < 2; i++) s.smoke.length < 24 && s.smoke.push({ x: x + rnd(-sz, sz) * .5, y: y + rnd(-sz, sz) * .4, r: sz * rnd(.6, 1), vx: rnd(-5, 5) * s.u, t: 0, d: rnd(8, 12) });
  },
  // 发射排队（按场景自己的时间走，测试快进也准）
  queue(s, n, gap, kind) { for (let i = 0; i < n; i++) s.q.push([s.t + i * gap, kind && i % 3 == 2 ? kind : undefined]); },
  schedule(s) {
    s.q ||= [];
    while (s.plan.length && s.t >= s.plan[0][0]) { const [, n] = s.plan.shift(); this.queue(s, n, .14); }
    if (s.t >= s.next && !s.plan.length) {
      const big = s.t >= s.wave; if (big) s.wave = s.t + rnd(12, 16);
      this.queue(s, big ? (s.small ? 3 : 7) : Math.random() < .35 ? 2 : 1, big ? .16 : .26, big && 'willow');
      s.next = s.t + (big ? 2.2 : rnd(.7, 1.5)) * (s.small ? .6 : 1);
    }
    for (let i = s.q.length - 1; i >= 0; i--) if (s.t >= s.q[i][0]) { this.launch(s, undefined, undefined, s.q[i][1]); s.q.splice(i, 1); }
  },
  input(s, type, x, y) {
    if (type == 'down') { s.ptr = { x0: x, y0: y, rt: performance.now(), moved: 0, mode: this.onUmb(s, x, y) ? 'umb' : 'sky' }; return s.ptr.mode == 'umb'; }
    const p = s.ptr; if (!p) return false;
    if (type == 'move') { p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0)); return p.mode == 'umb'; }
    s.ptr = null; if (type == 'cancel') return false;
    const quick = performance.now() - p.rt < 400 && p.moved < 12;
    if (p.mode == 'umb') { quick && this.ripple(s, x, y); return true; }
    if (quick && y < s.hz - s.H * .03) { this.launch(s, x, y); if (s.plan.length) { const d = s.plan[0][0] - s.t - 1.2; s.plan.forEach(q => q[0] -= d); s.next -= d; } }
    return false;
  },
  ripple(s, x, y) {
    const q = this.onUmb(s, x, y); if (!q) return; s.waves.push({ x: q[0], y: q[1], t: s.t }); s.waves.length > 4 && s.waves.shift(); navigator.vibrate?.(8);
    s.wv += (x < s.piv[0] ? -1 : 1) * .55; s.kick = s.t; // 伞晃一下
    const lx = (q[0] - UMB[0] / 2) / (UMB[0] * .4), ly = (q[1] - UMB[1] / 2 - 10) / (UMB[0] * .4 * .92);
    for (const f of s.fish) { const dx = f.x - lx, dy = f.y - ly, d = Math.hypot(dx, dy); if (d < .6) { const m = (1 - d / .6) * 1.6 + .3; f.vx += dx / (d || 1) * m; f.vy += dy / (d || 1) * m; } }
  },
  draw(c, t, dt, W, H, s) {
    s.t = t;
    c.fillStyle = '#1a2a6a'; c.fillRect(0, 0, W, H); if (!s.ready) return;
    s.fade = Math.min(1, s.fade + dt * 3); const fa = s.fade;
    this.schedule(s); s.tilt = lerp(s.tilt, s.tiltT, 1 - Math.exp(-dt * 3));
    s.wv += (-s.wob * 26 - s.wv * 3.2) * dt; s.wob += s.wv * dt; // 伞晃完慢慢停
    let L = 0; for (const l of s.lights) { l.I *= Math.exp(-dt * 2.4); L += l.I; } L = Math.min(1.2, L * .6);
    for (let i = s.lights.length - 1; i >= 0; i--) s.lights[i].I < .02 && s.lights.splice(i, 1);
    c.globalAlpha = fa; c.drawImage(IMG.sea, s.ox, s.oy, SEA[0] * s.sc, SEA[1] * s.sc);
    // 天空和海面被烟花照亮
    c.globalCompositeOperation = 'lighter';
    for (const l of s.lights) { c.globalAlpha = .28 * l.I * fa; c.drawImage(s.gl[l.c], l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); const rr = l.r * 1.3; c.globalAlpha = .12 * l.I * fa; c.drawImage(s.gl[l.c], l.x - rr, s.hz + (s.hz - l.y) * .3 - rr * .3, rr * 2, rr * .6); }
    for (let i = s.smoke.length - 1; i >= 0; i--) { const m = s.smoke[i]; m.t += dt; m.x += m.vx * dt; m.y -= 3 * dt; m.r += dt * 2; if (m.t > m.d) { s.smoke.splice(i, 1); continue; } c.globalAlpha = Math.sin(Math.PI * m.t / m.d) * (.04 + .1 * L) * fa; c.drawImage(s.smk, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); }
    this.fire(c, dt, s, fa);
    this.reflect(c, s, t, fa);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = fa;
    // 人
    c.drawImage(IMG.person, s.px, s.py, s.pw, s.ph);
    if (L > .02) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .25 * L * fa; c.drawImage(IMG.person, s.px, s.py, s.pw, s.ph); c.globalCompositeOperation = 'source-over'; c.globalAlpha = fa; }
    this.umbrella(c, s, dt, t, L, fa);
    c.globalAlpha = 1;
  },
  fire(c, dt, s, fa) {
    const [ta, tb] = s.trx, k = s.k, W = s.W, H = s.H;
    const fade = (x, r) => { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.fillStyle = `rgba(0,0,0,${1 - Math.pow(1 - r, dt * 60)})`; x.fillRect(0, 0, W * k, H * k); x.restore(); };
    fade(ta, .17); fade(tb, .055); ta.globalCompositeOperation = tb.globalCompositeOperation = 'lighter';
    c.globalCompositeOperation = 'lighter';
    // 升空：一道带火星的光
    for (let i = s.rk.length - 1; i >= 0; i--) {
      const r = s.rk[i]; r.t += dt; const u = clamp(r.t / r.d), e = 1 - (1 - u) ** 2.3, x = lerp(r.x0, r.x, e) + Math.sin(r.t * 11) * .8, y = lerp(s.hz, r.y, e);
      ta.globalAlpha = .9; ta.drawImage(s.hd.gold, x - 2.5, y - 2.5, 5, 5); Math.random() < .5 && (tb.globalAlpha = .5, tb.drawImage(s.hd.orange, x + rnd(-2, 2) - 1.5, y + rnd(0, 6) - 1.5, 3, 3));
      c.globalAlpha = fa; c.drawImage(s.hd.white, x - 2.5, y - 2.5, 5, 5);
      if (u >= 1) { s.rk.splice(i, 1); this.burst(s, r.x, r.y, r.kind, r.c); }
    }
    const P = s.P, hs = s.hs ||= []; hs.length = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.t += dt; const u = p.t / p.d; if (u >= 1) { P.splice(i, 1); continue; }
      const f = Math.exp(-p.dr * dt); p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k == 'split' && !p.sp && u > .45) { p.sp = 1; for (let j = 0; j < 4; j++) { const a = j / 4 * TAU + rnd(0, .4), v = s.W * .12; P.length < CAP && P.push({ ...p, vx: p.vx * .3 + Math.cos(a) * v, vy: p.vy * .3 + Math.sin(a) * v, t: 0, d: rnd(.7, 1), k: 'spk', c: p.c2, sp: 1 }); } P.splice(i, 1); continue; }
      let a = (1 - u) ** 1.3; u < .05 && (a *= 1.6);
      if ((p.k == 'glitter' || p.k == 'willow') && u > .5) a *= Math.random() < .5 ? 1.5 : .15;
      if (u > .78 && p.k != 'willow') a *= Math.random() < .3 ? .2 : 1; // 快灭的时候闪一闪
      const col = u > .55 ? p.c2 : p.c, z = p.z * (1 - u * .35), sp = s.hd[col], tr = p.slow ? tb : ta;
      tr.globalAlpha = Math.min(1, a * .8); tr.drawImage(sp, p.x - z, p.y - z, z * 2, z * 2);
      if (i % 2 == 0 && u < .7) { const g = z * 5.5; c.globalAlpha = a * .18 * fa; c.drawImage(s.gl[col], p.x - g, p.y - g, g * 2, g * 2); } // 柔光（加亮）
      hs.push(p, z, a, col); // 火星本身用原色画（亮的天空上颜色不会被冲淡）
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = .92 * fa; c.drawImage(s.tr[1], 0, 0, W, H); c.drawImage(s.tr[0], 0, 0, W, H);
    for (let i = 0; i < hs.length; i += 4) { const p = hs[i], z = hs[i + 1] * 1.25; c.globalAlpha = Math.min(1, hs[i + 2]) * fa; c.drawImage(s.hd[hs[i + 3]], p.x - z, p.y - z, z * 2, z * 2); }
    c.globalCompositeOperation = 'lighter';
  },
  // 海面倒影：烟花倒过来、压扁、一条条晃
  reflect(c, s, t, fa) {
    const W = s.W, H = s.H, hz = s.hz, k = s.k * .5, bot = Math.min(H, hz + H * .2), step = Math.max(3, 4 * s.u);
    for (let y = hz; y < bot; y += step) {
      const d = (y - hz) / (bot - hz), sy = hz - (y - hz) / .42; if (sy < 0) break;
      const off = Math.sin(y * .35 + t * 2.2) * (2 + d * 6) * s.u;
      c.globalAlpha = .42 * (1 - d) ** 1.2 * fa;
      for (const tr of s.tr) c.drawImage(tr, 0, sy * k, W * k, step / .42 * k, off, y, W, step);
    }
  },
  umbrella(c, s, dt, t, L, fa) {
    const M = this.umbM(s), [UW, UH] = UMB, base = c.getTransform();
    c.save(); c.setTransform(base.multiply(M));
    c.drawImage(IMG.umb, 0, 0, UW, UH);
    if (L > .02) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .35 * L * fa; c.drawImage(IMG.umb, 0, 0, UW, UH); }
    // 水在流：光沿着水纹一圈圈流过去
    const tx = s.tx, zw = s.tmp.width, zh = s.tmp.height; tx.globalCompositeOperation = 'copy'; tx.globalAlpha = 1; tx.drawImage(IMG.water, 0, 0, zw, zh); tx.globalCompositeOperation = 'destination-in';
    for (const [w, al] of [[.45, 1], [-.28, .55]]) { tx.save(); tx.translate(TIP[0] / UW * zw, TIP[1] / UH * zh); tx.rotate(t * w); tx.globalAlpha = al; const R = Math.max(zw, zh) * 1.25; tx.drawImage(s.spiral, -R, -R, R * 2, R * 2); tx.restore(); }
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = (.38 + .3 * L) * fa; c.drawImage(s.tmp, 0, 0, UW, UH);
    // 点出来的水波（只画在伞上）
    if (s.waves.length) {
      tx.globalCompositeOperation = 'source-over'; tx.globalAlpha = 1; tx.clearRect(0, 0, zw, zh); tx.save(); tx.scale(zw / UW, zh / UH); tx.strokeStyle = '#eaf6ff';
      for (let i = s.waves.length - 1; i >= 0; i--) { const w = s.waves[i], a = t - w.t; if (a > 1.8) { s.waves.splice(i, 1); continue; } const r = a * 200, al = (1 - a / 1.8) ** 1.5 * .8; for (let j = 0; j < 3; j++) { const rj = r - j * 22; if (rj <= 0) continue; tx.globalAlpha = al * (1 - j * .3); tx.lineWidth = 5 - j * 1.3; tx.beginPath(); tx.ellipse(w.x, w.y, rj, rj * .85, 0, 0, TAU); tx.stroke(); } }
      tx.restore(); tx.globalAlpha = 1; tx.globalCompositeOperation = 'destination-in'; tx.drawImage(IMG.umb, 0, 0, zw, zh); c.globalAlpha = .7 * fa; c.drawImage(s.tmp, 0, 0, UW, UH);
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = fa;
    this.swim(c, s, dt, t);
    c.restore();
  },
  // 金鱼：在伞面上绕着游，尾巴摆（贴图切成竖条，越往尾巴摆得越多）
  swim(c, s, dt, t) {
    const [UW, UH] = UMB, img = IMG.fish, cx = UW / 2, cy = UH / 2 + 10, R = UW * .4;
    for (const f of s.fish) {
      const r = Math.hypot(f.x, f.y) || .01, dir = Math.sign(f.sp), tx = -f.y / r * dir, ty = f.x / r * dir, v = Math.abs(f.sp);
      let vx = tx * v + f.vx, vy = ty * v + f.vy; vx += Math.sin(t * f.wf + f.ph) * .05 * -ty; vy += Math.sin(t * f.wf + f.ph) * .05 * tx;
      if (r > .78) { vx -= f.x / r * (r - .78) * 3; vy -= f.y / r * (r - .78) * 3; } if (r < .22) { vx += f.x / r * (.22 - r) * 3; vy += f.y / r * (.22 - r) * 3; }
      f.x += vx * dt; f.y += vy * dt; const ex = Math.exp(-dt * 1.8); f.vx *= ex; f.vy *= ex;
      const sp = Math.hypot(vx, vy); f.hd += angD(f.hd, Math.atan2(vy, vx)) * (1 - Math.exp(-dt * 4)); f.ph += dt * (3.5 + sp * 12);
      const [sx, sy, sw, sh] = f.f, w = sw * f.z, h = sh * f.z;
      c.save(); c.translate(cx + f.x * R, cy + f.y * R * .92); c.rotate(f.hd);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .3 * s.fade; c.drawImage(s.fglow, -w * .8, -h * 1.3, w * 1.6, h * 2.6); c.globalCompositeOperation = 'source-over'; c.globalAlpha = s.fade;
      const N = 6, st = sw / N; for (let i = 0; i < N; i++) { const q = 1 - i / N, off = Math.sin(f.ph - i * .9) * h * .14 * q * q; c.drawImage(img, sx + i * st, sy, st + .6, sh, -w / 2 + i * w / N, -h / 2 + off, w / N + .6, h); }
      c.restore();
    }
  },
};
