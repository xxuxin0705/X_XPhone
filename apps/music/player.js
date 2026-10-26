// 小手机 · 音乐：播放器（一个全局的 <audio>，关掉手机也会继续放）
// S.music = { q: 播放队列, qi: 正在放第几首, mode, liked: 我喜欢, lists: 自建歌单, hist: 最近播放, sh: 搜索历史, src: 音源地址, auto: TA 推荐自动播放, np: 正在听（给正文用） }
import { S, save, emit, toast, syncInject } from '../../core.js';
import { urls, lyrics } from './api.js';

export const MODES = [['loop', '列表循环'], ['one', '单曲循环'], ['shuf', '随机播放'], ['order', '顺序播放']];
export const M = () => { const m = S.music ||= {}; m.q ||= []; m.liked ||= []; m.lists ||= []; m.hist ||= []; m.sh ||= []; m.src ||= {}; m.mode ||= 'loop'; m.qi |= 0; return m; };
export const key = s => s?.id ? 'i' + s.id : `n${s?.name}|${s?.artist}`;
export const same = (a, b) => !!a && !!b && key(a) == key(b);
const lite = s => ({ id: s.id || '', name: s.name, artist: s.artist, pic: s.pic || '', dur: s.dur || 0 }); // 只存这几项

const au = typeof Audio == 'function' ? new Audio() : null;
au && (au.preload = 'auto');
export const st = { playing: false, loading: false, t: 0, d: 0, lrc: [], err: '' };
let gen = 0, fails = 0, npT;
export const cur = () => M().q[M().qi] || null;
const fire = () => emit('music');
// 正文联动：告诉角色你正在听什么（播放状态变了就更新一次）
const np = () => { clearTimeout(npT); npT = setTimeout(() => { const s = cur(), v = st.playing && s ? { name: s.name, artist: s.artist } : null; if (JSON.stringify(v) != JSON.stringify(M().np || null)) { M().np = v; save(); syncInject(); } }, 400); };
if (au) {
  au.addEventListener('timeupdate', () => { st.t = au.currentTime; st.d = au.duration || st.d; emit('music-t'); });
  au.addEventListener('play', () => { st.playing = true; fire(); np(); });
  au.addEventListener('pause', () => { st.playing = false; fire(); np(); });
  au.addEventListener('ended', () => next(true));
}
// 系统的媒体控制（通知栏、耳机按键）
const media = s => { const ms = navigator.mediaSession; if (!ms || !s) return; try {
  ms.metadata = new MediaMetadata({ title: s.name, artist: s.artist, artwork: s.pic ? [{ src: s.pic, sizes: '512x512' }] : [] });
  [['play', toggle], ['pause', toggle], ['previoustrack', prev], ['nexttrack', () => next()]].forEach(([a, f]) => ms.setActionHandler(a, f));
} catch { } };
// 换上地址，等它能播（或报错 / 超时）
const probe = (url, g) => new Promise(res => {
  let tm; const end = ok => { clearTimeout(tm); au.removeEventListener('canplay', y); au.removeEventListener('error', n); res(ok && g == gen); }, y = () => end(true), n = () => end(false);
  au.addEventListener('canplay', y); au.addEventListener('error', n); tm = setTimeout(n, 12e3); au.src = url; au.load();
});
export async function playAt(i, { auto = false } = {}) {
  const m = M(); if (!m.q.length || !au) return;
  m.qi = (i % m.q.length + m.q.length) % m.q.length; save();
  const s = cur(), g = ++gen; Object.assign(st, { loading: true, lrc: [], t: 0, d: s.dur || 0, err: '' }); au.pause(); fire(); media(s);
  m.hist = [lite(s), ...m.hist.filter(x => !same(x, s))].slice(0, 100);
  for await (const u of urls(s)) {
    if (g != gen) return;
    if (await probe(u, g)) {
      fails = 0; st.loading = false; save(); media(s); fire();
      au.play().catch(e => { if (g == gen && e?.name == 'NotAllowedError') toast('点一下播放键开始'); });
      lyrics(s).then(l => { if (g == gen) { st.lrc = l; fire(); } });
      return;
    }
  }
  if (g != gen) return;
  Object.assign(st, { loading: false, err: '这首暂时放不了' }); fire();
  if (++fails < Math.min(5, m.q.length)) { toast(`《${s.name}》放不了，换下一首`); setTimeout(() => g == gen && next(true), 700); }
  else { fails = 0; toast('连续几首都放不了，可能是音源挂了，去音乐 → 设置换一个地址'); }
}
export function next(auto = false) {
  const m = M(); if (!m.q.length) return;
  if (auto && m.mode == 'one') { au.currentTime = 0; au.play().catch(() => {}); return; }
  if (auto && m.mode == 'order' && m.qi >= m.q.length - 1) { st.playing = false; fire(); return; }
  playAt(m.mode == 'shuf' && m.q.length > 1 ? (m.qi + 1 + Math.floor(Math.random() * (m.q.length - 1))) % m.q.length : m.qi + 1, { auto });
}
export const prev = () => au && au.currentTime > 4 ? (au.currentTime = 0) : playAt(M().qi - 1);
export function toggle() {
  if (!au || !cur()) return;
  if (!au.src || st.err) return playAt(M().qi);
  au.paused ? au.play().catch(() => playAt(M().qi)) : au.pause();
}
export const seek = t => { if (au && isFinite(t)) au.currentTime = t; };
export const cycleMode = () => { const m = M(), i = MODES.findIndex(x => x[0] == m.mode); m.mode = MODES[(i + 1) % MODES.length][0]; save(); fire(); toast(MODES.find(x => x[0] == m.mode)[1]); };
// 整个列表从第 i 首开始放（换掉队列）
export function playList(list, i = 0, shuffle = false) {
  const m = M(); let q = list.map(lite);
  if (shuffle) { for (let k = q.length - 1; k > 0; k--) { const j = Math.random() * (k + 1) | 0; [q[k], q[j]] = [q[j], q[k]]; } i = 0; }
  m.q = q; playAt(i);
}
// 下一首播放：插到正在放的后面
export function addNext(s) {
  const m = M(), at = m.q.findIndex(x => same(x, s));
  if (at == m.qi && m.q.length) return toast('正在放这首');
  at >= 0 && (m.q.splice(at, 1), at < m.qi && m.qi--);
  m.q.splice(m.q.length ? m.qi + 1 : 0, 0, lite(s)); save(); fire(); toast('下一首播放');
}
// 加到队列末尾；队列空着或没在放、又要求自动播放时直接开始放
export function addQ(s, play = false) {
  const m = M(); let at = m.q.findIndex(x => same(x, s));
  if (at < 0) { m.q.push(lite(s)); at = m.q.length - 1; }
  save(); play && !st.playing ? playAt(at) : fire(); return at;
}
export function removeQ(i) {
  const m = M(); if (!m.q[i]) return; const was = i == m.qi;
  m.q.splice(i, 1); i < m.qi && m.qi--; m.qi = Math.min(m.qi, Math.max(0, m.q.length - 1)); save();
  if (was) { m.q.length && st.playing ? playAt(m.qi) : (au?.pause(), au?.removeAttribute('src'), fire()); } else fire();
}
export function clearQ() { const m = M(); gen++; m.q = []; m.qi = 0; au?.pause(); au?.removeAttribute('src'); Object.assign(st, { playing: false, loading: false, lrc: [], t: 0, d: 0, err: '' }); save(); fire(); np(); }
// 我喜欢
export const liked = s => M().liked.some(x => same(x, s));
export function toggleLike(s) { const m = M(); liked(s) ? m.liked = m.liked.filter(x => !same(x, s)) : m.liked.unshift(lite(s)); save(); fire(); return liked(s); }
export const addTo = (list, s) => { if (list.songs.some(x => same(x, s))) return toast('已经在歌单里了'); list.songs.unshift(lite(s)); save(); fire(); toast(`已加入「${list.n}」`); };
