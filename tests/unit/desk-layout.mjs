import assert from 'node:assert/strict';
import {pageLayout,placeItem,fitPages,removeMoodNote,DESK_COLS,DESK_ROWS} from '../../desk-layout.js';
import {S} from '../../core.js';
let seq=0;const app=()=>({id:'a'+seq++,t:'app',app:'chat'}),widget=(w,h)=>({id:'w'+seq++,t:'w',k:'ccd',w,h,p:{}});
assert.equal(DESK_COLS,4);assert.equal(DESK_ROWS,6);
function valid(page) {
 const {placed,overflow}=pageLayout(page);assert.equal(overflow.length,0);const used=new Set();
 for(const {row,col,w,h} of placed) {assert(row>=0&&row+h<=6&&col>=0&&col+w<=4);for(let y=row;y<row+h;y++)for(let x=col;x<col+w;x++){const k=x+','+y;assert(!used.has(k));used.add(k);}}
}
const icons=Array.from({length:24},app);valid(icons);assert.equal(pageLayout([...icons,app()]).overflow.length,1);
const pages=[icons],extra=widget(2,2);assert.equal(placeItem(pages,extra,0),1);assert.equal(pages[0].length,24);assert.deepEqual(pages[1],[extra]);
// 总面积还有余量，但没有连续四列，也要新开一页。
const fragmented=[[widget(3,3),widget(1,6)]],wide=widget(4,1);assert.equal(placeItem(fragmented,wide,0),1);
const a=widget(4,2),b=widget(4,2),c=widget(4,2),resize=[[a,b,c]];a.h=4;
assert.equal(placeItem(resize,a,0),1);assert.deepEqual(resize[0],[b,c]);assert.deepEqual(resize[1],[a]);
// 从文件夹出来的图标、拖动换页也沿用容量规则。
const move=[[widget(4,6)],[app()]],moving=move[1][0];assert.equal(placeItem(move,moving,0),2);assert.equal(move[1].length,0);
const original=[...Array.from({length:40},app),widget(4,4),widget(3,3)];const fitted=fitPages([original]);fitted.forEach(valid);assert.deepEqual(new Set(fitted.flat()),new Set(original));
assert.deepEqual(fitPages(fitted).map(p=>p.map(it=>it.id)),fitted.map(p=>p.map(it=>it.id)),'重复布局稳定，不增加页面');
let seed=17;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
const stress=Array.from({length:200},()=>widget(1+rnd()%4,1+rnd()%4));const packed=fitPages([stress]);packed.forEach(valid);assert.equal(packed.flat().length,stress.length);
const oldHtml='<div>今天也要开心 ✧</div>',custom={id:'custom',t:'w',k:'custom',p:{html:'我的自定义组件'}};
const settings={assets:{widget:[{id:'w1',name:'心情便签',html:oldHtml},{id:'keep',name:'我的组件',html:'keep'}]},desk:{pages:[[{t:'w',k:'custom',p:{html:oldHtml}},custom]],dock:[]}};
assert(removeMoodNote(settings));assert.equal(settings.assets.widget.length,1);assert.deepEqual(settings.desk.pages[0],[custom]);assert(!removeMoodNote(settings));
assert(!S.assets.widget.some(a=>a.name==='心情便签'));
console.log('Desk layout: 4x6 capacity, fragmented space, resize, move, stable overflow migration and mood-note removal checked.');
console.log('1 passed, 0 failed');
