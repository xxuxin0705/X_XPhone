// 设置 → 应用配置：按应用列模块；每个模块单独选模型 / 流式 / 低思考；系统默认提示词只能看，可以新增、切换、编辑、删除自己的；生成时按选中的走
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8818);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const bodies = []; await ctx.route(/relay\.test/, r => { bodies.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content: '{"mood":"开心","scene":"sun","say":"嗯","sea":0.3,"voices":["a"]}' } }] }) }); });
  await p.goto('http://localhost:8818/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.M = await import('/mods.js'); core.S.lock.on = false; core.save(); core.home(); })()`);
  // 列表
  await E(`core.openApp('settings')`); await W(500);
  await E(`document.querySelector('.row.go[data-a=mods]').click()`); await W(500);
  const apps = await E(`[...document.querySelectorAll('.pg.in:last-child .row.go span')].map(h => h.textContent).join()`);
  ok(/聊天/.test(apps) && /窥探之眼/.test(apps) && /心屿/.test(apps) && !/私聊回复/.test(apps), '第一层是应用：' + apps);
  await E(`document.querySelector('.pg.in:last-child .row.go[data-x="聊天"]').click()`); await W(500);
  const rows = await E(`[...document.querySelectorAll('.pg.in:last-child .row.go span')].map(h => h.textContent).join()`);
  ok(['生成联系人', '私聊回复', '群聊回复', '动态', '动态评论', '剧情同步'].every(n => rows.includes(n)), '点聊天 → 它的模块：' + rows);
  await p.screenshot({ path: OUT + '/mods-list.png' });
  await E(`core.back()`); await W(400);
  // 论坛模块
  await E(`document.querySelector('.pg.in:last-child .row.go[data-x="窥探之眼"]').click()`); await W(500); // 只有一个模块：直接进配置
  ok(await E(`!!document.querySelector('.modp select[data-k=use]') && document.querySelectorAll('.modp .seg').length == 2`), '模块页：模型、流式、低思考');
  await E(`document.querySelector('.modp [data-k2=stream][data-x=off]').click()`); await W(200);
  await E(`document.querySelector('.modp [data-k2=think][data-x=low]').click()`); await W(200);
  ok(await E(`core.S.mods['eye.forum'].stream == 'off' && core.S.mods['eye.forum'].think == 'low'`), '流式关、低思考开 存进了设置');
  await E(`document.querySelector('.modp [data-a=mview]').click()`); await W(400);
  ok(/这一帖吵什么/.test(await E(`document.querySelector('.modv-t').textContent`)) && await E(`!document.querySelector('.modv-t textarea, .modv-t [contenteditable]')`), '系统默认提示词只能看');
  await p.screenshot({ path: OUT + '/mods-view.png' });
  await E(`core.back()`); await W(400);
  await E(`document.querySelector('.modp [data-a=madd]').click()`); await W(400);
  ok(/这一帖吵什么/.test(await E(`document.querySelector('.sheet.in textarea').value`)) && /\{\{形态\}\}/.test(await E(`document.querySelector('.sheet.in').textContent`)), '新增：以系统默认为底，列出可用变量');
  await E(`(() => { const s = document.querySelector('.sheet.in'), i = s.querySelector('input[data-k=n]'), t = s.querySelector('textarea'); i.value = '我的论坛'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); t.value = '自定义要求XYZ：{{形态}}版，{{char}}'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); s.querySelector('[data-a=ok]').click(); })()`); await W(500);
  const c = await E(`JSON.stringify(core.S.mods['eye.forum'])`);
  ok(/我的论坛/.test(c) && JSON.parse(c).cur == JSON.parse(c).list[0].id, '保存后自动切到新提示词');
  ok(await E(`M.mp('eye.forum', { 形态: '漫画' })`) == '自定义要求XYZ：漫画版，灰吕杵志', '生效的提示词：变量和 {{char}} 都换掉了');
  await p.screenshot({ path: OUT + '/mods-mod.png' });
  // 切回系统默认、再删除
  await E(`document.querySelector('.modp .row.prof[data-x=""]').click()`); await W(300);
  ok(await E(`core.S.mods['eye.forum'].cur == '' && /这一帖吵什么/.test(M.mp('eye.forum', { 形态: '漫画' }))`), '切回系统默认');
  await E(`document.querySelector('.modp [data-a=medit]').click()`); await W(400); await E(`document.querySelector('.sheet.mnu [data-x=d]').click()`); await W(400); await E(`document.querySelector('.sheet.mnu .mi.danger')?.click()`); await W(400);
  ok(await E(`core.S.mods['eye.forum'].list.length == 0`), '删除自定义提示词');
  // 生成时按模块设置走：读心情模块设成流式关、低思考开，用自定义 API 看请求体
  await E(`(() => { core.S.api.chat = Object.assign(core.S.api.chat, { src: 'custom', cur: 'a', list: [{ id: 'a', name: 'x', url: 'https://relay.test/v1', key: 'k', model: 'm' }] }); core.S.mods['isle.mood'] = { use: '', stream: 'off', think: 'low', cur: 'z', list: [{ id: 'z', n: 'x', t: 'MOODXYZ 看看{{对象}}' }] }; })()`);
  await E(`core.llm('sys', M.mp('isle.mood', { 对象: '小王' }) + '只输出 JSON', '读心情', null, { aux: 1, mod: 'isle.mood' })`); await W(300);
  const bd = bodies.at(-1) || {};
  ok(!bd.stream && bd.reasoning_effort == 'low' && /MOODXYZ 看看小王/.test(JSON.stringify(bd.messages)), '请求按模块设置：不流式、低思考、用自定义提示词 ' + JSON.stringify({ s: bd.stream, r: bd.reasoning_effort }));
  // 动态：系统默认拆成可换的一段 + 固定格式，拼起来跟原来一样
  const fg = await E(`(async () => { const f = await import('/apps/chat/feed-generation.js'); return f.MOMENTS_CORE.includes('【核心生成规则】') && !f.MOMENTS_CORE.includes('【输出格式】') && f.MOMENTS_FMT.includes('【输出格式】'); })()`);
  ok(fg, '动态提示词：内容段可换，格式段固定');
  ok(errs.length == 0, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
