// 音乐 App（phonetest 那版搬过来）：首页 / 搜索 / 笔记 / 我的、播放页、歌词摘录、歌单、榜单、导入、心动模式、
// 分享到聊天、一起听（卡片 + 顶栏音柱 + 给 AI 的一起听状态）、角色邀请一起听、正文音乐卡、音源地址可改、旧数据迁移、没有网易云登录
// 接口全部模拟，不连外网
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
  const vkeys = host => r => { const u = new URL(r.request().url()); hits.push(host + ' ' + u.search); if (u.searchParams.get('id')) return J(r, { data: { url: 'https://audio.test/v' + u.searchParams.get('id') + '.mp3' } });
    const w = u.searchParams.get('word') || '', pg = +u.searchParams.get('page'); return J(r, { data: w == '没有' ? [] : songs(20).map(s => ({ ...s, id: s.id + (pg > 1 ? '9' : '') + (w.length % 7), song: (w.split(' ')[0]) + '·' + s.song + (pg > 1 ? 'b' : '') })) }); };
  await p.route('https://api.vkeys.cn/**', vkeys('vkeys')); await p.route('https://src.test/**', vkeys('mysrc'));
  await p.route('https://api.qijieya.cn/**', r => { const u = new URL(r.request().url()), t = u.searchParams.get('type'), id = u.searchParams.get('id'); hits.push('meting ' + t + ' ' + id);
    if (t == 'song') return J(r, [{ url: 'https://audio.test/m' + id + '.mp3', pic: 'https://img.test/p.webp' }]);
    if (t == 'lrc') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '[00:00.00]第一句歌词\n[00:02.00]第二句歌词\n[00:04.00]第三句歌词' });
    if (t == 'tlrc') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '[00:00.00]first line' });
    if (t == 'playlist') return J(r, songs(5).map(s => ({ name: '榜单' + s.song, artist: s.singer, url: `https://x/?id=${s.id}`, pic: s.cover }))); return J(r, []); });
  await p.route('https://audio.test/**', r => r.fulfill({ status: 200, headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' }, body: MP3 }));
  await p.route('https://music.163.com/**', r => r.fulfill({ status: 404, body: '' }));
  await p.route('https://drive.baibai.cv/**', r => r.fulfill({ status: 404, body: '' }));
  await p.route('https://img.test/**', r => r.fulfill({ status: 200, headers: { 'content-type': 'image/webp' }, body: PIC }));
  await p.goto('http://localhost:8812/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, n) });
  const act = (a, extra = '') => E(`document.querySelector('.phone-view-current [data-act="${a}"]${extra}, .mz-overlay [data-act="${a}"]${extra}').click()`);
  const txt = () => E(`document.querySelector('.mz-screen').innerText`);
  await E(`(async () => { window.core = await import('/core.js'); window.mz = await import('/apps/music/music.js'); window.dt = await import('/apps/chat/data.js'); window.tk = await import('/apps/chat/talk.js');
    core.S.lock.on = false; window.ep = []; SillyTavern.getContext().setExtensionPrompt = (k, v) => ep.push(v); window.D = () => mz.musicApp.musicData;
    window._a = dt.add(dt.blank('p', { real: '灰吕杵志', fr: 1 })); window._g = dt.add(dt.blank('g', { name: '乐队群' })); _g.members = [_a.id]; core.saveD(); })()`); await W(300);

  // 旧版音乐 App 的数据搬过来
  await E(`core.S.music = { liked: [{ id: '7', name: '旧喜欢', artist: '旧歌手', pic: '' }], hist: [{ id: '8', name: '旧最近', artist: '旧歌手' }], sh: ['旧搜索'], lists: [{ id: 'L1', n: '旧歌单', songs: [{ id: '9', name: '旧歌', artist: 'A' }] }], notes: [{ id: 'n1', song: { id: '7', name: '旧喜欢', artist: '旧歌手' }, lines: ['一句'], text: '想法', ts: 1 }] }; delete core.S.mz; mz.migrate(); D()._cache = {};`);
  ok(await E(`D().getLiked()[0]?.name == '旧喜欢' && D().getHistory()[0]?.name == '旧最近' && D().getUserPlaylists()[0]?.name == '旧歌单' && D().getNotes()[0]?.song?.name == '旧喜欢' && D().getSearchHistory()[0] == '旧搜索'`), '旧版的喜欢 / 最近 / 歌单 / 笔记 / 搜索历史都搬过来了');
  await E(`D().toggleLike(D().getLiked()[0])`);

  ok(await E(`!!core.APPS.music && [...core.S.desk.pages.flat(), ...core.S.desk.dock].some(x => x.app == 'music')`), '桌面上有「音乐」');
  await E(`core.openApp('music')`); await W(700);
  ok(await E(`[...document.querySelectorAll('.mz-tabbar-btn')].map(b => b.textContent.trim()).join() == '首页,搜索,笔记,我的' && !!document.querySelector('.phone-view-current .mz-hero')`), '打开：四个页签，默认「我的」');
  ok(!/登录|网易云账号|Cookie|二维码/.test(await txt()), '没有网易云登录');
  await shot('music_mine.png');

  // 搜索 → 播放
  await E(`document.querySelector('.mz-tabbar-btn[data-tab=search]').click()`); await W(300);
  ok(/试试这些[\s\S]*日语[\s\S]*周杰伦/.test(await txt()), '搜索页：搜索历史 + 试试这些');
  await p.fill('.mz-search-input', '晴天'); await p.press('.mz-search-input', 'Enter'); await W(800);
  ok(await E(`document.querySelectorAll('.phone-view-current .mz-song-list [data-act=song]').length`) == 20, '搜索出 20 首');
  await act('load-more'); await W(800);
  ok(await E(`document.querySelectorAll('.phone-view-current .mz-song-list [data-act=song]').length`) == 40, '加载更多：再 20 首');
  await shot('music_search.png');
  await E(`document.querySelector('.phone-view-current .mz-song-list [data-act=song]').click()`); await W(1800);
  ok(await E(`D().isPlaying && D().getCurrentSong()?.name == '晴天·测试歌1'`), '点一首就开始放');
  ok(/晴天·测试歌1/.test(await E(`document.querySelector('.mz-mini').textContent`)), '迷你播放条显示正在放的歌');
  ok(await E(`!!document.querySelector('.isl.mu img')`), '灵动岛显示封面');

  // 播放页
  await act('open-player'); await W(900);
  ok(await E(`!!document.querySelector('.phone-view-current.phone-view-layer .mz-player, .phone-view-current .mz-vinyl')`), '打开播放页：黑胶唱片');
  await W(1500); ok(await E(`D().currentLyrics.length == 3 && D().currentLyrics[0].tr == 'first line'`), '歌词和翻译拿到了');
  await act('p-like'); await W(300); ok(await E(`D().isLiked(D().getCurrentSong())`), '播放页点红心：喜欢');
  await shot('music_player.png');
  // 摘录歌词 → 笔记
  await act('p-excerpt'); await W(800);
  await E(`document.querySelector('.mz-overlay [data-ex-line]:not(.on)').click(); window._exPick = document.querySelector('.mz-overlay [data-ex-line].on span').firstChild.textContent`); await E(`document.querySelector('.mz-overlay [data-ex-note]').value = '这句好听'`);
  await E(`document.querySelector('.mz-overlay [data-ex=save]').click()`); await W(500);
  ok(await E(`D().getNotes().some(n => n.note == '这句好听' && n.lines.some(l => l.txt == _exPick))`), '摘录歌词：存进笔记');
  // 返回：小手机的返回键 / 右滑先退回首页那层，不直接关 App
  await E(`core.back()`); await W(400);
  ok(await E(`core.top()?.cls == 'mzhost' && !!document.querySelector('.phone-view-current .mz-tab-body')`), '返回：从播放页退回 App 首层（App 没关）');
  await E(`document.querySelector('.mz-tabbar-btn[data-tab=notes]').click()`); await W(300);
  ok(/这句好听/.test(await txt()), '笔记页能看到刚摘录的');

  // 榜单 / 导入歌单 / 新建歌单 / 收藏到歌单
  await E(`document.querySelector('.mz-tabbar-btn[data-tab=home]').click()`); await W(300);
  await E(`document.querySelector('.phone-view-current .mz-toplist').click()`); await W(900);
  ok(await E(`document.querySelectorAll('.phone-view-current [data-act=song]').length`) == 5, '榜单：5 首');
  await shot('music_top.png');
  await act('back'); await W(300);
  await E(`document.querySelector('.mz-tabbar-btn[data-tab=mine]').click()`); await W(300);
  await act('import-pl'); await W(300); await E(`document.querySelector('.mz-overlay [data-ask]').value = 'https://music.163.com/playlist?id=123456'; document.querySelector('.mz-overlay [data-ask-ok]').click()`); await W(900);
  await E(`document.querySelector('.mz-overlay [data-ask]') && (document.querySelector('.mz-overlay [data-ask]').value = '导入的', document.querySelector('.mz-overlay [data-ask-ok]').click())`); await W(400);
  ok(await E(`D().isCollected('123456')`), '粘贴歌单链接导入（不用登录）');
  await act('create-pl'); await W(300); await E(`document.querySelector('.mz-overlay [data-ask]').value = '雨天'; document.querySelector('.mz-overlay [data-ask-ok]').click()`); await W(400);
  ok(await E(`D().getUserPlaylists().some(p => p.name == '雨天')`), '新建歌单');

  // 心动模式（仿网易云）：点了马上打开播放页、唱片上「正在打开心动模式...」，先放喜欢的；相似歌后台找到再接到后面；没有喜欢的歌就提示为空
  hits.length = 0; await act('heart-mode'); await W(300);
  ok(await E(`!!document.querySelector('.phone-view-current .mz-player .mz-heart-ov') && D().queue.length >= D().getLiked().length && D().getLiked().some(l => D().sameSong(l, D().getCurrentSong()))`), '心动模式：马上打开播放页、唱片上显示「正在打开心动模式...」，先放喜欢的歌');
  await W(2500);
  ok(await E(`D().queue.length > D().getLiked().length`) && hits.some(h => /word=%E6%AD%8C%E6%89%8B/.test(h)), '心动模式：按常听歌手找的相似歌随后接到队列后面');
  await act('back'); await W(500);
  const q0 = await E(`D().queue.length`); await E(`D().getLiked().slice().forEach(s => D().toggleLike(s))`); await act('heart-mode'); await W(400);
  ok(await E(`document.querySelector('.mz-pill-toast')?.textContent`) == '我喜欢的歌曲为空' && await E(`D().queue.length`) == q0, '心动模式：没有喜欢的歌就提示「我喜欢的歌曲为空」');
  ok(!(await E(`!!document.querySelector('.mz-status-pill')`)), '我的页面上没有「状态」');

  // 分享到聊天
  await act('open-player'); await W(800); await act('p-share'); await W(600);
  await E(`document.querySelector('.mz-overlay .mz-share-row').click()`); await W(200);
  await E(`(document.querySelector('.mz-overlay [data-sgo]') || document.querySelector('.mz-overlay .mz-btn.primary')).click()`); await W(500);
  ok(await E(`_a.msgs.some(m => m.t == 'song' && m.song.name == D().getCurrentSong().name)`), '分享给好友：聊天里多了一张音乐卡片');
  // 一起听：发卡片
  await act('p-listen'); await W(800); await act('l-invite'); await W(600);
  await E(`document.querySelector('.mz-overlay [data-lmode=share]').click()`); await W(150); await E(`document.querySelector('.mz-overlay [data-lidx]').click()`); await E(`document.querySelector('.mz-overlay [data-lgo]').click()`); await W(800);
  ok(await E(`_a.msgs.some(m => m.t == 'listen') && !!core.D().mzListen?.[_a.id]?.active`), '一起听：发出卡片，会话开始');
  await shot('music_listen.png');
  // 让对方回复：提示词里有【一起听歌】
  await E(`core.S.api.chat.src = 'tavern'; window.prompts = []; SillyTavern.getContext().generateRaw = async (...a) => { prompts.push(JSON.stringify(a)); return '这首我也喜欢\\n[音乐:晴天|周杰伦]'; }`);
  await E(`tk.gen(_a)`); await W(1800);
  ok(await E(`prompts.some(x => x.includes('【一起听歌】') && x.includes('[音乐:歌名|歌手]'))`), '对方回复时知道你们在一起听，也知道可以邀请一起听');
  ok(await E(`_a.msgs.some(m => m.t == 'minv' && m.song.name == '晴天' && m.st == 'pending')`), '对方回复 [音乐:晴天|周杰伦]：一张邀请卡片');
  await E(`core.home(); tk.openChat(_a.id)`); await W(800);
  ok(await E(`!!document.querySelector('.pg.chat .pg-t .mzl') && !!document.querySelector('.mzs') && !!document.querySelector('.mzc.on') && !!document.querySelector('.mzc.inv')`), '聊天里：分享卡片、正在共听卡片、邀请卡片，顶栏有音柱');
  await shot('music_chat.png');
  await E(`document.querySelector('.mzc.inv [data-a=mzacc]').click()`); await W(2000);
  ok(await E(`_a.msgs.find(m => m.t == 'minv').st == 'accepted' && /晴天/.test(D().getCurrentSong()?.name) && core.D().mzListen[_a.id].sourceMessageId == _a.msgs.find(m => m.t == 'minv').id`), '接受邀请：开始放这首，一起听接到这张卡片上');
  ok(await E(`_a.msgs.find(m => m.t == 'listen').st == 'ended'`), '接受新的一起听：之前那张卡片显示已结束');
  await E(`(async () => { const c = core; c.ok = async () => true; })()`);
  await E(`window.okBak = window.confirm; document.querySelector('.mzc.on [data-a=mzend]').click()`); await W(300);
  await E(`document.querySelector('.sheet.mnu [data-x=y]')?.click()`); await W(400);
  ok(await E(`!core.D().mzListen[_a.id].active && !document.querySelector('.pg.chat .pg-t .mzl')`), '取消听歌：结束一起听，顶栏音柱消失');

  // 正文音乐卡
  ok(await E(`ep.at(-1)?.includes('<音乐卡格式>')`), '提示词里带音乐卡格式（默认开）');
  const MSG = '他把耳机分了一只给你。\n<音乐卡>\n角色|灰吕杵志|@huilv\n时间|10月27日|23:40\n没说出口|其实这首是专门放给你听的\n心声|希望这首歌别那么快结束。\n评论|阿桥|@qiao|又在装酷\n评论|小鹿|@deer|别看人家\n评论|老周|@zhou|直接表白吧\n推荐|《夜曲》|周杰伦\n推荐|稻香|周杰伦\n喜欢|旧唱片|下雨天|她笑的时候\n</音乐卡>';
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: ${JSON.stringify(MSG)}, is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(400);
  ok(await E(`SillyTavern.getContext().chat.at(-1).mes == '他把耳机分了一只给你。'`), '音乐卡从正文里去掉了');
  ok(await E(`D().getCardData()?.stats?.[0] == '其实这首是专门放给你听的' && D().getCardData().replies.length == 9 && D().getPlaylist().map(s => s.name).join() == '夜曲,稻香'`), '音乐卡：没说出口的话、三条评论、推荐两首（书名号去掉）');
  await E(`core.openApp('music')`); await W(700); await E(`document.querySelector('.mz-tabbar-btn[data-tab=home]').click()`); await W(400);
  ok(/灰吕杵志[\s\S]*专门放给你听[\s\S]*推荐的歌[\s\S]*夜曲/.test(await txt()), '首页：角色卡片 + TA 推荐的歌');
  await shot('music_home.png');

  // 设置：音源地址可改、音乐卡开关
  await E(`document.querySelector('.mz-tabbar-btn[data-tab=mine]').click()`); await W(300); await act('settings'); await W(600);
  ok(/音源[\s\S]*搜索[\s\S]*播放 \/ 歌词 \/ 歌单[\s\S]*备用音源脚本/.test(await txt()) && !/网易云账号/.test(await txt()), '设置：三个音源地址，没有网易云账号');
  await shot('music_settings.png');
  await E(`const i = document.querySelector('[data-src=vkeys]'); i.value = 'https://src.test/api'; i.dispatchEvent(new Event('change'))`); await W(200);
  hits.length = 0; await E(`D().api.searchSongs('雨')`); await W(300);
  ok(hits.some(h => h.startsWith('mysrc')) && !hits.some(h => h.startsWith('vkeys')), '改了搜索地址：之后的搜索走新地址');
  await act('toggle-card'); await W(200);
  ok(await E(`!mz.musicApp.cardEnabled() && !(ep.at(-1) || '').includes('<音乐卡格式>')`), '关掉音乐状态栏：提示词里不再带');
  await act('toggle-floating'); await W(300);
  ok(await E(`!!document.querySelector('#music-floating-root .mz-float')`), '全局悬浮播放器');
  await act('toggle-floating'); await W(200);

  // 关掉 App：歌照常放
  await E(`core.home()`); await W(400);
  ok(await E(`!core.top() && D().isPlaying`), '回桌面：音乐不停');
  // 真机的开机顺序：设置里已经有旧数据和播放队列，刷新后应该自己迁移、自己恢复（不靠手动调用）
  const p2 = await b.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.addInitScript(() => { window.__preset = { st_phone: { music: { liked: [{ id: '7', name: '开机前的喜欢', artist: 'A' }] }, mz: { global_music_queue: JSON.stringify({ songs: [{ id: '1', name: '上次的队列', artist: 'B' }], index: 0 }), global_music_volume: '0.3' } } }; });
  await p2.goto('http://localhost:8812/'); await p2.waitForFunction('window.booted');
  ok(await p2.evaluate(`(async () => { const d = (await import('/apps/music/music.js')).musicApp.musicData; return d.getLiked()[0]?.name == '开机前的喜欢' && d.queue[0]?.name == '上次的队列' && Math.abs(d.audioPlayer.volume - .3) < .01; })()`), '刷新后：旧数据自动迁移，播放队列和音量恢复');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
