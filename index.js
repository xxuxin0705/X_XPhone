// 小手机 · 入口：外壳 / 悬浮窗 / 魔法棒 / 酒馆事件
import { C, S, ui, G, $, on, emit, initS, bind, save, home, top, hm, now, scanTime, syncInject, gc } from './core.js';
import { relock, unlock, isLocked } from './lock.js';
import { preloadScene } from './lockfx.js';
import { applyBall } from './ball.js';
import { randWall } from './apps/theme/theme.js';
import { renderDesk, initDesk, tickDesk } from './desk.js';
import { openChat, syncStory, inlineSync } from './apps/chat/chat.js';
import './apps/settings/settings.js';
import { initMusic } from './apps/music/music.js';
import './apps/isle/isle.js';
import './apps/street/street.js';
import { applyTheme } from './apps/theme/theme.js';

const SB = `<b class="sb-t"></b><span class="isl"></span><span class="sb-r"><svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" width="3" height="11" rx="1"/></svg>5G<i class="bat"></i><b class="off" data-a="off" title="关机"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v8M6.6 6.6a8 8 0 1 0 10.8 0"/></svg></b></span>`;
const mobile = () => matchMedia('(max-width:520px)').matches;
const place = (el, x, y) => { const r = el.getBoundingClientRect(); Object.assign(el.style, { left: Math.max(0, Math.min(innerWidth - r.width, x)) + 'px', top: Math.max(0, Math.min(innerHeight - r.height, y)) + 'px', right: 'auto', bottom: 'auto' }); };
function drag(el, h, key, tap) {
  h.addEventListener('pointerdown', e => {
    if (el == ui.root && mobile()) return; const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; let mv = 0;
    const m = ev => { if (!mv && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) return; mv = 1; place(el, ev.clientX - dx, ev.clientY - dy); };
    const u = () => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); mv ? (S.pos[key] = [el.offsetLeft, el.offsetTop], save()) : tap?.(); };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  });
}
const pos = () => [[ui.root, 'win'], [$('#stp-ball'), 'ball']].forEach(([el, k]) => { el.style.left = el.style.top = el.style.right = el.style.bottom = ''; S.pos[k] && place(el, ...S.pos[k]); });
// 收起手机 = 熄屏：开了锁屏的话，下次打开先看到锁屏
const toggle = v => { ui.root.classList.contains('warm') && ui.root.classList.remove('warm', 'on'); const was = ui.root.classList.contains('on'); if (ui.root.classList.toggle('on', v ?? !was)) { was || (relock(), emit('phone-open')); $('#stp-ball').classList.remove('dot'); $('.sb-t', ui.root).textContent = hm(now()); setTimeout(() => { tick(); ui.scr.classList.add('peek'); }, 520); } /* 打开动画放完就把锁屏底下的桌面先画好，上滑时不用临时画 */ else was && setTimeout(() => { if (ui.root.classList.contains('on')) return; relock(true); randWall(); setTimeout(() => prewarm(false), 200); }, 320); }; // 打开时不在动画里重画桌面；随机壁纸在收起时就换好 // 等收起动画结束再把锁屏重置好、画好
// 预热：把手机里要用的图片（壁纸、锁屏、图标、组件照片）提前解码好，再在看不见的状态下把手机整个画一遍，
// 第一次点开时就不用现场解码大图、现场画桌面；心屿的 3D 也顺手预热。收起手机换了随机壁纸 / 锁屏后再解码一次新图
const urlsIn = root => { const u = new Set(); root.querySelectorAll('img').forEach(i => i.currentSrc && u.add(i.currentSrc)); [root, ...root.querySelectorAll('.stp-scr,.lock,.lk-bg,.desk,.it,.ico,.ccd-bg')].forEach(n => String(getComputedStyle(n).backgroundImage).replace(/url\(["']?([^"')]+)["']?\)/g, (_, x) => u.add(x))); return [...u].filter(x => !x.startsWith('data:image/svg')); };
async function prewarm(paint) {
  try {
    await Promise.all(urlsIn(ui.root).slice(0, 80).map(src => { const i = new Image(); i.decoding = 'async'; i.src = src; return i.decode().catch(() => { }); }));
    if (!paint || ui.root.classList.contains('on')) return;
    ui.root.classList.add('warm', 'on'); ui.scr.classList.add('peek'); tick(true); emit('phone-open');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))));
    if (ui.root.classList.contains('warm')) { ui.root.classList.remove('on'); requestAnimationFrame(() => ui.root.classList.remove('warm')); }
  } catch (e) { console.warn('[小手机] 预热失败', e); }
}
let lastT = ''; // 分钟变了才动；平时只改时间组件上的字（tickDesk），换聊天 / 改设置时才整桌重画
function tick(force) { const t = hm(now()); $('.sb-t', ui.root).textContent = t; if (!ui.root.classList.contains('on') || ui.desk.classList.contains('edit') || (t == lastT && force !== true)) return; lastT = t; force === true ? renderDesk() : tickDesk(); }
// 流畅模式：安卓 WebView（TauriTavern 这类 App 里）显卡弱，毛玻璃 / 液态玻璃每一帧都要重算，最卡。
// 自动识别到就关掉这些效果（换成半透明白底），设置 → 显示方式里也能手动选
const WEAK = /; wv\)|Tauri/i.test(navigator.userAgent) || !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
const lite = () => S.perf == 'lite' || (S.perf != 'full' && WEAK);
function show() {
  ui.root.classList.toggle('lite', lite());
  $('#stp-ball').hidden = S.show != 'float'; applyBall(); $('#stp-wand')?.remove(); ui.root.style.setProperty('--sc', 1); ui.root.style.setProperty('--fz', .92 * (S.fzp ?? 100) / 100); // 字体：100% = 原来的默认大小
  if (S.show != 'wand') return;
  $('#extensionsMenu')?.insertAdjacentHTML('beforeend', '<div id="stp-wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0"><div class="fa-solid fa-mobile-screen-button extensionsMenuExtensionButton"></div><span>小手机</span></div>');
  $('#stp-wand')?.addEventListener('click', () => toggle());
}

