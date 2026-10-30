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
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; core.S.callEar2 = 'model'; core.S.callNudge = false; window._P = []; window._loud = 0; window._gum = 0;
    navigator.mediaDevices.getUserMedia = async c => { _gum++; const X = new AudioContext(), o = X.createOscillator(), g = X.createGain(), d = X.createMediaStreamDestination(); o.frequency.value = 220; o.connect(g); g.connect(d); o.start(); g.gain.value = 0; setInterval(() => { g.gain.value = _loud * .5 + .0005; }, 20); window._mic = c; return d.stream; };
    window._mode = ''; SillyTavern.getContext().generateRaw = async o => { _P.push(o); const s = JSON.stringify(o); if (_mode == 'slow') await new Promise(r => setTimeout(r, 2500)); if (_mode == 'r429' && !window._thrown) { window._thrown = 1; throw Error('HTTP 429 {"error":{"message":"您已达到请求数限制：1分钟内最多请求3次 (request id: abc)"}}'); } return /想听：/.test(s) ? '从前，森林里住着一只小狐狸。\\n它每天晚上都会抬头数星星。\\n数着数着，它就睡着了。\\n晚安，做个好梦。' : /先开口/.test(s) ? '喂？' : _mode == 'fix' && /行好累/.test(s) ? 'FIX: 心好累啊\\n怎么啦，今天很辛苦吗？' : _mode == 'bye' ? '好呀，那晚安啦。\\n[挂断]' : _mode == 'long' ? 'HEARD: （笑）你猜\\n好啊，那我们先来说说今天到底发生了什么有意思的事情吧。' : /audio_url/.test(s) ? 'HEARD: 我是螃蟹\\n好，那现在开始。' : '嗯。'; };
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
  await E(`_loud = 1`); await W(340); const dk = await E(`cl.inCall().ducked`); await E(`_loud = 0`); await W(700);
  ok(dk === true && await E(`cl.inCall().ducked`) === false && await E(`cl.inCall().ph == 'speak'`), 'TA 说话时我「嗯」一声（0.34 秒）：先把 TA 的声音压低，没接着说就恢复，不打断');
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
  await E(`(() => { const a = cl.inCall().earObj; a.vmax = 0; a.at = performance.now() - 7e3; })()`); await W(1300);
  ok(/一点声音都没进来/.test(await E(`document.querySelector('.xc-hint')?.textContent || ''`)) || await E(`cl.inCall().earObj.vmax`) > .002, '麦克风一点声音都没有：提示可能被录屏占着');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  ok(/我是螃蟹/.test(await E(`JSON.stringify(_c.msgs.at(-1).log)`)), '挂断：通话内容里记着我说的话（模型听到的）');
  // Tauri：麦克风拿不到 → 换成输入法说；拿得到（以后 TauriTavern 加了权限）→ 直接模型听
  await E(`(() => { window.__TAURI__ = {}; window._gum0 = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); }; _mode = ''; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(await E(`!!document.querySelector('.xc-kb input') && /键盘上的🎤/.test(document.querySelector('.xc-ph').textContent) && !/模型听/.test(document.querySelector('.xc-lang').textContent)`), 'Tauri 拿不到麦克风：自动换成输入法说，并说清楚');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  await E(`navigator.mediaDevices.getUserMedia = _gum0`); await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(await E(`!document.querySelector('.xc-kb') && cl.inCall().ear == 'model' && !!cl.inCall().earObj.ms`), 'Tauri 拿得到麦克风（以后加了权限）：直接用模型听');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400); await E(`delete window.__TAURI__`);
  // 硅基识别（照 evolia 的伪流式）：边说边切片送去认、字边说边出来；说完整句当文字发给 TA（不带录音）
  const ASR = []; let asrNext = null; await ctx.route(/audio\/transcriptions/, async r => { const b = r.request().postDataBuffer()?.toString('utf8') || ''; ASR.push(b); const n = ASR.length; await new Promise(z => setTimeout(z, 150)); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ text: asrNext ?? (n == 1 ? '我是' : '螃蟹') }) }); });
  await E(`(() => { core.S.callEar2 = 'sf'; core.S.callAsr = { key: 'sk-test' }; _mode = ''; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(/硅基识别/.test(await E(`document.querySelector('.xc-lang').textContent`)) && await E(`cl.inCall().ear == 'sf'`), '底部开关切到「硅基识别」');
  const n0s = await E(`_P.length`); await E(`_loud = 1`); await W(1300); await E(`_loud = 0`); await W(450); await E(`_loud = 1`); await W(300);
  const part = await E(`document.querySelector('.xc-tx .ing .xc-pt')?.textContent || ''`); await shot('sf');
  ok(part == '我是' && await E(`cl.inCall().ph == 'rec'`), '边说边出字：说到一半（停顿 0.2 秒以上）先认出前一段「' + part + '」，还在听');
  await W(700); await E(`_loud = 0`); await W(2600);
  ok(ASR.length >= 2 && /name="prompt"[\s\S]*我是/.test(ASR[1]) && /TeleSpeech|SenseVoice/.test(ASR[0]), '每段单独送去认，后一段带着前面认出来的字（prompt 续接） n=' + ASR.length);
  const lp = await E(`JSON.stringify(_P.at(-1))`);
  ok(await E(`_P.length`) == n0s + 1 && /我是螃蟹/.test(lp) && !/audio_url/.test(lp), '说完：整句「我是螃蟹」当文字发给 TA，不带录音');
  ok(/我是螃蟹/.test(await E(`document.querySelector('.xc-tx').innerText`)), '字幕里是认出来的整句');
  // 停顿一下又接着说：并成一句，只发一次请求（省次数）
  asrNext = '好累'; await W(2500); const m0 = await E(`_P.length`);
  await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(1300); await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(3200);
  ok(await E(`_P.length`) == m0 + 1 && /好累，好累/.test(await E(`JSON.stringify(_P.at(-1))`)), '停顿一下又接着说：两段并成一句，只发了一次请求');
  // 识别认错了字（行好累 → 心好累）：模型按上下文改，第一行写 FIX，字幕和通话内容跟着改；同一次请求，不多花
  asrNext = '行好累啊'; await E(`_mode = 'fix'`); await W(2500); await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(3800);
  ok(/同音字/.test(await E(`JSON.stringify(_P.at(-1))`)) && /心好累啊/.test(await E(`document.querySelector('.xc-tx').innerText`)) && !/行好累啊|FIX/.test(await E(`document.querySelector('.xc-tx').innerText`)) && await E(`cl.inCall().log.some(x => x.t == '心好累啊')`), '「行好累啊」→ 模型按上下文改成「心好累啊」，字幕和记录都改了');
  // 中转站限流（429 / 1 分钟内最多请求 3 次）：记住限额、排队自动重发，不算失败，不把一长串报错甩到屏幕上
  asrNext = '在吗'; await E(`_mode = 'r429'; window._thrown = 0`); await W(2500); await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(3500);
  ok(await E(`core.S.callRpm == 3 && cl.inCall().ph != 'fail' && !/request id|\\{/.test(document.querySelector('.xc').innerText)`) && /排队中|在想|正在说|在听/.test(await E(`document.querySelector('.xc-ph').textContent`)), '429：记住每分钟 3 次，排队自动重发（不算失败）：' + await E(`document.querySelector('.xc-ph').textContent`));
  await E(`_mode = ''; core.S.callRpm = 0`); asrNext = null;
  await E(`cl.inCall()?.hang?.()`); await W(400);
  // 枕边故事：「＋」里点开 → TA 问想听什么（不调用模型）→ 我说一句 → 一次请求讲完，一句一句慢慢念；讲的时候不追问
  asrNext = '讲个小狐狸的故事'; await E(`(() => { core.S.callEar2 = 'sf'; core.S.callNudge = true; _mode = ''; window._s0 = _P.length; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pstory]').click()`); await W(6500);
  ok(await E(`_P.length == _s0`) && /想听什么故事/.test(await E(`document.querySelector('.xc-tx').innerText`)), '枕边故事：接通后 TA 先问「想听什么故事」（没调用模型）');
  await p.waitForFunction(`/想听什么故事？直接说/.test(document.querySelector('.xc-ph')?.textContent || '')`, null, { timeout: 8000 }).catch(() => { }); await W(500);
  await E(`_loud = 1`); await W(1100); await E(`_loud = 0`); await W(3000);
  ok(/在讲故事|在想故事/.test(await E(`document.querySelector('.xc-ph').textContent`)), '状态：在讲故事');
  await W(9000);
  const sp = await E(`JSON.stringify(_P.at(-1))`);
  ok(await E(`_P.length == _s0 + 1`) && /想听：「讲个小狐狸的故事/.test(sp) && /1500 字/.test(sp), '我说一句想听什么 → 只发了一次请求，让 TA 讲 1500 字左右 n=' + (await E(`_P.length - _s0`)) + ' ' + (sp.match(/想听：「[^」]*」|已经 \\d+ 秒没出声|刚刚说：「[^」]*」/g) || []).join(','));
  ok(/小狐狸/.test(await E(`document.querySelector('.xc-tx').innerText`)) && /晚安/.test(await E(`document.querySelector('.xc-tx').innerText`)), '故事一句一句念出来（字幕里有）');
  await p.waitForFunction(`/讲完啦/.test(document.querySelector('.xc-ph')?.textContent || '')`, null, { timeout: 20000 }).catch(() => { });
  await E(`cl.inCall().idleAt = performance.now() - 31e3`); await W(1500);
  ok(await E(`!cl.inCall() && /^枕边故事 /.test(_c.msgs.at(-1).c) && _P.length == _s0 + 1`), '讲完 30 秒没动静：自己挂了（聊天里记一条「枕边故事」），整通只调用了一次');
  await E(`core.S.callNudge = false`); asrNext = null;
  // 免费模型：一键加成配置（同一家不重复加），官网 / 拿密钥的链接能点开、能复制
  ok(await E(`(async () => { const f = await import('/apps/settings/free-models.js'); const n0 = core.S.api.chat.list.length; const id = f.freeAdd('zhipu', 'glm-4-flash-250414', 'k1'); const id2 = f.freeAdd('zhipu', 'glm-4.7-flash'); const p = core.S.api.chat.list.find(x => x.id == id);
    return id == id2 && core.S.api.chat.list.length == n0 + 1 && p.url == 'https://open.bigmodel.cn/api/paas/v4' && p.key == 'k1' && p.model == 'glm-4.7-flash' && p.models.includes('glm-4-flash-250414') && p.fast; })()`), '免费模型：添加智谱 → 新配置（地址、密钥、模型都填好），再加同一家只换模型不重复');
  await E(`(async () => { const f = await import('/apps/settings/free-models.js'); f.freePage(); })()`); await W(500); await shot('free');
  ok(await E(`(() => { const el = core.top().el; return el.querySelectorAll('h6').length == 3 && !!el.querySelector('a[href="https://open.bigmodel.cn"]') && !!el.querySelector('a[href="https://cloud.siliconflow.cn/account/ak"]') && !!el.querySelector('a[href="https://aistudio.google.com"]') && el.querySelectorAll('[data-a=fcopy]').length == 6 && el.querySelectorAll('[data-a=fadd]').length == 8; })()`), '免费模型页：三家（智谱 / 硅基流动 / Gemini），官网和拿密钥都能点开、能复制，8 个模型可以添加');
  await E(`core.back()`); await W(300);
  // 语言：本地识别只有内置中文；说日语（没装日语包）自动换成云端识别，换回中文再换回本地；没有密钥就在通话里提示填
  const dial = async () => { await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); };
  asrNext = 'こんにちは、元気？'; await E(`(() => { core.S.callEar2 = 'local'; core.S.callLang = 'ja-JP'; core.S.callAsr = { key: 'sk-test' }; _mode = ''; })()`);
  await dial(); await W(6000);
  ok(await E(`cl.inCall().ear == 'sf' && cl.inCall().earBack == 'local' && /硅基识别/.test(document.querySelector('.xc-lang').textContent) && /日语/.test(document.querySelector('.xc-lang').textContent)`), '我说日语（没装日语包）：自动用云端识别（硅基流动），中文以后还用本地');
  const j0 = await E(`_P.length`), a0 = ASR.length; await E(`_loud = 1`); await W(1200); await E(`_loud = 0`); await W(2600);
  ok(ASR.length > a0 && await E(`_P.length`) == j0 + 1 && /こんにちは/.test(await E(`JSON.stringify(_P.at(-1))`)), '说日语：云端认出来的日语整句发给 TA');
  await E(`document.querySelector('.xc [data-k=inl]').click()`); await W(300);
  ok(/云端识别/.test(await E(`document.querySelector('.sheet.in')?.textContent || ''`)) && /中文 · 本地/.test(await E(`document.querySelector('.sheet.in')?.textContent || ''`)), '「我说」菜单里写着每种语言用什么认（中文本地、日语云端）');
  await E(`document.querySelector('.sheet.in [data-x="zh-CN"]').click()`); await W(300);
  ok(await E(`cl.inCall().ear == 'local' && !cl.inCall().earBack && core.S.callLang == 'zh-CN'`), '换回中文：换回本地识别');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  await E(`(() => { core.S.callLang = 'ja-JP'; core.S.callAsr = {}; })()`); await dial(); await W(1500);
  ok(await E(`cl.inCall().ear == 'model' && /云端识别/.test(document.querySelector('.xc-fix')?.textContent || '') && /语言包/.test(document.querySelector('.xc-fix').textContent)`), '说日语但没有硅基密钥：通话里提示填密钥（或者以后装本地语言包），先用模型听');
  await E(`document.querySelector('.xc-fix input').value = 'sk-j'; document.querySelector('.xc-fix [data-f=y]').click()`); await W(200);
  ok(await E(`cl.inCall().ear == 'sf' && core.S.callAsr.key == 'sk-j'`), '填好密钥：马上换成云端识别');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  await E(`(() => { core.S.callLang = 'zh-CN'; core.S.callAsr = {}; core.S.api.chat.list.push({ id: 'sfp', name: '免费 · 硅基流动', url: 'https://api.siliconflow.cn/v1', key: 'sk-chat', model: 'Qwen/Qwen3-8B' }); })()`);
  ok(await E(`(async () => (await import('/apps/chat/ear.js')).asrCfg().key)()`) == 'sk-chat', '云端识别的密钥：没单独填时用「免费模型」里加过的硅基流动配置的密钥');
  await E(`(async () => (await import('/apps/settings/lang-packs.js')).langPage())()`); await W(500); await shot('langp');
  ok(await E(`(() => { const el = core.top().el, t = el.textContent; return /中文/.test(t) && /内置/.test(t) && /日语/.test(t) && /准备中/.test(t) && /能用/.test(t) && /免费模型里加的/.test(t) && !!el.querySelector('a[href="https://cloud.siliconflow.cn/account/ak"]'); })()`), '设置 → 语音识别语言包：中文内置、日语本地包（准备中）、云端识别（密钥从哪来、去哪拿）');
  await E(`(() => { core.back(); core.S.api.chat.list = core.S.api.chat.list.filter(p => p.id != 'sfp'); })()`); await W(300);
  // TA 主动挂电话（学 evolia 的 call_control）：聊完了 TA 在最后写 [挂断]
  await E(`_mode = 'bye'; core.S.callEar2 = 'model'`); await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6500); await E(`_loud = 1`); await W(900); await E(`_loud = 0`); await W(5500);
  ok(await E(`!cl.inCall() && _c.msgs.at(-1).t == 'call'`) && !/挂断\]/.test(await E(`JSON.stringify(_c.msgs.at(-1).log)`)), 'TA 说「晚安」后在最后写 [挂断]：电话自己挂了，字幕和记录里不露标记');
  await E(`cl.inCall()?.hang?.()`); await W(300); await E(`_mode = ''`);
  // 说完等多久可以调：设成 1.6 秒，停 1.2 秒还不算说完，停够才发
  await E(`(() => { core.S.callEar2 = 'model'; core.S.callGap = 1.6; _mode = ''; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  const g0 = await E(`_P.length`); await E(`_loud = 1`); await W(800); await E(`_loud = 0`); await W(1250);
  ok(await E(`_P.length`) == g0 && await E(`cl.inCall().ph == 'rec'`), '说完等 1.6 秒：停了 1.2 秒还在听（不抢话）');
  await W(1200); ok(await E(`_P.length`) == g0 + 1, '停够 1.6 秒：发出去');
  // 追问：TA 说完我一直不出声，TA 问一句「还在吗」，最多两次
  await W(3000); await E(`(() => { core.S.callNudge = true; core.S.callGap = 1; const a = cl.inCall(); a.idleAt = performance.now() - 9e3; })()`); await W(1600);
  ok(/没出声了/.test(await E(`JSON.stringify(_P.at(-1))`)) && await E(`cl.inCall().nudge`) == 1, '我 8 秒没出声：TA 追问一句');
  await W(3000); await E(`cl.inCall().idleAt = performance.now() - 9e3`); await W(1600); await W(3000); await E(`cl.inCall().idleAt = performance.now() - 9e3`); await W(1600);
  ok(await E(`cl.inCall().nudge`) == 2, '最多追问两次 n=' + await E(`cl.inCall().nudge`));
  await E(`core.S.callNudge = false; cl.inCall()?.hang?.()`); await W(400);
  ok(await E(`(() => { const t = core.S && window.cl; return true; })()`) && await E(`(async () => { const e = await import('/apps/chat/ear.js'); const q = new Float32Array(48000).fill(.01); return e.toneOf([q], .3, 1).includes('声音偏轻') && e.toneOf([q], .3, 1).includes('停顿稍多'); })()`), '听语气：声音很轻、停顿多 → 「声音偏轻、停顿稍多」');
  // wav 编码：48k → 16k，长度和头对
  ok(await E(`(() => { const u = cl.wav([new Float32Array(4800).fill(.5)], 48000), b = atob(u.split(',')[1]); return b.slice(0, 4) == 'RIFF' && b.length == 44 + 1600 * 2; })()`), 'wav：48kHz 0.1 秒 → 16kHz 1600 个采样');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
