// 桌面小组件：尺寸 1～4 任意宽高；CCD 相机组件（机身颜色、照片、背景透明 / 毛玻璃 / 纯色 / 渐变 + 透明度、点一下换照片）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8795);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8795/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.dk = await import('/desk.js'); core.S.lock.on = false; core.S.desk.pages = [[]]; core.save(); dk.renderDesk(); })()`); await W(300);
  // 尺寸：1～4 任意组合
  await E(`core.G.dlp('', document.querySelector('.desk .page'), new PointerEvent('pointerdown'))`); await W(200);
  await E(`document.querySelector('[data-a=wAdd]').click()`); await W(400);
  ok(/CCD 相机/.test(await E(`document.querySelector('.sheet.mnu').textContent`)), '添加小组件里有「CCD 相机」');
  await E(`document.querySelector('.sheet.mnu [data-x=ccd]').click()`); await W(800);
  ok(await E(`!!document.querySelector('.desk .it.ccd.w2.h2')`), '加了一个 2×2 的 CCD');
  await E(`document.querySelector('.desk .it.ccd').click()`); await W(500);
  const szs = await E(`[...document.querySelectorAll('.sheet.in select[data-k=sz] option')].map(o => o.value)`);
  ok(szs.length == 16 && szs[0] == '1x1' && szs.includes('3x3') && szs.includes('1x4') && szs.at(-1) == '4x4', '尺寸：1～4 宽 × 1～4 高，一共 16 种 ' + szs.join(','));
  ok(/机身颜色[\s\S]*背景[\s\S]*背景不透明度/.test(await E(`document.querySelector('.sheet.in').textContent`)), '设置里有机身颜色、背景、透明度');
  await E(`document.querySelector('.sheet.in select[data-k=sz]').value = '1x1'; document.querySelector('.sheet.in select[data-k=sz]').dispatchEvent(new Event('change', { bubbles: true }))`);
  ok(await E(`document.querySelector('.sheet.in input[data-k=body]').type == 'color' && document.querySelector('.sheet.in input[data-k=body]').value == '#f2a7c4'`), '机身颜色是取色器，默认原图的粉');
  await E(`document.querySelector('.sheet.in input[data-k=body]').value = '#3366cc'; document.querySelector('.sheet.in input[data-k=body]').dispatchEvent(new Event('change', { bubbles: true }))`);
  await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(500);
  ok(await E(`!!document.querySelector('.desk .it.ccd.w1.h1')`), '改成 1×1：真的变成一格');
  const r1 = await E(`(() => { const r = document.querySelector('.desk .it.ccd .ccd-cam').getBoundingClientRect(), b = document.querySelector('.desk .it.ccd').getBoundingClientRect(); return [r.width / b.width, r.height / b.height, r.width / r.height]; })()`);
  ok(r1[0] <= 1 && r1[1] <= 1 && Math.abs(r1[2] - 900 / 777) < .05, '相机在格子里不超出、比例不变 ' + r1.map(x => x.toFixed(2)));
  ok(/assets\/ccd\/body\.webp/.test(await E(`document.querySelector('.desk .it.ccd img.ccd-body').src`)) || /^data:/.test(await E(`document.querySelector('.desk .it.ccd img.ccd-body').src`)), '机身用的是抠好的相机图');
  await W(1500);
  const bc = await E(`(() => { const im = document.querySelector('.desk .it.ccd img.ccd-body'); if (!im.src.startsWith('data:')) return null; const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n]; })()`);
  ok(bc && bc[2] > bc[0] + 30 && bc[2] > bc[1], '选了蓝色：机身真的变成蓝色（算出来的新图，平均色偏蓝）' + (bc || []).map(x => x | 0));
  // 背景
  const setBg = async (bg, a) => { await E(`(() => { const it = core.S.desk.pages[0][0]; it.p.bg = '${bg}'; it.p.bgA = ${a}; it.p.bgC = '#3366ff'; it.p.bgC2 = '#ff0000'; it.w = 2; it.h = 2; core.save(); dk.renderDesk(); })()`); await W(200); return E(`getComputedStyle(document.querySelector('.desk .it.ccd .ccd-bg')).backgroundImage + '|' + getComputedStyle(document.querySelector('.desk .it.ccd .ccd-bg')).backgroundColor + '|' + getComputedStyle(document.querySelector('.desk .it.ccd .ccd-bg')).backdropFilter`); };
  ok(/^none\|rgba\(0, 0, 0, 0\)\|none$/.test(await setBg('none', 60)), '背景默认透明');
  ok(/rgba\(51, 102, 255, 0\.6\)/.test(await setBg('solid', 60)), '纯色 + 60% 透明度');
  ok(/linear-gradient[\s\S]*rgba\(51, 102, 255, 0\.3\)[\s\S]*rgba\(255, 0, 0, 0\.3\)/.test(await setBg('grad', 30)), '渐变（两个颜色）+ 30% 透明度');
  ok(/blur\(14px\)/.test(await setBg('glass', 60)), '毛玻璃');
  // 点一下换照片
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), (async () => { await E(`document.querySelector('[data-a=edDone]').click()`); await W(300); await E(`document.querySelector('.desk .it.ccd').click()`); await W(300); await E(`document.querySelector('.sheet.mnu [data-x=f]').click()`); })()]);
  await fc.setFiles([{ name: 'p.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(here, '../fixtures/still.jpg')) }]); await W(1500);
  ok(await E(`!!core.S.desk.pages[0][0].p.img && !!document.querySelector('.desk .it.ccd .ccd-scr img')`), '点一下 CCD：换照片，照片显示在屏幕上');
  await p.locator('#stp .desk').screenshot({ path: path.join(OUT, 'ccd.png') });
  // 4×1 也放得下
  await E(`(() => { const it = core.S.desk.pages[0][0]; it.w = 4; it.h = 1; core.save(); dk.renderDesk(); })()`); await W(300);
  const r2 = await E(`(() => { const r = document.querySelector('.desk .it.ccd .ccd-cam').getBoundingClientRect(), b = document.querySelector('.desk .it.ccd').getBoundingClientRect(); return [r.width / b.width, r.height / b.height]; })()`);
  ok(r2[0] <= 1 && r2[1] <= 1 && r2[1] > .8, '4×1 长条：相机按高度放，不超出 ' + r2.map(x => x.toFixed(2)));
  await p.locator('#stp .desk').screenshot({ path: path.join(OUT, 'ccd_wide.png') });
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
