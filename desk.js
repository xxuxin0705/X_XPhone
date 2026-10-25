// 小手机 · 桌面：多页网格 / Dock / 文件夹 / 小组件 / 长按编辑拖拽
import { S, save, esc, uid, $, $$, ui, G, APPS, now, tpl, form, menu, sheet, defAv, btn, openApp, drop as dropMedia, pickImg } from './core.js';
import { ccdHtml, CCD_BODY, CCD_BG } from './apps/theme/ccd.js';

const W = (k, w, h, p = {}) => ({ id: uid(), t: 'w', k, w, h, p }), A = app => ({ id: uid(), t: 'app', app });
// 尺寸：宽 1～4 格 × 高 1～4 格，任意组合（按宽度分组）
const SZ = [1, 2, 3, 4].flatMap(w => [1, 2, 3, 4].map(h => [`${w}x${h}`, `${w}×${h}${w == h && w == 1 ? '（小方块）' : w == 4 && h == 1 ? '（长条）' : w == 2 && h == 2 ? '（方）' : ''}`]));
const DAY = 864e5, dd = s => s ? Math.floor((now() - new Date(s)) / DAY) : '—';
const bd = s => { if (!s) return '—'; const n = now(), b = new Date(s); b.setFullYear(n.getFullYear()); b < n - DAY && b.setFullYear(n.getFullYear() + 1); return Math.ceil((b - n) / DAY); };
export const WK = {
  pill: { n: '资料胶囊', w: 4, h: 1, f: [['img', '头像', 'img'], ['name', '名字'], ['big', '右侧大字'], ['sub', '右侧小字']], r: p => `<img class="wp-a" src="${esc(p.img || defAv('♡'))}"><div class="wp-m"><b>${esc(p.name || '{{user}}')}</b><small>{{date}} 周{{week}}</small></div><div class="wp-r"><b>${esc(p.big || '♡')}</b><small>${esc(p.sub || '')}</small></div>` },
  clock: { n: '时钟', w: 4, h: 1, f: [['text', '标语']], r: p => `<b class="wc-t">{{time}}</b><i class="wc-s">${esc(p.text || 'Carpe Diem')}</i><div class="wc-d"><b>{{md}}</b><small>{{weekEn}}</small></div>` },
  photo: { n: '相片', w: 2, h: 2, f: [['img', '图片', 'img'], ['cap', '文字']], r: p => (p.img ? `<img src="${esc(p.img)}">` : '<div class="ph">✿<small>编辑桌面时点我换图</small></div>') + (p.cap ? `<span class="cap">${esc(p.cap)}</span>` : '') },
  cal: { n: '日历', w: 2, h: 2, r: () => { const d = now(), y = d.getFullYear(), m = d.getMonth(); let s = '<i></i>'.repeat(new Date(y, m, 1).getDay()); for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) s += `<i class="${i == d.getDate() ? 'on' : ''}">${i}</i>`; return `<div class="wcal-h">${m + 1}月 <small>${y}</small></div><div class="wcal">${[...'日一二三四五六'].map(x => `<i class="wk">${x}</i>`).join('')}${s}</div>`; } },
  days: { n: '纪念日', w: 2, h: 2, f: [['title', '标题'], ['from', '起始日', 'date'], ['bday', '生日', 'date']], r: p => `<small>${esc(p.title || '你在世界已经')}</small><b class="wd-n">${dd(p.from)}<i>天</i></b><small>生日还有 <b>${bd(p.bday)}</b> 天</small>` },
  text: { n: '文字', w: 4, h: 1, f: [['text', '内容', 'area']], r: p => `<p>${esc(p.text || 'HAPPY EVERYDAY ♡')}</p>` },
  ccd: { n: 'CCD 相机', w: 2, h: 2, cls: 'ccd',
    f: [['img', '照片', 'img'], ['body', '机身颜色', 'sel', CCD_BODY], ['zoom', '照片缩放 %', 'number', '100'], ['px', '左右位置 %', 'number', '50'], ['py', '上下位置 %', 'number', '50'],
      ['bg', '背景', 'sel', CCD_BG], ['bgC', '背景颜色', 'color'], ['bgC2', '渐变第二色', 'color'], ['bgA', '背景不透明度 %', 'number', '60']],
    r: (p, it) => ccdHtml(p, it?.w || 2, it?.h || 2), tap: it => ccdPhoto(it) },
  custom: { n: '自定义组件', w: 2, h: 2, f: [['html', 'HTML / CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']], r: p => p.html || '' },
};
const def = () => ({
  pages: [[W('pill', 4, 1, { name: '{{user}}', big: '9°', sub: '☁ 多云' }), W('photo', 2, 2, { cap: '♡ lovely' }), W('cal', 2, 2), W('text', 4, 1, { text: '✧ you can do anything ✧' })],
    [W('clock', 4, 1), W('days', 2, 2, { from: '2000-01-01' }), W('photo', 2, 2, { cap: 'yummy ✦' })]],
  dock: [A('chat'), A('theme'), A('settings')],
});

