// Harness: minimal DOM shim + mock SillyTavern + mock fetch, then exercise the real modules.
import fs from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname, ROOT = new URL('../../', import.meta.url).pathname; // 插件代码直接从仓库根目录加载
class CL { constructor() { this.s = new Set(); } add(...a) { a.forEach(x => this.s.add(x)); } remove(...a) { a.forEach(x => this.s.delete(x)); } toggle(x, v) { (v ?? !this.s.has(x)) ? this.s.add(x) : this.s.delete(x); return this.s.has(x); } contains(x) { return this.s.has(x); } }
class El {
  constructor(t) { this.tag = t; this.children = []; this.classList = new CL(); this.style = { setProperty() {} }; this.dataset = {}; this._h = ''; this.textContent = ''; }
  set className(v) { this.classList = new CL(); String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c)); } get className() { return [...this.classList.s].join(' '); }
  set innerHTML(v) { this._h = v; } get innerHTML() { return this._h; }
  append(...c) { c.forEach(x => { x.parentElement = this; this.children.push(x); }); } remove() { const p = this.parentElement; p && (p.children = p.children.filter(x => x !== this)); }
  get lastElementChild() { return this.children.at(-1); }
  querySelector(s) { return (this._q ||= {})[s] ||= new El('q'); } querySelectorAll() { return []; } addEventListener() {} contains() { return false; } getBoundingClientRect() { return { width: 1, height: 1, top: 0, left: 0 }; }
}
globalThis.document = { createElement: t => new El(t), body: new El('body'), querySelector: () => null };
globalThis.requestAnimationFrame = f => setTimeout(f, 0);
globalThis.localStorage = {};
globalThis.location = { origin: 'http://localhost:8000' };
let played = 0; globalThis.Audio = class { play() { played++; return Promise.resolve(); } pause() {} };
const toasts = []; globalThis.toastr = { error: (m) => toasts.push(m) };
const ctx = { extensionSettings: {}, chatMetadata: {}, saveSettingsDebounced() {}, saveMetadataDebounced() {}, name1: '徐照临', name2: '灰吕杵志', chat: [{ name: '灰吕杵志', mes: '今天文化祭。' }], characters: [{ description: '角色描述', personality: '' }], characterId: 0, setExtensionPrompt() {}, substituteParams: s => s, powerUserSettings: {}, getRequestHeaders: () => ({ 'X-CSRF-Token': 't', 'Content-Type': 'application/json' }) };
globalThis.SillyTavern = { getContext: () => ctx };

// ---- mock fetch ----
const realFetch = globalThis.fetch; let routes = []; const calls = [];
globalThis.fetch = async (url, o = {}) => {
  url = String(url); if (url.startsWith('data:')) return realFetch(url);
  const c = { url, o, body: o.body && JSON.parse(o.body) }; calls.push(c);
  for (const [re, fn] of routes) if (re.test(url)) return fn(c);
  throw new TypeError('fetch failed (no route) ' + url);
};
const sse = (chunks, gap = 30, hang = false, sig) => new Response(new ReadableStream({
  async start(ctl) { for (const ch of chunks) { await new Promise(r => setTimeout(r, gap)); if (sig?.aborted) return; ctl.enqueue(new TextEncoder().encode(ch)); } if (!hang) ctl.close(); },
}), { headers: { 'content-type': 'text/event-stream' } });
const ev = o => `data: ${JSON.stringify(o)}\n\n`;
const dc = (content, reasoning) => ev({ choices: [{ delta: { ...(content && { content }), ...(reasoning && { reasoning_content: reasoning }) } }] });

const core = await import(ROOT + 'core.js');
core.initS();
const { S, D, LOG, ui, APPS, top } = core;
await import(ROOT + 'apps/settings/settings.js');
const chat = await import(ROOT + 'apps/chat/chat.js');
const dataMod = await import(ROOT + 'apps/chat/data.js'); chat.GC.review = st => dataMod.applyDelta({ contacts: st.c, groups: st.g }); // 测试里确认卡直接全部添加
Object.assign(ui, { root: new El('div'), scr: new El('div'), desk: new El('div'), stack: new El('div'), sheets: new El('div'), tasks: new El('div') });
ui.root.classList.add('on');

