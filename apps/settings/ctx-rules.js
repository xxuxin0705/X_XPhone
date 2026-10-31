// 小手机 · 「发给 TA 的内容」：带不带我说的话、正文里哪些标签要（「要」的标签里又不要哪些）、世界书哪本哪条发不发、预览发出去的正文 / 整份提示词（带字数）
// 两个地方用同一块：设置 → 上下文与世界书（全局，改的是所有聊天的默认）；聊天设置（这个聊天：直接改，改了的只对它生效，旁边一个小点，点它恢复成全局）
// 只在打开时画一次；之后点哪儿只改哪儿（加一个标签就挪一个小块、勾一条就改那一个勾），不整块重画——重画会跳、会卡
// 扫描标签、预览全在本地算，不调模型
import { S, save, saveD, esc, I, ctxRules, ctxG, tagsIn, wiBooks, loadBook, sysCtx, storyText, floors } from '../../core.js';

const CHK = '<svg viewBox="0 0 16 16"><path d="M3.5 8.4l2.9 2.9 6.1-6.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const g = ctxG;
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const q = k => CSS.escape(k);

// 放到页面里的空壳；页面 after 里调 mountCtx(el, ch) 填内容（同一个空壳只填一次）
export const ctxBox = ch => `<div class="cxr" data-cxr="${esc(ch?.id || '')}"></div>`;

