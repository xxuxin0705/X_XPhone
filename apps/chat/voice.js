// 小手机 · 音色：联系人的「专属音色」和设置 → 语音 → 角色库共用同一份数据（c.tv），一边改了另一边跟着变
// c.tv = { pv: 这个人用的服务商（空＝跟随全局）, v: { 服务商: 正在用的音色ID }, lib: { 服务商: [{ id, n: 名字 }] 保存过的音色 }, lang: MiniMax 朗读语言, say: [[写法, 读音]] }
import { C, S, D, save, saveD, esc, $, page, top, form, toast, btn, fx, nm, avOf, defAv, meObj, tts, task, voiceOf, pickVoice, ttsCfg, TTSP, ok, menu } from '../../core.js';

export const VPH2 = { third: '音色 ID', mm: '例如 female-shaonv', mmi: '例如 female-shaonv', openai: '例如 alloy / nova', fish: '填 Fish 的 reference_id', eleven: '填 ElevenLabs 的 voice_id', index: '例如 default.wav / 角色.wav', mimo: '例如 mimo_default / 冰糖', volc: '例如 zh_female_xiaohe_uranus_bigtts' };
export const MML = [['auto', '自动识别'], ['Chinese', '中文'], ['Chinese,Yue', '粤语'], ['English', '英语'], ['Japanese', '日语'], ['Korean', '韩语'], ['French', '法语'], ['German', '德语'], ['Spanish', '西班牙语'], ['Russian', '俄语'], ['Thai', '泰语'], ['Vietnamese', '越南语']];
const pvName = k => TTSP.find(x => x[0] == k)?.[1] || k;

// 「我」（当前用的 User）的音色：按 User 名字存在设置里
export const meVoice = () => { const n = C().name1 || '我', U = (S.api.tts.users ||= {}); return U[n] ||= { id: 'me', real: n, nick: n, sex: '', tv: {} }; };
const isMe = c => c?.id == 'me';
const keep = c => isMe(c) ? save() : saveD();

