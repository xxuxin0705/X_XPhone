// 设置 · 免费模型：几家现在能免费调用、接口跟 OpenAI 一样的平台（打电话 / 生成联系人这类活用它们就不花钱）
// 名单 2026-10 核对过（各家官网 / 文档）；免费名单会变，以官网为准，点「拉取模型列表」能看到这家现在有哪些模型
// 点「添加」→ 填一次密钥 → 自动在 设置 → API 里新增一个配置（以后在 应用配置 → 语音通话 等模块里直接选它）
import { S, page, esc, uid, form, save, toast } from '../../core.js';

export const FREE = [
  { k: 'zhipu', n: '智谱 BigModel', site: 'https://open.bigmodel.cn', key: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys', url: 'https://open.bigmodel.cn/api/paas/v4',
    tip: '手机号注册就能用；Flash 系列免费，不扣钱。打电话推荐 GLM-4.7-Flash（小手机会关掉它的思考，回得快又不笨）',
    models: [['glm-4.7-flash', 'GLM-4.7-Flash', '最新，最聪明，打电话推荐（小手机会自动关掉它的思考）'], ['glm-4.5-flash', 'GLM-4.5-Flash', '聪明一点'], ['glm-4-flash-250414', 'GLM-4-Flash', '最快但比较笨：打电话容易答非所问、把你的话翻译一遍']] },
  { k: 'sf', n: '硅基流动 SiliconFlow', site: 'https://cloud.siliconflow.cn', key: 'https://cloud.siliconflow.cn/account/ak', url: 'https://api.siliconflow.cn/v1',
    tip: '手机号注册；标着「免费」的模型不扣钱。同一个密钥还能用免费的语音识别（通话里的「硅基识别」）',
    models: [['Qwen/Qwen3-8B', 'Qwen3-8B', '聪明，中文好（自动关思考）'], ['THUDM/GLM-4-9B-0414', 'GLM-4-9B', '稳'], ['Qwen/Qwen2.5-7B-Instruct', 'Qwen2.5-7B', '最快']] },
  { k: 'gemini', n: 'Google AI Studio（Gemini）', site: 'https://aistudio.google.com', key: 'https://aistudio.google.com/app/apikey', url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    tip: '要能连上谷歌；每天有一定的免费次数（在 AI Studio 里能看到）。Gemini 还能直接听录音（通话里的「模型听」）',
    models: [['gemini-2.5-flash', 'Gemini 2.5 Flash', '聪明'], ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', '更快、免费次数更多']] },
];
const nameOf = f => '免费 · ' + f.n.split(/[ （(]/)[0];
// 已经加过这家：用同一个配置（换模型 / 更新密钥），不重复加
const found = f => S.api.chat.list.find(p => (p.url || '').replace(/\/+$/, '') == f.url);
export function freeAdd(k, model, key) {
  const f = FREE.find(x => x.k == k); if (!f) return null;
  let p = found(f); const all = f.models.map(m => m[0]);
  if (p) { key && (p.key = key); p.model = model; p.models = [...new Set([model, ...(p.models || []), ...all])]; }
  else { p = { id: uid(), name: nameOf(f), url: f.url, key: key || '', model, models: [model, ...all.filter(m => m != model)], stream: true, fast: true }; S.api.chat.list.push(p); }
  save(); return p.id;
}
const copy = async t => { try { await navigator.clipboard.writeText(t); } catch { const a = Object.assign(document.createElement('textarea'), { value: t }); document.body.append(a); a.select(); try { document.execCommand('copy'); } catch { } a.remove(); } toast('已复制：' + t); };

// picked(id)：选好了（在 应用配置 里打开时，直接把这个模块换成它）
export function freePage(picked) {
  const pg = page({ title: '免费模型', cls: 'set freem',
    body: () => `<p class="tip">这些平台的这些模型现在不要钱（2026 年 10 月核对过，以官网为准）。注册拿一个密钥，点模型旁边的「添加」填进去就行，会在 设置 → API 里新增一个配置；之后在 应用配置 → 语音通话 之类的模块里选它，正文还用你原来的模型。</p>`
      + FREE.map(f => { const p = found(f); return `<h6>${esc(f.n)}${p ? '<em class="fm-on">已添加</em>' : ''}</h6><div class="card">
<div class="row fm-links"><span><small>${esc(f.tip)}</small></span></div>
<div class="row fm-l"><span>官网</span><a class="lnk" href="${esc(f.site)}" target="_blank" rel="noopener">${esc(f.site.replace(/^https:\/\//, ''))}</a><b class="lnk" data-a="fcopy" data-x="${esc(f.site)}">复制</b></div>
<div class="row fm-l"><span>拿密钥</span><a class="lnk" href="${esc(f.key)}" target="_blank" rel="noopener">打开</a><b class="lnk" data-a="fcopy" data-x="${esc(f.key)}">复制</b></div>
${f.models.map(([m, n, d]) => `<div class="row fm-m"><span><b>${esc(n)}</b><small>${esc(d)} · ${esc(m)}</small></span><b class="lnk fm-add" data-a="fadd" data-x="${f.k}|${esc(m)}">${p && p.model == m ? '再选一次' : '添加'}</b></div>`).join('')}</div>`; }).join('')
      + '<p class="tip">密钥只存在你自己的小手机设置里。打不开官网时点「复制」，粘贴到浏览器里打开。</p>',
    acts: {
      fcopy: u => copy(u),
      fadd: async x => { const [k, m] = x.split('|'), f = FREE.find(v => v.k == k), p = found(f);
        let key = p?.key || ''; if (!key) { const r = await form('填 ' + f.n + ' 的密钥', [['key', 'API 密钥', 'text', 'sk-… / 一长串字母数字'], ['', '在官网「拿密钥」那一页新建一个，复制过来', 'tip']], {}); if (!r) return; key = String(r.key || '').trim(); if (!key) return toast('没填密钥'); }
        const id = freeAdd(k, m, key); toast('已添加：' + nameOf(f) + ' · ' + m); pg.re(); picked?.(id); },
    } });
  return pg;
}
