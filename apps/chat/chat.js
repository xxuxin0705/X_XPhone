// 聊天 · App：消息列表 / 通讯录 / 动态（朋友圈·QQ空间·推特式）/ 我 / AI 生成联系人
import { C, S, D, saveD, esc, uid, $, $$, reg, page, top, back, menu, form, ok, toast, fx, btn, sec, nm, rn, avOf, meObj, brief, now, llm, json, sysCtx, I, task, sheet, wiBooks, loadBook, wiText, notify, emit, drop, pickImg, defAv } from '../../core.js';
import { get, blank, add, upsert, applyDelta, sty, rm, isMe, find, gsz, STY, TN, CN, FS, FN, LANGS, lname } from './data.js';
import { openChat, cset, tT } from './talk.js';
import { feed, FA, openFeed, feedRight, mountFeed } from './feed.js';
export { openFeed };
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
人|真实姓名|网名|备注|性别|拍一拍后缀|语言|个性签名
群|群名|群主真实姓名|管理员(逗号分隔，没有就空着)|成员(逗号分隔，格式「名字:群头衔」，没头衔就只写名字，不写${u})|群人数(数字，含没写出来的人)|群公告
字段说明：
· 网名＝TA自己在社交软件上起的昵称，要像真实中文互联网上的人，按性格来，同一批人风格要拉开：
  - 软萌 / 爱卖萌：叠字、小动物、零食，常带颜文字或小符号，如「软糖不软ᐟ」「芋泥啵啵(｡･ω･｡)」「小熊不吃香菜ʕ•ᴥ•ʔ」「桃桃乌龙.」
  - 中二 / 非主流：用怪符号包起来，如「†漆黑之翼†」「꧁深渊回响꧂」「ℓ夜行のReaper」「゛黑化肥发灰」
  - 冷淡 / 话少：极简，一个字、一个标点、首字母、拼音或英文，如「。」「z」「Lin」「wy」「-」
  - 文艺：「晚风与你」「人间理想」「指针朝北」
  - 沙雕 / 搞笑：「今天也没暴富」「退休了别找我」「云吸咸鱼」
  - 长辈 / 打工人：「岁月静好🌸」「宁静致远」「老王装修」
  - 也可以是英文名、名字谐音、中日英混搭（如「森林の鹿」）
· 备注＝${u}自己手机通讯录里给TA存的名字，像活人随手存的：亲近的用昵称 / 外号 / 叠字 / 带emoji / 带点吐槽，长辈就是「妈」「三叔」，不熟的直接写名字。绝对不要写「同班同学」「前不良少年」「热血班长」这种身份说明。例：「沈遥🐟」「狗头军师老周」「班长大人」「烦人精」「林老师（数学）」
· 性别写 男 或 女
· 拍一拍后缀＝别人拍TA时显示在「拍了拍TA」后面的那句，要有网感、有梗，像微信里真有人设置的那样，按人设来编（中二的就中二，高冷的可以只有一个「。」），20字内。风格参考（别照抄）：「的存款+1」「的木鱼功德+1」「并留下了小猫脚印🐾」「说：500万，离开我儿子」「的小脑瓜然后变成猪」「发现没拍到ōÓ」「的肩膀叫了声富婆💰」「的肚子duangduang」「被反手一巴掌打翻在地」「的次数太多，已拍死」。不要写「的头发」「的肩膀」这种平淡的
· 语言＝TA平时发消息用的语言，按剧情里TA实际怎么说话判断：说中文就写 中文；只有剧情里TA确实用外语交流才写 日语 / 英语 / 韩语 等
· 群头衔：贴合人设和群氛围，有梗一点，如「班长」「摸鱼大师」「人间扫描仪」「本群最靓的仔」，不是每个人都要有
· 签名15字内；群公告25字内。先写完所有「人」再写「群」
示例：
人|沈知遥|晚风与你|遥遥🐟|男|的存款+1|中文|今天也在图书馆
群|高三(2)班|林老师|沈知遥|沈知遥:班长,周小满:摸鱼大师,林老师:班主任|42|周五前交志愿表`;
const INIT = r => { const c = C(), u = c.name1; return `任务：${r.mode == 'me' ? `按用户提供的信息生成${u}手机里的联系人/群聊：${r.info}\n数量：联系人 ${+r.n || 0} 个，群聊 ${+r.g || 0} 个。` : `根据人设、世界书和剧情，列出${u}手机里实际存在的联系人和群聊。`}
【联系人】＝${u}认识、已经加了好友的人：
  ① 一定先列出角色卡里的主要角色（${c.name2}；如果角色卡是世界观 / 多人卡，就是卡里写到的主要人物）——他们和${u}关系最近，必须在联系人里；
  ② 再列剧情 / 世界书里和${u}有来往的NPC。一般不超过12个，不要凑数。
【群聊】＝${u}本人加入了的群（${u}不在的群不要生成），一般不超过4个：
  · 群成员只写世界书 / 剧情里有名有姓的角色和NPC，可以包括${u}不认识、没加好友的人；
  · 没提到名字的路人（比如班里其他同学）一律不要编名字，用「群人数」体现，比如40人的班群就写 40。