let pass = 0, failN = 0; const ok = (c, m) => { c ? pass++ : failN++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
S.api.chat = { src: 'custom', cur: 'a', list: [{ id: 'a', name: '公益站', url: 'https://relay.test/v1', key: 'k', model: 'glm-5.3-flash' }] };

console.log('T1 log appears at start, streaming + think-off fallback, incremental contacts');
{
  let n400 = 0;
  const lines = ['人|沈知遥|遥遥无期|沈学长|男|今天也在图书馆\n', '人|周小满|满满|小满|女|奶茶续命\n人|林', '老师|林间|林老师|女|批改中\n', '群|高三(2)班|林老师|周小满|沈知遥,周小满,徐照临|周五前交志愿表\n', '群|奶茶同好会|周小满||沈知遥|周末拼单'];
  routes = [[/relay\.test\/v1\/chat\/completions/, c => { if (c.body.thinking) { n400++; return new Response('{"error":"unknown field thinking"}', { status: 400 }); } return sse([dc('', '让我想想'), dc('', '谁是好友'), ...lines.map(l => dc(l)), 'data: [DONE]\n\n'], 60, false, c.o.signal); }]];
  const progs = [], seen = [];
  const pr = chat.genContacts('SYS', 'PROMPT', '生成联系人', undefined, s => progs.push(s));
  await sleep(5);
  ok(LOG[0]?.run === 1 && LOG[0].desc == '生成联系人', 'log entry exists immediately with run=1');
  const iv = setInterval(() => seen.push(D().chats.filter(c => c.type == 'p' && c.fr !== 0).length), 40);
  const msg = await pr; clearInterval(iv);
  ok(n400 === 1 && calls.filter(c => /chat\/completions/.test(c.url)).length === 2, 'thinking-off rejected with 400 → retried without it');
  ok(calls.at(-1).body.stream === true && !('thinking' in calls.at(-1).body), 'retry is streaming and has no thinking param');
  ok(seen.length > 3 && seen.every(x => x == 0), 'nothing enters the contact list while generating (staged until confirm)');
  ok(progs.some(p => p.startsWith('模型思考中')) && progs.some(p => p.startsWith('已收到')), 'progress text: ' + [...new Set(progs)].slice(0, 4).join(' / '));
  const ps = D().chats.filter(c => c.type == 'p'), g = D().chats.find(c => c.name == '高三(2)班');
  ok(ps.length == 3 && ps.find(c => c.real == '沈知遥').sex == '男' && ps.find(c => c.real == '沈知遥').remark == '沈学长', 'contacts parsed with remark + sex');
  ok(g && g.members.length == 3 && g.admins.length == 1 && !g.members.some(i => D().chats.find(c => c.id == i)?.real == '徐照临'), 'group: owner/admin/members ok, user excluded');
  ok(D().chats.find(c => c.name == '奶茶同好会'), 'last line without trailing newline still parsed');
  ok(/已生成 3 位联系人 · 2 个群/.test(msg), 'result: ' + msg);
  ok(LOG[0].run === 0 && LOG[0].ok === 1 && LOG[0].ms > 0 && LOG[0].res.includes('人|沈知遥'), 'log updated in place to success with response');
}

console.log('T2 idle timeout keeps partial results + failure is reported');
{
  S.tmo = 1; const before = D().chats.length;
  routes = [[/relay\.test/, c => sse([dc('人|赵一|一一|赵哥|男|在加班\n'), dc('人|钱')], 50, true, c.o.signal)]];
  let err; try { await chat.genContacts('SYS', 'P', '生成联系人', undefined); } catch (e) { err = e; }
  ok(err && /超时（1秒没有收到任何返回）/.test(err.message) && /已生成的 1 位联系人/.test(err.message), 'error: ' + err?.message);
  ok(D().chats.length == before + 1, 'partial contact kept');
  ok(LOG[0].run === 0 && !LOG[0].ok && LOG[0].res.includes('✗ 超时'), 'log shows failure with reason');
  S.tmo = 300;
}

console.log('T3 slow-but-flowing stream is NOT killed by timeout (idle-based)');
{
  S.tmo = 1;
  routes = [[/relay\.test/, c => sse(Array.from({ length: 8 }, (_, i) => dc('片段' + i)), 400, false, c.o.signal)]];
  const t0 = Date.now(); const r = await core.llm('s', 'u', '聊天回复');
  ok(r == Array.from({ length: 8 }, (_, i) => '片段' + i).join('') && Date.now() - t0 > 3000, `3.2s total stream finished with 1s idle limit (${Date.now() - t0}ms)`);
  S.tmo = 300;
}

console.log('T4 non-stream JSON reply, cancel, task failure notice');
{
  routes = [[/relay\.test/, () => new Response(JSON.stringify({ choices: [{ message: { content: '你好' } }] }), { headers: { 'content-type': 'application/json' } })]];
  ok(await core.llm('s', 'u') == '你好', 'server ignoring stream → JSON parsed');
  routes = [[/relay\.test/, c => sse([dc('a')], 50, true, c.o.signal)]];
  const ac = new AbortController(); setTimeout(() => ac.abort(), 200);
  let e; try { await core.llm('s', 'u', 'x', ac.signal); } catch (x) { e = x; } ok(e?.message == '已取消', 'cancel → 已取消');
  // stop from log page
  const p = core.llm('s', 'u', 'y'); await sleep(80); core.stopCall(LOG[0].id); try { await p; } catch (x) { e = x; } ok(e?.message == '已手动中止', 'stop from log → 已手动中止');
  // task failure bar persists + toastr when phone hidden
  routes = [[/relay\.test/, () => new Response('bad gateway', { status: 502 })]];
  ui.root.classList.remove('on');
  await core.task('AI 正在生成联系人', sg => core.llm('s', 'u', 'z', sg));
  const bar = ui.tasks.children.at(-1);
  ok(bar.className == 'tk err' && /AI 正在生成联系人失败：HTTP 502/.test(bar.innerHTML) && /日志/.test(bar.innerHTML), 'error bar with 日志 button');
  await sleep(4500); ok(ui.tasks.children.includes(bar), 'error bar still there after 4.5s (no auto-dismiss)');
  ok(toasts.some(t => /HTTP 502/.test(t)), 'toastr notice when phone is closed');
  core.fail('同样的错'); core.fail('同样的错'); ok(ui.tasks.children.filter(x => x.dataset.m == '同样的错').length == 1, 'duplicate failures merged');
  ui.root.classList.add('on');
}

console.log('T5 CORS fallback via /proxy/');
{
  routes = [[/^\/proxy\/https:\/\/api\.minimaxi\.com/, c => new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: '494433' } }), { headers: { 'content-type': 'application/json' } })], [/^https:\/\/api\.minimaxi/, () => { throw new TypeError('Failed to fetch'); }]];
  S.api.tts = { src: 'custom', cur: 't', list: [{ id: 't', prov: 'mm', key: 'mk', model: 'speech-2.6-hd', vm: 'male-qn-jingying', vf: 'female-yujie' }] };
  const r = await core.tts('你好', '', '男');
  const c = calls.at(-1);
  ok(c.url == '/proxy/https://api.minimaxi.com/v1/t2a_v2' && c.o.headers['X-CSRF-Token'] == 't' && c.o.headers.Authorization == 'Bearer mk', 'retried through ST proxy with CSRF + auth');
  ok(c.body.voice_setting.voice_id == 'male-qn-jingying' && c.body.model == 'speech-2.6-hd', 'male fallback voice used for 男 contact');
  routes = [[/^\/proxy\//, () => new Response('CORS proxy is disabled. Enable it in config.yaml', { status: 404 })], [/api\.minimaxi/, () => { throw new TypeError('Failed to fetch'); }]];
  let e; try { await core.tts('你好'); } catch (x) { e = x; } ok(/连不上 api\.minimaxi\.com/.test(e?.message) && /enableCorsProxy/.test(e.message), 'proxy disabled → friendly message');
}

console.log('T6 TTS providers');
{
  const P = o => (S.api.tts = { src: 'custom', cur: 't', list: [{ id: 't', key: 'K', ...o }] });
  const au = new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } });
  P({ prov: 'mmi', vf: 'female-shaonv' }); routes = [[/api\.minimax\.io\/v1\/t2a_v2/, () => new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: 'fffb9064' } }))]];
  ok(/已播放/.test(await core.tts('嗨', '', '女')) && calls.at(-1).body.voice_setting.voice_id == 'female-shaonv', 'MiniMax国际 hex audio, female fallback');
  routes = [[/minimax/, () => new Response(JSON.stringify({ base_resp: { status_code: 1004, status_msg: 'auth failed' } }))]];
  let e; try { await core.tts('嗨'); } catch (x) { e = x; } ok(/MiniMax 1004：auth failed/.test(e?.message), 'MiniMax error surfaced');
  P({ prov: 'volc', appid: '123', res: 'seed-tts-2.0', voice: 'zh_female_xiaohe_uranus_bigtts', speed: 1.2 });
  routes = [[/openspeech\.bytedance\.com\/api\/v3\/tts\/unidirectional/, () => new Response(`{"code":0,"data":"${btoa('ab')}"}\n{"code":0,"data":"${btoa('cd')}"}{"code":20000000,"data":null}`)]];
  await core.tts('嗨'); let c = calls.at(-1);
  ok(c.o.headers['X-Api-App-Id'] == '123' && c.o.headers['X-Api-Access-Key'] == 'K' && c.o.headers['X-Api-Resource-Id'] == 'seed-tts-2.0' && c.body.req_params.speaker == 'zh_female_xiaohe_uranus_bigtts' && c.body.req_params.audio_params.speech_rate == 20, '火山 V3 headers/body');
  routes = [[/openspeech/, () => new Response('{"code":55000000,"message":"resource ID is mismatched"}')]]; try { await core.tts('嗨'); } catch (x) { e = x; } ok(/火山 55000000/.test(e?.message), '火山 error surfaced');
  P({ prov: 'volc', ver: 'v1', appid: '1', voice: 'BV001' }); routes = [[/api\/v1\/tts/, () => new Response(JSON.stringify({ code: 3000, data: btoa('xyz') }))]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.o.headers.Authorization == 'Bearer;K' && c.body.app.cluster == 'volcano_tts' && c.body.request.operation == 'query', '火山 V1');
  P({ prov: 'mimo' }); routes = [[/api\.xiaomimimo\.com\/v1\/chat\/completions/, () => new Response(JSON.stringify({ choices: [{ message: { audio: { data: btoa('mp3') } } }] }))]];
  await core.tts('嗨', '冰糖'); c = calls.at(-1); ok(c.body.model == 'mimo-v2.5-tts' && c.body.messages[0].role == 'assistant' && c.body.audio.voice == '冰糖', 'MiMo body, contact voice wins');
  P({ prov: 'fish', voice: 'ref123' }); routes = [[/api\.fish\.audio\/compat\/v1\/audio\/speech/, () => au.clone()]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.body.voice == 'ref123' && c.body.model == 'fish-audio/s2.1-pro' && c.body.input == '嗨' && c.o.headers.Authorization == 'Bearer K', 'Fish Audio（网页接口，浏览器可直连）');
  P({ prov: 'eleven' }); routes = [[/api\.elevenlabs\.io\/v1\/text-to-speech\//, () => au.clone()]];
  await core.tts('嗨', '', '男'); c = calls.at(-1); ok(/text-to-speech\/EXAVITQu4vr4xnSDxMaL\?/.test(c.url) && c.o.headers['xi-api-key'] == 'K' && c.body.model_id == 'eleven_multilingual_v2', 'ElevenLabs（男声默认空着 → 用服务商的音色 ID）');
  ok(core.PDEF.tts.mm.vm == null && core.PDEF.tts.eleven.vf == null, '男 / 女默认音色不再预填');
  // 官方服务商：地址固定官方（以前填的中转挪到「第三方」）
  S.api.tts = { src: 'custom', pv: 'fish', cfg: { fish: { key: 'K', url: 'https://my-relay.test', voice: 'r1', vm: 'male-qn-qingse' }, mm: { key: 'M', url: 'https://api.minimaxi.com/' } } }; core.prof('tts');
  const T = S.api.tts; ok(T.pv == 'fish' && T.cfg.fish.url == 'https://my-relay.test' && !T.cfg.third && T.cfg.fish.vm == '' && T.fb === true, '升级：填过的接口地址保留；预填的男 / 女默认音色清空；默认用全局默认音色');
  routes = [[/my-relay\.test\/compat\/v1\/audio\/speech/, () => au.clone()]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.url == 'https://my-relay.test/compat/v1/audio/speech' && c.body.voice == 'r1', 'Fish 改了接口地址就用改的');
  T.pv = 'third'; T.cfg.third = { prov: 'third', fmt: 'mm', url: 'https://mm-relay.test', key: 'X', voice: 'v9' }; routes = [[/mm-relay\.test\/v1\/t2a_v2/, () => new Response(JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: 'fffb9064' } }))]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.url == 'https://mm-relay.test/v1/t2a_v2' && c.body.voice_setting.voice_id == 'v9', '第三方（MiniMax 格式）');
  T.pv = 'openai'; T.cfg.openai = { key: 'O', voice: 'nova' }; routes = [[/(api\.openai\.com|oa\.test)\/v1\/audio\/speech/, () => au.clone()]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.url == 'https://api.openai.com/v1/audio/speech', '没改接口地址：用官方地址');
  T.cfg.openai.url = 'https://oa.test/v1'; await core.tts('嗨'); c = calls.at(-1); ok(c.url == 'https://oa.test/v1/audio/speech', '改了接口地址：用改的'); T.cfg.openai.url = '';
  // 没配音色的联系人：开了全局默认音色就用男 / 女默认，关了就不读
  T.cfg.openai.vm = 'onyx'; const man = { sex: '男', tv: {} };
  await core.tts('嗨', '', '', undefined, { c: man }); c = calls.at(-1); ok(c.body.voice == 'onyx', '全局默认音色开着：男性联系人用男声默认');
  T.fb = false; let e2; try { await core.tts('嗨', '', '', undefined, { c: man }); } catch (x) { e2 = x; } ok(/还没给 TA 配音色/.test(e2?.message), '全局默认音色关了：没配音色的联系人不读');
  man.tv = { v: { openai: 'echo' } }; await core.tts('嗨', '', '', undefined, { c: man }); c = calls.at(-1); ok(c.body.voice == 'echo', '配了专属音色照常读'); T.fb = true;
  P({ prov: 'index', url: 'http://127.0.0.1:6006/audio/speech', voice: 'hutao' }); routes = [[/127\.0\.0\.1:6006\/audio\/speech/, () => au.clone()]];
  await core.tts('嗨'); c = calls.at(-1); ok(c.body.input == '嗨' && c.body.character == 'hutao', 'IndexTTS local');
  P({ prov: 'openai', url: 'https://api.openai.com/v1', voice: 'alloy' }); routes = [[/api\.openai\.com\/v1\/audio\/speech/, () => au.clone()]];
  await core.tts('嗨'); ok(calls.at(-1).body.voice == 'alloy', 'OpenAI TTS (old profiles without prov too)');
  P({ url: 'https://api.openai.com/v1' }); await core.tts('嗨'); ok(/audio\/speech/.test(calls.at(-1).url), 'legacy profile → openai');
}

