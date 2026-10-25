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
  // 主题页：雪夜 + 自定义（伞下烟火、内置实况都去掉了）
  await E(`lk.unlock()`); await W(500); await E(`core.home(); core.APPS.theme.open()`); await W(1200);
  ok(await E(`[...document.querySelectorAll('[data-sec=lk] .lwg .lw span')].map(e => e.textContent).join()`) == '雪夜,自定义', '锁屏壁纸：雪夜、自定义 ' + await E(`[...document.querySelectorAll('[data-sec=lk] .lwg .lw span')].map(e => e.textContent).join()`));
  ok(await E(`document.querySelector('[data-sec=lk] .lw.on span')?.textContent`) == '雪夜', '以前选的伞下烟火：自动换回雪夜');
  ok(!fs.existsSync(path.join(root, 'lockfx-umb.js')) && !fs.existsSync(path.join(root, 'apps/theme/xhs.js')) && !fs.existsSync(path.join(root, 'assets/live')), '伞下烟火、小红书导入、内置实况的文件都删掉了');
  ok(await new Promise(async r => { p.once('filechooser', () => r(true)); await E(`document.querySelector('[data-sec=lk] .lw.vid').click()`); setTimeout(() => r(false), 1500); }), '＋自定义：直接选文件');
  await W(500);
  // 自定义：+ → 从相册选；可以存好几张，每张一个格子
  const cur = () => E(`(() => { const it = (core.S.lock.lib || []).find(x => 'c:' + x.id == core.S.lock.wp); return it ? { img: !!it.img, video: !!it.video, n: core.S.lock.lib.length } : null; })()`);
  const pick = async files => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), E(`document.querySelector('[data-sec=lk] .lw.vid').click()`)]); await fc.setFiles(files); await W(1800); };
  const fx = f => fs.readFileSync(path.join(here, '../fixtures', f));
  await pick([{ name: 'p.jpg', mimeType: 'image/jpeg', buffer: fx('still.jpg') }]);
  let c = await cur(); ok(c && c.img && !c.video && c.n == 1, '上传图片：锁屏用这张图 ' + JSON.stringify(c));
  ok(await E(`document.querySelector('[data-sec=lk] .lw.cu.on span')?.textContent`) == '图片' && await E(`document.querySelectorAll('[data-sec=lk] .lw.on').length`) == 1, '主题页多了一个「图片」格子，并且选中');
  await E(`lk.lock(true)`); await W(700); ok(await E(`!!document.querySelector('.lock .lk-bg img') && !document.querySelector('.lock .lk-bg video')`), '锁屏显示图片'); await E(`lk.unlock()`); await W(500);
  await pick([{ name: 'MVIMG_1.jpg', mimeType: 'image/jpeg', buffer: fx('motion.jpg') }]);
  c = await cur(); ok(c && c.img && c.video && c.n == 2, '安卓动态照片（JPG 里带视频）：认成实况照片，新加一格（不会顶掉上一张）');
  ok(await E(`document.querySelector('[data-sec=lk] .lw.cu.on .live')?.textContent`) == 'LIVE', '实况的格子上标 LIVE');
  await E(`lk.lock(true)`); await W(900);
  ok(await E(`!!document.querySelector('.lock .lk-bg img') && !!document.querySelector('.lock .lk-bg video.live')`), '锁屏：实况照片（照片 + 会动的视频）');
  await E(`document.querySelector('.lock .lk-bg video.live').classList.remove('on')`);
  const mid = await E(`(() => { const b = document.querySelector('#stp .lock').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height * .45]; })()`);
  await p.mouse.move(...mid); await p.mouse.down(); await W(600); ok(await E(`document.querySelector('.lock .lk-bg video.live').classList.contains('on')`), '长按：实况照片再动一次'); await p.mouse.up();
  await E(`lk.unlock()`); await W(500);
  // 关手机再打开：实况要在打开的时候动（以前是关的时候动，看不见）
  await E(`core.S.lock.on = true; core.S.lock.pw = false; window.__tap = () => { const b = document.querySelector('#stp-ball'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5 })); }; __tap()`); await W(900);
  ok(await E(`!document.querySelector('#stp').classList.contains('on')`), '手机收起来了');
  await E(`document.querySelector('.lock .lk-bg video.live')?.classList.remove('on')`);
  await E(`__tap()`); await W(300);
  ok(await E(`document.querySelector('.lock .lk-bg video.live')?.classList.contains('on')`), '打开手机：实况动了一下');
  await E(`lk.unlock()`); await W(500); await E(`core.home(); core.APPS.theme.open()`); await W(800);
  await pick([{ name: 'IMG_1.HEIC.jpg', mimeType: 'image/jpeg', buffer: fx('still.jpg') }, { name: 'IMG_1.MOV', mimeType: 'video/mp4', buffer: fs.readFileSync(path.join(here, 'v3.mp4')) }]);
  c = await cur(); ok(c && c.img && c.video, '苹果实况照片：照片和视频一起选上');
  await pick([{ name: 'v.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(path.join(here, 'v3.mp4')) }]);
  c = await cur(); ok(c && !c.img && c.video && c.n == 4, '只选视频：锁屏视频');
  // 点别的格子换锁屏；长按删除
  await E(`document.querySelectorAll('[data-sec=lk] .lw.cu')[0].click()`); await W(400); c = await cur(); ok(c && c.img && !c.video, '点第一格：换回那张图片');
  const first = await E(`core.S.lock.lib[0].id`);
  await E(`window.__lp = document.querySelectorAll('[data-sec=lk] .lw.cu')[3]; __lp.scrollIntoView({ block: 'center' })`); await W(300); const bx = await E(`(() => { const r = __lp.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await p.mouse.move(...bx); await p.mouse.down(); await W(650); await p.mouse.up(); await W(400);
  ok(/保存到手机[\s\S]*删除这张视频/.test(await E(`document.querySelector('.sheet.mnu')?.textContent || ''`)), '长按：保存到手机 / 删除');
  await E(`document.querySelector('.sheet.mnu [data-x=d]').click()`); await W(400); await E(`document.querySelector('.sheet.mnu .mi.danger')?.click()`); await W(500);
  ok(await E(`core.S.lock.lib.length`) == 3 && await E(`core.S.lock.wp`) == 'c:' + first, '删掉一张（正在用的那张没受影响）');
  // 随机锁屏：打开开关，勾雪夜 + 第一张，关一次手机就随机换
  await E(`document.querySelector('[data-k="lock.rand"]').click()`); await W(400);
  ok(await E(`core.S.lock.rand`) === true && await E(`core.S.lock.pool.length`) == 1, '打开随机锁屏：先勾上现在这张');
  await E(`document.querySelector('[data-sec=lk] .lw[data-x=snownight]').click()`); await W(300);
  await E(`document.querySelectorAll('[data-sec=lk] .lw.cu')[1].click()`); await W(300);
  ok(await E(`core.S.lock.pool.length == 3 && core.S.lock.pool.includes('snownight')`), '点格子：加入随机 ' + await E(`JSON.stringify(core.S.lock.pool)`));
  const seen = new Set(); for (let i = 0; i < 12; i++) { await E(`lk.relock(true)`); seen.add(await E(`core.S.lock.wp`)); } await E(`lk.unlock()`); await W(400);
  ok(seen.size >= 2 && [...seen].every(k => k == 'snownight' || k.startsWith('c:')), '每次重新锁屏：从勾选的里面随机换 ' + [...seen].join());
  // 只勾第二张：预览一定是第二张（以前总是显示最后点的那张）
  const k2 = await E(`'c:' + core.S.lock.lib[1].id`);
  await E(`core.S.lock.pool = ['${k2}']; core.S.lock.wp = 'c:' + core.S.lock.lib.at(-1).id; core.save()`);
  for (let i = 0; i < 3; i++) { await E(`document.querySelector('[data-a=lprev]').click()`); await W(600); ok(await E(`core.S.lock.wp`) == k2, '随机锁屏只勾了第二张：预览显示的就是第二张'); await E(`lk.unlock()`); await W(400); }
  await E(`core.S.lock.pool = ['snownight', '${k2}']; core.save(); core.top().re()`); await W(300);
  await E(`document.querySelector('[data-sec=lk] .lw.cu[data-x="${k2.slice(2)}"]').click()`); await W(300);
  ok(await E(`core.S.lock.wp`) == 'snownight', '把正在用的那张去掉勾：自动换成还勾着的');
  // 实况视频先读进内存再放（blob 地址）
  await E(`core.S.lock.rand = false; core.S.lock.wp = '${k2}'; core.save(); lk.lock(true)`); await W(1200);
  ok(/^blob:/.test(await E(`document.querySelector('.lock .lk-bg video.live')?.src || ''`)), '实况视频用内存里的地址播放');
  ok(await E(`document.querySelector('.lock .lk-bg video.live').classList.contains('on')`) && await E(`document.querySelector('.lock .lk-bg video.live').readyState`) >= 2, '预览时动起来了');
  await E(`lk.unlock()`); await W(400); await E(`core.S.lock.rand = true; core.save()`);
  await E(`document.querySelector('[data-k="lock.rand"]').click()`); await W(400);
  // 随机壁纸：上传两张，勾上，回到桌面就换
  const addW = async f => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), E(`document.querySelector('[data-sec=wp] .lw.vid').click()`)]); await fc.setFiles([{ name: 'w.jpg', mimeType: 'image/jpeg', buffer: fx(f) }]); await W(1500); };
  await addW('still.jpg'); await addW('still2.jpg');
  ok(await E(`core.S.walls.length`) == 2 && await E(`core.S.wall`) == await E(`core.S.walls[1].img`), '壁纸可以存好几张，上传的那张马上用上');
  await E(`document.querySelector('[data-k=wrand]').click()`); await W(400);
  await E(`document.querySelector('[data-sec=wp] .lw[data-x=theme]').click()`); await W(300); await E(`document.querySelectorAll('[data-sec=wp] .lw.cu')[0].click()`); await W(300);
  ok(await E(`core.S.wpool.length`) == 3, '随机壁纸：勾了 3 张（主题壁纸 + 两张上传的）');
  await p.locator('[data-sec=wp]').screenshot({ path: path.join(OUT, 'wall_rand.png') }).catch(() => {});
  const ws = new Set(); for (let i = 0; i < 10; i++) { await E(`core.APPS.theme.open()`); await W(80); await E(`core.home()`); await W(120); ws.add(await E(`core.S.wall`)); }
  ok(ws.size >= 2, '每次回到桌面：壁纸随机换（' + ws.size + ' 种）');
  await E(`core.S.wrand = false; core.save()`);
  // 旧数据：以前只有一张自定义（S.lock.img / video），自动放进列表
  await E(`(async () => { const lk2 = await import('/lock.js'); core.S.lock.lib = []; core.S.lock.img = 'data:image/png;base64,iVBORw0KGgo='; core.S.lock.video = ''; core.S.lock.wp = 'video'; lk2.lockMig(); })()`);
  ok(await E(`core.S.lock.lib.length == 1 && core.S.lock.wp == 'c:' + core.S.lock.lib[0].id && !core.S.lock.img`), '旧版的那一张自定义锁屏：自动放进列表、继续用');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
