// 小手机 · 本地语音识别的后台线程（sherpa-onnx 网页版）
// 放在后台线程里跑，认字时不卡界面。主线程把 16kHz 的声音一小段一小段送进来，这里边收边认，字变了就发回去。
// 两种识别器：
//   流式（内置中文）：边收边认，字一个一个出来
//   离线（语言包，比如日语 Moonshine）：只会整段认——说话时每攒够约 0.7 秒新的声音，就把到目前为止的整段重新认一遍当字幕
//     （认的时候新来的声音先排着，不会叠着认；手机慢就隔久一点），超过 12 秒就不再中途重认（太慢），说完再认一次整句
// 消息：主线程 → 这里：init { js, main, wasm, data, cfg, off }（程序和模型都由主线程读好交进来；cfg 是识别器配置，off 表示离线识别器）/ begin { id } / pcm { id, d } / end { id }
//       这里 → 主线程：ready / err { m } / partial { id, s } / final { id, s }
let rec = null, st = null, cur = 0, last = '', off = false, buf = [], bufN = 0, doneN = 0, gap = 11200;
const post = (t, o = {}) => postMessage({ t, ...o });
const PART = 11200, PART_MAX = 16000 * 12; // 手机慢的话：上一遍认了多久，就至少隔它的 1.5 倍再认下一遍
function whole(pad = 0) { const a = new Float32Array(bufN + pad); let o = 0; for (const b of buf) { a.set(b, o); o += b.length; } if (!pad) buf = [a]; return a; }
function offDecode(pad) { const s = rec.createStream(); s.acceptWaveform(16000, whole(pad)); rec.decode(s); const t = rec.getResult(s).text || ''; s.free?.(); return t.trim(); }
self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.t == 'init') {
      off = !!m.off;
      self.Module = {
        wasmBinary: m.wasm, // 程序本体直接交进去，不让它自己去下载
        getPreloadedPackage: () => m.data, // 模型包也直接交进去
        locateFile: p => p, print: () => { }, printErr: () => { },
        onRuntimeInitialized() { try { rec = off ? new OfflineRecognizer(m.cfg, self.Module) : createOnlineRecognizer(self.Module, m.cfg); post('ready'); } catch (x) { post('err', { m: String(x?.message || x) }); } },
      };
      importScripts(m.js); importScripts(m.main);
      return;
    }
    if (!rec) return;
    if (m.t == 'begin') { cur = m.id; last = ''; if (off) { buf = []; bufN = 0; doneN = 0; gap = PART; } else { st?.free?.(); st = rec.createStream(); } return; }
    if (m.id != cur || !off && !st) return;
    if (m.t == 'pcm') {
      if (off) { buf.push(m.d); bufN += m.d.length; if (bufN - doneN >= gap && bufN <= PART_MAX) { doneN = bufN; const t0 = performance.now(), s = offDecode(); gap = Math.max(PART, Math.round((performance.now() - t0) * 24)); if (s != last) { last = s; post('partial', { id: cur, s }); } } return; }
      st.acceptWaveform(16000, m.d);
      while (rec.isReady(st)) rec.decode(st);
      const s = rec.getResult(st).text; if (s != last) { last = s; post('partial', { id: cur, s }); }
      return;
    }
    if (m.t == 'end') { // 说完了：补一点静音把最后几个字「推」出来，再交出整句
      if (off) { const s = bufN > 1600 ? offDecode(4800) : ''; buf = []; bufN = 0; cur = 0; post('final', { id: m.id, s }); return; }
      st.acceptWaveform(16000, new Float32Array(6400)); st.inputFinished?.();
      while (rec.isReady(st)) rec.decode(st);
      const s = rec.getResult(st).text; st.free?.(); st = null; cur = 0; post('final', { id: m.id, s });
    }
  } catch (x) { post('err', { m: String(x?.message || x) }); }
};