console.log('T7 image providers');
{
  const P = o => (S.api.img = { src: 'custom', cur: 'i', auto: false, list: [{ id: 'i', key: 'K', ...o }] });
  const zipD = fs.readFileSync(DIR + 'deflate.zip'), zipS = fs.readFileSync(DIR + 'stored.zip'), png = fs.readFileSync(DIR + 'png.bin');
  for (const z of [zipD, zipS]) { const b = await core.unzip1(new Uint8Array(z)); ok(Buffer.from(await b.arrayBuffer()).equals(png), 'unzip1 ' + (z === zipD ? 'deflate' : 'stored')); }
  P({ prov: 'nai', model: 'nai-diffusion-4-5-full', size: '832x1216', pre: 'masterpiece', tag: false });
  routes = [[/image\.novelai\.net\/ai\/generate-image/, () => new Response(zipD)]];
  const r = await core.genImg('1girl, smile'); let c = calls.at(-1);
  ok(c.body.input == 'masterpiece, 1girl, smile' && c.body.parameters.v4_prompt.caption.base_caption == c.body.input && c.body.parameters.width == 832 && c.o.headers.Authorization == 'Bearer K', 'NAI v4.5 body + prefix');
  ok(typeof r == 'string' && (r.startsWith('blob:') || r.startsWith('data:')), 'NAI returns usable image url');
  // tag conversion through chat model
  P({ prov: 'nai', tag: true }); S.api.chat.list[0].url = 'https://relay.test/v1';
  routes = [[/relay\.test/, () => sse([dc('1girl, school uniform,\nsmile')], 10)], [/novelai/, () => new Response(zipS)]];
  await core.genImg('一个穿校服微笑的女孩'); c = calls.at(-1); ok(c.body.input == 'masterpiece, best quality, very aesthetic, 1girl, school uniform, smile', 'Chinese → tags via chat model (+ NAI default prefix): ' + c.body.input);
  P({ prov: 'sd', url: 'http://127.0.0.1:7860', size: '512x768', model: 'anything-v5' }); routes = [[/sdapi\/v1\/txt2img/, () => new Response(JSON.stringify({ images: [Buffer.from(png).toString('base64')] }))]];
  await core.genImg('cat'); c = calls.at(-1); ok(c.body.width == 512 && c.body.override_settings.sd_model_checkpoint == 'anything-v5', '本地SD');
  P({ prov: 'sf', size: '1024x1024' }); routes = [[/api\.siliconflow\.cn\/v1\/images\/generations/, () => new Response(JSON.stringify({ images: [{ url: 'https://sf.test/a.png' }] }))], [/sf\.test/, () => new Response(png, { headers: { 'content-type': 'image/png' } })]];
  ok(!!(await core.genImg('cat')) && calls.find(c => /siliconflow/.test(c.url)).body.image_size == '1024x1024', '硅基流动');
  let polls = 0; P({ prov: 'comfy', url: 'http://127.0.0.1:8188', ckpt: 'sd15.safetensors', size: '512x768', neg: 'bad "quote"' });
  routes = [[/8188\/prompt/, () => new Response(JSON.stringify({ prompt_id: 'p1' }))], [/8188\/history\/p1/, () => new Response(JSON.stringify(++polls < 2 ? {} : { p1: { outputs: { 9: { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] } } } }))], [/8188\/view/, () => new Response(png, { headers: { 'content-type': 'image/png' } })]];
  await core.genImg('cat'); const wf = calls.find(c => /8188\/prompt/.test(c.url)).body.prompt;
  ok(wf[4].inputs.ckpt_name == 'sd15.safetensors' && wf[5].inputs.width === 512 && typeof wf[3].inputs.seed == 'number' && wf[7].inputs.text == 'bad "quote"' && polls == 2, 'ComfyUI workflow filled, polled, fetched');
  P({ prov: 'comfy', url: 'http://127.0.0.1:8188' }); let e; try { await core.genImg('cat'); } catch (x) { e = x; } ok(/模型文件名/.test(e?.message), 'ComfyUI without ckpt → clear error');
}

