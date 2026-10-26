// 小手机 · 音乐：音源
// 搜索走 vkeys，播放链接 / 歌词 / 歌单走 Meting，最后再试网易云外链。几个地址都能在音乐 → 设置里改（接口挂了换一个就行）
import { S, getJ, getT } from '../../core.js';

export const SRC_DEF = { search: 'https://api.vkeys.cn/v2/music/netease', meting: 'https://api.qijieya.cn/meting/' };
export const TOPS = [['19723756', '飙升榜', '#4fb3a9'], ['3779629', '新歌榜', '#6c8fd8'], ['3778678', '热歌榜', '#e0605e'], ['2884035', '原创榜', '#c07ad6']];
export const HOT = ['周杰伦', '陈奕迅', '治愈', '伤感', '古风', '日语', '粤语', '说唱', '小甜歌', '钢琴', '夏日', '晚安'];

const base = k => String(S.music?.src?.[k] || SRC_DEF[k]).trim();
const q = (u, p) => u + (u.includes('?') ? '&' : '?') + new URLSearchParams(p);
const clean = s => String(s ?? '').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const https = u => String(u || '').replace(/^http:\/\//i, 'https://');
// 时长：可能是毫秒、秒、「3:45」或「3分45秒」
const secs = v => { if (!v) return 0; if (typeof v == 'number') return Math.round(v > 1e4 ? v / 1e3 : v);
  const t = String(v), a = t.match(/(\d+):(\d{1,2})/), b = t.match(/(\d+)\s*分\s*(\d+)?/); return a ? +a[1] * 60 + +a[2] : b ? +b[1] * 60 + +(b[2] || 0) : Math.round(+t > 1e4 ? +t / 1e3 : +t) || 0; };
// 统一成一种歌曲格式：{ id, name, artist, pic, dur }
export const song = (r = {}) => ({ id: r.id ? String(r.id) : '', name: clean(r.name || r.song || r.title), artist: clean(r.artist || r.singer || r.author) || '未知歌手', pic: https(r.pic || r.cover || r.picUrl), dur: secs(r.dur || r.interval || r.duration || r.time) });
const idIn = u => String(u || '').match(/[?&]id=(\d+)/)?.[1] || '';

export async function search(word, page = 1, signal) {
  const j = await getJ(q(base('search'), { word, page, num: 20 }), signal);
  const list = (Array.isArray(j?.data) ? j.data : []).map(song).filter(s => s.name);
  return { list, more: list.length >= 20 };
}
// 网易云歌单（榜单也是歌单）
export async function playlist(id, signal) {
  const j = await getJ(q(base('meting'), { server: 'netease', type: 'playlist', id }), signal);
  return (Array.isArray(j) ? j : []).map(r => song({ ...r, id: r.id || idIn(r.url || r.lrc || r.pic) })).filter(s => s.name);
}
// 分享链接 / 文字里的歌单 ID
export const listId = t => (String(t).match(/playlist[^0-9]*?(?:id=)?(\d{5,})/i) || String(t).match(/[?&]id=(\d{5,})/) || String(t).trim().match(/^(\d{5,})$/))?.[1] || '';

// 只有歌名歌手（AI 推荐的歌）：先搜一下补上 ID 和封面
export async function resolve(s) {
  if (s.id) return s;
  const { list } = await search(`${s.name} ${s.artist === '未知歌手' ? '' : s.artist}`.trim()).catch(() => ({ list: [] }));
  const hit = list.find(x => x.name.toLowerCase() == s.name.toLowerCase()) || list[0];
  if (hit) Object.assign(s, { id: hit.id, pic: s.pic || hit.pic, dur: s.dur || hit.dur, artist: s.artist === '未知歌手' ? hit.artist : s.artist });
  return s;
}
// 依次给出能试的播放地址
export async function* urls(s) {
  await resolve(s); if (!s.id) return;
  try { const j = await getJ(q(base('meting'), { server: 'netease', type: 'song', id: s.id })); const u = Array.isArray(j) ? j[0]?.url : ''; if (u && !/music\.163\.com\/404/.test(u)) { s.pic ||= https(j[0].pic); yield https(u); } } catch { }
  try { const j = await getJ(q(base('search'), { id: s.id })); j?.data?.url && (yield https(j.data.url)); } catch { }
  yield `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(s.id)}.mp3`;
}
// 歌词：[{ t: 秒, x: 原文, tr: 翻译 }]
export const lrc = text => String(text || '').split(/\r?\n/).flatMap(l => { const ts = [...l.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], x = l.replace(/\[[^\]]*\]/g, '').trim();
  return x ? ts.map(m => ({ t: +m[1] * 60 + +m[2], x })) : []; }).sort((a, b) => a.t - b.t);
const lcache = new Map();
export async function lyrics(s) {
  if (!s?.id) return []; if (lcache.has(s.id)) return lcache.get(s.id);
  let out = [];
  try {
    const main = lrc(await getT(q(base('meting'), { server: 'netease', type: 'lrc', id: s.id })));
    const tr = lrc(await getT(q(base('meting'), { server: 'netease', type: 'tlrc', id: s.id })).catch(() => ''));
    out = main.map(l => ({ ...l, tr: tr.find(t => Math.abs(t.t - l.t) < .6 && t.x != l.x)?.x || '' }));
  } catch { }
  lcache.set(s.id, out); return out;
}
