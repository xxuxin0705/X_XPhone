// 小手机 · 设置：API（聊天/生图/TTS）/ 联动与时间 / 上下文与世界书 / 显示 / 日志 / 数据
import { C, S, D, save, saveD, esc, uid, reg, page, top, fx, btn, sec, menu, form, ok, toast, llm, genImg, tts, models, prof, LOG, saveLog, recent, now, scanTime, wiBooks, allBooks, loadBook, entState, pickFile, emit } from '../core.js';
import { syncStory } from './chat.js';

const T = { chat: '聊天模型', img: '生图', tts: '语音 TTS' };
const rf = () => setTimeout(() => top()?.re());
const sub = (a, x) => a == 'api' ? (S.api[x].src == 'tavern' ? '酒馆' : prof(x)?.name || '未选择') : a == 'link' ? (S.mode == 'linked' ? '正文联动' : '线上模式') : a == 'ctx' ? S.ctxN + ' 条' : a == 'disp' ? (S.show == 'float' ? '悬浮窗' : '魔法棒') : a == 'logs' ? LOG.length : '';
const ROWS = [['API 配置', [['api', 'chat', '#34c759', '✦'], ['api', 'img', '#ff9f0a', '✿'], ['api', 'tts', '#5e5ce6', '♪']]],
  ['剧情', [['link', '联动模式与时间', '#ff375f', '⇄'], ['ctx', '上下文与世界书', '#0a84ff', '❖']]],
  ['通用', [['disp', '显示方式', '#64d2ff', '▣'], ['logs', '调用日志', '#8e8e93', '≡'], ['data', '数据管理', '#30b0c7', '⇪']]]];

reg({
  id: 'settings', name: '设置', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  open: () => page({
    title: '设置', cls: 'set',
    body: () => ROWS.map(([h, rs]) => `<h6>${h}</h6><div class="card">${rs.map(([a, x, c, i]) => `<div class="row go" data-a="${a}" data-x="${a == 'api' ? x : ''}"><i class="ri" style="background:${c}">${i}</i><span>${T[x] || x}</span><small>${sub(a, x)}</small></div>`).join('')}</div>`).join(''),
    acts: { api, link, ctx, disp, logs, data },
  }),
});

function api(t) {
  const a = S.api[t];
  const pg = page({
    title: T[t], model: () => a, save, onClose: rf,
    body: () => fx(a).seg('src', [['tavern', '酒馆当前配置'], ['custom', '自定义 API']]) + (a.src == 'tavern'
      ? `<p class="tip">${{ chat: '直接使用酒馆当前连接的 API 与模型。', img: '调用酒馆「图像生成」扩展（/sd）。', tts: '调用酒馆「TTS」扩展（/speak）。' }[t]}</p>`
      : `<div class="card">${a.list.map(p => `<div class="row prof ${p.id == a.cur ? 'on' : ''}" data-a="pick" data-x="${p.id}" data-lp="pedit"><i class="radio"></i><span><b>${esc(p.name || '未命名')}</b><small>${esc(p.model || '未选模型')} · ${esc(p.url)}</small></span></div>`).join('') || '<p class="tip">还没有配置，点下方新增</p>'}</div><p class="tip">点击切换使用 · 长按编辑 / 复制 / 删除</p>${btn('padd', '＋ 新增配置')}${a.cur ? btn('pmod', '拉取模型列表') : ''}`)
      + (t == 'img' ? `<div class="card">${fx(a).tog('auto', 'AI 发图 / 动态配图时自动生图')}</div>` : '') + btn('test', '测试连接', '', 'pri'),
    acts: {
      pick: id => { a.cur = id; save(); pg.re(); }, padd: () => pe(),
      pedit: async id => { const p = a.list.find(x => x.id == id), k = await menu([['e', '编辑'], ['c', '复制'], ['d', '删除', 'danger']], esc(p.name)); k == 'e' && pe(p); k == 'c' && a.list.push({ ...p, id: uid(), name: p.name + ' 副本' }); k == 'd' && a.list.splice(a.list.indexOf(p), 1); save(); pg.re(); },
      pmod: async () => { try { toast('拉取中…'); const m = await menu((await models(t)).map(x => [x, esc(x)]), '选择模型'); m && (prof(t).model = m, save(), pg.re()); } catch (e) { toast('拉取失败：' + e.message); } },
      test: async () => { toast('测试中…'); try { t == 'chat' ? toast('✓ ' + String(await llm('Reply in one short sentence.', '用一句话打个招呼', '测试')).slice(0, 40)) : t == 'img' ? (await genImg('a cute cat, pastel colors'), toast('✓ 生图成功')) : (await tts('你好呀，这是小手机的语音测试'), toast('✓ 已播放')); } catch (e) { toast('✗ ' + e.message); } },
    },
  });
  const pe = async (p = {}) => {
    const r = await form(p.id ? '编辑配置' : '新增配置', [['name', '名称'], ['url', 'API 地址', 'text', 'https://xxx.com/v1'], ['key', 'API Key', 'password'], ['model', '模型'],
      ...(t == 'chat' ? [['temp', '温度', 'number', '0.9']] : t == 'img' ? [['size', '尺寸', 'text', '1024x1024']] : [['voice', '默认音色', 'text', 'alloy']])], p);
    if (!r) return; r.id ? Object.assign(p, r) : (r.id = uid(), a.list.push(r), a.cur ||= r.id); save(); pg.re();
  };
}

