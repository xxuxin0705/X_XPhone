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
      return `${srch()}<div class="tg-g"><div class="tg-r" data-a="tgun" data-q="未设置标签的朋友"><b>未设置标签的朋友 <em>(${un.length})</em></b>${un.length ? `<small>${esc(names(un))}</small>` : ''}</div></div>
<div class="tg-g">${allTags().map(t => { const L = F.filter(c => tagsOf(c).includes(t)); return `<div class="tg-r ${ed ? 'ed' : ''}" data-a="${ed ? 'tgdel' : 'tgo'}" data-x="${esc(t)}" data-q="${esc(t)}">${ed ? '<i class="tg-minus"></i>' : ''}<div><b>${esc(t)} <em>(${L.length})</em></b>${L.length ? `<small>${esc(names(L))}</small>` : ''}</div></div>`; }).join('')}</div>`; },
    foot: () => `<nav class="tg-f"><b data-a="tgnew">新建</b><b data-a="tged">${ed ? '完成' : '编辑'}</b></nav>`,
    acts: {
      tgun: () => untaggedPage(),
      tgo: t => tagPage(t),
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
// 一个标签：成员列表，最上面「添加成员」；右上角改名 / 删除
function tagPage(t) {
  const L = () => fr().filter(c => tagsOf(c).includes(t));
  page({ title: () => `${esc(t)}(${L().length})`, cls: 'tgpg', live: 1, right: () => '<b class="pay-more" data-a="tgm">···</b>',
    body: () => `<div class="tg-g"><div class="tg-add" data-a="tgadd"><i>＋</i><span>添加成员</span></div>${L().map(c => `<div class="tg-p"><img src="${esc(avOf(c))}"><span>${esc(nm(c))}</span><b data-a="tgrm" data-x="${c.id}">移除</b></div>`).join('')}</div>`,
    acts: {
      tgadd: () => pickPeople('添加成员', L(), S => { fr().forEach(c => setTags(c, S.includes(c) ? [...tagsOf(c), t] : tagsOf(c).filter(x => x != t))); }, '完成'),
      tgrm: (id) => { const c = fr().find(x => x.id == id); c && setTags(c, tagsOf(c).filter(x => x != t)); saveD(); emit('chat'); },
      tgm: async (x, tt, e, pg) => { const k = await menu([['r', '重命名'], ['d', '删除标签', 'danger']], esc(t)); if (k == 'd' && await ok(`删除标签「${t}」`)) { D().tags = allTags().filter(y => y != t); fr().forEach(c => setTags(c, tagsOf(c).filter(y => y != t))); saveD(); emit('chat'); return back(); }
        if (k == 'r') { const n = await newTag(t); if (!n || n == t) return; D().tags = allTags().map(y => y == t ? n : y); fr().forEach(c => tagsOf(c).includes(t) && setTags(c, tagsOf(c).map(y => y == t ? n : y))); saveD(); emit('chat'); back(); tagPage(n); } },
    } });
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
      tgmg: () => tagListPage(),
      tgok: async () => { if (!changed()) return; await loading(600, '标签保存中...'); cs.forEach(c => setTags(c, one ? [...sel] : [...tagsOf(c), ...sel])); saveD(); emit('chat'); back(); setTimeout(() => top()?.re?.()); toast('已保存'); }, // 回到的页（聊天设置）也重画，显示新标签
    } });
}

// 新建标签（底部弹出：‹ 新建标签 / 输入框 / 确定，填了字才变绿）→「标签保存中…」；old：改名时的旧名字
export function newTag(old = '') {
  return new Promise(done => {
    const w = Object.assign(document.createElement('div'), { className: 'tgn' });
    w.innerHTML = `<div class="tgn-s"><div class="tgn-h"><b data-k="x" class="tgn-b"></b><span>${old ? '修改标签名称' : '新建标签'}</span></div><label class="tgn-i"><input maxlength="16" placeholder="填写标签名称" value="${esc(old)}"><b data-k="c" class="tgn-cl"></b></label><b class="tgn-ok" data-k="ok">确定</b></div>`;
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
