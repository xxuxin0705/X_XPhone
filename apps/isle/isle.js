// 小手机 · 心屿：每个角色一座装在果冻球里的小岛，岛上的天气就是 TA 此刻的心情，风景随机变
// 晴天 = 开心，细雨 = 难过，风暴 = 生气，极光 = 想念 / 温柔，星夜 = 疲惫，雾 = 迷茫，烟花 = 兴奋，落日 = 平静
// 心情来源：① 点「看看 TA 现在」调一次 API 读最近剧情；② 开着手机同步时，AI 在 <手机> 块里顺带写「心情|谁|心情|一句话|风景词」（一直开着，没有开关）
// 风景每次随机拼（gen.js：气候 × 地形 × 地标 × 植物 × 动物 × 配色），打开心屿、切换角色、心情变化时换一座；
// AI 导演：「看看 TA 现在」和正文心情行里带几个风景词，本地翻成配方（不额外调 API）
// 球和手势在 jelly.js（three.js，按需加载），球里的世界在 build.js
// D().isle = { cur: 角色id, by: { id: { mood, scene, say, sea, ts, world: 配方, hist: [...] } } }；S.isle = { auto, q: 画质 }
import { S, D, $, esc, save, saveD, on, emit, page, menu, toast, reg, top, llm, json, sysCtx, task, now, nm, rn, byId, avOf, syncInject, I } from '../../core.js';
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
const setMood = (id, m) => { const r = rec(id); if (!m.mood) return; Object.assign(r, { mood: m.mood, scene: SCENES[m.scene] ? m.scene : sceneOf(m.mood), say: m.say || '', voices: (Array.isArray(m.voices) ? m.voices : []).map(v => String(v).trim().slice(0, 40)).filter(Boolean).slice(0, 8), vi: 0, sea: Math.max(0, Math.min(1, +m.sea || .4)), ts: now() }); reroll(r, m.world || '', false); r.hist.unshift({ mood: r.mood, scene: r.scene, say: r.say, ts: r.ts, world: recipeName(r.world) }); r.hist.length > 60 && (r.hist.length = 60); saveD(); emit('isle'); };

