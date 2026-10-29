// 小手机 · 窥探之眼：从更高一层往下看——这段剧情在「那个世界」里是一部漫画 / 动画 / 电视剧 / 小说 / 游戏
// 画面全是生成的图（assets/eye/*.webp），一笔不画：
//   room / room_author  客厅（面具挂在墙上 / 戴在他脸上）   phone_*  他手里的手机特写，每种形态一张：只留那一个官方平台，其余七个往前挪成两排
//   backstage  帷幕后面   cabinet  周边柜特写   fg  最前面一层虚化的沙发   tv_*  五种形态在电视上放的画面   guide  选作品时的客厅（茶几上方五块面板）   gi_*  小图标
// 每个聊天窗口第一次进来先选「这段剧情是一部什么」（存在这个聊天里，换个聊天要重新选）：整间屋子是暗的，五块面板浮在茶几上方，每块下面写着是什么；
// 点一块 = 预览（那一列亮、电视放对应画面），可以来回换；按「确认」才定下来
// 手机上的 App：官方平台（随形态换，五选一）/ 论坛（forum.js，整页、真的生成）/ 周边店 / 同人圈 / 另一条线（同人作品是原著线，原创作品是 IF 线）
// 内容都是样例；生成之后接
import { S, D, $, $$, page, reg, toast, saveD, esc, openApp } from '../../core.js';
import { openForum } from './forum.js';

const CSS = new URL('./eye.css?v=15', import.meta.url).href;
const css = () => new Promise(r => { const old = document.querySelector('link[data-eye]'); if (old) return old.sheet ? r() : old.addEventListener('load', () => r(), { once: true }); const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.eye = 1; l.href = CSS; l.onload = l.onerror = () => r(); document.head.append(l); setTimeout(r, 1500); });
const IMG = f => new URL(`../../assets/eye/${f}.webp`, import.meta.url).href;
const PXF = new URL('../../assets/fonts/px-eye.woff', import.meta.url).href;
let pxReady; const pxFont = () => pxReady ||= (async () => { try { const f = new FontFace('xp-px', `url("${PXF}") format("woff")`); await f.load(); document.fonts.add(f); } catch {} })();
// 样式表和像素字在插件一加载就开始拿（不等点图标）：不然第一次点的时候要等它们下完，看着像没反应
let cssReady, cssOk = false; const warm = () => { cssReady ||= css().then(() => { cssOk = true; }); pxFont(); }; setTimeout(warm, 300);
// 作品形态 / 身份 / 第四面墙 / 原著线 跟着聊天走（每个聊天是一个新的故事）；片头开关是全局设置
const ST = () => D().eye ||= { form: '', role: 'viewer', wall: false, src: 'orig' };
const INTRO_ON = () => (S.eye ||= {}).intro !== false;

/* ---------- 形态 ---------- */
const FORMS = [['manga', '漫画'], ['game', '游戏'], ['novel', '小说'], ['drama', '电视剧'], ['anime', '动画']];
const FN = Object.fromEntries(FORMS);
const FM = {
  manga: { ep: '话', unit: '第 3 卷 · 第 27 话', where: '周刊连载', plat: '周刊连载', bs: '作者后记', who: '作者与责编', tv: 'manga' },
  anime: { ep: '集', unit: '第 2 季 · 第 8 集', where: '番剧站 · 每周六 24:00', plat: '番剧站', bs: '声优感想', who: '配音演员', tv: 'anime' },
  drama: { ep: '集', unit: '第 12 集', where: '剧集台 · 每晚 20:00', plat: '剧集台', bs: '演员访谈', who: '主演', tv: 'city' },
  novel: { ep: '章', unit: '第三卷 · 第 41 章', where: '文库 · 连载中', plat: '文库', bs: '作者的话', who: '作者', tv: 'novel' },
  game: { ep: '章', unit: '第 4 章 · 雨夜', where: '游戏库 · 已发售', plat: '游戏库', bs: '开发者日志', who: '制作组', tv: 'game' },
};
// 茶几上五样东西 / 整列（面板 + 线 + 图标 + 东西）都是从 guide 图里按发光的轮廓抠出来的透明图：go_* / gc_*，下面是它们在图上的范围
const GOBJ = { manga: [37.21, 54.98, 57.03, 66.1], game: [48.93, 59.75, 71.68, 70.53], novel: [59.67, 53.96, 78.52, 65.76], drama: [71.88, 58.73, 86.33, 71.56], anime: [83.59, 53.62, 97.56, 64.05] };
// 选作品那张图上，每一列（面板 + 小图标 + 茶几上对应的东西）的范围，百分比：左 上 右 下
const GCOL = { manga: [34.77, 39.29, 56.05, 65.76], game: [47.95, 39.29, 70.21, 69.85], novel: [60.16, 39.29, 78.03, 65.42], drama: [72.36, 39.29, 88.77, 71.21], anime: [84.08, 39.29, 100.98, 64.05] };
const GHIT = { manga: [36, 40, 50, 68], game: [50, 40, 64, 68], novel: [64, 40, 75.5, 68], drama: [75.5, 40, 86.5, 70], anime: [86.5, 40, 99.5, 68] };
const pct = ([l, t, r, b]) => `left:${l}%;top:${t}%;width:${r - l}%;height:${b - t}%`;

