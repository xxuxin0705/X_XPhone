// 心屿：每个角色一座果冻球里的小岛，天气 = 心情；读剧情 / 正文「心情|谁|心情|一句话」；捏一捏、转一转；潮汐记录；果冻颜色
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8815);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8815/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, n) });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.is = await import('/apps/isle/isle.js'); core.S.lock.on = false; window.ep = []; SillyTavern.getContext().setExtensionPrompt = (k, v) => ep.push(v);
    window._a = dt.add(dt.blank('p', { real: '五条悟', fr: 1 })); window._b = dt.add(dt.blank('p', { real: '夏油杰', fr: 1 })); core.saveD(); })()`); await W(300);
  ok(await E(`!!core.APPS.isle && [...core.S.desk.pages.flat(), ...core.S.desk.dock].some(x => x.app == 'isle')`), '桌面上有「心屿」');
  await E(`core.openApp('isle')`); await W(800);
  ok(await E(`document.querySelectorAll('.isle .is-who b').length == 2 && !!document.querySelector('.isle canvas') && document.querySelector('.isle canvas').width > 300`), '打开：两个角色的头像、果冻球画出来了');
  ok(/还不知道[\s\S]*五条悟的岛/.test(await E(`document.querySelector('.is-card').textContent`)), '还没读过心情：显示「还不知道」');
  await shot('isle_empty.png');
  // 读剧情（模拟一次 API）
  await E(`SillyTavern.getContext().generateRaw = async () => '{"mood":"烦躁","scene":"storm","say":"别再问我了。","sea":0.9}'`);
  await E(`document.querySelector('[data-a=islook]').click()`); await W(1200);
  ok(await E(`core.D().isle.by[_a.id].mood == '烦躁' && core.D().isle.by[_a.id].scene == 'storm' && core.D().isle.by[_a.id].hist.length == 1`), '看看 TA 现在：读出「烦躁」→ 风暴');
  ok(/烦躁[\s\S]*风暴[\s\S]*别再问我了/.test(await E(`document.querySelector('.is-card').textContent`)), '卡片显示心情、天气、那句话');
  await W(600); await shot('isle_storm.png');
  // 正文里的心情
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: '他看着窗外笑了。\\n<手机>\\n心情|夏油杰|温柔|今天的风很好。\\n</手机>', is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(600);
  ok(await E(`core.D().isle.by[_b.id].mood == '温柔' && core.D().isle.by[_b.id].scene == 'aurora'`), '正文 <手机> 块里「心情|谁|心情|一句话」：夏油杰 → 温柔 → 极光');
  ok(await E(`!SillyTavern.getContext().chat.at(-1).mes.includes('心情|')`), '那一行不显示在正文里');
  await E(`document.querySelectorAll('.is-who b')[1].click()`); await W(700);
  ok(/温柔[\s\S]*极光[\s\S]*夏油杰的岛/.test(await E(`document.querySelector('.is-card').textContent`)), '切到夏油杰：极光');
  await shot('isle_aurora.png');
  // 捏一捏、转一转
  const r = await p.locator('.isle canvas').boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2, { steps: 5 }); await W(100); await shot('isle_squish.png'); await p.mouse.up(); await W(500);
  ok(errs.length == 0, '按住果冻拖一拖没有报错');
  // 本地互动不产生模型请求，摇晃气泡有冷却，景观持久保存。
  await E(`window.localCalls = 0; SillyTavern.getContext().generateRaw = async () => { localCalls++; throw Error('互动不应调用模型'); }`);
  await p.click('[data-is-shake]'); await W(100);
  ok(await E(`document.querySelector('.is-bubble').dataset.kind === 'shake' && document.querySelector('.is-bubble').classList.contains('on')`), '摇一摇出现本地头晕气泡');
  const line = await p.locator('.is-bubble').textContent();
  await p.click('[data-is-shake]');
  ok(await p.locator('.is-bubble').textContent() === line, '连续摇晃不会刷屏');
  await p.click('[data-a=islandscape]'); await W(150); await p.click('.sheet.mnu [data-x=bamboo]'); await W(300);
  ok(await E(`core.S.isle.landscape === 'bamboo'`) && await p.locator('[data-a=islandscape]').textContent() === '听风竹林', '景观切换为竹林并保存');
  await p.click('[data-is-shake]'); await W(100); await shot('isle_bamboo_play.png');
  ok(await E(`localCalls === 0`), '互动和景观切换均不调用模型');
  // 跟着剧情变：开关 → 提示词
  ok(!(await E(`ep.at(-1) || ''`)).includes('心情|'), '默认提示词里没有心情格式');
  await E(`document.querySelector('.isle [data-a=isset]').click()`); await W(300); await E(`document.querySelector('.sheet.mnu [data-x=auto]').click()`); await W(400);
  ok(await E(`core.S.isle.auto === true`) && (await E(`ep.at(-1)`)).includes('心情|谁|心情词'), '打开「跟着剧情变」：提示词里加上心情格式');
  await E(`document.querySelector('.isle [data-a=isset]').click()`); await W(300); await E(`document.querySelector('.sheet.mnu [data-x=peach]').click()`); await W(500);
  ok(await E(`core.S.isle.jelly == 'peach'`), '换成蜜桃色果冻');
  await shot('isle_peach.png');
  // 潮汐记录
  await E(`document.querySelector('[data-a=ishist]').click()`); await W(400);
  ok(await E(`document.querySelectorAll('.is-h').length`) == 1 && /温柔/.test(await E(`document.querySelector('.is-hist').textContent`)), '潮汐记录：一条');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
