// 小手机 · 心屿：每个角色一座装在果冻球里的小岛，岛上的天气就是 TA 此刻的心情，风景随机变
// 晴天 = 开心，细雨 = 难过，风暴 = 生气，极光 = 想念 / 温柔，星夜 = 疲惫，雾 = 迷茫，烟花 = 兴奋，落日 = 平静
// 心情来源：① 点「看看 TA 现在」调一次 API 读最近剧情；② 开着手机同步时，AI 在 <手机> 块里顺带写「心情|谁|心情|一句话|风景词」（一直开着，没有开关）
// 风景每次随机拼（gen.js：气候 × 地形 × 地标 × 植物 × 动物 × 配色），打开心屿、切换角色、心情变化时换一座；
// AI 导演：「看看 TA 现在」和正文心情行里带几个风景词，本地翻成配方（不额外调 API）
// 球和手势在 jelly.js（three.js，按需加载），球里的世界在 build.js
// D().isle = { cur: 角色id, by: { id: { mood, scene, say, sea, ts, world: 配方, hist: [...] } } }；S.isle = { auto, q: 画质 }
import { S, D, $, esc, save, saveD, on, emit, page, back, menu, form, ok, toast, reg, top, llm, json, sysCtx, task, now, nm, rn, byId, avOf, syncInject, I } from '../../core.js';
import { makeRecipe, hintOf, recipeName, eraOf, seasonOf, SEASONS } from './gen.js';
import { jelly, warm } from './jelly.js';

export const SCENES = { sun: '晴', sunset: '落日', rain: '细雨', storm: '雷暴', snow: '飘雪', aurora: '极光', night: '星夜', fog: '薄雾', fireworks: '烟花' };
const MOOD2 = [[/开心|高兴|快乐|愉快|满足|轻松/, 'sun'], [/兴奋|激动|期待|雀跃|狂喜/, 'fireworks'], [/平静|安心|放松|惬意|温暖|幸福/, 'sunset'], [/孤独|寂寞|冷淡|冷漠|疏离|麻木|空虚|心寒/, 'snow'], [/难过|伤心|委屈|失落|低落|想哭/, 'rain'], [/生气|愤怒|烦躁|恼火|不爽|暴躁/, 'storm'], [/想念|思念|温柔|心动|眷恋|喜欢/, 'aurora'], [/累|疲惫|困|倦|无力/, 'night'], [/迷茫|焦虑|不安|纠结|犹豫|茫然/, 'fog']];
export const sceneOf = mood => MOOD2.find(([r]) => r.test(mood || ''))?.[1] || 'sunset';
const ISL = () => (D().isle ||= { by: {} });
const people = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0);
const curId = () => { const i = ISL(), ps = people(); return ps.some(c => c.id == i.cur) ? i.cur : ps[0]?.id || ''; };
const rec = id => { const r = (ISL().by[id] ||= { mood: '', scene: '', say: '', sea: .4, ts: 0, hist: [] }); r.world?.items || reroll(r, '', false); return r; };
/** 换一座岛：hint 是剧情里的风景词（可空），认得的词进配方，其余随机；气候尽量不和上次一样 */
/** 没有风景词时看角色卡是现代还是古风，随机也偏向那个时代（本地扫关键词，不花 API） */
const eraHint = () => { try { const c = SillyTavern.getContext(), ch = c.characters?.[c.characterId]; return eraOf([ch?.description, ch?.first_mes, ch?.scenario, c.chat?.slice(-3).map(m => m.mes).join(' ')].join(' ')); } catch { return ''; } };
const recent = []; // 最近抽到的风景名：随机时尽量不重样（剧情点名的除外）
/** 剧情现在是什么季节：看最近几条正文（本地认关键词，不花 API） */
const seasonHint = () => { try { const c = SillyTavern.getContext(); return seasonOf((c.chat || []).slice(-6).map(m => m.mes).join(' ')); } catch { return ''; } };
const reroll = (r, hint = '', persist = true) => { const want = hintOf(hint); if (!want.era && !want.mark) { const e = eraHint(); if (e) want.era = e; } if (!want.season) { const s = seasonHint(); if (s) { want.season = s; if (s === 'winter' && !want.climate && !want.mark && Math.random() < .6) want.climate = 'snow'; } } let rc; for (let i = 0; i < 12; i++) { rc = makeRecipe(Math.random() * 1e9 | 0, want); if (want.climate && want.mark) break; const nm = recipeName(rc); if ((want.climate || rc.climate !== r.world?.climate) && !recent.includes(nm)) break; } recent.unshift(recipeName(rc)); recent.length > 8 && (recent.length = 8); if (!r.mood) r.wx = ['sun', 'sunset', 'rain', 'storm', 'snow', 'aurora', 'night', 'fog', 'fireworks'][Math.random() * 9 | 0]; /* 还没读过心情：天气也随机，不总是落日 */ delete r.biome; delete r.seed; r.world = rc; persist && saveD(); };
const setMood = (id, m) => { const r = rec(id); if (!m.mood) return; Object.assign(r, { mood: m.mood, scene: SCENES[m.scene] ? m.scene : sceneOf(m.mood), say: m.say || '', voices: (Array.isArray(m.voices) ? m.voices : []).map(v => String(v).trim().slice(0, 40)).filter(Boolean).slice(0, 8), vi: 0, sea: Math.max(0, Math.min(1, +m.sea || .4)), ts: now() }); reroll(r, m.world || '', false); r.hist.unshift({ mood: r.mood, scene: r.scene, say: r.say, voices: r.voices, sea: r.sea, ts: r.ts, world: recipeName(r.world), rc: r.world }); r.hist.length > 60 && (r.hist.length = 60); saveD(); emit('isle'); };

