// 小手机 · 锁屏：动态壁纸 / 时间 / 上滑解锁 / 4 位数字密码或手势密码
// 初始备用密码 0000：不能修改、永远有效——忘记自己设的密码时输入 0000 就能进去（手势锁屏点「使用备用密码」）
import { S, D, ui, $, esc, now, hm, save, sheet, toast, mediaSrc } from './core.js';
import { mountScene, sceneInk, SCENES } from './lockfx.js';

export const BACKUP = '0000';
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
export const setPin = p => (S.lock.pin = hash('p' + p), save());
export const setGest = g => (S.lock.gest = hash('g' + g), save());
const okPin = p => p == BACKUP || (!!S.lock.pin && hash('p' + p) == S.lock.pin);
const okGest = g => !!S.lock.gest && hash('g' + g) == S.lock.gest;
export const wpName = () => S.lock.wp == 'video' ? '自定义视频' : SCENES.find(x => x[0] == S.lock.wp)?.[1] || '光之教堂';

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/></svg>';
const LET = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
const WEEK = '日一二三四五六';

/* ---------- 可复用：数字键盘 / 手势九宫格（锁屏解锁和设置密码共用） ---------- */
// onDone(code, reset, fail) —— 输满 4 位时调用；fail() 抖动并清空
export function pinPad(host, title, onDone) {
  let v = '';
  host.innerHTML = `<p class="lk-t">${esc(title)}</p><div class="lk-dots">${'<i></i>'.repeat(4)}</div><p class="lk-msg"></p><div class="lk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}"><b>${n}</b><small>${LET[n - 1]}</small></button>`).join('')}<span></span><button data-n="0"><b>0</b></button><button data-n="del" class="del">删除</button></div>`;
  const dots = [...host.querySelectorAll('.lk-dots i')], msg = $('.lk-msg', host), show = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
  const api = {
    title: t => $('.lk-t', host).textContent = t, msg: (t, bad) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); },
    reset: () => { v = ''; show(); },
    fail: t => { const d = $('.lk-dots', host); d.classList.remove('shk'); void d.offsetWidth; d.classList.add('shk'); navigator.vibrate?.([30, 40, 30]); api.msg(t, 1); setTimeout(api.reset, 380); },
    key: n => { if (n == 'del') { v = v.slice(0, -1); return show(); } if (v.length >= 4) return; v += n; show(); v.length == 4 && setTimeout(() => onDone(v, api), 140); },
  };
  host.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); api.key(b.dataset.n); }));
  return api;
}
// 手势：3×3 点阵，连线经过中间的点会自动连上（和安卓一样）；onDone(pattern '0-1-2-5', api)
export function gesturePad(host, title, onDone) {
  host.innerHTML = `<p class="lk-t">${esc(title)}</p><p class="lk-msg"></p><div class="lk-gest"><canvas></canvas>${Array.from({ length: 9 }, (_, i) => `<i data-i="${i}"></i>`).join('')}</div>`;
  const box = $('.lk-gest', host), cv = $('canvas', box), ctx = cv.getContext('2d'), dots = [...box.querySelectorAll('i')], msg = $('.lk-msg', host);
  let path = [], cur = null, drawing = false, bad = false;
  const pos = i => [(i % 3 + .5) / 3, ((i / 3 | 0) + .5) / 3];
  const paint = () => {
    const w = box.clientWidth, h = box.clientHeight, d = Math.min(devicePixelRatio || 1, 2); if (cv.width != w * d) { cv.width = w * d; cv.height = h * d; }
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    dots.forEach((el, i) => { el.classList.toggle('on', path.includes(i)); el.classList.toggle('bad', bad && path.includes(i)); }); if (!path.length) return;
    ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = bad ? 'rgba(255,90,90,.85)' : 'rgba(255,255,255,.75)'; ctx.beginPath();
    path.forEach((i, j) => { const [x, y] = pos(i); j ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h); }); cur && drawing && ctx.lineTo(cur[0], cur[1]); ctx.stroke();
  };
  const hit = (x, y) => { const w = box.clientWidth, h = box.clientHeight; for (let i = 0; i < 9; i++) { const [px, py] = pos(i); if (Math.hypot(px * w - x, py * h - y) < w * .12) return i; } return -1; };
  const add = i => { if (i < 0 || path.includes(i)) return; const l = path.at(-1); if (l != null) { const m = (l + i) / 2; Number.isInteger(m) && (l % 3 + i % 3) % 2 == 0 && ((l / 3 | 0) + (i / 3 | 0)) % 2 == 0 && !path.includes(m) && path.push(m); } path.push(i); navigator.vibrate?.(8); };
  const xy = e => { const r = box.getBoundingClientRect(), s = r.width / box.clientWidth || 1; return [(e.clientX - r.left) / s, (e.clientY - r.top) / s]; };
  const api = {
    title: t => $('.lk-t', host).textContent = t, msg: (t, b) => { msg.textContent = t || ''; msg.classList.toggle('bad', !!b); },
    reset: () => { path = []; bad = false; paint(); },
    fail: t => { bad = true; paint(); navigator.vibrate?.([30, 40, 30]); api.msg(t, 1); setTimeout(api.reset, 700); },
  };
  box.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); box.setPointerCapture?.(e.pointerId); api.reset(); drawing = true; api.msg(''); const [x, y] = xy(e); add(hit(x, y)); cur = [x, y]; paint(); });
  box.addEventListener('pointermove', e => { if (!drawing) return; e.stopPropagation(); const [x, y] = xy(e); add(hit(x, y)); cur = [x, y]; paint(); });
  const end = e => { if (!drawing) return; e.stopPropagation(); drawing = false; cur = null; paint(); if (!path.length) return; if (path.length < 4) return api.fail('至少连接 4 个点'); onDone(path.join('-'), api); };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  requestAnimationFrame(paint);
  return api;
}

/* ---------- 设置密码（设置页调用）：输两遍确认 ---------- */
export function askPin(done) {
  let first = '';
  const s = sheet({ title: '设置4位数字密码', noBack: 1, cls: 'lk-sheet', body: () => '<div class="lk-auth lk-set"></div>', after: el => {
    const pad = pinPad($('.lk-set', el), '输入新密码', (v, p) => {
      if (!first) { if (v == BACKUP) return p.fail('0000 是备用密码，换一个吧'); first = v; p.reset(); p.title('再输入一次'); return p.msg(''); }
      if (v != first) { first = ''; p.title('输入新密码'); return p.fail('两次不一致，请重新设置'); }
      setPin(v); s.close(); toast('数字密码已设置'); done?.();
    });
    pad.msg('备用密码 0000 始终有效');
  } });
}
export function askGest(done) {
  let first = '';
  const s = sheet({ title: '设置手势密码', noBack: 1, cls: 'lk-sheet', body: () => '<div class="lk-auth lk-set"></div>', after: el => {
    gesturePad($('.lk-set', el), '画出解锁图案', (g, p) => {
      if (!first) { first = g; p.reset(); p.title('再画一次确认'); return p.msg(''); }
      if (g != first) { first = ''; p.title('画出解锁图案'); return p.fail('两次不一致，请重新绘制'); }
      setGest(g); s.close(); toast('手势密码已设置'); done?.();
    }).msg('至少连接 4 个点');
  } });
}

/* ---------- 锁屏本体 ---------- */
let el, fx, locked = false, iv, vurl;
export const isLocked = () => locked;
const visible = () => ui.root?.classList.contains('on');
function clock() {
  if (!el) return; const d = now(), u = D().chats.reduce((a, c) => a + (c.unread || 0), 0);
  $('.lk-time', el).textContent = hm(d); $('.lk-date', el).textContent = `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
  const n = $('.lk-note', el); n.hidden = !u; u && ($('b', n).textContent = `${u} 条未读消息`);
}
async function wallpaper() {
  const bg = $('.lk-bg', el); fx?.stop(); fx = null; vurl && URL.revokeObjectURL(vurl); vurl = '';
  const k = S.lock.wp == 'video' && S.lock.video ? 'video' : S.lock.wp || 'cathedral', ink = sceneInk(k);
  el.style.setProperty('--lk-ink', k == 'video' ? '#fff' : ink.ink); el.style.setProperty('--lk-shade', k == 'video' ? 'rgba(0,0,0,.45)' : ink.shade);
  ui.scr.style.setProperty('--lk-sb', k == 'video' ? '#fff' : ink.ink); ui.scr.style.setProperty('--lk-sbs', k == 'video' ? 'rgba(0,0,0,.45)' : ink.shade);
  if (k == 'video') { const src = await mediaSrc(S.lock.video).catch(() => ''); src.startsWith('blob:') && (vurl = src); bg.innerHTML = `<video src="${esc(src)}" autoplay muted loop playsinline></video>`; $('video', bg).play?.().catch(() => {}); return; }
  bg.innerHTML = '<canvas></canvas>'; fx = mountScene($('canvas', bg), k, { active: () => locked && visible() });
}
export function lock(preview) {
  el ||= ui.lock; if (!el) return;
  locked = true; el.hidden = false; el.className = 'lock' + (preview ? ' pv' : ''); ui.scr.classList.add('locked');
  el.innerHTML = `<div class="lk-bg"></div><div class="lk-ui"><i class="lk-ic">${LOCK}</i><div class="lk-clock"><small class="lk-date"></small><b class="lk-time"></b>${S.lock.text ? `<p class="lk-text">${esc(S.lock.text)}</p>` : ''}</div>
<div class="lk-note" hidden><i>💬</i><div><small>消息 · 现在</small><b></b></div></div><div class="lk-hint"><span>${preview ? '预览 · 上滑退出' : '向上滑动解锁'}</span></div></div><div class="lk-auth" hidden></div>`;
  wallpaper(); clock(); clearInterval(iv); iv = setInterval(() => locked && visible() && clock(), 1e3);
  swipe(preview);
}
function swipe(preview) {
  const u = $('.lk-ui', el); let y0 = null, t0 = 0, dy = 0;
  const go = () => preview || !S.lock.pw ? unlock() : auth();
  u.addEventListener('pointerdown', e => { if (e.target.closest('.lk-auth')) return; y0 = e.clientY; t0 = Date.now(); dy = 0; u.style.transition = 'none'; });
  u.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.min(0, e.clientY - y0); u.style.transform = `translateY(${dy * .6}px)`; u.style.opacity = 1 + dy / 420; });
  const up = () => { if (y0 == null) return; y0 = null; u.style.transition = ''; u.style.transform = u.style.opacity = ''; (dy < -70 || dy / Math.max(1, Date.now() - t0) < -.5) && go(); };
  u.addEventListener('pointerup', up); u.addEventListener('pointercancel', up);
  $('.lk-hint', el).addEventListener('click', e => { e.stopPropagation(); go(); });
  el.onkeydown = e => { if (/^\d$/.test(e.key)) el._pad?.key?.(e.key); else if (e.key == 'Backspace') el._pad?.key?.('del'); else if (e.key == 'Enter' && !el.classList.contains('authing')) go(); };
  el.tabIndex = 0; requestAnimationFrame(() => el.focus?.({ preventScroll: true }));
}
function auth(backup) {
  const a = $('.lk-auth', el), gest = S.lock.type == 'gesture' && !!S.lock.gest && !backup; a.hidden = false; el.classList.add('authing');
  const box = Object.assign(document.createElement('div'), { className: 'lk-box' }); a.innerHTML = ''; a.append(box);
  if (gest) { el._pad = null; gesturePad(box, '绘制解锁图案', (g, p) => okGest(g) ? (p.msg(''), unlock()) : p.fail('图案错误，再试一次')); }
  else el._pad = pinPad(box, backup ? '输入备用密码' : '输入密码', (v, p) => okPin(v) ? unlock() : p.fail(S.lock.pin ? '密码错误' : '还没设置密码，可以用备用密码进入'));
  const ft = Object.assign(document.createElement('div'), { className: 'lk-ft' });
  ft.innerHTML = `<b data-x="c">取消</b><b data-x="f">${gest ? '使用备用密码' : '忘记密码？'}</b>`; a.append(ft);
  ft.onclick = e => { const x = e.target.dataset?.x; e.stopPropagation(); if (x == 'c') { a.hidden = true; el.classList.remove('authing'); } if (x == 'f') gest ? auth(true) : el._pad?.msg('忘记了就输入初始备用密码（可在设置里查看）'); };
}
export function unlock() {
  if (!el || !locked) return; locked = false; el.classList.add('out'); ui.scr.classList.remove('locked'); clearInterval(iv);
  $('.lk-ic', el) && ($('.lk-ic', el).innerHTML = UNLOCK);
  setTimeout(() => { if (locked) return; fx?.stop(); fx = null; el.hidden = true; el.innerHTML = ''; vurl && URL.revokeObjectURL(vurl); vurl = ''; }, 480);
}
// 手机收起 / 关机时调用：下次打开就是锁屏状态
export const relock = () => S.lock.on && !locked && lock();
