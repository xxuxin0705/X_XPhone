// 小手机 · 聊天：消息列表 / 私聊群聊 / 动态（朋友圈·QQ空间·推特式）/ 我
import { C, S, D, saveD, esc, uid, $, ui, reg, page, top, back, menu, form, ok, toast, fx, btn, sec, nm, rn, avOf, meObj, byId, brief, now, hm, llm, json, sysCtx, genImg, tts, notify, on, emit, pickImg, pickFile, I, home, wiBooks, loadBook, sleep, merge, APPS } from '../core.js';

const CFG = { style: '', bub: '', shape: '', avs: '', showAv: true, cont: true, dark: false, frame: '', bg: '', tr: false, trMine: false, lang: '', inj: false };
const STY = [['wx', '仿微信'], ['qq', '仿QQ'], ['kk', '仿KakaoTalk'], ['line', '仿LINE']];
const FS = { wx: 'wx', qq: 'qq', kk: 'tw', line: 'tw' }, FN = { wx: '朋友圈', qq: 'QQ空间', kk: '动态', line: '动态' };
const EMO = '❤️ 👍 😂 😮 😢 🥳 🙏 😡'.split(' ');

/* ---------- 数据 ---------- */
const get = id => { const c = byId(id); c && merge(c.cfg ||= {}, CFG); return c; };
const blank = (type, o) => ({ id: uid(), type, name: '', nick: '', real: '', remark: '', sign: '', av: '', voice: '', msgs: [], cfg: { ...CFG }, members: [], admins: [], titles: {}, owner: '', no: type == 'g' ? String(1e8 + Math.random() * 9e8 | 0) : '', notice: '', pin: 0, unread: 0, ...o });
const add = c => (D().chats.push(c), c);
const find = (n, type) => n && D().chats.find(c => (!type || c.type == type) && [c.real, c.nick, c.remark, c.name, c.id].includes(n));
export const isMe = n => !!n && ['me', '我', '用户', C().name1, D().me.nick].includes(n);
const upsert = o => { const n = o.real || o.nick, c = find(o.real, 'p') || find(o.nick, 'p'); if (!c) return add(blank('p', { ...o, nick: o.nick || n, real: n })); ['nick', 'real', 'remark', 'sign'].forEach(k => o[k] && !c[k] && (c[k] = o[k])); return c; };
const member = (g, n) => { const c = upsert({ real: n }); g.members.includes(c.id) || g.members.push(c.id); return c.id; };
const viewing = id => top()?.chat == id && ui.root.classList.contains('on');
const sty = c => c?.cfg?.style || S.style;
const stk = n => S.assets.sticker.find(s => s.name == n || (n && n.includes(s.name)))?.img || '';

function addMsg(ch, m) {
  const t = m.type || 'text', f = isMe(m.from) ? 'me' : ch.type == 'p' ? ch.id : member(ch, m.from);
  if (t == 'react') return void (ch.msgs[m.i] && (ch.msgs[m.i].re ||= []).push(m.text));
  if (t == 'accept') { const x = ch.msgs.findLast(x => x.t == 'transfer' && x.f == 'me' && !x.st); return void (x && (x.st = '已收款')); }
  const x = { f, t, c: t == 'pat' ? `“${nm(f == 'me' ? meObj() : get(f))}” 拍了拍 “${m.text || nm(meObj())}”` : String(m.text ?? ''), tr: m.tr || '', amt: +m.amount || 0, ts: +now() };
  t == 'sticker' && (x.img = stk(x.c)); ch.msgs.push(x);
  f != 'me' && !viewing(ch.id) && (ch.unread = (ch.unread || 0) + 1);
  t == 'img' && S.api.img.auto && genImg(x.c).then(u => { x.url = u; saveD(); emit('chat'); }).catch(() => { });
  return f == 'me' ? null : x;
}
export function applyDelta(d, cur) {
  const out = []; d ||= {};
  d.contacts?.forEach(c => (c.real || c.nick) && !isMe(c.real) && upsert(c));
  d.groups?.forEach(g => {
    if (!g.name) return; const x = find(g.name, 'g') || add(blank('g', { name: g.name }));
    g.no && (x.no = String(g.no)); g.notice && (x.notice = g.notice); g.owner && !isMe(g.owner) && (x.owner = member(x, g.owner));
    g.admins?.forEach(n => { if (isMe(n)) return; const i = member(x, n); x.admins.includes(i) || x.admins.push(i); }); g.members?.forEach(n => isMe(n) || member(x, n));
  });
  d.msgs?.forEach(m => { const ch = cur || find(m.chat) || upsert({ real: isMe(m.from) ? m.chat : m.from }), x = ch && addMsg(ch, m); x && out.push([ch, x]); });
  d.posts?.forEach(p => {
    const po = { id: uid(), a: isMe(p.author) ? 'me' : upsert({ real: p.author }).id, c: p.text || '', imgd: p.img || '', ts: +now() - Math.random() * 18e6, likes: p.likes || [], cm: (p.comments || []).map(c => ({ f: c.from, c: c.text })) };
    D().posts.unshift(po); po.imgd && S.api.img.auto && genImg(po.imgd).then(u => { po.url = u; saveD(); emit('chat'); }).catch(() => { });
  });
  saveD(); emit('chat'); return out;
}

