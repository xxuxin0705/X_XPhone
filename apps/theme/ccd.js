// 小手机 · 桌面小组件「CCD 相机」：一台真的 CCD 背面（assets/ccd/body.webp，抠好的图：机身以外透明、屏幕也是透明的），你的照片从屏幕里透出来。
// 机身颜色以选中的 RGB 为底色，叠加原机壳的柔和明暗；屏幕暗框、中性色金属和透明区保留。
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
const clamp = v => Math.max(0, Math.min(1, v));
// 只把原图粉色机壳算入基准，排除透明区、暗框和中性色金属。
const tintTone = src => {
  const count = src.length / 4, light = new Float32Array(count), mask = new Float32Array(count), hist = new Uint32Array(256); let n = 0;
  for (let j = 0; j < count; j++) {
    const i = j * 4, r = src[i], g = src[i + 1], b = src[i + 2], l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    light[j] = l;
    const chroma = clamp((Math.min(r - g, b - g) - 2) / 12), t = clamp((l - .18) / .32);
    mask[j] = chroma * t * t * (3 - 2 * t); // 深色细节逐渐退出染色，避免变成荧光描边。
    if (src[i + 3] > 128 && mask[j] > .7 && l > .6) { hist[Math.round(l * 255)]++; n++; }
  }
  let anchor = .85, sum = 0;
  if (n) for (let i = 0; i < hist.length; i++) { sum += hist[i]; if (sum >= n / 2) { anchor = i / 255; break; } }
  return { light, mask, anchor };
};
// 以实选色为机壳中间色：高光向白色柔和混合，阴影按比例压暗 RGB，不再逐像素套用高饱和 HSL。
export function recolorPixels(src, color, tone = tintTone(src)) {
  const target = hex(norm(color)).map(v => v / 255), out = new Uint8ClampedArray(src), { light, mask, anchor } = tone;
  for (let j = 0; j < mask.length; j++) {
    const i = j * 4, amount = mask[j]; if (!src[i + 3] || !amount) continue;
    const d = light[j] - anchor, highlight = .65 * clamp(d / Math.max(.01, 1 - anchor)), shadow = 1 - .85 * clamp(-d / Math.max(.01, anchor));
    for (let k = 0; k < 3; k++) { const c = d >= 0 ? target[k] + (1 - target[k]) * highlight : target[k] * shadow; out[i + k] = src[i + k] * (1 - amount) + c * 255 * amount; }
  }
  return out;
}
const cache = new Map(); // 颜色 → 算好的图（data URL）
let base; // 原图的像素和机壳明暗基准（算一次）
const loadBase = () => base ||= new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { const c = document.createElement('canvas'); c.width = CCD_W; c.height = CCD_H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, CCD_W, CCD_H); res({ d, tone: tintTone(d.data), cv: c }); }; im.onerror = () => res(null); im.src = CCD_URL; });
async function recolor(c) {
  const b = await loadBase(); if (!b) return '';
  const out = new ImageData(recolorPixels(b.d.data, c, b.tone), CCD_W, CCD_H);
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
  const z = Math.max(50, +p.zoom || 100) / 100, px = Math.max(0, Math.min(100, +(p.px ?? 50))), py = Math.max(0, Math.min(100, +(p.py ?? 50))), c = norm(p.body);
  // 实际平移照片盒子；object-position 只移动 object-fit 的裁切余量，宽度刚好填满时左右移动会失效。
  // translate 放在 scale 前面，移动距离以屏幕为基准，不随缩放放大。
  const img = p.img ? `<img src="${esc(p.img)}" style="object-position:center;transform:translate(${px - 50}%,${py - 50}%) scale(${z})" alt="">` : `<i class="ccd-ph">＋</i>`;
  const sty = `left:${CCD_SCR.x}%;top:${CCD_SCR.y}%;width:${CCD_SCR.w}%;height:${CCD_SCR.h}%`;
  return `<div class="ccd-bg" style="${ccdBg(p)}"></div><div class="ccd-cam"><div class="ccd-scr" style="${sty}">${img}</div><img class="ccd-body" data-c="${c}" src="${esc(ccdSrc(c))}" alt="" draggable="false"></div>`;
}