function init() {
  initS(); initMusic(); // 音乐要读真正的设置（喜欢、队列、音量），所以放在 initS 之后
  document.body.insertAdjacentHTML('beforeend', `<div id="stp"><div class="stp-scr"><div class="sb">${SB}</div><div class="desk"></div><div class="stack"></div><div class="sheets"></div><div class="lock" hidden></div><div class="tasks"></div><div class="hb" data-a="home"></div></div></div><div id="stp-ball"></div><style id="stp-css"></style>`);
  Object.assign(ui, { root: $('#stp'), scr: $('#stp .stp-scr'), desk: $('#stp .desk'), stack: $('#stp .stack'), sheets: $('#stp .sheets'), tasks: $('#stp .tasks'), lock: $('#stp .lock') });
  G.home = () => top() ? home() : toggle(false);
  G.off = () => { home(); toggle(false); };
  bind(ui.root); applyTheme(); initDesk(); show(); pos();
  drag(ui.root, $('#stp .sb'), 'win'); drag($('#stp-ball'), $('#stp-ball'), 'ball', () => toggle());
  ui.sheets.addEventListener('click', e => e.target == ui.sheets && ui.sheets.lastElementChild?._pg.close());
  on('cfg', k => { k.startsWith('lock.on') && !S.lock.on && isLocked() && unlock(); /^(show|scale|fz|perf)/.test(k) && show(); /^(perf|style)$/.test(k) && renderDesk(); /^(theme|wall|css)/.test(k) && applyTheme(); k == 'pos' && pos(); k == 'time' && tick(true); });
  on('open-chat', id => { toggle(true); openChat(id); });
  on('home', () => randWall());
  on('badge', () => ui.root.classList.contains('on') || $('#stp-ball').classList.add('dot'));
  const c = C(), E = c.eventTypes || c.event_types;
  c.eventSource.on(E.CHAT_CHANGED, () => { home(); renderDesk(); syncInject(); tick(true); setTimeout(() => gc(), 800); });
  E.CHAT_DELETED && c.eventSource.on(E.CHAT_DELETED, name => gc(new Set(), String(name).replace(/\.jsonl$/, ''))); // 整个聊天被删：它独占的图片也删掉
  E.GROUP_CHAT_DELETED && c.eventSource.on(E.GROUP_CHAT_DELETED, name => gc(new Set(), String(name).replace(/\.jsonl$/, '')));
  // 只对 AI 正常生成的新回复做处理：打开聊天时的开场白、切换 swipe、扩展 / 指令插入的消息都不算
  c.eventSource.on(E.MESSAGE_RECEIVED, (id, type) => {
    const m = C().chat?.[id]; if (!m || m.is_user || m.is_system) return;
    S.inline && inlineSync(id); // 正文里带的 <手机> 块：本地解析，不调 API
    if (type && type != 'normal') return; scanTime(m.mes); S.scan && new RegExp(S.kw).test(m.mes) && syncStory(m.mes); // 旧的「额外调 API 同步」默认关闭
  });
  S.lock.on && !/^[cb]:/.test(String(S.lock.wp)) && preloadScene(S.lock.wp); // 锁屏要用的图先下载好，打开时不会先黑一下
  setInterval(tick, 3e4); tick(); syncInject(); relock();
  setTimeout(() => (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => prewarm(true), { timeout: 3000 }), 1200); // 酒馆加载完就在后台把小手机预热好
  // 锁屏时钟字体（加载不到就用系统衬线体）
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&display=swap">');
}
typeof jQuery == 'function' ? jQuery(init) : init();
