// 小手机 · 模块配置：每个会调用模型的功能（模块）都能单独选模型、流式、低思考，并且换提示词。
// 提示词只换「内容 / 风格」那一段；输出格式由代码固定接在后面，所以换成自己写的也不会解析失败。
// 系统默认的不能改，但可以新增自己的提示词、保存、切换、删除；生成时按当前选中的那条走。
// 存在 S.mods[模块] = { use: 模型（空=跟随）, stream: ''|'on'|'off', think: ''|'low'|'full', cur: 选中的提示词 id（空=系统默认）, list: [{ id, n, t }] }
import { S, C } from './core.js';

export const MODS = []; // { k, app, n, def: 默认文本 或 () => 文本, vars: [[变量名, 说明]] }
export const regMod = m => { const i = MODS.findIndex(x => x.k == m.k); i >= 0 ? (MODS[i] = m) : MODS.push(m); return m; };
export const modOf = k => MODS.find(x => x.k == k);
export function mcfg(k) {
  const all = S.mods ||= {};
  if (!all[k]) { all[k] = { use: '', stream: '', think: '', cur: '', list: [] }; if (k == 'eye.forum' && S.api?.chat?.eyef) all[k].use = S.api.chat.eyef; } // 以前论坛的模型单独放在 API 页
  return all[k];
}
export const defText = k => { const d = modOf(k)?.def; return typeof d == 'function' ? d() : d || ''; };
// 当前生效的提示词：用户选的那条，没有就系统默认；模块变量（{{形态}} 之类）、{{char}} {{user}} 都换成实际的
export function mp(k, vars = {}) {
  const c = S.mods?.[k], cur = c?.cur && c.list?.find(x => x.id == c.cur);
  let t = cur ? cur.t : defText(k);
  for (const [a, b] of Object.entries(vars)) t = t.replaceAll(`{{${a}}}`, String(b ?? ''));
  const x = C(); t = x.substituteParams?.(t) ?? t;
  return t.replaceAll('{{char}}', x.name2 || '').replaceAll('{{user}}', x.name1 || '');
}
