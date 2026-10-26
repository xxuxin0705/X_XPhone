// 小手机 · 桌面：多页网格 / Dock / 文件夹 / 小组件 / 长按编辑拖拽
import { S, save, esc, uid, $, $$, ui, G, APPS, now, tpl, form, menu, sheet, defAv, btn, openApp, drop as dropMedia, pickImg } from './core.js';
import { ccdHtml, ccdBg, CCD_BG, CCD_PINK } from './apps/theme/ccd.js';
import { clkHtml, clkFonts, CLK_DEF } from './apps/theme/clock.js';

const W = (k, w, h, p = {}) => ({ id: uid(), t: 'w', k, w, h, p }), A = app => ({ id: uid(), t: 'app', app });
// 尺寸：只能按原比例放大缩小（2×2 → 1×1 / 3×3 / 4×4；2×1 → 4×2），最大 4 格
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const sizes = (w, h) => { const g = gcd(w, h), rw = w / g, rh = h / g, o = []; for (let k = 1; k * rw <= 4 && k * rh <= 4; k++) o.push([k * rw, k * rh]); return o; };
const szOpt = (w, h) => sizes(w, h).map(([a, b]) => [`${a}x${b}`, `${a}×${b}`]);
export const WK = {
  ccd: { n: 'CCD 相机', w: 2, h: 2, cls: 'ccd',
    f: [['img', '照片', 'img'], ['body', '机身颜色', 'color'], ['zoom', '照片缩放 %', 'number', '100'], ['px', '左右位置 %', 'number', '50'], ['py', '上下位置 %', 'number', '50'],
      ['bg', '背景', 'sel', CCD_BG], ['bgC', '背景颜色', 'color'], ['bgC2', '渐变第二色', 'color'], ['bgA', '背景不透明度 %', 'number', '60']],
    d: { body: CCD_PINK, bgC: '#ffffff', bgC2: '#ffd6e7' }, r: (p, it) => ccdHtml(p, it?.w || 2, it?.h || 2), tap: it => ccdPhoto(it) },
  clock: { n: '时间', w: 2, h: 1, cls: 'clkw',
    f: () => [['font', '字体', 'sel', clkFonts().map(([k, n]) => [k, n])], ['wt', '粗细（100～900）', 'number'], ['pos', '日期位置', 'sel', [['top', '在时间上面'], ['bot', '在时间下面']]], ['h12', '12 小时制', 'tog'], ['lang', '语言', 'sel', [['zh', '中文'], ['en', 'English']]], ['al', '对齐', 'sel', [['c', '居中'], ['l', '靠左'], ['r', '靠右']]],
      ['auto', '跟随主题配色', 'tog'], ['c', '颜色', 'color'], ['a', '不透明度 %', 'number', '100'], ['bg', '背景', 'sel', CCD_BG], ['bgC', '背景颜色', 'color'], ['bgC2', '渐变第二色', 'color'], ['bgA', '背景不透明度 %', 'number', '60']],
    d: { ...CLK_DEF, bg: 'none', bgC: '#ffffff', bgC2: '#ffd6e7', bgA: 60 }, r: p => `<div class="ccd-bg" style="${ccdBg(p)}"></div>${clkHtml(p, now())}` },
  custom: { n: '自定义组件', w: 2, h: 2, f: [['html', 'HTML / CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']], r: p => p.html || '' },
};
const def = () => ({ pages: [[W('clock', 4, 2, { ...WK.clock.d }), W('ccd', 2, 2, { ...WK.ccd.d })]], dock: [A('chat'), A('theme'), A('settings')] });

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
  const K = WK[it.k], r = await form(K.n, [...(typeof K.f == 'function' ? K.f() : K.f || []), ['sz', '尺寸', 'sel', szOpt(K.w, K.h)]], { ...K.d, ...it.p, sz: it.w + 'x' + it.h }); if (!r) return;
  const { sz, ...p } = r; [it.w, it.h] = sz.split('x').map(Number); it.p = p; save(); renderDesk();
}
// 添加小组件：按尺寸筛选，每个组件的每种尺寸都有一张实际渲染的预览卡片
const CELL = 64; // 预览里一格的边长
function wAddSheet() {
  const all = [...Object.entries(WK).filter(([k]) => k != 'custom').map(([k, v]) => ({ k, w: v.w, h: v.h, n: v.n, cls: v.cls || '', p: { ...v.d }, mk: () => W(k, v.w, v.h, { ...v.d }) })), // 每个组件一张，按它自己的尺寸；大小加到桌面后长按再改
    ...S.assets.widget.map(a => { const [w, h] = (a.sz || '2x2').split('x').map(Number); return { k: 'custom', w, h, n: a.name, cls: '', p: { html: a.html }, mk: () => W('custom', w, h, { html: a.html }) }; })];
  const szs = [...new Set(all.map(e => `${e.w}x${e.h}`))].sort((a, b) => a.split('x').reduce((x, y) => x * y) - b.split('x').reduce((x, y) => x * y) || a.localeCompare(b));
  let fz = '';
  const card = (e, i) => `<div class="wcard" data-a="pick" data-x="${i}" data-k="${e.k}" data-sz="${e.w}x${e.h}"><div class="wprev" style="width:${e.w * CELL}px;height:${e.h * CELL}px"><div class="it wg w${e.w} h${e.h} k-${e.k} ${e.cls}">${tpl(WK[e.k].r(e.p, { w: e.w, h: e.h }))}</div></div><span class="wc-n">${esc(e.n)}</span><span class="wc-s">${e.w}×${e.h}</span></div>`;
  const s = sheet({ cls: 'wadd', noBack: 1, title: '添加小组件',
    body: () => `<div class="szf">${[['', '全部尺寸'], ...szs.map(z => [z, z.replace('x', '×')])].map(([v, l]) => `<b class="${fz == v ? 'on' : ''}" data-a="szf" data-x="${v}">${l}</b>`).join('')}</div><div class="wgrid">${all.map((e, i) => !fz || `${e.w}x${e.h}` == fz ? card(e, i) : '').join('')}</div>`,
    acts: { szf: v => { fz = v; s.reb(); }, pick: i => { S.desk.pages[cur].push(all[+i].mk()); s.close(); clean(); } } });
}
Object.assign(G, {
  dlp: (_, t, e) => { if (edit) return; edit = 1; ui.desk.classList.add('edit'); t.dataset.it && drag(e, t.dataset.it); },
  edDone: () => { edit = 0; ui.desk.classList.remove('edit'); clean(); },
  go: i => goPage(+i),
  tap: (_, t) => { if (Date.now() - moved < 350) return; const [l, i] = find(t.dataset.it), it = l[i]; if (!it) return; if (it.t == 'folder') return folder(it); if (edit) return it.t == 'w' && editW(it); it.t == 'app' ? openApp(it.app) : WK[it.k]?.tap?.(it); }, // 不在编辑时点组件：有自己的点击动作就执行（CCD 换照片）
  del: id => { const [l, i] = find(id), it = l[i]; dropMedia(it); it.t == 'folder' && S.desk.pages[cur].push(...it.apps.map(A)); l.splice(i, 1); clean(); },
  wAdd: () => wAddSheet(),
  pAdd: () => { S.desk.pages.push([]); clean(); goPage(S.desk.pages.length - 1); },
});
export function initDesk() {
  S.desk ||= def(); [...S.desk.pages, S.desk.dock].forEach(l => { for (let i = l.length; i--;) { l[i].t == 'w' && !WK[l[i].k] && l.splice(i, 1); l[i]?.k == 'clock' && l[i].p && !l[i].p.v2 && (l[i].p.pos = 'bot', l[i].p.v2 = 1); } }); // 时间小组件：日期默认挪到下面 renderDesk(); // 去掉已经不存在的组件
  ui.desk.addEventListener('pointerdown', e => { if (!edit || e.target.closest('.x,.ed-bar,.dots')) return; const t = e.target.closest('[data-it]'); t && drag(e, t.dataset.it); });
}
