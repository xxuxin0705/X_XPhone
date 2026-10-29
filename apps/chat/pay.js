// 聊天 · 转账 / 红包（仿微信，照着真机录屏做）
//  发：发红包页（金额 / 祝福语 + 表情 / 红包封面 / 塞钱进红包）、转账页（收款人 + 金额 + 转账说明），自带数字键盘
//      → 「微信支付」加载 → 底部支付弹层（零钱 + 6 位密码，随便输）→ 加载 → 红包回到聊天 / 转账先到「支付成功」页
//  收：红包 = 红色卡片 + 金色「開」转一下 → 红包详情页；转账 = 「待你收款」页 → 收款 →「你已收款」页
import { S, D, saveD, esc, $, ui, page, back, toast, nm, avOf, emit, ok, form } from '../../core.js';
import { stkPage } from './sticker.js';

const HB_MAX = 200; // 单个红包上限（跟微信一样）
const wxid = c => c.wxid || (c.wxid = 'wxid_' + Math.random().toString(36).slice(2, 12), saveD(), c.wxid);
const mask = c => { const r = String(c.real || c.nick || '').trim(); return r ? `(*${[...r].at(-1)})` : ''; }; // 真名只露最后一个字：(*鑫)
const yuan = a => (+a || 0).toFixed(2);
const p2 = n => String(n).padStart(2, '0');
export const fullT = ts => { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
const reEmit = () => setTimeout(() => emit('chat')); // 详情页关掉后聊天页重画（在详情页里改的状态，聊天页那时不在最上面没刷新）
const sleep = ms => new Promise(r => setTimeout(r, ms));

const DEL = '<svg viewBox="0 0 24 24"><path d="M8.6 5h10.9A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H8.6a1.5 1.5 0 0 1-1.1-.5L2.6 12l4.9-6.5a1.5 1.5 0 0 1 1.1-.5Z" fill="currentColor"/><path d="m11.5 9.5 5 5m0-5-5 5" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';
const WXP = '<svg viewBox="0 0 40 40"><path d="M20 6C11.2 6 4 11.9 4 19.2c0 4 2.1 7.6 5.5 10l-1.3 4.3 5-2.6c2.1.6 4.4 1 6.8 1 8.8 0 16-5.9 16-13.2S28.8 6 20 6Z" fill="currentColor"/><path d="m13 19.5 4.6 4.3L28 14.5" fill="none" stroke="var(--wxpb,#4c4c4c)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOCK = '<svg viewBox="0 0 48 48" fill="none" stroke="#10adfd" stroke-width="2.6" stroke-linecap="round"><circle cx="24" cy="24" r="20"/><path d="M24 12v12.5l7.5 5"/></svg>';
const CHECK = '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#06c05f"/><path d="m14 24.5 7 6.8L34.5 17" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHK_S = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#06c05f"/><path d="m6.8 12.3 3.5 3.4L17.4 8.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SMILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8.3 14c.9 1.4 2.2 2.1 3.7 2.1s2.8-.7 3.7-2.1" stroke-linecap="round"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/></svg>';
const GEM = '<svg viewBox="0 0 32 32"><path d="M9 6h14l5 7-12 13L4 13z" fill="#ffc21a"/><path d="M4 13h24M12 6l-2 7 6 13 6-13-2-7" fill="none" stroke="#f0a800" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const COIN = '<i class="wxp-coin"></i>';
const DOTS = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
// 从真微信截图 / 录屏里抠下来的小图（assets/wx），不自己画
export const WXA = n => new URL(`../../assets/wx/${n}.png`, import.meta.url).href;

/* ---------- 浮层（不进页面栈）：加载提示 / 支付弹层 ---------- */
const layer = (cls, html) => { const w = Object.assign(document.createElement('div'), { className: cls }); w.innerHTML = html; ui.scr.append(w); requestAnimationFrame(() => w.classList.add('in')); return w; };
const unlayer = w => { w.classList.remove('in'); setTimeout(() => w.remove(), 220); };
// 「微信支付 ···」/「正在加载」小黑框
export async function loading(ms, txt) {
  const w = layer('wxl', `<div class="wxl-b">${txt ? '<i class="wxl-spin"></i>' : `<i class="wxl-i">${WXP}</i>`}<span>${txt || '微信支付'}</span>${txt ? '' : '<em class="wxl-d"><i></i><i></i><i></i></em>'}</div>`);
  await sleep(ms); unlayer(w);
}
// 支付弹层：× / 标题 / 金额 / 付款方式 零钱 / 6 个密码格 / 数字键盘；输满 6 位 → 微信支付加载 → resolve(true)；关掉 resolve(false)
function paySheet(title, amt) {
  return new Promise(done => {
    let pw = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k => `<b data-k="${k}" class="${k ? '' : 'nil'} ${k == 'del' ? 'del' : ''}">${k == 'del' ? DEL : k}</b>`).join('');
    const w = layer('wxps', `<div class="wxps-s"><b class="wxps-x" data-k="x">×</b><div class="wxps-m"><p class="wxps-t">${esc(title)}</p><div class="wxps-a"><i>¥</i>${yuan(amt)}</div>
<div class="wxps-pm"><span>付款方式</span><span>更改<i>⌄</i></span></div><div class="wxps-w">${COIN}<span>零钱</span><i class="wxps-ok"></i></div>
<div class="wxps-pw">${'<i></i>'.repeat(6)}</div></div><div class="wxps-k">${keys}</div></div>`);
    const end = r => { unlayer(w); done(r); };
    w.addEventListener('click', async e => {
      if (e.target == w) return end(false);
      const k = e.target.closest('[data-k]')?.dataset.k; if (k == null || w.dataset.go) return;
      if (k == 'x') return end(false);
      if (k == 'del') pw = pw.slice(0, -1); else if (k && pw.length < 6) pw += k;
      w.querySelectorAll('.wxps-pw i').forEach((x, i) => x.classList.toggle('on', i < pw.length));
      if (pw.length < 6) return;
      w.dataset.go = 1; await sleep(250);
      $('.wxps-s', w).classList.add('ing'); $('.wxps-m', w).innerHTML = `<p class="wxps-t">${esc(title)}</p><div class="wxps-a"><i>¥</i>${yuan(amt)}</div><div class="wxps-ld"><i class="wxl-i">${WXP}</i><span>微信支付</span><em class="wxl-d"><i></i><i></i><i></i></em></div>`;
      await sleep(1100); end(true);
    });
  });
}

