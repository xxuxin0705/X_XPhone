// 小手机 · 设置：API（聊天 / 生图渠道 / 语音渠道）/ 联动与时间 / 上下文与世界书 / 显示 / 日志 / 数据
import { C, S, D, G, $$, on, save, saveD, esc, uid, reg, page, top, fx, btn, sec, menu, form, ok, toast, sheet, llm, genImg, tts, models, voices, TCAT, PDEF, prof, stProfiles, stProf, stCurName, LOG, saveLog, stopCall, TTSP, TURL, TFMT, tq, IMGP, IURL, iq, APPS_IMG, APPS_TTS, recent, now, scanTime, wiBooks, allBooks, loadBook, entState, pickFile, emit, task } from '../../core.js';
import { syncStory } from '../chat/chat.js';
import { drop, migrateMedia, MDIR, openApp } from '../../core.js';
import { lock, askPin, askFp, wpName, lockMig } from '../../lock.js';
import { libList, voicePage, people } from '../chat/voice.js';
import { ballPicker, ballUrl, ballName } from '../../ball.js';
import { localSearch, storePage, packMeta, rmPack } from '../chat/sticker.js';

const T = { chat: '聊天模型', img: '生图', tts: '语音 TTS' };
const rf = () => setTimeout(() => top()?.re());
const PV = { img: IMGP, tts: TTSP }, pn = (t, k) => PV[t]?.find(x => x[0] == (k || 'openai'))?.[1] || '';
const sub = (a, x) => a == 'api' ? (x == 'chat' && S.api[x].src == 'tavern' ? (x == 'chat' && stProf(S.api.chat.stp) ? '酒馆 · ' + (stProf(S.api.chat.stp).name || '连接配置') : '酒馆') : x != 'chat' ? prof(x).name : prof(x) ? prof(x).name || '未命名' : '未选择') : a == 'link' ? (S.mode == 'linked' ? '正文联动' : '线上模式') : a == 'ctx' ? S.ctxN + ' 条' : a == 'disp' ? '' : a == 'logs' ? (LOG.some(l => l.run) ? '进行中 · ' : '') + LOG.length : a == 'stkp' ? S.stk.packs.length + ' 组' + (S.stk.auto ? '' : ' · 不自动配图') : a == 'lockp' ? (S.lock.on ? (S.lock.pw ? (S.lock.type == 'fp' ? '指纹' : '数字密码') : '无密码') : '未开启') : '';
const ROWS = [['API 配置', [['api', 'chat', '#34c759', '✦'], ['api', 'img', '#ff9f0a', '✿'], ['api', 'tts', '#5e5ce6', '♪']]],
  ['剧情', [['link', '联动模式与时间', '#ff375f', '⇄'], ['ctx', '上下文与世界书', '#0a84ff', '❖']]],
  ['安全', [['lockp', '锁屏与密码', '#ff9500', '⚿']]],
  ['通用', [['disp', '显示方式', '#64d2ff', '▣'], ['logs', '调用日志', '#8e8e93', '≡'], ['data', '数据管理', '#30b0c7', '⇪']]]];

reg({
  id: 'settings', name: '设置', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  open: () => page({
    title: '设置', cls: 'set',
    body: () => ROWS.map(([h, rs]) => `<h6>${h}</h6><div class="card">${rs.map(([a, x, c, i]) => `<div class="row go" data-a="${a}" data-x="${a == 'api' ? x : ''}"><i class="ri" style="background:${c}">${i}</i><span>${T[x] || x}</span><small>${esc(sub(a, x))}</small></div>`).join('')}</div>`).join(''),
    acts: { api, link, ctx, disp, logs, data, lockp, stkp },
  }),
});