不要包含${u}自己。已有：${names()}，不要重复。
直接按格式输出，不需要分析或推理过程。
${LF(u)}`; };
const sp = s => String(s || '').split(/[,，、;；\s]+/).map(x => x.trim()).filter(x => x && !/^(无|空|没有|-+|—+|null)$/i.test(x));
// 解析一行：人|… 或 群|…
// 语言名 → 翻译设置代码；中文 / 没写 = 不翻译
const LN = { 中文: '', 汉语: '', 普通话: '', 简体中文: '', 粤语: '', 英文: 'en', english: 'en', 日文: 'ja', japanese: 'ja', 韩文: 'ko', 朝鲜语: 'ko', korean: 'ko', 繁中: 'zh-TW', 繁體中文: 'zh-TW' };
const langOf = s => { s = String(s || '').trim().replace(/[（(].*$/, ''); if (!s) return null; const k = s.toLowerCase(); if (k in LN) return LN[k]; if (s in LN) return LN[s]; const x = LANGS.find(([c, n]) => c && (n == s || c == k || n.replace('语', '') == s.replace(/[语文]$/, ''))); return x ? x[0] : null; };
export const pline = l => {
  const f = String(l).trim().replace(/^[-*•>\d.、)）\s]+/, '').replace(/^[「【[]|[」】\]]$/g, '').split(/\s*[|｜]\s*/), k = f[0];
  const nil = v => /^(-+|—+|无|空|没有|null|none)?$/i.test(String(v ?? '').trim()) ? '' : String(v).trim(); // 「-」「无」= 空
  if (/^(人|联系人|好友)$/.test(k) && f[1] && f.length <= 6) return { contacts: [{ real: f[1], nick: f[2] || f[1], remark: f[3] || '', sex: (String(f[4]).match(/[男女]/) || [''])[0], sign: f[5] || '' }] }; // 旧的 6 段格式
  if (/^(人|联系人|好友)$/.test(k) && f[1]) { const lg = langOf(f[6]), sign = lg == null && f.length <= 7 ? f.slice(6).join('|') : f.slice(7).join('|'); // 模型漏写语言时第 7 段当签名
    return { contacts: [{ real: f[1], nick: f[2] || f[1], remark: nil(f[3]), sex: (String(f[4]).match(/[男女]/) || [''])[0], ps: (f[5] || '').replace(/^拍了拍\S*?(?=的|并|，)/, ''), lang: lg || '', sign: nil(sign) }] }; }
  if (/^(群|群聊)$/.test(k) && f[1]) { // 成员可写「名字:头衔」或「名字(头衔)」；第 6 段是数字就是群人数（旧格式第 6 段直接是公告）
    const o = sp(f[2])[0], num = /^\d+\s*人?$/.test(String(f[5] || '').trim()), titles = {};
    const members = String(f[4] || '').split(/[,，、;；]+/).map(t => { t = t.trim(); const m = t.match(/^(.+?)\s*[:：（(]\s*([^)）]*?)\s*[)）]?$/), n = (m ? m[1] : t).trim(); m && m[2] && (titles[n] = m[2]); return n; }).filter(n => n && !/^(无|空|-+)$/.test(n));
    return { groups: [{ name: f[1], owner: o, admins: sp(f[3]), members, titles, size: num ? parseInt(f[5]) : 0, notice: (num ? f.slice(6) : f.slice(5)).join('|').trim() }] }; }
  return null;
};
// 兼容模型仍然输出 JSON（旧短键 / 长键都认）
const unz = d => ({ contacts: (d?.c || d?.contacts || []).map(x => ({ real: x.n ?? x.real, nick: x.k ?? x.nick, remark: x.r ?? x.remark, sign: x.s ?? x.sign, sex: x.x ?? x.sex, ps: x.ps ?? '', lang: langOf(x.lang) || '' })), groups: (d?.g || d?.groups || []).map(x => ({ name: x.n ?? x.name, owner: x.o ?? x.owner, admins: x.a ?? x.admins, members: x.m ?? x.members, notice: x.t ?? x.notice })) });
/* ---------- 生成联系人：保证 2 分钟内出结果 ----------
   glm-5.3-flash 这类模型思考关不掉，思考长度主要取决于喂给它多少材料，所以：
   ① 不再把整本世界书塞进去，先在本地把世界书里的「人物条目」挑出来，压成「名字（性别）：一句简介」的名单；
   ② 45 秒还没出第一个联系人，就同时发一个只带名单的极简请求（几乎没什么可想的），谁先出结果用谁、另一路自动停掉；
   ③ 115 秒硬性截止：先从模型的思考草稿里捞已经写好的「人|…」行，还没有就直接按世界书人物名单添加，绝不空等。 */
const STOPW = /(设定|世界|规则|地点|地图|学校|学院|城市|国家|组织|历史|系统|背景|社团|班级|事件|剧情|道具|物品|技能|能力|种族|势力|格式|说明|开场|开头|状态|总览|大纲|时间|关系|指南|提示|风格|文风|nsfw|cot|思维|输出|规范|注意|前言|序章|简介|介绍|总则|变量|面板)/i;
const cutS = (s, n) => (s = String(s || '').replace(/\s+/g, ' ').trim()).length > n ? s.slice(0, n) + '…' : s;
export async function people() {
  const out = [], seen = new Set(), add = (n, b = '', sex = '') => { n = String(n || '').replace(/[【】\[\]《》「」『』()（）★☆♡♥✦·\s]/g, '').trim(); if (!n || n.length > 10 || seen.has(n) || isMe(n)) return; seen.add(n); out.push({ n, b, sex }); };
  STOPW.test(C().name2 || '') || add(C().name2, '角色卡主要角色'); // 主要角色排第一
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
const quickP = (P, r) => { const u = C().name1; return `${r?.mode == 'me' ? `按这段信息生成${u}的联系人：${r.info}\n` : ''}从下面这些人里挑出${u}认识、会加好友的人（不超过12个，角色卡主要角色「${C().name2}」一定要有），直接输出，不要分析：\n${P.map(p => p.n + (p.sex ? `（${p.sex}）` : '')).join('、') || C().name2}\n${LF(u)}\n群可以不写。`; };
// o: { lim 截止毫秒, bk 备用请求启动毫秒, quick: {sys, prompt}, people }（数字可调，测试用）
export const GC = { review: null }; // 测试钩子：直接拿到暂存结果
export async function genContacts(sys, prompt, desc, sg, prog, o = {}) {
  const LIM = o.lim ?? 115e3, BK = o.bk ?? 45e3, ac = new AbortController();
  // 先放进暂存区，用户在确认卡里点「添加」之后才真正进手机
  const st = { c: [], g: [] }, seen = new Set(), size = () => st.c.length + st.g.length;
  const put = x => { x?.contacts?.forEach(c => { const n = c.real || c.nick, k = 'p:' + n, ex = n && (find(c.real, 'p') || find(c.nick, 'p')); if (!n || seen.has(k) || isMe(n) || ex && ex.fr !== 0) return; seen.add(k); st.c.push({ real: n, r0: n, nick: c.nick || n, remark: c.remark || '', sex: c.sex || '', ps: c.ps || '', lang: c.lang || '', sign: c.sign || '', av: '' }); });
    x?.groups?.forEach(g => { const k = 'g:' + g.name; if (!g.name || seen.has(k) || find(g.name, 'g')) return; seen.add(k); st.g.push({ ...g, owner: g.owner || '', admins: [...(g.admins || [])], members: [...(g.members || [])], titles: { ...(g.titles || {}) }, size: +g.size || 0, notice: g.notice || '', no: String(1e8 + Math.random() * 9e8 | 0), av: '' }); }); };
  let got = 0, settle, alive = 0, lastErr, bkOn = 0, how = ''; const fin = new Promise(r => settle = r), drafts = [], t0 = Date.now();
  const stopAll = () => ac.abort(), cancel = () => { stopAll(); settle('cancel'); }; sg?.aborted ? cancel() : sg?.addEventListener('abort', cancel);
  const count = () => `已收到 ${size()} 个`;
  const run = (s, p, d) => {
    let done = 0, rs = ''; const i = drafts.push('') - 1; alive++;
    const eat = (txt, end) => { const ls = String(txt).split('\n'), n = end ? ls.length : ls.length - 1; for (; done < n; done++) { const x = pline(ls[done]); x && (put(x), got++); } got && prog?.(count()); };
    llm(s, p, d, ac.signal, { fast: 1, aux: 1, onText: t => eat(t), onThink: (n, r) => { drafts[i] = rs += r; got || prog?.(`模型思考中 ${n}字 · ${(Date.now() - t0) / 1e3 | 0}s`); } })
      .then(raw => { eat(raw, 1); if (!got) { const j = json(raw); j && put(unz(j)); } settle('ok'); },
        e => { lastErr = e; if (ac.signal.aborted) return; if (--alive) return; o.quick && !bkOn ? backup() : settle('err'); });
  };
  const backup = () => { if (bkOn || ac.signal.aborted || !o.quick) return; bkOn = 1; prog?.('同时用精简方式生成…'); run(o.quick.sys, o.quick.prompt, desc + '·精简'); };
  const bt = setTimeout(() => got || backup(), BK), dt = setTimeout(() => settle('late'), LIM);
  run(sys, prompt, desc);
  const res = await fin; clearTimeout(bt); clearTimeout(dt); sg?.removeEventListener('abort', cancel); stopAll(); // 有结果了 / 到点了：另一路停掉
  if (res != 'ok' && !sg?.aborted && !size()) { for (const d of drafts) for (const l of d.split('\n')) put(pline(l)); size() && (how = '（模型还在思考，已从它的草稿里取出）'); }
  res == 'late' && got && (how = '（2 分钟到了，先给你看已经生成的部分）');
  if (res == 'late' && !sg?.aborted && !size() && o.people?.length) { put({ contacts: o.people.slice(0, 12).map(p => ({ real: p.n, nick: p.n, sex: p.sex })) }); how = '（模型太慢，先按世界书人物列出来，网名等可以在确认卡里改）'; }
  const nw = st.c, gs = st.g;
  if (sg?.aborted) throw Error('已取消');
  size() && (GC.review ? GC.review(st) : setTimeout(() => review(st), 300));
  if (!nw.length && !gs.length) throw res == 'late' ? Error('模型 2 分钟内没有给出结果，世界书里也没找到人物条目，可以换个不思考的「生成用模型」再试') : lastErr || Error('没有识别到新的联系人（可能都已存在，或返回格式不对，可在调用日志查看）');
  if (res == 'err' && lastErr) throw Error(`${lastErr.message}（已生成的 ${nw.length} 位联系人 · ${gs.length} 个群可以在确认卡里添加）`);
  return `已生成 ${nw.length} 位联系人 · ${gs.length} 个群，请确认${how}`;
}
/* ---------- 正文联动（不额外调 API）：主模型在正文末尾写 <手机>…</手机>，这里本地解析进手机，并从正文里去掉这个块 ---------- */
const PHB = /<手机>([\s\S]*?)<\/手机>/g;
export function inlineSync(id) {
  const c = C(), m = c.chat?.[id]; if (!m || !PHB.test(String(m.mes))) return 0; PHB.lastIndex = 0;
  const d = { contacts: [], groups: [], msgs: [], posts: [] }, moods = [], u = c.name1, me = n => isMe(n) || n == u;
  for (const [, b] of String(m.mes).matchAll(PHB)) for (const l of b.split('\n')) {
    const f = l.trim().replace(/^[-*•\d.、\s]+/, '').split(/\s*[|｜]\s*/), k = f[0], rest = i => f.slice(i).join('|').trim();
    if (k == '私聊' && f.length >= 4) { me(f[1]) ? d.msgs.push({ chat: f[2], from: u, text: rest(3) }) : me(f[2]) && d.msgs.push({ chat: f[1], from: f[1], text: rest(3) }); }
    else if (k == '群聊' && f.length >= 4) { d.groups.push({ name: f[1], members: me(f[2]) ? [] : [f[2]] }); d.msgs.push({ chat: f[1], from: me(f[2]) ? u : f[2], text: rest(3) }); }
    else if ((k == '朋友圈' || k == '动态') && f[2]) d.posts.push({ author: me(f[1]) ? u : f[1], text: rest(2) });
    else if (k == '加好友' && f[1] && !me(f[1])) d.contacts.push({ real: f[1], nick: f[2] || f[1], lang: langOf(f[3]) || '' });
    else if (k == '拉群' && f[1]) d.groups.push({ name: f[1], members: String(f[2] || '').split(/[,，、]/).map(x => x.trim()).filter(x => x && !me(x)) });
    else if (k == '转账' && f.length >= 4) { const t = { type: 'transfer', amount: parseFloat(f[3]) || 0, text: rest(4) }; me(f[2]) ? d.msgs.push({ chat: f[1], from: f[1], ...t }) : me(f[1]) && d.msgs.push({ chat: f[2], from: u, ...t }); }
    else if (k == '拍一拍' && f[1] && !me(f[1])) d.msgs.push({ chat: f[1], from: f[1], type: 'pat', text: rest(2) || '拍了拍你' });
    else if (k == '心情' && f[1] && f[2] && !me(f[1])) moods.push({ who: f[1], mood: f[2].trim(), say: (f[3] || '').trim(), world: (f[4] || '').trim(), voices: f.slice(5).join('／').split(/[／/]/).map(v => v.trim()).filter(Boolean) }); // 心屿：心情|谁|心情词|一句话|风景词
  }
  moods.length && emit('isle-mood', moods);
  const out = applyDelta(d); out.forEach(([ch, x]) => notify(ch, x));
  const cut = t => String(t).replace(PHB, '').replace(/\n{3,}/g, '\n\n').trim();
  m.mes = cut(m.mes); Array.isArray(m.swipes) && m.swipes[m.swipe_id ?? 0] != null && (m.swipes[m.swipe_id ?? 0] = cut(m.swipes[m.swipe_id ?? 0])); // 正文里不显示这个块（当前这条 swipe 也一起清掉）
  setTimeout(() => { c.updateMessageBlock?.(id, m); c.saveChat?.(); });
  return out.length;
}
// 手动补同步：会调用一次 API（只在设置里点按钮时用）
export const syncStory = t => task('剧情同步中', async sg => { const o = applyDelta(json(await llm(await sysCtx(), SCAN(t), '剧情同步', sg, { aux: 1 }))); o.forEach(([ch, x]) => notify(ch, x)); return o.length ? `剧情同步：${o.length} 条新消息` : '剧情同步完成'; });

/* ---------- 渲染 ---------- */
// 多选模式：msel 是选中的会话 id（null = 没在多选）
let msel = null;
const vis = () => D().chats.filter(c => c.fr !== 0 || c.msgs.length);
const list = () => vis().sort((a, b) => (b.pin | 0) - (a.pin | 0) || (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0)).map(c => {
  const m = c.msgs.at(-1);
  return `<div class="cl ${c.pin ? 'pin' : ''} ${msel ? 'msel' : ''} ${msel?.has(c.id) ? 'on' : ''}" data-a="open" data-x="${c.id}" data-lp="clp">${msel ? '<i class="ck"></i>' : ''}<div class="avw"><img class="av" src="${esc(avOf(c))}">${c.unread ? `<i class="badge">${c.unread > 99 ? '99+' : c.unread}</i>` : ''}</div><div class="cl-m"><b>${esc(nm(c))}${c.type == 'g' ? ` <small>(${gsz(c)})</small>` : ''}</b><small>${esc(m ? (c.type == 'g' && m.f != 'me' && m.f != 'sys' ? nm(get(m.f)) + ': ' : '') + brief(m) : '')}</small></div><time>${m ? tT(m.ts).split(' ')[0] : ''}</time></div>`;
}).join('') || `<div class="empty"><p>还没有聊天 ✧</p>${btn('tab', '去通讯录添加联系人', 'ct', 'pri')}</div>`;
const meP = () => {
  const f = fx(D().me), m = meObj();
  return `<div class="me-c" data-a="img" data-x="av"><img class="av" src="${esc(avOf(m))}"><div><b>${esc(m.nick)}</b><small>真实姓名：${esc(m.real)}</small><small>${esc(m.sign || '点击头像更换 · 下方编辑签名')}</small></div></div>${sec('me', [
    ['p', '个人资料', f.inp('nick', '昵称（网名）') + f.inp('real', '真实姓名', 'text', C().name1 + '（默认酒馆里的名字）') + f.inp('sign', '签名') + f.inp('ps', '我的拍一拍后缀', 'text', '如：的小脑袋') + f.img('cover', '动态封面') + f.img('fbg', '动态背景')],
    ['w', '钱包', `<div class="wal"><small>余额</small><b>¥${(+D().me.wallet || 0).toFixed(2)}</b></div>` + f.inp('wallet', '修改余额', 'number')],
    ['s', '默认风格', f.seg('$style', STY) + '<p class="tip">决定新聊天样式与动态页：微信→朋友圈 / QQ→空间 / Kakao·LINE→推特式动态。单个聊天可在聊天设置里单独改。</p>'],
    ['d', '我的动态', btn('myfeed', '查看我的' + FN[S.style])]])}`;
};
const tabs = tab => { const u = D().chats.reduce((a, c) => a + (c.unread || 0), 0); return `<nav class="tabs">${[['list', TN[S.style], I.chat], ['ct', CN[S.style], I.book], ['feed', FN[S.style], I.star], ['me', '我', I.user]].map(([k, l, i]) => `<button data-a="tab" data-x="${k}" class="${tab == k ? 'on' : ''}">${i}<span>${l}</span>${k == 'list' && u ? `<i class="badge">${u}</i>` : ''}</button>`).join('')}</nav>`; };
const stCls = (el, c) => { const keep = el.classList.contains('in'); el.className = `pg ${c}${keep ? ' in' : ''}`; };


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
// 新联系人确认卡：生成结果先放这里，确认后才进手机。
// 每个人 / 群默认折叠成一行（勾选框只管选不选，点这一行展开编辑）；展开后头像、网名、真名、备注、性别、拍一拍、签名、语言，
// 群的头像、群名、群号、群主、管理员、成员、公告都能改。「取消」= 都不要；「添加」= 只加勾选的。
function review(st) {
  const u = C().name1, items = [...st.c.map((c, i) => ['c' + i, c]), ...st.g.map((g, i) => ['g' + i, g])], keep = new Set(items.map(x => x[0])), total = keep.size, byId = Object.fromEntries(items);
  let open = '', done = 0;
  const R = n => st.c.find(c => c.r0 == n)?.real || n; // 真名改过以后，群里的成员名跟着变
  const cav = c => c.av || avOf({ nick: c.nick || c.real }), gav = g => g.av || defAv(g.name);
  const sumC = c => [c.remark && `备注 ${c.remark}`, c.real, c.sex, c.lang && `说${lname(c.lang)}`].filter(Boolean).join(' · ');
  const sumG = g => [`群主 ${g.owner && !isMe(g.owner) ? R(g.owner) : u}`, g.admins.length && `管理员 ${g.admins.map(R).join('、')}`].filter(Boolean).join(' · ');
  const fri = n => st.c.some((c, i) => keep.has('c' + i) && (c.r0 == n || c.real == n)) || (find(n, 'p') && find(n, 'p').fr !== 0); // 这个人是不是好友
  const opt = (L, v) => L.map(([a, b]) => `<option value="${esc(a)}" ${a == v ? 'selected' : ''}>${esc(b)}</option>`).join('');
  const F = (f, l, v, cls = '', ph = '') => `<label class="rk-f ${cls}"><span>${l}</span><input data-f="${f}" value="${esc(v)}" placeholder="${esc(ph)}"></label>`;
  const T = (f, l, v, pre = '', ph = '') => `<label class="rk-f w"><span>${l}</span><div class="rk-ta">${pre ? `<em>${pre}</em>` : ''}<textarea data-f="${f}" rows="1" placeholder="${esc(ph)}">${esc(v)}</textarea></div></label>`;
  const edC = (c) => `<div class="rk-ed"><div class="rk-avb" data-av><img src="${esc(cav(c))}"><small>换头像</small></div><div class="rk-g">
