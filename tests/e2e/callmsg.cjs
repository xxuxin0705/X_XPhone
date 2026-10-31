// 通话 · 多轮对话格式 + 记不记进记忆：酒馆当前连接（聊天补全、流式）收到的是 system + 我一句 user / TA 一句 assistant；
// 接通第一句由模型照剧情写；日语「原话」一写完就先念（不等（中文意思））；混进中文先翻成日语；挂断后「记住这通」→ 私聊上下文带通话内容，改成不记 → 不带
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const root = path.resolve(__dirname, '../..'), here = __dirname;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + (/\.(js|css|html)$/.test(f) ? '; charset=utf-8' : '') }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8827);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8827/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.cl = await import('/apps/chat/call.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; core.S.callEar2 = 'web'; core.S.callNudge = false; window._P = []; window._T = [];
    const X = SillyTavern.getContext(); X.mainApi = 'openai'; X.chatCompletionSettings = { chat_completion_source: 'openai', openai_max_tokens: 500, temp_openai: 1 }; X.getChatCompletionModel = () => 'gpt-x';
    // 假模型：接通第一句照剧情写；之后每轮先吐「原话」，停 1.5 秒才吐（中文意思）（看原话是不是先念了、释义晚到能不能补上）；第三轮混一句中文（看会不会翻成日语再念）
    X.ChatCompletionService = { processRequest: async d => { _P.push(d); const open = /刚接起来/.test(JSON.stringify(d.messages)), n = _P.length; return async function* () {
      if (open) { yield { text: '「どうした？硝子ならもうすぐ来るよ。」（怎么了？硝子马上就来了。）' }; return; }
      if (n == 4) { yield { text: '「稍微有点事情，刚从医院回来。」\\n' }; return; }
      let s = '「あ、医務室で寝てるよ。」'; yield { text: s }; await new Promise(r => setTimeout(r, 1500)); _T.push(cl.inCall()?.lines.at(-1)?.t || ''); s += '（啊，在医务室睡觉呢。）\\n'; yield { text: s }; }; } };
    delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); _c.cfg.lang = 'ja'; core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await p.route(/\/api\/translate\/google/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'たった今病院から帰ってきたんだ。' }));
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6000);
  ok(/硝子ならもうすぐ来るよ/.test(await E(`document.querySelector('.xc-tx')?.innerText || ''`)) && await E(`_P.length == 1 && /刚接起来/.test(JSON.stringify(_P[0].messages)) && !/喂\\?/.test(cl.inCall().lines[0]?.t)`), '接通第一句：响铃时模型照剧情写好的（不是固定的「喂？」）');
  const sayIt = async t => { await E(`document.querySelector('.xc-type input') || document.querySelector('.xc [data-k=kb]').click()`); await W(300); await E(`(() => { const i = document.querySelector('.xc-type input'); i.value = '${t}'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await W(3800); };
  await sayIt('你在干嘛呢'); await sayIt('还困吗');
  const d = await E(`_P.at(-1)`), roles = d.messages.map(m => m.role).join(',');
  ok(roles == 'system,user,assistant,user,assistant,user', '发给模型的是真正的多轮对话：' + roles);
  ok(d.messages.at(-1).content == '还困吗' && /^「どうした？硝子ならもうすぐ来るよ。」（怎么了？硝子马上就来了。）$/.test(d.messages[2].content) && /^「あ、医務室で寝てるよ。」（啊，在医务室睡觉呢。）$/.test(d.messages[4].content), '最后一条就是我刚说的话；TA 前面的话按「原话」（中文意思）写回去 ' + JSON.stringify(d.messages.slice(1).map(m => m.content)));
  ok(/【此刻】/.test(d.messages[0].content) && /只说五条悟的话/.test(d.messages[0].content) && /「日语原话」（中文意思）/.test(d.messages[0].content) && !/刚刚说|最要紧|SAY:|1～3 句/.test(JSON.stringify(d.messages)), '系统提示：此刻在干嘛、只说 TA 的话、「原话」（中文意思）的格式；没有以前那堆规矩');
  ok(await E(`_T.length >= 1 && _T.every(t => /医務室で寝てるよ/.test(t))`), '「原话」一写完就开始念，不等后面的（中文意思） ' + JSON.stringify(await E(`_T`)));
  ok(await E(`cl.inCall().log.filter(x => x.f == 'c').every(x => x.tr && !/「|」|（/.test(x.t))`), '晚到的中文释义补进了字幕和记录；原话里没有「」（） ' + JSON.stringify(await E(`cl.inCall().log`)));
  await sayIt('那你好好休息'); await W(1500);
  const lg = await E(`cl.inCall().log.filter(x => x.f == 'c').at(-1)`);
  ok(lg && /たった今病院から帰ってきた/.test(lg.t) && /稍微有点事情，刚从医院回来/.test(lg.tr), '模型混了一句中文：翻成日语再念，原来的中文当字幕 ' + JSON.stringify(lg));
  await E(`cl.inCall().hang()`); await W(400);
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
