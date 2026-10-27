import { G, esc, openApp } from '../../core.js';
export const photoSizes = () => Array.from({length:4},(_,h)=>Array.from({length:4},(_,w)=>[`${w+1}x${h+1}`,`${w+1}×${h+1}`])).flat();
export const PLAYER_STYLES = [['vinyl','经典黑胶'],['cd','银色 CD'],['cream','奶油唱片']];
export const photoHtml = p => `<div class="photo-widget" style="border-radius:${Math.max(0,Math.min(32,+p.radius||0))}px">${p.img ? `<img src="${esc(p.img)}" alt="照片" style="object-fit:${p.fit==='contain'?'contain':'cover'};object-position:${+p.px||0}% ${+p.py||0}%;transform:scale(${Math.max(1,Math.min(3,(+p.zoom||100)/100))})">` : '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="7" y="9" width="34" height="30" rx="4"/><circle cx="17" cy="19" r="3"/><path d="m8 34 12-10 8 7 6-5 7 8"/></svg>'}</div>`;
const path = (s) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${s}</svg>`;
const playIcon = path('<path d="m9 5 11 7-11 7z"/>'), pauseIcon = path('<path d="M7 5h4v14H7zm7 0h4v14h-4z"/>');
const prevIcon = path('<path d="M5 5h3v14H5zm14 0v14L9 12z"/>'), nextIcon = path('<path d="M16 5h3v14h-3zM5 5l10 7-10 7z"/>');
export function playerHtml(p) {
 const style=PLAYER_STYLES.some(s=>s[0]===p.skin)?p.skin:'vinyl';
 return `<div class="record-widget rw-${style}"><div class="rw-deck"><div class="rw-disc"><div class="rw-label"></div></div><i class="rw-arm"></i><span class="rw-led"></span></div><div class="rw-info"><button class="rw-title" data-a="recordOpen">未在播放</button><span class="rw-artist">收藏一段好时光</span><div class="rw-controls"><button data-a="recordPrev" aria-label="上一首">${prevIcon}</button><button data-a="recordToggle" class="rw-toggle" aria-label="播放">${playIcon}</button><button data-a="recordNext" aria-label="下一首">${nextIcon}</button></div></div></div>`;
}
let timer;
export function syncPlayers(root=document) {
 const nodes=root.querySelectorAll('.record-widget'); if(!nodes.length)return;
 const s=G.mzWidgetSnapshot?.();
 nodes.forEach(node=>{
  node.classList.toggle('playing',!!s?.isPlaying);
  const title=node.querySelector('.rw-title'), artist=node.querySelector('.rw-artist'), toggle=node.querySelector('.rw-toggle'), label=node.querySelector('.rw-label');
  title.textContent=s?.songName||'未在播放'; artist.textContent=s?.artist||'收藏一段好时光';
  if(toggle.dataset.playing!==String(!!s?.isPlaying)){toggle.dataset.playing=String(!!s?.isPlaying);toggle.innerHTML=s?.isPlaying?pauseIcon:playIcon;toggle.setAttribute('aria-label',s?.isPlaying?'暂停':'播放');}
  if(label.dataset.cover!==(s?.cover||'')){label.dataset.cover=s?.cover||'';label.replaceChildren();if(s?.cover){const img=document.createElement('img');img.src=s.cover;img.alt='专辑封面';label.append(img);}}
 });
}
export function mountPlayers(root) { syncPlayers(root); if(!timer)timer=setInterval(()=>{if(!document.querySelector('.record-widget')){clearInterval(timer);timer=null;return;}syncPlayers();},750); }
Object.assign(G,{recordOpen:()=>openApp('music'),recordToggle:()=>{G.mzControl?.('toggle');syncPlayers();},recordPrev:()=>G.mzControl?.('prev'),recordNext:()=>G.mzControl?.('next')});