console.log('T8 settings UI: every provider form renders, switching provider swaps defaults');
{
  APPS.settings.open(); const set = top();
  for (const t of ['tts', 'img']) {
    S.api[t] = { src: 'custom', cur: '', list: [] }; set.acts.api(t); const pg = top();
    const list = t == 'tts' ? core.TTSP : core.IMGP;
    ok((t == 'tts' ? /语音渠道[\s\S]*角色库/.test(pg.el.innerHTML) && !/酒馆扩展/.test(pg.el.innerHTML) : /自选服务商/.test(pg.el.innerHTML)) && pg.el.innerHTML.includes('data-k="pv"'), t + (t == 'tts' ? ' page: 语音渠道 / 角色库（没有酒馆扩展）+ 服务商下拉框' : ' page: 酒馆扩展 / 自选服务商 + 服务商下拉框'));
    ok(S.api[t].pv == list[0][0], `${t} defaults to ${list[0][1]}`);
    for (const [k, label] of list) { S.api[t].pv = k; core.prof(t); pg.onChange('pv'); const h = pg.el.innerHTML; ok(h.includes(`value="${k}" selected`) && h.includes(`cfg.${k}.`) && !/undefined/.test(h), `${t}/${label} fields render`); }
    if (t == 'img') { S.api.img.pv = 'sd'; const c = core.prof('img'); ok(c.size == '512x768' && c.steps == 20 && c.url == 'http://127.0.0.1:7860', 'SD has its own defaults (size/steps/url)'); }
    if (t == 'tts') { S.api.tts.pv = 'volc'; core.prof('tts').ver = 'v1'; pg.onChange('cfg.volc.ver'); ok(pg.el.innerHTML.includes('Cluster'), 'volc V1 shows Cluster field'); }
    core.back();
  }
  // live log page
  set.acts.logs(); const lp = top(); ok(lp.isLog, 'log page open');
  routes = [[/relay\.test/, c => sse([dc('', '想'), dc('内容')], 300, false, c.o.signal)]];
  S.api.chat.src = 'custom'; const p = core.llm('s', 'u', '实时测试'); await sleep(50);
  ok(/实时测试/.test(lp.el.querySelector('.pg-b').innerHTML) && /进行中|等待返回|lstop/.test(lp.el.querySelector('.pg-b').innerHTML), 'running call visible in open log page with 中止');
  await p; await sleep(800); ok(/实时测试[\s\S]*?成功/.test(lp.el.querySelector('.pg-b').innerHTML), 'same entry flips to 成功');
}