/* ---------- 热区（相对底图的百分比：左 上 右 下） ---------- */
const ZONES = { tv: [33.5, 14.5, 78.5, 43.5], phone: [38, 56, 50, 67], mask: [16, 9, 27.5, 21], cab: [13.5, 20, 28.5, 34.5], curtain: [82, 8, 99.5, 52], cctv: [72, 2, 87, 9.5], table: [52, 51, 97, 70] };
const CAMS = { tv: 1.5, phone: 1.9, mask: 2.4, cab: 2.2, curtain: 1.9, cctv: 2.6, table: 1.7 };
// 点了以后整张换成另一张图的：手机特写 / 帷幕后面 / 周边柜
const SWAP = { phone: 'phone', curtain: 'backstage', cab: 'cabinet' };
const SWIMG = k => IMG(k == 'phone' ? 'phone_' + (ST().form || 'manga') : k);
// 手机特写上两排图标的中心（百分比）：官方平台 / 淘宝 / 同人圈 / 原著 · 论坛 / 云盘 / 创作 / 设置
const PH = [['plat', 45.2, 34.3], ['shop', 53.0, 35.4], ['fan', 60.5, 36.6], ['line', 68.3, 37.7],
  ['forum', 42.5, 41.5], ['cloud', 50.3, 42.8], ['mask', 57.9, 44.0], ['set', 65.5, 45.2]];
const phz = () => PH.map(([k, x, y]) => `<b class="phz" data-a="hopen" data-x="${k}" style="left:${x}%;top:${y}%"></b>`).join('');

/* ---------- 电视里的画面 ---------- */
function tvScreen() {
  const st = ST(); if (!st.form) return '';
  if (st.wall) return `<div class="tv-wall"><div class="tv-eye"><i></i></div></div>`;
  const f = FM[st.form];
  return `<img class="tv-img" src="${IMG('tv_' + f.tv)}" alt=""><i class="tv-scan"></i>
<div class="tv-dm">${['前方高能', '泪目了', '这一集神作', '你倒是回头啊', '打卡', '啊啊啊啊'].map((t, i) => `<span style="--i:${i}">${t}</span>`).join('')}</div>
<div class="tv-sub"><b>${esc(FN[st.form])} · ${esc(f.unit)}</b><small>「……雨，停了啊。」</small></div>`;
}

