// 小手机 · 模块配置：每个会调用模型的功能（模块）都能单独选模型、流式、低思考，并且换提示词。
// 提示词只换「内容 / 风格」那一段；输出格式由代码固定接在后面，所以换成自己写的也不会解析失败。
// 系统默认的不能改，但可以新增自己的提示词、保存、切换、删除；生成时按当前选中的那条走。
// 存在 S.mods[模块] = { use: 模型（空=跟随）, stream: ''|'on'|'off', think: ''|'low'|'full', cur: 选中的提示词 id（空=系统默认）, list: [{ id, n, t }] }
import { S, C } from './core.js';

// 所有「替角色说话」的模块都固定接上这段（不跟着自定义提示词换掉）：去掉模型写中文时最常见的 AI 腔
export const NOAI = `【别有 AI 味】
- 不用“不是……而是……”“与其说……不如说……”这种先否定再翻转的句子；不凑三连排比；不用破折号串句子。
- 不拿金句、总结、感悟收尾，不升华，不讲道理。
- 不堆套话：仿佛、某种、一丝、一抹、弧度、眼底闪过、指节泛白、空气凝固、心照不宣、不易察觉。写具体的事、具体的话。
- 情绪从说的话和做的事里带出来，不旁白解释“他很难过”。
- 不像客服：不说“好的呢”“我一直都在”“希望能帮到你”，不复述、不总结对方的话。
- 句子长短不齐；按人设可以有口头禅、错字、话说一半、只回一两个字。`;

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
