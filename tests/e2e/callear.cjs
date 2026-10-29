// 通话 · 模型听：自己开麦克风、按音量判断开口 / 说完，录音跟请求一起发给模型（HEARD 一行是听到的话）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8824);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8824/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'callear_' + n + '.png') });
  // 假麦克风：一个持续的「嗡」声，音量由 window._loud 控制（0 = 安静，1 = 在说话）
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.cl = await import('/apps/chat/call.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; core.S.callEar = 'model'; window._P = []; window._loud = 0; window._gum = 0;
    navigator.mediaDevices.getUserMedia = async c => { _gum++; const X = new AudioContext(), o = X.createOscillator(), g = X.createGain(), d = X.createMediaStreamDestination(); o.frequency.value = 220; o.connect(g); g.connect(d); o.start(); g.gain.value = 0; setInterval(() => { g.gain.value = _loud * .5 + .0005; }, 20); window._mic = c; return d.stream; };
    window._mode = ''; SillyTavern.getContext().generateRaw = async o => { _P.push(o); const s = JSON.stringify(o); if (_mode == 'slow') await new Promise(r => setTimeout(r, 2500)); return /先开口/.test(s) ? '喂？' : _mode == 'long' ? 'HEARD: （笑）你猜\\n好啊，那我们先来说说今天到底发生了什么有意思的事情吧。' : /audio_url/.test(s) ? 'HEARD: 我是螃蟹\\n好，那现在开始。' : '嗯。'; };
    delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`);
  await W(6000); await shot('idle');
  ok(await E(`_gum == 1 && _mic.audio.echoCancellation === true`), '模型听：接电话时就开麦克风（开着回声消除）');
  ok(await E(`document.querySelector('.xc-ph').textContent == '在听…' && !document.querySelector('.xc-pill') && !/轮到/.test(document.querySelector('.xc').textContent)`), 'TA 说完：状态只写「在听…」，没有按钮、没有「轮到你了」');
  ok(/模型听/.test(await E(`document.querySelector('.xc-lang').textContent`)), '底部有「模型听」开关');
  // 开口说话 1.2 秒 → 停下
  await E(`_loud = 1`); await W(700); await shot('rec');
  ok(await E(`!!document.querySelector('.xc-lv') && document.querySelector('.xc-ph').textContent == '在听…'`), '一开口：字幕位置出现跟着音量跳的竖条（自动发现我在说话，不用按）');
  await W(500); await E(`_loud = 0`); await W(2500);
  const last = await E(`JSON.stringify(_P.at(-1))`);
  ok(/data:audio\/wav;base64,/.test(last) && /audio_url/.test(last) && /HEARD/.test(last), '停下 1 秒：录音（16kHz wav）跟这轮请求一起发给模型，要它先写 HEARD');
  const tx = await E(`document.querySelector('.xc-tx').innerText`);
  ok(/我是螃蟹/.test(tx) && /好，那现在开始/.test(tx) && !/HEARD/.test(tx), '字幕：我说的话（模型听到的）+ TA 的回答，不露 HEARD 标记 ' + JSON.stringify(tx).slice(0, 60));
  ok(await E(`_P.length == 2`), '只调用了一次模型（没有另外的识别调用）');
  // 很短的一下（碰到手机）不算说话
  await W(3000); const n0 = await E(`_P.length`); await E(`_loud = 1`); await W(200); await E(`_loud = 0`); await W(1800);
  ok(await E(`_P.length`) == n0, '很短的一声（不到 0.35 秒）不算说话、不发');
  ok(/认真听语气/.test(await E(`JSON.stringify(_P[1])`)) && /（笑）/.test(await E(`JSON.stringify(_P[1])`)), '提示词让模型听语气，笑、叹气写进听到的话里');
  // 点字幕里我说的那句：改字
  await E(`document.querySelector('.xc-tx p.me[data-k=fix]').click()`); await W(200);
  await E(`(() => { const i = document.querySelector('.xc-fix input'); i.value = '我是小螃蟹'; document.querySelector('.xc-fix [data-f=y]').click(); })()`); await W(200);
  ok(await E(`cl.inCall().log.some(x => x.f == 'me' && x.t == '我是小螃蟹') && /我是小螃蟹/.test(document.querySelector('.xc-tx').innerText) && !document.querySelector('.xc-fix')`), '听错了能改：点我那句、改字，通话内容跟着改');
  // TA 说话时「嗯」一声：不打断；真的开口说 1 秒以上：TA 停下听我说
  await E(`_mode = 'long'`); await E(`_loud = 1`); await W(1300); await E(`_loud = 0`);
  await p.waitForFunction(`cl.inCall().ph == 'speak'`, null, { timeout: 6000 }).catch(() => { }); await W(300);
  await E(`_loud = 1`); await W(300); await E(`_loud = 0`); await W(500);
  ok(await E(`cl.inCall().ph == 'speak'`), 'TA 说话时我「嗯」一声（0.3 秒）：不打断');
  ok(/（笑）你猜/.test(await E(`document.querySelector('.xc-tx').innerText`)), '听到的话里留着（笑）');
  const nB = await E(`_P.length`); await E(`_mode = ''; _loud = 1`); await W(1100); await shot('barge');
  ok(await E(`cl.inCall().ph == 'rec' && /—$/.test(cl.inCall().lines.findLast(x => x.f != 'me').t)`), 'TA 说话时我真的开口（1 秒）：TA 停下，字幕后面加「—」，开始听我说');
  await E(`_loud = 0`); await W(2200); ok(await E(`_P.length`) == nB + 1, '插话说完：发给 TA');
  // TA 还在想时我接着说：两段录音合起来重新发（不会把我的话截成两半）
  await W(2500); await E(`_mode = 'slow'; _loud = 1`); await W(900); await E(`_loud = 0`); await W(1500);
  const a1 = await E(`JSON.stringify(_P.at(-1)).length`); await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(1600);
  ok(await E(`JSON.stringify(_P.at(-1)).length`) > a1 + 2000 && await E(`cl.inCall().lines.filter(x => x.t == '…').length`) <= 1, 'TA 在想时我又接着说：前后两段录音合成一段重新发');
  await E(`_mode = ''`); await W(3500);
  // 安静的麦克风（被录屏占着）→ 提示
  await E(`(() => { const a = cl.inCall(); a.vmax = 0; a.earAt = performance.now() - 7e3; })()`); await W(1300);
  ok(/一点声音都没进来/.test(await E(`document.querySelector('.xc-hint')?.textContent || ''`)) || await E(`cl.inCall().vmax`) > .002, '麦克风一点声音都没有：提示可能被录屏占着');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  ok(/我是螃蟹/.test(await E(`JSON.stringify(_c.msgs.at(-1).log)`)), '挂断：通话内容里记着我说的话（模型听到的）');
  // Tauri：麦克风拿不到 → 换成输入法说；拿得到（以后 TauriTavern 加了权限）→ 直接模型听
  await E(`(() => { window.__TAURI__ = {}; window._gum0 = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); }; _mode = ''; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(await E(`!!document.querySelector('.xc-kb input') && /键盘上的🎤/.test(document.querySelector('.xc-ph').textContent) && !/模型听/.test(document.querySelector('.xc-lang').textContent)`), 'Tauri 拿不到麦克风：自动换成输入法说，并说清楚');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  await E(`navigator.mediaDevices.getUserMedia = _gum0`); await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(await E(`!document.querySelector('.xc-kb') && cl.inCall().ear == 'model' && !!cl.inCall().ms`), 'Tauri 拿得到麦克风（以后加了权限）：直接用模型听');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400); await E(`delete window.__TAURI__`);
  // wav 编码：48k → 16k，长度和头对
  ok(await E(`(() => { const u = cl.wav([new Float32Array(4800).fill(.5)], 48000), b = atob(u.split(',')[1]); return b.slice(0, 4) == 'RIFF' && b.length == 44 + 1600 * 2; })()`), 'wav：48kHz 0.1 秒 → 16kHz 1600 个采样');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