/* ---------- 全息屏：每个入口一页，点进去还有下一层 ---------- */
const H = {
  plat: () => { const f = FM[ST().form]; return { k: `${f.plat} · 官方`, t: '雨停之前', m: `${f.where} · ${f.unit} · 今天更新`, body: '这一' + f.ep + '里，万事屋的雨一直没停。他把最后一把伞借给了来委托的人，自己在屋檐下坐到天黑。有人问他在等谁，他说在等雨停。', dm: ['前方高能！！', '泪目了', '这一集神作', '打卡', '伞！！！'], acts: [['本' + f.ep + '评论 · 2,418', 'cmts'], ['刷新本期', 'gen']] }; },
  shop: () => ({ k: 'STORE · 官方周边店', t: '雨停之前 官方店', m: '关注 12.4 万 · 本期上新 6 件', goods: [['#d88aa6', '伞 · 亚克力立牌', '¥48', '4.9'], ['#8ab0e6', '万事屋 吧唧 3 枚', '¥35', '4.8'], ['#e6c46a', '第 3 卷 特装版', '¥128', '5.0'], ['#9a8ae6', '雨夜 挂画', '¥88', '4.7']], list: [['买家 · 伞党', '立牌做工比想的好，伞骨真的是七根', '★★★★★'], ['买家 · 夜班读者', '吧唧背面有那只眼睛，细节满分', '★★★★★'], ['买家 · 路过的编辑', '挂画偏暗，但挂在床头很对味', '★★★★☆']], acts: [['去商业街抽一番赏', 'street']] }),
  fan: () => ({ k: 'FANWORKS · 同人圈', t: '本周产出 64', m: '图 41 · 文 19 · cos 4 · 高维度的粉丝们', grid: [['#5a6a9a', '雨夜'], ['#8a5a6a', '借伞'], ['#4a6a5a', '屋檐下'], ['#6a5a8a', '回头'], ['#8a7a4a', '扉页'], ['#4a5a7a', '三人']], list: [['太太A', '《等雨停的人》 · 短篇 · 3.2k 字', '热 890'], ['画手B', '屋檐下 · 彩图', '412']], acts: [['看全部', 'fanall']] }),
  line: () => ST().src == 'fan' ? { k: 'ORIGINAL · 原著线', t: '原著里的他们', m: '原著角色看这条线的剧情', body: '原著里那把伞他没借出去。所以当原著的他看到这条线里的自己坐在屋檐下等雨停，沉默了很久。', list: [['原著 · 他', '……我不会把伞借出去的。但这个我，好像比我更像我。', ''], [' 原著 · 她', '这条线里他居然会等人，笑死，原著他连雨都不躲。', '']], acts: [['切换到 IF 线（原创作品）', 'srcorig']] }
    : { k: 'IF · 另一条线', t: '如果那天他没借伞', m: 'IF 线 · 同一批人，另一个选择', body: '这部作品没有原著，所以另一条线是「IF 线」：同一个故事，在某个岔路口走了另一条路。那边的他们，隔着线看这边。', list: [['IF 线 · 他', '我把伞留下了。然后我在屋檐下等了一整晚，雨也没停。', ''], ['IF 线 · 她', '这边的我没去找他。所以看见那边的我去了，有点想哭。', '']], acts: [['切换到原著线（同人作品）', 'srcfan']] },
  set: () => ({ k: 'SETTINGS', t: '作品档案', m: `${FN[ST().form]} · ${FM[ST().form].unit}`, forms: 1, acts: [['重新选择作品', 'reguide']] }),
  tv: () => { const f = FM[ST().form]; return { k: `${FN[ST().form]} · 本期`, t: '雨停之前', m: `${f.where} · ${f.unit}`, body: '这一' + f.ep + '里，万事屋的雨一直没停。他把最后一把伞借给了来委托的人，自己在屋檐下坐到天黑。', dm: ['前方高能！！', '泪目了', '这一集神作', '打卡', '伞！！！'], acts: [['弹幕 · 实时', 'dm'], ['刷新本期', 'gen']] }; },
  mask: () => ({ k: 'IDENTITY · 身份', t: ST().role == 'author' ? '作者' : '观众席', m: ST().role == 'author' ? '以作者本人的身份发言 · 读者会认出你' : '以普通读者的身份逛论坛 · 用自己的马甲发帖', body: ST().role == 'author' ? '面具戴上了。从现在起，你的每一句话都会被当成官方发言。' : '面具还挂在墙上。你只是观众席里的一个人。', acts: [[ST().role == 'author' ? '摘下面具 · 回到观众席' : '戴上面具 · 成为作者', 'role']] }),
  curtain: () => { const f = FM[ST().form]; return { k: `BACKSTAGE · ${f.bs}`, t: f.who, m: `本${f.ep} · 2 条`, body: ST().form == 'manga' || ST().form == 'novel' ? '这一话画到最后一页的时候外面真的在下雨。借伞那个分镜改了四次，责编说第一版太温柔了，不像他。' : '录屋檐下那段戏的时候，导演让我什么都别说，只呼吸。后来回放，我自己也沉默了很久。', acts: [['看全文', 'bs']] }; },
  cab: () => ({ k: 'GOODS · 周边柜', t: '我的收藏', m: '手办 3 · 吧唧 3 · 卡 3 · 扭蛋 1', acts: [['去商业街抽一番赏', 'street'], ['去周边店', 'shop']] }),
  cctv: () => ({ k: 'EYE · 窥探之眼', t: ST().wall ? '他发现你了' : '高维视角', m: `上次窥视：${FM[ST().form].unit} · 2 小时前`, body: ST().wall ? '监控转过来了。电视里的人也转过来了。\n现在不只是你在看他。' : '从这里往下看，剧情是一部正在连载的作品。刷新一次，就把最新的进度翻到这个世界里来。', acts: [['刷新本期', 'gen'], [ST().wall ? '关上第四面墙' : '打破第四面墙', 'wall']] }),
  table: () => ({ k: 'TABLE · 茶几', t: '这段剧情是一部……', m: '换一种形态，电视和手机都会跟着变', forms: 1 }),
};

