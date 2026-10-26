// 经典 Windows 画图相框。标题栏、工具和调色板都是固定装饰，不接收点击或改色。
import { esc } from '../../core.js';
import { ccdBg } from './ccd.js';
// 从参考图提取的画图窗口；用矩形裁切去除抠图边缘，照片窗口保持透明。
export const PAINT_FRAME_URL = new URL('../../assets/paint/frame.png', import.meta.url).href;

export function paintFrameSvg(id = 'paint-frame-cutout') {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="paint-chrome" viewBox="0 0 1108 1132" aria-label="untitled - Paint" aria-hidden="true" focusable="false">
    <defs><clipPath id="${id}"><path d="M0 0H1108V1132H0Z M166 116H1044V892H166Z" clip-rule="evenodd"/></clipPath></defs>
    <image href="${esc(PAINT_FRAME_URL)}" x="-62" y="-82" width="1229" height="1280" clip-path="url(#${id})"/>
  </svg>`;
}
// 用完整原图的比例计算填满尺寸；不先把图片裁成相框比例。
export function mountPaintPhotos(root) {
  for(const img of root.querySelectorAll('.paint-photo>img,.badge-photo>img')) {
    const loaded=()=>{ if(img.naturalWidth && img.naturalHeight)img.style.setProperty('--photo-ratio',img.naturalWidth/img.naturalHeight); };
    img.onload=loaded;loaded();
  }
}
export function fitPaintZoom(img) {
  const w=img.parentElement.clientWidth,h=img.parentElement.clientHeight;
  if(!w || !h || !img.naturalWidth || !img.naturalHeight)return 100;
  const x=w/img.naturalWidth,y=h/img.naturalHeight;
  return Math.max(1,Math.floor(100*Math.min(x,y)/Math.max(x,y)));
}
let clipId = 0;
export function paintFrameHtml(p) {
  const z=Math.max(1,Math.min(300,+p.zoom||100))/100,x=Math.max(0,Math.min(100,+(p.px??50))),y=Math.max(0,Math.min(100,+(p.py??50)));
  const photo=p.img?`<img src="${esc(p.img)}" alt="" style="--photo-zoom:${z};left:${x}%;top:${y}%;transform:translate(${-x}%,${-y}%)">`:'<span class="paint-empty">添加照片</span>';
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="paint-window"><div class="paint-photo">${photo}</div>${paintFrameSvg('paint-cutout-' + ++clipId)}</div>`;
}

