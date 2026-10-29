// 小手机 · 语音 / 视频通话（照微信录屏的样子；流式的做法参考 StarHub 的思路）
// 低延迟：①模型用流式返回，一句话一出来就送去合成（不等整段写完）；②下一句在上一句播放时就提前合成；③对方说话时不开麦（避免把自己的声音录进去），说完马上接着听；
// ④通话就是纯聊天，不让模型同时干别的；⑤通话内容结束后存成一条「通话」消息，聊天回复时带一段摘录，私聊知道电话里聊了什么但不会塞满上下文。
// 听我说话：浏览器自带的语音识别（Web Speech，免费，不走你的 API）；用不了（没有麦克风权限 / 网络不通）就点键盘打字说。
// 对方说话：用你在设置里配的语音服务（这个人的专属音色）；没配语音就只显示字幕。
import { S, D, saveD, esc, ui, toast, avOf, meObj, nm, rn, now, llm, sysCtx, tts, emit, say, menu } from '../../core.js';
import { regMod, mp, NOAI } from '../../mods.js';
import { lname } from './data.js';
regMod({ k: 'chat.call', app: '聊天', n: '语音通话', def: '这是在打电话，不是发消息：完全口语，短句，一次只说一两句，像真人那样有停顿、会接话、会追问，可以有「嗯」「啊」「欸」这种语气词。不要动作描写、括号旁白、表情符号、星号。', vars: [['对方', '通话的人'], ['我', '我的网名']] });

