// 小手机 · 锁屏：动态壁纸 / 时间 / 从底部上滑解锁
// 密码二选一：4 位数字密码（备用密码 0000：不能修改、永远有效）或指纹（模拟，选了指纹就只能按指纹解锁）
import { S, D, ui, $, esc, now, hm, save, sheet, toast, mediaSrc } from './core.js';
import { mountScene, sceneInk, sceneKey, SCENES } from './lockfx.js';

export const BACKUP = '0000';
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
export const setPin = p => (S.lock.pin = hash('p' + p), save());
const okPin = p => p == BACKUP || (!!S.lock.pin && hash('p' + p) == S.lock.pin);
export const wpName = () => S.lock.wp == 'video' ? '自定义视频' : SCENES.find(x => x[0] == sceneKey(S.lock.wp))[1];

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>';
const UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/></svg>';
const LET = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
const WEEK = '日一二三四五六';

/* ---------- 可复用：数字键盘（锁屏解锁和设置密码共用） ---------- */
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


/* ---------- 模拟指纹（网页拿不到真实指纹：按住感应区、纹路扫满就算通过） ---------- */
const FPP = ['M9 20c2.6-6 8.4-10 15-10s12.4 4 15 10', 'M13 37c1.6-3.2 2.2-6.4 2.2-10 0-5 4-8.8 8.8-8.8s8.8 3.8 8.8 8.8v2', 'M19 41c1.6-3.6 2.6-7.8 2.6-12.4 0-1.4 1-2.4 2.4-2.4s2.4 1 2.4 2.4c0 5.2-1 9.8-3 13.8',
  'M30 41.5c1.4-3.2 2.4-6.9 2.6-11', 'M38.6 33c-.5 2.6-1.3 4.8-2.2 6.7', 'M8.4 28.5c0-1.6.2-3.1.6-4.6', 'M15 14.2c2.6-1.6 5.7-2.5 9-2.5 6.2 0 11.6 3.3 14.4 8.3', 'M9.6 33.8c-.7-1.6-1.1-3.4-1.2-5.3', 'M26.5 29.2c0 4.1-.9 8.1-2.6 11.6'];
export const fpSvg = () => `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-width="2.3"><g class="fpb" stroke="currentColor">${FPP.map(d => `<path d="${d}"/>`).join('')}</g><g class="fpc">${FPP.map(d => `<path pathLength="1" d="${d}"/>`).join('')}</g></svg>`;
export const fpOn = () => !!(S.lock.pw && S.lock.type == 'fp' && S.lock.fpSet);
// 旧版指纹是单独开关：改成三选一里的「指纹」
// 旧版：指纹是单独开关 / 有手势密码 → 现在只有「数字密码」「指纹」二选一（手势密码录过指纹就换成指纹，否则换成数字密码）
export const lockMig = () => { const L = S.lock; let ch = 0; if ('fp' in L) { L.fp && L.fpSet && !L.pin && !L.gest && (L.type = 'fp'); delete L.fp; ch = 1; } if (L.type == 'gesture') { L.type = L.fpSet ? 'fp' : 'pin'; ch = 1; } if ('gest' in L) { delete L.gest; ch = 1; } ch && save(); };
// 按住 ms 毫秒算一次成功；提前松手算失败
function holdSensor(btn, ms, ok, early) {
  let tm, t0;
  const end = e => { if (!t0) return; e?.stopPropagation(); clearTimeout(tm); t0 = 0; btn.classList.remove('on'); btn.dataset.done || early?.(); };
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); btn.setPointerCapture?.(e.pointerId); delete btn.dataset.done; t0 = Date.now(); btn.classList.add('on'); navigator.vibrate?.(10); tm = setTimeout(() => { btn.dataset.done = 1; btn.classList.remove('on'); t0 = 0; navigator.vibrate?.([15, 30, 15]); ok(); }, ms); });
  btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end); btn.addEventListener('pointerleave', end);
}
// 录入：按 6 次，纹路一点点亮起来
// 录入：按住一次，纹路扫满就录好了
export function askFp(done) {
  const s = sheet({ title: '录入指纹', noBack: 1, cls: 'lk-sheet', body: () => `<div class="lk-auth lk-set lk-enr"><p class="lk-t">把手指放在感应区上</p><p class="lk-msg">按住不动，纹路扫满就录好了</p><b class="lk-fp big rec">${fpSvg()}</b></div>`, after: el => {
    const b = $('.lk-fp', el), m = $('.lk-msg', el);
    holdSensor(b, 900, () => { b.classList.add('ok'); m.classList.remove('bad'); m.textContent = '录入成功'; S.lock.fpSet = true; save(); setTimeout(() => { s.close(); toast('指纹已录入'); done?.(); }, 650); },
      () => { m.textContent = '请按住不要松开'; m.classList.add('bad'); });
  } });
}

