// 聊天 · 动态：微信朋友圈（毛玻璃卡片）/ QQ空间 / Moments（Kakao、LINE）+ 个人相册 + 生成动态弹窗
// 角色的动态和评论在同一次生成里带上 [翻译]（tr），点「查看翻译」展开；不额外调用
import { S, D, saveD, esc, uid, page, sheet, menu, form, toast, nm, rn, avOf, meObj, now, llm, json, sysCtx, task, emit, drop, pickImg, ok } from '../../core.js';
import { get, find, isMe, applyDelta, sty, FS, FN, lname } from './data.js';

const sv = (d, f) => `<svg viewBox="0 0 24 24" ${f ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;
export const FI = {
  wand: sv('<path d="m4 20 10.5-10.5M13 6l5 5"/><path d="M18.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6zM21 9l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4zM9.5 3l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/>'),
  cam: sv('<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.6-2.2h7.2L17.2 7h2.3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="currentColor" stroke="none"/><circle cx="12" cy="12.6" r="3.4" fill="none" stroke="#fff" stroke-width="1.8"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"/>'),
  heartF: sv('<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"/>', 1),
  cmt: sv('<path d="M12 4c4.7 0 8.5 3.2 8.5 7.2S16.7 18.4 12 18.4c-1 0-2-.1-2.9-.4L5 20l1-3.5C4.4 15.2 3.5 13.3 3.5 11.2 3.5 7.2 7.3 4 12 4Z"/>'),
  ring: sv('<circle cx="12" cy="11.5" r="8"/><path d="m17.6 17.2 2.9 2.9"/>'),
  thumb: sv('<path d="M7 10v10H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 10l4-6.5a2 2 0 0 1 3.6 1.4L14 9h5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.6 20H7"/>'),
  share: sv('<path d="M14 5l7 6.5-7 6.5v-4C8.5 14 5.5 16 3 20c.8-5.6 3.8-10 11-11z"/>'),
  send: sv('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
  edit: sv('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  del: sv('<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  more: sv('<circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/>', 1),
  eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
  img: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4.5 4"/>'),
  say: sv('<rect x="3.5" y="4.5" width="17" height="13" rx="2"/><path d="M8 21l3-3.5M8 11h.01M12 11h.01M16 11h.01"/>'),
  book: sv('<path d="M6 3.5h12v17H6zM10 3.5v7l2-1.5 2 1.5v-7"/>'),
  list: sv('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};

/* ---------- 小工具 ---------- */
const P = id => D().posts.find(p => p.id == id);
const who = n => !n || n == 'me' || isMe(n) ? meObj() : find(n, 'p') || { nick: n }; // 评论 / 点赞里存的是名字
const dn = n => esc(nm(who(n)));
const auOf = p => p.a == 'me' ? meObj() : get(p.a) || { nick: '已删除' };
const ago = ts => { const s = (now() - ts) / 6e4, d = new Date(ts); return s < 1 ? '刚刚' : s < 60 ? (s | 0) + '分钟前' : d.toDateString() == now().toDateString() ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}月${d.getDate()}日`; };
const OPEN = new Set(); // 点开了「查看翻译」的
// 正文 / 评论文字：有译文就在后面放「查看翻译」，点开在下面多一行中文；这个人的私聊关了自动翻译就直接显示中文
const tx = (t, tr, k, au) => { if (tr && au?.cfg?.trAuto === false) return esc(tr); const o = OPEN.has(k); return esc(t || '') + (tr ? ` <a class="f-tl" data-a="ftr" data-x="${k}">${o ? '收起翻译' : '查看翻译'}</a>${o ? `<span class="f-tz">${esc(tr)}</span>` : ''}` : ''); };
const media = p => p.url ? `<img class="f-img" src="${esc(p.url)}" loading="lazy">` : p.imgd ? `<div class="picd">🖼 ${esc(p.imgd)}</div>` : '';
const liked = p => p.likes.includes(nm(meObj()));
const cms = (p, tw) => p.cm.map((c, i) => `<div class="f-c"><b class="f-n">${dn(c.f)}</b>${c.to ? ` 回复 <b class="f-n">${dn(c.to)}</b>` : ''}：${tx(c.c, c.tr, p.id + ':' + i, who(c.f))} <a class="f-r" data-a="crep" data-x="${p.id}|${i}">回复</a></div>`).join('');
const lks = p => p.likes.length ? `<div class="f-lk">${FI.heartF}<span>${p.likes.map(dn).join('，')}</span></div>` : '';

