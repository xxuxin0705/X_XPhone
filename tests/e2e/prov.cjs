// 生图 / 语音设置：服务商页（选服务商、各自保存、快选 / 拉取音色和模型、Fish 网页接口、ElevenLabs）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../..'), here = __dirname, OUT = path.join(__dirname, '../out'); fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = u == '/' ? path.join(here, 'st.html') : path.join(root, u); try { const b = fs.readFileSync(f); r.writeHead(200, { 'content-type': (f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html') + '; charset=utf-8' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(8784);
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const wav = () => { const n = 2400, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
const reqs = [];
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 }); await ctx.route(/fonts\.googleapis/, r => r.abort());
  await ctx.route(/api\.fish\.audio|api\.elevenlabs\.io/, r => { const q = r.request(), u = q.url(); reqs.push({ u, h: q.headers(), body: q.postData() });
    const J = o => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/compat\/v1\/models/.test(u)) return J({ data: [{ id: 'fish-audio/s2.1-pro' }, { id: 'fish-audio/s1' }] });
    if (/\/model\?/.test(u)) return J({ items: /self=true/.test(u) ? [{ _id: 'abc123', title: '我的小狐狸' }] : [] });
    if (/v2\/voices/.test(u)) return J({ voices: [{ voice_id: 'vvv1', name: 'Mira', labels: { gender: 'female' }, category: 'cloned' }] });
    if (/v1\/models/.test(u)) return J([{ model_id: 'eleven_v3', can_do_text_to_speech: true }, { model_id: 'eleven_english_sts_v2', can_do_text_to_speech: false }]);
    r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' }, body: wav() }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8784/'); await p.waitForFunction('window.booted'); await p.click('#stp-ball');
  const E = s => p.evaluate(s), W = ms => p.waitForTimeout(ms);
  // 旧版「渠道列表」数据 → 迁移
  await E(`(async () => { window.Audio = class { play() { return Promise.resolve(); } pause() {} }; window.core = await import('/core.js');
    core.S.api.tts = { src: 'custom', cur: 'x', list: [{ id: 'y', prov: 'mm', key: 'mmkey', model: 'speech-02-hd' }, { id: 'x', prov: 'fish', key: 'k1', model: 's1', voice: 'v1', vm: 'm1' }] };
    core.APPS.settings.open(); })()`); await W(600);
  ok(/Fish Audio/.test(await E(`document.querySelector('[data-a=api][data-x=tts]').textContent`)), '设置首页显示当前服务商 Fish Audio');
  await E(`document.querySelector('[data-a=api][data-x=tts]').click()`); await W(600);
  const v = await E(`JSON.stringify([document.querySelector('select[data-k=pv]').value, document.querySelector('[data-k="cfg.fish.key"]').value, document.querySelector('[data-k="cfg.fish.model"]').value, document.querySelector('[data-k="cfg.fish.voice"]').value])`);
  ok(v == JSON.stringify(['fish', 'k1', 's1', 'v1']), '旧配置迁移：服务商、Key、模型、音色都在 ' + v);
  ok(await E(`core.S.api.tts.cfg.mm.key`) == 'mmkey', '另一个旧渠道（MiniMax）的设置也保留了');
  ok(await E(`[...document.querySelectorAll('select[data-k=pv] option')].map(o => o.textContent.replace(/ ?✓/, '')).join()`) == 'MiniMax国内,MiniMax国际,OpenAI,Fish Audio,ElevenLabs,IndexTTS本地,MiMo-V2.5-TTS,豆包 / 火山引擎,第三方', '服务商列表（含 ElevenLabs）');
  await p.screenshot({ path: path.join(OUT, 'prov_fish.png') });
  // Fish：网页接口
  reqs.length = 0; await E(`document.querySelector('[data-a=try][data-x=voice]').click()`); await W(800);
  const f = reqs.find(r => /audio\/speech/.test(r.u)); const fb = f && JSON.parse(f.body);
  ok(f && f.u == 'https://api.fish.audio/compat/v1/audio/speech' && f.h.authorization == 'Bearer k1' && fb.model == 'fish-audio/s1' && fb.voice == 'v1' && fb.input && fb.response_format == 'mp3', 'Fish 试听走 /compat/v1/audio/speech：' + (f && f.body));
  ok(!reqs.some(r => /\/v1\/tts/.test(r.u)), '没有再请求跨域被拦的 /v1/tts');
  await E(`document.querySelector('[data-a=pullf][data-x=model]').click()`); await W(500);
  ok(await E(`[...document.querySelectorAll('.sheet.mnu .mi')].map(b => b.textContent).join()`) == 's2.1-pro,s1,取消', 'Fish 拉取模型（/compat/v1/models）');
  await p.click('.sheet.mnu .mi >> nth=0'); await W(300);
  ok(await E(`core.S.api.tts.cfg.fish.model`) == 's2.1-pro', '选中的模型写回 Fish 设置');
  await E(`document.querySelector('[data-a=pv][data-x=voice]').click()`); await W(500);
  ok(/我的小狐狸/.test(await E(`document.querySelector('.sheet.mnu').textContent`)), 'Fish 拉取「我的音色」'); await p.click('.sheet.mnu .mi >> nth=0'); await W(300);
  ok(await E(`core.S.api.tts.cfg.fish.voice`) == 'abc123', '音色 ID 填上拉取的音色');
  await E(`core.S.api.tts.cfg.fish.vf = 'abc123'; core.top().re()`); await W(200);
  // 切到 ElevenLabs
  await p.selectOption('select[data-k=pv]', 'eleven'); await W(500);
  ok(await E(`!!document.querySelector('[data-k="cfg.eleven.key"]') && document.querySelector('[data-k="cfg.eleven.voice"]').value`) == 'EXAVITQu4vr4xnSDxMaL', '切到 ElevenLabs：字段换成它自己的，默认音色 Sarah');
  await p.fill('[data-k="cfg.eleven.key"]', 'elk'); await p.press('[data-k="cfg.eleven.key"]', 'Tab'); await W(200);
  await E(`document.querySelector('[data-a=qv][data-x=voice]').click()`); await W(400);
  ok(/George · 男/.test(await E(`document.querySelector('.sheet.mnu').textContent`)), 'ElevenLabs 快选音色清单'); await p.click('.sheet.mnu .mi:has-text("George")'); await W(300);
  reqs.length = 0; await E(`document.querySelector('[data-a=test]').click()`); await W(900);
  const e = reqs.find(r => /text-to-speech/.test(r.u)), eb = e && JSON.parse(e.body);
  ok(e && /\/v1\/text-to-speech\/JBFqnCBsd6RMkjVDRZzb\?output_format=mp3_44100_128$/.test(e.u) && e.h['xi-api-key'] == 'elk' && eb.model_id == 'eleven_multilingual_v2' && eb.text, 'ElevenLabs 请求：' + (e && e.u));
  await E(`document.querySelector('[data-a=pullf][data-x=model]').click()`); await W(500);
  ok(await E(`[...document.querySelectorAll('.sheet.mnu .mi')].map(b => b.textContent).join()`) == 'eleven_v3,取消', 'ElevenLabs 拉取模型（只列能 TTS 的）'); await p.click('.sheet.mnu .mi.cancel'); await W(300);
  await E(`document.querySelector('[data-a=pv][data-x=voice]').click()`); await W(500);
  ok(/Mira · 女 · 我的/.test(await E(`document.querySelector('.sheet.mnu').textContent`)), 'ElevenLabs 拉取账号音色'); await p.click('.sheet.mnu .mi.cancel'); await W(300);
  await p.screenshot({ path: path.join(OUT, 'prov_eleven.png') });
  // 切回 Fish：之前填的还在
  await p.selectOption('select[data-k=pv]', 'fish'); await W(400);
  ok(await E(`document.querySelector('[data-k="cfg.fish.key"]').value`) == 'k1' && await E(`core.S.api.tts.cfg.eleven.voice`) == 'JBFqnCBsd6RMkjVDRZzb', '切回 Fish：Fish 的 Key 还在；ElevenLabs 的设置也保留');
  // 联系人专属音色 / 兜底：女性联系人走 vf
  reqs.length = 0; await E(`core.tts('测试', '', '女')`); await W(300);
  ok(JSON.parse(reqs.find(r => /audio\/speech/.test(r.u)).body).voice == 'abc123', '女性联系人没绑音色 → 用女声兜底');
  // 密码显示
  await E(`document.querySelector('.eye').click()`); ok(await E(`document.querySelector('[data-k="cfg.fish.key"]').type`) == 'text', 'Key 可以点「显示」看明文');
  // MiniMax 页
  await p.selectOption('select[data-k=pv]', 'mm'); await W(400); await p.screenshot({ path: path.join(OUT, 'prov_mm.png') });
  ok(await E(`document.querySelector('[data-k="cfg.mm.model"]').value`) == 'speech-02-hd', 'MiniMax 用迁移过来的旧模型');
  // 生图页
  await E(`core.back()`); await W(400); await E(`core.S.api.img = { src: 'custom', cur: '', list: [] }; document.querySelector('[data-a=api][data-x=img]').click()`); await W(600);
  ok(await E(`document.querySelector('select[data-k=pv]').value`) == 'nai' && await E(`!!document.querySelector('[data-k="cfg.nai.key"]') && document.querySelector('[data-k="cfg.nai.size"]').value`) == '832x1216', '生图页：默认 NovelAI，字段直接在页面上');
  ok(await E(`[...document.querySelectorAll('select[data-k=pv] option')].map(o => o.textContent).join()`) == 'NovelAI / NAI,GPT / OpenAI兼容,本地SD,ComfyUI,硅基流动', '生图供应商列表');
  await p.screenshot({ path: path.join(OUT, 'prov_img.png') });
  await p.selectOption('select[data-k=pv]', 'sf'); await W(400);
  ok(await E(`document.querySelector('[data-k="cfg.sf.model"]').value`) == 'Kwai-Kolors/Kolors', '切到硅基流动：默认模型 Kolors');
  // 生图：没有酒馆扩展；NAI / GPT 可以选官方 / 公益站 / 自定义；按应用选渠道
  await E(`core.home(); core.APPS.settings.open()`); await W(400); await E(`document.querySelector('[data-a=api][data-x=img]').click()`); await W(500);
  const ib = () => E(`document.querySelector('.pg.in:last-child .pg-b').textContent`);
  await p.selectOption('select[data-k=pv]', 'nai'); await W(400);
  ok(/生图渠道/.test(await ib()) && !/生图供应商|酒馆扩展|接口站点|官方站点|排队服务|中文描述/.test(await ib()), '生图：叫「生图渠道」；没有酒馆扩展、接口站点、排队服务、中文转标签');
  ok(await E(`document.querySelector('[data-k="cfg.nai.url"]').value`) == 'https://image.novelai.net' && !(await E(`document.querySelector('[data-k="cfg.nai.url"]').readOnly`)), '接口地址：默认填好官方地址，可以改');
  ok(/画师串[\s\S]*正面质量词[\s\S]*负面提示词/.test(await ib()), '有画师串、正面质量词、负面提示词');
  // 方案：默认一个，新建、切换、删除
  ok(await E(`[...document.querySelectorAll('.pchips .mchip')].map(b => b.textContent).join()`) == '默认方案,＋ 新建方案', '方案：一开始有「默认方案」');
  await p.fill('[data-k="cfg.nai.steps"]', '23'); await p.press('[data-k="cfg.nai.steps"]', 'Tab'); await W(200);
  await E(`document.querySelector('.pchips .mchip.add').click()`); await W(400); await p.fill('.sheet.in [data-k=n]', '厚涂'); await p.press('.sheet.in [data-k=n]', 'Tab'); await E(`document.querySelector('.sheet.in [data-a=ok]').click()`); await W(500);
  await p.fill('[data-k="cfg.nai.steps"]', '28'); await p.press('[data-k="cfg.nai.steps"]', 'Tab'); await p.fill('[data-k="cfg.nai.art"]', 'artist:thick'); await p.press('[data-k="cfg.nai.art"]', 'Tab'); await W(300);
  ok(await E(`[...document.querySelectorAll('.pchips .mchip')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join()`) == '默认方案,厚涂*,＋ 新建方案', '新建「厚涂」并切过去');
  await E(`document.querySelector('.pchips .mchip').click()`); await W(400);
  ok(await E(`document.querySelector('[data-k="cfg.nai.steps"]').value`) == '23' && await E(`document.querySelector('[data-k="cfg.nai.art"]').value`) == '', '切回默认方案：步数 23、没有画师串');
  await E(`document.querySelectorAll('.pchips .mchip')[1].click()`); await W(400);
  ok(await E(`document.querySelector('[data-k="cfg.nai.steps"]').value`) == '28' && await E(`document.querySelector('[data-k="cfg.nai.art"]').value`) == 'artist:thick', '切到厚涂：步数 28、画师串都回来了');
  await p.screenshot({ path: path.join(OUT, 'prov_img.png'), fullPage: true });
  const bx = await E(`(() => { const r = document.querySelectorAll('.pchips .mchip')[0].getBoundingClientRect(); return [r.left + 10, r.top + 8]; })()`);
  await p.mouse.move(...bx); await p.mouse.down(); await W(650); await p.mouse.up(); await W(300); await E(`document.querySelector('.sheet.mnu .mi.danger')?.click()`); await W(400);
  ok(await E(`core.S.api.img.cfg.nai.presets.map(x => x.n).join()`) == '厚涂', '长按删除方案');
  ok(/按应用选渠道[\s\S]*聊天（含朋友圈）/.test(await ib()) && !/朋友圈配图/.test(await ib()), '按应用选渠道：只有聊天（朋友圈跟着聊天走）');
  await p.screenshot({ path: path.join(OUT, 'prov_img.png') });
  await p.selectOption('select[data-k=pv]', 'sf'); await W(400);
  ok(await E(`document.querySelector('[data-k="cfg.sf.model"]').value`) == 'Kwai-Kolors/Kolors', '切到硅基流动：默认模型 Kolors');
  await p.selectOption('select[data-k=pv]', 'openai'); await W(400);
  ok(await E(`!!document.querySelector('[data-k="cfg.openai.omode"]')`), 'GPT：可以选生图接口 / 聊天接口');
  console.log('errors:', errs.join(' | ') || 'none'); console.log(`${pass} passed, ${fail} failed`); await b.close(); srv.close();
})();
