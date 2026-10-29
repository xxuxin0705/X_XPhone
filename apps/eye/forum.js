// 窥探之眼 · 论坛：那个世界里的读者 / 观众 / 玩家在吵这段剧情。
// 一次生成一整帖（主楼 + 至少 50 楼 + 楼中楼），每次挑一个平台（豆瓣 / 贴吧 / NGA / 微博……），排版跟着平台换。
// 模型只写：一段 CSS（照着固定的 class 写）+ 可选的顶栏 HTML + 一份很省字的楼层文本；HTML 由这里拼，放进 sandbox iframe 里显示。
// 历史按聊天存在 D().eye.forum（存模型原文，看的时候再拼），最多 30 帖。
import { D, $, $$, page, back, toast, saveD, esc, uid, llm, sysCtx, task, meObj, avOf, ok } from '../../core.js';

const KEEP = 30;
const FS = () => (D().eye ||= { form: '', role: 'viewer', wall: false, src: 'orig' }).forum ||= [];

/* ---------- 解析模型输出 ---------- */
const field = (s, k) => (s.match(new RegExp(`【${k}】[ \\t]*(.*)`)) || [])[1]?.trim() || '';
export function parse(raw) {
  const s = String(raw || '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/```[a-z]*\n?/g, '');
  const css = (s.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || '';
  const top = (s.match(/<top>([\s\S]*?)<\/top>/i) || [])[1] || '';
  const [ou = '', otag = '', otime = ''] = field(s, '楼主').split('|').map(x => x.trim());
  const body = (s.match(/【正文】\s*([\s\S]*?)【楼层】/) || [])[1]?.trim() || '';
  const fl = [], tail = s.split('【楼层】')[1] || '';
  for (const ln of tail.split('\n')) {
    const l = ln.trim(); if (!l) continue;
    const h = l.match(/^#\s*(\d+)\s*(.*)$/);
    if (h) { const [u = '', tag = '', time = '', like = ''] = h[2].split('|').map(x => x.trim()); fl.push({ n: +h[1], u, tag, time, like: parseInt(like) || 0, c: [], rp: [] }); continue; }
    const f = fl.at(-1); if (!f) continue;
    const r = l.match(/^[>＞]\s*([^：:]{1,24})[：:]\s*(.*)$/);
    if (r) f.rp.push({ u: r[1].trim(), c: r[2] }); else f.c.push(l);
  }
  return { css, top, plat: field(s, '平台'), board: field(s, '版块'), total: field(s, '回应数'), t: field(s, '标题'), ou, otag, otime, body, fl };
}

/* ---------- 拼成网页 ---------- */
// 正文里只放行几个不带属性的排版标签，其余全转义
const rich = s => esc(String(s).replace(/<(?!\/?(b|i|u|s|del|em|strong|mark|small|sup|sub|blockquote|br)\b)[^>]*>/gi, '')).replace(/&#60;(\/?)(b|i|u|s|del|em|strong|mark|small|sup|sub|blockquote)&#62;/gi, '<$1$2>').replace(/&#60;br\s*\/?&#62;/gi, '<br>');
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const av = u => `<i class="av" style="--c:hsl(${hue(u)} 45% 58%)">${esc([...(u || '?')][0])}</i>`;
const tag = t => t ? `<span class="tag" style="--tc:hsl(${hue(t)} 60% 45%)">${esc(t)}</span>` : '';
const clean = s => String(s).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
const BASE = `:root{--bg:#f4f4f4;--card:#fff;--fg:#222;--mut:#999;--acc:#3a7bd5;--line:#eee;--link:#37a}
*{box-sizing:border-box}body.xf{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow-wrap:anywhere;-webkit-text-size-adjust:100%}
.top{background:var(--card);border-bottom:1px solid var(--line)}.bar{display:flex;gap:8px;align-items:baseline;padding:10px 14px}.bar b{color:var(--acc);font-size:17px}.bar span{color:var(--mut);font-size:13px}
.op{background:var(--card);padding:16px 14px;margin-bottom:8px}.op-t{font-size:19px;line-height:1.4;margin:0 0 10px}.op-m{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mut);flex-wrap:wrap}
.op-c{margin-top:12px}.op-c p{margin:10px 0}blockquote{margin:10px 0;padding:6px 10px;border-left:3px solid var(--line);color:var(--mut);font-size:14px}
.av{flex:none;display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--c);color:#fff;font-style:normal;font-size:14px;font-weight:600}
.u{color:var(--link);font-weight:600}.tag{display:inline-block;font-size:11px;line-height:1.5;padding:0 5px;border-radius:3px;color:var(--tc);background:color-mix(in srgb,var(--tc) 12%,transparent);margin-left:4px}
.sum{padding:10px 14px;font-weight:600;color:var(--acc);background:var(--card);border-bottom:1px solid var(--line)}
.fl{display:flex;gap:10px;padding:12px 14px;background:var(--card);border-bottom:1px solid var(--line)}.fl-b{flex:1;min-width:0}
.fl-m{font-size:13px;display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}.fl-m time,.n{color:var(--mut);font-size:12px}.n{margin-left:auto}
.fl-c{margin:4px 0 6px}.fl-a{display:flex;gap:16px}.fl-a button{all:unset;cursor:pointer;color:var(--mut);font-size:12.5px}.like.on{color:#e5536a;font-weight:600}
.rps{background:color-mix(in srgb,var(--fg) 4%,transparent);border-radius:4px;padding:4px 10px;margin-top:8px;font-size:14px}.rp{padding:4px 0;border-bottom:1px dashed var(--line)}.rp:last-child{border:0}
.rp-u{color:var(--link);font-weight:600}.rp.more{display:none}.rps.open .rp.more{display:block}.rpt{color:var(--link)!important}
.end{text-align:center;color:var(--mut);font-size:12px;padding:18px 0 28px}`;
const JS = `document.addEventListener('click',e=>{const l=e.target.closest('.like');if(l){const b=l.querySelector('b');l.classList.toggle('on');b.textContent=+b.textContent+(l.classList.contains('on')?1:-1);return}
const r=e.target.closest('.rpt');if(r){const p=r.closest('.fl-b').querySelector('.rps');p.classList.toggle('open');r.firstChild.textContent=p.classList.contains('open')?'收起回复 ':'展开回复 '}});`;
export function html(raw) {
  const p = parse(raw);
  const paras = p.body.split(/\n+/).map(x => `<p>${rich(x)}</p>`).join('');
  const floors = p.fl.map(f => {
    const more = f.rp.length > 3;
    return `<div class="fl" id="f${f.n}">${av(f.u)}<div class="fl-b"><div class="fl-m"><span class="u">${esc(f.u)}</span>${tag(f.tag)}<time>${esc(f.time)}</time><span class="n">#${f.n}</span></div>
<div class="fl-c">${f.c.map(rich).join('<br>')}</div><div class="fl-a"><button class="like">赞 <b>${f.like}</b></button>${more ? `<button class="rpt">展开回复 <b>${f.rp.length}</b></button>` : ''}</div>
${f.rp.length ? `<div class="rps">${f.rp.map((r, i) => `<div class="rp${i >= 3 ? ' more' : ''}"><span class="rp-u">${esc(r.u)}</span>：<span class="rp-c">${rich(r.c)}</span></div>`).join('')}</div>` : ''}</div></div>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE}</style><style>${clean(p.css).replace(/@import[^;]*;/g, '')}</style></head>
<body class="xf"><div class="top">${clean(p.top) || `<div class="bar"><b>${esc(p.plat)}</b><span>${esc(p.board)}</span></div>`}</div>
<article class="op"><h1 class="op-t">${esc(p.t)}</h1><div class="op-m">${av(p.ou)}<span class="u">${esc(p.ou)}</span>${tag(p.otag)}<time>${esc(p.otime)}</time></div><div class="op-c">${paras}</div></article>
<div class="sum">全部回应（${esc(p.total || p.fl.length)}）</div><div class="fls">${floors}</div><div class="end">— 到底了 —</div><script>${JS}<\/script></body></html>`;
}

/* ---------- 提示词 ---------- */
const PLATS = ['豆瓣小组', '百度贴吧', 'NGA', '微博超话', 'Lofter 评论区', 'B站评论区', '知乎问答', 'A岛匿名版', 'S1', '天涯论坛', 'QQ空间留言板', '老式 BBS', '巴哈姆特', 'Reddit 风格的外网论坛', '那个世界自己的论坛'];
function prompt(cx, recent) {
  const role = cx.role == 'author'
    ? `在那个世界里，{{user}}的“上层身份”是这部${cx.fname}的作者本人：网友会 @作者、扒作者后记和微博、催更、骂作者乱写或者跪求作者别发刀；作者本人不在这一帖里发言。`
    : '在那个世界里，屏幕前的“我”只是一个普通读者，在潜水看帖，不发言、不被提到。';
  return `现在暂停扮演，切换到「窥探之眼 · 论坛」生成模式。

【设定：高维宇宙】
在更高一层的世界里，{{char}}、{{user}}和上面剧情里的所有人，都只是一部${cx.fname}里的角色。上面的「正文剧情」就是这部${cx.fname}的官方正片，最近这段剧情是刚刚更新的最新一${cx.ep}。
- 那个世界的人只知道这部作品本身，把当前剧情当作唯一的官方剧情来讨论，不知道、也不提任何“原著”“原剧情”。
- 作品名和作者：如果角色卡 / 世界书明显来自已有的作品，作品名、作者、连载平台、声优或演员直接用原作的真实信息；否则自己起一个像样的作品名和作者笔名。
- 角色们不知道自己是角色；发帖、回帖的全是那个世界的读者 / 观众 / 玩家。
- ${role}

【话题】从最近这段剧情里挑一个最容易吵起来的点开帖：感情线和CP、谁的人设崩了、战力、谁该死谁不该死、作者是不是乱写 / 卖腐 / 喂屎 / 要烂尾、作画 / 文笔 / 建模 / 演技、官方营业和周边……不一定是CP，选最贴这段剧情的。标题要像真帖：带【】标签，夸张、阴阳怪气、引战。楼主正文先把这一${cx.ep}的剧情情报讲清楚（带情绪、带细节、引用台词），再开嘲。

【楼里的人】自然混着出现，不要一类一类排：
CP粉（自己起CP名：两人名字各取一字 / 谐音 / 梗；也可以有对家CP、逆CP、拆CP党）、唯粉和毒唯、梦女、黑粉、乐子人和吃瓜路人、考据党（抠分镜 / 台词 / 伏笔）、“我朋友在XX工作”的情报党、理中客、老粉“想当年”、没看过就骂的云玩家、跑来引流的别家粉、刚入坑的萌新。
要像微博、豆瓣、贴吧饭圈大战那样缺德、嘴毒、好笑：互相拉踩、阴阳怪气、扣帽子、挂人、截图、“急了急了”“典”“乐”“绷不住了”“蚌埠住了”“对家滚”“这也能磕”“发刀”“be美学”“男人只会影响拔刀速度”这类黑话随手用。楼主要反复下场回怼；有几层楼中楼吵得最凶，同一个人会来回对线。
底线：骂的对象只能是角色、作品、作者笔名和网友马甲。真实存在的作者 / 声优 / 演员名字可以出现，但不编他们的私生活、丑闻和谣言；不用种族、性别、残障、地域的歧视性辱骂；不写色情描写。

【平台和排版】
自己挑一个平台：${PLATS.join('、')}。最近几帖用过：${recent.join('、') || '无'}，这次换一个不一样的。
楼里的说话方式要贴平台（贴吧的“楼主”“沙发”“顶”、NGA 的泥潭味、知乎的“谢邀”、微博的转发体、A岛的匿名串……）。
用 <style> 把帖子做成那个平台的样子：配色、字体、头像形状、楼层分隔、按钮、平台特有的小元素（等级牌、楼主标、勋章、绿色小组标题……）。每次都要像换了一个网站。
页面结构是固定的，只能用这些 class 写 CSS（可以改 CSS 变量，可以写任意规则、伪元素、渐变、背景图案）：
body.xf；.top 顶栏；.op 主楼、.op-t 标题、.op-m 作者行、.op-c 正文；.sum “全部回应”那一行；.fl 每一楼、.av 头像（内容是名字首字，背景色在 --c）、.fl-b、.fl-m、.u 昵称、.tag 身份标签（颜色在 --tc）、.n 楼号、time、.fl-c 内容、.fl-a 按钮行、.like、.rpt；.rps 楼中楼、.rp、.rp-u、.rp-c；.end 底部。
CSS 变量：--bg --card --fg --mut --acc --line --link。不要写 JS，不要外链图片和字体。CSS 不超过 3000 字。
<top> 里写这个平台的顶栏 HTML（logo 文字、导航、搜索框、版块名、横幅都可以，只用 div / span / b / i，不要 script）。

【输出格式】只输出下面这些，不要别的话，不要代码块：
<style>……</style>
<top>……</top>
【平台】平台名
【版块】小组 / 吧 / 版块名
【回应数】一个夸张的总回应数
【标题】帖子标题
【楼主】昵称 | 身份标签 | 发帖时间
【正文】
楼主正文，多段，可以用 <b> <br> <blockquote> <s>
【楼层】
#1 昵称 | 身份标签 | 时间 | 赞数
这一楼的内容（可以多行）
> 回复人：回复内容
> 回复人：回复内容
#2 昵称 | 身份标签 | 时间 | 赞数
……

要求：楼层至少 50 楼，楼号从 1 连续往下编；每楼 1～4 句，长短错落；至少 10 楼带楼中楼（每个 2～6 条）；楼主回帖时身份标签写“楼主”；时间从发帖时间往后推；昵称全是网名，同一个人在不同楼里昵称一致。`;
}

/* ---------- 页面 ---------- */
const MSG = ['正在登录高维网络', '正在翻过第四面墙', '正在潜入讨论区', '正在搬小板凳', '正在围观吵架', '正在扒楼'];
const nick = () => { const n = meObj().nick || '路人'; return `ゞ${n}の吃瓜号`; };
const win = (title, inner) => `<div class="ef-win"><div class="ef-wt"><i>📡</i><b>${title}</b><span>♡</span><em class="min">–</em><em class="x" data-a="efx">×</em></div>
<div class="ef-sky"><i class="cl c1"></i><i class="cl c2"></i><span class="ef-ic">🍉</span></div>${inner}</div>`;
const login = () => win('高维论坛', `<div class="ef-lg"><img class="ef-av" src="${esc(avOf(meObj()))}" alt=""><div class="ef-in"><span>${esc(nick())}</span><span class="pw">••••••••</span></div></div>
<div class="ef-ck"><b>✓</b>记住密码<b>✓</b>自动登录</div><button class="ef-go" data-a="efgen">登　录</button>`);
const loading = () => win('高维论坛', `<div class="ef-ld"><p class="ef-msg">${MSG[0]}…</p><div class="ef-bar"><i></i></div></div>`);

let busy = null; // { ac, el } 正在生成的那一次
function show(el, item) {
  const v = $('.ef-v', el); if (!v) return;
  if (!item) { v.innerHTML = `<div class="ef-bg">${login()}</div>`; $('.ef-ttl', el).textContent = '论坛'; return; }
  v.innerHTML = '<iframe class="ef-fr" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>';
  $('.ef-fr', v).srcdoc = html(item.raw);
  $('.ef-ttl', el).textContent = [item.plat, item.board].filter(Boolean).join(' · ') || '论坛';
  el.dataset.cur = item.id;
}
function gen(el, cx) {
  if (busy) return toast('正在扒楼');
  const v = $('.ef-v', el), data = D(), list = FS();
  v.insertAdjacentHTML('beforeend', `<div class="ef-bg ef-over">${loading()}</div>`);
  const ov = $('.ef-over', v), msg = $('.ef-msg', ov), bar = $('.ef-bar i', ov);
  let mi = 0, floors = 0; const tick = setInterval(() => { if (!floors) msg.textContent = MSG[++mi % MSG.length] + '…'; }, 1600);
  const ac = new AbortController(); busy = { ac, el };
  const done = () => { clearInterval(tick); busy = null; ov.remove(); };
  task('论坛 · 扒帖中', async sg => {
    sg.addEventListener('abort', () => ac.abort());
    try {
      const raw = await llm(await sysCtx(), prompt(cx, list.slice(0, 3).map(x => x.plat).filter(Boolean)), '窥探之眼 · 论坛', ac.signal, {
        onText: t => { const n = (t.match(/^#\s*\d+/gm) || []).length; if (n != floors) { floors = n; msg.textContent = `已扒到第 ${n} 楼…`; bar.style.width = Math.min(100, 8 + n / 50 * 92) + '%'; } },
        onThink: () => { bar.style.width = Math.max(parseFloat(bar.style.width) || 4, 6) + '%'; },
      });
      if (D() !== data) throw Error('聊天已切换，这一帖没存');
      const p = parse(raw); if (p.fl.length < 5 || !p.t) throw Error('格式不对，再扒一次试试');
      const item = { id: uid(), at: Date.now(), plat: p.plat, board: p.board, t: p.t, n: p.fl.length, form: cx.form, raw };
      list.unshift(item); list.length > KEEP && list.splice(KEEP); saveD();
      done(); el.isConnected && show(el, item);
      return `扒到 ${p.fl.length} 楼`;
    } catch (e) { done(); if (ac.signal.aborted) return '论坛 · 已取消'; throw e; }
  });
}
function history(cx, el) {
  const row = x => `<li data-a="efpick" data-x="${x.id}"><b>${esc(x.plat || '论坛')}</b><span>${esc(x.t)}</span><small>${new Date(x.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${x.n} 楼</small><em data-a="efdel" data-x="${x.id}">×</em></li>`;
  page({ title: '扒过的帖', cls: 'efh', body: () => FS().length ? `<ul class="efh-l">${FS().map(row).join('')}</ul>` : '<div class="empty">还没有</div>', acts: {
    efpick: id => { const it = FS().find(x => x.id == id); back(); it && show(el, it); },
    efdel: async (id, t, e, pg) => { e?.stopPropagation?.(); if (!await ok('删掉这一帖')) return; const l = FS(), i = l.findIndex(x => x.id == id); i >= 0 && l.splice(i, 1); saveD(); pg.re(); if (el.dataset.cur == id) show(el, l[0]); },
  } });
}
const IC = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hist: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v3.5h3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4.5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  ref: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// cx：{ form, fname, ep, role }，由窥探之眼传进来（避免两个文件互相 import）
export function openForum(cx) {
  return page({ title: '', cls: 'ef-pg', noBack: 1, body: () => `<div class="ef"><header class="ef-h"><b data-a="efback">${IC.back}</b><span class="ef-ttl">论坛</span><b data-a="efhist">${IC.hist}</b><b data-a="efgen">${IC.ref}</b></header><div class="ef-v"></div></div>`,
    after: el => { if (el._ef) return; el._ef = 1; show(el, FS()[0]); if (busy && busy.el !== el) busy = null; },
    acts: {
      efback: () => back(),
      efhist: (x, t, e, pg) => history(cx, pg.el),
      efgen: (x, t, e, pg) => gen(pg.el, cx),
      efx: () => busy ? busy.ac.abort() : back(),
    } });
}
