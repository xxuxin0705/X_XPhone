// 输入语言圆盘：上/右/下/左四个位置，拖动松手选择，点击也能用。只修改输入语言。
export const INPUT_LANGS = [['zh-CN', '中文'], ['ja-JP', '日语'], ['en-US', '英语'], ['keyboard', '键盘']];
export const inputName = id => INPUT_LANGS.find(x => x[0] === id)?.[1] || '中文';
export const defaultInputs = ['zh-CN', 'ja-JP', 'en-US', 'keyboard'];
export function dialDirection(dx, dy) { if (Math.hypot(dx, dy) < 24) return -1; return (Math.round(Math.atan2(dx, -dy) / (Math.PI / 2)) + 4) % 4; }
export function inputDial(root, options) {
  let wheel = null, origin = null, selected = -1, capture = null, suppressClick = 0;
  const close = () => { wheel?.remove(); wheel = null; origin = null; selected = -1; if (capture) { try { capture.el.releasePointerCapture(capture.id); } catch {} capture = null; } };
  function open() {
    close(); wheel = Object.assign(document.createElement('div'), { className: 'xcl-dial phone-gesture-control', role: 'group', ariaLabel: '输入语言' });
    const fav = options.favorites(); wheel.innerHTML = fav.map((l, i) => `<button type="button" data-direction="${i}" class="xcl-choice xcl-${i}" aria-pressed="${options.current() === l}">${inputName(l)}</button>`).join('') + '<button type="button" class="xcl-edit">常用语言</button>';
    root.append(wheel); wheel.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.direction != null) { const lang = options.favorites()[+b.dataset.direction]; close(); options.choose(lang); } else { close(); await options.edit(); } };
  }
  const down = e => { const b = e.target.closest('[data-k="inl"]'); if (!b || e.button > 0) return; e.preventDefault(); open(); origin = { x: e.clientX, y: e.clientY }; capture = { el: root, id: e.pointerId }; root.setPointerCapture(e.pointerId); };
  const move = e => { if (!origin) return; selected = dialDirection(e.clientX - origin.x, e.clientY - origin.y); wheel.querySelectorAll('[data-direction]').forEach((b, i) => b.classList.toggle('xcl-selected', i === selected)); };
  const up = () => { if (!origin) return; const direction = selected; suppressClick = Date.now() + 400; origin = null; if (capture) { try { capture.el.releasePointerCapture(capture.id); } catch {} capture = null; } if (direction >= 0) { suppressClick = Date.now() + 400; const lang = options.favorites()[direction]; close(); options.choose(lang); } };
  const click = e => { if (Date.now() < suppressClick && (e.target === root || e.target.closest('[data-k="inl"]'))) { e.stopPropagation(); return; } if (e.target.closest('[data-k="inl"]')) { e.stopPropagation(); if (Date.now() < suppressClick) return; if (!wheel) open(); } else if (wheel && !wheel.contains(e.target)) close(); };
  const key = e => { if (e.key === 'Escape') close(); };
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', close); root.addEventListener('click', click, true); root.addEventListener('keydown', key);
  return { close, destroy() { close(); root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', close); root.removeEventListener('click', click, true); root.removeEventListener('keydown', key); } };
}