/* ---------- 锁屏本体 ---------- */
let el, fx, locked = false, iv, vurl;
export const isLocked = () => locked;
export const lockFx = () => fx; // 测试 / 调试用：当前锁屏场景
const visible = () => ui.root?.classList.contains('on');
function clock() {
  if (!el) return; const d = now(), u = D().chats.reduce((a, c) => a + (c.unread || 0), 0);
  $('.lk-time', el).textContent = hm(d); $('.lk-date', el).textContent = `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
  const n = $('.lk-note', el); n.hidden = !u; u && ($('b', n).textContent = `${u} 条未读消息`);
}
async function wallpaper() {
  const bg = $('.lk-bg', el); fx?.stop(); fx = null; vurl && URL.revokeObjectURL(vurl); vurl = '';
  const k = S.lock.wp == 'video' && S.lock.video ? 'video' : sceneKey(S.lock.wp), ink = sceneInk(k);
  el.style.setProperty('--lk-ink', k == 'video' ? '#fff' : ink.ink); el.style.setProperty('--lk-shade', k == 'video' ? 'rgba(0,0,0,.45)' : ink.shade);
  ui.scr.style.setProperty('--lk-sb', k == 'video' ? '#fff' : ink.ink); ui.scr.style.setProperty('--lk-sbs', k == 'video' ? 'rgba(0,0,0,.45)' : ink.shade);
  if (k == 'video') { const src = await mediaSrc(S.lock.video).catch(() => ''); src.startsWith('blob:') && (vurl = src); bg.innerHTML = `<video src="${esc(src)}" autoplay muted loop playsinline></video>`; $('video', bg).play?.().catch(() => {}); return; }
  bg.innerHTML = '<canvas></canvas>'; fx = mountScene($('canvas', bg), k, { active: () => locked && visible() });
}
export function lock(preview) {
  el ||= ui.lock; if (!el) return; lockMig();
  locked = true; el.hidden = false; el.className = 'lock' + (preview ? ' pv' : '') + (fpOn() ? ' fp' : ''); ui.scr.classList.add('locked');
  el.innerHTML = `<div class="lk-bg"></div><div class="lk-ui"><i class="lk-ic">${LOCK}</i><div class="lk-clock"><small class="lk-date"></small><b class="lk-time"></b>${S.lock.text ? `<p class="lk-text">${esc(S.lock.text)}</p>` : ''}</div>
<div class="lk-note" hidden><i>💬</i><div><small>消息 · 现在</small><b></b></div></div>${fpOn() ? `<b class="lk-fp">${fpSvg()}</b>` : ''}<div class="lk-hint"><span>${hintText(preview)}</span></div></div><div class="lk-auth" hidden></div>`;
  wallpaper(); clock(); clearInterval(iv); iv = setInterval(() => locked && visible() && clock(), 1e3);
  if (fx?.interactive) { const h = $('.lk-hint span', el); h.textContent = '轻点圣诞树和雪人 · 雪地上可以写字'; setTimeout(() => locked && h.isConnected && (h.textContent = hintText(preview)), 3800); }
  swipe(preview);
  const fpb = $('.lk-fp', el); fpb && holdSensor(fpb, 600, () => { fpb.classList.add('ok'); setTimeout(unlock, 260); }, () => { const h = $('.lk-hint span', el); h.textContent = '请按住指纹感应区'; setTimeout(() => locked && (h.textContent = '按住指纹解锁 · 上滑用备用密码'), 1600); });
}
const hintText = preview => preview ? '预览 · 从底部上滑退出' : fpOn() ? '按住指纹解锁' : '从底部向上滑动解锁';
// 动态锁屏可以互动（雪地写字、点圣诞树…）：从屏幕底部上滑才是解锁；其他地方的触摸交给场景
function swipe(preview) {
  const u = $('.lk-ui', el); let y0 = null, t0 = 0, dy = 0;
  // 指纹模式只能按指纹，上滑只是提示一下，不会出现数字密码
  const go = () => preview || !S.lock.pw ? unlock() : fpOn() ? fpNudge() : auth();
  let mode = '', x0 = 0;
  u.addEventListener('pointerdown', e => {
    if (e.target.closest('.lk-auth,.lk-fp,.lk-note') || el.classList.contains('authing')) return;
    const r = el.getBoundingClientRect(), bottom = e.clientY > r.bottom - r.height * .12;
    mode = !bottom && fx?.interactive ? (fx.input('down', e.clientX, e.clientY) ? 'fx' : 'both') : 'swipe'; x0 = e.clientX;
    if (mode == 'fx') { u.setPointerCapture?.(e.pointerId); return; }
    y0 = e.clientY; t0 = Date.now(); dy = 0; u.style.transition = 'none';
  });
  u.addEventListener('pointermove', e => {
    if (mode == 'fx' || mode == 'both') fx?.input('move', e.clientX, e.clientY); if (mode == 'fx' || y0 == null) return;
    dy = Math.min(0, e.clientY - y0); if (mode == 'both' && dy > -30) return; u.style.transform = `translateY(${dy * .6}px)`; u.style.opacity = 1 + dy / 420;
  });
  const up = e => {
    if (mode == 'fx' || mode == 'both') fx?.input(e?.type == 'pointercancel' ? 'cancel' : 'up', e?.clientX ?? x0, e?.clientY ?? y0); if (mode == 'fx') { mode = ''; return; }
    if (y0 == null) return; y0 = null; u.style.transition = ''; u.style.transform = u.style.opacity = '';
    const fast = dy / Math.max(1, Date.now() - t0); (mode == 'swipe' ? dy < -70 || fast < -.5 : dy < -160 && fast < -.6) && go(); mode = '';
  };
  u.addEventListener('pointerup', up); u.addEventListener('pointercancel', up);
  $('.lk-hint', el).addEventListener('click', e => { e.stopPropagation(); go(); });
  el.onkeydown = e => { if (/^\d$/.test(e.key)) el._pad?.key?.(e.key); else if (e.key == 'Backspace') el._pad?.key?.('del'); else if (e.key == 'Enter' && !el.classList.contains('authing')) go(); };
  el.tabIndex = 0; requestAnimationFrame(() => el.focus?.({ preventScroll: true }));
}
const fpNudge = () => { const b = $('.lk-fp', el), h = $('.lk-hint span', el); if (!b) return; b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); navigator.vibrate?.(20); h.textContent = '请按住指纹感应区解锁'; setTimeout(() => locked && h.isConnected && (h.textContent = hintText()), 1800); };
function auth() {
  const a = $('.lk-auth', el); a.hidden = false; el.classList.add('authing');
  const box = Object.assign(document.createElement('div'), { className: 'lk-box' }); a.innerHTML = ''; a.append(box);
  el._pad = pinPad(box, '输入密码', (v, p) => okPin(v) ? unlock() : p.fail(S.lock.pin ? '密码错误' : '还没设置数字密码，备用密码 0000'));
  const ft = Object.assign(document.createElement('div'), { className: 'lk-ft' });
  ft.innerHTML = '<b data-x="c">取消</b><b data-x="f">忘记密码？</b>'; a.append(ft);
  ft.onclick = e => { const x = e.target.dataset?.x; e.stopPropagation(); if (x == 'c') { a.hidden = true; el.classList.remove('authing'); } if (x == 'f') el._pad?.msg('备用密码 0000'); };
}
export function unlock() {
  if (!el || !locked) return; locked = false; el.classList.add('out'); ui.scr.classList.remove('locked'); clearInterval(iv);
  $('.lk-ic', el) && ($('.lk-ic', el).innerHTML = UNLOCK);
  setTimeout(() => { if (locked) return; fx?.stop(); fx = null; el.hidden = true; el.innerHTML = ''; vurl && URL.revokeObjectURL(vurl); vurl = ''; }, 480);
}
// 手机收起 / 关机时调用：下次打开就是锁屏状态，而且锁屏重新开始（写的字、亮的灯都恢复原样）
export const relock = () => S.lock.on && lock();