/* ---------- 渠道：新建时的默认值 / 各渠道要填的字段 ---------- */
const PD = PDEF;
const OU = ['url', '接口地址', 'official'], K = (l = 'API Key') => ['key', l, 'password'], U = ph => ['url', '接口地址', 'text', ph], M = ph => ['model', '模型', 'text', ph], N = (k, l, ph = '') => [k, l, 'number', ph];
const TF = { // 语音：模型、音色另外画（带快速选择 / 拉取 / 试听）
  mm: () => [OU, K(), ['gid', 'GroupId（可选）'], N('speed', '语速', '1')],
  mmi: () => [OU, K(), ['gid', 'GroupId（可选）'], N('speed', '语速', '1')],
  openai: () => [OU, K()],
  fish: () => [OU, K()],
  eleven: () => [OU, K(), N('speed', '语速', '1')],
  index: () => [U('http://127.0.0.1:6006/audio/speech'), K('Key（可空）')],
  mimo: () => [OU, K()],
  third: m => [['fmt', '接口格式', 'sel', TFMT], U('https://你的中转地址'), K(), ...(m.fmt == 'mm' ? [['gid', 'GroupId（可选）']] : []), N('speed', '语速', '1')],
  volc: m => [OU, ['appid', 'App ID'], K('Access Token'), ['ver', '接口版本', 'sel', [['v3', 'V3 单向流式（2.0音色，推荐）'], ['v1', 'V1 旧版']]], m.ver == 'v1' ? ['cluster', 'Cluster', 'text', 'volcano_tts'] : ['res', '资源ID', 'text', 'seed-tts-2.0（复刻音色用 seed-icl-2.0）'], N('speed', '语速', '1')],
};
const VPH = { mm: 'female-shaonv（系统音色或复刻音色ID）', mmi: 'female-shaonv', openai: 'alloy / nova / onyx…', fish: '音色模型ID（reference_id）', index: '参考音色 / 角色名', mimo: 'mimo_default / 冰糖 / 茉莉 / 苏打 / 白桦 / Mia / Chloe / Milo / Dean', volc: 'zh_female_xiaohe_uranus_bigtts' };
const NAIM = [['nai-diffusion-4-5-full', 'V4.5 Full'], ['nai-diffusion-4-5-curated', 'V4.5 Curated'], ['nai-diffusion-4-full', 'V4 Full'], ['nai-diffusion-4-curated-preview', 'V4 Curated'], ['nai-diffusion-3', 'V3 Anime']];
const SZ = ['size', '尺寸（宽x高）'], ST = N('steps', '步数'), CF = N('scale', 'CFG'), SP = ['sampler', '采样器'], NG = ['neg', '负面提示词', 'area', '留空用内置'];
// 生图：上面是连接（接口地址默认填官方的、可以改 + Key），下面是「方案」（模型、尺寸、步数、CFG、采样器、画师串、正面质量词、负面提示词…）
const IU = ['url', '接口地址', 'official'], ART = ['art', '画师串', 'area', '如：artist:xxx, artist:yyy'], QL = ['pre', '正面质量词', 'area', '自动加在每次提示词前面'];
const IF = {
  nai: () => [IU, K(), ['model', '模型', 'sel', NAIM], SZ, ST, CF, SP, ART, QL, NG],
  openai: () => [IU, K(), ['omode', '请求方式', 'sel', [['img', '生图接口（images/generations）'], ['chat', '聊天接口（chat/completions）']]], ['model', '模型', 'pull', 'gpt-image-1'], SZ],
  sd: () => [IU, ['model', '底模（空=当前）', 'pull'], SZ, ST, CF, SP, ART, QL, NG],
  comfy: () => [IU, ['ckpt', '底模文件名', 'pull'], SZ, ST, CF, SP, ART, QL, NG, ['wf', '自定义工作流（可空）', 'area', 'ComfyUI「导出(API)」的 JSON。占位符：%prompt% %negative_prompt% %seed% %width% %height% %steps% %scale% %sampler% %model%']],
  sf: () => [IU, K(), M('Kwai-Kolors/Kolors'), SZ, ST, CF, NG],
};
const CONN = ['url', 'key', 'omode']; // 不算方案的（连接）
const pkeys = pv => IF[pv]().map(f => f[0]).filter(k => k && !CONN.includes(k));
// 方案：没有就用现在的设置建一个「默认方案」
const presets = (c, pv) => { if (!c.presets?.length) { const id = uid(); c.presets = [{ id, n: '默认方案', v: Object.fromEntries(pkeys(pv).map(k => [k, c[k] ?? ''])) }]; c.pid = id; } c.presets.some(x => x.id == c.pid) || (c.pid = c.presets[0].id); return c.presets; };
const TIP = {
  img: { nai: 'NAI 要求尺寸面积 ≤ 1024×1024、步数 ≤ 28 才不额外扣点。', sd: 'WebUI 启动参数加 --api --cors-allow-origins=*', comfy: 'ComfyUI 启动参数加 --enable-cors-header *', sf: '返回的图片链接1小时过期，小手机会自动转存。', openai: '' },
  tts: {},
};
const fields = t => m => t == 'chat'
  ? [['name', '名称'], ['url', 'API 地址', 'text', 'https://xxx.com/v1'], ['key', 'API Key', 'password'], ['model', '模型', 'pull', '填好地址和Key后点拉取'], ['temp', '温度', 'number', '0.9'], ['stream', '流式输出', 'tog'], ['fast', '低思考模式（更快，接口不支持会自动退回）', 'tog']]
  : [['name', '名称'], ['prov', '渠道', 'sel', PV[t]], ...(TIP[t][m.prov] ? [['', TIP[t][m.prov], 'tip']] : []), ...((t == 'tts' ? TF : IF)[m.prov] || (t == 'tts' ? TF : IF).openai)(m),
    ...(t == 'tts' ? [['voice', '默认音色', 'text', VPH[m.prov] || ''], ['vm', '男声兜底音色', 'text', '男性联系人没绑音色时用'], ['vf', '女声兜底音色', 'text', '女性联系人没绑音色时用']] : [])];