function holo(k) {
  const d = H[k]();
  const li = (a, b, c, go) => `<li ${go ? `data-a="hopen" data-x="${go}"` : ''}><b>${esc(a)}</b><span>${esc(b)}</span>${c ? `<em>${esc(c)}</em>` : ''}</li>`;
  return `<div class="holo" data-h="${k}"><i class="ho-c c1"></i><i class="ho-c c2"></i><i class="ho-c c3"></i><i class="ho-c c4"></i>
<div class="ho-h"><i></i><span class="scr" data-t="${esc(d.k)}">${esc(d.k)}</span><small>LIVE</small></div>
<div class="ho-b"><b class="ho-t">${esc(d.t)}</b><em class="ho-m">${esc(d.m)}</em>
${d.tabs ? `<div class="ho-tabs">${d.tabs.map(([n, on]) => `<b class="${on ? 'on' : ''}">${n}</b>`).join('')}</div>` : ''}
${d.body ? `<p>${esc(d.body).replace(/\n/g, '<br>')}</p>` : ''}
${d.forms ? `<div class="ho-forms">${FORMS.map(([id, n]) => `<b class="${ST().form == id ? 'on' : ''}" data-a="eform" data-x="${id}"><img src="${IMG('gi_' + id)}" alt="">${n}</b>`).join('')}</div>` : ''}
${d.goods ? `<div class="ho-goods">${d.goods.map(([c, n, p, r]) => `<div style="--c:${c}"><i></i><b>${esc(n)}</b><span>${p}<em>★ ${r}</em></span></div>`).join('')}</div>` : ''}
${d.grid ? `<div class="ho-grid">${d.grid.map(([c, n]) => `<b style="--c:${c}"><span>${esc(n)}</span></b>`).join('')}</div>` : ''}
${d.list ? `<ul class="ho-list">${d.list.map(([a, b, c]) => li(a, b, c, d.go)).join('')}</ul>` : ''}
${d.dm ? `<div class="ho-dm">${d.dm.map((t, i) => `<span style="--i:${i}">${esc(t)}</span>`).join('')}</div>` : ''}
</div>${d.acts ? `<div class="ho-acts">${d.acts.map(([l, a]) => `<button data-a="hact" data-x="${a}"><span>${esc(l)}</span><i>›</i></button>`).join('')}</div>` : ''}</div>`;
}

/* ---------- 乱码解码 ---------- */
const GL = '░▒▓█＜＞/\\|=+*#%&0123456789アイウエオカキクケコ';
function scramble(el) {
  if (!el) return; const t = el.dataset.t || el.textContent; let n = 0; const L = t.length;
  const tick = () => { n += .6; el.textContent = [...t].map((c, i) => i < n ? c : c == ' ' ? ' ' : GL[Math.random() * GL.length | 0]).join(''); if (n < L) el._sc = requestAnimationFrame(tick); else el.textContent = t; };
  cancelAnimationFrame(el._sc); tick();
}

