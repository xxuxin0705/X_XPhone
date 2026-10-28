// 小手机 · 主题：桌面主题 / 壁纸 / 小组件 / 气泡样式 / 头像框 / 表情包 / 图标 / 自定义CSS
import { S, save, esc, uid, ui, $, reg, page, top, fx, btn, sec, menu, form, toast, pickFile, pickImg, APPS, drop, putMedia, mediaSrc, task, ok, emit } from '../../core.js';
import { renderDesk, icon, addDeskWidget } from '../../desk.js';
import { SCENES, mountScene } from '../../lockfx.js';
import { lock, lockMig, custKind, lockClk } from '../../lock.js';
import { clkHtml, clkFam, clkFonts, clkWt, userFonts, fontName } from './clock.js';
import { ballGrid, setBall } from '../../ball.js';

const BASE = { '--pg': '#f4f5f7', '--cd': '#fff', '--pt': '#1d1d1f', '--ln': 'rgba(0,0,0,.07)', '--gl': 'rgba(255,255,255,.45)', '--tx': '#fff', '--ink': '#333' };
export const THEMES = {
  matcha: { n: '抹茶星星', deco: 1, v: { '--wp': 'radial-gradient(120% 55% at 50% 48%,#b4dbbb 0%,#c6e3ca 45%,transparent 80%),linear-gradient(180deg,#dfe6e1 0%,#c1e0c7 42%,#a9d4b2 70%,#dfe7e1 100%)', '--ac': '#6fbf80', '--ink': '#3d5c45', '--gl': 'rgba(236,250,239,.5)', '--pg': '#f2f7f3' } },
  ios: { n: 'iOS 清透', v: { '--wp': 'radial-gradient(at 15% 10%,#a9c8ff 0,transparent 45%),radial-gradient(at 88% 28%,#f3c4ef 0,transparent 45%),radial-gradient(at 50% 88%,#ffd9a8 0,transparent 50%),#eef0f7', '--ac': '#0a84ff', '--ink': '#1c1c1e', '--pg': '#f2f2f7' } },
  cute: { n: '草莓牛奶', deco: 1, v: { '--wp': 'radial-gradient(#ffc9dc 1.6px,transparent 1.8px) 0 0/20px 20px,linear-gradient(180deg,#fff2f7,#ffd8e6 60%,#ffeaf1)', '--ac': '#ff7aa8', '--ink': '#83405b', '--gl': 'rgba(255,255,255,.6)', '--pg': '#fff6f9', '--tx': '#b8577c' } },
  cream: { n: '奶油布丁', v: { '--wp': 'radial-gradient(90% 50% at 50% 30%,#fff8ea,transparent),linear-gradient(180deg,#fbf3e4,#f1ddba 60%,#f8ecd6)', '--ac': '#d99a4e', '--ink': '#6b4f2c', '--gl': 'rgba(255,252,245,.6)', '--pg': '#fbf7f0', '--tx': '#8a6539' } },
  night: { n: '星夜', deco: 1, v: { '--wp': 'radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 18%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 66%,#fff,transparent),radial-gradient(1px 1px at 86% 58%,#fff,transparent),radial-gradient(1px 1px at 10% 80%,#fff,transparent),linear-gradient(180deg,#121836,#2a2156 55%,#45306f)', '--ac': '#a78bfa', '--ink': '#eceaff', '--gl': 'rgba(255,255,255,.1)', '--pg': '#111218', '--cd': '#1c1d25', '--pt': '#ececf2', '--ln': 'rgba(255,255,255,.08)' } },
};
export function applyTheme() {
  const t = THEMES[S.theme] || THEMES.matcha, r = ui.root; if (!r) return;
  Object.entries({ ...BASE, ...t.v }).forEach(([k, v]) => r.style.setProperty(k, v));
  r.style.setProperty('--wpi', S.wall ? `url("${S.wall}") center/cover` : t.v['--wp']); r.classList.toggle('deco', !!t.deco);
  $('#stp-css').textContent = S.css || '';
}

