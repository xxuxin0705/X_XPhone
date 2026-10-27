// 小手机 · 商业街：横着的一条手绘风小街（奶油米白 + 草莓红 + 柔黄 + 薄荷绿），左右滑着逛
// 街上的店：大头贴屋（之后做：按剧情生成照片 / 选风格 / 情侣头像）、一番赏（之后做：抽赏），另外几家装饰用的小店
// 现在只做样子：点店会晃一下门口的小牌子；功能之后接
import { S, $, esc, save, page, reg, toast } from '../../core.js';

const CSS = new URL('./street.css?v=1', import.meta.url).href;
const css = () => { if (document.querySelector('link[data-street]')) return; document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" data-street href="${CSS}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=ZCOOL+KuaiLe&display=swap">`); };
const ST = () => (S.street ||= { coin: 1250, heart: 12 });

/* ---------- 画布：一张很宽的 SVG，水彩纸纹 + 线条轻微抖动 ---------- */
const W = 1560, H = 470, GY = 382; // GY = 人行道上沿
const INK = '#6b4235', RED = '#d9483f', RED2 = '#b8372f', PINK = '#f4bdb6', CREAM = '#fbf1e1', CREAM2 = '#f2e2c8', YEL = '#f4cf63', MINT = '#6fb3a2', MINT2 = '#4f9483', LEAF = '#8fbf6c', LEAF2 = '#6d9f52';
const defs = `<defs>
<filter id="st-wob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="st-paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .22  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<pattern id="st-awn-p" width="22" height="10" patternUnits="userSpaceOnUse"><rect width="11" height="10" fill="#f8dede"/><rect x="11" width="11" height="10" fill="${RED}"/></pattern>
<pattern id="st-awn-y" width="22" height="10" patternUnits="userSpaceOnUse"><rect width="11" height="10" fill="#fff6dc"/><rect x="11" width="11" height="10" fill="${YEL}"/></pattern>
<pattern id="st-awn-m" width="22" height="10" patternUnits="userSpaceOnUse"><rect width="11" height="10" fill="#eef8f2"/><rect x="11" width="11" height="10" fill="${MINT}"/></pattern>
<pattern id="st-tile" width="34" height="16" patternUnits="userSpaceOnUse"><rect width="34" height="16" fill="#efe1c9"/><path d="M0 15.5h34M17 0v16" stroke="#dcc8a8" stroke-width="1.2"/></pattern>
<pattern id="st-brick" width="26" height="14" patternUnits="userSpaceOnUse"><path d="M0 13.5h26M13 0v7M0 7h26M26 7v7" stroke="#e7d3b5" stroke-width="1"/></pattern>
<radialGradient id="st-glow"><stop offset="0" stop-color="#fff3c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>
<linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeee4"/><stop offset=".6" stop-color="#fcf3e8"/><stop offset="1" stop-color="#f7ead8"/></linearGradient>
<linearGradient id="st-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe6e4"/><stop offset="1" stop-color="#9fc9c6"/></linearGradient>
</defs>`;
const l = (d, c = INK, w = 2.2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const R = (x, y, w, h, f, rx = 0, s = INK, sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
// 遮阳棚：条纹 + 下沿小波浪
const awning = (x, y, w, pat, edge) => { const n = Math.round(w / 22), s = w / n; let wave = `M${x} ${y + 18}`; for (let i = 0; i < n; i++) wave += ` q${s / 2} 12 ${s} 0`; return `<path d="M${x + 6} ${y}h${w - 12}l6 18H${x}z" fill="url(#${pat})" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="${wave}" fill="${edge}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`; };
// 窗：拱形 / 方形，带窗框、窗台花箱
const win = (x, y, w, h, arch, frame = MINT2) => `<g>${arch ? `<path d="M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z" fill="url(#st-glass)" stroke="${frame}" stroke-width="4"/>` : R(x, y, w, h, 'url(#st-glass)', 2, frame, 4)}${l(`M${x + w / 2} ${y + (arch ? 4 : 0)}V${y + h}M${x} ${y + h * .55}h${w}`, frame, 2.4)}<path d="M${x + 5} ${y + h * .3}l${w * .25} -${h * .15}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>${box(x - 4, y + h, w + 8)}</g>`;
const box = (x, y, w) => { let f = ''; for (let i = 0; i < w / 9; i++) { const cx = x + 5 + i * 9, c = i % 3 == 1 ? RED : i % 3 == 2 ? '#f39aa0' : '#fff'; f += `<circle cx="${cx}" cy="${y - 2 - (i % 2) * 3}" r="4" fill="${LEAF}"/><circle cx="${cx + 2}" cy="${y - 5 - (i % 2) * 2}" r="2.6" fill="${c}"/>`; } return f + R(x, y, w, 9, '#c9875e', 2); };
const berry = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -2c-9 0-15 6-13 14 2 9 9 15 13 17 4-2 11-8 13-17 2-8-4-14-13-14z" fill="${RED}" stroke="${INK}" stroke-width="2"/><path d="M-9 -2l4-6 3 4 2-6 2 6 3-4 4 6-6 2h-6z" fill="${LEAF2}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>${[[-6, 6], [0, 4], [6, 6], [-4, 12], [3, 12], [0, 19]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="1.1" ry="1.6" fill="#fde7a8"/>`).join('')}</g>`;
const heart = (x, y, s = 1, c = RED) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4c-3-3-8-3-8 1.5S0 13 0 13s8-3 8-7.5S3 1 0 4z" fill="${c}"/>`;
const tree = (x, s = 1) => `<g transform="translate(${x} ${GY}) scale(${s})" filter="url(#st-wob)">${l('M0 0V-70M0 -40l-14-14M0 -52l12-12', '#8a5a44', 6)}<circle cx="-22" cy="-92" r="30" fill="${LEAF}"/><circle cx="18" cy="-98" r="32" fill="#9fca78"/><circle cx="-2" cy="-128" r="30" fill="#a9d283"/><circle cx="-30" cy="-118" r="20" fill="#b6da92"/><circle cx="26" cy="-70" r="20" fill="${LEAF2}" opacity=".85"/>${[[-30, -100], [10, -120], [24, -88], [-8, -80]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="3.2" fill="#f39aa0"/>`).join('')}</g>`;
const lamp = x => `<g transform="translate(${x} ${GY})">${l('M0 0V-150', '#3d3a3a', 5)}${l('M-8 0h16', '#3d3a3a', 6)}<circle cx="0" cy="-168" r="34" fill="url(#st-glow)"/><path d="M-11 -150h22l-4-26h-14z" fill="#fde9a6" stroke="#3d3a3a" stroke-width="3" stroke-linejoin="round"/><path d="M-13 -176h26l-13-10z" fill="#3d3a3a"/><path d="M-26 -120c6 6 14 6 20 0" fill="none" stroke="#3d3a3a" stroke-width="2"/><circle cx="-16" cy="-108" r="10" fill="${LEAF}" stroke="${INK}" stroke-width="1.5"/><circle cx="-19" cy="-110" r="3" fill="${RED}"/><circle cx="-12" cy="-105" r="3" fill="#f39aa0"/></g>`;
const bench = x => `<g transform="translate(${x} ${GY + 2})">${R(-30, -26, 60, 7, '#c9875e', 2)}${R(-30, -16, 60, 6, '#c9875e', 2)}${l('M-24 -10V4M24 -10V4', '#3d3a3a', 3)}</g>`;
const cat = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="13" ry="11" fill="#e9a25c" stroke="${INK}" stroke-width="2"/><circle cx="0" cy="-14" r="9" fill="#e9a25c" stroke="${INK}" stroke-width="2"/><path d="M-8 -19l1-8 5 5M8 -19l-1-8-5 5" fill="#e9a25c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="-3.5" cy="-15" r="1.3" fill="${INK}"/><circle cx="3.5" cy="-15" r="1.3" fill="${INK}"/><path d="M12 4c8 0 10-8 6-12" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`;
const sign = (x, y, w, txt, bg, fg = '#fff', fs = 22) => `<g>${R(x, y, w, 34, bg, 8, INK, 2.4)}<text x="${x + w / 2}" y="${y + 24}" text-anchor="middle" class="st-hand" font-size="${fs}" fill="${fg}">${txt}</text></g>`;
const plate = (x, y) => `<g class="st-plate" transform="translate(${x} ${y})">${l('M-10 0l10-12 10 12', INK, 1.6)}<rect x="-18" y="0" width="36" height="16" rx="3" fill="#fffaf0" stroke="${INK}" stroke-width="1.8"/><text x="0" y="12" text-anchor="middle" class="st-hand" font-size="10.5" fill="${RED2}">準備中</text></g>`;

/* ---------- 四家店 ---------- */
function photo(x) { // 大头贴屋：粉色底楼、奶油二楼、屋顶亮灯招牌、橱窗里一台大头贴机 + 一串拍立得
  const w = 250, top = 120;
  return `<g class="st-shop" data-a="stshop" data-x="photo"><g filter="url(#st-wob)">
${R(x + 6, top, w - 12, GY - top - 120, CREAM, 0)}<rect x="${x + 6}" y="${top}" width="${w - 12}" height="${GY - top - 120}" fill="url(#st-brick)"/>
${R(x - 4, top - 14, w + 8, 16, '#f6dcd2', 3)}${R(x + 20, top - 70, w - 40, 56, '#fff5ee', 10, INK, 2.4)}
${[...Array(9)].map((_, i) => `<circle cx="${x + 32 + i * ((w - 64) / 8)}" cy="${top - 64}" r="3.4" fill="#ffe28a" stroke="${INK}" stroke-width="1.2"/>`).join('')}
<text x="${x + w / 2}" y="${top - 30}" text-anchor="middle" class="st-hand" font-size="30" fill="${RED}">大頭貼</text>${heart(x + 34, top - 44, 1)}${heart(x + w - 36, top - 44, 1, '#f39aa0')}
${win(x + 34, top + 26, 54, 70, 1)}${win(x + w - 88, top + 26, 54, 70, 1)}${R(x + w / 2 - 12, top + 36, 24, 24, PINK, 12)}
${R(x, GY - 120, w, 120, PINK, 0)}${R(x, GY - 30, w, 30, MINT, 0)}
${R(x + 18, GY - 102, 132, 86, 'url(#st-glass)', 4, MINT2, 4)}
<g transform="translate(${x + 50} ${GY - 96})">${R(0, 6, 62, 74, '#fff', 8, INK, 2)}${R(8, 14, 46, 34, '#2f2a2f', 4, INK, 1.6)}<circle cx="31" cy="31" r="7" fill="#7fb7d8"/><path d="M0 52h62" stroke="${INK}" stroke-width="2"/>${[0, 1, 2, 3].map(i => `<rect x="${44 + 0}" y="${56 + i * 0}" width="0" height="0"/>`).join('')}<path d="M62 6c10 0 14 4 14 8v66H62z" fill="#f39aa0" stroke="${INK}" stroke-width="2"/>${l('M66 14v62M70 14v62', '#fff', 1.4)}</g>
${l(`M${x + 22} ${GY - 92}q66 18 124 0`, INK, 1.2)}${[0, 1, 2, 3, 4].map(i => `<rect x="${x + 30 + i * 24}" y="${GY - 90 + Math.sin(i) * 3}" width="15" height="18" fill="#fff" stroke="${INK}" stroke-width="1.2" transform="rotate(${i % 2 ? 6 : -6} ${x + 37 + i * 24} ${GY - 82})"/><rect x="${x + 32 + i * 24}" y="${GY - 88 + Math.sin(i) * 3}" width="11" height="10" fill="${['#f6b7b2', '#bfe0d6', '#fde19a', '#cdb8e8', '#f6b7b2'][i]}" transform="rotate(${i % 2 ? 6 : -6} ${x + 37 + i * 24} ${GY - 82})"/>`).join('')}
${R(x + 168, GY - 106, 58, 106, MINT, 6, INK, 2.4)}<circle cx="${x + 197}" cy="${GY - 76}" r="14" fill="url(#st-glass)" stroke="${MINT2}" stroke-width="3"/><circle cx="${x + 216}" cy="${GY - 48}" r="3" fill="${YEL}" stroke="${INK}" stroke-width="1.2"/>
${awning(x - 6, GY - 134, w + 12, 'st-awn-p', '#f8dede')}</g>${plate(x + 197, GY - 54)}</g>`;
}
function ichiban(x) { // 一番赏：红色底楼、奶油两层、黄色条纹遮阳棚、屋顶一颗大扭蛋、橱窗里摆满奖品箱
  const w = 280, top = 62;
  return `<g class="st-shop" data-a="stshop" data-x="ichiban"><g filter="url(#st-wob)">
${R(x + 8, top, w - 16, GY - top - 124, CREAM, 0)}<rect x="${x + 8}" y="${top}" width="${w - 16}" height="${GY - top - 124}" fill="url(#st-brick)"/>
${R(x, top - 12, w, 16, '#efd9bd', 3)}${l(`M${x + 6} ${top - 12}v-10h${w - 12}v10`, INK, 2)}${[...Array(14)].map((_, i) => l(`M${x + 12 + i * 19} ${top - 22}v10`, INK, 1.6)).join('')}
<g transform="translate(${x + w / 2} ${top - 56})"><circle r="40" fill="#fff6e8" stroke="${INK}" stroke-width="2.4"/><path d="M-40 0a40 40 0 0 0 80 0z" fill="${RED}" stroke="${INK}" stroke-width="2.4"/>${R(-44, -4, 88, 8, YEL, 4, INK, 2)}<circle cx="-14" cy="-16" r="6" fill="#fff" opacity=".9"/><text y="26" text-anchor="middle" class="st-hand" font-size="18" fill="#fff">賞</text></g>
${win(x + 30, top + 18, 56, 66, 0)}${win(x + w / 2 - 28, top + 18, 56, 66, 1)}${win(x + w - 86, top + 18, 56, 66, 0)}
${R(x + 26, top + 110, w - 52, 40, '#fff3dc', 6, INK, 2)}<text x="${x + w / 2}" y="${top + 139}" text-anchor="middle" class="st-hand" font-size="26" fill="${RED2}">一番賞</text>${berry(x + 46, top + 120, .55)}${berry(x + w - 46, top + 120, .55)}
${R(x, GY - 124, w, 124, RED, 0)}${R(x, GY - 26, w, 26, RED2, 0)}
${R(x + 16, GY - 104, 150, 88, 'url(#st-glass)', 4, '#3f7f71', 4)}${[0, 1].map(r => [0, 1, 2, 3].map(c => { const bx = x + 26 + c * 34, by = GY - 96 + r * 40, col = [PINK, YEL, '#bfe0d6', '#cdb8e8'][(c + r) % 4]; return R(bx, by + 8, 26, 24, col, 3, INK, 1.4) + `<text x="${bx + 13}" y="${by + 25}" text-anchor="middle" font-size="10" fill="${INK}" class="st-hand">${'ABCDEFGH'[r * 4 + c]}</text>`; }).join('')).join('')}${l(`M${x + 18} ${GY - 62}h146`, '#3f7f71', 2.4)}
${R(x + 186, GY - 108, 66, 108, '#3f7f71', 6, INK, 2.4)}${R(x + 196, GY - 98, 46, 40, 'url(#st-glass)', 4, '#2f6458', 2)}<circle cx="${x + 240}" cy="${GY - 50}" r="3.2" fill="${YEL}" stroke="${INK}" stroke-width="1.2"/>
<g transform="translate(${x + 180} ${GY - 70})">${R(-70, 0, 26, 34, '#fffaf0', 3, INK, 1.6)}<text x="-57" y="22" text-anchor="middle" class="st-hand" font-size="11" fill="${RED2}">抽</text></g>
${awning(x - 8, GY - 138, w + 16, 'st-awn-y', '#fff6dc')}</g>${plate(x + 219, GY - 44)}</g>`;
}
function cafe(x) { // 莓果咖啡：薄荷绿底楼、奶油二楼、屋顶一颗大草莓、门口小桌和一只猫
  const w = 220, top = 150;
  return `<g class="st-shop" data-a="stshop" data-x="cafe"><g filter="url(#st-wob)">
${R(x + 6, top, w - 12, GY - top - 112, CREAM2, 0)}<rect x="${x + 6}" y="${top}" width="${w - 12}" height="${GY - top - 112}" fill="url(#st-brick)"/>${R(x - 4, top - 12, w + 8, 14, '#e6d1b1', 3)}
${berry(x + w / 2, top - 52, 1.9)}
${win(x + 30, top + 18, 50, 60, 1, '#c96b5d')}${win(x + w - 80, top + 18, 50, 60, 1, '#c96b5d')}
${R(x, GY - 112, w, 112, MINT, 0)}${R(x, GY - 24, w, 24, MINT2, 0)}${R(x + 14, GY - 96, 108, 76, 'url(#st-glass)', 4, '#3f7f71', 4)}${R(x + 136, GY - 100, 62, 100, '#c96b5d', 6, INK, 2.4)}${R(x + 146, GY - 90, 42, 36, 'url(#st-glass)', 4, '#8e4a3f', 2)}
${sign(x + 18, GY - 152, w - 36, '莓果咖啡', '#fffaf0', RED, 22)}
${awning(x - 6, GY - 120, w + 12, 'st-awn-m', '#eef8f2')}</g>
<g transform="translate(${x + 60} ${GY + 6})">${R(-26, -32, 52, 6, '#c9875e', 2)}${l('M0 -26V2M-14 2h28', '#3d3a3a', 3)}<path d="M-8 -40h10v8h-10z" fill="#fff" stroke="${INK}" stroke-width="1.5"/>${heart(-6, -44, .5)}</g>${cat(x + 104, GY - 4)}${plate(x + 167, GY - 46)}</g>`;
}
function flower(x) { // 花店：小小一间，绿色遮阳棚，门口一排花桶
  const w = 170, top = 214;
  return `<g class="st-shop" data-a="stshop" data-x="flower"><g filter="url(#st-wob)">
${R(x + 4, top, w - 8, GY - top, '#fdf6ec', 0)}${R(x - 4, top - 12, w + 8, 14, '#e6d1b1', 3)}${win(x + w / 2 - 26, top + 14, 52, 46, 1, '#7b9e5a')}
${R(x + 14, GY - 96, 82, 80, 'url(#st-glass)', 4, '#5d8545', 4)}${R(x + 106, GY - 98, 48, 98, '#7b9e5a', 6, INK, 2.4)}
${sign(x + 20, top - 46, w - 40, '花', '#fffaf0', '#5d8545', 22)}${awning(x - 6, GY - 124, w + 12, 'st-awn-m', '#eef8f2')}
${[0, 1, 2, 3].map(i => `<g transform="translate(${x + 22 + i * 22} ${GY - 2})"><path d="M-8 0l2-16h12l2 16z" fill="#b9d3e6" stroke="${INK}" stroke-width="1.6"/>${[-5, 0, 5].map(d => `<circle cx="${d}" cy="-22" r="5" fill="${['#f39aa0', YEL, '#cdb8e8', RED][(i + d / 5 + 1) % 4 | 0]}" stroke="${INK}" stroke-width="1"/>`).join('')}</g>`).join('')}</g>${plate(x + 130, GY - 44)}</g>`;
}

/* ---------- 整条街 ---------- */
const far = () => { let f = ''; const xs = [0, 120, 230, 360, 470, 600, 720, 860, 990, 1120, 1250, 1380, 1480]; xs.forEach((x, i) => { const h = 150 + (i * 53 % 90), w = 90 + (i * 37 % 50); f += `<rect x="${x}" y="${GY - h - 60}" width="${w}" height="${h + 60}" rx="4" fill="${['#f1dfd3', '#eadfcf', '#ece2d8', '#f3e3dc'][i % 4]}"/>${[...Array(Math.floor(h / 40))].map((_, r) => `<rect x="${x + 16}" y="${GY - h - 40 + r * 40}" width="14" height="18" fill="#fff" opacity=".55"/><rect x="${x + w - 30}" y="${GY - h - 40 + r * 40}" width="14" height="18" fill="#fff" opacity=".55"/>`).join('')}`; }); return `<g opacity=".7">${f}</g>`; };
const clouds = () => [[160, 70, 1], [620, 46, .8], [1060, 80, 1.1], [1400, 40, .7]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})" opacity=".9"><ellipse cx="0" cy="0" rx="46" ry="16" fill="#fff"/><ellipse cx="22" cy="-10" rx="26" ry="16" fill="#fff"/><ellipse cx="-20" cy="-6" rx="20" ry="12" fill="#fff"/></g>`).join('');
const garland = (x1, x2, y) => { let s = l(`M${x1} ${y}q${(x2 - x1) / 2} 26 ${x2 - x1} 0`, INK, 1.2); for (let i = 1; i < 8; i++) { const t = i / 8, px = x1 + (x2 - x1) * t, py = y + 26 * 4 * t * (1 - t) * .5 * 2 * .5 * 2; s += `<path d="M${px - 6} ${py}h12l-6 11z" fill="${[RED, YEL, MINT, '#f39aa0'][i % 4]}" stroke="${INK}" stroke-width="1"/>`; } return s; };
export function scene() {
  return `<svg class="st-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs}
<rect width="${W}" height="${H}" fill="url(#st-sky)"/>${clouds()}<g class="st-far">${far()}</g>
<rect x="0" y="${GY}" width="${W}" height="40" fill="url(#st-tile)"/><path d="M0 ${GY}H${W}" stroke="#d2bb98" stroke-width="2"/><rect x="0" y="${GY + 40}" width="${W}" height="10" fill="#e3cfae"/><rect x="0" y="${GY + 50}" width="${W}" height="${H - GY - 50}" fill="#d9c8b0"/>${[...Array(16)].map((_, i) => `<rect x="${30 + i * 100}" y="${GY + 64}" width="44" height="5" rx="2" fill="#f7efe2" opacity=".8"/>`).join('')}
${tree(48, .9)}${photo(96)}${lamp(370)}${garland(96, 376, 214)}${ichiban(404)}${tree(714, 1)}${bench(712)}${cafe(758)}${lamp(1000)}${flower(1030)}${tree(1228, .85)}${garland(1236, 1520, 260)}
<g transform="translate(1290 0)">${R(0, 230, 230, GY - 230, '#f6e3d6', 0)}${R(-6, 218, 242, 14, '#e6d1b1', 3)}${win(30, 250, 50, 60, 1, '#b07a6a')}${win(150, 250, 50, 60, 1, '#b07a6a')}${R(20, GY - 90, 190, 90, '#efd0c4', 0)}${R(40, GY - 76, 150, 60, 'url(#st-glass)', 4, '#b07a6a', 3)}<text x="115" y="${GY - 40}" text-anchor="middle" class="st-hand" font-size="18" fill="#b07a6a" opacity=".8">敬请期待</text></g>
<rect width="${W}" height="${H}" filter="url(#st-paper)" fill="#fff" opacity=".9" pointer-events="none"/>
</svg>`;
}

/* ---------- 页面 ---------- */
const SHOPS = [['photo', '大头贴', '拍拍屋'], ['ichiban', '一番赏', '抽抽乐'], ['cafe', '莓果咖啡', '小坐一下'], ['flower', '花店', '买一束']];
const POS = { photo: 96 + 125, ichiban: 404 + 140, cafe: 758 + 110, flower: 1030 + 85 };
const body = () => { const st = ST(); return `<div class="street">
<div class="st-top"><div class="st-title"><b class="st-hand">商业街</b><small>SHOPPING STREET · 慢慢逛</small></div><div class="st-chips"><span><svg viewBox="-15 -10 30 33" width="15" height="17">${berry(0, 0, 1)}</svg>${st.coin.toLocaleString()}</span><span><i>♥</i>${st.heart}</span></div></div>
<p class="st-slogan st-hand">美好的事，在这条街上悄悄发生</p>
<div class="st-stage phone-gesture-control" data-no-swipe-back><div class="st-scroll">${scene()}</div><i class="st-heart h1">♥</i><i class="st-heart h2">♥</i><i class="st-heart h3">♥</i><i class="st-heart h4">♥</i></div>
<section class="st-cards"><div class="st-new" data-a="stgo" data-x="photo"><div><small>今日上新</small><b class="st-hand">情侣头像 · 剧情合照</b><em>去拍一张 →</em></div><svg viewBox="0 0 120 80" width="112" height="76"><g transform="rotate(-8 40 40)"><rect x="14" y="10" width="44" height="54" rx="3" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="19" y="15" width="34" height="34" fill="#f6b7b2"/><circle cx="36" cy="30" r="8" fill="#fbe3cf" stroke="${INK}" stroke-width="1.4"/></g><g transform="rotate(9 84 40)"><rect x="62" y="12" width="44" height="54" rx="3" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="67" y="17" width="34" height="34" fill="#bfe0d6"/><circle cx="84" cy="32" r="8" fill="#fbe3cf" stroke="${INK}" stroke-width="1.4"/></g>${heart(60, 2, 1.1)}${heart(104, 60, .7, '#f39aa0')}</svg></div>
<div class="st-prize"><h6><span class="st-hand">一番赏 · 本期</span><small>A–D 赏</small></h6><div>${[['A', '大玩偶', PINK], ['B', '亚克力立牌', '#bfe0d6'], ['C', '吧唧', YEL], ['D', '明信片', '#cdb8e8']].map(([k, n, c]) => `<b data-a="stgo" data-x="ichiban" style="--c:${c}"><i class="st-hand">${k}</i><span>${n}</span></b>`).join('')}</div></div></section>
<nav class="st-nav">${SHOPS.map(([k, n, s]) => `<b data-a="stgo" data-x="${k}"><span class="st-hand">${n}</span><small>${s}</small></b>`).join('')}</nav>
<footer class="st-foot"><span class="st-hand">逛一逛，今天也会有好事发生。</span></footer></div>`; };
// 手机上原生横滑；电脑上用鼠标拖着滑
function mount(el) {
  const sc = $('.st-scroll', el); if (!sc) return; let x0 = 0, s0 = 0, drag = 0;
  sc.addEventListener('pointerdown', e => { if (e.pointerType != 'mouse') return; x0 = e.clientX; s0 = sc.scrollLeft; drag = 1; sc.classList.add('drag'); });
  addEventListener('pointermove', e => { if (drag) sc.scrollLeft = s0 - (e.clientX - x0); });
  addEventListener('pointerup', e => { if (!drag) return; drag = 0; sc.classList.remove('drag'); if (Math.abs(e.clientX - x0) > 6) sc._moved = Date.now(); });
  requestAnimationFrame(() => { sc.scrollLeft = 40; });
}
const go = (el, k) => { const sc = $('.st-scroll', el), svg = $('svg', sc); if (!sc || !svg) return; const k2 = svg.clientWidth / W; sc.scrollTo({ left: POS[k] * k2 - sc.clientWidth / 2, behavior: 'smooth' }); };
reg({
  id: 'street', name: '商业街', icon: '<svg viewBox="0 0 24 24"><path d="M4 10.5h16V20H4z" fill="#fff"/><path d="M3 10.5l1.6-5h14.8l1.6 5z" fill="#ffe3a3"/><path d="M3 10.5c0 1.4 1.1 2.2 2.25 2.2S7.5 11.9 7.5 10.5c0 1.4 1.1 2.2 2.25 2.2S12 11.9 12 10.5c0 1.4 1.1 2.2 2.25 2.2s2.25-.8 2.25-2.2c0 1.4 1.1 2.2 2.25 2.2S21 11.9 21 10.5z" fill="#fff"/><path d="M10 20v-4.5h4V20" fill="#e8584e"/><circle cx="12" cy="4.2" r="2" fill="#e8584e"/></svg>',
  open: () => { css(); return page({ title: '', cls: 'street-pg', body, after: mount, acts: {
    stshop: (k, t) => { const sc = t.closest('.st-scroll'); if (sc?._moved && Date.now() - sc._moved < 300) return; const p = t.querySelector('.st-plate'); p?.classList.remove('sw'); void p?.getBBox?.(); p?.classList.add('sw'); const n = SHOPS.find(s => s[0] == k); toast(`${n[1]} · 準備中`); },
    stgo: (k, t, e, pg) => go(pg.el, k),
  } }); },
});
