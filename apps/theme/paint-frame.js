// 经典 Windows 画图相框。标题栏、工具和调色板都是固定装饰，不接收点击或改色。
import { esc } from '../../core.js';
import { ccdBg } from './ccd.js';
const bevel = (x,y,w,h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c0c0c0"/><path d="M${x} ${y+h}V${y}h${w}" fill="none" stroke="#fff"/><path d="M${x+w} ${y}v${h}H${x}" fill="none" stroke="#404040"/>`;
const TOOLS = [
 '<path d="M6 18l3-5-3-3 4-4 4 3 5-3-2 6 3 5-6-1-3 5Z" fill="none"/>',
 '<path d="M5 5h16v16H5Z" fill="none" stroke-dasharray="2 2"/>',
 '<path d="M5 17l10-11 7 5-10 11H6Z" fill="#ffff80"/><path d="M6 17l6 5"/>',
 '<path d="M6 15l9-9 8 8-9 9Z" fill="#008080"/><path d="M4 23h20" stroke="#000080"/>',
 '<path d="M6 20l12-13 3 3L9 23H5Z" fill="#008080"/><path d="M14 7l5 5M17 5l6 6"/>',
 '<circle cx="11" cy="11" r="6" fill="#fff"/><path d="M16 16l7 7" stroke="#000080" stroke-width="3"/>',
 '<path d="M7 22L13 5l6 3-8 16H6Z" fill="#ffff80"/>',
 '<path d="M10 7h7v10h-7ZM9 17h10v6H8Z" fill="#8b5c20"/><path d="M12 5v4m3-4v4"/>',
 '<path d="M6 22l5-12 7 3 4 9Z" fill="#000080"/><path d="M8 8l6-4m-9 9l5-3M17 7h4"/>',
 '<path d="M5 23L12 5h3l7 18m-14-7h11" fill="none" stroke-width="2"/>',
 '<path d="M5 5l18 18" stroke-width="2"/>',
 '<path d="M7 5c20 0-16 19 12 18" fill="none" stroke-width="2"/>',
 '<rect x="5" y="7" width="18" height="14" fill="none" stroke-width="2"/>',
 '<path d="M5 22l6-16h10l-5 8h7l-4 8Z" fill="none" stroke-width="2"/>',
 '<ellipse cx="14" cy="14" rx="10" ry="7" fill="none" stroke-width="2"/>',
 '<rect x="4" y="7" width="20" height="14" rx="5" fill="none" stroke-width="2"/>',
];
const PALETTE=['#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080','#808040','#004040','#0080ff','#004080','#8000ff','#804000','#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffff80','#00ff80','#80ffff','#8080ff','#ff80ff','#ff8040'];
export function paintFrameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="paint-chrome" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
  <path d="M0 0h600v600H0Z M82 60h490v440H82Z" fill="#c0c0c0" fill-rule="evenodd"/>
  <path d="M1 599V1h598" fill="none" stroke="#fff" stroke-width="2"/><path d="M599 1v598H1" fill="none" stroke="#202020" stroke-width="2"/><path d="M4 596V4h592M596 4v592H4" fill="none" stroke="#808080"/>
  <rect x="6" y="6" width="588" height="25" fill="#000080"/>
  <g transform="translate(9 10)"><rect width="17" height="17" fill="#fff" stroke="#808080"/><path d="M2 14l4-7 4 3 5-8v13Z" fill="#008000"/><circle cx="5" cy="4" r="2" fill="#0000ff"/><path d="M10 16l4-8 3 1-4 8Z" fill="#ff0080"/></g>
  <text x="32" y="24" fill="#fff" font-size="17" font-weight="bold" font-family="Tahoma,Arial,sans-serif">untitled - Paint</text>
  ${[518,542,566].map(x=>bevel(x,10,22,18)).join('')}
  <path d="M523 23h12M547 13h12v11h-12Z M571 13l12 11m0-11l-12 11" fill="none" stroke="#000" stroke-width="2"/>
  ${['File','Edit','View','Image','Options'].map((t,i)=>`<text x="${[12,52,95,144,206][i]}" y="49" fill="#111" font-family="Tahoma,Arial,sans-serif" font-size="15"><tspan text-decoration="underline">${t[0]}</tspan>${t.slice(1)}</text>`).join('')}
  <path d="M6 55h588" stroke="#808080"/><path d="M6 56h588" stroke="#fff"/>
  <g stroke="#111" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${TOOLS.map((icon,i)=>`<g transform="translate(${9+i%2*30} ${62+Math.floor(i/2)*30})">${bevel(0,0,28,28)}${icon}</g>`).join('')}</g>
  <path d="M9 329h58v82H9Z" fill="none" stroke="#fff"/><path d="M9 411v-82h58" fill="none" stroke="#808080"/>
  <path d="M79 503V58h496" fill="none" stroke="#404040" stroke-width="3"/><path d="M575 58v445H79" fill="none" stroke="#fff" stroke-width="2"/>
  <rect x="576" y="60" width="18" height="440" fill="#dedede"/>
  ${bevel(576,60,18,20)}${bevel(576,478,18,22)}${bevel(576,84,18,345)}
  <path d="M580 73l5-6 5 6Z M580 486l5 6 5-6Z" fill="#111"/>
  <rect x="82" y="503" width="490" height="18" fill="#dedede"/>${bevel(82,503,20,18)}${bevel(552,503,20,18)}${bevel(105,503,110,18)}
  <path d="M95 507l-6 5 6 5Z M559 507l6 5-6 5Z" fill="#111"/>
  <path d="M6 527h588" stroke="#808080"/><path d="M6 528h588" stroke="#fff"/>
  ${bevel(9,535,35,35)}<rect x="21" y="548" width="18" height="18" fill="#fff" stroke="#808080"/><rect x="13" y="539" width="18" height="18" fill="#000" stroke="#fff"/>
  ${PALETTE.map((c,i)=>`<rect x="${49+i%14*20}" y="${535+Math.floor(i/14)*20}" width="18" height="18" fill="${c}" stroke="#808080"/><path d="M${49+i%14*20} ${553+Math.floor(i/14)*20}h18v-18" fill="none" stroke="#fff"/>`).join('')}
  <path d="M6 578h588" stroke="#808080"/><path d="M6 579h588" stroke="#fff"/>
  <path d="M9 594v-11h447v11H9m450 0v-11h132" fill="none" stroke="#808080"/>
  <path d="M10 595h445m5 0h131M591 583v12" fill="none" stroke="#fff"/>
  <path d="M580 592l11-11m-6 11l6-6m-1 6l1-1" stroke="#808080"/>
  </svg>`;
}
export function paintFrameHtml(p) {
  const z=Math.max(50,Math.min(300,+p.zoom||100))/100,x=Math.max(0,Math.min(100,+(p.px??50)))-50,y=Math.max(0,Math.min(100,+(p.py??50)))-50;
  const photo=p.img?`<img src="${esc(p.img)}" alt="" style="transform:translate(${x}%,${y}%) scale(${z})">`:'<span class="paint-empty">添加照片</span>';
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="paint-window"><div class="paint-photo">${photo}</div>${paintFrameSvg()}</div>`;
}