console.log('T9 生成用模型 (aux) + thinking placeholder + migration');
{
  S.api.chat = { src: 'custom', cur: 'a', aux: 'q', list: [{ id: 'a', name: '公益站', url: 'https://relay.test/v1', key: 'k', model: 'glm-5.3-flash' }, { id: 'q', name: '快模型', url: 'https://fast.test/v1', key: 'k2', model: 'glm-4-flash' }] };
  routes = [[/fast\.test/, c => sse([dc('人|甲|甲甲|甲哥|男|在\n')], 10)], [/relay\.test/, c => sse([dc('', '想'.repeat(50)), dc('你好')], 10)]];
  calls.length = 0; await chat.genContacts('S', 'P', '生成联系人');
  ok(calls.some(c => /fast\.test/.test(c.url)) && !calls.some(c => /relay\.test/.test(c.url)) && LOG[0].src == '快模型', 'contacts generated with the aux model, log shows 快模型');
  calls.length = 0; await core.llm('s', 'u', '聊天回复'); ok(calls.every(c => /relay\.test/.test(c.url)), 'chat reply still uses main model');
  S.api.chat.aux = 'gone'; calls.length = 0; await core.llm('s', 'u', 'x', undefined, { aux: 1 }); ok(calls.every(c => /relay\.test/.test(c.url)), 'deleted aux profile → falls back to main');
  routes = [[/relay\.test/, c => sse([dc('', '想'.repeat(30))], 50, true, c.o.signal)]];
  const p = core.llm('s', 'u', '思考测试'); await sleep(200); ok(/模型正在思考，已经想了 30 字。这是模型内部的思考过程，不是返回结果/.test(LOG[0].res), 'running log explains thinking ≠ result'); core.stopCall(LOG[0].id); await p.catch(() => {});
  const ext = ctx.extensionSettings.st_phone; ext.scan = true; delete ext.ver; core.initS(); ok(core.S.scan === false && core.S.ver == 2, 'old users: auto story-sync switched off once by migration');
  core.S.scan = true; core.initS(); ok(core.S.scan === true, 'after migration, user can turn it back on');
}

