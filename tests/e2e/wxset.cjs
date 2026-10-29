// 微信样式：聊天设置美化只有日间 / 夜间 + 背景、每条都带头像；基本信息整段显示不截断；「我 → 个人信息」能改微信号，有性别 / 地区 / 签名
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8821);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const wav = () => { const n = 2400, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
let ttsN = 0;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  await ctx.route(/api\.fish\.audio/, r => { ttsN++; r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: wav() }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8821/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'wxset_' + n + '.png') });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.assets.sticker = [{ id: 's1', name: '被拿捏', img: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }]; core.APPS.chat.open();
    window._c = dt.add(dt.blank('p', { real: '坂田银时', nick: '草莓牛奶中毒中', remark: '天然卷白毛卷毛怪🍓', sign: 'JUMP周刊发售日别烦我', ps: '的钱包并发现只有一枚一円硬币和半张过期的优惠券', fr: 1 }));
    Object.assign(_c.cfg, { cont: true, showAv: false }); _c.msgs.push({ f: _c.id, t: 'text', c: 'a', ts: 1 }, { f: _c.id, t: 'text', c: 'b', ts: 2 }); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  ok(await E(`document.querySelectorAll('.chat .msg .avw').length == 2 && [...document.querySelectorAll('.chat .msg .avw')].every(a => getComputedStyle(a).visibility != 'hidden') && !document.querySelector('.chat.cont, .chat.noav')`), '微信样式：旧设置里开着合并 / 隐藏头像也不生效，每条都带头像');
  await E(`talk.cset(_c)`); await W(500);
  const look = await E(`document.querySelector('[data-sec=look]').textContent`);
  ok(/日间/.test(look) && /聊天背景/.test(look) && await E(`!!document.querySelector('[data-sec=look] .dn')`) && !/气泡|头像形状|头像框|风格|合并/.test(look), '美化只有日夜开关 + 聊天背景：' + look.replace(/\s+/g, ' '));
  await E(`document.querySelector('[data-sec=look]').scrollIntoView()`); await W(200); const sc0 = await E(`core.top().el.querySelector('.pg-b').scrollTop`);
  await E(`document.querySelector('[data-sec=look] .dn').click()`); await W(400); await shot('dn');
  ok(await E(`!!_c.cfg.dark && document.querySelector('[data-sec=look] .dn').classList.contains('on')`) && sc0 > 100 && Math.abs(await E(`core.top().el.querySelector('.pg-b').scrollTop`) - sc0) < 5, '点日夜开关切到夜间，页面不跳回顶部');
  // 专属音色：现在用的保存过、有名字 → 直接显示名字，下面不再重复；朗读语言只在用 MiniMax 时出现
  await E(`(() => { _c.tv = { v: { fish: 'ab6bdf381b884136b4c04025eebe3975' }, lib: { fish: [{ id: 'ab6bdf381b884136b4c04025eebe3975', n: '测试' }, { id: 'zzz', n: '备用' }] } }; core.S.api.tts.src = 'custom'; core.S.api.tts.pv = 'fish'; core.top().re(); })()`); await W(300);
  const vr = await E(`(() => { const r = [...document.querySelectorAll('.vrow')].find(x => /Fish/.test(x.querySelector('span').textContent)); return [r.querySelector('.vnm span')?.textContent, [...r.querySelectorAll('.vchip')].map(x => x.textContent).join(), /朗读语言|仅 MiniMax/.test(document.querySelector('[data-sec=voice]').textContent)]; })()`);
  ok(vr[0] == '测试' && vr[1] == '备用×' && !vr[2], 'Fish 那行直接显示「测试」，下面只剩「备用」；没有朗读语言 ' + JSON.stringify(vr));
  const ps = await E(`(() => { const t = document.querySelector('.ci textarea[data-k=ps]'); return t.scrollHeight <= t.clientHeight + 2 && t.clientHeight > 30; })()`);
  ok(ps, '拍一拍后缀很长：自动换行整段显示，没有截断');
  await shot('info');
  await E(`(() => { const t = document.querySelector('.ci textarea[data-k=wxid]'); t.value = 'gintoki_0110'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); })()`); await W(200);
  ok(await E(`_c.wxid`) == 'gintoki_0110', '联系人的微信号也能改');
  // 下半页全是输入框：在没点进去的输入框上右滑也能返回
  ok(/自己搜索[\s\S]*我喜欢的表情/.test(await E(`document.querySelector('[data-sec=stk]')?.textContent || ''`)), '聊天设置有「表情包」：自己搜索 / 我喜欢的表情 / 我添加的组');
  await E(`document.querySelector('[data-sec=stk] [data-x=fav]').click()`); await W(200);
  ok(await E(`JSON.stringify(_c.cfg.stkOff)`) == '["fav"]', '取消勾选「我喜欢的表情」');
  await E(`document.activeElement?.blur(); document.querySelector('.ci textarea[data-k=ps]').scrollIntoView({ block: 'center' })`); await W(200);
  const bx = await E(`(() => { const r = document.querySelector('.ci textarea[data-k=ps]').getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; })()`);
  await p.mouse.move(...bx); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(bx[0] + i * 28, bx[1]); await p.mouse.up(); await W(600);
  ok(await E(`!!core.top()?.chat`), '在拍一拍后缀（输入框）上右滑：返回到聊天');
  // 表情：外语写的表情标签也认成表情包，翻译里的中文当关键词；拆剩的空壳不发
  const pr = await E(`JSON.stringify(talk.parseReply('[絵文字: 金持ちになる] [翻译:[表情包:发财]]', _c).map(m => m.type + ':' + m.text))`);
  ok(pr == '["sticker:发财"]', '「[絵文字: …] [翻译:[表情包:发财]]」→ 一个表情包「发财」，没有半截文字 ' + pr);
  const sk = await E(`(async () => { const s = await import('/apps/chat/sticker.js'); return [await s.stkFind('完全不存在的东西qwxz'), !!(await s.stkFind('被拿捏', new Set(['fav']))), !!(await s.stkFind('被拿捏', new Set(['lib'])))]; })()`);
  ok(sk[0] === '' && sk[1] && !sk[2], '搜不到就不发；只勾「我喜欢的表情」时只在里面找 ' + JSON.stringify(sk));
  // 重新生成：对方这一轮收了我的转账 → 我那条变回没收的样子
  const ud = await E(`(() => { const t = { f: 'me', t: 'transfer', amt: 520, ts: 111, st: '已被接收', rt: 222 }, r = { f: _c.id, t: 'transfer', amt: 520, st: '已收款', rcpt: 1, t0: 111, ts: 222 }; _c.msgs.push(t, r); talk.undoRound(_c, _c.msgs.splice(_c.msgs.indexOf(r))); return [t.st || '', _c.msgs.includes(r)]; })()`);
  ok(ud[0] == '' && !ud[1], '重新生成：我的转账变回没被接收 ' + JSON.stringify(ud));
  // 语音：点一下播（声波动），再点停；第二次播用缓存，不再合成
  await E(`(() => { window.Audio = class { constructor(u) { this.u = u; this.duration = 3; setTimeout(() => this.onloadedmetadata?.(), 10); } play() { window.__pl = (window.__pl || 0) + 1; return Promise.resolve(); } pause() { window.__pz = (window.__pz || 0) + 1; } };
    core.S.api.tts = { src: 'custom', pv: 'fish', cfg: { fish: { key: 'fk', model: 's1' } } }; _c.tv = { v: { fish: 'vid' } }; _c.msgs.push({ f: _c.id, t: 'voice', c: '你好呀', ts: Date.now() }); core.saveD(); core.home(); talk.openChat(_c.id); })()`); await W(500);
  await E(`(() => { _c.msgs.push({ f: 'me', t: 'voice', c: '哈哈哈哈哈', ts: Date.now() }); core.emit('chat'); })()`); await W(300); await E(`[...document.querySelectorAll('.chat .vc')].at(-2).click()`); await W(800); await shot('voice');
  ok(await E(`[...document.querySelectorAll('.chat .vc')].at(-2).classList.contains('pl')`) && ttsN == 1 && /^idb:/.test(await E(`_c.msgs.at(-2).au || ''`)), '点语音：合成一次、缓存、声波在动');
  ok(await E(`[...document.querySelectorAll('.chat .vc')].at(-2).textContent`) == '3″', '播过之后显示真实秒数');
  await E(`[...document.querySelectorAll('.chat .vc')].at(-2).click()`); await W(300);
  ok(!(await E(`[...document.querySelectorAll('.chat .vc')].at(-2).classList.contains('pl')`)) && await E(`window.__pz >= 1`), '再点一下：停止');
  await E(`[...document.querySelectorAll('.chat .vc')].at(-2).click()`); await W(500);
  ok(ttsN == 1 && await E(`window.__pl`) == 2, '第三次点：直接播缓存，没有重新合成');
  await E(`talk.cset(_c)`); await W(400);
  ok(/合成语音[\s\S]*点播放时[\s\S]*收到就合成/.test(await E(`document.querySelector('[data-sec=reply]').textContent`)), '聊天设置：合成语音 点播放时 / 收到就合成');
  await E(`core.back()`); await W(400);
  // 标签（照微信录屏）：通讯录 → 标签 → 未设置标签的朋友 → 批量设置 → 勾两个 → 设置标签 → 新建标签「陌生人」→ 完成
  await E(`(() => { dt.add(dt.blank('p', { real: '艾莲', fr: 1 })); dt.add(dt.blank('p', { real: 'Amber', fr: 1 })); core.saveD(); core.home(); core.APPS.chat.open(); core.top().acts.tab('ct', null, null, core.top()); })()`); await W(400);
  ok(await E(`!!document.querySelector('.cw-e[data-a=tags] img')`), '通讯录有「标签」入口（图标是抠的）');
  await E(`document.querySelector('.cw-e[data-a=tags]').click()`); await W(500);
  ok(/未设置标签的朋友 \(\d+\)/.test(await E(`core.top().el.textContent`)) && /新建[\s\S]*编辑/.test(await E(`core.top().el.querySelector('.tg-f').textContent`)), '通讯录标签：未设置标签的朋友 (n)、底部 新建 / 编辑');
  await E(`document.querySelector('[data-a=tgun]').click()`); await W(400);
  await E(`document.querySelector('[data-a=tgbat]').click()`); await W(300);
  for (const n of ['艾莲', 'Amber']) { await E(`[...document.querySelectorAll('.tg-p')].find(x => x.textContent.includes('${n}')).click()`); await W(150); }
  ok(/设置标签 \(2\)/.test(await E(`document.querySelector('.tg-go').textContent`)) && await E(`document.querySelectorAll('.tg-c.on').length`) == 2, '批量设置：勾两个，底部「设置标签 (2)」');
  await shot('tag_sel');
  await E(`document.querySelector('.tg-go').click()`); await W(400);
  await E(`document.querySelector('[data-a=tgnw]').click()`); await W(400);
  await p.fill('.tgn input', '陌生人'); await W(100);
  ok(await E(`document.querySelector('.tgn-ok').classList.contains('on')`), '新建标签：填了名字「确定」变绿');
  await shot('tag_new');
  await E(`document.querySelector('.tgn-ok').click()`); await W(1000);
  ok(await E(`document.querySelector('.tg-ch.on')?.textContent`) == '陌生人' && await E(`document.querySelector('.tg-ok').classList.contains('on')`), '新标签排在最前面、已选中，「完成」变绿');
  await shot('tag_pick');
  await E(`document.querySelector('.tg-ok').click()`); await W(1100);
  ok(await E(`core.D().chats.filter(c => (c.tags || []).includes('陌生人')).map(c => c.real).sort().join()`) == 'Amber,艾莲', '保存后两个人都有「陌生人」标签');
  ok(/未设置标签的朋友/.test(await E(`core.top().el.textContent`)) && !/艾莲/.test(await E(`core.top().el.textContent`)), '回到「未设置标签的朋友」，她们不在里面了');
  // 聊天设置里的标签是选的
  await E(`(() => { const c = core.D().chats.find(c => c.real == '艾莲'); core.home(); talk.cset(c); })()`); await W(500);
  ok(/标签[\s\S]*陌生人/.test(await E(`document.querySelector('.ci[data-a=tgset]')?.textContent || ''`)) && !(await E(`!!document.querySelector('.ci textarea[data-k=grp]')`)), '聊天设置：标签显示「陌生人」，点了去选，不是填');
  ok(await E(`document.querySelectorAll('[data-sec=voice] .vrow').length`) <= 1, '专属音色只显示正在用的那家');
  await E(`core.home()`); await W(300);
  // 聊天设置：区间滑块、性别胶囊、清空 / 删除在最下面
  await E(`(() => { const c = core.D().chats.find(c => c.real == '艾莲'); core.home(); talk.cset(c); window._e = c; })()`); await W(500);
  ok(await E(`document.querySelectorAll('[data-sec=reply] .r2').length`) == 2 && !(await E(`!!document.querySelector('[data-sec=reply] input[type=number]')`)), '回复条数 / 语音条数是区间滑块，没有数字框');
  await E(`(() => { const y = document.querySelector('[data-r2=r] input[data-r2k=rmax]'); y.value = 8; y.dispatchEvent(new Event('input', { bubbles: true })); y.dispatchEvent(new Event('change', { bubbles: true })); })()`); await W(200);
  ok(await E(`_e.cfg.rmax`) == 8 && /1 – 8 条/.test(await E(`document.querySelector('[data-r2=r] .r2-h b').textContent`)), '拉右边圆钮到 8：回复 1 – 8 条');
  await E(`document.querySelector('.sexp [data-x="女"]').click()`); await W(500);
  ok(await E(`_e.sex`) == '女' && await E(`!!document.querySelector('.sexp .sx2.on')`), '性别胶囊点「女」');
  ok(await E(`!document.querySelector('[data-sec=dz]') && !!document.querySelector('.cs-dz [data-a=clr]') && !!document.querySelector('.cs-dz [data-a=rm]')`), '清空聊天记录 / 删除联系人在最下面，不在「更多」里');
  await E(`document.querySelector('[data-sec=reply]').scrollIntoView()`); await W(200); await shot('cset2'); await E(`document.querySelector('.sexp').scrollIntoView({ block: 'center' })`); await W(200); await shot('cset3');
  // 语音转文字：下面另起一个框，原文 + 译文
  await E(`(() => { core.home(); _e.msgs.push({ f: _e.id, t: 'voice', c: 'こんにちは', tr: '你好', stt: 1, ts: Date.now() }); core.saveD(); talk.openChat(_e.id); })()`); await W(500);
  ok(await E(`[...document.querySelectorAll('.chat .vtx')].at(-1)?.textContent`) == 'こんにちは你好' && !(await E(`!!document.querySelector('.chat .bub .vt')`)), '转文字：语音下面一个框，原文 + 译文');
  // 顶部状态栏按应用隐藏
  const sb = await E(`(() => { core.S.sbHide = ['chat']; core.openApp('chat'); const a = core.ui.scr.classList.contains('nosb'); core.home(); const b = core.ui.scr.classList.contains('nosb'); core.openApp('settings'); const c = core.ui.scr.classList.contains('nosb'); core.home(); core.S.sbHide = []; return [a, b, c]; })()`);
  ok(JSON.stringify(sb) == '[true,false,false]', '主题里关掉「消息」的状态栏：打开聊天没有状态栏，回桌面 / 打开别的应用有 ' + JSON.stringify(sb));
  // 分组 + 朋友圈谁可以看
  const cs = await E(`(() => { const a = dt.add(dt.blank('p', { real: 'A', fr: 1, grp: '同事' })), b = dt.add(dt.blank('p', { real: 'B', fr: 1 })), p = { vis: { m: 'only', g: ['同事'] } }, q = { vis: { m: 'not', g: ['同事'] } }; return [dt.canSee(p, a), dt.canSee(p, b), dt.canSee(q, a), dt.canSee(q, b), dt.grpNames().join()]; })()`);
  ok(JSON.stringify(cs.slice(0, 4)) == '[true,false,false,true]' && /同事/.test(cs[4]), '分组可见：只给同事看 / 不给同事看 ' + JSON.stringify(cs));
  await E(`core.home(); core.APPS.chat.open(); core.top().acts.wmi()`); await W(500);
  const me = await E(`core.top().el.textContent`);
  ok(/性别/.test(me) && /地区/.test(me) && /签名/.test(me) && /微信号/.test(me), '个人信息：有性别 / 地区 / 签名 / 微信号');
  await E(`document.querySelector('[data-a=wme][data-x=wxid]').click()`); await W(400);
  await E(`(() => { const s = document.querySelector('.sheet.in'), i = s.querySelector('input[data-k=wxid]'); i.value = 'xxxxyeah0705_'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); s.querySelector('[data-a=ok]').click(); })()`); await W(500);
  ok(await E(`core.D().me.wxid`) == 'xxxxyeah0705_' && /xxxxyeah0705_/.test(await E(`core.top().el.textContent`)), '改微信号：xxxxyeah0705_');
  await E(`document.querySelector('[data-a=wme][data-x=region]').click()`); await W(400);
  await E(`(() => { const s = document.querySelector('.sheet.in'), i = s.querySelector('input[data-k=region]'); i.value = '日本 横滨市'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); s.querySelector('[data-a=ok]').click(); })()`); await W(500);
  ok(await E(`core.D().me.region`) == '日本 横滨市', '改地区');
  await shot('me');
  ok(errs.length == 0, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
