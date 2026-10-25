// 小手机 · 桌面小组件「CCD 相机」：一台真的 CCD 背面（assets/ccd/body.webp，抠好的图：机身以外透明、屏幕也是透明的），你的照片从屏幕里透出来。
// 机身颜色随便选：拿机身图的明暗（高光、阴影都保留），换成你选的色相和饱和度，整体亮度往你选的颜色靠。算一次缓存一次。
// 相机后面还有一层「背景」：默认透明，也可以毛玻璃 / 纯色 / 渐变，后三种能调透明度。照片可以缩放、挪位置。
import { esc } from '../../core.js';

export const CCD_URL = new URL('../../assets/ccd/body.webp', import.meta.url).href;
export const CCD_W = 900, CCD_H = 777; // 机身图尺寸
export const CCD_SCR = { x: 11.45, y: 13.54, w: 52.76, h: 75.79 }; // 屏幕在机身图里的位置（%）
export const CCD_PINK = '#f2a7c4'; // 原图就是这个粉，选它就不用算
export const CCD_BG = [['none', '透明'], ['glass', '毛玻璃'], ['solid', '纯色'], ['grad', '渐变']];
// 背景层的样式（相机后面那一层）
export function ccdBg(p) {
  const a = Math.max(0, Math.min(1, (p.bgA ?? 60) / 100)), c = p.bgC || '#ffffff', c2 = p.bgC2 || '#ffd6e7';
  if (p.bg == 'solid') return `background:${hexa(c, a)}`;
  if (p.bg == 'grad') return `background:linear-gradient(${+p.bgDeg || 135}deg,${hexa(c, a)},${hexa(c2, a)})`;
  if (p.bg == 'glass') return `background:${hexa(c, a * .45)};backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)`;
  return '';
}
const hex = h => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hexa = (h, a) => `rgba(${hex(h).join(',')},${a})`;
const norm = h => /^#[0-9a-f]{6}$/i.test(h || '') ? h.toLowerCase() : CCD_PINK;

/* ---------- 换机身颜色 ---------- */
const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; if (M == m) return [0, 0, l]; const d = M - m, s = l > .5 ? d / (2 - M - m) : d / (M + m); const h = M == r ? (g - b) / d + (g < b ? 6 : 0) : M == g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; };
const hsl2rgb = (h, s, l) => { if (!s) return [l, l, l].map(x => x * 255); const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(x => x * 255); };
const cache = new Map(); // 颜色 → 算好的图（data URL）
let base; // 原图的像素（算一次）
const loadBase = () => base ||= new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { const c = document.createElement('canvas'); c.width = CCD_W; c.height = CCD_H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, CCD_W, CCD_H); let s = 0, n = 0; for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 128) { s += rgb2hsl(d.data[i], d.data[i + 1], d.data[i + 2])[2]; n++; } res({ d, mean: n ? s / n : .7, cv: c }); }; im.onerror = () => res(null); im.src = CCD_URL; });
// 算出某个颜色的机身：像素亮度 = 选的颜色的亮度 + (原像素亮度 − 原图平均亮度)，色相 / 饱和度用选的颜色
async function recolor(c) {
  const b = await loadBase(); if (!b) return '';
  const [h, s, l0] = rgb2hsl(...hex(c)), l = Math.max(.12, Math.min(.88, l0)), src = b.d.data, out = new ImageData(CCD_W, CCD_H), o = out.data;
  for (let i = 0; i < src.length; i += 4) { const a = src[i + 3]; if (!a) continue; const L = rgb2hsl(src[i], src[i + 1], src[i + 2])[2], [r, g, bl] = hsl2rgb(h, s, Math.max(0, Math.min(1, l + (L - b.mean)))); o[i] = r; o[i + 1] = g; o[i + 2] = bl; o[i + 3] = a; }
  b.cv.getContext('2d').putImageData(out, 0, 0); return b.cv.toDataURL('image/png');
}
const pending = new Set();
// 这个颜色的机身图：算过的直接给；没算过先给原图，算完把桌面上同色的机身换掉
export function ccdSrc(c, onReady) {
  c = norm(c); if (c == CCD_PINK) return CCD_URL; if (cache.has(c)) return cache.get(c);
  if (!pending.has(c)) { pending.add(c); recolor(c).then(u => { pending.delete(c); if (!u) return; cache.set(c, u); document.querySelectorAll(`img.ccd-body[data-c="${c}"]`).forEach(im => im.src = u); onReady?.(c, u); }); }
  return CCD_URL;
}
// 整个组件：背景层 + 机身 + 照片（照片在屏幕的位置，机身盖在上面）
export function ccdHtml(p, W = 2, H = 2) {
  const z = Math.max(50, +p.zoom || 100) / 100, px = p.px ?? 50, py = p.py ?? 50, c = norm(p.body);
  const img = p.img ? `<img src="${esc(p.img)}" style="object-position:${px}% ${py}%;transform:scale(${z})" alt="">` : `<i class="ccd-ph">＋</i>`;
  const sty = `left:${CCD_SCR.x}%;top:${CCD_SCR.y}%;width:${CCD_SCR.w}%;height:${CCD_SCR.h}%`;
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="ccd-cam"><div class="ccd-scr" style="${sty}">${img}</div><img class="ccd-body" data-c="${c}" src="${esc(ccdSrc(c))}" alt="" draggable="false"></div>`;
}