${F('nick', '网名', c.nick)}${F('real', '真实姓名', c.real)}${F('remark', '备注', c.remark, '', '不填显示网名')}
<label class="rk-f"><span>性别</span><select data-f="sex">${opt([['', '未知'], ['男', '男'], ['女', '女']], c.sex)}</select></label>
${T('ps', '拍一拍后缀', c.ps, '拍了拍TA', '可留空')}${T('sign', '个性签名', c.sign, '', '可留空')}
<label class="rk-f w"><span>聊天语言</span><select data-f="lang">${opt(LANGS.map(([a, b]) => [a, a ? `${b}（自动翻译）` : '中文（不翻译）']), c.lang)}</select></label></div></div>`;
  const edG = (g) => `<div class="rk-ed"><div class="rk-avb" data-av><img src="${esc(gav(g))}"><small>换群头像</small></div><div class="rk-g">
${F('name', '群名', g.name)}${F('no', '群号', g.no)}
<label class="rk-f w"><span>群主</span><select data-f="owner">${opt([['', `我（${u}）`], ...g.members.filter(n => !isMe(n)).map(n => [n, R(n)])], isMe(g.owner) ? '' : g.owner)}</select></label>
<label class="rk-f"><span>群人数（含没列出来的人）</span><input data-f="size" type="number" value="${esc(gsz(g))}"></label><div></div>
<div class="rk-f w"><span>有名有姓的成员 · ★ 切换管理员，× 移出群</span><div class="rk-ms">${g.members.filter(n => !isMe(n)).map(n => `<div class="rk-mr"><b>${esc(R(n))}${fri(n) ? '' : '<em>非好友</em>'}</b><input data-tt="${esc(n)}" value="${esc(g.titles?.[n] || '')}" placeholder="群头衔"><i data-adm="${esc(n)}" class="${g.admins.includes(n) ? 'on' : ''}">★</i><i data-out="${esc(n)}">×</i></div>`).join('') || '<small>没有成员</small>'}</div>${gsz(g) > g.members.length + 1 ? `<small class="rk-more">还有 ${gsz(g) - g.members.length - 1} 位群成员没在剧情里出现，默认折叠</small>` : ''}</div>
${T('notice', '群公告', g.notice, '', '可留空')}</div></div>`;
  const row = ([id, x]) => { const g = id[0] == 'g';
    return `<div class="rk ${keep.has(id) ? 'on' : ''} ${open == id ? 'op' : ''}" data-pk="${id}"><div class="rk-h" data-tg><i class="rk-ck" data-ck></i><img class="av ${g ? 'gav' : ''}" src="${esc(g ? gav(x) : cav(x))}"><div class="rk-m">
