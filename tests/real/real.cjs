// 在真 SillyTavern 里测小手机：手机尺寸 400x860
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs'); const here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const ST = 'http://127.0.0.1:8000/', MOCK = 'http://127.0.0.1:5001';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); const errs = [], cons = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() == 'error' && cons.push(m.text()));
  const E = (s, a) => p.evaluate(s, a), W = ms => p.waitForTimeout(ms), log = async () => (await fetch(MOCK + '/log')).json();
  await p.goto(ST); await p.waitForFunction(() => window.SillyTavern?.getContext?.()?.eventSource && document.querySelector('#send_textarea'), null, { timeout: 90000 }); await W(3000);
  const ver = await E(() => SillyTavern.getContext().getCurrentChatId ? 'ok' : 'no'); console.log('ST loaded', ver);
  // 1. 插件加载
  ok(await E(() => !!document.querySelector('#stp') && !!document.querySelector('#stp-ball')), '插件加载：手机和悬浮球都在');
  // 2. 酒馆连接配置：建两个（mock-a / mock-b）
  const sl = s => E(async s => { const c = SillyTavern.getContext(); const r = await c.executeSlashCommandsWithOptions(s); return r?.pipe; }, s);
  await sl('/model mock-a'); await W(500); await sl('/profile-create 测试A'); await W(800);
  await sl('/model mock-b'); await W(500); await sl('/profile-create 测试B'); await W(800);
  await sl('/profile 测试A'); await W(1500);
  const profs = await E(() => (SillyTavern.getContext().extensionSettings.connectionManager?.profiles || []).map(p => p.name + ':' + p.model + ':' + p.api));
  console.log('  profiles', profs); ok(profs.length >= 2, '酒馆里建好两个连接配置');
  ok(await E(() => typeof SillyTavern.getContext().ConnectionManagerRequestService?.sendRequest == 'function'), '真酒馆有 ConnectionManagerRequestService');
  // 3. 打开手机
  await p.click('#stp-ball'); await W(1200); await shot(p, 'r01_home');
  const core = `window.__c ||= await import('/scripts/extensions/third-party/X_XPhone/core.js')`;
  const mod = await E(async () => { for (const u of ['/scripts/extensions/third-party/X_XPhone/core.js']) { try { window.__c = await import(u); return u; } catch (e) { } } return ''; });
  ok(!!mod, '能拿到插件模块 ' + mod);
  // 4. 聊天模型设置页：列出连接配置，选测试B，测试连接走 mock-b
  await E(() => { __c.S.api.chat.src = 'tavern'; __c.S.api.chat.stp = ''; __c.APPS.settings.open(); }); await W(700);
  await E(() => document.querySelector('[data-a=api][data-x=chat]').click()); await W(800); await shot(p, 'r02_api');
  const rows = await E(() => [...document.querySelectorAll('.pg:last-child [data-a=stp]')].map(r => (r.classList.contains('on') ? '●' : '○') + r.querySelector('b').textContent + '|' + r.querySelector('small').textContent));
  console.log('  rows', rows); ok(rows.length == 3 && /测试A/.test(rows[0]), '设置页列出：跟随当前连接（现在是测试A）+ 两个配置');
  await fetch(MOCK + '/reset');
  await E(() => [...document.querySelectorAll('.pg:last-child [data-a=stp]')].find(r => /测试B/.test(r.textContent)).click()); await W(400);
  const r1 = await E(async () => { try { return await __c.llm('Reply in one short sentence.', '用一句话打个招呼', '测试'); } catch (e) { return 'ERR ' + e.message; } });
  let L = await log(); console.log('  llm →', r1, L.map(x => x.model + (x.stream ? '(stream)' : '')));
  ok(/mock-b/.test(r1) && L.at(-1)?.model == 'mock-b', '选「测试B」后手机调用走 mock-b（正文仍是测试A）');
  ok(await E(() => SillyTavern.getContext().extensionSettings.connectionManager.selectedProfile) == (await E(() => SillyTavern.getContext().extensionSettings.connectionManager.profiles.find(p => p.name == '测试A').id)), '没有切换酒馆正文用的连接');
  // 跟随当前
  await E(() => document.querySelector('.pg:last-child [data-a=stp][data-x=""]').click()); await W(300); await fetch(MOCK + '/reset');
  const r2 = await E(async () => { try { return await __c.llm('Reply in one short sentence.', '用一句话打个招呼', '测试'); } catch (e) { return 'ERR ' + e.message; } });
  L = await log(); console.log('  follow →', r2, L.map(x => x.model)); ok(/mock-a/.test(r2), '跟随当前连接 → generateRaw 走 mock-a');
  // 5. 状态栏 / 字号
  const m = await E(() => [document.querySelector('.sb').offsetHeight, getComputedStyle(document.querySelector('.pg:last-child .pg-t')).fontSize]); console.log('  sb', m);
  ok(m[0] == 28, '手机尺寸下状态栏 28px');
  await E(() => { while (__c.top()) __c.back(); }); await W(500);
  // 6. 正文内联同步：在酒馆里发一条消息，mock 回复带 <手机> 块
  await E(() => { __c.S.inline = true; __c.save?.(); document.querySelector('#stp-ball').click(); }); await W(600);
  const ctxChar = await E(() => { const c = SillyTavern.getContext(); return [c.characterId, c.name2, c.characters?.length]; }); console.log('  char', ctxChar);
  await fetch(MOCK + '/reset');
  await p.fill('#send_textarea', '你好'); await p.click('#send_but'); await W(6000);
  L = await log(); console.log('  main gen', L.map(x => [x.model, x.n, /手机同步格式/.test(x.sys + x.last) ? 'has-fmt' : 'no-fmt']));
  ok(L.some(x => x.all > 0), '正文生成请求到达假接口');
  const sysAll = await E(() => JSON.stringify(SillyTavern.getContext().extensionPrompts?.st_phone?.value || '').slice(0, 60)); console.log('  ext prompt', sysAll);
  const last = await E(() => { const c = SillyTavern.getContext(), m = c.chat.at(-1); return { mes: m.mes, sw: m.swipes?.[m.swipe_id ?? 0], dom: document.querySelector('#chat .mes:last-child .mes_text')?.textContent }; });
  console.log('  last msg', JSON.stringify(last).slice(0, 300));
  ok(!/<手机>|私聊\|/.test(last.mes) && !/私聊\|/.test(last.dom || '') && !/私聊\|/.test(last.sw || ''), '<手机> 块从正文、swipe、页面上都去掉了');
  const ph = await E(() => { const D = __c.D(), f = n => D.chats.find(c => [c.real, c.nick, c.name].includes(n)); return { jz: f('姜照临')?.msgs.map(m => m.text || m.type).join('/'), grp: f('PK学园2年级')?.msgs.map(m => m.text).join('/'), ht: f('海藤瞬') ? 'yes' : 'no', posts: D.posts.length }; });
  console.log('  phone', ph); ok(/周五烧烤/.test(ph.jz || '') && /第三章/.test(ph.grp || '') && ph.ht == 'yes' && ph.posts >= 1, '手机里收到：私聊、群聊、加好友、朋友圈');
  await W(800); await shot(p, 'r03_story');
  // 刷新后正文仍然干净
  await p.reload(); await p.waitForFunction(() => window.SillyTavern?.getContext?.()?.chat?.length, null, { timeout: 60000 }); await W(3000);
  ok(!/私聊\|/.test(await E(() => document.querySelector('#chat .mes:last-child .mes_text')?.textContent || '')), '刷新后正文里也没有 <手机> 块');
  await E(async () => { window.__c = await import('/scripts/extensions/third-party/X_XPhone/core.js'); });
  // 7. 手机里聊天：自动回复 + 发送键变方块
  await p.click('#stp-ball'); await W(800);
  await E(async () => { const ch = await import('/scripts/extensions/third-party/X_XPhone/apps/chat/chat.js'); __c.APPS.chat.open(); const c = __c.D().chats.find(c => c.real == '姜照临'); ch.openChat(c.id); }); await W(800);
  await fetch(MOCK + '/reset');
  await p.fill('#stp .ib textarea, #stp .ib input', '好呀几点'); await E(() => document.querySelector('#stp .go').click()); await W(500);
  ok(await E(() => document.querySelector('#stp .go').classList.contains('wait')), '发出后按钮变成等待方块');
  await W(4000); L = await log(); const msgs = await E(() => __c.D().chats.find(c => c.real == '姜照临').msgs.slice(-3).map(m => (m.f == 'me' ? '我:' : 'TA:') + (m.text || m.type)));
  console.log('  chat', msgs, L.map(x => x.model)); ok(L.length >= 1 && msgs.some(x => /收到啦/.test(x)), '1.5 秒后自动回复（走真酒馆）');
  await shot(p, 'r04_chat');
  // 8. 四种风格通讯录 + 加好友页
  await E(() => { while (__c.top()) __c.back(); __c.APPS.chat.open(); }); await W(500);
  await E(() => document.querySelector('[data-a=tab][data-x=ct]').click()); await W(400);
  for (const s of ['wx', 'qq', 'kk', 'line']) {
    await E(s => { __c.S.style = s; __c.emit('chat'); __c.top().re(); }, s); await W(500); await shot(p, 'r05_ct_' + s);
    await E(() => document.querySelector('#stp .pg-h [data-a=newfr], #stp .ct [data-a=newfr]').click()); await W(600); await shot(p, 'r06_nf_' + s);
    ok(await E(() => !!document.querySelector('.nfpg.in')), s + '：加好友页能打开'); await E(() => __c.back()); await W(500);
  }
  // 9. AI 生成联系人（真酒馆 + 测试B）
  await E(() => { __c.S.style = 'wx'; __c.S.api.chat.stp = __c.stProfiles().find(p => p.name == '测试B').id; __c.top().re(); }); await W(400); await fetch(MOCK + '/reset');
  await E(() => document.querySelector('#stp .pg-h [data-a=plus]').click()); await W(500); await p.click('#stp .sheet.mnu .mi >> nth=2'); await W(500); await p.click('#stp .sheet.mnu .mi >> nth=0'); await W(5000);
  await shot(p, 'r07_review'); L = await log(); console.log('  gen', L.map(x => x.model));
  ok(await E(() => document.querySelectorAll('.rv2 .rk, .rv2 [data-pk]').length) >= 2, 'AI 生成联系人：审阅单出现');
  // 10. 锁屏
  await E(() => { while (__c.top()) __c.back(); }); await W(300);
  console.log('page errors:', errs.join(' | ') || 'none'); console.log('console errors:', cons.filter(x => /XPhone|stp|小手机/.test(x)).join(' | ') || 'none');
  console.log(`${pass} passed, ${fail} failed`); await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
