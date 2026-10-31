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
    X.chat = [{ name: '桃', mes: '我缩在<b>被子</b>里。<br>看着他。' }, { name: '五条悟', mes: ${JSON.stringify(MES)} }];
    X.loadWorldInfo = async n => ({ entries: n == '咒术设定' ? { 1: { uid: 1, comment: '五条悟人设', constant: true, content: '【五条悟人设条目】' }, 2: { uid: 2, comment: '夏油杰的秘密', constant: true, content: '【夏油的秘密条目】' } } : { 1: { uid: 1, comment: '小剧场', constant: true, content: '【小剧场条目】' } } });
    core.S.wi.follow = false; core.S.wi.books = ['咒术设定', '小剧场合集']; core.S.wi.ov = { '咒术设定/2': 0 };
    core.APPS.chat.open(); window._c = dt.add(dt.blank('p', { real: '五条悟', nick: '五条', fr: 1 })); core.saveD(); })()`); await W(400);
  const tx = s => E(`core.body(${JSON.stringify(MES)}, core.ctxRules(${s || ''}))`);
  // 默认：只要 content（5 段拼起来）、不要 thinking；注释、草稿、生图提示词、群聊（被注释包着）、剧情选项、时间地点都不发
  let t = await tx();
  ok(/玻璃杯的边缘/.test(t) && /按住了我的肩膀/.test(t) && /消息发了出去/.test(t) && /脚步声/.test(t), '默认：几段 content 全部按顺序拼起来');
  ok(!/他现在应该很担心|草稿|BANNED|自检|1boy|options|硝子推门|T_story|医务室|不是酒神|<|>/.test(t), '默认：思维链、草稿注释、生图提示词、剧情选项、时间、群聊都不发，也没有尖括号 ' + JSON.stringify(t).slice(0, 120));
  ok(await E(`core.body('我缩在<b>被子</b>里。<br>看着他。') == '我缩在被子里。\\n看着他。' && core.body('<thinking>写到一半断了…') == '' && core.body('<thinking>想想</thinking>正文<!-- 草稿 -->在这') == '正文在这'`), '没有 content 的消息：用整条，排版标签只去掉尖括号；没写完的思维链删到最后；注释去掉');
  // 设置 → 上下文与世界书：一开始只显示 content / thinking；找其他标签（本地，不调模型）
  await E(`core.APPS.settings.open()`); await W(400); await E(`[...document.querySelectorAll('.pg [data-a]')].find(e => /上下文与世界书/.test(e.textContent))?.click()`); await W(900);
  ok(await E(`[...document.querySelectorAll('.cxr-n code')].map(e => e.textContent).join()`) == 'content,thinking' && await E(`!!document.querySelector('.cxr-s[data-k=content] [data-v=keep].on') && !!document.querySelector('.cxr-s[data-k=thinking] [data-v=drop].on')`), '全局：一开始只显示 content（要）、thinking（不要）');
  ok(await E(`!!document.querySelector('[data-c=wb][data-k="咒术设定"].on') && !document.querySelector('.cxr-en')`), '世界书：每本一行、默认勾着、折叠着');
  await E(`document.querySelector('[data-c=scan]').click()`); await W(200);
  const names = await E(`[...document.querySelectorAll('.cxr-n code')].map(e => e.textContent)`);
  ok(['globalTime', 'Slate', 'Location', 'wechat', 'bbi_image', 'branches', '<!-- -->'].every(n => names.includes(n)) && !names.includes('b') && !names.includes('br') && await E(`_llm`) == 0, '找出正文里的其他标签：列出来、排版标签不算、没调模型 ' + names.join(','));
  ok(await E(`!document.querySelector('.cxr-s[data-k=wechat] .on')`), '新找到的标签：没分配（要 / 不要 都没选）');
  await E(`document.querySelector('.cxr-s[data-k=wechat] [data-v=keep]').click()`); await E(`document.querySelector('.cxr-s[data-k=globaltime] [data-v=keep]').click()`); await W(100);
  t = await tx(); ok(/不是酒神: 滚/.test(t) && /T_story/.test(t) && !/1boy|options|草稿/.test(t) && t.indexOf('T_story') < t.indexOf('玻璃杯'), '把 wechat、globalTime 点成「要」：群聊（包在注释里的）和剧情时间也发，按原文顺序');
  await E(`document.querySelector('[data-c=wopen][data-k="咒术设定"]').click()`); await W(100);
  ok(await E(`!document.querySelector('[data-c=we][data-k="咒术设定/2"]').classList.contains('on')`), '旧版设成「关」的条目：搬成不勾');
  await E(`document.querySelector('[data-c=wb][data-k="小剧场合集"]').click()`); await W(100);
  await E(`document.querySelector('[data-c=pv]').click()`); await W(200); await E(`document.querySelector('.cxr').scrollIntoView()`); await shot('global');
  ok(/不是酒神/.test(await E(`document.querySelector('.cxr-pv').textContent`)) && !/草稿/.test(await E(`document.querySelector('.cxr-pv').textContent`)), '预览：最新一条按现在的设置');
  let sys = await E(`core.sysCtx()`);
  ok(/五条悟人设条目/.test(sys) && !/夏油的秘密条目|小剧场条目/.test(sys) && /不是酒神/.test(sys) && !/思维链|他现在应该很担心|1boy/.test(sys), '发给模型的提示词：没勾的条目、整本勾掉的书不发；正文按标签规则');
  await E(`core.back()`); await W(300);
  // 聊天设置：显示的就是全局的；直接改，只对这个聊天生效，旁边一个小点；点小点恢复
  await E(`talk.cset(_c)`); await W(900); await E(`document.querySelector('.cxr').scrollIntoView()`);
  ok(await E(`!!document.querySelector('.cxr-s[data-k=wechat] [data-v=keep].on') && !document.querySelector('[data-c=wb][data-k="小剧场合集"]').classList.contains('on') && !document.querySelector('.cxr-dot')`), '聊天设置：一打开就是全局的样子（wechat 要、小剧场合集不发），没有小点');
  await E(`document.querySelector('.cxr-s[data-k=wechat] [data-v=drop]').click()`); await E(`document.querySelector('[data-c=wb][data-k="小剧场合集"]').click()`); await W(100); await shot('chat');
  ok(await E(`_c.cfg.ctx.tags.wechat == 'drop' && _c.cfg.ctx.wi['小剧场合集'] == 1 && core.S.ctxR.tags.wechat == 'keep' && core.S.ctxR.wiOff['小剧场合集'] == 1 && document.querySelectorAll('.cxr-dot').length == 2`), '在聊天设置里改：只记在这个聊天，全局不变；改过的两项旁边有小点');
  sys = await E(`core.sysCtx({ ch: _c })`); const sysG = await E(`core.sysCtx()`);
  ok(!/不是酒神/.test(sys) && /小剧场条目/.test(sys) && /不是酒神/.test(sysG) && !/小剧场条目/.test(sysG), '这个聊天的提示词按它自己的：不带群聊、带小剧场；别的聊天照全局');
  await E(`document.querySelector('.cxr-dot[data-c=rtag]').click()`); await W(100);
  ok(await E(`!('wechat' in _c.cfg.ctx.tags) && !!document.querySelector('.cxr-s[data-k=wechat] [data-v=keep].on') && document.querySelectorAll('.cxr-dot').length == 1`), '点小点：这一项恢复成全局');
  await E(`(async () => { const tk = await import('/apps/chat/talk.js'); core.back(); tk.openChat(_c.id); })()`); await W(400);
  ok(!errs.length, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
