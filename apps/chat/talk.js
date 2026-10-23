// 聊天 · 聊天窗口：回复协议 / 生成 / 翻译 / 拍一拍 / 表情包 / 表情回应 / 引用 / 撤回 / 聊天设置
import { C, S, D, saveD, esc, uid, $, ui, page, top, back, home, menu, form, ok, toast, fx, btn, sec, nm, rn, avOf, defAv, meObj, brief, now, hm, llm, json, sysCtx, genImg, tts, notify, on, emit, pickImg, pickFile, I, sleep, mt, APPS } from '../../core.js';
import { get, isMe, addMsg, viewing, sty, who, nre, shake, rm, STY, LANGS, lname } from './data.js';
import { openFeed } from './chat.js';

const EMO = '❤️ 👍 😂 🥺 😮 😡 🥳 🙏'.split(' ');
const EMOJI = [...'😀😁😂🤣😊😇🙂😉😍🥰😘😚😋😛😜🤪😎🤓🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🙄😬😴🤤😪😵🤐🥴🤢🤧😷🤒🤕🤑🤠😈👻💀👽🤖💩🙈🙉🙊💋💌💘💝💖💗💓💞💕💔❤🧡💛💚💙💜🤍🖤💯💢💥💫💦💨🕳💬👋🤚✋👌✌🤞🤟🤘🤙👈👉👆👇👍👎✊👊👏🙌👐🤲🙏💪🌹🌸🌙⭐🔥🎉🎁☕🍰🍓'];

/* ---------- 回复协议：一行一条消息「名字: 内容」，功能用方括号标签（比 JSON 短、生成更快、不怕格式错） ---------- */
const TAGS = '表情包|语音|图片|转账|收款|表情回应|引用|撤回|拍一拍|翻译';
export function parseReply(raw, ch) {
  raw = String(raw ?? '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/【/g, '[').replace(/】/g, ']');
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
    if ('转账' in tg) { const [a, n] = tg.转账.split('|'); out.push({ ...b, type: 'transfer', amount: parseFloat(a) || 0, text: n || '', tr: '' }); }
    l && out.push({ ...b, type: 'text', text: l, quote: tg.引用 });
  }
  return out;
}
function replyP(ch, patNow) {
  const g = ch.type == 'g', me = meObj().nick, sk = S.assets.sticker.map(s => s.name).join('、'), lang = ch.cfg.lang;
  const hist = ch.msgs.slice(-30).map(m => `${m.f == 'me' ? me : m.f == 'sys' ? '[系统]' : rn(get(m.f))}: ${m.t == 'pat' || m.t == 'sys' ? `（${m.c}）` : brief(m)}${m.q ? `（引用了：${m.q.c}）` : ''}${m.t == 'transfer' && m.st ? `（${m.st}）` : ''}`).join('\n');
  const tl = g ? ch.members.map(get).filter(c => c?.cfg?.lang).map(c => `${rn(c)}用${lname(c.cfg.lang)}`) : lang ? [`${rn(ch)}用${lname(lang)}`] : [];
  return `【当前聊天】${g ? `群聊「${ch.name}」 群主:${ch.owner ? rn(get(ch.owner)) : me} 管理员:${ch.admins.map(i => rn(get(i))).join('、') || '无'}\n成员：${ch.members.map(i => { const c = get(i); return `${rn(c)}(网名${c.nick}${ch.titles[i] ? '，头衔' + ch.titles[i] : ''})`; }).join('、')}${ch.notice ? '\n群公告：' + ch.notice : ''}` : `与${rn(ch)}（网名${ch.nick}）的私聊`}
【聊天记录】\n${hist || '（空）'}

请继续这段手机聊天${g ? '，让群成员按各自人设自然互动、互相接话' : `，你扮演${rn(ch)}回复${me}`}。像真人发消息：口语、短句，一次1-5条，符合人设与当前剧情。
【输出格式】每条消息单独一行：${g ? '「真实姓名: 内容」' : '直接写内容'}。不要写${me}的话，不要任何解释。按人设此刻会“已读不回”就什么都不输出。
【可用标签】（单独一行，前面同样写名字）
[表情包:描述] 发表情包${sk ? `（优先用：${sk}）` : ''}
[语音:要说的话]　[图片:画面描述]　[转账:金额|备注]　[收款]（收下${me}的转账）
[表情回应:emoji] 给${me}刚才的消息贴表情，表情要符合此刻的真实态度；也可 [表情回应:emoji|消息片段] 指定哪条
[引用:消息片段] 正文　引用某条消息来回复
[撤回] 撤回自己上一条（说漏嘴、发错时用）
${ch.cfg.pat ? `[拍一拍:动作] 对${me}做个小动作，如 [拍一拍:揉了揉你的头发]，动作按人设即兴${patNow ? `\n本轮请${g ? '挑一位成员' : ''}用一次 [拍一拍:动作]。` : '，剧情合适时再用。'}` : ''}
${tl.length ? `【语言】${tl.join('；')}：这些人的文字和语音直接用该语言写，同一行末尾附 [翻译:简体中文译文]。译文要沉浸式、完全贴合说话人的人设与此刻语气（傲娇就傲娇、撒娇就撒娇），口语自然，只翻原意、不加戏不漏内容；其他人照常说中文。表情包等标签不翻译。` : ''}`;
}

