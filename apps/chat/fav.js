// 小手机 · 微信「收藏」和「个人名片」（照录屏）
// 收藏：长按消息 → 收藏；「我 → 收藏」看全部；聊天「＋ → 收藏」= 发送收藏：搜索 + 图片与视频 / 语音 / 聊天记录 / 链接 分类，点一条发出去
// 个人名片：聊天「＋ → 个人名片」→ 选择联系人 → 「发送给」确认框（可以留言）→ 发出去一张名片，点开是 TA 的资料页
import { D, saveD, esc, uid, page, back, toast, avOf, nm, now, ui, menu } from '../../core.js';
import { get } from './data.js';

const favs = () => D().favs ||= [];
const URL_RE = /https?:\/\/\S+/;
const kindOf = f => f.t == 'img' || f.t == 'sticker' ? 'img' : f.t == 'voice' ? 'voice' : f.t == 'rec' ? 'rec' : f.t == 'card' ? 'card' : URL_RE.test(f.c || '') ? 'link' : 'text';
const day = ts => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const textOf = f => f.t == 'rec' ? f.c : f.t == 'card' ? `[个人名片] ${f.c}` : f.t == 'voice' ? `[语音] ${f.c}` : f.c || '';

// 长按消息 → 收藏（存一份副本：以后原消息删了也还在）
export function addFav(m, from) {
  const { f, t, c, url, img, alt, rec, au, du, cid, tr } = m;
  favs().unshift({ id: uid(), t, c: c || '', ...(url && { url }), ...(img && { img, alt }), ...(rec && { rec }), ...(au && { au, du }), ...(cid && { cid }), ...(tr && { tr }), src: f == 'me' ? '我' : nm(from), ts: +now() });
  saveD(); toast('已收藏');
}

// 收藏列表：send 有值 = 「发送收藏」（点一条就发给当前聊天）；没有 = 「我 → 收藏」（长按删除）
const TABS = [['img', '图片与视频'], ['voice', '语音'], ['rec', '聊天记录'], ['link', '链接'], ['text', '文字'], ['card', '名片']];
export function favPage(send) {
  let q = '', tab = '';
  const item = (f, i) => { const k = kindOf(f), a = `data-a="fvgo" data-x="${f.id}" data-lp="fvlp"`;
    if (k == 'img') return `<div class="fv-it" ${a}><img class="fv-im" src="${esc(f.url || f.img || '')}" alt=""><div class="fv-f"><span>${esc(f.src)}</span><span>${day(f.ts)}</span></div></div>`;
    if (k == 'rec') return `<div class="fv-it" ${a}><b>${esc(f.c)}</b><p class="fv-sm">${esc((f.rec || []).slice(0, 2).map(r => `${r.n}：${r.c}`).join(' '))}</p><div class="fv-f"><span>${esc(f.src)}</span><span>${day(f.ts)}</span></div></div>`;
    if (k == 'card') { const c = get(f.cid); return `<div class="fv-it" ${a}><div class="fv-cd"><img src="${esc(avOf(c || { nick: f.c }))}"><b>${esc(f.c)}</b></div><p class="fv-sm">个人名片</p><div class="fv-f"><span>${esc(f.src)}</span><span>${day(f.ts)}</span></div></div>`; }
    return `<div class="fv-it" ${a}><p class="fv-t">${esc(textOf(f))}</p><div class="fv-f"><span>${esc(f.src)}</span><span>${day(f.ts)}</span></div></div>`; };
  const grid = L => { const G = []; L.forEach(f => { const d = new Date(f.ts), k = `${d.getFullYear()}年${d.getMonth() + 1}月`, l = G.at(-1); l && l.k == k ? l.L.push(f) : G.push({ k, L: [f] }); });
    return G.map(g => `<h6 class="fv-mo">${g.k == `${now().getFullYear()}年${now().getMonth() + 1}月` ? '这个月' : g.k}</h6><div class="fv-g">${g.L.map(f => `<img src="${esc(f.url || f.img || '')}" data-a="fvgo" data-x="${f.id}" data-lp="fvlp">`).join('')}</div>`).join(''); };
  const list = () => { const L = favs().filter(f => (!tab || kindOf(f) == tab) && (!q || textOf(f).includes(q) || (f.src || '').includes(q)));
    return L.length ? tab == 'img' ? grid(L) : L.map(item).join('') : `<p class="fv-e">${q || tab ? '无筛选结果' : '还没有收藏，长按消息可以收藏'}</p>`; };
  const P = page({ title: send ? '发送收藏' : '收藏', cls: 'fvpg', live: 1,
    body: () => `<div class="fv-s">${tab ? `<span class="fv-tg" data-a="fvtab" data-x="">${esc(TABS.find(x => x[0] == tab)[1])} ×</span>` : ''}<input class="fv-q" placeholder="${tab ? '' : '搜索'}" value="${esc(q)}"></div>
<div class="fv-tabs">${TABS.slice(0, 4).map(([k, l]) => `<b data-a="fvtab" data-x="${k}" class="${tab == k ? 'on' : ''}">${l}</b>`).join('')}</div><div class="fv-l">${list()}</div>`,
    after: el => { const i = el.querySelector('.fv-q'); i.oninput = () => { q = i.value.trim(); el.querySelector('.fv-l').innerHTML = list(); }; },
    acts: {
      fvtab: k => { tab = tab == k ? '' : k; P.re(); },
      fvgo: async id => { const f = favs().find(x => x.id == id); if (!f) return; if (!send) return; // 「我 → 收藏」里点开先不做详情页
        if (!await sendTo(send.ch, favCard(f))) return; send.done({ t: f.t, c: f.c, ...(f.url && { url: f.url }), ...(f.img && { img: f.img, alt: f.alt }), ...(f.rec && { rec: f.rec }), ...(f.au && { au: f.au, du: f.du }), ...(f.cid && { cid: f.cid }) }); back(); },
      fvlp: async id => { if (await menu([['d', '删除', 'danger']]) != 'd') return; D().favs = favs().filter(x => x.id != id); saveD(); P.re(); },
    } });
}
const favCard = f => kindOf(f) == 'img' ? `<img class="sd-im" src="${esc(f.url || f.img || '')}">` : `<p class="sd-t">${esc(textOf(f)).slice(0, 80)}</p>`;

