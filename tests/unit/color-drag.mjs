import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bind, G, fx } from '../../core.js';
const src = fs.readFileSync(new URL('../../core.js', import.meta.url), 'utf8');
const pointSrc = src.split('const cpPoint = ')[1].split('const cpStyle')[0].trim().replace(/;$/, '');
const point = new Function(`return (${pointSrc});`)();
assert.equal(point('#ff0000').x, 0); assert.equal(point('#00ff00').y, 50);
assert(Math.abs(point('#0000ff').x - 200/3) < .0001);
assert.equal(point('#ffffff').mode, 'g');assert.equal(point('#000000').gray, 100);
const markup = fx({color:'#00ff00'}).inp('color','颜色','color');
assert.equal((markup.match(/class="cp-cursor"/g)||[]).length,2);assert.match(markup,/data-color-key="color"/);assert.match(markup,/--cp-y:50%/);
let captured = false, queued;
globalThis.requestAnimationFrame = fn => { queued = fn; return 1; };
globalThis.cancelAnimationFrame = () => { queued = null; };
const model = { color:'#ffffff' }, events = {}, root = {
 _pg: { model:()=>model, save(){}, onChange(){} },
 addEventListener(n,fn){ (events[n] ||= new Set()).add(fn); }, removeEventListener(n,fn){events[n]?.delete(fn)},
 querySelectorAll(){ return [panel]; }, setPointerCapture(){captured=true}, hasPointerCapture(){return captured},releasePointerCapture(){captured=false},
}; root._pg.el = root;
const props = {};
const input = { value:'', dispatchEvent(e){ for(const fn of [...events[e.type]]) fn({target:{...input,dataset:{k:'color'},parentElement:root}}); } };
const swatch = {style:{}};
const row = {querySelector:s=>s==='input'?input:swatch};
const surface = mode => ({dataset:{x:mode},parentElement:root, getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),closest:s=>s==='.cpk'?panel:s==='[data-a="cpsq"]'?surfaces[mode]:null});
const surfaces = {'':surface(''),'g':surface('g')};
let panel={hidden:false,dataset:{colorKey:'color'},previousElementSibling:row,style:{setProperty:(k,v)=>props[k]=v},querySelector:s=>surfaces[s==='.cpk-g'?'g':'']};
bind(root);
const event = (type,x,y,mode='') => ({type,clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,target:surfaces[mode],preventDefault(){},stopPropagation(){}});
const fire = e => { for(const fn of [...events[e.type]]) fn(e); };
fire(event('pointerdown',0,50));assert.equal(model.color,'#ff0000');assert.equal(props['--cp-x'],'0%');assert(captured);
fire(event('pointermove',100/3,50));queued();assert.equal(model.color,'#00ff00');
// 主题页面重画后，拖动继续定位同一个颜色字段。
panel={...panel,dataset:{colorKey:'color'}};
fire(event('pointerup',200/3,50));assert.equal(model.color,'#0000ff');assert(!captured);assert.equal(events.pointermove.size,0);
fire(event('pointerdown',25,50,'g'));assert.equal(model.color,'#bfbfbf');assert.equal(panel.dataset.mode,'g');assert.equal(props['--cp-g'],'25%');
fire(event('pointercancel',25,50,'g'));assert.equal(events.pointermove.size,0);
console.log('Color selection: initial markers, mouse/touch pointer drag, gray bar, rerender and cancel checked.');
console.log('1 passed, 0 failed');
