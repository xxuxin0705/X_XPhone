// 小手机 · 商业街：横着滑的一条马卡龙色小街（粉紫、薄荷、奶油黄、婴儿蓝、蜜桃），线条干净圆润
// 街上的店：大头贴屋（之后做：按剧情生成照片 / 选风格 / 情侣头像）、一番赏（之后做：抽赏）、甜品屋、花房；最右边留一间空铺
// 现在只做样子：点店会晃一下门口的小牌子；功能之后接
import { S, $, page, reg, toast } from '../../core.js';

const CSS = new URL('./street.css?v=4', import.meta.url).href;
const css = () => { if (document.querySelector('link[data-street]')) return; document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" data-street href="${CSS}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=ZCOOL+KuaiLe&display=swap">`); };
const ST = () => (S.street ||= { coin: 1250, heart: 12 });

/* ---------- 配色 ---------- */
const INK = '#6b4235', LIL = '#f4bdb6', LIL2 = '#d9483f', PNK = '#f8d6d0', PNK2 = '#f39aa0', MNT = '#9fd0c1', MNT2 = '#4f9483', BUT = '#fbe3a0', BUT2 = '#f4cf63', SKY = '#cfe6e4', SKY2 = '#5fa595', PCH = '#f2c9a5', CRM = '#fbf1e1', GLASS1 = '#eaf5f3', GLASS2 = '#bfdcd8'; // 奶油米白 + 草莓红 + 柔黄 + 薄荷绿（上一版的配色）
const W = 1600, H = 470, GY = 384; // GY = 人行道上沿

/* ---------- 画布元件 ---------- */
const defs = `<defs>
<linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeee4"/><stop offset=".6" stop-color="#fcf3e8"/><stop offset="1" stop-color="#f7ead8"/></linearGradient>
<linearGradient id="st-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GLASS1}"/><stop offset="1" stop-color="${GLASS2}"/></linearGradient>
<linearGradient id="st-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fdeee6"/></linearGradient>
<linearGradient id="st-scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3a36"/><stop offset="1" stop-color="#2e2422"/></linearGradient>
<linearGradient id="st-wall-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf1e1"/><stop offset="1" stop-color="#f2e2c8"/></linearGradient>
<linearGradient id="st-wall-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf1e1"/><stop offset="1" stop-color="#f1e0c4"/></linearGradient>
<linearGradient id="st-wall-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9efe7"/><stop offset="1" stop-color="#bfe2d5"/></linearGradient>
<linearGradient id="st-wall-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8cdc6"/><stop offset="1" stop-color="#f2b7ae"/></linearGradient>
<radialGradient id="st-glow"><stop offset="0" stop-color="#fff6d6" stop-opacity=".95"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></radialGradient>
<radialGradient id="st-glow2"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#fff3e0" stop-opacity="0"/></radialGradient>
<pattern id="st-stp-l" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#fff"/><rect x="10" width="10" height="10" fill="${LIL2}"/></pattern>
<pattern id="st-stp-m" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#fff"/><rect x="10" width="10" height="10" fill="${BUT2}"/></pattern>
<pattern id="st-stp-c" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#fff"/><rect x="10" width="10" height="10" fill="${MNT2}"/></pattern>
<pattern id="st-stp-p" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#fff"/><rect x="10" width="10" height="10" fill="${PNK2}"/></pattern>
<pattern id="st-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="1.6" fill="#fff" opacity=".75"/></pattern>
<pattern id="st-star" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M11 6l1.4 3.4 3.6.3-2.8 2.3.9 3.5L11 13.6 7.9 15.5l.9-3.5L6 9.7l3.6-.3z" fill="#fff" opacity=".7"/></pattern>
<pattern id="st-tile" width="36" height="18" patternUnits="userSpaceOnUse"><rect width="36" height="18" fill="#efe1c9"/><path d="M0 17.5h36M18 0v18" stroke="#dcc8a8" stroke-width="1.4"/></pattern>
<filter id="st-soft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#a8795c" flood-opacity=".18"/></filter>
</defs>`;
const SW = 1.8;
const r = (x, y, w, h, f, rx = 0, s = INK, sw = SW) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${s ? `stroke="${s}" stroke-width="${sw}"` : ''}/>`;
const ln = (d, c = INK, w = SW) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const spark = (x, y, s = 1, c = '#fff') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -7C.8 -2 2 -.8 7 0 2 .8.8 2 0 7-.8 2-2 .8-7 0-2-.8-.8-2 0-7z" fill="${c}"/>`;
const heart = (x, y, s = 1, c = PNK2) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4c-3-3-8-3-8 1.5S0 13 0 13s8-3 8-7.5S3 1 0 4z" fill="${c}"/>`;
// 奶油花边（屋檐下一圈像挤奶油一样的波浪）
const frost = (x, y, w, c = '#fff') => { const n = Math.max(3, Math.round(w / 18)), s = w / n; let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += ` q${s / 2} ${i % 2 ? 9 : 13} ${s} 0`; return `<path d="${d}V${y - 6}H${x}z" fill="${c}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`; };
// 圆角条纹遮阳棚 + 下沿一排小圆弧
const awning = (x, y, w, pat, edge) => { const n = Math.round(w / 20), s = w / n; let d = `M${x} ${y + 20}`; for (let i = 0; i < n; i++) d += ` a${s / 2} ${s / 2.4} 0 0 0 ${s} 0`; return `<path d="M${x + 8} ${y}h${w - 16}q8 0 8 8v12H${x}V${y + 8}q0-8 8-8z" fill="url(#${pat})" stroke="${INK}" stroke-width="${SW}"/><path d="${d}z" fill="${edge}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`; };
// 窗：圆顶 / 圆形 / 圆角方
const win = (x, y, w, h, kind, frame) => {
  const shine = `<path d="M${x + w * .22} ${y + h * .32}l${w * .2} -${h * .14}M${x + w * .22} ${y + h * .48}l${w * .12} -${h * .08}" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
  const shape = kind == 'arch' ? `<path d="M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z" fill="url(#st-glass)" stroke="${frame}" stroke-width="4"/>` : kind == 'round' ? `<circle cx="${x + w / 2}" cy="${y + w / 2}" r="${w / 2}" fill="url(#st-glass)" stroke="${frame}" stroke-width="4"/>` : r(x, y, w, h, 'url(#st-glass)', 8, frame, 4);
  return shape + (kind == 'round' ? ln(`M${x + w / 2} ${y + 2}V${y + w - 2}M${x + 2} ${y + w / 2}H${x + w - 2}`, frame, 2) : ln(`M${x + w / 2} ${y + (kind == 'arch' ? 3 : 0)}V${y + h}`, frame, 2)) + shine;
};
const pots = (x, y, w, c) => { let f = r(x, y, w, 10, c, 5); for (let i = 0; i < w / 10; i++) { const cx = x + 6 + i * 10; f += `<circle cx="${cx}" cy="${y - 2}" r="4.6" fill="${MNT2}"/><circle cx="${cx + 1}" cy="${y - 5}" r="2.8" fill="${[PNK2, '#fff', BUT2, LIL2][i % 4]}"/>`; } return f; };
const tree = (x, s = 1, a = '#8fbf6c', b = '#b6da92') => `<g transform="translate(${x} ${GY}) scale(${s})"><path d="M-3 0V-62h6V0z" fill="#d9b9a3" stroke="${INK}" stroke-width="${SW}"/><circle cx="0" cy="-96" r="40" fill="${a}" stroke="${INK}" stroke-width="${SW}"/><circle cx="-12" cy="-108" r="16" fill="${b}"/><circle cx="16" cy="-84" r="5" fill="#fff" opacity=".8"/>${heart(-20, -92, .7, '#fff')}${spark(18, -116, .8)}</g>`;
const lamp = (x, c = LIL2) => `<g transform="translate(${x} ${GY})"><circle cx="0" cy="-150" r="36" fill="url(#st-glow)"/><path d="M-3 0V-136h6V0z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>${r(-10, -6, 20, 6, c, 3)}<circle cx="0" cy="-150" r="15" fill="#fff8de" stroke="${INK}" stroke-width="${SW}"/>${r(-10, -138, 20, 6, c, 3)}<path d="M-6 -165q6-8 12 0" fill="${c}" stroke="${INK}" stroke-width="${SW}"/><circle cx="-4" cy="-154" r="3" fill="#fff"/></g>`;
const bench = x => `<g transform="translate(${x} ${GY})">${r(-32, -28, 64, 8, PCH, 4)}${r(-32, -17, 64, 7, PCH, 3.5)}${ln('M-24 -10V0M24 -10V0', INK, 2.4)}</g>`;
const bunting = (x1, x2, y, sag = 24) => { let s = ln(`M${x1} ${y}Q${(x1 + x2) / 2} ${y + sag * 2} ${x2} ${y}`, INK, 1.2); const n = Math.round((x2 - x1) / 30); for (let i = 1; i < n; i++) { const t = i / n, px = x1 + (x2 - x1) * t, py = y + sag * 2 * 2 * t * (1 - t); s += `<path d="M${px - 7} ${py - 1}h14l-7 13z" fill="${[PNK, LIL, MNT, BUT, SKY][i % 5]}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`; } return s; };
const plate = (x, y, c = LIL2) => `<g class="st-plate" transform="translate(${x} ${y})">${ln('M-9 0l9-11 9 11', INK, 1.4)}<circle cx="0" cy="-11" r="2" fill="${c}"/>${r(-19, 0, 38, 16, '#fff', 8, INK, 1.5)}<text x="0" y="12" text-anchor="middle" class="st-hand" font-size="10.5" fill="${c}">準備中</text></g>`;
const cloud = (x, y, w, txt, fill, fg, fs) => `<g filter="url(#st-soft)"><path d="M${x + 20} ${y + 44}H${x + w - 20}A15 15 0 0 0 ${x + w - 8} ${y + 20}A17 17 0 0 0 ${x + w - 44} ${y + 6}A${w / 3} ${w / 4} 0 0 0 ${x + 44} ${y + 6}A17 17 0 0 0 ${x + 8} ${y + 20}A15 15 0 0 0 ${x + 20} ${y + 44}z" fill="${fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><text x="${x + w / 2}" y="${y + 36}" text-anchor="middle" class="st-hand" font-size="${fs}" fill="${fg}">${txt}</text></g>`;

/* ---------- 大头贴机（自己画的：发光灯罩、屏幕、两侧灯条、像素小爱心、出片口，旁边一道星星帘子） ---------- */
function booth(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
<circle cx="56" cy="40" r="70" fill="url(#st-glow2)"/>
<path d="M118 22h22v150h-22z" fill="none"/>${ln('M112 16H176', INK, 2.4)}<path d="M114 18c6 0 8 4 10 10l6 144h40l4-150c0-4 2-4 4-4H114z" fill="${LIL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M114 18c6 0 8 4 10 10l6 144h40l4-150c0-4 2-4 4-4H114z" fill="url(#st-star)"/>${ln('M140 26c-2 40 2 90 0 140M158 24c2 40-2 100 0 144', '#fff', 1.4)}
${r(0, 30, 112, 142, '#fff', 14)}
<path d="M-6 30c0-18 12-28 30-28h64c18 0 30 10 30 28z" fill="url(#st-hood)" stroke="${INK}" stroke-width="${SW}"/><path d="M8 24h96" stroke="${LIL}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
${r(10, 36, 8, 66, BUT, 4, INK, 1.4)}${r(94, 36, 8, 66, BUT, 4, INK, 1.4)}
<circle cx="56" cy="42" r="4.4" fill="#4b3f6b" stroke="${INK}" stroke-width="1.2"/><circle cx="57.2" cy="40.8" r="1.2" fill="#fff"/>
${r(24, 50, 64, 46, 'url(#st-scr)', 5, INK, 1.6)}${[0, 1, 2].map(c => [0, 1].map(rr => r(30 + c * 18, 55 + rr * 19, 15, 16, [PNK, MNT, LIL, BUT, SKY, PCH][c + rr * 3], 2, null)).join('')).join('')}
${r(20, 104, 72, 14, PCH, 7, INK, 1.4)}${[0, 1, 2, 3, 4].map(i => `<circle cx="${30 + i * 13}" cy="111" r="3.2" fill="#fff" stroke="${INK}" stroke-width="1"/>`).join('')}
${[0, 1, 2, 3, 4, 5].map(i => `<path transform="translate(${15 + i * 15} 128)" d="M0 2h2V0h2v2h2V0h2v2h2v4H8v2H6v2H4V8H2V6H0z" fill="${i % 2 ? PNK2 : LIL2}"/>`).join('')}
${r(34, 146, 44, 8, '#4b3f6b', 4, INK, 1.4)}<path d="M44 150h24v10H44z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${heart(56, 150, .45, PNK2)}
<path d="M88 136c4-6 12-6 12 0s-6 8-6 8-6-2-6-8z" fill="${PNK}" stroke="${INK}" stroke-width="1.2"/>${spark(-2, 58, .9, BUT2)}${spark(116, 70, .7, '#fff')}</g>`;
}

/* ---------- 五间铺子 ---------- */
function photoShop(x) { // 大头贴屋：粉紫两层，屋顶一朵云招牌，底楼整面敞开的拱形门洞里放着大头贴机
  const w = 270, top = 132;
  return `<g class="st-shop" data-a="stshop" data-x="photo" filter="url(#st-soft)">
${r(x + 6, top, w - 12, GY - top, 'url(#st-wall-l)', 0)}<rect x="${x + 6}" y="${top}" width="${w - 12}" height="${GY - top}" fill="url(#st-dots)"/>
<path d="M${x - 6} ${top}q0-22 22-22h${w - 32}q22 0 22 22z" fill="${PNK}" stroke="${INK}" stroke-width="${SW}"/>${frost(x - 6, top + 6, w + 12)}
${cloud(x + 50, top - 76, w - 100, '大頭貼', '#fff', LIL2, 30)}${spark(x + 44, top - 70, 1, BUT2)}${spark(x + w - 40, top - 56, .8, PNK2)}${heart(x + w - 60, top - 82, .9)}
${win(x + 30, top + 20, 52, 58, 'arch', LIL2)}${pots(x + 26, top + 80, 60, PCH)}${win(x + w / 2 - 22, top + 22, 44, 44, 'round', PNK2)}${win(x + w - 82, top + 20, 52, 58, 'arch', LIL2)}${pots(x + w - 86, top + 80, 60, PCH)}
${r(x, GY - 150, w, 150, 'url(#st-wall-p)', 0)}${r(x, GY - 22, w, 22, PNK2, 0)}
<path d="M${x + 16} ${GY}V${GY - 100}a60 40 0 0 1 120 0V${GY}z" fill="#fff4fa" stroke="${INK}" stroke-width="${SW}"/>
${booth(x + 28, GY - 150, .82)}
${r(x + 160, GY - 120, 94, 70, 'url(#st-glass)', 10, LIL2, 4)}${[0, 1, 2].map(i => `<g transform="rotate(${[-8, 4, -3][i]} ${x + 178 + i * 28} ${GY - 92})">${r(x + 168 + i * 28, GY - 108, 22, 28, '#fff', 2, INK, 1.2)}${r(x + 171 + i * 28, GY - 105, 16, 15, [PNK, MNT, BUT][i], 1, null)}</g>`).join('')}${ln(`M${x + 162} ${GY - 112}q46 10 90 0`, INK, 1)}
${r(x + 172, GY - 40, 70, 40, 'url(#st-glass)', 6, LIL2, 3)}
${awning(x - 6, GY - 168, w + 12, 'st-stp-l', '#fff')}${plate(x + 207, GY - 34)}</g>`;
}
function ichibanShop(x) { // 一番赏：薄荷 + 奶油黄，屋顶一只系蝴蝶结的大礼盒，橱窗里一格一格的奖品
  const w = 280, top = 98;
  return `<g class="st-shop" data-a="stshop" data-x="ichiban" filter="url(#st-soft)">
${r(x + 6, top, w - 12, GY - top, 'url(#st-wall-m)', 0)}<rect x="${x + 6}" y="${top}" width="${w - 12}" height="${GY - top}" fill="url(#st-dots)"/>
${r(x - 6, top - 14, w + 12, 18, MNT, 9)}${frost(x - 6, top + 4, w + 12, '#fff')}
<g transform="translate(${x + w / 2} ${top - 18})">${r(-40, -50, 80, 50, PNK, 6)}${r(-46, -62, 92, 16, PNK2, 6)}${r(-8, -62, 16, 62, LIL, 0)}<path d="M0 -62c-10-18-30-16-26-4 2 6 14 6 26 4zM0 -62c10-18 30-16 26-4-2 6-14 6-26 4z" fill="${LIL}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>${spark(-28, -30, .8)}${spark(30, -20, .6)}</g>
${win(x + 30, top + 22, 50, 62, 'box', MNT2)}${win(x + w / 2 - 25, top + 22, 50, 62, 'arch', MNT2)}${win(x + w - 80, top + 22, 50, 62, 'box', MNT2)}
${r(x + 40, top + 100, w - 80, 40, '#fff', 20, INK, SW)}<text x="${x + w / 2}" y="${top + 129}" text-anchor="middle" class="st-hand" font-size="27" fill="${MNT2}">一番賞</text>${spark(x + 58, top + 120, .9, BUT2)}${spark(x + w - 58, top + 120, .9, PNK2)}
${r(x, GY - 132, w, 132, '#e2625a', 0)}${r(x, GY - 22, w, 22, '#b8372f', 0)}
${r(x + 16, GY - 112, 160, 92, 'url(#st-glass)', 10, MNT2, 4)}${[0, 1].map(rw => [0, 1, 2, 3].map(c => { const bx = x + 26 + c * 37, by = GY - 104 + rw * 42, col = [PNK, LIL, MNT, SKY][(c + rw) % 4]; return r(bx, by + 6, 30, 30, col, 6, INK, 1.4) + `<text x="${bx + 15}" y="${by + 27}" text-anchor="middle" font-size="13" fill="#fff" class="st-hand">${'ABCDEFGH'[rw * 4 + c]}</text>`; }).join('')).join('')}${ln(`M${x + 18} ${GY - 64}h156`, MNT2, 2.4)}
${r(x + 192, GY - 116, 70, 116, MNT, 14, INK, SW)}${r(x + 202, GY - 104, 50, 44, 'url(#st-glass)', 10, MNT2, 2)}<circle cx="${x + 250}" cy="${GY - 52}" r="3.4" fill="${BUT2}" stroke="${INK}" stroke-width="1.2"/>
${awning(x - 6, GY - 150, w + 12, 'st-stp-m', '#fff')}${plate(x + 227, GY - 42, MNT2)}</g>`;
}
function sweetShop(x) { // 甜品屋：婴儿蓝，屋顶叠着三层马卡龙，门口一张小圆桌
  const w = 230, top = 158;
  const mac = (cx, cy, c, s = 1) => `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-30 -2a30 13 0 0 1 60 0z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>${r(-28, -2, 56, 6, '#fff', 3, INK, 1.4)}<path d="M-30 4h60a30 13 0 0 1 -60 0z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/></g>`;
  return `<g class="st-shop" data-a="stshop" data-x="sweet" filter="url(#st-soft)">
${r(x + 6, top, w - 12, GY - top, 'url(#st-wall-b)', 0)}<rect x="${x + 6}" y="${top}" width="${w - 12}" height="${GY - top}" fill="url(#st-dots)"/>
${r(x - 6, top - 14, w + 12, 18, '#fff', 9)}${frost(x - 6, top + 4, w + 12, PCH)}
${mac(x + w / 2, top - 22, PNK)}${mac(x + w / 2, top - 46, MNT, .82)}${mac(x + w / 2, top - 66, LIL, .64)}${spark(x + w / 2 + 42, top - 60, .9, BUT2)}
${win(x + 30, top + 22, 50, 56, 'arch', SKY2)}${win(x + w - 80, top + 22, 50, 56, 'arch', SKY2)}
${r(x, GY - 116, w, 116, CRM, 0)}${r(x, GY - 20, w, 20, SKY2, 0)}${r(x + 14, GY - 100, 110, 78, 'url(#st-glass)', 10, SKY2, 4)}${[0, 1, 2].map(i => `<g transform="translate(${x + 38 + i * 32} ${GY - 44})"><path d="M-12 0h24l-3 10h-18z" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="0" cy="-6" r="10" fill="${[PNK, BUT, LIL][i]}" stroke="${INK}" stroke-width="1.2"/></g>`).join('')}
${r(x + 140, GY - 104, 64, 104, PCH, 14, INK, SW)}${r(x + 150, GY - 94, 44, 38, 'url(#st-glass)', 10, '#e7a98c', 2)}
${cloud(x + 40, GY - 172, w - 80, '甜品屋', '#fff', SKY2, 21)}${awning(x - 6, GY - 128, w + 12, 'st-stp-c', '#fff')}
<g transform="translate(${x + 72} ${GY + 2})">${r(-24, -32, 48, 6, '#fff', 3)}${ln('M0 -26V0M-12 0h24', INK, 2)}<path d="M-6 -44h12v10h-12z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${heart(0, -50, .45)}</g>${plate(x + 172, GY - 40, SKY2)}</g>`;
}
function flowerShop(x) { // 花房：小小一间蜜桃粉，半圆玻璃顶，门口一排花桶
  const w = 180, top = 220;
  return `<g class="st-shop" data-a="stshop" data-x="flower" filter="url(#st-soft)">
<path d="M${x} ${top}a${w / 2} ${w / 2.2} 0 0 1 ${w} 0z" fill="url(#st-glass)" stroke="${INK}" stroke-width="${SW}"/>${ln(`M${x + w / 2} ${top - w / 2.2 + 2}V${top}M${x + w * .2} ${top - 30}L${x + w / 2} ${top}M${x + w * .8} ${top - 30}L${x + w / 2} ${top}`, INK, 1.2)}
${r(x + 4, top, w - 8, GY - top, CRM, 0)}${r(x - 6, top - 4, w + 12, 12, PNK, 6)}
${r(x + 14, GY - 104, 82, 84, 'url(#st-glass)', 10, PNK2, 4)}${r(x + 110, GY - 100, 54, 100, PNK, 14, INK, SW)}
${cloud(x + 30, top + 6, w - 60, '花房', '#fff', PNK2, 21)}${awning(x - 6, GY - 126, w + 12, 'st-stp-p', '#fff')}
${[0, 1, 2, 3].map(i => `<g transform="translate(${x + 24 + i * 22} ${GY - 1})"><path d="M-8 0l2-15h12l2 15z" fill="${[SKY, LIL, MNT, BUT][i]}" stroke="${INK}" stroke-width="1.3"/>${[-5, 0, 5].map((d, j) => `<circle cx="${d}" cy="${-21 - (j % 2) * 4}" r="5" fill="${[PNK2, BUT2, LIL2, '#fff'][(i + j) % 4]}" stroke="${INK}" stroke-width="1"/>`).join('')}</g>`).join('')}${plate(x + 137, GY - 42, PNK2)}</g>`;
}
const emptyShop = x => `<g filter="url(#st-soft)" opacity=".85">${r(x, 236, 220, GY - 236, '#f6e3d6', 0)}${r(x - 6, 224, 232, 16, LIL, 8)}${frost(x - 6, 240, 232)}${win(x + 30, 256, 46, 54, 'arch', LIL)}${win(x + 144, 256, 46, 54, 'arch', LIL)}${r(x + 24, GY - 82, 172, 82, '#fff', 12)}<text x="${x + 110}" y="${GY - 36}" text-anchor="middle" class="st-hand" font-size="19" fill="${LIL2}">敬请期待</text>${spark(x + 46, GY - 54, .8, BUT2)}${spark(x + 176, GY - 50, .7, PNK2)}</g>`;

/* ---------- 整条街 ---------- */
const far = () => { let f = ''; [0, 110, 230, 350, 470, 600, 730, 860, 990, 1120, 1250, 1380, 1500].forEach((x, i) => { const h = 150 + (i * 53 % 90), w = 86 + (i * 37 % 50), top = GY - h - 60; f += `<path d="M${x} ${GY}V${top + 16}q0-16 16-16h${w - 32}q16 0 16 16V${GY}z" fill="${['#f1dfd3', '#eadfcf', '#ece2d8', '#f3e3dc'][i % 4]}"/>${[...Array(Math.floor(h / 42))].map((_, k) => `<rect x="${x + 14}" y="${top + 24 + k * 42}" width="14" height="18" rx="7" fill="#fff" opacity=".7"/><rect x="${x + w - 28}" y="${top + 24 + k * 42}" width="14" height="18" rx="7" fill="#fff" opacity=".7"/>`).join('')}`; }); return f; };
const clouds = () => [[160, 66, 1], [640, 42, .8], [1080, 78, 1.1], [1440, 40, .75]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="46" ry="15" fill="#fff"/><ellipse cx="20" cy="-10" rx="25" ry="16" fill="#fff"/><ellipse cx="-18" cy="-6" rx="19" ry="12" fill="#fff"/></g>`).join('');
const sparks = () => [[80, 120], [300, 40], [520, 150], [760, 60], [980, 120], [1200, 30], [1350, 140], [1560, 90]].map(([x, y], i) => spark(x, y, .7 + (i % 3) * .2, i % 2 ? '#fff' : BUT)).join('');
export function scene() {
  return `<svg class="st-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs}
<rect width="${W}" height="${H}" fill="url(#st-sky)"/>${sparks()}${clouds()}<g opacity=".9">${far()}</g>
<rect x="0" y="${GY}" width="${W}" height="42" fill="url(#st-tile)"/><path d="M0 ${GY}H${W}" stroke="#d2bb98" stroke-width="2"/><rect x="0" y="${GY + 42}" width="${W}" height="10" fill="#e3cfae"/><rect x="0" y="${GY + 52}" width="${W}" height="${H - GY - 52}" fill="#d9c8b0"/>${[...Array(16)].map((_, i) => `<rect x="${30 + i * 100}" y="${GY + 64}" width="44" height="5" rx="2.5" fill="#fff" opacity=".85"/>`).join('')}
${tree(46, .85)}${photoShop(96)}${lamp(386)}${bunting(96, 390, 210)}${ichibanShop(420)}${tree(728, .95, '#a9d283', '#c9e4ad')}${bench(730)}${sweetShop(776)}${lamp(1028, SKY2)}${flowerShop(1056)}${tree(1260, .8, '#9fca78', '#c3e0a5')}${bunting(1270, 1560, 252, 18)}${emptyShop(1310)}
</svg>`;
}

/* ---------- 页面 ---------- */
const SHOPS = [['photo', '大头贴', '拍拍屋'], ['ichiban', '一番赏', '抽抽乐'], ['sweet', '甜品屋', '小坐一下'], ['flower', '花房', '买一束']];
const POS = { photo: 96 + 135, ichiban: 420 + 140, sweet: 776 + 115, flower: 1056 + 90 };
const coin = `<svg viewBox="0 0 20 20" width="15" height="15"><circle cx="10" cy="10" r="8.5" fill="${BUT}" stroke="${INK}" stroke-width="1.4"/>${spark(10, 10, .75, '#fff')}</svg>`;
const body = () => { const st = ST(); return `<div class="street">
<div class="st-top"><div class="st-title"><b class="st-hand">商业街</b><small>SHOPPING STREET · 慢慢逛</small></div><div class="st-chips"><span>${coin}${st.coin.toLocaleString()}</span><span><i>♥</i>${st.heart}</span></div></div>
<p class="st-slogan st-hand">美好的事，在这条街上悄悄发生</p>
<div class="st-stage phone-gesture-control" data-no-swipe-back><div class="st-scroll">${scene()}</div><i class="st-heart h1">♥</i><i class="st-heart h2">✦</i><i class="st-heart h3">♥</i><i class="st-heart h4">✦</i></div>
<section class="st-cards"><div class="st-new" data-a="stgo" data-x="photo"><div><small>今日上新</small><b class="st-hand">情侣头像 · 剧情合照</b><em>去拍一张 →</em></div><svg viewBox="0 0 120 80" width="112" height="76"><g transform="rotate(-8 40 40)">${r(14, 10, 44, 54, '#fff', 4)}${r(19, 15, 34, 34, PNK, 2, null)}<circle cx="36" cy="30" r="8" fill="#fff" stroke="${INK}" stroke-width="1.3"/></g><g transform="rotate(9 84 40)">${r(62, 12, 44, 54, '#fff', 4)}${r(67, 17, 34, 34, LIL, 2, null)}<circle cx="84" cy="32" r="8" fill="#fff" stroke="${INK}" stroke-width="1.3"/></g>${heart(60, 0, 1.2, PNK2)}${spark(108, 62, .9, BUT2)}</svg></div>
<div class="st-prize"><h6><span class="st-hand">一番赏 · 本期</span><small>A–D 赏</small></h6><div>${[['A', '大玩偶', PNK], ['B', '亚克力立牌', MNT], ['C', '吧唧', BUT], ['D', '明信片', LIL]].map(([k, n, c]) => `<b data-a="stgo" data-x="ichiban" style="--c:${c}"><i class="st-hand">${k}</i><span>${n}</span></b>`).join('')}</div></div></section>
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
  id: 'street', name: '商业街', icon: '<svg viewBox="0 0 24 24"><path d="M4.5 10.5h15V20h-15z" fill="#fff"/><path d="M3.5 10.5q0-4.5 4.5-4.5h8q4.5 0 4.5 4.5z" fill="#fff" opacity=".55"/><path d="M3.5 10.5a2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0 2.1 2.1 0 0 0 4.25 0z" fill="#fff"/><path d="M10 20v-4a2 2 0 0 1 4 0v4" fill="#c9b3ec"/><path d="M12 2.6l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="#fff"/></svg>',
  open: () => { css(); return page({ title: '', cls: 'street-pg', body, after: mount, acts: {
    stshop: (k, t) => { const sc = t.closest('.st-scroll'); if (sc?._moved && Date.now() - sc._moved < 300) return; const p = t.querySelector('.st-plate'); p?.classList.remove('sw'); void p?.getBBox?.(); p?.classList.add('sw'); const n = SHOPS.find(s => s[0] == k); toast(`${n[1]} · 準備中`); },
    stgo: (k, t, e, pg) => go(pg.el, k),
  } }); },
});
