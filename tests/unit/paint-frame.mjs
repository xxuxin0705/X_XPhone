import assert from 'node:assert/strict';
import {paintFrameHtml,paintFrameSvg,mountPaintPhotos,fitPaintZoom} from '../../apps/theme/paint-frame.js';
const chrome=paintFrameSvg();assert.match(chrome,/viewBox="0 0 1108 1132"/);assert.match(chrome,/untitled - Paint/);assert.match(chrome,/assets\/paint\/frame\.png/);assert.match(chrome,/clip-rule="evenodd"/);
assert.doesNotMatch(chrome,/data-a=|onclick|<button|<input/,'装饰工具不能意外触发编辑');
const a=paintFrameHtml({img:'portrait.jpg',zoom:196,px:0,py:100}),b=paintFrameHtml({img:'portrait.jpg',body:'#ff0000',style:'pink',zoom:196,px:0,py:100});assert.equal(a.replace(/paint-cutout-\d+/g,'cutout'),b.replace(/paint-cutout-\d+/g,'cutout'),'外框配色固定，忽略机身颜色字段');
assert.match(a,/--photo-zoom:1.96;left:0%;top:100%;transform:translate\(0%,-100%\)/);assert.match(a,/src="portrait.jpg"/);assert.match(paintFrameHtml({}),/添加照片/);
assert.match(paintFrameHtml({img:'x" onerror="bad'}),/x&#34; onerror=&#34;bad/);
for(const zoom of [1,50,100,200,300])assert(paintFrameHtml({img:'x',zoom,px:50,py:50}).includes('--photo-zoom:'+zoom/100+';left:50%;top:50%'));
console.log('Paint frame: fixed classic chrome, decorative controls, photo positioning and escaping checked.');
console.log('1 passed, 0 failed');


// 抠图的外框和照片开口必须保持统一坐标；多个预览不共用 clipPath ID。
assert.notEqual(paintFrameHtml({}).match(/id="([^"]+)"/)[1],paintFrameHtml({}).match(/id="([^"]+)"/)[1]);
assert.match(chrome,/M166 116H1044V892H166Z/);

// 十倍长图保留自然比例；底部/顶部都能移入视口，完整适配能算到 9%。
let ratio;
const img={naturalWidth:100,naturalHeight:1000,parentElement:{clientWidth:200,clientHeight:180},style:{setProperty:(k,v)=>{if(k==='--photo-ratio')ratio=v;}}};
mountPaintPhotos({querySelectorAll:()=>[img]});assert.equal(ratio,.1);assert.equal(fitPaintZoom(img),9);
img.naturalWidth=1000;img.naturalHeight=100;img.onload();assert.equal(ratio,10);assert.equal(fitPaintZoom(img),11);
img.naturalWidth=0;assert.equal(fitPaintZoom(img),100);
assert.match(paintFrameHtml({img:'long.jpg',py:0}),/top:0%;transform:translate\(-50%,0%\)/);
assert.match(paintFrameHtml({img:'long.jpg',py:100}),/top:100%;transform:translate\(-50%,-100%\)/);
// 上传原文件分支不调用缩略图压缩；普通头像上传继续保持原来的策略。
const coreSource=(await import('node:fs')).readFileSync(new URL('../../core.js',import.meta.url),'utf8');
const pickSource=coreSource.slice(coreSource.indexOf('export async function pickImg'),coreSource.indexOf('/* ---------- 媒体文件')).replace('export ','');
const file={type:'image/png',name:'long.png'};let shrinks=0;
const pick=new Function('menu','pickFile','putMedia','readImg','form',pickSource+';return pickImg;')(async()=> 'f',async()=>file,async x=>x,async()=>{shrinks++;return 'thumbnail';},()=>{});
assert.equal(await pick(0,'widget',true),file);assert.equal(shrinks,0);
assert.equal(await pick(400), 'thumbnail');assert.equal(shrinks,1);
