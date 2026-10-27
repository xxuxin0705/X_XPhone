// 聊天 · 聊天窗口：回复协议 / 生成 / 翻译 / 拍一拍 / 表情包 / 表情回应 / 引用 / 撤回 / 聊天设置
import { stkFind, stkPage, storePage, packPage, minePage, pack, packMeta, coverNow, imgH, msgOf, warm, stkMig, mine, rmPack, rmMine, renItem } from './sticker.js';
import { voiceOf, pickVoice, ttsCfg, TTSP, prof, task } from '../../core.js';
import { vSec, vActs, vChange, meVoice } from './voice.js';
import { C, G, S, D, saveD, esc, uid, $, ui, page, top, back, home, menu, form, ok, toast, fx, btn, sec, nm, rn, avOf, defAv, meObj, brief, say, now, hm, llm, json, sysCtx, genImg, tts, notify, on, emit, pickImg, pickFile, I, sleep, mt, APPS, fail, drop } from '../../core.js';
import { get, isMe, addMsg, viewing, sty, who, nre, shake, rm, gsz, STY, LANGS, lname, langFor, myLang } from './data.js';
import { openFeed } from './chat.js';
import { payPage, hbOpen } from './pay.js';
import { bridge as mzB } from '../music/music-share.js';

const EMO = '❤️ 👍 😂 🥺 😮 😡 🥳 🙏'.split(' ');
// 长按菜单的图标（仿微信深色气泡菜单）
const MI = {edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>', copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>', fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5l7 6-7 6"/><path d="M21 11H11a7 7 0 0 0-7 7v1"/></svg>', add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7.5"/><path d="M8.5 9.5h.01M13.5 9.5h.01M8.5 13.5c1.4 1.4 3.6 1.4 5 0"/><path d="M19 15v6M16 18h6"/></svg>', q: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17c-2 0-3-1.6-3-3.6C4 9.8 6.2 7.3 9 6.5"/><path d="M16 17c-2 0-3-1.6-3-3.6 0-3.6 2.2-6.1 5-6.9"/><circle cx="7" cy="14" r="2.6"/><circle cx="16" cy="14" r="2.6"/></svg>', tr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h9M8.5 3v2M6 5c.8 3.5 3 6 6 7.5M11 5c-.6 3.6-3 6.6-6.5 8"/><path d="M13 20l4-9 4 9M14.5 17h5"/></svg>', tts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9v6h4l5 4V5L9 9H5z"/><path d="M17.5 8.5a5 5 0 0 1 0 7"/></svg>', multi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M4 12h10M4 18h7"/><path d="M15 17l2.5 2.5L22 15"/></svg>', inj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>', rc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>', regen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>', del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'};
// 长按消息：在消息旁边弹出深色菜单（上面一排表情回应，下面图标按钮），点空白处关闭；返回选中的 key
const pop = (anchor, items, emo = true) => new Promise(res => {
  const scr = ui.scr, R = scr.getBoundingClientRect(), A = anchor.getBoundingClientRect(), z = (parseFloat(getComputedStyle(ui.root).getPropertyValue('--sc')) || 1);
  const m = Object.assign(document.createElement('div'), { className: 'mpop-m' }); let done = 0;
  const end = k => { if (done) return; done = 1; m.classList.add('out'); setTimeout(() => m.remove(), 160); res(k ?? null); };
  m.innerHTML = `<div class="mpop">${emo ? `<div class="mp-e">${EMO.map(e => `<b data-k="~${e}">${e}</b>`).join('')}</div>` : ''}<div class="mp-g">${items.map(([k, l]) => `<b data-k="${k}" class="${k == 'del' ? 'dg' : ''}">${MI[k == 'tts' ? 'tts' : k] || ''}<span>${l}</span></b>`).join('')}</div><i class="mp-ar"></i></div>`;
  scr.append(m); const P = m.firstChild, W = R.width / z, ph = P.offsetHeight, pw = P.offsetWidth;
  const top = (A.top - R.top) / z, bot = (A.bottom - R.top) / z, cx = ((A.left + A.right) / 2 - R.left) / z, up = top - ph - 12 > 60;
  P.style.top = (up ? top - ph - 10 : Math.min(bot + 10, R.height / z - ph - 8)) + 'px'; P.style.left = Math.max(8, Math.min(W - pw - 8, cx - pw / 2)) + 'px';
  const ar = P.lastChild; ar.style.left = Math.max(14, Math.min(pw - 14, cx - parseFloat(P.style.left))) + 'px'; ar.classList.add(up ? 'dn' : 'up');
  m.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-k]'); end(b ? b.dataset.k : null); });
});
// 合并转发的聊天记录：点开看全部
function recPage(m) {
  page({ title: esc(m.c), cls: 'recpg', body: () => `<div class="rec-l">${(m.rec || []).map(r => `<div class="rec-i"><b>${esc(r.n)}</b>${r.img ? `<img class="stk" src="${esc(r.img)}" referrerpolicy="no-referrer">` : `<p>${esc(r.c)}</p>`}</div>`).join('')}</div>` });
}

const EMOJI = [...'😀😁😂🤣😊😇🙂😉😍🥰😘😚😋😛😜🤪😎🤓🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🙄😬😴🤤😪😵🤐🥴🤢🤧😷🤒🤕🤑🤠😈👻💀👽🤖💩🙈🙉🙊💋💌💘💝💖💗💓💞💕💔❤🧡💛💚💙💜🤍🖤💯💢💥💫💦💨🕳💬👋🤚✋👌✌🤞🤟🤘🤙👈👉👆👇👍👎✊👊👏🙌👐🤲🙏💪🌹🌸🌙⭐🔥🎉🎁☕🍰🍓'];

