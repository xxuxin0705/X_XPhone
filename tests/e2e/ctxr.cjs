// 发给 TA 的内容：正文标签 要 / 不要（默认只要 content、不要 thinking；注释、草稿、生图提示词、剧情选项这些没分配的都不发）、
// 「找出正文里的其他标签」本地扫描（不调模型）、世界书整本 / 每条勾选；全局一套，聊天设置里直接改、改了的只对这个聊天生效（小点点一下恢复）；预览
// 用的正文是用户真实的一条（开了草稿：5 段 <content>、<!-- draft -->、<wechat><!-- 群聊 --></wechat>、<bbi_image>、<branches>…）
const { chromium } = require('playwright'); const path = require('path'), http = require('http'), fs = require('fs');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + (/\.(js|css|html)$/.test(f) ? '; charset=utf-8' : '') }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8828);
const MES = `<globalTime>
T_story：2006年04月13日·星期四·02:20·薄云晴
</globalTime>
<Slate><Location>东京都立咒术高等专门学校·医务室</Location><Mind>没事就好。</Mind></Slate>
<thinking>他现在应该很担心</thinking>
<!-- draft:P1
=== DRAFT TEXT ===
草稿第一段
=== SCAN A ===
[A1] BANNED_WORDS: CLEAR.
-->
<!--🤍<互动禁词>自检:PASS-->
<content>
<!-- draft:P0 正文里面的草稿 -->
玻璃杯的边缘抵上了有些干裂的唇瓣。
[[九月七桃霁]]「もう大丈夫……平気だよ。」（“没事了……”）
</content>
<!-- draft:P2
草稿第二段
-->
<content>
他隔着棉被按住了我的肩膀。
<bbi_image>1boy, 1girl, infirmary<nl>A boy and a girl</nl><size>landscape</size></bbi_image>
</content>
<content>
几声按键音后，消息发了出去。
<wechat><!--
---这学上的我想---
[02:24] 我不是酒神: 滚。
--></wechat>
走廊外传来了拖沓的脚步声。
</content>
<branches>
options:
硝子推门进来后……
</branches>`;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8828/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = n => p.locator('#stp .stp-scr').screenshot({ path: path.join(OUT, 'ctxr_' + n + '.png') });
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.talk = await import('/apps/chat/talk.js'); window._llm = 0;
    core.S.lock.on = false; core.S.style = 'wx'; core.S.api.chat.src = 'tavern'; delete core.S.ctxR; const X = SillyTavern.getContext(); X.generateRaw = async () => { _llm++; return '嗯'; };
    X.chat = [{ name: '五条悟', mes: '<content>更早的一楼</content>' }, { name: '桃', is_user: true, mes: '我缩在<b>被子</b>里。<br>看着他。' }, { name: '五条悟', mes: ${JSON.stringify(MES)} }];
    X.loadWorldInfo = async n => ({ entries: n == '咒术设定' ? { 1: { uid: 1, comment: '五条悟人设', constant: true, content: '【五条悟人设条目】' }, 2: { uid: 2, comment: '夏油杰的秘密', constant: true, content: '【夏油的秘密条目】' }, 3: { uid: 3, comment: '酒馆里关着的', constant: true, disable: true, content: '【关着的条目】' } } : { 1: { uid: 1, comment: '小剧场', constant: true, content: '【小剧场条目】' } } });
    core.S.wi.follow = false; core.S.wi.books = ['咒术设定', '小剧场合集']; core.S.wi.ov = { '咒术设定/2': 0 };
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); core.saveD(); })()`); await W(400);
  const tx = s => E(`core.body(${JSON.stringify(MES)}, core.ctxRules(${s || ''}))`);
  // 默认：只要 content（几段拼起来）；没放进「要」的（思维链、注释、草稿、生图提示词、群聊、剧情选项、时间地点）都不发
  let t = await tx();
  ok(/玻璃杯的边缘/.test(t) && /按住了我的肩膀/.test(t) && /消息发了出去/.test(t) && /脚步声/.test(t), '默认：几段 content 全部按顺序拼起来');
  ok(/正文里面的草稿/.test(t) && /1boy/.test(t) && /不是酒神: 滚/.test(t) && !/<|>|-->/.test(t), '「要」content：content 里面的全部照发（里面的草稿注释、生图提示词、群聊都在，只去掉符号）');
  ok(!/他现在应该很担心|草稿第一段|草稿第二段|BANNED|自检|options|硝子推门|T_story|医务室/.test(t), 'content 外面的（思维链、外面的草稿、剧情选项、时间地点）都不发');
  ok(await E(`core.body('我缩在<b>被子</b>里。<br>看着他。') == '我缩在被子里。\\n看着他。' && core.body('<thinking>写到一半断了…') == '' && core.body('<thinking>想想</thinking>正文<!-- 草稿 -->在这') == '正文在这'`), '没有 content 的消息：用整条，排版标签只去掉尖括号；没写完的思维链删到最后；注释去掉');
  ok(await E(`(() => { const X = SillyTavern.getContext(), old = X.chat; X.chat = [{ name: '五条悟', mes: '<content>' + '长'.repeat(5000) + '</content>' }]; const r = core.storyText(); X.chat = old; return r.length > 5000; })()`), '正文整条都发，不再每条只取 800 字');
  ok(await E(`(() => { core.S.ctxN = 2; const a = core.storyText(); core.S.ctxR.user = false; const b = core.storyText(); delete core.S.ctxR.user; core.S.ctxN = 15; return /桃: /.test(a) && !/更早的一楼/.test(a) && !/桃: /.test(b) && /更早的一楼/.test(b); })()`), '「带上我说的话」：带的话 2 楼 = 我一楼 + TA 一楼；不带的话 2 楼 = TA 的两楼（往前多取）');
  // 设置 → 上下文与世界书
  await E(`core.APPS.settings.open()`); await W(400); await E(`[...document.querySelectorAll('.pg [data-a]')].find(e => /上下文与世界书/.test(e.textContent))?.click()`); await W(900);
  ok(await E(`[...document.querySelectorAll('.cxr-keep .cxr-chip')].map(e => e.dataset.k).join() + '|' + document.querySelectorAll('.cxr-drop .cxr-chip').length + '|' + document.querySelector('[data-c=user]').checked`) == 'content|0|true', '「要」框里是 content，「不要」框是空的，「带上我说的话」开着');
  ok(await E(`!!document.querySelector('[data-c=wb][data-k="咒术设定"].on') && !document.querySelector('.cxr-en')`), '世界书：每本一行、默认勾着、折叠着');
  const kc = await E(`[...document.querySelectorAll('.cxr-cds[data-v=keep] .cxr-cd')].map(e => e.dataset.k)`), dc = await E(`[...document.querySelectorAll('.cxr-cds[data-v=drop] .cxr-cd')].map(e => e.dataset.k)`);
  ok(['thinking', 'globaltime', 'slate', 'branches', '!--'].every(n => kc.includes(n)) && !kc.includes('b') && await E(`_llm`) == 0, '「要」下面：正文里找到的标签（本地扫，没调模型）' + kc.join(','));
  ok(['!--', 'bbi_image', 'wechat'].every(n => dc.includes(n)) && !dc.includes('thinking') && !dc.includes('branches'), '「不要」下面：只列 content 里面出现的标签（注释、生图提示词、群聊…），content 外面的不列 ' + dc.join(','));
  // 点哪儿只改哪儿
  await E(`window._f = document.querySelector('.cxr-keep'); window._bk = document.querySelector('.cxr-bk')`);
  await E(`document.querySelector('.cxr-cds[data-v=drop] .cxr-cd[data-k="!--"]').click()`); await W(50); await E(`document.querySelector('.cxr-cds[data-v=drop] .cxr-cd[data-k=bbi_image]').click()`); await W(50);
  await E(`document.querySelector('.cxr-cds[data-v=keep] .cxr-cd[data-k=globaltime]').click()`); await W(50);
  await E(`(() => { const i = document.querySelector('.cxr-in[data-v=keep]'); i.value = '<Mind>'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await W(100);
  ok(await E(`[...document.querySelectorAll('.cxr-keep .cxr-chip')].map(e => e.dataset.k).join() + '|' + [...document.querySelectorAll('.cxr-drop .cxr-chip')].map(e => e.dataset.k).join() + '|' + core.S.ctxR.names.mind`) == 'content,globaltime,mind|!--,bbi_image|Mind', '「不要」放进注释、生图提示词；「要」放进 globalTime、打字加 <Mind>');
  t = await tx(); ok(!/正文里面的草稿|1boy/.test(t) && /T_story/.test(t) && /没事就好/.test(t) && /玻璃杯/.test(t) && t.indexOf('T_story') < t.indexOf('玻璃杯'), 'content 里的草稿注释、生图提示词不发了；剧情时间、心声发（按原文顺序）');
  ok(/不是酒神: 滚/.test(t), '群聊（<wechat> 里整个包着注释）算 wechat 的内容，不算「注释」：注释放进「不要」，群聊照样发');
  ok(await E(`document.querySelectorAll('.cxr-cds[data-v=drop] .cxr-cd[data-k=location]').length == 0 && [...document.querySelectorAll('.cxr-cds[data-v=drop] .cxr-cd')].some(e => e.dataset.k == 'wechat')`), '「要」多了 Slate 里的 Mind：「不要」下面跟着更新（只重排那一排）');
  await E(`document.querySelector('.cxr-keep .cxr-chip[data-k=mind]').click()`); await W(50);
  ok(await E(`!core.S.ctxR.tags.mind && !!document.querySelector('.cxr-cds[data-v=keep] .cxr-cd[data-k=mind]')`), '点框里那块：拿出来，回到下面');
  await E(`document.querySelector('[data-c=wopen][data-k="咒术设定"]').click()`); await W(100);
  ok(await E(`!document.querySelector('[data-c=we][data-k="咒术设定/2"]').classList.contains('on') && !document.querySelector('[data-c=we][data-k="咒术设定/3"]').classList.contains('on') && document.querySelector('[data-c=we][data-k="咒术设定/1"]').classList.contains('on')`), '每条默认跟酒馆里的开关：酒馆里关着的条目不勾；旧版设成「关」的也不勾');
  await E(`document.querySelector('[data-c=we][data-k="咒术设定/1"]').click()`); await W(50);
  ok(await E(`document.querySelector('.cxr-bk[data-b="咒术设定"] .cxr-b em').textContent == '0/3' && document.querySelector('.cxr-keep') === _f && document.querySelector('.cxr-bk') === _bk`), '勾一条只改那一个勾和这本的计数；整块没有重画');
  await E(`document.querySelector('[data-c=we][data-k="咒术设定/1"]').click()`); await E(`document.querySelector('[data-c=wb][data-k="小剧场合集"]').click()`); await W(100);
  // 预览：发出去的正文 / 整份提示词，标字数；关掉「带上我说的话」
  await E(`document.querySelector('[data-c=pv]').click()`); await W(300); await E(`document.querySelector('.cxr').scrollIntoView()`); await shot('global');
  const pv1 = await E(`document.querySelector('.cxr-pv').textContent`), c1 = await E(`document.querySelector('.cxr-cnt').textContent`);
  ok(/T_story/.test(pv1) && /我缩在被子里/.test(pv1) && !/正文里面的草稿/.test(pv1) && c1 == pv1.length.toLocaleString() + ' 字', '预览「发出去的正文」：所有正文按现在的设置，标出字数 ' + c1);
  await E(`document.querySelector('[data-c=user]').click()`); await W(700);
  ok(await E(`core.S.ctxR.user === false && !/我缩在被子里/.test(document.querySelector('.cxr-pv').textContent)`), '关掉「带上我说的话」：预览里没有我说的了');
  await E(`document.querySelector('[data-c=user]').click()`); await W(100);
  await E(`document.querySelector('[data-c=pvk][data-k=all]').click()`); await W(400);
  const pv2 = await E(`document.querySelector('.cxr-pv').textContent`);
  ok(/【世界书】/.test(pv2) && /五条悟人设条目/.test(pv2) && await E(`document.querySelector('.cxr-cnt').textContent`) == pv2.length.toLocaleString() + ' 字', '预览「整份提示词」：人设、世界书、正文全部，标出字数');
  let sys = await E(`core.sysCtx()`);
  ok(/五条悟人设条目/.test(sys) && !/夏油的秘密条目|小剧场条目|关着的条目/.test(sys) && !/他现在应该很担心|1boy/.test(sys), '发给模型的提示词：没勾的条目、整本勾掉的书不发；正文按标签规则');
  await E(`core.back()`); await W(300);
  // 聊天设置：显示的就是全局的；直接改，只对这个聊天生效，旁边一个小点；点小点恢复
  await E(`talk.cset(_c)`); await W(900); await E(`document.querySelector('.cxr').scrollIntoView()`);
  ok(await E(`!!document.querySelector('.cxr-drop .cxr-chip[data-k=bbi_image]') && !document.querySelector('[data-c=wb][data-k="小剧场合集"]').classList.contains('on') && !document.querySelector('.cxr-dot')`), '聊天设置：一打开就是全局的样子，没有小点');
  await E(`document.querySelector('.cxr-drop .cxr-chip[data-k="!--"]').click()`); await W(50); await E(`document.querySelector('[data-c=wb][data-k="小剧场合集"]').click()`); await W(50); await E(`document.querySelector('[data-c=user]').click()`); await W(100); await shot('chat');
  ok(await E(`_c.cfg.ctx.tags['!--'] === '' && _c.cfg.ctx.wi['小剧场合集'] == 1 && _c.cfg.ctx.user === false && core.S.ctxR.tags['!--'] == 'drop' && core.S.ctxR.wi['小剧场合集'] == 0 && core.S.ctxR.user !== false && document.querySelectorAll('.cxr-dot').length == 3`), '在聊天设置里改：只记在这个聊天，全局不变；改过的旁边有小点');
  sys = await E(`core.sysCtx({ ch: _c })`); const sysG = await E(`core.sysCtx()`);
  ok(/正文里面的草稿/.test(sys) && /小剧场条目/.test(sys) && !/我缩在被子里/.test(sys) && !/正文里面的草稿/.test(sysG) && !/小剧场条目/.test(sysG) && /我缩在被子里/.test(sysG), '这个聊天的提示词按它自己的；别的聊天照全局');
  await E(`document.querySelector('.cxr-dot[data-c=rtag]').click()`); await W(100);
  ok(await E(`!_c.cfg.ctx.tags && !!document.querySelector('.cxr-drop .cxr-chip[data-k="!--"]') && document.querySelectorAll('.cxr-dot').length == 2`), '点标签那行的小点：标签恢复成全局');
  await E(`(async () => { const tk = await import('/apps/chat/talk.js'); core.back(); tk.openChat(_c.id); })()`); await W(400);
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
