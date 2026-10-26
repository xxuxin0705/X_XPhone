import assert from 'node:assert/strict';
import {badgeHtml,badgeFields,BADGE_DEFAULT} from '../../apps/theme/badge.js';
import {mountPaintPhotos} from '../../apps/theme/paint-frame.js';

assert.deepEqual(BADGE_DEFAULT,{zoom:100,px:50,py:50});
assert.deepEqual(badgeFields().map(f=>f[0]),['img','zoom','px','py']);
const normalize=html=>html.replace(/badge-\d+/g,'badge-id');
for(const shape of ['circle','heart']) {
 const html=badgeHtml({img:'portrait.jpg',zoom:196,px:0,py:100},shape);
 assert.match(html,/--photo-zoom:1.96;left:0%;top:100%;transform:translate\(0%,-100%\)/);
 assert.match(html,/stroke="#bfc1c5" stroke-width="5"/);
 assert.match(html,/feTurbulence/);assert.match(html,/src="portrait.jpg"/);
 assert.doesNotMatch(html,/linearGradient|radialGradient|shine|specular|onclick|data-a=/);
 const alternate=badgeHtml({img:'portrait.jpg',zoom:196,px:0,py:100,body:'red',material:'gloss',bg:'solid'},shape);
 assert.equal(normalize(html),normalize(alternate),'外框和材质固定，不接受额外外观参数');
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 for(const ref of html.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(ref[1]));
}
assert.notEqual(normalize(badgeHtml({},'circle')),normalize(badgeHtml({},'heart')));
assert.match(badgeHtml(),/添加照片/);
assert.match(badgeHtml({img:'x" onerror="bad'}),/x&#34; onerror=&#34;bad/);
assert.match(badgeHtml({img:'x',zoom:999,px:-50,py:500}),/--photo-zoom:3;left:0%;top:100%/);
assert.match(badgeHtml({img:'x',zoom:'bad',px:'bad',py:'bad'}),/--photo-zoom:1;left:50%;top:50%/);
const allIds=Array.from({length:8},()=>badgeHtml()).flatMap(html=>[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
assert.equal(new Set(allIds).size,allIds.length,'桌面和多个预览同时存在时裁切路径独立');
// 吧唧和相框共用完整原图的自然比例；长图加载后仍可显示整张图。
let selector,ratio;
const image={naturalWidth:100,naturalHeight:1000,style:{setProperty:(key,value)=>{if(key==='--photo-ratio')ratio=value;}}};
mountPaintPhotos({querySelectorAll:s=>{selector=s;return [image];}});
assert(selector.includes('.badge-photo>img'));assert.equal(ratio,.1);
image.naturalWidth=1000;image.naturalHeight=100;image.onload();assert.equal(ratio,10);
console.log('Badge: two matte shapes, flat silver rim, photo-only settings, full image ratio, transforms, escaping and isolated clips checked.');
console.log('1 passed, 0 failed');
