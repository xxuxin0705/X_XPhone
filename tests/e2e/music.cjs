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
  ok(await E(`[...document.querySelectorAll('.mu-nav button')].map(b => b.textContent).join()`) == '首页,搜索,笔记,我的' && await E(`[...document.querySelectorAll('.mu-seg b')].map(b => b.textContent).join()`) == '心动,推荐', '四个页签：首页 / 搜索 / 笔记 / 我的；首页只有心动 / 推荐');
  ok(await E(`!!document.querySelector('.mu-home-heart .mu-vinyl.idle') && /心动模式|先去喜欢/.test(document.querySelector('.mu-heart').textContent)`), '没在放歌时：粉色黑胶页，提示心动模式');
  await shot('music_heart_empty.png');
  // 搜索
  await E(`document.querySelector('[data-a=mtab][data-x=srch]').click()`); await W(300);
  ok(await E(`document.querySelectorAll('.mu-top').length`) == 4 && await E(`!!document.querySelector('.mu-sb input')`), '搜索页：搜索框 + 4 个榜单 + 快速发现');
  await p.fill('.mu-sb input', '晴天'); await p.press('.mu-sb input', 'Enter'); await W(700);
  ok(await E(`document.querySelectorAll('.musicapp .mu-r').length`) == 20, '搜索出 20 首');
  await E(`document.querySelector('[data-a=mmoreres]').click()`); await W(600);
  ok(await E(`document.querySelectorAll('.musicapp .mu-r').length`) == 40, '加载更多：再来 20 首');
  await shot('music_search.png');
  await E(`document.querySelector('.musicapp .mu-r').click()`); await W(1500);
  ok(await E(`pl.st.playing && pl.cur().name.startsWith('晴天')`), '点歌：开始播放 ' + await E(`JSON.stringify([pl.st.playing, pl.st.err, pl.cur()?.name])`));
  ok(await E(`!!document.querySelector('.mu-mini') && document.querySelector('.mu-mini').textContent.includes('晴天') && document.querySelector('.mu-disc-s').classList.contains('spin')`), '底部迷你播放条：小唱片在转');
  await E(`document.querySelectorAll('.musicapp .mu-r')[1].click()`); await W(1500);
  ok(await E(`pl.st.playing`) && hits.some(h => h.includes('vkeys ?id=1001')), 'Meting 地址不能用：自动换 vkeys 的地址接着放');
  // 心动页（播放页）
  await E(`document.querySelector('.mu-mini').click()`); await W(600);
  ok(await E(`!!document.querySelector('.mu-home-heart .mu-vinyl.on .mu-cvd') && document.querySelector('.mu-meta').textContent.includes('晴天')`), '点迷你条回到心动页：黑胶在转、歌名歌手');
  ok(await E(`getComputedStyle(document.querySelector('.mu-home-heart .pg-b')).backgroundColor`) == 'rgb(253, 227, 234)', '心动页是粉色的');
  await shot('music_heart.png');
  await E(`document.querySelector('.mu-vinyl').click()`); await W(2600);
  ok(await E(`document.querySelectorAll('.mu-lrc p').length == 3 && !!document.querySelector('.mu-lrc p.on') && document.querySelector('.mu-lrc p small').textContent == 'first line'`), '点黑胶切到歌词，当前句高亮，有翻译');
  await shot('music_lyrics.png');
  // 摘录歌词 → 笔记
  await E(`core.G.mpkon?.('', document.querySelectorAll('.mu-lrc p')[0]) || document.querySelector('.musicapp')._pg.acts.mpkon('', document.querySelectorAll('.mu-lrc p')[0])`); await W(300);
  ok(await E(`!!document.querySelector('.mu-pkbar') && document.querySelectorAll('.mu-lrc p.pk').length == 1`), '长按一句：进入摘录模式');
  await E(`document.querySelectorAll('.mu-lrc p')[1].click()`); await W(200);
  ok(await E(`document.querySelectorAll('.mu-lrc p.pk').length`) == 2, '再点一句：选了 2 句');
  await E(`document.querySelector('[data-a=mpkok]').click()`); await W(400); await p.fill('.sheet.in textarea[data-k=t]', '这两句好戳我'); await p.press('.sheet.in textarea[data-k=t]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(500);
  ok(await E(`core.S.music.notes.length == 1 && core.S.music.notes[0].lines.join('/') == '第一句歌词/第二句歌词' && core.S.music.notes[0].text == '这两句好戳我'`), '摘录 2 句 + 一句话 → 存进笔记');
  ok(await E(`document.querySelector('.mu-meta [data-a=mnotes] em')?.textContent`) == '1', '歌名旁的评论图标显示这首歌有 1 条笔记');
  await E(`document.querySelector('[data-a=mtab][data-x=notes]').click()`); await W(300);
  ok(await E(`document.querySelectorAll('.mu-note').length == 1 && document.querySelector('.mu-note blockquote').textContent.includes('第一句歌词')`), '笔记页：显示摘录的歌词卡片');
  await shot('music_notes.png');
  // 喜欢、模式、暂停、告诉角色
  await E(`document.querySelector('[data-a=mtab][data-x=home]').click()`); await W(300); await E(`document.querySelector('[data-a=mlike]').click()`); await W(200);
  ok(await E(`core.S.music.liked.length == 1 && !!document.querySelector('[data-a=mlike].on')`), '点爱心：加入我喜欢');
  await E(`document.querySelector('[data-a=mmode]').click()`); await W(200);
  ok(await E(`core.S.music.mode`) == 'one', '切换播放模式：单曲循环');
  await E(`document.querySelector('.mu-ctl [data-a=mtog]').click()`); await W(300); ok(await E(`!pl.st.playing`), '暂停');
  await E(`document.querySelector('.mu-ctl [data-a=mtog]').click()`); await W(900);
  ok(await E(`ep.some(v => /正在用手机听《晴天/.test(v))`), '正文提示词里告诉角色「正在听《…》」');
  // 播放队列
  await E(`document.querySelector('.mu-ctl [data-a=mq]').click()`); await W(400);
  ok(await E(`document.querySelectorAll('.sheet.mu-qs .mu-r').length`) == 2 && await E(`document.querySelectorAll('.sheet.mu-qs .mu-r.now').length == 1`), '当前播放：2 首，正在放的高亮');
  const nowName = await E(`pl.cur().name`);
  await E(`document.querySelector('.sheet.mu-qs .mu-r:not(.now) [data-a=mqrm]').click()`); await W(300);
  ok(await E(`core.S.music.q.length == 1 && pl.st.playing && pl.cur().name`) == nowName, '删掉不在放的那首，正在放的不受影响');
  await E(`document.querySelector('.sheet.mu-qs')._pg.close()`); await W(400);
  // 我的
  await E(`document.querySelector('[data-a=mtab][data-x=mine]').click()`); await W(300);
  ok(await E(`!!document.querySelector('.mu-prof .mu-av') && /最近[\\s\\S]*歌词[\\s\\S]*我喜欢的音乐[\\s\\S]*1 首/.test(document.querySelector('.musicapp').textContent)`), '我的：头像、最近 / 歌词按钮、我喜欢 1 首');
  ok(await E(`getComputedStyle(document.querySelector('.mu-mine .pg-h')).backgroundColor`) == 'rgb(29, 29, 32)', '我的页顶部是深色');
  await shot('music_mine.png');
  await E(`document.querySelector('.mu-pb [data-a=mnotes]').click()`); await W(400);
  ok(await E(`document.querySelector('.mu-notes .pg-t').textContent`) == '歌词本' && await E(`document.querySelectorAll('.mu-note').length`) == 1, '点「歌词」：打开歌词本，里面是摘录');
  await E(`core.back()`); await W(400);
  // 右上角：角色点歌开关
  ok(!(await E(`ep.at(-1)`)).includes('点歌|'), '默认不让角色点歌：提示词里没有点歌格式');
  await E(`document.querySelector('[data-a=mmenu]').click()`); await W(300); await E(`document.querySelector('.sheet.mnu [data-x=ask]').click()`); await W(400);
  ok(await E(`core.S.music.ask === true`) && (await E(`ep.at(-1)`)).includes('点歌|谁点的|歌名|歌手'), '打开「角色给你点歌」：提示词里加上点歌格式');
  // 新建歌单 + 收藏到歌单
  await E(`document.querySelector('[data-a=mnew]').click()`); await W(400); await p.fill('.sheet.in input[data-k=n]', '雨天听'); await p.press('.sheet.in input[data-k=n]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(700);
  ok(await E(`core.S.music.lists[0]?.n`) == '雨天听' && await E(`!!document.querySelector('.mu-lpg')`), '新建歌单「雨天听」并打开');
  await E(`core.back()`); await W(400);
  await E(`document.querySelector('[data-a=mopen][data-x=liked]').click()`); await W(500);
  await E(`document.querySelector('.mu-lpg .mu-r .mu-mo').click()`); await W(400);
  await E(`document.querySelector('.sheet.mnu [data-x=a]').click()`); await W(400); await E(`[...document.querySelectorAll('.sheet.mnu .mi')].find(b => b.textContent.includes('雨天听')).click()`); await W(400);
  ok(await E(`core.S.music.lists[0].songs.length`) == 1, '歌曲菜单 → 收藏到歌单');
  await E(`core.back()`); await W(400);
  // 榜单
  await E(`document.querySelector('[data-a=mtab][data-x=srch]').click()`); await W(300); await E(`document.querySelector('[data-a=mclr]').click()`); await W(300);
  await E(`document.querySelector('.mu-top').click()`); await W(900);
  ok(await E(`document.querySelectorAll('.mu-lpg .mu-r').length`) == 5 && await E(`!!document.querySelector('.mu-lpg .mu-rk')`), '榜单：5 首，带排名');
  await E(`document.querySelector('.mu-lpg [data-a=mall]').click()`); await W(1500);
  ok(await E(`pl.cur().name.startsWith('榜单') && core.S.music.q.length == 5`), '播放全部：队列换成榜单');
  await E(`core.back()`); await W(300);
  // 正文点歌 → 推荐
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: '他把耳机分了一只给你。\\n<手机>\\n点歌|灰吕杵志|《晴天》|周杰伦\\n</手机>', is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(800);
  ok(await E(`core.D().mus.recs[0].name == '晴天' && core.D().mus.recs[0].by == '灰吕杵志'`), '正文 <手机> 块里「点歌|谁|歌名|歌手」：进 TA 点的歌');
  ok(await E(`!SillyTavern.getContext().chat.at(-1).mes.includes('点歌')`), '点歌那行不显示在正文里');
  await E(`document.querySelector('[data-a=mtab][data-x=home]').click()`); await W(200); await E(`document.querySelector('[data-a=mhome][data-x=rec]').click()`); await W(300);
  ok(/今日为你推荐[\s\S]*TA 点的歌[\s\S]*晴天[\s\S]*灰吕杵志 点的/.test(await E(`document.querySelector('.musicapp').textContent`)), '推荐页：今日为你推荐 + TA 点的歌');
  // 按剧情推荐（模拟一次 API）
  await E(`core.S.api.chat.src = 'tavern'; SillyTavern.getContext().generateRaw = async () => '{"blurb":"忙完一天，用音乐慢下来","songs":[{"name":"夜曲","artist":"周杰伦"},{"name":"Trip","artist":"Ella Mai"}]}'`);
  await E(`document.querySelector('[data-a=mai]').click()`); await W(1500);
  ok(await E(`core.D().mus.ai?.songs?.length == 2 && document.querySelector('.mu-today p').textContent.includes('忙完一天')`), '按剧情推荐：AI 推了 2 首，推荐语显示在卡片里 ' + await E(`JSON.stringify(core.D().mus.ai)`));
  await shot('music_rec.png');
  // 灵动岛
  await E(`core.home()`); await W(400);
  ok(await E(`document.querySelector('.isl').classList.contains('mu') && getComputedStyle(document.querySelector('.isl')).display != 'none'`), '回到桌面：状态栏显示正在放歌的小胶囊');
  await E(`document.querySelector('.isl').click()`); await W(500);
  ok(await E(`!!document.querySelector('.mu-home-heart .mu-vinyl')`), '点小胶囊：打开心动页');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
