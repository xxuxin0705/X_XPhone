// 小手机 · 核心：状态 / UI原语 / AI调用 / 世界书 / 时间 / 正文注入
export const C = () => SillyTavern.getContext();
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const ui = {}, G = {}, APPS = {};
export const reg = a => (APPS[a.id] = a);
const bus = new EventTarget();
export const on = (e, f) => bus.addEventListener(e, x => f(x.detail));
export const emit = (e, d) => bus.dispatchEvent(new CustomEvent(e, { detail: d }));
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { const k = p.split('.'), l = k.pop(); k.reduce((a, x) => (a[x] ??= {}), o)[l] = v; };
export const merge = (t, d) => { for (const k in d) if (t[k] === undefined) t[k] = structuredClone(d[k]); else if (d[k]?.constructor === Object && t[k]?.constructor === Object) merge(t[k], d[k]); return t; };

/* ---------- 状态：S 全局设置（extensionSettings） / D() 当前聊天的手机数据（chatMetadata） ---------- */
const api = x => ({ src: 'tavern', cur: '', list: [], ...x });
const DEF = {
  api: { chat: api(), img: api({ auto: false }), tts: api() }, mode: 'linked', time: 'story', scan: true, notify: true,
  kw: '(发|回)了?[一几]?[条个句]?(消息|微信|短信|信息|语音|私信)|拉.{0,3}群|建.{0,2}群|群聊|群里|加.{0,3}(好友|微信|QQ|联系方式)|朋友圈|空间|发.{0,2}动态|转账|红包|拍了拍|手机.{0,2}(震|响|亮)',
  ctxN: 15, tmo: 300, wi: { follow: true, books: [], ov: {} }, show: 'float', scale: 1, pos: {}, style: 'wx',
  theme: 'matcha', wall: '', css: '', icons: {}, ui: { order: {}, fold: {} }, desk: null,
  assets: {
    widget: [{ id: 'w1', name: '心情便签', sz: '2x2', html: '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px"><b style="font:700 30px Georgia,serif">{{time}}</b><small>今天也要开心 ✧</small><small style="opacity:.6">{{date}} 周{{week}}</small></div>' }],
    bubble: [
      { id: 'b1', name: '果冻糖', css: '.bub{border-radius:20px!important;box-shadow:inset 0 -3px 0 rgba(0,0,0,.06),0 4px 12px rgba(0,0,0,.06)!important}.me .bub{background:linear-gradient(135deg,#ffd6e6,#ffb3cf)!important;color:#5a2a3c!important}' },
      { id: 'b2', name: '手账描边', css: '.bub{background:#fffdf6!important;color:#4a3f35!important;border:1.5px dashed #c9b79c;border-radius:14px!important;box-shadow:none!important}.me .bub{background:#eaf6e3!important;border-color:#9cc48a}.bub::before{display:none!important}' }],
    frame: [], sticker: [],
  },
};
export let S = DEF;
export const initS = () => (S = merge(C().extensionSettings.st_phone ??= {}, DEF));
export const save = () => C().saveSettingsDebounced();
const BLANK = { chats: [], posts: [], me: { nick: '', sign: '', av: '', cover: '', wallet: 520 }, plot: null };
export const D = () => merge((C().chatMetadata ??= {}).st_phone ??= {}, BLANK);
export const saveD = () => { const c = C(); (c.saveMetadataDebounced || c.saveMetadata)?.call(c); syncInject(); };

