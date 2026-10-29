// 小手机 · 本地语音识别的后台线程（sherpa-onnx 网页版，流式中英双语）
// 放在后台线程里跑，认字时不卡界面。主线程把 16kHz 的声音一小段一小段送进来，这里边收边认，字变了就发回去。
// 消息：主线程 → 这里：init { js, main, wasm, data }（程序和模型都由主线程读好交进来）/ begin { id } / pcm { id, d } / end { id }
//       这里 → 主线程：ready / err { m } / partial { id, s } / final { id, s }
let rec = null, st = null, cur = 0, last = '';
const post = (t, o = {}) => postMessage({ t, ...o });
self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.t == 'init') {
      self.Module = {
        wasmBinary: m.wasm, // 程序本体直接交进去，不让它自己去下载
        getPreloadedPackage: () => m.data, // 模型包也直接交进去
        locateFile: p => p, print: () => { }, printErr: () => { },
        onRuntimeInitialized() { try { rec = createOnlineRecognizer(self.Module); post('ready'); } catch (x) { post('err', { m: String(x?.message || x) }); } },
      };
      importScripts(m.js); importScripts(m.main);
      return;
    }
    if (!rec) return;
    if (m.t == 'begin') { st?.free?.(); st = rec.createStream(); cur = m.id; last = ''; return; }
    if (m.id != cur || !st) return;
    if (m.t == 'pcm') {
      st.acceptWaveform(16000, m.d);
      while (rec.isReady(st)) rec.decode(st);
      const s = rec.getResult(st).text; if (s != last) { last = s; post('partial', { id: cur, s }); }
      return;
    }
    if (m.t == 'end') { // 说完了：补 0.4 秒静音把最后几个字「推」出来，再交出整句
      st.acceptWaveform(16000, new Float32Array(6400)); st.inputFinished?.();
      while (rec.isReady(st)) rec.decode(st);
      const s = rec.getResult(st).text; st.free?.(); st = null; cur = 0; post('final', { id: m.id, s });
    }
  } catch (x) { post('err', { m: String(x?.message || x) }); }
};