/* ---------- 生成 ---------- */
let busy = 0;
export async function gen(ch) {
  if (busy) return toast('上一轮回复还在生成中…'); busy = ch.id; ch.msgs.forEach(m => m.f == 'me' && (m.rd = 1)); saveD(); emit('chat');
  try {
    const ms = parseReply(await llm(await sysCtx(), replyP(ch, ch.cfg.pat && Math.random() < .3), '聊天回复'), ch);
    for (const m of ms) { const x = addMsg(ch, m); saveD(); emit('chat'); x && !viewing(ch.id) && notify(ch, x); x && await sleep(450 + Math.min(1600, String(m.text || '').length * 60)); }
  } catch (e) { toast('生成失败：' + e.message); } finally { busy = 0; emit('chat'); }
}
const push = (ch, m) => {
  const x = { f: 'me', t: 'text', c: '', ts: +now(), ...m }; ch.msgs.push(x); saveD(); emit('chat');
  if (ch.cfg.trMine && ch.cfg.lang && /text|voice/.test(x.t)) { x.tp = 1; mt(x.c, ch.cfg.lang).then(t => { x.orig = x.c; x.c = t; }).catch(e => toast('翻译失败：' + e.message)).finally(() => { x.tp = 0; saveD(); emit('chat'); }); }
  return x;
};
on('chat', () => { const t = top(); if (!t?.live) return; t.chat ? (t.reb(), $('.pg-t', t.el).innerHTML = t.title()) : t.re(); });

