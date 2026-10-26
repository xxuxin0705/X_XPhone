// 磨砂照片吧唧：圆形 / 爱心，固定无反光银边；完整照片在形状内缩放和平移。
import { esc } from '../../core.js';

export const BADGE_DEFAULT = { zoom:100, px:50, py:50 };
export const badgeFields = () => [
  ['img','照片','img'], ['zoom','照片缩放','range',[1,300,'%']],
  ['px','左右位置','range',[0,100,'%']], ['py','上下位置','range',[0,100,'%']],
];
const CIRCLE='M160 28a132 132 0 1 1 0 264a132 132 0 1 1 0-264Z';
const HEART='M160 279C145 276 45 212 27 139C9 64 86 31 132 72L160 97L188 72C234 31 311 64 293 139C275 212 175 276 160 279Z';
let serial=0;
const value=(v,fallback,min,max)=>Number.isFinite(+v)?Math.max(min,Math.min(max,+v)):fallback;
export function badgeHtml(p={},shape='circle') {
  const id='badge-'+ ++serial, path=shape==='heart'?HEART:CIRCLE;
  const z=value(p.zoom??100,100,1,300)/100,x=value(p.px??50,50,0,100),y=value(p.py??50,50,0,100);
  const photo=p.img?`<img src="${esc(p.img)}" alt="" draggable="false" style="--photo-zoom:${z};left:${x}%;top:${y}%;transform:translate(${-x}%,${-y}%)">`:'<span class="badge-empty">添加照片</span>';
  return `<div class="badge-stage">
    <svg class="badge-defs" width="0" height="0" aria-hidden="true"><defs><clipPath id="${id}-photo" clipPathUnits="objectBoundingBox"><path d="${path}" transform="scale(.003125)"/></clipPath></defs></svg>
    <div class="badge-photo" style="clip-path:url(#${id}-photo)">${photo}</div>
    <svg class="badge-finish" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      <defs><clipPath id="${id}-face"><path d="${path}"/></clipPath><filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/></filter></defs>
      <g clip-path="url(#${id}-face)"><path d="${path}" fill="#ffffff" opacity=".055"/><rect class="badge-grain" width="320" height="320" filter="url(#${id}-grain)" opacity=".12"/></g>
      <path class="badge-rim" d="${path}" fill="none" stroke="#bfc1c5" stroke-width="5"/>
    </svg>
  </div>`;
}
