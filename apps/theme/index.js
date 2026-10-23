// 小手机 · 主题：桌面主题 / 壁纸 / 小组件 / 气泡样式 / 头像框 / 表情包 / 图标 / 自定义CSS
import { S, save, esc, uid, ui, $, reg, page, top, fx, btn, sec, menu, form, toast, pickFile, pickImg, APPS } from '../../core.js';
import { renderDesk, icon } from '../../desk.js';

const BASE = { '--pg': '#f4f5f7', '--cd': '#fff', '--pt': '#1d1d1f', '--ln': 'rgba(0,0,0,.07)', '--gl': 'rgba(255,255,255,.45)', '--tx': '#fff', '--ink': '#333' };
export const THEMES = {
  matcha: { n: '抹茶星星', deco: 1, v: { '--wp': 'radial-gradient(120% 55% at 50% 48%,#b4dbbb 0%,#c6e3ca 45%,transparent 80%),linear-gradient(180deg,#dfe6e1 0%,#c1e0c7 42%,#a9d4b2 70%,#dfe7e1 100%)', '--ac': '#6fbf80', '--ink': '#3d5c45', '--gl': 'rgba(236,250,239,.5)', '--pg': '#f2f7f3' } },
  ios: { n: 'iOS 清透', v: { '--wp': 'radial-gradient(at 15% 10%,#a9c8ff 0,transparent 45%),radial-gradient(at 88% 28%,#f3c4ef 0,transparent 45%),radial-gradient(at 50% 88%,#ffd9a8 0,transparent 50%),#eef0f7', '--ac': '#0a84ff', '--ink': '#1c1c1e', '--pg': '#f2f2f7' } },
  cute: { n: '草莓牛奶', deco: 1, v: { '--wp': 'radial-gradient(#ffc9dc 1.6px,transparent 1.8px) 0 0/20px 20px,linear-gradient(180deg,#fff2f7,#ffd8e6 60%,#ffeaf1)', '--ac': '#ff7aa8', '--ink': '#83405b', '--gl': 'rgba(255,255,255,.6)', '--pg': '#fff6f9', '--tx': '#b8577c' } },
  cream: { n: '奶油布丁', v: { '--wp': 'radial-gradient(90% 50% at 50% 30%,#fff8ea,transparent),linear-gradient(180deg,#fbf3e4,#f1ddba 60%,#f8ecd6)', '--ac': '#d99a4e', '--ink': '#6b4f2c', '--gl': 'rgba(255,252,245,.6)', '--pg': '#fbf7f0', '--tx': '#8a6539' } },
  night: { n: '星夜', deco: 1, v: { '--wp': 'radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 18%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 66%,#fff,transparent),radial-gradient(1px 1px at 86% 58%,#fff,transparent),radial-gradient(1px 1px at 10% 80%,#fff,transparent),linear-gradient(180deg,#121836,#2a2156 55%,#45306f)', '--ac': '#a78bfa', '--ink': '#eceaff', '--gl': 'rgba(255,255,255,.1)', '--pg': '#111218', '--cd': '#1c1d25', '--pt': '#ececf2', '--ln': 'rgba(255,255,255,.08)' } },
};
export function applyTheme() {
  const t = THEMES[S.theme] || THEMES.matcha, r = ui.root; if (!r) return;
  Object.entries({ ...BASE, ...t.v }).forEach(([k, v]) => r.style.setProperty(k, v));
  r.style.setProperty('--wpi', S.wall ? `url("${S.wall}") center/cover` : t.v['--wp']); r.classList.toggle('deco', !!t.deco);
  $('#stp-css').textContent = S.css || '';
}

const AK = {
  widget: { n: '小组件', file: '.html,.txt', f: [['name', '名称'], ['sz', '尺寸', 'sel', [['2x1', '小 2×1'], ['2x2', '方 2×2'], ['4x1', '长条 4×1'], ['4x2', '大 4×2']]], ['html', 'HTML + CSS（支持 {{time}} {{date}} {{week}} {{user}} {{char}}）', 'area']] },
  bubble: { n: '气泡样式', file: '.css,text/css', f: [['name', '名称'], ['css', 'CSS（.bub 气泡 / .me 我方 / .av 头像 / .cv 聊天区，聊天设置里选择）', 'area']] },
  frame: { n: '头像框', f: [['name', '名称'], ['img', '图片（透明PNG）', 'img']] },
  sticker: { n: '表情包', f: [['name', '描述（AI 会按描述发送）'], ['img', '图片', 'img']] },
};
const rf = () => top()?.re();
async function edit(k, a) { const r = await form((a ? '编辑' : '新建') + AK[k].n, AK[k].f, a || {}); if (!r) return; a ? Object.assign(a, r) : S.assets[k].push({ id: uid(), ...r }); save(); rf(); }

