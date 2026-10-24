// 聊天 · 表情包：表情商店（免费表情库）/ 表情包组 / 搜索表情 / AI 发表情自动配图
// 全部用公开免费的图片源，不会调用你自己的任何 API（聊天模型、生图都不会用）：
//   · ChineseBQB（github.com/zhaoolee/ChineseBQB）：作者开放的表情包数据源，图片在 zhaoolee.com，备用线路 jsDelivr
//   · Waline 表情预设（github.com/walinejs/emojis）：图片走 npm 镜像 CDN（国内 npmmirror，备用 unpkg / jsDelivr）
//   · 网络表情（搜狗 / 百度表情，apihz.cn 免费接口；GIPHY 要自己的免费 Key）：只在库里不够时补充
import { S, save, esc, $, page, back, toast, ok, uid, getJ, emit } from '../../core.js';
import { WL } from './sticker-data.js';

/* ---------- 图片线路：一个打不开自动换下一个 ---------- */
globalThis.__stkAlt ||= img => { const a = (img.dataset.alt || '').split('|').filter(Boolean); if (!a.length) return img.classList.add('bad'); img.dataset.alt = a.slice(1).join('|'); img.src = a[0]; };
export const imgH = (x, cls = '', extra = '') => `<img class="${cls}" src="${esc(x.th || x.img)}" data-alt="${esc((x.alt || []).join('|'))}" loading="lazy" referrerpolicy="no-referrer" onerror="__stkAlt(this)"${extra}>`;

/* ---------- 精选表情包组：顺序＝推荐顺序；tier 1 精选（可爱风优先）、2 更多表情 ---------- */
const BQ = 'https://zhaoolee.com/ChineseBQB/', BQJ = 'https://cdn.jsdelivr.net/gh/zhaoolee/ChineseBQB@master/';
const WLB = ['https://registry.npmmirror.com/@waline/emojis/1.4.0/files/', 'https://unpkg.com/@waline/emojis@1.4.0/', 'https://cdn.jsdelivr.net/npm/@waline/emojis@1.4.0/'];
const CUR = [ // [id, 名字, 一句话介绍, tier]；b+编号 = ChineseBQB 分类，其余 = Waline 表情
  ['hoyoverse-hi3', '崩坏3 · Q版', '女武神们的软萌 Q 版表情', 1], ['b049', '猫咪日常', '猫猫的日常小剧场', 1], ['b010', '是喵星人啦', '喵星人的一百种心情', 1], ['bilibili', 'B站小电视', '哔哩哔哩经典小电视', 1],
  ['b060', '奇妙猫', '眼里有星河的奇妙猫', 1], ['b006', '仓鼠', '圆滚滚的仓鼠', 1], ['b009', '熊本熊', '熊本熊的日常', 1], ['noto', '动态小黄脸', '会动的圆脸小黄人', 1],
  ['b011', '狗狗', '狗勾们', 1], ['b057', '开心鸭', '每天都很开心的鸭子', 1], ['b055', '全是心心', '比心、爱心、心心', 1], ['b098', '间谍过家家', '阿尼亚和她的一家', 1],
  ['b026', '小幺鸡', '戏很多的小鸡', 1], ['b007', '胖虎', '圆滚滚的老虎', 1], ['b108', '企鹅家族', 'Pingu 企鹅一家', 1], ['b109', '负鼠', '会装死的负鼠', 1],
  ['b065', '旅行青蛙', '出门旅行的呱', 1], ['b054', '猫眼三姐妹', '猫猫三连', 1], ['b031', '沙雕企鹅', '有点沙雕的企鹅', 1], ['bmoji', 'B站小黄脸', '哔哩哔哩小黄脸', 1],
  ['b014', '小猪', '猪猪', 1], ['b052', '杰尼龟', '杰尼杰尼', 1], ['b036', '皮卡丘', '皮卡皮卡', 1], ['b056', '哆啦A梦', '蓝胖子', 1],
  ['b002', '可爱女孩纸', '可爱的女孩纸', 1], ['b003', '可爱男孩纸', '可爱的男孩纸', 1], ['b106', '芙莉莲', '葬送的芙莉莲', 1], ['b071', '辉夜大小姐', '辉夜大小姐想让我告白', 1],
  ['b076', '萌萝莉', '萌萌的小萝莉', 1], ['b012', '鹦鹉', '会说话的鹦鹉', 1], ['b027', '乌龟', '慢吞吞', 1], ['b029', '鸽子', '咕咕咕', 1],
  ['b015', '熊猫头', '金馆长熊猫头，斗图必备', 2], ['b001', '滑稽', '滑稽大佬', 2], ['b034', '白色小人', '白色小人，量大管饱', 2], ['b004', '假笑男孩', '假笑男孩', 2],
  ['b023', '表情符号', 'Emoji 表情', 2], ['b035', '猫和老鼠', '汤姆和杰瑞', 2], ['b048', '海绵宝宝', '海绵宝宝和派大星', 2], ['b013', '小猪佩奇', '社会人小猪佩奇', 2],
  ['b061', '柯南', '名侦探柯南', 2], ['b090', '美少女战士', '代表月亮消灭你', 2], ['b080', '鬼灭之刃', '鬼灭之刃', 2], ['b084', '刺客伍六七', '刺客伍六七', 2],
  ['b107', '葫芦兄弟', '葫芦娃', 2], ['b078', '北方栖姬', '北方栖姬', 2], ['b068', '阿库娅', '阿库娅', 2], ['b095', '原神', '原神', 2],
  ['b072', '拍一拍', '微信拍一拍', 2], ['b051', '打电话', '打电话', 2], ['b046', '穿什么', '今天穿什么', 2], ['b024', '程序员', '程序员', 2],
  ['b083', '春节', '过年好', 2], ['b018', '汪蛋', '汪蛋', 2], ['b070', 'JOJO', 'JOJO 的奇妙冒险', 2], ['b082', '进击的巨人', '进击的巨人', 2],
  ['b099', '女神异闻录', 'P5R', 2], ['b105', '黑神话悟空', '黑神话：悟空', 2], ['b110', '人工智能', 'AI', 2],
  ['alus', '阿鲁', '阿鲁系列经典表情', 2], ['tieba', '贴吧泡泡', '百度贴吧经典泡泡', 2], ['qq', 'QQ经典表情', 'QQ 动态经典表情', 2], ['weibo', '微博表情', '微博经典表情', 2],
  ['wechat', '微信小黄脸', '微信经典小黄脸', 2], ['feishu', '飞书表情', '飞书表情', 2],
];
export const packMeta = id => { const c = CUR.find(x => x[0] == id); return c && { id, name: c[1], desc: c[2], tier: c[3], bqb: id[0] == 'b' && /^b\d+$/.test(id), from: /^b\d+$/.test(id) ? 'ChineseBQB' : 'Waline' }; };
export const featured = t => CUR.filter(c => c[3] == t).map(c => c[0]);

