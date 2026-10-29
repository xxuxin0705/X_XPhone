// 小手机 · 窥探之眼：从更高一层往下看——这段剧情在「那个世界」里是一部漫画 / 动画 / 电视剧 / 小说 / 游戏
// 画面全是生成的图（assets/eye/*.webp），一笔不画：
//   room / room_author  客厅（面具挂在墙上 / 戴在他脸上）   phone  他手里的手机特写（屏幕上的图标抹掉了，前端叠）
//   backstage  帷幕后面   cabinet  周边柜特写   fg  最前面一层虚化的沙发   tv_*  五种形态在电视上放的画面   gp_* / gi_*  引导用的五块面板和小图标
// 第一次进来先选「这段剧情是一部什么」：五块面板浮在茶几上方，点一块，电视就亮起对应的画面
// 手机上的 App：官方平台（随形态换，五选一）/ 论坛 / 周边店 / 同人圈 / 另一条线（同人作品是原著线，原创作品是 IF 线）
// 内容都是样例；生成之后接
import { S, $, $$, page, reg, toast, save, esc, openApp } from '../../core.js';

const CSS = new URL('./eye.css?v=3', import.meta.url).href;
const css = () => new Promise(r => { const old = document.querySelector('link[data-eye]'); if (old) return old.sheet ? r() : old.addEventListener('load', () => r(), { once: true }); const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.eye = 1; l.href = CSS; l.onload = l.onerror = () => r(); document.head.append(l); setTimeout(r, 1500); });
const IMG = f => new URL(`../../assets/eye/${f}.webp`, import.meta.url).href;
const ST = () => (S.eye ||= { form: '', role: 'viewer', wall: false, src: 'orig', intro: 0 });

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
// 引导面板和小图标在底图上的位置（百分比，从第二张图量的）
// （面板原图位置，留着备用）
const GP = { manga: [36.3, 40.6, 49.6, 47.8], game: [49.6, 41.6, 63.3, 49.3], novel: [64.1, 41.9, 75.8, 49.0], drama: [75.8, 42.0, 87.5, 49.4], anime: [87.1, 42.2, 98.8, 49.7] };
const GI = { manga: [46.2, 51.0], game: [56.9, 52.6], novel: [69.6, 51.9], drama: [80.8, 52.2], anime: [91.4, 51.9] };

/* ---------- 热区（相对底图的百分比：左 上 右 下） ---------- */
const ZONES = { tv: [33.5, 14.5, 78.5, 43.5], phone: [38, 56, 50, 67], mask: [16, 9, 27.5, 21], cab: [13.5, 20, 28.5, 34.5], curtain: [82, 8, 99.5, 52], cctv: [72, 2, 87, 9.5], table: [52, 51, 97, 70] };
const CAMS = { tv: 1.35, phone: 1.9, mask: 2.4, cab: 2.2, curtain: 1.9, cctv: 2.6, table: 1.7 };
// 点了以后整张换成另一张图的：手机特写 / 帷幕后面 / 周边柜
const SWAP = { phone: 'phone', curtain: 'backstage', cab: 'cabinet' };
// 手机屏幕上放图标的那块（手机特写图里的四个角，百分比；左上 右上 右下 左下）
const PHQ = [[40.5, 31.6], [68.0, 36.2], [54.6, 62.0], [29.6, 57.9]];

/* ---------- 电视里的画面 ---------- */
function tvScreen() {
  const st = ST(); if (!st.form) return '';
  if (st.wall) return `<div class="tv-wall"><div class="tv-eye"><i></i></div></div>`;
  const f = FM[st.form];
  return `<img class="tv-img" src="${IMG('tv_' + f.tv)}" alt=""><i class="tv-scan"></i>
<div class="tv-dm">${['前方高能', '泪目了', '这一集神作', '你倒是回头啊', '打卡', '啊啊啊啊'].map((t, i) => `<span style="--i:${i}">${t}</span>`).join('')}</div>
<div class="tv-sub"><b>${esc(FN[st.form])} · ${esc(f.unit)}</b><small>「……雨，停了啊。」</small></div>`;
}

