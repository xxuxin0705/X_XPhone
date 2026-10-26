// 小手机 · 音乐 App：发现（搜索 / 榜单 / TA 推荐）· 我的（我喜欢 / 最近播放 / 歌单）· 播放页（歌词）· 播放队列
// 正文联动：AI 在 <手机> 块里写「点歌|谁|歌名|歌手」，歌会出现在「TA 推荐」里；你正在听的歌也会告诉角色
import { S, D, ui, G, $, $$, esc, uid, save, saveD, on, emit, page, sheet, menu, form, toast, ok, reg, top, back } from '../../core.js';
import { search, playlist, listId, TOPS, HOT, SRC_DEF } from './api.js';
import { M, st, cur, key, same, MODES, playAt, playList, next, prev, toggle, seek, cycleMode, addNext, addQ, removeQ, clearQ, liked, toggleLike, addTo } from './player.js';

const sv = (p, a = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${a}>${p}</svg>`;
const fill = p => `<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const MI = {
  play: fill('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>'),
  pause: fill('<rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/>'),
  next: fill('<path d="M5 6.3v11.4a1 1 0 0 0 1.55.83L14.5 13.2V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v3.8L6.55 5.47A1 1 0 0 0 5 6.3z"/><rect x="17" y="6" width="2" height="12" rx="1"/>'),
  prev: fill('<path d="M19 6.3v11.4a1 1 0 0 1-1.55.83L9.5 13.2V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v3.8l7.95-5.33A1 1 0 0 1 19 6.3z"/><rect x="5" y="6" width="2" height="12" rx="1"/>'),
  list: sv('<path d="M4 6h12M4 12h12M4 18h8M19 15v6M16 18h6"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>'),
  heartOn: fill('<path d="M12 20.6l-.6-.36C10.9 19.9 3.5 15.4 3.5 9.8a5.3 5.3 0 0 1 8.5-4.2 5.3 5.3 0 0 1 8.5 4.2c0 5.6-7.4 10.1-7.9 10.44z"/>'),
  loop: sv('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  one: sv('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/><path d="M11 10h1.5v5"/>'),
  shuf: sv('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  order: sv('<path d="M4 6h16M4 12h10M4 18h6M17 14l3 3-3 3"/>'),
  srch: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  more: fill('<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>'),
  note: sv('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'), down: sv('<path d="M6 9l6 6 6-6"/>'), x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  disc: sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>'), clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};
export const ICON = `<svg viewBox="0 0 24 24" fill="#fff"><path d="M9.5 17.2V6.6c0-.5.36-.92.85-1l8.5-1.4a1 1 0 0 1 1.15 1v10.5"/><circle cx="7" cy="17.4" r="2.9"/><circle cx="17.2" cy="15.8" r="2.9"/><path d="M9.5 9.2l10-1.7V5.2l-10 1.7z"/></svg>`;
const mt = s => { s = Math.max(0, s | 0); return `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`; };
const cover = (s, cls = 'ms-cv') => s?.pic ? `<img class="${cls}" src="${esc(s.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i class="${cls} ms-ph">${MI.note}</i>`;
const recs = () => (D().mus ||= { recs: [] }).recs;

// 每个列表登记一下，点歌行时知道是哪一列的第几首
const CTX = {};
const reglist = (id, list) => (CTX[id] = list, id);
const row = (ctx, s, i, rank) => `<div class="ms-r ${same(s, cur()) ? 'now' : ''}" data-a="mplay" data-x="${ctx}:${i}" data-lp="mmore">${rank ? `<b class="ms-rk">${i + 1}</b>` : cover(s)}<div class="ms-t"><b>${esc(s.name)}</b><small>${esc(s.artist)}${s.by ? ` · ${esc(s.by)}推荐` : ''}</small></div><i class="ms-mo" data-a="mmore" data-x="${ctx}:${i}">${MI.more}</i></div>`;
const rows = (ctx, list, rank) => list.length ? list.map((s, i) => row(ctx, s, i, rank)).join('') : `<p class="ms-none">这里还没有歌</p>`;

/* ---------- 迷你播放条 ---------- */
const mini = () => { const s = cur(); return s ? `<div class="ms-mini" data-a="mfull">${cover(s)}<div class="ms-t"><b>${esc(s.name)}</b><small>${esc(st.err || s.artist)}</small></div><i data-a="mtog" class="${st.loading ? 'ld' : ''}">${st.playing ? MI.pause : MI.play}</i><i data-a="mq">${MI.list}</i><span class="ms-bar" style="--p:${st.d ? st.t / st.d : 0}"></span></div>` : ''; };

/* ---------- 发现 ---------- */
let tab = 'find', sq = '', sres = null, spage = 1, smore = false, sbusy = false;
const find = () => {
  const m = M(), bar = `<form class="ms-sb" data-ms>${MI.srch}<input name="q" value="${esc(sq)}" placeholder="搜索歌曲、歌手" enterkeyhint="search">${sq ? `<i data-a="mclr">${MI.x}</i>` : ''}</form>`;
  if (sres) return bar + `<div class="ms-sec">${sbusy && !sres.length ? '<p class="ms-none">搜索中…</p>' : rows(reglist('s', sres), sres)}${smore ? `<button class="ms-more" data-a="mmoreres">${sbusy ? '加载中…' : '加载更多'}</button>` : ''}</div>`;
  const r = recs();
  return bar
    + (r.length ? `<div class="ms-sec"><div class="ms-h"><b>TA 推荐</b><span data-a="mopen" data-x="rec">全部 ${r.length}</span></div>${rows(reglist('rec', r.slice(0, 4)), r.slice(0, 4))}</div>` : '')
    + `<div class="ms-sec"><div class="ms-h"><b>榜单</b></div><div class="ms-tops">${TOPS.map(([id, n, c]) => `<div class="ms-top" style="--c:${c}" data-a="mopen" data-x="top:${id}"><b>${n}</b>${MI.play}</div>`).join('')}</div></div>`
    + (m.sh.length ? `<div class="ms-sec"><div class="ms-h"><b>搜索历史</b><span data-a="mshc">清空</span></div><div class="chips">${m.sh.map(w => `<b class="chip" data-a="mkw" data-x="${esc(w)}">${esc(w)}</b>`).join('')}</div></div>` : '')
    + `<div class="ms-sec"><div class="ms-h"><b>大家在搜</b></div><div class="chips">${HOT.map(w => `<b class="chip" data-a="mkw" data-x="${esc(w)}">${esc(w)}</b>`).join('')}</div></div>`;
};
async function doSearch(w, more) {
  w = String(w || '').trim(); if (!w) return;
  if (!more) { sq = w; sres = []; spage = 1; const m = M(); m.sh = [w, ...m.sh.filter(x => x != w)].slice(0, 12); save(); } else spage++;
  sbusy = true; rer();
  try { const r = await search(sq, spage); sres = more ? [...sres, ...r.list.filter(s => !sres.some(x => same(x, s)))] : r.list; smore = r.more; }
  catch (e) { toast('搜索失败：' + (e.message || e)); smore = false; }
  sbusy = false; rer();
}
/* ---------- 我的 ---------- */
const grid = list => { const ps = list.filter(s => s.pic).slice(0, 4); return ps.length ? `<div class="ms-grid n${Math.min(ps.length, 4)}">${ps.map(s => `<img src="${esc(s.pic)}" referrerpolicy="no-referrer" alt="">`).join('')}</div>` : `<i class="ms-grid ms-ph">${MI.note}</i>`; };
const mine = () => { const m = M();
  return `<div class="ms-quick"><div data-a="mopen" data-x="liked" class="ms-q lk">${MI.heartOn}<b>我喜欢</b><small>${m.liked.length} 首</small></div><div data-a="mopen" data-x="hist" class="ms-q">${MI.clock}<b>最近播放</b><small>${m.hist.length} 首</small></div></div>`
    + `<div class="ms-sec"><div class="ms-h"><b>我的歌单</b><span data-a="mnew">${MI.plus}</span></div>${m.lists.map(l => `<div class="ms-pl" data-a="mopen" data-x="pl:${l.id}" data-lp="mplm">${l.cover ? `<img class="ms-grid" src="${esc(l.cover)}" alt="">` : grid(l.songs)}<div class="ms-t"><b>${esc(l.n)}</b><small>${l.songs.length} 首${l.from ? ' · 导入' : ''}</small></div></div>`).join('') || '<p class="ms-none">还没有歌单</p>'}</div>`;
};
const rer = () => { const t = top(); t?.el?.classList.contains('musicapp') && (t.reb(), keepMini(t)); };
const keepMini = t => { const f = $('.pg-f', t.el); f && (f.innerHTML = foot()); };
const foot = () => mini() + `<nav class="tabs">${[['find', '发现', MI.disc], ['mine', '我的', MI.heart]].map(([k, l, i]) => `<button data-a="mtab" data-x="${k}" class="${tab == k ? 'on' : ''}">${i}<span>${l}</span></button>`).join('')}</nav>`;

/* ---------- 歌单页（我喜欢 / 最近 / 自建 / 榜单 / TA 推荐） ---------- */
const listOf = id => { const m = M(); return id == 'liked' ? { n: '我喜欢的音乐', songs: m.liked } : id == 'hist' ? { n: '最近播放', songs: m.hist } : id == 'rec' ? { n: 'TA 推荐', songs: recs() } : id.startsWith('pl:') ? m.lists.find(l => l.id == id.slice(3)) : null; };
function openList(id) {
  const top_ = id.startsWith('top:') ? TOPS.find(t => t[0] == id.slice(4)) : null;
  let data = top_ ? { n: top_[1], songs: [], tint: top_[2], loading: true } : listOf(id); if (!data) return;
  if (top_) playlist(top_[0]).then(l => { data.songs = l; data.loading = false; pg.reb(); }).catch(e => { data.loading = false; data.err = e.message || '加载失败'; pg.reb(); });
  const own = id.startsWith('pl:'), list = () => data.songs;
  const pg = page({ title: '', cls: 'musicapp ms-lpg', live: 1,
    right: () => own ? `<b data-a="mplm" data-x="${id}">${MI.more}</b>` : id == 'hist' || id == 'rec' ? `<b class="txt" data-a="mlclr" data-x="${id}">清空</b>` : '',
    body: () => `<div class="ms-hero" style="${data.tint ? `--c:${data.tint}` : ''}">${data.cover ? `<img class="ms-grid big" src="${esc(data.cover)}" alt="">` : top_ ? `<i class="ms-grid big ms-tint">${MI.note}</i>` : grid(list())}<div><b>${esc(data.n)}</b><small>${data.loading ? '加载中…' : data.err ? esc(data.err) : list().length + ' 首'}</small></div></div>`
      + (list().length ? `<div class="ms-act"><button class="btn pri" data-a="mall" data-x="${id}">${MI.play}播放全部</button><button class="btn" data-a="mall" data-x="${id}" data-s="1">${MI.shuf}随机</button></div>` : '')
      + `<div class="ms-sec">${data.loading ? '' : rows(reglist('L', list()), list(), !!top_)}</div>`,
    foot: () => mini(), acts: { ...A, mall: (x, t) => list().length && playList(list(), 0, !!t.dataset.s) },
    onClose: () => setTimeout(rer),
  });
  pg._list = list; pg._lid = id; // 歌曲菜单要知道是哪个列表
}
/* ---------- 播放页 ---------- */
let lyr = false;
const lyrHtml = () => st.lrc.length ? st.lrc.map((l, i) => `<p data-i="${i}" data-t="${l.t}" data-a="mseekl">${esc(l.x)}${l.tr ? `<small>${esc(l.tr)}</small>` : ''}</p>`).join('') : `<p class="ms-nolrc">${st.loading ? '' : '暂无歌词'}</p>`;
const player = () => { const s = cur(), m = M(); if (!s) return '<div class="ms-none">没有正在播放的歌</div>';
  return `<div class="ms-bg" style="background-image:url('${esc(s.pic)}')"></div><div class="ms-pp">
  <div class="ms-stage" data-a="mlyr">${lyr ? `<div class="ms-lrc">${lyrHtml()}</div>` : `<div class="ms-art ${st.playing ? 'on' : ''}">${cover(s, 'ms-big')}</div><p class="ms-line"></p>`}</div>
  <div class="ms-info"><div><b>${esc(s.name)}</b><small>${esc(s.artist)}</small></div><i data-a="mlike" class="${liked(s) ? 'on' : ''}">${liked(s) ? MI.heartOn : MI.heart}</i></div>
  <div class="ms-prog"><input type="range" class="ms-seek" min="0" max="${Math.max(1, st.d | 0)}" step="1" value="${st.t | 0}"><div><span class="ms-ct">${mt(st.t)}</span><span class="ms-dt">${st.err ? esc(st.err) : mt(st.d)}</span></div></div>
  <div class="ms-ctl"><i data-a="mmode">${MI[m.mode]}</i><i data-a="mprev">${MI.prev}</i><i data-a="mtog" class="big ${st.loading ? 'ld' : ''}">${st.playing ? MI.pause : MI.play}</i><i data-a="mnext">${MI.next}</i><i data-a="mq">${MI.list}</i></div></div>`; };
function openPlayer() {
  if (!cur()) return toast('还没有在放的歌');
  page({ title: '', cls: 'ms-player', live: 1, body: player, acts: A, right: () => `<b data-a="mmore" data-x="now:0">${MI.more}</b>`,
    after: el => { const r = $('.ms-seek', el); if (!r || r._b) return; r._b = 1; r.addEventListener('input', () => { r._drag = 1; $('.ms-ct', el).textContent = mt(+r.value); }); r.addEventListener('change', () => { seek(+r.value); r._drag = 0; }); tickP(); } });
}
// 进度和歌词只改 DOM，不重画整页
function tickP() {
  const t = top(); if (!t?.el?.classList.contains('ms-player')) { const f = $('.ms-mini .ms-bar', top()?.el || document.createElement('i')); f && f.style.setProperty('--p', st.d ? st.t / st.d : 0); return; }
  const el = t.el, r = $('.ms-seek', el); if (r && !r._drag) { r.max = Math.max(1, st.d | 0); r.value = st.t | 0; r.style.setProperty('--p', st.d ? st.t / st.d : 0); $('.ms-ct', el).textContent = mt(st.t); $('.ms-dt', el).textContent = st.err || mt(st.d); }
  let i = -1; for (let k = 0; k < st.lrc.length; k++) { if (st.lrc[k].t <= st.t + .25) i = k; else break; }
  const ln = $('.ms-line', el); ln && (ln.textContent = st.lrc[i]?.x || '');
  const box = $('.ms-lrc', el); if (box && box._i !== i) { box._i = i; $$('p.on', box).forEach(p => p.classList.remove('on')); const p = $(`p[data-i="${i}"]`, box); p && (p.classList.add('on'), box.scrollTo({ top: p.offsetTop - box.clientHeight / 2 + p.offsetHeight / 2, behavior: 'smooth' })); }
}
/* ---------- 播放队列 ---------- */
function openQueue() {
  const s = sheet({ title: () => `播放列表 <small>${M().q.length}</small>`, noBack: 1, cls: 'ms-qs', right: () => M().q.length ? `<b class="txt" data-a="mqclr">清空</b>` : '',
    body: () => M().q.map((x, i) => `<div class="ms-r ${i == M().qi ? 'now' : ''}" data-a="mqat" data-x="${i}"><div class="ms-t"><b>${esc(x.name)}</b><small>${esc(x.artist)}</small></div><i class="ms-mo" data-a="mqrm" data-x="${i}">${MI.x}</i></div>`).join('') || '<p class="ms-none">播放列表是空的</p>',
    acts: { mqat: i => playAt(+i), mqrm: i => removeQ(+i), mqclr: async () => { if (await ok('清空播放列表？')) { clearQ(); s.close(); } } } });
  s._q = 1;
}
/* ---------- 歌曲菜单 ---------- */
const songAt = x => { const [c, i] = String(x).split(':'); return c == 'now' ? cur() : c == 'L' ? top()?._list?.()[+i] : CTX[c]?.[+i]; };
async function songMenu(x) {
  const s = songAt(x); if (!s) return; const lid = top()?.el?.classList.contains('ms-lpg') && String(x).startsWith('L:') ? top()._lid : '';
  const k = await menu([['n', '下一首播放'], ['q', '加入播放列表'], ['l', liked(s) ? '取消喜欢' : '喜欢'], ['a', '加入歌单'], ...(lid ? [['r', '从这个列表移除', 'danger']] : [])], `${esc(s.name)} · ${esc(s.artist)}`);
  if (k == 'n') addNext(s); else if (k == 'q') { addQ(s); toast('已加入播放列表'); } else if (k == 'l') toast(toggleLike(s) ? '已喜欢' : '已取消喜欢');
  else if (k == 'a') { const m = M(), c = await menu([...m.lists.map(l => [l.id, esc(l.n)]), ['+', '＋ 新建歌单']], '加入歌单'); if (!c) return; const l = c == '+' ? await newList() : m.lists.find(x => x.id == c); l && addTo(l, s); }
  else if (k == 'r') { const l = listOf(lid); l && (l.songs.splice(l.songs.findIndex(y => same(y, s)), 1), lid == 'rec' ? saveD() : save(), top().reb()); }
}
async function newList() { const r = await form('新建歌单', [['n', '歌单名']]); if (!r?.n?.trim()) return null; const l = { id: uid(), n: r.n.trim(), songs: [] }; M().lists.unshift(l); save(); rer(); return l; }
async function importList() {
  const r = await form('导入网易云歌单', [['u', '歌单链接或 ID']]); const id = listId(r?.u || ''); if (!r) return; if (!id) return toast('没认出歌单 ID');
  toast('导入中…'); try { const songs = await playlist(id); if (!songs.length) return toast('这个歌单是空的，或者没导进来'); const l = { id: uid(), n: `导入歌单 ${id.slice(-4)}`, songs, from: id }; M().lists.unshift(l); save(); rer(); toast(`导入了 ${songs.length} 首`); } catch (e) { toast('导入失败：' + (e.message || e)); }
}
async function listMenu(id) {
  const l = listOf(id.startsWith('pl:') ? id : 'pl:' + id); if (!l) return;
  const k = await menu([['r', '重命名'], ['c', '换封面'], ['d', '删除歌单', 'danger']], esc(l.n));
  if (k == 'r') { const r = await form('重命名', [['n', '歌单名']], { n: l.n }); r?.n?.trim() && (l.n = r.n.trim(), save()); }
  if (k == 'c') { const r = await form('歌单封面', [['cover', '封面', 'img']], { cover: l.cover || '' }); r && (l.cover = r.cover, save()); }
  if (k == 'd' && await ok(`删除歌单「${l.n}」？`)) { M().lists = M().lists.filter(x => x != l); save(); top()?._lid == 'pl:' + l.id && back(); }
  top()?.reb?.(); rer();
}
async function settings() {
  const m = M(); const r = await form('音乐设置', [['search', '搜索接口', 'text', SRC_DEF.search], ['meting', '播放 / 歌词接口（Meting）', 'text', SRC_DEF.meting], ['auto', 'TA 推荐的歌自动播放', 'tog'], ['tell', '让角色知道你在听什么', 'tog']], { search: m.src.search || '', meting: m.src.meting || '', auto: !!m.auto, tell: m.tell !== false });
  if (!r) return; m.src = { search: r.search.trim(), meting: r.meting.trim() }; m.auto = r.auto; m.tell = r.tell; save(); toast('已保存');
}
/* ---------- 动作 ---------- */
const A = {
  mplay: (x, t) => { const [c, i] = String(x).split(':'), list = c == 'L' ? top()?._list?.() : CTX[c]; if (!list?.[+i]) return; const s = list[+i]; same(s, cur()) && st.playing ? openPlayer() : c == 's' || c == 'rec' ? playAt(addQ(s)) : playList(list, +i); },
  mmore: x => songMenu(x), mtog: () => toggle(), mnext: () => next(), mprev: () => prev(), mmode: () => cycleMode(), mq: () => openQueue(), mfull: () => openPlayer(),
  mlike: () => { const s = cur(); s && toast(toggleLike(s) ? '已喜欢' : '已取消喜欢'); },
  mlyr: (x, t, e) => { if (e.target.closest('[data-a="mseekl"]')) return; lyr = !lyr; top()?.reb(); tickP(); },
  mseekl: (x, t) => { seek(+t.dataset.t); st.playing || toggle(); },
  mtab: (x, t, e, pg) => { tab = x; pg.re(); }, mkw: w => doSearch(w), mclr: () => { sq = ''; sres = null; rer(); }, mmoreres: () => !sbusy && doSearch(sq, true),
  mshc: () => { M().sh = []; save(); rer(); }, mopen: x => openList(x), mnew: async () => { const l = await newList(); l && openList('pl:' + l.id); },
  mplm: x => listMenu(String(x).replace(/^pl:/, '')), mimp: () => importList(),
  mlclr: async x => { if (!await ok(x == 'hist' ? '清空最近播放？' : '清空 TA 推荐？')) return; x == 'hist' ? (M().hist = [], save()) : (recs().length = 0, saveD()); top()?.reb(); },
};
reg({
  id: 'music', name: '音乐', icon: ICON,
  open: () => page({ title: () => tab == 'find' ? '发现' : '我的', cls: 'musicapp', live: 1,
    right: () => tab == 'mine' ? `<b data-a="mimp" title="导入歌单">${MI.plus}</b><b data-a="mset">${MI.gear}</b>` : `<b data-a="mset">${MI.gear}</b>`,
    body: () => tab == 'find' ? find() : mine(), foot, acts: { ...A, mset: settings },
    after: el => { const f = $('form[data-ms]', el); f && !f._b && (f._b = 1, f.addEventListener('submit', e => { e.preventDefault(); const v = f.q.value; f.q.blur(); doSearch(v); })); } }),
});

/* ---------- 全局：状态变了刷新界面；灵动岛显示正在放 ---------- */
on('music', () => {
  const t = top(); if (t?.el?.classList.contains('ms-player')) { const sc = $('.ms-lrc', t.el)?.scrollTop; t.reb(); tickP(); const b = $('.ms-lrc', t.el); b && sc != null && (b.scrollTop = sc); }
  else if (t?.el?.classList.contains('musicapp')) { const f = $('.pg-f', t.el); f && (f.innerHTML = t.el.classList.contains('ms-lpg') ? mini() : foot()); $$('.ms-r', t.el).forEach(r => { const s = songAt(r.dataset.x); r.classList.toggle('now', same(s, cur())); }); }
  $$('.sheet.ms-qs').forEach(x => x._pg?.reb?.());
  const isl = $('.isl', ui.root); if (isl) { const s = cur(), on_ = !!s && (st.playing || st.loading); isl.classList.toggle('mu', on_); isl.dataset.a = on_ ? 'mfull' : ''; isl.innerHTML = on_ ? `${s.pic ? `<img src="${esc(s.pic)}" alt="">` : ''}<i class="eq ${st.playing ? 'on' : ''}"><b></b><b></b><b></b></i>` : ''; }
});
on('music-t', tickP);
// AI 在正文里点的歌
on('music-rec', list => {
  const r = recs(), m = M(); let first = null;
  for (const x of list) { if (!x.name) continue; const s = { id: '', name: x.name, artist: x.artist || '未知歌手', pic: '', dur: 0, by: x.by || '' }; const at = r.findIndex(y => same(y, s) || y.name == s.name && y.artist == s.artist); at >= 0 && r.splice(at, 1); r.unshift(s); first ||= s; }
  r.length > 50 && (r.length = 50); saveD(); if (!first) return;
  toast(`${first.by || 'TA'} 给你推荐了《${first.name}》`);
  m.auto && (st.playing ? addQ(first) : playAt(addQ(first)));
  emit('music');
});
// 灵动岛在页面外面，用全局动作
Object.assign(G, { mfull: openPlayer });
export { openPlayer };
