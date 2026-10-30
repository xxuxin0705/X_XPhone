// 全新通话：持续收音 → 自动语言识别 → 稳定台词 → 有界合成 → 音频时钟播放。
import { S, D, C, save, saveD, esc, ui, toast, avOf, meObj, nm, rn, now, llm, sysCtx, tts, emit, menu, voiceOf, ttsCfg, pickVoice } from '../../core.js';
import { regMod, mp, NOAI } from '../../mods.js';
import { lname } from './data.js';
import { recall } from './recall.js';
import { makeEar } from './ear.js';
import { prepareLocal, localReady, localSession, releaseLocal } from './local-speech.js';
import { speechParser, remainingSpeech, callContext, callHistory } from './call-flow.js';
import { inputDial, INPUT_LANGS, defaultInputs, inputName } from './call-language.js';
import { pcmSentence } from './call-audio.js';
regMod({ k: 'chat.call', app: '聊天', n: '语音通话', def: '像和熟悉的人打电话，口语、短句，一次一到三句。根据句意和当前剧情自然改变语气：开心带笑意，难过时轻柔，惊讶时有起伏，情绪不要夸张。保持角色的性格、关系、知识边界，不替用户说话，不写动作旁白。', vars: [['对方', '通话的人'], ['我', '我的网名']] });
const IC = n => new URL(`../../assets/wx/call/${n}.png`, import.meta.url).href;
const SPK_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const msk = (n, c = '') => `<i class="xc-i ${c}" style="--ci:url('${IC(n)}')"></i>`;
const mmss = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`;
const OUT = [['auto', '跟聊天设置'], ['zh', '中文'], ['en', '英语'], ['ja', '日语'], ['ko', '韩语']];
let CALL = null;
export const inCall = () => CALL;
export async function callSheet(ch) {
  if (ch.type !== 'p') return toast('暂不支持群通话');
  const kind = await menu([['video', '视频通话'], ['voice', '语音通话']]); if (kind) startCall(ch, kind);
}
export const callBub = (m, i) => `<span class="clb" data-a="recall" data-x="${i}">${m.f === 'me' ? esc(m.c) : ''}${msk(m.kind === 'video' ? 'p-video' : 'tel', 'clb-i')}${m.f !== 'me' ? esc(m.c) : ''}</span>`;
export function startCall(ch, kind = 'voice', so = {}) {
  if (CALL) { CALL.el.classList.remove('mini'); return CALL; }
  const data = D(), context = C(), chatId = context.getCurrentChatId?.() ?? context.chatId, owner = context.chatMetadata;
  const me = meObj(), A = { ch, kind, st: 'dial', ph: 'dial', t0: 0, mic: true, spk: kind === 'video', inL: INPUT_LANGS.some(x => x[0] === S.callInputLang) ? S.callInputLang : 'zh-CN', outL: ch.cfg?.lang || '', lines: [], log: [], pending: '', turn: null, ac: null, cam: null, story: !!so.story, metrics: [] };
  const el = A.el = Object.assign(document.createElement('div'), { className: `xc xc-${kind}` }); CALL = A;
  const view = Object.assign(document.createElement('div'), { className: 'xc-v' }); el.append(view);
  // 输入框常驻，字幕重画不会关闭安卓输入法；没有网页录音权限时仍可用输入法说话。
  const kb = Object.assign(document.createElement('div'), { className: 'xc-type xc-entry', hidden: true, innerHTML: '<input placeholder="说点什么…" enterkeyhint="send" autocomplete="off"><button type="button">发送</button>' }); el.append(kb);
  const input = kb.querySelector('input'); let composing = false, journal = null;
  input.oncompositionstart = () => composing = true; input.oncompositionend = () => composing = false;
  input.onkeydown = e => { if (e.key === 'Enter' && !composing) { e.preventDefault(); send(); } }; kb.querySelector('button').onclick = send;
  try { A.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); A.gain = A.ctx.createGain(); A.gain.gain.value = .85; A.gain.connect(A.ctx.destination); A.ctx.resume().catch(() => {}); } catch {}
  const live = () => CALL === A && A.st !== 'ended';
  const sameChat = () => D() === data && C().chatMetadata === owner && (C().getCurrentChatId?.() ?? C().chatId) === chatId;
  const ear = A.earObj = makeEar({ ctx: A.ctx, language: () => A.inL, local: localSession, playing: () => A.ph === 'speak', mode: () => !live() || !A.mic || A.st !== 'talk' || A.loading || !localReady(A.inL) || A.micError ? 'off' : A.ph === 'think' || A.ph === 'speak' ? 'busy' : 'listen' }, (type, value) => {
    if (!live() || !sameChat()) return;
    if (type === 'duck') { A.gain && (A.gain.gain.value = .22); return; }
    if (type === 'unduck') { volume(); return; }
    if (type === 'barge') interrupt();
    if (type === 'start') { A.settling = false; A.ph = 'rec'; A.heard = ''; draw(); }
    if (type === 'partial') { A.heard = value; const span = view.querySelector('.ing span'); if (span) span.textContent = value; else draw(); }
    if (type === 'settling') { A.settling = value; const status = view.querySelector('.xc-ph'); if (status && A.ph === 'rec') status.textContent = value ? '正在确认…' : '在听…'; }
    if (type === 'final') { A.heard = ''; heard(value.text); if (A.nextInL) { const lang = A.nextInL; A.nextInL = null; chooseLanguage(lang); } }
    if (type === 'short') { A.heard = ''; A.ph = 'idle'; draw(); }
    if (type === 'error') { A.heard = ''; A.ph = 'fail'; A.error = value.message; draw(); }
    if (type === 'level') el.style.setProperty('--xc-level', value);
  });
  function volume() { if (A.gain) A.gain.gain.value = A.spk ? 1 : .85; if (A.audio) A.audio.volume = A.spk ? 1 : .85; }
  function draw() {
    if (!live()) return;
    const dial = A.st === 'dial', status = A.loading ? `正在准备${inputName(A.inL)}识别…` : A.localError ? A.localError : dial ? '等待接听' : A.inL === 'keyboard' ? '键盘输入' : A.micError ? '麦克风不可用' : !A.mic ? '麦克风已关' : ({ idle: '在听…', rec: A.settling ? '正在确认…' : '在听…', think: `${nm(ch)} 在想…`, speak: `${nm(ch)} 正在说`, fail: A.error || '这轮没接上' })[A.ph];
    view.innerHTML = `<div class="xc-bg" style="background-image:url('${esc(avOf(ch))}')"></div><div class="xc-dim"></div><b class="xc-min" data-k="min" role="button" tabindex="0" aria-label="最小化">${msk('mini')}</b>${A.kind === 'video' ? '<div class="xc-me"><video autoplay muted playsinline></video></div>' : ''}
