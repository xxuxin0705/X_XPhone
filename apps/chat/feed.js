import { FEED_ICONS } from './feed-icons.js';
import { MOMENTS_CORE, MOMENTS_FMT, normalizeMoments } from './feed-generation.js';
import { regMod, mp, NOAI } from '../../mods.js';
regMod({ k: 'chat.feed', app: '聊天', n: '动态', def: MOMENTS_CORE, vars: [['currentStoryTime', '剧情时间'], ['contactsInfo', '联系人列表'], ['memoryInfo', '记忆']] });
regMod({ k: 'chat.cmt', app: '聊天', n: '动态评论', def: '评论和点赞的人要符合各自人设和与发帖人的亲疏；评论口语、简短，像真人随手回复，可以互相接话、玩梗、拌嘴。' });
// 聊天 · 动态：微信朋友圈（毛玻璃卡片）/ QQ空间 / Moments（Kakao、LINE）+ 个人相册 + 生成动态弹窗
// 角色的动态和评论在同一次生成里带上 [翻译]（tr），点「查看翻译」展开；不额外调用
import { S, D, saveD, esc, uid, page, sheet, menu, form, toast, nm, rn, avOf, meObj, now, llm, json, sysCtx, task, emit, drop, pickImg, ok, genImg, ui } from '../../core.js';
import { get, find, isMe, sty, FS, FN, lname, grpNames, canSee } from './data.js';
import { allTags } from './tags.js';

export const FI = {
  wand: FEED_ICONS['wand-magic-sparkles'],
  cam: FEED_ICONS.camera,
  heart: FEED_ICONS.heart,
  heartF: FEED_ICONS.heartF,
  cmt: FEED_ICONS.cmt,
  ring: FEED_ICONS.ring,
  thumb: FEED_ICONS.thumb,
  share: FEED_ICONS.share,
  send: FEED_ICONS.send,
  edit: FEED_ICONS.edit,
  del: FEED_ICONS.del,
  more: FEED_ICONS.more,
  eye: FEED_ICONS.eye,
  img: FEED_ICONS.img,
  say: FEED_ICONS.say,
  book: FEED_ICONS.book,
  list: FEED_ICONS.list,
};

/* ---------- 小工具 ---------- */
const P = id => D().posts.find(p => p.id == id);
const who = n => !n || n == 'me' || isMe(n) ? meObj() : find(n, 'p') || { nick: n }; // 评论 / 点赞里存的是名字
const dn = n => esc(nm(who(n)));
const auOf = p => p.a == 'me' ? meObj() : get(p.a) || { nick: '已删除' };
const ago = ts => { const s = (now() - ts) / 6e4, d = new Date(ts); return s < 1 ? '刚刚' : s < 60 ? (s | 0) + '分钟前' : d.toDateString() == now().toDateString() ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}月${d.getDate()}日`; };
const OPEN = new Set(); // 点开了「查看翻译」的
// 正文 / 评论文字：有译文就在后面放「查看翻译」，点开在下面多一行中文；这个人的私聊关了自动翻译就直接显示中文
// 本来就是中文的（没有假名 / 韩文 / 俄文 / 泰文，也不是整段英文）不算外语，不放「查看翻译」
const foreign = t => /[぀-ヿ가-힯Ѐ-ӿ฀-๿]/.test(t) || /[A-Za-z]{3,}/.test(t) && !/[一-鿿]/.test(t);
// 点「查看翻译」：原文直接换成中文（不是在下面多一行），再点「显示原文」换回去
const tx = (t, tr, k, au) => { if (!tr || tr == t || !foreign(t || '')) return esc(t || ''); if (au?.cfg?.trAuto === false) return esc(tr); const o = OPEN.has(k); return esc(o ? tr : t || '') + ` <a class="f-tl" data-a="ftr" data-x="${k}">${o ? '显示原文' : '查看翻译'}</a>`; };
const liked = p => p.likes.includes(nm(meObj()));
// 评论（照微信）：后面不放「回复」「删除」，只有查看翻译 / 显示原文；点别人的评论就是回复 TA，点自己的评论弹出删除
const cms = (p, tw) => p.cm.map((c, i) => `<div class="f-c" data-a="${isMe(c.f) ? 'fcme' : 'crep'}" data-x="${p.id}|${i}"><b class="f-n">${dn(c.f)}</b>${c.to ? ` 回复 <b class="f-n">${dn(c.to)}</b>` : ''}：${tx(c.c, c.tr, p.id + ':' + i, who(c.f))}</div>`).join('');

/* ---------- 三种样式的一条动态 ---------- */
export const postImages = p => p.images?.length ? p.images : p.url ? [{url:p.url}] : p.imgd ? [{description:p.imgd}] : [];
const imgs = p => { const list=postImages(p); return list.length ? `<div class="mo-images n${list.length}">${list.map((v,i)=>`<button type="button" class="mo-photo" data-a="fphoto" data-x="${p.id}|${i}">${v.url ? `<img src="${esc(v.url)}" loading="lazy" alt="${esc(v.description || '动态配图')}">` : `<span>${FI.img}<small>${esc(v.description || v.prompt)}</small></span>`}</button>`).join('')}</div>${p.location ? `<div class="mo-location">${esc(p.location)}</div>` : ''}` : p.location ? `<div class="mo-location">${esc(p.location)}</div>` : ''; };

const cmBox = p => p.likes.length || p.cm.length ? `<div class="mo-ia">${p.likes.length ? `<div class="mo-lk">${FI.heart}<span>${p.likes.map(dn).join('，')}</span></div>` : ''}${p.cm.length ? `<div class="mo-cs">${cms(p)}</div>` : ''}</div>` : '';
function postWx(p) { // 微信朋友圈：白底列表，蓝名字，右下 ·· 按钮，灰底点赞评论区
  const au = auOf(p);
  return `<article class="mo wxm"><img class="av" src="${esc(avOf(au))}" data-a="pfeed" data-x="${p.a}"><div class="mo-m"><b class="mo-n" data-a="pfeed" data-x="${p.a}">${esc(nm(au))}</b>${p.c ? `<p class="mo-t">${tx(p.c, p.tr, p.id, au)}</p>` : ''}${imgs(p)}
