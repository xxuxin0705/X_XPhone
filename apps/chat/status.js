// 小手机 · 微信「状态」（照录屏）：「我」页的「＋ 状态」/ 朋友状态入口 → 状态列表（按状态分组）→ 全屏看某个人的状态（双击点赞、上下滑换人）
// 设个状态：填写状态 / 选一个图标 → 写点什么、#话题、背景图、位置 → 就这样。朋友 24 小时内可见，过了就消失。
// 图标是从录屏里抠的（assets/wx/st/*.png，白色带透明，用 mask 上色）。朋友的状态：可以手动给 TA 设，也可以在列表右上角让 AI 一次给大家都更新（这一步调聊天模型）。
import { S, D, saveD, esc, page, back, top, menu, form, toast, avOf, meObj, nm, rn, now, llm, json, sysCtx, task, emit, pickImg, drop } from '../../core.js';
import { get, find } from './data.js';
import { mapPick } from './map.js';

// 状态图标（照微信「设个状态」的分组）；k = 图标文件名
export const STC = [
  ['心情想法', [['mzz', '美滋滋'], ['lk', '裂开'], ['jl', '求锦鲤'], ['dtq', '等天晴'], ['py', '疲惫'], ['fd', '发呆'], ['chong', '冲'], ['emo', 'emo'], ['hs', '胡思乱想'], ['yq', '元气满满'], ['bot', 'bot']]],
  ['工作学习', [['bz', '搬砖'], ['xx', '沉迷学习'], ['mang', '忙'], ['my', '摸鱼'], ['cc', '出差'], ['fb', '飞奔回家'], ['wr', '勿扰模式']]],
  ['活动', [['lang', '浪'], ['dk', '打卡'], ['yd', '运动'], ['kf', '喝咖啡'], ['nc', '喝奶茶'], ['zhai', '宅']]],
];
const ALL = STC.flatMap(([, L]) => L), LB = Object.fromEntries(ALL), DAY = 864e5;
const IMG = k => new URL(`../../assets/wx/st/${LB[k] ? k : 'qt'}.png`, import.meta.url).href;
const UI = n => `<img class="svi" src="${new URL(`../../assets/wx/st/i-${n}.png`, import.meta.url).href}" alt="">`; // 看状态 / 写状态页上的小按钮（抠自录屏）
export const stIco = (k, cls = '') => `<i class="sti ${cls}" style="--sti:url('${IMG(k)}')"></i>`;
// 每种状态一个渐变底（看状态、设状态的页面）；自己挑了背景图就用图
const GR = [['#a9c27a', '#d9a253'], ['#e8b59c', '#c7b3e0'], ['#9fc6d8', '#c9b6e6'], ['#e7c07c', '#e49a7a'], ['#a8d1b4', '#d6c27e'], ['#c5b0e0', '#e8a5b8']];
const gr = k => { const g = GR[[...String(k || 'qt')].reduce((a, c) => a + c.charCodeAt(0), 0) % GR.length]; return `background:linear-gradient(160deg,${g[0]},${g[1]})`; };
const bgOf = s => s?.bg ? `background:#333 url('${esc(s.bg)}') center/cover` : gr(s?.k);

// 谁有状态（24 小时内）
export const stOf = c => { const s = c?.st; return s && now() - s.ts < DAY ? s : null; };
const meS = () => stOf(D().me);
const pals = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0 && stOf(c));
export const stLabel = s => lbl(s);
const lbl = s => s.k == 'qt' ? s.l || '其他' : LB[s.k] || s.l || '其他';
const ago = ts => { const m = (now() - ts) / 6e4; return m < 1 ? '刚刚' : m < 60 ? (m | 0) + '分钟前' : (m / 60 | 0) + '小时前'; };

