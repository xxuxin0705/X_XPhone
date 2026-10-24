// 本地读图里的字：用开源的 Tesseract.js（Apache-2.0），在你的手机 / 电脑上本地识别，不调用任何 API。
// 第一次用时从公共 CDN 下载识别程序和中 / 英 / 韩文字库（十几 MB，之后浏览器会缓存）。
// 只能读出图上写的字（比如「收到」「我要辞职」），读不出画面意思；没字的表情读不出来就留空，可以手动起名字。
const VER = '5.1.1';
const SRC = [`https://cdn.jsdelivr.net/npm/tesseract.js@${VER}/dist/tesseract.min.js`, `https://unpkg.com/tesseract.js@${VER}/dist/tesseract.min.js`, `https://registry.npmmirror.com/tesseract.js/${VER}/files/dist/tesseract.min.js`];
let lib = null, wk = null;
const script = u => new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src: u, async: true }); s.onload = () => globalThis.Tesseract ? res() : rej(); s.onerror = () => { s.remove(); rej(); }; document.head.append(s); });
const loadLib = () => lib ||= (async () => { if (globalThis.Tesseract) return; for (const u of SRC) { try { return await script(u); } catch { } } lib = null; throw Error('识字程序下载失败（网络不通）'); })();
export const ocrHook = { read: null }; // 测试用：换成假的识字程序
async function worker(prog) {
  if (wk) return wk;
  await loadLib(); prog?.('正在下载字库（第一次会慢一点）');
  wk = await globalThis.Tesseract.createWorker(['chi_sim', 'eng', 'kor'], 1, { logger: m => m.status == 'loading language traineddata' && prog?.(`正在下载字库 ${Math.round((m.progress || 0) * 100)}%`) });
  return wk;
}
// 取图片：先直连；跨域被拦就试 TauriTavern 原生请求、酒馆 /proxy/
async function blobOf(u) {
  if (u instanceof Blob) return u;
  if (/^(data|blob):/.test(u)) return (await fetch(u)).blob();
  try { const r = await fetch(u, { referrerPolicy: 'no-referrer' }); if (r.ok) return r.blob(); } catch { }
  const tf = globalThis.__TAURI__?.http?.fetch; if (tf) try { const r = await tf(u, { method: 'GET' }); if (r.ok) return r.blob(); } catch { }
  const r = await fetch('/proxy/' + u); if (!r.ok) throw Error('图片取不到'); return r.blob();
}
// 放大 + 白底（透明背景会变成黑底，读不出字）
async function prep(b) {
  const bm = await createImageBitmap(b).catch(() => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('图片打不开')); i.src = URL.createObjectURL(b); })), k = Math.max(1, Math.min(3, 640 / Math.max(bm.width, bm.height)));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bm.width * k), height: Math.round(bm.height * k) }), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height); return c;
}
// 整理读出来的字：去掉空格和乱码，太不确定的不要
export const tidy = (t, conf = 100) => {
  t = String(t || '').replace(/\s+/g, ' ').replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '').replace(/[^\p{Script=Han}\p{Script=Hangul}A-Za-z0-9!?！？~～…。，,.、♡❤ ]/gu, '').trim();
  const han = (t.match(/[\p{Script=Han}\p{Script=Hangul}]/gu) || []).length, lat = (t.match(/[A-Za-z]/g) || []).length;
  if (!(han >= 1 && conf >= 55) && !(lat >= 3 && conf >= 70)) return '';
  return t.length > 16 ? t.slice(0, 16) + '…' : t;
};
// 读一张图里的字；读不出来返回 ''
export async function readText(u, prog) {
  if (ocrHook.read) return tidy(...await ocrHook.read(u));
  const w = await worker(prog);
  const { data } = await w.recognize(await prep(await blobOf(u)));
  return tidy(data?.text, data?.confidence ?? 0);
}
