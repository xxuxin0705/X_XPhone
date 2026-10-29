// 聊天 · 微信「标签」（照真微信录屏做）：通讯录 → 标签 → 通讯录标签（未设置标签的朋友 / 每个标签一行）
//  未设置标签的朋友 → 批量设置 → 勾人 → 设置标签 (n) → 选择标签（点选、＋ 新建标签）→ 完成 →「标签保存中…」
//  一个人可以有好几个标签（c.tags）；标签名单独存在 D().tags（没人用的标签也留着，跟微信一样显示 (0)）
//  旧数据的「分组」（c.grp）当成一个标签；QQ 样式的分组还看 c.grp，所以设标签时 grp 跟第一个标签走
import { D, saveD, esc, page, back, toast, nm, avOf, emit, ok, menu, ui, $, top } from '../../core.js';
import { loading } from './pay.js';
import { ini } from './chat.js';

const fr = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0);
export const tagsOf = c => c?.tags || (c?.grp && c.grp != '我的好友' ? [c.grp] : []);
export const allTags = () => { const L = D().tags ||= []; fr().forEach(c => tagsOf(c).forEach(t => L.includes(t) || L.push(t))); return L; };
export const setTags = (c, t) => { c.tags = [...new Set(t)]; c.grp = c.tags[0] || ''; };
const names = L => L.map(c => nm(c)).join(', ');
const TAGI = new URL('../../assets/wx/tag.png', import.meta.url).href;
export const tagIcon = () => `<img src="${TAGI}">`;
const SRCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4" stroke-linecap="round"/></svg>';
const srch = () => `<label class="tg-s">${SRCH}<input data-tgq placeholder="搜索"></label>`;
// 搜索框：只在本页按名字过滤，不重画
const bindQ = el => { const q = $('[data-tgq]', el); q && (q.oninput = () => { const v = q.value.trim().toLowerCase(); el.querySelectorAll('[data-q]').forEach(r => r.hidden = !!v && !r.dataset.q.toLowerCase().includes(v)); }); };

// 通讯录标签
export function tagListPage() {
  let ed = false;
  page({ title: '通讯录标签', cls: 'tgpg', live: 1, after: bindQ,
    body: () => { const F = fr(), un = F.filter(c => !tagsOf(c).length);
      return `${srch()}<div class="tg-g"><div class="tg-r" data-a="tgun" data-q="未设置标签的朋友"><div><b>未设置标签的朋友 <em>(${un.length})</em></b>${un.length ? `<small>${esc(names(un))}</small>` : ''}</div></div></div>
<div class="tg-g">${allTags().map(t => { const L = F.filter(c => tagsOf(c).includes(t)); return `<div class="tg-r ${ed ? 'ed' : ''}" data-a="${ed ? 'tgdel' : 'tgo'}" data-lp="tglp" data-x="${esc(t)}" data-q="${esc(t)}">${ed ? '<i class="tg-minus"></i>' : ''}<div><b>${esc(t)} <em>(${L.length})</em></b>${L.length ? `<small>${esc(names(L))}</small>` : ''}</div></div>`; }).join('')}</div>`; },
    foot: () => `<nav class="tg-f"><b data-a="tgnew">新建</b><b data-a="tged">${ed ? '完成' : '编辑'}</b></nav>`,
    acts: {
      tgun: () => untaggedPage(),
      tgo: t => tagPage(t),
      // 长按一个标签（照录屏）：这一行变灰，右上方冒出白色小框「修改名称 | 删除」
      tglp: (t, row) => { navigator.vibrate?.(12); document.querySelectorAll('.tg-pop').forEach(n => n.remove()); row.classList.add('lp');
        const w = Object.assign(document.createElement('div'), { className: 'tg-pop' }); w.innerHTML = '<b data-k="r">修改名称</b><i></i><b data-k="d">删除</b>';
        const R = row.getBoundingClientRect(), P = ui.scr.getBoundingClientRect(), z = P.width / ui.scr.offsetWidth || 1; w.style.top = (R.top - P.top) / z - 34 + 'px'; ui.scr.append(w);
        const end = () => { w.remove(); row.classList.remove('lp'); };
        w.onclick = async e => { const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return; end();
          if (k == 'd') { if (await menu([['y', '删除', 'danger']], '标签中的联系人不会被删除，使用此标签设置了分组的朋友圈，可见范围也将更新。') == 'y') dropTags([t]); return; }
          const n = await newTag(t); if (!n || n == t) return; D().tags = allTags().map(y => y == t ? n : y); fr().forEach(c => tagsOf(c).includes(t) && setTags(c, tagsOf(c).map(y => y == t ? n : y))); saveD(); emit('chat'); };
        setTimeout(() => document.addEventListener('pointerdown', e => { w.contains(e.target) || end(); }, { once: true }), 0); },
      tged: (x, tt, e, pg) => { ed = !ed; pg.re(); },
      tgdel: async (t, tt, e, pg) => { if (!await ok(`删除标签「${t}」`)) return; D().tags = allTags().filter(x => x != t); fr().forEach(c => tagsOf(c).includes(t) && setTags(c, tagsOf(c).filter(x => x != t))); saveD(); emit('chat'); pg.re(); },
      tgnew: async () => { const t = await newTag(); if (!t) return; pickPeople(`添加成员`, [], L => { L.forEach(c => setTags(c, [...tagsOf(c), t])); }, '完成'); },
    } });
}