const AK = {
  widget: { n: '小组件', file: '.html,.txt', f: [['name', '名称'], ['sz', '尺寸', 'sel', [['2x1', '小 2×1'], ['2x2', '方 2×2'], ['4x1', '长条 4×1'], ['4x2', '大 4×2']]], ['html', 'HTML + CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']] },
  bubble: { n: '气泡样式', file: '.css,text/css', f: [['name', '名称'], ['css', 'CSS（.bub 气泡 / .me 我方 / .av 头像 / .cv 聊天区，聊天设置里选择）', 'area']] },
  frame: { n: '头像框', f: [['name', '名称'], ['img', '图片（透明PNG）', 'img']] },
  sticker: { n: '表情包', f: [['name', '描述（AI 会按描述发送）'], ['img', '图片', 'img']] },
};
// 重画时保持滚动位置（不要跳回最上面）
const rf = () => { const t = top(); if (!t) return; const b = t.el?.querySelector('.pg-b'), sc = b?.scrollTop; t.re(); const b2 = t.el?.querySelector('.pg-b'); b2 && sc != null && (b2.scrollTop = sc); };
// 锁屏壁纸：动态场景（雪夜、伞下烟火）的实时小预览 + 自定义（图片 / 5 秒内的视频 / 实况照片）
let pv = [];
const LIB = () => S.lock.lib ||= [];
const tile = it => `<div class="lw cu ${lon('c:' + it.id) ? 'on' : ''}" data-a="lwc" data-x="${it.id}" data-lp="lwcm">${it.img ? `<img data-i="${it.id}" alt="">` : `<video data-v="${it.id}" muted loop playsinline autoplay></video>`}${it.img && it.video ? '<em class="live">LIVE</em>' : ''}<span>${custKind(it)}</span></div>`;
// 随机锁屏开着时：格子上的勾＝参加随机（点一下加入 / 去掉）；关着时＝正在用的那张
const lon = k => S.lock.rand ? (S.lock.pool || []).includes(k) : S.lock.wp == k;
const lockSec = () => { lockMig(); const sc = SCENES.some(x => x[0] == S.lock.wp) ? S.lock.wp : /^c:/.test(String(S.lock.wp)) ? '' : SCENES[0][0];
  return fx(S).tog('lock.rand', '随机锁屏<small>每次打开手机随机换一张勾选的锁屏</small>') + `<div class="lwg">${SCENES.map(([k, n]) => `<div class="lw ${(S.lock.rand ? lon(k) : sc == k) ? 'on' : ''}" data-a="lw" data-x="${k}"><canvas data-fx="${k}"></canvas><span>${n}</span></div>`).join('')}${LIB().map(tile).join('')}<div class="lw vid" data-a="lwadd"><i>＋</i><span>自定义</span></div></div>`
  + btn('lprev', '预览锁屏', '', 'pri'); };
// 锁屏时间：预览 + 字体（每个格子用那个字体写出时间）+ 日期在上 / 下 + 农历 + 粗细 + 颜色
const clkSec = () => { const c = lockClk(), f = fx(S);
  return `<div class="clk-set"><div class="clk-pv">${clkHtml(c, new Date())}</div><div class="clk-fs">${clkFonts().map(([k, n]) => `<div class="clk-f ${c.font == k ? 'on' : ''}" data-a="clkf" data-x="${esc(k)}"${k.startsWith('u:') ? ` data-lp="clkfd"` : ''}><b style="font-family:${clkFam(k)};font-weight:${clkWt(k)}">06:39</b><span>${esc(n)}</span></div>`).join('')}<div class="clk-f add" data-a="clkup"><b>＋</b><span>上传字体</span></div></div>`
    + `<div class="seg">${[['top', '日期在上'], ['bot', '日期在下']].map(([k, n]) => `<button data-a="clkp" data-x="${k}" class="${(c.pos == 'top' ? 'top' : 'bot') == k ? 'on' : ''}">${n}</button>`).join('')}</div>`
    + `<div class="seg">${[[false, '24 小时'], [true, '12 小时']].map(([k, n]) => `<button data-a="clkset" data-k2="h12" data-x="${k ? 1 : ''}" class="${!!c.h12 == k ? 'on' : ''}">${n}</button>`).join('')}</div>`
    + `<div class="seg">${[['zh', '中文'], ['en', 'English']].map(([k, n]) => `<button data-a="clkset" data-k2="lang" data-x="${k}" class="${(c.lang || 'zh') == k ? 'on' : ''}">${n}</button>`).join('')}</div>`
    + f.inp('lock.clk.wt', '粗细（100～900）', 'number', String(clkWt(c.font))) + f.tog('lock.clk.auto', '跟随壁纸配色')
    + (c.auto === false ? f.inp('lock.clk.c', '颜色', 'color') + `<label class="row rg"><span>不透明度</span><input type="range" data-k="lock.clk.a" min="0" max="100" value="${c.a ?? 100}" data-u="%"><em>${c.a ?? 100}%</em></label>` : '') + '</div>'; };
