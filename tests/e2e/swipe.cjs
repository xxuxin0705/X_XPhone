// 右滑返回 vs 手机系统手势：从屏幕最边上划不接（留给系统侧滑返回 / 切后台）；滑到一半网页被切到后台（等不到松手）→ 页面放回原位、不退回；
// 被打断（pointercancel）只复位不返回；切回来时卡在半路的页面复位；正常右滑照样能返回
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const root = path.resolve(__dirname, '../..'), here = __dirname;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + (/\.(js|css|html)$/.test(f) ? '; charset=utf-8' : '') }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8829);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8829/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); core.S.lock.on = false; core.home(); core.APPS.settings.open(); })()`); await W(500);
  await E(`[...document.querySelectorAll('.pg [data-a]')].find(e => /显示方式/.test(e.textContent))?.click()`); await W(600);
  const depth = () => E(`document.querySelectorAll('#stp .pg').length`), tf = () => E(`core.top().el.style.transform`);
  const d0 = await depth();
  // 从最边上划：不接
  await p.mouse.move(8, 500); await p.mouse.down(); await p.mouse.move(120, 505, { steps: 6 }); await W(50);
  ok(await tf() == '', '从屏幕最左边那一窄条开始划：小手机不接（留给手机系统的侧滑返回 / 切后台）');
  await p.mouse.up(); await W(400); ok(await depth() == d0, '……也不会退回上一页');
  // 滑到一半，网页被切到后台（系统接走手势，等不到松手）
  await p.mouse.move(80, 500); await p.mouse.down(); await p.mouse.move(250, 505, { steps: 8 }); await W(50);
  const mid = await tf();
  await E(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))`); await W(50);
  ok(/translateX/.test(mid) && await tf() == '', '滑到一半网页被切到后台：页面马上放回原位 ' + mid);
  await E(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'))`);
  await p.mouse.move(300, 505, { steps: 3 }); await W(50);
  ok(await tf() == '', '切回来以后再碰屏幕：页面不会再跟着手指乱动');
  await p.mouse.up(); await W(400); ok(await depth() == d0, '……也没有退回上一页');
  // 卡在半路的页面（比如没收到任何信号）：切回来时复位
  await E(`core.top().el.style.transform = 'translateX(140px)'; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'))`);
  ok(await tf() == '', '切回来时检查一遍：卡在半路的页面直接复位');
  // 正常右滑：照样返回
  await p.mouse.move(80, 500); await p.mouse.down(); await p.mouse.move(330, 505, { steps: 10 }); await p.mouse.up(); await W(500);
  ok(await depth() == d0 - 1, '从屏幕里面往右滑：照样返回上一页');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
