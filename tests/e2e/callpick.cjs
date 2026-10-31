// 通话 · 接通和念得顺不顺：TA 永远先说（第一句慢也一直响铃，不再响 8 秒就让我先说）；第一句的声音好了就接通，后面边说边写边合成；
// 点屏幕不打断；（中文意思）里套着（笑）不会拆错、不会把落单的「)」送去念；还没轮到的短句并成一次合成（少几次来回）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8830);
const wav = () => { const n = 4800, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const TTS = []; let live = 0, peak = 0; // 送去合成的文字；同时在合成的最多几句
  await ctx.route(/api\.fish\.audio/, async r => { const d = r.request().postDataJSON() || {}; TTS.push(String(d.text || d.input || '')); live++; peak = Math.max(peak, live); await new Promise(x => setTimeout(x, 300)); live--; r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: wav() }); });
  await ctx.route(/\/api\/translate\/google/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: '嗯' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8830/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'callpick_' + n + '.png') });
  const REPLY = '「もしもーし。何、桃？急に電話なんかかけてきてさ。（笑）」（喂——。怎么了，桃？突然打什么电话过来啊。（笑））\\n\\n「っていうか、声めっちゃ元気。さっきまで干からびてた。ほんとに。」（话说回来，声音超有精神。刚才还干瘪着。真的。）\\n\\n「自販機の前だよ。ジュース買ってる。何がいい？桃だからピーチ？」（在自动贩卖机前。在买果汁。要什么？桃的话就桃子味？）';
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.cl = await import('/apps/chat/call.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; window._P = []; core.S.callAuto = false; core.S.callEar2 = 'web'; core.S.callNudge = false;
    core.S.api.tts = { src: 'custom', pv: 'fish', cfg: { fish: { key: 'fk', model: 's2.1-pro' } } };
    // 假模型：接通第一句要想 10 秒（像会思考的模型）；之后回一大段，（中文意思）里还套着（笑）
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); if (/刚接起来/.test(JSON.stringify(o))) { await new Promise(r => setTimeout(r, 10000)); return '「おう、どうした？」（哦，怎么了？）'; } return '${REPLY}'; };
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); _c.tv = { v: { fish: 'vid' } }; _c.cfg.lang = 'ja'; core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`);
  // 第一句慢：一直响，不让我先说
  await W(9000); await shot('ring');
  ok(await E(`cl.inCall().st == 'dial' && _P.length == 1 && !cl.inCall().lines.length`), '第一句想了 9 秒还没好：还在响铃，没有先接起来让我说，开场白那次请求也没被取消');
  ok(!/在想/.test(await E(`document.querySelector('.xc').innerText`)), '响铃界面只响铃，不写「在想第一句」');
  await p.waitForFunction(`cl.inCall()?.st == 'talk'`, null, { timeout: 8000 }).catch(() => { }); await W(300);
  ok(await E(`cl.inCall().st == 'talk' && cl.inCall().lines[0]?.f == 'c' && /どうした/.test(cl.inCall().lines[0].t) && cl.inCall().log[0]?.f == 'c'`), '第一句好了才接通：接起来第一句是 TA 说的');
  await W(2000);
  // 我说一句 → TA 回一大段
  const n0 = TTS.length; peak = 0;
  await E(`document.querySelector('.xc [data-k=kb]').click()`); await W(300); await E(`(() => { const i = document.querySelector('.xc-type input'); i.value = '喂你在干嘛呢'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`);
  await p.waitForFunction(`cl.inCall()?.ph == 'speak'`, null, { timeout: 8000 }).catch(() => { }); await W(200);
  await E(`document.querySelector('.xc-mid').click(); document.querySelector('.xc-tx')?.click()`); await W(300);
  ok(await E(`cl.inCall().ph == 'speak'`), 'TA 说话时点屏幕：不打断（轮流说；调音量碰到屏幕也不会断）');
  await p.waitForFunction(`cl.inCall()?.ph == 'idle'`, null, { timeout: 30000 }).catch(() => { }); await shot('talk');
  const said = TTS.slice(n0), all = said.join(''), lg = await E(`cl.inCall().log.filter(x => x.f == 'c')`);
  ok(lg.length == 4 && /自販機の前だよ/.test(lg[3].t), '一大段都念完了，没有半路断掉 ' + JSON.stringify(lg.map(x => x.t)));
  ok(lg[1].tr == '喂——。怎么了，桃？突然打什么电话过来啊。（笑）' && lg[2].tr == '话说回来，声音超有精神。刚才还干瘪着。真的。', '（中文意思）里套着（笑）：数着括号拆，字幕完整，不会少半个括号 ' + JSON.stringify(lg[1].tr));
  ok(!said.some(t => !/[\p{L}\p{N}]/u.test(t.replace(/\[[a-z -]+\]/g, ''))), '没有把落单的「)」这种只有标点的东西送去念 ' + JSON.stringify(said));
  ok(['もしもーし。', '何、桃？', 'ほんとに。', '桃だからピーチ？'].every(x => all.includes(x)) && all.indexOf('もしもーし') < all.indexOf('ほんとに') && all.indexOf('ほんとに') < all.indexOf('ピーチ'), '每一句都按顺序送去念了');
  ok(said[0] == 'もしもーし。' && said.length < 10, `第一句单独先念（越短越快出声）；后面还没轮到的短句并成一次合成：10 小句只合成了 ${said.length} 次 ` + JSON.stringify(said));
  ok(peak >= 2 && peak <= 4, '后面几句提前一起合成（最多同时 4 句，不排队干等）：同时最多 ' + peak);
  // 发给模型的：开场白只说一两句；背景不带我的人设；告诉 TA 我的话是语音识别的
  ok(await E(`(() => { const o = JSON.parse(_P[0]); return /先说一两句/.test(o.prompt) && /【角色卡】/.test(o.systemPrompt) && !/【用户】|再往前/.test(o.systemPrompt) && /同音的错字/.test(o.systemPrompt); })()`), '开场白：像真人接电话先说一两句；背景只带角色卡和世界书（不带我的人设）；告诉 TA 我的话是语音识别的、可能有同音错字');
  // 认出来的话先给我看：说完先不发 → 点那行字改 → 点「发送」才发，发的是改好的
  await E(`window.webkitSpeechRecognition = class { start() { const me = this; setTimeout(() => me.onresult?.({ results: [Object.assign([{ transcript: '我在吃火过' }], { isFinal: true })] }), 100); } abort() {} stop() {} }`);
  await E(`document.querySelector('.xc [data-k=kb]').click()`); await W(200); const k0 = await E(`_P.length`);
  await E(`document.querySelector('[data-k=talk]').click()`); await W(700); await E(`document.querySelector('[data-k=done]').click()`); await W(1500); await shot('pend');
  ok(await E(`_P.length == ${k0} && /我在吃火过/.test(document.querySelector('.xc-tx p.pend')?.textContent || '') && /发送/.test(document.querySelector('[data-k=psend]')?.textContent || '') && /点「发送」/.test(document.querySelector('.xc-ph').textContent)`), '说完先不发：认出来的字停在字幕里，下面「发送」「重说」，状态行告诉我对就点发送、错了点字改');
  await E(`document.querySelector('.xc-tx p.pend').click()`); await W(200); await E(`(() => { const i = document.querySelector('.xc-fix input'); i.value = '我在吃火锅'; document.querySelector('.xc-fix [data-f=y]').click(); })()`); await W(200);
  ok(await E(`_P.length == ${k0} && /我在吃火锅/.test(document.querySelector('.xc-tx p.pend')?.textContent || '')`), '点那行字改成对的：改完还没发');
  await E(`document.querySelector('[data-k=psend]').click()`); await p.waitForFunction(`_P.length > ${k0}`, null, { timeout: 5000 }).catch(() => { });
  ok(await E(`(() => { const o = JSON.parse(_P.at(-1)); return /我在吃火锅/.test(o.prompt) && !/火过/.test(o.prompt); })()`), '点「发送」：发给 TA 的是改好的那句');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(300);
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