<div class="mo-f"><time>${ago(p.ts)}</time>${p.a == 'me' ? `<a class="mo-del" data-a="pdel" data-x="${p.id}">删除</a>` : ''}<b class="mo-ab" data-a="pmore" data-lp="pmlp" data-x="${p.id}"><svg viewBox="0 0 24 24" fill="#576b95"><circle cx="8.3" cy="12" r="2.1"/><circle cx="15.7" cy="12" r="2.1"/></svg></b></div>${cmBox(p)}</div></article>`;
}
function postQq(p) { // QQ空间：圆头像 + 名字，正文，时间和 赞 / 评论 / 分享 同一行，下面“说点什么吧...”
  const au = auOf(p), me = meObj();
  return `<article class="mo qqm"><img class="av" src="${esc(avOf(au))}" data-a="pfeed" data-x="${p.a}"><b class="mo-n" data-a="pfeed" data-x="${p.a}">${esc(nm(au))}</b><b class="mo-ab" data-a="pmore" data-x="${p.id}">${FI.more}</b>
${p.c ? `<p class="mo-t">${tx(p.c, p.tr, p.id, au)}</p>` : ''}${imgs(p)}<time>${ago(p.ts)}</time><span class="qq-acts"><b data-a="like" data-x="${p.id}" class="${liked(p) ? 'on' : ''}">${FI.thumb}</b><b data-a="cmt" data-x="${p.id}">${FI.cmt}</b><b data-a="pshare" data-x="${p.id}">${FI.share}</b></span>
${cmBox(p)}<div class="qq-say" data-a="cmt" data-x="${p.id}"><img src="${esc(avOf(me))}"><span>说点什么吧...</span></div></article>`;
}
function postTw(p) { // Moments：头像（红圈）+ 名字 → 文字卡片 / 大图 → 赞 评论 … 分享 魔法棒 编辑 删除 → Liked by → 评论 → 时间
  const au = auOf(p), n = p.likes.length, t = p.c ? tx(p.c, p.tr, p.id, au) : '', has = postImages(p).length;
  const lk = n ? `<div class="ins-lk">Liked by <b>${p.likes.slice(0, 2).map(dn).join(', ')}</b>${n > 2 || p.lx ? ` and <b>${(n > 2 ? n - 2 : 0) + (p.lx || 0)} others</b>` : ''}</div>` : '';
  return `<article class="ins"><div class="ins-h"><i class="ins-av" data-a="pfeed" data-x="${p.a}"><img src="${esc(avOf(au))}"></i><b data-a="pfeed" data-x="${p.a}">${esc(nm(au))}</b></div>