let edit = 0, cur = 0, moved = 0;
export const icon = id => S.icons[id] ? `<img src="${esc(S.icons[id])}">` : APPS[id]?.icon || '';
const x = id => `<b class="x" data-a="del" data-x="${id}">×</b>`;
const item = it => it.t == 'w' ? `<div class="it wg w${it.w} h${it.h} k-${it.k} ${WK[it.k]?.cls || ''}" data-it="${it.id}" data-a="tap" data-lp="dlp">${x(it.id)}${tpl(WK[it.k]?.r(it.p || {}, it))}</div>`
  : `<div class="it app" data-it="${it.id}" data-a="tap" data-lp="dlp">${it.t == 'folder' ? x(it.id) : ''}<div class="ico ${it.t == 'folder' ? 'fdi' : 'a-' + it.app}">${it.t == 'folder' ? it.apps.map(a => `<i class="ico a-${a}">${icon(a)}</i>`).join('') : icon(it.app)}</div><span>${esc(it.t == 'folder' ? it.name : APPS[it.app]?.name)}</span></div>`;
export function renderDesk() {
  const d = S.desk, el = ui.desk; if (!el) return;
  el.innerHTML = `<div class="ed-bar">${btn('wAdd', '＋ 小组件')}${btn('pAdd', '＋ 页面')}${btn('edDone', '完成', '', 'pri')}</div><div class="pages">${d.pages.map((p, i) => `<div class="page" data-box="${i}" data-lp="dlp">${p.map(item).join('')}</div>`).join('')}</div><div class="dots">${d.pages.map((_, i) => `<i data-a="go" data-x="${i}" class="${i == cur ? 'on' : ''}"></i>`).join('')}</div><div class="dock" data-box="dock">${d.dock.map(item).join('')}</div>`;
  const pg = $('.pages', el); pg.scrollLeft = cur * pg.clientWidth;
  pg.onscroll = () => { const i = Math.round(pg.scrollLeft / pg.clientWidth); i != cur && (cur = i, $$('.dots i', el).forEach((x, j) => x.classList.toggle('on', j == i))); };
}
const find = id => { for (const l of [...S.desk.pages, S.desk.dock]) { const i = l.findIndex(x => x.id == id); if (i > -1) return [l, i]; } return [[], -1]; };
function clean() {
  const d = S.desk; [...d.pages, d.dock].forEach(l => l.forEach((it, i) => it.t == 'folder' && it.apps.length < 2 && l.splice(i, 1, ...it.apps.map(A))));
  d.pages = d.pages.filter(p => p.length || edit); d.pages.length || d.pages.push([]); cur = Math.min(cur, d.pages.length - 1); save(); renderDesk();
}
const goPage = i => { cur = Math.max(0, Math.min(i, S.desk.pages.length - 1)); const p = $('.pages', ui.desk); p.scrollTo({ left: cur * p.clientWidth, behavior: 'smooth' }); };

