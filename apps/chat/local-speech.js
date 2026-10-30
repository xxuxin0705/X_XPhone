// 免费本地流式识别：Vosk 小模型在 Worker 中运行，一次只保留一种语言，不发送录音到云端。
import { resampler } from './ear.js';
const BASE = new URL('../../assets/asr/', import.meta.url);
export const LOCAL_LANGS = [['zh-CN', '中文', 'zh', 42], ['ja-JP', '日语', 'ja', 48], ['en-US', '英语', 'en', 40]];
let runtime, model = null, language = '', preparing = null, preparingLanguage = '', rejectLoad;
function library() {
  if (globalThis.XPhoneVosk) return Promise.resolve(globalThis.XPhoneVosk);
  return runtime ||= new Promise((ok, no) => { const script = document.createElement('script'); script.src = new URL('vosk.js', BASE).href; script.onload = () => ok(globalThis.XPhoneVosk); script.onerror = () => { runtime = null; script.remove(); no(Error('本地识别程序没有加载成功')); }; document.head.append(script); });
}
export const localReady = lang => !!model?.ready && language === lang;
export function releaseLocal() { rejectLoad?.(Error('已切换识别语言')); rejectLoad = null; model?.terminate(); model = null; language = ''; preparing = null; preparingLanguage = ''; }
export async function prepareLocal(lang) {
  if (localReady(lang)) return;
  if (preparing && preparingLanguage === lang) return preparing;
  const pack = LOCAL_LANGS.find(x => x[0] === lang); if (!pack) throw Error('请先选择中文、日语或英语');
  releaseLocal(); preparingLanguage = lang;
  const load = preparing = (async () => {
    const Vosk = await library(); if (preparingLanguage !== lang) throw Error('已切换识别语言');
    const m = model = new Vosk.Model(new URL(pack[2] + '.tar.gz', BASE).href, -1);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { m.terminate(); reject(Error('本地语言模型准备超时')); }, 90000);
      const fail = error => { clearTimeout(timer); reject(error instanceof Error ? error : Error(String(error))); };
      rejectLoad = fail; m.on('load', r => { if (m !== model) return fail(Error('已切换识别语言')); clearTimeout(timer); r.result ? resolve() : fail(Error('语言模型加载失败')); }); m.on('error', r => fail(r.error || '语言模型加载失败'));
    });
    if (m !== model) throw Error('已切换识别语言'); language = lang;
  })();
  try { return await load; } finally { if (preparing === load) { preparing = null; preparingLanguage = ''; rejectLoad = null; } }
}
const clean = (text, lang) => lang === 'en-US' ? String(text || '').trim() : String(text || '').replace(/([\u3000-\u30ff\u3400-\u9fff])\s+(?=[\u3000-\u30ff\u3400-\u9fff])/g, '$1').trim();
export function localSession(lang, partial) {
  if (!localReady(lang)) throw Error('本地识别尚未准备好');
  const rec = new model.KaldiRecognizer(16000), parts = [], sep = lang === 'en-US' ? ' ' : '';
  let closed = false, ending = false, pending = [], samples = 0, down, resolve, reject, timer;
  const done = new Promise((a, b) => { resolve = a; reject = b; }); done.catch(() => {});
  rec.on('partialresult', m => { if (!closed && !ending) partial(clean([...parts, m.result.partial || ''].join(sep), lang)); });
  rec.on('result', m => {
    if (closed) return; const text = clean(m.result.text, lang); if (text) parts.push(text);
    const all = clean(parts.join(sep), lang); if (all) partial(all);
    // vendored runtime adds final=true only to retrieveFinalResult, so an older endpoint result cannot finish a newer sentence.
    if (m.final) { clearTimeout(timer); closed = true; rec.remove(); resolve(all); }
  });
  rec.on('error', m => { if (!closed) { closed = true; clearTimeout(timer); rec.remove(); reject(Error(m.error || '本地识别出错')); } });
  function flush() { if (!samples) return; const data = new Float32Array(samples); let pos = 0; for (const p of pending) { data.set(p, pos); pos += p.length; } pending = []; samples = 0; rec.acceptWaveformFloat(data, 16000); }
  return {
    feed(frame, sr) { if (closed || ending) return; down ||= resampler(sr); const p = down(frame); pending.push(p); samples += p.length; if (samples >= 1280) flush(); },
    end() { if (!closed && !ending) { ending = true; flush(); rec.retrieveFinalResult(); timer = setTimeout(() => { if (!closed) { closed = true; rec.remove(); reject(Error('本地识别没有及时结束')); } }, 30000); } return done; },
    cancel() { if (closed) return; closed = true; clearTimeout(timer); rec.remove(); resolve(''); }
  };
}
