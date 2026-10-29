// 小手机 · 语音 / 视频通话（照微信录屏的样子；流式的做法参考 StarHub 的思路）
// 低延迟：①模型用流式返回，一句话一出来就送去合成（不等整段写完）；②下一句在上一句播放时就提前合成；③对方说话时不开麦（避免把自己的声音录进去），说完马上接着听；
// ④通话就是纯聊天，不让模型同时干别的；⑤通话内容结束后存成一条「通话」消息，聊天回复时带一段摘录，私聊知道电话里聊了什么但不会塞满上下文。
// 听我说话：浏览器自带的语音识别（Web Speech，免费，不走你的 API）；用不了（没有麦克风权限 / 网络不通）就点键盘打字说。
// 对方说话：用你在设置里配的语音服务（这个人的专属音色）；没配语音就只显示字幕。
import { S, D, save, saveD, esc, ui, toast, avOf, meObj, nm, rn, now, llm, sysCtx, tts, emit, say, menu } from '../../core.js';
import { regMod, mp, NOAI } from '../../mods.js';
import { lname } from './data.js';
regMod({ k: 'chat.call', app: '聊天', n: '语音通话', def: '这是在打电话，不是发消息：完全口语，短句，一次只说一两句，像真人那样有停顿、会接话、会追问，可以有「嗯」「啊」「欸」这种语气词。不要动作描写、括号旁白、表情符号、星号。', vars: [['对方', '通话的人'], ['我', '我的网名']] });

