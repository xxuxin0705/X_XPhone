// 锁屏「雪夜」：照片底图 + 互动（点树亮灯、雪地写字、点雪人、长按树抖雪、双击天空、窗边结霜、只有从底部上滑才解锁）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8785);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8785/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.lk = await import('/lock.js'); core.S.lock.on = true; core.S.lock.wp = 'sakura'; core.S.lock.pw = false; lk.lock(); })()`); await W(1500);
  const st = () => E(`(() => { const s = lk.lockFx().state(); return { ready: s.ready, mode: s.mode, dabs: s.dabs.length, wob: s.sm.wobT, chunks: s.chunks.length + s.puffs.length, swirl: s.swirl, col: s.sm.col, frost: s.frostF, gl: !!s.gl }; })()`);
  // 场景坐标 → 页面坐标
  const at = async (expr) => E(`(() => { const s = lk.lockFx().state(), r = document.querySelector('.lk-bg canvas').getBoundingClientRect(), [x, y] = (${expr}); return [r.left + x * r.width / s.W, r.top + y * r.height / s.H]; })()`);
  let s = await st(); ok(s.ready && s.gl, '旧主题名自动换成雪夜，照片加载完成，雪地着色器可用');
  ok(/轻点圣诞树/.test(await E(`document.querySelector('.lk-hint span').textContent`)), '开屏先提示可以怎么玩');
  const tap = async ([x, y]) => { await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.up(); await W(120); };
  await tap(await at(`[s.tree.x, s.tree.by - s.tree.h * .45]`)); await W(1800); s = await st();
  ok(s.mode == 1, '点圣诞树：彩灯亮起来');
  // 雪地上写字（不应该解锁）
  const [gx, gy] = await at(`[s.W * .25, s.ground + (s.H - s.ground) * .45]`);
  await p.mouse.move(gx, gy); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(gx + i * 6, gy - i * 8); await p.mouse.up(); await W(200); s = await st();
  ok(s.dabs > 20 && await E('lk.isLocked()'), '雪地上划一笔：留下凹槽，不会被当成解锁');
  await tap(await at(`[s.sm.cx, s.sm.y + s.sm.h * .6]`)); s = await st(); ok(s.wob > 0, '点雪人：晃一晃、亮一下');
  const [hx, hy] = await at(`[s.sm.cx, s.sm.y + s.sm.h * .6]`); await p.mouse.move(hx, hy); await p.mouse.down(); await W(800); await p.mouse.up(); s = await st(); ok(s.col == 1, '长按雪人：身体里的灯换颜色');
  const [tx, ty] = await at(`[s.tree.x, s.tree.by - s.tree.h * .3]`); await p.mouse.move(tx, ty); await p.mouse.down(); await W(800); await p.mouse.up(); s = await st(); ok(s.chunks > 10 && s.mode == 1, '长按圣诞树：积雪抖落下来（灯不会被关掉）');
  const sky = await at(`[s.W * .8, s.H * .12]`); await p.mouse.move(...sky); await p.mouse.down(); await p.mouse.up(); await p.mouse.down(); await p.mouse.up(); await W(150); s = await st(); ok(s.swirl > .5, '双击天空：雪花像水晶球一样卷起来');
  // 天空中间慢慢往上拖不解锁；从底部上滑才解锁
  await p.mouse.move(sky[0], sky[1] + 200); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(sky[0], sky[1] + 200 - i * 15); await W(40); } await p.mouse.up(); await W(300);
  ok(await E('lk.isLocked()'), '在画面中间慢慢上滑不会误解锁');
  await p.screenshot({ path: path.join(OUT, 'snow_lock.png') });
  // 窗边结霜 → 手指擦掉
  await E(`(() => { const s = lk.lockFx().state(); s.idle = 40; })()`); await W(2500); s = await st(); ok(s.frost > .5, '放着不动：窗边慢慢结霜');
  await p.screenshot({ path: path.join(OUT, 'snow_frost.png') });
  const [fx0, fy0] = await at(`[8, s.H * .4]`); await p.mouse.move(fx0, fy0); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(fx0 + i * 4, fy0 + i * 20); await p.mouse.up();
  ok(await E(`(() => { const s = lk.lockFx().state(); return s.wx.getImageData(10, Math.round(s.H * .4 + 40), 1, 1).data[3] > 100; })()`), '手指擦过的地方霜没了');
  // 每次打开都恢复原样
  const r = await E(`(() => { const b = document.querySelector('#stp .lock').getBoundingClientRect(); return [b.left + b.width / 2, b.bottom - 30]; })()`);
  await p.mouse.move(...r); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(r[0], r[1] - i * 30); await p.mouse.up(); await W(700);
  ok(!(await E('lk.isLocked()')), '从底部上滑解锁');
  await E('lk.lock()'); await W(900); s = await st(); ok(s.dabs == 0 && s.mode == 0 && s.frost == 0, '重新打开锁屏：写的字、灯、霜都恢复原样');
  // 关机再开（不解锁）：锁屏也要恢复原样
  s = await st(); await tap(await at(`[s.tree.x, s.tree.by - s.tree.h * .45]`)); const [gx2, gy2] = await at(`[s.W * .3, s.ground + (s.H - s.ground) * .5]`);
  await p.mouse.move(gx2, gy2); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(gx2 + i * 8, gy2); await p.mouse.up(); s = await st(); ok(s.mode == 1 && s.dabs > 5, '（亮灯、写了字）');
  await E(`document.querySelector('#stp .off').click()`); await W(300); await p.click('#stp-ball'); await W(900); s = await st(); ok(await E('lk.isLocked()') && s.mode == 0 && s.dabs == 0, '点关机再打开：锁屏回到初始样子');
  // 雪印 3 秒左右消失
  await p.mouse.move(gx2, gy2); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(gx2 + i * 8, gy2); await p.mouse.up();
  await E(`lk.lockFx().advance(1, 10)`); s = await st(); ok(s.dabs > 5, '1 秒时雪印还在');
  await E(`lk.lockFx().advance(2.4, 30)`); s = await st(); ok(s.dabs == 0, '3 秒多雪印就没了');
  // 倾斜手机：雪人和照片不动
  const pos = () => E(`(() => { const s = lk.lockFx().state(); return [s.ox, s.sm.x, s.sm.cx].join(); })()`); const p0 = await pos();
  await E(`dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 30, beta: 0 })); lk.lockFx().advance(1, 20)`); ok(await pos() == p0 && await E(`lk.lockFx().state().tiltT`) > .5, '倾斜手机：雪人和画面固定不动（只有落雪的风向变）');
  // 打开手机的第一帧就是锁屏照片，不能先黑一下
  const lum = `(() => { const c = document.querySelector('.lk-bg canvas'); if (!c || !c.width) return -1; const t = document.createElement('canvas'); t.width = 40; t.height = 80; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 40, 80); const d = g.getImageData(0, 0, 40, 80).data; let a = 0; for (let i = 0; i < d.length; i += 4) a += d[i] + d[i + 1] + d[i + 2]; return a / (d.length / 4) / 3; })()`;
  const ref = await E(lum), ball = `(() => { const b = document.querySelector('#stp-ball'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5 })); })()`;
  const reopen = () => E(`new Promise(r => { ${ball}; requestAnimationFrame(() => r([document.querySelector('#stp').classList.contains('on'), ${lum}])); })`);
  await E(`document.querySelector('#stp .off').click()`); await W(450); ok(await E(`!document.querySelector('#stp').classList.contains('on') && lk.isLocked()`), '关机后锁屏已经提前锁好、画好');
  let [on1, l1] = await reopen(); ok(on1 && ref > 25 && l1 > ref * .7, `再打开时第一帧就是雪夜照片（亮度 ${l1 | 0} / 正常 ${ref | 0}）`);
  await E('lk.unlock()'); await W(700); await E(`document.querySelector('#stp .off').click()`); await W(450);
  let [on2, l2] = await reopen(); ok(on2 && await E('lk.isLocked()') && l2 > ref * .7, `解锁后关机再开：第一帧也直接是锁屏（亮度 ${l2 | 0}）`);
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})();
