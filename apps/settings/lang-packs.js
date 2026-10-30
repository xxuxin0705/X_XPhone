// 设置 · 语音识别语言包：通话里「我说 X」用什么把声音认成字
// - 中文：内置的本地识别（asr/ 文件夹，约 39MB，不联网、不花钱、不要密钥）
// - 别的语言：装了这门语言的本地包就用本地包；没装就用云端识别（硅基流动的 SenseVoice，免费，听得懂中英日韩粤，要一个硅基流动密钥）
// - 日语本地包：sherpa-onnx 离线识别网页版 + Moonshine 日语小模型（下载约 51MB，解开 85MB），下一次存进浏览器（见 local-asr.js）
//   日语模型是 Moonshine AI Community License（个人、非商业免费），要写「Powered by Moonshine AI」
import { S, page, esc, form, save, toast } from '../../core.js';
import { asrCfg, sfKey } from '../chat/ear.js';
import { freePage } from './free-models.js';
import { installPack, removePack, packInstalled, packMB } from '../chat/local-asr.js';

export const PACKS = [
  { L: 'zh-CN', n: '中文', mb: 39, st: 'builtin', d: '内置，默认就用它。手机上直接认，不联网、不花钱，边说边出字' },
  { L: 'ja-JP', id: 'ja', n: '日语', mb: packMB('ja'), st: 'ready', d: 'Moonshine 日语小模型（很准）。装好以后说日语也不联网、不花钱；说完一句要认一两秒' },
];
const SF = { site: 'https://cloud.siliconflow.cn', key: 'https://cloud.siliconflow.cn/account/ak' };
// 这门语言有没有本地识别（中文内置；别的要装了语言包）
export const packOn = L => L == 'zh-CN' || PACKS.some(p => p.L == L && p.st == 'ready' && S.asrPacks?.[L]);
// 云端识别的密钥是哪来的（给人看）
const keyFrom = () => S.callAsr?.key ? '这里填的' : S.api?.img?.cfg?.sf?.key ? '画图那里填的硅基流动密钥' : sfKey() ? '免费模型里加的硅基流动配置' : '';
const copy = async t => { try { await navigator.clipboard.writeText(t); } catch { const a = Object.assign(document.createElement('textarea'), { value: t }); document.body.append(a); a.select(); try { document.execCommand('copy'); } catch { } a.remove(); } toast('已复制：' + t); };
export async function askSfKey() {
  const r = await form('填硅基流动的密钥', [['key', 'API 密钥', 'text', 'sk-…'], ['', '在 cloud.siliconflow.cn 用手机号注册，「API 密钥」那一页新建一个复制过来。识别模型 SenseVoice 免费', 'tip']], { key: S.callAsr?.key || '' });
  if (!r) return false; const k = String(r.key || '').trim(); (S.callAsr ||= {}).key = k; save(); toast(k ? '保存了：说别的语言会用云端识别' : '清掉了这里填的密钥'); return !!k;
}

export function langPage() {
  let job = null; // 正在下载：{ L, pct, ac }
  const pg = page({ title: '语音识别语言包', cls: 'set freem',
    body: () => { const c = asrCfg(), kf = keyFrom();
      return `<p class="tip">打电话时点「我说 …」换语言。中文用内置的本地识别；说别的语言时，装了本地包就用本地包，没装就用云端识别。本地模型一个只认一种语言，想中日英混着说、不换来换去，选「混着说」（走云端识别）。</p>
<h6>本地语言包</h6><div class="card">${PACKS.map(p => `<div class="row"><span><b>${esc(p.n)}</b><small>${p.st == 'builtin' ? '' : '下载 '}${p.mb}MB · ${esc(p.d)}</small></span>${p.st == 'builtin' ? '<small class="lp-st">内置</small>' : job?.L == p.L ? `<small class="lp-st lp-p">${job.pct || 0}%</small><b class="lnk" data-a="stop">取消</b>` : S.asrPacks?.[p.L] ? `<small class="lp-st">已装</small><b class="lnk" data-a="rm" data-x="${p.L}">删除</b>` : `<b class="lnk" data-a="get" data-x="${p.L}">下载</b>`}</div>`).join('')}</div>
<p class="tip">语言包只下一次，存在这个浏览器里（换浏览器或清了网站数据要重下）。下到一半断了，再点「下载」只补没下完的部分。日语识别 Powered by Moonshine AI（Moonshine AI Community License，个人非商业使用免费）。</p>
<h6>云端识别（硅基流动，免费）${c.key ? '<em class="fm-on">能用</em>' : ''}</h6><div class="card">
<div class="row"><span><b>听得懂</b><small>中文、英语、日语、韩语、粤语。要联网，声音会发给硅基流动认字；识别模型 ${esc(c.model)} 不要钱</small></span></div>
<div class="row" data-a="key"><span><b>密钥</b><small>${c.key ? '已有（' + esc(kf) + '）' : '还没有：点这里填'}</small></span><b class="lnk">${c.key ? '换一个' : '填写'}</b></div>
<div class="row fm-l"><span>拿密钥</span><a class="lnk" href="${SF.key}" target="_blank" rel="noopener">打开</a><b class="lnk" data-a="cp" data-x="${SF.key}">复制</b></div>
<div class="row" data-a="free"><span><b>顺便加免费聊天模型</b><small>同一个硅基流动密钥还能免费聊天（设置 → 免费模型）</small></span><b class="lnk">去看看</b></div></div>`; },
    acts: {
      key: async () => { await askSfKey(); pg.re(); },
      cp: u => copy(u),
      free: () => freePage(() => pg.re()),
      get: async L => { if (job) return toast('正在下载，等它下完'); const p = PACKS.find(x => x.L == L); job = { L, pct: 0, ac: new AbortController() }; pg.re();
        try { await installPack(p.id, o => { if (!job) return; job.pct = o.pct; const e = pg.el?.querySelector('.lp-p'); e ? e.textContent = o.pct + '%' : 0; }, job.ac.signal); (S.asrPacks ||= {})[L] = 1; save(); toast(`${p.n}本地包装好了：打电话点「我说 ${p.n}」就用它`); }
        catch (e) { job?.ac.signal.aborted ? toast('取消了，下好的部分留着，下次接着下') : toast(e.message); }
        job = null; pg.re(); },
      stop: () => job?.ac.abort(),
      rm: async L => { const p = PACKS.find(x => x.L == L); await removePack(p.id); delete S.asrPacks?.[L]; save(); toast('删掉了'); pg.re(); },
    } });
  // 浏览器数据被清过：记着装了但其实没有了 → 改回没装
  (async () => { let ch = 0; for (const p of PACKS) if (p.id && S.asrPacks?.[p.L] && !await packInstalled(p.id)) { delete S.asrPacks[p.L]; ch = 1; } ch && (save(), pg.re()); })();
  return pg;
}