/* ---------- 表情数据：Waline 是内置清单；ChineseBQB 读它公开的索引（一次，缓存一周） ---------- */
const wlUrl = (d, it, k) => WLB[k] + d + '/' + WL[d].p + encodeURIComponent(it) + '.' + WL[d].t;
const wlItems = d => WL[d].i.map(x => { const [it, l] = Array.isArray(x) ? x : [x, x]; return { l, img: wlUrl(d, it, 0), alt: [wlUrl(d, it, 1), wlUrl(d, it, 2)], sm: WL[d].s, k: d }; });
let bq = null, bqP = null;
const LSK = 'stp_bqb_v1';
const bqClean = n => { const st = n.split('/').pop().replace(/\.[^.]+$/, ''); if (/^\d+$/.test(st)) return ''; const l = st.replace(/^[^\d]*?\d{3,}[-_ ]*/, '').replace(/[-_]+/g, ' ').trim(); return /^[A-Za-z]*\d*$/.test(l) ? '' : l; };
const bqBuild = raw => { // raw：{ 编号: [文件夹, [[文件名, hash, 扩展名, 动图, KB]...]] }
  const o = {};
  for (const [num, [folder, L]] of Object.entries(raw)) {
    const items = [], cov = L.find(e => /^0*\d+$/.test(e[0].replace(/\.[^.]+$/, '')) && +e[0].replace(/\.[^.]+$/, '') == +num);
    for (const [n, h, e, a, kb] of L) {
      if (e && cov && n == cov[0]) continue;
      const th = BQ + 'thumbs/' + h + '.webp', full = BQ + 'media/' + h + '.' + e, jd = BQJ + encodeURIComponent(folder) + '/' + n.split('/').map(encodeURIComponent).join('/');
      items.push({ l: bqClean(n), th, img: kb > 2500 ? th : full, alt: kb > 2500 ? [jd] : [jd, th], k: 'b' + num, a });
    }
    o['b' + num] = { folder, items, cover: cov ? BQ + 'thumbs/' + cov[1] + '.webp' : items[0]?.th };
  }
  return o;
};
export function loadBqb() {
  if (bq) return Promise.resolve(bq);
  try { const c = JSON.parse(localStorage.getItem(LSK) || 'null'); if (c && Date.now() - c.t < 7 * 864e5) return Promise.resolve(bq = bqBuild(c.d)); } catch { }
  return bqP ||= getJ(BQ + 'catalog/search.json').then(list => {
    const want = new Set(CUR.filter(c => /^b\d+$/.test(c[0])).map(c => c[0].slice(1))), d = {};
    for (const x of list || []) {
      const num = String(x.category || '').replace(/^bqb-/, ''); if (!want.has(num) || !x.src) continue;
      const [, h, e] = String(x.src).match(/^media\/([a-f0-9]+)\.(\w+)$/) || []; if (!h) continue;
      (d[num] ||= [x.folder, []])[1].push([x.path || x.name, h, e, x.animated ? 1 : 0, Math.round((x.bytes || 0) / 1024)]);
    }
    try { localStorage.setItem(LSK, JSON.stringify({ t: Date.now(), d })); } catch { }
    return bq = bqBuild(d);
  }).finally(() => { bqP = null; });
}
// 一个表情包组的完整信息（名字、封面、全部表情）
export async function pack(id) {
  const m = packMeta(id); if (!m) return null;
  if (WL[id]) { const items = wlItems(id), c = WL[id].c; return { ...m, items, cover: wlUrl(id, c, 0), coverAlt: [wlUrl(id, c, 1), wlUrl(id, c, 2)], sm: WL[id].s }; }
  const b = (await loadBqb())[id]; return b ? { ...m, items: b.items, cover: b.cover, coverAlt: [] } : { ...m, items: [], cover: '' };
}
// 不用等网络就能显示的封面（Waline 内置；ChineseBQB 已缓存时也有）
export const coverNow = id => WL[id] ? { th: wlUrl(id, WL[id].c, 0), alt: [wlUrl(id, WL[id].c, 1)] } : bq?.[id] ? { th: bq[id].cover } : null;
export const countNow = id => WL[id] ? WL[id].i.length : bq?.[id]?.items.length;
// 面板第一次打开时把 ChineseBQB 的封面准备好（有缓存就是瞬间的），好了刷新一下面板
let warmP = null; export const warm = () => bq || warmP || (warmP = loadBqb().then(() => emit('stk'), () => { }).finally(() => warmP = null), 0);
export const has = id => S.stk.packs.includes(id);
export const addPack = id => { if (!has(id)) { S.stk.packs.push(id); save(); emit('stk'); } };
export const rmPack = id => { S.stk.packs = S.stk.packs.filter(x => x != id); save(); emit('stk'); };