/* ---------- 提示词 ---------- */
const names = () => D().chats.map(c => c.type == 'g' ? `群「${c.name}」` : rn(c)).join('、') || '无';
const GJ = '"groups":[{"name":"群名","owner":"群主真实姓名","admins":[],"members":["真实姓名"],"notice":"群公告"}]';
export const SCAN = t => `【最新剧情】\n${t}\n\n任务：找出这段剧情里发生在线上（手机/社交软件）的事件并同步到小手机：发消息、加好友、拉群/进群、发朋友圈动态、转账、拍一拍等。已有：${names()}。剧情里没出现的不要编。
只输出JSON：{"contacts":[{"real":"真实姓名","nick":"网名","sign":"签名"}],${GJ},"msgs":[{"chat":"私聊对象真实姓名或群名","from":"发送者真实姓名","type":"text","text":"内容"}],"posts":[{"author":"","text":""}]}，没有的项给空数组。`;
const INIT = () => `任务：根据人设、世界书和剧情，列出${C().name1}手机里应有的联系人和群聊（剧情里认识的人、所属的群体）。已有：${names()}，不要重复。给每人设计贴合人设的网名与签名；群聊给出群名、群主、管理员、成员、群公告。
只输出JSON：{"contacts":[{"real":"","nick":"","remark":"","sign":""}],${GJ}}`;
function replyP(ch) {
  const g = ch.type == 'g', me = meObj().nick, sk = S.assets.sticker.map(s => s.name).join('、');
  const hist = ch.msgs.slice(-30).map(m => `#${ch.msgs.indexOf(m)} ${m.f == 'me' ? me : m.f == 'sys' ? '系统' : rn(get(m.f))}: ${brief(m)}${m.t == 'transfer' && m.st ? `(${m.st})` : ''}`).join('\n');
  return `【当前聊天】${g ? `群聊「${ch.name}」 群主:${ch.owner ? rn(get(ch.owner)) : me} 管理员:${ch.admins.map(i => rn(get(i))).join('、') || '无'}\n成员：${ch.members.map(i => { const c = get(i); return `${rn(c)}(网名${c.nick}${ch.titles[i] ? '，头衔' + ch.titles[i] : ''})`; }).join('、')}${ch.notice ? '\n群公告：' + ch.notice : ''}` : `与${rn(ch)}（网名${ch.nick}，签名：${ch.sign || '无'}）的私聊`}
【聊天记录】\n${hist || '（空）'}
请继续这段手机聊天${g ? '，让群成员根据各自人设自然互动（可多人发言、互相接话）' : `，你扮演${rn(ch)}回复${me}`}。像真人发消息：口语化、短句、可连发1-5条，符合人设与当前剧情。${ch.cfg.tr ? `\n角色使用${ch.cfg.lang || '外语'}，text用该语言，并在tr字段附中文翻译。` : ''}
type可选：text文字 / sticker表情包(text填表情描述${sk ? '，可用：' + sk : ''}) / img图片(text填画面描述) / voice语音(text填说的话) / transfer转账(amount金额) / accept收下对方转账 / pat拍一拍(text填被拍的人) / react给某条消息贴表情(i填#序号，text填一个emoji)。
只输出JSON：{"msgs":[{"from":"发送者真实姓名","type":"text","text":"","tr":"","amount":0,"i":0}]}`;
}

/* ---------- 生成 ---------- */
let busy = 0;
async function gen(ch) {
  if (busy) return toast('对方正在输入中…'); busy = ch.id; emit('chat');
  try {
    const d = json(await llm(await sysCtx(), replyP(ch), '聊天回复')), ms = d?.msgs || (Array.isArray(d) && d); if (!ms) throw Error('返回格式不对，可到 设置→调用日志 查看');
    for (const m of ms) { ch.type == 'p' && (m.from = ''); const x = addMsg(ch, m); saveD(); emit('chat'); x && !viewing(ch.id) && notify(ch, x); await sleep(450 + Math.min(1600, String(m.text || '').length * 60)); }
  } catch (e) { toast('生成失败：' + e.message); } finally { busy = 0; emit('chat'); }
}
export async function syncStory(t) { try { applyDelta(json(await llm(await sysCtx(), SCAN(t), '剧情同步'))).forEach(([ch, x]) => notify(ch, x)); } catch (e) { toast('剧情同步失败：' + e.message); } }
const trans = async (x, ch) => { try { x.tr = String(await llm('你是翻译器，只输出译文。', `翻译成${x.f == 'me' ? ch.cfg.lang || '英语' : '中文'}：\n${x.c}`, '翻译')).trim(); x.trShow = 1; saveD(); emit('chat'); } catch (e) { toast(e.message); } };
const push = (ch, m) => { const x = { f: 'me', t: 'text', c: '', ts: +now(), ...m }; ch.msgs.push(x); saveD(); emit('chat'); ch.cfg.trMine && ch.cfg.lang && x.t == 'text' && trans(x, ch); return x; };
on('chat', () => { const t = top(); if (!t?.live) return; t.chat ? (t.reb(), $('.pg-t', t.el).innerHTML = t.title()) : t.re(); });