/* ---------- 手机上的 App ---------- */
const APPS = () => { const st = ST(), f = FM[st.form] || FM.anime; return [
  ['plat', f.plat, 'plat ' + st.form], ['forum', '论坛', 'forum'], ['shop', '周边店', 'shop'], ['fan', '同人圈', 'fan'], ['line', st.src == 'fan' ? '原著线' : 'IF 线', 'line'], ['set', '设置', 'set']]; };
const GLY = {
  plat: '<svg viewBox="0 0 24 24"><path d="M5 5h14v12H9l-4 3z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  forum: '<svg viewBox="0 0 24 24"><path d="M4 6h16v10H10l-4 3v-3H4z" fill="#fff"/><circle cx="9" cy="11" r="1.2" fill="#3a7bd5"/><circle cx="12" cy="11" r="1.2" fill="#3a7bd5"/><circle cx="15" cy="11" r="1.2" fill="#3a7bd5"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z" fill="#fff"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M9 12v1M15 12v1" stroke="#e8542a" stroke-width="2" stroke-linecap="round"/></svg>',
  fan: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z" fill="#fff"/><path d="M15 4l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L12 6.3l2-.3z" fill="#fff"/></svg>',
  line: '<svg viewBox="0 0 24 24"><path d="M4 17c5 0 5-10 10-10h6M4 7c5 0 5 10 10 10h6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path d="M18 5l2 2-2 2M18 15l2 2-2 2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  set: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
};
function phoneGrid() {
  return `<div class="ph-grid">${APPS().map(([id, n, cls]) => `<b data-a="hopen" data-x="${id}"><i class="pi ${cls}">${GLY[id]}</i><span>${esc(n)}</span></b>`).join('')}</div>`;
}
// 把手机屏幕那块四边形算成 matrix3d（单位正方形 → 四个角）
function quadMatrix(w, h, pts) { // 把 (0,0)-(w,h) 的矩形映射到四个角 pts（像素）
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = pts;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / det, hh = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
}