/* ---------- 镜头 / 换图 ---------- */
let focused = '', stack = [], played = false;
// 客厅按宽铺（整张都看得到，上下用模糊的同一张图垫着）；换上来的特写图按满屏铺
function fitRoom(el) { const st = $('.eye-stage', el); if (!st) return; const w = st.clientWidth, h = st.clientHeight; st.style.setProperty('--fw', w + 'px'); st.style.setProperty('--cw', Math.max(w, h * 1024 / 1466) + 'px'); }
function cam(el, k) {
  const st = $('.eye-stage', el), room = $('.eye-room', el); if (!st) return;
  const zk = k ? k.split(':')[0] : '', z = ZONES[zk];
  st.classList.toggle('zoom', !!k); st.dataset.focus = zk;
  if (z) { const s = CAMS[zk] || 1.8, sw = st.clientWidth, sh = st.clientHeight, fw = sw, fh = fw * 1466 / 1024;
    const cx = (sw - fw) / 2 + (z[0] + z[2]) / 200 * fw, cy = (sh - fh) / 2 + (z[1] + z[3]) / 200 * fh, C = [sw / 2, sh / 2], target = [sw / 2, sh * (zk == 'tv' ? .26 : .40)];
    let tx = target[0] - C[0] - (cx - C[0]) * s, ty = target[1] - C[1] - (cy - C[1]) * s; const fx0 = (sw - fw) / 2, fy0 = (sh - fh) / 2;
    const cl = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi); // 放大后图还没舞台高时就居中
    tx = cl(tx, sw - (C[0] + (fx0 + fw - C[0]) * s), -(C[0] + (fx0 - C[0]) * s)); ty = cl(ty, sh - (C[1] + (fy0 + fh - C[1]) * s), -(C[1] + (fy0 - C[1]) * s));
    room.style.setProperty('--s', s); room.style.setProperty('--tx', tx + 'px'); room.style.setProperty('--ty', ty + 'px'); }
  else { room.style.setProperty('--s', 1); room.style.setProperty('--tx', '0px'); room.style.setProperty('--ty', '0px'); }
  // 换整张图：推近以后再淡入（手机特写 / 帷幕后 / 周边柜）
  const sw_ = SWAP[zk] || ''; $$('.swap', el).forEach(i => i.classList.toggle('in', i.dataset.k == sw_)); st.classList.toggle('swapped', !!sw_);
  $$('.hz', el).forEach(h => h.classList.toggle('on', h.dataset.x == zk && !sw_));
}
function focus(el, k, push = true) {
  const st = $('.eye-stage', el);
  if (k && push && focused && focused != k) stack.push(focused);
  focused = k; cam(el, k);
  $('.holo', el)?.remove(); $('.holo-beam', el)?.remove(); $('.eye-back', el)?.classList.toggle('show', !!k);
  const zk = k ? k.split(':')[0] : '', hk = k.includes(':') ? k.split(':')[1] : k;
  st.classList.toggle('ph-home', zk == 'phone' && hk == 'phone');
  if (k && hk != 'phone' && H[hk]) { st.insertAdjacentHTML('beforeend', (zk == 'phone' ? '<i class="holo-beam"></i>' : '') + holo(hk)); const h = $('.holo', el); requestAnimationFrame(() => { h.classList.add('in'); $('.holo-beam', el)?.classList.add('in'); scramble($('.scr', h)); }); }
}
const back = el => { if (stack.length) focus(el, stack.pop(), false); else focus(el, ''); };

