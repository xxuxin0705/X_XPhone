import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../desk.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function editGesture(e)'),source.indexOf('function folder(it)'));
const listeners={},timers=new Map(),turns=[],drags=[],taps=[];
let sequence=0,clock=1000,captured=false;
const root={
 addEventListener(n,fn){(listeners[n] ||= new Set()).add(fn);},
 removeEventListener(n,fn){listeners[n]?.delete(fn);},
 setPointerCapture(){captured=true;},hasPointerCapture(){return captured;},releasePointerCapture(){captured=false;},
};
const pages={clientWidth:360,scrollLeft:0,style:{},getBoundingClientRect:()=>({width:360})};
const item={dataset:{it:'photo'}};
const target=(onItem=false,inPages=true)=>({closest:s=>s==='.pages'?(inPages?pages:null):s==='[data-it]'?(onItem?item:null):null});
const create=new Function('ui','setTimeout','clearTimeout','Date','drag','G','goPage',`let edit=1,dragging=false,cur=0,moved=0;${code};return editGesture;`);
const gesture=create({root},fn=>{timers.set(++sequence,fn);return sequence;},id=>timers.delete(id),{now:()=>clock},(e,id)=>drags.push(id),{tap:(_,el)=>taps.push(el)},i=>turns.push(i));
const event=(type,x,y=100,onItem=false,inPages=true)=>({type,clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,target:target(onItem,inPages),preventDefault(){},stopPropagation(){}});
const send=e=>{clock+=30;for(const fn of [...(listeners[e.type]||[])])fn(e);};
const finish=()=>{assert(!captured);for(const list of Object.values(listeners))assert.equal(list.size,0);assert.equal(timers.size,0);};
// 空白处轻扫和组件上轻扫都翻页，不启动拖动。
gesture(event('pointerdown',280));send(event('pointermove',100));assert.equal(pages.scrollLeft,180);assert.equal(pages.style.scrollSnapType,'none');
send(event('pointerup',100));assert.equal(turns.at(-1),1);assert.equal(pages.style.scrollSnapType,'');finish();
gesture(event('pointerdown',280,100,true));send(event('pointermove',150,100,true));send(event('pointerup',150,100,true));assert.equal(turns.at(-1),1);assert.equal(drags.length,0);assert.equal(taps.length,0);finish();
// 微小移动仍是点击；取消手势回原页，并释放监听器和捕获。
gesture(event('pointerdown',180,100,true));send(event('pointerup',180,100,true));assert.equal(taps.length,1);finish();
gesture(event('pointerdown',280));send(event('pointermove',100));send(event('pointercancel',100));assert.equal(turns.at(-1),0);finish();
// 按住后交给已有拖动逻辑，保留指针捕获；纵向移动也可启动拖动。
gesture(event('pointerdown',180,100,true));[...timers.values()][0]();assert.equal(drags.at(-1),'photo');assert(captured);assert.equal(timers.size,0);
root.releasePointerCapture();
gesture(event('pointerdown',180,100,true));send(event('pointermove',180,130,true));assert.equal(drags.length,2);root.releasePointerCapture();finish();
// Dock 内的应用也能按住拖出；快速点击不会误翻页。
gesture(event('pointerdown',180,100,true,false));send(event('pointerup',180,100,true,false));assert.equal(taps.length,2);finish();
console.log('Desk gesture: blank/item swipe, tap, hold-to-drag, vertical drag, cancel, Dock and listener cleanup checked.');
console.log('1 passed, 0 failed');
