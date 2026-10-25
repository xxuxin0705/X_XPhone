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
  api: { chat: api(), img: api({ auto: false }), tts: api() }, mode: 'linked', time: 'story', scan: false, inline: true, notify: true,
  kw: '(发|回)了?[一几]?[条个句]?(消息|微信|短信|信息|语音|私信)|拉.{0,3}群|建.{0,2}群|群聊|群里|加.{0,3}(好友|微信|QQ|联系方式)|朋友圈|空间|发.{0,2}动态|转账|红包|拍了拍|手机.{0,2}(震|响|亮)',
  lock: { on: false, pw: false, type: 'pin', pin: '', wp: 'snownight', video: '', text: '' }, media: {},
  stk: { see: true, v: 3, packs: ['f-pets', 'f-face', 'f-love', 'qq', 'weibo', 'tieba', 'hoyoverse-hi3'], mine: [], src: 'sogou', id: '', key: '', gk: '', cute: true, auto: true, recent: [] },
  ctxN: 15, tmo: 300, wi: { follow: true, books: [], ov: {} }, show: 'float', scale: 1, fz: .92, pos: {}, style: 'wx',
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
export const initS = () => { S = merge(C().extensionSettings.st_phone ??= {}, DEF); if ((S.ver | 0) < 2) { S.scan = false; S.ver = 2; save(); } return S; }; // v2：剧情自动同步改为默认关闭（老用户也关掉一次）
export const save = () => C().saveSettingsDebounced();
const BLANK = { chats: [], posts: [], me: { nick: '', sign: '', av: '', cover: '', wallet: 520 }, plot: null };
export const D = () => merge((C().chatMetadata ??= {}).st_phone ??= {}, BLANK);
let gct; export const saveD = () => { const c = C(); (c.saveMetadataDebounced || c.saveMetadata)?.call(c); syncInject(); clearTimeout(gct); gct = setTimeout(() => gc(), 3e3); };

