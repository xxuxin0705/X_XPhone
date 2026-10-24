// 聊天 · App：消息列表 / 通讯录 / 动态（朋友圈·QQ空间·推特式）/ 我 / AI 生成联系人
import { C, S, D, saveD, esc, uid, $, reg, page, back, menu, form, ok, toast, fx, btn, sec, nm, rn, avOf, meObj, brief, now, llm, json, sysCtx, I, task, sheet, wiBooks, loadBook, wiText, notify, emit, drop } from '../../core.js';
import { get, blank, add, upsert, applyDelta, sty, rm, isMe, STY, TN, CN, FS, FN } from './data.js';
import { openChat, cset, tT } from './talk.js';
export { openChat, applyDelta };

/* ---------- 提示词 ---------- */
const names = () => D().chats.map(c => c.type == 'g' ? `群「${c.name}」` : rn(c)).join('、') || '无';
const GJ = '"groups":[{"name":"群名","owner":"群主真实姓名","admins":[],"members":["真实姓名"],"notice":"群公告"}]';
export const SCAN = t => `【最新剧情】\n${t}\n\n任务：找出这段剧情里发生在线上（手机/社交软件）的事件并同步到小手机：发消息、加好友、拉群/进群、发朋友圈动态、转账、拍一拍等。已有：${names()}。剧情里没出现的不要编。
只输出JSON：{"contacts":[{"real":"真实姓名","nick":"网名","sign":"签名"}],${GJ},"msgs":[{"chat":"私聊对象真实姓名或群名","from":"发送者真实姓名","type":"text","text":"内容"}],"posts":[{"author":"","text":""}]}，没有的项给空数组。`;
// 生成联系人：只要 {{user}} 视角（已加好友的人、{{user}}本人在里面的群）。
// 提速：① 用「一行一个」的竖线格式代替 JSON（输出更短，流式收到一行就立刻加一个，超时也能保住已生成的部分）
//       ② 自动关思考 ③ 世界书 / 正文只取够用的长度 ④ 限制数量、签名公告写短
const LF = u => `【输出格式】不要JSON、不要解释、不要编号，每行一条，字段用 | 分隔：
人|真实姓名|网名|备注|性别|个性签名
群|群名|群主真实姓名|管理员(逗号分隔，没有就空着)|成员真实姓名(逗号分隔，不写${u})|群公告
说明：备注=${u}会怎么备注TA（如：哥 / 班长 / 沈学长）；性别写 男 或 女；签名15字内；公告25字内。先写完所有「人」再写「群」。
示例：
人|沈知遥|遥遥无期|沈学长|男|今天也在图书馆
群|高三(2)班|林老师||沈知遥,周小满|周五前交志愿表`;
const INIT = r => { const u = C().name1; return `任务：${r.mode == 'me' ? `按用户提供的信息生成${u}手机里的联系人/群聊：${r.info}\n数量：联系人 ${+r.n || 0} 个，群聊 ${+r.g || 0} 个。` : `根据人设、世界书和剧情，列出${u}手机里实际存在的联系人和群聊，按剧情实际需要（联系人一般不超过12个、群聊不超过4个），不要凑数。`}
规则：只从${u}本人的视角出发——联系人必须是${u}认识并已加为好友的人；群聊必须是${u}本人已加入的群（${u}不在的群一律不要生成）。不要包含${u}自己。已有：${names()}，不要重复。
直接按格式输出，不需要分析或推理过程。
${LF(u)}`; };
const sp = s => String(s || '').split(/[,，、;；\s]+/).map(x => x.trim()).filter(x => x && !/^(无|空|没有|-+|—+|null)$/i.test(x));
// 解析一行：人|… 或 群|…
export const pline = l => {
  const f = String(l).trim().replace(/^[-*•>\d.、)）\s]+/, '').replace(/^[「【[]|[」】\]]$/g, '').split(/\s*[|｜]\s*/), k = f[0];
  if (/^(人|联系人|好友)$/.test(k) && f[1]) return { contacts: [{ real: f[1], nick: f[2] || f[1], remark: f[3] || '', sex: (String(f[4]).match(/[男女]/) || [''])[0], sign: f.slice(5).join('|') }] };
  if (/^(群|群聊)$/.test(k) && f[1]) { const o = sp(f[2])[0]; return { groups: [{ name: f[1], owner: o, admins: sp(f[3]), members: sp(f[4]), notice: f.slice(5).join('|') }] }; }
  return null;
};
// 兼容模型仍然输出 JSON（旧短键 / 长键都认）
const unz = d => ({ contacts: (d?.c || d?.contacts || []).map(x => ({ real: x.n ?? x.real, nick: x.k ?? x.nick, remark: x.r ?? x.remark, sign: x.s ?? x.sign, sex: x.x ?? x.sex })), groups: (d?.g || d?.groups || []).map(x => ({ name: x.n ?? x.name, owner: x.o ?? x.owner, admins: x.a ?? x.admins, members: x.m ?? x.members, notice: x.t ?? x.notice })) });
/* ---------- 生成联系人：保证 2 分钟内出结果 ----------
   glm-5.3-flash 这类模型思考关不掉，思考长度主要取决于喂给它多少材料，所以：
   ① 不再把整本世界书塞进去，先在本地把世界书里的「人物条目」挑出来，压成「名字（性别）：一句简介」的名单；
   ② 45 秒还没出第一个联系人，就同时发一个只带名单的极简请求（几乎没什么可想的），谁先出结果用谁、另一路自动停掉；
   ③ 115 秒硬性截止：先从模型的思考草稿里捞已经写好的「人|…」行，还没有就直接按世界书人物名单添加，绝不空等。 */
