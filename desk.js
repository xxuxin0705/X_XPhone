// 小手机 · 桌面：多页网格 / Dock / 文件夹 / 小组件 / 长按编辑拖拽
import { S, save, esc, uid, $, $$, ui, G, APPS, now, tpl, form, menu, sheet, defAv, btn, openApp, drop as dropMedia, pickImg, pickFile, putMedia, toast } from './core.js';
import { ccdHtml, ccdBg, CCD_BG, CCD_PINK } from './apps/theme/ccd.js';
import { wideHtml, WIDE_SILVER, wideSettings, mountWideVideos } from './apps/theme/ccd-wide.js';
import { pageLayout, placeItem, fitPages, removeMoodNote } from './desk-layout.js';
import { clkHtml, clkFonts, CLK_DEF } from './apps/theme/clock.js';

const W = (k, w, h, p = {}) => ({ id: uid(), t: 'w', k, w, h, p }), A = app => ({ id: uid(), t: 'app', app });
// 尺寸：只能按原比例放大缩小（2×2 → 1×1 / 3×3 / 4×4；2×1 → 4×2），最大 4 格
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const sizes = (w, h) => { const g = gcd(w, h), rw = w / g, rh = h / g, o = []; for (let k = 1; k * rw <= 4 && k * rh <= 4; k++) o.push([k * rw, k * rh]); return o; };
const szOpt = (w, h) => sizes(w, h).map(([a, b]) => [`${a}x${b}`, `${a}×${b}`]);
// 背景：透明时什么都不用填；纯色 / 毛玻璃一个颜色；渐变两个颜色；都能拖不透明度
const bgF = m => [['bg', '背景', 'sel', CCD_BG], ...(!m.bg || m.bg == 'none' ? [] : [['bgC', '背景颜色', 'color'], ...(m.bg == 'grad' ? [['bgC2', '渐变第二色', 'color']] : []), ['bgA', '背景不透明度', 'range', [0, 100, '%']]])];
export const WK = {
  ccd: { n: 'CCD 相机', w: 2, h: 2, cls: 'ccd',
    f: m => [['img', '照片', 'img'], ['body', '机身颜色', 'color'], ['zoom', '照片缩放', 'range', [50, 300, '%']], ['px', '左右位置', 'range', [0, 100, '%']], ['py', '上下位置', 'range', [0, 100, '%']], ...bgF(m)],
    d: { body: CCD_PINK, zoom: 100, px: 50, py: 50, bg: 'none', bgC: '#ffffff', bgC2: '#ffd6e7', bgA: 60 }, r: (p, it) => ccdHtml(p, it?.w || 2, it?.h || 2), tap: it => ccdPhoto(it) },
  ccdWide: { n: '横版 CCD 相机', w: 4, h: 2, cls: 'ccd-wide',
    f: m => [['body','机身颜色','color'], ['type','屏幕内容','sel',[['photo','照片'],['video','视频']]], ['img','照片 / 视频封面','img'],
      ...(m.type == 'video' ? [['videoTip',`<button class="btn" data-a="wideVideo">${m.video ? '替换视频' : '上传视频'}</button>${m.video ? '<button class="btn" data-a="wideVideoClear">清除视频</button>' : ''}`,'tip']] : []),
      ['zoom','照片 / 视频缩放','range',[50,300,'%']], ['px','左右位置','range',[0,100,'%']], ['py','上下位置','range',[0,100,'%']], ...bgF(m)],
    d: { body:WIDE_SILVER, type:'photo', video:'', zoom:100, px:50, py:50, bg:'none',bgC:'#ffffff',bgC2:'#ffd6e7',bgA:60 },
    r: wideHtml, after: mountWideVideos,
    tap: it => { if(it.p.type != 'video') return ccdPhoto(it); ui.desk.querySelectorAll(`[data-it="${it.id}"] video`).forEach(v=>v.play?.().catch(()=>{})); } },
  clock: { n: '时间', w: 2, h: 1, cls: 'clkw',
    f: m => [['font', '字体', 'sel', clkFonts().map(([k, n]) => [k, n])], ['pos', '日期位置', 'sel', [['top', '在时间上面'], ['bot', '在时间下面']]], ['h12', '12 小时制', 'tog'], ['lang', '语言', 'sel', [['zh', '中文'], ['en', 'English']]], ['al', '对齐', 'sel', [['c', '居中'], ['l', '靠左'], ['r', '靠右']]],
      ['auto', '跟随主题配色', 'tog'], ...(m.auto === false ? [['c', '颜色', 'color'], ['a', '不透明度', 'range', [0, 100, '%']]] : []), ...bgF(m)],
    d: { ...CLK_DEF, bg: 'none', bgC: '#ffffff', bgC2: '#ffd6e7', bgA: 60 }, r: p => `<div class="ccd-bg" style="${ccdBg(p)}"></div>${clkHtml(p, now())}` },
  custom: { n: '自定义组件', w: 2, h: 2, f: [['html', 'HTML / CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']], r: p => p.html || '' },
};
const def = () => ({ pages: [[W('clock', 4, 2, { ...WK.clock.d }), W('ccd', 2, 2, { ...WK.ccd.d })]], dock: [A('chat'), A('theme'), A('settings')] });

