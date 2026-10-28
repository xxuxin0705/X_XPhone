// 小手机 · 窥探之眼：从更高一层往下看——这段剧情在「那个世界」里是一部漫画 / 动画 / 电视剧 / 小说 / 游戏
// 画面：深夜客厅（assets/eye/room.webp），一个背对我们的小黑人窝在沙发里刷手机；墙上的电视、面具、周边柜、红帷幕、监控都能点
//   电视 → 本期更新（屏幕内容由前端实时画上去）   手机 → 论坛 / 热搜 / 投票 / 评分 / 同人（蓝色全息屏浮在他面前）
//   面具 → 身份（观众席 ↔ 作者）   帷幕 → 幕后   周边柜 → 周边（联动一番赏）   监控 → 刷新本期 / 打破第四面墙
// 现在只有样子和交互；内容都是样例，生成之后接
import { S, $, $$, page, reg, toast, save, esc } from '../../core.js';

const CSS = new URL('./eye.css?v=2', import.meta.url).href;
const css = () => { if (document.querySelector('link[data-eye]')) return; document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" data-eye href="${CSS}">`); };
const ROOM = new URL('../../assets/eye/room.webp', import.meta.url).href;
const ST = () => (S.eye ||= { form: 'anime', role: 'viewer', wall: false });

/* ---------- 形态 ---------- */
const FORMS = [['manga', '漫画'], ['anime', '动画'], ['drama', '电视剧'], ['novel', '小说'], ['game', '游戏']];
const FN = Object.fromEntries(FORMS);
const FM = {
  manga: { ep: '话', unit: '第 3 卷 · 第 27 话', where: '周刊少年某某 · 每周四', bs: '作者后记', who: '作者与责编' },
  anime: { ep: '集', unit: '第 2 季 · 第 8 集', where: '某某 TV · 每周六 24:00', bs: '声优感想', who: '配音演员' },
  drama: { ep: '集', unit: '第 12 集', where: '某某卫视 · 每晚 20:00', bs: '演员访谈', who: '主演' },
  novel: { ep: '章', unit: '第三卷 · 第 41 章', where: '某某文库 · 连载中', bs: '作者的话', who: '作者' },
  game: { ep: '章', unit: '第 4 章 · 雨夜', where: '某某工作室 · 已发售', bs: '开发者日志', who: '制作组' },
};

/* ---------- 热区（相对图片的百分比：左 上 右 下） ---------- */
const ZONES = {
  tv: [33.5, 14.5, 78.5, 43.5], phone: [38, 56, 50, 67], mask: [16, 9, 27.5, 21], cab: [13.5, 20, 28.5, 34.5],
  curtain: [82, 8, 99.5, 52], cctv: [72, 2, 87, 9.5], table: [52, 51, 97, 70],
};
// 镜头：点进去以后画面放大几倍、往哪边推（以该热区的中心为准）
const CAMS = { tv: 1.35, phone: 1.9, mask: 2.4, cab: 2.2, curtain: 1.9, cctv: 2.6, table: 1.7 };

/* ---------- 电视里的画面（前端画的，跟形态走） ---------- */
function tvScreen() {
  const f = FM[ST().form], st = ST();
  if (st.wall) return `<div class="tv-wall"><div class="tv-eye"><i></i></div></div>`;
  return `<div class="tv-pic f-${st.form}"><i class="tv-sun"></i><i class="tv-hill h1"></i><i class="tv-hill h2"></i><i class="tv-rain"></i>
<div class="tv-dm">${['前方高能', '泪目了', '这一集神作', '你倒是回头啊', '打卡', '啊啊啊啊'].map((t, i) => `<span style="--i:${i}">${t}</span>`).join('')}</div>
<div class="tv-sub"><b>${esc(FN[st.form])} · ${esc(f.unit)}</b><small>「……雨，停了啊。」</small></div></div>`;
}

/* ---------- 手机里的 App ---------- */
const APPS = [['forum', '论坛', '#5ad0ff'], ['hot', '热搜', '#ff7a6a'], ['vote', '投票', '#ffd45a'], ['rate', '评分', '#b48aff'], ['fan', '同人', '#ff8ac8']];
const AN = Object.fromEntries(APPS.map(a => [a[0], a[1]]));

/* ---------- 全息屏：每个入口一页，点进去还有下一层 ---------- */
const H = {
  phone: () => ({ k: 'PHONE · 他的手机', t: '窥探他的屏幕', m: `${FN[ST().form]} · ${FM[ST().form].unit}`, apps: 1 }),
  forum: () => ({ k: 'FORUM · 追更区', t: '今日 128 帖', m: '热帖 3 · 新回复 41', list: [['伞党', '第 27 话那把伞到底借给谁了？细节考据', '热 218'], ['路过的编辑', '这周作画是不是崩了，作者在赶稿吧', '56'], ['雨停了吗', '三人同框！！我宣布这是本季最佳', '热 501'], ['考据组', '扉页右下角那只眼睛……是我想多了吗', '89'], ['夜班读者', '每周四就靠这个撑着了', '33']], go: 'post', acts: [['我也发一帖', 'post']] }),
  post: () => ({ k: 'FORUM · 第 27 话', t: '那把伞到底借给谁了？', m: '伞党 · 2 小时前 · 218 楼', body: '扉页里那把伞的伞骨是七根，但第 19 话他拿的是八根的那把。要么是作画失误，要么借出去的根本不是同一把伞。\n\n另外右下角那只眼睛，连续三话都出现在同一个位置了，不可能是巧合。', list: [['2 楼 · 雨停了吗', '七根！！我数了三遍', '12'], ['3 楼 · 路过的编辑', '作画失误，别想太多', '4'], ['4 楼 · 考据组', '那只眼睛我也注意到了', '31']], acts: [['回复这一楼', 'reply']] }),
  hot: () => ({ k: 'TRENDING · 热搜', t: '实时话题', m: '更新于 1 分钟前', list: [['1', '雨停之前 第27话', '爆'], ['2', '伞到底借给谁了', '热'], ['3', '银发少年 回头', '热'], ['4', '周刊少年某某 休刊', ''], ['5', '扉页 眼睛', '新'], ['6', '作者 后记 哭了', '']], go: 'forum' }),
  vote: () => ({ k: 'VOTE · 人气投票', t: '第 3 回角色人气投票', m: '投票中 · 还剩 2 天', bars: [['银发少年', 42], ['红伞少女', 31], ['眼镜君', 15], ['店长', 8], ['其他', 4]], acts: [['投他一票', 'cast']] }),
  rate: () => ({ k: 'SCORE · 评分', t: '9.2', m: '12,480 人评价 · 本话 9.6', bars: [['五星', 78], ['四星', 15], ['三星', 5], ['二星', 1], ['一星', 1]], list: [['长评', '关于雨、伞和那些没说出口的话', '热 1.2k'], ['短评', '这一话之后我不敢再看扉页了', '340']], go: 'post' }),
  fan: () => ({ k: 'FANWORKS · 同人', t: '本周产出 64', m: '图 41 · 文 19 · cos 4', grid: [['#5a6a9a', '雨夜'], ['#8a5a6a', '借伞'], ['#4a6a5a', '屋檐下'], ['#6a5a8a', '回头'], ['#8a7a4a', '扉页'], ['#4a5a7a', '三人']], acts: [['看全部', 'fanall']] }),
  tv: () => { const f = FM[ST().form]; return { k: `${FN[ST().form].toUpperCase ? FN[ST().form] : ''} · 本期`, t: '雨停之前', m: `${f.where} · ${f.unit}`, body: '这一' + f.ep + '里，万事屋的雨一直没停。他把最后一把伞借给了来委托的人，自己在屋檐下坐到天黑。有人问他在等谁，他说在等雨停。', dm: ['前方高能！！', '泪目了', '这一集神作', '打卡', '伞！！！'], acts: [['弹幕 · 实时', 'dm'], ['刷新本期', 'gen']] }; },
  mask: () => ({ k: 'IDENTITY · 身份', t: ST().role == 'author' ? '作者' : '观众席', m: ST().role == 'author' ? '以作者本人的身份发言 · 读者会认出你' : '以普通读者的身份逛论坛 · 用自己的马甲发帖', body: ST().role == 'author' ? '面具戴上了。从现在起，你的每一句话都会被当成官方发言。' : '面具还挂在墙上。你只是观众席里的一个人。', acts: [[ST().role == 'author' ? '摘下面具 · 回到观众席' : '戴上面具 · 成为作者', 'role']] }),
  curtain: () => { const f = FM[ST().form]; return { k: `BACKSTAGE · ${f.bs}`, t: f.who, m: `本${f.ep} · 2 条`, body: ST().form == 'manga' || ST().form == 'novel' ? '这一话画到最后一页的时候外面真的在下雨。借伞那个分镜改了四次，责编说第一版太温柔了，不像他。' : '录屋檐下那段戏的时候，导演让我什么都别说，只呼吸。后来回放，我自己也沉默了很久。', acts: [['看全文', 'bs']] }; },
  cab: () => ({ k: 'GOODS · 周边', t: '本期周边', m: '一番赏 · 第 2 弹', grid: [['#d88aa6', 'A 赏'], ['#8ab0e6', 'B 赏'], ['#e6c46a', 'C 赏'], ['#ff8ac8', '吧唧'], ['#8adcff', '吧唧'], ['#9a8ae6', '立牌']], acts: [['去商业街抽一发', 'street']] }),
  cctv: () => ({ k: 'EYE · 窥探之眼', t: ST().wall ? '他发现你了' : '高维视角', m: `上次窥视：${FM[ST().form].unit} · 2 小时前`, body: ST().wall ? '监控转过来了。电视里的人也转过来了。\n现在不只是你在看他。' : '从这里往下看，剧情是一部正在连载的作品。刷新一次，就把最新的进度翻到这个世界里来。', acts: [['刷新本期', 'gen'], [ST().wall ? '关上第四面墙' : '打破第四面墙', 'wall']] }),
  table: () => ({ k: 'TABLE · 茶几', t: '桌上的东西', m: '五种形态', forms: 1 }),
};

function holo(k) {
  const d = H[k](); const row = (a, b, c) => `<li><b>${esc(a)}</b><span>${esc(b)}</span>${c ? `<em>${esc(c)}</em>` : ''}</li>`;
  return `<div class="holo" data-h="${k}"><i class="ho-c c1"></i><i class="ho-c c2"></i><i class="ho-c c3"></i><i class="ho-c c4"></i>
<div class="ho-h"><i></i><span class="scr" data-t="${esc(d.k)}">${esc(d.k)}</span><small>LIVE</small></div>
<div class="ho-b"><b class="ho-t">${esc(d.t)}</b><em class="ho-m">${esc(d.m)}</em>
${d.body ? `<p>${esc(d.body).replace(/\n/g, '<br>')}</p>` : ''}
${d.apps ? `<div class="ho-apps">${APPS.map(([id, n, c]) => `<b data-a="hopen" data-x="${id}" style="--c:${c}"><i></i>${n}</b>`).join('')}</div>` : ''}
${d.forms ? `<div class="ho-forms">${FORMS.map(([id, n]) => `<b class="${ST().form == id ? 'on' : ''}" data-a="eform" data-x="${id}">${n}</b>`).join('')}</div>` : ''}
${d.list ? `<ul class="ho-list">${d.list.map(([a, b, c]) => (d.go ? `<li data-a="hopen" data-x="${d.go}">` : '<li>') + `<b>${esc(a)}</b><span>${esc(b)}</span>${c ? `<em>${esc(c)}</em>` : ''}</li>`).join('')}</ul>` : ''}
${d.bars ? `<div class="ho-bars">${d.bars.map(([n, v]) => `<div><span>${esc(n)}</span><i style="--v:${v}%"></i><em>${v}%</em></div>`).join('')}</div>` : ''}
${d.grid ? `<div class="ho-grid">${d.grid.map(([c, n]) => `<b style="--c:${c}"><span>${esc(n)}</span></b>`).join('')}</div>` : ''}
${d.dm ? `<div class="ho-dm">${d.dm.map((t, i) => `<span style="--i:${i}">${esc(t)}</span>`).join('')}</div>` : ''}
</div>${d.acts ? `<div class="ho-acts">${d.acts.map(([l, a]) => `<button data-a="hact" data-x="${a}"><span>${esc(l)}</span><i>›</i></button>`).join('')}</div>` : ''}</div>`;
}

/* ---------- 乱码解码：标题字一个个从乱码翻成正字 ---------- */
const GL = '░▒▓█＜＞/\\|=+*#%&0123456789アイウエオカキクケコ';
function scramble(el) {
  const t = el.dataset.t || el.textContent; let n = 0; const L = t.length;
  const tick = () => { n += .6; el.textContent = [...t].map((c, i) => i < n ? c : c == ' ' ? ' ' : GL[Math.random() * GL.length | 0]).join(''); if (n < L) el._sc = requestAnimationFrame(tick); else el.textContent = t; };
  cancelAnimationFrame(el._sc); tick();
}

/* ---------- 镜头 ---------- */
let focused = '', stack = [];
function focus(el, k, push = true) {
  const st = $('.eye-stage', el), room = $('.eye-room', el); if (!st) return;
  if (k && push && focused && focused != k) stack.push(focused);
  focused = k; st.classList.toggle('zoom', !!k); st.dataset.focus = k || '';
  const z = k && ZONES[k.split(':')[0]] ? ZONES[k.split(':')[0]] : null, zk = k ? k.split(':')[0] : '';
  if (z) { const fit = $('.fit', el), s = CAMS[zk] || 1.8, sw = st.clientWidth, sh = st.clientHeight, fw = parseFloat(fit.style.getPropertyValue('--fw')) || sw, fh = fw * 1466 / 1024;
    // fit 居中在 stage 里；热区中心换算成 stage 百分比，再夹在合法范围内，免得放大后露出黑边
    let cx = (sw - fw) / 2 + (z[0] + z[2]) / 200 * fw, cy = (sh - fh) / 2 + (z[1] + z[3]) / 200 * fh;
    // transform-origin 是画面中心：点 p 放大后到 c + (p - c)·s + t。要让热区中心落到目标点 (画面中心偏上)，t = target - c - (p - c)·s
    const C = [sw / 2, sh / 2], target = [sw / 2, sh * (zk == 'tv' ? .26 : .40)];
    let tx = target[0] - C[0] - (cx - C[0]) * s, ty = target[1] - C[1] - (cy - C[1]) * s;
    // 图片放大后的四边：左 = C.x + (fx0 - C.x)·s + tx ≤ 0；右 ≥ sw；上下同理 → 夹住 t
    const fx0 = (sw - fw) / 2, fy0 = (sh - fh) / 2;
    tx = Math.min(Math.max(tx, sw - (C[0] + (fx0 + fw - C[0]) * s)), -(C[0] + (fx0 - C[0]) * s));
    ty = Math.min(Math.max(ty, sh - (C[1] + (fy0 + fh - C[1]) * s)), -(C[1] + (fy0 - C[1]) * s));
    room.style.setProperty('--s', s); room.style.setProperty('--tx', tx + 'px'); room.style.setProperty('--ty', ty + 'px'); }
  else { room.style.setProperty('--s', 1); room.style.setProperty('--tx', '0px'); room.style.setProperty('--ty', '0px'); }
  $$('.hz', el).forEach(h => h.classList.toggle('on', h.dataset.x == zk));
  $('.holo', el)?.remove(); $('.eye-back', el)?.classList.toggle('show', !!k);
  $('.holo-beam', el)?.remove();
  if (k) { const hk = k.includes(':') ? k.split(':')[1] : k; if (H[hk]) { st.insertAdjacentHTML('beforeend', (zk == 'phone' ? '<i class="holo-beam"></i>' : '') + holo(hk)); const h = $('.holo', el); requestAnimationFrame(() => { h.classList.add('in'); $('.holo-beam', el)?.classList.add('in'); scramble($('.scr', h)); }); } }
}
const back = (el, pg) => { if (stack.length) focus(el, stack.pop(), false); else { focus(el, ''); } };

function fitRoom(el) { const st = $('.eye-stage', el), fit = $('.fit', el); if (!st || !fit) return; const w = st.clientWidth, h = st.clientHeight; fit.style.setProperty('--fw', Math.max(w, h * 1024 / 1466) + 'px'); }
function mount(el) {
  fitRoom(el); requestAnimationFrame(() => fitRoom(el)); const st = $('.eye-stage', el); if (!st || st._eye) return; st._eye = 1; new ResizeObserver(() => fitRoom(el)).observe(st);
  // 聚光灯：手指 / 鼠标在哪，哪里就亮一点（像拿手电筒照着看）
  st.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); st.style.setProperty('--mx', (e.clientX - r.left) / r.width * 100 + '%'); st.style.setProperty('--my', (e.clientY - r.top) / r.height * 100 + '%'); });
  // 三维倾斜：按住拖动一点点，整个房间跟着微微转（视差）
  let y0 = 0; st.addEventListener('pointerdown', e => { const c = e.target.closest('.holo'); y0 = c ? e.clientY : 0; });
  st.addEventListener('pointerup', e => { if (y0 && e.clientY - y0 > 48) back(el); y0 = 0; });
  st.addEventListener('click', e => { if (e.target.closest('.holo,[data-a]')) return; const b = e.target.closest('.hz'); if (!b && focused) back(el); });
  // 点击涟漪
  st.addEventListener('pointerdown', e => { const b = e.target.closest('button,.hz,.ho-apps b,.ho-forms b'); if (!b) return; const r = b.getBoundingClientRect(), i = document.createElement('i'); i.className = 'rip'; i.style.left = e.clientX - r.left + 'px'; i.style.top = e.clientY - r.top + 'px'; b.append(i); setTimeout(() => i.remove(), 700); });
  // 监控红灯 + 电视慢慢动的光
  const tv = $('.tv-scr', el); tv && (tv.innerHTML = tvScreen());
}

