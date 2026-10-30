const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'), store = {}, log = []; fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => {
  let body = ''; q.on('data', c => body += c); q.on('end', () => {
    if (q.url == '/api/images/upload') { const j = JSON.parse(body); const p = `/user/images/${j.ch_name}/${j.filename}.${j.format}`; store[p] = Buffer.from(j.image, 'base64'); log.push(['up', p, j.ch_name]); r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ path: p })); }
    if (q.url == '/api/images/delete') { const j = JSON.parse(body); log.push(['del', j.path]); delete store[j.path]; r.writeHead(200); return r.end(); }
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (store[u]) { r.writeHead(200, { 'content-type': u.endsWith('mp4') ? 'video/mp4' : 'image/webp' }); return r.end(store[u]); }
    const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u);
    try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); }
  });
}).listen(8766);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  await ctx.route(/fonts\.googleapis/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() == 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto('http://localhost:8766/'); await p.waitForFunction('window.booted && document.querySelector("#stp")');
  const E = s => p.evaluate(s);
  await E(`(async () => { window.core = await import('/core.js'); window.lk = await import('/lock.js'); })()`);
  const shot = n => p.screenshot({ path: path.join(OUT, n + '.png') });
  const swipeUp = async () => { const r = await E(`(() => { const b = document.querySelector('#stp .lock').getBoundingClientRect(); return [b.left + b.width / 2, b.bottom - 30]; })()`); await p.mouse.move(r[0], r[1]); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(r[0], r[1] - i * 30); await p.mouse.up(); await p.waitForTimeout(150); };
  const open = () => p.click('#stp-ball');
  const isOn = () => E(`document.querySelector('#stp').classList.contains('on')`);

  console.log('L1 lock screen appears when phone opened; swipe unlocks (no password)');
  await E(`core.S.lock.on = true; core.S.lock.wp = 'cathedral' /* 旧主题名：应自动换成素色 */; core.S.lock.text = 'since 2026.02.21 · still counting'`);
  await open(); await p.waitForTimeout(400);
  ok(await isOn() && await E(`!document.querySelector('#stp .lock').hidden && lk.isLocked()`), 'lock screen showing on first open');
  ok(/\d\d:\d\d/.test(await E(`document.querySelector('.lk-time').textContent`)) && /月.*日/.test(await E(`document.querySelector('.lk-date').textContent`)), 'clock + date rendered: ' + await E(`document.querySelector('.lk-date').textContent + ' ' + document.querySelector('.lk-time').textContent`));
  await p.waitForTimeout(1500); await shot('lock_plain'); ok(await E(`!!document.querySelector('.lk-bg canvas')`), 'old scene name falls back to 素色');
  await swipeUp(); await p.waitForTimeout(600);
  ok(!(await E(`lk.isLocked()`)) && await E(`document.querySelector('#stp .lock').hidden`), 'swipe up unlocked (no password)');
  await E(`document.querySelector('#stp .off').click()`); await p.waitForTimeout(200); await open(); await p.waitForTimeout(300);
  ok(await E(`lk.isLocked()`), 'power off → reopen shows lock again');

  console.log('L2 PIN password: set, wrong code, real code, backup 0000');
  await swipeUp(); await p.waitForTimeout(500);
  await E(`core.S.lock.pw = true; core.S.lock.type = 'pin'; lk.askPin()`); await p.waitForTimeout(500);
  const tapSheet = async digits => { for (const d of digits) await E(`[...document.querySelectorAll('.sheet .lk-pad [data-n="${d}"]')].pop().click()`); await p.waitForTimeout(250); };
  await tapSheet('0000'); ok(/0000 是备用密码/.test(await E(`document.querySelector('.sheet .lk-msg').textContent`)), 'cannot set 0000 as own PIN');
  await p.waitForTimeout(450); await tapSheet('1314'); await tapSheet('1314'); await p.waitForTimeout(400);
  ok(!!(await E(`core.S.lock.pin`)) && await E(`core.S.lock.pin != '1314'`), 'PIN stored (hashed, not plain)');
  await E(`document.querySelector('#stp .off').click()`); await open(); await p.waitForTimeout(400); await swipeUp(); await p.waitForTimeout(400);
  ok(await E(`!document.querySelector('.lk-auth').hidden`), 'swipe shows PIN pad'); await shot('lock_pin');
  const tapLock = async ds => { for (const d of ds) await p.click(`.lock .lk-pad [data-n="${d}"]`); await p.waitForTimeout(300); };
  await tapLock('1111'); ok(/密码错误/.test(await E(`document.querySelector('.lock .lk-msg').textContent`)) && await E(`lk.isLocked()`), 'wrong PIN rejected');
  await p.waitForTimeout(450); await tapLock('1314'); await p.waitForTimeout(600); ok(!(await E(`lk.isLocked()`)), 'correct PIN unlocks');
  await E(`document.querySelector('#stp .off').click()`); await open(); await p.waitForTimeout(400); await swipeUp(); await tapLock('0000'); await p.waitForTimeout(600);
  ok(!(await E(`lk.isLocked()`)), 'backup 0000 unlocks');
  await E(`document.querySelector('#stp .off').click()`); await open(); await p.waitForTimeout(400); await swipeUp();
  await p.keyboard.type('1314'); await p.waitForTimeout(700); ok(!(await E(`lk.isLocked()`)), 'keyboard typing works on desktop');

  console.log('L4 media: uploads go to XPhone folder; deleting follows');
  const before = log.length;
  const url = await E(`(async () => { const c = document.createElement('canvas'); c.width = c.height = 20; const b = await new Promise(r => c.toBlob(r, 'image/png')); return core.putMedia(b, 'img'); })()`);
  ok(/^\/user\/images\/XPhone\/img_\w+\.png$/.test(url) && log[before]?.[2] == 'XPhone', 'image saved as ' + url);
  await E(`(() => { const D = core.D(); D.chats.push({ id: 'c1', type: 'p', real: '沈知遥', nick: 'x', msgs: [{ f: 'me', t: 'img', c: '图片', url: '${url}', ts: 1 }, { f: 'me', t: 'text', c: 'hi', ts: 2 }], cfg: {}, members: [], admins: [], titles: {} }); core.saveD(); })()`);
  await p.waitForTimeout(3300); ok(await E(`JSON.stringify(core.S.media).includes('chatA')`), 'registry: file → chatA');
  // another chat (branch) also uses it
  await E(`(() => { const c = SillyTavern.getContext(); c.chatId = 'chatB'; c.eventSource.emit('cc'); })()`); await p.waitForTimeout(1000);
  ok(await E(`core.S.media['${url}'].join() == 'chatA,chatB'`), 'branch chatB that shares the data is registered too');
  await E(`(() => { const ch = core.D().chats[0]; core.drop(ch.msgs.splice(0, 1)); core.saveD(); })()`); await p.waitForTimeout(2000);
  ok(!log.some(x => x[0] == 'del' && x[1] == url), 'deleted in chatB only → file kept (chatA still uses it)');
  await E(`(() => { const c = SillyTavern.getContext(); c.eventSource.emit('cd', 'chatA'); })()`); await p.waitForTimeout(300);
  ok(log.some(x => x[0] == 'del' && x[1] == url), 'chatA deleted too → file removed from folder');
  const u2 = await E(`(async () => { const c = document.createElement('canvas'); c.width = c.height = 8; return core.putMedia(await new Promise(r => c.toBlob(r, 'image/png')), 'img'); })()`);
  await E(`core.S.assets.sticker.push({ id: 's1', name: '开心', img: '${u2}' }); core.save()`);
  await E(`core.drop(core.S.assets.sticker.splice(core.S.assets.sticker.findIndex(a => a.id == 's1'), 1))`); await p.waitForTimeout(1800);
  ok(log.some(x => x[0] == 'del' && x[1] == u2), 'deleted sticker → its file deleted');
  const u3 = await E(`(async () => { const c = document.createElement('canvas'); c.width = c.height = 8; return core.putMedia(await new Promise(r => c.toBlob(r, 'image/png')), 'img'); })()`);
  await E(`core.S.wall = '${u3}'; core.save()`); await E(`core.drop('${u3}')`); await p.waitForTimeout(1800);
  ok(!log.some(x => x[0] == 'del' && x[1] == u3), 'still-used wallpaper NOT deleted');

  console.log('L5 video lock wallpaper (≤5s) + theme picker');
  const vid = fs.readFileSync(path.join(here, 'v3.mp4')).toString('base64'), vlong = fs.readFileSync(path.join(here, 'v8.mp4')).toString('base64');
  await E(`core.home(); core.APPS.theme.open()`); await p.waitForTimeout(1500); await shot('theme_lock');
  ok(await E(`document.querySelectorAll('.lwg canvas[data-fx]').length == 1`), 'live 素色 preview in theme');
  const pick = async b64 => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), E(`document.querySelector('.lw.vid').click()`)]); await fc.setFiles({ name: 'v.mp4', mimeType: 'video/mp4', buffer: Buffer.from(b64, 'base64') }); await p.waitForTimeout(1500); };
  await pick(vlong); ok(/5 秒以内/.test(await E(`[...document.querySelectorAll('.stp-toast')].map(x => x.textContent).join()`)), '8s video rejected');
  await pick(vid); ok(await E(`(() => { const it = core.S.lock.lib.find(x => 'c:' + x.id == core.S.lock.wp); return !!it && /XPhone\\/lock_\\w+\\.mp4$/.test(it.video); })()`), 'video saved to folder: ' + await E('JSON.stringify(core.S.lock.lib)'));
  await E(`lk.lock(true)`); await p.waitForTimeout(800); ok(await E(`!!document.querySelector('.lock video') && /^blob:/.test(document.querySelector('.lock video').src)`), 'lock screen plays the video (loaded into memory first)');
  await E(`lk.unlock()`); await p.waitForTimeout(600);

  console.log('L6 opening a chat / swipes never trigger 剧情同步');
  await E(`SillyTavern.getContext().chat = [{ name: '灰吕杵志', mes: '他在群里发了条消息，说空间更新了。' }]`);
  const nSync = () => E(`core.LOG.filter(l => l.desc == '剧情同步').length`), n0 = await nSync();
  await E(`SillyTavern.getContext().eventSource.emit('mr', 0, 'first_message')`); await p.waitForTimeout(300);
  ok(await nSync() == n0, 'default (auto-sync off): greeting with keywords → no 剧情同步');
  await E(`core.S.scan = true`);
  for (const ty of ['first_message', 'swipe', 'extension']) await E(`SillyTavern.getContext().eventSource.emit('mr', 0, '${ty}')`);
  await p.waitForTimeout(300); ok(await nSync() == n0, 'even with auto-sync on: first_message / swipe / extension ignored');
  await E(`SillyTavern.getContext().eventSource.emit('mr', 0, 'normal')`); await p.waitForTimeout(300);
  ok(await nSync() == n0 + 1, 'auto-sync on + real AI reply → syncs (opt-in only)'); await E(`core.S.scan = false`);
  console.log('\nerrors:', errs.length ? errs : 'none'); console.log(`${pass} passed, ${fail} failed`);
  // scene screenshots with full lock UI
  await E(`core.S.lock.pw = false`);
  for (const k of ['plain']) { await E(`core.S.lock.wp = '${k}'; core.home(); lk.lock(true)`); await p.waitForTimeout(2500); await shot('L_' + k); await E(`lk.unlock()`); await p.waitForTimeout(500); }
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
