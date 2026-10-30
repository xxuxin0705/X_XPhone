// 免费本地识别，无识别 API 密钥；语言模型随插件提供，运行库在浏览器缓存解压结果。
import { S, page, save } from '../../core.js';
import { LOCAL_LANGS } from '../chat/local-speech.js';
export function langPage() {
  const p = page({ title: '本地语音识别', cls: 'set', body: () => `<div class="card">${LOCAL_LANGS.map(([id, name, code, mb]) => `<div class="row" data-a="lang" data-x="${id}"><span><b>${name}</b><small>${mb}MB · 本地免费</small></span><b>${(S.callInputLang || 'zh-CN') === id ? '默认' : '已内置'}</b></div>`).join('')}</div>`, acts: { lang: id => { S.callInputLang = id; save(); p.re(); } } });
}