${has && t ? `<div class="ins-cap">${t}</div>` : ''}${has ? `<div class="ins-md">${imgs(p)}</div>` : t ? `<div class="ins-card">${t}</div>` : ''}
<div class="ins-acts"><b data-a="like" data-x="${p.id}" class="${liked(p) ? 'on' : ''}">${liked(p) ? FI.heartF : FI.heart}</b><b data-a="cmt" data-x="${p.id}">${FI.ring}</b><i></i><b class="sub" data-a="pshare" data-x="${p.id}">${FI.send}</b><b class="sub" data-a="pgc" data-x="${p.id}">${FI.wand}</b><b class="sub" data-a="pedit" data-x="${p.id}">${FI.edit}</b><b class="sub" data-a="pdel" data-x="${p.id}">${FI.del}</b></div>
${lk}${p.cm.length ? `<div class="ins-cs">${cms(p)}</div>` : ''}<time class="ins-t">${ago(p.ts)}</time></article>`;
}
const ONE = { wx: postWx, qq: postQq, tw: postTw };

/* ---------- 整页 ---------- */
const bg = u => u ? `style="background-image:url('${esc(u)}')"` : '';
export function feed(aid, st = S.style) {
  const fs = FS[st], u = aid && aid != 'me' ? get(aid) : meObj(), mine = !aid || aid == 'me', ps = D().posts.filter(p => !aid || p.a == aid).sort((a, b) => b.ts - a.ts);
  const cov = mine ? D().me.cover : u?.cover, cid = mine ? 'me' : aid, list = ps.map(ONE[fs]).join('') || `<p class="mo-e">${fs == 'tw' ? 'No posts yet' : '朋友圈空空如也'}</p>`;
  if (fs == 'wx' && aid) return album(u, aid, ps, cov);
  if (fs == 'wx') { const fb = D().me.fbg; return `<div class="feed mz-wx ${fb ? 'has-bg' : ''}" ${bg(fb)}><div class="mo-cv" data-a="fcov" data-x="${cid}" ${bg(cov)}><div class="mo-cu"><b>${esc(nm(u))}</b><img src="${esc(avOf(u))}" data-a="myfeed"></div></div>${list}</div>`; }
  if (fs == 'qq') {
    const n = D().posts.filter(p => p.a == cid).length, tot = ps.reduce((a, p) => a + 1 + p.likes.length + p.cm.length, 0) * 7 + 100, lv = Math.max(1, Math.min(64, (n / 3 | 0) + 1));
    return `<div class="feed mz-qq"><div class="mz-head" data-a="fcov" data-x="${cid}" ${cov ? `style="--mz-cover:url('${esc(cov)}')"` : ''}><div class="mz-pf"><img class="mz-av" src="${esc(avOf(u))}" data-a="${mine ? 'myfeed' : 'pfeed'}" data-x="${cid}"><div class="mz-in"><b class="mz-nm">${esc(nm(u))}</b><p class="mz-bd"><em class="mz-lv">LV${lv}</em><em class="mz-tag">${esc(u?.sign || '这个人很懒，什么都没写')}</em></p><p class="mz-tot">${FI.eye}总量 <b>${tot}</b><i>·</i>说说 <b>${n}</b></p></div></div>
