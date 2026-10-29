// 窥探之眼 · 论坛：那个世界里的读者 / 观众 / 玩家在吵这段剧情。
// 一次生成一整帖（主楼 + 至少 50 楼 + 楼中楼），每次挑一个平台（豆瓣 / 贴吧 / NGA / 微博 / A岛……），排版整个跟着平台换。
// 「模板 + 数据」：模型写一次页面骨架 / 一楼的样子 / 一条楼中楼的样子（HTML + CSS，结构随便它定），
// 楼层内容用很省字的文本给；这里把数据填进模板，拼成网页放进 sandbox iframe。这样每帖排版都能完全不同，50 楼也写得下。
// 历史按聊天存在 D().eye.forum（存模型原文，看的时候再拼），最多 30 帖。模型在 设置 → API 里单独选（默认跟小手机的聊天模型）。
import { S, C, D, $, page, back, toast, saveD, esc, uid, llm, sysCtx, task, ok } from '../../core.js';

const KEEP = 30;
const FS = () => (D().eye ||= { form: '', role: 'viewer', wall: false, src: 'orig' }).forum ||= [];

/* ---------- 解析模型输出 ---------- */
const field = (s, k) => (s.match(new RegExp(`【${k}】[ \\t]*(.*)`)) || [])[1]?.trim() || '';
const tagIn = (s, t) => (s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i')) || [])[1] || '';
export function parse(raw) {
  const s = String(raw || '').replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/g, '').replace(/```[a-z]*\n?/g, '');
  const css = (s.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || '';
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
  return { css, top: tagIn(s, 'top'), tp: tagIn(s, 'page'), tf: tagIn(s, 'floor'), tr: tagIn(s, 'reply'),
    plat: field(s, '平台'), board: field(s, '版块'), total: field(s, '回应数'), t: field(s, '标题'), ou, otag, otime, body, fl };
}

/* ---------- 拼成网页 ---------- */
// 内容里只放行几个不带属性的排版标签；模板里去掉脚本、事件属性、外链
const rich = s => esc(String(s).replace(/<(?!\/?(b|i|u|s|del|em|strong|mark|small|sup|sub|blockquote|br)\b)[^>]*>/gi, '')).replace(/&#60;(\/?)(b|i|u|s|del|em|strong|mark|small|sup|sub|blockquote)&#62;/gi, '<$1$2>').replace(/&#60;br\s*\/?&#62;/gi, '<br>');
const clean = s => String(s).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?(iframe|object|embed|link|meta|base|form|img|video|audio|source)[^>]*>/gi, '')
  .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '').replace(/(src|href)\s*=\s*("|')?(https?:)?\/\/[^\s"'>]*\2?/gi, '').replace(/url\(\s*['"]?(https?:)?\/\/[^)]*\)/gi, 'none').replace(/@import[^;]*;?/gi, '');
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const IPS = ['广东', '北京', '上海', '浙江', '四川', '江苏', '湖北', '山东', '福建', '湖南', '重庆', '陕西', '辽宁', '海外'];
const fill = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => k in v ? v[k] : '');
// 给模板的第一个元素加属性（楼的根元素、被折叠的楼中楼）
const mark = (h, a) => h.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 ${a}`);
const DEF = {
  page: `<div class="top"><div class="bar"><b>{{plat}}</b><span>{{board}}</span></div></div>
<article class="op"><h1 class="op-t">{{title}}</h1><div class="op-m">{{op_av}}<span class="u">{{op}}</span><span class="tag">{{op_tag}}</span><time>{{op_time}}</time></div><div class="op-c">{{body}}</div></article>
<div class="sum">全部回应（{{total}}）</div>{{floors}}<div class="end">— 到底了 —</div>`,
  floor: `<div class="fl">{{av}}<div class="fl-b"><div class="fl-m"><span class="u">{{u}}</span><span class="tag">{{tag}}</span><time>{{time}}</time><span class="n">#{{n}}</span></div><div class="fl-c">{{c}}</div><div class="fl-a"><span class="like">赞 {{like}}</span>{{more}}</div><div class="rps">{{replies}}</div></div></div>`,
  reply: `<div class="rp"><span class="rp-u">{{u}}</span>：{{c}}</div>`,
  css: `:root{--bg:#f4f4f4;--card:#fff;--fg:#222;--mut:#999;--acc:#3a7bd5;--line:#eee;--link:#37a}body{background:var(--bg);color:var(--fg)}
.bar{display:flex;gap:8px;align-items:baseline;padding:10px 14px;background:var(--card);border-bottom:1px solid var(--line)}.bar b{color:var(--acc);font-size:17px}.bar span{color:var(--mut);font-size:13px}
.op{background:var(--card);padding:16px 14px;margin-bottom:8px}.op-t{font-size:19px;line-height:1.4;margin:0 0 10px}.op-m{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mut)}
.u{color:var(--link);font-weight:600}.tag{font-size:11px;padding:0 5px;border-radius:3px;background:#eef}.tag:empty{display:none}.sum{padding:10px 14px;font-weight:600;color:var(--acc);background:var(--card)}
.fl{display:flex;gap:10px;padding:12px 14px;background:var(--card);border-top:1px solid var(--line)}.fl-b{flex:1;min-width:0}.fl-m{font-size:13px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.fl-m time,.n{color:var(--mut);font-size:12px}.n{margin-left:auto}
.fl-c{margin:4px 0 6px}.fl-a{display:flex;gap:16px;color:var(--mut);font-size:12.5px}.rps:not(:empty){background:#f6f6f6;border-radius:4px;padding:4px 10px;margin-top:8px;font-size:14px}.rp{padding:3px 0}.rp-u{color:var(--link);font-weight:600}.end{text-align:center;color:var(--mut);font-size:12px;padding:18px 0 28px}`,
};
const BASE = `*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{font:15px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow-wrap:anywhere;-webkit-text-size-adjust:100%}
img,svg{max-width:100%}blockquote{margin:8px 0;padding:4px 10px;border-left:3px solid currentColor;opacity:.75}
.xf-av{flex:none;display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:hsl(var(--h) 45% 58%);color:#fff;font-style:normal;font-size:14px;font-weight:600}
.like,[data-like]{cursor:pointer;user-select:none}.like.on,[data-like].on{color:#e5536a!important;font-weight:600}
[data-more]{display:none!important}[data-fl].open [data-more]{display:revert!important}.xf-more{all:unset;cursor:pointer;color:inherit;opacity:.75;font-size:12.5px}`;
const JS = `document.addEventListener('click',e=>{const l=e.target.closest('.like,[data-like]');if(l){const b=l.querySelector('.xf-n');l.classList.toggle('on');b&&(b.textContent=+b.textContent+(l.classList.contains('on')?1:-1));return}
const r=e.target.closest('.xf-more');if(r){const f=r.closest('[data-fl]');f.classList.toggle('open');r.textContent=f.classList.contains('open')?'收起回复':'展开 '+r.dataset.n+' 条回复'}});`;
const avH = (u, h) => `<i class="xf-av" style="--h:${h}">${esc([...(u || '?')][0])}</i>`;
const tpls = p => { const own = !!(p.tp && p.tf && /\{\{floors\}\}/.test(p.tp)); return { own, ...(own ? { page: clean(p.tp), floor: clean(p.tf), reply: clean(p.tr || DEF.reply) } : DEF) }; };
const floorH = (T, f, i) => {
  const h = hue(f.u), more = f.rp.length > 3;
  const replies = f.rp.map((r, j) => { const x = fill(T.reply, { u: esc(r.u), c: rich(r.c), av: avH(r.u, hue(r.u)), hue: hue(r.u), i: j + 1 }); return j >= 3 ? mark(x, 'data-more') : x; }).join('');
  return mark(fill(T.floor, { n: f.n, u: esc(f.u), tag: esc(f.tag), time: esc(f.time), like: `<b class="xf-n">${f.like}</b>`, c: f.c.map(rich).join('<br>'), av: avH(f.u, h), hue: h,
    lv: 1 + hue(f.u + 'lv') % 18, id: (hue(f.u) * 7919 + hue(f.u + 'x') * 104729).toString(36).slice(-8).toUpperCase(), ip: IPS[hue(f.u + 'ip') % IPS.length],
    is_op: f.tag == '楼主' ? 'op' : '', i: i + 1, rn: f.rp.length, replies, more: more ? `<button class="xf-more" data-n="${f.rp.length - 3}">展开 ${f.rp.length - 3} 条回复</button>` : '' }), `data-fl="${f.n}" id="f${f.n}"`);
};
// 生成中先把页面骨架 + 主楼放出来，后面的楼一层层发进 iframe 里接上（live）
const LIVE = `addEventListener('message',e=>{const d=e.data;if(!d||d.t!='xf')return;const end=document.getElementById('xf-end');end&&end.insertAdjacentHTML('beforebegin',d.h)});`;
export function html(raw, live) {
  const p = parse(raw), T = tpls(p);
  const floors = (live ? [] : p.fl).map((f, i) => floorH(T, f, i)).join('\n') + '<template id="xf-end"></template>';
  const body = fill(T.page, { plat: esc(p.plat), board: esc(p.board), total: esc(p.total || p.fl.length), count: live ? '…' : p.fl.length, title: esc(p.t), op: esc(p.ou), op_tag: esc(p.otag), op_time: esc(p.otime),
    op_av: avH(p.ou, hue(p.ou)), body: p.body.split(/\n+/).map(x => `<p>${rich(x)}</p>`).join(''), floors });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE}</style><style>${T.own ? '' : DEF.css}${clean(p.css)}</style></head>
<body class="xf">${T.own ? '' : clean(p.top)}${body}<script>${JS}${LIVE}<\/script></body></html>`;
}
// 已经写完的楼（最后一楼可能还在写，不算）
const doneFl = (t, end) => { const p = parse(t); return { p, fl: end ? p.fl : p.fl.slice(0, -1) }; };

/* ---------- 提示词 ---------- */
const PLATS = [
  ['豆瓣小组', '浅绿白、细线分隔、头像方圆角、“热门回应 / 全部回应”'],
  ['百度贴吧', '左侧用户栏（头像 + 等级牌 {{lv}}）、右侧楼层卡片、“楼主”红标、x楼 / 回复(x)'],
  ['NGA', '米黄底、两栏表格（左用户信息侧栏，右正文）、深棕楼层条、#楼号'],
  ['微博评论区', '一条条卡片、头像圆、“转发 评论 赞”图标行、热评置顶标、IP属地 {{ip}}'],
  ['知乎', '回答卡片、蓝色“赞同 xx”胶囊按钮、作者一句话签名、折叠评论区'],
  ['A岛 / 匿名版', '没有头像、昵称换成“无名氏 ID:{{id}}”、No.楼号、>>No.x 引用绿字、等宽字、朴素灰底'],
  ['Lofter', '居中大卡片、留白多、细衬线字、#tag 标签、“喜欢 / 推荐”'],
  ['B站评论区', 'LV 等级彩色小牌 {{lv}}、UP主 粉标、IP属地、粉蓝点缀、“回复”展开'],
  ['天涯论坛', '老式蓝白表格、楼层头一条横栏“作者：xx  时间：xx  {{n}}楼”、小字号宋体感'],
  ['QQ空间留言板', '花哨渐变背景、圆角气泡、闪字感的彩色昵称、火星文签名、“回复 删除”'],
  ['老式 BBS', '等宽字、表格边框、左侧发帖人资料（积分 / 注册时间）、“发表于 xx”'],
  ['Reddit 风格的外网论坛', '左侧上下投票箭头 + 分数、嵌套缩进竖线的楼中楼、暗色模式'],
  ['巴哈姆特', '深蓝顶栏、楼层卡片带“GP / BP”、勇者等级'],
  ['那个世界自己的论坛', '完全自创：配色、版式、元素都自己发明'],
];
// 每种形态吵的东西不一样：谁是“创作方”、细节抠什么、常见的梗和平台
const FD = {
  manga: { who: '漫画家（作者）和责编', pts: '周刊 / 月刊连载、第几话、休刊和请假条、卷头彩页和扉页、分镜、网点、作画崩没崩（“这格脸崩了”“手画成鸡爪”“身高比例又不对”“背景全是素材”“草稿上线”）、作画进步、单行本修图和加页、卷末作者后记和小剧场、人气投票和读者排名、腰斩危机、图透 / 生肉 / 汉化组熟肉、单行本销量、动画化传闻', fans: '“图透党”“等熟肉”“作者是不是又摸了”', plat: '贴吧、豆瓣、微博、NGA' },
  anime: { who: '监督、系列构成（编剧）、作画监督、制作公司', pts: '季番、每周几点更新、第几集、作画崩坏和作画资源、PPT 演出、原画师和作画监督、OP / ED 和配乐、声优演技（棒读 / 封神）、分镜演出、名场面截图、BD 修正（“这集等 BD 修吧”）、放送后弹幕刷屏、站内评分和追番人数、二期 / 剧场版 / 续作、手办和周边', fans: '“截图党”“弹幕护体”“作画警察”“声优粉”', plat: 'B站、贴吧、NGA、微博' },
  drama: { who: '导演、编剧、制片方', pts: '第几集、注水和拖剧情、剪辑和删减、台词、演技（瞪眼 / 面瘫 / 哭戏）、服化道、穿帮镜头、滤镜和打光、BGM 和 OST、广告植入、番位和海报番位、收视率 / 站内热度 / 播放量、豆瓣评分、路透和花絮、超前点播、结局', fans: '“剧粉 vs 演员粉”“控评”“番位之争”“剧抛脸”', plat: '豆瓣、微博、知乎' },
  novel: { who: '作者（大大）', pts: '网文连载、第几章、更新 / 断更 / 请假条、作者有话说、水字数、错别字和 bug、文笔、逻辑和设定、伏笔、感情线和虐点、本章说和段评、订阅 / 月票 / 打赏 / 盟主、全订、养肥再看、出版实体书、有声剧和广播剧、影视化传闻', fans: '“养肥党”“段评区”“作者别发刀”“弃文了”', plat: '豆瓣、Lofter、贴吧、那个世界的文学网站评论区' },
  game: { who: '策划、制作人、文案、美术', pts: '版本更新和新剧情章节、活动、卡池 / 抽卡 / 保底 / UP 池、角色强度（T0 / 下水道）、平衡性和削弱、bug 和补偿、建模 / 立绘 / Live2D、配音（CV）、文案和剧情策划背锅、氪金和福利、公告、玩家社区和攻略、二创、主播 / 实况、“为了这点剧情抽了几百发”', fans: '“策划死了”“退坑了”“云玩家”“非酋 / 欧皇”“强度党 vs 剧情党 vs XP党”', plat: 'NGA、TapTap 风格评论区、巴哈姆特、B站、贴吧' },
};
function prompt(cx, recent) { const c = C(), t = prompt0(cx, recent); return (c.substituteParams?.(t) ?? t).replaceAll('{{char}}', c.name2 || '角色').replaceAll('{{user}}', c.name1 || '我'); }
function prompt0(cx, recent) {
  const fd = FD[cx.form] || FD.anime;
  const role = cx.role == 'author'
    ? `在那个世界里，{{user}}的“上层身份”就是这部${cx.fname}的创作方本人（${fd.who}里那一个）。网友骂的、@ 的、催更的就是“我”，但“我”不在这一帖里发言。`
    : '在那个世界里，屏幕前的“我”只是一个普通读者 / 观众 / 玩家，在潜水看帖，不发言、不被提到。';
  return `现在暂停扮演，切换到「窥探之眼 · 论坛」生成模式。

【设定：高维宇宙】
在更高一层的世界里，{{char}}、{{user}}和上面剧情里的所有人，都只是一部${cx.fname}里的角色。上面的「正文剧情」就是这部${cx.fname}的官方正片，最近这段剧情是刚刚更新的最新一${cx.ep}。
- 那个世界的人只知道这部作品本身，把当前剧情当作唯一的官方剧情来讨论，不知道、也不提任何“原著”“原剧情”。
- 作品名和作者：如果角色卡 / 世界书明显来自已有的作品，作品名、作者、连载平台、声优或演员直接用原作的真实信息；否则自己起一个像样的作品名和作者笔名。
- 角色们不知道自己是角色；发帖、回帖的全是那个世界的读者 / 观众 / 玩家。
- 帖子里的人物、事件、台词只能来自上面的【正文剧情】、角色卡和世界书里真实出现过的东西：主角就是{{char}}和{{user}}（以及剧情里出现过的人），讨论的就是正文里最近发生的事。不要编正文里没有的主角和事件，不要把系统提示、设定说明、模型自己的说明当成剧情。
- ${role}

【这是一部${cx.fname}：吵的东西要是${cx.fname}才有的】
创作方：${fd.who}。不管“我”是什么身份，楼里都会骂创作方、阴阳创作方、跪求创作方、扒创作方的发言。
${cx.fname}特有的细节（挑合适的用，越具体越好）：${fd.pts}。
常见的人和梗：${fd.fans}。这类帖子常出现在：${fd.plat}。
楼里要有大量只有${cx.fname}才会说的细节吐槽，比如具体到“第几页 / 第几分几秒 / 第几章第几段 / 哪个立绘”的地方崩了、好了、埋了伏笔。

【话题】从最近这段剧情里挑一个最容易吵起来的点开帖：感情线和CP、谁的人设崩了、战力、谁该死谁不该死、创作方是不是乱写 / 卖腐 / 喂屎 / 要烂尾、${cx.fname}特有的制作问题、官方营业和周边……不一定是CP，选最贴这段剧情的。标题要像真帖：带【】标签，夸张、阴阳怪气、引战。楼主正文先把这一${cx.ep}的剧情情报讲清楚（带情绪、带细节、引用台词），再开嘲。

【楼里的人】自然混着出现，不要一类一类排：
CP粉（自己起CP名：两人名字各取一字 / 谐音 / 梗；也可以有对家CP、逆CP、拆CP党）、唯粉和毒唯、梦女、黑粉、乐子人和吃瓜路人、考据党（抠分镜 / 台词 / 伏笔）、“我朋友在XX工作”的情报党、理中客、老粉“想当年”、没看过就骂的云玩家、跑来引流的别家粉、刚入坑的萌新。
要像微博、豆瓣、贴吧饭圈大战那样缺德、嘴毒、好笑：互相拉踩、阴阳怪气、扣帽子、挂人、截图、“急了急了”“典”“乐”“绷不住了”“蚌埠住了”“对家滚”“这也能磕”“发刀”“be美学”“男人只会影响拔刀速度”这类黑话随手用。楼主要反复下场回怼；有几层楼中楼吵得最凶，同一个人会来回对线。
底线：骂的对象只能是角色、作品、创作方（笔名 / 职位）和网友马甲。真实存在的作者 / 声优 / 演员名字可以出现，但不编他们的私生活、丑闻和谣言；不用种族、性别、残障、地域的歧视性辱骂；不写色情描写。

【平台：说话方式和排版都要像它】
从下面挑一个（后面是它长什么样的提示；${cx.fname}的帖子更常见于 ${fd.plat}，但不必拘泥），最近几帖用过：${recent.join('、') || '无'}，这次换一个不一样的：
${PLATS.map(([n, d]) => `- ${n}：${d}`).join('\n')}
说话方式贴平台：贴吧的“楼主”“沙发”“顶”、NGA 的泥潭味、知乎的“谢邀”“利益相关”、微博的转发体、A岛的匿名串和 >>引用、天涯的“马克”……
排版要整个像那个平台，而不是同一个网页换个颜色：版式（单栏卡片 / 左右两栏 / 表格 / 时间线 / 气泡 / 嵌套缩进）、配色（亮色或暗色）、字体（只能用系统字体：无衬线 / 衬线 / 等宽）、头像（圆 / 方 / 没有 / 自己画）、楼层头、按钮、徽章、等级牌、分隔线、背景纹理都按平台来。页面是手机竖屏，宽 360～420px，所有东西不能横向超出。

你要写四个模板（HTML，结构随你定），我把数据填进去：
<page>整页：顶栏 / 版块信息 / 主楼 / 楼层列表 / 底部。必须含 {{floors}}，可以用 {{plat}} {{board}} {{total}} {{count}} {{title}} {{op}} {{op_tag}} {{op_time}} {{op_av}} {{body}}</page>
<floor>一楼的样子。可以用 {{n}}楼号 {{u}}昵称 {{tag}}身份标签 {{time}} {{like}}赞数 {{c}}内容 {{av}}现成的圆形字母头像 {{hue}}0-359色相（自己画头像用，如 style="--h:{{hue}}"）{{lv}}1-18等级 {{id}}8位匿名ID {{ip}}IP属地 {{is_op}}楼主时是 op 否则为空（可放进 class）{{i}}第几楼 {{rn}}楼中楼条数 {{replies}}楼中楼 {{more}}“展开回复”按钮</floor>
<reply>一条楼中楼的样子：{{u}} {{c}} {{av}} {{hue}} {{i}}</reply>
<style>所有样式。点赞按钮加 class="like"，里面放 {{like}}。</style>
排版质量：头像和文字不能重叠；楼中楼放在这一楼内容下面、缩进或底色区分，楼中楼里不放头像或只放很小的（20px 左右）；正文字号 14～16px、行距舒服；楼与楼之间有清楚的分隔；主楼标题醒目；手机窄屏上不挤不溢出。
模板里只用普通标签和 class / style 属性；不要 script、不要 on 事件、不要外链图片和字体；楼层容器不要用 table。模板加样式一共不超过 3000 字，写得精炼。

【输出格式】只输出下面这些，不要别的话，不要代码块：
<style>……</style>
<page>……</page>
<floor>……</floor>
<reply>……</reply>
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

要求：楼层至少 50 楼，楼号从 1 连续往下编；每楼 1～3 句，长短错落、多数很短（像真实评论区）；至少 10 楼带楼中楼（每个 2～6 条）；楼主回帖时身份标签写“楼主”；时间从发帖时间往后推；昵称全是网名，同一个人在不同楼里昵称一致（匿名版就都叫无名氏）。`;
}

/* ---------- 页面 ---------- */
// 进来 / 加载：一个门上的猫眼。里面是模糊的帖子在往上滚，扒到的楼一条条从猫眼里漂过去；红色的圈在扫描
const MSG = ['正在接入高维网络', '正在穿过第四面墙', '正在找到那个帖子', '正在扒楼'];
const hole = (lines = '') => `<div class="ph"><div class="ph-in"><div class="ph-roll">${(lines || '<i></i>'.repeat(14)).repeat(2)}</div></div><i class="ph-scan"></i><i class="ph-glare"></i></div>`;
const entry = () => `<div class="efp">${hole()}<button class="efp-go" data-a="efgen">凑近看</button></div>`;
const loading = () => `<div class="efp efp-ld"><b class="efp-x" data-a="efx">×</b>${hole()}<p class="efp-st"><span>${MSG[0]}</span><i class="efp-cur"></i></p><div class="efp-seg">${'<i></i>'.repeat(25)}</div></div>`;

// 正在生成的那一次（全局只有一个：离开论坛再进来也接着显示它，不会再开第二次）
// { ac, raw, shell: 骨架和主楼已经出来了, n: 已收到的楼数, cx }
let busy = null;
const pages = () => [...document.querySelectorAll('.ef-pg')];
function show(el, item) {
  const v = $('.ef-v', el); if (!v) return;
  if (!item) { v.innerHTML = entry(); $('.ef-ttl', el).textContent = '论坛'; return; }
  v.innerHTML = '<iframe class="ef-fr" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>';
  $('.ef-fr', v).srcdoc = html(item.raw);
  $('.ef-ttl', el).textContent = [item.plat, item.board].filter(Boolean).join(' · ') || '论坛';
  el.dataset.cur = item.id;
}
// 生成中的样子：骨架还没出来 → 猫眼；出来了 → 页面先放上，楼一层层接上，底下一个小条报进度
function paintBusy(el) {
  const v = $('.ef-v', el); if (!v || !busy) return;
  if (!busy.shell) {
    if (!$('.efp-ld', v)) { v.insertAdjacentHTML('beforeend', loading()); setTimeout(() => $('.efp:not(.efp-ld)', v)?.remove(), 350); }
    const ov = $('.efp-ld', v), n = busy.n;
    $('.efp-st span', ov).textContent = n ? `已窥到 #${n} 楼` : MSG[busy.mi % MSG.length];
    return;
  }
  let fr = $('.ef-fr.live', v);
  if (!fr) {
    v.innerHTML = '<iframe class="ef-fr live" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><div class="ef-live"><span></span><i></i></div>';
    fr = $('.ef-fr', v); fr._sent = 0; fr.onload = () => { fr._ok = 1; feed(fr); }; fr.srcdoc = html(busy.raw, true);
    const p = parse(busy.raw); $('.ef-ttl', el).textContent = [p.plat, p.board].filter(Boolean).join(' · ') || '论坛';
  }
  feed(fr); $('.ef-live span', v).textContent = `正在扒 #${busy.n} 楼`;
}
function feed(fr, end) {
  if (!fr._ok || !busy) return; const { p, fl } = doneFl(busy.raw, end), T = tpls(p);
  if (fl.length > fr._sent) { fr.contentWindow.postMessage({ t: 'xf', h: fl.slice(fr._sent).map((f, i) => floorH(T, f, fr._sent + i)).join('') }, '*'); fr._sent = fl.length; }
}
function gen(el, cx) {
  if (busy) return toast('这一帖还没扒完');
  const c = C(); if (!(c.chat || []).some(m => !m.is_system && String(m.mes || '').trim())) return toast('正文里还没有剧情');
  const data = D(), list = FS(), ac = new AbortController();
  busy = { ac, raw: '', shell: false, n: 0, mi: 0, cx };
  const tick = setInterval(() => { busy && !busy.n && (busy.mi++, pages().forEach(paintBusy)); }, 1700);
  pages().forEach(paintBusy);
  const end = ok => { clearInterval(tick); const b = busy; busy = null;
    pages().forEach(pg => { const v = $('.ef-v', pg); if (!v) return;
      const ov = $('.efp-ld', v); ov && (ov.classList.add('out'), setTimeout(() => ov.remove(), 600));
      $('.ef-live', v)?.remove();
      if (ok) { const fr = $('.ef-fr.live', v); if (fr) { busy = b; feed(fr, true); busy = null; fr.classList.remove('live'); pg.dataset.cur = ok.id; } else show(pg, ok); }
      else if ($('.ef-fr.live', v)) show(pg, FS()[0]);
    }); };
  task('论坛 · 扒帖中', async sg => {
    sg.addEventListener('abort', () => ac.abort());
    try {
      const sys = await sysCtx({ n: 10, rc: 6000, wi: 3000, desc: 2000 });
      const raw = await llm(sys, prompt(cx, list.slice(0, 3).map(x => x.plat).filter(Boolean)), '窥探之眼 · 论坛', ac.signal, {
        use: S.api?.chat?.eyef || '', fast: 1,
        onText: t => {
          if (!busy) return; busy.raw = t; const n = (t.match(/^#\s*\d+/gm) || []).length;
          if (!busy.shell && n >= 1) busy.shell = true; // 第 1 楼开始写了：骨架和主楼都已经齐了
          if (n != busy.n || busy.shell) { busy.n = n; pages().forEach(paintBusy); }
        },
      });
      if (D() !== data) throw Error('聊天已切换，这一帖没存');
      const p = parse(raw); if (p.fl.length < 5 || !p.t) throw Error('格式不对，再扒一次试试');
      const item = { id: uid(), at: Date.now(), plat: p.plat, board: p.board, t: p.t, n: p.fl.length, form: cx.form, raw };
      list.unshift(item); list.length > KEEP && list.splice(KEEP); saveD();
      busy.raw = raw; end(item);
      return `扒到 ${p.fl.length} 楼`;
    } catch (e) { end(null); if (ac.signal.aborted) return '论坛 · 已取消'; throw e; }
  });
}
function history(el) {
  const row = x => `<li data-a="efpick" data-x="${x.id}"><b>${esc(x.plat || '论坛')}</b><span>${esc(x.t)}</span><small>${new Date(x.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${x.n} 楼</small><em data-a="efdel" data-x="${x.id}">×</em></li>`;
  page({ title: '扒过的帖', cls: 'efh', body: () => FS().length ? `<ul class="efh-l">${FS().map(row).join('')}</ul>` : '<div class="empty">还没有</div>', acts: {
    efpick: id => { const it = FS().find(x => x.id == id); back(); it && show(el, it); },
    efdel: async (id, t, e, pg) => { if (!await ok('删掉这一帖')) return; const l = FS(), i = l.findIndex(x => x.id == id); i >= 0 && l.splice(i, 1); saveD(); pg.re(); if (el.dataset.cur == id) show(el, l[0]); },
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
    after: el => { if (el._ef) return; el._ef = 1; show(el, FS()[0]); busy && paintBusy(el); },
    acts: {
      efback: () => back(),
      efhist: (x, t, e, pg) => history(pg.el),
      efgen: (x, t, e, pg) => gen(pg.el, cx),
      efx: () => busy?.ac.abort(),
    } });
}