<b>${esc(g ? x.name : x.nick || x.real)}${g ? `<small> · ${gsz(x)}人</small>` : ''}</b><small data-sum>${esc(g ? sumG(x) : sumC(x))}</small>${(g ? x.notice : x.ps) ? `<small class="rk-p">${esc(g ? '公告 · ' + x.notice : '拍了拍TA' + x.ps)}</small>` : ''}</div><i class="rk-ar">›</i></div>${open == id ? (g ? edG(x) : edC(x)) : ''}</div>`; };
  const finish = ok => {
    if (done) return; done = 1;
    if (!ok) { drop(items.map(x => x[1].av)); return toast('已取消，这次生成的都没有添加'); }
    const C2 = st.c.filter((c, i) => keep.has('c' + i)), G = st.g.filter((g, i) => keep.has('g' + i)).map(g => ({ ...g, owner: isMe(g.owner) ? '' : R(g.owner), admins: g.admins.map(R), members: g.members.map(R), titles: Object.fromEntries(Object.entries(g.titles || {}).filter(([n, t]) => t && g.members.includes(n)).map(([n, t]) => [R(n), t])) }));
    applyDelta({ contacts: C2.map(c => ({ ...c, nick: c.nick || c.real })), groups: G });
    C2.forEach(c => { const x = find(c.real, 'p'); x && (Object.assign(x, { nick: c.nick || c.real, remark: c.remark, sex: c.sex, ps: c.ps, sign: c.sign }), c.av && (x.av = c.av), c.lang != null && ((x.cfg ||= {}).lang = c.lang)); }); // 以确认卡为准
    G.forEach(g => { const x = find(g.name, 'g'); x && (x.no = g.no || x.no, g.av && (x.av = g.av)); });
    drop([...st.c.filter((c, i) => !keep.has('c' + i)), ...st.g.filter((g, i) => !keep.has('g' + i))].map(x => x.av)); // 没要的人换过的头像删掉
    saveD(); emit('chat');
    toast(C2.length || G.length ? `已添加 ${C2.length} 位联系人${G.length ? ` · ${G.length} 个群` : ''}` : '一个都没添加');
  };
  const s = sheet({
    cls: 'rv rv2', noBack: 1, title: `<b>✨ 生成了 ${st.c.length} 位联系人${st.g.length ? ` · ${st.g.length} 个群` : ''}</b><small>还没加进手机 · 点一行展开修改，点圆圈选择要不要</small>`,
    body: () => `<div class="nc-top"><span></span><b data-all></b></div>` + (st.c.length ? `<h6 class="rk-t">联系人</h6><div class="rk-l">${items.filter(x => x[0][0] == 'c').map(row).join('')}</div>` : '')
      + (st.g.length ? `<h6 class="rk-t">群聊</h6><div class="rk-l">${items.filter(x => x[0][0] == 'g').map(row).join('')}</div>` : '') + '<div class="rk-sp"></div>',
    foot: () => `<div class="rv-ft"><button data-rv="no">取消</button><button data-rv="yes" class="pri"></button></div>`,
    after: el => {
      const sync = () => { el.querySelectorAll('.rk').forEach(x => x.classList.toggle('on', keep.has(x.dataset.pk))); $('.nc-top span', el).textContent = `已选 ${keep.size} / 共 ${total}`; $('[data-all]', el).textContent = keep.size == total ? '全不选' : '全选'; $('[data-rv="yes"]', el).textContent = keep.size ? `添加 (${keep.size})` : '一个都不要'; };
      const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
      el.querySelectorAll('textarea').forEach(grow); sync();
      if (el._rk) return; el._rk = 1; // 事件只绑一次（展开 / 收起会重绘内容）
      el.addEventListener('input', e => { const tt = e.target.dataset?.tt, r0 = e.target.closest('[data-pk]'); if (tt != null && r0) return void ((byId[r0.dataset.pk].titles ||= {})[tt] = e.target.value.trim());
        const f = e.target.dataset?.f, r = e.target.closest('[data-pk]'); if (!f || !r) return; const x = byId[r.dataset.pk]; x[f] = e.target.value; e.target.tagName == 'TEXTAREA' && grow(e.target);
        const sm = $('[data-sum]', r); sm && (sm.textContent = r.dataset.pk[0] == 'g' ? sumG(x) : sumC(x)); const b = $('.rk-m b', r); f == (r.dataset.pk[0] == 'g' ? 'name' : 'nick') && b && (b.firstChild.textContent = e.target.value); });
      el.addEventListener('change', e => { const f = e.target.dataset?.f, r = e.target.closest('[data-pk]'); if (!f || !r) return; byId[r.dataset.pk][f] = e.target.value; e.target.tagName == 'SELECT' && s.reb(); });
      el.addEventListener('click', async e => {
        const t = e.target, r = t.closest('[data-pk]'), id = r?.dataset.pk, x = id && byId[id];
        if (t.closest('[data-rv]')) { e.stopPropagation(); finish(t.closest('[data-rv]').dataset.rv == 'yes'); return s.close(); }
        if (t.closest('[data-all]')) { e.stopPropagation(); keep.size == total ? keep.clear() : items.forEach(i => keep.add(i[0])); return sync(); }
        if (!r) return; e.stopPropagation();
        if (t.closest('[data-ck]')) { keep.has(id) ? keep.delete(id) : keep.add(id); return sync(); }
        if (t.closest('[data-av]')) { const v = await pickImg(400, 'av'); if (v != null) { drop(x.av); x.av = v; s.reb(); } return; }
        const out = t.closest('[data-out]')?.dataset.out; if (out) { x.members = x.members.filter(n => n != out); x.admins = x.admins.filter(n => n != out); x.owner == out && (x.owner = ''); return s.reb(); }
        const ad = t.closest('[data-adm]')?.dataset.adm; if (ad) { x.admins = x.admins.includes(ad) ? x.admins.filter(n => n != ad) : [...x.admins, ad]; return s.reb(); }
        if (t.closest('[data-tg]')) { open = open == id ? '' : id; s.reb(); }
      });
    },
    onClose: () => finish(true), // 点外面关掉：按当前勾选添加，不白白丢掉
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
const SV = (d, f) => `<svg viewBox="0 0 24 24" ${f ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;
const CI = {
  srch: SV('<circle cx="11" cy="11" r="6.6"/><path d="M20 20l-4.3-4.3"/>'), x: SV('<path d="M7 7l10 10M17 7L7 17"/>'), chev: SV('<path d="M9.5 6l6 6-6 6"/>'),
  addp: SV('<circle cx="10" cy="8" r="3.8"/><path d="M3 20c.8-3.8 3.6-5.6 7-5.6 1.4 0 2.7.3 3.8.9M18.5 13.5v6.5M15.3 16.8h6.4"/>'),
  addpF: SV('<circle cx="9.5" cy="8" r="4"/><path d="M2.5 20.5c.7-4 3.5-6.2 7-6.2s6.3 2.2 7 6.2z"/><path d="M19 9v6M16 12h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>', 1),
  grpF: SV('<circle cx="9" cy="8.3" r="3.7"/><circle cx="16.8" cy="9.3" r="2.9"/><path d="M2.3 19.8c.7-3.7 3.4-5.6 6.7-5.6s6 1.9 6.7 5.6zM16.3 14.1c3 0 5 1.7 5.6 5.1H17.6c-.3-1.9-.8-3.6-1.3-5.1z"/>', 1),
  id: SV('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.6-1.4 1.8-2.1 3.2-2.1s2.6.7 3.2 2.1M14.5 10h4M14.5 13.5h3"/>'),
  book: SV('<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>'),
  ai: SV('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>'),
  grpA: SV('<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c.7-3.5 3.2-5.3 6-5.3s5.3 1.8 6 5.3M18 8.5v6M15 11.5h6"/>'),
};
// 「推荐 / 可能认识的人」= 群里出现过、但还不是好友的人；点 × 不再推荐
const sug = () => D().chats.filter(c => c.type == 'p' && c.fr === 0 && !c.nosug);
const gOf = c => D().chats.find(g => g.type == 'g' && g.members.includes(c.id));
const sx = c => /女|^f/i.test(c?.sex || '') ? 'f' : /男|^m/i.test(c?.sex || '') ? 'm' : '';
const dq = c => esc([nm(c), c.real, c.nick, c.remark, c.name].filter(Boolean).join(' ').toLowerCase());
const hsh = s => [...String(s)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7) >>> 0;
const crow = (c, a = 'prof') => `<div class="cl" data-a="${a}" data-x="${c.id}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(nm(c))}</b></div></div>`;
const srchBar = (ph = '搜索') => `<label class="ct-q"><i>${CI.srch}</i><input data-ctq placeholder="${ph}" autocomplete="off"></label>`;
let ctab = 'grp', ctS = 0, qst = {}; const added = new Set();
function contacts() {
  const st = S.style, ps = D().chats.filter(c => c.type == 'p' && c.fr !== 0).sort((a, b) => COL.compare(nm(a), nm(b))), gs = D().chats.filter(c => c.type == 'g'), me = meObj(), sg = sug();
  if (st == 'wx') { // 微信：灰底白行、彩色方块入口、字母分组、右侧索引
    const by = {}; ps.forEach(c => (by[ini(nm(c))] ||= []).push(c)); const ks = Object.keys(by).sort((a, b) => a == '#' ? 1 : b == '#' ? -1 : a < b ? -1 : 1);
    const e = (k, ic, l, a, n = '') => `<div class="cw-e" data-a="${a}"><i class="${k}">${ic}</i><b>${l}</b>${n}</div>`;
    return `<div class="ct ct-wx">${ctS ? srchBar() : ''}<div class="cw-es ct-hide">${e('o', CI.addpF, '新的朋友', 'newfr', sg.length ? `<em class="rdot">${sg.length}</em>` : '')}${e('g', CI.grpF, '群聊', 'groups')}</div>`
      + ks.map(k => `<section data-sec><h6 data-l="${k}">${k}</h6>${by[k].map(c => crow(c)).join('')}</section>`).join('')
      + `<p class="ct-n ct-hide">${ps.length ? ps.length + '个朋友' : '还没有朋友，点「新的朋友」添加'}</p></div><nav class="az">${['↑', '☆', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'].map(k => `<b data-a="jump" data-x="${k}">${k}</b>`).join('')}</nav>`;
  }
  if (st == 'qq') { // QQ：搜索框、可能想认识的人、新朋友 / 群通知、分组 · 好友 · 群聊
    const by = {}; ps.forEach(c => (by[c.grp || '我的好友'] ||= []).push(c)); const ks = Object.keys(by).sort((a, b) => (b == '我的好友') - (a == '我的好友') || COL.compare(a, b)), op = k => qst[k] ?? ks.length == 1;
    const on = c => hsh(c.id) % 3 != 0, row = c => `<div class="cl cq-r" data-a="prof" data-x="${c.id}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(nm(c))}</b><small>${on(c) ? '<i class="on">[在线]</i>' : '[离线]'} ${esc(c.sign || '')}</small></div></div>`;
    return `<div class="ct ct-qq">${srchBar()}${sg.length ? `<div class="cq-may ct-hide"><div class="cq-h" data-a="newfr"><span>可能想认识的人</span>${CI.chev}</div>${sg.slice(0, 3).map(c => mayRow(c, 'qq')).join('')}</div>` : ''}`
      + `<div class="cq-ent ct-hide"><div data-a="newfr"><b>新朋友</b>${sg.length ? `<em class="rdot">${sg.length}</em>` : ''}${CI.chev}</div><div data-a="groups"><b>群通知</b>${CI.chev}</div></div>`
      + `<nav class="cq-tabs ct-hide">${[['grp', '分组'], ['fr', '好友'], ['gp', '群聊']].map(([k, l]) => `<b data-a="ctab" data-x="${k}" class="${ctab == k ? 'on' : ''}">${l}</b>`).join('')}</nav>`
      + (ctab == 'grp' ? ks.map(k => `<details class="qg" data-sec ${op(k) ? 'open' : ''}><summary data-a="qtog" data-x="${esc(k)}"><b>${esc(k)}</b><small>${by[k].filter(on).length}/${by[k].length}</small></summary>${by[k].map(row).join('')}</details>`).join('')
        : ctab == 'fr' ? ps.map(row).join('') : gs.map(c => `<div class="cl cq-r" data-a="open" data-x="${c.id}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(nm(c))}</b><small>${gsz(c)}人</small></div></div>`).join(''))
      + ((ctab == 'gp' ? gs : ps).length ? '' : `<p class="empty">${ctab == 'gp' ? '还没有群聊' : '还没有好友'}</p>`) + '</div>';
  }
  if (st == 'kk') { // KakaoTalk 친구：我的资料、群聊、好友（右侧状态消息气泡）
    const row = (c, a = 'prof') => `<div class="cl ck-r" data-a="${a}" data-x="${c.id}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(nm(c))}${c.type == 'g' ? ` <small>${gsz(c)}</small>` : ''}</b></div>${c.sign || c.notice ? `<span class="ck-st">${esc(c.type == 'g' ? c.notice : c.sign)}</span>` : ''}</div>`;
    return `<div class="ct ct-kk">${ctS ? srchBar() : ''}<div class="ck-me ct-hide" data-a="tab" data-x="me"><img class="av" src="${esc(avOf(me))}"><div class="cl-m"><b>${esc(me.nick)}</b><small>${esc(me.sign || '设置状态消息')}</small></div></div>`
      + (sg.length ? `<div class="ck-sug ct-hide" data-a="newfr"><i>${CI.addp}</i><span>推荐好友 <b>${sg.length}</b></span>${CI.chev}</div>` : '')
      + (gs.length ? `<section data-sec><h6 class="ck-h">群聊 ${gs.length}</h6>${gs.map(c => row(c, 'open')).join('')}</section>` : '')
      + `<section data-sec><h6 class="ck-h">好友 ${ps.length}</h6>${ps.map(c => row(c)).join('') || '<p class="tip">还没有好友，点右上角添加</p>'}</section></div>`;
  }
  // LINE：Ins 风（快拍头像条、为你推荐卡片、关注列表）
  const seen = new Set(D().posts.filter(p => now() - p.ts < 3 * 864e5).map(p => p.a));
  const story = (c, me) => `<div class="ci-s" data-a="${me ? 'myfeed' : 'pfeed'}" data-x="${c.id}"><i class="${seen.has(me ? 'me' : c.id) ? 'ring' : ''}"><img class="av" src="${esc(avOf(c))}">${me ? '<em>+</em>' : ''}</i><small>${me ? '你的快拍' : esc(nm(c))}</small></div>`;
  const row = (c, a = 'prof') => `<div class="cl ci-r" data-a="${a}" data-x="${c.id}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}"><div class="cl-m"><b>${esc(c.type == 'g' ? c.name : c.nick || nm(c))}</b><small>${esc(c.type == 'g' ? gsz(c) + ' 位成员' : [c.remark, c.real].filter((x, i, l) => x && x != c.nick && l.indexOf(x) == i).join(' · ') || c.sign || '')}</small></div><button class="ci-b" data-a="chat2" data-x="${c.id}">发消息</button></div>`;
  return `<div class="ct ct-ins">${srchBar()}<div class="ci-st ct-hide">${story(me, 1)}${ps.map(c => story(c)).join('')}</div>`
    + (sg.length ? `<div class="ci-sh ct-hide"><b>为你推荐</b><span data-a="newfr">查看全部</span></div><div class="ci-sg ct-hide">${sg.slice(0, 8).map(c => `<div class="ci-c"><b class="x" data-a="nosug" data-x="${c.id}">${CI.x}</b><img class="av" src="${esc(avOf(c))}" data-a="prof" data-x="${c.id}"><b>${esc(nm(c))}</b><small>${gOf(c) ? '群聊「' + esc(gOf(c).name) + '」' : '可能认识'}</small><button data-a="addfr" data-x="${c.id}">关注</button></div>`).join('')}</div>` : '')
    + (gs.length ? `<section data-sec><h6 class="ci-h">群聊 <small>${gs.length}</small></h6>${gs.map(c => row(c, 'open')).join('')}</section>` : '')
    + `<section data-sec><h6 class="ci-h">关注中 <small>${ps.length}</small></h6>${ps.map(c => row(c)).join('') || '<p class="tip">还没有关注任何人，点右上角发现用户</p>'}</section></div>`;
}
// 一行「可能认识的人」：各风格的按钮和文案不同
const mayRow = (c, st) => {
  const g = gOf(c), ad = added.has(c.id), sub = g ? (st == 'qq' ? '你的群友 · ' : st == 'kk' ? '' : '群聊「') + esc(g.name) + (st == 'qq' || st == 'kk' ? '' : '」') : '可能认识';
  const btnT = { wx: ['添加', '已添加'], qq: ['添加', '已添加'], kk: ['添加', '已添加'], line: ['关注', '已关注'] }[st] || ['添加', '已添加'];
  const tags = st == 'qq' ? `<div class="tags">${sx(c) ? `<em class="sx ${sx(c)}">${sx(c) == 'f' ? '♀' : '♂'}</em>` : ''}<em>${sub}</em></div>` : `<small>${st == 'kk' && g ? esc(g.name) + ' 群成员' : sub}</small>`;
  return `<div class="may may-${st}" data-q="${dq(c)}"><img class="av" src="${esc(avOf(c))}" data-a="prof" data-x="${c.id}"><div class="cl-m" data-a="prof" data-x="${c.id}"><b>${esc(nm(c))}</b>${tags}</div>${ad ? `<span class="done">${btnT[1]}</span>` : `<button data-a="addfr" data-x="${c.id}">${btnT[0]}</button>${st == 'wx' ? '' : `<b class="x" data-a="nosug" data-x="${c.id}">${CI.x}</b>`}`}</div>`;
};
// 加好友页：微信「新的朋友」/ QQ「新朋友」/ Kakao「친구 추가」/ LINE·Ins「发现用户」
async function addF() { const r = await form('添加好友', [['av', '头像', 'img'], ['nick', '昵称（网名）'], ['real', '真实姓名'], ['remark', '备注'], ['sex', '性别', 'sel', [['', '未知'], ['男', '男'], ['女', '女']]], ['sign', '个性签名']]); r && (r.nick || r.real) && (add(blank('p', r)), saveD(), emit('chat'), toast('已添加')); }
async function addG() { const r = await form('发起群聊', [['av', '群头像', 'img'], ['name', '群名'], ['notice', '群公告', 'area'], ['members', '选择成员', 'multi', D().chats.filter(c => c.type == 'p').map(c => [c.id, nm(c)])]]); r?.name && (add(blank('g', { ...r, members: r.members || [] })), saveD(), emit('chat'), toast('群聊已创建')); }
const CTA = {
  newfr: () => newFr(), groups: () => page({ title: '群聊', cls: 'st-' + S.style, body: () => D().chats.filter(c => c.type == 'g').map(c => crow(c, 'open')).join('') || '<p class="empty">还没有群聊</p>', acts: { open: id => (back(), openChat(id)) } }),
  addfr: id => { const c = get(id); if (!c) return; c.fr = 1; added.add(id); saveD(); emit('chat'); toast(`已添加「${nm(c)}」，现在可以私聊了`); },
  nosug: id => { const c = get(id); c && (c.nosug = 1, saveD(), emit('chat')); },
  chat2: id => openChat(id), qtog: (k, t, e, pg) => { const ks = Object.keys(D().chats.filter(c => c.type == 'p' && c.fr !== 0).reduce((a, c) => (a[c.grp || '我的好友'] = 1, a), {})); qst[k] = !(qst[k] ?? ks.length == 1); },
  ctsrch: (x, t, e, pg) => { ctS = !ctS; pg.reb(); ctS && setTimeout(() => $('[data-ctq]', pg.el)?.focus(), 30); },
  nf_f: addF, nf_g: addG, nf_ai: () => aiInit(), nf_wi: () => fromWi(),
};
export function newFr() {
  const st = S.style, T = { wx: '新的朋友', qq: '新朋友', kk: '添加好友', line: '发现用户' };
  page({ title: T[st], cls: 'nfpg st-' + st, live: 1, onClose: () => setTimeout(() => top()?.live && top().re()), after: ctBind, right: () => st == 'wx' ? `<b class="txt" data-a="nf_f">添加朋友</b>` : '', acts: CTA, body: () => {
    const L = D().chats.filter(c => c.type == 'p' && (c.fr === 0 && !c.nosug || added.has(c.id))), list = L.map(c => mayRow(c, st)).join('');
    const opt = (a, ic, l, sm) => `<div class="nf-o" data-a="${a}"><i>${ic}</i><div class="cl-m"><b>${l}</b>${sm ? `<small>${sm}</small>` : ''}</div>${CI.chev}</div>`;
    const opts = [['nf_f', CI.id, '手动添加', '填昵称、真实姓名、头像'], ['nf_ai', CI.ai, 'AI 生成联系人', '按角色卡和剧情生成'], ['nf_wi', CI.book, '从世界书添加', '读取世界书里的人物'], ['nf_g', CI.grpA, '发起群聊', '']];
    if (st == 'kk') return `<div class="nf nf-kk"><div class="nk-ic ct-hide">${[['nf_f', CI.id, 'ID添加'], ['nf_wi', CI.book, '世界书导入'], ['nf_ai', CI.ai, 'AI推荐'], ['nf_g', CI.grpA, '建群']].map(([a, ic, l]) => `<div data-a="${a}"><i>${ic}</i><small>${l}</small></div>`).join('')}</div><h6>推荐好友 <small>${L.length}</small></h6>${list || '<p class="nf-e">暂时没有推荐好友<br><small>群里出现过、还不是好友的人会出现在这里</small></p>'}</div>`;
    if (st == 'line') return `<div class="nf nf-ins">${srchBar()}<div class="nf-os ct-hide">${opts.map(o => opt(...o)).join('')}</div><h6>为你推荐</h6>${list || '<p class="nf-e">暂时没有推荐<br><small>群里出现过、还没关注的人会出现在这里</small></p>'}</div>`;
    if (st == 'qq') return `<div class="nf nf-qq">${srchBar('QQ号/手机号/群')}<div class="nf-os ct-hide">${opts.map(o => opt(...o)).join('')}</div><h6>可能想认识的人</h6>${list || '<p class="nf-e">暂时没有</p>'}</div>`;
    return `<div class="nf nf-wx"><div class="nf-wq" data-a="nf_f">${CI.srch}<span>账号/手机号</span></div><div class="nf-os ct-hide">${opts.slice(1).map(o => opt(...o)).join('')}</div><h6>可能认识的人</h6>${list || '<p class="nf-e">暂时没有新的朋友</p>'}</div>`;
  } });
}
function prof(id) {
  const c = get(id), g = c.type == 'g';
  page({ title: '', cls: 'profpg', live: 1, body: () => `<div class="pf"><img class="av" src="${esc(avOf(c))}"><div><b>${esc(nm(c))}</b>${c.remark && c.nick ? `<small>昵称：${esc(c.nick)}</small>` : ''}${c.real && !g ? `<small>真实姓名：${esc(c.real)}</small>` : ''}<small>${g ? '群号：' + c.no : '账号：' + esc(c.nick || c.id)}</small></div></div>
<div class="card">${c.sign || c.notice ? `<div class="row"><span>${g ? '群公告' : '个性签名'}</span><small>${esc(g ? c.notice : c.sign)}</small></div>` : ''}${g ? `<div class="row"><span>群成员</span><small>${gsz(c)} 人</small></div>` : `<div class="row"><span>性别</span><small>${esc(c.sex || '未知')}</small></div><div class="row"><span>分组</span><small>${esc(c.grp || '我的好友')}</small></div>`}</div>
${btn('pchat', g ? '进入群聊' : '发消息', '', 'pri')}${g ? '' : btn('pfd', '查看' + FN[sty(c)])}${btn('pset', '资料与聊天设置')}`,
    acts: { pchat: () => { back(); openChat(id); }, pfd: () => openFeed(id), pset: () => cset(c) } });
}

/* ---------- 聊天 App ---------- */
// 多选：长按任意会话进入，点选 / 全选，底部批量置顶、已读、删除；左上角返回退出多选
const mbar = () => { const n = msel.size, L = [...msel].map(get).filter(Boolean), allPin = n && L.every(c => c.pin);
  return `<nav class="mbar"><button data-a="mpin" class="${n ? '' : 'off'}">${allPin ? '取消置顶' : '置顶'}</button><button data-a="mread" class="${n ? '' : 'off'}">标为已读</button><button data-a="mdel" class="danger ${n ? '' : 'off'}">删除${n ? `(${n})` : ''}</button></nav>`; };
const MS = {
  clp: (id, t, e, pg) => { if (msel) return MS.mtog(id, t, e, pg); navigator.vibrate?.(12); msel = new Set([id]); pg.re(); },
  mtog: (id, t, e, pg) => { msel.has(id) ? msel.delete(id) : msel.add(id); pg.re(); },
  mall: (x, t, e, pg) => { const all = vis().map(c => c.id); msel = msel.size >= all.length ? new Set() : new Set(all); pg.re(); },
  back: (x, t, e, pg) => { if (!msel) return back(); msel = null; pg.re(); },
  mpin: (x, t, e, pg) => { const L = [...msel].map(get).filter(Boolean); if (!L.length) return; const v = !L.every(c => c.pin); L.forEach(c => c.pin = v); msel = null; saveD(); emit('chat'); toast(v ? `已置顶 ${L.length} 个` : '已取消置顶'); },
  mread: (x, t, e, pg) => { const L = [...msel].map(get).filter(Boolean); if (!L.length) return; L.forEach(c => c.unread = 0); msel = null; saveD(); emit('chat'); toast(`已标为已读`); },
  mdel: async (x, t, e, pg) => {
    const L = [...msel].map(get).filter(Boolean); if (!L.length) return; const g = L.filter(c => c.type == 'g').length, p = L.length - g;
    if (!await ok(`删除选中的${p ? ` ${p} 个联系人` : ''}${p && g ? '和' : ''}${g ? ` ${g} 个群聊` : ''}？聊天记录也会一起清除`)) return;
    L.forEach(rm); msel = null; saveD(); emit('chat'); toast(`已删除 ${L.length} 个`);
  },
};
// 通讯录搜索：只在本页过滤，不重新渲染（不丢输入框焦点）
const ctBind = el => { if (el._ctq) return; el._ctq = 1; el.addEventListener('input', e => {
  if (!e.target.matches('[data-ctq]')) return; const v = e.target.value.trim().toLowerCase(), b = e.target.closest('.pg-b');
  b.classList.toggle('qing', !!v); $$('[data-q]', b).forEach(r => r.hidden = !!v && !r.dataset.q.includes(v));
  $$('[data-sec]', b).forEach(s => { v && s.tagName == 'DETAILS' && (s.open = true); s.hidden = !!v && !s.querySelector('[data-q]:not([hidden])'); });
}); };
let tab = 'list';
reg({
  id: 'chat', name: '聊天', icon: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M9.5 4C5.4 4 2 6.8 2 10.2c0 1.9 1 3.6 2.7 4.7L4 17.5l3-1.6c.8.2 1.6.3 2.5.3 4.1 0 7.5-2.8 7.5-6.2S13.6 4 9.5 4z"/><path opacity=".8" d="M22 14.6c0-2.3-1.7-4.3-4.2-5.2l.1.9c0 4-3.7 7.2-8.4 7.4 1.1 1.4 3.1 2.3 5.3 2.3.6 0 1.2-.1 1.8-.2l2.4 1.2-.5-2c1.4-1 2.5-2.6 2.5-4.4z"/></svg>',
  open: () => page({
    cls: 'chatapp', live: 1, model: () => D().me, onClose: () => { msel = null; },
    title: () => msel && tab == 'list' ? `已选择 ${msel.size} 项` : ({ list: TN[S.style], ct: CN[S.style], feed: '', me: '我' })[tab],
    right: () => msel && tab == 'list' ? `<b class="txt" data-a="mall">${msel.size && msel.size >= vis().length ? '全不选' : '全选'}</b>` : tab == 'ct' ? ({ wx: `<b data-a="ctsrch">${CI.srch}</b><b data-a="plus">${I.plus}</b>`, kk: `<b data-a="ctsrch">${CI.srch}</b><b data-a="newfr">${CI.addp}</b>` }[S.style] || `<b data-a="newfr">${CI.addp}</b>`) : tab == 'feed' ? feedRight() : '',
    body: () => tab == 'list' ? list() : tab == 'ct' ? contacts() : tab == 'feed' ? feed() : meP(), foot: () => msel && tab == 'list' ? mbar() : tabs(tab), after: el => { stCls(el, 'chatapp st-' + S.style + ' tb-' + tab); ctBind(el); if (tab == 'feed') mountFeed(el); },
    onChange: k => k == '$style' && emit('chat'),
    acts: {
      ...FA, ...CTA, aiInit, tab: (x, t, e, pg) => { tab = x; msel = null; ctS = 0; pg.re(); }, ...MS, prof, ctab: (x, t, e, pg) => { ctab = x; pg.reb(); },
      jump: (x, t, e, pg) => { const b = $('.pg-b', pg.el), s = /[↑☆]/.test(x) ? (b.scrollTop = 0, null) : $(`[data-l="${x}"]`, b) || [...$$('[data-l]', b)].find(h => h.dataset.l > x); s && (b.scrollTop += (s.getBoundingClientRect().top - b.getBoundingClientRect().top) * b.offsetHeight / b.getBoundingClientRect().height); }, open: (id, t, e, pg) => msel ? MS.mtog(id, t, e, pg) : openChat(id),
      plus: async () => {
        const k = await menu([['f', '👤 添加好友'], ['g', '👥 发起群聊'], ['ai', '✨ AI 生成联系人'], ['wi', '📖 从世界书添加']]);
        if (k == 'f') return newFr();
        if (k == 'g') return addG();
        k == 'ai' && await aiInit(); k == 'wi' && await fromWi(); saveD(); emit('chat');
      },
    },
  }),
});