let edit = 0, cur = 0, moved = 0;
export const icon = id => S.icons[id] ? `<img src="${esc(S.icons[id])}">` : APPS[id]?.icon || '';
const x = id => `<b class="x" data-a="del" data-x="${id}">×</b>`;
const item = (it, pos = '') => it.t == 'w' ? `<div class="it wg w${it.w} h${it.h} k-${it.k} ${WK[it.k]?.cls || ''}"${pos} data-it="${it.id}" data-a="tap" data-lp="dlp">${x(it.id)}${tpl(WK[it.k]?.r(it.p || {}, it))}</div>`
  : `<div class="it app"${pos} data-it="${it.id}" data-a="tap" data-lp="dlp">${it.t == 'folder' ? x(it.id) : ''}<div class="ico ${it.t == 'folder' ? 'fdi' : 'a-' + it.app}">${it.t == 'folder' ? it.apps.map(a => `<i class="ico a-${a}">${icon(a)}</i>`).join('') : icon(it.app)}</div><span>${esc(it.t == 'folder' ? it.name : APPS[it.app]?.name)}</span></div>`;
export function renderDesk() {
  const d = S.desk, el = ui.desk; if (!el) return;
  d.pages = fitPages(d.pages); cur = Math.min(cur,d.pages.length-1);
  el.innerHTML = `<div class="pages">${d.pages.map((p, i) => `<div class="page" data-box="${i}" data-lp="dlp">${pageLayout(p).placed.map(({it,row,col,w,h})=>item(it,` style="grid-column:${col+1}/span ${w};grid-row:${row+1}/span ${h}"`)).join('')}</div>`).join('')}</div><div class="dots">${d.pages.map((_, i) => `<i data-a="go" data-x="${i}" class="${i == cur ? 'on' : ''}"></i>`).join('')}</div><div class="ed-bar">${btn('wAdd', '＋ 小组件')}${btn('pAdd', '＋ 页面')}${btn('edDone', '完成', '', 'pri')}</div><div class="dock" data-box="dock">${d.dock.map(it=>item(it)).join('')}</div>`;
  mountWideVideos(el);
  const pg = $('.pages', el); pg.scrollLeft = cur * pg.clientWidth;
  pg.onscroll = () => { const i = Math.round(pg.scrollLeft / pg.clientWidth); i != cur && (cur = i, $$('.dots i', el).forEach((x, j) => x.classList.toggle('on', j == i))); };
}
const find = id => { for (const l of [...S.desk.pages, S.desk.dock]) { const i = l.findIndex(x => x.id == id); if (i > -1) return [l, i]; } return [[], -1]; };
function clean() {
  const d = S.desk; [...d.pages, d.dock].forEach(l => l.forEach((it, i) => it.t == 'folder' && it.apps.length < 2 && l.splice(i, 1, ...it.apps.map(A))));
  d.pages = fitPages(d.pages);
  const active = d.pages[cur]; d.pages = d.pages.filter(p => p.length || edit); d.pages.length || d.pages.push([]); cur = active && d.pages.includes(active) ? d.pages.indexOf(active) : Math.min(cur, d.pages.length - 1); save(); renderDesk();
}
export function addDeskWidget(it, index = cur) { cur = placeItem(S.desk.pages,it,index); save(); renderDesk(); return cur; }
const goPage = i => { cur = Math.max(0, Math.min(i, S.desk.pages.length - 1)); const p = $('.pages', ui.desk); p.scrollTo({ left: cur * p.clientWidth, behavior: 'smooth' }); };

