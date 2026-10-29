// 聊天「＋」：视频通话 / 语音通话（拨号 → 接通 → 打字说 → 对方流式回、字幕 → 挂断 → 「通话时长」消息，聊天上下文带上通话内容）、收藏（长按收藏 → 发送收藏 → 发送给）、个人名片（选择联系人 → 发送给 → 名片气泡 → 点开资料页）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8823);
const wav = () => { const n = 4800, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort()); let ttsN = 0; await ctx.route(/api\.fish\.audio/, r => { ttsN++; r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: wav() }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8823/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.screenshot({ path: path.join(OUT, 'call_' + n + '.png') });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window.fav = await import('/apps/chat/fav.js');
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; window._P = [];
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); return /先开口/.test(JSON.stringify(o)) ? '喂？怎么突然打电话过来。' : '哈哈，真的吗。那你明天几点到？我去接你。'; };
    delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '徐鑫', nick: '绷带盐', fr: 1 })); window._k = dt.add(dt.blank('p', { real: 'Kiki', fr: 1 })); _c.msgs.push({ f: _c.id, t: 'text', c: '在吗', ts: Date.now() - 6e4 }); core.saveD(); talk.openChat(_c.id); })()`); await W(600);
  // 回归：通话界面的样式名不能和聊天列表的 .cl 撞（之前撞了：列表整个看不见、点哪都进第一个人的聊天）
  await E(`core.home(); core.APPS.chat.open()`); await W(500); ok(await E(`(() => { const r = document.querySelector('.chatapp .cl'), s = r && getComputedStyle(r); return !!r && s.opacity == '1' && s.position != 'absolute' && r.getBoundingClientRect().height < 120; })()`), '聊天列表正常显示（样式名不和通话撞）'); await E(`talk.openChat(_c.id)`); await W(500);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(300); await shot('panel');
  ok(await E(`[...document.querySelectorAll('.pan .tl')].map(t => t.textContent).join()`) == '视频通话,红包,转账,收藏,个人名片', '「＋」面板：视频通话 / 红包 / 转账 / 收藏 / 个人名片（图标抠自录屏）');
  await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(400);
  ok(/视频通话/.test(await E(`document.querySelector('.sheet.in').textContent`)) && /语音通话/.test(await E(`document.querySelector('.sheet.in').textContent`)), '点视频通话：底部弹出 视频通话 / 语音通话 / 取消');
  await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(400); await shot('dial');
  ok(await E(`!!document.querySelector('.xc .xc-dots') && /取消/.test(document.querySelector('.xc-ctl').textContent) && /麦克风已开/.test(document.querySelector('.xc-ctl').textContent)`), '拨号中：头像名字、三个点，下面 麦克风已开 / 取消 / 扬声器已关');
  await W(4200); await shot('talk');
  ok(await E(`!!document.querySelector('.xc .xc-tm') && /挂断/.test(document.querySelector('.xc-ctl').textContent)`), '接通：显示通话时长，按钮变「挂断」');
  ok(/怎么突然打电话/.test(await E(`document.querySelector('.xc').textContent`)) || /怎么突然打电话/.test(await E(`JSON.stringify(core.inCall?.() || '')`)) || await E(`_P.length`) >= 1, '接通后对方先开口（流式切句、字幕）');
  await W(2500);
  ok(await E(`!!document.querySelector('.xc-type input')`), '没有语音识别：自动打开「打字说」');
  await E(`(() => { const i = document.querySelector('.xc-type input'); i.value = '我明天回来'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await W(3500);
  ok(/我明天回来/.test(await E(`_P.at(-1)`)) && /打电话/.test(await E(`_P.at(-1)`)), '我打字说的话发给对方（提示词里写明在打电话）');
  await E(`document.querySelector('.xc [data-k=min]').click()`); await W(300); ok(await E(`document.querySelector('.xc').classList.contains('mini')`), '左上角缩小成小窗'); await shot('mini');
  await E(`document.querySelector('.xc').click()`); await W(200); await E(`document.querySelector('.xc [data-k=end]').click()`); await W(500);
  const m = await E(`JSON.stringify(_c.msgs.at(-1))`); ok(/"t":"call"/.test(m) && /通话时长 00:\d\d/.test(m) && /我明天回来/.test(m), '挂断：聊天里一条「通话时长 00:0x」，存着通话内容 ' + m.slice(0, 90));
  ok(/电话里聊了/.test(await E(`core.say(_c.msgs.at(-1))`)), '之后回复时，上下文里带着电话里聊了什么');
  await shot('bubble');
  // 再打一次、拨号时取消
  await E(`document.querySelector('.clb').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=video]').click()`); await W(300); await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400);
  ok(await E(`_c.msgs.at(-1).c == '已取消' && _c.msgs.at(-1).kind == 'video'`), '视频通话拨号时取消：「已取消」');
  // 切句（照 StarHub 验收条件 01）：标点、括号、SAY/ZH 标记切在任意网络块之间，放出来的句子都完整，括号旁白不念
  const cuts = await E(`(async () => { const m = await import('/apps/chat/call.js'), run = (mk, txt, n) => { const out = [], P = mk((t, tr) => out.push(tr ? t + '|' + tr : t)); for (let i = 0; i < txt.length; i += n) P.feed(txt.slice(i, i + n)); P.finish(); return out.map(x => x.replace(/[（(][^）)]*[）)]/g, '').trim()); };
    const zh = '喂？（笑）怎么突然打电话过来。你那边下雨了吗，我这边刚停「真的」！最后一句没标点';
    const pr = 'SAY: Take your time.\\nZH: 慢慢来。\\nSAY: I am listening.\\nZH: 我在听。';
    return JSON.stringify([1, 2, 3, 7].map(n => [run(m.zhUnits, zh, n), run(m.pairUnits, pr, n)])); })()`);
  ok(JSON.parse(cuts).every(([a, b]) => JSON.stringify(a) == JSON.stringify(['喂？', '怎么突然打电话过来。', '你那边下雨了吗，我这边刚停「真的」！', '最后一句没标点']) && JSON.stringify(b) == JSON.stringify(['Take your time.|慢慢来。', 'I am listening.|我在听。'])), '流式切句：每次只来 1 / 2 / 3 / 7 个字，切出来的句子都一样完整；外语原话和中文释义成对 ' + cuts.slice(0, 160));
  // 磁铁召回（学 StarHub 记忆教程，不调用模型）：更早的聊天里提过「蛋白粉」，现在又说到 → 那几句被吸上来；没说到就整块不出现（变异对照）
  const rc = await E(`(async () => { const r = await import('/apps/chat/recall.js'), ch = { msgs: [] }, t = Date.now() - 864e5 * 20;
    ch.msgs.push({ f: _c.id, t: 'text', c: '我最近在喝那个巧克力味的蛋白粉', ts: t }, { f: 'me', t: 'text', c: '好喝吗', ts: t + 1 });
    for (let i = 0; i < 40; i++) ch.msgs.push({ f: i % 2 ? 'me' : _c.id, t: 'text', c: '嗯嗯 好的 第' + i + '句闲聊', ts: t + 1e5 * i });
    ch.msgs.at(-1).c = '你那个蛋白粉还有吗'; const a = r.recall(ch); ch.msgs.at(-1).c = '晚上吃什么'; const b = r.recall(ch); return JSON.stringify([a, b]); })()`);
  ok(/巧克力味的蛋白粉/.test(JSON.parse(rc)[0]) && JSON.parse(rc)[1] === '', '磁铁召回：说到「蛋白粉」想起 20 天前那句；没说到就不出现 ' + rc.slice(0, 80));
  // 日语角色：真的出声（每句都送去合成并播放）、字幕里是日语 + 中文
  await E(`(() => { core.S.api.tts = { src: 'custom', pv: 'fish', cfg: { fish: { key: 'fk', model: 's1' } } }; _c.tv = { v: { fish: 'vid' } }; _c.cfg.lang = 'ja'; window._play = 0;
    const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { _play++; return st.apply(this, a); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { /^blob:/.test(this.src) && _play++; return pl.call(this); };
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); return 'SAY: もしもし、どうしたの？\\nZH: 喂，怎么了？\\nSAY: 今ちょうど暇だよ。\\nZH: 我现在正好有空。'; }; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(7000); await shot('ja');
  const tx = await E(`document.querySelector('.xc-tx')?.innerText || ''`);
  ok(/もしもし/.test(tx) && /喂，怎么了/.test(tx) && /今ちょうど暇だよ/.test(tx) && /我现在正好有空/.test(tx), '字幕：日语原话 + 下面的中文 ' + JSON.stringify(tx).slice(0, 80));
  ok(await E(`_play`) >= 2, '两句都真的播放了（不是只显示字） play=' + await E(`_play`));
  ok(!/もしもし.*ZH|SAY:/.test(tx), '字幕里没有 SAY / ZH 标记');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400); await E(`_c.cfg.lang = ''; core.S.api.tts = {}`);
  // 有的手机识别完只给「中间结果」不给「最终结果」：也要当成我说了这句（以前会被丢掉，对方一直不回）
  await E(`(() => { window._srN = 0; window.webkitSpeechRecognition = class { start() { const me = this; _srN++; if (_srN > 1) return; setTimeout(() => { me.onresult?.({ results: [Object.assign([{ transcript: '你在干嘛' }], { isFinal: false })] }); me.onend?.(); }, 300); } abort() {} stop() {} };
    SillyTavern.getContext().generateRaw = async o => { _P.push(JSON.stringify(o)); return '在发呆呢。'; }; })()`);
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcall]').click()`); await W(300); await E(`document.querySelector('.sheet.in [data-x=voice]').click()`); await W(6500);
  ok(/你在干嘛/.test(await E(`_P.at(-1)`)) && /你在干嘛/.test(await E(`document.querySelector('.xc-tx')?.innerText || ''`)), '识别只给中间结果也算我说了：发给对方，字幕里有');
  await E(`document.querySelector('.xc [data-k=end]').click()`); await W(400); await E(`delete window.webkitSpeechRecognition`);
  // 收藏
  await E(`fav.addFav(_c.msgs.find(m => m.c == '在吗'), _c)`); await W(200);
  ok(await E(`core.D().favs.length == 1 && core.D().favs[0].src == '绷带盐'`), '收藏一条消息（记着来源）');
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pfav]').click()`); await W(400); await shot('fav');
  ok(await E(`core.top().title == '发送收藏' && /在吗/.test(document.querySelector('.fv-l').textContent) && document.querySelectorAll('.fv-tabs b').length == 4`), '发送收藏：搜索、四个分类、收藏的内容');
  await E(`document.querySelector('.fv-tabs [data-x=voice]').click()`); await W(200); ok(/无筛选结果/.test(await E(`document.querySelector('.fv-l').textContent`)), '选「语音」：无筛选结果'); await E(`document.querySelector('.fv-tabs [data-x=voice]').click()`); await W(200);
  await E(`document.querySelector('.fv-it').click()`); await W(300); await shot('sendto'); ok(await E(`!!document.querySelector('.sd.in') && /发送给/.test(document.querySelector('.sd').textContent)`), '点一条：「发送给」确认框');
  await E(`document.querySelector('.sd [data-k=y]').click()`); await W(500); ok(await E(`_c.msgs.at(-1).c == '在吗' && _c.msgs.at(-1).f == 'me'`), '发送：收藏的内容发到聊天里');
  // 个人名片
  await E(`document.querySelector('[data-a=pan][data-x=more]').click()`); await W(200); await E(`document.querySelector('.tl[data-a=pcard]').click()`); await W(400); await shot('pick');
  ok(await E(`core.top().title == '选择联系人' && /Kiki/.test(document.querySelector('.cp-list').textContent) && !/绷带盐/.test(document.querySelector('.cp-list').textContent)`), '个人名片：选择联系人（不列当前聊天的人）');
  await E(`document.querySelector('.cp-r').click()`); await W(300); await E(`document.querySelector('.sd-in').value = '这是我朋友'; document.querySelector('.sd [data-k=y]').click()`); await W(600); await shot('card');
  ok(await E(`_c.msgs.at(-2).t == 'card' && _c.msgs.at(-2).cid == _k.id && _c.msgs.at(-1).c == '这是我朋友' && !!document.querySelector('.bub.b-card .cdb') && !!document.querySelector('.sd-ok')`), '发出名片 + 留言，底部「✓ 已发送」');
  ok(/推荐了一张个人名片：Kiki/.test(await E(`core.say(_c.msgs.at(-2))`)), '对方能看到是谁的名片');
  await E(`document.querySelector('.bub.b-card .cdb').click()`); await W(400); ok(await E(`core.top().el.classList.contains('wxprof')`), '点名片：打开 TA 的资料页');
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