// 未设置标签的朋友：右上角「批量设置」→ 勾人 → 底部 设置标签 (n)
function untaggedPage() {
  const list = () => fr().filter(c => !tagsOf(c).length);
  pickPeople(() => `未设置标签的朋友(${list().length})`, null, L => pickTags(L, []), n => `设置标签 (${n})`, list);
}
// 一个标签（照录屏）：标题「朋友(1)」、搜索、按首字母的成员；右上角 ··· → 更改标签名称 / 删除标签；底部 添加（选择朋友）/ 移出（勾人 → 移出(n) → 确认）
function tagPage(t) {
  let rm = null; const L = () => fr().filter(c => tagsOf(c).includes(t));
  const pg = page({ title: () => (rm ? '<b class="tg-x" data-a="tgrmx"></b>' : '') + `${esc(t)}(${L().length})`, cls: 'tgpg', live: 1, after: bindQ, get noBack() { return !!rm; },
    right: () => rm ? '' : `<b class="pay-more tg-dots" data-a="tgm"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></b>`,
    body: () => srch() + people(L(), rm),
    foot: () => rm ? selBar(L().filter(c => rm.has(c.id)), `移出${rm.size ? `(${rm.size})` : ''}`, 'tgrmgo', 'red') : `<nav class="tg-f"><b class="lk" data-a="tgadd">添加</b><b class="rd" data-a="tgrm">移出</b></nav>`,
    onBack: () => { if (!rm) return; rm = null; pg.re(); return true; },
    acts: {
      tgadd: () => choosePeople(L(), S => { S.forEach(c => setTags(c, [...tagsOf(c), t])); }),
      tgrm: (x, tt, e, p) => { rm = new Set(); p.re(); },
      tgrmx: (x, tt, e, p) => { rm = null; p.re(); },
      tgpk: (id, tt, e, p) => { if (!rm) return; rm.has(id) ? rm.delete(id) : rm.add(id); p.re(); },
      tgrmgo: async (x, tt, e, p) => { if (!rm?.size) return; if (await menu([['y', '从标签中移出联系人', 'danger']]) != 'y') return; await loading(500, '标签保存中...'); fr().forEach(c => rm.has(c.id) && setTags(c, tagsOf(c).filter(y => y != t))); rm = null; saveD(); emit('chat'); p.re(); },
      tgm: async () => { const k = await menu([['r', '更改标签名称'], ['d', '删除标签', 'danger']]); if (!k) return;
        if (k == 'd') { if (await menu([['y', '删除', 'danger']], '标签中的联系人不会被删除，使用此标签设置了分组的朋友圈，可见范围也将更新。') != 'y') return; dropTags([t]); return back(); }
        const n = await newTag(t); if (!n || n == t) return; D().tags = allTags().map(y => y == t ? n : y); fr().forEach(c => tagsOf(c).includes(t) && setTags(c, tagsOf(c).map(y => y == t ? n : y))); saveD(); emit('chat'); back(); tagPage(n); },
    } });
}
const dropTags = T => { D().tags = allTags().filter(x => !T.includes(x)); fr().forEach(c => tagsOf(c).some(x => T.includes(x)) && setTags(c, tagsOf(c).filter(x => !T.includes(x)))); D().posts?.forEach(p => p.vis?.g && (p.vis.g = p.vis.g.filter(x => !T.includes(x)))); saveD(); emit('chat'); };
// 按首字母分段的人；sel 有值就是勾选模式（左边圆圈）
const people = (list, sel) => { const by = {}; list.forEach(c => (by[ini(nm(c))] ||= []).push(c)); const ks = Object.keys(by).sort((a, b) => a == '#' ? 1 : b == '#' ? -1 : a < b ? -1 : 1);
  return ks.map(k => `<h6 class="tg-l">${k}</h6><div class="tg-g">${by[k].map(c => `<div class="tg-p ${sel ? 'ck' : ''}" data-a="tgpk" data-x="${c.id}" data-q="${esc(nm(c))}">${sel ? `<i class="tg-c ${sel.has(c.id) ? 'on' : ''}"></i>` : ''}<img src="${esc(avOf(c))}"><span>${esc(nm(c))}</span></div>`).join('')}</div>`).join('') || '<p class="tg-e">没有朋友</p>'; };