/* ---------- 渲染 ---------- */
const tT = ts => { const d = new Date(ts); return (d.toDateString() == now().toDateString() ? '' : `${d.getMonth() + 1}月${d.getDate()}日 `) + hm(d); };
const ago = ts => { const s = (now() - ts) / 6e4; return s < 1 ? '刚刚' : s < 60 ? (s | 0) + '分钟前' : s < 1440 ? (s / 60 | 0) + '小时前' : tT(ts); };
const avH = (c, ch, id) => { const fr = S.assets.frame.find(a => a.id == ch.cfg.frame)?.img; return `<div class="avw" data-a="avc" data-x="${id}"><img class="av" src="${esc(avOf(c))}">${fr ? `<img class="frm" src="${esc(fr)}">` : ''}</div>`; };
function body(m, i) {
  switch (m.t) {
    case 'sticker': return m.img ? `<img class="stk" src="${esc(m.img)}">` : `[表情] ${esc(m.c)}`;
    case 'img': return m.url ? `<img class="pic" src="${esc(m.url)}">` : `<div class="picd">🖼 ${esc(m.c)}</div>`;
    case 'voice': return `<div class="vc" data-a="play" data-x="${i}">${I.wave}${Math.max(1, Math.ceil(m.c.length / 4))}″</div>${m.open ? `<div class="vt">${esc(m.c)}</div>` : ''}`;
    case 'transfer': return `<div class="tf ${m.st ? 'done' : ''}" data-a="tf" data-x="${i}"><b>¥${(+m.amt).toFixed(2)}</b><small>${esc(m.st || m.c || (m.f == 'me' ? '待对方收款' : '请收款'))}</small><i>转账</i></div>`;
    default: return esc(m.c).replace(/\n/g, '<br>');
  }
}
function msgs(ch) {
  let p, o = ''; const cf = ch.cfg, g = ch.type == 'g', me = meObj(), bub = S.assets.bubble.find(a => a.id == cf.bub);
  ch.msgs.forEach((m, i) => {
    const gap = !p || m.ts - p.ts > 3e5; gap && (o += `<div class="tm">${tT(m.ts)}</div>`);
    if (m.t == 'pat' || m.t == 'sys') o += `<div class="sys">${esc(m.c)}</div>`;
    else {
      const mine = m.f == 'me', c = mine ? me : get(m.f) || { nick: '已删除' }, same = !gap && p?.f == m.f && p.t != 'pat' && p.t != 'sys';
      const tag = g && !mine ? (ch.owner == m.f ? '<em class="own">群主</em>' : ch.admins.includes(m.f) ? '<em class="adm">管理员</em>' : '') + (ch.titles[m.f] ? `<em>${esc(ch.titles[m.f])}</em>` : '') : '';
      o += `<div class="msg ${mine ? 'me' : ''} ${same ? 'same' : ''}" data-lp="mlp" data-x="${i}">${avH(c, ch, m.f)}<div class="mc">${!mine && !(same && cf.cont) ? `<div class="mn">${tag}${esc(nm(c))}</div>` : ''}<div class="mr"><div class="bub b-${m.t}">${body(m, i)}${m.tr && (cf.tr || m.trShow) ? `<div class="tr">${esc(m.tr)}</div>` : ''}</div><span class="mt">${m.inj ? '<i class="ij">↪</i>' : ''}<time>${hm(new Date(m.ts))}</time></span></div>${m.re?.length ? `<div class="re">${m.re.join('')}</div>` : ''}</div></div>`;
    }
    p = m;
  });
  return `${bub ? `<style>${bub.css}</style>` : ''}<div class="cv">${o || '<div class="sys">还没有消息，打个招呼吧 ✧</div>'}</div>`;
}
const list = () => [...D().chats].sort((a, b) => (b.pin | 0) - (a.pin | 0) || (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0)).map(c => {
  const m = c.msgs.at(-1);
  return `<div class="cl ${c.pin ? 'pin' : ''}" data-a="open" data-x="${c.id}" data-lp="clp"><div class="avw"><img class="av" src="${esc(avOf(c))}">${c.unread ? `<i class="badge">${c.unread > 99 ? '99+' : c.unread}</i>` : ''}</div><div class="cl-m"><b>${esc(nm(c))}${c.type == 'g' ? ` <small>(${c.members.length + 1})</small>` : ''}</b><small>${esc(m ? (c.type == 'g' && m.f != 'me' && m.f != 'sys' ? nm(get(m.f)) + ': ' : '') + brief(m) : c.type == 'g' ? c.notice : c.sign)}</small></div><time>${m ? tT(m.ts).split(' ')[0] : ''}</time></div>`;
}).join('') || `<div class="empty"><p>还没有联系人 ✧</p>${btn('aiInit', '✨ AI识别剧情联系人', '', 'pri')}${btn('plus', '手动添加')}</div>`;
const post = (p, fs) => {
  const a = p.a == 'me' ? meObj() : get(p.a) || { nick: '已删除' }, me = nm(meObj()), lk = p.likes.includes(me);
  return `<article class="po"><img class="av" src="${esc(avOf(a))}" data-a="pfeed" data-x="${p.a}"><div class="po-m"><b class="po-n">${esc(nm(a))}</b>${fs == 'tw' ? `<small class="po-h">@${esc(a.nick || a.real)} · ${ago(p.ts)}</small>` : ''}<p>${esc(p.c)}</p>${p.url ? `<img class="po-i" src="${esc(p.url)}">` : p.imgd ? `<div class="picd">🖼 ${esc(p.imgd)}</div>` : ''}
<div class="po-a">${fs != 'tw' ? `<time>${ago(p.ts)}</time>` : ''}<span data-a="like" data-x="${p.id}" class="${lk ? 'on' : ''}">${lk ? '♥' : '♡'} ${p.likes.length || ''}</span><span data-a="cmt" data-x="${p.id}">💬 ${p.cm.length || ''}</span>${p.a == 'me' ? `<span data-a="pdel" data-x="${p.id}">删除</span>` : ''}</div>
${p.likes.length || p.cm.length ? `<div class="po-c">${p.likes.length ? `<div class="lk">♡ ${esc(p.likes.join('，'))}</div>` : ''}${p.cm.map(c => `<div><b>${esc(c.f)}</b>：${esc(c.c)}</div>`).join('')}</div>` : ''}</div></article>`;
};
function feed(aid, st = S.style) {
  const fs = FS[st], u = aid && aid != 'me' ? get(aid) : meObj(), ps = D().posts.filter(p => !aid || p.a == aid), sg = esc(u?.sign || ''), av = esc(avOf(u)), n = esc(nm(u));
  const hd = fs == 'wx' ? `<div class="fw-cv" ${(!aid || aid == 'me') && D().me.cover ? `style="background-image:url('${esc(D().me.cover)}')"` : ''}><b>${n}</b><img class="av" src="${av}"></div><p class="fw-sg">${sg}</p>`
    : fs == 'qq' ? `<div class="fq-h"><img class="av" src="${av}"><div><b>${n}</b><small>${sg || '这个人很懒～'}</small></div></div><div class="fq-n">${['说说', '日志', '相册', '留言', '更多'].map(x => `<span><i>${x[0]}</i>${x}</span>`).join('')}</div>${aid ? '' : '<div class="fq-in" data-a="post">分享新鲜事...</div>'}`
      : `<div class="ft-h"><img class="av" src="${av}"><b>${n}</b><small>@${esc(u?.nick || u?.real)}</small>${sg ? `<p>${sg}</p>` : ''}</div>`;
  return `<div class="feed f-${fs}">${hd}${ps.map(p => post(p, fs)).join('') || '<p class="empty">还没有动态，点右上角 ✦ 让大家发点什么</p>'}</div>`;
}
const meP = () => {
  const f = fx(D().me), m = meObj();
  return `<div class="me-c" data-a="img" data-x="av"><img class="av" src="${esc(avOf(m))}"><div><b>${esc(m.nick)}</b><small>${esc(m.sign || '点击头像更换 · 下方编辑签名')}</small></div></div>${sec('me', [
    ['p', '个人资料', f.inp('nick', '昵称') + f.inp('sign', '签名') + f.img('cover', '动态封面')],
    ['w', '钱包', `<div class="wal"><small>余额</small><b>¥${(+D().me.wallet || 0).toFixed(2)}</b></div>` + f.inp('wallet', '修改余额', 'number')],
    ['s', '默认风格', f.seg('$style', STY) + '<p class="tip">决定新聊天样式与动态页：微信→朋友圈 / QQ→空间 / Kakao·LINE→推特式动态。单个聊天可在聊天设置里单独改。</p>'],
    ['d', '我的动态', btn('myfeed', '查看我的' + FN[S.style])]])}`;
};
const tabs = tab => { const u = D().chats.reduce((a, c) => a + (c.unread || 0), 0); return `<nav class="tabs">${[['list', '消息', I.chat], ['feed', FN[S.style], I.star], ['me', '我', I.user]].map(([k, l, i]) => `<button data-a="tab" data-x="${k}" class="${tab == k ? 'on' : ''}">${i}<span>${l}</span>${k == 'list' && u ? `<i class="badge">${u}</i>` : ''}</button>`).join('')}</nav>`; };
const stCls = (el, c) => { const keep = el.classList.contains('in'); el.className = `pg ${c}${keep ? ' in' : ''}`; };