/* ---------- 发红包 / 转账 ---------- */
// kind: 'tf' 转账 / 'hb' 红包；to：收款人（红包是当前聊天）；done({ amt, c, si, sn }) 付完钱后回调
export function payPage(to, kind, done) {
  let v = '', note = '', stk = null, kb = kind != 'hb'; const hb = kind == 'hb'; // 发红包：跟真微信一样，点了金额栏才弹键盘
  const num = () => +v || 0, over = () => hb && num() > HB_MAX;
  const key = k => {
    if (k == 'del') v = v.slice(0, -1);
    else if (k == '.') v = v.includes('.') ? v : (v || '0') + '.';
    else { if (/\.\d\d$/.test(v) || v.replace(/\..*/, '').length >= 6 && !v.includes('.')) return; v = v == '0' ? k : v + k; }
  };
  const sync = el => {
    const n = $('.pay-n', el); n.textContent = hb ? (v ? '¥' + v : '¥0.00') : v; n.classList.toggle('emp', hb && !v);
    $('.pay-cur', el)?.classList.toggle('on', kb);
    hb ? $('.hbs-big', el).innerHTML = `<i>¥</i>${yuan(num())}` : $('.pay-note', el).innerHTML = note ? `转账说明：${esc(note)} <u>修改</u>` : '添加转账说明';
    el.querySelectorAll('.pay-go').forEach(b => b.classList.toggle('dis', !(num() > 0) || over())); $('.pay-err', el)?.classList.toggle('on', over());
    $('.pg-f', el)?.classList.toggle('off', !kb); el.classList.toggle('kb', kb);
  };
  const go = async (pg) => {
    const a = Math.round(num() * 100) / 100; if (!(a > 0) || over()) return;
    if (a > (+D().me.wallet || 0)) return toast('零钱余额不足');
    kb = false; sync(pg.el); document.activeElement?.blur?.();
    await loading(800);
    if (!await paySheet(hb ? '微信红包' : `向${nm(to)}${mask(to) ? ' ' + mask(to) : ''}转账`, a)) return;
    back(true); done({ amt: a, c: note, ...(stk && { si: stk.img, sn: stk.name }) }); // 先关掉这页再记账，聊天页才会跟着刷新
    if (!hb) paidPage(to, a);
  };
  const keys = `<div class="pay-k">${['1', '2', '3', 'del', '4', '5', '6', '7', '8', '9', '0', '.'].map(k => `<b data-a="pk" data-x="${k}" class="${k == 'del' ? 'del' : k == '0' ? 'zero' : ''}">${k == 'del' ? DEL : k}</b>`).join('')}<b class="pay-go dis" data-a="${hb ? 'pkok' : 'pgo'}">${hb ? '确定' : '转账'}</b></div>`;
  const hbBody = () => `<div class="hbs"><p class="pay-err">单个红包金额不可超过${HB_MAX}元</p>
<div class="hbs-r" data-a="pfocus"><span>金额</span><b class="pay-n emp">¥0.00</b><em class="pay-cur"></em></div>
<div class="hbs-c"><div class="hbs-r nt"><input class="hbs-in" maxlength="25" placeholder="恭喜发财，大吉大利" value="${esc(note)}"><b class="hbs-sk" data-a="psk">${stk ? `<img src="${esc(stk.img)}">` : `<img class="hbs-smi" src="${WXA('smile-add')}">`}</b></div></div>
<div class="hbs-c"><div class="hbs-r go"><span>红包封面</span><i class="hbs-ar"></i></div>${note ? '<div class="hbs-r sub go"><span>根据祝福语推荐</span><i class="hbs-cv"></i><i class="hbs-ar"></i></div>' : ''}</div>
<div class="hbs-big"><i>¥</i>0.00</div><b class="hbs-go pay-go dis" data-a="pgo">塞钱进红包</b><p class="hbs-tip">可直接使用收到的零钱发红包</p></div>`;
  const tfBody = () => `<div class="pay"><div class="pay-h"><div><b>转账给 ${esc(nm(to))}${mask(to) ? ' ' + esc(mask(to)) : ''}</b><small>微信号：${esc(wxid(to))}</small></div><img src="${esc(avOf(to))}"></div><div class="pay-c"><small>转账金额</small><div class="pay-a" data-a="pfocus"><i>¥</i><span class="pay-n"></span><em class="pay-cur"></em></div><p class="pay-note" data-a="pnote">添加转账说明</p></div></div>`;
  page({
    title: hb ? '发红包' : '', right: () => hb ? `<b class="pay-more">${DOTS}</b>` : '', cls: `paypg ${hb ? 'hbpg' : ''}`, body: hb ? hbBody : tfBody, foot: () => keys,
    after: el => {
      sync(el); const ip = $('.hbs-in', el);
      ip && (ip.onfocus = () => { kb = false; sync(el); }, ip.oninput = () => { const had = !!note; note = ip.value.trim(); had != !!note && redraw(el); });
    },
    acts: {
      pk: (k, t, e, pg) => { key(k); sync(pg.el); t.animate?.([{ background: 'rgba(0,0,0,.08)' }, { background: '' }], 180); },
      pkok: (x, t, e, pg) => { kb = false; sync(pg.el); },
      pfocus: (x, t, e, pg) => { document.activeElement?.blur?.(); kb = true; sync(pg.el); },
      pnote: async (x, t, e, pg) => { const r = await form('转账说明', [['c', '收款方可见，最多10个字']], { c: note }); if (r) { note = String(r.c || '').trim().slice(0, 10); sync(pg.el); } },
      psk: (x, t, e, pg) => skPick(pg, s => { stk = s; redraw(pg.el); }),
      pgo: (x, t, e, pg) => go(pg),
    },
  });
  // 祝福语从空变有字（或换了表情）：重画中间这块，输入框保持焦点和光标
  function redraw(el) { const ip = $('.hbs-in', el), f = document.activeElement == ip, s = ip?.selectionStart; $('.pg-b', el).innerHTML = hbBody(); const n = $('.hbs-in', el); el._pg.after(el); if (f && n) { n.focus(); n.setSelectionRange(s, s); } }
}