// 底部：已选头像一排 + 按钮（绿 / 红）
const selBar = (L, label, act, tone = 'gr') => `<nav class="tg-sb"><i class="tg-up"></i><div class="tg-avs">${L.map(c => `<img src="${esc(avOf(c))}">`).join('')}</div><b class="tg-go ${tone} ${L.length ? 'on' : ''}" data-a="${act}">${label}</b></nav>`;
// 选择朋友（标签里点「添加」）：导入群聊中的朋友 / 导入标签中的朋友、按首字母的列表；已经在标签里的勾着且不能点；右下角 添加(n)
function choosePeople(already, go) {
  const has = new Set(already.map(c => c.id)), sel = new Set();
  const pg = page({ title: '选择朋友', cls: 'tgpg', after: bindQ,
    body: () => `${srch()}<div class="tg-g"><div class="tg-r" data-a="cpg"><div><b>导入群聊中的朋友</b></div></div><div class="tg-r" data-a="cpt"><div><b>导入标签中的朋友</b></div></div></div>` + people(fr(), new Set([...has, ...sel])).replace(/(data-x="([^"]+)"[^>]*>)<i class="tg-c on">/g, (m, a, id) => has.has(id) ? a + '<i class="tg-c on dis">' : m),
    foot: () => `<nav class="tg-sb end"><b class="tg-go gr ${sel.size ? 'on' : ''}" data-a="cpok">添加${sel.size ? `(${sel.size})` : ''}</b></nav>`,
    acts: {
      tgpk: id => { if (has.has(id)) return; sel.has(id) ? sel.delete(id) : sel.add(id); pg.re(); },
      cpg: async () => { const gs = D().chats.filter(c => c.type == 'g'); if (!gs.length) return toast('还没有群聊'); const k = await menu(gs.map(g => [g.id, esc(nm(g))]), '导入群聊中的朋友'); const g = gs.find(x => x.id == k); g?.members.forEach(id => fr().some(c => c.id == id) && !has.has(id) && sel.add(id)); pg.re(); },
      cpt: async () => { const T = allTags(); if (!T.length) return toast('还没有标签'); const k = await menu(T.map(x => [x, esc(x)]), '导入标签中的朋友'); k && fr().forEach(c => tagsOf(c).includes(k) && !has.has(c.id) && sel.add(c.id)); pg.re(); },
      cpok: async () => { if (!sel.size) return; await loading(500, '标签保存中...'); go(fr().filter(c => sel.has(c.id))); saveD(); emit('chat'); back(); },
    } });
}
// 管理标签（选择标签里点「管理」，照录屏）：× 关闭、搜索、每个标签 圆圈 + 名字 (人数) + 拖动把手；勾了底部「清理 (n)」变红 → 确认删除
export function manageTags() {
  const sel = new Set();
  const pg = page({ title: '<b class="tg-x" data-a="mgx"></b>管理标签', cls: 'tgpg tgmg', noBack: 1, after: el => { bindQ(el); dragSort(el); },
    body: () => `${srch()}<div class="tg-g tg-ml">${allTags().map(t => `<div class="tg-r mg" data-a="mgpk" data-x="${esc(t)}" data-q="${esc(t)}"><i class="tg-c ${sel.has(t) ? 'on' : ''}"></i><div><b>${esc(t)} <em>(${fr().filter(c => tagsOf(c).includes(t)).length})</em></b></div><i class="tg-dr" data-no-swipe-back></i></div>`).join('') || '<p class="tg-e">还没有标签</p>'}</div>`,
    foot: () => `<nav class="tg-cl"><b class="${sel.size ? 'on' : ''}" data-a="mgdel">清理${sel.size ? ` (${sel.size})` : ''}</b></nav>`,
    acts: {
      mgx: () => back(),
      mgpk: (t, el, e, p) => { if (e?.target?.closest('.tg-dr')) return; sel.has(t) ? sel.delete(t) : sel.add(t); p.re(); },
      mgdel: async (x, t, e, p) => { if (!sel.size) return; if (await menu([['y', '删除', 'danger']], '标签中的联系人不会被删除，使用此标签设置了分组的朋友圈，可见范围也将更新。') != 'y') return; await loading(500, '标签保存中...'); dropTags([...sel]); sel.clear(); p.re(); },
    } });
  // 按住右边把手上下拖，松手后按新顺序存
  function dragSort(el) {
    el.querySelectorAll('.tg-dr').forEach(h => h.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation(); const row = h.closest('.tg-r'), box = row.parentNode, H = row.offsetHeight; let y0 = e.clientY; row.classList.add('drag');
      const mv = ev => { const dy = ev.clientY - y0; row.style.transform = `translateY(${dy}px)`; const sib = dy > H / 2 ? row.nextElementSibling : dy < -H / 2 ? row.previousElementSibling : null;
        if (sib?.classList.contains('tg-r')) { dy > 0 ? box.insertBefore(sib, row) : box.insertBefore(row, sib); y0 += dy > 0 ? H : -H; row.style.transform = `translateY(${ev.clientY - y0}px)`; } };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); row.classList.remove('drag'); row.style.transform = '';
        const order = [...box.querySelectorAll('.tg-r')].map(r => r.dataset.x); D().tags = [...order, ...allTags().filter(x => !order.includes(x))]; saveD(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }
}

// 选人：列表 + 左边圆圈；pre = null 表示先是普通列表，右上角「批量设置」才出圆圈；底部已选头像 + 绿色按钮
function pickPeople(title, pre, go, btnT, listF = fr) {
  let sel = pre ? new Set(pre.map(c => c.id)) : null;
  const ttl = () => typeof title == 'function' ? title() : title, bt = n => typeof btnT == 'function' ? btnT(n) : btnT;
  page({ title: () => esc(ttl()), cls: 'tgpg tgsel', live: 1, after: bindQ,
    right: () => sel || pre ? '' : '<b class="txt tg-bat" data-a="tgbat">批量设置</b>',
    body: () => { const by = {}; listF().forEach(c => (by[ini(nm(c))] ||= []).push(c)); const ks = Object.keys(by).sort((a, b) => a == '#' ? 1 : b == '#' ? -1 : a < b ? -1 : 1); // 跟通讯录一样按首字母分段
      return ks.map(k => `<h6 class="tg-l">${k}</h6><div class="tg-g">${by[k].map(c => `<div class="tg-p ${sel ? 'ck' : ''}" data-a="tgpk" data-x="${c.id}" data-q="${esc(nm(c))}">${sel ? `<i class="tg-c ${sel.has(c.id) ? 'on' : ''}"></i>` : ''}<img src="${esc(avOf(c))}"><span>${esc(nm(c))}</span></div>`).join('')}</div>`).join('') || '<p class="tg-e">没有朋友</p>'; },
    foot: () => sel ? `<nav class="tg-sb"><i class="tg-up"></i><div class="tg-avs">${[...sel].map(id => fr().find(c => c.id == id)).filter(Boolean).map(c => `<img src="${esc(avOf(c))}">`).join('')}</div><b class="tg-go ${sel.size || pre ? 'on' : ''}" data-a="tggo">${bt(sel.size)}</b></nav>` : '',
    acts: {
      tgbat: (x, t, e, pg) => { sel = new Set(); pg.re(); },
      tgpk: (id, t, e, pg) => { if (!sel) return; sel.has(id) ? sel.delete(id) : sel.add(id); pg.re(); },
      tggo: async (x, t, e, pg) => { if (!sel.size && !pre) return; const L = fr().filter(c => sel.has(c.id));
        if (pre) { await loading(600, '标签保存中...'); go(L); saveD(); emit('chat'); return back(); }
        go(L); sel = null; },
    } });
}

// 选择标签：我的标签（点一下选中 / 取消）+ ＋ 新建标签；右上角「完成」改过才变绿
// cs：给哪些人设；init：一开始选中的；batch（好几个人）时选中的标签加到每个人身上，单个人就是改成选中的这些
export function pickTags(cs, init = tagsOf(cs[0])) {
  const sel = new Set(cs.length == 1 ? init : []), one = cs.length == 1, start = [...sel].sort().join('|');
  const changed = () => [...sel].sort().join('|') != start;
  const pg = page({ title: '选择标签', cls: 'tgpg tgpick', after: bindQ,
    right: () => `<b class="tg-ok ${changed() ? 'on' : ''}" data-a="tgok">完成</b>`,
    body: () => `${srch()}<div class="tg-mh"><span>我的标签</span><b data-a="tgmg">管理</b></div><div class="tg-chips">${allTags().map(t => `<b class="tg-ch ${sel.has(t) ? 'on' : ''}" data-a="tgch" data-x="${esc(t)}" data-q="${esc(t)}">${esc(t)}</b>`).join('')}<b class="tg-ch nw" data-a="tgnw">＋ 新建标签</b></div>`,
    acts: {
      tgch: (t, el) => { sel.has(t) ? sel.delete(t) : sel.add(t); el.classList.toggle('on', sel.has(t)); $('.tg-ok', pg.el).classList.toggle('on', changed()); },
      tgnw: async () => { const t = await newTag(); if (!t) return; sel.add(t); pg.re(); },
      tgmg: () => manageTags(),
      tgok: async () => { if (!changed()) return; await loading(600, '标签保存中...'); cs.forEach(c => setTags(c, one ? [...sel] : [...tagsOf(c), ...sel])); saveD(); emit('chat'); back(); setTimeout(() => top()?.re?.()); toast('已保存'); }, // 回到的页（聊天设置）也重画，显示新标签
    } });
}

// 新建标签（底部弹出：‹ 新建标签 / 输入框 / 确定，填了字才变绿）→「标签保存中…」；old：改名时的旧名字
export function newTag(old = '') {
  return new Promise(done => {
    const w = Object.assign(document.createElement('div'), { className: 'tgn' });
    w.innerHTML = `<div class="tgn-s"><div class="tgn-h"><b data-k="x" class="tgn-b ${old ? 'x' : ''}"></b><span>${old ? '更改标签名称' : '新建标签'}</span></div><label class="tgn-i"><input maxlength="16" placeholder="${old ? '更改标签名称' : '填写标签名称'}" value=""><b data-k="c" class="tgn-cl"></b></label><b class="tgn-ok" data-k="ok">确定</b></div>`;
    ui.scr.append(w); requestAnimationFrame(() => w.classList.add('in'));
    const ip = $('input', w), okb = $('.tgn-ok', w), sync = () => { const v = ip.value.trim(); okb.classList.toggle('on', !!v && v != old); w.classList.toggle('has', !!ip.value); };
    ip.oninput = sync; sync(); setTimeout(() => ip.focus(), 250);
    const end = v => { w.classList.remove('in'); setTimeout(() => w.remove(), 220); done(v); };
    w.addEventListener('click', async e => {
      if (e.target == w) return end('');
      const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
      if (k == 'x') return end('');
      if (k == 'c') { ip.value = ''; sync(); return ip.focus(); }
      const v = ip.value.trim(); if (!v || v == old) return;
      if (!old && allTags().includes(v)) return toast('已经有这个标签了');
      ip.blur(); await loading(500, '标签保存中...'); if (!old) { D().tags = [v, ...allTags()]; saveD(); } end(v);
    });
  });
}