const STOPW = /(设定|世界|规则|地点|地图|学校|学院|城市|国家|组织|历史|系统|背景|社团|班级|事件|剧情|道具|物品|技能|能力|种族|势力|格式|说明|开场|开头|状态|总览|大纲|时间|关系|指南|提示|风格|文风|nsfw|cot|思维|输出|规范|注意|前言|序章|简介|介绍|总则|变量|面板)/i;
const cutS = (s, n) => (s = String(s || '').replace(/\s+/g, ' ').trim()).length > n ? s.slice(0, n) + '…' : s;
export async function people() {
  const out = [], seen = new Set(), add = (n, b = '', sex = '') => { n = String(n || '').replace(/[【】\[\]《》「」『』()（）★☆♡♥✦·\s]/g, '').trim(); if (!n || n.length > 10 || seen.has(n) || isMe(n)) return; seen.add(n); out.push({ n, b, sex }); };
  for (const bk of await wiBooks()) for (const e of Object.values((await loadBook(bk))?.entries || {})) {
    if (e.disable) continue; const t = String(e.comment || e.key?.[0] || '').trim(), c = String(e.content || '');
    const nm2 = c.match(/(?:姓名|名字|全名|角色名|Name)\s*[:：]\s*([^\n，,。;；|/]{2,10})/i)?.[1], human = nm2 || (/性别|年龄|身高|性格|外貌|生日|身份/.test(c) && t && t.length <= 10 && !STOPW.test(t));
    human && add(nm2 || t, cutS(c, 80), c.match(/性别\s*[:：]\s*([男女])/)?.[1] || '');
  }
  (C().chat || []).slice(-40).forEach(m => !m.is_user && !m.is_system && add(m.name));
  return out.slice(0, 30);
}
const pplTxt = P => P.map(p => `${p.n}${p.sex ? `（${p.sex}）` : ''}${p.b ? '：' + p.b : ''}`).join('\n');
// 精简上下文：人设 + 角色卡 + 世界书人物名单 + 最近几条剧情
async function contactSys(P) {
  const c = C(), ch = c.characters?.[c.characterId], sb = (s, n) => cutS(c.substituteParams?.(s || '') ?? s, n), strip = s => String(s || '').replace(/<[^>]*>/g, '');
  const wi = P.length ? `【世界书里的人物】\n${cutS(pplTxt(P), 2600).replace(/…$/, '')}` : `【世界书】${sb(await wiText((c.chat || []).slice(-6).map(m => m.mes).join(' ')), 1500)}`;
  return `你是小手机的数据生成器，严格按要求的格式输出。思考要非常简短（几句话即可），想好立刻输出，不要反复推敲。
【用户】${c.name1}：${sb(c.powerUserSettings?.persona_description, 500)}
【角色卡】${c.name2}：${sb(ch?.description, 1500)}
${wi}
【最近剧情】${cutS((c.chat || []).filter(m => !m.is_system).slice(-6).map(m => `${m.name}: ${cutS(strip(m.mes), 260)}`).join('\n'), 1500)}`;
}
const quickP = (P, r) => { const u = C().name1; return `${r?.mode == 'me' ? `按这段信息生成${u}的联系人：${r.info}\n` : ''}从下面这些人里挑出${u}认识、会加好友的人（不超过12个），直接输出，不要分析：\n${P.map(p => p.n + (p.sex ? `（${p.sex}）` : '')).join('、') || C().name2}\n${LF(u)}\n群可以不写。`; };
// o: { lim 截止毫秒, bk 备用请求启动毫秒, quick: {sys, prompt}, people }（数字可调，测试用）
export async function genContacts(sys, prompt, desc, sg, prog, o = {}) {
  const old = new Set(D().chats.map(c => c.id)), LIM = o.lim ?? 115e3, BK = o.bk ?? 45e3, ac = new AbortController();
  let got = 0, settle, alive = 0, lastErr, bkOn = 0, how = ''; const fin = new Promise(r => settle = r), drafts = [], t0 = Date.now();
  const stopAll = () => ac.abort(), cancel = () => { stopAll(); settle('cancel'); }; sg?.aborted ? cancel() : sg?.addEventListener('abort', cancel);
  const count = () => `已收到 ${D().chats.filter(c => !old.has(c.id) && (c.type == 'g' || c.fr !== 0)).length} 个`;
  const run = (s, p, d) => {
    let done = 0, rs = ''; const i = drafts.push('') - 1; alive++;
    const eat = (txt, end) => { const ls = String(txt).split('\n'), n = end ? ls.length : ls.length - 1; for (; done < n; done++) { const x = pline(ls[done]); x && (applyDelta(x), got++); } got && prog?.(count()); };
    llm(s, p, d, ac.signal, { fast: 1, aux: 1, onText: t => eat(t), onThink: (n, r) => { drafts[i] = rs += r; got || prog?.(`模型思考中 ${n}字 · ${(Date.now() - t0) / 1e3 | 0}s`); } })
      .then(raw => { eat(raw, 1); if (!got) { const j = json(raw); j && applyDelta(unz(j)); } settle('ok'); },
        e => { lastErr = e; if (ac.signal.aborted) return; if (--alive) return; o.quick && !bkOn ? backup() : settle('err'); });
  };
  const backup = () => { if (bkOn || ac.signal.aborted || !o.quick) return; bkOn = 1; prog?.('同时用精简方式生成…'); run(o.quick.sys, o.quick.prompt, desc + '·精简'); };
  const bt = setTimeout(() => got || backup(), BK), dt = setTimeout(() => settle('late'), LIM);
  run(sys, prompt, desc);
  const res = await fin; clearTimeout(bt); clearTimeout(dt); sg?.removeEventListener('abort', cancel); stopAll(); // 有结果了 / 到点了：另一路停掉
  const added = () => D().chats.some(c => !old.has(c.id));
  if (res != 'ok' && !sg?.aborted && !added()) { for (const d of drafts) for (const l of d.split('\n')) { const x = pline(l); x && applyDelta(x); } added() && (how = '（模型还在思考，已从它的草稿里取出）'); }
  res == 'late' && got && (how = '（2 分钟到了，先保存已经生成的部分）');
  if (res == 'late' && !sg?.aborted && !added() && o.people?.length) { applyDelta({ contacts: o.people.slice(0, 12).map(p => ({ real: p.n, nick: p.n, sex: p.sex })) }); how = '（模型太慢，已先按世界书人物添加，网名和签名可以稍后再改）'; }
  const nw = D().chats.filter(c => c.type == 'p' && c.fr !== 0 && !old.has(c.id)), gs = D().chats.filter(c => c.type == 'g' && !old.has(c.id));
  nw.length && setTimeout(() => review(nw, gs), 500);
  if (sg?.aborted) throw Error('已取消');
  if (!nw.length && !gs.length) throw res == 'late' ? Error('模型 2 分钟内没有给出结果，世界书里也没找到人物条目，可以换个不思考的「生成用模型」再试') : lastErr || Error('没有识别到新的联系人（可能都已存在，或返回格式不对，可在调用日志查看）');
  if (res == 'err' && lastErr) throw Error(`${lastErr.message}（已先保存 ${nw.length} 位联系人 · ${gs.length} 个群）`);
  return `已添加 ${nw.length} 位联系人 · ${gs.length} 个群${how}`;
}
export const syncStory = t => task('剧情同步中', async sg => { const o = applyDelta(json(await llm(await sysCtx(), SCAN(t), '剧情同步', sg, { aux: 1 }))); o.forEach(([ch, x]) => notify(ch, x)); return o.length ? `剧情同步：${o.length} 条新消息` : '剧情同步完成'; });

