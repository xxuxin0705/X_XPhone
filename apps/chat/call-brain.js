// 小手机 · 通话的「脑子」（10-31 推翻重写）
// 原则：模型只干一件事——写 TA 下一句要说的话。语言、切句、停顿、笑 / 叹气这些标记，全在这里用代码保证，不靠堆规矩求模型。
// - 背景（人设、世界书、最新剧情、最近私聊、记住的旧电话）在拨号时算一次，整通电话不变（前缀一样，模型那边的缓存能命中）
// - 每一轮发真正的多轮对话：我一句 user、TA 一句 assistant，最后一条就是我刚说的；模型天然接最后一句
// - 外语：TA 的话写成 「原话」（中文意思），跟正文里的写法一样（模型最熟）；「」里念出来，（）里只做字幕
// - 念之前检查语言：设成日语就必须是日语，混进中文的句子先翻成日语再念（酒馆自带的免费翻译，不花 API），绝不让日语音色硬念汉字
// - （笑）（叹气）（小声）这类写在话里的声音 → Fish Audio S2 的 [laughing] 等标记；别的服务商就去掉
import { S, C, now, rn, say, meObj, sysCtx, mt, forgot, prof, voiceOf } from '../../core.js';
import { mp } from '../../mods.js';
import { lname } from './data.js';
import { stLabel } from './status.js';

// TA 说什么语言：'' = 中文（没开翻译 / 繁体也按中文念）；其余是聊天设置里的语言代码
export const LANG = L => !L || /^zh/.test(L) ? '' : L;
const hm = d => `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const ago = ms => { const m = Math.round(ms / 6e4); return m < 2 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`; };

/* ---------- 背景：拨号时算一次 ---------- */
// 大头（人设、世界书、正文剧情）：跟私聊回复用的是同一套，只是正文少带几条，起手快一点
export const base = () => sysCtx({ n: 10, rc: 5000, wi: 6000, desc: 3000 });
// 电话专属的一小段：此刻、最近私聊、记住的旧电话、怎么说话、语言。L 是这通电话 TA 说的语言（中途换了就重算，很便宜）
export function tail(ch, A, L) {
  const me = meObj(), I = me.nick, who = rn(ch), d = now(), vid = A.kind == 'video';
  const chat = ch.msgs.filter(m => !/sys|pat|call/.test(m.t)).slice(-12).map(m => `${m.f == 'me' ? I : who}: ${say(m)}`).join('\n');
  const calls = ch.msgs.filter(m => m.t == 'call' && !forgot(m) && m.log?.length).slice(-2).map(m => `${ago(d - (m.ts || 0))}打过一通（${m.c}）：${m.log.slice(-10).map(x => `${x.f == 'me' ? I : who}：${x.tr || x.t}`).join(' / ').slice(0, 260)}`).join('\n');
  const last = (() => { try { return (C().chat || []).filter(m => !m.is_system).slice(-2).map(m => `${m.name}: ${String(m.mes || '').replace(/<[^>]*>/g, '').trim().slice(-500)}`).join('\n'); } catch { return ''; } })();
  const st = ch.st && d - (ch.st.ts || 0) < 864e5 ? `${who}的微信状态是「${stLabel(ch.st)}${ch.st.t ? '：' + ch.st.t : ''}」。` : '';
  return `\n\n【现在】${I}给${who}打${vid ? '视频' : '语音'}电话。你就是${who}，用${who}自己的口吻说话，只说${who}的话，不替${I}说。`
    + (last ? `\n【刚刚发生的】（正文最新的几段，电话就是在这之后打来的）\n${last}` : '')
    + `\n【此刻】${hm(d)}。${who}这会儿在哪、在干嘛、什么心情，按上面最新的剧情定，整通电话保持一致，被问到就具体说。${st}`
    + (chat ? `\n【最近的私聊】\n${chat}` : '') + (calls ? `\n【之前的电话】（只当背景，一切以最新剧情为准；可以顺嘴提一句）\n${calls}` : '')
    + `\n【说话】${mp('chat.call', { 对方: who, 我: I })}电话里的话都是说出口的：没有动作描写、旁白、表情符号。想说多少说多少，一句也行，一大段也行。笑、叹气、压低声音可以写成（笑）（叹气）（小声）放在那句话里，会被念出来；别的动作不写。`
    + (L ? `\n【语言】${who}只说${lname(L)}，一个中文词都不夹。每句话写在「」里，后面紧跟（这句话的中文意思）：\n「${lname(L)}原话」（中文意思）` : '\n【语言】全部用简体中文说。')
    + `\n${I}说要走了（再见、晚安、去睡了、去忙了）就道个别，最后单独一行写 [挂断]。`;
}