/* ---------- 「我」页上的两个小胶囊 ---------- */
export const mePills = () => { const s = meS(), P = pals();
  return `<div class="wm-ps"><span class="wm-st" data-a="stme">${s ? stIco(s.k) + esc(lbl(s)) : '＋ 状态'}</span>${P.length ? `<span class="wm-st wm-fr" data-a="stlist">${P.slice(0, 3).map(c => `<img src="${esc(avOf(c))}">`).join('')}${P.length > 3 ? `等${P.length}个朋友` : `${P.length}个朋友`}<i class="wm-dot"></i></span>` : ''}</div>`; };

/* ---------- 状态列表：按状态分组，「我和 N 个朋友在 X」 ---------- */
export function stList() {
  page({ title: '状态', cls: 'stpg', live: 1, right: () => '<b data-a="stmore">···</b>', body: () => {
    const s = meS(), G = new Map(), add = (c, x) => { const k = x.k == 'qt' ? 'qt:' + lbl(x) : x.k; G.has(k) || G.set(k, { x, L: [] }); G.get(k).L.push(c); };
    s && add('me', s); pals().forEach(c => add(c, c.st));
    const card = c => c == 'me' ? `<div class="sl-p" data-a="stview" data-x="me"><img src="${esc(avOf(meObj()))}"><small>${esc(meObj().nick)}</small></div>` : `<div class="sl-p" data-a="stview" data-x="${c.id}" data-lp="stlp"><img src="${esc(avOf(c))}"><small>${esc(nm(c))}</small></div>`;
    return `<div class="sl-top"><div class="sl-add" data-a="stnew"><i>＋</i><small>发一个</small></div>${s ? `<div class="sl-add on" data-a="stview" data-x="me">${stIco(s.k)}<small>今天</small></div>` : ''}</div>`
      + `<div class="sl-g">${[...G.values()].map(({ x, L }) => { const me = L.includes('me'), n = L.length - me; return `<div class="sl-r"><h6>${stIco(x.k)}${me ? n ? `我和${n}个朋友在` : '我在' : `${n}个朋友在`}${esc(lbl(x))}</h6><div class="sl-ps">${L.map(card).join('')}</div></div>`; }).join('') || '<p class="sl-e">朋友们还没有设状态</p>'}</div>`; },
    acts: SA });
}