// 一个人的音色设置（聊天信息、角色库里都用这一段）
export function vSec(c, f) {
  const a = S.api.tts, vo = voiceOf(c), cur = ttsCfg(vo.pv), tv = c.tv || {}, per = a.mode == 'per', pk = pickVoice(c, cur);
  const nmOf = (k, id) => (tv.lib?.[k] || []).find(x => x.id == id && x.n)?.n; // 保存时起过名字的音色：显示名字
  const now = pk.from == 'own' ? '音色：' + esc(nmOf(vo.pv, pk.v) || pk.v) : pk.from == '男' || pk.from == '女' ? `${pk.from}声默认：${esc(pk.v)}` : pk.from == 'pv' ? '默认音色：' + esc(pk.v) : '还没配音色';
  return `<div class="vbox"><b>🎙 正在使用 <em>${esc(cur.name)}</em></b><small>${now}</small></div>`
    + (per ? f.sel('tv.pv', '语音服务商', [['', '跟随全局'], ...TTSP]) : '')
    + (/^mmi?$/.test(vo.pv) ? f.sel('tv.lang', '朗读语言', MML) : '') // 只有 MiniMax 能指定朗读语言，用别家就不显示
    // 只显示正在用的那家服务商。保存过的音色排成一列：点一行就切换过去（圆点表示正在用），▶ 单独试听这一个（方便对比哪个好听），··· 改名 / 改 ID / 删除；
    // 下面「＋ 新增音色」再存一个，不会顶掉原来的。一个都没存过、或者现在填的 ID 还没存，就是输入框 + 保存
    + TTSP.filter(([k]) => k == vo.pv).map(([k, n]) => { const L = tv.lib?.[k] || [], v = tv.v?.[k] || '', ci = L.findIndex(x => x.id == v);
      const inp = !L.length || v && ci < 0;
      return `<div class="col vrow"><span>${esc(n)} <em class="using">使用中</em></span>`
        + (inp ? `<div class="vin"><input data-k="tv.v.${k}" value="${esc(v)}" placeholder="${esc(VPH2[k] || '音色 ID')}"><b class="pull" data-a="vsave" data-x="${k}">保存</b></div>` : '')
        + (L.length ? `<div class="vls">${L.map((x, i) => `<div class="vit ${i == ci ? 'on' : ''}" data-a="vuse" data-x="${k}:${i}"><i class="vrad"></i><span><b>${esc(x.n || x.id)}</b>${x.n ? `<small>${esc(x.id)}</small>` : ''}</span><b class="vbt" data-a="vtry1" data-x="${k}:${i}" aria-label="试听">▶</b><b class="vbt" data-a="vme" data-x="${k}:${i}" aria-label="更多">···</b></div>`).join('')}</div>` : '')
        + (L.length ? `<b class="vadd" data-a="vadd" data-x="${k}">＋ 新增音色</b>` : '') + '</div>'; }).join('')
    + `<div class="tts-ops"><b data-a="vtry">▶ 试听${isMe(c) ? '我' : '这个人'}的声音</b></div>`
    + `<div class="col"><span>适配读音</span>${(tv.say || []).map(([w, r], i) => `<div class="row say"><span>${esc(w)} → ${esc(r)}</span><b class="lnk danger" data-a="sayx" data-x="${i}">×</b></div>`).join('')}${btn('sayadd', '＋ 添加')}</div>`;
}
// 改了服务商 / 音色要重画（「使用中」、保存过的音色高亮）
export const vChange = k => /^tv\.(pv|v\.)/.test(k);
export const vActs = c => {
  const tv = () => c.tv ||= {}, at = x => { const [k, i] = String(x).split(':'); return [k, +i, (tv().lib ||= {})[k] ||= []]; };
  return {
    vtry: () => task('试听中', async sg => (await tts('你好呀，这是我现在的声音。', '', c.sex, sg, { c }), '✓ 已播放')),
    // 保存：把这个服务商现在填的音色存进列表（可以起个名字），以后点一下就能换回来
    vsave: async (k, t, e, pg) => { const id = String(tv().v?.[k] || '').trim(); if (!id) return toast('先填音色 ID'); const L = at(k + ':0')[2]; if (L.some(x => x.id == id)) return toast('已经保存过了');
      const r = await form('保存音色', [['n', '名字（可空）', 'text', id]]); if (!r) return; L.push({ id, n: (r.n || '').trim() }); keep(c); pg.re(); toast('已保存'); },
    vuse: (x, t, e, pg) => { const [k, i, L] = at(x); if (!L[i] || tv().v?.[k] == L[i].id) return; (tv().v ||= {})[k] = L[i].id; keep(c);
      t.closest('.vls')?.querySelectorAll('.vit').forEach((r, j) => r.classList.toggle('on', j == i)); $('.vbox small', pg.el) && ($('.vbox small', pg.el).textContent = '音色：' + (L[i].n || L[i].id)); }, // 原地换圆点，不重画整页
    // 单独试听某一个保存的音色（不切换），方便对比
    vtry1: x => { const [k, i, L] = at(x); L[i] && task(`试听「${L[i].n || L[i].id}」`, async sg => (await tts('你好呀，这是我现在的声音。', L[i].id, c.sex, sg, { c }), '✓ 已播放')); },
    // 新增：再存一个音色（名字 + ID），存完直接用上；原来的都还在
    vadd: async (k, t, e, pg) => { const r = await form('新增音色', [['id', '音色 ID', 'text', VPH2[k] || '音色 ID'], ['n', '名字（可空）', 'text', '如：温柔版']]); const id = String(r?.id || '').trim(); if (!id) return;
      const L = at(k + ':0')[2]; if (L.some(x => x.id == id)) return toast('这个音色已经保存过了'); L.push({ id, n: String(r.n || '').trim() }); (tv().v ||= {})[k] = id; keep(c); pg.re(); toast('已新增并切换'); },
    // 点现在用的那个名字：改名 / 换成别的音色 ID / 删除
    vme: async (x, t, e, pg) => { const [k, i, L] = at(x), it = L[i]; if (!it) return;
      const a = await menu([['n', '改名'], ['id', '改音色 ID'], ['d', '删除', 'danger']], esc(it.n || it.id)); if (!a) return;
      if (a == 'n') { const r = await form('改名', [['n', '名字', 'text', it.id]], { n: it.n || '' }); if (!r) return; it.n = String(r.n || '').trim(); }
      if (a == 'id') { const r = await form('改音色 ID', [['id', '音色 ID']], { id: it.id }); const id = String(r?.id || '').trim(); if (!id) return; const was = tv().v?.[k] == it.id; it.id = id; was && ((tv().v ||= {})[k] = id); }
      if (a == 'd') { if (!await ok(`删除保存的音色「${it.n || it.id}」？`)) return; const was = tv().v?.[k] == it.id; L.splice(i, 1); was && (tv().v[k] = L[0]?.id || ''); } // 删的是正在用的：换到剩下的第一个
      keep(c); pg.re(); },
    vdel: async (x, t, e, pg) => { const [k, i, L] = at(x); if (!L[i] || !await ok(`删除保存的音色「${L[i].n || L[i].id}」？`)) return; L.splice(i, 1); keep(c); pg.re(); },
    sayadd: async (x, t, e, pg) => { const r = await form('适配读音', [['w', '写法'], ['r', '读音']]); if (!r?.w || !r?.r) return; (tv().say ||= []).push([r.w.trim(), r.r.trim()]); keep(c); pg.re(); },
    sayx: (i, t, e, pg) => { tv().say.splice(+i, 1); keep(c); pg.re(); },
  };
};
// 一行简介：用哪个服务商、填了哪些音色
export function vBrief(c) {
  const vo = voiceOf(c), cur = ttsCfg(vo.pv), pk = pickVoice(c, cur), v = c.tv?.v || {}, n = Object.values(c.tv?.lib || {}).reduce((a, L) => a + L.length, 0);
  const set = Object.entries(v).filter(([, x]) => x).map(([k, x]) => `${pvName(k)}：${x}`);
  return { using: pk.from == 'own' ? `${cur.name} · ${pk.v}` : pk.from == 'none' ? `${cur.name} · 未配置音色` : `${cur.name} · 默认音色 ${pk.v}`, set, n, own: pk.from == 'own' };
}
// 设置 → 语音 → 角色库：所有联系人 + 我
export const people = () => [meVoice(), ...D().chats.filter(c => c.type == 'p' && c.fr !== 0)];
export function libList() {
  return `<div class="card vlist">${people().map(c => { const b = vBrief(c), me = isMe(c), av = me ? meObj().av || defAv(c.real || '我') : avOf(c);
    return `<div class="row vl" data-a="vopen" data-x="${esc(c.id)}"><img class="av" src="${esc(av || '')}"><span><b>${esc(me ? `我（${c.real}）` : nm(c))}</b><small class="${b.own ? 'ok' : ''}">${esc(b.using)}</small>${b.set.length > 1 || b.set.length && !b.own ? `<small>${esc(b.set.join(' · '))}</small>` : ''}${b.n ? `<small>已保存 ${b.n} 个音色</small>` : ''}</span><i class="chev">›</i></div>`; }).join('')}</div>`;
}
export function voicePage(c, onClose) {
  const f = fx(c), A = vActs(c);
  page({ title: (isMe(c) ? '我' : nm(c)) + '的音色', model: () => c, save: () => keep(c), onClose, body: () => vSec(c, f), acts: A,
    onChange: k => vChange(k) && setTimeout(() => { const t = top(); if (!t) return; const b = t.el.querySelector('.pg-b'), sc = b?.scrollTop; t.re(); t.el.querySelector('.pg-b').scrollTop = sc; }) });
}
