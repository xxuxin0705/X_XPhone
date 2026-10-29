// 聊天 · 数据层：联系人/群/消息的增删改，以及剧情同步 delta 的应用
import { C, S, D, saveD, uid, ui, top, now, genImg, emit, merge, byId, nm, meObj, fail, drop, brief } from '../../core.js';

export const CFG = { style: '', bub: '', shape: '', avs: '', showAv: true, cont: true, dark: false, frame: '', bg: '', lang: '', trOpen: false, trMine: false, inj: false, read: true, pat: true, auto: false, trAuto: true, trTo: '', trFollow: true, rmin: 1, rmax: 5, vmin: 0, vmax: 1 };
// 这个人在这个聊天里说什么语言：私聊看聊天设置；群聊默认跟随成员各自私聊的设置，也可以统一设成一种
export const langFor = (ch, f) => !f || f == 'me' ? '' : ch.type == 'g' ? (ch.cfg?.trFollow !== false ? get(f)?.cfg?.lang || '' : ch.cfg?.lang || '') : ch.cfg?.lang || '';
// 我的消息翻译成什么：没单独选就跟对方的语言一样
export const myLang = ch => ch.cfg?.trTo || (ch.type == 'p' ? ch.cfg?.lang : '') || '';
export const STY = [['wx', '仿微信'], ['qq', '仿QQ'], ['kk', '仿KakaoTalk'], ['line', '仿LINE']];
export const TN = { wx: '微信', qq: '消息', kk: '聊天', line: '聊天' }, CN = { wx: '通讯录', qq: '联系人', kk: '联系人', line: '联系人' };
export const FS = { wx: 'wx', qq: 'qq', kk: 'tw', line: 'tw' }, FN = { wx: '朋友圈', qq: 'QQ空间', kk: '动态', line: '动态' };
export const LANGS = [['', '不翻译'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语'], ['fr', '法语'], ['de', '德语'], ['es', '西班牙语'], ['ru', '俄语'], ['th', '泰语'], ['vi', '越南语'], ['zh-TW', '繁体中文']];
export const lname = c => LANGS.find(x => x[0] == c)?.[1] || c;

export const get = id => {
  const c = byId(id); if (!c) return c; merge(c.cfg ||= {}, CFG);
  if ('tr' in c.cfg) { c.cfg.lang = c.cfg.tr ? LANGS.find(x => x[1] == c.cfg.lang || x[0] == c.cfg.lang)?.[0] || '' : ''; delete c.cfg.tr; } // 旧版设置迁移
  return c;
};
export const blank = (type, o) => ({ id: uid(), type, name: '', nick: '', real: '', remark: '', sign: '', sex: '', av: '', voice: '', ps: '', msgs: [], cfg: { ...CFG }, members: [], admins: [], titles: {}, owner: '', no: type == 'g' ? String(1e8 + Math.random() * 9e8 | 0) : '', notice: '', pin: 0, unread: 0, ...o });
export const add = c => (D().chats.push(c), c);
// 群人数：没在剧情里出现的成员不单独生成，只记总人数（显示时取「已知成员+我」和总人数里大的那个）
export const gsz = g => Math.max(+g?.size || 0, (g?.members?.length || 0) + 1);
export const find = (n, type) => n && D().chats.find(c => (!type || c.type == type) && [c.real, c.nick, c.remark, c.name, c.id].includes(n));
export const isMe = n => !!n && ['me', '我', '用户', C().name1, D().me.nick].includes(n);
// lang：AI 生成联系人时给的默认翻译语言，写进聊天设置 cfg.lang（已有设置不覆盖）
export const upsert = ({ lang, ...o }) => { const n = o.real || o.nick; let c = find(o.real, 'p') || find(o.nick, 'p'); if (!c) { c = add(blank('p', { ...o, nick: o.nick || n, real: n })); lang && (c.cfg.lang = lang); return c; } ['nick', 'real', 'remark', 'sign', 'sex', 'ps'].forEach(k => o[k] && !c[k] && (c[k] = o[k])); lang && !c.cfg?.lang && ((c.cfg ||= {}).lang = lang); o.fr && (c.fr = 1); return c; };
// 只是群成员、没加好友的人 fr=0：不进通讯录和消息列表
export const member = (g, n) => { const c = upsert({ real: n, fr: 0 }); g.members.includes(c.id) || g.members.push(c.id); return c.id; };
export const viewing = id => top()?.chat == id && ui.root.classList.contains('on');
export const sty = c => c?.cfg?.style || S.style;
export const who = (ch, f) => f == 'me' ? nm(meObj()) : nm(get(f));
// 引用：记住被引用那条的 id（没有就现给一个），显示时按 id 取它现在的内容；w / c 是当时的样子，只在那条找不到时兜底
export const qref = (ch, m) => ({ id: m.id ||= uid(), w: who(ch, m.f), c: brief(m).slice(0, 40) });
// 表情包：先按名字精确匹配，再互相包含模糊匹配
export const stk = n => { n = String(n || '').trim(); const L = S.assets.sticker; return (L.find(s => s.name == n) || L.find(s => n && (n.includes(s.name) || s.name.includes(n))))?.img || ''; };
// 表情回应统一成 [{e, by}]（兼容旧版纯字符串）
export const nre = r => (r || []).map(x => typeof x == 'string' ? { e: x, by: 'me' } : x);
export const shake = () => { const s = ui.scr; s.classList.remove('shk'); void s.offsetWidth; s.classList.add('shk'); };

// 消息类型：text sticker img voice transfer pat sys song listen minv；以及动作 react accept recall
// 拍一拍跟微信一样：「“X” 拍了拍你」，后缀只用你在「我」里设置的拍一拍后缀（没设置就没有后缀）；
// 群里写了成员名字就是拍那个人（+ TA 的后缀）。模型写的动作 / 后缀一律不用，微信的拍一拍没有自定义动作
const patC = (ch, name, txt) => { const t = String(txt || ''), tg = ch.type == 'g' && t && ch.members.map(get).find(c => c && [c.real, c.nick, c.remark].some(n => n && t.includes(n)));
  return tg ? `“${name}” 拍了拍 “${nm(tg)}”${tg.ps || ''}` : `“${name}” 拍了拍你${(D().me.ps || '').trim()}`; };
export function addMsg(ch, m) {
  const st = m.type == null || m.type == 'text' ? String(m.text ?? '').trim().match(/^[\[【](?:表情包?|贴纸)[:：]\s*([^\]】]+)[\]】]$/) : null; st && (m = { ...m, type: 'sticker', text: st[1].trim() }); // 正文同步里的 [表情:xx] 也当表情包
  const t = m.type || 'text', f = isMe(m.from) ? 'me' : ch.type == 'p' ? ch.id : member(ch, m.from), name = who(ch, f);
  const near = frag => (frag && ch.msgs.findLast(x => !/sys|pat/.test(x.t) && (String(x.c) + (x.orig || '')).includes(frag))) || null;
  if (t == 'react') { const x = near(m.frag) || ch.msgs.findLast(x => x.f == 'me' && !/sys|pat/.test(x.t)); x && (x.re = [...nre(x.re), { e: m.text || '❤️', by: f }]); return null; }
  if (t == 'hbopen') { const x = ch.msgs.findLast(x => x.t == 'hb' && x.f == 'me' && !x.st); x && (x.st = '已被领取', ch.msgs.push({ f: 'sys', t: 'sys', c: `${name}领取了你的红包`, ts: +now() })); return null; }
  if (t == 'accept') { const x = ch.msgs.findLast(x => x.t == 'transfer' && x.f == 'me' && !x.st); x && (x.st = '已收款'); return null; }
  if (t == 'recall') { const x = ch.msgs.findLast(x => x.f == f && !/sys|pat/.test(x.t)); x && Object.assign(x, { t: 'sys', c: `“${name}” 撤回了一条消息`, re: [] }); return null; }
  const x = { f, t, c: t == 'pat' ? patC(ch, name, m.text) : t == 'hb' ? String(m.text || '恭喜发财，大吉大利') : String(m.text ?? ''), tr: m.tr || '', amt: t == 'hb' ? Math.min(200, +m.amount || 0) : +m.amount || 0, ts: +now() };
  const q = near(m.quote); q && (x.q = qref(ch, q));
  t == 'minv' && Object.assign(x, { song: { name: x.c, artist: String(m.artist || '').trim(), pic: '' }, st: 'pending', c: `[音乐]《${x.c}》${m.artist ? ' - ' + m.artist : ''}` }); // 角色邀请一起听
  t == 'sticker' && (x.img = stk(x.c)); ch.msgs.push(x); t == 'pat' && shake();
  f != 'me' && !viewing(ch.id) && (ch.unread = (ch.unread || 0) + 1);
  t == 'img' && S.api.img.auto && genImg(x.c, undefined, 'chat').then(u => { x.url = u; saveD(); emit('chat'); }).catch(e => fail('自动生图失败：' + e.message));
  return f == 'me' ? null : x;
}
export function applyDelta(d, cur) {
  const out = []; d ||= {};
  d.contacts?.forEach(c => (c.real || c.nick) && !isMe(c.real) && upsert({ ...c, fr: 1 }));
  d.groups?.forEach(g => {
    if (!g.name) return; const x = find(g.name, 'g') || add(blank('g', { name: g.name }));
    g.no && (x.no = String(g.no)); g.notice && (x.notice = g.notice); g.owner && !isMe(g.owner) && (x.owner = member(x, g.owner));
    g.admins?.forEach(n => { if (isMe(n)) return; const i = member(x, n); x.admins.includes(i) || x.admins.push(i); }); g.members?.forEach(n => isMe(n) || member(x, n));
    +g.size > 0 && (x.size = +g.size); Object.entries(g.titles || {}).forEach(([n, t]) => { if (!t || isMe(n)) return; (x.titles ||= {})[member(x, n)] = t; });
  });
  d.msgs?.forEach(m => { const ch = cur || find(m.chat) || upsert({ real: isMe(m.from) ? m.chat : m.from }), x = ch && addMsg(ch, m); x && out.push([ch, x]); });
  d.posts?.forEach(p => {
    const sp = t => { const m = String(t || '').match(/^([\s\S]*?)\s*[\[【]翻译[:：]([^\]】]*)[\]】]\s*$/); return m ? [m[1].trim(), m[2].trim()] : [String(t || '').trim(), '']; }; // 正文里夹着 [翻译:…] 也拆开
    const [pc, ptr] = sp(p.text), po = { id: uid(), a: isMe(p.author) ? 'me' : upsert({ real: p.author }).id, c: pc, tr: p.tr || ptr, imgd: p.img || '', ts: +now() - Math.random() * 18e6, likes: (p.likes || []).filter(Boolean), lx: Math.random() < .6 ? Math.random() * 120 | 0 : 0, cm: (p.comments || []).map(c => { const [cc, ct] = sp(c.text); return { f: c.from, c: cc, tr: c.tr || ct, ...(c.to && { to: c.to }) }; }) };
    D().posts.unshift(po); po.imgd && S.api.img.auto && genImg(po.imgd, undefined, 'chat').then(u => { po.url = u; saveD(); emit('chat'); }).catch(e => fail('动态配图失败：' + e.message));
  });
  saveD(); emit('chat'); return out;
}
export const rm = c => { drop(c); D().chats = D().chats.filter(x => x != c); D().chats.forEach(g => { g.members = g.members.filter(m => m != c.id); g.admins = g.admins.filter(m => m != c.id); }); };
