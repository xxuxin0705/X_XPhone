// 聊天里长按消息（仿微信深色菜单）、多选消息（选择到这里 / 全选 / 删除 / 注入正文）、转发（逐条 / 合并，只写网名）、长按图片不弹系统大图
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8788);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAHElEQVR4nGP4/+/f/wP/H8hGjEoZBkaZjQYGBgAAFVd4E9ZVzYcAAAAASUVORK5CYII=', 'base64');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  await ctx.route(/img\.test/, r => r.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8788/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  const lp = async sel => { const r = await E(`(() => { const b = document.querySelector('${sel}').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`); await p.mouse.move(r[0], r[1]); await p.mouse.down(); await W(650); await p.mouse.up(); await W(300); };
  const pk = async k => { await E(`document.querySelector('.mpop [data-k="${k}"]').click()`); await W(350); };
  const pick = async x => { await E(`document.querySelector('.sheet.mnu.in [data-a=pick][data-x="${x}"]').click()`); await W(350); };
  const popItems = () => E(`[...document.querySelectorAll('.mpop .mp-g span')].map(s => s.textContent).join()`);
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js');
    core.D().me.nick = '苹果'; core.S.assets.sticker = [];
    const g = dt.add(dt.blank('g', { name: '女公关部' })); const a = dt.add(dt.blank('p', { real: '吴悠', nick: '悠悠3.26', fr: 1 })), q = dt.add(dt.blank('p', { real: '齐琦', nick: '齐琦5.2', fr: 1 })); g.members = [a.id, q.id];
    window._t = dt.add(dt.blank('p', { real: '绷带盐', nick: '盐', fr: 1 })); window._g = g; const t = Date.now();
    g.msgs = [{ f: a.id, t: 'text', c: '我真不行了', ts: t }, { f: a.id, t: 'sticker', c: '表情', img: 'https://img.test/cry.png', ts: t }, { f: q.id, t: 'text', c: '又感性了', ts: t }, { f: 'me', t: 'text', c: '我靠！我恨死搬家了！', ts: t }, { f: a.id, t: 'text', c: '大半夜的', ts: t }];
    core.saveD(); core.APPS.chat.open(); talk.openChat(g.id); })()`); await W(700);
  // 1. 长按图片：不弹系统的「保存图片」
  ok(await E(`(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('.chat img.stk').dispatchEvent(e); return e.defaultPrevented; })()`), '长按图片：拦掉浏览器自己的「保存这张图片 / 大图」');
  // 2. 长按表情：深色气泡菜单，没添加过的可以「添加」
  await lp('.chat .msg[data-x="1"] .bub');
  ok(await E(`!!document.querySelector('.mpop') && getComputedStyle(document.querySelector('.mpop')).backgroundColor == 'rgb(76, 76, 76)'`), '长按消息：消息旁边弹出深色菜单（仿微信）');
  const it1 = await popItems(); ok(/^添加,转发,引用,多选/.test(it1) && !/复制/.test(it1), '没添加过的表情：添加 / 转发 / 引用 / 多选… ' + it1);
  await p.screenshot({ path: path.join(OUT, 'msel_a.png') });
  await pk('add'); ok(await E(`core.S.assets.sticker[0]?.img`) == 'https://img.test/cry.png', '点「添加」：存进我的表情');
  await lp('.chat .msg[data-x="1"] .bub'); ok(!/添加/.test(await popItems()), '已经添加过的表情：菜单里不再有「添加」'); await E(`document.querySelector('.mpop-m').click()`); await W(250);
  ok(!(await E(`!!document.querySelector('.mpop-m')`)), '点空白处关闭菜单');
  // 文字消息：表情回应 + 复制
  const st0 = await E(`_g.cfg.style || ''`); await E(`_g.cfg.style = 'wx'; core.emit('chat')`); await W(150);
  await lp('.chat .msg[data-x="0"] .bub'); ok(!(await E(`!!document.querySelector('.mpop .mp-e')`)) && !/注入正文/.test(await popItems()), '微信风格：长按没有贴表情，也没有「注入正文」'); await E(`document.querySelector('.mpop-m').click()`); await W(250);
  await E(`_g.cfg.style = 'qq'; core.emit('chat')`); await W(150);
  await lp('.chat .msg[data-x="0"] .bub'); ok(/^复制,转发,引用/.test(await popItems()) && await E(`document.querySelectorAll('.mpop .mp-e b').length`) == 8, '文字消息：上面一排表情回应，下面复制 / 转发 / 引用…');
  await E(`_g.cfg.style = '${st0}'; core.emit('chat')`); await W(150);
  await pk('~❤️'); ok(await E(`JSON.stringify(_g.msgs[0].re)`) == '[{"e":"❤️","by":"me"}]', '点表情回应：贴上 ❤️');
  // 3. 多选
  await lp('.chat .msg[data-x="2"] .bub'); await pk('multi'); await W(200);
  ok(await E(`!!document.querySelector('.chat .cv.msel') && document.querySelectorAll('.chat .mck').length == 5`) && /已选择 1 条消息/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '多选：每条前面有圆圈，标题「已选择 1 条消息」');
  ok(/取消/.test(await E(`document.querySelector('.chat .pg-t').textContent`)) && /全选/.test(await E(`document.querySelector('.chat .pg-r').textContent`)) && await E(`[...document.querySelectorAll('.mbar2 span')].map(s => s.textContent).join()`) == '转发,注入正文,删除', '左上「取消」、右上「全选」，底下 转发 / 注入正文 / 删除');
  await E(`document.querySelector('.chat .msg[data-x="0"]').click()`); await W(150);
  ok(/已选择 2 条消息/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '点消息：勾上');
  await E(`document.querySelector('.chat [data-a=selto]').click()`); await W(150);
  ok(/已选择 5 条消息/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '「选择到这里」：从第一条选中的一直选到看得见的最后一条');
  await E(`document.querySelector('.chat [data-a=selall]').click()`); await W(150); ok(/已选择 0 条/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '全部选上时再点：全不选');
  await E(`document.querySelector('.chat [data-a=selall]').click()`); await W(150); ok(/已选择 5 条/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '全选');
  await E(`document.querySelector('.chat .msg[data-x="4"]').click(); document.querySelector('.chat .msg[data-x="1"]').click()`); await W(150);
  await p.screenshot({ path: path.join(OUT, 'msel_b.png') });
  // 4. 合并转发：名字只写网名
  await E(`document.querySelector('.mbar2 [data-a=sfwd]').click()`); await W(350); await pick('all'); await E(`document.querySelector('.sheet.mnu.in [data-a=pick][data-x="${await E('_t.id')}"]').click()`); await W(400);
  const rec = await E(`JSON.stringify(_t.msgs.at(-1))`);
  ok(/"t":"rec"/.test(rec) && /群聊的聊天记录/.test(rec) && /"n":"悠悠3.26","c":"我真不行了"/.test(rec) && /"n":"齐琦5.2"/.test(rec) && /"n":"苹果"/.test(rec) && !/吴悠|齐琦"/.test(rec), '合并转发：一张「群聊的聊天记录」卡片，名字只写网名 ' + rec.slice(0, 160));
  ok(!(await E(`!!document.querySelector('.chat .cv.msel')`)), '转发完自动退出多选');
  ok(/\[转发了一段聊天记录「群聊的聊天记录」：悠悠3\.26: 我真不行了/.test(await E(`core.say(_t.msgs.at(-1))`)), '对方（AI）看到的是带网名的聊天记录内容');
  // 5. 逐条转发
  await lp('.chat .msg[data-x="3"] .bub'); await pk('multi'); await E(`document.querySelector('.chat .msg[data-x="1"]').click()`); await W(150);
  await E(`document.querySelector('.mbar2 [data-a=sfwd]').click()`); await W(350); await pick('one'); await E(`document.querySelector('.sheet.mnu.in [data-a=pick][data-x="${await E('_t.id')}"]').click()`); await W(400);
  ok(await E(`_t.msgs.slice(-2).map(m => m.f + ':' + m.t + ':' + (m.img || m.c)).join('|')`) == 'me:sticker:https://img.test/cry.png|me:text:我靠！我恨死搬家了！', '逐条转发：按原来的顺序一条条发过去');
  // 6. 删除
  await lp('.chat .msg[data-x="4"] .bub'); await pk('multi'); await E(`document.querySelector('.chat .msg[data-x="0"]').click()`); await W(150);
  await E(`document.querySelector('.mbar2 [data-a=sdel]').click()`); await W(350); await pick('y');
  ok(await E(`_g.msgs.map(m => m.c).join('|')`) == '表情|又感性了|我靠！我恨死搬家了！', '多选删除');
  // 7. 卡片显示 + 打开
  await E(`talk.openChat(_t.id)`); await W(700);
  ok(/群聊的聊天记录[\s\S]*悠悠3\.26: 我真不行了[\s\S]*聊天记录/.test(await E(`document.querySelector('.chat .rec').textContent`)), '聊天记录卡片：标题 + 前几条 + 「聊天记录」');
  await p.screenshot({ path: path.join(OUT, 'msel_c.png') });
  await E(`document.querySelector('.chat .rec').click()`); await W(500);
  ok(await E(`document.querySelectorAll('.recpg .rec-i').length`) == 3, '点开卡片：看全部转发的消息');
  // 8. 系统提示（拍一拍）也能长按删除 / 多选；编辑；没有朗读
  await E(`core.back()`); await W(300);
  await E(`(() => { _t.msgs.push({ f: _t.id, t: 'pat', c: '“盐” 拍了拍我的肩膀', ts: Date.now() }, { f: _t.id, t: 'text', c: '你好呀', tr: '', ts: Date.now() }); core.emit('chat'); })()`); await W(300);
  const pi = await E(`_t.msgs.length - 2`);
  await lp(`.chat .sys[data-x="${pi}"]`); ok(await popItems() == '多选,删除', '长按拍一拍提示：多选 / 删除');
  await pk('del'); ok(!(await E(`_t.msgs.some(m => m.t == 'pat')`)), '拍一拍提示删掉了');
  const ti = await E(`_t.msgs.length - 1`);
  await lp(`.chat .msg[data-x="${ti}"] .bub`); const it2 = await popItems();
  ok(/编辑/.test(it2) && !/朗读|翻译/.test(it2), '文字消息：有「编辑」，没有朗读和翻译 ' + it2); await pk('edit');
  await p.fill('.sheet.in [data-k=c]', '你好呀～'); await E(`document.querySelector('.sheet.in [data-k=c]').dispatchEvent(new Event('change', { bubbles: true }))`); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(300);
  ok(await E(`_t.msgs.at(-1).c`) == '你好呀～', '编辑：改了内容');
  await E(`_t.msgs.push({ f: _t.id, t: 'pat', c: '“盐” 拍了拍我', ts: Date.now() }); core.emit('chat')`); await W(200);
  await lp(`.chat .msg[data-x="${ti}"] .bub`); await pk('multi'); await E(`document.querySelector('.chat .sys[data-x="${ti + 1}"]').click()`); await W(150);
  ok(/已选择 2 条/.test(await E(`document.querySelector('.chat .pg-t').textContent`)), '多选时拍一拍提示也能勾');
  ok(await E(`getComputedStyle(document.querySelector('.chat .pg-r .txt')).color`) == await E(`getComputedStyle(document.querySelector('.chat .pg-t b:last-child')).color`), '「全选」和标题一个颜色（不再是粉色）');
  ok(await E(`getComputedStyle(document.querySelector('.chat .msg.on .mck')).backgroundColor`) == 'rgb(7, 193, 96)', '微信风格：勾是微信绿');
  await E(`core.S.style = 'kk'; document.querySelector('.chat').className = document.querySelector('.chat').className.replace('st-wx', 'st-kk')`); await W(100);
  ok(await E(`getComputedStyle(document.querySelector('.chat .msg.on .mck')).backgroundColor`) == 'rgb(254, 229, 0)', 'Kakao 风格：勾变成 Kakao 黄');
  await p.screenshot({ path: path.join(OUT, 'msel_d.png') });
  await E(`document.querySelector('.chat [data-a=sdel]').click()`); await W(300); await pick('y'); await E(`core.S.style = 'wx'`);
  // 9. 翻译补漏：漏了 [翻译] 补中文，写成中文的翻成韩语
  await ctx.route(/\/api\/translate\/google/, r => { const b = JSON.parse(r.request().postData()); r.fulfill({ status: 200, body: b.lang == 'ko' ? '뭐야' : '什么呀' }); });
  await E(`(async () => { window._k = dt.add(dt.blank('p', { real: '姜照临', fr: 1 })); _k.cfg.lang = 'ko'; core.S.api.chat = { src: 'custom', cur: 'a', list: [{ id: 'a', name: 'x', url: 'https://relay.test/v1', key: 'k', model: 'm' }] }; talk.openChat(_k.id); })()`); await W(500);
  await ctx.route(/relay\.test/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ['姜照临: 뭐야? [翻译:什么？]', '姜照临: 뭐야', '姜照临: 别装死啊'].map(l => `data: ${JSON.stringify({ choices: [{ delta: { content: l + '\n' } }] })}\n\n`).join('') + 'data: [DONE]\n\n' }));
  let nTr = 0; await ctx.route(/\/api\/translate\//, r => { nTr++; r.fulfill({ status: 200, body: '' }); });
  await E(`talk.gen(_k)`); await W(3500);
  const kk0 = await E(`JSON.stringify(_k.msgs.map(m => [m.c, m.tr]))`);
  ok(kk0 == '[["뭐야?","什么？"],["뭐야",""],["别装死啊",""]]' && nTr == 0, '翻译不另外调用机翻：漏写的先原样放着 ' + kk0);
  // 下一轮回复时顺带让模型补（[补译]），不额外调用
  let p2 = ''; await ctx.route(/relay\.test/, r => { p2 = r.request().postData(); r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ['[补译:1|뭐야|什么呀]', '[补译:2|죽은 척하지 마|别装死啊]'].map(l => `data: ${JSON.stringify({ choices: [{ delta: { content: l + '\n' } }] })}\n\n`).join('') + 'data: [DONE]\n\n' }); });
  await E(`talk.gen(_k)`); await W(1500);
  const kk = await E(`JSON.stringify(_k.msgs.map(m => [m.c, m.tr]))`);
  ok(/补全翻译/.test(p2) && /#1 /.test(p2) && !/#0 /.test(p2) && kk == '[["뭐야?","什么？"],["뭐야","什么呀"],["죽은 척하지 마","别装死啊"]]', '下一轮顺带补译：漏写的补中文、写成中文的换成韩语原文 ' + kk);
  await E(`_k.cfg.trAuto = false; core.emit('chat')`); await W(200);
  ok(!/뭐야/.test(await E(`document.querySelector('.chat .cv').textContent`)) && /别装死啊/.test(await E(`document.querySelector('.chat .cv').textContent`)), '关掉自动翻译：直接显示中文');
  await E(`_k.cfg.trAuto = true; core.emit('chat')`); await W(200);
  // 10. 拍一拍格式（跟微信一样）
  await E(`(() => { [['的肩膀'], ['拍了拍你的脑袋'], ['揉了揉你的头发'], ['']].forEach(([t]) => dt.addMsg(_k, { from: '姜照临', type: 'pat', text: t })); _k.msgs.push({ f: _k.id, t: 'pat', c: '“姜照临” 的肩膀', ts: Date.now() }); core.emit('chat'); })()`); await W(300);
  const pats = await E(`[...document.querySelectorAll('.chat .sys.pat')].map(e => e.textContent).join('|')`);
  ok(pats == Array(5).fill('“姜照临” 拍了拍你').join('|'), '拍一拍：没设后缀就是「“X” 拍了拍你」，模型写的「的肩膀」「揉了揉」都不用；以前存坏的「“X” 的肩膀」也改回来 ' + pats);
  // 11. Kakao：Enter a message、输入栏样式、未读 1 紧贴气泡
  await E(`core.S.style = 'kk'; talk.openChat(_k.id)`); await W(600);
  ok(await E(`document.querySelector('.chat .ip').placeholder`) == 'Enter a message', 'Kakao 风格：输入框写 Enter a message');
  const ord = await E(`[...document.querySelectorAll('.chat .ib > *')].filter(e => getComputedStyle(e).display != 'none').map(e => [e.dataset.x || e.className.split(' ')[0], getComputedStyle(e).order]).sort((a, b) => a[1] - b[1]).map(x => x[0]).join()`);
  ok(ord == 'more,ip,stk,go' && await E(`getComputedStyle(document.querySelector('.chat .ib .ip')).borderRadius`) == '20px', 'Kakao 输入栏：左边 ＋，中间圆角输入框（表情按钮在框里），右边圆按钮 ' + ord);
  await E(`_k.msgs.push({ f: 'me', t: 'text', c: '?', ts: Date.now() }); core.emit('chat')`); await W(300);
  const gap = await E(`(() => { const m = [...document.querySelectorAll('.chat .msg.me')].at(-1), r = m.querySelector('.rd.un').getBoundingClientRect(), b = m.querySelector('.bub').getBoundingClientRect(); return Math.round(b.left - r.right); })()`);
  ok(gap >= 0 && gap <= 8, 'Kakao 未读「1」紧贴着气泡（间隔 ' + gap + 'px）');
  await p.screenshot({ path: path.join(OUT, 'msel_e.png') });
  // 12. 点聊天内容：收起表情面板
  await E(`document.querySelector('.chat [data-a=pan][data-x=stk]').click()`); await W(300); ok(await E(`!!document.querySelector('.chat .pan.on')`), '（打开表情面板）');
  const bb = await E(`(() => { const r = document.querySelector('.chat .pg-b').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 60]; })()`); await p.mouse.click(bb[0], bb[1]); await W(250);
  ok(!(await E(`!!document.querySelector('.chat .pan.on')`)), '点一下聊天内容：表情面板收起来');
  await E(`core.S.style = 'wx'`);
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
