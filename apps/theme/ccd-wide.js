// 横版 CCD：透明屏幕、金属机身和照片/视频；机身色与背景设置和竖版相机共用交互。
import { esc, mediaSrc } from '../../core.js';
import { ccdBg } from './ccd.js';
export const WIDE_SILVER = '#c9cdcb';
const COLORS = { silver:'#c9cdcb', lavender:'#c7b7e8', pink:'#edb8cf' };
// 兼容旧版三种样式，并移除已取消的贴纸数据，照片/视频与背景原样保留。
export function wideSettings(p = {}) {
  const { style, sticker, sx, sy, ss, ...rest } = p;
  const body = style && style != 'custom' && COLORS[style] || rest.body;
  return { ...rest, body: /^#[0-9a-f]{6}$/i.test(body || '') ? body : WIDE_SILVER };
}
const mix = (hex, to, amount) => { const rgb = hex.slice(1).match(/../g).map(x=>parseInt(x,16)); return '#' + rgb.map(c=>Math.round(c+(to-c)*amount).toString(16).padStart(2,'0')).join(''); };
export function wideBody(p) {
  const c = wideSettings(p).body;
  const hi = mix(c,255,.85), mid = mix(c,255,.25), dark = mix(c,0,.4), rim = mix(c,0,.6);
  // 每个实例独立的渐变 ID，桌面与预览同时存在时不会串色。
  const id = 'cw-' + Math.random().toString(36).slice(2,10);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="cw-body" viewBox="0 0 900 460" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="${id}-metal" x2="0" y2="1"><stop stop-color="${hi}"/><stop offset=".16" stop-color="${mid}"/><stop offset=".48" stop-color="${c}"/><stop offset=".72" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="${id}-edge" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset=".2" stop-color="${hi}"/><stop offset=".5" stop-color="${c}"/><stop offset=".8" stop-color="${hi}"/><stop offset="1" stop-color="${rim}"/></linearGradient>
  <radialGradient id="${id}-dial"><stop stop-color="${hi}"/><stop offset=".27" stop-color="${c}"/><stop offset=".58" stop-color="${hi}"/><stop offset=".77" stop-color="${dark}"/><stop offset=".9" stop-color="${hi}"/><stop offset="1" stop-color="${rim}"/></radialGradient>
  <linearGradient id="${id}-shine" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".8"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
  </defs>
  <g stroke="${rim}" stroke-width="3"><path d="M111 65l7-30h51l9 30" fill="url(#${id}-edge)"/><path d="M279 70l14-31h123l16 31" fill="url(#${id}-metal)"/><rect x="302" y="30" width="24" height="12" rx="3" fill="${mid}"/><rect x="390" y="30" width="24" height="12" rx="3" fill="${mid}"/>
  <rect x="705" y="23" width="129" height="48" rx="13" fill="url(#${id}-edge)"/>
  ${Array.from({length:25},(_,i)=>`<path d="M${710+i*5} 30l8 31" stroke="${dark}" stroke-width="2"/>`).join('')}</g>
  <path d="M57 65h787q36 0 36 37v299q0 39-39 39H56q-37 0-37-38V104q0-39 38-39Z M94 96h547q30 0 30 30v244q0 30-30 30H94q-29 0-29-30V126q0-30 29-30Z" fill="url(#${id}-metal)" fill-rule="evenodd" stroke="${dark}" stroke-width="5"/>
  <path d="M58 74h780q32 0 32 31v288q0 35-32 35H59q-29 0-29-31V109q0-35 28-35Z M94 96h547q30 0 30 30v244q0 30-30 30H94q-29 0-29-30V126q0-30 29-30Z" fill="none" stroke="${hi}" stroke-width="4" fill-rule="evenodd"/>
  <rect x="48" y="80" width="640" height="336" rx="42" fill="none" stroke="${dark}" stroke-width="5"/>
  <rect x="55" y="86" width="625" height="324" rx="36" fill="none" stroke="${hi}" stroke-width="6"/>
  <rect x="64" y="95" width="608" height="306" rx="29" fill="none" stroke="#303333" stroke-width="7"/>
  <path d="M701 84v331M42 320v73q0 23 22 23h128" fill="none" stroke="${dark}" stroke-opacity=".5" stroke-width="2"/>
  <g fill="#25292a" stroke="${hi}" stroke-width="1.5"><circle cx="35" cy="168" r="4"/><circle cx="35" cy="216" r="4"/><circle cx="35" cy="264" r="4"/></g>
  <path d="M754 105h24" stroke="#383c3c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="782" cy="170" r="47" fill="url(#${id}-edge)" stroke="${dark}" stroke-width="3"/>
  <circle cx="782" cy="170" r="22" fill="#353a3b" stroke="${hi}" stroke-width="4"/><circle cx="782" cy="170" r="15" fill="url(#${id}-dial)"/>
  <circle cx="782" cy="304" r="76" fill="url(#${id}-dial)" stroke="${rim}" stroke-width="3"/>
  ${[69,64,58,44,38].map(r=>`<circle cx="782" cy="304" r="${r}" fill="none" stroke="${r%2?hi:dark}" stroke-opacity=".7" stroke-width="1.5"/>`).join('')}
  ${Array.from({length:48},(_,i)=>`<path d="M782 232v5" transform="rotate(${i*7.5} 782 304)" stroke="${rim}" stroke-width="2"/>`).join('')}
  <circle cx="782" cy="304" r="30" fill="url(#${id}-edge)" stroke="${hi}" stroke-width="2"/><path d="M776 304h12" stroke="${rim}" stroke-width="3" stroke-linecap="round"/>
  <rect x="717" y="400" width="70" height="23" rx="11" fill="url(#${id}-edge)" stroke="${dark}" stroke-width="3"/>
  <path d="M72 72h740" stroke="#fff" stroke-opacity=".65" stroke-width="4"/>
  </svg>`;
}
export function wideHtml(p) {
  const z = Math.max(50, Math.min(300,+p.zoom || 100))/100, x = Math.max(0,Math.min(100,+(p.px??50)))-50, y = Math.max(0,Math.min(100,+(p.py??50)))-50;
  const style = `object-position:center;transform:translate(${x}%,${y}%) scale(${z})`;
  const content = p.type === 'video' && p.video ? `<video data-wide-src="${esc(p.video)}" muted loop autoplay playsinline preload="metadata" style="${style}"${p.img ? ` poster="${esc(p.img)}"` : ''}></video>` : p.img ? `<img src="${esc(p.img)}" style="${style}" alt="">` : '<i class="cw-empty"><span>＋</span><small>添加照片 / 视频</small></i>';
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="cw-camera"><div class="cw-screen">${content}</div>${wideBody(p)}</div>`;
}
// 本地数据库视频也能播放；预览更新或关闭后释放旧的 blob URL。
const playing = new Map(); let observer;
const cleanup = () => { for(const [v,entry] of playing) if(!v.isConnected) { v.pause?.();v.removeAttribute?.('src');v.load?.(); if(entry.url?.startsWith('blob:')) URL.revokeObjectURL(entry.url); playing.delete(v); } if(!playing.size) { observer?.disconnect(); observer = null; } };
export function mountWideVideos(root) {
  cleanup();
  for(const v of root?.querySelectorAll('video[data-wide-src]') || []) {
    if(playing.has(v)) continue;
    const entry = {}; playing.set(v,entry);
    mediaSrc(v.dataset.wideSrc).then(u=>{ if(!v.isConnected || playing.get(v)!==entry) { if(u?.startsWith('blob:')) URL.revokeObjectURL(u); return; } entry.url=u;v.src=u;v.play?.().catch(()=>{}); }).catch(()=>{v.setAttribute('aria-label','视频加载失败，请重新选择视频');});
  }
  if(playing.size && !observer && typeof MutationObserver !== 'undefined') { observer = new MutationObserver(cleanup);observer.observe(document.body,{childList:true,subtree:true}); }
}
