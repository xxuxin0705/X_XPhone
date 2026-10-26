// 桌面固定 4 列 × 7 行（格子是正方形，按宽度定大小；常见手机 19.5:9 的屏幕 7 行刚好放满，不会底下空一大块）；布局与容量检查共用同一套逐格排布，避免面积够但形状放不下。
export const DESK_COLS = 4, DESK_ROWS = 7;
const dim = (n, max) => Math.max(1, Math.min(max, Math.floor(+n) || 1));
export const itemSize = it => it.t == 'w' ? { w: dim(it.w,DESK_COLS), h: dim(it.h,DESK_ROWS) } : { w:1,h:1 };
export function pageLayout(items) {
  const cells = Array.from({length:DESK_ROWS},()=>Array(DESK_COLS).fill(false)), placed = [], overflow = [];
  const pending = [], slots = new Map();
  const free = (row,col,w,h) => Number.isInteger(row) && Number.isInteger(col) && row>=0 && col>=0 && row+h<=DESK_ROWS && col+w<=DESK_COLS && cells.slice(row,row+h).every(line=>line.slice(col,col+w).every(v=>!v));
  const reserve = slot => { for(let y=slot.row;y<slot.row+slot.h;y++) for(let x=slot.col;x<slot.col+slot.w;x++) cells[y][x]=true; slots.set(slot.it,slot); };
  // 先保留用户摆过的位置，自动排列的项目才填空；空格也是布局的一部分。
  for(const it of items) { const {w,h}=itemSize(it); if(free(it.row,it.col,w,h)) reserve({it,row:it.row,col:it.col,w,h}); else pending.push(it); }
  for(const it of pending) {
    const {w,h}=itemSize(it);let slot;
    search: for(let row=0;row<=DESK_ROWS-h;row++) for(let col=0;col<=DESK_COLS-w;col++) {
      if(!free(row,col,w,h))continue;
      slot={it,row,col,w,h};break search;
    }
    if(!slot) { overflow.push(it);continue; }
    reserve(slot);
  }
  for(const it of items) if(slots.has(it)) placed.push(slots.get(it));
  return {placed,overflow};
}
// 拖到明确格子；保留其他位置，只让被覆盖的项目重新找空位。放不下就不改变原布局。
export function moveItem(pages,it,index,row,col,dock=[]) {
  const target=pages[index]; if(!target)return false;
  const {w,h}=itemSize(it);
  row=Math.max(0,Math.min(DESK_ROWS-h,Math.round(row)));col=Math.max(0,Math.min(DESK_COLS-w,Math.round(col)));
  const candidates=pageLayout(target).placed.filter(s=>s.it!==it).map(s=>({...s.it,row:s.row,col:s.col}));
  for(const other of candidates) { const size=itemSize(other); if(other.col<col+w && other.col+size.w>col && other.row<row+h && other.row+size.h>row) { delete other.row;delete other.col; } }
  const moving={...it,row,col}, layout=pageLayout([moving,...candidates]);
  if(layout.overflow.length)return false;
  const positions=new Map(layout.placed.map(s=>[s.it.id,s]));
  for(const page of [...pages,dock]) { const at=page.indexOf(it);if(at>=0)page.splice(at,1); }
  target.push(it);
  for(const entry of target) { const slot=positions.get(entry.id);Object.assign(entry,{row:slot.row,col:slot.col}); }
  return true;
}
// 当前页容纳不了指定组件时，仅将它放到新页，原页其他内容不移动。
export function placeItem(pages,it,index=0) {
  index=Math.max(0,Math.min(pages.length-1,index));if(!pages.length){pages.push([]);index=0;}
  const at=pages[index].indexOf(it);
  for(const page of pages) { const i=page.indexOf(it);if(i>=0)page.splice(i,1); }
  if(it.t=='w') Object.assign(it,itemSize(it));
  const candidate=[...pages[index]];candidate.splice(at<0?candidate.length:at,0,it);
  if(!pageLayout(candidate).overflow.length) { pages[index].splice(0,pages[index].length,...candidate);return index; }
  delete it.row;delete it.col;pages.push([it]);return pages.length-1;
}
// 旧桌面或外部导入的超量内容顺序移至新页，不删除、不压缩组件。
export function fitPages(pages) {
  const result=[],spill=[];
  for(const page of pages) {
    for(const it of page) if(it.t=='w') Object.assign(it,itemSize(it));
    const {placed,overflow}=pageLayout(page);result.push(placed.map(p=>p.it));for(const it of overflow){delete it.row;delete it.col;}spill.push(...overflow);
  }
  while(spill.length) { const {placed,overflow}=pageLayout(spill);result.push(placed.map(p=>p.it));spill.splice(0,spill.length,...overflow); }
  return result.length?result:[[]];
}
export function removeMoodNote(settings) {
  const assets=settings.assets?.widget||[],removed=assets.filter(a=>a.name==='心情便签'),html=new Set(removed.map(a=>a.html));
  let changed=removed.length>0;
  if(settings.assets)settings.assets.widget=assets.filter(a=>a.name!=='心情便签');
  const isNote=it=>it.k==='custom'&&(html.has(it.p?.html)||String(it.p?.html||'').includes('今天也要开心 ✧'));
  if(settings.desk) for(const list of [...settings.desk.pages,settings.desk.dock]) for(let i=list.length-1;i>=0;i--) if(isNote(list[i])) {list.splice(i,1);changed=true;}
  return changed;
}

