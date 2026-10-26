import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
let page;
const host = { innerHTML: '' };
const setP = (o, k, v) => { const a = k.split('.'); const last = a.pop(); for (const part of a) o = o[part] ||= {}; o[last] = v; };
const esc = s => String(s ?? '');
const fields = { inp: (k,l) => `<input data-k="${k}">`, sel: (k,l) => `<select data-k="${k}"></select>` };
const sheet = o => { page = o; o.el = {}; o.close = () => o.onClose(); o.reb = () => {}; return o; };
const source = read('core.js').split('export const form = ')[1].split('// 可折叠')[0].trim().replace(/;$/, '');
const form = new Function('sheet', 'fx', '$', 'setP', 'esc', 'btn', 'drop', `return (${source});`)(sheet, () => fields, () => host, setP, esc, () => '<button>保存</button>', () => {});
const original = { zoom: 100, px: 50, html: '原内容' };
const preview = m => `<b>${m.zoom}|${m.px}|${m.html}</b>`;
const result = form('组件', [['zoom','缩放','range',[50,300,'%']]], original, {}, () => {}, { preview });
assert.match(page.body(), /form-preview/);
page.after(page.el);
const model = page.model();
const input = (k, value, type = 'range') => page.el.oninput({ target: { dataset: { k }, value, type, closest: () => null } });
input('zoom', '175'); assert.equal(host.innerHTML, '<b>175|50|原内容</b>');
assert.equal(model.zoom, 100); assert.equal(original.zoom, 100);
input('html', '新内容', 'textarea'); assert.match(host.innerHTML, /新内容/);
model.zoom = 175; page.onChange('zoom', 175); assert.match(host.innerHTML, /175/);
page.acts.ok(); assert.equal((await result).zoom, 175); assert.equal(original.zoom, 100);
const cancel = form('取消', [], original, {}, null, { preview }); page.close(); assert.equal(await cancel, null);
const plain = form('普通表单', [], {}); assert.doesNotMatch(page.body(), /form-preview/);page.close();await plain;
// 实时设置不显示保存；输入时更新模型，关闭不回滚，包含新照片和尺寸。
let applied;
const liveResult = form('实时组件', [['zoom','缩放','range',[50,300,'%']]], original, {}, null, { preview, live: m => { applied = structuredClone(m); } });
assert.doesNotMatch(page.body(), /<button>/);
page.after(page.el);
input('zoom', '190'); assert.equal(applied.zoom, 190); assert.equal(page.model().zoom, 190);
input('html', '实时文字', 'textarea'); assert.equal(applied.html, '实时文字');
page.model().img = 'new-photo.webp'; page.onChange('img', 'new-photo.webp'); assert.equal(applied.img, 'new-photo.webp');
page.model().sz = '4x4'; page.onChange('sz', '4x4'); assert.equal(applied.sz, '4x4');
page.close(); const liveValue = await liveResult; assert.equal(liveValue.zoom, 190); assert.equal(liveValue.html, '实时文字'); assert.equal(liveValue.img, 'new-photo.webp');
// 通过真实组件渲染器生成设置预览，检查每种类型、尺寸、样式和模板变量。
const ck = await import(new URL('apps/theme/clock.js', root));
const ccd = await import(new URL('apps/theme/ccd.js', root));
const wide = await import(new URL('apps/theme/ccd-wide.js', root));
const layout = await import(new URL('desk-layout.js', root));
const paint = await import(new URL('apps/theme/paint-frame.js', root));
const badge = await import(new URL('apps/theme/badge.js', root));
const coreStub = { S: {assets:{widget:[]},icons:{}}, save(){}, esc, uid:()=> 'id', $:()=>null, $$:()=>[], ui:{}, G:{}, APPS:{}, now:()=>new Date(2026,9,26,10,32), tpl:s=>s.replaceAll('{{user}}','测试用户'), form, menu(){}, sheet, defAv(){}, btn(){}, openApp(){}, dropMedia(){}, pickImg(){} };
globalThis.widgetTest = {...coreStub,...ck,...ccd,...wide,...layout,...paint,...badge};
let desk = read('desk.js').replace(/^import .*?;$/gm, '');
desk = `const {${[...Object.keys(coreStub), 'ccdHtml','ccdBg','CCD_BG','CCD_PINK','clkHtml','clkFonts','CLK_DEF','paintFrameHtml','mountPaintPhotos','fitPaintZoom','badgeHtml','badgeFields','BADGE_DEFAULT','pageLayout','placeItem','fitPages','removeMoodNote','wideHtml','WIDE_SILVER','wideSettings','mountWideVideos','pickFile','putMedia','toast'].join(',')}} = globalThis.widgetTest;` + desk + '\nexport { widgetPreview };';
const dk = await import('data:text/javascript;base64,'+Buffer.from(desk).toString('base64'));
for (const [k,K] of Object.entries(dk.WK)) {
 const it = { k, w:K.w,h:K.h };
 const props = {...K.d,html:'<b>{{user}}</b>',sz:`${K.w}x${K.h}`};
 const html = dk.widgetPreview(it,props);
 assert.match(html,/样式预览/);assert.match(html,new RegExp(`k-${k}`));
 assert.doesNotMatch(html,/data-a="tap"|data-lp="dlp"/);
 if(k==='custom') assert.match(html,/测试用户/);
 const large = dk.widgetPreview(it,{...props,sz:'4x4'});assert.match(large,/aspect-ratio:4\/4/);
}
assert.deepEqual(dk.sizes(dk.WK.ccdWide.w,dk.WK.ccdWide.h),[[2,1],[4,2]]);
const widePreview=dk.widgetPreview({k:'ccdWide'},{...dk.WK.ccdWide.d,sz:'4x2'});
assert.doesNotMatch(widePreview,/data-a="wideStyle"/);
assert.equal(dk.WK.ccdWide.d.body,wide.WIDE_SILVER);
assert(dk.WK.ccdWide.f(dk.WK.ccdWide.d).some(f=>f[0]==='body'&&f[2]==='color'));
assert(dk.WK.ccdWide.f({...dk.WK.ccdWide.d,type:'video'}).some(f=>f[0]==='videoTip'));
assert(!dk.WK.ccdWide.f({...dk.WK.ccdWide.d,sticker:'sticker.png'}).some(f=>['sticker','sx','sy','ss','style'].includes(f[0])));
for(const bg of ['none','glass','solid','grad']) {
 const fields=dk.WK.ccdWide.f({...dk.WK.ccdWide.d,bg}).filter(f=>f[0].startsWith('bg'));
 const previous=dk.WK.ccd.f({...dk.WK.ccd.d,bg}).filter(f=>f[0].startsWith('bg'));assert.deepEqual(fields,previous);
}
assert.equal(dk.WK.paint.w,3);assert.equal(dk.WK.paint.h,3);
assert.deepEqual(dk.sizes(3,3),[[1,1],[2,2],[3,3],[4,4]]);
assert(!dk.WK.paint.f(dk.WK.paint.d).some(f=>f[0]==='body'||f[0]==='style'));
assert(!dk.WK.ccd.tap && !dk.WK.ccdWide.tap && !dk.WK.paint.tap);
const camera=dk.widgetPreview({k:'ccd'},{...dk.WK.ccd.d,img:'photo.webp',zoom:180,px:20,py:70,sz:'2x2'});
assert.match(camera,/object-position:center;transform:translate\(-30%,20%\) scale\(1.8\)/);
// 不论照片原始比例或缩放多少，横向和纵向都直接平移，中心点保持不偏移。
for (const zoom of [50,100,196,300]) {
  const left = dk.WK.ccd.r({img:'portrait.webp',px:0,py:50,zoom});
  const center = dk.WK.ccd.r({img:'portrait.webp',px:50,py:50,zoom});
  const right = dk.WK.ccd.r({img:'portrait.webp',px:100,py:50,zoom});
  assert.match(left,/translate\(-50%,0%\)/);assert.match(center,/translate\(0%,0%\)/);assert.match(right,/translate\(50%,0%\)/);
  const down = dk.WK.ccd.r({img:'landscape.webp',px:50,py:100,zoom});assert.match(down,/translate\(0%,50%\)/);
}
const clock=dk.widgetPreview({k:'clock'},{...dk.WK.clock.d,font:'ios',auto:false,c:'#ff0000',sz:'4x2'});
assert.match(clock,/SF Pro Display/);assert.match(clock,/rgba\(255,0,0,1\)/);
// 通过实际桌面入口验证添加和实时放大都会分页，而非仅测试布局辅助函数。
const pagesEl={clientWidth:360,scrollLeft:0};
coreStub.ui.desk={innerHTML:'',querySelectorAll:()=>[],classList:{add(){},remove(){}}};
// 重新导入以绑定可渲染的 DOM 替身。
globalThis.widgetTest.$=()=>pagesEl;
const liveDesk=await import('data:text/javascript;base64,'+Buffer.from(desk+'\n// integration').toString('base64'));
const full=Array.from({length:24},(_,i)=>({id:'fill'+i,t:'w',k:'custom',w:1,h:1,p:{html:''}}));
coreStub.S.desk={pages:[full],dock:[]};
const extra={id:'new-camera',t:'w',k:'ccdWide',w:4,h:2,p:{...liveDesk.WK.ccdWide.d}};
assert.equal(liveDesk.addDeskWidget(extra,0),1);assert.equal(coreStub.S.desk.pages[0].length,24);assert.equal(pagesEl.scrollLeft,360);
const beforeTap=page;coreStub.G.tap('',{dataset:{it:extra.id}});assert.equal(page,beforeTap,'非编辑模式点击组件不打开照片或设置');
const make=id=>({id,t:'w',k:'ccd',w:4,h:2,p:{...liveDesk.WK.ccd.d}});
const first=make('resize-first'),second=make('resize-second'),third=make('resize-third');
coreStub.S.desk={pages:[[first,second,third]],dock:[]};
liveDesk.renderDesk();coreStub.G.dlp('',{dataset:{}},{});
const editing=coreStub.G.tap('',{dataset:{it:first.id}});
page.model().sz='4x4';page.onChange('sz','4x4');
assert.deepEqual(coreStub.S.desk.pages[0],[second,third]);assert.deepEqual(coreStub.S.desk.pages[1],[first]);
page.close();await editing;
console.log('Widget preview: all types, live inputs, size, styles, save/cancel and plain forms checked.');
console.log('1 passed, 0 failed');