/* ---------- 渲染 ---------- */
const ago = ts => { const s = (now() - ts) / 6e4; return s < 1 ? '刚刚' : s < 60 ? (s | 0) + '分钟前' : s < 1440 ? (s / 60 | 0) + '小时前' : tT(ts); };
const list = () => D().chats.filter(c => c.fr !== 0 || c.msgs.length).sort((a, b) => (b.pin | 0) - (a.pin | 0) || (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0)).map(c => {
  const m = c.msgs.at(-1);
  return `<div class="cl ${c.pin ? 'pin' : ''}" data-a="open" data-x="${c.id}" data-lp="clp"><div class="avw"><img class="av" src="${esc(avOf(c))}">${c.unread ? `<i class="badge">${c.unread > 99 ? '99+' : c.unread}</i>` : ''}</div><div class="cl-m"><b>${esc(nm(c))}${c.type == 'g' ? ` <small>(${c.members.length + 1})</small>` : ''}</b><small>${esc(m ? (c.type == 'g' && m.f != 'me' && m.f != 'sys' ? nm(get(m.f)) + ': ' : '') + brief(m) : '')}</small></div><time>${m ? tT(m.ts).split(' ')[0] : ''}</time></div>`;
}).join('') || `<div class="empty"><p>还没有联系人 ✧</p>${btn('aiInit', '✨ AI 生成联系人', '', 'pri')}${btn('plus', '手动添加')}</div>`;
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
    ['p', '个人资料', f.inp('nick', '昵称') + f.inp('sign', '签名') + f.inp('ps', '我的拍一拍后缀', 'text', '如：的小脑袋') + f.img('cover', '动态封面')],
    ['w', '钱包', `<div class="wal"><small>余额</small><b>¥${(+D().me.wallet || 0).toFixed(2)}</b></div>` + f.inp('wallet', '修改余额', 'number')],
    ['s', '默认风格', f.seg('$style', STY) + '<p class="tip">决定新聊天样式与动态页：微信→朋友圈 / QQ→空间 / Kakao·LINE→推特式动态。单个聊天可在聊天设置里单独改。</p>'],
    ['d', '我的动态', btn('myfeed', '查看我的' + FN[S.style])]])}`;
};
const tabs = tab => { const u = D().chats.reduce((a, c) => a + (c.unread || 0), 0); return `<nav class="tabs">${[['list', TN[S.style], I.chat], ['ct', CN[S.style], I.book], ['feed', FN[S.style], I.star], ['me', '我', I.user]].map(([k, l, i]) => `<button data-a="tab" data-x="${k}" class="${tab == k ? 'on' : ''}">${i}<span>${l}</span>${k == 'list' && u ? `<i class="badge">${u}</i>` : ''}</button>`).join('')}</nav>`; };
const stCls = (el, c) => { const keep = el.classList.contains('in'); el.className = `pg ${c}${keep ? ' in' : ''}`; };

/* ---------- 动态操作（主页动态和个人动态共用） ---------- */
const P = id => D().posts.find(p => p.id == id);
async function genFeed(aid) {
  const who = aid && aid != 'me' ? rn(get(aid)) : '';
  task('正在生成动态', async sg => { const ps = json(await llm(await sysCtx(), `为${who || '联系人们（挑2-3位）'}生成${who ? 2 : 3}条贴合人设与当前剧情的${FN[S.style]}动态，可附带其他联系人的点赞和评论，可以提到${meObj().nick}。\n只输出JSON：{"posts":[{"author":"真实姓名","text":"","img":"配图画面描述(可空)","likes":["名字"],"comments":[{"from":"名字","text":""}]}]}`, '生成动态', sg))?.posts; if (!ps) throw Error('返回格式不对'); applyDelta({ posts: ps }); return `新增 ${ps.length} 条动态`; });
}
const FA = {
  like: id => { const p = P(id), me = nm(meObj()); p.likes = p.likes.includes(me) ? p.likes.filter(x => x != me) : [...p.likes, me]; saveD(); emit('chat'); },
  cmt: async id => {
    const p = P(id), r = await form('评论', [['c', '说点什么吧...']]); if (!r?.c) return; p.cm.push({ f: nm(meObj()), c: r.c }); saveD(); emit('chat'); if (p.a == 'me') return;
    task('等待评论回复', async sg => { json(await llm(await sysCtx(), `${rn(get(p.a))}发了动态：“${p.c}”\n评论区：${p.cm.map(c => c.f + '：' + c.c).join('；')}\n请生成${rn(get(p.a))}（以及可能路过的联系人）对最新评论的回复1-2条。只输出JSON：{"comments":[{"from":"名字","text":""}]}`, '动态评论', sg))?.comments?.forEach(c => p.cm.push({ f: c.from, c: c.text })); saveD(); emit('chat'); return '收到回复'; });
  },
  pfeed: id => openFeed(id), myfeed: () => openFeed('me'),
  pdel: id => { drop(D().posts.filter(p => p.id == id)); D().posts = D().posts.filter(p => p.id != id); saveD(); emit('chat'); },
  post: async () => { const r = await form('发表动态', [['c', '这一刻的想法...', 'area'], ['url', '配图', 'img']]); if (!r?.c && !r?.url) return; D().posts.unshift({ id: uid(), a: 'me', c: r.c || '', url: r.url, ts: +now(), likes: [], cm: [] }); saveD(); emit('chat'); },
  fgen: (x, t, e, pg) => genFeed(pg.aid),
};
export function openFeed(aid) { const st = aid && aid != 'me' ? sty(get(aid)) : S.style; page({ title: FN[st], aid, live: 1, cls: 'feedpg st-' + st, right: () => `<b data-a="fgen">${I.spark}</b>${aid == 'me' ? `<b data-a="post">${I.cam}</b>` : ''}`, body: () => feed(aid, st), acts: FA }); }

/* ---------- 添加联系人 ---------- */
async function aiInit() {
  const mode = await menu([['auto', '✨ 按剧情 / 世界书自动生成'], ['me', '✍️ 按我提供的信息生成']], 'AI 生成联系人'); if (!mode) return;
  const r = mode == 'me' ? await form('按我提供的信息生成', [['info', '联系人信息', 'area', '例：3个大学室友，一个是学生会长，一个是暗恋我的学弟…'], ['n', '联系人个数', 'number'], ['g', '群聊个数', 'number']], { n: 3, g: 1 }) : {};
  if (!r) return; if (mode == 'me' && !r.info?.trim()) return toast('请先填写联系人信息'); r.mode = mode;
  // 联系人只需要人物关系：世界书 5000 字、正文最近 10 条 / 4000 字就够；按我的信息生成时不读世界书
  task('AI 正在生成联系人', async (sg, prog) => {
    prog('整理世界书人物'); const P = await people(), sys = await contactSys(P);
    prog('等待模型返回'); return genContacts(sys, INIT(r), '生成联系人', sg, prog, { people: r.mode == 'me' ? [] : P, quick: { sys: '你是小手机的数据生成器，直接按格式输出，不要思考分析。', prompt: quickP(P, r) } });
  });
}
// 新联系人确认卡：展示网名 / 真实姓名，备注默认填 AI 生成的、可直接改
function review(nw, gs) {
  const m = Object.fromEntries(nw.map(c => [c.id, c.remark || ''])), s = sheet({
    cls: 'rv', noBack: 1, model: () => m, save: () => {}, title: `<b>✨ 新增 ${nw.length} 位联系人</b><small>确认一下备注吧，AI 已经帮你填好，可以直接改</small>`,
    body: () => nw.map(c => `<div class="nc"><img class="av" src="${esc(avOf({ ...c, remark: '' }))}"><div class="nc-m"><div class="nc-n"><b>${esc(c.nick || c.real)}</b><em>网名</em></div><small>真实姓名 · ${esc(c.real || '—')}</small><label class="nc-r"><i>备注</i><input data-k="${c.id}" value="${esc(m[c.id])}" placeholder="不填就显示网名"></label></div></div>`).join('')
      + (gs.length ? `<div class="nc-g"><small>同时加入的群聊</small>${gs.map(g => `<span>👥 ${esc(g.name)}</span>`).join('')}</div>` : '') + btn('ok', '完成', '', 'pri'),
    acts: { ok: () => s.close() }, onClose: () => { nw.forEach(c => c.remark = ($(`[data-k="${c.id}"]`, s.el)?.value ?? m[c.id] ?? '').trim()); saveD(); emit('chat'); },
  });
}
async function fromWi() {
  const es = []; for (const b of await wiBooks()) es.push(...Object.values((await loadBook(b))?.entries || {})); if (!es.length) return toast('没有读取到世界书条目');
  const i = await menu(es.map((e, i) => [i, esc(e.comment || e.key?.join(',') || '条目' + e.uid)]), '选择世界书条目'); if (i == null) return;
  task('正在解析世界书条目', (sg, prog) => genContacts('你是小手机数据整理器，严格按要求的格式输出。', `根据以下世界书条目，整理出${C().name1}手机里会有的联系人（${C().name1}认识的人）或${C().name1}所在的群聊，不包含${C().name1}自己：\n${es[i].content}\n已有：${names()}，不要重复。\n${LF(C().name1)}`, '世界书解析', sg, prog));
}

/* ---------- 联系人 / 通讯录 ---------- */
const PY = 'ABCDEFGHJKLMNOPQRSTWXYZ', PB = '阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥扨它穵夕丫帀', COL = new Intl.Collator('zh-CN');
const ini = s => { const c = [...String(s || '#')][0]; if (/[a-z]/i.test(c)) return c.toUpperCase(); if (!/[\u4e00-\u9fa5]/.test(c)) return '#'; let r = '#'; for (let i = 0; i < PB.length && COL.compare(c, PB[i]) >= 0; i++) r = PY[i]; return r; };
const crow = (c, a = 'prof') => `<div class="cl" data-a="${a}" data-x="${c.id}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(nm(c))}</b></div></div>`;
const ent = (i, l, a, x = '') => `<div class="cl ent2" data-a="${a}" data-x="${x}"><i class="ei">${i}</i><div class="cl-m"><b>${l}</b></div><small>›</small></div>`;
let ctab = 'grp';
function contacts() {
  const st = S.style, ps = D().chats.filter(c => c.type == 'p' && c.fr !== 0).sort((a, b) => COL.compare(nm(a), nm(b))), gs = D().chats.filter(c => c.type == 'g'), me = meObj();
  if (st == 'wx') {
    const by = {}; ps.forEach(c => (by[ini(nm(c))] ||= []).push(c)); const ks = Object.keys(by).sort((a, b) => a == '#' ? 1 : b == '#' ? -1 : a < b ? -1 : 1);
    return `<div class="ct-wx">${ent('👤', '新的朋友', 'plus')}${ent('👥', `群聊 <small>${gs.length}</small>`, 'groups')}${ks.map(k => `<h6 data-l="${k}">${k}</h6>${by[k].map(c => crow(c)).join('')}`).join('') || '<p class="empty">还没有联系人</p>'}<p class="ct-n">${ps.length} 位联系人</p></div><nav class="az">${[...PY.slice(0, 8), 'I', ...PY.slice(8, 19), 'U', 'V', ...PY.slice(19), '#'].map(k => `<b data-a="jump" data-x="${k}">${k}</b>`).join('')}</nav>`;
  }
  if (st == 'qq') {
    const by = {}; ps.forEach(c => (by[c.grp || '我的好友'] ||= []).push(c));
    return `${ent('👤', '新朋友', 'plus')}${ent('🔔', '群通知', 'groups')}<div class="seg ct-seg">${[['grp', '分组'], ['fr', '好友'], ['gp', '群聊']].map(([k, l]) => `<button data-a="ctab" data-x="${k}" class="${ctab == k ? 'on' : ''}">${l}</button>`).join('')}</div>`
      + (ctab == 'grp' ? Object.entries(by).map(([k, l]) => `<details class="qg" open><summary><b>${esc(k)}</b><small>${l.length}/${l.length}</small></summary>${l.map(c => crow(c)).join('')}</details>`).join('') : (ctab == 'fr' ? ps : gs).map(c => crow(c, ctab == 'gp' ? 'open' : 'prof')).join('')) || '<p class="empty">空空如也</p>';
  }
  return `<div class="cl ct-me" data-a="tab" data-x="me"><img class="av" src="${esc(avOf(me))}"><div class="cl-m"><b>${esc(me.nick)}</b><small>${esc(me.sign || '设置状态消息')}</small></div></div><h6>群聊 ${gs.length}</h6>${gs.map(c => crow(c, 'open')).join('')}<h6>好友 ${ps.length}</h6>${ps.map(c => crow(c)).join('') || '<p class="tip">还没有好友，点右上角添加</p>'}`;
}
function prof(id) {
  const c = get(id), g = c.type == 'g';
  page({ title: '', cls: 'profpg', live: 1, body: () => `<div class="pf"><img class="av" src="${esc(avOf(c))}"><div><b>${esc(nm(c))}</b>${c.remark && c.nick ? `<small>昵称：${esc(c.nick)}</small>` : ''}${c.real && !g ? `<small>真实姓名：${esc(c.real)}</small>` : ''}<small>${g ? '群号：' + c.no : '账号：' + esc(c.nick || c.id)}</small></div></div>
<div class="card">${c.sign || c.notice ? `<div class="row"><span>${g ? '群公告' : '个性签名'}</span><small>${esc(g ? c.notice : c.sign)}</small></div>` : ''}${g ? `<div class="row"><span>群成员</span><small>${c.members.length + 1} 人</small></div>` : `<div class="row"><span>分组</span><small>${esc(c.grp || '我的好友')}</small></div>`}</div>
${btn('pchat', g ? '进入群聊' : '发消息', '', 'pri')}${g ? '' : btn('pfd', '查看' + FN[sty(c)])}${btn('pset', '资料与聊天设置')}`,
    acts: { pchat: () => { back(); openChat(id); }, pfd: () => openFeed(id), pset: () => cset(c) } });
}