/* ---------- 搜索：库里的表情按「关键词 + 可爱风 + 常用」排序 ---------- */
const SYN = [['开心', '高兴', '快乐', '哈哈', '笑', '嘻嘻', '乐', '耶', '好耶', '大笑'], ['哭', '泪', '难过', '伤心', '呜呜', '委屈', '大哭', '心碎'], ['生气', '气', '怒', '火大', '烦', '不爽', '哼', '暴躁'],
  ['无语', '呵呵', '服了', '白眼', '尴尬', '汗', '无奈', '鄙视'], ['爱你', '爱', '喜欢', '心心', '比心', '亲', '么么', 'mua', '贴贴', '抱抱', '心动', '飞吻'], ['晚安', '睡', '困', '哈欠', '睡觉', '晚上好'],
  ['早安', '早上好', '起床', '早'], ['摸摸头', '摸', '摸头', '乖', '安慰', '抱抱'], ['害羞', '脸红', '羞', '腼腆'], ['震惊', '惊', '吓', '哇', '惊讶', '惊恐'], ['加油', '奋斗', '努力', '冲', '欢呼'],
  ['谢谢', '感谢', '谢', '鞠躬'], ['再见', '拜拜', '走了', '溜了', '下班'], ['你好', '嗨', '在吗', '你好呀', '欢迎'], ['吃', '饿', '馋', '好吃', '饭', '流口水'], ['疑问', '问号', '啥', '什么', '疑惑', '怀疑', '黑人问号'],
  ['好的', 'OK', '收到', '嗯嗯', '好', '同意', '可以'], ['可爱', '萌', '卖萌', '乖'], ['得意', '嘿嘿', '坏笑', '机智', '偷笑'], ['点赞', '赞', '厉害', '牛', '棒', '强'], ['思考', '想', '沉思', '让我想想'],
  ['傲娇', '哼', '才不', '得意', '嫌弃'], ['撒娇', '求求', '拜托', '可怜', '委屈'], ['吃瓜', '围观', '看戏', '嗑瓜子'], ['打你', '揍', '打脸', '敲打', '锤']];
