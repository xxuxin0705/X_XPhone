const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8781);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2.25 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8781/'); await p.waitForFunction('window.booted');
  // fake SillyTavern connection manager with 3 saved profiles
  await p.evaluate(() => { const c = SillyTavern.getContext(); window.CALLS = [];
    c.extensionSettings.disabledExtensions = []; c.extensionSettings.connectionManager = { selectedProfile: 'p1', profiles: [
      { id: 'p1', name: '主线 Claude', api: 'claude', model: 'claude-sonnet-4-5' }, { id: 'p2', name: '公益站 DeepSeek', api: 'openai', model: 'deepseek-chat' }, { id: 'p3', name: '坏的', api: '' }] };
    c.ConnectionManagerRequestService = { isProfileSupported: p => !!p.api, constructPrompt: m => m,
      sendRequest: async (id, msgs, max, o) => { CALLS.push({ id, msgs, max, stream: o.stream, sig: !!o.signal }); return async function* () { yield { text: '', state: { reasoning: 'hmm' } }; yield { text: '你好', state: { reasoning: 'hmm' } }; yield { text: '你好呀～' + id, state: {} }; }; } };
    c.generateRaw = async () => 'RAW'; });
  await p.click('#stp-ball');
  const E = s => p.evaluate(s);
  await E(`(async () => { window.core = await import('/core.js'); core.S.api.chat = { src: 'tavern', cur: '', list: [{ id: 'c1', name: '我的中转', url: 'https://x.test/v1', key: 'k', model: 'glm-5.3-flash' }] }; core.APPS.settings.open(); })()`); await p.waitForTimeout(500);
  await E(`document.querySelector('[data-a=api][data-x=chat]').click()`); await p.waitForTimeout(600);
  const rows = await E(`[...document.querySelectorAll('.pg:last-child [data-a=stp]')].map(r => (r.classList.contains('on') ? '●' : '○') + r.querySelector('b').textContent).join(' | ')`);
  ok(rows == '●跟随酒馆当前连接 | ○主线 Claude | ○公益站 DeepSeek', 'tavern mode lists saved ST profiles (unsupported hidden), default follows current: ' + rows);
  ok(/主线 Claude/.test(await E(`document.querySelector('.pg:last-child [data-a=stp][data-x=""] small').textContent`)), 'follow row names the current ST profile');
  ok(await E(`core.llm('s', 'u', '测试')`) == 'RAW', 'follow current → generateRaw');
  await E(`document.querySelector('.pg:last-child [data-a=stp][data-x=p2]').click()`); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'stp_a.png') });
  ok(await E(`core.S.api.chat.stp`) == 'p2' && /●公益站/.test(await E(`[...document.querySelectorAll('.pg:last-child [data-a=stp]')].map(r => (r.classList.contains('on') ? '●' : '○') + r.querySelector('b').textContent).join()`)), 'picking a profile selects it');
  let seen = []; const r1 = await E(`core.llm('SYS', 'USER', '测试', null, { onText: t => window.T = t })`);
  const c1 = await E(`CALLS.at(-1)`);
  ok(r1 == '你好呀～p2' && c1.id == 'p2' && c1.stream && c1.sig && c1.msgs[0].content == 'SYS' && c1.msgs[1].content == 'USER', 'llm goes through ConnectionManagerRequestService with the chosen profile, streaming');
  ok(/酒馆 · 公益站 DeepSeek/.test(await E(`core.LOG[0].src`)) && await E(`core.LOG[0].model`) == 'deepseek-chat', 'log shows profile name + model');
  const opts = await E(`[...document.querySelectorAll('.pg:last-child select[data-k=aux] option')].map(o => o.value + '=' + o.textContent).join(' | ')`);
  ok(/st:p1=酒馆 · 主线 Claude · claude-sonnet-4-5/.test(opts) && /c1=我的中转/.test(opts) && !/p3/.test(opts), 'aux select offers custom + ST profiles: ' + opts);
  await E(`core.S.api.chat.aux = 'st:p1'`);
  await E(`core.llm('S2', 'U2', '生成联系人', null, { aux: 1 })`); ok(await E(`CALLS.at(-1).id`) == 'p1', 'aux = ST profile p1 → used for generation');
  await E(`core.S.api.chat.aux = ''`); await E(`core.llm('S3', 'U3', '聊天')`); ok(await E(`CALLS.at(-1).id`) == 'p2', 'chat reply still uses p2');
  // deleted profile → fall back to current, tip shown
  await E(`SillyTavern.getContext().extensionSettings.connectionManager.profiles.splice(1, 1); document.querySelector('.pg:last-child [data-a=stp][data-x=p1]') && core.top().re()`); await p.waitForTimeout(300);
  ok(await E(`core.llm('s', 'u')`) == 'RAW' && /被删掉了/.test(await E(`document.querySelector('.pg:last-child .pg-b').textContent`)) && await E(`document.querySelector('.pg:last-child [data-a=stp][data-x=""]').classList.contains('on')`), 'deleted profile → falls back to current connection with a note');
  // settings home subtitle
  await E(`core.S.api.chat.stp = 'p1'; core.back?.()`); await p.waitForTimeout(500);
  ok(/酒馆 · 主线 Claude/.test(await E(`document.querySelector('[data-a=api][data-x=chat]').textContent`)), 'settings home shows 酒馆 · profile name');
  // no connection manager
  await E(`delete SillyTavern.getContext().ConnectionManagerRequestService; document.querySelector('[data-a=api][data-x=chat]').click()`); await p.waitForTimeout(500);
  ok(/没有「连接配置」功能/.test(await E(`document.querySelector('.pg:last-child .pg-b').textContent`)) && await E(`core.llm('s','u')`) == 'RAW', 'old tavern without connection manager → follow current only');
  // status bar + font size
  const sb = await E(`JSON.stringify([document.querySelector('.sb').offsetHeight, getComputedStyle(document.querySelector('.sb')).fontSize, getComputedStyle(document.querySelector('.pg:last-child .pg-t')).fontSize, document.querySelector('.pg:last-child .pg-h').offsetHeight])`);
  console.log('  status/title metrics', sb);
  const [h, f1, f2, ph] = JSON.parse(sb); ok(h == 0 && f1 == '13.5px' && parseFloat(f2) < 16 && ph == 42, '应用内状态栏隐藏，页面标题保持原尺寸');
  await E(`core.S.fzp = 110; core.emit('cfg', 'fzp')`); await p.waitForTimeout(200);
  ok(parseFloat(await E(`getComputedStyle(document.querySelector('.pg:last-child .pg-t')).fontSize`)) > parseFloat(f2) * 1.06, '字体大小 setting changes text size live');
  await E(`core.S.fzp = 100; core.emit('cfg', 'fzp')`);
  // chat page screenshot like user's
  await E(`(async () => { while (core.top()) { core.back(); await new Promise(r => setTimeout(r, 50)); } const ch = await import('/apps/chat/chat.js'); const D = core.D(); D.chats.push({ id: 'g1', type: 'g', name: '一天到晚干嘛呢！', members: ['a','b','c'], msgs: [] }); core.APPS.chat.open(); ch.openChat('g1'); })()`); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'stp_b.png') });
  // 聊天模型：流式输出（默认开、在低思考上面）；同一个网站存好几个模型，点一下就换
  await E(`(async () => { while (core.top()) { core.back(); await new Promise(r => setTimeout(r, 50)); } core.S.api.chat = { src: 'custom', cur: 'c1', list: [{ id: 'c1', name: '公益站', url: 'https://x.test/v1', key: 'k', model: 'glm-5.3', nostream: false }] }; core.APPS.settings.open(); })()`); await p.waitForTimeout(400);
  await E(`document.querySelector('[data-a=api][data-x=chat]').click()`); await p.waitForTimeout(500);
  await E(`document.querySelector('.pg:last-child [data-a=padd]').click()`); await p.waitForTimeout(500);
  const fl = await E(`[...document.querySelectorAll('.sheet.in .row span')].map(e => e.textContent).join('|')`);
  ok(/流式输出\|低思考模式/.test(fl) && !/关闭流式/.test(fl) && await E(`document.querySelector('.sheet.in [data-k=stream]').checked`), '新增配置：「流式输出」默认打开，排在低思考模式上面 ' + fl);
  await E(`document.querySelector('.sheet.in [data-a=x], .sheet.in .pg-back')?.click(); document.querySelector('.sheet.in')?._pg?.close?.()`); await p.waitForTimeout(400);
  ok(await E(`core.llm.toString().length > 0`) && await E(`(() => { const p = core.S.api.chat.list[0]; return (p.stream ?? !p.nostream) === true; })()`), '老配置没关流式的：还是开着');
  await E(`(() => { const p = core.S.api.chat.list[0]; p.models = ['glm-5.3', 'gemini-3.8']; core.top().re(); })()`); await p.waitForTimeout(300);
  ok(await E(`[...document.querySelectorAll('.pg:last-child .mchip')].map(b => b.textContent).join()`) == 'glm-5.3,gemini-3.8,＋ 模型', '配置下面列出存的模型');
  await E(`document.querySelectorAll('.pg:last-child .mchip')[1].click()`); await p.waitForTimeout(300);
  ok(await E(`core.S.api.chat.list[0].model`) == 'gemini-3.8' && await E(`core.S.api.chat.list.length`) == 1 && await E(`core.S.api.chat.list[0].models.join()`) == 'glm-5.3,gemini-3.8', '点 gemini：换成 gemini，原来的 glm 还在，不用另存一个配置');
  await p.screenshot({ path: path.join(OUT, 'stp_models.png') });
  // 上下文与世界书：点一下就是开 / 关，页面不跳
  await E(`(async () => { core.back(); await new Promise(r => setTimeout(r, 300)); const c = SillyTavern.getContext(); c.loadWorldInfo = async () => ({ entries: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, { uid: i, comment: '条目' + i, constant: i % 2 == 0, key: [], content: 'x' }])) }); core.S.wi = { follow: false, books: ['书'], ov: {} }; document.querySelector('[data-a=ctx]').click(); })()`); await p.waitForTimeout(900);
  await E(`document.querySelector('.pg:last-child .pg-b').scrollTop = 400`); await p.waitForTimeout(100);
  const st0 = await E(`document.querySelector('.ent[data-x="书/4"] .st').textContent`);
  await E(`document.querySelector('.ent[data-x="书/4"]').click()`); await p.waitForTimeout(200);
  ok(st0 == '跟随·开' && await E(`document.querySelector('.ent[data-x="书/4"] .st').textContent`) == '关' && await E(`core.S.wi.ov['书/4']`) === 0, '开着的条目点一下：直接关掉 ' + st0);
  await E(`document.querySelector('.ent[data-x="书/4"]').click()`); await p.waitForTimeout(200);
  ok(await E(`document.querySelector('.ent[data-x="书/4"] .st').textContent`) == '开', '再点一下：开');
  ok(await E(`document.querySelector('.pg:last-child .pg-b').scrollTop`) == 400, '页面没有跳到最上面');
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})();