/* ---------- 回看：潮汐记录里点「看看那时的岛」，球里换成那时的岛、天气、心情；「回到现在」切回来 ---------- */
let peek = null; // { id, h }
const VI = {}; // 心声轮到第几句（按角色 / 回看的那一条分开记）
const viewOf = id => { const r = rec(id); if (peek?.id !== id || !peek.h.rc) return r; const h = peek.h; return { ...r, mood: h.mood, scene: h.scene, say: h.say, voices: h.voices || [], sea: h.sea ?? r.sea, ts: h.ts, world: h.rc, peek: true }; };

/* ---------- 页面 ---------- */
let pt;
export const _globe = () => pt; // 测试用
const ago = ts => { if (!ts) return ''; const m = (now() - ts) / 6e4; return m < 1 ? '刚刚' : m < 60 ? `${m | 0} 分钟前` : m < 1440 ? `${m / 60 | 0} 小时前` : new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); };
const body = () => { const id = curId(), c = byId(id), r = id ? viewOf(id) : null, ps = people(), pk = r?.peek;
  if (!ps.length) return `<div class="is-empty"><p>还没有联系人</p></div>`;
  const scene = r?.scene || 'sunset';
  const wave = `<svg viewBox="0 0 160 26" fill="none" aria-hidden="true"><path d="M0 13 Q10 2 20 13 T40 13 T60 13 T80 13 T100 13 T120 13 T140 13 T160 13" stroke="currentColor" stroke-width="1"/><path d="M0 20 Q10 9 20 20 T40 20 T60 20 T80 20 T100 20 T120 20 T140 20 T160 20" stroke="currentColor" stroke-width=".6" opacity=".4"/></svg>`;
  return `<div class="is-who" aria-label="选择角色">${ps.map(p => `<b class="${p.id == id ? 'on' : ''}" data-a="iswho" data-x="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(nm(p))}" aria-pressed="${p.id == id}"><img src="${esc(avOf(p))}" alt=""><span>${esc(nm(p))}</span></b>`).join('')}</div>
  <div class="is-stage" data-scene="${scene}" data-world="${esc(r?.world?.climate || '')}">${pk ? `<div class="is-peek"><span>正在看 ${when(r.ts)} 的岛</span><button type="button" data-a="isnow">回到现在</button></div>` : ''}<div class="is-caption"><span>${esc(nm(c))}的岛</span><span>${r?.world?.season ? SEASONS[r.world.season] + ' · ' : ''}${esc(recipeName(r?.world))}${r?.scene ? ' · ' + SCENES[scene] : ''}</span></div><canvas class="is-cv phone-gesture-control" aria-label="${esc(nm(c))}的心情小岛"></canvas><div class="is-btns"><button class="btn pri" data-a="islook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 3v5m0 8v5M3 12h5m8 0h5M6 6l3 3m6 6 3 3M6 18l3-3m6-6 3-3"/><circle cx="12" cy="12" r="3"/></svg>看看 TA 现在</button><button class="btn" data-a="isshake"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="10" r="6"/><path d="M5 20c2-1.2 4.4-1.8 7-1.8s5 .6 7 1.8M3 8c-.6 1.2-.6 2.8 0 4M21 8c.6 1.2.6 2.8 0 4"/></svg>摇一摇</button><button class="btn" data-a="ishist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 9c2 0 2-2 4.5-2S10 9 12 9s2-2 4.5-2S19 9 21 9M3 15c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2"/></svg>潮汐记录</button></div><div class="is-sealine">${wave}<span>一 岛 一 心 事</span>${wave}</div></div>
  <div class="is-card"><div class="is-mood"><div><b>${esc(r?.mood || '还不知道')}</b><small>${r?.scene ? SCENES[scene] + ' · ' : ''}${esc(nm(c))}的岛${r?.ts ? ' · ' + ago(r.ts) : ''}</small></div><i class="is-weather sc-${scene}" aria-hidden="true"></i></div>
  ${r?.say ? `<p class="is-say">${esc(r.say)}</p>` : ''}
  ${r?.ts ? `<div class="is-tide"><span>情绪潮位</span><div class="is-tide-track" role="meter" aria-label="情绪潮位" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.sea * 100)}"><i style="width:${Math.round(r.sea * 100)}%"></i></div><span>${r.sea < .35 ? '微澜' : r.sea < .7 ? '起伏' : '汹涌'}</span></div>` : ''}
  </div>`; };

/* ---------- 潮汐记录：点一条 → 编辑 / 之前的版本 / 删除；长按进多选，批量删除 ---------- */
// 每次编辑或恢复前，把原来的样子存进这条的 vers（最近 10 个）；改的是「现在这条」时，岛上的心情也跟着改
let hsel = null;
const when = ts => new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const snap = h => ({ mood: h.mood, scene: h.scene, say: h.say, voices: h.voices || [], at: Date.now() });
const syncCur = (r, h) => { if (h.ts === r.ts) { Object.assign(r, { mood: h.mood, scene: h.scene, say: h.say, voices: h.voices || [] }); } };
function openHist() {
  const id = curId(), c = byId(id), r = rec(id); hsel = null;
  const row = (h, i) => `<div class="is-h ${hsel ? 'msel' : ''} ${hsel?.has(i) ? 'on' : ''}" data-a="${hsel ? 'hsel' : 'hact'}" data-x="${i}" data-lp="hlp" role="button" tabindex="0">${hsel ? '<i class="ck" aria-hidden="true"></i>' : ''}<i class="sc-${h.scene}"></i><div><b>${esc(h.mood)}</b><small>${SCENES[h.scene] || ''}${h.world ? ' · ' + esc(h.world) : ''} · ${when(h.ts)}${h.vers?.length ? ` · 改过 ${h.vers.length} 次` : ''}</small>${h.say ? `<p>「${esc(h.say)}」</p>` : ''}</div></div>`;
  const pg = page({ title: `${nm(c)}的潮汐记录`, cls: 'isle isle-history', live: 1,
    right: () => hsel ? `<b data-a="hcancel">取消</b><b data-a="hall">${hsel.size >= r.hist.length ? '全不选' : '全选'}</b>` : '',
    body: () => r.hist.length ? `<div class="is-hist">${r.hist.map(row).join('')}</div>` : '<div class="is-empty"><p>还没有记录</p></div>',
    foot: () => hsel ? `<nav class="mbar"><button data-a="hdel" class="danger ${hsel.size ? '' : 'off'}">删除${hsel.size ? `(${hsel.size})` : ''}</button></nav>` : '',
    onBack: () => { if (!hsel) return false; hsel = null; pg.re(); return true; },
    acts: {
      hlp: x => { if (hsel) { hsel.has(+x) ? hsel.delete(+x) : hsel.add(+x); return pg.re(); } navigator.vibrate?.(12); hsel = new Set([+x]); pg.re(); },
      hsel: x => { hsel.has(+x) ? hsel.delete(+x) : hsel.add(+x); pg.re(); },
      hcancel: () => { hsel = null; pg.re(); },
      hall: () => { hsel = hsel.size >= r.hist.length ? new Set() : new Set(r.hist.map((_, i) => i)); pg.re(); },
      hdel: async () => { if (!hsel?.size || !await ok(`删除 ${hsel.size} 条记录`)) return; r.hist = r.hist.filter((_, i) => !hsel.has(i)); hsel = null; saveD(); emit('isle'); pg.re(); },
      hact: async x => { const h = r.hist[+x]; if (!h) return;
        const k = await menu([...(h.rc ? [['peek', '看看那时的岛']] : []), ['edit', '编辑'], ...(h.vers?.length ? [['vers', `之前的版本（${h.vers.length}）`]] : []), ['del', '删除', 'danger']], `${h.mood} · ${when(h.ts)}`); if (!k) return;
        if (k == 'peek') { peek = { id, h }; back(); return setTimeout(() => emit('isle'), 0); }
        if (k == 'del') { if (!await ok('删除这条记录')) return; r.hist.splice(+x, 1); saveD(); emit('isle'); return pg.re(); }
        if (k == 'edit') { const v = await form('编辑这条记录', [['mood', '心情'], ['scene', '天气', 'sel', Object.entries(SCENES)], ['say', '没说出口的话', 'area'], ['vs', '心声（一行一句）', 'area']], { mood: h.mood, scene: h.scene, say: h.say || '', vs: (h.voices || []).join('\n') }); if (!v || !v.mood?.trim()) return;
          (h.vers ||= []).unshift(snap(h)); h.vers.length > 10 && (h.vers.length = 10); Object.assign(h, { mood: v.mood.trim(), scene: SCENES[v.scene] ? v.scene : h.scene, say: v.say.trim(), voices: v.vs.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8) }); syncCur(r, h); saveD(); emit('isle'); return pg.re(); }
        if (k == 'vers') { const j = await menu(h.vers.map((o, i) => [String(i), `${o.mood} · ${SCENES[o.scene] || ''}${o.say ? ' ·「' + o.say.slice(0, 14) + (o.say.length > 14 ? '…' : '') + '」' : ''} · 改于 ${when(o.at)}`]), '点一个版本恢复'); if (j == null) return;
          const o = h.vers[+j]; if (!o || !await ok(`恢复成「${o.mood}」这个版本`)) return; const cur = snap(h); h.vers.splice(+j, 1); h.vers.unshift(cur); Object.assign(h, { mood: o.mood, scene: o.scene, say: o.say, voices: o.voices || [] }); syncCur(r, h); saveD(); emit('isle'); pg.re(); }
      } } });
}

let mountN = 0;
const mount = el => { pt?.stop(); pt = null; el.querySelectorAll('.is-who [role=button]').forEach(b => b.addEventListener('keydown', e => { if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); b.click(); } })); const cv = $('.is-cv', el); if (!cv) return; const id = curId(), n = ++mountN;
  /** 点一下球：从点的位置冒出一句心声——像肥皂泡一样轻轻飘起来，停一会儿「砰」地破掉，溅出几颗水珠。按顺序轮着说，不调模型
   *  看得清：泡泡中间是一块磨砂玻璃（背后糊成一片），白天奶白配深字、夜里 / 雷暴烟灰配浅字；边缘透明带彩虹薄膜 */
  const voice = (x, y) => { const r = id ? viewOf(id) : null, vs = r?.voices?.length ? r.voices : r?.say ? [r.say] : []; if (!vs.length) return; const st = $('.is-stage', el); if (!st) return;
    const vk = id + (r.peek ? ':' + r.ts : ''), t = vs[(VI[vk] = ((VI[vk] ?? -1) + 1) % vs.length)], dark = /night|storm|aurora|fireworks/.test(r.scene || r.wx || ''), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    st.querySelectorAll('.is-voice').forEach(o => o.remove());
    const w = document.createElement('div'); w.className = 'is-voice' + (dark ? ' dk' : ''); w.setAttribute('role', 'status'); const b = document.createElement('div'); b.className = 'is-vb'; b.textContent = t; w.append(b); st.append(w);
    const sr = st.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight, px = Math.max(bw / 2 + 10, Math.min(sr.width - bw / 2 - 10, x - sr.left)), py = Math.max(bh + 16, y - sr.top - 18);
    w.style.left = px + 'px'; w.style.top = py + 'px'; // 先量好泡泡多大，再夹在舞台里：贴边点也不会被挤成窄条
    const ox = x - sr.left - px, sway = (Math.random() < .5 ? -1 : 1) * (5 + Math.random() * 5), life = 1700 + t.length * 70;
    if (calm) { b.animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: life + 600, easing: 'linear' }).onfinish = () => w.remove(); return; }
    // 冒出来：从点的位置小小地鼓出来，往上飘、轻轻左右晃、像在呼吸
    const rise = b.animate([
      { transform: `translate(${ox}px,22px) scale(.25)`, opacity: 0 },
      { transform: `translate(${ox * .3}px,0) scale(1.04)`, opacity: 1, offset: .14 },
      { transform: `translate(${sway * .6}px,-14px) scale(.99)`, opacity: 1, offset: .45 },
      { transform: `translate(${-sway * .4}px,-28px) scale(1.02)`, opacity: 1, offset: .75 },
      { transform: `translate(${sway * .3}px,-40px) scale(1)`, opacity: 1 }], { duration: life, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
    // 破掉：一下子胀开变透明，同时溅出水珠
    rise.onfinish = () => {
      const end = `translate(${sway * .3}px,-40px)`; b.animate([{ transform: end + ' scale(1)', opacity: 1 }, { transform: end + ' scale(1.16)', opacity: 0 }], { duration: 140, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
      const cx = sway * .3, cy = -40 - bh / 2, n = 10;
      for (let i = 0; i < n; i++) { const d = document.createElement('i'); d.className = 'is-drop'; w.append(d); const a = i / n * Math.PI * 2 + Math.random() * .4, rx = bw / 2 + 4, ry = bh / 2 + 4, sx = cx + Math.cos(a) * rx * .9, sy = cy + Math.sin(a) * ry * .9, dist = 14 + Math.random() * 16, sz = .6 + Math.random() * .8;
        d.animate([{ transform: `translate(${sx}px,${sy}px) scale(${sz})`, opacity: 1 }, { transform: `translate(${sx + Math.cos(a) * dist}px,${sy + Math.sin(a) * dist + 6}px) scale(${sz * .3})`, opacity: 0 }], { duration: 360 + Math.random() * 160, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' }); }
      const ring = document.createElement('i'); ring.className = 'is-pop'; ring.style.width = bw + 'px'; ring.style.height = bh + 'px'; w.append(ring);
      ring.animate([{ transform: `translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) scale(1)`, opacity: .7 }, { transform: `translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) scale(1.35)`, opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
      setTimeout(() => w.remove(), 600);
    }; };
  jelly(cv, () => { const r = id ? viewOf(id) : null; return { scene: r?.scene || r?.wx || 'sunset', recipe: r?.world || makeRecipe(1) }; }, { quality: S.isle?.q, onTap: voice, onQuality: qv => { S.isle ||= {}; S.isle.q = qv; save(); } })
    .then(j => { if (n !== mountN) return j.stop(); pt = j; }) /* 占位画布已被换成常驻画布，所以只看是不是最新一次挂载 */.catch(e => { console.error('[心屿]', e); toast('这台设备画不出 3D 的岛：' + (e.message || e)); }); };
const look = () => { const id = curId(), c = byId(id); if (!c) return; return task(`读 ${nm(c)} 的心情`, async sg => {
  const r = json(await llm(await sysCtx({ n: 10, rc: 3500, wi: 0, desc: 1000 }), `根据最近的剧情，判断${rn(c)}此刻的心情。只输出 JSON：{"mood":"两到四个字的心情词","scene":"sun|sunset|rain|storm|snow|aurora|night|fog|fireworks 里选一个最贴切的（storm 雷暴，snow 飘雪）","say":"${rn(c)}此刻没说出口的一句话，30字以内，第一人称","sea":0到1的数字表示情绪起伏大小,"voices":["${rn(c)}此刻脑子里一闪而过的念头，三到六句，每句 15 字以内，口吻贴人设，彼此不重复"],"world":"此刻该出现在${rn(c)}心里那座岛上的风景，四到八个词：先写时代（现代 / 古风）和季节（春 / 夏 / 秋 / 冬），再写剧情此刻所在的地方（如 古寺求签、深夜便利店、医院走廊、海边灯塔、学校操场、小酒馆），再加天气时间和两三样具体物件，要和故事的世界观一致，例：古风 秋 古寺 求签 枫叶 香炉 / 现代 冬 深夜便利店 路灯 雪 自动贩卖机"}`, '读心情', sg, { aux: 1 }));
  if (!r?.mood) throw Error('没读出来，再试一次'); setMood(id, r); pt?.hop(); return `${nm(c)}：${r.mood}`; }); };
reg({
  id: 'isle', name: '心屿', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#fff" opacity=".35"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.4"/><ellipse cx="12" cy="14.2" rx="4.6" ry="1.7" fill="#fff"/><path d="M12 7.5v6.3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M12 8.3c1.2 0 2.2-.8 2.6-1.3M12 8.3c-1.2 0-2.2-.8-2.6-1.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="8.3" cy="9.3" r=".9" fill="#fff"/></svg>',
  open: () => { peek = null; return page({ // 不再每次打开都换岛：岛只在心情更新时换（花了 API 生成的地点不会被随机掉）
    title: '心屿', cls: 'isle', live: 1, body, after: mount, onClose: () => { pt?.stop(); pt = null; },
    acts: {
      iswho: (x, t, e, pg) => { if (ISL().cur == x && curId() == x) return; ISL().cur = x; peek = null; pg.re(); },
      isnow: (x, t, e, pg) => { peek = null; pg.re(); },
      isshake: () => pt?.bounce(),
      islook: look,
      ishist: () => openHist(),
    } }); },
});
on('isle', () => { const t = top(); t?.el?.classList.contains('isle') && t.re(); });
// 打开手机后趁空闲预热 3D（加载 three.js、编译着色器），点进心屿时不用等；只做一次
let warmed = false;
on('phone-open', () => { if (warmed || !people().length) return; warmed = true; const go = () => warm(makeRecipe(Math.random() * 1e9 | 0, { era: eraHint() || undefined }), S.isle?.q).catch(e => { warmed = false; console.warn('[心屿] 预热失败', e); }); (window.requestIdleCallback || (f => setTimeout(f, 600)))(go, { timeout: 2500 }); });
// 正文里带的心情：心情|谁|心情词|一句话
on('isle-mood', list => { for (const m of list) { const c = people().find(p => rn(p) == m.who || nm(p) == m.who || p.nick == m.who); if (!c) continue; setMood(c.id, { mood: m.mood, say: m.say, world: m.world, voices: m.voices }); toast(`${nm(c)}的岛：${m.mood}`); } });

