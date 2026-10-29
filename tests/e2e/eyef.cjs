// 窥探之眼 · 论坛：登录窗 → 生成（模拟 AI）→ iframe 里显示 50+ 楼 → 历史（按聊天存）→ 删除；解析楼中楼
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8817);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
// 一份假的模型输出：52 楼，第 3 楼有 5 条楼中楼；own=1 时带自己的模板（贴吧那种左右两栏）
const TPL = `<page><header class="tb">{{plat}}·{{board}}<script>alert(1)</script></header><h1 class="tt">{{title}}</h1><div class="opb">{{body}}</div><main>{{floors}}</main></page>
<floor><section class="row {{is_op}}"><aside class="side">{{av}}<em>LV{{lv}}</em><img src="https://evil.example/x.png" onerror="alert(2)"></aside><div class="main"><b class="nm">{{u}}</b><div class="ct">{{c}}</div><span class="like">♥ {{like}}</span>{{more}}<div class="rr">{{replies}}</div></div></section></floor>
<reply><p class="r">{{u}}：{{c}}</p></reply>`;
const fake = (plat, own) => `<style>:root{--bg:#f5f5f5;--acc:#007722}.top{background:#edf4ed}.op-t{color:#072}.row{display:flex}</style>
${own ? TPL : `<top><div class="bar"><b>${plat}</b><span>少年漫吃瓜专组</span><script>alert(1)</script></div></top>`}
【平台】${plat}
【版块】少年漫吃瓜专组
【回应数】1042
【标题】【专组吃瓜】第27话出了，某人彻底沦为倒贴娇妻男
【楼主】吃瓜第一线的乐子人 | 楼主 | 2026-09-27 10:14
【正文】
家人们谁懂啊，<b>这一话</b>杀疯了。<img src=x onerror=alert(1)>
<blockquote>“不去的话我就在你门口唱歌。”</blockquote>
【楼层】
${Array.from({ length: 52 }, (_, i) => `#${i + 1} 网友${i % 7} | ${['CP粉', '毒唯', '乐子人'][i % 3]} | 10:${String(15 + i % 40).padStart(2, '0')} | ${i * 13}
第 ${i + 1} 楼的内容，急了急了。${i == 2 ? '\n> 路人甲：笑死\n> 毒唯：滚\n> 楼主：典\n> 路人乙：绷\n> 考据党：伏笔' : ''}`).join('\n')}`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('dialog ' + d.message()); d.dismiss(); });
  await p.goto('http://localhost:8817/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  await E(`(async () => { window.core = await import('/core.js'); window.F = await import('/apps/eye/forum.js'); core.S.lock.on = false; core.S.eye = { intro: false }; core.D().eye = { form: 'manga', role: 'viewer', wall: false, src: 'orig' }; core.S.api.chat.src = 'tavern'; core.save(); core.home(); })()`);
  let calls = 0, lastPrompt = '';
  await p.exposeFunction('fakeAI', n => fake(n % 2 ? '百度贴吧' : '豆瓣小组', n % 2));
  await E(`SillyTavern.getContext().generateRaw = async o => { window.__calls = (window.__calls || 0) + 1; window.__prompt = o.prompt; await new Promise(r => setTimeout(r, 400)); return fakeAI(window.__calls); }`);
  // 解析
  const ps = await E(`(() => { const x = F.parse(${JSON.stringify(fake('豆瓣小组'))}); return { n: x.fl.length, rp: x.fl[2].rp.length, t: x.t, ou: x.ou, plat: x.plat, total: x.total, css: x.css.length > 10 }; })()`);
  ok(ps.n == 52 && ps.rp == 5 && ps.plat == '豆瓣小组' && ps.total == '1042' && ps.ou == '吃瓜第一线的乐子人' && ps.css, '解析：52 楼、楼中楼 5 条、平台 / 回应数 / 楼主 / CSS ' + JSON.stringify(ps));
  const h = await E(`F.html(${JSON.stringify(fake('豆瓣小组'))})`);
  ok(!/<script>alert|onerror|<img|img src/.test(h) && /<b>这一话<\/b>/.test(h) && /<blockquote>/.test(h), '拼页面：脚本 / 事件属性 / 图片被去掉，<b> <blockquote> 保留');
  // 进窥探之眼 → 手机 → 论坛
  await E(`core.openApp('eye')`); await W(1500);
  await E(`document.querySelector('.hz-phone').click()`); await W(1500);
  await E(`document.querySelector('.phz[data-x=forum]').click()`); await W(700);
  ok(await E(`!!document.querySelector('.ef-pg .efp .ph') && !!document.querySelector('.efp-go') && !document.querySelector('.holo')`), '点论坛：整页打开，先是猫眼（没有全息屏）');
  await p.screenshot({ path: OUT + '/eyef-entry.png' });
  await E(`document.querySelector('.efp-go').click()`); await W(150);
  ok(await E(`!!document.querySelector('.efp-ld .ph-scan') && document.querySelectorAll('.efp-seg i').length == 25`), '点凑近看：猫眼开始扫描，25 格进度');
  await p.screenshot({ path: OUT + '/eyef-loading.png' });
  await W(1500);
  const fr = () => p.frames().find(f => f !== p.mainFrame());
  ok(!!fr() && await fr().$$eval('[data-fl]', x => x.length) == 52 && await fr().$$eval('section.row', x => x.length) == 52, '生成完：用的是模型自己的楼层模板，52 楼');
  ok(await fr().$eval('.tt', x => x.textContent).then(t => /倒贴娇妻男/.test(t)), '标题填进模型的页面模板');
  ok(await fr().evaluate(() => !document.querySelector('script:not(:last-of-type)') && !document.querySelector('img') && /LV\d+/.test(document.querySelector('.side em').textContent)), '模板里的脚本 / 外链图片 / 事件被去掉，{{lv}} 填上了');
  ok(await E(`document.querySelector('.ef-ttl').textContent`) == '百度贴吧 · 少年漫吃瓜专组', '顶上显示平台和版块');
  ok(await fr().$eval('#f3 .r:nth-child(4)', x => getComputedStyle(x).display == 'none'), '楼中楼超过 3 条先折起来');
  await fr().click('#f3 .xf-more'); ok(await fr().$eval('#f3 .r:nth-child(4)', x => getComputedStyle(x).display != 'none'), '点展开：都出来');
  await fr().click('#f3 .like'); ok(await fr().$eval('#f3 .like .xf-n', x => x.textContent) == '27', '点赞 +1');
  await p.screenshot({ path: OUT + '/eyef-thread.png' });
  const pr = await E(`window.__prompt`);
  ok(/漫画/.test(pr) && /至少 50 楼/.test(pr) && /最近几帖用过：无/.test(pr), '提示词带形态、50 楼、最近用过的平台');
  // 再刷一帖
  await E(`document.querySelector('.ef-h [data-a=efgen]').click()`); await W(1800);
  ok(await E(`core.D().eye.forum.length`) == 2 && /最近几帖用过：百度贴吧/.test(await E(`window.__prompt`)), '再生成一帖：历史 2 条，提示词避开上次的平台');
  // 历史
  await E(`document.querySelector('.ef-h [data-a=efhist]').click()`); await W(500);
  ok(await E(`document.querySelectorAll('.efh-l li').length`) == 2, '历史列表 2 帖');
  await p.screenshot({ path: OUT + '/eyef-hist.png' });
  await E(`document.querySelectorAll('.efh-l li')[1].click()`); await W(500);
  ok(await E(`document.querySelector('.ef-ttl').textContent`) == '百度贴吧 · 少年漫吃瓜专组', '点历史里的旧帖：回到论坛显示那一帖');
  await E(`document.querySelector('.ef-h [data-a=efhist]').click()`); await W(400); await E(`document.querySelectorAll('.efh-l li')[0].click()`); await W(500);
  ok(await p.frames().find(f => f !== p.mainFrame()).$$eval('.fl', x => x.length) == 52, '没带模板的那帖：用默认版式');
  // 换聊天：历史跟着聊天走
  await E(`(core.home(), ctx.chatMetadata = {}, ctx.chatId = 'chatB')`); await W(200);
  ok(await E(`!(core.D().eye?.forum?.length)`), '换个聊天：没有历史');
  ok(errs.length == 0, '没有报错 ' + errs.join(' | '));
  console.log(`\n${pass} 通过 / ${fail} 失败`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
