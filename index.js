// 小手机 · 入口：外壳 / 悬浮窗 / 魔法棒 / 酒馆事件
import { C, S, ui, G, $, on, initS, bind, save, home, top, hm, now, scanTime, syncInject, gc } from './core.js';
import { relock, unlock, isLocked } from './lock.js';
import { renderDesk, initDesk } from './desk.js';
import { openChat, syncStory, inlineSync } from './apps/chat/chat.js';
import './apps/settings/settings.js';
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
const toggle = v => { const was = ui.root.classList.contains('on'); if (ui.root.classList.toggle('on', v ?? !was)) { was || relock(); $('#stp-ball').classList.remove('dot'); tick(); } else relock(); };
function tick() { $('.sb-t', ui.root).textContent = hm(now()); ui.root.classList.contains('on') && !ui.desk.classList.contains('edit') && renderDesk(); }
function show() {
  $('#stp-ball').hidden = S.show != 'float'; $('#stp-wand')?.remove(); ui.root.style.setProperty('--sc', S.scale || 1); ui.root.style.setProperty('--fz', S.fz || .92);
  if (S.show != 'wand') return;
  $('#extensionsMenu')?.insertAdjacentHTML('beforeend', '<div id="stp-wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0"><div class="fa-solid fa-mobile-screen-button extensionsMenuExtensionButton"></div><span>小手机</span></div>');
  $('#stp-wand')?.addEventListener('click', () => toggle());
}

function init() {
  initS();
  document.body.insertAdjacentHTML('beforeend', `<div id="stp"><div class="stp-scr"><div class="sb">${SB}</div><div class="desk"></div><div class="stack"></div><div class="sheets"></div><div class="lock" hidden></div><div class="tasks"></div><div class="hb" data-a="home"></div></div></div><div id="stp-ball"></div><style id="stp-css"></style>`);
  Object.assign(ui, { root: $('#stp'), scr: $('#stp .stp-scr'), desk: $('#stp .desk'), stack: $('#stp .stack'), sheets: $('#stp .sheets'), tasks: $('#stp .tasks'), lock: $('#stp .lock') });
  G.home = () => top() ? home() : toggle(false);
  G.off = () => { home(); toggle(false); };
  bind(ui.root); applyTheme(); initDesk(); show(); pos();
  drag(ui.root, $('#stp .sb'), 'win'); drag($('#stp-ball'), $('#stp-ball'), 'ball', () => toggle());
  ui.sheets.addEventListener('click', e => e.target == ui.sheets && ui.sheets.lastElementChild?._pg.close());
  on('cfg', k => { k.startsWith('lock.on') && !S.lock.on && isLocked() && unlock(); /^(show|scale|fz)/.test(k) && show(); /^(theme|wall|css)/.test(k) && applyTheme(); k == 'pos' && pos(); k == 'time' && tick(); });
  on('open-chat', id => { toggle(true); openChat(id); });
  on('badge', () => ui.root.classList.contains('on') || $('#stp-ball').classList.add('dot'));
  const c = C(), E = c.eventTypes || c.event_types;
  c.eventSource.on(E.CHAT_CHANGED, () => { home(); renderDesk(); syncInject(); tick(); setTimeout(() => gc(), 800); });
  E.CHAT_DELETED && c.eventSource.on(E.CHAT_DELETED, name => gc(new Set(), String(name).replace(/\.jsonl$/, ''))); // 整个聊天被删：它独占的图片也删掉
  E.GROUP_CHAT_DELETED && c.eventSource.on(E.GROUP_CHAT_DELETED, name => gc(new Set(), String(name).replace(/\.jsonl$/, '')));
  // 只对 AI 正常生成的新回复做处理：打开聊天时的开场白、切换 swipe、扩展 / 指令插入的消息都不算
  c.eventSource.on(E.MESSAGE_RECEIVED, (id, type) => {
    const m = C().chat?.[id]; if (!m || m.is_user || m.is_system) return;
    S.inline && inlineSync(id); // 正文里带的 <手机> 块：本地解析，不调 API
    if (type && type != 'normal') return; scanTime(m.mes); S.scan && new RegExp(S.kw).test(m.mes) && syncStory(m.mes); // 旧的「额外调 API 同步」默认关闭
  });
  setInterval(tick, 3e4); tick(); syncInject(); relock();
  // 锁屏时钟字体（加载不到就用系统衬线体）
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&display=swap">');
}
typeof jQuery == 'function' ? jQuery(init) : init();
