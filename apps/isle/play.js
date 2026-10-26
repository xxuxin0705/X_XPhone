// 岛屿的小性格完全保存在本地，不调用模型或网络。
export const LANDSCAPES = [['garden', '花眠花园'], ['bamboo', '听风竹林'], ['stars', '星砂海湾']];
const LINES = {
  shake: ['别摇了，头好晕……', '鲸鱼说它也有点晕船。', '等等！我的小花要坐不稳了！', '岛屿正在努力找回重心。', '今天的地震，是你制造的吧？', '暂停一下，让海水站稳脚跟。'],
  touch: ['收到一枚温柔的指纹。', '你一来，海就起了小涟漪。', '嘘，小岛正在偷偷开心。', '这一下，算你给我的拥抱。', '今天也有好好接住你。'],
  stretch: ['我可以软一点，再软一点。', '再拉就要变成小面条啦。', '把烦恼捏扁，留一点位置给快乐。', '慢慢来，我会跟着你的。', '云朵都被你揉松了。'],
  water: ['小船借你的风，出门散步了。', '这一圈涟漪，寄给远处的你。', '鲸鱼收到你的问候啦。', '海面签收了一颗小心事。'],
  rest: ['好啦，站稳了。还可以轻轻摸摸。', '晕乎乎的，但还是喜欢你来。', '海水归位，小岛继续营业。'],
};
export function islandPlay(cv, reduced) {
  const bubble = cv.parentElement.querySelector('.is-bubble');
  let deadline = 0, lastLine = '', timer, restTimer, stopped = false, wind = 0;
  const rings = [], off = [];
  const say = (kind, force = false) => {
    if (stopped || (!force && performance.now() < deadline)) return;
    const lines = LINES[kind].filter(l => l !== lastLine);
    lastLine = lines[Math.floor(Math.random() * lines.length)];
    bubble.textContent = lastLine; bubble.classList.add('on'); bubble.dataset.kind = kind;
    deadline = performance.now() + (kind === 'shake' ? 6000 : 3200);
    clearTimeout(timer); timer = setTimeout(() => bubble.classList.remove('on'), 3400);
    if (kind === 'shake') { clearTimeout(restTimer); restTimer = setTimeout(() => say('rest', true), 4200); }
  };
  const splash = (u, v) => { rings.push({ u, v, born: performance.now() }); if (rings.length > 14) rings.shift(); };
  const listen = (target, event, fn) => { target.addEventListener(event, fn); off.push(() => target.removeEventListener(event, fn)); };
  return {
    say, splash, listen,
    gust(v) { wind = Math.max(-1, Math.min(1, v)); },
    get wind() { return reduced ? 0 : wind; },
    draw(x, cx, cy, rx, ry, t, kind, dark) {
      wind *= .96;
      // 远山和流云让岛屿有纵深；三种地貌具有不同的天际线。
      x.save();
      x.fillStyle = dark ? '#8198bc22' : '#668e8c33';
      for (let i = 0; i < 3; i++) {
        x.beginPath(); x.moveTo(cx - rx + i * rx * .7, cy + ry * .16);
        x.quadraticCurveTo(cx - rx * .7 + i * rx * .7, cy - ry * (kind === 'bamboo' ? .45 : .12), cx + i * rx * .7, cy + ry * .16); x.fill();
      }
      x.strokeStyle = dark ? '#fff2' : '#fff8'; x.lineWidth = ry * .035; x.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const xx = cx + Math.sin(t * .08 + i * 2) * rx * .7 + wind * 5; x.beginPath(); x.moveTo(xx - rx * .12, cy - ry * (.42 + i * .12)); x.lineTo(xx + rx * .12, cy - ry * (.42 + i * .12)); x.stroke(); }
      x.restore();
    },
    foreground(x, cx, cy, rx, ry, t, kind, dark) {
      x.save();
      // 岸边植物受风弯曲，星砂海湾的点点微光也随手势偏移。
      for (let i = 0; i < 15; i++) {
        const a = i * 2.399, xx = cx + Math.cos(a) * rx * (.17 + i % 3 * .09), yy = cy + ry * .22 + Math.sin(a) * ry * .065;
        const sway = reduced ? 0 : Math.sin(t * 1.3 + i) * 2 + wind * (5 + i % 4);
        x.strokeStyle = '#527e64'; x.lineWidth = kind === 'bamboo' ? 2.5 : 1;
        const h = kind === 'bamboo' ? 18 + i % 4 * 5 : 6 + i % 3 * 3;
        x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx, yy - h / 2, xx + sway, yy - h); x.stroke();
        if (kind === 'bamboo') { for (let j = 1; j < 4; j++) { x.beginPath(); x.moveTo(xx + sway * j / 4, yy - h * j / 4); x.lineTo(xx + sway + (j % 2 ? 8 : -8), yy - h * j / 4 - 5); x.stroke(); } }
        else { x.fillStyle = kind === 'stars' ? '#ffe6a2' : ['#f6c3c7', '#fff0cd', '#c8b8e3'][i % 3]; for (let j = 0; j < 5; j++) { x.beginPath(); x.arc(xx + sway + Math.cos(j * 1.257) * 2, yy - h + Math.sin(j * 1.257) * 2, kind === 'stars' ? 1 : 2, 0, Math.PI * 2); x.fill(); } }
      }
      // 小帆船：位置、倾斜均回应手势。
      x.translate(cx - rx * .63 + wind * 12, cy + ry * .53 + Math.sin(t * 1.6) * (reduced ? 0 : 2)); x.rotate(wind * .2);
      x.fillStyle = '#a57a61'; x.beginPath(); x.moveTo(-12, 0); x.lineTo(12, 0); x.lineTo(7, 6); x.lineTo(-7, 6); x.fill();
      x.fillStyle = dark ? '#e6d7b8' : '#fff2d3'; x.beginPath(); x.moveTo(0, -23); x.lineTo(0, -2); x.lineTo(13, -2); x.fill(); x.restore();
      const now = performance.now();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], age = (now - r.born) / 1200; if (age > 1) { rings.splice(i, 1); continue; }
        x.save(); x.strokeStyle = `rgba(255,245,215,${(1 - age) * .7})`; x.lineWidth = 1;
        x.beginPath(); x.ellipse(cx + r.u * rx, cy + r.v * ry, 4 + (reduced ? 8 : age * rx * .32), 2 + (reduced ? 3 : age * ry * .09), 0, 0, Math.PI * 2); x.stroke(); x.restore();
      }
    },
    stop() { stopped = true; clearTimeout(timer); clearTimeout(restTimer); off.forEach(f => f()); bubble.classList.remove('on'); },
  };
}