/* ---------- 动态操作（主页动态和个人动态共用） ---------- */
const P = id => D().posts.find(p => p.id == id);
async function genFeed(aid) {
  toast('正在刷新动态…'); const who = aid && aid != 'me' ? rn(get(aid)) : '';
  try { applyDelta({ posts: json(await llm(await sysCtx(), `为${who || '联系人们（挑2-3位）'}生成${who ? 2 : 3}条贴合人设与当前剧情的${FN[S.style]}动态，可附带其他联系人的点赞和评论，可以提到${meObj().nick}。\n只输出JSON：{"posts":[{"author":"真实姓名","text":"","img":"配图画面描述(可空)","likes":["名字"],"comments":[{"from":"名字","text":""}]}]}`, '生成动态'))?.posts }); }
  catch (e) { toast('生成失败：' + e.message); }
}
const FA = {
  like: id => { const p = P(id), me = nm(meObj()); p.likes = p.likes.includes(me) ? p.likes.filter(x => x != me) : [...p.likes, me]; saveD(); emit('chat'); },
  cmt: async id => {
    const p = P(id), r = await form('评论', [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c }); saveD(); emit('chat'); if (p.a == 'me') return;
    try { json(await llm(await sysCtx(), `${rn(get(p.a))}发了动态：“${p.c}”\n评论区：${p.cm.map(c => c.f + '：' + c.c).join('；')}\n请生成${rn(get(p.a))}（以及可能路过的联系人）对最新评论的回复1-2条。只输出JSON：{"comments":[{"from":"名字","text":""}]}`, '动态评论'))?.comments?.forEach(c => p.cm.push({ f: c.from, c: c.text })); saveD(); emit('chat'); } catch (e) { toast(e.message); }
  },
  pfeed: id => openFeed(id), myfeed: () => openFeed('me'),
  pdel: id => { D().posts = D().posts.filter(p => p.id != id); saveD(); emit('chat'); },
  post: async () => { const r = await form('发表动态', [['c', '这一刻的想法...', 'area'], ['url', '配图', 'img']]); if (!r?.c && !r?.url) return; D().posts.unshift({ id: uid(), a: 'me', c: r.c || '', url: r.url, ts: +now(), likes: [], cm: [] }); saveD(); emit('chat'); },
  fgen: (x, t, e, pg) => genFeed(pg.aid),
};
function openFeed(aid) { const st = aid && aid != 'me' ? sty(get(aid)) : S.style; page({ title: FN[st], aid, live: 1, cls: 'feedpg st-' + st, right: () => `<b data-a="fgen">${I.spark}</b>${aid == 'me' ? `<b data-a="post">${I.cam}</b>` : ''}`, body: () => feed(aid, st), acts: FA }); }

