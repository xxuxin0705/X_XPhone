import { photoHtml, photoSizes, playerHtml, PLAYER_STYLES, mountPlayers } from './apps/theme/media-widgets.js';
// 小手机 · 桌面：多页网格 / Dock / 文件夹 / 小组件 / 长按编辑拖拽
import { S, save, esc, uid, $, $$, ui, G, APPS, now, tpl, form, menu, sheet, defAv, btn, openApp, drop as dropMedia, pickFile, pickImg, putMedia, toast } from './core.js';
import { ccdHtml, ccdBg, CCD_BG, CCD_PINK } from './apps/theme/ccd.js';
import { wideHtml, WIDE_SILVER, wideSettings, mountWideVideos } from './apps/theme/ccd-wide.js';
import { liquid } from './glass.js';
import { pageLayout, placeItem, moveItem, fitPages, removeMoodNote, DESK_COLS } from './desk-layout.js';
import { paintFrameHtml, mountPaintPhotos, fitPaintZoom } from './apps/theme/paint-frame.js';
import { badgeHtml, badgeFields, BADGE_DEFAULT } from './apps/theme/badge.js';
import { clkHtml, clkFonts, clkStyle, CLK_DEF } from './apps/theme/clock.js';

const W = (k, w, h, p = {}) => ({ id: uid(), t: 'w', k, w, h, p }), A = app => ({ id: uid(), t: 'app', app });
// 尺寸：只能按原比例放大缩小（2×2 → 1×1 / 3×3 / 4×4；2×1 → 4×2），最大 4 格
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const sizes = (w, h) => { const g = gcd(w, h), rw = w / g, rh = h / g, o = []; for (let k = 1; k * rw <= 4 && k * rh <= 4; k++) o.push([k * rw, k * rh]); return o; };
const szOpt = (w, h) => sizes(w, h).map(([a, b]) => [`${a}x${b}`, `${a}×${b}`]);
// 背景：透明时什么都不用填；纯色 / 毛玻璃一个颜色；渐变两个颜色；都能拖不透明度
const bgF = m => [['bg', '背景', 'sel', CCD_BG], ...(!m.bg || m.bg == 'none' ? [] : [['bgC', '背景颜色', 'color'], ...(m.bg == 'grad' ? [['bgC2', '渐变第二色', 'color']] : []), ['bgA', '背景不透明度', 'range', [0, 100, '%']]])];
export const WK = {
  photo: { n:'图片',w:2,h:2,cls:'plain-photo',f:m=>[['img','图片','img'],['fit','填充方式','sel',[['cover','填满'],['contain','完整显示']]],['zoom','缩放','range',[100,300,'%']],['px','左右位置','range',[0,100,'%']],['py','上下位置','range',[0,100,'%']],['radius','圆角','range',[0,32,'px']]],d:{img:'',fit:'cover',zoom:100,px:50,py:50,radius:24},r:photoHtml },
  record: { n:'唱片播放器',w:2,h:2,cls:'music-record',f:[['skin','样式','sel',PLAYER_STYLES]],d:{skin:'vinyl'},r:playerHtml,after:mountPlayers },
  badgeRound: { n:'圆形磨砂吧唧',w:2,h:2,cls:'photo-badge',f:badgeFields,d:{...BADGE_DEFAULT},r:p=>badgeHtml(p,'circle'),after:mountPaintPhotos },
  badgeHeart: { n:'爱心磨砂吧唧',w:2,h:2,cls:'photo-badge',f:badgeFields,d:{...BADGE_DEFAULT},r:p=>badgeHtml(p,'heart'),after:mountPaintPhotos },
  ccd: { n: 'CCD 相机', w: 2, h: 2, cls: 'ccd',
    f: m => [['img', '照片', 'img'], ['body', '机身颜色', 'color'], ['zoom', '照片缩放', 'range', [50, 300, '%']], ['px', '左右位置', 'range', [0, 100, '%']], ['py', '上下位置', 'range', [0, 100, '%']], ...bgF(m)],
    d: { body: CCD_PINK, zoom: 100, px: 50, py: 50, bg: 'none', bgC: '#ffffff', bgC2: '#ffd6e7', bgA: 60 }, r: (p, it) => ccdHtml(p, it?.w || 2, it?.h || 2) },
  ccdWide: { n: '横版 CCD 相机', w: 4, h: 2, cls: 'ccd-wide',
    f: m => [['body','机身颜色','color'], ['type','屏幕内容','sel',[['photo','照片'],['video','视频']]], ['img','照片 / 视频封面','img'],
      ...(m.type == 'video' ? [['videoTip',`<button class="btn" data-a="wideVideo">${m.video ? '替换视频' : '上传视频'}</button>${m.video ? '<button class="btn" data-a="wideVideoClear">清除视频</button>' : ''}`,'tip']] : []),
      ['zoom','照片 / 视频缩放','range',[50,300,'%']], ['px','左右位置','range',[0,100,'%']], ['py','上下位置','range',[0,100,'%']], ...bgF(m)],
    d: { body:WIDE_SILVER, type:'photo', video:'', zoom:100, px:50, py:50, bg:'none',bgC:'#ffffff',bgC2:'#ffd6e7',bgA:60 },
    r: wideHtml, after: mountWideVideos },
  paint: { n:'Windows 画图相框',w:3,h:3,cls:'paint-frame',
    f:m=>[['img','照片','img'],['zoom','照片缩放','range',[1,300,'%']],['photoFit','<button class="btn" data-a="paintFit">显示完整图片</button><button class="btn" data-a="paintCover">填满相框</button>','tip'],['px','左右位置','range',[0,100,'%']],['py','上下位置','range',[0,100,'%']],...bgF(m)],
    d:{zoom:100,px:50,py:50,bg:'none',bgC:'#ffffff',bgC2:'#ffd6e7',bgA:60},r:paintFrameHtml,after:mountPaintPhotos },
  clock: { n: '时间', w: 4, h: 2, cls: 'clkw',
    f: m => [['source', '时间来源', 'sel', [['real', '现实时间'], ['story', '剧情时间']]], ['font', '字体', 'sel', clkFonts().map(([k, n]) => [k, n])], ['pos', '日期位置', 'sel', [['top', '在时间上面'], ['bot', '在时间下面']]], ['h12', '12 小时制', 'tog'], ['lang', '语言', 'sel', [['zh', '中文'], ['en', 'English']]], ['al', '对齐', 'sel', [['c', '居中'], ['l', '靠左'], ['r', '靠右']]],
      ['auto', '跟随主题配色', 'tog'], ['c', '字体颜色', 'color'], ['a', '不透明度', 'range', [0, 100, '%']], ...bgF(m)],
    d: { ...CLK_DEF, source: 'real', bg: 'none', bgC: '#ffffff', bgC2: '#ffd6e7', bgA: 60 }, r: p => `<div class="ccd-bg" style="${ccdBg(p)}"></div>${clkHtml(p, now(p.source || S.time))}` },
  custom: { n: '自定义组件', w: 2, h: 2, f: [['html', 'HTML / CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']], r: p => p.html || '' },
};
const def = () => ({ pages: [[W('clock', 4, 2, { ...WK.clock.d }), W('ccd', 2, 2, { ...WK.ccd.d }), A('isle')]], dock: [A('chat'), A('music'), A('theme'), A('settings')] });

