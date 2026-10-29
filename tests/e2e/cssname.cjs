// 样式撞名检查：style.css 是整个酒馆网页共用的，小手机的规则不能单独选中酒馆自己的元素
// （吃过两次亏：.cl 撞了微信列表；.sd 撞了酒馆「图像生成」给 <body> 加的 sd 类，整页布局全乱、什么都点不了）。
// 规则：一条选择器里只要有一节（空格 / > / + / ~ 隔开的一段）带了小手机自己的类名或 #stp，就碰不到酒馆的元素；
// 每一节都只用酒馆也有的类名（或只有标签）的，就会选中酒馆的元素 → 报错。要限制在小手机里，在前面加 :where(#stp)（不增加优先级）。
// node tests/e2e/cssname.cjs        检查
// node tests/e2e/cssname.cjs --fix  把撞名的规则自动加上 :where(#stp) 前缀
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..'), CSS = path.join(root, 'style.css');
const ST = new Set(fs.readFileSync(path.join(root, 'tests/st-classes.txt'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')));
const ALLOW = new Set(['html']); // 故意作用在整页上的（html 最小高度，不影响酒馆布局）

// 去掉 :not() / :where() / :is() / :has() 括号里的内容：它们不是「必须有」的类
const strip = s => { let o = '', d = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c == '(') { d++; continue; } if (c == ')') { d--; continue; } if (!d) o += c; } return o; };
const danger = sel => {
  const s = sel.trim(); if (!s || /#stp\b/.test(s) || /^:where\(#stp\)/.test(s)) return false;
  if (/^(from|to|\d+(\.\d+)?%)$/.test(s) || ALLOW.has(s)) return false;
  const parts = strip(s).replace(/::?[\w-]+/g, '').split(/\s*[\s>+~]\s*/).filter(Boolean);
  return parts.every(p => { const cl = p.match(/\.[A-Za-z_][\w-]*/g) || []; return cl.every(c => ST.has(c.slice(1))); }); // 每一节都碰得到酒馆的元素
};
// 很小的解析器：找出每条规则的选择器（跳过 @keyframes / @font-face 里面）
function scan(css, fix) {
  const out = []; let res = '', i = 0; const stack = [];
  while (i < css.length) {
    if (css.startsWith('/*', i)) { const j = css.indexOf('*/', i + 2) + 2; res += css.slice(i, j); i = j; continue; }
    if (/\s/.test(css[i])) { res += css[i++]; continue; } // 空白、注释原样留着，选择器从真正的字开始
    const c = css[i];
    if (c == '}') { stack.pop(); res += c; i++; continue; }
    if (c == '{' ) { stack.push('x'); res += c; i++; continue; }
    // 一段选择器：到下一个 { 为止（中间没有 } ;）
    const j = css.indexOf('{', i), k = css.indexOf('}', i), sc = css.indexOf(';', i);
    if (j < 0 || (k >= 0 && k < j) || (sc >= 0 && sc < j && !css.slice(i, sc).trim().startsWith('@'))) { const e = Math.min(...[k, sc].filter(x => x >= 0), css.length); res += css.slice(i, e === sc ? sc + 1 : e); i = e === sc ? sc + 1 : e; continue; }
    const head = css.slice(i, j), t = head.trim();
    if (t.startsWith('@')) { const kind = /^@(media|supports|layer|container)/.test(t) ? 'g' : 'skip'; res += head + '{'; i = j + 1; if (kind == 'skip') { let d = 1, m = i; while (m < css.length && d) { if (css[m] == '{') d++; else if (css[m] == '}') d--; m++; } res += css.slice(i, m); i = m; } else stack.push('g'); continue; }
    const sels = []; let d = 0, st = 0; for (let m = 0; m < head.length; m++) { const x = head[m]; if (x == '(') d++; else if (x == ')') d--; else if (x == ',' && !d) { sels.push(head.slice(st, m)); st = m + 1; } } sels.push(head.slice(st));
    const fixed = sels.map(s => { if (!danger(s)) return s; out.push(s.trim()); const lead = s.match(/^\s*/)[0]; return lead + ':where(#stp) ' + s.trim(); });
    res += (fix ? fixed.join(',') : head) + '{'; stack.push('r'); i = j + 1;
    let d2 = 1, m = i; while (m < css.length && d2) { if (css[m] == '{') d2++; else if (css[m] == '}') d2--; m++; } res += css.slice(i, m); i = m; stack.pop();
  }
  return { bad: out, css: res };
}
const css = fs.readFileSync(CSS, 'utf8'), r = scan(css, process.argv.includes('--fix'));
if (process.argv.includes('--fix')) { fs.writeFileSync(CSS, r.css); console.log(`改了 ${r.bad.length} 条选择器`); r.bad.forEach(s => console.log('  ' + s)); process.exit(0); }
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
ok(ST.size > 1000 && ST.has('sd') && ST.has('mes'), `酒馆类名清单读到了（${ST.size} 个，含 body 上的 sd、消息的 mes）`);
ok(!r.bad.length, r.bad.length ? `这些选择器会选中酒馆自己的元素（加 :where(#stp) 前缀或换个带前缀的类名）：\n      ${r.bad.slice(0, 30).join('\n      ')}` : 'style.css 里没有会选中酒馆元素的规则');
ok(danger('.sd') && danger('.row>span') && !danger('.pg-r .txt') && !danger('#stp .row') && !danger(':where(#stp) .row') && !danger('.xsd'), '检查规则自测：.sd / .row>span 会撞，.pg-r .txt / #stp .row / .xsd 不会');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