<div class="xc-mid"><img class="xc-av" src="${esc(avOf(ch))}"><b class="xc-nm">${esc(nm(ch))}</b><p class="xc-st">${dial ? '<span class="xc-dots"><i></i><i></i><i></i></span>' : `<span class="xc-tm">${mmss((+now() - A.t0) / 1000)}</span>`}</p><p class="xc-ph" role="status">${esc(status)}</p><div class="xc-tx" aria-live="off">${A.lines.map(x => `<p class="${x.f === 'me' ? 'me' : ''}"><small>${esc(x.f === 'me' ? me.nick : nm(ch))}</small><span>${esc(x.t)}</span>${x.tr ? `<em>${esc(x.tr)}</em>` : ''}</p>`).join('')}${A.ph === 'rec' ? `<p class="me ing"><small>${esc(me.nick)}</small><span>${esc(A.heard || '正在收音…')}</span></p>` : ''}</div></div>
<div class="xc-ctl"><div class="xc-bts"><b data-k="mic" class="${A.mic ? 'on' : ''}" role="button" tabindex="0"><i class="xc-c">${msk('mic', A.mic ? '' : 'off')}</i><small>${A.inL === 'keyboard' ? '键盘输入' : A.mic ? '麦克风已开' : '麦克风已关'}</small></b><b data-k="end" role="button" tabindex="0"><i class="xc-c red">${msk('hang')}</i><small>${dial ? '取消' : '挂断'}</small></b><b data-k="spk" class="${A.spk ? 'on' : ''}" role="button" tabindex="0"><i class="xc-c">${A.spk ? SPK_ON : msk('spk-off')}</i><small>${A.spk ? '扬声器已开' : '扬声器已关'}</small></b></div>${dial ? '' : `<div class="xc-lang"><b data-k="inl" role="button" tabindex="0" class="phone-gesture-control" data-no-swipe-back>我说 ${esc(inputName(A.inL))}</b><i></i><span>TA 说 ${esc(A.outL ? (OUT.find(x => x[0] === A.outL)?.[1] || lname(A.outL)) : '中文')}</span><i></i><span>本地识别</span><i></i><b data-k="kb" role="button" tabindex="0">⌨</b>${A.turn ? '<i></i><b data-k="stop" role="button" tabindex="0">打断</b>' : ''}</div>`}</div>`;
    if (A.cam) view.querySelector('video').srcObject = A.cam;
    const tx = view.querySelector('.xc-tx'); tx.scrollTop = tx.scrollHeight;
  }
  const favorites = () => Array.isArray(S.callInputFavs) && S.callInputFavs.length === 4 && new Set(S.callInputFavs).size === 4 && S.callInputFavs.every(l => INPUT_LANGS.some(x => x[0] === l)) ? S.callInputFavs : defaultInputs;
  function chooseLanguage(lang) {
    S.callInputLang = lang; save();
    if (ear.on) { A.nextInL = lang; toast('下一句话使用' + inputName(lang)); return; }
    A.inL = lang; A.localError = ''; ear.stop();
    if (lang === 'keyboard') { releaseLocal(); kb.hidden = false; el.classList.add('xc-with-entry'); input.focus(); A.loading = false; draw(); }
    else openMic();
  }
  const languageDial = inputDial(el, { current: () => A.nextInL || A.inL, favorites, choose: chooseLanguage, edit: async () => {
    const slot = await menu(favorites().map((l, i) => [String(i), ['↑ ', '→ ', '↓ ', '← '][i] + inputName(l)]), '常用语言'); if (slot == null || !live()) return;
    const lang = await menu(INPUT_LANGS, '输入语言'); if (!lang || !live()) return; const list = [...favorites()], index = +slot, previous = list.indexOf(lang); if (previous >= 0) list[previous] = list[index]; list[index] = lang; S.callInputFavs = list; save();
  } });
  function send() { const text = input.value.trim(); if (!text || !live() || A.st !== 'talk') return; input.value = ''; ear.reset(); if (A.turn) interrupt(); heard(text); }
  function heard(text) { if (!live() || !sameChat()) return; const x = { f: 'me', t: text }; A.lines.push(x); A.log.push(x); A.ph = 'think'; A.error = ''; saveTranscript(); draw(); run(text); }
  function interrupt() {
    const turn = A.turn; if (!turn) return;
    A.pending = (remainingSpeech(turn.units) + (turn.parser?.remainder() || '')).trim() || A.pending; // 从实际播放位置取剩余部分，不把还没响的句子记成说过。
    turn.ac.abort(); turn.wake?.(); A.turn = null; A.ac = null; A.audio?.pause(); volume();
    for (const u of turn.units) if (u.line && u.spoken < u.t.length) { u.line.t = u.t.slice(0, u.spoken) + '—'; u.line.tr = ''; }
    A.log = A.log.filter(x => x.t); saveTranscript(); A.ph = 'idle'; draw();
  }
  A.interrupt = interrupt;
  function hasVoice() { try { const vo = voiceOf(ch); return pickVoice(ch, ttsCfg(vo.pv)).from !== 'none'; } catch { return false; } }
  async function run(text, canned = '') {
    if (!live()) return;
    const turn = { ac: new AbortController(), units: [], played: 0, done: false, wake: null, pending: A.pending, out: A.outL ?? ch.cfg?.lang ?? '', metrics: { recognizedAt: performance.now() } };
    A.turn = turn; A.ac = turn.ac; const sg = turn.ac.signal;
    const valid = () => live() && sameChat() && A.turn === turn && !sg.aborted;
    const kick = () => { turn.wake?.(); turn.wake = null; };
    sg.addEventListener('abort', kick, { once: true });
    let timer; const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (valid()) { A.error = '通话请求超时'; interrupt(); A.ph = 'fail'; draw(); } }, 60000); }; arm();
    const startLine = (u, audible = true) => {
      if (!valid() || u.line) return;
      A.ph = 'speak'; if (audible) turn.metrics.firstSoundAt ??= performance.now();
      u.line = { f: 'c', t: '', tr: '' }; u.record = { f: 'c', t: '' }; A.lines.push(u.line); A.log.push(u.record); draw();
    };
    const progress = (u, fraction) => { if (!valid()) return; const spoken = Math.max(u.spoken, Math.min(u.t.length, Math.floor(u.t.length * fraction))); if (spoken > u.spoken) arm(); u.spoken = spoken; if (u.line) { u.line.t = u.t.slice(0, u.spoken); u.line.tr = fraction === 1 ? u.tr : ''; u.record.t = u.line.t; const tx = view.querySelector('.xc-tx'), row = tx?.children[A.lines.indexOf(u.line)]; if (row) { row.querySelector('span').textContent = u.line.t; if (fraction === 1 && u.tr && !row.querySelector('em')) { const tr = document.createElement('em'); tr.textContent = u.tr; row.append(tr); } tx.scrollTop = tx.scrollHeight; } } };
    function synth() {
      for (let i = turn.played; i < Math.min(turn.units.length, turn.played + 2); i++) {
        const u = turn.units[i]; if (u.task) continue;
        if (!hasVoice()) { u.task = Promise.resolve(null); continue; }
        u.chunks = []; u.task = tts(u.t, '', ch.sex, sg, { c: ch, blob: 1, lang: turn.out, emotion: u.emotion, ...(A.ctx && { onPCM: (bytes, sr) => { if (!valid()) return; arm(); turn.metrics.firstAudioAt ??= performance.now(); if (u.pcm) u.pcm.push(bytes, sr); else u.chunks.push([bytes, sr]); } }) }).then(b => { u.result = b; return b; }).catch(e => { u.failure = e; return null; });
      }
    }
    const parser = turn.parser = speechParser(u => { if (!valid()) return; if (turn.units.length >= (A.story ? 180 : 16)) throw Error('通话台词过长'); turn.metrics.firstTextAt ??= performance.now(); u.spoken = 0; turn.units.push(u); synth(); kick(); }, { pairs: !!turn.out && !/^zh/.test(turn.out), wait: () => { turn.waiting = true; } });
    const player = (async () => {
      for (let i = 0; ; i++) {
        while (valid() && i >= turn.units.length && !turn.done) await new Promise(r => turn.wake = r);
        if (!valid() || i >= turn.units.length) return;
        const u = turn.units[i];
        if (A.ctx) { u.pcm = pcmSentence(A.ctx, A.gain, sg, () => startLine(u), f => progress(u, f), u.t.length * (/^[\x00-\x7f]+$/.test(u.t) ? .065 : .16)); for (const [b, sr] of u.chunks || []) u.pcm.push(b, sr); u.chunks = []; }
        const result = await u.task; if (!valid()) return;
        if (u.failure) { u.pcm?.cancel(); throw u.failure; }
        if (result?.pcm) await u.pcm.finish();
        else if (result instanceof Blob) { u.pcm?.cancel(); await playBlob(result, u, sg, valid, startLine, progress); }
        else { u.pcm?.cancel(); startLine(u, false); progress(u, 1); } // 未设置音色：字幕直接显示，不伪造播放时长。
        if (!valid()) return;
        progress(u, 1); saveTranscript(); turn.played = i + 1; synth();
      }
    })();
    // 播放端出错必须立即取消生成，不能让队列或生成请求挂着。
    let playbackError; player.catch(e => { playbackError = e; if (valid()) { A.error = e.message; interrupt(); A.ph = 'fail'; draw(); } });
    try {
      if (canned) parser.feed(canned + '\n');
      else {
        const sys = await sysCtx({ n: S.ctxN || 15 }); if (!valid()) return;
        const role = rn(ch), P = `【现在】${me.nick}和${role}正在打${A.kind === 'video' ? '视频' : '语音'}电话。你只扮演${role}。\n${mp('chat.call', { 对方: role, 我: me.nick })}\n${NOAI}\n${callContext({ ...ch, msgs: ch.msgs.filter(m => m !== journal) }, me.nick, role, [], turn.pending)}\n【想起的旧事】\n${recall(ch, text, 16, 1000)}\n【联系人资料】${ch.sign || ''}\n以当前剧情、世界书、联系人关系为准。回应最后一条用户消息的具体问题，不要重复之前已经说过的台词，不要把剧情背景当成用户正在问的事情。用户问你在说什么时，解释你刚才的话；用户要你教语言时，接着教。只写你现在这一轮要说的话，不代替用户作答。${A.story ? '用户想听睡前故事，讲一个完整的故事，语气轻柔。' : '简短接话，一到三句，接着等用户。如果用户只是停顿，话明显还未说完、还在想下一句，整轮只输出 WAIT，不要抢话。'}\n每段台词前可以单独一行写 EMO: neutral/happy/sad/angry/surprised/fearful/disgusted 中的一种，选择符合句意的情绪，默认 neutral。不要输出动作旁白或其它标签。\n${turn.out && !/^zh/.test(turn.out) ? `用${lname(turn.out)}回答，每句严格两行：SAY: 外语原话，然后 ZH: 中文释义。释义只显示，不朗读。` : '用简体中文回答，一句一行。'}`;
        let previous = '';
        const full = await llm(sys + '\n' + P, text, '通话', sg, { history: callHistory(A.log, text), stream: true, fast: 1, mod: 'chat.call', onText: snapshot => { if (!valid()) return; arm(); if (!snapshot.startsWith(previous)) throw Error('模型改写了已发布的通话台词'); parser.feed(snapshot.slice(previous.length)); previous = snapshot; } });
        if (!valid()) return; const final = String(full || ''); if (final && !final.startsWith(previous)) throw Error('模型改写了通话台词'); if (final.length > previous.length) parser.feed(final.slice(previous.length));
      }
      parser.finish(); turn.done = true; kick(); await player;
      if (!valid()) return;
      if (!turn.units.length && !turn.waiting) throw Error('模型没有返回通话台词');
      if (!turn.waiting) A.pending = ''; A.turn = null; A.ac = null; A.ph = 'idle'; turn.metrics.finishedAt = performance.now(); A.metrics.push(turn.metrics); saveTranscript(); draw();
    } catch (e) {
      turn.done = true; kick(); if (!valid()) return;
      A.error = playbackError?.message || e.message; interrupt(); A.ph = 'fail'; toast('通话失败：' + A.error); draw();
    } finally { clearTimeout(timer); }
  }
  async function playBlob(blob, u, sg, valid, start, progress) {
    if (A.ctx) {
      await A.ctx.resume(); const b = await A.ctx.decodeAudioData(await blob.arrayBuffer()); if (!valid()) return;
      const src = A.ctx.createBufferSource(); src.buffer = b; src.connect(A.gain);
      await new Promise((resolve, reject) => { const at = A.ctx.currentTime, tick = setInterval(() => progress(u, Math.min(.99, (A.ctx.currentTime - at) / b.duration)), 40); let timer;
        const end = () => { clearTimeout(timer); clearInterval(tick); sg.removeEventListener('abort', cancel); resolve(); }, cancel = () => { try { src.stop(); } catch {} end(); };
        src.onended = end; sg.addEventListener('abort', cancel, { once: true }); timer = setTimeout(() => { src.onended = null; try { src.stop(); } catch {} clearInterval(tick); sg.removeEventListener('abort', cancel); reject(Error('音频播放超时')); }, b.duration * 1000 + 5000); src.start(); start(u); }); return;
    }
    const a = A.audio ||= new Audio(), url = URL.createObjectURL(blob); a.src = url;
    try { await new Promise((resolve, reject) => { const cleanup = () => { sg.removeEventListener('abort', cancel); a.onended = a.onerror = a.ontimeupdate = a.onplaying = null; }, cancel = () => { a.pause(); cleanup(); resolve(); };
      a.onended = () => { cleanup(); resolve(); }; a.onerror = () => { cleanup(); reject(Error('音频无法播放')); }; a.onplaying = () => start(u); a.ontimeupdate = () => progress(u, Number.isFinite(a.duration) ? a.currentTime / a.duration : 0);
      sg.addEventListener('abort', cancel, { once: true }); a.play().catch(e => { cleanup(); reject(e); }); });
    } finally { URL.revokeObjectURL(url); }
  }
  async function openMic() {
    if (!live() || !A.mic) return;
    if (A.inL === 'keyboard') { kb.hidden = false; el.classList.add('xc-with-entry'); input.focus(); draw(); return; }
    const lang = A.inL, version = A.preparing = (A.preparing || 0) + 1; A.loading = true; A.localError = ''; draw();
    try {
      await prepareLocal(lang); if (!live() || version !== A.preparing) return;
      A.loading = false; await ear.start(); if (!live() || !A.mic) ear.stop(); draw();
    } catch (e) {
      if (!live() || version !== A.preparing) return; A.loading = false;
      if (/NotAllowed|NotReadable|NotFound|Security/.test(e?.name || '')) A.micError = e.message || '麦克风不可用'; else A.localError = e.message || '本地识别不可用';
      kb.hidden = false; el.classList.add('xc-with-entry'); toast('本地识别未能启用，可以使用输入法语音输入'); draw();
    }
  }
  // 每句保存到同一条通话消息：切换剧情或页面关闭时不依赖最后一次挂断才能留下记录。
  function saveTranscript(final = false, cancel = false) {
    const dur = A.t0 ? Math.round((+now() - A.t0) / 1000) : 0;
    if (!journal) { if (!final && !sameChat()) return; journal = { f: 'me', t: 'call', ts: +now() }; ch.msgs.push(journal); }
    Object.assign(journal, { kind: A.kind, c: cancel ? '已取消' : `${A.story ? '枕边故事' : '通话时长'} ${mmss(dur)}`, dur, log: A.log.filter(x => x.t).map(x => ({ ...x })) });
    if (cancel) journal.st = 'cancel'; if (A.pending) journal.pending = A.pending; else delete journal.pending;
    if (sameChat()) { saveD(); if (final) emit('chat'); }
  }
  function hang() {
    if (!live()) return; if (source?.removeListener && types?.CHAT_CHANGED) source.removeListener(types.CHAT_CHANGED, change); const cancel = A.st === 'dial'; languageDial.destroy(); interrupt(); A.st = 'ended'; ear.stop(); clearTimeout(pick); clearInterval(tick); A.cam?.getTracks().forEach(t => t.stop()); A.ctx?.close().catch(() => {}); A.audio?.pause(); releaseLocal();
    saveTranscript(true, cancel);
    CALL = null; el.remove();
  }
  A.hang = hang;
  el.onclick = async e => {
    if (A.ctx?.state === 'suspended') A.ctx.resume().catch(() => {});
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'end') return hang();
    if (k === 'min') { el.classList.add('mini'); return; }
    if (k === 'mic') { A.mic = !A.mic; ear.stop(); A.micError = ''; A.heard = ''; if (A.ph === 'rec') A.ph = 'idle'; if (A.mic) openMic(); draw(); }
    if (k === 'spk') { A.spk = !A.spk; volume(); draw(); }
    if (k === 'stop') interrupt();
    if (k === 'kb') { kb.hidden = !kb.hidden; el.classList.toggle('xc-with-entry', !kb.hidden); if (!kb.hidden) input.focus(); }


  };
  el.onkeydown = e => { if (e.target.matches('[data-k]') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); e.target.click(); } };
  const expand = e => { if (el.classList.contains('mini')) { el.classList.remove('mini'); e.stopImmediatePropagation(); } }; el.addEventListener('click', expand, true);
  const tick = setInterval(() => { if (!sameChat()) return hang(); const time = el.querySelector('.xc-tm'); if (time && A.t0) time.textContent = mmss((+now() - A.t0) / 1000); }, 500);
  const types = context.eventTypes, source = context.eventSource, change = () => hang();
  if (types?.CHAT_CHANGED && source?.on && source?.removeListener) {
    source.on(types.CHAT_CHANGED, change);
  }
  ui.scr.append(el); draw(); requestAnimationFrame(() => el.classList.add('in')); openMic();
  if (A.kind === 'video') navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(stream => { if (!live()) return stream.getTracks().forEach(t => t.stop()); A.cam = stream; draw(); }).catch(() => { if (live()) toast('摄像头不可用'); });
  const pick = setTimeout(() => { if (!live() || !sameChat()) return; A.st = 'talk'; A.t0 = +now(); A.ph = 'idle'; draw(); const L = A.outL ?? ch.cfg?.lang;
    run('', A.story ? '想听什么故事？' : L && !/^zh/.test(L) ? `SAY: ${{ ja: 'もしもし？', ko: '여보세요?', en: 'Hello?' }[L] || 'Hello?'}\nZH: 喂？` : '喂？');
  }, 500);
  return A;
}
