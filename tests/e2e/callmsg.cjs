// 通话 · 多轮对话格式 + 记不记进记忆：酒馆当前连接（聊天补全、流式）收到的是 system + 我一句 user / TA 一句 assistant；
// 日语 SAY 行一写完就先放出去（不等 ZH）；每轮开头的「おはよう」去掉；挂断后「记住这通」→ 私聊上下文带通话内容，长按改成不记 → 不带
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
    // 假模型：先吐 SAY 行，停 1.5 秒才吐 ZH 行（看 SAY 是不是先放出去）
    X.ChatCompletionService = { processRequest: async d => { _P.push(d); return async function* () { let s = 'SAY: おはよう。医務室で寝てるよ。\\n'; yield { text: s }; await new Promise(r => setTimeout(r, 1500)); _T.push(cl.inCall()?.lines.at(-1)?.t || ''); s += 'ZH: 早上好。在医务室睡觉呢。\\n'; yield { text: s }; }; } };
    delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); _c.cfg.lang = 'ja'; core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(4500);
  const sayIt = async t => { await E(`document.querySelector('.xc-type input') || document.querySelector('.xc [data-k=kb]').click()`); await W(300); await E(`(() => { const i = document.querySelector('.xc-type input'); i.value = '${t}'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await W(3500); };
  await sayIt('你在干嘛呢'); await sayIt('还困吗');
  const d = await E(`_P.at(-1)`), roles = d.messages.map(m => m.role).join(',');
  ok(roles == 'system,user,assistant,user,assistant,user', '发给模型的是真正的多轮对话：' + roles);
  ok(d.messages.at(-1).content == '还困吗' && /SAY: もしもし？/.test(d.messages[2].content), '最后一条就是我刚说的话；TA 前面的话按 SAY/ZH 格式写回去');
  ok(/【此刻】/.test(d.messages[0].content) && /接着.{0,12}刚说的话/.test(d.messages[0].content) && !/刚刚说|最要紧/.test(JSON.stringify(d.messages)), '系统提示：此刻在干嘛、先接住我那句；没有以前那堆「刚刚说 / 最要紧」');
  ok(await E(`/医務室/.test(_T[0] || '')`), 'SAY 一写完就开始说，不等 ZH 那行（第二轮跟第一轮一字不差：整轮都是复读时还是说出来，别哑着） ' + JSON.stringify(await E(`_T`)));
  ok(await E(`cl.inCall().log.filter(x => x.f == 'c').slice(1).every(x => !/おはよう/.test(x.t) && x.tr && !/早上好/.test(x.tr))`), '每轮开头的「おはよう」去掉了，晚到的中文释义补进字幕且同样去掉「早上好」 ' + JSON.stringify(await E(`cl.inCall().log`)));
  ok(await E(`cl.inCall().log.filter(x => x.f == 'c').length == 3 && cl.inCall().ph != 'fail'`), '整轮都被当复读删光：还是把那句说出来，不显示「模型回了空的内容」');
  await E(`cl.inCall().hang()`); await W(400);
  ok(await E(`_c.msgs.at(-1).t == 'call' && _c.msgs.at(-1).mem == 1 && /医務室|医务室/.test(core.say(_c.msgs.at(-1)))`), '默认「记住这通」：挂了以后私聊上下文里带通话内容');
  await E(`(() => { const m = _c.msgs.at(-1); delete m.mem; core.saveD(); })()`);
  ok(await E(`core.forgot(_c.msgs.at(-1)) && !/医務室|医务室/.test(core.say(_c.msgs.at(-1)))`), '改成不记：TA 不记得这通电话（不带内容）');
  ok(await E(`(async () => { const r = await import('/apps/chat/recall.js'); return !JSON.stringify(r.recall(_c, '医务室', 12, 400) || '').includes('医務室'); })()`), '不记的通话：回忆里也翻不出来');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
