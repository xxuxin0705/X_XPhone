// 聊天 · 数据层：联系人/群/消息的增删改，以及剧情同步 delta 的应用
import { C, S, D, saveD, uid, ui, top, now, genImg, emit, merge, byId, nm, meObj } from '../../core.js';

export const CFG = { style: '', bub: '', shape: '', avs: '', showAv: true, cont: true, dark: false, frame: '', bg: '', lang: '', trOpen: false, trMine: false, inj: false, read: true, pat: true };
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
export const blank = (type, o) => ({ id: uid(), type, name: '', nick: '', real: '', remark: '', sign: '', av: '', voice: '', ps: '', msgs: [], cfg: { ...CFG }, members: [], admins: [], titles: {}, owner: '', no: type == 'g' ? String(1e8 + Math.random() * 9e8 | 0) : '', notice: '', pin: 0, unread: 0, ...o });
export const add = c => (D().chats.push(c), c);
export const find = (n, type) => n && D().chats.find(c => (!type || c.type == type) && [c.real, c.nick, c.remark, c.name, c.id].includes(n));
export const isMe = n => !!n && ['me', '我', '用户', C().name1, D().me.nick].includes(n);
export const upsert = o => { const n = o.real || o.nick, c = find(o.real, 'p') || find(o.nick, 'p'); if (!c) return add(blank('p', { ...o, nick: o.nick || n, real: n })); ['nick', 'real', 'remark', 'sign'].forEach(k => o[k] && !c[k] && (c[k] = o[k])); o.fr && (c.fr = 1); return c; };
// 只是群成员、没加好友的人 fr=0：不进通讯录和消息列表
export const member = (g, n) => { const c = upsert({ real: n, fr: 0 }); g.members.includes(c.id) || g.members.push(c.id); return c.id; };
export const viewing = id => top()?.chat == id && ui.root.classList.contains('on');
export const sty = c => c?.cfg?.style || S.style;
export const who = (ch, f) => f == 'me' ? nm(meObj()) : nm(get(f));
// 表情包：先按名字精确匹配，再互相包含模糊匹配
export const stk = n => { n = String(n || '').trim(); const L = S.assets.sticker; return (L.find(s => s.name == n) || L.find(s => n && (n.includes(s.name) || s.name.includes(n))))?.img || ''; };
// 表情回应统一成 [{e, by}]（兼容旧版纯字符串）
export const nre = r => (r || []).map(x => typeof x == 'string' ? { e: x, by: 'me' } : x);
export const shake = () => { const s = ui.scr; s.classList.remove('shk'); void s.offsetWidth; s.classList.add('shk'); };

// 消息类型：text sticker img voice transfer pat sys；以及动作 react accept recall
export function addMsg(ch, m) {
  const t = m.type || 'text', f = isMe(m.from) ? 'me' : ch.type == 'p' ? ch.id : member(ch, m.from), name = who(ch, f);
  const near = frag => (frag && ch.msgs.findLast(x => !/sys|pat/.test(x.t) && (String(x.c) + (x.orig || '')).includes(frag))) || null;
  if (t == 'react') { const x = near(m.frag) || ch.msgs.findLast(x => x.f == 'me' && !/sys|pat/.test(x.t)); x && (x.re = [...nre(x.re), { e: m.text || '❤️', by: f }]); return null; }
  if (t == 'accept') { const x = ch.msgs.findLast(x => x.t == 'transfer' && x.f == 'me' && !x.st); x && (x.st = '已收款'); return null; }
  if (t == 'recall') { const x = ch.msgs.findLast(x => x.f == f && !/sys|pat/.test(x.t)); x && Object.assign(x, { t: 'sys', c: `“${name}” 撤回了一条消息`, re: [] }); return null; }
  const x = { f, t, c: t == 'pat' ? `“${name}” ${String(m.text || '拍了拍你').replace(/你/g, '我')}` : String(m.text ?? ''), tr: m.tr || '', amt: +m.amount || 0, ts: +now() };
  const q = near(m.quote); q && (x.q = { w: who(ch, q.f), c: String(q.c).slice(0, 40) });
  t == 'sticker' && (x.img = stk(x.c)); ch.msgs.push(x); t == 'pat' && shake();
  f != 'me' && !viewing(ch.id) && (ch.unread = (ch.unread || 0) + 1);
  t == 'img' && S.api.img.auto && genImg(x.c).then(u => { x.url = u; saveD(); emit('chat'); }).catch(() => { });
  return f == 'me' ? null : x;
}
export function applyDelta(d, cur) {
  const out = []; d ||= {};
  d.contacts?.forEach(c => (c.real || c.nick) && !isMe(c.real) && upsert({ ...c, fr: 1 }));
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
export const rm = c => { D().chats = D().chats.filter(x => x != c); D().chats.forEach(g => { g.members = g.members.filter(m => m != c.id); g.admins = g.admins.filter(m => m != c.id); }); };