function link() {
  page({
    title: '联动模式与时间', onClose: rf, onChange: k => k == 'mode' && saveD(),
    body: () => { const f = fx(S); return sec('link', [
      ['m', '模式', f.seg('mode', [['linked', '正文联动'], ['online', '线上模式']]) + `<p class="tip">${S.mode == 'linked' ? '正文联动：正文里的线上事件会同步到手机；你确认“注入正文”的手机聊天（聊天设置或长按消息），角色在正文里也会知道。' : '线上模式：只有正文影响手机，手机里发生的事不会传回正文。'}<br>两种模式下，正文出现发消息 / 拉群 / 加好友等线上内容，都会在手机里弹出并显示。</p>`],
      ['t', '时间', f.seg('time', [['story', '跟随剧情'], ['real', '现实时间']]) + `<p class="tip">当前手机时间：${now().toLocaleString('zh-CN')}</p>` + btn('rt', '从剧情重新识别时间')],
      ['s', '同步', f.tog('scan', '检测到线上关键词时自动同步') + f.tog('notify', '新消息弹窗') + f.area('kw', '触发关键词（正则）') + btn('sync', '立即同步最新一条剧情', '', 'pri')]]); },
    acts: {
      rt: (x, t, e, pg) => { scanTime(recent()); pg.re(); toast('已从剧情识别'); },
      sync: () => { const m = C().chat?.findLast(m => !m.is_user && !m.is_system); m ? (toast('同步中…'), syncStory(m.mes)) : toast('还没有剧情'); },
    },
  });
}

