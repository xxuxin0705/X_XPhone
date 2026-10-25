// 聊天信息：专属音色（服务商 / 朗读语言 / 各服务商音色 / 名字读音）、翻译（私聊 / 群聊跟随或统一）、回复设置（条数 / 语音条数）、拍一拍格式、语音设置的渠道模式
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8789);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const wav = () => { const n = 2400, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
const tq = [], prompts = []; let reply = '好的';
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  await ctx.route(/api\.fish\.audio|minimaxi\.com/, r => { tq.push({ u: r.request().url(), b: JSON.parse(r.request().postData() || '{}') });
    if (/minimaxi/.test(r.request().url())) return r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { audio: '49443303' }, base_resp: { status_code: 0 } }) });
    r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: wav() }); });
  await ctx.route(/relay\.test/, r => { prompts.push(JSON.parse(r.request().postData()).messages[1].content); r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: reply.split('\n').map(l => `data: ${JSON.stringify({ choices: [{ delta: { content: l + '\n' } }] })}\n\n`).join('') + 'data: [DONE]\n\n' }); });
  await ctx.route(/\/api\/translate\/google/, r => r.fulfill({ status: 200, body: '翻好了' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8789/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), T = s => E(`document.querySelector('${s}')?.textContent || ''`);
  await E(`(async () => { window.Audio = class { play() { return Promise.resolve(); } pause() {} }; window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js');
    core.S.api.chat = { src: 'custom', cur: 'a', list: [{ id: 'a', name: 'x', url: 'https://relay.test/v1', key: 'k', model: 'm' }] };
    core.S.api.tts = { src: 'custom', pv: 'mm', cfg: { mm: { key: 'mmk', model: 'speech-2.6-hd', voice: '', vf: 'female-tianmei' }, fish: { key: 'fk', model: 's1' } } };
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: 'satoru', sex: '男', fr: 1, voice: 'old-voice-id' })); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  await E(`document.querySelector('.chat [data-a=cset]').click()`); await W(500);
  const cm = sel => E(`(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('${sel}').dispatchEvent(e); return e.defaultPrevented; })()`);
  ok(!(await cm('[data-k=nick]')) && await cm('[data-sec=info] img, img'), '输入框里长按照常弹复制 / 粘贴菜单；图片长按不弹保存');
  // 1. 专属音色
  ok(/正在使用 MiniMax国内/.test(await T('.vbox')) && /音色：old-voice-id/.test(await T('.vbox')), '专属音色：显示正在用的服务商；旧版填的音色算在当前服务商下');
  ok(await E(`document.querySelectorAll('.vrow input').length`) == 9 && /使用中/.test(await T('.vrow')), '每个服务商一栏音色 ID（含 ElevenLabs），正在用的标「使用中」');
  ok(!(await E(`!!document.querySelector('[data-k="tv.pv"]')`)) && !(await E(`!!document.querySelector('[data-sec=voice] .tip')`)), '统一渠道模式：不显示服务商选择，也没有说明文字');
  ok(await E(`document.querySelector('[data-sec=info] [data-k=sex]')?.value`) == '男' && !(await E(`!!document.querySelector('[data-sec=voice] [data-k=sex]')`)), '性别在基本信息里');
  ok(!(await E(`!!document.querySelector('.pg.in:last-child .pg-b .tip')`)) && !/比如|开启后|关闭后|每轮角色/.test(await T('.pg.in:last-child .pg-b')), '聊天信息里没有解释说明的文字');
  ok(!(await E(`!!document.querySelector('[data-k="cfg.auto"]')`)), '没有「发完消息自动回复」');
  await p.fill('[data-k="tv.v.fish"]', 'fishvoice1'); await p.press('[data-k="tv.v.fish"]', 'Tab'); await p.fill('[data-k="tv.v.mm"]', 'male-qn-jingying'); await p.press('[data-k="tv.v.mm"]', 'Tab'); await W(300);
  await E(`document.querySelector('[data-k="tv.lang"]').value = 'Japanese'; document.querySelector('[data-k="tv.lang"]').dispatchEvent(new Event('change', { bubbles: true }))`); await W(200);
  await E(`document.querySelector('[data-sec=voice] [data-a=sayadd]').click()`); await W(300);
  await p.fill('.sheet.in [data-k=w]', '悟'); await p.press('.sheet.in [data-k=w]', 'Tab'); await p.fill('.sheet.in [data-k=r]', 'さとる'); await p.press('.sheet.in [data-k=r]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(300);
  ok(/适配读音[\s\S]*悟 → さとる/.test(await T('[data-sec=voice]')) && !/名字读音|别名/.test(await T('[data-sec=voice]')), '适配读音：加了「悟 → さとる」');
  tq.length = 0; await E(`core.tts('我是悟', '', '男', undefined, { c: _c })`); await W(300);
  let q = tq.at(-1); ok(q && /minimaxi/.test(q.u) && q.b.voice_setting.voice_id == 'male-qn-jingying' && q.b.language_boost == 'Japanese' && q.b.text == '我是さとる', 'MiniMax：用这个人的音色、朗读语言日语、名字换成读音 ' + JSON.stringify(q?.b).slice(0, 160));
  await p.screenshot({ path: path.join(OUT, 'cset_a.png') });
  // 每个人用自己的渠道
  await E(`core.S.api.tts.mode = 'per'; core.top().re()`); await W(300);
  ok(await E(`!!document.querySelector('[data-k="tv.pv"]')`), '每个人用自己的渠道：能选这个人的服务商');
  await E(`document.querySelector('[data-k="tv.pv"]').value = 'fish'; document.querySelector('[data-k="tv.pv"]').dispatchEvent(new Event('change', { bubbles: true }))`); await W(500);
  ok(/正在使用 Fish Audio/.test(await T('.vbox')) && /fishvoice1/.test(await T('.vbox')), '选了 Fish：显示正在用 Fish、音色 fishvoice1');
  tq.length = 0; await E(`core.tts('你好', '', '男', undefined, { c: _c })`); await W(300); q = tq.at(-1);
  ok(q && /compat\/v1\/audio\/speech/.test(q.u) && q.b.voice == 'fishvoice1' && q.b.model == 'fish-audio/s1', '这个人走自己的 Fish（全局还是 MiniMax）');
  await E(`core.S.api.tts.mode = 'unified'`);
  // 2. 翻译（私聊）
  const trT = await T('[data-sec=tr]');
  ok(/自动翻译[\s\S]*自动展开翻译[\s\S]*角色消息翻译为[\s\S]*自动翻译我发出的消息/.test(trT), '翻译：自动翻译 / 自动展开翻译 / 角色消息翻译为 / 自动翻译我发出的消息');
  await E(`document.querySelector('[data-k="cfg.trMine"]').click()`); await W(400);
  ok(await E(`!!document.querySelector('[data-k="cfg.trTo"]')`), '打开「自动翻译我发出的消息」后出现「我的消息翻译为」');
  // 3. 回复设置
  ok(/回复条数[\s\S]*最少[\s\S]*最多[\s\S]*语音条数/.test(await T('[data-sec=reply]')), '回复设置：回复条数、语音条数（最少 / 最多）');
  for (const [k, v] of [['rmin', 2], ['rmax', 6], ['vmin', 0], ['vmax', 1]]) { await p.fill(`[data-k="cfg.${k}"]`, String(v)); await p.press(`[data-k="cfg.${k}"]`, 'Tab'); }
  await W(200); await p.screenshot({ path: path.join(OUT, 'cset_b.png') });
  await E(`core.back()`); await W(400);
  await E(`(_c.cfg.lang = 'ja', _c.cfg.trAuto = true, 0)`);
  await E(`talk.gen(_c)`); await W(1500);
  ok(/这一轮一共 2-6 条[\s\S]*其中语音 0-1 条/.test(prompts.at(-1)), '提示词里写了回复 2-6 条、语音 0-1 条');
  ok(/五条悟用日语[\s\S]*每一条的同一行末尾都附 \[翻译/.test(prompts.at(-1)), '角色说日语，每条附中文译文');
  // 关掉自动翻译：不附翻译，点「文」再机翻
  await E(`_c.cfg.trAuto = false; _c.cfg.vmax = 0`); reply = 'さとる: こんにちは'; await E(`talk.gen(_c)`); await W(1500);
  ok(/不要附翻译/.test(prompts.at(-1)) && /不发语音/.test(prompts.at(-1)), '关了自动翻译：提示词不要求译文；语音最多 0 条 → 不发语音');
  ok(await E(`!!document.querySelector('.chat .msg:not(.me) [data-a=trq]')`), '外语消息后面有「文」，可以手动翻');
  await E(`document.querySelector('.chat .msg:not(.me) [data-a=trq]').click()`); await W(600);
  ok(await E(`_c.msgs.at(-1).tr`) == '翻好了' && !(await E(`[...document.querySelectorAll('.chat .msg:not(.me) .tzp')].at(-1).hidden`)), '点「文」：用免费机翻翻成中文并展开');
  // 4. 群聊翻译：跟随成员 / 统一
  await E(`(async () => { window._d = dt.add(dt.blank('p', { real: '金敏俊', fr: 1 })); _d.cfg.lang = 'ko'; window._g = dt.add(dt.blank('g', { name: '咒术群' })); _g.members = [_c.id, _d.id]; _c.cfg.trAuto = true; core.saveD(); talk.openChat(_g.id); })()`); await W(500);
  await E(`document.querySelector('.chat [data-a=cset]').click()`); await W(500);
  ok(/成员消息跟随各自私聊的翻译设置[\s\S]*satoru→日语、金敏俊→韩语/.test(await T('[data-sec=tr]')) && !(await E(`!!document.querySelector('[data-sec=tr] [data-k="cfg.lang"]')`)), '群聊：默认跟随成员各自的翻译设置（列出谁说什么语言）');
  ok(!(await E(`!!document.querySelector('[data-sec=voice]')`)), '群聊没有专属音色（在成员各自的私聊里设）');
  await E(`document.querySelector('[data-k="cfg.trFollow"]').click()`); await W(400);
  ok(await E(`!!document.querySelector('[data-sec=tr] [data-k="cfg.lang"]')`), '关掉跟随：出现「成员消息统一翻译为」');
  await E(`_g.cfg.lang = 'en'; core.back()`); await W(400); reply = '好的'; await E(`talk.gen(_g)`); await W(1500);
  ok(/五条悟用英语；金敏俊用英语/.test(prompts.at(-1)), '统一设置后：所有成员都用英语');
  await E(`_g.cfg.trFollow = true`); await E(`talk.gen(_g)`); await W(1500);
  ok(/五条悟用日语；金敏俊用韩语/.test(prompts.at(-1)), '跟随成员：各说各的语言');
  // 5. 拍一拍
  await E(`dt.addMsg(_c, { from: '五条悟', type: 'pat', text: '的肩膀' }); dt.addMsg(_c, { from: '五条悟', type: 'pat', text: '揉了揉你的头发' })`);
  ok(await E(`_c.msgs.filter(m => m.t == 'pat').map(m => m.c).join('|')`) == '“satoru” 拍了拍你|“satoru” 拍了拍你', '拍一拍后缀没设置：就是「“X” 拍了拍你」，模型写的「的肩膀」不用');
  await E(`core.D().me.ps = '的小脑袋'; dt.addMsg(_c, { from: '五条悟', type: 'pat', text: '' })`);
  ok(await E(`_c.msgs.at(-1).c`) == '“satoru” 拍了拍你的小脑袋', '设置了后缀：「“X” 拍了拍你的小脑袋」');
  await E(`core.D().me.ps = ''; _c.msgs.push({ f: _c.id, t: 'pat', c: '“五条悟” 拍了拍我的肩膀', ts: Date.now() }, { f: 'me', t: 'pat', c: '我拍了拍 “五条悟”', ts: Date.now() }); talk.openChat(_c.id)`); await W(500);
  ok(/“五条悟” 拍了拍你$/.test((await E(`[...document.querySelectorAll('.chat .sys.pat')].map(e => e.textContent)`)).at(-2)) && (await E(`[...document.querySelectorAll('.chat .sys.pat')].map(e => e.textContent)`)).at(-1) == '你拍了拍 “五条悟”', '以前存的「拍了拍我的肩膀」「我拍了拍」显示成「拍了拍你」「你拍了拍」');
  // 6. 设置 → 语音：渠道模式
  await E(`core.home(); core.APPS.settings.open()`); await W(400); await E(`document.querySelector('[data-a=api][data-x=tts]').click()`); await W(500);
  ok(/统一用一个渠道[\s\S]*每个人用自己的渠道/.test(await T('.pg.in:last-child .pg-b')) && /ElevenLabs/.test(await E(`[...document.querySelectorAll('select[data-k=pv] option')].map(o => o.textContent).join()`)), '设置 → 语音：可以选「统一用一个渠道 / 每个人用自己的渠道」，服务商里有 ElevenLabs');
  const pb = () => T('.pg.in:last-child .pg-b');
  ok(!(await E(`!!document.querySelector('.pg.in:last-child .pg-b .tip')`)), '语音页没有大段说明文字');
  ok(await E(`document.querySelector('[data-k="cfg.mm.url"]')?.value`) == 'https://api.minimaxi.com' && !(await E(`document.querySelector('[data-k="cfg.mm.url"]').readOnly`)), '接口地址默认显示官方地址，可以改');
  await p.fill('[data-k="cfg.mm.url"]', 'https://mm.my.test'); await p.press('[data-k="cfg.mm.url"]', 'Tab'); await W(200);
  ok(await E(`core.tq(core.prof('tts')).url`) == 'https://mm.my.test', '改了就用改的地址'); await p.fill('[data-k="cfg.mm.url"]', ''); await p.press('[data-k="cfg.mm.url"]', 'Tab'); await W(200);
  ok(await E(`!!document.querySelector('[data-a=try][data-x=vm]') && !document.querySelector('[data-a=pv][data-x=vm]')`), '男声 / 女声默认后面是「试听」，不是拉取');
  ok(/全局默认音色[\s\S]*没配音色的联系人用全局默认音色[\s\S]*男声默认[\s\S]*女声默认/.test(await pb()), '全局默认音色：开关 + 男声 / 女声默认');
  await E(`document.querySelector('[data-k=fb]').click()`); await W(400);
  ok((await E(`core.S.api.tts.fb`)) === false && !/男声默认/.test(await pb()), '关掉：不再显示男 / 女默认音色');
  await E(`document.querySelector('[data-k=fb]').click()`); await W(300);
  await p.selectOption('select[data-k=pv]', 'third'); await W(400);
  ok(await E(`!!document.querySelector('[data-k="cfg.third.fmt"]') && !!document.querySelector('[data-k="cfg.third.url"]:not([readonly])')`), '第三方：可以选接口格式、自己填接口地址');
  await E(`core.S.api.tts.cfg.third.fmt = 'eleven'; core.top().re()`); await W(300);
  ok(await E(`!!document.querySelector('[data-a=qv][data-x=voice]') && !!document.querySelector('[data-a=pv][data-x=voice]')`), '第三方选 ElevenLabs 格式：也能快选 / 拉取音色');
  await p.screenshot({ path: path.join(OUT, 'cset_c.png') });
  await p.selectOption('select[data-k=pv]', 'mm'); await W(400); await p.screenshot({ path: path.join(OUT, 'cset_d.png'), fullPage: true });
  // 7. 语音：没有「酒馆扩展」了，上面是「语音渠道 / 角色库」
  ok(await E(`[...document.querySelector('.pg.in:last-child .pg-b .seg').children].map(b => b.textContent).join()`) == '语音渠道,角色库', '语音页顶上：语音渠道 / 角色库（没有酒馆扩展）');
  await E(`document.querySelector('.pg.in:last-child .seg [data-x=lib]').click()`); await W(400);
  const lib = await E(`[...document.querySelectorAll('.vl')].map(r => r.textContent)`);
  ok(lib.length >= 3 && /^我（/.test(lib[0]) && lib.some(x => /satoru[\s\S]*MiniMax国内 · male-qn-jingying[\s\S]*Fish Audio：fishvoice1/.test(x)), '角色库：我 + 所有联系人，显示用的渠道和音色 ' + JSON.stringify(lib).slice(0, 220));
  await p.screenshot({ path: path.join(OUT, 'cset_lib.png') });
  // 在角色库里改五条悟的音色 → 聊天信息里也变了
  await E(`[...document.querySelectorAll('.vl')].find(r => /satoru/.test(r.textContent)).click()`); await W(500);
  ok(/satoru的音色/.test(await T('.pg.in:last-child .pg-t')) && await E(`document.querySelector('.pg.in:last-child [data-k="tv.v.mm"]').value`) == 'male-qn-jingying', '点进去：就是这个人的音色设置（跟聊天信息里一样）');
  await E(`document.querySelector('.pg.in:last-child [data-a=vsave][data-x=mm]').click()`); await W(300); await p.fill('.sheet.in [data-k=n]', '精英'); await p.press('.sheet.in [data-k=n]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(400);
  ok(await E(`JSON.stringify(_c.tv.lib.mm)`) == '[{"id":"male-qn-jingying","n":"精英"}]' && /精英/.test(await T('.pg.in:last-child .vlib')), '保存：MiniMax 下存了「精英」');
  await p.fill('.pg.in:last-child [data-k="tv.v.mm"]', 'male-qn-badao'); await p.press('.pg.in:last-child [data-k="tv.v.mm"]', 'Tab'); await W(400);
  await E(`document.querySelector('.pg.in:last-child [data-a=vsave][data-x=mm]').click()`); await W(300); await p.fill('.sheet.in [data-k=n]', '霸道'); await p.press('.sheet.in [data-k=n]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(400);
  ok(await E(`_c.tv.v.mm`) == 'male-qn-badao' && await E(`document.querySelector('.pg.in:last-child .vchip.on')?.textContent`) == '霸道×', '换了新音色、也存下来（正在用的高亮）');
  await E(`document.querySelector('.pg.in:last-child [data-a=vuse][data-x="mm:0"]').click()`); await W(400);
  ok(await E(`_c.tv.v.mm`) == 'male-qn-jingying', '切换：点「精英」就换回去');
  await E(`document.querySelector('.pg.in:last-child [data-a=vdel][data-x="mm:1"]').click()`); await W(300); await E(`document.querySelector('.sheet.mnu .mi.danger')?.click()`); await W(400);
  ok(await E(`_c.tv.lib.mm.length`) == 1, '删除：保存的「霸道」删掉了');
  await p.screenshot({ path: path.join(OUT, 'cset_libp.png') });
  await E(`core.home(); talk.openChat(_c.id)`); await W(500); await E(`document.querySelector('.chat [data-a=cset]').click()`); await W(500);
  ok(await E(`document.querySelector('[data-k="tv.v.mm"]').value`) == 'male-qn-jingying' && /精英/.test(await T('[data-sec=voice] .vlib')), '聊天信息的专属音色：跟角色库里改的一样');
  await p.fill('[data-k="tv.v.fish"]', 'fishvoice2'); await p.press('[data-k="tv.v.fish"]', 'Tab'); await W(300);
  await E(`core.home(); core.APPS.settings.open()`); await W(400); await E(`document.querySelector('[data-a=api][data-x=tts]').click()`); await W(500);
  ok(/Fish Audio：fishvoice2/.test(await E(`[...document.querySelectorAll('.vl')].map(r => r.textContent).join()`)), '聊天信息里改了，角色库也跟着变');
  // 我的音色
  await E(`document.querySelector('.vl[data-x=me]').click()`); await W(400); await p.fill('.pg.in:last-child [data-k="tv.v.mm"]', 'female-yujie'); await p.press('.pg.in:last-child [data-k="tv.v.mm"]', 'Tab'); await W(300);
  ok(await E(`JSON.stringify(Object.values(core.S.api.tts.users)[0].tv.v)`) == '{"mm":"female-yujie"}', '我的音色：存在设置里（按当前 User）');
  tq.length = 0; await E(`(async () => { const v = await import('/apps/chat/voice.js'); await core.tts('我发的语音', '', '', undefined, { c: v.meVoice() }); })()`); await W(300);
  ok(tq.at(-1)?.b?.voice_setting?.voice_id == 'female-yujie', '我发的语音用我的音色');
  // 锁屏：底下没有粉色横条；指纹模式不提备用密码
  await E(`(async () => { const lk = await import('/lock.js'); core.S.lock.on = true; core.S.lock.pw = true; core.S.lock.type = 'fp'; core.S.lock.fpSet = true; lk.lock(); })()`); await W(600);
  ok(await E(`getComputedStyle(document.querySelector('#stp .hb')).display`) == 'none', '锁屏底下没有横条');
  ok(!/备用密码/.test(await T('.lock .lk-hint')), '指纹解锁：不提备用密码');
  await E(`(async () => { const lk = await import('/lock.js'); core.S.lock.pw = false; lk.unlock(); })()`); await W(400);
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