// 「发送给」确认框（照录屏）：发送给 + 对方头像名字、要发的东西、留言框、取消 / 发送；返回 false 或 { note }
export function sendTo(ch, preview) {
  return new Promise(done => {
    const w = Object.assign(document.createElement('div'), { className: 'sd' });
    w.innerHTML = `<div class="sd-b"><p class="sd-h">发送给：</p><div class="sd-to"><img src="${esc(avOf(ch))}"><b>${esc(nm(ch))}</b><i>›</i></div><div class="sd-pv">${preview}</div><input class="sd-in" placeholder="发消息"><div class="sd-bt"><b data-k="n">取消</b><b data-k="y" class="ok">发送</b></div></div>`;
    ui.scr.append(w); requestAnimationFrame(() => w.classList.add('in'));
    const end = v => { w.classList.remove('in'); setTimeout(() => w.remove(), 200); done(v); };
    w.onclick = e => { const k = e.target.dataset.k; if (e.target == w || k == 'n') return end(false); if (k == 'y') { end({ note: w.querySelector('.sd-in').value.trim() }); } };
  });
}
// 发完：底部一个黑色小条「✓ 已发送」
export const sentTip = () => { const t = Object.assign(document.createElement('div'), { className: 'sd-ok', innerHTML: '<i>✓</i>已发送' }); ui.scr.append(t); setTimeout(() => t.classList.add('out'), 1300); setTimeout(() => t.remove(), 1600); };

// 个人名片：选择联系人（搜索 + 按字母排）→ 发送给
const COL = new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const letter = s => { const c = String(s || '').trim()[0] || '#'; if (/[A-Za-z]/.test(c)) return c.toUpperCase(); const L = 'ABCDEFGHJKLMNOPQRSTWXYZ', B = '阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥撒他屲夕丫帀'; for (let i = B.length - 1; i >= 0; i--) if (COL.compare(c, B[i]) >= 0) return L[i]; return '#'; };
export function cardPick(ch, done) {
  let q = '';
  const ps = () => D().chats.filter(c => c.type == 'p' && c.fr !== 0 && c != ch && (!q || [nm(c), c.real, c.nick, c.remark].some(x => x && x.includes(q)))).sort((a, b) => COL.compare(nm(a), nm(b)));
  const list = () => { let l0 = ''; return ps().map(c => { const l = letter(nm(c)), h = l != l0 ? `<h6 class="cp-l">${l}</h6>` : ''; l0 = l; return h + `<div class="cp-r" data-a="cpgo" data-x="${c.id}"><img src="${esc(avOf(c))}"><b>${esc(nm(c))}</b></div>`; }).join('') || '<p class="fv-e">没有可以推荐的朋友</p>'; };
  page({ title: '选择联系人', cls: 'cppg', body: () => `<div class="fv-s"><input class="fv-q cp-q" placeholder="搜索"></div><div class="cp-list">${list()}</div>`,
    after: el => { const i = el.querySelector('.cp-q'); i.oninput = () => { q = i.value.trim(); el.querySelector('.cp-list').innerHTML = list(); }; },
    acts: { cpgo: async id => { const c = get(id); if (!c) return; const r = await sendTo(ch, cardH(c)); if (!r) return; back(); done(c, r.note); sentTip(); } } });
}
// 名片样子（聊天气泡里、确认框里都用）：头像 + 名字，下面一条线，「个人名片」
export const cardH = (c, i) => `<div class="cdb" ${i != null ? `data-a="cdopen" data-x="${i}"` : ''}><div class="cdb-t"><img src="${esc(avOf(c))}"><b>${esc(nm(c))}</b></div><small>个人名片</small></div>`;