${mine ? `<div class="mz-ics"><b data-a="post">${FI.say}<span>说说</span></b><b data-a="post" data-x="img">${FI.img}<span>发图</span></b><b data-a="myfeed">${FI.book}<span>相册</span></b><b data-a="fgen">${FI.wand}<span>生成</span></b><b data-a="fmore">${FI.list}<span>更多</span></b></div><div class="mz-share" data-a="post"><span>分享新鲜事...</span>${FI.img}</div>` : ''}</div>${list}</div>`;
  }
  return `<div class="feed mz-tw"><div class="ins-top"><b>${mine ? 'Moments' : esc(nm(u))}</b><i class="ins-me" data-a="${mine ? 'myfeed' : 'fcov'}" data-x="${cid}"><img src="${esc(avOf(u))}"></i></div>${list}</div>`;
}
// 个人朋友圈（仿微信「个人相册」）：深色封面 + 名字头像，按天分组，左边日期、右边灰底文字 / 配图
const dayOf = ts => { const d = new Date(ts), t = now(), y = new Date(+t - 864e5); return d.toDateString() == t.toDateString() ? ['今天'] : d.toDateString() == y.toDateString() ? ['昨天'] : [String(d.getDate()).padStart(2, '0'), d.getMonth() + 1 + '月']; };
function album(u, aid, ps, cov) {
  const days = []; ps.forEach(p => { const k = new Date(p.ts).toDateString(), l = days.at(-1); l && l.k == k ? l.ps.push(p) : days.push({ k, d: dayOf(p.ts), ps: [p] }); });
  const it = p => { const first=postImages(p)[0]?.url; return `<div class="al-p ${first ? 'im' : ''}" data-a="apost" data-x="${p.id}">${first ? `<img src="${esc(first)}">` : ''}<p>${esc(p.tr && auOf(p).cfg?.trAuto === false ? p.tr : p.c || (p.imgd ? '[图片] ' + p.imgd : ''))}</p></div>`; };
  return `<div class="album"><div class="al-cv" data-a="fcov" data-x="${aid}" ${bg(cov)}><b>${esc(nm(u))}</b><img class="av" src="${esc(avOf(u))}"></div><p class="al-sg">${esc(u?.sign || '这个人很神秘，什么也没留下~')}</p>
${days.map(g => `<div class="al-d"><div class="al-t"><b>${g.d[0]}</b>${g.d[1] ? `<small>${g.d[1]}</small>` : ''}</div><div class="al-l">${g.ps.map(it).join('')}</div></div>`).join('') || `<p class="al-e">${aid == 'me' ? '你' : 'TA'} 还没有发过朋友圈</p>`}</div>`;
}
// 顶栏右边：生成（魔法棒）+ 发动态（相机）
export const feedRight = () => `<button type="button" class="feed-header-btn" data-a="fgen" aria-label="生成朋友圈">${FI.wand}</button><button type="button" class="feed-header-btn" data-a="fpost" aria-label="发朋友圈">${FI.cam}</button>`;

/* ---------- 生成动态：选条数、必定出现的人、只让选中的人发 ---------- */
const friends = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0);
let generating = false;
const pendingComments = new Set();
function genDlg(pre) {
  if (generating) return toast('正在生成中，请稍等');
  if (!friends().length) return toast('请先添加联系人');
  const st = { n: 3, sel: new Set(pre ? [pre] : []), only: !!pre };
  const sum = () => { const ns = [...st.sel].map(i => nm(get(i))).filter(Boolean); return `${st.n} 条，${!ns.length ? '随机挑人发' : st.only ? `只让 ${ns.join('、')} 发` : `${ns.join('、')} 必定出现，其余随机`}`; };
  const s = sheet({
    title: '生成动态', noBack: 1, cls: 'gdlg', body: () => `<h6>生成条数</h6><div class="gd-n">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<b data-a="gdn" data-x="${n}" class="${st.n == n ? 'on' : ''}">${n}</b>`).join('')}</div>
<h6>必定出现的人 <small>不选 = 随机</small></h6><div class="gd-p">${friends().map(c => `<div data-a="gdp" data-x="${c.id}" class="${st.sel.has(c.id) ? 'on' : ''}"><img src="${esc(avOf(c))}"><span>${esc(nm(c))}</span></div>`).join('')}</div>
<div class="gd-o ${st.only ? 'on' : ''}" data-a="gdo"><i></i>只让选中的人发</div><p class="gd-s">${esc(sum())}</p><div class="gd-b"><button data-a="gdx">取消</button><button class="pri" data-a="gdg">生成</button></div>`,
    acts: { gdn: n => { st.n = +n; s.re(); }, gdp: id => { st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); if(st.sel.size > st.n) st.n = Math.min(10, st.sel.size); s.re(); }, gdo: () => { if (!st.sel.size) return; st.only = !st.only; s.re(); }, gdx: () => s.close(), gdg: () => { s.close(); genFeed(st); } },
  });
}
// 每个人用什么语言写（跟他私聊里的「角色消息翻译为」）：外语正文 + 中文译文一起生成
const langRule = L => { const r = L.map(c => [c, c.cfg?.lang]).filter(([, l]) => l && l != 'zh-TW'); return r.length ? `【语言】${r.map(([c, l]) => `${rn(c)}用${lname(l)}`).join('；')}：这些人的正文和评论 text 直接用该语言写，tr 写简体中文译文（贴合说话人的人设、口癖和语气，口语自然）；其他人用中文，tr 留空。` : '【语言】都用简体中文，tr 留空。'; };

