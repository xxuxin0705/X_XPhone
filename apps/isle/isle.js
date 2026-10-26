// 小手机 · 心屿：每个角色一座装在果冻球里的小岛，岛上的天气就是 TA 此刻的心情
// 晴天 = 开心，细雨 = 难过，风暴 = 生气，极光 = 想念 / 温柔，星夜 = 疲惫，雾 = 迷茫，烟花 = 兴奋，落日 = 平静
// 心情来源：① 点「看看 TA 现在」调一次 API 读最近剧情；② 开了「跟着剧情变」后，AI 在 <手机> 块里写「心情|谁|心情|一句话」
// D().isle = { cur: 角色id, by: { id: { mood, scene, say, sea, ts, hist: [...] } } }；S.isle = { jelly: 果冻颜色, auto }
import { S, D, $, esc, save, saveD, on, emit, page, menu, toast, reg, top, llm, json, sysCtx, task, now, nm, rn, byId, avOf, syncInject, C } from '../../core.js';

export const SCENES = { sun: '晴', sunset: '落日', rain: '细雨', storm: '风暴', aurora: '极光', night: '星夜', fog: '薄雾', fireworks: '烟花' };
const MOOD2 = [[/开心|高兴|快乐|愉快|满足|轻松/, 'sun'], [/兴奋|激动|期待|雀跃|狂喜/, 'fireworks'], [/平静|安心|放松|惬意|温暖|幸福/, 'sunset'], [/难过|伤心|委屈|失落|低落|孤独|想哭/, 'rain'], [/生气|愤怒|烦躁|恼火|不爽|暴躁/, 'storm'], [/想念|思念|温柔|心动|眷恋|喜欢/, 'aurora'], [/累|疲惫|困|倦|无力/, 'night'], [/迷茫|焦虑|不安|纠结|犹豫|茫然/, 'fog']];
export const sceneOf = mood => MOOD2.find(([r]) => r.test(mood || ''))?.[1] || 'sunset';
export const JELLY = [['mint', '薄荷', [120, 230, 210]], ['lemon', '柠檬', [200, 235, 110]], ['peach', '蜜桃', [250, 150, 150]], ['grape', '葡萄', [150, 150, 250]]];
const ISL = () => (D().isle ||= { by: {} });
const people = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0);
const curId = () => { const i = ISL(), ps = people(); return ps.some(c => c.id == i.cur) ? i.cur : ps[0]?.id || ''; };
const rec = id => (ISL().by[id] ||= { mood: '', scene: '', say: '', sea: .4, ts: 0, hist: [] });
const setMood = (id, m) => { const r = rec(id); if (!m.mood) return; Object.assign(r, { mood: m.mood, scene: SCENES[m.scene] ? m.scene : sceneOf(m.mood), say: m.say || '', sea: Math.max(0, Math.min(1, +m.sea || .4)), ts: now() }); r.hist.unshift({ mood: r.mood, scene: r.scene, say: r.say, ts: r.ts }); r.hist.length > 60 && (r.hist.length = 60); saveD(); emit('isle'); };