/* ---------- 片头：每次进来都放（主题 → 应用 → 窥探之眼 里可以关） ---------- */
const INTRO = [['如果这个世界，', ''], ['是一部', '漫画'], ['一本', '小说'], ['一部', '电视剧'], ['一个', '游戏'], ['一个', '动漫']];
// 眼睛是自己画的：一条杏仁形的红色霓虹线，闭着的时候压成一道缝，睁开时撑起来；虹膜和瞳孔被杏仁形裁住
function introHtml() { return `<div class="eye-intro"><i class="istars"></i><canvas class="ipx"></canvas><b class="iskip" data-a="iskip">跳过</b><div class="ie"><i class="orb o1"></i><i class="orb o2"></i>
<svg class="esvg" viewBox="0 0 240 150"><defs><clipPath id="eye-clip"><path d="M18 75Q120 -8 222 75Q120 158 18 75Z"/></clipPath></defs><g class="eg"><g class="eball" clip-path="url(#eye-clip)"><circle class="iris" cx="120" cy="75" r="36"/><circle class="pupil" cx="120" cy="75" r="16"/><circle class="hl" cx="131" cy="63" r="5"/></g><path class="elid" d="M18 75Q120 -8 222 75Q120 158 18 75Z"/><path class="elash" d="M60 24l-6-12M120 6V-8M180 24l6-12"/></g></svg></div><i class="iwipe"></i><i class="iflash"></i></div>`; }
// 像素打字：字先画在很小的 canvas 上，再放大三倍、关掉平滑，就成了像素字；一个字一个字出来，后面跟一个闪的方块光标
function pxType(cv, lines, done) {
  const SC = 3, W = 112, LH = 20, PAD = 8; cv.width = W; cv.height = PAD * 2 + LH * lines.length; cv.style.width = W * SC + 'px'; cv.style.height = cv.height * SC + 'px';
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; let li = 0, ci = 0, cur = 1, t = [], stop = false;
  const paint = () => {
    g.clearRect(0, 0, cv.width, cv.height); g.font = '12px "xp-px","PingFang SC","HarmonyOS Sans SC","MiSans","Noto Sans CJK SC",sans-serif'; g.textBaseline = 'top';
    for (let i = 0; i <= Math.min(li, lines.length - 1); i++) {
      const [a, b] = lines[i], y = PAD + i * LH, full = a + (b ? b + '…' : ''), n = i < li ? full.length : ci, txt = full.slice(0, n); let x = PAD;
      for (let k = 0; k < txt.length; k++) { const ch = txt[k], red = k >= a.length && k < a.length + b.length; g.fillStyle = i == 0 ? '#9a9a9a' : red ? '#ff2a2a' : '#e8e8e8'; g.fillText(ch, x, y); x += g.measureText(ch).width; }
      if (i == li && cur) { g.fillStyle = '#ff2a2a'; g.fillRect(x + 2, y, 7, 13); }
    }
  };
  const step = () => { if (stop) return; const [a, b] = lines[li], full = a + (b ? b + '…' : ''); if (ci < full.length) { ci++; paint(); t.push(setTimeout(step, /[，…]/.test(full[ci - 1]) ? 260 : 95)); } else if (li < lines.length - 1) { li++; ci = 0; paint(); t.push(setTimeout(step, 420)); } else { paint(); t.push(setTimeout(done, 900)); } };
  const blink = setInterval(() => { cur ^= 1; paint(); }, 420); pxFont().then(() => { if (!stop) { paint(); t.push(setTimeout(step, 400)); } });
  return () => { stop = true; t.forEach(clearTimeout); clearInterval(blink); };
}
function intro(el) {
  const it = $('.eye-intro', el); if (!it) return; let t = []; const at = (ms, f) => t.push(setTimeout(f, ms));
  const eye = () => { it.classList.add('eye'); at(1300, () => it.classList.add('open')); at(2300, () => it.classList.add('glance')); at(3000, () => it.classList.add('flash')); at(3250, () => { it.classList.add('out'); if (!ST().form) guide(el, true); }); at(4000, () => it.remove()); };
  const cancel = pxType($('.ipx', it), INTRO, () => { it.classList.add('wipe'); at(700, eye); });
  it._skip = () => { cancel(); t.forEach(clearTimeout); t = []; it.classList.add('out'); if (!ST().form) guide(el, true); setTimeout(() => it.remove(), 500); };
}