const reClk = () => { const b = top()?.el.querySelector('.clk-set'); b && (b.outerHTML = clkSec()); };
const mountPv = (el, pg) => {
  pv.forEach(h => h.stop()); pv = [];
  el.querySelectorAll('canvas[data-fx]').forEach(cv => pv.push(mountScene(cv, cv.dataset.fx, { fps: 24, active: () => top() == pg && ui.root.classList.contains('on') && !cv.closest('.fold') })));
  for (const it of LIB()) {
    const v = el.querySelector(`video[data-v="${it.id}"]`); v && mediaSrc(it.video).then(u => { v.src = u; v.play?.().catch(() => {}); });
    const im = el.querySelector(`img[data-i="${it.id}"]`); im && mediaSrc(it.img).then(u => im.src = u);
  }
};
const vidDur = f => new Promise(r => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { r(v.duration); URL.revokeObjectURL(v.src); }; v.onerror = () => r(NaN); v.src = URL.createObjectURL(f); });
// 安卓的「动态照片」（小米 / 三星 / 谷歌 / vivo…）：JPG 后面直接接着一段 MP4，把它切出来
export async function motionVideo(f) {
  if (!/jpe?g/i.test(f.type || f.name || '')) return null;
  const b = new Uint8Array(await f.arrayBuffer());
  const al = c => c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || c == 32;
  for (let i = 64; i < b.length - 12; i++) if (b[i] == 0x66 && b[i + 1] == 0x74 && b[i + 2] == 0x79 && b[i + 3] == 0x70 && al(b[i + 4]) && al(b[i + 5]) && al(b[i + 6])) { // 'ftyp' + 品牌（isom / mp42 …）
    const st = i - 4, sz = (b[st] << 24 | b[st + 1] << 16 | b[st + 2] << 8 | b[st + 3]) >>> 0; if (sz >= 12 && sz < 64) return new Blob([b.subarray(st)], { type: 'video/mp4' });
  }
  return null;
}
const readFull = f => new Promise((res, rej) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { const s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = Object.assign(document.createElement('canvas'), { width: Math.round(im.width * s), height: Math.round(im.height * s) }); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/webp', .9)); }; im.onerror = () => { URL.revokeObjectURL(u); rej(Error('这张图片打不开（HEIC 格式请先转成 JPG）')); }; im.src = u; });
// 选一个：图片、视频，或者实况照片（安卓动态照片一张就行；苹果实况照片把照片和视频一起选上）
async function upVid() {
  const L = await pickFile('image/*,video/*', 1); if (!L?.length) return;
  const img = L.find(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)), vid = L.find(f => /^video\//.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name));
  let v = vid;
  if (img && !v) v = await motionVideo(img).catch(() => null);
  if (v) { const d = await vidDur(v), lim = img ? 8.4 : 5.4; if (isFinite(d) && d > lim) return toast(img ? `实况照片的视频要在 8 秒以内（这段 ${d.toFixed(1)} 秒）` : `视频要在 5 秒以内（这段 ${d.toFixed(1)} 秒）`); if (v.size > 40e6) return toast('视频太大了（超过 40MB），换一段吧'); }
  task(img && v ? '正在保存实况照片' : img ? '正在保存锁屏图片' : '正在保存锁屏视频', async () => {
    const iu = img ? await putMedia(await readFull(img), 'lock') : '', vu = v ? await putMedia(v, 'lock') : '', id = uid();
    LIB().push({ id, img: iu, video: vu }); S.lock.wp = 'c:' + id; save(); rf();
    return img && v ? '锁屏实况照片已设置（会一直循环播放）' : img ? (/jpe?g/i.test(img.type || img.name) ? '这张照片里没找到实况视频，存成了普通图片（实况照片要选原图；苹果实况要把照片和视频一起选上）' : '锁屏图片已设置') : '锁屏视频已设置';
  });
}
// 保存到手机：照片和视频各存一个文件（可以发给别人，或者以后再导入）
async function saveOut(it) {
  const one = async (u, n) => { if (!u) return; const src = await mediaSrc(u), b = await (await fetch(src)).blob(), ext = (b.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('quicktime', 'mov');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `${n}.${ext}` }); document.body.append(a); a.click(); setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 4000); };
  try { await one(it.img, 'xphone_lock_' + it.id); await one(it.video, 'xphone_lock_' + it.id); toast('已保存'); } catch (e) { toast('保存失败：' + e.message); }
}
// 选锁屏：随机关着＝换成这张；开着＝加入 / 去掉随机
function pickLock(k) {
  if (!S.lock.rand) { S.lock.wp = k; save(); return rf(); }
  const P = S.lock.pool ||= []; P.includes(k) ? P.length > 1 ? P.splice(P.indexOf(k), 1) : toast('至少留一张') : P.push(k); P.includes(S.lock.wp) || (S.lock.wp = P[0]); save(); rf(); // 现在用的那张被去掉了：换成勾选里的
}
// 桌面壁纸：可以存好几张，随机壁纸开着时每次回到桌面 / 打开手机随机换一张勾选的（「主题」＝主题自带的壁纸）
const WALLS = () => S.walls ||= [];
const wallMig = () => { if (S.wall && !WALLS().some(w => w.img == S.wall)) { WALLS().push({ id: uid(), img: S.wall }); save(); } };
const curWall = () => WALLS().find(w => w.img == S.wall)?.id || 'theme';
const won = id => S.wrand ? (S.wpool || []).includes(id) : curWall() == id;
const wallSec = () => { wallMig(); const t = THEMES[S.theme] || THEMES.matcha;
  return fx(S).tog('wrand', '随机壁纸<small>每次回到桌面、打开手机随机换一张勾选的壁纸</small>') + `<div class="lwg wpg"><div class="lw ${won('theme') ? 'on' : ''}" data-a="wsel" data-x="theme"><i class="wth" style="background:${t.v['--wp']}"></i><span>主题壁纸</span></div>${WALLS().map(w => `<div class="lw cu ${won(w.id) ? 'on' : ''}" data-a="wsel" data-x="${w.id}" data-lp="wdel"><img src="${esc(w.img)}" alt=""><span>壁纸</span></div>`).join('')}<div class="lw vid" data-a="wadd"><i>＋</i><span>上传</span></div></div>`; };
