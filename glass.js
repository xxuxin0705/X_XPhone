// 小手机 · 液态玻璃：整块玻璃连续折射后面的壁纸（不糊、不染色），只在左上和右下两角有亮边
// 思路参考小红书「放生一块液态玻璃」（Rains in Cali）：整块折射场 + 圆角遮罩 + 内部波动 + 左上右下高光；那边用 WebGL，这里用 SVG 位移图做同样的折射
// 做法：按元素大小画一张「位移图」（越靠边推得越多，方向朝里），用 SVG 滤镜 feDisplacementMap 作为 backdrop-filter
// 不支持 backdrop-filter:url() 的浏览器（Safari / Firefox）自动退回普通毛玻璃，样式在 .lg 的 CSS 里
const NS = 'http://www.w3.org/2000/svg';
let box, seq = 0;
export const lgOk = (() => { try { return typeof CSS != 'undefined' && CSS.supports('backdrop-filter', 'url(#a)') && !/Firefox|^((?!Chrome|Android).)*Safari/i.test(navigator.userAgent); } catch { return false; } })();
// 位移图（红 = 左右推多少，绿 = 上下推多少，128 不动）：整块都在折射，不只边缘——
// 从中心到边缘连续变强（radialBoundary），离边 edge 像素以内再加一段更陡的弯曲；再叠一层很轻的低频波纹（interiorWave），中心轻、边缘明显
const MC = new Map(); // 同尺寸的位移图只算一次（打开手机时不再重算一遍）
function map(w, h, r, edge) {
  const k = [w, h, r, edge].join(); if (MC.has(k)) return MC.get(k); const u = map0(w, h, r, edge); MC.size > 40 && MC.clear(); MC.set(k, u); return u;
}
function map0(w, h, r, edge) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
  r = Math.min(r, w / 2, h / 2); const half = Math.min(w, h) / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + .5, py = j + .5, qx = Math.max(r, Math.min(w - r, px)), qy = Math.max(r, Math.min(h - r, py));
    const len = Math.hypot(px - qx, py - qy), dist = len > 0 ? r - len : Math.min(px, w - px, py, h - py); // 离圆角矩形边缘多远
    let vx = (px - w / 2) / (w / 2), vy = (py - h / 2) / (h / 2); const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl; // 从中心往外的方向
    const s = Math.max(0, Math.min(1, 1 - dist / half)), e = Math.max(0, 1 - Math.max(0, dist) / edge);
    const wave = Math.sin(px * .045 + py * .02) * Math.cos(py * .05 - px * .015) * (.25 + .75 * s);
    const m = Math.min(1, s * s * .55 + e * e * .45), o = (j * w + i) * 4;
    d[o] = 128 - (vx * m + wave * .08) * 127; d[o + 1] = 128 - (vy * m + wave * .08) * 127; d[o + 2] = 128; d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c.toDataURL();
}
// 给一个元素套上液态玻璃；尺寸变了自动重画位移图
export function liquid(el, { bezel = 25, scale = 52, sat = 1.12 } = {}) { // 参数照那篇：refract 26、edge 25、tint 0、blur 0
  if (!el) return; el.classList.add('lg'); if (!lgOk) return;
  box ||= Object.assign(document.body.appendChild(document.createElementNS(NS, 'svg')), {}); box.setAttribute('width', 0); box.setAttribute('height', 0); box.style.position = 'absolute';
  const id = el._lg ||= 'xp-lg' + seq++;
  const draw = () => { const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight); if (!w || !h || el._lgSz == w + 'x' + h) return; el._lgSz = w + 'x' + h;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; box.querySelector('#' + id)?.remove();
    const f = document.createElementNS(NS, 'filter'); f.id = id; Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }).forEach(([k, v]) => f.setAttribute(k, v));
    f.innerHTML = `<feImage href="${map(w, h, r, Math.min(bezel, h / 2))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
    box.append(f); el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id}) saturate(${sat})`; };
  draw(); el._lgRo ||= new ResizeObserver(draw); el._lgRo.observe(el);
}