/* ---------- 渲染 ---------- */
export const tT = ts => { const d = new Date(ts); return (d.toDateString() == now().toDateString() ? '' : `${d.getMonth() + 1}月${d.getDate()}日 `) + hm(d); };
const avH = (c, ch, id) => { const fr = S.assets.frame.find(a => a.id == ch.cfg.frame)?.img; return `<div class="avw" data-a="avc" data-x="${id}"><img class="av" src="${esc(avOf(c))}">${fr ? `<img class="frm" src="${esc(fr)}">` : ''}</div>`; };
const fold = (i, txt, lab, open) => `<div class="tz ${open ? 'open' : ''}"><b data-a="tz" data-x="${i}">${open ? '收起' + lab : lab}</b><p>${esc(txt)}</p></div>`;
function body(m, i, cf) {
  const tzo = !!cf.trOpen != !!m.tz; // m.tz 记录这条是否被手动翻转过
  switch (m.t) {
    case 'sticker': return m.img ? `<img class="stk" src="${esc(m.img)}">` : `<div class="stk0"><b>${['(｡•ᴗ•｡)', '(๑•̀ㅂ•́)و', '(っ˘ω˘ς)', '( ˘•ω•˘ )', '(ﾉ´ヮ`)ﾉ'][m.c.length % 5]}</b><small>${esc(m.c)}</small></div>`;
    case 'img': return m.url ? `<img class="pic" src="${esc(m.url)}">` : `<div class="picd">🖼 ${esc(m.c)}</div>`;
    case 'voice': return `<div class="vc" data-a="play" data-x="${i}">${I.wave}${Math.max(1, Math.ceil(m.c.length / 4))}″</div>${m.open ? `<div class="vt">${esc(m.c)}</div>` : ''}${m.tr && m.open ? fold(i, m.tr, '翻译', tzo) : ''}`;
    case 'transfer': return `<div class="tf ${m.st ? 'done' : ''}" data-a="tf" data-x="${i}"><b>¥${(+m.amt).toFixed(2)}</b><small>${esc(m.st || m.c || (m.f == 'me' ? '待对方收款' : '请收款'))}</small><i>转账</i></div>`;
    default: return esc(m.c).replace(/\n/g, '<br>') + (m.tp ? '<small class="tp">翻译中…</small>' : '') + (m.orig ? fold(i, m.orig, '原文', tzo) : m.tr ? fold(i, m.tr, '翻译', tzo) : '');
  }
}
const rxH = (m, i) => { const g = {}; nre(m.re).forEach(r => (g[r.e] ||= []).push(r.by)); return Object.keys(g).length ? `<div class="rx">${Object.entries(g).map(([e, bs]) => `<span class="rp ${bs.includes('me') ? 'mine' : ''}" data-a="rpx" data-x="${i}|${e}">${e}<small>${esc(bs.map(b => b == 'me' ? '我' : nm(get(b))).slice(0, 2).join('、'))}${bs.length > 2 ? `等${bs.length}人` : ''}</small></span>`).join('')}</div>` : ''; };
// 已读回执：微信/QQ 文字，Kakao 未读显示黄色数字，LINE 显示 Read
const rd = (m, ch) => { const st = sty(ch), g = ch.type == 'g', n = g ? ch.members.length : 1; return m.rd ? (st == 'kk' ? '' : `<em class="rd">${st == 'line' ? (g ? 'Read ' + n : 'Read') : g ? n + '人已读' : '已读'}</em>`) : `<em class="rd un">${st == 'kk' ? n : st == 'line' ? '' : '未读'}</em>`; };
function msgs(ch) {
  let p, o = ''; const cf = ch.cfg, g = ch.type == 'g', me = meObj(), bub = S.assets.bubble.find(a => a.id == cf.bub);
  ch.msgs.forEach((m, i) => {
    const gap = !p || m.ts - p.ts > 3e5; gap && (o += `<div class="tm">${tT(m.ts)}</div>`);
    if (m.t == 'pat' || m.t == 'sys') o += `<div class="sys ${m.t}">${esc(m.c)}${m.old != null && m.f == 'me' ? ` <b data-a="redit" data-x="${i}">重新编辑</b>` : ''}</div>`;
    else {
      const mine = m.f == 'me', c = mine ? me : get(m.f) || { nick: '已删除' }, same = !gap && p?.f == m.f && !/sys|pat/.test(p.t);
      const tag = g && !mine ? (ch.owner == m.f ? '<em class="own">群主</em>' : ch.admins.includes(m.f) ? '<em class="adm">管理员</em>' : '') + (ch.titles[m.f] ? `<em>${esc(ch.titles[m.f])}</em>` : '') : '';
      o += `<div class="msg ${mine ? 'me' : ''} ${same ? 'same' : ''}" data-lp="mlp" data-x="${i}">${avH(c, ch, m.f)}<div class="mc">${!mine && !(same && cf.cont) ? `<div class="mn">${tag}${esc(nm(c))}</div>` : ''}<div class="mr"><div class="bub b-${m.t}">${body(m, i, cf)}</div><span class="mt">${m.inj ? '<i class="ij">↪</i>' : ''}${mine && cf.read ? rd(m, ch) : ''}<time>${hm(new Date(m.ts))}</time></span></div>${m.q ? `<div class="qt">${esc(m.q.w)}：${esc(m.q.c)}</div>` : ''}${rxH(m, i)}</div></div>`;
    }
    p = m;
  });
  busy == ch.id && (o += `<div class="msg typing">${g ? `<div class="avw"><img class="av" src="${defAv('…')}"></div>` : avH(ch, ch, ch.id)}<div class="mc"><div class="bub"><i></i><i></i><i></i></div></div></div>`);
  return `${bub ? `<style>${bub.css}</style>` : ''}<div class="cv">${o || '<div class="sys">还没有消息，打个招呼吧 ✧</div>'}</div>`;
}

