// 小手机 · 悬浮窗图标：12 个小手机造型（照片抠图），在「主题美化」里选，设置里也能看当前用的、点进去换
import { S, save, esc, sheet, toast } from './core.js';
export const BALLS = [['sprout', '森林小芽'], ['candy', '糖果'], ['ocean', '海洋'], ['sunny', '向日葵'], ['neon', '霓虹'], ['iphone', 'iPhone'],
  ['palace', '古风'], ['jade', '仙侠'], ['witch', '魔法'], ['steam', '蒸汽朋克'], ['retro', '复古游戏机'], ['autumn', '秋日']];
export const ballKey = () => BALLS.some(b => b[0] == S.ball) ? S.ball : BALLS[0][0];
export const ballName = (k = ballKey()) => BALLS.find(b => b[0] == k)?.[1] || '';
export const ballUrl = (k = ballKey()) => new URL(`./assets/ball/${k}.webp`, import.meta.url).href;
// 换悬浮窗上的图
export function applyBall() {
  const b = document.getElementById('stp-ball'); if (!b) return;
  b.classList.add('ico'); let i = b.querySelector('img'); i || (i = Object.assign(document.createElement('img'), { alt: '', draggable: false }), b.prepend(i));
  const u = ballUrl(); i.src != u && (i.src = u);
}
export const ballGrid = () => `<div class="bgrid">${BALLS.map(([k, n]) => `<div class="bt ${ballKey() == k ? 'on' : ''}" data-a="ball" data-x="${k}"><img src="${esc(ballUrl(k))}" alt=""><span>${esc(n)}</span></div>`).join('')}</div>`;
export const setBall = k => { S.ball = k; save(); applyBall(); };
// 设置里点「悬浮窗图标」：弹出来选
export function ballPicker(done) {
  const s = sheet({ title: '悬浮窗图标', noBack: 1, body: ballGrid, acts: { ball: k => { setBall(k); s.close(); toast('悬浮窗换成「' + ballName(k) + '」'); done?.(); } } });
}
