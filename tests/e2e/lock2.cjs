// 锁屏：内置 3 张实况（草地泡泡 / 白玉兰 / 屋檐小猫）、伞下烟火已去掉；自定义锁屏可以存好几张（图片 / 视频 / 实况），长按保存到手机 / 删除
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8791);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8791/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, n) });
  await E(`(async () => { window.FX = (await import('/lockfx.js')).FX; window.core = await import('/core.js'); window.lk = await import('/lock.js'); core.S.lock.on = true; core.S.lock.wp = 'hanabi'; core.S.lock.pw = false; lk.lock(); })()`); await W(800);
  // 主题页：雪夜 + 3 张内置实况 + 自定义（伞下烟火已去掉）
  await E(`lk.unlock()`); await W(500); await E(`core.home(); core.APPS.theme.open()`); await W(1200);
  ok(await E(`[...document.querySelectorAll('.lwg .lw span')].map(e => e.textContent).join()`) == '雪夜,草地泡泡,白玉兰,屋檐小猫,自定义', '锁屏壁纸：雪夜、草地泡泡、白玉兰、屋檐小猫、自定义 ' + await E(`[...document.querySelectorAll('.lwg .lw span')].map(e => e.textContent).join()`));
  ok(await E(`document.querySelectorAll('.lwg .lw.bi .live').length`) == 3, '三张内置的都标 LIVE');
  await p.waitForFunction(`[...document.querySelectorAll('.lw.bi img')].every(i => i.naturalWidth > 0)`, null, { timeout: 8000 }).catch(() => {});
  ok(await E(`[...document.querySelectorAll('.lw.bi img')].every(i => i.naturalWidth > 0)`), '缩略图都在');
  ok(await E(`document.querySelector('.lw.on span')?.textContent`) == '雪夜', '以前选的伞下烟火：自动换回雪夜');
  await E(`document.querySelector('.lw[data-a=lwb][data-x=cat]').click()`); await W(400);
  ok(await E(`core.S.lock.wp`) == 'b:cat' && await E(`document.querySelector('.lw.on span')?.textContent`) == '屋檐小猫', '点「屋檐小猫」：选中');
  await p.locator('[data-sec=lk]').screenshot({ path: path.join(OUT, 'live_theme.png') }).catch(() => {});
  await E(`lk.lock(true)`); await W(1200);
  ok(await E(`/live\\/cat\\.webp/.test(document.querySelector('.lock .lk-bg img')?.src || '') && /live\\/cat\\.mp4/.test(document.querySelector('.lock .lk-bg video.live')?.src || '')`), '锁屏：照片 + 会动的视频');
  ok(await E(`document.querySelector('.lock .lk-bg video.live').readyState`) >= 1, '视频加载出来了');
  await E(`document.querySelector('.lock .lk-bg video.live').classList.remove('on')`);
  { const mid = await E(`(() => { const b = document.querySelector('#stp .lock').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height * .45]; })()`);
    await p.mouse.move(...mid); await p.mouse.down(); await W(600); ok(await E(`document.querySelector('.lock .lk-bg video.live').classList.contains('on')`), '长按：再动一次'); await p.mouse.up(); }
  await p.screenshot({ path: path.join(OUT, 'live_lock.png') });
  ok(!fs.existsSync(path.join(root, 'lockfx-umb.js')) && !fs.existsSync(path.join(root, 'apps/theme/xhs.js')), '伞下烟火、小红书导入的代码都删掉了');
  await E(`lk.unlock()`); await W(500); await E(`document.querySelector('.lw.vid').scrollIntoView()`);
  ok(await new Promise(async r => { p.once('filechooser', () => r(true)); await E(`document.querySelector('.lw.vid').click()`); setTimeout(() => r(false), 1500); }), '＋自定义：直接选文件（没有小红书那一项了）');
  await E(`lk.unlock()`); await W(500);
  await E(`document.querySelector('.lw[data-x=snownight]').click()`); await W(300);
  // 自定义：+ → 从相册选；可以存好几张，每张一个格子
  const cur = () => E(`(() => { const it = (core.S.lock.lib || []).find(x => 'c:' + x.id == core.S.lock.wp); return it ? { img: !!it.img, video: !!it.video, n: core.S.lock.lib.length } : null; })()`);
  const pick = async files => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), E(`document.querySelector('.lw.vid').click()`)]); await fc.setFiles(files); await W(1800); };
  const fx = f => fs.readFileSync(path.join(here, '../fixtures', f));
  await pick([{ name: 'p.jpg', mimeType: 'image/jpeg', buffer: fx('still.jpg') }]);
  let c = await cur(); ok(c && c.img && !c.video && c.n == 1, '上传图片：锁屏用这张图 ' + JSON.stringify(c));
  ok(await E(`document.querySelector('.lw.cu.on span')?.textContent`) == '图片' && await E(`document.querySelectorAll('.lw.on').length`) == 1, '主题页多了一个「图片」格子，并且选中');
  await E(`lk.lock(true)`); await W(700); ok(await E(`!!document.querySelector('.lock .lk-bg img') && !document.querySelector('.lock .lk-bg video')`), '锁屏显示图片'); await E(`lk.unlock()`); await W(500);
  await pick([{ name: 'MVIMG_1.jpg', mimeType: 'image/jpeg', buffer: fx('motion.jpg') }]);
  c = await cur(); ok(c && c.img && c.video && c.n == 2, '安卓动态照片（JPG 里带视频）：认成实况照片，新加一格（不会顶掉上一张）');
  ok(await E(`document.querySelector('.lw.cu.on .live')?.textContent`) == 'LIVE', '实况的格子上标 LIVE');
  await E(`lk.lock(true)`); await W(900);
  ok(await E(`!!document.querySelector('.lock .lk-bg img') && !!document.querySelector('.lock .lk-bg video.live')`), '锁屏：实况照片（照片 + 会动的视频）');
  await E(`document.querySelector('.lock .lk-bg video.live').classList.remove('on')`);
  const mid = await E(`(() => { const b = document.querySelector('#stp .lock').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height * .45]; })()`);
  await p.mouse.move(...mid); await p.mouse.down(); await W(600); ok(await E(`document.querySelector('.lock .lk-bg video.live').classList.contains('on')`), '长按：实况照片再动一次'); await p.mouse.up();
  await E(`lk.unlock()`); await W(500);
  await pick([{ name: 'IMG_1.HEIC.jpg', mimeType: 'image/jpeg', buffer: fx('still.jpg') }, { name: 'IMG_1.MOV', mimeType: 'video/mp4', buffer: fs.readFileSync(path.join(here, 'v3.mp4')) }]);
  c = await cur(); ok(c && c.img && c.video, '苹果实况照片：照片和视频一起选上');
  await pick([{ name: 'v.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(path.join(here, 'v3.mp4')) }]);
  c = await cur(); ok(c && !c.img && c.video && c.n == 4, '只选视频：锁屏视频');
  // 点别的格子换锁屏；长按删除
  await E(`document.querySelectorAll('.lw.cu')[0].click()`); await W(400); c = await cur(); ok(c && c.img && !c.video, '点第一格：换回那张图片');
  const first = await E(`core.S.lock.lib[0].id`);
  await E(`window.__lp = document.querySelectorAll('.lw.cu')[3]; __lp.scrollIntoView({ block: 'center' })`); await W(300); const bx = await E(`(() => { const r = __lp.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await p.mouse.move(...bx); await p.mouse.down(); await W(650); await p.mouse.up(); await W(400);
  ok(/保存到手机[\s\S]*删除这张视频/.test(await E(`document.querySelector('.sheet.mnu')?.textContent || ''`)), '长按：保存到手机 / 删除');
  await E(`document.querySelector('.sheet.mnu [data-x=d]').click()`); await W(400); await E(`document.querySelector('.sheet.mnu .mi.danger')?.click()`); await W(500);
  ok(await E(`core.S.lock.lib.length`) == 3 && await E(`core.S.lock.wp`) == 'c:' + first, '删掉一张（正在用的那张没受影响）');
  // 旧数据：以前只有一张自定义（S.lock.img / video），自动放进列表
  await E(`(async () => { const lk2 = await import('/lock.js'); core.S.lock.lib = []; core.S.lock.img = 'data:image/png;base64,iVBORw0KGgo='; core.S.lock.video = ''; core.S.lock.wp = 'video'; lk2.lockMig(); })()`);
  ok(await E(`core.S.lock.lib.length == 1 && core.S.lock.wp == 'c:' + core.S.lock.lib[0].id && !core.S.lock.img`), '旧版的那一张自定义锁屏：自动放进列表、继续用');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
