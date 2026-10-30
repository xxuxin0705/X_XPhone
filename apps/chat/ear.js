// 免费本地通话收音：人声触发、预卷、语义停顿、插话；录音不发往识别服务。
import { endpointGap } from './call-flow.js';
export function resampler(sr) {
  const OUT = 16000, r = sr / OUT; if (r <= 1) return f => Float32Array.from(f);
  const N = 32, h = new Float32Array(N + 1), fc = 7000 / sr; let sum = 0; // 33 抽头的加窗 sinc 低通
  for (let i = 0; i <= N; i++) { const x = i - N / 2, v = x == 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x), w = .54 - .46 * Math.cos(2 * Math.PI * i / N); h[i] = v * w; sum += h[i]; }
  for (let i = 0; i <= N; i++) h[i] /= sum;
  let tail = new Float32Array(N), pos = 0, prev = 0; // tail：上一段最后 N 个原始采样；pos：下一个输出点在这一段里的位置（可能是 -1 到 0 之间，落在上一段最后一个点和这段第一个点之间）；prev：上一段低通后的最后一个点
  return f => {
    const x = new Float32Array(N + f.length); x.set(tail); x.set(f, N);
    const lp = new Float32Array(f.length); // 低通后的（对应 x[N..]）
    for (let i = 0; i < f.length; i++) { let a = 0; for (let k = 0; k <= N; k++) a += h[k] * x[i + N - k]; lp[i] = a; }
    const out = []; for (; pos < f.length - 1; pos += r) { const i = Math.floor(pos), t = pos - i; out.push((i < 0 ? prev : lp[i]) * (1 - t) + lp[i + 1] * t); }
    pos -= f.length; prev = lp[f.length - 1]; tail = x.subarray(x.length - N); return Float32Array.from(out);
  };
}
// 录音 → 16kHz 单声道 16 位 wav
export function wavBuf(chunks, sr) {
  const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const pcm = resampler(sr)(all), m = pcm.length, b = new ArrayBuffer(44 + m * 2), d = new DataView(b), w = (p, t) => { for (let i = 0; i < t.length; i++) d.setUint8(p + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); d.setUint32(4, 36 + m * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 16000, true); d.setUint32(28, 32000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, m * 2, true);
  for (let i = 0; i < m; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return b;
}
export function wav(chunks, sr) { const u = new Uint8Array(wavBuf(chunks, sr)); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return 'data:audio/wav;base64,' + btoa(t); }


export function makeEar(o, on) {
  let stream = null, nodes = null, closed = false, opening = null, epoch = 0, ac = null;
  let pre = [], buf = [], active = false, floor = .003, onset = 0, quiet = 0, voiced = 0, length = 0, text = '', revision = 0, recognized = -1, lastRequest = 0, recognizing = false, ducked = false, ending = false, spill = [], session = null, language = 'zh-CN', settling = false;
  const reset = () => { epoch++; session?.cancel(); session = null; settling = false; ending = false; spill = []; ac?.abort(); ac = null; active = false; pre = []; buf = []; onset = quiet = voiced = length = 0; text = ''; revision = 0; recognized = -1; recognizing = false; if (ducked) on('unduck'); ducked = false; };
  async function recognize(sr) {
    if (recognizing || !active || !buf.length) return;
    const ep = epoch, rev = revision, chunks = buf.slice(), ctrl = ac = new AbortController(); recognizing = true; lastRequest = length;
    const tm = setTimeout(() => ctrl.abort(), session ? 30000 : 8000);
    try { if (session) ending = true;
      const t = session ? await session.end() : o.recognize ? await o.recognize(chunks, sr, '', ctrl.signal, language) : (() => { throw Error('本地识别尚未准备好'); })();
      if (closed || ep !== epoch || ctrl.signal.aborted) return;
      recognized = rev; if (rev === revision || !text) { text = t; if (t) on('partial', t); }
    } catch (e) { if (!closed && ep === epoch && !ctrl.signal.aborted) { reset(); on('error', e); } else if (!closed && ep === epoch) { reset(); on('error', Error('语音识别超时')); } }
    finally { clearTimeout(tm); if (ep === epoch) { recognizing = false; ac = null; maybeEnd(sr); } }
  }
  function maybeEnd(sr) {
    if (!active || recognizing || quiet < endpointGap(text) / 1000 && length < 30) return;
    if (voiced < .28) { reset(); on('short'); return; }
    if (recognized !== revision) { recognize(sr); return; }
    const t = text, rest = spill; reset(); t ? on('final', { text: t, sr }) : on('short'); for (const f of rest) frame(f, sr);
  }
  function frame(input, sr) {
    if (closed) return;
    const mode = o.mode(); if (mode === 'off') { if (active || onset) reset(); return; }
    const f = input.slice(), dt = f.length / sr; let sum = 0; for (const v of f) sum += v * v;
    const rms = Math.sqrt(sum / f.length), threshold = Math.max(.012, floor * 3.5), playing = o.playing();
    const loud = rms > (mode === 'busy' && playing ? Math.max(.035, threshold * 2) : threshold);
    if (!active) {
      pre.push(f); if (pre.length * dt > .6) pre.shift();
      onset = loud ? onset + dt : Math.max(0, onset - dt * 2);
      if (!loud && !playing) floor = floor * .97 + rms * .03;
      if (mode === 'busy' && playing && onset > .16 && !ducked) { ducked = true; on('duck'); }
      if (!onset && ducked) { ducked = false; on('unduck'); }
      const needed = mode === 'busy' ? playing ? .38 : .22 : .09;
      if (onset >= needed) {
        const saved = pre; reset(); buf = saved; active = true; voiced = onset = needed; length = saved.length * dt; revision++;
        if (mode === 'busy') on('barge'); on('start');
        language = o.language?.() || 'zh-CN'; const ep = epoch;
        if (o.local) { session = o.local(language, t => { if (ep === epoch && active && !closed) { text = t; on('partial', t); } }); saved.forEach(f => session.feed(f, sr)); }
      }
      return;
    }
    if (ending) { spill.push(f); if (spill.length * dt > 18) { reset(); on('error', Error('识别未及时跟上，请稍停一下')); } return; }
    buf.push(f); session?.feed(f, sr); length += dt; if (loud) { voiced += dt; quiet = 0; revision++; if (settling) { settling = false; on('settling', false); } } else quiet += dt;
    on('level', Math.min(1, rms / (threshold * 4)));
    if (quiet >= .24 && !settling) { settling = true; on('settling', true); }
    // 无实时字幕能力时提早提供整段草稿；每次都包含之前的声音，允许后文修正前文。
    if (!session && voiced >= .28 && !recognizing && recognized !== revision && (quiet >= .24 || length - lastRequest >= .65)) recognize(sr);
    if (length >= 30) ending = true; maybeEnd(sr);
  }
  async function start() {
    if (stream || opening) return opening; closed = false; const ep = epoch;
    opening = (async () => {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      if (closed || ep !== epoch) { s.getTracks().forEach(t => t.stop()); return; }
      if (!o.ctx) { s.getTracks().forEach(t => t.stop()); throw Error('当前浏览器不支持音频采集'); }
      stream = s; const src = o.ctx.createMediaStreamSource(s), pr = o.ctx.createScriptProcessor(1024, 1, 1), gain = o.ctx.createGain(); gain.gain.value = 0;
      nodes = { src, pr, gain }; src.connect(pr); pr.connect(gain); gain.connect(o.ctx.destination);
      pr.onaudioprocess = e => frame(e.inputBuffer.getChannelData(0), o.ctx.sampleRate);
      await o.ctx.resume();
    })();
    try { await opening; } finally { opening = null; }
  }
  function stop() { closed = true; reset(); if (nodes) { nodes.pr.onaudioprocess = null; Object.values(nodes).forEach(n => n.disconnect()); nodes = null; } stream?.getTracks().forEach(t => t.stop()); stream = null; }
  return { start, stop, reset, frame, get ms() { return stream; }, get on() { return active; } };
}
