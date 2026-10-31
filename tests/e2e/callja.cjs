// 通话 · 日语本地包：在 设置 → 语音识别语言包 里真的下载（GitHub asr-ja 分支，第一次跑会下 51MB 存到 tests/out/asr-ja/，之后用缓存）
// → 解压存进 IndexedDB → 我说日语时通话用本地日语模型认字（不走云端）→ 删除
// 想连「认得对不对」一起测：JA_WAV=一段 16kHz 单声道日语 wav（没给就只测下载 / 装好 / 模型启动 / 删除）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'), CACHE = path.join(OUT, 'asr-ja'); fs.mkdirSync(CACHE, { recursive: true });
const MIME = { '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + (/\.(wasm|data)$/.test(f) ? '' : '; charset=utf-8'), 'content-length': b.length }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8826);
// 假麦克风：前面 1 秒、后面 6 秒安静
let MIC = null;
if (process.env.JA_WAV) { const b = fs.readFileSync(process.env.JA_WAV); let o = 12, pcm = null, sr = 16000; while (o < b.length) { const id = b.toString('latin1', o, o + 4), n = b.readUInt32LE(o + 4); if (id == 'fmt ') sr = b.readUInt32LE(o + 12); if (id == 'data') pcm = b.subarray(o + 8, o + 8 + n); o += 8 + n; }
  const pad = n => Buffer.alloc(sr * 2 * n), d = Buffer.concat([pad(1), pcm, pad(6)]), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  MIC = path.join(OUT, 'ja-say.wav'); fs.writeFileSync(MIC, Buffer.concat([h, d])); }
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(MIC ? ['--use-file-for-fake-audio-capture=' + MIC] : []), '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const got = []; // 语言包从 GitHub 拿（缓存到 tests/out/asr-ja/）
  await ctx.route(/raw\.githubusercontent\.com\/xxuxin0705\/X_XPhone\/asr-ja\//, r => { const n = r.request().url().split('/asr-ja/')[1], f = path.join(CACHE, n.replace(/\//g, '_')); got.push(n);
    if (!fs.existsSync(f)) execFileSync('curl', ['-sSfL', '-o', f + '.part', r.request().url()]), fs.renameSync(f + '.part', f);
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8826/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'callja_' + n + '.png') });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.cl = await import('/apps/chat/call.js'); window.la = await import('/apps/chat/local-asr.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; core.S.callEar2 = 'local'; core.S.callLang = 'ja-JP'; core.S.callAsr = {}; core.S.callNudge = false; window._P = []; window._parts = [];
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); return /刚接起来/.test(JSON.stringify(o)) ? 'もしもし？' : 'うん、聞こえたよ。'; };
    delete window.webkitSpeechRecognition; })()`);
  // 下载
  await E(`(async () => (await import('/apps/settings/lang-packs.js')).langPage())()`); await W(500);
  ok(await E(`/下载/.test(core.top().el.textContent) && /Moonshine/.test(core.top().el.textContent)`), '语言包页：日语可以下载');
  await E(`core.top().el.querySelector('[data-a=get][data-x="ja-JP"]').click()`); await W(400);
  ok(/%/.test(await E(`core.top().el.querySelector('.lp-p')?.textContent || ''`)), '下载中：显示百分比、能取消');
  await p.waitForFunction(`/已装/.test(core.top().el.textContent)`, null, { timeout: 150000 }).catch(() => { }); await shot('installed');
  ok(await E(`/已装/.test(core.top().el.textContent) && core.S.asrPacks?.['ja-JP'] == 1`), '下载完：显示「已装」');
  ok(got.length == 6 && got.filter(n => /\.gz$/.test(n)).length == 5, '只下了语言包的 6 个文件（5 个是压缩的） ' + got.join(','));
  ok(await E(`la.packInstalled('ja')`), '解压后存进浏览器（IndexedDB），大小都对');
  // 打电话：我说日语 → 本地日语包
  await E(`(() => { core.back(); core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`);
  await E(`setInterval(() => { const t = document.querySelector('.xc-tx .ing .xc-pt')?.textContent; t && _parts.at(-1) != t && _parts.push(t); }, 100)`);
  await p.waitForFunction(`la.asrFor('ja-JP').loaded && !!document.querySelector('.xc-lang')`, null, { timeout: 60000 }).catch(() => { });
  ok(await E(`cl.inCall()?.ear == 'local' && !cl.inCall().earBack && la.asrFor('ja-JP').loaded && !la.localAsr.loaded`), '我说日语：用本地日语包（模型启动了；中文模型没开，省内存）');
  ok(/日语/.test(await E(`document.querySelector('.xc-lang')?.textContent || ''`)) && /本地识别/.test(await E(`document.querySelector('.xc-lang')?.textContent || ''`)), '底部：我说 日语 · 本地识别');
  if (MIC) {
    await p.waitForFunction(`_P.some(x => /[ぁ-んァ-ン一-龯]{4}/.test(x) && !/刚接起来/.test(x))`, null, { timeout: 60000 }).catch(() => { }); await shot('heard');
    const parts = await E(`_parts`), sent = await E(`_P.filter(x => !/刚接起来/.test(x)).at(-1) || ''`); console.log('PARTS', JSON.stringify(parts).slice(0, 400));
    ok(/[ぁ-んァ-ン]/.test(sent) && !/audio_url/.test(sent), '说完：本地认出来的日语整句当文字发给 TA');
    ok(parts.length >= 2, '说的时候字幕里先出来一部分（每隔一会儿重认一遍） n=' + parts.length);
  } else console.log('  · 没给 JA_WAV：跳过「认得对不对」');
  await E(`cl.inCall()?.hang?.()`); await W(300);
  // 删除
  await E(`(async () => (await import('/apps/settings/lang-packs.js')).langPage())()`); await W(400);
  await E(`core.top().el.querySelector('[data-a=rm][data-x="ja-JP"]').click()`); await W(800);
  ok(await E(`(async () => !(await la.packInstalled('ja')) && !core.S.asrPacks?.['ja-JP'] && /下载/.test(core.top().el.textContent))()`), '删除：浏览器里的文件删掉，又显示「下载」');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
