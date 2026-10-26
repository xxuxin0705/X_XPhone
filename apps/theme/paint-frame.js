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
let clipId = 0;
export function paintFrameHtml(p) {
  const z=Math.max(50,Math.min(300,+p.zoom||100))/100,x=Math.max(0,Math.min(100,+(p.px??50)))-50,y=Math.max(0,Math.min(100,+(p.py??50)))-50;
  const photo=p.img?`<img src="${esc(p.img)}" alt="" style="transform:translate(${x}%,${y}%) scale(${z})">`:'<span class="paint-empty">添加照片</span>';
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="paint-window"><div class="paint-photo">${photo}</div>${paintFrameSvg('paint-cutout-' + ++clipId)}</div>`;
}