// 酒馆模式：在酒馆「连接配置」里任选一个（不切换正文用的连接），或者跟随酒馆当前连接
const stPick = a => {
  const L = stProfiles(), cn = stCurName(), on = id => (id ? a.stp == id && stProf(id) : !stProf(a.stp)) ? 'on' : '';
  const row = (id, b, sm) => `<div class="row prof ${on(id)}" data-a="stp" data-x="${esc(id)}"><i class="radio"></i><span><b>${esc(b)}</b><small>${esc(sm)}</small></span></div>`;
  const lost = a.stp && !stProf(a.stp);
  return `<div class="card">${row('', '跟随酒馆当前连接', cn ? '现在是「' + cn + '」，酒馆那边换了这里跟着换' : '酒馆现在连的是什么就用什么')}${(L || []).map(p => row(p.id, p.name || '未命名', [p.model, p.api].filter(Boolean).join(' · ') || '连接配置')).join('')}</div>`
    + `<p class="tip">${L == null ? '这个版本的酒馆没有「连接配置」功能（或被关掉了），只能跟随当前连接。'
      : L.length ? '下面列的是酒馆 API 连接页顶部「连接配置」里保存过的配置，选哪个手机就用哪个，不会改动正文用的连接。' : '酒馆里还没有保存过连接配置：在酒馆 API 连接页顶部「连接配置」点 ＋ 保存一个，这里就能选。'}${lost ? '<br>之前选的配置在酒馆里被删掉了，暂时跟随当前连接。' : ''}</p>`;
};
// 生图 / 语音：上面选服务商，下面直接填这个服务商的设置（每个服务商各存一份）
function provPage(t) {
  const a = S.api[t]; prof(t);
  const pv = () => a.pv, K2 = k => `cfg.${pv()}.${k}`, P = () => a.cfg[pv()], F = fx(a);
  const fld = ([k, l, ty = 'text', o]) => ty == 'official' ? `<div class="row"><span>${l}</span><input data-k="${K2(k)}" value="${esc(P()[k] || (t == 'tts' ? TURL : IURL)[pv()] || '')}"></div>` : ty == 'tip' ? `<p class="tip">${l}</p>` : ty == 'sel' ? F.sel(K2(k), l, o) : ty == 'tog' ? F.tog(K2(k), l) : ty == 'area' ? F.area(K2(k), l, o)
    : ty == 'pull' ? `<div class="row"><span>${l}</span><input data-k="${K2(k)}" value="${esc(P()[k] ?? '')}" placeholder="${esc(o || '')}"><b class="pull" data-a="pullf" data-x="${k}">拉取</b></div>`
    : ty == 'password' ? `<div class="row"><span>${l}</span><input type="password" data-k="${K2(k)}" value="${esc(P()[k] ?? '')}" placeholder="${esc(o || '')}"><b class="pull eye" data-a="eye">显示</b></div>` : F.inp(K2(k), l, ty, o);
  const pick = (k, l, ph, acts) => `<div class="row"><span>${l}</span><input data-k="${K2(k)}" value="${esc(P()[k] ?? '')}" placeholder="${esc(ph)}">${acts}</div>`;
  const fp = () => pv() == 'third' ? P().fmt || 'openai' : pv(), cat = () => TCAT[fp()] || { models: [], voices: [] }; // 第三方按接口格式走对应的快选 / 拉取
  const tbtn = k => (cat().voices.length ? `<b class="pull" data-a="qv" data-x="${k}">快选</b>` : '') + `<b class="pull" data-a="try" data-x="${k}">试听</b>`;
  const vbtn = k => (cat().voices.length ? `<b class="pull" data-a="qv" data-x="${k}">快选</b>` : '') + (['fish', 'eleven', 'mm', 'mmi'].includes(fp()) ? `<b class="pull" data-a="pv" data-x="${k}">拉取</b>` : '');
  const body = () => {
    const p = P(), tip = TIP[t][pv()], tts = t == 'tts';
    if (tts) a.tab ||= 'ch';
    a.src = 'custom'; // 语音、生图都不再走酒馆扩展
    let h = tts ? F.seg('tab', [['ch', '语音渠道'], ['lib', '角色库']]) : '';
    if (tts && a.tab == 'lib') return h + libList();
    if (tts) h += `<h6>每个人用哪个服务商</h6>${F.seg('mode', [['unified', '统一用一个渠道'], ['per', '每个人用自己的渠道']])}`;
    h += `<div class="card">${F.sel('pv', tts ? (a.mode == 'per' ? '默认服务商' : 'TTS 服务商') : '生图渠道', PV[t].map(([k, n]) => [k, n + (tts && k != pv() && a.cfg?.[k]?.key ? ' ✓' : '')]))}</div>` + (tip ? `<p class="tip">${tip}</p>` : '');
    if (tts) {
      const noModel = pv() == 'volc';
      h += `<div class="card">${TF[pv()](p).map(fld).join('')}${noModel ? '' : pick('model', '语音模型', cat().models[0] || '', (cat().models.length ? '<b class="pull" data-a="qm">快选</b>' : '') + (['fish', 'eleven', 'openai', 'index'].includes(fp()) ? '<b class="pull" data-a="pullf" data-x="model">拉取</b>' : ''))}
        ${pick('voice', '音色 ID', VPH[fp()] || '', vbtn('voice'))}</div><div class="tts-ops"><b data-a="try" data-x="voice">▶ 试听当前音色</b><b class="danger" data-a="vclr" data-x="voice">清空当前音色</b></div>
        <h6>全局默认音色</h6><div class="card">${F.tog('fb', '没配音色的联系人用全局默认音色')}${a.fb !== false ? pick('vm', '男声默认', '', tbtn('vm')) + pick('vf', '女声默认', '', tbtn('vf')) : ''}</div>`;
    } else { const fs = IF[pv()](p), L = presets(p, pv());
      h += `<div class="card">${fs.filter(f => CONN.includes(f[0])).map(fld).join('')}</div>`
        + `<h6>方案</h6><div class="mchips pchips">${L.map(x => `<b class="mchip ${x.id == p.pid ? 'on' : ''}" data-a="puse" data-x="${x.id}" data-lp="pdel">${esc(x.n)}</b>`).join('')}<b class="mchip add" data-a="pnew">＋ 新建方案</b></div>`
        + `<div class="card">${fs.filter(f => !CONN.includes(f[0])).map(fld).join('')}</div><div class="card">${F.tog('auto', 'AI 发图 / 动态配图时自动生图')}</div>`; }
    const AP = tts ? APPS_TTS : APPS_IMG, B = a.bind ||= {};
    h += `<h6>按应用选渠道</h6><div class="card">${AP.map(([k, n]) => F.sel('bind.' + k, n, [['', '跟随默认（' + (PV[t].find(x => x[0] == pv())?.[1] || '') + '）'], ...PV[t]])).join('')}</div>`;
    return h + btn('test', '测试连接', '', 'pri');
  };
  const pg = page({
    title: T[t], model: () => a, save, onClose: rf, body,
    onChange: k => { const m = t == 'img' && k.match(/^cfg\.(\w+)\.(\w+)$/); if (m && !CONN.includes(m[2])) { const c = a.cfg[m[1]], x = presets(c, m[1]).find(x => x.id == c.pid); x && (x.v[m[2]] = c[m[2]], save()); } // 改了就存进当前方案
      k == 'pv' ? (prof(t), save(), pg.re()) : (/\.(ver|prov|fmt|omode)$/.test(k) || k == 'fb') && pg.re(); },
    acts: {
      eye: (x, el) => { const i = el.previousElementSibling; i.type = i.type == 'password' ? 'text' : 'password'; el.textContent = i.type == 'password' ? '显示' : '隐藏'; },
      qm: async () => { const m = await menu(cat().models.map(x => [x, esc(x)]), '选择模型'); m && (P().model = m, save(), pg.re()); },
      qv: async k => { const v = await menu(cat().voices.map(([id, n]) => [id, esc(n) + `<small>${esc(id)}</small>`]), '选择音色'); v && (P()[k] = v, save(), pg.re()); },
      pv: async k => { try { toast('正在读取音色…'); const L = await voices(tq(prof(t))); if (!L.length) return toast('没有读到音色'); const v = await menu(L.map(([id, n]) => [id, esc(n) + `<small>${esc(id)}</small>`]), `选择音色 · ${L.length}个`); v && (P()[k] = v, save(), pg.re()); } catch (e) { toast('读取失败：' + e.message); } },
      pullf: async k => { try { toast('正在拉取…'); const L = await models(t == 'tts' ? tq(prof(t)) : t == 'img' ? iq(prof(t)) : prof(t), t); if (!L.length) return toast('没有拉到可选项'); const m = await menu(L.map(x => [x, esc(x)]), `选择 · ${L.length}个`); m && (P()[k] = m, save(), pg.re()); } catch (e) { toast('拉取失败：' + e.message); } },
      try: k => !P()[k] ? toast('先填音色 ID') : task('试听中', async sg => (await tts('你好呀，这是我现在的声音。', P()[k] || '', '', sg), '✓ 已播放')),
      vclr: k => { P()[k] = ''; save(); pg.re(); },
      // 方案：点一下切换、＋新建（用现在的设置）、长按删除
      puse: id => { const c = P(), x = presets(c, pv()).find(x => x.id == id); if (!x) return; Object.assign(c, x.v); c.pid = id; save(); pg.re(); toast('换成「' + x.n + '」'); },
      pnew: async () => { const c = P(), r = await form('新建方案', [['n', '方案名字', 'text', '如：厚涂 / 日常自拍']]); if (!r) return; const id = uid(); presets(c, pv()).push({ id, n: (r.n || '').trim() || '方案' + (c.presets.length + 1), v: Object.fromEntries(pkeys(pv()).map(k => [k, c[k] ?? ''])) }); c.pid = id; save(); pg.re(); toast('已新建，下面改的都存进这个方案'); },
      pdel: async id => { const c = P(), L = presets(c, pv()), x = L.find(x => x.id == id); if (!x) return; if (L.length < 2) return toast('至少留一个方案'); if (!await ok('删除方案「' + x.n + '」？')) return; L.splice(L.indexOf(x), 1); if (c.pid == id) { c.pid = L[0].id; Object.assign(c, L[0].v); } save(); pg.re(); },
      vopen: id => { const c = people().find(x => x.id == id); c && voicePage(c, () => setTimeout(() => pg.re())); },
      test: () => task('测试连接中', async sg => t == 'img' ? (show(await genImg('a cute cat, pastel colors, soft light', sg)), '✓ 生图成功') : (await tts('你好呀，这是小手机的语音测试。', '', '', sg), '✓ 已播放')),
    },
  });
  const show = u => typeof u == 'string' && /^(data:|https?:|blob:)/.test(u) && sheet({ title: '测试图', noBack: 1, body: () => `<img class="tpic" src="${esc(u)}">` });
}
// 聊天配置里存的模型（同一个网站可以存好几个，点一下切换）
const allM = p => [...new Set([...(p.models || []), p.model].filter(Boolean))];
const keepM = (p, m) => { p.models = [...new Set([...allM(p), m])]; p.model = m; };
const mchips = p => { const L = allM(p); return L.length > 1 || p.id ? `<div class="mchips">${L.map((m, i) => `<b class="mchip ${m == p.model ? 'on' : ''}" data-a="muse" data-x="${p.id}|${i}" data-lp="mdel">${esc(m)}</b>`).join('')}<b class="mchip add" data-a="pmod" data-x="${p.id}">＋ 模型</b></div>` : ''; };
function api(t) {
  if (t != 'chat') return provPage(t);
  const a = S.api[t], cur = () => a.list.findIndex(p => p.id == a.cur);
  const pg = page({
    title: T[t], model: () => a, save, onClose: rf,
    body: () => { const i = cur(), p = a.list[i]; return fx(a).seg('src', t == 'chat' ? [['tavern', '酒馆连接'], ['custom', '自定义 API']] : [['tavern', '酒馆扩展'], ['custom', '自选渠道']]) + (a.src == 'tavern'
      ? (t == 'chat' ? stPick(a) : `<p class="tip">${{ img: '调用酒馆「图像生成」扩展（/sd）。', tts: '调用酒馆「TTS」扩展（/speak）。' }[t]}</p>`)
      : `<div class="card">${a.list.map(p => `<div class="row prof ${p.id == a.cur ? 'on' : ''}" data-a="pick" data-x="${p.id}" data-lp="pedit"><i class="radio"></i><span><b>${esc(p.name || '未命名')}${t == 'chat' ? '' : `<em class="pv">${esc(pn(t, p.prov))}</em>`}</b><small>${esc(p.model || p.voice || '未选模型')}${p.url ? ' · ' + esc(p.url) : ''}</small></span></div>${t == 'chat' ? mchips(p) : ''}`).join('') || '<p class="tip">还没有配置，点下方新增</p>'}</div><p class="tip">点击切换使用 · 长按编辑 / 复制 / 删除${t == 'chat' ? ' · 点模型名直接换模型，长按模型名移除' : ''}</p>${btn('padd', '＋ 新增' + (t == 'chat' ? '配置' : '渠道'))}${p && t != 'chat' && (p.prov || 'openai') == 'openai' ? btn('pmod', '拉取模型列表') : ''}`
        + (t == 'tts' && p ? `<h6>兜底音色 · ${esc(p.name || pn(t, p.prov))}</h6><div class="card">${fx(a).inp(`list.${i}.vm`, '男声兜底', 'text', '男性联系人没绑音色时用')}${fx(a).inp(`list.${i}.vf`, '女声兜底', 'text', '女性联系人没绑音色时用')}</div><p class="tip">联系人没有绑定专属音色时，按联系人性别调用这里的男 / 女兜底音色；性别不明就用配置里的默认音色。联系人的性别和音色在「聊天信息」里改。</p>` : ''))
      + (t == 'chat' && (a.list.length || stProfiles()?.length) ? `<h6>生成用模型</h6><div class="card">${fx(a).sel('aux', '生成联系人 / 剧情同步', [['', '跟聊天模型一样'], ...a.list.map(p => [p.id, (p.name || '未命名') + (p.model ? ' · ' + p.model : '')]), ...(stProfiles() || []).map(p => ['st:' + p.id, '酒馆 · ' + (p.name || '未命名') + (p.model ? ' · ' + p.model : '')])])}</div><p class="tip">生成联系人、剧情同步、世界书解析、生图提示词这类「列清单」的活不需要思考。像 glm-5.3-flash 这种强制思考、关不掉的模型，会先想上万字再输出（日志里的「模型思考中 N字」就是它，不是联系人内容）。这里另选一个不思考的模型（同一个公益站里的非思考模型就行），会快很多；聊天回复仍用上面的模型。</p>` : '')
      + (t == 'chat' ? `<div class="card">${fx(a).inp('$tmo', '超时（秒）', 'number', '300')}</div><p class="tip">连续这么久没收到任何数据才判定失败（流式输出时边收边计时，默认5分钟）。想更快：开「低思考模式」、选非思考模型、减少「上下文与世界书」里的条数。</p>` : '')
      + (t == 'img' ? `<div class="card">${fx(a).tog('auto', 'AI 发图 / 动态配图时自动生图')}</div>` : '') + btn('test', '测试连接', '', 'pri'); },
    acts: {
      pick: id => { a.cur = id; save(); pg.re(); }, stp: id => { a.stp = id; save(); pg.re(); }, padd: () => pe(),
      pedit: async id => { const p = a.list.find(x => x.id == id), k = await menu([['e', '编辑'], ['c', '复制'], ['d', '删除', 'danger']], esc(p.name)); k == 'e' && pe(p); k == 'c' && a.list.push({ ...structuredClone(p), id: uid(), name: p.name + ' 副本' }); k == 'd' && a.list.splice(a.list.indexOf(p), 1); save(); pg.re(); },
      pmod: async (id) => { const p = a.list.find(x => x.id == id) || prof(t); try { toast('拉取中…'); const m = await menu((await models(p, t)).map(x => [x, esc(x)]), '选择模型'); m && (keepM(p, m), a.cur = p.id, save(), pg.re()); } catch (e) { toast('拉取失败：' + e.message); } },
      // 同一个网站存好几个模型：点一下就换，原来的还在
      muse: x => { const [id, i] = x.split('|'), p = a.list.find(q => q.id == id), m = allM(p)[+i]; if (!p || !m) return; p.model = m; a.cur = id; save(); pg.re(); toast('换成 ' + m); },
      mdel: async x => { const [id, i] = x.split('|'), p = a.list.find(q => q.id == id), m = allM(p)[+i]; if (!p || !m) return; if (allM(p).length < 2) return toast('至少留一个模型'); if (!await ok('移除模型 ' + m + '？')) return; p.models = allM(p).filter(v => v != m); p.model == m && (p.model = p.models[0]); save(); pg.re(); },
      test: () => task('测试连接中', async sg => t == 'chat' ? '✓ ' + String(await llm('Reply in one short sentence.', '用一句话打个招呼', '测试', sg)).slice(0, 30)
        : t == 'img' ? (show(await genImg('a cute cat, pastel colors, soft light', sg)), '✓ 生图成功') : (await tts('你好呀，这是小手机的语音测试。', '', '', sg), '✓ 已播放')),
    },
  });
  const show = u => typeof u == 'string' && /^(data:|https?:|blob:)/.test(u) && sheet({ title: '测试图', noBack: 1, body: () => `<img class="tpic" src="${esc(u)}">` });
  const pe = async (p = {}) => {
    const p0 = t == 'chat' ? { ...p, stream: p.stream ?? !p.nostream } : p.id ? { ...p, prov: p.prov || 'openai' } : { prov: PV[t][0][0], ...PD[t][PV[t][0][0]] };
    let pv = p0.prov;
    const r = await form(p.id ? '编辑配置' : t == 'chat' ? '新增配置' : '新增渠道', fields(t), p0, {
      pull: async (k, el, e, s) => {
        const m = s.model(); if (t != 'img' && !m.url) return toast('请先填写接口地址');
        try { toast('正在拉取…'); const l = await models(m, t); if (!l.length) return toast('没有拉到可选项'); const x = await menu(l.map(v => [v, esc(v)]), `选择 · ${l.length}个`); x && (m[k] = x, s.reb()); } catch (er) { toast('拉取失败：' + er.message); }
      },
    }, (k, v, m, s) => { // 换渠道：清掉上个渠道的默认值、填上新渠道的默认值
      if (k == 'prov') { const d0 = PD[t][pv] || {}, d1 = PD[t][v] || {}; for (const x in d0) m[x] === d0[x] && delete m[x]; for (const x in d1) (m[x] == null || m[x] === '') && (m[x] = d1[x]); pv = v; }
      (k == 'prov' || k == 'ver') && s.reb();
    });
    if (!r) return; r.name ||= t == 'chat' ? '未命名' : pn(t, r.prov); t == 'chat' && (delete r.nostream, delete p.nostream, r.model && (r.models = [...new Set([r.model, ...(p.models || [])])]));
    r.id ? Object.assign(p, r) : (r.id = uid(), a.list.push(r), a.cur ||= r.id); save(); pg.re();
  };
}
function link() {
  page({
    title: '联动模式与时间', onClose: rf, onChange: k => (k == 'mode' || k == 'inline') && saveD(),
    body: () => { const f = fx(S); return sec('link', [
      ['m', '模式', f.seg('mode', [['linked', '正文联动'], ['online', '线上模式']]) + `<p class="tip">${S.mode == 'linked' ? '正文联动：正文里的线上事件会同步到手机；你确认“注入正文”的手机聊天（聊天设置或长按消息），角色在正文里也会知道。' : '线上模式：只有正文影响手机，手机里发生的事不会传回正文。'}<br>两种模式下，正文出现发消息 / 拉群 / 加好友等线上内容，都会在手机里弹出并显示。</p>`],
      ['t', '时间', f.seg('time', [['story', '跟随剧情'], ['real', '现实时间']]) + `<p class="tip">当前手机时间：${now().toLocaleString('zh-CN')}</p>` + btn('rt', '从剧情重新识别时间')],
      ['s', '同步', f.tog('inline', '正文里的手机消息自动进手机（不额外调用 API）') + '<p class="tip">开启后，正文的 AI 会在回复最后顺手写一个 <手机> 小块（谁发了什么消息、朋友圈、拉群、转账…），小手机直接读出来放进手机，并把这个块从正文里去掉，不会多花一次 API。</p>' + f.tog('notify', '新消息弹窗') + btn('sync', '用 AI 补同步最新一条剧情（会调用一次 API）')]]); },
    acts: {
      rt: (x, t, e, pg) => { scanTime(recent()); pg.re(); toast('已从剧情识别'); },
      sync: () => { const m = C().chat?.findLast(m => !m.is_user && !m.is_system); m ? (toast('同步中…'), syncStory(m.mes)) : toast('还没有剧情'); },
    },
  });
}