// 拖动：拿起来的是一个浮在最上层的「影子」，原位置留个半透明占位；拖到左右边缘停一下就翻页（平滑滑过去，手不用松）
function drag(e, id) {
  let el = $(`[data-it="${id}"]`, ui.desk), last = e, et, dist = 0, lock = 0; // lock：刚翻过页，手离开边缘才能再翻
  if (!el) return;
  const R = ui.root, rr = () => R.getBoundingClientRect(), sc = rr().width / R.offsetWidth || 1, pd = ev => ev.preventDefault();
  const r0 = el.getBoundingClientRect(), gh = el.cloneNode(true), ox = (e.clientX - r0.left) / sc, oy = (e.clientY - r0.top) / sc;
  Object.assign(gh.style, { position: 'absolute', left: 0, top: 0, width: r0.width / sc + 'px', height: r0.height / sc + 'px', margin: 0 }); gh.classList.add('ghost'); gh.removeAttribute('data-it'); R.append(gh);
  const place = ev => { const b = rr(); gh.style.transform = `translate(${(ev.clientX - b.left) / sc - ox}px,${(ev.clientY - b.top) / sc - oy}px) scale(1.06)`; };
  const hold = () => { el = $(`[data-it="${id}"]`, ui.desk); el?.classList.add('ph'); };
  place(e); hold();
  const flip = edge => { et = 0; const n = cur + edge; if (n < 0) return; n >= S.desk.pages.length && S.desk.pages.push([]);
    const [l, i] = find(id), it = l[i], from = cur; cur = placeItem(S.desk.pages,it,n); renderDesk(); hold();
    const p = $('.pages', ui.desk), targetPage = cur; p.scrollLeft = from * p.clientWidth; requestAnimationFrame(() => p.scrollTo({ left: targetPage * p.clientWidth, behavior: 'smooth' }));
    navigator.vibrate?.(8); lock = 1; };
  const arm = () => { const r = ui.desk.getBoundingClientRect(), x = last.clientX, edge = x < r.left + 36 * sc ? -1 : x > r.right - 36 * sc ? 1 : 0;
    if (!edge || edge < 0 && !cur) { clearTimeout(et); et = 0; lock = 0; return; } if (lock) return; et ||= setTimeout(() => flip(edge), 420); };
  const mv = ev => {
    last = ev; dist = Math.max(dist, Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY)); place(ev); arm();
    $$('.hov', ui.desk).forEach(x => x.classList.remove('hov')); document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-it]')?.classList.add('hov');
  };
  const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('touchmove', pd); clearTimeout(et); dist > 6 && (moved = Date.now()); gh.remove(); drop(id, ev, $(`[data-it="${id}"]`, ui.desk)); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('touchmove', pd, { passive: false });
}
function drop(id, ev, el) {
  const p = document.elementFromPoint(ev.clientX, ev.clientY);
  el?.classList.remove('ph'); $$('.hov', ui.desk).forEach(x => x.classList.remove('hov'));
  const te = p?.closest('[data-it]'), box = p?.closest('[data-box]'), [sl, si] = find(id), it = sl[si];
  if (!box || te == el) return clean();
  const tl = box.dataset.box == 'dock' ? S.desk.dock : S.desk.pages[box.dataset.box];
  if (tl == S.desk.dock && (it.t == 'w' || (sl != tl && tl.length >= 4))) return renderDesk();
  if (te) {
    const tg = tl.find(x => x.id == te.dataset.it), r = te.getBoundingClientRect(), mid = Math.abs(ev.clientX - r.left - r.width / 2) < r.width * .3 && Math.abs(ev.clientY - r.top - r.height / 2) < r.height * .3;
    sl.splice(si, 1);
    if (it.t == 'app' && tg.t != 'w' && mid) tg.t == 'folder' ? tg.apps.push(it.app) : tl.splice(tl.indexOf(tg), 1, { id: uid(), t: 'folder', name: '文件夹', apps: [tg.app, it.app] });
    else tl.splice(tl.indexOf(tg), 0, it);
  } else sl.splice(si, 1), tl.push(it);
  if(tl != S.desk.dock && tl.includes(it)) cur = placeItem(S.desk.pages,it,S.desk.pages.indexOf(tl));
  clean();
}
function folder(it) {
  const s = sheet({
    cls: 'fold', noBack: 1, title: `<input class="fd-n" value="${esc(it.name)}">`,
    body: () => `<div class="fd-g">${it.apps.map((a, i) => `<div class="it app" data-a="fo" data-x="${a}" data-lp="fout" data-i="${i}"><div class="ico a-${a}">${icon(a)}</div><span>${esc(APPS[a]?.name)}</span></div>`).join('')}</div><p class="tip">长按图标可移出文件夹</p>`,
    acts: { fo: a => { s.close(); openApp(a); }, fout: (a, t) => { it.apps.splice(t.dataset.i, 1); cur = placeItem(S.desk.pages,A(a),cur); s.close(); } },
    onClose: () => { it.name = $('.fd-n', s.el)?.value || it.name; clean(); },
  });
}
// CCD：点一下换照片
async function ccdPhoto(it) { const v = await pickImg(1080, 'img'); if (v == null) return; const old = it.p.img; it.p.img = v || ''; save(); old && dropMedia(old); renderDesk(); }
// 和桌面共用渲染器，保留选定的宽高比例；预览没有桌面编辑按钮或点击动作。
const widgetPreview = (it, m) => {
  const K = WK[it.k], { sz, ...p } = m, [w, h] = sz.split('x').map(Number);
  return `<div class="wedit-preview"><div class="wedit-pv-head"><span>样式预览</span><small>${w}×${h}</small></div><div class="wedit-stage"><div class="wprev" style="width:min(100%,${Math.min(w * 72, 210 * w / h)}px);aspect-ratio:${w}/${h}"><div class="it wg w${w} h${h} k-${it.k} ${K.cls || ''}">${tpl(K.r(p, { ...it, w, h }))}</div></div></div></div>`;
};
async function editW(it) {
  const K = WK[it.k], apply = m => { const { sz, ...p } = m; [it.w, it.h] = sz.split('x').map(Number); it.p = p; const page = S.desk.pages.findIndex(list=>list.includes(it)); if(page>=0)cur = placeItem(S.desk.pages,it,page); save(); renderDesk(); };
  const videoActs = {
    wideVideo: async (_, t, e, pg) => { const file = await pickFile('video/*'); if(!file) return; if(file.size > 40e6) return toast('视频超过 40MB，请选择小一点的视频'); try { const value = await putMedia(file,'widget'); if(!pg.el.isConnected) { dropMedia(value); return; } const m = pg.model(), old = m.video; m.video = value; apply(m); pg.reb(); old && dropMedia(old); } catch { toast('视频上传失败，请重试'); } },
    wideVideoClear: (_, t, e, pg) => { const m=pg.model(), old=m.video; m.video='';apply(m);pg.reb();old && dropMedia(old); },
  };
  await form(K.n, m => [...(typeof K.f == 'function' ? K.f(m) : K.f || []), ['sz', '尺寸', 'sel', szOpt(K.w, K.h)]], { ...K.d, ...it.p, sz: it.w + 'x' + it.h }, it.k == 'ccdWide' ? videoActs : {}, (k, v, m, s) => ['bg', 'auto', 'type'].includes(k) && s.reb(), { preview: m => widgetPreview(it, m), live: apply, after: K.after });
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
    acts: { szf: v => { fz = v; s.reb(); }, pick: i => { cur = placeItem(S.desk.pages,all[+i].mk(),cur); s.close(); clean(); } } });
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
  S.desk ||= def();
  let migrated = removeMoodNote(S);
  for (const it of [...S.desk.pages.flat(), ...S.desk.dock]) if (it.k == 'ccdWide' && it.p && ['style','sticker','sx','sy','ss'].some(k => k in it.p)) {
    const sticker = it.p.sticker; it.p = wideSettings(it.p); sticker && dropMedia(sticker); migrated = true;
  }
  migrated && save(); [...S.desk.pages, S.desk.dock].forEach(l => { for (let i = l.length; i--;) { l[i].t == 'w' && !WK[l[i].k] && l.splice(i, 1); l[i]?.k == 'clock' && l[i].p && !l[i].p.v2 && (l[i].p.pos = 'bot', l[i].p.v2 = 1); l[i]?.t == 'w' && l[i].p && delete l[i].p.wt; } }); // 时间小组件：日期默认在下面
  S.desk.pages = fitPages(S.desk.pages); save(); renderDesk();
  ui.desk.addEventListener('pointerdown', e => { if (!edit || e.target.closest('.x,.ed-bar,.dots')) return; const t = e.target.closest('[data-it]'); t && drag(e, t.dataset.it); });
}