// 祝福语旁边的表情：底部弹出「添加的单个表情」（我收藏的表情），放大镜进表情搜索
function skPick(pg, pick) {
  const L = S.assets.sticker || [];
  const w = layer('hbsk', `<div class="hbsk-s"><div class="hbsk-bar"><b data-k="q"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4" stroke-linecap="round"/></svg></b><b class="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" stroke-linejoin="round"/></svg></b><span></span><b data-k="x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m7 10 5 5 5-5"/></svg></b></div><i class="hbsk-h"></i>
<p>添加的单个表情</p><div class="hbsk-g">${L.map((s, i) => `<b data-k="${i}"><img src="${esc(s.img)}" loading="lazy"></b>`).join('')}</div></div>`);
  w.addEventListener('click', e => {
    if (e.target == w) return unlayer(w);
    const k = e.target.closest('[data-k]')?.dataset.k; if (k == null) return;
    if (k == 'x') return unlayer(w);
    if (k == 'q') { unlayer(w); return stkPage(m => { m?.img && pick({ img: m.img, name: m.c || '表情' }); }); }
    const s = L[+k]; s && (unlayer(w), pick({ img: s.img, name: s.name || '表情' }));
  });
}

// 转账付完：支付成功 → 待 X 确认收款 → 完成
function paidPage(to, amt) {
  page({ title: '', noBack: 1, cls: 'wxtp paid', body: () => `<p class="wxtp-ok">${CHK_S}支付成功</p><p class="wxtp-s">待${esc(nm(to))}确认收款</p><div class="wxtp-a"><i>¥</i>${yuan(amt)}</div><b class="wxtp-done" data-a="pdone">完成</b>`, acts: { pdone: () => back() } });
}

