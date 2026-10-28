// 小手机 · 窥探之眼：从更高一层往下看——这段剧情在「那个世界」里是一部漫画 / 动画 / 电视剧 / 小说 / 广播剧
// 界面是一张夜里的书桌（2.5D，CSS 3D 透视）：桌上每样东西对应一个模块，点一下镜头推过去、底下浮出一张玻璃卡
//   作品本体（随形态换：漫画单行本 / 电视机 / 文库本 / 收音机）→ 本期更新
//   墙上的布告栏 → 论坛        台本 + 麦克风 / 原稿 + 蘸水笔 / 场记板 → 幕后感想
//   桌牌 → 身份（观众席 ↔ 作者）  玻璃罩里的红眼睛 → 窥视（刷新本期）
// 现在只有样子和镜头交互；内容都是样例，生成之后接
import { S, $, $$, page, reg, toast, save } from '../../core.js';

const CSS = new URL('./eye.css?v=1', import.meta.url).href;
const css = () => { if (document.querySelector('link[data-eye]')) return; document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" data-eye href="${CSS}">`); };
const ST = () => (S.eye ||= { form: 'manga', role: 'viewer' });

/* ---------- 形态 ---------- */
const FORMS = [['manga', '漫画'], ['anime', '动画'], ['drama', '电视剧'], ['novel', '小说'], ['radio', '广播剧']];
const FN = Object.fromEntries(FORMS);
// 每种形态：本期的叫法、幕后的叫法、幕后用哪件道具、作品用哪件道具
const FM = {
  manga: { ep: '话', unit: '第 3 卷 · 第 27 话', where: '周刊少年某某 · 每周四更新', bs: '作者后记', bsSub: '卷末 · 作者与责编', prop: 'ink', work: 'manga' },
  anime: { ep: '集', unit: '第 2 季 · 第 8 集', where: '某某 TV · 每周六 24:00', bs: '声优感想', bsSub: '录音后 · 配音演员', prop: 'mic', work: 'tv' },
  drama: { ep: '集', unit: '第 12 集', where: '某某卫视 · 每晚 20:00 两集连播', bs: '演员访谈', bsSub: '片场 · 主演', prop: 'clap', work: 'tv' },
  novel: { ep: '章', unit: '第三卷 · 第 41 章', where: '某某文库 · 连载中', bs: '作者的话', bsSub: '章末 · 作者', prop: 'ink', work: 'novel' },
  radio: { ep: '回', unit: '第 6 回', where: '某某放送 · 每周五深夜', bs: '声优感想', bsSub: '收录后 · 配音演员', prop: 'mic', work: 'radio' },
};

/* ---------- 桌上的东西（都是自己画的小 SVG，俯视角） ---------- */
const sv = (vb, d) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg">${d}</svg>`;
const WORK = {
  // 漫画单行本：两本叠着，上面那本深蓝封面、红色斜切色块、白色书名块；右侧和底边露出书页
  manga: sv('150 200', `<g transform="rotate(7 75 100)"><rect x="18" y="18" width="124" height="172" rx="3" fill="#1d2433"/><rect x="18" y="18" width="12" height="172" fill="#0f141f"/></g>
<rect x="10" y="8" width="128" height="178" rx="3" fill="#ece6d6"/><rect x="12" y="6" width="128" height="178" rx="3" fill="#f6f1e4"/>
<rect x="8" y="4" width="128" height="178" rx="3" fill="#24304a"/><rect x="8" y="4" width="14" height="178" fill="#141c2e"/>
<path d="M22 182V60l114-50v172z" fill="#c8323a"/><path d="M60 182V96l76-34v120z" fill="#e8454c" opacity=".9"/>
<circle cx="98" cy="118" r="30" fill="#f3e9d2"/><path d="M80 142c6-18 30-18 36 0z" fill="#24304a"/><circle cx="98" cy="110" r="12" fill="#24304a"/>
<rect x="24" y="14" width="30" height="86" rx="2" fill="#f6f1e4"/><text x="39" y="26" text-anchor="middle" font-size="12" font-weight="700" fill="#24304a" writing-mode="tb" style="letter-spacing:2px">雨停之前</text>
<rect x="100" y="150" width="30" height="26" rx="2" fill="#f6f1e4"/><text x="115" y="168" text-anchor="middle" font-size="15" font-weight="800" fill="#c8323a">3</text>
<rect x="8" y="4" width="128" height="178" rx="3" fill="url(#eye-gloss)"/>`),
  // 文库本：米白封面、腰封、红丝带书签
  novel: sv('150 200', `<rect x="12" y="10" width="124" height="176" rx="3" fill="#d9d0bc"/><rect x="14" y="8" width="124" height="176" rx="3" fill="#efe8d8"/>
<rect x="10" y="4" width="124" height="176" rx="3" fill="#f7f2e6"/><rect x="10" y="4" width="10" height="176" fill="#e4dccb"/>
<rect x="34" y="26" width="76" height="92" rx="2" fill="none" stroke="#8a7a62" stroke-width="1.2"/><path d="M40 100c14-28 30-40 64-50" fill="none" stroke="#b64a4a" stroke-width="2"/><circle cx="60" cy="70" r="8" fill="#b64a4a" opacity=".85"/>
<text x="72" y="140" text-anchor="middle" font-size="14" font-weight="700" fill="#2b2622" style="letter-spacing:3px">雨停之前</text><text x="72" y="156" text-anchor="middle" font-size="7.5" fill="#8a7a62" style="letter-spacing:2px">第 三 卷</text>
<rect x="10" y="150" width="124" height="30" fill="#b64a4a" opacity=".92"/><text x="72" y="169" text-anchor="middle" font-size="7" fill="#fff" style="letter-spacing:1.5px">累计 120 万部突破</text>
<path d="M118 4v70l-6-8-6 8V4z" fill="#c8323a"/><rect x="10" y="4" width="124" height="176" rx="3" fill="url(#eye-gloss)"/>`),
};
// 立着的：电视机（动画 / 电视剧）、收音机（广播剧）——面朝镜头
const STAND = {
  tv: sv('220 190', `<rect x="92" y="168" width="36" height="14" rx="3" fill="#2a2320"/><rect x="60" y="178" width="100" height="8" rx="4" fill="#1b1614"/>
<rect x="10" y="10" width="200" height="160" rx="18" fill="#3b2e28"/><rect x="14" y="14" width="192" height="152" rx="16" fill="#5a463c"/>
<rect x="26" y="24" width="150" height="128" rx="22" fill="#0d1a24"/><rect x="30" y="28" width="142" height="120" rx="20" fill="url(#eye-crt)"/>
<g clip-path="url(#eye-crt-clip)"><path d="M30 28h142v120H30z" fill="url(#eye-scan)" opacity=".35"/><path d="M40 120c30-30 60-10 90-40 20-20 30-20 42-26" fill="none" stroke="#ff6b6b" stroke-width="3" opacity=".8"/><circle cx="118" cy="78" r="18" fill="#ffd8b0" opacity=".9"/><path d="M100 110c6-20 30-20 36 0z" fill="#2a3a4a"/><text x="44" y="138" font-size="9" fill="#fff" opacity=".85" style="letter-spacing:1.5px">ON AIR · 第 8 集</text></g>
<rect x="30" y="28" width="142" height="120" rx="20" fill="url(#eye-gloss)"/>
<circle cx="190" cy="56" r="9" fill="#2a2320"/><circle cx="190" cy="56" r="6" fill="#d9c7a8"/><circle cx="190" cy="86" r="9" fill="#2a2320"/><circle cx="190" cy="86" r="6" fill="#d9c7a8"/><rect x="183" y="108" width="14" height="36" rx="3" fill="#2a2320"/><rect x="186" y="112" width="8" height="4" fill="#c8323a"/><rect x="186" y="120" width="8" height="4" fill="#d9c7a8"/><rect x="186" y="128" width="8" height="4" fill="#d9c7a8"/>
<path d="M60 10l-14-8M160 10l20-9" stroke="#7a6a60" stroke-width="2.5" stroke-linecap="round"/>`),
  radio: sv('220 150', `<rect x="70" y="138" width="80" height="8" rx="4" fill="#1b1614"/>
<rect x="12" y="20" width="196" height="118" rx="16" fill="#7a4a32"/><rect x="16" y="24" width="188" height="110" rx="14" fill="#a96b4a"/>
<rect x="30" y="38" width="88" height="80" rx="8" fill="#5a3a2a"/><path d="M34 42h80v72H34z" fill="url(#eye-mesh)"/>
<rect x="128" y="38" width="64" height="30" rx="6" fill="#f3e4bf"/><path d="M134 54h52" stroke="#8a6a3a" stroke-width="1"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${137 + i * 9} 46v12" stroke="#8a6a3a" stroke-width="1"/>`).join('')}<path d="M159 42v22" stroke="#c8323a" stroke-width="2"/>
<circle cx="146" cy="96" r="14" fill="#2a2320"/><circle cx="146" cy="96" r="10" fill="#e8d6b4"/><path d="M146 88v8" stroke="#2a2320" stroke-width="2"/><circle cx="180" cy="96" r="14" fill="#2a2320"/><circle cx="180" cy="96" r="10" fill="#e8d6b4"/><path d="M180 96l6-5" stroke="#2a2320" stroke-width="2"/>
<path d="M44 20V4" stroke="#d9c7a8" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="3" r="3" fill="#d9c7a8"/><circle cx="110" cy="30" r="3" fill="#ff5a5a"><animate attributeName="opacity" values="1;.3;1" dur="1.6s" repeatCount="indefinite"/></circle>`),
  // 布告栏：木框、软木、钉着便签 / 拍立得 / 剪报，顶上一块小牌子
  board: sv('320 210', `<rect x="4" y="14" width="312" height="190" rx="8" fill="#5e4330"/><rect x="12" y="22" width="296" height="174" rx="4" fill="#c69a68"/><rect x="12" y="22" width="296" height="174" rx="4" fill="url(#eye-cork)"/>
<rect x="118" y="2" width="84" height="22" rx="4" fill="#2a2320"/><text x="160" y="17" text-anchor="middle" font-size="11" fill="#f3e4bf" style="letter-spacing:3px">布告栏</text>
<g transform="rotate(-6 60 70)"><rect x="26" y="40" width="68" height="62" fill="#fde98a"/><path d="M34 56h50M34 68h40M34 80h46" stroke="#9c8530" stroke-width="2" stroke-linecap="round" opacity=".6"/></g><circle cx="60" cy="42" r="4.5" fill="#d9363e"/>
<g transform="rotate(5 150 80)"><rect x="112" y="44" width="76" height="80" fill="#fff"/><rect x="118" y="50" width="64" height="52" fill="#3b5a7a"/><path d="M118 102c10-20 30-26 64-20v20z" fill="#5a7a5a"/><circle cx="150" cy="70" r="9" fill="#ffd8b0"/></g><circle cx="150" cy="46" r="4.5" fill="#3a7bd5"/>
<g transform="rotate(8 250 72)"><rect x="214" y="38" width="76" height="68" fill="#f7cdd4"/><path d="M222 54h60M222 66h44M222 78h52M222 90h30" stroke="#b05060" stroke-width="2" stroke-linecap="round" opacity=".55"/></g><circle cx="252" cy="40" r="4.5" fill="#48b46e"/>
<g transform="rotate(-3 90 150)"><rect x="34" y="118" width="110" height="66" fill="#efe9dc"/><rect x="40" y="124" width="98" height="12" fill="#2a2320"/><text x="89" y="133.5" text-anchor="middle" font-size="8" fill="#fff" style="letter-spacing:1px">本周热议</text><path d="M42 146h94M42 154h80M42 162h94M42 170h60" stroke="#8a8070" stroke-width="1.6" opacity=".7"/></g><circle cx="88" cy="120" r="4.5" fill="#d9363e"/>
<g transform="rotate(4 230 150)"><rect x="176" y="120" width="106" height="60" fill="#bfe6d6"/><path d="M186 136h86M186 148h60M186 160h78" stroke="#2f7a60" stroke-width="2" stroke-linecap="round" opacity=".55"/><text x="268" y="172" text-anchor="end" font-size="9" fill="#2f7a60">+128</text></g><circle cx="230" cy="122" r="4.5" fill="#f0a830"/>
<path d="M30 30q130 28 260 0" stroke="#8a6a4a" stroke-width="1.2" fill="none" stroke-dasharray="3 3"/>`),
  // 桌牌：两面，观众席 / 作者
  badge: sv('130 48', `<path d="M6 46L22 6h86l16 40z" fill="#2a2320"/><rect x="18" y="8" width="94" height="30" rx="4" fill="#f3e4bf"/><rect x="18" y="8" width="94" height="6" rx="3" fill="#c8323a"/><text class="eye-badge-t" x="65" y="31" text-anchor="middle" font-size="13" font-weight="700" fill="#2a2320" style="letter-spacing:3px">观众席</text>`),
  // 台灯：绿色灯罩的银行灯
  lamp: sv('150 190', `<ellipse cx="75" cy="178" rx="40" ry="8" fill="#1b1614"/><rect x="40" y="160" width="70" height="18" rx="6" fill="#4a3a2a"/><rect x="70" y="70" width="10" height="92" fill="#6a5a3a"/>
<path d="M18 74q57-26 114 0v16H18z" fill="#2f6b4f"/><path d="M18 74q57-26 114 0" fill="none" stroke="#5fa37f" stroke-width="3"/><path d="M22 88h106v8H22z" fill="#1f4a36"/><rect x="60" y="54" width="30" height="20" rx="6" fill="#8a7a4a"/><circle cx="75" cy="52" r="6" fill="#d9c7a8"/>
<path d="M26 96q49 30 98 0" fill="#fff2c2" opacity=".55"/>`),
  // 玻璃罩里的红眼睛
  eye: sv('120 140', `<ellipse cx="60" cy="130" rx="46" ry="9" fill="#1b1614"/><rect x="18" y="112" width="84" height="18" rx="6" fill="#3a2d26"/><rect x="22" y="110" width="76" height="6" rx="3" fill="#5a463c"/>
<path d="M18 112V62a42 42 0 0 1 84 0v50z" fill="#120808"/><path d="M18 112V62a42 42 0 0 1 84 0v50z" fill="url(#eye-dome)"/>
<g class="eye-pupil"><path d="M26 72q34-36 68 0q-34 36-68 0z" fill="none" stroke="#ff2a2a" stroke-width="4.5" stroke-linejoin="round"/><circle cx="60" cy="72" r="13" fill="none" stroke="#ff2a2a" stroke-width="4.5"/><circle cx="60" cy="72" r="5" fill="#ff2a2a"/></g>
<path d="M30 56q10-18 30-20" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/><path d="M18 112V62a42 42 0 0 1 84 0v50z" fill="none" stroke="#fff" stroke-width="1.2" opacity=".25"/>`),
};
const PROP = {
  // 原稿 + 蘸水笔 + 墨水瓶
  ink: sv('200 150', `<g transform="rotate(-8 90 80)"><rect x="24" y="18" width="120" height="118" fill="#fbf7ee"/><rect x="34" y="28" width="46" height="40" fill="none" stroke="#9aa" stroke-width="1"/><rect x="86" y="28" width="48" height="40" fill="none" stroke="#9aa" stroke-width="1"/><rect x="34" y="74" width="100" height="52" fill="none" stroke="#9aa" stroke-width="1"/><path d="M40 60c10-20 24-18 34-4M92 36c14 10 26 24 38 8M44 118c20-24 44-30 84-14" fill="none" stroke="#2a2320" stroke-width="2"/><path d="M98 48l6-6" stroke="#c8323a" stroke-width="3" stroke-linecap="round"/></g>
<rect x="138" y="86" width="44" height="52" rx="8" fill="#1d2433"/><rect x="146" y="78" width="28" height="14" rx="3" fill="#0f141f"/><rect x="144" y="100" width="32" height="24" rx="2" fill="#f3e4bf"/><text x="160" y="116" text-anchor="middle" font-size="9" fill="#1d2433">INK</text>
<g transform="rotate(32 110 110)"><rect x="60" y="106" width="100" height="8" rx="4" fill="#3a2d26"/><path d="M160 110l14-4v8z" fill="#d9c7a8"/><path d="M174 110l10-1-10-2z" fill="#9a9a9a"/></g>`),
  // 台本 + 立式麦克风
  mic: sv('200 150', `<g transform="rotate(6 90 80)"><rect x="24" y="20" width="118" height="112" rx="3" fill="#e8e2d4"/><rect x="28" y="16" width="118" height="112" rx="3" fill="#f6f1e6"/><rect x="28" y="16" width="118" height="22" fill="#2a2320"/><text x="87" y="31" text-anchor="middle" font-size="9" fill="#f3e4bf" style="letter-spacing:3px">台 本</text><path d="M40 54h92M40 66h70M40 78h92M40 90h56M40 102h86M40 114h64" stroke="#8a8070" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><path d="M60 66h40" stroke="#f0a830" stroke-width="7" opacity=".5"/></g>
<circle cx="152" cy="104" r="30" fill="#1b1614"/><rect x="122" y="104" width="60" height="30" rx="6" fill="#2a2320"/><circle cx="152" cy="100" r="22" fill="#3a3a44"/><circle cx="152" cy="100" r="22" fill="url(#eye-mesh)"/><circle cx="152" cy="100" r="8" fill="#c8323a" opacity=".9"/><path d="M152 134v10" stroke="#d9c7a8" stroke-width="4"/>`),
  // 场记板
  clap: sv('200 150', `<g transform="rotate(-10 100 80)"><rect x="30" y="54" width="140" height="80" rx="4" fill="#1b1614"/><rect x="38" y="70" width="124" height="56" fill="#2a2320"/><path d="M46 84h40M46 98h60M46 112h30M110 84h44M110 98h44M110 112h44" stroke="#f3e4bf" stroke-width="1.6" opacity=".7"/><text x="70" y="124" font-size="7" fill="#f3e4bf" opacity=".7">SCENE 12</text><text x="118" y="124" font-size="7" fill="#f3e4bf" opacity=".7">TAKE 3</text>
<g transform="rotate(-14 30 54)"><rect x="30" y="36" width="140" height="18" rx="3" fill="#f3e4bf"/><path d="M30 36h140v18H30z" fill="url(#eye-stripe)"/></g><rect x="30" y="52" width="140" height="8" fill="#f3e4bf"/><path d="M30 52h140v8H30z" fill="url(#eye-stripe)"/></g>`),
};
const defs = `<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="eye-gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
<radialGradient id="eye-crt" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#2a4a66"/><stop offset="1" stop-color="#0b1824"/></radialGradient>
<radialGradient id="eye-dome" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ff5a5a" stop-opacity=".22"/><stop offset=".6" stop-color="#3a0a0a" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
<pattern id="eye-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#fff"/></pattern>
<pattern id="eye-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.2" fill="#000" opacity=".5"/></pattern>
<pattern id="eye-cork" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="1.1" fill="#9c7448" opacity=".55"/><circle cx="6.5" cy="7" r=".9" fill="#e0bb8a" opacity=".5"/></pattern>
<pattern id="eye-stripe" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="24" fill="#1b1614"/></pattern>
<clipPath id="eye-crt-clip"><rect x="30" y="28" width="142" height="120" rx="20"/></clipPath>
</defs></svg>`;

/* ---------- 布局：桌子 600×520，坐标是桌面上的位置；stand 的立在桌上 ---------- */
// 每件东西的镜头参数：rx 俯角、s 推近倍数、dy 画面里往上提多少
const OBJS = {
  lamp: { x: 132, y: 62, w: 150, h: 190, stand: 1 },
  board: { x: 318, y: 4, w: 320, h: 210, stand: 1, rx: 64, s: 1.3, dy: 40, tap: 1 },
  eye: { x: 452, y: 150, w: 120, h: 140, stand: 1, rx: 62, s: 2.2, dy: 30, tap: 1 },
  work: { x: 196, y: 300, w: 150, h: 200, r: -6, rx: 56, s: 1.9, dy: 50, tap: 1 },
  prop: { x: 404, y: 372, w: 200, h: 150, r: 4, rx: 56, s: 1.9, dy: 40, tap: 1 },
  badge: { x: 176, y: 520, w: 130, h: 48, stand: 1, rx: 64, s: 2.4, dy: 30, tap: 1 },
  cup: { x: 486, y: 536, w: 72, h: 72 },
  phone: { x: 356, y: 592, w: 74, h: 144, r: 22 },
};
const CAM0 = { rx: 56, s: .9, tx: 0, ty: 0, dy: 0 };
const cup = sv('72 72', `<ellipse cx="36" cy="40" rx="30" ry="29" fill="#2a2320" opacity=".35"/><circle cx="34" cy="36" r="27" fill="#efe8da"/><circle cx="34" cy="36" r="21" fill="#d9c7a8"/><circle cx="34" cy="36" r="18" fill="#7a4a2a"/><ellipse cx="30" cy="32" rx="9" ry="5" fill="#fff" opacity=".25"/><path d="M60 30a8 8 0 0 1 0 14" fill="none" stroke="#efe8da" stroke-width="6"/><g class="eye-steam"><path d="M26 14q4-6 0-12M36 12q4-6 0-12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/></g>`);
const phone = sv('74 144', `<rect x="4" y="4" width="66" height="136" rx="14" fill="#1b1716"/><rect x="8" y="8" width="58" height="128" rx="11" fill="#0b0a0a"/><rect x="8" y="8" width="58" height="128" rx="11" fill="url(#eye-gloss)"/><rect x="26" y="12" width="22" height="5" rx="2.5" fill="#1b1716"/><rect x="14" y="30" width="46" height="16" rx="5" fill="#1f1a1a"/><circle cx="20" cy="38" r="3" fill="#ff3b3b"/><path d="M27 36h22M27 41h14" stroke="#6a5a52" stroke-width="1.6" stroke-linecap="round"/>`);
const dust = () => [...Array(14)].map((_, i) => `<i class="eye-dust" style="--i:${i};left:${(i * 37 + 11) % 100}%;top:${(i * 53 + 7) % 100}%;animation-delay:${-(i * 1.7) % 9}s"></i>`).join('');

const objEl = (k, html) => { const o = OBJS[k]; return `<div class="eo ${o.stand ? 'stand' : ''} ${o.tap ? 'tap' : ''} eo-${k}" ${o.tap ? `data-a="eo" data-x="${k}"` : ''} style="--x:${o.x}px;--y:${o.y}px;--w:${o.w}px;--h:${o.h}px;--r:${o.r || 0}deg">${html}</div>`; };
function scene() {
  const f = FM[ST().form], role = ST().role;
  const work = f.work == 'manga' || f.work == 'novel' ? WORK[f.work] : STAND[f.work].replace('第 8 集', f.unit.split(' · ').pop());
  OBJS.work.stand = f.work == 'tv' || f.work == 'radio' ? 1 : 0; OBJS.work.r = OBJS.work.stand ? 0 : -6;
  if (OBJS.work.stand) { OBJS.work.w = f.work == 'tv' ? 220 : 220; OBJS.work.h = f.work == 'tv' ? 190 : 150; OBJS.work.x = 196; OBJS.work.y = 330; OBJS.work.rx = 64; OBJS.work.s = 1.5; } else { OBJS.work.w = 150; OBJS.work.h = 200; OBJS.work.x = 196; OBJS.work.y = 300; OBJS.work.rx = 56; OBJS.work.s = 1.9; }
  return `${defs}<div class="eye-world" style="--rx:${CAM0.rx}deg;--s:${CAM0.s};--tx:0px;--ty:0px;--dy:0px">
<div class="eye-desk"><i class="eye-grain"></i><i class="eye-light"></i>
<div class="eye-sheet" style="--x:236px;--y:336px;--r:14deg"></div><div class="eye-sheet s2" style="--x:300px;--y:470px;--r:-9deg"></div>
${objEl('lamp', STAND.lamp)}${objEl('board', STAND.board)}${objEl('eye', STAND.eye)}${objEl('work', work)}${objEl('prop', PROP[f.prop])}${objEl('badge', STAND.badge.replace('观众席', role == 'author' ? '作 者' : '观众席'))}${objEl('cup', cup)}${objEl('phone', phone)}
</div></div>${dust()}`;
}

/* ---------- 底下浮出来的玻璃卡（样例内容） ---------- */
function card(k) {
  const st = ST(), f = FM[st.form];
  const C = {
    work: { k: `${FN[st.form]} · ${f.unit}`, t: '雨停之前', m: `${f.where} · 今天更新`, b: '这一' + f.ep + '里，万事屋的雨一直没停。银时把最后一把伞借给了来委托的人，自己在屋檐下坐到天黑。神乐问他在等谁，他说在等雨停。', a: [['本' + f.ep + '介绍', 'ep'], ['刷新本期', 'gen']] },
    board: { k: '布告栏 · 论坛', t: '追更区 · 今日 128 帖', m: '热帖 3 · 新回复 41', list: [['银时党', '所以伞到底借给谁了？？第 27 话细节考据', 56], ['路过的编辑', '这周画风崩了吧，作者是不是赶稿', 23], ['雨停了吗', '万事屋三人组同框！！！（泪目）', 118]], a: [['进入论坛', 'forum'], ['我也发一帖', 'post']] },
    prop: { k: `幕后 · ${f.bs}`, t: f.bsSub, m: '本' + f.ep + ' · 2 条', b: f.prop == 'ink' ? '这一话画到最后一页的时候外面真的在下雨。借伞那个分镜改了四次，责编说第一版太温柔了，不像他。' : '录那段屋檐下的戏的时候，导演让我什么都别说，只呼吸。后来回放，我自己也沉默了很久。', a: [['看全文', 'bs']] },
    badge: { k: '身份', t: st.role == 'author' ? '作者' : '观众席', m: st.role == 'author' ? '以作者本人的身份发言 · 读者会认出你' : '以普通读者的身份逛论坛 · 用自己的马甲发帖', b: '', a: [[st.role == 'author' ? '切回观众席' : '切换为作者', 'role']] },
    eye: { k: '窥探之眼', t: '高维视角', m: `上次窥视：${f.unit} · 2 小时前`, b: '从这里往下看，剧情是一部正在连载的作品。刷新一次，就把最新的进度翻到这个世界里来。', a: [['刷新本期', 'gen']] },
  }[k];
  return `<div class="eye-card" data-eye-card="${k}"><i class="eye-grab"></i><small>${C.k}</small><b>${C.t}</b><em>${C.m}</em>${C.b ? `<p>${C.b}</p>` : ''}${C.list ? `<div class="eye-posts">${C.list.map(([u, t, n]) => `<div><span>${u}</span><b>${t}</b><small>${n}</small></div>`).join('')}</div>` : ''}<div class="eye-acts">${C.a.map(([l, a]) => `<button data-a="eact" data-x="${a}">${l}<i>›</i></button>`).join('')}</div></div>`;
}

/* ---------- 镜头 ---------- */
let focused = '';
function cam(el, k) {
  const w = $('.eye-world', el), st = $('.eye-stage', el); if (!w) return;
  focused = k; st.classList.toggle('zoom', !!k);
  const o = k ? OBJS[k] : null, c = o ? { rx: o.rx, s: o.s, tx: 300 - o.x, ty: 300 - (o.stand ? o.y - o.h * .35 : o.y), dy: -(o.dy || 0) } : CAM0;
  w.style.setProperty('--rx', c.rx + 'deg'); w.style.setProperty('--s', c.s); w.style.setProperty('--tx', c.tx + 'px'); w.style.setProperty('--ty', c.ty + 'px'); w.style.setProperty('--dy', c.dy + 'px');
  $$('.eo', el).forEach(e => e.classList.toggle('on', e.classList.contains('eo-' + k)));
  $('.eye-card', el)?.remove(); $('.eye-top .eye-back', el)?.classList.toggle('show', !!k);
  if (k) { st.insertAdjacentHTML('beforeend', card(k)); requestAnimationFrame(() => $('.eye-card', el)?.classList.add('in')); }
}
function mount(el) {
  const st = $('.eye-stage', el); if (!st || st._eye) return; st._eye = 1;
  // 卡片往下一拖就收起
  let y0 = 0; st.addEventListener('pointerdown', e => { const c = e.target.closest('.eye-card'); y0 = c ? e.clientY : 0; });
  st.addEventListener('pointerup', e => { if (y0 && e.clientY - y0 > 40) cam(el, ''); y0 = 0; });
}

const body = () => { const st = ST(); return `<div class="eye-stage ${focused ? 'zoom' : ''}">${scene()}
<div class="eye-top"><b class="eye-back ${focused ? 'show' : ''}" data-a="eback">‹ 回到桌面</b><div class="eye-forms">${FORMS.map(([k, n]) => `<span class="${st.form == k ? 'on' : ''}" data-a="eform" data-x="${k}">${n}</span>`).join('')}</div></div>
<div class="eye-brand"><i></i><span>窥探之眼</span><small>${FN[st.form]} · ${FM[st.form].unit}</small></div></div>`; };

reg({
  id: 'eye', name: '窥探之眼',
  icon: '<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="#000"/><path d="M4 12q8-9 16 0q-8 9-16 0z" fill="none" stroke="#ff2a2a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#ff2a2a" stroke-width="1.8"/><circle cx="12" cy="12" r="1.4" fill="#ff2a2a"/></svg>',
  open: () => { css(); focused = ''; return page({ title: '', cls: 'eye-pg', noBack: 1, body, after: mount, acts: {
    eo: (k, t, e, pg) => cam(pg.el, focused == k ? '' : k),
    eback: (x, t, e, pg) => cam(pg.el, ''),
    eform: (k, t, e, pg) => { ST().form = k; save(); focused = ''; pg.re(); },
    eact: (a, t, e, pg) => { if (a == 'role') { ST().role = ST().role == 'author' ? 'viewer' : 'author'; save(); pg.re(); return; } toast('还没接上，先看样子'); },
  } }); },
});
