// 小手机 · 本地语音识别（学开源项目 AIRI：在浏览器里本地认字，不联网、不花钱、不要密钥）
// - 中文（内置）：插件 asr/ 文件夹里（约 39MB：程序 13MB + 小号流式中文 CTC 模型 26MB），第一次读要等一会儿，之后浏览器缓存；找不到就从 GitHub 上拿
// - 语言包（日语）：在 设置 → 语音识别语言包 下载一次（压缩后约 51MB，解开 85MB：离线识别程序 13MB + Moonshine 日语小模型 72MB），解压后存在浏览器的 IndexedDB 里，以后不用再下
//   放在 GitHub 的 asr-ja 分支（不放进插件本体，不想说日语的人不用多下）；模型包切成 20MB 一块、各自 gzip 压缩，断了重来只补没下完的那块
// 手机内存有限：同一时间只留一个识别模型，换语言时把另一个关掉
// 用法：const e = asrFor('zh-CN'); await e.load(进度回调) → const s = e.session(onPartial) → s.feed(48k/44.1k 的声音) … → await s.end() 得到整句
const BASE = new URL('../../asr/', import.meta.url).href;
const GH = 'https://raw.githubusercontent.com/xxuxin0705/X_XPhone/';
const REMOTE = [GH + 'voice-v2/asr/']; // 插件文件夹里没有时的备用（比如用压缩包装的）
// 语言包的下载地址：GitHub 原地址，连不上再走国内常用的 GitHub 加速
const PACK_SRC = [GH + 'asr-ja/', 'https://ghfast.top/' + GH + 'asr-ja/'];
const ZH_CFG = { featConfig: { sampleRate: 16000, featureDim: 80 }, // 流式 zipformer2 CTC（模型包里是 model.onnx + tokens.txt）；一句话最后靠补静音推出来，不用它自己判断断句
  modelConfig: { transducer: { encoder: '', decoder: '', joiner: '' }, paraformer: { encoder: '', decoder: '' }, zipformer2Ctc: { model: './model.onnx' }, nemoCtc: { model: '' }, toneCtc: { model: '' },
    tokens: './tokens.txt', numThreads: 1, provider: 'cpu', debug: 0, modelType: '', modelingUnit: 'cjkchar', bpeVocab: '' },
  decodingMethod: 'greedy_search', maxActivePaths: 4, enableEndpoint: 0, rule1MinTrailingSilence: 2.4, rule2MinTrailingSilence: 1.2, rule3MinUtteranceLength: 20,
  hotwordsFile: '', hotwordsScore: 1.5, ctcFstDecoderConfig: { graph: '', maxActive: 3000 }, ruleFsts: '', ruleFars: '' };
const JA_CFG = { featConfig: { sampleRate: 16000, featureDim: 80 }, modelConfig: { moonshine: { encoder: './encoder.ort', mergedDecoder: './decoder.ort' }, tokens: './tokens.txt', numThreads: 1, provider: 'cpu', debug: 0 }, decodingMethod: 'greedy_search' };
// 语言包里的文件：[名字, 解开后的大小, 压缩后的大小（有就是 名字.gz）]；大小用来算进度、检查有没有下完整
export const PACK_FILES = { ja: [['ja-main.js', 84254], ['off.wasm', 13452514, 3683789], ['ja.data.0', 20971520, 16383779], ['ja.data.1', 20971520, 12303751], ['ja.data.2', 20971520, 13561416], ['ja.data.3', 9200246, 5071984]] };
const dl = f => f[2] || f[1]; // 要下载多少
export const packMB = id => Math.round(PACK_FILES[id].reduce((a, f) => a + dl(f), 0) / 1048576);
const gunzip = async b => { if (typeof DecompressionStream == 'undefined') throw Error('浏览器太旧，解不开压缩包'); return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); };