/* ---------- 三种样式的一条动态 ---------- */
function postWx(p) { // 微信：毛玻璃卡片
  const au = auOf(p), box = p.likes.length || p.cm.length;
  return `<article class="fp wxp"><img class="av" src="${esc(avOf(au))}" data-a="pfeed" data-x="${p.a}"><div class="fp-m"><b class="f-n">${esc(nm(au))}</b><p class="fp-t">${tx(p.c, p.tr, p.id, au)}</p>${media(p)}
<div class="fp-a"><time>${ago(p.ts)}</time><b class="fp-mo" data-a="pmore" data-x="${p.id}">${FI.more}</b></div>${box ? `<div class="fp-c">${lks(p)}${p.cm.length ? `<div class="f-cs">${cms(p)}</div>` : ''}</div>` : ''}</div></article>`;
}
function postQq(p) { // QQ空间
  const au = auOf(p), me = meObj();
  return `<article class="fp qqp"><div class="fp-h"><img class="av" src="${esc(avOf(au))}" data-a="pfeed" data-x="${p.a}"><b class="f-n">${esc(nm(au))}</b><b class="fp-mo" data-a="pmore" data-x="${p.id}">${FI.more}</b></div>
<p class="fp-t">${tx(p.c, p.tr, p.id, au)}</p>${media(p)}<div class="fp-a"><time>${ago(p.ts)}</time><span class="fp-i"><b data-a="like" data-x="${p.id}" class="${liked(p) ? 'on' : ''}">${FI.thumb}</b><b data-a="cmt" data-x="${p.id}">${FI.cmt}</b><b data-a="pshare" data-x="${p.id}">${FI.share}</b></span></div>
${lks(p)}${p.cm.length ? `<div class="f-cs">${cms(p)}</div>` : ''}<div class="qq-in" data-a="cmt" data-x="${p.id}"><img class="av" src="${esc(avOf(me))}">说点什么吧...</div></article>`;
}
function postTw(p) { // Moments（Kakao / LINE）
  const au = auOf(p), n = p.likes.length, lk = n ? `<p class="tw-lk">Liked by <b>${p.likes.slice(0, 2).map(dn).join(', ')}</b>${n > 2 || p.lx ? ` and <b>${(n > 2 ? n - 2 : 0) + (p.lx || 0)} others</b>` : ''}</p>` : '';
  const only = !p.url && !p.imgd;
  return `<article class="fp twp"><div class="fp-h"><i class="tw-r" data-a="pfeed" data-x="${p.a}"><img class="av" src="${esc(avOf(au))}"></i><b class="f-n">${esc(nm(au))}</b></div>
${only ? `<div class="tw-card">${tx(p.c, p.tr, p.id, au)}</div>` : `<p class="fp-t">${tx(p.c, p.tr, p.id, au)}</p>${media(p)}`}
<div class="tw-ic"><b data-a="like" data-x="${p.id}" class="${liked(p) ? 'on' : ''}">${liked(p) ? FI.heartF : FI.heart}</b><b data-a="cmt" data-x="${p.id}">${FI.ring}</b><i></i><b data-a="pshare" data-x="${p.id}">${FI.send}</b><b data-a="pgc" data-x="${p.id}">${FI.wand}</b><b data-a="pedit" data-x="${p.id}">${FI.edit}</b><b data-a="pdel" data-x="${p.id}">${FI.del}</b></div>
${lk}${p.cm.length ? `<div class="f-cs">${cms(p)}</div>` : ''}<time class="tw-t">${ago(p.ts)}</time></article>`;
}
const ONE = { wx: postWx, qq: postQq, tw: postTw };