/* ---------- 名字 / 头像 ---------- */
export const nm = c => c ? c.remark || c.nick || c.real || c.name || '?' : '?';
export const rn = c => c?.real || c?.nick || c?.name || '?';
const PAL = ['#a8d8b9', '#f6c1cc', '#b5c7f2', '#f7d79c', '#c9b6f2', '#9ed9e0', '#f4b9a0'];
export const defAv = n => { n = String(n || '?'); return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="${PAL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length]}"/><text x="40" y="53" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">${esc([...n][0])}</text></svg>`); };
export const meObj = () => { const d = D().me; return { ...d, id: 'me', nick: d.nick || C().name1, real: C().name1 }; };
export const byId = id => D().chats.find(c => c.id == id);
export function avOf(c) { if (!c) return defAv('?'); if (c.av) return c.av; const x = C(), ch = x.characters?.[x.characterId]; return (ch && c.real && c.real == x.name2 && x.getThumbnailUrl?.('avatar', ch.avatar)) || defAv(nm(c)); }
export const brief = m => ({ sticker: '[表情]', img: '[图片]', voice: '[语音]', transfer: `[转账¥${m.amt}]` }[m.t] || '') + (m.c || '');

/* ---------- 时间：跟随剧情 / 现实 ---------- */
export const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
export function now() { const p = D().plot; return S.time == 'story' && p ? new Date(p.t + Math.min(Date.now() - p.at, 108e5)) : new Date(); }
export function scanTime(s) {
  const t = [...String(s).matchAll(/(\d{1,2})[:：](\d{2})/g)].filter(m => m[1] < 24 && m[2] < 60).pop(), d = [...String(s).matchAll(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]/g)].pop();
  if (!t && !d) return; const b = now(); d && (d[1] && b.setFullYear(+d[1]), b.setMonth(d[2] - 1, +d[3])); t && b.setHours(+t[1], +t[2]);
  D().plot = { t: +b, at: Date.now() }; saveD();
}
export const tpl = s => { const d = now(), c = C(); return String(s ?? '').replace(/\{\{(\w+)\}\}/g, (m, k) => ({ time: hm(d), date: `${d.getMonth() + 1}月${d.getDate()}日`, md: `${d.getMonth() + 1}/${d.getDate()}`, week: '日一二三四五六'[d.getDay()], weekEn: d.toLocaleDateString('en', { weekday: 'long' }), year: d.getFullYear(), user: c.name1, char: c.name2 })[k] ?? m); };

