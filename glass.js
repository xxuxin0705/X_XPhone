// 小手机 · 液态玻璃（iOS 26 Liquid Glass 那种）：边缘一圈像玻璃一样把后面的东西折射弯曲，中间清透，再加高光描边
// 做法：按元素大小画一张「位移图」（越靠边推得越多，方向朝里），用 SVG 滤镜 feDisplacementMap 作为 backdrop-filter
// 不支持 backdrop-filter:url() 的浏览器（Safari / Firefox）自动退回普通毛玻璃，样式在 .lg 的 CSS 里
const NS = 'http://www.w3.org/2000/svg';
let box, seq = 0;
export const lgOk = (() => { try { return typeof CSS != 'undefined' && CSS.supports('backdrop-filter', 'url(#a)') && !/Firefox|^((?!Chrome|Android).)*Safari/i.test(navigator.userAgent); } catch { return false; } })();
// 位移图：红 = 左右推多少，绿 = 上下推多少（128 不动）；只在离边 bezel 像素以内弯，曲线越靠边越陡
function map(w, h, r, bezel) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
  r = Math.min(r, w / 2, h / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + .5, py = j + .5, qx = Math.max(r, Math.min(w - r, px)), qy = Math.max(r, Math.min(h - r, py));
    let vx = px - qx, vy = py - qy, len = Math.hypot(vx, vy), dist;
    if (len > 0) { dist = r - len; vx /= len; vy /= len; } // 圆角处：朝圆心的反方向
    else { const e = [[px, -1, 0], [w - px, 1, 0], [py, 0, -1], [h - py, 0, 1]].sort((a, b) => a[0] - b[0])[0]; dist = e[0]; vx = e[1]; vy = e[2]; } // 直边：离哪条边最近就朝哪
    const t = Math.max(0, 1 - Math.max(0, dist) / bezel), m = t * t * (3 - 2 * t), o = (j * w + i) * 4;
    d[o] = 128 - vx * m * 127; d[o + 1] = 128 - vy * m * 127; d[o + 2] = 128; d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c.toDataURL();
}
// 给一个元素套上液态玻璃；尺寸变了自动重画位移图
export function liquid(el, { bezel = 22, scale = 46, sat = 1.7 } = {}) {
  if (!el) return; el.classList.add('lg'); if (!lgOk) return;
  box ||= Object.assign(document.body.appendChild(document.createElementNS(NS, 'svg')), {}); box.setAttribute('width', 0); box.setAttribute('height', 0); box.style.position = 'absolute';
  const id = el._lg ||= 'xp-lg' + seq++;
  const draw = () => { const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight); if (!w || !h || el._lgSz == w + 'x' + h) return; el._lgSz = w + 'x' + h;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; box.querySelector('#' + id)?.remove();
    const f = document.createElementNS(NS, 'filter'); f.id = id; Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }).forEach(([k, v]) => f.setAttribute(k, v));
    f.innerHTML = `<feImage href="${map(w, h, r, Math.min(bezel, h / 2))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b"/><feDisplacementMap in="b" in2="m" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
    box.append(f); el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id}) saturate(${sat}) brightness(1.05)`; };
  draw(); el._lgRo ||= new ResizeObserver(draw); el._lgRo.observe(el);
}
