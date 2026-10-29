import { FEED_ICONS } from './feed-icons.js';
import { MOMENTS_CORE, MOMENTS_FMT, normalizeMoments } from './feed-generation.js';
import { regMod, mp, NOAI } from '../../mods.js';
regMod({ k: 'chat.feed', app: '聊天', n: '动态', def: MOMENTS_CORE, vars: [['currentStoryTime', '剧情时间'], ['contactsInfo', '联系人列表'], ['memoryInfo', '记忆']] });
regMod({ k: 'chat.cmt', app: '聊天', n: '动态评论', def: '评论和点赞的人要符合各自人设和与发帖人的亲疏；评论口语、简短，像真人随手回复，可以互相接话、玩梗、拌嘴。' });
// 聊天 · 动态：微信朋友圈（毛玻璃卡片）/ QQ空间 / Moments（Kakao、LINE）+ 个人相册 + 生成动态弹窗
// 角色的动态和评论在同一次生成里带上 [翻译]（tr），点「查看翻译」展开；不额外调用
import { S, D, saveD, esc, uid, page, sheet, menu, form, toast, nm, rn, avOf, meObj, now, llm, json, sysCtx, task, emit, drop, pickImg, pickFile, readImg, putMedia, ok, genImg, imgDesc, ui } from '../../core.js';
import { wxFaces, imgH } from './sticker.js';
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
// 微信小黄脸：文字里的 [微笑] 换成表情图（评论框里点表情插进去的就是这个）
let FM; const faceMap = () => FM ||= new Map(wxFaces().map(x => [x.l, x]));
const faces = h => h.replace(/\[([^\[\]<>]{1,6})\]/g, (m, l) => faceMap().has(l) ? imgH(faceMap().get(l), 'f-emo', ` alt="${esc(m)}"`) : m);
const liked = p => p.likes.includes(nm(meObj()));
// 评论（照微信）：后面不放「回复」「删除」，只有查看翻译 / 显示原文；点别人的评论就是回复 TA，点自己的评论弹出删除
const cms = (p, tw) => p.cm.map((c, i) => `<div class="f-c" data-a="${isMe(c.f) ? 'fcme' : 'crep'}" data-x="${p.id}|${i}"><b class="f-n">${dn(c.f)}</b>${c.to ? ` 回复 <b class="f-n">${dn(c.to)}</b>` : ''}：${faces(tx(noAt(c.c), noAt(c.tr), p.id + ':' + i, who(c.f)))}${c.img ? `<img class="f-ci" src="${esc(c.img)}" data-a="fcimg" data-x="${p.id}|${i}" loading="lazy">` : ''}</div>`).join('');

/* ---------- 三种样式的一条动态 ---------- */
export const postImages = p => p.images?.length ? p.images : p.url ? [{url:p.url}] : p.imgd ? [(d=>({description:d.zh||d.en,prompt:d.en}))(imgDesc(p.imgd))] : [];
const imgs = p => { const list=postImages(p); return list.length ? `<div class="mo-images n${list.length}">${list.map((v,i)=>`<button type="button" class="mo-photo" data-a="fphoto" ${v.url ? 'data-lp="fplp" ' : ''}data-x="${p.id}|${i}">${v.url ? `<img src="${esc(v.url)}" loading="lazy" alt="${esc(v.description || '动态配图')}">` : `<span>${FI.img}<small>${esc(v.description || imgDesc(v.prompt).zh || v.prompt)}</small></span>`}</button>`).join('')}</div>${p.location ? `<div class="mo-location">${esc(p.location)}</div>` : ''}` : p.location ? `<div class="mo-location">${esc(p.location)}</div>` : ''; };