const IC = n => new URL(`../../assets/wx/call/${n}.png`, import.meta.url).href;
const msk = (n, c = '') => `<i class="cl-i ${c}" style="--ci:url('${IC(n)}')"></i>`;
const SPK_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8M17.6 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const IN = [['zh-CN', '中文'], ['en-US', '英语'], ['ja-JP', '日语'], ['ko-KR', '韩语'], ['yue-Hant-HK', '粤语']];
const OUT = [['auto', '跟聊天设置'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语']];
const outName = L => !L || L == 'zh' ? '中文' : lname(L);
const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const mmss = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`;
let CALL = null; // 同一时间只有一通电话

// 「＋」面板 → 视频通话：先选 视频通话 / 语音通话（照录屏）
export async function callSheet(ch) {
  if (ch.type != 'p') return toast('群通话还没有做');
  const k = await menu([['video', '<span class="cl-mi">' + msk('p-video') + '视频通话</span>'], ['voice', '<span class="cl-mi">' + svgTel + '语音通话</span>']]); k && startCall(ch, k);
}
const svgTel = '<svg class="cl-ms" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 3.5c.5-.3 1.2-.2 1.6.3l2 2.6c.4.5.4 1.2 0 1.7L9 9.4a12 12 0 0 0 5.6 5.6l1.3-1.2c.5-.4 1.2-.4 1.7 0l2.6 2c.5.4.6 1.1.3 1.6l-1.1 1.8c-.5.8-1.5 1.2-2.4.9C10.6 18.6 5.4 13.4 3.9 7.1c-.2-.9.1-1.9.9-2.4z"/></svg>';

export function startCall(ch, kind = 'voice') {
  if (CALL) return CALL.el.classList.remove('mini'), toast('正在通话中');
  const c = ch, me = meObj(), A = { ch, kind, st: 'dial', t0: 0, mic: true, spk: kind == 'video', log: [], cap: '', who: '', q: [], ac: null, rec: null, au: null, ring: null, cam: null, typing: false, ttsBad: false, inL: S.callLang || 'zh-CN', outL: undefined };
  // 播放用的音频时钟：在这次点击里建好（浏览器要求有用户操作才能出声），整通电话共用一个
  try { A.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); A.gain = A.ctx.createGain(); A.gain.gain.value = A.spk ? 1 : .6; A.gain.connect(A.ctx.destination); } catch { }
  const el = Object.assign(document.createElement('div'), { className: `cl cl-${kind}` }); A.el = el; CALL = A;
  const draw = () => {
    const dial = A.st == 'dial', cap = A.cap ? `<p class="cl-cap"><small>${esc(A.who)}</small>${esc(A.cap)}${A.tr ? `<em>${esc(A.tr)}</em>` : ''}</p>` : '';
    el.innerHTML = `<div class="cl-bg" style="background-image:url('${esc(avOf(c))}')"></div><div class="cl-dim"></div>
<b class="cl-min" data-k="min">${msk('mini')}</b>${kind == 'video' ? `<div class="cl-me">${A.cam ? '<video autoplay muted playsinline></video>' : `<img src="${esc(avOf(me))}">`}</div>` : ''}
<div class="cl-mid"><img class="cl-av" src="${esc(avOf(c))}"><b class="cl-nm">${esc(nm(c))}</b><p class="cl-st">${dial ? '<span class="cl-dots"><i></i><i></i><i></i></span>' : `<span class="cl-tm">${mmss(A.t0 ? (now() - A.t0) / 1e3 : 0)}</span>`}</p>${dial ? '' : `<p class="cl-ph">${{ listen: A.mic ? '在听你说…' : '麦克风已关', think: '对方正在想…', speak: '对方正在说话 · 点屏幕可以打断' }[A.ph] || ''}</p>`}${cap}</div>
${A.typing ? '<div class="cl-type"><input placeholder="打字说给 TA 听" enterkeyhint="send"><b data-k="send">说</b></div>' : ''}
<div class="cl-ctl">${kind == 'video' && !dial ? '<b class="cl-sw" data-k="tov">切到语音通话</b>' : ''}<div class="cl-bts">
<b data-k="mic" class="${A.mic ? 'on' : ''}"><i class="cl-c">${msk('mic', A.mic ? '' : 'off')}</i><small>${A.mic ? '麦克风已开' : '麦克风已关'}</small></b>
<b data-k="end"><i class="cl-c red">${msk('hang')}</i><small>${dial ? '取消' : '挂断'}</small></b>
<b data-k="spk" class="${A.spk ? 'on' : ''}"><i class="cl-c">${A.spk ? SPK_ON : msk('spk-off')}</i><small>${A.spk ? '扬声器已开' : '扬声器已关'}</small></b></div>
${dial ? '' : `<div class="cl-lang"><b data-k="inl">我说 ${esc(IN.find(x => x[0] == A.inL)?.[1] || A.inL)}</b><i></i><b data-k="outl">TA 说 ${esc(outName(A.outL ?? (ch.cfg?.lang || '')))}</b><i></i><b data-k="kb">${A.typing ? '收起键盘' : '⌨ 打字说'}</b></div>`}</div>`;
    if (A.cam) { const v = el.querySelector('video'); v && (v.srcObject = A.cam); }
    const ip = el.querySelector('.cl-type input'); if (ip) { ip.onkeydown = e => e.key == 'Enter' && sendTyped(); setTimeout(() => ip.focus(), 30); }
  };
  A.draw = draw;
  const tick = setInterval(() => { const t = el.querySelector('.cl-tm'); t && A.t0 && (t.textContent = mmss((now() - A.t0) / 1e3)); const m = el.querySelector('.cl-mt'); m && A.t0 && (m.textContent = mmss((now() - A.t0) / 1e3)); }, 1000);
  const sendTyped = () => { const ip = el.querySelector('.cl-type input'), v = ip?.value.trim(); if (!v) return; if (A.ph == 'think') return toast('等 TA 想好…'); ip.value = ''; heard(v); }; // 对方思考时不收新的话（不然会叠出两份回答）
  el.onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k;
    if (el.classList.contains('mini')) { el.classList.remove('mini'); return; }
    if (k == 'min') { el.classList.add('mini'); el.querySelector('.cl-mini')?.remove(); el.insertAdjacentHTML('beforeend', `<div class="cl-mini"><img src="${esc(avOf(c))}"><span class="cl-mt">${A.t0 ? mmss((now() - A.t0) / 1e3) : '等待接听'}</span></div>`); return; }
    if (k == 'end') return hang();
    if (k == 'mic') { A.mic = !A.mic; A.mic ? A.ph == 'listen' && listen() : stopRec(); return draw(); }
    if (k == 'spk') { A.spk = !A.spk; A.au && (A.au.volume = A.spk ? 1 : .6); A.gain && (A.gain.gain.value = A.spk ? 1 : .6); return draw(); }
    if (k == 'inl') return menu(IN, '我说什么语言').then(v => { if (!v) return; A.inL = S.callLang = v; save(); A.ph == 'listen' && listen(); draw(); }); // 只影响之后的识别
    if (k == 'outl') return menu(OUT, 'TA 用什么语言回答').then(v => { if (v == null) return; A.outL = v == 'auto' ? undefined : v; draw(); toast('下一句开始生效'); }); // 本轮不变，下一轮才换
    if (k == 'kb') { A.typing = !A.typing; return draw(); }
    if (k == 'send') return sendTyped();
    if (k == 'tov') { A.cam?.getTracks().forEach(t => t.stop()); A.cam = null; A.kind = 'voice'; el.className = 'cl cl-voice'; return draw(); }
    if (!k && A.ph == 'speak' && !e.target.closest('.cl-type,.cl-ctl')) { interrupt(); listen(); } // 对方说话时点屏幕：打断，换我说
  };
  ui.scr.append(el); draw(); requestAnimationFrame(() => el.classList.add('in'));
  if (kind == 'video') navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' }, audio: false }).then(s => { if (CALL != A) return s.getTracks().forEach(t => t.stop()); A.cam = s; draw(); }).catch(() => { });

  // 响铃 → 过一会儿对方接起（AI 接电话不用等太久）
  A.ring = ringTone(); const pick = setTimeout(() => { if (CALL != A) return; stopRing(); A.st = 'talk'; A.t0 = +now(); draw(); turn(null); }, 1800 + Math.random() * 1800);

  function stopRing() { A.ring?.(); A.ring = null; }
  function stopRec() { try { A.rec?.abort(); } catch { } A.rec = null; }
  function interrupt() { A.ac?.abort(); A.ac = null; A.next = 0; if (A.au) { A.au.pause(); A.au = null; } }
  function hang() {
    clearTimeout(pick); clearInterval(tick); stopRing(); stopRec(); interrupt(); A.cam?.getTracks().forEach(t => t.stop()); try { A.ctx?.close(); } catch { }
    const dur = A.t0 ? Math.round((now() - A.t0) / 1e3) : 0, cancel = A.st == 'dial';
    ch.msgs.push({ f: 'me', t: 'call', kind: A.kind, c: cancel ? '已取消' : `通话时长 ${mmss(dur)}`, dur, ...(cancel && { st: 'cancel' }), ...(A.log.length && { log: A.log.slice(-40) }), ts: +now() });
    saveD(); emit('chat'); CALL = null; el.classList.remove('in'); setTimeout(() => el.remove(), 220);
  }
  A.hang = hang;
  // 听：一次听一句，说完（停顿）就去回；没有语音识别就打开键盘
  function listen() {
    A.ph = 'listen'; A.cap = A.cap; draw(); if (!A.mic || CALL != A) return;
    const R = SR(); if (!R) { if (!A.typing) { A.typing = true; draw(); toast('这个浏览器不支持语音识别，可以打字说'); } return; }
    stopRec(); const r = new R(); A.rec = r; r.lang = A.inL; r.interimResults = true; r.continuous = false; let fin = '';
    r.onresult = e => { let t = ''; for (const x of e.results) { t += x[0].transcript; if (x.isFinal) fin = t; } A.who = '我'; A.cap = t; A.tr = ''; const p = el.querySelector('.cl-cap'); p ? (p.innerHTML = `<small>我</small>${esc(t)}`) : draw(); };
    r.onerror = e => { if (/not-allowed|service-not-allowed|network|audio-capture/.test(e.error)) { A.rec = null; A.typing = true; draw(); toast(e.error == 'network' ? '语音识别连不上网络，可以打字说' : '没有麦克风权限，可以打字说'); } };
    r.onend = () => { if (A.rec != r || CALL != A) return; A.rec = null; const t = (fin || '').trim(); t ? heard(t) : A.ph == 'listen' && A.mic && setTimeout(() => A.ph == 'listen' && !A.rec && listen(), 250); };
    try { r.start(); } catch { }
  }
  function heard(t) { stopRec(); interrupt(); A.log.push({ f: 'me', t }); A.who = '我'; A.cap = t; A.tr = ''; turn(t); }
  // 对方说：流式拿字 → 按句切 → 每句马上去合成，按顺序播
  // 对方说（照 StarHub 教程）：流式拿字 → 只放出「已经稳定」的整句（括号、引号没闭合的尾巴先留着）→ 每句合成 → 排在同一条音频时间轴上无缝播放
  // 背压：最多比正在播的领先 2 句去合成；本轮开始时把语言设置拍个快照，中途切换只影响下一轮；挂断 / 打断后，迟到的文字和音频一律丢掉
  async function turn(said) {
    if (CALL != A) return; A.ph = 'think'; draw();
    const ac = new AbortController(), sg = ac.signal; A.ac = ac; const t0 = performance.now();
    const outL = A.outL ?? (ch.cfg?.lang || ''), zh = !outL || /^zh/.test(outL) && outL != 'zh-TW'; // 语言快照
    const recent = ch.msgs.filter(m => !/sys|pat/.test(m.t)).slice(-12).map(m => `${m.f == 'me' ? me.nick : rn(c)}: ${say(m)}`).join('\n');
    const P = `【现在】${me.nick}和${rn(c)}正在打${A.kind == 'video' ? '视频' : '语音'}电话，你是${rn(c)}。\n${mp('chat.call', { 对方: rn(c), 我: me.nick })}\n${NOAI}\n【最近的聊天】\n${recent || '（没有）'}\n【这通电话里说过的】\n${A.log.slice(-16).map(x => `${x.f == 'me' ? me.nick : rn(c)}：${x.t}`).join('\n') || '（刚接通）'}\n`
      + (said ? `${me.nick}刚刚说：「${said}」\n接着回 TA。` : `电话刚接通（是${me.nick}打给你的），你先开口。`)
      + (zh ? '\n只输出你要说的话，一句一行，不要括号旁白。' : `\n你说${lname(outL)}。每一句成对输出两行：\nSAY: ${lname(outL)}原话\nZH: 对应的简体中文\n只输出这样的行，不要别的。`);
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
        played = k - 1; A.ph = 'speak'; A.who = nm(c); A.cap = u.t; A.tr = u.tr; draw(); A.log.push({ f: 'c', t: u.t, ...(u.tr && { tr: u.tr }), ...(k == 0 && { ms: Math.round(performance.now() - t0) }) }); // 记下首声等了多久
        await playBlob(b, u.t, sg); played = k; synth();
      } })();
    try {
      let last = '';
      const full = await llm(await sysCtx(), P, '通话', sg, { stream: true, fast: 1, mod: 'chat.call', onText: t => { if (sg.aborted) return; P2.feed(t.slice(last.length)); last = t; } });
      if (!sg.aborted) { const f2 = String(full || ''); f2.length > last.length && P2.feed(f2.slice(last.length)); P2.finish(); }
      done = true; kick(); await player;
    } catch (e) { done = true; kick(); if (sg.aborted) return; toast('对方没听清：' + e.message); } // 失败就结束这一轮，不偷偷再生成一份
    if (CALL == A && !sg.aborted) listen();
  }
  // 播一句：解码后排到同一个 AudioContext 的时间轴上（不每句新建播放器、不靠 setTimeout 接）；解不了码就退回 <audio>；没声音就按字数停一会儿
  async function playBlob(b, t, sg) {
    if (!(b instanceof Blob)) return new Promise(r => { const tm = setTimeout(r, 400 + t.length * 160); sg.addEventListener('abort', () => (clearTimeout(tm), r()), { once: true }); });
    const X = A.ctx; if (X) try { X.state == 'suspended' && await X.resume(); const buf = await X.decodeAudioData(await b.arrayBuffer());
      if (sg.aborted) return; const src = X.createBufferSource(); src.buffer = buf; src.connect(A.gain); const at = Math.max(A.next || 0, X.currentTime + .05); A.next = at + buf.duration; A.src = src;
      return new Promise(r => { src.onended = r; sg.addEventListener('abort', () => { try { src.stop(); } catch { } r(); }, { once: true }); src.start(at); }); } catch { }
    return new Promise(r => { const a = new Audio(URL.createObjectURL(b)); A.au = a; a.volume = A.spk ? 1 : .6; a.onended = a.onerror = r; sg.addEventListener('abort', () => (a.pause(), r()), { once: true }); a.play().catch(r); });
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