/* ---------- 图标 ---------- */
const sv = (b, a = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') => `<svg viewBox="0 0 24 24" ${a}>${b}</svg>`;
export const I = {
  back: sv('<path d="M15 5l-7 7 7 7"/>'), chev: sv('<path d="M6 9l6 6 6-6"/>'), plus: sv('<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v9M7.5 12h9"/>'),
  more: sv('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', 'fill="currentColor"'),
  smile: sv('<circle cx="12" cy="12" r="9.5"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>'),
  send: sv('<path d="M3.4 20.4l17.4-7.5c.8-.4.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.3-1.2 1l1.9 6.4 8 1-8 1-1.9 6.4c-.2.7.5 1.3 1.2 1z"/>', 'fill="currentColor"'),
  spark: sv('<path d="M12 2l2.2 6.3 6.3 2.2-6.3 2.2L12 19l-2.2-6.3-6.3-2.2 6.3-2.2zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>', 'fill="currentColor"'),
  cam: sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  chat: sv('<path d="M4 5h16v11H9l-5 4z"/>'), star: sv('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  book: sv('<rect x="4" y="3" width="15" height="18" rx="2.5"/><circle cx="11.5" cy="10" r="2.5"/><path d="M7.5 16.5c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6M21 7v3M21 13v3"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.4-6.5 8-6.5s7 2 8 6.5"/>'), wave: sv('<path d="M6 9v6M10 6v12M14 9v6M18 11v2"/>'),
};

/* ---------- 页面栈 / 底部弹层 / 提示 ---------- */
const stack = [];
const pgOf = t => { while (t && !t._pg) t = t.parentElement; return t?._pg; };
function mk(o, cls, box) {
  const el = document.createElement('section'); el.className = cls + ' ' + (o.cls || ''); el._pg = o; o.el = el;
  o.reb = () => { const b = $('.pg-b', el), sc = b.scrollTop; b.innerHTML = o.body(); b.scrollTop = sc; o.after?.(el); };
  o.re = () => { el.innerHTML = `<header class="pg-h">${o.noBack ? '' : `<b class="pg-back" data-a="back">${I.back}</b>`}<div class="pg-t">${typeof o.title == 'function' ? o.title() : o.title || ''}</div><div class="pg-r">${o.right?.() || ''}</div></header><div class="pg-b">${o.body()}</div>${o.foot ? `<footer class="pg-f">${o.foot()}</footer>` : ''}`; o.after?.(el); };
  o.re(); box.append(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); return o;
}
const close = o => { o.el.classList.remove('in'); o.onClose?.(); setTimeout(() => o.el.remove(), 330); };
export const page = o => (stack.push(o), mk(o, 'pg', ui.stack));
export const top = () => stack.at(-1);
export const back = () => { const o = stack.pop(); o && close(o); };
export const home = () => { while (stack.length) back(); };
export const sheet = o => { o.close = () => close(o); return mk(o, 'sheet', ui.sheets); };
export const openApp = id => { home(); APPS[id]?.open(); };
// 任务进度条：转圈 + 计时 + 取消，结束后显示成功/失败结果
export function task(title, fn) {
  const ac = new AbortController(), t0 = Date.now(), el = Object.assign(document.createElement('div'), { className: 'tk' });
  el.innerHTML = `<i class="spin"></i><span>${esc(title)}…</span><time>0s</time><b>取消</b>`; ui.tasks?.append(el);
  const iv = setInterval(() => $('time', el).textContent = ((Date.now() - t0) / 1e3 | 0) + 's', 1e3); $('b', el).onclick = e => { e.stopPropagation(); ac.abort(); };
  const fin = (ok, msg) => { clearInterval(iv); el.className = 'tk ' + (ok ? 'ok' : 'err'); el.innerHTML = `<i>${ok ? '✓' : '!'}</i><span>${esc(msg)}</span><time>${(Date.now() - t0) / 1e3 | 0}s</time>`; el.onclick = () => el.remove(); setTimeout(() => el.remove(), ok ? 4000 : 10000); ok || emit('badge'); };
  return fn(ac.signal).then(m => (fin(1, m || title + ' · 完成'), m), e => fin(0, ac.signal.aborted ? '已取消' : '失败：' + (e?.message || e)));
}
export const toast = s => { const t = Object.assign(document.createElement('div'), { className: 'stp-toast', textContent: s }); ui.scr?.append(t); setTimeout(() => t.remove(), 2400); };
export const menu = (items, title = '') => new Promise(res => {
  let done; const s = sheet({ title, noBack: 1, cls: 'mnu', body: () => items.map(([k, l, c = '']) => `<button class="mi ${c}" data-a="pick" data-x="${esc(k)}">${l}</button>`).join('') + '<button class="mi cancel" data-a="pick">取消</button>', acts: { pick: x => { done = 1; s.close(); res(x ?? null); } }, onClose: () => done || res(null) });
});
export const ok = async q => (await menu([['y', q, 'danger']])) == 'y';

/* ---------- 表单字段（data-k 自动双向绑定到 page.model() 或 S；$开头的键总是写入 S） ---------- */
export const btn = (a, l, x = '', c = '') => `<button class="btn ${c}" data-a="${a}" data-x="${esc(x)}">${l}</button>`;
export const fx = m => {
  const v = k => k[0] == '$' ? getP(S, k.slice(1)) : getP(m, k), row = (l, h) => `<label class="row"><span>${l}</span>${h}</label>`;
  return {
    tog: (k, l) => row(l, `<input type="checkbox" class="sw" data-k="${k}" ${v(k) ? 'checked' : ''}>`),
    inp: (k, l, t = 'text', ph = '') => row(l, `<input type="${t}" data-k="${k}" value="${esc(v(k))}" placeholder="${esc(ph)}">`),
    sel: (k, l, o) => row(l, `<select data-k="${k}">${o.map(([a, b]) => `<option value="${esc(a)}" ${a == (v(k) ?? '') ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`),
    seg: (k, o) => `<div class="seg">${o.map(([a, b]) => `<button data-a="seg" data-k2="${k}" data-x="${esc(a)}" class="${a == (v(k) ?? '') ? 'on' : ''}">${b}</button>`).join('')}</div>`,
    area: (k, l, ph = '') => `<label class="col"><span>${l}</span><textarea data-k="${k}" placeholder="${esc(ph)}">${esc(v(k))}</textarea></label>`,
    img: (k, l) => `<div class="row" data-a="img" data-x="${k}"><span>${l}</span><img class="thumb" src="${esc(v(k) || defAv(l))}"></div>`,
    multi: (k, l, o) => `<div class="col"><span>${l}</span><div class="chips">${o.map(([a, b]) => `<label class="chip"><input type="checkbox" data-km="${k}" value="${esc(a)}" ${(v(k) || []).includes(a) ? 'checked' : ''}>${esc(b)}</label>`).join('') || '<small>（空）</small>'}</div></div>`,
  };
};
export const form = (title, fields, obj = {}, ext = {}) => new Promise(res => {
  const m = structuredClone(obj), f = fx(m); let done;
  const s = sheet({ title, noBack: 1, model: () => m, save: () => {}, body: () => fields.map(([k, l, t = 'text', o]) => t == 'img' ? f.img(k, l) : t == 'area' ? f.area(k, l, o) : t == 'sel' ? f.sel(k, l, o) : t == 'tog' ? f.tog(k, l) : t == 'multi' ? f.multi(k, l, o) : t == 'pull' ? `<div class="row"><span>${l}</span><input data-k="${k}" value="${esc(m[k])}" placeholder="${esc(o || '')}"><b class="pull" data-a="pull" data-x="${k}">拉取</b></div>` : f.inp(k, l, t, o)).join('') + btn('ok', '保存', '', 'pri'), acts: { ...ext, ok: () => { done = 1; s.close(); res(m); } }, onClose: () => done || res(null) });
});
// 可折叠、长按拖拽排序的分组
export const sec = (pk, list) => { const o = S.ui.order[pk] || [], ix = k => o.indexOf(k) + 1 || 99; return `<div class="secs" data-secs="${pk}">${list.filter(Boolean).sort((a, b) => ix(a[0]) - ix(b[0])).map(([k, t, h]) => `<div class="sec ${S.ui.fold[pk + k] ? 'fold' : ''}" data-sec="${esc(k)}"><div class="sec-h" data-a="fold" data-x="${esc(pk + k)}" data-lp="secDrag"><b>${t}</b>${I.chev}</div><div class="sec-b">${h}</div></div>`).join('')}</div>`; };

/* ---------- 文件 / 图片 ---------- */
export const pickFile = (accept = 'image/*') => new Promise(r => { const i = Object.assign(document.createElement('input'), { type: 'file', accept }); i.onchange = () => r(i.files[0]); i.click(); });
export const readImg = (f, max = 400) => new Promise(r => {
  const fr = new FileReader(); fr.onload = () => {
    if (f.type == 'image/gif') return r(fr.result); const im = new Image();
    im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = Object.assign(document.createElement('canvas'), { width: im.width * s, height: im.height * s }); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/webp', .86)); }; im.src = fr.result;
  }; fr.readAsDataURL(f);
});
export async function pickImg(max) { const k = await menu([['f', '从相册上传'], ['u', '输入图片链接'], ['c', '清除', 'danger']]); if (k == 'f') { const f = await pickFile(); return f ? readImg(f, max) : null; } if (k == 'u') return (await form('图片链接', [['u', 'URL']]))?.u ?? null; return k == 'c' ? '' : null; }

/* ---------- 事件委托：data-a 点击 / data-lp 长按 / data-k 绑定 ---------- */
function set(pg, k, val) { const g = k[0] == '$', m = g || !pg?.model ? S : pg.model(); setP(m, g ? k.slice(1) : k, val); g || !pg?.model ? save() : (pg.save || saveD)(); pg?.onChange?.(k, val); emit('cfg', g ? k.slice(1) : k); }
export function bind(R) {
  let lp, lpd, swp = 0;
  // 右滑返回：任意页面横向右滑，跟手移动，松手超过30%宽度或快速滑动即返回上一级
  R.addEventListener('pointerdown', e => {
    const pg = top(); if (!pg || !pg.el.contains(e.target) || ui.sheets.querySelector('.sheet.in') || e.target.closest('input,textarea,select')) return;
    const x0 = e.clientX, y0 = e.clientY, t0 = Date.now(), w = pg.el.offsetWidth, sc = pg.el.getBoundingClientRect().width / w || 1; let on = 0, dx = 0;
    const end = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    const mv = ev => {
      dx = (ev.clientX - x0) / sc; const dy = (ev.clientY - y0) / sc;
      if (!on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return end(); if (dx < 12 || dx < Math.abs(dy) * 1.5) return; on = 1; pg.el.style.transition = 'none'; getSelection()?.removeAllRanges(); }
      pg.el.style.transform = `translateX(${Math.max(0, dx)}px)`;
    };
    const up = () => { end(); if (!on) return; swp = Date.now(); pg.el.style.transition = pg.el.style.transform = ''; (dx > w * .3 || dx / (Date.now() - t0) > .45) && back(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  const hit = (e, a) => { const t = e.target.closest?.(`[data-${a}]`); if (!t || !R.contains(t)) return; const pg = pgOf(t), n = t.dataset[a], f = pg?.acts?.[n] || G[n]; f && (e.stopPropagation(), f(t.dataset.x, t, e, pg)); };
  R.addEventListener('click', e => Date.now() - swp < 400 ? e.stopPropagation() : lpd ? (lpd = 0) : hit(e, 'a'));
  R.addEventListener('contextmenu', e => e.target.closest('input,textarea,.bub,pre') || e.preventDefault());
  R.addEventListener('pointerdown', e => {
    lpd = 0; const t = e.target.closest('[data-lp]'); if (!t) return; const x = e.clientX, y = e.clientY; clearTimeout(lp);
    const end = () => { clearTimeout(lp); removeEventListener('pointermove', mv); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); }, mv = ev => Math.hypot(ev.clientX - x, ev.clientY - y) > 8 && end();
    lp = setTimeout(() => { lpd = 1; navigator.vibrate?.(12); hit(e, 'lp'); }, 480); addEventListener('pointermove', mv); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  });
  R.addEventListener('change', e => {
    const t = e.target, pg = pgOf(t), k = t.dataset.k, km = t.dataset.km;
    k && set(pg, k, t.type == 'checkbox' ? t.checked : t.type == 'number' || t.type == 'range' ? +t.value : t.value);
    if (km) { const a = getP(km[0] == '$' || !pg?.model ? S : pg.model(), km.replace(/^\$/, '')) || []; set(pg, km, t.checked ? [...a, t.value] : a.filter(x => x != t.value)); }
  });
}
Object.assign(G, {
  back: (x, t, e, pg) => pg?.close ? pg.close() : back(), home,
  seg: (x, t, e, pg) => { set(pg, t.dataset.k2, x); pg.re(); },
  img: async (k, t, e, pg) => { const v = await pickImg(k.includes('bg') || k.includes('wall') || k.includes('cover') ? 1080 : 400); if (v != null) { set(pg, k, v); pg.re(); } },
  fold: (k, t) => { t.closest('.sec').classList.toggle('fold'); S.ui.fold[k] = !S.ui.fold[k]; save(); },
  secDrag: (x, t) => {
    const s = t.closest('.sec'), box = s.parentElement; s.classList.add('drg');
    const mv = e => box.insertBefore(s, [...box.children].find(c => { const r = c.getBoundingClientRect(); return c != s && e.clientY < r.top + r.height / 2; }) || null);
    addEventListener('pointermove', mv); addEventListener('pointerup', () => { removeEventListener('pointermove', mv); s.classList.remove('drg'); S.ui.order[box.dataset.secs] = [...box.children].map(c => c.dataset.sec); save(); }, { once: true });
  },
});

/* ---------- AI：聊天 / 生图 / TTS + 日志 ---------- */
export const LOG = (() => { try { return JSON.parse(localStorage.stp_log || '[]'); } catch { return []; } })();
export const saveLog = () => { try { localStorage.stp_log = JSON.stringify(LOG.slice(0, 50)); } catch { } };
export const prof = t => S.api[t].list.find(p => p.id == S.api[t].cur);
const tav = t => S.api[t].src == 'tavern';
// 每次调用都有超时（聊天默认30秒，可在设置改）并可被任务取消
async function call(t, desc, rq, fn, sg) {
  const p = prof(t), L = { t, desc, at: Date.now(), src: tav(t) ? '酒馆' : p?.name || '未配置', model: tav(t) ? '' : p?.model, req: String(rq).slice(0, 4000) };
  const ac = new AbortController(), lim = +S.tmo || 300, tm = setTimeout(() => ac.abort(Error(`超时（${lim}秒没有返回）`)), lim * 1e3);
  sg?.addEventListener('abort', () => ac.abort(Error('已取消')));
  const stop = new Promise((_, rj) => ac.signal.addEventListener('abort', () => rj(ac.signal.reason)));
  try { if (!tav(t) && !p) throw Error('请先在 设置 中添加并选择API配置'); const r = await Promise.race([fn(p, ac.signal), stop]); L.ok = 1; L.res = typeof r == 'string' ? r.slice(0, 4000) : '[ok]'; return r; }
  catch (e) { L.res = String(e?.message || e); throw e; } finally { clearTimeout(tm); L.ms = Date.now() - L.at; LOG.unshift(L); LOG.length > 100 && LOG.pop(); saveLog(); }
}
const base = u => { u = String(u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, ''); return /\/v\d[^/]*$/.test(u) ? u : u + '/v1'; };
const req = async (p, path, body, signal) => { const r = await fetch(base(p.url) + path, { signal, method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(p.key && { Authorization: 'Bearer ' + p.key }) }, body: body && JSON.stringify(body) }); if (!r.ok) throw Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); return r; };
export const llm = (sys, user, desc = '聊天', sg) => call('chat', desc, user, async (p, sig) => tav('chat') ? C().generateRaw({ systemPrompt: sys, prompt: user })
  : (await (await req(p, '/chat/completions', { model: p.model, temperature: +p.temp || 0.9, ...(p.fast && { reasoning_effort: 'low' }), messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }, sig)).json()).choices?.[0]?.message?.content || '', sg);
// 机器翻译：只给“我”写的文字用，走酒馆自带翻译接口（谷歌/必应同时发，谁先回用谁，8秒上限）；绝不调用聊天模型，不花 API 额度
export async function mt(text, to) {
  const c = C(), h = { ...(c.getRequestHeaders?.() || {}), 'Content-Type': 'application/json' }, ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8e3);
  const one = (u, lang) => fetch(u, { method: 'POST', headers: h, body: JSON.stringify({ text, lang }), signal: ac.signal }).then(async r => { const s = (await r.text()).trim(); if (!r.ok || !s || s[0] == '<' || s == text) throw 0; return s; });
  try { return await Promise.any([one('/api/translate/google', to), one('/api/translate/bing', { 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' }[to] || to)]); }
  catch { throw Error('机翻失败：酒馆翻译服务暂时不可用'); }
  finally { clearTimeout(tm); ac.abort(); }
}
export const json = s => { s = String(s ?? '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/```(json)?/g, ''); const i = s.search(/[[{]/), j = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']')); try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } };
export const slash = async s => { const c = C(), r = await (c.executeSlashCommandsWithOptions || c.executeSlashCommands)(s); return r?.pipe ?? r; };
export const genImg = prompt => call('img', '生图', prompt, async (p, sig) => { if (tav('img')) return slash('/sd quiet=true ' + prompt); const d = (await (await req(p, '/images/generations', { model: p.model, prompt, n: 1, size: p.size || '1024x1024' }, sig)).json()).data?.[0]; return d?.url || 'data:image/png;base64,' + d?.b64_json; });
export const tts = (text, voice) => call('tts', '语音', text, async p => { if (tav('tts')) return slash(`/speak ${voice ? `voice="${voice}" ` : ''}${text}`); new Audio(URL.createObjectURL(await (await req(p, '/audio/speech', { model: p.model, input: text, voice: voice || p.voice || 'alloy' })).blob())).play(); });
export const models = async p => { const j = await (await req(p, '/models')).json(); return (j.data || j.models || j).map?.(m => m.id || m.name || m) || []; };

/* ---------- 剧情上下文 / 世界书 ---------- */
const strip = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
export const recent = (n = S.ctxN) => (C().chat || []).filter(m => !m.is_system).slice(-n).map(m => `${m.name}: ${strip(m.mes)}`).join('\n');
const wim = () => import('../../../world-info.js').catch(() => ({}));
export const allBooks = async () => (await wim()).world_names || [];
export async function wiBooks() { if (!S.wi.follow) return S.wi.books; const m = await wim(), c = C(), ch = c.characters?.[c.characterId]; return [...new Set([...(m.selected_world_info || []), ch?.data?.extensions?.world].filter(Boolean))]; }
const BC = {};
export const loadBook = async n => { const c = C(), h = BC[n]; if (h && Date.now() - h.t < 6e4) return h.d; try { return (BC[n] = { t: Date.now(), d: c.loadWorldInfo ? await c.loadWorldInfo(n) : await (await fetch('/api/worldinfo/get', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ name: n }) })).json() }).d; } catch { return null; } };
export const entState = (b, e, ctx) => { const o = S.wi.ov[b + '/' + e.uid]; return o != null ? !!o : !e.disable && (e.constant || (e.key || []).some(k => k && ctx.includes(k))); };
export async function wiText(ctx) { const o = []; for (const b of await wiBooks()) for (const e of Object.values((await loadBook(b))?.entries || {})) entState(b, e, ctx) && o.push(e.content); return o.join('\n\n'); }
// 上下文长度预算（按约1分钟内生成调校）；lite=1 时跳过世界书、只取最近6条正文
const cut = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;
export async function sysCtx(lite) {
  const c = C(), ch = c.characters?.[c.characterId], d = D(), sub = (s, n = 1500) => cut((c.substituteParams?.(s || '') ?? s ?? '').trim(), n);
  const r = cut((C().chat || []).filter(m => !m.is_system).slice(lite ? -6 : -S.ctxN).map(m => `${m.name}: ${cut(strip(m.mes), 800)}`).join('\n'), lite ? 2500 : 10000);
  return `你是“小手机”模拟器，扮演手机里的所有联系人与内容，言行贴合人设、世界观与当前剧情，只输出要求的JSON，不要任何多余文字。
当前手机时间：${now().toLocaleString('zh-CN')}
【用户】${c.name1}（手机昵称：${d.me.nick || c.name1}）${sub(c.powerUserSettings?.persona_description)}
【主角色】${c.name2}\n${sub(ch?.description, lite ? 1200 : 4000)}\n${sub(ch?.personality, 800)}
${lite ? '' : `【世界书】\n${sub(await wiText(r + d.chats.map(rn).join(' ')), 8000)}`}
【正文剧情·最近${S.ctxN}条】\n${r}
【手机联系人】${d.chats.map(x => x.type == 'g' ? `群「${x.name}」` : `${rn(x)}(网名${x.nick || '-'})`).join('、') || '无'}`;
}

