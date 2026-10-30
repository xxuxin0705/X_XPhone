// 小手机 · 通话的「耳朵」：麦克风 → 判断有没有人在说话（VAD）→ 交给识别
// 照开源 App evolia 的 VoiceCallManager / OnlineASRProvider 拆出来（那边是原生安卓，这里用网页能做到的同样做法）：
// - 麦克风开回声消除 / 降噪 / 自动增益；噪声底自适应（安静时慢慢学环境有多吵），比它响 3.2 倍才算有人说话
// - 约 0.5 秒的「预卷」：开口前的那一小段也留着，开头几个字不会被吞
// - 安静多久算说完可以调（S.callGap，默认 1 秒）；说得长（超过 2.5 秒）再多等 0.5 秒，免得我想一下就被抢话（学 voice-call-demo 的 AdaptiveEndpoint）；不到 0.35 秒的不算（咳嗽、碰到手机）；一句最长 30 秒
// - 识别来源可以换：
//     local：本地识别（sherpa-onnx 网页版，见 local-asr.js；学 AIRI）：手机上直接认，不联网、不花钱、不要密钥，边说边出字；认出来是空的就当是噪音
//         小模型短句口语会认错字（「在干嘛呢」→「他干嘛嘛」）：有硅基密钥（o.polish() 为真）时，说完把整句录音再交给云端认一遍（免费，不到一秒），以云端为准；云端 1.5 秒没回或出错就用本地的
//     model：整段录音交给聊天模型听（Gemini 能听音频；不另外调用）
//     sf：硅基流动的免费识别模型（SenseVoiceSmall / TeleSpeechASR），「伪流式」边说边出字：
//         切片 ≥1 秒且遇到 0.2 秒的小停顿就切一段送去认，或者连着说超过 3 秒、当前这帧不响时强制切；
//         前面认出来的字当作 prompt 带上，接得上；说完把剩下的一段认完再交出整句
// - TA 想 / 说的时候也在听（插话），两段式：连着响约 0.24 秒先把 TA 的声音压低（duck），
//   连着响约 0.52 秒才真的打断（TA 在想时 0.42 秒）；中途不响了就把音量恢复（「嗯」一声不打断）
import { S, xf } from '../../core.js';

export const EAR = { END: 1.0, LONG: 2.5, LONG_ADD: .5, MIN: .35, MAX: 30, PRE: .5, DUCK: .24, CUT: .52, CUT_THINK: .42, ON: .12, SLICE_MIN: 1, SLICE_GAP: .2, SLICE_MAX: 3 };