function pickWall(id) {
  if (S.wrand) { const P = S.wpool ||= []; P.includes(id) ? P.length > 1 ? P.splice(P.indexOf(id), 1) : toast('至少留一张') : P.push(id); P.includes(curWall()) || (S.wall = P[0] == 'theme' ? '' : WALLS().find(w => w.id == P[0])?.img || ''); save(); applyTheme(); return rf(); }
  S.wall = id == 'theme' ? '' : WALLS().find(w => w.id == id)?.img || ''; save(); applyTheme(); rf();
}
async function addWall() { const f = await pickFile(); if (!f) return; task('正在保存壁纸', async () => { const u = await putMedia(await readFull(f), 'wall'), id = uid(); WALLS().push({ id, img: u }); S.wrand ? (S.wpool ||= []).push(id) : (S.wall = u); save(); applyTheme(); rf(); return '壁纸已添加'; }); }
// 随机换：尽量不跟现在这张一样
export function randWall() { if (!S.wrand) return; const P = (S.wpool || []).filter(id => id == 'theme' || WALLS().some(w => w.id == id)); if (!P.length) return; const cur = curWall(), c = P.length > 1 ? P.filter(x => x != cur) : P, id = c[Math.random() * c.length | 0]; S.wall = id == 'theme' ? '' : WALLS().find(w => w.id == id).img; save(); applyTheme(); }
async function edit(k, a) { const r = await form((a ? '编辑' : '新建') + AK[k].n, AK[k].f, a || {}); if (!r) return; a ? Object.assign(a, r) : S.assets[k].push({ id: uid(), ...r }); save(); rf(); }

