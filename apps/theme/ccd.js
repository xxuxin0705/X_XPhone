// 小手机 · 桌面小组件「CCD 相机」：一台小 CCD 的背面，你的照片铺满它的屏幕；右边是快门、两个转盘，顶上一颗变焦钮。
// 机身三种颜色（银 / 紫 / 粉），相机后面还有一层「背景」：默认透明，也可以毛玻璃 / 纯色 / 渐变，后三种能调透明度。
// 照片：直接上传；缩放和位置可以微调（照片比屏幕大时也能挑想露出来的部分）。
import { esc } from '../../core.js';

export const CCD_BODY = [['silver', '银色'], ['lilac', '淡紫'], ['pink', '粉色']];
export const CCD_BG = [['none', '透明'], ['glass', '毛玻璃'], ['solid', '纯色'], ['grad', '渐变']];
const B = { // 机身用的几个颜色：主色、亮面、暗面、转盘
  silver: ['#d9d9de', '#f3f3f5', '#aeb0b6', '#c6c7cc'],
  lilac: ['#cdb9f0', '#ebe0ff', '#a48ed0', '#dccfff'],
  pink: ['#f2a7c4', '#ffd5e4', '#d57a9d', '#ffc2d8'],
};
// 背景层的样式（相机后面那一层）
export function ccdBg(p) {
  const a = Math.max(0, Math.min(1, (p.bgA ?? 60) / 100)), c = p.bgC || '#ffffff', c2 = p.bgC2 || '#ffd6e7';
  if (p.bg == 'solid') return `background:${hexa(c, a)}`;
  if (p.bg == 'grad') return `background:linear-gradient(${+p.bgDeg || 135}deg,${hexa(c, a)},${hexa(c2, a)})`;
  if (p.bg == 'glass') return `background:${hexa(c, a * .45)};backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)`;
  return '';
}
const hexa = (h, a) => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
// 画相机：用 SVG，机身按组件的宽高自动铺满；屏幕的位置算出来给照片用
export function ccdSvg(p, W = 2, H = 2) {
  const [c, hi, lo, dial] = B[p.body] || B.silver, sq = W == H;
  // 相机比例 1.22:1；组件不是正方形时相机居中
  const vw = 244, vh = 200;
  const scr = { x: 14, y: 16, w: 150, h: 168 }; // 屏幕
  return { scr, vw, vh, svg: `<svg viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" class="ccd-svg">
<defs><linearGradient id="ccdb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
<radialGradient id="ccdd" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
<rect x="2" y="8" width="${vw - 4}" height="${vh - 10}" rx="26" fill="url(#ccdb)" stroke="${lo}" stroke-width="1.5"/>
<rect x="6" y="11" width="${vw - 12}" height="30" rx="20" fill="${hi}" opacity=".35"/>
<rect x="196" y="0" width="32" height="16" rx="7" fill="${lo}"/><rect x="199" y="2" width="26" height="9" rx="4.5" fill="${hi}" opacity=".75"/>
<rect x="${scr.x - 4}" y="${scr.y - 4}" width="${scr.w + 8}" height="${scr.h + 8}" rx="10" fill="#1b1b1f"/>
<rect x="${scr.x}" y="${scr.y}" width="${scr.w}" height="${scr.h}" rx="7" fill="#2a2a30"/>
<circle cx="200" cy="50" r="13" fill="url(#ccdd)" stroke="${lo}" stroke-width="1.5"/><circle cx="200" cy="50" r="7" fill="none" stroke="${lo}" stroke-width="1" opacity=".6"/><circle cx="200" cy="50" r="2.5" fill="${lo}" opacity=".6"/>
<rect x="180" y="78" width="42" height="26" rx="9" fill="${lo}" opacity=".3"/><rect x="184" y="82" width="34" height="18" rx="6" fill="${hi}" opacity=".35"/>
<circle cx="200" cy="130" r="20" fill="url(#ccdd)" stroke="${lo}" stroke-width="1.5"/><circle cx="200" cy="130" r="13" fill="${dial}" stroke="${lo}" stroke-width="1"/><circle cx="200" cy="130" r="4" fill="${lo}"/>
<circle cx="200" cy="170" r="12" fill="url(#ccdd)" stroke="${lo}" stroke-width="1.5"/><circle cx="200" cy="170" r="4" fill="${lo}" opacity=".6"/>
<text x="178" y="31" font-size="6.5" fill="${lo}" font-family="sans-serif" font-weight="600" letter-spacing="1.2" opacity=".85">CCD</text>
</svg>` };
}
// 整个组件：背景层 + 相机 + 照片（照片放在屏幕的位置上）
export function ccdHtml(p, W = 2, H = 2) {
  const { scr, vw, vh, svg } = ccdSvg(p, W, H), z = Math.max(50, +p.zoom || 100) / 100, px = p.px ?? 50, py = p.py ?? 50;
  const img = p.img ? `<img src="${esc(p.img)}" style="object-position:${px}% ${py}%;transform:scale(${z})" alt="">` : `<i class="ccd-ph">＋<small>点我换照片</small></i>`;
  // 屏幕区域按 SVG 的 viewBox 比例定位（用百分比，组件任何尺寸都对得上）
  const sty = `left:${scr.x / vw * 100}%;top:${scr.y / vh * 100}%;width:${scr.w / vw * 100}%;height:${scr.h / vh * 100}%`;
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="ccd-cam">${svg}<div class="ccd-scr" style="${sty}">${img}</div></div>`;
}
