// 小手机 · 从小红书链接导入实况锁屏：在你自己的手机（TauriTavern）里打开你给的那一篇笔记，
// 从页面里的笔记数据（window.__INITIAL_STATE__）找出每张图，实况图还带一段视频；你挑几张，照片 + 视频存下来当锁屏。
// 网络：优先用 TauriTavern 的原生请求（不受跨域限制）；网页版酒馆走酒馆自带的 /proxy/（要在 config.yaml 开 enableCorsProxy）。
import { C, esc, sheet, toast, task, putMedia, save, S, uid } from '../../core.js';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const REF = 'https://www.xiaohongshu.com/';
export const xhsHook = { get: null }; // 测试用：换成假的网络
async function net(url, blob) {
  if (xhsHook.get) return xhsHook.get(url, blob);
  const h = { 'User-Agent': UA, Referer: REF }, out = r => blob ? r.blob() : r.text();
  const tf = globalThis.__TAURI__?.http?.fetch;
  if (tf) try { const r = await tf(url, { method: 'GET', headers: h }); if (r.ok) return out(r); } catch { }
  try { const r = await fetch(url, { headers: h, referrerPolicy: 'no-referrer' }); if (r.ok) return out(r); } catch { }
  let r; try { r = await fetch('/proxy/' + url, { headers: { ...C().getRequestHeaders?.(), ...h } }); } catch { }
  if (!r?.ok) throw Error('连不上小红书：TauriTavern 里可以直接用；网页版酒馆要在 config.yaml 设 enableCorsProxy: true 后重启');
  return out(r);
}
// 从分享文字里找链接（「…… https://xhslink.cn/o/xxx 前往【小红书】……」）
export const linkIn = t => (String(t || '').match(/https?:\/\/[^\s，。！？】]+/) || [])[0] || '';
const fix = u => !u ? '' : (u.startsWith('//') ? 'https:' + u : u).replace(/^http:\/\//, 'https://');
// 解析页面：找出有 imageList 的那个笔记对象（手机页、电脑页的结构不一样，都能认）
export function parseXhs(html) {
  const m = String(html).match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/);
  if (!m) throw Error('没读到笔记内容（可能要登录才能看，或者链接不对）');
  let st; try { st = JSON.parse(m[1].trim().replace(/;\s*$/, '').replace(/:\s*undefined\b/g, ':null').replace(/\[undefined\]/g, '[null]')); } catch { throw Error('笔记数据看不懂（小红书可能改版了）'); }
  let note = null; const seen = new Set();
  const walk = o => { if (note || !o || typeof o != 'object' || seen.has(o)) return; seen.add(o); if (Array.isArray(o.imageList) && o.imageList.length) return void (note = o); Object.values(o).forEach(walk); };
  walk(st); if (!note) throw Error('这篇笔记里没有图片');
  const vid = o => { let u = ''; const w = x => { if (u || !x || typeof x != 'object') return; for (const [k, v] of Object.entries(x)) { if (typeof v == 'string' && /^(https?:)?\/\//.test(v) && (/masterUrl|backupUrl|url/i.test(k) && /video|stream|\.mp4|sns-video/i.test(v))) return void (u = v); if (Array.isArray(v) && /backupUrls/i.test(k) && typeof v[0] == 'string') return void (u = v[0]); w(v); } }; w(o); return u; };
  const items = note.imageList.map((it, i) => {
    const img = fix(it.urlDefault || it.url || it.infoList?.find(x => /DFT/i.test(x.imageScene))?.url || it.infoList?.[0]?.url || it.urlPre);
    const s = it.stream || {}, v = [...(s.h264 || []), ...(s.h265 || []), ...(s.av1 || [])][0], video = fix(v?.masterUrl || v?.backupUrls?.[0] || vid(it.stream || it.livePhotoInfo || {}));
    return { i, img, video, live: !!video };
  }).filter(x => x.img);
  return { title: note.title || String(note.desc || '').slice(0, 24) || '小红书笔记', items };
}
const readImg = b => new Promise((res, rej) => { const u = URL.createObjectURL(b), im = new Image(); im.onload = () => { const s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = Object.assign(document.createElement('canvas'), { width: Math.round(im.width * s), height: Math.round(im.height * s) }); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/webp', .9)); }; im.onerror = () => { URL.revokeObjectURL(u); rej(Error('图片打不开')); }; im.src = u; });
// 整个流程：粘贴链接 → 读笔记 → 挑图（标出实况）→ 存进自定义锁屏
export async function importXhs(done, ask) {
  const t = await ask(); const url = linkIn(t); if (!url) return t != null && toast('没找到链接，把分享文字整段粘贴进来就行');
  let note; await task('正在读取笔记', async () => { note = parseXhs(await net(url)); return `读到 ${note.items.length} 张图`; });
  if (!note?.items.length) return; // 读失败的原因已经在任务条里显示了
  const nl = note.items.filter(x => x.live).length; if (!nl) toast('这篇笔记里没有实况图，只能导入成静态图片');
  const pick = new Set(note.items.filter(x => x.live).length <= 6 ? note.items.filter(x => x.live).map(x => x.i) : []), urls = {};
  const s = sheet({ title: note.title, noBack: 1, cls: 'xhs-pk',
    body: () => `<p class="xhs-h">${note.items.length} 张图 · ${nl} 张实况　点选要导入的</p><div class="xhs-g">${note.items.map(x => `<div class="xhs-t ${pick.has(x.i) ? 'on' : ''}" data-a="xp" data-x="${x.i}"><img data-xi="${x.i}" alt="">${x.live ? '<em>LIVE</em>' : ''}<i>✓</i></div>`).join('')}</div><button class="btn pri" data-a="xgo">导入选中的 ${pick.size} 张</button>`,
    after: el => el.querySelectorAll('img[data-xi]').forEach(im => urls[im.dataset.xi] && (im.src = urls[im.dataset.xi])),
    onClose: () => Object.values(urls).forEach(u => URL.revokeObjectURL(u)),
    acts: {
      xp: (i, el) => { i = +i; pick.has(i) ? pick.delete(i) : pick.add(i); el.classList.toggle('on', pick.has(i)); s.el.querySelector('[data-a=xgo]').textContent = `导入选中的 ${pick.size} 张`; },
      xgo: () => { if (!pick.size) return toast('先点选几张'); const L = note.items.filter(x => pick.has(x.i)); s.close(); go(L); },
    } });
  // 小图一张张加载（图片有防盗链，网页里直接放链接显示不出来）
  (async () => { for (const x of note.items) { if (!s.el?.isConnected) break; try { const b = await net(x.img, 1); urls[x.i] = URL.createObjectURL(b); const im = s.el.querySelector(`img[data-xi="${x.i}"]`); im && (im.src = urls[x.i]); } catch { } } })();
  const go = L => task(`正在导入 ${L.length} 张`, async () => {
    const lib = S.lock.lib ||= []; let first = '', n = 0;
    for (const x of L) {
      const img = await putMedia(await readImg(await net(x.img, 1)), 'lock'), video = x.video ? await putMedia(await net(x.video, 1), 'lock').catch(() => '') : '';
      const id = uid(); lib.push({ id, img, video, from: 'xhs' }); first ||= id; n++; save();
    }
    S.lock.wp = 'c:' + first; save(); done?.(); return `已导入 ${n} 张${L.some(x => x.video) ? '（实况会动）' : ''}，锁屏换成第一张`;
  });
}