function ctx() {
  let bk = [], all = [], ents = {};
  const pg = page({
    title: '上下文与世界书', onClose: rf, onChange: k => k.startsWith('wi') && load(),
    body: () => { const f = fx(S), r = recent(); return sec('ctx', [
      ['c', '上下文', f.inp('ctxN', '读取正文条数', 'number')],
      ['w', '世界书', f.tog('wi.follow', '跟随酒馆已开启的世界书') + (S.wi.follow ? `<p class="tip">当前：${esc(bk.join('、') || '无')}</p>` : f.multi('wi.books', '手动选择世界书', all.map(n => [n, n])))],
      ...bk.map(b => ['b:' + b, '📖 ' + esc(b), Object.values(ents[b] || {}).map(e => { const o = S.wi.ov[b + '/' + e.uid], st = entState(b, e, r); return `<div class="ent" data-a="ent" data-x="${esc(b + '/' + e.uid)}"><i class="st ${o == null ? 'auto' : ''} ${st ? 'on' : ''}">${o == null ? (st ? '跟随·开' : '跟随·关') : o ? '强制开' : '强制关'}</i><span>${esc(e.comment || (e.key || []).join(',') || '#' + e.uid)}</span>${e.constant ? '<em>常驻</em>' : ''}</div>`; }).join('') || '<p class="tip">空</p>'])])
      + '<p class="tip">点击条目切换：跟随（酒馆开启 + 常驻/关键词触发）→ 强制开 → 强制关</p>'; },
    acts: { ent: x => { const o = S.wi.ov[x]; o == null ? (S.wi.ov[x] = 1) : o ? (S.wi.ov[x] = 0) : delete S.wi.ov[x]; save(); pg.re(); } },
  });
  const load = async () => { all = await allBooks(); bk = await wiBooks(); for (const b of bk) ents[b] = (await loadBook(b))?.entries; pg.re(); }; load();
}

function disp() {
  page({
    title: '显示方式', onClose: rf,
    body: () => { const f = fx(S); return sec('disp', [
      ['s', '入口', f.seg('show', [['float', '悬浮窗'], ['wand', '魔法棒菜单']]) + '<p class="tip">悬浮窗：可拖动的小图标。魔法棒：在输入框左侧的扩展菜单里打开。</p>'],
      ['z', '尺寸与位置', `<label class="row"><span>缩放</span><input type="range" min=".6" max="1.3" step=".05" data-k="scale" value="${S.scale}"></label>` + btn('rpos', '重置手机与悬浮窗位置')]]); },
    acts: { rpos: () => { S.pos = {}; save(); emit('cfg', 'pos'); toast('已重置'); } },
  });
}

function logs() {
  const pg = page({
    title: '调用日志', right: () => '<b data-a="clr">清空</b>',
    body: () => LOG.map((l, i) => `<div class="log ${l.ok ? '' : 'err'}" data-a="lx" data-x="${i}"><div><em>${T[l.t]}</em><b>${esc(l.desc)}</b><small>${new Date(l.at).toLocaleTimeString()} · ${l.ms}ms</small></div><small>${esc(l.src)} ${esc(l.model || '')} · ${l.ok ? '成功' : '失败'}</small>${l.open ? `<pre>▸ 请求\n${esc(l.req)}\n\n▸ 返回\n${esc(l.res)}</pre>` : ''}</div>`).join('') || '<p class="empty">暂无记录</p>',
    acts: { lx: i => { LOG[i].open = !LOG[i].open; pg.reb(); }, clr: () => { LOG.length = 0; saveLog(); pg.reb(); } },
  });
}

const dl = (n, o) => Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)])), download: n }).click();
const readJ = async () => { const f = await pickFile('.json'); try { return f && JSON.parse(await f.text()); } catch { toast('文件格式错误'); } };
function data() {
  page({
    title: '数据管理',
    body: () => `<div class="card">${btn('ex', '导出本聊天的手机数据')}${btn('im', '导入手机数据')}${btn('exs', '导出全局设置与素材（含API Key）')}${btn('ims', '导入全局设置与素材')}${btn('rs', '清空本聊天的手机数据', '', 'danger')}</div><p class="tip">联系人 / 聊天 / 动态跟随每个酒馆聊天文件分别保存；API、主题、素材、桌面为全局设置。</p>`,
    acts: {
      ex: () => dl('phone-data.json', D()), exs: () => dl('phone-settings.json', S),
      im: async () => { const d = await readJ(); d && (Object.assign(D(), d), saveD(), emit('chat'), toast('已导入')); },
      ims: async () => { const d = await readJ(); d && (Object.assign(S, d), save(), toast('已导入，刷新页面后完全生效')); },
      rs: async () => { if (await ok('清空后无法恢复，确定？')) { Object.assign(D(), { chats: [], posts: [] }); saveD(); toast('已清空'); } },
    },
  });
}