const entI = (o, st) => `<i class="st ${o == null ? 'auto' : ''} ${st ? 'on' : ''}">${o == null ? (st ? '跟随·开' : '跟随·关') : st ? '开' : '关'}</i>`;
function ctx() {
  let bk = [], all = [], ents = {};
  const pg = page({
    title: '上下文与世界书', onClose: rf, onChange: k => k.startsWith('wi') && load(),
    body: () => { const f = fx(S), r = recent(); return sec('ctx', [
      ['c', '上下文', f.inp('ctxN', '读取正文条数', 'number')],
      ['w', '世界书', f.tog('wi.follow', '跟随酒馆已开启的世界书') + (S.wi.follow ? `<p class="tip">当前：${esc(bk.join('、') || '无')}</p>` : f.multi('wi.books', '手动选择世界书', all.map(n => [n, n])))],
      ...bk.map(b => ['b:' + b, '📖 ' + esc(b), Object.values(ents[b] || {}).map(e => { const o = S.wi.ov[b + '/' + e.uid], st = entState(b, e, r); return `<div class="ent" data-a="ent" data-lp="entr" data-x="${esc(b + '/' + e.uid)}">${entI(o, st)}<span>${esc(e.comment || (e.key || []).join(',') || '#' + e.uid)}</span>${e.constant ? '<em>常驻</em>' : ''}</div>`; }).join('') || '<p class="tip">空</p>'])])
      + '<p class="tip">点一下开 / 关 · 长按恢复跟随酒馆</p>'; },
    // 点一下：现在开着就关、关着就开（只改这一条，页面不跳）；长按：恢复跟随酒馆
    acts: {
      ent: (x, el) => { const [b, ...u] = x.split('/'), e = Object.values(ents[b] || {}).find(e => String(e.uid) == u.join('/')); if (!e) return; const on = entState(b, e, recent()); S.wi.ov[x] = on ? 0 : 1; save(); el.querySelector('.st').outerHTML = entI(S.wi.ov[x], !on); },
      entr: (x, el) => { const [b, ...u] = x.split('/'), e = Object.values(ents[b] || {}).find(e => String(e.uid) == u.join('/')); if (!e || S.wi.ov[x] == null) return; delete S.wi.ov[x]; save(); el.querySelector('.st').outerHTML = entI(null, entState(b, e, recent())); toast('已恢复跟随酒馆'); },
    },
  });
  const load = async () => { all = await allBooks(); bk = await wiBooks(); for (const b of bk) ents[b] = (await loadBook(b))?.entries; pg.re(); }; load();
}