export function mountCtx(root, ch) {
  const box = root.querySelector('.cxr'); if (!box || box._on) return; box._on = 1; ctxG();
  const own = () => ch ? (ch.cfg.ctx ||= {}) : null, persist = () => { ch ? saveD() : save(); };
  let scan = tagsIn(20, ctxRules(ch)); const dis = {}; // 正文里有哪些标签（本地扫一遍）；世界书每条在酒馆里是不是关着的
  const tagOf = k => ctxRules(ch).tags[k] || '', tagMine = k => !!ch && k in (own().tags || {});
  const wiKey = (b, u) => u == null ? b : b + '/' + u, wiOf = (b, u) => ctxRules(ch).wi(b, u, dis[wiKey(b, u)]), wiMine = k => !!ch && k in (own().wi || {});
  const nameOf = k => k == '!--' ? '<!-- -->' : scan[k]?.name || g().names?.[k] || k;

  // 改设置（只改数据；界面由调用的地方自己改那一小块）
  const setTag = (k, v) => { if (ch) { const o = own().tags ||= {}; v == (g().tags[k] || '') ? delete o[k] : (o[k] = v); } else { v ? (g().tags[k] = v) : delete g().tags[k]; } scan[k]?.name && scan[k].name != k && k != '!--' && ((g().names ||= {})[k] = scan[k].name); persist(); };
  const def = k => !dis[k]; // 世界书默认：酒馆里这条开着就勾、关着就不勾；整本默认勾
  const setWi = (k, on) => { if (ch) { const o = own().wi ||= {}; on == !!ctxRules().wiG(k, def(k)) ? delete o[k] : (o[k] = on ? 1 : 0); } else { const w = g().wi; on == def(k) ? delete w[k] : (w[k] = on ? 1 : 0); } persist(); };

  const dot = (t, k) => `<i class="cxr-dot" data-c="${t}" data-k="${esc(k)}" title="恢复成全局"></i>`;
  const chip = k => `<span class="cxr-chip ${tagMine(k) ? 'mine' : ''}" data-c="untag" data-k="${esc(k)}">${esc(nameOf(k))}<i>×</i></span>`;
  const cand = (k, v) => { const n = v == 'drop' ? scan[k]?.ink : scan[k]?.n; return `<span class="cxr-cd" data-c="addtag" data-v="${v}" data-k="${esc(k)}">${esc(nameOf(k))}${n > 1 ? `<small>${n}</small>` : ''}</span>`; };
  const R0 = ctxRules(ch), of = v => Object.keys(R0.tags).filter(k => R0.tags[k] == v);
  const freeKeep = () => Object.keys(scan).filter(k => scan[k].n && !tagOf(k)), freeDrop = () => Object.keys(scan).filter(k => scan[k].ink && !tagOf(k)); // 「不要」下面只列「要」的标签里面出现的
  const userMine = () => !!ch && 'user' in own();
  const fld = (v, l) => `<div class="cxr-h">${l}${v == 'keep' ? `<span class="cxr-hd">${ch && Object.keys(own().tags || {}).length ? dot('rtag', '') : ''}</span>` : ''}</div><div class="cxr-f cxr-${v}" data-c="focus" data-k="${v}">${of(v).map(chip).join('')}<input class="cxr-in" data-v="${v}" enterkeyhint="done" autocomplete="off" placeholder="输入标签名"></div><div class="cxr-cds" data-v="${v}">${(v == 'keep' ? freeKeep() : freeDrop()).map(k => cand(k, v)).join('')}</div>`;
  box.innerHTML = `<div class="cxr-sc">
<label class="cxr-r cxr-u"><span>带上我说的话</span><span class="cxr-dw">${userMine() ? dot('ruser', '') : ''}</span><input type="checkbox" class="sw" data-c="user" ${ctxRules(ch).user ? 'checked' : ''}></label>
<div class="cxr-tg">${fld('keep', '要发的正文标签')}${fld('drop', '「要」的标签里，不要')}</div>
<div class="cxr-h">世界书</div><div class="cxr-wi"><div class="cxr-r cxr-sk"><i></i><i></i></div></div>
</div>
<div class="cxr-pvw"><div class="cxr-r cxr-pvh" data-c="pv"><span>预览发出去的内容</span><i class="cxr-ch">${I.chev}</i></div>
<div class="cxr-pvb" hidden><div class="seg cxr-pseg"><button class="on" data-c="pvk" data-k="story">发出去的正文</button><button data-c="pvk" data-k="all">整份提示词</button></div><div class="cxr-cnt"></div><pre class="cxr-pv"></pre></div></div>`;
  const $ = s => box.querySelector(s), F = v => $(`.cxr-f[data-k=${v}]`), IN = v => $(`.cxr-in[data-v=${v}]`), CD = v => $(`.cxr-cds[data-v=${v}]`);
  const hd = () => { $('.cxr-hd').innerHTML = ch && Object.keys(own().tags || {}).length ? dot('rtag', '') : ''; };

  // 标签：加一个 = 虚线小块变成框里的一块；拿掉一个 = 框里那块变回虚线小块（只动这一个）
  // 「要」变了，哪些标签在「要」的标签里面也跟着变：只重排「不要」下面那一排虚线小块
  const redrop = () => { scan = tagsIn(20, ctxRules(ch)); CD('drop').innerHTML = freeDrop().map(k => cand(k, 'drop')).join(''); };
  const place = k => { box.querySelectorAll(`.cxr-chip[data-k="${q(k)}"],.cxr-cd[data-k="${q(k)}"]`).forEach(x => x.remove()); const v = tagOf(k);
    if (v) IN(v).before(h(chip(k))); else if (scan[k]?.n) CD('keep').append(h(cand(k, 'keep'))); }; // 放到它现在该在的地方
  const set = (k, v) => { const was = tagOf(k); setTag(k, v); place(k); (was == 'keep' || v == 'keep') ? redrop() : !v && scan[k]?.ink && CD('drop').append(h(cand(k, 'drop'))); hd(); pv(); };
  const typed = i => { const v = i.dataset.v; String(i.value).split(/[,，\s]+/).map(x => x.trim()).filter(Boolean).forEach(x => { const nm = x.replace(/^<\/?|\/?>$/g, ''), k = /^<!--/.test(x) ? '!--' : nm.toLowerCase(); if (!k) return; k != '!--' && nm != k && ((g().names ||= {})[k] = nm); set(k, v); }); i.value = ''; };
  box.querySelectorAll('.cxr-in').forEach(i => { i.onkeydown = e => { if (e.key == 'Enter' || e.key == ',' || e.key == '，') { e.preventDefault(); typed(i); } }; i.onblur = () => i.value.trim() && typed(i); });

  // 世界书：画一次；展开 / 收起只加 / 删那一本的条目；勾一条只改那一个勾和这本书的计数
  const books = [];
  const bookRow = ([b, ents]) => { const on = wiOf(b), es = Object.values(ents || {}), n = es.filter(e => wiOf(b, e.uid)).length;
    return `<div class="cxr-bk ${on ? '' : 'cxr-off'}" data-b="${esc(b)}"><div class="cxr-r cxr-b"><i class="cxr-c ${on ? 'on' : ''}" data-c="wb" data-k="${esc(b)}">${CHK}</i><span data-c="wopen" data-k="${esc(b)}">${esc(b)}</span><em data-c="wopen" data-k="${esc(b)}">${on ? `${n}/${es.length}` : '不发'}</em><span class="cxr-dw">${wiMine(b) ? dot('rwi', b) : ''}</span><i class="cxr-ch" data-c="wopen" data-k="${esc(b)}">${I.chev}</i></div></div>`; };
  const entRow = (b, e) => { const k = wiKey(b, e.uid), y = wiOf(b, e.uid); return `<div class="cxr-r cxr-en ${y ? '' : 'cxr-off'}" data-e="${esc(k)}"><i class="cxr-c ${y ? 'on' : ''}" data-c="we" data-k="${esc(k)}">${CHK}</i><span>${esc(e.comment || (e.key || []).join('、') || '#' + e.uid)}</span>${e.constant ? '<em class="cst">常驻</em>' : ''}<span class="cxr-dw">${wiMine(k) ? dot('rwi', k) : ''}</span></div>`; };
  const bookEl = b => $(`.cxr-bk[data-b="${q(b)}"]`);
  const fixBook = b => { const el = bookEl(b), bk = books.find(x => x[0] == b); if (!el || !bk) return; const on = wiOf(b), es = Object.values(bk[1] || {}), n = es.filter(e => wiOf(b, e.uid)).length;
    el.classList.toggle('cxr-off', !on); el.querySelector('[data-c=wb]').classList.toggle('on', on); el.querySelector('.cxr-b em').textContent = on ? `${n}/${es.length}` : '不发'; el.querySelector('.cxr-b .cxr-dw').innerHTML = wiMine(b) ? dot('rwi', b) : ''; };
  const fixEnt = k => { const el = $(`.cxr-en[data-e="${q(k)}"]`); if (!el) return; const i = k.indexOf('/'), y = wiOf(k.slice(0, i), k.slice(i + 1)); el.classList.toggle('cxr-off', !y); el.querySelector('.cxr-c').classList.toggle('on', y); el.querySelector('.cxr-dw').innerHTML = wiMine(k) ? dot('rwi', k) : ''; };
  const toggleOpen = b => { const el = bookEl(b); if (!el) return; const es = el.querySelector('.cxr-es'), chev = el.querySelector('.cxr-b .cxr-ch');
    if (es) { es.remove(); chev.classList.remove('op'); return; } const bk = books.find(x => x[0] == b); el.append(h(`<div class="cxr-es">${Object.values(bk?.[1] || {}).map(e => entRow(b, e)).join('') || '<p class="cxr-e0">空</p>'}</div>`)); chev.classList.add('op'); };

  // 预览：打开时才算；改了设置等手停半秒再算（不是每点一下都整理一遍）；标出字数
  let pvK = 'story', pvT = 0, pvN = 0;
  const pvOpen = () => !$('.cxr-pvb').hidden;
  const pvRun = async () => { const id = ++pvN, pre = $('.cxr-pv'), cnt = $('.cxr-cnt'); let t;
    const n = floors(ctxRules(ch), S.ctxN).length;
    try { t = pvK == 'story' ? storyText(ch, S.ctxN) : await sysCtx({ ch }); } catch (e) { t = '整理失败：' + e.message; }
    if (id != pvN || !box.isConnected) return; const sc = pre.scrollTop; pre.textContent = t || '（还没有正文）'; pre.scrollTop = sc; cnt.textContent = `正文 ${n} 条 · ${(t || '').length.toLocaleString()} 字`; };
  const pv = () => { if (!pvOpen()) return; clearTimeout(pvT); pvT = setTimeout(pvRun, 500); };

  // 上面「读取正文条数」边打字预览边跟着变（只重算预览，页面不重画）；数字松手 / 收键盘时照常存
  const onN = e => { if (!box.isConnected) return root.removeEventListener('input', onN); if (e.target.dataset?.k != 'ctxN') return; const n = Math.round(+e.target.value); if (n >= 1) { S.ctxN = n; pv(); } };
  root.addEventListener('input', onN);

  box.onclick = e => { const t = e.target.closest('[data-c]'); if (!t || !box.contains(t)) return; e.stopPropagation(); const c = t.dataset.c, k = t.dataset.k;
    if (c == 'focus') { e.target == t && IN(k).focus(); return; } // 只有点到框里的空白处才弹键盘；点标签不弹
    if (c == 'user') { if (e.target.tagName != 'INPUT') return; const on = e.target.checked; if (ch) { on == (g().user ?? true) ? delete own().user : (own().user = on); } else { on ? delete g().user : (g().user = false); } persist(); t.closest('.cxr-u').querySelector('.cxr-dw').innerHTML = userMine() ? dot('ruser', '') : ''; pv(); return; }
    if (c == 'ruser') { delete own().user; persist(); $('[data-c=user]').checked = ctxRules(ch).user; t.remove(); pv(); return; }
    if (c == 'addtag') set(k, t.dataset.v);
    else if (c == 'untag') set(k, '');
    else if (c == 'rtag') { const ks = Object.keys(own().tags || {}); delete own().tags; persist(); ks.forEach(place); redrop(); box.querySelectorAll('.cxr-chip.mine').forEach(x => x.classList.remove('mine')); hd(); pv(); }
    else if (c == 'wb') { setWi(k, !wiOf(k)); fixBook(k); bookEl(k)?.querySelectorAll('.cxr-en').forEach(x => fixEnt(x.dataset.e)); pv(); }
    else if (c == 'we') { const i = k.indexOf('/'), b = k.slice(0, i); setWi(k, !wiOf(b, k.slice(i + 1))); fixEnt(k); fixBook(b); pv(); }
    else if (c == 'rwi') { delete own().wi[k]; persist(); const i = k.indexOf('/'); if (i < 0) { fixBook(k); bookEl(k)?.querySelectorAll('.cxr-en').forEach(x => fixEnt(x.dataset.e)); } else { fixEnt(k); fixBook(k.slice(0, i)); } pv(); }
    else if (c == 'wopen') toggleOpen(k);
    else if (c == 'pv') { const b = $('.cxr-pvb'); b.hidden = !b.hidden; t.querySelector('.cxr-ch').classList.toggle('op', !b.hidden); b.hidden || pvRun(); }
    else if (c == 'pvk') { if (pvK == k) return; pvK = k; box.querySelectorAll('[data-c=pvk]').forEach(x => x.classList.toggle('on', x == t)); $('.cxr-pv').scrollTop = 0; pvRun(); } };

  (async () => { try { for (const b of await wiBooks()) books.push([b, (await loadBook(b))?.entries || {}]); } catch { }
    if (!box.isConnected) return; books.forEach(([b, ents]) => Object.values(ents || {}).forEach(e => { dis[wiKey(b, e.uid)] = !!e.disable; }));
    $('.cxr-wi').innerHTML = books.length ? books.map(bookRow).join('') : '<p class="cxr-e0">酒馆里没开世界书</p>'; })();
}
