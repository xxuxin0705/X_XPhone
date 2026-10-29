// 翻译跟着设置变：改了角色语言，引用条显示被引用那条现在的样子；「我的消息翻译为 跟角色一样」时，以前发的也重新机翻过去；旧数据的引用按文字找回
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8819);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
let reply = '';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  await ctx.route(/relay\.test/, r => r.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content: reply } }] }) }));
  // 模拟机翻：译成什么语言就加个 [语言] 前缀；翻回中文去掉前缀
  await ctx.route(/\/api\/translate\//, r => { const { text, lang } = JSON.parse(r.request().postData()); const raw = text.replace(/^\[[a-zA-Z-]+\]/, ''); r.fulfill({ status: 200, body: /^zh/i.test(lang) ? raw : `[${lang}]${raw}` }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8819/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js');
    core.S.lock.on = false; core.S.api.chat = { src: 'custom', cur: 'a', list: [{ id: 'a', name: 'x', url: 'https://relay.test/v1', key: 'k', model: 'm', stream: false }] };
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: 'satoru', fr: 1 })); Object.assign(_c.cfg, { lang: 'ja', trMine: true, trTo: '' });
    _c.msgs.push({ f: 'me', t: 'text', c: '老数据', ts: 1 }, { f: _c.id, t: 'text', c: '[ja]旧的回复', tr: '旧的回复', ts: 2, q: { w: '我', c: '老数据' } }); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  // 我发一条：自动机翻成日语
  await E(`(() => { const ip = document.querySelector('.chat .ip'); ip.value = '你好'; ip.oninput(); document.querySelector('.chat .go').click(); })()`); await W(600);
  ok(await E(`JSON.stringify([_c.msgs.at(-1).c, _c.msgs.at(-1).orig, _c.msgs.at(-1).ml])`) == '["[ja]你好","你好","ja"]', '我的消息机翻成日语，记下翻成了哪种');
  // 对方引用我那条回复
  reply = 'satoru: [引用:你好] [ja]你好呀 [翻译:你好呀]'; await E(`talk.gen(_c)`); await W(1500);
  const cm = () => E(`_c.msgs.at(-1)`);
  ok(await E(`!!_c.msgs.at(-1).q?.id && _c.msgs.at(-1).q.id == _c.msgs.at(-2).id`), '引用存的是被引用那条的 id');
  const qts = () => E(`[...document.querySelectorAll('.chat .qt')].map(x => x.textContent)`);
  ok((await qts()).some(t => t.endsWith('[ja]你好')), '引用条显示的是现在的样子：' + (await qts()).join(' / '));
  // 角色语言 日语 → 韩语
  await E(`document.querySelector('.chat [data-a=cset]').click()`); await W(500);
  await p.selectOption('select[data-k="cfg.lang"]', 'ko'); await W(1200);
  const mine = await E(`_c.msgs.filter(m => m.f == 'me').map(m => m.c).join()`), his = await E(`_c.msgs.filter(m => m.f != 'me').map(m => m.c).join()`);
  ok(mine == '[ko]老数据,[ko]你好', '跟角色一样：以前发的我的消息也翻成了韩语 ' + mine);
  ok(his == '[ko]旧的回复,[ko]你好呀', '角色消息换成韩语 ' + his);
  await E(`core.back()`); await W(500);
  const q2 = await qts();
  ok(q2.some(t => t.endsWith('[ko]你好')) && q2.some(t => t.endsWith('[ko]老数据')), '引用条跟着变成韩语（旧数据没 id 的也找回了）：' + q2.join(' / '));
  ok(await E(`!!_c.msgs[1].q.id && _c.msgs[1].q.id == _c.msgs[0].id`), '旧引用补上了 id');
  // 我引用角色那条，再关掉自动翻译：引用条变中文
  await E(`(() => { _c.msgs.push({ f: 'me', t: 'text', c: '嗯', ml: 'ko', ts: 9, q: dt.qref(_c, _c.msgs.find(m => m.tr == '你好呀')) }); _c.cfg.trAuto = false; core.saveD(); core.emit('chat'); })()`); await W(400);
  ok((await qts()).some(t => t.endsWith('：你好呀')), '关掉自动翻译（角色直接说中文）：引用角色的那条也显示中文');
  // 撤回后的引用
  await E(`(() => { const m = _c.msgs.find(m => m.tr == '你好呀'); Object.assign(m, { t: 'sys', c: '撤回了一条消息' }); core.emit('chat'); })()`); await W(400);
  ok((await qts()).some(t => t.endsWith('该消息已撤回')), '被引用的撤回了：显示「该消息已撤回」');
  // 更旧的引用：存的是当时的韩语，那条现在已经是日语了（文字对不上）→ 机翻成中文按字比对找回
  await E(`(() => { _c.cfg.trAuto = true; _c.msgs.push({ f: _c.id, t: 'text', c: '[ja]唔干嘛突然发消息过来', tr: '唔~ 干嘛，突然发消息过来。', ts: 20 }, { f: 'me', t: 'text', c: '哈哈', ts: 21, q: { w: core.nm(_c), c: '[ko]唔干嘛突然' } }); core.saveD(); })()`);
  await E(`talk.qFix(_c)`); await W(600);
  ok((await qts()).some(t => t.endsWith('[ja]唔干嘛突然发消息过来')), '换过语言的旧引用：找回那条，显示现在的日语');
  ok(errs.length == 0, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