function disp() {
  page({
    title: '显示方式', onClose: rf,
    body: () => { const f = fx(S); return sec('disp', [
      ['s', '入口', f.seg('show', [['float', '悬浮窗'], ['wand', '魔法棒菜单']]) + (S.show == 'float' ? `<div class="row bcur" data-a="ballpick"><span>悬浮窗图标</span><img src="${esc(ballUrl())}" alt=""><small>${esc(ballName())}</small><i class="chev">›</i></div>` : '') + '<p class="tip">悬浮窗：可拖动的小图标。魔法棒：在输入框左侧的扩展菜单里打开。</p>'],
      ['p', '流畅度', f.seg('perf', [['', '自动'], ['lite', '流畅优先'], ['full', '效果优先']])],
      ['z', '字体', `<label class="row fzr"><span>字体大小</span><input type="range" min="80" max="120" step="5" data-k="fzp" value="${S.fzp ?? 100}"><b class="fzv">${S.fzp ?? 100}%</b></label>` + btn('rpos', '重置手机与悬浮窗位置')]]); },
    after: el => { const r = el.querySelector('[data-k=fzp]'), v = el.querySelector('.fzv'); r && (r.oninput = () => v.textContent = r.value + '%'); }, // 拖的时候数字跟着变
    acts: { rpos: () => { S.pos = {}; save(); emit('cfg', 'pos'); toast('已重置'); }, ballpick: (x, t, e, pg) => ballPicker(() => pg.re()) },
  });
}