/* ---------- 添加联系人 ---------- */
async function aiInit() { toast('AI 正在读取剧情与世界书…'); try { const d = json(await llm(await sysCtx(), INIT(), '识别联系人')); applyDelta(d); toast(`已同步：${d?.contacts?.length || 0} 位联系人，${d?.groups?.length || 0} 个群`); } catch (e) { toast('识别失败：' + e.message); } }
async function fromWi() {
  const es = []; for (const b of await wiBooks()) es.push(...Object.values((await loadBook(b))?.entries || {})); if (!es.length) return toast('没有读取到世界书条目');
  const i = await menu(es.map((e, i) => [i, esc(e.comment || e.key?.join(',') || '条目' + e.uid)]), '选择世界书条目'); if (i == null) return; toast('正在解析条目…');
  try { applyDelta(json(await llm('你是小手机数据整理器，只输出JSON。', `根据以下世界书条目，整理出其中的人物（联系人）或群体（群聊）：\n${es[i].content}\n只输出JSON：{"contacts":[{"real":"","nick":"","remark":"","sign":""}],${GJ}}`, '世界书解析'))); toast('已添加'); } catch (e) { toast(e.message); }
}

/* ---------- 聊天 App ---------- */
let tab = 'list';
reg({
  id: 'chat', name: '聊天', icon: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M9.5 4C5.4 4 2 6.8 2 10.2c0 1.9 1 3.6 2.7 4.7L4 17.5l3-1.6c.8.2 1.6.3 2.5.3 4.1 0 7.5-2.8 7.5-6.2S13.6 4 9.5 4z"/><path opacity=".8" d="M22 14.6c0-2.3-1.7-4.3-4.2-5.2l.1.9c0 4-3.7 7.2-8.4 7.4 1.1 1.4 3.1 2.3 5.3 2.3.6 0 1.2-.1 1.8-.2l2.4 1.2-.5-2c1.4-1 2.5-2.6 2.5-4.4z"/></svg>',
  open: () => page({
    cls: 'chatapp', live: 1, model: () => D().me, title: () => ({ list: '消息', feed: FN[S.style], me: '我' })[tab],
    right: () => tab == 'list' ? `<b data-a="plus">${I.plus}</b>` : tab == 'feed' ? `<b data-a="fgen">${I.spark}</b><b data-a="post">${I.cam}</b>` : '',
    body: () => tab == 'list' ? list() : tab == 'feed' ? feed() : meP(), foot: () => tabs(tab), after: el => stCls(el, 'chatapp st-' + S.style),
    onChange: k => k == '$style' && emit('chat'),
    acts: {
      ...FA, aiInit, tab: (x, t, e, pg) => { tab = x; pg.re(); }, open: id => openChat(id),
      clp: async id => { const c = get(id), k = await menu([['pin', c.pin ? '取消置顶' : '置顶聊天'], ['read', '标为已读'], ['del', c.type == 'g' ? '删除群聊' : '删除联系人', 'danger']], esc(nm(c))); k == 'pin' && (c.pin = !c.pin); k == 'read' && (c.unread = 0); k == 'del' && await ok('确定删除？聊天记录也会清除') && rm(c); saveD(); emit('chat'); },
      plus: async () => {
        const k = await menu([['f', '👤 添加好友'], ['g', '👥 发起群聊'], ['ai', '✨ AI识别剧情联系人'], ['wi', '📖 从世界书添加']]);
        if (k == 'f') { const r = await form('添加好友', [['av', '头像', 'img'], ['nick', '昵称（网名）'], ['real', '真实姓名'], ['remark', '备注'], ['sign', '个性签名']]); r && (r.nick || r.real) && add(blank('p', r)); }
        if (k == 'g') { const r = await form('发起群聊', [['av', '群头像', 'img'], ['name', '群名'], ['notice', '群公告', 'area'], ['members', '选择成员', 'multi', D().chats.filter(c => c.type == 'p').map(c => [c.id, nm(c)])]]); r?.name && add(blank('g', { ...r, members: r.members || [] })); }
        k == 'ai' && await aiInit(); k == 'wi' && await fromWi(); saveD(); emit('chat');
      },
    },
  }),
});
const rm = c => { D().chats = D().chats.filter(x => x != c); D().chats.forEach(g => { g.members = g.members.filter(m => m != c.id); g.admins = g.admins.filter(m => m != c.id); }); };