/* ---------- 画果冻球 ---------- */
const TAU = Math.PI * 2, rnd = (i, s = 1) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5; return x - Math.floor(x); };
const SKY = { sun: ['#8fd3ff', '#e7f6ff'], sunset: ['#f9a37a', '#ffe1b4'], rain: ['#7c8ea3', '#b8c4d0'], storm: ['#2d3545', '#5a6478'], aurora: ['#07122b', '#17325a'], night: ['#0b1230', '#2a3566'], fog: ['#bfc8cf', '#e8ecef'], fireworks: ['#141633', '#2b2d5e'] };
const SEA = { sun: ['#2fa7c9', '#6fd3e6'], sunset: ['#d46a7b', '#f3b48f'], rain: ['#4f6b85', '#8aa0b4'], storm: ['#1f2b3d', '#3d4e66'], aurora: ['#0b2a4a', '#1f5f7a'], night: ['#0d1f44', '#24407a'], fog: ['#8fa3b0', '#b9c7cf'], fireworks: ['#141e4d', '#2a3a7d'] };
const DARK = s => ['storm', 'aurora', 'night', 'fireworks'].includes(s);
function painter(cv, getState) {
  const x = cv.getContext('2d'); let W, H, R, t0 = performance.now(), raf, sq = { x: 1, y: 1, vx: 0, vy: 0 }, rot = 0, vrot = 0, drops = [], sparks = [], bolt = 0, whale = 0;
  const size = () => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; x.setTransform(d, 0, 0, d, 0, 0); W = r.width; H = r.height; R = Math.min(W, H) * .42; };
  size(); const ro = typeof ResizeObserver == 'function' ? new ResizeObserver(size) : null; ro?.observe(cv);
  const px = (a, rx) => Math.cos(a + rot) * rx, pz = a => Math.sin(a + rot); // 假 3D：绕岛一圈的东西按角度算位置和前后
  const tree = (cx, cy, s, lean) => { x.save(); x.translate(cx, cy); x.rotate(lean); x.strokeStyle = '#9b6b3e'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(4 * s, -14 * s, 2 * s, -26 * s); x.stroke(); x.fillStyle = '#3fae62'; for (let i = 0; i < 5; i++) { x.save(); x.translate(2 * s, -26 * s); x.rotate(i / 5 * TAU + .4); x.beginPath(); x.ellipse(8 * s, 0, 10 * s, 3.5 * s, 0, 0, TAU); x.fill(); x.restore(); } x.restore(); };
  const house = (cx, cy, s, lit) => { x.fillStyle = '#f4e6c9'; x.fillRect(cx - 9 * s, cy - 10 * s, 18 * s, 10 * s); x.fillStyle = '#e4603e'; x.beginPath(); x.moveTo(cx - 11 * s, cy - 10 * s); x.lineTo(cx, cy - 18 * s); x.lineTo(cx + 11 * s, cy - 10 * s); x.closePath(); x.fill(); x.fillStyle = lit ? '#ffd96a' : '#6b5a4a'; x.fillRect(cx - 2.5 * s, cy - 7 * s, 5 * s, 4 * s); if (lit) { x.fillStyle = 'rgba(255,217,106,.25)'; x.beginPath(); x.arc(cx, cy - 5 * s, 14 * s, 0, TAU); x.fill(); } };
  const light = (cx, cy, s, on, ang) => { for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#e8503f' : '#f7f1e4'; x.beginPath(); x.moveTo(cx - (7 - i) * s, cy - i * 8 * s); x.lineTo(cx + (7 - i) * s, cy - i * 8 * s); x.lineTo(cx + (6.4 - i) * s, cy - (i + 1) * 8 * s); x.lineTo(cx - (6.4 - i) * s, cy - (i + 1) * 8 * s); x.fill(); } x.fillStyle = '#3a3a44'; x.fillRect(cx - 3.5 * s, cy - 46 * s, 7 * s, 6 * s); x.fillStyle = on ? '#fff3b0' : '#9aa'; x.beginPath(); x.arc(cx, cy - 43 * s, 2.6 * s, 0, TAU); x.fill();
    if (on) { x.save(); x.translate(cx, cy - 43 * s); x.rotate(ang); const g = x.createLinearGradient(0, 0, 70 * s, 0); g.addColorStop(0, 'rgba(255,240,170,.55)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(70 * s, -12 * s); x.lineTo(70 * s, 12 * s); x.closePath(); x.fill(); x.restore(); } };
  const draw = () => {
    const st = getState(), s = st.scene || 'sunset', t = (performance.now() - t0) / 1000, dark = DARK(s), stormy = s == 'storm', k = 1 + st.sea * .8;
    // 果冻的弹性：两个方向各自一根弹簧
    for (const d of ['x', 'y']) { const v = 'v' + d; sq[v] += (1 - sq[d]) * .09; sq[v] *= .86; sq[d] += sq[v]; }
    vrot *= .95; rot += vrot + (stormy ? .004 : .0015);
    const cx = W / 2, cy = H / 2 + R * .06, rx = R * sq.x, ry = R * sq.y, jc = st.jelly;
    x.clearRect(0, 0, W, H);
    // 影子
    x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.ellipse(cx, cy + ry * .98, rx * .78, ry * .09, 0, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.clip();
    // 天空 / 海
    let g = x.createLinearGradient(0, cy - ry, 0, cy + ry * .2); g.addColorStop(0, SKY[s][0]); g.addColorStop(1, SKY[s][1]); x.fillStyle = g; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    if (s == 'sun') { x.fillStyle = 'rgba(255,230,120,.95)'; x.beginPath(); x.arc(cx + rx * .45, cy - ry * .5, R * .11, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,230,120,.25)'; x.beginPath(); x.arc(cx + rx * .45, cy - ry * .5, R * .2, 0, TAU); x.fill(); }
    if (s == 'sunset') { g = x.createRadialGradient(cx, cy - ry * .05, 0, cx, cy - ry * .05, R * .6); g.addColorStop(0, 'rgba(255,200,120,.9)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2); x.fillStyle = '#ffd38a'; x.beginPath(); x.arc(cx, cy - ry * .02, R * .13, 0, TAU); x.fill(); }
    if (s == 'night' || s == 'aurora' || s == 'fireworks') { for (let i = 0; i < 40; i++) { const a = rnd(i) * TAU, r = rnd(i, 2) * .95; x.fillStyle = `rgba(255,255,255,${.3 + .7 * Math.abs(Math.sin(t * 1.5 + i))})`; x.beginPath(); x.arc(cx + Math.cos(a) * rx * r, cy - ry * .25 + Math.sin(a) * ry * r * .55 - ry * .2, .9 + rnd(i, 3), 0, TAU); x.fill(); } }
    if (s == 'night') { x.fillStyle = '#fff6cf'; x.beginPath(); x.arc(cx - rx * .4, cy - ry * .5, R * .09, 0, TAU); x.fill(); x.fillStyle = SKY.night[0]; x.beginPath(); x.arc(cx - rx * .34, cy - ry * .54, R * .08, 0, TAU); x.fill(); }
    if (s == 'aurora') { for (let b = 0; b < 3; b++) { x.beginPath(); for (let i = 0; i <= 30; i++) { const u = i / 30, xx = cx - rx + u * rx * 2, yy = cy - ry * .55 + Math.sin(u * 5 + t * .8 + b) * ry * .07 + b * ry * .07; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.strokeStyle = ['rgba(120,255,200,.35)', 'rgba(160,200,255,.3)', 'rgba(220,150,255,.28)'][b]; x.lineWidth = R * .14; x.stroke(); } }
    if (s == 'fog') { x.fillStyle = 'rgba(235,240,243,.55)'; x.fillRect(cx - rx, cy - ry * .3 + Math.sin(t) * 4, rx * 2, ry * .5); }
    // 海：几层波浪
    for (let L = 0; L < 3; L++) { x.beginPath(); x.moveTo(cx - rx, cy + ry); for (let i = 0; i <= 40; i++) { const u = i / 40, xx = cx - rx + u * rx * 2, yy = cy + ry * .12 + L * ry * .08 + Math.sin(u * 9 + t * (1.4 + L * .3) * k + L) * ry * .035 * k; x.lineTo(xx, yy); } x.lineTo(cx + rx, cy + ry); x.closePath(); x.fillStyle = L ? SEA[s][L % 2] : SEA[s][0]; x.globalAlpha = L ? .55 : 1; x.fill(); x.globalAlpha = 1; }
    // 鲸鱼绕着岛游
    whale += .006; { const a = whale, wx = cx + px(a, rx * .62), wz = pz(a), wy = cy + ry * .34 + wz * ry * .1, ws = .6 + (wz + 1) * .25; if (wz < .2) { x.save(); x.translate(wx, wy); x.scale(Math.cos(a + rot) > 0 ? -1 : 1, 1); x.fillStyle = dark ? '#6aa9ff' : '#3f7fd6'; x.beginPath(); x.ellipse(0, 0, 16 * ws, 7 * ws, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(14 * ws, 0); x.lineTo(24 * ws, -6 * ws); x.lineTo(24 * ws, 6 * ws); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(-8 * ws, -2 * ws, 1.3 * ws, 0, TAU); x.fill(); x.restore(); } }
    // 岛
    const iy = cy + ry * .22, irx = rx * .5, iry = ry * .13;
    x.fillStyle = '#e9d6a4'; x.beginPath(); x.ellipse(cx, iy + 6, irx, iry, 0, 0, TAU); x.fill();
    x.fillStyle = '#7cc46a'; x.beginPath(); x.ellipse(cx, iy, irx * .82, iry * .8, 0, 0, TAU); x.fill();
    x.fillStyle = '#5fb050'; x.beginPath(); x.ellipse(cx - irx * .2, iy - 3, irx * .4, iry * .45, 0, 0, TAU); x.fill();
    // 岛上的东西按前后画
    const lean = stormy ? Math.sin(t * 9) * .15 - .35 : Math.sin(t * 1.2) * .04, ps = R / 150;
    const props = [{ a: 0, d: () => light(cx + px(0, irx * .3), iy - 4 + pz(0) * iry * .6, ps * .9, dark || s == 'rain' || s == 'fog', t * 1.2) }, { a: 2.2, d: () => house(cx + px(2.2, irx * .5), iy + 2 + pz(2.2) * iry * .6, ps, dark) }, { a: 1.1, d: () => tree(cx + px(1.1, irx * .7), iy + pz(1.1) * iry * .6, ps * .8, lean) }, { a: 3.6, d: () => tree(cx + px(3.6, irx * .6), iy + pz(3.6) * iry * .6, ps * .7, lean * 1.2) }, { a: 4.9, d: () => tree(cx + px(4.9, irx * .75), iy + pz(4.9) * iry * .6, ps * .9, lean) }];
    props.sort((p, q) => pz(p.a) - pz(q.a)).forEach(p => p.d());
    // 天气粒子
    if (s == 'rain' || stormy) { drops.length < (stormy ? 90 : 50) && drops.push({ x: Math.random(), y: -.1, v: .02 + Math.random() * .02 }); x.strokeStyle = 'rgba(220,235,255,.6)'; x.lineWidth = 1; drops.forEach(d => { d.y += d.v * k; d.x += stormy ? .006 : 0; x.beginPath(); x.moveTo(cx - rx + d.x * rx * 2, cy - ry + d.y * ry * 2); x.lineTo(cx - rx + d.x * rx * 2 - (stormy ? 5 : 1), cy - ry + d.y * ry * 2 + 9); x.stroke(); }); drops = drops.filter(d => d.y < 1.1); } else drops.length = 0;
    if (stormy) { if (bolt <= 0 && Math.random() < .012) bolt = 10; if (bolt > 0) { bolt--; x.fillStyle = `rgba(255,255,255,${bolt / 30})`; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2); x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); let bx = cx + rx * .3, by = cy - ry; x.moveTo(bx, by); for (let i = 0; i < 5; i++) { bx += (Math.random() - .5) * 30; by += ry * .18; x.lineTo(bx, by); } x.stroke(); } }
    if (s == 'fireworks') { sparks.length < 160 && Math.random() < .06 && (() => { const ox = cx + (Math.random() - .5) * rx, oy = cy - ry * (.3 + Math.random() * .4), col = `hsl(${Math.random() * 360},90%,70%)`; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, v = 1.2 + Math.random(); sparks.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 40 + Math.random() * 20, c: col }); } })(); sparks.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .03; p.l--; x.globalAlpha = Math.max(0, p.l / 60); x.fillStyle = p.c; x.fillRect(p.x, p.y, 2, 2); }); x.globalAlpha = 1; sparks = sparks.filter(p => p.l > 0); }
    // 果冻本体：颜色罩 + 边缘 + 高光
    x.restore(); x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.clip();
    g = x.createRadialGradient(cx - rx * .3, cy - ry * .35, R * .1, cx, cy, R * 1.05); g.addColorStop(0, `rgba(${jc},${dark ? .08 : .16})`); g.addColorStop(.75, `rgba(${jc},${dark ? .12 : .22})`); g.addColorStop(1, `rgba(${jc},.55)`); x.fillStyle = g; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    x.restore();
    x.lineWidth = 2; x.strokeStyle = `rgba(${jc},.75)`; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(cx - rx * .42, cy - ry * .55, rx * .22, ry * .1, -.5, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.ellipse(cx - rx * .62, cy - ry * .3, rx * .04, ry * .04, 0, 0, TAU); x.fill();
    raf = requestAnimationFrame(draw);
  };
  // 按住球：捏扁；松手弹回；在外面划：转岛
  let pd = null;
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(), dx = e.clientX - r.left - W / 2, dy = e.clientY - r.top - H / 2; pd = { x: e.clientX, y: e.clientY, inside: Math.hypot(dx, dy) < R, lx: e.clientX }; cv.setPointerCapture?.(e.pointerId); if (pd.inside) { sq.x = 1.08; sq.y = .9; } });
  cv.addEventListener('pointermove', e => { if (!pd) return; if (pd.inside) { const dx = (e.clientX - pd.x) / R, dy = (e.clientY - pd.y) / R; sq.x = Math.max(.75, Math.min(1.3, 1 + dx * .4)); sq.y = Math.max(.75, Math.min(1.3, 1 - dy * .4)); } else vrot = (e.clientX - pd.lx) * .004; pd.lx = e.clientX; });
  const up = () => { if (pd?.inside) { sq.vx = (1 - sq.x) * .3; sq.vy = (1 - sq.y) * .3; } pd = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  draw();
  return { stop: () => { cancelAnimationFrame(raf); ro?.disconnect(); }, size, shake: () => { sq.vx = .25; sq.vy = -.22; } };
}

/* ---------- 页面 ---------- */
let pt;
const jelly = () => (JELLY.find(j => j[0] == S.isle?.jelly) || JELLY[0])[2].join(',');
const ago = ts => { if (!ts) return ''; const m = (now() - ts) / 6e4; return m < 1 ? '刚刚' : m < 60 ? `${m | 0} 分钟前` : m < 1440 ? `${m / 60 | 0} 小时前` : new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); };
const body = () => { const id = curId(), c = byId(id), r = id ? rec(id) : null, ps = people();
  if (!ps.length) return `<div class="is-empty"><p>还没有联系人</p></div>`;
  return `<div class="is-who">${ps.map(p => `<b class="${p.id == id ? 'on' : ''}" data-a="iswho" data-x="${esc(p.id)}"><img src="${esc(avOf(p))}" alt=""></b>`).join('')}</div>
  <div class="is-stage"><canvas class="is-cv"></canvas></div>
  <div class="is-card"><div class="is-mood"><b>${esc(r?.mood || '还不知道')}</b><small>${r?.scene ? SCENES[r.scene] + ' · ' : ''}${esc(nm(c))}的岛${r?.ts ? ' · ' + ago(r.ts) : ''}</small></div>${r?.say ? `<p class="is-say">「${esc(r.say)}」</p>` : ''}
  <div class="is-btns"><button class="btn pri" data-a="islook">看看 TA 现在</button><button class="btn" data-a="ishist">潮汐记录</button></div></div>`; };