const IC = n => new URL(`../../assets/wx/call/${n}.png`, import.meta.url).href;
const msk = (n, c = '') => `<i class="cl-i ${c}" style="--ci:url('${IC(n)}')"></i>`;
const SPK_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8M17.6 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
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
  const c = ch, me = meObj(), A = { ch, kind, st: 'dial', t0: 0, mic: true, spk: kind == 'video', log: [], cap: '', who: '', q: [], ac: null, rec: null, au: null, ring: null, cam: null, typing: false, ttsBad: false };
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
${dial ? '' : `<b class="cl-kb" data-k="kb">${A.typing ? '收起键盘' : '⌨ 打字说'}</b>`}</div>`;
    if (A.cam) { const v = el.querySelector('video'); v && (v.srcObject = A.cam); }
    const ip = el.querySelector('.cl-type input'); if (ip) { ip.onkeydown = e => e.key == 'Enter' && sendTyped(); setTimeout(() => ip.focus(), 30); }
  };
  A.draw = draw;
  const tick = setInterval(() => { const t = el.querySelector('.cl-tm'); t && A.t0 && (t.textContent = mmss((now() - A.t0) / 1e3)); const m = el.querySelector('.cl-mt'); m && A.t0 && (m.textContent = mmss((now() - A.t0) / 1e3)); }, 1000);
  const sendTyped = () => { const ip = el.querySelector('.cl-type input'), v = ip?.value.trim(); if (!v) return; ip.value = ''; heard(v); };
  el.onclick = e => { const k = e.target.closest('[data-k]')?.dataset.k;
    if (el.classList.contains('mini')) { el.classList.remove('mini'); return; }
    if (k == 'min') { el.classList.add('mini'); el.querySelector('.cl-mini')?.remove(); el.insertAdjacentHTML('beforeend', `<div class="cl-mini"><img src="${esc(avOf(c))}"><span class="cl-mt">${A.t0 ? mmss((now() - A.t0) / 1e3) : '等待接听'}</span></div>`); return; }
    if (k == 'end') return hang();
    if (k == 'mic') { A.mic = !A.mic; A.mic ? A.ph == 'listen' && listen() : stopRec(); return draw(); }
    if (k == 'spk') { A.spk = !A.spk; A.au && (A.au.volume = A.spk ? 1 : .6); return draw(); }
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
  function interrupt() { A.ac?.abort(); A.ac = null; A.q.length = 0; if (A.au) { A.au.pause(); A.au = null; } }
  function hang() {
    clearTimeout(pick); clearInterval(tick); stopRing(); stopRec(); interrupt(); A.cam?.getTracks().forEach(t => t.stop());
    const dur = A.t0 ? Math.round((now() - A.t0) / 1e3) : 0, cancel = A.st == 'dial';
    ch.msgs.push({ f: 'me', t: 'call', kind: A.kind, c: cancel ? '已取消' : `通话时长 ${mmss(dur)}`, dur, ...(cancel && { st: 'cancel' }), ...(A.log.length && { log: A.log.slice(-40) }), ts: +now() });
    saveD(); emit('chat'); CALL = null; el.classList.remove('in'); setTimeout(() => el.remove(), 220);
  }
  A.hang = hang;
  // 听：一次听一句，说完（停顿）就去回；没有语音识别就打开键盘
  function listen() {
    A.ph = 'listen'; A.cap = A.cap; draw(); if (!A.mic || CALL != A) return;
    const R = SR(); if (!R) { if (!A.typing) { A.typing = true; draw(); toast('这个浏览器不支持语音识别，可以打字说'); } return; }
    stopRec(); const r = new R(); A.rec = r; r.lang = S.callLang || 'zh-CN'; r.interimResults = true; r.continuous = false; let fin = '';
    r.onresult = e => { let t = ''; for (const x of e.results) { t += x[0].transcript; if (x.isFinal) fin = t; } A.who = '我'; A.cap = t; A.tr = ''; const p = el.querySelector('.cl-cap'); p ? (p.innerHTML = `<small>我</small>${esc(t)}`) : draw(); };
    r.onerror = e => { if (/not-allowed|service-not-allowed|network|audio-capture/.test(e.error)) { A.rec = null; A.typing = true; draw(); toast(e.error == 'network' ? '语音识别连不上网络，可以打字说' : '没有麦克风权限，可以打字说'); } };
    r.onend = () => { if (A.rec != r || CALL != A) return; A.rec = null; const t = (fin || '').trim(); t ? heard(t) : A.ph == 'listen' && A.mic && setTimeout(() => A.ph == 'listen' && !A.rec && listen(), 250); };
    try { r.start(); } catch { }
  }
  function heard(t) { stopRec(); interrupt(); A.log.push({ f: 'me', t }); A.who = '我'; A.cap = t; A.tr = ''; turn(t); }
  // 对方说：流式拿字 → 按句切 → 每句马上去合成，按顺序播
  async function turn(said) {
    if (CALL != A) return; A.ph = 'think'; draw();
    const ac = new AbortController(); A.ac = ac; const L = ch.cfg?.lang, zh = !L || /^zh/.test(L);
    const recent = ch.msgs.filter(m => !/sys|pat/.test(m.t)).slice(-12).map(m => `${m.f == 'me' ? me.nick : rn(c)}: ${say(m)}`).join('\n');
    const V = { 对方: rn(c), 我: me.nick };
    const P = `【现在】${me.nick}和${rn(c)}正在打${A.kind == 'video' ? '视频' : '语音'}电话，你是${rn(c)}。\n${mp('chat.call', V)}\n${NOAI}\n【最近的聊天】\n${recent || '（没有）'}\n【这通电话里说过的】\n${A.log.slice(-16).map(x => `${x.f == 'me' ? me.nick : rn(c)}：${x.t}`).join('\n') || '（刚接通）'}\n`
      + (said ? `${me.nick}刚刚说：「${said}」\n接着回 TA。` : `电话刚接通（是${me.nick}打给你的），你先开口。`)
      + (zh ? '\n只输出你要说的话，一句一行。' : `\n你说${lname(L)}。一句一行，每行格式：${lname(L)}原文 // 简体中文译文。只输出这些行。`);
    let sent = 0, said2 = [], playing = null; A.q = [];
    // 切句：中文遇到 。！？… 或换行就切；一句太长（14 字以上）遇到逗号也先切出去，好早点开口；外语一行一句
    const cut = (full, end) => { const s = full.slice(sent); let st = 0;
      for (let i = 0; i < s.length; i++) { const ch2 = s[i], stop = zh ? /[。！？!?…~～\n]/.test(ch2) || /[，,]/.test(ch2) && i - st >= 14 : ch2 == '\n';
        if (!stop) continue; while (zh && i + 1 < s.length && /[。！？!?…~～」”"]/.test(s[i + 1])) i++;
        const seg = s.slice(st, i + 1); st = i + 1; seg.trim() && enq(seg.trim()); }
      sent += st; if (end && full.slice(sent).trim()) { enq(full.slice(sent).trim()); sent = full.length; } };
    const enq = seg => { const [o, tr] = zh ? [seg, ''] : seg.split(/\s*\/\/\s*/); const t = (o || '').replace(/^[「“"]|[」”"]$/g, '').replace(/[（(][^）)]*[）)]/g, '').trim(); if (!t) return;
      const it = { t, tr: (tr || '').trim(), b: A.ttsBad ? null : tts(t, '', c.sex, ac.signal, { c, blob: 1 }).catch(e => { if (!ac.signal.aborted && !A.ttsBad) { A.ttsBad = true; toast('语音合成不可用，只显示字幕：' + e.message); } return null; }) };
      A.q.push(it); said2.push(it.t); playing ||= play(); };
    const play = async () => { while (A.q.length && CALL == A && !ac.signal.aborted) { const it = A.q.shift(); A.ph = 'speak'; A.who = nm(c); A.cap = it.t; A.tr = it.tr; draw(); A.log.push({ f: 'c', t: it.t, ...(it.tr && { tr: it.tr }) });
        const b = await it.b; if (ac.signal.aborted || CALL != A) return;
        if (b instanceof Blob) await new Promise(res => { const a = new Audio(URL.createObjectURL(b)); A.au = a; a.volume = A.spk ? 1 : .6; a.onended = a.onerror = res; a.play().catch(res); });
        else await new Promise(r => setTimeout(r, 400 + it.t.length * 160)); } // 没有声音：按字数停一会儿再说下一句
      playing = null; };
    try {
      const full = await llm(await sysCtx(), P, '通话', ac.signal, { stream: true, fast: 1, mod: 'chat.call', onText: t => cut(t) });
      cut(String(full || ''), 1);
      while (playing) await playing;
    } catch (e) { if (ac.signal.aborted) return; toast('对方没听清：' + e.message); }
    if (CALL == A && !ac.signal.aborted) listen();
  }
  return A;
}
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
