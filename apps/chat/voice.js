// 小手机 · 音色：联系人的「专属音色」和设置 → 语音 → 角色库共用同一份数据（c.tv），一边改了另一边跟着变
// c.tv = { pv: 这个人用的服务商（空＝跟随全局）, v: { 服务商: 正在用的音色ID }, lib: { 服务商: [{ id, n: 名字 }] 保存过的音色 }, lang: MiniMax 朗读语言, say: [[写法, 读音]] }
import { C, S, D, save, saveD, esc, page, top, form, toast, btn, fx, nm, avOf, defAv, meObj, tts, task, voiceOf, pickVoice, ttsCfg, TTSP, ok } from '../../core.js';

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
  const now = pk.from == 'own' ? '音色：' + esc(pk.v) : pk.from == '男' || pk.from == '女' ? `${pk.from}声默认：${esc(pk.v)}` : pk.from == 'pv' ? '默认音色：' + esc(pk.v) : '还没配音色';
  return `<div class="vbox"><b>🎙 正在使用 <em>${esc(cur.name)}</em></b><small>${now}</small></div>`
    + (per ? f.sel('tv.pv', '语音服务商', [['', '跟随全局'], ...TTSP]) : '')
    + f.sel('tv.lang', '朗读语言<small>仅 MiniMax</small>', MML)
    + TTSP.map(([k, n]) => { const L = tv.lib?.[k] || [], v = tv.v?.[k] || '';
      return `<div class="col vrow"><span>${esc(n)}${k == vo.pv ? ' <em class="using">使用中</em>' : ''}</span><div class="vin"><input data-k="tv.v.${k}" value="${esc(v)}" placeholder="${esc(VPH2[k] || '音色 ID')}"><b class="pull" data-a="vsave" data-x="${k}">保存</b></div>`
        + (L.length ? `<div class="vlib">${L.map((x, i) => `<span class="vchip ${x.id == v ? 'on' : ''}" data-a="vuse" data-x="${k}:${i}">${esc(x.n || x.id)}<i data-a="vdel" data-x="${k}:${i}">×</i></span>`).join('')}</div>` : '') + '</div>'; }).join('')
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
    vuse: (x, t, e, pg) => { const [k, i, L] = at(x); if (!L[i]) return; (tv().v ||= {})[k] = L[i].id; keep(c); pg.re(); toast(`${pvName(k)}：换成「${L[i].n || L[i].id}」`); },
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