// 空底栏平时隐藏，编辑模式通过 CSS 作为可投放区域展示。
coreStub.S.desk={pages:[[]],dock:[]};liveDesk.renderDesk();
assert.match(coreStub.ui.desk.innerHTML,/class="dock empty"/);
coreStub.S.desk.dock=[{id:'dock-app',t:'app',app:'chat'}];liveDesk.renderDesk();
assert.match(coreStub.ui.desk.innerHTML,/class="dock"/);assert.doesNotMatch(coreStub.ui.desk.innerHTML,/class="dock empty"/);
assert.match(read('style.css'),/\.dock\.empty\{display:none\}/);
assert.match(read('style.css'),/\.desk\.edit \.dock\.empty\{display:flex/);

// 两款吧唧默认 2×2；只有照片设置，大小只提供正方形等比例尺寸。
for(const key of ['badgeRound','badgeHeart']) {
 const K=dk.WK[key];assert.equal(K.w,2);assert.equal(K.h,2);
 assert.deepEqual(dk.sizes(K.w,K.h),[[1,1],[2,2],[3,3],[4,4]]);
 assert.deepEqual(K.f(K.d).map(f=>f[0]),['img','zoom','px','py']);
 assert.equal(K.after,paint.mountPaintPhotos);
 assert.match(dk.widgetPreview({k:key},{...K.d,sz:'2x2'}),/badge-stage/);
}