function genFeed(st) {
  if (generating) return;
  const data = D(), selected = [...st.sel].map(get).filter(Boolean), names=selected.map(rn), contacts=friends();
  if(!contacts.length)return toast('请先添加联系人');
  generating = true;
  const V = { currentStoryTime: now().toLocaleString('zh-CN'), memoryInfo: '以提供的剧情和世界书为准', contactsInfo: contacts.map(c=>`${rn(c)}：${c.desc || c.sign || ''}`).join('；'), user: nm(meObj()) };
  const prompt = mp('chat.feed', V) + '\n' + NOAI + '\n' + Object.entries(V).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), MOMENTS_FMT);
  return task('正在生成动态', async sg => {
    try {
      const only = st.only && names.length > 0;
      const result = json(await llm(await sysCtx(), `${prompt}\n${langRule(contacts)}\n【本次数量】只生成 ${st.n} 条动态。\n【配图不是必须的】很多动态只发文字，images 写空数组。\n${names.length ? only ? '【指定发布者】只能由这些好友发布：'+names.join('、') : '【必定出现】这些好友必须各发至少一条：'+names.join('、') : ''}`, '生成动态', sg, { mod: 'chat.feed' }));
      if(D() !== data) throw Error('聊天已切换，本次结果未写入');
      const posts=normalizeMoments(result,contacts,{n:st.n,names,only},nm(meObj()),+now());
      if(!posts.length)throw Error('这次没有生成出内容，再试一次吧');
      const split = text => { const m=String(text).match(/^([\s\S]*?)\s*\[翻译[:：]([^\]]*)\]\s*$/);return m ? [m[1].trim(),m[2].trim()] : [text,'']; };
      const added=posts.map(p=> { const [c,tr]=split(p.text); return {id:uid(),a:contacts.find(c=>[rn(c),nm(c)].includes(p.author)).id,c,tr:p.tr||tr,ts:p.ts,location:p.location,images:p.images.map(v=>/^https?:\/\/|^data:image\/|^\//.test(v)?{url:v}:{description:v,prompt:(v.match(/[（(]([^（）()]*)[）)]\s*$/)?.[1] || v)}),likes:p.likes,cm:p.comments.map(v=>{const [c,tr]=split(v.text);return {f:v.from,c,tr:v.tr||tr,...(v.to?{to:v.to}:{})};})}; });
      data.posts.unshift(...added); saveD();emit('chat');return `新增 ${added.length} 条动态`;
    } finally {generating=false;}
  });
}
// 给一条动态生成 / 续写评论（我评论后、或点魔法棒）
function genCmt(p, why) {
  if (pendingComments.has(p.id)) return toast('正在生成评论');
  const data = D(), au = auOf(p), L = friends().filter(c => p.a != 'me' || canSee(p, c)); // 我设了分组可见：看不到的人不会来评论 / 点赞
  pendingComments.add(p.id);
  return task('正在生成评论', async sg => {
    try {
    const r = json(await llm(await sysCtx(), `${p.a == 'me' ? meObj().nick : rn(au)}发了动态：“${p.c}”${p.tr ? `（${p.tr}）` : ''}\n已有评论：${p.cm.map(c => `${nm(who(c.f))}${c.to ? '回复' + nm(who(c.to)) : ''}：${c.c}`).join('；') || '无'}\n${why}\n${langRule(L)}\n${mp('chat.cmt')}\n${NOAI}\n只输出JSON：{"comments":[{"from":"名字","text":"","tr":"","to":"回复谁(可空)"}],"likes":["名字"]}`, '动态评论', sg, { mod: 'chat.cmt' }));
    if(D() !== data || !data.posts.includes(p)) return '动态已删除或聊天已切换';
    const allowed = new Set(L.flatMap(c=>[rn(c),nm(c)]));
    r?.comments?.filter(c=>allowed.has(c.from))?.forEach(c => c.text && p.cm.push({ f: c.from, c: c.text, tr: c.tr || '', ...(c.to && { to: c.to }) })); r?.likes?.filter(n=>allowed.has(n))?.forEach(n => n && !p.likes.includes(n) && p.likes.push(n)); saveD(); emit('chat'); return '收到评论';
    } finally {pendingComments.delete(p.id);}
  });
}

/* ---------- 微信：赞 / 评论小条、底部评论框（照录屏） ---------- */
const WXI = n => new URL(`../../assets/wx/${n}.png`, import.meta.url).href;
function wxPill(p, t) {
  const old = t.querySelector('.wxp'); document.querySelectorAll('.wxp').forEach(n => n.remove()); if (old) return;
  const w = Object.assign(document.createElement('span'), { className: 'wxp' });
  const on = liked(p);
  w.innerHTML = `<b data-k="like"><img src="${WXI(on ? 'mo-liked' : 'mo-like')}"><span>${on ? '取消' : '赞'}</span></b><i></i><b data-k="cmt"><img src="${WXI('mo-cmt')}">评论</b>`;
  t.append(w); requestAnimationFrame(() => w.classList.add('in'));
  // 点赞 / 取消（照录屏）：心先换成红心（或变回白心）弹一下，停一小会儿小条再收回去，然后才记上赞
  w.onclick = e => { e.stopPropagation(); const k = e.target.closest('[data-k]')?.dataset.k; if (!k || w.dataset.go) return;
    if (k == 'cmt') { w.remove(); return FA.cmt(p.id); }
    w.dataset.go = 1; const b = w.querySelector('[data-k=like]'), im = b.querySelector('img'); im.src = WXI(on ? 'mo-like' : 'mo-liked'); b.querySelector('span').textContent = on ? '赞' : '取消'; b.classList.add('pop');
    setTimeout(() => { w.classList.remove('in'); setTimeout(() => { w.remove(); FA.like(p.id); }, 160); }, 480); };
  setTimeout(() => document.addEventListener('click', e => { w.contains(e.target) || w.remove(); }, { once: true }), 0);
}
// 底部评论框：「评论」/「回复XX:」，右边 表情（抠图）、图片（抠图）、发送（有字才变绿）；点外面收起
function cmtBar(ph) {
  return new Promise(done => {
    const w = Object.assign(document.createElement('div'), { className: 'wxcb' });
    w.innerHTML = `<div class="wxcb-b"><input placeholder="${esc(ph)}:"><img src="${WXI('cmt-emo')}"><img src="${WXI('cmt-img')}"><b class="wxcb-s">发送</b></div>`;
    ui.scr.append(w); const ip = w.querySelector('input'), sb = w.querySelector('.wxcb-s'); requestAnimationFrame(() => { w.classList.add('in'); ip.focus(); });
    const end = v => { w.classList.remove('in'); setTimeout(() => w.remove(), 200); done(v); };
    ip.oninput = () => sb.classList.toggle('on', !!ip.value.trim()); ip.onkeydown = e => e.key == 'Enter' && ip.value.trim() && end(ip.value.trim());
    w.onclick = e => { if (e.target == w) return end(''); if (e.target == sb && ip.value.trim()) end(ip.value.trim()); };
  });
}
/* ---------- 操作 ---------- */
const share = async p => { const to = await menu(D().chats.filter(c => c.fr !== 0 || c.type == 'g').map(c => [c.id, esc(nm(c))]), '分享到…'); const T = to && get(to); if (!T) return; const n = nm(auOf(p)); T.msgs.push({ f: 'me', t: 'rec', c: `${n}的${FN[S.style]}`, rec: [{ n, c: p.c + (p.tr ? `（${p.tr}）` : '') }], ts: +now() }); saveD(); emit('chat'); toast(`已分享给 ${nm(T)}`); };
export function mountFeed(el) {
  const area=el.querySelector('.pg-b'), head=el.querySelector('.pg-h');
  if(!area || !head)return;
  if(el.querySelector('.feed.mz-wx') && !el.classList.contains('alpg')) { const title=head.querySelector('.pg-t');if(title)title.textContent='朋友圈'; }
  const update=()=>head.classList.toggle('feed-header-solid',area.scrollTop>150);
  area.onscroll=update;update();
}
export const FA = {
  fpost: async () => {const k=await menu([['text','文字'],['image','图片']],'发朋友圈');if(k)FA.post(k==='image'?'img':'');},
  fphoto: async value => { const [id,index]=value.split('|'), p=P(id), image=p && postImages(p)[+index];if(!image)return;
    if(image.url)return page({title:'图片',cls:'feed-image',body:()=>`<img class="feed-full-image" src="${esc(image.url)}" alt="动态配图">`});
    const choice=await menu([['description','查看图片描述'],['generate','生成图片']]);
    if(choice==='description')return page({title:'图片描述',body:()=>`<p>${esc(image.description || image.prompt)}</p>`});
    if(choice==='generate')return task('生成动态配图',async sg=>{const data=D(),url=await genImg(image.prompt || image.description,sg,'chat');if(D()!==data||!data.posts.includes(p)) {drop(url);return '动态已删除';} if(!p.images?.length)p.images=postImages(p);p.images[+index]={...image,url};saveD();emit('chat');return '图片已生成';});
  },
  fcme: async v => { if (await menu([['d', '删除', 'danger']]) == 'd') { const [id, i] = v.split('|'), p = P(id); p?.cm.splice(+i, 1); saveD(); emit('chat'); } },
  fcdel: async value => {const [id,index]=value.split('|'),p=P(id);if(!p || !await ok('删除这条评论？'))return;p.cm.splice(+index,1);saveD();emit('chat');},
  fcov: async (x, t, e, pg) => { const o = x == 'me' ? D().me : get(x); if (!o) return; const v = await pickImg(1080, 'cover'); if (v == null) return; drop(o.cover); o.cover = v; saveD(); emit('chat'); pg?.re?.(); },
  fmore: async () => { const k = await menu([['cov', '换封面'], ['bg', '换动态背景']]); if (!k) return; const v = await pickImg(1080, 'cover'); if (v == null) return; const m = D().me, f = k == 'cov' ? 'cover' : 'fbg'; drop(m[f]); m[f] = v; saveD(); emit('chat'); },
  ftr: k => { OPEN.has(k) ? OPEN.delete(k) : OPEN.add(k); emit('chat'); },
  like: id => { const p = P(id), me = nm(meObj()); if (!p) return; p.likes = p.likes.includes(me) ? p.likes.filter(x => x != me) : [...p.likes, me]; saveD(); emit('chat'); },
  cmt: async id => { const p = P(id); if (!p) return; const r = S.style == 'wx' ? { c: await cmtBar('发表评论') } : await form('评论', [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c }); saveD(); emit('chat'); p.a != 'me' && genCmt(p, `请生成${rn(auOf(p))}（以及可能路过的联系人）对${meObj().nick}这条评论的回复 1-2 条。`); },
  crep: async x => { const [id, i] = x.split('|'), p = P(id), c = p?.cm[+i]; if (!c) return; const r = S.style == 'wx' ? { c: await cmtBar(`回复${nm(who(c.f))}`) } : await form(`回复 ${nm(who(c.f))}`, [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c, to: c.f }); saveD(); emit('chat'); isMe(c.f) || genCmt(p, `${meObj().nick}回复了${nm(who(c.f))}，请生成${nm(who(c.f))}（以及可能的其他人）的回应 1-2 条。`); },
  // 微信：点 ·· 从左边滑出深色小条「赞 | 评论」（照录屏，图标是抠的）；长按 ·· 是 好友互动 / 编辑 / 分享
  pmore: (id,t) => {const p=P(id);if(!p)return;if(t?.closest('.wxm'))return wxPill(p,t);const existing=t?.querySelector('.feed-action-popup');document.querySelectorAll('.feed-action-popup').forEach(n=>n.remove());if(existing || !t)return;
    const popup=document.createElement('span');popup.className='feed-action-popup';
    const actions=[['like',liked(p)?'取消赞':'赞',liked(p)?FI.heartF:FI.heart],['cmt','评论',FI.cmt],['pshare','分享',FI.share],['pgc','好友互动',FI.wand],['pedit','编辑',FI.edit],['pdel','删除',FI.del]];
    popup.innerHTML=actions.map(([key,label,icon])=>`<button type="button" aria-label="${label}" title="${label}" data-feed-act="${key}">${icon}</button>`).join('');
    popup.onclick=e=>{e.stopPropagation();const action=e.target.closest('[data-feed-act]');if(action){popup.remove();FA[action.dataset.feedAct](id);}};t.append(popup);
    const dismiss=e=>{if(!popup.contains(e.target)&&!t.contains(e.target))popup.remove();};setTimeout(()=>document.addEventListener('click',dismiss,{once:true}),0);
  },
  pmlp: async id => { const k = await menu([['pgc', '好友互动'], ['pedit', '编辑'], ['pshare', '分享']]); k && FA[k](id); },
  pshare: id => { const p = P(id); p && share(p); },
  pgc: id => { const p = P(id); p && genCmt(p, '请让联系人们按人设给这条动态点赞、评论，评论之间可以互相回复，2-4 条。'); },
  pedit: async id => { const p = P(id); if (!p) return; const r = await form('编辑动态', [['c', '正文', 'area'], ...(p.tr ? [['tr', '中文译文', 'area']] : [])], { c: p.c, tr: p.tr }); if (!r) return; p.c = r.c || ''; p.tr != null && (p.tr = r.tr || ''); saveD(); emit('chat'); },
  pdel: async id => { if (!await ok('删除这条动态？')) return; drop(D().posts.filter(p => p.id == id)); D().posts = D().posts.filter(p => p.id != id); saveD(); emit('chat'); },
  pfeed: id => openFeed(id), myfeed: () => openFeed('me'),
  // 发动态：谁可以看（公开 / 部分可见 / 不给谁看 + 选分组）；评论和点赞只会来自看得到的人
  post: async x => { const gs = (S.style == 'wx' ? allTags() : grpNames()).map(g => [g, g]); /* 微信按标签，其他样式按分组 */ const r = await form('发表动态', m => [['c', '这一刻的想法...', 'area'], ['url', '配图', 'img'], ['vm', '谁可以看', 'sel', [['', '公开'], ['only', '部分可见'], ['not', '不给谁看']]], ...(m.vm ? [['vg', m.vm == 'only' ? S.style == 'wx' ? '选中的标签可见' : '选中的分组可见' : S.style == 'wx' ? '选中的标签不可见' : '选中的分组不可见', 'multi', gs]] : [])], { vm: '', vg: [] }, {}, (k, v, m, sh) => k == 'vm' && sh.re());
    if (!r?.c && !r?.url) return; const vis = r.vm && r.vg?.length ? { m: r.vm, g: r.vg } : null;
    D().posts.unshift({ id: uid(), a: 'me', c: r.c || '', url: r.url, ts: +now(), likes: [], cm: [], ...(vis && { vis }) }); saveD(); emit('chat'); },
  fgen: (x, t, e, pg) => genDlg(pg?.aid && pg.aid != 'me' ? pg.aid : ''),
  apost: id => { const p = P(id); p && page({ title: '详情', live: 1, cls: 'feedpg', body: () => P(id) ? `<div class="feed mz-wx one">${postWx(P(id))}</div>` : '<p class="mo-e">已删除</p>', acts: FA }); },
  amore: async (x, t, e, pg) => { const k = await menu(pg.aid == 'me' ? [['post', '发朋友圈'], ['fgen', '生成动态']] : [['fgen', `让${esc(nm(get(pg.aid)))}发条朋友圈`]]); k && FA[k](x, t, e, pg); },
};
export function openFeed(aid) {
  const st = aid && aid != 'me' ? sty(get(aid)) : S.style, fs = FS[st], al = fs == 'wx';
  page({ title: '', aid, live: 1, cls: `feedpg st-${st} fs-${fs}${al ? ' alpg' : ''}`, after: mountFeed, right: () => al ? `<b data-a="amore">${FI.more}</b>` : feedRight(), body: () => feed(aid, st), acts: FA });
}