/* ---------- 全屏看状态：上面头像 + 内容 + 时间，中间大图标，下面状态名 + 赞 / 评论；双击点赞，上下滑换人 ---------- */
export function stView(id) {
  const order = () => [...(meS() ? ['me'] : []), ...pals().map(c => c.id)];
  let cur = id, hint = !S.stTip;
  const who = () => cur == 'me' ? meObj() : get(cur), sx = () => cur == 'me' ? meS() : stOf(get(cur));
  const P = page({ title: '', noBack: 1, cls: 'stv', live: 1, body: () => { const s = sx(), c = who(); if (!s) return '<p class="sl-e">状态已过期</p>';
    return `<div class="sv" style="${bgOf(s)}">${s.bg ? '' : stIco(s.k, 'sv-big')}<div class="sv-h"><img src="${esc(avOf(c))}" data-a="stprof"><div data-a="stprof"><b>${esc(s.t || lbl(s))}</b><small>${ago(s.ts)}${s.loc ? ' · ' + esc(s.loc) : ''}</small></div><i class="sv-x" data-a="back">×</i></div>
${s.tr && s.tr != s.t ? `<p class="sv-tr">${esc(s.tr)}</p>` : ''}${hint ? `<div class="sv-tip"><i>${UI('tap')}</i>双击点赞</div>` : ''}
<div class="sv-f"><span>${stIco(s.k)}${esc(lbl(s))}${s.tp ? ` <em>#${esc(s.tp)}</em>` : ''}</span>${cur == 'me' ? '<b data-a="stmine">···</b>' : `<b class="sv-lk ${s.lk ? 'on' : ''}" data-a="stlike">${UI('like')}</b><b data-a="stcmt">${UI('cmt')}</b>`}</div>${order().length > 1 ? '<p class="sv-more">︿<br>滑动查看朋友的状态</p>' : ''}</div>`; },
    after: el => { const sv = el.querySelector('.sv'); if (!sv) return; let y0 = 0, t0 = 0, last = 0;
      sv.addEventListener('pointerdown', e => { y0 = e.clientY; t0 = Date.now(); });
      sv.addEventListener('pointerup', e => { const dy = e.clientY - y0, L = order(), i = L.indexOf(cur);
        if (Math.abs(dy) > 60 && Date.now() - t0 < 600) { const j = i + (dy < 0 ? 1 : -1); if (L[j]) { cur = L[j]; P.re(); } return; } // 上滑下一个，下滑上一个
        if (e.target.closest('[data-a]')) return; const t = Date.now(); if (t - last < 300 && cur != 'me') { SA.stlike(null, null, null, P, 1); last = 0; } else last = t; }); }, // 双击点赞
    acts: { ...SA, stlike: (x, t, e, pg, dbl) => { const s = sx(); if (!s) return; s.lk = dbl ? 1 : !s.lk; S.stTip = 1; hint = false; saveD(); P.re(); s.lk && P.el.querySelector('.sv-lk')?.classList.add('pop'); },
      stprof: () => cur != 'me' && import('./wx.js').then(m => m.wxProf(cur)),
      stcmt: async () => { const c = get(cur), s = sx(); if (!c || !s) return; const r = await form('回复TA的状态', [['c', '说点什么…']]); if (!r?.c) return;
        c.msgs.push({ f: 'me', t: 'text', c: r.c.trim(), stq: lbl(s) + (s.t ? '：' + s.t : ''), ts: +now() }); saveD(); emit('chat'); toast('已发送给' + nm(c)); },
      stmine: async () => { const k = await menu([['re', '修改状态'], ['d', '清除状态', 'danger']]); if (k == 're') { back(); setSt(); } if (k == 'd') { delete D().me.st; saveD(); emit('chat'); back(); } } } });
}

/* ---------- 设个状态 → 写一写 → 就这样 ---------- */
export function setSt(c = null) { // c：给朋友设（手动）；不传就是给自己
  const P = page({ title: '', noBack: 1, cls: 'stv stset', body: () => `<div class="sv ss" style="${gr('mzz')}"><div class="ss-h"><i class="sv-x" data-a="back">×</i><b>${c ? `给${esc(nm(c))}设个状态` : '设个状态'}</b><small>朋友24小时内可见</small></div>
<div class="ss-c ss-fill" data-a="stfill">${stIco('qt')}<small>填写状态</small></div>
${STC.map(([n, L]) => `<div class="ss-c"><h6>${n}</h6><div class="ss-g">${L.map(([k, l]) => `<div data-a="stpick" data-x="${k}">${stIco(k)}<small>${esc(l)}</small></div>`).join('')}</div></div>`).join('')}</div>`,
    acts: { back: () => back(), stpick: k => compose({ k }, c),
      stfill: (x, t) => { const b = t.closest('.ss-fill'); if (b.classList.contains('ed')) return; b.classList.add('ed'); b.innerHTML = `${stIco('qt')}<input class="ss-in" placeholder="填写状态" maxlength="12"><div class="ss-ok"><b data-k="x">取消</b><b data-k="y">完成</b></div>`;
        const i = b.querySelector('input'); i.focus(); b.querySelector('.ss-ok').onclick = e => { e.stopPropagation(); const k = e.target.dataset.k; if (k == 'x') return P.re(); const v = i.value.trim(); if (!v) return toast('写个状态吧'); compose({ k: 'qt', l: v }, c); }; } } });
}
function compose(st, c) {
  const d = { t: '', tp: '', bg: '', loc: '', ...st };
  const P = page({ title: '', noBack: 1, cls: 'stv stcmp', body: () => `<div class="sv sc" style="${bgOf(d)}"><div class="ss-h"><i class="sv-x" data-a="back">×</i></div>
<span class="sc-chip" data-a="back">${stIco(d.k)}${esc(lbl(d))} ›</span><textarea class="sc-t" placeholder="说点什么…" maxlength="60">${esc(d.t)}</textarea><span class="sc-tp" data-a="sctp">#${esc(d.tp || '话题')}</span>${d.loc ? `<span class="sc-tp sc-loc">${UI('loc')}${esc(d.loc)}</span>` : ''}
<div class="sc-f"><b data-a="scbg">${UI('bg')}<small>背景</small></b><b data-a="scloc">${UI('loc')}<small>位置</small></b><b>${UI('pub')}<small>公开</small></b><em data-a="scok">就这样</em></div></div>`,
    after: el => { const t = el.querySelector('.sc-t'); t.oninput = () => d.t = t.value; },
    acts: { back: () => back(),
      sctp: async () => { const r = await form('话题', [['tp', '话题（不用写 #）']], { tp: d.tp }); if (r) { d.tp = String(r.tp || '').replace(/^#/, '').trim(); P.re(); } },
      scbg: async () => { const v = await pickImg(1080, 'cover'); if (v == null) return; d.bg = v; P.re(); },
      scloc: async () => { const r = await mapPick({ title: '位置', area: d.loc }); if (r) { d.loc = r.area; P.re(); } },
      scok: () => { const o = c || D().me; o.st && o.st.bg && o.st.bg != d.bg && drop(o.st.bg); o.st = { k: d.k, ...(d.k == 'qt' && { l: d.l }), t: d.t.trim(), tp: d.tp, bg: d.bg, loc: d.loc, ts: +now() };
        saveD(); emit('chat'); back(); back(); toast('状态已更新'); top()?.re?.(); } } });
}

/* ---------- 让 AI 给朋友们更新状态（自己点了才调用一次聊天模型） ---------- */
async function genSt() {
  const L = D().chats.filter(c => c.type == 'p' && c.fr !== 0); if (!L.length) return toast('还没有朋友');
  return task('正在更新朋友的状态', async sg => {
    const keys = ALL.map(([k, l]) => `${k}=${l}`).join('，');
    const r = json(await llm(await sysCtx(), `根据剧情和人设，给下面这些人各设一个微信「状态」（此刻在干嘛 / 什么心情），不想设的可以跳过。\n人：${L.map(c => rn(c) + (c.cfg?.lang ? `（用${c.cfg.lang}说话）` : '')).join('、')}\n可选图标：${keys}；都不合适就用 qt 并在 l 里写 2～6 个字的自定义状态（如「想睡觉」）。\nt 是 TA 配的一句话（可空，用 TA 自己的语言），tr 是 t 的中文译文（t 是中文就留空）。\n只输出 JSON：{"status":[{"name":"名字","k":"图标","l":"","t":"","tr":""}]}`, '朋友状态', sg));
    let n = 0; (r?.status || []).forEach(x => { const c = find(x.name, 'p'); if (!c || !L.includes(c)) return; const k = LB[x.k] ? x.k : 'qt'; c.st = { k, ...(k == 'qt' && { l: String(x.l || '其他').slice(0, 8) }), t: String(x.t || ''), tr: String(x.tr || ''), ts: +now() - Math.random() * 3 * 36e5 }; n++; });
    saveD(); emit('chat'); return n ? `${n} 个朋友更新了状态` : '这次没有人更新状态';
  });
}

export const SA = {
  stme: (x, t, e) => { e?.stopPropagation(); meS() ? stView('me') : setSt(); },
  stlist: (x, t, e) => { e?.stopPropagation(); stList(); },
  stnew: () => setSt(), stview: id => stView(id),
  stmore: async () => { const k = await menu([['g', '让朋友们更新状态（AI）'], ...(meS() ? [['d', '清除我的状态', 'danger']] : [])]); if (k == 'g') genSt(); if (k == 'd') { delete D().me.st; saveD(); emit('chat'); } },
  stlp: async id => { const c = get(id); if (!c) return; const k = await menu([['s', `给${esc(nm(c))}设状态`], ['d', '清除TA的状态', 'danger']]); if (k == 's') setSt(c); if (k == 'd') { delete c.st; saveD(); emit('chat'); } },
};