// 调用日志：一开始调用就出现（蓝色·进行中，实时计时 + 收到的内容），结束后原地变成功 / 失败；进行中的可以直接中止
const lkey = (l, i) => l.id || 'i' + i, lfind = x => LOG.find((l, i) => lkey(l, i) == x);
const lstate = l => l.run ? (String(l.res).startsWith('（模型正在思考') ? `模型思考中 · ${l.th || 0}字` : l.res ? `接收中 · ${l.res.length}字` : '等待返回…') : l.ok ? '成功' : '失败';
const lrow = (l, i) => `<div class="log ${l.run ? 'run' : l.ok ? '' : 'err'}" data-a="lx" data-x="${lkey(l, i)}"><div><em>${T[l.t]}</em><b>${esc(l.desc)}</b><small>${new Date(l.at).toLocaleTimeString()} · ${l.run ? `<time data-t="${l.at}">${(Date.now() - l.at) / 1e3 | 0}s</time>` : l.ms + 'ms'}</small></div><div><small>${esc(l.src)} ${esc(l.model || '')} · <span class="ls">${lstate(l)}</span></small>${l.run ? `<i class="lstop" data-a="lstop" data-x="${l.id}">中止</i>` : ''}</div>${l.open ? `<pre>▸ 请求\n${esc(l.req)}\n\n▸ 返回${l.run ? '（实时）' : ''}\n${esc(l.res || (l.run ? '…' : ''))}</pre>` : ''}</div>`;
function logs() {
  const pg = page({
    title: '调用日志', isLog: 1, right: () => '<b data-a="clr">清空</b>',
    body: () => LOG.map(lrow).join('') || '<p class="empty">暂无记录</p>',
    after: el => $$('.log.run pre', el).forEach(p => p.scrollTop = p.scrollHeight),
    onClose: () => clearInterval(iv),
    acts: {
      lx: x => { const l = lfind(x); l && (l.open = !l.open, pg.reb()); },
      lstop: id => stopCall(id),
      clr: () => { const keep = LOG.filter(l => l.run); LOG.length = 0; LOG.push(...keep); saveLog(); pg.reb(); },
    },
  });
  const iv = setInterval(() => $$('time[data-t]', pg.el).forEach(t => t.textContent = ((Date.now() - t.dataset.t) / 1e3 | 0) + 's'), 1e3);
}
G.openLogs = () => top()?.isLog || logs();
on('log', () => { const t = top(); t?.isLog && t.reb(); });