reg({
  id: 'theme', name: '主题', icon: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.3-.7-2.1 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><g fill="#c7a6f5"><circle cx="7.5" cy="11" r="1.5"/><circle cx="10" cy="7" r="1.5"/></g><g fill="#ff9ec4"><circle cx="14.5" cy="7" r="1.5"/><circle cx="17" cy="10.5" r="1.4"/></g></svg>',
  open: () => page({
    title: '主题美化', cls: 'thm',
    body: () => { const f = fx(S); return `<div class="thm-g">${Object.entries(THEMES).map(([k, t]) => `<div class="tc ${S.theme == k ? 'on' : ''}" data-a="th" data-x="${k}"><div class="tc-p" style="background:${t.v['--wp']}"><i style="background:${t.v['--ac']}"></i><i></i><i></i><i></i><b style="background:${t.v['--gl'] || BASE['--gl']}"></b></div><span>${t.n}</span></div>`).join('')}</div>` + sec('thm', [
      ['wp', '壁纸', f.img('wall', '桌面壁纸（留空用主题壁纸）')],
      ...Object.entries(AK).map(([k, a]) => [k, `${a.n} · ${S.assets[k].length}`, `<div class="ag">${S.assets[k].map(x => `<div class="ai" data-a="ae" data-x="${k}:${x.id}" data-lp="ad">${x.img ? `<img src="${esc(x.img)}">` : `<b>${esc(x.name.slice(0, 2))}</b>`}<small>${esc(x.name)}</small></div>`).join('')}<div class="ai add" data-a="aa" data-x="${k}">＋</div></div>${a.file ? btn('af', '导入文件', k) : ''}${k == 'sticker' ? btn('ab', '批量导入链接') : ''}<p class="tip">点击编辑 · 长按删除${k == 'widget' ? ' / 添加到桌面' : ''}</p>`]),
      ['ic', '应用图标', Object.values(APPS).map(a => `<div class="row" data-a="ic" data-x="${a.id}"><span>${a.name}</span><div class="ico mini a-${a.id}">${icon(a.id)}</div></div>`).join('')],
      ['css', '自定义 CSS', f.area('css', '全局 CSS，作用于整个小手机（字体、颜色…）', '#stp{font-family:"LXGW WenKai"}')],
    ]); },
    acts: {
      th: (k, t, e, pg) => { S.theme = k; save(); applyTheme(); renderDesk(); pg.re(); },
      aa: k => edit(k), ae: x => { const [k, id] = x.split(':'); edit(k, S.assets[k].find(a => a.id == id)); },
      ad: async x => {
        const [k, id] = x.split(':'), l = S.assets[k], a = l.find(a => a.id == id), c = await menu([...(k == 'widget' ? [['d', '添加到桌面']] : []), ['x', '删除', 'danger']], esc(a.name));
        c == 'x' && l.splice(l.indexOf(a), 1);
        if (c == 'd') { const [w, h] = (a.sz || '2x2').split('x').map(Number); S.desk.pages[0].push({ id: uid(), t: 'w', k: 'custom', w, h, p: { html: a.html } }); renderDesk(); toast('已添加到桌面第一页'); }
        save(); rf();
      },
      af: async k => { const fl = await pickFile(AK[k].file); if (!fl) return; const t = await fl.text(); S.assets[k].push({ id: uid(), name: fl.name.replace(/\.\w+$/, ''), ...(k == 'widget' ? { html: t, sz: '2x2' } : { css: t }) }); save(); rf(); },
      ab: async () => { const r = await form('批量导入表情包', [['t', '每行一个：描述 + 空格 + 图片链接', 'area', '开心 https://xx.com/a.png\n委屈 https://xx.com/b.gif']]); let n = 0; r?.t?.split('\n').forEach(l => { const m = l.trim().match(/^(.*?)[\s:：|,，]*(https?:\/\/\S+)$/); if (m) { n++; S.assets.sticker.push({ id: uid(), name: m[1] || '表情' + n, img: m[2] }); } }); save(); toast(`已导入 ${n} 个`); rf(); },
      ic: async id => { const v = await pickImg(256); if (v == null) return; v ? (S.icons[id] = v) : delete S.icons[id]; save(); renderDesk(); rf(); },
    },
    onChange: k => /wall|css/.test(k) && applyTheme(),
  }),
});
