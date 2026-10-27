// 聊天 · 转账 / 发红包（整页，仿微信：上面收款人、中间金额、底下自带数字键盘）+ 拆红包卡片
import { D, saveD, esc, $, ui, page, back, form, toast, nm, avOf, emit } from '../../core.js';

const HB_MAX = 200; // 单个红包上限（跟微信一样）
const wxid = c => c.wxid || (c.wxid = 'wxid_' + Math.random().toString(36).slice(2, 12), saveD(), c.wxid);
const DEL = '<svg viewBox="0 0 24 24"><path d="M8.6 5h10.9A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H8.6a1.5 1.5 0 0 1-1.1-.5L2.6 12l4.9-6.5a1.5 1.5 0 0 1 1.1-.5Z" fill="currentColor"/><path d="m11.5 9.5 5 5m0-5-5 5" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';

// kind: 'tf' 转账 / 'hb' 红包；to：收款人；done({amt, c}) 确认后回调
export function payPage(to, kind, done) {
  let v = '', note = ''; const hb = kind == 'hb';
  const num = () => +v || 0, over = () => hb && num() > HB_MAX;
  const sync = el => {
    $('.pay-n', el).textContent = hb ? (v || '0.00') : v; $('.pay-big', el) && ($('.pay-big', el).textContent = '¥' + num().toFixed(2));
    $('.pay-go', el).classList.toggle('dis', !(num() > 0) || over()); $('.pay-err', el).classList.toggle('on', over());
    $('.pay-note', el).innerHTML = note ? `${hb ? '' : '转账说明：'}${esc(note)} <u>修改</u>` : hb ? '恭喜发财，大吉大利' : '添加转账说明';
    $('.pay-note', el).classList.toggle('set', !!note);
  };
  const key = k => {
    if (k == 'del') v = v.slice(0, -1);
    else if (k == '.') v = v.includes('.') ? v : (v || '0') + '.';
    else { if (/\.\d\d$/.test(v) || v.replace(/\..*/, '').length >= 6 && !v.includes('.')) return; v = v == '0' ? k : v + k; }
  };
  const keys = `<div class="pay-k">${['1', '2', '3', 'del', '4', '5', '6', '7', '8', '9', '0', '.'].map(k => `<b data-a="pk" data-x="${k}" class="${k == 'del' ? 'del' : k == '0' ? 'zero' : ''}">${k == 'del' ? DEL : k}</b>`).join('')}<b class="pay-go dis" data-a="pgo">${hb ? '塞钱进<br>红包' : '转账'}</b></div>`;
  const body = () => hb
    ? `<div class="pay hbk"><p class="pay-err">单个红包金额不可超过${HB_MAX}元</p><div class="pay-row"><span>单个金额</span><i>¥</i><b class="pay-n">0.00</b></div><div class="pay-row nt"><span class="pay-note" data-a="pnote">恭喜发财，大吉大利</span></div><div class="pay-big">¥0.00</div><p class="pay-tip">发给 ${esc(nm(to))}</p></div>`
    : `<div class="pay"><p class="pay-err"></p><div class="pay-h"><div><b>转账给 ${esc(nm(to))}</b><small>微信号：${esc(wxid(to))}</small></div><img src="${esc(avOf(to))}"></div><div class="pay-c"><small>转账金额</small><div class="pay-a"><i>¥</i><span class="pay-n"></span><em class="pay-cur"></em></div><p class="pay-note" data-a="pnote">添加转账说明</p></div></div>`;
  page({
    title: hb ? '<b>发红包</b>' : '', cls: `paypg ${hb ? 'hbpg' : ''}`, body, foot: () => keys, after: el => sync(el),
    acts: {
      pk: (k, t, e, pg) => { key(k); sync(pg.el); t.animate?.([{ background: 'rgba(0,0,0,.08)' }, { background: '' }], 180); },
      pnote: async (x, t, e, pg) => { const r = await form(hb ? '红包祝福语' : '转账说明', [['c', hb ? '恭喜发财，大吉大利' : '收款方可见，最多10个字']], { c: note }); if (r) { note = String(r.c || '').trim().slice(0, hb ? 25 : 10); sync(pg.el); } },
      pgo: () => {
        const a = num(); if (!(a > 0) || over()) return;
        if (a > (+D().me.wallet || 0)) return toast('零钱余额不足');
        back(); done({ amt: Math.round(a * 100) / 100, c: note });
      },
    },
  });
}

// 拆红包：红色卡片 + 金色「開」，点了转一下再显示金额
export function hbOpen(m, from, onOpen) {
  const w = Object.assign(document.createElement('div'), { className: 'hbo' });
  const card = (inner) => `<div class="hbo-c">${inner}<b class="hbo-x" data-k="x">×</b></div>`;
  w.innerHTML = card(`<div class="hbo-u"><img src="${esc(avOf(from))}"><span>${esc(nm(from))}发出的红包</span></div><p class="hbo-n">${esc(m.c || '恭喜发财，大吉大利')}</p><b class="hbo-o" data-k="o">開</b>`);
  ui.scr.append(w); requestAnimationFrame(() => w.classList.add('in'));
  const end = () => { w.classList.remove('in'); setTimeout(() => w.remove(), 220); };
  w.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (k == 'x' || e.target == w) return end();
    if (k != 'o' || w.dataset.on) return; w.dataset.on = 1; e.target.classList.add('spin');
    setTimeout(() => { onOpen(); $('.hbo-c', w).classList.add('opened'); $('.hbo-c', w).innerHTML = `<div class="hbo-u"><img src="${esc(avOf(from))}"><span>${esc(nm(from))}发出的红包</span></div><p class="hbo-n sm">${esc(m.c || '恭喜发财，大吉大利')}</p><div class="hbo-a">${(+m.amt).toFixed(2)}<small>元</small></div><p class="hbo-s">已存入零钱</p><b class="hbo-x" data-k="x">×</b>`; emit('chat'); }, 700);
  });
}
