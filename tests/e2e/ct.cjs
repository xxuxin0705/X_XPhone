const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8783);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8783/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s);
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.ch = await import('/apps/chat/chat.js');
    const D = core.D(), P = o => dt.add(dt.blank('p', o));
    const a = P({ nick: 'Jiang🐯', real: '姜照临', remark: '姜狗兄弟', sex: '男', sign: '比你有钱' }), b2 = P({ nick: '老姜', real: '姜爷爷', remark: '姜爷爷', sex: '男', sign: '早睡早起' }),
      c = P({ nick: 'MING', real: '郁明也', sex: '男', sign: '学习使我快乐' }), d = P({ nick: '阿瞬', real: '海藤瞬', sex: '男', sign: '漆黑之翼降临', grp: '高中同学' }), e = P({ nick: '小桃', real: '白桃', sex: '女', sign: '', grp: '高中同学' }),
      n1 = P({ nick: '灰吕杵志', real: '灰吕杵志', sex: '男', fr: 0 }), n2 = P({ nick: '花孔雀', real: '花孔雀', sex: '女', fr: 0 }), n3 = P({ nick: '路人乙', real: '路人乙', fr: 0 });
    dt.add(dt.blank('g', { name: 'PK学园2年级', members: [a.id, c.id, n1.id, n2.id], size: 42 })); dt.add(dt.blank('g', { name: '一天到晚干嘛呢！', members: [a.id, b2.id, n3.id] }));
    D.posts.push({ id: 'x1', a: a.id, c: 'hi', ts: +core.now(), likes: [], cm: [] }); core.saveD(); core.APPS.chat.open(); })()`); await p.waitForTimeout(500);
  await E(`document.querySelector('[data-a=tab][data-x=ct]').click()`); await p.waitForTimeout(300);
  for (const st of ['wx', 'qq', 'kk', 'line']) {
    await E(`core.S.style = '${st}'; core.emit('chat'); core.top().re()`); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, `ct_${st}.png`) });
    await E(`document.querySelector('.pg-h [data-a=newfr], .ct [data-a=newfr]').click()`); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `nf_${st}.png`) });
    ok(await E(`document.querySelectorAll('.nfpg .may').length`) == 3, st + ': add page lists 3 non-friends');
    await E(`core.back()`); await p.waitForTimeout(400);
  }
  // wx details
  await E(`core.S.style = 'wx'; core.top().re()`); await p.waitForTimeout(300);
  ok(/^新的朋友3$/.test(await E(`document.querySelector('.cw-e').textContent`)), 'wx: 新的朋友 shows red count');
  console.log(await E(`[...document.querySelectorAll('.ct-wx h6')].map(h => h.textContent).join()`), await E(`document.querySelector('.ct-n')?.textContent`), await E(`[...document.querySelectorAll('.ct-qq .qg summary b')].map(x => x.textContent).join()`));
  ok(/5个朋友/.test(await E(`document.querySelector('.ct-n').textContent`)), 'wx: 5个朋友 footer');
  // search
  await E(`document.querySelector('[data-a=ctsrch]').click()`); await p.waitForTimeout(200);
  await p.fill('[data-ctq]', '姜'); await p.waitForTimeout(200);
  ok(await E(`[...document.querySelectorAll('.ct [data-q]:not([hidden])')].map(r => r.textContent).join()`) == '姜狗兄弟,姜爷爷' && await E(`getComputedStyle(document.querySelector('.cw-es')).display`) == 'none', 'wx search filters rows and hides entries');
  await p.fill('[data-ctq]', '');
  // add from page
  await E(`ch.newFr()`); await p.waitForTimeout(400);
  await E(`document.querySelector('.nfpg .may button[data-a=addfr]').click()`); await p.waitForTimeout(400);
  ok(/已添加/.test(await E(`document.querySelector('.nfpg .may').textContent`)) && await E(`core.D().chats.filter(c => c.fr === 0).length`) == 2, 'adding a suggestion: friend added, row shows 已添加');
  await E(`core.back()`); await p.waitForTimeout(400);
  console.log('CTN', await E(`document.querySelector('.ct-n')?.textContent`), await E(`core.top()?.el.className`));
  // qq groups tabs
  await E(`core.S.style = 'qq'; core.top().re()`); await p.waitForTimeout(300);
  console.log('QQ', await E(`[...document.querySelectorAll('.ct-qq .qg summary b')].map(x => x.textContent).join()`), await E(`document.querySelector('.cq-tabs .on')?.textContent`));
  await E(`document.querySelector('.ct-qq .qg summary').click()`); await p.waitForTimeout(200);
  ok(await E(`document.querySelector('.ct-qq .qg').open`), 'qq: tap group expands');
  await E(`core.emit('chat')`); await p.waitForTimeout(300);
  ok(await E(`document.querySelector('.ct-qq .qg').open`), 'qq: expanded state kept after re-render');
  await p.screenshot({ path: path.join(OUT, `ct_qq2.png`) });
  await E(`document.querySelector('.ct-qq [data-a=nosug]').click()`); await p.waitForTimeout(300);
  ok(await E(`document.querySelectorAll('.cq-may .may').length`) == 1, 'qq: × hides a suggestion');
  // line follow from card
  await E(`core.D().chats.forEach(c => c.nosug = 0); core.S.style = 'line'; core.top().re()`); await p.waitForTimeout(300);
  ok(await E(`document.querySelectorAll('.ci-s i.ring').length`) == 1, 'line: story ring only for friends who posted recently');
  await E(`document.querySelector('.ci-c button').click()`); await p.waitForTimeout(300);
  ok(await E(`document.querySelectorAll('.ci-c').length`) == 1, 'line: 关注 adds the friend, card disappears');
  await E(`ch.newFr()`); await p.waitForTimeout(400); await p.fill('.nfpg [data-ctq]', '花'); await p.waitForTimeout(200);
  ok(await E(`[...document.querySelectorAll('.nfpg .may:not([hidden]) b')].map(x => x.textContent).join()`) == '花孔雀' && await E(`getComputedStyle(document.querySelector('.nfpg .nf-os')).display`) == 'none', 'ins add page: search filters suggestions');
  await E(`core.S.style = 'qq'; core.back()`); await p.waitForTimeout(300); await E(`ch.newFr()`); await p.waitForTimeout(400);
  ok(await E(`getComputedStyle(document.querySelector('.nfpg .pg-back')).color`) == 'rgb(0, 153, 255)', 'qq add page back arrow is QQ blue');
  await p.screenshot({ path: path.join(OUT, 'nf_qq2.png') });
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})();