/* ---------- 页面 ---------- */
let pt;
export const _globe = () => pt; // 测试用
const ago = ts => { if (!ts) return ''; const m = (now() - ts) / 6e4; return m < 1 ? '刚刚' : m < 60 ? `${m | 0} 分钟前` : m < 1440 ? `${m / 60 | 0} 小时前` : new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }); };
const body = () => { const id = curId(), c = byId(id), r = id ? rec(id) : null, ps = people();
  if (!ps.length) return `<div class="is-empty"><p>还没有联系人</p></div>`;
  const scene = r?.scene || 'sunset';
  const wave = `<svg viewBox="0 0 160 26" fill="none" aria-hidden="true"><path d="M0 13 Q10 2 20 13 T40 13 T60 13 T80 13 T100 13 T120 13 T140 13 T160 13" stroke="currentColor" stroke-width="1"/><path d="M0 20 Q10 9 20 20 T40 20 T60 20 T80 20 T100 20 T120 20 T140 20 T160 20" stroke="currentColor" stroke-width=".6" opacity=".4"/></svg>`;
  return `<div class="is-who" aria-label="选择角色">${ps.map(p => `<b class="${p.id == id ? 'on' : ''}" data-a="iswho" data-x="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(nm(p))}" aria-pressed="${p.id == id}"><img src="${esc(avOf(p))}" alt=""><span>${esc(nm(p))}</span></b>`).join('')}</div>
  <div class="is-stage" data-scene="${scene}" data-world="${esc(r?.world?.climate || '')}"><div class="is-caption"><span>${esc(nm(c))}的岛</span><span>${r?.world?.season ? SEASONS[r.world.season] + ' · ' : ''}${esc(recipeName(r?.world))}${r?.scene ? ' · ' + SCENES[scene] : ''}</span></div><canvas class="is-cv phone-gesture-control" aria-label="${esc(nm(c))}的心情小岛"></canvas><div class="is-playbar"><button type="button" data-a="isshake">摇一摇</button></div><div class="is-sealine">${wave}<span>一 岛 一 心 事</span>${wave}</div></div>
  <div class="is-card"><div class="is-mood"><div><b>${esc(r?.mood || '还不知道')}</b><small>${r?.scene ? SCENES[scene] + ' · ' : ''}${esc(nm(c))}的岛${r?.ts ? ' · ' + ago(r.ts) : ''}</small></div><i class="is-weather sc-${scene}" aria-hidden="true"></i></div>
  ${r?.say ? `<p class="is-say">${esc(r.say)}</p>` : ''}
  ${r?.ts ? `<div class="is-tide"><span>情绪潮位</span><div class="is-tide-track" role="meter" aria-label="情绪潮位" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.sea * 100)}"><i style="width:${Math.round(r.sea * 100)}%"></i></div><span>${r.sea < .35 ? '微澜' : r.sea < .7 ? '起伏' : '汹涌'}</span></div>` : ''}
  <div class="is-btns"><button class="btn pri" data-a="islook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 3v5m0 8v5M3 12h5m8 0h5M6 6l3 3m6 6 3 3M6 18l3-3m6-6 3-3"/><circle cx="12" cy="12" r="3"/></svg>看看 TA 现在</button><button class="btn" data-a="ishist">潮汐记录<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button></div></div>`; };

let mountN = 0;
const mount = el => { pt?.stop(); pt = null; el.querySelectorAll('.is-who [role=button]').forEach(b => b.addEventListener('keydown', e => { if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); b.click(); } })); const cv = $('.is-cv', el); if (!cv) return; const id = curId(), n = ++mountN;
  /** 点一下球：从点的位置冒出一句心声（水玻璃气泡），慢慢淡掉；按顺序轮着说，不调模型 */
  const voice = (x, y) => { const r = id ? rec(id) : null, vs = r?.voices?.length ? r.voices : r?.say ? [r.say] : []; if (!vs.length) return; const st = $('.is-stage', el); if (!st) return;
    const t = vs[(r.vi = ((r.vi | 0) + 1) % vs.length)]; st.querySelector('.is-voice')?.remove(); const b = document.createElement('div'); b.className = 'is-voice'; b.setAttribute('role', 'status'); b.textContent = t;
    const sr = st.getBoundingClientRect(); b.style.left = Math.max(70, Math.min(sr.width - 70, x - sr.left)) + 'px'; b.style.top = Math.max(60, y - sr.top - 14) + 'px'; st.append(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on'))); setTimeout(() => { b.classList.replace('on', 'off'); setTimeout(() => b.remove(), 1000); }, 2200 + t.length * 60); };
  jelly(cv, () => { const r = id ? rec(id) : null; return { scene: r?.scene || r?.wx || 'sunset', recipe: r?.world || makeRecipe(1) }; }, { quality: S.isle?.q, onTap: voice, onQuality: qv => { S.isle ||= {}; S.isle.q = qv; save(); } })
    .then(j => { if (n !== mountN) return j.stop(); pt = j; }) /* 占位画布已被换成常驻画布，所以只看是不是最新一次挂载 */.catch(e => { console.error('[心屿]', e); toast('这台设备画不出 3D 的岛：' + (e.message || e)); }); };
const look = () => { const id = curId(), c = byId(id); if (!c) return; return task(`读 ${nm(c)} 的心情`, async sg => {
  const r = json(await llm(await sysCtx({ n: 10, rc: 3500, wi: 0, desc: 1000 }), `根据最近的剧情，判断${rn(c)}此刻的心情。只输出 JSON：{"mood":"两到四个字的心情词","scene":"sun|sunset|rain|storm|snow|aurora|night|fog|fireworks 里选一个最贴切的（storm 雷暴，snow 飘雪）","say":"${rn(c)}此刻没说出口的一句话，30字以内，第一人称","sea":0到1的数字表示情绪起伏大小,"voices":["${rn(c)}此刻脑子里一闪而过的念头，三到六句，每句 15 字以内，口吻贴人设，彼此不重复"],"world":"此刻该出现在${rn(c)}心里那座岛上的风景，四到八个词：先写时代（现代 / 古风）和季节（春 / 夏 / 秋 / 冬），再写剧情此刻所在的地方（如 古寺求签、深夜便利店、医院走廊、海边灯塔、学校操场、小酒馆），再加天气时间和两三样具体物件，要和故事的世界观一致，例：古风 秋 古寺 求签 枫叶 香炉 / 现代 冬 深夜便利店 路灯 雪 自动贩卖机"}`, '读心情', sg, { aux: 1 }));
  if (!r?.mood) throw Error('没读出来，再试一次'); setMood(id, r); pt?.hop(); return `${nm(c)}：${r.mood}`; }); };
reg({
  id: 'isle', name: '心屿', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#fff" opacity=".35"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.4"/><ellipse cx="12" cy="14.2" rx="4.6" ry="1.7" fill="#fff"/><path d="M12 7.5v6.3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M12 8.3c1.2 0 2.2-.8 2.6-1.3M12 8.3c-1.2 0-2.2-.8-2.6-1.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="8.3" cy="9.3" r=".9" fill="#fff"/></svg>',
  open: () => { const id = curId(); id && reroll(rec(id), ''); return page({ title: '心屿', cls: 'isle', live: 1, body, after: mount, onClose: () => { pt?.stop(); pt = null; },
    acts: {
      iswho: (x, t, e, pg) => { if (ISL().cur == x && curId() == x) return; ISL().cur = x; reroll(rec(x), ''); pg.re(); },
      isshake: () => pt?.bounce(),
      islook: look,
      ishist: () => { const id = curId(), c = byId(id), r = rec(id); page({ title: `${nm(c)}的潮汐记录`, cls: 'isle isle-history', body: () => r.hist.length ? `<div class="is-hist">${r.hist.map(h => `<div class="is-h"><i class="sc-${h.scene}"></i><div><b>${esc(h.mood)}</b><small>${SCENES[h.scene] || ''}${h.world ? ' · ' + esc(h.world) : ''} · ${new Date(h.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>${h.say ? `<p>「${esc(h.say)}」</p>` : ''}</div></div>`).join('')}</div>` : '<div class="is-empty"><p>还没有记录</p></div>' }); },
    } }); },
});
on('isle', () => { const t = top(); t?.el?.classList.contains('isle') && t.re(); });
// 打开手机后趁空闲预热 3D（加载 three.js、编译着色器），点进心屿时不用等；只做一次
let warmed = false;
on('phone-open', () => { if (warmed || !people().length) return; warmed = true; const go = () => warm(makeRecipe(Math.random() * 1e9 | 0, { era: eraHint() || undefined }), S.isle?.q).catch(e => { warmed = false; console.warn('[心屿] 预热失败', e); }); (window.requestIdleCallback || (f => setTimeout(f, 600)))(go, { timeout: 2500 }); });
// 正文里带的心情：心情|谁|心情词|一句话
on('isle-mood', list => { for (const m of list) { const c = people().find(p => rn(p) == m.who || nm(p) == m.who || p.nick == m.who); if (!c) continue; setMood(c.id, { mood: m.mood, say: m.say, world: m.world, voices: m.voices }); toast(`${nm(c)}的岛：${m.mood}`); } });

