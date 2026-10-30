// 通话识别设置；旧语言包缓存和用户配置保留，不再用于自动多语言通话。
import { S, page, esc, form, save } from '../../core.js';
import { asrCfg } from '../chat/ear.js';
export async function askSfKey() {
  const c = asrCfg(), r = await form('自动多语言识别', [['url', '接口地址', 'text'], ['model', '识别模型', 'text'], ['key', 'API 密钥', 'password']], { ...c, key: S.callAsr?.key || '' });
  if (!r) return false; S.callAsr = { url: String(r.url || c.url).trim(), model: String(r.model || c.model).trim(), key: String(r.key || '').trim() }; save(); return !!asrCfg().key;
}
export function langPage() {
  const p = page({ title: '语音识别', cls: 'set', body: () => { const c = asrCfg(); return `<div class="card"><div class="row"><span>输入语言</span><b>自动识别 · 中 / 日 / 英 / 韩 / 粤</b></div><div class="row" data-a="cfg"><span><b>${esc(c.model)}</b><small>${esc(c.url)}</small></span><b class="lnk">${c.key ? '已配置' : '配置'}</b></div></div>`; }, acts: { cfg: async () => { await askSfKey(); p.re(); } } });
}