/* ---------- 每一轮：多轮对话 ---------- */
// o: { open 接通第一句 | said 我刚说的 | nudge 我多少秒没出声 | story 想听故事 | au 这轮是录音 | tone 语气 }
export function messages(ch, A, L, o = {}) {
  const I = meObj().nick, who = rn(ch), M = [], add = (role, t) => { if (!t) return; const l = M.at(-1); l?.role == role ? (l.content += '\n' + t) : M.push({ role, content: t }); };
  for (const x of A.log.slice(-30)) x.f == 'me' ? add('user', x.t) : add('assistant', L ? `「${x.t}」${x.tr ? `（${x.tr}）` : ''}` : x.t);
  if (o.open) add('user', `（${I}打来的电话，你刚接起来。）`); // 只交代场景，不提「喂」——提了小模型反而照着说
  else if (o.nudge) add('user', `（${I}那边安静了 ${o.nudge} 秒，没出声。）`);
  else if (o.story) add('user', `${o.said}（${I}想听这个故事。现在是睡前，${I}躺着听：用你自己的口吻慢慢讲一个完整的故事，大约 1500 字，句子短、适合念出来，中间可以轻轻跟${I}说一两句，结尾慢慢收住、道晚安。）`);
  else if (o.au) add('user', `（这段录音是${I}刚说的话。第一行先写 HEARD: 后面照录音写下${I}的原话（笑、叹气写在括号里，听不清写 HEARD: ?），然后另起一行开始回。）`);
  else if (o.said) { const l = M.at(-1), tn = o.tone ? `（听起来${o.tone}）` : ''; l?.role == 'user' && l.content.endsWith(o.said) ? (l.content += tn) : add('user', o.said + tn); } // 我这句一般已经记在 log 里了，别发两遍
  M[0]?.role != 'user' && M.unshift({ role: 'user', content: `（${I}打来的电话，你刚接起来。）` });
  M.at(-1).role != 'user' && add('user', `（${I}在听。）`);
  return M;
}
// 走不了多轮对话的路子（酒馆文本补全）：压成一段文字
export const flat = (ch, M) => { const I = meObj().nick, who = rn(ch); return M.map(m => `${m.role == 'user' ? I : who}：${m.content}`).join('\n'); };

/* ---------- 流式切句 ---------- */
// pair：外语 「原话」（中文意思）；否则中文一行一段。回调：
//   unit() → u（新的一段开始；u.t 原话累计、u.tr 释义）  part(u, text)（可以拿去念的一小句）  tr(u, text)  end(u)  bye()  stop()（模型开始替我说话）
const BYE = /[\[［]\s*挂断\s*[\]］]/, END = /[。！？!?…~～]/, CLOSE = /[。！？!?…~～」”’』）)]/;
export function parser(pair, on, o = {}) {
  let buf = '', st = 'out', u = null, lastU = null, cur = '', par = '', fin = false; const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const meRe = o.me ? new RegExp('^\\s*' + esc(o.me) + '\\s*[:：]') : null, whoRe = o.who ? new RegExp('^\\s*' + esc(o.who) + '\\s*[:：]') : null;
  const open = () => { u = on.unit(); u.t ||= ''; cur = ''; return u; };
  const emit = () => { let t = cur; cur = ''; if (BYE.test(t)) { on.bye(); t = t.replace(BYE, ''); } t = t.replace(/【[^】]*】|\*[^*]*\*/g, '').replace(/^[「『“"]+|[」』”"]+$/g, '').trim(); if (!t) return; u || open();
    if (whoRe && !u.t && whoRe.test(t)) t = t.replace(whoRe, '').trim(); if (meRe && !u.t && meRe.test(t)) { st = 'dead'; return on.stop(); } // 写成「我的名字：」——开始替我说话了，停
    if (!t) return; u.t += t; on.part(u, t); };
  const close = () => { cur.trim() && emit(); if (u) { lastU = u; on.end(u); u = null; } cur = ''; };
  const trTo = x => { x = String(x || '').replace(/^[“"「『]+|[”"」』]+$/g, '').trim(); const tg = u || lastU; tg && x && on.tr(tg, x); };
  const run = () => { let i = 0;
    while (i < buf.length && st != 'dead') { const c = buf[i];
      if (st == 'out') { if (c == '\n' || c == ' ' || c == '\t' || c == '\r') { i++; continue; } if (pair && (c == '「' || c == '『')) { open(); st = 'q'; i++; continue; } st = 'line'; continue; }
      if (st == 'q' || st == 'line') { // 「」里 / 一整行：遇到句末标点就放出一小句（后面跟着的收尾符号一起带上，所以要等下一个字来了才切）
        if (st == 'q' && (c == '」' || c == '』')) { close(); st == 'dead' || (st = 'aq'); i++; continue; }
        if (st == 'line' && c == '\n') { lineEnd(); i++; st == 'dead' || (st = 'out'); continue; }
        cur += c; i++;
        if (END.test(c) || !pair && cur.length >= 14 && /[，,、]/.test(c)) { if (i >= buf.length && !fin) { cur = cur.slice(0, -1); i--; break; } /* 等下一个字 */
          while (i < buf.length && CLOSE.test(buf[i]) && !/[）)]/.test(buf[i]) && !(st == 'q' && /[」』]/.test(buf[i]))) cur += buf[i++];
          const po = Math.max(cur.lastIndexOf('（'), cur.lastIndexOf('(')); if (po >= 0 && !/[）)]/.test(cur.slice(po))) continue; /* 括号没闭合：等 */ emit(); }
        continue; }
      if (st == 'aq') { if (c == ' ' || c == '\t') { i++; continue; } if (c == '（' || c == '(') { st = 'p'; par = ''; i++; continue; } st = 'out'; continue; } // 「」后面不是（：这一段没有释义
      if (st == 'p') { if (c == '）' || c == ')') { trTo(par); st = 'out'; i++; continue; } par += c; i++; continue; }
    }
    buf = buf.slice(i); };
  // 一行结束（中文；或外语模型没按「」写）：行尾的（……）当释义
  const lineEnd = () => { const m = pair && cur.match(/^(.*?)\s*[（(]([^（）()]{2,})[）)]\s*$/s); if (m && /[\u4e00-\u9fff]/.test(m[2]) && !/[\u3040-\u30ff\uac00-\ud7af]/.test(m[2])) { cur = m[1]; if (cur.trim()) { emit(); trTo(m[2]); close(); } else { trTo(m[2]); close(); } return; } close(); };
  return { feed: d => { if (st == 'dead') return; buf += d; run(); }, finish: () => { if (st == 'dead') return; fin = true; run(); if (st == 'p') trTo(par); else if (st == 'line') lineEnd(); else close(); st = 'dead'; } };
}