/* ---------- 收转账：待你收款 / 你已收款（我发出的：待对方确认收款 / 对方已收款） ---------- */
// m：转账消息；from：对方；act：{ take(), ret() } 收款 / 退还（只在别人转给我、还没处理时有）
export function tfPage(m, from, act) {
  const mine = m.f == 'me', got = () => !!m.st && m.st != '已退还', rcpt = m.rcpt;
  const row = (l, t) => `<div class="wxtp-r"><span>${l}</span><span>${esc(fullT(t))}</span></div>`;
  const body = () => {
    if (m.st == '已退还') return `<i class="wxtp-ic">${CLOCK}</i><p class="wxtp-s">${mine && !rcpt ? `${esc(nm(from))}已退还` : '已退还'}</p><div class="wxtp-a"><i>¥</i>${yuan(m.amt)}</div><div class="wxtp-ln">${row('转账时间', m.ts)}</div>`;
    if (got() || rcpt) {
      const me = rcpt ? mine : !mine; // 收钱的是我（回执是谁发的谁收的钱）
      return `<i class="wxtp-ic">${CHECK}</i><p class="wxtp-s">${me ? '你已收款，资金已存入零钱' : `${esc(nm(from))}已收款`}</p><div class="wxtp-a"><i>¥</i>${yuan(m.amt)}</div>${me ? '<p class="wxtp-lnk">零钱余额</p>' : ''}
<div class="wxtp-ln">${row('转账时间', m.t0 || m.ts)}${row('收款时间', m.rt || m.ts)}</div>${me ? `<div class="wxtp-lq"><i>${GEM}</i><div><small>零钱通 七日年化1.05%</small><b>给小金库再添一笔</b></div><em>转入</em></div>` : ''}<p class="wxtp-bill">账单详情</p>`;
    }
    return mine ? `<i class="wxtp-ic">${CLOCK}</i><p class="wxtp-s">待${esc(nm(from))}确认收款</p><div class="wxtp-a"><i>¥</i>${yuan(m.amt)}</div>${m.c ? `<p class="wxtp-c">${esc(m.c)}</p>` : ''}<div class="wxtp-ln">${row('转账时间', m.ts)}</div><p class="wxtp-ft">1天内对方未收款，将退还给你。</p>`
      : `<i class="wxtp-ic">${CLOCK}</i><p class="wxtp-s">待你收款</p><div class="wxtp-a"><i>¥</i>${yuan(m.amt)}</div>${m.c ? `<p class="wxtp-c">${esc(m.c)}</p>` : ''}<div class="wxtp-ln">${row('转账时间', m.ts)}</div><b class="wxtp-go" data-a="ttake">收款</b><p class="wxtp-ft">1天内未确认，将退还给对方。<u data-a="tret">退还</u></p>`;
  };
  page({ title: '', cls: 'wxtp', body, onClose: reEmit, acts: {
    ttake: async (x, t, e, pg) => { if (!act || m.st) return; await loading(700, '正在加载'); act.take(); pg.re(); },
    tret: async (x, t, e, pg) => { if (!act || m.st || !await ok('退还这笔转账')) return; act.ret(); back(); },
  } });
}

