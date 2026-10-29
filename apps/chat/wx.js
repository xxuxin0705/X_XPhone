// 消息 · 微信样式的外壳：底栏（微信 / 通讯录 / 发现 / 我）、发现页、「我」页，照着现在的微信来
import { S, D, saveD, esc, roll, page, fx, form, toast, avOf, meObj, emit, C, nm, back, menu } from '../../core.js';
import { openFeed, FA, postImages } from './feed.js';
import { get, sty } from './data.js';
import { openChat, cset } from './talk.js';
import { minePage } from './sticker.js';

const O = d => `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const F = d => `<svg viewBox="0 0 28 28" fill="currentColor">${d}</svg>`;
const BUB = 'M14 4.5C8.2 4.5 3.5 8.4 3.5 13.2c0 2.6 1.4 5 3.6 6.6l-.8 3.6 4.2-2.2c1.1.3 2.3.5 3.5.5 5.8 0 10.5-3.9 10.5-8.6S19.8 4.5 14 4.5z';
// 底栏图标：[没选中, 选中]
export const WT = {
  list: [O(`<path d="${BUB}"/>`), F(`<path d="${BUB}"/>`)],
  ct: [O('<circle cx="11" cy="9.5" r="4.6"/><path d="M3.5 23.5c.6-4.6 3.6-7.4 7.5-7.4 2 0 3.7.7 5 2"/><path d="M18.5 14.5h6M18.5 18.5h6M20.5 22.5h4"/>'),
    F('<circle cx="11" cy="9.5" r="5"/><path d="M3 24c.6-5 3.8-8.2 8-8.2s7.4 3.2 8 8.2z"/><rect x="19" y="13.6" width="6.5" height="2" rx="1"/><rect x="20" y="17.6" width="5.5" height="2" rx="1"/><rect x="21" y="21.6" width="4.5" height="2" rx="1"/>')],
  feed: [O('<circle cx="14" cy="14" r="10.3"/><path d="M17.9 10.1l-2.2 5.6-5.6 2.2 2.2-5.6z"/>'),
    `<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="currentColor"/><path d="M18.4 9.6l-2.5 6.3-6.3 2.5 2.5-6.3z" fill="#fff"/><circle cx="14" cy="14" r="1.3" fill="currentColor"/></svg>`],
  me: [O('<circle cx="14" cy="9" r="5"/><path d="M4.5 24c.8-5.2 4.6-8.4 9.5-8.4s8.7 3.2 9.5 8.4z"/>'), F('<circle cx="14" cy="9" r="5.3"/><path d="M4 24.5c.8-5.6 4.8-9 10-9s9.2 3.4 10 9z"/>')],
};
export const WTN = { list: '微信', ct: '通讯录', feed: '发现', me: '我' };

const CH = '<svg class="wx-ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9.5 6l6 6-6 6"/></svg>';
// 列表行左边的彩色小图标
const IC = {
  sv: '<svg viewBox="0 0 24 24" fill="none" stroke="#07c160" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c-5 0-9 3.4-9 7.6 0 2.2 1.1 4.2 2.9 5.6L5 20.3l3.8-1.8c1 .3 2.1.4 3.2.4 5 0 9-3.4 9-7.6s-4-7.8-9-7.8z"/><path d="M8.3 11.3l2.6 2.5 4.9-4.9"/></svg>',
  al: '<svg viewBox="0 0 24 24" fill="none" stroke="#2f7de1" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M3.5 17l5.2-5.4 4 4 2.6-2.6 5.2 5"/><circle cx="16" cy="9" r="1.4"/></svg>',
  em: '<svg viewBox="0 0 24 24" fill="none" stroke="#f2b632" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".6" fill="#f2b632"/><circle cx="15" cy="10" r=".6" fill="#f2b632"/><path d="M7.8 13.5c.9 2 2.4 3 4.2 3s3.3-1 4.2-3"/></svg>',
  st: '<svg viewBox="0 0 24 24" fill="none" stroke="#2f7de1" stroke-width="1.8" stroke-linejoin="round"><path d="M10.3 3h3.4l.5 2.4 1.7.9 2.3-.9 1.7 2.9-1.8 1.6v2.2l1.8 1.6-1.7 2.9-2.3-.9-1.7.9-.5 2.4h-3.4l-.5-2.4-1.7-.9-2.3.9-1.7-2.9 1.8-1.6v-2.2L4.1 8.3l1.7-2.9 2.3.9 1.7-.9z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  qr: '<svg class="wm-qr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M13.5 13.5h3v3h-3zM18.5 18.5h2v2h-2zM13.5 18.5h2.5M18.5 13.5h2"/></svg>',
};
const row = (a, ic, l, r = '') => `<div class="wx-r" data-a="${a}"><i class="wx-i">${ic}</i><b>${l}</b><span>${r}</span>${CH}</div>`;
const wxid = m => m.wxid || (m.wxid = 'wxid_' + Math.random().toString(36).slice(2, 12), saveD(), m.wxid);

// 我：头像、名字、微信号、二维码，下面一组组入口
export function wxMe() {
  const m = meObj(), me = D().me;
  return `<div class="wm-h" data-a="wmi"><img class="av" src="${esc(avOf(m))}"><div class="wm-t"><b>${esc(m.nick)}</b><small>微信号：${esc(wxid(me))}</small><div class="wm-ps"><span class="wm-st" data-a="wst">${me.sign ? esc(me.sign) : '＋ 状态'}</span></div></div>${IC.qr}${CH}</div>`
    + `<div class="wx-g">${row('wsv', IC.sv, '服务')}</div><div class="wx-g">${row('myfeed', IC.al, '朋友圈')}${row('wstk', IC.em, '表情')}</div><div class="wx-g">${row('wset', IC.st, '设置')}</div>`;
}
const sub = (title, body) => page({ title, cls: 'wxpg', model: () => D().me, body, acts: WXA });
export const WXA = {
  myfeed: () => openFeed('me'),
  wst: async (x, t, e) => { e?.stopPropagation(); const r = await form('设置状态', [['sign', '状态']], { sign: D().me.sign || '' }); if (r) { D().me.sign = String(r.sign || '').trim(); saveD(); emit('chat'); } },
  // 个人信息（照微信「个人资料」）：一行一项，右边是内容（长了就换行，整段显示），点一下改
  wmi: () => sub('个人信息', () => { const me = D().me, m = meObj(), r = (k, l, v, ph = '') => `<div class="wx-r wxi" data-a="wme" data-x="${k}"><b>${l}</b><span class="${v ? '' : 'emp'}">${esc(v || ph)}</span>${CH}</div>`;
    return `<div class="wx-g"><div class="wx-r" data-a="img" data-x="av"><b>头像</b><span><img class="av" src="${esc(avOf(m))}"></span>${CH}</div>${r('nick', '名字', m.nick)}${r('real', '真实姓名', me.real, C().name1 || '')}${r('sex', '性别', me.sex)}${r('region', '地区', me.region)}${r('wxid', '微信号', wxid(me))}${r('ps', '拍一拍', me.ps)}${r('bio', '签名', me.bio)}</div>
