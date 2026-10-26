import assert from 'node:assert/strict';
import {pageLayout,placeItem,moveItem,fitPages,removeMoodNote,DESK_COLS,DESK_ROWS} from '../../desk-layout.js';
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


// 拖入空白格后，刷新/重新载入必须保留位置和空洞。
const fixed=app(), photo=widget(2,2), customPages=[[fixed,photo],[]];
assert(moveItem(customPages,photo,0,3,2));
assert.deepEqual([photo.row,photo.col],[3,2]);
let restored=fitPages(JSON.parse(JSON.stringify(customPages)));
assert.deepEqual(pageLayout(restored[0]).placed.find(s=>s.it.id===photo.id),{it:restored[0][1],row:3,col:2,w:2,h:2});
// 移入已占用区域，其他项目让位；跨页后不残留重复对象。
assert(moveItem(customPages,fixed,0,3,2));valid(customPages[0]);
assert.deepEqual([fixed.row,fixed.col],[3,2]);
assert(moveItem(customPages,photo,1,4,2));customPages.forEach(valid);
assert.equal(customPages.flat().filter(x=>x.id===photo.id).length,1);
assert.equal(customPages[0].includes(photo),false);
// 满页拒绝放入时，所有源数据不变。
const full=[Array.from({length:24},app),[photo]], before=JSON.stringify(full);
assert.equal(moveItem(full,photo,0,0,0),false);assert.equal(JSON.stringify(full),before);
// 从 Dock 拖出、边界限制及旧版没有 row/col 的数据。
const dockApp=app(),dock=[dockApp],dockPages=[[]];assert(moveItem(dockPages,dockApp,0,99,-4,dock));
assert.equal(dock.length,0);assert.deepEqual([dockApp.row,dockApp.col],[5,0]);valid(dockPages[0]);
console.log('Drag placement: empty cells, persisted holes, displaced widgets, cross-page uniqueness, full-page rollback and Dock checked.');

// 直接验证实际 CSS 的格子公式：长屏不拉伸行高，短屏按高度缩小，并保留六行容量。
const css=(await import('node:fs')).readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const rule=css.match(/\.page\{([^}]+)\}/)[1];
assert.match(rule,/grid-template-columns:repeat\(4,minmax\(0,var\(--desk-cell\)\)\)/);
assert.match(rule,/grid-template-rows:repeat\(6,minmax\(0,var\(--desk-cell\)\)\)/);
assert.match(rule,/justify-content:center;align-content:start/);
const formula=rule.match(/--desk-cell:([^;]+)/)[1];
const cellAt=(width,height)=>{
 const expr=formula.replaceAll('100cqw',String(width)).replaceAll('100cqh',String(height)).replaceAll('px','').replaceAll('calc(','(').replaceAll('max(','Math.max(').replaceAll('min(','Math.min(');
 return new Function('return '+expr)();
};
for(const [width,height] of [[390,650],[390,1000],[360,500],[390,350],[576,940]]) {
 const cell=cellAt(width,height);assert(cell>0);
 assert(4*cell+36+36<=width+.001);assert(6*cell+60+22<=height+.001);
 const widgetWidth=3*cell+24,widgetHeight=3*cell+24;assert.equal(widgetWidth,widgetHeight);
}
assert.equal(cellAt(390,650),cellAt(390,1000),'加高屏幕不再加大应用上下间距');
assert(cellAt(390,350)<cellAt(390,650),'短屏同时缩小行列，不改变单格比例');
console.log('Actual CSS grid: square 1x1 cells and 3x3 widgets, tall/short viewports and six-row capacity checked.');
