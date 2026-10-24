// 表情包搜索（仿微信「搜索表情」）：搜索页、最近搜索、结果、预览发送、添加到表情、AI 表情包自动配图、来源切换和兜底
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8786);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
// 小图：每个关键词一种颜色，方便截图里看出来
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVR42mP8z8BQz0AEYBxVSF+FjP///ycqDEYVjiocVUhfhYwMDAwAkvkP8f7ZOV8AAAAASUVORK5CYII=', 'base64');
const reqs = []; let sogouDown = false, noCors = false;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const J = (r, o, cors = true) => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', ...(cors && { 'access-control-allow-origin': '*' }) }, body: JSON.stringify(o) });
  const res = (w, n, pg) => Array.from({ length: n }, (_, i) => `https://i01piccdn.sogoucdn.com/${encodeURIComponent(w)}_${pg}_${i}`);
  await ctx.route(/cn\.apihz\.cn/, r => { const u = new URL(r.request().url()); reqs.push(u.href); const w = u.searchParams.get('words'), pg = +u.searchParams.get('page') || 1;
    if (noCors) return r.abort('failed'); // 模拟浏览器跨域拦截：fetch 直接报错
    if (/sougou/.test(u.pathname) && sogouDown) return J(r, { code: 400, msg: '频率超限' });
    return J(r, { code: 200, page: String(pg), res: w == '空空' ? [] : res(w, pg > 1 ? 6 : 16, pg) }, !noCors); });
  await ctx.route(/localhost:8786\/proxy\//, r => { const u = new URL(r.request().url().replace(/^.*?\/proxy\//, '')); reqs.push('PROXY ' + u.href); J(r, { code: 200, page: '1', res: res(u.searchParams.get('words'), 16, 1) }); });
  await ctx.route(/api\.giphy\.com/, r => { reqs.push(r.request().url()); J(r, { data: [{ images: { fixed_width: { url: 'https://media.giphy.com/a.gif' }, fixed_width_small: { url: 'https://media.giphy.com/a_s.gif' } } }], meta: { status: 200 } }); });
  await ctx.route(/sogoucdn\.com|media\.giphy\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8786/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); core.APPS.chat.open(); const c = dt.add(dt.blank('p', { real: '齐木楠雄', nick: '齐木', fr: 1 })); core.saveD(); talk.openChat(c.id); window._c = c; })()`); await W(600);
  // 打开表情面板 → 搜索
  await E(`document.querySelector('.chat [data-a=pan][data-x=stk]').click()`); await W(300);
  ok(await E(`!!document.querySelector('.pan.on .ptabs [data-a=stks]')`), '表情面板左上角有「搜索表情」按钮');
  await E(`document.querySelector('.pan .ptabs [data-a=stks]').click()`); await W(500);
  ok(await E(`!!document.querySelector('.skspg.in .sks-ip') && !document.querySelector('.pan.on')`), '点了打开「搜索表情」页，表情面板收起');
  ok(/大家都在搜/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)) && !/最近搜索/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)), '还没搜过：只显示「大家都在搜」');
  await p.screenshot({ path: path.join(OUT, 'stk_a.png') });
  // 输入关键词：停顿一下自动搜
  await p.fill('.skspg .sks-ip', '你好'); await W(300);
  ok(reqs.length == 0, '打字时先不搜（等停顿）'); await W(500);
  ok(await E(`!!document.querySelector('.skspg .sks-st .spin') || document.querySelectorAll('.skspg .sks-i').length > 0`), '停顿后开始搜索（转圈或已有结果）'); await W(500);
  const u0 = reqs[0] ? new URL(reqs[0]) : null;
  ok(u0 && /apihzbqbsougou\.php$/.test(u0.pathname) && u0.searchParams.get('words') == '你好' && u0.searchParams.get('id') == '88888888' && u0.searchParams.get('key') == '88888888', '默认走搜狗表情，没填 ID/Key 用公共测试号：' + (reqs[0] || ''));
  ok(await E(`document.querySelectorAll('.skspg .sks-i img').length`) == 16 && await E(`document.querySelector('.skspg .sks-i img').referrerPolicy`) == 'no-referrer', '出现 16 张表情图（不带 referrer，防盗链）');
  ok(/全部表情/.test(await E(`document.querySelector('.skspg .sks-tab').textContent`)), '结果上方有「全部表情」标签');
  await W(300); await p.screenshot({ path: path.join(OUT, 'stk_b.png') });
  // 加载更多
  await E(`document.querySelector('.skspg [data-a=skmore]').click()`); await W(500);
  ok(await E(`document.querySelectorAll('.skspg .sks-i').length`) == 22 && /page=2/.test(reqs.at(-1)), '加载更多：第 2 页接在后面');
  // 点一张 → 预览 → 发送
  await E(`document.querySelectorAll('.skspg .sks-i')[2].click()`); await W(300);
  ok(await E(`!document.querySelector('.skspg .sks-pv').hidden && !!document.querySelector('.sks-pc img')`), '点一下：弹出大图预览，有「发送」和「添加到表情」');
  await p.screenshot({ path: path.join(OUT, 'stk_c.png') });
  await E(`document.querySelector('.sks-pc [data-a=skfav]').click()`); await W(200);
  ok(await E(`core.S.assets.sticker.at(-1).name`) == '你好' && /你好_1_2/.test(decodeURIComponent(await E(`core.S.assets.sticker.at(-1).img`))), '添加到表情：存进表情库，名字是搜索词');
  await E(`document.querySelectorAll('.skspg .sks-i')[3].click()`); await W(200); await E(`document.querySelector('.sks-pc [data-a=sksend]').click()`); await W(600);
  const last = decodeURIComponent(await E(`JSON.stringify(_c.msgs.at(-1))`));
  ok(/"t":"sticker"/.test(last) && /你好_1_3/.test(last) && /"f":"me"/.test(last), '发送：聊天里多了一条我发的表情 ' + last.slice(0, 120));
  ok(await E(`!document.querySelector('.skspg.in') && !!document.querySelector('.chat .me img.stk, .chat img.stk')`), '发送后回到聊天，表情图显示在气泡里');
  await p.screenshot({ path: path.join(OUT, 'stk_d.png') });
  // 再打开：最近搜索
  await E(`document.querySelector('.chat [data-a=pan][data-x=stk]').click()`); await W(200); await E(`document.querySelector('.pan .ptabs [data-a=stks]').click()`); await W(500);
  ok(await E(`[...document.querySelectorAll('.skspg .sks-ch')[0].querySelectorAll('b')].map(b => b.textContent).join()`) == '你好', '再打开：「最近搜索」里有「你好」');
  reqs.length = 0; await E(`document.querySelector('.skspg [data-a=skq][data-x="你好"]').click()`); await W(300);
  ok(reqs.length == 0 && await E(`document.querySelectorAll('.skspg .sks-i').length`) == 16, '点最近搜索：直接出结果（有缓存，不重复请求）');
  // 按回车搜、没结果
  await p.fill('.skspg .sks-ip', '空空'); await p.press('.skspg .sks-ip', 'Enter'); await W(500);
  ok(/没有找到「空空」/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)), '回车搜索；没结果时提示「没有找到」');
  // 清空 ×
  await E(`document.querySelector('.skspg [data-a=skx]').click()`); await W(200);
  ok(await E(`document.querySelector('.skspg .sks-ip').value`) == '' && /最近搜索/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)), '点 × 清空，回到最近搜索');
  await E(`document.querySelector('.skspg [data-a=skclr]').click()`); await W(200); ok(await E(`core.S.stk.recent.length`) == 0, '最近搜索可以清空');
  await E(`core.back()`); await W(400);
  // 搜狗出错 → 自动换百度
  sogouDown = true; reqs.length = 0; const r1 = await E(`core.stkSearch('摸摸头').then(L => L.length)`);
  ok(r1 == 16 && reqs.some(u => /sougou/.test(u)) && reqs.some(u => /apihzbqbbaidu\.php/.test(u) && /limit=24/.test(u)), '搜狗出错时自动换百度表情'); sogouDown = false;
  // AI 发表情包：库里没有 → 自动在线搜一张
  reqs.length = 0;
  await E(`(() => { dt.addMsg(_c, { from: '齐木', type: 'sticker', text: '无语' }); core.saveD(); core.emit('chat'); })()`); await W(900);
  const am = decodeURIComponent(await E(`JSON.stringify(_c.msgs.at(-1))`));
  ok(/"t":"sticker"/.test(am) && /无语_1_[0-3]/.test(am) && reqs.some(u => /words=%E6%97%A0%E8%AF%AD/.test(u)), 'AI 发 [表情包:无语]：自动搜到一张真表情图 ' + am.slice(0, 120));
  ok(await E(`[...document.querySelectorAll('.chat img.stk')].some(i => /无语/.test(decodeURIComponent(i.src)))`), '聊天里直接显示这张表情图');
  await p.screenshot({ path: path.join(OUT, 'stk_e.png') });
  // 关掉自动配图 → 只显示颜文字
  await E(`core.S.stk.auto = false; dt.addMsg(_c, { from: '齐木', type: 'sticker', text: '晚安' }); core.emit('chat')`); await W(600);
  ok(await E(`!_c.msgs.at(-1).img && !!document.querySelector('.chat .stk0')`), '关掉自动配图：AI 表情只显示颜文字占位'); await E(`core.S.stk.auto = true`);
  // 跨域被拦 → 走酒馆 /proxy/
  noCors = true; reqs.length = 0; const r2 = await E(`core.stkSearch('贴贴').then(L => L.length, e => 'ERR ' + e.message)`);
  ok(r2 == 16 && reqs.some(u => /^PROXY .*words=%E8%B4%B4%E8%B4%B4/.test(u)), '直连被跨域拦截时改走酒馆 /proxy/：' + r2); noCors = false;
  // 设置页：来源切换
  await E(`core.home(); core.APPS.settings.open()`); await W(500);
  ok(/搜狗表情/.test(await E(`document.querySelector('[data-a=stkp]').textContent`)), '设置首页有「表情包搜索」，显示当前来源');
  await E(`document.querySelector('[data-a=stkp]').click()`); await W(500);
  ok(await E(`!!document.querySelector('[data-k="stk.id"]') && !!document.querySelector('[data-k="stk.key"]')`), '搜狗来源：可以填自己的 ID / 秘钥');
  await p.screenshot({ path: path.join(OUT, 'stk_f.png') });
  await E(`document.querySelector('[data-a=seg][data-x=giphy]').click()`); await W(300);
  ok(await E(`!!document.querySelector('[data-k="stk.gk"]')`), '切到 GIPHY：显示 Key 输入框');
  reqs.length = 0; await E(`core.stkSearch('哈哈哈')`); ok(reqs.every(u => /apihz/.test(u)), 'GIPHY 没填 Key：自动用搜狗');
  await p.fill('[data-k="stk.gk"]', 'gk1'); await p.press('[data-k="stk.gk"]', 'Tab'); await W(200);
  reqs.length = 0; const g = await E(`core.stkSearch('cat').then(L => L[0].img)`);
  ok(g == 'https://media.giphy.com/a.gif' && /api\.giphy\.com\/v1\/stickers\/search\?api_key=gk1&q=cat/.test(reqs[0] || ''), 'GIPHY：带 Key 搜贴纸 ' + (reqs[0] || ''));
  await E(`document.querySelector('[data-a=stkt]').click()`); await W(400);
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