/* ---------- 正文联动：把标记的手机聊天注入提示词 ---------- */
export function syncInject() {
  const c = C(); let t = '';
  if (S.mode == 'linked') t = D().chats.map(ch => { const ms = ch.msgs.filter(m => m.inj || ch.cfg?.inj).slice(-15); return ms.length ? `[${ch.type == 'g' ? '群聊「' + ch.name + '」' : '与' + rn(ch) + '的私聊'}]\n` + ms.map(m => `${m.f == 'me' ? meObj().nick : rn(byId(m.f))}: ${brief(m)}`).join('\n') : ''; }).filter(Boolean).join('\n');
  c.setExtensionPrompt?.('st_phone', t && `<手机聊天记录>\n以下是${c.name1}手机里的聊天，相关角色知道这些内容：\n${t}\n</手机聊天记录>`, 1, 2, false, 0);
}

/* ---------- 消息弹窗 ---------- */
export function notify(ch, m) {
  emit('badge'); if (!S.notify) return;
  const b = Object.assign(document.createElement('div'), { className: 'stp-ban' });
  b.innerHTML = `<img src="${esc(avOf(ch))}"><div><b>${esc(nm(ch))}</b><p>${esc((ch.type == 'g' ? nm(byId(m.f)) + '：' : '') + brief(m))}</p></div><small>${hm(now())}</small>`;
  b.onclick = () => { b.remove(); emit('open-chat', ch.id); }; document.body.append(b);
  setTimeout(() => b.classList.add('in'), 30); setTimeout(() => { b.classList.remove('in'); setTimeout(() => b.remove(), 500); }, 5000);
}