const cmBox = p => p.likes.length || p.cm.length ? `<div class="mo-ia">${p.likes.length ? `<div class="mo-lk">${FI.heart}<span>${p.likes.map(dn).join('，')}</span></div>` : ''}${p.cm.length ? `<div class="mo-cs">${cms(p)}</div>` : ''}</div>` : '';
function postWx(p) { // 微信朋友圈：白底列表，蓝名字，右下 ·· 按钮，灰底点赞评论区
  const au = auOf(p);
  return `<article class="mo wxm"><img class="av" src="${esc(avOf(au))}" data-a="pfeed" data-x="${p.a}"><div class="mo-m"><b class="mo-n" data-a="pfeed" data-x="${p.a}">${esc(nm(au))}</b>${p.c ? `<p class="mo-t">${faces(tx(p.c, p.tr, p.id, au))}</p>` : ''}${imgs(p)}
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
// 评论、回复也一样按「说话的这个人」自己的语言来，不跟着帖子走（日语帖子底下说中文的人照样说中文，反过来也一样）
const langRule = L => { const r = L.map(c => [c, c.cfg?.lang]).filter(([, l]) => l && l != 'zh-TW'), zh = L.filter(c => !r.some(([x]) => x == c));
  return (r.length ? `【语言】每个人只用自己的语言说话——${r.map(([c, l]) => `${rn(c)}用${lname(l)}`).join('；')}。这些人发的正文、写的每一条评论和回复（不管回复谁、帖子是什么语言）text 都用自己的语言写，tr 写简体中文译文（贴合说话人的人设、口癖和语气，口语自然）；${zh.length ? zh.map(rn).join('、') + '等其他人' : '其他人'}用中文，tr 留空。` : '【语言】都用简体中文，tr 留空。')
    + '\n【回复格式】回复别人的评论时 text 开头不要写「@名字」（微信回复不艾特，系统会自动显示「A 回复 B」），直接说话。'; };
// 去掉评论开头的 @某某（模型有时还是会写；旧数据显示时也去掉）
const noAt = t => String(t || '').replace(/^\s*(?:@[^\s@：:，,]+[\s：:，,]*)+/, '');

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
      const added=posts.map(p=> { const [c,tr]=split(p.text); return {id:uid(),u:1,a:contacts.find(c=>[rn(c),nm(c)].includes(p.author)).id,c,tr:p.tr||tr,ts:p.ts,location:p.location,images:p.images.map(v=>/^https?:\/\/|^data:image\/|^\//.test(v)?{url:v}:(d=>({description:d.zh||d.en,prompt:d.en}))(imgDesc(v))),likes:p.likes,cm:p.comments.map(v=>{const [c,tr]=split(v.text);return {f:v.from,c:noAt(c),tr:noAt(v.tr||tr),...(v.to?{to:v.to}:{})};})}; });
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
    const r = json(await llm(await sysCtx(), `${p.a == 'me' ? meObj().nick : rn(au)}发了动态：“${p.c}”${p.tr ? `（${p.tr}）` : ''}\n已有评论：${p.cm.map(c => `${nm(who(c.f))}${c.to ? '回复' + nm(who(c.to)) : ''}：${c.c}${c.img ? '[图片]' : ''}`).join('；') || '无'}\n${why}\n${langRule(L)}\n${mp('chat.cmt')}\n${NOAI}\n只输出JSON：{"comments":[{"from":"名字","text":"","tr":"","to":"回复谁(可空)"}],"likes":["名字"]}`, '动态评论', sg, { mod: 'chat.cmt' }));
    if(D() !== data || !data.posts.includes(p)) return '动态已删除或聊天已切换';
    const allowed = new Set(L.flatMap(c=>[rn(c),nm(c)]));
    r?.comments?.filter(c=>allowed.has(c.from))?.forEach(c => c.text && p.cm.push({ f: c.from, c: noAt(c.text), tr: noAt(c.tr), ...(c.to && { to: c.to }) })); r?.likes?.filter(n=>allowed.has(n))?.forEach(n => n && !p.likes.includes(n) && p.likes.push(n)); saveD(); emit('chat'); return '收到评论';
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
// 表情：下面展开微信小黄脸，点一个插进输入框（[微笑]）；图片：直接选相册，发一条带图的评论
function cmtBar(ph) {
  return new Promise(done => {
    const w = Object.assign(document.createElement('div'), { className: 'wxcb' });
    w.innerHTML = `<div class="wxcb-b"><div class="wxcb-r"><input placeholder="${esc(ph)}:"><img data-k="emo" src="${WXI('cmt-emo')}"><img data-k="img" src="${WXI('cmt-img')}"><b class="wxcb-s">发送</b></div><div class="wxcb-e"></div></div>`;
    ui.scr.append(w); const ip = w.querySelector('input'), sb = w.querySelector('.wxcb-s'), ep = w.querySelector('.wxcb-e'); requestAnimationFrame(() => { w.classList.add('in'); ip.focus(); });
    const end = v => { w.classList.remove('in'); setTimeout(() => w.remove(), 200); done(v); };
    const upd = () => sb.classList.toggle('on', !!ip.value.trim()); let pos = 0;
    ip.oninput = upd; ip.onkeydown = e => e.key == 'Enter' && ip.value.trim() && end({ c: ip.value.trim() }); ip.onblur = () => pos = ip.selectionStart ?? ip.value.length; ip.onfocus = () => w.classList.remove('emo');
    w.onclick = async e => { const t = e.target, k = t.dataset?.k;
      if (t == w) return end(null);
      if (t == sb && ip.value.trim()) return end({ c: ip.value.trim() });
      if (k == 'emo') { if (!ep.firstChild) ep.innerHTML = wxFaces().map(x => imgH(x, '', ` data-f="${esc(x.l)}"`)).join('') + '<b class="wxcb-del" data-k="del">⌫</b>'; const on = w.classList.toggle('emo'); on ? ip.blur() : ip.focus(); return; }
      if (t.dataset?.f) { const v = `[${t.dataset.f}]`; ip.value = ip.value.slice(0, pos) + v + ip.value.slice(pos); pos += v.length; return upd(); }
      if (k == 'del') { const l = ip.value.slice(0, pos), m = l.match(/\[[^\[\]]{1,6}\]$/), n = m ? m[0].length : 1; ip.value = l.slice(0, -n) + ip.value.slice(pos); pos = Math.max(0, pos - n); return upd(); }
      if (k == 'img') { const fl = await pickFile(); if (!fl) return; const u = await putMedia(await readImg(fl, 1080), 'img'); u && end({ c: ip.value.trim(), img: u }); }
    };
  });
}
// 看大图（照微信）：黑底铺满，点一下收起，双击 / 双指放大，长按 保存到手机 / 重新生成
function viewer(url, lp) {
  const w = Object.assign(document.createElement('div'), { className: 'imv' }); w.innerHTML = `<img src="${esc(url)}" alt="">`;
  ui.scr.append(w); requestAnimationFrame(() => w.classList.add('in'));
  const im = w.firstChild, P = new Map(); let k = 1, x = 0, y = 0, d0 = 0, k0 = 1, last = 0, moved = 0, lt;
  const put = () => im.style.transform = `translate(${x}px,${y}px) scale(${k})`, close = () => { w.classList.remove('in'); setTimeout(() => w.remove(), 200); };
  const dist = () => { const [a, b] = [...P.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  w.onpointerdown = e => { P.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (P.size == 2) { d0 = dist(); k0 = k; clearTimeout(lt); } else if (lp) { clearTimeout(lt); lt = setTimeout(() => { moved = 1; lp(close); }, 550); } };
  w.onpointermove = e => { const o = P.get(e.pointerId); if (!o) return; const dx = e.clientX - o.x, dy = e.clientY - o.y; if (Math.abs(dx) + Math.abs(dy) > 6) { moved = 1; clearTimeout(lt); }
    P.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (P.size == 2) { k = Math.min(5, Math.max(1, k0 * dist() / d0)); put(); } else if (k > 1) { x += dx; y += dy; put(); } };
  w.onpointerup = w.onpointercancel = e => { P.delete(e.pointerId); clearTimeout(lt); if (P.size || moved) { k <= 1 && (x = y = 0, put()); return; }
    const t = Date.now(); if (t - last < 280) { clearTimeout(w._c); k = k > 1 ? 1 : 2.5; x = y = 0; im.style.transition = 'transform .2s'; put(); setTimeout(() => im.style.transition = '', 220); last = 0; return; }
    last = t; w._c = setTimeout(close, 280); };
  w.oncontextmenu = e => e.preventDefault();
}
// 保存到手机：拿到图片数据再走下载（跨域链接也能存）
async function saveImg(url) {
  try { const b = await (await fetch(url)).blob(), u = URL.createObjectURL(b), a = Object.assign(document.createElement('a'), { href: u, download: `xphone_${Date.now()}.${(b.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5e3); toast('已保存到手机'); }
  catch { toast('保存失败，长按图片用浏览器自带的保存试试'); }
}
// 配图生成：描述是「中文 + 英文 tags」，core 里按当前生图渠道挑（NAI / SD / ComfyUI 用 tags，OpenAI / 硅基流动 用中文 + tags）
const genPhoto = (p, i) => task('生成动态配图', async sg => { const data = D(), im = postImages(p)[i]; if (!im) return '图片已删除';
  const url = await genImg({ zh: im.description, en: im.prompt }, sg, 'chat'); if (D() !== data || !data.posts.includes(p)) { drop(url); return '动态已删除'; }
  if (!p.images?.length) p.images = postImages(p); const old = p.images[i]?.url; p.images[i] = { ...im, url }; old && old != url && drop(old); saveD(); emit('chat'); return '图片已生成'; });