/* ---------- 整页 ---------- */
const bg = u => u ? `style="background-image:url('${esc(u)}')"` : '';
export function feed(aid, st = S.style) {
  const fs = FS[st], u = aid && aid != 'me' ? get(aid) : meObj(), mine = !aid || aid == 'me', ps = D().posts.filter(p => !aid || p.a == aid).sort((a, b) => b.ts - a.ts);
  const cov = mine ? D().me.cover : u?.cover, cid = mine ? 'me' : aid, list = ps.map(ONE[fs]).join('') || '<p class="f-e">还没有动态</p>';
  if (fs == 'wx' && aid) return album(u, aid, ps, cov);
  if (fs == 'wx') return `<div class="feed f-wx2"><i class="f-bg" ${bg(D().me.fbg || cov)}></i><div class="fw2-cv" data-a="fcov" data-x="${cid}" ${bg(cov)}><b>${esc(nm(u))}</b><img class="av" src="${esc(avOf(u))}" data-a="myfeed"></div><div class="fw2-l">${list}</div></div>`;
  if (fs == 'qq') {
    const me = D().me, n = D().posts.filter(p => p.a == (mine ? 'me' : aid)).length; me.qv ||= 1000 + Math.random() * 900 | 0;
    return `<div class="feed f-qq2"><div class="qz-h" data-a="fcov" data-x="${cid}" ${bg(cov)}><div class="qz-u"><img class="av" src="${esc(avOf(u))}" data-a="${mine ? 'myfeed' : 'pfeed'}" data-x="${cid}"><div><b>${esc(nm(u))}</b><p><em class="qz-lv">LV${1 + (n / 5 | 0)}</em>${u?.sign ? `<em class="qz-sg">${esc(u.sign)}</em>` : ''}</p><small>${FI.eye}总量 ${me.qv + n * 37} · 说说 ${n}</small></div></div>
${mine ? `<div class="qz-n"><b data-a="post">${FI.say}<span>说说</span></b><b data-a="post" data-x="img">${FI.img}<span>发图</span></b><b data-a="myfeed">${FI.book}<span>相册</span></b><b data-a="fgen">${FI.wand}<span>生成</span></b><b data-a="fmore">${FI.list}<span>更多</span></b></div><div class="qz-in" data-a="post">分享新鲜事...<b data-a="post" data-x="img">${FI.img}</b></div>` : ''}</div>${list}</div>`;
  }
  return `<div class="feed f-tw2"><div class="tw-h"><b>${mine ? 'Moments' : esc(nm(u))}</b><i class="tw-r" data-a="${mine ? 'myfeed' : 'fcov'}" data-x="${cid}"><img class="av" src="${esc(avOf(u))}"></i></div>${list}</div>`;
}
// 个人朋友圈（仿微信「个人相册」）：深色封面 + 名字头像，按天分组，左边日期、右边灰底文字 / 配图
const dayOf = ts => { const d = new Date(ts), t = now(), y = new Date(+t - 864e5); return d.toDateString() == t.toDateString() ? ['今天'] : d.toDateString() == y.toDateString() ? ['昨天'] : [String(d.getDate()).padStart(2, '0'), d.getMonth() + 1 + '月']; };
function album(u, aid, ps, cov) {
  const days = []; ps.forEach(p => { const k = new Date(p.ts).toDateString(), l = days.at(-1); l && l.k == k ? l.ps.push(p) : days.push({ k, d: dayOf(p.ts), ps: [p] }); });
  const it = p => `<div class="al-p ${p.url ? 'im' : ''}" data-a="apost" data-x="${p.id}">${p.url ? `<img src="${esc(p.url)}">` : ''}<p>${esc(p.tr && auOf(p).cfg?.trAuto === false ? p.tr : p.c || (p.imgd ? '[图片] ' + p.imgd : ''))}</p></div>`;
  return `<div class="album"><div class="al-cv" data-a="fcov" data-x="${aid}" ${bg(cov)}><b>${esc(nm(u))}</b><img class="av" src="${esc(avOf(u))}"></div><p class="al-sg">${esc(u?.sign || '这个人很神秘，什么也没留下~')}</p>
${days.map(g => `<div class="al-d"><div class="al-t"><b>${g.d[0]}</b>${g.d[1] ? `<small>${g.d[1]}</small>` : ''}</div><div class="al-l">${g.ps.map(it).join('')}</div></div>`).join('') || `<p class="al-e">${aid == 'me' ? '你' : 'TA'} 还没有发过朋友圈</p>`}</div>`;
}
// 顶栏右边：生成（魔法棒）+ 发动态（相机）
export const feedRight = () => `<b data-a="fgen">${FI.wand}</b><b data-a="post">${FI.cam}</b>`;