/* ---------- 引导：第一次进来先选作品 ---------- */
function guide(el, on) { const g = $('.eye-guide', el); if (!g) return; g.classList.toggle('in', on); $('.eye-stage', el).classList.toggle('guiding', on); if (on) typeQ($('.gq', g)); }
// 电视上的问句：一个字一个字打出来，末尾一个闪的方块
function typeQ(q) {
  if (!q || q._typed) return; q._typed = 1; const t = q.dataset.t; let n = 0;
  const tick = () => { n++; const s = t.slice(0, n); q.innerHTML = s.split('|').map(esc).join('<br>') + '<i class="gcur"></i>'; if (n < t.length) setTimeout(tick, /[，…|]/.test(t[n - 1]) ? 240 : 90); };
  setTimeout(tick, 350);
}
function guideHtml() {
  const g = IMG('guide');
  return `<div class="eye-guide ${ST().form ? '' : 'in'}"><img class="bleed" src="${g}" alt=""><div class="gfit"><img class="gbase" src="${g}" draggable="false" alt="">
<div class="gtv"><p class="gq" data-t="在那个世界里，|这段剧情是一部……"></p></div>
${FORMS.map(([k], i) => `<img class="gobj" data-x="${k}" src="${IMG('go_' + k)}" style="${pct(GOBJ[k])};--i:${i}" alt=""><img class="gcol" data-x="${k}" src="${IMG('gc_' + k)}" style="${pct(GCOL[k])}" alt="">`).join('')}
${FORMS.map(([k, n]) => `<b class="gh" data-a="gpick" data-x="${k}" style="${pct(GHIT[k])}"></b><span class="gl" data-x="${k}" style="left:${(GCOL[k][0] + GCOL[k][2]) / 2}%">${n}</span>`).join('')}</div>
<b class="gok" data-a="gok">确 认</b></div>`;
}
// 点一块：预览，可以换
function pickForm(el, k) {
  const g = $('.eye-guide', el); if (!g || g.classList.contains('done')) return;
  if (g.dataset.sel == k) return; g.dataset.sel = k; g.classList.add('picked');
  $$('.gcol', g).forEach(c => c.classList.toggle('on', c.dataset.x == k)); $$('.gl', g).forEach(c => c.classList.toggle('on', c.dataset.x == k));
  const tv = $('.gtv', g); $$('.tv-img,.tv-scan', tv).forEach(i => i.remove()); tv.insertAdjacentHTML('beforeend', `<img class="tv-img" src="${IMG('tv_' + FM[k].tv)}" alt=""><i class="tv-scan"></i>`);
  tv.classList.remove('lit'); void tv.offsetWidth; tv.classList.add('lit');
}
// 按确认：定下来，淡回客厅
function confirmForm(el) {
  const g = $('.eye-guide', el), k = g?.dataset.sel; if (!k || g.classList.contains('done')) return; g.classList.add('done');
  const st = ST(); st.form = k; saveD();
  $('.tv-scr', el).innerHTML = tvScreen(); $('.tv-scr', el).classList.add('lit'); $('.eye-brand small', el).textContent = `${FN[k]} · ${FM[k].unit}`;
  const ph = $('.swap[data-k="phone"]', el); if (ph) ph.src = SWIMG('phone');
  setTimeout(() => guide(el, false), 500);
}

function mount(el) {
  const st0 = $('.eye-stage', el); if (!st0 || st0._eye) return;
  // 点图标后页面马上出来（黑的），样式表到了才显示内容、开始片头——不会再有「点了没反应」
  if (!cssOk) return void cssReady.then(() => { cssOk = true; mount(el); });
  st0.style.visibility = '';
  fitRoom(el); requestAnimationFrame(() => fitRoom(el)); const st = $('.eye-stage', el); if (!st || st._eye) return; st._eye = 1; new ResizeObserver(() => fitRoom(el)).observe(st);
  st.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); st.style.setProperty('--mx', (e.clientX - r.left) / r.width * 100 + '%'); st.style.setProperty('--my', (e.clientY - r.top) / r.height * 100 + '%'); });
  let y0 = 0; st.addEventListener('pointerdown', e => { const c = e.target.closest('.holo'); y0 = c ? e.clientY : 0; });
  st.addEventListener('pointerup', e => { if (y0 && e.clientY - y0 > 48) back(el); y0 = 0; });
  st.addEventListener('click', e => { if (st.classList.contains('guiding')) return; if (e.target.closest('.holo,[data-a]')) return; if (focused) back(el); });
  if (INTRO_ON() && !played) { played = true; intro(el); } else if (!ST().form) guide(el, true);
}

