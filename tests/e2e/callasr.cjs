// 通话 · 本地识别（sherpa-onnx 网页版）：真的认字，不是假数据
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + (/\.(wasm|data)$/.test(f) ? '' : '; charset=utf-8'), 'content-length': b.length }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8825);
// 用 sherpa-onnx 自带的测试录音（Apache-2.0，「这是第一种第二种叫…」）当假麦克风：前面 1 秒、后面 6 秒安静，循环播放
const SAY = path.join(here, '../fixtures/asr-say.wav');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + SAY, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  // 有硅基密钥：本地认完整句，再把录音交给云端认一遍（免费），以云端为准；这里云端故意回一个不一样的，看是不是用了它
  const ASR = []; await ctx.route(/audio\/transcriptions/, async r => { ASR.push(r.request().postDataBuffer()?.length || 0); await new Promise(z => setTimeout(z, 300)); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ text: '这是第一种、第二种（云端校对版）' }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8825/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'callasr_' + n + '.png') });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.cl = await import('/apps/chat/call.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; delete core.S.callEar2; core.S.callNudge = false; core.S.callAsr = { key: 'sk-test' }; window._P = []; window._parts = [];
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); return /刚接起来/.test(JSON.stringify(o)) ? '喂？' : '嗯嗯，我听到了。'; };
    delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`);
  // 记下说话时字幕里冒出来的字（看是不是边说边出）
  await E(`setInterval(() => { const t = document.querySelector('.xc-tx .ing .xc-pt')?.textContent; t && _parts.at(-1) != t && _parts.push(t); }, 100)`);
  // 假麦克风的录音是循环放的，可能从半句开始听到：等一次从头听到的（字幕里出现过「这是第一种」）再看
  await p.waitForFunction(`_parts.some(t => /这是第一种/.test(t)) && /校对版/.test(document.querySelector('.xc-tx p.pend')?.textContent || '')`, null, { timeout: 60000 }).catch(() => { });
  // 认出来的话先放在字幕里给我看（不自己发），下面「发送」
  ok(await E(`!_P.some(x => /校对版/.test(x)) && !!document.querySelector('[data-k=psend]') && /发送/.test(document.querySelector('[data-k=psend]').textContent)`), '认完先不发：认出来的话停在字幕里给我看，下面一个「发送」');
  await E(`document.querySelector('[data-k=psend]').click()`);
  await p.waitForFunction(`_P.some(x => /校对版/.test(x))`, null, { timeout: 20000 }).catch(() => { });
  ok(/本地识别/.test(await E(`document.querySelector('.xc-lang')?.textContent || ''`)), '默认用「本地识别」');
  const parts = await E(`_parts.slice(_parts.findIndex(t => t.length < 6 && _parts.slice(_parts.indexOf(t)).some(u => /这是第一种/.test(u))))`), sent = await E(`_P.find(x => /校对版/.test(x)) || ''`); await shot('done');
  console.log('PARTS', JSON.stringify(parts)); ok(parts.length >= 3 && parts.some(t => t.length < 6) && parts.some(t => /第一种/.test(t)), '边说边出字：字幕里一点一点冒出来 ' + JSON.stringify(parts.slice(0, 6)));
  ok(/云端校对版/.test(sent) && !/audio_url/.test(sent) && ASR.length >= 1 && ASR[0] > 20000, '说完：录音再交给云端认一遍（一次请求，16k wav），以云端认的为准发给 TA（不带录音）');
  ok(/云端校对版/.test(await E(`document.querySelector('.xc-tx')?.innerText || ''`)), '字幕里是校对后的整句');
  ok(await E(`!!document.querySelector('.xc') && !/识别模型读不到|启动失败/.test(document.querySelector('.xc').textContent)`), '模型从插件文件夹读到、启动成功');
  await E(`cl.inCall()?.hang?.()`); await W(300);
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