const syn = q => [...new Set(SYN.filter(g => g.some(w => q.includes(w) || w.includes(q))).flat())].filter(w => w != q);
const score = (l, q, sy) => { if (!l) return 0; if (l == q) return 120; if (l.includes(q)) return 100 + 20 * q.length / l.length; if (sy.some(w => w.length > 1 ? l.includes(w) : l == w)) return 60; const cs = [...new Set(q)], hit = cs.filter(c => l.includes(c)).length; return q.length > 1 && hit / cs.length >= .6 ? 30 * hit / cs.length : 0; };
const bonus = id => (has(id) ? 30 : 0) + ((i => i < 0 ? 0 : CUR[i][3] == 1 ? 20 - i * .25 : 4 - i * .05)(CUR.findIndex(c => c[0] == id)));
export async function localSearch(q, n = 80) {
  q = String(q || '').trim(); if (!q) return [];
  const sy = syn(q), pool = [];
  for (const d of Object.keys(WL)) pool.push(...wlItems(d));
  try { const b = await loadBqb(); for (const id in b) pool.push(...b[id].items); } catch { /* 表情库连不上时只搜内置的 */ }
  return pool.map(x => ({ x, s: score(x.l, q, sy) })).filter(o => o.s > 0).map(o => ({ ...o, s: o.s + bonus(o.x.k) + (o.x.sm ? -8 : 0) + (o.x.a ? 2 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, n).map(o => ({ ...o.x, sc: o.s }));
}
// 搜表情包组：名字对上，或者组里有对上的表情
export async function packSearch(q) {
  q = String(q || '').trim(); if (!q) return [];
  const hit = new Map(); CUR.forEach(c => (c[1].includes(q) || c[2].includes(q)) && hit.set(c[0], 100));
  (await localSearch(q, 200)).forEach(x => hit.set(x.k, (hit.get(x.k) || 0) + 1));
  return [...hit.entries()].sort((a, b) => b[1] - a[1] || bonus(b[0]) - bonus(a[0])).map(e => e[0]);
}

/* ---------- 网络表情（补充）：搜狗 / 百度（apihz.cn 免费接口）、GIPHY（要 Key） ---------- */
export const STKP = [['sogou', '搜狗表情'], ['baidu', '百度表情'], ['giphy', 'GIPHY']];
const STK_PUB = '88888888', webC = new Map();
const webUrl = (src, q, pg) => {
  const c = S.stk, w = encodeURIComponent(q.slice(0, 10));
  if (src == 'giphy') return `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(c.gk)}&q=${encodeURIComponent(q)}&limit=24&offset=${(pg - 1) * 24}&lang=zh-CN&rating=pg-13`;
  return `https://cn.apihz.cn/api/img/apihzbqb${src == 'baidu' ? 'baidu' : 'sougou'}.php?id=${encodeURIComponent(c.id || STK_PUB)}&key=${encodeURIComponent(c.key || STK_PUB)}&words=${w}&page=${pg}${src == 'baidu' ? '&limit=24' : ''}`;
};
const webParse = (src, j) => {
  if (src == 'giphy') { if (j.meta?.status && j.meta.status != 200) throw Error(j.meta.msg || 'GIPHY 出错'); return (j.data || []).map(d => ({ img: d.images?.fixed_width?.url || d.images?.original?.url, th: d.images?.fixed_width_small?.url || d.images?.fixed_width?.url })).filter(x => x.img); }
  if (j.code != 200 && !Array.isArray(j.res)) throw Error(j.msg || '表情接口出错');
  return (j.res || []).map(x => typeof x == 'string' ? x : x?.url || x?.img || x?.src || x?.thumb).filter(u => /^https?:/.test(u || '')).map(u => ({ img: u.replace(/^http:/, 'https:') }));
};
// 偏可爱风：关键词后面加「可爱」再搜（关掉就原样搜）
export const webQ = q => S.stk.cute && !/可爱|萌/.test(q) && q.length <= 7 ? q + '可爱' : q;
export async function webSearch(q, pg = 1, signal) {
  q = String(q || '').trim(); if (!q) return [];
  const src = S.stk.src == 'giphy' && !S.stk.gk ? 'sogou' : S.stk.src, qq = src == 'giphy' ? q : webQ(q), k = [src, qq, pg].join('|');
  if (webC.has(k)) return webC.get(k);
  const order = src == 'giphy' ? ['giphy'] : [src, src == 'sogou' ? 'baidu' : 'sogou']; let err;
  for (const s of order) {
    try { const L = webParse(s, await getJ(webUrl(s, qq, pg), signal)).map(x => ({ ...x, l: q, k: 'web' })); if (L.length || s == order.at(-1)) { webC.set(k, L); return L; } }
    catch (e) { if (signal?.aborted) throw e; err = e; }
  }
  throw err || Error('没搜到');
}
// AI 发的 [表情包:关键词]：先在表情库里找（你添加的组 > 可爱精选 > 其他），找不到再上网搜；结果存进消息，之后不会变
export async function stkFind(q) {
  q = String(q || '').replace(/[（()）【】\[\]「」"“”]/g, '').trim(); if (!q) return '';
  const L = (await localSearch(q, 6)).filter(x => x.sc >= 75);
  if (L.length) return msgOf(L[Math.random() * Math.min(3, L.length) | 0], q);
  try { const W = await webSearch(q); return W.length ? msgOf(W[Math.random() * Math.min(4, W.length) | 0], q) : ''; } catch { return null; } // null＝网络出错，下次还会再试
}
// 表情 → 消息字段
export const msgOf = (x, q) => ({ t: 'sticker', c: x.l || q || '表情', img: x.img, ...(x.alt?.length && { alt: x.alt.join('|') }), ...(x.sm && { sz: 's' }) });
export const stkRecent = q => { q = String(q || '').trim(); if (!q) return; S.stk.recent = [q, ...S.stk.recent.filter(x => x != q)].slice(0, 12); save(); };

/* ---------- 页面 ---------- */
const SRCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
const addBtn = id => `<b class="sp-add ${has(id) ? 'on' : ''}" data-a="spadd" data-x="${id}">${has(id) ? '已添加' : '添加'}</b>`;
const coverH = (id, cls) => { const c = coverNow(id); return c ? imgH(c, cls) : `<i class="${cls} ph"></i>`; };
// 预览大图：发送 / 添加到「我的表情」
const preview = (P, x, send) => {
  const b = $('.sks-pv', P.el); b.hidden = false;
  b.innerHTML = `<div class="sks-pc">${imgH({ th: x.img, alt: x.alt }, x.sm ? 'sm' : '')}${x.l ? `<p>${esc(x.l)}</p>` : ''}<nav><b data-a="skfav">添加到表情</b>${send ? '<b class="pri" data-a="sksend">发送</b>' : ''}</nav></div>`;
  b.onclick = e => e.target == b && (b.hidden = true); P._pv = x;
};
const pvActs = (gp, send, q) => ({ // gp：取页面（页面对象这时还没建好）
  sksend: () => { const P = gp(), x = P._pv; if (!x) return; const m = msgOf(x, q?.()); closeAll(); send(m); },
  skfav: () => { const P = gp(), x = P._pv; if (!x) return; S.assets.sticker.push({ id: uid(), name: x.l || q?.() || '表情', img: x.img }); save(); toast('已添加到「我的表情」'); $('.sks-pv', P.el).hidden = true; },
});
const st = []; // 打开着的表情页面；发送时一起关掉，回到聊天
const open = o => { st.push(o); const P = page({ ...o, onClose: () => { st.splice(st.indexOf(P), 1); o.onClose?.(); } }); return P; };
const closeAll = () => { while (st.length) back(); };

// 表情包组详情：横幅、名字、添加 / 已添加，下面是全部表情
export function packPage(id, send) {
  let pk = null;
  const grid = () => !pk ? '<div class="sks-st"><i class="spin"></i>正在打开表情包</div>' : !pk.items.length ? '<div class="sks-st">这个表情包暂时打不开，请稍后再试<b data-a="spre">重试</b></div>'
    : `<div class="sp-g ${pk.sm ? 'sm' : ''}">${pk.items.map((x, i) => `<div class="sks-i" data-a="spp" data-x="${i}">${imgH(x)}</div>`).join('')}</div>`;
  const P = open({
    title: '', cls: 'skspg sppg',
    body: () => { const m = packMeta(id); return `<div class="sp-ban">${coverH(id, 'sp-bi')}</div><div class="sp-hd"><div><b>${esc(m.name)}</b><small>${esc(m.desc)}</small><small class="src">来自 ${m.from}${countNow(id) ? ` · ${countNow(id)} 个表情` : ''}</small></div>${addBtn(id)}</div><div class="sp-gw">${grid()}</div><div class="sks-pv" hidden></div>`; },
    acts: {
      spadd: x => tog(x, P), spp: i => preview(P, pk.items[i], send), spre: () => load(),
      ...pvActs(() => P, send),
    },
  });
  const load = () => pack(id).then(p => { pk = p || { items: [] }; P.reb(); }, () => { pk = { items: [] }; P.reb(); });
  load(); return P;
}
const tog = async (id, P) => {
  if (has(id)) { if (!await ok(`把「${packMeta(id).name}」从我的表情里移除？`)) return; rmPack(id); }
  else { addPack(id); toast('已添加，在聊天的表情面板里就能用'); }
  P.reb(); st.forEach(p => p != P && p.reb?.());
};

// 表情商店：精选表情（可爱风优先）/ 更多表情
export function storePage(send) {
  let tab = 1;
  const row = id => { const m = packMeta(id), n = countNow(id); return `<div class="sp-row" data-a="spo" data-x="${id}">${coverH(id, 'sp-ic')}<div><b>${esc(m.name)}</b><small>${esc(m.desc)}${n ? ` · ${n}个` : ''}</small></div>${addBtn(id)}</div>`; };
  const P = open({
    title: () => `<div class="sp-tabs">${[[1, '精选表情'], [2, '更多表情']].map(([k, l]) => `<b data-a="sptab" data-x="${k}" class="${tab == k ? 'on' : ''}">${l}</b>`).join('')}</div>`, cls: 'skspg spstore',
    body: () => {
      const L = featured(tab);
      return `<div class="sks-bar fake" data-a="spq">${SRCH}<span>搜索表情</span></div>${tab == 1 ? `<div class="sp-car">${L.slice(0, 6).map(id => `<div class="sp-cc" data-a="spo" data-x="${id}">${coverH(id, 'sp-ci')}<b>${esc(packMeta(id).name)}</b></div>`).join('')}</div>` : ''}<h6 class="sp-h">${tab == 1 ? '精选' : '经典斗图'}</h6><div class="sp-list">${L.map(row).join('')}</div><p class="sp-cr">表情来自开源免费的 ChineseBQB 和 Waline 表情库，不会用到你的 API。</p>`;
    },
    acts: {
      sptab: k => { tab = +k; P.re(); }, spo: id => packPage(id, send), spadd: id => tog(id, P),
      spq: () => stkPage(send),
    },
  });
  loadBqb().then(() => P.el.isConnected && P.reb(), () => { });
  return P;
}

const HOT = ['摸摸头', '开心', '无语', '哭哭', '晚安', '爱你', '生气', '加油', '震惊', '委屈', '贴贴', '傲娇'];
// 搜索表情（仿微信）：输入关键词 → 「全部表情」一排图（库里的可爱风优先，不够再补网络表情）/「表情包」可以直接添加整组
export function stkPage(send) {
  let q = '', L = [], W = [], packs = [], tab = 'all', stt = '', werr = '', wpg = 1, wmore = true, ac = null, tm = 0;
  const grid = A => `<div class="sks-g">${A.map(x => `<div class="sks-i ${x.sm ? 'sm' : ''}" data-a="skp" data-x="${x._i}">${imgH(x)}</div>`).join('')}</div>`;
  const out = () => {
    if (!q) return `${S.stk.recent.length ? `<div class="sks-h"><span>最近在搜</span><b data-a="skclr">清空</b></div><div class="sks-ch">${S.stk.recent.map(x => `<b data-a="skq" data-x="${esc(x)}">${esc(x)}</b>`).join('')}</div>` : ''}<div class="sks-h"><span>大家都在搜</span></div><div class="sks-ch">${HOT.map(x => `<b data-a="skq" data-x="${x}">${x}</b>`).join('')}</div><div class="sks-go" data-a="skstore">精选表情 ›</div>`;
    const tabs = `<div class="sks-tab">${[['all', '全部表情'], ['pk', '表情包']].map(([k, l]) => `<b data-a="sktab" data-x="${k}" class="${tab == k ? 'on' : ''}">${l}</b>`).join('')}</div>`;
    if (stt == 'ld' && !L.length && !W.length) return tabs + `<div class="sks-st"><i class="spin"></i>正在搜索</div>`;
    if (tab == 'pk') return tabs + (packs.length ? `<div class="sp-list">${packs.map(id => { const m = packMeta(id); return `<div class="sp-row" data-a="spo" data-x="${id}">${coverH(id, 'sp-ic')}<div><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>${addBtn(id)}</div>`; }).join('')}</div>` : `<div class="sks-st">没有找到「${esc(q)}」相关的表情包</div>`);
    const all = [...L, ...W]; all.forEach((x, i) => x._i = i);
    if (!all.length) return tabs + (werr ? `<div class="sks-st">${esc(werr)}<small>表情库里没有，网络表情也没连上</small><b data-a="skre">重试</b></div>` : `<div class="sks-st">没有找到「${esc(q)}」相关的表情</div>`);
    return tabs + (L.length ? grid(L) : '') + (W.length ? `<div class="sks-sub">网络表情</div>${grid(W)}` : '') + (stt == 'ld' ? '<div class="sks-st sm"><i class="spin"></i></div>' : W.length && wmore ? '<div class="sks-more" data-a="skmore">加载更多</div>' : !W.length && L.length ? '<div class="sks-more" data-a="skmore">搜索更多网络表情</div>' : '');
  };
  const draw = () => { const o = $('.sks-out', P.el); o && (o.innerHTML = out()); };
  const web = async a => { try { const r = await webSearch(q, wpg, a.signal); if (a != ac) return; W = [...W, ...r]; wmore = r.length >= 8; } catch (e) { if (a == ac && !a.signal.aborted) werr = '网络表情没搜到：' + e.message; } };
  const go = async k => {
    k = String(k ?? q).trim(); clearTimeout(tm); ac?.abort(); q = k; L = []; W = []; packs = []; wpg = 1; wmore = true; werr = '';
    const ip = $('.sks-ip', P.el); ip && ip.value != q && (ip.value = q); $('.sks-bar', P.el)?.classList.toggle('has', !!q);
    if (!q) { stt = ''; return draw(); }
    stt = 'ld'; draw(); const a = ac = new AbortController();
    L = await localSearch(q); if (a != ac) return; packs = await packSearch(q); if (a != ac) return;
    stkRecent(q); draw();
    if (L.length < 16) await web(a); if (a != ac) return;
    stt = ''; draw();
  };
  const P = open({
    title: '搜索表情', cls: 'skspg',
    body: () => `<div class="sks-bar">${SRCH}<input class="sks-ip" placeholder="搜索表情" enterkeyhint="search" autocomplete="off"><b data-a="skx">×</b></div><div class="sks-out">${out()}</div><div class="sks-pv" hidden></div>`,
    after: el => {
      const ip = $('.sks-ip', el); ip.value = q;
      ip.oninput = () => { $('.sks-bar', el).classList.toggle('has', !!ip.value); clearTimeout(tm); tm = setTimeout(() => !ip.value.trim() ? go('') : ip.value.trim() != q && go(ip.value), 650); };
      ip.onkeydown = e => { if (e.key == 'Enter' && !e.isComposing) { e.preventDefault(); go(ip.value); ip.blur(); } };
      setTimeout(() => ip.isConnected && !q && ip.focus({ preventScroll: true }), 350);
    },
    acts: {
      skq: x => go(x), skre: () => go(), sktab: k => { tab = k; draw(); },
      skmore: async () => { if (stt == 'ld') return; W.length && wpg++; stt = 'ld'; draw(); await web(ac); stt = ''; draw(); },
      skx: () => { go(''); $('.sks-ip', P.el).focus(); },
      skclr: () => { S.stk.recent = []; save(); draw(); },
      skstore: () => storePage(send), spo: id => packPage(id, send), spadd: id => tog(id, P),
      skp: i => preview(P, [...L, ...W][i], send),
      ...pvActs(() => P, send, () => q),
    },
  });
  P.reb = draw; // 添加 / 移除表情包后刷新按钮状态，不清空输入框
  return P;
}
export { closeAll as closeStk };