/* ---------- 回复协议：一行一条消息「名字: 内容」，功能用方括号标签（比 JSON 短、生成更快、不怕格式错） ---------- */
const TAGS = '表情包|语音|图片|转账|收款|表情回应|引用|撤回|拍一拍|翻译|音乐|补译|红包|领红包';
export function parseReply(raw, ch) {
  raw = String(raw ?? '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/【/g, '[').replace(/】/g, ']').replace(/\[(表情|贴纸|sticker)(?=[:：])/gi, '[表情包'); // 模型偶尔写成 [表情:xx]
  if (/^\s*[[{]/.test(raw) && /"(msgs|from)"/.test(raw)) { const d = json(raw), a = d?.msgs || (Array.isArray(d) && d); if (a) return a; } // 兼容模型仍输出 JSON
  const ppl = ch.type == 'g' ? ch.members.map(get).filter(Boolean) : [ch], out = []; let last = ch.type == 'g' ? '' : rn(ch);
  for (let l of raw.split('\n')) {
    l = l.trim().replace(/^[-*•>]\s*/, ''); if (!l || l.startsWith('```')) continue;
    const mm = l.match(/^([^\s:：[\]]{1,20})\s*[:：]\s*(.*)$/);
    if (mm && (isMe(mm[1]) || ppl.some(c => [c.real, c.nick, c.remark].includes(mm[1])))) { last = mm[1]; l = mm[2]; }
    const from = ch.type == 'p' ? '' : last || rn(ppl[0]); if (ch.type == 'g' ? isMe(from) : isMe(mm?.[1])) continue; // 不让 AI 替用户说话
    const tg = {}, grab = re => (l = l.replace(re, (_, k, v = '') => (tg[k] = v.trim(), '')).trim());
    grab(/\[(翻译)[:：]([^[\]]*)\]/g); grab(new RegExp(`\\[(${TAGS})(?:[:：]([^\\]]*))?\\]`, 'g')); // 先取出译文（可能嵌在语音标签里）
    const b = { from, tr: tg.翻译 && tg.翻译 != l ? tg.翻译 : '' };
    if ('表情回应' in tg) { const [e, frag] = tg.表情回应.split('|'); out.push({ ...b, type: 'react', text: e.trim(), frag: frag?.trim() }); }
    if ('撤回' in tg) out.push({ ...b, type: 'recall' });
    if ('收款' in tg) out.push({ ...b, type: 'accept' });
    if ('拍一拍' in tg) out.push({ ...b, type: 'pat', text: tg.拍一拍, tr: '' });
    if ('表情包' in tg) out.push({ ...b, type: 'sticker', text: tg.表情包 || l.replace(/^[（(]|[)）]$/g, ''), tr: '' }), tg.表情包 || (l = '');
    if ('图片' in tg) out.push({ ...b, type: 'img', text: tg.图片 || l, tr: '' }), tg.图片 || (l = '');
    if ('语音' in tg) out.push({ ...b, type: 'voice', text: tg.语音 || l }), tg.语音 || (l = '');
    if ('音乐' in tg) { const [n, a = ''] = (tg.音乐 || l.replace(/^[（(]|[)）]$/g, '')).split(/\s*[|，,]\s*/); n && out.push({ ...b, type: 'minv', text: n.replace(/^[《「“"']+|[》」”"']+$/g, '').trim(), artist: a.trim(), tr: '' }); tg.音乐 || (l = ''); } // 角色邀请一起听
    if ('转账' in tg) { const [a, n] = tg.转账.split('|'); out.push({ ...b, type: 'transfer', amount: parseFloat(a) || 0, text: n || '', tr: '' }); }
    if ('红包' in tg) { const [a, n] = tg.红包.split('|'); out.push({ ...b, type: 'hb', amount: Math.min(200, parseFloat(a) || 0), text: n || '', tr: '' }); }
    if ('领红包' in tg) out.push({ ...b, type: 'hbopen' });
    if ('补译' in tg) { const [k, f, z] = tg.补译.split('|'); f?.trim() && out.push({ type: 'bt', k: parseInt(String(k).replace(/\D/g, '')), text: f.trim(), tr: (z || '').trim() }); continue; }
    if (/^[\s[\]()（）「」]*$/.test(l)) { l = ''; b.tr && !Object.keys(tg).some(k => k != '翻译') && out.at(-1) && !out.at(-1).tr && /text|voice/.test(out.at(-1).type) && (out.at(-1).tr = b.tr); } // 标签拆完只剩个「]」之类的碎片：丢掉；单独一行的 [翻译] 补给上一条
    l && out.push({ ...b, type: 'text', text: l, quote: tg.引用 });
  }
  return out;
}
function replyP(ch, patNow) {
  const g = ch.type == 'g', me = meObj().nick, sk = [...new Set([...S.assets.sticker.map(s => s.name), ...S.stk.mine.flatMap(p => p.items.map(x => x.l))].filter(Boolean))].slice(0, 60).join('、'), lang = ch.cfg.lang;
  const hist = ch.msgs.slice(-30).map(m => `${m.f == 'me' ? me : m.f == 'sys' ? '[系统]' : rn(get(m.f))}: ${m.t == 'pat' || m.t == 'sys' ? `（${m.c}）` : say(m)}${m.q ? `（引用了：${m.q.c}）` : ''}${m.t == 'hb' ? `（${m.f == 'me' ? (m.st ? '已被领取' : '还没人领') : m.st ? `${me}已领取` : `${me}还没领`}）` : ''}${m.t == 'transfer' && m.st ? `（${m.st}）` : ''}`).join('\n');
  const tl = (g ? ch.members : [ch.id]).map(i => [get(i), langFor(ch, i)]).filter(([c, l]) => c && l).map(([c, l]) => `${rn(c)}用${lname(l)}`), cf = ch.cfg;
  const rn0 = Math.max(1, +cf.rmin || 1), rn1 = Math.max(rn0, +cf.rmax || 5), vn0 = Math.max(0, +cf.vmin || 0), vn1 = Math.max(vn0, cf.vmax == null ? 1 : +cf.vmax);
  const ls = mzB.getMusicListening(ch.id), snap = ls && G.mzSnapshot?.(), mt2 = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  const lsP = ls ? ['【一起听歌】', g ? `${me}在群里发起了一起听歌，群成员现在可以一起听。` : `${me}和${rn(ch)}正在一起听歌。`, `正在放：《${snap?.songName || ls.songName}》 - ${snap?.artist || ls.artist}${snap ? `，放到 ${mt2(snap.currentTime || 0)}${snap.duration ? ' / ' + mt2(snap.duration) : ''}` : ''}`,
    snap?.lyric ? `现在唱到：${snap.lyric}${snap.lyricTranslation ? `（${snap.lyricTranslation}）` : ''}` : '', snap?.lyricWindow?.length ? `接下来的歌词：${snap.lyricWindow.slice(0, 6).join(' / ')}` : '',
    snap?.favoriteSongs?.length ? `${me}红心歌单里的歌：${snap.favoriteSongs.slice(0, 12).join('；')}` : '', '回复时要知道你们正在一起听这首歌，可以自然地聊到歌、歌手、歌词或者放到哪了，别复述这段说明。'].filter(Boolean).join('\n') + '\n' : '';
  return `${lsP}【当前聊天】${g ? `群聊「${ch.name}」 群主:${ch.owner ? rn(get(ch.owner)) : me} 管理员:${ch.admins.map(i => rn(get(i))).join('、') || '无'}\n成员：${ch.members.map(i => { const c = get(i); return `${rn(c)}(网名${c.nick}${ch.titles[i] ? '，头衔' + ch.titles[i] : ''})`; }).join('、')}${ch.notice ? '\n群公告：' + ch.notice : ''}` : `与${rn(ch)}（网名${ch.nick}）的私聊`}
【聊天记录】\n${hist || '（空）'}

请继续这段手机聊天${g ? '，让群成员按各自人设自然互动、互相接话' : `，你扮演${rn(ch)}回复${me}`}。像真人发消息：口语、短句，这一轮一共 ${rn0 == rn1 ? rn0 : `${rn0}-${rn1}`} 条（文字、图片、语音、表情各算一条）${vn1 ? `，其中语音 ${vn0 == vn1 ? vn0 : `${vn0}-${vn1}`} 条` : '，不发语音'}，符合人设与当前剧情。
【输出格式】每条消息单独一行：${g ? '「真实姓名: 内容」' : '直接写内容'}。不要写${me}的话，不要任何解释。按人设此刻会“已读不回”就什么都不输出。
【可用标签】（单独一行，前面同样写名字）
[表情包:关键词] 发表情包${S.stk.auto ? '，关键词写 2~6 个字，像在微信里搜表情那样（如：摸摸头、无语、开心到转圈、晚安）' : ''}${sk ? `（优先用：${sk}）` : ''}
[语音:要说的话]　[图片:画面描述]　[转账:金额|备注]　[收款]（收下${me}的转账）　[红包:金额|祝福语]（单个最多200）　[领红包]（领${me}发的红包）
${sty(ch) == 'wx' ? '' : `[表情回应:emoji] 给${me}刚才的消息贴表情，表情要符合此刻的真实态度；也可 [表情回应:emoji|消息片段] 指定哪条\n`}[引用:消息片段] 正文　引用某条消息来回复
[音乐:歌名|歌手] 想邀请${me}一起听一首歌时发（歌要真实存在，单独一行，不要每轮都发）
[撤回] 撤回自己上一条（说漏嘴、发错时用）
${ch.cfg.pat ? `[拍一拍] 拍一拍${me}（就是微信的拍一拍，只会显示「谁拍了拍谁」，不用写动作${g ? '；群里想拍别的成员就写 [拍一拍:成员名]' : ''}）${patNow ? `\n本轮请${g ? '挑一位成员' : ''}用一次 [拍一拍]。` : '，剧情合适时再用。'}` : ''}
${tl.length ? `【语言】${tl.join('；')}：这些人的每一条文字和语音都直接用该语言写（一条都不能写成中文），每一条的同一行末尾都附 [翻译:简体中文译文]，不能有的有有的没有。译文要沉浸式、完全贴合说话人的人设与此刻语气（傲娇就傲娇、撒娇就撒娇），口语自然，只翻原意、不加戏不漏内容；其他人照常说中文。表情包等标签不翻译。` : ''}`;
}

/* ---------- 生成 ---------- */
// 发送键只有一个（输入框空着点：等回复时 = 停止，否则 = 让对方回）：发出消息后稍等 1.5 秒（期间还能接着发）对方开始回复；等回复时按钮变成 ■，点一下停止
let busy = 0, CTL = null; const PEND = new Map();
const goSync = () => { const t = top(); t?.chat && $('.go', t.el)?.classList.toggle('wait', busy == t.chat || PEND.has(t.chat)); };
export const later = (ch, ms = 1500) => { clearTimeout(PEND.get(ch.id)); PEND.set(ch.id, setTimeout(() => { PEND.delete(ch.id); busy ? (ch._again = 1) : gen(ch); }, ms)); goSync(); };
export const stopGen = ch => { clearTimeout(PEND.get(ch.id)); PEND.delete(ch.id); ch._again = 0; busy == ch.id && CTL?.abort(); goSync(); };
// 翻译：设了角色语言就让模型每条都写「外语 + [翻译:中文]」，一次生成里就带着，不另外调用任何接口。
//  开着「自动翻译」显示外语、下面一行中文；关着就直接显示中文。开关随时切换都是现成的，不用等。
//  以前只有中文（或模型漏写译文）的消息：下一轮回复时顺便让模型补上另一半（[补译]），也不额外调用
const SCR = { ko: /[가-힯]/, ja: /[぀-ヿ]/, ru: /[Ѐ-ӿ]/, th: /[฀-๿]/ }, LAT = /^(en|fr|de|es|vi)$/;
const inLang = (t, l) => SCR[l] ? SCR[l].test(t) : LAT.test(l) ? /[A-Za-z]/.test(t) && !/[一-鿿]/.test(t) : true;
const need = (ch, m) => { const l = langFor(ch, m.f); return l && l != 'zh-TW' && /text|voice/.test(m.t) && m.f != 'me' && !m.orig && !m.tp && /[\p{L}]/u.test(m.c || '') && !(m.tr && inLang(m.c, l)) && l; };
// 没跟回复一起带上译文的（模型漏写），或者后来改了语言：用免费机翻马上补 / 换（不调用聊天模型）
export async function retrans(ch) {
  for (const m of ch.msgs.filter(m => need(ch, m))) {
    const l = need(ch, m); if (!l) continue; m.tp = 1; emit('chat');
    try { const zh = m.tr || (/[一-鿿]/.test(m.c) && !inLang(m.c, l) ? m.c : await mt(m.c, 'zh-CN')), f = await mt(zh, l); f && f != zh && Object.assign(m, { c: f, tr: zh }); } catch { }
    m.tp = 0; saveD(); emit('chat');
  }
}
const zhOnly = (m, ch) => ch.cfg.trAuto === false && m.tr && m.f != 'me' && !m.orig; // 关着自动翻译：直接说中文
const said = (m, ch) => zhOnly(m, ch) ? m.tr : m.c;
export async function gen(ch) {
  clearTimeout(PEND.get(ch.id)); PEND.delete(ch.id);
  if (busy) { busy == ch.id ? (ch._again = 1) : toast('上一轮回复还在生成中…'); return; }
  busy = ch.id; const ac = CTL = new AbortController(); ch.msgs.forEach(m => m.f == 'me' && (m.rd = 1)); saveD(); emit('chat'); goSync();
  try {
    // 识图：我上次被回复之后发的表情包（最多 3 个），图片跟这次回复请求一起发过去，让对方看图理解（不额外调用）
    const lastR = ch.msgs.findLastIndex(m => m.f != 'me' && !/sys|pat/.test(m.t)), see = S.stk.see !== false ? ch.msgs.slice(lastR + 1).filter(m => m.f == 'me' && m.t == 'sticker' && m.img).slice(-3) : [];
    const P = replyP(ch, ch.cfg.pat && Math.random() < .3) + (see.length ? `\n\n【表情包图片】附上了${meObj().nick}刚发的 ${see.length} 个表情包的图片，按顺序对应上面最后 ${see.length} 个「[表情包：…]」。先看图弄懂${meObj().nick}想表达的情绪和意思，再自然地回应。` : '');
    const ms = parseReply(await llm(await sysCtx(), P, '聊天回复', ac.signal, { images: see.map(m => m.img) }), ch);
    for (const m of ms.filter(m => m.type != 'bt')) { if (ac.signal.aborted) break; const x = addMsg(ch, m); saveD(); emit('chat'); x && !viewing(ch.id) && notify(ch, x); x && await sleep(450 + Math.min(1600, String(m.text || '').length * 60)); }
  } catch (e) { ac.signal.aborted ? toast('已停止回复') : fail(`${nm(ch)} · 回复失败：${e.message}`); }
  finally { busy = 0; CTL = null; emit('chat'); goSync(); retrans(ch); if (ch._again && !ac.signal.aborted) { ch._again = 0; later(ch, 600); } } // 等回复期间又发了消息：接着再回
}
const push = (ch, m) => {
  const x = { f: 'me', t: 'text', c: '', ts: +now(), ...m }; ch.msgs.push(x); saveD(); emit('chat'); // 不自动回复：想发几条发几条，发完点右下角 ✦ 让对方回
  if (ch.cfg.trMine && myLang(ch) && /text|voice/.test(x.t)) { x.tp = 1; mt(x.c, myLang(ch)).then(t => { t != x.c && (x.orig = x.c, x.c = t); }).catch(() => { }).finally(() => { x.tp = 0; saveD(); emit('chat'); }); }
  return x;
};
on('stk', () => { const el = ui.stack?.querySelector('.pg.chat'), o = el?._pg; o?.pan && (o.pkC && Object.keys(o.pkC).forEach(k => k.startsWith('c_') && delete o.pkC[k]), $('.pan.on', el) && o.pan('stk', 1)); }); // 表情包组增删后刷新聊天里的表情面板
on('chat', () => { const t = top(); if (!t?.live) return; t.chat ? (t.reb(), $('.pg-t', t.el).innerHTML = t.title(), goSync()) : t.re(); });

/* ---------- 渲染 ---------- */
export const tT = ts => { const d = new Date(ts); return (d.toDateString() == now().toDateString() ? '' : `${d.getMonth() + 1}月${d.getDate()}日 `) + hm(d); };
const avH = (c, ch, id) => { const fr = S.assets.frame.find(a => a.id == ch.cfg.frame)?.img; return `<div class="avw" data-a="avc" data-x="${id}"><img class="av" src="${esc(avOf(c))}">${fr ? `<img class="frm" src="${esc(fr)}">` : ''}</div>`; };
// 表情包消息没有图（AI 发的、库里没有）：先在免费表情库里找，找不到再上网搜一张补上；每条只找一次
const stkTry = new WeakSet(), stkDone = new WeakSet(), stkFill = m => { if (m.sk || stkTry.has(m) || !S.stk.auto || !m.c) return; stkTry.add(m); stkFind(m.c).then(r => { stkDone.add(m); r ? Object.assign(m, { img: r.img, alt: r.alt, sz: r.sz }) : r === '' && (m.sk = 1); saveD(); emit('chat'); }); };
// 表情包图找不到 / 加载失败：像普通文字消息一样显示「[关键词]」，不再单独占一大块
const stk0 = (m, ld) => `<div class="stk0 ${ld ? 'ld' : ''}">[${esc(m.c)}]</div>`;
// 翻译：正文后面一个小「文」字按钮，点开在下面多一行译文 / 原文（两边样式一样，最多两行内容；不重画整个聊天，不会跳到最下面）
const fold = (i, txt, lab, open) => `<b class="tzb ${open ? 'on' : ''}" data-a="tz" data-x="${i}" title="${lab}">文</b><p class="tzp" ${open ? '' : 'hidden'}>${esc(txt)}</p>`;
// 音乐：分享卡片（白底，歌词摘录 + 歌曲行）/ 一起听卡片（封面铺底、唱片、两个人的头像）。会话数据在 apps/music/music-share.js
const MZC = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd3d6"/><stop offset="1" stop-color="#f05a64"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><path d="M74 34v38a10 10 0 1 1-5-8.7V44l-22 5v28a10 10 0 1 1-5-8.7V40z" fill="#fff" fill-opacity=".92"/></svg>')}`;
const mzImg = (u, c = '') => `<img class="${c}" src="${esc(u || MZC)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${MZC}'">`;
const mzSong = (m, i) => { const s = m.song || {}, ex = (m.ex || []).slice(0, 4);
  return `<div class="mzs" data-a="mzsong" data-x="${i}">${ex.length ? `<blockquote>${ex.map(l => esc(l.txt)).join('<br>')}</blockquote>` : ''}${m.note ? `<p class="mzs-n">${esc(m.note)}</p>` : ''}<div class="mzs-r">${mzImg(s.pic)}<div><b>${esc(s.name || '未知歌曲')}</b><small>${esc(s.artist || '')}</small></div><i><svg viewBox="0 0 24 24"><path d="M9 7v10l8-5z" fill="#fff"/></svg></i></div><div class="mzs-f"><i></i>${ex.length ? '歌词摘录' : '音乐分享'}</div></div>`; };
function mzCard(m, i, ch) {
  const s = m.song || {}, ses = mzB.getMusicListening(ch.id), own = !!ses && (m.id ? ses.sourceMessageId == m.id : ses.songName == s.name);
  const st = m.t == 'listen' ? (own && m.st != 'ended' ? 'on' : 'end') : m.st == 'accepted' && own ? 'on' : !m.st || m.st == 'pending' ? 'inv' : 'end';
  const other = m.t == 'minv' ? get(m.f) : ch, me = meObj(), on = st == 'on';
  const who = esc(m.t == 'minv' ? nm(other) : ch.type == 'g' ? ch.name : nm(ch));
  const btn = on ? `<b class="mzc-b" data-a="mzend" data-x="${i}">取消听歌</b>` : st == 'inv' ? `<span class="mzc-bs"><b class="mzc-b" data-a="mzrej" data-x="${i}">拒绝</b><b class="mzc-b ok" data-a="mzacc" data-x="${i}">接受</b></span>` : `<em class="mzc-e">${m.st == 'rejected' ? '已拒绝' : '已结束'}</em>`;
  return `<div class="mzc ${st}" ${on ? `data-a="mzopen" data-x="${i}"` : ''}><i class="mzc-bg" style="background-image:url('${esc(s.pic || MZC)}')"></i><div class="mzc-t"><div class="mzc-v"><i></i>${mzImg(s.pic)}</div><div class="mzc-i"><small>${on ? '<i class="mzc-dot"></i>正在共听' : st == 'inv' ? '邀请你一起听歌' : '共听已结束'}</small><b>${esc(s.name || '未知歌曲')}</b><span>${esc(s.artist || '')}</span></div></div>
    <div class="mzc-f"><span class="mzc-u">${st == 'inv' ? '' : `<img src="${esc(avOf(me))}">`}<img src="${esc(avOf(other))}"><em>${st == 'inv' ? `来自 ${who}` : `你和 ${who}`}</em></span>${btn}</div></div>`;
}
function body(m, i, cf, ch) {
  const tzo = !!cf.trOpen != !!m.tz; // m.tz 记录这条是否被手动翻转过
  switch (m.t) {
    case 'sticker': (m.img || stkFill(m)); return m.img ? imgH({ img: m.img, alt: m.alt ? m.alt.split('|') : [] }, 'stk' + (m.sz == 's' ? ' sm' : '')) + stk0(m) : stk0(m, stkTry.has(m) && !stkDone.has(m));
    case 'rec': return `<div class="rec" data-a="recv" data-x="${i}"><b>${esc(m.c)}</b>${(m.rec || []).slice(0, 4).map(r => `<p>${esc(r.n)}: ${esc(r.c)}</p>`).join('')}<small>聊天记录</small></div>`;
    case 'song': return mzSong(m, i);
    case 'listen': case 'minv': return mzCard(m, i, ch);
    case 'img': return m.url ? `<img class="pic" src="${esc(m.url)}">` : `<div class="picd">🖼 ${esc(m.c)}</div>`;
    case 'voice': return `<div class="vc" data-a="play" data-x="${i}">${I.wave}${Math.max(1, Math.ceil(said(m, ch).length / 4))}″</div>${m.open ? `<div class="vt">${esc(said(m, ch))}</div>` : ''}${m.tr && m.open && !zhOnly(m, ch) ? fold(i, m.tr, '翻译', tzo) : ''}`;
    case 'hb': return `<div class="tf hbk ${m.st ? 'done' : ''}" data-a="hbo" data-x="${i}"><b>${esc(m.c || '恭喜发财，大吉大利')}</b><small>${m.st ? (m.f == 'me' ? '已被领取' : '已领取') : ''}</small><i>红包</i></div>`;
    case 'transfer': return `<div class="tf ${m.st ? 'done' : ''}" data-a="tf" data-x="${i}"><b>¥${(+m.amt).toFixed(2)}</b><small>${esc(m.st || m.c || (m.f == 'me' ? '待对方收款' : '请收款'))}</small><i>转账</i></div>`;
    default: return zhOnly(m, ch) ? esc(m.tr).replace(/\n/g, '<br>') : esc(m.c).replace(/\n/g, '<br>') + (m.tp ? '<small class="tp">翻译中…</small>' : '') + (m.orig ? fold(i, m.orig, '原文', tzo) : m.tr ? fold(i, m.tr, '翻译', tzo) : '');
  }
}
const rxH = (m, i) => { const g = {}; nre(m.re).forEach(r => (g[r.e] ||= []).push(r.by)); return Object.keys(g).length ? `<div class="rx">${Object.entries(g).map(([e, bs]) => `<span class="rp ${bs.includes('me') ? 'mine' : ''}" data-a="rpx" data-x="${i}|${e}">${e}<small>${esc(bs.map(b => b == 'me' ? '我' : nm(get(b))).slice(0, 2).join('、'))}${bs.length > 2 ? `等${bs.length}人` : ''}</small></span>`).join('')}</div>` : ''; };
// 已读回执：微信/QQ 文字，Kakao 未读显示黄色数字，LINE 显示 Read
const rd = (m, ch) => { const st = sty(ch), g = ch.type == 'g', n = g ? ch.members.length : 1; if (st == 'wx') return ''; return m.rd ? (st == 'kk' ? '' : `<em class="rd">${st == 'line' ? (g ? 'Read ' + n : 'Read') : g ? n + '人已读' : '已读'}</em>`) : `<em class="rd un">${st == 'kk' ? n : st == 'line' ? '' : '未读'}</em>`; };
// 旧版存的拍一拍统一显示成「“X” 拍了拍你」/「你拍了拍 “X”」，后缀只用「我」里设置的
const patShow = c => { const ps = (D().me.ps || '').trim(); c = String(c);
  if (/^(“我”\s*|我)拍了拍/.test(c)) return c.replace(/^(“我”\s*|我)拍了拍/, '你拍了拍');
  if (/拍了拍(我|你)/.test(c)) return c.replace(/拍了拍(我|你).*$/, '拍了拍你' + ps);
  return /拍了拍/.test(c) ? c : c.replace(/^(“[^”]*”).*$/, `$1 拍了拍你${ps}`); };
function msgs(ch, sel) {
  let p, o = ''; const cf = ch.cfg, g = ch.type == 'g', me = meObj(), bub = S.assets.bubble.find(a => a.id == cf.bub);
  ch.msgs.forEach((m, i) => {
    const gap = !p || m.ts - p.ts > 3e5; gap && (o += `<div class="tm">${tT(m.ts)}</div>`);
    if (m.t == 'pat' || m.t == 'sys') o += `<div class="sys ${m.t} ${sel?.has(i) ? 'on' : ''}" ${sel ? 'data-a="msel"' : 'data-lp="slp"'} data-x="${i}">${sel ? '<i class="mck"></i>' : ''}${esc(m.t == 'pat' ? patShow(m.c) : m.c)}${m.old != null && m.f == 'me' ? ` <b data-a="redit" data-x="${i}">重新编辑</b>` : ''}</div>`;
    else {
      const mine = m.f == 'me', c = mine ? me : get(m.f) || { nick: '已删除' }, same = !gap && p?.f == m.f && !/sys|pat/.test(p.t);
      const tag = g && !mine ? (ch.owner == m.f ? '<em class="own">群主</em>' : ch.admins.includes(m.f) ? '<em class="adm">管理员</em>' : '') + (ch.titles[m.f] ? `<em>${esc(ch.titles[m.f])}</em>` : '') : '';
      o += `<div class="msg ${mine ? 'me' : ''} ${same ? 'same' : ''} ${sel?.has(i) ? 'on' : ''}" ${sel ? 'data-a="msel"' : 'data-lp="mlp"'} data-x="${i}">${sel ? '<i class="mck"></i>' : ''}${avH(c, ch, m.f)}<div class="mc">${!mine && !(same && cf.cont) ? `<div class="mn">${tag}${esc(nm(c))}</div>` : ''}<div class="mr"><div class="bub b-${m.t}">${body(m, i, cf, ch)}</div><span class="mt">${m.inj ? '<i class="ij">↪</i>' : ''}${mine && cf.read ? rd(m, ch) : ''}<time>${hm(new Date(m.ts))}</time></span></div>${m.q ? `<div class="qt">${esc(m.q.w)}：${esc(m.q.c)}</div>` : ''}${sty(ch) == 'wx' ? '' : rxH(m, i)}</div></div>`;
    }
    p = m;
  });
  busy == ch.id && !(sty(ch) == 'wx' && !g) && (o += `<div class="msg typing">${g ? `<div class="avw"><img class="av" src="${defAv('…')}"></div>` : avH(ch, ch, ch.id)}<div class="mc"><div class="bub"><i></i><i></i><i></i></div></div></div>`);
  return `${bub ? `<style>${bub.css}</style>` : ''}<div class="cv ${sel ? 'msel' : ''}">${o || '<div class="sys">还没有消息，打个招呼吧 ✧</div>'}</div>`;
}

/* ---------- 聊天窗口 ---------- */
let avL, avT;
export function openChat(id) {
  const ch = get(id); if (!ch) return; if (top()?.cls != 'chatapp') { home(); APPS.chat.open(); } ch.unread = 0; saveD();
  const cf = ch.cfg, cls = () => `chat st-${sty(ch)} ${ch.type == 'g' ? 'grp' : ''} ${cf.dark ? 'dark' : ''} sh-${cf.shape || 'def'} av-${cf.avs || 'def'} ${cf.showAv ? '' : 'noav'} ${cf.cont ? 'cont' : ''}`;
  let ptab = null, q = null; const pkC = {};
  let sel = null; // 多选时是选中消息下标的 Set
  const selable = () => ch.msgs.map((m, k) => k);
  const rer = () => { const b = $('.pg-b', pg.el), sc = b?.scrollTop; pg.re(); const b2 = $('.pg-b', pg.el); b2 && sc != null && (b2.scrollTop = sc); }; // 重画整页但不跳位置
  const selUp = () => { pg.el.querySelectorAll('.cv [data-x].msg, .cv [data-x].sys').forEach(e => e.classList.toggle('on', sel.has(+e.dataset.x))); $('.pg-t', pg.el).innerHTML = pg.title(); $('.pg-r', pg.el).innerHTML = pg.right(); pg.el.querySelectorAll('.mbar2 button').forEach(b => b.classList.toggle('dis', !sel.size)); };
  // 转发：选聊天 → 逐条（一条条照原样发过去）/ 合并（一张「聊天记录」卡片，名字只写网名）
  const fwd = async (L, how) => {
    L = L.filter(m => !/sys|pat/.test(m.t)); if (!L.length) return;
    const to = await menu(D().chats.filter(c => c.type == 'g' || c.fr !== 0).sort((a, b) => (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0)).map(c => [c.id, esc(nm(c)) + (c.id == ch.id ? '（当前聊天）' : '')]), how == 'all' ? '合并转发到…' : '转发到…'); if (!to) return;
    const T = get(to), net = f => f == 'me' ? meObj().nick : get(f)?.nick || get(f)?.real || '?';
    if (how == 'all') {
      const title = ch.type == 'g' ? '群聊的聊天记录' : `${meObj().nick}和${ch.nick || ch.real}的聊天记录`;
      T.msgs.push({ f: 'me', t: 'rec', c: title, rec: L.map(m => ({ n: net(m.f), c: brief(m).slice(0, 200), ...(m.t == 'sticker' && { img: m.img }) })), ts: +now() });
    } else L.forEach(m => T.msgs.push({ f: 'me', t: m.t == 'transfer' ? 'text' : m.t, c: m.t == 'transfer' ? brief(m) : m.c, ...(m.img && { img: m.img }), ...(m.url && { url: m.url }), ...(m.d && { d: m.d }), ...(m.alt && { alt: m.alt }), ...(m.sz && { sz: m.sz }), ts: +now() }));
    saveD(); emit('chat'); toast(`已转发给 ${nm(T)}`); return 1;
  };
  // 表情面板（仿微信）：上面一排图标：搜索、Emoji、我的表情、添加的表情包组、＋表情商店；下面是这一组的表情（带名字）
  const SRCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
  const pbar = () => { stkMig(); ptab ??= S.stk.packs[0] || 'fav'; S.stk.packs.some(id => !coverNow(id)) && warm(); if (!['emo', 'fav', ...S.stk.packs].includes(ptab)) ptab = 'fav'; const it = (x, h, t = '', lp = '') => `<b data-a="ptab" data-x="${x}" ${lp && `data-lp="${lp}"`} class="pi ${ptab == x ? 'on' : ''}" title="${t}">${h}</b>`; return `<div class="pbar"><b class="pi" data-a="stks" title="搜索表情">${SRCH}</b>${it('emo', '<i>😀</i>', 'Emoji')}${it('fav', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>', '我的表情')}${S.stk.packs.map(id => it(id, coverNow(id) ? imgH(coverNow(id)) : `<i>${esc((packMeta(id)?.name || '?')[0])}</i>`, packMeta(id)?.name, 'plp')).join('')}<b class="pi add" data-a="pstore" title="表情商店">＋</b></div>`; };
  const pgrid = () => {
    if (ptab == 'emo') return `<div class="pgrid emo">${EMOJI.map(e => `<i data-a="emo" data-x="${e}">${e}</i>`).join('')}</div>`;
    if (ptab == 'fav') return `<div class="ph"><b>我的表情</b><span data-a="pmine">管理 ›</span></div><div class="pgrid">${S.assets.sticker.map((s, i) => `<div class="sk" data-a="sk" data-lp="flp" data-x="${i}"><img src="${esc(s.img)}" loading="lazy" referrerpolicy="no-referrer"><small>${esc(s.name)}</small></div>`).join('')}<div class="sk add" data-a="skadd">＋<small>添加</small></div></div>`;
    const pk = pkC[ptab], m = packMeta(ptab);
    if (!pk) { const id = ptab; pack(id).then(p => { pkC[id] = p || { items: [] }; ptab == id && $('.pan.on', pg.el) && pan('stk', 1); }, () => { pkC[id] = { items: [] }; }); return `<div class="ph"><b>${esc(m?.name || '')}</b></div><div class="sks-st sm"><i class="spin"></i></div>`; }
    return `<div class="ph"><b>${esc(m?.name || '')}</b><span data-a="pinfo" data-x="${ptab}">详情 ›</span></div>${pk.items.length ? `<div class="pgrid ${pk.sm ? 'sm' : ''}">${pk.items.map((x, i) => `<div class="sk" data-a="psk" data-lp="pklp" data-x="${i}">${imgH(x)}${x.l ? `<small>${esc(x.l)}</small>` : ''}</div>`).join('')}</div>` : '<div class="sks-st sm">表情库暂时连不上，稍后再试</div>'}`;
  };
  // 微信底栏的三个圆圈图标：左边「让对方回」用语音键那个声波圈，右边笑脸、加号
  const wsv = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const WXB = { wave: '<svg class="s-wv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10.25"/><path d="m8 12 1.7-1.5v3z" fill="currentColor" stroke-linejoin="round"/><path d="M11.6 9.3a3.8 3.8 0 0 1 0 5.4M14.1 7.1a7 7 0 0 1 0 9.8"/></svg>',
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="12" cy="12" r="10.25"/><circle cx="8.7" cy="9.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.3" cy="9.4" r="1.15" fill="currentColor" stroke="none"/><path d="M7.4 12.9h9.2a4.6 4.6 0 0 1-9.2 0Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10.25"/><path d="M12 7v10M7 12h10"/></svg>' };
  const WXI = { ptf: wsv('<path d="M5 9.5h13l-4-4M19 14.5H6l4 4"/>'), phb: wsv('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 8.5c2.2 2 4.5 3 7 3s4.8-1 7-3"/><circle cx="12" cy="11.5" r="2" fill="currentColor"/>') };
  const panHtml = k => k == 'stk' ? pbar() + `<div class="pbody">${pgrid()}</div>`
    : `<div class="pgrid tools">${[['ptf', '转账', '¥'], ['phb', '红包', '🧧']].map(([a, l, i]) => `<div class="tl" data-a="${a}"><i>${sty(ch) == 'wx' ? WXI[a] : i}</i>${l}</div>`).join('')}</div>`;
  // 微信风格的“更多”面板用线条图标（白底方块里一个黑色小图标），跟原生一致
  const pan = (k, keep) => { const p = $('.pan', pg.el), on = keep || p.dataset.k != k || !p.classList.contains('on'); p.dataset.k = k; p.classList.toggle('on', on); const sc = $('.pbar', p)?.scrollLeft; p.innerHTML = panHtml(k); sc && ($('.pbar', p).scrollLeft = sc); };
  const qbar = () => { const b = $('.qbar', pg.el), m = q != null && ch.msgs[q]; b.innerHTML = m ? `<span>${esc(who(ch, m.f))}：${esc(brief(m)).slice(0, 40)}</span><b data-a="qx">×</b>` : ''; b.classList.toggle('on', !!m); };
  const pat = t => { push(ch, { t: 'pat', c: t == 'me' ? `你拍了拍自己${D().me.ps || ''}` : `你拍了拍 “${nm(get(t))}”${get(t).ps || ''}` }); shake(); };
  const tool = async f => { $('.pan', pg.el).classList.remove('on'); await f(); };
  const pg = page({
    chat: id, live: 1, model: () => ch, cls: cls(), pan: (k, keep) => pan(k, keep), pkC, onClose: () => setTimeout(() => emit('chat')),
    title: () => sel ? `<b class="txt msel-x" data-a="selx">取消</b><b>已选择 ${sel.size} 条消息</b>` : busy == id && sty(ch) == 'wx' && ch.type == 'p' ? '<b>对方正在输入...</b>' : `<b>${esc(nm(ch))}${ch.type == 'g' ? ` (${gsz(ch)})` : ''}${mzB.getMusicListening(ch.id) ? '<i class="mzl" title="正在一起听歌" data-a="mzopen"><i></i><i></i><i></i></i>' : ''}</b>${busy == id ? `<small class="typ">${ch.type == 'g' ? '群成员' : '对方'}正在输入<i>.</i><i>.</i><i>.</i></small>` : ''}`,
    right: () => sel ? `<b class="txt" data-a="selall">${sel.size && sel.size >= selable().length ? '全不选' : '全选'}</b>` : `<b data-a="cset">${I.more}</b>`, body: () => msgs(ch, sel),
    foot: () => sel ? `<div class="selto" data-a="selto">↑ 选择到这里</div><nav class="mbar2">${[['sfwd', '转发', MI.fwd], ...(ch.cfg.inj ? [] : [['sinj', '注入正文', MI.inj]]), ['sdel', '删除', MI.del]].map(([a, l, ic]) => `<button data-a="${a}" class="${sel.size ? '' : 'dis'}">${ic}<span>${l}</span></button>`).join('')}</nav>` : `<div class="qbar"></div><div class="ib"><button data-a="pan" data-x="stk">${sty(ch) == 'wx' ? WXB.smile : I.smile}</button><textarea class="ip" rows="1" placeholder="${{ kk: 'Enter a message', line: 'Aa' }[sty(ch)] || '发消息…'}"></textarea><button data-a="pan" data-x="more">${sty(ch) == 'wx' ? WXB.plus : I.plus}</button><button class="go ${busy == id || PEND.has(id) ? 'wait' : ''}" data-a="send">${I.send.replace('<svg', '<svg class="s-send"')}<svg class="s-stop" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/></svg>${WXB.wave}<svg class="s-reply" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2.5c.6 4.6 3 7 7.6 7.6-4.6.6-7 3-7.6 7.6-.6-4.6-3-7-7.6-7.6 4.6-.6 7-3 7.6-7.6Z"/><path d="M18.5 14.5c.3 2.1 1.3 3.1 3.4 3.4-2.1.3-3.1 1.3-3.4 3.4-.3-2.1-1.3-3.1-3.4-3.4 2.1-.3 3.1-1.3 3.4-3.4Z"/></svg></button><button class="wsend" data-a="send">发送</button></div><div class="pan"></div>`,
    after: el => {
      const keep = el.classList.contains('in'); el.className = `pg ${cls()}${keep ? ' in' : ''}`;
      const b = $('.pg-b', el), ip = $('.ip', el), go = $('.go', el); b.style.background = cf.bg ? `url("${cf.bg}") center/cover` : '';
      // 只有来了新消息、本来就在最底下、或第一次打开时才滚到底；点翻译、表情回应这些不会跳
      const n = ch.msgs.length + (busy == id ? .5 : 0), stick = el._n == null || el._n != n || el._pg.nb || !b.scrollTop; el._n = n;
      if (stick) { b.scrollTop = b.scrollHeight; b.querySelectorAll('img').forEach(im => im.complete || im.addEventListener('load', () => b.scrollHeight - b.scrollTop - b.clientHeight < im.offsetHeight + 90 && (b.scrollTop = b.scrollHeight), { once: true })); }
      // 点聊天内容：收起表情 / 更多面板和键盘
      b.onpointerdown = () => { const pn = $('.pan.on', el); pn && pn.classList.remove('on'); document.activeElement == ip && ip.blur(); };
      if (!ip) return; // 多选时底下是操作栏，没有输入框
      ip.oninput = () => { const h = !!ip.value.trim(); go.classList.toggle('has', h); go.parentNode.classList.toggle('has', h); ip.style.height = 'auto'; ip.style.height = Math.min(100, ip.scrollHeight) + 'px'; };
      ip.onkeydown = e => e.key == 'Enter' && !e.shiftKey && !e.isComposing && (e.preventDefault(), pg.acts.send());
    },
    acts: {
      send: () => { const ip = $('.ip', pg.el), v = ip.value.trim(); if (!v) return busy == ch.id || PEND.has(ch.id) ? stopGen(ch) : gen(ch); const m = q != null && ch.msgs[q]; ip.value = ''; ip.oninput(); push(ch, { c: v, ...(m && { q: { w: who(ch, m.f), c: brief(m).slice(0, 40) } }) }); q = null; qbar(); },
      pan, cset: () => cset(ch), qx: () => { q = null; qbar(); },
      ptab: x => { ptab = x; pan('stk', 1); },
      psk: i => { const x = pkC[ptab]?.items[i]; x && push(ch, msgOf(x)); },
      pinfo: id => packPage(id, m => push(ch, m)), pmine: () => minePage(m => push(ch, m)),
      // 长按：表情包组图标 → 移到前面 / 移除；我的表情 → 移到前面 / 删除；组里的表情 → 存到我的表情
      plp: async id => { const k = await menu([['top', '移到前面'], ['rm', mine(id) ? '删除这一组' : '移除', 'danger']], packMeta(id)?.name); if (!k) return;
        if (k == 'top') { S.stk.packs = [id, ...S.stk.packs.filter(x => x != id)]; C().saveSettingsDebounced(); return pan('stk', 1); }
        if (mine(id) && !await ok(`删除「${packMeta(id).name}」？自己导入的表情会一起删掉`)) return; mine(id) ? rmMine(id) : rmPack(id); pan('stk', 1); },
      flp: async i => { const L = S.assets.sticker, k = await menu([['top', '移到前面'], ['del', '删除', 'danger']], L[i]?.name); if (!k) return; const [x] = L.splice(i, 1); k == 'top' ? L.unshift(x) : drop(x); C().saveSettingsDebounced(); pan('stk', 1); },
      pklp: async i => { const x = pkC[ptab]?.items[i], own = mine(ptab); if (!x) return; const k = await menu([['fav', '添加到「我的表情」'], ...(own ? [['top', '移到前面'], ['ren', '改名字'], ['del', '删除', 'danger']] : [])], x.d || x.l); if (!k) return;
        if (k == 'ren') return renItem(own.items[i], () => { delete pkC[ptab]; pan('stk', 1); });
        if (k == 'fav') { S.assets.sticker.unshift({ id: uid(), name: x.l || '表情', img: x.img }); C().saveSettingsDebounced(); return toast('已添加到「我的表情」'); }
        const [y] = own.items.splice(i, 1); k == 'top' ? own.items.unshift(y) : drop(y); C().saveSettingsDebounced(); delete pkC[ptab]; pan('stk', 1); },
      pstore: () => storePage(m => { push(ch, m); }),
      emo: e => { const ip = $('.ip', pg.el); ip.value += e; ip.oninput(); },
      stks: () => stkPage(m => push(ch, m)),
      sk: i => { const s = S.assets.sticker[i]; push(ch, { t: 'sticker', c: s.name, img: s.img }); },
      skadd: async () => { const r = await form('添加表情包', [['name', '描述（AI 按描述发送）'], ['img', '图片', 'img']]); if (!r?.img) return; S.assets.sticker.push({ id: uid(), name: r.name || '表情', img: r.img }); C().saveSettingsDebounced(); pan('stk', 1); },
      // 转账 / 发红包：整页（仿微信）；群里先选给谁
      ptf: () => tool(async () => { const to = ch.type == 'p' ? ch : get(await menu(ch.members.map(i => [i, esc(nm(get(i)))]), '转账给谁')); to && payPage(to, 'tf', r => { D().me.wallet -= r.amt; push(ch, { t: 'transfer', amt: r.amt, c: r.c, ...(ch.type == 'g' && { to: to.id }) }); }); }),
      phb: () => tool(async () => payPage(ch, 'hb', r => { D().me.wallet -= r.amt; push(ch, { t: 'hb', amt: r.amt, c: r.c || '恭喜发财，大吉大利' }); })),
      hbo: i => { const m = ch.msgs[i]; if (!m) return; if (m.f == 'me') return toast(m.st ? '红包已被领取' : '红包未被领取'); const from = get(m.f) || ch; if (m.st) return toast('你已领取过这个红包');
        hbOpen(m, from, () => { m.st = '已领取'; D().me.wallet = +D().me.wallet + m.amt; ch.msgs.push({ f: 'sys', t: 'sys', c: `你领取了${nm(from)}的红包`, ts: +now() }); saveD(); }); },
      avc: x => { clearTimeout(avT); if (avL == x) { avL = 0; return pat(x); } avL = x; avT = setTimeout(() => { avL = 0; x != 'sys' && openFeed(x); }, 280); },
      tz: (i, t) => { const m = ch.msgs[i]; m.tz = !m.tz; saveD(); const o = !!cf.trOpen != !!m.tz, p = t.nextElementSibling; t.classList.toggle('on', o); p && (p.hidden = !o); },
      rpx: x => { const [i, e] = x.split('|'), m = ch.msgs[i], r = nre(m.re), k = r.findIndex(y => y.e == e && y.by == 'me'); m.re = k > -1 ? r.filter((_, j) => j != k) : [...r, { e, by: 'me' }]; saveD(); emit('chat'); },
      redit: i => { const m = ch.msgs[i], ip = $('.ip', pg.el); ip.value = m.old; ip.oninput(); ip.focus(); },
      tf: async i => { const m = ch.msgs[i]; if (m.f == 'me' || m.st || !await ok(`收下 ¥${m.amt}？`)) return; m.st = '已收款'; D().me.wallet = +D().me.wallet + m.amt; saveD(); emit('chat'); },
      play: i => { const m = ch.msgs[i], c = m.f == 'me' ? meVoice() : get(m.f); m.open = 1; saveD(); emit('chat'); tts(said(m, ch), '', c?.sex, undefined, { c, app: ch.type == 'g' ? 'g' : 'p' }).catch(e => fail('语音失败：' + e.message)); },
      mlp: async (i, t) => {
        const m = ch.msgs[i]; if (!m || /sys|pat/.test(m.t)) return; const mine = m.f == 'me', stk = m.t == 'sticker', text = /text|voice/.test(m.t);
        const has = stk && S.assets.sticker.some(x => x.img == m.img);
        const k = await pop(t.closest('.msg')?.querySelector('.bub') || t, [
          ...(stk && !has ? [['add', '添加']] : []), ...(text ? [['copy', '复制']] : []), ['fwd', '转发'], ['q', '引用'],
          ...(m.t == 'text' ? [['edit', '编辑']] : []), ['multi', '多选'],
          ...(mine ? [['rc', '撤回']] : ch.msgs.slice(+i + 1).every(x => x.f != 'me') ? [['regen', '重新生成']] : []), /* 只有最新一轮回复能重新生成 */ ['del', '删除']], m.t != 'rec' && sty(ch) != 'wx'); if (!k) return; // 注入正文只在多选里（整个聊天开了注入就不用）；微信没有贴表情
        if (k[0] == '~') return pg.acts.rpx(i + '|' + k.slice(1)); // 表情回应
        if (k == 'q') { q = i; qbar(); return $('.ip', pg.el).focus(); }
        if (k == 'add') { S.assets.sticker.unshift({ id: uid(), name: m.c && m.c != '表情' ? m.c : '表情', img: m.img }); C().saveSettingsDebounced(); return toast('已添加到「我的表情」'); }
        if (k == 'fwd') return fwd([m], 'one');
        if (k == 'multi') { sel = new Set([+i]); return rer(); }
        if (k == 'edit') { // 改这条消息（有翻译的连译文一起改）
          const tw = m.orig ? 'orig' : m.tr ? 'tr' : '', r = await form('编辑消息', [['c', '内容', 'area'], ...(tw ? [['t', tw == 'orig' ? '原文' : '翻译', 'area']] : [])], { c: m.c, t: m[tw] || '' }); if (!r) return;
          m.c = r.c.trim() || m.c; tw && (m[tw] = r.t.trim()); saveD(); return emit('chat'); }
        if (k == 'tr') { // 对方的译文只随回复一起生成；只有我自己的消息可以机翻
          if (m.tr || m.orig) m.tz = !m.tz;
          else if (!mine) return toast('对方的翻译会随回复一起生成：在聊天设置里选好对方语言即可');
          else if (!ch.cfg.lang) return toast('先在聊天设置里选择对方说的语言');
          else { m.tp = 1; emit('chat'); try { const t = await mt(m.c, ch.cfg.lang); if (t != m.c) { m.orig = m.c; m.c = t; m.tz = !ch.cfg.trOpen; } else toast('这句不用翻译'); } catch (e) { toast('机翻暂时不可用，稍后再试'); } m.tp = 0; }
        }
        k == 'inj' && (m.inj = !m.inj); k == 'tts' && tts(m.c, get(m.f)?.voice, get(m.f)?.sex).catch(e => fail('朗读失败：' + e.message)); k == 'copy' && navigator.clipboard?.writeText(m.c).then(() => toast('已复制'), () => {});
        k == 'rc' && Object.assign(m, { t: 'sys', c: '你撤回了一条消息', old: m.c, re: [] }); k == 'del' && drop(ch.msgs.splice(i, 1)); k == 'regen' && (drop(ch.msgs.splice(ch.msgs.findLastIndex(x => x.f == 'me') + 1)), gen(ch)); // 整轮回复重来
        saveD(); emit('chat');
      },
      // 多选（仿微信）：点消息勾选；「选择到这里」从第一条选中的一直选到屏幕上看到的最后一条；全选；转发 / 注入正文 / 删除
      msel: i => { i = +i; sel.has(i) ? sel.delete(i) : sel.add(i); selUp(); },
      selx: () => { sel = null; rer(); },
      selall: () => { const L = selable(); sel = sel.size >= L.length ? new Set() : new Set(L); selUp(); },
      selto: () => { const b = $('.pg-b', pg.el), bot = b.getBoundingClientRect().bottom, vis = [...pg.el.querySelectorAll('.cv .msg[data-x], .cv .sys[data-x]')].filter(e => e.getBoundingClientRect().top < bot - 20).map(e => +e.dataset.x), to = Math.max(...vis), from = sel.size ? Math.min(...sel) : 0; selable().forEach(k => k >= from && k <= to && sel.add(k)); selUp(); },
      sdel: async () => { if (!sel.size || !await ok(`删除选中的 ${sel.size} 条消息？`)) return; const ix = [...sel].sort((a, b) => b - a); ix.forEach(k => drop(ch.msgs.splice(k, 1))); sel = null; saveD(); rer(); emit('chat'); },
      sinj: () => { if (!sel.size) return; const L = [...sel].map(k => ch.msgs[k]), on = !L.every(m => m.inj); L.forEach(m => m.inj = on); saveD(); toast(on ? `已把 ${L.length} 条注入正文` : '已取消注入'); sel = null; rer(); },
      sfwd: async () => { if (!sel.size) return; const k = await menu([['one', '逐条转发'], ['all', '合并转发']]); if (!k) return; const L = [...sel].sort((a, b) => a - b).map(k => ch.msgs[k]); if (await fwd(L, k)) { sel = null; rer(); } },
      recv: i => recPage(ch.msgs[i]),
      // 音乐卡片：分享的歌点一下就放；一起听卡片点开播放页；角色的邀请可以接受 / 拒绝
      mzsong: async i => { const s = ch.msgs[i]?.song; if (!s?.name) return; const r = await G.mzPlay?.(s.name, s.artist, { id: s.id, pic: s.pic }).catch(() => null); r ? G.mzPlayer?.() : toast('这首歌暂时放不了'); },
      mzopen: () => G.mzListen?.(),
      mzend: async i => { if (!await ok('结束一起听？')) return; mzB.endMusicListening(ch.id, { reason: 'manual' }); },
      mzrej: i => { const m = ch.msgs[i]; if (!m || m.t != 'minv') return; m.st = 'rejected'; push(ch, { t: 'sys', c: `你拒绝了一起听《${m.song?.name || '这首歌'}》` }); },
      mzacc: async i => { const m = ch.msgs[i]; if (!m || m.t != 'minv') return; const s = m.song || {};
        const r = await G.mzPlay?.(s.name, s.artist, { pic: s.pic }).catch(() => null); if (!r) return toast('这首歌暂时放不了');
        m.id ||= 'mzi_' + Date.now().toString(36); Object.assign(s, { name: r.name || s.name, artist: r.artist || s.artist, pic: s.pic || r.pic || '' });
        const snap = G.mzSnapshot?.() || { songName: s.name, artist: s.artist, cover: s.pic }; mzB.startMusicListening(ch.id, { name: nm(get(m.f) || ch), avatar: avOf(get(m.f) || ch) }, { ...snap, sourceMessageId: m.id }); m.st = 'accepted';
        push(ch, { t: 'sys', c: `你接受了一起听《${s.name}》` }); },
      trq: async i => { const m = ch.msgs[i]; if (!m) return; m.tp = 1; emit('chat'); try { const z = await mt(m.c, 'zh-CN'); z != m.c ? (m.tr = z, m.tz = !cf.trOpen) : toast('这句不用翻译'); } catch { toast('机翻暂时不可用，稍后再试'); } m.tp = 0; saveD(); emit('chat'); },
      // 系统提示（拍一拍、撤回提示…）：长按也能删除 / 多选
      slp: async (i, t) => { const k = await pop(t, [['multi', '多选'], ['del', '删除']], false); if (k == 'multi') { sel = new Set([+i]); return rer(); } if (k == 'del') { drop(ch.msgs.splice(i, 1)); saveD(); emit('chat'); } },
    },
  });
}

/* ---------- 聊天设置 ---------- */
// 聊天信息 · 翻译（私聊 / 群聊）
function trSec(ch, f, g) {
  const c = ch.cfg, L1 = LANGS.slice(1), mine = f.tog('cfg.trMine', '自动翻译我发出的消息') + (c.trMine ? f.sel('cfg.trTo', '我的消息翻译为', [['', g ? '（请选择）' : '跟角色一样'], ...L1]) : '');
  const auto = f.tog('cfg.trAuto', '自动翻译') + f.tog('cfg.trOpen', '自动展开翻译');
  if (!g) return auto + f.sel('cfg.lang', '角色消息翻译为', LANGS) + mine;
  const ms = ch.members.map(get).filter(Boolean).map(m => `${esc(nm(m))}→${m.cfg?.lang ? lname(m.cfg.lang) : '中文'}`).join('、');
  return f.tog('cfg.trFollow', `成员消息跟随各自私聊的翻译设置${c.trFollow !== false && ms ? `<small>${ms}</small>` : ''}`)
    + (c.trFollow === false ? f.sel('cfg.lang', '成员消息统一翻译为', LANGS) : '') + auto + mine;
}
export function cset(ch) {
  const f = fx(ch), g = ch.type == 'g', mem = () => ch.members.map(i => [i, nm(get(i))]);
  page({
    title: g ? '群聊设置' : '聊天设置', model: () => ch, onClose: () => setTimeout(() => top()?.re()),
    onChange: k => (/^cfg\.(lang|trFollow|trAuto)$/.test(k) && D().chats.forEach(retrans), /^(cfg\.(trFollow|trAuto|lang|trMine)|tv\.pv|tv\.v\.|sex$)/.test(k) && setTimeout(() => { const t = top(); if (!t) return; const b = $('.pg-b', t.el), sc = b?.scrollTop; t.re(); $('.pg-b', t.el).scrollTop = sc; })),
    body: () => sec('cset', [
      ['info', '基本信息', g ? f.img('av', '群头像') + f.inp('name', '群名') + f.inp('no', '群号') + f.area('notice', '群公告') + f.sel('owner', '群主', [['', '我'], ...mem()]) + f.multi('admins', '管理员', mem())
        : f.img('av', '头像') + f.inp('nick', '昵称（网名）') + f.inp('real', '真实姓名') + f.inp('remark', '备注') + f.inp('sign', '个性签名') + f.inp('grp', '分组', 'text', '我的好友') + f.inp('ps', '拍一拍后缀', 'text', '如：的小脑袋') + f.sel('sex', '性别', [['', '未知'], ['男', '男'], ['女', '女']])],
      g && ['mem', `群成员 · ${gsz(ch)}`, `<div class="mems">${ch.members.map(i => `<div class="mem"><img class="av" src="${esc(avOf(get(i)))}"><b>${esc(nm(get(i)))}${get(i)?.cfg?.lang ? ` <small>${lname(get(i).cfg.lang)}</small>` : ''}</b>${get(i)?.fr === 0 ? `<em class="mfr" data-a="mfr" data-x="${i}">加好友</em>` : ''}<input data-k="titles.${i}" value="${esc(ch.titles[i] || '')}" placeholder="群头衔"><i data-a="mdel" data-x="${i}">×</i></div>`).join('')}</div>${gsz(ch) > ch.members.length + 1 ? `<p class="tip">还有 ${gsz(ch) - ch.members.length - 1} 位群成员没在剧情里出现，已折叠</p>` : ''}${f.inp('size', '群人数', 'number', String(ch.members.length + 1))}${btn('madd', '＋ 邀请成员')}`],
      !g && ['voice', '专属音色', vSec(ch, f)],
      ['tr', '翻译', trSec(ch, f, g)],
      ['reply', '回复设置', `<div class="row rng"><span>回复条数</span><i>最少</i><input type="number" min="1" data-k="cfg.rmin" value="${esc(ch.cfg.rmin ?? 1)}"><i>最多</i><input type="number" min="1" data-k="cfg.rmax" value="${esc(ch.cfg.rmax ?? 5)}"></div>
<div class="row rng"><span>语音条数</span><i>最少</i><input type="number" min="0" data-k="cfg.vmin" value="${esc(ch.cfg.vmin ?? 0)}"><i>最多</i><input type="number" min="0" data-k="cfg.vmax" value="${esc(ch.cfg.vmax ?? 1)}"></div>`],
      ['rd', '互动', (sty(ch) == 'wx' ? '' : f.tog('cfg.read', '显示已读 / 未读')) + f.tog('cfg.pat', g ? '允许群成员拍一拍我' : '允许对方拍一拍我') + ''],
      ['look', '美化', f.sel('cfg.style', '风格', [['', '跟随默认'], ...STY]) + f.sel('cfg.bub', '气泡样式', [['', '默认'], ...S.assets.bubble.map(a => [a.id, a.name])]) + '<div class="col"><span>气泡形状</span>' + f.seg('cfg.shape', [['', '默认'], ['round', '圆润'], ['sq', '方形'], ['tail', '尖角']]) + '</div><div class="col"><span>头像形状</span>' + f.seg('cfg.avs', [['', '默认'], ['ci', '圆形'], ['sq', '方形']]) + '</div>'
        + f.tog('cfg.showAv', '显示头像') + f.tog('cfg.cont', '连续消息合并气泡') + f.tog('cfg.dark', '夜间模式') + f.img('cfg.bg', '聊天背景')
        + `<div class="col"><span>头像框</span><div class="frs">${[{ id: '' }, ...S.assets.frame].map(a => `<div class="fr ${ch.cfg.frame == a.id ? 'on' : ''}" data-a="setfr" data-x="${a.id}">${a.img ? `<img src="${esc(a.img)}">` : '无'}</div>`).join('')}</div></div>` + btn('impcss', '导入气泡 CSS 文件')],
      ['link', '正文联动', f.tog('cfg.inj', '整个聊天注入正文') + ``],
      ['dz', '更多', btn('clr', '清空聊天记录', '', 'danger') + btn('rm', g ? '删除并退出群聊' : '删除联系人', '', 'danger')]]),
    acts: {
      setfr: (x, t, e, pg) => { ch.cfg.frame = x; saveD(); pg.re(); },
      ...vActs(ch),
      mfr: async (i, t, e, pg) => { const c = get(i); if (!c || !await ok(`加「${nm(c)}」为好友？加完就能私聊了`)) return; c.fr = 1; saveD(); toast('已添加到通讯录'); pg.re(); },
      mdel: (i, t, e, pg) => { ch.members = ch.members.filter(x => x != i); ch.admins = ch.admins.filter(x => x != i); saveD(); pg.re(); },
      madd: async (x, t, e, pg) => { const k = await menu(D().chats.filter(c => c.type == 'p' && !ch.members.includes(c.id)).map(c => [c.id, esc(nm(c))]), '邀请成员'); if (!k) return; ch.members.push(k); ch.msgs.push({ f: 'sys', t: 'sys', c: `“${nm(meObj())}”邀请“${nm(get(k))}”加入了群聊`, ts: +now() }); saveD(); pg.re(); },
      impcss: async (x, t, e, pg) => { const fl = await pickFile('.css,text/css'); if (!fl) return; const a = { id: uid(), name: fl.name.replace(/\.\w+$/, ''), css: await fl.text() }; S.assets.bubble.push(a); ch.cfg.bub = a.id; C().saveSettingsDebounced(); saveD(); pg.re(); },
      clr: async () => { if (await ok('清空全部聊天记录？')) { drop(ch.msgs); ch.msgs = []; saveD(); toast('已清空'); } },
      rm: async () => { if (await ok('确定删除？')) { rm(ch); saveD(); back(); back(); } },
    },
  });
}