function drag(e, id) {
  let el = $(`[data-it="${id}"]`, ui.desk), x0 = e.clientX, y0 = e.clientY, last = e, et, dist = 0; if (!el) return;
  const sc = ui.root.getBoundingClientRect().width / ui.root.offsetWidth || 1, pd = ev => ev.preventDefault();
  el.classList.add('drag');
  const mv = ev => {
    last = ev; dist = Math.max(dist, Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY));
    el.style.transform = `translate(${(ev.clientX - x0) / sc}px,${(ev.clientY - y0) / sc}px) scale(1.06)`;
    const r = ui.desk.getBoundingClientRect(), edge = ev.clientX < r.left + 18 ? -1 : ev.clientX > r.right - 18 ? 1 : 0;
    if (!edge) { clearTimeout(et); et = 0; } else if (!et && !(edge < 0 && !cur)) et = setTimeout(() => {
      et = 0; const n = cur + edge; n >= S.desk.pages.length && S.desk.pages.push([]); const [l, i] = find(id); S.desk.pages[n].push(...l.splice(i, 1)); cur = n; renderDesk();
      el = $(`[data-it="${id}"]`, ui.desk); el.classList.add('drag'); x0 = last.clientX; y0 = last.clientY;
    }, 600);
    $$('.hov', ui.desk).forEach(x => x.classList.remove('hov')); document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-it]')?.classList.add('hov');
  };
  const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('touchmove', pd); clearTimeout(et); dist > 6 && (moved = Date.now()); drop(id, ev, el); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('touchmove', pd, { passive: false });
}
function drop(id, ev, el) {
  const p = document.elementFromPoint(ev.clientX, ev.clientY);
  el.classList.remove('drag'); el.style.transform = ''; $$('.hov', ui.desk).forEach(x => x.classList.remove('hov'));
  const te = p?.closest('[data-it]'), box = p?.closest('[data-box]'), [sl, si] = find(id), it = sl[si];
  if (!box || te == el) return;
  const tl = box.dataset.box == 'dock' ? S.desk.dock : S.desk.pages[box.dataset.box];
  if (tl == S.desk.dock && (it.t == 'w' || (sl != tl && tl.length >= 4))) return renderDesk();
  if (te) {
    const tg = tl.find(x => x.id == te.dataset.it), r = te.getBoundingClientRect(), mid = Math.abs(ev.clientX - r.left - r.width / 2) < r.width * .3 && Math.abs(ev.clientY - r.top - r.height / 2) < r.height * .3;
    sl.splice(si, 1);
    if (it.t == 'app' && tg.t != 'w' && mid) tg.t == 'folder' ? tg.apps.push(it.app) : tl.splice(tl.indexOf(tg), 1, { id: uid(), t: 'folder', name: '文件夹', apps: [tg.app, it.app] });
    else tl.splice(tl.indexOf(tg), 0, it);
  } else sl.splice(si, 1), tl.push(it);
  clean();
}
function folder(it) {
  const s = sheet({
    cls: 'fold', noBack: 1, title: `<input class="fd-n" value="${esc(it.name)}">`,
    body: () => `<div class="fd-g">${it.apps.map((a, i) => `<div class="it app" data-a="fo" data-x="${a}" data-lp="fout" data-i="${i}"><div class="ico a-${a}">${icon(a)}</div><span>${esc(APPS[a]?.name)}</span></div>`).join('')}</div><p class="tip">长按图标可移出文件夹</p>`,
    acts: { fo: a => { s.close(); openApp(a); }, fout: (a, t) => { it.apps.splice(t.dataset.i, 1); S.desk.pages[cur].push(A(a)); s.close(); } },
    onClose: () => { it.name = $('.fd-n', s.el)?.value || it.name; clean(); },
  });
}
// CCD：点一下换照片
async function ccdPhoto(it) { const v = await pickImg(1080, 'img'); if (v == null) return; const old = it.p.img; it.p.img = v || ''; save(); old && dropMedia(old); renderDesk(); }
async function editW(it) {
  const K = WK[it.k], r = await form(K.n, [...(K.f || []), ['sz', '尺寸', 'sel', SZ]], { ...it.p, sz: it.w + 'x' + it.h }); if (!r) return;
  const { sz, ...p } = r; [it.w, it.h] = sz.split('x').map(Number); it.p = p; save(); renderDesk();
}
Object.assign(G, {
  dlp: (_, t, e) => { if (edit) return; edit = 1; ui.desk.classList.add('edit'); t.dataset.it && drag(e, t.dataset.it); },
  edDone: () => { edit = 0; ui.desk.classList.remove('edit'); clean(); },
  go: i => goPage(+i),
  tap: (_, t) => { if (Date.now() - moved < 350) return; const [l, i] = find(t.dataset.it), it = l[i]; if (!it) return; if (it.t == 'folder') return folder(it); if (edit) return it.t == 'w' && editW(it); it.t == 'app' ? openApp(it.app) : WK[it.k]?.tap?.(it); }, // 不在编辑时点组件：有自己的点击动作就执行（CCD 换照片）
  del: id => { const [l, i] = find(id), it = l[i]; dropMedia(it); it.t == 'folder' && S.desk.pages[cur].push(...it.apps.map(A)); l.splice(i, 1); clean(); },
  wAdd: async () => {
    const k = await menu([...Object.entries(WK).filter(([k]) => k != 'custom').map(([k, v]) => [k, v.n]), ...S.assets.widget.map((a, i) => ['@' + i, '✦ ' + esc(a.name)])], '添加小组件'); if (!k) return;
    const a = k[0] == '@' && S.assets.widget[k.slice(1)], [w, h] = (a?.sz || '2x2').split('x').map(Number);
    S.desk.pages[cur].push(a ? W('custom', w, h, { html: a.html }) : W(k, WK[k].w, WK[k].h)); clean();
  },
  pAdd: () => { S.desk.pages.push([]); clean(); goPage(S.desk.pages.length - 1); },
});
export function initDesk() {
  S.desk ||= def(); renderDesk();
  ui.desk.addEventListener('pointerdown', e => { if (!edit || e.target.closest('.x,.ed-bar,.dots')) return; const t = e.target.closest('[data-it]'); t && drag(e, t.dataset.it); });
}
