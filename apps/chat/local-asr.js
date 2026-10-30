// 小手机 · 本地语音识别（学开源项目 AIRI：在浏览器里本地认字，不联网、不花钱、不要密钥）
// 程序和模型在插件的 asr/ 文件夹里（约 39MB：程序 13MB + 中文模型 26MB，第一次读要等一会儿，之后浏览器缓存）；找不到就从 GitHub 上这个分支拿。
// 模型：sherpa-onnx 小号流式中文 CTC（int8，2025-04-01）。别的语言走「语言包」（设置 → 语音识别语言包）
// 用法：await localAsr.load(进度回调) → const s = localAsr.session(onPartial) → s.feed(48k/44.1k 的声音) … → await s.end() 得到整句
const BASE = new URL('../../asr/', import.meta.url).href;
const REMOTE = ['https://raw.githubusercontent.com/xxuxin0705/X_XPhone/voice-v2/asr/']; // 插件文件夹里没有时的备用（比如用压缩包装的）
const FILES = { js: 'sherpa-onnx-asr.js', main: 'zh-main.js', wasm: 'asr.wasm', data: 'zh.data' };
const SIZE = { wasm: 13150239, data: 26355706 }; // 算进度用
// 识别器配置：流式 zipformer2 CTC（模型包里是 model.onnx + tokens.txt）；一句话最后靠补静音推出来，不用它自己判断断句
const CFG = { featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: { transducer: { encoder: '', decoder: '', joiner: '' }, paraformer: { encoder: '', decoder: '' }, zipformer2Ctc: { model: './model.onnx' }, nemoCtc: { model: '' }, toneCtc: { model: '' },
    tokens: './tokens.txt', numThreads: 1, provider: 'cpu', debug: 0, modelType: '', modelingUnit: 'cjkchar', bpeVocab: '' },
  decodingMethod: 'greedy_search', maxActivePaths: 4, enableEndpoint: 0, rule1MinTrailingSilence: 2.4, rule2MinTrailingSilence: 1.2, rule3MinUtteranceLength: 20,
  hotwordsFile: '', hotwordsScore: 1.5, ctcFstDecoderConfig: { graph: '', maxActive: 3000 }, ruleFsts: '', ruleFars: '' };
let W = null, ready = null, nid = 0;
const subs = new Map(); // 会话 id → { partial, final }

async function grab(name, kind, onP, got) {
  let last = null;
  for (const b of [BASE, ...REMOTE]) {
    try {
      const r = await fetch(b + name); if (!r.ok) throw Error('HTTP ' + r.status);
      if (kind == 'text') return await r.text();
      const total = +r.headers.get('content-length') || SIZE[name == FILES.wasm ? 'wasm' : 'data'], rd = r.body.getReader(), parts = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; got(n, total); onP?.(); }
      const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out.buffer;
    } catch (e) { last = e; }
  }
  throw Error(`识别模型读不到（${name}）：${last?.message || last}`);
}

export const localAsr = {
  get loaded() { return !!W && ready?.done; },
  // 读程序和模型、起后台线程；onP({ pct, mb }) 报进度。重复调用只读一次
  load(onP) {
    if (ready) return ready;
    const prog = { wasm: 0, data: 0 }, tot = { wasm: SIZE.wasm, data: SIZE.data }, rep = () => { const a = prog.wasm + prog.data, t = tot.wasm + tot.data; onP?.({ pct: Math.min(99, Math.round(a / t * 100)), mb: Math.round(t / 1048576) }); };
    ready = (async () => {
      const [js, main, wasm, data] = await Promise.all([grab(FILES.js, 'text'), grab(FILES.main, 'text'), grab(FILES.wasm, 'bin', rep, (n, t) => { prog.wasm = n; tot.wasm = t; }), grab(FILES.data, 'bin', rep, (n, t) => { prog.data = n; tot.data = t; })]);
      const url = s => URL.createObjectURL(new Blob([s], { type: 'text/javascript' }));
      W = new Worker(new URL('./asr-worker.js', import.meta.url));
      await new Promise((ok, no) => {
        const tm = setTimeout(() => no(Error('识别模型启动超时')), 90e3);
        W.onmessage = e => { const m = e.data;
          if (m.t == 'ready') { clearTimeout(tm); ok(); }
          else if (m.t == 'err') { clearTimeout(tm); no(Error('识别模型启动失败：' + m.m)); }
          else if (m.t == 'partial' || m.t == 'final') subs.get(m.id)?.[m.t](m.s); };
        W.onerror = e => { clearTimeout(tm); no(Error('识别线程出错：' + (e.message || e))); };
        W.postMessage({ t: 'init', js: url(js), main: url(main), wasm, data, cfg: CFG }, [wasm, data]);
      });
      ready.done = true; onP?.({ pct: 100 });
    })().catch(e => { ready = null; W?.terminate(); W = null; throw e; });
    return ready;
  },
  // 一句话：feed 送声音（任意采样率，内部降到 16kHz），end() 等整句
  session(onPartial) {
    const id = ++nid; let fin = null, carry = 0, acc = 0, accN = 0;
    const done = new Promise(r => fin = r);
    subs.set(id, { partial: s => onPartial?.(clean(s)), final: s => { subs.delete(id); fin(clean(s)); } });
    W.postMessage({ t: 'begin', id });
    return {
      feed(f, sr) { // 按块取平均降到 16kHz（滤掉高频，跟 wav 一样）；块边界的零头留到下一次
        const r = sr / 16000, out = []; for (let i = 0; i < f.length; i++) { acc += f[i]; accN++; carry += 1; if (carry >= r) { out.push(acc / accN); acc = 0; accN = 0; carry -= r; } }
        out.length && W.postMessage({ t: 'pcm', id, d: Float32Array.from(out) });
      },
      end() { W.postMessage({ t: 'end', id }); return Promise.race([done, new Promise(r => setTimeout(() => r(''), 8000))]); },
      cancel() { subs.delete(id); fin(''); },
    };
  },
};
// 模型给的英文是大写的，中英之间也没空格：英文转小写、句首大写，中英交界加个空格好读
const clean = s => String(s || '').trim().toLowerCase().replace(/([一-鿿])([a-z])/g, '$1 $2').replace(/([a-z])([一-鿿])/g, '$1 $2').replace(/^([a-z])/, c => c.toUpperCase());