/* ---------- 名字 / 头像 ---------- */
export const nm = c => c ? c.remark || c.nick || c.real || c.name || '?' : '?';
export const rn = c => c?.real || c?.nick || c?.name || '?';
const PAL = ['#a8d8b9', '#f6c1cc', '#b5c7f2', '#f7d79c', '#c9b6f2', '#9ed9e0', '#f4b9a0'];
export const defAv = n => { n = String(n || '?'); return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="${PAL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length]}"/><text x="40" y="53" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">${esc([...n][0])}</text></svg>`); };
export const meObj = () => { const d = D().me; return { ...d, id: 'me', nick: d.nick || C().name1, real: d.real || C().name1 }; }; // nick＝网名，real＝真实姓名（默认酒馆里的名字）
export const byId = id => D().chats.find(c => c.id == id);
export function avOf(c) { if (!c) return defAv('?'); if (c.av) return c.av; const x = C(), ch = x.characters?.[x.characterId]; return (ch && c.real && c.real == x.name2 && x.getThumbnailUrl?.('avatar', ch.avatar)) || defAv(nm(c)); }
export const brief = m => m.t == 'rec' ? '[聊天记录]' + (m.c || '') : ({ sticker: '[表情]', img: '[图片]', voice: '[语音]', transfer: `[转账¥${m.amt}]` }[m.t] || '') + (m.c || '');
// 给模型看的：表情包要写清楚是什么意思（名字 + 说明 + 哪一组），不然对方看不懂你发了个啥
export const say = m => { if (m.t == 'rec') return `[转发了一段聊天记录「${m.c}」：${(m.rec || []).map(r => `${r.n}: ${r.c}`).join(' / ')}]`; if (m.t != 'sticker') return brief(m); let n = m.c && m.c != '表情' ? m.c : '', d = m.d && m.d != n ? m.d : '';
  if (!n && !d && m.img) { const x = S.stk?.mine?.flatMap(p => p.items).find(x => x.img == m.img) || S.assets.sticker.find(x => x.img == m.img); x && (n = x.l || x.name || '', d = x.d && x.d != n ? x.d : ''); } // 之前发的、后来才起名字的表情
  return `[表情包：${[n, d && `（${d}）`].join('') || '一个表情'}${m.pk ? `，「${m.pk}」里的` : ''}]`; };

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
  o.reb = () => { const b = $('.pg-b', el), sc = b.scrollTop; o.nb = b.scrollHeight - sc - b.clientHeight < 60; b.innerHTML = o.body(); b.scrollTop = sc; o.after?.(el); o.nb = null; }; // nb：重画前是不是停在最底下
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
// 失败提示：红色条一直留着，点 × 才关，可直接跳到调用日志；手机收起时同时用酒馆右上角弹窗提醒
const errBar = (el, msg, sec) => {
  el.className = 'tk err'; el.innerHTML = `<i>!</i><span>${esc(msg)}</span>${sec != null ? `<time>${sec}s</time>` : ''}<b data-lg>日志</b><b data-x>×</b>`;
  $('[data-lg]', el).onclick = e => { e.stopPropagation(); el.remove(); ui.root?.classList.add('on'); G.openLogs?.(); };
  $('[data-x]', el).onclick = e => { e.stopPropagation(); el.remove(); };
  emit('badge'); ui.root?.classList.contains('on') || globalThis.toastr?.error(msg, '小手机', { timeOut: 15e3, extendedTimeOut: 1e4 });
};
export const fail = msg => {
  const same = [...(ui.tasks?.children || [])].find(x => x.classList.contains('err') && x.dataset.m == msg);
  if (same) { same.dataset.n = (+same.dataset.n || 1) + 1; $('span', same).textContent = `${msg} ×${same.dataset.n}`; return; }
  const el = Object.assign(document.createElement('div'), { className: 'tk err' }); el.dataset.m = msg; ui.tasks?.append(el); errBar(el, msg);
};
// 任务进度条：转圈 + 计时 + 进度文字 + 取消；成功4秒后消失，失败一直保留直到手动关闭
export function task(title, fn) {
  const ac = new AbortController(), t0 = Date.now(), el = Object.assign(document.createElement('div'), { className: 'tk' });
  el.innerHTML = `<i class="spin"></i><span>${esc(title)}…</span><time>0s</time><b>取消</b>`; ui.tasks?.append(el);
  const iv = setInterval(() => $('time', el).textContent = ((Date.now() - t0) / 1e3 | 0) + 's', 1e3); $('b', el).onclick = e => { e.stopPropagation(); ac.abort(); };
  const prog = s => { const sp = !el.classList.contains('err') && $('span', el); sp && (sp.textContent = s ? `${title} · ${s}` : title + '…'); };
  const fin = (ok, msg) => {
    clearInterval(iv); const sec = (Date.now() - t0) / 1e3 | 0;
    if (!ok) return errBar(el, msg, sec);
    el.className = 'tk ' + (ok == 2 ? 'cc' : 'ok'); el.innerHTML = `<i>${ok == 2 ? '–' : '✓'}</i><span>${esc(msg)}</span><time>${sec}s</time>`; el.onclick = () => el.remove(); setTimeout(() => el.remove(), 4000);
  };
  return fn(ac.signal, prog).then(m => (fin(1, m || title + ' · 完成'), m), e => ac.signal.aborted ? fin(2, `${title} · 已取消`) : fin(0, `${title}失败：${e?.message || e}`));
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
// fields 可以是数组，也可以是 m => 数组（字段随填写内容变化，如切换渠道）；chg(k, v, m, s) 在任意字段改动后调用
export const form = (title, fields, obj = {}, ext = {}, chg) => new Promise(res => {
  const m = structuredClone(obj), f = fx(m); let done;
  const s = sheet({ title, noBack: 1, model: () => m, save: () => {}, onChange: (k, v) => chg?.(k, v, m, s), body: () => (typeof fields == 'function' ? fields(m) : fields).map(([k, l, t = 'text', o]) => t == 'tip' ? `<p class="tip">${l}</p>` : t == 'img' ? f.img(k, l) : t == 'area' ? f.area(k, l, o) : t == 'sel' ? f.sel(k, l, o) : t == 'tog' ? f.tog(k, l) : t == 'multi' ? f.multi(k, l, o) : t == 'pull' ? `<div class="row"><span>${l}</span><input data-k="${k}" value="${esc(m[k])}" placeholder="${esc(o || '')}"><b class="pull" data-a="pull" data-x="${k}">拉取</b></div>` : f.inp(k, l, t, o)).join('') + btn('ok', '保存', '', 'pri'), acts: { ...ext, ok: () => { done = 1; s.close(); res(m); drop(obj); } }, onClose: () => done || (drop(m), res(null)) });
});
// 可折叠、长按拖拽排序的分组
export const sec = (pk, list) => { const o = S.ui.order[pk] || [], ix = k => o.indexOf(k) + 1 || 99; return `<div class="secs" data-secs="${pk}">${list.filter(Boolean).sort((a, b) => ix(a[0]) - ix(b[0])).map(([k, t, h]) => `<div class="sec ${S.ui.fold[pk + k] ? 'fold' : ''}" data-sec="${esc(k)}"><div class="sec-h" data-a="fold" data-x="${esc(pk + k)}" data-lp="secDrag"><b>${t}</b>${I.chev}</div><div class="sec-b">${h}</div></div>`).join('')}</div>`; };

/* ---------- 文件 / 图片 ---------- */
export const pickFile = (accept = 'image/*') => new Promise(r => { const i = Object.assign(document.createElement('input'), { type: 'file', accept }); i.onchange = () => r(i.files[0]); i.click(); });
export const readImg = (f, max = 400) => new Promise(r => {
  const fr = new FileReader(); fr.onload = () => {
    if (f.type == 'image/gif') return r(fr.result); const im = new Image();
    im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = Object.assign(document.createElement('canvas'), { width: im.width * s, height: im.height * s }); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/webp', .86)); }; im.onerror = () => r(fr.result); im.src = fr.result;
  }; fr.readAsDataURL(f);
});
export async function pickImg(max, kind = 'img') { const k = await menu([['f', '从相册上传'], ['u', '输入图片链接'], ['c', '清除', 'danger']]); if (k == 'f') { const f = await pickFile(); return f ? putMedia(await readImg(f, max), kind) : null; } if (k == 'u') return (await form('图片链接', [['u', 'URL']]))?.u ?? null; return k == 'c' ? '' : null; }

/* ---------- 媒体文件：上传的图片 / 视频统一存进酒馆 data/<用户>/user/images/XPhone/ 文件夹，不再塞进聊天数据 ----------
   删除跟随：S.media 记着「哪个文件被哪些聊天用到」（酒馆建分支会复制手机数据，所以不能只看当前聊天），
   某个文件在设置里、当前聊天里、其它聊天里都不再被用到时，才会把文件删掉。 */
export const MDIR = 'XPhone';
const MRE = /\/user\/images\/XPhone\/[\w.\-]+/g, IRE = /idb:[\w-]+/g;
const MIME = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const toB64 = b => new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.onerror = () => j(f.error); f.readAsDataURL(b); });
const jh = () => ({ ...C().getRequestHeaders?.(), 'Content-Type': 'application/json' });
const idb = () => new Promise((r, j) => { const q = indexedDB.open('st_phone_media', 1); q.onupgradeneeded = () => q.result.createObjectStore('f'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
const idbDo = async (mode, f) => { const db = await idb(); return new Promise((r, j) => { const tx = db.transaction('f', mode), q = f(tx.objectStore('f')); tx.oncomplete = () => r(q?.result); tx.onerror = () => j(tx.error); }); };
let warned;
export async function putMedia(src, kind = 'img') {
  if (!src || typeof src == 'string' && !src.startsWith('data:')) return src; // 网络链接原样保留
  const b = typeof src == 'string' ? await (await fetch(src)).blob() : src, fmt = MIME[b.type] || (b.type.startsWith('video') ? 'mp4' : 'png');
  try {
    const r = await fetch('/api/images/upload', { method: 'POST', headers: jh(), body: JSON.stringify({ image: await toB64(b), format: fmt, ch_name: MDIR, filename: `${kind}_${uid()}` }) });
    if (!r.ok) throw Error('HTTP ' + r.status); const u = (await r.json()).path; if (!u) throw Error('no path');
    return u.startsWith('/') ? u : '/' + u;
  } catch {
    if (b.type.startsWith('video')) { const k = 'idb:' + uid(); await idbDo('readwrite', st => st.put(b, k)); return k; } // 视频太大，不进设置：存浏览器本地数据库
    warned || (warned = 1, toast('当前酒馆不支持上传文件，图片暂存在数据里'));
    return typeof src == 'string' ? src : `data:${b.type};base64,${await toB64(b)}`;
  }
}
// 视频等存在本地数据库里的，用之前换成可播放的地址
export const mediaSrc = async u => typeof u == 'string' && u.startsWith('idb:') ? URL.createObjectURL(await idbDo('readonly', st => st.get(u))) : u;
export const mediaIn = x => { const s = typeof x == 'string' ? x : JSON.stringify(x ?? ''); return [...new Set([...(s.match(MRE) || []), ...(s.match(IRE) || [])])]; };
const rmMedia = u => u.startsWith('idb:') ? idbDo('readwrite', st => st.delete(u)).catch(() => {}) : fetch('/api/images/delete', { method: 'POST', headers: jh(), body: JSON.stringify({ path: u }) }).catch(() => {});
const ck = () => { const c = C(); return String(c.getCurrentChatId?.() ?? c.chatId ?? ''); };
// 记录当前聊天在用的文件，并删掉已经没人用的（cands：刚被替换 / 删除的文件）
export function gc(cands = new Set(), gone) {
  const R = S.media ||= {}, k = ck(), used = new Set(mediaIn(C().chatMetadata?.st_phone));
  if (gone) for (const u in R) R[u].includes(gone) && (R[u] = R[u].filter(x => x != gone), cands.add(u)); // 整个聊天被删
  if (k) { used.forEach(u => (R[u] ||= []).includes(k) || R[u].push(k)); for (const u in R) if (!used.has(u) && R[u].includes(k)) { R[u] = R[u].filter(x => x != k); cands.add(u); } }
  if (cands.size) { const { media, ...rest } = S, gs = JSON.stringify(rest); for (const u of cands) { if (used.has(u) || R[u]?.length || gs.includes(u)) continue; delete R[u]; rmMedia(u); } }
  for (const u in R) R[u].length || used.has(u) || delete R[u];
  save();
}
// 某个值被删除 / 替换后调用：稍等数据改完再检查，仍有地方在用就保留
export const drop = x => { const us = mediaIn(x); us.length && setTimeout(() => gc(new Set(us)), 1500); };
// 把旧版直接存在数据里的图片（data:）搬进文件夹
export async function migrateMedia(prog) {
  let n = 0; const walk = async o => { for (const k in o) { const v = o[k]; if (typeof v == 'string' && /^data:(image|video)\//.test(v) && v.length > 2048) { const u = await putMedia(v, 'old'); u != v && (o[k] = u, n++, prog?.(n)); } else if (v && typeof v == 'object') await walk(v); } };
  await walk(S); await walk(D()); save(); saveD(); return n;
}

/* ---------- 事件委托：data-a 点击 / data-lp 长按 / data-k 绑定 ---------- */
function set(pg, k, val) { const g = k[0] == '$', m = g || !pg?.model ? S : pg.model(), old = getP(m, g ? k.slice(1) : k); setP(m, g ? k.slice(1) : k, val); old !== val && drop(old); g || !pg?.model ? save() : (pg.save || saveD)(); pg?.onChange?.(k, val); emit('cfg', g ? k.slice(1) : k); }
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
  R.addEventListener('contextmenu', e => e.preventDefault()); // 长按图片不要弹浏览器自己的「保存图片 / 大图」
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
// 日志在调用「开始」时就写入（run=1 进行中），流式返回时实时更新内容，结束后原地改成成功 / 失败
export const LOG = (() => { try { return JSON.parse(localStorage.stp_log || '[]'); } catch { return []; } })();
LOG.forEach(l => l.run && (l.run = 0, l.res = (l.res ? l.res + '\n\n' : '') + '✗ 页面刷新，调用中断'));
export const saveLog = () => { try { localStorage.stp_log = JSON.stringify(LOG.slice(0, 50)); } catch { } };
const RUN = new Map(); let lt = 0, lq;
const logUp = now => { clearTimeout(lq); const go = () => { lt = Date.now(); emit('log'); }; now || Date.now() - lt > 700 ? go() : (lq = setTimeout(go, 700)); };
export const stopCall = id => RUN.get(id)?.abort(Error('已手动中止'));
// 聊天模型：配置列表里选一个；生图 / 语音：选一个服务商，每个服务商各存一份设置（切换服务商不丢之前填的）
export const prof = t => {
  const a = S.api[t]; if (t == 'chat') return a.list.find(p => p.id == a.cur);
  if (!a.cfg) { // 旧版「渠道列表」迁移：每个服务商取一份（正在用的优先）
    a.cfg = {}; const L = a.list || [], cur = L.find(p => p.id == a.cur);
    [cur, ...L].forEach(p => { const k = p?.prov || 'openai'; p && !a.cfg[k] && (a.cfg[k] = { ...structuredClone(PDEF[t][k] || {}), ...p }); });
    a.pv ||= cur ? cur.prov || 'openai' : t == 'tts' ? 'mm' : 'nai';
  }
  if (t == 'tts' && !(a.v >= 2)) ttsMig(a);
  const P = t == 'tts' ? TTSP : IMGP; a.pv = P.some(x => x[0] == a.pv) ? a.pv : P[0][0];
  const c = a.cfg[a.pv] ||= structuredClone(PDEF[t][a.pv] || {}); c.prov = a.pv; c.name = P.find(x => x[0] == a.pv)[1]; return c;
};
// 语音设置升级：以前帮你预填的男 / 女兜底音色清空；官方服务商里填过的中转地址挪到「第三方」（不然换成官方地址就连不上了）
const OLDV = ['male-qn-qingse', 'female-shaonv', 'onyx', 'nova', 'JBFqnCBsd6RMkjVDRZzb', 'EXAVITQu4vr4xnSDxMaL', '苏打', '冰糖', 'zh_female_xiaohe_uranus_bigtts'];
function ttsMig(a) {
  a.v = 2; a.fb ??= true;
  for (const [k, c] of Object.entries(a.cfg || {})) {
    OLDV.includes(c.vm) && (c.vm = ''); OLDV.includes(c.vf) && (c.vf = '');
    const u = trim(c.url || ''), off = TURL[k] && trim(TURL[k]);
    if (off && u && u != off && !(k == 'fish' && u == 'https://api.fish.audio/v1') && !a.cfg.third?.url) {
      a.cfg.third = { ...c, prov: 'third', fmt: k == 'mmi' ? 'mm' : k, url: u, name: '第三方' }; a.pv == k && (a.pv = 'third');
    }
    off && delete c.url;
  }
}
const tav = t => S.api[t].src == 'tavern';
// 超时 = 连续 N 秒没收到任何数据（流式输出每收到一段就重新计时），可在设置改；任务条 / 日志里都能随时取消
async function call(t, desc, rq, fn, sg, pO, raw) {
  const T = raw ?? (!pO && tav(t)), p = pO || prof(t), L = { id: uid(), t, desc, at: Date.now(), run: 1, src: T ? '酒馆' : p?.name || '未配置', model: T ? '' : p?.model || p?.voice || '', req: String(rq).slice(0, 4000), res: '' };
  LOG.unshift(L); LOG.length > 100 && LOG.pop(); saveLog(); logUp(1);
  const ac = new AbortController(), lim = +S.tmo || 300; let tm; RUN.set(L.id, ac);
  const kick = () => { clearTimeout(tm); tm = setTimeout(() => ac.abort(Error(`超时（${lim}秒没有收到任何返回）`)), lim * 1e3); }; kick();
  const off = () => ac.abort(Error('已取消')); sg?.aborted ? off() : sg?.addEventListener('abort', off);
  const stop = new Promise((_, rj) => ac.signal.aborted ? rj(ac.signal.reason) : ac.signal.addEventListener('abort', () => rj(ac.signal.reason)));
  const cx = { kick, part: (s, th) => { kick(); L.res = String(s).slice(-4000); L.th = th || 0; logUp(); } };
  try {
    if (!T && !p) throw Error('请先在 设置 中添加并选择配置');
    const r = await Promise.race([fn(p, ac.signal, cx), stop]); L.ok = 1;
    L.res = typeof r == 'string' ? (r.startsWith('data:') ? '[图片数据]' : r.slice(0, 4000)) : r == null ? '[完成]' : '[ok]'; return r;
  } catch (e) { const m = String(e?.message || e); L.res = (L.res ? L.res + '\n\n' : '') + '✗ ' + m; throw e instanceof Error ? e : Error(m); }
  finally { clearTimeout(tm); sg?.removeEventListener('abort', off); RUN.delete(L.id); L.run = 0; L.ms = Date.now() - L.at; saveLog(); logUp(1); }
}

/* ---------- 网络 ---------- */
const trim = u => String(u || '').trim().replace(/\/+$/, '');
const base = u => { u = trim(u).replace(/\/chat\/completions$/, ''); return /\/v\d[^/]*$/.test(u) ? u : u + '/v1'; };
const chk = async r => { if (!r.ok) throw Error(`HTTP ${r.status} ${(await r.text()).slice(0, 300)}`); return r; };
// 直连失败（多半是跨域被拦）时自动改走酒馆自带的 CORS 代理 /proxy/（config.yaml 里 enableCorsProxy: true）
async function xf(url, o = {}) {
  try { return await fetch(url, o); }
  catch (e) {
    if (o.signal?.aborted || !/^https?:/i.test(url) || url.startsWith(location.origin)) throw e;
    let r = null; try { r = await fetch('/proxy/' + url, { ...o, headers: { ...C().getRequestHeaders?.(), ...o.headers } }); } catch (e2) { if (o.signal?.aborted) throw e2; }
    if (r?.status == 404) { const s = await r.clone().text(); (/proxy is disabled|Cannot (GET|POST)/i.test(s) || s.trim().startsWith('<')) && (r = null); }
    if (!r) throw Error(`连不上 ${new URL(url).host}（网络不通或被跨域拦截）。本地服务请开启跨域；在线接口可在酒馆 config.yaml 设 enableCorsProxy: true 后重启酒馆`);
    return r;
  }
}
const post = (url, body, h, signal) => xf(url, { signal, method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) }).then(chk);
const req = (p, path, body, signal) => xf(base(p.url) + path, { signal, method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(p.key && { Authorization: 'Bearer ' + p.key }) }, body: body && JSON.stringify(body) }).then(chk);

/* ---------- 聊天模型（默认流式：边收边显示，不会因为整体太慢被判超时） ---------- */
// 关思考：GLM / Qwen 用各自的开关，其它模型用 reasoning_effort；接口不认就自动去掉重发
const noThink = m => /glm/i.test(m) ? { thinking: { type: 'disabled' } } : /qwen|qwq/i.test(m) ? { enable_thinking: false } : { reasoning_effort: 'low' };
const pick = j => j.choices?.[0]?.message?.content ?? j.choices?.[0]?.text ?? '';
async function readAI(r, cx, o) {
  const rd = r.body?.getReader?.(); if (!rd) return pick(await r.json());
  const dec = new TextDecoder(); let buf = '', all = '', out = '', th = 0, sse = 0;
  const line = l => {
    l = l.trim(); if (!l.startsWith('data:')) return; sse = 1; const d = l.slice(5).trim(); if (!d || d == '[DONE]') return;
    let j; try { j = JSON.parse(d); } catch { return; } if (j.error) throw Error(j.error.message || JSON.stringify(j.error));
    const c = j.choices?.[0], dl = c?.delta || c?.message || {}, rs = dl.reasoning_content || dl.reasoning || '';
    rs && (th += rs.length, o.onThink?.(th, rs)); dl.content && (out += dl.content, o.onText?.(out)); cx.part(out || `（模型正在思考，已经想了 ${th} 字。这是模型内部的思考过程，不是返回结果，也不会加进手机；想完才开始输出）`, th);
  };
  for (;;) {
    const { done, value } = await rd.read(); if (done) break; cx.kick();
    const s = dec.decode(value, { stream: true }); all.length < 4e6 && (all += s); buf += s;
    let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  line(buf + dec.decode()); if (sse) return out;
  let j; try { j = JSON.parse(all); } catch { throw Error('返回格式无法识别：' + all.slice(0, 200)); }
  if (j.error) throw Error(j.error.message || JSON.stringify(j.error)); return pick(j);
}
/* ---------- 酒馆里保存的「连接配置」（API 连接页顶部的下拉框；靠酒馆自带的连接管理器调用，不切换正文用的连接） ---------- */
export const stProfiles = () => { try { const c = C(), R = c.ConnectionManagerRequestService, es = c.extensionSettings || c.extension_settings;
  if (!R || es?.disabledExtensions?.includes('connection-manager')) return null;
  return (es?.connectionManager?.profiles || []).filter(p => { try { return R.isProfileSupported ? R.isProfileSupported(p) : !!p.api; } catch { return false; } }); } catch { return null; } };
export const stProf = id => id && stProfiles()?.find(p => p.id == id) || null;
export const stCurName = () => { try { const es = C().extensionSettings, id = es?.connectionManager?.selectedProfile; return id && es.connectionManager.profiles.find(p => p.id == id)?.name || ''; } catch { return ''; } };
async function stReq(id, sys, user, sig, cx, o) {
  const R = C().ConnectionManagerRequestService; if (!R) throw Error('这个版本的酒馆不支持按连接配置调用，请更新酒馆，或改回「跟随酒馆当前连接」');
  const m = [{ role: 'system', content: sys }, { role: 'user', content: user }]; let r;
  try { r = await R.sendRequest(id, R.constructPrompt ? R.constructPrompt(m, id) : m, 8192, { stream: true, signal: sig }); }
  catch (e) { if (sig?.aborted) throw sig.reason || e; throw Error(String(e?.cause?.message || e?.message || e)); }
  if (typeof r != 'function') return r?.content ?? (typeof r == 'string' ? r : '');
  let out = '';
  for await (const v of r()) { out = v?.text || ''; const th = v?.state?.reasoning?.length || 0; th && o.onThink?.(th); out && o.onText?.(out); cx.part(out || `（模型正在思考，已经想了 ${th} 字。这是模型内部的思考过程，不是返回结果；想完才开始输出）`, th); }
  return out;
}
// 本次调用走哪条线：生成用模型（aux）> 聊天模型；酒馆模式下可指定某个连接配置，不指定就用酒馆当前连接
const route = aux => {
  const a = S.api.chat, x = aux && a.aux || '';
  if (x.startsWith('st:')) { const sp = stProf(x.slice(3)); if (sp) return { st: sp }; }
  else if (x) { const cp = a.list.find(p => p.id == x); if (cp) return { p: cp }; }
  if (a.src == 'tavern') { const sp = stProf(a.stp); return sp ? { st: sp } : { raw: 1 }; }
  return { p: prof('chat') };
};
// o.fast 本次强制低思考；o.aux 用「生成用模型」（生成联系人 / 剧情同步等，没设就用聊天模型）；o.onText(已收到的全文) / o.onThink(思考字数) 流式回调
export const auxProf = () => { const r = route(1); return r.p && r.p.id == S.api.chat.aux ? r.p : null; };
// 识图：把图片跟这次请求一起发给模型（不额外调用），模型看图理解意思。o.images = [图片地址…]
// 先缩小成 320px 的 jpg（省 token）；模型或接口不支持看图就自动退回纯文字，并记住这条线以后不再带图
export const noVision = new Set(), imgC = new Map();
export async function getBlob(u) {
  if (u instanceof Blob) return u;
  if (/^(data|blob):/.test(u) || u.startsWith('/')) return (await fetch(u)).blob();
  try { const r = await fetch(u, { referrerPolicy: 'no-referrer' }); if (r.ok) return r.blob(); } catch { }
  const tf = globalThis.__TAURI__?.http?.fetch; if (tf) try { const r = await tf(u, { method: 'GET' }); if (r.ok) return r.blob(); } catch { }
  const r = await fetch('/proxy/' + u); if (!r.ok) throw Error('图片取不到'); return r.blob();
}
export const imgData = u => imgC.get(u) || (imgC.set(u, (async () => {
  const b = await getBlob(u), bm = await createImageBitmap(b).catch(() => new Promise((res, rej) => { const i = new Image(), o = URL.createObjectURL(b); i.onload = () => res(i); i.onerror = () => rej(Error('图片打不开')); i.src = o; })), k = Math.min(1, 320 / Math.max(bm.width, bm.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(bm.width * k)), height: Math.max(1, Math.round(bm.height * k)) }), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .82);
})().catch(e => { imgC.delete(u); throw e; })), imgC.get(u));
const withImgs = (user, imgs) => [{ type: 'text', text: user }, ...imgs.map(url => ({ type: 'image_url', image_url: { url } }))];
export const llm = (sys, user, desc = '聊天', sg, o = {}) => { const R = route(o.aux); return call('chat', desc, user, async (p, sig, cx) => {
  const key = R.raw ? 'raw' : R.st ? 'st:' + R.st.id : 'p:' + p.id + ':' + p.model;
  const imgs = o.images?.length && !noVision.has(key) ? (await Promise.all(o.images.map(u => imgData(u).catch(() => null)))).filter(Boolean) : [];
  const once = async img => {
    if (R.raw) return img.length ? C().generateRaw({ systemPrompt: sys, prompt: [{ role: 'user', content: withImgs(user, img) }] }) : C().generateRaw({ systemPrompt: sys, prompt: user });
    if (R.st) return stReq(R.st.id, sys, img.length ? withImgs(user, img) : user, sig, cx, o);
    const body = { model: p.model, temperature: +p.temp || 0.9, messages: [{ role: 'system', content: sys }, { role: 'user', content: img.length ? withImgs(user, img) : user }], ...(!p.nostream && { stream: true }) };
    const x = p.fast || o.fast ? noThink(p.model) : null; let r;
    try { r = await req(p, '/chat/completions', { ...body, ...x }, sig); }
    catch (e) { if (!x || !/HTTP (400|422)/.test(e.message)) throw e; r = await req(p, '/chat/completions', body, sig); }
    return readAI(r, cx, o);
  };
  if (!imgs.length) return once([]);
  try { const out = await once(imgs); if (out || out === '') return out; throw Error('空回复'); }
  catch (e) { if (sig?.aborted) throw e; noVision.add(key); cx.part?.('（这个模型看不了图，改成只发文字）', 0); return once([]); } // 不支持看图：去掉图片再发一次
}, sg, R.raw ? null : R.st ? { name: '酒馆 · ' + (R.st.name || '连接配置'), model: R.st.model || '', _st: 1 } : R.p, !!R.raw); };
// 机器翻译：只给“我”写的文字用，走酒馆自带翻译接口（谷歌/必应同时发，谁先回用谁，8秒上限）；绝不调用聊天模型，不花 API 额度
// 机翻：只用酒馆自带的翻译接口（不调用聊天模型）。先谷歌，不行再必应；不支持的接口记下来以后不再请求，
// 请求时暂时静音酒馆的红色「后端错误」弹窗（TauriTavern 没有必应接口，会弹 Unsupported translate provider）
const MTP = [['google', l => l], ['bing', l => ({ 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' }[l] || l)]], mtBad = new Set();
const quiet = async f => { const t = globalThis.toastr, e = t?.error, w = t?.warning; if (t) t.error = t.warning = () => {}; try { return await f(); } finally { if (t) { t.error = e; t.warning = w; } } };
export async function mt(text, to) {
  text = String(text ?? ''); if (!/[\p{L}]/u.test(text)) return text; // 只有符号、数字、表情的不用翻（比如「??」）
  const c = C(), h = { ...(c.getRequestHeaders?.() || {}), 'Content-Type': 'application/json' };
  for (const [p, lf] of MTP) {
    if (mtBad.has(p)) continue;
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8e3);
    try {
      const r = await quiet(() => fetch('/api/translate/' + p, { method: 'POST', headers: h, body: JSON.stringify({ text, lang: lf(to) }), signal: ac.signal })), s = (await r.text()).trim();
      if (!r.ok) { (r.status == 404 || /unsupported|not found/i.test(s)) && mtBad.add(p); continue; }
      if (s && s[0] != '<') return s; // 翻出来和原文一样也算成功（专有名词、语气词）
    } catch { } finally { clearTimeout(tm); }
  }
  throw Error('机翻暂时不可用');
}
export const json = s => { s = String(s ?? '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/```(json)?/g, ''); const i = s.search(/[[{]/), j = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']')); try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } };
export const slash = async s => { const c = C(), r = await (c.executeSlashCommandsWithOptions || c.executeSlashCommands)(s); return r?.pipe ?? r; };

/* ---------- 语音 TTS 渠道 ---------- */
export const TTSP = [['mm', 'MiniMax国内'], ['mmi', 'MiniMax国际'], ['openai', 'OpenAI'], ['fish', 'Fish Audio'], ['eleven', 'ElevenLabs'], ['index', 'IndexTTS本地'], ['mimo', 'MiMo-V2.5-TTS'], ['volc', '豆包 / 火山引擎'], ['third', '第三方']];
// 官方接口地址：选了哪家就用哪家的官方地址（只有「第三方」和本地 IndexTTS 能自己填地址）
export const TURL = { mm: 'https://api.minimaxi.com', mmi: 'https://api.minimax.io', openai: 'https://api.openai.com/v1', fish: 'https://api.fish.audio', eleven: 'https://api.elevenlabs.io', mimo: 'https://api.xiaomimimo.com/v1', volc: 'https://openspeech.bytedance.com' };
// 第三方的接口格式
export const TFMT = [['openai', 'OpenAI 格式'], ['mm', 'MiniMax 格式'], ['fish', 'Fish Audio 格式'], ['eleven', 'ElevenLabs 格式'], ['mimo', 'MiMo 格式']];
// 真正请求用的设置：官方服务商固定官方地址；第三方按选的格式、用自己填的地址
export const tq = p => !p ? p : p.prov == 'third' ? { ...p, prov: p.fmt || 'openai', name: p.name } : TURL[p.prov] ? { ...p, url: TURL[p.prov] } : p;
// 各服务商的默认设置
export const PDEF = {
  tts: {
    mm: { model: 'speech-2.6-hd', voice: 'female-shaonv' }, mmi: { model: 'speech-2.6-hd', voice: 'female-shaonv' },
    openai: { model: 'tts-1', voice: 'alloy' }, fish: { model: 's2.1-pro' },
    eleven: { model: 'eleven_multilingual_v2', voice: 'EXAVITQu4vr4xnSDxMaL' },
    index: { url: 'http://127.0.0.1:6006/audio/speech' }, mimo: { model: 'mimo-v2.5-tts', voice: 'mimo_default' },
    volc: { ver: 'v3', res: 'seed-tts-2.0', voice: 'zh_female_xiaohe_uranus_bigtts' }, third: { fmt: 'openai', url: '' },
  },
  img: {
    nai: { model: 'nai-diffusion-4-5-full', size: '832x1216', steps: 28, scale: 5, sampler: 'k_euler_ancestral', pre: 'masterpiece, best quality, very aesthetic', tag: true },
    openai: { url: 'https://api.openai.com/v1', model: 'gpt-image-1', size: '1024x1024' },
    sd: { url: 'http://127.0.0.1:7860', size: '512x768', steps: 20, scale: 7, sampler: 'Euler a', tag: true },
    comfy: { url: 'http://127.0.0.1:8188', size: '512x768', steps: 20, scale: 7, sampler: 'euler_ancestral', tag: true },
    sf: { model: 'Kwai-Kolors/Kolors', size: '1024x1024', steps: 20, scale: 7.5 },
  },
};
// 「快速选择」用的模型 / 音色清单（音色还可以从账号里拉取）
const MMV = [['male-qn-qingse', '青涩青年'], ['male-qn-jingying', '精英青年'], ['male-qn-badao', '霸道青年'], ['male-qn-daxuesheng', '青年大学生'], ['female-shaonv', '少女'], ['female-yujie', '御姐'], ['female-chengshu', '成熟女性'], ['female-tianmei', '甜美女性'], ['presenter_male', '男性主持人'], ['presenter_female', '女性主持人'], ['audiobook_male_1', '男性有声书'], ['audiobook_female_1', '女性有声书']];
const MMM = ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo', 'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo'];
export const TCAT = {
  mm: { models: MMM, voices: MMV }, mmi: { models: MMM, voices: MMV },
  openai: { models: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'], voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'].map(v => [v, v]) },
  fish: { models: ['s2.1-pro', 's2.1-pro-free', 's2-pro', 's1'], voices: [] },
  eleven: { models: ['eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_flash_v2', 'eleven_turbo_v2'],
    voices: [['EXAVITQu4vr4xnSDxMaL', 'Sarah · 女'], ['FGY2WhTYpPnrIDTdsKH5', 'Laura · 女'], ['XB0fDUnXU5powFXDhCwa', 'Charlotte · 女'], ['Xb7hH8MSUJpSbSDYk0k2', 'Alice · 女'], ['XrExE9yKIg1WjnnlVkGX', 'Matilda · 女'], ['cgSgspJ2msm6clMCkdW9', 'Jessica · 女'], ['pFZP5JQG7iQjIQuC4Bku', 'Lily · 女'],
      ['JBFqnCBsd6RMkjVDRZzb', 'George · 男'], ['IKne3meq5aSn9XLyUdCD', 'Charlie · 男'], ['N2lVS1w4EtoT3dr4eOWO', 'Callum · 男'], ['TX3LPaxmHKxFdv7VOQHJ', 'Liam · 男'], ['bIHbv24MWmeRgasZH58o', 'Will · 男'], ['cjVigY5qzO86Huf0OWal', 'Eric · 男'], ['iP95p4xoKVk53GoZ742B', 'Chris · 男'], ['nPczCjzI2devNBz1zQrb', 'Brian · 男'], ['onwK4e9ZLuTAKqWW03F9', 'Daniel · 男']] },
  mimo: { models: ['mimo-v2.5-tts'], voices: [['冰糖', '冰糖 · 中文女声'], ['茉莉', '茉莉 · 中文女声'], ['苏打', '苏打 · 中文男声'], ['白桦', '白桦 · 中文男声'], ['Mia', 'Mia · 英文女声'], ['Chloe', 'Chloe · 英文女声'], ['Milo', 'Milo · 英文男声'], ['Dean', 'Dean · 英文男声'], ['mimo_default', '默认音色']] },
  index: { models: [], voices: [] }, volc: { models: [], voices: [] },
};
const FISH = 'https://api.fish.audio', fishB = p => trim(p.url || FISH).replace(/\/v1$/, ''), EL = 'https://api.elevenlabs.io';
const mmHost = p => trim(p.url || (p.prov == 'mmi' ? 'https://api.minimax.io' : 'https://api.minimaxi.com')).replace(/\/v1(\/t2a_v2)?$/, '');
const B = 'Bearer ';
const b64 = (s, type = '') => new Blob([Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0))], { type });
const hex = (s, type = '') => new Blob([new Uint8Array(String(s).match(/../g).map(h => parseInt(h, 16)))], { type });
// 通用：直接是音频，或 JSON 里带 base64 / hex / 链接
async function audio(r) {
  if (!/json|text/.test(r.headers.get('content-type') || '')) return r.blob();
  const j = await r.json(), d = j.data?.audio || j.audio?.data || j.choices?.[0]?.message?.audio?.data || j.audio_url || j.url || j.audio || j.data;
  if (typeof d != 'string') throw Error('没有拿到音频：' + JSON.stringify(j).slice(0, 200));
  return /^https?:/.test(d) ? (await xf(d)).blob() : /^[0-9a-f]{64}/i.test(d) ? hex(d, 'audio/mpeg') : b64(d.replace(/^data:[^,]+,/, ''), 'audio/mpeg');
}
const mm = host => async (p, t, v, sg) => {
  const j = await (await post(`${mmHost({ ...p, prov: host.includes('minimax.io') ? 'mmi' : 'mm' })}/v1/t2a_v2${p.gid ? '?GroupId=' + encodeURIComponent(p.gid) : ''}`, { model: p.model || 'speech-2.6-hd', text: t, stream: false, output_format: 'hex', voice_setting: { voice_id: v || 'female-shaonv', speed: +p.speed || 1, vol: 1, pitch: 0 }, ...(p.lang && p.lang != 'auto' && { language_boost: p.lang }), audio_setting: { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 } }, { Authorization: B + p.key }, sg)).json();
  if (j.base_resp?.status_code) throw Error(`MiniMax ${j.base_resp.status_code}：${j.base_resp.status_msg}`);
  if (!j.data?.audio) throw Error('MiniMax 没有返回音频'); return hex(j.data.audio, 'audio/mpeg');
};
// 豆包 / 火山：V3 单向流式（2.0 音色必须用这个，返回逐行 JSON，code=0 是音频片段、20000000 是结束）；V1 旧接口
async function volc(p, t, v, sg) {
  if (!v) throw Error('请先填写音色（如 zh_female_xiaohe_uranus_bigtts）');
  if (p.ver == 'v1') {
    const j = await (await post('https://openspeech.bytedance.com/api/v1/tts', { app: { appid: p.appid, token: p.key, cluster: p.cluster || 'volcano_tts' }, user: { uid: 'st_phone' }, audio: { voice_type: v, encoding: 'mp3', speed_ratio: +p.speed || 1 }, request: { reqid: uid() + uid(), text: t, operation: 'query' } }, { Authorization: 'Bearer;' + p.key }, sg)).json();
    if (j.code != 3000) throw Error(`火山 ${j.code}：${j.message}`); return b64(j.data, 'audio/mpeg');
  }
  const s = await (await post('https://openspeech.bytedance.com/api/v3/tts/unidirectional', { user: { uid: 'st_phone' }, req_params: { text: t, speaker: v, audio_params: { format: 'mp3', sample_rate: 24000, speech_rate: Math.max(-50, Math.min(100, Math.round(((+p.speed || 1) - 1) * 100))) } } }, { 'X-Api-App-Id': p.appid, 'X-Api-Access-Key': p.key, 'X-Api-Resource-Id': p.res || 'seed-tts-2.0', 'X-Api-Request-Id': uid() + uid() }, sg)).text();
  const parts = [];
  for (const l of s.replace(/}\s*{/g, '}\n{').split('\n')) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.code == 0 && j.data) parts.push(b64(j.data)); else if (j.code && j.code != 20000000) throw Error(`火山 ${j.code}：${j.message}`);
  }
  if (!parts.length) throw Error('火山没有返回音频'); return new Blob(parts, { type: 'audio/mpeg' });
}
const TTS = {
  mm: mm('https://api.minimaxi.com'), mmi: mm('https://api.minimax.io'), volc,
  openai: async (p, t, v, sg) => (await req(p, '/audio/speech', { model: p.model || 'tts-1', input: t, voice: v || 'alloy' }, sg)).blob(),
  // Fish Audio：走官方的网页接口 /compat/v1/audio/speech（允许浏览器直接调用，不用改酒馆后端、TauriTavern 也能用）
  fish: async (p, t, v, sg) => { if (!p.key) throw Error('请先填写 Fish Audio 的 API Key');
    return audio(await post(fishB(p) + '/compat/v1/audio/speech', { model: 'fish-audio/' + String(p.model || 's2.1-pro').replace(/^fish-audio\//, ''), input: t, voice: v || '', response_format: 'mp3', ...(+p.speed && +p.speed != 1 && { speed: +p.speed }) }, { Authorization: B + p.key }, sg)); },
  // ElevenLabs：浏览器可直接调用
  eleven: async (p, t, v, sg) => { if (!p.key) throw Error('请先填写 ElevenLabs 的 API Key'); if (!v) throw Error('请先选择音色');
    return (await post(`${trim(p.url || EL)}/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`, { text: t, model_id: p.model || 'eleven_multilingual_v2', ...(+p.speed && +p.speed != 1 && { voice_settings: { speed: +p.speed } }) }, { 'xi-api-key': p.key }, sg)).blob(); },
  // 本地 IndexTTS：同时带 OpenAI 格式（input/voice）和常见 API 格式（text/character），两种服务端都能认
  index: async (p, t, v, sg) => audio(await post(trim(p.url || 'http://127.0.0.1:6006/audio/speech'), { model: p.model || 'IndexTTS', input: t, voice: v, text: t, character: v }, p.key ? { Authorization: B + p.key } : {}, sg)),
  mimo: async (p, t, v, sg) => {
    const j = await (await post(base(p.url || 'https://api.xiaomimimo.com/v1') + '/chat/completions', { model: p.model || 'mimo-v2.5-tts', messages: [{ role: 'assistant', content: t }], audio: { format: 'mp3', voice: v || 'mimo_default' } }, { Authorization: B + p.key }, sg)).json();
    const d = j.choices?.[0]?.message?.audio?.data; if (!d) throw Error('MiMo 没有返回音频：' + JSON.stringify(j).slice(0, 200)); return b64(d, 'audio/mpeg');
  },
};
let AU; const play = b => { AU?.pause(); AU = new Audio(URL.createObjectURL(b)); return AU.play(); };
// 每个服务商的设置（不切换当前服务商）
export const ttsCfg = pv => { prof('tts'); const a = S.api.tts, c = a.cfg[pv] ||= structuredClone(PDEF.tts[pv] || {}); c.prov = pv; c.name = TTSP.find(x => x[0] == pv)?.[1] || pv; return c; };
// 联系人的专属音色（仿正文朗读插件）：c.tv = { pv: 服务商（空＝跟随全局）, v: { 服务商: 音色ID }, lang: MiniMax 朗读语言, say: [[写法, 读音]] }
// 「统一用一个渠道」：都用全局服务商，取这个人在这个服务商下填的音色；「每个人用自己的渠道」：按这个人选的服务商（没选就看他填了哪个）
export const voiceOf = c => {
  const a = S.api.tts, g = prof('tts').prov, tv = c?.tv || {}, v = tv.v || {};
  if (c?.voice && !Object.values(v).some(Boolean)) v[g] = c.voice; // 旧版只有一个音色：算在当前服务商下
  if (a.mode != 'per') return { pv: g, voice: v[g] || '' };
  const pv = tv.pv || g; if (v[pv]) return { pv, voice: v[pv] };
  const f = tv.pv ? null : Object.entries(v).find(([, x]) => x); return f ? { pv: f[0], voice: f[1] } : { pv, voice: '' };
};
// 名字读音：合成前把「写法」换成「读音」（比如日文名字）
const sayAs = (t, L) => (L || []).reduce((s, [w, r]) => w && r ? s.split(w).join(r) : s, t);
// 这个人实际用哪个音色：专属音色 → （开了「用全局默认音色」才往下）按性别的男 / 女默认音色 → 服务商的音色 ID
export const pickVoice = (c, p, sex) => { const vo = c ? voiceOf(c) : null, sx = c?.sex || sex;
  if (vo?.voice) return { v: vo.voice, from: 'own' };
  if (c && S.api.tts.fb === false) return { v: '', from: 'none' };
  const g = sx == '男' ? p.vm : sx == '女' ? p.vf : ''; return g ? { v: g, from: sx } : { v: p.voice || '', from: p.voice ? 'pv' : 'none' }; };
// o：{ c: 联系人 }，按这个人的服务商、朗读语言、名字读音来读
export const tts = (text, voice, sex, sg0, o = {}) => {
  const vo = o.c ? voiceOf(o.c) : null, pO = vo && vo.pv != prof('tts').prov ? ttsCfg(vo.pv) : null;
  return call('tts', '语音', text, async (p, sg) => {
    if (tav('tts')) return slash(`/speak ${voice ? `voice="${voice}" ` : ''}${text}`);
    const pk = voice ? { v: voice } : pickVoice(o.c, p, sex), v = pk.v, t = sayAs(text, o.c?.tv?.say), q = tq(p);
    if (o.c && pk.from == 'none') throw Error('还没给 TA 配音色');
    const b = await (TTS[q.prov] || TTS.openai)({ ...q, ...(o.c?.tv?.lang && { lang: o.c.tv.lang }) }, t, v, sg); if (!b?.size) throw Error('音频为空');
    await play(b); return `[已播放 ${(b.size / 1024).toFixed(0)}KB · ${p.name || p.prov} · 音色 ${v || '默认'}]`;
  }, sg0, pO);
};

/* ---------- 生图渠道 ---------- */
export const IMGP = [['nai', 'NovelAI / NAI'], ['openai', 'GPT / OpenAI兼容'], ['sd', '本地SD'], ['comfy', 'ComfyUI'], ['sf', '硅基流动']];
const wh = (s, w, h) => { const m = String(s || '').match(/(\d+)\s*[x×*]\s*(\d+)/); return m ? [+m[1], +m[2]] : [w, h]; };
const seed = () => Math.floor(Math.random() * 4294967295);
// NAI 返回 zip：按中央目录取第一个文件（不压缩 / deflate 都支持）
export async function unzip1(u8) {
  if (u8[0] == 0x89 && u8[1] == 0x50) return new Blob([u8], { type: 'image/png' });
  if (u8[0] != 0x50 || u8[1] != 0x4b) throw Error('NAI 返回异常：' + new TextDecoder().decode(u8.slice(0, 300)));
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) != 0x06054b50) e--; if (e < 0) throw Error('NAI 返回的压缩包损坏');
  const cd = dv.getUint32(e + 16, true), meth = dv.getUint16(cd + 10, true), size = dv.getUint32(cd + 20, true), lo = dv.getUint32(cd + 42, true);
  const st = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(st, st + size);
  if (meth == 0) return new Blob([raw], { type: 'image/png' });
  return new Blob([await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()], { type: 'image/png' });
}
// ComfyUI 内置工作流（普通 SD1.5 / SDXL 底模）；自定义工作流用「导出(API)」的 JSON，占位符同下
export const COMFY = JSON.stringify({
  3: { class_type: 'KSampler', inputs: { seed: '%seed%', steps: '%steps%', cfg: '%scale%', sampler_name: '%sampler%', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
  4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: '%model%' } },
  5: { class_type: 'EmptyLatentImage', inputs: { width: '%width%', height: '%height%', batch_size: 1 } },
  6: { class_type: 'CLIPTextEncode', inputs: { text: '%prompt%', clip: ['4', 1] } },
  7: { class_type: 'CLIPTextEncode', inputs: { text: '%negative_prompt%', clip: ['4', 1] } },
  8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  9: { class_type: 'SaveImage', inputs: { filename_prefix: 'st_phone', images: ['8', 0] } },
});
export const fillWf = (wf, o) => wf.replace(/"%(\w+)%"/g, (m, k) => k in o ? JSON.stringify(o[k]) : m).replace(/%(\w+)%/g, (m, k) => k in o ? JSON.stringify(String(o[k])).slice(1, -1) : m);
const NEG = 'lowres, bad anatomy, bad hands, missing fingers, text, error, watermark, worst quality, low quality, blurry';
const IMG = {
  openai: async (p, pr, sg) => { const d = (await (await req(p, '/images/generations', { model: p.model, prompt: pr, n: 1, size: p.size || '1024x1024' }, sg)).json()).data?.[0]; return d?.url || d?.b64_json && 'data:image/png;base64,' + d.b64_json; },
  sf: async (p, pr, sg) => { const j = await (await post(base(p.url || 'https://api.siliconflow.cn/v1') + '/images/generations', { model: p.model || 'Kwai-Kolors/Kolors', prompt: pr, image_size: p.size || '1024x1024', batch_size: 1, num_inference_steps: +p.steps || 20, guidance_scale: +p.scale || 7.5, ...(p.neg && { negative_prompt: p.neg }) }, { Authorization: B + p.key }, sg)).json(); return j.images?.[0]?.url || j.data?.[0]?.url; },
  sd: async (p, pr, sg) => { const [w, h] = wh(p.size, 512, 768), j = await (await post(trim(p.url || 'http://127.0.0.1:7860') + '/sdapi/v1/txt2img', { prompt: pr, negative_prompt: p.neg || NEG, width: w, height: h, steps: +p.steps || 20, cfg_scale: +p.scale || 7, sampler_name: p.sampler || 'Euler a', seed: -1, ...(p.model && { override_settings: { sd_model_checkpoint: p.model } }) }, {}, sg)).json(); return j.images?.[0] && 'data:image/png;base64,' + j.images[0]; },
  nai: async (p, pr, sg) => {
    const [w, h] = wh(p.size, 832, 1216), m = p.model || 'nai-diffusion-4-5-full', neg = p.neg || NEG, v4 = /diffusion-4/.test(m);
    const prm = { params_version: 3, width: w, height: h, scale: +p.scale || 5, sampler: p.sampler || 'k_euler_ancestral', steps: +p.steps || 28, n_samples: 1, seed: seed(), ucPreset: 0, qualityToggle: true, noise_schedule: 'karras', cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false, add_original_image: true, negative_prompt: neg,
      ...(v4 && { v4_prompt: { caption: { base_caption: pr, char_captions: [] }, use_coords: false, use_order: true }, v4_negative_prompt: { caption: { base_caption: neg, char_captions: [] }, legacy_uc: false } }) };
    const r = await post(trim(p.url || 'https://image.novelai.net') + '/ai/generate-image', { input: pr, model: m, action: 'generate', parameters: prm }, { Authorization: B + p.key }, sg);
    return unzip1(new Uint8Array(await r.arrayBuffer()));
  },
  comfy: async (p, pr, sg) => {
    const u = trim(p.url || 'http://127.0.0.1:8188'), [w, h] = wh(p.size, 512, 768);
    if (!p.wf?.trim() && !p.ckpt) throw Error('请先在配置里填写 ComfyUI 模型文件名（可点拉取）');
    let wf; try { wf = JSON.parse(fillWf(p.wf?.trim() || COMFY, { prompt: pr, negative_prompt: p.neg || NEG, seed: seed(), width: w, height: h, steps: +p.steps || 20, scale: +p.scale || 7, sampler: p.sampler || 'euler_ancestral', model: p.ckpt || '' })); }
    catch { throw Error('工作流 JSON 格式不对（要用 ComfyUI「导出(API)」的格式）'); }
    const id = (await (await post(u + '/prompt', { prompt: wf, client_id: 'st_phone' }, {}, sg)).json()).prompt_id; if (!id) throw Error('ComfyUI 没有接受任务');
    for (;;) {
      await sleep(1500); if (sg.aborted) throw sg.reason;
      const hs = (await (await xf(`${u}/history/${id}`, { signal: sg }).then(chk)).json())[id];
      if (hs?.status?.status_str == 'error') throw Error('ComfyUI 执行出错，请看 ComfyUI 控制台');
      const im = hs && Object.values(hs.outputs || {}).flatMap(o => o.images || []).sort((a, b) => (b.type == 'output') - (a.type == 'output'))[0];
      if (im) return (await xf(`${u}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder || '')}&type=${im.type}`, { signal: sg }).then(chk)).blob();
    }
  },
};
// 结果统一压成 webp 存进聊天数据（链接会过期的渠道也能留住图）；拿不到就保留原链接
const shrink = async s => { try { return await readImg(s instanceof Blob ? s : await (await fetch(s)).blob(), 1280); } catch { return s instanceof Blob ? URL.createObjectURL(s) : s; } };
const TAGP = 'Convert the image description into concise comma-separated English Danbooru-style tags (subject, appearance, clothing, expression, pose, scene, lighting). Output tags only.';
export async function genImg(prompt, sg) {
  const p = prof('img'), own = !tav('img') && p;
  if (own && p.tag && ['nai', 'sd', 'comfy'].includes(p.prov) && /[一-龥]/.test(prompt)) {
    try { prompt = String(await llm(TAGP, prompt, '生图提示词', sg, { fast: 1, aux: 1 })).replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/\s*[,，]?\s*\n+\s*/g, ', ').replace(/^[\s,]+|[\s,]+$/g, '') || prompt; } catch (e) { if (sg?.aborted) throw e; }
  }
  own && p.pre?.trim() && (prompt = p.pre.trim().replace(/,\s*$/, '') + ', ' + prompt);
  return call('img', '生图', prompt, async (p, sig) => {
    if (tav('img')) return slash('/sd quiet=true ' + prompt);
    const r = await (IMG[p.prov] || IMG.openai)(p, prompt, sig); if (!r) throw Error('没有返回图片'); return putMedia(await shrink(r), 'ai');
  }, sg);
}
// 拉取音色：Fish（我的音色，没有就列热门）/ ElevenLabs / MiniMax；其他服务商用快速选择清单
export async function voices(p) {
  if (p.prov == 'fish') { const h = p.key ? { Authorization: B + p.key } : {}, get = async q => (await (await xf(fishB(p) + '/model?' + q, { headers: h }).then(chk)).json()).items || [];
    let L = p.key ? await get('self=true&page_size=50') : []; const mine = L.length; L.length || (L = await get('page_size=40&sort_by=task_count'));
    return L.map(v => [v._id, (v.title || v._id) + (mine ? '' : ' · 热门')]); }
  if (p.prov == 'eleven') { if (!p.key) throw Error('请先填写 API Key'); const j = await (await xf(`${trim(p.url || EL)}/v2/voices?page_size=100`, { headers: { 'xi-api-key': p.key } }).then(chk)).json();
    return (j.voices || []).map(v => [v.voice_id, v.name + (v.labels?.gender ? ' · ' + ({ female: '女', male: '男' }[v.labels.gender] || v.labels.gender) : '') + (v.category == 'premade' ? '' : ' · 我的')]); }
  if (p.prov == 'mm' || p.prov == 'mmi') { if (!p.key) throw Error('请先填写 API Key'); const j = await (await post(mmHost(p) + '/v1/get_voice', { voice_type: 'all' }, { Authorization: B + p.key })).json();
    if (j.base_resp?.status_code) throw Error(`MiniMax ${j.base_resp.status_code}：${j.base_resp.status_msg}`);
    return [...(j.voice_cloning || []).map(v => [v.voice_id, v.voice_id + ' · 复刻']), ...(j.voice_generation || []).map(v => [v.voice_id, v.voice_id + ' · 设计']), ...(j.system_voice || []).map(v => [v.voice_id, v.voice_name || v.voice_id])]; }
  return TCAT[p.prov]?.voices || [];
}
// 拉取模型：OpenAI 兼容 /models；本地 SD 读 sd-models；ComfyUI 读底模文件列表；Fish / ElevenLabs 读各自的模型列表
export const models = async (p, t = 'chat') => {
  if (t == 'tts' && p.prov == 'fish') return ((await (await xf(fishB(p) + '/compat/v1/models').then(chk)).json()).data || []).map(m => String(m.id).replace(/^fish-audio\//, ''));
  if (t == 'tts' && p.prov == 'eleven') { if (!p.key) throw Error('请先填写 API Key'); return (await (await xf(trim(p.url || EL) + '/v1/models', { headers: { 'xi-api-key': p.key } }).then(chk)).json()).filter(m => m.can_do_text_to_speech !== false).map(m => m.model_id); }
  if (t == 'tts' && TCAT[p.prov]?.models.length && !['openai', 'index'].includes(p.prov)) return TCAT[p.prov].models;
  if (t == 'img' && p.prov == 'comfy') return (await (await xf(trim(p.url || 'http://127.0.0.1:8188') + '/object_info/CheckpointLoaderSimple').then(chk)).json()).CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
  if (t == 'img' && p.prov == 'sd') return (await (await xf(trim(p.url || 'http://127.0.0.1:7860') + '/sdapi/v1/sd-models').then(chk)).json()).map(m => m.title);
  const j = await (await req(p, '/models')).json(); return (j.data || j.models || j).map?.(m => m.id || m.name || m) || [];
};

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
// 上下文长度预算：sysCtx() 完整；sysCtx(true) 精简（不带世界书、只取最近6条）；也可传 { n 条数, rc 正文字数, wi 世界书字数, desc 角色卡字数 } 自定
const cut = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;
export async function sysCtx(o) {
  o = o === true ? { n: 6, rc: 2500, wi: 0, desc: 1200 } : o || {};
  const c = C(), ch = c.characters?.[c.characterId], d = D(), sub = (s, n = 1500) => cut((c.substituteParams?.(s || '') ?? s ?? '').trim(), n);
  const n = Math.max(1, Math.min(+S.ctxN || 15, o.n || 99)), wi = o.wi ?? 8000;
  const r = cut((C().chat || []).filter(m => !m.is_system).slice(-n).map(m => `${m.name}: ${cut(strip(m.mes), 800)}`).join('\n'), o.rc || 10000);
  return `你是“小手机”模拟器，扮演手机里的所有联系人与内容，言行贴合人设、世界观与当前剧情。严格按要求的格式输出，不要任何多余文字。
当前手机时间：${now().toLocaleString('zh-CN')}
【用户】${c.name1}（手机昵称：${d.me.nick || c.name1}）${sub(c.powerUserSettings?.persona_description)}
【主角色】${c.name2}\n${sub(ch?.description, o.desc || 4000)}\n${sub(ch?.personality, 800)}
${wi ? `【世界书】\n${sub(await wiText(r + d.chats.map(rn).join(' ')), wi)}` : ''}
【正文剧情·最近${n}条】\n${r}
【手机联系人】${d.chats.map(x => x.type == 'g' ? `群「${x.name}」` : `${rn(x)}(网名${x.nick || '-'})`).join('、') || '无'}`;
}

/* ---------- 正文联动：把标记的手机聊天注入提示词 ---------- */
export function syncInject() {
  const c = C(); let t = '';
  if (S.mode == 'linked') t = D().chats.map(ch => { const ms = ch.msgs.filter(m => m.inj || ch.cfg?.inj).slice(-15); return ms.length ? `[${ch.type == 'g' ? '群聊「' + ch.name + '」' : '与' + rn(ch) + '的私聊'}]\n` + ms.map(m => `${m.f == 'me' ? meObj().nick : rn(byId(m.f))}: ${say(m)}`).join('\n') : ''; }).filter(Boolean).join('\n');
  const u = c.name1, inl = S.inline ? `<手机同步格式>\n剧情里有人用手机（发消息、发朋友圈、加好友、拉群、转账、拍一拍）时，在本条回复最后附一个 <手机>…</手机> 块，一行一件事，只写${u}的手机上能看到的：\n私聊|发送者|接收者|内容（发表情包就写 [表情包:关键词]）\n群聊|群名|发送者|内容\n朋友圈|作者|内容\n加好友|真实姓名|网名|TA说的语言（说中文就不写）\n拉群|群名|成员1,成员2\n转账|发送者|接收者|金额|备注\n拍一拍|谁|动作\n人名都写真实姓名，${u}就写「${u}」。没有手机上的事就不要写这个块。这个块会自动收进手机，不会显示在正文里。\n</手机同步格式>` : '';
  c.setExtensionPrompt?.('st_phone', [t && `<手机聊天记录>\n以下是${u}手机里的聊天，相关角色知道这些内容：\n${t}\n</手机聊天记录>`, inl].filter(Boolean).join('\n'), 1, 2, false, 0); // 跟着正文一起输出，不额外调 API
}

/* ---------- 消息弹窗 ---------- */
export function notify(ch, m) {
  emit('badge'); if (!S.notify) return;
  const b = Object.assign(document.createElement('div'), { className: 'stp-ban' });
  b.innerHTML = `<img src="${esc(avOf(ch))}"><div><b>${esc(nm(ch))}</b><p>${esc((ch.type == 'g' ? nm(byId(m.f)) + '：' : '') + brief(m))}</p></div><small>${hm(now())}</small>`;
  b.onclick = () => { b.remove(); emit('open-chat', ch.id); }; document.body.append(b);
  setTimeout(() => b.classList.add('in'), 30); setTimeout(() => { b.classList.remove('in'); setTimeout(() => b.remove(), 500); }, 5000);
}

/* ---------- 取 JSON（表情库等公开数据用） ---------- */
// 取 JSON：先直连；被跨域拦了就试 TauriTavern 的原生请求，再试酒馆的 /proxy/
export async function getJ(url, signal) {
  let r = null;
  try { r = await fetch(url, { signal, referrerPolicy: 'no-referrer' }); }
  catch (e) {
    if (signal?.aborted) throw e;
    const tf = globalThis.__TAURI__?.http?.fetch; if (tf) try { r = await tf(url, { method: 'GET' }); } catch { r = null; }
    r ||= await xf(url, { signal });
  }
  await chk(r); return r.json();
}
