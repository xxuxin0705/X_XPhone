// 音乐 App：搜索 / 播放 / 歌词 / 我喜欢 / 歌单 / 播放队列 / 榜单 / 正文「点歌」进 TA 推荐 / 告诉角色正在听什么（接口全部模拟，不连外网）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8812);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const MP3 = fs.readFileSync(path.join(root, 'tests/fixtures/tone.mp3')), PIC = fs.readFileSync(path.join(root, 'assets/ccd/body.webp'));
const songs = n => Array.from({ length: n }, (_, i) => ({ id: String(1000 + i), song: `测试歌${i + 1}`, singer: `歌手${i % 3 + 1}`, cover: `https://img.test/c${i}.webp`, interval: '3:2' + i }));
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const errs = [], hits = []; p.on('pageerror', e => errs.push(e.message));
  const J = (r, j) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(j) });
  await p.route('https://api.vkeys.cn/**', r => { const u = new URL(r.request().url()); hits.push('vkeys ' + u.search); if (u.searchParams.get('id')) return J(r, { data: { url: 'https://audio.test/v' + u.searchParams.get('id') + '.mp3' } });
    const w = u.searchParams.get('word'), pg = +u.searchParams.get('page'); return J(r, { data: w == '没有' ? [] : songs(20).map(s => ({ ...s, id: s.id + (pg > 1 ? '9' : ''), song: (w.split(' ')[0]) + '·' + s.song + (pg > 1 ? 'b' : '') })) }); });
  await p.route('https://api.qijieya.cn/**', r => { const u = new URL(r.request().url()), t = u.searchParams.get('type'), id = u.searchParams.get('id'); hits.push('meting ' + t + ' ' + id);
    if (t == 'song') return J(r, id == '1001' ? [{ url: 'https://music.163.com/404' }] : [{ url: 'https://audio.test/m' + id + '.mp3', pic: 'https://img.test/p.webp' }]);
    if (t == 'lrc') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '[00:00.00]第一句歌词\n[00:02.00]第二句歌词\n[00:04.00]第三句歌词' });
    if (t == 'tlrc') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '[00:00.00]first line' });
    if (t == 'playlist') return J(r, songs(5).map(s => ({ name: '榜单' + s.song, artist: s.singer, url: `https://api.qijieya.cn/meting/?type=url&id=${s.id}`, pic: s.cover }))); return J(r, []); });
  await p.route('https://audio.test/**', r => { hits.push('audio ' + r.request().url()); return r.fulfill({ status: 200, headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }, body: MP3 }); });
  await p.route('https://music.163.com/**', r => r.fulfill({ status: 404, body: '' }));
  await p.route('https://img.test/**', r => r.fulfill({ status: 200, headers: { 'content-type': 'image/webp' }, body: PIC }));
  await p.goto('http://localhost:8812/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, n) });
  await E(`(async () => { window.core = await import('/core.js'); window.pl = await import('/apps/music/player.js'); window.dk = await import('/desk.js'); core.S.lock.on = false; window.ep = []; SillyTavern.getContext().setExtensionPrompt = (k, v) => ep.push(v); })()`); await W(300);
  ok(await E(`!!core.APPS.music && core.S.desk.dock.some(x => x.app == 'music')`), '桌面 Dock 上有「音乐」');
  await E(`core.openApp('music')`); await W(500);
  ok(/榜单/.test(await E(`document.querySelector('.musicapp').textContent`)) && await E(`document.querySelectorAll('.ms-top').length`) == 4, '发现页：搜索框、4 个榜单、热门搜索');
  // 搜索
  await p.fill('.ms-sb input', '晴天'); await p.press('.ms-sb input', 'Enter'); await W(700);
  ok(await E(`document.querySelectorAll('.musicapp .ms-r').length`) == 20, '搜索出 20 首');
  await E(`document.querySelector('[data-a=mmoreres]').click()`); await W(600);
  ok(await E(`document.querySelectorAll('.musicapp .ms-r').length`) == 40, '加载更多：再来 20 首');
  // 点第一首播放
  await E(`document.querySelector('.musicapp .ms-r').click()`); await W(1500);
  ok(await E(`pl.st.playing && pl.cur().name.startsWith('晴天')`), '点歌：开始播放 ' + await E(`JSON.stringify([pl.st.playing, pl.st.err, pl.cur()?.name])`));
  ok(await E(`!!document.querySelector('.ms-mini') && document.querySelector('.ms-mini').textContent.includes('晴天')`), '底部出现迷你播放条');
  // 第 2 首的 Meting 返回 404：自动换下一个地址
  await E(`document.querySelectorAll('.musicapp .ms-r')[1].click()`); await W(1500);
  ok(await E(`pl.st.playing`) && hits.some(h => h.includes('vkeys ?id=1001')), 'Meting 地址不能用：自动换 vkeys 的地址接着放');
  // 播放页 + 歌词
  await E(`document.querySelector('.ms-mini').click()`); await W(600);
  ok(await E(`!!document.querySelector('.ms-player .ms-big') && document.querySelector('.ms-player .ms-info').textContent.includes('晴天')`), '打开播放页：大封面、歌名歌手');
  await W(2600);
  ok(/第.句歌词/.test(await E(`document.querySelector('.ms-line').textContent`)), '封面下面跟着显示当前这句歌词：' + await E(`document.querySelector('.ms-line').textContent`));
  await shot('music_player.png');
  await E(`document.querySelector('.ms-stage').click()`); await W(500);
  ok(await E(`document.querySelectorAll('.ms-lrc p').length == 3 && !!document.querySelector('.ms-lrc p.on') && document.querySelector('.ms-lrc p small').textContent == 'first line'`), '点封面切到滚动歌词，当前句高亮，有翻译');
  await shot('music_lyrics.png');
  // 喜欢、模式、暂停
  await E(`document.querySelector('[data-a=mlike]').click()`); await W(200);
  ok(await E(`core.S.music.liked.length == 1 && !!document.querySelector('[data-a=mlike].on')`), '点爱心：加入我喜欢');
  await E(`document.querySelector('[data-a=mmode]').click()`); await W(200);
  ok(await E(`core.S.music.mode`) == 'one', '切换播放模式：单曲循环');
  await E(`document.querySelector('.ms-ctl [data-a=mtog]').click()`); await W(300);
  ok(await E(`!pl.st.playing`), '暂停');
  // 告诉角色正在听
  await E(`document.querySelector('.ms-ctl [data-a=mtog]').click()`); await W(900);
  ok(await E(`ep.some(v => /正在用手机听《晴天/.test(v))`), '正文提示词里告诉角色「正在听《…》」');
  // 播放队列
  await E(`document.querySelector('.ms-ctl [data-a=mq]').click()`); await W(400);
  ok(await E(`document.querySelectorAll('.sheet.ms-qs .ms-r').length`) == 2 && await E(`document.querySelectorAll('.sheet.ms-qs .ms-r.now').length == 1`), '播放列表：搜索里点过的 2 首，正在放的高亮');
  const nowName = await E(`pl.cur().name`);
  await E(`document.querySelector('.sheet.ms-qs .ms-r:not(.now) [data-a=mqrm]').click()`); await W(300);
  ok(await E(`core.S.music.q.length == 1 && pl.st.playing && core.S.music.qi == 0 && pl.cur().name`) == nowName, '删掉不在放的那首，正在放的不受影响');
  await E(`document.querySelector('.sheet.ms-qs').classList.remove('in'); core.home(); core.openApp('music')`); await W(500);
  // 歌曲菜单：加入歌单（新建）
  await E(`document.querySelector('[data-a=mtab][data-x=mine]').click()`); await W(300);
  ok(/我喜欢[\s\S]*1 首[\s\S]*最近播放/.test(await E(`document.querySelector('.musicapp').textContent`)), '我的：我喜欢 1 首、最近播放');
  await E(`document.querySelector('[data-a=mnew]').click()`); await W(400); await p.fill('.sheet.in input[data-k=n]', '雨天听'); await p.press('.sheet.in input[data-k=n]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(700);
  ok(await E(`core.S.music.lists[0]?.n`) == '雨天听' && await E(`!!document.querySelector('.ms-lpg')`), '新建歌单「雨天听」并打开');
  await E(`core.back()`); await W(400);
  await E(`document.querySelector('[data-a=mopen][data-x=liked]').click()`); await W(500);
  const m1 = E(`document.querySelector('.ms-lpg .ms-mo').click()`); await W(400);
  await E(`document.querySelector('.sheet.mnu [data-x=a]').click()`); await W(400); await E(`[...document.querySelectorAll('.sheet.mnu .mi')].find(b => b.textContent.includes('雨天听')).click()`); await W(400);
  ok(await E(`core.S.music.lists[0].songs.length`) == 1, '歌曲菜单 → 加入歌单');
  await E(`core.back()`); await W(400);
  // 榜单
  await E(`document.querySelector('[data-a=mtab][data-x=find]').click()`); await W(300);
  await E(`document.querySelector('[data-a=mclr]').click()`); await W(300);
  await E(`document.querySelector('.ms-top').click()`); await W(900);
  ok(await E(`document.querySelectorAll('.ms-lpg .ms-r').length`) == 5 && await E(`!!document.querySelector('.ms-lpg .ms-rk')`), '榜单：5 首，带排名');
  await E(`document.querySelector('.ms-lpg [data-a=mall]').click()`); await W(1500);
  ok(await E(`pl.cur().name.startsWith('榜单') && core.S.music.q.length == 5`), '播放全部：队列换成榜单');
  await shot('music_top.png'); await E(`core.back()`); await W(300);
  // 正文点歌
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: '他把耳机分了一只给你。\\n<手机>\\n点歌|灰吕杵志|《晴天》|周杰伦\\n</手机>', is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(800);
  ok(await E(`core.D().mus.recs[0].name == '晴天' && core.D().mus.recs[0].by == '灰吕杵志'`), '正文 <手机> 块里「点歌|谁|歌名|歌手」：进 TA 推荐');
  ok(await E(`!SillyTavern.getContext().chat.at(-1).mes.includes('点歌')`), '点歌那行不显示在正文里');
  ok(/TA 推荐[\s\S]*晴天[\s\S]*灰吕杵志推荐/.test(await E(`document.querySelector('.musicapp').textContent`)), '发现页出现「TA 推荐」');
  await shot('music_find.png');
  // 灵动岛 / 时间旁胶囊
  await E(`core.home()`); await W(400);
  ok(await E(`document.querySelector('.isl').classList.contains('mu') && getComputedStyle(document.querySelector('.isl')).display != 'none'`), '回到桌面：状态栏显示正在放歌的小胶囊');
  await E(`document.querySelector('.isl').click()`); await W(500);
  ok(await E(`!!document.querySelector('.ms-player')`), '点小胶囊：打开播放页');
  await shot('music_island.png');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
