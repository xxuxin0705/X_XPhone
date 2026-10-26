// 小手机 · 时间样式：锁屏的大时间和桌面「时间」小组件共用
// 内置字体都是开源字体（SIL OFL），只截了数字和冒号，每个只有几 KB，放在 assets/fonts
// 也可以上传自己的字体文件（S.fonts = [{ id, n, src }]，文件存在浏览器本地数据库），key 是 'u:' + id
// p = { font, wt: 粗细, pos: 'top' 日期在上 / 'bot' 日期在下, h12: 12 小时制, lang: 'zh' / 'en', auto: 跟随壁纸配色, c: 颜色, a: 不透明度 %, al: 对齐 }
import { S, esc, hm, mediaSrc } from '../../core.js';

export const CLK_FONTS = [
  ['ios', '苹果粗体', 700],
  ['nunito', '圆体', 800], ['baloo', '泡泡', 700], ['fredoka', '软糖', 600], ['rubik', '胖胖', 700], ['outfit', '几何', 600],
  ['quicksand', '纤细', 500], ['varela', '细圆', 400], ['bebas', '窄高', 400], ['serif', '优雅', 300], ['playfair', '杂志', 500], ['dmserif', '衬线', 400],
  ['pacifico', '手写', 400], ['shrikhand', '复古', 400], ['sys', '系统', 600],
];
const FB = "-apple-system,'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',sans-serif"; // 单引号：要塞进 style="" 里
// 苹果设备使用 SF 系统字体，其他设备使用内置 Rubik，避免跟随酒馆的圆体或自定义字体。
const IOS = "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Helvetica Neue','xp-rubik',Arial,sans-serif";
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
export const clkFam = k => { k = mig(k); if (k == 'ios') return IOS; if (k.startsWith('u:')) { loadFont(k.slice(2)); return `'xp-u-${k.slice(2)}',${FB}`; } return k == 'sys' || !CLK_FONTS.some(f => f[0] == k) ? FB : `'xp-${k}',${FB}`; };
const fam = clkFam;
export const CLK_DEF = { font: 'nunito', pos: 'top', h12: false, lang: 'zh', al: 'c', auto: true, c: '#ffffff', a: 100 };
export const clkWt = k => { k = mig(k); return k.startsWith('u:') ? 600 : CLK_FONTS.find(f => f[0] == k)?.[2] || 600; };
// 字体文件只在第一次用到时加载
(() => { if (typeof document == 'undefined' || !document.getElementById || !document.head || document.getElementById('xp-clk-fonts')) return;
  const st = Object.assign(document.createElement('style'), { id: 'xp-clk-fonts' });
  st.textContent = CLK_FONTS.filter(f => !['sys', 'ios'].includes(f[0])).map(([k]) => `@font-face{font-family:"xp-${k}";src:url("${new URL(`../../assets/fonts/clk-${k}.woff`, import.meta.url).href}") format("woff");font-weight:100 900;font-display:swap}`).join('');
  document.head.append(st); })();

const WEEK = '日一二三四五六';
// 日期：2026年10月26日 周一 / Mon, Oct 26, 2026
export const dateText = (d, lang) => lang == 'en' ? new Intl.DateTimeFormat('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(d) : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
// 时间：24 小时制 09:12；12 小时制 9:12，后面小字上午 / 下午（英文 AM / PM）
export const timeHtml = (p, d) => { if (!p.h12) return hm(d); const h = d.getHours(), ap = p.lang == 'en' ? (h < 12 ? 'AM' : 'PM') : (h < 12 ? '上午' : '下午');
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}<i class="clk-ap">${ap}</i>`; };
const hexa = (h, a) => { const n = parseInt(String(h || '#ffffff').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
// 字体 / 粗细 / 颜色（auto 时不写颜色，跟外面走）
export const clkStyle = p => { const k = mig(p.font), w = +p.wt || clkWt(k), a = Math.max(0, Math.min(100, p.a ?? 100)) / 100;
  return `--clk-f:${fam(k)};--clk-w:${w};--clk-ls:${k == 'ios' ? '-.04em' : '-.01em'};--clk-dw:${Math.min(700, Math.max(500, w))}` + (p.auto === false ? `;color:${hexa(p.c, a)}` : ''); };
export function clkHtml(p, d = new Date()) {
  const dt = `<span class="clk-d">${esc(dateText(d, p.lang))}</span>`, tm = `<b class="clk-t">${timeHtml(p, d)}</b>`;
  return `<div class="clk ${p.pos == 'bot' ? 'bot' : ''} al-${p.al || 'c'}" style="${clkStyle(p)}">${p.pos == 'bot' ? tm + dt : dt + tm}</div>`;
}