// 应用美化：每个应用自己选样式（以后可以从资源库导入自定义方案）。现在只有「消息」有好几种：微信 / QQ / KakaoTalk / LINE
const AST = {
  chat: { n: '消息', key: 'style', list: [['wx', '微信', ['#ededed', '#ededed', '#ffffff', '#95ec69']], ['qq', 'QQ', ['#f1f2f6', '#f1f2f6', '#ffffff', '#0099ff']], ['kk', 'KakaoTalk', ['#bacee0', '#bacee0', '#ffffff', '#fee500']], ['line', 'LINE', ['#7494c0', '#8cabd9', '#ffffff', '#85e249']]] },
  music: { n: '音乐', list: [['', '默认', ['#f5f5f7', '#ffffff', '#f0f0f3', '#fc3d49']]] },
  isle: { n: '心屿', list: [['', '默认', ['#f6f3e9', '#f6f3e9', '#e4e9dc', '#456b5e']]] },
  street: { n: '商业街', list: [['', '默认', ['#fbf3e6', '#fbf3e6', '#fff7ec', '#d9483f']]] },
};
const mock = ([h, pg, inB, outB]) => `<span class="ast-mock" style="background:${pg}"><i style="background:${h}"></i><i style="background:${inB}"></i><i style="background:${outB}"></i></span>`;
const astCur = k => { const a = AST[k]; return a.key ? S[a.key] || a.list[0][0] : ''; };
const astName = k => AST[k].list.find(x => x[0] == astCur(k))?.[1] || AST[k].list[0][1];
function appStyle(k) {
  const a = AST[k], pg = page({ title: a.n, cls: 'thm', body: () => `<div class="card ast-g">${a.list.map(([v, n, c]) => `<div class="ast ${astCur(k) == v ? 'on' : ''}" data-a="astpick" data-x="${v}">${mock(c)}<em>${esc(n)}</em></div>`).join('')}</div>`
    + (k == 'chat' ? `<div class="card"><div class="row go" data-a="asticon"><span><i class="ico mini a-chat">${APPS.chat.icon}</i>图标</span><small>${esc(APPS.chat.name)}</small></div></div>` + sec('ast-chat', [['bubble', `气泡样式 · ${S.assets.bubble.length}`, `<div class="ag">${S.assets.bubble.map(x => `<div class="ai" data-a="ae" data-x="bubble:${x.id}" data-lp="ad"><b>${esc(x.name.slice(0, 2))}</b><small>${esc(x.name)}</small></div>`).join('')}<div class="ai add" data-a="aa" data-x="bubble">＋</div></div>${btn('af', '导入文件', 'bubble')}`]]) : ''),
    acts: { astpick: v => { if (!a.key) return; S[a.key] = v; save(); emit('chat'); renderDesk(); pg.re(); },
      asticon: async () => { const id = 'chat.' + (S.style || 'wx'), v = await pickImg(256, 'icon'), old = S.icons[id]; if (v == null) return; v ? (S.icons[id] = v) : delete S.icons[id]; save(); drop(old); renderDesk(); pg.re(); }, aa: k2 => edit(k2), ae: x => { const [k2, id] = x.split(':'); edit(k2, S.assets[k2].find(y => y.id == id)); },
      ad: async x => { const [k2, id] = x.split(':'), l = S.assets[k2], it = l.find(y => y.id == id); if (await menu([['x', '删除', 'danger']], esc(it.name)) == 'x') { drop(l.splice(l.indexOf(it), 1)); save(); pg.re(); } },
      af: async k2 => { const fl = await pickFile(AK[k2].file); if (!fl) return; S.assets[k2].push({ id: uid(), name: fl.name.replace(/\.\w+$/, ''), css: await fl.text() }); save(); pg.re(); } } });
}
// 壁纸页（设置 → 锁屏与密码 里点「锁屏壁纸」/「桌面壁纸」直接打开，不用跳到主题）
const WA = {
  lw: k => pickLock(k), lwc: id => pickLock('c:' + id), lwadd: () => upVid(), lprev: () => lock(true),
  lwcm: async id => { const it = LIB().find(x => x.id == id); if (!it) return; const n = custKind(it), k = await menu([['s', '保存到手机'], ['d', '删除这张' + n, 'danger']], '自定义 · ' + n);
    if (k == 's') saveOut(it);
    if (k == 'd' && await ok(`删除这张锁屏${n}？文件也会一起删除`)) { LIB().splice(LIB().indexOf(it), 1); drop([it.img, it.video]); S.lock.wp == 'c:' + id && (S.lock.wp = SCENES[0][0]); save(); rf(); } },
  wsel: id => pickWall(id), wadd: () => addWall(),
  wdel: async id => { const w = WALLS().find(x => x.id == id); if (!w || !await ok('删除这张壁纸？')) return; WALLS().splice(WALLS().indexOf(w), 1); S.wpool = (S.wpool || []).filter(x => x != id); S.wall == w.img && (S.wall = ''); drop(w.img); save(); applyTheme(); rf(); },
};
const wpChange = k => { /wall|css/.test(k) && applyTheme(); k == 'wrand' && (S.wrand && !S.wpool?.length && (S.wpool = [curWall()]), save(), rf()); k == 'lock.rand' && (S.lock.rand && !S.lock.pool?.length && (S.lock.pool = [S.lock.wp]), save(), rf()); };
export const wallName = () => { wallMig(); const i = WALLS().findIndex(w => w.img == S.wall); return S.wrand ? '随机' : i < 0 ? '主题壁纸' : '自定义图片'; };
export function wallPage(kind) {
  const L = kind == 'lock';
  return page({ title: L ? '锁屏壁纸' : '桌面壁纸', cls: 'thm wpp', after: el => mountPv(el, top()), onClose: () => (pv.forEach(h => h.stop()), pv = []),
    body: () => `<div class="card wps">${L ? lockSec() : wallSec()}</div>`, acts: WA, onChange: wpChange });
}

