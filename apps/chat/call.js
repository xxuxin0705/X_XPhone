// 小手机 · 语音 / 视频通话（照微信录屏的样子；流式的做法参考 StarHub 的思路）
// 低延迟：①模型用流式返回，一句话一出来就送去合成（不等整段写完）；②下一句在上一句播放时就提前合成；③对方说话时不开麦（避免把自己的声音录进去），说完马上接着听；
// ④通话就是纯聊天，不让模型同时干别的；⑤通话内容结束后存成一条「通话」消息，聊天回复时带一段摘录，私聊知道电话里聊了什么但不会塞满上下文。
// 自动接话（默认，照 StarHub 示例）：对方说完马上开麦听我说，我停下约 1.2 秒就自动轮到 TA，不用按键；也可以切成「点着说」。
// 听我说话：点一下「点这里说」开始，浏览器自带的语音识别（Web Speech，免费，不走你的 API）把话实时写在屏幕上，点「说完了」才轮到 TA；用不了（没有麦克风权限 / 网络不通）就打字说。
// 等得久：对方正在想的秒数一直显示；超过 2.5 秒先垫一句「嗯…」（接通时提前合成好的）；20 秒给出原因提示；2 分钟没动静就当这轮失败，可以再说一遍。
// 对方说话：用你在设置里配的语音服务（这个人的专属音色）；没配语音就只显示字幕。
import { voiceOf, pickVoice, ttsCfg, stProf, curStream } from '../../core.js';
import { S, D, save, saveD, esc, ui, toast, avOf, meObj, nm, rn, now, llm, sysCtx, tts, emit, say, menu } from '../../core.js';
import { regMod, mp, NOAI } from '../../mods.js';
import { lname } from './data.js';
import { recall } from './recall.js';
regMod({ k: 'chat.call', app: '聊天', n: '语音通话', def: '这是在打电话，不是发消息：完全口语，短句，一次只说一两句，像真人那样有停顿、会接话、会追问，可以有「嗯」「啊」「欸」这种语气词。不要动作描写、括号旁白、表情符号、星号。', vars: [['对方', '通话的人'], ['我', '我的网名']] });