const body = () => { const st = ST(), has = !!st.form; return `<div class="eye-stage ${st.wall ? 'wall' : ''}" style="--mx:50%;--my:50%;position:absolute;inset:0;background:#06070c${cssOk ? '' : ';visibility:hidden'}">
<div class="eye-room" style="--s:1;--tx:0px;--ty:0px"><img class="bleed" src="${IMG('room')}" draggable="false" alt=""><div class="fit">
<img class="base ${st.role == 'author' ? '' : 'in'}" src="${IMG('room')}" draggable="false" alt=""><img class="base ${st.role == 'author' ? 'in' : ''}" src="${IMG('room_author')}" draggable="false" alt="">
<div class="tv-scr ${has ? 'lit' : ''}">${tvScreen()}</div>
<i class="led"></i><i class="moon-ray"></i><i class="curtain-glow"></i>
${Object.entries(ZONES).map(([k, z]) => `<b class="hz hz-${k}" data-a="ez" data-x="${k}" style="left:${z[0]}%;top:${z[1]}%;width:${z[2] - z[0]}%;height:${z[3] - z[1]}%"></b>`).join('')}
</div></div>
${guideHtml()}
<div class="swaps">${Object.entries(SWAP).map(([k, f]) => `<img class="swap" data-k="${f}" src="${SWIMG(f)}" draggable="false" alt="">`).join('')}<div class="phzs">${phz()}</div></div>
<img class="eye-fg" src="${IMG('fg')}" draggable="false" alt="">
<div class="eye-fx"><i class="dust d1"></i><i class="dust d2"></i><i class="dust d3"></i><i class="dust d4"></i><i class="dust d5"></i><i class="dust d6"></i></div>
${INTRO_ON() && !played ? introHtml() : ''}
<div class="eye-top"><b class="eye-back ${focused ? 'show' : ''}" data-a="eback">‹ 回到客厅</b><span class="eye-brand"><i></i>窥探之眼<small>${has ? esc(FN[st.form]) + ' · ' + esc(FM[st.form].unit) : '选一部作品'}</small></span></div>
</div>`; };

reg({
  id: 'eye', name: '窥探之眼',
  icon: `<i class="eye-ic" style="display:block;width:100%;height:100%;border-radius:inherit;background:url('${IMG('icon')}') center/cover;pointer-events:none"></i>`,
  open: () => { warm(); ['guide', ...Object.values(SWAP)].forEach(f => { const i = new Image(); i.src = SWIMG(f); i.decode?.().catch(() => {}); }); focused = ''; stack = []; played = false; return page({ title: '', cls: 'eye-pg', noBack: 1, body, after: mount, acts: {
    ez: (k, t, e, pg) => { if (!ST().form) return; focus(pg.el, k == focused ? '' : k); },
    eback: (x, t, e, pg) => back(pg.el),
    gpick: (k, t, e, pg) => pickForm(pg.el, k),
    gok: (x, t, e, pg) => confirmForm(pg.el),
    noop: () => {},
    iskip: (x, t, e, pg) => $('.eye-intro', pg.el)?._skip?.(),
    hopen: (k, t, e, pg) => { if (k == 'cloud') return toast('还没接上，先看样子'); if (k == 'forum') { const st = ST(); return openForum({ form: st.form, fname: FN[st.form] || '动画', ep: FM[st.form]?.ep || '集', role: st.role }); } focus(pg.el, 'phone:' + k); },
    eform: (k, t, e, pg) => { ST().form = k; saveD(); pg.re(); },
    hact: (a, t, e, pg) => {
      const st = ST();
      if (a == 'role') { st.role = st.role == 'author' ? 'viewer' : 'author'; saveD(); $$('.base', pg.el).forEach((i, n) => i.classList.toggle('in', (n == 1) == (st.role == 'author'))); focus(pg.el, 'mask', false); return; }
      if (a == 'wall') { st.wall = !st.wall; saveD(); $('.eye-stage', pg.el).classList.toggle('wall', st.wall); $('.tv-scr', pg.el).innerHTML = tvScreen(); focus(pg.el, 'cctv', false); return; }
      if (a == 'srcfan' || a == 'srcorig') { st.src = a == 'srcfan' ? 'fan' : 'orig'; saveD(); focus(pg.el, 'phone:line', false); return; }
      if (a == 'reguide') { st.form = ''; saveD(); pg.re(); return; }
      if (a == 'shop') { focus(pg.el, 'phone:shop'); return; }
      if (a == 'street') { openApp('street'); return; }
      toast('还没接上，先看样子');
    },
  } }); },
});