<div class="wx-g">${r('sign', '状态', me.sign)}</div>`; }),
  wme: async (k, t, e, pg) => { const me = D().me;
    if (k == 'sex') { const v = await menu([['男', '男'], ['女', '女'], ['n', '不显示']], '性别'); if (!v) return; me.sex = v == 'n' ? '' : v; }
    else { const L = { nick: '名字', real: '真实姓名', region: '地区', wxid: '微信号', ps: '拍一拍', bio: '签名', sign: '状态' }[k], r = await form(L, [[k, L, k == 'bio' ? 'area' : 'text', { ps: '如：的小脑袋', region: '如：日本 横滨市', wxid: '6-20 位字母、数字、下划线或减号' }[k] || '']], { [k]: me[k] || '' }); if (!r) return;
      let v = String(r[k] ?? '').trim(); if (k != 'bio') v = v.replace(/\s*\n\s*/g, ' ');
      if (k == 'wxid') { if (!/^[A-Za-z0-9_-]{6,20}$/.test(v)) return toast('微信号要 6-20 位，只能用字母、数字、下划线或减号'); }
      if (k == 'nick' && !v) return toast('名字不能为空');
      me[k] = v; }
    saveD(); emit('chat'); pg.re(); },
  wsv: () => sub('服务', () => `<div class="wsv"><div data-a="wwal"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15.5 14.5h2.5"/></svg><b>钱包</b><small>¥${roll('wal', D().me.wallet)}</small></div></div>`),
  wwal: async (x, t, e, pg) => { const r = await form('零钱余额', [['w', '余额', 'number']], { w: D().me.wallet || 0 }); if (r && r.w !== '' && !isNaN(+r.w)) { D().me.wallet = +r.w; saveD(); pg.re(); toast('已修改'); } },
  wstk: () => minePage(),
  wset: () => sub('设置', () => { const f = fx(D().me); return `<div class="wx-g">${f.img('cover', '朋友圈封面')}${f.img('fbg', '朋友圈背景')}</div>`; }),
};
export const wxTitle = tab => { if (tab != 'list') return WTN[tab]; const u = D().chats.reduce((a, c) => a + (c.unread || 0), 0); return u ? `微信(${u > 99 ? '99+' : u})` : '微信'; };