let themeScope = 'global';
reg({
  id: 'theme', name: '主题', icon: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.3-.7-2.1 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><g fill="#c7a6f5"><circle cx="7.5" cy="11" r="1.5"/><circle cx="10" cy="7" r="1.5"/></g><g fill="#ff9ec4"><circle cx="14.5" cy="7" r="1.5"/><circle cx="17" cy="10.5" r="1.4"/></g></svg>',
  open: () => page({
    title: '主题美化', cls: 'thm',
    after: el => mountPv(el, top()), onClose: () => (pv.forEach(h => h.stop()), pv = []),
    body: () => { const f = fx(S), categories = `<div class="thm-categories" role="tablist" aria-label="美化分类">${[['global','全局美化'],['apps','应用美化']].map(([key,label])=>`<button type="button" role="tab" aria-selected="${themeScope === key}" class="${themeScope === key ? 'on' : ''}" data-a="themeScope" data-x="${key}">${label}</button>`).join('')}</div>`;
      if (themeScope === 'apps') return categories + sec('thm-apps', [['apps', '应用美化', Object.entries(AST).map(([k, a]) => `<div class="row go" data-a="astopen" data-x="${k}"><span><i class="ico mini a-${k}">${icon(k)}</i>${esc(a.n)}</span><small>${esc(astName(k))}</small></div>`).join('')]]);
      return categories + `<div class="thm-g">${Object.entries(THEMES).map(([k, t]) => `<div class="tc ${S.theme == k ? 'on' : ''}" data-a="th" data-x="${k}"><div class="tc-p" style="background:${t.v['--wp']}"><i style="background:${t.v['--ac']}"></i><i></i><i></i><i></i><b style="background:${t.v['--gl'] || BASE['--gl']}"></b></div><span>${t.n}</span></div>`).join('')}</div>` + sec('thm', [
      ['ball', '悬浮窗图标', ballGrid()],
      ['lk', '锁屏壁纸 · 动态', lockSec()],
      ['lkc', '锁屏时间', clkSec()],
      ['wp', '壁纸', wallSec()],
      ['widget', `小组件 · ${S.assets.widget.length}`, `<div class="ag">${S.assets.widget.map(x => `<div class="ai" data-a="ae" data-x="widget:${x.id}" data-lp="ad"><b>${esc(x.name.slice(0, 2))}</b><small>${esc(x.name)}</small></div>`).join('')}<div class="ai add" data-a="aa" data-x="widget">＋</div></div>${btn('af', '导入文件', 'widget')}`],
    ]); },
    acts: {
      themeScope: (key, t, e, pg) => { if (!['global','apps'].includes(key)) return; themeScope = key; pg.re(); },
      ball: (k, el) => { setBall(k); el.parentElement.querySelectorAll('.bt').forEach(x => x.classList.toggle('on', x == el)); }, // 只换勾选，不重画页面
      ...WA,
      // 安卓的文件选择器认不出 .otf / .ttf 的类型，会把字体变成灰的选不了，所以不限类型，选完再看文件头是不是字体
      clkup: async () => { const fl = await pickFile('*/*'); if (!fl) return; if (fl.size > 30e6) return toast('字体文件太大了');
        const h = new Uint8Array(await fl.slice(0, 4).arrayBuffer()), sig = String.fromCharCode(...h);
        if (!['OTTO', 'true', 'wOFF', 'wOF2', 'ttcf'].includes(sig) && !(h[0] == 0 && h[1] == 1 && h[2] == 0 && h[3] == 0)) return toast('这不是字体文件（要 .ttf / .otf / .woff）');
        const id = uid(); let src;
        try { src = await putMedia(fl, 'font'); } catch { src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(fl); }); } // 本地数据库用不了就存进设置
        try { await new FontFace('xp-chk', await fl.arrayBuffer()).load(); } catch { return toast('这个字体文件读不出来'); }
        userFonts().push({ id, n: ((await fontName(fl)) || fl.name.replace(/\.\w+$/, '')).slice(0, 24), src }); lockClk().font = 'u:' + id; S.lock.clk.wt = ''; save(); reClk(); toast('已添加字体'); },
      clkfd: async k => { const id = k.slice(2), f = userFonts().find(x => x.id == id); if (!f || !await ok(`删除字体「${f.n}」？`)) return; userFonts().splice(userFonts().indexOf(f), 1); drop(f.src); lockClk().font == k && (S.lock.clk.font = 'nunito'); save(); reClk(); },
      clkset: (x, el) => { const k = el.dataset.k2; lockClk()[k] = k == 'h12' ? !!x : x; save(); reClk(); },
      clkf: k => { lockClk().font = k; S.lock.clk.wt = ''; save(); reClk(); }, clkp: k => { lockClk().pos = k; save(); reClk(); },
      astopen: k => appStyle(k),
      th: (k, t, e, pg) => { S.theme = k; save(); applyTheme(); renderDesk(); pg.re(); },
      aa: k => edit(k), ae: x => { const [k, id] = x.split(':'); edit(k, S.assets[k].find(a => a.id == id)); },
      ad: async x => {
        const [k, id] = x.split(':'), l = S.assets[k], a = l.find(a => a.id == id), c = await menu([...(k == 'widget' ? [['d', '添加到桌面']] : []), ['x', '删除', 'danger']], esc(a.name));
        c == 'x' && drop(l.splice(l.indexOf(a), 1));
        if (c == 'd') { const [w, h] = (a.sz || '2x2').split('x').map(Number); const page = addDeskWidget({ id: uid(), t: 'w', k: 'custom', w, h, p: { html: a.html } },0); toast(`已添加到桌面第 ${page+1} 页`); }
        save(); rf();
      },
      af: async k => { const fl = await pickFile(AK[k].file); if (!fl) return; const t = await fl.text(); S.assets[k].push({ id: uid(), name: fl.name.replace(/\.\w+$/, ''), ...(k == 'widget' ? { html: t, sz: '2x2' } : { css: t }) }); save(); rf(); },
      ab: async () => { const r = await form('批量导入表情包', [['t', '每行一个：描述 + 空格 + 图片链接', 'area', '开心 https://xx.com/a.png\n委屈 https://xx.com/b.gif']]); let n = 0; r?.t?.split('\n').forEach(l => { const m = l.trim().match(/^(.*?)[\s:：|,，]*(https?:\/\/\S+)$/); if (m) { n++; S.assets.sticker.push({ id: uid(), name: m[1] || '表情' + n, img: m[2] }); } }); save(); toast(`已导入 ${n} 个`); rf(); },
      ic: async id => { const v = await pickImg(256, 'icon'), old = S.icons[id]; if (v == null) return; v ? (S.icons[id] = v) : delete S.icons[id]; save(); drop(old); renderDesk(); rf(); },
    },
    onChange: k => { wpChange(k); k.startsWith('lock.clk') && reClk(); false && k == 'wrand' && (S.wrand && !S.wpool?.length && (S.wpool = [curWall()]), save(), rf()); k == 'lock.rand' && (S.lock.rand && !S.lock.pool?.length && (S.lock.pool = [S.lock.wp]), save(), rf()); },
  }),
});