/* ---------- 全息屏：每个入口一页，点进去还有下一层 ---------- */
const H = {
  plat: () => { const f = FM[ST().form]; return { k: `${f.plat} · 官方`, t: '雨停之前', m: `${f.where} · ${f.unit} · 今天更新`, body: '这一' + f.ep + '里，万事屋的雨一直没停。他把最后一把伞借给了来委托的人，自己在屋檐下坐到天黑。有人问他在等谁，他说在等雨停。', dm: ['前方高能！！', '泪目了', '这一集神作', '打卡', '伞！！！'], acts: [['本' + f.ep + '评论 · 2,418', 'cmts'], ['刷新本期', 'gen']] }; },
  forum: () => ({ k: 'FORUM · 追更区', t: '今日 128 帖', m: '热帖 3 · 新回复 41', tabs: [['热帖', 1], ['热搜', 0], ['投票', 0], ['评分', 0]], list: [['伞党', '第 27 话那把伞到底借给谁了？细节考据', '热 218'], ['路过的编辑', '这周作画是不是崩了，作者在赶稿吧', '56'], ['雨停了吗', '三人同框！！我宣布这是本季最佳', '热 501'], ['考据组', '扉页右下角那只眼睛……是我想多了吗', '89'], ['夜班读者', '每周四就靠这个撑着了', '33']], go: 'post', acts: [['我也发一帖', 'post']] }),
  post: () => ({ k: 'FORUM · 第 27 话', t: '那把伞到底借给谁了？', m: '伞党 · 2 小时前 · 218 楼', body: '扉页里那把伞的伞骨是七根，但第 19 话他拿的是八根的那把。要么是作画失误，要么借出去的根本不是同一把伞。\n\n另外右下角那只眼睛，连续三话都出现在同一个位置了，不可能是巧合。', list: [['2 楼 · 雨停了吗', '七根！！我数了三遍', '12'], ['3 楼 · 路过的编辑', '作画失误，别想太多', '4'], ['4 楼 · 考据组', '那只眼睛我也注意到了', '31']], acts: [['回复这一楼', 'reply']] }),
  shop: () => ({ k: 'STORE · 官方周边店', t: '雨停之前 官方店', m: '关注 12.4 万 · 本期上新 6 件', goods: [['#d88aa6', '伞 · 亚克力立牌', '¥48', '4.9'], ['#8ab0e6', '万事屋 吧唧 3 枚', '¥35', '4.8'], ['#e6c46a', '第 3 卷 特装版', '¥128', '5.0'], ['#9a8ae6', '雨夜 挂画', '¥88', '4.7']], list: [['买家 · 伞党', '立牌做工比想的好，伞骨真的是七根', '★★★★★'], ['买家 · 夜班读者', '吧唧背面有那只眼睛，细节满分', '★★★★★'], ['买家 · 路过的编辑', '挂画偏暗，但挂在床头很对味', '★★★★☆']], acts: [['去商业街抽一番赏', 'street']] }),
  fan: () => ({ k: 'FANWORKS · 同人圈', t: '本周产出 64', m: '图 41 · 文 19 · cos 4 · 高维度的粉丝们', grid: [['#5a6a9a', '雨夜'], ['#8a5a6a', '借伞'], ['#4a6a5a', '屋檐下'], ['#6a5a8a', '回头'], ['#8a7a4a', '扉页'], ['#4a5a7a', '三人']], list: [['太太A', '《等雨停的人》 · 短篇 · 3.2k 字', '热 890'], ['画手B', '屋檐下 · 彩图', '412']], acts: [['看全部', 'fanall']] }),
  line: () => ST().src == 'fan' ? { k: 'ORIGINAL · 原著线', t: '原著里的他们', m: '原著角色看这条线的剧情', body: '原著里那把伞他没借出去。所以当原著的他看到这条线里的自己坐在屋檐下等雨停，沉默了很久。', list: [['原著 · 他', '……我不会把伞借出去的。但这个我，好像比我更像我。', ''], [' 原著 · 她', '这条线里他居然会等人，笑死，原著他连雨都不躲。', '']], acts: [['切换到 IF 线（原创作品）', 'srcorig']] }
    : { k: 'IF · 另一条线', t: '如果那天他没借伞', m: 'IF 线 · 同一批人，另一个选择', body: '这部作品没有原著，所以另一条线是「IF 线」：同一个故事，在某个岔路口走了另一条路。那边的他们，隔着线看这边。', list: [['IF 线 · 他', '我把伞留下了。然后我在屋檐下等了一整晚，雨也没停。', ''], ['IF 线 · 她', '这边的我没去找他。所以看见那边的我去了，有点想哭。', '']], acts: [['切换到原著线（同人作品）', 'srcfan']] },
  set: () => ({ k: 'SETTINGS', t: '作品档案', m: `${FN[ST().form]} · ${FM[ST().form].unit}`, forms: 1, acts: [['重新选择作品', 'reguide'], ['重看片头', 'replay']] }),
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
let focused = '', stack = [];
function fitRoom(el) { const st = $('.eye-stage', el), fit = $('.fit', el); if (!st || !fit) return; const w = st.clientWidth, h = st.clientHeight; const fw = Math.max(w, h * 1024 / 1466) + 'px'; fit.style.setProperty('--fw', fw); st.style.setProperty('--fw', fw); placePhone(el); }
function placePhone(el) { const sw = $('.swaps', el), g = $('.ph-grid', el); if (!sw || !g) return; const fw = sw.clientWidth, fh = fw * 1466 / 1024;
  g.style.transform = quadMatrix(g.offsetWidth, g.offsetHeight, PHQ.map(([x, y]) => [x / 100 * fw, y / 100 * fh])); }
function cam(el, k) {
  const st = $('.eye-stage', el), room = $('.eye-room', el); if (!st) return;
  const zk = k ? k.split(':')[0] : '', z = ZONES[zk];
  st.classList.toggle('zoom', !!k); st.dataset.focus = zk;
  if (z) { const fit = $('.fit', el), s = CAMS[zk] || 1.8, sw = st.clientWidth, sh = st.clientHeight, fw = parseFloat(fit.style.getPropertyValue('--fw')) || sw, fh = fw * 1466 / 1024;
    const cx = (sw - fw) / 2 + (z[0] + z[2]) / 200 * fw, cy = (sh - fh) / 2 + (z[1] + z[3]) / 200 * fh, C = [sw / 2, sh / 2], target = [sw / 2, sh * (zk == 'tv' ? .26 : .40)];
    let tx = target[0] - C[0] - (cx - C[0]) * s, ty = target[1] - C[1] - (cy - C[1]) * s; const fx0 = (sw - fw) / 2, fy0 = (sh - fh) / 2;
    tx = Math.min(Math.max(tx, sw - (C[0] + (fx0 + fw - C[0]) * s)), -(C[0] + (fx0 - C[0]) * s)); ty = Math.min(Math.max(ty, sh - (C[1] + (fy0 + fh - C[1]) * s)), -(C[1] + (fy0 - C[1]) * s));
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

/* ---------- 片头：第一次进来 ---------- */
const INTRO = [['如果这个世界，', ''], ['是一部', '漫画'], ['一本', '小说'], ['一部', '电视剧'], ['一个', '游戏'], ['一个', '动漫']];
function introHtml() { return `<div class="eye-intro" data-a="iskip"><div class="il">${INTRO.map(([a, b], i) => `<p style="--i:${i}">${esc(a)}${b ? `<b>${esc(b)}</b>…` : ''}</p>`).join('')}</div><div class="ie"><img src="${IMG('logo')}" alt=""><i class="lid t"></i><i class="lid b"></i><i class="slit"></i></div><i class="iflash"></i></div>`; }
function intro(el) {
  const it = $('.eye-intro', el); if (!it) return; let t = [];
  const at = (ms, f) => t.push(setTimeout(f, ms));
  const eye = () => { it.classList.add('eye'); at(900, () => it.classList.add('open')); at(2100, () => it.classList.add('flash')); at(2500, () => { it.classList.add('out'); guide(el, true); }); at(3300, () => it.remove()); };
  at(INTRO.length * 650 + 1400, eye);
  it._skip = () => { if (it.classList.contains('eye')) return; t.forEach(clearTimeout); t = []; it.classList.add('fast'); eye(); };
}

/* ---------- 引导：第一次进来先选作品 ---------- */
function guide(el, on) { const g = $('.eye-guide', el); if (!g) return; g.classList.toggle('in', on); $('.eye-stage', el).classList.toggle('guiding', on); }
function pickForm(el, k, pg) {
  const st = ST(); st.form = k; save();
  const g = $('.eye-guide', el); if (g) { $$('.gp', g).forEach(p => p.classList.toggle('pick', p.dataset.x == k)); $$('.gp', g).forEach(p => p.dataset.x != k && p.classList.add('off')); }
  setTimeout(() => { guide(el, false); $('.tv-scr', el).innerHTML = tvScreen(); $('.tv-scr', el).classList.add('lit'); $('.eye-brand small', el).textContent = `${FN[k]} · ${FM[k].unit}`; placePhone(el); $('.ph-grid', el).innerHTML = phoneGrid().replace(/^<div class="ph-grid">|<\/div>$/g, ''); }, 650);
}

function mount(el) {
  fitRoom(el); requestAnimationFrame(() => fitRoom(el)); const st = $('.eye-stage', el); if (!st || st._eye) return; st._eye = 1; new ResizeObserver(() => fitRoom(el)).observe(st);
  st.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); st.style.setProperty('--mx', (e.clientX - r.left) / r.width * 100 + '%'); st.style.setProperty('--my', (e.clientY - r.top) / r.height * 100 + '%'); });
  let y0 = 0; st.addEventListener('pointerdown', e => { const c = e.target.closest('.holo'); y0 = c ? e.clientY : 0; });
  st.addEventListener('pointerup', e => { if (y0 && e.clientY - y0 > 48) back(el); y0 = 0; });
  st.addEventListener('click', e => { if (st.classList.contains('guiding')) return; if (e.target.closest('.holo,[data-a],.ph-grid')) return; if (focused) back(el); });
  st.addEventListener('pointerdown', e => { const b = e.target.closest('button,.hz,.ph-grid b,.ho-forms b,.gp'); if (!b) return; const r = b.getBoundingClientRect(), i = document.createElement('i'); i.className = 'rip'; i.style.left = e.clientX - r.left + 'px'; i.style.top = e.clientY - r.top + 'px'; b.append(i); setTimeout(() => i.remove(), 700); });
  if (!ST().form) { if (ST().intro) guide(el, true); else { ST().intro = 1; save(); intro(el); } }
}