const mount = el => { pt?.stop(); const cv = $('.is-cv', el); if (!cv) return; const id = curId(); pt = painter(cv, () => { const r = id ? rec(id) : { scene: 'sunset', sea: .4 }; return { scene: r.scene || 'sunset', sea: r.sea ?? .4, jelly: jelly() }; }); };
const look = () => { const id = curId(), c = byId(id); if (!c) return; return task(`读 ${nm(c)} 的心情`, async sg => {
  const r = json(await llm(await sysCtx({ n: 10, rc: 3500, wi: 0, desc: 1000 }), `根据最近的剧情，判断${rn(c)}此刻的心情。只输出 JSON：{"mood":"两到四个字的心情词","scene":"sun|sunset|rain|storm|aurora|night|fog|fireworks 里选一个最贴切的","say":"${rn(c)}此刻没说出口的一句话，30字以内，第一人称","sea":0到1的数字表示情绪起伏大小}`, '读心情', sg, { aux: 1 }));
  if (!r?.mood) throw Error('没读出来，再试一次'); setMood(id, r); pt?.shake(); return `${nm(c)}：${r.mood}`; }); };
reg({
  id: 'isle', name: '心屿', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#fff" opacity=".35"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.4"/><ellipse cx="12" cy="14.2" rx="4.6" ry="1.7" fill="#fff"/><path d="M12 7.5v6.3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M12 8.3c1.2 0 2.2-.8 2.6-1.3M12 8.3c-1.2 0-2.2-.8-2.6-1.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="8.3" cy="9.3" r=".9" fill="#fff"/></svg>',
  open: () => page({ title: '心屿', cls: 'isle', live: 1, right: () => `<b data-a="isset">${jellyDot()}</b>`, body, after: mount, onClose: () => { pt?.stop(); pt = null; },
    acts: {
      iswho: (x, t, e, pg) => { ISL().cur = x; saveD(); pg.re(); },
      islook: look,
      ishist: () => { const id = curId(), c = byId(id), r = rec(id); page({ title: `${nm(c)}的潮汐记录`, body: () => r.hist.length ? `<div class="is-hist">${r.hist.map(h => `<div class="is-h"><i class="sc-${h.scene}"></i><div><b>${esc(h.mood)}</b><small>${SCENES[h.scene] || ''} · ${new Date(h.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>${h.say ? `<p>「${esc(h.say)}」</p>` : ''}</div></div>`).join('')}</div>` : '<div class="is-empty"><p>还没有记录</p></div>' }); },
      isset: async (x, t, e, pg) => { const k = await menu([...JELLY.map(([k, n]) => [k, `${(S.isle?.jelly || 'mint') == k ? '✓ ' : ''}果冻 · ${n}`]), ['auto', `${S.isle?.auto ? '✓ ' : ''}跟着剧情变`]], '心屿'); if (!k) return; S.isle ||= {}; if (k == 'auto') { S.isle.auto = !S.isle.auto; syncInject(); } else S.isle.jelly = k; save(); pg.re(); },
    } }),
});
const jellyDot = () => `<i class="is-dot" style="background:rgb(${jelly()})"></i>`;
on('isle', () => { const t = top(); t?.el?.classList.contains('isle') && t.re(); });
// 正文里带的心情：心情|谁|心情词|一句话
on('isle-mood', list => { for (const m of list) { const c = people().find(p => rn(p) == m.who || nm(p) == m.who || p.nick == m.who); if (!c) continue; setMood(c.id, { mood: m.mood, say: m.say }); toast(`${nm(c)}的岛：${m.mood}`); } });
