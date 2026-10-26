import assert from 'node:assert/strict';
import {paintFrameHtml,paintFrameSvg} from '../../apps/theme/paint-frame.js';
const chrome=paintFrameSvg();assert.match(chrome,/viewBox="0 0 1108 1132"/);assert.match(chrome,/untitled - Paint/);assert.match(chrome,/assets\/paint\/frame\.png/);assert.match(chrome,/clip-rule="evenodd"/);
assert.doesNotMatch(chrome,/data-a=|onclick|<button|<input/,'装饰工具不能意外触发编辑');
const a=paintFrameHtml({img:'portrait.jpg',zoom:196,px:0,py:100}),b=paintFrameHtml({img:'portrait.jpg',body:'#ff0000',style:'pink',zoom:196,px:0,py:100});assert.equal(a.replace(/paint-cutout-\d+/g,'cutout'),b.replace(/paint-cutout-\d+/g,'cutout'),'外框配色固定，忽略机身颜色字段');
assert.match(a,/translate\(-50%,50%\) scale\(1.96\)/);assert.match(a,/src="portrait.jpg"/);assert.match(paintFrameHtml({}),/添加照片/);
assert.match(paintFrameHtml({img:'x" onerror="bad'}),/x&#34; onerror=&#34;bad/);
for(const zoom of [50,100,200,300])assert.match(paintFrameHtml({img:'x',zoom,px:50,py:50}),new RegExp('translate\\(0%,0%\\) scale\\('+zoom/100+'\\)'));
console.log('Paint frame: fixed classic chrome, decorative controls, photo positioning and escaping checked.');
console.log('1 passed, 0 failed');


// 抠图的外框和照片开口必须保持统一坐标；多个预览不共用 clipPath ID。
assert.notEqual(paintFrameHtml({}).match(/id="([^"]+)"/)[1],paintFrameHtml({}).match(/id="([^"]+)"/)[1]);
assert.match(chrome,/M166 116H1044V892H166Z/);