/* ---------- 语言包存在 IndexedDB 里 ---------- */
let dbP = null;
const db = () => dbP ||= new Promise((ok, no) => { const r = indexedDB.open('xphone-asr', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => { dbP = null; no(r.error); }; });
const idb = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('f', mode), q = fn(t.objectStore('f')); t.oncomplete = () => ok(q?.result); t.onerror = t.onabort = () => no(t.error || Error('存不进浏览器（空间不够？）')); }); };
const iget = k => idb('readonly', s => s.get(k)), iput = (k, v) => idb('readwrite', s => s.put(v, k)), idel = k => idb('readwrite', s => s.delete(k));
const have = async (id, [n, size]) => (await iget(id + '/' + n))?.byteLength == size;
// 下载语言包：已经下完整的文件跳过；onP({ pct, mb })
export async function installPack(id, onP, sg) {
  const fs = PACK_FILES[id], tot = fs.reduce((a, f) => a + dl(f), 0); let done = 0; const rep = n => onP?.({ pct: Math.min(99, Math.round((done + n) / tot * 100)), mb: Math.round(tot / 1048576) });
  for (const f of fs) {
    if (await have(id, f)) { done += dl(f); rep(0); continue; }
    let last = null, buf = null;
    for (const b of PACK_SRC) { try { buf = await pull(b + id + '/' + f[0] + (f[2] ? '.gz' : ''), dl(f), rep, sg); if (f[2]) buf = await gunzip(buf); if (buf.byteLength != f[1]) throw Error('文件不完整'); break; } catch (e) { buf = null; if (sg?.aborted) throw e; last = e; } }
    if (!buf) throw Error(`语言包下不下来（${f[0]}）：${last?.message || last}。换个网络（或开加速）再点一次，下好的部分不用重下`);
    await iput(id + '/' + f[0], buf); done += dl(f); rep(0);
  }
  onP?.({ pct: 100 }); return true;
}
export const packInstalled = async id => { try { for (const f of PACK_FILES[id]) if (!await have(id, f)) return false; return true; } catch { return false; } };
export async function removePack(id) { E[id]?.unload(); for (const f of PACK_FILES[id]) await idel(id + '/' + f[0]).catch(() => { }); }

async function pull(url, size, rep, sg) {
  const r = await fetch(url, { signal: sg }); if (!r.ok) throw Error('HTTP ' + r.status);
  const total = +r.headers.get('content-length') || size, rd = r.body.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; rep?.(total ? Math.min(n, total) : n); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out.buffer;
}
async function grab(name, kind, rep) {
  let last = null;
  for (const b of [BASE, ...REMOTE]) {
    try { if (kind == 'text') { const r = await fetch(b + name); if (!r.ok) throw Error('HTTP ' + r.status); return await r.text(); } return await pull(b + name, 0, rep); } catch (e) { last = e; }
  }
  throw Error(`识别模型读不到（${name}）：${last?.message || last}`);
}