console.log('T10 contacts within the deadline (time-scaled: backup 300ms, deadline 1500ms)');
{
  S.api.chat = { src: 'custom', cur: 'a', list: [{ id: 'a', name: '公益站', url: 'https://relay.test/v1', key: 'k', model: 'glm-5.3-flash' }] };
  ctx.loadWorldInfo = async n => ({ entries: { 1: { uid: 1, comment: '齐木楠雄', content: '姓名：齐木楠雄\n性别：男\n超能力者，表面平凡' }, 2: { uid: 2, comment: 'PK学园', content: '学校设定：私立高中' }, 3: { uid: 3, comment: '照桥心美', content: '性别：女 年龄16 完美美少女' }, 4: { uid: 4, comment: '世界观总览', content: '性格各异的人们' }, 5: { uid: 5, comment: '海藤瞬', content: '姓名：海藤瞬 性别：男', disable: true } } });
  S.wi.follow = false; S.wi.books = ['齐木']; ctx.chat = [{ name: '灰吕杵志', mes: '早' }, { name: '徐照临', is_user: true, mes: 'hi' }];
  const P = await chat.people();
  ok(P.map(p => p.n).join() == '灰吕杵志,齐木楠雄,照桥心美' && P[1].sex == '男' && P[2].sex == '女', 'local people list from world book (skips settings/disabled entries): ' + P.map(p => p.n + (p.sex || '')).join(' '));
  const think = (c, extra = '') => sse([...Array(200)].map((_, i) => dc('', i == 3 ? extra : '想想')), 25, true, c.o.signal);
  const fresh = () => { D().chats.length = 0; };
  const O = { lim: 1500, bk: 300, people: P, quick: { sys: 'QS', prompt: 'QP' } };
  // A main thinks forever → quick request wins
  fresh(); routes = [[/relay\.test/, c => c.body.messages[0].content == 'QS' ? sse([dc('人|齐木楠雄|kusuo|齐木|男|好麻烦\n人|照桥心美|心美♪|心美|女|\n')], 30, false, c.o.signal) : think(c)]];
  let t = Date.now(), r = await chat.genContacts('S', 'P', '生成联系人', undefined, null, O);
  ok(/已生成 2 位联系人/.test(r) && Date.now() - t < 1200, `A: slow main → quick request wins in ${Date.now() - t}ms: ${r}`);
  await sleep(50); ok(LOG.find(l => l.desc == '生成联系人')?.res.includes('已取消') && LOG.find(l => l.desc == '生成联系人·精简')?.ok, 'A: losing request cancelled, winner logged');
  // B both think forever, but main drafted a line in its thinking → harvested at deadline
  fresh(); routes = [[/relay\.test/, c => think(c, c.body.messages[0].content == 'S' ? '\n人|照桥心美|心美♪|心美|女|天使\n' : '')]];
  t = Date.now(); r = await chat.genContacts('S', 'P', '生成联系人', undefined, null, O);
  ok(/已生成 1 位联系人/.test(r) && /草稿/.test(r) && Date.now() - t < 1800, `B: harvested from thinking draft at deadline (${Date.now() - t}ms): ${r}`);
  // C both think forever, no drafts → world-book people added
  fresh(); routes = [[/relay\.test/, c => think(c)]];
  t = Date.now(); r = await chat.genContacts('S', 'P', '生成联系人', undefined, null, O);
  ok(/已生成 3 位联系人/.test(r) && /世界书人物/.test(r) && D().chats.find(c => c.real == '照桥心美')?.sex == '女' && Date.now() - t < 1800, `C: deadline → world-book people (${Date.now() - t}ms): ${r}`);
  // D main errors immediately → quick starts at once
  fresh(); routes = [[/relay\.test/, c => c.body.messages[0].content == 'QS' ? sse([dc('人|齐木楠雄|kusuo|齐木|男|\n')], 20) : new Response('busy', { status: 503 })]];
  t = Date.now(); r = await chat.genContacts('S', 'P', '生成联系人', undefined, null, { ...O, bk: 5000 });
  ok(/已生成 1 位/.test(r) && Date.now() - t < 600, `D: main failed → backup immediately (${Date.now() - t}ms)`);
  // E cancel → no hang
  fresh(); routes = [[/relay\.test/, c => think(c)]]; const ac = new AbortController(); setTimeout(() => ac.abort(), 200);
  t = Date.now(); let e; try { await chat.genContacts('S', 'P', '生成联系人', ac.signal, null, O); } catch (x) { e = x; }
  ok(e?.message == '已取消' && Date.now() - t < 500 && !D().chats.length, `E: cancel returns promptly (${Date.now() - t}ms), no fallback added`);
  // F fast normal case unchanged
  fresh(); routes = [[/relay\.test/, c => sse([dc('', '想'), dc('人|齐木楠雄|kusuo|齐木|男|\n群|PK学园二年级|灰吕杵志||齐木楠雄|文化祭\n')], 20, false, c.o.signal)]];
  r = await chat.genContacts('S', 'P', '生成联系人', undefined, null, O); ok(/1 位联系人 · 1 个群/.test(r) && !/草稿|世界书/.test(r), 'F: normal fast reply unchanged: ' + r);
  await sleep(700); ui.sheets.children.length = 0;
}

