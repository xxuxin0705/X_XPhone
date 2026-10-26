// 桌面固定 4 列 × 6 行；布局与容量检查共用同一套逐格排布，避免面积够但形状放不下。
export const DESK_COLS = 4, DESK_ROWS = 6;
const dim = (n, max) => Math.max(1, Math.min(max, Math.floor(+n) || 1));
export const itemSize = it => it.t == 'w' ? { w: dim(it.w,DESK_COLS), h: dim(it.h,DESK_ROWS) } : { w:1,h:1 };
export function pageLayout(items) {
  const cells = Array.from({length:DESK_ROWS},()=>Array(DESK_COLS).fill(false)), placed = [], overflow = [];
  for(const it of items) {
    const {w,h}=itemSize(it);let slot;
    search: for(let row=0;row<=DESK_ROWS-h;row++) for(let col=0;col<=DESK_COLS-w;col++) {
      let free=true;for(let y=row;y<row+h;y++) for(let x=col;x<col+w;x++) if(cells[y][x]) free=false;
      if(!free)continue;
      slot={it,row,col,w,h};break search;
    }
    if(!slot) { overflow.push(it);continue; }
    for(let y=slot.row;y<slot.row+h;y++) for(let x=slot.col;x<slot.col+w;x++) cells[y][x]=true;
    placed.push(slot);
  }
  return {placed,overflow};
}
// 当前页容纳不了指定组件时，仅将它放到新页，原页其他内容不移动。
export function placeItem(pages,it,index=0) {
  index=Math.max(0,Math.min(pages.length-1,index));if(!pages.length){pages.push([]);index=0;}
  const at=pages[index].indexOf(it);
  for(const page of pages) { const i=page.indexOf(it);if(i>=0)page.splice(i,1); }
  if(it.t=='w') Object.assign(it,itemSize(it));
  const candidate=[...pages[index]];candidate.splice(at<0?candidate.length:at,0,it);
  if(!pageLayout(candidate).overflow.length) { pages[index].splice(0,pages[index].length,...candidate);return index; }
  pages.push([it]);return pages.length-1;
}
// 旧桌面或外部导入的超量内容顺序移至新页，不删除、不压缩组件。
export function fitPages(pages) {
  const result=[],spill=[];
  for(const page of pages) {
    for(const it of page) if(it.t=='w') Object.assign(it,itemSize(it));
    const {placed,overflow}=pageLayout(page);result.push(placed.map(p=>p.it));spill.push(...overflow);
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
