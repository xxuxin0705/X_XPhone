// 设置 → 模块配置：按应用列出每个会调用模型的模块；点进去配模型、流式、低思考和提示词
import { S, page, fx, esc, uid, form, ok, menu, save, stProfiles } from '../../core.js';
import { MODS, mcfg, defText, modOf } from '../../mods.js';

const models = () => [['', '跟随默认'], ...S.api.chat.list.map(p => [p.id, (p.name || '未命名') + (p.model ? ' · ' + p.model : '')]),
  ...(stProfiles() || []).map(p => ['st:' + p.id, '酒馆 · ' + (p.name || '未命名') + (p.model ? ' · ' + p.model : '')])];
const tri = (on, off) => [['', '跟随'], ['on', on], ['off', off]];
const sum = k => { const c = S.mods?.[k]; if (!c) return '默认'; const m = c.use && models().find(x => x[0] == c.use)?.[1], p = c.cur && c.list.find(x => x.id == c.cur)?.n;
  return [m && m.split(' · ')[0], p ? '「' + p + '」' : ''].filter(Boolean).join(' · ') || '默认'; };

export function modsPage() {
  const apps = [...new Set(MODS.map(m => m.app))];
  const pg = page({ title: '模块配置', cls: 'set mods', body: () => apps.map(a => `<h6>${esc(a)}</h6><div class="card">${MODS.filter(m => m.app == a).map(m => `<div class="row go" data-a="mod" data-x="${m.k}"><span>${esc(m.n)}</span><small>${esc(sum(m.k))}</small></div>`).join('')}</div>`).join(''),
    acts: { mod: k => modPage(k, pg) } });
}

function modPage(k, parent) {
  const m = modOf(k), c = mcfg(k);
  const vars = (m.vars || []).map(([v, d]) => `{{${v}}} ${d}`).join('　');
  const edit = async p => {
    const r = await form(p ? '编辑提示词' : '新增提示词', [['n', '名称'], ['t', '内容', 'area'], ...(vars ? [['', '可用：{{char}} {{user}}　' + vars, 'tip']] : [['', '可用：{{char}} {{user}}', 'tip']])], p || { n: '我的提示词', t: defText(k) });
    if (!r) return false; r.n = String(r.n || '').trim() || '我的提示词';
    if (p) Object.assign(p, { n: r.n, t: r.t }); else { const id = uid(); c.list.push({ id, n: r.n, t: r.t }); c.cur = id; }
    save(); return true;
  };
  const row = (id, n, sm, extra = '') => `<div class="row prof ${(c.cur || '') == id ? 'on' : ''}" data-a="mpick" data-x="${esc(id)}"><i class="radio"></i><span><b>${esc(n)}</b><small>${esc(sm)}</small></span>${extra}</div>`;
  const self = page({ title: m.n, cls: 'set modp', model: () => c, save, onClose: () => parent?.re?.(),
    body: () => { const f = fx(c); return `<h6>模型</h6><div class="card">${f.sel('use', '模型', models())}<div class="row"><span>流式输出</span>${f.seg('stream', tri('开', '关'))}</div><div class="row"><span>低思考</span>${f.seg('think', [['', '跟随'], ['low', '开'], ['full', '关']])}</div></div>
<h6>提示词</h6><div class="card">${row('', '系统默认', defText(k).replace(/\s+/g, ' ').slice(0, 40) + '…', '<b class="lnk" data-a="mview">查看</b>')}${c.list.map(p => row(p.id, p.n, String(p.t).replace(/\s+/g, ' ').slice(0, 40) + '…', `<b class="lnk" data-a="medit" data-x="${p.id}">编辑</b>`)).join('')}</div>
<button class="btn" data-a="madd">＋ 新增提示词</button>`; },
    acts: {
      mpick: (id, t, e, pg) => { if (e?.target?.closest('.lnk')) return; c.cur = id; save(); pg.re(); },
      mview: (x, t, e) => { e?.stopPropagation?.(); page({ title: '系统默认 · ' + m.n, cls: 'set modv', onClose: () => self.re(), body: () => `<pre class="modv-t">${esc(defText(k))}</pre><button class="btn" data-a="mdup">以它为底新增一条</button>`, acts: { mdup: async () => { await edit(); } } }); },
      madd: async (x, t, e, pg) => { if (await edit()) pg.re(); },
      medit: async (id, t, e, pg) => { e?.stopPropagation?.(); const p = c.list.find(x => x.id == id); if (!p) return;
        const a = await menu([['e', '编辑'], ['u', '用这条'], ['d', '删除', 'danger']], esc(p.n));
        if (a == 'e') await edit(p); if (a == 'u') c.cur = id;
        if (a == 'd' && await ok('删掉「' + p.n + '」')) { c.list.splice(c.list.indexOf(p), 1); c.cur == id && (c.cur = ''); }
        save(); pg.re(); },
    } });
}
