// 小手机 · 音乐 App（样式照着网易云的手机端做：红色点缀、粉色黑胶「心动」页、深色「我的」头部）
// 四个页签：首页（心动 / 推荐）· 搜索 · 笔记（摘录的歌词）· 我的（最近、歌词本、我喜欢、歌单）
// 正文联动：开了「角色给你点歌」后，AI 在 <手机> 块里写「点歌|谁|歌名|歌手」→ 推荐里出现；「按剧情推荐」调一次 API 根据当前剧情推几首
import { S, D, ui, G, $, $$, esc, uid, save, saveD, on, emit, page, sheet, menu, form, toast, ok, reg, top, back, meObj, defAv, llm, json, sysCtx, task, now, syncInject } from '../../core.js';
import { search, playlist, listId, TOPS, HOT, SRC_DEF } from './api.js';
import { M, st, cur, key, same, MODES, playAt, playList, next, prev, toggle, seek, cycleMode, addNext, addQ, removeQ, clearQ, liked, toggleLike, addTo } from './player.js';

const sv = (p, a = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a}>${p}</svg>`;
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
  shuf: sv('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'), order: sv('<path d="M4 6h16M4 12h10M4 18h6M17 14l3 3-3 3"/>'),
  srch: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'), more: fill('<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>'),
  note: sv('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'), x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  cmt: sv('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5z"/>'),
  clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), lyr: sv('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'), pen: sv('<path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16z"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.4-6.5 8-6.5s7 2 8 6.5"/>'), gear: sv('<circle cx="12" cy="12" r="3"/><path d="M4.9 12a7 7 0 0 1 .1-1.2L3 9.3l2-3.4 2.2.7a7 7 0 0 1 2-1.2L9.8 3h4.4l.6 2.4a7 7 0 0 1 2 1.2l2.2-.7 2 3.4-2 1.5a7 7 0 0 1 0 2.4l2 1.5-2 3.4-2.2-.7a7 7 0 0 1-2 1.2l-.6 2.4H9.8l-.6-2.4a7 7 0 0 1-2-1.2L5 18.3l-2-3.4 2-1.5A7 7 0 0 1 4.9 12z"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'), spark: sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'), play2: sv('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>'),
};
export const ICON = `<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M10 16.5V8l6-1.5V15"/><circle cx="8.3" cy="16.6" r="1.9"/><circle cx="14.3" cy="15.1" r="1.9"/></svg>`;
const mt = s => { s = Math.max(0, s | 0); return `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const cv = (s, cls = 'mu-cv') => s?.pic ? `<img class="${cls}" src="${esc(s.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i class="${cls} mu-ph">${MI.note}</i>`;
const MD = () => (D().mus ||= { recs: [] });
const recs = () => MD().recs;
const notes = () => M().notes ||= [];
const CTX = {}; const reglist = (id, list) => (CTX[id] = list, id);
const row = (ctx, s, i, rank) => `<div class="mu-r ${same(s, cur()) ? 'now' : ''}" data-a="mplay" data-x="${ctx}:${i}" data-lp="mmore">${rank ? `<b class="mu-rk">${i + 1}</b>` : ''}<div class="mu-t"><b>${esc(s.name)}</b><small>${esc(s.artist)}${s.by ? `<em>${esc(s.by)} 点的</em>` : ''}</small></div><i class="mu-mo" data-a="mmore" data-x="${ctx}:${i}">${MI.more}</i></div>`;
const rows = (ctx, list, rank) => list.length ? list.map((s, i) => row(ctx, s, i, rank)).join('') : `<p class="mu-none">这里还没有歌</p>`;

/* ---------- 迷你播放条 / 底部页签 ---------- */
let tab = 'home', home = 'heart';
const mini = () => { const s = cur(); return s ? `<div class="mu-mini" data-a="mgo"><i class="mu-disc-s ${st.playing ? 'spin' : ''}">${cv(s, 'mu-cvr')}</i><div class="mu-t"><b>${esc(s.name)}<span> - ${esc(s.artist)}</span></b></div><i class="mu-ib ${st.loading ? 'ld' : ''}" data-a="mtog">${st.playing ? MI.pause : MI.play}</i><i class="mu-ib" data-a="mq">${MI.list}</i></div>` : ''; };
const nav = () => `<nav class="mu-nav">${[['home', '首页'], ['srch', '搜索'], ['notes', '笔记'], ['mine', '我的']].map(([k, l]) => `<button data-a="mtab" data-x="${k}" class="${tab == k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
const foot = () => (tab == 'home' && home == 'heart' ? '' : mini()) + nav();

/* ---------- 首页：心动（黑胶）/ 推荐 ---------- */
const seg = () => `<div class="mu-seg">${[['heart', '心动'], ['rec', '推荐']].map(([k, l]) => `<b data-a="mhome" data-x="${k}" class="${home == k ? 'on' : ''}">${l}</b>`).join('')}</div>`;
let lyrOn = false, pick = null; // pick：歌词摘录模式里选中的行
const lyrHtml = () => st.lrc.length ? st.lrc.map((l, i) => `<p data-i="${i}" data-t="${l.t}" data-a="${pick ? 'mpk' : 'mseekl'}" data-lp="mpkon" class="${pick?.has(i) ? 'pk' : ''}">${esc(l.x)}${l.tr ? `<small>${esc(l.tr)}</small>` : ''}</p>`).join('') : `<p class="mu-nolrc">${st.loading ? '' : '暂无歌词'}</p>`;
const vinyl = s => `<div class="mu-vinyl ${st.playing ? 'on' : ''}" data-a="mlyr"><div class="mu-arm"></div><div class="mu-disc">${cv(s, 'mu-cvd')}</div></div>`;
const heartPage = () => { const s = cur(), m = M();
  const nc = s ? notes().filter(n => same(n.song, s)).length : 0;
  if (!s) return `<div class="mu-heart"><div class="mu-vinyl idle" data-a="mheartgo"><div class="mu-arm"></div><div class="mu-disc"><i class="mu-cvd mu-ph">${MI.heart}</i></div></div><p class="mu-tip2">${m.liked.length ? `${MI.heartOn} 开启心动模式，随机播放我喜欢的 ${m.liked.length} 首` : '先去喜欢几首歌，这里会随机放给你听'}</p></div>`;
  return `<div class="mu-heart ${lyrOn ? 'lyr' : ''}">${lyrOn ? `<div class="mu-lrc" data-a="mlyr">${lyrHtml()}</div>${pick ? `<div class="mu-pkbar"><span>已选 ${pick.size} 句</span><b data-a="mpkx">取消</b><b class="pri" data-a="mpkok">摘录</b></div>` : ''}` : vinyl(s)}
  <div class="mu-meta"><div><b>${esc(s.name)}</b><small>${esc(s.artist)}</small></div><i data-a="mlike" class="${liked(s) ? 'on' : ''}">${liked(s) ? MI.heartOn : MI.heart}</i><i data-a="mnotes" data-x="cur">${MI.cmt}${nc ? `<em>${nc}</em>` : ''}</i><i data-a="mmore" data-x="now:0">${MI.more}</i></div>
  <div class="mu-prog"><input type="range" class="mu-seek" min="0" max="${Math.max(1, st.d | 0)}" step="1" value="${st.t | 0}"><div><span class="mu-ct">${mt(st.t)}</span><span class="mu-q">${st.err ? esc(st.err) : '极高音质'}</span><span class="mu-dt">${mt(st.d)}</span></div></div>
  <div class="mu-ctl"><i data-a="mmode">${MI[m.mode]}</i><i data-a="mprev">${MI.prev}</i><i data-a="mtog" class="big ${st.loading ? 'ld' : ''}">${st.playing ? MI.pause : MI.play}</i><i data-a="mnext">${MI.next}</i><i data-a="mq">${MI.list}</i></div></div>`; };
const recPage = () => { const r = recs(), a = MD().ai;
  return `<div class="mu-recp"><div class="mu-today"><div><b>今日为你推荐</b><p>${a ? esc(a.blurb) : '让 TA 根据现在的剧情，给你挑几首此刻想听的歌'}</p></div><i data-a="mai" class="${a ? '' : 'pri'}">${MI.spark}</i></div>
  ${a?.songs?.length ? `<div class="mu-sec">${rows(reglist('ai', a.songs), a.songs)}</div>` : ''}
  <div class="mu-sec"><div class="mu-h"><b>TA 点的歌</b>${r.length ? `<span data-a="mlclr" data-x="rec">清空</span>` : ''}</div>${r.length ? rows(reglist('rec', r), r) : `<p class="mu-none">${M().ask ? '角色还没有给你点过歌' : '去「我的」右上角打开「角色给你点歌」'}</p>`}</div></div>`; };

/* ---------- 搜索 ---------- */
let sq = '', sres = null, spage = 1, smore = false, sbusy = false;
const srchPage = () => { const m = M(), bar = `<form class="mu-sb" data-ms>${MI.srch}<input name="q" value="${esc(sq)}" placeholder="搜索歌曲、歌手" enterkeyhint="search">${sq ? `<i data-a="mclr">${MI.x}</i>` : ''}</form>`;
  if (sres) return bar + `<div class="mu-sec">${sbusy && !sres.length ? '<p class="mu-none">搜索中…</p>' : rows(reglist('s', sres), sres)}${smore ? `<button class="mu-more" data-a="mmoreres">${sbusy ? '加载中…' : '加载更多'}</button>` : ''}</div>`;
  return bar + `<div class="mu-tops">${TOPS.map(([id, n, c]) => `<div class="mu-top" style="--c:${c}" data-a="mopen" data-x="top:${id}"><b>${n}</b>${MI.note}</div>`).join('')}</div>`
    + (m.sh.length ? `<div class="mu-sec"><div class="mu-h"><b>搜索历史</b><span data-a="mshc">清空</span></div><div class="chips">${m.sh.map(w => `<b class="chip" data-a="mkw" data-x="${esc(w)}">${esc(w)}</b>`).join('')}</div></div>` : '')
    + `<div class="mu-sec"><div class="mu-h"><b>快速发现</b></div><div class="chips">${HOT.map(w => `<b class="chip" data-a="mkw" data-x="${esc(w)}">${esc(w)}</b>`).join('')}</div></div>`; };
async function doSearch(w, more) {
  w = String(w || '').trim(); if (!w) return;
  if (!more) { sq = w; sres = []; spage = 1; const m = M(); m.sh = [w, ...m.sh.filter(x => x != w)].slice(0, 12); save(); } else spage++;
  sbusy = true; rer();
  try { const r = await search(sq, spage); sres = more ? [...sres, ...r.list.filter(s => !sres.some(x => same(x, s)))] : r.list; smore = r.more; }
  catch (e) { toast('搜索失败：' + (e.message || e)); smore = false; }
  sbusy = false; rer();
}
/* ---------- 笔记（歌词摘录） ---------- */
const noteCard = n => `<div class="mu-note" data-a="mnplay" data-x="${n.id}" data-lp="mndel"><div class="mu-nh">${cv(n.song)}<div class="mu-t"><b>${esc(n.song.name)}</b><small>${esc(n.song.artist)} · ${new Date(n.ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</small></div><i class="mu-mo" data-a="mndel" data-x="${n.id}">${MI.more}</i></div><blockquote>${n.lines.map(esc).join('<br>')}</blockquote>${n.text ? `<p>${esc(n.text)}</p>` : ''}</div>`;
const notesPage = (only) => { const L = only ? notes().filter(n => same(n.song, only)) : notes();
  return L.length ? L.map(noteCard).join('') : `<div class="mu-empty">${MI.pen}<p>还没有摘录的歌词</p><small>播放页点封面看歌词，长按一句开始摘录</small></div>`; };
/* ---------- 我的 ---------- */
const hours = () => ((M().sec || 0) / 3600).toFixed(1);
const minePage = () => { const m = M(), me = meObj(); const grid = l => { const ps = l.filter(s => s.pic).slice(0, 1); return ps.length ? `<img class="mu-cv" src="${esc(ps[0].pic)}" referrerpolicy="no-referrer" alt="">` : `<i class="mu-cv mu-ph">${MI.note}</i>`; };
  return `<div class="mu-prof"><img class="mu-av" src="${esc(me.av || defAv(me.nick))}" alt=""><b>${esc(me.nick)}</b><small>${m.liked.length} 首喜欢 · 听歌 ${hours()} 小时</small>
  <div class="mu-pb"><b data-a="mopen" data-x="hist">${MI.clock}最近</b><b data-a="mnotes" data-x="all">${MI.lyr}歌词</b><b data-a="mq">${MI.list}播放列表</b></div></div>
  <div class="mu-body"><div class="mu-h2"><b>音乐</b><span data-a="mnew">${MI.plus}</span></div>
  <div class="mu-r pl" data-a="mopen" data-x="liked">${grid(m.liked)}<div class="mu-t"><b>我喜欢的音乐</b><small>${m.liked.length} 首</small></div><em class="mu-hm" data-a="mheartgo">${MI.heartOn}心动模式</em></div>
  ${m.lists.map(l => `<div class="mu-r pl" data-a="mopen" data-x="pl:${l.id}" data-lp="mplm">${l.cover ? `<img class="mu-cv" src="${esc(l.cover)}" alt="">` : grid(l.songs)}<div class="mu-t"><b>${esc(l.n)}</b><small>歌单 · ${l.songs.length} 首${l.from ? ' · 导入' : ''}</small></div><i class="mu-mo" data-a="mplm" data-x="${l.id}">${MI.more}</i></div>`).join('')}</div>`; };

/* ---------- 页面壳 ---------- */
const rer = () => { const t = top(); if (!t?.el?.classList.contains('musicapp')) return; const b = $('.pg-b', t.el), sc = b?.scrollTop; t.re(); b && ($('.pg-b', t.el).scrollTop = sc); tickP(); };
const cls = () => `musicapp mu-${tab}${tab == 'home' ? '-' + home : ''}`;
function openApp() {
  page({ cls: cls(), live: 1, title: () => tab == 'home' ? seg() : tab == 'srch' ? '搜索' : tab == 'notes' ? `笔记 <small>${notes().length}</small>` : '',
    right: () => tab == 'mine' ? `<b data-a="mmenu">${MI.more}</b>` : tab == 'notes' && notes().length ? `<b class="txt" data-a="mnclr">清空</b>` : '',
    body: () => tab == 'home' ? (home == 'heart' ? heartPage() : recPage()) : tab == 'srch' ? srchPage() : tab == 'notes' ? notesPage() : minePage(),
    foot, acts: A, after: el => { el.className = `pg ${cls()}${el.classList.contains('in') ? ' in' : ''}`; const f = $('form[data-ms]', el); f && !f._b && (f._b = 1, f.addEventListener('submit', e => { e.preventDefault(); const v = f.q.value; f.q.blur(); doSearch(v); })); bindSeek(el); tickP(); } });
}
const bindSeek = el => { const r = $('.mu-seek', el); if (!r || r._b) return; r._b = 1; r.addEventListener('input', () => { r._drag = 1; $('.mu-ct', el).textContent = mt(+r.value); }); r.addEventListener('change', () => { seek(+r.value); r._drag = 0; }); };
// 进度、歌词只改 DOM
function tickP() {
  const t = top(), el = t?.el; if (!el?.classList.contains('musicapp')) return;
  const r = $('.mu-seek', el); if (r && !r._drag) { r.max = Math.max(1, st.d | 0); r.value = st.t | 0; r.style.setProperty('--p', st.d ? st.t / st.d : 0); $('.mu-ct', el).textContent = mt(st.t); $('.mu-dt', el).textContent = mt(st.d); }
  let i = -1; for (let k = 0; k < st.lrc.length; k++) { if (st.lrc[k].t <= st.t + .25) i = k; else break; }
  const box = $('.mu-lrc', el); if (box && box._i !== i) { box._i = i; $$('p.on', box).forEach(p => p.classList.remove('on')); const p = $(`p[data-i="${i}"]`, box); p && (p.classList.add('on'), !pick && box.scrollTo({ top: p.offsetTop - box.clientHeight / 2 + p.offsetHeight / 2, behavior: 'smooth' })); }
}
/* ---------- 歌单页 ---------- */
const listOf = id => { const m = M(); return id == 'liked' ? { n: '我喜欢的音乐', songs: m.liked } : id == 'hist' ? { n: '最近播放', songs: m.hist } : id.startsWith('pl:') ? m.lists.find(l => l.id == id.slice(3)) : null; };
function openList(id) {
  const tp = id.startsWith('top:') ? TOPS.find(t => t[0] == id.slice(4)) : null;
  const data = tp ? { n: tp[1], songs: [], tint: tp[2], loading: true } : listOf(id); if (!data) return;
  if (tp) playlist(tp[0]).then(l => { data.songs = l; data.loading = false; pg.reb(); }).catch(e => { data.loading = false; data.err = e.message || '加载失败'; pg.reb(); });
  const own = id.startsWith('pl:'), list = () => data.songs;
  const pg = page({ title: data.n, cls: 'musicapp mu-lpg', live: 1,
    right: () => own ? `<b data-a="mplm" data-x="${id.slice(3)}">${MI.more}</b>` : id == 'hist' ? `<b class="txt" data-a="mlclr" data-x="hist">清空</b>` : '',
    body: () => `<div class="mu-hero" style="${data.tint ? `--c:${data.tint}` : ''}">${data.cover ? `<img class="mu-big" src="${esc(data.cover)}" alt="">` : tp ? `<i class="mu-big mu-tint">${MI.note}</i>` : list()[0]?.pic ? `<img class="mu-big" src="${esc(list()[0].pic)}" referrerpolicy="no-referrer" alt="">` : `<i class="mu-big mu-ph">${MI.note}</i>`}<div><b>${esc(data.n)}</b><small>${data.loading ? '加载中…' : data.err ? esc(data.err) : list().length + ' 首'}</small></div></div>
      ${list().length ? `<div class="mu-all"><b data-a="mall" data-x="${id}">${MI.play2}播放全部 <small>(${list().length})</small></b><i data-a="mall" data-x="${id}" data-s="1">${MI.shuf}</i></div>` : ''}<div class="mu-sec">${data.loading ? '' : rows(reglist('L', list()), list(), !!tp)}</div>`,
    foot: () => mini(), acts: { ...A, mall: (x, t) => list().length && playList(list(), 0, !!t.dataset.s) }, onClose: () => setTimeout(rer) });
  pg._list = list; pg._lid = id;
}
/* ---------- 播放队列 ---------- */
function openQueue() {
  const s = sheet({ title: () => `当前播放 <small>(${M().q.length})</small>`, noBack: 1, cls: 'mu-qs', right: () => M().q.length ? `<b class="txt" data-a="mqclr">清空</b>` : '',
    body: () => M().q.map((x, i) => `<div class="mu-r ${i == M().qi ? 'now' : ''}" data-a="mqat" data-x="${i}"><div class="mu-t"><b>${esc(x.name)}<span> - ${esc(x.artist)}</span></b></div><i class="mu-mo" data-a="mqrm" data-x="${i}">${MI.x}</i></div>`).join('') || '<p class="mu-none">播放列表是空的</p>',
    acts: { mqat: i => playAt(+i), mqrm: i => removeQ(+i), mqclr: async () => { if (await ok('清空播放列表？')) { clearQ(); s.close(); } } } });
}
/* ---------- 歌曲菜单 / 歌单菜单 / 设置菜单 ---------- */
const songAt = x => { const [c, i] = String(x).split(':'); return c == 'now' ? cur() : c == 'L' ? top()?._list?.()[+i] : CTX[c]?.[+i]; };
async function songMenu(x) {
  const s = songAt(x); if (!s) return; const lid = String(x).startsWith('L:') ? top()?._lid : '';
  const k = await menu([['n', '下一首播放'], ['q', '加入播放列表'], ['l', liked(s) ? '取消喜欢' : '喜欢'], ['a', '收藏到歌单'], ...(lid && lid != 'liked' && !lid.startsWith('top:') ? [['r', '从这个列表移除', 'danger']] : [])], `${esc(s.name)} · ${esc(s.artist)}`);
  if (k == 'n') addNext(s); else if (k == 'q') { addQ(s); toast('已加入播放列表'); } else if (k == 'l') toast(toggleLike(s) ? '已喜欢' : '已取消喜欢');
  else if (k == 'a') { const m = M(), c = await menu([...m.lists.map(l => [l.id, esc(l.n)]), ['+', '＋ 新建歌单']], '收藏到歌单'); if (!c) return; const l = c == '+' ? await newList() : m.lists.find(x => x.id == c); l && addTo(l, s); }
  else if (k == 'r') { const l = listOf(lid); if (!l) return; l.songs.splice(l.songs.findIndex(y => same(y, s)), 1); save(); top()?.reb(); }
}
async function newList() { const r = await form('新建歌单', [['n', '歌单名']]); if (!r?.n?.trim()) return null; const l = { id: uid(), n: r.n.trim(), songs: [] }; M().lists.unshift(l); save(); rer(); return l; }
async function importList() {
  const r = await form('导入网易云歌单', [['u', '歌单链接或 ID']]); if (!r) return; const id = listId(r.u || ''); if (!id) return toast('没认出歌单 ID');
  toast('导入中…'); try { const songs = await playlist(id); if (!songs.length) return toast('这个歌单是空的，或者没导进来'); M().lists.unshift({ id: uid(), n: `导入歌单 ${id.slice(-4)}`, songs, from: id }); save(); rer(); toast(`导入了 ${songs.length} 首`); } catch (e) { toast('导入失败：' + (e.message || e)); }
}
async function listMenu(id) {
  const l = M().lists.find(x => x.id == id); if (!l) return;
  const k = await menu([['p', '播放全部'], ['r', '重命名'], ['c', '换封面'], ['d', '删除歌单', 'danger']], esc(l.n));
  if (k == 'p') l.songs.length && playList(l.songs);
  if (k == 'r') { const r = await form('重命名', [['n', '歌单名']], { n: l.n }); r?.n?.trim() && (l.n = r.n.trim(), save()); }
  if (k == 'c') { const r = await form('歌单封面', [['cover', '封面', 'img']], { cover: l.cover || '' }); r && (l.cover = r.cover, save()); }
  if (k == 'd' && await ok(`删除歌单「${l.n}」？`)) { M().lists = M().lists.filter(x => x != l); save(); top()?._lid == 'pl:' + l.id && back(); }
  top()?.reb?.(); rer();
}
async function mineMenu() {
  const m = M(), k = await menu([['ask', `${m.ask ? '✓ ' : ''}角色给你点歌`], ['auto', `${m.auto ? '✓ ' : ''}点的歌自动播放`], ['tell', `${m.tell !== false ? '✓ ' : ''}让角色知道你在听什么`], ['imp', '导入网易云歌单'], ['src', '音源地址']]);
  if (!k) return;
  if (k == 'ask' || k == 'auto') { m[k] = !m[k]; save(); syncInject(); toast(k == 'ask' ? (m.ask ? '角色会在剧情里给你点歌了' : '已关闭') : (m.auto ? '收到点歌会自动播放' : '已关闭')); }
  if (k == 'tell') { m.tell = m.tell === false; save(); syncInject(); }
  if (k == 'imp') importList();
  if (k == 'src') { const r = await form('音源地址', [['search', '搜索接口', 'text', SRC_DEF.search], ['meting', '播放 / 歌词接口', 'text', SRC_DEF.meting]], { search: m.src.search || '', meting: m.src.meting || '' }); r && (m.src = { search: r.search.trim(), meting: r.meting.trim() }, save(), toast('已保存')); }
}
// 按剧情推荐：调一次 API，让 AI 根据最近剧情挑几首真实存在的歌
const aiRec = () => task('按剧情挑歌', async sg => {
  const r = json(await llm(await sysCtx({ n: 8, rc: 3000, wi: 0, desc: 800 }), `根据最近的剧情和${meObj().real}此刻的心情，像音乐 App 的「今日为你推荐」那样推荐 6 首真实存在的歌（中文、日文、英文都可以，要真的有这首歌）。只输出 JSON：{"blurb":"一句话推荐语，30字以内，不要提到小手机","songs":[{"name":"歌名","artist":"歌手"}]}`, '按剧情推荐', sg, { aux: 1 }));
  const songs = (r?.songs || []).filter(x => x?.name).map(x => ({ id: '', name: String(x.name).replace(/^[《「“"']+|[》」”"']+$/g, ''), artist: String(x.artist || '未知歌手'), pic: '', dur: 0 })).slice(0, 8);
  if (!songs.length) throw Error('没推荐出来，再试一次');
  MD().ai = { blurb: String(r.blurb || '').slice(0, 60), songs, ts: now() }; saveD(); home = 'rec'; tab = 'home'; rer(); return `推荐了 ${songs.length} 首`;
});
/* ---------- 歌词摘录 ---------- */
async function pickDone() {
  const s = cur(); if (!s || !pick?.size) return;
  const lines = [...pick].sort((a, b) => a - b).map(i => st.lrc[i].x);
  const r = await form('摘录歌词', [['t', '想说的话', 'area']]); if (!r) return;
  notes().unshift({ id: uid(), song: { id: s.id, name: s.name, artist: s.artist, pic: s.pic }, lines, text: (r.t || '').trim(), ts: now() }); save();
  pick = null; toast('已收进笔记'); rer();
}
/* ---------- 动作 ---------- */
const A = {
  mtab: (x) => { tab = x; rer(); }, mhome: x => { home = x; lyrOn = false; pick = null; rer(); }, mgo: () => { tab = 'home'; home = 'heart'; rer(); },
  mplay: (x) => { const [c, i] = String(x).split(':'), list = c == 'L' ? top()?._list?.() : CTX[c]; const s = list?.[+i]; if (!s) return; if (same(s, cur())) { st.playing || toggle(); tab = 'home'; home = 'heart'; return rer(); } c == 's' || c == 'rec' || c == 'ai' ? playAt(addQ(s)) : playList(list, +i); },
  mmore: x => songMenu(x), mtog: () => toggle(), mnext: () => next(), mprev: () => prev(), mmode: () => cycleMode(), mq: () => openQueue(),
  mlike: () => { const s = cur(); s && toast(toggleLike(s) ? '已喜欢' : '已取消喜欢'); },
  mlyr: (x, t, e) => { if (e.target.closest('[data-a="mseekl"],[data-a="mpk"],.mu-pkbar')) return; lyrOn = !lyrOn; pick = null; rer(); },
  mseekl: (x, t) => { seek(+t.dataset.t); st.playing || toggle(); },
  mpkon: (x, t) => { pick = new Set([+t.dataset.i]); rer(); }, mpk: (x, t) => { const i = +t.dataset.i; pick.has(i) ? pick.delete(i) : pick.add(i); pick.size || (pick = null); rer(); }, mpkx: () => { pick = null; rer(); }, mpkok: pickDone,
  mheartgo: () => { const l = M().liked; if (!l.length) return toast('先去喜欢几首歌'); playList(l, 0, true); tab = 'home'; home = 'heart'; rer(); },
  mkw: w => doSearch(w), mclr: () => { sq = ''; sres = null; rer(); }, mmoreres: () => !sbusy && doSearch(sq, true), mshc: () => { M().sh = []; save(); rer(); },
  mopen: x => openList(x), mnew: async () => { const l = await newList(); l && openList('pl:' + l.id); }, mplm: x => listMenu(x), mmenu: mineMenu, mai: aiRec,
  mnotes: x => { const s = x == 'cur' ? cur() : null; if (x == 'cur' && !s) return; page({ title: s ? `《${esc(s.name)}》的笔记` : '歌词本', cls: 'musicapp mu-notes', live: 1, body: () => notesPage(s), foot: () => mini(), acts: A }); },
  mnplay: id => { const n = notes().find(x => x.id == id); n && (same(n.song, cur()) ? (st.playing || toggle()) : playAt(addQ(n.song))); },
  mndel: async id => { const n = notes().find(x => x.id == id); if (!n) return; const k = await menu([['p', '播放这首歌'], ['d', '删除这条笔记', 'danger']]); if (k == 'p') A.mnplay(id); if (k == 'd') { M().notes = notes().filter(x => x != n); save(); top()?.reb(); rer(); } },
  mnclr: async () => { if (await ok('清空所有笔记？')) { M().notes = []; save(); rer(); } },
  mlclr: async x => { if (!await ok(x == 'hist' ? '清空最近播放？' : '清空 TA 点的歌？')) return; x == 'hist' ? (M().hist = [], save()) : (recs().length = 0, saveD()); top()?.reb(); },
};
reg({ id: 'music', name: '音乐', icon: ICON, open: openApp });
Object.assign(G, { mfull: () => { tab = 'home'; home = 'heart'; top()?.el?.classList.contains('musicapp') ? rer() : openApp(); } });

/* ---------- 全局 ---------- */
on('music', () => {
  const t = top(); if (t?.el?.classList.contains('musicapp')) { if (t.el.classList.contains('mu-home-heart')) rer(); else { const f = $('.pg-f', t.el); f && (f.innerHTML = t.el.classList.contains('mu-lpg') || t.el.classList.contains('mu-notes') ? mini() : foot()); $$('.mu-r', t.el).forEach(r => r.dataset.x && r.classList.toggle('now', same(songAt(r.dataset.x), cur()))); } }
  $$('.sheet.mu-qs').forEach(x => x._pg?.reb?.());
  const isl = $('.isl', ui.root); if (isl) { const s = cur(), on_ = !!s && (st.playing || st.loading); isl.classList.toggle('mu', on_); isl.dataset.a = on_ ? 'mfull' : ''; isl.innerHTML = on_ ? `${s.pic ? `<img src="${esc(s.pic)}" alt="">` : ''}<i class="eq ${st.playing ? 'on' : ''}"><b></b><b></b><b></b></i>` : ''; }
});
on('music-t', () => { tickP(); const m = M(); if (st.playing) { m.sec = (m.sec || 0) + .25; (m.sec * 4 | 0) % 240 == 0 && save(); } });
on('music-rec', list => {
  const r = recs(), m = M(); let first = null;
  for (const x of list) { if (!x.name) continue; const s = { id: '', name: x.name, artist: x.artist || '未知歌手', pic: '', dur: 0, by: x.by || '' }; const at = r.findIndex(y => y.name == s.name && y.artist == s.artist); at >= 0 && r.splice(at, 1); r.unshift(s); first ||= s; }
  r.length > 50 && (r.length = 50); saveD(); if (!first) return;
  toast(`${first.by || 'TA'} 给你点了一首《${first.name}》`);
  m.auto && (st.playing ? addQ(first) : playAt(addQ(first)));
  emit('music');
});