console.log('T11 new contact line: remark / 拍一拍后缀 / 语言');
{
  const P = l => chat.pline(l)?.contacts?.[0];
  let c = P('人|齐木楠雄|kusuo|齐木🧊|男|的呆毛天线|中文|好麻烦');
  ok(c.remark == '齐木🧊' && c.ps == '的呆毛天线' && c.lang == '' && c.sign == '好麻烦', '8 fields parsed: ' + JSON.stringify(c));
  c = P('人|Emma|emma_w|Emma🍓|女|的金发|英语|hello world'); ok(c.lang == 'en', '英语 → en');
  c = P('人|佐藤|sato|佐藤|男|拍了拍佐藤的肩膀|日语|おはよう'); ok(c.lang == 'ja' && c.ps == '的肩膀', '日语 → ja, "拍了拍X" prefix stripped: ' + c.ps);
  c = P('人|甲|甲甲|甲|男|的头|今天好累'); ok(c.ps == '的头' && c.sign == '今天好累' && c.lang == '', 'language omitted (7 fields) → 7th field treated as signature');
  c = P('人|沈知遥|遥遥无期|沈学长|男|今天也在图书馆'); ok(c.sign == '今天也在图书馆' && !c.ps, 'old 6-field line still parsed correctly');
  D().chats.length = 0;
  applyAll: { const d = (await import(ROOT + 'apps/chat/data.js')); d.applyDelta(chat.pline('人|佐藤|sato|佐藤酱|男|的呆毛|日语|おはよう')); const x = D().chats[0]; ok(x.ps == '的呆毛' && x.cfg.lang == 'ja' && x.remark == '佐藤酱', 'saved: ps on contact, lang → chat settings cfg.lang'); x.cfg.lang = 'ko'; d.applyDelta(chat.pline('人|佐藤|sato|佐藤酱|男|的呆毛|日语|')); ok(x.cfg.lang == 'ko', 'existing language setting not overwritten'); }
  D().chats.length = 0;
}

