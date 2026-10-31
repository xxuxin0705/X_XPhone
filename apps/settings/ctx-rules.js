// 小手机 · 「发给 TA 的内容」：正文里哪些标签要 / 不要、世界书哪本哪条发不发、预览发出去的样子
// 两个地方用同一块：设置 → 上下文与世界书（全局，改的是所有聊天的默认）；聊天设置（这个聊天：直接改，改了的只对它生效，旁边一个小点，点它恢复成全局）
// 一块固定高度的区域，里面滚动；扫描标签、预览全在本地算，不调模型
import { S, C, save, saveD, esc, I, ctxRules, ctxG, body, tagsIn, wiBooks, loadBook, sysCtx } from '../../core.js';

const CHK = '<svg viewBox="0 0 16 16"><path d="M3.5 8.4l2.9 2.9 6.1-6.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const g = ctxG;
const tagName = k => k == '!--' ? '注释' : g().names?.[k] || k; // 标签按正文里的原样显示（globalTime，不是 globaltime）

// 放到页面里的空壳；页面 after 里调 mountCtx(el, ch) 填内容
export const ctxBox = ch => `<div class="cxr" data-cxr="${esc(ch?.id || '')}"></div>`;

export function mountCtx(root, ch) {
  const box = root.querySelector('.cxr'); if (!box) return; ctxG();
  const st = box._st ||= { open: {}, scan: null, pv: 'one', full: '', books: null, at: 'keep' }; // at：正文里找到的标签现在列在哪个框下面（点哪个框就挪到哪个框下面） // open：展开的世界书；scan：扫出来的标签；pv：预览哪种
  const own = () => ch ? (ch.cfg.ctx ||= {}) : null;
  // 这一项现在是什么、全局是什么（聊天里改过的才有小点）
  const tagG = k => g().tags[k], tagMine = k => ch && own().tags && k in own().tags;
  const dis = {}, wiOf = (b, u) => ctxRules(ch).wi(b, u, dis[wiKey(b, u)]), wiKey = (b, u) => u == null ? b : b + '/' + u, wiMine = k => ch && own().wi && k in own().wi;
  const persist = () => { ch ? saveD() : save(); };

  const setTag = (k, v) => { if (ch) { const o = own().tags ||= {}; v == (tagG(k) || '') ? delete o[k] : (o[k] = v); } else { v ? (g().tags[k] = v) : delete g().tags[k]; } persist(); };
  const def = k => !dis[k]; // 默认：酒馆里这条开着就勾、关着就不勾；整本默认勾
  const setWi = (k, on) => { if (ch) { const o = own().wi ||= {}; on == !!ctxRules().wiG(k, def(k)) ? delete o[k] : (o[k] = on ? 1 : 0); } else { const w = g().wi; on == def(k) ? delete w[k] : (w[k] = on ? 1 : 0); } persist(); };

  const dot = (mine, k, t) => mine ? `<i class="cxr-dot" data-c="${t}" data-k="${esc(k)}" title="恢复成全局"></i>` : '';
  // 正文标签：「要」「不要」两个框，框里是放进去的标签（点 × 拿出来），框下面是正文里找到、还没放的标签（点一下放进这个框）；框里也能直接打字加
  const nameOf = k => esc(k != '!--' && st.scan?.[k]?.name || tagName(k));
  const chip = k => `<span class="cxr-chip ${tagMine(k) ? 'mine' : ''}" data-c="untag" data-k="${esc(k)}">${nameOf(k)}<i>×</i></span>`;
  const cand = (k, v) => `<span class="cxr-cd" data-c="addtag" data-k="${esc(k)}" data-v="${v}">${nameOf(k)}${st.scan?.[k]?.n > 1 ? `<small>${st.scan[k].n}</small>` : ''}</span>`;
  const field = (v, l, R, free) => `<div class="cxr-lb">${l}</div><div class="cxr-f cxr-${v}" data-c="focus" data-k="${v}">${Object.keys(R.tags).filter(k => R.tags[k] == v).map(chip).join('')}<input class="cxr-in" data-v="${v}" enterkeyhint="done" autocomplete="off" placeholder="${Object.values(R.tags).includes(v) ? '' : '输入标签名'}"></div>${free.length && st.at == v ? `<div class="cxr-cds">${free.map(k => cand(k, v)).join('')}</div>` : ''}`;

  const draw = () => {
    const R = ctxRules(ch), free = Object.keys(st.scan || {}).filter(k => !R.tags[k]); // 正文里有、还没放进任何一个框的
    st.books?.forEach(([b, ents]) => Object.values(ents || {}).forEach(e => { dis[wiKey(b, e.uid)] = !!e.disable; }));
    const books = st.books, wi = books == null ? '<div class="cxr-r cxr-sk"><i></i><i></i></div>' : !books.length ? '<p class="cxr-e0">酒馆里没开世界书</p>'
      : books.map(([b, ents]) => { const on = wiOf(b), op = st.open[b], es = Object.values(ents || {}), n = es.filter(e => wiOf(b, e.uid)).length;
        return `<div class="cxr-bk ${on ? '' : 'cxr-off'}"><div class="cxr-r cxr-b"><i class="cxr-c ${on ? 'on' : ''}" data-c="wb" data-k="${esc(b)}">${CHK}</i><span data-c="wopen" data-k="${esc(b)}">${esc(b)}</span><em data-c="wopen" data-k="${esc(b)}">${on ? `${n}/${es.length}` : '不发'}</em>${dot(wiMine(b), b, 'rwi')}<i class="cxr-ch ${op ? 'op' : ''}" data-c="wopen" data-k="${esc(b)}">${I.chev}</i></div>`
          + (op ? `<div class="cxr-es">${es.map(e => { const k = wiKey(b, e.uid), y = wiOf(b, e.uid); return `<div class="cxr-r cxr-en ${y ? '' : 'cxr-off'}"><i class="cxr-c ${y ? 'on' : ''}" data-c="we" data-k="${esc(k)}">${CHK}</i><span>${esc(e.comment || (e.key || []).join('、') || '#' + e.uid)}</span>${e.constant ? '<em class="cst">常驻</em>' : ''}${dot(wiMine(k), k, 'rwi')}</div>`; }).join('') || '<p class="cxr-e0">空</p>'}</div>` : '') + '</div>'; }).join('');
    const last = (C().chat || []).filter(m => !m.is_system).at(-1);
    const pv = st.pv == 'one' ? (last ? body(last.mes, R) || '（这一条按现在的设置，什么都不剩）' : '（还没有正文）') : st.full || '…';
    const sc0 = box.querySelector('.cxr-sc')?.scrollTop || 0, pv0 = box.querySelector('.cxr-pv')?.scrollTop || 0;
    box.innerHTML = `<div class="cxr-sc">
<div class="cxr-h">正文标签${dot(ch && Object.keys(own().tags || {}).length, '', 'rtag')}</div><div class="cxr-tg">${field('keep', '要', R, free)}${field('drop', '不要', R, free)}</div>
<div class="cxr-h">世界书</div>${wi}
</div>
<div class="cxr-pvw ${st.pvOpen ? 'op' : ''}"><div class="cxr-r cxr-pvh" data-c="pv"><span>预览发出去的内容</span><i class="cxr-ch ${st.pvOpen ? 'op' : ''}">${I.chev}</i></div>
${st.pvOpen ? `<div class="seg cxr-pseg"><button class="${st.pv == 'one' ? 'on' : ''}" data-c="pvk" data-k="one">最新一条正文</button><button class="${st.pv == 'all' ? 'on' : ''}" data-c="pvk" data-k="all">整份提示词</button></div><pre class="cxr-pv">${esc(pv)}</pre>` : ''}</div>`;
    const a = box.querySelector('.cxr-sc'), p = box.querySelector('.cxr-pv'); a && (a.scrollTop = sc0); p && (p.scrollTop = pv0);
    box.querySelectorAll('.cxr-in').forEach(i => { i.onkeydown = e => { if (e.key == 'Enter' || e.key == ',' || e.key == '，') { e.preventDefault(); typed(i); } }; i.onblur = () => i.value.trim() && typed(i, 1); });
    st.focus && box.querySelector(`.cxr-in[data-v=${st.focus}]`)?.focus(); st.focus = null;
  };
  // 框里打字加标签：<content> / content 都行，大小写不管
  const typed = (i, blur) => { const v = i.dataset.v; String(i.value).split(/[,，\s]+/).map(x => x.replace(/^<!?-*|\/?>$|-*$/g, '').trim()).filter(Boolean).forEach(n => { const k = /^!?-*$/.test(n) ? '!--' : n.toLowerCase(); k != n && k != '!--' && ((g().names ||= {})[k] = n); setTag(k, v); });
    /^\s*<!--/.test(i.value) && setTag('!--', v); i.value = ''; blur || (st.focus = v); draw(); };
  const full = async () => { st.full = '…'; draw(); try { st.full = await sysCtx({ ch, n: S.ctxN }); } catch (e) { st.full = '整理失败：' + e.message; } st.pv == 'all' && draw(); };

  box.onclick = e => { const t = e.target.closest('[data-c]'); if (!t || !box.contains(t)) return; e.stopPropagation(); const c = t.dataset.c, k = t.dataset.k;
    if (c == 'focus') { if (st.at != k) { st.at = k; st.focus = k; draw(); return; } e.target.closest('.cxr-in') || box.querySelector(`.cxr-in[data-v=${k}]`)?.focus(); return; }
    if (c == 'addtag') { const nm = st.scan?.[k]?.name; nm && nm != k && k != '!--' && ((g().names ||= {})[k] = nm, save()); setTag(k, t.dataset.v); }
    else if (c == 'untag') setTag(k, ''); // 拿出来：回到没分配（框下面又能看到它）
    else if (c == 'rtag') { delete own().tags; persist(); }
    else if (c == 'wb') setWi(k, !wiOf(k));
    else if (c == 'we') { const [b, ...u] = k.split('/'); setWi(k, !wiOf(b, u.join('/'))); }
    else if (c == 'rwi') { delete own().wi[k]; persist(); }
    else if (c == 'wopen') st.open[k] = !st.open[k];
    else if (c == 'pv') { st.pvOpen = !st.pvOpen; st.pvOpen && st.pv == 'all' && full(); }
    else if (c == 'pvk') { st.pv = k; k == 'all' && full(); }
    draw(); if (st.pvOpen && st.pv == 'all' && /tag|wb|we|rwi/.test(c)) full(); };
  st.scan ||= tagsIn(20); // 正文里有哪些标签：本地扫一遍（不调模型）
  draw();
  if (st.books == null) (async () => { try { const bs = await wiBooks(); st.books = []; for (const b of bs) st.books.push([b, (await loadBook(b))?.entries || {}]); } catch { st.books = []; } box.isConnected && draw(); })();
}