const body = () => { const st = ST(), has = !!st.form; return `<div class="eye-stage ${st.wall ? 'wall' : ''}" style="--mx:50%;--my:50%">
<div class="eye-room" style="--s:1;--tx:0px;--ty:0px"><div class="fit">
<img class="base ${st.role == 'author' ? '' : 'in'}" src="${IMG('room')}" draggable="false" alt=""><img class="base ${st.role == 'author' ? 'in' : ''}" src="${IMG('room_author')}" draggable="false" alt="">
<div class="tv-scr ${has ? 'lit' : ''}">${tvScreen()}</div>
<i class="led"></i><i class="moon-ray"></i><i class="curtain-glow"></i>
${Object.entries(ZONES).map(([k, z]) => `<b class="hz hz-${k}" data-a="ez" data-x="${k}" style="left:${z[0]}%;top:${z[1]}%;width:${z[2] - z[0]}%;height:${z[3] - z[1]}%"></b>`).join('')}
</div></div>
<div class="eye-guide ${has ? '' : 'in'}"><p class="gq"><b>在那个世界里，这段剧情是一部……</b><small>点一块面板</small></p>
<div class="gps">${FORMS.map(([k, n]) => `<b class="gp" data-a="gpick" data-x="${k}"><img src="${IMG('gp_' + k)}" alt=""><span>${n}</span><img class="gi" src="${IMG('gi_' + k)}" alt=""></b>`).join('')}</div></div>
<div class="swaps">${Object.entries(SWAP).map(([k, f]) => `<img class="swap" data-k="${f}" src="${IMG(f)}" draggable="false" alt="">`).join('')}<div class="ph-grid" data-a="noop">${has ? phoneGrid().replace(/^<div class="ph-grid">|<\/div>$/g, '') : ''}</div></div>
<img class="eye-fg" src="${IMG('fg')}" draggable="false" alt="">
<div class="eye-fx"><i class="dust d1"></i><i class="dust d2"></i><i class="dust d3"></i><i class="dust d4"></i><i class="dust d5"></i><i class="dust d6"></i></div>
${!st.form && !st.intro ? introHtml() : ''}
<div class="eye-top"><b class="eye-back ${focused ? 'show' : ''}" data-a="eback">‹ 回到客厅</b><span class="eye-brand"><i></i>窥探之眼<small>${has ? esc(FN[st.form]) + ' · ' + esc(FM[st.form].unit) : '选一部作品'}</small></span></div>
</div>`; };

