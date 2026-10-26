// 小手机 · 时间样式：锁屏的大时间和桌面「时间」小组件共用
// 内置字体都是开源字体（SIL OFL），只截了数字和冒号，每个只有几 KB，放在 assets/fonts
// 也可以上传自己的字体文件（S.fonts = [{ id, n, src }]，文件存在浏览器本地数据库），key 是 'u:' + id
// p = { font, wt: 粗细, pos: 'top' 日期在上 / 'bot' 日期在下, lunar: 农历, auto: 跟随壁纸配色, c: 颜色, a: 不透明度 %, al: 对齐 }
import { S, esc, hm, mediaSrc } from '../../core.js';

export const CLK_FONTS = [
  ['nunito', '圆体', 800], ['baloo', '泡泡', 700], ['fredoka', '软糖', 600], ['rubik', '胖胖', 700], ['outfit', '几何', 600],
  ['quicksand', '纤细', 500], ['varela', '细圆', 400], ['bebas', '窄高', 400], ['serif', '优雅', 300], ['playfair', '杂志', 500], ['dmserif', '衬线', 400],
  ['pacifico', '手写', 400], ['shrikhand', '复古', 400], ['sys', '系统', 600],
];
const FB = "-apple-system,'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',sans-serif"; // 单引号：要塞进 style="" 里
const mig = k => k == 'round' || !k ? 'nunito' : k; // 「圆润」去掉了
export const userFonts = () => S.fonts ||= [];
// 上传的字体：第一次用到时从本地数据库读出来注册
const loaded = new Map();
export const loadFont = id => { if (loaded.has(id)) return loaded.get(id); const f = userFonts().find(x => x.id == id); if (!f || typeof FontFace == 'undefined') return Promise.resolve();
  const p = mediaSrc(f.src).then(u => new FontFace('xp-u-' + id, `url(${u})`, { weight: '100 900' }).load()).then(ff => { document.fonts.add(ff); }).catch(() => loaded.delete(id)); loaded.set(id, p); return p; };
// 从字体文件里读出它自己的名字（name 表，4 = 完整名称；woff 压缩过的读不了就用文件名）
export async function fontName(file) {
  try { const v = new DataView(await file.slice(0, Math.min(file.size, 4 << 20)).arrayBuffer()), n = v.getUint16(4);
    for (let i = 0; i < n; i++) { const r = 12 + i * 16; if (String.fromCharCode(...[0, 1, 2, 3].map(j => v.getUint8(r + j))) != 'name') continue;
      const o = v.getUint32(r + 8), cnt = v.getUint16(o + 2), so = o + v.getUint16(o + 4); let best = '';
      for (let k = 0; k < cnt; k++) { const q = o + 6 + k * 12, pid = v.getUint16(q), id = v.getUint16(q + 6), len = v.getUint16(q + 8), off = so + v.getUint16(q + 10);
        if (pid != 3 || id != 4 && id != 1) continue; let t = ''; for (let c = 0; c < len; c += 2) t += String.fromCharCode(v.getUint16(off + c));
        if (id == 4) return t.trim(); best ||= t.trim(); }
      return best; } } catch { }
  return '';
}
export const clkFonts = () => [...userFonts().map(f => ['u:' + f.id, f.n, 0]), ...CLK_FONTS];
export const clkFam = k => { k = mig(k); if (k.startsWith('u:')) { loadFont(k.slice(2)); return `'xp-u-${k.slice(2)}',${FB}`; } return k == 'sys' || !CLK_FONTS.some(f => f[0] == k) ? FB : `'xp-${k}',${FB}`; };
const fam = clkFam;
export const CLK_DEF = { font: 'nunito', pos: 'top', lunar: true, al: 'c', auto: true, c: '#ffffff', a: 100 };
export const clkWt = k => { k = mig(k); return k.startsWith('u:') ? 600 : CLK_FONTS.find(f => f[0] == k)?.[2] || 600; };
// 字体文件只在第一次用到时加载
(() => { if (typeof document == 'undefined' || !document.getElementById || !document.head || document.getElementById('xp-clk-fonts')) return;
  const st = Object.assign(document.createElement('style'), { id: 'xp-clk-fonts' });
  st.textContent = CLK_FONTS.filter(f => f[0] != 'sys').map(([k]) => `@font-face{font-family:"xp-${k}";src:url("${new URL(`../../assets/fonts/clk-${k}.woff`, import.meta.url).href}") format("woff");font-weight:100 900;font-display:swap}`).join('');
  document.head.append(st); })();

const WEEK = '日一二三四五六', NUM = '〇一二三四五六七八九十';
const lday = n => n == 10 ? '初十' : n == 20 ? '二十' : n == 30 ? '三十' : n < 10 ? '初' + NUM[n] : n < 20 ? '十' + NUM[n - 10] : (n < 30 ? '廿' : '三十') + NUM[n % 10];
// 农历：丙午年九月十七（用浏览器自带的农历历法算）
export function lunar(d) {
  try { const P = Object.fromEntries(new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' }).formatToParts(d).map(x => [x.type, x.value]));
    const day = +String(P.day).replace(/\D/g, ''); return P.yearName && P.month && day ? `${P.yearName}年${P.month}${lday(day)}` : ''; } catch { return ''; }
}
export const dateText = (d, lu) => { const l = lu ? lunar(d) : ''; return `${d.getMonth() + 1}月${d.getDate()}日周${WEEK[d.getDay()]}${l ? ' · ' + l : ''}`; };
const hexa = (h, a) => { const n = parseInt(String(h || '#ffffff').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
// 字体 / 粗细 / 颜色（auto 时不写颜色，跟外面走）
export const clkStyle = p => { const k = mig(p.font), w = +p.wt || clkWt(k), a = Math.max(0, Math.min(100, p.a ?? 100)) / 100;
  return `--clk-f:${fam(k)};--clk-w:${w};--clk-dw:${Math.min(700, Math.max(500, w))}` + (p.auto === false ? `;color:${hexa(p.c, a)}` : ''); };
export function clkHtml(p, d = new Date()) {
  const dt = `<span class="clk-d">${esc(dateText(d, p.lunar !== false))}</span>`, tm = `<b class="clk-t">${hm(d)}</b>`;
  return `<div class="clk ${p.pos == 'bot' ? 'bot' : ''} al-${p.al || 'c'}" style="${clkStyle(p)}">${p.pos == 'bot' ? tm + dt : dt + tm}</div>`;
}