/* ---------- 生成动态：选条数、必定出现的人、只让选中的人发 ---------- */
const friends = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0);
function genDlg(pre) {
  const st = { n: 3, sel: new Set(pre ? [pre] : []), only: !!pre };
  const sum = () => { const ns = [...st.sel].map(i => nm(get(i))).filter(Boolean); return `${st.n} 条，${!ns.length ? '随机挑人发' : st.only ? `只让 ${ns.join('、')} 发` : `${ns.join('、')} 必定出现，其余随机`}`; };
  const s = sheet({
    title: '生成动态', noBack: 1, cls: 'gdlg', body: () => `<h6>生成条数</h6><div class="gd-n">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<b data-a="gdn" data-x="${n}" class="${st.n == n ? 'on' : ''}">${n}</b>`).join('')}</div>
<h6>必定出现的人 <small>不选 = 随机</small></h6><div class="gd-p">${friends().map(c => `<div data-a="gdp" data-x="${c.id}" class="${st.sel.has(c.id) ? 'on' : ''}"><img src="${esc(avOf(c))}"><span>${esc(nm(c))}</span></div>`).join('')}</div>
<div class="gd-o ${st.only ? 'on' : ''}" data-a="gdo"><i></i>只让选中的人发</div><p class="gd-s">${esc(sum())}</p><div class="gd-b"><button data-a="gdx">取消</button><button class="pri" data-a="gdg">生成</button></div>`,
    acts: { gdn: n => { st.n = +n; s.re(); }, gdp: id => { st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); s.re(); }, gdo: () => { st.only = !st.only; s.re(); }, gdx: () => s.close(), gdg: () => { s.close(); genFeed(st); } },
  });
}
// 每个人用什么语言写（跟他私聊里的「角色消息翻译为」）：外语正文 + 中文译文一起生成
const langRule = L => { const r = L.map(c => [c, c.cfg?.lang]).filter(([, l]) => l && l != 'zh-TW'); return r.length ? `【语言】${r.map(([c, l]) => `${rn(c)}用${lname(l)}`).join('；')}：这些人的正文和评论 text 直接用该语言写，tr 写简体中文译文（贴合说话人的人设、口癖和语气，口语自然）；其他人用中文，tr 留空。` : '【语言】都用简体中文，tr 留空。'; };
const JS = '{"posts":[{"author":"真实姓名","text":"正文","tr":"","img":"配图画面描述(可空)","likes":["名字"],"comments":[{"from":"名字","text":"","tr":"","to":"回复谁(可空)"}]}]}';
function genFeed(st) {
  const ns = [...st.sel].map(get).filter(Boolean), who = !ns.length ? '从联系人里挑合适的人发' : st.only ? `只能由这些人发：${ns.map(rn).join('、')}` : `这些人每人至少发一条：${ns.map(rn).join('、')}，其余从联系人里挑`;
  task('正在生成动态', async sg => {
    const ps = json(await llm(await sysCtx(), `生成 ${st.n} 条贴合人设与当前剧情的${FN[S.style]}动态。${who}。可附带其他联系人的点赞和评论，评论之间可以互相回复（to 写被回复的人），可以提到${meObj().nick}。\n${langRule(friends())}\n只输出JSON：${JS}`, '生成动态', sg))?.posts;
    if (!Array.isArray(ps)) throw Error('返回格式不对'); applyDelta({ posts: ps }); return `新增 ${ps.length} 条动态`;
  });
}
// 给一条动态生成 / 续写评论（我评论后、或点魔法棒）
function genCmt(p, why) {
  const au = auOf(p), L = friends();
  task('正在生成评论', async sg => {
    const r = json(await llm(await sysCtx(), `${p.a == 'me' ? meObj().nick : rn(au)}发了动态：“${p.c}”${p.tr ? `（${p.tr}）` : ''}\n已有评论：${p.cm.map(c => `${nm(who(c.f))}${c.to ? '回复' + nm(who(c.to)) : ''}：${c.c}`).join('；') || '无'}\n${why}\n${langRule(L)}\n只输出JSON：{"comments":[{"from":"名字","text":"","tr":"","to":"回复谁(可空)"}],"likes":["名字"]}`, '动态评论', sg));
    r?.comments?.forEach(c => c.text && p.cm.push({ f: c.from, c: c.text, tr: c.tr || '', ...(c.to && { to: c.to }) })); r?.likes?.forEach(n => n && !p.likes.includes(n) && p.likes.push(n)); saveD(); emit('chat'); return '收到评论';
  });
}

/* ---------- 操作 ---------- */
const share = async p => { const to = await menu(D().chats.filter(c => c.fr !== 0 || c.type == 'g').map(c => [c.id, esc(nm(c))]), '分享到…'); const T = to && get(to); if (!T) return; const n = nm(auOf(p)); T.msgs.push({ f: 'me', t: 'rec', c: `${n}的${FN[S.style]}`, rec: [{ n, c: p.c + (p.tr ? `（${p.tr}）` : '') }], ts: +now() }); saveD(); emit('chat'); toast(`已分享给 ${nm(T)}`); };
export const FA = {
  fcov: async (x, t, e, pg) => { const o = x == 'me' ? D().me : get(x); if (!o) return; const v = await pickImg(1080, 'cover'); if (v == null) return; drop(o.cover); o.cover = v; saveD(); emit('chat'); pg?.re?.(); },
  fmore: async () => { const k = await menu([['cov', '换封面'], ['bg', '换动态背景']]); if (!k) return; const v = await pickImg(1080, 'cover'); if (v == null) return; const m = D().me, f = k == 'cov' ? 'cover' : 'fbg'; drop(m[f]); m[f] = v; saveD(); emit('chat'); },
  ftr: k => { OPEN.has(k) ? OPEN.delete(k) : OPEN.add(k); emit('chat'); },
  like: id => { const p = P(id), me = nm(meObj()); if (!p) return; p.likes = p.likes.includes(me) ? p.likes.filter(x => x != me) : [...p.likes, me]; saveD(); emit('chat'); },
  cmt: async id => { const p = P(id); if (!p) return; const r = await form('评论', [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c }); saveD(); emit('chat'); p.a != 'me' && genCmt(p, `请生成${rn(auOf(p))}（以及可能路过的联系人）对${meObj().nick}这条评论的回复 1-2 条。`); },
  crep: async x => { const [id, i] = x.split('|'), p = P(id), c = p?.cm[+i]; if (!c) return; const r = await form(`回复 ${nm(who(c.f))}`, [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c, to: c.f }); saveD(); emit('chat'); isMe(c.f) || genCmt(p, `${meObj().nick}回复了${nm(who(c.f))}，请生成${nm(who(c.f))}（以及可能的其他人）的回应 1-2 条。`); },
  pmore: async id => { const p = P(id); if (!p) return; const k = await menu([...(FS[S.style] == 'wx' ? [['like', liked(p) ? '取消赞' : '赞'], ['cmt', '评论']] : []), ['pshare', '分享'], ['pgc', '生成评论'], ['pedit', '编辑'], ['pdel', '删除', 'danger']]); k && FA[k](id); },
  pshare: id => { const p = P(id); p && share(p); },
  pgc: id => { const p = P(id); p && genCmt(p, '请让联系人们按人设给这条动态点赞、评论，评论之间可以互相回复，2-4 条。'); },
  pedit: async id => { const p = P(id); if (!p) return; const r = await form('编辑动态', [['c', '正文', 'area'], ...(p.tr ? [['tr', '中文译文', 'area']] : [])], { c: p.c, tr: p.tr }); if (!r) return; p.c = r.c || ''; p.tr != null && (p.tr = r.tr || ''); saveD(); emit('chat'); },
  pdel: async id => { if (!await ok('删除这条动态？')) return; drop(D().posts.filter(p => p.id == id)); D().posts = D().posts.filter(p => p.id != id); saveD(); emit('chat'); },
  pfeed: id => openFeed(id), myfeed: () => openFeed('me'),
  post: async x => { const r = await form('发表动态', [['c', '这一刻的想法...', 'area'], ['url', '配图', 'img']]); if (!r?.c && !r?.url) return; D().posts.unshift({ id: uid(), a: 'me', c: r.c || '', url: r.url, ts: +now(), likes: [], cm: [] }); saveD(); emit('chat'); },
  fgen: (x, t, e, pg) => genDlg(pg?.aid && pg.aid != 'me' ? pg.aid : ''),
  apost: id => { const p = P(id); p && page({ title: '详情', live: 1, cls: 'feedpg', body: () => P(id) ? `<div class="feed f-wx2 one">${postWx(P(id))}</div>` : '<p class="f-e">已删除</p>', acts: FA }); },
  amore: async (x, t, e, pg) => { const k = await menu(pg.aid == 'me' ? [['post', '发朋友圈'], ['fgen', '生成动态']] : [['fgen', `让${esc(nm(get(pg.aid)))}发条朋友圈`]]); k && FA[k](x, t, e, pg); },
};
export function openFeed(aid) {
  const st = aid && aid != 'me' ? sty(get(aid)) : S.style, fs = FS[st], al = fs == 'wx';
  page({ title: '', aid, live: 1, cls: `feedpg st-${st} fs-${fs}${al ? ' alpg' : ''}`, right: () => al ? `<b data-a="amore">${FI.more}</b>` : feedRight(), body: () => feed(aid, st), acts: FA });
}