/* ---------- 聊天窗口 ---------- */
let avL, avT;
export function openChat(id) {
  const ch = get(id); if (!ch) return; if (top()?.cls != 'chatapp') { home(); APPS.chat.open(); } ch.unread = 0; saveD();
  const cf = ch.cfg, cls = () => `chat st-${sty(ch)} ${ch.type == 'g' ? 'grp' : ''} ${cf.dark ? 'dark' : ''} sh-${cf.shape || 'def'} av-${cf.avs || 'def'} ${cf.showAv ? '' : 'noav'} ${cf.cont ? 'cont' : ''}`;
  const pan = (pg, k) => { const p = $('.pan', pg.el), on = p.dataset.k != k || !p.classList.contains('on'); p.dataset.k = k; p.classList.toggle('on', on);
    p.innerHTML = k == 'stk' ? S.assets.sticker.map((s, i) => `<div class="sk" data-a="sk" data-x="${i}"><img src="${esc(s.img)}" title="${esc(s.name)}"></div>`).join('') || '<p class="tip">还没有表情包，去「主题」里添加吧</p>'
      : [['pimg', '图片', '🖼'], ['pai', 'AI生图', '🎨'], ['ptf', '转账', '¥'], ['ppat', '拍一拍', '👋'], ['pvo', '语音', '🎙'], ['pgen', '让TA回复', '✨']].map(([a, l, i]) => `<div class="tl" data-a="${a}"><i>${i}</i>${l}</div>`).join(''); };
  const pat = id => push(ch, { t: 'pat', c: `“${nm(meObj())}” 拍了拍 “${id == 'me' ? '自己' : nm(get(id))}”` });
  const tool = async (pg, f) => { $('.pan', pg.el).classList.remove('on'); await f(); };
  const pg = page({
    chat: id, live: 1, model: () => ch, cls: cls(), onClose: () => setTimeout(() => emit('chat')),
    title: () => `<b>${esc(nm(ch))}${ch.type == 'g' ? ` (${ch.members.length + 1})` : ''}</b>${busy == id ? '<small>对方正在输入…</small>' : ''}`,
    right: () => `<b data-a="cset">${I.more}</b>`, body: () => msgs(ch),
    foot: () => `<div class="ib"><button data-a="pan" data-x="stk">${I.smile}</button><textarea class="ip" rows="1" placeholder="发消息…"></textarea><button data-a="pan" data-x="more">${I.plus}</button><button class="go" data-a="send"><span class="s1">${I.spark}</span>${I.send.replace('<svg', '<svg class="s2"')}</button></div><div class="pan"></div>`,
    after: el => {
      stCls(el, cls()); const b = $('.pg-b', el), ip = $('.ip', el), go = $('.go', el); b.style.background = cf.bg ? `url("${cf.bg}") center/cover` : ''; b.scrollTop = b.scrollHeight;
      ip.oninput = () => { go.classList.toggle('has', !!ip.value.trim()); ip.style.height = 'auto'; ip.style.height = Math.min(100, ip.scrollHeight) + 'px'; };
      ip.onkeydown = e => e.key == 'Enter' && !e.shiftKey && !e.isComposing && (e.preventDefault(), pg.acts.send());
    },
    acts: {
      send: () => { const ip = $('.ip', pg.el), v = ip.value.trim(); if (!v) return gen(ch); ip.value = ''; ip.oninput(); push(ch, { c: v }); },
      pan: k => pan(pg, k), cset: () => cset(ch),
      sk: i => { const s = S.assets.sticker[i]; push(ch, { t: 'sticker', c: s.name, img: s.img }); },
      pimg: () => tool(pg, async () => { const u = await pickImg(800); u && push(ch, { t: 'img', c: '图片', url: u }); }),
      pai: () => tool(pg, async () => { const r = await form('AI生图并发送', [['d', '画面描述', 'area']]); if (!r?.d) return; const x = push(ch, { t: 'img', c: r.d }); try { x.url = await genImg(r.d); saveD(); emit('chat'); } catch (e) { toast('生图失败：' + e.message); } }),
      ptf: () => tool(pg, async () => { const r = await form('转账', [['amt', '金额', 'number'], ['c', '备注']]); if (!(+r?.amt > 0)) return; D().me.wallet -= +r.amt; push(ch, { t: 'transfer', amt: +r.amt, c: r.c }); }),
      ppat: () => tool(pg, async () => { if (ch.type == 'p') return pat(ch.id); const k = await menu(ch.members.map(i => [i, esc(nm(get(i)))]), '拍一拍谁'); k && pat(k); }),
      pvo: () => tool(pg, async () => { const r = await form('发送语音', [['c', '要说的话', 'area']]); r?.c && push(ch, { t: 'voice', c: r.c }); }),
      pgen: () => tool(pg, () => gen(ch)),
      avc: id => { clearTimeout(avT); if (avL == id) { avL = 0; return pat(id); } avL = id; avT = setTimeout(() => { avL = 0; id != 'sys' && openFeed(id); }, 280); },
      tf: async i => { const m = ch.msgs[i]; if (m.f == 'me' || m.st || !await ok(`收下 ¥${m.amt}？`)) return; m.st = '已收款'; D().me.wallet = +D().me.wallet + m.amt; saveD(); emit('chat'); },
      play: i => { const m = ch.msgs[i]; m.open = 1; saveD(); emit('chat'); tts(m.c, m.f == 'me' ? '' : get(m.f)?.voice).catch(e => toast('语音失败：' + e.message)); },
      mlp: async i => {
        const m = ch.msgs[i], k = await menu([...EMO.map(e => ['e' + e, e, 'emo']), ['inj', m.inj ? '取消注入正文' : '注入正文'], ['tts', '朗读'], ['tr', m.tr ? (m.trShow ? '隐藏翻译' : '显示翻译') : '翻译'], ['copy', '复制'], ['regen', '从这条往后重新生成'], ['del', '删除', 'danger']]); if (!k) return;
        if (k[0] == 'e') { const e = k.slice(1); m.re = m.re?.includes(e) ? m.re.filter(x => x != e) : [...(m.re || []), e]; }
        k == 'inj' && (m.inj = !m.inj); k == 'tts' && tts(m.c, get(m.f)?.voice).catch(e => toast(e.message)); k == 'tr' && (m.tr ? (m.trShow = !m.trShow) : trans(m, ch));
        k == 'copy' && navigator.clipboard?.writeText(m.c); k == 'del' && ch.msgs.splice(i, 1); k == 'regen' && (ch.msgs.splice(+i + (m.f == 'me' ? 1 : 0)), gen(ch));
        saveD(); emit('chat');
      },
    },
  });
}

