// 心屿：每个角色一座果冻球里的 3D 小岛，天气 = 心情，风景随机拼（时代 × 气候 × 地标套件）；读剧情 / 正文「心情|谁|心情|一句话|风景词」；
// 戳、拖着转（能翻过来）、双指缩放、拍一下乱弹；AI 导演按剧情选风景；没有 AI 时按角色卡偏时代；潮汐记录
// 画 3D 用的是电脑上的软件渲染，很慢，所以物理用 j.advance(秒) 直接往前算，不靠真实时间
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff': 'font/woff', '.html': 'text/html' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (MIME[path.extname(f)] || 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8815);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() == 'error' && /Shader|THREE/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await p.goto('http://localhost:8815/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms), shot = async n => p.screenshot({ path: path.join(OUT, n), clip: await p.locator('#stp .stp-scr').boundingBox() }); // 不用 locator.screenshot：WebGL 一直在重画，它会等「元素稳定」等到超时
  await E(`(async () => { window.core = await import('/core.js'); window.dt = await import('/apps/chat/data.js'); window.is = await import('/apps/isle/isle.js'); window.gen = await import('/apps/isle/gen.js'); core.S.lock.on = false; window.ep = []; SillyTavern.getContext().setExtensionPrompt = (k, v) => ep.push(v);
    window._a = dt.add(dt.blank('p', { real: '五条悟', fr: 1 })); window._b = dt.add(dt.blank('p', { real: '夏油杰', fr: 1 })); core.saveD(); window.J = () => is._globe(); window.jj = await import('/apps/isle/jelly.js'); window.PROG = () => jj._eng()?.renderer.info.programs.length ?? -1; })()`); await W(300);
  // 等球建好（软件渲染要编译几十个着色器，慢）；after 之后 advance(0) 立刻按当前配方重建，不等下一帧
  const ready = async () => { await p.waitForFunction('J() && J().state.stats', null, { timeout: 180000 }); await E('J().advance(0)'); };
  const G = () => E('J().state');
  ok(await E(`!!core.APPS.isle && [...core.S.desk.pages.flat(), ...core.S.desk.dock].some(x => x.app == 'isle')`), '桌面上有「心屿」');
  // 打开手机：趁空闲预热（加载 three.js、编译着色器），点进心屿时不用等
  await E(`core.emit('phone-open')`); await p.waitForFunction('jj._eng()?.warmed && J() == null', null, { timeout: 300000 }); await p.waitForFunction('jj._eng().trash == null || jj._eng().trash.length == 0', null, { timeout: 300000 });
  ok(await E(`jj._eng().warmed && PROG() > 5`), `打开手机后预热好了：${await E('PROG()')} 个着色器程序已经编译`);
  await E(`core.openApp('isle')`); await ready();
  ok(await E(`document.querySelectorAll('.isle .is-who b').length == 2 && !!document.querySelector('.isle canvas') && document.querySelector('.isle canvas').width > 300`), '打开：两个角色的头像、果冻球画出来了');
  ok(/还不知道[\s\S]*五条悟的岛/.test(await E(`document.querySelector('.is-card').textContent`)), '还没读过心情：显示「还不知道」');
  const st0 = await E('J().state.stats'); ok(st0.tris > 3000 && st0.leaves > 200 && st0.meshes < 60 && errs.length == 0, `3D 世界：${st0.tris} 个三角面、${st0.leaves} 片叶子，合并成 ${st0.meshes} 个网格，着色器没报错`);
  await p.waitForFunction('J().frames > 0', null, { timeout: 180000 }); await shot('isle_open.png');
  // 读剧情（模拟一次 API）
  await E(`SillyTavern.getContext().generateRaw = async () => '{"mood":"烦躁","scene":"storm","say":"别再问我了。","sea":0.9}'`);
  await E(`document.querySelector('[data-a=islook]').click()`); await W(600);
  ok(await E(`core.D().isle.by[_a.id].mood == '烦躁' && core.D().isle.by[_a.id].scene == 'storm' && core.D().isle.by[_a.id].hist.length == 1`), '看看 TA 现在：读出「烦躁」→ 雷暴');
  ok(/烦躁[\s\S]*雷暴[\s\S]*别再问我了/.test(await E(`document.querySelector('.is-card').textContent`)), '卡片显示心情、天气、那句话');
  // 正文里的心情
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: '他看着窗外笑了。\\n<手机>\\n心情|夏油杰|温柔|今天的风很好。\\n</手机>', is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(300);
  ok(await E(`core.D().isle.by[_b.id].mood == '温柔' && core.D().isle.by[_b.id].scene == 'aurora'`), '正文 <手机> 块里「心情|谁|心情|一句话」：夏油杰 → 温柔 → 极光');
  ok(await E(`!SillyTavern.getContext().chat.at(-1).mes.includes('心情|')`), '那一行不显示在正文里');
  await E(`document.querySelectorAll('.is-who b')[1].click()`); await ready();
  ok(/温柔[\s\S]*极光[\s\S]*夏油杰的岛/.test(await E(`document.querySelector('.is-card').textContent`)), '切到夏油杰：极光');
  // 风景：每座岛一座随机拼的岛（时代 × 气候 × 地形 × 地标套件…），切换角色 / 重新打开 / 心情变化都会换
  const wd = id => E(`JSON.stringify((({ climate, terrain, mark, era }) => ({ climate, terrain, mark, era }))(core.D().isle.by[${id}].world))`);
  ok(JSON.parse(await wd('_b.id')).climate && /·/.test(await E(`document.querySelector('.is-caption').textContent`)), '每座岛都有一座风景（标题里写着气候 · 地标）');
  let changed = 0; for (let i = 0; i < 4; i++) { const was = await wd('_b.id'); await E(`core.home(); core.openApp('isle')`); await W(80); changed += (await wd('_b.id')) != was; }
  ok(changed == 4, '每次打开心屿都换一座岛'); await ready(); await p.waitForFunction('J().frames > 1', null, { timeout: 180000 });
  const pg0 = await E('PROG()'); for (let i = 0; i < 2; i++) { await E(`core.home(); core.openApp('isle')`); await ready(); await p.waitForFunction('J().frames > 1', null, { timeout: 180000 }); }
  await E(`document.querySelectorAll('.is-who b')[0].click()`); await ready(); await p.waitForFunction('J().frames > 1', null, { timeout: 180000 });
  ok(await E('PROG()') <= pg0 + 1, `重开、切角色都不重新编译着色器（程序数 ${pg0} → ${await E('PROG()')}）`);
  const fit = await E(`(() => { const e = jj._eng(), T = e.T, cv = document.querySelector('.isle canvas'), r = cv.getBoundingClientRect(); const pj = v => { const p = new T.Vector3(...v).project(e.cam); return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]; }; const c = pj([0, 0, 0]), top = pj([0, 1, 0]), bot = pj([0, -1, 0]); return { c: c[1] / r.height, top: top[1], bot: r.height - bot[1], h: r.height }; })()`);
  ok(Math.abs(fit.c - .5) < .05 && fit.top > 8 && fit.bot > 8 && Math.abs(fit.top - fit.bot) < fit.h * .1, `球在画布里居中、上下都没被切（上留 ${fit.top | 0}px，下留 ${fit.bot | 0}px）`);
  ok(await E(`document.querySelector('.isle canvas') === jj._eng().canvas && document.querySelectorAll('.isle canvas').length == 1`), '画布是常驻的那一块（不新建 WebGL）');
  await E(`document.querySelectorAll('.is-who b')[1].click()`); await ready(); // 切回夏油杰，后面接着测他
  const seen = await E(`(() => { const c = new Set(), m = new Set(), e = new Set(); for (let i = 0; i < 300; i++) { const r = gen.makeRecipe(i * 7919 + 3); c.add(r.climate); m.add(r.mark); e.add(r.era); } return [c.size, m.size, e.size]; })()`);
  ok(seen[0] >= 11 && seen[1] >= 17 && seen[2] == 3, `随机不限定几种：300 次抽到 ${seen[0]} 种气候、${seen[1]} 种地标、${seen[2]} 个时代`);
  ok(!(await E(`document.querySelector('.isle').textContent`)).match(/听风竹林|体感|花眠花园|果冻/) && !(await E(`!!document.querySelector('.is-bubble, .is-dot, [data-a=ismotion], [data-a=islandscape]')`)), '没有果冻颜色、风景选择、体感按钮和冒字气泡');
  // 戳：按住不动就在那里凹进去，松手弹回来
  const r = await p.locator('.isle canvas').boundingBox(), cx = r.x + r.width / 2, cy = r.y + r.height * .5;
  await p.mouse.move(cx + 40, cy - 10); await p.mouse.down(); await E('J().advance(.5)');
  ok((await G()).poke < .92, `按住不动：按的地方凹进去（离球心 ${(await G()).poke?.toFixed(2)}）`);
  await p.mouse.up(); await E('J().advance(2)');
  ok((await G()).dev < .05 && Math.abs((await G()).vol - 1) < .02, '松手：弹回圆的，体积没变');
  // 拉：抓住右边往外拉，球被拉长（果冻那样），松手晃回去
  await p.mouse.move(cx + r.width * .3, cy); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(cx + r.width * .3 + k * 20, cy); await E('J().advance(.6)');
  const stretched = (await G()).dev; await p.mouse.up(); await E('J().advance(.1)'); const wob = (await G()).dev; await E('J().advance(3)');
  ok(stretched > .15 && wob > .03 && (await G()).dev < .05, `拉：球被拉长（偏离 ${stretched.toFixed(2)}），松手先晃（${wob.toFixed(2)}）再回圆`);
  // 拖着转：往下拖到底，岛整个翻过来（岛的上方朝下）
  await p.mouse.move(cx, cy - 90); await p.mouse.down(); for (let k = 1; k <= 12; k++) await p.mouse.move(cx, cy - 90 + k * 35);
  ok((await G()).up[1] < 0, '拖着转：能把岛翻到朝下');
  await p.mouse.up(); await E('J().advance(.2)');
  const R0 = (await G()).right[0];
  await p.mouse.move(cx - 80, cy); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(cx - 80 + k * 18, cy);
  ok(await E(`core.top()?.cls == 'isle'`) && Math.abs((await G()).right[0] - R0) > .3, '横着拖：只转球，不会触发右滑返回把页面关掉');
  await p.mouse.up(); await E('J().advance(6)');
  ok((await G()).up[1] > .8, '放着不动：像不倒翁一样慢慢立回来');
  // 缩放：滚轮 / 双指捏合，和戳、拖互不干扰
  const z0 = (await G()).zoom; await p.mouse.move(cx, cy); await p.mouse.wheel(0, -300); await E('J().advance(1)');
  ok((await G()).zoom < z0 - .3, `滚轮：拉近（${z0.toFixed(2)} → ${(await G()).zoom.toFixed(2)}）`);
  await E(`(() => { const cv = document.querySelector('.isle canvas'), r = cv.getBoundingClientRect(), ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id == 1, clientX: r.left + x, clientY: r.top + y, bubbles: true }));
    ev('pointerdown', 1, r.width / 2 - 30, r.height / 2); ev('pointerdown', 2, r.width / 2 + 30, r.height / 2); for (let i = 1; i <= 6; i++) { ev('pointermove', 1, r.width / 2 - 30 + i * 4, r.height / 2); ev('pointermove', 2, r.width / 2 + 30 - i * 4, r.height / 2); } ev('pointerup', 1, 0, 0); ev('pointerup', 2, 0, 0); })()`); await E('J().advance(1)');
  ok((await G()).zoom > z0 - .3 + .2 && (await G()).poke == null, '双指捏合：拉远，而且第二根手指按下时不会当成戳');
  // 拍一下：像篮球一样弹起来乱蹦
  await E(`window.localCalls = 0; SillyTavern.getContext().generateRaw = async () => { localCalls++; throw Error('互动不应调用模型'); }`);
  await p.click('[data-a=isshake]'); await E('J().advance(.15)');
  ok(await (async () => { const s = await G(); return s.body.air && s.body.y > 0; })(), '摇一摇：球弹起来');
  await E('J().advance(6)');
  ok(!(await G()).body.air, '弹几下之后落回原地');
  ok(await E(`localCalls === 0`) && errs.length == 0, '戳、转、拍、缩放都不调用模型，也没有报错');
  // AI 导演：看看 TA 现在 带回风景词 → 岛按剧情拼；正文心情行第五段也是风景
  await E(`SillyTavern.getContext().generateRaw = async () => '{"mood":"安心","scene":"night","say":"今晚不想回去。","sea":0.2,"world":"雪原 木屋 松树 炉火 小狐狸"}'`);
  await E(`document.querySelector('[data-a=islook]').click()`); await W(600);
  const w1 = JSON.parse(await wd('_b.id'));
  ok(w1.climate == 'snow' && w1.mark == 'cabin' && await E(`core.D().isle.by[_b.id].world.animals.includes('fox') && core.D().isle.by[_b.id].world.extras.includes('bonfire')`), '看看 TA 现在：「雪原 木屋 松树 炉火 小狐狸」→ 雪原、木屋、篝火、小狐狸');
  await E(`(() => { const c = SillyTavern.getContext(); c.chat.push({ mes: '雨停了。\\n<手机>\\n心情|五条悟|雀跃|明天也来。|古寺 求签 枫叶 香炉 钟声\\n</手机>', is_user: false }); c.eventSource.emit('mr', c.chat.length - 1, 'normal'); })()`); await W(300);
  const w2 = JSON.parse(await wd('_a.id'));
  ok(await E(`core.D().isle.by[_a.id].mood == '雀跃' && core.D().isle.by[_a.id].say == '明天也来。'`) && w2.climate == 'autumn' && w2.mark == 'temple' && w2.era == 'ancient', '正文心情行第五段的风景词：「古寺 求签 枫叶 香炉」→ 枫林 · 古寺（古风）');
  ok(JSON.stringify(await E(`gen.hintOf('现代 深夜便利店 路灯 雨 自动贩卖机')`)).includes('"mark":"street"') && (await E(`gen.hintOf('医院走廊 消毒水')`)).mark == 'hospital' && (await E(`gen.hintOf('学校操场 夕阳')`)).mark == 'school', '剧情在便利店 / 医院 / 学校 → 对应的街道、医院、学校套件');
  await E(`document.querySelectorAll('.is-who b')[0].click()`); await ready(); await p.waitForFunction('J().frames > 0', null, { timeout: 180000 }); await shot('isle_temple.png');
  const st1 = await E('J().state.stats'); ok(st1.tris > 5000 && errs.length == 0, `古寺拼出来了：${st1.tris} 个三角面，没报错`);
  // 没有风景词时：角色卡是现代的就偏现代，古风的就偏古风（本地认关键词，不调模型）
  ok(await E(`gen.eraOf('她掏出手机看了眼微信，公司群里又在加班。地铁到站，便利店的灯还亮着，电梯里全是外卖味。') == 'modern' && gen.eraOf('王爷掀开轿帘，侍卫跪了一地。江湖传言门派之争已到朝廷，客栈里书生们议论纷纷。') == 'ancient' && gen.eraOf('你好呀') == ''`), '本地认时代：手机 / 地铁 / 便利店 → 现代；王爷 / 江湖 / 客栈 → 古风');
  const eras = await E(`(() => { let m = 0; for (let i = 0; i < 40; i++) if (gen.makeRecipe(i * 31 + 5, { era: 'modern' }).era == 'modern') m++; let a = 0; for (let i = 0; i < 40; i++) if (gen.makeRecipe(i * 31 + 5, { era: 'ancient' }).era == 'ancient') a++; return [m, a]; })()`);
  ok(eras[0] >= 36 && eras[1] >= 36, `偏时代：要现代就 ${eras[0]}/40 次是现代场景，要古风就 ${eras[1]}/40 次是古风场景`);
  ok(await E(`localCalls === 0`), '认时代、挑风景都没调用模型');
  // 心情格式一直在提示词里（没有「跟着剧情变」开关了）
  await E(`core.saveD()`); await W(300);
  ok(!(await E(`!!document.querySelector('.isle [data-a=isset]')`)) && /心情\|谁\|心情词\|没说出口的一句话\|TA心里那座岛此刻的风景[\s\S]*季节[\s\S]*古寺 求签/.test(await E(`ep.at(-1) || ''`)), '没有「跟着剧情变」开关，提示词里一直带着心情格式（风景词要写时代、季节和地点）');
  // 潮汐记录
  await E(`document.querySelector('[data-a=ishist]').click()`); await W(400);
  ok(await E(`document.querySelectorAll('.is-h').length`) == 2 && /雀跃[\s\S]*枫林 · 古寺/.test(await E(`document.querySelector('.is-hist').textContent`)), '潮汐记录：两条，带当时的风景');
  console.log('errors:', errs.length ? errs : 'none', `\n${pass} passed, ${fail} failed`); await b.close(); srv.close(); })();