let edit = 0, cur = 0, moved = 0;
export const icon = id => S.icons[id] ? `<img src="${esc(S.icons[id])}">` : APPS[id]?.icon || '';
const x = id => `<b class="x" data-a="del" data-x="${id}">×</b>`;
const item = (it, pos = '') => it.t == 'w' ? `<div class="it wg w${it.w} h${it.h} k-${it.k} ${WK[it.k]?.cls || ''}"${pos} data-it="${it.id}" data-a="tap" data-lp="dlp">${x(it.id)}${tpl(WK[it.k]?.r(it.p || {}, it))}</div>`
  : `<div class="it app"${pos} data-it="${it.id}" data-a="tap" data-lp="dlp">${it.t == 'folder' ? x(it.id) : ''}<div class="ico ${it.t == 'folder' ? 'fdi' : 'a-' + it.app}">${it.t == 'folder' ? it.apps.map(a => `<i class="ico a-${a}">${icon(a)}</i>`).join('') : icon(it.app)}</div><span>${esc(it.t == 'folder' ? it.name : APPS[it.app]?.name)}</span></div>`;
export function renderDesk() {
  const d = S.desk, el = ui.desk; if (!el) return;
  d.pages = fitPages(d.pages); cur = Math.min(cur,d.pages.length-1);
  el.innerHTML = `<div class="pages">${d.pages.map((p, i) => `<div class="page" data-box="${i}" data-lp="dlp">${pageLayout(p).placed.map(({it,row,col,w,h})=>item(it,` style="grid-column:${col+1}/span ${w};grid-row:${row+1}/span ${h}"`)).join('')}</div>`).join('')}</div><div class="dbar"><div class="dots">${d.pages.map((_, i) => `<i data-a="go" data-x="${i}" class="${i == cur ? 'on' : ''}"></i>`).join('')}</div><div class="ed-bar">${btn('wAdd', '＋ 小组件')}${btn('pAdd', '＋ 页面')}${btn('edDone', '完成', '', 'pri')}</div></div><div class="dock${d.dock.length ? '' : ' empty'}" data-box="dock">${d.dock.map(it=>item(it)).join('')}</div>`;
  mountWideVideos(el); mountPaintPhotos(el); mountPlayers(el);
  liquid($('.dock', el)); liquid($('.dots', el), { bezel: 10, scale: 18 }); $$('.ed-bar .btn', el).forEach(b => liquid(b, { bezel: 12, scale: 22 })); // 底部：液态玻璃
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

// 根节点捕获指针，重画桌面和跨页时仍能继续拖；取消手势恢复原布局。
let dragging = false;
function drag(e, id, longPress = false) {
  const el = $(`[data-it="${id}"]`, ui.desk), [source, at] = find(id), it = source[at];
  if (!el || !it || dragging || e.button > 0 || e.isPrimary === false) return;
  dragging = true;
  const snapshot = structuredClone(S.desk), startPage = cur, R = ui.root, pointer = e.pointerId;
  const sc = R.getBoundingClientRect().width / R.offsetWidth || 1, r0 = el.getBoundingClientRect();
  const ox = e.clientX-r0.left, oy = e.clientY-r0.top, gh = el.cloneNode(true);
  let last=e, et=0, lock=0, dist=0, lastCell='', folderTarget=null;
  Object.assign(gh.style,{position:'absolute',left:0,top:0,width:r0.width/sc+'px',height:r0.height/sc+'px',margin:0});
  gh.classList.add('ghost');gh.removeAttribute('data-it');gh.removeAttribute('data-a');gh.removeAttribute('data-lp');R.append(gh);
  const hold = () => $(`[data-it="${id}"]`,ui.desk)?.classList.add('desk-placeholder');
  const place = ev => { const b=R.getBoundingClientRect();gh.style.transform=`translate(${(ev.clientX-b.left-ox)/sc}px,${(ev.clientY-b.top-oy)/sc}px) scale(1.06)`; };
  const hit = ev => document.elementFromPoint(ev.clientX,ev.clientY);
  const preview = ev => {
    const target=hit(ev), box=target?.closest('[data-box]');folderTarget=null;
    $$('.hov',ui.desk).forEach(x=>x.classList.remove('hov'));
    if(!box || box.dataset.box==='dock')return;
    const targetEl=target.closest('[data-it]'), tg=targetEl && find(targetEl.dataset.it)[0].find(x=>x.id===targetEl.dataset.it);
    if(it.t==='app' && tg && tg!==it && tg.t!=='w') {
      const r=targetEl.getBoundingClientRect();
      if(Math.abs(ev.clientX-r.left-r.width/2)<r.width*.25 && Math.abs(ev.clientY-r.top-r.height/2)<r.height*.25) {
        folderTarget=tg.id;targetEl.classList.add('hov');return;
      }
    }
    const r=box.getBoundingClientRect(), css=getComputedStyle(box), sx=r.width/box.offsetWidth, sy=r.height/box.offsetHeight;
    const top=parseFloat(css.paddingTop), gapX=parseFloat(css.columnGap)||0, gapY=parseFloat(css.rowGap)||0;
    // 使用实际轨道尺寸；短屏网格会水平居中，高屏下方的留白不是行高。
    const cw=parseFloat(css.gridTemplateColumns), ch=parseFloat(css.gridTemplateRows);
    if(!cw || !ch)return;
    const left=(box.clientWidth-DESK_COLS*cw-(DESK_COLS-1)*gapX)/2;
    const col=Math.round(((ev.clientX-r.left-ox)/sx-left)/(cw+gapX)), row=Math.round(((ev.clientY-r.top-oy)/sy-top)/(ch+gapY));
    const key=box.dataset.box+':'+row+':'+col;if(key===lastCell)return;
    if(moveItem(S.desk.pages,it,+box.dataset.box,row,col,S.desk.dock)) { lastCell=key;renderDesk();hold(); }
  };
  const flip = edge => {
    et=0;const n=cur+edge;if(n<0)return;
    if(n>=S.desk.pages.length)S.desk.pages.push([]);
    // 翻页只切换视野；项目随手指落到新页的格子，满页不会凭空跳去第三页。
    cur=n;renderDesk();hold();lock=1;lastCell='';folderTarget=null;navigator.vibrate?.(8);
  };
  const arm = () => {
    const r=ui.desk.getBoundingClientRect(),edge=last.clientX<r.left+36*sc?-1:last.clientX>r.right-36*sc?1:0;
    if(!edge || edge<0 && !cur){clearTimeout(et);et=0;lock=0;return;}
    if(!lock && !et)et=setTimeout(()=>flip(edge),420);
  };
  const mv = ev => {
    if(ev.pointerId!==pointer)return;ev.preventDefault();last=ev;
    dist=Math.max(dist,Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY));place(ev);
    if(dist>6){preview(ev);arm();}
  };
  const finish = ev => {
    if(ev.pointerId!==pointer)return;
    R.removeEventListener('pointermove',mv);R.removeEventListener('pointerup',finish);R.removeEventListener('pointercancel',finish);R.removeEventListener('lostpointercapture',finish);
    clearTimeout(et);gh.remove();dragging=false;
    if(R.hasPointerCapture?.(pointer))R.releasePointerCapture(pointer);
    if(dist>6)moved=Date.now();
    if(ev.type!=='pointerup') { S.desk=snapshot;cur=startPage;renderDesk();return; }
    if(dist<=6){renderDesk();if(!longPress)G.tap('', $(`[data-it="${id}"]`,ui.desk));return;}
    const target=hit(ev), box=target?.closest('[data-box]');
    if(folderTarget && box && box.dataset.box!=='dock') {
      const [tl,ti]=find(folderTarget),tg=tl[ti],[sl,si]=find(id);
      if(tg && si>=0){sl.splice(si,1);if(tg.t==='folder')tg.apps.push(it.app);else tl.splice(tl.indexOf(tg),1,{id:uid(),t:'folder',name:'文件夹',apps:[tg.app,it.app],row:tg.row,col:tg.col});}
    } else if(box?.dataset.box==='dock' && it.t!=='w') {
      const [sl,si]=find(id), tl=S.desk.dock;
      if(sl===tl || tl.length<4){sl.splice(si,1);const to=target.closest('[data-it]'),i=tl.findIndex(x=>x.id===to?.dataset.it);tl.splice(i<0?tl.length:i,0,it);delete it.row;delete it.col;}
    } else if(box) { lastCell='';preview(ev); }
    clean();
  };
  place(e);hold();R.setPointerCapture?.(pointer);
  R.addEventListener('pointermove',mv);R.addEventListener('pointerup',finish);R.addEventListener('pointercancel',finish);R.addEventListener('lostpointercapture',finish);
}
// 编辑时：轻扫翻页，按住 240ms 拖动；空白处也能翻页。指针一直捕获在稳定根节点。
function editGesture(e) {
  if(!edit || dragging || e.button>0 || e.isPrimary===false || e.target.closest('.x,.ed-bar,.dots'))return;
  const pg=e.target.closest('.pages'), itemEl=e.target.closest('[data-it]');
  if(!pg && !itemEl)return;
  e.preventDefault();e.stopPropagation();
  const R=ui.root, pointer=e.pointerId, start=cur, at=Date.now(), width=pg?.clientWidth||0;
  const scale=pg ? pg.getBoundingClientRect().width/width||1 : 1;
  let mode='', dx=0, timer;
  const off = release => {
    clearTimeout(timer);R.removeEventListener('pointermove',move);R.removeEventListener('pointerup',end);R.removeEventListener('pointercancel',end);R.removeEventListener('lostpointercapture',end);
    if(release && R.hasPointerCapture?.(pointer))R.releasePointerCapture(pointer);
  };
  const lift = () => { off(false);drag(e,itemEl.dataset.it); };
  const move = ev => {
    if(ev.pointerId!==pointer)return;ev.preventDefault();
    dx=(ev.clientX-e.clientX)/scale;const dy=(ev.clientY-e.clientY)/scale;
    if(!mode && Math.hypot(dx,dy)>8){
      clearTimeout(timer);
      if(pg && Math.abs(dx)>Math.abs(dy)*1.2){mode='swipe';pg.style.scrollSnapType='none';}
      else if(itemEl){lift();return;}
    }
    if(mode==='swipe')pg.scrollLeft=start*width-dx;
  };
  const end = ev => {
    if(ev.pointerId!==pointer)return;
    off(true);
    if(mode==='swipe') {
      pg.style.scrollSnapType='';moved=Date.now();
      const turn=ev.type==='pointerup' && (Math.abs(dx)>width*.18 || Math.abs(dx)>24 && Math.abs(dx)/(Date.now()-at)>.35);
      goPage(start+(turn ? (dx<0?1:-1) : 0));
    } else if(ev.type==='pointerup' && itemEl) { G.tap('',itemEl);moved=Date.now(); }
  };
  R.setPointerCapture?.(pointer);
  R.addEventListener('pointermove',move);R.addEventListener('pointerup',end);R.addEventListener('pointercancel',end);R.addEventListener('lostpointercapture',end);
  if(itemEl)timer=setTimeout(lift,240);
}
function folder(it) {
  const s = sheet({
    cls: 'fold', noBack: 1, title: `<input class="fd-n" value="${esc(it.name)}">`,
    body: () => `<div class="fd-g">${it.apps.map((a, i) => `<div class="it app" data-a="fo" data-x="${a}" data-lp="fout" data-i="${i}"><div class="ico a-${a}">${icon(a)}</div><span>${esc(APPS[a]?.name)}</span></div>`).join('')}</div><p class="tip">长按图标可移出文件夹</p>`,
    acts: { fo: a => { s.close(); openApp(a); }, fout: (a, t) => { it.apps.splice(t.dataset.i, 1); cur = placeItem(S.desk.pages,A(a),cur); s.close(); } },
    onClose: () => { it.name = $('.fd-n', s.el)?.value || it.name; clean(); },
  });
}
// 和桌面共用渲染器，保留选定的宽高比例；预览没有桌面编辑按钮或点击动作。
const widgetPreview = (it, m) => {
  const K = WK[it.k], { sz, ...p } = m, [w, h] = sz.split('x').map(Number);
  return `<div class="wedit-preview"><div class="wedit-pv-head"><span>样式预览</span><small>${w}×${h}</small></div><div class="wedit-stage"><div class="wprev" style="width:min(100%,${Math.min(w * 72, 210 * w / h)}px);aspect-ratio:${w}/${h}"><div class="it wg w${w} h${h} k-${it.k} ${K.cls || ''}">${tpl(K.r(p, { ...it, w, h }))}</div></div></div></div>`;
};
async function editW(it) {
  const K = WK[it.k], apply = (m, key) => { if (it.k === 'clock' && (m.c !== (it.p?.c ?? K.d.c) || m.a !== (it.p?.a ?? K.d.a))) m.auto = false; const { sz, ...p } = m; if (it.k === 'clock' && ['c', 'a', 'auto'].includes(key)) { it.p = p; const node = [...ui.desk.querySelectorAll('[data-it]')].find(el => el.dataset.it === it.id)?.querySelector('.clk'); if (node) node.style.cssText = clkStyle(p); save(); return; } [it.w, it.h] = sz.split('x').map(Number); it.p = p; const page = S.desk.pages.findIndex(list=>list.includes(it)); if(page>=0)cur = placeItem(S.desk.pages,it,page); save(); renderDesk(); };
  const videoActs = {
    wideVideo: async (_, t, e, pg) => { const file = await pickFile('video/*'); if(!file) return; if(file.size > 40e6) return toast('视频超过 40MB，请选择小一点的视频'); try { const value = await putMedia(file,'widget'); if(!pg.el.isConnected) { dropMedia(value); return; } const m = pg.model(), old = m.video; m.video = value; apply(m); pg.reb(); old && dropMedia(old); } catch { toast('视频上传失败，请重试'); } },
    wideVideoClear: (_, t, e, pg) => { const m=pg.model(), old=m.video; m.video='';apply(m);pg.reb();old && dropMedia(old); },
  };
  const paintActs = {
    img: async (key, t, e, pg) => {
      const value = await pickImg(0, 'widget', true); if(value == null)return;
      if(!pg.el.isConnected){dropMedia(value);return;}
      const m=pg.model(),old=m[key];m[key]=value;apply(m);pg.reb();old && dropMedia(old);
    },
    paintFit: (_, t, e, pg) => { const m=pg.model(),img=$('.form-preview .paint-photo>img',pg.el);if(!img?.naturalWidth)return;Object.assign(m,{zoom:fitPaintZoom(img),px:50,py:50});apply(m);pg.reb(); },
    paintCover: (_, t, e, pg) => { const m=pg.model();Object.assign(m,{zoom:100,px:50,py:50});apply(m);pg.reb(); },
  };
  await form(K.n, m => [...(typeof K.f == 'function' ? K.f(m) : K.f || []), ['sz', '尺寸', 'sel', it.k === 'photo' ? photoSizes() : szOpt(K.w, K.h)]], { ...K.d, ...it.p, ...(it.k === 'clock' ? { source: it.p?.source || S.time } : {}), sz: it.w + 'x' + it.h }, it.k == 'ccdWide' ? videoActs : it.k == 'paint' ? paintActs : ['badgeRound','badgeHeart','photo'].includes(it.k) ? {img:paintActs.img} : {}, (k, v, m, s) => { if (it.k === 'clock' && ['c', 'a', 'auto'].includes(k)) { const toggle = s.el.querySelector('[data-k=auto]'); if (toggle) toggle.checked = m.auto; return; } if (['bg', 'auto', 'type'].includes(k)) s.reb(); }, { patchPreview: (m, el, k) => { if (it.k !== 'clock' || !['c', 'a', 'auto'].includes(k)) return false; const clock = el.querySelector('.clk'); if (!clock) return false; clock.style.cssText = clkStyle(m); return true; }, preview: m => widgetPreview(it, m), live: apply, after: K.after });
}
// 添加小组件：按尺寸筛选，每个组件的每种尺寸都有一张实际渲染的预览卡片
const CELL = 64; // 预览里一格的边长
function wAddSheet() {
  const all = [...Object.entries(WK).filter(([k]) => k != 'custom').map(([k, v]) => ({ k, w: v.w, h: v.h, n: v.n, cls: v.cls || '', p: { ...v.d }, mk: () => W(k, v.w, v.h, { ...v.d }) })), // 每个组件一张，按它自己的尺寸；大小加到桌面后长按再改
    ...S.assets.widget.map(a => { const [w, h] = (a.sz || '2x2').split('x').map(Number); return { k: 'custom', w, h, n: a.name, cls: '', p: { html: a.html }, mk: () => W('custom', w, h, { html: a.html }) }; })];
  const szs = [...new Set(all.map(e => `${e.w}x${e.h}`))].sort((a, b) => a.split('x').reduce((x, y) => x * y) - b.split('x').reduce((x, y) => x * y) || a.localeCompare(b));
  let fz = '';
  const card = (e, i) => `<div class="wcard" data-a="pick" data-x="${i}" data-k="${e.k}" data-sz="${e.w}x${e.h}"><div class="wprev" style="width:${e.w * CELL}px;height:${e.h * CELL}px"><div class="it wg w${e.w} h${e.h} k-${e.k} ${e.cls}">${tpl(WK[e.k].r(e.p, { w: e.w, h: e.h }))}</div></div><span class="wc-n">${esc(e.n)}</span><span class="wc-s">${e.w}×${e.h}</span></div>`;
  const s = sheet({ cls: 'wadd', noBack: 1, title: '添加小组件', after: el => { mountPaintPhotos(el); mountPlayers(el); },
    body: () => `<div class="szf">${[['', '全部尺寸'], ...szs.map(z => [z, z.replace('x', '×')])].map(([v, l]) => `<b class="${fz == v ? 'on' : ''}" data-a="szf" data-x="${v}">${l}</b>`).join('')}</div><div class="wgrid">${all.map((e, i) => !fz || `${e.w}x${e.h}` == fz ? card(e, i) : '').join('')}</div>`,
    acts: { szf: v => { fz = v; s.reb(); }, pick: i => { cur = placeItem(S.desk.pages,all[+i].mk(),cur); s.close(); clean(); } } });
}
Object.assign(G, {
  dlp: (_, t, e) => { if (edit) return; edit = 1; ui.desk.classList.add('edit'); t.dataset.it && drag(e, t.dataset.it, true); },
  edDone: () => { edit = 0; ui.desk.classList.remove('edit'); clean(); },
  go: i => goPage(+i),
  tap: (_, t) => { if (dragging || Date.now() - moved < 350) return; const [l, i] = find(t.dataset.it), it = l[i]; if (!it) return; if (it.t == 'folder' && !edit) return folder(it); if (edit) return it.t == 'w' && editW(it); it.t == 'app' && openApp(it.app); }, // 组件仅在长按进入编辑模式后可修改；普通点击不打开上传菜单。
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
  if (!S.deskIsle) { S.deskIsle = 1; [...S.desk.pages.flat(), ...S.desk.dock].some(x => x.app == 'isle' || x.apps?.includes('isle')) || placeItem(S.desk.pages, A('isle'), 0); } // 新增的心屿：老桌面也放一个
  if (!S.deskMusic) { S.deskMusic = 1; const has = [...S.desk.pages.flat(), ...S.desk.dock].some(x => x.app == 'music' || x.apps?.includes('music')); has || (S.desk.dock.length < 4 ? S.desk.dock.splice(1, 0, A('music')) : placeItem(S.desk.pages, A('music'), 0)); } // 新增的音乐 App：老桌面也放一个
  S.desk.pages = fitPages(S.desk.pages); save(); renderDesk();
  ui.desk.addEventListener('pointerdown', editGesture);
}