const photoOf = v => { const [id, i] = v.split('|'), p = P(id); return [p, +i, p && postImages(p)[+i]]; };
/* ---------- 操作 ---------- */
const share = async p => { const to = await menu(D().chats.filter(c => c.fr !== 0 || c.type == 'g').map(c => [c.id, esc(nm(c))]), '分享到…'); const T = to && get(to); if (!T) return; const n = nm(auOf(p)); T.msgs.push({ f: 'me', t: 'rec', c: `${n}的${FN[S.style]}`, rec: [{ n, c: p.c + (p.tr ? `（${p.tr}）` : '') }], ts: +now() }); saveD(); emit('chat'); toast(`已分享给 ${nm(T)}`); };
// 微信朋友圈顶栏：在封面上是透明 + 白图标；封面滚过去就变成实心灰底（连状态栏一起，不透出下面的内容）+ 标题
// 下拉：封面跟着往下拉长，左上角彩色光圈跟着转，松手后转一会儿收回（只是动效，不调接口）
const SPIN = WXI('mo-spin');
export function mountFeed(el) {
  const area=el.querySelector('.pg-b'), head=el.querySelector('.pg-h');
  if(!area || !head)return;
  const wx = el.querySelector('.feed.mz-wx') && !el.classList.contains('alpg');
  if(wx) { const title=head.querySelector('.pg-t');if(title)title.textContent='朋友圈'; }
  if(el.classList.contains('tb-feed') && D().posts.some(p => p.u)) { D().posts.forEach(p => delete p.u); saveD(); } // 看过了，发现 上的红点消掉
  const cv = () => el.querySelector('.feed.mz-wx>.mo-cv');
  const edge = () => { const c = cv(); return c ? c.offsetHeight - head.offsetTop - head.offsetHeight : 150; };
  const update=()=>head.classList.toggle('feed-header-solid',area.scrollTop>Math.max(40, edge()));
  area.onscroll=update;update();
  if (!wx || area._pull) return; area._pull = 1;
  let y0 = null, d = 0, sp = null, h0 = 0;
  const spin = () => sp ||= Object.assign(document.createElement('img'), { className: 'mo-spin', src: SPIN });
  area.addEventListener('touchstart', e => { y0 = area.scrollTop <= 0 && !sp?.classList.contains('go') ? e.touches[0].clientY : null; d = 0; const c = cv(); h0 = c ? c.offsetHeight : 0; }, { passive: true });
  area.addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy <= 0 || area.scrollTop > 0) { d && reset(); return; }
    e.preventDefault(); d = Math.min(160, dy * .5); const c = cv(); if (c) { c.style.transition = 'none'; c.style.height = h0 + d + 'px'; }
    const s = spin(); s.isConnected || el.append(s); s.style.opacity = Math.min(1, d / 40); s.style.transform = `rotate(${d * 4}deg)`; }, { passive: false });
  const reset = () => { const c = cv(); if (c) { c.style.transition = 'height .3s var(--ease-drawer,ease)'; c.style.height = ''; } d = 0; };
  area.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; const go = d > 50; reset();
    if (!sp) return; if (!go) { sp.remove(); sp = null; return; }
    const s = sp; s.style.transform = ''; s.style.opacity = 1; s.classList.add('go'); setTimeout(() => { s.style.opacity = 0; setTimeout(() => { s.remove(); sp === s && (sp = null); }, 200); }, 900); });
}
export const FA = {
  fpost: async () => {const k=await menu([['text','文字'],['image','图片']],'发朋友圈');if(k)FA.post(k==='image'?'img':'');},
  // 配图：有图 → 点开看大图（长按 保存 / 重新生成）；还没图 → 点开编辑描述（中文 + 英文 tags），保存就去生成
  fphoto: async value => { const [p, i, im] = photoOf(value); if (!im) return;
    if (im.url) return viewer(im.url, close => FA.fplp(value, null, null, null, close));
    const r = await form('图片描述', [['zh', '中文描述（显示用）', 'area'], ['en', '英文 tags（NAI / SD / ComfyUI 用，留空自动机翻）', 'area'], ['tip', 'OpenAI、硅基流动会把中文描述和英文 tags 一起发过去；NAI、SD、ComfyUI 只发英文 tags。保存后开始生成。', 'tip']], { zh: im.description || '', en: im.prompt || '' });
    if (!r || !(r.zh || r.en)) return; if (!p.images?.length) p.images = postImages(p); p.images[i] = { ...p.images[i], description: r.zh || r.en, prompt: r.en }; saveD(); emit('chat'); genPhoto(p, i);
  },
  fplp: async (value, t, e, pg, close) => { const [p, i, im] = photoOf(value); if (!im?.url) return; const k = await menu([['save', '保存到手机'], ['re', '重新生成'], ['desc', '编辑图片描述']]);
    if (k == 'save') return saveImg(im.url);
    if (k == 're') { close?.(); return genPhoto(p, i); }
    if (k == 'desc') { const r = await form('图片描述', [['zh', '中文描述', 'area'], ['en', '英文 tags', 'area']], { zh: im.description || '', en: im.prompt || '' }); if (!r) return; p.images[i] = { ...p.images[i], description: r.zh || r.en, prompt: r.en }; saveD(); emit('chat'); }
  },
  fcimg: v => { const [id, i] = v.split('|'), c = P(id)?.cm[+i]; c?.img && viewer(c.img, async () => (await menu([['save', '保存到手机']])) == 'save' && saveImg(c.img)); },
  fcme: async v => { if (await menu([['d', '删除', 'danger']]) == 'd') { const [id, i] = v.split('|'), p = P(id); p && drop(p.cm[+i]); p?.cm.splice(+i, 1); saveD(); emit('chat'); } },
  fcdel: async value => {const [id,index]=value.split('|'),p=P(id);if(!p || !await ok('删除这条评论？'))return;p.cm.splice(+index,1);saveD();emit('chat');},
  fcov: async (x, t, e, pg) => { const o = x == 'me' ? D().me : get(x); if (!o) return; const v = await pickImg(1080, 'cover'); if (v == null) return; drop(o.cover); o.cover = v; saveD(); emit('chat'); pg?.re?.(); },
  fmore: async () => { const k = await menu([['cov', '换封面'], ['bg', '换动态背景']]); if (!k) return; const v = await pickImg(1080, 'cover'); if (v == null) return; const m = D().me, f = k == 'cov' ? 'cover' : 'fbg'; drop(m[f]); m[f] = v; saveD(); emit('chat'); },
  ftr: k => { OPEN.has(k) ? OPEN.delete(k) : OPEN.add(k); emit('chat'); },
  like: id => { const p = P(id), me = nm(meObj()); if (!p) return; p.likes = p.likes.includes(me) ? p.likes.filter(x => x != me) : [...p.likes, me]; saveD(); emit('chat'); },
  cmt: async id => { const p = P(id); if (!p) return; const r = S.style == 'wx' ? await cmtBar('发表评论') : await form('评论', [['c', '说点什么吧...']]); if (!r?.c && !r?.img) return; p.cm.push({ f: nm(meObj()), c: r.c || '', ...(r.img && { img: r.img }) }); saveD(); emit('chat'); p.a != 'me' && genCmt(p, `请生成${rn(auOf(p))}（以及可能路过的联系人）对${meObj().nick}这条评论的回复 1-2 条。`); },
  crep: async x => { const [id, i] = x.split('|'), p = P(id), c = p?.cm[+i]; if (!c) return; const r = S.style == 'wx' ? await cmtBar(`回复${nm(who(c.f))}`) : await form(`回复 ${nm(who(c.f))}`, [['c', '说点什么吧...']]); if (!r?.c && !r?.img) return; p.cm.push({ f: nm(meObj()), c: r.c || '', to: c.f, ...(r.img && { img: r.img }) }); saveD(); emit('chat'); isMe(c.f) || genCmt(p, `${meObj().nick}回复了${nm(who(c.f))}，请生成${nm(who(c.f))}（以及可能的其他人）的回应 1-2 条。`); },
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