/* ---------- 聊天设置 ---------- */
function cset(ch) {
  const f = fx(ch), g = ch.type == 'g', mem = () => ch.members.map(i => [i, nm(get(i))]);
  page({
    title: g ? '群聊信息' : '聊天信息', model: () => ch, onClose: () => setTimeout(() => top()?.re()),
    body: () => sec('cset', [
      ['info', '基本信息', g ? f.img('av', '群头像') + f.inp('name', '群名') + f.inp('no', '群号') + f.area('notice', '群公告') + f.sel('owner', '群主', [['', '我'], ...mem()]) + f.multi('admins', '管理员', mem())
        : f.img('av', '头像') + f.inp('nick', '昵称（网名）') + f.inp('real', '真实姓名') + f.inp('remark', '备注') + f.inp('sign', '个性签名') + f.inp('voice', 'TTS音色', 'text', '可留空')],
      g && ['mem', `群成员 · ${ch.members.length + 1}`, `<div class="mems">${ch.members.map(i => `<div class="mem"><img class="av" src="${esc(avOf(get(i)))}"><b>${esc(nm(get(i)))}</b><input data-k="titles.${i}" value="${esc(ch.titles[i] || '')}" placeholder="群头衔"><i data-a="mdel" data-x="${i}">×</i></div>`).join('')}</div>${btn('madd', '＋ 邀请成员')}`],
      ['tr', '翻译', f.tog('cfg.tr', '显示对方消息的翻译') + f.inp('cfg.lang', '对方语言', 'text', '如：韩语 / 日语') + f.tog('cfg.trMine', '把我的消息译成对方语言')],
      ['look', '美化', f.sel('cfg.style', '风格', [['', '跟随默认'], ...STY]) + f.sel('cfg.bub', '气泡样式', [['', '默认'], ...S.assets.bubble.map(a => [a.id, a.name])]) + '<div class="col"><span>气泡形状</span>' + f.seg('cfg.shape', [['', '默认'], ['round', '圆润'], ['sq', '方形'], ['tail', '尖角']]) + '</div><div class="col"><span>头像形状</span>' + f.seg('cfg.avs', [['', '默认'], ['ci', '圆形'], ['sq', '方形']]) + '</div>'
        + f.tog('cfg.showAv', '显示头像') + f.tog('cfg.cont', '连续消息合并气泡') + f.tog('cfg.dark', '夜间模式') + f.img('cfg.bg', '聊天背景')
        + `<div class="col"><span>头像框</span><div class="frs">${[{ id: '' }, ...S.assets.frame].map(a => `<div class="fr ${ch.cfg.frame == a.id ? 'on' : ''}" data-a="setfr" data-x="${a.id}">${a.img ? `<img src="${esc(a.img)}">` : '无'}</div>`).join('')}</div></div>` + btn('impcss', '导入气泡 CSS 文件')],
      ['link', '正文联动', f.tog('cfg.inj', '整个聊天注入正文') + `<p class="tip">${S.mode == 'linked' ? '开启后角色在正文里会知道这段手机聊天；也可长按单条消息选择“注入正文”。' : '当前为线上模式：手机内容不会传回正文（可在 设置→联动模式 切换）。'}</p>`],
      ['dz', '更多', btn('clr', '清空聊天记录', '', 'danger') + btn('rm', g ? '删除并退出群聊' : '删除联系人', '', 'danger')]]),
    acts: {
      setfr: (x, t, e, pg) => { ch.cfg.frame = x; saveD(); pg.re(); },
      mdel: (i, t, e, pg) => { ch.members = ch.members.filter(x => x != i); ch.admins = ch.admins.filter(x => x != i); saveD(); pg.re(); },
      madd: async (x, t, e, pg) => { const k = await menu(D().chats.filter(c => c.type == 'p' && !ch.members.includes(c.id)).map(c => [c.id, esc(nm(c))]), '邀请成员'); if (!k) return; ch.members.push(k); ch.msgs.push({ f: 'sys', t: 'sys', c: `“${nm(meObj())}”邀请“${nm(get(k))}”加入了群聊`, ts: +now() }); saveD(); pg.re(); },
      impcss: async (x, t, e, pg) => { const fl = await pickFile('.css,text/css'); if (!fl) return; const a = { id: uid(), name: fl.name.replace(/\.\w+$/, ''), css: await fl.text() }; S.assets.bubble.push(a); ch.cfg.bub = a.id; C().saveSettingsDebounced(); saveD(); pg.re(); },
      clr: async () => { if (await ok('清空全部聊天记录？')) { ch.msgs = []; saveD(); toast('已清空'); } },
      rm: async () => { if (await ok('确定删除？')) { rm(ch); saveD(); back(); back(); } },
    },
  });
}
