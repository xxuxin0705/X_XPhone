// 小手机 · 时间样式：锁屏的大时间和桌面「时间」小组件共用
// 字体都是开源字体（SIL OFL），只截了数字和冒号（「圆润」另外带了日期里的常用汉字），每个只有几 KB，放在 assets/fonts
// p = { font, wt: 粗细, pos: 'top' 日期在上 / 'bot' 日期在下, lunar: 农历, auto: 跟随壁纸配色, c: 颜色, a: 不透明度 %, al: 对齐 }
import { esc, hm } from '../../core.js';

export const CLK_FONTS = [
  ['round', '圆润', 800], ['nunito', '圆体', 800], ['baloo', '泡泡', 700], ['fredoka', '软糖', 600], ['rubik', '胖胖', 700], ['outfit', '几何', 600],
  ['quicksand', '纤细', 500], ['varela', '细圆', 400], ['bebas', '窄高', 400], ['serif', '优雅', 300], ['playfair', '杂志', 500], ['dmserif', '衬线', 400],
  ['pacifico', '手写', 400], ['shrikhand', '复古', 400], ['sys', '系统', 600],
];
const FB = "-apple-system,'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',sans-serif"; // 单引号：要塞进 style="" 里
export const clkFam = k => k == 'sys' || !CLK_FONTS.some(f => f[0] == k) ? FB : `'xp-${k}',${FB}`;
const fam = clkFam;
export const CLK_DEF = { font: 'round', pos: 'top', lunar: true, al: 'c', auto: true, c: '#ffffff', a: 100 };
export const clkWt = k => CLK_FONTS.find(f => f[0] == k)?.[2] || 600;
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
export const clkStyle = p => { const k = p.font || 'round', w = +p.wt || clkWt(k), a = Math.max(0, Math.min(100, p.a ?? 100)) / 100;
  return `--clk-f:${fam(k)};--clk-w:${w};--clk-dw:${Math.min(700, Math.max(500, w))}` + (p.auto === false ? `;color:${hexa(p.c, a)}` : ''); };
export function clkHtml(p, d = new Date()) {
  const dt = `<small class="clk-d">${esc(dateText(d, p.lunar !== false))}</small>`, tm = `<b class="clk-t">${hm(d)}</b>`;
  return `<div class="clk ${p.pos == 'bot' ? 'bot' : ''} al-${p.al || 'c'}" style="${clkStyle(p)}">${p.pos == 'bot' ? tm + dt : dt + tm}</div>`;
}