/* ---------- 聊天窗口 ---------- */
let avL, avT;
export function openChat(id) {
  const ch = get(id); if (!ch) return; if (top()?.cls != 'chatapp') { home(); APPS.chat.open(); } ch.unread = 0; saveD();
  const cf = ch.cfg, cls = () => `chat st-${sty(ch)} ${ch.type == 'g' ? 'grp' : ''} ${cf.dark ? 'dark' : ''} sh-${cf.shape || 'def'} av-${cf.avs || 'def'} ${cf.showAv ? '' : 'noav'} ${cf.cont ? 'cont' : ''}`;
  let ptab = 'stk', q = null;
  const panHtml = k => k == 'stk' ? `<div class="ptabs">${[['stk', '★ 表情包'], ['emo', '😀 Emoji']].map(([a, l]) => `<b data-a="ptab" data-x="${a}" class="${ptab == a ? 'on' : ''}">${l}</b>`).join('')}</div><div class="pgrid ${ptab}">${ptab == 'emo' ? EMOJI.map(e => `<i data-a="emo" data-x="${e}">${e}</i>`).join('') : S.assets.sticker.map((s, i) => `<div class="sk" data-a="sk" data-x="${i}"><img src="${esc(s.img)}"><small>${esc(s.name)}</small></div>`).join('') + '<div class="sk add" data-a="skadd">＋<small>添加</small></div>'}</div>`
    : `<div class="pgrid tools">${[['pimg', '相册', '🖼'], ['pai', 'AI生图', '🎨'], ['ptf', '转账', '¥'], ['ppat', '拍一拍', '👋'], ['pvo', '语音', '🎙'], ['pgen', '让TA回复', '✨']].map(([a, l, i]) => `<div class="tl" data-a="${a}"><i>${i}</i>${l}</div>`).join('')}</div>`;
  const pan = k => { const p = $('.pan', pg.el), on = p.dataset.k != k || !p.classList.contains('on'); p.dataset.k = k; p.classList.toggle('on', on); p.innerHTML = panHtml(k); };
  const qbar = () => { const b = $('.qbar', pg.el), m = q != null && ch.msgs[q]; b.innerHTML = m ? `<span>${esc(who(ch, m.f))}：${esc(brief(m)).slice(0, 40)}</span><b data-a="qx">×</b>` : ''; b.classList.toggle('on', !!m); };
  const pat = t => { push(ch, { t: 'pat', c: t == 'me' ? `“我” 拍了拍自己${D().me.ps || ''}` : `“我” 拍了拍 “${nm(get(t))}”${get(t).ps || ''}` }); shake(); };
  const tool = async f => { $('.pan', pg.el).classList.remove('on'); await f(); };
  const pg = page({
    chat: id, live: 1, model: () => ch, cls: cls(), onClose: () => setTimeout(() => emit('chat')),
    title: () => `<b>${esc(nm(ch))}${ch.type == 'g' ? ` (${ch.members.length + 1})` : ''}</b>${busy == id ? `<small class="typ">${ch.type == 'g' ? '群成员' : '对方'}正在输入<i>.</i><i>.</i><i>.</i></small>` : ''}`,
    right: () => `<b data-a="cset">${I.more}</b>`, body: () => msgs(ch),
    foot: () => `<div class="qbar"></div><div class="ib"><button data-a="pan" data-x="stk">${I.smile}</button><textarea class="ip" rows="1" placeholder="发消息…"></textarea><button data-a="pan" data-x="more">${I.plus}</button><button class="go" data-a="send"><span class="s1">${I.spark}</span>${I.send.replace('<svg', '<svg class="s2"')}</button></div><div class="pan"></div>`,
    after: el => {
      const keep = el.classList.contains('in'); el.className = `pg ${cls()}${keep ? ' in' : ''}`;
      const b = $('.pg-b', el), ip = $('.ip', el), go = $('.go', el); b.style.background = cf.bg ? `url("${cf.bg}") center/cover` : ''; b.scrollTop = b.scrollHeight;
      ip.oninput = () => { go.classList.toggle('has', !!ip.value.trim()); ip.style.height = 'auto'; ip.style.height = Math.min(100, ip.scrollHeight) + 'px'; };
      ip.onkeydown = e => e.key == 'Enter' && !e.shiftKey && !e.isComposing && (e.preventDefault(), pg.acts.send());
    },
    acts: {
      send: () => { const ip = $('.ip', pg.el), v = ip.value.trim(); if (!v) return gen(ch); const m = q != null && ch.msgs[q]; ip.value = ''; ip.oninput(); push(ch, { c: v, ...(m && { q: { w: who(ch, m.f), c: brief(m).slice(0, 40) } }) }); q = null; qbar(); },
      pan, cset: () => cset(ch), qx: () => { q = null; qbar(); },
      ptab: x => { ptab = x; $('.pan', pg.el).innerHTML = panHtml('stk'); },
      emo: e => { const ip = $('.ip', pg.el); ip.value += e; ip.oninput(); },
      sk: i => { const s = S.assets.sticker[i]; push(ch, { t: 'sticker', c: s.name, img: s.img }); },
      skadd: async () => { const r = await form('添加表情包', [['name', '描述（AI 按描述发送）'], ['img', '图片', 'img']]); if (!r?.img) return; S.assets.sticker.push({ id: uid(), name: r.name || '表情', img: r.img }); C().saveSettingsDebounced(); $('.pan', pg.el).innerHTML = panHtml('stk'); },
      pimg: () => tool(async () => { const u = await pickImg(800); u && push(ch, { t: 'img', c: '图片', url: u }); }),
      pai: () => tool(async () => { const r = await form('AI生图并发送', [['d', '画面描述', 'area']]); if (!r?.d) return; const x = push(ch, { t: 'img', c: r.d }); try { x.url = await genImg(r.d); saveD(); emit('chat'); } catch (e) { toast('生图失败：' + e.message); } }),
      ptf: () => tool(async () => { const r = await form('转账', [['amt', '金额', 'number'], ['c', '备注']]); if (!(+r?.amt > 0)) return; D().me.wallet -= +r.amt; push(ch, { t: 'transfer', amt: +r.amt, c: r.c }); }),
      ppat: () => tool(async () => { if (ch.type == 'p') return pat(ch.id); const k = await menu(ch.members.map(i => [i, esc(nm(get(i)))]), '拍一拍谁'); k && pat(k); }),
      pvo: () => tool(async () => { const r = await form('发送语音', [['c', '要说的话', 'area']]); r?.c && push(ch, { t: 'voice', c: r.c }); }),
      pgen: () => tool(() => gen(ch)),
      avc: x => { clearTimeout(avT); if (avL == x) { avL = 0; return pat(x); } avL = x; avT = setTimeout(() => { avL = 0; x != 'sys' && openFeed(x); }, 280); },
      tz: i => { const m = ch.msgs[i]; m.tz = !m.tz; saveD(); emit('chat'); },
      rpx: x => { const [i, e] = x.split('|'), m = ch.msgs[i], r = nre(m.re), k = r.findIndex(y => y.e == e && y.by == 'me'); m.re = k > -1 ? r.filter((_, j) => j != k) : [...r, { e, by: 'me' }]; saveD(); emit('chat'); },
      redit: i => { const m = ch.msgs[i], ip = $('.ip', pg.el); ip.value = m.old; ip.oninput(); ip.focus(); },
      tf: async i => { const m = ch.msgs[i]; if (m.f == 'me' || m.st || !await ok(`收下 ¥${m.amt}？`)) return; m.st = '已收款'; D().me.wallet = +D().me.wallet + m.amt; saveD(); emit('chat'); },
      play: i => { const m = ch.msgs[i]; m.open = 1; saveD(); emit('chat'); tts(m.c, m.f == 'me' ? '' : get(m.f)?.voice).catch(e => toast('语音失败：' + e.message)); },
      mlp: async i => {
        const m = ch.msgs[i]; if (/sys|pat/.test(m.t)) return; const mine = m.f == 'me';
        const k = await menu([...EMO.map(e => ['e' + e, e, 'emo']), ['q', '引用'], ['tr', m.tr || m.orig ? '显示 / 收起翻译' : '翻译'], ['tts', '朗读'], ['copy', '复制'], ['inj', m.inj ? '取消注入正文' : '注入正文'], ...(mine ? [['rc', '撤回']] : []), ['regen', '从这条往后重新生成'], ['del', '删除', 'danger']]); if (!k) return;
        if (k[0] == 'e') return pg.acts.rpx(i + '|' + k.slice(1));
        if (k == 'q') { q = i; qbar(); return $('.ip', pg.el).focus(); }
        if (k == 'tr') { // 对方的译文只随回复一起生成；只有我自己的消息可以机翻
          if (m.tr || m.orig) m.tz = !m.tz;
          else if (!mine) return toast('对方的翻译会随回复一起生成：在聊天设置里选好对方语言即可');
          else if (!ch.cfg.lang) return toast('先在聊天设置里选择对方说的语言');
          else { m.tp = 1; emit('chat'); try { const t = await mt(m.c, ch.cfg.lang); m.orig = m.c; m.c = t; m.tz = !ch.cfg.trOpen; } catch (e) { toast(e.message); } m.tp = 0; }
        }
        k == 'inj' && (m.inj = !m.inj); k == 'tts' && tts(m.c, get(m.f)?.voice).catch(e => toast(e.message)); k == 'copy' && navigator.clipboard?.writeText(m.c);
        k == 'rc' && Object.assign(m, { t: 'sys', c: '你撤回了一条消息', old: m.c, re: [] }); k == 'del' && ch.msgs.splice(i, 1); k == 'regen' && (ch.msgs.splice(+i + (mine ? 1 : 0)), gen(ch));
        saveD(); emit('chat');
      },
    },
  });
}