/* ---------- 聊天 App ---------- */
let tab = 'list';
reg({
  id: 'chat', name: '聊天', icon: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M9.5 4C5.4 4 2 6.8 2 10.2c0 1.9 1 3.6 2.7 4.7L4 17.5l3-1.6c.8.2 1.6.3 2.5.3 4.1 0 7.5-2.8 7.5-6.2S13.6 4 9.5 4z"/><path opacity=".8" d="M22 14.6c0-2.3-1.7-4.3-4.2-5.2l.1.9c0 4-3.7 7.2-8.4 7.4 1.1 1.4 3.1 2.3 5.3 2.3.6 0 1.2-.1 1.8-.2l2.4 1.2-.5-2c1.4-1 2.5-2.6 2.5-4.4z"/></svg>',
  open: () => page({
    cls: 'chatapp', live: 1, model: () => D().me, title: () => ({ list: TN[S.style], ct: CN[S.style], feed: FN[S.style], me: '我' })[tab],
    right: () => tab == 'list' || tab == 'ct' ? `<b data-a="plus">${I.plus}</b>` : tab == 'feed' ? `<b data-a="fgen">${I.spark}</b><b data-a="post">${I.cam}</b>` : '',
    body: () => tab == 'list' ? list() : tab == 'ct' ? contacts() : tab == 'feed' ? feed() : meP(), foot: () => tabs(tab), after: el => stCls(el, 'chatapp st-' + S.style),
    onChange: k => k == '$style' && emit('chat'),
    acts: {
      ...FA, aiInit, tab: (x, t, e, pg) => { tab = x; pg.re(); }, prof, ctab: (x, t, e, pg) => { ctab = x; pg.reb(); },
      groups: () => page({ title: '群聊', body: () => D().chats.filter(c => c.type == 'g').map(c => crow(c, 'open')).join('') || '<p class="empty">还没有群聊</p>', acts: { open: id => (back(), openChat(id)) } }),
      jump: (x, t, e, pg) => { const b = $('.pg-b', pg.el), s = $(`[data-l="${x}"]`, b); s && (b.scrollTop += (s.getBoundingClientRect().top - b.getBoundingClientRect().top) * b.offsetHeight / b.getBoundingClientRect().height); }, open: id => openChat(id),
      clp: async id => { const c = get(id), k = await menu([['pin', c.pin ? '取消置顶' : '置顶聊天'], ['read', '标为已读'], ['del', c.type == 'g' ? '删除群聊' : '删除联系人', 'danger']], esc(nm(c))); k == 'pin' && (c.pin = !c.pin); k == 'read' && (c.unread = 0); k == 'del' && await ok('确定删除？聊天记录也会清除') && rm(c); saveD(); emit('chat'); },
      plus: async () => {
        const k = await menu([['f', '👤 添加好友'], ['g', '👥 发起群聊'], ['ai', '✨ AI 生成联系人'], ['wi', '📖 从世界书添加']]);
        if (k == 'f') { const r = await form('添加好友', [['av', '头像', 'img'], ['nick', '昵称（网名）'], ['real', '真实姓名'], ['remark', '备注'], ['sign', '个性签名']]); r && (r.nick || r.real) && add(blank('p', r)); }
        if (k == 'g') { const r = await form('发起群聊', [['av', '群头像', 'img'], ['name', '群名'], ['notice', '群公告', 'area'], ['members', '选择成员', 'multi', D().chats.filter(c => c.type == 'p').map(c => [c.id, nm(c)])]]); r?.name && add(blank('g', { ...r, members: r.members || [] })); }
        k == 'ai' && await aiInit(); k == 'wi' && await fromWi(); saveD(); emit('chat');
      },
    },
  }),
});