const body = () => { const st = ST(); return `<div class="eye-stage ${st.wall ? 'wall' : ''}" style="--mx:50%;--my:50%">
<div class="eye-room" style="--s:1;--tx:0px;--ty:0px"><div class="fit"><img src="${ROOM}" draggable="false" alt="">
<div class="tv-scr">${tvScreen()}</div>
<i class="led"></i><i class="moon-ray"></i><i class="curtain-glow"></i>
${Object.entries(ZONES).map(([k, z]) => `<b class="hz hz-${k}" data-a="ez" data-x="${k}" style="left:${z[0]}%;top:${z[1]}%;width:${z[2] - z[0]}%;height:${z[3] - z[1]}%"></b>`).join('')}
</div></div>
<div class="eye-fx"><i class="dust d1"></i><i class="dust d2"></i><i class="dust d3"></i><i class="dust d4"></i><i class="dust d5"></i><i class="dust d6"></i></div>
<div class="eye-top"><b class="eye-back ${focused ? 'show' : ''}" data-a="eback">‹ 回到客厅</b><span class="eye-brand"><i></i>窥探之眼<small>${esc(FN[st.form])} · ${esc(FM[st.form].unit)}</small></span></div>
</div>`; };

reg({
  id: 'eye', name: '窥探之眼',
  icon: '<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="#000"/><path d="M4 12q8-9 16 0q-8 9-16 0z" fill="none" stroke="#ff2a2a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#ff2a2a" stroke-width="1.8"/><circle cx="12" cy="12" r="1.4" fill="#ff2a2a"/></svg>',
  open: () => { css(); focused = ''; stack = []; return page({ title: '', cls: 'eye-pg', noBack: 1, body, after: mount, acts: {
    ez: (k, t, e, pg) => focus(pg.el, k == focused ? '' : k),
    eback: (x, t, e, pg) => back(pg.el, pg),
    hopen: (k, t, e, pg) => focus(pg.el, (focused.split(':')[0] || 'phone') + ':' + k),
    eform: (k, t, e, pg) => { ST().form = k; save(); pg.re(); setTimeout(() => focus(pg.el, 'table', false), 60); },
    hact: (a, t, e, pg) => {
      if (a == 'role') { ST().role = ST().role == 'author' ? 'viewer' : 'author'; save(); focus(pg.el, 'mask', false); return; }
      if (a == 'wall') { ST().wall = !ST().wall; save(); pg.re(); setTimeout(() => { $('.tv-scr', pg.el).innerHTML = tvScreen(); focus(pg.el, 'cctv', false); }, 60); return; }
      toast('还没接上，先看样子');
    },
  } }); },
});