reg({
  id: 'eye', name: '窥探之眼',
  icon: `<img src="${IMG('icon')}" alt="">`,
  open: async () => { await css(); focused = ''; stack = []; return page({ title: '', cls: 'eye-pg', noBack: 1, body, after: mount, acts: {
    ez: (k, t, e, pg) => { if (!ST().form) return; focus(pg.el, k == focused ? '' : k); },
    eback: (x, t, e, pg) => back(pg.el),
    gpick: (k, t, e, pg) => pickForm(pg.el, k, pg),
    noop: () => {},
    iskip: (x, t, e, pg) => $('.eye-intro', pg.el)?._skip?.(),
    hopen: (k, t, e, pg) => focus(pg.el, 'phone:' + k),
    eform: (k, t, e, pg) => { ST().form = k; save(); pg.re(); },
    hact: (a, t, e, pg) => {
      const st = ST();
      if (a == 'role') { st.role = st.role == 'author' ? 'viewer' : 'author'; save(); $$('.base', pg.el).forEach((i, n) => i.classList.toggle('in', (n == 1) == (st.role == 'author'))); focus(pg.el, 'mask', false); return; }
      if (a == 'wall') { st.wall = !st.wall; save(); $('.eye-stage', pg.el).classList.toggle('wall', st.wall); $('.tv-scr', pg.el).innerHTML = tvScreen(); focus(pg.el, 'cctv', false); return; }
      if (a == 'srcfan' || a == 'srcorig') { st.src = a == 'srcfan' ? 'fan' : 'orig'; save(); focus(pg.el, 'phone:line', false); return; }
      if (a == 'reguide') { st.form = ''; save(); pg.re(); return; }
      if (a == 'replay') { st.form = ''; st.intro = 0; save(); pg.re(); return; }
      if (a == 'shop') { focus(pg.el, 'phone:shop'); return; }
      if (a == 'street') { openApp('street'); return; }
      toast('还没接上，先看样子');
    },
  } }); },
});