console.log('T12 groups: titles + 群人数; main character first');
{
  const g = chat.pline('群|PK学园2年级|灰吕杵志|照桥心美|齐木楠雄:人间扫描仪,照桥心美:校花,海藤瞬（中二之王）,燃堂力|42|文化祭倒计时').groups[0];
  ok(g.size == 42 && g.members.join() == '齐木楠雄,照桥心美,海藤瞬,燃堂力' && g.titles['齐木楠雄'] == '人间扫描仪' && g.titles['海藤瞬'] == '中二之王' && !g.titles['燃堂力'] && g.notice == '文化祭倒计时', 'members with titles + size parsed: ' + JSON.stringify(g));
  const old = chat.pline('群|高三(2)班|林老师||沈知遥,周小满|周五前交志愿表').groups[0]; ok(!old.size && old.notice == '周五前交志愿表', 'old format (no size) still parsed');
  D().chats.length = 0; dataMod.applyDelta({ groups: [g] }); const x = D().chats.find(c => c.type == 'g'), id = n => D().chats.find(c => c.real == n).id;
  ok(x.size == 42 && dataMod.gsz(x) == 42 && x.titles[id('齐木楠雄')] == '人间扫描仪' && x.titles[id('海藤瞬')] == '中二之王', 'saved: size + titles on the group');
  ok(D().chats.filter(c => c.type == 'p').every(c => c.fr === 0), 'group-only members are not friends (fr=0)');
  D().chats.length = 0; ctx.name2 = '姜照临'; const P = await chat.people(); ok(P[0]?.n == '姜照临', 'main character is first in the people list: ' + P.map(p => p.n).join(','));
  ctx.name2 = '灰吕杵志';
}

console.log('T13 正文 <手机> 块：本地解析、不调 API、从正文去掉');
{
  D().chats.length = 0; D().posts.length = 0; const before = calls.length; let injected = '';
  ctx.setExtensionPrompt = (k, t) => injected = t; S.inline = true; core.syncInject();
  ok(/<手机同步格式>/.test(injected) && /私聊\|发送者\|接收者\|内容/.test(injected), 'instruction injected into the main prompt');
  ctx.name1 = '徐照临';
  ctx.chat = [{ name: '灰吕杵志', mes: '他低头看了眼手机，笑了笑。\n<手机>\n私聊|齐木楠雄|徐照临|明天别迟到\n群聊|PK学园2年级|照桥心美|大家早上好～\n朋友圈|燃堂力|今天的拉面超好吃！\n加好友|海藤瞬|漆黑之翼\n私聊|海藤瞬|照桥心美|这条我看不到\n转账|齐木楠雄|徐照临|52|咖啡果冻钱\n拍一拍|齐木楠雄|拍了拍你的脑袋\n私聊|徐照临|齐木楠雄|收到\n</手机>' }];
  ctx.chat[0].swipes = ['另一条 swipe', ctx.chat[0].mes]; ctx.chat[0].swipe_id = 1;
  let rendered = 0; ctx.updateMessageBlock = () => rendered++;
  const n = chat.inlineSync(0); await sleep(20);
  const qi = D().chats.find(c => c.real == '齐木楠雄'), g = D().chats.find(c => c.name == 'PK学园2年级');
  ok(qi && qi.msgs.map(m => m.t + ':' + m.c).join(' / ') == 'text:明天别迟到 / transfer:咖啡果冻钱 / pat:“齐木楠雄” 拍了拍你 / text:收到', 'private chat, transfer, pat and my own reply parsed: ' + qi?.msgs.map(m => m.t + ':' + m.c).join(' / '));
  ok(g && g.msgs[0].c == '大家早上好～' && D().posts[0]?.c == '今天的拉面超好吃！' && D().chats.find(c => c.real == '海藤瞬'), 'group message, 朋友圈, 加好友 parsed');
  ok(!D().chats.some(c => c.msgs?.some(m => m.c == '这条我看不到')), "messages between two other people are ignored (not on user's phone)");
  ok(ctx.chat[0].mes == '他低头看了眼手机，笑了笑。' && rendered == 1, '<手机> block removed from the story text and message re-rendered');
  ok(ctx.chat[0].swipes[1] == '他低头看了眼手机，笑了笑。' && ctx.chat[0].swipes[0] == '另一条 swipe', 'current swipe cleaned too, other swipes untouched');
  ok(calls.length == before && n >= 3, 'no API call made');
  ok(chat.inlineSync(0) == 0, 'second call finds nothing (no duplicates)');
  S.inline = false; core.syncInject(); ok(!/<手机同步格式>/.test(injected), 'turning it off removes the instruction');
  D().chats.length = 0; D().posts.length = 0;
}

console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