/* ---------- 收红包：红色卡片 + 「開」→ 红包详情页 ---------- */
const hbHead = (from, m) => `<div class="hbo-u"><img src="${esc(avOf(from))}"><span>${esc(nm(from))}的红包</span></div>`;
// m：红包消息；from：发红包的人；onOpen()：点「開」后记账；reply()：详情页「回复表情到聊天」
export function hbOpen(m, from, onOpen, reply) {
  const w = layer('hbo', `<div class="hbo-c">${hbHead(from, m)}<p class="hbo-n">${esc(m.c || '恭喜发财，大吉大利')}</p>${m.si ? `<img class="hbo-sk" src="${esc(m.si)}">` : ''}<div class="hbo-btm"></div><b class="hbo-o" data-k="o"><span>開</span></b></div><b class="hbo-x" data-k="x"></b>`);
  w.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (k == 'x' || e.target == w) return unlayer(w);
    if (k != 'o' || w.dataset.on) return; w.dataset.on = 1; $('.hbo-o', w).classList.add('spin');
    setTimeout(() => { onOpen(); hbDetail(m, from, reply); setTimeout(() => w.remove(), 360); emit('chat'); }, 1000);
  });
}
// 红包详情：红色弧形顶 + 「X的红包」+ 祝福语 + 表情 + 金额（金色）+ 已存入零钱 + 回复表情到聊天；我发出的显示领取情况
export function hbDetail(m, from, reply) {
  const mine = m.f == 'me';
  page({ title: '', cls: 'hbd', onClose: reEmit, right: () => `<b class="pay-more">${DOTS}</b>`, body: () => `${hbHead(from, m)}<p class="hbd-n">${esc(m.c || '恭喜发财，大吉大利')}</p>${m.si ? `<img class="hbd-sk" src="${esc(m.si)}">` : ''}
${mine ? `<p class="hbd-st">${m.st ? `1个红包共${yuan(m.amt)}元，已被领取` : `红包金额${yuan(m.amt)}元，等待对方领取`}</p>` : `<div class="hbd-a">${yuan(m.amt)}<small>元</small></div><p class="hbd-s"><i></i>已存入零钱，可转入零钱通赚收益<em>›</em></p><b class="hbd-r" data-a="hbrp">${SMILE}回复表情到聊天</b>`}`,
    acts: { hbrp: () => { back(); reply?.(); } } });
}