// 朋友的资料页（照微信）：头像名字微信号 → 朋友资料 → 朋友圈缩略图 → 发消息
export function wxProf(id) {
  const c = get(id); if (!c) return;
  const sx = c.sex == '女' ? '<i class="wp-sx f">♀</i>' : c.sex == '男' ? '<i class="wp-sx m">♂</i>' : '';
  const th = () => { const ps = D().posts.filter(p => p.a == id).sort((a, b) => b.ts - a.ts), L = ps.flatMap(p => postImages(p)).slice(0, 4);
    return L.length ? L.map(v => v.url ? `<img src="${esc(v.url)}">` : '<i class="wp-ph"></i>').join('') : ps[0] ? `<em>${esc(ps[0].c || '')}</em>` : ''; };
  page({ title: '', cls: 'wxprof', live: 1, body: () => `<div class="wp-h"><img class="av" src="${esc(avOf(c))}"><div><b>${esc(nm(c))}${sx}</b>${c.remark && c.nick ? `<small>昵称：${esc(c.nick)}</small>` : ''}<small>微信号：${esc(wxid(c))}</small></div></div>`
    + `<div class="wx-g"><div class="wx-r wp-fr" data-a="wpset"><div><b>朋友资料</b><small>添加朋友的备注名、电话、标签、备忘、照片等，并设置朋友权限。</small></div>${CH}</div></div>`
    + `<div class="wx-g"><div class="wx-r" data-a="wpfd"><b class="wp-l">朋友圈</b><span class="wp-th">${th()}</span>${CH}</div></div>`
    + `<div class="wx-g wp-b"><div data-a="wpchat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 2 1 3.9 2.7 5.1l-.6 2.9 3.3-1.7c1 .3 2 .5 3.1.5 4.7 0 8.5-3.1 8.5-6.9s-3.8-6.9-8.5-6.9z"/></svg>发消息</div></div>`,
    acts: { wpset: () => cset(c), wpfd: () => openFeed(id), wpchat: () => { back(); openChat(id); } } });
}
// 朋友圈里点头像 / 名字：微信样式先进资料页
const pf0 = FA.pfeed; FA.pfeed = (id, ...r) => id && id != 'me' && get(id)?.type == 'p' && sty(get(id)) == 'wx' ? wxProf(id) : pf0(id, ...r);
