// 小手机 · 内置锁屏「素色」：不用图片、不加载素材，一层很慢呼吸的深色渐变（内置的「雪夜」已经删掉，想要好看的锁屏用 主题 → 锁屏 → 自定义）
// 以后定了开屏 / 锁屏的统一概念，新场景照这个格式加进 FX：{ ink, shade, fps, init(W,H,dpr) → 状态, draw(ctx,t,dt,W,H,状态), input?, stop? }
export const SCENES = [['plain', '素色']];
const plain = {
  ink: '#ffffff', shade: 'rgba(0,0,0,.35)', dpr: 1, fps: 12, interactive: false,
  init: () => ({}),
  draw(x, t, dt, W, H) { const b = (Math.sin(t / 6) + 1) / 2, g = x.createLinearGradient(0, 0, W * .3, H);
    g.addColorStop(0, `hsl(${228 + b * 8} 28% ${13 + b * 2}%)`); g.addColorStop(.55, `hsl(${262 + b * 6} 20% 11%)`); g.addColorStop(1, `hsl(${300 - b * 6} 18% ${9 + b}%)`);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = x.createRadialGradient(W * (.3 + b * .1), H * .28, 0, W * .3, H * .28, Math.max(W, H) * .6); r.addColorStop(0, 'rgba(170,180,255,.10)'); r.addColorStop(1, 'rgba(170,180,255,0)');
    x.fillStyle = r; x.fillRect(0, 0, W, H); },
};
export const FX = { plain };
export const sceneInk = k => FX[k] ? { ink: FX[k].ink, shade: FX[k].shade } : { ink: '#fff', shade: 'rgba(0,0,0,.4)' };
export const sceneKey = k => FX[k] ? k : SCENES[0][0]; // 以前选的「雪夜」等旧场景：自动换成素色
export const preloadScene = () => { }; // 素色不用下载素材

// 挂载到 canvas：自动适配尺寸 / 像素比，页面隐藏时暂停；opts.fps 限帧（小预览用），opts.t 起始时间（截图用）
// 返回的 input(type, clientX, clientY) 把手指交给场景（返回 true 表示场景用掉了这次触摸）
export function mountScene(cv, key, opts = {}) {
  const S = FX[sceneKey(key)], ctx = cv.getContext('2d'); let W = 0, H = 0, st, raf, last = 0, acc = 0, dead = 0, t = opts.t || 0;
  const lite = document.getElementById('stp')?.classList.contains('lite'); // 流畅模式：锁屏特效画得粗一点、帧数低一点
  const dpr = Math.min(opts.dpr || globalThis.devicePixelRatio || 1, S.dpr || (lite ? 1.25 : 2)), step = 1 / Math.min(opts.fps || 60, S.fps || (lite ? 40 : 60));
  const size = () => { const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height; if (w == W && h == H && st) return; st && S.stop?.(st); W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st = S.init(W, H, dpr); };
  const frame = dt => { size(); t += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); S.draw(ctx, t, dt, W, H, st); };
  let shown = 0; // 上一帧是否在屏幕上；刚变可见时立刻画，不等节流
  const loop = now => { if (dead) return; raf = requestAnimationFrame(loop); const dt = last ? Math.min(.1, (now - last) / 1e3) : 0; last = now; if (document.hidden || !cv.isConnected || opts.active && !opts.active() || !cv.clientWidth) return shown = 0; acc += dt; if (shown && acc < step * .9) return; frame(shown ? Math.min(.05, acc) : 0); acc = 0; shown = 1; };
  cv.clientWidth && frame(0); // 挂上就先画一帧，不等下一次刷新
  raf = requestAnimationFrame(loop);
  return {
    interactive: !!S.interactive && !opts.fps, hint: S.hint || '',
    input(type, cx, cy) { if (!st || !S.input) return false; const r = cv.getBoundingClientRect(); return !!S.input(st, type, (cx - r.left) * W / (r.width || 1), (cy - r.top) * H / (r.height || 1)); },
    stop() { dead = 1; cancelAnimationFrame(raf); st && S.stop?.(st); },
    advance(sec, n = 1) { for (let i = 0; i < n; i++) frame(sec / n); }, state: () => st,
  };
}