// 硅基流动识别的配置：没单独填就用画图那里填过的硅基流动密钥，再没有就用「免费模型」里加过的硅基流动聊天配置的密钥（同一个密钥）
export const sfKey = () => S.api?.img?.cfg?.sf?.key || S.api?.chat?.list?.find(p => /api\.siliconflow\.(cn|com)/.test(p.url || '') && p.key)?.key || '';
export const asrCfg = () => { const a = S.callAsr ||= {}; return { url: (a.url || 'https://api.siliconflow.cn/v1').replace(/\/+$/, ''), key: a.key || sfKey(), model: a.model || 'FunAudioLLM/SenseVoiceSmall' }; };
export async function sfAsr(chunks, sr, prompt = '', sg) {
  const c = asrCfg(); if (!c.key) throw Error('还没填硅基流动的密钥');
  const fd = new FormData(); fd.append('file', new Blob([wavBuf(chunks, sr)], { type: 'audio/wav' }), 'say.wav'); fd.append('model', c.model); prompt && fd.append('prompt', prompt.slice(-200));
  const r = await xf(c.url + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + c.key }, body: fd, signal: sg });
  if (!r.ok) throw Error(`识别失败 HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
  const j = await r.json(); return String(j.text || '').replace(/<\|[^|]*\|>/g, '').trim(); // SenseVoice 有时带 <|zh|><|NEUTRAL|> 这种标记
}

// 降采样到 16kHz：先低通（7kHz 以上滤掉，不然会折叠进来变成杂音、糊掉辅音），再按比例取点（比例不是整数时线性插值）。
// 一次做一段，段与段之间的状态留着（滤波器的尾巴、取点的零头），所以边录边喂也接得上
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

// 听语气（学 voice-call-demo 的 ToneAccumulator）：按音量和停顿给这句话贴一两个标签，只交文字的识别方式靠它让 TA 知道语气
export function toneOf(chunks, speak, total) { let q = 0, n = 0, pk = 0; for (const c of chunks) for (let i = 0; i < c.length; i += 4) { const v = c[i]; q += v * v; n++; const a = Math.abs(v); a > pk && (pk = a); }
  const rms = n ? Math.sqrt(q / n) : 0, pause = total ? 1 - speak / total : 0, L = [];
  if (rms > 0 && rms < .025 && pk < .18) L.push('声音偏轻'); if (rms >= .075 || pk >= .65) L.push('声音比较有力'); if (pause >= .42) L.push('停顿稍多'); else if (speak / Math.max(total, .01) >= .78 && rms >= .045) L.push('说得很连贯');
  return L.slice(0, 2).join('、'); }
// o.ctx：通话的 AudioContext；o.kind()：'local' | 'model' | 'sf'；o.local(onPartial)：开一段本地识别会话（没准备好返回 null）；o.mode()：'listen'（轮到我）| 'busy'（TA 在想 / 在说，可以插话）| 'off'；o.playing()：TA 的声音正在放
// on(type, data)：start（开口了）/ level（音量 0~1）/ partial（边说边认出来的字）/ end（说完了，正在认）/ final（{ text?, chunks, sr }）/ short（太短不算）
//                 duck / unduck / barge（插话：TA 被打断，开始听我说）/ asrerr（识别出错）
export function makeEar(o, on) {
  const E = { ms: null, nodes: null, fl: .004, pre: [], buf: [], on: 0, q: 0, sp: 0, ld: 0, bl: 0, duck: 0, slice: [], parts: [], chain: null, ep: 0, sess: null, vmax: 0, at: 0, kind: '' };
  async function start() {
    if (E.ms) return;
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    // 麦克风挂在通话的时钟上（48k）；降到识别要的 16k 在 resampler() 里做。试过单独开一个 16k 的时钟让浏览器重采样：Chrome 里接上的那一路一直是静音，不用
    const X = o.ctx; if (!X) { st.getTracks().forEach(t => t.stop()); throw Error('这个浏览器没有音频时钟'); }
    E.ms = st; E.at = performance.now();
    const src = X.createMediaStreamSource(st), pr = X.createScriptProcessor(2048, 1, 1), z = X.createGain(); /* 一帧约 43 毫秒 */ z.gain.value = 0; src.connect(pr); pr.connect(z); z.connect(X.destination); // 静音接到输出，处理器才会跑
    E.nodes = { src, pr, z }; pr.onaudioprocess = e => frame(e.inputBuffer.getChannelData(0), X.sampleRate); X.resume?.();
  }
  function stop() { const n = E.nodes; if (n) { n.pr.onaudioprocess = null; n.src.disconnect(); n.pr.disconnect(); n.z.disconnect(); } E.nodes = null; E.ms?.getTracks().forEach(t => t.stop()); E.ms = null; reset(); }
  function reset() { E.sess?.cancel(); E.sess = null; E.on = 0; E.buf = []; E.slice = []; E.parts = []; E.pre = []; E.ld = 0; E.bl = 0; E.q = 0; E.sp = 0; if (E.duck) { E.duck = 0; on('unduck'); } E.ep++; }
  // 开口：预卷 + 这一帧开始记
  function begin(pre, sp, sr) { E.on = 1; E.buf = pre.slice(); E.slice = pre.slice(); E.parts = []; E.chain = Promise.resolve(); E.q = 0; E.sp = sp; E.kind = o.kind(); E.ep++; on('start');
    if (E.kind == 'local') { E.sess?.cancel(); const ep = E.ep; E.sess = o.local?.(t => ep == E.ep && t && on('partial', t)) || null; E.sess && pre.forEach(f => E.sess.feed(f, sr)); } } // 本地识别：预卷也喂进去，开头几个字不丢
  // 伪流式：送一段去认，按顺序排队；前面认出来的字当 prompt
  function sendSlice(sr) {
    const ch = E.slice, ep = E.ep; E.slice = []; if (!ch.length) return;
    E.chain = E.chain.then(async () => { if (ep != E.ep) return; try { const t = await sfAsr(ch, sr, E.parts.join('')); if (ep != E.ep) return; if (t) { E.parts.push(t); on('partial', E.parts.join('')); } } catch (e) { ep == E.ep && on('asrerr', e); } });
  }
  function end(sr) {
    const buf = E.buf.slice(0, Math.max(1, E.buf.length - Math.floor(Math.max(0, E.q - .25) / E.fr))); // 去掉末尾的静音
    const sp = E.sp, kind = E.kind; E.on = 0; E.buf = [];
    if (sp < EAR.MIN) { E.slice = []; E.ep++; return on('short'); }
    const tone = toneOf(buf, sp, buf.length * E.fr);
    if (kind == 'local' && E.sess) { const ss = E.sess, ep = E.ep; E.sess = null; on('end'); const pol = o.polish?.() ? polish(buf, sr) : Promise.resolve(''); ss.end().then(async t => { if (ep != E.ep) return; const c = t ? await pol : ''; if (ep != E.ep) return; c && c != t && on('partial', c); t ? on('final', { text: c || t, chunks: buf, sr, tone, local: t }) : on('short'); }); return; } // 认出来是空的：噪音，不算说话
    if (kind != 'sf') return on('final', { chunks: buf, sr, tone });
    on('end'); sendSlice(sr); const ep = E.ep; E.chain.then(() => ep == E.ep && on('final', { text: E.parts.join(''), chunks: buf, sr, tone }));
  }
  // 云端再认一遍（本地 + 硅基）：1.5 秒内没回就算了，用本地的
  function polish(buf, sr) { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 1500); return sfAsr(buf, sr, '', ac.signal).then(t => (clearTimeout(tm), t)).catch(() => ''); }
  function frame(d, sr) {
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; const rms = Math.sqrt(s / d.length), fr = E.fr = d.length / sr, F = sec => Math.max(1, Math.round(sec / fr)); // 连续几帧：按秒数算，麦克风采样率不同一帧的长短也不同
    E.vmax = Math.max(E.vmax, rms);
    const m = o.mode(); if (m == 'off') { if (E.on || E.bl || E.duck) reset(); return; }
    const th = Math.max(.012, E.fl * 3.2), f = d.slice(0);
    if (m == 'busy') { // 插话：门槛高一些（喇叭会漏进来一点 TA 的声音），两段式
      if (E.on) { E.on = 0; E.buf = []; E.slice = []; E.sess?.cancel(); E.sess = null; }
      const play = o.playing(), thB = play ? Math.max(.03, th * 2.5) : th;
      E.pre.push(f); E.pre.length > Math.ceil(1.2 / fr) && E.pre.shift();
      E.bl = rms > thB ? E.bl + 1 : Math.max(0, E.bl - 1);
      if (play && !E.duck && E.bl >= F(EAR.DUCK)) { E.duck = 1; on('duck'); }
      if (E.duck && E.bl == 0) { E.duck = 0; on('unduck'); }
      if (E.bl >= F(play ? EAR.CUT : EAR.CUT_THINK)) { const pre = E.pre, n = E.bl; E.pre = []; E.bl = 0; E.duck = 0; on('barge'); begin(pre, n * fr, sr); }
      return;
    }
    E.bl = 0; if (E.duck) { E.duck = 0; on('unduck'); }
    if (!E.on) { if (rms < th) E.fl = E.fl * .96 + rms * .04; E.pre.push(f); E.pre.length > Math.ceil(EAR.PRE / fr) && E.pre.shift(); E.ld = rms > th ? E.ld + 1 : 0;
      if (E.ld >= F(EAR.ON)) { const pre = E.pre; E.pre = []; begin(pre, E.ld * fr, sr); } return; } // 连着约 0.12 秒够响：开口了
    E.buf.push(f); E.slice.push(f); E.sess?.feed(f, sr); rms > th * .7 ? (E.q = 0, E.sp += fr) : (E.q += fr);
    on('level', Math.min(1, rms / (th * 4)));
    if (E.kind == 'sf') { const sl = E.slice.length * fr; if ((sl >= EAR.SLICE_MIN && E.q >= EAR.SLICE_GAP) || (sl >= EAR.SLICE_MAX && rms <= th * .7)) sendSlice(sr); }
    if (E.q >= (+S.callGap || EAR.END) + (E.sp > EAR.LONG ? EAR.LONG_ADD : 0) || E.buf.length * fr >= EAR.MAX) end(sr);
  }
  return { start, stop, reset, get on() { return !!E.on; }, get ms() { return E.ms; }, get vmax() { return E.vmax; }, set vmax(v) { E.vmax = v; }, get at() { return E.at; }, set at(v) { E.at = v; }, get E() { return E; } };
}
