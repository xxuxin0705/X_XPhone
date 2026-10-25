// 时间样式：锁屏大时间换成圆润字体；字体可选（15 种）、日期在上 / 下、农历、粗细、颜色；桌面「时间」小组件（2×1 / 4×2）同样能选
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8801);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8801/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, n) });
  await E(`(async () => { window.core = await import('/core.js'); window.lk = await import('/lock.js'); window.ck = await import('/apps/theme/clock.js'); window.dk = await import('/desk.js'); delete core.S.lock.clk; core.S.lock.on = true; core.S.lock.wp = 'snownight'; core.S.lock.pw = false; lk.lock(); })()`); await W(1200);
  // 农历
  ok(await E(`ck.lunar(new Date(2026, 9, 26))`) == '丙午年九月十七', '农历：2026-10-26 是丙午年九月十七 ' + await E(`ck.lunar(new Date(2026, 9, 26))`));
  ok(await E(`ck.dateText(new Date(2026, 9, 26), true)`) == '10月26日周一 · 丙午年九月十七', '日期写法和截图一样：10月26日周一 · 丙午年九月十七');
  const ld = await E(`[ck.lunar(new Date(2026, 1, 17)), ck.lunar(new Date(2026, 2, 8)), ck.lunar(new Date(2026, 2, 13))]`);
  ok(/正月初一$/.test(ld[0]) && /二十$/.test(ld[1]) && /廿五$/.test(ld[2]), '农历日子：初一 / 二十 / 廿五 ' + ld.join(' '));
  // 锁屏默认：圆润字体，日期在上，有农历
  ok(/xp-round/.test(await E(`getComputedStyle(document.querySelector('.lock .lk-time')).fontFamily`)), '锁屏时间默认用「圆润」字体');
  ok(await E(`document.fonts.check('80px xp-round')`), '字体文件加载好了');
  ok(await E(`(() => { const c = document.querySelector('.lock .clk'); return c.firstElementChild.classList.contains('clk-d') && /·.*年/.test(c.firstElementChild.textContent); })()`), '默认日期在时间上面，带农历');
  await shot('clk_lock.png');
  // 日期在下、关农历、自选颜色
  await E(`(() => { Object.assign(lk.lockClk(), { pos: 'bot', lunar: false, auto: false, c: '#ff0000', a: 50, font: 'bebas' }); lk.lock(); })()`); await W(600);
  ok(await E(`document.querySelector('.lock .clk').lastElementChild.classList.contains('clk-d') && !/·/.test(document.querySelector('.lock .lk-date').textContent)`), '日期在下面、关掉农历');
  ok(await E(`getComputedStyle(document.querySelector('.lock .lk-time')).color`) == 'rgba(255, 0, 0, 0.5)', '自选颜色 + 50% 不透明度');
  ok(/xp-bebas/.test(await E(`getComputedStyle(document.querySelector('.lock .lk-time')).fontFamily`)), '换成「窄高」字体');
  // 主题 → 锁屏时间
  await E(`(() => { Object.assign(lk.lockClk(), { pos: 'top', lunar: true, auto: true, font: 'round' }); lk.unlock(); core.home(); core.APPS.theme.open(); })()`); await W(1000);
  ok(await E(`document.querySelectorAll('[data-sec=lkc] .clk-f').length`) == 15, '主题里有「锁屏时间」，15 种字体，每格用那个字体写时间');
  await E(`document.querySelector('[data-sec=lkc]').scrollIntoView()`); await W(200);
  const sc0 = await E(`document.querySelector('.pg-b').scrollTop`);
  await E(`document.querySelector('[data-sec=lkc] .clk-f[data-x=pacifico]').click()`); await W(300);
  ok(await E(`core.S.lock.clk.font == 'pacifico' && /xp-pacifico/.test(getComputedStyle(document.querySelector('.clk-pv .clk-t')).fontFamily) && document.querySelector('.clk-f.on').dataset.x == 'pacifico'`), '点字体：锁屏换字体、预览马上变');
  ok(Math.abs(await E(`document.querySelector('.pg-b').scrollTop`) - sc0) < 5, '点了不会跳到最上面');
  await E(`document.querySelector('[data-sec=lkc] [data-a=clkp][data-x=bot]').click()`); await W(200);
  ok(await E(`core.S.lock.clk.pos == 'bot' && document.querySelector('.clk-pv .clk').lastElementChild.classList.contains('clk-d')`), '日期在上 / 在下可以切换');
  await E(`(() => { const t = document.querySelector('[data-sec=lkc] input[data-k="lock.clk.auto"]'); t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); })()`); await W(200);
  ok(await E(`!!document.querySelector('[data-sec=lkc] input[data-k="lock.clk.c"][type=color]')`), '关掉跟随壁纸配色：出现颜色和不透明度');
  await p.locator('[data-sec=lkc]').screenshot({ path: path.join(OUT, 'clk_theme.png') });
  // 桌面「时间」小组件
  await E(`(() => { core.home(); core.S.lock.on = false; core.S.desk.pages = [[]]; core.save(); dk.renderDesk(); core.G.dlp('', document.querySelector('.desk .page'), new PointerEvent('pointerdown')); })()`); await W(200);
  await E(`document.querySelector('[data-a=wAdd]').click()`); await W(500);
  const cards = await E(`[...document.querySelectorAll('.sheet.wadd .wcard[data-k=clock]')].map(x => x.dataset.sz)`);
  ok(cards.join(',') == '2x1,4x2', '添加小组件里有「时间」：2×1 和 4×2 ' + cards);
  await E(`document.querySelector('.sheet.wadd .wcard[data-k=clock][data-sz="4x2"]').click()`); await W(600);
  await E(`document.querySelector('.sheet.wadd .wcard') || 0`);
  await E(`core.G.dlp('', document.querySelector('.desk .page'), new PointerEvent('pointerdown')); document.querySelector('[data-a=wAdd]').click()`); await W(500);
  await E(`document.querySelector('.sheet.wadd .wcard[data-k=clock][data-sz="2x1"]').click()`); await W(600);
  const fit = await E(`[...document.querySelectorAll('.desk .it.clkw')].map(t => { const a = t.getBoundingClientRect(), c = t.querySelector('.clk-t').getBoundingClientRect(), d = t.querySelector('.clk-d').getBoundingClientRect(); return c.width <= a.width + 1 && d.width <= a.width + 1 && c.height + d.height <= a.height + 2; })`);
  ok(fit.length == 2 && fit.every(Boolean), '4×2 和 2×1 的时间都放得下，不超出格子');
  ok(/xp-round/.test(await E(`getComputedStyle(document.querySelector('.desk .it.clkw .clk-t')).fontFamily`)), '小组件默认也是圆润字体');
  await E(`document.querySelector('.desk .it.clkw').click()`); await W(400);
  const tx = await E(`document.querySelector('.sheet.in').textContent`);
  ok(/字体[\s\S]*粗细[\s\S]*日期位置[\s\S]*农历[\s\S]*颜色[\s\S]*背景/.test(tx), '小组件设置：字体、粗细、日期位置、农历、颜色、背景');
  ok(await E(`[...document.querySelectorAll('.sheet.in select[data-k=sz] option')].map(o => o.value).join(',')`) == '2x1,4x2', '调整大小只有 2×1 / 4×2');
  await E(`(() => { const s = document.querySelector('.sheet.in select[data-k=pos]'); s.value = 'bot'; s.dispatchEvent(new Event('change', { bubbles: true })); const f = document.querySelector('.sheet.in select[data-k=font]'); f.value = 'fredoka'; f.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.sheet.in [data-a=ok]').click(); })()`); await W(500);
  ok(await E(`(() => { const c = document.querySelector('.desk .it.clkw .clk'); return c.lastElementChild.classList.contains('clk-d') && /xp-fredoka/.test(getComputedStyle(c.querySelector('.clk-t')).fontFamily); })()`), '小组件改成日期在下、软糖字体');
  await E(`document.querySelector('[data-a=edDone]').click()`); await W(300);
  await p.locator('#stp .desk').screenshot({ path: path.join(OUT, 'clk_desk.png') });
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