/* ---------- 语言检查：设成什么语言就必须是什么语言 ---------- */
const kana = /[぀-ヿ]/, hangul = /[가-힯ᄀ-ᇿ㄰-㆏]/, han = /[一-鿿]/, zhOnly = /[你嘛呢吗么们这那哪啥咋俺啦呀吧哦哈咱]|什么|怎么|没有|一下|干嘛|是不是|的话/;
export function langOk(t, L) { t = String(t || ''); if (!/\p{L}/u.test(t)) return true;
  if (!L) return !kana.test(t) && !hangul.test(t);
  if (L == 'ja') return !hangul.test(t) && (kana.test(t) || !han.test(t) || !zhOnly.test(t) && (t.match(/[一-鿿]/g) || []).length <= 5); // 「本当？」「医務室」这种纯汉字的短句是日语，放行
  if (L == 'ko') return !kana.test(t) && (hangul.test(t) || !han.test(t));
  return !kana.test(t) && !hangul.test(t) && !han.test(t); }
// 不对的句子：先翻成该说的语言（酒馆自带翻译，免费）；翻不了就原样返回并标记 bad（念的时候不指定语言，让语音服务自己认）
export async function fixLang(t, L) { if (langOk(t, L)) return { t, ok: true }; try { const x = await mt(t, L || 'zh-CN'); if (x && x.trim() && x.trim() != t.trim()) return { t: x.trim(), ok: true, fixed: t }; } catch { } return { t, ok: false }; }

/* ---------- （笑）（叹气）→ 语音服务的标记 ---------- */
const CUE = { 笑: 'laughing', 大笑: 'laughing', 哈哈: 'laughing', 笑い: 'laughing', 轻笑: 'chuckling', 笑了: 'chuckling', 苦笑: 'chuckling', 偷笑: 'chuckling', laughs: 'laughing', chuckles: 'chuckling', laughing: 'laughing',
  叹气: 'sighing', 叹息: 'sighing', 嘆息: 'sighing', ため息: 'sighing', sigh: 'sighing', sighs: 'sighing', sighing: 'sighing', 小声: 'whispering', 压低声音: 'whispering', 悄悄: 'whispering', 小声で: 'whispering', whispers: 'whispering', whispering: 'whispering',
  打哈欠: 'yawning', 哈欠: 'yawning', あくび: 'yawning', yawns: 'yawning', 哽咽: 'sobbing', 抽泣: 'sobbing', sobs: 'sobbing', 清嗓子: 'clear throat', 清了清嗓子: 'clear throat', 咳: 'clear throat', 停顿: 'break', 顿了顿: 'break', 沉默: 'long-break', 沉默了一会: 'long-break', pause: 'break' };
// 语音服务认不认这些标记：Fish Audio S2 用 [方括号]，S1 用 (圆括号)，别的不认
export function cueStyle(c) { try { const pv = voiceOf(c)?.pv || prof('tts')?.prov; if (pv != 'fish') return ''; const m = String((S.api.tts.cfg?.[pv] || {}).model || 's2.1-pro'); return /^s1\b/.test(m) ? '()' : '[]'; } catch { return ''; } }
// 返回 { t: 字幕用（标记去掉）, v: 念的文字（标记换成服务商认的写法或去掉） }
export function cues(raw, style) { let v = '', t = '';
  String(raw || '').split(/([（(][^（）()]{1,10}[）)])/).forEach((s, i) => { if (i % 2 == 0) { t += s; v += s; return; } const k = s.slice(1, -1).trim().replace(/[。.、，,]+$/, ''), tag = CUE[k] || CUE[k.toLowerCase()]; if (!tag || !style) return; v += style == '[]' ? `[${tag}]` : `(${tag})`; });
  return { t: t.replace(/\s{2,}/g, ' ').trim(), v: v.trim() }; }