/* ---------- 锁屏与密码 ---------- */
// 表情包：免费表情库（表情商店、已添加的表情包组）、AI 发表情自动配图。都不会用到你自己的 API
function stkp() {
  const pg = page({
    title: '表情包', onClose: rf, onChange: () => pg.re(),
    body: () => { const f = fx(S), c = S.stk; return sec('stk', [
      ['m', '我的表情包组', `<div class="card">${c.packs.map((id, i) => `<div class="row"><span>${esc(packMeta(id)?.name || id)}</span><small><b class="lnk" data-a="pup" data-x="${i}">${i ? '上移' : ''}</b> <b class="lnk danger" data-a="prm" data-x="${id}">移除</b></small></div>`).join('') || '<div class="row"><small>还没有添加表情包组</small></div>'}</div>`
        + btn('pstore', '打开表情商店') + '<p class="tip">表情来自开源免费的 ChineseBQB 和 Waline 表情库，图片走公共 CDN；排在前面的组，AI 发表情时优先从里面挑。</p>'],
      ['v', '对方看懂我的表情', f.tog('stk.see', '把我发的表情图给对方看（识图）') + '<p class="tip">你发表情包后，图片会跟这次回复请求一起发给聊天模型，对方看图就知道你想表达什么，没起名字的表情也能看懂。不会额外调用 API，只是这次请求多一点点 token（每张图缩小到 320px）。模型不支持看图时自动改成只发文字。</p>'],
      ['a', 'AI 发表情包', f.tog('stk.auto', '自动配图') + '<p class="tip">AI 回复里的 [表情包:关键词]：在表情库里挑一张（你添加的组优先、可爱风优先）。关掉的话只显示颜文字占位。</p>'],
    ]); },
    acts: {
      pstore: () => storePage(), prm: id => { rmPack(id); pg.re(); },
      pup: i => { i = +i; const a = S.stk.packs; [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(); emit('stk'); pg.re(); },
    },
  });
}
function lockp() {
  lockMig(); const need = () => { const L = S.lock, r = () => pg.re(); L.type == 'fp' ? L.fpSet || askFp(r) : L.pin || askPin(r); };
  const pg = page({
    title: '锁屏与密码', onClose: rf,
    onChange: k => { // 打开密码 / 换类型时，没设过就立刻让用户设置
      (k == 'lock.pw' && S.lock.pw || k == 'lock.type') && need(); pg.re();
    },
    body: () => { const f = fx(S), L = S.lock; return sec('lock', [
      ['l', '锁屏', f.tog('lock.on', '启用锁屏') + (L.on ? f.inp('lock.text', '锁屏签名', 'text', '显示在时间下面，可留空') + `<div class="row go" data-a="lwp"><span>锁屏壁纸</span><small>${esc(wpName())}</small></div>` : '')
        + `<p class="tip">开启后，每次收起或关掉小手机再打开，会先显示锁屏，从底部向上滑动解锁。锁屏壁纸在「主题」里切换。</p>` + btn('lprev', '预览锁屏')],
      L.on && ['p', '密码', f.tog('lock.pw', '启用密码') + (L.pw ? f.seg('lock.type', [['pin', '数字密码'], ['fp', '指纹']])
        + (L.type == 'fp' ? `<div class="row go" data-a="sfp"><span>${L.fpSet ? '重新录入指纹' : '录入指纹'}</span><small>${L.fpSet ? '已录入' : '未录入'}</small></div><p class="tip">指纹是模拟效果：锁屏底部会出现指纹感应区，按住、纹路扫满就解锁（网页拿不到真实指纹，谁按都能开）。指纹模式下没有数字密码，只能按指纹解锁。</p>`
          : `<div class="row go" data-a="spin"><span>${L.pin ? '修改' : '设置'}数字密码</span><small>${L.pin ? '已设置' : '未设置'}</small></div>`) : '')
        + (L.pw && L.type == 'pin' ? '<p class="tip">🔑 备用密码 <b>0000</b>：不能修改，永远有效。忘记数字密码时在锁屏输入 0000 就能进入。</p>' : '')],
    ]); },
    acts: { lprev: () => lock(true), lwp: () => openApp('theme'), spin: () => askPin(() => pg.re()), sfp: () => askFp(() => pg.re()) },
  });
}

const dl = (n, o) => Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)])), download: n }).click();
const readJ = async () => { const f = await pickFile('.json'); try { return f && JSON.parse(await f.text()); } catch { toast('文件格式错误'); } };
function data() {
  page({
    title: '数据管理',
    body: () => `<div class="card">${btn('ex', '导出本聊天的手机数据')}${btn('im', '导入手机数据')}${btn('exs', '导出全局设置与素材（含API Key）')}${btn('ims', '导入全局设置与素材')}${btn('rs', '清空本聊天的手机数据', '', 'danger')}</div><p class="tip">联系人 / 聊天 / 动态跟随每个酒馆聊天文件分别保存；API、主题、素材、桌面为全局设置。</p><h6>图片与视频</h6><div class="card">${btn('mig', '把旧图片搬进文件夹')}</div><p class="tip">上传的图片、视频、AI 生成的图都存在 SillyTavern/data/你的用户名/user/images/${MDIR}/ 文件夹里，不占聊天数据。删掉消息、表情包、头像、壁纸或整个联系人时，没有别处再用到的文件会自动一起删除。旧版本存在数据里的图片可以点上面的按钮搬过去，聊天文件会小很多。</p>`,
    acts: {
      mig: () => task('正在搬运旧图片', async (sg, prog) => `已搬运 ${await migrateMedia(n => prog(`${n} 张`))} 张`),
      ex: () => dl('phone-data.json', D()), exs: () => dl('phone-settings.json', S),
      im: async () => { const d = await readJ(); d && (drop(structuredClone(D())), Object.assign(D(), d), saveD(), emit('chat'), toast('已导入')); },
      ims: async () => { const d = await readJ(); d && (Object.assign(S, { ...d, media: { ...(d.media || {}), ...S.media } }), save(), toast('已导入，刷新页面后完全生效')); },
      rs: async () => { if (await ok('清空后无法恢复，确定？（这个聊天里上传的图片也会一起删除）')) { drop({ c: D().chats, p: D().posts, m: D().me }); Object.assign(D(), { chats: [], posts: [] }); saveD(); toast('已清空'); } },
    },
  });
}