const IC = n => new URL(`../../assets/wx/call/${n}.png`, import.meta.url).href;
const msk = (n, c = '') => `<i class="xc-i ${c}" style="--ci:url('${IC(n)}')"></i>`;
const SPK_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8M17.6 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const IN = [['zh-CN', '中文'], ['en-US', '英语'], ['ja-JP', '日语'], ['ko-KR', '韩语'], ['yue-Hant-HK', '粤语']];
const OUT = [['auto', '跟聊天设置'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语']];
const outName = L => !L || L == 'zh' ? '中文' : lname(L);
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const mmss = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`;
let CALL = null; // 同一时间只有一通电话
const SIL = 1200; // 自动接话：我停下多久算说完（毫秒）

// 「＋」面板 → 视频通话：先选 视频通话 / 语音通话（照录屏）
export async function callSheet(ch) {
  if (ch.type != 'p') return toast('群通话还没有做');
  const k = await menu([['video', '<span class="xc-mi">' + msk('p-video') + '视频通话</span>'], ['voice', '<span class="xc-mi">' + svgTel + '语音通话</span>']]); k && startCall(ch, k);
}
const svgTel = '<svg class="xc-ms" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 3.5c.5-.3 1.2-.2 1.6.3l2 2.6c.4.5.4 1.2 0 1.7L9 9.4a12 12 0 0 0 5.6 5.6l1.3-1.2c.5-.4 1.2-.4 1.7 0l2.6 2c.5.4.6 1.1.3 1.6l-1.1 1.8c-.5.8-1.5 1.2-2.4.9C10.6 18.6 5.4 13.4 3.9 7.1c-.2-.9.1-1.9.9-2.4z"/></svg>';

export function startCall(ch, kind = 'voice') {
  if (CALL) return CALL.el.classList.remove('mini'), toast('正在通话中');
  const c = ch, me = meObj(), A = { ch, kind, st: 'dial', t0: 0, mic: true, spk: kind == 'video', log: [], cap: '', who: '', q: [], ac: null, rec: null, au: null, ring: null, cam: null, typing: false, ttsBad: false, inL: S.callLang || 'zh-CN', outL: undefined, ph: 'dial', thinkAt: 0, lastSaid: null };
  // 走酒馆「当前连接」时拿不到流式：整段想完才开口，所以会慢；在 应用配置 → 语音通话 里选一个「连接配置」或自己的 API 才能一句一句出
  A.raw = !(S.mods?.['chat.call']?.use) && S.api.chat.src == 'tavern' && !stProf(S.api.chat.stp) && !curStream(); // 酒馆当前连接是聊天补全时也能流式（见 core 的 curReq）
  A.auto = S.callAuto ?? true;
  // 播放用的音频时钟：在这次点击里建好（浏览器要求有用户操作才能出声），整通电话共用一个
  // 手机浏览器 / 酒馆 App 的内置网页默认「没点过就不许出声」：这里趁着这次点击，把音频时钟和一个常驻的播放器都先「解锁」（各放一段静音），后面整通电话都用它们
  try { A.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); A.gain = A.ctx.createGain(); A.gain.gain.value = A.spk ? 1 : .85; A.gain.connect(A.ctx.destination);
    const z = A.ctx.createBufferSource(); z.buffer = A.ctx.createBuffer(1, 1, 22050); z.connect(A.gain); z.start(0); A.ctx.resume?.(); } catch { }
  A.au = new Audio(SILENT); A.au.play().catch(() => { });
  A.lines = []; // 字幕：这通电话里谁说了什么（外语带中文）
  const el = Object.assign(document.createElement('div'), { className: `xc xc-${kind}` }); A.el = el; CALL = A;
  const draw = () => {
    const dial = A.st == 'dial', rec = A.ph == 'rec', cap = A.lines.length || rec ? `<div class="xc-tx">${A.lines.slice(-8).map((x, i, L) => `<p class="${x.f == 'me' ? 'me' : ''} ${i == L.length - 1 && A.ph == 'speak' && x.f != 'me' ? 'now' : ''}">${x == A.rv ? `<span class="xc-r">${esc(x.t.slice(0, x.sh))}</span>` : esc(x.t)}${x.tr && x.tr != x.t ? `<em${x == A.rv ? ' class="xc-r2"' : ''}>${esc(x == A.rv ? x.tr.slice(0, Math.ceil(x.tr.length * x.sh / Math.max(1, x.t.length))) : x.tr)}</em>` : ''}</p>`).join('')}${rec ? `<p class="me ing"><span>${esc(A.heard || '')}</span><i class="xc-cur"></i></p><p class="xc-dg">${esc(diag())}</p>` : ''}</div>` : '';
    const thinkS = A.ph == 'think' ? Math.round((performance.now() - A.thinkAt) / 1e3) : 0;
    const ph = { idle: A.mic ? A.auto ? '点「点这里说」接着聊' : '点下面「点这里说」，说完点「说完了」' : '麦克风已关', rec: A.auto ? '正在听你说… 停一下 TA 就接话' : '在听你说… 说完点「说完了」', think: `${esc(nm(c))} 正在想… <i class="xc-ts">${thinkS}s</i>`, speak: `${esc(nm(c))} 正在说 · 点屏幕可以打断`, fail: '这轮没接上，可以再说一遍' }[A.ph] || '';
    const hint = A.ph == 'think' && thinkS >= 20 ? `<p class="xc-hint">${A.raw ? '酒馆当前连接是文本补全（或酒馆版本太旧），拿不到流式，要等整段想完才开口。在 设置 → 应用配置 → 聊天 → 语音通话 里选一个「连接配置」或自己的 API，并把「低思考」打开，会快很多' : '模型想得有点久，可能开着深度思考；在 设置 → 应用配置 → 语音通话 里把「低思考」打开会快一些'}</p>` : '';
    const pill = dial ? '' : rec ? `<div class="xc-talk"><b class="xc-pill go" data-k="done">说完了</b><b class="xc-pill sub" data-k="recx">取消</b></div>`
      : A.ph == 'think' ? `<div class="xc-talk"><b class="xc-pill sub" data-k="stop">${thinkS >= 20 ? '不等了，我再说' : '打断'}</b></div>`
      : A.ph == 'speak' ? '' : `<div class="xc-talk"><b class="xc-pill ${A.mic ? '' : 'dis'}" data-k="talk">${msk('mic', 'sm')}${A.ph == 'fail' && A.lastSaid ? '再说一遍' : '点这里说'}</b>${A.ph == 'fail' && A.lastSaid ? `<b class="xc-pill sub" data-k="retry">重发刚才那句</b>` : ''}</div>`;
    el.innerHTML = `<div class="xc-bg" style="background-image:url('${esc(avOf(c))}')"></div><div class="xc-dim"></div>
<b class="xc-min" data-k="min">${msk('mini')}</b>${kind == 'video' ? `<div class="xc-me">${A.cam ? '<video autoplay muted playsinline></video>' : `<img src="${esc(avOf(me))}">`}</div>` : ''}
<div class="xc-mid"><img class="xc-av" src="${esc(avOf(c))}"><b class="xc-nm">${esc(nm(c))}</b><p class="xc-st">${dial ? '<span class="xc-dots"><i></i><i></i><i></i></span>' : `<span class="xc-tm">${mmss(A.t0 ? (now() - A.t0) / 1e3 : 0)}</span>`}</p>${dial ? '' : `<p class="xc-ph">${ph}</p>${hint}`}${cap}</div>
${A.typing ? '<div class="xc-type"><input placeholder="打字说给 TA 听" enterkeyhint="send"><b data-k="send">说</b></div>' : ''}
<div class="xc-ctl">${pill}${kind == 'video' && !dial ? '<b class="xc-sw" data-k="tov">切到语音通话</b>' : ''}<div class="xc-bts">
<b data-k="mic" class="${A.mic ? 'on' : ''}"><i class="xc-c">${msk('mic', A.mic ? '' : 'off')}</i><small>${A.mic ? '麦克风已开' : '麦克风已关'}</small></b>
<b data-k="end"><i class="xc-c red">${msk('hang')}</i><small>${dial ? '取消' : '挂断'}</small></b>
<b data-k="spk" class="${A.spk ? 'on' : ''}"><i class="xc-c">${A.spk ? SPK_ON : msk('spk-off')}</i><small>${A.spk ? '扬声器已开' : '扬声器已关'}</small></b></div>
${dial ? '' : `<div class="xc-lang"><b data-k="inl">我说 ${esc(IN.find(x => x[0] == A.inL)?.[1] || A.inL)}</b><i></i><b data-k="outl">TA 说 ${esc(outName(A.outL ?? (ch.cfg?.lang || '')))}</b><i></i><b data-k="auto">${A.auto ? '自动接话' : '点着说'}</b><i></i><b data-k="kb">${A.typing ? '收起键盘' : '⌨ 打字说'}</b></div>`}</div>`;
    if (A.cam) { const v = el.querySelector('video'); v && (v.srcObject = A.cam); }
    const tx = el.querySelector('.xc-tx'); tx && (tx.scrollTop = tx.scrollHeight);
    const ip = el.querySelector('.xc-type input'); if (ip) { ip.onkeydown = e => e.key == 'Enter' && sendTyped(); setTimeout(() => ip.focus(), 30); }
  };
  A.draw = draw;
  const tick = setInterval(() => { const t = el.querySelector('.xc-tm'); t && A.t0 && (t.textContent = mmss((now() - A.t0) / 1e3)); const m = el.querySelector('.xc-mt'); m && A.t0 && (m.textContent = mmss((now() - A.t0) / 1e3));
    if (A.ph == 'rec') dg();
    if (A.ph == 'think') { const sN = Math.round((performance.now() - A.thinkAt) / 1e3), ts = el.querySelector('.xc-ts'); ts && (ts.textContent = sN + 's'); (sN == 20) && draw(); } }, 1000); // 想到 20 秒：换上提示和「不等了」
  const sendTyped = () => { const ip = el.querySelector('.xc-type input'), v = ip?.value.trim(); if (!v) return; if (A.ph == 'think') return toast('等 TA 想好，或者先点「打断」'); ip.value = ''; stopRec(); heard(v); }; // 对方思考时不收新的话（不然会叠出两份回答）
  el.onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k;
    if (el.classList.contains('mini')) { el.classList.remove('mini'); return; }
    if (k == 'min') { el.classList.add('mini'); el.querySelector('.xc-mini')?.remove(); el.insertAdjacentHTML('beforeend', `<div class="xc-mini"><img src="${esc(avOf(c))}"><span class="xc-mt">${A.t0 ? mmss((now() - A.t0) / 1e3) : '等待接听'}</span></div>`); return; }
    if (k == 'end') return hang();
    if (k == 'mic') { A.mic = !A.mic; if (!A.mic && A.ph == 'rec') { stopRec(); A.ph = 'idle'; A.heard = ''; } return draw(); }
    if (k == 'talk') { if (!A.mic) return toast('先打开麦克风'); return listen(); }
    if (k == 'done') return finishRec();
    if (k == 'recx') { stopRec(); A.heard = ''; A.ph = 'idle'; return draw(); }
    if (k == 'stop') { interrupt(); A.ph = 'idle'; return next(); }
    if (k == 'retry') { if (A.lastSaid) { A.lines.push({ f: 'me', t: A.lastSaid }); A.log.push({ f: 'me', t: A.lastSaid }); turn(A.lastSaid); } return; }
    if (k == 'spk') { A.spk = !A.spk; A.au && (A.au.volume = A.spk ? 1 : .85); A.gain && (A.gain.gain.value = A.spk ? 1 : .85); A.ctx?.resume?.(); return draw(); }
    if (k == 'inl') return menu(IN, '我说什么语言').then(v => { if (!v) return; A.inL = S.callLang = v; save(); draw(); }); // 只影响之后的识别
    if (k == 'outl') return menu(OUT, 'TA 用什么语言回答').then(v => { if (v == null) return; A.outL = v == 'auto' ? undefined : v; draw(); toast('下一句开始生效'); }); // 本轮不变，下一轮才换
    if (k == 'kb') { A.typing = !A.typing; return draw(); }
    if (k == 'auto') { A.auto = S.callAuto = !A.auto; save(); toast(A.auto ? '自动接话：你停下来 TA 就接着说' : '点着说：点「点这里说」开始，点「说完了」才轮到 TA'); if (A.auto && A.ph == 'idle') return listen(); return draw(); }
    if (k == 'send') return sendTyped();
    if (k == 'tov') { A.cam?.getTracks().forEach(t => t.stop()); A.cam = null; A.kind = 'voice'; el.className = 'xc xc-voice in'; return draw(); }
    A.ctx?.state == 'suspended' && A.ctx.resume(); // 随便点一下也顺手把声音唤醒
    if (!k && A.ph == 'speak' && !e.target.closest('.xc-type,.xc-ctl')) { interrupt(); A.ph = 'idle'; next(); } // 对方说话时点屏幕：打断，轮到我
  };
  ui.scr.append(el); draw(); requestAnimationFrame(() => el.classList.add('in'));
  if (kind == 'video') navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' }, audio: false }).then(s => { if (CALL != A) return s.getTracks().forEach(t => t.stop()); A.cam = s; draw(); }).catch(() => { });

  // 响铃 → 过一会儿对方接起（AI 接电话不用等太久）
  A.ring = ringTone(); const pick = setTimeout(() => { if (CALL != A) return; stopRing(); A.st = 'talk'; A.t0 = +now(); draw(); noVoice() ? toast(`${nm(c)} 还没配音色，只显示字幕（聊天设置 → 专属音色）`) : prefill(); turn(null); }, 1800 + Math.random() * 1800);
  // 常驻前缀整场不变（学 StarHub 视频陪伴教程）：系统提示、人设、最近聊天在接通时算一次就冻住，每轮只换「这通电话里说过的」和「刚刚说」；前缀一样模型那边的缓存才能命中，起手快
  let SYS = null; const sysOnce = () => SYS ||= sysCtx({ n: 6, rc: 2500, wi: 2500, desc: 1500 });
  const HEAD = () => A.head ||= `【现在】${me.nick}和${rn(c)}正在打${A.kind == 'video' ? '视频' : '语音'}电话，你是${rn(c)}。\n${mp('chat.call', { 对方: rn(c), 我: me.nick })}\n${NOAI}` + (r => r ? `\n【最近的聊天】\n${r}` : '')(ch.msgs.filter(m => !/sys|pat/.test(m.t)).slice(-12).map(m => `${m.f == 'me' ? me.nick : rn(c)}: ${say(m)}`).join('\n'));

  // 垫音（StarHub 的建议）：接通时就把「嗯…」合成好，模型想超过 2.5 秒先放这一句，听起来像在想而不是断线
  function prefill() { const L = A.outL ?? (ch.cfg?.lang || ''), t = { ja: 'えーっと……', en: 'Umm… let me think.', ko: '음… 잠깐만.' }[L] || '嗯……我想想。'; A.fill = tts(t, '', c.sex, null, { c, blob: 1 }).catch(() => null); }
  function noVoice() { try { const vo = voiceOf(c); return pickVoice(c, ttsCfg(vo.pv)).from == 'none'; } catch { return false; } }
  function stopRing() { A.ring?.(); A.ring = null; }
  function stopRec() { clearTimeout(A.sil); try { A.rec?.abort(); } catch { } A.rec = null; }
  function interrupt() { A.ac?.abort(); A.ac = null; A.next = 0; A.au?.pause(); if (A.rv) { A.rv.sh = A.rv.t.length; A.rv = null; } }
  // 轮到我：自动接话就马上开麦（半双工：TA 想和说的时候麦是关着的，不会把外放的声音录进去当成我说的）
  function next() { draw(); if (A.auto && A.mic && CALL == A && (A.ph == 'idle' || A.ph == 'fail')) setTimeout(() => CALL == A && (A.ph == 'idle' || A.ph == 'fail') && listen(), 250); }
  // 字幕跟着声音一个字一个字出来（照示例）：按这句音频的时长匀速放字，外语下面的中文释义同步按比例出
  function reveal(ln, ms, wait = 0) { const t0 = performance.now() + wait, n = ln.t.length;
    const f = () => { if (A.rv != ln || CALL != A) return; const k = Math.max(0, Math.min(1, (performance.now() - t0) / Math.max(200, ms))); ln.sh = Math.max(1, Math.ceil(n * k));
      const a = el.querySelector('.xc-r'), b = el.querySelector('.xc-r2'); a && (a.textContent = ln.t.slice(0, ln.sh)); b && ln.tr && (b.textContent = ln.tr.slice(0, Math.ceil(ln.tr.length * ln.sh / Math.max(1, n))));
      k < 1 && requestAnimationFrame(f); }; requestAnimationFrame(f); }
  function hang() {
    clearTimeout(pick); clearInterval(tick); stopRing(); stopRec(); interrupt(); A.cam?.getTracks().forEach(t => t.stop()); try { A.ctx?.close(); } catch { }
    const dur = A.t0 ? Math.round((now() - A.t0) / 1e3) : 0, cancel = A.st == 'dial';
    ch.msgs.push({ f: 'me', t: 'call', kind: A.kind, c: cancel ? '已取消' : `通话时长 ${mmss(dur)}`, dur, ...(cancel && { st: 'cancel' }), ...(A.log.length && { log: A.log.slice(-40) }), ts: +now() });
    saveD(); emit('chat'); CALL = null; el.classList.remove('in'); setTimeout(() => el.remove(), 220);
  }
  A.hang = hang;
  // 点「点这里说」：开始听，话实时写在屏幕上；手机识别常常几秒没声就自己停，那就接着再开，把前面听到的拼起来；点「说完了」才发
  function listen() {
    if (CALL != A || A.ph == 'think' || A.ph == 'speak') return; A.ctx?.resume?.();
    const R = SR(); if (!R) { if (!A.typing) { A.typing = true; draw(); toast('这个浏览器不支持语音识别，可以打字说'); } return; }
    A.ph = 'rec'; A.acc = ''; A.mid = ''; A.heard = ''; A.rs = { t: performance.now(), on: 0, au: 0, snd: 0, sp: 0, res: 0, n: 0, err: '', thr: '' }; draw(); startRec();
  }
  // 麦克风诊断：识别没出字的时候，直接写出卡在哪一步（开没开起来 / 有没有声音进来 / 认没认出话 / 报了什么错）
  function diag() { const r = A.rs; if (!r || A.heard) return ''; const s = (performance.now() - r.t) / 1e3;
    if (r.thr) return `识别启动失败：${r.thr}`;
    if (r.err && /not-allowed|service-not-allowed/.test(r.err)) return '没有麦克风权限（浏览器或酒馆 App 没允许用麦克风）';
    if (r.err == 'network') return '识别服务连不上（浏览器自带识别要连谷歌的服务器）';
    if (s < 3) return r.on ? '麦克风已打开，说吧' : '正在打开麦克风…';
    if (!r.on) return '语音识别没有启动（这个环境多半不支持浏览器识别，比如 App 里的内置网页），可以点下面「打字说」';
    if (!r.au) return '识别开起来了，但麦克风没接上（可能被录屏 / 别的应用占着）';
    if (!r.snd) return `麦克风接上了，但一点声音都没收到（录屏在录麦克风时会把它占走）${r.err ? ' · ' + r.err : ''}`;
    if (!r.res) return `听到声音了，但没认出字${r.err ? '（' + r.err + '）' : ''}${r.n > 1 ? ` · 已重开 ${r.n} 次` : ''}`;
    return ''; }
  const dg = () => { const d = el.querySelector('.xc-dg'); d && (d.textContent = diag()); };
  function startRec() {
    const R = SR(); if (!R || CALL != A || A.ph != 'rec') return;
    stopRec(); const r = new R(); A.rec = r; r.lang = A.inL; r.interimResults = true; r.continuous = true; const rs = A.rs || (A.rs = { t: performance.now() }); rs.n = (rs.n || 0) + 1;
    const mark = k => () => { if (A.rec == r) { rs[k] = 1; dg(); } }; r.onstart = mark('on'); r.onaudiostart = mark('au'); r.onsoundstart = mark('snd'); r.onspeechstart = mark('sp');
    r.onresult = e => { let fin = '', mid = ''; for (const x of e.results) (x.isFinal ? (fin += x[0].transcript) : (mid += x[0].transcript)); A.acc = (A.base || '') + fin; A.mid = mid; rs.res = 1; A.heard = (A.acc + mid).trim(); const p = el.querySelector('.xc-tx .ing span'); p ? (p.textContent = A.heard) : draw(); hush(); };
    r.onerror = e => { rs.err = e.error || 'error'; dg(); if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) { A.rec = null; A.ph = 'idle'; A.typing = true; draw(); toast('没有麦克风权限，可以打字说'); } else if (e.error == 'network') { A.rec = null; A.ph = 'idle'; A.typing = true; draw(); toast('语音识别连不上网络，可以打字说'); } };
    r.onend = () => { if (A.rec != r || CALL != A) return; A.rec = null; if (A.ph != 'rec') return; A.base = (A.acc + (A.mid || '')); A.mid = ''; setTimeout(() => A.ph == 'rec' && !A.rec && startRec(), 120); }; // 没按「说完了」就自己停了：接着听
    try { r.start(); } catch (e) { rs.thr = e?.message || String(e); dg(); }
  }
  // 自动接话：每来一次识别结果就重新计时，安静 1.2 秒（一个字都没变）就当我说完了
  function hush() { clearTimeout(A.sil); if (A.auto && A.heard) A.sil = setTimeout(() => A.ph == 'rec' && CALL == A && finishRec(), SIL); }
  function finishRec() { clearTimeout(A.sil); const t = (A.heard || '').trim(); stopRec(); A.base = ''; A.heard = ''; if (!t) { A.ph = 'idle'; draw(); return toast('没听到你说话，再试一次'); } heard(t); }
  function heard(t) { stopRec(); interrupt(); A.heard = ''; A.lastSaid = t; A.log.push({ f: 'me', t }); A.lines.push({ f: 'me', t }); turn(t); }
  // 对方说：流式拿字 → 按句切 → 每句马上去合成，按顺序播
  // 对方说（照 StarHub 教程）：流式拿字 → 只放出「已经稳定」的整句（括号、引号没闭合的尾巴先留着）→ 每句合成 → 排在同一条音频时间轴上无缝播放
  // 背压：最多比正在播的领先 2 句去合成；本轮开始时把语言设置拍个快照，中途切换只影响下一轮；挂断 / 打断后，迟到的文字和音频一律丢掉
  async function turn(said) {
    if (CALL != A) return; A.ph = 'think'; A.thinkAt = performance.now(); draw();
    const ac = new AbortController(), sg = ac.signal; A.ac = ac; const t0 = performance.now(); let first = false;
    // 想超过 2.5 秒还没开口：先垫一句「嗯…」；2 分钟一个字都没来：当这轮失败
    const fillT = setTimeout(async () => { if (sg.aborted || first || !A.fill) return; const b = await A.fill; if (sg.aborted || first || !b) return; A.filling = playBlob(b, '嗯', sg); }, 2500);
    const guard = setTimeout(() => { if (!first && !sg.aborted) { ac.abort(); A.ph = 'fail'; draw(); toast('TA 那边 2 分钟没反应，可能模型卡住了'); } }, 120e3);
    const outL = A.outL ?? (ch.cfg?.lang || ''), zh = !outL || /^zh/.test(outL) && outL != 'zh-TW'; // 语言快照
    const P = HEAD() + `${(r => r ? `\n【想起来的旧事】（只当背景）\n${r}` : '')(recall(ch, said || '', 12, 400))}${A.log.length ? `\n【这通电话里说过的】\n${A.log.slice(-16).map(x => `${x.f == 'me' ? me.nick : rn(c)}：${x.t}`).join('\n')}` : ''}\n`
      + (said ? `${me.nick}刚刚说：「${said}」\n接着回 TA。` : `电话刚接通（是${me.nick}打给你的），你先开口。`)
      + (zh ? '\n只输出你要说的话，一句一行，不要括号旁白。' : `\n你说${lname(outL)}。每一句都成对输出两行，第一行 SAY: 后面是${lname(outL)}原话，第二行 ZH: 后面是这句的简体中文意思。例：\nSAY: ${outL == 'ja' ? 'もしもし、どうしたの？' : outL == 'ko' ? '여보세요, 무슨 일이야?' : 'Hey, what\'s up?'}\nZH: 喂，怎么了？\n只输出这样成对的行，不要别的。`);
    const U = []; let played = -1, done = false; // U：已稳定的句子 { t 台词, tr 释义, b 音频 }
    const synth = () => { for (let k = played + 1; k <= Math.min(U.length - 1, played + 2); k++) { const u = U[k]; if (u.b !== undefined) continue; // 只领先 2 句
      u.b = A.ttsBad ? Promise.resolve(null) : tts(u.t, '', c.sex, sg, { c, blob: 1 }).catch(e => { if (!sg.aborted && !A.ttsBad) { A.ttsBad = true; toast('语音合成不可用，只显示字幕：' + e.message); } return null; }); } };
    const pub = (t, tr = '') => { t = clean(t); if (!t || sg.aborted) return; U.push({ t, tr: clean(tr) }); synth(); kick(); };
    const P2 = zh ? zhUnits(pub) : pairUnits(pub);
    let wake = null; const kick = () => { wake?.(); wake = null; };
    const player = (async () => { // 按顺序播；下一句在这一句播放时就已经在合成
      for (let k = 0; ; k++) {
        while (k >= U.length && !done && !sg.aborted) await new Promise(r => wake = r);
        if (sg.aborted || CALL != A || k >= U.length) return;
        const u = U[k], b = await u.b; if (sg.aborted || CALL != A) return;
        first = true; await A.filling; played = k - 1; A.ph = 'speak'; const ln = { f: 'c', t: u.t, tr: u.tr, sh: 0 }; A.lines.push(ln); A.rv = ln; draw(); A.log.push({ f: 'c', t: u.t, ...(u.tr && { tr: u.tr }), ...(k == 0 && { ms: Math.round(performance.now() - t0) }) }); // 记下首声等了多久
        await playBlob(b, u.t, sg, (ms, wait) => reveal(ln, ms, wait)); ln.sh = ln.t.length; A.rv == ln && (A.rv = null); played = k; synth();
      } })();
    try {
      let last = '';
      // 打电话用轻一点的上下文（最近 6 条正文、世界书截短）：提示词短，模型起手就快
      const full = await llm(await sysOnce(), P, '通话', sg, { stream: true, fast: 1, mod: 'chat.call', onText: t => { if (sg.aborted) return; first ||= !!t; P2.feed(t.slice(last.length)); last = t; } });
      if (!sg.aborted) { const f2 = String(full || ''); f2.length > last.length && P2.feed(f2.slice(last.length)); P2.finish(); }
      done = true; kick(); await player;
    } catch (e) { done = true; kick(); clearTimeout(fillT); clearTimeout(guard); if (sg.aborted) return; A.ph = 'fail'; next(); toast('对方没听清：' + e.message); return; } // 失败就结束这一轮，不偷偷再生成一份
    clearTimeout(fillT); clearTimeout(guard); if (CALL == A && !sg.aborted) { A.ph = U.length ? 'idle' : 'fail'; next(); } // 说完了：轮到我（自动接话就直接开麦）
  }
  // 播一句：解码后排到同一个 AudioContext 的时间轴上（不每句新建播放器、不靠 setTimeout 接）；解不了码就退回 <audio>；没声音就按字数停一会儿
  async function playBlob(b, t, sg, on) {
    if (!(b instanceof Blob)) return new Promise(r => { on?.(400 + t.length * 160, 0); const tm = setTimeout(r, 400 + t.length * 160); sg.addEventListener('abort', () => (clearTimeout(tm), r()), { once: true }); });
    const X = A.ctx; if (X) try { X.state != 'running' && await Promise.race([X.resume(), new Promise(r => setTimeout(r, 300))]);
      if (X.state == 'running') { const buf = await X.decodeAudioData(await b.arrayBuffer()); if (sg.aborted) return;
        const src = X.createBufferSource(); src.buffer = buf; src.connect(A.gain); const at = Math.max(A.next || 0, X.currentTime + .05); A.next = at + buf.duration; on?.(buf.duration * 1e3, (at - X.currentTime) * 1e3);
        return new Promise(r => { const tm = setTimeout(r, (at - X.currentTime + buf.duration) * 1e3 + 1500); src.onended = () => (clearTimeout(tm), r()); sg.addEventListener('abort', () => { try { src.stop(); } catch { } r(); }, { once: true }); src.start(at); }); } } catch { }
    // 退回：用开头解锁过的那个播放器换上这句的声音（不新建，新建的会被拦）
    return new Promise(r => { const a = A.au || new Audio(), u = URL.createObjectURL(b); A.au = a; a.src = u; a.volume = A.spk ? 1 : .85; const end = () => { URL.revokeObjectURL(u); r(); };
      a.onended = a.onerror = end; a.onplaying = () => on?.(isFinite(a.duration) && a.duration > 0 ? a.duration * 1e3 : 300 + t.length * 200, 0); sg.addEventListener('abort', () => (a.pause(), end()), { once: true });
      a.play().catch(e => { if (!A.blocked) { A.blocked = 1; toast('声音被浏览器拦住了，点一下屏幕再试'); } setTimeout(end, 400 + t.length * 160); }); });
  }
  return A;
}
// 台词清理：去掉括号旁白、星号动作、包着整句的引号；字幕和合成都用这个
const clean = t => String(t || '').replace(/[（(][^（）()]*[）)]|\*[^*]*\*|【[^】]*】/g, '').replace(/^[「“"『]|[」”"』]$/g, '').trim();
// 中文：遇到 。！？… 或换行就是一句；太长（14 字以上）遇到逗号先放出去好早点开口；括号 / 引号还没闭合就不切（等它说完）
export function zhUnits(pub) { let buf = '';
  const scan = end => { let st = 0, dep = 0;
    for (let i = 0; i < buf.length; i++) { const x = buf[i];
      if ('（(「“『【*'.includes(x) && !(x == '*' && dep)) { dep++; continue; } if ('）)」”』】'.includes(x) || x == '*' && dep) { dep = Math.max(0, dep - 1); continue; }
      if (dep) continue; const stop = /[。！？!?…~～\n]/.test(x) || /[，,]/.test(x) && i - st >= 14; if (!stop) continue;
      while (i + 1 < buf.length && /[。！？!?…~～」”"』]/.test(buf[i + 1])) i++;
      pub(buf.slice(st, i + 1)); st = i + 1; }
    buf = buf.slice(st); if (end && buf.trim()) { pub(buf); buf = ''; } };
  return { feed: d => { buf += d; scan(); }, finish: () => scan(1) }; }
// 外语：一行 SAY（要念的原话）一行 ZH（只显示的中文释义），成对放出；只合成 SAY。行没写完不处理
export function pairUnits(pub) { let buf = '', say = null;
  const line = l => { l = l.trim(); if (!l) return; const m = l.match(/^(SAY|ZH)\s*[:：]\s*(.*)$/i);
    if (!m) { say != null && pub(say); say = l; return; } // 没按格式写的行：当作要说的话（宽松一点，不让整轮失败）
    if (/say/i.test(m[1])) { say != null && pub(say); say = m[2]; } else if (say != null) { pub(say, m[2]); say = null; } };
  return { feed: d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); } },
    finish: () => { line(buf); buf = ''; say != null && pub(say); say = null; } }; }
// 拨号的嘟——嘟——声（WebAudio 现做，不用文件）；返回停止函数
function ringTone() {
  try { const X = new (globalThis.AudioContext || globalThis.webkitAudioContext)(), g = X.createGain(); g.gain.value = 0; g.connect(X.destination);
    const o = X.createOscillator(); o.frequency.value = 440; o.connect(g); o.start();
    let on = true; const beat = () => { if (!on) return; const t = X.currentTime; g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0, t + 1); setTimeout(beat, 3000); }; beat();
    return () => { on = false; try { o.stop(); X.close(); } catch { } };
  } catch { return () => { }; }
}
// 聊天里那条「通话」消息（照录屏：我打的是绿色气泡「已取消 ☎」/「通话时长 00:12 ☎」）
export const callBub = (m, i) => `<span class="clb" data-a="recall" data-x="${i}">${m.f == 'me' ? `${esc(m.c)}${m.kind == 'video' ? msk('p-video', 'clb-i') : msk('tel', 'clb-i')}` : `${m.kind == 'video' ? msk('p-video', 'clb-i') : msk('tel', 'clb-i')}${esc(m.c)}`}</span>`;
export const inCall = () => CALL;