/* ---------- 识别引擎：一个语言一个，同一时间只开一个 ---------- */
const E = {};
function engine(id, o) {
  let W = null, ready = null, nid = 0; const subs = new Map(); // 会话 id → { partial, final }
  const me = {
    id, get loaded() { return !!W && !!ready?.done; },
    unload() { W?.terminate(); W = null; ready = null; for (const s of [...subs.values()]) s.final(''); subs.clear(); },
    // 读程序和模型、起后台线程；onP({ pct, mb }) 报进度。重复调用只读一次
    load(onP) {
      if (ready) return ready;
      for (const k in E) E[k] != me && E[k].unload(); // 先把别的语言的模型关掉，省内存
      const p = ready = (async () => {
        const f = await o.files(onP), url = s => URL.createObjectURL(new Blob([s], { type: 'text/javascript' }));
        if (ready != p) throw Error('换语言了');
        W = new Worker(new URL('./asr-worker.js', import.meta.url));
        await new Promise((ok, no) => {
          const tm = setTimeout(() => no(Error('识别模型启动超时')), 90e3);
          W.onmessage = e => { const m = e.data;
            if (m.t == 'ready') { clearTimeout(tm); ok(); }
            else if (m.t == 'err') { clearTimeout(tm); no(Error('识别模型启动失败：' + m.m)); }
            else if (m.t == 'partial' || m.t == 'final') subs.get(m.id)?.[m.t](m.s); };
          W.onerror = e => { clearTimeout(tm); no(Error('识别线程出错：' + (e.message || e))); };
          W.postMessage({ t: 'init', js: url(f.js), main: url(f.main), wasm: f.wasm, data: f.data, cfg: o.cfg, off: !!o.off }, [f.wasm, f.data]);
        });
        p.done = true; onP?.({ pct: 100 });
      })().catch(e => { if (ready == p) { ready = null; W?.terminate(); W = null; } throw e; });
      return p;
    },
    // 一句话：feed 送声音（任意采样率，内部降到 16kHz），end() 等整句
    session(onPartial) {
      const sid = ++nid; let fin = null, carry = 0, acc = 0, accN = 0;
      const done = new Promise(r => fin = r);
      subs.set(sid, { partial: s => onPartial?.(clean(s)), final: s => { subs.delete(sid); fin(clean(s)); } });
      W.postMessage({ t: 'begin', id: sid });
      return {
        feed(f, sr) { // 按块取平均降到 16kHz（滤掉高频，跟 wav 一样）；块边界的零头留到下一次
          const r = sr / 16000, out = []; for (let i = 0; i < f.length; i++) { acc += f[i]; accN++; carry += 1; if (carry >= r) { out.push(acc / accN); acc = 0; accN = 0; carry -= r; } }
          out.length && W?.postMessage({ t: 'pcm', id: sid, d: Float32Array.from(out) });
        },
        end() { W?.postMessage({ t: 'end', id: sid }); return Promise.race([done, new Promise(r => setTimeout(() => r(''), o.off ? 15000 : 8000))]); },
        cancel() { subs.delete(sid); fin(''); },
      };
    },
  };
  return E[id] = me;
}
// 中文：插件文件夹里的程序和模型
engine('zh', { cfg: ZH_CFG, files: async onP => {
  const prog = { wasm: 0, data: 0 }, tot = { wasm: 13150239, data: 26355706 }, rep = () => { const a = prog.wasm + prog.data, t = tot.wasm + tot.data; onP?.({ pct: Math.min(99, Math.round(a / t * 100)), mb: Math.round(t / 1048576) }); };
  const [js, main, wasm, data] = await Promise.all([grab('sherpa-onnx-asr.js', 'text'), grab('zh-main.js', 'text'), grab('asr.wasm', 'bin', n => { prog.wasm = n; rep(); }), grab('zh.data', 'bin', n => { prog.data = n; rep(); })]);
  return { js, main, wasm, data };
} });
// 日语：下载过的语言包（IndexedDB）；sherpa-onnx-asr.js 跟中文的是同一个文件
engine('ja', { cfg: JA_CFG, off: true, files: async onP => {
  if (!await packInstalled('ja')) throw Error('日语本地包还没装（设置 → 语音识别语言包）');
  onP?.({ pct: 30 }); const fs = PACK_FILES.ja, get = n => iget('ja/' + n);
  const [js, main, wasm, ...parts] = await Promise.all([grab('sherpa-onnx-asr.js', 'text'), get('ja-main.js').then(b => new TextDecoder().decode(b)), get('off.wasm'), ...fs.filter(f => /^ja\.data/.test(f[0])).map(f => get(f[0]))]);
  const data = new Uint8Array(parts.reduce((a, p) => a + p.byteLength, 0)); let o = 0; for (const p of parts) { data.set(new Uint8Array(p), o); o += p.byteLength; } onP?.({ pct: 70 });
  return { js, main, wasm, data: data.buffer };
} });
const LANG = { 'zh-CN': 'zh', 'ja-JP': 'ja' };
// 这门语言的本地识别引擎（没有就是 null）
export const asrFor = L => E[LANG[L]] || null;
export const localAsr = E.zh; // 老名字：内置中文
// 模型给的英文是大写的，中英之间也没空格：英文转小写、句首大写，中英交界加个空格好读；日语模型有时字和字之间带空格，去掉
const CJK = '\u3000-\u30ff\u3400-\u9fff\uff00-\uffef';
const clean = s => String(s || '').trim().replace(new RegExp(`(?<=[${CJK}])\\s+(?=[${CJK}])`, 'g'), '').toLowerCase().replace(/([一-鿿])([a-z])/g, '$1 $2').replace(/([a-z])([一-鿿])/g, '$1 $2').replace(/^([a-z])/, c => c.toUpperCase());
