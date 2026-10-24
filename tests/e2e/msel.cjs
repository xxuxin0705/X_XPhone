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
  await lp('.chat .msg[data-x="0"] .bub'); ok(/^复制,转发,引用/.test(await popItems()) && await E(`document.querySelectorAll('.mpop .mp-e b').length`) == 8, '文字消息：上面一排表情回应，下面复制 / 转发 / 引用…');
  await pk('e❤️'); ok(await E(`JSON.stringify(_g.msgs[0].re)`) == '[{"e":"❤️","by":"me"}]', '点表情回应：贴上 ❤️');
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
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
