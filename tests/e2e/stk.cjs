// 表情包：表情面板（仿微信图标栏）、表情商店、表情包组详情、搜索表情（库里可爱风优先 + 网络补充）、AI 表情自动配图、图片线路兜底
// 另外测：翻译按钮（不跳到底、两边一样）、Kakao 未读「1」
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8786);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVR42mP8z8BQz0AEYBxVSF+FjP///ycqDEYVjiocVUhfhYwMDAwAkvkP8f7ZOV8AAAAASUVORK5CYII=', 'base64');
// 模拟 ChineseBQB 的公开索引
const H = i => (i.toString(16).padStart(4, '0')).repeat(16);
const BQB = [];
const cat = (num, folder, prefix, names) => { BQB.push({ name: '0000000' + num + '.jpg', category: 'bqb-' + num, folder, src: `media/${H(+num * 100)}.jpg`, animated: false, bytes: 2e4 });
  names.forEach((n, i) => BQB.push({ name: `${prefix}0000${i + 1}-${n}.gif`, category: 'bqb-' + num, folder, src: `media/${H(+num * 100 + i + 1)}.gif`, animated: true, bytes: i == 0 ? 4e6 : 3e5 })); };
cat('049', '049CatEveryday_猫咪日常BQB', '猫咪日常', ['开心到转圈', '你知道我要说什么吧', '委屈巴巴', '晚安喵']);
cat('010', '010Cat_是喵星人啦🐱BQB', '是喵星人啦', ['震惊猫', '开心猫', '哭了猫']);
cat('015', '015Golden_Curator_Panda金馆长熊猫🐼BQB', '金馆长熊猫', ['开心就好', '无语', '傲娇']);
BQB.push({ name: 'Trump00001-x.jpg', category: 'bqb-064', folder: '064Trump_特朗普BQB', src: `media/${H(9999)}.jpg`, bytes: 1 });
const reqs = []; let sogouDown = false, mirrorDown = false;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const J = (r, o) => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  const img = r => r.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG });
  await ctx.route(/zhaoolee\.com\/ChineseBQB\/catalog\/search\.json/, r => { reqs.push(r.request().url()); J(r, BQB); });
  await ctx.route(/zhaoolee\.com\/ChineseBQB\/(thumbs|media)\//, img);
  await ctx.route(/registry\.npmmirror\.com/, r => { reqs.push(r.request().url()); mirrorDown ? r.fulfill({ status: 404, body: '' }) : img(r); });
  await ctx.route(/unpkg\.com|cdn\.jsdelivr\.net|sogoucdn\.com/, r => { reqs.push(r.request().url()); img(r); });
  await ctx.route(/cn\.apihz\.cn/, r => { const u = new URL(r.request().url()); reqs.push(u.href); const w = u.searchParams.get('words');
    if (/sougou/.test(u.pathname) && sogouDown) return J(r, { code: 400, msg: '频率超限' });
    J(r, { code: 200, page: '1', res: Array.from({ length: 12 }, (_, i) => `https://i01piccdn.sogoucdn.com/${encodeURIComponent(w)}_${i}`) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8786/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), dec = s => decodeURIComponent(s);
  await E(`(async () => { localStorage.removeItem('stp_bqb_v1'); window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.sk = await import('/apps/chat/sticker.js'); core.S.stk.auto = false; core.S.stk.v = 1; core.S.stk.packs = ['hoyoverse-hi3', 'b049', 'bilibili', 'b010']; core.APPS.chat.open(); const c = dt.add(dt.blank('p', { real: '齐木楠雄', nick: '齐木', fr: 1 })); core.saveD(); talk.openChat(c.id); window._c = c; })()`); await W(600);
  const last = async () => JSON.parse(dec(await E(`JSON.stringify(_c.msgs.at(-1) || null)`)));
  // 1. 表情面板
  await E(`document.querySelector('.chat [data-a=pan][data-x=stk]').click()`); await W(500);
  const icons = await E(`[...document.querySelectorAll('.pan.on .pbar .pi')].map(b => b.dataset.x || b.dataset.a)`);
  ok(JSON.stringify(icons) == JSON.stringify(['stks', 'emo', 'fav', 'qq', 'weibo', 'tieba', 'pstore']), '旧版默认的几组：换成默认的 QQ / 微博 / 贴吧三组 ' + icons);
  // 后面的测试要用到萌宠这些组：手动加上
  await E(`(() => { core.S.stk.packs = ['f-pets', 'f-face', 'f-love', 'qq', 'weibo', 'tieba', 'hoyoverse-hi3']; core.emit('stk'); document.querySelector('.chat [data-a=pan][data-x=stk]').click(); })()`); await W(300);
  await E(`document.querySelector('.chat [data-a=pan][data-x=stk]').click()`); await W(500);
  await E(`document.querySelector('.pan.on .pbar [data-x="f-pets"]')?.click()`); await W(400);
  ok(/萌宠动起来/.test(await E(`document.querySelector('.pan .ph').textContent`)) && await E(`document.querySelectorAll('.pan .pgrid .sk').length`) > 50, '默认打开「萌宠动起来」');
  ok(await E(`[...document.querySelectorAll('.pan .pgrid .sk small')].map(s => s.textContent).slice(0, 3).join()`) == '猫猫,开心猫,笑嘻嘻猫', '表情下面有中文名字');
  ok(/fluent-emoji-3d\/1\.1\.0\/files\/assets\/1f431\.webp/.test(await E(`document.querySelector('.pan .pgrid .sk img').src`)), '面板里是静态 3D 小图');
  await W(300); await p.screenshot({ path: path.join(OUT, 'stk_a.png') });
  await E(`document.querySelectorAll('.pan .pgrid .sk')[0].click()`); await W(400);
  let m = await last();
  ok(m?.t == 'sticker' && /registry\.npmmirror\.com\/@lobehub\/fluent-emoji-anim-1\/1\.0\.0\/files\/assets\/1f431\.webp/.test(m.img) && /cdn\.jsdelivr\.net/.test(m.alt) && /fluent-emoji-3d/.test(m.alt), '点一下直接发出会动的版本：走国内 npm 镜像，备用线路也存着');
  ok(m.c == '猫猫', '消息里记的是表情名字「猫猫」');
  await E(`document.querySelector('.pan .pbar [data-x=hoyoverse-hi3]').click()`); await W(300);
  ok(await E(`[...document.querySelectorAll('.pan .pgrid .sk small')].map(s => s.textContent).includes('害怕')`), '崩坏3：英文名已翻成中文');
  // 2. ChineseBQB 组（读公开索引）
  await E(`sk.addPack('b049')`); await W(300); await E(`document.querySelector('.pan .pbar [data-x=b049]').click()`); await W(700);
  ok(reqs.some(u => /zhaoolee\.com\/ChineseBQB\/catalog\/search\.json/.test(u)), '读取 ChineseBQB 的公开索引（只读一次）');
  const labs = await E(`[...document.querySelectorAll('.pan .pgrid .sk small')].map(s => s.textContent)`);
  ok(JSON.stringify(labs) == JSON.stringify(['开心到转圈', '你知道我要说什么吧', '委屈巴巴', '晚安喵']), '「猫咪日常」：封面图不算，名字去掉了编号前缀 ' + labs);
  ok(/thumbs\/.*\.webp/.test(await E(`document.querySelector('.pan .pgrid .sk img').src`)), '面板里用小缩略图（webp），省流量');
  await E(`document.querySelectorAll('.pan .pgrid .sk')[1].click()`); await W(300); m = await last();
  ok(/zhaoolee\.com\/ChineseBQB\/media\/.*\.gif$/.test(m.img) && /cdn\.jsdelivr\.net\/gh\/zhaoolee\/ChineseBQB@master\/049CatEveryday/.test(m.alt), '发出的是原图（动图），备用 jsDelivr 线路');
  await E(`document.querySelectorAll('.pan .pgrid .sk')[0].click()`); await W(300); m = await last();
  ok(/thumbs\//.test(m.img), '超过 2.5MB 的大动图发缩略图，不卡');
  ok(await E(`!!document.querySelector('.pan.on')`), '发完表情面板还开着（跟微信一样）');
  // 3. 表情商店
  await E(`document.querySelector('.pan .pbar [data-a=pstore]').click()`); await W(700);
  ok(await E(`!!document.querySelector('.spstore.in') && document.querySelectorAll('.spstore .sp-cc').length == 6`), '表情商店：顶部轮播 6 个精选');
  ok(/精选表情.*更多表情/.test(await E(`document.querySelector('.spstore .pg-t').textContent`)), '标题栏有「精选表情 / 更多表情」');
  const rows = await E(`[...document.querySelectorAll('.spstore .sp-row b:first-child')].map(b => b.textContent)`);
  ok(rows.slice(0, 4).join() == '萌宠动起来,软萌小脸,比心贴贴,崩坏3 · Q版' && !rows.includes('熊猫头') && !rows.includes('猫咪日常'), '精选列表只放软萌的；斗图、猫咪日常这些在「更多表情」');
  ok(await E(`document.querySelector('.spstore .sp-row[data-x=f-pets] .sp-add').textContent`) == '已添加', '已经添加的显示「已添加」');
  ok(await E(`!!document.querySelector('.spstore .sp-imp') && /我的表情/.test(document.querySelector('.spstore .pg-r').textContent)`), '商店里有「导入我自己的表情包」和右上角「我的表情」');
  await W(300); await p.screenshot({ path: path.join(OUT, 'stk_b.png') });
  await E(`document.querySelector('.spstore [data-a=sptab][data-x="2"]').click()`); await W(300);
  ok(/熊猫头/.test(await E(`document.querySelector('.spstore .sp-list').textContent`)) && !/特朗普/.test(await E(`document.querySelector('.spstore').textContent`)), '更多表情：熊猫头等斗图；不收真人政治类');
  await E(`document.querySelector('.spstore .sp-row[data-x=b015] .sp-add').click()`); await W(300);
  ok(await E(`core.S.stk.packs.includes('b015')`) && await E(`document.querySelector('.spstore .sp-row[data-x=b015] .sp-add').textContent`) == '已添加', '点「添加」：熊猫头加进我的表情');
  // 详情页
  await E(`document.querySelector('.spstore .sp-row[data-x=b015]').click()`); await W(600);
  ok(await E(`!!document.querySelector('.sppg.in .sp-ban img') && document.querySelectorAll('.sppg .sp-g .sks-i').length == 3`), '表情包详情：大横幅 + 全部表情');
  ok(/熊猫头/.test(await E(`document.querySelector('.sppg .sp-hd').textContent`)) && /ChineseBQB · 3 个表情/.test(await E(`document.querySelector('.sppg .sp-hd').textContent`)), '详情写着名字、来源、数量');
  await p.screenshot({ path: path.join(OUT, 'stk_c.png') });
  await E(`document.querySelectorAll('.sppg .sks-i')[2].click()`); await W(300);
  ok(await E(`!document.querySelector('.sppg .sks-pv').hidden && /傲娇/.test(document.querySelector('.sppg .sks-pc').textContent)`), '点一个：大图预览，写着名字');
  await E(`document.querySelector('.sppg .sks-pc [data-a=sksend]').click()`); await W(700); m = await last();
  ok(m.c == '傲娇' && await E(`!document.querySelector('.sppg.in, .spstore.in')`), '预览里点发送：发出去，商店和详情页一起关掉回到聊天');
  ok(await E(`[...document.querySelectorAll('.pan.on .pbar .pi')].some(b => b.dataset.x == 'b015')`), '回到聊天：面板里多了熊猫头这一组');
  // 4. 搜索表情
  reqs.length = 0; await E(`document.querySelector('.pan .pbar [data-a=stks]').click()`); await W(500);
  ok(/精选表情 ›/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)), '搜索页有「精选表情 ›」入口');
  await p.fill('.skspg .sks-ip', '开心'); await W(1500);
  const res = await E(`[...document.querySelectorAll('.skspg .sks-g')[0].querySelectorAll('.sks-i img')].map(i => decodeURIComponent(i.src))`);
  ok(res.length >= 5, '库里搜到 ' + res.length + ' 个');
  const L = await E(`sk.localSearch('开心').then(L => L.map(x => x.k + ':' + x.l))`);
  ok(/^(f-|hoyoverse-hi3)/.test(L[0]) && L.indexOf('b015:开心就好') > L.findIndex(x => /^f-/.test(x)), '排序：已添加的软萌组在前，熊猫头在后 ' + L.slice(0, 5));
  ok(L.some(x => x == 'hoyoverse-hi3:开心') && L.some(x => /^noto:/.test(x) || /^bilibili:/.test(x) || /^bmoji:/.test(x) || /^tieba:/.test(x) || /^qq:/.test(x)), '内置表情也能按中文名搜到（同义词：笑、哈哈…）');
  ok(!reqs.some(u => /apihz/.test(u)), '库里够多（' + res.length + ' 个）时不去搜网络表情');
  await W(300); await p.screenshot({ path: path.join(OUT, 'stk_d.png') });
  await p.fill('.skspg .sks-ip', '考试'); await W(1500);
  ok(!reqs.some(u => /apihz|giphy/.test(u)) && !/网络表情/.test(await E(`document.querySelector('.skspg .sks-out').textContent`)), '库里没有的词：不上网搜（网络表情已去掉）');
  await p.fill('.skspg .sks-ip', '开心'); await W(1200);
  await E(`document.querySelector('.skspg [data-a=sktab][data-x=pk]').click()`); await W(300);
  const pk = await E(`[...document.querySelectorAll('.skspg .sp-row')].map(r => r.dataset.x)`);
  ok(pk.includes('b049') && pk.includes('b015'), '「表情包」标签：搜到含这个表情的整组，可以直接添加 ' + pk.slice(0, 6));
  await E(`document.querySelector('.skspg [data-a=sktab][data-x=all]').click()`); await W(200);
  await E(`document.querySelector('.skspg .sks-i').click()`); await W(200); await E(`document.querySelector('.skspg [data-a=sksend]').click()`); await W(600);
  ok((await last()).t == 'sticker' && await E(`!document.querySelector('.skspg.in')`), '搜索结果点发送：发出并回到聊天');
  ok(await E(`core.S.stk.recent[0]`) == '开心', '记进「最近在搜」');
  // 5. AI 表情：先从库里挑，不上网
  await E(`core.S.stk.auto = true`); reqs.length = 0;
  await E(`dt.addMsg(_c, { from: '齐木', type: 'sticker', text: '委屈' }); core.saveD(); core.emit('chat')`); await W(800); m = await last();
  ok(m.img && /委屈巴巴|zhaoolee|npmmirror/.test(dec(m.img) + m.c) && !reqs.some(u => /apihz/.test(u)), 'AI 发 [表情包:委屈]：直接从表情库挑一张，没上网搜 ' + m.img);
  await E(`(() => { const L = talk.parseReply('齐木: [表情:傲娇]', _c); L.forEach(x => dt.addMsg(_c, x)); core.emit('chat'); })()`); await W(800); m = await last();
  ok(m.t == 'sticker' && m.c == '傲娇' && !!m.img, '模型写成 [表情:傲娇] 也认成表情包');
  await E(`dt.addMsg(_c, { from: '齐木', text: '[表情:晚安]' }); core.emit('chat')`); await W(800); m = await last();
  ok(m.t == 'sticker' && m.c == '晚安', '正文同步里的「[表情:晚安]」也变成表情包');
  // 6. 图片线路兜底
  mirrorDown = true; await E(`dt.addMsg(_c, { from: 'me', type: 'sticker', text: 'x' }); Object.assign(_c.msgs.at(-1), sk.msgOf({ l: '哭', img: 'https://registry.npmmirror.com/@waline/emojis/1.4.0/files/tieba/tieba_cry.png?down', alt: ['https://unpkg.com/@waline/emojis@1.4.0/tieba/tieba_cry.png'] })); core.emit('chat')`); await W(800);
  ok(await E(`/unpkg\\.com/.test([...document.querySelectorAll('.chat img.stk')].at(-1).src)`), '国内镜像打不开时自动换 unpkg 线路'); mirrorDown = false;
  await p.screenshot({ path: path.join(OUT, 'stk_e.png') });
  // 7. 设置里不再有「表情包」
  await E(`(async () => { core.home(); core.APPS.settings.open(); await new Promise(r => setTimeout(r, 300)); })()`); await W(500);
  ok(!(await E(`!!document.querySelector('[data-a=stkp]')`)), '设置里没有「表情包」了');
  await E(`core.home(); talk.openChat(_c.id)`); await W(500);
  // 8. 翻译：点「文」不跳到底；两边一样
  await E(`(() => { for (let i = 0; i < 14; i++) _c.msgs.push({ f: _c.id, t: 'text', c: '안녕 ' + i, tr: '你好 ' + i, ts: Date.now() }); _c.msgs.push({ f: 'me', t: 'text', c: '하하하', orig: '哈哈哈', ts: Date.now() }); core.emit('chat'); })()`); await W(500);
  ok(await E(`!!document.querySelector('.chat .msg:not(.me) .tzb') && !!document.querySelector('.chat .msg.me .tzb')`), '对方和我的消息都是同一个「文」小按钮');
  await E(`document.querySelector('.chat .pg-b').scrollTop = 200`); await W(100);
  await E(`document.querySelectorAll('.chat .msg:not(.me) .tzb')[3].click()`); await W(300);
  const sc = await E(`document.querySelector('.chat .pg-b').scrollTop`);
  ok(sc > 150 && sc < 260, '点翻译按钮：位置不动，没有跳到最下面（' + sc + '）');
  ok(await E(`(() => { const b = document.querySelectorAll('.chat .msg:not(.me) .tzb')[3]; return b.classList.contains('on') != b.nextElementSibling.hidden; })()`), '展开 / 收起切换正常');
  const lines = await E(`(() => { const p = document.querySelectorAll('.chat .msg:not(.me) .tzb')[3].closest('.bub'); const lh = parseFloat(getComputedStyle(p).lineHeight) || 20; return Math.round((p.clientHeight - 16) / lh); })()`);
  ok(lines <= 3, '短句展开后只有两行：原文一行、译文一行（约 ' + lines + ' 行高）');
  await E(`document.querySelector('.chat .msg.me .tzb').click()`); await W(200);
  ok(await E(`/哈哈哈/.test(document.querySelector('.chat .msg.me .tzp').textContent) && !document.querySelector('.chat .msg.me .tzp').hidden`), '我的消息点「文」：下面一行显示原文');
  await E(`document.querySelector('.chat .pg-b').scrollTop = 1e5`); await p.screenshot({ path: path.join(OUT, 'stk_f.png') });
  // 9. Kakao：没读的消息旁边黄色「1」
  await E(`core.S.style = 'kk'; _c.msgs.forEach(m => m.f == 'me' && (m.rd = 1)); _c.msgs.push({ f: 'me', t: 'text', c: '宝宝', ts: Date.now() }); core.emit('chat')`); await W(400);
  ok(await E(`(() => { const r = [...document.querySelectorAll('.chat .msg.me')].at(-1).querySelector('.rd.un'); return r && r.textContent == '1' && getComputedStyle(r).display != 'none'; })()`), 'Kakao 风格：对方还没读的消息旁边有黄色「1」');
  ok(await E(`!(document.querySelectorAll('.chat .msg.me')[0].querySelector('.rd.un'))`), '已经被读过的消息没有「1」');
  await E(`document.querySelector('.chat .pg-b').scrollTop = 1e5`); await p.screenshot({ path: path.join(OUT, 'stk_g.png') }); await E(`core.S.style = 'wx'`);
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
