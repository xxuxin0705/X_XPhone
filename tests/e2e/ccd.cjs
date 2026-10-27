// 桌面小组件：只剩 CCD；添加时按尺寸筛选、带预览；调整大小只能同比例；CCD 相机组件（机身颜色、照片、背景透明 / 毛玻璃 / 纯色 / 渐变 + 透明度、点一下换照片）
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
  ok(/CCD 相机/.test(await E(`document.querySelector('.sheet.wadd').textContent`)), '添加小组件里有「CCD 相机」');
  const cards = await E(`[...document.querySelectorAll('.sheet.wadd .wcard')].map(x => x.dataset.k + ':' + x.dataset.sz)`);
  ok(!cards.some(x => /^(pill|cal|days|text):/.test(x)), '旧的便签类组件已移除 ' + cards.join(','));
  ok(cards.filter(x => x.startsWith('ccd:')).join() == 'ccd:2x2', 'CCD 只有一张卡片（2×2），大小加到桌面后再改');
  ok(await E(`!!document.querySelector('.sheet.wadd .wcard[data-k=ccd] img.ccd-body')`), '卡片里是实际渲染的相机预览');
  ok(cards.includes('ccdWide:4x2') && await E(`!!document.querySelector('.sheet.wadd [data-k=ccdWide] svg.cw-body')`), '新增横版 CCD 4×2 卡片，展示实际机壳');
  ok(cards.includes('paint:3x3') && await E(`!!document.querySelector('.sheet.wadd [data-k=paint] svg.paint-chrome')`), '画图相框默认 3×3，卡片有实际预览');
  const chips = await E(`[...document.querySelectorAll('.sheet.wadd .szf b')].map(x => x.textContent)`);
  ok(chips[0] == '全部尺寸' && chips.includes('2×2') && chips.includes('4×2') && !chips.includes('4×4'), '顶上有尺寸筛选 ' + chips.join(' '));
  await E(`document.querySelector('.sheet.wadd .szf [data-x="4x2"]').click()`); await W(200);
  ok(await E(`[...document.querySelectorAll('.sheet.wadd .wcard')].every(x => x.dataset.sz == '4x2')`), '点 4×2：只剩 4×2 的卡片');
  await E(`document.querySelector('.sheet.wadd .szf [data-x=""]').click()`); await W(200);
  ok(await E(`dk.sizes(2, 1).map(x => x.join('x')).join(',') == '2x1,4x2' && dk.sizes(4, 1).map(x => x.join('x')).join(',') == '4x1' && dk.sizes(1, 2).map(x => x.join('x')).join(',') == '1x2,2x4'`), '比例规则：2×1 → 4×2，4×1 只有自己，1×2 → 2×4');
  await E(`document.querySelector('.sheet.wadd .wcard[data-k=ccd][data-sz="2x2"]').click()`); await W(800);
  ok(await E(`!!document.querySelector('.desk .it.ccd.w2.h2')`), '加了一个 2×2 的 CCD');
  await E(`document.querySelector('.desk .it.ccd').click()`); await W(500);
  ok(await E(`!document.querySelector('.sheet.in [data-a=ok]')`), '组件设置没有保存按钮，关闭即保留');
  const szs = await E(`[...document.querySelectorAll('.sheet.in select[data-k=sz] option')].map(o => o.value)`);
  ok(szs.join(',') == '1x1,2x2,3x3,4x4', '调整大小只能选同比例：' + szs.join(','));
  ok(/机身颜色[\s\S]*照片缩放[\s\S]*背景/.test(await E(`document.querySelector('.sheet.in').textContent`)) && !/背景颜色/.test(await E(`document.querySelector('.sheet.in').textContent`)) && await E(`document.querySelector('.sheet.in [data-k=zoom]').type == 'range'`), '设置里有机身颜色、滑块调照片、背景（透明时没有背景颜色）');
  await E(`document.querySelector('.sheet.in select[data-k=sz]').value = '1x1'; document.querySelector('.sheet.in select[data-k=sz]').dispatchEvent(new Event('change', { bubbles: true }))`);
  ok(await E(`!document.querySelector('.sheet.in input[type=color]') && document.querySelector('.sheet.in input[data-k=body]').value == '#f2a7c4'`), '机身颜色用方形色板（不弹系统取色器），默认原图的粉');
  await E(`document.querySelector('.sheet.in input[data-k=body]').value = '#3366cc'; document.querySelector('.sheet.in input[data-k=body]').dispatchEvent(new Event('change', { bubbles: true }))`);
  ok(await E(`core.S.desk.pages[0][0].w == 1 && core.S.desk.pages[0][0].p.body == '#3366cc'`), '尺寸和机身颜色未关闭面板就已应用');
  await E(`document.querySelector('.sheet.in')._pg.close()`); await W(500);
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
  ok(/blur\(18px\)/.test(await setBg('glass', 60)), '毛玻璃');
  const glassPad = await E(`(() => { const el = document.querySelector('.desk .it.ccd'), bg=el.querySelector('.ccd-bg').getBoundingClientRect(), cam=el.querySelector('.ccd-cam').getBoundingClientRect(); return [cam.left-bg.left,bg.right-cam.right,cam.top-bg.top,bg.bottom-cam.bottom]; })()`);
  ok(glassPad.every(x=>x>5) && Math.max(...glassPad)-Math.min(...glassPad)<1, '相机背景四周留白一致，不再只包住上下');
  ok(await E(`(() => { const page=document.querySelector('.desk .page');return getComputedStyle(page).gridTemplateRows.split(' ').length===7 && page.scrollHeight<=page.clientHeight+1 && getComputedStyle(page).overflowY==='hidden'; })()`), '桌面固定七行，没有纵向滚动');
  // 普通点击没有上传动作；长按进入编辑后，在设置里更换照片。
  await E(`document.querySelector('[data-a=edDone]').click()`);await W(300);
  await E(`document.querySelector('.desk .it.ccd').click()`);await W(300);
  ok(await E(`!document.querySelector('.sheet.in')`),'普通点击 CCD 不弹出上传菜单');
  await E(`core.G.dlp('',document.querySelector('.desk .page'),new PointerEvent('pointerdown'));document.querySelector('.desk .it.ccd').click()`);await W(300);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'),(async()=>{await E(`document.querySelector('.sheet.in [data-a=img][data-x=img]').click()`);await W(200);await E(`document.querySelector('.sheet.mnu [data-x=f]').click()`);})()]);
  await fc.setFiles([{name:'p.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync(path.join(here,'../fixtures/still.jpg'))}]);await W(1500);
  ok(await E(`!!core.S.desk.pages[0][0].p.img && !!document.querySelector('.desk .it.ccd .ccd-scr img')`),'编辑面板更换照片，桌面实时更新');
  await E(`document.querySelector('.sheet.in:not(.mnu)')._pg.close();document.querySelector('[data-a=edDone]').click()`);await W(400);
  // 宽度填满屏幕的照片，放大后也应实际左右平移，而非仅修改无效的 object-position。
  const pan = await E(`(() => { const it = core.S.desk.pages[0][0]; const samples = [0,50,100].map(px => { Object.assign(it.p,{zoom:196,px,py:50}); dk.renderDesk(); const el = document.querySelector('.desk .ccd-scr img'), m = new DOMMatrix(getComputedStyle(el).transform); return m.m41; }); Object.assign(it.p,{zoom:100,px:50,py:50});dk.renderDesk();return samples; })()`);
  ok(pan[0] < 0 && Math.abs(pan[1]) < 1 && pan[2] > 0, '放大照片后，左右滑块确实平移图片');
  await p.locator('#stp .desk').screenshot({ path: path.join(OUT, 'ccd.png') });
  // 4×4 也放得下
  await E(`(() => { const it = core.S.desk.pages[0][0]; it.w = 4; it.h = 4; core.save(); dk.renderDesk(); })()`); await W(300);
  const r2 = await E(`(() => { const r = document.querySelector('.desk .it.ccd .ccd-cam').getBoundingClientRect(), b = document.querySelector('.desk .it.ccd').getBoundingClientRect(); return [r.width / b.width, r.height / b.height]; })()`);
  ok(r2[0] <= 1 && r2[1] <= 1 && r2[0] > .85, '4×4 大块：相机铺满、不超出 ' + r2.map(x => x.toFixed(2)));
  await p.locator('#stp .desk').screenshot({ path: path.join(OUT, 'ccd_wide.png') });
  // 拖到右边缘翻页：拿起来的是浮在上层的影子，停一下就滑到下一页，手不用松
  await E(`(() => { core.S.desk.pages = [[core.S.desk.pages[0][0]]]; core.S.desk.pages[0][0].w = 2; core.S.desk.pages[0][0].h = 2; core.save(); dk.renderDesk(); core.G.dlp('', document.querySelector('.desk .page'), new PointerEvent('pointerdown')); })()`); await W(300);
  const bb = await p.locator('.desk .it.ccd').boundingBox(), dr = await p.locator('#stp .desk').boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await W(280);
  for (let i = 1; i <= 10; i++) { await p.mouse.move(bb.x + bb.width / 2 + (dr.x + dr.width - 6 - bb.x - bb.width / 2) * i / 10, bb.y + bb.height / 2); await W(16); }
  ok(await E(`!!document.querySelector('.it.ghost') && document.querySelector('.desk .it.ccd').classList.contains('desk-placeholder')`), '拖起来：浮着一个影子，原位置半透明占位');
  await W(1100);
  ok(await E(`core.S.desk.pages.length == 2 && Math.round(document.querySelector('.desk .pages').scrollLeft / document.querySelector('.desk .pages').clientWidth) == 1 && !!document.querySelector('.it.ghost')`), '停在右边缘：组件翻到下一页，影子还在手上');
  await p.mouse.move(dr.x + dr.width / 2, dr.y + 200, { steps: 6 }); await W(100); await p.mouse.up(); await W(400);
  ok(await E(`!document.querySelector('.it.ghost') && !document.querySelector('.desk .it.desk-placeholder') && core.S.desk.pages[1].some(x => x.k == 'ccd') && Math.round(document.querySelector('.desk .pages').scrollLeft / document.querySelector('.desk .pages').clientWidth) == 1`), '松手：放在第二页，影子消失，停在第二页');
  ok(await E(`(() => { const b = document.querySelector('.desk .ed-bar').getBoundingClientRect(), d = document.querySelector('.desk .dock').getBoundingClientRect(); return b.bottom <= d.top + 1 && b.top > 500; })()`), '＋小组件 / ＋页面 / 完成 放到下面（在 Dock 上方）');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();