/* ---------- 聊天设置 ---------- */
export function cset(ch) {
  const f = fx(ch), g = ch.type == 'g', mem = () => ch.members.map(i => [i, nm(get(i))]);
  page({
    title: g ? '群聊信息' : '聊天信息', model: () => ch, onClose: () => setTimeout(() => top()?.re()),
    body: () => sec('cset', [
      ['info', '基本信息', g ? f.img('av', '群头像') + f.inp('name', '群名') + f.inp('no', '群号') + f.area('notice', '群公告') + f.sel('owner', '群主', [['', '我'], ...mem()]) + f.multi('admins', '管理员', mem())
        : f.img('av', '头像') + f.inp('nick', '昵称（网名）') + f.inp('real', '真实姓名') + f.inp('remark', '备注') + f.inp('sign', '个性签名') + f.inp('grp', '分组', 'text', '我的好友') + f.inp('ps', '拍一拍后缀', 'text', '如：的小脑袋') + f.inp('voice', 'TTS音色', 'text', '可留空')],
      g && ['mem', `群成员 · ${ch.members.length + 1}`, `<div class="mems">${ch.members.map(i => `<div class="mem"><img class="av" src="${esc(avOf(get(i)))}"><b>${esc(nm(get(i)))}${get(i)?.cfg?.lang ? ` <small>${lname(get(i).cfg.lang)}</small>` : ''}</b><input data-k="titles.${i}" value="${esc(ch.titles[i] || '')}" placeholder="群头衔"><i data-a="mdel" data-x="${i}">×</i></div>`).join('')}</div>${btn('madd', '＋ 邀请成员')}`],
      ['tr', '翻译', g ? '<p class="tip">群聊里每个成员的语言跟随 TA 私聊窗口的翻译设置（成员名后面会标出语言）。</p>' + f.tog('cfg.trOpen', '默认展开翻译')
        : f.sel('cfg.lang', '对方说的语言', LANGS) + f.tog('cfg.trOpen', '默认展开中文翻译') + f.tog('cfg.trMine', '把我的消息翻译成对方语言') + '<p class="tip">对方直接用外语回复，中文译文和消息在同一次回复里一起生成，按人设语气翻，不额外调用 API。你的消息只用酒馆自带的谷歌/必应机翻，绝不调用聊天模型；机翻失败就保留原文。</p>'],
      ['rd', '互动', f.tog('cfg.read', '显示已读 / 未读') + f.tog('cfg.pat', g ? '允许群成员拍一拍我' : '允许对方拍一拍我') + '<p class="tip">拍一拍：双击头像拍对方；对方也会不时拍你一下，画面会轻轻抖动。角色还可能贴表情、引用消息、撤回或“已读不回”。</p>'],
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
