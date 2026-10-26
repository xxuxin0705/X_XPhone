// 小手机 · 音乐：播放器美化（心动页的几种样子），在心动页右上 ⋯ → 播放器美化 里切换
// 每种皮肤只负责画「唱片 / 歌词」那一块和配色，歌名、进度条、按钮由 music.js 统一画
import { esc } from '../../core.js';

export const SKINS = [['ncm', '粉色黑胶'], ['glow', '星环唱片'], ['ecg', '心电唱片'], ['star', '星空歌词']];

// 封面主色：先试着从图片里取，取不到（跨域）就按歌名散列挑一个
const cache = new Map();
const PAL = [[88, 140, 230], [236, 120, 160], [100, 190, 150], [170, 130, 230], [240, 160, 90]];
const hashTint = s => PAL[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
export function tintOf(song, onReady) {
  const k = song?.pic || song?.name || ''; if (cache.has(k)) return cache.get(k);
  const fb = hashTint(song?.name); if (!song?.pic || typeof Image != 'function') return fb;
  cache.set(k, fb);
  const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
  im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 12, 12); const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const M = Math.max(d[i], d[i + 1], d[i + 2]), m = Math.min(d[i], d[i + 1], d[i + 2]); if (M - m < 25 || M < 40) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } // 跳过灰和黑
    if (n > 5) { cache.set(k, [r / n | 0, g / n | 0, b / n | 0]); onReady?.(); } } catch { } };
  im.src = song.pic; return fb;
}
export const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// 把颜色调成浅色 / 深色（和白 / 黑混）
export const mix = (c, t, w) => c.map(v => Math.round(v + (t - v) * w));

// 心电唱片：一圈圈的沟槽，每圈上有几处心电图的小尖峰；画成 SVG，只算一次
let ecgSvg = '';
export function ecg() {
  if (ecgSvg) return ecgSvg;
  const R = 150, paths = [];
  for (let ring = 0; ring < 12; ring++) {
    const r = 44 + ring * 8.6, pts = [], beats = 3 + ring % 3, off = ring * .7;
    for (let i = 0; i <= 360; i += 2) { const a = i * Math.PI / 180; let d = 0; for (let b = 0; b < beats; b++) { const c = ((b / beats) * 360 + off * 40) % 360, dx = ((i - c + 540) % 360) - 180; if (Math.abs(dx) < 4) d = (4 - Math.abs(dx)) * (dx < 0 ? 1.6 : 2.4); else if (Math.abs(dx) < 9 && dx > 0) d = -1.2; else if (Math.abs(dx - 12) < 3) d = .9; }
      pts.push(`${(R + (r + d) * Math.cos(a)).toFixed(1)},${(R + (r + d) * Math.sin(a)).toFixed(1)}`); }
    paths.push(`<path d="M${pts.join('L')}Z" opacity="${(.45 + ring * .045).toFixed(2)}"/>`);
  }
  return ecgSvg = `<svg viewBox="0 0 300 300" class="mu-ecg-grooves" fill="none" stroke="#fff" stroke-width=".9" stroke-linejoin="round">${paths.join('')}</svg>`;
}
// 底部那条心电图（一个周期，重复铺开）
export const ecgStrip = () => `<svg viewBox="0 0 120 20" preserveAspectRatio="none" class="mu-ecg-strip"><path d="M0 12h18l3-2 3 2h8l2-9 3 16 2-7h10l3-2 3 2h20l2-9 3 16 2-7h10l3-2 3 2h22" fill="none" stroke="currentColor" stroke-width=".9" stroke-linejoin="round"/></svg>`;
const mt = s => { s = Math.max(0, s | 0); return `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
// 心电唱片左上角那块「参数」
export const ecgStats = (st, s, mode) => { const bpm = 56 + ([...String(s?.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 40);
  return `<div class="mu-ecg-stats">${[['HR', `${st.playing ? bpm : '--'}bpm`, '[60 ~ 100bpm]'], ['TIME', `${mt(st.t)}`, `[${mt(st.d)}]`], ['MODE', mode, ''], ['TRACK', esc((s?.name || '').slice(0, 14)), '']].map(([k, v, r]) => `<div><span>${k}</span><b>${v}</b><small>${r}</small></div>`).join('')}</div>`; };
// 飘着的音符
export const notesFloat = () => [0, 1, 2, 3].map(i => `<i class="mu-fn" style="--i:${i}">${['♪', '♫', '♪', '♩'][i]}</i>`).join('');
