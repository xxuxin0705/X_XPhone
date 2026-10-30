// 窥探之眼 · 窗外：客厅那扇窗跟着真实的时间和天气变（思路参考 TangfanOVO/qiaosi 的「窗台」场景：天色跟着时间走、风雨雪雷，作者同意借鉴）
// - 时间：本机时钟。深夜 / 黎明 / 白天 / 傍晚 四段，窗玻璃换颜色，地上那道光跟着换（月光 → 日光 → 夕照）
// - 月亮：按真实月相画（盖住底图里画死的那弯月牙，再画一个当天的），白天不出来
// - 天气：可选「跟我这边一样」——要一次定位（只存到小数点后一位，约 10 公里），用 open-meteo（免费、不要密钥）查当前天气，半小时查一次；
//   没开或查不到就只跟时间走。雨：玻璃上斜着的雨丝；雪：慢慢飘的雪点；雷：偶尔一下闪白
// 只盖在窗玻璃上：assets/eye/win_mask.webp 是从 room.webp 抠出来的玻璃（窗框和窗外的树叶是空的，所以树影一直在）
import { S, save, toast } from '../../core.js';

const MASK = new URL('../../assets/eye/win_mask.webp', import.meta.url).href;
// 窗玻璃在底图上的范围（百分比：左 上 宽 高），月亮在窗里的位置（相对窗）
const WIN = [0, 0, 9.96, 41], MOON = { x: 51, y: 21.8, d: 34 };
const cfg = () => (S.eye ||= {});

// 一天里的哪一段（本机时间）
export function tod(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return h < 5 || h >= 19.5 ? 'night' : h < 7 ? 'dawn' : h < 17 ? 'day' : 'dusk'; }
// 月相：0 新月 → 0.5 满月 → 1；以 2000-01-06 18:14 UTC 的新月为起点，朔望月 29.530588 天
export function moonPhase(d = new Date()) { const p = ((d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588) % 1; return p < 0 ? p + 1 : p; }
// open-meteo 的天气代码 → rain / snow / storm / cloud / ''（晴）
const kind = c => c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c == 85 || c == 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c >= 45 ? 'fog' : c >= 2 ? 'cloud' : '';

export async function weather(force) {
  const e = cfg(); if (!e.wx?.on || !e.wx.lat) return '';
  if (!force && e.wxc && Date.now() - e.wxc.t < 30 * 60e3) return e.wxc.k;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${e.wx.lat}&longitude=${e.wx.lon}&current=weather_code`, { signal: AbortSignal.timeout?.(8000) });
    const k = kind(+(await r.json())?.current?.weather_code || 0); e.wxc = { t: Date.now(), k }; save(); return k;
  } catch { return e.wxc?.k || ''; }
}
// 打开 / 关掉「窗外跟我这边一样」：第一次要定位
export async function toggleWx() {
  const e = cfg();
  if (e.wx?.on) { e.wx.on = false; save(); toast('窗外只跟着时间走了'); return false; }
  const pos = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok(p.coords), () => ok(null), { timeout: 10e3, maximumAge: 36e5 }) : ok(null));
  if (!pos) { toast('没拿到位置（浏览器没给定位权限），窗外先只跟着时间走'); return false; }
  e.wx = { on: true, lat: +pos.latitude.toFixed(1), lon: +pos.longitude.toFixed(1) }; e.wxc = null; save();
  toast('窗外的天气跟你那边一样了'); return true;
}

export const skyHtml = () => `<div class="eye-win" style="left:${WIN[0]}%;top:${WIN[1]}%;width:${WIN[2]}%;height:${WIN[3]}%;--mask:url('${MASK}')">
<div class="win-cov"><i class="moon-cov" style="left:${MOON.x}%;top:${MOON.y}%"></i><i class="moon" style="left:${MOON.x}%;top:${MOON.y}%;width:${MOON.d}%"></i></div>
<div class="win-sky"><i class="sky-tint"></i><i class="sky-rain"></i><i class="sky-snow"></i><i class="sky-flash"></i></div></div>`;

// 按现在的时间 / 天气 / 月相刷一遍（打开时一次，之后每 5 分钟一次）
export async function paint(stage, force) {
  if (!stage?.isConnected) return;
  const t = tod(), p = moonPhase(), k = await weather(force);
  stage.dataset.tod = t; stage.dataset.wx = k;
  const m = stage.querySelector('.eye-win .moon'); if (m) {
    const lit = (1 - Math.cos(p * 2 * Math.PI)) / 2; // 亮的比例 0～1
    m.style.setProperty('--lit', lit.toFixed(3)); m.style.setProperty('--dir', p < .5 ? 1 : -1); // 上弦亮右边，下弦亮左边
    m.classList.toggle('none', lit < .04);
  }
}
export function startSky(stage) {
  if (!stage || stage._sky) return; stage._sky = 1; paint(stage);
  const iv = setInterval(() => stage.isConnected ? paint(stage) : clearInterval(iv), 5 * 60e3);
}
